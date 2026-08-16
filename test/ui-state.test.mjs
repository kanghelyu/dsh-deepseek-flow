import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { UiStateStore, uiStateInternals } from "../lib/ui-state.js";

async function makeStore() {
  const root = await mkdtemp(join(tmpdir(), "dflow-ui-state-"));
  return { root, store: new UiStateStore(root) };
}

test("assist entries persist to disk, survive a new store instance, and cap by count", async () => {
  const { root, store } = await makeStore();
  await store.recordAssist("s1", "s1:r1", { status: "done", mode: "logic", flowId: "f1", createdAt: 1 });
  await store.recordAssist("s1", "s1:r2", { status: "done", mode: "logic", flowId: "f1", createdAt: 2 });
  // 同 key 覆盖不重复。
  await store.recordAssist("s1", "s1:r2", { status: "done", mode: "logic", flowId: "f1", result: { ok: true }, createdAt: 3 });

  const reopened = new UiStateStore(root);
  const history = await reopened.assistHistory("s1");
  assert.equal(history.length, 2);
  assert.equal(history[0].key, "s1:r2");
  assert.equal(history[0].result.ok, true);

  for (let index = 0; index < uiStateInternals.ASSIST_ENTRY_CAP + 10; index += 1) {
    await store.recordAssist("s1", `s1:bulk-${index}`, { status: "done", mode: "optimize", createdAt: 10 + index });
  }
  const capped = await store.assistHistory("s1");
  assert.ok(capped.length <= uiStateInternals.ASSIST_ENTRY_CAP);
  await rm(root, { recursive: true, force: true });
});

test("drafts save, survive reopen, and clear explicitly", async () => {
  const { root, store } = await makeStore();
  const draft = { nodes: [{ id: "a" }], edges: [], activeDoc: "workflow", canvasEdited: true, baseRevision: 3 };
  await store.saveDraft("s1", "flow-a", draft);
  assert.deepEqual((await store.getDraft("s1", "flow-a")).nodes, draft.nodes);

  const reopened = new UiStateStore(root);
  const restored = await reopened.getDraft("s1", "flow-a");
  assert.equal(restored.baseRevision, 3);
  assert.equal(restored.canvasEdited, true);
  assert.ok(Number.isFinite(restored.savedAt));

  const cleared = await reopened.clearDraft("s1", "flow-a");
  assert.deepEqual(cleared, { cleared: true });
  assert.equal(await reopened.getDraft("s1", "flow-a"), null);
  assert.deepEqual(await reopened.clearDraft("s1", "flow-a"), { cleared: false });
  await rm(root, { recursive: true, force: true });
});

test("running entries interrupted by a restart are rewritten instead of polling forever", async () => {
  const { root, store } = await makeStore();
  await store.recordAssist("s1", "s1:stale", {
    status: "running",
    mode: "logic",
    createdAt: Date.now() - (uiStateInternals.STALE_RUNNING_MS + 60_000)
  });
  await store.recordAssist("s1", "s1:fresh", { status: "running", mode: "logic", createdAt: Date.now() });
  const history = await store.assistHistory("s1");
  const stale = history.find((entry) => entry.key === "s1:stale");
  const fresh = history.find((entry) => entry.key === "s1:fresh");
  assert.equal(stale.status, "error");
  assert.match(stale.error, /interrupted/);
  assert.equal(fresh.status, "running");
  await rm(root, { recursive: true, force: true });
});

test("ttl applies only when explicitly configured and corrupted files rebuild cleanly", async () => {
  const { root, store } = await makeStore();
  await store.recordAssist("s1", "s1:old", { status: "done", mode: "logic", createdAt: Date.now() - 1000 });
  const kept = await store.assistHistory("s1", null);
  assert.equal(kept.length, 1);
  const expired = await store.assistHistory("s1", 1);
  assert.equal(expired.length, 0);
  assert.equal((await store.assistHistory("s1", null)).length, 0);

  const { writeFile } = await import("node:fs/promises");
  const { sanitizeSessionId } = uiStateInternals;
  await writeFile(join(root, "ui-state", `${sanitizeSessionId("s2")}.json`), "{not json", "utf8");
  const broken = new UiStateStore(root);
  assert.deepEqual(await broken.assistHistory("s2"), []);
  await broken.saveDraft("s2", "f", { nodes: [], edges: [] });
  assert.ok((await broken.getDraft("s2", "f")).savedAt > 0);
  await rm(root, { recursive: true, force: true });
});

test("assist and drafts live in separate files so draft saves never rewrite history", async () => {
  const { root, store } = await makeStore();
  await store.recordAssist("s1", "s1:a", { status: "done", mode: "logic", createdAt: 1 });
  const { readFile, stat } = await import("node:fs/promises");
  const { sanitizeSessionId } = uiStateInternals;
  const assistPath = join(root, "ui-state", `assist-${sanitizeSessionId("s1")}.json`);
  const draftsPath = join(root, "ui-state", `drafts-${sanitizeSessionId("s1")}.json`);
  const before = (await stat(assistPath)).mtimeMs;
  await new Promise((resolve) => setTimeout(resolve, 12));
  await store.saveDraft("s1", "f1", { nodes: [{ id: "a" }], edges: [] });
  // assist 文件未被重写（mtime 不变），drafts 文件存在。
  assert.equal((await stat(assistPath)).mtimeMs, before);
  const draftState = JSON.parse(await readFile(draftsPath, "utf8"));
  assert.ok(draftState.f1.savedAt > 0);

  // 单条查询不触碰列表结构。
  const entry = await store.assistEntry("s1", "s1:a");
  assert.equal(entry.mode, "logic");
  assert.equal(await store.assistEntry("s1", "missing"), null);
  await rm(root, { recursive: true, force: true });
});
