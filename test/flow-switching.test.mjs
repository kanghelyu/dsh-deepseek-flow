import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DflowStore } from "../lib/dflow-store.js";
import { registerTools } from "../lib/index.js";
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
    agentKnownActiveFlows: new Map(),
    assistResultTtlMs: null,
    assistantTimeoutMs: 10_000
  };
}

function registeredTools(host) {
  const tools = new Map();
  registerTools({ tools: { register: (tool) => tools.set(tool.name, tool) } }, host);
  return tools;
}

test("allFlows lists flows from every session file on disk, surviving restarts", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-allflows-"));
  const store = new DflowStore(root);
  await store.updateSession("session-a", (state) => ({
    ...state,
    flows: [{ id: "flow-a1", name: "A1", nodes: [], edges: [] }]
  }));
  await store.updateSession("session-b", (state) => ({
    ...state,
    flows: [{ id: "flow-b1", name: "B1", nodes: [], edges: [] }]
  }));
  await store.updateShared((state) => ({
    ...state,
    flows: [{ id: "flow-shared", name: "Shared", nodes: [], edges: [] }]
  }));

  // 模拟重启：重新从磁盘构造 store（无内存状态）。
  const reopened = new DflowStore(root);
  const entries = await reopened.allFlows();
  assert.equal(entries.length, 3);
  const byId = Object.fromEntries(entries.map(({ flow, sessionId }) => [flow.id, sessionId]));
  assert.equal(byId["flow-a1"], "session-a");
  assert.equal(byId["flow-b1"], "session-b");
  assert.equal(byId["flow-shared"], null);
});

test("activating a flow from another session imports an independent copy and persists the pointer", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-activate-"));
  const host = createHost(root);
  const tools = registeredTools(host);
  const execA = { agent: { id: "session-a" } };
  const execB = { agent: { id: "session-b" } };

  const created = await tools.get("flow_create").execute({ name: "共享来源" }, execA);
  assert.equal(created.ok, true);
  // flow_create 顺带落了 session-a 的激活指针。
  assert.equal((await host.store.session("session-a")).activeFlowId, created.id);

  // session-b 的 flow_list 能看到 Studio 切换提示之前的状态：先让 Agent 读一次。
  const firstList = await tools.get("flow_list").execute({}, execB);
  assert.equal(firstList.activeFlowId, null);
  assert.equal(firstList.flows.length, 0);

  // Studio 在 session-b 下拉里选中了 session-a 的历史工作流 → activate 导入副本。
  const activated = await tools.get("flow_put").execute({
    flow: { ...(await host.store.listFlow("session-a", created.id)) }
  }, execB);
  assert.equal(activated.ok, true);
  assert.equal((await host.store.session("session-b")).activeFlowId, activated.id);

  // 两个 session 各自持有独立工作区（docRoot 不同），互不影响。
  const flowA = await host.store.listFlow("session-a", created.id);
  const flowB = await host.store.listFlow("session-b", activated.id);
  assert.notEqual(flowA.docRoot, flowB.docRoot);

  // Agent 下一次 flow_list 收到切换通知，再下一次回到安静。
  const notified = await tools.get("flow_list").execute({}, execB);
  assert.equal(notified.activeFlowId, activated.id);
  assert.match(notified.activeFlowNotice, /switched the active workflow/);
  const quiet = await tools.get("flow_list").execute({}, execB);
  assert.equal(quiet.activeFlowNotice, undefined);
  assert.equal(quiet.activeFlowId, activated.id);
  assert.equal(quiet.flows.find((flow) => flow.id === activated.id)?.active, true);
});

test("pointer to a deleted flow is ignored instead of surfacing a dead id", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-pointer-"));
  const host = createHost(root);
  const tools = registeredTools(host);
  const exec = { agent: { id: "session-a" } };

  const created = await tools.get("flow_create").execute({ name: "待删除" }, exec);
  await tools.get("flow_delete").execute({ id: created.id }, exec);
  await host.store.updateSession("session-a", (state) => ({ ...state, activeFlowId: created.id }));

  const listed = await tools.get("flow_list").execute({}, exec);
  assert.equal(listed.activeFlowId, null);
  assert.equal(listed.activeFlowNotice, undefined);
});

test("flow_list never fires a switch notice on first use, only when the pointer really changed", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-sentinel-"));
  const host = createHost(root);
  const tools = registeredTools(host);
  const execB = { agent: { id: "session-b" } };

  // session-b 自建两个工作流作为可达的切换目标；创建后指针停在「工作流二」。
  const b1 = await tools.get("flow_create").execute({ name: "工作流一" }, execB);
  const b2 = await tools.get("flow_create").execute({ name: "工作流二" }, execB);

  // 首次调用：没有任何「之前的指令」，绝不该发通知（激活的正是刚创建的工作流二）。
  const firstList = await tools.get("flow_list").execute({}, execB);
  assert.equal(firstList.activeFlowId, b2.id);
  assert.equal(firstList.activeFlowNotice, undefined);

  // Studio 切到「工作流一」：收到一次通知。
  await host.store.updateSession("session-b", (state) => ({ ...state, activeFlowId: b1.id }));
  const secondList = await tools.get("flow_list").execute({}, execB);
  assert.equal(secondList.activeFlowNotice !== undefined, true);
  assert.equal(secondList.activeFlowId, b1.id);

  // 工作流没再变化：保持安静，不重复提醒。
  const quiet = await tools.get("flow_list").execute({}, execB);
  assert.equal(quiet.activeFlowNotice, undefined);

  // 切回「工作流二」：激活真变了，又通知一次。
  await host.store.updateSession("session-b", (state) => ({ ...state, activeFlowId: b2.id }));
  const switchedBack = await tools.get("flow_list").execute({}, execB);
  assert.equal(switchedBack.activeFlowNotice !== undefined, true);
  assert.equal(switchedBack.activeFlowId, b2.id);
});

test("allFlows skips a corrupted session file instead of emptying the whole history list", async () => {
  const root = await mkdtemp(join(tmpdir(), "dflow-corrupt-"));
  const store = new DflowStore(root);
  await store.updateSession("session-good", (state) => ({
    ...state,
    flows: [{ id: "flow-good", name: "Good", nodes: [], edges: [] }]
  }));
  // 写入一个损坏的 session 文件（模拟进程中断/半写）。
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(root, "sessions", "session-broken.json"), "{ not valid json", "utf8");

  const entries = await store.allFlows();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].flow.id, "flow-good");
});

test("a failed active-pointer write never throws: pointer update is a best-effort side effect", async () => {
  const { setActiveFlowId } = await import("../lib/index.js");
  const root = await mkdtemp(join(tmpdir(), "dflow-pointer-guard-"));
  const host = createHost(root);
  const brokenStore = {
    ...host.store,
    session: host.store.session.bind(host.store),
    updateSession: async () => {
      throw new Error("disk not writable");
    }
  };
  // 指针落盘在任何情况下失败都不抛：调用方（flow_create/put/activate）
  // 拿到的永远是「主操作已成功」的稳定语义。
  await setActiveFlowId({ ...host, store: brokenStore }, "session-a", "flow-x");
  // 正常路径依旧工作。
  await setActiveFlowId(host, "session-a", "flow-x");
  assert.equal((await host.store.session("session-a")).activeFlowId, "flow-x");
});
