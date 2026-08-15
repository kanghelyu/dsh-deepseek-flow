import {
  availableGateBranches,
  conditionGateType,
  gateBranchForEdge,
  normalizeGateType,
  validateGateBranch
} from "../../lib/condition-gates.js";

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
        ? { gateType: conditionGateType(node, (flow?.edges ?? []).filter((edge) => edge.source === node.id)) }
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
      ...(edge.targetHandle === null || edge.targetHandle === undefined ? {} : { targetHandle: edge.targetHandle })
    })),
    inputs: serializedNodes.filter((node) => node.kind === "input").map((node) => node.id),
    outputs: serializedNodes.filter((node) => node.kind === "output").map((node) => node.id)
  };
}

export function connectionProblem(nodes, edges, connection, branch = null) {
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

export function connectionProblemMessage(problem, copy) {
  if (!problem || problem.valid) return "";
  if (problem.code === "duplicateConnection") return copy.duplicateConnection;
  if (problem.code === "ifElseFull") return copy.ifElseFull;
  if (problem.code === "gateLimit" || problem.code === "notFull") return copy.notFull;
  if (problem.code === "branchUsed") return copy.branchUsed;
  if (problem.code === "logicMismatch") return copy.gateMismatch;
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
    sourceHandle: connection.sourceHandle ?? null,
    targetHandle: connection.targetHandle ?? null
  } : edge);
}

export function layoutNodes(nodes, edges) {
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
      targetHandle: edge.targetHandle ?? ""
    }))
  });
}
