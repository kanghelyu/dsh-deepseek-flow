import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { conditionGateType, gateBranchForEdge, normalizeGateType } from "./condition-gates.js";
import { gateRule, logicExecutionContract } from "./logic-semantics.js";

const EXECUTABLE_KINDS = new Set(["agent", "mapAgent"]);
const STRUCTURE_START = "<!-- deepseek-flow:structure:start -->";
const STRUCTURE_END = "<!-- deepseek-flow:structure:end -->";

function safeSegment(value, fallback = "step") {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function portablePath(value) {
  return String(value).split(sep).join("/");
}

function resolveInside(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "" || isAbsolute(relativePath)) {
    throw new Error("Document paths must be non-empty paths relative to docRoot");
  }
  const base = resolve(root);
  const target = resolve(base, relativePath);
  const offset = relative(base, target);
  if (offset === "" || offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error(`Document path escapes docRoot: ${relativePath}`);
  }
  return target;
}

export function orderedNodeIds(flow) {
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow?.edges) ? flow.edges : [];
  const priority = new Map(nodes.map((node, index) => {
    const explicitOrder = Number(node.data?.order);
    const x = Number(node.position?.x);
    const y = Number(node.position?.y);
    return [node.id, {
      explicitOrder: Number.isFinite(explicitOrder) ? explicitOrder : Number.POSITIVE_INFINITY,
      x: Number.isFinite(x) ? x : Number.POSITIVE_INFINITY,
      y: Number.isFinite(y) ? y : Number.POSITIVE_INFINITY,
      index
    }];
  }));
  const comparePriority = (leftId, rightId) => {
    const left = priority.get(leftId);
    const right = priority.get(rightId);
    return left.explicitOrder - right.explicitOrder
      || left.x - right.x
      || left.y - right.y
      || left.index - right.index;
  };
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source).push(edge.target);
  }
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const order = [];
  while (queue.length > 0) {
    queue.sort(comparePriority);
    const id = queue.shift();
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      incoming.set(next, (incoming.get(next) ?? 0) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  return order.length === nodes.length ? order : nodes.map((node) => node.id);
}

function isGeneratedStepPath(path, node, index) {
  const portable = String(path ?? "").replaceAll("\\", "/");
  const parts = portable.split("/");
  if (parts.length !== 2 || parts[1] !== "STEP.md") return false;
  const prefix = String(index + 1).padStart(2, "0");
  const base = `${prefix}-${safeSegment(node?.data?.label ?? node?.id, safeSegment(node?.id))}`;
  return parts[0] === base
    || (parts[0].startsWith(`${base}-`) && /^\d+$/.test(parts[0].slice(base.length + 1)));
}

function defaultStepContent(node, index) {
  const label = String(node.data?.label ?? node.id);
  const body = EXECUTABLE_KINDS.has(node.kind)
    ? String(node.data?.prompt ?? "{{input}}")
    : String(node.data?.instructions ?? `处理「${label}」阶段，并把结果交给下一步。`);
  return `# ${label}\n\n${body.trim()}`;
}

function nodeContent(node, index) {
  const content = EXECUTABLE_KINDS.has(node.kind) ? node.data?.prompt : node.data?.instructions;
  return typeof content === "string" && content.trim() ? content : defaultStepContent(node, index);
}

function withNodeContent(node, content) {
  return {
    ...node,
    data: {
      ...node.data,
      ...(EXECUTABLE_KINDS.has(node.kind) ? { prompt: content } : { instructions: content })
    }
  };
}

export function normalizeDocumentFlow(flow, options = {}) {
  if (!flow || typeof flow !== "object") return flow;
  const scope = safeSegment(options.scope ?? flow.sessionId ?? "shared", "shared");
  const flowId = safeSegment(flow.id, "workflow");
  const storageRoot = resolve(options.storageRoot ?? process.cwd());
  const docRoot = resolve(flow.docRoot ?? join(storageRoot, "workspaces", scope, flowId));
  const workflowDoc = flow.workflowDoc ?? "WORKFLOW.md";
  resolveInside(docRoot, workflowDoc);

  const order = orderedNodeIds(flow);
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  const previousOrder = options.previousFlow ? orderedNodeIds(options.previousFlow) : [];
  const previousNodeById = new Map((options.previousFlow?.nodes ?? []).map((node) => [node.id, node]));
  const previousIndexById = new Map(previousOrder.map((nodeId, index) => [nodeId, index]));
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  const sourceDocs = {
    ...(options.previousFlow?.docs ?? {}),
    ...(flow.docs ?? {})
  };
  const docs = {};
  const used = new Set();
  order.forEach((nodeId, index) => {
    const existing = nodeIds.has(nodeId) ? sourceDocs[nodeId] : null;
    const generated = existing && (
      isGeneratedStepPath(existing, nodeById.get(nodeId), index)
      || (previousIndexById.has(nodeId)
        && isGeneratedStepPath(existing, previousNodeById.get(nodeId), previousIndexById.get(nodeId)))
    );
    if (existing && !generated) {
      resolveInside(docRoot, existing);
      if (!used.has(existing)) {
        docs[nodeId] = existing;
        used.add(existing);
        return;
      }
    }
    const node = nodeById.get(nodeId);
    const prefix = String(index + 1).padStart(2, "0");
    const base = `${prefix}-${safeSegment(node?.data?.label ?? nodeId, safeSegment(nodeId))}`;
    let candidate = `${base}/STEP.md`;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}-${suffix++}/STEP.md`;
    docs[nodeId] = candidate;
    used.add(candidate);
  });

  return {
    ...flow,
    docRoot,
    workflowDoc,
    docs,
    nodes: flow.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        ...(node.kind === "condition"
          ? { gateType: conditionGateType(node, flow.edges.filter((edge) => edge.source === node.id)) }
          : {}),
        workspace: dirname(docs[node.id]) === "." ? "" : dirname(docs[node.id])
      }
    }))
  };
}

function workflowStructureSignature(flow) {
  const order = orderedNodeIds(flow);
  return JSON.stringify({
    id: flow.id,
    name: flow.name,
    description: flow.description,
    order,
    nodes: order.map((id) => {
      const node = flow.nodes.find((candidate) => candidate.id === id);
      return [
        id,
        node?.kind,
        node?.data?.label,
        node?.kind === "condition" ? conditionGateType(node, flow.edges.filter((edge) => edge.source === id)) : null,
        node?.kind === "condition" ? node?.data?.predicate ?? "truthy" : null,
        node?.kind === "condition" ? node?.data?.inputPredicates ?? null : null,
        flow.docs?.[id]
      ];
    }),
    edges: flow.edges.map((edge) => [edge.source, edge.target, gateBranchForEdge(edge) ?? null])
  });
}

function renderWorkflowStructure(flow) {
  const order = orderedNodeIds(flow);
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  const workflowDir = dirname(flow.workflowDoc ?? "WORKFLOW.md");
  const steps = order.map((nodeId, index) => {
    const node = nodeById.get(nodeId);
    const label = String(node?.data?.label ?? nodeId);
    const path = portablePath(relative(workflowDir, flow.docs[nodeId]));
    const parents = flow.edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => nodeById.get(edge.source)?.data?.label ?? edge.source);
    const dependency = parents.length ? `；依赖：${parents.join("、")}` : "；起点";
    const kind = node?.kind === "condition"
      ? `condition:${conditionGateType(node, flow.edges.filter((edge) => edge.source === nodeId))}`
      : node?.kind ?? "agent";
    return `${index + 1}. [${label}](${path}) \`${kind}\`${dependency}`;
  });
  const logic = logicExecutionContract(flow);
  const logicLines = logic.conditions.length === 0
    ? []
    : [
        "",
        "## 逻辑门执行契约",
        "",
        "> 条件框不是装饰标签：入边提供操作数，谓词先将上游结果转换为布尔值，再按标准真值表计算。",
        "",
        ...logic.conditions.map((condition) => {
          const inputs = condition.inputs
            .map((input) => `${input.sourceLabel} [${input.predicate}]`)
            .join("、") || "未连接";
          const output = condition.gateType === "ifElse"
            ? "结果为真走“是”，结果为假走“否”"
            : "结果沿全部门输出箭头传播；真值激活普通步骤，假值仍可输入下游逻辑门";
          return `- **${condition.label}** · \`${condition.gateType}\` · \`${condition.formula}\`；输入：${inputs}；输出：${output}`;
        }),
        ...(logic.issues.length === 0
          ? []
          : ["", ...logic.issues.map((issue) => `- ⚠ ${issue}`)])
      ];
  return [
    STRUCTURE_START,
    "## 工作流信息",
    "",
    `- ID：\`${flow.id}\``,
    `- 版本：\`${flow.version ?? 1}\``,
    `- 步骤数：${order.length}`,
    "",
    "## 执行顺序",
    "",
    ...steps,
    ...logicLines,
    STRUCTURE_END
  ].join("\n");
}

export function renderWorkflowDocument(flow) {
  const description = String(flow.description ?? "").trim();
  return [
    `# ${flow.name ?? flow.id}`,
    "",
    description || "这是由 DeepSeekFlow 管理的文档驱动工作流。",
    "",
    "> 先阅读本文件掌握执行顺序，再进入每个步骤目录阅读对应的 STEP.md。Flow 中的 Markdown 编辑器会直接同步这些文件。",
    "",
    renderWorkflowStructure(flow),
    "",
    "## 执行约定",
    "",
    "1. 严格按上面的依赖顺序执行；可并行的分支以流程图连线为准。",
    "2. 每一步开始前先读对应的 `STEP.md`，产物保存在该步骤工作区。",
    "3. 调试步骤需要保留关键截图、错误信息和修复结论。",
    "4. 质检步骤必须核对功能、构建、回归与界面布局，再给出最终结论。",
    "5. 遇到条件框时按“逻辑门执行契约”取上游结果、应用谓词并计算真值；不得把 AND/OR/XOR 当成纯文字标签。",
    ""
  ].join("\n");
}

function refreshWorkflowStructure(content, flow) {
  const start = content.indexOf(STRUCTURE_START);
  const end = content.indexOf(STRUCTURE_END);
  if (start < 0 || end < start) return content;
  return `${content.slice(0, start)}${renderWorkflowStructure(flow)}${content.slice(end + STRUCTURE_END.length)}`;
}

async function readIfPresent(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function hasNodeContent(node) {
  return EXECUTABLE_KINDS.has(node.kind)
    ? typeof node.data?.prompt === "string"
    : typeof node.data?.instructions === "string";
}

export async function loadFlowDocuments(flow, options = {}) {
  if (!flow?.docRoot || !flow?.docs) return flow;
  const root = resolve(flow.docRoot);
  const policy = options.policy === "prefer-flow" ? "prefer-flow" : "prefer-disk";
  const fallbackFlow = options.fallbackFlow;
  const workflowCandidates = [
    flow.workflowDoc ?? "WORKFLOW.md",
    fallbackFlow?.workflowDoc
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  let workflowContent = null;
  if (policy === "prefer-disk" || typeof flow.workflowContent !== "string") {
    for (const path of workflowCandidates) {
      workflowContent = await readIfPresent(resolveInside(root, path));
      if (workflowContent !== null) break;
    }
  }
  let nodes = flow.nodes;
  for (const [nodeId, relativePath] of Object.entries(flow.docs)) {
    const currentNode = nodes.find((node) => node.id === nodeId);
    if (policy === "prefer-flow" && currentNode && hasNodeContent(currentNode)) continue;
    const candidates = [
      relativePath,
      fallbackFlow?.docs?.[nodeId]
    ].filter((value, index, values) => value && values.indexOf(value) === index);
    let content = null;
    for (const candidate of candidates) {
      content = await readIfPresent(resolveInside(root, candidate));
      if (content !== null) break;
    }
    if (content === null) continue;
    nodes = nodes.map((node) => node.id === nodeId ? withNodeContent(node, content.trimEnd()) : node);
  }
  return {
    ...flow,
    nodes,
    workflowContent: (workflowContent ?? flow.workflowContent ?? renderWorkflowDocument(flow)).trimEnd()
  };
}

export async function writeFlowDocuments(flow) {
  if (!flow?.docRoot || !flow?.docs) return flow;
  const root = resolve(flow.docRoot);
  await mkdir(root, { recursive: true });

  // WORKFLOW.md 是整个工作流的入口，因此必须先于分步文件落盘。
  const structureSignature = workflowStructureSignature(flow);
  const currentContent = String(flow.workflowContent ?? "").trimEnd();
  const workflowContent = (currentContent
    ? flow.workflowStructureSignature === structureSignature
      ? currentContent
      : refreshWorkflowStructure(currentContent, flow)
    : renderWorkflowDocument(flow)).trimEnd();
  const workflowPath = resolveInside(root, flow.workflowDoc ?? "WORKFLOW.md");
  await mkdir(dirname(workflowPath), { recursive: true });
  await writeFile(workflowPath, `${workflowContent}\n`, "utf8");

  const order = orderedNodeIds(flow);
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  for (const [index, nodeId] of order.entries()) {
    const node = nodeById.get(nodeId);
    const path = resolveInside(root, flow.docs[nodeId]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${nodeContent(node, index).trimEnd()}\n`, "utf8");
  }
  return { ...flow, workflowContent, workflowStructureSignature: structureSignature };
}

export function defaultWorkflowSteps() {
  return [
    { label: "规划与拆解", prompt: "理解目标与约束，检查 WORKFLOW.md，并给出可执行的分步计划。" },
    { label: "实现与产出", prompt: "根据上一步计划完成核心实现，所有产物保存在本步骤工作区。" },
    { label: "试运行与截图调试", prompt: "实际启动并试运行；在关键状态截图，记录问题、修复过程与复测结果。" },
    { label: "质量检查", prompt: "执行功能、构建、回归和界面质检；发现问题则退回对应步骤修复，确认通过后输出验收结论。" }
  ];
}

export function createScaffoldFlow(request = {}) {
  const now = new Date().toISOString();
  const id = String(request.id ?? `flow-${Date.now().toString(36)}`);
  const rawSteps = Array.isArray(request.steps) && request.steps.length ? request.steps : defaultWorkflowSteps();
  const usedIds = new Set(["input", "output"]);
  const steps = rawSteps.map((value, index) => {
    const step = typeof value === "string"
      ? { label: value, prompt: `完成「${value}」，并把结果传递给下一步。` }
      : value ?? {};
    const requestedId = String(step.id ?? `step-${String(index + 1).padStart(2, "0")}`).trim();
    if (!requestedId) throw new Error(`Step ${index + 1} requires a non-empty id`);
    if (usedIds.has(requestedId)) throw new Error(`Duplicate or reserved step id: ${requestedId}`);
    usedIds.add(requestedId);
    const kind = step.kind ?? "agent";
    const content = step.prompt ?? step.instructions ?? "{{input}}";
    return {
      id: requestedId,
      kind,
      label: step.label ?? `步骤 ${index + 1}`,
      content,
      data: step.data ?? {},
      position: step.position
    };
  });
  let nodes = [
    { id: "input", kind: "input", data: { label: "输入" } },
    ...steps.map((step) => ({
      id: step.id,
      kind: step.kind,
      ...(step.position ? { position: step.position } : {}),
      data: {
        ...step.data,
        label: step.label,
        ...(step.kind === "condition"
          ? { gateType: normalizeGateType(step.data?.gateType ?? "ifElse") }
          : {}),
        ...(EXECUTABLE_KINDS.has(step.kind) ? { prompt: step.content } : { instructions: step.content })
      }
    })),
    { id: "output", kind: "output", data: { label: "输出" } }
  ];
  const requestedConnections = Array.isArray(request.connections) ? request.connections : [];
  if (requestedConnections.length === 0) {
    const aggregate = nodes.find((node) => node.kind === "condition"
      && gateRule(node.data?.gateType).minInputs > 1);
    if (aggregate) {
      throw new Error(`Condition ${aggregate.id} (${normalizeGateType(aggregate.data?.gateType)}) requires explicit connections from at least two upstream operands`);
    }
  }
  const edgeInputs = requestedConnections.length > 0
    ? requestedConnections
    : nodes.slice(0, -1).map((node, index) => ({
        source: node.id,
        target: nodes[index + 1].id,
        ...(node.kind === "condition"
          ? { branch: normalizeGateType(node.data?.gateType) === "ifElse" ? "true" : normalizeGateType(node.data?.gateType) }
          : {})
      }));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = edgeInputs.map((connection, index) => {
    const source = String(connection?.source ?? "");
    const target = String(connection?.target ?? "");
    if (!ids.has(source) || !ids.has(target)) {
      throw new Error(`Connection ${index + 1} references an unknown node: ${source || "?"} -> ${target || "?"}`);
    }
    const branch = connection.branch ?? connection.sourceHandle;
    return {
      id: String(connection.id ?? `e-${source}-${target}-${index + 1}`),
      source,
      target,
      ...(branch === undefined || branch === null || branch === "" ? {} : { sourceHandle: branch })
    };
  });

  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const depth = new Map(queue.map((nodeId) => [nodeId, 0]));
  while (queue.length) {
    const nodeId = queue.shift();
    for (const target of outgoing.get(nodeId) ?? []) {
      depth.set(target, Math.max(depth.get(target) ?? 0, (depth.get(nodeId) ?? 0) + 1));
      incoming.set(target, (incoming.get(target) ?? 0) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  const rows = new Map();
  nodes = nodes.map((node, index) => {
    if (node.position && Number.isFinite(Number(node.position.x)) && Number.isFinite(Number(node.position.y))) return node;
    const column = depth.get(node.id) ?? index;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { ...node, position: { x: 40 + column * 245, y: 80 + row * 160 } };
  });
  return {
    id,
    version: 1,
    name: String(request.name ?? "新工作流"),
    description: String(request.description ?? ""),
    ...(request.docRoot ? { docRoot: request.docRoot } : {}),
    nodes,
    edges,
    inputs: ["input"],
    outputs: ["output"],
    createdAt: now,
    updatedAt: now
  };
}

export const documentWorkflowInternals = { isGeneratedStepPath, resolveInside, safeSegment };
