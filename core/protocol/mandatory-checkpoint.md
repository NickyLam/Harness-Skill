# Mandatory Checkpoint Protocol (MCP) — 强制检查点协议

> **版本**: 2.0.0
> **目的**: 确保 AI 在关键决策节点必须暂停并等待用户确认
> **强制级别**: 🔴 CRITICAL — 不可跳过，不可自动通过
> **面向对象**: AI Agent（执行者）+ 用户（审批者）
> **v2.0 变更**: 新增 TYPE_D (DEEP_INTERVIEW_CHECKPOINT) 用于深度需求分析阶段

## 协议原则

1. **PAUSE_BEFORE_PROCEED** — 到达检查点必须调用 AskUserQuestion，禁止自动继续
2. **NO_AUTO_FILL** — 禁止 AI 替用户做决定或猜测答案
3. **STATE_PERSISTENCE** — 检查点状态必须持久化到文件，支持断点续传
4. **AUDIT_TRAIL** — 所有确认记录写入审计日志
5. **🎯 MEANINGFUL_OPTIONS** — AskUserQuestion 的每个选项必须有独立实际意义，禁止"选A但要去B里填"的假选项设计

### 选项 UX 规范（所有检查点强制遵循）

| 规则 | ✅ 正确 | ❌ 禁止 |
|------|---------|---------|
| 选项独立性 | 每个选项可直接选择，有明确含义 | 选了还要去 Other 填内容 |
| description 质量 | 说明选择该选项的含义/后果 | "在Other中详细描述" |
| multiSelect 一致性 | 文本说可多选 → `true`，单选 → `false` | 文本暗示多选但设为 false |
| 采访类选项 | 3-4 个引导分类 + 自定义 | 只有 1 个假选项 |

## 检查点类型定义

### TYPE_A: INTERVIEW_CHECKPOINT（采访类）

**适用场景**: 需求澄清、信息收集、用户意图确认

**强制行为**:
- MUST: 调用 `AskUserQuestion` tool，使用明确的问题文本
- MUST: 阻塞式等待用户回复（不继续下一步）
- FORBIDDEN: 提供默认选项并自动选择
- FORBIDDEN: AI 自行编造或猜测用户回答
- FORBIDDEN: 合并多个问题一次询问（除非用户明确要求）

**输出格式**:
```
📍 CHECKPOINT [{checkpoint_id}] — {stage_name}
阶段: {pipeline_stage}
类型: TYPE_A (INTERVIEW_CHECKPOINT)
状态: ⏳ AWAITING_USER_INPUT
```

### TYPE_B: APPROVAL_CHECKPOINT（审批类）

**适用场景**: 方案确认、设计文档审批、技术决策

**强制行为**:
- MUST: 展示完整内容摘要 + 明确的 Y/N 选项
- MUST: 提供至少 2 个选项（批准/修改/拒绝）
- MUST: 记录用户选择及时间戳到审计日志
- FORBIDDEN: 自动标记为"已审批"
- FORBIDDEN: 省略内容直接询问

**输出格式**:
```
✋ APPROVAL REQUIRED — {item_name}
阶段: {pipeline_stage}
类型: TYPE_B (APPROVAL_CHECKPOINT)
内容摘要:
{content_summary}
选项: [批准] [修改] [拒绝]
```

### TYPE_C: EXECUTION_CHECKPOINT（执行类）

**适用场景**: 任务拆分确认、Wave 计划确认、子代理启动前

**强制行为**:
- MUST: 展示计划摘要表格或可视化
- MUST: 提供"确认执行/修改/取消"选项
- MUST: 用户明确确认后才启动执行引擎
- FORBIDDEN: 无确认直接启动并行任务
- FORBIDDEN: 使用缓存确认（超过 10 分钟需重新确认）

**输出格式**:
```
⚠️ EXECUTION GATE — {plan_name}
阶段: {pipeline_stage}
类型: TYPE_C (EXECUTION_CHECKPOINT)
即将执行:
{execution_plan_summary}
选项: [确认执行] [调整计划] [取消]
```

### TYPE_D: DEEP_INTERVIEW_CHECKPOINT（深度采访类）🆕 v2.0

**适用场景**: 深度需求分析阶段的结构化采访（业务规则、用户旅程、边缘 case）

**强制行为**:
- MUST: 调用 `AskUserQuestion` tool，使用明确的问题文本
- MUST: 阻塞式等待用户回复（不继续下一步）
- MUST: 持久化到 `.harness/checkpoints/deep-{module}-q{n}.md`
- FORBIDDEN: 提供默认选项并自动选择
- FORBIDDEN: AI 自行编造或猜测用户回答
- FORBIDDEN: 合并多个问题一次询问

**输出格式**:
```
📍 CHECKPOINT [{checkpoint_id}] — {stage_name}
阶段: Deep Requirements / {module_name}
类型: TYPE_D (DEEP_INTERVIEW_CHECKPOINT)
状态: ⏳ AWAITING_USER_INPUT
📊 进度: [{progress_bar}] {percentage}% ({completed}/{total})
```

**命名规范**:
| 模块 | 前缀 | ID 范围 | 示例 |
|------|------|----------|------|
| 业务规则 | `DEEP-BR-Q` | 1-5 | `DEEP-BR-Q1`, `DEEP-BR-Q5` |
| 用户旅程 | `DEEP-UJ-Q` | 1-4 | `DEEP-UJ-Q1`, `DEEP-UJ-Q4` |
| 边缘 case | `DEEP-EC-Q` | 1-3 | `DEEP-EC-Q1`, `DEEP-EC-Q3` |
| 产出审批 | `DEEP-APPROVAL-{TYPE}` | RULES/JOURNEY/EDGE/GHERKIN | `DEEP-APPROVAL-RULES` |

## 执行模板

### 模板 A: 采访流程（TYPE_A）

```markdown
REPEAT for each question in question_list:

  STEP 1: 输出检查点标记
  输出 "📍 CHECKPOINT [{id}] — {description}"

  STEP 2: 调用 AskUserQuestion tool（强制）

  ⚠️ **UX 规范**: 选项必须有实际意义！禁止假选项（见下方规范）

  ```javascript
  // ✅ 正确：每个选项都有独立意义，用户可直接选择
  questions: [{
    header: "{short_label}",
    question: "{完整问题文本}",
    options: [
      { label: "🌐 选项A（有意义的分类）", description: "选择此选项的直接后果说明" },
      { label: "🏢 选项B（有意义的分类）", description: "选择此选项的直接后果说明" },
      { label: "✏️ 自定义描述", description: "以上都不符合，我想详细说明" }
    ],
    multiSelect: false
  }]

  // ❌ 禁止：假选项——选了还要去 Other 里填
  // options: [{ label: "输入回答", description: "在Other中详细描述" }]
  ```

  **选项设计原则**:
  - 采访类问题：提供 3-4 个**有意义的引导分类选项** + "✏️ 自定义"
  - `multiSelect` 设置必须与问题文本一致（说可多选就 true，单选就 false）
  - 每个选项的 `description` 必须解释**选择该选项的含义/后果**
  - 禁止出现"选 A 但要去 B 里填写内容"的诡异设计

  STEP 3: 阻塞等待（MUST NOT continue until response received）
  - ❌ FORBIDDEN: "根据常见情况，我认为用户可能需要..."
  - ❌ FORBIDDEN: "假设用户会选择方案A..."
  - ❌ FORBIDDEN: 跳到下一个问题或下一步骤
  - ✅ REQUIRED: 等待 tool 返回 result 对象

  STEP 4: 持久化记录
  写入 .harness/checkpoints/{checkpoint_id}.md:
    # Checkpoint {id}
    - Type: INTERVIEW
    - Question: {问题原文}
    - User Response: {用户原话}
    - Timestamp: {ISO_8601_time}
    - Status: ✅ COMPLETED

  STEP 5: 仅当 Step 3 完成后 → 进入下一项

END REPEAT
```

### 模板 B: 审批流程（TYPE_B）

```markdown
STEP 1: 输出审批请求标记
输出 "✋ APPROVAL REQUIRED — {item_name}"

STEP 2: 展示完整内容
- 数据模型变更 → 显示完整的 interface/type 定义
- UI 变更 → 显示组件结构图或布局描述
- 逻辑变更 → 显示流程或伪代码
- 测试策略 → 显示测试用例列表

STEP 3: 调用 AskUserQuestion tool
questions: [{
  header: "{item_type}",
  question: "请审批上述 {item_type} 设计",
  options: [
    { label: "✅ 批准", description: "同意此设计，进入下一环节" },
    { label: "✏️ 需要修改", description: "我有修改意见" },
    { label: "❌ 拒绝", description: "不同意此设计，回到上一阶段" }
  ],
  multiSelect: false
}]

STEP 4: 根据响应行动
IF "批准":
  → 记录审批: .harness/checkpoints/{id}.md
  → 更新审计日志
  → 继续下一项

IF "需要修改":
  → 调用新的 AskUserQuestion 收集修改意见
  → 应用修改
  → 重新展示 → 回到 STEP 2

IF "拒绝":
  → 记录拒绝原因
  → 回到上一阶段重新设计
```

### 模板 C: 执行确认流程（TYPE_C）

```markdown
STEP 1: 输出执行门禁标记
输出 "⚠️ EXECUTION GATE — {plan_name}"

STEP 2: 生成可视化计划
- 任务拆分: 表格形式（Task ID | 描述 | 估计时间 | 依赖）
- Wave 编排: ASCII 图示或层级结构
- 风险提示: 已知风险和缓解措施

STEP 3: 调用 AskUserQuestion tool
questions: [{
  header: "Execute",
  question: "确认按此计划执行吗？",
  options: [
    { label: "🚀 确认执行", description: "立即启动执行引擎" },
    { label: "✏️ 调整计划", description: "我想修改任务或Wave安排" },
    { label: "⏸️ 暂停", description: "保存进度，稍后继续" },
    { label: "❌ 取消", description: "取消本次执行" }
  ],
  multiSelect: false
}]

STEP 4: 行动分支
IF "确认执行":
  → 写入 .harness/checkpoints/{id}-approved.md（含时间戳）
  → 启动执行引擎或子代理

IF "调整计划":
  → 进入交互式编辑模式
  → 修改完成后重新展示 → 回到 STEP 2

IF "暂停":
  → 保存当前状态到 .harness/progress/current.md
  → 输出恢复指令

IF "取消":
  → 清理临时文件
  → 输出取消摘要
  → 退出
```

## 违规检测与纠正机制

### 自动检测规则

当出现以下情况时触发违规警告：

| 规则ID | 检测条件 | 严重级别 |
|--------|----------|----------|
| V-001 | 连续跳过 3 个检查点未调用 AskUserQuestion | 🔴 Critical |
| V-002 | checkpoint 文件缺失但声称已完成 | 🔴 Critical |
| V-003 | 审批记录时间戳早于采访时间（逻辑错误） | 🟡 Warning |
| V-004 | 使用缓存确认超过 10 分钟 | 🟡 Warning |
| V-005 | 检查点状态为 PENDING 但继续执行后续步骤 | 🔴 Critical |

### 纠正措施分级

**Level 1 — Warning（警告）**
- 触发条件: V-003, V-004
- 行动: 
  - 输出警告消息，说明违规原因
  - 要求 AI 补做或刷新检查点
  - 记录到审计日志
  - 允许继续但需在下一步前完成纠正

**Level 2 — Block（阻断）**
- 触发条件: V-001, V-005
- 行动:
  - 立即停止当前阶段所有操作
  - 输出阻断消息：`🛑 EXECUTION BLOCKED — 违反 Mandatory Checkpoint Protocol`
  - 强制回到最近的未完成检查点
  - 要求完成该检查点才能继续
  - 记录严重违规到审计日志

**Level 3 — Rollback（回滚）**
- 触发条件: V-002 或连续 Level 2 违规
- 行动:
  - 输出回滚消息：`⏪ ROLLBACK TRIGGERED — 协议严重违反`
  - 回滚到上一个已确认的稳定阶段
  - 清除所有未确认阶段的产出文件
  - 要求从回滚点重新开始
  - 生成违规报告

## 文件结构规范

### 目录结构

```
.harness/
├── checkpoints/
│   ├── spec-interview-Q1.md           # 采访记录
│   ├── spec-interview-Q2.md
│   ├── spec-interview-Q3.md
│   ├── spec-interview-Q4.md
│   ├── spec-interview-Q5.md
│   ├── spec-solution-comparison.md    # 方案选择
│   ├── approval-data-model.md         # 数据模型审批
│   ├── approval-state-management.md   # 状态管理审批
│   ├── approval-ui-components.md      # UI 审批
│   ├── approval-test-strategy.md      # 测试策略审批
│   ├── plan-task-breakdown.md         # 任务拆分确认
│   └── plan-wave-schedule.md          # Wave 编排确认
├── audit/
    └── checkpoint-log.md              # 完整审计日志
```

### Checkpoint 文件模板

```markdown
# Checkpoint {ID}

## 元信息
- ID: {checkpoint_id}
- 类型: {TYPE_A|TYPE_B|TYPE_C}
- 阶段: {pipeline_stage}
- 创建时间: {ISO_timestamp}
- 完成时间: {ISO_timestamp}
- 状态: ✅ COMPLETED / ⏳ PENDING / ❌ BLOCKED

## 内容
{checkpoint_specific_content}

## 用户输入
- 问题: {question_asked}
- 回复: {user_response_raw}
- 选择: {option_selected}

## 审计
- 操作者: AI_Agent / User
- 时间戳: {timestamp}
- 下一步: {next_action}
```

### 审计日志模板

```markdown
# Checkpoint Audit Log

生成时间: {timestamp}

## 检查点历史

| 时间 | Checkpoint ID | 类型 | 状态 | 耗时 | 备注 |
|------|---------------|------|------|------|------|
| ...  | ...           | ...  | ...  | ...  | ...  |

## 违规记录（如有）

| 时间 | 规则ID | 描述 | 纠正措施 | 状态 |
|------|--------|------|----------|------|
| ...  | ...    | ...  | ...      | ...  |

## 当前状态
- 最后完成的检查点: {last_completed_checkpoint}
- 待执行的检查点: {next_pending_checkpoint}
- 整体进度: {percentage}%
```

## 全局检查点注册表

以下是在 Harness Pipeline 中所有必须实施的检查点：

### Spec 阶段 (/harness spec)

| ID | 名称 | 类型 | 说明 | 强制性 |
|----|------|------|------|--------|
| SPEC-Q1 | 目标用户采访 | TYPE_A | 采访第1问 | 🔴 Mandatory |
| SPEC-Q2 | 核心场景采访 | TYPE_A | 采访第2问 | 🔴 Mandatory |
| SPEC-Q3 | 影响范围采访 | TYPE_A | 采访第3问 | 🔴 Mandatory |
| SPEC-Q4 | 技术风险采访 | TYPE_A | 采访第4问 | 🔴 Mandatory |
| SPEC-Q5 | 完成标准采访 | TYPE_A | 采访第5问 | 🔴 Mandatory |
| SPEC-SOLUTION | 方案对比选择 | TYPE_B | 2-3种方案供选择 | 🔴 Mandatory |
| APPROVAL-DATA-MODEL | 数据模型审批 | TYPE_B | 数据结构设计确认 | 🔴 Mandatory |
| APPROVAL-STATE-MGMT | 状态管理审批 | TYPE_B | 状态逻辑设计确认 | 🔴 Mandatory |
| APPROVAL-UI | UI设计审批 | TYPE_B | 组件和布局确认 | 🔴 Mandatory |
| APPROVAL-TEST | 测试策略审批 | TYPE_B | 测试计划确认 | 🔴 Mandatory |

### Deep Requirements 阶段 (/harness deep-spec) 🆕 v2.0

> **触发条件**: brainstorming Phase 3 完成后，用户在 DEPTH-GATE 选择"进入深度模式"

| ID | 名称 | 类型 | 说明 | 强制性 |
|----|------|------|------|--------|
| **DEPTH-GATE** | **深度模式选择** | **TYPE_C** | **决定是否进入深度需求分析** | 🔴 Mandatory (Gate) |
| DEEP-BR-Q1 | 业务目标采访 | TYPE_D | 深度分析第1问 | 🔴 Mandatory |
| DEEP-BR-Q2 | 规则复杂度采访 | TYPE_D | 深度分析第2问 | 🔴 Mandatory |
| DEEP-BR-Q3 | 触发条件采访 | TYPE_D | 深度分析第3问 | 🔴 Mandatory |
| DEEP-BR-Q4 | 例外情况采访 | TYPE_D | 深度分析第4问 | 🔴 Mandatory |
| DEEP-BR-Q5 | 规则稳定性采访 | TYPE_D | 深度分析第5问 | 🔴 Mandatory |
| DEEP-UJ-Q1 | 用户角色采访 | TYPE_D | 深度分析第6问 | 🔴 Mandatory |
| DEEP-UJ-Q2 | 旅程路径采访 | TYPE_D | 深度分析第7问 | 🔴 Mandatory |
| DEEP-UJ-Q3 | 痛点机会采访 | TYPE_D | 深度分析第8问 | 🔴 Mandatory |
| DEEP-UJ-Q4 | 成功指标采访 | TYPE_D | 深度分析第9问 | 🔴 Mandatory |
| DEEP-EC-Q1 | 异常场景采访 | TYPE_D | 深度分析第10问 | 🔴 Mandatory |
| DEEP-EC-Q2 | 并发处理采访 | TYPE_D | 深度分析第11问 | 🔴 Mandatory |
| DEEP-EC-Q3 | 数据边界采访 | TYPE_D | 深度分析第12问 | 🔴 Mandatory |
| DEEP-APPROVAL-RULES | 业务规则表审批 | TYPE_B (变体) | 深度产出审批1 | 🔴 Mandatory |
| DEEP-APPROVAL-JOURNEY | 用户旅程图审批 | TYPE_B (变体) | 深度产出审批2 | 🔴 Mandatory |
| DEEP-APPROVAL-EDGE | 边缘Case清单审批 | TYPE_B (变体) | 深度产出审批3 | 🔴 Mandatory |
| DEEP-APPROVAL-GHERKIN | Gherkin规格审批 | TYPE_B (变体) | 深度产出审批4 | 🔴 Mandatory |

### Plan 阶段 (/harness plan)

| ID | 名称 | 类型 | 说明 | 强制性 |
|----|------|------|------|--------|
| PLAN-TASKS | 任务拆分确认 | TYPE_C | 微任务列表确认 | 🔴 Mandatory |
| PLAN-WAVE | Wave编排确认 | TYPE_C | 执行计划确认 | 🔴 Mandatory |

### Build 阶段 (/harness build)

| ID | 名称 | 类型 | 说明 | 强制性 |
|----|------|------|------|--------|
| BUILD-PRE-EXEC | Wave预执行门禁 | TYPE_C | 子代理启动前最终确认 | 🔴 Mandatory (≥3 tasks) |
| BUILD-WAVE-N | 第N Wave完成确认 | TYPE_C | Wave结果审查 | ⚠️ Recommended |

### 异常情况处理

### 用户离线/超时

如果用户长时间未响应（>30分钟）：
1. 保存当前状态到 `.harness/progress/current.md`
2. 输出暂停消息，说明已保存的进度
3. 提供恢复指令：`/harness resume --from {last_checkpoint}`
4. 不自动继续或猜测用户意图

### 用户输入模糊

如果用户回答模糊（如"都可以"、"你看着办"）：
1. FORBIDDEN: 自动选择一个选项
2. REQUIRED: 提供 2-3 个具体选项让用户选择
3. EXAMPLE: "我理解您比较灵活，为了确保方向正确，请问您更倾向 A（简单快速）还是 B（功能完整）？"

### 用户要求跳过检查点

如果用户明确说"跳过这个"、"不用问了"：
1. RECORD: 记录用户的跳过请求
2. CONFIRM: 二次确认："您确定要跳过 {checkpoint_name} 吗？这可能导致需求偏差"
3. IF 确认跳过:
   - 记录到审计日志，标注"USER_OVERRIDE"
   - 标记检查点为 "SKIPPED (USER_REQUEST)"
   - 继续
4. IF 取消跳过:
   - 正常执行检查点

## 与其他组件集成

### Orchestrator 集成

Orchestrator 在路由命令时必须：
- 检查目标阶段的 MCP 要求
- 确认前置检查点全部完成
- 将 MCP 协议传递给对应 Role

### Gating 集成

新增 Gate 类型：
- **Checkpoint Gate**: 检查所有必需检查点是否已完成
- 作为现有 7-Gate 的前置条件

### Memory 集成

检查点数据写入 Memory 系统：
- 采访结果 → 项目知识库
- 审批记录 → 决策历史
- 审计日志 → 经验教训

## 版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| 1.0.0 | 2026-04-30 | 初始版本，定义MCP协议核心（TYPE_A/B/C） | Harness Team |
| 2.0.0 | 2026-05-05 | 新增 TYPE_D (DEEP_INTERVIEW_CHECKPOINT) + DEPTH-GATE + 17个深度检查点注册 | Harness Team |
