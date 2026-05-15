---
id: writing-plans
name: Writing Plans — 编写实施计划
stage: plan
roles: [Tech Lead, Architect]
pattern: TaskDecomposer
mandatory: true
depends: [brainstorming, office-hours]
version: "3.1"
min_lines: 50
description: "When the user mentions /plan, decompose tasks, split work, or needs to break down design documents into micro-tasks, ALWAYS use this skill. Outputs wave-executable format with dependencies and acceptance criteria. Also generates GHBANK system design specification."
---

# Writing Plans — 编写实施计划

> Superpowers 工程方法论层：将设计拆分为可执行的微任务

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| brainstorming 设计审批通过后 | brainstorming 输出设计文档时自动触发 | 设计 → 计划的标准流转 |
| 用户要求制定实施计划 | 用户输入 `/plan` 或「帮我制定实施计划」 | 显式请求 |
| 开始新的开发阶段 | Sprint Planning 或迭代启动时 | 批量生成阶段计划 |
| 需求变更评估完成 | office-hours 或 brainstorming 确认方向后 | 变更后的重新规划 |

**不触发场景**：单行 Bug 修复（走 systematic-debugging 直接修复）、纯配置调整、文档更新。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 设计文档 | `.harness/specs/YYYY-MM-DD-<topic>-design.md` | 必需 | 包含验收标准和已审批的维度 |
| 项目技术栈信息 | `.harness/config.yaml` | 必需 | 决定任务拆分粒度和工具选择 |
| 现有代码结构 | `src/` 目录树 | 必需 | 了解现有文件组织，避免冲突 |
| 已有计划文件 | `.harness/plans/` 目录 | 可选 | 检查是否有未完成的关联计划 |
| Git 分支状态 | `git branch -a` | 可选 | 确认当前工作分支和远程状态 |

**前置检查**：如果设计文档中无任何已审批的维度，应提示用户先完成 brainstorming 的分段审批流程。

## 核心原则

1. **微任务粒度**：每个任务 ≤ 5 分钟完成
2. **可验证性**：每个任务有明确的完成标准
3. **文件导向**：每个任务指定要创建/修改的文件
4. **依赖透明**：明确标注任务间依赖关系
5. **过程文档合规**：同步生成 GHBANK 系统设计说明书，确保企业合规

## 执行流程

### Step 1：读取并分析设计文档

- 读取 `.harness/specs/` 下相关设计文档
- 提取所有已审批的维度（数据模型、状态管理、UI、测试策略）
- 列出所有验收标准（AC1, AC2, ...）
- 识别技术约束（框架约定、性能要求、兼容性要求）

**操作说明**：
- 用表格形式记录提取结果，作为后续拆分的输入
- 标注每个维度的复杂度评级（简单/中等/复杂）

### Step 2：拆分微任务

从设计文档中提取任务，按以下维度拆分：

#### 拆分策略优先级

| 策略 | 适用场景 | 示例 |
|------|---------|------|
| **按文件拆分** | 新增独立模块 | 创建 types.ts / 创建 hook.ts / 创建 component.tsx |
| **按功能拆分** | 单文件内多功能 | 实现 login 方法 / 实现 logout 方法 / 实现 refresh 方法 |
| **按测试拆分** | TDD 强制要求 | 先写类型测试 → 再写实现 → 再写集成测试 |
| **按层次拆分** | 多层架构 | 数据层 → 业务层 → 展示层 |

#### 微任务标准格式

每个微任务必须符合以下模板：

```markdown
- [T{Wave}.{序号}] **<任务标题>**
  - **操作**：<具体要做什么，一句话>
  - **输入**：<依赖的前置产物或文件>
  - **输出**：<创建或修改的文件路径>
  - **完成标准**：<如何判断这个任务做完了（可自动化验证）>
  - **预估时间**：≤ 5 分钟
  - **依赖**：[无 / T{前驱任务编号}]
  - **执行角色**：<Developer / Tester / 任意子代理>
```

**微任务质量规则**：
- 任务描述必须包含动词（创建/编写/修改/配置/验证）
- 完成标准必须是可客观验证的（文件存在 / 测试通过 / 编译成功）
- 如果一个任务预估 >5 分钟，必须进一步拆分
- 每个任务的输出文件必须是唯一的（两个任务不能写同一个文件）

### Step 3：Wave 编排

将微任务组织为 Wave（波次），确定并行性和依赖关系：

#### Wave 编排规则

```
规则 1：同一 Wave 内的任务必须无互相依赖（可完全并行）
规则 2：后一 Wave 只能依赖前一 Wave 的产出（禁止跨 Wave 依赖）
规则 3：每个 Wave 至少包含 1 个任务（空 Wave 应合并或删除）
规则 4：Wave 内部任务数建议 2-6 个（过多考虑拆分为子-Wave）
规则 5：关键路径上的任务尽量靠前排列（减少总等待时间）
```

#### 并行可能性判定矩阵

| 条件 | 可并行？ | 原因 |
|------|---------|------|
| 两个任务修改不同文件 | ✅ 是 | 无文件冲突 |
| 两个任务修改同一文件的不同函数 | ⚠️ 有风险 | 可能产生 merge 冲突 |
| 一个任务是测试，一个是实现（不同文件） | ✅ 是 | 但执行顺序上测试应在实现之前（TDD） |
| 两个任务共享同一个依赖的类型定义 | ❌ 否 | 后者依赖前者产出的类型 |
| 两个任务都是配置类修改（tsconfig, eslint 等） | ⚠️ 谨慎 | 配置变更可能影响全局编译环境 |

#### 标准 Wave 结构示例

```markdown
## Wave 0: 基础设施与类型（无依赖，完全并行）
- [T0.1] 创建类型定义文件 → 无依赖 → 输出: src/types/feature.ts
- [T0.2] 配置测试环境 → 无依赖 → 输出: vitest.config.ts 更新
- [T0.3] 安装新依赖包 → 无依赖 → 输出: package.json + lock 文件

**验证点**：T0 全部完成 → `npx tsc --noEmit` 通过

## Wave 1: 核心逻辑（依赖 Wave 0）
- [T1.1] 实现核心 Hook（依赖 T0.1 类型）→ 输出: src/hooks/useFeature.ts
- [T1.2] 写核心单元测试（依赖 T0.2 环境 + T0.1 类型）→ 输出: src/__tests__/hooks/useFeature.test.ts

**验证点**：T1 全部完成 → 单元测试通过

## Wave 2: UI 组件（依赖 Wave 1，内部有条件并行）
- [T2.1] 实现主组件 A（依赖 T1.1）→ 输出: src/components/FeatureA.tsx
- [T2.2] 实现辅助组件 B（依赖 T1.1）→ 输出: src/components/FeatureB.tsx ← 与 T2.1 可并行
- [T2.3] 写组件测试（依赖 T2.1 + T2.2）→ 输出: src/__tests__/components/

**验证点**：T2 全部完成 → 组件测试通过

## Wave 3: 集成与收尾（依赖 Wave 1 + Wave 2）
- [T3.1] 集成测试（依赖 T1.2 + T2.3）→ 输出: src/__tests__/integration/
- [T3.2] 页面组装（依赖 T2.1 + T2.2）→ 输出: src/pages/FeaturePage.tsx

**最终验证点**：全部 Wave 完成 → 全量测试通过 + 构建成功
```

### Step 4：依赖标注方法

#### 前向依赖（我依赖谁）

```markdown
- [T2.1] 实现组件 A
  - **前向依赖**：T1.1（需要 useFeature Hook 的返回值类型）
  - **理由**：组件 A 的 Props 类型来自 Hook 的返回值
```

#### 反向依赖（谁依赖我）

```markdown
- [T1.1] 实现 useFeature Hook
  - **反向被依赖**：T2.1, T2.2（两个组件都使用此 Hook）
  - **影响范围**：此任务的接口变更会影响 2 个下游任务
```

#### 依赖图可视化（可选）

```
T0.1 ──┐
T0.2 ──┼──→ T1.1 ──┬──→ T2.1 ──┐
T0.3 ──┘       │         └──→ T3.2
                ├──→ T1.2 ──┬──→ T2.2 ──┘
                │          └──→ T2.3 ──→ T3.1
                └─────────────────────┘
```

### Step 5：计划评审 Checklist

在输出最终计划前，逐项确认：

- [ ] **完整性检查**：所有设计文档中的已审批维度都有对应任务覆盖？
- [ ] **粒度检查**：每个任务的预估时间 ≤ 5 分钟？（如有超时的，标注为「复合任务」并内嵌子步骤）
- [ ] **依赖正确性**：依赖关系无循环？（A→B→C→A 是非法的）
- [ ] **文件唯一性**：没有两个任务写入同一个输出文件？
- [ ] **验证点充足**：每个 Wave 结束后有明确的验证点？
- [ ] **TDD 合规**：实现任务前有对应的测试任务？（除非是纯类型/配置）
- [ ] **资源可行性**：最大并行度不超过可用子代理数量？（默认 ≤ 4 并行）
- [ ] **风险标注**：高风险任务（涉及外部 API、数据库迁移等）是否已标记？

### Step 6：输出计划文件

输出到 `.harness/plans/` 目录，使用波次编排格式（与 GSD 协作）：

```markdown
# <功能名> - 实施计划

> For agentic workers: Use subagent-driven-development or GSD wave execution.
> Plan version: <日期+序号>
> Source design: .harness/specs/YYYY-MM-DD-<topic>-design.md

## 元信息
- **总任务数**：N 个
- **总 Wave 数**：W 个
- **预估总时长**：XX 分钟（串行） / XX 分钟（理想并行）
- **关键路径长度**：Wave 0 → Wave W（共 W+1 个 Wave）

## Wave 1: 基础设施（并行）
- [T1.1] 创建类型定义 → 独立子代理 → 输出: src/types/xxx.ts
- [T1.2] 写类型测试 → 独立子代理 → 输出: src/__tests__/types/xxx.test.ts

## Wave 2: 核心逻辑（依赖 Wave 1）
- [T2.1] 实现核心 Hook → 依赖 T1.1 → 输出: src/hooks/xxx.ts
- [T2.2] 写 Hook 测试 → 依赖 T2.1 → 输出: src/__tests__/hooks/xxx.test.ts

## Wave 3: UI 组件（依赖 Wave 2，内部并行）
- [T3.1] 实现组件 A → 依赖 T2.1
- [T3.2] 实现组件 B → 依赖 T2.1

## 验证点
- Wave 1 完成 → 类型测试全部通过
- Wave 2 完成 → Hook 测试全部通过
- Wave 3 完成 → 集成测试通过

## 风险项
| # | 风险描述 | 影响任务 | 缓解措施 |
|---|---------|---------|---------|
| 1 | ... | ... | ... |
```

### Step 7：生成 GHBANK 系统设计说明书

> **新增于 v3.1**：按 GHBANK 企业规范生成过程文档，确保系统设计阶段产出合规。

读取 `generators/ghbank-design.md` 获取生成器指令和映射规则。

#### 7.1 收集映射数据

从 spec 阶段设计文档和 plan 阶段架构分析中提取 GHBANK 模板所需的映射数据：

| 数据来源 | 映射目标章节 | 提取方法 |
|----------|-------------|----------|
| spec 设计文档 - 核心功能 | 4. 功能模块设计 | 功能需求映射为模块划分和详细设计 |
| spec 设计文档 - 数据模型 | 5. 数据库设计 | 类型定义映射为数据表设计 |
| spec 设计文档 - 安全需求 | 7. 安全设计 | 安全需求映射为认证授权/数据安全/防护措施 |
| spec 设计文档 - 性能需求 | 8. 性能设计 | 性能需求映射为性能指标和优化策略 |
| spec GHBANK 需求分析规格说明书 | 2. 引言 + 3. 系统架构 | 项目背景和需求推导架构 |
| plan Step 1 架构分析 | 3. 系统架构设计 | 总体架构 + 技术架构 |
| plan Step 2 任务拆分 | 4.1 模块划分 | Wave 编排映射为模块划分 |
| plan Step 4 依赖标注 | 4.1 依赖模块 | 任务依赖映射为模块依赖 |
| .harness/config.yaml 技术栈 | 3.2 技术架构 + 5.2 数据表 + 9. 部署架构 | 技术选型映射 |
| api-design 输出（如有） | 6. 接口设计 | OpenAPI 规范映射为接口列表 |

#### 7.2 填充 GHBANK 模板

按照 `generators/ghbank-design.md` 中的输出模板和映射规则，将收集的数据填入 GHBANK 系统设计说明书模板。

填充优先级：
1. 有 api-design 输出的章节 → 优先使用接口契约数据
2. 有 spec GHBANK 需求分析规格说明书的章节 → 从需求推导设计
3. 仅有 spec 设计文档的章节 → 从设计文档推导
4. 无直接数据源的章节（如部署架构） → 从 tech profile 和项目配置推导

#### 7.3 用户审批

使用 MCP 检查点 TYPE_B (APPROVAL) 等待用户确认：

```
📍 CHECKPOINT [GHBANK-DES-APPROVAL] — GHBANK 系统设计说明书审批
📄 文档路径: .harness/plans/GHBANK-{project_name}-系统设计说明书.md
```

用户可选择：
- ✅ 批准 → 文档定稿，进入 build 阶段
- ✏️ 修改 → 根据反馈修改后重新审批
- ❌ 驳回 → 回到 Step 7.2 重新填充

#### 7.4 输出

输出到：`.harness/plans/GHBANK-{project_name}-系统设计说明书.md`

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 实施计划文件 | `.harness/plans/<feature>-plan-YYYYMMDD.md` | Markdown | 完整的 Wave 编排计划 |
| GHBANK 系统设计说明书 | `.harness/plans/GHBANK-{project_name}-系统设计说明书.md` | Markdown | 符合 GHBANK 规范的系统设计过程文档 |
| 任务追踪表 | 嵌入计划文件 | 表格 | 所有微任务的状态跟踪 |
| 依赖关系图 | 嵌入计划文件或独立文件 | ASCII 图 / Mermaid | 可视化依赖关系 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 设计文档缺少审批维度 | 暂停计划，退回 brainstorming 补充审批 | 审批完成后重新进入 Step 1 |
| 微任务无法拆到 ≤5 分钟 | 将其标记为「复合任务」，内部嵌套子步骤 | 子步骤仍遵循 ≤5 分钟原则 |
| 发现循环依赖 | 重新审视任务边界，引入中间抽象层解除循环 | 或合并循环任务为一个更大的原子任务 |
| 计划与现有代码冲突 | 标注冲突点，在计划中加入「前置清理」任务 | 清理任务作为 Wave 0 的第一项 |
| 评审 Checklist 不通过 | 根据未通过项逐一修正 | 修正后重新跑 Checklist |

## 交接协议

```markdown
## Writing Plans 交接包

### 交付给 subagent-driven-development / GSD
- 计划文件路径：`.harness/plans/<feature>-plan-YYYYMMDD.md`
- 总任务数：N 个（W 个 Wave）
- Wave 0 任务列表（可直接开始）：[T0.1, T0.2, ...]
- 关键路径：T0.x → T1.x → ... → TW.x
- 风险项摘要：K 个风险（含缓解措施）

### 交付给 tdd（作为 TDD 循环的编排依据）
- 测试任务列表及对应的实现任务配对
- 每个 Wave 的验证点和通过标准
```

**交接验证**：接收方必须确认计划文件存在且评审 Checklist 全部通过（8/8 项）。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 计划文件存在 | 文件系统检查 | `.harness/plans/` 下有对应 plan 文件 |
| GHBANK 系统设计说明书存在 | 文件系统检查 | `.harness/plans/` 下有 GHBANK-*系统设计说明书.md |
| 包含 YAML frontmatter | 内容解析 | frontmatter 含 id/name/stage/version |
| 任务总数 ≥ 3 | 内容统计 | 微任务数量 ≥ 3（否则无需拆分） |
| 每个任务有完成标准 | 内容搜索 | 所有任务条目包含「完成标准」字段 |
| 依赖无环 | 依赖图分析 | 不存在 A→B→...→A 的环路 |
- 有 Wave 组织 | 内容搜索 | 出现 ≥1 个「Wave」章节 |
| 评审 Checklist 全过 | 报告内容解析 | 8 项 Checklist 全部勾选 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |
| GHBANK 文档章节完整 | 结构校验 | 系统设计说明书包含全部 10 个一级章节 |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| Superpowers: brainstorming | brainstorming 产出设计 → writing-plans 拆微任务 |
| GSD | writing-plans 产出任务列表 → GSD 波次编排执行 |
| GSTACK: /autoplan | writing-plans 产出计划 → /autoplan 多视角审查 |
| Superpowers: TDD | 每个实现任务前先写测试任务 |
| subagent-driven-development | 计划中的微任务 → 子代理的执行指令 |
