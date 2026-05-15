---
id: test-generator
name: Test Generator — 测试文件生成器
stage: build/test
roles: [Tester, Developer]
pattern: Generator
mandatory: false
depends: [tdd]
version: "3.0"
min_lines: 50
description: "When the user mentions generate tests, auto-test, or needs to automatically generate test cases from code analysis, ALWAYS use this skill. Supplements boundary condition tests and integration tests."
---

# Test Generator — 测试文件生成器

> **设计模式**：Generator（模板填充式生成）
> **阶段**：构建/验证
> **角色**：Tester
> **触发**：`/test`（与 TDD 协同）

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| TDD RED 阶段 | TDD 循环自动调用 | 生成失败的测试骨架作为 RED 输入 |
| 新增代码后补测试 | 用户输入 `/test <文件路径>` | 为已有实现补充测试覆盖 |
| 代码审查要求补充测试 | requesting-code-review 发现测试不足 | 按 review 建议生成缺失的测试用例 |
| 覆盖率不达标时 | verification 报告覆盖率低于阈值 | 自动识别未覆盖分支并生成测试 |
| 重构前建立安全网 | code-simplification 执行前 | 为即将简化的代码生成回归保护测试 |

**不触发场景**：纯类型定义文件、配置文件、声明文件（`.d.ts`）。

**与 verification 的核心区别**：

| 维度 | test-generator | verification |
|------|---------------|-------------|
| **职责** | **生成**测试代码 | **收集**验证证据 |
| **产出物** | `.test.ts/.test.tsx` 文件 | 验证报告 Markdown |
| **时机** | 编码阶段（TDD RED / 补测试） | 完成阶段（声明 done 前） |
| **输入** | 源代码 + 验收标准 | 测试结果 + 构建产物 |
| **关注点** | 「怎么写出好测试」 |「怎么证明做完了」|
| **下游** | 产出的测试被 verification 执行 | 产出的报告交给 code-review |

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 被测源代码 | `src/` 目录下的目标文件 | 必需 | 测试生成的输入 |
| 测试模板 | `assets/test-template.ts` 或内置默认模板 | 必需 | 保证输出格式一致 |
| 项目测试框架配置 | `vitest.config.ts` / `jest.config.ts` | 必需 | 确定可用的断言库和工具 |
| 类型定义文件 | 对应的 `.d.ts` 或源码中的类型 | 必需 | 用于编写类型安全的测试 |
| 验收标准（可选） | 设计文档中的 AC 列表 | 可选 | 有验收标准时可生成更精准的测试 |

**前置检查**：如果测试框架未配置，应先提示初始化。

## 核心原则

1. **模板驱动**：使用 assets/test-template.ts 保证测试文件结构一致
2. **DAMP > DRY**：测试中描述性清晰优先于不重复
3. **测试金字塔**：80% 单元 / 15% 集成 / 5% E2E

## 执行流程

### Step 1：确定测试类型和范围

| 类型 | 文件位置 | 优先级 | 适用场景 |
|------|---------|--------|---------|
| Hook 单元测试 | `src/__tests__/hooks/<name>.test.ts` | P0 | 自定义 Hook 的逻辑验证 |
| Util 单元测试 | `src/__tests__/utils/<name>.test.ts` | P0 | 纯函数/工具函数的输入输出 |
| 组件测试 | `src/__tests__/components/<name>.test.tsx` | P1 | UI 组件渲染和交互 |
| 集成测试 | `src/__tests__/integration/<name>.test.tsx` | P2 | 跨模块流程验证 |

### Step 2：读取模板并分析被测代码

读取 `assets/test-template.ts` 获取测试文件结构。
同时分析被测源代码：
- 提取所有导出函数/组件/Hook
- 分析函数签名（参数类型、返回值类型）
- 识别分支逻辑（if/switch/三元表达式）
- 标记外部依赖（import 的其他模块）

### Step 3：设计测试用例（边界值策略）

对每个被测行为点，按以下策略生成测试数据：

#### 边界值生成策略矩阵

| 数据类别 | 正常值 | 边界值 | 超界值 | 空值/非法值 | 说明 |
|---------|-------|-------|-------|-----------|------|
| **数字** | 有效范围内的典型值 | min, max, min+1, max-1 | min-1, max+1 | NaN, Infinity, -Infinity | 数值参数 |
| **字符串** | 非空有效字符串 | 空字符串 `""`, 单字符 `"a"`, 最大长度字符串 | 超长字符串 | `null`, `undefined`, 非字符串类型 | 字符串参数 |
| **数组** | 含多个元素的数组 | 空数组 `[]`, 单元素 `[x]` | 超大数组 | `null`, `undefined`, 类数组对象 | 集合类参数 |
| **对象** | 完整有效对象 | 缺少可选字段的对象 | 含多余字段的对象 | `null`, `undefined`, `{}` 空对象 | 结构化参数 |
| **布尔值** | `true`, `false` | — | — | `null`, `undefined`, truthy/falsy 非布尔值 | 开关类参数 |
| **日期** | 有效 Date 对象 | Epoch 时间, 远未来时间 | 无效日期字符串 | `null`, `undefined`, `Invalid Date` | 时间相关参数 |
| **枚举/联合类型** | 每个枚举值各一个用例 | — | 枚举之外的值 | `null`, `undefined`, 非法字符串 | 有限集合参数 |
| **函数/回调** | 正常回调函数 | 抛异常的回调, 异步回调 | — | `null`, `undefined`, 非函数值 | 高阶函数参数 |

#### 测试用例生成规则

每个被测函数至少生成以下几类测试：

```typescript
describe('<FunctionName>', () => {
  // 1. Happy path（正常值，≥1 个）
  it('should return expected result when given valid input', () => {});

  // 2. Boundary values（每个边界 ≥1 个）
  it('should handle empty input gracefully', () => {});
  it('should handle maximum allowed input', () => {});

  // 3. Edge / corner cases（异常场景）
  it('should throw when given invalid input type', () => {});

  // 4. 如果有分支逻辑，每条分支 ≥1 个测试
  it('should take branch A when condition is true', () => {});
  it('should take branch B when condition is false', () => {});
});
```

### Step 4：Mock 最佳实践

#### 何时 Mock、Mock 什么

| Mock 对象 | 是否应该 Mock | 原因 |
|----------|-------------|------|
| 网络请求（fetch/axios） | ✅ 必须 Mock | 不可控、速度慢、依赖外部服务 |
| 数据库操作 | ✅ 必须 Mock | 不可控、需要隔离、副作用大 |
| 文件系统 I/O | ✅ 应该 Mock | 依赖本地环境、副作用 |
| 定时器（setTimeout/setInterval） | ✅ 应该 Mock | 影响测试速度和确定性 |
| 当前日期/时间（Date.now） | ✅ 应该 Mock | 保证断言确定性 |
| 被测模块内部调用的其他项目模块 | ⚠️ 谨慎 Mock | 会降低测试的真实性，优先考虑用真实实现 |
| 被测单元自身的私有方法 | ❌ 不应 Mock | 测试的是公共行为，不是内部实现 |
| 简纯工具函数（lodash 等） | ❌ 不应 Mock | 快速、无副作用、稳定 |

#### Over-Mocking 反模式检测

| 反模式 | 表现 | 危害 | 正确做法 |
|-------|------|------|---------|
| Mock 链式调用 | `mockFn.mockReturnValue().mockResolvedValue()` 多层链 | 测试变成空壳，任何实现都能通过 | 只 Mock 外部边界，让内部逻辑真实执行 |
| Mock 返回固定值 | 永远返回同一个对象，不考虑不同输入 | 无法发现真实集成问题 | 使用 `mockImplementation` 根据输入动态返回 |
| Mock 所有依赖 | 连简单的工具函数都 Mock | 测试价值趋近于零 | 只 Mock 不可控的外部依赖 |
| 断言 Mock 被调用次数 | `expect(mockFn).toHaveBeenCalledTimes(1)` 作为主要断言 | 测试耦合到实现细节 | 优先断言业务效果（返回值/状态变化） |

#### 标准 Mock 设置模板

```typescript
// ✅ 推荐：Mock 外部 API
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// 在具体测试中根据场景设置返回值
mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: 'test' }) });
```

### Step 5：填充测试用例（AAA 模式）

每个测试用例遵循 AAA 模式：
- **Arrange**：准备测试数据（含 Mock 设置）
- **Act**：执行被测操作（单次调用）
- **Assert**：验证期望结果（精确匹配或语义匹配）

### Step 6：输出测试文件

## 测试分类矩阵

| 测试层级 | 覆盖目标 | 工具 | 典型断言 | 占比建议 | 执行速度 |
|---------|---------|------|---------|---------|---------|
| **单元测试** | 单个函数/Hook/类的行为 | Vitest | `toEqual`, `toBe`, `toThrow` | ~80% | <100ms/文件 |
| **组件测试** | 单个 UI 组件的渲染与交互 | @testing-library/react | `getByRole`, `fireEvent`, `userEvent` | ~15% | <500ms/文件 |
| **集成测试** | 多组件协作的业务流程 | @testing-library + msw | 流程端到端断言 | ~5% | 1-5s/文件 |
| **E2E 测试** | 完整用户旅程（浏览器级） | Playwright | 页面级断言 | 视情况 | 10-30s/场景 |

### 各层级的覆盖重点

```
单元测试覆盖：
├── 纯函数的所有输入组合（等价类划分）
├── Hook 的所有状态转换路径
├── 数据验证逻辑的所有校验规则
└── 错误处理的所有 catch 分支

组件测试覆盖：
├── 组件在不同 Props 下的渲染结果
├── 用户交互事件（点击、输入、提交）
├── 条件渲染（loading/error/empty/data 状态）
└── 可访问性属性（aria-label, role）

集成测试覆盖：
├── 跨 Hook 的数据流（状态共享）
├── 用户操作的完整链路（表单→提交→反馈）
├── 错误边界的传播和处理
└── 路由切换的场景
```

## 测试命名规范

```typescript
describe('<被测单元>', () => {
  describe('<功能点>', () => {
    it('should <期望行为> when <条件>', () => {});
  });
});
```

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 测试文件 | `src/__tests__/{category}/{name}.test.{ts,tsx}` | TypeScript | 生成的完整测试代码 |
| Mock 工厂文件 | `src/__tests__/mocks/{module}.ts` | TypeScript | 如需复杂 Mock，抽取为独立工厂 |
| 测试生成日志 | `.harness/logs/test-gen-{file}-YYYYMMDD.md` | Markdown | 记录生成了哪些测试用例及理由 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 模板文件缺失 | 使用内置默认模板继续执行 | 同时提示创建项目自定义模板 |
| 被测代码无法解析（语法错误） | 报告错误，跳过该文件的测试生成 | 建议先修复源码语法再重新生成 |
| 生成的测试无法编译 | 检查类型导入和 Mock 设置是否正确 | 修正类型引用后重试 |
| 测试运行全部通过但无意义 | 审查断言是否过于宽泛（如 `expect(true).toBe(true)`） | 加强断言精度 |
| Mock 设置导致测试脆弱 | 减少 Mock 使用，改用真实依赖或简化 Mock 策略 | 参考 Mock 最佳实践章节调整 |
| 覆盖率仍不达标 | 分析未覆盖的代码分支，针对性补充 | 运行 `--coverage` 定位缺口 |

## 交接协议

```markdown
## Test Generator 交接包

### 交付给 TDD（RED 阶段）
- 测试文件路径：`src/__tests__/{category}/{name}.test.{ts,tsx}`
- 测试用例数：N 个
- 预期失败数：N 个（所有新生成的测试应在 RED 状态）
- Mock 依赖清单：[mocked-module-1, mocked-module-2]

### 交付给 verification（作为测试资产）
- 本次新增/修改的测试文件列表
- 新增的测试覆盖了哪些行为点
- Mock 策略说明（供 verification 理解测试可靠性）
```

**交接验证**：接收方确认测试文件存在且能被测试框架正确解析（无 import 错误）。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 测试文件存在 | 文件系统检查 | `__tests__/` 下有对应测试文件 |
| 测试可解析 | `npx tsc --noEmit` 对测试文件 | 0 errors（测试文件本身编译通过） |
| 包含有效断言 | 内容搜索 | 文件中包含 `expect(` 出现 ≥ 用例数 |
| 遵循 AAA 模式 | 内容审查 | 每个 `it()` 内部有 Arrange/Act/Assert 三段结构 |
- 有边界值覆盖 | 内容搜索 | 至少包含 1 个空值/边界值相关的测试用例 |
- Mock 使用合规 | 内容审查 | 未出现 over-mocking 反模式（见上方检测表） |
- 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| TDD | TDD 红绿循环中，test-generator 生成测试文件 |
| /build | /build 完成后 → /test 生成测试 |
| verification | test-generator 产出测试 → verification 执行并收集证据 |
| code-simplification | 简化前先生成安全网测试 |
