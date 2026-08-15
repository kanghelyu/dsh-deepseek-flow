import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  DflowStore,
  FlowRevisionConflictError,
  flowRevision,
  nextFlowRevision
} from "../lib/dflow-store.js";

async function storeFixture() {
  const testRoot = join(process.cwd(), ".test-tmp");
  await mkdir(testRoot, { recursive: true });
  return new DflowStore(await mkdtemp(join(testRoot, "dflow-store-")));
}

test("flow revisions reject stale and missing updates but allow an explicit force", () => {
  const current = { id: "flow", revision: 3 };
  assert.equal(flowRevision({ id: "legacy" }), 0);
  assert.equal(nextFlowRevision({ id: "new" }, null), 1);
  assert.equal(nextFlowRevision({ id: "flow", revision: 3 }, current), 4);
  assert.equal(nextFlowRevision({ id: "flow" }, current, { expectedRevision: 3 }), 4);
  assert.equal(nextFlowRevision({ id: "flow" }, current, { force: true }), 4);
  assert.throws(
    () => nextFlowRevision({ id: "flow", revision: 2 }, current),
    (error) => error instanceof FlowRevisionConflictError
      && error.code === "FLOW_REVISION_CONFLICT"
      && /Reload with flow_read/.test(error.message)
  );
  assert.throws(() => nextFlowRevision({ id: "flow" }, current), FlowRevisionConflictError);
});

test("session updates are serialized so concurrent writers cannot lose state", async () => {
  const store = await storeFixture();
  await Promise.all(Array.from({ length: 24 }, (_, index) =>
    store.updateSession("session-a", async (state) => {
      await Promise.resolve();
      return {
        ...state,
        flows: [...state.flows, { id: `flow-${index}` }]
      };
    })
  ));

  const state = await store.session("session-a");
  assert.equal(state.flows.length, 24);
  assert.equal(new Set(state.flows.map((flow) => flow.id)).size, 24);
});
