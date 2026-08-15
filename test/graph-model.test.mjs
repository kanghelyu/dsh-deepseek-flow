import assert from "node:assert/strict";
import test from "node:test";
import {
  branchDisplayLabel,
  connectionProblem,
  connectionProblemMessage,
  flowToCanvasEdges,
  flowToCanvasNodes,
  layoutNodes,
  logicSnapshot,
  reconnectFlowEdge,
  serializeFlow
} from "../src/client/graph-model.js";

const copy = {
  branchLabel: {
    true: "是",
    false: "否",
    and: "与",
    or: "或",
    not: "非"
  },
  duplicateConnection: "重复",
  ifElseFull: "分支已满",
  notFull: "非门已满",
  branchUsed: "分支已使用",
  gateMismatch: "门不匹配",
  invalidConnection: "无效连接"
};

function canvasNode(id, kind = "agent", gateType) {
  return {
    id,
    type: "flow",
    position: { x: 0, y: 0 },
    data: { kind, label: id, ...(gateType ? { gateType } : {}) }
  };
}

test("flow conversion infers legacy gates and localizes automatic edge labels", () => {
  const flow = {
    id: "logic",
    nodes: [
      { id: "condition", kind: "condition", data: { label: "route" } },
      { id: "target", kind: "agent", data: { label: "target" } }
    ],
    edges: [{ id: "edge", source: "condition", target: "target", sourceHandle: "or" }],
    docs: { condition: "condition/STEP.md" }
  };

  const nodes = flowToCanvasNodes(flow);
  const edges = flowToCanvasEdges(flow.edges, copy);

  assert.equal(nodes[0].data.gateType, "or");
  assert.equal(nodes[0].data.docPath, "condition/STEP.md");
  assert.equal(edges[0].label, "或");
  assert.equal(edges[0].autoLogicLabel, true);
  assert.equal(branchDisplayLabel("true", copy), "是");
});

test("serialization removes view-only fields and preserves gate semantics", () => {
  const nodes = [{
    id: "condition",
    type: "flow",
    position: { x: 10, y: 20 },
    data: {
      kind: "condition",
      gateType: "ifElse",
      label: "ready?",
      docPath: "condition/STEP.md",
      language: "zh"
    }
  }];
  const edges = [{
    id: "yes",
    source: "condition",
    target: "output",
    sourceHandle: "true",
    label: "是",
    autoLogicLabel: true
  }];

  const serialized = serializeFlow({ id: "flow", docs: {} }, nodes, edges);

  assert.deepEqual(serialized.nodes[0].data, { gateType: "ifElse", label: "ready?" });
  assert.deepEqual(serialized.edges[0], {
    id: "yes",
    source: "condition",
    target: "output",
    sourceHandle: "true"
  });
});

test("connection validation centralizes duplicates, branch limits, and warnings", () => {
  const nodes = [
    canvasNode("condition", "condition", "ifElse"),
    canvasNode("yes"),
    canvasNode("no"),
    canvasNode("extra")
  ];
  const yesEdge = { id: "yes-edge", source: "condition", target: "yes", sourceHandle: "true" };

  assert.equal(connectionProblem(nodes, [yesEdge], { source: "condition", target: "yes" }).code, "duplicateConnection");
  assert.equal(connectionProblem(nodes, [yesEdge], { source: "condition", target: "no" }, "true").code, "branchUsed");
  assert.equal(connectionProblem(nodes, [yesEdge], { source: "condition", target: "no" }, "false").valid, true);

  const full = connectionProblem(nodes, [
    yesEdge,
    { id: "no-edge", source: "condition", target: "no", sourceHandle: "false" }
  ], { source: "condition", target: "extra" });
  assert.equal(full.code, "ifElseFull");
  assert.equal(connectionProblemMessage(full, copy), "分支已满");
});

test("graph helpers keep reconnects immutable and layout deterministic", () => {
  const edges = [{ id: "edge", source: "a", target: "b" }];
  const reconnected = reconnectFlowEdge(edges[0], { source: "a", target: "c" }, edges);
  assert.notEqual(reconnected, edges);
  assert.equal(edges[0].target, "b");
  assert.equal(reconnected[0].target, "c");

  const laidOut = layoutNodes(
    [canvasNode("a"), canvasNode("b"), canvasNode("c")],
    [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c" }]
  );
  assert.deepEqual(laidOut.map((node) => node.position), [
    { x: 70, y: 90 },
    { x: 315, y: 90 },
    { x: 560, y: 90 }
  ]);
});

test("logic snapshots contain semantic content without canvas-only metadata", () => {
  const snapshot = JSON.parse(logicSnapshot({
    workflowContent: "# Flow",
    docs: { condition: "condition/STEP.md" },
    nodes: [{ id: "condition", kind: "condition", data: { label: "Ready?", gateType: "ifElse", instructions: "Check it" } }],
    edges: [{ id: "yes", source: "condition", target: "output", sourceHandle: "true" }]
  }));

  assert.equal(snapshot.nodes[0].gateType, "ifElse");
  assert.equal(snapshot.nodes[0].content, "Check it");
  assert.equal(snapshot.edges[0].sourceHandle, "true");
});
