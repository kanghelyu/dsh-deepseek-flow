/* deepseek-flow client-rev:9076aa95fe5f */
window.__ModuleLoader__.load({ id: "deepseek-flow", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
const CONDITION_GATE_TYPES = Object.freeze([
  "ifElse",
  "and",
  "or",
  "not",
  "nand",
  "nor",
  "xor",
  "xnor"
]);

const AUTO_FAN_OUT_GATES = new Set(["and", "or", "nand", "nor", "xor", "xnor"]);

const GATE_ALIASES = new Map([
  ["ifelse", "ifElse"],
  ["if/else", "ifElse"],
  ["if-else", "ifElse"],
  ["branch", "ifElse"],
  ["boolean", "ifElse"],
  ["yesno", "ifElse"],
  ["truefalse", "ifElse"],
  ["是否", "ifElse"],
  ["判断", "ifElse"],
  ["and", "and"],
  ["all", "and"],
  ["与", "and"],
  ["与门", "and"],
  ["or", "or"],
  ["any", "or"],
  ["或", "or"],
  ["或门", "or"],
  ["not", "not"],
  ["negate", "not"],
  ["非", "not"],
  ["非门", "not"],
  ["nand", "nand"],
  ["notand", "nand"],
  ["andnot", "nand"],
  ["与非", "nand"],
  ["与非门", "nand"],
  ["nor", "nor"],
  ["notor", "nor"],
  ["ornot", "nor"],
  ["或非", "nor"],
  ["或非门", "nor"],
  ["xor", "xor"],
  ["exclusiveor", "xor"],
  ["异或", "xor"],
  ["异或门", "xor"],
  ["xnor", "xnor"],
  ["equivalence", "xnor"],
  ["exclusiveornot", "xnor"],
  ["同或", "xnor"],
  ["同或门", "xnor"],
  ["异或非", "xnor"],
  ["异或非门", "xnor"]
]);

const BRANCH_ALIASES = new Map([
  ["true", "true"],
  ["yes", "true"],
  ["是", "true"],
  ["false", "false"],
  ["no", "false"],
  ["否", "false"],
  ["and", "and"],
  ["与", "and"],
  ["与门", "and"],
  ["or", "or"],
  ["或", "or"],
  ["或门", "or"],
  ["not", "not"],
  ["非", "not"],
  ["非门", "not"],
  ["nand", "nand"],
  ["与非", "nand"],
  ["与非门", "nand"],
  ["nor", "nor"],
  ["或非", "nor"],
  ["或非门", "nor"],
  ["xor", "xor"],
  ["异或", "xor"],
  ["异或门", "xor"],
  ["xnor", "xnor"],
  ["同或", "xnor"],
  ["同或门", "xnor"],
  ["异或非", "xnor"],
  ["异或非门", "xnor"]
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
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
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

function gateMaxOutgoing(gateType) {
  switch (normalizeGateType(gateType)) {
    case "ifElse": return 2;
    case "not": return 1;
    default: return Number.POSITIVE_INFINITY;
  }
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

const LOGIC_CONTRACT_VERSION = 1;
const LOGIC_PREDICATES = Object.freeze(["truthy", "falsy", "nonEmpty"]);

function unsupportedPredicateMessage(prefix, predicate) {
  return `${prefix} uses unsupported predicate ${predicate}; use truthy, falsy, or nonEmpty. `
    + "Natural-language conditions must be normalized to Boolean by an upstream Agent first.";
}

const GATE_RULES = Object.freeze({
  ifElse: { minInputs: 1, maxInputs: 1, formula: "A", outputMode: "selected-branch" },
  and: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "A ∧ B ∧ …", outputMode: "boolean-fan-out" },
  or: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "A ∨ B ∨ …", outputMode: "boolean-fan-out" },
  not: { minInputs: 1, maxInputs: 1, formula: "¬A", outputMode: "boolean-fan-out" },
  nand: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "¬(A ∧ B ∧ …)", outputMode: "boolean-fan-out" },
  nor: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "¬(A ∨ B ∨ …)", outputMode: "boolean-fan-out" },
  xor: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "A ⊕ B ⊕ … (odd parity)", outputMode: "boolean-fan-out" },
  xnor: { minInputs: 2, maxInputs: Number.POSITIVE_INFINITY, formula: "¬(A ⊕ B ⊕ …) (even parity)", outputMode: "boolean-fan-out" }
});

class LogicEvaluationError extends Error {
  constructor(issues) {
    super(["Logic evaluation failed:", ...issues.map((issue, index) => `  ${index + 1}. ${issue}`)].join("\n"));
    this.name = "LogicEvaluationError";
    this.issues = issues;
  }
}

function normalizePredicate(value, fallback = "truthy") {
  return LOGIC_PREDICATES.includes(value) ? value : fallback;
}

function evaluatePredicate(value, predicate = "truthy") {
  switch (normalizePredicate(predicate)) {
    case "falsy":
      return !Boolean(value);
    case "nonEmpty":
      if (value === null || value === undefined) return false;
      if (typeof value === "string" || Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value).length > 0;
      return true;
    default:
      return Boolean(value);
  }
}

function gateRule(gateType) {
  return GATE_RULES[normalizeGateType(gateType)];
}

function evaluateGate(gateType, inputs) {
  const gate = normalizeGateType(gateType);
  const values = Array.isArray(inputs) ? inputs.map(Boolean) : [];
  const rule = gateRule(gate);
  if (values.length < rule.minInputs || values.length > rule.maxInputs) {
    const expected = rule.maxInputs === rule.minInputs
      ? `${rule.minInputs}`
      : `${rule.minInputs} or more`;
    throw new LogicEvaluationError([`${gate} gate expects ${expected} Boolean input(s), received ${values.length}`]);
  }
  switch (gate) {
    case "ifElse": return values[0];
    case "and": return values.every(Boolean);
    case "or": return values.some(Boolean);
    case "not": return !values[0];
    case "nand": return !values.every(Boolean);
    case "nor": return !values.some(Boolean);
    case "xor": return values.filter(Boolean).length % 2 === 1;
    case "xnor": return values.filter(Boolean).length % 2 === 0;
    default: throw new LogicEvaluationError([`unsupported gate type ${gate}`]);
  }
}

function inputPredicate(node, sourceId) {
  const overrides = node?.data?.inputPredicates;
  return normalizePredicate(overrides?.[sourceId] ?? node?.data?.predicate ?? "truthy");
}

function conditionInputs(flow, node) {
  return flow.edges
    .filter((edge) => edge.target === node.id)
    .map((edge) => ({
      edgeId: edge.id,
      source: edge.source,
      predicate: inputPredicate(node, edge.source)
    }));
}

function arityIssue(nodeId, gateType, inputCount) {
  const rule = gateRule(gateType);
  if (inputCount >= rule.minInputs && inputCount <= rule.maxInputs) return null;
  if (rule.maxInputs === rule.minInputs) {
    return `condition ${nodeId} (${gateType}) requires exactly ${rule.minInputs} incoming Boolean input(s); received ${inputCount}`;
  }
  return `condition ${nodeId} (${gateType}) requires at least ${rule.minInputs} incoming Boolean inputs; received ${inputCount}`;
}

function logicSemanticsIssues(flow) {
  if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) return [];
  const issues = [];
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  for (const node of flow.nodes.filter((candidate) => candidate.kind === "condition")) {
    const outgoing = flow.edges.filter((edge) => edge.source === node.id);
    const gateType = conditionGateType(node, outgoing);
    const inputs = conditionInputs(flow, node);
    const arity = arityIssue(node.id, gateType, inputs.length);
    if (arity) issues.push(arity);
    const overrides = node.data?.inputPredicates;
    if (overrides !== undefined && (overrides === null || typeof overrides !== "object" || Array.isArray(overrides))) {
      issues.push(`condition ${node.id} inputPredicates must be an object keyed by incoming source node id`);
      continue;
    }
    for (const [source, predicate] of Object.entries(overrides ?? {})) {
      if (nodeIds.has(source) && inputs.some((input) => input.source === source) && !LOGIC_PREDICATES.includes(predicate)) {
        issues.push(unsupportedPredicateMessage(`condition ${node.id} input ${source}`, predicate));
      }
    }
    if (node.data?.predicate !== undefined && !LOGIC_PREDICATES.includes(node.data.predicate)) {
      issues.push(unsupportedPredicateMessage(`condition ${node.id}`, node.data.predicate));
    }
  }
  return issues;
}

function logicExecutionContract(flow) {
  const nodeById = new Map((flow?.nodes ?? []).map((node) => [node.id, node]));
  return {
    version: LOGIC_CONTRACT_VERSION,
    valueSource: "Provide upstream Input/Agent results by node id. Each incoming edge is one gate operand.",
    propagation: "IF/ELSE selects one true/false branch. Every other gate broadcasts its Boolean result; false signals still reach downstream condition gates, while only true activates ordinary steps.",
    conditions: (flow?.nodes ?? [])
      .filter((node) => node.kind === "condition")
      .map((node) => {
        const outgoing = flow.edges.filter((edge) => edge.source === node.id);
        const gateType = conditionGateType(node, outgoing);
        const rule = gateRule(gateType);
        return {
          nodeId: node.id,
          label: node.data?.label ?? node.id,
          gateType,
          formula: rule.formula,
          arity: {
            min: rule.minInputs,
            max: Number.isFinite(rule.maxInputs) ? rule.maxInputs : null
          },
          inputs: conditionInputs(flow, node).map((input) => ({
            ...input,
            sourceLabel: nodeById.get(input.source)?.data?.label ?? input.source
          })),
          output: gateType === "ifElse"
            ? {
                mode: rule.outputMode,
                branches: outgoing.map((edge) => ({
                  edgeId: edge.id,
                  result: gateBranchForEdge(edge) === "true",
                  target: edge.target
                }))
              }
            : {
                mode: rule.outputMode,
                carrier: gateType,
                targets: outgoing.map((edge) => ({ edgeId: edge.id, target: edge.target }))
              }
        };
      }),
    issues: logicSemanticsIssues(flow)
  };
}

function topologicalNodeIds(flow) {
  const incoming = new Map(flow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(flow.nodes.map((node) => [node.id, []]));
  for (const edge of flow.edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue;
    incoming.set(edge.target, incoming.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }
  const queue = flow.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id).sort();
  const order = [];
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const target of outgoing.get(id) ?? []) {
      incoming.set(target, incoming.get(target) - 1);
      if (incoming.get(target) === 0) {
        queue.push(target);
        queue.sort();
      }
    }
  }
  return order;
}

function evaluateFlowLogic(flow, values = {}) {
  if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    throw new LogicEvaluationError(["flow must contain nodes and edges arrays"]);
  }
  const semanticIssues = logicSemanticsIssues(flow);
  if (semanticIssues.length > 0) throw new LogicEvaluationError(semanticIssues);
  if (values === null || typeof values !== "object" || Array.isArray(values)) {
    throw new LogicEvaluationError(["values must be an object keyed by upstream node id"]);
  }
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  const conditions = {};
  const edgeSignals = new Map();
  const missingInputs = [];
  const order = topologicalNodeIds(flow);
  if (order.length !== flow.nodes.length) {
    throw new LogicEvaluationError(["cycle detected; Boolean propagation requires an acyclic graph"]);
  }

  for (const nodeId of order) {
    const node = nodeById.get(nodeId);
    if (node?.kind !== "condition") continue;
    const outgoing = flow.edges.filter((edge) => edge.source === node.id);
    const gateType = conditionGateType(node, outgoing);
    const operands = [];
    let complete = true;
    for (const input of conditionInputs(flow, node)) {
      const sourceNode = nodeById.get(input.source);
      let rawValue;
      if (sourceNode?.kind === "condition") {
        const signal = edgeSignals.get(input.edgeId);
        if (!signal?.propagated) {
          complete = false;
          missingInputs.push({ conditionId: node.id, source: input.source, edgeId: input.edgeId });
          continue;
        }
        rawValue = signal.value;
      } else if (Object.hasOwn(values, input.source)) {
        rawValue = values[input.source];
      } else {
        complete = false;
        missingInputs.push({ conditionId: node.id, source: input.source, edgeId: input.edgeId });
        continue;
      }
      operands.push({
        source: input.source,
        predicate: input.predicate,
        value: evaluatePredicate(rawValue, input.predicate)
      });
    }
    if (!complete) {
      conditions[node.id] = { gateType, status: "pending", operands };
      continue;
    }
    const result = evaluateGate(gateType, operands.map((operand) => operand.value));
    conditions[node.id] = { gateType, status: "resolved", operands, result };
    for (const edge of outgoing) {
      if (gateType === "ifElse") {
        const branch = gateBranchForEdge(edge);
        const selected = branch === (result ? "true" : "false");
        edgeSignals.set(edge.id, {
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          mode: "selected-branch",
          propagated: selected,
          active: selected,
          ...(selected ? { value: true } : {})
        });
      } else {
        edgeSignals.set(edge.id, {
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          mode: "boolean-signal",
          propagated: true,
          value: result,
          active: result
        });
      }
    }
  }

  const edges = [...edgeSignals.values()];
  return {
    contractVersion: LOGIC_CONTRACT_VERSION,
    ready: missingInputs.length === 0,
    conditions,
    edges,
    activeTargets: [...new Set(edges
      .filter((edge) => edge.active && nodeById.get(edge.target)?.kind !== "condition")
      .map((edge) => edge.target))],
    missingInputs
  };
}

const TOPOLOGY_DATA_KEYS = Object.freeze([
  "label",
  "gateType",
  "predicate",
  "inputPredicates",
  "order"
]);

const EXECUTABLE_KINDS = new Set(["agent", "mapAgent"]);

function definedEntries(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
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
    label: edge?.autoLogicLabel ? undefined : edge?.label
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

/**
 * Decide whether a newer server flow can replace the live canvas safely.
 * This is deliberately topology-only: Markdown revisions do not create a
 * false topology conflict.
 */
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
  const changed = afterItems
    .filter((item) => before.has(item.id) && JSON.stringify(before.get(item.id)) !== JSON.stringify(item))
    .map((item) => item.id);
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
  const count = nodes.added.length + nodes.removed.length + nodes.changed.length
    + edges.added.length + edges.removed.length + edges.changed.length
    + Number(nodeOrderChanged) + Number(edgeOrderChanged) + Number(ioChanged);
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
  // A node removed only in the topology draft must keep its persisted document
  // until the user explicitly applies that topology. For still-present nodes,
  // the editor may update or deliberately clear the document binding.
  const docs = { ...(persistedFlow.docs ?? {}) };
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
      return editorNode
        ? { ...node, data: { ...node.data, ...documentDataPatch(editorNode) } }
        : node;
    })
  };
}

function withoutTopologyData(data = {}) {
  const next = { ...data };
  for (const key of [...TOPOLOGY_DATA_KEYS, "kind", "docPath", "language"]) delete next[key];
  return next;
}

function fallbackContent(kind, label) {
  return EXECUTABLE_KINDS.has(kind)
    ? { prompt: "{{input}}" }
    : { instructions: `# ${label}\n\n请补充本步骤说明。` };
}

function applyReviewedTopology(currentFlow, draftFlow, reviewed) {
  const topology = topologyProjection(reviewed);
  const currentNodes = indexed(currentFlow?.nodes ?? []);
  const draftNodes = indexed(draftFlow?.nodes ?? []);
  const nodes = topology.nodes.map((reviewedNode) => {
    const source = currentNodes.get(reviewedNode.id) ?? draftNodes.get(reviewedNode.id);
    const label = String(reviewedNode.data?.label ?? source?.data?.label ?? reviewedNode.id);
    const preserved = withoutTopologyData(source?.data);
    const content = source ? {} : fallbackContent(reviewedNode.kind, label);
    return {
      ...(source ?? {}),
      id: reviewedNode.id,
      kind: reviewedNode.kind,
      position: reviewedNode.position,
      data: {
        ...preserved,
        ...content,
        ...reviewedNode.data,
        label
      }
    };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sourceDocs = { ...(currentFlow?.docs ?? {}), ...(draftFlow?.docs ?? {}) };
  const docs = Object.fromEntries(Object.entries(sourceDocs).filter(([nodeId]) => nodeIds.has(nodeId)));
  return {
    ...currentFlow,
    id: draftFlow?.id ?? currentFlow?.id,
    name: draftFlow?.name ?? currentFlow?.name,
    description: draftFlow?.description ?? currentFlow?.description,
    nodes,
    edges: topology.edges,
    inputs: topology.inputs,
    outputs: topology.outputs,
    docs,
    workflowContent: currentFlow?.workflowContent ?? draftFlow?.workflowContent,
    workflowDoc: currentFlow?.workflowDoc ?? draftFlow?.workflowDoc,
    docRoot: currentFlow?.docRoot ?? draftFlow?.docRoot
  };
}

const topologyModelInternals = { TOPOLOGY_DATA_KEYS, topologyEdge, topologyNode };

function localeLanguage(localeService) {
  try {
    const snapshot = localeService?.getLocale?.();
    const active = String(snapshot?.active ?? "");
    if (active) return active.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    // fall through
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
  return language === "zh"
    ? {
        view: "DeepSeek Flow",
        studio: "流程设计",
        editorOnly: "仅编辑",
        editorOnlyNote: "执行请回到当前 Session",
        ready: "就绪",
        saving: "保存中…",
        saved: "已保存",
        autoSaving: "正在同步 Markdown…",
        autoSaved: "Markdown 已写入",
        shared: "共享",
        importLabel: "导入 JSON",
        exportLabel: "导出 JSON",
        save: "保存",
        topologyApply: "应用修改",
        topologyApplyTitle: "应用这次拓扑修改？",
        topologyApplyWarning: "流程框、逻辑门和箭头会先经过确定性校验，再交给当前主 Session 绑定的 Agent 审查并在必要时重构；全部通过后才原子保存。Agent 不会改写现有 Markdown 正文，系统生成的拓扑索引会随结构同步。",
        topologyApplyConfirm: "确认并交给主 Session",
        topologyPending: "请先保存工作流（拓扑修改尚未应用）",
        topologyApplying: "主 Session 校验重构中…",
        topologyApplied: "拓扑修改已校验并应用",
        topologyAppliedWithNewDraft: "已应用提交时的拓扑；审查期间产生的新修改仍是待应用草稿",
        topologyApplyFailed: "拓扑未写入，草稿已保留：",
        topologyApplyFirst: "请先应用新工作流拓扑，再保存其 Markdown",
        topologyNoChanges: "没有需要应用的拓扑修改",
        topologyAlreadyPersisted: "主 Session 已保存相同拓扑，画布已直接同步，无需再次审核",
        topologySessionSynced: "已同步主 Session 保存的最新拓扑",
        topologySessionConflict: "主 Session 和画布都有新的拓扑修改；已保留画布草稿，请先合并后再应用",
        hiddenFinalizeApplying: "正在直接定稿外部文件修改…",
        hiddenFinalizeApplied: "外部文件修改已直接定稿，无需再次交给主 Session",
        hiddenFinalizeFailed: "自动定稿未完成，已保留普通应用流程：",
        topologyNodes: "流程框",
        topologyEdges: "箭头",
        undo: "撤销",
        redo: "重做",
        tidy: "一键整理",
        flow: "工作流",
        documents: "工作流文档",
        workflowDoc: "总控流程",
        stepDocs: "分步工作区",
        openDocument: "选择一个 Markdown 文件进行编辑",
        markdownContent: "Markdown 内容",
        docRoot: "文档工作区",
        filePath: "文件",
        documentFirst: "文档优先",
        documentFirstNote: "先读 WORKFLOW.md，再按顺序执行每个 STEP.md",
        collapseDocs: "收起工作流文档",
        expandDocs: "展开工作流文档",
        resizeDocs: "拖动调整文档栏宽度；双击收起或展开",
        collapseEditor: "收起 Markdown 编辑器",
        expandEditor: "展开 Markdown 编辑器",
        resizeEditor: "拖动调整编辑器宽度；双击收起或展开",
        resizeAssistant: "拖动调整助手高度；双击收起或展开",
        fitAll: "显示全图",
        zoomIn: "放大",
        zoomOut: "缩小",
        addNode: "新建流程框",
        connectHint: "进入条件框的箭头提供真值输入；条件输出箭头传播门结果",
        nodeKind: {
          input: "输入",
          agent: "Agent",
          mapAgent: "Map Agent",
          condition: "条件",
          merge: "合并",
          output: "输出"
        },
        properties: "节点属性",
        stage: "阶段",
        predicate: "默认输入谓词",
        logicInputs: "逻辑输入与谓词",
        logicInputsEmpty: "尚未连接输入；组合门至少需要两个输入，IF/ELSE 与 NOT 需要一个。",
        logicInputCount: "当前输入",
        logicInputUnary: "要求恰好 1 个",
        logicInputAggregate: "要求至少 2 个",
        gateTypeLabel: "逻辑门类型",
        gateType: {
          ifElse: "是 / 否（IF / ELSE）",
          and: "与门（AND）",
          or: "或门（OR）",
          not: "非门（NOT）",
          nand: "与非门（NAND）",
          nor: "或非门（NOR）",
          xor: "异或门（XOR）",
          xnor: "同或门（XNOR）"
        },
        gateDescription: {
          ifElse: "一个输入；按真值选择“是”或“否”分支",
          and: "至少两个输入；全部为真才向目标传播真值",
          or: "至少两个输入；任一为真即向目标传播真值",
          not: "一个输入；取反后沿唯一输出传播",
          nand: "至少两个输入；AND 结果取反后传播",
          nor: "至少两个输入；OR 结果取反后传播",
          xor: "至少两个输入；真值个数为奇数时结果为真",
          xnor: "至少两个输入；真值个数为偶数时结果为真"
        },
        chooseGateTitle: "选择条件框的逻辑门",
        chooseGateIntro: "门会计算所有入边的布尔值并传播真实结果，不只是显示箭头标签。创建后仍可在没有出线时修改。",
        chooseBranchTitle: "选择判断分支",
        chooseBranchIntro: "“是”和“否”各只能连接一个目标。",
        connectionWarningTitle: "无法创建箭头",
        branchLabel: {
          true: "是",
          false: "否",
          and: "与",
          or: "或",
          not: "非",
          nand: "与非",
          nor: "或非",
          xor: "异或",
          xnor: "同或"
        },
        cancel: "取消",
        dismiss: "知道了",
        duplicateConnection: "这两个流程框之间已经存在箭头，不能重复连接。",
        ifElseFull: "这个是/否条件已经有两条分支，不能再拉出第三条箭头。",
        notFull: "非门只允许一条出线，不能再创建箭头。",
        branchUsed: "这个分支已经连接过目标；“是”和“否”各只能使用一次。",
        gateMismatch: "箭头逻辑与当前门类型不匹配。",
        gateChangeBlocked: "该条件框已有出线。请先删除这些箭头，再修改逻辑门类型。",
        invalidConnection: "这条箭头不符合当前条件门规则。",
        model: "模型",
        provider: "Provider",
        outputSchema: "输出 Schema (JSON)",
        none: "无",
        noFlow: "还没有工作流：请让 Agent 创建，或导入 JSON",
        emptyFlowHint: "点击上方“导入 JSON”，或回到 Session 让 Agent 用 flow_create 构建工作流",
        deleteFlowLabel: "删除",
        deleteFlowTitle: "删除工作流：",
        deleteFlowWarningOwned: "该工作流将从当前 Session 移除；插件托管的文档工作区会移入回收区（deepseek-flow/trash）以便恢复，外部自定义目录不会被移动。",
        deleteFlowWarningShared: "这是共享模板：所有 Session 都将不再看到它；托管文档工作区会移入回收区以便恢复。",
        deleteFlowConfirm: "确认删除",
        deleteFlowBusyLabel: "删除中…",
        deleteFlowFailed: "删除失败：",
        deleteFlowDone: "已删除：",
        switchFlowTitle: "切换工作流？",
        switchFlowWarning: "当前画布有未应用的拓扑修改和未保存的文档修改；切换后将丢弃这些草稿。已自动写入磁盘的 Markdown 不受影响。",
        switchFlowConfirm: "丢弃修改并切换",
        discardedDraftSwitch: "已丢弃草稿并切换工作流",
        draftRestored: "已恢复上次未应用的画布草稿",
        invalidJson: "JSON 无效：",
        importOk: "已导入：",
        deleteNode: "删除节点",
        exportOk: "已导出",
        docFile: "文档文件（相对 docRoot）",
        advancedHints: "Session 提示（高级）",
        assistant: "AI 文档助手",
        assistModelLabel: "AI 助手使用模型",
        assistModelFollow: "跟随会话",
        assistEffortLabel: "思考强度",
        assistEffortFollow: "跟随会话",
        assistEffortOff: "off",
        assistEffortHigh: "high",
        assistEffortMax: "max",
        assistantTarget: "当前文档",
        assistantInstruction: "AI 优化要求（可选）",
        assistantInstructionHint: "例如：更强调截图质检、失败回退和交付文件",
        aiOptimize: "AI 优化当前文档",
        aiOptimizeWorkflow: "AI 优化整个工作流",
        logicValidation: "逻辑校验",
        cancelValidation: "取消校验",
        cancelDocOptimize: "取消优化",
        cancelWorkflowOptimize: "取消工作流优化",
        cancelConfirmLogic: "AI 校验中，确认取消吗？",
        cancelConfirmDoc: "AI 优化中，确认取消吗？",
        cancelConfirmWorkflow: "AI 工作流优化中，确认取消吗？",
        confirmCancel: "确认取消",
        waitMore: "再等等",
        assistantCancelled: "已请求取消 Agent 操作",
        acceptSuggestion: "接受修改",
        discardSuggestion: "拒绝修改",
        acceptedSuggestion: "优化方案已接受并同步",
        discardedSuggestion: "已拒绝方案，原始文档未改变",
        staleSuggestion: "原文在方案生成后已变化，请拒绝并重新优化",
        suggestionPreview: "完整 Markdown 修改方案",
        proposalPending: "待加载",
        proposalDecision: "接受或拒绝修改",
        workflowOptimizeTitle: "确认优化整个工作流？",
        workflowOptimizeWarning: "该操作会让 Agent 直接改写 WORKFLOW.md 和全部 STEP.md，并立即保存，不提供逐份接受或撤销。请确认已经备份重要内容。",
        workflowOptimizeConfirm: "确认并直接优化",
        workflowOptimizeCancel: "取消",
        workflowOptimized: "整个工作流已由 Agent 优化并保存",
        workflowChangedDuringOptimization: "优化期间文档已变化，为防止覆盖新内容，本次结果未写入",
        noFindings: "未发现错误或警告",
        issues: "项校验结果",
        validationIdle: "点击“逻辑校验”扫描 WORKFLOW.md 与全部 STEP.md",
        validationComplete: "Agent 逻辑校验完成",
        proposalIdle: "选择一个文档，然后手动点击“AI 优化当前文档”",
        expandAssistant: "展开 AI 文档助手",
        collapseAssistant: "收起 AI 文档助手",
        assistantFailed: "操作失败：",
        edgeSelected: "已选择箭头，按 Delete 删除"
      }
    : {
        view: "DeepSeek Flow",
        studio: "Flow editor",
        editorOnly: "Edit only",
        editorOnlyNote: "Run from the current Session",
        ready: "Ready",
        saving: "Saving…",
        saved: "Saved",
        autoSaving: "Syncing Markdown…",
        autoSaved: "Markdown written",
        shared: "Shared",
        importLabel: "Import JSON",
        exportLabel: "Export JSON",
        save: "Save",
        topologyApply: "Apply changes",
        topologyApplyTitle: "Apply these topology changes?",
        topologyApplyWarning: "Boxes, logic gates, and arrows will pass deterministic validation, then a current-main-Session-bound Agent will review and rebuild them only when necessary. The result is saved atomically only after all checks pass. The Agent never rewrites existing Markdown prose; generated topology indexes update with the structure.",
        topologyApplyConfirm: "Confirm with main Session",
        topologyPending: "Please save the workflow first (topology changes pending)",
        topologyApplying: "Main Session is reviewing topology…",
        topologyApplied: "Topology changes validated and applied",
        topologyAppliedWithNewDraft: "The submitted topology was applied; newer edits made during review remain a pending draft",
        topologyApplyFailed: "Topology was not written; the draft is preserved: ",
        topologyApplyFirst: "Apply the new workflow topology before saving its Markdown",
        topologyNoChanges: "No topology changes to apply",
        topologyAlreadyPersisted: "The main Session already saved this topology; Studio synced it without another review",
        topologySessionSynced: "Synced the latest topology saved by the main Session",
        topologySessionConflict: "The main Session and canvas both changed topology; the canvas draft was preserved for merging",
        hiddenFinalizeApplying: "Finalizing external file changes directly…",
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
        emptyFlowHint: "Use Import JSON above, or return to the Session and let the Agent build one with flow_create",
        deleteFlowLabel: "Delete",
        deleteFlowTitle: "Delete workflow: ",
        deleteFlowWarningOwned: "This workflow will be removed from the current Session; managed document workspaces move to the trash area (deepseek-flow/trash) for recovery. External custom folders are never moved.",
        deleteFlowWarningShared: "This is a shared template: no Session will see it anymore; managed document workspaces move to the trash area for recovery.",
        deleteFlowConfirm: "Delete",
        deleteFlowBusyLabel: "Deleting…",
        deleteFlowFailed: "Delete failed: ",
        deleteFlowDone: "Deleted: ",
        switchFlowTitle: "Switch workflow?",
        switchFlowWarning: "The canvas has unapplied topology changes and unsaved document edits; switching discards those drafts. Markdown already synced to disk is unaffected.",
        switchFlowConfirm: "Discard and switch",
        discardedDraftSwitch: "Draft discarded; switched workflow",
        draftRestored: "Restored your last unapplied canvas draft",
        invalidJson: "Invalid JSON: ",
        importOk: "Imported: ",
        deleteNode: "Delete node",
        exportOk: "Exported",
        docFile: "Doc file (relative to docRoot)",
        advancedHints: "Session hints (advanced)",
        assistant: "AI",
        assistModelLabel: "Model used by the AI assistant",
        assistModelFollow: "Follow session",
        assistEffortLabel: "Reasoning effort",
        assistEffortFollow: "Follow session",
        assistEffortOff: "Off",
        assistEffortHigh: "High",
        assistEffortMax: "Max",
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

const styles = String.raw`
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
.df-empty-flow{position:absolute;inset:0;z-index:6;display:grid;place-items:center;padding:24px;pointer-events:none}
.df-empty-flow__card{max-width:430px;padding:22px 26px;border:1px dashed var(--df-border-strong);border-radius:14px;background:var(--df-layer);color:var(--df-ink-2);font-size:12px;line-height:1.7;text-align:center;box-shadow:0 10px 30px color-mix(in srgb,var(--df-ink) 10%,transparent)}
.df-empty-flow__card strong{display:block;margin-bottom:6px;color:var(--df-ink);font-size:13px}
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
@media(max-width:1180px){.df-status{display:none}.df-assistant__target{max-width:120px}.df-titlebar__note{display:none}}
@media(max-width:760px){.df-toolbar{padding:7px}.df-assistant__head{padding:7px;overflow-x:auto}.df-assistant__target{display:none}.df-assistant__body{grid-template-columns:1fr;overflow:auto;overscroll-behavior:contain}.df-assistant__control{min-height:150px}.df-findings{height:auto;min-height:80px}.df-assistant__preview{display:flex;min-height:210px}.df-assistant__head .df-btn{padding:4px 6px}.df-assistant__title{display:none}.df-tabs{padding:0 10px}.df-titlebar__badge{display:none}.df-topology-apply{right:10px;bottom:10px}.df-topology-summary{grid-template-columns:1fr}}
`;

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
      ...(node.kind === "condition"
        ? { gateType: conditionGateType(node, (flow?.edges ?? []).filter((edge) => edge.source === node.id)) }
        : {}),
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
      ...(edge.label ? { label: edge.label } : {}),
      ...(generatedLabel ? { label: generatedLabel, autoLogicLabel: true } : {})
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
      ...(!edge.autoLogicLabel && edge.label ? { label: edge.label } : {}),
      ...(edge.sourceHandle === null || edge.sourceHandle === undefined ? {} : { sourceHandle: edge.sourceHandle }),
      ...(edge.targetHandle === null || edge.targetHandle === undefined ? {} : { targetHandle: edge.targetHandle })
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
  if (branch === null || branch === undefined) {
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
  const rows = new Map();
  return nodes.map((node) => {
    const column = level.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { ...node, position: { x: 70 + column * 245, y: 90 + row * 160 } };
  });
}

function logicSnapshot(flow) {
  return JSON.stringify({
    workflowContent: String(flow?.workflowContent ?? ""),
    docs: flow?.docs ?? {},
    nodes: (flow?.nodes ?? []).map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.data?.label ?? "",
      gateType: node.kind === "condition" ? normalizeGateType(node.data?.gateType) : "",
      predicate: node.kind === "condition" ? node.data?.predicate ?? "truthy" : "",
      inputPredicates: node.kind === "condition" ? node.data?.inputPredicates ?? {} : {},
      content: node.kind === "agent" || node.kind === "mapAgent"
        ? String(node.data?.prompt ?? "")
        : String(node.data?.instructions ?? "")
    })),
    edges: (flow?.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: gateBranchForEdge(edge) ?? "",
      targetHandle: edge.targetHandle ?? ""
    }))
  });
}

function FlowNode({ data, selected, copy }) {
  const kind = data.kind ?? "agent";
  const kindLabel = kind === "condition"
    ? `${copy.nodeKind[kind]} · ${copy.gateType[normalizeGateType(data.gateType)]}`
    : copy.nodeKind[kind] ?? kind;
  const children = [
    React.createElement("div", { className: "df-node__kind" }, kindLabel),
    React.createElement("div", { className: "df-node__label" }, String(data.label ?? kind)),
    (data.prompt || data.instructions) ? React.createElement("div", { className: "df-node__prompt" }, String(data.prompt ?? data.instructions)) : null,
    data.docPath ? React.createElement("div", { className: "df-node__file" }, String(data.docPath)) : null
  ];
  return React.createElement("div", { className: `df-node df-node--${kind}${selected ? " is-selected" : ""}` }, children);
}

const GRAPH_NODE_WIDTH = 208;
const GRAPH_NODE_HEIGHT = 116;
const GRAPH_MIN_ZOOM = 0.5;
const GRAPH_MAX_ZOOM = 2.5;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// 连接目标命中：整个节点框都是可释放区域（松手位置只选目标，箭头仍吸附到左侧输入点）。
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
  const rootRef = React.useRef(null);
  const cleanupRef = React.useRef(null);
  const viewportRef = React.useRef({ x: 32, y: 32, zoom: 0.8 });
  const viewportAnimationRef = React.useRef(null);
  const markerIdRef = React.useRef(`df-arrow-${Math.random().toString(36).slice(2, 10)}`);
  const [viewport, setViewport] = useState({ x: 32, y: 32, zoom: 0.8 });
  const [panning, setPanning] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);
  // 拖拽期间的位置只存在本地：每帧只重渲染画布自身，松手才一次性提交给父组件，
  // 避免整个 Studio（序列化、拓扑签名、检查器）跟着每个 pointermove 重算。
  const [liveDrag, setLiveDrag] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const renderNodes = useMemo(() => liveDrag
    ? nodes.map((node) => node.id === liveDrag.id ? { ...node, position: liveDrag.position } : node)
    : nodes, [nodes, liveDrag]);
  // fitView/focusNode 读取 ref 而不是闭包里的 nodes，从而保持引用稳定：
  // onInit 只触发一次，父组件不必因节点增删而反复 setState。
  const nodesRef = React.useRef(renderNodes);
  useEffect(() => {
    nodesRef.current = renderNodes;
  }, [renderNodes]);
  const byId = useMemo(() => new Map(renderNodes.map((node) => [node.id, node])), [renderNodes]);

  const updateViewport = useCallback((value) => {
    setViewport((current) => {
      const next = typeof value === "function" ? value(current) : value;
      viewportRef.current = next;
      return next;
    });
  }, []);

  const cancelViewportAnimation = useCallback(() => {
    const active = viewportAnimationRef.current;
    if (!active) return;
    cancelAnimationFrame(active.frame);
    viewportAnimationRef.current = null;
  }, []);

  const animateViewport = useCallback((target, duration = 0) => {
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

  const stopGesture = useCallback(() => {
    cancelViewportAnimation();
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPanning(false);
    setDraggingNode(null);
    setLiveDrag(null);
  }, [cancelViewportAnimation]);

  useEffect(() => stopGesture, [stopGesture]);

  const fitView = useCallback((options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const nodes = nodesRef.current;
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
  }, [animateViewport]);

  const focusNode = useCallback((id, options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const node = nodesRef.current.find((candidate) => candidate.id === id);
    if (!rect || !node) return;
    const zoom = clamp(Number(options.zoom ?? Math.max(viewportRef.current.zoom, 0.96)), GRAPH_MIN_ZOOM, 1.15);
    animateViewport({
      x: rect.width / 2 - (node.position.x + GRAPH_NODE_WIDTH / 2) * zoom,
      y: rect.height / 2 - (node.position.y + GRAPH_NODE_HEIGHT / 2) * zoom,
      zoom
    }, options.duration ?? 720);
  }, [animateViewport]);

  // 当前视口中心的世界坐标：父组件用它把新建流程框放到用户正在看的位置。
  const screenCenter = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 160, y: 120 };
    const view = viewportRef.current;
    return {
      x: Math.round((rect.width / 2 - view.x) / view.zoom - GRAPH_NODE_WIDTH / 2),
      y: Math.round((rect.height / 2 - view.y) / view.zoom - GRAPH_NODE_HEIGHT / 2)
    };
  }, []);

  useEffect(() => {
    onInit?.({ fitView, focusNode, screenCenter });
  }, [fitView, focusNode, onInit, screenCenter]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom
    };
  }, [viewport]);

  const zoomAtCenter = useCallback((factor) => {
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

  const beginPan = useCallback((event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__node,.df-graph__controls")) return;
    event.preventDefault();
    stopGesture();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewportRef.current;
    setPanning(true);
    let moved = false;
    // 走 updateViewport 保证 viewportRef 与 state 同步：后续 fitView 动画
    // 从 ref 取起点，漏同步会造成视图突跳。
    const move = (next) => {
      const dx = next.clientX - startX;
      const dy = next.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      updateViewport({ x: origin.x + dx, y: origin.y + dy, zoom: origin.zoom });
    };
    // 只有「原地单击空白处」才取消选中；单纯平移视图不打断当前选中。
    const up = () => {
      if (!moved) onPaneClick?.();
      stopGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onPaneClick, stopGesture, updateViewport]);

  const beginNodeDrag = useCallback((node, event) => {
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
    setLiveDrag({ id: node.id, position: origin });
    let latest = origin;
    const move = (next) => {
      latest = {
        x: origin.x + (next.clientX - startX) / viewportRef.current.zoom,
        y: origin.y + (next.clientY - startY) / viewportRef.current.zoom
      };
      setLiveDrag({ id: node.id, position: latest });
    };
    const up = () => {
      if (latest !== origin) onNodeMove?.(node.id, latest);
      setLiveDrag(null);
      stopGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onNodeDragStart, onNodeMove, onNodeSelect, stopGesture]);

  const beginConnection = useCallback((source, event) => {
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

  // 画布滚轮/手势：原生 non-passive 监听，preventDefault 才真正生效——
  // 画布内的一切滚动/缩放手势只作用于画布，不再外溢为页面滚动或浏览器缩放。
  useEffect(() => {
    const canvas = rootRef.current;
    if (!canvas) return undefined;
    const onCanvasWheel = (event) => {
      event.preventDefault();
      cancelViewportAnimation();
      const rect = canvas.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        // 缩放：Ctrl/⌘+滚轮，或触控板捏合（捏合手势带 ctrlKey）
        updateViewport((current) => {
          const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0012), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
          return {
            x: cursorX - (cursorX - current.x) * (zoom / current.zoom),
            y: cursorY - (cursorY - current.y) * (zoom / current.zoom),
            zoom
          };
        });
      } else {
        // 平移：触控板双指滑动 / 鼠标滚轮
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
    const displayLabel = edge.autoLogicLabel
      ? branchDisplayLabel(gateBranchForEdge(edge), copy)
      : edge.label;
    edgeElements.push(
      React.createElement("g", { key: edge.id, className: "df-graph__edge-group", "data-edge-id": edge.id },
        React.createElement("path", {
          className: `df-graph__edge${selected ? " is-selected" : ""}`,
          d: geometry.path,
          markerEnd: `url(#${markerIdRef.current})`
        }),
        React.createElement("path", {
          className: "df-graph__edge-hit",
          d: geometry.path,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.stopPropagation();
            onEdgeSelect?.(edge.id);
          }
        }),
        displayLabel ? React.createElement("g", { transform: `translate(${geometry.label.x} ${geometry.label.y})` },
          React.createElement("rect", { className: "df-graph__label-bg", x: -18, y: -10, width: 36, height: 20, rx: 7 }),
          React.createElement("text", { className: "df-graph__label", x: 0, y: 1 }, String(displayLabel))
        ) : null
      )
    );
  }
  if (connectionDraft) {
    const bend = Math.max(54, Math.abs(connectionDraft.end.x - connectionDraft.start.x) * 0.46);
    edgeElements.push(React.createElement("path", {
      key: "connection-draft",
      className: "df-graph__connection",
      d: `M ${connectionDraft.start.x} ${connectionDraft.start.y} C ${connectionDraft.start.x + bend} ${connectionDraft.start.y}, ${connectionDraft.end.x - bend} ${connectionDraft.end.y}, ${connectionDraft.end.x} ${connectionDraft.end.y}`
    }));
  }

  return React.createElement("div", {
    ref: rootRef,
    className: `df-canvas${panning ? " is-panning" : ""}`,
    onPointerDown: beginPan
  },
    React.createElement("div", {
      className: "df-graph__stage",
      style: { transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})` }
    },
      React.createElement("svg", { className: "df-graph__edges", width: 1, height: 1, "aria-label": "Workflow arrows" },
        React.createElement("defs", null,
          React.createElement("marker", {
            id: markerIdRef.current,
            markerWidth: 10,
            markerHeight: 10,
            refX: 9,
            refY: 5,
            orient: "auto",
            markerUnits: "strokeWidth",
            viewBox: "0 0 10 10"
          }, React.createElement("path", { d: "M 0 0 L 10 5 L 0 10 Z", fill: "var(--df-brand)" }))
        ),
        edgeElements
      ),
      renderNodes.map((node) => React.createElement("div", {
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
        React.createElement(FlowNode, { data: node.data, selected: selectedNode === node.id, copy }),
        React.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--target",
          "data-df-target-id": node.id,
          "aria-label": `Connect into ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => event.stopPropagation()
        }),
        React.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--source",
          "data-df-source-id": node.id,
          "aria-label": `Connect from ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => beginConnection(node.id, event)
        })
      ))
    ),
    React.createElement("div", { className: "df-graph__controls" },
      React.createElement("button", { type: "button", title: zoomInLabel, "aria-label": zoomInLabel, onClick: () => zoomAtCenter(1.2) }, "+"),
      React.createElement("button", { type: "button", title: zoomOutLabel, "aria-label": zoomOutLabel, onClick: () => zoomAtCenter(1 / 1.2) }, "−"),
      React.createElement("button", { type: "button", title: fitLabel, "aria-label": fitLabel, onClick: () => fitView({}) }, "⊙")
    )
  );
}

// DeepSeekFlow Client — 流程图编辑器（每个 session 独立视图）
// 挂载点：conversation.view slot（Chat 旁的视图入口），inject 提供当前 sessionId
// 主题：全部使用 dsw alias token（--dsw-alias-*），明暗主题自动跟随 webui

const import_react3 = require("react");
const React = import_react3.default ?? import_react3;
const { useState, useEffect, useLayoutEffect, useMemo, useCallback } = import_react3;
function loadPositionOverrides(flowId) {
  try {
    return JSON.parse(localStorage.getItem(`deepseek-flow:positions:${flowId}`) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}

const inject = ["slots", "connection", "locale"];
const CLIENT_REV = "9076aa95fe5f";


// ============ API ============
async function remoteCall(connection, endpoint, args = {}) {
  const result = await connection.rpc.call("/api", endpoint, { args });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function newRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Older embedded WebViews may not expose crypto.randomUUID.
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


// Canvas rendering and graph transformations live in focused, independently testable modules.
const PANEL_COLLAPSE_THRESHOLD = 108;
const LEFT_PANEL_DEFAULT = 264;
const RIGHT_PANEL_DEFAULT = 380;
const ASSISTANT_DEFAULT = 240;
const ASSISTANT_COLLAPSE_THRESHOLD = 118;

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
    // Private browsing or a locked-down WebView can reject persistence.
  }
}

// ============ Studio ============
function Studio({ connection, sessionId, language }) {
  const t = useMemo(() => text(language), [language]);
  const [flows, setFlows] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [activeDoc, setActiveDoc] = useState("workflow");
  const [documentsOpen, setDocumentsOpen] = useState(() => storedBoolean("deepseek-flow:left-open", window.innerWidth > 1040));
  const [inspectorOpen, setInspectorOpen] = useState(() => storedBoolean("deepseek-flow:right-open", window.innerWidth > 1040));
  const [documentWidth, setDocumentWidth] = useState(() => storedNumber("deepseek-flow:left-width", LEFT_PANEL_DEFAULT));
  const [inspectorWidth, setInspectorWidth] = useState(() => storedNumber("deepseek-flow:right-width", RIGHT_PANEL_DEFAULT));
  const [studioWidth, setStudioWidth] = useState(() => Math.max(640, Number(window.innerWidth) || 1200));
  const [message, setMessage] = useState(t.ready);
  const [dirty, setDirty] = useState(false);
  const [flowInstance, setFlowInstance] = useState(null);
  const [gatePickerOpen, setGatePickerOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [connectionWarning, setConnectionWarning] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(() => storedBoolean("deepseek-flow:assistant-open", false));
  const [assistantHeight, setAssistantHeight] = useState(() => storedNumber("deepseek-flow:assistant-height", ASSISTANT_DEFAULT));
  const [assistantBusy, setAssistantBusy] = useState(null);
  // 需求：busy 按文档隔离（per-target），切文档后按钮回到初始态，可并发发起其他文档的优化。
  const [runningDocs, setRunningDocs] = useState(() => new Map());
  const [assistModel, setAssistModel] = useState("");
  // 模型选择必须连同 provider 一起传给 Host：不同 provider 下同名模型不是同一个东西，
  // 只传模型名会让 Host 错误地落到会话默认 provider 上。
  const [assistProvider, setAssistProvider] = useState(null);
  const [assistEffort, setAssistEffort] = useState("");
  const [assistMenuOpen, setAssistMenuOpen] = useState(false);
  const [assistMenuPage, setAssistMenuPage] = useState(null);
  const [assistModelOptions, setAssistModelOptions] = useState(null);
  const [assistantInstruction, setAssistantInstruction] = useState(() => {
    try {
      return window.localStorage.getItem("deepseek-flow:assistant-instruction") ?? "";
    } catch {
      return "";
    }
  });
  const [validationResult, setValidationResult] = useState(null);
  const [findingFilter, setFindingFilter] = useState(null);
  const [optimizationProposal, setOptimizationProposal] = useState(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  // 需求 6：每个文档的优化方案独立保留（切文档不丢、并发互不覆盖）。
  const proposalStoreRef = React.useRef(new Map());
  // 所有活动轮询的取消函数集合：单槽 ref 会让并发任务的轮询互相取消（按钮卡死），
  // 也会让「历史恢复」派生的轮询在卸载后泄漏成每 3 秒一次的空转。
  const pollsRef = React.useRef(new Set());
  // 上次落盘的草稿负载：内容没变就不发 RPC、不写盘。
  const lastDraftPayloadRef = React.useRef(null);
  const topologyPollRef = React.useRef(null);
  const [workflowOptimizeConfirm, setWorkflowOptimizeConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [topologyApplyConfirm, setTopologyApplyConfirm] = useState(false);
  const [topologyApplyBusy, setTopologyApplyBusy] = useState(false);
  const [persistedTopologySignature, setPersistedTopologySignature] = useState("");
  const [deleteFlowConfirm, setDeleteFlowConfirm] = useState(false);
  const [deleteFlowBusy, setDeleteFlowBusy] = useState(false);
  // 带未应用拓扑草稿时切换工作流需要显式丢弃确认。
  const [switchFlowTarget, setSwitchFlowTarget] = useState(null);
  // 文档路径输入采用「草稿 + 失焦/回车提交」：避免逐键触发整条保存链路和目录搬运。
  const [docPathDraft, setDocPathDraft] = useState(null);
  const fileRef = React.useRef(null);
  const documentTimerRef = React.useRef(null);
  const fitTimerRef = React.useRef(null);
  const documentWriteChainRef = React.useRef(Promise.resolve());
  const documentRevisionRef = React.useRef(0);
  const persistedRevisionRef = React.useRef(new Map());
  const persistedFlowRef = React.useRef(null);
  const canvasTopologyEditedRef = React.useRef(false);
  const agentFinalizeButtonRef = React.useRef(null);
  const pendingAgentFinalizeRef = React.useRef(null);
  const agentFinalizeBusyRef = React.useRef(false);
  const optimizationRequestRef = React.useRef(0);
  const activeAssistRef = React.useRef(null);
  const currentIdRef = React.useRef(null);
  const nodesRef = React.useRef([]);
  const edgesRef = React.useRef([]);
  const historyRef = React.useRef({ past: [], future: [] });
  const studioRef = React.useRef(null);
  const canvasShellRef = React.useRef(null);
  const panelDragRef = React.useRef(null);
  const assistantDragRef = React.useRef(null);
  const assistMenuRef = React.useRef(null);
  // 后台轻量同步：记录最近一次已知的 flow 元数据签名，revision 无变化就不拉全量文档。
  const flowMetaSnapshotRef = React.useRef(null);
  // 初始加载承诺：历史恢复必须等它完成，否则 showFlow 的重置会盖掉恢复的结果（切屏丢失的根因之一）。
  const initialLoadRef = React.useRef(null);
  // 逻辑校验结果按 flowId 存取：切走再切回、拓扑应用后都不再凭空消失。
  const validationStoreRef = React.useRef(new Map());
  // 未应用画布草稿：防抖落盘到 Host ui-state，重启/切屏都可恢复。
  const draftTimerRef = React.useRef(null);
  const draftSavedRef = React.useRef(false);
  const flushDocumentsRef = React.useRef(null);
  const pendingDocumentSnapshotRef = React.useRef(null);

  // flow 元数据签名：id + 归属 + revision，用于后台轻量同步的变更判断。
  const flowMetaSnapshot = useCallback((items) => JSON.stringify(
    (Array.isArray(items) ? items : []).map((flow) => [flow.id, flow.sessionId ?? null, Number(flow.revision) || 0])
  ), []);

  const markCanvasTopologyEdit = useCallback(() => {
    canvasTopologyEditedRef.current = true;
  }, []);

  const fitWholeFlow = useCallback((duration = 260) => {
    flowInstance?.fitView?.({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration });
  }, [flowInstance]);

  const beginPanelResize = useCallback((side, event) => {
    if (event.button !== undefined && event.button !== 0) return;
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
      if (pointerId !== undefined && moveEvent.pointerId !== undefined && moveEvent.pointerId !== pointerId) return;
      const delta = isLeft ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      if (Math.abs(delta) > 3) moved = true;
      lastWidth = Math.max(0, Math.min(maximum, startWidth + delta));
      if (lastWidth > 4) setOpen(true);
      setWidth(Math.max(1, lastWidth));
    };
    const onUp = (upEvent) => {
      if (pointerId !== undefined && upEvent.pointerId !== undefined && upEvent.pointerId !== pointerId) return;
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

  const panelKeyDown = useCallback((side, event) => {
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

  const beginAssistantResize = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
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
      if (pointerId !== undefined && moveEvent.pointerId !== undefined && moveEvent.pointerId !== pointerId) return;
      const delta = startY - moveEvent.clientY;
      if (Math.abs(delta) > 3) moved = true;
      lastHeight = Math.max(44, Math.min(maximum, startHeight + delta));
      if (lastHeight >= ASSISTANT_COLLAPSE_THRESHOLD) setAssistantOpen(true);
      setAssistantHeight(lastHeight);
    };
    const onUp = (upEvent) => {
      if (pointerId !== undefined && upEvent.pointerId !== undefined && upEvent.pointerId !== pointerId) return;
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

  const showFlow = useCallback((flow, options = {}) => {
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
    // 校验结果与优化方案按 flow/文档存取（validationStoreRef / proposalStoreRef +
    // 下方 [currentId, assistantTarget] 恢复 effect），不再在每次加载时清空：
    // 切屏回来、拓扑应用、后台同步都不该让用户没保存的 AI 结果凭空消失。
    setWorkflowOptimizeConfirm(false);
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(false);
    if (options.resetDocument !== false) {
      setSelected(null);
      setActiveDoc("workflow");
    }
  }, [setEdges, setNodes, t]);

  const restorePersistedDraft = useCallback(async (flow) => {
    if (!flow?.id) return;
    try {
      const draft = await remoteCall(connection, "dflow/draftGet", { sessionId, flowId: flow.id });
      if (!draft || !Array.isArray(draft.nodes) || draft.nodes.length === 0) return;
      const persistedRevision = persistedRevisionRef.current.get(flow.id);
      if (Number.isInteger(persistedRevision) && Number(draft.baseRevision) !== persistedRevision) {
        // 基线已前进：草稿大概率已被应用或过期，静默丢弃，避免「应用修改」必然撞 revision 冲突。
        remoteCall(connection, "dflow/draftClear", { sessionId, flowId: flow.id }).catch(() => {});
        return;
      }
      canvasTopologyEditedRef.current = draft.canvasEdited ?? true;
      nodesRef.current = draft.nodes;
      edgesRef.current = draft.edges ?? [];
      setNodes(draft.nodes);
      setEdges(draft.edges ?? []);
      if (draft.activeDoc) {
        setSelected(draft.activeDoc === "workflow" ? null : draft.activeDoc);
        setActiveDoc(draft.activeDoc);
      }
      setDirty(true);
      draftSavedRef.current = true;
      setMessage(t.draftRestored);
    } catch {
      // 草稿恢复失败不阻塞编辑器。
    }
  }, [connection, sessionId, setEdges, setNodes, t.draftRestored]);

  const loadFlows = useCallback(async () => {
    try {
      const items = await remoteCall(connection, "dflow/list", { sessionId });
      setFlows(items);
      flowMetaSnapshotRef.current = flowMetaSnapshot(items);
      const first = items.find((item) => item.id === currentIdRef.current) ?? items[0];
      if (first) {
        showFlow(first, { resetDocument: currentIdRef.current !== first.id });
        await restorePersistedDraft(first);
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
  }, [connection, flowMetaSnapshot, restorePersistedDraft, sessionId, setEdges, setNodes, showFlow, t.ready]);

  useEffect(() => {
    // 初始加载承诺：历史恢复等它落定后再执行，消除「showFlow 重置 vs 结果恢复」的竞态。
    if (!initialLoadRef.current) initialLoadRef.current = loadFlows().catch(() => {});
  }, [loadFlows]);

  useEffect(() => {
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

  useEffect(() => {
    // 需求 1：从 Host 恢复本 Session 的 assist 结果（切视图/卸载后回来，方案和校验结果不丢）。
    // 先等初始加载完成：showFlow 的结构性重置必须先落定，恢复的结果才不会被覆盖。
    let cancelled = false;
    (async () => {
      try {
        await (initialLoadRef.current ?? Promise.resolve());
        const history = await remoteCall(connection, "dflow/assistHistory", { sessionId });
        if (cancelled || !Array.isArray(history)) return;
        const currentFlowId = currentIdRef.current;
        const matchesFlow = (entry) => !entry.flowId || entry.flowId === currentFlowId;
        let latestLogic = null;
        for (const entry of history) {
          if (entry.mode === "optimize" && entry.target && !proposalStoreRef.current.has(entry.target)) {
            if (entry.status === "done" && entry.result) {
              proposalStoreRef.current.set(entry.target, { ...entry.result, target: entry.target });
            } else if (entry.status === "error") {
              proposalStoreRef.current.set(entry.target, { status: "error", target: entry.target, error: entry.error ?? "failed" });
            } else if (entry.status === "running") {
              // 仍在运行：继续轮询直到完成（切视图后回来不用手动刷新）
              const target = entry.target;
              const requestId = entry.key.split(":").pop();
              setRunningDocs((prev) => { const next = new Map(prev); next.set(target, requestId); return next; });
              trackPoll(requestId, (finalEntry) => {
                if (finalEntry.status === "cancelled") {
                  if (assistantTargetRef.current === target) setMessage(t.assistantCancelled);
                } else if (finalEntry.status === "done" && finalEntry.result) {
                  const proposal = { ...finalEntry.result, target: finalEntry.result.target ?? target, documentLabel: assistantDocLabel };
                  proposalStoreRef.current.set(target, proposal);
                  if (assistantTargetRef.current === target) {
                    setOptimizationProposal(proposal);
                    setAssistantDraft(proposal.suggestedContent ?? "");
                  }
                } else {
                  proposalStoreRef.current.set(target, { status: "error", target, error: String(finalEntry.error ?? "failed") });
                  if (assistantTargetRef.current === target) setMessage(t.assistantFailed + String(finalEntry.error ?? ""));
                }
                setRunningDocs((prev) => { const next = new Map(prev); next.delete(target); return next; });
                activeAssistRef.current = null;
              });
            }
          } else if (entry.mode === "logic" && entry.status === "done" && entry.result && !latestLogic && matchesFlow(entry)) {
            // 只取最新一次同 flow 的校验结果（历史按新→旧排序）。
            latestLogic = entry;
          } else if (entry.mode === "logic" && entry.status === "running" && matchesFlow(entry)) {
            // 逻辑校验仍在运行：继续轮询直到完成（切 UI 回来不用重新发起）
            const requestId = entry.key.split(":").pop();
            setAssistantBusy("logic");
            trackPoll(requestId, (finalEntry) => {
              if (finalEntry.status === "cancelled") {
                setMessage(t.assistantCancelled);
              } else if (finalEntry.status === "done" && finalEntry.result) {
                validationStoreRef.current.set(finalEntry.flowId ?? currentIdRef.current, finalEntry.result);
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
            if (topologyPollRef.current) pollsRef.current.delete(topologyPollRef.current);
            topologyPollRef.current?.();
            topologyPollRef.current = pollAssist(requestId, (finalEntry) => {
              pollsRef.current.delete(topologyPollRef.current);
              topologyPollRef.current = null;
              setTopologyApplyBusy(false);
              if (finalEntry.status === "done" && finalEntry.result?.flow) {
                showFlow(finalEntry.result.flow, { resetDocument: false });
                setDirty(false);
                setMessage(finalEntry.result.summary ? `${t.topologyApplied}：${finalEntry.result.summary}` : t.topologyApplied);
              } else {
                setMessage(t.topologyApplyFailed + String(finalEntry.error ?? ""));
              }
            });
            pollsRef.current.add(topologyPollRef.current);
          } else if (entry.mode === "topology-apply" && entry.status === "done" && entry.result?.flow) {
            const knownRevision = persistedRevisionRef.current.get(entry.result.flow.id) ?? 0;
            if (Number(entry.result.flow.revision) > knownRevision) {
              showFlow(entry.result.flow, { resetDocument: false });
              setDirty(false);
            }
          } else if (entry.mode === "optimize-workflow" && entry.status === "running") {
            // 整体优化仍在运行：恢复运行态并继续轮询（切屏/切 Session 不丢任务）。
            const requestId = entry.key.split(":").pop();
            setAssistantBusy("optimize-workflow");
            setAssistantOpen(true);
            setOptimizationProposal(null);
            setAssistantDraft("");
            trackPoll(requestId, (finalEntry) => applyWorkflowOptimization(finalEntry, {
              requestId,
              flow: null,
              requireUnchangedRevision: false
            }));
          } else if (entry.mode === "optimize-workflow" && entry.status === "done" && entry.result) {
            // 离开期间已完成：回来后应用（requestId 去重，避免每次挂载重复应用）。
            const requestId = entry.key.split(":").pop();
            applyWorkflowOptimization(entry, { requestId, flow: null, requireUnchangedRevision: false });
          }
        }
        if (latestLogic) {
          validationStoreRef.current.set(latestLogic.flowId ?? currentFlowId, latestLogic.result);
          setValidationResult(latestLogic.result);
          setFindingFilter(null);
        }
        const proposal = proposalStoreRef.current.get(assistantTargetRef.current);
        if (proposal && typeof proposal.suggestedContent === "string") {
          setOptimizationProposal(proposal);
          setAssistantDraft(proposal.suggestedContent);
        }
      } catch {
        // 历史恢复失败不阻塞编辑器。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, sessionId]);

  useEffect(() => {
    const element = studioRef.current;
    if (!element) return undefined;
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

  // 助手模型菜单：点击菜单外任意位置关闭（此前只有再点一次按钮才能关）。
  useEffect(() => {
    if (!assistMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (assistMenuRef.current && !assistMenuRef.current.contains(event.target)) setAssistMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [assistMenuOpen]);

  useEffect(() => keepLayout("deepseek-flow:left-open", documentsOpen), [documentsOpen]);
  useEffect(() => keepLayout("deepseek-flow:right-open", inspectorOpen), [inspectorOpen]);
  useEffect(() => keepLayout("deepseek-flow:left-width", Math.round(documentWidth)), [documentWidth]);
  useEffect(() => keepLayout("deepseek-flow:right-width", Math.round(inspectorWidth)), [inspectorWidth]);
  useEffect(() => keepLayout("deepseek-flow:assistant-open", assistantOpen), [assistantOpen]);
  useEffect(() => keepLayout("deepseek-flow:assistant-height", Math.round(assistantHeight)), [assistantHeight]);
  useEffect(() => keepLayout("deepseek-flow:assistant-instruction", assistantInstruction), [assistantInstruction]);

  useEffect(() => () => {
    // 卸载（切视图/切会话）时立刻冲刷 650ms 防抖窗口内的文档修改，而不是静默丢弃。
    if (documentTimerRef.current) {
      clearTimeout(documentTimerRef.current);
      documentTimerRef.current = null;
      flushDocumentsRef.current?.();
    }
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    for (const cancel of pollsRef.current) cancel();
    pollsRef.current.clear();
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
      // 需求 1：切换视图不中断后台请求——不再主动 cancel；Host 侧会暂存结果，
      // 重新挂载时通过 dflow/assistHistory 恢复。
      activeAssistRef.current = null;
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [connection, sessionId]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    // 只在切换工作流时整图居中：新增/删除流程框后视图不应突然缩放跳动，
    // 用户此刻往往正在检查器里编辑。
    if (!flowInstance || !currentId || nodes.length === 0) return undefined;
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      fitTimerRef.current = null;
      flowInstance.fitView({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration: 320 });
    }, 600);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [currentId, flowInstance]);

  // 拓扑派生值全部 memo 化：这些计算要做多次 JSON 序列化，
  // 若在每次渲染（包括拖拽、消息更新）都重算，大图会明显掉帧。
  const currentFlow = useMemo(() => flows.find((f) => f.id === currentId) ?? null, [currentId, flows]);
  const currentDraftFlow = useMemo(
    () => currentFlow ? serializeFlow(currentFlow, nodes, edges) : null,
    [currentFlow, nodes, edges]
  );
  const currentTopologySignature = useMemo(
    () => currentDraftFlow ? topologySignature(currentDraftFlow) : "",
    [currentDraftFlow]
  );
  const topologyDirty = Boolean(currentDraftFlow && currentTopologySignature !== persistedTopologySignature);
  const topologyDelta = useMemo(() => currentDraftFlow
    ? topologyDiff(persistedFlowRef.current ?? {
        ...currentDraftFlow,
        nodes: [],
        edges: [],
        inputs: [],
        outputs: []
      }, currentDraftFlow)
    : null, [currentDraftFlow, persistedTopologySignature]);
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selected) ?? null, [nodes, selected]);

  const selectFlow = async (id) => {
    if (id === currentId) return;
    // 有未应用的拓扑草稿时切换会丢草稿，必须先让用户显式选择「丢弃并切换」，
    // 而不是顺手把拓扑送审或静默丢弃。
    if (topologyDirty) {
      setSwitchFlowTarget(id);
      return;
    }
    if (dirty || documentTimerRef.current) {
      const saved = await save();
      if (!saved) return;
    }
    const flow = flows.find((f) => f.id === id);
    if (!flow) return;
    showFlow(flow);
    setDirty(false);
  };

  const discardAndSwitchFlow = useCallback(() => {
    const target = switchFlowTarget;
    setSwitchFlowTarget(null);
    if (!target) return;
    if (documentTimerRef.current) {
      clearTimeout(documentTimerRef.current);
      documentTimerRef.current = null;
    }
    ++documentRevisionRef.current;
    pendingDocumentSnapshotRef.current = null;
    // 用户显式丢弃：被离开工作流的未应用草稿一并清除（这是唯一主动删草稿的路径之一）。
    const discardedFlowId = currentIdRef.current;
    if (discardedFlowId && discardedFlowId !== target) {
      draftSavedRef.current = false;
      remoteCall(connection, "dflow/draftClear", { sessionId, flowId: discardedFlowId }).catch(() => {});
    }
    const flow = flows.find((f) => f.id === target);
    if (!flow) return;
    showFlow(flow);
    setDirty(false);
    setMessage(t.discardedDraftSwitch);
  }, [connection, flows, sessionId, showFlow, switchFlowTarget, t.discardedDraftSwitch]);

  const finalizeTopologyDirectly = useCallback(async () => {
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
      await documentWriteChainRef.current.catch(() => {});
      const draftFlow = serializeFlow(baseFlow, nodesRef.current, edgesRef.current);
      const finalized = await remoteCall(connection, "dflow/topologyFinalize", {
        request: {
          sessionId,
          draftFlow,
          ...(pending?.requestId
            ? { requestId: pending.requestId }
            : {
                source: "external-files",
                expectedRevision: persistedRevisionRef.current.get(flowId)
              })
        }
      });
      if (!finalized?.finalized || !finalized.flow) throw new Error("Hidden finalize did not return a saved flow");
      const saved = finalized.flow;
      setFlows((items) => items.some((item) => item.id === saved.id)
        ? items.map((item) => item.id === saved.id ? { ...item, ...saved } : item)
        : [saved, ...items]);
      showFlow(saved, { resetDocument: false });
      setDirty(false);
      setMessage(t.hiddenFinalizeApplied);
    } catch (error) {
      // Stop automatic retries. The visible Apply action remains available and
      // follows the normal main-Session review path.
      canvasTopologyEditedRef.current = true;
      setMessage(t.hiddenFinalizeFailed + String(error));
    } finally {
      pendingAgentFinalizeRef.current = null;
      agentFinalizeBusyRef.current = false;
      setTopologyApplyBusy(false);
    }
  }, [connection, sessionId, showFlow, t.hiddenFinalizeApplied, t.hiddenFinalizeApplying, t.hiddenFinalizeFailed]);

  // Primary path: topology that appeared without any canvas edit event came
  // from an external file/session refresh, so the invisible direct-finalize
  // action is safe to press automatically. User canvas edits set the ref first
  // and continue through the visible review button.
  useEffect(() => {
    if (!topologyDirty || topologyApplyBusy || canvasTopologyEditedRef.current) return undefined;
    const timer = window.setTimeout(() => agentFinalizeButtonRef.current?.click(), 120);
    return () => window.clearTimeout(timer);
  }, [currentTopologySignature, topologyApplyBusy, topologyDirty]);

  // Secondary path: an Agent that directly edited workflow files can enqueue
  // the same invisible action. Requests survive until Studio is opened.
  useEffect(() => {
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
        // A missed poll is harmless; the one-time request remains queued.
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

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    // 后台同步走「轻量 revision 轮询」：dflow/revisions 只回 id/revision，
    // 元数据没变就不拉全量文档；页签隐藏时完全静默，回到可见立即补一次。
    const refreshPersistedFlow = async () => {
      if (refreshing || document.hidden || topologyApplyBusy || documentTimerRef.current) return;
      refreshing = true;
      try {
        const meta = await remoteCall(connection, "dflow/revisions", { sessionId });
        if (cancelled || !Array.isArray(meta)) return;
        const nextSnapshot = flowMetaSnapshot(meta);
        if (nextSnapshot === flowMetaSnapshotRef.current) return;
        const items = await remoteCall(connection, "dflow/list", { sessionId });
        if (cancelled || !Array.isArray(items)) return;
        flowMetaSnapshotRef.current = flowMetaSnapshot(items);
        setFlows(items);
        const flowId = currentIdRef.current;
        const baseFlow = persistedFlowRef.current;
        if (!flowId || !baseFlow) return;
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
        // Background synchronization is opportunistic; normal load/apply paths
        // keep their explicit error handling.
      } finally {
        refreshing = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPersistedFlow();
    };
    const timer = window.setInterval(refreshPersistedFlow, 5000);
    window.addEventListener("focus", refreshPersistedFlow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshPersistedFlow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connection, flowMetaSnapshot, sessionId, showFlow, t.topologyAlreadyPersisted, t.topologySessionConflict, t.topologySessionSynced, topologyApplyBusy]);

  const selectedConditionInputs = selectedNode?.data?.kind === "condition"
    ? edges
        .filter((edge) => edge.target === selectedNode.id)
        .map((edge) => {
          const source = nodes.find((node) => node.id === edge.source);
          return { edgeId: edge.id, sourceId: edge.source, label: source?.data?.label ?? edge.source };
        })
    : [];
  const selectedGateRule = selectedNode?.data?.kind === "condition"
    ? gateRule(selectedNode.data.gateType)
    : null;
  const selectedGateArityValid = !selectedGateRule
    || (selectedConditionInputs.length >= selectedGateRule.minInputs
      && selectedConditionInputs.length <= selectedGateRule.maxInputs);

  const persistDocumentSnapshot = useCallback(async (flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return null;
    let editorFlow;
    const operation = documentWriteChainRef.current.catch(() => {}).then(async () => {
      const persisted = persistedFlowRef.current;
      if (!persisted || persisted.id !== flowSnapshot.id) return null;
      editorFlow = serializeFlow(flowSnapshot, nodeSnapshot, edgeSnapshot);
      const documentOnly = mergeDocumentEdits(persisted, editorFlow, nodeSnapshot);
      const persistedRevision = persistedRevisionRef.current.get(documentOnly.id);
      const payload = Number.isInteger(persistedRevision)
        ? { ...documentOnly, revision: persistedRevision }
        : documentOnly;
      return remoteCall(connection, "dflow/put", { flow: payload, sessionId });
    });
    documentWriteChainRef.current = operation.then(() => undefined, () => undefined);
    const saved = await operation;
    if (!saved) return null;
    persistedFlowRef.current = saved;
    persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
    setPersistedTopologySignature(topologySignature(saved));
    setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
    setDirty(topologySignature(editorFlow) !== topologySignature(saved));
    return saved;
  }, [connection, sessionId]);

  const scheduleDocumentSave = useCallback((flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return;
    if (!persistedFlowRef.current || persistedFlowRef.current.id !== flowSnapshot.id) {
      setMessage(t.topologyApplyFirst);
      return;
    }
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    const editRevision = ++documentRevisionRef.current;
    // 记录待冲刷快照：视图卸载时立即落盘，防抖窗口不再是丢失窗口。
    pendingDocumentSnapshotRef.current = { flowSnapshot, nodeSnapshot, edgeSnapshot, editRevision };
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

  const rememberGraph = useCallback(() => {
    const snapshot = graphSnapshot(nodesRef.current, edgesRef.current);
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) {
      history.past.push(snapshot);
      if (history.past.length > 60) history.past.shift();
    }
    history.future = [];
  }, []);

  const restoreGraph = useCallback((snapshot) => {
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

  const undoGraph = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(graphSnapshot(nodesRef.current, edgesRef.current));
    restoreGraph(previous);
  }, [restoreGraph]);

  const redoGraph = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(graphSnapshot(nodesRef.current, edgesRef.current));
    restoreGraph(next);
  }, [restoreGraph]);

  const showConnectionWarning = useCallback((problem) => {
    const warning = typeof problem === "string" ? problem : connectionProblemMessage(problem, t);
    setMessage(warning || t.invalidConnection);
    setConnectionWarning(warning || t.invalidConnection);
  }, [t]);

  const commitConnection = useCallback((conn, requestedBranch = null) => {
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
      ...(condition ? {
        sourceHandle: branch,
        label: branchDisplayLabel(branch, t),
        autoLogicLabel: true
      } : {})
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

  const onConnect = useCallback((conn) => {
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

  const onConnectionRejected = useCallback((conn) => {
    showConnectionWarning(connectionProblem(nodesRef.current, edgesRef.current, conn));
  }, [showConnectionWarning]);

  const onReconnect = useCallback((oldEdge, connectionParams) => {
    rememberGraph();
    markCanvasTopologyEdit();
    setEdges((items) => reconnectFlowEdge(oldEdge, connectionParams, items).map((edge) => edge.id === oldEdge.id
      ? {
          ...edge,
          label: branchDisplayLabel(gateBranchForEdge(connectionParams), t),
          autoLogicLabel: true
        }
      : edge));
    ++documentRevisionRef.current;
    setDirty(true);
  }, [markCanvasTopologyEdit, rememberGraph, setEdges, t]);

  const isValidConnection = useCallback((connectionParams) => {
    return connectionProblem(nodesRef.current, edgesRef.current, connectionParams).valid;
  }, []);

  const moveNode = useCallback((id, position) => {
    setNodes((items) => items.map((node) => node.id === id ? { ...node, position } : node));
    // 位置是查看状态（与面板宽度同级）：拖拽结束时静默持久化一次，
    // 不参与拓扑事务，也不把文档保存状态弄脏。key 必须取当前 flow id——
    // 旧实现闭包捕获了初始 currentId(null)，导致所有位置都写进同一个废桶。
    try {
      const key = `deepseek-flow:positions:${currentIdRef.current}`;
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      stored[id] = position;
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // 存储不可用时忽略
    }
  }, []);

  const createNode = (kind, gateType = null) => {
    rememberGraph();
    markCanvasTopologyEdit();
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    // 新流程框落在用户正在看的视口中心（连续新建时阶梯错开），
    // 不再随机出现在左上角、需要用户到处找。
    const center = flowInstance?.screenCenter?.() ?? { x: 160, y: 120 };
    const cascade = nodes.length % 4;
    const node = {
      id,
      type: "flow",
      position: { x: center.x + cascade * 26, y: center.y + cascade * 26 },
      data: {
        kind,
        label: t.nodeKind[kind] ?? kind,
        ...(kind === "condition" ? { gateType: normalizeGateType(gateType) } : {}),
        ...(kind === "agent" || kind === "mapAgent" ? { prompt: "{{input}}" } : {})
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

  // 文档驱动：把选中节点绑定到 docRoot 下的 MD 文件（空值解除绑定）。
  const patchDoc = (rel) => {
    if (!currentFlow || !selected) return;
    const docs = { ...(currentFlow.docs ?? {}) };
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
      const docs = { ...(flow.docs ?? {}) };
      delete docs[selected];
      return { ...flow, docs };
    }));
    setSelected(null);
    setActiveDoc("workflow");
    ++documentRevisionRef.current;
    setDirty(true);
  };

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    rememberGraph();
    markCanvasTopologyEdit();
    setEdges((items) => items.filter((edge) => edge.id !== selectedEdge));
    setSelectedEdge(null);
    ++documentRevisionRef.current;
    setDirty(true);
  }, [markCanvasTopologyEdit, rememberGraph, selectedEdge, setEdges]);

  const tidyGraph = useCallback(() => {
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

  const deleteCurrentFlow = async () => {
    if (!currentFlow || deleteFlowBusy) return;
    setDeleteFlowBusy(true);
    try {
      // 共享模板没有 sessionId，需要显式走 shared 通道删除。
      await remoteCall(connection, "dflow/delete", {
        sessionId,
        id: currentFlow.id,
        ...(currentFlow.sessionId ? {} : { shared: true })
      });
      if (documentTimerRef.current) {
        clearTimeout(documentTimerRef.current);
        documentTimerRef.current = null;
      }
      pendingDocumentSnapshotRef.current = null;
      draftSavedRef.current = false;
      remoteCall(connection, "dflow/draftClear", { sessionId, flowId: currentFlow.id }).catch(() => {});
      ++documentRevisionRef.current;
      setMessage(t.deleteFlowDone + String(currentFlow.name));
      setDeleteFlowConfirm(false);
      await loadFlows();
    } catch (error) {
      setMessage(t.deleteFlowFailed + String(error));
    } finally {
      setDeleteFlowBusy(false);
    }
  };

  const assistantTarget = activeDoc === "workflow" ? "workflow" : activeDoc;
  const assistantDocLabel = assistantTarget === "workflow"
    ? (currentFlow?.workflowDoc ?? "WORKFLOW.md")
    : (currentFlow?.docs?.[assistantTarget] ?? `${assistantTarget}/STEP.md`);
  const assistantTargetRef = React.useRef(assistantTarget);
  useEffect(() => {
    assistantTargetRef.current = assistantTarget;
  }, [assistantTarget]);

  useEffect(() => {
    // 路径草稿跟随选中节点/工作流：切走即放弃未提交的半截路径。
    setDocPathDraft(null);
  }, [selected, currentId]);

  useEffect(() => {
    // 卸载冲刷用：始终持有「按最新快照持久化」的可调用闭包。
    flushDocumentsRef.current = () => {
      const pending = pendingDocumentSnapshotRef.current;
      if (pending) persistDocumentSnapshot(pending.flowSnapshot, pending.nodeSnapshot, pending.edgeSnapshot).catch(() => {});
    };
  }, [persistDocumentSnapshot]);

  useEffect(() => {
    // 校验结果按 flow 恢复：切走再切回、重启后重新挂载都能看到上一次的结果。
    setValidationResult(currentId ? validationStoreRef.current.get(currentId) ?? null : null);
    setFindingFilter(null);
  }, [currentId]);

  useEffect(() => {
    // 未应用草稿防抖落盘（800ms）：切视图/重启后由 restorePersistedDraft 恢复。
    if (!currentId || (!dirty && !topologyDirty) || topologyApplyBusy) return undefined;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    const flowId = currentId;
    const savedAtBase = persistedRevisionRef.current.get(flowId);
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null;
      const draft = {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        activeDoc,
        canvasEdited: canvasTopologyEditedRef.current,
        baseRevision: savedAtBase
      };
      const payload = JSON.stringify(draft);
      if (payload === lastDraftPayloadRef.current) return;
      lastDraftPayloadRef.current = payload;
      draftSavedRef.current = true;
      remoteCall(connection, "dflow/draftSave", { sessionId, flowId, draft }).catch(() => {});
    }, 800);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [activeDoc, connection, currentId, dirty, nodes, edges, sessionId, topologyApplyBusy, topologyDirty]);

  useEffect(() => {
    // 一切提交干净（保存/应用/定稿完成）后自动清草稿；仅在本会话确实保存过草稿时触发，
    // 避免挂载瞬间把等待恢复的草稿误删。
    if (!currentId || dirty || topologyDirty || topologyApplyBusy || !draftSavedRef.current) return;
    draftSavedRef.current = false;
    lastDraftPayloadRef.current = null;
    remoteCall(connection, "dflow/draftClear", { sessionId, flowId: currentId }).catch(() => {});
  }, [connection, currentId, dirty, sessionId, topologyApplyBusy, topologyDirty]);

  useEffect(() => {
    // 需求 6：切换文档时恢复该文档自己的方案槽（不存在则清空显示）。
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

  // 轮询 Host 侧 assist 结果（fire-and-forget 模式：请求在 Host 独立执行，Client 断开不影响）。
  // 三重保险避免「卡着一直循环」：单条 key 查询（不拉全量历史）、连续失败上限、总时长上限。
  const pollAssist = (agentRequestId, onDone) => {
    const startedAt = Date.now();
    let failures = 0;
    const timer = setInterval(async () => {
      const expired = Date.now() - startedAt > 20 * 60_000;
      try {
        const entries = await remoteCall(connection, "dflow/assistHistory", {
          sessionId,
          key: `${sessionId}:${agentRequestId}`
        });
        const entry = Array.isArray(entries) ? entries[0] : null;
        if (!entry || entry.status === "running") {
          if (expired) {
            clearInterval(timer);
            onDone({ status: "error", error: "result polling timed out" });
          }
          return;
        }
        clearInterval(timer);
        onDone(entry);
      } catch {
        // 偶发失败下一轮重试；连续 10 次或超时则终止，绝不无限空转。
        if (++failures >= 10 || expired) {
          clearInterval(timer);
          onDone({ status: "error", error: "result polling failed repeatedly" });
        }
      }
    }, 3000);
    return () => clearInterval(timer);
  };

  // 登记/自动注销一个轮询；卸载时统一清空。
  const trackPoll = (requestId, onDone) => {
    const token = { cancel: null };
    token.cancel = pollAssist(requestId, (entry) => {
      pollsRef.current.delete(token.cancel);
      onDone(entry);
    });
    pollsRef.current.add(token.cancel);
  };

  const applyTopologyChanges = async () => {
    if (!currentFlow || !currentDraftFlow || topologyApplyBusy) return;
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(true);
    setMessage(t.topologyApplying);
    const requestId = newRequestId();
    try {
      // Reconcile a main-Session write before touching Markdown or opening an
      // Agent review. This also closes the short window before background sync.
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
      // Commit only existing Markdown first. Its payload is merged onto the
      // persisted graph, so this cannot smuggle the topology draft past review.
      if (persistedFlowRef.current) {
        await persistDocumentSnapshot(currentFlow, nodes, edges);
      } else {
        await documentWriteChainRef.current.catch(() => {});
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
          ...(assistModel ? { model: assistModel, ...(assistProvider ? { provider: assistProvider } : {}) } : {}),
          ...(assistEffort ? { reasoningEffort: assistEffort } : {})
        }
      });
      if (!accepted?.accepted) {
        setTopologyApplyBusy(false);
        if (accepted?.flow) {
          const saved = accepted.flow;
          setFlows((items) => items.some((item) => item.id === saved.id)
            ? items.map((item) => item.id === saved.id ? { ...item, ...saved } : item)
            : [saved, ...items]);
          showFlow(saved, { resetDocument: false });
        }
        setDirty(false);
        setMessage(accepted?.alreadyPersisted ? t.topologyAlreadyPersisted : t.topologyNoChanges);
        return;
      }
      if (topologyPollRef.current) pollsRef.current.delete(topologyPollRef.current);
      topologyPollRef.current?.();
      topologyPollRef.current = pollAssist(requestId, (entry) => {
        pollsRef.current.delete(topologyPollRef.current);
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
          currentIdRef.current === saved.id ? (flows.find((item) => item.id === saved.id) ?? saved) : saved,
          nodesRef.current,
          edgesRef.current
        );
        if (currentIdRef.current === saved.id && topologySignature(liveFlow) === submittedSignature) {
          showFlow(saved, { resetDocument: false });
          setDirty(false);
          setMessage(entry.result.summary ? `${t.topologyApplied}：${entry.result.summary}` : t.topologyApplied);
        } else if (currentIdRef.current === saved.id) {
          setDirty(true);
          setMessage(t.topologyAppliedWithNewDraft);
        }
      });
      pollsRef.current.add(topologyPollRef.current);
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
        request: { sessionId, requestId, flow, mode: "logic", ...(assistModel ? { model: assistModel, ...(assistProvider ? { provider: assistProvider } : {}) } : {}), ...(assistEffort ? { reasoningEffort: assistEffort } : {}) }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      trackPoll(requestId, (entry) => {
        if (entry.status === "cancelled") {
          setMessage(t.assistantCancelled);
        } else if (entry.status === "done" && entry.result) {
          validationStoreRef.current.set(flowId, entry.result);
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
    setRunningDocs((prev) => { const next = new Map(prev); next.set(target, agentRequestId); return next; });
    setAssistantDraft("");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: { sessionId, requestId: agentRequestId, flow, mode: "optimize", target, instruction: assistantInstruction, ...(assistModel ? { model: assistModel, ...(assistProvider ? { provider: assistProvider } : {}) } : {}), ...(assistEffort ? { reasoningEffort: assistEffort } : {}) }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      trackPoll(agentRequestId, (entry) => {
        if (entry.status === "cancelled") {
          if (assistantTargetRef.current === target) setMessage(t.assistantCancelled);
        } else if (entry.status === "done" && entry.result) {
          // 需求 6：按文档 id 存入独立方案槽；当前选中文档才立即显示，否则切回时再显示。
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
        setRunningDocs((prev) => { const next = new Map(prev); next.delete(target); return next; });
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
    if (persistedFlowRef.current) { resolve(persistedFlowRef.current); return; }
    let tries = 0;
    const timer = setInterval(() => {
      if (persistedFlowRef.current || ++tries > 50) {
        clearInterval(timer);
        resolve(persistedFlowRef.current);
      }
    }, 100);
  });

  const appliedWorkflowAssistRef = React.useRef(null);
  const isWorkflowAssistApplied = (requestId) => {
    if (!appliedWorkflowAssistRef.current) {
      try {
        appliedWorkflowAssistRef.current = new Set(JSON.parse(window.sessionStorage.getItem("deepseek-flow:applied-workflow-assists") ?? "[]"));
      } catch {
        appliedWorkflowAssistRef.current = new Set();
      }
    }
    return appliedWorkflowAssistRef.current.has(requestId);
  };
  const markWorkflowAssistApplied = (requestId) => {
    appliedWorkflowAssistRef.current ??= new Set();
    appliedWorkflowAssistRef.current.add(requestId);
    try {
      window.sessionStorage.setItem("deepseek-flow:applied-workflow-assists", JSON.stringify([...appliedWorkflowAssistRef.current]));
    } catch {
      // 会话存储不可用时仅失去切屏去重，不影响结果应用。
    }
  };

  const applyWorkflowOptimization = async (entry, { requestId, flow, sourceRevision, requireUnchangedRevision }) => {
    const stop = (message) => {
      if (message) setMessage(message);
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
    const optimized = new Map((result.documents ?? []).map((document) => [document.documentId, String(document.content ?? "")]));
    const optimizedFlow = {
      ...flow,
      workflowContent: optimized.get("workflow") ?? flow.workflowContent,
      nodes: flow.nodes.map((node) => {
        const content = optimized.get(node.id);
        if (content === undefined) return node;
        const key = node.kind === "agent" || node.kind === "mapAgent" ? "prompt" : "instructions";
        return { ...node, data: { ...node.data, [key]: content } };
      })
    };
    const flowId = flow.id;
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    documentTimerRef.current = null;
    ++documentRevisionRef.current;
    await documentWriteChainRef.current.catch(() => {});
    const documentOnly = mergeDocumentEdits(persistedFlowRef.current, optimizedFlow, optimizedFlow.nodes);
    const persistedRevision = persistedRevisionRef.current.get(documentOnly.id);
    const payload = Number.isInteger(persistedRevision)
      ? { ...documentOnly, revision: persistedRevision }
      : documentOnly;
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
    stop(result.summary ? `${t.workflowOptimized}：${result.summary}` : t.workflowOptimized);
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
          ...(assistModel ? { model: assistModel, ...(assistProvider ? { provider: assistProvider } : {}) } : {}),
          ...(assistEffort ? { reasoningEffort: assistEffort } : {})
        }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      trackPoll(agentRequestId, (entry) => applyWorkflowOptimization(entry, {
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
    }).catch(() => {});
    setRunningDocs((prev) => { const next = new Map(prev); next.delete(target); return next; });
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

  useEffect(() => {
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
        // ESC 分层退出：先关最上层的弹窗/菜单，全部关完才清空画布选中，
        // 避免开着分支选择器按 ESC 时把背后的节点选中状态也悄悄清掉。
        if (assistMenuOpen) { setAssistMenuOpen(false); return; }
        if (connectionWarning) { setConnectionWarning(null); return; }
        if (pendingConnection) { setPendingConnection(null); return; }
        if (gatePickerOpen) { setGatePickerOpen(false); return; }
        if (cancelConfirm) { setCancelConfirm(null); return; }
        if (workflowOptimizeConfirm) { setWorkflowOptimizeConfirm(false); return; }
        if (deleteFlowConfirm && !deleteFlowBusy) { setDeleteFlowConfirm(false); return; }
        if (switchFlowTarget) { setSwitchFlowTarget(null); return; }
        if (topologyApplyConfirm && !topologyApplyBusy) { setTopologyApplyConfirm(false); return; }
        setSelected(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistMenuOpen, cancelConfirm, connectionWarning, deleteFlowBusy, deleteFlowConfirm, gatePickerOpen, pendingConnection, redoGraph, removeSelectedEdge, save, selected, selectedEdge, switchFlowTarget, topologyApplyBusy, topologyApplyConfirm, undoGraph, workflowOptimizeConfirm]);

  const addBar = React.createElement("div", { className: "df-addbar" },
    React.createElement("span", { className: "df-node__kind", style: { alignSelf: "center", color: "var(--df-ink-2)" } }, t.addNode),
    ["input", "agent", "mapAgent", "condition", "merge", "output"].map((kind) =>
      React.createElement("button", { key: kind, className: "df-btn", onClick: () => addNode(kind) }, t.nodeKind[kind])
    ),
    React.createElement("span", { className: "df-connect-hint" }, t.connectHint)
  );

  const toolbar = React.createElement("div", { className: "df-toolbar" },
    React.createElement("label", null, t.flow,
      React.createElement("select", { value: currentId ?? "", onChange: (e) => selectFlow(e.target.value) },
        flows.map((f) => React.createElement("option", { key: f.id, value: f.id }, `${f.name}${f.sessionId ? "" : ` (${t.shared})`}`))
      )
    ),
    React.createElement("button", { className: "df-btn is-ghost", onClick: () => fileRef.current?.click() }, t.importLabel),
    React.createElement("input", { ref: fileRef, type: "file", accept: ".json,application/json", className: "df-import-hidden", onChange: onImportFile }),
    React.createElement("button", { className: "df-btn is-ghost", onClick: exportJson, disabled: currentId === null }, t.exportLabel),
    React.createElement("button", {
      className: "df-btn is-ghost",
      "data-df-action": "delete-flow",
      title: t.deleteFlowLabel,
      "aria-label": t.deleteFlowLabel,
      style: { color: "var(--df-err)" },
      disabled: currentId === null || topologyApplyBusy,
      onClick: () => setDeleteFlowConfirm(true)
    }, t.deleteFlowLabel),
    React.createElement("button", { className: "df-btn", onClick: save, disabled: currentId === null || !dirty }, t.save),
    React.createElement("button", { className: "df-btn df-iconbtn is-ghost", title: `${t.undo} · Ctrl/Cmd+Z`, "aria-label": t.undo, onClick: undoGraph }, "↶"),
    React.createElement("button", { className: "df-btn df-iconbtn is-ghost", title: `${t.redo} · Ctrl/Cmd+Shift+Z`, "aria-label": t.redo, onClick: redoGraph }, "↷"),
    React.createElement("button", { className: "df-btn is-ghost", title: t.tidy, onClick: tidyGraph, disabled: nodes.length === 0 }, t.tidy),
    React.createElement("button", { className: "df-btn is-ghost", title: t.fitAll, onClick: () => fitWholeFlow(240), disabled: nodes.length === 0 }, t.fitAll),
    React.createElement("span", { className: "df-status" }, message)
  );

  const chooseDocument = (id) => {
    setActiveDoc(id);
    setSelected(id === "workflow" ? null : id);
    setSelectedEdge(null);
    if (id === "workflow") flowInstance?.fitView?.({ padding: 0.18, duration: 680 });
    else flowInstance?.focusNode?.(id, { duration: 720 });
  };

  const documentRail = React.createElement("aside", { className: `df-docrail${documentsOpen ? "" : " is-collapsed"}` },
    React.createElement("div", { className: "df-docrail__head" },
      React.createElement("div", { className: "df-docrail__title" }, t.documents),
      React.createElement("div", { className: "df-docrail__note" }, t.documentFirstNote)
    ),
    documentsOpen && React.createElement("div", { className: "df-docrail__list" },
      React.createElement("div", { className: "df-docgroup" }, t.workflowDoc),
      React.createElement("button", {
        className: `df-docitem${activeDoc === "workflow" ? " is-active" : ""}`,
        onClick: () => chooseDocument("workflow")
      },
        React.createElement("span", { className: "df-docitem__icon" }, "MD"),
        React.createElement("span", null,
          React.createElement("span", { className: "df-docitem__label" }, currentFlow?.workflowDoc ?? "WORKFLOW.md"),
          React.createElement("span", { className: "df-docitem__path" }, currentFlow?.docRoot ?? t.none)
        )
      ),
      React.createElement("div", { className: "df-docgroup" }, t.stepDocs),
      nodes.map((node, index) => React.createElement("button", {
        key: node.id,
        className: `df-docitem${activeDoc === node.id ? " is-active" : ""}`,
        onClick: () => chooseDocument(node.id)
      },
        React.createElement("span", { className: "df-docitem__icon" }, String(index + 1).padStart(2, "0")),
        React.createElement("span", null,
          React.createElement("span", { className: "df-docitem__label" }, String(node.data.label ?? node.id)),
          React.createElement("span", { className: "df-docitem__path" }, currentFlow?.docs?.[node.id] ?? t.filePath)
        )
      ))
    )
  );

  const inspector = React.createElement("aside", { className: `df-inspector${inspectorOpen ? "" : " is-collapsed"}` },
    React.createElement("div", { className: "df-inspector__scroll" },
    activeDoc === "workflow" && currentFlow
      ? [
          React.createElement("h3", { key: "title" }, currentFlow.workflowDoc ?? "WORKFLOW.md"),
          React.createElement("div", { key: "badge", className: "df-node__kind", style: { color: "var(--df-brand)" } }, t.documentFirst),
          React.createElement("div", { key: "root", className: "df-pathbox" },
            React.createElement("span", { className: "df-pathbox__label" }, t.docRoot),
            React.createElement("span", { className: "df-pathbox__value" }, currentFlow.docRoot ?? t.none)
          ),
          React.createElement("label", { key: "content" }, t.markdownContent,
            React.createElement("textarea", {
              className: "df-markdown-editor",
              value: String(currentFlow.workflowContent ?? ""),
              onChange: (event) => patchWorkflowContent(event.target.value),
              spellCheck: false
            })
          )
        ]
      : selectedNode
      ? [
          React.createElement("h3", { key: "title" }, String(selectedNode.data.label ?? selectedNode.id)),
          React.createElement("div", { key: "path", className: "df-pathbox" },
            React.createElement("span", { className: "df-pathbox__label" }, t.filePath),
            React.createElement("span", { className: "df-pathbox__value" }, currentFlow?.docs?.[selected] ?? t.none)
          ),
          React.createElement("label", { key: "markdown" }, t.markdownContent,
            React.createElement("textarea", {
              className: "df-markdown-editor",
              value: String(selectedNode.data.prompt ?? selectedNode.data.instructions ?? ""),
              onChange: (event) => patchSelected(selectedNode.data.kind === "agent" || selectedNode.data.kind === "mapAgent"
                ? { prompt: event.target.value }
                : { instructions: event.target.value }),
              spellCheck: false
            })
          ),
          React.createElement("h3", { key: "properties", style: { marginTop: 4 } }, t.properties),
          React.createElement("label", { key: "kind" }, "kind",
            React.createElement("span", { style: { color: "var(--df-ink-2)", fontSize: 12 } }, t.nodeKind[selectedNode.data.kind] ?? selectedNode.data.kind)
          ),
          React.createElement("label", { key: "label" }, "label",
            React.createElement("input", { value: String(selectedNode.data.label ?? ""), onChange: (e) => patchSelected({ label: e.target.value }) })
          ),
          React.createElement("label", { key: "doc" }, t.docFile,
            React.createElement("input", {
              value: docPathDraft ?? String(currentFlow?.docs?.[selected] ?? ""),
              placeholder: "01-step/STEP.md",
              onChange: (event) => setDocPathDraft(event.target.value),
              onBlur: () => {
                if (docPathDraft === null) return;
                const next = docPathDraft;
                setDocPathDraft(null);
                if (next !== String(currentFlow?.docs?.[selected] ?? "")) patchDoc(next);
              },
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.target.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setDocPathDraft(null);
                  event.target.blur();
                }
              }
            })
          ),
          selectedNode.data.kind === "condition" &&
            React.createElement("label", { key: "gateType" }, t.gateTypeLabel,
              React.createElement("select", {
                value: normalizeGateType(selectedNode.data.gateType),
                onChange: (event) => patchGateType(event.target.value)
              }, CONDITION_GATE_TYPES.map((gateType) => React.createElement("option", { key: gateType, value: gateType }, t.gateType[gateType])))
            ),
          selectedNode.data.kind === "condition" &&
            React.createElement("label", { key: "predicate" }, t.predicate,
              React.createElement("select", { value: selectedNode.data.predicate ?? "truthy", onChange: (e) => patchSelected({ predicate: e.target.value }) },
                LOGIC_PREDICATES.map((p) => React.createElement("option", { key: p, value: p }, p))
              )
            ),
          selectedNode.data.kind === "condition" &&
            React.createElement("div", { key: "logicInputs", className: "df-advanced__content" },
              React.createElement("strong", null, t.logicInputs),
              React.createElement("span", {
                style: { color: selectedGateArityValid ? "var(--df-ink-2)" : "var(--df-err)", fontSize: 12 }
              }, `${t.logicInputCount}: ${selectedConditionInputs.length} · ${selectedGateRule.maxInputs === 1 ? t.logicInputUnary : t.logicInputAggregate}`),
              selectedConditionInputs.length === 0
                ? React.createElement("span", { style: { color: "var(--df-ink-2)", fontSize: 12 } }, t.logicInputsEmpty)
                : selectedConditionInputs.map((input) => React.createElement("label", { key: input.edgeId }, `${input.label} · ${input.sourceId}`,
                    React.createElement("select", {
                      value: selectedNode.data.inputPredicates?.[input.sourceId] ?? selectedNode.data.predicate ?? "truthy",
                      onChange: (event) => patchSelected({
                        inputPredicates: {
                          ...(selectedNode.data.inputPredicates ?? {}),
                          [input.sourceId]: event.target.value
                        }
                      })
                    }, LOGIC_PREDICATES.map((predicate) => React.createElement("option", { key: predicate, value: predicate }, predicate)))
                  ))
            ),
          (selectedNode.data.kind === "agent" || selectedNode.data.kind === "mapAgent") &&
            React.createElement("details", { key: "advanced", className: "df-advanced" },
              React.createElement("summary", null, t.advancedHints),
              React.createElement("div", { className: "df-advanced__content" },
                React.createElement("label", null, t.stage,
                  React.createElement("input", { value: String(selectedNode.data.stage ?? ""), onChange: (e) => patchSelected({ stage: e.target.value }) })
                ),
                React.createElement("label", null, t.provider,
                  React.createElement("input", { value: String(selectedNode.data.provider ?? ""), onChange: (e) => patchSelected({ provider: e.target.value }) })
                ),
                React.createElement("label", null, t.model,
                  React.createElement("input", { value: String(selectedNode.data.model ?? ""), onChange: (e) => patchSelected({ model: e.target.value }) })
                ),
                React.createElement("label", null, t.outputSchema,
                  React.createElement("textarea", { value: selectedNode.data.outputSchema ? JSON.stringify(selectedNode.data.outputSchema) : "", onChange: (e) => {
                    const raw = e.target.value.trim();
                    try {
                      patchSelected({ outputSchema: raw ? JSON.parse(raw) : undefined });
                    } catch {
                      // 无效 JSON 暂不应用
                    }
                  } })
                )
              )
            ),
          React.createElement("button", { key: "del", className: "df-btn", style: { color: "var(--df-err)" }, onClick: removeSelected }, t.deleteNode)
        ]
      : [
          React.createElement("h3", { key: "title" }, t.properties),
          React.createElement("div", { key: "empty", className: "df-empty" }, t.openDocument)
        ]
    )
  );

  const findings = validationResult?.findings ?? [];
  const visibleFindings = findingFilter
    ? findings.filter((finding) => finding.level === findingFilter)
    : findings;
  const counts = validationResult?.summary?.counts ?? { error: 0, warning: 0 };
  const optimizationStale = Boolean(optimizationProposal
    && contentForDocument(optimizationProposal.target) !== String(optimizationProposal.originalContent ?? ""));
  const findingDocumentLabel = (finding) => {
    const documentId = finding.documentId ?? finding.nodeId ?? "workflow";
    return documentId === "workflow"
      ? (currentFlow?.workflowDoc ?? "WORKFLOW.md")
      : (currentFlow?.docs?.[documentId] ?? `${documentId}/STEP.md`);
  };
  const assistantPanel = React.createElement("section", {
    className: `df-assistant${assistantOpen ? " is-open" : ""}`,
    style: { height: assistantOpen ? `${assistantHeight}px` : "44px" }
  },
    React.createElement("div", { className: "df-assistant__head" },
      React.createElement("span", { className: "df-assistant__spark", "aria-hidden": true }, "✦"),
      React.createElement("span", { className: "df-assistant__title" }, t.assistant),
      React.createElement("div", { className: "df-assist-menu-wrap", ref: assistMenuRef },
        React.createElement("button", {
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
          " · ",
          assistEffort === "off" ? t.assistEffortOff : assistEffort === "high" ? t.assistEffortHigh : assistEffort === "max" ? t.assistEffortMax : t.assistEffortFollow,
          React.createElement("span", { className: "df-assist-menu-caret", "aria-hidden": true }, "▼")
        ),
        assistMenuOpen && React.createElement("div", { className: "df-assist-menu" },
          assistMenuPage === null
            ? [
                React.createElement("button", { key: "m", type: "button", className: "df-assist-menu-item", onClick: () => setAssistMenuPage("model") }, t.assistModelLabel, "：", assistModel || t.assistModelFollow),
                React.createElement("button", { key: "e", type: "button", className: "df-assist-menu-item", onClick: () => setAssistMenuPage("effort") }, t.assistEffortLabel, "：", assistEffort === "off" ? t.assistEffortOff : assistEffort === "high" ? t.assistEffortHigh : assistEffort === "max" ? t.assistEffortMax : t.assistEffortFollow)
              ]
            : assistMenuPage === "model"
              ? [
                  React.createElement("button", { key: "back", type: "button", className: "df-assist-menu-back", onClick: () => setAssistMenuPage(null) }, "‹ ", t.assistModelLabel),
                  React.createElement("button", { key: "follow", type: "button", className: "df-assist-menu-item", onClick: () => { setAssistModel(""); setAssistProvider(null); setAssistMenuOpen(false); } }, t.assistModelFollow),
                  ...(assistModelOptions ?? []).map((option) =>
                    React.createElement("button", {
                      key: `${option.provider}/${option.model}`,
                      type: "button",
                      className: "df-assist-menu-item",
                      onClick: () => { setAssistModel(option.model); setAssistProvider(option.provider ?? null); setAssistMenuOpen(false); }
                    }, option.model)
                  )
                ]
              : [
                  React.createElement("button", { key: "back", type: "button", className: "df-assist-menu-back", onClick: () => setAssistMenuPage(null) }, "‹ ", t.assistEffortLabel),
                  [["", t.assistEffortFollow], ["off", t.assistEffortOff], ["high", t.assistEffortHigh], ["max", t.assistEffortMax]].map(([value, label]) =>
                    React.createElement("button", {
                      key: value,
                      type: "button",
                      className: "df-assist-menu-item",
                      onClick: () => { setAssistEffort(value); setAssistMenuOpen(false); }
                    }, label)
                  )
                ]
        )
      ),
      React.createElement("span", { className: "df-assistant__target", title: `${t.assistantTarget}: ${assistantDocLabel}` }, assistantDocLabel),
      React.createElement("div", { className: "df-assistant__actions" },
        React.createElement("button", {
          className: `df-btn is-primary${topologyDirty && assistantBusy !== "logic" ? " is-disabled" : ""}`,
          "data-df-action": "logic-validation",
          "aria-disabled": topologyDirty && assistantBusy !== "logic" ? "true" : undefined,
          disabled: assistantBusy === "cancelling" && activeAssistRef.current?.mode === "logic",
          onClick: () => {
            if (assistantBusy === "logic") { setCancelConfirm({ mode: "logic" }); return; }
            if (topologyDirty) { setMessage(t.topologyPending); return; }
            runLogicValidation();
          }
        }, assistantBusy === "logic" ? t.cancelValidation
          : assistantBusy === "cancelling" && activeAssistRef.current?.mode === "logic" ? "…"
          : t.logicValidation),
        React.createElement("button", {
          className: "df-btn",
          "data-df-action": "optimize-document",
          disabled: !currentFlow,
          onClick: () => {
            if (runningDocs.get(assistantTarget) !== undefined) { setCancelConfirm({ mode: "document" }); return; }
            runDocumentOptimization();
          }
        }, runningDocs.get(assistantTarget) !== undefined ? t.cancelDocOptimize : t.aiOptimize),
        React.createElement("button", {
          className: `df-btn${topologyDirty && assistantBusy !== "optimize-workflow" ? " is-disabled" : ""}`,
          "data-df-action": "optimize-workflow",
          "aria-disabled": topologyDirty && assistantBusy !== "optimize-workflow" ? "true" : undefined,
          disabled: assistantBusy === "cancelling" && activeAssistRef.current?.mode === "optimize-workflow",
          onClick: () => {
            if (assistantBusy === "optimize-workflow") { setCancelConfirm({ mode: "workflow" }); return; }
            if (topologyDirty) { setMessage(t.topologyPending); return; }
            setWorkflowOptimizeConfirm(true);
          }
        }, assistantBusy === "optimize-workflow" ? t.cancelWorkflowOptimize
          : assistantBusy === "cancelling" && activeAssistRef.current?.mode === "optimize-workflow" ? "…"
          : t.aiOptimizeWorkflow),
        React.createElement("button", {
          className: "df-btn df-assistant__toggle",
          title: assistantOpen ? t.collapseAssistant : t.expandAssistant,
          "aria-label": assistantOpen ? t.collapseAssistant : t.expandAssistant,
          onClick: () => setAssistantOpen((open) => !open)
        }, assistantOpen ? "⌄" : "⌃")
      )
    ),
    assistantOpen && React.createElement("div", { className: "df-assistant__body" },
      React.createElement("div", { className: "df-assistant__control" },
        React.createElement("label", null, t.assistantInstruction,
          React.createElement("input", {
            value: assistantInstruction,
            placeholder: t.assistantInstructionHint,
            onChange: (event) => setAssistantInstruction(event.target.value)
          })
        ),
        React.createElement("div", { className: "df-assistant__summary" },
          validationResult
            ? [
                React.createElement("span", { key: "total" }, `${validationResult.summary?.total ?? findings.length} ${t.issues}`),
                React.createElement("button", {
                  key: "error",
                  type: "button",
                  className: `df-count is-error${findingFilter === "error" ? " is-active" : ""}`,
                  "data-df-filter": "error",
                  "aria-pressed": findingFilter === "error",
                  onClick: () => setFindingFilter((value) => value === "error" ? null : "error")
                }, `Error ${counts.error ?? 0}`),
                React.createElement("button", {
                  key: "warning",
                  type: "button",
                  className: `df-count is-warning${findingFilter === "warning" ? " is-active" : ""}`,
                  "data-df-filter": "warning",
                  "aria-pressed": findingFilter === "warning",
                  onClick: () => setFindingFilter((value) => value === "warning" ? null : "warning")
                }, `Warn ${counts.warning ?? 0}`)
              ]
            : React.createElement("span", null, t.validationIdle)
        ),
        React.createElement("div", { className: "df-findings" },
          validationResult && findings.length === 0
            ? React.createElement("div", { className: "df-empty" }, t.noFindings)
            : visibleFindings.map((finding, index) => React.createElement("button", {
                key: `${finding.code}-${finding.nodeId ?? finding.edgeId ?? index}`,
                className: `df-finding is-${finding.level}`,
                "data-df-finding-level": finding.level,
                onClick: () => focusFinding(finding)
              },
                React.createElement("span", { className: "df-finding__dot" }),
                React.createElement("span", null,
                  React.createElement("span", { className: "df-finding__doc" }, findingDocumentLabel(finding)),
                  React.createElement("span", { className: "df-finding__message" }, finding.message),
                  finding.suggestion && React.createElement("span", { className: "df-finding__suggestion" }, finding.suggestion)
                )
              ))
        )
      ),
      React.createElement("div", { className: "df-assistant__preview" },
        React.createElement("div", { className: "df-assistant__preview-head" },
          React.createElement("span", { className: "df-assistant__preview-title" }, optimizationProposal
            ? `${t.proposalDecision} · ${optimizationProposal.documentLabel} · ${optimizationStale ? t.staleSuggestion : t.suggestionPreview}`
            : `${t.proposalDecision} · ${t.proposalPending}`),
          optimizationProposal && React.createElement("span", null,
            React.createElement("button", { className: "df-btn is-ghost", "data-df-action": "discard-optimization", onClick: discardOptimization }, t.discardSuggestion),
            React.createElement("button", { className: "df-btn is-primary", "data-df-action": "accept-optimization", onClick: acceptOptimization, disabled: !assistantDraft || optimizationStale }, t.acceptSuggestion)
          )
        ),
        optimizationProposal
          ? React.createElement("textarea", { value: assistantDraft, onChange: (event) => setAssistantDraft(event.target.value), spellCheck: false })
          : React.createElement("div", { className: "df-assistant__pending" },
              React.createElement("span", null, `${t.proposalPending} · ${t.proposalIdle}`)
            )
      )
    )
  );

  const workflowConfirmDialog = workflowOptimizeConfirm && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setWorkflowOptimizeConfirm(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-workflow-optimize-title" },
      React.createElement("h3", { id: "df-workflow-optimize-title" }, t.workflowOptimizeTitle),
      React.createElement("p", null, t.workflowOptimizeWarning),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", autoFocus: true, onClick: () => setWorkflowOptimizeConfirm(false) }, t.workflowOptimizeCancel),
        React.createElement("button", { className: "df-btn is-primary", "data-df-action": "confirm-optimize-workflow", onClick: runWorkflowOptimization }, t.workflowOptimizeConfirm)
      )
    )
  );

  const cancelConfirmDialog = cancelConfirm && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setCancelConfirm(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-cancel-confirm-title" },
      React.createElement("h3", { id: "df-cancel-confirm-title" },
        cancelConfirm.mode === "logic" ? t.cancelConfirmLogic
          : cancelConfirm.mode === "workflow" ? t.cancelConfirmWorkflow
          : t.cancelConfirmDoc),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", "data-df-action": "wait-cancel", autoFocus: true, onClick: () => setCancelConfirm(null) }, t.waitMore),
        React.createElement("button", {
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

  const topologyConfirmDialog = topologyApplyConfirm && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget && !topologyApplyBusy) setTopologyApplyConfirm(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-topology-apply-title" },
      React.createElement("h3", { id: "df-topology-apply-title" }, t.topologyApplyTitle),
      React.createElement("p", null, t.topologyApplyWarning),
      topologyDelta && React.createElement("div", { className: "df-topology-summary" },
        React.createElement("span", null, `${t.topologyNodes}: +${topologyDelta.nodes.added.length} / −${topologyDelta.nodes.removed.length} / ~${topologyDelta.nodes.changed.length}`),
        React.createElement("span", null, `${t.topologyEdges}: +${topologyDelta.edges.added.length} / −${topologyDelta.edges.removed.length} / ~${topologyDelta.edges.changed.length}`)
      ),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", disabled: topologyApplyBusy, onClick: () => setTopologyApplyConfirm(false) }, t.cancel),
        React.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-apply-topology",
          disabled: topologyApplyBusy,
          autoFocus: true,
          onClick: applyTopologyChanges
        }, topologyApplyBusy ? t.topologyApplying : t.topologyApplyConfirm)
      )
    )
  );

  const gatePickerDialog = gatePickerOpen && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setGatePickerOpen(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "df-gate-picker-title" },
      React.createElement("h3", { id: "df-gate-picker-title" }, t.chooseGateTitle),
      React.createElement("p", null, t.chooseGateIntro),
      React.createElement("div", { className: "df-gate-grid" },
        CONDITION_GATE_TYPES.map((gateType) => React.createElement("button", {
          key: gateType,
          type: "button",
          className: "df-gate-choice",
          "data-df-gate-type": gateType,
          onClick: () => {
            setGatePickerOpen(false);
            createNode("condition", gateType);
          }
        },
          React.createElement("strong", null, t.gateType[gateType]),
          React.createElement("span", null, t.gateDescription[gateType])
        ))
      ),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", onClick: () => setGatePickerOpen(false) }, t.cancel)
      )
    )
  );

  const branchPickerDialog = pendingConnection && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setPendingConnection(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "df-branch-picker-title" },
      React.createElement("h3", { id: "df-branch-picker-title" }, t.chooseBranchTitle),
      React.createElement("p", null, t.chooseBranchIntro),
      React.createElement("div", { className: "df-branch-options" },
        ["true", "false"].map((branch) => React.createElement("button", {
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
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", onClick: () => setPendingConnection(null) }, t.cancel)
      )
    )
  );

  const connectionWarningDialog = connectionWarning && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setConnectionWarning(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-connection-warning-title" },
      React.createElement("h3", { id: "df-connection-warning-title" }, t.connectionWarningTitle),
      React.createElement("p", null, connectionWarning),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn is-primary", autoFocus: true, onClick: () => setConnectionWarning(null) }, t.dismiss)
      )
    )
  );

  const deleteFlowConfirmDialog = deleteFlowConfirm && currentFlow && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget && !deleteFlowBusy) setDeleteFlowConfirm(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-delete-flow-title" },
      React.createElement("h3", { id: "df-delete-flow-title" }, t.deleteFlowTitle + String(currentFlow.name ?? currentFlow.id)),
      React.createElement("p", null, currentFlow.sessionId ? t.deleteFlowWarningOwned : t.deleteFlowWarningShared),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", autoFocus: true, disabled: deleteFlowBusy, onClick: () => setDeleteFlowConfirm(false) }, t.cancel),
        React.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-delete-flow",
          style: { background: "var(--df-err)", borderColor: "var(--df-err)" },
          disabled: deleteFlowBusy,
          onClick: deleteCurrentFlow
        }, deleteFlowBusy ? t.deleteFlowBusyLabel : t.deleteFlowConfirm)
      )
    )
  );

  const switchFlowConfirmDialog = switchFlowTarget && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setSwitchFlowTarget(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-switch-flow-title" },
      React.createElement("h3", { id: "df-switch-flow-title" }, t.switchFlowTitle),
      React.createElement("p", null, t.switchFlowWarning),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", autoFocus: true, onClick: () => setSwitchFlowTarget(null) }, t.cancel),
        React.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-switch-flow",
          onClick: discardAndSwitchFlow
        }, t.switchFlowConfirm)
      )
    )
  );

  const topologyApplyButton = topologyDirty && React.createElement("div", { className: "df-topology-apply" },
    React.createElement("button", {
      type: "button",
      className: "df-btn is-primary",
      "data-df-action": "apply-topology",
      disabled: topologyApplyBusy,
      onClick: () => setTopologyApplyConfirm(true)
    },
      React.createElement("span", { className: "df-topology-apply__icon", "aria-hidden": true }, topologyApplyBusy ? "◌" : "✓"),
      React.createElement("span", null, topologyApplyBusy ? t.topologyApplying : t.topologyApply),
      topologyDelta?.count > 0 && React.createElement("span", { className: "df-topology-apply__count" }, topologyDelta.count)
    )
  );

  const hiddenAgentFinalizeButton = React.createElement("button", {
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
  const leftSplitter = React.createElement("div", {
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
  const rightSplitter = React.createElement("div", {
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
  const assistantSplitter = React.createElement("div", {
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

  return React.createElement("div", { className: "df-studio", ref: studioRef, style: studioStyle },
    documentRail,
    leftSplitter,
    React.createElement("div", { className: "df-canvas-shell", ref: canvasShellRef },
      hiddenAgentFinalizeButton,
      workflowConfirmDialog,
      switchFlowConfirmDialog,
      deleteFlowConfirmDialog,
      cancelConfirmDialog,
      topologyConfirmDialog,
      gatePickerDialog,
      branchPickerDialog,
      connectionWarningDialog,
      toolbar,
      React.createElement("div", { className: "df-canvas-stage" },
        React.createElement(GraphCanvas, {
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
        flows.length === 0 && React.createElement("div", { className: "df-empty-flow", "aria-live": "polite" },
          React.createElement("div", { className: "df-empty-flow__card" },
            React.createElement("strong", null, t.noFlow),
            React.createElement("span", null, t.emptyFlowHint)
          )
        ),
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

// ============ 视图 ============
function DeepSeekFlowView({ connection, sessionId, language: initialLanguage, locale }) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    if (!locale || typeof locale.subscribe !== "function") return undefined;
    const update = () => setLanguage(localeLanguage(locale));
    update();
    return locale.subscribe(update);
  }, [locale]);
  const t = useMemo(() => text(language), [language]);
  const rootRef = React.useRef(null);
  useLayoutEffect(() => {
    const scrollBody = rootRef.current?.closest?.("[data-conversation-scroll]");
    if (!scrollBody) return undefined;
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
  return React.createElement("div", { className: "deepseek-flow-root", ref: rootRef, "data-df-immersive-view": "true" },
    React.createElement("nav", { className: "df-tabs" },
      React.createElement("span", { className: "df-titlebar__title" }, t.studio),
      React.createElement("span", { className: "df-titlebar__badge" }, t.editorOnly),
      React.createElement("span", { className: "df-titlebar__note" }, t.editorOnlyNote),
      React.createElement("span", { className: "df-titlebar__rev", title: `DeepSeekFlow client revision ${CLIENT_REV}` }, `rev ${CLIENT_REV}`)
    ),
    React.createElement("main", { className: "df-main" },
      React.createElement(Studio, { connection, sessionId, language })
    )
  );
}

// ============ 插件入口 ============
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

{ apply, inject };

module.exports = { apply, inject };
return module.exports; } });
