import assert from "node:assert/strict";
import test from "node:test";

import {
  LogicEvaluationError,
  evaluateFlowLogic,
  evaluateGate,
  evaluatePredicate,
  logicExecutionContract
} from "../lib/logic-semantics.js";

function aggregateFlow() {
  return {
    id: "aggregate",
    nodes: [
      { id: "a", kind: "input", data: { label: "检查 A" } },
      { id: "b", kind: "input", data: { label: "检查 B" } },
      { id: "all", kind: "condition", data: { label: "全部通过", gateType: "and", predicate: "truthy" } },
      { id: "inverse", kind: "condition", data: { label: "存在失败", gateType: "not" } },
      { id: "publish", kind: "agent", data: { label: "发布" } },
      { id: "reject", kind: "agent", data: { label: "拒绝" } },
      { id: "output", kind: "output", data: { label: "输出" } }
    ],
    edges: [
      { id: "a-all", source: "a", target: "all" },
      { id: "b-all", source: "b", target: "all" },
      { id: "all-publish", source: "all", target: "publish", sourceHandle: "and" },
      { id: "all-inverse", source: "all", target: "inverse", sourceHandle: "and" },
      { id: "inverse-reject", source: "inverse", target: "reject", sourceHandle: "not" },
      { id: "publish-output", source: "publish", target: "output" },
      { id: "reject-output", source: "reject", target: "output" }
    ],
    inputs: ["a", "b"],
    outputs: ["output"]
  };
}

test("every basic gate has deterministic Boolean truth semantics", () => {
  assert.equal(evaluateGate("ifElse", [true]), true);
  assert.equal(evaluateGate("and", [true, true, true]), true);
  assert.equal(evaluateGate("and", [true, false]), false);
  assert.equal(evaluateGate("or", [false, true]), true);
  assert.equal(evaluateGate("not", [false]), true);
  assert.equal(evaluateGate("nand", [true, true]), false);
  assert.equal(evaluateGate("nor", [false, false]), true);
  assert.equal(evaluateGate("xor", [true, true, true]), true);
  assert.equal(evaluateGate("xor", [true, true]), false);
  assert.equal(evaluateGate("xnor", [true, true]), true);
  assert.equal(evaluateGate("xnor", [true, false, false]), false);
  assert.throws(() => evaluateGate("and", [true]), LogicEvaluationError);
  assert.throws(() => evaluateGate("not", [true, false]), LogicEvaluationError);
});

test("predicates deterministically coerce upstream step results", () => {
  assert.equal(evaluatePredicate("done", "truthy"), true);
  assert.equal(evaluatePredicate(0, "falsy"), true);
  assert.equal(evaluatePredicate([], "nonEmpty"), false);
  assert.equal(evaluatePredicate({ ok: true }, "nonEmpty"), true);
});

test("each incoming source can override the condition's default predicate", () => {
  const flow = aggregateFlow();
  flow.nodes.find((node) => node.id === "all").data.inputPredicates = { b: "falsy" };
  const result = evaluateFlowLogic(flow, { a: true, b: false });
  assert.equal(result.conditions.all.result, true);
  assert.deepEqual(result.conditions.all.operands.map((operand) => operand.predicate), ["truthy", "falsy"]);
});

test("false gate results propagate into downstream gates instead of disappearing", () => {
  const result = evaluateFlowLogic(aggregateFlow(), { a: true, b: false });
  assert.equal(result.ready, true);
  assert.equal(result.conditions.all.result, false);
  assert.equal(result.conditions.inverse.operands[0].value, false);
  assert.equal(result.conditions.inverse.result, true);
  assert.deepEqual(result.activeTargets, ["reject"]);
  assert.deepEqual(
    result.edges.find((edge) => edge.edgeId === "all-inverse"),
    {
      edgeId: "all-inverse",
      source: "all",
      target: "inverse",
      mode: "boolean-signal",
      propagated: true,
      value: false,
      active: false
    }
  );
});

test("true aggregate results fan out and activate ordinary targets", () => {
  const result = evaluateFlowLogic(aggregateFlow(), { a: true, b: true });
  assert.equal(result.conditions.all.result, true);
  assert.equal(result.conditions.inverse.result, false);
  assert.deepEqual(result.activeTargets, ["publish"]);
});

test("missing upstream values stay explicit instead of being guessed", () => {
  const result = evaluateFlowLogic(aggregateFlow(), { a: true });
  assert.equal(result.ready, false);
  assert.equal(result.conditions.all.status, "pending");
  assert.equal(result.conditions.inverse.status, "pending");
  assert.deepEqual(result.missingInputs[0], { conditionId: "all", source: "b", edgeId: "b-all" });
});

test("IF/ELSE selects exactly the matching truth branch", () => {
  const flow = {
    id: "branch",
    nodes: [
      { id: "input", kind: "input", data: {} },
      { id: "route", kind: "condition", data: { gateType: "ifElse" } },
      { id: "yes", kind: "agent", data: {} },
      { id: "no", kind: "agent", data: {} },
      { id: "output", kind: "output", data: {} }
    ],
    edges: [
      { id: "input-route", source: "input", target: "route" },
      { id: "route-yes", source: "route", target: "yes", sourceHandle: "true" },
      { id: "route-no", source: "route", target: "no", sourceHandle: "false" },
      { id: "yes-output", source: "yes", target: "output" },
      { id: "no-output", source: "no", target: "output" }
    ],
    inputs: ["input"],
    outputs: ["output"]
  };
  assert.deepEqual(evaluateFlowLogic(flow, { input: true }).activeTargets, ["yes"]);
  assert.deepEqual(evaluateFlowLogic(flow, { input: false }).activeTargets, ["no"]);
});

test("the exported contract contains formulas, operands, predicates and output modes", () => {
  const contract = logicExecutionContract(aggregateFlow());
  assert.equal(contract.version, 1);
  assert.equal(contract.issues.length, 0);
  assert.equal(contract.conditions[0].formula, "A ∧ B ∧ …");
  assert.deepEqual(contract.conditions[0].inputs.map((input) => input.source), ["a", "b"]);
  assert.equal(contract.conditions[0].output.mode, "boolean-fan-out");
});
