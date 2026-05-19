import { Action, LegalActions } from "./state";

// Try to coerce any LLM output (JSON, JSON-in-text, freeform) into a legal action.
// Falls back to check or fold.
export function parseLLMAction(raw: string, legal: LegalActions): Action {
  const stripped = raw.trim();
  // 1) Try direct JSON
  let parsed: unknown = null;
  try { parsed = JSON.parse(stripped); } catch { /* fall through */ }
  // 2) Try to find a JSON object in the text
  if (parsed === null) {
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }

  let kind: string | undefined;
  let amount: number | undefined;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.action === "string") kind = obj.action.toLowerCase();
    else if (typeof obj.kind === "string") kind = obj.kind.toLowerCase();
    else if (typeof obj.move === "string") kind = obj.move.toLowerCase();
    if (typeof obj.amount === "number") amount = obj.amount;
    else if (typeof obj.raise === "number") amount = obj.raise;
    else if (typeof obj.bet === "number") amount = obj.bet;
  }

  // 3) Freeform fallback: look for keywords
  if (!kind) {
    const lower = stripped.toLowerCase();
    if (/\bfold\b/.test(lower)) kind = "fold";
    else if (/\ball[\s-]?in\b/.test(lower)) kind = "all_in";
    else if (/\braise\b/.test(lower)) kind = "raise";
    else if (/\bbet\b/.test(lower)) kind = "bet";
    else if (/\bcall\b/.test(lower)) kind = "call";
    else if (/\bcheck\b/.test(lower)) kind = "check";
    if (!amount) {
      const numMatch = lower.match(/\b(\d+)\b/);
      if (numMatch) amount = parseInt(numMatch[1], 10);
    }
  }

  // Coerce into legal action
  const action = coerce(kind, amount, legal);
  return action;
}

export function coerceToLegal(kind: string | undefined, amount: number | undefined, legal: LegalActions): Action {
  return coerce(kind, amount, legal);
}

function coerce(kind: string | undefined, amount: number | undefined, legal: LegalActions): Action {
  const safeDefault: Action = legal.canCheck ? { kind: "check" } : { kind: "fold" };

  switch (kind) {
    case "fold":
      return legal.canFold ? { kind: "fold" } : safeDefault;
    case "check":
      return legal.canCheck ? { kind: "check" } : safeDefault;
    case "call":
      return legal.canCall ? { kind: "call" } : safeDefault;
    case "all_in":
    case "allin":
    case "shove":
      return { kind: "all_in" };
    case "bet": {
      if (!legal.canBet) return legal.canCall ? { kind: "call" } : safeDefault;
      const amt = Math.max(legal.minRaiseTo, Math.min(amount ?? legal.minRaiseTo, legal.maxRaiseTo));
      return { kind: "bet", amount: amt };
    }
    case "raise": {
      if (!legal.canRaise) return legal.canCall ? { kind: "call" } : safeDefault;
      const target = Math.max(legal.minRaiseTo, Math.min(amount ?? legal.minRaiseTo, legal.maxRaiseTo));
      return { kind: "raise", amount: target };
    }
    default:
      return safeDefault;
  }
}
