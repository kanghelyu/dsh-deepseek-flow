# DeepSeek Flow

> Turn your agent workflow into a living diagram — one per session, synced with your docs, themed like your UI.

**English** · [简体中文](README.zh-CN.md)

[![GitHub release](https://img.shields.io/github/v/release/kanghelyu/dsh-deepseek-flow?label=release)](https://github.com/kanghelyu/dsh-deepseek-flow/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Say *"build a workflow"* — and the workflow appears as an editable diagram.**

Install this plugin and your Agent learns a built-in skill for it: whenever you say things like *"构建工作流"* / *"build a workflow"* / *"import a workflow"*, the workflow is scaffolded through this plugin — a `WORKFLOW.md` master doc, one `STEP.md` workspace per step, and a canvas with every node wired up — ready to view and edit in the **DeepSeek Flow** tab.

DeepSeek Flow is a visual-workflow plugin for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness). It turns the `WORKFLOW.md` + per-step `STEP.md` pattern you already use with Codex/Claude into a diagram you can edit: document rail on the left, canvas in the middle, Markdown editor on the right, AI assistant at the bottom.

## ✨ Highlights

| Instead of… | You get… |
| --- | --- |
| One global flow shared by every session | **Per-session isolation** — every session owns its workflow |
| Diagram and docs drifting apart | **Two-way sync** — edit the canvas, the MD files update; edit the MD files, the canvas updates |
| Drawing every step by hand | **One-sentence import** — tell the Agent "import a workflow", it scaffolds the docs and the canvas |
| Benchmarks and bloat you never touch | Only three jobs: **edit flows · sync docs · AI review/optimize** |
| Heavy third-party canvas libraries | **Hand-rolled SVG edge layer + HTML node layer** — no @xyflow, ~120 KB bundle |
| Hard-coded colors that clash with your UI | Harness theme tokens — **follows your WebUI light/dark theme automatically** |
| Chinese-only or English-only UI | **UI language follows your WebUI locale automatically** (中文/English) |
| Saying "make me a workflow" does nothing | **One-sentence workflow building** — a built-in skill turns that phrase into a diagram + docs |

**Built-in AI assistant** (manual, one-shot): logic validation and single-doc / whole-flow optimization with explicit **accept/reject** — nothing is written until you accept. Jobs run in an **isolated session**, so switching views or sessions never interrupts them, and results are waiting when you come back. Model and reasoning effort are selectable in the UI.

**Platform:** the UI is currently optimized for **Web UI**. Host logic is UI-agnostic, so other UIs (TUI, etc.) should work but are not specially adapted — PRs welcome.

## 📸 Screenshots

Same flow, same build — only the WebUI theme was toggled; the plugin follows automatically.

<p align="center">
  <img src="docs/images/light.png" width="49%" alt="Light theme">
  <img src="docs/images/dark.png" width="49%" alt="Dark theme">
</p>

## 🚀 Quick Start

```bash
dsh plugin --profile web add "github:kanghelyu/dsh-deepseek-flow#main"
```

Restart `dsh web` — done. Pure git source, build artifacts committed, all dependencies from the registry, and the bundle layer mounts automatically. Verified end-to-end on a clean profile.

Verify:

```bash
dsh web --dump-config | grep deepseek-flow
```

### Usage

1. Open any session → **DeepSeek Flow** tab.
2. Say *"import a workflow"* — the Agent scaffolds `WORKFLOW.md` + per-step `STEP.md` + canvas.
3. Drag nodes, draw arrows, edit prompts — saving writes back to the MD files.
4. Use the **AI doc assistant** for logic validation and optimization.
5. Switch away anytime — jobs keep running and results are there when you return.

### Development

```bash
dsh plugin --profile web add link:/path/to/deepseek-flow   # local source
node --test test/*.test.mjs                                 # 31/31
node scripts/build.mjs                                      # rebuild client bundle
bash scripts/ensure-deps.sh                                 # dependency fallback for broken envs
```

### Uninstall

```bash
dsh plugin --profile web remove deepseek-flow
```

## 🧠 Architecture

```
deepseek-flow/
├── lib/index.js                  Host — per-session storage, remote CRUD, tools, assist orchestration
├── lib/agent-assistant.js        AI review/optimize — prompts, schemas, isolated-session jobs
├── lib/typert.descriptors.js     Typert wire parameter whitelist
├── lib/client.js                 Client bundle (committed build artifact)
├── src/client/entry.js           Client source — five-column layout, hand-rolled canvas, assistant
├── scripts/                      build / ensure-deps / ui-shot (Playwright assertions) / smoke
├── test/                         31 contract tests
└── cordis.patch.yml              plugin row (dataDir, optional assistantModel / assistantTimeoutMs)
```

### Key mechanics

- **Storage** — `~/.dsh/deepseek-flow/shared.json` + `sessions/<sessionId>.json`; files are the source of truth.
- **Doc-driven** — `flow.workflowDoc` + `flow.docs` (nodeId → relative `STEP.md`); reads overlay file content onto node prompts, saves write back.
- **Session isolation** — tools read `exec.agent.id ?? agent.session?.id`; lists merge own session + shared templates (dedup, session copy wins).
- **AI jobs** — `dflow/assist` accepts and returns immediately; work runs in an **isolated session** via `agents.create` (`meta: { agentPreset: "standard", cwd }` — `cwd` is required or the subagent fails silently); results are cached by `sessionId:requestId` (TTL 30 min); the client polls `dflow/assistHistory` every 3 s.
- **Model routing** — follows `agentDefaultModel.currentSelection()`; overridable via `assistantModel` config or the UI; `reasoningEffort` supports `off` / `high` / `max`.
- **Regression baselines** — arrows `fill:none!important` + closed markers; `GRAPH_MIN_ZOOM = 0.5`; canvas structural CSS is append-only; colors use `--dsw-alias-*` tokens only.

## License

[MIT](LICENSE) · Community project, not affiliated with DeepSeek.
