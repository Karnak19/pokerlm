import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./users";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    systemPrompt: v.string(),
  },
  handler: async (ctx, { name, model, systemPrompt }) => {
    const user = await requireUser(ctx);
    if (!name.trim()) throw new Error("Name required");
    if (!model.trim()) throw new Error("Model required");
    return await ctx.db.insert("players", {
      userId: user._id,
      name: name.trim().slice(0, 60),
      model: model.trim(),
      systemPrompt: systemPrompt.slice(0, 4000),
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    playerId: v.id("players"),
    name: v.optional(v.string()),
    model: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, { playerId, name, model, systemPrompt }) => {
    const user = await requireUser(ctx);
    const player = await ctx.db.get(playerId);
    if (!player || player.userId !== user._id) throw new Error("Not your player");
    const patch: Record<string, string> = {};
    if (name !== undefined) patch.name = name.trim().slice(0, 60);
    if (model !== undefined) patch.model = model.trim();
    if (systemPrompt !== undefined) patch.systemPrompt = systemPrompt.slice(0, 4000);
    await ctx.db.patch(playerId, patch);
  },
});

export const remove = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, { playerId }) => {
    const user = await requireUser(ctx);
    const player = await ctx.db.get(playerId);
    if (!player || player.userId !== user._id) throw new Error("Not your player");
    await ctx.db.delete(playerId);
  },
});
