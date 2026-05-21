# TDD 强制执行机制与质量门禁详细参考

> 本文件是 `tdd/SKILL.md` 的补充参考，包含 TDD 强制执行机制、质量门槛、违规处理、时间监控和子代理质量检查的完整细节。

## 目录

1. [执行顺序锁](#1-执行顺序锁)
2. [阶段质量门槛](#2-阶段质量门槛)
3. [自动化质量门禁](#3-自动化质量门禁)
4. [违规处理机制](#4-违规处理机制)
5. [TDD 循环时间监控](#5-tdd-循环时间监控)
6. [与 Gating 系统集成](#6-与-gating-系统集成)

---

## 1. 执行顺序锁

TDD 循环必须严格按照以下顺序执行，**禁止跳跃或回退到前面的阶段**（除非当前阶段失败需要修正）：

```
┌─────────────────────────────────────────────────────────┐
│                    TDD 循环流程                          │
│                                                         │
│  ┌──────┐    ┌──────┐    ┌────────┐    ┌────────┐      │
│  │ RED  │ → │GREEN │ → │REFACTOR│ → │ COMMIT │      │
│  └──────┘    └──────┘    └────────┘    └────────┘      │
│     ↑                                                │
│     └──── 只有当前阶段失败时才允许回到上一阶段 ────────┘ │
│                                                         │
│  ❌ 禁止: GREEN → RED (不能回头重写测试)                │
│  ❌ 禁止: REFACTOR → GREEN (重构中改了行为必须回退)       │
│  ❌ 禁止: 跳过 RED 直接写实现                            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 阶段质量门槛

未达到不允许进入下一阶段：

| 阶段 | 质量门槛 | 自动化检查命令 | 不通过处理 | 违规等级 |
|------|----------|---------------|-----------|----------|
| **RED** | 测试必须 FAIL | `npm test -- --grep "{test_name}"` | 如果 PASS → 删除实现代码，重新写测试 | 🔴 ERROR |
| **GREEN** | 只允许修改/新增**实现代码** | `git diff --name-only` 检查修改的文件 | 如果修改了 `.test.ts` / `.spec.ts` 文件 → 回退，重新进入 GREEN | 🔴 ERROR |
| **REFACTOR** | 所有测试仍需 PASS | `npm test` (全量) | 如果任何测试 FAIL → 回退重构操作，重新进入 REFACTOR | 🔴 ERROR |
| **COMMIT** | 必须同时包含测试+实现代码 | `git diff --cached --name-only` 检查暂存区 | 如果缺少测试文件或实现文件 → 补充后再提交 | 🟡 WARNING |

---

## 3. 自动化质量门禁

每个 TDD 循环完成后、提交代码前，**必须**依次运行以下检查：

```bash
# 1. TypeScript 类型检查 (0 errors)
npx tsc --noEmit
# ✅ 通过标准: exit code = 0, 无 type errors

# 2. ESLint 代码风格检查 (0 errors, warnings 可接受)
npx eslint src/ --ext .ts,.tsx
# ✅ 通过标准: 0 errors (warnings 数量记录但允许)

# 3. 单元测试全量通过 + 覆盖率报告
npx vitest run --coverage
# ✅ 通过标准:
#   - 所有测试 PASS
#   - 全局覆盖率 ≥ 80% (可配置: .vitest.config.ts coverage.thresholds)
#   - 新增代码覆盖率 ≥ 90% (更严格)
```

**质量门槛配置示例** (`vitest.config.ts`):

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

---

## 4. 违规处理机制

当检测到 TDD 流程违规时，按以下级别处理：

| 违规次数 | 处理方式 | 记录位置 | 后果 |
|----------|----------|----------|------|
| **第 1 次** | ⚠️ 警告 + 要求立即修正 | 终端输出警告信息 | 修正后可继续 |
| **第 2 次** | 🔴 暂停当前任务 | 写入 `.harness/audit/tdd-violations.log` | 必须回到 brainstorming 重新确认理解 |
| **第 3 次** | 🔴🔴 记录严重违规 | 更新 violation log + 通知项目负责人 | 触发代码审查强制介入 |

**违规日志格式**:

```markdown
## TDD Violation Log

| Timestamp | Violation Type | Stage | Description | File | Severity |
|-----------|-----------------|-------|-------------|------|----------|
| 2026-05-08T14:30:00Z | SKIPPED_RED_PHASE | - | 直接编写实现代码，跳过 RED 阶段 | src/services/user.ts | ERROR |
| 2026-05-08T14:35:00Z | MODIFIED_TEST_IN_GREEN | GREEN | 在 GREEN 阶段修改了测试文件 | src/__tests__/user.test.ts | ERROR |
```

---

## 5. TDD 循环时间监控

| 指标 | 目标值 | 监控方式 | 超标处理 |
|------|--------|----------|----------|
| 单个循环时长 | ≤ 5 分钟 | 手动计时 / IDE 插件 | 超过 10 分钟 → 拆分任务 |
| RED→GREEN 时间 | ≤ 2 分钟 | 同上 | 超过 5 分钟 → 测试可能过于复杂 |
| 日均完成循环数 | ≥ 8 个 | Git commit 统计 | 过少 → 可能存在跳过 TDD |

---

## 6. 与 Gating 系统集成

TDD 强制执行机制与 Build Gate (`check-build-gate.sh`) 联动：

```bash
# check-build-gate.sh 中新增的 TDD 检查项:
echo "--- Check: TDD Compliance ---"
if [ -f ".harness/audit/tdd-violations.log" ]; then
  VIOLATION_COUNT=$(grep -c "ERROR" .harness/audit/tdd-violations.log || echo "0")
  if [ "$VIOLATION_COUNT" -gt 0 ]; then
    echo "❌ TDD Violations found: $VIOLATION_COUNT error(s)"
    echo "   See: .harness/audit/tdd-violations.log"
    exit 1
  else
    echo "✅ TDD Compliance: No errors (warnings may exist)"
  fi
else
  echo "✅ TDD Compliance: No violations logged"
fi
```
