/* deepseek-flow client-rev:6f9f0d7abbfd */
window.__ModuleLoader__.load({ id: "deepseek-flow", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/entry.js
var entry_exports = {};
__export(entry_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(entry_exports);
var import_react2 = __toESM(require("react"), 1);

// lib/condition-gates.js
var CONDITION_GATE_TYPES = Object.freeze([
  "ifElse",
  "and",
  "or",
  "not",
  "nand",
  "nor",
  "xor",
  "xnor"
]);
var AUTO_FAN_OUT_GATES = /* @__PURE__ */ new Set(["and", "or", "nand", "nor", "xor", "xnor"]);
var GATE_ALIASES = /* @__PURE__ */ new Map([
  ["ifelse", "ifElse"],
  ["if/else", "ifElse"],
  ["if-else", "ifElse"],
  ["branch", "ifElse"],
  ["boolean", "ifElse"],
  ["yesno", "ifElse"],
  ["truefalse", "ifElse"],
  ["\u662F\u5426", "ifElse"],
  ["\u5224\u65AD", "ifElse"],
  ["and", "and"],
  ["all", "and"],
  ["\u4E0E", "and"],
  ["\u4E0E\u95E8", "and"],
  ["or", "or"],
  ["any", "or"],
  ["\u6216", "or"],
  ["\u6216\u95E8", "or"],
  ["not", "not"],
  ["negate", "not"],
  ["\u975E", "not"],
  ["\u975E\u95E8", "not"],
  ["nand", "nand"],
  ["notand", "nand"],
  ["andnot", "nand"],
  ["\u4E0E\u975E", "nand"],
  ["\u4E0E\u975E\u95E8", "nand"],
  ["nor", "nor"],
  ["notor", "nor"],
  ["ornot", "nor"],
  ["\u6216\u975E", "nor"],
  ["\u6216\u975E\u95E8", "nor"],
  ["xor", "xor"],
  ["exclusiveor", "xor"],
  ["\u5F02\u6216", "xor"],
  ["\u5F02\u6216\u95E8", "xor"],
  ["xnor", "xnor"],
  ["equivalence", "xnor"],
  ["exclusiveornot", "xnor"],
  ["\u540C\u6216", "xnor"],
  ["\u540C\u6216\u95E8", "xnor"],
  ["\u5F02\u6216\u975E", "xnor"],
  ["\u5F02\u6216\u975E\u95E8", "xnor"]
]);
var BRANCH_ALIASES = /* @__PURE__ */ new Map([
  ["true", "true"],
  ["yes", "true"],
  ["\u662F", "true"],
  ["false", "false"],
  ["no", "false"],
  ["\u5426", "false"],
  ["and", "and"],
  ["\u4E0E", "and"],
  ["\u4E0E\u95E8", "and"],
  ["or", "or"],
  ["\u6216", "or"],
  ["\u6216\u95E8", "or"],
  ["not", "not"],
  ["\u975E", "not"],
  ["\u975E\u95E8", "not"],
  ["nand", "nand"],
  ["\u4E0E\u975E", "nand"],
  ["\u4E0E\u975E\u95E8", "nand"],
  ["nor", "nor"],
  ["\u6216\u975E", "nor"],
  ["\u6216\u975E\u95E8", "nor"],
  ["xor", "xor"],
  ["\u5F02\u6216", "xor"],
  ["\u5F02\u6216\u95E8", "xor"],
  ["xnor", "xnor"],
  ["\u540C\u6216", "xnor"],
  ["\u540C\u6216\u95E8", "xnor"],
  ["\u5F02\u6216\u975E", "xnor"],
  ["\u5F02\u6216\u975E\u95E8", "xnor"]
]);
function compact(value) {
  return String(value ?? "").trim().replace(/[\s_-]+/g, "").toLowerCase();
}
function normalizeGateType(value, fallback = "ifElse") {
  if (CONDITION_GATE_TYPES.includes(value)) return value;
  return GATE_ALIASES.get(compact(value)) ?? fallback;
}
function gateBranchForEdge(edge) {
  const raw = edge?.sourceHandle ?? edge?.branch ?? edge?.logic;
  if (raw === true) return "true";
  if (raw === false) return "false";
  return BRANCH_ALIASES.get(compact(raw));
}
function conditionGateType(node, outgoingEdges = []) {
  const explicit = node?.data?.gateType ?? node?.gateType;
  if (explicit !== void 0 && explicit !== null && String(explicit).trim()) {
    return normalizeGateType(explicit);
  }
  const branches = new Set(outgoingEdges.map(gateBranchForEdge).filter(Boolean));
  if (branches.size === 1) {
    const [branch] = branches;
    if (branch === "not" || AUTO_FAN_OUT_GATES.has(branch)) return branch;
  }
  return "ifElse";
}
function branchesForGate(gateType) {
  const gate = normalizeGateType(gateType);
  return gate === "ifElse" ? ["true", "false"] : [gate];
}
function availableGateBranches(gateType, outgoingEdges = [], excludeEdgeId = null) {
  const gate = normalizeGateType(gateType);
  const relevant = outgoingEdges.filter((edge) => edge?.id !== excludeEdgeId);
  if (AUTO_FAN_OUT_GATES.has(gate)) return [gate];
  if (gate === "not") return relevant.length === 0 ? ["not"] : [];
  const used = new Set(relevant.map(gateBranchForEdge).filter(Boolean));
  return ["true", "false"].filter((branch) => !used.has(branch));
}
function validateGateBranch(gateType, outgoingEdges, branch, excludeEdgeId = null) {
  const gate = normalizeGateType(gateType);
  const normalizedBranch = gateBranchForEdge({ sourceHandle: branch });
  if (!branchesForGate(gate).includes(normalizedBranch)) {
    return { valid: false, code: "logicMismatch", gateType: gate, branch: normalizedBranch };
  }
  const available = availableGateBranches(gate, outgoingEdges, excludeEdgeId);
  if (!available.includes(normalizedBranch)) {
    return {
      valid: false,
      code: gate === "ifElse" ? "branchUsed" : "gateLimit",
      gateType: gate,
      branch: normalizedBranch
    };
  }
  return { valid: true, code: "ok", gateType: gate, branch: normalizedBranch };
}

// lib/logic-semantics.js
var LOGIC_PREDICATES = Object.freeze(["truthy", "falsy", "nonEmpty"]);
var GATE_RULES = Object.freeze({
  ifElse: { minInputs: 1, maxInputs: 1, formula: "A", outputMode: "selected-branch" },
  and: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "A \u2227 B \u2227 \u2026", outputMode: "boolean-fan-out" },
  or: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "A \u2228 B \u2228 \u2026", outputMode: "boolean-fan-out" },
  not: { minInputs: 1, maxInputs: 1, formula: "\xACA", outputMode: "boolean-fan-out" },
  nand: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "\xAC(A \u2227 B \u2227 \u2026)", outputMode: "boolean-fan-out" },
  nor: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "\xAC(A \u2228 B \u2228 \u2026)", outputMode: "boolean-fan-out" },
  xor: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "A \u2295 B \u2295 \u2026 (odd parity)", outputMode: "boolean-fan-out" },
  xnor: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "\xAC(A \u2295 B \u2295 \u2026) (even parity)", outputMode: "boolean-fan-out" }
});
function gateRule(gateType) {
  return GATE_RULES[normalizeGateType(gateType)];
}

// lib/topology-model.js
var TOPOLOGY_DATA_KEYS = Object.freeze([
  "label",
  "gateType",
  "predicate",
  "inputPredicates",
  "order"
]);
function definedEntries(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}
function topologyNode(node) {
  return {
    id: String(node?.id ?? ""),
    kind: String(node?.kind ?? node?.data?.kind ?? "agent"),
    data: definedEntries(Object.fromEntries(
      TOPOLOGY_DATA_KEYS.map((key) => [key, node?.data?.[key]])
    ))
  };
}
function topologyEdge(edge) {
  return definedEntries({
    id: String(edge?.id ?? ""),
    source: String(edge?.source ?? ""),
    target: String(edge?.target ?? ""),
    sourceHandle: edge?.sourceHandle ?? edge?.branch,
    targetHandle: edge?.targetHandle,
    label: edge?.autoLogicLabel ? void 0 : edge?.label
  });
}
function topologyProjection(flow) {
  return {
    id: String(flow?.id ?? ""),
    nodes: (flow?.nodes ?? []).map(topologyNode),
    edges: (flow?.edges ?? []).map(topologyEdge),
    inputs: (flow?.inputs ?? []).map(String),
    outputs: (flow?.outputs ?? []).map(String)
  };
}
function topologySignature(flow) {
  return JSON.stringify(topologyProjection(flow));
}
function topologySyncDecision(baseFlow, draftFlow, remoteFlow) {
  const base = topologySignature(baseFlow);
  const draft = topologySignature(draftFlow);
  const remote = topologySignature(remoteFlow);
  if (remote === base) return "documents-only";
  if (remote === draft) return "already-persisted";
  if (draft === base) return "remote-advanced-clean";
  return "conflict";
}
function indexed(items) {
  return new Map(items.map((item) => [item.id, item]));
}
function changedIds(beforeItems, afterItems) {
  const before = indexed(beforeItems);
  const after = indexed(afterItems);
  const added = afterItems.filter((item) => !before.has(item.id)).map((item) => item.id);
  const removed = beforeItems.filter((item) => !after.has(item.id)).map((item) => item.id);
  const changed = afterItems.filter((item) => before.has(item.id) && JSON.stringify(before.get(item.id)) !== JSON.stringify(item)).map((item) => item.id);
  return { added, removed, changed };
}
function topologyDiff(beforeFlow, afterFlow) {
  const before = topologyProjection(beforeFlow);
  const after = topologyProjection(afterFlow);
  const nodes = changedIds(before.nodes, after.nodes);
  const edges = changedIds(before.edges, after.edges);
  const nodeOrderChanged = JSON.stringify(before.nodes.map((node) => node.id)) !== JSON.stringify(after.nodes.map((node) => node.id));
  const edgeOrderChanged = JSON.stringify(before.edges.map((edge) => edge.id)) !== JSON.stringify(after.edges.map((edge) => edge.id));
  const ioChanged = JSON.stringify([before.inputs, before.outputs]) !== JSON.stringify([after.inputs, after.outputs]);
  const count = nodes.added.length + nodes.removed.length + nodes.changed.length + edges.added.length + edges.removed.length + edges.changed.length + Number(nodeOrderChanged) + Number(edgeOrderChanged) + Number(ioChanged);
  return {
    changed: count > 0,
    count,
    nodes,
    edges,
    nodeOrderChanged,
    edgeOrderChanged,
    ioChanged
  };
}
function documentDataPatch(node) {
  if (!node?.data) return {};
  return withoutTopologyData(node.data);
}
function mergeDocumentEdits(persistedFlow, editorFlow, canvasNodes = []) {
  if (!persistedFlow) return editorFlow;
  const editorNodes = indexed(canvasNodes.map((node) => ({
    ...node,
    kind: node.kind ?? node.data?.kind
  })));
  const docs = { ...persistedFlow.docs ?? {} };
  for (const node of persistedFlow.nodes ?? []) {
    if (!editorNodes.has(node.id)) continue;
    const nextPath = editorFlow?.docs?.[node.id];
    if (typeof nextPath === "string" && nextPath.trim()) docs[node.id] = nextPath;
    else delete docs[node.id];
  }
  return {
    ...persistedFlow,
    workflowDoc: editorFlow?.workflowDoc ?? persistedFlow.workflowDoc,
    workflowContent: editorFlow?.workflowContent ?? persistedFlow.workflowContent,
    docRoot: editorFlow?.docRoot ?? persistedFlow.docRoot,
    docs,
    nodes: (persistedFlow.nodes ?? []).map((node) => {
      const editorNode = editorNodes.get(node.id);
      return editorNode ? { ...node, data: { ...node.data, ...documentDataPatch(editorNode) } } : node;
    })
  };
}
function withoutTopologyData(data = {}) {
  const next = { ...data };
  for (const key of [...TOPOLOGY_DATA_KEYS, "kind", "docPath", "language"]) delete next[key];
  return next;
}

// src/client/graph-canvas.js
var import_react = __toESM(require("react"), 1);

// src/client/graph-model.js
function branchDisplayLabel(branch, copy) {
  return copy?.branchLabel?.[branch] ?? String(branch ?? "");
}
function flowToCanvasNodes(flow, positionOverrides) {
  return (flow?.nodes ?? []).map((node) => ({
    id: node.id,
    type: "flow",
    position: positionOverrides?.[node.id] ?? node.position ?? { x: 120, y: 80 },
    data: {
      ...node.data,
      kind: node.kind,
      ...node.kind === "condition" ? { gateType: conditionGateType(node, (flow?.edges ?? []).filter((edge) => edge.source === node.id)) } : {},
      docPath: flow?.docs?.[node.id] ?? ""
    }
  }));
}
function flowToCanvasEdges(edges, copy) {
  return (edges ?? []).map((edge) => {
    const branch = gateBranchForEdge(edge);
    const generatedLabel = !edge.label && branch ? branchDisplayLabel(branch, copy) : null;
    return {
      ...edge,
      type: "workflow",
      ...edge.label ? { label: edge.label } : {},
      ...generatedLabel ? { label: generatedLabel, autoLogicLabel: true } : {}
    };
  });
}
function serializeFlow(currentFlow, nodes, edges) {
  const serializedNodes = nodes.map((node) => ({
    id: node.id,
    kind: node.data.kind ?? "agent",
    position: node.position,
    data: Object.fromEntries(Object.entries(node.data).filter(([key]) => key !== "kind" && key !== "docPath" && key !== "language"))
  }));
  return {
    ...currentFlow,
    nodes: serializedNodes,
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...!edge.autoLogicLabel && edge.label ? { label: edge.label } : {},
      ...edge.sourceHandle === null || edge.sourceHandle === void 0 ? {} : { sourceHandle: edge.sourceHandle },
      ...edge.targetHandle === null || edge.targetHandle === void 0 ? {} : { targetHandle: edge.targetHandle }
    })),
    inputs: serializedNodes.filter((node) => node.kind === "input").map((node) => node.id),
    outputs: serializedNodes.filter((node) => node.kind === "output").map((node) => node.id)
  };
}
function connectionProblem(nodes, edges, connection, branch = null) {
  if (!connection?.source || !connection?.target) return { valid: false, code: "invalidConnection" };
  if (connection.source === connection.target) return { valid: false, code: "invalidConnection" };
  if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target && edge.id !== connection.edgeId)) {
    return { valid: false, code: "duplicateConnection" };
  }
  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) return { valid: false, code: "invalidConnection" };
  if (sourceNode.data?.kind !== "condition") return { valid: true, code: "ok" };
  const outgoing = edges.filter((edge) => edge.source === connection.source);
  const gateType = conditionGateType(sourceNode, outgoing);
  const available = availableGateBranches(gateType, outgoing, connection.edgeId ?? null);
  if (branch === null || branch === void 0) {
    if (available.length > 0) return { valid: true, code: "ok", gateType, available };
    return { valid: false, code: gateType === "ifElse" ? "ifElseFull" : "notFull", gateType, available };
  }
  const result = validateGateBranch(gateType, outgoing, branch, connection.edgeId ?? null);
  return result.valid ? { ...result, available } : result;
}
function connectionProblemMessage(problem, copy) {
  if (!problem || problem.valid) return "";
  if (problem.code === "duplicateConnection") return copy.duplicateConnection;
  if (problem.code === "ifElseFull") return copy.ifElseFull;
  if (problem.code === "gateLimit" || problem.code === "notFull") return copy.notFull;
  if (problem.code === "branchUsed") return copy.branchUsed;
  if (problem.code === "logicMismatch") return copy.gateMismatch;
  return copy.invalidConnection;
}
function graphSnapshot(nodes, edges) {
  return JSON.parse(JSON.stringify({ nodes, edges }));
}
function reconnectFlowEdge(oldEdge, connection, edges) {
  return edges.map((edge) => edge.id === oldEdge.id ? {
    ...edge,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? null,
    targetHandle: connection.targetHandle ?? null
  } : edge);
}
function layoutNodes(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source).push(edge.target);
  }
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const level = new Map(queue.map((id) => [id, 0]));
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      level.set(next, Math.max(level.get(next) ?? 0, (level.get(id) ?? 0) + 1));
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  nodes.forEach((node, index) => {
    if (!level.has(node.id)) level.set(node.id, Math.max(0, order.length ? Math.max(...level.values()) + 1 : index));
  });
  const rows = /* @__PURE__ */ new Map();
  return nodes.map((node) => {
    const column = level.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { ...node, position: { x: 70 + column * 245, y: 90 + row * 160 } };
  });
}

// src/client/graph-canvas.js
function FlowNode({ data, selected, copy }) {
  const kind = data.kind ?? "agent";
  const kindLabel = kind === "condition" ? `${copy.nodeKind[kind]} \xB7 ${copy.gateType[normalizeGateType(data.gateType)]}` : copy.nodeKind[kind] ?? kind;
  const children = [
    import_react.default.createElement("div", { className: "df-node__kind" }, kindLabel),
    import_react.default.createElement("div", { className: "df-node__label" }, String(data.label ?? kind)),
    data.prompt || data.instructions ? import_react.default.createElement("div", { className: "df-node__prompt" }, String(data.prompt ?? data.instructions)) : null,
    data.docPath ? import_react.default.createElement("div", { className: "df-node__file" }, String(data.docPath)) : null
  ];
  return import_react.default.createElement("div", { className: `df-node df-node--${kind}${selected ? " is-selected" : ""}` }, children);
}
var GRAPH_NODE_WIDTH = 208;
var GRAPH_NODE_HEIGHT = 116;
var GRAPH_MIN_ZOOM = 0.5;
var GRAPH_MAX_ZOOM = 2.5;
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
function connectionTargetAt(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  return element?.closest?.("[data-df-connect-target-id]")?.getAttribute("data-df-connect-target-id") ?? null;
}
function graphEdgeGeometry(edge, byId) {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  const start = { x: source.position.x + GRAPH_NODE_WIDTH, y: source.position.y + GRAPH_NODE_HEIGHT / 2 };
  const end = { x: target.position.x, y: target.position.y + GRAPH_NODE_HEIGHT / 2 };
  const forward = Math.max(54, Math.abs(end.x - start.x) * 0.46);
  const bend = end.x >= start.x ? forward : Math.max(90, forward * 0.7);
  return {
    start,
    end,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    path: `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`
  };
}
function GraphCanvas({
  nodes,
  edges,
  copy,
  selectedNode,
  selectedEdge,
  onInit,
  onNodeDragStart,
  onNodeMove,
  onNodeSelect,
  onEdgeSelect,
  onPaneClick,
  onConnect,
  onConnectionRejected,
  isValidConnection,
  fitLabel,
  zoomInLabel,
  zoomOutLabel
}) {
  const rootRef = import_react.default.useRef(null);
  const cleanupRef = import_react.default.useRef(null);
  const viewportRef = import_react.default.useRef({ x: 32, y: 32, zoom: 0.8 });
  const viewportAnimationRef = import_react.default.useRef(null);
  const markerIdRef = import_react.default.useRef(`df-arrow-${Math.random().toString(36).slice(2, 10)}`);
  const [viewport, setViewport] = (0, import_react.useState)({ x: 32, y: 32, zoom: 0.8 });
  const [panning, setPanning] = (0, import_react.useState)(false);
  const [draggingNode, setDraggingNode] = (0, import_react.useState)(null);
  const [connectionDraft, setConnectionDraft] = (0, import_react.useState)(null);
  const byId = (0, import_react.useMemo)(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const updateViewport = (0, import_react.useCallback)((value) => {
    setViewport((current) => {
      const next = typeof value === "function" ? value(current) : value;
      viewportRef.current = next;
      return next;
    });
  }, []);
  const cancelViewportAnimation = (0, import_react.useCallback)(() => {
    const active = viewportAnimationRef.current;
    if (!active) return;
    cancelAnimationFrame(active.frame);
    viewportAnimationRef.current = null;
  }, []);
  const animateViewport = (0, import_react.useCallback)((target, duration = 0) => {
    cancelViewportAnimation();
    const milliseconds = Math.max(0, Number(duration) || 0);
    if (milliseconds === 0) {
      updateViewport(target);
      return;
    }
    const start = viewportRef.current;
    const startedAt = performance.now();
    const active = { frame: 0 };
    viewportAnimationRef.current = active;
    const tick = (now) => {
      if (viewportAnimationRef.current !== active) return;
      const progress = clamp((now - startedAt) / milliseconds, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      updateViewport({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        zoom: start.zoom + (target.zoom - start.zoom) * eased
      });
      if (progress < 1) active.frame = requestAnimationFrame(tick);
      else viewportAnimationRef.current = null;
    };
    active.frame = requestAnimationFrame(tick);
  }, [cancelViewportAnimation, updateViewport]);
  const stopGesture = (0, import_react.useCallback)(() => {
    cancelViewportAnimation();
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPanning(false);
    setDraggingNode(null);
  }, [cancelViewportAnimation]);
  (0, import_react.useEffect)(() => stopGesture, [stopGesture]);
  const fitView = (0, import_react.useCallback)((options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const requestedIds = new Set((options.nodes ?? []).map((node) => typeof node === "string" ? node : node?.id).filter(Boolean));
    const visibleNodes = requestedIds.size > 0 ? nodes.filter((node) => requestedIds.has(node.id)) : nodes;
    if (visibleNodes.length === 0) return;
    const minX = Math.min(...visibleNodes.map((node) => node.position.x));
    const minY = Math.min(...visibleNodes.map((node) => node.position.y));
    const maxX = Math.max(...visibleNodes.map((node) => node.position.x + GRAPH_NODE_WIDTH));
    const maxY = Math.max(...visibleNodes.map((node) => node.position.y + GRAPH_NODE_HEIGHT));
    const paddingRatio = Number(options.padding ?? 0.16);
    const padding = Math.max(36, Math.min(rect.width, rect.height) * paddingRatio);
    const minZoom = Number(options.minZoom ?? GRAPH_MIN_ZOOM);
    const maxZoom = Number(options.maxZoom ?? 1.15);
    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);
    const zoom = clamp(Math.min((rect.width - padding * 2) / graphWidth, (rect.height - padding * 2) / graphHeight), minZoom, maxZoom);
    animateViewport({
      x: (rect.width - graphWidth * zoom) / 2 - minX * zoom,
      y: (rect.height - graphHeight * zoom) / 2 - minY * zoom,
      zoom
    }, options.duration);
  }, [animateViewport, nodes]);
  const focusNode = (0, import_react.useCallback)((id, options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const node = nodes.find((candidate) => candidate.id === id);
    if (!rect || !node) return;
    const zoom = clamp(Number(options.zoom ?? Math.max(viewportRef.current.zoom, 0.96)), GRAPH_MIN_ZOOM, 1.15);
    animateViewport({
      x: rect.width / 2 - (node.position.x + GRAPH_NODE_WIDTH / 2) * zoom,
      y: rect.height / 2 - (node.position.y + GRAPH_NODE_HEIGHT / 2) * zoom,
      zoom
    }, options.duration ?? 720);
  }, [animateViewport, nodes]);
  (0, import_react.useEffect)(() => {
    onInit?.({ fitView, focusNode });
  }, [fitView, focusNode, onInit]);
  const screenToWorld = (0, import_react.useCallback)((clientX, clientY) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom
    };
  }, [viewport]);
  const zoomAtCenter = (0, import_react.useCallback)((factor) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    cancelViewportAnimation();
    updateViewport((current) => {
      const zoom = clamp(current.zoom * factor, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      return {
        x: centerX - (centerX - current.x) * (zoom / current.zoom),
        y: centerY - (centerY - current.y) * (zoom / current.zoom),
        zoom
      };
    });
  }, [cancelViewportAnimation, updateViewport]);
  const beginPan = (0, import_react.useCallback)((event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__node,.df-graph__controls")) return;
    event.preventDefault();
    onPaneClick?.();
    stopGesture();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewport;
    setPanning(true);
    const move = (next) => setViewport({ ...origin, x: origin.x + next.clientX - startX, y: origin.y + next.clientY - startY });
    const up = () => stopGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onPaneClick, stopGesture, viewport]);
  const beginNodeDrag = (0, import_react.useCallback)((node, event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__handle")) return;
    event.preventDefault();
    event.stopPropagation();
    stopGesture();
    onNodeSelect?.(node.id);
    onNodeDragStart?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = node.position;
    setDraggingNode(node.id);
    const move = (next) => onNodeMove?.(node.id, {
      x: origin.x + (next.clientX - startX) / viewport.zoom,
      y: origin.y + (next.clientY - startY) / viewport.zoom
    });
    const up = () => stopGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onNodeDragStart, onNodeMove, onNodeSelect, stopGesture, viewport.zoom]);
  const beginConnection = (0, import_react.useCallback)((source, event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopGesture();
    const sourceNode = byId.get(source);
    if (!sourceNode) return;
    const start = { x: sourceNode.position.x + GRAPH_NODE_WIDTH, y: sourceNode.position.y + GRAPH_NODE_HEIGHT / 2 };
    setConnectionDraft({ source, start, end: start, hoverTarget: null });
    const move = (next) => setConnectionDraft((draft) => draft ? {
      ...draft,
      end: screenToWorld(next.clientX, next.clientY),
      hoverTarget: connectionTargetAt(next.clientX, next.clientY)
    } : null);
    const up = (next) => {
      const target = connectionTargetAt(next.clientX, next.clientY);
      const connection = { source, target, sourceHandle: null, targetHandle: null };
      if (target) {
        if (isValidConnection?.(connection) ?? true) onConnect?.(connection);
        else onConnectionRejected?.(connection);
      }
      setConnectionDraft(null);
      stopGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [byId, isValidConnection, onConnect, onConnectionRejected, screenToWorld, stopGesture]);
  (0, import_react.useEffect)(() => {
    const canvas = rootRef.current;
    if (!canvas) return void 0;
    const onCanvasWheel = (event) => {
      event.preventDefault();
      cancelViewportAnimation();
      const rect = canvas.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        updateViewport((current) => {
          const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 12e-4), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
          return {
            x: cursorX - (cursorX - current.x) * (zoom / current.zoom),
            y: cursorY - (cursorY - current.y) * (zoom / current.zoom),
            zoom
          };
        });
      } else {
        updateViewport((current) => ({
          ...current,
          x: current.x - (Number.isFinite(event.deltaX) ? event.deltaX : 0),
          y: current.y - (Number.isFinite(event.deltaY) ? event.deltaY : 0)
        }));
      }
    };
    canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onCanvasWheel);
  }, [cancelViewportAnimation, updateViewport]);
  const edgeElements = [];
  for (const edge of edges) {
    const geometry = graphEdgeGeometry(edge, byId);
    if (!geometry) continue;
    const selected = selectedEdge === edge.id;
    const displayLabel = edge.autoLogicLabel ? branchDisplayLabel(gateBranchForEdge(edge), copy) : edge.label;
    edgeElements.push(
      import_react.default.createElement(
        "g",
        { key: edge.id, className: "df-graph__edge-group", "data-edge-id": edge.id },
        import_react.default.createElement("path", {
          className: `df-graph__edge${selected ? " is-selected" : ""}`,
          d: geometry.path,
          markerEnd: `url(#${markerIdRef.current})`
        }),
        import_react.default.createElement("path", {
          className: "df-graph__edge-hit",
          d: geometry.path,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.stopPropagation();
            onEdgeSelect?.(edge.id);
          }
        }),
        displayLabel ? import_react.default.createElement(
          "g",
          { transform: `translate(${geometry.label.x} ${geometry.label.y})` },
          import_react.default.createElement("rect", { className: "df-graph__label-bg", x: -18, y: -10, width: 36, height: 20, rx: 7 }),
          import_react.default.createElement("text", { className: "df-graph__label", x: 0, y: 1 }, String(displayLabel))
        ) : null
      )
    );
  }
  if (connectionDraft) {
    const bend = Math.max(54, Math.abs(connectionDraft.end.x - connectionDraft.start.x) * 0.46);
    edgeElements.push(import_react.default.createElement("path", {
      key: "connection-draft",
      className: "df-graph__connection",
      d: `M ${connectionDraft.start.x} ${connectionDraft.start.y} C ${connectionDraft.start.x + bend} ${connectionDraft.start.y}, ${connectionDraft.end.x - bend} ${connectionDraft.end.y}, ${connectionDraft.end.x} ${connectionDraft.end.y}`
    }));
  }
  return import_react.default.createElement(
    "div",
    {
      ref: rootRef,
      className: `df-canvas${panning ? " is-panning" : ""}`,
      onPointerDown: beginPan
    },
    import_react.default.createElement(
      "div",
      {
        className: "df-graph__stage",
        style: { transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})` }
      },
      import_react.default.createElement(
        "svg",
        { className: "df-graph__edges", width: 1, height: 1, "aria-label": "Workflow arrows" },
        import_react.default.createElement(
          "defs",
          null,
          import_react.default.createElement("marker", {
            id: markerIdRef.current,
            markerWidth: 10,
            markerHeight: 10,
            refX: 9,
            refY: 5,
            orient: "auto",
            markerUnits: "strokeWidth",
            viewBox: "0 0 10 10"
          }, import_react.default.createElement("path", { d: "M 0 0 L 10 5 L 0 10 Z", fill: "var(--df-brand)" }))
        ),
        edgeElements
      ),
      nodes.map((node) => import_react.default.createElement(
        "div",
        {
          key: node.id,
          className: `df-graph__node${draggingNode === node.id ? " is-dragging" : ""}${connectionDraft?.hoverTarget === node.id ? " is-connect-target" : ""}`,
          style: { left: `${node.position.x}px`, top: `${node.position.y}px` },
          "data-node-id": node.id,
          "data-df-connect-target-id": node.id,
          onPointerDown: (event) => beginNodeDrag(node, event),
          onClick: (event) => {
            event.stopPropagation();
            onNodeSelect?.(node.id);
          }
        },
        import_react.default.createElement(FlowNode, { data: node.data, selected: selectedNode === node.id, copy }),
        import_react.default.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--target",
          "data-df-target-id": node.id,
          "aria-label": `Connect into ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => event.stopPropagation()
        }),
        import_react.default.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--source",
          "data-df-source-id": node.id,
          "aria-label": `Connect from ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => beginConnection(node.id, event)
        })
      ))
    ),
    import_react.default.createElement(
      "div",
      { className: "df-graph__controls" },
      import_react.default.createElement("button", { type: "button", title: zoomInLabel, "aria-label": zoomInLabel, onClick: () => zoomAtCenter(1.2) }, "+"),
      import_react.default.createElement("button", { type: "button", title: zoomOutLabel, "aria-label": zoomOutLabel, onClick: () => zoomAtCenter(1 / 1.2) }, "\u2212"),
      import_react.default.createElement("button", { type: "button", title: fitLabel, "aria-label": fitLabel, onClick: () => fitView({}) }, "\u2299")
    )
  );
}

// src/client/i18n.js
function localeLanguage(localeService) {
  try {
    const snapshot = localeService?.getLocale?.();
    const active = String(snapshot?.active ?? "");
    if (active) return active.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
  }
  return browserLanguage();
}
function browserLanguage() {
  try {
    return String(navigator.language ?? "en").toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}
function text(language) {
  return language === "zh" ? {
    view: "DeepSeek Flow",
    studio: "\u6D41\u7A0B\u8BBE\u8BA1",
    editorOnly: "\u4EC5\u7F16\u8F91",
    editorOnlyNote: "\u6267\u884C\u8BF7\u56DE\u5230\u5F53\u524D Session",
    ready: "\u5C31\u7EEA",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    saved: "\u5DF2\u4FDD\u5B58",
    autoSaving: "\u6B63\u5728\u540C\u6B65 Markdown\u2026",
    autoSaved: "Markdown \u5DF2\u5199\u5165",
    createFailed: "\u65B0\u5EFA\u5931\u8D25\uFF1A",
    newFlow: "\u65B0\u5EFA",
    shared: "\u5171\u4EAB",
    importLabel: "\u5BFC\u5165 JSON",
    exportLabel: "\u5BFC\u51FA JSON",
    save: "\u4FDD\u5B58",
    topologyApply: "\u5E94\u7528\u4FEE\u6539",
    topologyApplyTitle: "\u5E94\u7528\u8FD9\u6B21\u62D3\u6251\u4FEE\u6539\uFF1F",
    topologyApplyWarning: "\u6D41\u7A0B\u6846\u3001\u903B\u8F91\u95E8\u548C\u7BAD\u5934\u4F1A\u5148\u7ECF\u8FC7\u786E\u5B9A\u6027\u6821\u9A8C\uFF0C\u518D\u4EA4\u7ED9\u5F53\u524D\u4E3B Session \u7ED1\u5B9A\u7684 Agent \u5BA1\u67E5\u5E76\u5728\u5FC5\u8981\u65F6\u91CD\u6784\uFF1B\u5168\u90E8\u901A\u8FC7\u540E\u624D\u539F\u5B50\u4FDD\u5B58\u3002Agent \u4E0D\u4F1A\u6539\u5199\u73B0\u6709 Markdown \u6B63\u6587\uFF0C\u7CFB\u7EDF\u751F\u6210\u7684\u62D3\u6251\u7D22\u5F15\u4F1A\u968F\u7ED3\u6784\u540C\u6B65\u3002",
    topologyApplyConfirm: "\u786E\u8BA4\u5E76\u4EA4\u7ED9\u4E3B Session",
    topologyPending: "\u8BF7\u5148\u4FDD\u5B58\u5DE5\u4F5C\u6D41\uFF08\u62D3\u6251\u4FEE\u6539\u5C1A\u672A\u5E94\u7528\uFF09",
    topologyApplying: "\u4E3B Session \u6821\u9A8C\u91CD\u6784\u4E2D\u2026",
    topologyApplied: "\u62D3\u6251\u4FEE\u6539\u5DF2\u6821\u9A8C\u5E76\u5E94\u7528",
    topologyAppliedWithNewDraft: "\u5DF2\u5E94\u7528\u63D0\u4EA4\u65F6\u7684\u62D3\u6251\uFF1B\u5BA1\u67E5\u671F\u95F4\u4EA7\u751F\u7684\u65B0\u4FEE\u6539\u4ECD\u662F\u5F85\u5E94\u7528\u8349\u7A3F",
    topologyApplyFailed: "\u62D3\u6251\u672A\u5199\u5165\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF1A",
    topologyApplyFirst: "\u8BF7\u5148\u5E94\u7528\u65B0\u5DE5\u4F5C\u6D41\u62D3\u6251\uFF0C\u518D\u4FDD\u5B58\u5176 Markdown",
    topologyNoChanges: "\u6CA1\u6709\u9700\u8981\u5E94\u7528\u7684\u62D3\u6251\u4FEE\u6539",
    topologyAlreadyPersisted: "\u4E3B Session \u5DF2\u4FDD\u5B58\u76F8\u540C\u62D3\u6251\uFF0C\u753B\u5E03\u5DF2\u76F4\u63A5\u540C\u6B65\uFF0C\u65E0\u9700\u518D\u6B21\u5BA1\u6838",
    topologySessionSynced: "\u5DF2\u540C\u6B65\u4E3B Session \u4FDD\u5B58\u7684\u6700\u65B0\u62D3\u6251",
    topologySessionConflict: "\u4E3B Session \u548C\u753B\u5E03\u90FD\u6709\u65B0\u7684\u62D3\u6251\u4FEE\u6539\uFF1B\u5DF2\u4FDD\u7559\u753B\u5E03\u8349\u7A3F\uFF0C\u8BF7\u5148\u5408\u5E76\u540E\u518D\u5E94\u7528",
    hiddenFinalizeApplying: "\u6B63\u5728\u76F4\u63A5\u5B9A\u7A3F\u5916\u90E8\u6587\u4EF6\u4FEE\u6539\u2026",
    hiddenFinalizeApplied: "\u5916\u90E8\u6587\u4EF6\u4FEE\u6539\u5DF2\u76F4\u63A5\u5B9A\u7A3F\uFF0C\u65E0\u9700\u518D\u6B21\u4EA4\u7ED9\u4E3B Session",
    hiddenFinalizeFailed: "\u81EA\u52A8\u5B9A\u7A3F\u672A\u5B8C\u6210\uFF0C\u5DF2\u4FDD\u7559\u666E\u901A\u5E94\u7528\u6D41\u7A0B\uFF1A",
    topologyNodes: "\u6D41\u7A0B\u6846",
    topologyEdges: "\u7BAD\u5934",
    undo: "\u64A4\u9500",
    redo: "\u91CD\u505A",
    tidy: "\u4E00\u952E\u6574\u7406",
    flow: "\u5DE5\u4F5C\u6D41",
    documents: "\u5DE5\u4F5C\u6D41\u6587\u6863",
    workflowDoc: "\u603B\u63A7\u6D41\u7A0B",
    stepDocs: "\u5206\u6B65\u5DE5\u4F5C\u533A",
    openDocument: "\u9009\u62E9\u4E00\u4E2A Markdown \u6587\u4EF6\u8FDB\u884C\u7F16\u8F91",
    markdownContent: "Markdown \u5185\u5BB9",
    docRoot: "\u6587\u6863\u5DE5\u4F5C\u533A",
    workspace: "\u6B65\u9AA4\u5DE5\u4F5C\u533A",
    filePath: "\u6587\u4EF6",
    documentFirst: "\u6587\u6863\u4F18\u5148",
    documentFirstNote: "\u5148\u8BFB WORKFLOW.md\uFF0C\u518D\u6309\u987A\u5E8F\u6267\u884C\u6BCF\u4E2A STEP.md",
    collapseDocs: "\u6536\u8D77\u5DE5\u4F5C\u6D41\u6587\u6863",
    expandDocs: "\u5C55\u5F00\u5DE5\u4F5C\u6D41\u6587\u6863",
    resizeDocs: "\u62D6\u52A8\u8C03\u6574\u6587\u6863\u680F\u5BBD\u5EA6\uFF1B\u53CC\u51FB\u6536\u8D77\u6216\u5C55\u5F00",
    collapseEditor: "\u6536\u8D77 Markdown \u7F16\u8F91\u5668",
    expandEditor: "\u5C55\u5F00 Markdown \u7F16\u8F91\u5668",
    resizeEditor: "\u62D6\u52A8\u8C03\u6574\u7F16\u8F91\u5668\u5BBD\u5EA6\uFF1B\u53CC\u51FB\u6536\u8D77\u6216\u5C55\u5F00",
    resizeAssistant: "\u62D6\u52A8\u8C03\u6574\u52A9\u624B\u9AD8\u5EA6\uFF1B\u53CC\u51FB\u6536\u8D77\u6216\u5C55\u5F00",
    fitAll: "\u663E\u793A\u5168\u56FE",
    zoomIn: "\u653E\u5927",
    zoomOut: "\u7F29\u5C0F",
    addNode: "\u65B0\u5EFA\u6D41\u7A0B\u6846",
    connectHint: "\u8FDB\u5165\u6761\u4EF6\u6846\u7684\u7BAD\u5934\u63D0\u4F9B\u771F\u503C\u8F93\u5165\uFF1B\u6761\u4EF6\u8F93\u51FA\u7BAD\u5934\u4F20\u64AD\u95E8\u7ED3\u679C",
    nodeKind: {
      input: "\u8F93\u5165",
      agent: "Agent",
      mapAgent: "Map Agent",
      condition: "\u6761\u4EF6",
      merge: "\u5408\u5E76",
      output: "\u8F93\u51FA"
    },
    properties: "\u8282\u70B9\u5C5E\u6027",
    prompt: "\u63D0\u793A\u8BCD",
    stage: "\u9636\u6BB5",
    predicate: "\u9ED8\u8BA4\u8F93\u5165\u8C13\u8BCD",
    logicInputs: "\u903B\u8F91\u8F93\u5165\u4E0E\u8C13\u8BCD",
    logicInputsEmpty: "\u5C1A\u672A\u8FDE\u63A5\u8F93\u5165\uFF1B\u7EC4\u5408\u95E8\u81F3\u5C11\u9700\u8981\u4E24\u4E2A\u8F93\u5165\uFF0CIF/ELSE \u4E0E NOT \u9700\u8981\u4E00\u4E2A\u3002",
    logicInputCount: "\u5F53\u524D\u8F93\u5165",
    logicInputUnary: "\u8981\u6C42\u6070\u597D 1 \u4E2A",
    logicInputAggregate: "\u8981\u6C42\u81F3\u5C11 2 \u4E2A",
    gateTypeLabel: "\u903B\u8F91\u95E8\u7C7B\u578B",
    gateType: {
      ifElse: "\u662F / \u5426\uFF08IF / ELSE\uFF09",
      and: "\u4E0E\u95E8\uFF08AND\uFF09",
      or: "\u6216\u95E8\uFF08OR\uFF09",
      not: "\u975E\u95E8\uFF08NOT\uFF09",
      nand: "\u4E0E\u975E\u95E8\uFF08NAND\uFF09",
      nor: "\u6216\u975E\u95E8\uFF08NOR\uFF09",
      xor: "\u5F02\u6216\u95E8\uFF08XOR\uFF09",
      xnor: "\u540C\u6216\u95E8\uFF08XNOR\uFF09"
    },
    gateDescription: {
      ifElse: "\u4E00\u4E2A\u8F93\u5165\uFF1B\u6309\u771F\u503C\u9009\u62E9\u201C\u662F\u201D\u6216\u201C\u5426\u201D\u5206\u652F",
      and: "\u81F3\u5C11\u4E24\u4E2A\u8F93\u5165\uFF1B\u5168\u90E8\u4E3A\u771F\u624D\u5411\u76EE\u6807\u4F20\u64AD\u771F\u503C",
      or: "\u81F3\u5C11\u4E24\u4E2A\u8F93\u5165\uFF1B\u4EFB\u4E00\u4E3A\u771F\u5373\u5411\u76EE\u6807\u4F20\u64AD\u771F\u503C",
      not: "\u4E00\u4E2A\u8F93\u5165\uFF1B\u53D6\u53CD\u540E\u6CBF\u552F\u4E00\u8F93\u51FA\u4F20\u64AD",
      nand: "\u81F3\u5C11\u4E24\u4E2A\u8F93\u5165\uFF1BAND \u7ED3\u679C\u53D6\u53CD\u540E\u4F20\u64AD",
      nor: "\u81F3\u5C11\u4E24\u4E2A\u8F93\u5165\uFF1BOR \u7ED3\u679C\u53D6\u53CD\u540E\u4F20\u64AD",
      xor: "\u81F3\u5C11\u4E24\u4E2A\u8F93\u5165\uFF1B\u771F\u503C\u4E2A\u6570\u4E3A\u5947\u6570\u65F6\u7ED3\u679C\u4E3A\u771F",
      xnor: "\u81F3\u5C11\u4E24\u4E2A\u8F93\u5165\uFF1B\u771F\u503C\u4E2A\u6570\u4E3A\u5076\u6570\u65F6\u7ED3\u679C\u4E3A\u771F"
    },
    chooseGateTitle: "\u9009\u62E9\u6761\u4EF6\u6846\u7684\u903B\u8F91\u95E8",
    chooseGateIntro: "\u95E8\u4F1A\u8BA1\u7B97\u6240\u6709\u5165\u8FB9\u7684\u5E03\u5C14\u503C\u5E76\u4F20\u64AD\u771F\u5B9E\u7ED3\u679C\uFF0C\u4E0D\u53EA\u662F\u663E\u793A\u7BAD\u5934\u6807\u7B7E\u3002\u521B\u5EFA\u540E\u4ECD\u53EF\u5728\u6CA1\u6709\u51FA\u7EBF\u65F6\u4FEE\u6539\u3002",
    chooseBranchTitle: "\u9009\u62E9\u5224\u65AD\u5206\u652F",
    chooseBranchIntro: "\u201C\u662F\u201D\u548C\u201C\u5426\u201D\u5404\u53EA\u80FD\u8FDE\u63A5\u4E00\u4E2A\u76EE\u6807\u3002",
    connectionWarningTitle: "\u65E0\u6CD5\u521B\u5EFA\u7BAD\u5934",
    branchLabel: {
      true: "\u662F",
      false: "\u5426",
      and: "\u4E0E",
      or: "\u6216",
      not: "\u975E",
      nand: "\u4E0E\u975E",
      nor: "\u6216\u975E",
      xor: "\u5F02\u6216",
      xnor: "\u540C\u6216"
    },
    cancel: "\u53D6\u6D88",
    dismiss: "\u77E5\u9053\u4E86",
    duplicateConnection: "\u8FD9\u4E24\u4E2A\u6D41\u7A0B\u6846\u4E4B\u95F4\u5DF2\u7ECF\u5B58\u5728\u7BAD\u5934\uFF0C\u4E0D\u80FD\u91CD\u590D\u8FDE\u63A5\u3002",
    ifElseFull: "\u8FD9\u4E2A\u662F/\u5426\u6761\u4EF6\u5DF2\u7ECF\u6709\u4E24\u6761\u5206\u652F\uFF0C\u4E0D\u80FD\u518D\u62C9\u51FA\u7B2C\u4E09\u6761\u7BAD\u5934\u3002",
    notFull: "\u975E\u95E8\u53EA\u5141\u8BB8\u4E00\u6761\u51FA\u7EBF\uFF0C\u4E0D\u80FD\u518D\u521B\u5EFA\u7BAD\u5934\u3002",
    branchUsed: "\u8FD9\u4E2A\u5206\u652F\u5DF2\u7ECF\u8FDE\u63A5\u8FC7\u76EE\u6807\uFF1B\u201C\u662F\u201D\u548C\u201C\u5426\u201D\u5404\u53EA\u80FD\u4F7F\u7528\u4E00\u6B21\u3002",
    gateMismatch: "\u7BAD\u5934\u903B\u8F91\u4E0E\u5F53\u524D\u95E8\u7C7B\u578B\u4E0D\u5339\u914D\u3002",
    gateChangeBlocked: "\u8BE5\u6761\u4EF6\u6846\u5DF2\u6709\u51FA\u7EBF\u3002\u8BF7\u5148\u5220\u9664\u8FD9\u4E9B\u7BAD\u5934\uFF0C\u518D\u4FEE\u6539\u903B\u8F91\u95E8\u7C7B\u578B\u3002",
    invalidConnection: "\u8FD9\u6761\u7BAD\u5934\u4E0D\u7B26\u5408\u5F53\u524D\u6761\u4EF6\u95E8\u89C4\u5219\u3002",
    model: "\u6A21\u578B",
    provider: "Provider",
    outputSchema: "\u8F93\u51FA Schema (JSON)",
    none: "\u65E0",
    noFlow: "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u6D41\uFF1A\u8BF7\u8BA9 Agent \u521B\u5EFA\uFF0C\u6216\u5BFC\u5165 JSON",
    importFailed: "\u5BFC\u5165\u5931\u8D25\uFF1A",
    invalidJson: "JSON \u65E0\u6548\uFF1A",
    importOk: "\u5DF2\u5BFC\u5165\uFF1A",
    deleteNode: "\u5220\u9664\u8282\u70B9",
    exportOk: "\u5DF2\u5BFC\u51FA",
    docFile: "\u6587\u6863\u6587\u4EF6\uFF08\u76F8\u5BF9 docRoot\uFF09",
    docSyncNote: "\u63D0\u793A\u8BCD\u5C06\u540C\u6B65\u5199\u56DE\uFF1A",
    advancedHints: "Session \u63D0\u793A\uFF08\u9AD8\u7EA7\uFF09",
    assistant: "AI \u6587\u6863\u52A9\u624B",
    assistModelLabel: "AI \u52A9\u624B\u4F7F\u7528\u6A21\u578B",
    assistModelFollow: "\u8DDF\u968F\u4F1A\u8BDD",
    assistEffortLabel: "\u601D\u8003\u5F3A\u5EA6",
    assistEffortFollow: "\u8DDF\u968F\u4F1A\u8BDD",
    assistEffortOff: "off",
    assistEffortHigh: "high",
    assistEffortMax: "max",
    assistantSafe: "",
    assistantTarget: "\u5F53\u524D\u6587\u6863",
    assistantInstruction: "AI \u4F18\u5316\u8981\u6C42\uFF08\u53EF\u9009\uFF09",
    assistantInstructionHint: "\u4F8B\u5982\uFF1A\u66F4\u5F3A\u8C03\u622A\u56FE\u8D28\u68C0\u3001\u5931\u8D25\u56DE\u9000\u548C\u4EA4\u4ED8\u6587\u4EF6",
    aiOptimize: "AI \u4F18\u5316\u5F53\u524D\u6587\u6863",
    aiOptimizeWorkflow: "AI \u4F18\u5316\u6574\u4E2A\u5DE5\u4F5C\u6D41",
    logicValidation: "\u903B\u8F91\u6821\u9A8C",
    cancelValidation: "\u53D6\u6D88\u6821\u9A8C",
    cancelDocOptimize: "\u53D6\u6D88\u4F18\u5316",
    cancelWorkflowOptimize: "\u53D6\u6D88\u5DE5\u4F5C\u6D41\u4F18\u5316",
    cancelConfirmLogic: "AI \u6821\u9A8C\u4E2D\uFF0C\u786E\u8BA4\u53D6\u6D88\u5417\uFF1F",
    cancelConfirmDoc: "AI \u4F18\u5316\u4E2D\uFF0C\u786E\u8BA4\u53D6\u6D88\u5417\uFF1F",
    cancelConfirmWorkflow: "AI \u5DE5\u4F5C\u6D41\u4F18\u5316\u4E2D\uFF0C\u786E\u8BA4\u53D6\u6D88\u5417\uFF1F",
    confirmCancel: "\u786E\u8BA4\u53D6\u6D88",
    waitMore: "\u518D\u7B49\u7B49",
    assistantCancelled: "\u5DF2\u8BF7\u6C42\u53D6\u6D88 Agent \u64CD\u4F5C",
    acceptSuggestion: "\u63A5\u53D7\u4FEE\u6539",
    discardSuggestion: "\u62D2\u7EDD\u4FEE\u6539",
    acceptedSuggestion: "\u4F18\u5316\u65B9\u6848\u5DF2\u63A5\u53D7\u5E76\u540C\u6B65",
    discardedSuggestion: "\u5DF2\u62D2\u7EDD\u65B9\u6848\uFF0C\u539F\u59CB\u6587\u6863\u672A\u6539\u53D8",
    staleSuggestion: "\u539F\u6587\u5728\u65B9\u6848\u751F\u6210\u540E\u5DF2\u53D8\u5316\uFF0C\u8BF7\u62D2\u7EDD\u5E76\u91CD\u65B0\u4F18\u5316",
    suggestionPreview: "\u5B8C\u6574 Markdown \u4FEE\u6539\u65B9\u6848",
    proposalPending: "\u5F85\u52A0\u8F7D",
    proposalDecision: "\u63A5\u53D7\u6216\u62D2\u7EDD\u4FEE\u6539",
    workflowOptimizeTitle: "\u786E\u8BA4\u4F18\u5316\u6574\u4E2A\u5DE5\u4F5C\u6D41\uFF1F",
    workflowOptimizeWarning: "\u8BE5\u64CD\u4F5C\u4F1A\u8BA9 Agent \u76F4\u63A5\u6539\u5199 WORKFLOW.md \u548C\u5168\u90E8 STEP.md\uFF0C\u5E76\u7ACB\u5373\u4FDD\u5B58\uFF0C\u4E0D\u63D0\u4F9B\u9010\u4EFD\u63A5\u53D7\u6216\u64A4\u9500\u3002\u8BF7\u786E\u8BA4\u5DF2\u7ECF\u5907\u4EFD\u91CD\u8981\u5185\u5BB9\u3002",
    workflowOptimizeConfirm: "\u786E\u8BA4\u5E76\u76F4\u63A5\u4F18\u5316",
    workflowOptimizeCancel: "\u53D6\u6D88",
    workflowOptimized: "\u6574\u4E2A\u5DE5\u4F5C\u6D41\u5DF2\u7531 Agent \u4F18\u5316\u5E76\u4FDD\u5B58",
    workflowChangedDuringOptimization: "\u4F18\u5316\u671F\u95F4\u6587\u6863\u5DF2\u53D8\u5316\uFF0C\u4E3A\u9632\u6B62\u8986\u76D6\u65B0\u5185\u5BB9\uFF0C\u672C\u6B21\u7ED3\u679C\u672A\u5199\u5165",
    noFindings: "\u672A\u53D1\u73B0\u9519\u8BEF\u6216\u8B66\u544A",
    issues: "\u9879\u6821\u9A8C\u7ED3\u679C",
    validationIdle: "\u70B9\u51FB\u201C\u903B\u8F91\u6821\u9A8C\u201D\u626B\u63CF WORKFLOW.md \u4E0E\u5168\u90E8 STEP.md",
    validationComplete: "Agent \u903B\u8F91\u6821\u9A8C\u5B8C\u6210",
    proposalIdle: "\u9009\u62E9\u4E00\u4E2A\u6587\u6863\uFF0C\u7136\u540E\u624B\u52A8\u70B9\u51FB\u201CAI \u4F18\u5316\u5F53\u524D\u6587\u6863\u201D",
    expandAssistant: "\u5C55\u5F00 AI \u6587\u6863\u52A9\u624B",
    collapseAssistant: "\u6536\u8D77 AI \u6587\u6863\u52A9\u624B",
    assistantFailed: "\u64CD\u4F5C\u5931\u8D25\uFF1A",
    edgeSelected: "\u5DF2\u9009\u62E9\u7BAD\u5934\uFF0C\u6309 Delete \u5220\u9664"
  } : {
    view: "DeepSeek Flow",
    studio: "Flow editor",
    editorOnly: "Edit only",
    editorOnlyNote: "Run from the current Session",
    ready: "Ready",
    saving: "Saving\u2026",
    saved: "Saved",
    autoSaving: "Syncing Markdown\u2026",
    autoSaved: "Markdown written",
    createFailed: "Create failed: ",
    newFlow: "New",
    shared: "Shared",
    importLabel: "Import JSON",
    exportLabel: "Export JSON",
    save: "Save",
    topologyApply: "Apply changes",
    topologyApplyTitle: "Apply these topology changes?",
    topologyApplyWarning: "Boxes, logic gates, and arrows will pass deterministic validation, then a current-main-Session-bound Agent will review and rebuild them only when necessary. The result is saved atomically only after all checks pass. The Agent never rewrites existing Markdown prose; generated topology indexes update with the structure.",
    topologyApplyConfirm: "Confirm with main Session",
    topologyPending: "Please save the workflow first (topology changes pending)",
    topologyApplying: "Main Session is reviewing topology\u2026",
    topologyApplied: "Topology changes validated and applied",
    topologyAppliedWithNewDraft: "The submitted topology was applied; newer edits made during review remain a pending draft",
    topologyApplyFailed: "Topology was not written; the draft is preserved: ",
    topologyApplyFirst: "Apply the new workflow topology before saving its Markdown",
    topologyNoChanges: "No topology changes to apply",
    topologyAlreadyPersisted: "The main Session already saved this topology; Studio synced it without another review",
    topologySessionSynced: "Synced the latest topology saved by the main Session",
    topologySessionConflict: "The main Session and canvas both changed topology; the canvas draft was preserved for merging",
    hiddenFinalizeApplying: "Finalizing external file changes directly\u2026",
    hiddenFinalizeApplied: "External file changes were finalized without another main-Session review",
    hiddenFinalizeFailed: "Automatic finalize did not complete; the normal Apply flow remains available: ",
    topologyNodes: "Boxes",
    topologyEdges: "Arrows",
    undo: "Undo",
    redo: "Redo",
    tidy: "Auto layout",
    flow: "Flow",
    documents: "Workflow docs",
    workflowDoc: "Master workflow",
    stepDocs: "Step workspaces",
    openDocument: "Select a Markdown file to edit",
    markdownContent: "Markdown content",
    docRoot: "Document workspace",
    workspace: "Step workspace",
    filePath: "File",
    documentFirst: "Docs first",
    documentFirstNote: "Read WORKFLOW.md first, then execute each STEP.md in order",
    collapseDocs: "Collapse workflow documents",
    expandDocs: "Expand workflow documents",
    resizeDocs: "Drag to resize the document rail; double-click to collapse or expand",
    collapseEditor: "Collapse Markdown editor",
    expandEditor: "Expand Markdown editor",
    resizeEditor: "Drag to resize the editor; double-click to collapse or expand",
    resizeAssistant: "Drag to resize the assistant; double-click to collapse or expand",
    fitAll: "Fit all",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    addNode: "New flow box",
    connectHint: "Incoming arrows provide truth inputs; condition outputs propagate the gate result",
    nodeKind: {
      input: "Input",
      agent: "Agent",
      mapAgent: "Map Agent",
      condition: "Condition",
      merge: "Merge",
      output: "Output"
    },
    properties: "Node properties",
    prompt: "Prompt",
    stage: "Stage",
    predicate: "Default input predicate",
    logicInputs: "Logic inputs and predicates",
    logicInputsEmpty: "No input is connected. Aggregate gates need at least two inputs; IF/ELSE and NOT need one.",
    logicInputCount: "Current inputs",
    logicInputUnary: "exactly 1 required",
    logicInputAggregate: "at least 2 required",
    gateTypeLabel: "Logic gate",
    gateType: {
      ifElse: "Yes / No (IF / ELSE)",
      and: "AND gate",
      or: "OR gate",
      not: "NOT gate",
      nand: "NAND gate",
      nor: "NOR gate",
      xor: "XOR gate",
      xnor: "XNOR gate"
    },
    gateDescription: {
      ifElse: "One input; select the Yes or No branch from its truth value",
      and: "Two or more inputs; propagate true only when every input is true",
      or: "Two or more inputs; propagate true when any input is true",
      not: "One input; invert it and propagate through the single output",
      nand: "Two or more inputs; invert the AND result",
      nor: "Two or more inputs; invert the OR result",
      xor: "Two or more inputs; true when an odd number of inputs are true",
      xnor: "Two or more inputs; true when an even number of inputs are true"
    },
    chooseGateTitle: "Choose a logic gate",
    chooseGateIntro: "The gate computes incoming Boolean values and propagates a real result; it is not just an arrow label. You can change it while it has no outgoing arrows.",
    chooseBranchTitle: "Choose a decision branch",
    chooseBranchIntro: "Yes and No can each connect to one target only.",
    connectionWarningTitle: "Cannot create arrow",
    branchLabel: {
      true: "Yes",
      false: "No",
      and: "AND",
      or: "OR",
      not: "NOT",
      nand: "NAND",
      nor: "NOR",
      xor: "XOR",
      xnor: "XNOR"
    },
    cancel: "Cancel",
    dismiss: "Got it",
    duplicateConnection: "An arrow already connects these two boxes.",
    ifElseFull: "This Yes/No condition already has both branches; a third arrow is not allowed.",
    notFull: "A NOT gate allows only one outgoing arrow.",
    branchUsed: "That branch is already connected; Yes and No can each be used once.",
    gateMismatch: "The arrow logic does not match the selected gate.",
    gateChangeBlocked: "This condition already has outgoing arrows. Delete them before changing the logic gate.",
    invalidConnection: "This arrow violates the current condition-gate rules.",
    model: "Model",
    provider: "Provider",
    outputSchema: "Output schema (JSON)",
    none: "None",
    noFlow: "No flow yet: ask the Agent to create one, or import JSON",
    importFailed: "Import failed: ",
    invalidJson: "Invalid JSON: ",
    importOk: "Imported: ",
    deleteNode: "Delete node",
    exportOk: "Exported",
    docFile: "Doc file (relative to docRoot)",
    docSyncNote: "Prompt syncs back to: ",
    advancedHints: "Session hints (advanced)",
    assistant: "AI",
    assistModelLabel: "Model used by the AI assistant",
    assistModelFollow: "Follow session",
    assistEffortLabel: "Reasoning effort",
    assistEffortFollow: "Follow session",
    assistEffortOff: "Off",
    assistEffortHigh: "High",
    assistEffortMax: "Max",
    assistantSafe: "",
    assistantTarget: "Current document",
    assistantInstruction: "AI optimization request (optional)",
    assistantInstructionHint: "For example: emphasize screenshot QA, fallback and deliverables",
    aiOptimize: "AI optimize current doc",
    aiOptimizeWorkflow: "AI optimize entire workflow",
    logicValidation: "Logic validation",
    cancelValidation: "Cancel validation",
    cancelDocOptimize: "Cancel optimization",
    cancelWorkflowOptimize: "Cancel workflow optimization",
    cancelConfirmLogic: "AI validation is in progress. Cancel it?",
    cancelConfirmDoc: "AI optimization is in progress. Cancel it?",
    cancelConfirmWorkflow: "AI workflow optimization is in progress. Cancel it?",
    confirmCancel: "Confirm cancel",
    waitMore: "Not yet",
    assistantCancelled: "Agent cancellation requested",
    acceptSuggestion: "Accept changes",
    discardSuggestion: "Reject changes",
    acceptedSuggestion: "Optimization accepted and syncing",
    discardedSuggestion: "Proposal rejected; original document unchanged",
    staleSuggestion: "The source changed after this proposal; undo and optimize again",
    suggestionPreview: "Full Markdown proposal",
    proposalPending: "Waiting to load",
    proposalDecision: "Accept or reject changes",
    workflowOptimizeTitle: "Optimize the entire workflow?",
    workflowOptimizeWarning: "The Agent will directly rewrite WORKFLOW.md and every STEP.md, then save immediately. There is no per-document acceptance or undo. Back up important content first.",
    workflowOptimizeConfirm: "Confirm and optimize",
    workflowOptimizeCancel: "Cancel",
    workflowOptimized: "The entire workflow was optimized and saved",
    workflowChangedDuringOptimization: "Documents changed during optimization, so the result was not written",
    noFindings: "No errors or warnings found",
    issues: "validation findings",
    validationIdle: "Click Logic validation to scan WORKFLOW.md and every STEP.md",
    validationComplete: "Agent logic validation completed",
    proposalIdle: "Select one document, then manually click AI optimize current doc",
    expandAssistant: "Expand AI document assistant",
    collapseAssistant: "Collapse AI document assistant",
    assistantFailed: "Operation failed: ",
    edgeSelected: "Arrow selected; press Delete to remove"
  };
}

// src/client/styles.js
var styles = String.raw`
.deepseek-flow-root{--df-border:var(--dsw-alias-border-l1);--df-border-strong:var(--dsw-alias-border-l2);--df-bg:var(--dsw-alias-bg-base);--df-layer:var(--dsw-alias-bg-layer-1);--df-layer-2:var(--dsw-alias-bg-layer-2);--df-brand:var(--dsw-alias-brand-primary);--df-on-brand:var(--dsw-alias-label-primary-inverse,var(--dsw-alias-label-reverse,var(--df-bg)));--df-ink:var(--dsw-alias-label-primary);--df-ink-2:var(--dsw-alias-label-secondary);--df-ok:var(--dsw-alias-state-success-primary);--df-warn:var(--dsw-alias-state-warn-primary);--df-err:var(--dsw-alias-state-error-primary);position:relative;inset:auto;width:100%;height:100%;max-height:100vh;min-height:0;display:grid;grid-template-rows:48px minmax(0,1fr);background:var(--df-bg);color:var(--df-ink);font:13px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
.deepseek-flow-root *{box-sizing:border-box}
.deepseek-flow-root button,.deepseek-flow-root input,.deepseek-flow-root select,.deepseek-flow-root textarea{font:inherit}
.deepseek-flow-root button{cursor:pointer}
.df-tabs{display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--df-layer);border-bottom:1px solid var(--df-border)}
.df-titlebar__title{font-size:14px;font-weight:720;color:var(--df-ink)}
.df-titlebar__badge{padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--df-brand) 10%,transparent);color:var(--df-brand);font-size:10px;font-weight:700}
.df-titlebar__note{color:var(--df-ink-2);font-size:11px}
.df-titlebar__rev{margin-left:auto;color:var(--df-ink-2);font:9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.72}
.df-main{min-height:0;overflow:hidden}
.df-toolbar{flex:none;height:52px;min-height:52px;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--df-layer);border-bottom:1px solid var(--df-border);flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.df-toolbar>*{flex:none}
.df-toolbar>label{display:flex;align-items:center;gap:7px;color:var(--df-ink-2);font-size:12px}
.df-toolbar select,.df-toolbar input,.df-toolbar textarea{border:1px solid var(--df-border-strong);border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px;outline:0}
.df-toolbar input:focus,.df-toolbar select:focus,.df-toolbar textarea:focus{border-color:var(--df-brand)}
.df-btn{border:1px solid var(--df-border-strong);border-radius:8px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 11px;transition:border-color .15s ease,transform .15s ease,background .15s ease}
.df-btn:hover{border-color:var(--df-brand);transform:translateY(-1px)}
.df-btn.is-primary{border-color:var(--df-brand);background:var(--df-brand);color:var(--df-on-brand);font-weight:650}
.df-btn.is-ghost{background:transparent}
.df-btn:disabled{opacity:.5;cursor:default}
 .df-btn.is-disabled{opacity:.45;cursor:not-allowed}
.df-status{color:var(--df-ink-2);font-size:12px;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38%}
.df-studio{height:100%;display:grid;grid-template-rows:minmax(0,1fr);min-height:0;min-width:0;background:var(--df-bg);overflow:hidden}
.df-canvas-shell{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;background:var(--df-bg);overflow:hidden}
.df-canvas-stage{position:relative;flex:1;min-height:0;display:flex;overflow:hidden}
.df-canvas{flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;user-select:none;background-color:var(--df-bg);background-image:radial-gradient(circle,var(--df-border-strong) 1.1px,transparent 1.2px),radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--df-brand) 6%,transparent),transparent 42%);background-size:24px 24px,100% 100%;cursor:grab}
.df-canvas.is-panning{cursor:grabbing}
.df-graph__stage{position:absolute;left:0;top:0;width:1px;height:1px;transform-origin:0 0;will-change:transform}
.df-graph__edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.df-graph__edge{fill:none!important;stroke:var(--df-brand);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 2px color-mix(in srgb,var(--df-brand) 36%,transparent));pointer-events:none}
.df-graph__edge.is-selected{stroke-width:3.6;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--df-brand) 58%,transparent))}
.df-graph__edge-hit{fill:none!important;stroke:transparent;stroke-width:18;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
.df-graph__connection{fill:none!important;stroke:var(--df-brand);stroke-width:2;stroke-dasharray:7 5;vector-effect:non-scaling-stroke;pointer-events:none}
.df-graph__label-bg{fill:var(--df-layer);stroke:var(--df-border);stroke-width:1;vector-effect:non-scaling-stroke}
.df-graph__label{fill:var(--df-ink);font-size:10px;font-weight:750;text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.df-graph__node{position:absolute;width:208px;height:116px;pointer-events:auto;cursor:grab}
.df-graph__node.is-dragging{cursor:grabbing}
.df-graph__node.is-connect-target{outline:2px solid var(--df-brand);outline-offset:3px;box-shadow:0 0 0 4px color-mix(in srgb,var(--df-brand) 14%,transparent),0 10px 28px color-mix(in srgb,var(--df-ink) 18%,transparent)}
.df-graph__node.is-connect-target .df-graph__handle--target{transform:translateY(-50%) scale(1.25);background:var(--df-brand)}
.df-graph__handle{position:absolute;z-index:4;top:50%;width:13px;height:13px;padding:0;border:2px solid var(--df-bg);border-radius:50%;background:var(--df-brand);transform:translateY(-50%);cursor:crosshair;box-shadow:0 0 0 1px color-mix(in srgb,var(--df-brand) 65%,var(--df-border-strong));transition:transform .14s ease,box-shadow .14s ease}
.df-graph__handle:hover,.df-graph__handle:focus-visible{transform:translateY(-50%) scale(1.18);box-shadow:0 0 0 5px color-mix(in srgb,var(--df-brand) 18%,transparent);outline:0}
.df-graph__handle--target{left:-6px}
.df-graph__handle--source{right:-6px}
.df-graph__controls{position:absolute;z-index:8;left:12px;bottom:12px;display:grid;border:1px solid var(--df-border-strong);border-radius:9px;overflow:hidden;background:var(--df-layer);box-shadow:0 8px 20px color-mix(in srgb,var(--df-ink) 9%,transparent)}
.df-graph__controls button{width:32px;height:30px;border:0;border-bottom:1px solid var(--df-border);background:var(--df-layer-2);color:var(--df-ink);font-weight:750}
.df-graph__controls button:last-child{border-bottom:0}
.df-graph__controls button:hover{background:color-mix(in srgb,var(--df-brand) 10%,var(--df-layer-2));color:var(--df-brand)}
.df-topology-apply{position:absolute;z-index:14;right:18px;bottom:18px;display:flex;filter:drop-shadow(0 10px 22px color-mix(in srgb,var(--df-ink) 20%,transparent))}
.deepseek-flow-root .df-topology-apply>.df-btn{min-height:42px;display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:12px}
.df-topology-apply__icon{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--df-on-brand) 20%,transparent);font-size:12px;font-weight:850}
.df-topology-apply__count{display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--df-on-brand) 18%,transparent);font-size:10px;font-weight:800}
.df-node{width:100%;height:100%;padding:12px 14px;border:1px solid var(--df-border-strong);border-radius:12px;background:color-mix(in srgb,var(--df-layer) 96%,var(--df-brand) 4%);color:var(--df-ink);box-shadow:0 8px 24px color-mix(in srgb,var(--df-ink) 9%,transparent);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease;overflow:hidden}
.df-node:hover{border-color:color-mix(in srgb,var(--df-brand) 55%,var(--df-border-strong));box-shadow:0 12px 30px color-mix(in srgb,var(--df-ink) 12%,transparent)}
.df-node.is-selected{border-color:var(--df-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--df-brand) 18%,transparent),0 12px 30px color-mix(in srgb,var(--df-ink) 12%,transparent)}
.df-node__kind{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--df-ink-2);margin-bottom:2px}
.df-node__label{font-weight:650;font-size:13px;word-break:break-word}
.df-node__prompt{margin-top:5px;font-size:11px;color:var(--df-ink-2);white-space:pre-wrap;max-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.df-node__file{margin-top:8px;padding-top:7px;border-top:1px solid var(--df-border);font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-node--input .df-node__kind{color:var(--df-ok)}
.df-node--agent .df-node__kind{color:var(--df-brand)}
.df-node--mapAgent .df-node__kind{color:var(--df-warn)}
.df-node--condition .df-node__kind{color:var(--df-warn)}
.df-node--merge .df-node__kind{color:var(--df-ink-2)}
.df-node--output .df-node__kind{color:var(--df-err)}
.df-docrail{min-width:0;width:auto;display:flex;flex-direction:column;background:var(--df-layer);min-height:0;overflow:hidden}
.df-docrail.is-collapsed{visibility:hidden;pointer-events:none}
.df-docrail__head{position:relative;min-height:58px;padding:12px 14px 10px;border-bottom:1px solid var(--df-border)}
.df-docrail__title{font-size:13px;font-weight:700;color:var(--df-ink)}
.df-docrail__note{margin-top:3px;font-size:10px;line-height:1.45;color:var(--df-ink-2)}
.df-docrail__list{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:9px;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin}
.df-docgroup{padding:5px 7px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--df-ink-2)}
.df-docitem{width:100%;display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:center;text-align:left;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--df-ink);padding:8px}
.df-docitem:hover{background:var(--df-layer-2);border-color:var(--df-border)}
.df-docitem.is-active{background:color-mix(in srgb,var(--df-brand) 10%,var(--df-layer));border-color:color-mix(in srgb,var(--df-brand) 45%,var(--df-border));color:var(--df-brand)}
.df-docitem__icon{width:24px;height:28px;border:1px solid currentColor;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;opacity:.76}
.df-docitem__label{display:block;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-docitem__path{display:block;font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-inspector{min-width:0;width:auto;height:100%;max-height:100%;display:flex;flex-direction:column;background:var(--df-layer);overflow:hidden;min-height:0}
 .df-inspector__scroll{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:15px;display:flex;flex-direction:column;gap:11px;scrollbar-width:thin}
 .df-inspector__scroll>*{flex-shrink:0}
 .df-inspector>*{flex-shrink:0}
.df-inspector.is-collapsed{visibility:hidden;pointer-events:none;padding:0}
.df-inspector h3{margin:0;font-size:14px;color:var(--df-ink)}
.df-inspector label{display:grid;gap:4px;color:var(--df-ink-2);font-size:12px}
.df-inspector input,.df-inspector select,.df-inspector textarea{width:100%;border:1px solid var(--df-border-strong);border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px;outline:0}
.df-inspector textarea{min-height:92px;resize:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.55}
.df-inspector textarea.df-markdown-editor{min-height:300px;max-height:60vh;resize:none;background:var(--df-bg);border-radius:10px;overflow-y:auto;scrollbar-width:thin}
.df-advanced{border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2);padding:0 9px}
.df-advanced summary{cursor:pointer;padding:8px 0;color:var(--df-ink-2);font-size:11px;font-weight:650}
.df-advanced__content{display:grid;gap:9px;padding:0 0 10px}
.df-pathbox{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2)}
.df-pathbox__label{font-size:10px;color:var(--df-ink-2)}
.df-pathbox__value{font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink);word-break:break-all}
.df-inspector .df-empty{color:var(--df-ink-2);font-size:12px}
.df-addbar{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 14px;border-top:1px solid var(--df-border);background:var(--df-layer)}
.df-addbar button{font-size:11px;padding:4px 9px}
.df-connect-hint{margin-left:auto;color:var(--df-ink-2);font-size:10px;white-space:nowrap}
.df-iconbtn{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:16px}
.df-splitter{position:relative;z-index:12;min-width:9px;width:9px;cursor:col-resize;touch-action:none;background:var(--df-layer);outline:0}
.df-splitter::before{content:"";position:absolute;inset:0 3px;background:var(--df-border)}
.df-splitter::after{content:"";position:absolute;top:50%;left:50%;width:3px;height:42px;transform:translate(-50%,-50%);border-radius:999px;background:var(--df-border-strong);box-shadow:0 -7px 0 var(--df-border-strong),0 7px 0 var(--df-border-strong)}
.df-splitter:hover::before,.df-splitter:focus-visible::before,.df-splitter.is-dragging::before{inset:0 2px;background:var(--df-brand)}
.df-splitter.is-collapsed{background:color-mix(in srgb,var(--df-brand) 5%,var(--df-layer))}
.df-splitter.is-collapsed::after{background:var(--df-brand);box-shadow:0 -7px 0 var(--df-brand),0 7px 0 var(--df-brand)}
.df-assistant-splitter{position:relative;z-index:10;flex:none;height:8px;cursor:row-resize;touch-action:none;background:var(--df-layer)}
.df-assistant-splitter::before{content:"";position:absolute;inset:3px 0;background:var(--df-border)}
.df-assistant-splitter::after{content:"";position:absolute;left:50%;top:50%;width:44px;height:3px;transform:translate(-50%,-50%);border-radius:999px;background:var(--df-border-strong)}
.df-assistant-splitter:hover::before,.df-assistant-splitter:focus-visible::before,.df-assistant-splitter.is-dragging::before{inset:2px 0;background:var(--df-brand)}
.df-assistant{flex:none;background:var(--df-layer);min-height:44px;display:flex;flex-direction:column;overflow:hidden}
.df-assistant.is-open{max-height:min(440px,54%)}
.df-assistant__head{height:46px;flex:none;display:flex;align-items:center;gap:8px;padding:7px 14px}
.df-assistant__spark{width:27px;height:27px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--df-brand) 12%,var(--df-layer));color:var(--df-brand);font-weight:800}
.df-assistant__title{font-size:11px;font-weight:750;color:var(--df-ink);white-space:nowrap}
.df-assistant__safe{font-size:9px;color:var(--df-ink-2);white-space:nowrap}
.df-assistant__target{max-width:190px;padding:3px 8px;border:1px solid var(--df-border);border-radius:999px;color:var(--df-ink-2);font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .df-assist-menu-wrap{position:relative;display:flex;align-items:center;flex:none}
 .deepseek-flow-root .df-assist-menu-btn{display:inline-flex;align-items:center;gap:4px;max-width:170px;border:1px solid var(--df-border-strong);border-radius:999px;background:var(--df-layer-2);color:var(--df-ink);padding:2px 8px;font-size:9px;line-height:1.35;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .deepseek-flow-root .df-assist-menu-btn:hover{border-color:var(--df-brand)}
 .deepseek-flow-root .df-assist-menu-caret{font-size:8px;color:var(--df-ink-2);flex:none}
 .df-assist-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:230px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid var(--df-border-strong);border-radius:14px;background:var(--df-layer);box-shadow:0 14px 36px color-mix(in srgb,var(--df-ink) 16%,transparent)}
 .deepseek-flow-root .df-assist-menu-item{display:flex;align-items:center;gap:6px;text-align:left;border:0;border-radius:10px;background:transparent;color:var(--df-ink);padding:8px 11px;font-size:11px;cursor:pointer}
 .deepseek-flow-root .df-assist-menu-item:hover{background:var(--df-layer-2)}
 .deepseek-flow-root .df-assist-menu-back{display:flex;align-items:center;border:0;border-radius:10px;background:transparent;color:var(--df-ink-2);padding:7px 11px;font-size:11px;cursor:pointer}
 .deepseek-flow-root .df-assist-menu-back:hover{background:var(--df-layer-2)}
.df-assistant__actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}
.df-assistant__head .df-btn{font-size:10px;padding:4px 8px}
.df-assistant__toggle{width:28px;height:28px;padding:0;font-size:14px}
.df-assistant__body{min-height:0;flex:1;display:grid;grid-template-columns:minmax(230px,.72fr) minmax(360px,1.28fr);gap:10px;padding:0 14px 12px;overflow:hidden}
.df-assistant__control{display:flex;min-width:0;min-height:0;flex-direction:column;gap:7px;padding:9px;border:1px solid var(--df-border);border-radius:12px;background:var(--df-layer-2);overflow:hidden}
.df-assistant__control label{flex:none;font-size:10px;color:var(--df-ink-2)}
.df-assistant__control input,.df-assistant__preview textarea{width:100%;border:1px solid var(--df-border-strong);border-radius:8px;background:var(--df-layer-2);color:var(--df-ink);padding:7px 9px;outline:0}
.df-assistant__control input:focus,.df-assistant__preview textarea:focus{border-color:var(--df-brand)}
.df-assistant__summary{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--df-ink-2);min-height:24px}
.df-count{appearance:none;padding:2px 7px;border-radius:999px;background:var(--df-layer-2);border:1px solid var(--df-border);font-size:9px;line-height:1.4;cursor:pointer}
.df-count.is-error{color:var(--df-err)}
.df-count.is-warning{color:var(--df-warn)}
.df-count:hover,.df-count:focus-visible{border-color:currentColor;outline:0}
.df-count.is-active{background:color-mix(in srgb,currentColor 14%,var(--df-layer-2));border-color:currentColor;box-shadow:inset 0 0 0 1px currentColor}
.df-findings{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:5px;padding-right:3px;scrollbar-width:thin}
.df-finding{display:grid;grid-template-columns:7px minmax(0,1fr);gap:7px;width:100%;text-align:left;border:0;border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px}
.df-finding:hover{background:color-mix(in srgb,var(--df-brand) 7%,var(--df-layer-2))}
.df-finding__dot{width:7px;height:7px;border-radius:50%;margin-top:5px;background:var(--df-ink-2)}
.df-finding.is-error .df-finding__dot{background:var(--df-err)}
.df-finding.is-warning .df-finding__dot{background:var(--df-warn)}
.df-finding__doc{display:block;color:var(--df-brand);font:8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.df-finding__message{display:block;font-size:10px;line-height:1.4}
.df-finding__suggestion{display:block;color:var(--df-ink-2);font-size:9px;line-height:1.35;margin-top:2px}
.df-assistant__preview{min-width:0;min-height:0;display:flex;flex-direction:column;border:1px solid var(--df-border);border-radius:12px;background:var(--df-bg);overflow:hidden}
.df-assistant__preview-head{position:sticky;z-index:2;top:0;flex:none;min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;border-bottom:1px solid var(--df-border);background:var(--df-layer-2);font-size:10px;color:var(--df-ink-2)}
.df-assistant__preview-head>span:last-child{display:inline-flex;align-items:center;gap:6px}
.df-assistant__preview-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-assistant__preview textarea{flex:1;min-height:0;resize:none;overflow:auto;overscroll-behavior:contain;border:0;border-radius:0 0 12px 12px;padding:10px 12px;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--df-bg);scrollbar-width:thin}
.df-assistant__pending{flex:1;min-height:0;display:grid;place-items:center;padding:18px;color:var(--df-ink-2);font-size:11px;text-align:center;overflow:auto}
.df-confirm-backdrop{position:absolute;z-index:40;inset:0;display:grid;place-items:center;padding:20px;background:color-mix(in srgb,var(--df-bg) 72%,transparent);backdrop-filter:blur(4px)}
.df-confirm{width:min(540px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:18px;border:1px solid var(--df-border-strong);border-radius:14px;background:var(--df-layer);box-shadow:0 20px 60px color-mix(in srgb,var(--df-ink) 18%,transparent)}
.df-confirm h3{margin:0 0 8px;font-size:15px;color:var(--df-ink)}
.df-confirm p{margin:0;color:var(--df-ink-2);font-size:12px;line-height:1.65}
.df-confirm__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.df-topology-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
.df-topology-summary span{padding:8px 10px;border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2);color:var(--df-ink-2);font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.df-gate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}
.deepseek-flow-root .df-gate-choice{display:flex;min-height:82px;flex-direction:column;align-items:flex-start;gap:5px;text-align:left;border:1px solid var(--df-border-strong);border-radius:11px;background:var(--df-layer-2);color:var(--df-ink);padding:11px;cursor:pointer}
.deepseek-flow-root .df-gate-choice:hover,.deepseek-flow-root .df-gate-choice:focus-visible{border-color:var(--df-brand);background:color-mix(in srgb,var(--df-brand) 7%,var(--df-layer-2));outline:0}
.df-gate-choice strong{font-size:12px;color:var(--df-brand)}
.df-gate-choice span{font-size:10px;line-height:1.45;color:var(--df-ink-2)}
.df-branch-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.deepseek-flow-root .df-branch-option{min-height:54px;border:1px solid var(--df-border-strong);border-radius:11px;background:var(--df-layer-2);color:var(--df-ink);font-size:14px;font-weight:750;cursor:pointer}
.deepseek-flow-root .df-branch-option:hover:not(:disabled),.deepseek-flow-root .df-branch-option:focus-visible:not(:disabled){border-color:var(--df-brand);color:var(--df-brand);outline:0}
.deepseek-flow-root .df-branch-option:disabled{opacity:.38;cursor:not-allowed;text-decoration:line-through}
.df-import-hidden{display:none}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]{--dsh-composer-height:0px!important;overflow:hidden!important}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]>[data-composer-seat]{display:none!important}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]>:not([data-composer-seat]){flex:1 1 0;min-height:0;height:100%}
[data-conversation-scroll][data-deepseek-flow-immersive="true"] .deepseek-flow-root{height:100%;min-height:0}
@media(max-width:1180px){.df-status{display:none}.df-assistant__safe{display:none}.df-assistant__target{max-width:120px}.df-titlebar__note{display:none}}
@media(max-width:760px){.df-toolbar{padding:7px}.df-assistant__head{padding:7px;overflow-x:auto}.df-assistant__target{display:none}.df-assistant__body{grid-template-columns:1fr;overflow:auto;overscroll-behavior:contain}.df-assistant__control{min-height:150px}.df-findings{height:auto;min-height:80px}.df-assistant__preview{display:flex;min-height:210px}.df-assistant__head .df-btn{padding:4px 6px}.df-assistant__title{display:none}.df-tabs{padding:0 10px}.df-titlebar__badge{display:none}.df-topology-apply{right:10px;bottom:10px}.df-topology-summary{grid-template-columns:1fr}}
`;

// src/client/entry.js
function loadPositionOverrides(flowId) {
  try {
    return JSON.parse(localStorage.getItem(`deepseek-flow:positions:${flowId}`) ?? "null") ?? void 0;
  } catch {
    return void 0;
  }
}
var inject = ["slots", "connection", "locale"];
var CLIENT_REV = "6f9f0d7abbfd";
async function remoteCall(connection, endpoint, args = {}) {
  const result = await connection.rpc.call("/api", endpoint, { args });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
function newRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `df-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function download(content, fileName, mediaType) {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
var PANEL_COLLAPSE_THRESHOLD = 108;
var LEFT_PANEL_DEFAULT = 264;
var RIGHT_PANEL_DEFAULT = 380;
var ASSISTANT_DEFAULT = 240;
var ASSISTANT_COLLAPSE_THRESHOLD = 118;
function storedNumber(key, fallback) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}
function storedBoolean(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}
function keepLayout(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
  }
}
function Studio({ connection, sessionId, language }) {
  const t = (0, import_react2.useMemo)(() => text(language), [language]);
  const [flows, setFlows] = (0, import_react2.useState)([]);
  const [currentId, setCurrentId] = (0, import_react2.useState)(null);
  const [nodes, setNodes] = (0, import_react2.useState)([]);
  const [edges, setEdges] = (0, import_react2.useState)([]);
  const [selected, setSelected] = (0, import_react2.useState)(null);
  const [selectedEdge, setSelectedEdge] = (0, import_react2.useState)(null);
  const [activeDoc, setActiveDoc] = (0, import_react2.useState)("workflow");
  const [documentsOpen, setDocumentsOpen] = (0, import_react2.useState)(() => storedBoolean("deepseek-flow:left-open", window.innerWidth > 1040));
  const [inspectorOpen, setInspectorOpen] = (0, import_react2.useState)(() => storedBoolean("deepseek-flow:right-open", window.innerWidth > 1040));
  const [documentWidth, setDocumentWidth] = (0, import_react2.useState)(() => storedNumber("deepseek-flow:left-width", LEFT_PANEL_DEFAULT));
  const [inspectorWidth, setInspectorWidth] = (0, import_react2.useState)(() => storedNumber("deepseek-flow:right-width", RIGHT_PANEL_DEFAULT));
  const [studioWidth, setStudioWidth] = (0, import_react2.useState)(() => Math.max(640, Number(window.innerWidth) || 1200));
  const [message, setMessage] = (0, import_react2.useState)(t.ready);
  const [dirty, setDirty] = (0, import_react2.useState)(false);
  const [flowInstance, setFlowInstance] = (0, import_react2.useState)(null);
  const [gatePickerOpen, setGatePickerOpen] = (0, import_react2.useState)(false);
  const [pendingConnection, setPendingConnection] = (0, import_react2.useState)(null);
  const [connectionWarning, setConnectionWarning] = (0, import_react2.useState)(null);
  const [assistantOpen, setAssistantOpen] = (0, import_react2.useState)(() => storedBoolean("deepseek-flow:assistant-open", false));
  const [assistantHeight, setAssistantHeight] = (0, import_react2.useState)(() => storedNumber("deepseek-flow:assistant-height", ASSISTANT_DEFAULT));
  const [assistantBusy, setAssistantBusy] = (0, import_react2.useState)(null);
  const [runningDocs, setRunningDocs] = (0, import_react2.useState)(() => /* @__PURE__ */ new Map());
  const [assistModel, setAssistModel] = (0, import_react2.useState)("");
  const [assistEffort, setAssistEffort] = (0, import_react2.useState)("");
  const [assistMenuOpen, setAssistMenuOpen] = (0, import_react2.useState)(false);
  const [assistMenuPage, setAssistMenuPage] = (0, import_react2.useState)(null);
  const [assistModelOptions, setAssistModelOptions] = (0, import_react2.useState)(null);
  const [assistantInstruction, setAssistantInstruction] = (0, import_react2.useState)("");
  const [validationResult, setValidationResult] = (0, import_react2.useState)(null);
  const [findingFilter, setFindingFilter] = (0, import_react2.useState)(null);
  const [optimizationProposal, setOptimizationProposal] = (0, import_react2.useState)(null);
  const [assistantDraft, setAssistantDraft] = (0, import_react2.useState)("");
  const proposalStoreRef = import_react2.default.useRef(/* @__PURE__ */ new Map());
  const pollTimerRef = import_react2.default.useRef(null);
  const topologyPollRef = import_react2.default.useRef(null);
  const [workflowOptimizeConfirm, setWorkflowOptimizeConfirm] = (0, import_react2.useState)(false);
  const [cancelConfirm, setCancelConfirm] = (0, import_react2.useState)(null);
  const [topologyApplyConfirm, setTopologyApplyConfirm] = (0, import_react2.useState)(false);
  const [topologyApplyBusy, setTopologyApplyBusy] = (0, import_react2.useState)(false);
  const [persistedTopologySignature, setPersistedTopologySignature] = (0, import_react2.useState)("");
  const fileRef = import_react2.default.useRef(null);
  const documentTimerRef = import_react2.default.useRef(null);
  const fitTimerRef = import_react2.default.useRef(null);
  const documentWriteChainRef = import_react2.default.useRef(Promise.resolve());
  const documentRevisionRef = import_react2.default.useRef(0);
  const persistedRevisionRef = import_react2.default.useRef(/* @__PURE__ */ new Map());
  const persistedFlowRef = import_react2.default.useRef(null);
  const canvasTopologyEditedRef = import_react2.default.useRef(false);
  const agentFinalizeButtonRef = import_react2.default.useRef(null);
  const pendingAgentFinalizeRef = import_react2.default.useRef(null);
  const agentFinalizeBusyRef = import_react2.default.useRef(false);
  const optimizationRequestRef = import_react2.default.useRef(0);
  const activeAssistRef = import_react2.default.useRef(null);
  const currentIdRef = import_react2.default.useRef(null);
  const nodesRef = import_react2.default.useRef([]);
  const edgesRef = import_react2.default.useRef([]);
  const historyRef = import_react2.default.useRef({ past: [], future: [] });
  const studioRef = import_react2.default.useRef(null);
  const canvasShellRef = import_react2.default.useRef(null);
  const panelDragRef = import_react2.default.useRef(null);
  const assistantDragRef = import_react2.default.useRef(null);
  const markCanvasTopologyEdit = (0, import_react2.useCallback)(() => {
    canvasTopologyEditedRef.current = true;
  }, []);
  const fitWholeFlow = (0, import_react2.useCallback)((duration = 260) => {
    flowInstance?.fitView?.({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration });
  }, [flowInstance]);
  const beginPanelResize = (0, import_react2.useCallback)((side, event) => {
    if (event.button !== void 0 && event.button !== 0) return;
    event.preventDefault();
    const isLeft = side === "left";
    const wasOpen = isLeft ? documentsOpen : inspectorOpen;
    const remembered = isLeft ? documentWidth : inspectorWidth;
    const fallback = isLeft ? LEFT_PANEL_DEFAULT : RIGHT_PANEL_DEFAULT;
    const startWidth = wasOpen ? remembered : 0;
    const startX = event.clientX;
    const pointerId = event.pointerId;
    let moved = false;
    let lastWidth = startWidth;
    const maximum = Math.max(180, Math.min(isLeft ? 520 : 680, studioWidth * 0.46));
    const setOpen = isLeft ? setDocumentsOpen : setInspectorOpen;
    const setWidth = isLeft ? setDocumentWidth : setInspectorWidth;
    const splitter = event.currentTarget;
    const oldCursor = document.body.style.cursor;
    const oldSelect = document.body.style.userSelect;
    splitter?.classList?.add("is-dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (moveEvent) => {
      if (pointerId !== void 0 && moveEvent.pointerId !== void 0 && moveEvent.pointerId !== pointerId) return;
      const delta = isLeft ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      if (Math.abs(delta) > 3) moved = true;
      lastWidth = Math.max(0, Math.min(maximum, startWidth + delta));
      if (lastWidth > 4) setOpen(true);
      setWidth(Math.max(1, lastWidth));
    };
    const onUp = (upEvent) => {
      if (pointerId !== void 0 && upEvent.pointerId !== void 0 && upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      splitter?.classList?.remove("is-dragging");
      document.body.style.cursor = oldCursor;
      document.body.style.userSelect = oldSelect;
      panelDragRef.current = null;
      if (!moved && !wasOpen) {
        setWidth(Math.max(PANEL_COLLAPSE_THRESHOLD, remembered || fallback));
        setOpen(true);
      } else if (lastWidth < PANEL_COLLAPSE_THRESHOLD) {
        setWidth(Math.max(PANEL_COLLAPSE_THRESHOLD, startWidth || remembered || fallback));
        setOpen(false);
      } else {
        setWidth(lastWidth);
        setOpen(true);
      }
      window.setTimeout(() => fitWholeFlow(180), 0);
    };
    panelDragRef.current = { side, onMove, onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [documentWidth, documentsOpen, fitWholeFlow, inspectorOpen, inspectorWidth, studioWidth]);
  const panelKeyDown = (0, import_react2.useCallback)((side, event) => {
    const isLeft = side === "left";
    const open = isLeft ? documentsOpen : inspectorOpen;
    const setOpen = isLeft ? setDocumentsOpen : setInspectorOpen;
    const setWidth = isLeft ? setDocumentWidth : setInspectorWidth;
    const delta = event.shiftKey ? 40 : 16;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(!open);
    } else if (event.key === "Home") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setOpen(true);
      setWidth((value) => Math.max(PANEL_COLLAPSE_THRESHOLD, value + (isLeft ? direction : -direction) * delta));
    }
  }, [documentsOpen, inspectorOpen]);
  const beginAssistantResize = (0, import_react2.useCallback)((event) => {
    if (event.button !== void 0 && event.button !== 0) return;
    event.preventDefault();
    const wasOpen = assistantOpen;
    const remembered = assistantHeight;
    const startHeight = wasOpen ? remembered : 44;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let moved = false;
    let lastHeight = startHeight;
    const maximum = Math.max(180, Math.min(440, (canvasShellRef.current?.getBoundingClientRect().height ?? 720) * 0.54));
    const splitter = event.currentTarget;
    const oldCursor = document.body.style.cursor;
    const oldSelect = document.body.style.userSelect;
    splitter?.classList?.add("is-dragging");
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const onMove = (moveEvent) => {
      if (pointerId !== void 0 && moveEvent.pointerId !== void 0 && moveEvent.pointerId !== pointerId) return;
      const delta = startY - moveEvent.clientY;
      if (Math.abs(delta) > 3) moved = true;
      lastHeight = Math.max(44, Math.min(maximum, startHeight + delta));
      if (lastHeight >= ASSISTANT_COLLAPSE_THRESHOLD) setAssistantOpen(true);
      setAssistantHeight(lastHeight);
    };
    const onUp = (upEvent) => {
      if (pointerId !== void 0 && upEvent.pointerId !== void 0 && upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      splitter?.classList?.remove("is-dragging");
      document.body.style.cursor = oldCursor;
      document.body.style.userSelect = oldSelect;
      assistantDragRef.current = null;
      if (!moved && !wasOpen) {
        setAssistantHeight(Math.max(ASSISTANT_COLLAPSE_THRESHOLD, remembered || ASSISTANT_DEFAULT));
        setAssistantOpen(true);
      } else if (lastHeight < ASSISTANT_COLLAPSE_THRESHOLD) {
        setAssistantHeight(Math.max(ASSISTANT_COLLAPSE_THRESHOLD, remembered || ASSISTANT_DEFAULT));
        setAssistantOpen(false);
      } else {
        setAssistantHeight(lastHeight);
        setAssistantOpen(true);
      }
      window.setTimeout(() => fitWholeFlow(180), 0);
    };
    assistantDragRef.current = { onMove, onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [assistantHeight, assistantOpen, fitWholeFlow]);
  const showFlow = (0, import_react2.useCallback)((flow, options = {}) => {
    if (!flow) return;
    canvasTopologyEditedRef.current = false;
    persistedRevisionRef.current.set(flow.id, Number(flow.revision) || 0);
    persistedFlowRef.current = flow;
    setPersistedTopologySignature(topologySignature(flow));
    currentIdRef.current = flow.id;
    setCurrentId(flow.id);
    setNodes(flowToCanvasNodes(flow, loadPositionOverrides(flow.id)));
    setEdges(flowToCanvasEdges(flow.edges, t));
    historyRef.current = { past: [], future: [] };
    setSelectedEdge(null);
    setValidationResult(null);
    setFindingFilter(null);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setWorkflowOptimizeConfirm(false);
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(false);
    if (options.resetDocument !== false) {
      setSelected(null);
      setActiveDoc("workflow");
    }
  }, [setEdges, setNodes, t]);
  const loadFlows = (0, import_react2.useCallback)(async () => {
    try {
      const items = await remoteCall(connection, "dflow/list", { sessionId });
      setFlows(items);
      const first = items.find((item) => item.id === currentIdRef.current) ?? items[0];
      if (first) {
        showFlow(first, { resetDocument: currentIdRef.current !== first.id });
      } else {
        currentIdRef.current = null;
        persistedFlowRef.current = null;
        setPersistedTopologySignature("");
        setCurrentId(null);
        setNodes([]);
        setEdges([]);
      }
      setDirty(false);
      setMessage(t.ready);
    } catch (error) {
      setMessage(String(error));
    }
  }, [connection, sessionId, setEdges, setNodes, showFlow, t.ready]);
  (0, import_react2.useEffect)(() => {
    loadFlows();
  }, [loadFlows]);
  (0, import_react2.useEffect)(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await remoteCall(connection, "dflow/models");
        if (!cancelled) setAssistModelOptions(Array.isArray(models) ? models : []);
      } catch {
        if (!cancelled) setAssistModelOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection]);
  (0, import_react2.useEffect)(() => {
    let cancelled = false;
    (async () => {
      try {
        const history = await remoteCall(connection, "dflow/assistHistory", { sessionId });
        if (cancelled || !Array.isArray(history)) return;
        for (const entry of history) {
          if (entry.mode === "optimize" && entry.target && !proposalStoreRef.current.has(entry.target)) {
            if (entry.status === "done" && entry.result) {
              proposalStoreRef.current.set(entry.target, { ...entry.result, target: entry.target });
            } else if (entry.status === "error") {
              proposalStoreRef.current.set(entry.target, { status: "error", target: entry.target, error: entry.error ?? "failed" });
            } else if (entry.status === "running") {
              const target = entry.target;
              const requestId = entry.key.split(":").pop();
              setRunningDocs((prev) => {
                const next = new Map(prev);
                next.set(target, requestId);
                return next;
              });
              pollAssist(requestId, (finalEntry) => {
                if (finalEntry.status === "cancelled") {
                  if (assistantTargetRef.current === target) setMessage(t.assistantCancelled);
                } else if (finalEntry.status === "done" && finalEntry.result) {
                  const proposal2 = { ...finalEntry.result, target: finalEntry.result.target ?? target, documentLabel: assistantDocLabel };
                  proposalStoreRef.current.set(target, proposal2);
                  if (assistantTargetRef.current === target) {
                    setOptimizationProposal(proposal2);
                    setAssistantDraft(proposal2.suggestedContent ?? "");
                  }
                } else {
                  proposalStoreRef.current.set(target, { status: "error", target, error: String(finalEntry.error ?? "failed") });
                  if (assistantTargetRef.current === target) setMessage(t.assistantFailed + String(finalEntry.error ?? ""));
                }
                setRunningDocs((prev) => {
                  const next = new Map(prev);
                  next.delete(target);
                  return next;
                });
                activeAssistRef.current = null;
              });
            }
          } else if (entry.mode === "logic" && entry.status === "done" && entry.result) {
            setValidationResult(entry.result);
          } else if (entry.mode === "logic" && entry.status === "running") {
            const requestId = entry.key.split(":").pop();
            setAssistantBusy("logic");
            pollAssist(requestId, (finalEntry) => {
              if (finalEntry.status === "cancelled") {
                setMessage(t.assistantCancelled);
              } else if (finalEntry.status === "done" && finalEntry.result) {
                setValidationResult(finalEntry.result);
                setFindingFilter(null);
                setMessage(t.validationComplete);
              } else {
                setMessage(t.assistantFailed + String(finalEntry.error ?? ""));
              }
              activeAssistRef.current = null;
              setAssistantBusy(null);
            });
          } else if (entry.mode === "topology-apply" && entry.status === "running") {
            const requestId = entry.key.split(":").pop();
            setTopologyApplyBusy(true);
            setMessage(t.topologyApplying);
            topologyPollRef.current?.();
            topologyPollRef.current = pollAssist(requestId, (finalEntry) => {
              topologyPollRef.current = null;
              setTopologyApplyBusy(false);
              if (finalEntry.status === "done" && finalEntry.result?.flow) {
                showFlow(finalEntry.result.flow, { resetDocument: false });
                setDirty(false);
                setMessage(finalEntry.result.summary ? `${t.topologyApplied}\uFF1A${finalEntry.result.summary}` : t.topologyApplied);
              } else {
                setMessage(t.topologyApplyFailed + String(finalEntry.error ?? ""));
              }
            });
          } else if (entry.mode === "topology-apply" && entry.status === "done" && entry.result?.flow) {
            const knownRevision = persistedRevisionRef.current.get(entry.result.flow.id) ?? 0;
            if (Number(entry.result.flow.revision) > knownRevision) {
              showFlow(entry.result.flow, { resetDocument: false });
              setDirty(false);
            }
          } else if (entry.mode === "optimize-workflow" && entry.status === "running") {
            const requestId = entry.key.split(":").pop();
            setAssistantBusy("optimize-workflow");
            setAssistantOpen(true);
            setOptimizationProposal(null);
            setAssistantDraft("");
            pollTimerRef.current?.();
            pollTimerRef.current = pollAssist(requestId, (finalEntry) => applyWorkflowOptimization(finalEntry, {
              requestId,
              flow: null,
              requireUnchangedRevision: false
            }));
          } else if (entry.mode === "optimize-workflow" && entry.status === "done" && entry.result) {
            const requestId = entry.key.split(":").pop();
            applyWorkflowOptimization(entry, { requestId, flow: null, requireUnchangedRevision: false });
          }
        }
        const proposal = proposalStoreRef.current.get(assistantTargetRef.current);
        if (proposal && typeof proposal.suggestedContent === "string") {
          setOptimizationProposal(proposal);
          setAssistantDraft(proposal.suggestedContent);
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, sessionId]);
  (0, import_react2.useEffect)(() => {
    const element = studioRef.current;
    if (!element) return void 0;
    const update = () => setStudioWidth(Math.max(320, element.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  (0, import_react2.useEffect)(() => keepLayout("deepseek-flow:left-open", documentsOpen), [documentsOpen]);
  (0, import_react2.useEffect)(() => keepLayout("deepseek-flow:right-open", inspectorOpen), [inspectorOpen]);
  (0, import_react2.useEffect)(() => keepLayout("deepseek-flow:left-width", Math.round(documentWidth)), [documentWidth]);
  (0, import_react2.useEffect)(() => keepLayout("deepseek-flow:right-width", Math.round(inspectorWidth)), [inspectorWidth]);
  (0, import_react2.useEffect)(() => keepLayout("deepseek-flow:assistant-open", assistantOpen), [assistantOpen]);
  (0, import_react2.useEffect)(() => keepLayout("deepseek-flow:assistant-height", Math.round(assistantHeight)), [assistantHeight]);
  (0, import_react2.useEffect)(() => () => {
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    if (pollTimerRef.current) pollTimerRef.current();
    if (topologyPollRef.current) topologyPollRef.current();
    if (panelDragRef.current) {
      window.removeEventListener("pointermove", panelDragRef.current.onMove);
      window.removeEventListener("pointerup", panelDragRef.current.onUp);
    }
    if (assistantDragRef.current) {
      window.removeEventListener("pointermove", assistantDragRef.current.onMove);
      window.removeEventListener("pointerup", assistantDragRef.current.onUp);
    }
    const activeAssist = activeAssistRef.current;
    if (activeAssist) {
      activeAssistRef.current = null;
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [connection, sessionId]);
  (0, import_react2.useEffect)(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  (0, import_react2.useEffect)(() => {
    edgesRef.current = edges;
  }, [edges]);
  (0, import_react2.useEffect)(() => {
    if (!flowInstance || !currentId || nodes.length === 0) return void 0;
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      fitTimerRef.current = null;
      flowInstance.fitView({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration: 320 });
    }, 600);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [currentId, flowInstance, nodes.length]);
  const selectFlow = async (id) => {
    if (id === currentId) return;
    if (dirty || documentTimerRef.current) {
      const saved = await save();
      if (!saved) return;
    }
    const flow = flows.find((f) => f.id === id);
    if (!flow) return;
    showFlow(flow);
    setDirty(false);
  };
  const currentFlow = flows.find((f) => f.id === currentId) ?? null;
  const currentDraftFlow = currentFlow ? serializeFlow(currentFlow, nodes, edges) : null;
  const currentTopologySignature = currentDraftFlow ? topologySignature(currentDraftFlow) : "";
  const topologyDirty = Boolean(currentDraftFlow && currentTopologySignature !== persistedTopologySignature);
  const topologyDelta = currentDraftFlow ? topologyDiff(persistedFlowRef.current ?? {
    ...currentDraftFlow,
    nodes: [],
    edges: [],
    inputs: [],
    outputs: []
  }, currentDraftFlow) : null;
  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  const finalizeTopologyDirectly = (0, import_react2.useCallback)(async () => {
    if (agentFinalizeBusyRef.current || canvasTopologyEditedRef.current) return;
    const baseFlow = persistedFlowRef.current;
    const flowId = currentIdRef.current;
    if (!baseFlow || !flowId) return;
    agentFinalizeBusyRef.current = true;
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(true);
    setMessage(t.hiddenFinalizeApplying);
    const pending = pendingAgentFinalizeRef.current;
    try {
      if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
      documentTimerRef.current = null;
      await documentWriteChainRef.current.catch(() => {
      });
      const draftFlow = serializeFlow(baseFlow, nodesRef.current, edgesRef.current);
      const finalized = await remoteCall(connection, "dflow/topologyFinalize", {
        request: {
          sessionId,
          draftFlow,
          ...pending?.requestId ? { requestId: pending.requestId } : {
            source: "external-files",
            expectedRevision: persistedRevisionRef.current.get(flowId)
          }
        }
      });
      if (!finalized?.finalized || !finalized.flow) throw new Error("Hidden finalize did not return a saved flow");
      const saved = finalized.flow;
      setFlows((items) => items.some((item) => item.id === saved.id) ? items.map((item) => item.id === saved.id ? { ...item, ...saved } : item) : [saved, ...items]);
      showFlow(saved, { resetDocument: false });
      setDirty(false);
      setMessage(t.hiddenFinalizeApplied);
    } catch (error) {
      canvasTopologyEditedRef.current = true;
      setMessage(t.hiddenFinalizeFailed + String(error));
    } finally {
      pendingAgentFinalizeRef.current = null;
      agentFinalizeBusyRef.current = false;
      setTopologyApplyBusy(false);
    }
  }, [connection, sessionId, showFlow, t.hiddenFinalizeApplied, t.hiddenFinalizeApplying, t.hiddenFinalizeFailed]);
  (0, import_react2.useEffect)(() => {
    if (!topologyDirty || topologyApplyBusy || canvasTopologyEditedRef.current) return void 0;
    const timer = window.setTimeout(() => agentFinalizeButtonRef.current?.click(), 120);
    return () => window.clearTimeout(timer);
  }, [currentTopologySignature, topologyApplyBusy, topologyDirty]);
  (0, import_react2.useEffect)(() => {
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      const flowId = currentIdRef.current;
      if (cancelled || polling || !flowId || !topologyDirty || topologyApplyBusy || canvasTopologyEditedRef.current) return;
      polling = true;
      try {
        const pending = await remoteCall(connection, "dflow/finalizePending", { sessionId, id: flowId });
        if (cancelled || !pending?.requestId) return;
        pendingAgentFinalizeRef.current = pending;
        agentFinalizeButtonRef.current?.click();
      } catch {
      } finally {
        polling = false;
      }
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connection, sessionId, topologyApplyBusy, topologyDirty]);
  (0, import_react2.useEffect)(() => {
    let cancelled = false;
    let refreshing = false;
    const refreshPersistedFlow = async () => {
      if (refreshing || topologyApplyBusy || documentTimerRef.current) return;
      const flowId = currentIdRef.current;
      const baseFlow = persistedFlowRef.current;
      if (!flowId || !baseFlow) return;
      refreshing = true;
      try {
        const items = await remoteCall(connection, "dflow/list", { sessionId });
        if (cancelled || !Array.isArray(items)) return;
        const remoteFlow = items.find((item) => item.id === flowId);
        if (!remoteFlow) return;
        const knownRevision = persistedRevisionRef.current.get(flowId) ?? 0;
        if ((Number(remoteFlow.revision) || 0) <= knownRevision) return;
        const draftFlow = serializeFlow(baseFlow, nodesRef.current, edgesRef.current);
        const decision = topologySyncDecision(baseFlow, draftFlow, remoteFlow);
        if (decision === "conflict") {
          setMessage(t.topologySessionConflict);
          return;
        }
        setFlows(items);
        if (decision === "documents-only") {
          persistedFlowRef.current = remoteFlow;
          persistedRevisionRef.current.set(flowId, Number(remoteFlow.revision) || 0);
          setPersistedTopologySignature(topologySignature(remoteFlow));
          return;
        }
        showFlow(remoteFlow, { resetDocument: false });
        setDirty(false);
        setMessage(decision === "already-persisted" ? t.topologyAlreadyPersisted : t.topologySessionSynced);
      } catch {
      } finally {
        refreshing = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPersistedFlow();
    };
    const timer = window.setInterval(refreshPersistedFlow, 5e3);
    window.addEventListener("focus", refreshPersistedFlow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshPersistedFlow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connection, sessionId, showFlow, t.topologyAlreadyPersisted, t.topologySessionConflict, t.topologySessionSynced, topologyApplyBusy]);
  const selectedConditionInputs = selectedNode?.data?.kind === "condition" ? edges.filter((edge) => edge.target === selectedNode.id).map((edge) => {
    const source = nodes.find((node) => node.id === edge.source);
    return { edgeId: edge.id, sourceId: edge.source, label: source?.data?.label ?? edge.source };
  }) : [];
  const selectedGateRule = selectedNode?.data?.kind === "condition" ? gateRule(selectedNode.data.gateType) : null;
  const selectedGateArityValid = !selectedGateRule || selectedConditionInputs.length >= selectedGateRule.minInputs && selectedConditionInputs.length <= selectedGateRule.maxInputs;
  const persistDocumentSnapshot = (0, import_react2.useCallback)(async (flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return null;
    let editorFlow;
    const operation = documentWriteChainRef.current.catch(() => {
    }).then(async () => {
      const persisted = persistedFlowRef.current;
      if (!persisted || persisted.id !== flowSnapshot.id) return null;
      editorFlow = serializeFlow(flowSnapshot, nodeSnapshot, edgeSnapshot);
      const documentOnly = mergeDocumentEdits(persisted, editorFlow, nodeSnapshot);
      const persistedRevision = persistedRevisionRef.current.get(documentOnly.id);
      const payload = Number.isInteger(persistedRevision) ? { ...documentOnly, revision: persistedRevision } : documentOnly;
      return remoteCall(connection, "dflow/put", { flow: payload, sessionId });
    });
    documentWriteChainRef.current = operation.then(() => void 0, () => void 0);
    const saved = await operation;
    if (!saved) return null;
    persistedFlowRef.current = saved;
    persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
    setPersistedTopologySignature(topologySignature(saved));
    setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
    setDirty(topologySignature(editorFlow) !== topologySignature(saved));
    return saved;
  }, [connection, sessionId]);
  const scheduleDocumentSave = (0, import_react2.useCallback)((flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return;
    if (!persistedFlowRef.current || persistedFlowRef.current.id !== flowSnapshot.id) {
      setMessage(t.topologyApplyFirst);
      return;
    }
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    const editRevision = ++documentRevisionRef.current;
    setMessage(t.autoSaving);
    documentTimerRef.current = setTimeout(() => {
      documentTimerRef.current = null;
      persistDocumentSnapshot(flowSnapshot, nodeSnapshot, edgeSnapshot).then(() => {
        if (documentRevisionRef.current === editRevision) setMessage(t.autoSaved);
      }).catch((error) => {
        if (documentRevisionRef.current === editRevision) setMessage(String(error));
      });
    }, 650);
  }, [persistDocumentSnapshot, t.autoSaved, t.autoSaving, t.topologyApplyFirst]);
  const rememberGraph = (0, import_react2.useCallback)(() => {
    const snapshot = graphSnapshot(nodesRef.current, edgesRef.current);
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) {
      history.past.push(snapshot);
      if (history.past.length > 60) history.past.shift();
    }
    history.future = [];
  }, []);
  const restoreGraph = (0, import_react2.useCallback)((snapshot) => {
    markCanvasTopologyEdit();
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    if (selected && !snapshot.nodes.some((node) => node.id === selected)) {
      setSelected(null);
      setActiveDoc("workflow");
    }
    if (selectedEdge && !snapshot.edges.some((edge) => edge.id === selectedEdge)) setSelectedEdge(null);
    ++documentRevisionRef.current;
    setDirty(true);
  }, [markCanvasTopologyEdit, selected, selectedEdge, setEdges, setNodes]);
  const undoGraph = (0, import_react2.useCallback)(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(graphSnapshot(nodesRef.current, edgesRef.current));
    restoreGraph(previous);
  }, [restoreGraph]);
  const redoGraph = (0, import_react2.useCallback)(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(graphSnapshot(nodesRef.current, edgesRef.current));
    restoreGraph(next);
  }, [restoreGraph]);
  const showConnectionWarning = (0, import_react2.useCallback)((problem) => {
    const warning = typeof problem === "string" ? problem : connectionProblemMessage(problem, t);
    setMessage(warning || t.invalidConnection);
    setConnectionWarning(warning || t.invalidConnection);
  }, [t]);
  const commitConnection = (0, import_react2.useCallback)((conn, requestedBranch = null) => {
    const problem = connectionProblem(nodesRef.current, edgesRef.current, conn, requestedBranch);
    if (!problem.valid) {
      showConnectionWarning(problem);
      return false;
    }
    const sourceNode = nodesRef.current.find((node) => node.id === conn.source);
    const condition = sourceNode?.data?.kind === "condition";
    const branch = condition ? problem.branch : null;
    const edge = {
      ...conn,
      id: `e-${Math.random().toString(36).slice(2, 9)}`,
      type: "workflow",
      ...condition ? {
        sourceHandle: branch,
        label: branchDisplayLabel(branch, t),
        autoLogicLabel: true
      } : {}
    };
    rememberGraph();
    markCanvasTopologyEdit();
    const nextEdges = [...edgesRef.current, edge];
    edgesRef.current = nextEdges;
    setEdges(nextEdges);
    ++documentRevisionRef.current;
    setDirty(true);
    return true;
  }, [markCanvasTopologyEdit, rememberGraph, setEdges, showConnectionWarning, t]);
  const onConnect = (0, import_react2.useCallback)((conn) => {
    const problem = connectionProblem(nodesRef.current, edgesRef.current, conn);
    if (!problem.valid) {
      showConnectionWarning(problem);
      return;
    }
    const sourceNode = nodesRef.current.find((node) => node.id === conn.source);
    if (sourceNode?.data?.kind !== "condition") {
      commitConnection(conn);
      return;
    }
    const gateType = conditionGateType(sourceNode, edgesRef.current.filter((edge) => edge.source === conn.source));
    if (gateType === "ifElse") {
      setPendingConnection({ connection: conn, available: problem.available ?? [] });
      return;
    }
    commitConnection(conn, gateType);
  }, [commitConnection, showConnectionWarning]);
  const onConnectionRejected = (0, import_react2.useCallback)((conn) => {
    showConnectionWarning(connectionProblem(nodesRef.current, edgesRef.current, conn));
  }, [showConnectionWarning]);
  const onReconnect = (0, import_react2.useCallback)((oldEdge, connectionParams) => {
    rememberGraph();
    markCanvasTopologyEdit();
    setEdges((items) => reconnectFlowEdge(oldEdge, connectionParams, items).map((edge) => edge.id === oldEdge.id ? {
      ...edge,
      label: branchDisplayLabel(gateBranchForEdge(connectionParams), t),
      autoLogicLabel: true
    } : edge));
    ++documentRevisionRef.current;
    setDirty(true);
  }, [markCanvasTopologyEdit, rememberGraph, setEdges, t]);
  const isValidConnection = (0, import_react2.useCallback)((connectionParams) => {
    return connectionProblem(nodesRef.current, edgesRef.current, connectionParams).valid;
  }, []);
  const moveNode = (0, import_react2.useCallback)((id, position) => {
    setNodes((items) => items.map((node) => node.id === id ? { ...node, position } : node));
    try {
      const key = `deepseek-flow:positions:${currentId}`;
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      stored[id] = position;
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
    }
    ++documentRevisionRef.current;
    setDirty(true);
  }, []);
  const createNode = (kind, gateType = null) => {
    rememberGraph();
    markCanvasTopologyEdit();
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node = {
      id,
      type: "flow",
      position: { x: 120 + Math.random() * 220, y: 80 + Math.random() * 160 },
      data: {
        kind,
        label: t.nodeKind[kind] ?? kind,
        ...kind === "condition" ? { gateType: normalizeGateType(gateType) } : {},
        ...kind === "agent" || kind === "mapAgent" ? { prompt: "{{input}}" } : {}
      }
    };
    const nextNodes = [...nodesRef.current, node];
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    setSelected(id);
    setSelectedEdge(null);
    setActiveDoc(id);
    ++documentRevisionRef.current;
    setDirty(true);
  };
  const addNode = (kind) => {
    if (kind === "condition") {
      setGatePickerOpen(true);
      return;
    }
    createNode(kind);
  };
  const patchSelected = (patch) => {
    const topologyKeys = ["label", "gateType", "predicate", "inputPredicates", "order"];
    const changesTopology = Object.keys(patch).some((key) => topologyKeys.includes(key));
    if (changesTopology) markCanvasTopologyEdit();
    const nextNodes = nodes.map((node) => node.id === selected ? { ...node, data: { ...node.data, ...patch } } : node);
    setNodes(nextNodes);
    nodesRef.current = nextNodes;
    setDirty(true);
    if (changesTopology) {
      ++documentRevisionRef.current;
    } else {
      scheduleDocumentSave(currentFlow, nextNodes, edges);
    }
  };
  const patchGateType = (gateType) => {
    if (!selectedNode || selectedNode.data.kind !== "condition") return;
    if (edgesRef.current.some((edge) => edge.source === selectedNode.id)) {
      showConnectionWarning(t.gateChangeBlocked);
      return;
    }
    patchSelected({ gateType: normalizeGateType(gateType) });
  };
  const patchDoc = (rel) => {
    if (!currentFlow || !selected) return;
    const docs = { ...currentFlow.docs ?? {} };
    if (rel && rel.trim()) docs[selected] = rel.trim();
    else delete docs[selected];
    const nextFlow = { ...currentFlow, docs };
    setFlows((items) => items.map((flow) => flow.id === currentId ? nextFlow : flow));
    setNodes((items) => items.map((node) => node.id === selected ? { ...node, data: { ...node.data, docPath: docs[selected] ?? "" } } : node));
    setDirty(true);
    scheduleDocumentSave(nextFlow, nodes.map((node) => node.id === selected ? { ...node, data: { ...node.data, docPath: docs[selected] ?? "" } } : node), edges);
  };
  const patchWorkflowContent = (value) => {
    if (!currentFlow) return;
    const nextFlow = { ...currentFlow, workflowContent: value };
    setFlows((items) => items.map((flow) => flow.id === currentId ? nextFlow : flow));
    setDirty(true);
    scheduleDocumentSave(nextFlow, nodes, edges);
  };
  const removeSelected = () => {
    if (selected === null) return;
    rememberGraph();
    markCanvasTopologyEdit();
    setNodes((nds) => nds.filter((n) => n.id !== selected));
    setEdges((eds) => eds.filter((e) => e.source !== selected && e.target !== selected));
    setFlows((items) => items.map((flow) => {
      if (flow.id !== currentId) return flow;
      const docs = { ...flow.docs ?? {} };
      delete docs[selected];
      return { ...flow, docs };
    }));
    setSelected(null);
    setActiveDoc("workflow");
    ++documentRevisionRef.current;
    setDirty(true);
  };
  const removeSelectedEdge = (0, import_react2.useCallback)(() => {
    if (!selectedEdge) return;
    rememberGraph();
    markCanvasTopologyEdit();
    setEdges((items) => items.filter((edge) => edge.id !== selectedEdge));
    setSelectedEdge(null);
    ++documentRevisionRef.current;
    setDirty(true);
  }, [markCanvasTopologyEdit, rememberGraph, selectedEdge, setEdges]);
  const tidyGraph = (0, import_react2.useCallback)(() => {
    if (nodesRef.current.length === 0) return;
    rememberGraph();
    const next = layoutNodes(nodesRef.current, edgesRef.current);
    setNodes(next);
    nodesRef.current = next;
    ++documentRevisionRef.current;
    setDirty(true);
    setTimeout(() => flowInstance?.fitView?.({ padding: 0.2, duration: 250 }), 0);
  }, [flowInstance, rememberGraph, setNodes]);
  const save = async () => {
    if (currentId === null) return false;
    if (topologyDirty || !persistedFlowRef.current) {
      setTopologyApplyConfirm(true);
      setMessage(t.topologyPending);
      return false;
    }
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    documentTimerRef.current = null;
    ++documentRevisionRef.current;
    setMessage(t.saving);
    try {
      await persistDocumentSnapshot(currentFlow, nodes, edges);
      setDirty(false);
      setMessage(t.saved);
      return true;
    } catch (error) {
      setMessage(String(error));
      return false;
    }
  };
  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const flow = JSON.parse(await file.text());
      if (!flow.id || !Array.isArray(flow.nodes)) throw new Error("missing id/nodes");
      markCanvasTopologyEdit();
      const existing = flows.find((candidate) => candidate.id === flow.id) ?? null;
      currentIdRef.current = flow.id;
      setCurrentId(flow.id);
      setFlows((fs) => [flow, ...fs.filter((f) => f.id !== flow.id)]);
      persistedFlowRef.current = existing;
      if (existing) persistedRevisionRef.current.set(flow.id, Number(existing.revision) || 0);
      else persistedRevisionRef.current.delete(flow.id);
      setPersistedTopologySignature(topologySignature(existing ?? {
        ...flow,
        nodes: [],
        edges: [],
        inputs: [],
        outputs: []
      }));
      setNodes(flowToCanvasNodes(flow, loadPositionOverrides(flow.id)));
      setEdges(flowToCanvasEdges(flow.edges, t));
      setSelected(null);
      setActiveDoc("workflow");
      setDirty(true);
      setTopologyApplyConfirm(false);
      setMessage(t.importOk + flow.name);
    } catch (error) {
      setMessage(t.invalidJson + String(error));
    }
    event.target.value = "";
  };
  const exportJson = () => {
    if (currentId === null || currentFlow === null) return;
    const flow = serializeFlow(currentFlow, nodes, edges);
    download(JSON.stringify(flow, null, 2), `${flow.id}.json`, "application/json");
    setMessage(t.exportOk);
  };
  const assistantTarget = activeDoc === "workflow" ? "workflow" : activeDoc;
  const assistantDocLabel = assistantTarget === "workflow" ? currentFlow?.workflowDoc ?? "WORKFLOW.md" : currentFlow?.docs?.[assistantTarget] ?? `${assistantTarget}/STEP.md`;
  const assistantTargetRef = import_react2.default.useRef(assistantTarget);
  (0, import_react2.useEffect)(() => {
    assistantTargetRef.current = assistantTarget;
  }, [assistantTarget]);
  (0, import_react2.useEffect)(() => {
    const proposal = proposalStoreRef.current.get(assistantTarget);
    if (proposal && typeof proposal.suggestedContent === "string") {
      setOptimizationProposal(proposal);
      setAssistantDraft(proposal.suggestedContent);
    } else {
      setOptimizationProposal(null);
      setAssistantDraft("");
    }
  }, [currentId, assistantTarget]);
  const contentForDocument = (target) => {
    if (target === "workflow") return String(currentFlow?.workflowContent ?? "");
    const node = nodes.find((candidate) => candidate.id === target);
    return String(node?.data?.prompt ?? node?.data?.instructions ?? "");
  };
  const pollAssist = (agentRequestId, onDone) => {
    const timer = setInterval(async () => {
      try {
        const history = await remoteCall(connection, "dflow/assistHistory", { sessionId });
        const entry = (Array.isArray(history) ? history : []).find((item) => item.key === `${sessionId}:${agentRequestId}`);
        if (!entry || entry.status === "running") return;
        clearInterval(timer);
        onDone(entry);
      } catch {
      }
    }, 3e3);
    return () => clearInterval(timer);
  };
  const applyTopologyChanges = async () => {
    if (!currentFlow || !currentDraftFlow || topologyApplyBusy) return;
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(true);
    setMessage(t.topologyApplying);
    const requestId = newRequestId();
    try {
      const latestItems = await remoteCall(connection, "dflow/list", { sessionId });
      const latestFlow = (Array.isArray(latestItems) ? latestItems : []).find((item) => item.id === currentFlow.id);
      const localBase = persistedFlowRef.current;
      if (latestFlow && localBase && (Number(latestFlow.revision) || 0) > (persistedRevisionRef.current.get(currentFlow.id) ?? 0)) {
        const liveDraft = serializeFlow(localBase, nodesRef.current, edgesRef.current);
        const decision = topologySyncDecision(localBase, liveDraft, latestFlow);
        if (decision === "conflict") throw new Error(t.topologySessionConflict);
        setFlows(latestItems);
        if (decision === "already-persisted" || decision === "remote-advanced-clean") {
          showFlow(latestFlow, { resetDocument: false });
          setTopologyApplyBusy(false);
          setDirty(false);
          setMessage(decision === "already-persisted" ? t.topologyAlreadyPersisted : t.topologySessionSynced);
          return;
        }
        persistedFlowRef.current = latestFlow;
        persistedRevisionRef.current.set(latestFlow.id, Number(latestFlow.revision) || 0);
        setPersistedTopologySignature(topologySignature(latestFlow));
      }
      if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
      documentTimerRef.current = null;
      if (persistedFlowRef.current) {
        await persistDocumentSnapshot(currentFlow, nodes, edges);
      } else {
        await documentWriteChainRef.current.catch(() => {
        });
      }
      const draftFlow = serializeFlow(currentFlow, nodesRef.current, edgesRef.current);
      const submittedSignature = topologySignature(draftFlow);
      const baseFlow = persistedFlowRef.current ?? {
        ...draftFlow,
        nodes: [],
        edges: [],
        inputs: [],
        outputs: []
      };
      const accepted = await remoteCall(connection, "dflow/topologyApply", {
        request: {
          sessionId,
          requestId,
          draftFlow,
          baseTopology: topologyProjection(baseFlow),
          ...assistModel ? { model: assistModel } : {},
          ...assistEffort ? { reasoningEffort: assistEffort } : {}
        }
      });
      if (!accepted?.accepted) {
        setTopologyApplyBusy(false);
        if (accepted?.flow) {
          const saved = accepted.flow;
          setFlows((items) => items.some((item) => item.id === saved.id) ? items.map((item) => item.id === saved.id ? { ...item, ...saved } : item) : [saved, ...items]);
          showFlow(saved, { resetDocument: false });
        }
        setDirty(false);
        setMessage(accepted?.alreadyPersisted ? t.topologyAlreadyPersisted : t.topologyNoChanges);
        return;
      }
      topologyPollRef.current?.();
      topologyPollRef.current = pollAssist(requestId, (entry) => {
        topologyPollRef.current = null;
        setTopologyApplyBusy(false);
        if (entry.status !== "done" || !entry.result?.flow) {
          setMessage(t.topologyApplyFailed + String(entry.error ?? ""));
          return;
        }
        const saved = entry.result.flow;
        persistedFlowRef.current = saved;
        persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
        setPersistedTopologySignature(topologySignature(saved));
        setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
        const liveFlow = serializeFlow(
          currentIdRef.current === saved.id ? flows.find((item) => item.id === saved.id) ?? saved : saved,
          nodesRef.current,
          edgesRef.current
        );
        if (currentIdRef.current === saved.id && topologySignature(liveFlow) === submittedSignature) {
          showFlow(saved, { resetDocument: false });
          setDirty(false);
          setMessage(entry.result.summary ? `${t.topologyApplied}\uFF1A${entry.result.summary}` : t.topologyApplied);
        } else if (currentIdRef.current === saved.id) {
          setDirty(true);
          setMessage(t.topologyAppliedWithNewDraft);
        }
      });
    } catch (error) {
      setTopologyApplyBusy(false);
      setMessage(t.topologyApplyFailed + String(error));
    }
  };
  const runLogicValidation = async () => {
    if (!currentFlow) return;
    const requestId = newRequestId();
    const flow = serializeFlow(currentFlow, nodes, edges);
    const flowId = flow.id;
    activeAssistRef.current = { requestId, mode: "logic", cancelled: false };
    setAssistantOpen(true);
    setAssistantBusy("logic");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: { sessionId, requestId, flow, mode: "logic", ...assistModel ? { model: assistModel } : {}, ...assistEffort ? { reasoningEffort: assistEffort } : {} }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      pollTimerRef.current?.();
      pollTimerRef.current = pollAssist(requestId, (entry) => {
        if (entry.status === "cancelled") {
          setMessage(t.assistantCancelled);
        } else if (entry.status === "done" && entry.result) {
          setValidationResult(entry.result);
          setFindingFilter(null);
          setMessage(t.validationComplete);
        } else {
          setMessage(t.assistantFailed + String(entry.error ?? ""));
        }
        activeAssistRef.current = null;
        setAssistantBusy(null);
      });
    } catch (error) {
      if (activeAssistRef.current?.requestId === requestId) {
        activeAssistRef.current = null;
        setAssistantBusy(null);
        setMessage(t.assistantFailed + String(error));
      }
    }
  };
  const runDocumentOptimization = async () => {
    if (!currentFlow) return;
    const requestId = ++optimizationRequestRef.current;
    const agentRequestId = newRequestId();
    const target = assistantTarget;
    const documentLabel = assistantDocLabel;
    const flow = serializeFlow(currentFlow, nodes, edges);
    const flowId = flow.id;
    activeAssistRef.current = { requestId: agentRequestId, mode: "optimize", cancelled: false };
    setAssistantOpen(true);
    setRunningDocs((prev) => {
      const next = new Map(prev);
      next.set(target, agentRequestId);
      return next;
    });
    setAssistantDraft("");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: { sessionId, requestId: agentRequestId, flow, mode: "optimize", target, instruction: assistantInstruction, ...assistModel ? { model: assistModel } : {}, ...assistEffort ? { reasoningEffort: assistEffort } : {} }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      pollTimerRef.current?.();
      pollTimerRef.current = pollAssist(agentRequestId, (entry) => {
        if (entry.status === "cancelled") {
          if (assistantTargetRef.current === target) setMessage(t.assistantCancelled);
        } else if (entry.status === "done" && entry.result) {
          const proposal = { ...entry.result, target: entry.result.target ?? target, documentLabel };
          proposalStoreRef.current.set(target, proposal);
          if (assistantTargetRef.current === target) {
            setOptimizationProposal(proposal);
            setAssistantDraft(proposal.suggestedContent ?? "");
          }
        } else {
          proposalStoreRef.current.set(target, { status: "error", target, documentLabel, error: String(entry.error ?? "failed") });
          if (assistantTargetRef.current === target) setMessage(t.assistantFailed + String(entry.error ?? ""));
        }
        setRunningDocs((prev) => {
          const next = new Map(prev);
          next.delete(target);
          return next;
        });
        activeAssistRef.current = null;
      });
    } catch (error) {
      if (activeAssistRef.current?.requestId === agentRequestId) {
        activeAssistRef.current = null;
        setAssistantBusy(null);
        setMessage(t.assistantFailed + String(error));
      }
    }
  };
  const waitForPersistedFlow = () => new Promise((resolve) => {
    if (persistedFlowRef.current) {
      resolve(persistedFlowRef.current);
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      if (persistedFlowRef.current || ++tries > 50) {
        clearInterval(timer);
        resolve(persistedFlowRef.current);
      }
    }, 100);
  });
  const appliedWorkflowAssistRef = import_react2.default.useRef(null);
  const isWorkflowAssistApplied = (requestId) => {
    if (!appliedWorkflowAssistRef.current) {
      try {
        appliedWorkflowAssistRef.current = new Set(JSON.parse(window.sessionStorage.getItem("deepseek-flow:applied-workflow-assists") ?? "[]"));
      } catch {
        appliedWorkflowAssistRef.current = /* @__PURE__ */ new Set();
      }
    }
    return appliedWorkflowAssistRef.current.has(requestId);
  };
  const markWorkflowAssistApplied = (requestId) => {
    appliedWorkflowAssistRef.current ??= /* @__PURE__ */ new Set();
    appliedWorkflowAssistRef.current.add(requestId);
    try {
      window.sessionStorage.setItem("deepseek-flow:applied-workflow-assists", JSON.stringify([...appliedWorkflowAssistRef.current]));
    } catch {
    }
  };
  const applyWorkflowOptimization = async (entry, { requestId, flow, sourceRevision, requireUnchangedRevision }) => {
    const stop = (message2) => {
      if (message2) setMessage(message2);
      activeAssistRef.current = null;
      setAssistantBusy(null);
    };
    if (entry.status === "cancelled") return stop(t.assistantCancelled);
    if (entry.status !== "done" || !entry.result) return stop(t.assistantFailed + String(entry.error ?? ""));
    if (requestId && isWorkflowAssistApplied(requestId)) return;
    if (!flow) {
      flow = await waitForPersistedFlow();
      if (!flow) return stop(t.assistantFailed);
    }
    if (requireUnchangedRevision && documentRevisionRef.current !== sourceRevision) return stop(t.workflowChangedDuringOptimization);
    const result = entry.result;
    const optimized = new Map((result.documents ?? []).map((document2) => [document2.documentId, String(document2.content ?? "")]));
    const optimizedFlow = {
      ...flow,
      workflowContent: optimized.get("workflow") ?? flow.workflowContent,
      nodes: flow.nodes.map((node) => {
        const content = optimized.get(node.id);
        if (content === void 0) return node;
        const key = node.kind === "agent" || node.kind === "mapAgent" ? "prompt" : "instructions";
        return { ...node, data: { ...node.data, [key]: content } };
      })
    };
    const flowId = flow.id;
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    documentTimerRef.current = null;
    ++documentRevisionRef.current;
    await documentWriteChainRef.current.catch(() => {
    });
    const documentOnly = mergeDocumentEdits(persistedFlowRef.current, optimizedFlow, optimizedFlow.nodes);
    const persistedRevision = persistedRevisionRef.current.get(documentOnly.id);
    const payload = Number.isInteger(persistedRevision) ? { ...documentOnly, revision: persistedRevision } : documentOnly;
    const saved = await remoteCall(connection, "dflow/put", { flow: payload, sessionId });
    persistedFlowRef.current = saved;
    persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
    setPersistedTopologySignature(topologySignature(saved));
    if (requestId) markWorkflowAssistApplied(requestId);
    if (currentIdRef.current !== flowId) return stop();
    setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
    if (topologySignature(optimizedFlow) === topologySignature(saved)) {
      showFlow(saved, { resetDocument: false });
      setDirty(false);
    } else {
      markCanvasTopologyEdit();
      const draftNodes = flowToCanvasNodes({ ...optimizedFlow, docs: saved.docs });
      setNodes(draftNodes);
      nodesRef.current = draftNodes;
      setDirty(true);
    }
    stop(result.summary ? `${t.workflowOptimized}\uFF1A${result.summary}` : t.workflowOptimized);
  };
  const runWorkflowOptimization = async () => {
    if (!currentFlow) return;
    if (!persistedFlowRef.current) {
      setWorkflowOptimizeConfirm(false);
      setMessage(t.topologyApplyFirst);
      return;
    }
    setWorkflowOptimizeConfirm(false);
    const agentRequestId = newRequestId();
    const flow = serializeFlow(currentFlow, nodes, edges);
    const sourceRevision = documentRevisionRef.current;
    activeAssistRef.current = { requestId: agentRequestId, mode: "optimize-workflow", cancelled: false };
    setAssistantOpen(true);
    setAssistantBusy("optimize-workflow");
    setOptimizationProposal(null);
    setAssistantDraft("");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: {
          sessionId,
          requestId: agentRequestId,
          flow,
          mode: "optimize-workflow",
          instruction: assistantInstruction,
          ...assistModel ? { model: assistModel } : {},
          ...assistEffort ? { reasoningEffort: assistEffort } : {}
        }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      pollTimerRef.current?.();
      pollTimerRef.current = pollAssist(agentRequestId, (entry) => applyWorkflowOptimization(entry, {
        requestId: agentRequestId,
        flow,
        sourceRevision,
        requireUnchangedRevision: true
      }));
    } catch (error) {
      if (activeAssistRef.current?.requestId === agentRequestId) {
        activeAssistRef.current = null;
        setAssistantBusy(null);
        setMessage(t.assistantFailed + String(error));
      }
    }
  };
  const cancelOptimizeFor = async (target) => {
    const requestId = runningDocs.get(target);
    if (!requestId) return;
    await remoteCall(connection, "dflow/assistCancel", {
      request: { sessionId, requestId }
    }).catch(() => {
    });
    setRunningDocs((prev) => {
      const next = new Map(prev);
      next.delete(target);
      return next;
    });
    setMessage(t.assistantCancelled);
  };
  const cancelAssistant = async () => {
    const active = activeAssistRef.current;
    if (!active) return;
    active.cancelled = true;
    setAssistantBusy("cancelling");
    setMessage(t.assistantCancelled);
    try {
      await remoteCall(connection, "dflow/assistCancel", {
        request: { sessionId, requestId: active.requestId }
      });
    } catch (error) {
      if (activeAssistRef.current?.requestId === active.requestId) setMessage(t.assistantFailed + String(error));
    }
  };
  const discardOptimization = () => {
    ++optimizationRequestRef.current;
    if (optimizationProposal?.target) proposalStoreRef.current.delete(optimizationProposal.target);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setMessage(t.discardedSuggestion);
  };
  const acceptOptimization = () => {
    const target = optimizationProposal?.target;
    if (!target || !assistantDraft || !currentFlow) return;
    if (contentForDocument(target) !== String(optimizationProposal.originalContent ?? "")) {
      setMessage(t.staleSuggestion);
      return;
    }
    if (target === "workflow") {
      patchWorkflowContent(assistantDraft);
    } else {
      const targetNode = nodes.find((node) => node.id === target);
      if (!targetNode) return;
      const key = targetNode.data.kind === "agent" || targetNode.data.kind === "mapAgent" ? "prompt" : "instructions";
      const nextNodes = nodes.map((node) => node.id === target ? { ...node, data: { ...node.data, [key]: assistantDraft } } : node);
      setNodes(nextNodes);
      setDirty(true);
      scheduleDocumentSave(currentFlow, nextNodes, edges);
    }
    ++optimizationRequestRef.current;
    proposalStoreRef.current.delete(target);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setMessage(t.acceptedSuggestion);
  };
  const focusFinding = (finding) => {
    const documentId = finding.documentId ?? finding.nodeId ?? "workflow";
    if (documentId === "workflow") setActiveDoc("workflow");
    else if (nodes.some((node) => node.id === documentId)) setActiveDoc(documentId);
    if (finding.nodeId && nodes.some((node) => node.id === finding.nodeId)) {
      setSelected(finding.nodeId);
      setSelectedEdge(null);
      flowInstance?.focusNode?.(finding.nodeId, { duration: 720 });
    } else if (finding.edgeId && edges.some((edge) => edge.id === finding.edgeId)) {
      setSelected(null);
      setSelectedEdge(finding.edgeId);
    }
  };
  (0, import_react2.useEffect)(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      const editingText = tag === "input" || tag === "textarea" || tag === "select" || event.target?.isContentEditable;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
        return;
      }
      if (!editingText && command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoGraph();
        else undoGraph();
        return;
      }
      if (!editingText && (event.key === "Delete" || event.key === "Backspace")) {
        if (selectedEdge) {
          event.preventDefault();
          removeSelectedEdge();
        } else if (selected) {
          event.preventDefault();
          removeSelected();
        }
        return;
      }
      if (!editingText && event.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoGraph, removeSelectedEdge, save, selected, selectedEdge, undoGraph]);
  const addBar = import_react2.default.createElement(
    "div",
    { className: "df-addbar" },
    import_react2.default.createElement("span", { className: "df-node__kind", style: { alignSelf: "center", color: "var(--df-ink-2)" } }, t.addNode),
    ["input", "agent", "mapAgent", "condition", "merge", "output"].map(
      (kind) => import_react2.default.createElement("button", { key: kind, className: "df-btn", onClick: () => addNode(kind) }, t.nodeKind[kind])
    ),
    import_react2.default.createElement("span", { className: "df-connect-hint" }, t.connectHint)
  );
  const toolbar = import_react2.default.createElement(
    "div",
    { className: "df-toolbar" },
    import_react2.default.createElement(
      "label",
      null,
      t.flow,
      import_react2.default.createElement(
        "select",
        { value: currentId ?? "", onChange: (e) => selectFlow(e.target.value) },
        flows.map((f) => import_react2.default.createElement("option", { key: f.id, value: f.id }, `${f.name}${f.sessionId ? "" : ` (${t.shared})`}`))
      )
    ),
    import_react2.default.createElement("button", { className: "df-btn is-ghost", onClick: () => fileRef.current?.click() }, t.importLabel),
    import_react2.default.createElement("input", { ref: fileRef, type: "file", accept: ".json,application/json", className: "df-import-hidden", onChange: onImportFile }),
    import_react2.default.createElement("button", { className: "df-btn is-ghost", onClick: exportJson, disabled: currentId === null }, t.exportLabel),
    import_react2.default.createElement("button", { className: "df-btn", onClick: save, disabled: currentId === null || !dirty }, t.save),
    import_react2.default.createElement("button", { className: "df-btn df-iconbtn is-ghost", title: `${t.undo} \xB7 Ctrl/Cmd+Z`, "aria-label": t.undo, onClick: undoGraph }, "\u21B6"),
    import_react2.default.createElement("button", { className: "df-btn df-iconbtn is-ghost", title: `${t.redo} \xB7 Ctrl/Cmd+Shift+Z`, "aria-label": t.redo, onClick: redoGraph }, "\u21B7"),
    import_react2.default.createElement("button", { className: "df-btn is-ghost", title: t.tidy, onClick: tidyGraph, disabled: nodes.length === 0 }, t.tidy),
    import_react2.default.createElement("button", { className: "df-btn is-ghost", title: t.fitAll, onClick: () => fitWholeFlow(240), disabled: nodes.length === 0 }, t.fitAll),
    import_react2.default.createElement("span", { className: "df-status" }, message)
  );
  const chooseDocument = (id) => {
    setActiveDoc(id);
    setSelected(id === "workflow" ? null : id);
    setSelectedEdge(null);
    if (id === "workflow") flowInstance?.fitView?.({ padding: 0.18, duration: 680 });
    else flowInstance?.focusNode?.(id, { duration: 720 });
  };
  const documentRail = import_react2.default.createElement(
    "aside",
    { className: `df-docrail${documentsOpen ? "" : " is-collapsed"}` },
    import_react2.default.createElement(
      "div",
      { className: "df-docrail__head" },
      import_react2.default.createElement("div", { className: "df-docrail__title" }, t.documents),
      import_react2.default.createElement("div", { className: "df-docrail__note" }, t.documentFirstNote)
    ),
    documentsOpen && import_react2.default.createElement(
      "div",
      { className: "df-docrail__list" },
      import_react2.default.createElement("div", { className: "df-docgroup" }, t.workflowDoc),
      import_react2.default.createElement(
        "button",
        {
          className: `df-docitem${activeDoc === "workflow" ? " is-active" : ""}`,
          onClick: () => chooseDocument("workflow")
        },
        import_react2.default.createElement("span", { className: "df-docitem__icon" }, "MD"),
        import_react2.default.createElement(
          "span",
          null,
          import_react2.default.createElement("span", { className: "df-docitem__label" }, currentFlow?.workflowDoc ?? "WORKFLOW.md"),
          import_react2.default.createElement("span", { className: "df-docitem__path" }, currentFlow?.docRoot ?? t.none)
        )
      ),
      import_react2.default.createElement("div", { className: "df-docgroup" }, t.stepDocs),
      nodes.map((node, index) => import_react2.default.createElement(
        "button",
        {
          key: node.id,
          className: `df-docitem${activeDoc === node.id ? " is-active" : ""}`,
          onClick: () => chooseDocument(node.id)
        },
        import_react2.default.createElement("span", { className: "df-docitem__icon" }, String(index + 1).padStart(2, "0")),
        import_react2.default.createElement(
          "span",
          null,
          import_react2.default.createElement("span", { className: "df-docitem__label" }, String(node.data.label ?? node.id)),
          import_react2.default.createElement("span", { className: "df-docitem__path" }, currentFlow?.docs?.[node.id] ?? t.filePath)
        )
      ))
    )
  );
  const inspector = import_react2.default.createElement(
    "aside",
    { className: `df-inspector${inspectorOpen ? "" : " is-collapsed"}` },
    import_react2.default.createElement(
      "div",
      { className: "df-inspector__scroll" },
      activeDoc === "workflow" && currentFlow ? [
        import_react2.default.createElement("h3", { key: "title" }, currentFlow.workflowDoc ?? "WORKFLOW.md"),
        import_react2.default.createElement("div", { key: "badge", className: "df-node__kind", style: { color: "var(--df-brand)" } }, t.documentFirst),
        import_react2.default.createElement(
          "div",
          { key: "root", className: "df-pathbox" },
          import_react2.default.createElement("span", { className: "df-pathbox__label" }, t.docRoot),
          import_react2.default.createElement("span", { className: "df-pathbox__value" }, currentFlow.docRoot ?? t.none)
        ),
        import_react2.default.createElement(
          "label",
          { key: "content" },
          t.markdownContent,
          import_react2.default.createElement("textarea", {
            className: "df-markdown-editor",
            value: String(currentFlow.workflowContent ?? ""),
            onChange: (event) => patchWorkflowContent(event.target.value),
            spellCheck: false
          })
        )
      ] : selectedNode ? [
        import_react2.default.createElement("h3", { key: "title" }, String(selectedNode.data.label ?? selectedNode.id)),
        import_react2.default.createElement(
          "div",
          { key: "path", className: "df-pathbox" },
          import_react2.default.createElement("span", { className: "df-pathbox__label" }, t.filePath),
          import_react2.default.createElement("span", { className: "df-pathbox__value" }, currentFlow?.docs?.[selected] ?? t.none)
        ),
        import_react2.default.createElement(
          "label",
          { key: "markdown" },
          t.markdownContent,
          import_react2.default.createElement("textarea", {
            className: "df-markdown-editor",
            value: String(selectedNode.data.prompt ?? selectedNode.data.instructions ?? ""),
            onChange: (event) => patchSelected(selectedNode.data.kind === "agent" || selectedNode.data.kind === "mapAgent" ? { prompt: event.target.value } : { instructions: event.target.value }),
            spellCheck: false
          })
        ),
        import_react2.default.createElement("h3", { key: "properties", style: { marginTop: 4 } }, t.properties),
        import_react2.default.createElement(
          "label",
          { key: "kind" },
          "kind",
          import_react2.default.createElement("span", { style: { color: "var(--df-ink-2)", fontSize: 12 } }, t.nodeKind[selectedNode.data.kind] ?? selectedNode.data.kind)
        ),
        import_react2.default.createElement(
          "label",
          { key: "label" },
          "label",
          import_react2.default.createElement("input", { value: String(selectedNode.data.label ?? ""), onChange: (e) => patchSelected({ label: e.target.value }) })
        ),
        import_react2.default.createElement(
          "label",
          { key: "doc" },
          t.docFile,
          import_react2.default.createElement("input", { value: currentFlow?.docs?.[selected] ?? "", placeholder: "01-step/STEP.md", onChange: (e) => patchDoc(e.target.value) })
        ),
        selectedNode.data.kind === "condition" && import_react2.default.createElement(
          "label",
          { key: "gateType" },
          t.gateTypeLabel,
          import_react2.default.createElement("select", {
            value: normalizeGateType(selectedNode.data.gateType),
            onChange: (event) => patchGateType(event.target.value)
          }, CONDITION_GATE_TYPES.map((gateType) => import_react2.default.createElement("option", { key: gateType, value: gateType }, t.gateType[gateType])))
        ),
        selectedNode.data.kind === "condition" && import_react2.default.createElement(
          "label",
          { key: "predicate" },
          t.predicate,
          import_react2.default.createElement(
            "select",
            { value: selectedNode.data.predicate ?? "truthy", onChange: (e) => patchSelected({ predicate: e.target.value }) },
            LOGIC_PREDICATES.map((p) => import_react2.default.createElement("option", { key: p, value: p }, p))
          )
        ),
        selectedNode.data.kind === "condition" && import_react2.default.createElement(
          "div",
          { key: "logicInputs", className: "df-advanced__content" },
          import_react2.default.createElement("strong", null, t.logicInputs),
          import_react2.default.createElement("span", {
            style: { color: selectedGateArityValid ? "var(--df-ink-2)" : "var(--df-err)", fontSize: 12 }
          }, `${t.logicInputCount}: ${selectedConditionInputs.length} \xB7 ${selectedGateRule.maxInputs === 1 ? t.logicInputUnary : t.logicInputAggregate}`),
          selectedConditionInputs.length === 0 ? import_react2.default.createElement("span", { style: { color: "var(--df-ink-2)", fontSize: 12 } }, t.logicInputsEmpty) : selectedConditionInputs.map((input) => import_react2.default.createElement(
            "label",
            { key: input.edgeId },
            `${input.label} \xB7 ${input.sourceId}`,
            import_react2.default.createElement("select", {
              value: selectedNode.data.inputPredicates?.[input.sourceId] ?? selectedNode.data.predicate ?? "truthy",
              onChange: (event) => patchSelected({
                inputPredicates: {
                  ...selectedNode.data.inputPredicates ?? {},
                  [input.sourceId]: event.target.value
                }
              })
            }, LOGIC_PREDICATES.map((predicate) => import_react2.default.createElement("option", { key: predicate, value: predicate }, predicate)))
          ))
        ),
        (selectedNode.data.kind === "agent" || selectedNode.data.kind === "mapAgent") && import_react2.default.createElement(
          "details",
          { key: "advanced", className: "df-advanced" },
          import_react2.default.createElement("summary", null, t.advancedHints),
          import_react2.default.createElement(
            "div",
            { className: "df-advanced__content" },
            import_react2.default.createElement(
              "label",
              null,
              t.stage,
              import_react2.default.createElement("input", { value: String(selectedNode.data.stage ?? ""), onChange: (e) => patchSelected({ stage: e.target.value }) })
            ),
            import_react2.default.createElement(
              "label",
              null,
              t.provider,
              import_react2.default.createElement("input", { value: String(selectedNode.data.provider ?? ""), onChange: (e) => patchSelected({ provider: e.target.value }) })
            ),
            import_react2.default.createElement(
              "label",
              null,
              t.model,
              import_react2.default.createElement("input", { value: String(selectedNode.data.model ?? ""), onChange: (e) => patchSelected({ model: e.target.value }) })
            ),
            import_react2.default.createElement(
              "label",
              null,
              t.outputSchema,
              import_react2.default.createElement("textarea", { value: selectedNode.data.outputSchema ? JSON.stringify(selectedNode.data.outputSchema) : "", onChange: (e) => {
                const raw = e.target.value.trim();
                try {
                  patchSelected({ outputSchema: raw ? JSON.parse(raw) : void 0 });
                } catch {
                }
              } })
            )
          )
        ),
        import_react2.default.createElement("button", { key: "del", className: "df-btn", style: { color: "var(--df-err)" }, onClick: removeSelected }, t.deleteNode)
      ] : [
        import_react2.default.createElement("h3", { key: "title" }, t.properties),
        import_react2.default.createElement("div", { key: "empty", className: "df-empty" }, t.openDocument)
      ]
    )
  );
  const findings = validationResult?.findings ?? [];
  const visibleFindings = findingFilter ? findings.filter((finding) => finding.level === findingFilter) : findings;
  const counts = validationResult?.summary?.counts ?? { error: 0, warning: 0 };
  const optimizationStale = Boolean(optimizationProposal && contentForDocument(optimizationProposal.target) !== String(optimizationProposal.originalContent ?? ""));
  const findingDocumentLabel = (finding) => {
    const documentId = finding.documentId ?? finding.nodeId ?? "workflow";
    return documentId === "workflow" ? currentFlow?.workflowDoc ?? "WORKFLOW.md" : currentFlow?.docs?.[documentId] ?? `${documentId}/STEP.md`;
  };
  const assistantPanel = import_react2.default.createElement(
    "section",
    {
      className: `df-assistant${assistantOpen ? " is-open" : ""}`,
      style: { height: assistantOpen ? `${assistantHeight}px` : "44px" }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-assistant__head" },
      import_react2.default.createElement("span", { className: "df-assistant__spark", "aria-hidden": true }, "\u2726"),
      import_react2.default.createElement("span", { className: "df-assistant__title" }, t.assistant),
      import_react2.default.createElement(
        "div",
        { className: "df-assist-menu-wrap" },
        import_react2.default.createElement(
          "button",
          {
            type: "button",
            className: "df-assist-menu-btn",
            title: t.assistModelLabel + " / " + t.assistEffortLabel,
            "data-df-action": "assistant-settings",
            onClick: () => {
              setAssistMenuOpen((open) => !open);
              setAssistMenuPage(null);
            }
          },
          assistModel || t.assistModelFollow,
          " \xB7 ",
          assistEffort === "off" ? t.assistEffortOff : assistEffort === "high" ? t.assistEffortHigh : assistEffort === "max" ? t.assistEffortMax : t.assistEffortFollow,
          import_react2.default.createElement("span", { className: "df-assist-menu-caret", "aria-hidden": true }, "\u25BC")
        ),
        assistMenuOpen && import_react2.default.createElement(
          "div",
          { className: "df-assist-menu" },
          assistMenuPage === null ? [
            import_react2.default.createElement("button", { key: "m", type: "button", className: "df-assist-menu-item", onClick: () => setAssistMenuPage("model") }, t.assistModelLabel, "\uFF1A", assistModel || t.assistModelFollow),
            import_react2.default.createElement("button", { key: "e", type: "button", className: "df-assist-menu-item", onClick: () => setAssistMenuPage("effort") }, t.assistEffortLabel, "\uFF1A", assistEffort === "off" ? t.assistEffortOff : assistEffort === "high" ? t.assistEffortHigh : assistEffort === "max" ? t.assistEffortMax : t.assistEffortFollow)
          ] : assistMenuPage === "model" ? [
            import_react2.default.createElement("button", { key: "back", type: "button", className: "df-assist-menu-back", onClick: () => setAssistMenuPage(null) }, "\u2039 ", t.assistModelLabel),
            import_react2.default.createElement("button", { key: "follow", type: "button", className: "df-assist-menu-item", onClick: () => {
              setAssistModel("");
              setAssistMenuOpen(false);
            } }, t.assistModelFollow),
            ...(assistModelOptions ?? []).map(
              (option) => import_react2.default.createElement("button", {
                key: `${option.provider}/${option.model}`,
                type: "button",
                className: "df-assist-menu-item",
                onClick: () => {
                  setAssistModel(option.model);
                  setAssistMenuOpen(false);
                }
              }, option.model)
            )
          ] : [
            import_react2.default.createElement("button", { key: "back", type: "button", className: "df-assist-menu-back", onClick: () => setAssistMenuPage(null) }, "\u2039 ", t.assistEffortLabel),
            [["", t.assistEffortFollow], ["off", t.assistEffortOff], ["high", t.assistEffortHigh], ["max", t.assistEffortMax]].map(
              ([value, label]) => import_react2.default.createElement("button", {
                key: value,
                type: "button",
                className: "df-assist-menu-item",
                onClick: () => {
                  setAssistEffort(value);
                  setAssistMenuOpen(false);
                }
              }, label)
            )
          ]
        )
      ),
      import_react2.default.createElement("span", { className: "df-assistant__target", title: `${t.assistantTarget}: ${assistantDocLabel}` }, assistantDocLabel),
      import_react2.default.createElement(
        "div",
        { className: "df-assistant__actions" },
        import_react2.default.createElement("button", {
          className: `df-btn is-primary${topologyDirty && assistantBusy !== "logic" ? " is-disabled" : ""}`,
          "data-df-action": "logic-validation",
          "aria-disabled": topologyDirty && assistantBusy !== "logic" ? "true" : void 0,
          disabled: assistantBusy === "cancelling" && activeAssistRef.current?.mode === "logic",
          onClick: () => {
            if (assistantBusy === "logic") {
              setCancelConfirm({ mode: "logic" });
              return;
            }
            if (topologyDirty) {
              setMessage(t.topologyPending);
              return;
            }
            runLogicValidation();
          }
        }, assistantBusy === "logic" ? t.cancelValidation : assistantBusy === "cancelling" && activeAssistRef.current?.mode === "logic" ? "\u2026" : t.logicValidation),
        import_react2.default.createElement("button", {
          className: "df-btn",
          "data-df-action": "optimize-document",
          disabled: !currentFlow,
          onClick: () => {
            if (runningDocs.get(assistantTarget) !== void 0) {
              setCancelConfirm({ mode: "document" });
              return;
            }
            runDocumentOptimization();
          }
        }, runningDocs.get(assistantTarget) !== void 0 ? t.cancelDocOptimize : t.aiOptimize),
        import_react2.default.createElement("button", {
          className: `df-btn${topologyDirty && assistantBusy !== "optimize-workflow" ? " is-disabled" : ""}`,
          "data-df-action": "optimize-workflow",
          "aria-disabled": topologyDirty && assistantBusy !== "optimize-workflow" ? "true" : void 0,
          disabled: assistantBusy === "cancelling" && activeAssistRef.current?.mode === "optimize-workflow",
          onClick: () => {
            if (assistantBusy === "optimize-workflow") {
              setCancelConfirm({ mode: "workflow" });
              return;
            }
            if (topologyDirty) {
              setMessage(t.topologyPending);
              return;
            }
            setWorkflowOptimizeConfirm(true);
          }
        }, assistantBusy === "optimize-workflow" ? t.cancelWorkflowOptimize : assistantBusy === "cancelling" && activeAssistRef.current?.mode === "optimize-workflow" ? "\u2026" : t.aiOptimizeWorkflow),
        import_react2.default.createElement("button", {
          className: "df-btn df-assistant__toggle",
          title: assistantOpen ? t.collapseAssistant : t.expandAssistant,
          "aria-label": assistantOpen ? t.collapseAssistant : t.expandAssistant,
          onClick: () => setAssistantOpen((open) => !open)
        }, assistantOpen ? "\u2304" : "\u2303")
      )
    ),
    assistantOpen && import_react2.default.createElement(
      "div",
      { className: "df-assistant__body" },
      import_react2.default.createElement(
        "div",
        { className: "df-assistant__control" },
        import_react2.default.createElement(
          "label",
          null,
          t.assistantInstruction,
          import_react2.default.createElement("input", {
            value: assistantInstruction,
            placeholder: t.assistantInstructionHint,
            onChange: (event) => setAssistantInstruction(event.target.value)
          })
        ),
        import_react2.default.createElement(
          "div",
          { className: "df-assistant__summary" },
          validationResult ? [
            import_react2.default.createElement("span", { key: "total" }, `${validationResult.summary?.total ?? findings.length} ${t.issues}`),
            import_react2.default.createElement("button", {
              key: "error",
              type: "button",
              className: `df-count is-error${findingFilter === "error" ? " is-active" : ""}`,
              "data-df-filter": "error",
              "aria-pressed": findingFilter === "error",
              onClick: () => setFindingFilter((value) => value === "error" ? null : "error")
            }, `Error ${counts.error ?? 0}`),
            import_react2.default.createElement("button", {
              key: "warning",
              type: "button",
              className: `df-count is-warning${findingFilter === "warning" ? " is-active" : ""}`,
              "data-df-filter": "warning",
              "aria-pressed": findingFilter === "warning",
              onClick: () => setFindingFilter((value) => value === "warning" ? null : "warning")
            }, `Warn ${counts.warning ?? 0}`)
          ] : import_react2.default.createElement("span", null, t.validationIdle)
        ),
        import_react2.default.createElement(
          "div",
          { className: "df-findings" },
          validationResult && findings.length === 0 ? import_react2.default.createElement("div", { className: "df-empty" }, t.noFindings) : visibleFindings.map((finding, index) => import_react2.default.createElement(
            "button",
            {
              key: `${finding.code}-${finding.nodeId ?? finding.edgeId ?? index}`,
              className: `df-finding is-${finding.level}`,
              "data-df-finding-level": finding.level,
              onClick: () => focusFinding(finding)
            },
            import_react2.default.createElement("span", { className: "df-finding__dot" }),
            import_react2.default.createElement(
              "span",
              null,
              import_react2.default.createElement("span", { className: "df-finding__doc" }, findingDocumentLabel(finding)),
              import_react2.default.createElement("span", { className: "df-finding__message" }, finding.message),
              finding.suggestion && import_react2.default.createElement("span", { className: "df-finding__suggestion" }, finding.suggestion)
            )
          ))
        )
      ),
      import_react2.default.createElement(
        "div",
        { className: "df-assistant__preview" },
        import_react2.default.createElement(
          "div",
          { className: "df-assistant__preview-head" },
          import_react2.default.createElement("span", { className: "df-assistant__preview-title" }, optimizationProposal ? `${t.proposalDecision} \xB7 ${optimizationProposal.documentLabel} \xB7 ${optimizationStale ? t.staleSuggestion : t.suggestionPreview}` : `${t.proposalDecision} \xB7 ${t.proposalPending}`),
          optimizationProposal && import_react2.default.createElement(
            "span",
            null,
            import_react2.default.createElement("button", { className: "df-btn is-ghost", "data-df-action": "discard-optimization", onClick: discardOptimization }, t.discardSuggestion),
            import_react2.default.createElement("button", { className: "df-btn is-primary", "data-df-action": "accept-optimization", onClick: acceptOptimization, disabled: !assistantDraft || optimizationStale }, t.acceptSuggestion)
          )
        ),
        optimizationProposal ? import_react2.default.createElement("textarea", { value: assistantDraft, onChange: (event) => setAssistantDraft(event.target.value), spellCheck: false }) : import_react2.default.createElement(
          "div",
          { className: "df-assistant__pending" },
          import_react2.default.createElement("span", null, `${t.proposalPending} \xB7 ${t.proposalIdle}`)
        )
      )
    )
  );
  const workflowConfirmDialog = workflowOptimizeConfirm && import_react2.default.createElement(
    "div",
    {
      className: "df-confirm-backdrop",
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) setWorkflowOptimizeConfirm(false);
      }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-workflow-optimize-title" },
      import_react2.default.createElement("h3", { id: "df-workflow-optimize-title" }, t.workflowOptimizeTitle),
      import_react2.default.createElement("p", null, t.workflowOptimizeWarning),
      import_react2.default.createElement(
        "div",
        { className: "df-confirm__actions" },
        import_react2.default.createElement("button", { className: "df-btn", onClick: () => setWorkflowOptimizeConfirm(false) }, t.workflowOptimizeCancel),
        import_react2.default.createElement("button", { className: "df-btn is-primary", "data-df-action": "confirm-optimize-workflow", onClick: runWorkflowOptimization }, t.workflowOptimizeConfirm)
      )
    )
  );
  const cancelConfirmDialog = cancelConfirm && import_react2.default.createElement(
    "div",
    {
      className: "df-confirm-backdrop",
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) setCancelConfirm(null);
      }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-cancel-confirm-title" },
      import_react2.default.createElement(
        "h3",
        { id: "df-cancel-confirm-title" },
        cancelConfirm.mode === "logic" ? t.cancelConfirmLogic : cancelConfirm.mode === "workflow" ? t.cancelConfirmWorkflow : t.cancelConfirmDoc
      ),
      import_react2.default.createElement(
        "div",
        { className: "df-confirm__actions" },
        import_react2.default.createElement("button", { className: "df-btn", "data-df-action": "wait-cancel", onClick: () => setCancelConfirm(null) }, t.waitMore),
        import_react2.default.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-cancel-agent",
          onClick: () => {
            const mode = cancelConfirm.mode;
            setCancelConfirm(null);
            if (mode === "document") cancelOptimizeFor(assistantTarget);
            else cancelAssistant();
          }
        }, t.confirmCancel)
      )
    )
  );
  const topologyConfirmDialog = topologyApplyConfirm && import_react2.default.createElement(
    "div",
    {
      className: "df-confirm-backdrop",
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget && !topologyApplyBusy) setTopologyApplyConfirm(false);
      }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-topology-apply-title" },
      import_react2.default.createElement("h3", { id: "df-topology-apply-title" }, t.topologyApplyTitle),
      import_react2.default.createElement("p", null, t.topologyApplyWarning),
      topologyDelta && import_react2.default.createElement(
        "div",
        { className: "df-topology-summary" },
        import_react2.default.createElement("span", null, `${t.topologyNodes}: +${topologyDelta.nodes.added.length} / \u2212${topologyDelta.nodes.removed.length} / ~${topologyDelta.nodes.changed.length}`),
        import_react2.default.createElement("span", null, `${t.topologyEdges}: +${topologyDelta.edges.added.length} / \u2212${topologyDelta.edges.removed.length} / ~${topologyDelta.edges.changed.length}`)
      ),
      import_react2.default.createElement(
        "div",
        { className: "df-confirm__actions" },
        import_react2.default.createElement("button", { className: "df-btn", disabled: topologyApplyBusy, onClick: () => setTopologyApplyConfirm(false) }, t.cancel),
        import_react2.default.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-apply-topology",
          disabled: topologyApplyBusy,
          onClick: applyTopologyChanges
        }, topologyApplyBusy ? t.topologyApplying : t.topologyApplyConfirm)
      )
    )
  );
  const gatePickerDialog = gatePickerOpen && import_react2.default.createElement(
    "div",
    {
      className: "df-confirm-backdrop",
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) setGatePickerOpen(false);
      }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "df-gate-picker-title" },
      import_react2.default.createElement("h3", { id: "df-gate-picker-title" }, t.chooseGateTitle),
      import_react2.default.createElement("p", null, t.chooseGateIntro),
      import_react2.default.createElement(
        "div",
        { className: "df-gate-grid" },
        CONDITION_GATE_TYPES.map((gateType) => import_react2.default.createElement(
          "button",
          {
            key: gateType,
            type: "button",
            className: "df-gate-choice",
            "data-df-gate-type": gateType,
            onClick: () => {
              setGatePickerOpen(false);
              createNode("condition", gateType);
            }
          },
          import_react2.default.createElement("strong", null, t.gateType[gateType]),
          import_react2.default.createElement("span", null, t.gateDescription[gateType])
        ))
      ),
      import_react2.default.createElement(
        "div",
        { className: "df-confirm__actions" },
        import_react2.default.createElement("button", { className: "df-btn", onClick: () => setGatePickerOpen(false) }, t.cancel)
      )
    )
  );
  const branchPickerDialog = pendingConnection && import_react2.default.createElement(
    "div",
    {
      className: "df-confirm-backdrop",
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) setPendingConnection(null);
      }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "df-branch-picker-title" },
      import_react2.default.createElement("h3", { id: "df-branch-picker-title" }, t.chooseBranchTitle),
      import_react2.default.createElement("p", null, t.chooseBranchIntro),
      import_react2.default.createElement(
        "div",
        { className: "df-branch-options" },
        ["true", "false"].map((branch) => import_react2.default.createElement("button", {
          key: branch,
          type: "button",
          className: "df-branch-option",
          "data-df-branch": branch,
          disabled: !pendingConnection.available.includes(branch),
          onClick: () => {
            const conn = pendingConnection.connection;
            setPendingConnection(null);
            commitConnection(conn, branch);
          }
        }, t.branchLabel[branch]))
      ),
      import_react2.default.createElement(
        "div",
        { className: "df-confirm__actions" },
        import_react2.default.createElement("button", { className: "df-btn", onClick: () => setPendingConnection(null) }, t.cancel)
      )
    )
  );
  const connectionWarningDialog = connectionWarning && import_react2.default.createElement(
    "div",
    {
      className: "df-confirm-backdrop",
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) setConnectionWarning(null);
      }
    },
    import_react2.default.createElement(
      "div",
      { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-connection-warning-title" },
      import_react2.default.createElement("h3", { id: "df-connection-warning-title" }, t.connectionWarningTitle),
      import_react2.default.createElement("p", null, connectionWarning),
      import_react2.default.createElement(
        "div",
        { className: "df-confirm__actions" },
        import_react2.default.createElement("button", { className: "df-btn is-primary", onClick: () => setConnectionWarning(null) }, t.dismiss)
      )
    )
  );
  const topologyApplyButton = topologyDirty && import_react2.default.createElement(
    "div",
    { className: "df-topology-apply" },
    import_react2.default.createElement(
      "button",
      {
        type: "button",
        className: "df-btn is-primary",
        "data-df-action": "apply-topology",
        disabled: topologyApplyBusy,
        onClick: () => setTopologyApplyConfirm(true)
      },
      import_react2.default.createElement("span", { className: "df-topology-apply__icon", "aria-hidden": true }, topologyApplyBusy ? "\u25CC" : "\u2713"),
      import_react2.default.createElement("span", null, topologyApplyBusy ? t.topologyApplying : t.topologyApply),
      topologyDelta?.count > 0 && import_react2.default.createElement("span", { className: "df-topology-apply__count" }, topologyDelta.count)
    )
  );
  const hiddenAgentFinalizeButton = import_react2.default.createElement("button", {
    ref: agentFinalizeButtonRef,
    type: "button",
    hidden: true,
    tabIndex: -1,
    "aria-hidden": "true",
    "data-df-action": "agent-finalize-topology",
    onClick: finalizeTopologyDirectly
  });
  const panelBudget = Math.max(0, studioWidth - 340 - 18);
  let effectiveDocumentWidth = documentsOpen ? Math.min(documentWidth, studioWidth * 0.42) : 0;
  let effectiveInspectorWidth = inspectorOpen ? Math.min(inspectorWidth, studioWidth * 0.46) : 0;
  const desiredTotal = effectiveDocumentWidth + effectiveInspectorWidth;
  if (desiredTotal > panelBudget && desiredTotal > 0) {
    const factor = panelBudget / desiredTotal;
    effectiveDocumentWidth *= factor;
    effectiveInspectorWidth *= factor;
  }
  const studioStyle = {
    gridTemplateColumns: `${Math.round(effectiveDocumentWidth)}px 9px minmax(0,1fr) 9px ${Math.round(effectiveInspectorWidth)}px`
  };
  const leftSplitter = import_react2.default.createElement("div", {
    className: `df-splitter df-splitter--left${documentsOpen ? "" : " is-collapsed"}`,
    role: "separator",
    tabIndex: 0,
    title: t.resizeDocs,
    "aria-label": t.resizeDocs,
    "aria-orientation": "vertical",
    "aria-valuemin": 0,
    "aria-valuenow": Math.round(effectiveDocumentWidth),
    onPointerDown: (event) => beginPanelResize("left", event),
    onDoubleClick: () => setDocumentsOpen((open) => !open),
    onKeyDown: (event) => panelKeyDown("left", event)
  });
  const rightSplitter = import_react2.default.createElement("div", {
    className: `df-splitter df-splitter--right${inspectorOpen ? "" : " is-collapsed"}`,
    role: "separator",
    tabIndex: 0,
    title: t.resizeEditor,
    "aria-label": t.resizeEditor,
    "aria-orientation": "vertical",
    "aria-valuemin": 0,
    "aria-valuenow": Math.round(effectiveInspectorWidth),
    onPointerDown: (event) => beginPanelResize("right", event),
    onDoubleClick: () => setInspectorOpen((open) => !open),
    onKeyDown: (event) => panelKeyDown("right", event)
  });
  const assistantSplitter = import_react2.default.createElement("div", {
    className: `df-assistant-splitter${assistantOpen ? "" : " is-collapsed"}`,
    role: "separator",
    tabIndex: 0,
    title: t.resizeAssistant,
    "aria-label": t.resizeAssistant,
    "aria-orientation": "horizontal",
    "aria-valuemin": 44,
    "aria-valuenow": assistantOpen ? Math.round(assistantHeight) : 44,
    onPointerDown: beginAssistantResize,
    onDoubleClick: () => setAssistantOpen((open) => !open),
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setAssistantOpen((open) => !open);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        setAssistantOpen(true);
        setAssistantHeight((height) => Math.max(ASSISTANT_COLLAPSE_THRESHOLD, height + (event.key === "ArrowUp" ? 16 : -16)));
      }
    }
  });
  return import_react2.default.createElement(
    "div",
    { className: "df-studio", ref: studioRef, style: studioStyle },
    documentRail,
    leftSplitter,
    import_react2.default.createElement(
      "div",
      { className: "df-canvas-shell", ref: canvasShellRef },
      hiddenAgentFinalizeButton,
      workflowConfirmDialog,
      cancelConfirmDialog,
      topologyConfirmDialog,
      gatePickerDialog,
      branchPickerDialog,
      connectionWarningDialog,
      toolbar,
      import_react2.default.createElement(
        "div",
        { className: "df-canvas-stage" },
        import_react2.default.createElement(GraphCanvas, {
          nodes,
          edges,
          copy: t,
          selectedNode: selected,
          selectedEdge,
          onInit: setFlowInstance,
          onNodeDragStart: rememberGraph,
          onNodeMove: moveNode,
          onNodeSelect: (id) => {
            setSelected(id);
            setSelectedEdge(null);
            setActiveDoc(id);
          },
          onEdgeSelect: (id) => {
            setSelected(null);
            setSelectedEdge(id);
            setMessage(t.edgeSelected);
          },
          onPaneClick: () => {
            setSelected(null);
            setSelectedEdge(null);
          },
          onConnect,
          onConnectionRejected,
          onReconnect,
          isValidConnection,
          fitLabel: t.fitAll,
          zoomInLabel: t.zoomIn,
          zoomOutLabel: t.zoomOut
        }),
        topologyApplyButton
      ),
      addBar,
      assistantSplitter,
      assistantPanel
    ),
    rightSplitter,
    inspector
  );
}
function DeepSeekFlowView({ connection, sessionId, language: initialLanguage, locale }) {
  const [language, setLanguage] = (0, import_react2.useState)(initialLanguage);
  (0, import_react2.useEffect)(() => {
    if (!locale || typeof locale.subscribe !== "function") return void 0;
    const update = () => setLanguage(localeLanguage(locale));
    update();
    return locale.subscribe(update);
  }, [locale]);
  const t = (0, import_react2.useMemo)(() => text(language), [language]);
  const rootRef = import_react2.default.useRef(null);
  (0, import_react2.useLayoutEffect)(() => {
    const scrollBody = rootRef.current?.closest?.("[data-conversation-scroll]");
    if (!scrollBody) return void 0;
    const previousImmersive = scrollBody.getAttribute("data-deepseek-flow-immersive");
    const composerSeat = scrollBody.querySelector(":scope > [data-composer-seat]");
    const previousAriaHidden = composerSeat?.getAttribute("aria-hidden") ?? null;
    const previousInert = composerSeat?.inert ?? false;
    scrollBody.setAttribute("data-deepseek-flow-immersive", "true");
    if (composerSeat) {
      composerSeat.setAttribute("aria-hidden", "true");
      composerSeat.inert = true;
    }
    return () => {
      if (previousImmersive === null) scrollBody.removeAttribute("data-deepseek-flow-immersive");
      else scrollBody.setAttribute("data-deepseek-flow-immersive", previousImmersive);
      if (composerSeat) {
        if (previousAriaHidden === null) composerSeat.removeAttribute("aria-hidden");
        else composerSeat.setAttribute("aria-hidden", previousAriaHidden);
        composerSeat.inert = previousInert;
      }
    };
  }, [sessionId]);
  return import_react2.default.createElement(
    "div",
    { className: "deepseek-flow-root", ref: rootRef, "data-df-immersive-view": "true" },
    import_react2.default.createElement(
      "nav",
      { className: "df-tabs" },
      import_react2.default.createElement("span", { className: "df-titlebar__title" }, t.studio),
      import_react2.default.createElement("span", { className: "df-titlebar__badge" }, t.editorOnly),
      import_react2.default.createElement("span", { className: "df-titlebar__note" }, t.editorOnlyNote),
      import_react2.default.createElement("span", { className: "df-titlebar__rev", title: `DeepSeekFlow client revision ${CLIENT_REV}` }, `rev ${CLIENT_REV}`)
    ),
    import_react2.default.createElement(
      "main",
      { className: "df-main" },
      import_react2.default.createElement(Studio, { connection, sessionId, language })
    )
  );
}
function apply(ctx) {
  const language = localeLanguage(ctx.locale);
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = "deepseek-flow";
    tag.textContent = styles;
    document.head.append(tag);
    return () => {
      tag.remove();
    };
  }, "deepseek-flow: styles");
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "deepseek-flow",
    order: 20,
    label: () => text(localeLanguage(ctx.locale)).view,
    inject: (sessionId) => ({
      connection: ctx.connection,
      sessionId: String(sessionId),
      language: localeLanguage(ctx.locale),
      locale: ctx.locale
    })
  }, DeepSeekFlowView));
}

return module.exports; } });
