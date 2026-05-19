import { internalMutation } from "./_generated/server";
import { applyAction, legalActions, type GameState } from "../src/engine/state";
import { updateEloFromGame } from "./leaderboard";
import { internal } from "./_generated/api";

// Matches games.ts — wait long enough for browser-side reflect calls to land.
const AUTO_DEAL_DELAY_MS = 15000;

const STUCK_AFTER_MS = 60_000;             // 1 min
const EMPTY_ROOM_AFTER_MS = 60 * 60 * 1000;          // 1h — waiting room with zero seats
const OCCUPIED_IDLE_ROOM_AFTER_MS = 24 * 3600 * 1000; // 24h — waiting room with seats but never started

export const resolveStuckTurns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const games = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();

    for (const game of games) {
      if (!game.currentSeatToActSince) continue;
      if (now - game.currentSeatToActSince < STUCK_AFTER_MS) continue;

      const state = JSON.parse(game.state) as GameState;
      if (state.toAct === null) continue;
      const legal = legalActions(state);
      const fallback = legal.canCheck ? { kind: "check" as const } : { kind: "fold" as const };
      const seatId = game.seatIdByIndex[state.toAct];
      if (!seatId) continue;

      let next: GameState;
      try {
        next = applyAction(state, fallback);
      } catch {
        continue;
      }

      await ctx.db.insert("actions", {
        gameId: game._id,
        seatId,
        seatIndex: state.toAct,
        street: state.street,
        kind: fallback.kind,
        amount: 0,
        at: now,
      });

      const complete = next.street === "showdown" || !!next.winners;
      await ctx.db.patch(game._id, {
        state: JSON.stringify(next),
        currentSeatToActIndex: next.toAct ?? undefined,
        currentSeatToActSince: next.toAct !== null ? now : undefined,
        status: complete ? "complete" : "in_progress",
        endedAt: complete ? now : undefined,
      });

      if (complete) {
        // mirror finalizeHand logic (lightweight version, no separate import to avoid circular)
        for (let i = 0; i < next.seats.length; i++) {
          const sid = game.seatIdByIndex[i];
          if (!sid) continue;
          await ctx.db.patch(sid, { stack: next.seats[i].stack });
        }
        await updateEloFromGame(ctx, game, next);
        await ctx.scheduler.runAfter(AUTO_DEAL_DELAY_MS, internal.games.autoDealNext, {
          roomId: game.roomId,
        });
      }

      await ctx.db.patch(game.roomId, { lastActivityAt: now });
    }
  },
});

// Snapshot the current ELO of every alive player into `eloHistory`. Runs on
// a 2h cron — the table is no longer written to per-hand, so this is the
// sole source of rows for sparklines / movers / the editor side panel.
// Retired players are skipped (their rating can no longer change).
export const snapshotEloHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const players = await ctx.db.query("players").collect();
    for (const p of players) {
      if ((p.status ?? "alive") !== "alive") continue;
      const elo = await ctx.db
        .query("elo")
        .withIndex("by_player", (q) => q.eq("playerId", p._id))
        .first();
      if (!elo) continue;
      await ctx.db.insert("eloHistory", {
        playerId: p._id,
        rating: elo.rating,
        at: now,
      });
    }
  },
});

export const archiveIdleRooms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();
    for (const r of rooms) {
      const idleFor = now - r.lastActivityAt;
      const seats = await ctx.db
        .query("seats")
        .withIndex("by_room", (q) => q.eq("roomId", r._id))
        .collect();
      const threshold = seats.length === 0 ? EMPTY_ROOM_AFTER_MS : OCCUPIED_IDLE_ROOM_AFTER_MS;
      if (idleFor > threshold) {
        await ctx.db.patch(r._id, { status: "finished" });
      }
    }
  },
});
