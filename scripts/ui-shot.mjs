// DeepSeekFlow UI 自动截图（本地 debug 用）：打开 dsh web → 切到 DeepSeek Flow → 截图
// 用法: node scripts/ui-shot.mjs [输出路径]
// 可选环境变量:
//   DF_UA=1 使用 Playwright 默认 Chromium
//   DF_SESSION_NAME=... 指定会话名
//   DF_COLOR_SCHEME=light|dark 指定截图主题偏好
import { chromium } from "playwright";

const out = process.argv[2] ?? "/tmp/df-ui.png";
const executablePath = process.env.DF_UA ? undefined : "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const sessionName = process.env.DF_SESSION_NAME ?? "数学科普动画";
const colorScheme = process.env.DF_COLOR_SCHEME === "light" ? "light" : "dark";

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});
const context = await browser.newContext({ viewport: { width: 1680, height: 950 }, colorScheme });
const page = await context.newPage();
await page.setExtraHTTPHeaders({ "Cache-Control": "no-cache", Pragma: "no-cache" });
try {
  await page.goto(`http://127.0.0.1:3080/?df-client-rev=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6000); // SPA 首屏
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  // 1) 点左侧会话列表第一项（进入会话视图，标签栏才会出现）
  const sessionItem = page.getByText(sessionName).first();
  if (await sessionItem.count()) {
    await sessionItem.click({ force: true });
    await page.waitForTimeout(6000);
  } else {
    // 兜底：点第一个会话行
    const anySession = page.locator("aside li, aside [class*=item]").first();
    if (await anySession.count()) await anySession.click({ force: true });
    await page.waitForTimeout(6000);
  }
  // 2) 切到 DeepSeek Flow 标签
  const tab = page.locator("text=DeepSeek Flow").first();
  if (await tab.count()) { await tab.click(); }
  await page.waitForTimeout(6000); // 等待画布渲染
  const edgeDiagnostics = await page.evaluate(() => {
    const edges = [...document.querySelectorAll(".df-graph__edge")];
    const firstPath = edges[0] ?? null;
    const style = firstPath ? getComputedStyle(firstPath) : null;
    const handleChecks = [...document.querySelectorAll(".df-graph__node")].map((node) => {
      const nodeRect = node.getBoundingClientRect();
      const handles = [...node.querySelectorAll(".df-graph__handle")].map((handle) => handle.getBoundingClientRect());
      return {
        count: handles.length,
        leftDelta: handles[0] ? Math.abs(handles[0].x + handles[0].width / 2 - nodeRect.x) : 999,
        rightDelta: handles[1] ? Math.abs(handles[1].x + handles[1].width / 2 - nodeRect.right) : 999,
        verticalDelta: handles.length === 2 ? Math.max(...handles.map((handle) => Math.abs(handle.y + handle.height / 2 - (nodeRect.y + nodeRect.height / 2)))) : 999
      };
    });
    return {
      clientRevision: document.querySelector(".df-titlebar__rev")?.textContent?.trim() ?? null,
      nodeCount: document.querySelectorAll(".df-graph__node").length,
      edgeCount: edges.length,
      markerCount: document.querySelectorAll(".df-graph__edges marker").length,
      markerEnd: firstPath?.getAttribute("marker-end") ?? null,
      fill: style?.fill ?? null,
      stroke: style?.stroke ?? null,
      strokeWidth: style?.strokeWidth ?? null,
      transform: document.querySelector(".df-graph__stage")?.style.transform ?? null,
      handleChecks,
      minimapCount: document.querySelectorAll(".react-flow__minimap,.df-minimap").length,
      composerDisplay: getComputedStyle(document.querySelector("[data-composer-seat]")).display,
      splitters: document.querySelectorAll(".df-splitter[role=separator]").length,
      assistantSplitter: document.querySelectorAll(".df-assistant-splitter[role=separator]").length,
      canvasBottom: document.querySelector(".df-canvas")?.getBoundingClientRect().bottom ?? null,
      assistantTop: document.querySelector(".df-assistant")?.getBoundingClientRect().top ?? null,
      logicValidationButtons: document.querySelectorAll('[data-df-action="logic-validation"]').length,
      documentOptimizationButtons: document.querySelectorAll('[data-df-action="optimize-document"]').length,
      workflowOptimizationButtons: document.querySelectorAll('[data-df-action="optimize-workflow"]').length,
      topNewButtons: [...document.querySelectorAll(".df-toolbar button")].filter((button) => /^(新建|New)$/.test((button.textContent ?? "").trim())).length,
      findingFilterButtons: [...document.querySelectorAll("[data-df-filter]")].map((element) => ({
        tag: element.tagName,
        filter: element.getAttribute("data-df-filter")
      })),
      legacyDebugButtons: [...document.querySelectorAll("button")].filter((button) => /静态\s*Debug|Static\s*debug/i.test(button.textContent ?? "")).length,
      invalidFindingLevels: [...document.querySelectorAll("[data-df-finding-level]")].filter((finding) => !["error", "warning"].includes(finding.dataset.dfFindingLevel)).length,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight
    };
  });
  console.log("edge diagnostics", JSON.stringify(edgeDiagnostics));
  if (edgeDiagnostics.nodeCount > 1 && (edgeDiagnostics.edgeCount === 0 || edgeDiagnostics.markerCount === 0 || !edgeDiagnostics.markerEnd)) {
    throw new Error(`Arrow assertion failed: ${JSON.stringify(edgeDiagnostics)}`);
  }
  if (edgeDiagnostics.fill !== "none" || Number.parseFloat(edgeDiagnostics.strokeWidth) < 2.6) {
    throw new Error(`Edge paint assertion failed: ${JSON.stringify(edgeDiagnostics)}`);
  }
  if (edgeDiagnostics.handleChecks.some((check) => check.count !== 2 || check.leftDelta > 1 || check.rightDelta > 1 || check.verticalDelta > 1)) {
    throw new Error(`Handle geometry assertion failed: ${JSON.stringify(edgeDiagnostics.handleChecks)}`);
  }
  if (edgeDiagnostics.minimapCount !== 0 || edgeDiagnostics.composerDisplay !== "none") {
    throw new Error(`Immersive view assertion failed: ${JSON.stringify(edgeDiagnostics)}`);
  }
  if (edgeDiagnostics.splitters !== 2 || edgeDiagnostics.assistantSplitter !== 1) {
    throw new Error(`Resizable panel assertion failed: ${JSON.stringify(edgeDiagnostics)}`);
  }
  if (edgeDiagnostics.logicValidationButtons !== 1 || edgeDiagnostics.documentOptimizationButtons !== 1 || edgeDiagnostics.workflowOptimizationButtons !== 1 || edgeDiagnostics.topNewButtons !== 0 || edgeDiagnostics.legacyDebugButtons !== 0 || edgeDiagnostics.invalidFindingLevels !== 0) {
    throw new Error(`Manual document assistant assertion failed: ${JSON.stringify(edgeDiagnostics)}`);
  }
  if (edgeDiagnostics.findingFilterButtons.length > 0 && (edgeDiagnostics.findingFilterButtons.length !== 2 || edgeDiagnostics.findingFilterButtons.some((item) => item.tag !== "BUTTON" || !["error", "warning"].includes(item.filter)))) {
    throw new Error(`Finding filter assertion failed: ${JSON.stringify(edgeDiagnostics.findingFilterButtons)}`);
  }
  if (edgeDiagnostics.assistantTop < edgeDiagnostics.canvasBottom - 0.5 || edgeDiagnostics.overflowX > 0 || edgeDiagnostics.overflowY > 0) {
    throw new Error(`Layout overlap assertion failed: ${JSON.stringify(edgeDiagnostics)}`);
  }

  // 3) Real pointer path: collapse and restore both side panels from their edges.
  for (const [handleSelector, panelSelector, collapseX, restoreDelta] of [
    [".df-splitter--left", ".df-docrail", 1, 260],
    [".df-splitter--right", ".df-inspector", 1679, -380]
  ]) {
    const handle = page.locator(handleSelector);
    const box = await handle.boundingBox();
    if (!box) throw new Error(`Missing resize handle ${handleSelector}`);
    const y = box.y + Math.min(140, box.height / 2);
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(collapseX, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    const collapsed = await page.locator(panelSelector).boundingBox();
    if (!collapsed || collapsed.width > 1) throw new Error(`${panelSelector} did not collapse`);
    const collapsedHandle = await handle.boundingBox();
    const startX = collapsedHandle.x + collapsedHandle.width / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + restoreDelta, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    const restored = await page.locator(panelSelector).boundingBox();
    if (!restored || restored.width < 108) throw new Error(`${panelSelector} did not restore`);
  }
  await page.screenshot({ path: out, fullPage: false });
  console.log("saved", out, colorScheme);
} catch (e) {
  console.error("shot failed:", e.message);
  try { await page.screenshot({ path: "/tmp/df-ui-error.png" }); console.log("error shot saved"); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
