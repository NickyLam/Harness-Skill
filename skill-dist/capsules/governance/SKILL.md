---
id: governance
name: "Governance — 治理流程"
stage: cross-cutting
roles: [reviewer]
pattern: governance
mandatory: false
depends: []
version: "3.0"
description: "When the user mentions governance, decision tracking, or needs to ensure experience accumulation and continuous improvement, ALWAYS use this skill. Decision observability and quality trend analysis."
---

# Governance — 经验沉淀与持续治理（决策可观测性增强版）

> **层级**：治理层 (Governance)
> **触发**：每次错误、每次 /review、每次 /ship 后
> **灵感来源**：AHE Decision Observability — 每次编辑附带自声明预测，下一轮自动证伪

## 核心原则

> 每当你发现 Agent 出错时，就花时间设计一个工程化方案，使该 Agent 永远不会再犯同样的错误。
> — Mitchell Hashimoto (HashiCorp 联合创始人)

> 每次对 Harness 的修改都是一个可证伪的契约——你必须声明预期效果，下一轮执行会验证它。
> — AHE 核心洞察

## 经验沉淀流程

### 触发条件

- Agent 出错 / 测试失败 / /review 发现 P0 问题
- Bug 修复完成
- /ship 发布完成
- Skill 组件变更

### 沉淀步骤

```
1. 记录错误
   → 写入 .workbuddy/memory/traces/{trace_id}.md（原始层）

2. 提炼规则
   → 将错误转化为 Skill 中的规则或 Checklist 项

3. 固化到系统
   → 更新 SKILL.md / references/ / assets/

4. 声明预测（★ 新增：决策可观测性）
   → 每次修改必须声明预期效果

5. 验证闭环
   → 下次同类任务自动验证预测是否成立
   → 预测失败 → 回退修改 + 记录失败原因
```

## 变更预测机制（Decision Observability）

### 核心规则

**任何对 Skill 组件的修改都必须附带预测声明。没有预测的修改 = 无效修改。**

### 预测声明格式

每次修改 Skill 组件时，必须在 `.harness/evolution/predictions/` 下创建预测文件：

```markdown
# Prediction: {prediction_id}

**日期**: YYYY-MM-DD HH:MM
**触发**: <什么问题触发了这次修改>
**组件类**: <system_prompt / tool_description / skill / ...>
**变更文件**: <修改了哪个文件>
**变更内容**: <具体改了什么>

## 预测
**预期效果**: <这次修改预期会带来什么改善>
**验证方式**: <如何验证预测是否成立>
**验证时机**: <下一轮 /harness <stage> 执行时>

## 验证结果（下一轮填写）
- [ ] 预测成立 / 预测失败
- **实际效果**: <观察到了什么>
- **结论**: <保留修改 / 回退修改 / 需要进一步调整>
```

### 预测验证流程

```
修改 Skill 组件 → 声明预测 → 下一轮执行 → 自动验证
                                              │
                                    ┌─────────┴─────────┐
                                    │                     │
                               预测成立               预测失败
                                    │                     │
                              保留修改              回退修改
                              更新 MEMORY.md        记录失败原因
                                                    分析根因
```

### 预测验证时机

| 变更类型 | 验证时机 | 验证指标 |
|---------|---------|---------|
| SKILL.md 修改 | 下次使用该 Skill 时 | 任务完成率 / 错误率 |
| references/ 修改 | 下次引用该参考时 | Bug 模式命中率 |
| assets/ 修改 | 下次使用该模板时 | 模板填充完整率 |
| 门禁规则修改 | 下次 Gate 检查时 | Gate 通过率 |
| 角色提示词修改 | 下次该角色执行时 | 角色遵循度 |

## 经验沉淀模板

```markdown
## 经验沉淀

**日期**：YYYY-MM-DD
**触发**：<错误描述/Review发现/Bug修复>
**根因**：<为什么会出错>
**规则**：<提炼出的规则>
**固化到**：<哪个 Skill / references / assets>
**预测**：<这条规则预期会防止什么问题>
**验证**：<下次如何验证这条规则有效>
```

## 反馈循环

### 周期性回顾

| 频率 | 动作 |
|------|------|
| 每次 /review | 更新 review-checklist.md |
| 每次 Bug 修复 | 更新 bug-patterns.md |
| 每次 /ship | 更新 ship-checklist.md |
| 每周 | 回顾预测验证结果 → 淘汰无效修改 |
| 每月 | 检查 Skill 命中率 → 删除不用的 Skill |

### 预测验证统计（每月汇总）

| 指标 | 目标 |
|------|------|
| 预测成立率 | ≥70% |
| 预测失败后回退率 | 100% |
| 无预测的修改数 | 0 |
| 经验沉淀闭环率 | ≥80% |

## 度量指标

| 指标 | 收集方式 | 目标 |
|------|---------|------|
| 增量交付速率 | 每个 /ship 的时间 | ≤30分钟/增量 |
| 测试通过率 | `npm run test` | 100% |
| 测试覆盖率 | `npm run test:coverage` | ≥80% |
| P0 问题数 | /review 输出 | =0 |
| Bug 回归率 | bug-patterns.md 中"已修"项再次出现 | =0 |
| Skill 命中率 | MEMORY.md 记录 | 每个Skill ≥1次/周 |
| 预测成立率 | predictions/ 目录统计 | ≥70% |

## Harness 成熟度模型（增强版）

| 等级 | 特征 | 判定标准 |
|------|------|---------|
| L0 | 无 Harness，Agent 自由执行 | 无 SKILL.md，无计划文件 |
| L1 | 有知识层（SKILL.md），无门控 | ≥5 个 SKILL.md，无 Gate 检查 |
| L2 | 有编排层 + 门控层，质量可控 | 有 orchestrator + gating，7 个 Gate 定义完整 |
| L3 | 四层完整，经验沉淀闭环，持续治理 | 有 governance + memory-management，经验沉淀 ≥10 条 |
| **L4** | **可观测性驱动，自动进化** | **有 component-registry + 三层记忆 + 决策预测 + 进化循环** |

**当前项目等级**：L3（知识+编排+门控+治理，可观测性增强中）

### L3 → L4 升级路径

| 步骤 | 任务 | 验收标准 |
|------|------|---------|
| 1 | 启用 component-registry.yaml | 所有 Skill 组件已注册 |
| 2 | 升级 memory-management 为三层架构 | traces/ + daily/ + MEMORY.md 三层完整 |
| 3 | 启用决策预测机制 | 每次修改有预测声明 |
| 4 | 积累 ≥10 条已验证的预测 | 预测成立率 ≥70% |
| 5 | 建立进化循环 | evaluate → analyze → improve 闭环运行 |

### 升级检查清单

- [ ] component-registry.yaml 已创建且组件已注册
- [ ] 三层记忆架构已启用
- [ ] 决策预测机制已启用
- [ ] 已验证预测 ≥10 条
- [ ] 进化循环已建立

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 经验模板格式错误 | 跳过该模板，使用默认格式 | 修正模板后重新沉淀 |
| 沉淀目标不明确 | 提示用户指定沉淀类型和范围 | 明确目标后重新执行 |
| 审批流程阻塞 | 通知相关人员并设置超时提醒 | 超时后自动通过或升级 |

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 经验沉淀文档 | `.harness/governance/learnings/<topic>.md` | Markdown | 结构化的经验记录 |
| 决策日志 | `.harness/governance/decisions/<id>.md` | Markdown | ADR 格式的决策记录 |
