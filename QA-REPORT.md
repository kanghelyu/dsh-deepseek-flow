# DeepSeekFlow 0.3.9 · 主 Session 拓扑审查、逻辑门与可靠性质检报告

## 结论

本版在可计算基础逻辑门之上新增了明确的拓扑提交事务：新增/删除/移动流程框、逻辑门、箭头与输入输出只形成画布草稿，右下角“应用修改”确认后才进入本地校验、当前主 Session 绑定 Agent 审查、二次校验与 revision 原子保存。Markdown 正文走独立保存通道，不能夹带拓扑，也不会被拓扑 Agent 返回值覆盖。

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
| IF/ELSE、AND、OR、NOT、NAND、NOR、XOR、XNOR 使用确定性标准真值语义 | 通过（直接真值表测试） |
| AND/OR/NAND/NOR/XOR/XNOR 至少两个输入，IF/ELSE 与 NOT 恰好一个输入 | 通过 |
| Studio 按每条入边配置 truthy / falsy / nonEmpty 谓词 | 通过（状态与源码契约测试） |
| 门输出为 false 时仍传播到下游条件门，可被 NOT 或组合门继续计算 | 通过（直接数据流测试） |
| flow_read 返回 logicContract；flow_evaluate 返回门结果、信号与激活目标 | 通过 |
| WORKFLOW.md 自动写入公式、输入谓词与传播规则 | 通过（真实文件写入测试） |
| Agent 逻辑校验收到完整 logicContract，不得把门当作箭头文字 | 通过 |
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
| Agent 可配置 10–600 秒超时（默认跟随 Harness 生命周期），逻辑结果最多 20 条 | 通过 |
| 顶部无效“新建”已移除，底部节点工具条保留 | 通过 |
| 不存在自动校验、自动优化或工作流运行入口 | 通过 |
| Client 文案、样式、画布、图模型与入口编排已按职责拆分 | 通过 |
| 图转换、持久化、连线限制与布局拥有直接单元测试 | 通过 |
| 无 node_modules 环境可将全部 Client 模块离线构建为单一 bundle | 通过 |
| flow_create 使用稳定 step id + connections 直接生成普通无环分支图，并支持带上限和退出条件的反馈边 | 通过 |
| 同层执行顺序按 data.order、画布 x/y、数组下标依次决定 | 通过 |
| flow/JSON 优先写入；磁盘优先必须显式选择 | 通过 |
| generated STEP 目录随 label/顺序变化，旧目录进入可恢复回收区 | 通过 |
| flow_delete 归档插件托管工作区，外部 docRoot 保持不动 | 通过 |
| 单进程并发写入串行化，旧 revision 保存被明确拒绝 | 通过 |
| 普通无界环拒绝；显式反馈边要求有限次数、退出条件和闭环普通路径 | 通过 |
| JSON 工具参数同时接受原生值与 Web GUI 字符串化 JSON，错误形状明确拒绝 | 通过 |
| 首次安装缺少旧 harness-flow 状态文件只记录无需迁移，不报 ENOENT 错误 | 通过 |
| 多条校验错误按行编号显示 | 通过 |
| 仅拓扑变化时右下角出现“应用修改”，Markdown-only 修改不触发 | 通过（纯 topology signature/diff 测试） |
| 保存、Ctrl/Cmd+S、自动同步和 AI 文档优化均不能旁路写入拓扑草稿 | 通过（源码契约与 document-only merge 测试） |
| 确认前显示节点/箭头新增、删除与变化数量 | 通过 |
| 拓扑审查直接使用 live 主 Session Agent 作为 parent，不创建隔离 Session | 通过（模拟 Harness 服务） |
| Agent 输出 schema 不允许 Markdown 字段，文档只作不可变上下文 | 通过（schema 与 prompt 测试） |
| Agent 返回不完整拓扑、未知节点种类或空 id 时拒绝写入 | 通过（直接单元测试） |
| 审查期间 Markdown 更新会从最新 revision 合并，拓扑竞争会拒绝覆盖 | 通过（合并、signature 与 revision 契约测试） |
| 审查失败时已保存 flow 不变，Client 保留画布草稿 | 通过（错误状态与无提前 put 契约） |

## 回归检查

| 检查项 | 结果 |
| --- | --- |
| 文档脚手架、Markdown 覆盖与写回、路径越界保护 | 通过 |
| 两侧拖拽分隔边、阈值收纳、键盘操作契约 | 通过 |
| 每个节点两个贴边端口；SVG 闭合箭头、`fill:none` | 通过 |
| Flow composer 隐藏与卸载恢复契约 | 通过 |
| 暗色 / 亮色只使用 Harness 主题 token | 通过 |
| Client / Remote / Host 无工作流运行入口 | 通过 |
| 自动化测试 | 75/75 通过 |
| 离线 Client 构建与 bundle 加载 | 通过 |
| Client revision | `a82511a4321a` |

## 官方契约依据

- Harness `SubagentRun` 用于一次性前台委派，调用方等待 `result`，并始终负责 `dispose()`。
- `SubagentStartRequest` 必须携带 parent Agent、prompt 与 `AbortSignal`；provider 支持时可请求 `outputSchema`。
- 文档助手继续使用隔离任务；拓扑应用默认优先 `fork`，并把 `agents.get(sessionId)` 返回的 live 主 Session Agent 直接作为 `parent`，不创建额外 Agent Session。

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
