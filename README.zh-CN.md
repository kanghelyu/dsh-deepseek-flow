<h1 align="center">DeepSeek Flow</h1>

<p align="center"><strong>看清流程，保留可移植 Markdown，只审查真正的画布修改。</strong></p>

<p align="center">专为 DeepSeek Harness Web UI 打造的 Markdown 优先可视化工作流编辑器。</p>

<p align="center"><a href="https://deepseekflow.kanghelyu.org/">🌐 官方网站 — deepseekflow.kanghelyu.org</a></p>

<p align="center">
  <a href="https://www.npmjs.com/package/deepseek-flow"><img alt="npm 版本" src="https://img.shields.io/npm/v/deepseek-flow?style=flat-square&amp;logo=npm&amp;logoColor=white&amp;color=CB3837"></a>
  <a href="https://github.com/kanghelyu/dsh-deepseek-flow/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/kanghelyu/dsh-deepseek-flow?style=flat-square&amp;logo=github&amp;label=release"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="DeepSeek Harness Web 插件" src="https://img.shields.io/badge/DeepSeek_Harness-Web_Plugin-4F46E5?style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/license-MIT-0EA5E9?style=flat-square"></a>
</p>

<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>

DeepSeek Flow 把一份 `WORKFLOW.md` 和各步骤的 `STEP.md` 变成 DeepSeek Harness 里的可编辑流程图。内置 Skill 让当前 Session 能通过工具创建和维护工作流，同时保持画布、Markdown 双向同步和文件可移植性。

它刻意只做编辑器，不做工作流运行器。你可以在 DeepSeek Flow 里设计、检查和优化工作流；真正执行仍然发生在当前 Session。

<p align="center">
  <img src="docs/images/cndarkui.png" width="49%" alt="DeepSeek Flow 深色模式">
  <img src="docs/images/cnlightui.png" width="49%" alt="DeepSeek Flow 浅色模式">
</p>

## 你会得到什么

- **Markdown 是唯一事实来源**——一份总控 `WORKFLOW.md`，每个步骤拥有独立的 `STEP.md` 工作区。
- **真正可编辑的流程图**——新建、移动、连接、重连、标注和删除流程框与箭头。
- **双向同步**——在画布和 Markdown 编辑器中的修改都会写回工作流文件。
- **区分来源的拓扑事务**——用户在画布上的结构修改走完整的当前 Session 审查；主 Session 直接修改文件产生的拓扑可走不可见的确定性定稿通道，不再把同一修改发回原 Session。
- **可计算逻辑语义**——导出契约包含公式、操作数、谓词和确定性布尔结果，无需运行 Agent 步骤。
- **按会话隔离**——每个 Harness Session 保存自己的工作流，同时可使用共享模板；画布工具栏可直接删除当前工作流或共享模板（托管工作区移入回收区，可恢复）。
- **适合大型流程的导航**——左右栏可收起和拖动缩放，支持画布平移、缩放、显示全图、缓动定位与独立滚动区域；拖动流程框只在松手时提交一次，后台同步走轻量 revision 轮询，大图也不掉帧。
- **原生主题适配**——自动跟随 Harness 明暗主题和 WebUI 界面语言。
- **手动 AI 辅助**——逻辑校验、单文档优化和整工作流优化都由用户主动触发。
- **后台 AI 任务**——切换文档、视图或会话不会中断已受理任务；回来后仍能看到对应文档的结果。
- **结果与草稿持久化**——逻辑校验结果、AI 优化方案、未应用的画布草稿都会落盘保存：切视图、切会话、重启 `dsh web` 都不丢；只有你显式丢弃或提交成功后才清除。650ms 防抖窗口内的 Markdown 修改在离开视图时会立即冲刷落盘。
- **I/O 与内存防护**——文档内容不变不写盘（自动保存不再反复磨损 SSD）、AI 历史与草稿分文件存储、轮询单条查询且有失败/时长双重上限、后台轮询全部可取消不泄漏、子代理默认 10 分钟超时兜底。
- **内置 Agent Skill**——随插件安装，说明全部工作流工具，并提供可直接执行的 IF/ELSE 与布尔门示例。

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

1. 在 Session 中告诉 Agent「构建工作流」或「导入工作流」。内置 `deepseek-flow` Skill 会引导它使用 `flow_create` 或 `flow_put`。
2. 打开 **DeepSeek Flow**，插件会生成总控文档、步骤文档和对应画布。
3. 可以继续让 Session Agent 修改工作流文件，也可以选择文档直接编辑 Markdown。
4. 主 Session 或外部文件驱动的拓扑修改不会再次交给主 Session 审查。Agent 应调用 `flow_finalize_canvas`；即使它忘记调用，Studio 也会发现本次变化没有经过画布编辑事件，并自动按下同一个不可见定稿动作。
5. 当**你自己**在画布里新增、删除、改名或连接流程框时，点击**应用修改**。DeepSeek Flow 会校验图、交给当前 Session Agent 审查、二次校验并原子保存新 revision。
6. 需要真正执行工作流时，返回 Session 交给 Agent 处理。

典型的工作流目录如下：

```text
my-workflow/
├── WORKFLOW.md
├── 01-input/
│   └── STEP.md
├── 02-research/
│   └── STEP.md
├── 03-quality-check/
│   └── STEP.md
└── 04-output/
    └── STEP.md
```

## Agent 工具

| 工具 | 用途 |
| --- | --- |
| `flow_create` | 创建线性或分支工作流、生成文档并保存到当前 Session。 |
| `flow_list` / `flow_read` | 查找工作流，读取总控文档、步骤文档、revision、拓扑和逻辑契约；两者都会返回当前激活的 `activeFlowId`，若用户刚在 Studio 切换了工作流，还会附带一次性 `activeFlowNotice`——Agent 应改用切换后的工作流并忽略早期关于运行其他工作流的指令；无通知则保持对话连续性。 |
| `flow_put` | 导入或原子更新完整 flow 定义；调用成功即代表已经持久化。 |
| `flow_evaluate` | 根据上游值计算布尔门，不运行任何 Agent 步骤。 |
| `flow_finalize_canvas` | Agent 直接改文件后，排队触发 Studio 的不可见确定性定稿动作，跳过主 Session 重复审核。 |
| `flow_delete` | 删除 Session 工作流或共享模板；托管工作区会移入回收区。 |

Harness 的 `skills` 服务就绪后，插件会响应式注册 Skill。包内 `SKILL.md` 的 frontmatter 后保留真实 Markdown 正文，因此文件系统和运行时 provider 都不会再返回空指令。

## 激活工作流与跨 Session 切换

Studio 顶部工具栏的「工作流」下拉列出**全部历史工作流**，按来源分组（当前 Session 在前，其他 Session 其次，共享模板最后）。选中其他 Session 的工作流时，会把它的文档工作区**复制为当前 Session 的独立副本**（外部自定义 docRoot 只挂引用，不复制）。选中共享模板时同样会复制为当前 Session 的独立副本，避免污染共享原件。

每个 Session 把 `activeFlowId`（Studio 中最后使用的工作流）持久化在 `sessions/<id>.json` 里：重新打开 Studio 会自动选中它；指针与历史列表（`dflow/allFlows`）都直接从磁盘读取，重启 dsh web 甚至重启电脑后下拉依然完整，不会为空。新开 Session 画布为空，提示可从下拉选择历史工作流、导入 JSON 或让 Agent 新建。

用户在对话中途切换工作流后，下一次 `flow_list`/`flow_read` 会返回一次性 `activeFlowNotice`，指示 Agent 运行切换后的工作流而非早前指令；通知只发一次，激活工作流没变时什么都不说，对话完全连续。

`flow_create` 支持可选 `language` 参数（`"en"` 或 `"zh"`）。Agent 调用时应传入用户当前语言，使默认名称（`New Flow` / `新工作流`）、默认步骤标签和节点标签按用户语言生成；用户仍可显式覆盖名称。

## 条件框与逻辑门

条件框支持八类逻辑门：**IF/ELSE、AND、OR、NOT、NAND、NOR、XOR、XNOR**。门类型既约束连线标签和出线数量，也会写入当前 Session 可读取的布尔逻辑契约。

| 门类型 | 连线行为 | 布尔结果 |
| --- | --- | --- |
| **IF / ELSE** | 最多一条“是”和一条“否”分支。 | 只激活与条件结果匹配的分支。 |
| **AND / NAND** | 可连多个不同目标，标签自动生成。 | 计算全部已知输入；NAND 对 AND 取反。 |
| **OR / NOR** | 可连多个不同目标，标签自动生成。 | 计算全部已知输入；NOR 对 OR 取反。 |
| **XOR / XNOR** | 可连多个不同目标，标签自动生成。 | 计算奇偶性；XNOR 对 XOR 取反。 |
| **NOT** | 只允许一条自动标注的出线。 | 对唯一输入取反。 |

重复目标、重复“是/否”分支、超量 IF/ELSE 或 NOT 出线、聚合门输入数量错误、未标记的环路和未知节点类型都会被拒绝，并返回可操作的校验信息。有限重试只能使用显式反馈边：`feedback: { maxIterations, exitCondition }`；上限必须有限且为正整数，退出条件不能为空，反馈边必须闭合一条从 target 回到 source 的普通执行路径。反馈边不参与单次布尔门求值，也不会自动执行 Agent 步骤。旧版 true/false 分支会自动归一化为 IF/ELSE。

`flow_evaluate` 工具可根据上游步骤结果确定性计算门状态和激活目标；它不会运行 Agent 步骤，也不会产生工作流副作用。

门谓词刻意限制为三个确定性值：`truthy`、`falsy`、`nonEmpty`。不要在 `predicate` 中填写“用户已经确认”之类自然语言规则。应先增加一个上游 Agent 步骤，让它输出 JSON 布尔值 `true` 或 `false`，再连接到使用 `predicate: "truthy"` 的条件框。

```json
{
  "id": "confirmed",
  "kind": "condition",
  "data": { "label": "是否已确认", "gateType": "ifElse", "predicate": "truthy" }
}
```

## 拓扑提交事务

在 Studio 中新增或删除流程框、逻辑门、箭头、输入、输出，只会形成用户自己的本地拓扑草稿。持久化该草稿必须完成一次显式事务：

```text
本地校验 → 当前 Session Agent 审查 → 二次校验 → revision 原子保存
```

- 审查者是当前 Session 的实时 Agent，不是脱离上下文的独立会话。
- Markdown 只作为不可变审查上下文；拓扑审查不能静默改写文档正文。
- 过期或不完整 revision 会被拒绝，避免并发写入丢失状态。
- 只移动流程框属于布局变化，会自动保存，不会开启拓扑事务。
- 拓扑草稿未提交时，逻辑校验和整工作流优化保持禁用；单文档编辑与优化仍可使用。
- 删除托管工作流或生成的步骤目录时会移入回收区；外部自定义文档根目录绝不会自动移动。

主 Session 直接修改文件时走另一条可信路径：

```text
Session 修改文件 → 可选 flow_finalize_canvas 信号 → 确定性校验 → 原子保存
```

定稿控件真实存在于 Studio 中，但被隐藏，普通界面无法点击。Studio 会记录每一个用户拓扑编辑处理器；如果出现拓扑差异，却没有发生任何画布编辑事件，就把它视为外部文件修改并自动按下隐藏定稿动作。若确定性校验失败，草稿会保留，普通的**应用修改**流程仍然可用。因此即使 Agent 忘记调用工具，也不会完全依赖它是否“听话”。

## AI 文档助手

所有 AI 操作都只能手动发起。DeepSeek Flow 不会自动校验，也不会自动优化文档。

| 操作 | 范围 | 文件修改前会发生什么 |
| --- | --- | --- |
| **逻辑校验** | 全部工作流文档和箭头关系 | Agent 返回可点击定位的红色错误与黄色警告，不修改任何文件。 |
| **AI 优化当前文档** | 当前选中的 `WORKFLOW.md` 或 `STEP.md` | 右侧显示完整修改方案；只有点击**接受修改**才会写回，选择**拒绝修改**则保留原文。 |
| **AI 优化整个工作流** | `WORKFLOW.md` 与全部 `STEP.md` | 先显示风险确认；确认后 Agent 会直接改写并保存整套文档，不提供逐份接受或内置撤销。 |

执行整工作流优化前，建议先提交 Git 或备份重要文档。如果 Agent 工作期间原文发生变化，DeepSeek Flow 会拒绝覆盖更新后的内容。

AI 助手使用隔离的 Agent 任务，但不会运行工作流。你可以在助手菜单里选择模型和思考强度。

拓扑审查是唯一例外：它刻意使用当前 Session 的实时 Agent，因为该 Session 拥有完整工作流上下文；文档校验与优化仍使用隔离的一次性 Agent 任务。

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
├── lib/                 Host、拓扑事务、逻辑语义与已提交的 Client bundle
├── src/client/          WebUI Client 源码
├── skills/              内置 DeepSeek Flow Agent Skill
├── scripts/             构建、依赖、截图与冒烟检查
├── test/                契约与回归测试
├── examples/            Markdown 工作流示例
└── docs/images/         README 截图
```

</details>

当前质量保障包含自动化契约与行为测试，覆盖图转换、有界反馈循环、revision 锁、文档生命周期、拓扑审查、隐藏定稿、布尔语义、连线校验、Agent 任务、JSON 工具参数归一化与生成后的 Client bundle。更多信息见[代码质量说明](CODE-QUALITY.md)和[质检报告](QA-REPORT.md)。

## 常见问题

- **看不到 DeepSeek Flow 标签：**用 `dsh web --dump-config` 确认插件已挂载，然后重启 Web profile。
- **界面还是旧版：**执行 `npm run build`；Host 有变化时重启服务，并对浏览器进行硬刷新。
- **AI 操作提示没有可用 provider：**先在 Session 或助手菜单中选择可用模型。
- **整工作流优化被拒绝写入：**通常是 Agent 工作期间原文发生变化，或 Agent 没有返回全部必需文档。请基于最新文件重试。
- **应用修改被拒绝：**有限重试应使用带正整数 `maxIterations` 和非空 `exitCondition` 的反馈边；其他情况按提示修复普通环路、缺失输入、分支上限或过期 revision，再提交完整拓扑。
- **Session 改完文件后仍短暂出现“应用修改”：**等待 Studio 的文件来源兜底判定，或让 Agent 使用工作流 id 和当前 revision 调用 `flow_finalize_canvas`。
- **Skill 工具返回空正文：**更新插件并重启 `dsh web`；当前版本已内置合法的 `skills/deepseek-flow/SKILL.md`，并会在 `skills` 服务就绪后注册。
- **删除的工作流想找回：**托管工作区保存在 `deepseek-flow/trash/<日期>/`，把目录复制回 `workspaces/` 即可恢复文档；flow 定义可用导出的 JSON 重新 `flow_put` 导入。

## 卸载

```bash
dsh plugin --profile web remove deepseek-flow
```

## 许可证

[MIT](LICENSE)。社区项目，与 DeepSeek 无隶属关系。
