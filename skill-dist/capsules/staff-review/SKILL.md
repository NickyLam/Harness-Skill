---
id: staff-review
name: "Staff Review — 工程师级审查"
description: "When the user mentions /review, code review, PR review, staff-level review, or needs a thorough 6-dimension code audit, ALWAYS use this skill. Provides Staff Engineer-level review across correctness, React specifics, performance, type safety, maintainability, and security with P0/P1/P2 severity grading."
stage: review
roles: [reviewer]
pattern: six-dimension-checklist
mandatory: true
depends: []
version: "3.0"
---

# Review — Staff 工程师级别代码审查

> **设计模式**：Reviewer（按 Checklist 逐条审查）  
> **阶段**：评审  
> **角色**：Reviewer  
> **触发**：/review

## 核心原则

1. **高于 CI 标准**：CI 只检查能否运行，Review 检查是否正确
2. **按 Checklist 审查**：不遗漏任何维度
3. **严重等级标注**：每条问题标注 🔴P0/🟡P1/🟢P2
4. **变更约100行**：超过100行的变更建议拆分

## 执行流程

### Step 1：读取审查清单

读取 `references/staff-review-checklist.md`。

### Step 2：按 Checklist 逐条审查

对每个文件按以下6个维度审查：

1. **逻辑正确性** — 边界条件、空值处理、递归终止
2. **React 特定** — 不必要 re-render、useEffect 依赖、key 稳定性
3. **性能** — 不必要计算、大列表渲染、内存泄漏
4. **类型安全** — any 收窄、类型断言安全、泛型合理
5. **可维护性** — 命名清晰、无重复逻辑、魔法值提取
6. **安全性** — XSS 风险、输入验证、敏感数据

### Step 3：输出审查报告

```markdown
## Staff 工程师级代码审查报告

**日期：** YYYY-MM-DD
**审查范围：** <变更文件列表>
**审查结论：** ✅ 可合并 / ⚠️ 修后可合并 / ❌ 需重做

### 严重问题（🔴 P0 — 必须修）
1. 文件:行号 — 问题描述 + 修改建议

### 重要问题（🟡 P1 — 建议修）
1. 文件:行号 — 问题描述 + 修改建议

### 改进建议（🟢 P2 — 可选）
1. 文件:行号 — 问题描述 + 改进方向

### 亮点
- 值得肯定的实现方式
```

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 审查报告 | `.harness/reviews/YYYY-MM-DD-review.md` | Markdown | Staff 工程师级审查报告 |
| 问题清单 | 审查报告内嵌 | Markdown 表格 | 按 P0/P1/P2 分级的修复清单 |
| 审查结论 | 审查报告头部 | 单行 | ✅可合并 / ⚠️修后可合并 / ❌需重做 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 变更文件不存在 | 跳过该文件，在报告中标注"文件缺失" | 确认文件路径后重新审查 |
| 变更超过 500 行 | 建议拆分为多次审查，每次不超过 500 行 | 按模块拆分后逐个审查 |
| 审查清单文件缺失 | 使用内置 6 维度清单兜底 | 创建 staff-review-checklist.md 后重新审查 |
| 所有检查项均为 P0 | 审查结论为"❌需重做"，建议回退到 build 阶段 | 修复所有 P0 后重新提交审查 |
| 无法确定严重等级 | 默认标记为 🟡P1（建议修） | 与团队讨论后调整等级 |

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 审查报告存在 | 文件系统检查 | `.harness/reviews/` 下有对应文件 |
| 无 P0 问题 | 报告内容搜索 | 审查结论非"❌需重做" |
| 6 维度全覆盖 | 报告结构校验 | 每个维度至少有 1 条评价 |
| 变更行数合理 | git diff 统计 | 单次变更 ≤ 500 行 |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| /simplify | /review 审查后 → /simplify 简化 |
| /ship | /review 通过后 → /ship 发布 |
| verification-before-completion | 验证通过后 → /review 审查 |
