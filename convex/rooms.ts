import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./users";
import { applyAction, startHand, type GameState } from "../src/engine/state";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { STARTING_BANKROLL } from "./players";

// Resolve effective bankroll for a player (handles pre-bankroll rows).
function bankrollOf(player: Doc<"players">): number {
  return player.bankroll ?? STARTING_BANKROLL;
}

// A player is "alive" by default if status hasn't been written yet.
function isAlive(player: Doc<"players">): boolean {
  return (player.status ?? "alive") === "alive";
}

// Cash-out: returns the seat's remaining chips to the player's bankroll
// and retires the player if the resulting bankroll hits 0 AND they have
// no other seats anywhere. Used by both `leave` and the eviction sweep
// in `dealHand`. Exported so games.ts can call it.
export async function cashOutSeat(
  ctx: MutationCtx,
  seat: Doc<"seats">,
): Promise<void> {
  const player = await ctx.db.get(seat.playerId);
  if (!player) return;
  const roll = bankrollOf(player);
  const next = roll + seat.stack;
  await ctx.db.patch(seat.playerId, { bankroll: next });
  if (next > 0) return;
  // Bankroll hit zero. Retire only if this is the player's last seat.
  const otherSeats = await ctx.db
    .query("seats")
    .filter((q) =>
      q.and(
        q.eq(q.field("playerId"), seat.playerId),
        q.neq(q.field("_id"), seat._id),
      ),
    )
    .collect();
  if (otherSeats.length > 0) return;
  await ctx.db.patch(seat.playerId, { status: "retired", retiredAt: Date.now() });
}

export const listOpen = query({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .order("desc")
      .collect();
    return await Promise.all(
      rooms.map(async (r) => {
        const seats = await ctx.db
          .query("seats")
          .withIndex("by_room", (q) => q.eq("roomId", r._id))
          .collect();
        return { ...r, seatsTaken: seats.length };
      }),
    );
  },
});

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const seatsWithPlayer = await Promise.all(
      seats.map(async (s) => {
        const player = await ctx.db.get(s.playerId);
        return { ...s, player };
      }),
    );
    return { ...room, seats: seatsWithPlayer };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    maxSeats: v.number(),
    smallBlind: v.optional(v.number()),
    bigBlind: v.optional(v.number()),
    startingStack: v.optional(v.number()),
  },
  handler: async (ctx, { name, maxSeats, smallBlind, bigBlind, startingStack }) => {
    const user = await requireUser(ctx);
    if (maxSeats < 2 || maxSeats > 6) throw new Error("maxSeats must be 2..6");
    const now = Date.now();
    return await ctx.db.insert("rooms", {
      name: name.trim().slice(0, 60) || "Room",
      status: "waiting",
      maxSeats,
      smallBlind: smallBlind ?? 5,
      bigBlind: bigBlind ?? 10,
      startingStack: startingStack ?? 1000,
      createdBy: user._id,
      createdAt: now,
      lastActivityAt: now,
    });
  },
});

export const sit = mutation({
  args: { roomId: v.id("rooms"), playerId: v.id("players") },
  handler: async (ctx, { roomId, playerId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== "waiting") throw new Error("Room already started");

    // Anti-boost invariant: at most one seat per user per room.
    const existing = await ctx.db
      .query("seats")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .first();
    if (existing) throw new Error("You already have a seat in this room");

    const player = await ctx.db.get(playerId);
    if (!player || player.userId !== user._id) throw new Error("Not your player");
    if (!isAlive(player)) throw new Error("Player is retired — they busted and can't sit again");

    const buyIn = room.startingStack;
    const roll = bankrollOf(player);
    if (roll < buyIn) {
      throw new Error(
        `Not enough bankroll: needs $${buyIn}, has $${roll}. Sit at a smaller table or roll a new player.`,
      );
    }

    const taken = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (taken.length >= room.maxSeats) throw new Error("Room full");

    const usedIndexes = new Set(taken.map((s) => s.seatIndex));
    let seatIndex = 0;
    while (usedIndexes.has(seatIndex)) seatIndex++;
    if (seatIndex >= room.maxSeats) throw new Error("No seats free");

    // Deduct the buy-in from the player's bankroll; it will be returned
    // when they cash out (leave or get evicted in dealHand).
    await ctx.db.patch(playerId, { bankroll: roll - buyIn });
    await ctx.db.insert("seats", {
      roomId,
      playerId,
      userId: user._id,
      seatIndex,
      stack: buyIn,
      status: "active",
    });
    await ctx.db.patch(roomId, { lastActivityAt: Date.now() });
  },
});

// Queue the user's seat for removal at the end of the current hand. While
// the flag is set the bot keeps playing the hand normally; the seat is
// reaped inside dealHand before the next deal.
export const leaveAfterHand = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const seat = await ctx.db
      .query("seats")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .first();
    if (!seat) return;
    await ctx.db.patch(seat._id, { leaveAfterHand: true });
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    const seat = await ctx.db
      .query("seats")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .first();
    if (!seat) return;

    // If a hand is live and the leaver is still in it, force-fold so the
    // engine advances cleanly before we drop the seat.
    if (room.status === "playing") {
      const game = await ctx.db
        .query("games")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .order("desc")
        .first();
      if (game && game.status === "in_progress") {
        const state = JSON.parse(game.state) as GameState;
        const engineSeat = state.seats[seat.seatIndex];
        if (engineSeat && engineSeat.status !== "folded" && engineSeat.status !== "sitting_out") {
          let next = state;
          // Only the to-act seat can submit a normal fold; for everyone
          // else just mark folded and let the next applyAction wake the
          // remaining live seats.
          if (state.toAct === seat.seatIndex) {
            next = applyAction(state, { kind: "fold" });
          } else {
            next = { ...state, seats: state.seats.map((s, i) => i === seat.seatIndex ? { ...s, status: "folded" } : s) };
          }
          const complete = next.street === "showdown" || !!next.winners;
          const now = Date.now();
          await ctx.db.insert("actions", {
            gameId: game._id,
            seatId: seat._id,
            seatIndex: seat.seatIndex,
            street: state.street,
            kind: "fold",
            amount: 0,
            at: now,
          });
          await ctx.db.patch(game._id, {
            state: JSON.stringify(next),
            currentSeatToActIndex: next.toAct ?? undefined,
            currentSeatToActSince: next.toAct !== null ? now : undefined,
            status: complete ? "complete" : "in_progress",
            endedAt: complete ? now : undefined,
          });
          if (complete) {
            for (let i = 0; i < next.seats.length; i++) {
              const sid = game.seatIdByIndex[i];
              if (!sid) continue;
              await ctx.db.patch(sid, { stack: next.seats[i].stack });
            }
            await ctx.scheduler.runAfter(3000, internal.games.autoDealNext, { roomId });
          }
        }
      }
    }

    // Cash out the seat's remaining chips back to the player's bankroll
    // (and retire them if they're now broke with no other seats).
    await cashOutSeat(ctx, seat);
    await ctx.db.delete(seat._id);
    const remaining = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const patch: { lastActivityAt: number; status?: "waiting" } = { lastActivityAt: Date.now() };
    if (remaining.length < 2 && room.status === "playing") {
      // Not enough players left to run a hand — reopen the room so others can sit.
      patch.status = "waiting";
    }
    await ctx.db.patch(roomId, patch);
  },
});

export const start = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.createdBy !== user._id) throw new Error("Only the room creator can start");
    if (room.status !== "waiting") throw new Error("Already started");

    const seats = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (seats.length < 2) throw new Error("Need at least 2 seats");

    seats.sort((a, b) => a.seatIndex - b.seatIndex);

    // Build engine state (engine is seatIndex-based; need contiguous indexes)
    const seatCount = room.maxSeats;
    const stacks: number[] = Array(seatCount).fill(0);
    const seatIdByIndex: Array<Id<"seats"> | null> = Array(seatCount).fill(null);
    for (const s of seats) {
      stacks[s.seatIndex] = s.stack;
      seatIdByIndex[s.seatIndex] = s._id;
    }

    const dealerIndex = seats[0].seatIndex;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

    const state = startHand({
      seatCount,
      stacks,
      dealerIndex,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
      seed,
    });

    const now = Date.now();
    const gameId = await ctx.db.insert("games", {
      roomId,
      handNumber: 1,
      dealerSeatIndex: dealerIndex,
      status: "in_progress",
      seatIdByIndex,
      state: JSON.stringify(state),
      currentSeatToActIndex: state.toAct ?? undefined,
      currentSeatToActSince: now,
      startedAt: now,
    });
    await ctx.db.patch(roomId, { status: "playing", lastActivityAt: now });
    return gameId;
  },
});
