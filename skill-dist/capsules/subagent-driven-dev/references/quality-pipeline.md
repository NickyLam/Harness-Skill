# 子代理输出质量门禁详细参考

> 本文件是 `subagent-driven-dev/SKILL.md` 的补充参考，包含子代理输出质量检查流水线、质量指标收集、合并决策矩阵、技术债务管理和异常情况处理的完整细节。

## 目录

1. [质量检查流水线](#1-质量检查流水线)
2. [Step 1: 语法和类型安全检查](#2-step-1-语法和类型安全检查)
3. [Step 2: 代码风格检查](#3-step-2-代码风格检查)
4. [Step 3: 测试验证](#4-step-3-测试验证)
5. [Step 4: 质量指标收集与评估](#5-step-4-质量指标收集与评估)
6. [Step 5: 合并决策矩阵](#6-step-5-合并决策矩阵)
7. [技术债务管理](#7-技术债务管理)
8. [异常情况处理](#8-异常情况处理)

---

## 1. 质量检查流水线

每个子代理任务（Implementer）完成后，**必须**依次执行以下 5 步检查：

```
┌─────────────────────────────────────────────────────────────┐
│              Subagent Output Quality Pipeline               │
│                                                             │
│  Task Complete → Step 1 → Step 2 → Step 3 → Step 4 → Step 5 │
│                       ↓         ↓         ↓         ↓        │
│                    [Quality Gate] ──→ Merge Decision          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Step 1: 语法和类型安全检查

```bash
npx tsc --noEmit --noImplicitAny

# ✅ 通过标准: exit code = 0, 无 type errors, 无 implicit any
# ❌ 不通过: 有任何类型错误或使用了隐式 any
# 🔄 处理: 返回 Implementer 修复（最多重试 2 次）
```

---

## 3. Step 2: 代码风格检查

```bash
npx eslint <changed_files> --ext .ts,.tsx --max-warnings=20

# ✅ 通过标准: 0 errors (warnings ≤ 20)
# ⚠️ 警告但不阻塞: warnings > 0 但 ≤ 20（记录为技术债务）
# ❌ 不通过: errors > 0 或 warnings > 20
# 🔄 处理: 返回 Implementer 自动修复 (--fix) 后重新检查
```

---

## 4. Step 3: 测试验证

```bash
npx vitest run --related <changed_files>
npx vitest run
npx vitest run --coverage

# ✅ 通过标准:
#   - 新增测试全部 PASS
#   - 全量测试无回归（原有测试仍 PASS）
#   - 新增代码覆盖率 ≥ 85%
#   - 全局覆盖率不下降（允许 ±2% 浮动）
# ❌ 不通过: 任何测试 FAIL 或覆盖率严重下降
# 🔄 处理: 返回 Implementer 补充测试或修复实现
```

---

## 5. Step 4: 质量指标收集与评估

收集以下指标并写入 `.harness/metrics/subagent-{task-id}-{timestamp}.json`:

```json
{
  "task_id": "task-uuid",
  "subagent_role": "Implementer",
  "timestamp": "2026-05-08T14:30:00Z",
  "duration_seconds": 234,
  "code_metrics": {
    "loc_total": 150,
    "loc_new": 80,
    "loc_modified": 30,
    "files_changed": 3,
    "functions_added": 5,
    "classes_added": 1
  },
  "test_metrics": {
    "tests_added": 12,
    "tests_passing": 12,
    "tests_failing": 0,
    "coverage_lines_percent": 87.5,
    "coverage_functions_percent": 90.0,
    "coverage_branches_percent": 82.0
  },
  "quality_metrics": {
    "type_errors": 0,
    "lint_errors": 0,
    "lint_warnings": 3,
    "complexity_avg": 6.8,
    "complexity_max": 12,
    "duplicate_lines_percent": 2.1,
    "security_vulnerabilities": 0
  },
  "tdd_compliance": {
    "red_phase_completed": true,
    "green_phase_completed": true,
    "test_written_before_impl": true,
    "violations": []
  }
}
```

**质量门槛判定表**:

| 指标 | 门槛值 | 通过标准 | 不通过处理 | 阻塞级别 |
|------|--------|----------|-----------|----------|
| `type_errors` | = **0** | 必须为 0 | 🔴 返回修复 | **ERROR** |
| `lint_errors` | = **0** | 必须为 0 | 🔴 返回修复 | **ERROR** |
| `tests_added` | > **0** | 至少 1 个测试 | 🔴 要求补充测试 | **ERROR** |
| `tests_failing` | = **0** | 必须全部通过 | 🔴 返回修复 | **ERROR** |
| `coverage_lines_percent` | ≥ **80%** | 达标 | ⚠️ 允许但标记 tech_debt | WARNING |
| `complexity_avg` | ≤ **15** | 达标 | ⚠️ 允许但需记录 | WARNING |
| `complexity_max` | ≤ **25** | 单函数不超过 | ⚠️ 高复杂度函数需审查 | WARNING |
| `security_vulnerabilities` | = **0** (High/Critical) | 无高危漏洞 | 🔴 必须立即修复 | **ERROR** |
| `test_written_before_impl` | = **true** | TDD 合规 | 🔴 不合规返回重做 | **ERROR** |

---

## 6. Step 5: 合并决策矩阵

基于 Step 1-4 的结果，Coordinator 做出最终决策：

| ERROR 级别不通过数 | WARNING 数 | 决策 | 操作 | 记录 |
|-------------------|-----------|------|------|------|
| **0** | **任意** | ✅ **APPROVED** | 合并到主分支 | 正常完成日志 |
| **0** | **≤ 3** | ✅ **APPROVED_WITH_DEBT** | 合并 + 写入 `.harness/tech-debt.md` | 技术债务跟踪 |
| **0** | **> 3** | ⚠️ **CONDITIONAL_APPROVAL** | 合并但必须在本次迭代内偿还债务 | 优先级提升 |
| **1-2** | **任意** | 🔴 **RETRY_ONCE** | 返回 Implementer 修复（第 1 次重试） | 重试记录 |
| **≥ 3** | **任意** | 🔴🔴 **REJECT_AND_ESCALATE** | 拒绝合并，升级给人工审查 | Escalation 日志 |

**自动合并命令（APPROVED 时）**:

```bash
git checkout -b subagent/merge/{task-id}
git apply /tmp/subagent-{task-id}.patch
bash core/skills/cross-cutting/gating/scripts/check-code-quality.sh
git checkout main
git merge subagent/merge/{task-id} --no-ff -m "feat(subagent): {task-description} [{task-id}]"
git branch -d subagent/merge/{task-id}
cp .harness/metrics/subagent-{task-id}-*.json .harness/metrics/archive/
```

---

## 7. 技术债务管理

当子代理输出有 WARNING 级别的质量问题时，必须记录到 `.harness/tech-debt.md`:

```markdown
# Technical Debt Log

## {date} - Subagent Task: {task-id}

| Debt ID | Type | Description | File | Severity | Interest (per week) | Principal | Suggested Fix |
|---------|------|-------------|------|----------|---------------------|-----------|---------------|
| TD-{NNN} | Coverage | Test coverage below 85% for new code | src/services/user.ts | Medium | 15 min | 2 hours | Add edge case tests |
| TD-{NNN} | Complexity | Function `processPayment()` complexity = 18 | src/services/payment.ts | High | 30 min | 4 hours | Extract helper methods |
| TD-{NNN} | Lint | Unused imports in module | src/utils/helpers.ts | Low | 5 min | 10 min | Run eslint --fix |

**Total Debt**: {total_hours} hours ({total_items} items)
**Suggested Paydown Schedule**: Current iteration / Next sprint / Backlog
```

---

## 8. 异常情况处理

| 异常场景 | 检测方式 | 处理策略 | 最大重试次数 | 超时处理 |
|----------|----------|----------|--------------|----------|
| 子代理超时 | 任务执行 > 30 分钟 | 终止子代理，分析已完成部分 | 0（直接进入质量检查） | 使用已完成的部分，未完成部分重新分配 |
| 子代理崩溃 | 非正常退出 | 收集错误日志，重新分配任务 | 2 次 | 第 3 次升级人工处理 |
| 质量检查持续失败 | 连续 2 次重试仍失败 | 暂停当前任务，触发 brainstorming 重新理解需求 | - | 标记为 blocker，需要人工介入 |
| 测试环境问题 | 测试基础设施故障 | 跳过测试验证，仅进行静态分析 | - | 标记为环境依赖，后续补测 |
