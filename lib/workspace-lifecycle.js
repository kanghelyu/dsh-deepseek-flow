import { mkdir, rename, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

function inside(root, target) {
  const offset = relative(resolve(root), resolve(target));
  return offset !== "" && offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset);
}

function safeName(value, fallback = "workspace") {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || fallback;
}

async function pathKind(path) {
  try {
    const value = await stat(path);
    return value.isDirectory() ? "directory" : "file";
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function managedWorkspaceRoot(storageRoot) {
  return resolve(storageRoot, "workspaces");
}

async function archiveManagedPath(path, options) {
  const target = resolve(path);
  const managedRoot = managedWorkspaceRoot(options.storageRoot);
  if (!inside(managedRoot, target)) {
    return { status: "skipped-external", path: target };
  }
  const kind = await pathKind(target);
  if (!kind) return { status: "missing", path: target };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destinationRoot = resolve(options.storageRoot, "trash", timestamp.slice(0, 10));
  await mkdir(destinationRoot, { recursive: true });
  const destination = join(
    destinationRoot,
    `${timestamp}-${safeName(options.reason)}-${safeName(options.label ?? basename(target))}-${randomUUID().slice(0, 8)}`
  );
  await rename(target, destination);
  return { status: "archived", kind, path: target, destination };
}

export async function archiveFlowWorkspace(flow, options) {
  if (!flow?.docRoot) return { status: "missing", path: null };
  try {
    return await archiveManagedPath(flow.docRoot, {
      ...options,
      reason: options.reason ?? "flow-delete",
      label: flow.id
    });
  } catch (error) {
    return { status: "failed", path: resolve(flow.docRoot), error: String(error?.message ?? error) };
  }
}

function resolveDoc(root, path) {
  if (typeof path !== "string" || path.trim() === "" || isAbsolute(path)) return null;
  const base = resolve(root);
  const target = resolve(base, path);
  return inside(base, target) ? target : null;
}

export async function archiveObsoleteDocuments(previous, next, options) {
  if (!previous?.docRoot) return [];
  const previousRoot = resolve(previous.docRoot);
  const nextRoot = next?.docRoot ? resolve(next.docRoot) : null;
  if (nextRoot !== previousRoot) {
    return [await archiveFlowWorkspace(previous, { ...options, reason: "workspace-moved" })];
  }

  const nextPaths = new Set([
    next?.workflowDoc,
    ...Object.values(next?.docs ?? {})
  ].map((path) => resolveDoc(nextRoot, path)).filter(Boolean));
  const previousEntries = [
    ["workflow", previous.workflowDoc ?? "WORKFLOW.md"],
    ...Object.entries(previous.docs ?? {})
  ];
  const candidates = new Map();
  for (const [label, path] of previousEntries) {
    const absolute = resolveDoc(previousRoot, path);
    if (!absolute || nextPaths.has(absolute)) continue;
    const directory = dirname(absolute);
    const canArchiveDirectory = directory !== previousRoot
      && ![...nextPaths].some((current) => current === directory || inside(directory, current));
    candidates.set(canArchiveDirectory ? directory : absolute, label);
  }

  const reports = [];
  for (const [path, label] of candidates) {
    try {
      reports.push(await archiveManagedPath(path, {
        ...options,
        reason: "obsolete-document",
        label
      }));
    } catch (error) {
      reports.push({ status: "failed", path, error: String(error?.message ?? error) });
    }
  }
  return reports;
}

export const workspaceLifecycleInternals = { archiveManagedPath, inside, managedWorkspaceRoot };
