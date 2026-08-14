import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 300)); });
await page.goto("http://127.0.0.1:3080", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(6000);
const sessionItem = page.getByText("数学科普动画").first();
if (await sessionItem.count()) await sessionItem.click({ force: true });
await page.waitForTimeout(5000);
const tab = page.locator("text=DeepSeek Flow").first();
if (await tab.count()) await tab.click();
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const canvas = document.querySelector(".df-canvas");
  const nodes = document.querySelectorAll(".df-graph__node");
  const status = document.querySelector(".df-status")?.textContent ?? null;
  const toolbarSelect = document.querySelector(".df-toolbar select")?.value ?? null;
  const rect = canvas ? canvas.getBoundingClientRect() : null;
  const edgePath = document.querySelector(".df-graph__edge");
  const edgeStyle = edgePath ? getComputedStyle(edgePath) : null;
  const markerShape = document.querySelector(".df-graph__edges marker path");
  const markerStyle = markerShape ? getComputedStyle(markerShape) : null;
  const handleChecks = [...nodes].map((node) => {
    const nodeRect = node.getBoundingClientRect();
    const handles = [...node.querySelectorAll(".df-graph__handle")].map((handle) => handle.getBoundingClientRect());
    return {
      count: handles.length,
      leftDelta: handles[0] ? Math.abs(handles[0].x + handles[0].width / 2 - nodeRect.x) : 999,
      rightDelta: handles[1] ? Math.abs(handles[1].x + handles[1].width / 2 - nodeRect.right) : 999
    };
  });
  return {
    clientRevision: document.querySelector(".df-titlebar__rev")?.textContent?.trim() ?? null,
    nodeCount: nodes.length,
    edgeCount: document.querySelectorAll(".df-graph__edge").length,
    arrowMarkerCount: document.querySelectorAll(".df-graph__edges marker").length,
    edgeVisual: {
      markerEnd: edgePath?.getAttribute("marker-end") ?? null,
      fill: edgeStyle?.fill ?? null,
      stroke: edgeStyle?.stroke ?? null,
      strokeWidth: edgeStyle?.strokeWidth ?? null,
      filter: edgeStyle?.filter ?? null,
      markerFill: markerStyle?.fill ?? null,
      markerStroke: markerStyle?.stroke ?? null
    },
    viewportTransform: document.querySelector(".df-graph__stage")?.style.transform ?? null,
    connectHandleCount: document.querySelectorAll(".df-graph__handle").length,
    handleChecks,
    composerDisplay: getComputedStyle(document.querySelector("[data-composer-seat]")).display,
    minimapCount: document.querySelectorAll(".react-flow__minimap,.df-minimap").length,
    hasRunButton: [...document.querySelectorAll(".deepseek-flow-root button")].some((button) => /^(运行|Run)$/.test(button.textContent.trim())),
    status,
    selectedFlow: toolbarSelect,
    canvasRect: rect ? { w: rect.width, h: rect.height } : null,
    flowText: document.body.innerText.includes("数学动画流水线") ? "flow-name-visible" : "flow-name-missing"
  };
});
console.log("INFO:", JSON.stringify(info, null, 1));
console.log("ERRORS:", errors.length ? errors.join("\n") : "(none)");
await page.screenshot({ path: "/tmp/df-ui.png" });
await browser.close();
