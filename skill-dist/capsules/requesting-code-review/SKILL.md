---
id: requesting-code-review
name: Requesting Code Review — 请求代码审查
stage: review
roles: [reviewer]
pattern: IndependentReviewer
mandatory: true
depends: [verification, tdd]
version: "3.0"
min_lines: 50
description: "When the user mentions request review, send for review, or needs to initiate a formal code review process, ALWAYS use this skill. Coordinates reviewer assignment and feedback collection."
---

# Requesting Code Review — 请求代码审查

> Superpowers 工程方法论层：独立 reviewer 通道，保证审查质量

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| verification-before-completion 验证通过后 | verification 输出「通过」判定时自动触发 | 标准流程节点 |
| 合并分支前 | 准备创建 PR/MR 时 | 作为 PR 的前置步骤 |
| 用户明确要求审查 | 用户输入 `/review` 或「帮我 review 这段代码」 | 显式请求 |
| 关键模块变更完成后 | 涉及核心架构/安全/性能的改动 | 提高审查级别 |
| 定期代码健康检查 | 每个迭代周期结束时 | 例行质量保障 |

**不触发场景**：纯文档修改、注释更新、格式调整（lint auto-fix）、热修复紧急发布（事后补审）。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 待审查的源代码 diff | `git diff` 或 PR/MR 的 changes | 必需 | 审查的核心内容 |
| 验证证据报告 | `.harness/reports/verification-*.md` | 必需 | 证明代码已通过自动化验证 |
| 设计文档（如有） | `.harness/specs/*.md` | 可选 | 帮助理解设计意图和验收标准 |
| 相关 issue/ticket 编号 | 项目管理工具 | 可选 | 追溯需求来源 |

**前置检查**：如果 verification 报告不存在或结论为「不通过」，应先完成 verification 再发起审查。

## 核心原则

1. **审查者独立**：审查者不在实现者上下文中
2. **结构化审查**：按维度系统化审查，不遗漏
3. **建设性反馈**：指出问题的同时给出建议
4. **审查结果可追溯**：审查报告留存在文件中

## 执行流程

### Step 1：准备 Code Review 请求

在发起审查前，按以下 Checklist 准备完整的上下文信息：

#### 上下文准备 Checklist

| # | 准备项 | 内容说明 | 必要性 | 完成标准 |
|---|-------|---------|-------|---------|
| 1 | **变更概述** | 一句话描述这次改了什么 | 必需 | ≤ 50 字，包含 what + why |
| 2 | **Diff 范围** | 涉及的文件列表 + 改动行数统计 | 必需 | 格式：「N 个文件，+X 行，-Y 行」 |
| 3 | **关联需求** | 对应的 issue / ticket / AC 编号 | 必需 | 至少引用一个需求来源 |
| 4 | **测试状态** | 新增/修改的测试 + 通过率 | 必需 | 「N 个新测试，100% 通过」|
| 5 | **设计决策** | 非显而易见的技术选择及理由 | 推荐 | 解释「为什么选 A 不选 B」 |
| 6 | **已知限制** | 本次未解决但已知的问题 | 推荐 | 诚实标注，避免 reviewer 重复发现 |
| 7 | **截图/Demo**（UI 变更） | 变更前后的对比截图或录屏 | UI 变更必需 | 让 reviewer 直观看到效果 |
| 8 | **破坏性变更声明** | 如有 API 签名变更、数据结构迁移等 | 有破坏性时必需 | 明确列出迁移路径 |

#### Code Review Request 模板

```markdown
## Code Review Request

### 元信息
- **作者**：<姓名/Agent ID>
- **分支**：<source-branch> → <target-branch>
- **关联 Issue**：#<issue-number>
- **变更规模**：N 个文件 | +X 行 | -Y 行

### 变更概述
<一句话描述：做了什么 + 为什么做>

### 变更详情
| 文件 | 变更类型 | 说明 |
|-----|---------|------|
| src/hooks/useAuth.ts | 修改 | 新增 token 刷新逻辑 |
| src/__tests__/hooks/useAuth.test.ts | 新增 | 对应的单元测试 |

### 测试状态
- [ ] 新增 N 个测试用例，全部通过
- [ ] 覆盖率变化：XX% → YY%
- [ ] 无 skipped 测试

### 设计决策（如有非显而易见的选择）
1. **选择**：采用方案 A 而非方案 B
   - **理由**：<解释>
2. **选择**：使用库 X 而非手写
   - **理由**：<解释>

### 已知限制（Reviewer 请跳过以下已知问题）
- <列出已知的但不影响合并的问题>

### 破坏性变更（如有）
- <列出 API 签名变更、配置格式变更等>
- <迁移指南或兼容性说明>

### 审查重点（可选）
请特别关注：
- <指出希望 reviewer 重点看的部分>
```

### Step 2：选择 Reviewer

#### Reviewer 选择策略

```
选择决策树：

这个变更是什么类型？
├─ 安全相关（认证、授权、加密、输入验证）
│  └─ → 选择安全专家或有安全背景的 reviewer
│
├─ 性能相关（算法、大数据量、渲染优化）
│  └─ → 选择对性能敏感或有相关经验的 reviewer
│
├─ 架构/核心模块（状态管理、路由、数据流）
│  └─ → 选择 Tech Lead 或最熟悉该模块的资深开发者
│
├─ UI/UX 变更（组件、样式、交互）
│  └─ → 选择前端专家 + 如可能请设计师参与视觉审查
│
├─ 新功能开发
│  ├─ 变更涉及多个模块？
│  │  └─ → 选择至少 2 个 reviewer（各覆盖不同领域）
│  └─ 单一模块内变更？
│     └─ → 选择该模块的 code owner 或熟悉者
│
└─ Bug 修复
   └─ → 引入该 bug 的原作者（如可用）+ 一个独立 reviewer
```

#### Reviewer 匹配矩阵

| 变更特征 | 最佳 Reviewer 类型 | 原因 |
|---------|------------------|------|
| 涉及 3+ 个文件且跨模块 | 全栈/Tech Lead | 能看到全局影响 |
| 单文件小改动 (< 30 行) | 同团队任意成员 | 低风险，快速周转 |
| 含数据库 schema 变更 | DBA / 后端负责人 | 数据迁移风险高 |
| 含第三方依赖版本升级 | 依赖管理经验丰富者 | 了解升级风险和 breaking changes |
| 重构类变更（行为不变） | 原代码作者 | 最了解原有设计意图 |
| 新人提交的第一个 PR | Mentor + Tech Lead | 兼顾指导和质量把关 |

### Step 3：执行多维审查

### 1. 正确性 ✅
- 逻辑是否正确
- 边界条件是否处理
- 空值 / undefined 是否安全

### 2. 可维护性 🔧
- 命名是否清晰（变量、函数、类型）
- 代码是否易读
- 是否有过度抽象

### 3. 性能 ⚡
- 是否有不必要的 re-render
- 是否有内存泄漏风险
- 大列表是否需要虚拟化

### 4. 类型安全 🛡️
- TypeScript 类型是否完善
- 是否有 any 类型需要收窄
- 泛型使用是否合理

### 5. 可测试性 🧪
- 代码是否便于测试
- 依赖是否可 Mock
- 副作用是否隔离

### 6. 安全性 🔒
- 用户输入是否验证
- XSS 风险
- 敏感数据处理

### Step 4：输出审查报告

## 审查报告格式

```markdown
## 代码审查报告

**日期：** YYYY-MM-DD
**审查范围：** <文件列表>
**审查者：** Reviewer 子代理
**PR/Issue**：#<number>

### 总评：✅ 通过 / ⚠️ 需修改 / ❌ 需重做

### 各维度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 正确性 | ⭐⭐⭐⭐⭐ | ... |
| 可维护性 | ⭐⭐⭐⭐ | ... |
| 性能 | ⭐⭐⭐⭐ | ... |
| 类型安全 | ⭐⭐⭐ | ... |
| 可测试性 | ⭐⭐⭐⭐ | ... |
| 安全性 | ⭐⭐⭐⭐⭐ | ... |

### 具体问题

1. **[P0/必须修]** 文件:行号 — 问题描述 + 修改建议
2. **[P1/建议修]** 文件:行号 — 问题描述 + 修改建议
3. **[P2/可选]** 文件:行号 — 问题描述 + 修改建议

### 亮点

- 值得肯定的实现方式
```

### Step 5：Review 后的行动计划

根据审查结果制定行动计划：

#### 行动计划模板

```markdown
## Review 后行动计划

**审查结果**：✅ LGTM（通过）/ ⚠️ Request Changes（需修改）

### 需要处理的反馈项

| # | 级别 | 问题摘要 | 负责人 | 计划完成时间 | 状态 |
|---|------|---------|--------|------------|------|
| 1 | P0 | <必须修复的问题> | Author | YYYY-MM-DD | 🔲 待修复 |
| 2 | P1 | <建议修复的问题> | Author | YYYY-MM-DD | 🔲 待修复 |
| 3 | P2 | <可选改进> | Author | 后续迭代 | 📋 已记录 |

### 处理策略

- **P0 必须**：必须在合并前全部修复，每项修复后回复确认
- **P1 建议**：尽量在本次 PR 中修复，如确实复杂可拆到 follow-up
- **P2 可选**：记录到技术债务 backlog，不阻塞本次合并

### 修复验证
- [ ] P0 项修复后运行全量测试
- [ ] P0 项修复后通知 original reviewer 复审
- [ ] 更新 PR 描述中的「已知限制」（如有 P2 项暂不修复）
```

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 审查报告 | `.harness/reviews/review-<pr/branch>-YYYYMMDD.md` | Markdown | 完整的多维审查结果 |
| Review Request | PR/MR 描述或 `.harness/reviews/request-<topic>.md` | Markdown | 发起审查时的上下文准备 |
| 行动计划 | 嵌入审查报告或 PR 评论 | 表格 | Review 后的处理追踪 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 审查结论为 ❌ 需重做 | 回到 TDD 流程重新实现核心部分 | 保留审查意见作为重做的输入 |
| Reviewer 对同一问题反复提出 | 检查是否理解偏差，必要时线下沟通澄清 | 在 PR 中追加解释性注释 |
| 审查周期过长（>3 天） | 升级给 Tech Lead 仲裁 | 设定 SLA：P0 反馈 24h 内响应 |
| 作者与 Reviewer 意见僵持 | 引入第三个 reviewer 进行仲裁 | 以多数方意见为准 |
| 审查后发现引入回归 | 立即回滚或 hotfix | 触发 systematic-debugging 排查根因 |
| 上下文准备不全导致审查低效 | 补充缺失的上下文信息 | 按 Checklist 逐项补充后重新发起 |

## 交接协议

```markdown
## Code Review 交接包

### 交付给 ship-pipeline（审查通过后）
- 审查报告路径：`.harness/reviews/review-<pr>-YYYYMMDD.md`
- 总评结论：✅ 通过
- P0/P1/P2 问题数：0 / N / M
- 行动计划状态：全部完成 / 部分 defer 到后续

### 交付给 code-simplification（如审查中发现简化机会）
- 审查中标记的简化建议段落
- 涉及的文件和行号范围
- 简化优先级建议

### 交付给 finishing-a-development-branch（进入分支收尾）
- 审查通过的最终 commit 列表
- 所有审查意见的处理状态
```

**交接验证**：接收方确认审查报告存在且总评为 ✅ 或 ⚠️（含已完成的行动计划）。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 审查报告存在 | 文件系统检查 | `.harness/reviews/` 下有对应 review 报告 |
| 包含 6 维度评分 | 内容搜索 | 出现正确性/可维护性/性能/类型安全/可测试性/安全性 全部 6 个维度 |
| 有明确总评 | 内容搜索 | 包含「总评」字段且值为 ✅/⚠️/❌ 之一 |
| P0 问题数为 0（通过条件） | 内容统计 | 当总评为 ✅ 时，P0 问题数 = 0 |
| 请求模板完整 | 内容检查 | 包含变更概述、diff 范围、关联需求、测试状态 4 项必需信息 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| Superpowers: subagent-driven-development | 审查者子代理执行代码审查 |
| Superpowers: verification-before-completion | 验证通过后请求审查 |
| GSTACK: /review | Superpowers 内部审查 + /review Staff 工程师审查 |
| Superpowers: finishing-a-development-branch | 审查通过后 → 分支收尾 |
| code-simplification | 审查发现简化项 → 交接给 simplification |
