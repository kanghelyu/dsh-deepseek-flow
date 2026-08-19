import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export class FlowRevisionConflictError extends Error {
  constructor(flowId, expected, actual) {
    super([
      `Flow "${flowId}" changed after it was loaded.`,
      `Expected revision ${expected ?? "missing"}, current revision is ${actual}.`,
      "Reload with flow_read or refresh Studio, merge the latest changes, then save again.",
      "Use force=true only when intentionally replacing the current version."
    ].join("\n"));
    this.name = "FlowRevisionConflictError";
    this.code = "FLOW_REVISION_CONFLICT";
    this.flowId = flowId;
    this.expectedRevision = expected;
    this.actualRevision = actual;
  }
}

export function flowRevision(flow) {
  const value = Number(flow?.revision);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function nextFlowRevision(incoming, current, options = {}) {
  if (!current) return 1;
  const actual = flowRevision(current);
  const rawExpected = options.expectedRevision ?? incoming?.revision;
  const expected = rawExpected === undefined || rawExpected === null || rawExpected === ""
    ? undefined
    : Number(rawExpected);
  if (options.force !== true && (!Number.isInteger(expected) || expected !== actual)) {
    throw new FlowRevisionConflictError(incoming?.id ?? current.id, expected, actual);
  }
  return actual + 1;
}

export class DflowStore {
  constructor(root) {
    this.root = root;
    this.locks = new Map();
  }

  sharedPath() {
    return join(this.root, "shared.json");
  }

  sessionPath(sessionId) {
    return join(this.root, "sessions", `${String(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
  }

  async readState(path) {
    try {
      const state = JSON.parse(await readFile(path, "utf8"));
      return { ...state, flows: Array.isArray(state?.flows) ? state.flows : [] };
    } catch (error) {
      if (error.code === "ENOENT") return { flows: [] };
      throw error;
    }
  }

  async writeState(path, state) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }

  async withLock(path, task) {
    const previous = this.locks.get(path) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.locks.set(path, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.locks.get(path) === tail) this.locks.delete(path);
    }
  }

  async shared() {
    return this.readState(this.sharedPath());
  }

  async session(sessionId) {
    if (!sessionId) throw new Error("sessionId is required");
    return this.readState(this.sessionPath(sessionId));
  }

  async updatePath(path, mutator) {
    return this.withLock(path, async () => {
      const state = await this.readState(path);
      const next = await mutator(state);
      await this.writeState(path, next);
      return next;
    });
  }

  async updateShared(mutator) {
    return this.updatePath(this.sharedPath(), mutator);
  }

  async updateSession(sessionId, mutator) {
    if (!sessionId) throw new Error("sessionId is required");
    return this.updatePath(this.sessionPath(sessionId), mutator);
  }

  async listFlow(sessionId, id) {
    const owned = sessionId ? (await this.session(sessionId)).flows : [];
    const shared = (await this.shared()).flows;
    return owned.find((flow) => flow.id === id) ?? shared.find((flow) => flow.id === id) ?? null;
  }

  /**
   * 跨 Session 的历史工作流清单（共享模板去重）。数据源是磁盘上的
   * sessions/*.json + shared.json 本身，不依赖任何进程内状态，因此重启
   * dsh web（甚至重启电脑）后 Studio 的下拉菜单依然完整，不会为空。
   */
  async allFlows() {
    const shared = (await this.shared()).flows;
    const entries = [];
    let sessionFiles = [];
    try {
      sessionFiles = await readdir(join(this.root, "sessions"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      sessionFiles = [];
    }
    for (const file of sessionFiles) {
      if (!file.endsWith(".json")) continue;
      // 单文件容错：某个 session 文件损坏（进程中断/半写/被误改）只跳过它，
      // 不拖垮整个历史列表——否则一个坏文件会让重启后的下拉菜单变空。
      try {
        const state = await this.readState(join(this.root, "sessions", file));
        for (const flow of state.flows) {
          entries.push({ flow, sessionId: file.slice(0, -".json".length) });
        }
      } catch (error) {
        console.error(`[deepseek-flow] skip unreadable session file ${file}: ${error?.message ?? error}`);
      }
    }
    const seen = new Set();
    const flows = [];
    const append = (flow, scope) => {
      if (!flow?.id || seen.has(flow.id)) return;
      seen.add(flow.id);
      flows.push(scope === "shared" ? { flow, sessionId: null } : { flow, sessionId: scope });
    };
    for (const entry of entries) append(entry.flow, entry.sessionId);
    for (const flow of shared) append(flow, "shared");
    return flows;
  }
}
