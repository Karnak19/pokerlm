import { Card, buildDeck, mulberry32, shuffle } from "./cards";
import { evaluateBest } from "./handEval";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type SeatStatus = "active" | "folded" | "all_in" | "sitting_out";

export interface SeatState {
  seatIndex: number;
  stack: number;
  status: SeatStatus;
  hole: [Card, Card] | null;
  streetBet: number;        // chips contributed on current street
  totalContributed: number; // chips contributed in this hand
  hasActed: boolean;        // has acted at least once on current street
}

export interface GameState {
  seats: SeatState[];
  dealerIndex: number;       // seatIndex of button
  smallBlind: number;
  bigBlind: number;
  street: Street;
  deck: Card[];              // remaining deck, top at end
  community: Card[];
  pot: number;
  toAct: number | null;      // seatIndex
  lastRaiseSize: number;     // minimum raise increment
  currentBet: number;        // highest streetBet to match
  // For betting-round-closed detection: index where action would re-open if no raise
  aggressorIndex: number | null;
  winners?: { seatIndex: number; amount: number }[];
}

export type Action =
  | { kind: "fold" }
  | { kind: "check" }
  | { kind: "call" }
  | { kind: "bet"; amount: number }
  | { kind: "raise"; amount: number }   // amount = total streetBet target
  | { kind: "all_in" };

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;        // chips needed to call (0 if check)
  canBet: boolean;           // true if currentBet === 0 (no facing bet)
  canRaise: boolean;
  minRaiseTo: number;        // minimum target streetBet for a raise
  maxRaiseTo: number;        // shove amount = stack + streetBet
}

// ------- helpers -------

function activeSeats(g: GameState): SeatState[] {
  return g.seats.filter((s) => s.status === "active" || s.status === "all_in");
}

function seatsInHand(g: GameState): SeatState[] {
  return g.seats.filter((s) => s.status !== "folded" && s.status !== "sitting_out");
}

function nextSeatIndex(g: GameState, from: number, predicate: (s: SeatState) => boolean): number | null {
  const n = g.seats.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    const seat = g.seats[idx];
    if (predicate(seat)) return idx;
  }
  return null;
}

// ------- legal actions -------

export function legalActions(g: GameState): LegalActions {
  if (g.toAct === null) {
    return {
      canFold: false, canCheck: false, canCall: false, callAmount: 0,
      canBet: false, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0,
    };
  }
  const seat = g.seats[g.toAct];
  const callAmount = Math.max(0, g.currentBet - seat.streetBet);
  const canCheck = callAmount === 0;
  const canCall = callAmount > 0 && seat.stack > 0;
  const canBet = g.currentBet === 0 && seat.stack > 0;
  const minRaiseTo = g.currentBet + g.lastRaiseSize;
  const maxRaiseTo = seat.streetBet + seat.stack;
  const canRaise = g.currentBet > 0 && seat.stack > callAmount; // strictly more than just calling
  return {
    canFold: true,
    canCheck,
    canCall,
    callAmount,
    canBet,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
  };
}

// ------- deal & start hand -------

export function startHand(opts: {
  seatCount: number;
  stacks: number[];          // length === seatCount; 0 means sitting out
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  seed: number;
}): GameState {
  const { seatCount, stacks, dealerIndex, smallBlind, bigBlind, seed } = opts;
  const rng = mulberry32(seed);
  const deck = shuffle(buildDeck(), rng);

  const seats: SeatState[] = stacks.map((stack, i) => ({
    seatIndex: i,
    stack,
    status: stack > 0 ? "active" : "sitting_out",
    hole: null,
    streetBet: 0,
    totalContributed: 0,
    hasActed: false,
  }));

  const g: GameState = {
    seats,
    dealerIndex,
    smallBlind,
    bigBlind,
    street: "preflop",
    deck,
    community: [],
    pot: 0,
    toAct: null,
    lastRaiseSize: bigBlind,
    currentBet: 0,
    aggressorIndex: null,
  };

  // Deal 2 hole cards to each active seat, button-first clockwise, two passes.
  const order: number[] = [];
  let idx = dealerIndex;
  for (let i = 0; i < seatCount; i++) {
    idx = (idx + 1) % seatCount;
    if (g.seats[idx].status === "active") order.push(idx);
  }
  const firsts = new Map<number, Card>();
  for (const i of order) firsts.set(i, g.deck.pop()!);
  for (const i of order) g.seats[i].hole = [firsts.get(i)!, g.deck.pop()!];

  // Post blinds
  const sbIdx = nextSeatIndex(g, dealerIndex, (s) => s.status === "active");
  if (sbIdx === null) throw new Error("Not enough seats to start");
  // Heads-up: dealer posts SB
  const inHandCount = order.length;
  const actualSbIdx = inHandCount === 2 ? dealerIndex : sbIdx!;
  const bbIdx = nextSeatIndex(g, actualSbIdx, (s) => s.status === "active");
  if (bbIdx === null) throw new Error("Not enough seats for BB");

  postBlind(g, actualSbIdx, smallBlind);
  postBlind(g, bbIdx, bigBlind);
  g.currentBet = bigBlind;
  g.lastRaiseSize = bigBlind;
  g.aggressorIndex = bbIdx;

  // First to act preflop = next active after BB
  g.toAct = nextSeatIndex(g, bbIdx, (s) => s.status === "active");

  return g;
}

function postBlind(g: GameState, seatIndex: number, blind: number) {
  const seat = g.seats[seatIndex];
  const amount = Math.min(blind, seat.stack);
  seat.stack -= amount;
  seat.streetBet += amount;
  seat.totalContributed += amount;
  g.pot += amount;
  if (seat.stack === 0) seat.status = "all_in";
}

// ------- apply action -------

export function applyAction(g: GameState, action: Action): GameState {
  if (g.toAct === null) throw new Error("No seat to act");
  const next: GameState = structuredCloneDeep(g);
  const seat = next.seats[next.toAct!];

  switch (action.kind) {
    case "fold":
      seat.status = "folded";
      break;
    case "check": {
      if (seat.streetBet !== next.currentBet) throw new Error("Cannot check facing a bet");
      break;
    }
    case "call": {
      const need = next.currentBet - seat.streetBet;
      const paid = Math.min(need, seat.stack);
      seat.stack -= paid;
      seat.streetBet += paid;
      seat.totalContributed += paid;
      next.pot += paid;
      if (seat.stack === 0) seat.status = "all_in";
      break;
    }
    case "bet": {
      if (next.currentBet !== 0) throw new Error("Cannot bet facing a bet");
      if (action.amount < next.bigBlind) throw new Error("Bet below big blind");
      if (action.amount > seat.stack) throw new Error("Bet exceeds stack");
      seat.stack -= action.amount;
      seat.streetBet += action.amount;
      seat.totalContributed += action.amount;
      next.pot += action.amount;
      next.currentBet = seat.streetBet;
      next.lastRaiseSize = action.amount;
      next.aggressorIndex = seat.seatIndex;
      // Reopen action for everyone else on this street
      for (const s of next.seats) if (s.seatIndex !== seat.seatIndex && s.status === "active") s.hasActed = false;
      if (seat.stack === 0) seat.status = "all_in";
      break;
    }
    case "raise": {
      if (next.currentBet === 0) throw new Error("Use bet, not raise, with no facing bet");
      const target = action.amount; // total streetBet target
      if (target > seat.streetBet + seat.stack) throw new Error("Raise exceeds stack");
      const raiseIncrement = target - next.currentBet;
      const isAllIn = target === seat.streetBet + seat.stack;
      if (!isAllIn && raiseIncrement < next.lastRaiseSize) throw new Error("Raise below minimum");
      const paid = target - seat.streetBet;
      seat.stack -= paid;
      seat.streetBet = target;
      seat.totalContributed += paid;
      next.pot += paid;
      if (raiseIncrement >= next.lastRaiseSize) {
        next.lastRaiseSize = raiseIncrement;
        // Reopen action for everyone else
        for (const s of next.seats) if (s.seatIndex !== seat.seatIndex && s.status === "active") s.hasActed = false;
        next.aggressorIndex = seat.seatIndex;
      }
      next.currentBet = target;
      if (seat.stack === 0) seat.status = "all_in";
      break;
    }
    case "all_in": {
      const shoveTo = seat.streetBet + seat.stack;
      if (next.currentBet === 0) {
        // Equivalent to bet shoveTo
        return applyAction(g, { kind: "bet", amount: seat.stack });
      } else if (shoveTo <= next.currentBet) {
        // All-in for less = call
        return applyAction(g, { kind: "call" });
      } else {
        return applyAction(g, { kind: "raise", amount: shoveTo });
      }
    }
  }

  seat.hasActed = true;
  advance(next);
  return next;
}

function advance(g: GameState) {
  // Check if hand is over (everyone else folded)
  const inHand = g.seats.filter((s) => s.status === "active" || s.status === "all_in");
  if (inHand.length === 1) {
    awardPot(g);
    g.street = "showdown";
    g.toAct = null;
    return;
  }

  // Check if betting round complete
  const needToAct = g.seats.filter((s) => s.status === "active" && (!s.hasActed || s.streetBet !== g.currentBet));
  if (needToAct.length === 0) {
    nextStreet(g);
    return;
  }

  // Move action to next active seat with stack
  const nextIdx = nextSeatIndex(g, g.toAct!, (s) => s.status === "active");
  g.toAct = nextIdx;
  // If the next seat already met currentBet and hasActed (could happen mid-loop), advance street
  if (nextIdx !== null) {
    const s = g.seats[nextIdx];
    if (s.hasActed && s.streetBet === g.currentBet) {
      nextStreet(g);
    }
  } else {
    nextStreet(g);
  }
}

function nextStreet(g: GameState) {
  // Reset street state
  for (const s of g.seats) {
    s.streetBet = 0;
    s.hasActed = false;
  }
  g.currentBet = 0;
  g.lastRaiseSize = g.bigBlind;
  g.aggressorIndex = null;

  if (g.street === "preflop") { g.street = "flop"; dealCommunity(g, 3); }
  else if (g.street === "flop") { g.street = "turn"; dealCommunity(g, 1); }
  else if (g.street === "turn") { g.street = "river"; dealCommunity(g, 1); }
  else if (g.street === "river") { g.street = "showdown"; runShowdown(g); g.toAct = null; return; }

  // If only one active seat (rest all-in), run remaining streets without betting
  const activeWithStack = g.seats.filter((s) => s.status === "active");
  if (activeWithStack.length <= 1) {
    // Skip betting on this street, deal next street
    if (g.street !== "showdown") nextStreet(g);
    return;
  }

  // First to act post-flop = first active seat clockwise from dealer
  g.toAct = nextSeatIndex(g, g.dealerIndex, (s) => s.status === "active");
}

function dealCommunity(g: GameState, count: number) {
  // Burn 1, deal `count` (standard Hold'em)
  g.deck.pop();
  for (let i = 0; i < count; i++) g.community.push(g.deck.pop()!);
}

function runShowdown(g: GameState) {
  awardPot(g);
}

function awardPot(g: GameState) {
  const inHand = g.seats.filter((s) => s.status === "active" || s.status === "all_in");
  if (inHand.length === 1) {
    inHand[0].stack += g.pot;
    g.winners = [{ seatIndex: inHand[0].seatIndex, amount: g.pot }];
    g.pot = 0;
    return;
  }
  // Side pots: sort contributors ascending
  const contributors = [...g.seats].filter((s) => s.totalContributed > 0);
  contributors.sort((a, b) => a.totalContributed - b.totalContributed);

  const winners: { seatIndex: number; amount: number }[] = [];
  let prevLevel = 0;
  for (const ctx of contributors) {
    const level = ctx.totalContributed;
    if (level === prevLevel) continue;
    const eligible = g.seats.filter((s) => s.totalContributed >= level && (s.status === "active" || s.status === "all_in"));
    // Each contributor (including folded) puts (level - prevLevel) into this pot
    let potChunk = 0;
    for (const s of g.seats) {
      const contribAtLevel = Math.min(s.totalContributed, level) - Math.min(s.totalContributed, prevLevel);
      potChunk += contribAtLevel;
    }
    if (eligible.length > 0 && potChunk > 0) {
      // Compare hands
      const ranked = eligible.map((s) => ({
        seat: s,
        rank: evaluateBest([...(s.hole as Card[]), ...g.community]),
      }));
      const bestScore = Math.max(...ranked.map((r) => r.rank.score));
      const champs = ranked.filter((r) => r.rank.score === bestScore);
      const share = Math.floor(potChunk / champs.length);
      const remainder = potChunk - share * champs.length;
      for (let i = 0; i < champs.length; i++) {
        const amt = share + (i < remainder ? 1 : 0);
        champs[i].seat.stack += amt;
        winners.push({ seatIndex: champs[i].seat.seatIndex, amount: amt });
      }
    }
    prevLevel = level;
  }
  g.winners = winners;
  g.pot = 0;
}

function structuredCloneDeep<T>(v: T): T {
  // Bun & Node both have structuredClone globally
  return structuredClone(v);
}
