# Fix Loop — 自动修复迭代循环

> **灵感来源**：AHE Evolution Loop 的终止条件模式下沉到开发层面
> **触发**：Test Gate FAIL / Wave 验证点 FAIL / 任何测试失败
> **核心原则**：测试失败后自动进入修复循环，修复后自动重测，直到通过或达到终止条件

## 概述

Fix Loop 是开发层面的自动化迭代循环。当测试失败时，系统自动进入"收集失败→定位根因→实施修复→自动重测"的闭环，无需人工介入即可完成多轮修复。

## 循环流程

```
测试失败
    │
    ▼
┌─ Fix Loop ──────────────────────────────────────────┐
│                                                      │
│  1. COLLECT — 收集失败信息                            │
│     · 错误日志 + 失败测试名 + 失败断言                │
│     · 读取 fix-attempts.md（之前的修复尝试）          │
│                                                      │
│  2. DIAGNOSE — 定位根因                              │
│     · 调用 systematic-debugging 四阶段流程            │
│     · 形成根因假设                                   │
│     · 检查 fix-attempts.md 避免重复假设               │
│                                                      │
│  3. FIX — 实施修复                                   │
│     · 遵循 TDD: 先写失败测试(RED) → 修复(GREEN)      │
│     · 只修根因，不做多余修改                          │
│     · 记录本轮尝试到 fix-attempts.md                  │
│                                                      │
│  4. VERIFY — 自动重测                                │
│     · 运行之前失败的测试：npm run test -- {test_file} │
│     · 如果通过 → 运行全量测试：npm run test           │
│     · 如果全量通过 → 退出 Fix Loop ✅                 │
│     · 如果仍失败 → iteration_count++ → 回到 Step 1   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 终止条件

| 条件 | 值 | 说明 |
|------|-----|------|
| max_fix_attempts | 3 | 同一问题最多修复 3 轮 |
| no_improvement | 连续 2 轮 | 连续 2 轮修复后测试结果未改善 |
| time_limit | 15 分钟 | 单个 Fix Loop 总耗时上限 |
| regression | 新增失败 | 修复引入新的测试失败 → 立即回退 |

## 终止后动作

| 终止原因 | 动作 |
|---------|------|
| max_fix_attempts 达到 | 暂停，升级到用户决策，展示 fix-attempts.md |
| no_improvement | 回退到上一个通过状态（git revert），升级到用户决策 |
| time_limit 超时 | 触发 rollback-protocol，回退当前增量 |
| regression | 立即 git revert 修复，记录到 fix-attempts.md |

## 修复尝试记录模板

每次进入 Fix Loop 时，在 `.harness/progress/fix-attempts.md` 中记录：

```markdown
## 修复尝试记录

**问题**: {失败测试/错误描述}
**首次发现时间**: YYYY-MM-DD HH:MM
**触发阶段**: /harness build / /harness test / Wave N

| 轮次 | 尝试方案 | 根因假设 | 结果 | 耗时 |
|------|---------|---------|------|------|
| 1 | {方案} | {假设} | 仍失败: {原因} | X min |
| 2 | {方案} | {假设} | 通过 ✅ | X min |

**最终根因**: {确认的根因}
**有效方案**: {第 N 轮方案}
**经验沉淀**: {提炼出的规则} [source:trace:{id}]
```

## 与其他模块的协作

| 模块 | 协作方式 |
|------|---------|
| TDD | Fix Loop 内部遵循 TDD 红绿循环 |
| systematic-debugging | Fix Loop Step 2 调用四阶段调试流程 |
| gating | Test Gate 失败触发 Fix Loop |
| wave-executor | Wave 验证点失败触发 Fix Loop |
| memory-management | 修复经验存入三层记忆体系 |
| evolution-loop | Fix Loop 的终止条件模式来自 Evolution Loop |
| rollback-protocol | 超时/回归触发回滚协议 |

## 关键约束

1. **只修根因**：每轮修复只针对确认的根因，不做"试试看"式修改
2. **避免重复**：读取 fix-attempts.md 确保不重复尝试已失败的方案
3. **自动重测**：修复完成后必须自动运行测试，不能跳过验证
4. **记录一切**：每轮尝试都记录到 fix-attempts.md，供后续分析
5. **及时止损**：达到终止条件立即停止，不盲目继续
