import assert from "node:assert/strict";
import test from "node:test";

import {
  CONDITION_GATE_TYPES,
  availableGateBranches,
  conditionGateType,
  gateBranchForEdge,
  gateMaxOutgoing,
  normalizeGateType,
  validateGateBranch
} from "../lib/condition-gates.js";

test("gate types and legacy labels normalize to the persisted gate model", () => {
  assert.deepEqual(CONDITION_GATE_TYPES, ["ifElse", "and", "or", "not", "nand", "nor", "xor", "xnor"]);
  assert.equal(normalizeGateType("if-else"), "ifElse");
  assert.equal(normalizeGateType("是否"), "ifElse");
  assert.equal(normalizeGateType("与门"), "and");
  assert.equal(normalizeGateType("OR"), "or");
  assert.equal(normalizeGateType("非"), "not");
  assert.equal(normalizeGateType("与非门"), "nand");
  assert.equal(normalizeGateType("或非"), "nor");
  assert.equal(normalizeGateType("exclusive-or"), "xor");
  assert.equal(normalizeGateType("异或非门"), "xnor");
  assert.equal(gateBranchForEdge({ sourceHandle: true }), "true");
  assert.equal(gateBranchForEdge({ sourceHandle: "否" }), "false");
  assert.equal(gateBranchForEdge({ branch: "AND" }), "and");
  assert.equal(gateBranchForEdge({ branch: "同或" }), "xnor");
});

test("legacy condition nodes infer their gate from existing arrows", () => {
  const node = { id: "condition", kind: "condition", data: {} };
  assert.equal(conditionGateType(node, [{ sourceHandle: "or" }, { sourceHandle: "or" }]), "or");
  assert.equal(conditionGateType(node, [{ sourceHandle: "not" }]), "not");
  assert.equal(conditionGateType(node, [{ sourceHandle: "nand" }]), "nand");
  assert.equal(conditionGateType(node, [{ sourceHandle: "xor" }, { sourceHandle: "xor" }]), "xor");
  assert.equal(conditionGateType(node, [{ sourceHandle: "true" }, { sourceHandle: "false" }]), "ifElse");
  assert.equal(conditionGateType({ ...node, data: { gateType: "and" } }, []), "and");
});

test("IF/ELSE exposes one Yes and one No branch and rejects a third arrow", () => {
  const yes = { id: "yes-edge", sourceHandle: "true" };
  const no = { id: "no-edge", sourceHandle: "false" };
  assert.deepEqual(availableGateBranches("ifElse", []), ["true", "false"]);
  assert.deepEqual(availableGateBranches("ifElse", [yes]), ["false"]);
  assert.equal(validateGateBranch("ifElse", [yes], "true").code, "branchUsed");
  assert.equal(validateGateBranch("ifElse", [yes], "false").valid, true);
  assert.deepEqual(availableGateBranches("ifElse", [yes, no]), []);
  assert.equal(gateMaxOutgoing("ifElse"), 2);
});

test("AND and OR auto branches can fan out while enforcing their label", () => {
  const andEdges = Array.from({ length: 4 }, (_, index) => ({ id: `and-${index}`, sourceHandle: "and" }));
  const orEdges = Array.from({ length: 4 }, (_, index) => ({ id: `or-${index}`, sourceHandle: "or" }));
  assert.equal(validateGateBranch("and", andEdges, "and").valid, true);
  assert.equal(validateGateBranch("or", orEdges, "or").valid, true);
  assert.equal(validateGateBranch("and", [], "or").code, "logicMismatch");
  assert.equal(validateGateBranch("or", [], "true").code, "logicMismatch");
  assert.equal(gateMaxOutgoing("and"), Number.POSITIVE_INFINITY);
  assert.equal(gateMaxOutgoing("or"), Number.POSITIVE_INFINITY);
});

test("NAND, NOR, XOR and XNOR auto-label and fan out with exact gate semantics", () => {
  for (const gate of ["nand", "nor", "xor", "xnor"]) {
    const edges = Array.from({ length: 3 }, (_, index) => ({ id: `${gate}-${index}`, sourceHandle: gate }));
    assert.deepEqual(availableGateBranches(gate, edges), [gate]);
    assert.equal(validateGateBranch(gate, edges, gate).valid, true);
    assert.equal(validateGateBranch(gate, [], "and").code, "logicMismatch");
    assert.equal(gateMaxOutgoing(gate), Number.POSITIVE_INFINITY);
  }
});

test("NOT allows exactly one automatically labeled outgoing arrow", () => {
  const edge = { id: "not-edge", sourceHandle: "not" };
  assert.deepEqual(availableGateBranches("not", []), ["not"]);
  assert.equal(validateGateBranch("not", [], "not").valid, true);
  assert.deepEqual(availableGateBranches("not", [edge]), []);
  assert.equal(validateGateBranch("not", [edge], "not").code, "gateLimit");
  assert.equal(gateMaxOutgoing("not"), 1);
});
