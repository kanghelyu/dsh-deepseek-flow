// DeepSeekFlow Client — 流程图编辑器（每个 session 独立视图）
// 挂载点：conversation.view slot（Chat 旁的视图入口），inject 提供当前 sessionId
// 主题：全部使用 dsw alias token（--dsw-alias-*），明暗主题自动跟随 webui

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import {
  CONDITION_GATE_TYPES,
  conditionGateType,
  gateBranchForEdge,
  normalizeGateType
} from "../../lib/condition-gates.js";
import { LOGIC_PREDICATES, gateRule } from "../../lib/logic-semantics.js";
import {
  mergeDocumentEdits,
  topologyDiff,
  topologyProjection,
  topologySignature,
  topologySyncDecision
} from "../../lib/topology-model.js";
import { GraphCanvas, GRAPH_MIN_ZOOM } from "./graph-canvas.js";
import { browserLanguage, localeLanguage, text } from "./i18n.js";
import {
  branchDisplayLabel,
  connectionProblem,
  connectionProblemMessage,
  flowToCanvasEdges,
  flowToCanvasNodes,
  graphSnapshot,
  layoutNodes,
  reconnectFlowEdge,
  serializeFlow
} from "./graph-model.js";
import { styles } from "./styles.js";


function loadPositionOverrides(flowId) {
  try {
    return JSON.parse(localStorage.getItem(`deepseek-flow:positions:${flowId}`) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}

const inject = ["slots", "connection", "locale"];
const CLIENT_REV = "__DEEPSEEK_FLOW_CLIENT_REV__";


// ============ API ============
async function remoteCall(connection, endpoint, args = {}) {
  const result = await connection.rpc.call("/api", endpoint, { args });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function newRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Older embedded WebViews may not expose crypto.randomUUID.
  }
  return `df-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function download(content, fileName, mediaType) {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}


// Canvas rendering and graph transformations live in focused, independently testable modules.
const PANEL_COLLAPSE_THRESHOLD = 108;
const LEFT_PANEL_DEFAULT = 264;
const RIGHT_PANEL_DEFAULT = 380;
const ASSISTANT_DEFAULT = 240;
const ASSISTANT_COLLAPSE_THRESHOLD = 118;

function storedNumber(key, fallback) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function storedBoolean(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function keepLayout(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private browsing or a locked-down WebView can reject persistence.
  }
}

// ============ Studio ============
function Studio({ connection, sessionId, language }) {
  const t = useMemo(() => text(language), [language]);
  const [flows, setFlows] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [activeDoc, setActiveDoc] = useState("workflow");
  const [documentsOpen, setDocumentsOpen] = useState(() => storedBoolean("deepseek-flow:left-open", window.innerWidth > 1040));
  const [inspectorOpen, setInspectorOpen] = useState(() => storedBoolean("deepseek-flow:right-open", window.innerWidth > 1040));
  const [documentWidth, setDocumentWidth] = useState(() => storedNumber("deepseek-flow:left-width", LEFT_PANEL_DEFAULT));
  const [inspectorWidth, setInspectorWidth] = useState(() => storedNumber("deepseek-flow:right-width", RIGHT_PANEL_DEFAULT));
  const [studioWidth, setStudioWidth] = useState(() => Math.max(640, Number(window.innerWidth) || 1200));
  const [message, setMessage] = useState(t.ready);
  const [dirty, setDirty] = useState(false);
  const [flowInstance, setFlowInstance] = useState(null);
  const [gatePickerOpen, setGatePickerOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [connectionWarning, setConnectionWarning] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(() => storedBoolean("deepseek-flow:assistant-open", false));
  const [assistantHeight, setAssistantHeight] = useState(() => storedNumber("deepseek-flow:assistant-height", ASSISTANT_DEFAULT));
  const [assistantBusy, setAssistantBusy] = useState(null);
  // 需求：busy 按文档隔离（per-target），切文档后按钮回到初始态，可并发发起其他文档的优化。
  const [runningDocs, setRunningDocs] = useState(() => new Map());
  const [assistModel, setAssistModel] = useState("");
  const [assistEffort, setAssistEffort] = useState("");
  const [assistMenuOpen, setAssistMenuOpen] = useState(false);
  const [assistMenuPage, setAssistMenuPage] = useState(null);
  const [assistModelOptions, setAssistModelOptions] = useState(null);
  const [assistantInstruction, setAssistantInstruction] = useState("");
  const [validationResult, setValidationResult] = useState(null);
  const [findingFilter, setFindingFilter] = useState(null);
  const [optimizationProposal, setOptimizationProposal] = useState(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  // 需求 6：每个文档的优化方案独立保留（切文档不丢、并发互不覆盖）。
  const proposalStoreRef = React.useRef(new Map());
  const pollTimerRef = React.useRef(null);
  const topologyPollRef = React.useRef(null);
  const [workflowOptimizeConfirm, setWorkflowOptimizeConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [topologyApplyConfirm, setTopologyApplyConfirm] = useState(false);
  const [topologyApplyBusy, setTopologyApplyBusy] = useState(false);
  const [persistedTopologySignature, setPersistedTopologySignature] = useState("");
  const fileRef = React.useRef(null);
  const documentTimerRef = React.useRef(null);
  const fitTimerRef = React.useRef(null);
  const documentWriteChainRef = React.useRef(Promise.resolve());
  const documentRevisionRef = React.useRef(0);
  const persistedRevisionRef = React.useRef(new Map());
  const persistedFlowRef = React.useRef(null);
  const optimizationRequestRef = React.useRef(0);
  const activeAssistRef = React.useRef(null);
  const currentIdRef = React.useRef(null);
  const nodesRef = React.useRef([]);
  const edgesRef = React.useRef([]);
  const historyRef = React.useRef({ past: [], future: [] });
  const studioRef = React.useRef(null);
  const canvasShellRef = React.useRef(null);
  const panelDragRef = React.useRef(null);
  const assistantDragRef = React.useRef(null);

  const fitWholeFlow = useCallback((duration = 260) => {
    flowInstance?.fitView?.({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration });
  }, [flowInstance]);

  const beginPanelResize = useCallback((side, event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const isLeft = side === "left";
    const wasOpen = isLeft ? documentsOpen : inspectorOpen;
    const remembered = isLeft ? documentWidth : inspectorWidth;
    const fallback = isLeft ? LEFT_PANEL_DEFAULT : RIGHT_PANEL_DEFAULT;
    const startWidth = wasOpen ? remembered : 0;
    const startX = event.clientX;
    const pointerId = event.pointerId;
    let moved = false;
    let lastWidth = startWidth;
    const maximum = Math.max(180, Math.min(isLeft ? 520 : 680, studioWidth * 0.46));
    const setOpen = isLeft ? setDocumentsOpen : setInspectorOpen;
    const setWidth = isLeft ? setDocumentWidth : setInspectorWidth;
    const splitter = event.currentTarget;
    const oldCursor = document.body.style.cursor;
    const oldSelect = document.body.style.userSelect;
    splitter?.classList?.add("is-dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (moveEvent) => {
      if (pointerId !== undefined && moveEvent.pointerId !== undefined && moveEvent.pointerId !== pointerId) return;
      const delta = isLeft ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      if (Math.abs(delta) > 3) moved = true;
      lastWidth = Math.max(0, Math.min(maximum, startWidth + delta));
      if (lastWidth > 4) setOpen(true);
      setWidth(Math.max(1, lastWidth));
    };
    const onUp = (upEvent) => {
      if (pointerId !== undefined && upEvent.pointerId !== undefined && upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      splitter?.classList?.remove("is-dragging");
      document.body.style.cursor = oldCursor;
      document.body.style.userSelect = oldSelect;
      panelDragRef.current = null;
      if (!moved && !wasOpen) {
        setWidth(Math.max(PANEL_COLLAPSE_THRESHOLD, remembered || fallback));
        setOpen(true);
      } else if (lastWidth < PANEL_COLLAPSE_THRESHOLD) {
        setWidth(Math.max(PANEL_COLLAPSE_THRESHOLD, startWidth || remembered || fallback));
        setOpen(false);
      } else {
        setWidth(lastWidth);
        setOpen(true);
      }
      window.setTimeout(() => fitWholeFlow(180), 0);
    };
    panelDragRef.current = { side, onMove, onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [documentWidth, documentsOpen, fitWholeFlow, inspectorOpen, inspectorWidth, studioWidth]);

  const panelKeyDown = useCallback((side, event) => {
    const isLeft = side === "left";
    const open = isLeft ? documentsOpen : inspectorOpen;
    const setOpen = isLeft ? setDocumentsOpen : setInspectorOpen;
    const setWidth = isLeft ? setDocumentWidth : setInspectorWidth;
    const delta = event.shiftKey ? 40 : 16;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(!open);
    } else if (event.key === "Home") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setOpen(true);
      setWidth((value) => Math.max(PANEL_COLLAPSE_THRESHOLD, value + (isLeft ? direction : -direction) * delta));
    }
  }, [documentsOpen, inspectorOpen]);

  const beginAssistantResize = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const wasOpen = assistantOpen;
    const remembered = assistantHeight;
    const startHeight = wasOpen ? remembered : 44;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let moved = false;
    let lastHeight = startHeight;
    const maximum = Math.max(180, Math.min(440, (canvasShellRef.current?.getBoundingClientRect().height ?? 720) * 0.54));
    const splitter = event.currentTarget;
    const oldCursor = document.body.style.cursor;
    const oldSelect = document.body.style.userSelect;
    splitter?.classList?.add("is-dragging");
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const onMove = (moveEvent) => {
      if (pointerId !== undefined && moveEvent.pointerId !== undefined && moveEvent.pointerId !== pointerId) return;
      const delta = startY - moveEvent.clientY;
      if (Math.abs(delta) > 3) moved = true;
      lastHeight = Math.max(44, Math.min(maximum, startHeight + delta));
      if (lastHeight >= ASSISTANT_COLLAPSE_THRESHOLD) setAssistantOpen(true);
      setAssistantHeight(lastHeight);
    };
    const onUp = (upEvent) => {
      if (pointerId !== undefined && upEvent.pointerId !== undefined && upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      splitter?.classList?.remove("is-dragging");
      document.body.style.cursor = oldCursor;
      document.body.style.userSelect = oldSelect;
      assistantDragRef.current = null;
      if (!moved && !wasOpen) {
        setAssistantHeight(Math.max(ASSISTANT_COLLAPSE_THRESHOLD, remembered || ASSISTANT_DEFAULT));
        setAssistantOpen(true);
      } else if (lastHeight < ASSISTANT_COLLAPSE_THRESHOLD) {
        setAssistantHeight(Math.max(ASSISTANT_COLLAPSE_THRESHOLD, remembered || ASSISTANT_DEFAULT));
        setAssistantOpen(false);
      } else {
        setAssistantHeight(lastHeight);
        setAssistantOpen(true);
      }
      window.setTimeout(() => fitWholeFlow(180), 0);
    };
    assistantDragRef.current = { onMove, onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [assistantHeight, assistantOpen, fitWholeFlow]);

  const showFlow = useCallback((flow, options = {}) => {
    if (!flow) return;
    persistedRevisionRef.current.set(flow.id, Number(flow.revision) || 0);
    persistedFlowRef.current = flow;
    setPersistedTopologySignature(topologySignature(flow));
    currentIdRef.current = flow.id;
    setCurrentId(flow.id);
    setNodes(flowToCanvasNodes(flow, loadPositionOverrides(flow.id)));
    setEdges(flowToCanvasEdges(flow.edges, t));
    historyRef.current = { past: [], future: [] };
    setSelectedEdge(null);
    setValidationResult(null);
    setFindingFilter(null);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setWorkflowOptimizeConfirm(false);
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(false);
    if (options.resetDocument !== false) {
      setSelected(null);
      setActiveDoc("workflow");
    }
  }, [setEdges, setNodes, t]);

  const loadFlows = useCallback(async () => {
    try {
      const items = await remoteCall(connection, "dflow/list", { sessionId });
      setFlows(items);
      const first = items.find((item) => item.id === currentIdRef.current) ?? items[0];
      if (first) {
        showFlow(first, { resetDocument: currentIdRef.current !== first.id });
      } else {
        currentIdRef.current = null;
        persistedFlowRef.current = null;
        setPersistedTopologySignature("");
        setCurrentId(null);
        setNodes([]);
        setEdges([]);
      }
      setDirty(false);
      setMessage(t.ready);
    } catch (error) {
      setMessage(String(error));
    }
  }, [connection, sessionId, setEdges, setNodes, showFlow, t.ready]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await remoteCall(connection, "dflow/models");
        if (!cancelled) setAssistModelOptions(Array.isArray(models) ? models : []);
      } catch {
        if (!cancelled) setAssistModelOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    // 需求 1：从 Host 恢复本 Session 的 assist 结果（切视图/卸载后回来，方案和校验结果不丢）。
    let cancelled = false;
    (async () => {
      try {
        const history = await remoteCall(connection, "dflow/assistHistory", { sessionId });
        if (cancelled || !Array.isArray(history)) return;
        for (const entry of history) {
          if (entry.mode === "optimize" && entry.target && !proposalStoreRef.current.has(entry.target)) {
            if (entry.status === "done" && entry.result) {
              proposalStoreRef.current.set(entry.target, { ...entry.result, target: entry.target });
            } else if (entry.status === "error") {
              proposalStoreRef.current.set(entry.target, { status: "error", target: entry.target, error: entry.error ?? "failed" });
            } else if (entry.status === "running") {
              // 仍在运行：继续轮询直到完成（切视图后回来不用手动刷新）
              const target = entry.target;
              const requestId = entry.key.split(":").pop();
              setRunningDocs((prev) => { const next = new Map(prev); next.set(target, requestId); return next; });
              pollAssist(requestId, (finalEntry) => {
                if (finalEntry.status === "cancelled") {
                  if (assistantTargetRef.current === target) setMessage(t.assistantCancelled);
                } else if (finalEntry.status === "done" && finalEntry.result) {
                  const proposal = { ...finalEntry.result, target: finalEntry.result.target ?? target, documentLabel: assistantDocLabel };
                  proposalStoreRef.current.set(target, proposal);
                  if (assistantTargetRef.current === target) {
                    setOptimizationProposal(proposal);
                    setAssistantDraft(proposal.suggestedContent ?? "");
                  }
                } else {
                  proposalStoreRef.current.set(target, { status: "error", target, error: String(finalEntry.error ?? "failed") });
                  if (assistantTargetRef.current === target) setMessage(t.assistantFailed + String(finalEntry.error ?? ""));
                }
                setRunningDocs((prev) => { const next = new Map(prev); next.delete(target); return next; });
                activeAssistRef.current = null;
              });
            }
          } else if (entry.mode === "logic" && entry.status === "done" && entry.result) {
            setValidationResult(entry.result);
          } else if (entry.mode === "logic" && entry.status === "running") {
            // 逻辑校验仍在运行：继续轮询直到完成（切 UI 回来不用重新发起）
            const requestId = entry.key.split(":").pop();
            setAssistantBusy("logic");
            pollAssist(requestId, (finalEntry) => {
              if (finalEntry.status === "cancelled") {
                setMessage(t.assistantCancelled);
              } else if (finalEntry.status === "done" && finalEntry.result) {
                setValidationResult(finalEntry.result);
                setFindingFilter(null);
                setMessage(t.validationComplete);
              } else {
                setMessage(t.assistantFailed + String(finalEntry.error ?? ""));
              }
              activeAssistRef.current = null;
              setAssistantBusy(null);
            });
          } else if (entry.mode === "topology-apply" && entry.status === "running") {
            const requestId = entry.key.split(":").pop();
            setTopologyApplyBusy(true);
            setMessage(t.topologyApplying);
            topologyPollRef.current?.();
            topologyPollRef.current = pollAssist(requestId, (finalEntry) => {
              topologyPollRef.current = null;
              setTopologyApplyBusy(false);
              if (finalEntry.status === "done" && finalEntry.result?.flow) {
                showFlow(finalEntry.result.flow, { resetDocument: false });
                setDirty(false);
                setMessage(finalEntry.result.summary ? `${t.topologyApplied}：${finalEntry.result.summary}` : t.topologyApplied);
              } else {
                setMessage(t.topologyApplyFailed + String(finalEntry.error ?? ""));
              }
            });
          } else if (entry.mode === "topology-apply" && entry.status === "done" && entry.result?.flow) {
            const knownRevision = persistedRevisionRef.current.get(entry.result.flow.id) ?? 0;
            if (Number(entry.result.flow.revision) > knownRevision) {
              showFlow(entry.result.flow, { resetDocument: false });
              setDirty(false);
            }
          } else if (entry.mode === "optimize-workflow" && entry.status === "running") {
            // 整体优化仍在运行：恢复运行态并继续轮询（切屏/切 Session 不丢任务）。
            const requestId = entry.key.split(":").pop();
            setAssistantBusy("optimize-workflow");
            setAssistantOpen(true);
            setOptimizationProposal(null);
            setAssistantDraft("");
            pollTimerRef.current?.();
            pollTimerRef.current = pollAssist(requestId, (finalEntry) => applyWorkflowOptimization(finalEntry, {
              requestId,
              flow: null,
              requireUnchangedRevision: false
            }));
          } else if (entry.mode === "optimize-workflow" && entry.status === "done" && entry.result) {
            // 离开期间已完成：回来后应用（requestId 去重，避免每次挂载重复应用）。
            const requestId = entry.key.split(":").pop();
            applyWorkflowOptimization(entry, { requestId, flow: null, requireUnchangedRevision: false });
          }
        }
        const proposal = proposalStoreRef.current.get(assistantTargetRef.current);
        if (proposal && typeof proposal.suggestedContent === "string") {
          setOptimizationProposal(proposal);
          setAssistantDraft(proposal.suggestedContent);
        }
      } catch {
        // 历史恢复失败不阻塞编辑器。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, sessionId]);

  useEffect(() => {
    const element = studioRef.current;
    if (!element) return undefined;
    const update = () => setStudioWidth(Math.max(320, element.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => keepLayout("deepseek-flow:left-open", documentsOpen), [documentsOpen]);
  useEffect(() => keepLayout("deepseek-flow:right-open", inspectorOpen), [inspectorOpen]);
  useEffect(() => keepLayout("deepseek-flow:left-width", Math.round(documentWidth)), [documentWidth]);
  useEffect(() => keepLayout("deepseek-flow:right-width", Math.round(inspectorWidth)), [inspectorWidth]);
  useEffect(() => keepLayout("deepseek-flow:assistant-open", assistantOpen), [assistantOpen]);
  useEffect(() => keepLayout("deepseek-flow:assistant-height", Math.round(assistantHeight)), [assistantHeight]);

  useEffect(() => () => {
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    if (pollTimerRef.current) pollTimerRef.current();
    if (topologyPollRef.current) topologyPollRef.current();
    if (panelDragRef.current) {
      window.removeEventListener("pointermove", panelDragRef.current.onMove);
      window.removeEventListener("pointerup", panelDragRef.current.onUp);
    }
    if (assistantDragRef.current) {
      window.removeEventListener("pointermove", assistantDragRef.current.onMove);
      window.removeEventListener("pointerup", assistantDragRef.current.onUp);
    }
    const activeAssist = activeAssistRef.current;
    if (activeAssist) {
      // 需求 1：切换视图不中断后台请求——不再主动 cancel；Host 侧会暂存结果，
      // 重新挂载时通过 dflow/assistHistory 恢复。
      activeAssistRef.current = null;
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [connection, sessionId]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    if (!flowInstance || !currentId || nodes.length === 0) return undefined;
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      fitTimerRef.current = null;
      flowInstance.fitView({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration: 320 });
    }, 600);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [currentId, flowInstance, nodes.length]);

  const selectFlow = async (id) => {
    if (id === currentId) return;
    if (dirty || documentTimerRef.current) {
      const saved = await save();
      if (!saved) return;
    }
    const flow = flows.find((f) => f.id === id);
    if (!flow) return;
    showFlow(flow);
    setDirty(false);
  };

  const currentFlow = flows.find((f) => f.id === currentId) ?? null;
  const currentDraftFlow = currentFlow ? serializeFlow(currentFlow, nodes, edges) : null;
  const currentTopologySignature = currentDraftFlow ? topologySignature(currentDraftFlow) : "";
  const topologyDirty = Boolean(currentDraftFlow && currentTopologySignature !== persistedTopologySignature);
  const topologyDelta = currentDraftFlow
    ? topologyDiff(persistedFlowRef.current ?? {
        ...currentDraftFlow,
        nodes: [],
        edges: [],
        inputs: [],
        outputs: []
      }, currentDraftFlow)
    : null;
  const selectedNode = nodes.find((n) => n.id === selected) ?? null;

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    const refreshPersistedFlow = async () => {
      if (refreshing || topologyApplyBusy || documentTimerRef.current) return;
      const flowId = currentIdRef.current;
      const baseFlow = persistedFlowRef.current;
      if (!flowId || !baseFlow) return;
      refreshing = true;
      try {
        const items = await remoteCall(connection, "dflow/list", { sessionId });
        if (cancelled || !Array.isArray(items)) return;
        const remoteFlow = items.find((item) => item.id === flowId);
        if (!remoteFlow) return;
        const knownRevision = persistedRevisionRef.current.get(flowId) ?? 0;
        if ((Number(remoteFlow.revision) || 0) <= knownRevision) return;
        const draftFlow = serializeFlow(baseFlow, nodesRef.current, edgesRef.current);
        const decision = topologySyncDecision(baseFlow, draftFlow, remoteFlow);
        if (decision === "conflict") {
          setMessage(t.topologySessionConflict);
          return;
        }
        setFlows(items);
        if (decision === "documents-only") {
          persistedFlowRef.current = remoteFlow;
          persistedRevisionRef.current.set(flowId, Number(remoteFlow.revision) || 0);
          setPersistedTopologySignature(topologySignature(remoteFlow));
          return;
        }
        showFlow(remoteFlow, { resetDocument: false });
        setDirty(false);
        setMessage(decision === "already-persisted" ? t.topologyAlreadyPersisted : t.topologySessionSynced);
      } catch {
        // Background synchronization is opportunistic; normal load/apply paths
        // keep their explicit error handling.
      } finally {
        refreshing = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPersistedFlow();
    };
    const timer = window.setInterval(refreshPersistedFlow, 5000);
    window.addEventListener("focus", refreshPersistedFlow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshPersistedFlow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connection, sessionId, showFlow, t.topologyAlreadyPersisted, t.topologySessionConflict, t.topologySessionSynced, topologyApplyBusy]);

  const selectedConditionInputs = selectedNode?.data?.kind === "condition"
    ? edges
        .filter((edge) => edge.target === selectedNode.id)
        .map((edge) => {
          const source = nodes.find((node) => node.id === edge.source);
          return { edgeId: edge.id, sourceId: edge.source, label: source?.data?.label ?? edge.source };
        })
    : [];
  const selectedGateRule = selectedNode?.data?.kind === "condition"
    ? gateRule(selectedNode.data.gateType)
    : null;
  const selectedGateArityValid = !selectedGateRule
    || (selectedConditionInputs.length >= selectedGateRule.minInputs
      && selectedConditionInputs.length <= selectedGateRule.maxInputs);

  const persistDocumentSnapshot = useCallback(async (flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return null;
    let editorFlow;
    const operation = documentWriteChainRef.current.catch(() => {}).then(async () => {
      const persisted = persistedFlowRef.current;
      if (!persisted || persisted.id !== flowSnapshot.id) return null;
      editorFlow = serializeFlow(flowSnapshot, nodeSnapshot, edgeSnapshot);
      const documentOnly = mergeDocumentEdits(persisted, editorFlow, nodeSnapshot);
      const persistedRevision = persistedRevisionRef.current.get(documentOnly.id);
      const payload = Number.isInteger(persistedRevision)
        ? { ...documentOnly, revision: persistedRevision }
        : documentOnly;
      return remoteCall(connection, "dflow/put", { flow: payload, sessionId });
    });
    documentWriteChainRef.current = operation.then(() => undefined, () => undefined);
    const saved = await operation;
    if (!saved) return null;
    persistedFlowRef.current = saved;
    persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
    setPersistedTopologySignature(topologySignature(saved));
    setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
    setDirty(topologySignature(editorFlow) !== topologySignature(saved));
    return saved;
  }, [connection, sessionId]);

  const scheduleDocumentSave = useCallback((flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return;
    if (!persistedFlowRef.current || persistedFlowRef.current.id !== flowSnapshot.id) {
      setMessage(t.topologyApplyFirst);
      return;
    }
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    const editRevision = ++documentRevisionRef.current;
    setMessage(t.autoSaving);
    documentTimerRef.current = setTimeout(() => {
      documentTimerRef.current = null;
      persistDocumentSnapshot(flowSnapshot, nodeSnapshot, edgeSnapshot).then(() => {
        if (documentRevisionRef.current === editRevision) setMessage(t.autoSaved);
      }).catch((error) => {
        if (documentRevisionRef.current === editRevision) setMessage(String(error));
      });
    }, 650);
  }, [persistDocumentSnapshot, t.autoSaved, t.autoSaving, t.topologyApplyFirst]);

  const rememberGraph = useCallback(() => {
    const snapshot = graphSnapshot(nodesRef.current, edgesRef.current);
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) {
      history.past.push(snapshot);
      if (history.past.length > 60) history.past.shift();
    }
    history.future = [];
  }, []);

  const restoreGraph = useCallback((snapshot) => {
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    if (selected && !snapshot.nodes.some((node) => node.id === selected)) {
      setSelected(null);
      setActiveDoc("workflow");
    }
    if (selectedEdge && !snapshot.edges.some((edge) => edge.id === selectedEdge)) setSelectedEdge(null);
    ++documentRevisionRef.current;
    setDirty(true);
  }, [selected, selectedEdge, setEdges, setNodes]);

  const undoGraph = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(graphSnapshot(nodesRef.current, edgesRef.current));
    restoreGraph(previous);
  }, [restoreGraph]);

  const redoGraph = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(graphSnapshot(nodesRef.current, edgesRef.current));
    restoreGraph(next);
  }, [restoreGraph]);

  const showConnectionWarning = useCallback((problem) => {
    const warning = typeof problem === "string" ? problem : connectionProblemMessage(problem, t);
    setMessage(warning || t.invalidConnection);
    setConnectionWarning(warning || t.invalidConnection);
  }, [t]);

  const commitConnection = useCallback((conn, requestedBranch = null) => {
    const problem = connectionProblem(nodesRef.current, edgesRef.current, conn, requestedBranch);
    if (!problem.valid) {
      showConnectionWarning(problem);
      return false;
    }
    const sourceNode = nodesRef.current.find((node) => node.id === conn.source);
    const condition = sourceNode?.data?.kind === "condition";
    const branch = condition ? problem.branch : null;
    const edge = {
      ...conn,
      id: `e-${Math.random().toString(36).slice(2, 9)}`,
      type: "workflow",
      ...(condition ? {
        sourceHandle: branch,
        label: branchDisplayLabel(branch, t),
        autoLogicLabel: true
      } : {})
    };
    rememberGraph();
    const nextEdges = [...edgesRef.current, edge];
    edgesRef.current = nextEdges;
    setEdges(nextEdges);
    ++documentRevisionRef.current;
    setDirty(true);
    return true;
  }, [rememberGraph, setEdges, showConnectionWarning, t]);

  const onConnect = useCallback((conn) => {
    const problem = connectionProblem(nodesRef.current, edgesRef.current, conn);
    if (!problem.valid) {
      showConnectionWarning(problem);
      return;
    }
    const sourceNode = nodesRef.current.find((node) => node.id === conn.source);
    if (sourceNode?.data?.kind !== "condition") {
      commitConnection(conn);
      return;
    }
    const gateType = conditionGateType(sourceNode, edgesRef.current.filter((edge) => edge.source === conn.source));
    if (gateType === "ifElse") {
      setPendingConnection({ connection: conn, available: problem.available ?? [] });
      return;
    }
    commitConnection(conn, gateType);
  }, [commitConnection, showConnectionWarning]);

  const onConnectionRejected = useCallback((conn) => {
    showConnectionWarning(connectionProblem(nodesRef.current, edgesRef.current, conn));
  }, [showConnectionWarning]);

  const onReconnect = useCallback((oldEdge, connectionParams) => {
    rememberGraph();
    setEdges((items) => reconnectFlowEdge(oldEdge, connectionParams, items).map((edge) => edge.id === oldEdge.id
      ? {
          ...edge,
          label: branchDisplayLabel(gateBranchForEdge(connectionParams), t),
          autoLogicLabel: true
        }
      : edge));
    ++documentRevisionRef.current;
    setDirty(true);
  }, [rememberGraph, setEdges, t]);

  const isValidConnection = useCallback((connectionParams) => {
    return connectionProblem(nodesRef.current, edgesRef.current, connectionParams).valid;
  }, []);

  const moveNode = useCallback((id, position) => {
    setNodes((items) => items.map((node) => node.id === id ? { ...node, position } : node));
    // 位置是查看状态（与面板宽度同级），随移动静默持久化，不参与拓扑事务。
    try {
      const key = `deepseek-flow:positions:${currentId}`;
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      stored[id] = position;
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // 存储不可用时忽略
    }
    ++documentRevisionRef.current;
    setDirty(true);
  }, []);

  const createNode = (kind, gateType = null) => {
    rememberGraph();
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node = {
      id,
      type: "flow",
      position: { x: 120 + Math.random() * 220, y: 80 + Math.random() * 160 },
      data: {
        kind,
        label: t.nodeKind[kind] ?? kind,
        ...(kind === "condition" ? { gateType: normalizeGateType(gateType) } : {}),
        ...(kind === "agent" || kind === "mapAgent" ? { prompt: "{{input}}" } : {})
      }
    };
    const nextNodes = [...nodesRef.current, node];
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    setSelected(id);
    setSelectedEdge(null);
    setActiveDoc(id);
    ++documentRevisionRef.current;
    setDirty(true);
  };

  const addNode = (kind) => {
    if (kind === "condition") {
      setGatePickerOpen(true);
      return;
    }
    createNode(kind);
  };

  const patchSelected = (patch) => {
    const nextNodes = nodes.map((node) => node.id === selected ? { ...node, data: { ...node.data, ...patch } } : node);
    setNodes(nextNodes);
    nodesRef.current = nextNodes;
    setDirty(true);
    const topologyKeys = ["label", "gateType", "predicate", "inputPredicates", "order"];
    if (Object.keys(patch).some((key) => topologyKeys.includes(key))) {
      ++documentRevisionRef.current;
    } else {
      scheduleDocumentSave(currentFlow, nextNodes, edges);
    }
  };

  const patchGateType = (gateType) => {
    if (!selectedNode || selectedNode.data.kind !== "condition") return;
    if (edgesRef.current.some((edge) => edge.source === selectedNode.id)) {
      showConnectionWarning(t.gateChangeBlocked);
      return;
    }
    patchSelected({ gateType: normalizeGateType(gateType) });
  };

  // 文档驱动：把选中节点绑定到 docRoot 下的 MD 文件（空值解除绑定）。
  const patchDoc = (rel) => {
    if (!currentFlow || !selected) return;
    const docs = { ...(currentFlow.docs ?? {}) };
    if (rel && rel.trim()) docs[selected] = rel.trim();
    else delete docs[selected];
    const nextFlow = { ...currentFlow, docs };
    setFlows((items) => items.map((flow) => flow.id === currentId ? nextFlow : flow));
    setNodes((items) => items.map((node) => node.id === selected ? { ...node, data: { ...node.data, docPath: docs[selected] ?? "" } } : node));
    setDirty(true);
    scheduleDocumentSave(nextFlow, nodes.map((node) => node.id === selected ? { ...node, data: { ...node.data, docPath: docs[selected] ?? "" } } : node), edges);
  };

  const patchWorkflowContent = (value) => {
    if (!currentFlow) return;
    const nextFlow = { ...currentFlow, workflowContent: value };
    setFlows((items) => items.map((flow) => flow.id === currentId ? nextFlow : flow));
    setDirty(true);
    scheduleDocumentSave(nextFlow, nodes, edges);
  };

  const removeSelected = () => {
    if (selected === null) return;
    rememberGraph();
    setNodes((nds) => nds.filter((n) => n.id !== selected));
    setEdges((eds) => eds.filter((e) => e.source !== selected && e.target !== selected));
    setFlows((items) => items.map((flow) => {
      if (flow.id !== currentId) return flow;
      const docs = { ...(flow.docs ?? {}) };
      delete docs[selected];
      return { ...flow, docs };
    }));
    setSelected(null);
    setActiveDoc("workflow");
    ++documentRevisionRef.current;
    setDirty(true);
  };

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    rememberGraph();
    setEdges((items) => items.filter((edge) => edge.id !== selectedEdge));
    setSelectedEdge(null);
    ++documentRevisionRef.current;
    setDirty(true);
  }, [rememberGraph, selectedEdge, setEdges]);

  const tidyGraph = useCallback(() => {
    if (nodesRef.current.length === 0) return;
    rememberGraph();
    const next = layoutNodes(nodesRef.current, edgesRef.current);
    setNodes(next);
    nodesRef.current = next;
    ++documentRevisionRef.current;
    setDirty(true);
    setTimeout(() => flowInstance?.fitView?.({ padding: 0.2, duration: 250 }), 0);
  }, [flowInstance, rememberGraph, setNodes]);

  const save = async () => {
    if (currentId === null) return false;
    if (topologyDirty || !persistedFlowRef.current) {
      setTopologyApplyConfirm(true);
      setMessage(t.topologyPending);
      return false;
    }
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    documentTimerRef.current = null;
    ++documentRevisionRef.current;
    setMessage(t.saving);
    try {
      await persistDocumentSnapshot(currentFlow, nodes, edges);
      setDirty(false);
      setMessage(t.saved);
      return true;
    } catch (error) {
      setMessage(String(error));
      return false;
    }
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const flow = JSON.parse(await file.text());
      if (!flow.id || !Array.isArray(flow.nodes)) throw new Error("missing id/nodes");
      const existing = flows.find((candidate) => candidate.id === flow.id) ?? null;
      currentIdRef.current = flow.id;
      setCurrentId(flow.id);
      setFlows((fs) => [flow, ...fs.filter((f) => f.id !== flow.id)]);
      persistedFlowRef.current = existing;
      if (existing) persistedRevisionRef.current.set(flow.id, Number(existing.revision) || 0);
      else persistedRevisionRef.current.delete(flow.id);
      setPersistedTopologySignature(topologySignature(existing ?? {
        ...flow,
        nodes: [],
        edges: [],
        inputs: [],
        outputs: []
      }));
      setNodes(flowToCanvasNodes(flow, loadPositionOverrides(flow.id)));
      setEdges(flowToCanvasEdges(flow.edges, t));
      setSelected(null);
      setActiveDoc("workflow");
      setDirty(true);
      setTopologyApplyConfirm(false);
      setMessage(t.importOk + flow.name);
    } catch (error) {
      setMessage(t.invalidJson + String(error));
    }
    event.target.value = "";
  };

  const exportJson = () => {
    if (currentId === null || currentFlow === null) return;
    const flow = serializeFlow(currentFlow, nodes, edges);
    download(JSON.stringify(flow, null, 2), `${flow.id}.json`, "application/json");
    setMessage(t.exportOk);
  };

  const assistantTarget = activeDoc === "workflow" ? "workflow" : activeDoc;
  const assistantDocLabel = assistantTarget === "workflow"
    ? (currentFlow?.workflowDoc ?? "WORKFLOW.md")
    : (currentFlow?.docs?.[assistantTarget] ?? `${assistantTarget}/STEP.md`);
  const assistantTargetRef = React.useRef(assistantTarget);
  useEffect(() => {
    assistantTargetRef.current = assistantTarget;
  }, [assistantTarget]);

  useEffect(() => {
    // 需求 6：切换文档时恢复该文档自己的方案槽（不存在则清空显示）。
    const proposal = proposalStoreRef.current.get(assistantTarget);
    if (proposal && typeof proposal.suggestedContent === "string") {
      setOptimizationProposal(proposal);
      setAssistantDraft(proposal.suggestedContent);
    } else {
      setOptimizationProposal(null);
      setAssistantDraft("");
    }
  }, [currentId, assistantTarget]);

  const contentForDocument = (target) => {
    if (target === "workflow") return String(currentFlow?.workflowContent ?? "");
    const node = nodes.find((candidate) => candidate.id === target);
    return String(node?.data?.prompt ?? node?.data?.instructions ?? "");
  };

  // 轮询 Host 侧 assist 结果（fire-and-forget 模式：请求在 Host 独立执行，Client 断开不影响）。
  const pollAssist = (agentRequestId, onDone) => {
    const timer = setInterval(async () => {
      try {
        const history = await remoteCall(connection, "dflow/assistHistory", { sessionId });
        const entry = (Array.isArray(history) ? history : []).find((item) => item.key === `${sessionId}:${agentRequestId}`);
        if (!entry || entry.status === "running") return;
        clearInterval(timer);
        onDone(entry);
      } catch {
        // 轮询偶发失败下一轮重试
      }
    }, 3000);
    return () => clearInterval(timer);
  };

  const applyTopologyChanges = async () => {
    if (!currentFlow || !currentDraftFlow || topologyApplyBusy) return;
    setTopologyApplyConfirm(false);
    setTopologyApplyBusy(true);
    setMessage(t.topologyApplying);
    const requestId = newRequestId();
    try {
      // Reconcile a main-Session write before touching Markdown or opening an
      // Agent review. This also closes the short window before background sync.
      const latestItems = await remoteCall(connection, "dflow/list", { sessionId });
      const latestFlow = (Array.isArray(latestItems) ? latestItems : []).find((item) => item.id === currentFlow.id);
      const localBase = persistedFlowRef.current;
      if (latestFlow && localBase && (Number(latestFlow.revision) || 0) > (persistedRevisionRef.current.get(currentFlow.id) ?? 0)) {
        const liveDraft = serializeFlow(localBase, nodesRef.current, edgesRef.current);
        const decision = topologySyncDecision(localBase, liveDraft, latestFlow);
        if (decision === "conflict") throw new Error(t.topologySessionConflict);
        setFlows(latestItems);
        if (decision === "already-persisted" || decision === "remote-advanced-clean") {
          showFlow(latestFlow, { resetDocument: false });
          setTopologyApplyBusy(false);
          setDirty(false);
          setMessage(decision === "already-persisted" ? t.topologyAlreadyPersisted : t.topologySessionSynced);
          return;
        }
        persistedFlowRef.current = latestFlow;
        persistedRevisionRef.current.set(latestFlow.id, Number(latestFlow.revision) || 0);
        setPersistedTopologySignature(topologySignature(latestFlow));
      }
      if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
      documentTimerRef.current = null;
      // Commit only existing Markdown first. Its payload is merged onto the
      // persisted graph, so this cannot smuggle the topology draft past review.
      if (persistedFlowRef.current) {
        await persistDocumentSnapshot(currentFlow, nodes, edges);
      } else {
        await documentWriteChainRef.current.catch(() => {});
      }
      const draftFlow = serializeFlow(currentFlow, nodesRef.current, edgesRef.current);
      const submittedSignature = topologySignature(draftFlow);
      const baseFlow = persistedFlowRef.current ?? {
        ...draftFlow,
        nodes: [],
        edges: [],
        inputs: [],
        outputs: []
      };
      const accepted = await remoteCall(connection, "dflow/topologyApply", {
        request: {
          sessionId,
          requestId,
          draftFlow,
          baseTopology: topologyProjection(baseFlow),
          ...(assistModel ? { model: assistModel } : {}),
          ...(assistEffort ? { reasoningEffort: assistEffort } : {})
        }
      });
      if (!accepted?.accepted) {
        setTopologyApplyBusy(false);
        if (accepted?.flow) {
          const saved = accepted.flow;
          setFlows((items) => items.some((item) => item.id === saved.id)
            ? items.map((item) => item.id === saved.id ? { ...item, ...saved } : item)
            : [saved, ...items]);
          showFlow(saved, { resetDocument: false });
        }
        setDirty(false);
        setMessage(accepted?.alreadyPersisted ? t.topologyAlreadyPersisted : t.topologyNoChanges);
        return;
      }
      topologyPollRef.current?.();
      topologyPollRef.current = pollAssist(requestId, (entry) => {
        topologyPollRef.current = null;
        setTopologyApplyBusy(false);
        if (entry.status !== "done" || !entry.result?.flow) {
          setMessage(t.topologyApplyFailed + String(entry.error ?? ""));
          return;
        }
        const saved = entry.result.flow;
        persistedFlowRef.current = saved;
        persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
        setPersistedTopologySignature(topologySignature(saved));
        setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
        const liveFlow = serializeFlow(
          currentIdRef.current === saved.id ? (flows.find((item) => item.id === saved.id) ?? saved) : saved,
          nodesRef.current,
          edgesRef.current
        );
        if (currentIdRef.current === saved.id && topologySignature(liveFlow) === submittedSignature) {
          showFlow(saved, { resetDocument: false });
          setDirty(false);
          setMessage(entry.result.summary ? `${t.topologyApplied}：${entry.result.summary}` : t.topologyApplied);
        } else if (currentIdRef.current === saved.id) {
          setDirty(true);
          setMessage(t.topologyAppliedWithNewDraft);
        }
      });
    } catch (error) {
      setTopologyApplyBusy(false);
      setMessage(t.topologyApplyFailed + String(error));
    }
  };

  const runLogicValidation = async () => {
    if (!currentFlow) return;
    const requestId = newRequestId();
    const flow = serializeFlow(currentFlow, nodes, edges);
    const flowId = flow.id;
    activeAssistRef.current = { requestId, mode: "logic", cancelled: false };
    setAssistantOpen(true);
    setAssistantBusy("logic");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: { sessionId, requestId, flow, mode: "logic", ...(assistModel ? { model: assistModel } : {}), ...(assistEffort ? { reasoningEffort: assistEffort } : {}) }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      pollTimerRef.current?.();
      pollTimerRef.current = pollAssist(requestId, (entry) => {
        if (entry.status === "cancelled") {
          setMessage(t.assistantCancelled);
        } else if (entry.status === "done" && entry.result) {
          setValidationResult(entry.result);
          setFindingFilter(null);
          setMessage(t.validationComplete);
        } else {
          setMessage(t.assistantFailed + String(entry.error ?? ""));
        }
        activeAssistRef.current = null;
        setAssistantBusy(null);
      });
    } catch (error) {
      if (activeAssistRef.current?.requestId === requestId) {
        activeAssistRef.current = null;
        setAssistantBusy(null);
        setMessage(t.assistantFailed + String(error));
      }
    }
  };

  const runDocumentOptimization = async () => {
    if (!currentFlow) return;
    const requestId = ++optimizationRequestRef.current;
    const agentRequestId = newRequestId();
    const target = assistantTarget;
    const documentLabel = assistantDocLabel;
    const flow = serializeFlow(currentFlow, nodes, edges);
    const flowId = flow.id;
    activeAssistRef.current = { requestId: agentRequestId, mode: "optimize", cancelled: false };
    setAssistantOpen(true);
    setRunningDocs((prev) => { const next = new Map(prev); next.set(target, agentRequestId); return next; });
    setAssistantDraft("");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: { sessionId, requestId: agentRequestId, flow, mode: "optimize", target, instruction: assistantInstruction, ...(assistModel ? { model: assistModel } : {}), ...(assistEffort ? { reasoningEffort: assistEffort } : {}) }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      pollTimerRef.current?.();
      pollTimerRef.current = pollAssist(agentRequestId, (entry) => {
        if (entry.status === "cancelled") {
          if (assistantTargetRef.current === target) setMessage(t.assistantCancelled);
        } else if (entry.status === "done" && entry.result) {
          // 需求 6：按文档 id 存入独立方案槽；当前选中文档才立即显示，否则切回时再显示。
          const proposal = { ...entry.result, target: entry.result.target ?? target, documentLabel };
          proposalStoreRef.current.set(target, proposal);
          if (assistantTargetRef.current === target) {
            setOptimizationProposal(proposal);
            setAssistantDraft(proposal.suggestedContent ?? "");
          }
        } else {
          proposalStoreRef.current.set(target, { status: "error", target, documentLabel, error: String(entry.error ?? "failed") });
          if (assistantTargetRef.current === target) setMessage(t.assistantFailed + String(entry.error ?? ""));
        }
        setRunningDocs((prev) => { const next = new Map(prev); next.delete(target); return next; });
        activeAssistRef.current = null;
      });
    } catch (error) {
      if (activeAssistRef.current?.requestId === agentRequestId) {
        activeAssistRef.current = null;
        setAssistantBusy(null);
        setMessage(t.assistantFailed + String(error));
      }
    }
  };

  const waitForPersistedFlow = () => new Promise((resolve) => {
    if (persistedFlowRef.current) { resolve(persistedFlowRef.current); return; }
    let tries = 0;
    const timer = setInterval(() => {
      if (persistedFlowRef.current || ++tries > 50) {
        clearInterval(timer);
        resolve(persistedFlowRef.current);
      }
    }, 100);
  });

  const appliedWorkflowAssistRef = React.useRef(null);
  const isWorkflowAssistApplied = (requestId) => {
    if (!appliedWorkflowAssistRef.current) {
      try {
        appliedWorkflowAssistRef.current = new Set(JSON.parse(window.sessionStorage.getItem("deepseek-flow:applied-workflow-assists") ?? "[]"));
      } catch {
        appliedWorkflowAssistRef.current = new Set();
      }
    }
    return appliedWorkflowAssistRef.current.has(requestId);
  };
  const markWorkflowAssistApplied = (requestId) => {
    appliedWorkflowAssistRef.current ??= new Set();
    appliedWorkflowAssistRef.current.add(requestId);
    try {
      window.sessionStorage.setItem("deepseek-flow:applied-workflow-assists", JSON.stringify([...appliedWorkflowAssistRef.current]));
    } catch {
      // 会话存储不可用时仅失去切屏去重，不影响结果应用。
    }
  };

  const applyWorkflowOptimization = async (entry, { requestId, flow, sourceRevision, requireUnchangedRevision }) => {
    const stop = (message) => {
      if (message) setMessage(message);
      activeAssistRef.current = null;
      setAssistantBusy(null);
    };
    if (entry.status === "cancelled") return stop(t.assistantCancelled);
    if (entry.status !== "done" || !entry.result) return stop(t.assistantFailed + String(entry.error ?? ""));
    if (requestId && isWorkflowAssistApplied(requestId)) return;
    if (!flow) {
      flow = await waitForPersistedFlow();
      if (!flow) return stop(t.assistantFailed);
    }
    if (requireUnchangedRevision && documentRevisionRef.current !== sourceRevision) return stop(t.workflowChangedDuringOptimization);
    const result = entry.result;
    const optimized = new Map((result.documents ?? []).map((document) => [document.documentId, String(document.content ?? "")]));
    const optimizedFlow = {
      ...flow,
      workflowContent: optimized.get("workflow") ?? flow.workflowContent,
      nodes: flow.nodes.map((node) => {
        const content = optimized.get(node.id);
        if (content === undefined) return node;
        const key = node.kind === "agent" || node.kind === "mapAgent" ? "prompt" : "instructions";
        return { ...node, data: { ...node.data, [key]: content } };
      })
    };
    const flowId = flow.id;
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    documentTimerRef.current = null;
    ++documentRevisionRef.current;
    await documentWriteChainRef.current.catch(() => {});
    const documentOnly = mergeDocumentEdits(persistedFlowRef.current, optimizedFlow, optimizedFlow.nodes);
    const persistedRevision = persistedRevisionRef.current.get(documentOnly.id);
    const payload = Number.isInteger(persistedRevision)
      ? { ...documentOnly, revision: persistedRevision }
      : documentOnly;
    const saved = await remoteCall(connection, "dflow/put", { flow: payload, sessionId });
    persistedFlowRef.current = saved;
    persistedRevisionRef.current.set(saved.id, Number(saved.revision) || 0);
    setPersistedTopologySignature(topologySignature(saved));
    if (requestId) markWorkflowAssistApplied(requestId);
    if (currentIdRef.current !== flowId) return stop();
    setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
    if (topologySignature(optimizedFlow) === topologySignature(saved)) {
      showFlow(saved, { resetDocument: false });
      setDirty(false);
    } else {
      const draftNodes = flowToCanvasNodes({ ...optimizedFlow, docs: saved.docs });
      setNodes(draftNodes);
      nodesRef.current = draftNodes;
      setDirty(true);
    }
    stop(result.summary ? `${t.workflowOptimized}：${result.summary}` : t.workflowOptimized);
  };

  const runWorkflowOptimization = async () => {
    if (!currentFlow) return;
    if (!persistedFlowRef.current) {
      setWorkflowOptimizeConfirm(false);
      setMessage(t.topologyApplyFirst);
      return;
    }
    setWorkflowOptimizeConfirm(false);
    const agentRequestId = newRequestId();
    const flow = serializeFlow(currentFlow, nodes, edges);
    const sourceRevision = documentRevisionRef.current;
    activeAssistRef.current = { requestId: agentRequestId, mode: "optimize-workflow", cancelled: false };
    setAssistantOpen(true);
    setAssistantBusy("optimize-workflow");
    setOptimizationProposal(null);
    setAssistantDraft("");
    try {
      const accepted = await remoteCall(connection, "dflow/assist", {
        request: {
          sessionId,
          requestId: agentRequestId,
          flow,
          mode: "optimize-workflow",
          instruction: assistantInstruction,
          ...(assistModel ? { model: assistModel } : {}),
          ...(assistEffort ? { reasoningEffort: assistEffort } : {})
        }
      });
      if (!accepted?.accepted) throw new Error("assist not accepted");
      pollTimerRef.current?.();
      pollTimerRef.current = pollAssist(agentRequestId, (entry) => applyWorkflowOptimization(entry, {
        requestId: agentRequestId,
        flow,
        sourceRevision,
        requireUnchangedRevision: true
      }));
    } catch (error) {
      if (activeAssistRef.current?.requestId === agentRequestId) {
        activeAssistRef.current = null;
        setAssistantBusy(null);
        setMessage(t.assistantFailed + String(error));
      }
    }
  };

  const cancelOptimizeFor = async (target) => {
    const requestId = runningDocs.get(target);
    if (!requestId) return;
    await remoteCall(connection, "dflow/assistCancel", {
      request: { sessionId, requestId }
    }).catch(() => {});
    setRunningDocs((prev) => { const next = new Map(prev); next.delete(target); return next; });
    setMessage(t.assistantCancelled);
  };

  const cancelAssistant = async () => {
    const active = activeAssistRef.current;
    if (!active) return;
    active.cancelled = true;
    setAssistantBusy("cancelling");
    setMessage(t.assistantCancelled);
    try {
      await remoteCall(connection, "dflow/assistCancel", {
        request: { sessionId, requestId: active.requestId }
      });
    } catch (error) {
      if (activeAssistRef.current?.requestId === active.requestId) setMessage(t.assistantFailed + String(error));
    }
  };

  const discardOptimization = () => {
    ++optimizationRequestRef.current;
    if (optimizationProposal?.target) proposalStoreRef.current.delete(optimizationProposal.target);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setMessage(t.discardedSuggestion);
  };

  const acceptOptimization = () => {
    const target = optimizationProposal?.target;
    if (!target || !assistantDraft || !currentFlow) return;
    if (contentForDocument(target) !== String(optimizationProposal.originalContent ?? "")) {
      setMessage(t.staleSuggestion);
      return;
    }
    if (target === "workflow") {
      patchWorkflowContent(assistantDraft);
    } else {
      const targetNode = nodes.find((node) => node.id === target);
      if (!targetNode) return;
      const key = targetNode.data.kind === "agent" || targetNode.data.kind === "mapAgent" ? "prompt" : "instructions";
      const nextNodes = nodes.map((node) => node.id === target ? { ...node, data: { ...node.data, [key]: assistantDraft } } : node);
      setNodes(nextNodes);
      setDirty(true);
      scheduleDocumentSave(currentFlow, nextNodes, edges);
    }
    ++optimizationRequestRef.current;
    proposalStoreRef.current.delete(target);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setMessage(t.acceptedSuggestion);
  };

  const focusFinding = (finding) => {
    const documentId = finding.documentId ?? finding.nodeId ?? "workflow";
    if (documentId === "workflow") setActiveDoc("workflow");
    else if (nodes.some((node) => node.id === documentId)) setActiveDoc(documentId);
    if (finding.nodeId && nodes.some((node) => node.id === finding.nodeId)) {
      setSelected(finding.nodeId);
      setSelectedEdge(null);
      flowInstance?.focusNode?.(finding.nodeId, { duration: 720 });
    } else if (finding.edgeId && edges.some((edge) => edge.id === finding.edgeId)) {
      setSelected(null);
      setSelectedEdge(finding.edgeId);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      const editingText = tag === "input" || tag === "textarea" || tag === "select" || event.target?.isContentEditable;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
        return;
      }
      if (!editingText && command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoGraph();
        else undoGraph();
        return;
      }
      if (!editingText && (event.key === "Delete" || event.key === "Backspace")) {
        if (selectedEdge) {
          event.preventDefault();
          removeSelectedEdge();
        } else if (selected) {
          event.preventDefault();
          removeSelected();
        }
        return;
      }
      if (!editingText && event.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoGraph, removeSelectedEdge, save, selected, selectedEdge, undoGraph]);

  const addBar = React.createElement("div", { className: "df-addbar" },
    React.createElement("span", { className: "df-node__kind", style: { alignSelf: "center", color: "var(--df-ink-2)" } }, t.addNode),
    ["input", "agent", "mapAgent", "condition", "merge", "output"].map((kind) =>
      React.createElement("button", { key: kind, className: "df-btn", onClick: () => addNode(kind) }, t.nodeKind[kind])
    ),
    React.createElement("span", { className: "df-connect-hint" }, t.connectHint)
  );

  const toolbar = React.createElement("div", { className: "df-toolbar" },
    React.createElement("label", null, t.flow,
      React.createElement("select", { value: currentId ?? "", onChange: (e) => selectFlow(e.target.value) },
        flows.map((f) => React.createElement("option", { key: f.id, value: f.id }, `${f.name}${f.sessionId ? "" : ` (${t.shared})`}`))
      )
    ),
    React.createElement("button", { className: "df-btn is-ghost", onClick: () => fileRef.current?.click() }, t.importLabel),
    React.createElement("input", { ref: fileRef, type: "file", accept: ".json,application/json", className: "df-import-hidden", onChange: onImportFile }),
    React.createElement("button", { className: "df-btn is-ghost", onClick: exportJson, disabled: currentId === null }, t.exportLabel),
    React.createElement("button", { className: "df-btn", onClick: save, disabled: currentId === null || !dirty }, t.save),
    React.createElement("button", { className: "df-btn df-iconbtn is-ghost", title: `${t.undo} · Ctrl/Cmd+Z`, "aria-label": t.undo, onClick: undoGraph }, "↶"),
    React.createElement("button", { className: "df-btn df-iconbtn is-ghost", title: `${t.redo} · Ctrl/Cmd+Shift+Z`, "aria-label": t.redo, onClick: redoGraph }, "↷"),
    React.createElement("button", { className: "df-btn is-ghost", title: t.tidy, onClick: tidyGraph, disabled: nodes.length === 0 }, t.tidy),
    React.createElement("button", { className: "df-btn is-ghost", title: t.fitAll, onClick: () => fitWholeFlow(240), disabled: nodes.length === 0 }, t.fitAll),
    React.createElement("span", { className: "df-status" }, message)
  );

  const chooseDocument = (id) => {
    setActiveDoc(id);
    setSelected(id === "workflow" ? null : id);
    setSelectedEdge(null);
    if (id === "workflow") flowInstance?.fitView?.({ padding: 0.18, duration: 680 });
    else flowInstance?.focusNode?.(id, { duration: 720 });
  };

  const documentRail = React.createElement("aside", { className: `df-docrail${documentsOpen ? "" : " is-collapsed"}` },
    React.createElement("div", { className: "df-docrail__head" },
      React.createElement("div", { className: "df-docrail__title" }, t.documents),
      React.createElement("div", { className: "df-docrail__note" }, t.documentFirstNote)
    ),
    documentsOpen && React.createElement("div", { className: "df-docrail__list" },
      React.createElement("div", { className: "df-docgroup" }, t.workflowDoc),
      React.createElement("button", {
        className: `df-docitem${activeDoc === "workflow" ? " is-active" : ""}`,
        onClick: () => chooseDocument("workflow")
      },
        React.createElement("span", { className: "df-docitem__icon" }, "MD"),
        React.createElement("span", null,
          React.createElement("span", { className: "df-docitem__label" }, currentFlow?.workflowDoc ?? "WORKFLOW.md"),
          React.createElement("span", { className: "df-docitem__path" }, currentFlow?.docRoot ?? t.none)
        )
      ),
      React.createElement("div", { className: "df-docgroup" }, t.stepDocs),
      nodes.map((node, index) => React.createElement("button", {
        key: node.id,
        className: `df-docitem${activeDoc === node.id ? " is-active" : ""}`,
        onClick: () => chooseDocument(node.id)
      },
        React.createElement("span", { className: "df-docitem__icon" }, String(index + 1).padStart(2, "0")),
        React.createElement("span", null,
          React.createElement("span", { className: "df-docitem__label" }, String(node.data.label ?? node.id)),
          React.createElement("span", { className: "df-docitem__path" }, currentFlow?.docs?.[node.id] ?? t.filePath)
        )
      ))
    )
  );

  const inspector = React.createElement("aside", { className: `df-inspector${inspectorOpen ? "" : " is-collapsed"}` },
    React.createElement("div", { className: "df-inspector__scroll" },
    activeDoc === "workflow" && currentFlow
      ? [
          React.createElement("h3", { key: "title" }, currentFlow.workflowDoc ?? "WORKFLOW.md"),
          React.createElement("div", { key: "badge", className: "df-node__kind", style: { color: "var(--df-brand)" } }, t.documentFirst),
          React.createElement("div", { key: "root", className: "df-pathbox" },
            React.createElement("span", { className: "df-pathbox__label" }, t.docRoot),
            React.createElement("span", { className: "df-pathbox__value" }, currentFlow.docRoot ?? t.none)
          ),
          React.createElement("label", { key: "content" }, t.markdownContent,
            React.createElement("textarea", {
              className: "df-markdown-editor",
              value: String(currentFlow.workflowContent ?? ""),
              onChange: (event) => patchWorkflowContent(event.target.value),
              spellCheck: false
            })
          )
        ]
      : selectedNode
      ? [
          React.createElement("h3", { key: "title" }, String(selectedNode.data.label ?? selectedNode.id)),
          React.createElement("div", { key: "path", className: "df-pathbox" },
            React.createElement("span", { className: "df-pathbox__label" }, t.filePath),
            React.createElement("span", { className: "df-pathbox__value" }, currentFlow?.docs?.[selected] ?? t.none)
          ),
          React.createElement("label", { key: "markdown" }, t.markdownContent,
            React.createElement("textarea", {
              className: "df-markdown-editor",
              value: String(selectedNode.data.prompt ?? selectedNode.data.instructions ?? ""),
              onChange: (event) => patchSelected(selectedNode.data.kind === "agent" || selectedNode.data.kind === "mapAgent"
                ? { prompt: event.target.value }
                : { instructions: event.target.value }),
              spellCheck: false
            })
          ),
          React.createElement("h3", { key: "properties", style: { marginTop: 4 } }, t.properties),
          React.createElement("label", { key: "kind" }, "kind",
            React.createElement("span", { style: { color: "var(--df-ink-2)", fontSize: 12 } }, t.nodeKind[selectedNode.data.kind] ?? selectedNode.data.kind)
          ),
          React.createElement("label", { key: "label" }, "label",
            React.createElement("input", { value: String(selectedNode.data.label ?? ""), onChange: (e) => patchSelected({ label: e.target.value }) })
          ),
          React.createElement("label", { key: "doc" }, t.docFile,
            React.createElement("input", { value: currentFlow?.docs?.[selected] ?? "", placeholder: "01-step/STEP.md", onChange: (e) => patchDoc(e.target.value) })
          ),
          selectedNode.data.kind === "condition" &&
            React.createElement("label", { key: "gateType" }, t.gateTypeLabel,
              React.createElement("select", {
                value: normalizeGateType(selectedNode.data.gateType),
                onChange: (event) => patchGateType(event.target.value)
              }, CONDITION_GATE_TYPES.map((gateType) => React.createElement("option", { key: gateType, value: gateType }, t.gateType[gateType])))
            ),
          selectedNode.data.kind === "condition" &&
            React.createElement("label", { key: "predicate" }, t.predicate,
              React.createElement("select", { value: selectedNode.data.predicate ?? "truthy", onChange: (e) => patchSelected({ predicate: e.target.value }) },
                LOGIC_PREDICATES.map((p) => React.createElement("option", { key: p, value: p }, p))
              )
            ),
          selectedNode.data.kind === "condition" &&
            React.createElement("div", { key: "logicInputs", className: "df-advanced__content" },
              React.createElement("strong", null, t.logicInputs),
              React.createElement("span", {
                style: { color: selectedGateArityValid ? "var(--df-ink-2)" : "var(--df-err)", fontSize: 12 }
              }, `${t.logicInputCount}: ${selectedConditionInputs.length} · ${selectedGateRule.maxInputs === 1 ? t.logicInputUnary : t.logicInputAggregate}`),
              selectedConditionInputs.length === 0
                ? React.createElement("span", { style: { color: "var(--df-ink-2)", fontSize: 12 } }, t.logicInputsEmpty)
                : selectedConditionInputs.map((input) => React.createElement("label", { key: input.edgeId }, `${input.label} · ${input.sourceId}`,
                    React.createElement("select", {
                      value: selectedNode.data.inputPredicates?.[input.sourceId] ?? selectedNode.data.predicate ?? "truthy",
                      onChange: (event) => patchSelected({
                        inputPredicates: {
                          ...(selectedNode.data.inputPredicates ?? {}),
                          [input.sourceId]: event.target.value
                        }
                      })
                    }, LOGIC_PREDICATES.map((predicate) => React.createElement("option", { key: predicate, value: predicate }, predicate)))
                  ))
            ),
          (selectedNode.data.kind === "agent" || selectedNode.data.kind === "mapAgent") &&
            React.createElement("details", { key: "advanced", className: "df-advanced" },
              React.createElement("summary", null, t.advancedHints),
              React.createElement("div", { className: "df-advanced__content" },
                React.createElement("label", null, t.stage,
                  React.createElement("input", { value: String(selectedNode.data.stage ?? ""), onChange: (e) => patchSelected({ stage: e.target.value }) })
                ),
                React.createElement("label", null, t.provider,
                  React.createElement("input", { value: String(selectedNode.data.provider ?? ""), onChange: (e) => patchSelected({ provider: e.target.value }) })
                ),
                React.createElement("label", null, t.model,
                  React.createElement("input", { value: String(selectedNode.data.model ?? ""), onChange: (e) => patchSelected({ model: e.target.value }) })
                ),
                React.createElement("label", null, t.outputSchema,
                  React.createElement("textarea", { value: selectedNode.data.outputSchema ? JSON.stringify(selectedNode.data.outputSchema) : "", onChange: (e) => {
                    const raw = e.target.value.trim();
                    try {
                      patchSelected({ outputSchema: raw ? JSON.parse(raw) : undefined });
                    } catch {
                      // 无效 JSON 暂不应用
                    }
                  } })
                )
              )
            ),
          React.createElement("button", { key: "del", className: "df-btn", style: { color: "var(--df-err)" }, onClick: removeSelected }, t.deleteNode)
        ]
      : [
          React.createElement("h3", { key: "title" }, t.properties),
          React.createElement("div", { key: "empty", className: "df-empty" }, t.openDocument)
        ]
    )
  );

  const findings = validationResult?.findings ?? [];
  const visibleFindings = findingFilter
    ? findings.filter((finding) => finding.level === findingFilter)
    : findings;
  const counts = validationResult?.summary?.counts ?? { error: 0, warning: 0 };
  const optimizationStale = Boolean(optimizationProposal
    && contentForDocument(optimizationProposal.target) !== String(optimizationProposal.originalContent ?? ""));
  const findingDocumentLabel = (finding) => {
    const documentId = finding.documentId ?? finding.nodeId ?? "workflow";
    return documentId === "workflow"
      ? (currentFlow?.workflowDoc ?? "WORKFLOW.md")
      : (currentFlow?.docs?.[documentId] ?? `${documentId}/STEP.md`);
  };
  const assistantPanel = React.createElement("section", {
    className: `df-assistant${assistantOpen ? " is-open" : ""}`,
    style: { height: assistantOpen ? `${assistantHeight}px` : "44px" }
  },
    React.createElement("div", { className: "df-assistant__head" },
      React.createElement("span", { className: "df-assistant__spark", "aria-hidden": true }, "✦"),
      React.createElement("span", { className: "df-assistant__title" }, t.assistant),
      React.createElement("div", { className: "df-assist-menu-wrap" },
        React.createElement("button", {
          type: "button",
          className: "df-assist-menu-btn",
          title: t.assistModelLabel + " / " + t.assistEffortLabel,
          "data-df-action": "assistant-settings",
          onClick: () => {
            setAssistMenuOpen((open) => !open);
            setAssistMenuPage(null);
          }
        },
          assistModel || t.assistModelFollow,
          " · ",
          assistEffort === "off" ? t.assistEffortOff : assistEffort === "high" ? t.assistEffortHigh : assistEffort === "max" ? t.assistEffortMax : t.assistEffortFollow,
          React.createElement("span", { className: "df-assist-menu-caret", "aria-hidden": true }, "▼")
        ),
        assistMenuOpen && React.createElement("div", { className: "df-assist-menu" },
          assistMenuPage === null
            ? [
                React.createElement("button", { key: "m", type: "button", className: "df-assist-menu-item", onClick: () => setAssistMenuPage("model") }, t.assistModelLabel, "：", assistModel || t.assistModelFollow),
                React.createElement("button", { key: "e", type: "button", className: "df-assist-menu-item", onClick: () => setAssistMenuPage("effort") }, t.assistEffortLabel, "：", assistEffort === "off" ? t.assistEffortOff : assistEffort === "high" ? t.assistEffortHigh : assistEffort === "max" ? t.assistEffortMax : t.assistEffortFollow)
              ]
            : assistMenuPage === "model"
              ? [
                  React.createElement("button", { key: "back", type: "button", className: "df-assist-menu-back", onClick: () => setAssistMenuPage(null) }, "‹ ", t.assistModelLabel),
                  React.createElement("button", { key: "follow", type: "button", className: "df-assist-menu-item", onClick: () => { setAssistModel(""); setAssistMenuOpen(false); } }, t.assistModelFollow),
                  ...(assistModelOptions ?? []).map((option) =>
                    React.createElement("button", {
                      key: `${option.provider}/${option.model}`,
                      type: "button",
                      className: "df-assist-menu-item",
                      onClick: () => { setAssistModel(option.model); setAssistMenuOpen(false); }
                    }, option.model)
                  )
                ]
              : [
                  React.createElement("button", { key: "back", type: "button", className: "df-assist-menu-back", onClick: () => setAssistMenuPage(null) }, "‹ ", t.assistEffortLabel),
                  [["", t.assistEffortFollow], ["off", t.assistEffortOff], ["high", t.assistEffortHigh], ["max", t.assistEffortMax]].map(([value, label]) =>
                    React.createElement("button", {
                      key: value,
                      type: "button",
                      className: "df-assist-menu-item",
                      onClick: () => { setAssistEffort(value); setAssistMenuOpen(false); }
                    }, label)
                  )
                ]
        )
      ),
      React.createElement("span", { className: "df-assistant__target", title: `${t.assistantTarget}: ${assistantDocLabel}` }, assistantDocLabel),
      React.createElement("div", { className: "df-assistant__actions" },
        React.createElement("button", {
          className: `df-btn is-primary${topologyDirty && assistantBusy !== "logic" ? " is-disabled" : ""}`,
          "data-df-action": "logic-validation",
          "aria-disabled": topologyDirty && assistantBusy !== "logic" ? "true" : undefined,
          disabled: assistantBusy === "cancelling" && activeAssistRef.current?.mode === "logic",
          onClick: () => {
            if (assistantBusy === "logic") { setCancelConfirm({ mode: "logic" }); return; }
            if (topologyDirty) { setMessage(t.topologyPending); return; }
            runLogicValidation();
          }
        }, assistantBusy === "logic" ? t.cancelValidation
          : assistantBusy === "cancelling" && activeAssistRef.current?.mode === "logic" ? "…"
          : t.logicValidation),
        React.createElement("button", {
          className: "df-btn",
          "data-df-action": "optimize-document",
          disabled: !currentFlow,
          onClick: () => {
            if (runningDocs.get(assistantTarget) !== undefined) { setCancelConfirm({ mode: "document" }); return; }
            runDocumentOptimization();
          }
        }, runningDocs.get(assistantTarget) !== undefined ? t.cancelDocOptimize : t.aiOptimize),
        React.createElement("button", {
          className: `df-btn${topologyDirty && assistantBusy !== "optimize-workflow" ? " is-disabled" : ""}`,
          "data-df-action": "optimize-workflow",
          "aria-disabled": topologyDirty && assistantBusy !== "optimize-workflow" ? "true" : undefined,
          disabled: assistantBusy === "cancelling" && activeAssistRef.current?.mode === "optimize-workflow",
          onClick: () => {
            if (assistantBusy === "optimize-workflow") { setCancelConfirm({ mode: "workflow" }); return; }
            if (topologyDirty) { setMessage(t.topologyPending); return; }
            setWorkflowOptimizeConfirm(true);
          }
        }, assistantBusy === "optimize-workflow" ? t.cancelWorkflowOptimize
          : assistantBusy === "cancelling" && activeAssistRef.current?.mode === "optimize-workflow" ? "…"
          : t.aiOptimizeWorkflow),
        React.createElement("button", {
          className: "df-btn df-assistant__toggle",
          title: assistantOpen ? t.collapseAssistant : t.expandAssistant,
          "aria-label": assistantOpen ? t.collapseAssistant : t.expandAssistant,
          onClick: () => setAssistantOpen((open) => !open)
        }, assistantOpen ? "⌄" : "⌃")
      )
    ),
    assistantOpen && React.createElement("div", { className: "df-assistant__body" },
      React.createElement("div", { className: "df-assistant__control" },
        React.createElement("label", null, t.assistantInstruction,
          React.createElement("input", {
            value: assistantInstruction,
            placeholder: t.assistantInstructionHint,
            onChange: (event) => setAssistantInstruction(event.target.value)
          })
        ),
        React.createElement("div", { className: "df-assistant__summary" },
          validationResult
            ? [
                React.createElement("span", { key: "total" }, `${validationResult.summary?.total ?? findings.length} ${t.issues}`),
                React.createElement("button", {
                  key: "error",
                  type: "button",
                  className: `df-count is-error${findingFilter === "error" ? " is-active" : ""}`,
                  "data-df-filter": "error",
                  "aria-pressed": findingFilter === "error",
                  onClick: () => setFindingFilter((value) => value === "error" ? null : "error")
                }, `Error ${counts.error ?? 0}`),
                React.createElement("button", {
                  key: "warning",
                  type: "button",
                  className: `df-count is-warning${findingFilter === "warning" ? " is-active" : ""}`,
                  "data-df-filter": "warning",
                  "aria-pressed": findingFilter === "warning",
                  onClick: () => setFindingFilter((value) => value === "warning" ? null : "warning")
                }, `Warn ${counts.warning ?? 0}`)
              ]
            : React.createElement("span", null, t.validationIdle)
        ),
        React.createElement("div", { className: "df-findings" },
          validationResult && findings.length === 0
            ? React.createElement("div", { className: "df-empty" }, t.noFindings)
            : visibleFindings.map((finding, index) => React.createElement("button", {
                key: `${finding.code}-${finding.nodeId ?? finding.edgeId ?? index}`,
                className: `df-finding is-${finding.level}`,
                "data-df-finding-level": finding.level,
                onClick: () => focusFinding(finding)
              },
                React.createElement("span", { className: "df-finding__dot" }),
                React.createElement("span", null,
                  React.createElement("span", { className: "df-finding__doc" }, findingDocumentLabel(finding)),
                  React.createElement("span", { className: "df-finding__message" }, finding.message),
                  finding.suggestion && React.createElement("span", { className: "df-finding__suggestion" }, finding.suggestion)
                )
              ))
        )
      ),
      React.createElement("div", { className: "df-assistant__preview" },
        React.createElement("div", { className: "df-assistant__preview-head" },
          React.createElement("span", { className: "df-assistant__preview-title" }, optimizationProposal
            ? `${t.proposalDecision} · ${optimizationProposal.documentLabel} · ${optimizationStale ? t.staleSuggestion : t.suggestionPreview}`
            : `${t.proposalDecision} · ${t.proposalPending}`),
          optimizationProposal && React.createElement("span", null,
            React.createElement("button", { className: "df-btn is-ghost", "data-df-action": "discard-optimization", onClick: discardOptimization }, t.discardSuggestion),
            React.createElement("button", { className: "df-btn is-primary", "data-df-action": "accept-optimization", onClick: acceptOptimization, disabled: !assistantDraft || optimizationStale }, t.acceptSuggestion)
          )
        ),
        optimizationProposal
          ? React.createElement("textarea", { value: assistantDraft, onChange: (event) => setAssistantDraft(event.target.value), spellCheck: false })
          : React.createElement("div", { className: "df-assistant__pending" },
              React.createElement("span", null, `${t.proposalPending} · ${t.proposalIdle}`)
            )
      )
    )
  );

  const workflowConfirmDialog = workflowOptimizeConfirm && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setWorkflowOptimizeConfirm(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-workflow-optimize-title" },
      React.createElement("h3", { id: "df-workflow-optimize-title" }, t.workflowOptimizeTitle),
      React.createElement("p", null, t.workflowOptimizeWarning),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", onClick: () => setWorkflowOptimizeConfirm(false) }, t.workflowOptimizeCancel),
        React.createElement("button", { className: "df-btn is-primary", "data-df-action": "confirm-optimize-workflow", onClick: runWorkflowOptimization }, t.workflowOptimizeConfirm)
      )
    )
  );

  const cancelConfirmDialog = cancelConfirm && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setCancelConfirm(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-cancel-confirm-title" },
      React.createElement("h3", { id: "df-cancel-confirm-title" },
        cancelConfirm.mode === "logic" ? t.cancelConfirmLogic
          : cancelConfirm.mode === "workflow" ? t.cancelConfirmWorkflow
          : t.cancelConfirmDoc),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", "data-df-action": "wait-cancel", onClick: () => setCancelConfirm(null) }, t.waitMore),
        React.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-cancel-agent",
          onClick: () => {
            const mode = cancelConfirm.mode;
            setCancelConfirm(null);
            if (mode === "document") cancelOptimizeFor(assistantTarget);
            else cancelAssistant();
          }
        }, t.confirmCancel)
      )
    )
  );

  const topologyConfirmDialog = topologyApplyConfirm && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget && !topologyApplyBusy) setTopologyApplyConfirm(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-topology-apply-title" },
      React.createElement("h3", { id: "df-topology-apply-title" }, t.topologyApplyTitle),
      React.createElement("p", null, t.topologyApplyWarning),
      topologyDelta && React.createElement("div", { className: "df-topology-summary" },
        React.createElement("span", null, `${t.topologyNodes}: +${topologyDelta.nodes.added.length} / −${topologyDelta.nodes.removed.length} / ~${topologyDelta.nodes.changed.length}`),
        React.createElement("span", null, `${t.topologyEdges}: +${topologyDelta.edges.added.length} / −${topologyDelta.edges.removed.length} / ~${topologyDelta.edges.changed.length}`)
      ),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", disabled: topologyApplyBusy, onClick: () => setTopologyApplyConfirm(false) }, t.cancel),
        React.createElement("button", {
          className: "df-btn is-primary",
          "data-df-action": "confirm-apply-topology",
          disabled: topologyApplyBusy,
          onClick: applyTopologyChanges
        }, topologyApplyBusy ? t.topologyApplying : t.topologyApplyConfirm)
      )
    )
  );

  const gatePickerDialog = gatePickerOpen && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setGatePickerOpen(false);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "df-gate-picker-title" },
      React.createElement("h3", { id: "df-gate-picker-title" }, t.chooseGateTitle),
      React.createElement("p", null, t.chooseGateIntro),
      React.createElement("div", { className: "df-gate-grid" },
        CONDITION_GATE_TYPES.map((gateType) => React.createElement("button", {
          key: gateType,
          type: "button",
          className: "df-gate-choice",
          "data-df-gate-type": gateType,
          onClick: () => {
            setGatePickerOpen(false);
            createNode("condition", gateType);
          }
        },
          React.createElement("strong", null, t.gateType[gateType]),
          React.createElement("span", null, t.gateDescription[gateType])
        ))
      ),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", onClick: () => setGatePickerOpen(false) }, t.cancel)
      )
    )
  );

  const branchPickerDialog = pendingConnection && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setPendingConnection(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "df-branch-picker-title" },
      React.createElement("h3", { id: "df-branch-picker-title" }, t.chooseBranchTitle),
      React.createElement("p", null, t.chooseBranchIntro),
      React.createElement("div", { className: "df-branch-options" },
        ["true", "false"].map((branch) => React.createElement("button", {
          key: branch,
          type: "button",
          className: "df-branch-option",
          "data-df-branch": branch,
          disabled: !pendingConnection.available.includes(branch),
          onClick: () => {
            const conn = pendingConnection.connection;
            setPendingConnection(null);
            commitConnection(conn, branch);
          }
        }, t.branchLabel[branch]))
      ),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn", onClick: () => setPendingConnection(null) }, t.cancel)
      )
    )
  );

  const connectionWarningDialog = connectionWarning && React.createElement("div", {
    className: "df-confirm-backdrop",
    role: "presentation",
    onPointerDown: (event) => {
      if (event.target === event.currentTarget) setConnectionWarning(null);
    }
  },
    React.createElement("div", { className: "df-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "df-connection-warning-title" },
      React.createElement("h3", { id: "df-connection-warning-title" }, t.connectionWarningTitle),
      React.createElement("p", null, connectionWarning),
      React.createElement("div", { className: "df-confirm__actions" },
        React.createElement("button", { className: "df-btn is-primary", onClick: () => setConnectionWarning(null) }, t.dismiss)
      )
    )
  );

  const topologyApplyButton = topologyDirty && React.createElement("div", { className: "df-topology-apply" },
    React.createElement("button", {
      type: "button",
      className: "df-btn is-primary",
      "data-df-action": "apply-topology",
      disabled: topologyApplyBusy,
      onClick: () => setTopologyApplyConfirm(true)
    },
      React.createElement("span", { className: "df-topology-apply__icon", "aria-hidden": true }, topologyApplyBusy ? "◌" : "✓"),
      React.createElement("span", null, topologyApplyBusy ? t.topologyApplying : t.topologyApply),
      topologyDelta?.count > 0 && React.createElement("span", { className: "df-topology-apply__count" }, topologyDelta.count)
    )
  );

  const panelBudget = Math.max(0, studioWidth - 340 - 18);
  let effectiveDocumentWidth = documentsOpen ? Math.min(documentWidth, studioWidth * 0.42) : 0;
  let effectiveInspectorWidth = inspectorOpen ? Math.min(inspectorWidth, studioWidth * 0.46) : 0;
  const desiredTotal = effectiveDocumentWidth + effectiveInspectorWidth;
  if (desiredTotal > panelBudget && desiredTotal > 0) {
    const factor = panelBudget / desiredTotal;
    effectiveDocumentWidth *= factor;
    effectiveInspectorWidth *= factor;
  }
  const studioStyle = {
    gridTemplateColumns: `${Math.round(effectiveDocumentWidth)}px 9px minmax(0,1fr) 9px ${Math.round(effectiveInspectorWidth)}px`
  };
  const leftSplitter = React.createElement("div", {
    className: `df-splitter df-splitter--left${documentsOpen ? "" : " is-collapsed"}`,
    role: "separator",
    tabIndex: 0,
    title: t.resizeDocs,
    "aria-label": t.resizeDocs,
    "aria-orientation": "vertical",
    "aria-valuemin": 0,
    "aria-valuenow": Math.round(effectiveDocumentWidth),
    onPointerDown: (event) => beginPanelResize("left", event),
    onDoubleClick: () => setDocumentsOpen((open) => !open),
    onKeyDown: (event) => panelKeyDown("left", event)
  });
  const rightSplitter = React.createElement("div", {
    className: `df-splitter df-splitter--right${inspectorOpen ? "" : " is-collapsed"}`,
    role: "separator",
    tabIndex: 0,
    title: t.resizeEditor,
    "aria-label": t.resizeEditor,
    "aria-orientation": "vertical",
    "aria-valuemin": 0,
    "aria-valuenow": Math.round(effectiveInspectorWidth),
    onPointerDown: (event) => beginPanelResize("right", event),
    onDoubleClick: () => setInspectorOpen((open) => !open),
    onKeyDown: (event) => panelKeyDown("right", event)
  });
  const assistantSplitter = React.createElement("div", {
    className: `df-assistant-splitter${assistantOpen ? "" : " is-collapsed"}`,
    role: "separator",
    tabIndex: 0,
    title: t.resizeAssistant,
    "aria-label": t.resizeAssistant,
    "aria-orientation": "horizontal",
    "aria-valuemin": 44,
    "aria-valuenow": assistantOpen ? Math.round(assistantHeight) : 44,
    onPointerDown: beginAssistantResize,
    onDoubleClick: () => setAssistantOpen((open) => !open),
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setAssistantOpen((open) => !open);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        setAssistantOpen(true);
        setAssistantHeight((height) => Math.max(ASSISTANT_COLLAPSE_THRESHOLD, height + (event.key === "ArrowUp" ? 16 : -16)));
      }
    }
  });

  return React.createElement("div", { className: "df-studio", ref: studioRef, style: studioStyle },
    documentRail,
    leftSplitter,
    React.createElement("div", { className: "df-canvas-shell", ref: canvasShellRef },
      workflowConfirmDialog,
      cancelConfirmDialog,
      topologyConfirmDialog,
      gatePickerDialog,
      branchPickerDialog,
      connectionWarningDialog,
      toolbar,
      React.createElement("div", { className: "df-canvas-stage" },
        React.createElement(GraphCanvas, {
          nodes,
          edges,
          copy: t,
          selectedNode: selected,
          selectedEdge,
          onInit: setFlowInstance,
          onNodeDragStart: rememberGraph,
          onNodeMove: moveNode,
          onNodeSelect: (id) => {
            setSelected(id);
            setSelectedEdge(null);
            setActiveDoc(id);
          },
          onEdgeSelect: (id) => {
            setSelected(null);
            setSelectedEdge(id);
            setMessage(t.edgeSelected);
          },
          onPaneClick: () => {
            setSelected(null);
            setSelectedEdge(null);
          },
          onConnect,
          onConnectionRejected,
          onReconnect,
          isValidConnection,
          fitLabel: t.fitAll,
          zoomInLabel: t.zoomIn,
          zoomOutLabel: t.zoomOut
        }),
        topologyApplyButton
      ),
      addBar,
      assistantSplitter,
      assistantPanel
    ),
    rightSplitter,
    inspector
  );
}

// ============ 视图 ============
function DeepSeekFlowView({ connection, sessionId, language: initialLanguage, locale }) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    if (!locale || typeof locale.subscribe !== "function") return undefined;
    const update = () => setLanguage(localeLanguage(locale));
    update();
    return locale.subscribe(update);
  }, [locale]);
  const t = useMemo(() => text(language), [language]);
  const rootRef = React.useRef(null);
  useLayoutEffect(() => {
    const scrollBody = rootRef.current?.closest?.("[data-conversation-scroll]");
    if (!scrollBody) return undefined;
    const previousImmersive = scrollBody.getAttribute("data-deepseek-flow-immersive");
    const composerSeat = scrollBody.querySelector(":scope > [data-composer-seat]");
    const previousAriaHidden = composerSeat?.getAttribute("aria-hidden") ?? null;
    const previousInert = composerSeat?.inert ?? false;
    scrollBody.setAttribute("data-deepseek-flow-immersive", "true");
    if (composerSeat) {
      composerSeat.setAttribute("aria-hidden", "true");
      composerSeat.inert = true;
    }
    return () => {
      if (previousImmersive === null) scrollBody.removeAttribute("data-deepseek-flow-immersive");
      else scrollBody.setAttribute("data-deepseek-flow-immersive", previousImmersive);
      if (composerSeat) {
        if (previousAriaHidden === null) composerSeat.removeAttribute("aria-hidden");
        else composerSeat.setAttribute("aria-hidden", previousAriaHidden);
        composerSeat.inert = previousInert;
      }
    };
  }, [sessionId]);
  return React.createElement("div", { className: "deepseek-flow-root", ref: rootRef, "data-df-immersive-view": "true" },
    React.createElement("nav", { className: "df-tabs" },
      React.createElement("span", { className: "df-titlebar__title" }, t.studio),
      React.createElement("span", { className: "df-titlebar__badge" }, t.editorOnly),
      React.createElement("span", { className: "df-titlebar__note" }, t.editorOnlyNote),
      React.createElement("span", { className: "df-titlebar__rev", title: `DeepSeekFlow client revision ${CLIENT_REV}` }, `rev ${CLIENT_REV}`)
    ),
    React.createElement("main", { className: "df-main" },
      React.createElement(Studio, { connection, sessionId, language })
    )
  );
}

// ============ 插件入口 ============
function apply(ctx) {
  const language = localeLanguage(ctx.locale);
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = "deepseek-flow";
    tag.textContent = styles;
    document.head.append(tag);
    return () => {
      tag.remove();
    };
  }, "deepseek-flow: styles");
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "deepseek-flow",
    order: 20,
    label: () => text(localeLanguage(ctx.locale)).view,
    inject: (sessionId) => ({
      connection: ctx.connection,
      sessionId: String(sessionId),
      language: localeLanguage(ctx.locale),
      locale: ctx.locale
    })
  }, DeepSeekFlowView));
}

export { apply, inject };
