// DeepSeekFlow Client — 流程图编辑器（每个 session 独立视图）
// 挂载点：conversation.view slot（Chat 旁的视图入口），inject 提供当前 sessionId
// 主题：全部使用 dsw alias token（--dsw-alias-*），明暗主题自动跟随 webui

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";

const inject = ["slots", "connection", "locale"];
const CLIENT_REV = "__DEEPSEEK_FLOW_CLIENT_REV__";

// ============ 语言 ============
function localeLanguage(localeService) {
  try {
    const snapshot = localeService?.getLocale?.();
    const active = String(snapshot?.active ?? "");
    if (active) return active.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    // fall through
  }
  return browserLanguage();
}

function browserLanguage() {
  try {
    return String(navigator.language ?? "en").toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}

function text(language) {
  return language === "zh"
    ? {
        view: "DeepSeek Flow",
        studio: "流程设计",
        editorOnly: "仅编辑",
        editorOnlyNote: "执行请回到当前 Session",
        ready: "就绪",
        saving: "保存中…",
        saved: "已保存",
        autoSaving: "正在同步 Markdown…",
        autoSaved: "Markdown 已写入",
        createFailed: "新建失败：",
        newFlow: "新建",
        shared: "共享",
        importLabel: "导入 JSON",
        exportLabel: "导出 JSON",
        save: "保存",
        undo: "撤销",
        redo: "重做",
        tidy: "一键整理",
        flow: "工作流",
        documents: "工作流文档",
        workflowDoc: "总控流程",
        stepDocs: "分步工作区",
        openDocument: "选择一个 Markdown 文件进行编辑",
        markdownContent: "Markdown 内容",
        docRoot: "文档工作区",
        workspace: "步骤工作区",
        filePath: "文件",
        documentFirst: "文档优先",
        documentFirstNote: "先读 WORKFLOW.md，再按顺序执行每个 STEP.md",
        collapseDocs: "收起工作流文档",
        expandDocs: "展开工作流文档",
        resizeDocs: "拖动调整文档栏宽度；双击收起或展开",
        collapseEditor: "收起 Markdown 编辑器",
        expandEditor: "展开 Markdown 编辑器",
        resizeEditor: "拖动调整编辑器宽度；双击收起或展开",
        resizeAssistant: "拖动调整助手高度；双击收起或展开",
        fitAll: "显示全图",
        zoomIn: "放大",
        zoomOut: "缩小",
        addNode: "新建流程框",
        connectHint: "拖动流程框两侧圆点即可新建箭头",
        nodeKind: {
          input: "输入",
          agent: "Agent",
          mapAgent: "Map Agent",
          condition: "条件",
          merge: "合并",
          output: "输出"
        },
        properties: "节点属性",
        prompt: "提示词",
        stage: "阶段",
        predicate: "谓词",
        model: "模型",
        provider: "Provider",
        outputSchema: "输出 Schema (JSON)",
        none: "无",
        noFlow: "还没有工作流：请让 Agent 创建，或导入 JSON",
        importFailed: "导入失败：",
        invalidJson: "JSON 无效：",
        importOk: "已导入：",
        deleteNode: "删除节点",
        exportOk: "已导出",
        docFile: "文档文件（相对 docRoot）",
        docSyncNote: "提示词将同步写回：",
        advancedHints: "Session 提示（高级）",
        assistant: "AI 文档助手",
        assistModelLabel: "AI 助手使用模型",
        assistModelFollow: "跟随会话",
        assistEffortLabel: "思考强度",
        assistEffortFollow: "跟随会话",
        assistEffortOff: "off",
        assistEffortHigh: "high",
        assistEffortMax: "max",
        assistantSafe: "",
        assistantTarget: "当前文档",
        assistantInstruction: "AI 优化要求（可选）",
        assistantInstructionHint: "例如：更强调截图质检、失败回退和交付文件",
        aiOptimize: "AI 优化当前文档",
        aiOptimizeWorkflow: "AI 优化整个工作流",
        logicValidation: "逻辑校验",
        agentLogicBusy: "Agent 校验中…",
        agentOptimizeBusy: "Agent 优化中…",
        agentWorkflowBusy: "Agent 整体优化中…",
        cancelAgent: "取消 Agent",
        assistantCancelled: "已请求取消 Agent 操作",
        acceptSuggestion: "接受修改",
        discardSuggestion: "拒绝修改",
        acceptedSuggestion: "优化方案已接受并同步",
        discardedSuggestion: "已拒绝方案，原始文档未改变",
        staleSuggestion: "原文在方案生成后已变化，请拒绝并重新优化",
        suggestionPreview: "完整 Markdown 修改方案",
        proposalPending: "待加载",
        proposalDecision: "接受或拒绝修改",
        workflowOptimizeTitle: "确认优化整个工作流？",
        workflowOptimizeWarning: "该操作会让 Agent 直接改写 WORKFLOW.md 和全部 STEP.md，并立即保存，不提供逐份接受或撤销。请确认已经备份重要内容。",
        workflowOptimizeConfirm: "确认并直接优化",
        workflowOptimizeCancel: "取消",
        workflowOptimized: "整个工作流已由 Agent 优化并保存",
        workflowChangedDuringOptimization: "优化期间文档已变化，为防止覆盖新内容，本次结果未写入",
        noFindings: "未发现错误或警告",
        issues: "项校验结果",
        validationIdle: "点击“逻辑校验”扫描 WORKFLOW.md 与全部 STEP.md",
        validationStale: "文档已变化，请再次点击“逻辑校验”复测",
        validationComplete: "Agent 逻辑校验完成",
        proposalIdle: "选择一个文档，然后手动点击“AI 优化当前文档”",
        expandAssistant: "展开 AI 文档助手",
        collapseAssistant: "收起 AI 文档助手",
        assistantFailed: "操作失败：",
        edgeSelected: "已选择箭头，按 Delete 删除"
      }
    : {
        view: "DeepSeek Flow",
        studio: "Flow editor",
        editorOnly: "Edit only",
        editorOnlyNote: "Run from the current Session",
        ready: "Ready",
        saving: "Saving…",
        saved: "Saved",
        autoSaving: "Syncing Markdown…",
        autoSaved: "Markdown written",
        createFailed: "Create failed: ",
        newFlow: "New",
        shared: "Shared",
        importLabel: "Import JSON",
        exportLabel: "Export JSON",
        save: "Save",
        undo: "Undo",
        redo: "Redo",
        tidy: "Auto layout",
        flow: "Flow",
        documents: "Workflow docs",
        workflowDoc: "Master workflow",
        stepDocs: "Step workspaces",
        openDocument: "Select a Markdown file to edit",
        markdownContent: "Markdown content",
        docRoot: "Document workspace",
        workspace: "Step workspace",
        filePath: "File",
        documentFirst: "Docs first",
        documentFirstNote: "Read WORKFLOW.md first, then execute each STEP.md in order",
        collapseDocs: "Collapse workflow documents",
        expandDocs: "Expand workflow documents",
        resizeDocs: "Drag to resize the document rail; double-click to collapse or expand",
        collapseEditor: "Collapse Markdown editor",
        expandEditor: "Expand Markdown editor",
        resizeEditor: "Drag to resize the editor; double-click to collapse or expand",
        resizeAssistant: "Drag to resize the assistant; double-click to collapse or expand",
        fitAll: "Fit all",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        addNode: "New flow box",
        connectHint: "Drag between the side handles to create an arrow",
        nodeKind: {
          input: "Input",
          agent: "Agent",
          mapAgent: "Map Agent",
          condition: "Condition",
          merge: "Merge",
          output: "Output"
        },
        properties: "Node properties",
        prompt: "Prompt",
        stage: "Stage",
        predicate: "Predicate",
        model: "Model",
        provider: "Provider",
        outputSchema: "Output schema (JSON)",
        none: "None",
        noFlow: "No flow yet: ask the Agent to create one, or import JSON",
        importFailed: "Import failed: ",
        invalidJson: "Invalid JSON: ",
        importOk: "Imported: ",
        deleteNode: "Delete node",
        exportOk: "Exported",
        docFile: "Doc file (relative to docRoot)",
        docSyncNote: "Prompt syncs back to: ",
        advancedHints: "Session hints (advanced)",
        assistant: "AI",
        assistModelLabel: "Model used by the AI assistant",
        assistModelFollow: "Follow session",
        assistEffortLabel: "Reasoning effort",
        assistEffortFollow: "Follow session",
        assistEffortOff: "Off",
        assistEffortHigh: "High",
        assistEffortMax: "Max",
        assistantSafe: "",
        assistantTarget: "Current document",
        assistantInstruction: "AI optimization request (optional)",
        assistantInstructionHint: "For example: emphasize screenshot QA, fallback and deliverables",
        aiOptimize: "AI optimize current doc",
        aiOptimizeWorkflow: "AI optimize entire workflow",
        logicValidation: "Logic validation",
        agentLogicBusy: "Agent validating…",
        agentOptimizeBusy: "Agent optimizing…",
        agentWorkflowBusy: "Agent optimizing workflow…",
        cancelAgent: "Cancel Agent",
        assistantCancelled: "Agent cancellation requested",
        acceptSuggestion: "Accept changes",
        discardSuggestion: "Reject changes",
        acceptedSuggestion: "Optimization accepted and syncing",
        discardedSuggestion: "Proposal rejected; original document unchanged",
        staleSuggestion: "The source changed after this proposal; undo and optimize again",
        suggestionPreview: "Full Markdown proposal",
        proposalPending: "Waiting to load",
        proposalDecision: "Accept or reject changes",
        workflowOptimizeTitle: "Optimize the entire workflow?",
        workflowOptimizeWarning: "The Agent will directly rewrite WORKFLOW.md and every STEP.md, then save immediately. There is no per-document acceptance or undo. Back up important content first.",
        workflowOptimizeConfirm: "Confirm and optimize",
        workflowOptimizeCancel: "Cancel",
        workflowOptimized: "The entire workflow was optimized and saved",
        workflowChangedDuringOptimization: "Documents changed during optimization, so the result was not written",
        noFindings: "No errors or warnings found",
        issues: "validation findings",
        validationIdle: "Click Logic validation to scan WORKFLOW.md and every STEP.md",
        validationStale: "Documents changed; click Logic validation again to retest",
        validationComplete: "Agent logic validation completed",
        proposalIdle: "Select one document, then manually click AI optimize current doc",
        expandAssistant: "Expand AI document assistant",
        collapseAssistant: "Collapse AI document assistant",
        assistantFailed: "Operation failed: ",
        edgeSelected: "Arrow selected; press Delete to remove"
      };
}

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

// ============ 样式（主题跟随 webui：全部 dsw alias token）============
const styles = String.raw`
.deepseek-flow-root{--df-border:var(--dsw-alias-border-l1);--df-border-strong:var(--dsw-alias-border-l2);--df-bg:var(--dsw-alias-bg-base);--df-layer:var(--dsw-alias-bg-layer-1);--df-layer-2:var(--dsw-alias-bg-layer-2);--df-brand:var(--dsw-alias-brand-primary);--df-on-brand:var(--dsw-alias-label-primary-inverse,var(--dsw-alias-label-reverse,var(--df-bg)));--df-ink:var(--dsw-alias-label-primary);--df-ink-2:var(--dsw-alias-label-secondary);--df-ok:var(--dsw-alias-state-success-primary);--df-warn:var(--dsw-alias-state-warn-primary);--df-err:var(--dsw-alias-state-error-primary);position:relative;inset:auto;width:100%;height:100%;max-height:100vh;min-height:0;display:grid;grid-template-rows:48px minmax(0,1fr);background:var(--df-bg);color:var(--df-ink);font:13px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
.deepseek-flow-root *{box-sizing:border-box}
.deepseek-flow-root button,.deepseek-flow-root input,.deepseek-flow-root select,.deepseek-flow-root textarea{font:inherit}
.deepseek-flow-root button{cursor:pointer}
.df-tabs{display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--df-layer);border-bottom:1px solid var(--df-border)}
.df-titlebar__title{font-size:14px;font-weight:720;color:var(--df-ink)}
.df-titlebar__badge{padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--df-brand) 10%,transparent);color:var(--df-brand);font-size:10px;font-weight:700}
.df-titlebar__note{color:var(--df-ink-2);font-size:11px}
.df-titlebar__rev{margin-left:auto;color:var(--df-ink-2);font:9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.72}
.df-main{min-height:0;overflow:hidden}
.df-toolbar{flex:none;height:52px;min-height:52px;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--df-layer);border-bottom:1px solid var(--df-border);flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.df-toolbar>*{flex:none}
.df-toolbar>label{display:flex;align-items:center;gap:7px;color:var(--df-ink-2);font-size:12px}
.df-toolbar select,.df-toolbar input,.df-toolbar textarea{border:1px solid var(--df-border-strong);border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px;outline:0}
.df-toolbar input:focus,.df-toolbar select:focus,.df-toolbar textarea:focus{border-color:var(--df-brand)}
.df-btn{border:1px solid var(--df-border-strong);border-radius:8px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 11px;transition:border-color .15s ease,transform .15s ease,background .15s ease}
.df-btn:hover{border-color:var(--df-brand);transform:translateY(-1px)}
.df-btn.is-primary{border-color:var(--df-brand);background:var(--df-brand);color:var(--df-on-brand);font-weight:650}
.df-btn.is-ghost{background:transparent}
.df-btn:disabled{opacity:.5;cursor:default}
.df-status{color:var(--df-ink-2);font-size:12px;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38%}
.df-studio{height:100%;display:grid;grid-template-rows:minmax(0,1fr);min-height:0;min-width:0;background:var(--df-bg);overflow:hidden}
.df-canvas-shell{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;background:var(--df-bg);overflow:hidden}
.df-canvas{flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;user-select:none;background-color:var(--df-bg);background-image:radial-gradient(circle,var(--df-border-strong) 1.1px,transparent 1.2px),radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--df-brand) 6%,transparent),transparent 42%);background-size:24px 24px,100% 100%;cursor:grab}
.df-canvas.is-panning{cursor:grabbing}
.df-graph__stage{position:absolute;left:0;top:0;width:1px;height:1px;transform-origin:0 0;will-change:transform}
.df-graph__edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.df-graph__edge{fill:none!important;stroke:var(--df-brand);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 2px color-mix(in srgb,var(--df-brand) 36%,transparent));pointer-events:none}
.df-graph__edge.is-selected{stroke-width:3.6;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--df-brand) 58%,transparent))}
.df-graph__edge-hit{fill:none!important;stroke:transparent;stroke-width:18;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
.df-graph__connection{fill:none!important;stroke:var(--df-brand);stroke-width:2;stroke-dasharray:7 5;vector-effect:non-scaling-stroke;pointer-events:none}
.df-graph__label-bg{fill:var(--df-layer);stroke:var(--df-border);stroke-width:1;vector-effect:non-scaling-stroke}
.df-graph__label{fill:var(--df-ink);font-size:10px;font-weight:750;text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.df-graph__node{position:absolute;width:208px;height:116px;pointer-events:auto;cursor:grab}
.df-graph__node.is-dragging{cursor:grabbing}
.df-graph__handle{position:absolute;z-index:4;top:50%;width:13px;height:13px;padding:0;border:2px solid var(--df-bg);border-radius:50%;background:var(--df-brand);transform:translateY(-50%);cursor:crosshair;box-shadow:0 0 0 1px color-mix(in srgb,var(--df-brand) 65%,var(--df-border-strong));transition:transform .14s ease,box-shadow .14s ease}
.df-graph__handle:hover,.df-graph__handle:focus-visible{transform:translateY(-50%) scale(1.18);box-shadow:0 0 0 5px color-mix(in srgb,var(--df-brand) 18%,transparent);outline:0}
.df-graph__handle--target{left:-6px}
.df-graph__handle--source{right:-6px}
.df-graph__controls{position:absolute;z-index:8;left:12px;bottom:12px;display:grid;border:1px solid var(--df-border-strong);border-radius:9px;overflow:hidden;background:var(--df-layer);box-shadow:0 8px 20px color-mix(in srgb,var(--df-ink) 9%,transparent)}
.df-graph__controls button{width:32px;height:30px;border:0;border-bottom:1px solid var(--df-border);background:var(--df-layer-2);color:var(--df-ink);font-weight:750}
.df-graph__controls button:last-child{border-bottom:0}
.df-graph__controls button:hover{background:color-mix(in srgb,var(--df-brand) 10%,var(--df-layer-2));color:var(--df-brand)}
.df-node{width:100%;height:100%;padding:12px 14px;border:1px solid var(--df-border-strong);border-radius:12px;background:color-mix(in srgb,var(--df-layer) 96%,var(--df-brand) 4%);color:var(--df-ink);box-shadow:0 8px 24px color-mix(in srgb,var(--df-ink) 9%,transparent);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease;overflow:hidden}
.df-node:hover{border-color:color-mix(in srgb,var(--df-brand) 55%,var(--df-border-strong));box-shadow:0 12px 30px color-mix(in srgb,var(--df-ink) 12%,transparent)}
.df-node.is-selected{border-color:var(--df-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--df-brand) 18%,transparent),0 12px 30px color-mix(in srgb,var(--df-ink) 12%,transparent)}
.df-node__kind{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--df-ink-2);margin-bottom:2px}
.df-node__label{font-weight:650;font-size:13px;word-break:break-word}
.df-node__prompt{margin-top:5px;font-size:11px;color:var(--df-ink-2);white-space:pre-wrap;max-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.df-node__file{margin-top:8px;padding-top:7px;border-top:1px solid var(--df-border);font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-node--input .df-node__kind{color:var(--df-ok)}
.df-node--agent .df-node__kind{color:var(--df-brand)}
.df-node--mapAgent .df-node__kind{color:var(--df-warn)}
.df-node--condition .df-node__kind{color:var(--df-warn)}
.df-node--merge .df-node__kind{color:var(--df-ink-2)}
.df-node--output .df-node__kind{color:var(--df-err)}
.df-docrail{min-width:0;width:auto;display:flex;flex-direction:column;background:var(--df-layer);min-height:0;overflow:hidden}
.df-docrail.is-collapsed{visibility:hidden;pointer-events:none}
.df-docrail__head{position:relative;min-height:58px;padding:12px 14px 10px;border-bottom:1px solid var(--df-border)}
.df-docrail__title{font-size:13px;font-weight:700;color:var(--df-ink)}
.df-docrail__note{margin-top:3px;font-size:10px;line-height:1.45;color:var(--df-ink-2)}
.df-docrail__list{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:9px;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin}
.df-docgroup{padding:5px 7px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--df-ink-2)}
.df-docitem{width:100%;display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:center;text-align:left;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--df-ink);padding:8px}
.df-docitem:hover{background:var(--df-layer-2);border-color:var(--df-border)}
.df-docitem.is-active{background:color-mix(in srgb,var(--df-brand) 10%,var(--df-layer));border-color:color-mix(in srgb,var(--df-brand) 45%,var(--df-border));color:var(--df-brand)}
.df-docitem__icon{width:24px;height:28px;border:1px solid currentColor;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;opacity:.76}
.df-docitem__label{display:block;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-docitem__path{display:block;font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-inspector{min-width:0;width:auto;height:100%;max-height:100%;display:flex;flex-direction:column;gap:11px;padding:15px;background:var(--df-layer);overflow-y:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:thin}
 .df-inspector>*{flex-shrink:0}
.df-inspector.is-collapsed{visibility:hidden;pointer-events:none;padding:0}
.df-inspector h3{margin:0;font-size:14px;color:var(--df-ink)}
.df-inspector label{display:grid;gap:4px;color:var(--df-ink-2);font-size:12px}
.df-inspector input,.df-inspector select,.df-inspector textarea{width:100%;border:1px solid var(--df-border-strong);border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px;outline:0}
.df-inspector textarea{min-height:92px;resize:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.55}
.df-inspector textarea.df-markdown-editor{min-height:300px;max-height:60vh;resize:none;background:var(--df-bg);border-radius:10px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.df-advanced{border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2);padding:0 9px}
.df-advanced summary{cursor:pointer;padding:8px 0;color:var(--df-ink-2);font-size:11px;font-weight:650}
.df-advanced__content{display:grid;gap:9px;padding:0 0 10px}
.df-pathbox{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2)}
.df-pathbox__label{font-size:10px;color:var(--df-ink-2)}
.df-pathbox__value{font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink);word-break:break-all}
.df-inspector .df-empty{color:var(--df-ink-2);font-size:12px}
.df-addbar{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 14px;border-top:1px solid var(--df-border);background:var(--df-layer)}
.df-addbar button{font-size:11px;padding:4px 9px}
.df-connect-hint{margin-left:auto;color:var(--df-ink-2);font-size:10px;white-space:nowrap}
.df-iconbtn{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:16px}
.df-splitter{position:relative;z-index:12;min-width:9px;width:9px;cursor:col-resize;touch-action:none;background:var(--df-layer);outline:0}
.df-splitter::before{content:"";position:absolute;inset:0 3px;background:var(--df-border)}
.df-splitter::after{content:"";position:absolute;top:50%;left:50%;width:3px;height:42px;transform:translate(-50%,-50%);border-radius:999px;background:var(--df-border-strong);box-shadow:0 -7px 0 var(--df-border-strong),0 7px 0 var(--df-border-strong)}
.df-splitter:hover::before,.df-splitter:focus-visible::before,.df-splitter.is-dragging::before{inset:0 2px;background:var(--df-brand)}
.df-splitter.is-collapsed{background:color-mix(in srgb,var(--df-brand) 5%,var(--df-layer))}
.df-splitter.is-collapsed::after{background:var(--df-brand);box-shadow:0 -7px 0 var(--df-brand),0 7px 0 var(--df-brand)}
.df-assistant-splitter{position:relative;z-index:10;flex:none;height:8px;cursor:row-resize;touch-action:none;background:var(--df-layer)}
.df-assistant-splitter::before{content:"";position:absolute;inset:3px 0;background:var(--df-border)}
.df-assistant-splitter::after{content:"";position:absolute;left:50%;top:50%;width:44px;height:3px;transform:translate(-50%,-50%);border-radius:999px;background:var(--df-border-strong)}
.df-assistant-splitter:hover::before,.df-assistant-splitter:focus-visible::before,.df-assistant-splitter.is-dragging::before{inset:2px 0;background:var(--df-brand)}
.df-assistant{flex:none;background:var(--df-layer);min-height:44px;display:flex;flex-direction:column;overflow:hidden}
.df-assistant.is-open{max-height:min(440px,54%)}
.df-assistant__head{height:46px;flex:none;display:flex;align-items:center;gap:8px;padding:7px 14px}
.df-assistant__spark{width:27px;height:27px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--df-brand) 12%,var(--df-layer));color:var(--df-brand);font-weight:800}
.df-assistant__title{font-size:11px;font-weight:750;color:var(--df-ink);white-space:nowrap}
.df-assistant__safe{font-size:9px;color:var(--df-ink-2);white-space:nowrap}
.df-assistant__target{max-width:190px;padding:3px 8px;border:1px solid var(--df-border);border-radius:999px;color:var(--df-ink-2);font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .df-assist-menu-wrap{position:relative;display:flex;align-items:center;flex:none}
 .df-assist-menu-btn{display:inline-flex;align-items:center;gap:4px;max-width:170px;border:1px solid var(--df-border-strong);border-radius:999px;background:var(--df-layer-2);color:var(--df-ink);padding:2px 8px;font-size:5px;line-height:1.35;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .df-assist-menu-btn:hover{border-color:var(--df-brand)}
 .df-assist-menu-caret{font-size:8px;color:var(--df-ink-2);flex:none}
 .df-assist-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:230px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid var(--df-border-strong);border-radius:14px;background:var(--df-layer);box-shadow:0 14px 36px color-mix(in srgb,var(--df-ink) 16%,transparent)}
 .df-assist-menu-item{display:flex;align-items:center;gap:6px;text-align:left;border:0;border-radius:10px;background:transparent;color:var(--df-ink);padding:8px 11px;font-size:11px;cursor:pointer}
 .df-assist-menu-item:hover{background:var(--df-layer-2)}
 .df-assist-menu-back{display:flex;align-items:center;border:0;border-radius:10px;background:transparent;color:var(--df-ink-2);padding:7px 11px;font-size:11px;cursor:pointer}
 .df-assist-menu-back:hover{background:var(--df-layer-2)}
.df-assistant__actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}
.df-assistant__head .df-btn{font-size:10px;padding:4px 8px}
.df-assistant__toggle{width:28px;height:28px;padding:0;font-size:14px}
.df-assistant__body{min-height:0;flex:1;display:grid;grid-template-columns:minmax(230px,.72fr) minmax(360px,1.28fr);gap:10px;padding:0 14px 12px;overflow:hidden}
.df-assistant__control{display:flex;min-width:0;min-height:0;flex-direction:column;gap:7px;padding:9px;border:1px solid var(--df-border);border-radius:12px;background:var(--df-layer-2);overflow:hidden}
.df-assistant__control label{flex:none;font-size:10px;color:var(--df-ink-2)}
.df-assistant__control input,.df-assistant__preview textarea{width:100%;border:1px solid var(--df-border-strong);border-radius:8px;background:var(--df-layer-2);color:var(--df-ink);padding:7px 9px;outline:0}
.df-assistant__control input:focus,.df-assistant__preview textarea:focus{border-color:var(--df-brand)}
.df-assistant__summary{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--df-ink-2);min-height:24px}
.df-count{appearance:none;padding:2px 7px;border-radius:999px;background:var(--df-layer-2);border:1px solid var(--df-border);font-size:9px;line-height:1.4;cursor:pointer}
.df-count.is-error{color:var(--df-err)}
.df-count.is-warning{color:var(--df-warn)}
.df-count:hover,.df-count:focus-visible{border-color:currentColor;outline:0}
.df-count.is-active{background:color-mix(in srgb,currentColor 14%,var(--df-layer-2));border-color:currentColor;box-shadow:inset 0 0 0 1px currentColor}
.df-findings{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:5px;padding-right:3px;scrollbar-width:thin}
.df-finding{display:grid;grid-template-columns:7px minmax(0,1fr);gap:7px;width:100%;text-align:left;border:0;border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px}
.df-finding:hover{background:color-mix(in srgb,var(--df-brand) 7%,var(--df-layer-2))}
.df-finding__dot{width:7px;height:7px;border-radius:50%;margin-top:5px;background:var(--df-ink-2)}
.df-finding.is-error .df-finding__dot{background:var(--df-err)}
.df-finding.is-warning .df-finding__dot{background:var(--df-warn)}
.df-finding__doc{display:block;color:var(--df-brand);font:8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.df-finding__message{display:block;font-size:10px;line-height:1.4}
.df-finding__suggestion{display:block;color:var(--df-ink-2);font-size:9px;line-height:1.35;margin-top:2px}
.df-assistant__preview{min-width:0;min-height:0;display:flex;flex-direction:column;border:1px solid var(--df-border);border-radius:12px;background:var(--df-bg);overflow:hidden}
.df-assistant__preview-head{position:sticky;z-index:2;top:0;flex:none;min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;border-bottom:1px solid var(--df-border);background:var(--df-layer-2);font-size:10px;color:var(--df-ink-2)}
.df-assistant__preview-head>span:last-child{display:inline-flex;align-items:center;gap:6px}
.df-assistant__preview-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-assistant__preview textarea{flex:1;min-height:0;resize:none;overflow:auto;overscroll-behavior:contain;border:0;border-radius:0 0 12px 12px;padding:10px 12px;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--df-bg);scrollbar-width:thin}
.df-assistant__pending{flex:1;min-height:0;display:grid;place-items:center;padding:18px;color:var(--df-ink-2);font-size:11px;text-align:center;overflow:auto}
.df-confirm-backdrop{position:absolute;z-index:40;inset:0;display:grid;place-items:center;padding:20px;background:color-mix(in srgb,var(--df-bg) 72%,transparent);backdrop-filter:blur(4px)}
.df-confirm{width:min(440px,100%);padding:18px;border:1px solid var(--df-border-strong);border-radius:14px;background:var(--df-layer);box-shadow:0 20px 60px color-mix(in srgb,var(--df-ink) 18%,transparent)}
.df-confirm h3{margin:0 0 8px;font-size:15px;color:var(--df-ink)}
.df-confirm p{margin:0;color:var(--df-ink-2);font-size:12px;line-height:1.65}
.df-confirm__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.df-import-hidden{display:none}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]{--dsh-composer-height:0px!important;overflow:hidden!important}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]>[data-composer-seat]{display:none!important}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]>:not([data-composer-seat]){flex:1 1 0;min-height:0;height:100%}
[data-conversation-scroll][data-deepseek-flow-immersive="true"] .deepseek-flow-root{height:100%;min-height:0}
@media(max-width:1180px){.df-status{display:none}.df-assistant__safe{display:none}.df-assistant__target{max-width:120px}.df-titlebar__note{display:none}}
@media(max-width:760px){.df-toolbar{padding:7px}.df-assistant__head{padding:7px;overflow-x:auto}.df-assistant__target{display:none}.df-assistant__body{grid-template-columns:1fr;overflow:auto;overscroll-behavior:contain}.df-assistant__control{min-height:150px}.df-findings{height:auto;min-height:80px}.df-assistant__preview{display:flex;min-height:210px}.df-assistant__head .df-btn{padding:4px 6px}.df-assistant__title{display:none}.df-tabs{padding:0 10px}.df-titlebar__badge{display:none}}
`;

// ============ 自定义节点 ============
function FlowNode({ data, selected }) {
  const kind = data.kind ?? "agent";
  const children = [
    React.createElement("div", { className: "df-node__kind" }, text(browserLanguage()).nodeKind[kind] ?? kind),
    React.createElement("div", { className: "df-node__label" }, String(data.label ?? kind)),
    (data.prompt || data.instructions) ? React.createElement("div", { className: "df-node__prompt" }, String(data.prompt ?? data.instructions)) : null,
    data.docPath ? React.createElement("div", { className: "df-node__file" }, String(data.docPath)) : null
  ];
  return React.createElement("div", { className: `df-node df-node--${kind}${selected ? " is-selected" : ""}` }, children);
}

const GRAPH_NODE_WIDTH = 208;
const GRAPH_NODE_HEIGHT = 116;
const GRAPH_MIN_ZOOM = 0.5;
const GRAPH_MAX_ZOOM = 2.5;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function graphEdgeGeometry(edge, byId) {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  const start = { x: source.position.x + GRAPH_NODE_WIDTH, y: source.position.y + GRAPH_NODE_HEIGHT / 2 };
  const end = { x: target.position.x, y: target.position.y + GRAPH_NODE_HEIGHT / 2 };
  const forward = Math.max(54, Math.abs(end.x - start.x) * 0.46);
  const bend = end.x >= start.x ? forward : Math.max(90, forward * 0.7);
  return {
    start,
    end,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    path: `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`
  };
}

function GraphCanvas({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  onInit,
  onNodeDragStart,
  onNodeMove,
  onNodeSelect,
  onEdgeSelect,
  onPaneClick,
  onConnect,
  isValidConnection,
  fitLabel,
  zoomInLabel,
  zoomOutLabel
}) {
  const rootRef = React.useRef(null);
  const cleanupRef = React.useRef(null);
  const viewportRef = React.useRef({ x: 32, y: 32, zoom: 0.8 });
  const viewportAnimationRef = React.useRef(null);
  const markerIdRef = React.useRef(`df-arrow-${Math.random().toString(36).slice(2, 10)}`);
  const [viewport, setViewport] = useState({ x: 32, y: 32, zoom: 0.8 });
  const [panning, setPanning] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const updateViewport = useCallback((value) => {
    setViewport((current) => {
      const next = typeof value === "function" ? value(current) : value;
      viewportRef.current = next;
      return next;
    });
  }, []);

  const cancelViewportAnimation = useCallback(() => {
    const active = viewportAnimationRef.current;
    if (!active) return;
    cancelAnimationFrame(active.frame);
    viewportAnimationRef.current = null;
  }, []);

  const animateViewport = useCallback((target, duration = 0) => {
    cancelViewportAnimation();
    const milliseconds = Math.max(0, Number(duration) || 0);
    if (milliseconds === 0) {
      updateViewport(target);
      return;
    }
    const start = viewportRef.current;
    const startedAt = performance.now();
    const active = { frame: 0 };
    viewportAnimationRef.current = active;
    const tick = (now) => {
      if (viewportAnimationRef.current !== active) return;
      const progress = clamp((now - startedAt) / milliseconds, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      updateViewport({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        zoom: start.zoom + (target.zoom - start.zoom) * eased
      });
      if (progress < 1) active.frame = requestAnimationFrame(tick);
      else viewportAnimationRef.current = null;
    };
    active.frame = requestAnimationFrame(tick);
  }, [cancelViewportAnimation, updateViewport]);

  const stopGesture = useCallback(() => {
    cancelViewportAnimation();
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPanning(false);
    setDraggingNode(null);
  }, [cancelViewportAnimation]);

  useEffect(() => stopGesture, [stopGesture]);

  const fitView = useCallback((options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const requestedIds = new Set((options.nodes ?? []).map((node) => typeof node === "string" ? node : node?.id).filter(Boolean));
    const visibleNodes = requestedIds.size > 0 ? nodes.filter((node) => requestedIds.has(node.id)) : nodes;
    if (visibleNodes.length === 0) return;
    const minX = Math.min(...visibleNodes.map((node) => node.position.x));
    const minY = Math.min(...visibleNodes.map((node) => node.position.y));
    const maxX = Math.max(...visibleNodes.map((node) => node.position.x + GRAPH_NODE_WIDTH));
    const maxY = Math.max(...visibleNodes.map((node) => node.position.y + GRAPH_NODE_HEIGHT));
    const paddingRatio = Number(options.padding ?? 0.16);
    const padding = Math.max(36, Math.min(rect.width, rect.height) * paddingRatio);
    const minZoom = Number(options.minZoom ?? GRAPH_MIN_ZOOM);
    const maxZoom = Number(options.maxZoom ?? 1.15);
    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);
    const zoom = clamp(Math.min((rect.width - padding * 2) / graphWidth, (rect.height - padding * 2) / graphHeight), minZoom, maxZoom);
    animateViewport({
      x: (rect.width - graphWidth * zoom) / 2 - minX * zoom,
      y: (rect.height - graphHeight * zoom) / 2 - minY * zoom,
      zoom
    }, options.duration);
  }, [animateViewport, nodes]);

  const focusNode = useCallback((id, options = {}) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const node = nodes.find((candidate) => candidate.id === id);
    if (!rect || !node) return;
    const zoom = clamp(Number(options.zoom ?? Math.max(viewportRef.current.zoom, 0.96)), GRAPH_MIN_ZOOM, 1.15);
    animateViewport({
      x: rect.width / 2 - (node.position.x + GRAPH_NODE_WIDTH / 2) * zoom,
      y: rect.height / 2 - (node.position.y + GRAPH_NODE_HEIGHT / 2) * zoom,
      zoom
    }, options.duration ?? 720);
  }, [animateViewport, nodes]);

  useEffect(() => {
    onInit?.({ fitView, focusNode });
  }, [fitView, focusNode, onInit]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom
    };
  }, [viewport]);

  const zoomAtCenter = useCallback((factor) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    cancelViewportAnimation();
    updateViewport((current) => {
      const zoom = clamp(current.zoom * factor, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      return {
        x: centerX - (centerX - current.x) * (zoom / current.zoom),
        y: centerY - (centerY - current.y) * (zoom / current.zoom),
        zoom
      };
    });
  }, [cancelViewportAnimation, updateViewport]);

  const beginPan = useCallback((event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__node,.df-graph__controls")) return;
    event.preventDefault();
    onPaneClick?.();
    stopGesture();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewport;
    setPanning(true);
    const move = (next) => setViewport({ ...origin, x: origin.x + next.clientX - startX, y: origin.y + next.clientY - startY });
    const up = () => stopGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onPaneClick, stopGesture, viewport]);

  const beginNodeDrag = useCallback((node, event) => {
    if (event.button !== 0 || event.target.closest?.(".df-graph__handle")) return;
    event.preventDefault();
    event.stopPropagation();
    stopGesture();
    onNodeSelect?.(node.id);
    onNodeDragStart?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = node.position;
    setDraggingNode(node.id);
    const move = (next) => onNodeMove?.(node.id, {
      x: origin.x + (next.clientX - startX) / viewport.zoom,
      y: origin.y + (next.clientY - startY) / viewport.zoom
    });
    const up = () => stopGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onNodeDragStart, onNodeMove, onNodeSelect, stopGesture, viewport.zoom]);

  const beginConnection = useCallback((source, event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopGesture();
    const sourceNode = byId.get(source);
    if (!sourceNode) return;
    const start = { x: sourceNode.position.x + GRAPH_NODE_WIDTH, y: sourceNode.position.y + GRAPH_NODE_HEIGHT / 2 };
    setConnectionDraft({ source, start, end: start });
    const move = (next) => setConnectionDraft((draft) => draft ? { ...draft, end: screenToWorld(next.clientX, next.clientY) } : null);
    const up = (next) => {
      const targetElement = document.elementFromPoint(next.clientX, next.clientY)?.closest?.("[data-df-target-id]");
      const target = targetElement?.getAttribute("data-df-target-id") ?? null;
      const connection = { source, target, sourceHandle: null, targetHandle: null };
      if (target && isValidConnection?.(connection)) onConnect?.(connection);
      setConnectionDraft(null);
      stopGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [byId, isValidConnection, onConnect, screenToWorld, stopGesture]);

  // 画布滚轮/手势：原生 non-passive 监听，preventDefault 才真正生效——
  // 画布内的一切滚动/缩放手势只作用于画布，不再外溢为页面滚动或浏览器缩放。
  useEffect(() => {
    const canvas = rootRef.current;
    if (!canvas) return undefined;
    const onCanvasWheel = (event) => {
      event.preventDefault();
      cancelViewportAnimation();
      const rect = canvas.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        // 缩放：Ctrl/⌘+滚轮，或触控板捏合（捏合手势带 ctrlKey）
        updateViewport((current) => {
          const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0012), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
          return {
            x: cursorX - (cursorX - current.x) * (zoom / current.zoom),
            y: cursorY - (cursorY - current.y) * (zoom / current.zoom),
            zoom
          };
        });
      } else {
        // 平移：触控板双指滑动 / 鼠标滚轮
        updateViewport((current) => ({
          ...current,
          x: current.x - (Number.isFinite(event.deltaX) ? event.deltaX : 0),
          y: current.y - (Number.isFinite(event.deltaY) ? event.deltaY : 0)
        }));
      }
    };
    canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onCanvasWheel);
  }, [cancelViewportAnimation, updateViewport]);

  const edgeElements = [];
  for (const edge of edges) {
    const geometry = graphEdgeGeometry(edge, byId);
    if (!geometry) continue;
    const selected = selectedEdge === edge.id;
    edgeElements.push(
      React.createElement("g", { key: edge.id, className: "df-graph__edge-group", "data-edge-id": edge.id },
        React.createElement("path", {
          className: `df-graph__edge${selected ? " is-selected" : ""}`,
          d: geometry.path,
          markerEnd: `url(#${markerIdRef.current})`
        }),
        React.createElement("path", {
          className: "df-graph__edge-hit",
          d: geometry.path,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.stopPropagation();
            onEdgeSelect?.(edge.id);
          }
        }),
        edge.label ? React.createElement("g", { transform: `translate(${geometry.label.x} ${geometry.label.y})` },
          React.createElement("rect", { className: "df-graph__label-bg", x: -18, y: -10, width: 36, height: 20, rx: 7 }),
          React.createElement("text", { className: "df-graph__label", x: 0, y: 1 }, String(edge.label))
        ) : null
      )
    );
  }
  if (connectionDraft) {
    const bend = Math.max(54, Math.abs(connectionDraft.end.x - connectionDraft.start.x) * 0.46);
    edgeElements.push(React.createElement("path", {
      key: "connection-draft",
      className: "df-graph__connection",
      d: `M ${connectionDraft.start.x} ${connectionDraft.start.y} C ${connectionDraft.start.x + bend} ${connectionDraft.start.y}, ${connectionDraft.end.x - bend} ${connectionDraft.end.y}, ${connectionDraft.end.x} ${connectionDraft.end.y}`
    }));
  }

  return React.createElement("div", {
    ref: rootRef,
    className: `df-canvas${panning ? " is-panning" : ""}`,
    onPointerDown: beginPan
  },
    React.createElement("div", {
      className: "df-graph__stage",
      style: { transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})` }
    },
      React.createElement("svg", { className: "df-graph__edges", width: 1, height: 1, "aria-label": "Workflow arrows" },
        React.createElement("defs", null,
          React.createElement("marker", {
            id: markerIdRef.current,
            markerWidth: 10,
            markerHeight: 10,
            refX: 9,
            refY: 5,
            orient: "auto",
            markerUnits: "strokeWidth",
            viewBox: "0 0 10 10"
          }, React.createElement("path", { d: "M 0 0 L 10 5 L 0 10 Z", fill: "var(--df-brand)" }))
        ),
        edgeElements
      ),
      nodes.map((node) => React.createElement("div", {
        key: node.id,
        className: `df-graph__node${draggingNode === node.id ? " is-dragging" : ""}`,
        style: { left: `${node.position.x}px`, top: `${node.position.y}px` },
        "data-node-id": node.id,
        onPointerDown: (event) => beginNodeDrag(node, event),
        onClick: (event) => {
          event.stopPropagation();
          onNodeSelect?.(node.id);
        }
      },
        React.createElement(FlowNode, { data: node.data, selected: selectedNode === node.id }),
        React.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--target",
          "data-df-target-id": node.id,
          "aria-label": `Connect into ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => event.stopPropagation()
        }),
        React.createElement("button", {
          type: "button",
          className: "df-graph__handle df-graph__handle--source",
          "data-df-source-id": node.id,
          "aria-label": `Connect from ${String(node.data.label ?? node.id)}`,
          onPointerDown: (event) => beginConnection(node.id, event)
        })
      ))
    ),
    React.createElement("div", { className: "df-graph__controls" },
      React.createElement("button", { type: "button", title: zoomInLabel, "aria-label": zoomInLabel, onClick: () => zoomAtCenter(1.2) }, "+"),
      React.createElement("button", { type: "button", title: zoomOutLabel, "aria-label": zoomOutLabel, onClick: () => zoomAtCenter(1 / 1.2) }, "−"),
      React.createElement("button", { type: "button", title: fitLabel, "aria-label": fitLabel, onClick: () => fitView({}) }, "⊙")
    )
  );
}

function flowToCanvasNodes(flow) {
  return (flow?.nodes ?? []).map((node) => ({
    id: node.id,
    type: "flow",
    position: node.position ?? { x: 120, y: 80 },
    data: { ...node.data, kind: node.kind, docPath: flow?.docs?.[node.id] ?? "" }
  }));
}

function flowToCanvasEdges(edges, language = browserLanguage()) {
  return (edges ?? []).map((edge) => ({
    ...edge,
    type: "workflow",
    ...(edge.label ? { label: edge.label } : {}),
    ...(!edge.label && edge.sourceHandle === "true" ? { label: language === "zh" ? "是" : "Yes" } : {}),
    ...(!edge.label && edge.sourceHandle === "false" ? { label: language === "zh" ? "否" : "No" } : {})
  }));
}

function serializeFlow(currentFlow, nodes, edges) {
  const serializedNodes = nodes.map((node) => ({
    id: node.id,
    kind: node.data.kind ?? "agent",
    position: node.position,
    data: Object.fromEntries(Object.entries(node.data).filter(([key]) => key !== "kind" && key !== "docPath"))
  }));
  return {
    ...currentFlow,
    nodes: serializedNodes,
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label ? { label: edge.label } : {}),
      ...(edge.sourceHandle === null || edge.sourceHandle === undefined ? {} : { sourceHandle: edge.sourceHandle })
    })),
    inputs: serializedNodes.filter((node) => node.kind === "input").map((node) => node.id),
    outputs: serializedNodes.filter((node) => node.kind === "output").map((node) => node.id)
  };
}

function graphSnapshot(nodes, edges) {
  return JSON.parse(JSON.stringify({ nodes, edges }));
}

function reconnectFlowEdge(oldEdge, connection, edges) {
  return edges.map((edge) => edge.id === oldEdge.id ? {
    ...edge,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? null,
    targetHandle: connection.targetHandle ?? null
  } : edge);
}

function layoutNodes(nodes, edges) {
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

function logicSnapshot(flow) {
  return JSON.stringify({
    workflowContent: String(flow?.workflowContent ?? ""),
    docs: flow?.docs ?? {},
    nodes: (flow?.nodes ?? []).map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.data?.label ?? "",
      content: node.kind === "agent" || node.kind === "mapAgent"
        ? String(node.data?.prompt ?? "")
        : String(node.data?.instructions ?? "")
    })),
    edges: (flow?.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? "",
      targetHandle: edge.targetHandle ?? ""
    }))
  });
}

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
  const [workflowOptimizeConfirm, setWorkflowOptimizeConfirm] = useState(false);
  const fileRef = React.useRef(null);
  const documentTimerRef = React.useRef(null);
  const fitTimerRef = React.useRef(null);
  const documentWriteChainRef = React.useRef(Promise.resolve());
  const documentRevisionRef = React.useRef(0);
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
    currentIdRef.current = flow.id;
    setCurrentId(flow.id);
    setNodes(flowToCanvasNodes(flow));
    setEdges(flowToCanvasEdges(flow.edges, language));
    historyRef.current = { past: [], future: [] };
    setSelectedEdge(null);
    setValidationResult(null);
    setFindingFilter(null);
    setOptimizationProposal(null);
    setAssistantDraft("");
    setWorkflowOptimizeConfirm(false);
    if (options.resetDocument !== false) {
      setSelected(null);
      setActiveDoc("workflow");
    }
  }, [language, setEdges, setNodes]);

  const loadFlows = useCallback(async () => {
    try {
      const items = await remoteCall(connection, "dflow/list", { sessionId });
      setFlows(items);
      const first = items.find((item) => item.id === currentIdRef.current) ?? items[0];
      if (first) {
        showFlow(first, { resetDocument: currentIdRef.current !== first.id });
      } else {
        currentIdRef.current = null;
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
                if (finalEntry.status === "done" && finalEntry.result) {
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
              if (finalEntry.status === "done" && finalEntry.result) {
                setValidationResult({
                  ...finalEntry.result,
                  snapshot: nodesRef.current ? { nodeIds: nodesRef.current.map((node) => node.id) } : [],
                  checkedAt: new Date().toISOString()
                });
                setFindingFilter(null);
                setMessage(t.validationComplete);
              } else {
                setMessage(t.assistantFailed + String(finalEntry.error ?? ""));
              }
              activeAssistRef.current = null;
              setAssistantBusy(null);
            });
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
    if (pollTimerRef.current) pollTimerRef.current();
    fitTimerRef.current = setTimeout(() => {
      fitTimerRef.current = null;
      flowInstance.fitView({ padding: 0.18, minZoom: GRAPH_MIN_ZOOM, maxZoom: 1.15, duration: 320 });
    }, 600);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    if (pollTimerRef.current) pollTimerRef.current();
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
  const selectedNode = nodes.find((n) => n.id === selected) ?? null;

  const scheduleDocumentSave = useCallback((flowSnapshot, nodeSnapshot, edgeSnapshot) => {
    if (!flowSnapshot?.id) return;
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    const revision = ++documentRevisionRef.current;
    setMessage(t.autoSaving);
    documentTimerRef.current = setTimeout(() => {
      const payload = serializeFlow(flowSnapshot, nodeSnapshot, edgeSnapshot);
      documentTimerRef.current = null;
      documentWriteChainRef.current = documentWriteChainRef.current.catch(() => {}).then(async () => {
        try {
          const saved = await remoteCall(connection, "dflow/put", { flow: payload, sessionId });
          if (documentRevisionRef.current === revision) {
            setFlows((items) => items.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
            setDirty(false);
            setMessage(t.autoSaved);
          }
        } catch (error) {
          if (documentRevisionRef.current === revision) setMessage(String(error));
        }
      });
    }, 650);
  }, [connection, sessionId, t.autoSaved, t.autoSaving]);

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

  const onConnect = useCallback((conn) => {
    rememberGraph();
    setEdges((eds) => [...eds, {
      ...conn,
      id: `e-${Math.random().toString(36).slice(2, 9)}`,
      type: "workflow"
    }]);
    ++documentRevisionRef.current;
    setDirty(true);
  }, [rememberGraph]);

  const onReconnect = useCallback((oldEdge, connectionParams) => {
    rememberGraph();
    setEdges((items) => reconnectFlowEdge(oldEdge, connectionParams, items).map((edge) => edge.id === oldEdge.id
      ? {
          ...edge,
          label: connectionParams.sourceHandle === "true" ? (language === "zh" ? "是" : "Yes")
            : connectionParams.sourceHandle === "false" ? (language === "zh" ? "否" : "No") : undefined
        }
      : edge));
    ++documentRevisionRef.current;
    setDirty(true);
  }, [language, rememberGraph, setEdges]);

  const isValidConnection = useCallback((connectionParams) => {
    if (!connectionParams.source || !connectionParams.target || connectionParams.source === connectionParams.target) return false;
    return !edgesRef.current.some((edge) => edge.source === connectionParams.source
      && edge.target === connectionParams.target);
  }, []);

  const moveNode = useCallback((id, position) => {
    setNodes((items) => items.map((node) => node.id === id ? { ...node, position } : node));
    ++documentRevisionRef.current;
    setDirty(true);
  }, []);

  const addNode = (kind) => {
    rememberGraph();
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node = {
      id,
      type: "flow",
      position: { x: 120 + Math.random() * 220, y: 80 + Math.random() * 160 },
      data: {
        kind,
        label: t.nodeKind[kind] ?? kind,
        ...(kind === "agent" || kind === "mapAgent" ? { prompt: "{{input}}" } : {})
      }
    };
    setNodes((nds) => [...nds, node]);
    setSelected(id);
    setSelectedEdge(null);
    setActiveDoc(id);
    ++documentRevisionRef.current;
    setDirty(true);
  };

  const patchSelected = (patch) => {
    const nextNodes = nodes.map((node) => node.id === selected ? { ...node, data: { ...node.data, ...patch } } : node);
    setNodes(nextNodes);
    setDirty(true);
    if (Object.hasOwn(patch, "prompt") || Object.hasOwn(patch, "instructions")) {
      scheduleDocumentSave(currentFlow, nextNodes, edges);
    } else {
      ++documentRevisionRef.current;
    }
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
    const flow = serializeFlow({ ...currentFlow, id: currentId, name: currentFlow?.name ?? currentId }, nodes, edges);
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
    documentTimerRef.current = null;
    ++documentRevisionRef.current;
    setMessage(t.saving);
    try {
      await documentWriteChainRef.current.catch(() => {});
      const saved = await remoteCall(connection, "dflow/put", { flow, sessionId });
      setFlows((items) => items.map((item) => item.id === saved.id ? saved : item));
      showFlow(saved, { resetDocument: false });
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
      currentIdRef.current = flow.id;
      setCurrentId(flow.id);
      setFlows((fs) => [flow, ...fs.filter((f) => f.id !== flow.id)]);
      setNodes(flowToCanvasNodes(flow));
      setEdges(flowToCanvasEdges(flow.edges, language));
      setSelected(null);
      setActiveDoc("workflow");
      setDirty(true);
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
        if (entry.status === "done" && entry.result) {
          setValidationResult({ ...entry.result, snapshot: logicSnapshot(flow), checkedAt: new Date().toISOString() });
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
        if (entry.status === "done" && entry.result) {
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

  const runWorkflowOptimization = async () => {
    if (!currentFlow) return;
    setWorkflowOptimizeConfirm(false);
    const agentRequestId = newRequestId();
    const flow = serializeFlow(currentFlow, nodes, edges);
    const flowId = flow.id;
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
      pollTimerRef.current = pollAssist(agentRequestId, async (entry) => {
        if (entry.status !== "done" || !entry.result) {
          setMessage(t.assistantFailed + String(entry.error ?? ""));
          activeAssistRef.current = null;
          setAssistantBusy(null);
          return;
        }
        const result = entry.result;
        if (documentRevisionRef.current !== sourceRevision) {
          setMessage(t.workflowChangedDuringOptimization);
          activeAssistRef.current = null;
          setAssistantBusy(null);
          return;
        }
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
        if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
        documentTimerRef.current = null;
        ++documentRevisionRef.current;
        await documentWriteChainRef.current.catch(() => {});
        const saved = await remoteCall(connection, "dflow/put", { flow: optimizedFlow, sessionId });
        if (currentIdRef.current !== flowId) {
          activeAssistRef.current = null;
          setAssistantBusy(null);
          return;
        }
        setFlows((items) => items.map((item) => item.id === saved.id ? saved : item));
        showFlow(saved, { resetDocument: false });
        setDirty(false);
        setMessage(result.summary ? `${t.workflowOptimized}：${result.summary}` : t.workflowOptimized);
        activeAssistRef.current = null;
        setAssistantBusy(null);
      });
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
            React.createElement("label", { key: "predicate" }, t.predicate,
              React.createElement("select", { value: selectedNode.data.predicate ?? "truthy", onChange: (e) => patchSelected({ predicate: e.target.value }) },
                ["truthy", "falsy", "nonEmpty"].map((p) => React.createElement("option", { key: p, value: p }, p))
              )
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
  );

  const findings = validationResult?.findings ?? [];
  const visibleFindings = findingFilter
    ? findings.filter((finding) => finding.level === findingFilter)
    : findings;
  const counts = validationResult?.summary?.counts ?? { error: 0, warning: 0 };
  const currentLogicSnapshot = currentFlow ? logicSnapshot(serializeFlow(currentFlow, nodes, edges)) : "";
  const validationStale = Boolean(validationResult && validationResult.snapshot !== currentLogicSnapshot);
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
        React.createElement("button", { className: "df-btn is-primary", "data-df-action": "logic-validation", disabled: !currentFlow, onClick: runLogicValidation }, assistantBusy === "logic" ? t.agentLogicBusy : t.logicValidation),
        React.createElement("button", { className: "df-btn", "data-df-action": "optimize-document", disabled: !currentFlow, onClick: runDocumentOptimization }, runningDocs.get(assistantTarget) !== undefined ? t.agentOptimizeBusy : t.aiOptimize),
        React.createElement("button", { className: "df-btn", "data-df-action": "optimize-workflow", disabled: !currentFlow, onClick: () => setWorkflowOptimizeConfirm(true) }, assistantBusy === "optimize-workflow" ? t.agentWorkflowBusy : t.aiOptimizeWorkflow),
        (assistantBusy || runningDocs.get(assistantTarget) !== undefined) && React.createElement("button", {
          className: "df-btn is-ghost",
          "data-df-action": "cancel-agent",
          disabled: assistantBusy === "cancelling",
          onClick: assistantBusy ? cancelAssistant : () => cancelOptimizeFor(assistantTarget)
        }, assistantBusy === "cancelling" ? "…" : t.cancelAgent),
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
                }, `Warn ${counts.warning ?? 0}`),
                validationStale && React.createElement("span", { key: "stale", className: "df-count is-warning" }, t.validationStale)
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
      toolbar,
      React.createElement(GraphCanvas, {
        nodes,
        edges,
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
        onReconnect,
        isValidConnection,
        fitLabel: t.fitAll,
        zoomInLabel: t.zoomIn,
        zoomOutLabel: t.zoomOut
      }),
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
