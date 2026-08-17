# Changelog

All notable changes to DeepSeek Flow are documented in this file.

## [0.4.0] - 2026-08-17

### Added

- **Bounded feedback loops**: explicit feedback edges (`feedback: { maxIterations, exitCondition }`) now allow finite retry cycles while ordinary execution edges must remain acyclic.
- Canvas UI for feedback edges:
  - New "Feedback connection" mode.
  - Arrow properties panel to mark an edge as feedback, set max iterations and exit condition, convert back to an ordinary edge, or delete it.
  - Dedicated feedback edge styling, labels, and multi-feedback lane layout.
- `flow_create` connections now accept an optional `feedback` field.
- `flow_read`, `flow_put`, and `flow_evaluate` now serialize and honor feedback edges; logic contracts include a `feedbackLoops` section.
- JSON tool arguments now accept both native JSON values and Web GUI stringified JSON for `steps`, `connections`, `values`, and `flow`, with clear errors for malformed input.
- New graph analysis module centralizes feedback detection, stable topological ordering, executable path checks, and feedback validation.
- New tests for bounded feedback loops, JSON argument normalization, and real tool executor behavior.

### Fixed

- First install no longer logs a scary `ENOENT` error when the legacy `harness-flow/state.json` does not exist; it is treated as a normal no-migration state.
- `flow_create` no longer silently falls back to the default four-step scaffold when `steps`/`connections` arrive as JSON strings.
- `flow_evaluate` and `flow_put` no longer reject stringified JSON object arguments.

### Changed

- Validation now rejects only unmarked cycles in ordinary execution edges; cycles are allowed only through explicitly bounded feedback edges.
- Feedback edges are excluded from one-pass Boolean gate evaluation and are not executed automatically by DeepSeek Flow; they describe retry policy for the current Session.
- Self-loops can only be created as bounded feedback loops.

## [0.3.21] - 2026-08-16

### Fixed

- **Critical: duplicate `@deepseek-ai/dsh-tools` instance breaking all DSH tool calls.**
  - Moved `@deepseek-ai/dsh-tools` from `dependencies` to `peerDependencies` so pnpm no longer installs a second copy inside the DSH profile.
  - Added a runtime self-healing bridge: if `ctx.tools[TOOL_RUNTIME_SCHEDULER]` is missing because of a module-copy mismatch, DeepSeek Flow now recovers the host scheduler through the shared `Symbol.for("@deepseek-ai/dsh-tools.scheduler")` registry.
  - Added defensive checks in `scripts/ensure-deps.sh` to detect and reject nested/real `dsh-tools` copies that would create duplicate module instances.
  - Rebuilt the client bundle.

### Notes

- This is a hotfix release on top of `0.3.20`. No workflow file format or tool API changes are introduced.
