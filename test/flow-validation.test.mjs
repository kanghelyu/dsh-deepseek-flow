import assert from "node:assert/strict";
import test from "node:test";
import { FlowValidationError, validateFlow } from "../lib/flow-validation.js";

function baseFlow() {
  return {
    id: "valid",
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
}

test("a complete acyclic branch graph validates and produces deterministic levels", () => {
  const result = validateFlow(baseFlow());
  assert.deepEqual(result.levels, [["input"], ["route"], ["no", "yes"], ["output"]]);
});

test("cycles stay rejected with an actionable bounded-retry alternative", () => {
  const flow = baseFlow();
  flow.edges.push({ id: "retry", source: "yes", target: "route" });
  assert.throws(
    () => validateFlow(flow),
    (error) => error instanceof FlowValidationError
      && /cycle detected/.test(error.message)
      && /bounded retry step/.test(error.message)
  );
});

test("validation reports multiple graph issues on separate readable lines", () => {
  const flow = baseFlow();
  flow.edges.push(
    { id: "broken-a", source: "missing", target: "output" },
    { id: "broken-b", source: "input", target: "missing" }
  );
  assert.throws(
    () => validateFlow(flow),
    (error) => error instanceof FlowValidationError
      && error.issues.length >= 2
      && error.message.split("\n").length >= 3
  );
});

test("validation rejects empty ids and unknown box kinds from unstructured Agent output", () => {
  const flow = baseFlow();
  flow.nodes[0].id = "";
  flow.nodes[1].kind = "mystery";
  flow.edges[0].id = "";
  assert.throws(() => validateFlow(flow), (error) => {
    assert.match(error.message, /non-empty string id/);
    assert.match(error.message, /unsupported kind mystery/);
    assert.match(error.message, /edge <missing> requires a source|dangling edge/);
    return true;
  });
});

test("aggregate and unary gates enforce semantic input arity", () => {
  const aggregate = baseFlow();
  aggregate.nodes.find((node) => node.id === "route").data.gateType = "and";
  aggregate.edges = aggregate.edges
    .filter((edge) => edge.id !== "route-no")
    .map((edge) => edge.id === "route-yes" ? { ...edge, sourceHandle: "and" } : edge);
  assert.throws(
    () => validateFlow(aggregate),
    (error) => error instanceof FlowValidationError
      && /requires at least 2 incoming Boolean inputs/.test(error.message)
  );

  const unary = baseFlow();
  unary.nodes.find((node) => node.id === "route").data.gateType = "not";
  unary.edges = unary.edges
    .filter((edge) => edge.id !== "route-no")
    .map((edge) => edge.id === "route-yes" ? { ...edge, sourceHandle: "not" } : edge);
  unary.edges.push({ id: "extra-route", source: "no", target: "route" });
  assert.throws(
    () => validateFlow(unary),
    (error) => error instanceof FlowValidationError
      && /requires exactly 1 incoming Boolean input/.test(error.message)
  );
});
