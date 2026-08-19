# DeepSeek Flow User Guide

> Version: 0.4.2 (cross-session historical workflow dropdown, persistent active workflow, language-aware default naming, independent copy-on-switch, and full reboot survival).
> In one sentence: install the plugin, say "build a workflow", and the workflow becomes an editable, writable, synchronized diagram.

---

## 1. What this is

DeepSeek Flow is a visual workflow plugin for DeepSeek Harness. Each session has its own independent canvas:

- **Left panel**: workflow document tree (`WORKFLOW.md` master outline + one `STEP.md` workspace per step)
- **Center**: canvas (nodes, arrows, logic gates)
- **Right panel**: Markdown editor + node properties
- **Bottom**: AI document assistant (logic validation / single-document optimization / whole-workflow optimization)

It only handles **editing the flow + syncing documents + AI review/optimization**. It **does not run workflows** — execution always happens in the current Session by the Agent.

## 2. Install (one command)

```bash
dsh plugin --profile web add "github:kanghelyu/dsh-deepseek-flow#main"
```

Restart `dsh web`. The plugin loads automatically. Client-side changes only need a hard browser refresh; Host-side changes need a `dsh web` restart. Dependencies self-heal; on older environments stop `dsh web` and run `bash scripts/ensure-deps.sh`.

## 3. Build a workflow in one sentence (bundled skill)

The plugin ships with the `deepseek-flow` skill, registered automatically. Trigger it by saying:

1. "Build a workflow", "Import a workflow", "Turn this process into a diagram", "Visualize this flow"
2. Or describe a multi-step task such as "Find papers, download them, read them, and write a summary with term explanations" — any "first… then… finally…" description triggers it.

The Agent then: confirms the step chain → calls `flow_create` to generate the master outline, each `STEP.md`, and the canvas layout → you open the DeepSeek Flow tab to inspect. Later, "execute this workflow" runs it step by step in the Session.

**Language-aware naming**: when calling `flow_create`, the Agent should pass `language: "en"` or `language: "zh"` to match the user's language. Default node labels (`Input`, `Output`, `Step N`) and the default four steps are generated in that language.

## 4. Canvas operations

| Action | How |
| --- | --- |
| Add node | Bottom node toolbar (Input / Agent / Map Agent / Condition / Merge / Output); new nodes land at the current viewport center |
| Add arrow | Drag from a node's right handle onto another node (the whole node box is a drop target) |
| Pan canvas | Drag empty space; **click** empty space to deselect — panning alone does not deselect |
| Zoom | Ctrl/⌘ + wheel or pinch; two-finger drag = pan |
| Fit entire flow | Toolbar button (auto-fits only when switching workflows; adding nodes no longer jumps the view) |
| Move node | Drag a node — this is **layout only**, not a topology change. It auto-saves without triggering "Apply changes". Dragging is smooth. |
| Undo / redo | Ctrl/⌘+Z / Shift+Ctrl/⌘+Z |
| Delete workflow | Toolbar "Delete" button. After confirmation, plugin-managed workspaces go to the trash area; shared templates can also be deleted |
| Switch workflow | Dropdown selector. It lists **all historical workflows** grouped by originating session (current session first, shared templates last). Selecting another session's workflow copies it as an independent current-session copy. If unapplied canvas drafts exist, a "Discard changes and switch" confirmation appears first. |
| Dialog shortcuts | ESC exits the topmost dialog/menu first; only when nothing is open does it clear canvas selection |
| Layout | Left/right panels and bottom assistant can be resized by dragging dividers; below a threshold they collapse automatically |

**Active workflow and auto-select**: each Session remembers the workflow it last used. Reopening Studio (including after restarting `dsh web` or the machine) auto-selects it in the dropdown. The history list is read straight from disk, so it is never empty after a reboot. A brand-new Session starts with an empty canvas and a hint to pick a past workflow, import JSON, or ask the Agent to create one.

**Switch notice**: after the user switches workflows in Studio, the next `flow_list`/`flow_read` returns a one-time `activeFlowNotice`. If the user previously asked to run a workflow, the Agent switches to the new `activeFlowId` and ignores earlier run instructions. If the workflow did not change, nothing is said and the conversation stays continuous.

## 5. Logic gates (condition boxes)

When adding a condition, choose one of eight gate types: **IF/ELSE, AND, OR, NOT, NAND, NOR, XOR, XNOR**.

- IF/ELSE: after creation, pick "Yes" / "No". Each branch allows at most one target; a third edge is blocked.
- NOT: allows exactly one outgoing edge; a second is blocked.
- AND / OR / NAND / NOR / XOR / XNOR: multiple outgoing edges to different targets are allowed and auto-labeled; duplicate targets are blocked.
- Duplicate branches, excess outgoing edges, and wrong input arity are intercepted before write with a clear warning.
- Gate type cannot be silently changed while outgoing edges exist.
- Legacy `true`/`false` branches are automatically inferred as IF/ELSE.
- The `flow_evaluate` tool computes gate results and activated targets from standard truth tables.

> Logic gates are canvas semantics only; execution still happens in the Session.

## 6. Topology commit transaction (important)

Adding, deleting, renaming, or connecting boxes, gates, inputs, or outputs creates a **canvas draft** only. The "Apply changes" button appears at the bottom right. After confirmation:

```
Local validation → main Session Agent review → second validation → atomic revision save
```

Rules:

- While a topology draft is pending, **Logic validation** and **Optimize entire workflow** are disabled (grayed out); clicking them shows "Please save the workflow first". Single-document editing and optimization remain available.
- Moving nodes is **not** a topology change, so no "Apply changes" appears.
- Markdown prose uses a separate save channel: edits in the Markdown editor write back automatically, independent of topology.

## 7. Document two-way sync

- Canvas nodes ↔ `WORKFLOW.md` / each step's `STEP.md`
- Saving/applying canvas changes writes back to the Markdown files; editing the Markdown files refreshes the canvas on next load
- Files are the source of truth: Markdown content takes priority over stale canvas values

## 8. AI document assistant (bottom panel)

| Feature | Description |
| --- | --- |
| Logic validation | Validates all Markdown files and arrow relationships, returning errors/warnings (up to 20). Clicking a result navigates to the document or node. |
| Optimize current document | Optimizes only the selected `WORKFLOW.md` or `STEP.md`. A proposal appears; you must **Accept** or **Reject** it. If the original changed meanwhile, it refuses to overwrite. |
| Optimize entire workflow | Confirms it is irreversible first, then the Agent rewrites and atomically saves all documents. Fails if any document is missing. |

- Model and reasoning effort: choose via chips at the top of the assistant (follows Session default, or pick off/high/max).
- Jobs run in an isolated session: switching documents, views, or sessions does not interrupt them; results are restored when you return.
- Multiple document optimizations can run concurrently; each proposal is kept independently.
- Each isolated subagent job has a 10-minute default timeout; accepted background jobs remain resumable when you switch documents, views, or sessions.

## 9. Interface

- **Language**: follows the WebUI language automatically (中文 / English)
- **Theme**: follows the WebUI light/dark theme automatically
- **Session isolation**: each session has independent workflows, plus shared templates visible to all sessions

## 10. Maintenance and uninstall

```bash
# Dependency self-heal (fallback for old environments)
bash scripts/ensure-deps.sh

# Uninstall
dsh plugin --profile web remove deepseek-flow
```

When a workflow is deleted, plugin-managed directories go to `deepseek-flow/trash` for recovery; external custom `docRoot`s are never moved automatically.

---

MIT · Community project, not affiliated with DeepSeek.
