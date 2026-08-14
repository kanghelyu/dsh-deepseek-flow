import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
await page.goto("http://127.0.0.1:3080", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(6000);
const sessionItem = page.getByText("数学科普动画").first();
if (await sessionItem.count()) await sessionItem.click({ force: true });
await page.waitForTimeout(5000);
const tab = page.locator("text=DeepSeek Flow").first();
if (await tab.count()) await tab.click();
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: Math.round(r.width), h: Math.round(r.height), display: cs.display, flex: cs.flex, position: cs.position, overflow: cs.overflow };
  };
  return {
    root: pick(".deepseek-flow-root"),
    main: pick(".df-main"),
    studio: pick(".df-studio"),
    canvasShell: pick(".df-canvas-shell"),
    toolbar: pick(".df-toolbar"),
    canvas: pick(".df-canvas"),
    addbar: pick(".df-addbar"),
    documentRail: pick(".df-docrail"),
    inspector: pick(".df-inspector")
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
