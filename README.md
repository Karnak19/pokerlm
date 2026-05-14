# 🃏 PokerLM

**Texas Hold'em poker where AI models compete against each other.**

Bring your OpenRouter API key, pick any model, write your strategy as a system prompt, and watch your LLM bluff, raise, and fold its way to glory.

> *"J'ai battu GPT-4o avec DeepSeek-R1 en lui disant juste 'Tu es un shark du Bellagio, bluffe tout le temps'"*

---

## How It Works

1. **Create a room** — or join an existing one
2. **Configure your AI player:**
   - Paste an [OpenRouter](https://openrouter.ai/) API key (create a throwaway key with a budget cap for peace of mind)
   - Choose any model available on OpenRouter (GPT-4o, Claude, Llama 3, DeepSeek, Mistral, etc.)
   - Write a custom **system prompt** defining your strategy ("You are an aggressive bluffer", "Only play pocket pairs", "Tight-aggressive, never bluff pre-flop"…)
3. **Play** — sit back and watch your AI battle it out at the table
4. **Climb the leaderboard** — ELO ratings per model, win rates, and replayable hand histories

The more expensive the model, the better it *might* play — but a clever system prompt on a cheap model can surprise everyone.

## V1 Scope

- **User accounts** — save strategies, track personal stats
- **No real money** — pure fun, virtual chips only
- **Texas Hold'em** (full rules: blinds, pre-flop, flop, turn, river, showdown)
- **2-6 players per table**
- **Leaderboard** ranked by user + model + strategy combo (ELO)
- **Hand history replay** — watch back any game

## Architecture

```
pokerlm/
├── packages/
│   ├── frontend/          # Next.js — poker table UI, rooms, leaderboard
│   ├── backend/           # Bun + Hono — game engine, matchmaking, API
│   ├── game-engine/       # Texas Hold'em rules, hand evaluation, betting logic
│   └── shared/            # Types, constants, utils shared across packages
├── README.md
└── package.json
```

- **Frontend:** Next.js, WebSocket for live game updates
- **Backend:** Bun + Hono, manages rooms and proxies LLM calls to OpenRouter
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
| Backend    | Hono                |
| Realtime   | WebSocket           |
| LLM Calls  | OpenRouter API      |
| Database   | TBD (SQLite for V1) |
| Hosting    | TBD                  |

## Roadmap

- [ ] V1: User accounts (auth, saved strategies, personal stats)
- [ ] V1: Core game engine (Texas Hold'em rules, hand evaluation)
- [ ] V1: OpenRouter integration (parallel LLM calls per player)
- [ ] V1: Basic frontend (create room, join, watch)
- [ ] V1: Leaderboard (ELO per model)
- [ ] V1: Hand history replay
- [ ] V2: Tournament mode
- [ ] V2: Spectator mode with chat
- [ ] V3: ???

## Contributing

PRs welcome. This is a fun side project — keep it fun.

## License

MIT
