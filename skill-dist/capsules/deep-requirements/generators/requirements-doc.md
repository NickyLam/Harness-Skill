# Requirements Document Generator — REQUIREMENTS.md 生成器

> **所属 Capsule**: deep-requirements
> **生成器类型**: 产出物生成器 (Output Generator)
> **输入来源**: MODULE A (business-rules) + MODULE B (user-journey) + MODULE C (edge-cases)
> **输出格式**: Markdown (.md)

## 生成器职责

将三个分析模块的输出整合为**完整的、结构化的 REQUIREMENTS.md 文档**，包含：

| 章节 | 来源模块 | 内容 |
|------|----------|------|
| 1. 业务规则深度拆解 | A | 目标 + 规则表 + 依赖图 |
| 2. 用户旅程分析 | B | 角色画像 + 旅程图 + 状态机 |
| 3. 边缘 Case 分析 | C | 异常清单 + 边界限制 |
| 4. Gherkin 规格 | A+B+C | 索引（详见 .feature 文件）|
| 附录 | 全部 | 采访记录 + 审批记录 |

---

## 输入数据格式

### 从 MODULE A 接收

```javascript
{
  module: "business-rules",
  businessGoal: { from BR-Q1 },
  rules: [
    { id, name, description, trigger, exceptions, priority, stability }
  ],
  ruleDependencyGraph: "mermaid graph TD code"
}
```

### 从 MODULE B 接收

```javascript
{
  module: "user-journey",
  personas: [
    { role, goal, permissions, painPoints, scenarios }
  ],
  journeyMap: "mermaid journey code",
  stateMachine: "mermaid stateDiagram-v2 code"
}
```

### 从 MODULE C 接收

```javascript
{
  module: "edge-cases",
  edgeCases: [
    { id, type, description, trigger, expectedBehavior, strategy, priority }
  ],
  dataBoundaries: [
    { field, type, min, max, defaultValue, format, validationTiming }
  ]
}
```

---

## 输出模板

```markdown
# Deep Requirements Analysis: {功能名称}

> **生成时间**: {timestamp}
> **分析模式**: 企业级深度 (Enterprise Deep)
> **采访完成度**: 12/12 (100%)
> **审批状态**: ✅ 已审批
> **生成器版本**: requirements-doc v1.0

---

## 1. 业务规则深度拆解

### 1.1 核心业务目标
{businessGoal}

### 1.2 业务规则表

| 规则ID | 规则名称 | 描述 | 触发条件 | 例外情况 | 优先级 | 稳定性 |
|--------|----------|------|----------|----------|--------|--------|
{rules_table_rows}

### 1.3 规则依赖关系图

```mermaid
{ruleDependencyGraph}
```

---

## 2. 用户旅程分析

### 2.1 用户角色画像

| 角色 | 目标 | 权限 | 核心场景 | 痛点 | 成功指标 |
|------|------|------|----------|------|----------|
{personas_table_rows}

### 2.2 核心用户旅程图

```mermaid
{journeyMap}
```

### 2.3 完整流程状态机

```mermaid
{stateMachine}
```

---

## 3. 边缘 Case 分析

### 3.1 异常场景清单

| EC-ID | 场景类型 | 描述 | 触发条件 | 预期行为 | 处理策略 | 优先级 |
|-------|----------|------|----------|----------|----------|--------|
{edge_cases_table_rows}

### 3.2 数据边界限制

| 数据项 | 类型 | 最小值 | 最大值 | 默认值 | 格式要求 | 校验时机 |
|--------|------|--------|--------|--------|----------|----------|
{data_boundaries_table_rows}

---

## 4. Gherkin 可执行规格

详见 `features/{feature-name}.feature`

**场景概览**:
- @p0 @smoke: 核心 happy path ({n} 个场景)
- @p1 @regression: 业务规则验证 ({n} 个场景)
- @p1 @regression: 例外情况处理 ({n} 个场景)
- @p2 @edge-case: 边缘 case ({n} 个场景)
- @p2 @concurrency: 并发处理 ({n} 个场景)

---

## 附录

### A. 采访记录索引
- BR-Q1 ~ BR-Q5: `.harness/checkpoints/deep-br-q{1-5}.md`
- UJ-Q1 ~ UJ-Q4: `.harness/checkpoints/deep-uj-q{1-4}.md`
- EC-Q1 ~ EC-Q3: `.harness/checkpoints/deep-ec-q{1-3}.md`

### B. 审批记录
- 业务规则表审批: ✅ {timestamp}
- 用户旅程图审批: ✅ {timestamp}
- 边缘 case 清单审批: ✅ {timestamp}
- Gherkin 规格审批: ✅ {timestamp}

### C. 版本历史
| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | {date} | 初始版本 | Deep Requirements Generator |
```

---

## 生成规则

1. **Mermaid 嵌入**: 所有 Mermaid 代码块必须使用标准语法，可通过 [Mermaid Live Editor](https://mermaid.live) 验证
2. **表格完整性**: 所有表格不得有空行或占位符，必须填充实际数据
3. **引用一致性**: 附录中的文件路径必须与实际生成的文件一致
4. **编码规范**: 使用 UTF-8 编码，换行符为 LF
5. **长度控制**: 单行不超过 120 个字符（Mermaid 代码除外）

---

## 校验清单

生成完成后必须验证：

- [ ] 文件可被 Markdown 解析器正确解析
- [ ] 所有 Mermaid 代码块语法正确
- [ ] 所有表格格式正确（表头+分隔符+数据行）
- [ ] 文件中的引用路径与实际文件一致
- [ ] 无 TBD、TODO 或占位符
- [ ] 文件大小合理（建议 < 50KB）
