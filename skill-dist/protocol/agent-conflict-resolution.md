# Agent 间冲突解决协议

> 版本: 1.0.0
> 适用于: Harness Expert Team 模式（多 Agent 并行执行）

## 概述

在 Expert Team 模式下，多个 Agent 可能同时操作同一个项目，产生文件冲突、状态不一致等问题。本协议定义了预防、检测和解决冲突的完整机制。

## 一、预防机制

### 1.1 文件归属矩阵

每个微任务在分配时必须声明其修改的文件列表（file ownership）：

```
Task ID | 修改文件 | 读取文件
T1.1    | src/auth/login.ts, src/auth/login.test.ts | src/types.ts
T1.2    | src/api/auth-api.ts, src/api/auth-api.test.ts | src/types.ts
```

**规则**：
- 同一文件的写权限同一时间只能分配给一个 Agent
- 只读文件可以跨 Agent 共享
- Team Lead 在分配任务前检查文件归属矩阵

### 1.2 TaskList 依赖管理

使用 `TaskList` 的 `addBlockedBy` 机制避免 Agent 间冲突：

```
TaskCreate({subject: "T1.1: 实现登录组件", description: "修改 src/auth/login.ts"})
TaskCreate({subject: "T2.1: 实现登录页面（依赖 T1.1）", description: "修改 src/pages/login.ts", addBlockedBy: ["T1.1-task-id"]})
```

**规则**：
- 如果 T2 需要读取 T1 产出的文件，T2 addBlockedBy T1
- 如果 T1 和 T2 修改不同文件且无依赖，可以并行
- Team Lead 负责正确设置 addBlockedBy 关系

### 1.3 变更范围约束

每个 Agent 的 prompt 中必须包含变更范围约束：

```
## 变更范围约束
- 只允许修改以下文件: {文件列表}
- 禁止修改任务范围外的任何文件
- 禁止修改配置文件（package.json, tsconfig.json 等）除非明确指示
```

## 二、检测机制

### 2.1 文件冲突检测

Team Lead 在 Wave 完成后检测文件冲突：

```bash
# 检查同一文件是否被多个 Agent 修改
git diff --name-only | sort | uniq -d
```

### 2.2 合并冲突检测

```bash
# 检查 git 合并冲突标记
grep -rn "<<<<<<< HEAD" src/ || echo "No merge conflicts"
```

### 2.3 测试冲突检测

```bash
# 运行全量测试，检查并行修改是否导致测试失败
npm test
```

## 三、解决策略

### 3.1 文件写冲突

| 场景 | 解决方式 | 执行者 |
|------|---------|-------|
| 两个 Agent 试图修改同一文件 | 将任务串行化（addBlockedBy），先到先改 | Team Lead |
| 一个 Agent 修改了另一个 Agent 依赖的文件 | 触发依赖 Agent 重新读取文件并调整 | Team Lead |
| Agent 修改范围超出任务约束 | SendMessage 警告，要求回退超范围修改 | Team Lead |

### 3.2 状态不一致

| 场景 | 解决方式 | 执行者 |
|------|---------|-------|
| Agent 基于过时文件内容工作 | SendMessage 通知文件已变更，要求重新读取 | Team Lead |
| Agent 间对同一接口定义不一致 | 由 Architect Agent 仲裁，统一接口定义 | Architect |
| 测试因并行修改而失败 | 触发 systematic-debugging Agent 排查 | Team Lead |

### 3.3 语义冲突

| 场景 | 解决方式 | 执行者 |
|------|---------|-------|
| Implementer A 和 B 实现了相同功能 | 保留更优实现，删除重复代码 | Reviewer |
| 两个 Agent 引入了冲突的依赖 | 由 Architect 仲裁选择 | Architect |
| 代码风格不一致 | 以项目 eslint/prettier 配置为准 | Reviewer |

## 四、冲突升级路径

```
Level 1: Agent 自动调整（基于 SendMessage 协商）
    ↓ 失败
Level 2: Team Lead 介入（重新编排任务，调整 addBlockedBy）
    ↓ 失败
Level 3: Architect 仲裁（技术决策）
    ↓ 失败
Level 4: 用户决策（人工介入）
```

## 五、最佳实践

1. **小粒度任务**：每个任务只修改 1-3 个文件，降低冲突概率
2. **明确接口边界**：依赖文件以只读方式共享，接口文件先定义后实现
3. **Wave 内检查**：每个 Wave 完成后 Team Lead 检查冲突
4. **渐进式合并**：每个 Agent 完成后立即检查，不要等全部完成
5. **回滚准备**：每个 Agent 开始前 git stash 或创建临时分支

## 六、与 Gate 检查的协作

冲突解决完成后，必须重新执行相关 Gate 检查：

| 冲突类型 | 需重新执行的 Gate |
|---------|-----------------|
| 文件写冲突 | build_gate + test_gate |
| 接口定义冲突 | build_gate + test_gate |
| 测试失败 | test_gate |
| 代码风格冲突 | review_gate |
