---
id: subagent-driven-dev
name: "Subagent Driven Development — 子代理驱动开发"
description: "When the user mentions subagent, parallel implementation, role isolation, assign tasks to agents, or needs to coordinate multiple AI agents for development, ALWAYS use this skill. Provides task decomposition, dependency graph building, and parallel execution with independent review."
stage: build
roles: [coordinator]
pattern: role-isolation
mandatory: true
depends: [tdd]
version: "3.1"
compatibility:
  tools: [Task, Read, Write, SearchCodebase]
  dependencies: ["node >= 18", "npm"]
---

# Subagent-Driven Development — 子代理驱动开发（精简版）

> **设计模式**：Role Isolation（角色隔离）+ Parallel Execution（并行执行）
> **核心思想**：实现者和审查者绝不在同一个上下文中，确保客观性

## 核心原则

1. **角色隔离**：实现者(Implementer)和审查者(Reviewer)必须在不同的子代理上下文中运行
2. **单一职责**：每个子代理专注一个微任务，避免上下文过载
3. **审查独立**：代码审查由独立子代理完成，不受实现者影响
4. **主代理协调**：Coordinator只负责任务调度和结果汇总，不直接写代码
5. **依赖感知**：自动识别任务依赖关系，按拓扑序执行

## 触发条件

- 使用 GSD 波次编排执行开发任务（推荐）
- 任务列表中有多个可并行的独立子任务
- 需要强化代码审查（双重保障：子代理审查 + Staff 审查）
- 任务复杂度高，单一上下文难以完成

## 角色定义与职责矩阵

| 角色 | 职责 | 能做 | 不能做 |
|------|------|------|--------|
| **Coordinator** | 任务拆分、调度、汇总 | 分配任务、合并结果、最终决策 | 直接写实现代码、直接审查代码 |
| **Implementer** | 写代码 + 写测试 | 编写实现代码、编写测试用例 | 审查自己的代码、修改其他任务的代码 |
| **Reviewer** | 代码质量检查 | 审查代码、输出审查报告 | 修改被审查的代码 |

## 任务分配算法

> 完整算法实现见 [references/assignment-algorithms.md](references/assignment-algorithms.md)

### 算法步骤

```
Step 1: 构建依赖图（DAG）
    ↓
Step 2: 拓扑排序确定执行顺序
    ↓
Step 3: 识别可并行层（同一层的任务可同时执行）
    ↓
Step 4: 根据复杂度和优先级分配给 Implementer 子代理
    ↓
Step 5: 每层完成后，启动 Reviewer 子代理审查该层所有产出
    ↓
Step 6: 汇总结果，处理冲突，进入下一层
```

### 分配策略

1. **基于优先级**：P0 优先分配给最有经验的 Implementer
2. **基于复杂度均衡**：负载最轻的 agent 优先分配
3. **技能匹配**：选择技能匹配度最高的 agent

## 完整工作流（6步）

### Step 1：主代理解析任务列表

Coordinator 从 writing-plans 的产出中读取任务列表。

### Step 2：构建依赖图 + 拓扑排序

> 实现细节见 [references/assignment-algorithms.md](references/assignment-algorithms.md)

### Step 3：启动 Implementer 子代理（并行执行同层任务）

为每个任务启动独立的 Implementer 子代理，遵循 TDD 流程：
1. RED: 先写失败的测试
2. GREEN: 写最少代码让测试通过
3. REFACTOR: 在测试保护下优化

### Step 4：启动 Reviewer 子代理

审查维度（按顺序检查）：
1. **正确性**（40%）：逻辑、边界条件、运行时错误
2. **类型安全**（20%）：TypeScript 严格模式、any 使用
3. **可维护性**（20%）：函数长度、命名、重复代码
4. **性能**（10%）：重渲染、循环优化、内存使用
5. **安全性**（10%）：XSS/注入风险、敏感数据处理

### Step 5：主代理处理审查结果 + 冲突解决

> 冲突解决机制见 [references/conflict-resolution.md](references/conflict-resolution.md)

处理决策：
- **pass**: 接受实现
- **fix**: 创建修复任务，分配给新的 Implementer
- **reject**: 完全重新实现

### Step 6：汇总结果 + 进入下一层

```
for each layer in layers:
  executeLayer(layer)
  reviewLayer(results)
  processReviewResults(reviews)
  if hasFixes:
    addFixesToNextLayer()
```

## 冲突解决机制

> 完整机制见 [references/conflict-resolution.md](references/conflict-resolution.md)

### 场景 1：两个 Implementer 修改同一文件

**检测**: 通过文件修改记录检测冲突
**解决**: 预防 > 自动合并 > 人工协调

### 场景 2：Reviewers 给出矛盾的建议

**策略**: 按严重程度和出现频率排序，选择最严格的建议

### 场景 3：Implementer 超时或失败

**处理**: 终止子代理 → 分析原因 → 重新分配

## 失败处理（8个场景）

| 失败场景 | 检测方式 | 自动处理 | 恢复策略 |
|---------|---------|---------|----------|
| Implementer 超时 | 执行时间 >15分钟 | 终止子代理 | 降低任务粒度后重新分配 |
| Reviewer 发现 P0 问题 | 审查报告含 P0 | 创建修复任务 | 新 Implementer 修复 → 重新审查 |
| 子代理输出文件缺失 | 文件系统检查 | 标记为未完成 | 确认路径后重新执行 |
| 循环依赖 | 拓扑排序失败 | 报错并停止 | 移除或重构依赖关系 |
| 上下文溢出 | Token 使用 >80% | 拆分子任务 | 减少每个任务的输入上下文 |
| 角色混淆 | Implementer == Reviewer | 拒绝分配 | 强制使用不同子代理 ID |
| 并行执行冲突 | 文件锁竞争 | 序列化执行 | 将冲突任务移到下一层 |
| 审查标准不一致 | Reviewer 评分差异 >30分 | 采用最严格标准 | 更新审查 Checklist 对齐 |

## 产出物（6个关键交付物）

| 产出物 | 路径模板 | 格式 | 必要性 |
|-------|---------|------|-------|
| 实现代码 | 任务指定的输出文件 | TypeScript | **必需** |
| 测试代码 | 与实现对应的 .test.ts(x) | TypeScript+Jest | **必需** |
| 审查报告 | `.harness/reviews/subagent-<taskId>-<timestamp>.md` | Markdown | **必需** |
| 执行日志 | `.harness/metrics/subagent-<runId>.jsonl` | JSONL | **必需** |
| 冲突报告 | `.harness/metrics/conflicts-<waveId>.md` | Markdown | 推荐 |
| 汇总报告 | `.harness/reports/wave-<waveId>-summary.md` | Markdown | **必需** |

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 | 不通过处理 |
|-------|---------|---------|-----------|
| 所有子任务完成 | 任务状态检查 | 100% 任务标记为"completed" | 检查失败任务，重新分配 |
| 审查全部通过 | 审查报告检查 | 无 P0 未修复问题，P1 ≤2 个 | 返回 Implementer 修复 |
| 测试覆盖 | 测试运行结果 | 新增代码测试覆盖率 ≥ 80% | 补充边界测试 |
| 角色隔离 | 子代理 ID 对比 | 实现者和审查者不是同一子代理 | 强制更换审查者 |
| 无文件冲突 | 冲突报告检查 | 0 个未解决的文件冲突 | 手动合并或重构任务 |

## 与其他 Skill 的协作矩阵

| 协作 Skill | 协作时机 | 数据流向 |
|-----------|---------|---------|
| **GSD** | GSD 提供波次编排 | Wave 定义 → 任务分配 |
| **TDD** | 每个 Implementer 内部 | TDD 规范 → 测试先行 |
| **writing-plans** | 任务来源 | 任务列表 → 分配算法 |
| **staff-review** | 所有子代理审查完成后 | 子代理审查报告 → Staff 审查 |
| **systematic-debugging** | 实现或审查失败时 | 错误现象 → 根因分析 |
| **gating** | Wave 完成后 | 执行结果 → 门禁判定 |

## 配置与调优

```yaml
# .harness/config.yaml 中的 subagent 部分
subagent:
  max_implementers_per_wave: 4
  max_reviewers_per_wave: 4
  timeout_minutes: 15
  retry_count: 1
  context_size: medium
  
  quality_gates:
    min_review_score: 70
    max_p1_issues: 2
    test_coverage_threshold: 80
  
  conflict_resolution:
    auto_merge_enabled: true
    manual_merge_threshold: 3
```

## 性能优化建议

### 1. 任务粒度控制

**好的任务粒度**（5-15分钟可完成）：
- "实现用户登录 API endpoint"
- "创建 LoginForm 组件"
- "添加 JWT token 验证中间件"

**太粗**（应拆分为 5-8 个子任务）：
- "实现完整的用户认证系统"

**太细**（应合并到相关任务中）：
- "定义 User 接口的 email 字段类型"

### 2. 缓存机制

- **依赖安装缓存**：多个任务共享 node_modules
- **类型定义缓存**：共享 TypeScript 编译缓存
- **测试环境复用**：同一层的测试共享测试数据库实例

### 3. 增量执行

- 支持从失败的层继续执行，不必重跑已完成的层
- 使用 checkpoint 机制保存每层的执行状态

## 🔍 子代理输出质量门禁（v3.1 新增）

> **⚠️ 重要**: 从 v3.1 起，子代理输出的代码**不再被无条件信任**。每个任务完成后必须通过自动化质量检查才能合并到主分支。

> 完整的质量检查流水线（5步）、质量指标收集、合并决策矩阵、技术债务管理和异常情况处理见 [references/quality-pipeline.md](references/quality-pipeline.md)

**核心流程**：
```
Task Complete → Step 1(类型检查) → Step 2(代码风格) → Step 3(测试验证) → Step 4(指标收集) → Step 5(合并决策)
```

**合并决策摘要**：

| ERROR 数 | WARNING 数 | 决策 |
|----------|-----------|------|
| 0 | 任意 | ✅ APPROVED |
| 0 | ≤ 3 | ✅ APPROVED_WITH_DEBT |
| 0 | > 3 | ⚠️ CONDITIONAL_APPROVAL |
| 1-2 | 任意 | 🔴 RETRY_ONCE |
| ≥ 3 | 任意 | 🔴🔴 REJECT_AND_ESCALATE |

## 下一步行动

Subagent-Driven Development 完成后：

1. **有失败任务？** → 分析原因，调整任务粒度或补充依赖
2. **全部通过？** → 进入 `/qa` 或 `/verification-before-completion`
3. **需要更强审查？** → 进入 `/review` (Staff 工程师级审查)
4. **准备发布？** → 运行 `/ship` 进行最终门禁检查

