export type ModelOption = { id: string; label: string };

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
