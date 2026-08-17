import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

test("flow-first document policy keeps an explicit JSON prompt and disk-first remains opt-in", async () => {
  const { flow } = await fixture();
  await writeFlowDocuments(flow);
  const stepPath = join(flow.docRoot, flow.docs["step-02"]);
  await writeFile(stepPath, "# 磁盘旧内容\n", "utf8");
  const changed = {
    ...flow,
    nodes: flow.nodes.map((node) => node.id === "step-02"
      ? { ...node, data: { ...node.data, prompt: "# JSON 新内容" } }
      : node)
  };

  const flowFirst = await loadFlowDocuments(changed, { policy: "prefer-flow" });
  const diskFirst = await loadFlowDocuments(changed, { policy: "prefer-disk" });

  assert.equal(flowFirst.nodes.find((node) => node.id === "step-02").data.prompt, "# JSON 新内容");
  assert.equal(diskFirst.nodes.find((node) => node.id === "step-02").data.prompt, "# 磁盘旧内容");
});

test("generated step directories follow label changes while explicit document paths stay stable", async () => {
  const { flow } = await fixture();
  const previous = await writeFlowDocuments(flow);
  const generatedBefore = previous.docs["step-01"];
  const explicitBefore = "custom/review.md";
  const changed = {
    ...previous,
    docs: { ...previous.docs, "step-02": explicitBefore },
    nodes: previous.nodes.map((node) => node.id === "step-01"
      ? { ...node, data: { ...node.data, label: "实现代码" } }
      : node)
  };
  const normalized = normalizeDocumentFlow(changed, {
    storageRoot: flow.docRoot,
    scope: "session-a",
    previousFlow: previous
  });

  assert.notEqual(normalized.docs["step-01"], generatedBefore);
  assert.match(normalized.docs["step-01"], /实现代码/);
  assert.equal(normalized.docs["step-02"], explicitBefore);
});

test("topological ties follow explicit order and canvas coordinates before array order", () => {
  const flow = {
    nodes: [
      { id: "input", position: { x: 0, y: 0 }, data: {} },
      { id: "lower", position: { x: 300, y: 300 }, data: {} },
      { id: "right", position: { x: 500, y: 100 }, data: {} },
      { id: "upper", position: { x: 300, y: 100 }, data: {} },
      { id: "priority", position: { x: 900, y: 900 }, data: { order: 1 } },
      { id: "output", position: { x: 1200, y: 0 }, data: {} }
    ],
    edges: [
      ...["lower", "right", "upper", "priority"].map((target) => ({ source: "input", target })),
      ...["lower", "right", "upper", "priority"].map((source) => ({ source, target: "output" }))
    ]
  };

  assert.deepEqual(orderedNodeIds(flow), ["input", "priority", "upper", "lower", "right", "output"]);
});

test("flow_create can build a validated branch-shaped scaffold with stable step ids", () => {
  const flow = createScaffoldFlow({
    id: "branched",
    steps: [
      { id: "route", label: "是否通过", kind: "condition", data: { gateType: "ifElse" } },
      { id: "yes", label: "通过处理" },
      { id: "no", label: "失败处理" }
    ],
    connections: [
      { source: "input", target: "route" },
      { source: "route", target: "yes", branch: "true" },
      { source: "route", target: "no", branch: "false" },
      { source: "yes", target: "output" },
      { source: "no", target: "output" }
    ]
  });

  assert.deepEqual(flow.nodes.map((node) => node.id), ["input", "route", "yes", "no", "output"]);
  assert.deepEqual(flow.edges.filter((edge) => edge.source === "route").map((edge) => edge.sourceHandle).sort(), ["false", "true"]);
  assert.equal(flow.nodes.find((node) => node.id === "route").data.gateType, "ifElse");
  assert.equal(flow.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y)), true);
});

test("flow_create refuses to fake an aggregate gate with a linear single input", () => {
  assert.throws(() => createScaffoldFlow({
    id: "invalid-or",
    steps: [{ id: "route", label: "任一通过", kind: "condition", data: { gateType: "or" } }]
  }), /requires explicit connections from at least two upstream operands/);
});

test("bounded feedback loops preserve deterministic document order and render their policy", async () => {
  const { root, flow } = await fixture();
  const looped = {
    ...flow,
    edges: [...flow.edges, {
      id: "retry",
      source: "step-03",
      target: "step-02",
      feedback: { maxIterations: 3, exitCondition: "quality checks pass" }
    }]
  };
  const written = await writeFlowDocuments(normalizeDocumentFlow(looped, { storageRoot: root, scope: "session-a" }));
  const workflow = await readFile(join(written.docRoot, "WORKFLOW.md"), "utf8");
  assert.deepEqual(orderedNodeIds(written), ["input", "step-01", "step-02", "step-03", "output"]);
  assert.match(workflow, /## 有界反馈循环/);
  assert.match(workflow, /最多 3 次/);
  assert.match(workflow, /quality checks pass/);
});

test("generated WORKFLOW.md records executable gate formulas and input predicates", async () => {
  const testRoot = join(process.cwd(), ".test-tmp");
  await mkdir(testRoot, { recursive: true });
  const root = await mkdtemp(join(testRoot, "deepseek-flow-logic-doc-"));
  const flow = normalizeDocumentFlow(createScaffoldFlow({
    id: "logic-doc",
    name: "逻辑语义",
    steps: [
      { id: "route", label: "是否通过", kind: "condition", data: { gateType: "ifElse", predicate: "nonEmpty" } },
      { id: "yes", label: "通过处理" },
      { id: "no", label: "失败处理" }
    ],
    connections: [
      { source: "input", target: "route" },
      { source: "route", target: "yes", branch: "true" },
      { source: "route", target: "no", branch: "false" },
      { source: "yes", target: "output" },
      { source: "no", target: "output" }
    ]
  }), { storageRoot: root, scope: "session-a" });
  const written = await writeFlowDocuments(flow);
  const workflow = await readFile(join(written.docRoot, "WORKFLOW.md"), "utf8");

  assert.match(workflow, /## 逻辑门执行契约/);
  assert.match(workflow, /`ifElse` · `A`/);
  assert.match(workflow, /输入 \[nonEmpty\]/);
  assert.match(workflow, /不得把 AND\/OR\/XOR 当成纯文字标签/);
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

test("writeFlowDocuments skips unchanged files to avoid SSD write amplification", async () => {
  const { writeIfChanged } = documentWorkflowInternals;
  const { mkdtemp, stat, writeFile } = await import("node:fs/promises");
  const file = join(await mkdtemp(join(tmpdir(), "dflow-wic-")), "STEP.md");
  await writeFile(file, "same\n", "utf8");
  await new Promise((resolve) => setTimeout(resolve, 12));
  const before = (await stat(file)).mtimeMs;
  assert.equal(await writeIfChanged(file, "same\n"), false);
  assert.equal((await stat(file)).mtimeMs, before);
  assert.equal(await writeIfChanged(file, "changed\n"), true);
  assert.notEqual((await stat(file)).mtimeMs, before);
});
