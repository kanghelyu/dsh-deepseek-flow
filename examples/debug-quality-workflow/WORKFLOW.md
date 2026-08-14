# 试运行、截图调试与质量检查工作流

用于在交付前完成实现、实际启动、关键状态截图和最终质检。

<!-- deepseek-flow:structure:start -->
## 执行顺序

1. [输入](01-input/STEP.md)
2. [规划与拆解](02-plan/STEP.md)
3. [实现与产出](03-build/STEP.md)
4. [试运行与截图调试](04-debug/STEP.md)
5. [质量检查](05-quality/STEP.md)
6. [输出](06-output/STEP.md)
<!-- deepseek-flow:structure:end -->

## 验收要求

- 核心功能实际运行，不只做静态检查。
- 在关键状态、异常状态和修复后状态保留截图。
- 检查构建、功能回归、边界条件与界面重叠。
- 质检不通过时回到对应步骤修复并重新验证。
