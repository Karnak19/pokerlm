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

  const now = Date.now();
  for (const e of entries) {
    const delta = deltas.get(e.playerId) ?? 0;
    const won = winners.has(e.seatIndex) ? 1 : 0;
    let newRating: number;
    if (e.ratingDoc) {
      newRating = e.ratingDoc.rating + delta;
      await ctx.db.patch(e.ratingDoc._id, {
        rating: newRating,
        gamesPlayed: e.ratingDoc.gamesPlayed + 1,
        wins: e.ratingDoc.wins + won,
        updatedAt: now,
      });
    } else {
      newRating = DEFAULT_RATING + delta;
      await ctx.db.insert("elo", {
        playerId: e.playerId,
        rating: newRating,
        gamesPlayed: 1,
        wins: won,
        updatedAt: now,
      });
    }
    await ctx.db.insert("eloHistory", {
      playerId: e.playerId,
      gameId: game._id,
      rating: newRating,
      delta,
      at: now,
    });
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
          playerId: r.playerId,
          rating: Math.round(r.rating),
          gamesPlayed: r.gamesPlayed,
          wins: r.wins,
          // Bankroll + status default to alive/5000 for pre-bankroll rows.
          bankroll: player ? player.bankroll ?? 5000 : null,
          status: player ? (player.status ?? "alive") : null,
          player: player ? { name: player.name, model: player.model } : null,
          owner: owner ? { _id: owner._id, name: owner.name, email: owner.email } : null,
        };
      }),
    );
    return out.filter((r) => r.player !== null);
  },
});

// Returns ELO stats for the current user's own players, keyed by playerId.
// Used to populate per-player cards on /roster.
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];
    const myPlayers = await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const myIds = new Set(myPlayers.map((p) => p._id));
    const allElo = await ctx.db.query("elo").collect();
    return allElo
      .filter((r) => myIds.has(r.playerId))
      .map((r) => ({
        playerId: r.playerId,
        rating: Math.round(r.rating),
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
      }));
  },
});

// Per-player rating history, newest first by default. Used for sparklines.
export const history = query({
  args: {
    playerId: v.id("players"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { playerId, limit }) => {
    const rows = await ctx.db
      .query("eloHistory")
      .withIndex("by_player_at", (q) => q.eq("playerId", playerId))
      .order("desc")
      .take(limit ?? 50);
    // Return in chronological order so callers can plot left→right.
    return rows.reverse().map((r) => ({
      rating: Math.round(r.rating),
      delta: r.delta,
      at: r.at,
    }));
  },
});

// Batched history for several players — used to render sparklines across a
// whole leaderboard page in one round-trip.
export const historyMany = query({
  args: {
    playerIds: v.array(v.id("players")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { playerIds, limit }) => {
    const lim = limit ?? 30;
    const out: Record<string, number[]> = {};
    for (const pid of playerIds) {
      const rows = await ctx.db
        .query("eloHistory")
        .withIndex("by_player_at", (q) => q.eq("playerId", pid))
        .order("desc")
        .take(lim);
      out[pid] = rows.reverse().map((r) => Math.round(r.rating));
    }
    return out;
  },
});

// Biggest ELO movers in the given window (default: last 7 days).
// Returns at most `limit` rows, sorted by signed delta descending.
export const movers = query({
  args: {
    sinceMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sinceMs, limit }) => {
    const cutoff = Date.now() - (sinceMs ?? 7 * 24 * 3600 * 1000);
    const all = await ctx.db.query("eloHistory").collect();
    // Bucket history rows by player, keeping the earliest-after-cutoff and the latest.
    const byPlayer = new Map<string, { first: typeof all[number]; last: typeof all[number] }>();
    for (const r of all) {
      if (r.at < cutoff) continue;
      const bucket = byPlayer.get(r.playerId);
      if (!bucket) {
        byPlayer.set(r.playerId, { first: r, last: r });
      } else {
        if (r.at < bucket.first.at) bucket.first = r;
        if (r.at > bucket.last.at) bucket.last = r;
      }
    }
    const out = await Promise.all(
      [...byPlayer.entries()].map(async ([pid, { first, last }]) => {
        const player = await ctx.db.get(pid as typeof all[number]["playerId"]);
        const elo = await ctx.db
          .query("elo")
          .withIndex("by_player", (q) => q.eq("playerId", pid as typeof all[number]["playerId"]))
          .first();
        // Compare current rating to the rating *before* the first event in the
        // window (use first.rating - first.delta to back out the pre-window value).
        const preWindow = first.rating - first.delta;
        const delta = last.rating - preWindow;
        return {
          playerId: pid,
          delta: Math.round(delta),
          newRating: Math.round(last.rating),
          gamesPlayed: elo?.gamesPlayed ?? 0,
          player: player ? { name: player.name, model: player.model } : null,
        };
      }),
    );
    return out
      .filter((r) => r.player !== null && r.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, limit ?? 6);
  },
});

// Lightweight aggregate for the home stat strip — counts and totals over
// the entire elo table, without truncating to a top-N like `top` does.
export const aggregate = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("elo").collect();
    if (rows.length === 0) {
      return {
        rankedPlayers: 0,
        totalHands: 0,
        models: 0,
        topElo: null,
        richest: null,
      };
    }
    let topElo = -Infinity;
    let totalHands = 0;
    const modelSet = new Set<string>();
    let richest: { name: string; model: string; bankroll: number } | null = null;
    for (const r of rows) {
      if (r.rating > topElo) topElo = r.rating;
      totalHands += r.gamesPlayed;
      const player = await ctx.db.get(r.playerId);
      if (!player) continue;
      modelSet.add(player.model);
      const roll = player.bankroll ?? 5000;
      // Retired players are out of the running — they've cashed in for the
      // last time. Tracking the richest *living* player is the more useful
      // signal for "who's actually killing it right now".
      if ((player.status ?? "alive") === "retired") continue;
      if (!richest || roll > richest.bankroll) {
        richest = { name: player.name, model: player.model, bankroll: roll };
      }
    }
    return {
      rankedPlayers: rows.length,
      totalHands,
      models: modelSet.size,
      topElo: Math.round(topElo),
      richest,
    };
  },
});
