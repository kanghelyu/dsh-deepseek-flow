---
name: deepseek-flow
description: >-
  Build, import, inspect, and maintain DeepSeek Flow visual workflows with
  Markdown step workspaces and deterministic Boolean gates.
---

# DeepSeek Flow

Use this skill whenever the user wants to build, import, visualize, or modify a multi-step workflow. Once the request is clear, call the tool directly; do not ask the user to confirm details again.

## Creating and updating

- Prefer `flow_create` for new workflows. It creates `WORKFLOW.md`, one `STEP.md` workspace per step, and the canvas nodes and edges.
- To update an existing workflow, first call `flow_read` to get the current `revision`, then call `flow_put` with that `expected_revision`.
- A successful `flow_create` or `flow_put` already persists the topology. Do **not** ask the user to click "Apply changes" in Studio, and do **not** send the same topology back to the main Session for review. Studio syncs by `revision` automatically.
- If you edit an existing workflow's `WORKFLOW.md`, `STEP.md`, or definition files directly (without using `flow_put`) and the edit changes nodes, gates, or arrows, call `flow_finalize_canvas` after the file changes, passing the workflow `id` (and preferably the `expected_revision` from `flow_read`). It triggers an invisible deterministic finalize in Studio and saves directly without another main-Session review.
- Even if you forget `flow_finalize_canvas`, Studio falls back to detecting that no canvas edit event occurred and presses the same hidden finalize path automatically. Canvas drafts created by the user in Studio still require "Apply changes".
- Ordinary execution edges must be acyclic. For bounded retries, add an explicit feedback edge: `{"source":"review","target":"implement","feedback":{"maxIterations":3,"exitCondition":"quality check passed"}}`. Feedback edges must have an integer limit between 1 and 1000 and a non-empty `exitCondition`. They do not participate in single-pass Boolean gate evaluation and do not auto-run Agent steps; the current Session must control each retry according to `WORKFLOW.md`.

## Naming language

- Use concise workflow names in the user's language. If the user did not specify a name, `flow_create` generates a default name in the language you pass.
- Pass `language: "en"` or `language: "zh"` to `flow_create` so default node labels (`Input`, `Output`, `Step N`) and the default four steps match the user's language. If omitted, the default is Chinese for backward compatibility; you should set it to the language the user is currently using.

## Hard rules for logic gates

Logic gates compute Boolean values only; they do not understand natural-language conditions:

- `kind` must be `"condition"`.
- `data.gateType` must be one of `ifElse`, `and`, `or`, `not`, `nand`, `nor`, `xor`, `xnor`.
- `data.predicate` and `data.inputPredicates` values must be one of `truthy`, `falsy`, `nonEmpty`.
- Never write `predicate: "user clearly agreed"` or any natural-language rule. When semantic understanding is needed, add an upstream Agent step that outputs JSON Boolean `true` or `false`, then connect it to a condition with `predicate: "truthy"`.
- `ifElse` and `not` require exactly one incoming edge; aggregate gates require at least two.
- `ifElse` outgoing edges use `branch: "true"` and `branch: "false"`; other gates use their gate name as the branch label.

Reusable IF/ELSE pattern:

```json
{
  "steps": [
    {
      "id": "judge-confirmed",
      "label": "Judge whether user confirmed",
      "kind": "agent",
      "prompt": "Only judge whether the user has explicitly confirmed. Output JSON Boolean true or false and nothing else."
    },
    {
      "id": "gate-confirmed",
      "label": "Confirmed?",
      "kind": "condition",
      "data": { "gateType": "ifElse", "predicate": "truthy" }
    },
    { "id": "finalize", "label": "Finalize", "prompt": "Execute the finalize step." },
    { "id": "revise", "label": "Revise", "prompt": "Revise according to the feedback." }
  ],
  "connections": [
    { "source": "input", "target": "judge-confirmed" },
    { "source": "judge-confirmed", "target": "gate-confirmed" },
    { "source": "gate-confirmed", "target": "finalize", "branch": "true" },
    { "source": "gate-confirmed", "target": "revise", "branch": "false" },
    { "source": "finalize", "target": "output" },
    { "source": "revise", "target": "output" }
  ]
}
```

For an AND gate with multiple checks, every upstream check Agent should output a Boolean. The AND node uses `data: {"gateType":"and","predicate":"truthy"}` with at least two incoming edges, and outgoing edges use `branch:"and"`.

After creation, use `flow_evaluate` with `{ "upstream-node-id": true/false }` to verify truth propagation. It only evaluates logic gates; it does not run Agent steps.

## Reading and executing

- `flow_list` lists workflows available in the current Session plus shared templates, and marks the active workflow (`activeFlowId` = the workflow last selected in Studio).
- `flow_read` returns the master outline, step documents, and `logicContract`.
- Actual execution is always done by the current Session following `WORKFLOW.md` and each `STEP.md`. DeepSeek Flow handles editing, persistence, and deterministic gate evaluation.
- Delete a workflow with `flow_delete` (pass `shared: true` for shared templates). Plugin-managed document workspaces are moved to a trash area; external custom directories are never moved.

## Active workflow and switch notice

- The user can switch to **any historical workflow** from the Studio toolbar dropdown (including workflows created in other Sessions). Switching imports an independent copy of its document workspace into the current Session (external custom `docRoot`s are referenced, not copied) and persists `activeFlowId`.
- Before running or reading a workflow, call `flow_list` (or `flow_read`):
  - If the response contains `activeFlowNotice`, the user just switched the active workflow in Studio. If the user previously asked to run a workflow in this conversation, immediately use the workflow pointed to by `activeFlowId`, **ignore earlier instructions about running other workflows**, and briefly confirm the switch to the user.
  - If there is no `activeFlowNotice`, the active workflow has not changed. Maintain conversation continuity; do not mention switching or "ignored instructions".
- Each Session auto-selects the workflow it last used. A brand-new Session starts with an empty canvas and a hint to pick a past workflow from the dropdown, import JSON, or ask you to create one.
- The dropdown history is read straight from disk, so it stays fully populated after `dsh web` restarts or a machine reboot.
- Do not proactively suggest switching workflows; only respond to `activeFlowNotice` or an explicit user request.

## Common errors and fixes

| Error keyword | Cause | Fix |
| --- | --- | --- |
| `revision changed` | Someone else wrote the files before your update | Call `flow_read` again to get the latest `revision`, then resubmit; use `force: true` only when you intend to overwrite |
| `cycle detected in ordinary execution edges` | Ordinary edges form an unbounded cycle | Mark only real bounded retry back-edges as `feedback:{maxIterations,exitCondition}`; keep other ordinary edges acyclic |
| `feedback edge` | Feedback edge missing limit/exit condition or closing an ordinary path | Set an integer `maxIterations` between 1 and 1000, provide a non-empty `exitCondition`, and ensure the target can return to the source via ordinary edges |
| `reuses true/false branch` | IF/ELSE branch connected to two targets | Each branch can have only one target; use an aggregate gate for fan-out |
| `requires at least two incoming` | Aggregate gate has too few inputs | AND/OR/NAND/NOR/XOR/XNOR need at least two incoming edges |
| `unsupported predicate` | Predicate is natural language | Use only `truthy`/`falsy`/`nonEmpty`; semantic judgment must come from an upstream Agent Boolean output |
| `hidden finalize expired` | `flow_finalize_canvas` queued for more than 30 minutes | Call it again |

After creating or updating a workflow, tell the user to open the DeepSeek Flow tab to view it. Do not prompt them to apply the same change again.
