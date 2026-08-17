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

test("ordinary cycles stay rejected until the return edge is explicit bounded feedback", () => {
  const flow = baseFlow();
  flow.edges.push({ id: "retry", source: "yes", target: "route" });
  assert.throws(
    () => validateFlow(flow),
    (error) => error instanceof FlowValidationError
      && /ordinary execution edges/.test(error.message)
      && /maxIterations and exitCondition/.test(error.message)
  );

  flow.edges.at(-1).feedback = { maxIterations: 3, exitCondition: "the review passes" };
  const result = validateFlow(flow);
  assert.deepEqual(result.order, ["input", "route", "no", "yes", "output"]);
});

test("feedback loops require a bounded policy and a real executable return path", () => {
  const flow = baseFlow();
  flow.edges.push({ id: "retry", source: "yes", target: "route", feedback: { maxIterations: 0, exitCondition: "" } });
  assert.throws(() => validateFlow(flow), (error) => {
    assert.match(error.message, /maxIterations must be an integer/);
    assert.match(error.message, /exitCondition must be a non-empty string/);
    return true;
  });

  flow.edges.at(-1).feedback = { maxIterations: 2, exitCondition: "review passes" };
  assert.doesNotThrow(() => validateFlow(flow));

  for (const key of ["sourceHandle", "branch", "logic"]) {
    const branched = structuredClone(flow);
    branched.edges.at(-1)[key] = "true";
    assert.throws(() => validateFlow(branched), /cannot carry a condition branch/);
  }

  const disconnected = baseFlow();
  disconnected.edges.push({ id: "not-a-loop", source: "input", target: "no", feedback: { maxIterations: 2, exitCondition: "done" } });
  assert.throws(() => validateFlow(disconnected), /must close an executable path/);
});

test("a bounded self-feedback edge is valid and does not make the executable graph cyclic", () => {
  const flow = baseFlow();
  flow.edges.push({ id: "self-retry", source: "yes", target: "yes", feedback: { maxIterations: 2, exitCondition: "work is complete" } });
  assert.doesNotThrow(() => validateFlow(flow));
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
