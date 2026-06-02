import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    createdAt: v.number(),
    // Set when the user dismisses the onboarding checklist chip. The chip
    // also auto-hides once all steps are complete.
    onboardingDismissedAt: v.optional(v.number()),
  }).index("by_token", ["tokenIdentifier"]),

  players: defineTable({
    userId: v.id("users"),
    name: v.string(),
    model: v.string(),
    systemPrompt: v.string(),
    createdAt: v.number(),
    // Persistent bankroll across sessions. The player buys in to a room
    // from this pile and cashes out back into it on leave. When it hits 0
    // and no other seats are held, the player is retired permanently.
    bankroll: v.optional(v.number()),
    status: v.optional(v.union(v.literal("alive"), v.literal("retired"))),
    retiredAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  rooms: defineTable({
    name: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished"),
    ),
    maxSeats: v.number(),
    smallBlind: v.number(),
    bigBlind: v.number(),
    startingStack: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastActivityAt: v.number(),
  }).index("by_status", ["status"]),

  seats: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    userId: v.id("users"),
    seatIndex: v.number(),
    stack: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("folded"),
      v.literal("all_in"),
      v.literal("sitting_out"),
    ),
    // Set when the player asks to leave after the current hand finishes;
    // the seat is removed before the next deal.
    leaveAfterHand: v.optional(v.boolean()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_user", ["roomId", "userId"])
    .index("by_room_seat", ["roomId", "seatIndex"])
    .index("by_user", ["userId"]),

  games: defineTable({
    roomId: v.id("rooms"),
    handNumber: v.number(),
    dealerSeatIndex: v.number(),
    status: v.union(v.literal("in_progress"), v.literal("complete")),
    // Map from engine seatIndex → Convex seats._id (since engine is seat-index based)
    seatIdByIndex: v.array(v.union(v.id("seats"), v.null())),
    state: v.string(),                                // JSON-encoded GameState
    currentSeatToActIndex: v.optional(v.number()),    // mirror of state.toAct for queries
    currentSeatToActSince: v.optional(v.number()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_hand", ["roomId", "handNumber"])
    .index("by_status", ["status"]),

  actions: defineTable({
    gameId: v.id("games"),
    seatId: v.id("seats"),
    seatIndex: v.number(),
    street: v.string(),
    kind: v.union(
      v.literal("fold"),
      v.literal("check"),
      v.literal("call"),
      v.literal("bet"),
      v.literal("raise"),
      v.literal("all_in"),
    ),
    amount: v.number(),
    thinkingMs: v.optional(v.number()),
    rawLLM: v.optional(v.string()),
    // Short 1-sentence justification the LLM emits alongside its action.
    // Shown in the Thinking log. Absent on stuck-turn fallbacks / errors.
    reasoning: v.optional(v.string()),
    at: v.number(),
  }).index("by_game", ["gameId"]),

  elo: defineTable({
    playerId: v.id("players"),
    rating: v.number(),
    gamesPlayed: v.number(),
    wins: v.number(),
    updatedAt: v.number(),
  }).index("by_player", ["playerId"]),

  // Per-seat freeform memory the LLM writes via the `reflect` action at the
  // end of each hand. Scope = this seating at this room; deleted in
  // cashOutSeat when the seat is removed.
  memories: defineTable({
    seatId: v.id("seats"),
    playerId: v.id("players"),
    text: v.string(),
    updatedAt: v.number(),
  })
    .index("by_seat", ["seatId"])
    .index("by_player", ["playerId"]),

  // Periodic ELO snapshot — one row per alive player every 2h via the
  // `snapshotEloHistory` cron. Drives sparklines, the leaderboard "Big
  // movers" panel, and the /roster editor side panel. Indexed by player +
  // time for cheap range scans. `gameId` and `delta` are legacy fields kept
  // optional so pre-cron rows (one per hand) remain valid.
  eloHistory: defineTable({
    playerId: v.id("players"),
    gameId: v.optional(v.id("games")),
    rating: v.number(),
    delta: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_player_at", ["playerId", "at"]),
});
