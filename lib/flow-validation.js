import { conditionGateType, gateBranchForEdge, validateGateBranch } from "./condition-gates.js";
import { feedbackConfigurationIssues, isFeedbackEdge, stableTopologicalOrder } from "./graph-analysis.js";
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
    if (edge.source === edge.target && !isFeedbackEdge(edge)) issues.push(`self edge ${edge.id}`);
    const source = flow.nodes.find((node) => node?.id === edge.source);
    if (!isFeedbackEdge(edge) && edge.sourceHandle !== undefined && edge.sourceHandle !== null && source?.kind !== "condition") issues.push(`branch handle on non-condition edge ${edge.id}`);
    if (!isFeedbackEdge(edge) && source?.kind === "condition" && !gateBranchForEdge(edge)) issues.push(`condition edge ${edge.id} requires a logic branch`);
  }
  for (const node of flow.nodes.filter((candidate) => candidate?.kind === "condition")) {
    const outgoing = flow.edges.filter((edge) => edge.source === node.id && !isFeedbackEdge(edge));
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
  issues.push(...feedbackConfigurationIssues(flow.nodes, flow.edges));
  if (issues.length > 0) throw new FlowValidationError(issues);

  const analysis = stableTopologicalOrder(flow.nodes, flow.edges);
  if (!analysis.complete) {
    throw new FlowValidationError([
      `cycle detected in ordinary execution edges: ${analysis.remaining.join(", ")}`,
      "mark only bounded retry arrows as feedback with maxIterations and exitCondition; ordinary execution edges must remain acyclic"
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
    for (const target of analysis.outgoing.get(id) ?? []) pending.push(target);
  }
  const unreachable = flow.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id);
  if (unreachable.length > 0) throw new FlowValidationError([`unreachable nodes: ${unreachable.join(", ")}`]);
  return { flow, order: analysis.order, levels: analysis.levels };
}
