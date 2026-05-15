# Evolution Loop — Harness 自动进化循环

> **灵感来源**：AHE (Agentic Harness Engineering) 的 evaluate → analyze → improve 外循环
> **核心原则**：可观测性驱动的进化，而非试错驱动的进化

## 概述

Evolution Loop 是 Harness 的自动改进机制。它不修改基础模型，而是进化 Harness 组件——系统提示、工具描述、技能、中间件、角色定义和长期记忆。

## 三步循环

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. EVALUATE                                       │
│     用当前 Harness 执行基准任务                       │
│     收集 pass/fail 轨迹和度量指标                     │
│                     │                               │
│                     ▼                               │
│  2. ANALYZE                                        │
│     蒸馏原始轨迹为分层证据报告                        │
│     定位失败模式和根因                               │
│     识别需要改进的组件类                              │
│                     │                               │
│                     ▼                               │
│  3. IMPROVE                                        │
│     Evolve Agent 基于证据重写组件                     │
│     每次修改附带预测声明                              │
│     下一轮自动验证预测                               │
│                     │                               │
│                     ▼                               │
│              返回 Step 1                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 执行流程

### Step 1: Evaluate（评估）

使用当前 Harness 执行一组基准任务：

```yaml
evaluate:
  tasks: ".harness/evolution/benchmark-tasks.yaml"
  metrics:
    - gate_pass_rate: "7 个 Gate 的通过率"
    - task_completion_rate: "任务完成率"
    - error_rate: "错误率（P0 + P1）"
    - token_efficiency: "Token 使用效率"
    - prediction_accuracy: "预测成立率"
  output: ".harness/evolution/rollouts/iteration-{N}/"
```

### Step 2: Analyze（分析）

蒸馏原始轨迹为分层证据报告：

```yaml
analyze:
  input: ".harness/evolution/rollouts/iteration-{N}/"
  layers:
    summary: "失败模式汇总 + 改进方向"
    detail: "每个失败任务的详细分析"
    raw: "完整执行轨迹（按需钻取）"
  output: ".harness/evolution/reports/iteration-{N}.md"
  component_mapping:
    "Agent 走偏": "system_prompt"
    "工具误用": "tool_description"
    "执行错误": "tool_implementation"
    "上下文溢出": "middleware"
    "缺乏领域知识": "skill"
    "协作失败": "sub_agent"
    "重复犯错": "long_term_memory"
```

### Step 3: Improve（改进）

Evolve Agent 基于证据重写组件：

```yaml
improve:
  input: ".harness/evolution/reports/iteration-{N}.md"
  actions:
    - component: "<组件类>"
      file: "<变更文件>"
      change: "<变更内容>"
      prediction:
        expected: "<预期效果>"
        verify: "<验证方式>"
  output: ".harness/evolution/predictions/iteration-{N}/"
  constraints:
    - "每次只修改一个组件类"
    - "修改必须附带预测声明"
    - "预测必须在下一轮验证"
    - "验证失败必须回退"
```

## 终止条件

| 条件 | 说明 |
|------|------|
| target_pass_rate | Gate 通过率达到目标（默认 95%） |
| max_iterations | 最大迭代次数（默认 10） |
| prediction_accuracy | 预测成立率连续 3 轮 ≥80% |
| no_improvement | 连续 2 轮无改善 |

## 迭代记录

每次迭代在 `.harness/evolution/iterations/` 下记录：

```markdown
# Iteration {N}

**日期**: YYYY-MM-DD HH:MM
**状态**: RUNNING / COMPLETED / ROLLED_BACK

## 评估结果
- Gate 通过率: X/7
- 任务完成率: X%
- 错误率: X%
- Token 效率: X tokens/task

## 分析结论
- 主要失败模式: <...>
- 根因组件: <component_class>
- 改进方向: <...>

## 改进操作
| 组件 | 文件 | 变更 | 预测 |
|------|------|------|------|
| ... | ... | ... | ... |

## 预测验证（上一轮）
- 预测成立: X/Y
- 预测失败: X/Y
- 回退操作: <...>
```

## 与其他模块的协作

| 模块 | 协作方式 |
|------|---------|
| component-registry | 进化操作注册为组件变更 |
| memory-management | 轨迹存入三层记忆体系 |
| governance | 预测声明和验证纳入治理流程 |
| gating | Gate 通过率作为评估指标 |
