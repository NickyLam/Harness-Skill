# Governance Flow — 经验沉淀与治理闭环

> **层级**: L5 治理层
> **核心理念**: "每当你发现 Agent 出错时，就花时间设计工程化方案使它永远不再犯同样的错误"

## OODA 学习循环

```
┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ Observe│───▶│ Orient │───▶│ Decide  │───▶│ Act    │
│  观察   │    │  判断   │    │  决策   │    │  执行   │
└────────┘    └────────┘    └────────┘    └────────┘
     ▲                                            │
     └────────────────────────────────────────────┘
                      （持续循环）
```

## 触发条件

以下事件**自动触发**治理流程:
- Agent 出错 / 测试失败
- /review 发现 P0 问题
- Bug 修复完成
- /ship 发布完成
- 月度/季度时间节点

## 沉淀步骤

### Step 1: Observe — 记录
写入 `.harness/memory/YYYY-MM-DD.md`:
```markdown
### HH:MM — {事件描述}
**触发**: {错误/Review/Bug/Ship}
**现象**: {发生了什么}
```

### Step 2: Orient — 分析
分析根因并归类:
- 是**知识缺失**？→ 需要补充 SKILL.md 或 references/
- 是**流程缺陷**？→ 需要调整 Gate 条件或 Stage 定义
- 是**工具问题**？→ 需要更新配置或模板
- 是**偶发问题**？→ 记录观察即可，暂不行动

### Step 3: Decide — 提炼规则
将经验转化为可操作的规则:
```markdown
## 经验沉淀
**日期**: YYYY-MM-DD
**触发**: {事件}
**根因**: {为什么出错}
**规则**: {提炼出的通用规则}
**固化到**: {哪个 Skill / references / assets / config}
```

### Step 4: Act — 固化
将规则写入系统:
- **编码规范** → `templates/{template}/conventions/`
- **Bug 模式** → `.harness/learned/patterns.md`
- **审查 Checklist** → `capsules/staff-review/references/`
- **Gate 条件** → `gating/gate-definitions.yaml`
- **Capsule 增强** → `capsules/{id}/SKILL.md`
- **项目约定** → `.harness/memory/MEMORY.md`

## 成熟度模型

| 等级 | 名称 | 特征 | 判定标准 |
|------|------|------|---------|
| L0 | 无治理 | Agent 自由执行，无规范 | 无 `.harness/` 目录 |
| L1 | 有知识 | 有 SKILL.md 但无门控 | ≥5 个 SKILL.md，无 Gate 检查 |
| L2 | 有管控 | 编排+门控，质量可控 | orchestrator + gating 完整 |
| L3 | 有治理 | 四层完整，经验闭环 | governance + memory + ≥10 条经验 |

## 度量指标

| 指标 | 收集方式 | 目标值 |
|------|---------|--------|
| 增量交付速率 | 每次 /ship 的耗时 | ≤30 min/增量 |
| 测试通过率 | `npm run test` | 100% |
| 测试覆盖率 | `npm run test:coverage` | ≥80% (L2) / ≥90% (L3) |
| P0 问题数 | /review 输出 | = 0 |
| P1 问题数 | /review 输出 | ≤3 (L2) / ≤1 (L3) |
| Bug 回归率 | patterns.md 中"已修"再次出现 | = 0 |
| Review 循环次数 | Mini-Wave 触发次数 | ≤1/增量 |
| 经验沉淀条数 | learned/ 目录 | 持续增长 |

## 周期性回顾

| 频率 | 动作 |
|------|------|
| 每次 /review | 更新 review checklist（如有新模式）|
| 每次 Bug 修复 | 更新 bug patterns |
| 每次 /ship | 更新 ship checklist + 度量指标 |
| 每周 | 回顾 MEMORY.md → 提炼新模式 |
| 每月 | 执行 memory 蒸馏 + 成熟度评估 |
| 每季度 | 全面回顾 → 清理无用 Skill → 补充缺失能力 |
