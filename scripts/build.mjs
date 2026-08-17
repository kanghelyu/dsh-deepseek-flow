// DeepSeekFlow client bundle builder.
// Prefer esbuild, while keeping a deterministic dependency-free fallback for
// offline plugin hand-offs where node_modules is intentionally absent.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const CLIENT_ENTRY = "src/client/entry.js";
const OFFLINE_MODULES = [
  "lib/condition-gates.js",
  "lib/graph-analysis.js",
  "lib/logic-semantics.js",
  "lib/topology-model.js",
  "src/client/i18n.js",
  "src/client/styles.js",
  "src/client/graph-model.js",
  "src/client/graph-canvas.js"
];
const REVISION_INPUTS = [...OFFLINE_MODULES, CLIENT_ENTRY, "package.json"];

async function readSources(paths) {
  return Promise.all(paths.map(async (path) => [path, await readFile(path, "utf8")]));
}

async function buildWithEsbuild() {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [CLIENT_ENTRY],
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

function stripModuleSyntax(source) {
  return source
    .replace(/^import[\s\S]*?;\s*/gm, "")
    .replace(/^export\s+/gm, "");
}

function transformEntry(source) {
  const withHostReact = source.replace(
    /^import React,\s*\{([^}]+)\}\s*from "react";\s*/m,
    (_match, names) => `const import_react3 = require("react");\nconst React = import_react3.default ?? import_react3;\nconst {${names}} = import_react3;\n`
  );
  return stripModuleSyntax(withHostReact)
    .replace(/\nexport \{ apply, inject \};\s*$/m, "\n");
}

async function buildOffline() {
  const modules = await readSources(OFFLINE_MODULES);
  const entry = transformEntry(await readFile(CLIENT_ENTRY, "utf8"));
  const bundledModules = modules.map(([, source]) => stripModuleSyntax(source)).join("\n");
  return `window.__ModuleLoader__.load({ id: "deepseek-flow", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${bundledModules}\n${entry}\nmodule.exports = { apply, inject };\nreturn module.exports; } });\n`;
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

const revisionSources = await readSources(REVISION_INPUTS);
const revision = createHash("sha256")
  .update(revisionSources.map(([path, source]) => `${path}\0${source}`).join("\0"))
  .digest("hex")
  .slice(0, 12);
wrapped = wrapped.replace(/^(?:\/\* deepseek-flow client-rev:[a-f0-9]+ \*\/\n)+/, "");
wrapped = `/* deepseek-flow client-rev:${revision} */\n${wrapped.replaceAll("__DEEPSEEK_FLOW_CLIENT_REV__", revision)}`;
if (wrapped.includes("__DEEPSEEK_FLOW_CLIENT_REV__")) throw new Error("Client revision placeholder was not replaced");
await mkdir("lib", { recursive: true });
await writeFile("lib/client.js", wrapped);
await writeFile("lib/client.rev", `${revision}\n`);
console.log(`built lib/client.js (${wrapped.length} bytes, rev ${revision})`);
