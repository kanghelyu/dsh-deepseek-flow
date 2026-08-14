import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1680, height: 950 } });
await p.goto("http://127.0.0.1:3080", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(6000);
const s = p.getByText("数学科普动画").first();
if (await s.count()) await s.click({ force: true });
await p.waitForTimeout(5000);
const flowTab = p.locator("text=DeepSeek Flow").first();
await flowTab.click();
await p.waitForTimeout(8000);
// 不切走，直接等待优化完成（验证核心执行链是否通）
await p.locator('button[data-df-action="optimize-document"]').first().click();
await p.waitForTimeout(3000);
const running = await p.evaluate(() => {
  const btn = document.querySelector('button[data-df-action="optimize-document"]');
  return btn ? btn.textContent : null;
});
console.log("after click:", running);
// 等待最长 60s，每 5s 检查一次预览区
let state = null;
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(5000);
  state = await p.evaluate(() => {
    const textarea = document.querySelector(".df-assistant__preview textarea");
    const btn = document.querySelector('button[data-df-action="accept-optimization"]');
    const title = document.querySelector(".df-assistant__preview-title");
    return { draftLength: textarea ? textarea.value.length : null, acceptBtn: !!btn, title: title ? title.textContent.slice(0, 60) : null };
  });
  console.log("poll", i + 1, JSON.stringify(state));
  if (state.acceptBtn) break;
}
await b.close();
