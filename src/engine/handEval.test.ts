import { describe, test, expect } from "bun:test";
import { evaluate5, evaluateBest, HandCategory } from "./handEval";
import type { Card } from "./cards";

const c = (s: string) => s as Card;

describe("evaluate5", () => {
  test("royal flush", () => {
    const r = evaluate5(["Ah","Kh","Qh","Jh","Th"].map(c));
    expect(r.category).toBe(HandCategory.StraightFlush);
    expect(r.tiebreak[0]).toBe(14);
  });
  test("wheel straight flush (A-2-3-4-5)", () => {
    const r = evaluate5(["Ah","2h","3h","4h","5h"].map(c));
    expect(r.category).toBe(HandCategory.StraightFlush);
    expect(r.tiebreak[0]).toBe(5);
  });
  test("four of a kind", () => {
    const r = evaluate5(["9c","9d","9h","9s","Kd"].map(c));
    expect(r.category).toBe(HandCategory.Quads);
    expect(r.tiebreak).toEqual([9, 13]);
  });
  test("full house", () => {
    const r = evaluate5(["Jc","Jd","Jh","4s","4d"].map(c));
    expect(r.category).toBe(HandCategory.FullHouse);
    expect(r.tiebreak).toEqual([11, 4]);
  });
  test("flush beats straight", () => {
    const flush = evaluate5(["2c","6c","9c","Jc","Kc"].map(c));
    const straight = evaluate5(["2c","3d","4h","5s","6c"].map(c));
    expect(flush.score).toBeGreaterThan(straight.score);
  });
  test("wheel straight", () => {
    const r = evaluate5(["Ac","2d","3h","4s","5c"].map(c));
    expect(r.category).toBe(HandCategory.Straight);
    expect(r.tiebreak[0]).toBe(5);
  });
  test("two pair kicker", () => {
    const a = evaluate5(["Ac","Ad","Kc","Kd","9h"].map(c));
    const b = evaluate5(["Ac","Ad","Kc","Kd","8h"].map(c));
    expect(a.score).toBeGreaterThan(b.score);
  });
  test("high card vs pair", () => {
    const hc = evaluate5(["2c","5d","9h","Js","Ac"].map(c));
    const pp = evaluate5(["2c","2d","9h","Js","Ac"].map(c));
    expect(pp.score).toBeGreaterThan(hc.score);
  });
});

describe("evaluateBest (7 cards)", () => {
  test("picks best 5 from 7", () => {
    // 7 cards containing a flush
    const r = evaluateBest(["Ah","Kh","Qh","Jh","9h","2c","3d"].map(c));
    expect(r.category).toBe(HandCategory.Flush);
  });
  test("trips uses best kickers", () => {
    const r = evaluateBest(["7c","7d","7h","Ac","Kd","2s","3s"].map(c));
    expect(r.category).toBe(HandCategory.Trips);
    expect(r.tiebreak).toEqual([7, 14, 13]);
  });
});
