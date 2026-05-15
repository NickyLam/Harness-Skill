---
id: edge-cases
name: "Edge Cases — 边缘 Case 分析"
stage: spec
roles: [product-owner]
pattern: deep-interview-module
mandatory: false
depends: [deep-requirements]
version: "3.0"
description: "When the user mentions edge cases, boundary conditions, or needs to identify exceptional scenarios, ALWAYS use this skill. Error handling, concurrency, and boundary analysis (sub-module of deep-requirements)."
---

# Edge Cases Analysis — 边缘 Case 分析模块

> **所属 Capsule**: deep-requirements
> **模块类型**: 分析模块 (Analysis Module)
> **问题数量**: 3 个深度采访问题
> **检查点类型**: TYPE_D (DEEP_INTERVIEW_CHECKPOINT)
> **输出格式**: 异常场景清单 + 数据边界限制表

## 模块职责

对用户需求进行**边缘 case 的系统性识别**，覆盖异常流程、并发场景、数据边界：

| 维度 | 关注点 | 对应问题 | 产出 |
|------|--------|----------|------|
| **ERROR** | 异常场景识别 | EC-Q1 | 异常场景清单 |
| **CONCURRENCY** | 并发与竞争条件 | EC-Q2 | 并发策略 |
| **BOUNDARY** | 数据边界与限制 | EC-Q3 | 边界限制表 |

---

## 执行流程

### 前置条件

- [ ] MODULE A (business-rules) 已完成
- [ ] MODULE B (user-journey) 已完成
- [ ] deep-requirements 主协调器已传递控制权

---

### 🔴 CHECKPOINT [DEEP-EC-Q1] — 异常场景识别

```
检查点 ID: DEEP-EC-Q1
类型: TYPE_D (DEEP_INTERVIEW_CHECKPOINT)
阶段: Deep Requirements / Module C / Question 1 of 3
持久化: .harness/checkpoints/deep-ec-q1.md
```

**Step 1.1**: 输出标记
```
📍 CHECKPOINT [DEEP-EC-Q1] — 边缘 Case Q1: 异常场景识别
📊 进度: [██████████░░] 75% (9/12 总体, 0/3 模块C)
```

**Step 1.2**: 调用 AskUserQuestion

```javascript
AskUserQuestion({
  questions: [{
    header: "EC-Q1: 异常",
    question: "哪些异常情况需要处理？如网络中断、服务不可用、数据格式错误等。",
    options: [
      {
        label: "🟢 基础异常",
        description: "网络超时、服务器错误、输入校验等常见异常"
      },
      {
        label: "🟡 业务异常",
        description: "库存不足、余额不足、权限不足等业务相关异常"
      },
      {
        label: "🔴 全覆盖",
        description: "需要系统性处理所有可能的异常场景（含极端情况）"
      },
      {
        label: "✏️ 详细列举",
        description: "我想列出具体的异常场景"
      }
    ],
    multiSelect: false
  }]
})
```

**Step 1.3~1.5**: BLOCK → PERSIST → 进入 EC-Q2

---

### 🔴 CHECKPOINT [DEEP-EC-Q2] — 并发与竞争条件

```javascript
AskUserQuestion({
  questions: [{
    header: "EC-Q2: 并发",
    question: "是否存在并发使用场景？多个用户同时操作同一资源时如何处理？",
    options: [
      { label: "❌ 无并发", description: "单用户操作，不存在并发冲突" },
      { label: "⚠️ 低并发", description: "偶发并发，乐观锁或最后写入胜出即可" },
      { label: "🔴 高并发", description: "高频并发访问，需要悲观锁、队列、事务隔离等机制" },
      { label: "✏️ 详细说明", description: "我想描述具体的并发场景" }
    ],
    multiSelect: false
  }])
})
```

---

### 🔴 CHECKPOINT [DEEP-EC-Q3] — 数据边界与限制

```javascript
AskUserQuestion({
  questions: [{
    header: "EC-Q3: 边界",
    question: "数据的边界条件和限制是什么？如最大长度、数值范围、列表上限等。",
    options: [
      { label: "📋 标准限制", description: "常规的技术限制，如字符串255字符、整数范围" },
      { label: "🏢 业务限制", description: "业务规则定义的限制，如单笔最大金额、每日操作次数" },
      { label: "🔒 合规/安全限制", description: "法律法规或安全策略要求的限制，如 GDPR、PCI-DSS" },
      { label: "✏️ 详细说明", description: "我有特定的边界条件需要说明" }
    ],
    multiSelect: false
  }])
})
```

---

## 产出物：边缘 Case 分析模板

### 1. 异常场景清单

```markdown
# 边缘 Case 分析结果

## 异常场景清单

| EC-ID | 场景类型 | 描述 | 触发条件 | 预期行为 | 处理策略 | 优先级 |
|-------|----------|------|----------|----------|----------|--------|
| EC-001 | 网络异常 | API 调用超时 | 网络中断 >5s | 显示重试按钮 + 缓存数据 | 重试机制 | P0 |
| EC-002 | 数据异常 | 输入格式错误 | 非法字符/超出范围 | 实时校验 + 错误提示 | 前端校验 | P0 |
| EC-003 | 并发冲突 | 同时编辑同一资源 | 双人同时保存 | 乐观锁 + 合并提示 | 乐观锁 | P1 |
| ... | ... | ... | ... | ... | ... | ... |

### 异常分类统计

| 类型 | 数量 | 占比 |
|------|------|------|
| 网络/基础设施 | {n} | {x}% |
| 数据/输入验证 | {n} | {x}% |
| 业务逻辑 | {n} | {x}% |
| 并发/竞态 | {n} | {x}% |
| 安全/权限 | {n} | {x}% |
```

### 2. 数据边界限制表

```markdown
## 数据边界限制

| 数据项 | 类型 | 最小值 | 最大值 | 默认值 | 格式要求 | 校验时机 |
|--------|------|--------|--------|--------|----------|----------|
| {字段名} | string | 1 char | 255 chars | "" | UTF-8, 无特殊字符 | 前端+后端 |
| {字段名} | number | 0 | 999999.99 | 0 | 2位小数, 正数 | 后端 |
| {字段名} | array | 0 | 100 items | [] | 唯一性约束 | 后端 |
| ... | ... | ... | ... | ... | ... | ... |
```

---

## 完成标志

- [ ] DEEP-EC-Q1: ✅ COMPLETED
- [ ] DEEP-EC-Q2: ✅ COMPLETED
- [ ] DEEP-EC-Q3: ✅ COMPLETED
- [ ] 异常场景清单已生成
- [ ] 数据边界限制表已生成

**全部完成 → 返回主协调器 → 进入 PHASE 5: 深度产出审批**

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 用户无法列举边缘场景 | 提供行业常见边缘场景模板 | 参考模板补充后重新分析 |
| 边缘场景过于复杂 | 拆分为多个子场景分别处理 | 逐个分析后合并结果 |
| 与已有需求冲突 | 标注冲突并提交决策 | 确认优先级后重新整理 |
