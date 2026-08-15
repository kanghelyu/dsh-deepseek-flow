# DeepSeek Flow

> A Markdown-first visual workflow editor for DeepSeek Harness.

**English** · [简体中文](README.zh-CN.md)

[![GitHub release](https://img.shields.io/github/v/release/kanghelyu/dsh-deepseek-flow?label=release)](https://github.com/kanghelyu/dsh-deepseek-flow/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

DeepSeek Flow turns a `WORKFLOW.md` and its step-level `STEP.md` files into an editable diagram inside DeepSeek Harness. The diagram and the Markdown stay synchronized, so you can work visually without giving up portable, reviewable files.

It is intentionally an editor—not a workflow runtime. DeepSeek Flow helps you design, inspect, and improve a workflow; execution remains in the current Session.

<p align="center">
  <img src="docs/images/dark.png" width="49%" alt="DeepSeek Flow in dark mode">
  <img src="docs/images/light.png" width="49%" alt="DeepSeek Flow in light mode">
</p>

## What it gives you

- **Markdown as the source of truth** — one master `WORKFLOW.md`, plus one `STEP.md` workspace for each step.
- **A real visual editor** — create, move, connect, reconnect, label, and delete nodes and arrows.
- **Two-way synchronization** — edits made on the canvas and in the Markdown editor are written back to the workflow files.
- **Per-session isolation** — each Harness session keeps its own workflows, with optional shared templates.
- **Comfortable large-flow navigation** — collapsible and resizable side panels, pan and zoom, fit-to-view, animated node focus, and independent scrolling regions.
- **Native theme support** — the interface follows Harness light and dark themes and the active WebUI language.
- **Manual AI assistance** — run logic validation, optimize one document with review, or optimize the complete workflow.
- **Background AI jobs** — switching documents, views, or sessions does not interrupt accepted jobs; document proposals are restored when you return.

## Quick start

Install from GitHub into the Web profile:

```bash
dsh plugin --profile web add "github:kanghelyu/dsh-deepseek-flow#main"
```

Restart `dsh web`, open a session, and select the **DeepSeek Flow** tab.

To confirm that the plugin is mounted:

```bash
dsh web --dump-config | grep deepseek-flow
```

## Your first workflow

1. In a Session, ask the Agent to **build a workflow** or **import a workflow**.
2. Open **DeepSeek Flow**. The plugin scaffolds a master document, step documents, and their visual layout.
3. Select a document to edit its Markdown, or drag a node's output handle onto another node to create an arrow.
4. Save your changes. The canvas model and Markdown files remain synchronized.
5. Return to the Session when you want the Agent to execute the workflow.

A typical workflow directory looks like this:

```text
my-workflow/
├── WORKFLOW.md
├── flow.json
└── steps/
    ├── research/
    │   └── STEP.md
    ├── draft/
    │   └── STEP.md
    └── quality-check/
        └── STEP.md
```

## AI document assistant

Every AI action is started manually. DeepSeek Flow never runs validation or optimization behind your back.

| Action | Scope | What happens before files change |
| --- | --- | --- |
| **Logic validation** | All workflow documents and arrow relationships | The Agent returns clickable errors and warnings; no file is changed. |
| **Optimize current document** | The selected `WORKFLOW.md` or `STEP.md` only | A complete proposal appears in the preview. You must **Accept** or **Reject** it. |
| **Optimize entire workflow** | `WORKFLOW.md` and every `STEP.md` | A warning is shown first. After confirmation, the Agent rewrites and saves the complete set directly. There is no per-document review or built-in undo. |

For whole-workflow optimization, commit or back up important Markdown files first. If a document changes while an optimization is running, DeepSeek Flow refuses to overwrite the newer content.

The assistant uses an isolated Agent job and does not run the workflow. Model and reasoning-effort controls are available in the assistant menu.

## Design boundaries

DeepSeek Flow deliberately does **not** provide:

- a workflow execution button or runtime;
- API-key, provider, or credential management;
- triggers, schedules, webhooks, or execution history;
- a replacement for normal Session interaction.

That boundary keeps the plugin focused: edit and validate in DeepSeek Flow, execute in the Session.

## Local development

Clone the repository and link it into your Web profile:

```bash
git clone https://github.com/kanghelyu/dsh-deepseek-flow.git
cd dsh-deepseek-flow
dsh plugin --profile web add "link:$PWD"
```

Useful checks:

```bash
npm test
npm run build
npm run smoke
```

If an older local Harness installation is missing linked dependencies, stop `dsh web` before running:

```bash
bash scripts/ensure-deps.sh
```

After changing client code, rebuild and hard-refresh the browser. Host changes require restarting `dsh web`.

<details>
<summary>Repository layout</summary>

```text
deepseek-flow/
├── lib/                 Host code and committed client bundle
├── src/client/          WebUI client source
├── scripts/             Build, dependency, screenshot, and smoke checks
├── test/                Contract and regression tests
├── examples/            Example Markdown workflow
└── docs/images/         README screenshots
```

</details>

## Troubleshooting

- **The tab does not appear:** verify the plugin with `dsh web --dump-config`, then restart the Web profile.
- **The UI looks stale:** rebuild with `npm run build`, restart when Host code changed, and hard-refresh the browser.
- **AI actions report no provider:** select a working model in the Session or in the assistant menu.
- **Whole-workflow optimization is rejected:** one or more documents changed while the Agent was working, or the Agent did not return every required document. Retry from the latest files.

## Uninstall

```bash
dsh plugin --profile web remove deepseek-flow
```

## License

[MIT](LICENSE). Community project; not affiliated with DeepSeek.
