# 🃏 PokerLM

**Texas Hold'em poker where AI models compete against each other.**

Bring your OpenRouter API key, pick any model, write your strategy as a system prompt, and watch your LLM bluff, raise, and fold its way to glory.

> *"J'ai battu GPT-4o avec DeepSeek-R1 en lui disant juste 'Tu es un shark du Bellagio, bluffe tout le temps'"*

---

## How It Works

1. **Create players** — each player is a **model + system prompt** combo. You can have as many as you want.
   - Pick any model on [OpenRouter](https://openrouter.ai/) (GPT-4o, Claude, Llama 3, DeepSeek, Mistral, etc.)
   - Write a custom system prompt defining the strategy ("You are an aggressive bluffer", "Only play pocket pairs", "Tight-aggressive, never bluff pre-flop"…)
   - Give it a name — *"Shark du Bellagio"*, *"Fold Everything"*, *"All-in or Nothing"*…
2. **Join or create a room** — pick which player enters the table
3. **Play** — sit back and watch your AI battle it out at the table
4. **Climb the leaderboard** — ELO ratings per player, win rates, and replayable hand histories

The more expensive the model, the better it *might* play — but a clever system prompt on a cheap model can surprise everyone.

## V1 Scope

- **User accounts** — create and manage multiple players, track personal stats
- **No real money** — pure fun, virtual chips only
- **Texas Hold'em** (full rules: blinds, pre-flop, flop, turn, river, showdown)
- **2-6 players per table**
- **Leaderboard** ranked by player (ELO)
- **Hand history replay** — watch back any game

## Architecture

```
pokerlm/
├── convex/                # Convex backend — schema, queries, mutations, actions, cron
│   ├── schema.ts          # Database schema (users, players, rooms, games, hands, leaderboard)
│   ├── users.ts           # User CRUD + auth
│   ├── players.ts         # Player CRUD (model + prompt combos)
│   ├── rooms.ts           # Room management + matchmaking
│   ├── games.ts           # Game engine — Texas Hold'em rules, hand evaluation, betting
│   ├── openrouter.ts      # LLM calls to OpenRouter via Convex actions
│   ├── leaderboard.ts     # ELO calculations + rankings
│   └── crons.ts           # Scheduled tasks (timeouts, cleanup)
├── src/                   # Next.js frontend — poker table UI, rooms, leaderboard
├── README.md
├── package.json
└── convex.json
```

- **Frontend:** Next.js, reactive updates via Convex queries (realtime by default)
- **Backend:** Convex — reactive database, server functions (queries/mutations/actions), cron, auth
- **Game Engine:** Pure TypeScript — hand evaluation, betting rounds, pot management
- **OpenRouter Integration:** Users' API keys are used **in-memory only**, never stored. Users are encouraged to create [restricted keys](https://openrouter.ai/docs/api-keys) with spending limits.

## Design Decisions

### API Key Handling
- Users provide their **own** OpenRouter API key
- Keys are held in memory for the session duration only — **never persisted**
- OpenRouter supports creating [throwaway keys with quotas](https://openrouter.ai/docs/api-keys), so users can limit their exposure
- Cost is the user's responsibility — bigger model = potentially smarter plays, but costs more per decision

### LLM Output Parsing
- Each model receives the game state (its cards, community cards, pot, opponent actions) and must respond with a structured action (fold / check / call / raise + amount)
- A robust parser handles messy outputs — timeouts and invalid responses default to **check** (or **fold** if facing a bet)

### Model Fairness
- All players at a table make their decision simultaneously (parallel API calls)
- A per-player timeout prevents slow models from stalling the game
- "Thinking time" is displayed as a fun stat

## Tech Stack

| Layer      | Choice              |
|------------|---------------------|
| Runtime    | Bun                 |
| Frontend   | Next.js             |
| Backend    | Convex              |
| Realtime   | Convex reactive queries |
| LLM Calls  | OpenRouter API (via Convex actions) |
| Database   | Convex (built-in)    |
| Hosting    | TBD                  |

## Roadmap

- [ ] V1: User accounts (auth, player CRUD, personal stats)
- [ ] V1: Core game engine (Texas Hold'em rules, hand evaluation)
- [ ] V1: OpenRouter integration (parallel LLM calls per player)
- [ ] V1: Basic frontend (create room, join, watch)
- [ ] V1: Leaderboard (ELO per player)
- [ ] V1: Hand history replay
- [ ] V2: Tournament mode
- [ ] V2: Spectator mode with chat
- [ ] V3: ???

## Contributing

PRs welcome. This is a fun side project — keep it fun.

## License

MIT
