---
id: systematic-debugging
name: "Systematic Debugging — 系统化调试"
description: "When the user mentions debug, find root cause, bug investigation, test failure, or needs to systematically locate and fix bugs, ALWAYS use this skill. Enforces four-stage investigation: evidence collection, pattern analysis, hypothesis testing, and verified fix."
stage: [build, test]
roles: [implementer, tester]
pattern: four-stage-investigation
mandatory: false
depends: []
version: "3.0"
---

# Systematic Debugging — 系统化调试

> Superpowers 工程方法论层：找不到根因就不能修

## 核心铁律

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**

- 禁止凭猜测修改代码
- 禁止"试试看"式修复
- 必须先找到根因，再实施修复

## 触发条件

- 发现 Bug 或异常行为
- 测试失败需要排查
- 用户报告问题

## 四阶段流程

### Stage 1：根因调查 🔍

1. **收集信息**
   - 完整错误信息 / 堆栈追踪
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境（浏览器、操作系统）

2. **定位范围**
   - 错误发生在哪个组件？
   - 涉及哪些 state / props？
   - 是渲染问题还是逻辑问题？

3. **形成调查记录**
   ```markdown
   ## Bug 调查记录
   - **现象**：...
   - **复现步骤**：1. 2. 3.
   - **预期行为**：...
   - **实际行为**：...
   - **初步定位**：文件:行号
   ```

### Stage 2：模式分析 🔬

1. **找错误模式**
   - 是否与特定操作顺序相关？
   - 是否与特定组件类型相关？
   - 是否与特定风格相关？

2. **追踪代码路径**
   - 从用户操作 → 事件处理 → state 变更 → 重新渲染
   - 每一步的数据是什么？

3. **排除不可能原因**
   - 如果改 A 没影响 → A 不是原因
   - 如果改 B 问题消失 → B 可能是原因

### Stage 3：假设测试 🧪

1. **列出所有假设**
   - 假设 1：数据结构递归操作丢失节点
   - 假设 2：异步状态不同步（闭包陷阱）
   - 假设 3：reducer 返回了新引用但值未变

2. **逐一验证**
   - 为每个假设设计最小验证测试
   - 先验证最可能的假设
   - 记录验证结果

3. **确认根因**
   - 根因必须能解释所有观察到的现象
   - 如果不能完全解释，继续调查

### Stage 4：实施修复 🔧

1. **先写失败测试**
   - 测试应能复现 Bug
   - 运行测试确认失败（RED）

2. **实施修复**
   - 只修根因，不做"顺手"改动
   - 运行测试确认通过（GREEN）

3. **回归验证**
   - 运行全部测试
   - 确认无新问题引入

## 常见 Bug 模式（从 .harness/memory/ 读取项目特定 Bug 模式）

| 模式 | 症状 | 常见根因 |
|------|------|---------|
| 递归数据结构问题 | 操作后节点丢失/重复 | 递归边界条件遗漏、children 展开遗漏 |
| 异步状态不同步 | 操作后状态未更新 | 闭包陷阱、回调时序问题 |
| 选中/焦点状态残留 | 删除后仍显示选中 | 状态清理遗漏 |
| 条件分支遗漏 | 特定场景功能缺失 | 条件判断不完整 |
| 引用比较失败 | 判断逻辑异常 | 浅比较 vs 深比较混淆 |


## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 无法复现 Bug | 收集环境信息和日志 | 增加日志后重新尝试复现 |
| 假设验证失败 | 记录排除原因，转向下一个假设 | 基于新线索重新假设 |
| 修复引入新 Bug | 回退修复，重新分析 | 缩小修复范围后重试 |
| 调试信息不足 | 添加更多日志和断点 | 收集更多信息后重新分析 |


## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 调试报告 | `.harness/debug/<bug-id>.md` | Markdown | 四阶段调试过程记录 |
| 根因分析 | 调试报告内嵌 | Markdown | 根因和修复方案 |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| Superpowers: TDD | Bug 修复遵循 TDD：先写失败测试再修 |
| GSTACK: /browse | 前端问题 → /browse 看真实页面效果 |
| GSTACK: /investigate | 需要浏览器级别调试（DOM、网络、控制台） |
| verification-before-completion | 修复完成 → 收集验证证据 |
