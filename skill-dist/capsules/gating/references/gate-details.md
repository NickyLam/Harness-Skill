# Gate 高级功能与暂停协议详细参考

> 本文件是 `gating/SKILL.md` 的补充参考，包含高级配置、Webhook 通知、性能监控和暂停协议的完整细节。

## 目录

1. [门禁条件表达式](#1-门禁条件表达式)
2. [门禁 Webhook 通知](#2-门禁-webhook-通知)
3. [门禁性能监控](#3-门禁性能监控)
4. [Gate 暂停确认模板](#4-gate-暂停确认模板)
5. [Gate 暂停违规检测](#5-gate-暂停违规检测)
6. [确认模式对比](#6-确认模式对比)

---

## 1. 门禁条件表达式

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

---

## 2. 门禁 Webhook 通知

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

---

## 3. 门禁性能监控

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

---

## 4. Gate 暂停确认模板

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ {Gate名称} Gate 已通过

## 当前阶段产出物
{列出产出物清单，如：}
- `.harness/specs/需求分析规格说明书.md` ✅
- `.harness/specs/系统设计说明书.md` ✅
- `tests/` 单元测试覆盖率 85% ✅

## Gate 检查结果
{列出检查项，如：}
- ✅ 文档完整性检查通过
- ✅ 验收标准定义清晰
- ✅ 无循环依赖
- ✅ 测试全部通过

## 下一阶段预览
{简要说明下一阶段将做什么，如：}
- Plan 阶段: 拆解任务、制定执行计划、定义 Wave 依赖关系

请确认是否继续:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. Gate 暂停违规检测

**如果 Agent 在 Gate 通过后没有暂停等待确认，用户应立即投诉：**

```
投诉模板:
"⚠️ Gate 执行违规: {Gate名称}完成后未等待确认就直接进入下一阶段。
期望行为: Gate PASS后暂停，等待我确认'继续'才进入下一阶段。
请立即回退到 {Gate名称} 阶段，重新执行暂停确认流程。"
```

---

## 6. 确认模式对比

| 模式 | 行为 | 适用场景 |
|------|------|---------|
| **强确认模式（默认）** | 每个 Gate 必须暂停，等待用户明确回复 | 关键项目、正式交付 |
| **弱确认模式** | Gate 完成后通知用户，5分钟无回复自动继续 | 日常开发、快速迭代 |
| **静默模式** | 仅 Ship Gate 暂停确认，其他自动通过 | 验证性/实验性项目 |

**用户可通过 `/gating mode <强确认|弱确认|静默>` 切换模式。**
