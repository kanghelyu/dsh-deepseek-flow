import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Studio 的 UI 产生物（AI 校验/优化结果、未应用的画布草稿）持久化存储。
// 设计目标：切视图、切 Session、重启 dsh web 都不丢；只有用户显式丢弃或
// 提交成功后才清除。同时控制 I/O 放大与内存占用：
//   - assist 与 drafts 拆成两个文件：草稿防抖保存不会重写 AI 历史大 JSON；
//   - 条数上限 + 进程内缓存 LRU（每类最多 8 个 session 常驻内存）；
//   - 单条查询 assistEntry：客户端 3 秒轮询不再解析整个历史文件。
// 布局：<root>/ui-state/{assist,drafts}-<sanitized-sessionId>.json
const ASSIST_ENTRY_CAP = 60;
// 进程中断遗留的 running 条目：超过该时长按 interrupted 落档，避免客户端无限轮询。
const STALE_RUNNING_MS = 10 * 60_000;
const DRAFT_MAX_BYTES = 2 * 1024 * 1024;
const SESSION_CACHE_LIMIT = 8;

function sanitizeSessionId(sessionId) {
  return String(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** 单类状态的按 session 存储：缓存 + 磁盘 + 串行锁 + LRU 淘汰。 */
class SessionStore {
  constructor(dir, kind, normalize) {
    this.dir = dir;
    this.kind = kind;
    this.normalize = normalize;
    this.cache = new Map();
    this.locks = new Map();
  }

  path(sessionId) {
    return join(this.dir, `${this.kind}-${sanitizeSessionId(sessionId)}.json`);
  }

  trimCache() {
    while (this.cache.size > SESSION_CACHE_LIMIT) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async load(sessionId) {
    if (!sessionId) return this.normalize(null);
    if (this.cache.has(sessionId)) return this.cache.get(sessionId);
    let state = this.normalize(null);
    try {
      state = this.normalize(JSON.parse(await readFile(this.path(sessionId), "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        // 损坏文件按空状态重建，不让 UI 状态阻塞编辑器。
        console.error(`[deepseek-flow] ui-state read failed for ${sessionId}/${this.kind}: ${error?.message ?? error}`);
      }
    }
    this.cache.set(sessionId, state);
    this.trimCache();
    return state;
  }

  async update(sessionId, mutator) {
    if (!sessionId) throw new Error("ui-state requires sessionId");
    // 与 DflowStore 相同的串行化：同一 session 的读改写不交错。
    const previous = this.locks.get(sessionId) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.locks.set(sessionId, tail);
    await previous;
    try {
      const state = await this.load(sessionId);
      await mutator(state);
      const serialized = JSON.stringify(state);
      if (serialized.length > DRAFT_MAX_BYTES * 4) {
        throw new Error(`ui-state ${this.kind} for ${sessionId} grew beyond the size guard`);
      }
      await mkdir(this.dir, { recursive: true });
      const target = this.path(sessionId);
      const temporary = `${target}.${process.pid}.tmp`;
      await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, target);
      this.cache.set(sessionId, state);
      this.trimCache();
      return state;
    } finally {
      release();
      if (this.locks.get(sessionId) === tail) this.locks.delete(sessionId);
    }
  }
}

export class UiStateStore {
  constructor(root) {
    const dir = join(root, "ui-state");
    this.assist = new SessionStore(dir, "assist", (raw) => (Array.isArray(raw) ? raw : []));
    this.drafts = new SessionStore(dir, "drafts", (raw) => (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}));
  }

  /** 记录/覆盖一条 assist 结果并落盘（key = `${sessionId}:${requestId}`）。 */
  async recordAssist(sessionId, key, entry) {
    const value = { key, ...entry };
    await this.assist.update(sessionId, (entries) => {
      const kept = entries.filter((item) => item.key !== key);
      kept.unshift(value);
      entries.splice(0, entries.length, ...kept.slice(0, ASSIST_ENTRY_CAP));
    });
    return value;
  }

  rewriteStaleRunning(entries) {
    const now = Date.now();
    return entries.map((item) => item.status === "running" && now - (item.createdAt ?? 0) > STALE_RUNNING_MS
      ? { ...item, status: "error", error: "interrupted; the host restarted while this job was running" }
      : item);
  }

  /** 单条查询（客户端轮询用）：不做 TTL 清理，只改写中断遗留的 running。 */
  async assistEntry(sessionId, key) {
    const entries = await this.assist.load(sessionId);
    const index = entries.findIndex((item) => item.key === key);
    if (index < 0) return null;
    if (entries[index].status === "running" && Date.now() - (entries[index].createdAt ?? 0) > STALE_RUNNING_MS) {
      const rewritten = this.rewriteStaleRunning([entries[index]])[0];
      await this.assist.update(sessionId, (list) => {
        const at = list.findIndex((item) => item.key === key);
        if (at >= 0) list[at] = rewritten;
      });
      return rewritten;
    }
    return entries[index];
  }

  /**
   * 读取 assist 历史（新→旧）。应用 TTL（仅显式配置时）并把中断遗留的
   * running 条目改写为 error/interrupted，防止客户端恢复后无限轮询。
   */
  async assistHistory(sessionId, ttlMs = null) {
    let entries = await this.assist.load(sessionId);
    if (entries.some((item) => item.status === "running" && Date.now() - (item.createdAt ?? 0) > STALE_RUNNING_MS)) {
      const rewritten = this.rewriteStaleRunning(entries);
      await this.assist.update(sessionId, (list) => {
        list.splice(0, list.length, ...rewritten);
      });
      entries = rewritten;
    }
    if (ttlMs && Number.isFinite(ttlMs) && ttlMs > 0) {
      const now = Date.now();
      const fresh = entries.filter((item) => now - (item.createdAt ?? 0) <= ttlMs);
      if (fresh.length !== entries.length) {
        await this.assist.update(sessionId, (list) => {
          list.splice(0, list.length, ...fresh);
        });
        entries = fresh;
      }
    }
    return [...entries].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async saveDraft(sessionId, flowId, draft) {
    if (!flowId) throw new Error("draftSave requires flowId");
    const serialized = JSON.stringify(draft ?? null);
    if (serialized.length > DRAFT_MAX_BYTES) throw new Error("draft snapshot exceeds the 2MB guard");
    await this.drafts.update(sessionId, (drafts) => {
      drafts[flowId] = { ...draft, savedAt: Date.now() };
    });
    return { saved: true };
  }

  async getDraft(sessionId, flowId) {
    if (!flowId) return null;
    return (await this.drafts.load(sessionId))[flowId] ?? null;
  }

  async clearDraft(sessionId, flowId) {
    if (!flowId) return { cleared: false };
    let cleared = false;
    await this.drafts.update(sessionId, (drafts) => {
      cleared = Object.hasOwn(drafts, flowId);
      if (cleared) delete drafts[flowId];
    });
    return { cleared };
  }
}

export const uiStateInternals = {
  ASSIST_ENTRY_CAP,
  SESSION_CACHE_LIMIT,
  STALE_RUNNING_MS,
  sanitizeSessionId
};
