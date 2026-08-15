import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReviewedTopology,
  mergeDocumentEdits,
  topologyDiff,
  topologyProjection,
  topologySignature
} from "../lib/topology-model.js";

function flowFixture() {
  return {
    id: "topology-flow",
    name: "Topology flow",
    revision: 4,
    workflowDoc: "WORKFLOW.md",
    workflowContent: "# Saved workflow",
    docs: { input: "01-input/STEP.md", output: "02-output/STEP.md" },
    nodes: [
      { id: "input", kind: "input", position: { x: 0, y: 0 }, data: { label: "Input", instructions: "# Saved input" } },
      { id: "output", kind: "output", position: { x: 240, y: 0 }, data: { label: "Output", instructions: "# Saved output" } }
    ],
    edges: [{ id: "e1", source: "input", target: "output" }],
    inputs: ["input"],
    outputs: ["output"]
  };
}

test("topology signatures ignore Markdown and node positions, but detect boxes, arrows and labels", () => {
  const saved = flowFixture();
  const markdownOnly = structuredClone(saved);
  markdownOnly.workflowContent = "# Changed workflow";
  markdownOnly.nodes[0].data.instructions = "# Changed input";
  markdownOnly.nodes[0].position.x = 48;
  assert.equal(topologySignature(markdownOnly), topologySignature(saved));

  const moved = structuredClone(markdownOnly);
  moved.nodes[1].data.label = "Renamed output";
  moved.edges.push({ id: "e2", source: "input", target: "output", label: "manual" });
  const diff = topologyDiff(saved, moved);
  assert.equal(diff.changed, true);
  assert.deepEqual(diff.nodes.changed, ["output"]);
  assert.deepEqual(diff.edges.added, ["e2"]);
});

test("Markdown auto-save keeps persisted topology and documents for draft-removed nodes", () => {
  const saved = flowFixture();
  const editor = structuredClone(saved);
  editor.workflowContent = "# Edited workflow";
  editor.docs = { input: "custom/STEP.md" };
  const canvasNodes = [{
    ...editor.nodes[0],
    position: { x: 999, y: 999 },
    data: { ...editor.nodes[0].data, kind: "input", instructions: "# Edited input" }
  }];
  const merged = mergeDocumentEdits(saved, editor, canvasNodes);
  assert.deepEqual(topologyProjection(merged), topologyProjection(saved));
  assert.equal(merged.workflowContent, "# Edited workflow");
  assert.equal(merged.nodes[0].data.instructions, "# Edited input");
  assert.equal(merged.nodes[0].position.x, 0);
  assert.equal(merged.docs.input, "custom/STEP.md");
  assert.equal(merged.docs.output, "02-output/STEP.md");
});

test("reviewed topology preserves latest existing Markdown and initializes new boxes safely", () => {
  const current = flowFixture();
  current.workflowContent = "# Latest workflow edit";
  current.nodes[1].data.instructions = "# Latest output edit";
  const draft = structuredClone(current);
  draft.nodes.splice(1, 0, {
    id: "check",
    kind: "agent",
    position: { x: 120, y: 0 },
    data: { label: "Check", prompt: "# Draft check" }
  });
  draft.edges = [
    { id: "e1", source: "input", target: "check" },
    { id: "e2", source: "check", target: "output" }
  ];
  const reviewed = topologyProjection(draft);
  const rebuilt = applyReviewedTopology(current, draft, reviewed);
  assert.equal(rebuilt.workflowContent, "# Latest workflow edit");
  assert.equal(rebuilt.nodes.find((node) => node.id === "output").data.instructions, "# Latest output edit");
  assert.equal(rebuilt.nodes.find((node) => node.id === "check").data.prompt, "# Draft check");
  assert.deepEqual(rebuilt.edges.map((edge) => edge.id), ["e1", "e2"]);
});
