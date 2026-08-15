import { conditionGateType, gateBranchForEdge, validateGateBranch } from "./condition-gates.js";
import { logicSemanticsIssues } from "./logic-semantics.js";

const NODE_KINDS = new Set(["input", "agent", "mapAgent", "condition", "merge", "output"]);

export class FlowValidationError extends Error {
  constructor(issues) {
    super(["Invalid flow:", ...issues.map((issue, index) => `  ${index + 1}. ${issue}`)].join("\n"));
    this.issues = issues;
    this.name = "FlowValidationError";
  }
}

export function validateFlow(flow) {
  if (!flow || typeof flow !== "object") throw new FlowValidationError(["flow must be an object"]);
  if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    throw new FlowValidationError(["nodes and edges must be arrays"]);
  }
  const issues = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  const connectionPairs = new Set();
  for (const node of flow.nodes) {
    if (!node || typeof node !== "object") {
      issues.push("every node must be an object");
      continue;
    }
    if (typeof node.id !== "string" || !node.id.trim()) issues.push("every node requires a non-empty string id");
    if (!NODE_KINDS.has(node.kind)) issues.push(`node ${node.id || "<missing>"} has unsupported kind ${String(node.kind)}`);
    if (nodeIds.has(node.id)) issues.push(`duplicate node id ${node.id}`);
    nodeIds.add(node.id);
  }
  for (const edge of flow.edges) {
    if (!edge || typeof edge !== "object") {
      issues.push("every edge must be an object");
      continue;
    }
    if (typeof edge.id !== "string" || !edge.id.trim()) issues.push("every edge requires a non-empty string id");
    if (typeof edge.source !== "string" || !edge.source.trim()) issues.push(`edge ${edge.id || "<missing>"} requires a source`);
    if (typeof edge.target !== "string" || !edge.target.trim()) issues.push(`edge ${edge.id || "<missing>"} requires a target`);
    if (edgeIds.has(edge.id)) issues.push(`duplicate edge id ${edge.id}`);
    edgeIds.add(edge.id);
    const pair = `${edge.source}\0${edge.target}`;
    if (connectionPairs.has(pair)) issues.push(`duplicate connection ${edge.source} -> ${edge.target}`);
    connectionPairs.add(pair);
    if (!nodeIds.has(edge.source)) issues.push(`dangling edge ${edge.id} source ${edge.source}`);
    if (!nodeIds.has(edge.target)) issues.push(`dangling edge ${edge.id} target ${edge.target}`);
    if (edge.source === edge.target) issues.push(`self edge ${edge.id}`);
    const source = flow.nodes.find((node) => node?.id === edge.source);
    if (edge.sourceHandle !== undefined && edge.sourceHandle !== null && source?.kind !== "condition") issues.push(`branch handle on non-condition edge ${edge.id}`);
    if (source?.kind === "condition" && !gateBranchForEdge(edge)) issues.push(`condition edge ${edge.id} requires a logic branch`);
  }
  for (const node of flow.nodes.filter((candidate) => candidate?.kind === "condition")) {
    const outgoing = flow.edges.filter((edge) => edge.source === node.id);
    const gateType = conditionGateType(node, outgoing);
    const accepted = [];
    for (const edge of outgoing) {
      const branch = gateBranchForEdge(edge);
      if (!branch) continue;
      const result = validateGateBranch(gateType, accepted, branch);
      if (!result.valid) {
        if (result.code === "branchUsed") issues.push(`condition ${node.id} reuses ${branch} branch`);
        else if (result.code === "gateLimit") issues.push(`condition ${node.id} exceeds ${gateType} gate outgoing limit`);
        else issues.push(`condition edge ${edge.id} branch ${branch} does not match ${gateType} gate`);
      } else {
        accepted.push(edge);
      }
    }
  }
  if (flow.nodes.filter((node) => node?.kind === "input").length === 0) issues.push("at least one Input node is required");
  if (flow.nodes.filter((node) => node?.kind === "output").length === 0) issues.push("at least one Output node is required");
  if (!Array.isArray(flow.inputs)) issues.push("inputs must be an array");
  if (!Array.isArray(flow.outputs)) issues.push("outputs must be an array");
  for (const id of [...(flow.inputs ?? []), ...(flow.outputs ?? [])]) {
    if (!nodeIds.has(id)) issues.push(`declared input/output ${id} is missing`);
  }
  if (issues.length > 0) throw new FlowValidationError(issues);
  const incoming = new Map(flow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(flow.nodes.map((node) => [node.id, []]));
  for (const edge of flow.edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge);
  }
  const queue = flow.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id).sort();
  const order = [];
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const next = (incoming.get(edge.target) ?? 0) - 1;
      incoming.set(edge.target, next);
      if (next === 0) {
        queue.push(edge.target);
        queue.sort();
      }
    }
  }
  if (order.length !== flow.nodes.length) {
    throw new FlowValidationError([
      "cycle detected; DeepSeekFlow requires an acyclic graph so document order and Session execution stay deterministic",
      "model retries as a bounded retry step or a terminal failure branch, and describe the retry policy in Markdown"
    ]);
  }
  const semanticIssues = logicSemanticsIssues(flow);
  if (semanticIssues.length > 0) throw new FlowValidationError(semanticIssues);
  const reachable = new Set();
  const pending = flow.nodes.filter((node) => node.kind === "input").map((node) => node.id);
  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of outgoing.get(id) ?? []) pending.push(edge.target);
  }
  const unreachable = flow.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id);
  if (unreachable.length > 0) throw new FlowValidationError([`unreachable nodes: ${unreachable.join(", ")}`]);
  const depth = new Map();
  for (const id of order) {
    const parents = flow.edges.filter((edge) => edge.target === id).map((edge) => depth.get(edge.source) ?? 0);
    depth.set(id, parents.length === 0 ? 0 : Math.max(...parents) + 1);
  }
  const maxDepth = Math.max(0, ...depth.values());
  return {
    flow,
    order,
    levels: Array.from({ length: maxDepth + 1 }, (_, level) => order.filter((id) => depth.get(id) === level))
  };
}
