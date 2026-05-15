---
id: spec-generator
name: "Spec Generator — 规范文档生成器"
stage: spec
roles: [product-owner]
pattern: template-filling
mandatory: true
depends: [brainstorming]
version: "3.1"
description: "When the user mentions generate spec, create design doc, requirements spec, or needs to produce a structured design document from brainstorming results, ALWAYS use this skill. Fills templates with collected requirements to generate design docs AND GHBANK requirements analysis specification."
---

# Spec Generator — 设计文档生成器

> **设计模式**：Generator（模板填充式生成）
> **阶段**：定义
> **角色**：Product Owner
> **触发**：/spec（与 brainstorming 协同）

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| brainstorming 采访完成 | brainstorming 输出 design_decisions | 自动进入文档生成 |
| 用户输入 `/spec` | 显式请求 | 手动触发设计文档生成 |
| deep-requirements 完成 | deep-requirements 输出深度需求 | 增量补充设计文档 |

**不触发场景**：尚未完成 brainstorming 采访、用户明确跳过 spec 阶段。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| brainstorming 采访结果 | brainstorming Skill 输出 | 必需 | 提供变量填充数据源 |
| spec-template.md | `assets/spec-template.md` | 必需 | 文档结构模板 |
| 用户审批 | MCP 检查点 TYPE_B | 必需 | 文档生成后需用户确认 |

## 核心原则

1. **模板驱动**：使用 assets/spec-template.md 保证输出一致性
2. **变量填充**：从 brainstorming 采访结果中提取变量
3. **严格遵循模板**：不遗漏任何章节，不添加模板外的内容
4. **审批后定稿**：生成文档后必须等待用户审批才能进入下一阶段
5. **过程文档合规**：同步生成 GHBANK 需求分析规格说明书，确保企业合规

## 执行流程

### Step 1：读取模板

读取 `assets/spec-template.md` 获取文档结构。

验证模板包含以下必要章节：
- [ ] 元信息（日期、作者、版本）
- [ ] 背景与目标
- [ ] 目标用户
- [ ] 核心场景
- [ ] 受影响模块
- [ ] 技术风险
- [ ] 验收标准
- [ ] 方案对比
- [ ] 推荐方案

### Step 2：收集变量

从 brainstorming 采访结果中提取以下变量：

| 变量 | 来源 | 必填 | 提取规则 |
|------|------|------|---------|
| `{{topic}}` | 功能名称 | ✅ | 从 brainstorming 标题或用户原始需求提取 |
| `{{date}}` | 当前日期 | ✅ | YYYY-MM-DD 格式 |
| `{{target_user}}` | 采访 Q1 回答 | ✅ | 直接引用，保持用户原话 |
| `{{core_scenarios}}` | 采访 Q2 回答 | ✅ | 整理为场景列表 |
| `{{affected_modules}}` | 采访 Q3 回答 | ✅ | 列出受影响的代码模块 |
| `{{tech_risks}}` | 采访 Q4 回答 | ⚠️ | 如无回答则标注"待评估" |
| `{{acceptance_criteria}}` | 采访 Q5 回答 | ✅ | 转为可验证的 AC 列表 |
| `{{solution_a}}` | 方案 A 描述 | ✅ | 从方案对比中提取 |
| `{{solution_b}}` | 方案 B 描述 | ⚠️ | 如无第二方案则标注"仅单一方案" |
| `{{recommended}}` | 推荐方案 | ✅ | 标注推荐理由 |

**变量缺失处理**：
- 必填变量缺失 → 回到 brainstorming 补充采访
- 可选变量缺失 → 填入默认占位文本（如"待评估"、"仅单一方案"）

### Step 3：填充模板

将变量填入模板，严格遵循模板结构。

填充规则：
1. 保持模板的章节顺序和层级不变
2. 变量值直接替换 `{{variable}}` 占位符
3. 列表类变量（如 core_scenarios）展开为 Markdown 列表
4. 不添加模板中不存在的章节

### Step 4：生成验收标准

将采访 Q5 的回答转化为结构化的验收标准：

```markdown
## 验收标准

| AC-ID | 验收标准 | 优先级 | 验证方式 |
|-------|---------|--------|---------|
| AC-001 | <验收标准描述> | P0 | <自动化/手动> |
| AC-002 | <验收标准描述> | P0 | <自动化/手动> |
| AC-003 | <验收标准描述> | P1 | <自动化/手动> |
```

### Step 5：用户审批

使用 MCP 检查点 TYPE_B (APPROVAL) 等待用户确认：

```
📍 CHECKPOINT [SPEC-APPROVAL] — 设计文档审批
📄 文档路径: .harness/specs/YYYY-MM-DD-<topic>-design.md
```

用户可选择：
- ✅ 批准 → 文档定稿，进入 plan 阶段
- ✏️ 修改 → 根据反馈修改后重新审批
- ❌ 驳回 → 回到 brainstorming 重新采访

### Step 6：输出

输出到：`.harness/specs/YYYY-MM-DD-<topic>-design.md`

### Step 7：生成企业级需求分析规格说明书

> **v3.1 更新**：生成符合企业级标准的通用需求分析规格说明书（去除组织特定标识，适用于任何企业项目）。

读取 `generators/enterprise-requirements.md` 获取生成器指令和增强映射规则。

#### 7.0 前置检查

**强制要求**:
- [ ] deep-requirements 已完成（12/12 检查点通过）⚠️ **v3.1 强制**
- [ ] brainstorming Step 2 变量收集完成
- [ ] 用户确认使用"深度模式"或项目类型为 enterprise

如果 deep-requirements 未完成 → **停止并提示用户**: "企业级需求规格说明书需要 deep-requirements 提供的深度数据支持（业务规则、用户旅程、边缘Case）。是否现在启动深度需求分析？"

#### 7.1 收集映射数据

从已完成的 Step 2 变量和 **deep-requirements 全量分析结果**中提取企业级模板所需的映射数据：

| 数据来源 | 映射目标章节 | 提取方法 | v3.1 增强内容 |
|----------|-------------|----------|---------------|
| brainstorming Q1 目标用户 | 3.2 用户特点 + 2.5 利益相关者 | 直接引用 + 推导利益相关者 | ⭐ 新增利益相关者分析 |
| brainstorming Q2 核心场景 | 4.1 功能需求 (每个场景→一个模块) | 逐场景展开为功能模块 | ⭐ 扩展为10维度功能描述 |
| brainstorming Q3 受影响模块 | 5.3 接口 + 3.3 依赖系统 | 推导接口需求和依赖关系 | ⭐ 完整API文档模板 |
| brainstorming Q4 技术风险 | 3.3 假定和约束 (带风险评估) | 风险转化为约束+应对措施 | ⭐ 新增风险等级和缓解方案 |
| brainstorming Q5 完成标准 | 3.1 目标 (SMART) + 验收标准 (Gherkin) | 标准转化为量化目标和可测试AC | ⭐ 改为Gherkin格式 |
| **deep-requirements MODULE A BR-Q1~Q5** | **4.1.N 业务规则表 + 伪代码 + 异常处理** | **提取BR→填充规则引擎** | 🚀 **核心增强: 业务规则驱动** |
| **deep-requirements MODULE B UJ-Q1~Q4** | **3.2 角色画像 + Mermaid旅程图 + 状态机** | **提取UJ→增强用户模型** | 🚀 **核心增强: 用户旅程可视化** |
| **deep-requirements MODULE C EC-Q1~EC-3** | **异常码表 + 并发约束 + 数据边界** | **提取EC→完善异常处理和数据字典** | 🚀 **核心增强: 边缘Case全覆盖** |

#### 7.2 填充企业级模板

按照 `generators/enterprise-requirements.md` 中的 **v3.1 增强输出模板** 和映射规则，生成通用企业级需求分析规格说明书。

**v3.1 模板增强要点**:

| 章节 | v3.0 (旧) | v3.1 (新) | 增强幅度 |
|------|-----------|-----------|----------|
| 4.1 功能需求 | 4字段 (描述+输入+处理+输出) | **10维度** (+BR+流程图+伪代码+状态机+异常+NFR) | **+150%** |
| 5.3 接口 | 1段文字描述 | **完整API文档** (Schema+错误码+cURL示例+SDK) | **+500%** |
| 6.3 数据字典 | 5列表格 | **12列+索引设计+ER图+DDL脚本** | **+140%** |
| 验收标准 | 简单列表 | **Gherkin格式** (Scenario+Examples+断言) | **+300%** |
| 2.x 引言 | 基础信息 | **+利益相关者分析+成功标准** | **+50%** |

**填充优先级**:
1. **P0 (最高)**: deep-requirements 分析结果（MODULE A/B/C 全量数据）
2. **P1**: brainstorming 采访结果（从采访中推导补充）
3. **P2**: 从 `.harness/config.yaml` 和 tech profile 提取（运行环境、技术栈）
4. **P3 (兜底)**: 合理默认值 + 标注 `{待确认}` 占位符

**质量控制**:
- ✅ 所有 `{...}` 变量必须替换为实际值（禁止残留占位符）
- ✅ 业务规则表至少包含每个功能模块的 2+ 条规则
- ✅ 接口定义必须包含完整的 Request/Response Schema
- ✅ 验收标准必须采用 Given-When-Then 格式
- ✅ 数据字典必须包含物理字段名、约束条件、索引设计

#### 7.3 用户审批

使用 MCP 检查点 TYPE_B (APPROVAL) 等待用户确认：

```
📍 CHECKPOINT [REQ-SPEC-APPROVAL] — 企业级需求分析规格说明书审批
📄 文档路径: .harness/specs/{project_name}-需求分析规格说明书.md
📊 文档统计:
   - 功能模块数: {N} 个
   - 业务规则数: {M} 条
   - API 接口数: {K} 个
   - 验收标准数: {L} 条
   - 数据实体数: {P} 个
```

用户可选择：
- ✅ **批准** → 文档定稿，进入 plan 阶段
- ✏️ **修改** → 根据反馈修改后重新审批（标注修改位置）
- ❌ **驳回** → 回到 Step 7.2 重新填充（需说明驳回原因）

**审批检查清单** (供用户参考):
- [ ] 功能需求覆盖了所有核心场景？
- [ ] 业务规则完整且无冲突？
- [ ] 接口定义可直接用于前后端开发？
- [ ] 验收标准可自动化测试？
- [ ] 数据字典可用于数据库设计？
- [ ] 非功能需求有明确的验证方法？

#### 7.4 输出

输出到：`.harness/specs/{project_name}-需求分析规格说明书.md`

**文件命名规范**:
- 格式: `{project_name}-需求分析规格说明书.md`
- 示例: `个人信贷移动审批系统-需求分析规格说明书.md`
- ❌ 禁止包含组织名称前缀（如 GHBANK_）

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 设计文档 | `.harness/specs/YYYY-MM-DD-<topic>-design.md` | Markdown | 基于模板生成的标准化设计文档 |
| GHBANK 需求分析规格说明书 | `.harness/specs/GHBANK-{project_name}-需求分析规格说明书.md` | Markdown | 符合 GHBANK 规范的需求分析过程文档 |
| 验收标准表 | 设计文档内嵌 | Markdown 表格 | 可验证的 AC 列表 |
| 方案对比表 | 设计文档内嵌 | Markdown 表格 | 至少 2 种方案的优劣对比 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| brainstorming 采访结果缺失 | 停止生成，提示用户先执行 brainstorming | 执行 brainstorming 后重新触发 |
| 模板文件不存在 | 报错并使用内置最小模板兜底 | 创建 spec-template.md 后重新生成 |
| 必填变量缺失 | 标注缺失变量，回到 brainstorming 补充 | 补充采访对应问题后重新填充 |
| 用户驳回设计文档 | 记录驳回原因，回到 Step 2 重新收集变量 | 根据反馈修改后重新审批 |
| 文件写入失败 | 检查 .harness/specs/ 目录权限 | 创建目录后重新输出 |
| 日期格式冲突（同名文件已存在） | 在文件名中追加序号或时间戳 | 确认覆盖或使用新文件名 |

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 设计文档存在 | 文件系统检查 | `.harness/specs/` 下有对应文件 |
| GHBANK 需求分析规格说明书存在 | 文件系统检查 | `.harness/specs/` 下有 GHBANK-*需求分析规格说明书.md |
| 文档已审批 | 文档状态字段 | 状态为"已审批" |
| 验收标准存在 | 内容搜索 | 文档中有 ≥1 条验收标准 |
| 模板章节完整 | 结构校验 | 模板定义的所有章节均存在 |
| 变量无残留 | 正则匹配 | 无 `{{...}}` 占位符残留 |
| GHBANK 文档章节完整 | 结构校验 | 需求分析规格说明书包含全部 7 个一级章节 |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| brainstorming | brainstorming 采集变量 → spec-generator 生成文档 |
| deep-requirements | deep-requirements 深度分析 → spec-generator 增量补充 |
| writing-plans | spec-generator 输出 → writing-plans 拆微任务 |
| office-hours | office-hours 诊断 → brainstorming 采访 → spec-generator 生成 |
