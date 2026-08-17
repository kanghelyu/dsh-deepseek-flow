import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { conditionGateType, gateBranchForEdge, normalizeGateType } from "./condition-gates.js";
import { feedbackEdges, isFeedbackEdge, stableTopologicalOrder } from "./graph-analysis.js";
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
  const analysis = stableTopologicalOrder(nodes, edges, comparePriority);
  return analysis.complete ? analysis.order : nodes.map((node) => node.id);
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
          ? { gateType: conditionGateType(node, flow.edges.filter((edge) => edge.source === node.id && !isFeedbackEdge(edge))) }
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
        node?.kind === "condition" ? conditionGateType(node, flow.edges.filter((edge) => edge.source === id && !isFeedbackEdge(edge))) : null,
        node?.kind === "condition" ? node?.data?.predicate ?? "truthy" : null,
        node?.kind === "condition" ? node?.data?.inputPredicates ?? null : null,
        flow.docs?.[id]
      ];
    }),
    edges: flow.edges.map((edge) => [
      edge.source,
      edge.target,
      gateBranchForEdge(edge) ?? null,
      edge.feedback?.maxIterations ?? null,
      edge.feedback?.exitCondition ?? null
    ])
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
      .filter((edge) => edge.target === nodeId && !isFeedbackEdge(edge))
      .map((edge) => nodeById.get(edge.source)?.data?.label ?? edge.source);
    const dependency = parents.length ? `；依赖：${parents.join("、")}` : "；起点";
    const kind = node?.kind === "condition"
      ? `condition:${conditionGateType(node, flow.edges.filter((edge) => edge.source === nodeId && !isFeedbackEdge(edge)))}`
      : node?.kind ?? "agent";
    return `${index + 1}. [${label}](${path}) \`${kind}\`${dependency}`;
  });
  const logic = logicExecutionContract(flow);
  const feedback = feedbackEdges(flow.edges);
  const feedbackLines = feedback.length === 0
    ? []
    : [
        "",
        "## 有界反馈循环",
        "",
        "> 反馈箭头表示由当前 Session 控制的有限重试，不会由 DeepSeekFlow 自动执行，也不参与单次布尔门求值。每轮执行前检查退出条件，达到上限后转入失败/人工处理。",
        "",
        ...feedback.map((edge) => {
          const source = nodeById.get(edge.source)?.data?.label ?? edge.source;
          const target = nodeById.get(edge.target)?.data?.label ?? edge.target;
          return `- **${source} -> ${target}**：最多 ${edge.feedback.maxIterations} 次；退出条件：${edge.feedback.exitCondition}`;
        })
      ];
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
    ...feedbackLines,
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

// 内容不变就跳过写盘：自动保存每 650ms 触发一次全量文档重写，
// 没有这一层，编辑一份 N 步工作流会把 N+1 个文件反复磨损 SSD。
async function writeIfChanged(path, content) {
  if ((await readIfPresent(path)) === content) return false;
  await writeFile(path, content, "utf8");
  return true;
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
  await writeIfChanged(workflowPath, `${workflowContent}\n`);

  const order = orderedNodeIds(flow);
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  for (const [index, nodeId] of order.entries()) {
    const node = nodeById.get(nodeId);
    const path = resolveInside(root, flow.docs[nodeId]);
    await mkdir(dirname(path), { recursive: true });
    await writeIfChanged(path, `${nodeContent(node, index).trimEnd()}\n`);
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
      ...(branch === undefined || branch === null || branch === "" ? {} : { sourceHandle: branch }),
      ...(connection.feedback === undefined ? {} : { feedback: connection.feedback })
    };
  });

  const analysis = stableTopologicalOrder(nodes, edges);
  const depth = analysis.depth;
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

export const documentWorkflowInternals = { isGeneratedStepPath, resolveInside, safeSegment, writeIfChanged };
