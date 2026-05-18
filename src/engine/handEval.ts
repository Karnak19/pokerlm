import { Card, RANK_VALUE, rankOf, suitOf } from "./cards";

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  Trips: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  Quads: 7,
  StraightFlush: 8,
} as const;
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export interface HandRank {
  category: HandCategory;
  tiebreak: number[]; // descending values
  score: number;      // single comparable number (higher = better)
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, picked: T[]) => {
    if (picked.length === k) { out.push(picked); return; }
    for (let i = start; i < arr.length; i++) rec(i + 1, [...picked, arr[i]]);
  };
  rec(0, []);
  return out;
}

function encode(category: HandCategory, tiebreak: number[]): number {
  // 6 slots × base 16 keeps every relevant kicker comparison.
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 16 + (tiebreak[i] ?? 0);
  return score;
}

function findStraight(values: number[]): number | null {
  // values are unique, sorted desc
  const set = new Set(values);
  for (const v of values) {
    if (set.has(v) && set.has(v - 1) && set.has(v - 2) && set.has(v - 3) && set.has(v - 4)) {
      return v;
    }
  }
  // Ace-low wheel: A-2-3-4-5 (A counts as 1) — top card is 5.
  if (set.has(14) && set.has(5) && set.has(4) && set.has(3) && set.has(2)) return 5;
  return null;
}

export function evaluate5(cards: Card[]): HandRank {
  if (cards.length !== 5) throw new Error("evaluate5 needs 5 cards");
  const values = cards.map((c) => RANK_VALUE[rankOf(c)]).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniqueVals = [...new Set(values)].sort((a, b) => b - a);
  const straightTop = uniqueVals.length === 5 ? findStraight(uniqueVals) : null;

  // counts
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const grouped = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const countsOnly = grouped.map(([, c]) => c);

  if (isFlush && straightTop !== null) {
    return { category: HandCategory.StraightFlush, tiebreak: [straightTop], score: encode(HandCategory.StraightFlush, [straightTop]) };
  }
  if (countsOnly[0] === 4) {
    const quad = grouped[0][0];
    const kicker = grouped[1][0];
    return { category: HandCategory.Quads, tiebreak: [quad, kicker], score: encode(HandCategory.Quads, [quad, kicker]) };
  }
  if (countsOnly[0] === 3 && countsOnly[1] === 2) {
    const trips = grouped[0][0];
    const pair = grouped[1][0];
    return { category: HandCategory.FullHouse, tiebreak: [trips, pair], score: encode(HandCategory.FullHouse, [trips, pair]) };
  }
  if (isFlush) {
    return { category: HandCategory.Flush, tiebreak: values, score: encode(HandCategory.Flush, values) };
  }
  if (straightTop !== null) {
    return { category: HandCategory.Straight, tiebreak: [straightTop], score: encode(HandCategory.Straight, [straightTop]) };
  }
  if (countsOnly[0] === 3) {
    const trips = grouped[0][0];
    const kickers = grouped.slice(1).map(([v]) => v);
    return { category: HandCategory.Trips, tiebreak: [trips, ...kickers], score: encode(HandCategory.Trips, [trips, ...kickers]) };
  }
  if (countsOnly[0] === 2 && countsOnly[1] === 2) {
    const hi = grouped[0][0];
    const lo = grouped[1][0];
    const kicker = grouped[2][0];
    return { category: HandCategory.TwoPair, tiebreak: [hi, lo, kicker], score: encode(HandCategory.TwoPair, [hi, lo, kicker]) };
  }
  if (countsOnly[0] === 2) {
    const pair = grouped[0][0];
    const kickers = grouped.slice(1).map(([v]) => v);
    return { category: HandCategory.Pair, tiebreak: [pair, ...kickers], score: encode(HandCategory.Pair, [pair, ...kickers]) };
  }
  return { category: HandCategory.HighCard, tiebreak: values, score: encode(HandCategory.HighCard, values) };
}

export function evaluateBest(cards: Card[]): HandRank {
  if (cards.length < 5) throw new Error("evaluateBest needs ≥5 cards");
  if (cards.length === 5) return evaluate5(cards);
  let best: HandRank | null = null;
  for (const combo of combinations(cards, 5)) {
    const r = evaluate5(combo);
    if (!best || r.score > best.score) best = r;
  }
  return best!;
}

export function compareHands(a: HandRank, b: HandRank): number {
  return a.score - b.score;
}
