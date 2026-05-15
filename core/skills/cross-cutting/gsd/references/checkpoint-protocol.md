# MCP Checkpoint Protocol (GSD)

## 强制检查点注册

GSD 引入以下 **强制检查点**（不可跳过）：

| Checkpoint ID | 名称 | 类型 | 触发时机 | 强制性 |
|---------------|------|------|----------|--------|
| PLAN-TASKS | 任务拆分确认 | TYPE_C | Step 1 完成后 | MANDATORY |
| PLAN-WAVE | Wave编排确认 | TYPE_C | Step 2 完成后 | MANDATORY |
| EXEC-PRE-RUN | 执行前最终确认 | TYPE_C | Step 3 启动前 | MANDATORY (≥3 tasks) |

## 检查点执行流程

### PLAN-TASKS

```
Checkpoint ID: PLAN-TASKS
Type: TYPE_C (EXECUTION_CHECKPOINT)
Stage: Plan / GSD / Step-1
Status: AWAITING_CONFIRMATION
```

1. 生成任务拆分表格
2. 输出门禁标记：`⚠️ EXECUTION GATE — 任务拆分确认`
3. 调用 AskUserQuestion tool（强制，阻塞式）
4. 等待用户确认
5. 写入 `.harness/checkpoints/plan-task-breakdown.md`

### PLAN-WAVE

```
Checkpoint ID: PLAN-WAVE
Type: TYPE_C (EXECUTION_CHECKPOINT)
Stage: Plan / GSD / Step-2
前置条件: PLAN-TASKS CONFIRMED
Status: AWAITING_CONFIRMATION
```

1. 生成 Wave 可视化计划
2. 输出门禁标记：`⚠️ EXECUTION GATE — Wave 编排确认`
3. 调用 AskUserQuestion tool（强制，阻塞式）
4. 等待用户确认
5. 写入 `.harness/checkpoints/plan-wave-schedule.md`

### EXEC-PRE-RUN

触发条件（满足任一）：
- 首次运行 Wave Executor
- 总任务数 ≥ 3
- Wave 数 ≥ 2
- 距离 PLAN-WAVE 确认时间超过 10 分钟
- 计划有变更

流程：
1. CHECK: `.harness/checkpoints/plan-wave-schedule.md` 存在?
2. CHECK: 确认时间戳是否有效（30分钟内）
3. DISPLAY: 即将执行的摘要
4. CONFIRM: 调用 AskUserQuestion 最终确认
5. BLOCK: 等待用户最终确认
6. ACTION: 启动子代理或取消

## 禁止事项

| # | 禁止行为 | 后果 |
|---|----------|------|
| G-1 | 无 PLAN-TASKS 确认就进入 Wave 编排 | Level-2 Block |
| G-2 | 无 PLAN-WAVE 确认就启动子代理 | Level-2 Block |
| G-3 | 大型执行（≥3 tasks）无 EXEC-PRE-RUN 就启动 | Level-2 Block |
| G-4 | 使用过期的确认（>30min） | Level-2 Block |
| G-5 | Wave 失败后不询问就自动重试 | Warning |
| G-6 | 上下文不足时不确认就切换 | Level-2 Block |
