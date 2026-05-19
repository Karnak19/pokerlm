import { query } from "./_generated/server";
import { v } from "convex/values";

// Read the viewer's own memory rows for every seat they hold in this room.
// Keyed by seatId for direct lookup from the table view. Returns text or
// null per seat (null = no reflect has fired yet, blank slate).
export const mineForRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return {};
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const mine = seats.filter((s) => s.userId === user._id);
    const out: Record<string, { text: string; updatedAt: number } | null> = {};
    for (const s of mine) {
      const mem = await ctx.db
        .query("memories")
        .withIndex("by_seat", (q) => q.eq("seatId", s._id))
        .first();
      out[s._id] = mem ? { text: mem.text, updatedAt: mem.updatedAt } : null;
    }
    return out;
  },
});
