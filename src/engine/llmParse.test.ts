import { describe, test, expect } from "bun:test";
import { parseLLMAction } from "./llmParse";
import type { LegalActions } from "./state";

const facing: LegalActions = {
  canFold: true, canCheck: false, canCall: true, callAmount: 10,
  canBet: false, canRaise: true, minRaiseTo: 20, maxRaiseTo: 1000,
};
const open: LegalActions = {
  canFold: true, canCheck: true, canCall: false, callAmount: 0,
  canBet: true, canRaise: false, minRaiseTo: 10, maxRaiseTo: 1000,
};

describe("parseLLMAction", () => {
  test("clean JSON fold", () => {
    expect(parseLLMAction('{"action":"fold"}', facing)).toEqual({ kind: "fold" });
  });
  test("JSON wrapped in prose", () => {
    expect(parseLLMAction('Thinking... {"action": "call"} that\'s my play', facing)).toEqual({ kind: "call" });
  });
  test("freeform raise with amount", () => {
    const a = parseLLMAction("I raise to 50 chips", facing);
    expect(a).toEqual({ kind: "raise", amount: 50 });
  });
  test("min-raise clamp", () => {
    const a = parseLLMAction('{"action":"raise","amount":5}', facing);
    expect(a).toEqual({ kind: "raise", amount: 20 });
  });
  test("max-raise clamp", () => {
    const a = parseLLMAction('{"action":"raise","amount":99999}', facing);
    expect(a).toEqual({ kind: "raise", amount: 1000 });
  });
  test("illegal check facing bet → fold", () => {
    expect(parseLLMAction('{"action":"check"}', facing)).toEqual({ kind: "fold" });
  });
  test("garbage → check when allowed", () => {
    expect(parseLLMAction("¯\\_(ツ)_/¯", open)).toEqual({ kind: "check" });
  });
  test("garbage → fold facing bet", () => {
    expect(parseLLMAction("¯\\_(ツ)_/¯", facing)).toEqual({ kind: "fold" });
  });
  test("all-in keyword", () => {
    expect(parseLLMAction("ALL-IN baby!", facing)).toEqual({ kind: "all_in" });
  });
});
