# Changelog

All notable changes to DeepSeek Flow are documented in this file.

## [0.4.2] - 2026-08-19

### Fixed

- **Dropdown could not switch or showed missing workflows**
  - The Studio `<select>` now always has a placeholder option, so the control is never in an unmatched controlled state that some WebViews render as non-interactive.
  - `loadFlows` now activates a persisted historical/shared workflow when the current session has no local copy, instead of leaving the canvas empty.
  - `selectFlow` and `discardAndSwitchFlow` now refresh both the current-session list and the full history list after every switch, so the dropdown's active checkmark and group labels stay correct.
  - Option ownership is now derived from `entry.ownerSessionId` instead of a missing `flow.sessionId` field, so entries no longer incorrectly carry the "Shared" tag.
  - History group labels are simplified to "Other sessions" / "其他 Session" instead of appending raw session ids.

### Added

- **Language-aware default naming**. `flow_create` gains an optional `language` parameter (`"en"` or `"zh"`). Default workflow names (`New Flow` / `新工作流`), default step labels, and the Input/Output node labels are generated in the requested language. The Skill and user guide now instruct the Agent to pass the user's current language.
- Shared templates are now copied into an independent current-session managed workspace on switch, the same as cross-session workflows, preventing edits to a session copy from polluting the shared original.

### Changed

- `skills/deepseek-flow/SKILL.md` is now fully in English; `DEEPSEEKFLOW-GUIDE.md` is the English guide and `DEEPSEEKFLOW-使用说明.md` is the Chinese guide. README and README.zh-CN were updated to describe the language parameter and shared-template copy-on-switch behavior.

## [0.4.1] - 2026-08-19

### Added

- **Cross-session workflow switching in the Studio dropdown**: the toolbar workflow selector now lists every historical workflow (grouped by originating session, shared templates last), not just the current session's. Switching to another session's workflow imports an independent copy of its document workspace into the current session (external custom `docRoot`s are referenced, never copied).
- **Persistent active-workflow pointer per session**: each session records `activeFlowId` (the workflow last used in Studio). Reopening Studio auto-selects it; the pointer lives on disk in `sessions/<id>.json`, so it survives `dsh web` restarts and machine reboots — the dropdown is never empty after a restart because `dflow/allFlows` reads sessions/shared state straight from disk.
- **Switch notification for the agent**: `flow_list` and `flow_read` now return `activeFlowId`, plus a one-shot `activeFlowNotice` when the user switched the active workflow in Studio after the agent last looked. The notice tells the agent to run the switched workflow and ignore earlier instructions about other workflows; without a notice the conversation continues seamlessly with no mention of switching.
- New remote methods `dflow/allFlows` (lightweight cross-session listing) and `dflow/activate` (import + pointer persistence, also used by the client after import/apply/delete).
- `flow_create`/`flow_put` now update the session's active-workflow pointer on success.
- New empty-state hints in Studio: a session without workflows is told it can pick a past workflow from the dropdown, import JSON, or ask the agent to create one.
- New test suite `test/flow-switching.test.mjs` covering disk-based history listing, import-copy isolation, pointer persistence, one-shot switch notices, and stale-pointer handling.

### Fixed

- Importing a flow that carries another session's managed `docRoot` (via `flow_put` or the new dropdown switcher) no longer reuses that path; the copy is redirected to the importing session's own workspace, so two sessions can no longer overwrite each other's Markdown.
- Dangling `activeFlowId` pointers (flow deleted afterwards) are silently ignored instead of surfacing a dead id.
- **Self-review hardening (same failure classes as the previously fixed tool-argument bugs):**
  - The active-pointer write (`setActiveFlowId`) is a best-effort side effect after a successful save: if it fails it now logs and never fails the already-saved `flow_create`/`flow_put`/`activate` — preventing spurious errors that would make the agent retry and duplicate a workflow.
  - `dflow/activate` now returns the fully doc-loaded flow (same shape as `dflow/list`), copies shared templates into an independent session workspace too (no more revision fork between the shared record and the session copy), and reads the latest on-disk Markdown before copying so external edits are never lost.
  - `dflow/allFlows` now skips a single corrupted/partially-written session file instead of failing the whole history listing — one bad file can no longer empty the dropdown after a restart.
  - The switch-notice sentinel was fixed so the first-ever `flow_list` never emits a notice (there is no earlier instruction to ignore); a notice fires only when the active workflow actually changed after the agent last looked.

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
