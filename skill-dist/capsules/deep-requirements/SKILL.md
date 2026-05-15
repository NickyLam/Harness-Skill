---
id: deep-requirements
name: "Deep Requirements — 企业级深度需求分析"
stage: spec
roles: [product-owner]
pattern: deep-interview
mandatory: true
when: "project_type == 'enterprise' || user_confirms_depth == true || process_doc_required == true"
depends: [brainstorming]
version: "3.1"
description: "When the user mentions deep requirements, enterprise requirements, or needs comprehensive requirement analysis with 12 structured questions, ALWAYS use this skill. Business rules, user journey, and edge case analysis. MANDATORY for enterprise projects and when generating formal requirement specifications."
---

# Deep Requirements Analysis — 深度需求分析 Capsule

> **层级**: L2 方法论能力库
> **模式**: Deep Interview (深度采访) + Mandatory Checkpoint Protocol v2.0
> **阶段**: spec (深度需求分析)
> **角色**: Product Owner (增强)
> **协议版本**: MCP v2.0.0
> **触发条件**: brainstorming Phase 3 完成后，用户在 DEPTH-GATE 选择"进入深度模式"

## 核心原则

1. **结构化深度挖掘** — 12 个问题覆盖业务规则、用户旅程、边缘 case 三大维度
2. **一次一问** — 继承 brainstorming 的 Inversion 模式，每个问题必须等待回复
3. **模块化分析** — 三个独立模块（business-rules, user-journey, edge-cases）可单独或组合使用
4. **三位一体产出** — 文档（REQUIREMENTS.md）+ 可视化（Mermaid）+ 可执行规格（Gherkin）
5. **🔴 强制阻塞** — 所有检查点受 Mandatory Checkpoint Protocol v2.0 保护

---

## ⚠️ 协议前置条件

在执行本 Capsule 的任何步骤之前：

- [ ] 已读取 `core/protocol/mandatory-checkpoint.md` v2.0+ 并理解 TYPE_D 检查点规则
- [ ] 已确认 brainstorming Phase 1-3 全部完成（Q1-Q5 + 方案对比 + 分段审批）
- [ ] 确认 `.harness/checkpoints/` 目录存在
- [ ] 确认 `AskUserQuestion` tool 可用且正常工作
- [ ] 设置内部状态: `deep_mode = ENABLED`
- [ ] 初始化深度审计日志: `.harness/audit/deep-checkpoint-log.md`

**如果以上任一条件不满足 → 立即停止并报告错误**

---

## 执行规则（不可跳过）

> 🔴 **CRITICAL**: 以下流程受 Mandatory Checkpoint Protocol v2.0 强制保护

### 违反任何阻塞要求将触发：
- **Level-2 Block**: 暂停执行，强制回到当前检查点
- **Level-3 Rollback**: 回滚到 DEPTH-GATE（严重违规时）

### 禁止事项：
- ❌ 在收到 AskUserQuestion 返回值之前执行任何下一步操作
- ❌ 替用户编造、猜测或假设回答
- ❌ 使用"根据常见情况"、"通常来说"、"我认为"等推测性语言
- ❌ 合并多个问题一次询问（除非用户明确要求）
- ❌ 跳过任何检查点或使用缓存确认
- ❌ 在未完成所有深度问题时生成产出物

---

## 架构概览

```
deep-requirements capsule
│
├── 主协调器 (本文件)
│   ├── 初始化与前置检查
│   ├── 调度 MODULE A: business-rules (5 问)
│   ├── 调度 MODULE B: user-journey (4 问)
│   ├── 调度 MODULE C: edge-cases (3 问)
│   ├── 协调 PHASE 5: 深度产出审批 (4 个审批)
│   └── 触发 PHASE 6: 产出生成
│
├── modules/
│   ├── business-rules/     (业务规则深度拆解)
│   │   └── SKILL.md        (BR-Q1 ~ BR-Q5)
│   │
│   ├── user-journey/       (用户旅程分析)
│   │   └── SKILL.md        (UJ-Q1 ~ UJ-Q4)
│   │
│   └── edge-cases/         (边缘 Case 分析)
│       └── SKILL.md        (EC-Q1 ~ EC-Q3)
│
└── generators/
    ├── requirements-doc.md  (REQUIREMENTS.md 生成器)
    ├── gherkin-spec.md      (Gherkin .feature 生成器)
    └── mermaid-charts.md    (Mermaid 图表生成器)
```

---

## 完整执行流程

### PHASE 4: 深度需求分析（12 问）

#### 4.0 初始化

```
🚀 Deep Requirements Analysis 启动
模式: 企业级深度 (Enterprise Deep)
协议版本: MCP v2.0.0 (TYPE_D)
即将进入深度需求采访阶段...
预计问题数: 12
预计耗时: 25-40 分钟
```

**Step 0.1**: 验证前置条件（见上方"协议前置条件"）

**Step 0.2**: 输出进度指示器
```
📊 深度分析进度: [░░░░░░░░░░] 0% (0/12)
```

---

#### 4.1 MODULE A: 业务规则深度拆解（BR-Q1 ~ BR-Q5）

> **加载**: `modules/business-rules/SKILL.md`
> **检查点类型**: TYPE_D (DEEP_INTERVIEW_CHECKPOINT)
> **持久化路径**: `.harness/checkpoints/deep-br-q{n}.md`

**执行顺序**:
1. 📍 CHECKPOINT [DEEP-BR-Q1] — 业务目标与价值 → BLOCK → PERSIST
2. 📍 CHECKPOINT [DEEP-BR-Q2] — 规则优先级与复杂度 → BLOCK → PERSIST
3. 📍 CHECKPOINT [DEEP-BR-Q3] — 触发条件与依赖关系 → BLOCK → PERSIST
4. 📍 CHECKPOINT [DEEP-BR-Q4] — 例外与边界情况 → BLOCK → PERSIST
5. 📍 CHECKPOINT [DEEP-BR-Q5] — 规则稳定性与变更频率 → BLOCK → PERSIST

**完成后更新进度**:
```
📊 深度分析进度: [██████░░░░░░] 42% (5/12) ✅ 业务规则完成
```

**输出**: 业务规则表（Markdown 格式）→ 传递给 generators

---

#### 4.2 MODULE B: 用户旅程分析（UJ-Q1 ~ UJ-Q4）

> **加载**: `modules/user-journey/SKILL.md`
> **检查点类型**: TYPE_D (DEEP_INTERVIEW_CHECKPOINT)
> **持久化路径**: `.harness/checkpoints/deep-uj-q{n}.md`

**执行顺序**:
1. 📍 CHECKPOINT [DEEP-UJ-Q1] — 用户角色识别 → BLOCK → PERSIST
2. 📍 CHECKPOINT [DEEP-UJ-Q2] — 核心旅程路径 → BLOCK → PERSIST
3. 📍 CHECKPOINT [DEEP-UJ-Q3] — 痛点与机会 → BLOCK → PERSIST
4. 📍 CHECKPOINT [DEEP-UJ-Q4] — 成功指标 → BLOCK → PERSIST

**完成后更新进度**:
```
📊 深度分析进度: [██████████░░░] 75% (9/12) ✅ 用户旅程完成
```

**输出**: 用户角色画像表 + Mermaid 旅程图 + 状态机图 → 传递给 generators

---

#### 4.3 MODULE C: 边缘 Case 分析（EC-Q1 ~ EC-Q3）

> **加载**: `modules/edge-cases/SKILL.md`
> **检查点类型**: TYPE_D (DEEP_INTERVIEW_CHECKPOINT)
> **持久化路径**: `.harness/checkpoints/deep-ec-q{n}.md`

**执行顺序**:
1. 📍 CHECKPOINT [DEEP-EC-Q1] — 异常场景识别 → BLOCK → PERSIST
2. 📍 CHECKPOINT [DEEP-EC-Q2] — 并发与竞争条件 → BLOCK → PERSIST
3. 📍 CHECKPOINT [DEEP-EC-Q3] — 数据边界与限制 → BLOCK → PERSIST

**完成后更新进度**:
```
📊 深度分析进度: [█████████████] 100% (12/12) ✅ 边缘 Case 完成
```

**输出**: 异常场景清单 + 数据边界限制表 → 传递给 generators

---

### PHASE 5: 深度产出审批（4 个审批）

> **前置条件**: PHASE 4 全部完成（12/12 检查点 ✅ COMPLETED）
> 
> **如果任一模块未完成 → 🔴 ERROR: 必须先完成所有深度采访**

#### 5.1 业务规则表审批

```
✋ DEEP APPROVAL REQUIRED — 业务规则表
```

1. 展示完整的业务规则表（来自 MODULE A 输出）
2. 调用 AskUserQuestion（TYPE_B 变体）
3. 🛑 BLOCK — 等待审批
4. 记录到 `.harness/checkpoints/deep-approval-rules.md`

#### 5.2 用户旅程图审批

```
✋ DEEP APPROVAL REQUIRED — 用户旅程图
```

1. 展示用户角色画像 + Mermaid 旅程图 + 状态机图（来自 MODULE B 输出）
2. 调用 AskUserQuestion（TYPE_B 变体）
3. 🛑 BLOCK — 等待审批
4. 记录到 `.harness/checkpoints/deep-approval-journey.md`

#### 5.3 边缘 Case 清单审批

```
✋ DEEP APPROVAL REQUIRED — 边缘 Case 清单
```

1. 展示异常场景清单 + 数据边界限制表（来自 MODULE C 输出）
2. 调用 AskUserQuestion（TYPE_B 变体）
3. 🛑 BLOCK — 等待审批
4. 记录到 `.harness/checkpoints/deep-approval-edge.md`

#### 5.4 Gherkin 可执行规格审批

```
✋ DEEP APPROVAL REQUIRED — Gherkin 规格
```

1. 展示生成的 .feature 文件内容预览（由 gherkin-spec generator 生成草案）
2. 调用 AskUserQuestion（TYPE_B 变体）
3. 🛑 BLOCK — 等待审批
4. 记录到 `.harness/checkpoints/deep-approval-gherkin.md`

---

### PHASE 6: 产出生成

> **前置条件**: PHASE 5 全部审批通过（4/4 ✅ APPROVED）

#### 6.1 调用产出生成器

按顺序调用以下生成器：

| 顺序 | 生成器 | 输入 | 输出 |
|------|--------|------|------|
| 1 | `generators/requirements-doc.md` | 三模块输出 | REQUIREMENTS.md |
| 2 | `generators/mermaid-charts.md` | 三模块输出 | 嵌入的 Mermaid 图表 |
| 3 | `generators/gherkin-spec.md` | 三模块输出 | features/*.feature |

#### 6.2 生成交付物目录结构

```
.harness/
├── requirements/
│   └── REQUIREMENTS.md                    # 完整的需求分析文档
├── features/
│   └── {feature-name}.feature              # Gherkin 可执行规格
├── diagrams/
│   ├── rule-dependencies.mmd               # 规则依赖关系图
│   ├── user-journey.mmd                    # 用户旅程图
│   └── state-machine.mmd                   # 状态机图
└── analysis/
    └── edge-cases.md                       # 边缘 case 清单
```

#### 6.3 输出 Deep Requirements Package

```markdown
# Deep Requirements Output Package

## 来源
- Capsule: deep-requirements
- 协议版本: MCP v2.0.0
- 完成时间: {timestamp}
- 分析模式: Enterprise Deep
- 审批状态: FULLY_APPROVED

## 采访完成度
- 业务规则 (MODULE A): 5/5 (100%)
- 用户旅程 (MODULE B): 4/4 (100%)
- 边缘 Case (MODULE C): 3/3 (100%)
- 总计: 12/12 (100%)

## 审批记录
- 业务规则表: ✅ Y {time}
- 用户旅程图: ✅ Y {time}
- 边缘 Case 清单: ✅ Y {time}
- Gherkin 规格: ✅ Y {time}

## 交付物索引
| 产物 | 路径 | 状态 |
|------|------|------|
| REQUIREMENTS.md | .harness/requirements/REQUIREMENTS.md | ✅ |
| Gherkin Specs | .harness/features/*.feature | ✅ |
| Mermaid Charts | .harness/diagrams/*.mmd | ✅ |
| Edge Cases | .harness/analysis/edge-cases.md | ✅ |

## 审计追踪
- 深度审计日志: .harness/audit/deep-checkpoint-log.md
- 总耗时: {duration}
- 用户交互次数: {count}
```

---

## 错误处理与恢复

### 模块执行失败

如果某个 module 报错或异常退出：
1. **记录错误**: 写入 `.harness/audit/deep-module-error-{timestamp}.md`
2. **诊断原因**: 检查 AskUserQuestion tool、checkpoint 权限、文件系统
3. **恢复策略**:
   - 如果是部分完成 → 从最后成功的 checkpoint 继续
   - 如果是完全失败 → 重新启动该 module
4. **通知用户**:
   ```
   ⚠️ Deep Analysis Module [{module_name}] 遇到问题
   错误: {error_message}
   已完成: {completed_checkpoints_in_module}
   未完成: {pending_checkpoints_in_module}
   
   建议: {recovery_suggestion}
   ```

### 用户中途暂停

如果用户在深度采访过程中要求暂停：
1. **保存进度**:
   - 已完成的 checkpoint 保持不变
   - 更新深度审计日志标记"USER_PAUSED"
   - 生成恢复指令: `/harness deep-spec --resume-from {last_completed_cp}`
2. **清理**:
   - 不删除已完成的 checkpoint 文件
   - 不生成部分完成的产出物
3. **输出**:
   ```
   📋 深度需求分析已暂停
   
   已完成:
   - ✅ {completed_modules_with_counts}
   
   未完成:
   - ⏳ {pending_modules_with_counts}
   
   恢复命令: /harness deep-spec --resume-from {next_checkpoint}
   ```

---

## 完整性自检清单

### 采访完整性
- [ ] DEEP-BR-Q1: 状态 = ✅ COMPLETED
- [ ] DEEP-BR-Q2: 状态 = ✅ COMPLETED
- [ ] DEEP-BR-Q3: 状态 = ✅ COMPLETED
- [ ] DEEP-BR-Q4: 状态 = ✅ COMPLETED
- [ ] DEEP-BR-Q5: 状态 = ✅ COMPLETED
- [ ] DEEP-UJ-Q1: 状态 = ✅ COMPLETED
- [ ] DEEP-UJ-Q2: 状态 = ✅ COMPLETED
- [ ] DEEP-UJ-Q3: 状态 = ✅ COMPLETED
- [ ] DEEP-UJ-Q4: 状态 = ✅ COMPLETED
- [ ] DEEP-EC-Q1: 状态 = ✅ COMPLETED
- [ ] DEEP-EC-Q2: 状态 = ✅ COMPLETED
- [ ] DEEP-EC-Q3: 状态 = ✅ COMPLETED

### 审批完整性
- [ ] DEEP-APPROVAL-RULES: 状态 = ✅ APPROVED
- [ ] DEEP-APPROVAL-JOURNEY: 状态 = ✅ APPROVED
- [ ] DEEP-APPROVAL-EDGE: 状态 = ✅ APPROVED
- [ ] DEEP-APPROVAL-GHERKIN: 状态 = ✅ APPROVED

### 文件完整性
- [ ] .harness/checkpoints/deep-br-q{1-5}.md 存在 (5 files)
- [ ] .harness/checkpoints/deep-uj-q{1-4}.md 存在 (4 files)
- [ ] .harness/checkpoints/deep-ec-q{1-3}.md 存在 (3 files)
- [ ] .harness/checkpoints/deep-approval-{rules,journey,edge,gherkin}.md 存在 (4 files)
- [ ] .harness/audit/deep-checkpoint-log.md 已更新
- [ ] .harness/requirements/REQUIREMENTS.md 存在
- [ ] .harness/features/*.feature 存在 (≥1 file)

**如果任何一项未完成 → 🔴 ERROR: 不能进入产出生成，必须补全**

---

## 输出交接规范

### 交接对象
→ `spec-generator` Capsule (增强版，接收 Deep Requirements Package)

### 交接格式

```markdown
## Deep Requirements → Spec Generator 交接包

### 来源
- Capsule: deep-requirements
- 协议版本: MCP v2.0.0
- 完成时间: {timestamp}
- 审批状态: FULLY_APPROVED

### 内容索引
| 数据项 | 文件路径 | 状态 |
|--------|----------|------|
| BR-Q1 业务目标 | .harness/checkpoints/deep-br-q1.md | ✅ |
| BR-Q2 规则复杂度 | .harness/checkpoints/deep-br-q2.md | ✅ |
| ... (全部 16 个检查点文件) | ... | ✅ |
| 业务规则表 | .harness/analysis/rules-table.md | ✅ |
| 用户旅程图 | .harness/diagrams/user-journey.mmd | ✅ |
| 边缘 Case 清单 | .harness/analysis/edge-cases.md | ✅ |
| Gherkin 规格 | .harness/features/*.feature | ✅ |
| REQUIREMENTS.md | .harness/requirements/REQUIREMENTS.md | ✅ |

### 审计追踪
- 深度审计日志: .harness/audit/deep-checkpoint-log.md
- 总耗时: {duration}
- 用户交互次数: {count}

### 下一步
Spec Generator 请基于此深度包生成最终设计文档
注意：文档中的业务规则、用户旅程、边缘 case 数据均已获用户确认
```

---

## 版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| 1.0.0 | 2026-05-05 | 初始版本 - 深度需求分析主协调器 | Harness Team |
