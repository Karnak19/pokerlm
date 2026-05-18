import { describe, test, expect } from "bun:test";
import { applyAction, legalActions, startHand } from "./state";

function setup(seatCount: number, seed = 42) {
  return startHand({
    seatCount,
    stacks: Array(seatCount).fill(1000),
    dealerIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    seed,
  });
}

describe("startHand", () => {
  test("posts blinds and deals hole cards", () => {
    const g = setup(3);
    // dealer 0 → SB 1, BB 2, UTG 0
    expect(g.seats[1].streetBet).toBe(5);
    expect(g.seats[2].streetBet).toBe(10);
    expect(g.pot).toBe(15);
    expect(g.currentBet).toBe(10);
    expect(g.toAct).toBe(0);
    for (const s of g.seats) expect(s.hole?.length).toBe(2);
    // Hole cards distinct (no double-deal bug)
    for (const s of g.seats) expect(s.hole![0]).not.toBe(s.hole![1]);
    // All 6 hole cards distinct across seats
    const all = g.seats.flatMap((s) => s.hole!);
    expect(new Set(all).size).toBe(6);
  });
  test("heads-up: dealer posts SB", () => {
    const g = setup(2);
    expect(g.seats[0].streetBet).toBe(5); // dealer = SB
    expect(g.seats[1].streetBet).toBe(10); // BB
    expect(g.toAct).toBe(0); // SB acts first preflop heads-up
  });
});

describe("betting round flow", () => {
  test("everyone folds to BB — BB wins", () => {
    let g = setup(3);
    g = applyAction(g, { kind: "fold" }); // UTG 0 folds
    g = applyAction(g, { kind: "fold" }); // SB 1 folds
    expect(g.street).toBe("showdown");
    expect(g.winners?.[0].seatIndex).toBe(2);
    expect(g.winners?.[0].amount).toBe(15);
  });
  test("preflop all call → flop dealt", () => {
    let g = setup(3);
    g = applyAction(g, { kind: "call" });  // UTG 0 calls
    g = applyAction(g, { kind: "call" });  // SB 1 calls (5 more)
    g = applyAction(g, { kind: "check" }); // BB 2 checks
    expect(g.street).toBe("flop");
    expect(g.community.length).toBe(3);
    expect(g.currentBet).toBe(0);
    expect(g.toAct).toBe(1); // first active after dealer
  });
  test("min-raise enforced", () => {
    let g = setup(3);
    expect(() => applyAction(g, { kind: "raise", amount: 15 })).toThrow();
    g = applyAction(g, { kind: "raise", amount: 20 });
    expect(g.currentBet).toBe(20);
    expect(g.lastRaiseSize).toBe(10);
  });
  test("raise reopens action", () => {
    let g = setup(3);
    g = applyAction(g, { kind: "call" });   // UTG 0 calls
    g = applyAction(g, { kind: "raise", amount: 30 }); // SB raises
    // BB must now act again
    expect(g.toAct).toBe(2);
    g = applyAction(g, { kind: "call" });
    // UTG must act again (raise reopened)
    expect(g.toAct).toBe(0);
  });
});

describe("showdown", () => {
  test("all-in heads-up resolves to showdown after dealing remaining streets", () => {
    let g = startHand({
      seatCount: 2, stacks: [100, 100], dealerIndex: 0,
      smallBlind: 5, bigBlind: 10, seed: 7,
    });
    g = applyAction(g, { kind: "all_in" });  // SB shoves
    g = applyAction(g, { kind: "call" });    // BB calls
    expect(g.street).toBe("showdown");
    expect(g.community.length).toBe(5);
    expect(g.winners).toBeDefined();
    const totalAwarded = g.winners!.reduce((a, w) => a + w.amount, 0);
    expect(totalAwarded).toBe(200);
  });
});

describe("legalActions", () => {
  test("UTG preflop facing BB", () => {
    const g = setup(3);
    const la = legalActions(g);
    expect(la.canFold).toBe(true);
    expect(la.canCheck).toBe(false);
    expect(la.canCall).toBe(true);
    expect(la.callAmount).toBe(10);
    expect(la.canRaise).toBe(true);
    expect(la.minRaiseTo).toBe(20);
  });
});
