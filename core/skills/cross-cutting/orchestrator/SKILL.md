---
id: orchestrator
name: "Orchestrator — 多角色协作编排器"
description: "When the user mentions /harness, pipeline stage, role routing, multi-agent collaboration, or needs to navigate the software development lifecycle, ALWAYS use this skill. Routes commands to 6 roles (PO/Architect/Implementer/Tester/Reviewer/Shipper) across 7 stages."
stage: cross-cutting
roles: [orchestrator]
pattern: routing
mandatory: true
depends: []
version: "4.0"
compatibility:
  tools: [AskUserQuestion, Agent, TaskCreate, TaskList, TaskUpdate, SendMessage, TeamCreate, Read, Write, Bash]
  dependencies: []
---

# Orchestrator — 多角色协作编排器 v4.0

> **设计模式**：Pipeline（多步骤串行 + Checkpoint）+ Multi-Agent Orchestration
> **层级**：编排层 (Orchestration)
> **触发**：任何 /harness 命令的入口路由

## 命令路由表

| 命令 | 角色 Agent | 阶段 | 触发 Skill | 设计模式 | 过程文档 |
|------|-----------|------|-----------|---------|---------|
| /harness spec | harness-po | 定义 | brainstorming + spec-generator | Inversion → Generator | GHBANK 需求分析规格说明书 |
| /harness plan | harness-architect | 规划 | office-hours + writing-plans | Inversion → Generator | GHBANK 系统设计说明书 |
| /harness build | harness-implementer | 构建 | TDD + subagent-driven-dev | Pipeline + Role Isolation | — |
| /harness test | harness-tester | 验证 | test-generator + TDD | Generator + Pipeline | — |
| /harness review | harness-reviewer | 评审 | review + code-simplification | Reviewer | — |
| /harness simplify | harness-reviewer | 简化 | code-simplification | Reviewer | — |
| /harness ship | harness-shipper | 发布 | ship + gating | Pipeline + Gating | 发布确认 |
| /harness evolve | — | 进化 | evolution-loop | Evaluate→Analyze→Improve | 进化报告 |

> **兼容说明**：`/spec`、`/plan` 等短命令仍可使用，内部自动映射为 `/harness <stage>`。

## 会话启动健康度检查（v4.1 新增）

> **灵感来源**: Claude Code KAIROS 模式的 morning-checkin Cron 任务
> **跨平台适配**: 不依赖 Cron，在每次会话启动时自动执行

每次 Harness 会话启动时，自动执行轻量级健康度检查：

```
会话启动
    │
    ├── 1. 读取 .harness/metrics/ 下的近期数据（如果存在）
    ├── 2. 计算健康度指标（7 日滑动窗口）：
    │   · gate_pass_rate: Gate 通过率
    │   · error_rate: P0+P1 错误率
    │   · skill_hit_rate: Skill 命中率
    │
    ├── 3. 健康度评估：
    │   ├── ≥ 80% → 正常启动，不提示
    │   ├── 60-80% → 轻量提示："📊 近期质量指标有所下降，建议运行 /harness evolve"
    │   └── < 60% → 强烈建议："⚠️ 质量指标严重下降，强烈建议运行 /harness evolve evaluate"
    │
    └── 4. 继续执行用户请求的任务
```

**注意**：如果 `.harness/metrics/` 目录不存在或无数据，跳过健康度检查，直接执行用户任务。

## 编排模式选择

### Expert Team 模式（多 Agent 并行）

**触发条件**：
- 用户明确请求"专家团" / "expert team" / 多 Agent 模式
- 任务跨 3+ Stage，且 Build 阶段有并行机会
- 环境支持 TeamCreate + Agent + SendMessage

**编排方式**：
1. 读取 `.workbuddy/agents/harness-team-lead.yaml` 激活 Team Lead
2. Team Lead 使用 TeamCreate 创建团队
3. 按 Stage 顺序使用 Agent 工具 spawn 角色 Agent
4. Agent 间通过 SendMessage 通信
5. Team Lead 汇总结果、运行 Gate、向用户交付

### Single Agent 模式（单 Agent 顺序，向后兼容）

**触发条件**：
- 用户未指定多 Agent 模式
- 简单任务或单 Stage 任务
- 环境不支持 TeamCreate

**编排方式**：
1. 按 First Decision 表读取对应角色 MD + Capsule SKILL.md
2. 在同一上下文中顺序执行各 Stage
3. 文件系统交接上下文
4. 输出降级提示: "⚠️ 当前为单 Agent 降级模式，角色隔离受限"

## 增量迭代节奏

```
/harness spec → /harness plan → /harness build → /harness test → /harness review → /harness simplify → /harness ship
     │               │               │               │               │                │                │
     ▼               ▼               ▼               ▼               ▼                ▼                ▼
  Spec Gate      Plan Gate      Build Gate      Test Gate      Review Gate     Simplify Gate     Ship Gate
     ✅              ✅              ✅              ✅              ✅               ✅               ✅
```

### 节奏原则

1. **一次只做一块**（薄垂直切片）
2. **每个增量 ≤5 分钟**
3. **实现→测试→验证→提交**
4. **变更约100行**
5. **每个 Gate 不通过就回退**

## 多角色协作模式

### Sequential Pipeline（顺序流水线 — Expert Team 模式）

```
Team Lead → Agent(harness-po) → Agent(harness-architect) → Agent(harness-implementer) → Agent(harness-tester) → Agent(harness-reviewer) → Agent(harness-shipper)
```

每个 Agent 完成后通过 SendMessage 向 Team Lead 汇报，Team Lead 汇总后 spawn 下一个 Agent。

适用场景：标准功能开发，需求明确

### Iterative Loop（迭代循环）

```
Agent(harness-implementer) ↔ Agent(harness-tester)（TDD红绿循环）
```

适用场景：编码阶段，快速迭代

### Parallel Split（并行分支）

```
Agent(harness-implementer, task=T1, run_in_background=true) ─┐
                                                              ├→ Agent(harness-reviewer)
Agent(harness-implementer, task=T2, run_in_background=true) ─┘
```

适用场景：多个独立微任务可并行开发

## Agent 间通信协议（v4.0 新增）

### 任务分配

Team Lead → 角色 Agent：
```
SendMessage({
  type: "message",
  recipient: "harness-implementer",
  content: "## 任务分配\nWave: 1\nTask ID: T1.1\n任务: {描述}\n输入依赖: {文件}\n输出: {文件}",
  summary: "Build stage task assignment"
})
```

### 进度汇报

角色 Agent → Team Lead：
```
SendMessage({
  type: "message",
  recipient: "harness-team-lead",
  content: "## 任务完成报告\nTask ID: T1.1\n状态: 成功\n产出文件: {路径}\n测试: X/Y 通过",
  summary: "T1.1 completed successfully"
})
```

### Gate 失败修复

Team Lead → 角色 Agent：
```
SendMessage({
  type: "message",
  recipient: "harness-implementer",
  content: "## Gate 失败修复指令\nGate: build_gate\n失败原因: {原因}\n修复要求: {具体修复指令}\n约束: TDD 流程",
  summary: "Build gate fix instruction"
})
```

### 任务依赖管理

```
TaskCreate({subject: "T1.1: 实现登录组件", description: "..."})
TaskCreate({subject: "T2.1: 实现登录API", description: "...", addBlockedBy: ["T1.1-task-id"]})
```

## 渐进式 Skill 加载

### L1 元数据（始终加载，每Skill ≤10行）

```markdown
# <Skill名>
阶段：<阶段> | 模式：<设计模式> | 角色：<角色>
触发：/harness <命令>
一句话：<做什么>
```

### L2 完整指令（按需加载）

用户触发对应命令时，才加载 Skill 的 SKILL.md + assets/ + references/。

### L3 Agent Prompt（Expert Team 模式）

在 Expert Team 模式下，L2 指令被注入到 Agent 的 prompt 中：
- 读取 `.workbuddy/agents/harness-{role}.yaml` 获取 Agent 定义
- 将 Capsule SKILL.md 的核心指令作为 prompt method section 注入
- 将上下文交接信息作为 prompt context section 注入

## 组合模式路由

复杂命令自动触发多个 Skill 的组合：

| 组合命令 | 组成模式 | 执行顺序 | 产出 |
|---------|---------|---------|------|
| `/harness spec` | Inversion → Generator | brainstorming(采访) → spec-generator(文档) | 设计文档 + GHBANK 需求分析规格说明书 |
| `/harness plan` | Inversion → Generator | office-hours(诊断) → writing-plans(拆分) | 实施计划 + GHBANK 系统设计说明书 |
| `/harness build` | Pipeline + Role Isolation | TDD(红绿循环) + subagent-driven-dev(角色隔离) | 代码+测试 |
| `/harness test` | Generator + Pipeline | test-generator(生成) → TDD(验证) | 测试报告 |
| `/harness review` | Reviewer + Reviewer | review(Staff审查) + code-simplification(简化检查) | 审查报告 |
| `/harness ship` | Pipeline + Gating | ship(步骤) + gating(门禁检查) | 发布确认 |

**执行规则**：
- 组合模式按顺序执行，前一个 Skill 完成才能进入下一个
- 任一 Skill 失败 → 回退到该 Skill 的起点
- Expert Team 模式: 组合模式中各 Skill 由独立 Agent 执行
- Single Agent 模式: 组合模式中各 Skill 在同一上下文顺序执行

## 上下文交接协议

### Expert Team 模式 — SendMessage 交接

角色切换时通过 SendMessage 传递上下文：

```
SendMessage({
  type: "message",
  recipient: "harness-team-lead",
  content: """
  ## 上下文交接: {原角色} → {新角色}
  
  **功能**: {功能名}
  **状态**: {Gate} PASS/FAIL
  **产出文件**: {路径}
  **已知问题**: {问题列表}
  **下一步**: {新角色的任务}
  **参考文件**: {文件路径列表}
  """,
  summary: "Stage handoff from {role} to {role}"
})
```

### Single Agent 模式 — 文件交接

角色切换时写入交接文件：

```markdown
## 上下文交接

**从**：<原角色>
**到**：<新角色>
**时间**：YYYY-MM-DD HH:MM

### 已完成工作
- <工作项 1>
- <工作项 2>

### 当前状态
- <状态摘要>

### 已知问题
- <问题 1> → <状态>

### 下一步
- <新角色的任务>

### 参考文件
- <文件路径 1>
- <文件路径 2>
```

### 交接检查清单

- [ ] 设计文档已更新并审批
- [ ] 计划文件已创建
- [ ] 测试已编写并通过
- [ ] 审查意见已处理
- [ ] 进度文件已更新

## 冲突解决机制

### Agent 间文件冲突

| 场景 | 解决方式 |
|------|---------|
| 两个 Agent 修改同一文件 | TaskList.addBlockedBy 串行化，先到先改 |
| Agent 修改范围超出任务 | Team Lead 发送 SendMessage 约束 |
| 修改冲突导致测试失败 | 触发 systematic-debugging Agent 介入 |

### Implementer vs Reviewer 意见不一致

1. **技术问题**（实现方式分歧）→ 由 Architect Agent 仲裁
2. **规范问题**（代码风格分歧）→ 以 review-checklist.md 为准
3. **设计问题**（与需求不符）→ 回到 PO Agent 确认

### 回滚触发条件

当前增量满足以下任一条件时触发回滚：
- 测试失败率 > 50%
- 引入无法快速修复的 Bug（>15 分钟）
- 破坏现有功能（回归问题）
- 用户明确取消

回滚协议详见 `assets/rollback-protocol.md`。

## 进度记录

使用 `assets/incremental-tracker.md` 模板记录进度：

```markdown
## 增量进度

| # | 增量 | 阶段 | Agent | 状态 | 产出 |
|---|------|------|-------|------|------|
| 1 | <描述> | /harness spec | harness-po | ✅ | spec 文档 |
| 2 | <描述> | /harness plan | harness-architect | ✅ | 微任务列表 |
| 3 | <描述> | /harness build | harness-implementer | 🔄 | 代码 |
```

进度文件位置：`.harness/progress/current.md`

## 强制进度更新机制

**每个阶段转换时必须执行以下操作**：

1. 更新 `.harness/progress/current.md` 中的当前阶段状态
2. 记录已完成的产出文件路径
3. 记录已知问题和下一步操作
4. Expert Team 模式: Team Lead 更新 TaskList
5. 如果进度文件未更新，门禁检查将视为不通过

## 失败处理

| 失败场景 | Expert Team 处理 | Single Agent 处理 |
|---------|-----------------|-------------------|
| 角色路由冲突 | Team Lead 重新路由 | 按优先级选择最匹配的角色 |
| Agent 执行失败 | SendMessage 修复指令 | 回退到当前 Stage 起点 |
| Skill 依赖循环 | Team Lead 检测并打破 | 检测循环并提示用户 |
| 阶段跳跃请求 | 检查前置 Gate + TaskList | 检查前置 Gate 是否通过 |
| 进度记录写入失败 | SendMessage 通知 Team Lead | 使用内存缓存暂存 |

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 进度记录 | `.harness/progress.json` | JSON | 当前阶段和 Skill 执行状态 |
| 路由决策日志 | `.harness/metrics/<runId>.jsonl` | JSONL | 角色路由和阶段转换记录 |
| Agent 通信日志 | `.harness/metrics/<runId>-messages.jsonl` | JSONL | Agent 间 SendMessage 通信记录 |
