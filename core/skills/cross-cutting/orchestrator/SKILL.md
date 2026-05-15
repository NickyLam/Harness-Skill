---
id: orchestrator
name: "Orchestrator — 多角色协作编排器"
description: "When the user mentions /harness, pipeline stage, role routing, multi-agent collaboration, or needs to navigate the software development lifecycle, ALWAYS use this skill. Routes commands to 6 roles (PO/Architect/Implementer/Tester/Reviewer/Shipper) across 7 stages."
stage: cross-cutting
roles: [orchestrator]
pattern: routing
mandatory: true
depends: []
version: "3.0"
compatibility:
  tools: [AskUserQuestion, Read, Write]
  dependencies: []
---

# Orchestrator — 多角色协作编排器

> **设计模式**：Pipeline（多步骤串行 + Checkpoint）
> **层级**：编排层 (Orchestration)
> **触发**：任何 /harness 命令的入口路由

## 命令路由表

| 命令 | 角色 | 阶段 | 触发 Skill | 设计模式 | 过程文档 |
|------|------|------|-----------|---------|---------|
| /harness spec | Product Owner | 定义 | brainstorming + spec-generator | Inversion → Generator | GHBANK 需求分析规格说明书 |
| /harness plan | Architect | 规划 | office-hours + writing-plans | Inversion → Generator | GHBANK 系统设计说明书 |
| /harness build | Implementer | 构建 | TDD + subagent-driven-dev | Pipeline + Role Isolation | — |
| /harness test | Tester | 验证 | test-generator + TDD | Generator + Pipeline | — |
| /harness review | Reviewer | 评审 | review + code-simplification | Reviewer | — |
| /harness simplify | Reviewer | 简化 | code-simplification | Reviewer | — |
| /harness ship | Shipper | 发布 | ship + gating | Pipeline + Gating | — |

> **兼容说明**：`/spec`、`/plan` 等短命令仍可使用，内部自动映射为 `/harness <stage>`。

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

### Sequential Pipeline（顺序流水线）

```
PO → Architect → Implementer → Tester → Reviewer → Shipper
```

适用场景：标准功能开发，需求明确

### Iterative Loop（迭代循环）

```
Implementer ↔ Tester（TDD红绿循环）
```

适用场景：编码阶段，快速迭代

### Parallel Split（并行分支）

```
Implementer A ─┐
               ├→ Reviewer
Implementer B ─┘
```

适用场景：多个独立微任务可并行开发

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
- 组合模式中的 Skill 共享上下文（通过交接协议）

## 上下文交接协议

角色切换时必须执行上下文交接，确保信息不丢失：

### 交接格式

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

### Implementer vs Reviewer 意见不一致

1. **技术问题**（实现方式分歧）→ 由 Architect 仲裁
2. **规范问题**（代码风格分歧）→ 以 review-checklist.md 为准
3. **设计问题**（与需求不符）→ 回到 PO 确认

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

| # | 增量 | 阶段 | 状态 | 产出 |
|---|------|------|------|------|
| 1 | <描述> | /harness spec | ✅ | spec 文档 |
| 2 | <描述> | /harness plan | ✅ | 微任务列表 |
| 3 | <描述> | /harness build | 🔄 | 代码 |
```

进度文件位置：`.harness/progress/current.md`

## 强制进度更新机制

**每个阶段转换时必须执行以下操作**：

1. 更新 `.harness/progress/current.md` 中的当前阶段状态
2. 记录已完成的产出文件路径
3. 记录已知问题和下一步操作
4. 如果进度文件未更新，门禁检查将视为不通过

### 进度文件更新模板

```markdown
# 当前进度

**最后更新**：YYYY-MM-DD HH:MM
**当前阶段**：<阶段名>
**当前增量**：<增量描述>

## 已完成阶段

| 阶段 | 状态 | 产出 | 完成时间 |
|------|------|------|---------|
| spec | ✅ | .harness/specs/xxx.md | ... |
| plan | ✅ | .harness/plans/xxx.md | ... |

## 当前工作

- 正在执行：<当前任务>
- 已知问题：<问题列表>

## 下一步

- <下一步操作>
```

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 角色路由冲突 | 按优先级选择最匹配的角色 | 明确指定角色后重新路由 |
| Skill 依赖循环 | 检测循环并打破，提示用户 | 移除循环依赖后重新编排 |
| 阶段跳跃请求 | 检查前置 Gate 是否通过 | 通过前置 Gate 后再跳跃 |
| 进度记录写入失败 | 使用内存缓存暂存 | 修复文件权限后重新写入 |

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 进度记录 | `.harness/progress.json` | JSON | 当前阶段和 Skill 执行状态 |
| 路由决策日志 | `.harness/metrics/<runId>.jsonl` | JSONL | 角色路由和阶段转换记录 |
