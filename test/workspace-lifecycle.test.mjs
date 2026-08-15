import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  archiveFlowWorkspace,
  archiveObsoleteDocuments
} from "../lib/workspace-lifecycle.js";

async function lifecycleFixture() {
  const testRoot = join(process.cwd(), ".test-tmp");
  await mkdir(testRoot, { recursive: true });
  return mkdtemp(join(testRoot, "workspace-lifecycle-"));
}

async function missing(path) {
  try {
    await stat(path);
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

test("deleting a managed flow archives its workspace instead of permanently deleting it", async () => {
  const root = await lifecycleFixture();
  const docRoot = join(root, "workspaces", "session-a", "flow-a");
  await mkdir(docRoot, { recursive: true });
  await writeFile(join(docRoot, "WORKFLOW.md"), "# Flow\n", "utf8");

  const report = await archiveFlowWorkspace({ id: "flow-a", docRoot }, {
    storageRoot: root,
    reason: "test-delete"
  });

  assert.equal(report.status, "archived");
  assert.equal(await missing(docRoot), true);
  assert.equal(await readFile(join(report.destination, "WORKFLOW.md"), "utf8"), "# Flow\n");
});

test("external custom document roots are never moved automatically", async () => {
  const root = await lifecycleFixture();
  const external = await mkdtemp(join(root, "external-"));
  await writeFile(join(external, "WORKFLOW.md"), "# External\n", "utf8");

  const report = await archiveFlowWorkspace({ id: "external", docRoot: external }, {
    storageRoot: root,
    reason: "test-delete"
  });

  assert.equal(report.status, "skipped-external");
  assert.equal(await readFile(join(external, "WORKFLOW.md"), "utf8"), "# External\n");
});

test("removed or renamed generated STEP directories move to trash after an update", async () => {
  const root = await lifecycleFixture();
  const docRoot = join(root, "workspaces", "session-a", "flow-a");
  const oldDirectory = join(docRoot, "01-old");
  const newDirectory = join(docRoot, "01-new");
  await mkdir(oldDirectory, { recursive: true });
  await mkdir(newDirectory, { recursive: true });
  await writeFile(join(oldDirectory, "STEP.md"), "# Old\n", "utf8");
  await writeFile(join(newDirectory, "STEP.md"), "# New\n", "utf8");

  const reports = await archiveObsoleteDocuments(
    { id: "flow-a", docRoot, workflowDoc: "WORKFLOW.md", docs: { step: "01-old/STEP.md" } },
    { id: "flow-a", docRoot, workflowDoc: "WORKFLOW.md", docs: { step: "01-new/STEP.md" } },
    { storageRoot: root }
  );

  assert.equal(reports.some((report) => report.status === "archived"), true);
  assert.equal(await missing(oldDirectory), true);
  assert.equal(await readFile(join(newDirectory, "STEP.md"), "utf8"), "# New\n");
});
