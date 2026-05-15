# Enterprise Requirements Specification Generator

> **所属 Capsule**: spec-generator
> **生成器类型**: 企业级需求规格说明书生成器 (Enterprise Requirements Spec Generator)
> **输入来源**: brainstorming 采访结果 + deep-requirements 分析结果（强制）
> **输出格式**: Markdown (.md)
> **版本**: 3.1.0 (通用版 - 去除特定组织标识)
> **更新日期**: 2026-05-08

## 生成器职责

将 brainstorming 采访结果和 deep-requirements 分析结果整合为**符合企业级标准的通用需求分析规格说明书**。

**核心原则**：
1. 输出模板必须结构化、可测试、可直接用于开发和验收
2. 功能模块描述从4维度扩展到10维度（BR+流程图+伪代码+状态机+异常+NFR）
3. 接口定义必须是完整的API文档级别（Schema+错误码+示例）
4. 数据字典必须包含物理设计细节（12列+索引+ER图）
5. 验收标准采用 Gherkin 格式，支持自动化测试

---

## 原始模板章节清单（必须逐章对齐）

| 序号 | 一级章节 | 二级/三级子章节 | 原始格式特征 | v3.1 增强点 |
|------|---------|----------------|-------------|------------|
| 1 | 文档信息 | — | 7行表格，无二级 | ✅ 增加文档分类标签 |
| 2 | 引言 | 2.1 编写目的 / 2.2 项目背景 / 2.3 定义 / 2.4 参考资料 | 目的=段落；背景=列表；定义=术语表；参考=列表 | ✅ 增加利益相关者分析 |
| 3 | 任务概述 | 3.1 目标 / 3.2 用户特点 / 3.3 假定和约束 | 目标=量化指标；特点=角色画像；假定约束=分两类 | ✅ 增加成功标准和依赖系统 |
| 4 | 需求规定 | 4.1 功能需求 / 4.2 性能需求 / 4.3 可靠性 / 4.4 安全性 / 4.5 可维护性 | 功能=多级子模块 | 🚀 **重大增强: 10维度功能模块** |
| 5 | 运行环境规定 | 5.1 硬件环境 / 5.2 软件环境 / 5.3 接口 | 硬件/软件=表格；接口=4个子节 | 🚀 **重大增强: 完整API文档模板** |
| 6 | 数据描述 | 6.1 静态数据 / 6.2 动态数据 / 6.3 数据字典 | 字典=5列表格 | 🚀 **重大增强: 12列+索引+ER图** |
| 7 | 附录 | 7.1 用户确认 + 文档变更记录 | 确认=表格；变更=4列表格 | ✅ 增加术语表索引 |

---

## 输入数据映射

### 从 brainstorming 采访结果接收（基础数据）

| 模板变量 | 来源 | 提取规则 |
|----------|------|----------|
| `{project_name}` | 用户原始需求 / .harness/config.yaml | 项目名称（去除组织前缀） |
| `{doc_id}` | 自动生成 | 格式: REQ-{YYYYMMDD}-{NN} |
| `{version}` | 默认 V1.0 | 首次生成为 V1.0 |
| `{date}` | 当前日期 | YYYY-MM-DD 格式 |
| `{author}` | .harness/config.yaml 或默认值 | 编制人 |
| `{writing_purpose}` | brainstorming 原始需求 | 编写目的段落（含业务价值） |
| `{proposer}` | brainstorming Q1 或默认"业务部门" | 项目提出者 |
| `{developer}` | .harness/config.yaml 或默认"信息技术部" | 项目开发者 |
| `{user_unit}` | brainstorming Q1 或默认"相关业务部门" | 用户单位 |

### 从 deep-requirements 分析结果接收（深度增强数据）⭐ v3.1 核心

| 模板变量 | 来源模块 | 映射目标章节 | 提取规则 |
|----------|----------|-------------|----------|
| **业务目标与价值** | MODULE A BR-Q1 | 3.1 目标 | 补充量化目标条目（SMART原则） |
| **业务规则表** | MODULE A BR-Q2~Q5 | 4.1.N 功能模块 | 每个功能模块的业务规则 |
| **用户角色画像** | MODULE B UJ-Q1 | 3.2 用户特点 | 补充详细角色表（技能/动机/痛点） |
| **核心旅程路径** | MODULE B UJ-Q2 | 4.1.N 功能模块 | 用户旅程→功能场景映射 |
| **痛点与机会** | MODULE B UJ-Q3 | 3.1 目标 | 痛点→优化目标 |
| **成功指标** | MODULE B UJ-Q4 | 3.1 目标 + 验收标准 | KPI → 量化验收标准 |
| **异常场景清单** | MODULE C EC-Q1 | 4.1.N 异常处理 | 异常场景→异常码表 |
| **并发与竞争条件** | MODULE C EC-Q2 | 4.2 性能需求 + 5.3 接口 | 并发→性能指标+接口幂等性 |
| **数据边界与限制** | MODULE C EC-Q3 | 6.3 数据字典 | 边界→字段约束+取值范围 |

---

## 🚀 v3.1 增强输出模板

**⚠️ 重要：以下输出模板为通用企业版，无任何组织特定标识。变量用 `{...}` 标记，填充时替换为实际值。**

```markdown
#{project_name} 需求分析规格说明书

> **文档类型**: 企业级需求规格说明书 (Enterprise Requirements Specification)
> **文档编号**: {doc_id}
> **版本**: {version}
> **状态**: 草案 | 待评审 | 已批准
> **机密等级**: 内部公开 | 机密 | 绝密

---

## 1. 文档信息

| 项目     | 内容                                    |
| -------- | --------------------------------------- |
| 文档名称 | {project_name} 需求分析规格说明书       |
| 文档编号 | {doc_id}                                |
| 版本号   | {version}                               |
| 编制日期 | {date}                                  |
| 编制人   | {author}                                |
| 审核人   | {reviewer}                              |
| 批准人   | {approver}                              |
| 文档分类 | 需求分析 | 过程合规 | 技术规格          |

## 2. 引言

### 2.1 编写目的

{writing_purpose}

本文档旨在明确 **{project_name}** 的功能需求、性能需求和非功能需求，为系统设计、开发、测试和验收提供依据。

**预期读者**:
- 产品经理 / 业务分析师：确认需求完整性
- 架构师 / 技术负责人：指导技术方案设计
- 开发工程师：明确开发任务和实现细节
- 测试工程师：编写测试用例和验收标准
- 项目经理：评估工作量和风险

### 2.2 项目背景

- **项目名称**：{project_name}
- **项目提出者**：{proposer}
- **项目开发者**：{developer}
- **用户单位**：{user_unit}

**业务驱动因素**:
{business_drivers_list}

**当前痛点**:
{current_pain_points}

**预期收益**:
{expected_benefits}

### 2.3 定义

| 术语/缩写 | 全称 | 定义/说明 | 使用场景 |
|-----------|------|-----------|----------|
| {term_1} | {full_name_1} | {description_1} | {usage_context_1} |
| {term_2} | {full_name_2} | {description_2} | {usage_context_2} |
| ... | ... | ... | ... |

### 2.4 参考资料

| 序号 | 文档名称 | 版本 | 发布日期 | 来源 | 说明 |
|------|----------|------|----------|------|------|
| 1 | {reference_1} | {version} | {date} | {source} | {desc} |
| 2 | {reference_2} | {version} | {date} | {source} | {desc} |

### 2.5 利益相关者分析 ⭐ v3.1 新增

| 利益相关者 | 角色 | 关注点 | 影响力 | 参与度 | 沟通策略 |
|-----------|------|--------|--------|--------|----------|
| {stakeholder_1} | {role_1} | {concerns_1} | 高/中/低 | 高/中/低 | {strategy_1} |
| {stakeholder_2} | {role_2} | {concerns_2} | 高/中/低 | 高/中/低 | {strategy_2} |

## 3. 任务概述

### 3.1 目标

**项目愿景**:
{project_vision_statement}

**SMART 目标**:

| 目标ID | 目标描述 | 可衡量指标 | 目标值 | 当前基线 | 验证方式 | 优先级 |
|--------|----------|-----------|--------|---------|----------|--------|
| OBJ-001 | {goal_description} | {metric} | {target} | {baseline} | {verification_method} | P0/P1/P2 |
| OBJ-002 | {goal_description} | {metric} | {target} | {baseline} | {verification_method} | P0/P1/P2 |

**成功标准** (Definition of Done):
- [ ] {success_criteria_1}
- [ ] {success_criteria_2}
- [ ] {success_criteria_3}

**不包含范围 (Out of Scope)**:
- {out_of_scope_1}
- {out_of_scope_2}

### 3.2 用户特点

**用户角色画像**:

| 角色名称 | 典型用户 | 技术水平 | 使用频率 | 核心诉求 | 痛点 | 成功指标 |
|----------|----------|----------|----------|----------|------|----------|
| {role_1} | {persona_1} | 高/中/低 | 高频/中频/低频 | {need_1} | {pain_1} | {success_metric_1} |
| {role_2} | {persona_2} | 高/中/低 | 高频/中频/低频 | {need_2} | {pain_2} | {success_metric_2} |

**用户环境假设**:
- 设备类型: {device_types}
- 网络环境: {network_environment}
- 操作系统: {operating_systems}
- 并发用户规模: {concurrent_users_estimate}

### 3.3 假定和约束

**假定条件 (Assumptions)**:

| ID | 假设描述 | 影响 | 验证方式 | 风险等级 | 应对措施 |
|----|----------|------|----------|----------|----------|
| ASM-001 | {assumption_1} | {impact_1} | {verification_1} | 高/中/低 | {mitigation_1} |
| ASM-002 | {assumption_2} | {impact_2} | {verification_2} | 高/中/低 | {mitigation_2} |

**约束条件 (Constraints)**:

| ID | 约束描述 | 约束类型 | 来源 | 违反后果 | 缓解方案 |
|----|----------|----------|------|----------|----------|
| CST-001 | {constraint_1} | 技术/业务/法规/资源 | {source_1} | {consequence_1} | {workaround_1} |
| CST-002 | {constraint_2} | 技术/业务/法规/资源 | {source_2} | {consequence_2} | {workaround_2} |

**依赖系统**:

| 系统/服务 | 依赖类型 | 接口状态 | SLA要求 | 备选方案 |
|-----------|----------|----------|---------|----------|
| {dependency_1} | 同步/异步 | 就绪/待开发/第三方 | {sla_1} | {alternative_1} |

## 4. 需求规定

### 4.1 功能需求

#### 4.1.{N} {feature_module_name}

**功能标识**: F-{NNN}
**优先级**: P0 (Must Have) / P1 (Should Have) / P2 (Could Have) / P3 (Won't Have)
**复杂度**: 低/中/高
**预估工时**: {estimated_effort}

**功能描述**:
{feature_detailed_description}

**用户故事 (User Story)**:
> 作为 **{role}**，
> 我想要 **{action}**，
> 以便于 **{business_value}}**。

**业务规则 (Business Rules)** ⭐ v3.1 新增:

| 规则ID | 规则描述 | 触发条件 | 动作 | 例外处理 | 优先级 | 来源 |
|--------|----------|----------|------|----------|--------|------|
| BR-{N}-01 | {rule_description} | {trigger_condition} | {action} | {exception_handling} | P0/P1/P2 | {source} |
| BR-{N}-02 | {rule_description} | {trigger_condition} | {action} | {exception_handling} | P0/P1/P2 | {source} |

**前置条件 (Preconditions)**:
- {precondition_1}
- {precondition_2}
- 系统状态: {system_state_requirement}
- 用户权限: {permission_requirement}
- 数据准备: {data_prerequisite}

**后置条件 (Postconditions)**:
- {postcondition_1}
- {postcondition_2}
- 系统状态变更: {state_transition}
- 审计日志: {audit_log_entry}
- 通知触发: {notification_trigger}

**主流程 (Happy Path) - Mermaid 流程图** ⭐ v3.1 新增:

```mermaid
flowchart TD
    Start([开始]) --> Init[初始化{module_name}]
    Init --> Validate{{输入校验通过?}}
    Validate -->|Yes| Process[执行核心逻辑]
    Validate -->|No| ErrorHandle[返回错误]
    
    Process --> CheckCondition{{条件判断?}}
    CheckCondition -->|条件A| ActionA[动作A]
    CheckCondition -->|条件B| ActionB[动作B]
    CheckCondition -->|默认| ActionDefault[默认动作]
    
    ActionA --> CallService[调用外部服务]
    ActionB --> UpdateData[更新数据]
    ActionDefault --> QueryDB[查询数据库]
    
    CallService --> ParseResponse[解析响应]
    UpdateData --> GenerateResult[生成结果]
    QueryDB --> FormatOutput[格式化输出]
    
    ParseResponse --> Success({成功响应})
    GenerateResult --> Success
    FormatOutput --> Success
    
    ErrorHandle --> Fail({失败响应})
    
    style Start fill:#e1f5fe
    style Success fill:#c8e6c9
    style Fail fill:#ffcdd2
```

**输入参数详情** ⭐ v3.1 增强:

| 参数名 | 物理字段名 | 参数位置 | 类型 | 必填 | 约束条件 | 默认值 | 示例值 | 取值范围/枚举 | 说明 |
|--------|-----------|----------|------|------|----------|--------|--------|---------------|------|
| {param_1} | {physical_name_1} | Body/Query/Path/Header | String/Number/Boolean/Array/Object | Y/N | {constraints_1} | {default_1} | {example_1} | {enum_or_range_1} | {description_1} |
| {param_2} | {physical_name_2} | Body/Query/Path/Header | Date/DateTime/File | Y/N | {constraints_2} | {default_2} | {example_2} | {enum_or_range_2} | {description_2} |

**处理逻辑 (伪代码)** ⭐ v3.1 新增:

```
FUNCTION {function_name}(
    IN  {input_param_1}: {type_1},
    IN  {input_param_2}: {type_2},
    OUT result: {result_type},
    OUT error_code: ErrorCode,
    OUT error_message: String
)
BEGIN
    // Step 1: 参数校验
    VALIDATE {validation_rules}
        ON_FAILURE RETURN(E_INVALID_PARAM, "{error_msg_1}")

    // Step 2: 权限检查
    CHECK_PERMISSION(user, "{required_permission}")
        ON_FAILURE RETURN(E_FORBIDDEN, "权限不足")

    // Step 3: 业务规则引擎
    APPLY_BUSINESS_RULES("{rule_set_id}")
        CASE BR-{N}-01:
            IF {condition} THEN {action_1}
        CASE BR-{N}-02:
            IF {condition} THEN {action_2}

    // Step 4: 调用外部服务（如有）
    CALL_EXTERNAL("{service_name}", {request_payload})
        ON_TIMEOUT(RETRY 3 TIMES WITH BACKOFF)
        ON_ERROR LOG_AND_RETURN(E_SERVICE_UNAVAILABLE)

    // Step 5: 数据持久化
    SAVE_TO_DATABASE({entity}, {data})
        ON_DUPLICATE_KEY RETURN(E_CONFLICT, "数据已存在")

    // Step 6: 构建响应
    result = BUILD_SUCCESS_RESPONSE({data})
    error_code = SUCCESS
    error_message = ""
END FUNCTION
```

**输出参数详情** ⭐ v3.1 增强:

| 字段名 | 物理字段名 | 类型 | 约束 | 默认值 | 说明 | 示例 |
|--------|-----------|------|------|--------|------|------|
| {output_1} | {physical_output_1} | {type_1} | {constraint_1} | {default_1} | {desc_1} | {example_1} |
| {output_2} | {physical_output_2} | {type_2} | {constraint_2} | {default_2} | {desc_2} | {example_2} |

**异常处理 (Exception Handling)** ⭐ v3.1 新增:

| 异常码 | 异常名称 | 异常场景 | HTTP状态码 | 用户提示 | 日志级别 | 处理方式 | 是否重试 |
|--------|----------|----------|-----------|----------|----------|----------|----------|
| E-{N}-001 | {exception_name_1} | {scenario_1} | 400/401/403/404/409/422/500 | {user_message_1} | WARN/ERROR | {handling_1} | Yes/No |
| E-{N}-002 | {exception_name_2} | {scenario_2} | 400/401/403/404/409/422/500 | {user_message_2} | WARN/ERROR | {handling_2} | Yes/No |

**状态转换图 (State Machine)** ⭐ v3.1 新增:

```mermaid
stateDiagram-v2
    [*] --> Created: 初始化/提交请求
    Created --> Validating: 开始校验
    Validating --> Processing: 校验通过
    Validating --> Failed: 校验失败
    
    Processing --> CallingService: 调用外部服务
    Processing --> UpdatingData: 更新内部数据
    
    CallingService --> Success: 服务调用成功
    CallingService --> Retry: 服务超时/失败
    Retry --> CallingService: 重试(≤3次)
    Retry --> Failed: 重试耗尽
    
    UpdatingData --> Success: 数据更新成功
    UpdatingData --> Failed: 数据操作失败
    
    Success --> [*]: 完成
    Failed --> [*]: 终止(带错误信息)
    
    note right of Success
        触发通知/事件
    end note
    
    note right of Failed
        记录审计日志
        发送告警(如需要)
    end note
```

**非功能性需求 (本模块专属)** ⭐ v3.1 新增:

| NFR类别 | 指标 | 目标值 | 测量方法 | 验证时机 |
|---------|------|--------|----------|----------|
| 性能 | 响应时间(P99) | ≤ {response_time_ms}ms | APM监控 | 每次发布前 |
| 性能 | 吞吐量 | ≥ {throughput_tps} TPS | 压力测试 | 每季度 |
| 安全 | 数据加密 | AES-256 / TLS 1.3 | 安全扫描 | 每次代码变更 |
| 可用性 | 故障恢复时间 | ≤ {rto_minutes} 分钟 | 混沌工程 | 每半年 |
| 可维护性 | 圈复杂度 | ≤ {complexity_threshold} | SonarQube | 每次提交 |

---

### 4.2 性能需求

| 性能指标 | 指标描述 | 目标值 | 测试条件 | 测量方法 | 验证标准 | 优先级 |
|----------|----------|--------|----------|----------|----------|--------|
| 响应时间 | API 平均响应时间 | ≤ {avg_response_time}ms | 并发{concurrency}用户 | JMeter/Gatling | P99 ≤ 目标值的150% | P0 |
| 响应时间 | API P99 响应时间 | ≤ {p99_response_time}ms | 峰值负载 | APM工具 | 99%请求达标 | P0 |
| 吞吐量 | 系统吞吐量 | ≥ {throughput} TPS | 稳态负载 | 压测工具 | 持续10分钟稳定 | P0 |
| 并发用户数 | 支持并发用户数 | ≥ {concurrent_users} | 正常业务时段 | 负载生成器 | 错误率<0.1% | P1 |
| 资源利用率 | CPU使用率 | ≤ {cpu_usage}% | 峰值负载 | 监控系统 | 无持续100% | P2 |
| 资源利用率 | 内存使用率 | ≤ {memory_usage}MB | 稳态运行 | 监控系统 | 无内存泄漏 | P2 |

**特殊场景性能要求**:

| 场景 | 描述 | 性能要求 | 备注 |
|------|------|----------|------|
| {scenario_1} | {desc_1} | {requirement_1} | {note_1} |
| {scenario_2} | {desc_2} | {requirement_2} | {note_2} |

### 4.3 可靠性需求

**可用性目标**:

| 时间维度 | 可用率目标 | 允许停机时间/年 | 测量方式 | 惩罚机制 |
|----------|-----------|----------------|----------|----------|
| 年度可用性 | ≥ {availability_percent}% ({nines}个9) | ≤ {downtime_hours}小时 | 监控系统统计 | SLA惩罚条款 |
| 月度可用性 | ≥ {monthly_availability}% | ≤ {monthly_downtime}小时 | 月度报告 | 内部考核 |

**故障恢复**:

| 故障类型 | RTO (恢复时间目标) | RPO (数据丢失目标) | 恢复策略 | 自动化程度 |
|----------|-------------------|-------------------|----------|------------|
| 单节点故障 | ≤ {rto_single}分钟 | = 0 (无丢失) | 主备切换 | 全自动 |
| 机房故障 | ≤ {rto_dc}小时 | ≤ {rpo_dc}分钟 | 异地容灾 | 半自动 |
| 数据损坏 | ≤ {rto_corrupt}小时 | ≤ {rpo_corrupt}分钟 | 从备份恢复 | 手动 |

**数据一致性**:
- 强一致性场景: {strong_consistency_scenarios}
- 最终一致性场景: {eventual_consistency_scenarios}
- 一致性保证机制: {consistency_mechanism}

### 4.4 安全性需求

**认证与授权**:

| 安全域 | 要求 | 实现方式 | 强制性 |
|--------|------|----------|--------|
| 身份认证 | {auth_requirement} | OAuth2/JWT/multi-factor | 必须 |
| 会话管理 | {session_mgmt_requirement} | Token过期/刷新机制 | 必须 |
| 权限控制 | {authorization_requirement} | RBAC/ABAC | 必须 |
| API安全 | {api_security_requirement} | Rate limiting/CORS | 必须 |

**数据保护**:

| 数据类型 | 加密方式 | 存储加密 | 传输加密 | 密钥管理 | 合规要求 |
|----------|----------|----------|----------|----------|----------|
| 敏感个人信息 | AES-256-GCM | 透明加密 | TLS 1.3 | KMS/HSM | GDPR/PIPL |
| 支付信息 | PCI-DSS标准 | P2PE | TLS 1.3 | HSM | PCI-DSS |
| 业务密钥 | RSA-2048+/AES-256 | 信封加密 | TLS 1.3 | KMS轮换 | 内部规范 |

**安全审计**:
- 操作日志保留: {log_retention_period}年
- 敏感操作告警: {alert_rules}
- 定期安全扫描: {scan_frequency}（漏洞扫描/渗透测试/代码审计）
- 安全事件响应: {incident_response_sla}

### 4.5 可维护性需求

**代码质量门槛**:

| 指标 | 目标值 | 测量工具 | 强制性 |
|------|--------|----------|--------|
| 代码覆盖率 | ≥ {coverage_target}% | Jest/Vitest/Cobertura | P0 |
| 圈复杂度平均值 | ≤ {complexity_target} | ESLint/SonarQube | P1 |
| 重复代码率 | ≤ {duplication_target}% | SonarQube | P2 |
| 技术债务密度 | ≤ {tech_debt_target}min | SonarQube | P2 |

**可观测性**:

| 维度 | 要求 | 实现方式 |
|------|------|----------|
| 日志 | 结构化JSON日志 | ELK/Loki栈 |
| 指标 | Prometheus格式 | Grafana看板 |
| 链路追踪 | OpenTelemetry | Jaeger/Zipkin |
| 告警 | 多通道通知 | PagerDuty/钉钉/企微 |

**文档要求**:
- API文档自动生成: Swagger/OpenAPI 3.0
- 架构决策记录(ADR): 重大技术决策需记录
- 变更日志: 符合Keep a Changelog规范

## 5. 运行环境规定

### 5.1 硬件环境

| 设备类型 | 配置项 | 最低配置 | 推荐配置 | 数量 | 备注 |
|----------|--------|----------|----------|------|------|
| 应用服务器 | CPU | {cpu_min}核 | {cpu_rec}核 | {count}台 | {note_1} |
| 应用服务器 | 内存 | {ram_min}GB | {ram_rec}GB | | {note_2} |
| 应用服务器 | 磁盘 | {disk_min}GB SSD | {disk_rec}GB NVMe | | {note_3} |
| 数据库服务器 | CPU | {db_cpu_min}核 | {db_cpu_rec}核 | {db_count}台 | {db_note} |
| 负载均衡器 | 吞吐量 | {lb_min}Mbps | {lb_rec}Mbps | {lb_count}台 | 高可用部署 |

### 5.2 软件环境

| 软件组件 | 版本要求 | 许可类型 | 替代方案 | 备注 |
|----------|----------|----------|----------|------|
| 操作系统 | {os_version} | 商业/开源 | {alt_os} | {os_note} |
| 运行时环境 | {runtime_version} | 开源 | {alt_runtime} | {runtime_note} |
| 数据库 | {db_version} | 商业/开源 | {alt_db} | {db_note} |
| 中间件/消息队列 | {middleware_version} | 开源 | {alt_mw} | {mw_note} |
| 缓存 | {cache_version} | 开源 | {alt_cache} | {cache_note} |
| 容器编排 | {container_version} | 开源 | - | K8s/Docker Swarm |

### 5.3 接口

#### 5.3.1 用户接口

**Web端**:
- 支持浏览器: {browser_support_list}
- 分辨率适配: {resolution_requirements}
- 无障碍访问: WCAG {wcag_level} 级别（如果适用）
- 国际化: 支持语言 {languages_list}

**移动端** (如果有):
- 平台支持: iOS {ios_min_version}+ / Android {android_min_version}+
- 屏幕尺寸适配: {screen_sizes}
- 离线能力: {offline_capabilities}

#### 5.3.2 硬件接口

| 硬件设备 | 接口类型 | 协议 | 数据格式 | 连接方式 | 备注 |
|----------|----------|------|----------|----------|------|
| {hardware_1} | {interface_type_1} | {protocol_1} | {format_1} | {connection_1} | {hw_note_1} |

#### 5.3.3 软件接口 (API Specification) ⭐ v3.1 重大增强

##### API-{NNN}: {api_name}

**基本信息**:

| 属性 | 值 |
|------|-----|
| API 名称 | {api_name} |
| API 分类 | {category} (CRUD/Batch/Query/Command/Event) |
| 端点 | `{method} {path_template}` |
| 认证方式 | JWT_Bearer / OAuth2 / API_Key / mTLS |
| 幂等性 | Yes / No (Idempotency Key: {idempotency_key}) |
| 超时时间 | Request: {request_timeout}ms / Read: {read_timeout}ms |
| 缓存策略 | No-Cache / ClientCache({ttl}s) / ServerCache({ttl}s) |
| 速率限制 | {rate_limit} requests/{window} (per user/api_key) |
| 版本管理 | URL Path (/v1/) / Header (Accept-Version) / Content Negotiation |

**Request Headers**:

| Header | 必填 | 示例值 | 说明 |
|--------|------|--------|------|
| Content-Type | ✅ | application/json; charset=UTF-8 | 请求体编码 |
| Accept | ✅ | application/json | 响应体期望格式 |
| Authorization | ✅ | Bearer eyJhbGciOiJIUzI1NiIs... | 认证令牌 |
| X-Request-ID | 推荐 | uuid-v4 | 请求追踪ID（用于问题排查） |
| X-Idempotency-Key | 条件 | uuid-v4 | 幂等键（POST/PUT时推荐） |
| Accept-Language | 可选 | zh-CN | 响应语言偏好 |
| If-None-Match | 可选 | "{etag}" | 条件请求（缓存验证） |

**Path Parameters** (如果有):

| 参数名 | 类型 | 必填 | 约束 | 示例值 | 说明 |
|--------|------|------|------|--------|------|
| {path_param_1} | string/integer/uuid | Y | regex/pattern/range | {example_1} | {desc_1} |

**Query Parameters** (如果有):

| 参数名 | 类型 | 必填 | 默认值 | 约束 | 示例值 | 说明 |
|--------|------|------|--------|------|--------|------|
| {query_param_1} | string/integer/boolean/date/enum | Y/N | {default_1} | {constraint_1} | {example_1} | {desc_1} |
| pagination | object | N | {page:1, size:20} | page≥1, 1≤size≤100 | {"page":2,"size":50} | 分页参数 |

**Request Body Schema (JSON Schema Draft-07)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "{schema_id}",
  "title": "{title}",
  "description": "{description}",
  "type": "object",
  "required": ["field_1", "field_2"],
  "additionalProperties": false,
  "properties": {
    "field_1": {
      "type": "string",
      "description": "{field_desc_1}",
      "minLength": {min_length_1},
      "maxLength": {max_length_1},
      "pattern": "^{regex_pattern_1}$",
      "format": "{format_email_uuid_uri_date_etc}",
      "example": "{example_value_1}"
    },
    "field_2": {
      "type": "integer",
      "description": "{field_desc_2}",
      "minimum": {min_value_2},
      "maximum": {max_value_2},
      "exclusiveMinimum": false,
      "exclusiveMaximum": false,
      "example": {example_value_2}
    },
    "field_3": {
      "type": "array",
      "description": "{field_desc_3}",
      "items": {
        "$ref": "#/properties/nested_object_type"
      },
      "minItems": {min_items_3},
      "maxItems": {max_items_3},
      "uniqueItems": true
    },
    "nested_object": {
      "type": "object",
      "required": ["nested_field_1"],
      "properties": {
        "nested_field_1": {
          "type": "string",
          "enum": ["value_a", "value_b", "value_c"]
        }
      }
    }
  }
}
```

**Request Body Example**:

```json
// 成功请求示例
{
  "field_1": "example_value",
  "field_2": 123,
  "nested_object": {
    "nested_field_1": "value_a"
  },
  "array_field": [
    {"item": "first"},
    {"item": "second"}
  ]
}

// 错误请求示例（展示常见错误）
{
  "field_1": "",  // ❌ 错误: minLength violation
  "field_2": -1   // ❌ 错误: minimum violation
}
```

**Response Schema**:

**Success Response (HTTP 200/201)**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["code", "message", "data", "requestId", "timestamp"],
  "properties": {
    "code": {
      "type": "integer",
      "enum": [0],
      "description": "业务码，0表示成功"
    },
    "message": {
      "type": "string",
      "description": "人类可读的成功消息"
    },
    "data": {
      "oneOf": [
        { "$ref": "#/definitions/success_response_type_1" },
        { "$ref": "#/definitions/success_response_type_2" },
        { "type": "null" }  // DELETE 操作可能返回 null
      ]
    },
    "pagination": {
      "type": "object",
      "description": "分页信息（仅列表接口）",
      "properties": {
        "page": { "type": "integer" },
        "size": { "type": "integer" },
        "total": { "type": "integer" },
        "totalPages": { "type": "integer" }
      }
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "description": "请求追踪ID，用于问题排查"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "服务器响应时间 (ISO 8601)"
    }
  },
  "definitions": {
    "success_response_type_1": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "status": { "type": "string", "enum": ["active", "inactive"] }
      }
    }
  }
}
```

**Success Response Example**:

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {
    "id": "req_abc123",
    "createdAt": "2026-05-08T14:30:00Z",
    "status": "active"
  },
  "requestId": "req-trace-uuid-5678",
  "timestamp": "2026-05-08T14:30:01.234Z"
}
```

**Error Response Schema (统一错误格式)**:

```json
{
  "type": "object",
  "required": ["code", "error", "message", "requestId", "timestamp"],
  "properties": {
    "code": {
      "type": "integer",
      "description": "错误业务码 (非0)",
      "enum": [400001, 401001, 403001, 404001, 409001, 422001, 500001]
    },
    "error": {
      "type": "string",
      "description": "机器可读的错误类型",
      "enum": ["INVALID_PARAM", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "UNPROCESSABLE", "INTERNAL_ERROR"]
    },
    "message": {
      "type": "string",
      "description": "人类可读的错误消息（可展示给用户）"
    },
    "details": {
      "type": "array",
      "description": "错误详情列表（参数校验等场景）",
      "items": {
        "type": "object",
        "properties": {
          "field": { "type": "string" },
          "code": { "type": "string" },
          "message": { "type": "string" }
        }
      }
    },
    "requestId": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "string", "format": "date-time" },
    "traceId": { "type": "string", "description": "分布式追踪ID（可选）" }
  }
}
```

**Error Response Examples**:

```json
// 400 Bad Request - 参数校验失败
{
  "code": 400001,
  "error": "INVALID_PARAM",
  "message": "请求参数不合法",
  "details": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "邮箱格式不正确"
    },
    {
      "field": "age",
      "code": "OUT_OF_RANGE",
      "message": "年龄必须在18-120之间"
    }
  ],
  "requestId": "req-err-uuid-1234",
  "timestamp": "2026-05-08T14:30:02Z"
}

// 401 Unauthorized
{
  "code": 401001,
  "error": "UNAUTHORIZED",
  "message": "未认证或令牌已过期，请重新登录",
  "requestId": "req-auth-uuid-5678",
  "timestamp": "2026-05-08T14:30:03Z"
}

// 500 Internal Server Error
{
  "code": 500001,
  "error": "INTERNAL_ERROR",
  "message": "服务器内部错误，请稍后重试",
  "requestId": "srv-err-uuid-9012",
  "timestamp": "2026-05-08T14:30:04Z",
  "traceId": "trace-abc-def"
}
```

**HTTP Status Code 与错误码映射**:

| HTTP Status | 错误码 | 错误类型 | 场景 | 用户提示 | 是否可重试 |
|-------------|--------|----------|------|----------|-----------|
| 400 Bad Request | 400001 | INVALID_PARAM | 参数校验失败/格式错误 | "参数{field}不合法：{reason}" | No |
| 400 Bad Request | 400002 | INVALID_JSON | JSON 解析失败 | "请求体格式错误" | No |
| 401 Unauthorized | 401001 | UNAUTHORIZED | 未认证/Token缺失/过期 | "请先登录" | No |
| 401 Unauthorized | 401002 | TOKEN_EXPIRED | Token 过期 | "登录已过期，请重新登录" | No (需重新获取Token) |
| 403 Forbidden | 403001 | FORBIDDEN | 无权限 | "您没有权限执行此操作" | No |
| 404 Not Found | 404001 | NOT_FOUND | 资源不存在 | "{resource}未找到" | No |
| 409 Conflict | 409001 | CONFLICT | 资源冲突/状态冲突 | "{conflict_reason}" | No (需客户端修正) |
| 422 Unprocessable | 422001 | UNPROCESSABLE | 语义错误（校验通过但业务规则拒绝） | "{business_rule_violation}" | No |
| 429 Too Many Requests | 429001 | RATE_LIMITED | 频率限制 | "操作过于频繁，请{seconds}秒后重试" | Yes (after {seconds}s) |
| 500 Internal Error | 500001 | INTERNAL_ERROR | 服务器未知错误 | "系统繁忙，请稍后重试" | Yes (exponential backoff) |
| 502 Bad Gateway | 502001 | UPSTREAM_ERROR | 上游服务错误 | "上游服务不可用" | Yes (retry with backoff) |
| 503 Service Unavailable | 503001 | SERVICE_UNAVAILABLE | 服务过载/维护中 | "服务暂时不可用，请稍后重试" | Yes (retry after {delay}s) |

**调用示例 (cURL)**:

```bash
# 成功调用示例
curl -X {method} '{base_url}{path}' \
  -H 'Content-Type: application/json; charset=UTF-8' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'X-Request-ID: $(uuidgen)' \
  -d '{
    "field_1": "example_value",
    "field_2": 123,
    "nested_object": {
      "nested_field_1": "value_a"
    }
  }' \
  --write-out '\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n'

# 预期输出:
# HTTP Status: 200
# Response Time: 0.234s
# {
#   "code": 0,
#   "message": "操作成功",
#   "data": { ... },
#   ...
# }

# 错误调用示例（参数缺失）
curl -X {method} '{base_url}{path}' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer invalid_token' \
  -d '{}'

# 预期输出:
# HTTP Status: 400
# {
#   "code": 400001,
#   "error": "INVALID_PARAM",
#   "message": "缺少必填参数: field_1, field_2",
#   ...
# }
```

**SDK/客户端代码示例 (TypeScript)**:

```typescript
import { ApiClient } from './api-client';

const api = new ApiClient({
  baseURL: '{base_url}',
  timeout: {request_timeout},
});

try {
  const response = await api.request<{ 
    field_1: string;
    createdAt: string;
  }>({
    method: '{method_lower}',
    url: '{path}',
    data: {
      field_1: 'example',
      field_2: 123,
    },
    headers: {
      'X-Idempotency-Key': generateUUID(),
    },
  });

  console.log('Success:', response.data);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.code}: ${error.message}`);
    if (error.details) {
      error.details.forEach(detail => {
        console.log(`  - ${detail.field}: ${detail.message}`);
      });
    }
  }
}
```

#### 5.3.4 通信接口

| 通信协议 | 用途 | 端口 | 加密方式 | 认证方式 | 备注 |
|----------|------|------|----------|----------|------|
| HTTPS | Web/API服务 | 443 | TLS 1.3 | JWT/OAuth2 | 对外暴露 |
| gRPC | 微服务间通信 | {grpc_port} | mTLS | Service Account | 内部使用 |
| WebSocket | 实时推送 | {ws_port} | WSS | JWT | 通知/聊天 |
| AMQP/Kafka | 消息队列 | {mq_port} | TLS SASL | Service Account | 异步事件 |

## 6. 数据描述

### 6.1 静态数据

| 数据类别 | 数据项 | 初始值 | 更新频率 | 维护方式 | 数据量估算 |
|----------|--------|--------|----------|----------|-----------|
| 配置参数 | {config_item_1} | {initial_value_1} | {update_freq_1} | 管理后台/配置文件 | ~{count_1}条 |
| 字典数据 | {dict_item_1} | {initial_value_2} | {update_freq_2} | 数据库/Redis | ~{count_2}条 |
| 模板数据 | {template_item_1} | {initial_value_3} | {update_freq_3} | 文件存储/OSS | ~{count_3}条 |

### 6.2 动态数据

| 数据类别 | 数据流 | 产生方 | 消费方 | 数据量/日 | 保留周期 | 存储介质 |
|----------|--------|--------|--------|-----------|----------|----------|
| 业务数据 | {data_flow_1} | {producer_1} | {consumer_1} | ~{volume_1}/日 | {retention_1} | MySQL/PG |
| 日志数据 | {data_flow_2} | {producer_2} | {consumer_2} | ~{volume_2}/日 | {retention_2} | ES/ClickHouse |
| 临时数据 | {data_flow_3} | {producer_3} | {consumer_3} | ~{volume_3}/日 | {retention_3} | Redis |

### 6.3 数据字典 ⭐ v3.1 重大增强

#### 6.3.{N} {entity_name} 实体

**实体说明**: {entity_description}
**实体标识**: {entity_id_pattern} (如: USR_{uuid}, ORD_{timestamp}_{seq})
**生命周期状态**: {lifecycle_states}

**字段定义**:

| 序号 | 字段名 | 物理字段名 | 数据类型 | 长度/精度 | 必填 | 主键/外键/索引 | 约束条件 | 默认值 | 取值范围/枚举 | 示例值 | 业务含义 | 敏感级别 |
|------|--------|-----------|----------|-----------|------|---------------|----------|--------|---------------|--------|----------|----------|
| 1 | {field_name_1} | {physical_name_1} | VARCHAR/INT/DECIMAL/DATETIME/TEXT/JSON/BOOLEAN | {length}/{precision} | Y/N | PK/FK/IDX-{idx_name} | UNIQUE, NOT NULL, CHECK(...), DEFAULT | {default_val_1} | {enum_or_range_1} | {example_1} | {biz_meaning_1 | PUBLIC/INTERNAL/CONFIDENTIAL/SECRET |
| 2 | {field_name_2} | {physical_name_2} | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

**索引设计**:

| 索引名 | 索引类型 | 包含字段 | 唯一 | 说明 | 使用场景 |
|--------|----------|----------|------|------|----------|
| pk_{table}_id | BTREE | (id) | ✅ | 主键索引 | 精确查询 |
| idx_{table}_{field} | BTREE | ({field}) | Yes/No | {purpose} | {query_scenario} |
| idx_{table}_{field1}_{field2} | COMPOSITE | ({field_1}, {field_2}) | No | 组合索引 | 多条件筛选 |
| ft_{table}_{search_field} | FULLTEXT | ({search_field}) | No | 全文索引 | 搜索功能 |

**ER 关系图 (Mermaid)**:

```mermaid
erDiagram
    {ENTITY_A } ||--o{ {ENTITY_B } : "1:N {relationship_desc}"
    {ENTITY_A } ||--|| {ENTITY_C } : "1:1 {relationship_desc}"
    {ENTITY_B } o{--o{ {ENTITY_D } : "M:N {relationship_desc}"

    {ENTITY_A } {
        varchar id PK "{pk_desc}"
        varchar name "{name_desc}"
        datetime created_at "{created_desc}"
        datetime updated_at "{updated_desc}"
    }

    {ENTITY_B } {
        varchar id PK
        varchar fk_{entity_a}_id FK "{fk_desc}"
        varchar status "{status_desc}"
        jsonb data "{data_desc}"
    }

    {ENTITY_C } {
        varchar id PK
        varchar config_key UK "{key_desc}"
        text config_value "{value_desc}"
    }
}
```

**数据约束规则**:

| 约束类型 | 约束名称 | 涉及字段 | 约束表达式 | 违规处理 |
|----------|----------|----------|-----------|----------|
| CHECK | chk_{table}_{rule} | ({fields}) | {expression} | 拒绝插入/更新 |
| UNIQUE | uk_{table}_{fields} | ({fields}) | - | 拒绝重复 |
| FOREIGN KEY | fk_{table}_{ref_table} | ({local_fields}) | REFERENCES {ref_table}({ref_fields}) ON DELETE {action} | 级联删除/拒绝/置空 |
| NOT NULL | nn_{table}_{field} | ({field}) | - | 拒绝NULL |

**数据迁移/初始化脚本** (如果有):

```sql
-- 表结构DDL
CREATE TABLE {table_name} (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    {field_1} {type_1} {constraints_1},
    {field_2} {type_2} {constraints_2},
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at TIMESTAMP(3) NULL,  -- 软删除标记
    INDEX idx_{table}_{field_1} ({field_1}),
    INDEX idx_{table}_{field_2} ({field_2})
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='{table_comment}';

-- 初始化数据
INSERT INTO {table_name} (id, {field_1}, {field_2}, created_at) VALUES
    ('{init_id_1}', '{init_val_1}', '{init_val_2}', NOW()),
    ('{init_id_2}', '{init_val_1}', '{init_val_2}', NOW());
```

## 7. 附录

### 7.1 术语表索引

| 术语 | 定义位置 | 首次出现章节 | 相关概念 |
|------|----------|-------------|----------|
| {term_1} | 2.3 定义 | {section_ref} | {related_terms} |
| {term_2} | 2.3 定义 | {section_ref} | {related_terms} |

### 7.2 用户确认

| 角色 | 姓名 | 签字/电子确认 | 日期 | 意见/备注 |
|------|------|---------------|------|-----------|
| 业务代表 | _________________ | ☐ 确认 / ☐ 有保留意见 | YYYY-MM-DD | |
| 技术负责人 | _________________ | ☐ 确认 / ☐ 有保留意见 | YYYY-MM-DD | |
| 项目经理 | _________________ | ☐ 确认 / ☐ 有保留意见 | YYYY-MM-DD | |
| 质量保证 | _________________ | ☐ 确认 / ☐ 有保留意见 | YYYY-MM-DD | |

**确认声明**:
- [ ] 我已审阅本文档，理解其中的需求定义和约束条件
- [ ] 本文档准确反映了业务需求和用户期望
- [ ] 我同意以此文档作为后续设计和开发的基准

### 7.3 文档变更记录

| 版本 | 日期 | 修改人 | 审批人 | 变更类型 | 变更内容摘要 | 影响范围 |
|------|------|--------|--------|----------|--------------|----------|
| V1.0 | {date} | {author} | {approver} | 初始版本 | 创建初始需求规格说明书 | 全文 |
| V1.1 | {date} | {author} | {approver} | 增量修订 | {change_summary_1} | {affected_sections} |

### 7.4 验收标准总表 (Gherkin Format) ⭐ v3.1 新增

#### 功能验收标准

@feature_{feature_module_id}
Feature: {feature_module_name}
  作为 {actor_role}
  我想要 {action}
  以便于 {business_value}

  @happy_path @p0
  Scenario Outline: 正常流程 - {scenario_name}
    Given {given_precondition_with_test_data}
     When {action_with_parameters}
     Then {expected_result_with_assertion}

    Examples:
      | TC-ID | Test Case Description | Input Data | Expected Output | Priority |
      | TC-{NNN}-001 | {tc_desc_1} | {input_data_1} | {expected_output_1} | P0 |
      | TC-{NNN}-002 | {tc_desc_2} | {input_data_2} | {expected_output_2} | P0 |

  @edge_case @p1
  Scenario Outline: 边缘场景 - {edge_case_type}
    Given {edge_case_precondition}
     When {trigger_action}
     Then {expected_behavior}

    Examples:
      | TC-ID | Edge Case Type | Input Data | Expected Result |
      | TC-{NNN}-010 | {edge_type_1} | {edge_input_1} | {edge_result_1} |

  @negative @p1
  Scenario Outline: 异常输入 - {negative_scenario}
    Given {invalid_input_condition}
     When {action}
     Then {error_response_validation}

    Examples:
      | TC-ID | Invalid Input | Expected Error Code | Expected Message Pattern |
      | TC-{NNN}-020 | {invalid_input_1} | E-{NNN}-001 | {error_pattern_1} |

  @business_rule @p1
  Scenario: 业务规则验证 - {rule_name}
    Given {rule_precondition}
     When {action_that_triggers_rule}
     Then {rule_enforcement_result}

#### 非功能验收标准

| NFR-ID | 类别 | 指标名称 | 目标值 | 测试方法 | 测试工具 | 通过标准 | 优先级 | 验证时机 |
|--------|------|----------|--------|----------|----------|----------|--------|----------|
| NFR-001 | 性能 | API P99 响应时间 | ≤ {target}ms | 负载测试 | JMeter/Gatling/k6 | 99%请求≤目标 | P0 | 每次发布 |
| NFR-002 | 性能 | 系统吞吐量 | ≥ {target} TPS | 压力测试 | 同上 | 稳定达到目标 | P0 | 每季度 |
| NFR-003 | 性能 | 并发用户支持 | ≥ {target} 人 | 并发测试 | 同上 | 错误率<0.1% | P1 | 每次发布 |
| NFR-004 | 可靠性 | 系统可用性 | ≥ {target}% ({nines}个9) | 混沌工程 | Chaos Monkey/Litmus | 达到SLA | P1 | 每半年 |
| NFR-005 | 可靠性 | 故障恢复时间(RTO) | ≤ {target}分钟 | 故障演练 | 手动+自动化 | 达到目标 | P2 | 每季度 |
| NFR-006 | 安全 | 漏洞扫描 | 0 High/Critical | 安全扫描 | OWASP ZAP/Snyk/Trivy | 通过扫描 | P0 | 每次+每周 |
| NFR-007 | 安全 | 依赖包漏洞 | 0 Known Vulnerability | 依赖审计 | npm audit/safety/audit | 通过审计 | P0 | 每次 |
| NFR-008 | 可维护性 | 代码覆盖率 | ≥ {target}% | 单元测试 | Jest/Vitest/Cobertura | 全局达标 | P1 | 每次提交 |
| NFR-009 | 可维护性 | 圈复杂度平均 | ≤ {target} | 静态分析 | ESLint/SonarQube/es-complexity | 所有函数达标 | P2 | 每次提交 |
| NFR-010 | 可维护性 | 技术债务密度 | ≤ {target}min | 代码质量 | SonarQube | 在阈值内 | P2 | 每周 |
| NFR-011 | 可观测性 | 日志结构化率 | 100% | 日志检查 | 自定义脚本 | 所有日志为JSON | P1 | 每次提交 |
| NFR-012 | 可观测性 | Trace完整性 | ≥ {target}% | 链路检查 | Jaeger/Zipkin UI | 关键链路完整 | P2 | 每次发布 |

---

**文档结束**

> **生成信息**:
> - 生成器版本: Enterprise Requirements Spec Generator v3.1.0
> - 生成时间: {generation_timestamp}
> - 数据来源: brainstorming + deep-requirements (12问全量)
> - 模板遵循: 通用企业级需求规格说明书标准
> - 下一步: 进入 Plan 阶段 → writing-plans skill
