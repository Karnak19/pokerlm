import { action, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { GameState, LegalActions } from "../src/engine/state";
import { legalActions } from "../src/engine/state";
import { coerceToLegal } from "../src/engine/llmParse";
import type { Id } from "./_generated/dataModel";
import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

// Internal query — read everything the action needs in one shot (consistent snapshot).
export const seatContext = internalQuery({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") return null;
    const state = JSON.parse(game.state) as GameState;
    if (state.toAct === null) return null;
    const seatId = game.seatIdByIndex[state.toAct] as Id<"seats"> | null;
    if (!seatId) return null;
    const seat = await ctx.db.get(seatId);
    if (!seat) return null;
    const player = await ctx.db.get(seat.playerId);
    if (!player) return null;
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(30);
    return {
      gameId,
      seatIndex: state.toAct,
      ownerUserId: seat.userId,
      state,
      legal: legalActions(state),
      hole: state.seats[state.toAct].hole,
      community: state.community,
      pot: state.pot,
      street: state.street,
      currentBet: state.currentBet,
      bigBlind: state.bigBlind,
      seats: state.seats.map((s) => ({
        seatIndex: s.seatIndex,
        stack: s.stack,
        streetBet: s.streetBet,
        status: s.status,
      })),
      player: {
        name: player.name,
        model: player.model,
        systemPrompt: player.systemPrompt,
      },
      history: actions.reverse().map((a) => ({
        seatIndex: a.seatIndex,
        kind: a.kind,
        amount: a.amount,
        street: a.street,
      })),
    };
  },
});

type SeatCtx = {
  gameId: Id<"games">;
  seatIndex: number;
  ownerUserId: Id<"users">;
  state: GameState;
  legal: LegalActions;
  hole: [string, string] | null;
  community: string[];
  pot: number;
  street: string;
  currentBet: number;
  bigBlind: number;
  seats: {
    seatIndex: number;
    stack: number;
    streetBet: number;
    status: string;
  }[];
  player: { name: string; model: string; systemPrompt: string };
  history: {
    seatIndex: number;
    kind: string;
    amount: number;
    street: string;
  }[];
};

function buildPrompt(ctx: SeatCtx): { system: string; user: string } {
  const {
    player,
    hole,
    community,
    pot,
    street,
    currentBet,
    bigBlind,
    seats,
    seatIndex,
    legal,
    history,
  } = ctx;
  const system = `You are a Texas Hold'em poker player.
Strategy directive from the user: ${player.systemPrompt}

Rules:
- "amount" for bet/raise is the TOTAL chips you want your street-bet to be at after the action (not the increment).
- If the action you choose isn't legal, it will be coerced to a safe default (check or fold).
- Be decisive.`;

  const me = seats[seatIndex];
  const opponents = seats
    .filter((s) => s.seatIndex !== seatIndex && s.status !== "sitting_out")
    .map(
      (s) =>
        `seat ${s.seatIndex + 1}: stack ${s.stack}, bet ${s.streetBet}, ${s.status}`,
    )
    .join("\n");

  const legalLines = [
    legal.canFold && "fold",
    legal.canCheck && "check",
    legal.canCall && `call (${legal.callAmount} chips)`,
    legal.canBet && `bet (min ${legal.minRaiseTo}, max ${legal.maxRaiseTo})`,
    legal.canRaise &&
      `raise to (min ${legal.minRaiseTo}, max ${legal.maxRaiseTo})`,
  ]
    .filter(Boolean)
    .join(", ");

  const user = `Street: ${street} | Big blind: ${bigBlind} | Pot: ${pot}
Board: ${community.join(" ") || "(none)"}
Your hole cards: ${(hole ?? []).join(" ")}
Your stack: ${me.stack} | Your street-bet so far: ${me.streetBet}
Current bet to match: ${currentBet}
Opponents:
${opponents}

Recent action history (this hand):
${history.map((a) => `  seat ${a.seatIndex + 1} ${a.kind}${a.amount ? ` ${a.amount}` : ""} (${a.street})`).join("\n") || "  (none)"}

Legal actions: ${legalLines}`;

  return { system, user };
}

export const decide = action({
  args: {
    gameId: v.id("games"),
    apiKey: v.string(),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { gameId, apiKey, timeoutMs },
  ): Promise<{ status: "ok" | "skipped" | "error"; reason?: string }> => {
    const seatCtx = await ctx.runQuery(internal.openrouter.seatContext, {
      gameId,
    });
    if (!seatCtx) return { status: "skipped", reason: "no seat to act" };

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "error", reason: "not authenticated" };
    // Defensive: only the seat owner may call this with their key
    const user = await ctx.runQuery(api.users.me, {});
    if (!user || user._id !== seatCtx.ownerUserId) {
      return { status: "error", reason: "not your seat" };
    }

    const { system, user: userMsg } = buildPrompt(seatCtx);
    const startedAt = Date.now();
    let raw = "";
    let action: ReturnType<typeof coerceToLegal>;

    // OpenRouter App Attribution — these headers make the call show up under
    // PokerLM in the user's logs and count toward our app on the OpenRouter
    // public leaderboard. Set SITE_URL in Convex env (`npx convex env set
    // SITE_URL https://pokerlm.app`) to override the fallback.
    // https://openrouter.ai/docs/app-attribution
    const siteUrl =
      process.env.SITE_URL ?? "https://github.com/Karnak19/pokerlm";
    const openrouter = createOpenRouter({
      apiKey,
      headers: {
        "HTTP-Referer": siteUrl,
        "X-Title": "PokerLM",
        "X-OpenRouter-Categories": "game",
      },
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 15000);
      const { output: decision } = await generateText({
        model: openrouter.chat(seatCtx.player.model),
        output: Output.object({ schema: ActionSchema }),
        system,
        prompt: userMsg,
        temperature: 0.7,
        abortSignal: controller.signal,
      });
      clearTimeout(timeout);
      raw = JSON.stringify(decision);
      action = coerceToLegal(
        decision.action,
        decision.amount,
        seatCtx.legal as LegalActions,
      );
    } catch (e) {
      raw = `error: ${e instanceof Error ? e.message : String(e)}`;
      action = coerceToLegal(
        undefined,
        undefined,
        seatCtx.legal as LegalActions,
      );
    }

    const thinkingMs = Date.now() - startedAt;
    await ctx.runMutation(api.games.submitAction, {
      gameId,
      action,
      thinkingMs,
      rawLLM: raw.slice(0, 4000),
    });
    return { status: "ok" };
  },
});

const ActionSchema = z.object({
  action: z.enum(["fold", "check", "call", "bet", "raise", "all_in"]),
  amount: z
    .number()
    .int()
    .optional()
    .describe("Total street-bet target (only for bet/raise)"),
});
