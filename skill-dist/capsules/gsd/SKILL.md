---
id: gsd-core
name: "GSD — Getting Stuff Done 核心引擎"
description: "Use when the user needs wave-based execution, subagent orchestration, parallel tasks, or complex multi-step workflow. Handles task breakdown, wave scheduling, and mandatory checkpoints. NOT for simple tasks under 5 steps."
stage: core
roles: [orchestrator]
pattern: wave-execution
mandatory: false
depends: []
version: "2.0.0"
compatibility:
  tools: [AskUserQuestion, Agent, TaskCreate, TaskList, TaskUpdate, SendMessage, TeamCreate, Read, Write, Glob, Grep, Bash]
  dependencies: []
---

# GSD 核心引擎 v2.0

> 上下文工程 + 波次编排 + 子代理隔离 + Agent 真并行

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
| 文件归属 | 每个任务明确声明修改的文件，避免冲突 |

**输出**: 任务表格 + 依赖图 + 文件归属矩阵

### 2. 波次编排 (Wave Scheduling)

```
Wave 1: [T1] [T2] [T3]     ← 无依赖，可并行
Wave 2: [T4] [T5]           ← 依赖 Wave 1
Wave 3: [T6]                ← 依赖 Wave 2
```

### 3. 用户确认 (Checkpoint)

| Checkpoint | 触发时机 | 强制 |
|-----------|---------|------|
| PLAN-TASKS | 任务拆分后 | ✅ |
| PLAN-WAVE | 波次编排后 | ✅ |
| PRE-EXEC | 执行前 | ≥3任务 |

### 4. Agent 并行执行（v2.0 核心变更）

**同一 Wave 内的独立任务，使用 Agent 工具并行 spawn：**

```
# Wave 内并行执行
Agent({
  name: "implementer-T1",
  description: "T1: {任务描述}",
  prompt: "你是 Harness Implementer。任务: {描述}\nTDD流程: RED→GREEN→REFACTOR\n输出: {路径}\n约束: 只修改 {文件列表}",
  subagent_type: "general-purpose",
  run_in_background: true,
  max_turns: 15
})

Agent({
  name: "implementer-T2",
  description: "T2: {任务描述}",
  prompt: "你是 Harness Implementer。任务: {描述}\nTDD流程: RED→GREEN→REFACTOR\n输出: {路径}\n约束: 只修改 {文件列表}",
  subagent_type: "general-purpose",
  run_in_background: true,
  max_turns: 15
})
```

**跨 Wave 执行 — 等待前 Wave 全部完成：**
```
# 等待 Wave 1 的所有 Agent 完成
# 检查方式: TaskList() 查看所有 Wave 1 任务状态
# 全部 completed → 启动 Wave 2
```

### 5. Agent 间协调

使用 SendMessage 进行 Agent 间通信：

| 场景 | 通信方式 |
|------|---------|
| 任务分配 | Team Lead → Agent: SendMessage({type: "message"}) |
| 进度汇报 | Agent → Team Lead: SendMessage({type: "message"}) |
| Gate 失败修复 | Team Lead → Agent: SendMessage({type: "message", content: "fix instruction"}) |
| 团队通知 | Team Lead → All: SendMessage({type: "broadcast"}) |

### 6. 冲突避免机制

| 机制 | 说明 |
|------|------|
| 文件归属矩阵 | 每个任务声明修改的文件列表 |
| TaskList.addBlockedBy | 如果 T4 依赖 T1 的文件，T4 的 task addBlockedBy T1 |
| 文件锁 | 同一文件同一时间只允许一个 Agent 修改 |
| 顺序降级 | 如果文件冲突不可避免，将任务移到同一 Wave 顺序执行 |

### 7. 上下文监控

| 使用率 | 动作 |
|--------|------|
| >60% | 警告 + 询问切换 |
| >80% | 强制确认 |

## Agent YAML 集成

GSD v2.0 的 Agent 使用 `.workbuddy/agents/harness-*.yaml` 定义：

| 角色 | Agent YAML | 适用 Stage |
|------|-----------|-----------|
| Product Owner | harness-po.yaml | spec |
| Architect | harness-architect.yaml | plan |
| Implementer | harness-implementer.yaml | build |
| Tester | harness-tester.yaml | test |
| Reviewer | harness-reviewer.yaml | review, simplify |
| Shipper | harness-shipper.yaml | ship |
| Team Lead | harness-team-lead.yaml | 编排 |

## 禁止事项

| # | 禁止 | 后果 |
|---|------|------|
| G-1 | 无确认就执行 | Block |
| G-2 | 使用过期确认 (>30min) | Block |
| G-3 | 上下文不足不确认 | Block |
| G-4 | 跨 Wave 不等待 | Block |
| G-5 | 并行 Agent 修改同一文件 | Block + 重新编排 |
| G-6 | 忽略 Agent 失败汇报 | Block + 人工介入 |

## 与其他 Skills

| Skill | 协作方式 |
|-------|---------|
| writing-plans | 输入微任务列表 + Wave 编排 |
| subagent-driven-dev | 已融合为 Agent spawn 机制 |
| tdd | Agent 内部遵循 |
| verification | Wave/Gate 后验证 |
| orchestrator | Team Lead 使用 GSD 编排 |

## 示例

**用户**: "帮我重构整个登录模块，包括后端验证、前端表单、错误处理"

**GSD v2.0 执行**:
1. 拆分: 6 个微任务（含文件归属矩阵）
2. 编排: 2 个 Wave
3. 确认: PLAN-TASKS → PLAN-WAVE → PRE-EXEC
4. 执行 Wave 1:
   - 并行 spawn implementer-T1 (后端验证) + implementer-T2 (前端表单) + implementer-T3 (错误处理)
   - 等待全部完成 → 汇总结果
5. 执行 Wave 2:
   - spawn implementer-T4 (集成测试) + implementer-T5 (E2E)
6. 验证: verification skill
7. Gate: build_gate → test_gate

## 文件结构

```
GSD 会创建/使用:
- .planning/ROADMAP.md    # 路线图
- .planning/STATE.md      # 状态
- .planning/PHASE{N}/     # 阶段目录
├── PLAN.md              # 任务计划
├── WAVE.md              # 波次编排
├── FILE-MATRIX.md       # 文件归属矩阵（v2.0 新增）
└── UAT.md              # 验收测试
```
