---
id: ship-pipeline
name: Ship — 发布流水线
description: "When the user mentions /ship, release, deploy, publish, version bump, semver, or needs to prepare code for production deployment, ALWAYS use this skill. Provides complete release pipeline from semver decision through 7-gate pre-ship checks to deployment, monitoring, and rollback procedures."
stage: ship
roles: [shipper]
pattern: Pipeline
mandatory: true
depends: [requesting-code-review, verification]
version: "3.0"
min_lines: 50
---

# Ship — 发布流水线

> GSTACK 产品决策层：从代码完成到发布上线的完整流水线

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 用户输入 `/ship` | 显式请求发布 | 手动触发标准发布流程 |
| 代码审查通过后 | requesting-code-review 输出 ✅ 通过 | 自动进入发布准备 |
| 准备发布新版本时 | 版本号需要更新 | 周期性或里程碑发布 |
| 热修复发布 | 生产环境紧急问题修复 | 走简化版 hotfix 流程 |
| 定期发版（如每周/每两周） | CI/CD 定时触发 | 自动化 release 流水线 |

**不触发场景**：日常开发中的中间提交、实验性分支、WIP 代码。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 审查通过的代码 | `git` 已合并到主分支的代码 | 必需 | 发布的内容来源 |
| 验证证据报告 | `.harness/reports/verification-*.md` | 必需 | 证明所有自动化检查已通过 |
| 代码审查报告 | `.harness/reviews/review-*.md` | 必需 | 证明人工审查已通过 |
| 当前版本信息 | `package.json` 的 version 字段 | 必需 | 确定 base version 用于计算新版本 |
| CHANGELOG 模板（如有） | 项目根目录 `CHANGELOG.md` | 可选 | 遵循项目变更日志格式 |

**前置检查**：如果 verification 报告结论为「❌ 不通过」或 code review 总评为「❌ 需重做」，禁止执行发布流程。

## 核心原则

1. **发布前必须验证**：所有自动化检查必须通过
2. **原子提交**：每个发布对应一个有意义的 commit
3. **可回滚**：每次发布都有版本标记，可快速回退
4. **渐进发布**：先验证后上线，不一步到位

## 执行流程

### Step 1：版本号确定（Semver 决策树）

使用语义化版本（Semantic Versioning）确定本次发布的版本号：

#### Semver 决策树

```
本次变更包含什么？
├─ 🔴 不兼容的 API 变更（breaking change）
│  ├─ 删除了公共函数/类型/组件？
│  ├─ 改变了函数签名（参数类型/数量/返回值类型）？
│  ├─ 改变了配置文件格式且无法自动迁移？
│  ├─ 修改了数据库 schema（非向后兼容）？
│  └─ 任何需要用户修改代码才能升级的变更？
│     └─ → **MAJOR** 版本号 +1（如 1.2.3 → 2.0.0）
│        同时 MINOR 和 PATCH 归零
│
├─ 🟢 向后兼容的新功能
│  ├─ 新增了公共 API（函数/类型/组件）？
│  ├─ 新增了可选的配置项？
│  ├─ 新增了功能模块但不影响现有行为？
│  └─ 现有功能的重大增强（用户可选择性使用）？
│     └─ → **MINOR** 版本号 +1（如 1.2.3 → 1.3.0）
│        PATCH 归零，MAJOR 不变
│
└─ 🔵 Bug 修复（不影响 API）
   ├─ 修复了已知 bug？
   ├─ 修复了安全问题但不涉及 API 变更？
   ├─ 改善了性能但行为不变？
   └─ 内部重构（对外透明）？
      └─ → **PATCH** 版本号 +1（如 1.2.3 → 1.2.4）
         MAJOR 和 MINOR 都不变
```

#### Semver 快速判定表

| 变更类型 | 示例 | 版本升级 | 说明 |
|---------|------|---------|------|
| **Major** | 删除 `getUser()` 方法 | 1.2.3 → **2.0.0** | 破坏性变更，需 migration guide |
| **Minor** | 新增 `getUserByEmail()` 方法 | 1.2.3 → **1.3.0** | 新增能力，完全向后兼容 |
| **Patch** | 修复 `getUser()` 的空值处理 bug | 1.2.3 → **1.2.4** | 错误修复，无 API 变化 |
| **Pre-release** | Beta 版本 | 1.0.0 → **1.0.0-beta.1** | 非稳定发布，附加预发布标签 |

#### 特殊情况

| 场景 | 处理方式 | 示例 |
|------|---------|------|
| 同一版本多次 patch | 继续递增 patch | 1.2.3 → 1.2.4 → 1.2.5 |
| Major 发布后的首次 patch | 从 X.0.0 开始 | 2.0.0 → 2.0.1 |
| 紧急热修复 | 先出 patch，后续再考虑 major | 1.2.3 → 1.2.4（hotfix） |
| Pre-release → 正式 | 去掉 pre-release 标签 | 1.0.0-beta.2 → 1.0.0 |

### Step 2：发布前最终检查（Ship Gate 子检查）

> **注意**：以下 7 项检查是 Gating 系统中 Gate 7（Ship Gate）的详细子检查。
> 前置条件：Gate 1-6（Spec/Plan/Build/Test/Review/Simplify）必须已全部通过。
> 本步骤确认 Ship Gate 的所有子项均满足后才执行发布操作。

所有以下门禁必须全部通过才能继续：

#### Gate 1：✅ 自动化检查全通过

```bash
# 1. 单元测试 — 必须全部通过，0 failures
npm run test

# 2. TypeScript 类型检查 — 必须无错误
npx tsc --noEmit

# 3. ESLint 检查 — 必须无 error，warnings ≤ 5
npm run lint

# 4. 构建验证 — 必须成功，产物存在于 dist/
npm run build
```

**通过标准**：
- [ ] 测试：0 failures, 0 errors, skipped = 0
- [ ] TypeScript：0 errors（warnings 可接受）
- [ ] Lint：0 errors, warnings ≤ 5
- [ ] 构建：成功退出码 0，`dist/` 非空

#### Gate 2：✅ 功能验收全部满足

- [ ] 设计文档中所有 P0 验收标准（AC）均已覆盖
- [ ] 所有 AC 对应的测试用例均通过
- [ ] 无「已知限制」项影响核心功能路径

#### Gate 3：✅ 代码审查通过

- [ ] Code Review 报告总评 = ✅ 或 ⚠️（含已完成行动）
- [ ] P0 问题数 = 0
- [ ] P1 问题数 = 0 或均有明确的 defer 理由和 follow-up issue

#### Gate 4：✅ 版本信息正确

- [ ] `package.json` version 字段已更新为正确的 semver 值
- [ ] 版本号与 Semver 决策树的判定结果一致
- [ ] 无残留的 `-SNAPSHOT`、`-dev`、`-alpha` 等非稳定标签（除非是预发布）

#### Gate 5：✅ CHANGELOG 已更新

- [ ] `CHANGELOG.md` 包含当前版本的条目
- [ ] 条目包含：版本号、日期、变更分类（Added/Changed/Fixed/Removed/Security）、变更描述
- [ ] 无「TBD」「待补充」等占位符

#### Gate 6：✅ Git 工作区干净

```bash
git status
# 预期：nothing to commit, working tree clean
# 或者：只有未跟踪的 dist/ 目录（构建产物）
```

- [ ] 无未暂存的修改
- [ ] 无未提交的更改
- [ ] 当前分支正确（main / master / release 分支）

#### Gate 7：✅ 安全扫描（如适用）

- [ ] 无新增的已知漏洞依赖（`npm audit` 无 high/critical）
- [ ] 无硬编码的密钥/密码/token
- [ ] 敏感配置不在代码库中（使用环境变量）

### Step 3：Git 提交与打标签

```bash
# 确认工作区干净后
git add .
git commit -m "release: v<版本号>"

# 创建版本标签
git tag -a v<版本号> -m "Release v<版本号>: <简要描述>"
```

### Step 4：构建与推送

```bash
# 推送代码和标签
git push origin main --tags

# 构建最终产物
npm run build

# 验证 dist/ 目录产物完整性
ls -la dist/
```

### Step 5：部署（如适用）

- 静态站点部署 `dist/` 目录
- 验证线上环境可访问
- 启动 `/canary` 监控线上状态

### Step 6：发布通知

#### 发布通知模板

```markdown
## 🚀 Release v<版本号>

**发布日期**：YYYY-MM-DD
**发布类型**：🔴 Major / 🟢 Minor / 🔵 Patch
**发布负责人**：<姓名/Agent>

---

### 📋 变更摘要

#### ✨ 新功能（Added）
- <功能描述>

#### 🔧 改进（Changed）
- <改进描述>

#### 🐛 修复（Fixed）
- <bug 描述及 issue 链接>

#### ⚠️ 破坏性变更（Breaking Changes，仅 Major 版本）
- <变更描述>
- **迁移指南**：<如何从旧版本迁移>

#### 🔒 安全（Security）
- <安全修复描述>

---

### 📦 安装/升级

\`\`\`bash
npm install <package-name>@<version>
# 或
npm update <package-name>
\`\`\`

### 🔗 相关链接

- 完整 CHANGELOG：[链接]
- 代码对比：[GitHub diff 链接]
- 文档更新：[文档链接]（如有）

### ⚠️ 注意事项

<列出用户需要注意的事项>
```

### Step 7：发布后监控

- [ ] 确认线上版本号正确显示
- [ ] 核心功能冒烟测试通过（3-5 个关键路径）
- [ ] 错误监控面板无异常 spike
- [ ] 性能指标在正常范围内

## 回滚预案

当发布出现严重问题时，按以下预案执行回滚：

### 回滚决策树

```
发布后发现问题？
├─ 问题严重程度？
│  ├─ 🔴 严重（数据丢失/安全漏洞/核心功能不可用）
│  │  └─ → **立即回滚**（≤ 15 分钟内）
│  │     1. git revert <release-commit>
│  │     2. npm run build
│  │     3. 部署回滚版本
│  │     4. 发送回滚通知
│  │
│  ├─ 🟡 中等（部分功能异常/性能下降/UI 错误）
│  │  └─ → **评估后决定**（30 分钟内决策窗口）
│  │     选项 A：hotfix 并快速发布 patch
│  │     选项 B：回滚到上一版本
│  │     → 选择影响范围更小的方案
│  │
│  └─ 🟢 轻微（边缘 case / 低频问题 / 视觉瑕疵）
│     └─ → **不回滚**，记录为 bug，纳入下一版本修复
│        通知受影响用户（如有必要）
```

### 回滚操作清单

```markdown
## 回滚操作记录

**回滚时间**：YYYY-MM-DD HH:MM
**回滚版本**：v<X.Y.Z> → v<A.B.C>（上一个稳定版本）
**回滚原因**：<问题描述及严重等级>

### 操作步骤
- [ ] 1. 确认当前线上版本：v<X.Y.Z>
- [ ] 2. 执行回滚命令：`git revert <commit-sha>` 或 `git checkout v<A.B.C>`
- [ ] 3. 本地构建验证：`npm run build && npm run test`
- [ ] 4. 部署回滚版本到生产环境
- [ ] 5. 验证回滚后服务恢复正常
- [ ] 6. 更新版本号为 v<A.B.C>+1（防止版本号冲突）
- [ ] 7. 发送回滚通知给所有相关方

### 回滚后跟进
- [ ] 创建 hotfix branch 修复根因
- [ ] 修复后走完整的 /ship 流程发布 patch 版本
- [ ] 进行复盘（Post-mortem），记录教训
```

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| Git Tag | `v<版本号>` | Git tag | 版本的可追溯标记 |
| 构建产物 | `dist/` 目录 | 编译产物 | 部署到生产环境的代码 |
| 发布通知 | `.harness/releases/v<version>-YYYYMMDD.md` | Markdown | 对外发布的变更说明 |
| 发布检查清单 | `.harness/releases/checklist-v<version>-YYYYMMDD.md` | Markdown | 7 个 Gate 的逐项确认记录 |
| 回滚预案（备用） | `.harness/releases/rollback-v<version>.md` | Markdown | 预准备的回滚操作指南 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| Gate 1 自动化检查失败 | 停止发布，回到 systematic-debugging 修复问题 | 修复后重新运行全部 Gate |
| Gate 2 验收标准未满足 | 评估缺失项是否阻塞发布 | P0 未满足则必须补齐；P2 可降级发布并标注 |
| Gate 3 审查未通过 | 回到 requesting-code-review 补充审查 | 审查通过后重新进入 ship 流程 |
| Git 推送失败（冲突） | 拉取最新代码，解决合并冲突后重新提交 | 确保 main 分支是最新的再重新 tag |
| 构建失败 | 分析构建错误，通常是上述 Gate 问题的累积表现 | 从 Gate 1 开始顺序排查 |
| 部署失败 | 检查部署目标环境状态和网络连接 | 回退到上一版本，排查部署配置后再试 |
| 发布后发现严重问题 | 启动回滚预案 | 按回滚决策树选择立即回滚或评估后决定 |
| 版本号冲突（tag 已存在） | 删除本地远程的冲突 tag，重新打正确的 tag | 确认没有其他人同时发布 |

## 交接协议

```markdown
## Ship 交接包

### 交付给 /canary（发布后监控）
- 发布版本号：v<X.Y.Z>
- Git commit SHA：<hash>
- 部署目标环境：<production/staging>
- 关键监控指标基线：[响应时间 < Xms, 错误率 < Y%, ...]

### 交付给下一个迭代（循环开始）
- 当前版本号：v<X.Y.Z>
- 下一个版本预期：基于 backlog 的 next version 建议
- 本次发布遗留的技术债务列表

### 存档到 releases 历史
- 发布通知文档路径
- 发布检查清单路径
- 如有回滚：回滚操作记录路径
```

**交接验证**：接收方（canary 或下一个迭代）确认线上版本号正确且关键指标在正常范围内。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 发布检查清单存在 | 文件系统检查 | `.harness/releases/` 下有 checklist 文件 |
| 7 个 Gate 全部勾选 | 清单内容解析 | Gate 1-7 全部为 ✅ |
| Git Tag 已创建 | `git tag -l` | 远程仓库包含 `v<版本号>` tag |
| CHANGELOG 已更新 | 内容搜索 | `CHANGELOG.md` 中包含当前版本号条目 |
| 版本号符合 Semver | 正则匹配 | 格式为 `X.Y.Z` 或 `X.Y.Z-<pre-release>` |
| 有发布通知 | 文件系统检查 | `.harness/releases/` 下有对应 release note |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| Superpowers: verification-before-completion | 验证通过 → 准备 /ship |
| GSTACK: /review | 代码审查通过 → /ship |
| Superpowers: finishing-a-development-branch | 分支收尾 → /ship 发布 |
| GSTACK: /canary | /ship 发布后 → /canary 监控 |
| systematic-debugging | 发布过程中任一 Gate 失败 → 进入调试流程 |
