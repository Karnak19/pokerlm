import { query } from "./_generated/server";
import { v } from "convex/values";

export const listByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("handHistories")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(50);
  },
});

export const get = query({
  args: { handHistoryId: v.id("handHistories") },
  handler: async (ctx, { handHistoryId }) => {
    const hh = await ctx.db.get(handHistoryId);
    if (!hh) return null;
    const game = await ctx.db.get(hh.gameId);
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_game", (q) => q.eq("gameId", hh.gameId))
      .collect();
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", hh.roomId))
      .collect();
    const seatsWithPlayer = await Promise.all(
      seats.map(async (s) => ({ ...s, player: await ctx.db.get(s.playerId) })),
    );
    return { handHistory: hh, game, actions, seats: seatsWithPlayer };
  },
});
