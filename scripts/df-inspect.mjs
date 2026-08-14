import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
await page.goto("http://127.0.0.1:3080", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(7000);
console.log("URL:", page.url());
const text = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("BODY TEXT:", JSON.stringify(text));
// 找含 "DeepSeek Flow" 或 "会话" 的可点击元素
const found = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("a, button, [role=tab], [role=button], li")) {
    const t = (el.textContent || "").trim();
    if (t && t.length < 40 && /DeepSeek|会话|Chat|轨迹|Flow/.test(t)) out.push(el.tagName + ":" + t);
  }
  return out.slice(0, 30);
});
console.log("CLICKABLES:", JSON.stringify(found, null, 1));
await browser.close();
