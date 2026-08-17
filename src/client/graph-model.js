import {
  availableGateBranches,
  conditionGateType,
  gateBranchForEdge,
  normalizeGateType,
  validateGateBranch
} from "../../lib/condition-gates.js";
import { isFeedbackEdge, stableTopologicalOrder } from "../../lib/graph-analysis.js";

export function branchDisplayLabel(branch, copy) {
  return copy?.branchLabel?.[branch] ?? String(branch ?? "");
}

export function flowToCanvasNodes(flow, positionOverrides) {
  return (flow?.nodes ?? []).map((node) => ({
    id: node.id,
    type: "flow",
    position: positionOverrides?.[node.id] ?? node.position ?? { x: 120, y: 80 },
    data: {
      ...node.data,
      kind: node.kind,
      ...(node.kind === "condition"
        ? { gateType: conditionGateType(node, (flow?.edges ?? []).filter((edge) => edge.source === node.id && !isFeedbackEdge(edge))) }
        : {}),
      docPath: flow?.docs?.[node.id] ?? ""
    }
  }));
}

export function flowToCanvasEdges(edges, copy) {
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

export function serializeFlow(currentFlow, nodes, edges) {
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
      ...(edge.targetHandle === null || edge.targetHandle === undefined ? {} : { targetHandle: edge.targetHandle }),
      ...(edge.feedback === undefined ? {} : { feedback: {
        maxIterations: edge.feedback?.maxIterations,
        exitCondition: edge.feedback?.exitCondition
      } })
    })),
    inputs: serializedNodes.filter((node) => node.kind === "input").map((node) => node.id),
    outputs: serializedNodes.filter((node) => node.kind === "output").map((node) => node.id)
  };
}

export function connectionProblem(nodes, edges, connection, branch = null) {
  if (!connection?.source || !connection?.target) return { valid: false, code: "invalidConnection" };
  const feedback = connection.feedback !== undefined;
  if (connection.source === connection.target && !feedback) return { valid: false, code: "selfFeedbackRequired" };
  if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target && edge.id !== connection.edgeId)) {
    return { valid: false, code: "duplicateConnection" };
  }
  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) return { valid: false, code: "invalidConnection" };
  if (feedback || sourceNode.data?.kind !== "condition") return { valid: true, code: "ok" };
  const outgoing = edges.filter((edge) => edge.source === connection.source && !isFeedbackEdge(edge));
  const gateType = conditionGateType(sourceNode, outgoing);
  const available = availableGateBranches(gateType, outgoing, connection.edgeId ?? null);
  if (branch === null || branch === undefined) {
    if (available.length > 0) return { valid: true, code: "ok", gateType, available };
    return { valid: false, code: gateType === "ifElse" ? "ifElseFull" : "notFull", gateType, available };
  }
  const result = validateGateBranch(gateType, outgoing, branch, connection.edgeId ?? null);
  return result.valid ? { ...result, available } : result;
}

export function connectionProblemMessage(problem, copy) {
  if (!problem || problem.valid) return "";
  if (problem.code === "duplicateConnection") return copy.duplicateConnection;
  if (problem.code === "ifElseFull") return copy.ifElseFull;
  if (problem.code === "gateLimit" || problem.code === "notFull") return copy.notFull;
  if (problem.code === "branchUsed") return copy.branchUsed;
  if (problem.code === "logicMismatch") return copy.gateMismatch;
  if (problem.code === "selfFeedbackRequired") return copy.selfFeedbackRequired;
  return copy.invalidConnection;
}

export function graphSnapshot(nodes, edges) {
  return JSON.parse(JSON.stringify({ nodes, edges }));
}

export function reconnectFlowEdge(oldEdge, connection, edges) {
  return edges.map((edge) => edge.id === oldEdge.id ? {
    ...edge,
    source: connection.source,
    target: connection.target,
    ...(isFeedbackEdge(edge)
      ? { sourceHandle: null, targetHandle: null }
      : { sourceHandle: connection.sourceHandle ?? null, targetHandle: connection.targetHandle ?? null })
  } : edge);
}

export function layoutNodes(nodes, edges) {
  const analysis = stableTopologicalOrder(nodes, edges);
  const level = analysis.depth;
  const fallbackLevel = Math.max(0, ...level.values()) + 1;
  nodes.forEach((node, index) => {
    if (!level.has(node.id)) level.set(node.id, fallbackLevel + index);
  });
  const rows = new Map();
  return nodes.map((node) => {
    const column = level.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { ...node, position: { x: 70 + column * 245, y: 90 + row * 160 } };
  });
}

export function logicSnapshot(flow) {
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
      targetHandle: edge.targetHandle ?? "",
      feedback: edge.feedback ?? null
    }))
  });
}
