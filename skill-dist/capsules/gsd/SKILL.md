---
id: gsd-core
name: "GSD — Getting Stuff Done 核心引擎"
description: "Use when the user needs wave-based execution, subagent orchestration, parallel tasks, or complex multi-step workflow. Handles task breakdown, wave scheduling, and mandatory checkpoints. NOT for simple tasks under 5 steps."
stage: core
roles: [orchestrator]
pattern: wave-execution
mandatory: false
depends: []
version: "1.0.0"
compatibility:
  tools: [AskUserQuestion, Task, Read, Write, Glob, Grep]
  dependencies: []
---

# GSD 核心引擎

> 上下文工程 + 波次编排 + 子代理隔离

## 何时使用

✅ **使用 GSD**:
- 复杂任务 (>5 步骤)
- 多文件重构
- 多轮迭代开发
- 需要子代理并行执行

❌ **不使用 GSD**:
- 简单单步任务
- 文件阅读/搜索
- 即时问答
- 简单代码修改

## 核心流程

### 1. 任务拆分 (Task Breakdown)

将大任务拆分为原子微任务：

| 规则 | 说明 |
|------|------|
| 大小 | ≤5 分钟可完成 |
| 验证 | 独立可验证 |
| 依赖 | 明确声明 |

**输出**: 任务表格 + 依赖图

### 2. 波次编排 (Wave Scheduling)

```
Wave 1: [T1] [T2] [T3]     ← 无依赖，并行
Wave 2: [T4] [T5]           ← 依赖 Wave 1
Wave 3: [T6]                ← 依赖 Wave 2
```

### 3. 用户确认 (Checkpoint)

| Checkpoint | 触发时机 | 强制 |
|-----------|---------|------|
| PLAN-TASKS | 任务拆分后 | ✅ |
| PLAN-WAVE | 波次编排后 | ✅ |
| PRE-EXEC | 执行前 | ≥3任务 |

### 4. 子代理执行

```
Task(tool):
  subagent_type: "general_purpose_task"
  description: "T{N}: {任务}"
  prompt: |
    ## 任务: {描述}

    ## TDD 流程
    1. RED: 写失败的测试
    2. GREEN: 最少代码通过
    3. REFACTOR: 优化

    ## 约束
    - 输出: {路径}
    - 依赖: {路径}
```

### 5. 上下文监控

| 使用率 | 动作 |
|--------|------|
| >60% | 警告 + 询问切换 |
| >80% | 强制确认 |

## 禁止事项

| # | 禁止 | 后果 |
|---|------|------|
| G-1 | 无确认就执行 | Block |
| G-2 | 使用过期确认 (>30min) | Block |
| G-3 | 上下文不足不确认 | Block |
| G-4 | 跨 Wave 不等待 | Block |

## 与其他 Skills

| Skill | 协作方式 |
|-------|---------|
| writing-plans | 输入微任务列表 |
| subagent-driven-dev | 子代理执行 |
| tdd | 子代理内部遵循 |
| verification | 最终验证 |

## 示例

**用户**: "帮我重构整个登录模块，包括后端验证、前端表单、错误处理"

**GSD 执行**:
1. 拆分: 6 个微任务
2. 编排: 2 个 Wave
3. 确认: PLAN-TASKS → PLAN-WAVE → PRE-EXEC
4. 执行: Wave 1 并行 → Wave 2 并行
5. 验证: verification skill

## 文件结构

```
GSD 会创建/使用:
- .planning/ROADMAP.md    # 路线图
- .planning/STATE.md      # 状态
- .planning/PHASE{N}/     # 阶段目录
├── PLAN.md              # 任务计划
├── WAVE.md              # 波次编排
└── UAT.md              # 验收测试
```
