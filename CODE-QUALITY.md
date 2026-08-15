# Code quality notes

## Assessment

The plugin was functional and well covered at the integration-contract level, but the WebUI client had accumulated a clear high-coupling hotspot: `src/client/entry.js` contained localization, the complete stylesheet, canvas rendering, graph persistence, gate validation, and editor state in one 2,730-line file.

This refactor keeps behavior and the published package shape stable while moving responsibilities behind explicit module boundaries.

## What changed

| Module | Responsibility |
| --- | --- |
| `lib/condition-gates.js` | Gate vocabulary, legacy aliases, branch availability, and gate-specific limits |
| `lib/dflow-store.js` | Atomic JSON replacement, per-file in-process write serialization, and optimistic flow revisions |
| `lib/flow-validation.js` | Pure graph validation, readable issue reporting, reachability, and DAG enforcement |
| `lib/logic-semantics.js` | Standard gate truth tables, predicate coercion, arity contracts, Boolean propagation, and evaluation results |
| `lib/topology-model.js` | Canonical topology projection/diffing, document-only merges, and preservation of Markdown during reviewed topology replacement |
| `lib/topology-review.js` | Strict topology-only output schema, immutable-document prompt context, and current-main-Session-parented one-shot review |
| `lib/workspace-lifecycle.js` | Recoverable cleanup for managed workspaces and obsolete generated documents |
| `lib/document-workflow.js` | Deterministic document order, flow/disk merge policy, generated paths, and scaffold creation |
| `src/client/graph-model.js` | Pure flow/canvas conversion, serialization, connection validation, history snapshots, layout, and semantic snapshots |
| `src/client/graph-canvas.js` | Canvas geometry, SVG edges, viewport animation, pointer gestures, and node rendering |
| `src/client/i18n.js` | Browser/host locale resolution and Chinese/English interface copy |
| `src/client/styles.js` | Theme-token-based CSS |
| `src/client/entry.js` | Host integration, editor orchestration, persistence, dialogs, and assistant state |

The main entry remains substantially smaller than the former 2,730-line monolith while now coordinating an explicit topology draft/apply state machine. The committed `lib/client.js` remains a generated single-file bundle because that is the plugin delivery format, not hand-maintained source.

## Verification improvements

- Added direct unit tests for flow conversion, localized automatic labels, serialization, connection rules, immutable reconnects, deterministic layout, and semantic snapshots.
- Kept the existing editor, gate, document, Host, and Agent regression contracts.
- Expanded the suite from 38 to 75 passing tests.
- Added direct regression coverage for stale revisions, concurrent store updates, flow/disk precedence, canvas-aware ordering, branch-aware scaffolds, actionable cycle errors, managed trash, and external-path protection.
- Added truth-table, predicate, missing-input, false-signal propagation, IF/ELSE selection, semantic arity, generated-contract, and Studio input-editor tests. AND/OR/XOR-family gates are no longer presentation-only metadata.
- Generalized the dependency-free builder so every source module is included and every module contributes to `client.rev`.
- Verified that the offline bundle can be evaluated and exports `apply` plus the required injections.
- Added direct tests proving that Markdown-only edits never change the persisted topology, reviewed topology never overwrites newer Markdown, incomplete Agent topology is rejected, and topology review uses the live main Session Agent as `parent` without creating an isolated Session.

## Topology transaction boundary

Structural canvas edits now have an explicit transaction boundary. `topologySignature()` excludes Markdown and runtime hints while covering box identity/kind/position, gate semantics, arrows, order, inputs, and outputs. Autosave and whole-document AI optimization call `mergeDocumentEdits()` against the persisted flow, so neither path can accidentally commit a pending topology.

`dflow/topologyApply` verifies the user's base topology before accepting work, records the request in the recoverable assistant-history channel, performs local validation, requests a strict topology-only review parented by the current main Session Agent, reloads the latest persisted flow, rechecks that no competing topology won, merges the reviewed graph onto the latest Markdown, validates again, and writes through optimistic `revision` protection. Any failure leaves the stored flow unchanged and the Client draft intact.

## Remaining debt

`Studio` is still the largest component because it coordinates document editing, modal state, history, persistence, and AI jobs. Splitting those areas into hooks/components would be the next architectural step, but should be done with real Harness browser integration tests so focus, pointer, cancellation, and background-job restoration are not changed accidentally.

The store lock intentionally protects concurrent writes inside one Harness Web process. The optimistic `revision` contract protects normal Studio/Agent concurrency, but deployments that run multiple independent Web processes against the same data directory would still need an operating-system-level lock or a transactional database.

Cycles remain unsupported by design. The document generator and Session execution contract require a deterministic DAG order; accepting a cycle without a runtime state machine would make the model less reliable, not more capable.

`flow_evaluate` is intentionally a pure Boolean evaluator, not a workflow runner. It consumes results produced by Session steps and returns gate signals plus activation decisions. Execution history, retries, side effects, and Agent lifecycle stay with Harness.

The current refactor deliberately prioritizes low-risk boundaries and testable domain logic over a large rewrite.
