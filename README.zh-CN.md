# DeepSeek Flow

> 把 Agent 的工作流变成一张活的图——每个会话一张，与文档双向同步，主题跟着你的界面走。

[English](README.md) · **简体中文**

[![GitHub release](https://img.shields.io/github/v/release/kanghelyu/dsh-deepseek-flow?label=release)](https://github.com/kanghelyu/dsh-deepseek-flow/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-31%2F31-brightgreen.svg)](test/)

DeepSeek Flow 是 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 的可视化工作流插件。你在 Codex / Claude 里用的「`WORKFLOW.md` + 每步一个 `STEP.md`」模式，它会变成一张可以编辑的流程图：左边文档目录，中间画布，右边 Markdown 编辑器，底部 AI 助手。

## ✨ 亮点

| 别的工具 | DeepSeek Flow |
| --- | --- |
| 全局共享一套流程，换会话就串味 | **每个 session 独立工作流**，互不干扰 |
| 流程图和文档各写各的，改完就分叉 | **双向同步**——改画布 = 写回 MD，改 MD = 刷新画布 |
| 建流程要先学怎么画 | **一句话导入**——跟 Agent 说「导入工作流」，自动生成总纲、每步文档和画布 |
| 跑分、Bench 一堆用不上的 | 只做三件事：**编辑流程 · 同步文档 · AI 校验/优化** |
| 画布库越用越重 | **自研原生 SVG 边层 + HTML 节点层**，不依赖 @xyflow，bundle 约 120 KB |
| 颜色写死，和你的界面打架 | 全部 Harness 主题 token——**明暗主题自动跟随 WebUI** |

**内置 AI 助手**（手动触发、一次性 Agent）：逻辑校验 + 单文档/整流程优化，全部**接受/拒绝制**——你不点接受，一个字都不会落盘。任务跑在**独立会话**里：切走、切会话都不中断，回来结果还在。模型与思考强度可以在界面上选。

**平台说明：**界面目前只针对 **Web UI** 优化；Host 逻辑与界面无关，TUI 等其他界面应该也能用，但未专门适配——欢迎 PR。

## 📸 效果图

同一份工作流、同一个版本——只切换了 WebUI 主题，插件颜色自动跟随。

<p align="center">
  <img src="docs/images/light.png" width="49%" alt="浅色主题">
  <img src="docs/images/dark.png" width="49%" alt="深色主题">
</p>

## 🚀 快速开始

```bash
dsh plugin --profile web add "github:kanghelyu/dsh-deepseek-flow#main"
```

重启 `dsh web`，完事。纯 git 源安装、构建产物已入库、依赖全部来自 registry、bundle 层随安装自动挂载——已在全新 profile 上端到端实测。

验证：

```bash
dsh web --dump-config | grep deepseek-flow
```

### 使用

1. 打开任意会话 → 顶部标签 **DeepSeek Flow**。
2. 说「导入工作流」——Agent 自动生成 `WORKFLOW.md` + 每步 `STEP.md` + 画布。
3. 拖节点、连箭头、改提示词——保存自动写回对应 MD 文件。
4. 底部 **AI 文档助手**做逻辑校验与优化。
5. 随时切走——任务继续跑，回来结果都在。

### 开发

```bash
dsh plugin --profile web add link:/path/to/deepseek-flow   # 本地源码
node --test test/*.test.mjs                                 # 31/31
node scripts/build.mjs                                      # 重建客户端 bundle
bash scripts/ensure-deps.sh                                 # 老环境的依赖兜底
```

### 卸载

```bash
dsh plugin --profile web remove deepseek-flow
```

## 🧠 架构

```
deepseek-flow/
├── lib/index.js                  Host——每会话存储、remote CRUD、工具、assist 编排
├── lib/agent-assistant.js        AI 校验/优化——提示词、schema、独立会话任务
├── lib/typert.descriptors.js     Typert wire 参数白名单
├── lib/client.js                 Client bundle（构建产物已入库）
├── src/client/entry.js           Client 源码——五列布局、自研画布、助手
├── scripts/                      build / ensure-deps / ui-shot（Playwright 断言）/ smoke
├── test/                         31 项契约测试
└── cordis.patch.yml              插件行（dataDir，可选 assistantModel / assistantTimeoutMs）
```

### 关键机制

- **存储** —— `~/.dsh/deepseek-flow/shared.json` + `sessions/<sessionId>.json`；文件是权威。
- **文档驱动** —— `flow.workflowDoc` + `flow.docs`（nodeId → 相对 `STEP.md`）；读取时文件内容覆盖节点提示词，保存时写回。
- **会话隔离** —— 工具读 `exec.agent.id ?? agent.session?.id`；列表 = 本会话 + 共享模板（同名去重、会话版优先）。
- **AI 任务** —— `dflow/assist` 受理即返回；任务在 `agents.create` 的**独立会话**里执行（`meta: { agentPreset: "standard", cwd }`，`cwd` 必传否则子代理静默失败）；结果按 `sessionId:requestId` 暂存（TTL 30 分钟）；客户端每 3 秒轮询 `dflow/assistHistory`。
- **模型路由** —— 跟随 `agentDefaultModel.currentSelection()`；可用 `assistantModel` 配置或界面选择覆盖；`reasoningEffort` 支持 `off` / `high` / `max`。
- **防回归基线** —— 箭头 `fill:none!important` + 闭合 marker；`GRAPH_MIN_ZOOM = 0.5`；画布结构 CSS 只增不删；颜色只用 `--dsw-alias-*` token。

## License

[MIT](LICENSE) · 社区项目，与 DeepSeek 无关。
