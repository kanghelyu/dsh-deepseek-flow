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

export function topologyProjection(flow) {
  return {
    id: String(flow?.id ?? ""),
    nodes: (flow?.nodes ?? []).map(topologyNode),
    edges: (flow?.edges ?? []).map(topologyEdge),
    inputs: (flow?.inputs ?? []).map(String),
    outputs: (flow?.outputs ?? []).map(String)
  };
}

export function topologySignature(flow) {
  return JSON.stringify(topologyProjection(flow));
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

export function topologyDiff(beforeFlow, afterFlow) {
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

export function mergeDocumentEdits(persistedFlow, editorFlow, canvasNodes = []) {
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

export function applyReviewedTopology(currentFlow, draftFlow, reviewed) {
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

export const topologyModelInternals = { TOPOLOGY_DATA_KEYS, topologyEdge, topologyNode };
