---
id: verification-before-completion
name: "Verification Before Completion — 任务完成前最终验证清单"
description: "When the user mentions verify before complete, pre-completion check, ready to ship, final validation, or needs to confirm all quality checks pass before marking work done, ALWAYS use this skill. Provides 25-item checklist across code quality, tests, security, build, and documentation."
stage: cross-cutting
roles: [implementer, reviewer]
pattern: pre-completion-checklist
mandatory: true
depends: [tdd, qa, requesting-code-review]
version: "3.1"
---

# Verification Before Completion — 任务完成前最终验证

> **设计模式**：Pre-Completion Checklist（发布前检查表）
> **阶段**：所有开发阶段完成后，Ship 前
> **角色**：Implementer 自检 + Reviewer 复核
> **触发**：`/verify` 或准备提交 PR/MR/Release 时
> **与 verification (test) 的关系**：本 Skill 更轻量、更聚焦于"可交付性"检查，verification 更全面

## 核心原则

1. **零遗漏**：使用 Checklist 确保不遗漏任何关键步骤
2. **自动化优先**：能自动检查的绝不依赖人工
3. **快速执行**：整个验证过程应在 5 分钟内完成
4. **证据留存**：每项检查都有明确的通过证据
5. **阻断机制**：关键项不通过 = 不能标记为完成

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 准备提交 PR/MR | 手动或 Git Hook | push 前自动运行 |
| 完成 Feature 开发 | `/verify` 命令 | 进入 Ship 阶段前的最后检查 |
| Release 前最终确认 | `/ship --verify` | 生产发布前的完整验证 |
| Sprint 结束时 | 批量运行 | 对所有完成的 Story 进行验证 |

## 完整验证清单（5 大类，25 项）

### 📋 类别 1：代码质量（6项）

| # | 检查项 | 自动化？ | 通过标准 | 证据 |
|---|--------|---------|---------|------|
| 1.1 | TypeScript 编译无错误 | ✅ `tsc --noEmit` | 0 errors | 编译输出日志 |
| 1.2 | ESLint 无 error 级别问题 | ✅ `npm run lint` | 0 errors, warnings ≤ 5 | Lint 报告 |
| 1.3 | Prettier 格式化一致 | ✅ `npm run format --check` | 无格式差异 | diff 输出 |
| 1.4 | 无 `console.log` 残留 | ⚠️ 半自动 | 仅允许 `console.warn/error` | grep 结果 |
| 1.5 | 无 `TODO` / `FIXME` / `HACK` | ⚠️ 半自动 | 0 个或已记录到 issue | grep + issue 链接 |
| 1.6 | 无 `any` 类型（除测试文件） | ⚠️ 半自动 | 0 处或已标注理由 | tsc --noImplicitAny |

**快速执行命令：**
```bash
# 一键检查代码质量
echo "🔍 Code Quality Checks..."
npx tsc --noEmit && echo "✅ TS OK" || echo "❌ TS FAIL"
npm run lint && echo "✅ Lint OK" || echo "❌ Lint FAIL"
npm run format --check && echo "✅ Format OK" || { echo "⚠️ Format issues"; npm run format; }
grep -r "console\.(log\|debug)" src/ --include="*.ts" | grep -v ".test." && echo "⚠️ Found console.log" || echo "✅ No console.log"
grep -rn ": any" src/ --include="*.ts" | grep -v ".test." && echo "⚠️ Found any types" || echo "✅ No any types"
```

---

### 🧪 类别 2：测试覆盖（5项）

| # | 检查项 | 自动化？ | 通过标准 | 证据 |
|---|--------|---------|---------|------|
| 2.1 | 单元测试全部通过 | ✅ `npm run test` | 0 failures, 0 skipped | 测试输出 |
| 2.2 | 测试覆盖率 ≥ 80% | ✅ `npm run test:coverage` | 总覆盖率 ≥80% | 覆盖率报告 |
| 2.3 | 新代码有对应测试 | 🔍 文件配对 | 每个 .ts 有 .test.ts | glob 匹配结果 |
| 2.4 | 关键路径有边界测试 | 📋 人工确认 | Happy Path + ≥2 边界 | 测试用例列表 |
| 2.5 | 无 flaky test | 📋 历史数据 | 连续 3 次运行全通过 | CI 历史 |

**快速执行命令：**
```bash
echo "🧪 Test Coverage Checks..."
npm run test -- --coverage --reporters=json 2>&1 | tail -20
echo ""
echo "Checking for untested files..."
for file in $(find src -name "*.ts" ! -name "*.test.ts" ! -name "*.d.ts"); do
  test_file="${file%.ts}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "⚠️ No test for: $file"
  fi
done
```

---

### 🔒 类别 3：安全与合规（4项）

| # | 检查项 | 自动化？ | 通过标准 | 证据 |
|---|--------|---------|---------|------|
| 3.1 | 无硬编码密钥/凭证 | ✅ `git-secrets` / grep | 0 个匹配 | 扫描报告 |
| 3.2 | 依赖无已知漏洞 | ✅ `npm audit` | 0 high/critical | audit 报告 |
| 3.3 | 无敏感信息在日志中 | ⚠️ 人工+grep | 无 password/token/secret | grep 结果 |
| 3.4 | CSP / CORS 配置正确 | 🔍 配置检查 | 符合安全策略 | 配置文件审查 |

**快速执行命令：**
```bash
echo "🔒 Security Checks..."
npm audit --audit-level=high 2>&1 | head -20
echo ""
grep -rE "(password|secret|token|api_key)\s*[:=]\s*[\"']" src/ --include="*.ts" -i && echo "⚠️ Possible hardcoded secrets" || echo "✅ No hardcoded secrets found"
```

---

### 📦 类别 4：构建与部署（5项）

| # | 检查项 | 自动化？ | 通过标准 | 证据 |
|---|--------|---------|---------|------|
| 4.1 | 生产构建成功 | ✅ `npm run build` | exit code 0, dist/ 非空 | 构建产物大小 |
| 4.2 | 构建产物合理 | ✅ du/dist | < 5MB (JS) / < 500KB (CSS) | 构建统计 |
| 4.3 | Docker 镜像可构建（如适用） | ✅ `docker build` | 成功且 < 500MB | 镜像大小 |
| 4.4 | 环境变量文档完整 | 🔍 .env.example | 包含所有必需变量 | 文件对比 |
| 4.5 | Migration 脚本就绪（如适用） | 🔍 文件存在 | 可逆、有回滚脚本 | 脚本审查 |

**快速执行命令：**
```bash
echo "📦 Build & Deploy Checks..."
npm run build 2>&1 | tail -10
echo ""
echo "Build output size:"
du -sh dist/* 2>/dev/null || echo "No dist directory"
```

---

### 📝 类别 5：文档与交付（5项）

| # | 检查项 | 自动化？ | 通过标准 | 证据 |
|---|--------|---------|---------|------|
| 5.1 | README 已更新 | 🔍 内容检查 | 包含安装/使用/贡献指南 | 文件内容 |
| 5.2 | API 变更有 Changelog | 🔍 git log | 新版本有变更记录 | CHANGELOG.md |
| 5.3 | Commit message 规范 | ✅ `commitlint` | 符合 Conventional Commits | 最近 commits |
| 5.4 | PR/MR 描述完整 | 🔍 模板检查 | 包含 What/Why/How/Test | PR body |
| 5.5 | Git 分支整洁 | ✅ git status | 无临时文件、无 stale branches | git status 输出 |

**快速执行命令：**
```bash
echo "📝 Documentation & Delivery Checks..."
[ -f "README.md" ] && echo "✅ README exists" || echo "❌ Missing README"
[ -f "CHANGELOG.md" ] && echo "✅ CHANGELOG exists" || echo "⚠️ No CHANGELOG"
echo ""
echo "Recent commits:"
git log --oneline -5
echo ""
echo "Git status:"
git status --short
```

---

## 执行流程（3步）

### Step 1：运行自动化检查（2分钟）

```bash
#!/bin/bash
# .harness/scripts/pre-completion-check.sh
set -e

echo "==========================================="
echo "  Verification Before Completion"
echo "==========================================="
echo ""

RESULT_FILE=".harness/reports/verify-$(date +%Y%m%d-%H%M%S).json"
mkdir -p .harness/reports

# 运行所有检查并记录结果
{
  echo "{"
  echo '  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
  echo '  "commit": "'$(git rev-parse --short HEAD)'",'
  echo '  "branch": "'$(git branch --show-current)'",'
  
  # 代码质量
  echo '  "codeQuality": {'
  if npx tsc --noEmit > /dev/null 2>&1; then
    echo '    "typescript": "pass",';
  else
    echo '    "typescript": "fail",';
  fi
  
  if npm run lint > /dev/null 2>&1; then
    echo '    "eslint": "pass",';
  else
    echo '    "eslint": "fail",';
  fi
  echo '  },';

  # 测试
  echo '  "tests": {';
  TEST_RESULT=$(npm run test -- --silent 2>&1 | tail -3)
  echo '    "result": "'$TEST_RESULT'",';
  echo '  },';

  # 构建
  echo '  "build": {';
  if npm run build > /dev/null 2>&1; then
    BUILD_SIZE=$(du -sh dist/ 2>/dev/null | cut -f1)
    echo '    "status": "pass",';
    echo '    "size": "'$BUILD_SIZE'",';
  else
    echo '    "status": "fail",';
  }
  echo '  }';
  
  echo "}"
} > "$RESULT_FILE"

echo ""
cat "$RESULT_FILE" | python3 -m json.tool 2>/dev/null || cat "$RESULT_FILE"
echo ""
echo "Report saved to: $RESULT_FILE"
```

### Step 2：人工复核关键项（2分钟）

基于自动化输出，重点复核：

- [ ] 所有 ❌ FAIL 项是否有合理的豁免理由？
- [ ] 所有 ⚠️ WARNING 项是否已记录为技术债务？
- [ ] 是否有遗漏的检查项需要补充？
- [ ] 团队特定的额外要求是否满足？

### Step 3：生成验证报告并签署（1分钟）

```markdown
## Pre-Completion Verification Report

**Generated**: YYYY-MM-DD HH:MM:SS
**Verified by**: @username
**Commit**: abc1234
**Branch**: feature/new-feature

### Summary

| Category | Total | Pass | Fail | Warning | Score |
|----------|-------|------|------|---------|-------|
| Code Quality | 6 | 6 | 0 | 0 | 100% |
| Tests | 5 | 4 | 0 | 1 | 90% |
| Security | 4 | 4 | 0 | 0 | 100% |
| Build & Deploy | 5 | 5 | 0 | 0 | 100% |
| Documentation | 5 | 4 | 0 | 1 | 90% |
| **Total** | **25** | **23** | **0** | **2** | **96%** |

### Verdict

✅ **APPROVED FOR COMPLETION**

All critical checks passed. 2 warnings are acceptable:
- [W1] 1 TODO comment (tracked in #456)
- [W2] Coverage at 79% (will improve in next iteration)

### Sign-off

I have personally verified the above items and confirm this work is ready for completion.

**Signature**: @username
**Date**: YYYY-MM-DD
```

## 失败处理（8个场景）

| 失败场景 | 检测方式 | 处理方式 | 恢复命令 |
|---------|---------|---------|----------|
| **TypeScript 编译错误** | tsc ≠ 0 | 必须修复才能继续 | `npx tsc --noEmit` 查看错误详情 |
| **测试失败** | jest ≠ 0 | 修复或提供 skip 理由 | `npm run test -- --verbose` |
| **Lint Error** | eslint ≠ 0 | 必须修复 | `npm run lint -- --fix` |
| **安全扫描发现漏洞** | npm audit | 评估严重性 | 高危必须修，低危可接受并记录 |
| **构建失败** | build ≠ 0 | 排查构建配置 | `npm run build -- --debug` |
| **缺少测试文件** | glob 不匹配 | 补充测试或说明原因 | 使用 tdd skill 快速生成 |
| **Git 工作区脏** | status 非空 | 提交或 stash | `git stash` 或 `git commit` |
| **环境变量未定义** | .env 缺失 | 创建 .env.example | 从代码中提取所需变量 |

## 产出物（4个关键交付物）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| 验证报告 | `.harness/reports/verify-<timestamp>.json` | JSON | 结构化的检查结果 | **必需** |
| 签署确认 | PR/MR comment 或 Git tag | 在线/元数据 | 人工审核通过的证据 | **必需** |
| 遗留问题清单 | `.harness/debt/<task>-deferred.md` | Markdown | 未通过但被接受的 WARNING 项 | 推荐 |
| 完整性证明 | Git commit SHA + timestamp | 元数据 | 可追溯的验证时间点 | **必需** |

## 与其他 Skill 的协作矩阵

| 协作 Skill | 协作时机 | 协作内容 | 数据流向 |
|-----------|---------|---------|---------|
| **tdd** | 验证前 | 确保测试已写完并通过 | Test Results → Checklist Item 2.x |
| **qa** | 验证前 | 确保 E2E 测试已通过 | QA Report → Checklist Reference |
| **requesting-code-review** | 验证前 | 确保 Code Review 已通过 | Review Status → Checklist Item 5.4 |
| **gating** | 本 Skill 是 Gate 7 的前置 | 验证通过 → 允许进入 Ship Gate | Checklist → Gate Input |
| **ship-pipeline** | 验证通过后 | 触发发布流程 | Approval → Deploy |
| **systematic-debugging** | 任何检查失败时 | 快速定位和修复 | Fail → Debug → Fix → Re-verify |
| **ci-cd-pipeline** | CI 中集成 | 作为 pre-merge gate | Pipeline Stage → Pass/Fail |

## 质量门禁（Pre-Completion Gate）

| 门禁项 | 严重度 | 通过标准 | 不通过处理 |
|-------|--------|---------|-----------|
| 代码编译通过 | 🔴 Critical | 0 TS errors | 必须立即修复 |
| 测试全部通过 | 🔴 Critical | 0 failures | 必须立即修复 |
| 安全无高危漏洞 | 🔴 Critical | 0 high/critical | 必须立即修复 |
| 构建成功 | 🔴 Critical | dist/ 存在且非空 | 必须立即修复 |
| Lint 无 error | 🟡 Major | 0 errors | 必须修复（warnings 可接受） |
| 覆盖率达标 | 🟡 Major | ≥80% (或明确说明例外) | 记录技术债务 |
| 文档更新 | 🟢 Minor | README/CHANGELOG 当前 | 快速补充 |
| Commit 规范 | 🟢 Minor | 符合团队规范 | amend commit |

## 下一步行动

Verification Before Completion 通过后：

1. **✅ 全部通过** → 标记任务为 Done，合并 PR/MR，进入 ship-pipeline
2. **⚠️ 有警告** → 记录技术债务，可以继续但有后续改进任务
3. **❌ 有失败** → 回到对应的 Skill 修复后重新验证
4. **准备发布** → 运行 `/ship` 进行最终发布
