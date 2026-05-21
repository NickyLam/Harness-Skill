# GSD Wave Execution Engine — 波次执行引擎（MCP 增强版）

> **层级**: L3 执行引擎
> **设计模式**: Wave-based Parallel Execution（波次并行执行）
> **核心原则**: 子代理隔离 + 波次编排 + 🔴 用户确认优先 + 持久化优先
> **协议版本**: MCP v2.1

## 引擎概述

Wave Engine 是 Harness 的核心执行引擎，负责将 Architect 产出的计划文件转化为实际的并行/串行执行流。

**🔴 关键变更 (v2.0)**: 引入 Pre-Execution Safety Gate，所有子代理启动前必须经过用户确认。

**🆕 v2.1 变更**: 新增超时约束 + 文件心跳 + 协作等级声明（借鉴 Claude Code KAIROS 模式）

## 核心概念

### Wave（波次）
一组可以并行执行的微任务集合。Wave 内部的任务无相互依赖。

### Sub-agent（子代理）
每个微任务由一个独立的子代理执行，拥有独立上下文窗口。子代理之间通过文件系统传递信息。

### Coordinator（协调者）
主代理的角色，负责：
- 解析计划文件
- ✅ 执行 Pre-Execution Safety Gate（新增）
- 按 Wave 顺序调度子代理
- 汇总每个 Wave 的结果
- 执行 Wave 验证点
- 处理错误和回滚

---

## ⚠️ PRE-EXECUTION SAFETY GATE（v2.0 新增 - 核心机制）

> **这是防止"无确认直接跑完Wave"的最后一道防线**
>
> **设计哲学**: 宁可多问一次，不可擅自启动。用户的确认是不可协商的。

### Gate 概述

```
┌─────────────────────────────────────────────────────┐
│           PRE-EXECUTION SAFETY GATE                │
│                                                     │
│  目的: 在启动 ANY 子代理之前进行最终安全检查         │
│  触发: 每次 Wave Executor 启动时                     │
│  强制: 🔴 MANDATORY (不可跳过, 不可自动通过)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 触发条件（满足任一即触发完整门禁流程）

| 条件 | 说明 | 强制级别 |
|------|------|----------|
| 首次运行 Wave Executor | 第一次启动，无历史确认 | 🔴 ALWAYS |
| 总任务数 ≥ 3 | 大型执行，影响面广 | 🔴 ALWAYS |
| Wave 数 ≥ 2 | 多 Wave 执行，需要最终确认 | 🔴 ALWAYS |
| 距离上次确认超过 10 分钟 | 确认可能过期 | 🔴 ALWAYS |
| 计划有变更 | 任何修改后都需要重新确认 | 🔴 ALWAYS |
| 前一个 Wave 有失败 | 失败后的恢复需要确认 | 🔴 ALWAYS |

**轻量级执行例外**（可简化确认流程）：
- 总任务数 = 1 且为单 Wave → 可使用缓存确认（但仍需记录）
- 即使是轻量级，也**必须输出启动通知**

### 门禁流程详解

```
PRE_EXECUTION_SAFETY_GATE:
  │
  ├─ ═══ PHASE 1: 文件验证 ═══
  │
  │  1.1 CHECK: `.harness/checkpoints/plan-wave-schedule.md` 存在?
  │    ├── NO → 🛑 FATAL ERROR
  │    │   "缺少 Wave 计划确认文件"
  │    │   "请先运行 /harness plan 并完成 PLAN-WAVE 确认"
  │    │   ACTION: 终止执行，不启动任何子代理
  │    │
  │    └── YES → CONTINUE
  │
  │  1.2 CHECK: 确认时间戳有效性
  │    ├── > 30 分钟 → ⚠️ WARNING
  │    │   "确认已过期 ({age} 分钟)"
  │    │   ACTION: 要求重新确认（触发完整 PLAN-WAVE 流程）
  │    │
  │    └── ≤ 30 分钟 → CONTINUE
  │
  ├─ ═══ PHASE 2: 计划加载与展示 ═══
  │
  │  2.1 READ: plan-wave-schedule.md
  │  2.2 PARSE: 提取 Wave 结构和任务列表
  │  2.3 GENERATE: 执行摘要
  │
  │  ┌──────────────────────────────────────────┐
  │  │ 🚀 Wave Executor 启动准备                 │
  │  │                                          │
  │  │ 计划文件: {plan_file}                    │
  │  │ 确认时间: {confirmation_time}             │
  │  │                                          │
  │  │ Wave 数: {wave_count}                    │
  │  │ 总任务数: {total_tasks}                   │
  │  │                                          │
  │  │ 即将执行:                                │
  │  │ ┌─ Wave 1: {task_count} 个并行任务 ─┐   │
  │  │ │  {task_list}                        │   │
  │  │ └────────────────────────────────────┘   │
  │  │                                          │
  │  │ 预计耗时: {estimated_time}               │
  │  └──────────────────────────────────────────┘
  │
  ├─ ═══ PHASE 3: 用户确认 ═══
  │
  │  3.1 EVALUATE: 是否需要完整确认？
  │    ├── 需要（满足触发条件）→ 3.2 完整确认流程
  │    └── 不需要（轻量级）→ 3.3 简化确认流程
  │
  │  ── ── ── ── ── ── ── ── ── ── ── ── ──
  │
  │  3.2 完整确认流程（AskUserQuestion 强制调用）
  │
  │  AskUserQuestion({
  │    questions: [{
  │      header: "Launch",
  │      question: "最后确认：即将启动 {total_tasks} 个任务的并行执行。" +
  │                "Wave {first_wave} 将首先执行，包含 {first_wave_tasks} 个任务。" +
  │                "\n\n现在开始吗？",
  │      options: [
  │        {
  │          label: "🚀 立即启动",
  │          description: "确认无误，启动 Wave Engine 开始执行"
  │        },
  │        {
  │          label: "📋 查看详细计划",
  │          description: "想再次检查完整的任务列表和 Wave 安排"
  │        },
  │        {
  │          label: "✏️ 调整后再启动",
  │          description: "我想修改某些任务或参数"
  │        },
  │        {
  │          label: "❌ 取消执行",
  │          description: "暂时不执行，保存进度"
  │        }
  │      ],
  │      multiSelect: false
  │    }]
  │  })
  │
  │  3.3 简化确认流程（轻量级执行）
  │
  │  输出通知（仍需等待用户 ACK）:
  │  ```
  │  ⚡ 轻量级执行启动
  │  
  │  任务: {single_task_description}
  │  类型: 单任务 / 单 Wave
  │  
  │  准备启动... (如有异议请立即反馈)
  │  ```
  │
  │  短暂等待（3秒）或轻量 AskUserQuestion:
  │  AskUserQuestion({
  │    questions: [{
  │      header: "Quick",
  │      question: "即将执行: {task}。OK？",
  │      options: [
  │        { label: "👍 OK", description: "启动执行" },
  │        { label: "⏸️ 等等", description: "我有疑问" }
  │      ],
  │      multiSelect: false
  │    }]
  │  })
  │
  ├─ ═══ PHASE 4: 确认处理 ═══
  │
  │  4.1 RECEIVE: 等待用户响应（🛑 BLOCK）
  │
  │  4.2 PROCESS:
  │    ├── "立即启动"/"OK":
  │    │   → 写入 `.harness/checkpoints/exec-pre-run-{timestamp}.md`
  │    │   → 设置 gate_status = PASSED
  │    │   → 进入正常 Wave 执行流程
  │    │
  │    ├── "查看详细计划":
  │    │   → 展示完整计划文件内容
  │    │   → 回到 Phase 3 重新确认
  │    │
  │    ├── "调整后再启动":
  │    │   → 进入编辑模式
  │    │   → 收集修改意见
  │    │   → 更新计划文件
  │    │   → 回到 Phase 1 重新验证
  │    │
  │    ├── "取消执行"/"等等":
  │    │   → 保存当前状态到 progress 文件
  │    │   → 输出恢复指令
  │    │   → 终止（不启动任何子代理）
  │    │
  │    └── TIMEOUT (如果支持):
  │        → 自动转为"取消执行"模式
  │        → 保存进度
  │
  └─ ═══ PHASE 5: Gate 通过后 ═══

       ✅ PRE-EXECUTION_GATE_PASSED
       
       现在可以安全地启动子代理...
```

### Gate 失败时的行为

```markdown
## 🛑 PRE-EXECUTION_gate_FAILED

**时间**: {timestamp}
**原因**: {failure_reason}

**可能的失败原因**:

1. **缺少确认文件**
   - plan-wave-schedule.md 不存在
   - 解决: 运行 `/harness plan` 完成确认流程

2. **确认已过期**
   - 上次确认超过 30 分钟
   - 解决: 重新执行 PLAN-WAVE 确认

3. **用户拒绝**
   - 用户在确认时选择"取消"
   - 解决: 尊重用户选择，保存进度

4. **用户未响应**
   - 等待超时
   - 解决: 保存状态，允许稍后恢复

**纠正措施**:
- 不启动任何子代理
- 不修改任何文件
- 保留现有进度
- 输出明确的错误信息和解决建议
```

---

## 执行流程（更新版）

```
Coordinator 启动
    │
    ▼
读取 .harness/plans/{feature}-plan.md
    │
    ▼
╔══ PRE-EXECUTION SAFETY GATE ═══╗
║                                 ║
║  Phase 1: 文件验证            ║
║  Phase 2: 计划展示            ║
║  Phase 3: 用户确认 (BLOCK)    ║  ← 🔴 关键阻塞点
║  Phase 4: 响应处理            ║
║                                 ║
║  结果: PASSED / FAILED         ║
╚═══════════════════════════════╝
    │
    ▼ (ONLY IF PASSED)
解析 Wave 结构 → 构建 Wave DAG
    │
    ▼
┌─ Wave 1 ─────────────────────────────┐
│  🔓 Gate 已通过，允许启动              │
│                                       │
│  并行启动 N 个 Implementer 子代理     │
│  │         │         │               │
│  ▼         ▼         ▼               │
│ SubAgent1  SubAgent2  SubAgent3       │
│  │         │         │               │
│  ▼         ▼         ▼               │
│ 完成      完成      完成             │
│                                     │
│  ← 汇总结果 → Wave 1 验证点          │
│  ├─ 全部通过 → git commit (原子)     │
│  └─ 有失败 → 错误处理(需确认)        │ ← 🔴 新增: 失败也需确认
└──────────────────────────────────────┘
    │
    ▼ (Wave 1 PASS)
    
    ⚠️ Wave 2+ 启动前的轻量确认 (可选但推荐)
    │
    ▼
┌─ Wave 2 ─────────────────────────────┐
│  (依赖 Wave 1 的任务)                 │
│  ... 同样流程 ...                     │
└──────────────────────────────────────┘
    │
    ▼
... (继续后续 Wave)
    │
    ▼
全部 Wave 完成 → 输出执行摘要
```

---

## 子代理启动规范

**⚠️ 只有在通过 Pre-Execution Safety Gate 后才能执行以下操作**

每个子代理通过 Task tool 启动:

```
Task tool 调用参数:
  subagent_type: "search"  # 或通用子代理
  description: "Implement T{N}.{M}: {任务描述}"
  prompt: |
    你是 Implementer 子代理。
    
    ## 任务
    {任务描述}
    
    ## TDD 流程（强制）
    1. 🔴 RED: 先写失败的测试
    2. 🟢 GREEN: 写最少代码让测试通过
    3. 🔵 REFACTOR: 在测试保护下优化
    
    ## 约束
    - 输出文件: {输出路径}
    - 依赖文件: {依赖路径}
    - 只修改任务范围内的文件
    
    ## 完成标准
    - 输出文件已创建且内容正确
    - 测试全部通过
    - 未修改范围外文件
```

- 子代理拥有独立上下文窗口（不与主代理共享）
- 子代理完成后将关键产出物写入指定文件
- 主代理汇总各子代理结果，不重复执行子代理的任务

---

## Wave 验证点（增强版）

每个 Wave 完成后必须执行验证点检查：

```markdown
## Wave {N} 验证报告

**时间**: YYYY-MM-DD HH:MM
**状态**: ✅ ALL PASS / ⚠️ PARTIAL / ❌ FAILED

### 任务结果
| Task ID | 任务 | 状态 | 产出 | 耗时 |
|---------|------|------|------|------|
| T{N}.1  | ...  | ✅   | path | X min|
| T{N}.2  | ...  | ❌   | -    | -    |

### 验证项
- [ ] 所有子代理报告成功
- [ ] 所有产出文件存在
- [ ] 相关测试通过
- [ ] 变更行数 ≤100 行/Wave

### 决策（🔴 需要用户确认）

IF 全部通过:
  → 自动继续下一 Wave（轻量通知用户）
  
IF 有失败:
  → 🔰 **MANDATORY**: 调用 AskUserQuestion 等待决策
  
  AskUserQuestion({
    questions: [{
      header: "Wave {N}",
      question: "Wave {N} 有 {fail_count}/{total} 个任务失败。如何处理？",
      options: [
        { label: "修复后继续", description: "重试失败的任务" },
        { label: "跳过继续", description: "标记问题，继续下一 Wave" },
        { label: "停止执行", description: "暂停所有执行" },
        { label: "回滚", description: "回滚此 Wave 的变更" }
      ],
      multiSelect: false
    }]
  })
  
  → 🛑 BLOCK until user response
  → 根据用户选择行动
```

---

## 错误处理策略（MCP 增强）

| 错误类型 | 检测点 | 处理方式 | 用户确认 | 重试次数 |
|---------|--------|---------|----------|---------|
| Pre-Execution Gate 失败 | Gate 本身 | 终止执行，不启动子代理 | 🔴 **必须** | - |
| 子代理执行失败 | Wave 汇总 | 分析错误日志，重试同任务 | ⚠️ 失败率>30%时**必须** | 最多 2 次 |
| 测试失败 | 子代理内部 | **触发 Fix Loop**（见 fix-loop.md） | Fix Loop 失败后**必须** | 最多 3 轮修复 |
| Wave 内部分失败 | Wave 验证点 | 仅重试失败的任务 | 🔰 Wave 级**必须** | 最多 2 次 |
| Wave 整体失败 | Wave 验证点 | 暂停，等待用户决策 | 🔴 **必须** | - |
| 上下文不足 | 上下文监控 | 将状态写入文件，**询问用户**切换策略 | 🔴 **必须** | - |
| Fix Loop 超时 | 15 分钟 | 触发 rollback-protocol | 🔴 **必须** | - |
| Fix Loop 回归 | 新增测试失败 | 立即 git revert 修复 | 自动（紧急） | - |

### 关键改进：所有错误处理都需要用户参与决策

**之前的行为（有问题的）**:
- Wave 失败 → 自动重试 → 可能越改越乱
- 上下文不足 → 自动切换 → 可能丢失信息

**现在的行为（MCP 增强）**:
- Wave 失败 → 展示失败详情 → **等待用户指示**
- 上下文不足 → **询问用户**如何处理

---

## Fix Loop 集成（测试失败自动修复循环）

当子代理报告测试失败时，自动触发 Fix Loop：

```
测试失败 → Fix Loop 启动
    │
    ▼
1. COLLECT: 收集错误日志 + 失败测试名
2. DIAGNOSE: 调用 systematic-debugging 定位根因
3. FIX: 实施修复（TDD: RED → GREEN）
4. VERIFY: 自动重测（先跑失败测试 → 再跑全量测试）
    │
    ├── 通过 → 退出 Fix Loop → 继续 Wave 流程
    └── 仍失败 → iteration_count++ → 回到 Step 1
         │
         └── 达到终止条件(max 3轮/15min/回归) 
              → 🔰 **暂停，请求用户决策**
              
              AskUserQuestion({
                questions: [{
                  header: "FixLoop",
                  question: "Fix Loop 已达到终止条件，问题仍未解决。下一步？",
                  options: [
                    { label: "人工介入", description: "暂停让我看看代码" },
                    { label: "回滚", description: "回滚此任务的变更" },
                    { label: "标记已知问题", description: "继续执行，后续处理" }
                  ]
                }]
              })
```

详细定义见 [fix-loop.md](./fix-loop.md)。

### 子代理完成标准（强制验证步骤）

每个子代理在报告完成前，必须按以下顺序执行验证：

```
1. 实施修复/功能
2. 运行相关测试：npm run test -- {test_file}
3. 如果通过 → 运行全量测试：npm run test
4. 如果全量通过 → 运行类型检查：npx tsc --noEmit
5. 如果类型检查通过 → 运行 Lint：npm run lint
6. 如果全部通过 → 报告成功
7. 如果任何步骤失败 → 记录到 fix-attempts.md → 进入 Fix Loop
```

**禁止跳过验证直接报告完成。**

---

## 上下文监控规则（增强版）

Coordinator 必须持续监控上下文使用量:

- **60%**: 发出警告，准备精简输出
- **80%**: 🔰 **强制调用 AskUserQuestion 确认切换策略**（不再是自动切换）

```javascript
// 上下文 80% 时的强制确认
AskUserQuestion({
  questions: [{
    header: "Context",
    question: "上下文使用已达 80%，建议切换新会话以避免质量退化。\n当前 Wave {current_wave} 已完成（{completed_waves}/{total_waves}）。",
    options: [
      { label: "立即切换", description: "保存状态并启动新会话继续" },
      { label: "完成当前 Wave", description: "继续当前 Wave，完成后自动切换" },
      { label: "手动保存", description: "我自己保存后手动切换" }
    ],
    multiSelect: false
  }]
})
```

- **90%**: 停止启动新子代理，完成当前 Wave 后**强制切换**

---

## 持久化要求

以下信息必须在每个 Wave 完成后持久化:
1. 当前 Wave 编号和状态
2. 每个任务的完成情况和产出路径
3. Git commit hash（每个 Wave 一次原子提交）
4. 遇到的问题和解决方案
5. 下一个 Wave 的前置条件确认
6. **Pre-Execution Gate 状态和确认记录（新增）**

---

## 🛑 禁止事项（Wave Executor 专用）

| # | 禁止行为 | 后果 | 场景示例 |
|---|----------|------|----------|
| WE-1 | 未通过 Pre-Execution Gate 就启动子代理 | **Level-3 Rollback** | 直接启动 Task tool |
| WE-2 | 使用不存在的或过期的确认文件 | **Level-2 Block** | 用旧确认启动新执行 |
| WE-3 | Wave 失败后不询问就自动重试 >1 次 | **Warning** | 默认改为必须确认 |
| WE-4 | 上下文 80% 时不确认就切换 | **Level-2 Block** | 自动切换导致状态丢失 |
| WE-5 | 跳过 Wave 验证点直接进入下一 Wave | **Level-2 Block** | 省略验证节省时间 |

---

---

## 🆕 超时约束 + 文件心跳（v2.1 新增）

> **灵感来源**: Claude Code KAIROS 模式的 tick 驱动心跳
> **跨平台适配**: 由于 Skill 无法主动定时检查子代理状态，改为"超时约束 + 文件心跳 + 事后检测"

### 设计约束

Harness Skill 寄生在宿主平台运行，**无法主动监控子代理**。因此采用被动策略：

| 能力 | Claude Code | Harness Skill | 替代方案 |
|------|------------|---------------|---------|
| 主动定时检查 | ✅ tick 驱动 | ❌ 无定时器 | 超时约束 + 事后检测 |
| 中途查询子代理 | ✅ 进程级监控 | ❌ 只能等待返回 | 文件心跳记录 |
| 强制终止子代理 | ✅ 进程信号 | ⚠️ 依赖平台 max_turns | 声明超时上限 |

### 超时约束

每个子代理启动时声明超时上限：

```
子代理启动参数:
  max_turns: {根据任务复杂度设定}
  timeout_hint: "{预估耗时}分钟"
```

| 任务类型 | 推荐 max_turns | 推荐超时 |
|---------|---------------|---------|
| 单文件实现 | 8 | 3 分钟 |
| 多文件实现 | 12 | 5 分钟 |
| 调试修复 | 10 | 5 分钟 |
| 测试编写 | 8 | 3 分钟 |

### 文件心跳

子代理在每个关键步骤写入心跳文件：

```
心跳文件: .harness/progress/heartbeat-{task-id}.md

格式:
| 步骤 | 时间 | 状态 | 备注 |
|------|------|------|------|
| 1. 读取依赖 | HH:MM | ✅ | 读取 plan.md |
| 2. 编写测试 | HH:MM | ✅ | test_xxx.ts |
| 3. 实现功能 | HH:MM | 🔄 | 进行中... |
```

### 事后检测

主代理在子代理返回后检查心跳文件：

```
子代理返回
    │
    ├── 正常返回 + 心跳完整 → 正常汇总
    ├── 正常返回 + 心跳缺失步骤 → ⚠️ 标记"可能跳过验证"
    ├── 超时返回（max_turns 耗尽）→ ❌ 标记"超时终止"
    └── 未返回（平台异常）→ ❌ 标记"异常终止"，记录到 fix-attempts.md
```

---

## 🆕 协作等级声明（v2.1 新增）

> **灵感来源**: Claude Code KAIROS 模式的焦点感知
> **跨平台适配**: 由于 Skill 无法检测用户是否在场，改为"用户声明 + 行为推断"

### 协作等级定义

| 等级 | 名称 | 确认策略 | 触发条件 |
|------|------|---------|---------|
| L3 | 高协作 | 每个关键决策点都确认，Wave 间暂停等待用户 ACK | 用户显式声明或连续 2 次要求查看详情 |
| L2 | 标准协作 | 关键决策确认，非关键自动执行，Wave 间轻量通知 | **默认等级** |
| L1 | 低协作 | 仅 P0 级问题确认，其余自动执行，精简输出 | 用户声明自主模式或连续 3 次选择自动继续 |
| L0 | 全自主 | 零确认，全部自动执行，所有决策记录到日志 | 用户显式声明全自主模式（需确认） |

### 确认策略矩阵

| 决策点 | L3 高协作 | L2 标准协作 | L1 低协作 | L0 全自主 |
|--------|----------|-----------|----------|----------|
| Pre-Execution Gate | 完整确认 | 完整确认 | 轻量通知 | 自动通过+记录 |
| Wave 间继续 | 确认 | 轻量通知 | 自动继续 | 自动继续 |
| Wave 失败 | 确认 | 确认 | 确认（仅 P0） | 自动回滚+记录 |
| Fix Loop 超时 | 确认 | 确认 | 确认 | 自动回滚 |
| 上下文 80% | 确认 | 确认 | 轻量通知 | 自动压缩 |
| 非 P0 Gate 失败 | 确认 | 轻量通知 | 自动重试 | 自动重试 |

### 等级切换

**升级（更协作）**：
- 用户说"让我看看"/"先等等" → 升级到 L3
- 用户连续 2 次要求查看详情 → 升级到 L3

**降级（更自主）**：
- 用户说"自主模式"/"你决定" → 降级到 L1
- 用户连续 3 次选择"自动继续" → 建议降级到 L1
- 用户说"全自主"/"通宵跑" → 降级到 L0（需确认）

**L0 全自主模式确认**：

```
AskUserQuestion({
  questions: [{
    header: "Autonomous",
    question: "即将进入全自主模式：所有决策将自动执行，零确认。" +
              "所有决策会记录到日志供事后审查。确认？",
    options: [
      { label: "确认进入", description: "全自主模式，零确认" },
      { label: "保持 L1", description: "仅 P0 确认，其余自动" },
      { label: "取消", description: "保持当前等级" }
    ],
    multiSelect: false
  }]
})
```

---

## 版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| 1.0.0 | 2026-04-28 | 初始版本 | Harness Team |
| 2.0.0 | 2026-04-30 | 添加 Pre-Execution Safety Gate，强化用户确认机制，错误处理需要用户参与 | Fix |
| 2.1.0 | 2026-05-21 | 新增超时约束 + 文件心跳 + 协作等级声明（借鉴 Claude Code KAIROS 模式） | Loop Optimization |
