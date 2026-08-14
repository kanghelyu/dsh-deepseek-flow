import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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
  const position = new Map(nodes.map((node, index) => [node.id, index]));
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
    queue.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
    const id = queue.shift();
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      incoming.set(next, (incoming.get(next) ?? 0) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  return order.length === nodes.length ? order : nodes.map((node) => node.id);
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
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  const docs = Object.fromEntries(Object.entries(flow.docs ?? {}).filter(([nodeId]) => nodeIds.has(nodeId)));
  const used = new Set();
  order.forEach((nodeId, index) => {
    if (docs[nodeId]) {
      resolveInside(docRoot, docs[nodeId]);
      if (!used.has(docs[nodeId])) {
        used.add(docs[nodeId]);
        return;
      }
      delete docs[nodeId];
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
      data: { ...node.data, workspace: dirname(docs[node.id]) === "." ? "" : dirname(docs[node.id]) }
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
      return [id, node?.kind, node?.data?.label, flow.docs?.[id]];
    }),
    edges: flow.edges.map((edge) => [edge.source, edge.target, edge.sourceHandle ?? null])
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
    return `${index + 1}. [${label}](${path}) \`${node?.kind ?? "agent"}\`${dependency}`;
  });
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

export async function loadFlowDocuments(flow) {
  if (!flow?.docRoot || !flow?.docs) return flow;
  const root = resolve(flow.docRoot);
  const workflowPath = resolveInside(root, flow.workflowDoc ?? "WORKFLOW.md");
  const workflowContent = await readIfPresent(workflowPath);
  let nodes = flow.nodes;
  for (const [nodeId, relativePath] of Object.entries(flow.docs)) {
    const content = await readIfPresent(resolveInside(root, relativePath));
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
  const steps = rawSteps.map((step, index) => typeof step === "string"
    ? { label: step, prompt: `完成「${step}」，并把结果传递给下一步。`, kind: "agent" }
    : { label: step.label ?? `步骤 ${index + 1}`, prompt: step.prompt ?? step.instructions ?? "{{input}}", kind: step.kind ?? "agent" });
  const nodes = [
    { id: "input", kind: "input", position: { x: 40, y: 180 }, data: { label: "输入" } },
    ...steps.map((step, index) => ({
      id: `step-${String(index + 1).padStart(2, "0")}`,
      kind: step.kind,
      position: { x: 270 + index * 250, y: 180 },
      data: {
        label: step.label,
        ...(EXECUTABLE_KINDS.has(step.kind) ? { prompt: step.prompt } : { instructions: step.prompt })
      }
    })),
    { id: "output", kind: "output", position: { x: 270 + steps.length * 250, y: 180 }, data: { label: "输出" } }
  ];
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `e-${node.id}-${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id
  }));
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

export const documentWorkflowInternals = { resolveInside, safeSegment };
