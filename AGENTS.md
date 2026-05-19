<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

---

## House rules (read before editing)

These are decisions already made in earlier sessions. Don't relitigate them silently.

### Styling: Tailwind + shadcn only

- Compose with Tailwind utility classes and shadcn primitives in `src/components/ui/*`.
- **No bespoke global CSS** for things Tailwind / shadcn can express. Don't add new `.foo` classes to `globals.css`.
- Brand-art helpers live in `globals.css` under `@layer components`, prefixed `pl-*`. They exist because Tailwind can't compose them cleanly:
  - `pl-av` — felt-filled avatar disc with primary rim
  - `pl-felt` — table surface (multi-radial gradient)
  - `pl-chip` — chip disc with rim shadows
  - `pl-card` (+ `data-suit="red|black"`) — paper card face
  - `pl-card-back` — felt-tinted card back
- Player avatars use DiceBear `bottts` via `<PlayerAvatar seed={playerId} … />`. Seed with the player's `_id`, never their name (same-name collisions).

### Cache Components (Next.js 16)

`cacheComponents: true` in `next.config.ts` is enabled. Pages are dynamic by default; explicit caching opts in via `"use cache"` + `cacheLife(…)`.

- `/` (homepage) — async server component. `getHomeData()` is `"use cache" + cacheLife("minutes")`, wraps `fetchQuery(api.leaderboard.top)` + `aggregate`.
- `/leaderboard` — split into `page.tsx` (RSC, cached) + `leaderboard-view.tsx` (client island). The view only subscribes to `users.me` for the per-viewer "Your peak rank" cell.
- `/how-it-works` — `"use cache" + cacheLife("hours")`, fully static.
- `/rooms`, `/rooms/[id]`, `/rooms/new`, `/roster` — client components; they need real-time reactivity.

The reason is cost: anonymous browsers should not be opening Convex subscriptions for leaderboard data. Use `fetchQuery` from `convex/nextjs`, not `useQuery`, when the data doesn't need to be live.

### Cut features (don't reintroduce)

- **`/replays`** — the hand-history replay route was cut from scope. Don't add a replays page, a `handHistories` table, or a `replayBlob` field. If finished-hand persistence becomes useful for something else (audit, ELO history), use a domain-specific table.
- **Rebuys / refills** — when a player's bankroll hits 0, they're retired permanently. No rebuy at the table, no daily faucet, no "reset bankroll" button. The user creates a new player.

### OpenRouter only — never add another LLM backend

We support OpenRouter exclusively because it's the only provider with first-class throwaway keys with hard spend caps. Direct Anthropic/OpenAI/Google keys would put one bad day between us and a multi-thousand-dollar bill. This is policy, not preference. Documented user-facing in `/how-it-works`.

The action at `convex/openrouter.ts > decide` sets these headers for App Attribution:
- `HTTP-Referer` — from `process.env.SITE_URL` (set via `npx convex env set SITE_URL …`)
- `X-Title: PokerLM`
- `X-OpenRouter-Categories: game`

### Bankroll system

- Players start with $5000 bankroll. Sitting at a room deducts `room.startingStack` (the buy-in). Leaving (or being evicted via `leaveAfterHand` at the end of a hand) returns the remaining seat stack to bankroll.
- When bankroll hits 0 **and** the player has no other seats anywhere, `status = "retired"` permanently.
- The cash-out logic is the exported `cashOutSeat(ctx, seat)` in `convex/rooms.ts`. Both `rooms.leave` and the `dealHand` eviction sweep in `convex/games.ts` call it. **Don't delete a seat without first calling `cashOutSeat`** — otherwise chips disappear into the void.

### ELO

- Update happens on **every completed hand**, not just showdowns. Pairwise comparison uses `finalState.winners` (won the pot vs didn't), not hand evaluation — so a pre-showdown fold counts as a loss against whoever took the pot.
- `eloHistory` is appended by the **2h `snapshotEloHistory` cron**, not per-hand. One row per alive player per snapshot. Retired players are skipped (their rating can't change). The chart can lag up to 2h — accepted tradeoff against table bloat from per-hand writes.
- K = 24, default rating 1500. No decay.

### Auto-deal

- After a hand completes (`submitAction` or the stuck-turn cron), the next hand is scheduled 3s later via `ctx.scheduler.runAfter(3000, internal.games.autoDealNext, …)`. The 3s pause is so players can see the showdown. Don't remove it.
- `dealHand()` in `convex/games.ts` is the shared dealing logic. `startNextHand` is kept as a no-auth manual fallback only.

### Misc invariants

- **One seat per user per room.** Enforced in `rooms.sit`.
- Seat positions on the felt are **fixed by seat index** — same view across devices. The "viewer-at-bottom" rotation was removed.
- The OpenRouter key chip in the navbar (`<NavKey>` in `src/components/site-shell.tsx`) is the canonical place to set/read the key. It writes to `sessionStorage["pokerlm.openrouter.key"]`. Don't add a second input.

## Where things are

```
convex/
  schema.ts                 — full data model
  users.ts                  — auth bootstrap, `me` query
  players.ts                — CRUD; bankroll lives here
  rooms.ts                  — list/create/sit/leave + cashOutSeat helper
  games.ts                  — submitAction, dealHand, autoDealNext, current query
  openrouter.ts             — `decide` action (LLM call → submitAction)
  leaderboard.ts            — top, aggregate, mine, history, historyMany, movers
  maintenance.ts            — stuck-turn + idle-room crons
  crons.ts                  — schedule
src/
  app/                      — Next.js routes (see Cache Components section above)
  components/
    site-shell.tsx          — TopNav (with NavKey + NavUser) + SiteFooter + SiteShell
    player-avatar.tsx       — DiceBear bottts wrapper
    rating-sparkline.tsx    — small Recharts line
    rating-chart.tsx        — bigger Recharts area chart
    model-combobox.tsx      — shadcn Command-based model picker w/ price display
    providers.tsx           — Clerk + Convex + EnsureUser bootstrap
    ui/                     — shadcn primitives (no custom CSS)
  engine/                   — pure-TS Hold'em engine (state, handEval, cards, llmParse)
  lib/
    models.ts               — curated OpenRouter model list + price helpers
```
