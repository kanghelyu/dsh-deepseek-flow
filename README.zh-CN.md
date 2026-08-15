# DeepSeek Flow

> 面向 DeepSeek Harness 的 Markdown 优先可视化工作流编辑器。

[English](README.md) · **简体中文**

[![GitHub release](https://img.shields.io/github/v/release/kanghelyu/dsh-deepseek-flow?label=release)](https://github.com/kanghelyu/dsh-deepseek-flow/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

DeepSeek Flow 把一份 `WORKFLOW.md` 和各步骤的 `STEP.md` 变成 DeepSeek Harness 里的可编辑流程图。画布与 Markdown 始终同步，让你既能直观地组织流程，也能继续使用可移植、可审阅的普通文件。

它刻意只做编辑器，不做工作流运行器。你可以在 DeepSeek Flow 里设计、检查和优化工作流；真正执行仍然发生在当前 Session。

<p align="center">
  <img src="docs/images/dark.png" width="49%" alt="DeepSeek Flow 深色模式">
  <img src="docs/images/light.png" width="49%" alt="DeepSeek Flow 浅色模式">
</p>

## 你会得到什么

- **Markdown 是唯一事实来源**——一份总控 `WORKFLOW.md`，每个步骤拥有独立的 `STEP.md` 工作区。
- **真正可编辑的流程图**——新建、移动、连接、重连、标注和删除流程框与箭头。
- **双向同步**——在画布和 Markdown 编辑器中的修改都会写回工作流文件。
- **按会话隔离**——每个 Harness Session 保存自己的工作流，同时可使用共享模板。
- **适合大型流程的导航**——左右栏可收起和拖动缩放，支持画布平移、缩放、显示全图、缓动定位与独立滚动区域。
- **原生主题适配**——自动跟随 Harness 明暗主题和 WebUI 界面语言。
- **手动 AI 辅助**——逻辑校验、单文档优化和整工作流优化都由用户主动触发。
- **后台 AI 任务**——切换文档、视图或会话不会中断已受理任务；回来后仍能看到对应文档的结果。

## 快速开始

安装到 Web profile：

```bash
dsh plugin --profile web add "github:kanghelyu/dsh-deepseek-flow#main"
```

重启 `dsh web`，打开任意会话，然后选择 **DeepSeek Flow** 标签。

确认插件已挂载：

```bash
dsh web --dump-config | grep deepseek-flow
```

## 创建第一份工作流

1. 在 Session 中告诉 Agent「构建工作流」或「导入工作流」。
2. 打开 **DeepSeek Flow**，插件会生成总控文档、步骤文档和对应画布。
3. 选择文档编辑 Markdown；也可以把节点右侧的输出端点拖到另一个流程框上，直接创建箭头。
4. 保存修改，流程图模型与 Markdown 文件会继续保持同步。
5. 需要真正执行工作流时，返回 Session 交给 Agent 处理。

典型的工作流目录如下：

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

## AI 文档助手

所有 AI 操作都只能手动发起。DeepSeek Flow 不会自动校验，也不会自动优化文档。

| 操作 | 范围 | 文件修改前会发生什么 |
| --- | --- | --- |
| **逻辑校验** | 全部工作流文档和箭头关系 | Agent 返回可点击定位的红色错误与黄色警告，不修改任何文件。 |
| **AI 优化当前文档** | 当前选中的 `WORKFLOW.md` 或 `STEP.md` | 右侧显示完整修改方案；只有点击**接受修改**才会写回，选择**拒绝修改**则保留原文。 |
| **AI 优化整个工作流** | `WORKFLOW.md` 与全部 `STEP.md` | 先显示风险确认；确认后 Agent 会直接改写并保存整套文档，不提供逐份接受或内置撤销。 |

执行整工作流优化前，建议先提交 Git 或备份重要文档。如果 Agent 工作期间原文发生变化，DeepSeek Flow 会拒绝覆盖更新后的内容。

AI 助手使用隔离的 Agent 任务，但不会运行工作流。你可以在助手菜单里选择模型和思考强度。

## 功能边界

DeepSeek Flow 明确不提供：

- 工作流运行按钮或运行引擎；
- API Key、模型供应商或凭证管理；
- 触发器、定时任务、Webhook 或执行历史；
- 对正常 Session 交互的替代。

这个边界让插件保持轻量：在 DeepSeek Flow 里编辑和校验，在 Session 里真正执行。

## 本地开发

克隆仓库并链接到 Web profile：

```bash
git clone https://github.com/kanghelyu/dsh-deepseek-flow.git
cd dsh-deepseek-flow
dsh plugin --profile web add "link:$PWD"
```

常用检查：

```bash
npm test
npm run build
npm run smoke
```

如果旧版 Harness 本地环境缺少已链接依赖，请先停止 `dsh web`，再运行：

```bash
bash scripts/ensure-deps.sh
```

修改 Client 后需要重新构建并硬刷新浏览器；修改 Host 后还需要重启 `dsh web`。

<details>
<summary>仓库结构</summary>

```text
deepseek-flow/
├── lib/                 Host 代码与已提交的 Client bundle
├── src/client/          WebUI Client 源码
├── scripts/             构建、依赖、截图与冒烟检查
├── test/                契约与回归测试
├── examples/            Markdown 工作流示例
└── docs/images/         README 截图
```

</details>

## 常见问题

- **看不到 DeepSeek Flow 标签：**用 `dsh web --dump-config` 确认插件已挂载，然后重启 Web profile。
- **界面还是旧版：**执行 `npm run build`；Host 有变化时重启服务，并对浏览器进行硬刷新。
- **AI 操作提示没有可用 provider：**先在 Session 或助手菜单中选择可用模型。
- **整工作流优化被拒绝写入：**通常是 Agent 工作期间原文发生变化，或 Agent 没有返回全部必需文档。请基于最新文件重试。

## 卸载

```bash
dsh plugin --profile web remove deepseek-flow
```

## 许可证

[MIT](LICENSE)。社区项目，与 DeepSeek 无隶属关系。
