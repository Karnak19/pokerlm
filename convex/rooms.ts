import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./users";
import { startHand } from "../src/engine/state";
import type { Id } from "./_generated/dataModel";

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

    const taken = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (taken.length >= room.maxSeats) throw new Error("Room full");

    const usedIndexes = new Set(taken.map((s) => s.seatIndex));
    let seatIndex = 0;
    while (usedIndexes.has(seatIndex)) seatIndex++;
    if (seatIndex >= room.maxSeats) throw new Error("No seats free");

    await ctx.db.insert("seats", {
      roomId,
      playerId,
      userId: user._id,
      seatIndex,
      stack: room.startingStack,
      status: "active",
    });
    await ctx.db.patch(roomId, { lastActivityAt: Date.now() });
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status === "playing") throw new Error("Cannot leave a room in play");
    const seat = await ctx.db
      .query("seats")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .first();
    if (!seat) return;
    await ctx.db.delete(seat._id);
    await ctx.db.patch(roomId, { lastActivityAt: Date.now() });
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
