// DeepSeekFlow client bundle 构建：优先使用 esbuild；离线交接环境没有 node_modules 时，
// 直接把无 JSX、仅依赖宿主 React 的 entry.js 包装成 Harness Client bundle。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

async function buildWithEsbuild() {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: ["src/client/entry.js"],
    bundle: true,
    format: "cjs",
    platform: "browser",
    target: ["chrome100", "safari15"],
    external: ["react", "react-dom", "react/jsx-runtime"],
    write: false,
    minify: false,
    sourcemap: false
  });
  const code = result.outputFiles[0].text;
  return `window.__ModuleLoader__.load({ id: "deepseek-flow", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${code}\nreturn module.exports; } });\n`;
}

function transformEntry(source) {
  return source
    .replace(/^import React,\s*\{([^}]+)\}\s*from "react";\s*/m, (_match, names) => {
      return `const import_react3 = require("react");\nconst React = import_react3.default ?? import_react3;\nconst {${names}} = import_react3;\n`;
    })
    .replace(/\nexport \{ apply, inject \};\s*$/m, "\n")
    .replace(/\bReact\./g, "React.");
}

async function buildOffline() {
  const entry = transformEntry(await readFile("src/client/entry.js", "utf8"));
  return `window.__ModuleLoader__.load({ id: "deepseek-flow", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${entry}\nmodule.exports = { apply, inject };\nreturn module.exports; } });\n`;
}

let wrapped;
try {
  wrapped = await buildWithEsbuild();
  console.log("building client with esbuild");
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
  wrapped = await buildOffline();
  console.log("building client with dependency-free offline wrapper");
}
const [entrySource, packageSource] = await Promise.all([
  readFile("src/client/entry.js", "utf8"),
  readFile("package.json", "utf8")
]);
const revision = createHash("sha256")
  .update(entrySource)
  .update("\0")
  .update(packageSource)
  .digest("hex")
  .slice(0, 12);
wrapped = wrapped.replace(/^(?:\/\* deepseek-flow client-rev:[a-f0-9]+ \*\/\n)+/, "");
wrapped = `/* deepseek-flow client-rev:${revision} */\n${wrapped.replaceAll("__DEEPSEEK_FLOW_CLIENT_REV__", revision)}`;
if (wrapped.includes("__DEEPSEEK_FLOW_CLIENT_REV__")) throw new Error("Client revision placeholder was not replaced");
await mkdir("lib", { recursive: true });
await writeFile("lib/client.js", wrapped);
await writeFile("lib/client.rev", `${revision}\n`);
console.log(`built lib/client.js (${wrapped.length} bytes, rev ${revision})`);
