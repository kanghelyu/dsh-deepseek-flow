import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const serveOnly = process.argv.includes("--serve");
const portIndex = process.argv.indexOf("--port");
const requestedPort = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 3101;
const outputArgument = process.argv.find((argument, index) => index > 1 && !argument.startsWith("--") && process.argv[index - 1] !== "--port");
const outputDir = resolve(root, outputArgument ?? "qa");
const tempDir = resolve(root, "qa/.tmp");
await mkdir(outputDir, { recursive: true });
await mkdir(tempDir, { recursive: true });
process.env.TMPDIR = tempDir;

const stylesSource = await readFile(resolve(root, "src/client/styles.js"), "utf8");
const stylesMatch = stylesSource.match(/export const styles = String\.raw`([\s\S]*?)`;\n/);
if (!stylesMatch) throw new Error("Unable to extract DeepSeekFlow styles");
const pluginStyles = stylesMatch[1];

const nodeSpecs = [
  ["input", "input", "输入", 40, 250],
  ["research", "agent", "资料核对", 300, 250],
  ["plan", "agent", "规划", 560, 250],
  ["build", "agent", "实现", 820, 250],
  ["review", "condition", "逻辑判断", 1080, 250],
  ["qa", "agent", "截图质检", 1340, 150],
  ["fix", "agent", "修复建议", 1340, 390],
  ["deliver", "agent", "交付整理", 1600, 250],
  ["archive", "agent", "文档归档", 1860, 250],
  ["output", "output", "输出", 2120, 250]
];
const edgeSpecs = [
  ["input", "research"], ["research", "plan"], ["plan", "build"], ["build", "review"],
  ["review", "qa", "是"], ["review", "fix", "否"], ["fix", "qa"],
  ["qa", "deliver"], ["deliver", "archive"], ["archive", "output"],
  ["qa", "fix", "反馈 3", true]
];
const byId = new Map(nodeSpecs.map((node) => [node[0], node]));
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function edgePath(sourceId, targetId, feedback = false) {
  const sourceNode = byId.get(sourceId);
  const targetNode = byId.get(targetId);
  const sx = sourceNode[3] + 208;
  const sy = sourceNode[4] + 58;
  const tx = targetNode[3];
  const ty = targetNode[4] + 58;
  const reverse = feedback || tx < sx;
  const bend = reverse ? Math.max(108, Math.abs(tx - sx) * 0.56) : Math.max(54, Math.abs(tx - sx) * 0.46);
  const lift = reverse ? -72 : 0;
  return {
    d: reverse
      ? `M ${sx} ${sy} C ${sx + bend} ${sy + lift}, ${tx - bend} ${ty + lift}, ${tx} ${ty}`
      : `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`,
    x: (sx + tx) / 2,
    y: (sy + ty) / 2 + lift / 2
  };
}

function graphMarkup() {
  const edges = edgeSpecs.map(([sourceId, targetId, label, feedback], index) => {
    const geometry = edgePath(sourceId, targetId, feedback);
    return `<g class="df-graph__edge-group" data-edge-id="edge-${index + 1}"><path class="df-graph__edge${feedback ? " is-feedback" : ""}" d="${geometry.d}" marker-end="url(#df-arrow-qa)"></path><path class="df-graph__edge-hit" d="${geometry.d}"></path>${label ? `<g transform="translate(${geometry.x} ${geometry.y})"><rect class="df-graph__label-bg" x="-24" y="-10" width="48" height="20" rx="7"></rect><text class="df-graph__label" x="0" y="1">${label}</text></g>` : ""}</g>`;
  }).join("");
  const nodes = nodeSpecs.map(([id, kind, label, x, y]) => `<div class="df-graph__node" data-node-id="${id}" style="left:${x}px;top:${y}px"><div class="df-node df-node--${kind}"><div class="df-node__kind">${kind.toUpperCase()}</div><div class="df-node__label">${esc(label)}</div><div class="df-node__prompt">完成“${esc(label)}”，记录输入、输出、失败回退与验收标准。</div><div class="df-node__file">${id}/STEP.md</div></div><button class="df-graph__handle df-graph__handle--target" data-df-target-id="${id}" aria-label="connect in"></button><button class="df-graph__handle df-graph__handle--source" data-df-source-id="${id}" aria-label="connect out"></button></div>`).join("");
  return `<div class="df-canvas"><div class="df-graph__stage" style="transform:translate(38px,126px) scale(.25)"><svg class="df-graph__edges" width="1" height="1" aria-label="Workflow arrows"><defs><marker id="df-arrow-qa" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth" viewBox="0 0 10 10"><path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--df-brand)"></path></marker></defs>${edges}</svg>${nodes}</div><div class="df-graph__controls"><button>+</button><button>−</button><button>⊙</button></div></div>`;
}

function documentRail(collapsed) {
  if (collapsed) return `<aside class="df-docrail is-collapsed"></aside>`;
  return `<aside class="df-docrail"><div class="df-docrail__head"><div class="df-docrail__title">工作流文档</div><div class="df-docrail__note">先读 WORKFLOW.md，再按顺序执行 STEP.md</div></div><div class="df-docrail__list"><div class="df-docgroup">总控流程</div><button class="df-docitem is-active"><span class="df-docitem__icon">MD</span><span><span class="df-docitem__label">WORKFLOW.md</span><span class="df-docitem__path">/qa/math-workspace/flow-docs</span></span></button><div class="df-docgroup">分步工作区</div>${nodeSpecs.slice(0, 6).map((node, index) => `<button class="df-docitem"><span class="df-docitem__icon">${String(index + 1).padStart(2, "0")}</span><span><span class="df-docitem__label">${esc(node[2])}</span><span class="df-docitem__path">${node[0]}/STEP.md</span></span></button>`).join("")}</div></aside>`;
}

function inspector(collapsed) {
  if (collapsed) return `<aside class="df-inspector is-collapsed"></aside>`;
  return `<aside class="df-inspector"><div class="df-inspector__scroll"><h3>箭头属性</h3><div class="df-pathbox"><span class="df-pathbox__label">连线</span><span class="df-pathbox__value">截图质检 -> 修复建议</span></div><div class="df-advanced__content"><strong>有界反馈循环</strong><span style="color:var(--df-ink-2);font-size:12px">反馈箭头只表达当前 Session 控制的有限重试；它不参与单次布尔求值，也不会自动执行步骤。</span><label>最大重试次数<input type="number" min="1" max="1000" value="3"></label><label>退出条件<textarea>截图和质量检查全部通过</textarea></label></div></div></aside>`;
}

function assistant(collapsed) {
  const findings = Array.from({ length: 8 }, (_, index) => `<button class="df-finding ${index < 2 ? "is-error" : "is-warning"}"><span class="df-finding__dot"></span><span><span class="df-finding__doc">${index === 0 ? "WORKFLOW.md" : `0${Math.min(index + 1, 9)}-step/STEP.md`}</span><span class="df-finding__message">${index < 2 ? "缺少关键输入输出契约" : "完成标准需要更明确"}</span></span></button>`).join("");
  return `<div class="df-addbar"><span class="df-node__kind">新建流程框</span>${["输入", "Agent", "条件", "合并", "输出"].map((label) => `<button class="df-btn">${label}</button>`).join("")}<span class="df-connect-hint">拖动流程框右侧圆点到另一流程框左侧圆点即可新建箭头</span></div><div class="df-assistant-splitter${collapsed ? " is-collapsed" : ""}" role="separator"></div><section class="df-assistant${collapsed ? "" : " is-open"}" style="height:${collapsed ? 44 : 240}px"><div class="df-assistant__head"><span class="df-assistant__spark">✦</span><span class="df-assistant__title">AI 文档助手</span><span class="df-assistant__safe">全程手动 · 一次性 Agent · 不运行流程</span><span class="df-assistant__target">WORKFLOW.md</span><div class="df-assistant__actions"><button class="df-btn is-primary" data-df-action="logic-validation">逻辑校验</button><button class="df-btn" data-df-action="optimize-document">AI 优化当前文档</button><button class="df-btn" data-df-action="optimize-workflow">AI 优化整个工作流</button></div></div>${collapsed ? "" : `<div class="df-assistant__body"><div class="df-assistant__control"><label>当前操作的优化要求（可选）<input placeholder="例如：强调截图质检和失败回退"></label><div class="df-assistant__summary"><span>8 项校验结果</span><button class="df-count is-error" data-df-filter="error" aria-pressed="false">Error 2</button><button class="df-count is-warning" data-df-filter="warning" aria-pressed="false">Warn 6</button></div><div class="df-findings">${findings}</div></div><div class="df-assistant__preview"><div class="df-assistant__preview-head"><span class="df-assistant__preview-title">接受或拒绝修改 · WORKFLOW.md · 完整 Markdown 修改方案</span><span><button class="df-btn is-ghost">拒绝修改</button><button class="df-btn is-primary">接受修改</button></span></div><textarea># 数学科普动画工作流\n\n## 目标\n\n以 Markdown 为唯一事实来源。\n\n## 执行顺序\n\n1. 读取输入。\n2. 完成规划。\n3. 生成实现。\n4. 截图质检。\n5. 修复问题。\n6. 整理交付。\n\n## 异常与回退\n\n- 逻辑校验失败时定位对应文档。\n- 真实执行由当前 Session 完成。\n\n## 验收标准\n\n- 文档之间没有矛盾。\n- 每个步骤都有明确输入、输出与完成标准。</textarea></div></div>`}</section>`;
}

function html(theme, narrow = false) {
  const dark = theme === "dark";
  const tokens = dark
    ? `--dsw-alias-bg-base:#101216;--dsw-alias-bg-layer-1:#171a20;--dsw-alias-bg-layer-2:#20242c;--dsw-alias-border-l1:#2b303a;--dsw-alias-border-l2:#3a414e;--dsw-alias-brand-primary:#78a8ff;--dsw-alias-label-primary:#eef2f8;--dsw-alias-label-secondary:#aeb7c6;--dsw-alias-label-primary-inverse:#101216;--dsw-alias-state-success-primary:#60d394;--dsw-alias-state-warn-primary:#f1c86b;--dsw-alias-state-error-primary:#ff7f87;`
    : `--dsw-alias-bg-base:#f5f7fa;--dsw-alias-bg-layer-1:#ffffff;--dsw-alias-bg-layer-2:#f0f3f7;--dsw-alias-border-l1:#dfe3ea;--dsw-alias-border-l2:#c9d0da;--dsw-alias-brand-primary:#356fe5;--dsw-alias-label-primary:#1d2430;--dsw-alias-label-secondary:#697386;--dsw-alias-label-primary-inverse:#ffffff;--dsw-alias-state-success-primary:#238a59;--dsw-alias-state-warn-primary:#a76b12;--dsw-alias-state-error-primary:#c6414c;`;
  const leftWidth = narrow ? 0 : 264;
  const rightWidth = narrow ? 0 : 380;
  return `<!doctype html><html style="${tokens}color-scheme:${theme}"><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--dsw-alias-bg-base)}.host-shell{height:100%;display:grid;grid-template-rows:72px minmax(0,1fr);font-family:system-ui,-apple-system,sans-serif}.host-header{display:flex;align-items:end;justify-content:space-between;padding:0 22px 10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-bottom:1px solid var(--dsw-alias-border-l1)}.host-tabs{display:flex;gap:8px}.host-tab{padding:7px 12px;border-radius:8px;color:var(--dsw-alias-label-secondary)}.host-tab.active{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}[data-conversation-scroll]{min-height:0;display:flex;flex-direction:column}.host-view{flex:1;min-height:0}.host-composer{height:90px;background:var(--dsw-alias-bg-layer-1);border-top:1px solid var(--dsw-alias-border-l1);padding:14px}.host-composer input{width:100%;height:44px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px}${pluginStyles}</style></head><body><div class="host-shell"><header class="host-header"><strong>数学科普动画</strong><div class="host-tabs"><span class="host-tab">Chat</span><span class="host-tab active">DeepSeek Flow</span></div></header><div data-conversation-scroll data-deepseek-flow-immersive="true"><div class="host-view"><div class="deepseek-flow-root" data-df-immersive-view="true"><nav class="df-tabs"><span class="df-titlebar__title">流程设计</span><span class="df-titlebar__badge">仅编辑</span><span class="df-titlebar__note">执行请回到当前 Session</span><span class="df-titlebar__rev">rev QA</span></nav><main class="df-main"><div class="df-studio" style="grid-template-columns:${leftWidth}px 9px minmax(0,1fr) 9px ${rightWidth}px">${documentRail(narrow)}<div class="df-splitter df-splitter--left${narrow ? " is-collapsed" : ""}" role="separator"></div><div class="df-canvas-shell"><div class="df-toolbar"><label>工作流 <select><option>数学科普动画 · 文档优先</option></select></label><button class="df-btn is-ghost">导入 JSON</button><button class="df-btn is-ghost">导出 JSON</button><button class="df-btn">保存</button><button class="df-btn is-ghost">撤销</button><button class="df-btn is-ghost">重做</button><button class="df-btn is-ghost">一键整理</button><button class="df-btn is-ghost">显示全图</button></div>${graphMarkup()}${assistant(narrow)}</div><div class="df-splitter df-splitter--right${narrow ? " is-collapsed" : ""}" role="separator"></div>${inspector(narrow)}</div></main></div></div><div data-composer-seat class="host-composer" aria-hidden="true" inert><input placeholder="Session 输入框不应在 Flow 中显示"></div></div></div></body></html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
  const narrow = url.searchParams.get("narrow") === "1";
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html(theme, narrow));
});
await new Promise((resolvePromise) => server.listen(serveOnly ? requestedPort : 0, "127.0.0.1", resolvePromise));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
if (serveOnly) {
  console.log(`DeepSeek Flow visual QA preview: ${base}`);
  await new Promise(() => {});
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.DF_CHROMIUM_PATH || chromium.executablePath() });

async function inspect(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const edges = [...document.querySelectorAll(".df-graph__edge")];
    const nodes = [...document.querySelectorAll(".df-graph__node")];
    const handleChecks = nodes.map((node) => {
      const nodeRect = rect(node);
      const handles = [...node.querySelectorAll(".df-graph__handle")].map(rect);
      return {
        count: handles.length,
        leftDelta: handles[0] ? Math.abs(handles[0].x + handles[0].width / 2 - nodeRect.x) : 999,
        rightDelta: handles[1] ? Math.abs(handles[1].x + handles[1].width / 2 - nodeRect.right) : 999,
        verticalDelta: handles.length === 2 ? Math.max(...handles.map((handle) => Math.abs(handle.y + handle.height / 2 - (nodeRect.y + nodeRect.height / 2)))) : 999
      };
    });
    const canvas = rect(document.querySelector(".df-canvas"));
    const assistant = rect(document.querySelector(".df-assistant"));
    const composer = document.querySelector("[data-composer-seat]");
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      markerCount: document.querySelectorAll(".df-graph__edges marker").length,
      edgePaint: edges.map((edge) => ({ fill: getComputedStyle(edge).fill, strokeWidth: getComputedStyle(edge).strokeWidth, markerEnd: edge.getAttribute("marker-end") })),
      handleChecks,
      composerDisplay: getComputedStyle(composer).display,
      minimapCount: document.querySelectorAll(".react-flow__minimap,.df-minimap").length,
      splitters: document.querySelectorAll(".df-splitter[role=separator]").length,
      assistantSplitter: document.querySelectorAll(".df-assistant-splitter[role=separator]").length,
      findingFilters: [...document.querySelectorAll("[data-df-filter]")].map((button) => ({
        tag: button.tagName,
        cursor: getComputedStyle(button).cursor,
        pressed: button.getAttribute("aria-pressed")
      })),
      workflowOptimizationButtons: document.querySelectorAll('[data-df-action="optimize-workflow"]').length,
      previewHeaderPosition: document.querySelector(".df-assistant__preview-head")
        ? getComputedStyle(document.querySelector(".df-assistant__preview-head")).position : null,
      findingsOverflow: document.querySelector(".df-findings")
        ? getComputedStyle(document.querySelector(".df-findings")).overflowY : null,
      previewOverflow: document.querySelector(".df-assistant__preview textarea")
        ? getComputedStyle(document.querySelector(".df-assistant__preview textarea")).overflowY : null,
      assistantOverlapsCanvas: assistant.y < canvas.bottom - 0.5,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight
    };
  });
}

async function openCase({ theme, width, height, name, narrow = false }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, locale: "zh-CN" });
  const page = await context.newPage();
  await page.goto(`${base}/?theme=${theme}&narrow=${narrow ? 1 : 0}`, { waitUntil: "networkidle" });
  const diagnostics = await inspect(page);
  if (diagnostics.nodeCount !== 10 || diagnostics.edgeCount !== 10 || diagnostics.markerCount !== 1) throw new Error(`Graph count failed in ${name}: ${JSON.stringify(diagnostics)}`);
  if (diagnostics.edgePaint.some((edge) => edge.fill !== "none" || Number.parseFloat(edge.strokeWidth) < 2.6 || !edge.markerEnd)) throw new Error(`Arrow paint failed in ${name}: ${JSON.stringify(diagnostics.edgePaint)}`);
  if (diagnostics.handleChecks.some((check) => check.count !== 2 || check.leftDelta > 1 || check.rightDelta > 1 || check.verticalDelta > 1)) throw new Error(`Handle geometry failed in ${name}: ${JSON.stringify(diagnostics.handleChecks)}`);
  if (diagnostics.composerDisplay !== "none" || diagnostics.minimapCount !== 0) throw new Error(`Immersive surface failed in ${name}: ${JSON.stringify(diagnostics)}`);
  if (!narrow && (diagnostics.findingFilters.length !== 2 || diagnostics.findingFilters.some((button) => button.tag !== "BUTTON" || button.cursor !== "pointer" || button.pressed !== "false"))) throw new Error(`Finding filter controls failed in ${name}: ${JSON.stringify(diagnostics.findingFilters)}`);
  if (!narrow && (diagnostics.workflowOptimizationButtons !== 1 || diagnostics.previewHeaderPosition !== "sticky" || diagnostics.findingsOverflow !== "auto" || diagnostics.previewOverflow !== "auto")) throw new Error(`Assistant layout failed in ${name}: ${JSON.stringify(diagnostics)}`);
  if (diagnostics.splitters !== 2 || diagnostics.assistantSplitter !== 1 || diagnostics.assistantOverlapsCanvas || diagnostics.overflowX > 0 || diagnostics.overflowY > 0) throw new Error(`Layout failed in ${name}: ${JSON.stringify(diagnostics)}`);
  await page.screenshot({ path: resolve(outputDir, name) });
  await context.close();
  return diagnostics;
}

try {
  const results = {
    dark: await openCase({ theme: "dark", width: 1680, height: 950, name: "ui-preview-1680-v9-dark.png" }),
    light: await openCase({ theme: "light", width: 1680, height: 950, name: "ui-preview-1680-v9-light.png" }),
    narrow: await openCase({ theme: "dark", width: 900, height: 760, name: "ui-preview-900-v9-dark-collapsed.png", narrow: true })
  };
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
