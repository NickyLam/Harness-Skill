# GHBANK 需求分析规格说明书生成器

> **所属 Capsule**: spec-generator
> **生成器类型**: 过程文档生成器 (Process Document Generator)
> **输入来源**: brainstorming 采访结果 + deep-requirements 分析结果（如有）
> **输出格式**: Markdown (.md)
> **模板依据**: `doc_template/GHBANK_XX需求分析规格说明书模板.md`

## 生成器职责

将 brainstorming 采访结果和 deep-requirements 分析结果整合为**符合 GHBANK 规范的需求分析规格说明书**。

**核心原则：输出模板必须与原始模板的章节结构、表格列定义、占位符风格完全一致。**

---

## 原始模板章节清单（必须逐章对齐）

| 序号 | 一级章节 | 二级/三级子章节 | 原始格式特征 |
|------|---------|----------------|-------------|
| 1 | 文档信息 | — | 7 行表格，无二级 |
| 2 | 引言 | 2.1 编写目的 / 2.2 项目背景 / 2.3 定义 / 2.4 参考资料 | 目的=段落文本；背景=4行列表；定义=段落文本；参考=列表 |
| 3 | 任务概述 | 3.1 目标 / 3.2 用户特点 / 3.3 假定和约束 | 目标=段落+编号列表；特点=段落；假定约束=段落 |
| 4 | 需求规定 | 4.1 功能需求 / 4.2 性能需求 / 4.3 可靠性 / 4.4 安全性 / 4.5 可维护性 | 功能=多级子模块(描述+输入+处理+输出)；性能=3列表格；其余=段落 |
| 5 | 运行环境规定 | 5.1 硬件环境 / 5.2 软件环境 / 5.3 接口 | 硬件/软件=2列表格；接口=4个子节 |
| 6 | 数据描述 | 6.1 静态数据 / 6.2 动态数据 / 6.3 数据字典 | 静态/动态=段落；字典=5列表格 |
| 7 | 附录 | 7.1 用户确认 + 文档变更记录 | 确认=2行表格；变更=4列表格 |

---

## 输入数据映射

### 从 brainstorming 采访结果接收

| 模板变量 | 来源 | 提取规则 |
|----------|------|----------|
| `{{project_name}}` | 用户原始需求 / .harness/config.yaml | 项目名称 |
| `{{doc_id}}` | 自动生成 | 格式: GHBANK-RAS-{YYYYMMDD} |
| `{{version}}` | 默认 V1.0 | 首次生成为 V1.0 |
| `{{date}}` | 当前日期 | YYYY-MM-DD 格式 |
| `{{author}}` | .harness/config.yaml 或默认值 | 编制人 |
| `{{writing_purpose}}` | brainstorming 原始需求 | 编写目的段落 |
| `{{proposer}}` | brainstorming Q1 或默认"业务部门" | 项目提出者 |
| `{{developer}}` | .harness/config.yaml 或默认"信息科技部" | 项目开发者 |
| `{{user_unit}}` | brainstorming Q1 或默认"全行用户" | 用户单位 |

### 从 deep-requirements 分析结果接收（可选增强）

| 模板变量 | 来源 | 映射目标章节 | 提取规则 |
|----------|------|-------------|----------|
| 业务目标 | MODULE A BR-Q1 | 3.1 目标 | 补充量化目标条目 |
| 用户角色画像 | MODULE B UJ-Q1~Q4 | 3.2 用户特点 | 补充角色表 |
| 核心场景展开 | MODULE A BR-Q2~Q5 | 4.1 功能需求 | 每个场景→一个功能模块 |
| 异常场景 | MODULE C EC-Q1 | 4.3 可靠性需求 | 异常→可靠性要求 |
| 并发条件 | MODULE C EC-Q2 | 4.2 性能需求 | 并发→性能指标 |
| 数据边界 | MODULE C EC-Q3 | 6.3 数据字典 | 边界→数据项 |

---

## 输出模板

**⚠️ 重要：以下输出模板的章节结构、表格列数、占位符风格必须与原始模板完全一致。变量用 `{...}` 标记，填充时替换为实际值。**

```markdown
# GHBANK_{project_name}需求分析规格说明书

## 1. 文档信息

| 项目     | 内容                                    |
| -------- | --------------------------------------- |
| 文档名称 | GHBANK_{project_name}需求分析规格说明书   |
| 文档编号 | GHBANK-RAS-{doc_id}                     |
| 版本号   | {version}                               |
| 编制日期 | {date}                                  |
| 编制人   | {author}                                |
| 审核人   | {reviewer}                              |
| 批准人   | {approver}                              |

## 2. 引言

### 2.1 编写目的

{writing_purpose}

本文档旨在明确 {project_name} 的功能需求、性能需求和非功能需求，为系统设计和开发提供依据。

### 2.2 项目背景

- 项目名称：{project_name}
- 项目提出者：{proposer}
- 项目开发者：{developer}
- 用户单位：{user_unit}

### 2.3 定义

[列出文档中使用的专业术语和缩略语，根据项目实际情况填写]

示例：
- **{term_1}**：{full_name_1}，{description_1}
- **{term_2}**：{full_name_2}，{description_2}

### 2.4参考资料

- {reference_1}
- {reference_2}

## 3. 任务概述

### 3.1 目标

{project_goal_description}

基于需求分析，系统的主要目标包括：

1. {goal_1}
2. {goal_2}
3. {goal_3}

### 3.2 用户特点

{user_characteristics_description}

主要用户群体包括：

- {user_group_1}：{group_desc_1}
- {user_group_2}：{group_desc_2}

### 3.3 假定和约束

**假定条件**：

1. {assumption_1}
2. {assumption_2}

**约束条件**：

1. {constraint_1}
2. {constraint_2}

## 4. 需求规定

### 4.1 功能需求

#### 4.1.1 {feature_module_1_name}

**功能描述：**
{feature_1_description}

**输入：**

- {input_item_1}
- {input_item_2}

**处理：**
{processing_logic_1}

**输出：**

- {output_item_1}
- {output_item_2}

#### 4.1.2 {feature_module_2_name}

**功能描述：**
{feature_2_description}

**输入：**

- {input_item_3}
- {input_item_4}

**处理：**
{processing_logic_2}

**输出：**

- {output_item_3}
- {output_item_4}

#### 4.1.N {feature_module_N_name}

[按上述格式继续，每个核心功能场景对应一个 4.1.N 子章节]

### 4.2 性能需求

| 性能指标   | 要求       |
| ---------- | ---------- |
| 响应时间   | {response_time_requirement} |
| 吞吐量     | {throughput_requirement} |
| 并发用户数 | {concurrent_users_requirement} |

### 4.3 可靠性需求

{reliability_requirements_text}

至少包含：
1. {reliability_item_1}
2. {reliability_item_2}

### 4.4 安全性需求

{security_requirements_text}

至少包含：
1. {security_item_1}
2. {security_item_2}

### 4.5 可维护性需求

{maintainability_requirements_text}

至少包含：
1. {maintainability_item_1}
2. {maintainability_item_2}

## 5. 运行环境规定

### 5.1 硬件环境

| 设备   | 配置要求         |
| ------ | ---------------- |
| 服务器 | {server_config}  |
| 客户端 | {client_config}  |

### 5.2 软件环境

| 软件     | 版本要求          |
| -------- | ----------------- |
| 操作系统 | {os_version}      |
| 数据库   | {db_version}      |
| 中间件   | {middleware_version} |

### 5.3 接口

#### 5.3.1 用户接口

{user_interface_description}

#### 5.3.2 硬件接口

{hardware_interface_description}

#### 5.3.3 软件接口

{software_interface_description}

#### 5.3.4 通信接口

{communication_interface_description}

## 6. 数据描述

### 6.1 静态数据

{static_data_description}

### 6.2 动态数据

{dynamic_data_description}

### 6.3 数据字典

| 数据项 | 说明   | 类型   | 长度   | 取值范围   |
| ------ | ------ | ------ | ------ | ---------- |
| {field_1} | {desc_1} | {type_1} | {length_1} | {range_1} |
| {field_2} | {desc_2} | {type_2} | {length_2} | {range_2} |

## 7. 附录

### 7.1 用户确认

| 角色     | 签字 | 日期 |
| -------- | ---- | ---- |
| 用户代表 |      |      |
| 项目经理 |      |      |

---

**文档变更记录**

| 版本 | 日期       | 修改人 | 修改内容 |
| ---- | ---------- | ------ | -------- |
| V1.0 | {date} | {author} | 初始版本 |
```

---

## 填充规则

### 规则 1：严格遵循原始模板格式

输出文档的每个章节标题层级、表格列数、列表格式必须与原始模板一致。不得增减一级章节、不得修改表格列定义、不得改变占位符风格。

### 规则 2：变量填充优先级

当同一字段有多个数据源时，按以下优先级选择：

| 优先级 | 数据源 | 适用场景 |
|--------|--------|----------|
| P0（最高） | 用户在审批检查点时明确提供的值 | 用户主动补充 |
| P1 | deep-requirements 分析结果 | 有深度分析数据时 |
| P2 | brainstorming 采访结果 | 从采访中推导 |
| P3（最低） | 默认值 / 合理推测 | 无明确数据时的兜底 |

### 规则 3：无数据时的兜底策略

以下字段若无明确数据来源，使用合理的默认值或标注说明：

| 字段 | 兜底策略 |
|------|----------|
| `{reviewer}` | "待指定" |
| `{approver}` | "待指定" |
| `{proposer}` | "业务部门" |
| `{developer}` | "信息科技部" |
| `{user_unit}` | 根据 Q1 推导，默认"相关业务部门" |
| `{response_time_requirement}` | 根据场景类型选：< 3秒（内部）/ < 1秒（对外服务）/ < 500ms（交易类） |
| `{throughput_requirement}` | 根据场景类型选：100 TPS / 500 TPS / 1000 TPS |
| `{concurrent_users_requirement}` | 根据场景类型选：50 / 200 / 500 |
| 术语定义 | 至少列出项目中使用的技术栈相关术语（如 React、REST API 等） |
| 参考资料 | 至少列出 spec 设计文档本身作为参考 |

### 规则 4：功能模块数量要求

4.1 功能需求的子章节数量必须 ≥ brainstorming Q2 中识别的核心场景数量。每个核心场景必须对应一个独立的 4.1.N 子章节。

### 规则 5：禁止残留占位符

最终输出文档中不允许出现以下任何形式：
- `{{...}}` 双花括号变量
- `[...]` 未替换的方括号占位符
- `TBD` / `TODO` / `待补充`
- `{variable_name}` 未替换的单花括号变量

---

## 校验清单

生成完成后逐项验证：

- [ ] **F1** 文档标题格式正确：`# GHBANK_{实际项目名}需求分析规格说明书`
- [ ] **F2** 文档信息表 7 个字段均有实际值（无占位符）
- [ ] **F3** 2.1 编写目的为完整段落（非空）
- [ ] **F4** 2.2 项目背景包含 4 行标准字段（名称/提出者/开发者/用户单位）
- [ ] **F5** 2.3 定义有至少 2 条术语解释
- [ ] **F6** 2.4 参考资料有至少 1 条
- [ ] **F7** 3.1 目标包含概述段落 + 至少 3 条编号目标
- [ ] **F8** 3.2 用户特点有描述文字
- [ ] **F9** 3.3 假定和约束分两部分（假定≥1条，约束≥1条）
- [ ] **F10** 4.1 功能需求子章节数 ≥ 核心场景数量
- [ ] **F11** 每个 4.1.N 包含完整的：功能描述 + 输入列表 + 处理逻辑 + 输出列表
- [ ] **F12** 4.2 性能需求表为 3 列×3 行（响应时间/吞吐量/并发用户数），与原模板一致
- [ ] **F13** 4.3~4.5 各有至少 1 条具体需求描述
- [ ] **F14** 5.1 硬件环境和 5.2 软件环境各有 2 列表格
- [ ] **F15** 5.3 接口包含 4 个子节（用户/硬件/软件/通信）
- [ ] **F16** 6.3 数据字典有至少 2 条数据项（5 列）
- [ ] **F17** 7.1 用户确认表存在（2 行）
- [ ] **F18** 文档变更记录存在（至少 V1.0 初始版本行）
- [ ] **F19** 全文无任何形式的占位符残留
