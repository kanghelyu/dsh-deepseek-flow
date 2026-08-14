import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  createScaffoldFlow,
  documentWorkflowInternals,
  loadFlowDocuments,
  normalizeDocumentFlow,
  orderedNodeIds,
  writeFlowDocuments
} from "../lib/document-workflow.js";

async function fixture() {
  const testRoot = join(process.cwd(), ".test-tmp");
  await mkdir(testRoot, { recursive: true });
  const root = await mkdtemp(join(testRoot, "deepseek-flow-test-"));
  const flow = normalizeDocumentFlow(createScaffoldFlow({
    id: "release-flow",
    name: "发布工作流",
    description: "实现、调试并质检",
    steps: ["实现", "截图调试", "质量检查"]
  }), { storageRoot: root, scope: "session-a" });
  return { root, flow };
}

test("creates WORKFLOW.md and one STEP.md workspace per node", async () => {
  const { flow } = await fixture();
  const written = await writeFlowDocuments(flow);
  const workflow = await readFile(join(written.docRoot, "WORKFLOW.md"), "utf8");

  assert.match(workflow, /^# 发布工作流/m);
  assert.match(workflow, /## 执行顺序/);
  assert.match(workflow, /截图调试/);
  assert.deepEqual(orderedNodeIds(written), ["input", "step-01", "step-02", "step-03", "output"]);
  assert.equal(Object.keys(written.docs).length, written.nodes.length);
  assert.equal(new Set(Object.values(written.docs)).size, written.nodes.length);

  for (const relativePath of Object.values(written.docs)) {
    assert.equal(relativePath.endsWith("/STEP.md"), true);
    assert.equal((await readFile(join(written.docRoot, relativePath), "utf8")).length > 0, true);
  }
});

test("disk Markdown overrides node content when a flow is loaded", async () => {
  const { flow } = await fixture();
  await writeFlowDocuments(flow);
  const stepPath = join(flow.docRoot, flow.docs["step-02"]);
  await writeFile(stepPath, "# 调试\n\n每个关键状态都截图。\n", "utf8");

  const loaded = await loadFlowDocuments(flow);
  assert.equal(loaded.nodes.find((node) => node.id === "step-02").data.prompt, "# 调试\n\n每个关键状态都截图。");
});

test("editing workflowContent writes the same WORKFLOW.md", async () => {
  const { flow } = await fixture();
  const content = "# 自定义总流程\n\n1. 先试运行\n2. 再质检";
  await writeFlowDocuments({ ...flow, workflowContent: content });
  assert.equal(await readFile(join(flow.docRoot, "WORKFLOW.md"), "utf8"), `${content}\n`);
});

test("graph structure changes refresh only the generated WORKFLOW section", async () => {
  const { flow } = await fixture();
  const first = await writeFlowDocuments(flow);
  const customized = { ...first, workflowContent: `${first.workflowContent}\n\n## 我的备注\n\n保留这段文字。` };
  const renamed = {
    ...customized,
    nodes: customized.nodes.map((node) => node.id === "step-01"
      ? { ...node, data: { ...node.data, label: "实现代码" } }
      : node)
  };
  const second = await writeFlowDocuments(renamed);
  assert.match(second.workflowContent, /实现代码/);
  assert.match(second.workflowContent, /## 我的备注\n\n保留这段文字。/);
});

test("rejects document paths that escape docRoot", async () => {
  const { flow } = await fixture();
  assert.throws(() => normalizeDocumentFlow({
    ...flow,
    workflowDoc: "../outside.md"
  }, { storageRoot: flow.docRoot, scope: "session-a" }), /escapes docRoot/);
  assert.throws(() => documentWorkflowInternals.resolveInside(flow.docRoot, "/tmp/outside.md"), /relative to docRoot/);
});

test("bundled debug and quality workflow resolves every Markdown step", async () => {
  const exampleRoot = join(process.cwd(), "examples", "debug-quality-workflow");
  const definition = JSON.parse(await readFile(join(exampleRoot, "flow.json"), "utf8"));
  const loaded = await loadFlowDocuments(normalizeDocumentFlow({ ...definition, docRoot: exampleRoot }, {
    storageRoot: process.cwd(),
    scope: "example"
  }));
  assert.equal(Object.keys(loaded.docs).length, loaded.nodes.length);
  assert.match(loaded.nodes.find((node) => node.id === "debug").data.prompt, /关键路径|状态截图/);
  assert.match(loaded.nodes.find((node) => node.id === "quality").data.prompt, /自动化测试/);
  assert.match(loaded.workflowContent, /质检不通过/);
});
