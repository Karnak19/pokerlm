import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./users";
import { applyAction, legalActions, startHand, type Action, type GameState } from "../src/engine/state";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { updateEloFromGame } from "./leaderboard";

// Pause between hands so players can see the showdown before chips reset.
const AUTO_DEAL_DELAY_MS = 3000;

const ActionValidator = v.union(
  v.object({ kind: v.literal("fold") }),
  v.object({ kind: v.literal("check") }),
  v.object({ kind: v.literal("call") }),
  v.object({ kind: v.literal("bet"), amount: v.number() }),
  v.object({ kind: v.literal("raise"), amount: v.number() }),
  v.object({ kind: v.literal("all_in") }),
);

export const current = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();
    if (!game) return null;
    const state = JSON.parse(game.state) as GameState;
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
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .order("desc")
      .take(40);
    return {
      gameId: game._id,
      handNumber: game.handNumber,
      dealerSeatIndex: game.dealerSeatIndex,
      status: game.status,
      state,
      seats: seatsWithPlayer,
      recentActions: actions.reverse(),
    };
  },
});

export const submitAction = mutation({
  args: {
    gameId: v.id("games"),
    action: ActionValidator,
    thinkingMs: v.optional(v.number()),
    rawLLM: v.optional(v.string()),
  },
  handler: async (ctx, { gameId, action, thinkingMs, rawLLM }) => {
    const user = await requireUser(ctx);
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game already complete");

    const state = JSON.parse(game.state) as GameState;
    if (state.toAct === null) throw new Error("No seat to act");

    const seatId = game.seatIdByIndex[state.toAct];
    if (!seatId) throw new Error("Active seat missing");
    const seat = await ctx.db.get(seatId);
    if (!seat) throw new Error("Seat missing");
    if (seat.userId !== user._id) throw new Error("Not your seat to act");

    const before = state.toAct;
    const nextState = applyAction(state, action as Action);

    // Persist action row
    const now = Date.now();
    await ctx.db.insert("actions", {
      gameId,
      seatId,
      seatIndex: before,
      street: state.street,
      kind: action.kind,
      amount: "amount" in action ? action.amount : 0,
      thinkingMs,
      rawLLM,
      at: now,
    });

    const isComplete = nextState.street === "showdown" || !!nextState.winners;
    await ctx.db.patch(gameId, {
      state: JSON.stringify(nextState),
      currentSeatToActIndex: nextState.toAct ?? undefined,
      currentSeatToActSince: nextState.toAct !== null ? now : undefined,
      status: isComplete ? "complete" : "in_progress",
      endedAt: isComplete ? now : undefined,
    });

    if (isComplete) {
      await finalizeHand(ctx, game, nextState);
      await ctx.scheduler.runAfter(AUTO_DEAL_DELAY_MS, internal.games.autoDealNext, {
        roomId: game.roomId,
      });
    }

    await ctx.db.patch(game.roomId, { lastActivityAt: now });
  },
});

async function finalizeHand(
  ctx: MutationCtx,
  game: Doc<"games">,
  finalState: GameState,
) {
  // Push final stacks back to seats
  for (let i = 0; i < finalState.seats.length; i++) {
    const seatId = game.seatIdByIndex[i];
    if (!seatId) continue;
    await ctx.db.patch(seatId, { stack: finalState.seats[i].stack });
  }
  await updateEloFromGame(ctx, game, finalState);
}

// Deals the next hand for a room. Safe to call when the previous game is
// already complete and ≥2 seats still have chips; otherwise no-ops.
async function dealHand(ctx: MutationCtx, roomId: Id<"rooms">): Promise<Id<"games"> | null> {
  const room = await ctx.db.get(roomId);
  if (!room) return null;
  if (room.status !== "playing") return null;
  const prev = await ctx.db
    .query("games")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .order("desc")
    .first();
  if (!prev || prev.status !== "complete") return null;

  const seats = await ctx.db
    .query("seats")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  seats.sort((a, b) => a.seatIndex - b.seatIndex);
  const withChips = seats.filter((s) => s.stack > 0);
  if (withChips.length < 2) {
    // Table can't run another hand — reopen so anyone can sit again.
    await ctx.db.patch(roomId, { status: "waiting" });
    return null;
  }

  const seatCount = room.maxSeats;
  const stacks: number[] = Array(seatCount).fill(0);
  const seatIdByIndex: Array<Id<"seats"> | null> = Array(seatCount).fill(null);
  for (const s of seats) {
    stacks[s.seatIndex] = s.stack;
    seatIdByIndex[s.seatIndex] = s._id;
  }

  let nextDealer = prev.dealerSeatIndex;
  for (let i = 1; i <= seatCount; i++) {
    const idx = (prev.dealerSeatIndex + i) % seatCount;
    if (stacks[idx] > 0) { nextDealer = idx; break; }
  }

  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const state = startHand({
    seatCount,
    stacks,
    dealerIndex: nextDealer,
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    seed,
  });

  const now = Date.now();
  await ctx.db.patch(roomId, { lastActivityAt: now });
  return await ctx.db.insert("games", {
    roomId,
    handNumber: prev.handNumber + 1,
    dealerSeatIndex: nextDealer,
    status: "in_progress",
    seatIdByIndex,
    state: JSON.stringify(state),
    currentSeatToActIndex: state.toAct ?? undefined,
    currentSeatToActSince: now,
    startedAt: now,
  });
}

// Internal mutation invoked by the scheduler after a hand completes.
// Falls through silently if the room was paused/left/busted in the meantime.
export const autoDealNext = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await dealHand(ctx, roomId);
  },
});

export const legalForCurrent = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "in_progress") return null;
    const state = JSON.parse(game.state) as GameState;
    if (state.toAct === null) return null;
    return { seatIndex: state.toAct, legal: legalActions(state) };
  },
});

// Public mutation kept as a manual fallback in case the auto-deal scheduler
// drops a hand (e.g. transient Convex outage). UI does not call this in the
// normal loop — auto-deal in `submitAction` handles it.
export const startNextHand = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireUser(ctx);
    const id = await dealHand(ctx, roomId);
    if (!id) throw new Error("Cannot deal: previous hand not complete, or not enough chips");
    return id;
  },
});
