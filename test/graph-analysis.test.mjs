import assert from "node:assert/strict";
import test from "node:test";
import {
  feedbackEdges,
  isFeedbackEdge,
  normalEdges,
  stableTopologicalOrder
} from "../lib/graph-analysis.js";

const nodes = [{ id: "input" }, { id: "work" }, { id: "review" }, { id: "output" }];

test("feedback edges stay outside the executable DAG order", () => {
  const edges = [
    { id: "input-work", source: "input", target: "work" },
    { id: "work-review", source: "work", target: "review" },
    { id: "review-output", source: "review", target: "output" },
    { id: "retry", source: "review", target: "work", feedback: { maxIterations: 3, exitCondition: "review passes" } }
  ];

  assert.equal(isFeedbackEdge(edges.at(-1)), true);
  assert.deepEqual(feedbackEdges(edges).map((edge) => edge.id), ["retry"]);
  assert.deepEqual(normalEdges(edges).map((edge) => edge.id), ["input-work", "work-review", "review-output"]);
  assert.deepEqual(stableTopologicalOrder(nodes, edges).order, ["input", "work", "review", "output"]);
});

test("ordinary cycles remain visible to the executable DAG analysis", () => {
  const edges = [
    { id: "input-work", source: "input", target: "work" },
    { id: "work-review", source: "work", target: "review" },
    { id: "review-work", source: "review", target: "work" }
  ];

  const analyzed = stableTopologicalOrder(nodes, edges);
  assert.equal(analyzed.complete, false);
  assert.deepEqual(analyzed.remaining.sort(), ["review", "work"]);
});
