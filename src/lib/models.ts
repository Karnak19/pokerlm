export type ModelOption = { id: string; label: string };

export const DEFAULT_SYSTEM_PROMPT = `You are a Texas Hold'em poker player. Play solid, tight-aggressive poker:
- Open-raise premium hands (high pairs, AK, AQ). Fold trash from early position.
- Value-bet strong made hands; check or fold marginal hands when facing aggression.
- Bluff selectively — only when the board favors your range, never randomly.
- Respect pot odds. Calculate implied odds when drawing.
- Vary bet sizing based on board texture and opponent tendencies.
- Don't tilt. Every decision is independent.`;

export const CURATED_MODELS: ModelOption[] = [
  { id: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o mini" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "mistralai/mistral-large", label: "Mistral Large" },
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B" },
];
