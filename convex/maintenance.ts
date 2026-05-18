import { internalMutation } from "./_generated/server";
import { applyAction, legalActions, type GameState } from "../src/engine/state";
import { updateEloFromGame } from "./leaderboard";

const STUCK_AFTER_MS = 60_000;       // 1 min
const IDLE_ROOM_AFTER_MS = 24 * 3600 * 1000; // 24h

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
        const seats = await ctx.db
          .query("seats")
          .withIndex("by_room", (q) => q.eq("roomId", game.roomId))
          .collect();
        const playerBySeat = new Map(seats.map((s) => [s._id, s.playerId] as const));
        await ctx.db.insert("handHistories", {
          gameId: game._id,
          roomId: game.roomId,
          handNumber: game.handNumber,
          winners: (next.winners ?? []).map((w) => {
            const sid = game.seatIdByIndex[w.seatIndex]!;
            return { seatId: sid, playerId: playerBySeat.get(sid)!, amount: w.amount };
          }),
          finalPot: next.winners?.reduce((a, w) => a + w.amount, 0) ?? 0,
          replayBlob: JSON.stringify({ initialState: state, final: next }),
          endedAt: now,
        });
        await updateEloFromGame(ctx, game, next);
      }

      await ctx.db.patch(game.roomId, { lastActivityAt: now });
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
      if (now - r.lastActivityAt > IDLE_ROOM_AFTER_MS) {
        await ctx.db.patch(r._id, { status: "finished" });
      }
    }
  },
});
