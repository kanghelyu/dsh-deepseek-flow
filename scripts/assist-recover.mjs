import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1680, height: 950 } });
const logs = [];
p.on("pageerror", e => logs.push("PAGEERROR " + e.message.slice(0, 200)));
await p.goto("http://127.0.0.1:3080", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(6000);
const s = p.getByText("数学科普动画").first();
if (await s.count()) await s.click({ force: true });
await p.waitForTimeout(5000);
const flowTab = p.locator("text=DeepSeek Flow").first();
await flowTab.click();
await p.waitForTimeout(8000);

// 1) 点「AI 优化当前文档」
const optBtn = p.locator('button[data-df-action="optimize-document"]').first();
console.log("optimize button visible:", await optBtn.count());
await optBtn.click();
await p.waitForTimeout(3000);
const busy1 = await p.evaluate(() => {
  const btn = document.querySelector('button[data-df-action="optimize-document"]');
  return btn ? btn.textContent : null;
});
console.log("after click, button text:", busy1);

// 2) 立刻切到「对话」视图
const chatTab = p.locator("text=对话").first();
if (await chatTab.count()) await chatTab.click();
console.log("switched to chat, waiting 45s for host-side completion...");
await p.waitForTimeout(110000);

// 3) 切回 DeepSeek Flow
await flowTab.click();
await p.waitForTimeout(8000);
const state = await p.evaluate(() => {
  const preview = document.querySelector(".df-assistant__preview-title");
  const textarea = document.querySelector(".df-assistant__preview textarea");
  const btn = document.querySelector('button[data-df-action="accept-optimization"]');
  return {
    previewTitle: preview ? preview.textContent.slice(0, 80) : null,
    draftLength: textarea ? textarea.value.length : null,
    acceptBtn: !!btn
  };
});
console.log("AFTER RETURN:", JSON.stringify(state));
console.log("ERRORS:", JSON.stringify(logs));
await b.close();
