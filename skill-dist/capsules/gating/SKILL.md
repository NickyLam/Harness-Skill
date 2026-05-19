---
id: gating
name: "Gating — 7-Gate 质量门禁系统（完整执行引擎）"
description: "When the user mentions quality gate, pipeline check, stage verification, pre-merge check, or needs to validate code quality before proceeding, ALWAYS use this skill. Provides 7-Gate defense (spec/plan/build/test/review/simplify/ship) with L1/L2/L3 strictness levels."
stage: cross-cutting
roles: [reviewer]
pattern: gate-keeping
mandatory: true
depends: []
version: "4.0"
compatibility:
  tools: [Bash, SendMessage, TaskList, TaskCreate, TaskUpdate, Read, Write]
  dependencies: ["bash", "git", "node >= 18"]
---

# Gating — 7-Gate 质量门禁系统（精简版）

> **层级**：门控层 (Gating) - 贯穿所有阶段
> **触发**：每个阶段转换时自动检查 + 手动 `/gating check` 命令
> **核心价值**：失败大声疾呼，成功保持安静；门禁不通过 = 不允许进入下一阶段

## 核心原则

1. **自动化优先**：所有检查尽可能通过脚本自动执行，减少人为判断
2. **快速反馈**：门禁检查应在 <30秒内完成，不阻塞开发流程
3. **渐进严格**：早期阶段宽松（L1-fast），后期阶段严格（L3-strict）
4. **可追溯性**：每次门禁检查都有完整日志和截图证据
5. **优雅降级**：非关键检查失败不应阻塞核心流程，但必须记录警告

## 7 大质量门禁概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Harness Pipeline                          │
│                                                             │
│  [Spec] → [Plan] → [Build] → [Test] → [Review] →         │
│           ↓         ↓        ↓        ↓                    │
│      Gate 1     Gate 2    Gate 3   Gate 4                  │
│                                   ↓                        │
│                            [Simplify] → [Ship]            │
│                                 ↓         ↓                │
│                              Gate 5     Gate 6             │
│                                           ↓                │
│                                        Gate 7              │
│                                           ↓                │
│                                    ✅ Release              │
└─────────────────────────────────────────────────────────────┘
```

## 门禁定义与执行

每个 Gate 都有独立的检查脚本，位于 `scripts/` 目录：

| Gate | 阶段转换 | 检查脚本 | 核心检查项 |
|------|---------|---------|-----------|
| Gate 1 | Spec → Plan | `check-spec-gate.sh` | PRD.md 存在、验收标准 ≥1、PO 审批 |
| Gate 2 | Plan → Build | `check-plan-gate.sh` | PLAN.md 存在、任务数 3-10、无循环依赖 |
| Gate 3 | Build → Test | `check-build-gate.sh` | TypeScript 编译、构建成功、ESLint 通过 |
| Gate 4 | Test → Review | `check-test-gate.sh` | 全部测试通过、覆盖率 ≥80%、无 skip |
| Gate 5 | Review → Simplify | `check-review-gate.sh` | 无 P0 问题、P1 ≤3、安全审查通过 |
| Gate 6 | Simplify → Ship | `check-simplify-gate.sh` | 函数 ≤50 行、文件 ≤500 行、圈复杂度 ≤10 |
| Gate 7 | Ship → Release | `check-ship-gate.sh` | Gate 1-6 全过、Git 干净、版本已更新 |

### 运行单个 Gate

```bash
bash scripts/check-<gate-name>.sh [feature-name]
```

### 一键运行所有门禁

```bash
bash scripts/run-all-gates.sh
```

> **注意**：所有脚本的完整实现已提取到 `scripts/` 目录。SKILL.md 中不再包含完整脚本代码，以保持文件精简。

## 门禁结果解读指南

### 结果矩阵

| Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 5 | Gate 6 | Gate 7 | 决策 |
|-------|-------|-------|-------|-------|-------|-------|------|
| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **可以发布** 🚀 |
| ❌ | - | - | - | - | - | - | **回到 Spec** 📝 |
| ✅ | ❌ | - | - | - | - | - | **回到 Plan** 📋 |
| ✅ | ✅ | ❌ | - | - | - | - | **回到 Build** 🔨 |
| ✅ | ✅ | ✅ | ❌ | - | - | - | **回到 Test** 🧪 |
| ✅ | ✅ | ✅ | ✅ | ❌ | - | - | **回到 Review** 👁️ |
| ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | - | **回到 Simplify** ✨ |
| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | **修复后重试** 🔄 |

### 常见失败模式及根因

#### 模式 A：连续多个 Gate 失败
**症状**：Gate 3、4、5 同时失败
**根因**：基础代码质量问题
**建议**：不要逐个修复，回到 `/build` 全面重构

#### 模式 B：偶发性失败
**症状**：上次通过，这次同一 Gate 失败
**根因**：测试不稳定（flaky test）或环境差异
**建议**：重试一次，如果仍失败再修复

#### 模式 C：警告堆积
**症状**：大量 ⚠️ WARNING 但无 ❌ FAIL
**根因**：技术债务累积
**建议**：记录到 backlog，安排专项清理

## 严格度级别配置

### L1-Fast（开发阶段）

```yaml
strictness: L1-fast
gates:
  enabled: [spec, plan, build, test]
  skipped: [review, simplify, ship]
tolerances:
  max_p1_issues: 5
  test_coverage_threshold: 60
  max_function_lines: 80
```

### L2-Standard（默认，PR 合并前）

```yaml
strictness: L2-standard
gates:
  enabled: [spec, plan, build, test, review, simplify, ship]
tolerances:
  max_p1_issues: 3
  test_coverage_threshold: 80
  max_function_lines: 50
```

### L3-Strict（发布前）

```yaml
strictness: L3-strict
gates:
  enabled: [spec, plan, build, test, review, simplify, ship]
tolerances:
  max_p1_issues: 1
  max_p0_issues: 0
  test_coverage_threshold: 90
  max_function_lines: 30
  require_security_audit: true
  require_performance_test: true
```

## 失败处理（8个场景）

| 失败场景 | 检测方式 | 自动恢复 | 人工介入 | 恢复命令 |
|---------|---------|---------|---------|----------|
| **Gate 脚本不存在** | 文件存在检查 | 跳过该 Gate | 否（安装缺失的脚本） | 从模板生成或从 skill-dist 复制 |
| **严格度配置未定义** | config.yaml 检查 | 使用 L2-standard 默认值 | 否（选择合适的级别） | 在 config.yaml 中添加 strictness 字段 |
| **部分非必需 Gate 失败** | 严重度判断 | 标记为 WARNING | 否（后续迭代修复） | 记录到 `.harness/metrics/gate-warnings.md` |
| **全部门禁失败** | 汇总检查 | 阻止进入下一阶段 | 是（决定优先修复哪个） | 运行 `/gating diagnose` 分析根因 |
| **环境不一致（本地 vs CI）** | 环境变量对比 | 使用 Docker 统一环境 | 否（配置 CI 环境） | 参考 ci-cd-pipeline Skill 配置 |
| **权限不足执行检查** | 错误码 EACCES | 提示提升权限 | 否（chmod 或 sudo） | `chmod +x .harness/scripts/*.sh` |
| **超时（单个 Gate >30s）** | 时间监控 | 终止并标记 TIMEOUT | 是（优化检查逻辑） | 分析慢检查，拆分或缓存 |
| **误报（实际没问题）** | 人工复核 | 允许强制通过 | 是（需 2 人审批） | `/gating override --gate <name> --reason "..."` |

## 产出物（5个关键交付物）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| 门禁检查报告 | `.harness/metrics/<runId>-gate-report.md` | Markdown | 每个 Gate 的通过/失败详情 | **必需** |
| 检查日志 | `.harness/metrics/<runId>.jsonl` | JSONL | 结构化的检查过程数据 | **必需** |
| 失败证据 | `.harness/metrics/<runId>-failures/` | 截图+日志 | 失败 Gate 的详细证据 | **必需**（失败时） |
| 严格度配置 | `core/pipeline.yaml` | YAML | 当前生效的严格度和阈值 | **必需** |
| 门禁趋势报告 | `.harness/metrics/gate-trends.md` | Markdown | 历史通过率趋势（可选） | 推荐 |

## 与其他 Skill 的协作关系

```
gating（贯穿所有阶段）
    │
    ├─→ spec（Gate 1 触发条件）
    │   └─→ deep-requirements / brainstorming（Gate 1 失败时回退）
    │
    ├─→ writing-plans（Gate 2 触发条件）
    │   └─→ gsd（Gate 2 失败时回退）
    │
    ├─→ tdd / subagent-driven-dev（Gate 3, 4 触发条件）
    │   └─→ systematic-debugging（Gate 3, 4 失败时回退）
    │
    ├─→ requesting-code-review / staff-review（Gate 5 触发条件）
    │   └─→ code-simplification（Gate 6 触发条件）
    │
    └─→ ci-cd-pipeline / containerization / ship-pipeline（Gate 7 触发条件）
        └─→ qa / e2e-qa / verification-before-completion（Gate 7 前置条件）
```

## 高级功能

### 1. 门禁条件表达式（高级用户）

支持组合条件：

```yaml
# .harness/config.yaml
gate_conditions:
  # 只在主分支启用全部 Gate
  branch_specific:
    main: "all"
    develop: "spec+plan+build+test"
    feature/*: "build+test" # 功能分支只检查构建和测试

  # 基于文件变更的智能 Gate
  file_based:
    "**/*.ts": ["build", "test"]  # TS 文件变更触发 build+test gate
    "**/*.md": ["spec"]          # MD 文件变更只触发 spec gate
    "package.json": ["all"]      # package.json 变更触发全部 gate
```

### 2. 门禁 Webhook 通知

```bash
# 在 Gate 检查完成后发送通知
notify_gate_result() {
  local status=$1
  local report_url=$2

  if [ "$status" = "failed" ]; then
    curl -X POST "$WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      -d "{\"text\": \"❌ Gate check FAILED\\nReport: $report_url\"}"
  else
    curl -X POST "$WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      -d "{\"text\": \"✅ All gates PASSED\"}"
  fi
}
```

### 3. 门禁性能监控

```typescript
// 追踪 Gate 检查耗时，识别瓶颈
interface GateTiming {
  gateName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

function analyzeGatePerformance(timings: GateTiming[]) {
  const avgDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
  const slowestGate = timings.sort((a, b) => b.duration - a.duration)[0];

  return {
    averageTime: `${avgDuration.toFixed(1)}s`,
    slowestGate: slowestGate.gateName,
    slowestTime: `${slowestGate.duration}s`,
    recommendation: slowestGate.duration > 20
      ? `Consider optimizing '${slowestGate.gateName}' (took ${slowestGate.duration}s)`
      : 'All gates within acceptable time range',
  };
}
```

## 下一步行动

门禁检查完成后：

1. **全部通过？** → 进入 `/ship` 发布流程
2. **部分失败？** → 根据失败矩阵回到对应阶段修复
3. **需要调整严格度？** → 编辑 `core/pipeline.yaml`
4. **想查看历史？** → 查看 `.harness/metrics/gate-trends.md`

## Agent 模式 Gate 执行协议（v4.0 新增）

在 Expert Team 模式下，Gate 检查由 Team Lead Agent 执行，作为 Stage 转换的必要条件。

### Team Lead Gate 执行流程

```
角色 Agent 完成任务 → Team Lead 收到完成汇报
    ↓
Team Lead 执行 Gate 检查:
    1. Bash: bash core/skills/cross-cutting/gating/scripts/check-{stage}-gate.sh
    2. 解析 Gate 结果
    ↓
Gate PASS → SendMessage 通知当前 Agent 关闭 → spawn 下一 Stage Agent
Gate FAIL → SendMessage 向当前 Agent 发送修复指令:
    SendMessage({
      type: "message",
      recipient: "harness-implementer",
      content: "## Gate 失败修复指令\nGate: build_gate\n失败原因: {原因}\n修复要求: {具体修复指令}\n约束: TDD 流程，只修改失败项",
      summary: "Build gate fix required"
    })
```

### Gate 检查在 Agent 中的嵌入方式

| 模式 | Gate 执行者 | 执行方式 | 结果传递 |
|------|-----------|---------|---------|
| Expert Team | Team Lead Agent | Bash 运行脚本 | SendMessage 通知 |
| Single Agent | 当前 Agent 自行执行 | Bash 运行脚本 | 文件记录 |

### Wave 级 Gate（并行执行时的中间检查）

在 Build 阶段的 Wave 并行执行时：
- 每个 Wave 完成后，Team Lead 可选择性执行轻量 Gate（仅 build_gate 的子集）
- 全部 Wave 完成后，执行完整的 build_gate
- Wave 级 Gate 不通过 → 只修复失败 Wave 的 Agent 产出

### Gate 失败自动修复协议

```
Gate 失败
    ↓
Team Lead 判断失败类型:
    ├── 编译错误 → spawn harness-implementer (fix 指令)
    ├── 测试失败 → spawn harness-implementer (systematic-debugging + fix)
    ├── 覆盖率不足 → spawn harness-tester (补充测试)
    ├── 审查问题 → spawn harness-implementer (fix P0/P1)
    └── 无法自动修复 → 通知用户决策
    ↓
修复 Agent 完成 → 重新执行 Gate
    ↓
Gate PASS（最多重试 2 轮）
```
