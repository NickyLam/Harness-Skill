---
id: brainstorming
name: Brainstorming — 先想后做
description: "When the user mentions /spec, feature design, requirement clarification, brainstorm, or needs to define a new feature before coding, ALWAYS use this skill. Uses Inversion pattern — agent interviews user first, then proposes 2-3 solutions for comparison before generating structured design documents."
stage: spec
roles: [Product Owner]
pattern: Inversion
mandatory: true
depends: []
version: "3.0"
min_lines: 50
---

# Brainstorming — 先想后做

> **设计模式**：Inversion（先采访，再执行）
> **阶段**：定义
> **角色**：Product Owner
> **触发**：`/spec`

## 触发条件

以下场景自动触发本 Skill：

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 新增功能模块 | 用户输入 `/spec` 或自然语言描述新功能 | 需要从零开始设计方案 |
| 修改核心数据流 | 用户要求重构或修改关键流程 | 影响范围大，必须先设计 |
| 添加跨组件交互 | 涉及多个模块的协作变更 | 需要明确接口和边界 |
| 引入新的第三方库 | 技术选型决策 | 需要评估风险和替代方案 |
| 性能优化方案对比 | 多种优化路径可选 | 需要量化对比后决策 |

**不触发场景**：纯 Bug 修复（走 systematic-debugging）、文档更新、配置调整等低风险变更。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 项目上下文 | `.harness/config.yaml` | 必需 | 项目技术栈、约定、约束 |
| 现有代码库 | `src/` 目录 | 必需 | 了解现有架构和模式 |
| 已有设计文档 | `.harness/specs/` 目录 | 可选 | 复用已有决策，避免重复 |
| 用户需求描述 | 对话上下文 | 必需 | 用户的原始需求输入 |

**前置检查**：如果 `.harness/config.yaml` 不存在，应先提示用户初始化项目配置。

## 核心原则

1. **先采访，再执行** — 不是 Agent 猜需求，而是 Agent 先当采访者
2. **一次只问一个问题** — 不让用户信息过载
3. **2-3 种方案对比** — 不只给一个答案
4. **分段展示设计** — 让用户审批每一段
5. **输出结构化设计文档** — 留存设计决策

## 执行流程

### Step 1：需求澄清（Inversion 模式）

按顺序逐一询问，每个问题等待用户回答后再问下一个：

1. **目标用户**：这个功能的目标用户是谁？
2. **核心场景**：最主要的 1-2 个使用场景是什么？
3. **现有代码**：需要修改哪些现有模块？
4. **技术风险**：有什么已知的技术难点？
5. **完成标准**：怎么判断这个功能做完了？

**操作说明**：
- 每次只问一个问题，等待用户完整回答后再继续
- 如果用户回答模糊，用追问技巧深化理解（"您说的 X 具体是指..."）
- 将关键信息实时记录到临时草稿中

### Step 2：方案设计

基于采访结果，提出 2-3 种实现方案：

每种方案包含：
- 方案描述（1-2 段）
- 优势（2-3 点）
- 劣势（2-3 点）
- 工作量估算（小/中/大）
- 风险评估（低/中/高）

**操作说明**：
- 至少提供 2 种不同思路的方案
- 推荐方案需标注「推荐」并给出理由
- 工作量估算参考项目历史数据或行业基准

### Step 3：分段审批

将推荐方案按维度拆分，逐段展示：
1. 数据模型变更 → 等待用户审批
2. 状态管理变更 → 等待用户审批
3. UI 变更 → 等待用户审批
4. 测试策略 → 等待用户审批

未审批的维度不进入实现。

**操作说明**：
- 每个维度单独展示，附上具体变更清单
- 用户可对单个维度说「跳过」或「调整」
- 记录每个维度的审批状态（✅ 通过 / ⚠️ 调整 / ❌ 跳过）

### Step 4：输出设计文档

使用 spec-generator 的模板生成设计文档，输出到：
```
.harness/specs/YYYY-MM-DD-<topic>-design.md
```

**操作说明**：
- 文档包含所有已审批的维度内容
- 附上完整的决策记录（为什么选 A 不选 B）
- 明确列出验收标准（AC1, AC2, ...）

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 设计文档 | `.harness/specs/YYYY-MM-DD-<topic>-design.md` | Markdown | 完整的设计方案和决策记录 |
| 决策日志 | 嵌入设计文档 | Markdown 表格 | 每个关键决策的取舍理由 |
| 验收标准列表 | 嵌入设计文档 | 编号列表 | 可量化的完成判定标准 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 用户拒绝所有方案 | 回到 Step 1 重新采集需求，可能需要更深入的问题 | 调整提问角度，引入更多背景信息 |
| 用户中途退出/无响应 | 保存当前进度到 `.harness/drafts/<topic>-draft.md` | 下次恢复时从断点继续 |
| 技术可行性无法确认 | 标记为「需要原型验证」，建议先做 spike 任务 | 输出 spike 任务给 writing-plans |
| 需求冲突（多方意见不一致） | 列出冲突点，请用户仲裁 | 在设计文档中记录各方观点和最终裁决 |
| 项目配置缺失 | 提示运行项目初始化流程 | 暂停，等待配置就绪后重试 |

## 交接协议

当 brainstorming 完成后，向下游 Skill 交接以下内容：

```markdown
## Brainstorming 交接包

### 交付给 writing-plans
- 设计文档路径：`.harness/specs/YYYY-MM-DD-<topic>-design.md`
- 已审批的维度清单：[数据模型 ✅, 状态管理 ✅, UI ⚠️调整, 测试策略 ✅]
- 验收标准数量：N 条
- 推荐实施优先级：P0 > P1 > P2

### 交付给 office-hours（如适用）
- 产品诊断结论：值得做 / 需调整 / 暂不做
- 六问回答摘要
- MVP 范围建议
```

**交接验证**：接收方 Skill 必须确认能读取到设计文档且验收标准条数 ≥ 1。

## 质量门禁

以下条件全部满足方可标记为完成：

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 设计文档存在 | 文件系统检查 | `.harness/specs/` 下有对应 `.md` 文件 |
| 包含 YAML frontmatter | 内容解析 | frontmatter 含 id/name/stage/version |
| 至少 2 个方案对比 | 内容搜索 | 文档中出现 ≥ 2 个「方案」段落 |
| 有明确的验收标准 | 内容搜索 | 出现 AC 编号（AC1, AC2, ...）且 ≥ 3 条 |
| 决策记录完整 | 内容搜索 | 每个已审批维度有「选择理由」字段 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| GSTACK: /office-hours | brainstorming 关注"怎么实现"，/office-hours 关注"值不值得做" |
| spec-generator | brainstorming 采集信息 → spec-generator 生成文档 |
| writing-plans | brainstorming 完成设计 → writing-plans 拆微任务 |

## 常见 brainstorming 场景（从 .harness/config.yaml 读取项目特定场景）

- 新增功能模块
- 修改核心数据流
- 添加跨组件交互
- 引入新的第三方库
- 性能优化方案对比
