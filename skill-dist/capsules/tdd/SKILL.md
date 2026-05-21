---
id: tdd
name: Test-Driven Development (TDD)
description: "When the user mentions test-driven development, write tests first, red-green-refactor, TDD, or needs to implement any feature with tests, ALWAYS use this skill. Enforces RED→GREEN→REFACTOR workflow with strict test-first discipline."
stage: build
roles: [Developer, Tester]
pattern: RedGreenRefactor
mandatory: true
depends: []
version: "3.0"
min_lines: 50
compatibility:
  tools: [AskUserQuestion, Read, Write, SearchCodebase, RunCommand]
  dependencies: ["node >= 18", "npm", "jest"]
---

# Test-Driven Development (TDD)

> Superpowers 工程方法论层：强制测试先行，保障代码质量

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 编写新功能代码 | 进入实现阶段自动触发 | 任何新功能开发必须遵循 TDD 流程 |
| 修改现有代码 | 变更现有逻辑时自动触发 | 修改前先写测试保护已有行为 |
| Bug 修复 | systematic-debugging 定位 bug 后触发 | 先写失败测试复现 bug，再修复 |
| 重构操作 | code-simplification 确定简化方案后触发 | 测试作为重构的安全网 |

**不触发场景**：纯类型定义添加、配置文件修改、文档更新、样式微调等不涉及行为变更的操作。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 设计文档 | `.harness/specs/` 下的设计文档 | 必需 | 明确验收标准，指导测试编写 |
| 实施计划 | `.harness/plans/` 下的计划文件 | 必需 | 微任务拆分，确定当前任务边界 |
| 项目测试框架配置 | `vitest.config.ts` / `jest.config.ts` | 必需 | 测试运行器已配置可用 |
| 目标文件上下文 | `src/` 中相关源码 | 必需 | 了解被测代码的接口和依赖 |

**前置检查**：如果项目未配置测试框架，应先引导用户完成测试框架初始化。

## 核心铁律

1. **先写测试，再写实现代码** — 这是铁律，不是建议
2. **测试不通过 → 只写最少代码让其通过** — 不做多余实现
3. **测试通过 → 才允许重构** — 重构不改变行为
4. **任何在测试之前写好的代码都会被删除** — 如果发现先写了实现，必须回退

## 🔴 强制执行机制（v3.1 新增）

> **⚠️ 重要**: 以下规则从 v3.1 起为**强制性要求**，不再仅是指导性建议。违反将触发质量门禁拦截。

> 完整的执行顺序锁、阶段质量门槛、自动化质量门禁、违规处理机制和时间监控见 [references/tdd-quality-gates.md](references/tdd-quality-gates.md)

## 红绿循环流程

```
🔴 RED    → 写一个失败的测试（描述期望行为）
🟢 GREEN  → 写最少代码让测试通过（不做多余设计）
🔵 REFACTOR → 重构优化（保持测试通过，不改变行为）
```

### 每个循环的时间目标：≤ 5 分钟

### RED 阶段详细 Checklist

在编写任何实现代码之前，完成以下步骤：

- [ ] **明确测试意图**：这个测试要验证什么具体行为？（一句话描述）
- [ ] **确定被测单元**：函数名 / Hook 名 / 组件名是什么？
- [ ] **准备测试数据**：Arrange 阶段的输入数据（正常值、边界值）
- [ ] **编写断言**：Assert 阶段的期望输出（精确匹配 / 包含 / 抛异常）
- [ ] **运行确认失败**：执行测试，确认测试确实失败（RED 状态验证）
  - 如果测试直接通过 → 说明测试无效或代码已存在，需要调整
  - 失败信息应清晰表达「期望 X 但得到 Y」
- [ ] **测试命名合规**：遵循命名规范（见下方「测试命名规范指南」）

**RED 阶段禁止事项**：
- ❌ 查看已有的实现代码来编写测试（会导致测试验证的是代码而非需求）
- ❌ 编写会直接通过的测试（假测试）
- ❌ 在一个 it() 中验证多个独立行为

### GREEN 阶段详细 Checklist

测试失败后，用最少的代码让它通过：

- [ ] **只写让当前测试通过的代码**：不多不少，恰好满足断言
- [ ] **允许硬编码**：GREEN 阶段可以硬编码返回值（REFACTOR 再泛化）
- [ ] **跳过错误处理**：先走 happy path，异常处理在后续循环中补充
- [ ] **运行确认通过**：执行测试，确认从 RED → GREEN
- [ ] **不做超前设计**：不引入抽象层、不提前做通用化

**GREEN 阶段禁止事项**：
- ❌ 一次写完所有功能的完整实现
- ❌ 引入不必要的抽象或设计模式
- ❌ 修改其他测试的行为

### REFACTOR 阶段详细 Checklist

测试通过后，在不改变行为的前提下优化代码：

- [ ] **运行全量测试**：确认 REFACTOR 前所有测试都通过
- [ ] **识别坏味道**：重复代码、过长函数、魔法值、过深嵌套
- [ ] **小步重构**：每次只改一处，改完立即跑测试
- [ ] **保持测试通过**：每步重构后测试必须仍然全部通过
- [ ] **消除硬编码**：将 GREEN 阶段的硬编码替换为真实逻辑
- [ ] **最终全量验证**：重构完成后运行完整测试套件

**REFACTOR 阶段禁止事项**：
- ❌ 在重构中添加新功能（新功能 = 新的 RED 循环）
- ❌ 同时修改多处（难以定位回归原因）
- ❌ 删除或弱化测试来「适配」重构后的代码

## 常见反模式列表

| 反模式 | 描述 | 危害 | 正确做法 |
|-------|------|------|---------|
| **假 TDD** | 先写代码再补测试，假装是 TDD | 测试验证的是代码而非需求，无法发现设计问题 | 严格遵守 RED→GREEN→REFACTOR 顺序 |
| **过度测试实现细节** | 测试私有方法、内部状态、具体实现路径 | 重构时测试频繁断裂，维护成本高 | 测试公共行为和可观察效果，不测内部结构 |
| **Mock 过度** | Mock 所有依赖包括简单工具函数 | 测试变成空壳，无法捕获真实集成问题 | 只 Mock 外部不可控依赖（网络、数据库、时间） |
| **大步测试** | 一个测试覆盖整个功能模块的所有分支 | 失败时难以定位问题，反馈循环太长 | 每个测试验证一个行为点，循环 ≤5 分钟 |
| **忽略失败测试** | 测试偶尔失败但标记为 skip 或注释掉 | 掩盖真正的回归问题 | 每个失败都必须立即修复或理解原因 |
| **测试与实现耦合** | 测试依赖具体的类名、方法签名、内部数据结构 | 重构即破坏测试 | 通过公共接口测试，使用行为驱动的方式断言 |
| **覆盖率崇拜** | 为达到覆盖率数字写无意义测试 | 假安全感，浪费维护精力 | 每个测试必须有明确的验证目的 |

## 与 subagent-driven-development 的关系

当 TDD 在 subagent-driven-development 的微任务框架内执行时，有以下特殊约定：

### 微任务中的 TDD 执行模型

```
微任务 T3: 实现 useAuth Hook
├── 子任务 T3.1: 写 useAuth 的 RED 测试 (test-generator)
│   ├── 输入：T3 的验收标准和 API 设计
│   ├── 输出：src/__tests__/hooks/useAuth.test.ts
│   └── 验证：测试运行结果为 RED（N 个失败）
├── 子任务 T3.2: 写 GREEN 实现
│   ├── 输入：T3.1 的失败测试 + 接口定义
│   ├── 输出：src/hooks/useAuth.ts
│   └── 验证：测试运行结果为 GREEN（全部通过）
└── 子任务 T3.3: REFACTOR（可选）
    ├── 输入：T3.2 的通过代码
    ├── 输出：优化后的 src/hooks/useAuth.ts
    └── 验证：测试依然全部通过
```

### 关键约束

- 每个 RED/GREEN/REFACTOR 步骤对应独立的子代理调用
- 子代理之间的上下文传递通过文件系统（测试文件 → 实现文件）
- 子代理不得访问其他子代理的任务范围之外的代码
- 波次编排器负责确保 T3.1 在 T3.2 之前执行

## 测试策略

### 测试分层

| 层级 | 覆盖范围 | 工具 | 优先级 |
|------|---------|------|--------|
| **单元测试** | hooks、utils、reducer 逻辑 | Vitest / Jest | P0 |
| **组件测试** | UI 组件渲染和交互 | @testing-library/react | P1 |
| **集成测试** | 跨组件流程、端到端场景 | @testing-library/react + user-event | P2 |

### 优先测试清单（从 .harness/config.yaml 读取项目特定测试策略）

#### P0：核心逻辑单元测试

- 所有 Hook/Reducer 的 Action 和状态转换
- 核心 Utils/Helper 函数的输入输出
- 数据模型的验证逻辑

#### P1：组件测试

- 核心交互组件的渲染和事件处理
- 条件渲染和状态切换
- Props 传递和回调触发

#### P2：集成测试

- 完整用户流程（从操作到结果）
- 跨组件数据流
- 边界和异常场景

## 测试文件组织

```
src/
├── __tests__/
│   ├── hooks/
│   │   └── {hookName}.test.ts
│   ├── utils/
│   │   └── {utilName}.test.ts
│   ├── components/
│   │   └── {ComponentName}.test.tsx
│   └── integration/
│       └── {flowName}.test.tsx
```

## 测试命名规范指南

### 标准模板

```typescript
describe('{被测单元}', () => {
  describe('{功能点}', () => {
    it('should {期望行为} when {条件}', () => {});
  });
});
```

### 命名规则详解

| 元素 | 规范 | 示例 |
|------|------|------|
| describe（外层） | 被测单元名称（函数/Hook/组件） | `describe('useAuth', ...)` |
| describe（内层） | 功能点或行为分类 | `describe('登录流程', ...)` / `describe('token 管理', ...)` |
| it | `should {动词短语} when {条件}` | `it('should return user data when token is valid', ...)` |
| 避免 | 不要在名字里包含实现细节 | ❌ `it('should call setUserState with object'`, ✅ `it('should update current user'` |

### 断言风格

```typescript
// ✅ 推荐：行为驱动，关注结果
expect(result).toEqual({ name: 'Alice', role: 'admin' });

// ❌ 避免：实现驱动，关注过程
expect(mockSetUser).toHaveBeenCalledWith({ name: 'Alice', role: 'admin' });
// （除非测试的就是"是否调用了某个依赖"）
```

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 测试文件 | `src/__tests__/{category}/{name}.test.{ts,tsx}` | TypeScript | 按类别组织的测试代码 |
| 实现代码 | `src/{category}/{name}.{ts,tsx}` | TypeScript | TDD 驱动出的实现代码 |
| TDD 循环日志 | `.harness/logs/tdd-{task}-YYYYMMDD.md` | Markdown | 记录每个 RED/GREEN/REFACTOR 循环的关键决策 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| RED 测试写出来就直接通过 | 重新审视测试——可能是测试无效或代码已存在 | 加强断言精度或选择不同的测试角度 |
| GREEN 阶段无法写出最小实现 | 可能是测试过于复杂或需求本身模糊 | 回到 brainstorming 重新澄清需求 |
| REFACTOR 导致测试失败 | 立即撤销本次重构（git checkout），分析失败原因 | 小步重构，每次只改一处 |
| 测试框架报错/配置问题 | 检查 vitest/jest 配置和依赖版本 | 参考 project-init 的测试初始化流程 |
| 循环超过 5 分钟仍未完成 | 强制停止当前循环，拆分为更小的子任务 | 将大功能拆分为多个独立 TDD 循环 |
| Mock 设置导致测试脆弱 | 减少 Mock 使用，改为测试真实行为 | 遵循 Mock 最佳实践（见 test-generator Skill） |

## 交接协议

```markdown
## TDD 交接包

### 交付给 verification
- 测试文件列表：[src/__tests__/hooks/xxx.test.ts, ...]
- 实现文件列表：[src/hooks/xxx.ts, ...]
- 测试通过率：X/Y (100%)
- TDD 循环次数：N 次 RED-GREEN-REFACTOR
- 覆盖率报告路径：`coverage/index.html`（如有）

### 交付给 test-generator（如需补充测试）
- 已覆盖的行为点：[行为1, 行为2, ...]
- 未覆盖的行为点：[行为3, ...]（建议补充）
- 当前 Mock 策略说明
```

**交接验证**：接收方必须确认测试套件运行通过且覆盖率 ≥ 项目阈值（默认 80%）。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 测试文件存在 | 文件系统检查 | 对应 `__tests__/` 目录下有测试文件 |
| 所有测试通过 | `npm run test` | 0 failures, 0 errors |
| 测试在实现之前编写 | Git 历史检查 | 测试文件的 commit 时间 ≤ 实现文件的 commit 时间 |
| 无 skipped 测试 | 测试输出解析 | `.skip` 和 `.todo` 出现次数 = 0 |
| 命名规范合规 | 正则扫描 | 所有 `it(` 符合 `should ... when ...` 格式 |
| 覆盖率达标 | coverage 报告 | 行覆盖率 ≥ 80%（或项目配置的阈值） |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| GSD | 每个子代理内部遵循 TDD 流程 |
| systematic-debugging | Bug 修复时先写失败测试再修 |
| verification-before-completion | 完成前收集测试通过证据 |
| GSTACK: /qa | TDD 通过后 → /qa 接手浏览器端到端验证 |
| test-generator | RED 阶段委托 test-generator 生成测试骨架 |
| subagent-driven-development | TDD 循环映射为微任务的子任务链 |

## 注意事项

- 测试代码和实现代码同等重要，同样需要维护
- 不要为了覆盖率写无意义测试，每个测试应验证一个明确行为
- Mock 外部依赖，但不 Mock 被测单元内部逻辑
- 测试应独立运行，不依赖执行顺序
