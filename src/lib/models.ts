export type ModelOption = {
  id: string;
  label: string;
  // Price in USD per million tokens. Filled when we have it from
  // OpenRouter's /api/v1/models endpoint; undefined for the curated
  // fallback list shown before the fetch resolves.
  priceIn?: number;
  priceOut?: number;
};

// "0.000005" (per token) → 5 ($/Mtok). Returns undefined for missing/zero.
export function priceToMtok(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n * 1_000_000;
}

export function formatMtok(usd: number | undefined): string {
  if (usd === undefined) return "—";
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 10) return `$${usd.toFixed(1)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(3)}`;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a Texas Hold'em poker player. Play solid, tight-aggressive poker:
- Open-raise premium hands (high pairs, AK, AQ). Fold trash from early position.
- Value-bet strong made hands; check or fold marginal hands when facing aggression.
- Bluff selectively — only when the board favors your range, never randomly.
- Respect pot odds. Calculate implied odds when drawing.
- Vary bet sizing based on board texture and opponent tendencies.
- Don't tilt. Every decision is independent.`;

// Default options shown when a user creates a new player. They can still
// pick any OpenRouter-hosted model from the combobox; this list is just
// the curated starter set.
export const CURATED_MODELS: ModelOption[] = [
  { id: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "openai/gpt-5", label: "OpenAI GPT-5" },
  { id: "openai/gpt-5-mini", label: "OpenAI GPT-5 mini" },
  { id: "meta-llama/llama-4-405b-instruct", label: "Llama 4 405B" },
  { id: "qwen/qwen-3-72b-instruct", label: "Qwen 3 72B" },
];
