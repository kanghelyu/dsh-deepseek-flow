---
name: deepseek-flow
description: >-
  Build, import, inspect, and maintain DeepSeek Flow visual workflows with
  Markdown step workspaces and deterministic Boolean gates.
---

# DeepSeek Flow 工作流

用户要求构建、导入、可视化或修改多步骤工作流时使用本技能。需求已经明确时直接调用工具，不要先让用户重复确认。

## 创建与更新

- 新建优先用 `flow_create`；它会生成 `WORKFLOW.md`、每步 `STEP.md`、画布节点与箭头。
- 更新已有流程先用 `flow_read` 取得当前 `revision`，再用 `flow_put` 并传入该 revision。
- `flow_create` 和 `flow_put` 成功即代表拓扑已经持久化。不要再要求用户去画布点“应用修改”，也不要把同一拓扑再次送回主 Session 审核；Studio 会按 revision 自动同步。
- 如果你没有用 `flow_put`，而是直接编辑现有工作流的 `WORKFLOW.md`、`STEP.md` 或相关定义文件，并且修改会改变节点、逻辑门或箭头，完成文件修改后必须调用 `flow_finalize_canvas`，传入工作流 `id`（建议同时传入修改前 `flow_read` 得到的 `expected_revision`）。它会让 Studio 自动触发一个用户不可见的定稿动作，只做确定性校验并直接保存，不再把相同修改交给主 Session。
- 即使漏掉 `flow_finalize_canvas`，Studio 也会检查拓扑是否经过画布 UI 编辑事件：没有画布编辑事件的外部文件拓扑会自动走同一隐藏定稿通道。用户在画布上手工新增、删除、改门或连线的草稿不会走此通道，仍保留“应用修改”审核。
- 流程必须无环。重试请建模为有界重试步骤或失败终止分支，并在 Markdown 里写明策略。

## 逻辑门的硬规则

逻辑门只计算布尔值，不理解中文条件句：

- `kind` 必须是 `"condition"`。
- `data.gateType` 只能是 `ifElse`、`and`、`or`、`not`、`nand`、`nor`、`xor`、`xnor`。
- `data.predicate` 以及 `data.inputPredicates` 的值只能是 `truthy`、`falsy`、`nonEmpty`。
- 绝对不要写 `predicate: "用户明确确认"` 之类自然语言。需要理解语义时，先让上游 Agent 明确输出 Boolean `true`/`false`，再让门使用 `truthy`。
- `ifElse` 与 `not` 恰好一个入边；其他组合门至少两个入边。
- `ifElse` 的两条出边分别使用 `branch: "true"` 和 `branch: "false"`；其他门的出边 branch 使用对应门名。

可直接复用的 IF/ELSE 建模：

```json
{
  "steps": [
    {
      "id": "judge-confirmed",
      "label": "判断用户是否确认",
      "kind": "agent",
      "prompt": "只判断用户是否已明确确认。必须且只能输出 JSON 布尔值 true 或 false。"
    },
    {
      "id": "gate-confirmed",
      "label": "是否已确认",
      "kind": "condition",
      "data": { "gateType": "ifElse", "predicate": "truthy" }
    },
    { "id": "finalize", "label": "进入定稿", "prompt": "执行定稿步骤。" },
    { "id": "revise", "label": "继续修改", "prompt": "根据反馈继续修改。" }
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

多个检查项进入 AND 门时，每个检查 Agent 都应输出 Boolean；AND 节点写 `data: {"gateType":"and","predicate":"truthy"}`，至少连接两个入边，出边写 `branch:"and"`。

创建后可用 `flow_evaluate` 传入 `{ "上游节点id": true/false }` 验证真值传播；它只计算逻辑门，不执行 Agent 步骤。

## 读取与执行

- `flow_list` 列出当前 Session 与共享流程。
- `flow_read` 返回总纲、步骤文档和 `logicContract`。
- 实际执行始终由当前 Session 按 `WORKFLOW.md` 和各 `STEP.md` 完成；DeepSeek Flow 负责编辑、持久化和确定性门求值。

完成创建或更新后，告诉用户打开 DeepSeek Flow 标签即可查看，不要提示再次应用同一修改。
