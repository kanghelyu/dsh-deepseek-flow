import { conditionGateType, gateBranchForEdge, normalizeGateType } from "./condition-gates.js";

export const LOGIC_CONTRACT_VERSION = 1;
export const LOGIC_PREDICATES = Object.freeze(["truthy", "falsy", "nonEmpty"]);

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

export class LogicEvaluationError extends Error {
  constructor(issues) {
    super(["Logic evaluation failed:", ...issues.map((issue, index) => `  ${index + 1}. ${issue}`)].join("\n"));
    this.name = "LogicEvaluationError";
    this.issues = issues;
  }
}

export function normalizePredicate(value, fallback = "truthy") {
  return LOGIC_PREDICATES.includes(value) ? value : fallback;
}

export function evaluatePredicate(value, predicate = "truthy") {
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

export function gateRule(gateType) {
  return GATE_RULES[normalizeGateType(gateType)];
}

export function evaluateGate(gateType, inputs) {
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

export function logicSemanticsIssues(flow) {
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

export function logicExecutionContract(flow) {
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

export function evaluateFlowLogic(flow, values = {}) {
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
