# Changelog

All notable changes to DeepSeek Flow are documented in this file.

## [0.3.21] - 2026-08-16

### Fixed

- **Critical: duplicate `@deepseek-ai/dsh-tools` instance breaking all DSH tool calls.**
  - Moved `@deepseek-ai/dsh-tools` from `dependencies` to `peerDependencies` so pnpm no longer installs a second copy inside the DSH profile.
  - Added a runtime self-healing bridge: if `ctx.tools[TOOL_RUNTIME_SCHEDULER]` is missing because of a module-copy mismatch, DeepSeek Flow now recovers the host scheduler through the shared `Symbol.for("@deepseek-ai/dsh-tools.scheduler")` registry.
  - Added defensive checks in `scripts/ensure-deps.sh` to detect and reject nested/real `dsh-tools` copies that would create duplicate module instances.
  - Rebuilt the client bundle.

### Notes

- This is a hotfix release on top of `0.3.20`. No workflow file format or tool API changes are introduced.
