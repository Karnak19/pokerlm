import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { evaluateBest } from "../src/engine/handEval";
import type { GameState } from "../src/engine/state";
import type { Card } from "../src/engine/cards";
import type { Id } from "./_generated/dataModel";

const DEFAULT_RATING = 1500;
const K = 24;

function expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export async function updateEloFromGame(
  ctx: MutationCtx,
  game: { _id: Id<"games">; seatIdByIndex: Array<Id<"seats"> | null> },
  finalState: GameState,
) {
  // Seats that reached showdown = active or all_in with hole cards still set.
  const showdown = finalState.seats.filter(
    (s) => (s.status === "active" || s.status === "all_in") && s.hole && s.totalContributed > 0,
  );
  if (showdown.length < 2) return;

  const winners = new Set((finalState.winners ?? []).map((w) => w.seatIndex));

  // Resolve playerIds and current ratings
  const entries: { seatIndex: number; playerId: Id<"players">; ratingDoc: { _id: Id<"elo">; rating: number; gamesPlayed: number; wins: number } | null; hand: ReturnType<typeof evaluateBest> }[] = [];
  for (const s of showdown) {
    const seatId = game.seatIdByIndex[s.seatIndex];
    if (!seatId) continue;
    const seat = await ctx.db.get(seatId);
    if (!seat) continue;
    const ratingDoc = await ctx.db
      .query("elo")
      .withIndex("by_player", (q) => q.eq("playerId", seat.playerId))
      .first();
    const hand = evaluateBest([...(s.hole as Card[]), ...(finalState.community as Card[])]);
    entries.push({ seatIndex: s.seatIndex, playerId: seat.playerId, ratingDoc, hand });
  }

  // Pairwise updates
  const deltas = new Map<Id<"players">, number>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      const ra = a.ratingDoc?.rating ?? DEFAULT_RATING;
      const rb = b.ratingDoc?.rating ?? DEFAULT_RATING;
      let sa: number, sb: number;
      if (a.hand.score > b.hand.score) { sa = 1; sb = 0; }
      else if (a.hand.score < b.hand.score) { sa = 0; sb = 1; }
      else { sa = 0.5; sb = 0.5; }
      const ea = expected(ra, rb);
      const eb = 1 - ea;
      deltas.set(a.playerId, (deltas.get(a.playerId) ?? 0) + K * (sa - ea));
      deltas.set(b.playerId, (deltas.get(b.playerId) ?? 0) + K * (sb - eb));
    }
  }

  for (const e of entries) {
    const delta = deltas.get(e.playerId) ?? 0;
    const won = winners.has(e.seatIndex) ? 1 : 0;
    if (e.ratingDoc) {
      await ctx.db.patch(e.ratingDoc._id, {
        rating: e.ratingDoc.rating + delta,
        gamesPlayed: e.ratingDoc.gamesPlayed + 1,
        wins: e.ratingDoc.wins + won,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("elo", {
        playerId: e.playerId,
        rating: DEFAULT_RATING + delta,
        gamesPlayed: 1,
        wins: won,
        updatedAt: Date.now(),
      });
    }
  }
}

export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("elo").collect();
    rows.sort((a, b) => b.rating - a.rating);
    const out = await Promise.all(
      rows.slice(0, limit ?? 50).map(async (r) => {
        const player = await ctx.db.get(r.playerId);
        const owner = player ? await ctx.db.get(player.userId) : null;
        return {
          rating: Math.round(r.rating),
          gamesPlayed: r.gamesPlayed,
          wins: r.wins,
          player: player ? { name: player.name, model: player.model } : null,
          owner: owner ? { _id: owner._id, name: owner.name, email: owner.email } : null,
        };
      }),
    );
    return out.filter((r) => r.player !== null);
  },
});
