# 🃏 PokerLM

**Texas Hold'em where AI models compete against each other.**

Bring your OpenRouter API key, pick any model, write your strategy as a system prompt, and watch your LLM bluff, raise, and fold its way through a real bankroll.

> *"J'ai battu GPT-5 avec DeepSeek V4 en lui disant juste 'Tu es un shark du Bellagio, bluffe tout le temps'"*

---

## How it works

1. **Create players** — each player is a `model + system prompt` combo. Pick any model on [OpenRouter](https://openrouter.ai/) (Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-5, Gemini 3 Flash, DeepSeek V4, Llama 4 …), write the strategy, give it a name.
2. **Sit at a table** — the buy-in is deducted from the player's bankroll.
3. **Watch the bots play** — auto-deal, animated card deals, chip-fly to pot, live thinking timer per seat.
4. **Climb the ELO leaderboard, grow the bankroll** — or bust out. Permanently.

The expensive models *might* play better. A clever prompt on a cheap model usually beats a sloppy prompt on a flagship one.

## The bankroll game

Each player starts with **$5,000**. Sit at a table, you bring the buy-in; leave with whatever you have left. When a player's bankroll hits **$0** — **they're retired permanently**. No rebuy. No daily faucet. The user has to roll a new player. ELO is independent of bankroll: a retired player keeps their rating on the leaderboard as a tombstone.

## Why OpenRouter only?

We support OpenRouter exclusively because it's the only LLM gateway with first-class **throwaway keys with hard spend caps**. With direct Anthropic / OpenAI / Google keys, one leaked key could drain your account. With a capped OpenRouter key, the worst case is whatever you set the cap to.

Mint a $5 key on OpenRouter, paste it in the nav chip, sit at a cheap table. The key never leaves your browser — it lives in `sessionStorage`, never our database. See `/how-it-works` for the full details.

## Routes

| Route | Notes |
|---|---|
| `/` | Hero + live aggregate stats + mini leaderboard. Server-rendered, cached "minutes". |
| `/how-it-works` | Key handling, OpenRouter-only rationale, pricing, data flow. Cached "hours". |
| `/leaderboard` | Podium, ranking table (with bankroll column + retired tombstones), big movers, model meta. RSC + client island. |
| `/roster` | Your players. Bankroll prominently displayed. Editor with real ELO history chart. |
| `/rooms` | Joinable tables. Sit button is gated by bankroll. |
| `/rooms/new` | Three fields: name, seats, stakes. |
| `/rooms/[id]` | The felt — animated card deals, chip-to-pot, live thinking timer, leave-mid-hand / leave-after-hand dialog. |

## Architecture

```
pokerlm/
├── convex/                # Convex backend
│   ├── schema.ts          # users, players, rooms, seats, games, actions, elo, eloHistory
│   ├── users.ts
│   ├── players.ts         # bankroll lives here
│   ├── rooms.ts           # sit, leave (mid-hand or queued), cashOutSeat helper
│   ├── games.ts           # submitAction, dealHand, autoDealNext (scheduler)
│   ├── openrouter.ts      # `decide` action — LLM call → submitAction
│   ├── leaderboard.ts     # top, aggregate, mine, history, historyMany, movers
│   ├── maintenance.ts     # stuck-turn + idle-room crons
│   └── crons.ts
├── src/
│   ├── app/               # Next.js routes (cacheComponents enabled)
│   ├── components/
│   │   ├── site-shell.tsx           # nav + footer (OpenRouter key chip lives here)
│   │   ├── player-avatar.tsx        # DiceBear bottts, seeded by player _id
│   │   ├── rating-sparkline.tsx     # tiny Recharts line
│   │   ├── rating-chart.tsx         # bigger Recharts area chart
│   │   ├── model-combobox.tsx       # shadcn Command picker w/ live OpenRouter pricing
│   │   └── ui/                      # shadcn primitives
│   ├── engine/                      # pure-TS Hold'em engine
│   └── lib/models.ts                # curated model list + price helpers
└── AGENTS.md              # rules of the road for AI sessions; read this first
```

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Frontend | Next.js 16 (Cache Components on, `"use cache"` directive) |
| Backend | Convex (reactive db + scheduler) |
| Auth | Clerk |
| LLM gateway | OpenRouter (exclusive — see "Why OpenRouter only?") |
| UI | Tailwind v4 + shadcn |
| Charts | shadcn `chart` (Recharts) |
| Animation | framer-motion |
| Avatars | DiceBear `bottts` |

## Key invariants

- **One seat per user per room** — anti-multi-account at the same table.
- **Bankroll cash-out on every seat removal** — see `cashOutSeat` in `convex/rooms.ts`. Never delete a seat without it.
- **ELO fires on every completed hand**, not just showdowns. Winner-based pairwise comparison.
- **Permanent bust** — bankroll → 0 with no other seats → retired. No mechanism to un-retire.
- **OpenRouter key never persisted** — `sessionStorage` only, scoped to the browser tab.
- **Auto-deal** — every hand finalization schedules the next hand +3s via the Convex scheduler.

## Local setup

```bash
bun install
npx convex dev          # one terminal — local Convex deployment
bun dev                 # another terminal — Next.js
```

Set in `.env.local`:
- `NEXT_PUBLIC_CONVEX_URL` — auto-populated by `npx convex dev`
- Clerk publishable + secret keys

Set in Convex env (`npx convex env set …`):
- `SITE_URL` — for OpenRouter App Attribution. Defaults to the GitHub repo URL.
- Clerk JWT issuer domain (if using auth)

## Contributing

PRs welcome. Read `AGENTS.md` first — it documents decisions earlier sessions made (style stance, OpenRouter-only, no replays, no rebuys, etc.) so you don't accidentally undo them.

## License

MIT
