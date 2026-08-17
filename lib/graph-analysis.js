export const MAX_FEEDBACK_ITERATIONS = 1_000;

export function isFeedbackEdge(edge) {
  return Boolean(edge && Object.hasOwn(edge, "feedback"));
}

export function feedbackEdges(edges = []) {
  return edges.filter(isFeedbackEdge);
}

export function normalEdges(edges = []) {
  return edges.filter((edge) => !isFeedbackEdge(edge));
}

function compareById(left, right) {
  return String(left).localeCompare(String(right));
}

export function stableTopologicalOrder(nodes = [], edges = [], compare = compareById) {
  const ids = new Set(nodes.map((node) => node?.id).filter(Boolean));
  const executableEdges = normalEdges(edges).filter((edge) => ids.has(edge?.source) && ids.has(edge?.target));
  const incoming = new Map([...ids].map((id) => [id, 0]));
  const outgoing = new Map([...ids].map((id) => [id, []]));
  for (const edge of executableEdges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }
  const queue = [...ids].filter((id) => incoming.get(id) === 0);
  const order = [];
  const depth = new Map(queue.map((id) => [id, 0]));
  while (queue.length > 0) {
    queue.sort(compare);
    const id = queue.shift();
    order.push(id);
    for (const target of outgoing.get(id) ?? []) {
      depth.set(target, Math.max(depth.get(target) ?? 0, (depth.get(id) ?? 0) + 1));
      const nextIncoming = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, nextIncoming);
      if (nextIncoming === 0) queue.push(target);
    }
  }
  const remaining = [...ids].filter((id) => !order.includes(id));
  const maxDepth = Math.max(0, ...depth.values());
  return {
    order,
    remaining,
    complete: order.length === ids.size,
    depth,
    levels: Array.from({ length: maxDepth + 1 }, (_, level) => order.filter((id) => depth.get(id) === level)),
    incoming,
    outgoing,
    edges: executableEdges
  };
}

export function hasExecutablePath(nodes = [], edges = [], start, target) {
  if (start === target) return true;
  const ids = new Set(nodes.map((node) => node?.id).filter(Boolean));
  if (!ids.has(start) || !ids.has(target)) return false;
  const outgoing = new Map([...ids].map((id) => [id, []]));
  for (const edge of normalEdges(edges)) {
    if (outgoing.has(edge?.source) && outgoing.has(edge?.target)) outgoing.get(edge.source).push(edge.target);
  }
  const pending = [start];
  const visited = new Set();
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === target) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of outgoing.get(id) ?? []) pending.push(next);
  }
  return false;
}

export function feedbackConfigurationIssues(nodes = [], edges = []) {
  const issues = [];
  const nodeIds = new Set(nodes.map((node) => node?.id).filter(Boolean));
  for (const edge of feedbackEdges(edges)) {
    const feedback = edge?.feedback;
    if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) {
      issues.push(`feedback edge ${edge?.id || "<missing>"} requires feedback.maxIterations and feedback.exitCondition`);
      continue;
    }
    if (!Number.isInteger(feedback.maxIterations) || feedback.maxIterations < 1 || feedback.maxIterations > MAX_FEEDBACK_ITERATIONS) {
      issues.push(`feedback edge ${edge?.id || "<missing>"} maxIterations must be an integer from 1 to ${MAX_FEEDBACK_ITERATIONS}`);
    }
    if (typeof feedback.exitCondition !== "string" || !feedback.exitCondition.trim()) {
      issues.push(`feedback edge ${edge?.id || "<missing>"} exitCondition must be a non-empty string`);
    }
    if (["sourceHandle", "branch", "logic"].some((key) => edge?.[key] !== undefined && edge?.[key] !== null && edge?.[key] !== "")) {
      issues.push(`feedback edge ${edge?.id || "<missing>"} cannot carry a condition branch`);
    }
    if (nodeIds.has(edge?.source) && nodeIds.has(edge?.target)
      && !hasExecutablePath(nodes, edges, edge.target, edge.source)) {
      issues.push(`feedback edge ${edge?.id || "<missing>"} must close an executable path from ${edge.target} to ${edge.source}`);
    }
  }
  return issues;
}
