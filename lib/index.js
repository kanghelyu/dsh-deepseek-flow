// DeepSeekFlow Host — 每个 session 独立的可视化工作流插件
//
// 存储模型（与 sessionQuery.traceSession 的「session 一一对应」一致）：
//   ~/.dsh/deepseek-flow/shared.json           共享模板（无主，任何 session 可见）
//   ~/.dsh/deepseek-flow/sessions/<id>.json    每个 session 独立的 flows
//
// 能力：
//   - Studio 流程图编辑（client 端原生 SVG/HTML 画布）
//   - 编辑、文档同步与确定性布尔门求值；Agent 步骤由当前 Session 执行
//   - 一句话导入：动态工具 flow_list/flow_read/flow_evaluate/flow_put/flow_delete，
//     自动绑定调用者当前 session（exec.agent.id / exec.agent.session.id）
//   - 无跑分/评测冗余

import { readFile } from "node:fs/promises";
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
import { conditionGateType, gateBranchForEdge } from "./condition-gates.js";
import { DflowStore, flowRevision, nextFlowRevision } from "./dflow-store.js";
import { validateFlow } from "./flow-validation.js";
import { evaluateFlowLogic, logicExecutionContract } from "./logic-semantics.js";
import { applyReviewedTopology, topologyDiff, topologySignature } from "./topology-model.js";
import { runMainSessionTopologyReview } from "./topology-review.js";
import { archiveFlowWorkspace, archiveObsoleteDocuments } from "./workspace-lifecycle.js";

export const name = "deepseek-flow";
// apply() 中通过 ctx.tools.register 注册工具，需声明 tools 服务依赖
export const inject = ["tools"];

// =========================================================================
// 图校验与编译（语义与 deepseek-harness-flow 一致，MIT，已精简无 Bench 部分）
// =========================================================================


// =========================================================================
// per-session 存储（每个 session 一个文件，与 session 轨迹一一对应）
// =========================================================================

function withReadableRevision(flow) {
  return flow ? { ...flow, revision: flowRevision(flow) } : flow;
}

async function prepareFlowWrite(host, flow, scope, previous, options = {}) {
  validateFlow(flow);
  const revision = nextFlowRevision(flow, previous, options);
  const normalized = normalizeDocumentFlow(withReadableRevision(flow), {
    storageRoot: host.root,
    scope,
    previousFlow: previous
  });
  const merged = await loadFlowDocuments(normalized, {
    policy: options.documentPolicy === "prefer-disk" ? "prefer-disk" : "prefer-flow",
    fallbackFlow: previous
  });
  const documented = await writeFlowDocuments(merged);
  const now = new Date().toISOString();
  return {
    ...documented,
    revision,
    updatedAt: now,
    createdAt: flow.createdAt ?? previous?.createdAt ?? now
  };
}

async function saveSessionFlow(host, flow, sessionId, options = {}) {
  let previous = null;
  let saved = null;
  await host.store.updateSession(sessionId, async (state) => {
    previous = state.flows.find((candidate) => candidate.id === flow.id) ?? null;
    saved = {
      ...await prepareFlowWrite(host, flow, sessionId, previous, options),
      sessionId
    };
    return {
      ...state,
      flows: [saved, ...state.flows.filter((candidate) => candidate.id !== saved.id)]
    };
  });
  const cleanup = previous
    ? await archiveObsoleteDocuments(previous, saved, { storageRoot: host.root })
    : [];
  return { flow: saved, cleanup };
}

async function saveSharedFlow(host, flow, options = {}) {
  let previous = null;
  let saved = null;
  await host.store.updateShared(async (state) => {
    previous = state.flows.find((candidate) => candidate.id === flow.id) ?? null;
    const documented = await prepareFlowWrite(host, flow, "shared", previous, options);
    const { sessionId: _sessionId, ...sharedFlow } = documented;
    saved = sharedFlow;
    return {
      ...state,
      flows: [saved, ...state.flows.filter((candidate) => candidate.id !== saved.id)]
    };
  });
  const cleanup = previous
    ? await archiveObsoleteDocuments(previous, saved, { storageRoot: host.root })
    : [];
  return { flow: saved, cleanup };
}

async function deleteSessionFlow(host, sessionId, id) {
  let previous = null;
  await host.store.updateSession(sessionId, (state) => {
    previous = state.flows.find((flow) => flow.id === id) ?? null;
    return { ...state, flows: state.flows.filter((flow) => flow.id !== id) };
  });
  const cleanup = previous
    ? await archiveFlowWorkspace(previous, { storageRoot: host.root, reason: "flow-delete" })
    : { status: "missing", path: null };
  return { deleted: Boolean(previous), cleanup };
}

async function deleteSharedFlow(host, id) {
  let previous = null;
  await host.store.updateShared((state) => {
    previous = state.flows.find((flow) => flow.id === id) ?? null;
    return { ...state, flows: state.flows.filter((flow) => flow.id !== id) };
  });
  const cleanup = previous
    ? await archiveFlowWorkspace(previous, { storageRoot: host.root, reason: "shared-flow-delete" })
    : { status: "missing", path: null };
  return { deleted: Boolean(previous), cleanup };
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
      ["topologyApply", "topologyApply"],
      ["assistCancel", "assistCancel"],
      ["assistHistory", "assistHistory"],
      ["models", "models"]
    ]);
  }
  documentize(flow, sessionId) {
    if (!flow) return flow;
    return normalizeDocumentFlow(withReadableRevision(flow), {
      storageRoot: this.host.root,
      scope: flow.sessionId ?? sessionId ?? "shared"
    });
  }
  async loadDocs(flow, sessionId) {
    return loadFlowDocuments(this.documentize(flow, sessionId));
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
    const result = await saveSessionFlow(this.host, flow, sessionId, { documentPolicy: "prefer-flow" });
    return result.flow;
  }
  /** 删除当前 session 内的 flow。 */
  async delete(sessionId, id) {
    return (await deleteSessionFlow(this.host, sessionId, id)).deleted;
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
          const cancelled = error?.code === "DFLOW_CANCELLED";
          this.host.assistResults.set(key, {
            status: cancelled ? "cancelled" : "error",
            mode,
            target: request.target ?? null,
            ...(cancelled ? {} : { error: String(error?.message ?? error) }),
            createdAt: Date.now()
          });
        }
      })();
    }, 0);
    return { accepted: true, requestId: request.requestId, mode };
  }
  /**
   * 应用 Studio 拓扑草稿：本地确定性检查 -> 当前主 Session 绑定 Agent 审查/重构
   * -> 再次确定性校验 -> 带 revision 冲突保护地一次性落盘。
   * Markdown 不进入 Agent 输出；审查期间发生的文档更新会从最新版本合并回来。
   */
  async topologyApply(request) {
    const { sessionId, requestId, draftFlow, baseTopology } = request ?? {};
    if (!sessionId || !requestId) throw new Error("dflow/topologyApply requires sessionId and requestId");
    if (!draftFlow || typeof draftFlow !== "object" || !Array.isArray(draftFlow.nodes) || !Array.isArray(draftFlow.edges)) {
      throw new Error("dflow/topologyApply requires a draftFlow with nodes and edges");
    }
    if (!baseTopology || typeof baseTopology !== "object") throw new Error("dflow/topologyApply requires the persisted baseTopology");
    const key = `${sessionId}:${requestId}`;
    if (this.host.assistResults.get(key)?.status === "running") throw new Error("This topology request is already running");
    const stored = await this.host.store.listFlow(sessionId, draftFlow.id);
    const emptyBase = {
      ...draftFlow,
      nodes: [],
      edges: [],
      inputs: [],
      outputs: [],
      docs: {}
    };
    const reviewBase = stored ?? emptyBase;
    if (topologySignature(reviewBase) !== topologySignature(baseTopology)) {
      throw new Error("The saved topology changed after this draft was opened. Reload Studio, merge the latest topology, then apply again.");
    }
    const requestedDiff = topologyDiff(reviewBase, draftFlow);
    if (!requestedDiff.changed) return { accepted: false, requestId, mode: "topology-apply", unchanged: true };
    this.host.assistResults.delete(key);
    this.host.assistResults.set(key, {
      status: "running",
      mode: "topology-apply",
      target: draftFlow.id,
      diff: requestedDiff,
      createdAt: Date.now()
    });
    setTimeout(() => {
      (async () => {
        try {
          let staticIssues = [];
          try {
            validateFlow(draftFlow);
          } catch (error) {
            staticIssues = Array.isArray(error?.issues) ? error.issues : [String(error?.message ?? error)];
          }
          const review = await runMainSessionTopologyReview(this.host, {
            ...request,
            baseFlow: reviewBase,
            staticIssues
          });
          // Agent 运行期间允许 Markdown 独立保存，但不允许另一个拓扑提交悄悄覆盖本草稿。
          const latest = await this.host.store.listFlow(sessionId, draftFlow.id);
          const latestBase = latest ?? emptyBase;
          if (topologySignature(latestBase) !== topologySignature(baseTopology)) {
            throw new Error("The saved topology changed while this review was running. The reviewed draft was not written; reload and apply again.");
          }
          const rebuilt = applyReviewedTopology(latestBase, draftFlow, review.topology);
          validateFlow(rebuilt);
          const result = await saveSessionFlow(this.host, rebuilt, sessionId, {
            ...(latest ? { expectedRevision: flowRevision(latest) } : {}),
            documentPolicy: "prefer-flow"
          });
          this.host.assistResults.set(key, {
            status: "done",
            mode: "topology-apply",
            target: draftFlow.id,
            result: {
              mode: "topology-apply",
              summary: review.summary,
              requestedDiff,
              appliedDiff: topologyDiff(latestBase, result.flow),
              flow: result.flow,
              cleanup: result.cleanup,
              agent: review.agent
            },
            createdAt: Date.now()
          });
        } catch (error) {
          this.host.assistResults.set(key, {
            status: "error",
            mode: "topology-apply",
            target: draftFlow.id,
            error: String(error?.message ?? error),
            createdAt: Date.now()
          });
        }
      })();
    }, 0);
    return { accepted: true, requestId, mode: "topology-apply", diff: requestedDiff };
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
    description: "优先用这个工具新建 DeepSeekFlow 工作流。默认生成线性链；传 connections 后可直接生成安全的无环分支图。条件框入边是真值操作数，按标准门语义计算。系统会创建总控 WORKFLOW.md 与每步 STEP.md。steps 支持字符串，或 {id,label,prompt,kind,data,position} 对象。",
    parameters: {
      name: { type: "string", required: true, description: "工作流名称。" },
      description: { type: "string", description: "总目标、交付标准和约束。" },
      steps: { type: "json", description: "有序步骤数组；省略时默认生成规划、实现、截图调试、质量检查四步。" },
      connections: { type: "json", description: "可选连线数组 [{source,target,branch?}]。进入条件框的每条边是一个逻辑输入；条件输出边用 branch 指定 true/false/and/or/not/nand/nor/xor/xnor。组合门至少两个输入，IF/ELSE 与 NOT 恰好一个输入；必须保持无环。" },
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
        connections: args.connections,
        docRoot: args.doc_root
      });
      const { flow: next } = await saveSessionFlow(host, flow, sessionId, { documentPolicy: "prefer-flow" });
      return {
        ok: true,
        id: next.id,
        name: next.name,
        revision: next.revision,
        workflow: join(next.docRoot, next.workflowDoc),
        stepFiles: Object.values(next.docs).map((path) => join(next.docRoot, path))
      };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_list",
    description: "列出当前 Session 可用的 DeepSeekFlow 定义（当前 Session 的 + 共享模板）。DeepSeekFlow 负责编辑与布尔门求值，但不运行 Agent 步骤；选定 id 后用 flow_read 读取文档，并在当前 Session 内按步骤执行。",
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
          revision: flowRevision(f),
          updatedAt: f.updatedAt
        }))
      };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_read",
    description: "读取一个 DeepSeekFlow 的 WORKFLOW.md、步骤顺序、连线关系、每个 STEP.md 与可计算的逻辑门执行契约。只读取，不启动任何 worker；实际工作由当前 Session 按文档执行。",
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
        revision: flowRevision(flow),
        workflowPath: join(flow.docRoot, flow.workflowDoc),
        workflowContent: flow.workflowContent,
        execution: "Execute steps in the current Session. Use logicContract or flow_evaluate for deterministic gate truth propagation; DeepSeekFlow does not run Agent steps.",
        logicContract: logicExecutionContract(flow),
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
              inputPredicates: node.data?.inputPredicates,
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
    name: "flow_evaluate",
    description: "只计算一个 DeepSeekFlow 的逻辑门真值，不执行 Agent 步骤。values 用节点 id 映射上游步骤结果；系统应用条件框谓词，计算 AND/OR/NOT/NAND/NOR/XOR/XNOR 或 IF/ELSE，并返回传播信号与应激活目标。",
    parameters: {
      id: { type: "string", required: true, description: "flow id；先用 flow_list 获取。" },
      values: { type: "json", required: true, description: "上游节点结果对象，例如 {\"check-a\": true, \"check-b\": false}。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const stored = await host.store.listFlow(sessionId, args.id);
      if (!stored) throw new Error(`Flow ${args.id} was not found`);
      const evaluation = evaluateFlowLogic(stored, args.values);
      return {
        id: stored.id,
        revision: flowRevision(stored),
        ...evaluation,
        note: "Boolean gates were evaluated only; no Input, Agent, Map Agent, Merge, or Output step was executed."
      };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_put",
    description: "导入/更新一个 flow 定义。默认以传入 JSON/Studio 内容为准，磁盘 Markdown 仅补齐缺失字段；document_policy=disk 可显式改为磁盘优先。更新已有 flow 必须携带当前 revision 或 expected_revision，避免并发静默覆盖；force=true 仅用于明确强制替换。",
    parameters: {
      flow: { type: "json", description: "完整的 flow 定义对象：id/name/nodes/edges/inputs/outputs。" },
      file: { type: "string", description: "flow 定义 JSON 文件的绝对路径（与 flow 二选一）。" },
      shared: { type: "boolean", description: "true = 存为共享模板（无主），默认 false = 当前 session 专属。" },
      expected_revision: { type: "number", description: "更新时预期的当前 revision；先用 flow_read 获取。" },
      force: { type: "boolean", description: "明确忽略 revision 冲突并强制覆盖；默认 false。" },
      document_policy: { type: "string", description: "flow（默认）：传入内容优先；disk：已有 Markdown 优先。" }
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
      const scope = args.shared === true ? "shared" : sessionId;
      if (!scope) throw new Error("No current session to import into; pass shared=true to save as a shared template");
      const options = {
        expectedRevision: args.expected_revision,
        force: args.force === true,
        documentPolicy: args.document_policy === "disk" ? "prefer-disk" : "prefer-flow"
      };
      if (args.shared === true) {
        const result = await saveSharedFlow(host, flow, options);
        const next = result.flow;
        return { ok: true, scope: "shared", id: next.id, name: next.name, revision: next.revision, nodeCount: next.nodes.length, cleanup: result.cleanup };
      }
      const result = await saveSessionFlow(host, flow, sessionId, options);
      const next = result.flow;
      return { ok: true, scope: "session", sessionId, id: next.id, name: next.name, revision: next.revision, nodeCount: next.nodes.length, cleanup: result.cleanup };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_delete",
    description: "按 id 删除 flow。插件托管的工作区会移动到 deepseek-flow/trash 以便恢复；自定义外部 docRoot 不会自动移动。默认删当前 session，shared=true 删除共享模板。",
    parameters: {
      id: { type: "string", required: true, description: "要删除的 flow id。" },
      shared: { type: "boolean", description: "true = 删除共享模板，默认 false = 删除当前 session 的。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      if (args.shared === true) {
        const result = await deleteSharedFlow(host, args.id);
        return { ok: result.deleted, scope: "shared", id: args.id, cleanup: result.cleanup };
      }
      const sessionId = sessionOf(exec);
      if (!sessionId) throw new Error("No current session");
      const result = await deleteSessionFlow(host, sessionId, args.id);
      return { ok: result.deleted, scope: "session", sessionId, id: args.id, cleanup: result.cleanup };
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
    assistRuns: new Map(),
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
      description: "把用户的工作流需求落地为 DeepSeek Flow 可视化流程图：用户直说「构建/导入工作流、把流程做成图」时；或用户描述一个多步骤任务流程（如「做一个找论文、下论文、读论文、出综述和名词解释的工作流」）时，识别需求、拆解步骤，用 flow_create 生成总控 WORKFLOW.md + 每步 STEP.md 独立工作区 + 画布节点连线；或用 flow_put 导入既有 flow.json。",
      whenToUse: "用户要求构建/建立/生成/导入工作流、把流程做成图、可视化流程时；或用户描述了一个多步骤的任务流程需求（找论文→读论文→出综述→名词解释 这类「先…再…最后…」的流程）时使用。",
      content: `# DeepSeek Flow：一句话构建工作流

触发场景（命中其一即使用本技能）：

1. 用户直说「构建工作流 / 建立工作流 / 生成工作流 / 导入工作流 / 把流程做成图 / 可视化这个流程」等话术；
2. 用户描述了一个多步骤任务流程需求，例如「写一个找论文、下论文、读论文、出综述和名词解释的工作流」「做一个先收集素材、再写脚本、最后配音出片的流程」——即使没出现「工作流」三个字，只要是「先做什么、再做什么、最后做什么」的多步流程描述，就按工作流落地。

处理方式：向用户一句话复述你理解的步骤链条确认；步骤数量灵活、一步一个清晰目标；用 flow_create 落地；完成后告诉用户去 DeepSeek Flow 标签查看，之后说「按这个工作流执行」时按 WORKFLOW.md 顺序逐步执行各 STEP.md。

## 首选：flow_create

用 \`flow_create\` 一步生成总控文档、每步文档和画布：

- \`name\`：工作流名称
- \`description\`：总目标、交付标准与关键约束（会写入 WORKFLOW.md 总纲）
- \`steps\`：步骤数组；简单线性流程可用 \`{ label, prompt }\`，分支流程建议为每步指定稳定 \`id\`，条件步骤使用 \`kind: "condition"\` 与 \`data.gateType\`
- \`connections\`：可选连线数组 \`{ source, target, branch? }\`；进入条件框的边是操作数，条件输出边使用对应 branch；组合门至少两个输入，IF/ELSE 与 NOT 恰好一个输入
- \`doc_root\`：可选，文档工作区绝对路径（省略则用插件默认目录）

\`flow_create\` 会自动生成 WORKFLOW.md（含执行顺序）与每步独立目录/STEP.md，并在画布上连好节点与箭头。流程必须保持无环；重试请建模为有界重试步骤或失败终止分支，并在 Markdown 中写明策略。

## 已有 flow.json 时：flow_put

\`flow_put\`（参数 file=JSON 路径；shared=true 存为共享模板）导入既有定义。默认传入内容优先，磁盘只补齐缺失字段；需要磁盘优先时显式传 \`document_policy: "disk"\`。更新既有 flow 前先用 \`flow_read\` 取得 \`revision\`，防止并发覆盖。

## 插件画布使用指南（回答用户操作问题时引用）

- **添加箭头**：从一个节点右侧圆点（输出端口）按住拖动到另一个节点左侧圆点（输入端口），松开即连线。
- **条件框（逻辑门）规则**：新建条件框时先选择门类型（IF/ELSE、AND、OR、NOT、NAND、NOR、XOR、XNOR）；IF/ELSE 每个分支只允许一条出线、第三条被拦截；NOT 只允许一条出线；AND/OR/NAND/NOR/XOR/XNOR 可连多条出线到不同目标并自动标注，重复目标被拦截；重复分支、超限出线、重复目标写入前拦截并弹警示；已有出线时不能静默切换门类型；旧工作流的 true/false 分支自动推断为 IF/ELSE 门；用 \`flow_evaluate\` 可按标准真值表计算门结果。
- **平移与缩放**：拖拽空白处平移；Ctrl/⌘+滚轮或触控板捏合缩放（以光标为锚点）；双指滑动平移。
- **节点与文档**：点击节点在右侧栏编辑；画布与 WORKFLOW.md/STEP.md 双向同步（保存写回、改文件刷新）。
- **拓扑提交事务**：新增/删除/移动流程框、逻辑门、箭头与输入输出只形成画布草稿，右下角「应用修改」确认后才进入本地校验、主 Session Agent 审查、二次校验与 revision 原子保存；Markdown 正文走独立保存通道。拓扑未应用时「逻辑校验」与「修改整个工作流」按钮禁用（点击弹「请先保存工作流」），「单文档修改」仍可用；仅移动节点位置不算拓扑修改（位置自动保存）。
- **逻辑门不执行逻辑**：本插件只做可视化与文档；真正执行在当前 Session 由 Agent 完成。

## 维护

- \`flow_read\`（id）读总纲、各步骤内容与 \`logicContract\`；\`flow_evaluate\`（id + values）按标准真值表计算门结果和激活目标；\`flow_list\` 查看所有工作流
- 画布与文档双向同步：改画布=写回 MD，改 MD=刷新画布；用户在 WebUI 的 DeepSeek Flow 标签可视化编辑
- 删除工作流时，插件托管目录进入 \`deepseek-flow/trash\`；外部自定义 \`docRoot\` 不会自动移动
- 本插件负责流程图、文档与确定性的布尔门求值；真正的 Agent 步骤执行始终在当前 Session 完成

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
