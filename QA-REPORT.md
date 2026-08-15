# DeepSeekFlow 0.3.9 · 基础逻辑门完整集质检报告

## 结论

本版在原有文档定位、AI 助手与画布能力之上，将条件框扩展为常用基础逻辑门集合：IF/ELSE、AND、OR、NOT、NAND、NOR、XOR 与 XNOR。新建箭头会自动选择或生成逻辑标签，并按门类型限制出线。重复分支、超限出线与重复目标均在写入前拦截并弹出警示。DeepSeekFlow 仍只编辑文档与流程图，不运行工作流。

## 功能验收

| 验收项 | 结果 |
| --- | --- |
| 新建条件框前弹出八类常用逻辑门选择 | 通过（代码契约与状态测试） |
| IF/ELSE 拉线后选择“是/否”，每个分支只允许一次 | 通过 |
| IF/ELSE 第三条出线被拦截并弹出警示 | 通过 |
| AND / OR 出线自动标注，可连接多个不同目标 | 通过 |
| NAND / NOR / XOR / XNOR 出线自动标注，可连接多个不同目标 | 通过 |
| NOT 出线自动标注，第二条出线被拦截 | 通过 |
| 已有出线时禁止静默切换门类型 | 通过 |
| 旧工作流可从 sourceHandle 自动推断门类型 | 通过 |
| 门类型和逻辑分支进入持久化、文档结构与 Agent 校验载荷 | 通过 |
| 逻辑校验通过 live `sessionId` 取得父 Agent | 通过（模拟 Harness 服务） |
| 每次点击调用 `ctx.subagents.start()` 建立 one-shot run | 通过（模拟 Harness 服务） |
| Agent 成功、失败、取消均执行 `run.dispose()` | 通过 |
| 支持结构化输出；无结构化能力时解析纯 JSON | 通过 |
| 逻辑请求包含全部 Markdown 与箭头 | 通过 |
| 优化请求只包含当前选中的单份 Markdown | 通过 |
| 无 live Agent/provider 时明确报错，不回退到本地假 AI | 通过 |
| Agent 调用显示进行中状态并可取消 | 通过 |
| `Error / Warn` 为真实按钮，可切换或取消筛选 | 通过 |
| 问题卡片继续定位对应文档和节点 | 通过 |
| 方案只有“接受”后才写回；原文变化阻止旧方案覆盖 | 通过 |
| 点击左侧步骤文档后以 720ms 缓出动画居中节点 | 通过（代码契约与几何公式） |
| 用户平移、缩放、拖节点时可立即中断定位动画 | 通过 |
| 左侧文档列表与校验结果区均独立滚动 | 通过 |
| 完整 Markdown 只在正文区滚动，接受/拒绝栏固定 | 通过 |
| 整工作流优化先警告不可撤销，再直接原子保存全部文档 | 通过（模拟 Agent 与 Remote 契约） |
| 整体 Agent 漏返回任一文档时拒绝写入 | 通过 |
| 优化期间原文变化时拒绝覆盖 | 通过 |
| 默认 Agent 超时 75 秒，逻辑结果最多 20 条 | 通过 |
| 顶部无效“新建”已移除，底部节点工具条保留 | 通过 |
| 不存在自动校验、自动优化或工作流运行入口 | 通过 |

## 回归检查

| 检查项 | 结果 |
| --- | --- |
| 文档脚手架、Markdown 覆盖与写回、路径越界保护 | 通过 |
| 两侧拖拽分隔边、阈值收纳、键盘操作契约 | 通过 |
| 每个节点两个贴边端口；SVG 闭合箭头、`fill:none` | 通过 |
| Flow composer 隐藏与卸载恢复契约 | 通过 |
| 暗色 / 亮色只使用 Harness 主题 token | 通过 |
| Client / Remote / Host 无工作流运行入口 | 通过 |
| 自动化测试 | 38/38 通过 |
| 离线 Client 构建与 bundle 加载 | 通过 |
| Client revision | `b77abfae2024` |

## 官方契约依据

- Harness `SubagentRun` 用于一次性前台委派，调用方等待 `result`，并始终负责 `dispose()`。
- `SubagentStartRequest` 必须携带 parent Agent、prompt 与 `AbortSignal`；provider 支持时可请求 `outputSchema`。
- `spawn` 与 `fork` 官方 provider 均支持结构化输出；本插件默认优先 `spawn`，避免把父会话历史无关内容带入文档校验。

## 截图质检

- `qa/ui-preview-1680-v9-dark.png`：暗色宽屏；三项 Agent 操作、两栏圆角滚动区与固定决策栏清楚可见。
- `qa/ui-preview-1680-v9-light.png`：亮色宽屏；红黄状态、预览区和主题边界对比清楚。
- `qa/ui-preview-900-v9-dark-collapsed.png`：暗色窄屏；两侧栏与助手收纳，工具栏和画布无覆盖。

这些 PNG 是复用正式 CSS、布局常量与画布 DOM 结构的确定性快照；真实用户 Agent/模型调用只能在用户 Mac 的 Harness profile 中完成。

## 用户 Mac 最终复验

1. 停止 dsh web，运行 `bash scripts/ensure-deps.sh` 和 `node scripts/build.mjs`。
2. 重启 web，确认 200 后硬刷新，核对页面 revision 与 `lib/client.rev`。
3. 修改任意 Markdown，点“逻辑校验”；按钮应显示“Agent 校验中…”，完成后出现 Error/Warn。
4. 分别点击 Error、Warn，确认列表筛选；再次点击同一按钮应恢复全部结果。
5. 点击左侧任一 STEP.md，确认对应流程框用平滑动画居中；动画途中拖动画布，确认立即接管。
6. 点击问题定位文档，再点“AI 优化当前文档”；滚动完整预览时顶部接受/拒绝栏保持可见，先拒绝确认原文不变，再生成并接受。
7. 点击“AI 优化整个工作流”，确认警告弹框出现；仅在备份测试数据后确认，检查全部 Markdown 一次保存。
8. 接受后再次逻辑校验复测；长请求可用“取消 Agent”停止。
9. 分别运行暗/亮主题 `scripts/ui-shot.mjs`，确认沉浸视图、箭头、端口和面板布局。
