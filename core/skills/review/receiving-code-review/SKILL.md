---
id: receiving-code-review
name: "Receiving Code Review — 接收与处理代码审查反馈"
stage: review
roles: [implementer]
pattern: review-receiver
mandatory: false
depends: [requesting-code-review]
version: "3.1"
description: "When the user mentions receive review, respond to feedback, or needs to handle code review feedback constructively, ALWAYS use this skill. Feedback processing and iteration guidance."
---

# Receiving Code Review — 接收与处理代码审查反馈

> **设计模式**：Review Receiver（审查反馈处理器）
> **阶段**：Review → Fix
> **角色**：Implementer（代码作者）
> **触发**：PR/MR 收到 review comments 后，或 `/review-fix` 命令
> **与 requesting-code-review 的关系**：互补关系 - 一个发起审查，一个接收并处理反馈

## 核心原则

1. **感谢为先**：无论反馈如何，首先感谢审查者的时间和建议
2. **理解再行动**：确保完全理解每条 feedback 的意图后再修改代码
3. **分类处理**：区分 Must fix / Should consider / Nice to have 三类反馈
4. **透明沟通**：对不采纳的建议给出清晰的技术理由
5. **闭环管理**：每条 feedback 都必须有明确的处理状态（Done/Deferred/Won't Do）

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| PR/MR 收到新评论 | Webhook 或手动检查 | GitHub/GitLab 的 review notifications |
| 用户输入 `/review-fix` | 命令触发 | 针对特定的 PR/MR 处理所有待解决的 review comments |
| Code Review Meeting 结束后 | 手动触发 | 会议中记录的 action items 需要落地执行 |
| Staff Review 完成后 | 自动触发 | staff-review 的产出物需要逐项响应 |

## Feedback 分类与优先级矩阵

### P0 - Must Fix（必须修复，阻塞合并）

**特征**：
- 🔴 Bug 或逻辑错误
- 🔴 安全漏洞
- 🔴 性能严重退化
- 🔴 违反团队强约束（如 TypeScript any 滥用）

**处理时限**：24小时内修复并回复

**示例**：
```markdown
> @reviewer: 这里的空值检查会导致运行时崩溃。当 `user` 为 null 时，
> `user.name` 会抛出 TypeError。

**Response**: ✅ 已修复。添加了可选链操作符 `user?.name` 并补充了单元测试。
见 commit abc1234。
```

### P1 - Should Consider（应当考虑，强烈建议修复）

**特征**：
- 🟡 代码可读性问题
- 🟡 潜在的边界情况
- 🟡 命名不够清晰
- 🟡 可以简化的复杂逻辑

**处理时限**：当前迭代内修复（或明确推迟到下个迭代）

**示例**：
```markdown
> @reviewer: 这个函数有 80 行了，可以考虑拆分成更小的函数。

**Response**: ✅ 同意。已拆分为 `validateInput()` + `processData()` + `formatOutput()`
三个函数，每个 <30 行。见 commit def5678。
```

### P2 - Nice to Have（锦上添花，可选优化）

**特征**：
- 🟢 样式偏好（如单引号 vs 双引号）
- 🟢 注释风格建议
- 🟢 变量命名备选方案
- 🟢 更优雅的实现方式（但当前也可接受）

**处理时限**：有时间时优化，不阻塞合并

**示例**：
```markdown
> @reviewer: 这里可以用 `Array.from()` 替代 `[...map.values()]`，
> 语义更清晰。

**Response**: 💡 好建议！已采纳，确实更易读。见 commit ghi9012。
```

## 完整处理流程（6步）

### Step 1：收集和整理所有 Feedback

```bash
# 使用 gh CLI 获取 PR 的所有 review comments
gh pr view <pr-number> --json comments --jq '.comments[] | {author: .author.login, body: .body, path: .path, line: .line}'

# 输出示例：
# [
#   { "author": "alice", "body": "Consider using...", "path": "src/utils.ts", "line": 42 },
#   { "author": "bob", "body": "Bug here: ...", "path": "src/api.ts", "line": 15 },
#   ...
# ]
```

**整理为结构化格式：**

```markdown
## Review Feedback 清单

**PR #123**: Add user authentication feature
**Reviewer**: alice, bob, charlie
**Total Comments**: 12
**Date**: 2026-05-06

| ID | Author | File:Line | Priority | Status | Summary |
|----|--------|-----------|----------|--------|---------|
| R01 | alice | src/api.ts:15 | P0 | 🔲 Todo | Null check missing |
| R02 | bob | src/utils.ts:42 | P1 | 🔲 Todo | Function too long |
| R03 | charlie | src/types.ts:8 | P2 | ✅ Done | Naming suggestion |
| ... | ... | ... | ... | ... | ... |
```

### Step 2：分析和理解每条 Feedback

**分析框架（5W1H）：**

| 维度 | 问题 | 示例 |
|------|------|------|
| **What** | 具体是什么问题？ | 缺少错误处理 |
| **Where** | 在哪个文件/行？ | `src/api.ts:15` |
| **Why** | 为什么这是个问题？ | 会导致运行时崩溃 |
| **How** | 建议如何修复？ | 添加 try-catch 或返回 Result 类型 |
| **When** | 什么时候会出现？ | API 返回异常数据时 |
| **Who** | 影响谁？ | 所有调用此函数的地方 |

**不理解时的应对策略：**

```markdown
> @reviewer 感谢你的建议！我想确认一下我的理解是否正确：
>
> 你提到的 [具体问题]，是指 [我的理解] 吗？
> 还是你指的是 [另一种可能]？
>
> 如果能提供一个具体的例子或复现步骤会更有帮助！谢谢！🙏
```

### Step 3：制定修复计划

**按优先级排序的修复计划：**

```markdown
## 修复计划

### Phase 1: P0 必须修复（预计 2 小时）
- [ ] R01: 添加空值检查 (src/api.ts:15)
- [ ] R05: 修复 SQL 注入风险 (src/db.ts:33)
- [ ] R08: 补充单元测试覆盖边界情况 (tests/auth.test.ts)

### Phase 2: P1 应当修复（预计 1.5 小时）
- [ ] R02: 重构长函数 (src/utils.ts:42)
- [ ] R04: 改进变量命名 (src/components/UserCard.tsx:12)
- [ ] R07: 添加 JSDoc 注释 (src/helpers.ts)

### Phase 3: P2 可选优化（预计 30 分钟）
- [ ] R03: 采用更简洁的写法 (src/types.ts:8)
- [ ] R06: 统一引号风格 (全局)
- [ ] R09-R12: 其他小改进
```

### Step 4：逐项实施修复

**修复 Commit 规范：**

```bash
# 每个 P0/P1 issue 单独 commit（便于 code review 和 revert）
git checkout -b fix/review-feedback-pr123

# 修复 R01
# （编写代码...）
git add src/api.ts
git commit -m "fix(review): add null check for user object

Resolves R01 from @alice's review.
Add optional chaining and defensive check for null/undefined user."

# 修复 R02
# （编写代码...）
git add src/utils.ts
git commit -m "refactor(review): split long function into smaller helpers

Resolves R02 from @bob's review.
Extract validateInput(), processData(), formatOutput()."

# 批量修复 P2 issues（可以合并为一个 commit）
git add src/types.ts src/components/*.tsx
git commit -m "style(review): address minor suggestions from code review

Resolves R03, R06, R09-R12.
- Use Array.from() instead of spread
- Normalize quote style
- Improve naming clarity"
```

### Step 5：验证修复效果

```bash
# 运行完整测试套件
npm run test

# 运行 lint 检查
npm run lint

# 如果涉及类型变更，检查 TypeScript 编译
npx tsc --noEmit

# 如果是 UI 变更，启动 dev server 目视检查
npm run dev
```

### Step 6：回复每条 Feedback 并更新状态

**回复模板库：**

#### ✅ 采纳并修复

```markdown
✅ **已修复**

感谢建议！我已经 [描述具体做了什么改动]。

**改动位置**: [file:line]
**Commit**: [commit hash]
**测试**: [新增或更新的测试]

[可选：解释为什么这个改动很重要]
```

#### ⏳ 采纳但推迟

```markdown
⏰ **已记录，将在 [Sprint X / Version Y] 中处理**

这是一个很好的建议！但由于 [原因]，我计划在 [时间] 再实施。

**跟踪 Issue**: #[issue-number]
**原因**: [详细说明为什么推迟]
```

#### ❌ 不采纳（附理由）

```markdown
❌ **经过评估，暂不采纳**

感谢提出这一点！我仔细考虑后决定暂时保持现状，原因是：

**技术理由**:
1. [理由 1]
2. [理由 2]

**权衡**:
- 当前方案的优点: [...]
- 建议方案的潜在风险: [...]

**未来可能会重新考虑如果**: [条件变化]

再次感谢你的 input！如果你有进一步的论据说服我，我很乐意讨论。🙂
```

#### ❓ 需要澄清

```markdown
❓ **需要进一步讨论**

我想确保我完全理解你的建议：

[我的理解和问题]

能否提供更多上下文或例子？这样我可以更好地评估如何实施。
```

## 高效处理技巧

### 1. 批量回复相同类型的 Feedback

```markdown
> @all reviewers

感谢大家的详细 review！我注意到有几条关于 [共同主题] 的建议，
我统一回复如下：

[R03, R06, R09]: 关于代码风格的建议
→ ✅ 全部采纳！已在 commit xyz 中统一处理。

[R10, R11]: 关于变量命名的建议
→ ✅ 同意！已改为更具描述性的名称。

这样可以减少重复回复，节省大家的时间。如果有特殊情况需要单独讨论，
请告诉我！
```

### 2. 使用 Draft PR 进行大规模重构

如果 review feedback 涉及大量结构性变更：

```bash
# 创建 draft PR 展示改动，但不请求正式 review
gh pr create --draft --title "WIP: Address review feedback for PR #123" \
  --body "This PR addresses the feedback from PR #123. Please review the approach before I finalize."
```

### 3. 利用 GitHub 的 Code Review 功能

- **Suggestions**：Reviewer 可以直接在代码中插入建议的修改，Author 一键 Accept
- **Inline Comments**：针对特定行的讨论，避免混淆
- **Resolved**：标记已解决的问题，避免重复讨论

## 失败处理（8个场景）

| 失败场景 | 检测方式 | 解决方案 | 恢复命令 |
|---------|---------|---------|----------|
| **Feedback 不清楚** | 无法理解 reviewer 意图 | 主动提问澄清 | 使用上面的"❓ 需要澄清"模板 |
| **多条 Feedback 矛盾** | Reviewer A 说 X, B 说 ¬X | 组织会议或找 Tech Lead 裁决 | 创建 issue 记录争议点 |
| **修复引入新 Bug** | 测试失败 | 回滚该次修复，重新分析 | `git revert <commit>` |
| **修复范围扩大（Scope Creep）** | 修复 A 时顺便改了 B | 控制范围，只修必要的 | 将额外改动放到新 PR |
| **Reviewer 不在线** | 需要 clarification 但无响应 | 先做合理假设并标注 | 在 comment 中 @reviewer 并给 deadline |
| **时间压力（Hotfix 场景）** | 必须快速合并 | 只修 P0，P1/P2 推迟 | 明确标注 Technical Debt |
| **Git 冲突** | 合并 main 时冲突 | 解决冲突后继续 | `git merge main` + resolve |
| **CI 在修复后失败** | Pipeline 红了 | 检查是否是修复导致 | 查看 CI logs 定位问题 |

## 产出物（5个关键交付物）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| Feedback 清单 | `.harness/reviews/pr-<number>-feedback.md` | Markdown | 结构化的所有 review comments | **必需** |
| 修复 commits | Git history | 元数据 | 每个修复对应的独立 commit | **必需** |
| 回复记录 | PR/MR comments | 在线 | 对每条 feedback 的回复 | **必需** |
| 修复验证报告 | `.harness/reports/review-fix-verification.md` | Markdown | 修复后的测试/lint 结果 | 推荐 |
| 技术债务记录 | `.harness/debt/review-deferred.md` | Markdown | 推迟处理的 P1/P2 items | 推荐 |

## 与其他 Skill 的协作矩阵

| 协作 Skill | 协作时机 | 协作内容 | 数据流向 |
|-----------|---------|---------|---------|
| **requesting-code-review** | 配对使用 | 发起 vs 接收 review | PR → Feedback → Fixes |
| **staff-review** | 接收高级别审查 | 处理 Staff Engineer 的反馈 | Staff Report → Action Items |
| **systematic-debugging** | 修复引入 Bug 时 | 定位根因 | Error → Root Cause |
| **tdd** | 修复需要新测试时 | 编写回归测试 | Fix → Test Case |
| **gating** | Gate 5 (Review Gate) | 确保所有 P0 已修复 | Checklist → Pass/Fail |
| **code-simplification** | Review 建议简化时 | 实施简化重构 | Suggestion → Simplified Code |

## 质量门禁（Review Fix Gate）

| 门禁项 | 检查方式 | 通过标准 | 不通过处理 |
|-------|---------|---------|-----------|
| 所有 P0 已修复 | Feedback 清单检查 | P0 status = ✅ Done | 必须立即修复 |
| P1 处理率 ≥ 80% | 统计计数 | 至少 80% 的 P1 已 done 或 deferred with reason | 补充修复或提供理由 |
| 修复通过测试 | `npm run test` | 0 failures | 进入 systematic-debugging |
| 修复通过 lint | `npm run lint` | 0 new errors | 修复 lint 问题 |
| 每条 Feedback 有回复 | PR comments 检查 | 无未回复的 comments | 补充回复 |
| 无新引入问题 | diff 检查 | 修复没有引入新的 P0/P1 | 回退并重新修复 |

## 下一步行动

Receiving Code Review 完成后：

1. **全部修复完成？** → 更新 PR 状态为 "Ready to Merge"，通知 reviewers 再次查看
2. **有遗留问题？** → 创建技术债务 issue，纳入后续迭代
3. **需要再次 review？** → Request re-review from specific reviewers
4. **准备合并？** → 通过 gating 的 Review Gate，进入 ship-pipeline
