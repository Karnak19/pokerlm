import { action, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { GameState, LegalActions } from "../src/engine/state";
import { legalActions } from "../src/engine/state";
import { parseLLMAction } from "../src/engine/llmParse";
import type { Id } from "./_generated/dataModel";

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
      player: { name: player.name, model: player.model, systemPrompt: player.systemPrompt },
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
  seats: { seatIndex: number; stack: number; streetBet: number; status: string }[];
  player: { name: string; model: string; systemPrompt: string };
  history: { seatIndex: number; kind: string; amount: number; street: string }[];
};

function buildPrompt(ctx: SeatCtx): { system: string; user: string } {
  const { player, hole, community, pot, street, currentBet, bigBlind, seats, seatIndex, legal, history } = ctx;
  const system = `You are a Texas Hold'em poker player.
Strategy directive from the user: ${player.systemPrompt}

You must reply with strictly valid JSON, no prose:
{"action": "fold" | "check" | "call" | "bet" | "raise" | "all_in", "amount": <integer chips, only when bet/raise>}

Rules:
- "amount" for bet/raise is the TOTAL chips you want your street-bet to be at after the action (not the increment).
- If the action you choose isn't legal, your response will be coerced to a safe default (check or fold).
- Be decisive. Output only the JSON.`;

  const me = seats[seatIndex];
  const opponents = seats
    .filter((s) => s.seatIndex !== seatIndex && s.status !== "sitting_out")
    .map((s) => `seat ${s.seatIndex + 1}: stack ${s.stack}, bet ${s.streetBet}, ${s.status}`)
    .join("\n");

  const legalLines = [
    legal.canFold && "fold",
    legal.canCheck && "check",
    legal.canCall && `call (${legal.callAmount} chips)`,
    legal.canBet && `bet (min ${legal.minRaiseTo}, max ${legal.maxRaiseTo})`,
    legal.canRaise && `raise to (min ${legal.minRaiseTo}, max ${legal.maxRaiseTo})`,
  ].filter(Boolean).join(", ");

  const user = `Street: ${street} | Big blind: ${bigBlind} | Pot: ${pot}
Board: ${community.join(" ") || "(none)"}
Your hole cards: ${(hole ?? []).join(" ")}
Your stack: ${me.stack} | Your street-bet so far: ${me.streetBet}
Current bet to match: ${currentBet}
Opponents:
${opponents}

Recent action history (this hand):
${history.map((a) => `  seat ${a.seatIndex + 1} ${a.kind}${a.amount ? ` ${a.amount}` : ""} (${a.street})`).join("\n") || "  (none)"}

Legal actions: ${legalLines}

Respond with JSON only.`;

  return { system, user };
}

export const decide = action({
  args: {
    gameId: v.id("games"),
    apiKey: v.string(),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, { gameId, apiKey, timeoutMs }): Promise<{ status: "ok" | "skipped" | "error"; reason?: string }> => {
    const seatCtx = await ctx.runQuery(internal.openrouter.seatContext, { gameId });
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
    let action: ReturnType<typeof parseLLMAction>;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 15000);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://pokerlm.local",
          "X-Title": "PokerLM",
        },
        body: JSON.stringify({
          model: seatCtx.player.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 200,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const errText = await res.text();
        raw = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        action = parseLLMAction("", seatCtx.legal as LegalActions);
      } else {
        const data: { choices?: { message?: { content?: string } }[] } = await res.json();
        raw = data.choices?.[0]?.message?.content ?? "";
        action = parseLLMAction(raw, seatCtx.legal as LegalActions);
      }
    } catch (e) {
      raw = `error: ${e instanceof Error ? e.message : String(e)}`;
      action = parseLLMAction("", seatCtx.legal as LegalActions);
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
