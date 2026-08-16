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
import { randomUUID } from "node:crypto";
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
import { UiStateStore } from "./ui-state.js";

export const name = "deepseek-flow";
// apply() 中通过 ctx.tools.register 注册工具，需声明 tools 服务依赖
export const inject = ["tools"];

const BUNDLED_SKILL_URL = new URL("../skills/deepseek-flow/SKILL.md", import.meta.url);
const AGENT_FINALIZE_TTL_MS = 30 * 60_000;
// 未配置 assistantTimeoutMs 时的兜底：挂死的子代理最多占用 10 分钟，之后可取消/超时释放。
const DEFAULT_ASSIST_TIMEOUT_MS = 10 * 60_000;

function markdownBody(source) {
  const normalized = String(source ?? "").replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return normalized.trim();
  const end = normalized.indexOf("\n---\n", 4);
  return end < 0 ? "" : normalized.slice(end + 5).trim();
}

function agentFinalizeKey(sessionId, flowId) {
  return `${sessionId}:${flowId}`;
}

// assist 结果双写：磁盘 ui-state 是事实来源（切视图/重启可恢复）；
// 内存 Map 只保留 running 条目供重复请求判断，终态即删，长驻进程不再无限增长。
async function recordAssist(host, sessionId, key, entry) {
  if (entry.status === "running") host.assistResults.set(key, entry);
  else host.assistResults.delete(key);
  try {
    await host.uiState.recordAssist(sessionId, key, entry);
  } catch (error) {
    console.error(`[deepseek-flow] persist assist result failed: ${error?.message ?? error}`);
  }
}

async function ownedSessionFlow(host, sessionId, flowId) {
  const state = await host.store.session(sessionId);
  return state.flows.find((flow) => flow.id === flowId) ?? null;
}

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
      ["revisions", "revisions"],
      ["draftSave", "draftSave"],
      ["draftGet", "draftGet"],
      ["draftClear", "draftClear"],
      ["assist", "assist"],
      ["topologyApply", "topologyApply"],
      ["finalizePending", "finalizePending"],
      ["topologyFinalize", "topologyFinalize"],
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
  /** 删除当前 session 内的 flow；shared=true 时删除共享模板。 */
  async delete(sessionId, id, shared) {
    if (shared === true) return (await deleteSharedFlow(this.host, id)).deleted;
    return (await deleteSessionFlow(this.host, sessionId, id)).deleted;
  }
  /**
   * 轻量 revision 轮询：只返回 id/name/revision，不读任何 Markdown。
   * Studio 的后台同步先用它判断是否需要拉全量文档，避免每 5 秒全量读盘。
   */
  async revisions(sessionId) {
    const shared = (await this.host.store.shared()).flows;
    const owned = sessionId ? (await this.host.store.session(sessionId)).flows : [];
    const ownedIds = new Set(owned.map((flow) => flow.id));
    return [...owned, ...shared.filter((flow) => !ownedIds.has(flow.id))].map((flow) => ({
      id: flow.id,
      name: flow.name ?? flow.id,
      sessionId: flow.sessionId ?? null,
      revision: flowRevision(flow),
      updatedAt: flow.updatedAt ?? null
    }));
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
    const flowId = flow?.id ?? null;
    // 落盘的 running 标记让重启后也能看到「中断」而不是凭空消失。
    recordAssist(this.host, request.sessionId, key, {
      status: "running", mode, flowId, target: request.target ?? null, createdAt: Date.now()
    });
    setTimeout(() => {
      (async () => {
        try {
          const result = await runAgentAssist(this.host, request);
          await recordAssist(this.host, request.sessionId, key, {
            status: "done", mode, flowId, target: request.target ?? null, result, createdAt: Date.now()
          });
        } catch (error) {
          const cancelled = error?.code === "DFLOW_CANCELLED";
          await recordAssist(this.host, request.sessionId, key, {
            status: cancelled ? "cancelled" : "error",
            mode,
            flowId,
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
    const requestedDiff = topologyDiff(reviewBase, draftFlow);
    // flow_create/flow_put called by the main Session already persist topology.
    // If Studio submits that exact graph from an older baseline, adopt the saved
    // flow directly instead of bouncing it through the main Session for review.
    if (!requestedDiff.changed) {
      return {
        accepted: false,
        requestId,
        mode: "topology-apply",
        unchanged: true,
        alreadyPersisted: topologySignature(reviewBase) !== topologySignature(baseTopology),
        flow: reviewBase
      };
    }
    if (topologySignature(reviewBase) !== topologySignature(baseTopology)) {
      throw new Error("The saved topology changed after this draft was opened. Reload Studio, merge the latest topology, then apply again.");
    }
    recordAssist(this.host, sessionId, key, {
      status: "running",
      mode: "topology-apply",
      flowId: draftFlow.id,
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
          await recordAssist(this.host, sessionId, key, {
            status: "done",
            mode: "topology-apply",
            flowId: draftFlow.id,
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
          await recordAssist(this.host, sessionId, key, {
            status: "error",
            mode: "topology-apply",
            flowId: draftFlow.id,
            target: draftFlow.id,
            error: String(error?.message ?? error),
            createdAt: Date.now()
          });
        }
      })();
    }, 0);
    return { accepted: true, requestId, mode: "topology-apply", diff: requestedDiff };
  }
  /** 返回 Agent 最近为此流程签发的隐藏定稿请求；Studio 用它触发不可见按钮。 */
  async finalizePending(sessionId, id) {
    if (!sessionId || !id) return null;
    const key = agentFinalizeKey(sessionId, id);
    const pending = this.host.agentFinalizeRequests.get(key);
    if (!pending) return null;
    const stored = await ownedSessionFlow(this.host, sessionId, id);
    const stale = Date.now() > pending.expiresAt
      || !stored
      || flowRevision(stored) !== pending.baseRevision;
    if (stale) {
      this.host.agentFinalizeRequests.delete(key);
      return null;
    }
    return {
      requestId: pending.requestId,
      flowId: pending.flowId,
      baseRevision: pending.baseRevision,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt
    };
  }
  /**
   * 隐藏定稿通道：只做确定性校验并原子保存，不派生或回调主 Session Agent。
   * requestId 来自 flow_finalize_canvas；source=external-files 则由 Studio 的
   * “无本地画布编辑事件”判定触发，作为 Agent 忘记调用工具时的兜底。
   */
  async topologyFinalize(request) {
    const { sessionId, requestId, draftFlow, source, expectedRevision } = request ?? {};
    if (!sessionId || !draftFlow?.id || !Array.isArray(draftFlow.nodes) || !Array.isArray(draftFlow.edges)) {
      throw new Error("dflow/topologyFinalize requires sessionId and a draftFlow with nodes and edges");
    }
    const key = agentFinalizeKey(sessionId, draftFlow.id);
    const pending = requestId ? this.host.agentFinalizeRequests.get(key) : null;
    const agentAuthorized = Boolean(pending && pending.requestId === requestId && Date.now() <= pending.expiresAt);
    const externalFileAuthorized = !requestId && source === "external-files";
    if (!agentAuthorized && !externalFileAuthorized) throw new Error("No valid hidden-finalize authorization");

    const stored = await ownedSessionFlow(this.host, sessionId, draftFlow.id);
    if (!stored) throw new Error(`Session flow ${draftFlow.id} was not found`);
    const baseRevision = agentAuthorized ? pending.baseRevision : Number(expectedRevision);
    if (!Number.isInteger(baseRevision) || flowRevision(stored) !== baseRevision) {
      if (agentAuthorized) this.host.agentFinalizeRequests.delete(key);
      throw new Error("The saved flow changed before hidden finalize; reload Studio before finalizing again.");
    }
    if (agentAuthorized) this.host.agentFinalizeRequests.delete(key);
    validateFlow(draftFlow);
    const diff = topologyDiff(stored, draftFlow);
    if (!diff.changed) {
      return {
        finalized: true,
        unchanged: true,
        skippedMainSession: true,
        flow: await this.loadDocs(stored, sessionId)
      };
    }
    const result = await saveSessionFlow(this.host, draftFlow, sessionId, {
      expectedRevision: baseRevision,
      // Agent 直接改文件时以磁盘 Markdown 为准，避免 UI 的旧正文覆盖刚完成的修改。
      documentPolicy: "prefer-disk"
    });
    return {
      finalized: true,
      skippedMainSession: true,
      diff,
      flow: await this.loadDocs(result.flow, sessionId),
      cleanup: result.cleanup
    };
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
  /**
   * 拉取本 Session 的 assist 结果历史（用于 Client 卸载/重启后恢复结果）。
   * 数据源是磁盘 ui-state：切视图、重启 dsh web 都不丢；默认无 TTL，
   * 只有配置了 assistResultTtlMs 才按时间清理。
   */
  async assistHistory(sessionId, key) {
    if (!sessionId) return [];
    if (key) {
      // 客户端 3 秒轮询走单条查询：不加载、不解析整个历史文件。
      const entry = await this.host.uiState.assistEntry(sessionId, key);
      if (!entry) return [];
      if (entry.status === "running" && !this.host.assistResults.has(key)) {
        this.host.assistResults.set(key, entry);
      }
      return [entry];
    }
    const entries = await this.host.uiState.assistHistory(sessionId, this.host.assistResultTtlMs);
    // 内存 Map 同步运行中状态，供 topologyApply 的重复请求判断。
    for (const entry of entries) {
      if (entry.status === "running" && !this.host.assistResults.has(entry.key)) {
        this.host.assistResults.set(entry.key, entry);
      }
    }
    return entries;
  }
  /** 保存 Studio 的未应用草稿（画布拓扑 + 当前文档），切视图/重启后可恢复。 */
  async draftSave(request) {
    const { sessionId, flowId, draft } = request ?? {};
    if (!sessionId || !flowId || !draft || typeof draft !== "object" || !Array.isArray(draft.nodes) || !Array.isArray(draft.edges)) {
      throw new Error("dflow/draftSave requires sessionId, flowId and a draft with nodes and edges");
    }
    return this.host.uiState.saveDraft(sessionId, flowId, draft);
  }
  async draftGet(sessionId, flowId) {
    if (!sessionId || !flowId) return null;
    return this.host.uiState.getDraft(sessionId, flowId);
  }
  async draftClear(sessionId, flowId) {
    if (!sessionId || !flowId) return { cleared: false };
    return this.host.uiState.clearDraft(sessionId, flowId);
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
    description: "优先用这个工具新建 DeepSeekFlow 工作流。默认生成线性链；传 connections 后可生成安全的无环分支图。逻辑门不是自然语言判断器：condition 的 data.gateType 只能是 ifElse/and/or/not/nand/nor/xor/xnor，data.predicate 只能是 truthy/falsy/nonEmpty。需要理解中文条件时，先放一个 Agent 输出 Boolean true/false，再连到 predicate=truthy 的 condition。系统会直接持久化，无需再让 Studio 交回主 Session 审核。",
    parameters: {
      name: { type: "string", required: true, description: "工作流名称。" },
      description: { type: "string", description: "总目标、交付标准和约束。" },
      steps: { type: "json", description: "有序步骤数组；省略时默认生成四步。条件示例：{id:\"gate\",label:\"是否通过\",kind:\"condition\",data:{gateType:\"ifElse\",predicate:\"truthy\"}}。predicate 禁止填写中文判断句，只能是 truthy/falsy/nonEmpty。" },
      connections: { type: "json", description: "可选连线数组 [{source,target,branch?}]。IF/ELSE 出边 branch 分别写 true、false；其他门写对应门名。组合门至少两个入边，IF/ELSE 与 NOT 恰好一个入边；必须保持无环。" },
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
        topologyPersisted: true,
        studioAction: "The topology is already saved. Studio must sync it and must not send it back to the main Session for review.",
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
    description: "导入/更新一个 flow 定义并直接持久化；成功后 Studio 无需再交回主 Session 审核。condition.data.gateType 只能是 ifElse/and/or/not/nand/nor/xor/xnor，predicate/inputPredicates 的值只能是 truthy/falsy/nonEmpty；自然语言条件必须先由上游 Agent 输出 Boolean。默认以传入 JSON/Studio 内容为准，磁盘 Markdown 仅补齐缺失字段；更新已有 flow 必须携带当前 revision 或 expected_revision。",
    parameters: {
      flow: { type: "json", description: "完整 flow：id/name/nodes/edges/inputs/outputs。IF/ELSE 示例节点 data={gateType:\"ifElse\",predicate:\"truthy\"}，其两条出边 sourceHandle/branch 分别为 true 和 false。" },
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
        return { ok: true, scope: "shared", id: next.id, name: next.name, revision: next.revision, nodeCount: next.nodes.length, topologyPersisted: true, studioAction: "Already saved; no Studio topology review is required.", cleanup: result.cleanup };
      }
      const result = await saveSessionFlow(host, flow, sessionId, options);
      const next = result.flow;
      return { ok: true, scope: "session", sessionId, id: next.id, name: next.name, revision: next.revision, nodeCount: next.nodes.length, topologyPersisted: true, studioAction: "Already saved; Studio must sync this revision instead of sending it back to the main Session.", cleanup: result.cleanup };
    }
  }));

  ctx.tools.register(defineTool({
    name: "flow_finalize_canvas",
    description: "Agent 专用的隐藏定稿动作。仅当你直接修改了某个现有工作流的 WORKFLOW.md、STEP.md 或相关定义文件，并且这些修改会让 Studio 出现“应用修改”时调用。它不会让用户看到新按钮：请求会排队，Studio 打开后自动按下隐藏按钮，执行确定性校验并直接定稿，跳过再次交给主 Session。不要用于用户在画布上手工新增、删除或连线的草稿。",
    parameters: {
      id: { type: "string", required: true, description: "已修改的当前 Session 工作流 id；先用 flow_list/flow_read 确认。" },
      expected_revision: { type: "number", description: "可选；修改文件前通过 flow_read 取得的 revision。若已变化则拒绝排队。" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      if (!sessionId) throw new Error("No current session");
      const stored = await ownedSessionFlow(host, sessionId, args.id);
      if (!stored) throw new Error(`Session flow ${args.id} was not found`);
      const revision = flowRevision(stored);
      if (args.expected_revision !== undefined && Number(args.expected_revision) !== revision) {
        throw new Error(`Flow ${args.id} revision changed: expected ${args.expected_revision}, current ${revision}`);
      }
      const createdAt = Date.now();
      const pending = {
        requestId: randomUUID(),
        sessionId,
        flowId: stored.id,
        baseRevision: revision,
        createdAt,
        expiresAt: createdAt + AGENT_FINALIZE_TTL_MS
      };
      host.agentFinalizeRequests.set(agentFinalizeKey(sessionId, stored.id), pending);
      return {
        ok: true,
        queued: true,
        id: stored.id,
        revision,
        hiddenAction: "finalize-canvas-without-main-session-review",
        note: "Studio will consume this one-time request automatically. No user-visible button or second main-Session review is required."
      };
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
  const uiState = new UiStateStore(root);
  const configuredTimeout = Number(config?.assistantTimeoutMs);
  const configuredResultTtl = Number(config?.assistResultTtlMs);
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
    uiState,
    runsDir: workspacePath,
    agentCtx: null,
    assistControllers: new Map(),
    assistRuns: new Map(),
    assistResults: new Map(),
    agentFinalizeRequests: new Map(),
    // 默认永久保留 AI 结果（用户显式丢弃才删）；需要限时清理时配置该值。
    assistResultTtlMs: Number.isFinite(configuredResultTtl) && configuredResultTtl >= 10_000 ? configuredResultTtl : null,
    assistantProvider: typeof config?.assistantProvider === "string" && config.assistantProvider.trim()
      ? config.assistantProvider.trim()
      : undefined,
    assistantTimeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout >= 10_000
      ? Math.min(configuredTimeout, 600_000)
      : DEFAULT_ASSIST_TIMEOUT_MS,
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
  // skills 服务可能晚于本插件启动；必须响应式注入，不能在启动瞬间 get() 后静默跳过。
  // 同一份合法 SKILL.md 同时作为包内资源与运行时 content，避免目录 provider 返回空正文。
  const bundledSkillContent = markdownBody(await readFile(BUNDLED_SKILL_URL, "utf8"));
  if (!bundledSkillContent) throw new Error("Bundled deepseek-flow SKILL.md has no Markdown body after frontmatter");
  ctx.inject(["skills"], (skillCtx) => {
    skillCtx.skills.register({
      name: "deepseek-flow",
      description: "把用户的工作流需求落地为 DeepSeek Flow 可视化流程图：用户直说「构建/导入工作流、把流程做成图」时；或用户描述一个多步骤任务流程（如「做一个找论文、下论文、读论文、出综述和名词解释的工作流」）时，识别需求、拆解步骤，用 flow_create 生成总控 WORKFLOW.md + 每步 STEP.md 独立工作区 + 画布节点连线；或用 flow_put 导入既有 flow.json。",
      whenToUse: "用户要求构建/建立/生成/导入工作流、把流程做成图、可视化流程时；或用户描述了一个多步骤的任务流程需求（找论文→读论文→出综述→名词解释 这类「先…再…最后…」的流程）时使用。",
      source: "deepseek-flow plugin",
      content: bundledSkillContent
    });
  });

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
