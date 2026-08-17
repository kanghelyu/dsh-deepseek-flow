import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DflowStore } from "../lib/dflow-store.js";
import { isMissingLegacyStateError, registerTools } from "../lib/index.js";
import { UiStateStore } from "../lib/ui-state.js";

function createHost(root) {
  return {
    root,
    store: new DflowStore(root),
    uiState: new UiStateStore(root),
    assistControllers: new Map(),
    assistRuns: new Map(),
    assistResults: new Map(),
    agentFinalizeRequests: new Map(),
    assistResultTtlMs: null,
    assistantTimeoutMs: 10_000
  };
}

function registeredTools(host) {
  const tools = new Map();
  registerTools({ tools: { register: (tool) => tools.set(tool.name, tool) } }, host);
  return tools;
}

const exec = { agent: { id: "session-web" } };

test("Web GUI stringified JSON reaches real flow tool executors without topology loss", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-tool-exec-"));
  const host = createHost(root);
  const tools = registeredTools(host);
  const steps = [
    { id: "check", label: "Check", kind: "condition", data: { gateType: "ifElse" } },
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" }
  ];
  const connections = [
    { source: "input", target: "check" },
    { source: "check", target: "yes", branch: "true" },
    { source: "check", target: "no", branch: "false" },
    { source: "yes", target: "output" },
    { source: "no", target: "output" }
  ];
  const created = await tools.get("flow_create").execute({
    name: "Stringified input",
    steps: JSON.stringify(steps),
    connections: JSON.stringify(connections)
  }, exec);
  assert.equal(created.ok, true);

  const stored = await host.store.listFlow("session-web", created.id);
  assert.deepEqual(stored.nodes.map((node) => node.id), ["input", "check", "yes", "no", "output"]);
  assert.deepEqual(stored.edges.map((edge) => edge.sourceHandle).filter(Boolean).sort(), ["false", "true"]);

  const evaluated = await tools.get("flow_evaluate").execute({
    id: created.id,
    values: JSON.stringify({ input: true })
  }, exec);
  assert.deepEqual(evaluated.activeTargets, ["yes"]);

  const imported = { ...stored, id: "stringified-put", name: "Stringified put" };
  const put = await tools.get("flow_put").execute({ flow: JSON.stringify(imported) }, exec);
  assert.equal(put.ok, true);
  assert.equal((await host.store.listFlow("session-web", "stringified-put")).nodes.length, 5);

  const feedbackCreated = await tools.get("flow_create").execute({
    name: "Stringified bounded retry",
    steps: JSON.stringify([{ id: "work", label: "Work" }, { id: "review", label: "Review" }]),
    connections: JSON.stringify([
      { source: "input", target: "work" },
      { source: "work", target: "review" },
      { source: "review", target: "output" },
      { source: "review", target: "work", feedback: { maxIterations: 3, exitCondition: "review passes" } }
    ])
  }, exec);
  const feedbackFlow = await host.store.listFlow("session-web", feedbackCreated.id);
  assert.deepEqual(feedbackFlow.edges.find((edge) => edge.id.includes("review-work")).feedback, {
    maxIterations: 3,
    exitCondition: "review passes"
  });
});

test("real flow tool executors reject malformed stringified JSON instead of falling back", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-tool-invalid-"));
  const tools = registeredTools(createHost(root));
  await assert.rejects(
    () => tools.get("flow_create").execute({ name: "Invalid", steps: "not-json" }, exec),
    /steps must be valid JSON/
  );
  await assert.rejects(
    () => tools.get("flow_create").execute({ name: "Wrong shape", steps: "{}" }, exec),
    /steps must be a JSON array/
  );
});

test("only the missing legacy state file is treated as a normal first-install migration state", () => {
  assert.equal(isMissingLegacyStateError({ code: "ENOENT", path: "/tmp/harness-flow/state.json" }), true);
  assert.equal(isMissingLegacyStateError({ code: "ENOENT", path: "/tmp/deepseek-flow/shared.json" }), false);
  assert.equal(isMissingLegacyStateError({ code: "EACCES", path: "/tmp/harness-flow/state.json" }), false);
});
