# DeepSeekFlow 0.3.5 · 防回归交接

## 产品边界

DeepSeekFlow 只编辑流程图、`WORKFLOW.md` 与各步骤 `STEP.md`。它可以由用户手动调用当前 Session 派生的一次性 Agent 做逻辑校验和 Markdown 优化，但绝不运行工作流。真正执行始终留在 Session。

## 本版必须保留的交互

- 左侧 `.df-docrail__list` 必须是受父级高度约束的独立滚动区。点击 STEP.md 后调用 `flowInstance.focusNode(id, { duration: 720 })`，将节点中心移到画布中心。
- 画布动画使用 `requestAnimationFrame` 与四次缓出曲线；平移、滚轮、拖节点或创建连线必须先取消动画，不能与用户争夺控制权。
- 顶部无效的工作流“新建”按钮已经移除；底部“新建流程框”工具条仍然是有效功能，不得误删。
- 底部助手最大高度为 440px / 中央区 54%。左侧校验结果、右侧完整 Markdown 各自滚动；右侧决策栏固定在预览顶部，正文滚动不能带走按钮。
- 单文档优化只发送当前 Markdown。方案只有“接受修改”才写回；“拒绝修改”保留原文；原文变化时禁止旧方案覆盖。
- 整工作流优化必须先显示不可撤销确认框。确认后 Agent 必须返回 workflow 与每个节点文档的完整文本；漏一份即失败。结果一次调用 `dflow/put` 保存，不进入单文档接受/拒绝流程。
- 整体优化等待期间若 `documentRevisionRef` 变化，必须拒绝覆盖用户的新编辑。

## Agent 契约

- 支持 `logic`、`optimize`、`optimize-workflow` 三种 `dflow/assist` mode。
- `logic` 只返回 error/warning，最多 20 条关键问题；`optimize` 返回当前文档完整 Markdown；`optimize-workflow` 返回全部文档完整 Markdown。
- 所有请求都使用独立 `requestId`、`AbortController` 和一次性 `SubagentRun`；成功、失败、取消都必须 `await run.dispose()`。
- 默认超时 75 秒，可由 `assistantTimeoutMs` 配置覆盖。没有 live Agent/provider 时明确报错，不得本地伪造 AI 结果。

## 画布与主题红线

- 原生 SVG 边层继续强制 `fill:none!important`；每个节点恰好两个贴边端口，箭头使用闭合主题色 marker，禁止恢复常驻 Minimap。
- 新建条件框必须先选择 `ifElse / and / or / not / nand / nor / xor / xnor`。`ifElse` 只允许 `true` 与 `false` 各一条；`not` 只允许一条；其余基础门可连接多个不同目标并自动标注。
- 所有条件出线通过 `sourceHandle` 持久化逻辑分支；显示标签可以本地化，但不得把自动标签固化为单一语言。重复目标、重复分支和超限出线必须在写入前弹窗拦截。
- 条件框已有出线时不得直接切换门类型，必须先删除出线，避免旧箭头被静默改义。
- 左右栏由 9px 分隔边拖动，低于 108px 自动收纳；Flow 挂载时隐藏当前会话 composer，卸载时恢复。
- 颜色只使用 Harness `--dsw-alias-*` token，必须同时检查暗色、亮色与窄屏。

## 发布验证

```bash
node --check lib/index.js lib/document-workflow.js lib/agent-assistant.js src/client/entry.js scripts/build.mjs scripts/ui-shot.mjs
node --test test/*.test.mjs
node scripts/build.mjs
node scripts/client-smoke.mjs
```

真实 Mac 必须停止 web 后运行 `bash scripts/ensure-deps.sh`，再重启并硬刷新。核对页面 revision 等于 `lib/client.rev`，然后用 `scripts/ui-shot.mjs` 完成真实 Harness 复验。
