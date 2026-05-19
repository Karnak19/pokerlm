import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const COACH_SYSTEM = `You are a poker strategy coach. The user is writing a system prompt for a Texas Hold'em LLM agent that will play autonomously. Help them craft it.

Be opinionated. Suggest concrete style directives — tight-aggressive, loose-passive, bluff frequency, position awareness, stack-size adaptation, etc.

When you propose a system prompt the user can copy directly into their agent, put it inside a fenced markdown code block (\`\`\`). The UI surfaces a "Use this prompt" button next to each code block.

Keep prompts focused on poker strategy — not boilerplate like "you are a poker player" (the app adds that itself).`;

export async function POST(req: Request) {
  // Key + model travel via headers only — never logged, never persisted.
  const apiKey = req.headers.get("x-openrouter-key");
  const model = req.headers.get("x-model");
  if (!apiKey || !model) {
    return new Response("missing x-openrouter-key or x-model header", { status: 400 });
  }

  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // Same App Attribution headers as convex/openrouter.ts > decide.
  const siteUrl = process.env.SITE_URL ?? "https://github.com/Karnak19/pokerlm";
  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": siteUrl,
      "X-Title": "PokerLM",
      "X-OpenRouter-Categories": "game",
    },
  });

  const result = streamText({
    model: openrouter.chat(model),
    system: COACH_SYSTEM,
    messages: await convertToModelMessages(messages),
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
