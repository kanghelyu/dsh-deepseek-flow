// DeepSeekFlow Host — 每个 session 独立的可视化工作流插件
//
// 存储模型（与 sessionQuery.traceSession 的「session 一一对应」一致）：
//   ~/.dsh/deepseek-flow/shared.json           共享模板（无主，任何 session 可见）
//   ~/.dsh/deepseek-flow/sessions/<id>.json    每个 session 独立的 flows
//
// 能力：
//   - Studio 流程图编辑（client 端原生 SVG/HTML 画布）
//   - 仅编辑与文档同步；实际执行由当前 Session 读取工作流后完成
//   - 一句话导入：动态工具 flow_list/flow_read/flow_put/flow_delete，
//     自动绑定调用者当前 session（exec.agent.id / exec.agent.session.id）
//   - 无跑分/评测冗余

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  createScaffoldFlow,
  loadFlowDocuments,
  normalizeDocumentFlow,
  orderedNodeIds,
  writeFlowDocuments
} from "./document-workflow.js";
import { cancelAgentAssist, runAgentAssist } from "./agent-assistant.js";
import { conditionGateType, gateBranchForEdge, validateGateBranch } from "./condition-gates.js";

export const name = "deepseek-flow";
// apply() 中通过 ctx.tools.register 注册工具，需声明 tools 服务依赖
export const inject = ["tools"];

// =========================================================================
// 图校验与编译（语义与 deepseek-harness-flow 一致，MIT，已精简无 Bench 部分）
// =========================================================================

class FlowValidationError extends Error {
  constructor(issues) {
    super(`Invalid flow: ${issues.join("; ")}`);
    this.issues = issues;
    this.name = "FlowValidationError";
  }
}

function validateFlow(flow) {
  const issues = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  for (const node of flow.nodes) {
    if (nodeIds.has(node.id)) issues.push(`duplicate node id ${node.id}`);
    nodeIds.add(node.id);
  }
  for (const edge of flow.edges) {
    if (edgeIds.has(edge.id)) issues.push(`duplicate edge id ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) issues.push(`dangling edge ${edge.id} source ${edge.source}`);
    if (!nodeIds.has(edge.target)) issues.push(`dangling edge ${edge.id} target ${edge.target}`);
    if (edge.source === edge.target) issues.push(`self edge ${edge.id}`);
    const source = flow.nodes.find((node) => node.id === edge.source);
    if (edge.sourceHandle !== undefined && edge.sourceHandle !== null && source?.kind !== "condition") issues.push(`branch handle on non-condition edge ${edge.id}`);
    if (source?.kind === "condition" && !gateBranchForEdge(edge)) issues.push(`condition edge ${edge.id} requires a logic branch`);
  }
  for (const node of flow.nodes.filter((candidate) => candidate.kind === "condition")) {
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
  if (flow.nodes.filter((node) => node.kind === "input").length === 0) issues.push("at least one Input node is required");
  if (flow.nodes.filter((node) => node.kind === "output").length === 0) issues.push("at least one Output node is required");
  for (const id of [...flow.inputs, ...flow.outputs]) if (!nodeIds.has(id)) issues.push(`declared input/output ${id} is missing`);
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
  if (order.length !== flow.nodes.length) throw new FlowValidationError(["cycle detected"]);
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

// =========================================================================
// per-session 存储（每个 session 一个文件，与 session 轨迹一一对应）
// =========================================================================

class DflowStore {
  constructor(root) {
    this.root = root;
  }
  sharedPath() {
    return join(this.root, "shared.json");
  }
  sessionPath(sessionId) {
    return join(this.root, "sessions", `${String(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
  }
  async readState(path) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return { flows: [] };
      throw error;
    }
  }
  async writeState(path, state) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }
  async shared() {
    return this.readState(this.sharedPath());
  }
  async session(sessionId) {
    if (!sessionId) throw new Error("sessionId is required");
    return this.readState(this.sessionPath(sessionId));
  }
  async updateShared(mutator) {
    const state = await this.shared();
    const next = mutator(state);
    await this.writeState(this.sharedPath(), next);
    return next;
  }
  async updateSession(sessionId, mutator) {
    const state = await this.session(sessionId);
    const next = mutator(state);
    await this.writeState(this.sessionPath(sessionId), next);
    return next;
  }
  async listFlow(sessionId, id) {
    const owned = sessionId ? (await this.session(sessionId)).flows : [];
    const shared = (await this.shared()).flows;
    return owned.find((f) => f.id === id) ?? shared.find((f) => f.id === id) ?? null;
  }
}

// =========================================================================
// Remote 服务（namespace: dflow）
// =========================================================================

function registerRemoteMethods(service, methods) {
  for (const [implementation, exportName] of methods) {
    const method = service[implementation];
    if (typeof method !== "function") throw new Error(`Remote implementation ${implementation} is not callable`);
    const initializers = [];
    Remote(exportName)(method, {
      name: implementation,
      private: false,
      static: false,
      addInitializer: (initializer) => {
        initializers.push(initializer);
      }
    });
    for (const initializer of initializers) initializer.call(service);
  }
}

class DeepSeekFlowRemoteService extends TypertRemoteService {
  constructor(ctx, host) {
    super(ctx, "deepseekFlow", { namespace: "dflow" });
    this.host = host;
    registerRemoteMethods(this, [
      ["list", "list"],
      ["get", "get"],
      ["create", "create"],
      ["put", "put"],
      ["delete", "delete"],
      ["assist", "assist"],
      ["assistCancel", "assistCancel"],
      ["assistHistory", "assistHistory"],
      ["models", "models"]
    ]);
  }
  documentize(flow, sessionId) {
    if (!flow) return flow;
    return normalizeDocumentFlow(flow, {
      storageRoot: this.host.root,
      scope: flow.sessionId ?? sessionId ?? "shared"
    });
  }
  async loadDocs(flow, sessionId) {
    return loadFlowDocuments(this.documentize(flow, sessionId));
  }
  async writeDocs(flow, sessionId) {
    return writeFlowDocuments(this.documentize(flow, sessionId));
  }
  /** 列表：当前 session 的 flows + 共享模板（无主）。 */
  async list(sessionId) {
    const shared = (await this.host.store.shared()).flows;
    const owned = sessionId ? (await this.host.store.session(sessionId)).flows : [];
    const ownedIds = new Set(owned.map((flow) => flow.id));
    const merged = [...owned, ...shared.filter((flow) => !ownedIds.has(flow.id))];
    return Promise.all(merged.map((f) => this.loadDocs(f, f.sessionId ?? sessionId)));
  }
  /** 取单个 flow（session 优先，其次共享）。 */
  async get(sessionId, id) {
    return this.loadDocs(await this.host.store.listFlow(sessionId, id), sessionId);
  }
  /** 文档优先新建：先写 WORKFLOW.md，再创建每一步工作区/STEP.md。 */
  async create(request) {
    const { sessionId } = request ?? {};
    if (!sessionId) throw new Error("flow/create requires sessionId");
    const flow = createScaffoldFlow(request);
    return this.put(flow, sessionId);
  }
  /** 保存 flow 到当前 session（客户端/工具调用时打上 session 标签）。 */
  async put(flow, sessionId) {
    if (!sessionId) throw new Error("flow/put requires sessionId");
    validateFlow(flow);
    // 文档驱动：WORKFLOW.md 先落盘，随后写各步骤目录下的 STEP.md。
    const documented = await this.writeDocs(flow, sessionId);
    const next = {
      ...documented,
      sessionId,
      updatedAt: new Date().toISOString()
    };
    await this.host.store.updateSession(sessionId, (state) => ({
      ...state,
      flows: [next, ...state.flows.filter((candidate) => candidate.id !== next.id)]
    }));
    return next;
  }
  /** 删除当前 session 内的 flow。 */
  async delete(sessionId, id) {
    let deleted = false;
    await this.host.store.updateSession(sessionId, (state) => {
      deleted = state.flows.some((flow) => flow.id === id);
      return { ...state, flows: state.flows.filter((flow) => flow.id !== id) };
    });
    return deleted;
  }
  /** 让当前 Session 派生一次性 Agent 做手动校验或 Markdown 优化；不运行工作流。 */
  async assist(request) {
    const { flow, mode = "logic" } = request ?? {};
    if (!flow || typeof flow !== "object" || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
      throw new Error("dflow/assist requires a flow with nodes and edges");
    }
    if (!["logic", "optimize", "optimize-workflow"].includes(mode)) throw new Error(`Unsupported dflow/assist mode: ${mode}`);
    // fire-and-forget：受理后立即返回，任务在独立异步链中执行——
    // Client 断开/切换视图/卸载都不影响任务；结果写入 assistResults 由 assistHistory 读取。
    const key = `${request.sessionId}:${request.requestId}`;
    this.host.assistResults.delete(key);
    this.host.assistResults.set(key, { status: "running", mode, target: request.target ?? null, createdAt: Date.now() });
    setTimeout(() => {
      (async () => {
        try {
          const result = await runAgentAssist(this.host, request);
          this.host.assistResults.set(key, { status: "done", mode, target: request.target ?? null, result, createdAt: Date.now() });
        } catch (error) {
          this.host.assistResults.set(key, {
            status: "error",
            mode,
            target: request.target ?? null,
            error: String(error?.message ?? error),
            createdAt: Date.now()
          });
        }
      })();
    }, 0);
    return { accepted: true, requestId: request.requestId, mode };
  }
  /** 列出可选模型（供 Client 的 AI 助手模型下拉使用；与 WebUI 模型选择同源 llm 服务）。 */
  async models() {
    const llm = this.ctx.get("llm");
    if (!llm) return [];
    const out = [];
    let providers = [];
    try {
      providers = llm.listProviders() ?? [];
    } catch {
      providers = [];
    }
    for (const entry of providers) {
      const name = typeof entry === "string" ? entry : entry?.id ?? entry?.name;
      if (!name) continue;
      try {
        const models = await llm.listModels(name);
        for (const model of models ?? []) {
          const id = typeof model === "string" ? model : model?.id ?? model?.name;
          if (id) out.push({ provider: name, model: id });
        }
      } catch {
        // 单 provider 失败跳过
      }
    }
    return out;
  }
  /** 取消一个仍在运行的一次性 Agent 请求。 */
  async assistCancel(request) {
    const { sessionId, requestId } = request ?? {};
    if (!sessionId || !requestId) throw new Error("dflow/assistCancel requires sessionId and requestId");
    return { cancelled: cancelAgentAssist(this.host, sessionId, requestId) };
  }
  /** 拉取本 Session 的 assist 结果历史（用于 Client 卸载后恢复进行中/已完成结果）。 */
  async assistHistory(sessionId) {
    if (!sessionId) return [];
    const prefix = `${sessionId}:`;
    const now = Date.now();
    const ttl = this.host.assistResultTtlMs;
    const entries = [];
    for (const [key, value] of this.host.assistResults.entries()) {
      if (!key.startsWith(prefix)) continue;
      if (now - value.createdAt > ttl) {
        this.host.assistResults.delete(key);
        continue;
      }
      entries.push({ key, ...value });
    }
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// =========================================================================
// 动态工具：一句话导入工作流（自动绑定调用者当前 session）
// =========================================================================

function registerTools(ctx, host) {
  // 文件读取直接用 node:fs（包插件为 Node 环境，不依赖抽象 fs 服务的挂载状态）。
  // Agent 实例实际暴露 id / session，逐级兜底。
  const sessionOf = (exec) => {
    const agent = exec?.agent;
    if (!agent) return undefined;
    const sid = agent.id ?? agent.session?.id;
    return sid ? String(sid) : undefined;
  };
  const renderJson = (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }];

  ctx.tools.register(defineTool({
    name: "flow_create",
    description: "优先用这个工具新建 DeepSeekFlow 工作流。它会先生成总控 WORKFLOW.md，再按执行顺序为每一步创建独立工作区和 STEP.md，并把它们显示在 Flow 文档栏中。steps 可传字符串数组，或 {label,prompt,kind} 对象数组。",
    parameters: {
      name: { type: "string", required: true, description: "工作流名称。" },
      description: { type: "string", description: "总目标、交付标准和约束。" },
      steps: { type: "json", description: "有序步骤数组；省略时默认生成规划、实现、截图调试、质量检查四步。" },
      doc_root: { type: "string", description: "可选的文档工作区绝对路径；省略时保存到插件工作区。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      if (!sessionId) throw new Error("No current session");
      const flow = createScaffoldFlow({
        name: args.name,
        description: args.description,
        steps: args.steps,
        docRoot: args.doc_root
      });
      validateFlow(flow);
      const documented = await writeFlowDocuments(normalizeDocumentFlow(flow, { storageRoot: host.root, scope: sessionId }));
      const next = { ...documented, sessionId, updatedAt: new Date().toISOString() };
      await host.store.updateSession(sessionId, (state) => ({
        ...state,
        flows: [next, ...state.flows.filter((candidate) => candidate.id !== next.id)]
      }));
      return {
        ok: true,
        id: next.id,
        name: next.name,
        workflow: join(next.docRoot, next.workflowDoc),
        stepFiles: Object.values(next.docs).map((path) => join(next.docRoot, path))
      };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_list",
    description: "列出当前 Session 可用的 DeepSeekFlow 定义（当前 Session 的 + 共享模板）。DeepSeekFlow 只编辑不运行；选定 id 后用 flow_read 读取文档，并在当前 Session 内按步骤执行。",
    parameters: {},
    output: { schema: { type: "json" }, render: renderJson },
    async execute(_args, exec) {
      const sessionId = sessionOf(exec);
      const shared = (await host.store.shared()).flows;
      const owned = sessionId ? (await host.store.session(sessionId)).flows : [];
      const ownedIds = new Set(owned.map((flow) => flow.id));
      return {
        currentSessionId: sessionId ?? null,
        flows: [...owned, ...shared.filter((flow) => !ownedIds.has(flow.id))].map((f) => ({
          id: f.id,
          name: f.name,
          sessionId: f.sessionId ?? null,
          nodeCount: f.nodes.length,
          edgeCount: f.edges.length,
          workflow: f.docRoot ? join(f.docRoot, f.workflowDoc ?? "WORKFLOW.md") : null,
          updatedAt: f.updatedAt
        }))
      };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_read",
    description: "读取一个 DeepSeekFlow 的 WORKFLOW.md、步骤顺序、连线关系和每个 STEP.md。只读取，不启动任何 worker；实际工作必须由当前 Session 按这些文档执行。",
    parameters: {
      id: { type: "string", required: true, description: "flow id；先用 flow_list 获取。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const stored = await host.store.listFlow(sessionId, args.id);
      if (!stored) throw new Error(`Flow ${args.id} was not found`);
      const flow = await loadFlowDocuments(normalizeDocumentFlow(stored, {
        storageRoot: host.root,
        scope: stored.sessionId ?? sessionId ?? "shared"
      }));
      const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
      return {
        id: flow.id,
        name: flow.name,
        description: flow.description ?? "",
        workflowPath: join(flow.docRoot, flow.workflowDoc),
        workflowContent: flow.workflowContent,
        execution: "Execute in the current Session; DeepSeekFlow does not run workflows.",
        steps: orderedNodeIds(flow).map((nodeId, index) => {
          const node = nodeById.get(nodeId);
          return {
            order: index + 1,
            id: nodeId,
            kind: node.kind,
            label: node.data?.label ?? nodeId,
            path: join(flow.docRoot, flow.docs[nodeId]),
            content: node.data?.prompt ?? node.data?.instructions ?? "",
            settings: Object.fromEntries(Object.entries({
              stage: node.data?.stage,
              provider: node.data?.provider,
              model: node.data?.model,
              predicate: node.data?.predicate,
              gateType: node.kind === "condition" ? conditionGateType(node, flow.edges.filter((edge) => edge.source === node.id)) : undefined,
              outputSchema: node.data?.outputSchema
            }).filter(([, value]) => value !== undefined))
          };
        }),
        edges: flow.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          ...(gateBranchForEdge(edge) === undefined ? {} : { branch: gateBranchForEdge(edge) })
        }))
      };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_put",
    description: "导入/更新一个 flow 定义到 DeepSeekFlow。系统会自动先生成 WORKFLOW.md，再为每个节点生成独立工作区/STEP.md；已有 MD 内容优先于 JSON prompt。新建时更推荐 flow_create。二选一提供 flow（内联 JSON）或 file（flow JSON 绝对路径）。",
    parameters: {
      flow: { type: "json", description: "完整的 flow 定义对象：id/name/nodes/edges/inputs/outputs。" },
      file: { type: "string", description: "flow 定义 JSON 文件的绝对路径（与 flow 二选一）。" },
      shared: { type: "boolean", description: "true = 存为共享模板（无主），默认 false = 当前 session 专属。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      let flow = args.flow;
      if (flow === undefined) {
        if (!args.file) throw new Error("flow_put requires flow JSON or file path");
        flow = JSON.parse(await readFile(args.file, "utf8"));
        // 带 docs 映射的示例/模板默认以 JSON 所在目录作为文档工作区。
        if (!flow.docRoot && flow.docs) flow = { ...flow, docRoot: dirname(resolve(args.file)) };
      }
      if (!flow || typeof flow !== "object") throw new Error("flow must be a JSON object");
      if (typeof flow.id !== "string" || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) throw new Error("flow requires id, nodes, edges");
      validateFlow(flow);
      const scope = args.shared === true ? "shared" : sessionId;
      if (!scope) throw new Error("No current session to import into; pass shared=true to save as a shared template");
      // 文档优先：统一补齐 WORKFLOW.md/步骤目录；已有文件内容覆盖 JSON prompt。
      flow = normalizeDocumentFlow(flow, { storageRoot: host.root, scope });
      flow = await loadFlowDocuments(flow);
      flow = await writeFlowDocuments(flow);
      const now = new Date().toISOString();
      const next = { ...flow, updatedAt: now, createdAt: flow.createdAt ?? now };
      if (args.shared === true) {
        await host.store.updateShared((state) => ({ ...state, flows: [next, ...state.flows.filter((f) => f.id !== next.id)] }));
        return { ok: true, scope: "shared", id: next.id, name: next.name, nodeCount: next.nodes.length };
      }
      await host.store.updateSession(sessionId, (state) => ({ ...state, flows: [next, ...state.flows.filter((f) => f.id !== next.id)] }));
      return { ok: true, scope: "session", sessionId, id: next.id, name: next.name, nodeCount: next.nodes.length };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_delete",
    description: "按 id 从 DeepSeekFlow 删除一个 flow：默认删当前 session 的；shared=true 时删除共享模板。",
    parameters: {
      id: { type: "string", required: true, description: "要删除的 flow id。" },
      shared: { type: "boolean", description: "true = 删除共享模板，默认 false = 删除当前 session 的。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      if (args.shared === true) {
        let deleted = false;
        await host.store.updateShared((state) => {
          deleted = state.flows.some((f) => f.id === args.id);
          return { ...state, flows: state.flows.filter((f) => f.id !== args.id) };
        });
        return { ok: deleted, scope: "shared", id: args.id };
      }
      const sessionId = sessionOf(exec);
      if (!sessionId) throw new Error("No current session");
      let deleted = false;
      await host.store.updateSession(sessionId, (state) => {
        deleted = state.flows.some((f) => f.id === args.id);
        return { ...state, flows: state.flows.filter((f) => f.id !== args.id) };
      });
      return { ok: deleted, scope: "session", sessionId, id: args.id };
    }
  }));

}

// =========================================================================
// apply：初始化 + 迁移旧 harness-flow 共享模板
// =========================================================================

export async function apply(ctx, config) {
  // dataDir 兜底：宿主进程可能未设 DSH_HOME，用 homedir 推导。
  const dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  const root = resolve(config?.dataDir ?? join(dshHome, "deepseek-flow"));
  const store = new DflowStore(root);
  const configuredTimeout = Number(config?.assistantTimeoutMs);
  // 独立工作区「deepseekflow」：assist 任务会话全部归入，WebUI 工作区列表可见。
  const runsDir = join(root, "runs");
  let workspacePath = runsDir;
  try {
    const workspaceRegistry = ctx.get("workspaceRegistry");
    if (workspaceRegistry) {
      const existing = await workspaceRegistry.resolveByPath(runsDir);
      const workspace = existing ?? await workspaceRegistry.create(runsDir, "deepseekflow");
      if (typeof workspace?.path === "string" && workspace.path) workspacePath = workspace.path;
      console.log(`[deepseek-flow] workspace "deepseekflow" ready at ${workspacePath}`);
    }
  } catch (error) {
    console.error(`[deepseek-flow] workspace registration skipped: ${error?.message ?? error}`);
  }
  const host = {
    store,
    ctx,
    root,
    runsDir: workspacePath,
    agentCtx: null,
    assistControllers: new Map(),
    assistResults: new Map(),
    assistResultTtlMs: 30 * 60_000,
    assistantProvider: typeof config?.assistantProvider === "string" && config.assistantProvider.trim()
      ? config.assistantProvider.trim()
      : undefined,
    assistantTimeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout >= 10_000
      ? Math.min(configuredTimeout, 600_000)
      : null,
    assistantModel: typeof config?.assistantModel === "string" && config.assistantModel.trim()
      ? config.assistantModel.trim()
      : undefined
  };
  ctx.provide("deepseekFlowHost", host);
  // Agent 能力是可选的动态依赖：未启用时编辑器仍能打开，点击 AI 操作会给出明确错误。
  ctx.inject(["agents", "subagents"], (agentCtx) => {
    host.agentCtx = agentCtx;
    agentCtx.effect(() => () => {
      if (host.agentCtx !== agentCtx) return;
      // 需求 1：切换视图/会话不得中断进行中的校验/优化。
      // 仅解除当前绑定；已启动的请求由 runAgentAssist 自身（finally）收尾，
      // 其 AbortController 仍保留在 assistControllers 中，超时与用户手动取消继续有效。
      host.agentCtx = null;
    },
      "deepseekFlow.agentBinding()"
    );
  });
  new DeepSeekFlowRemoteService(ctx, host);
  registerTools(ctx, host);
  // 内置技能：装上插件即自动注册——用户说「构建工作流」等话术时，Agent 用它落地可视化流程。
  const skills = ctx.get("skills");
  if (skills) {
    skills.register({
      name: "deepseek-flow",
      description: "把用户口述的工作流（「构建工作流」「导入工作流」「把流程可视化」等话术）落地为 DeepSeek Flow 可视化流程图：用 flow_create 生成总控 WORKFLOW.md + 每步 STEP.md 工作区 + 画布节点连线，或用 flow_put 导入既有 flow.json。",
      whenToUse: "用户要求构建/建立/生成/导入工作流、把流程做成图、可视化流程时使用。",
      content: `# DeepSeek Flow：一句话构建工作流

当用户说「构建工作流 / 建立工作流 / 生成工作流 / 导入工作流 / 把流程做成图 / 可视化这个流程」等话术时，使用本技能，把工作流落地为 DeepSeek Flow 里的可视化流程图。

## 首选：flow_create

用 \`flow_create\` 一步生成总控文档、每步文档和画布：

- \`name\`：工作流名称
- \`description\`：总目标、交付标准与关键约束（会写入 WORKFLOW.md 总纲）
- \`steps\`：有序步骤数组，每项 \`{ label, prompt }\`；prompt 写清该步的完整执行说明（自包含：路径、命令、校验标准）
- \`doc_root\`：可选，文档工作区绝对路径（省略则用插件默认目录）

\`flow_create\` 会自动生成 WORKFLOW.md（含执行顺序）与每步独立目录/STEP.md，并在画布上连好节点与箭头。

## 已有 flow.json 时：flow_put

\`flow_put\`（参数 file=JSON 路径；shared=true 存为共享模板）导入既有定义；已有 MD 内容优先于 JSON prompt。

## 维护

- \`flow_read\`（id）读总纲与各步骤内容；\`flow_list\` 查看所有工作流
- 画布与文档双向同步：改画布=写回 MD，改 MD=刷新画布；用户在 WebUI 的 DeepSeek Flow 标签可视化编辑
- 本插件只做「流程图 + 文档」；真正的执行始终在当前 Session 由 Agent 完成

## 完成后

告诉用户：打开 DeepSeek Flow 标签即可看到工作流；后续说「按这个工作流执行」时，按 WORKFLOW.md 的顺序逐步执行各 STEP.md。
`
    });
  }

  // 一次性迁移：旧 deepseek-harness-flow 的无主 flows 复制为共享模板（排除示例 starter-flow）。
  // 旧数据位置 = 本插件 dataDir 的兄弟目录 harness-flow（不依赖进程环境变量）。
  try {
    const shared = await store.shared();
    if (shared.flows.length === 0) {
      const oldRoot = join(dirname(root), "harness-flow");
      const oldState = JSON.parse(await readFile(join(oldRoot, "state.json"), "utf8"));
      const migrated = (oldState.flows ?? []).filter((f) => f.id !== "starter-flow");
      if (migrated.length > 0) {
        await store.updateShared((state) => ({ ...state, flows: migrated }));
        console.log(`[deepseek-flow] migrated ${migrated.length} shared flows from harness-flow`);
      }
    }
  } catch (error) {
    console.error(`[deepseek-flow] migration skipped: ${error?.message ?? error}`);
  }
}
