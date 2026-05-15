---
id: code-simplification
name: "Code Simplification — 代码简化（完整版）"
stage: review
roles: [Reviewer]
pattern: Reviewer
mandatory: false
depends: [requesting-code-review, verification]
version: "3.1"
min_lines: 50
description: "When the user mentions /simplify, refactor, cleanup, or needs to reduce code complexity, ALWAYS use this skill. Applies Chesterton fence principle and 500-rule (functions ≤50 lines, files ≤500 lines)."
---

# Code Simplification — 代码简化（增强版）

> **设计模式**：Reviewer（按 Checklist 审查 + 简化建议）
> **阶段**：评审 → 简化
> **角色**：Reviewer
> **触发**：`/simplify` 或 `/review` 发现简化标记时自动触发

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 代码审查中发现可简化项 | `/review` 审查后自动建议 | review 报告含 `[SIMPLIFY]` 标记 |
| 用户主动请求简化 | 输入 `/simplify <文件路径>` | 针对特定文件或模块 |
| 函数/文件超长告警 | 静态分析工具报告 | 函数 >50 行或文件 >500 行时 |
| 重构阶段开始 | 进入重构迭代周期 | 作为重构的前置分析步骤 |

**不触发场景**：首次编写新代码（应先走 TDD）、紧急热修复（时间优先）、外部库代码（不可修改）。

## 核心原则

1. **Chesterton 栅栏**：删除代码前先理解它存在的理由
2. **500 规则**：任何函数不超过 50 行（理想 ≤20 行），任何文件不超过 500 行
3. **在保留精确行为的同时降低复杂度**
4. **清晰胜过聪明**：可读性 > 巧妙性

## Chesterton 栅栏决策树（增强版）

在决定是否删除/简化一段代码前，必须经过以下决策流程：

```
这段代码看起来多余？
├─ 是否有直接引用？（grep 搜索函数名/变量名）
│  ├─ 有引用 → ❌ 不能删，保留并记录用途
│  └─ 无引用 → 继续判断
│     ├─ 是否被动态调用？（反射、eval、字符串映射表、事件监听注册）
│     │  ├─ 是 → ⚠️ 高风险，需运行时验证后才能决定
│     │  │   → 操作：添加 TODO 注释，标记为「疑似死代码，待确认」
│     │  └─ 否 → 继续判断
│     │     ├─ 是否是接口实现/抽象方法覆写？
│     │     │  ├─ 是 → ❌ 不能删（即使当前未被直接调用）
│     │     └─ 否 → 继续判断
│     │        ├─ 是否有导出（export）？
│     │        │  ├─ 是 → ⚠️ 可能是公共 API，检查文档和消费者
│     │        └─ 否 → ✅ 可以安全删除
│     │           → 但仍需确认：git blame 查看引入原因和关联 commit
```

## 完整执行流程（5步）

### Step 1：读取简化规则 + 配置工具

```bash
# 加载项目级简化规则
if [ -f ".harness/rules/simplification-rules.md" ]; then
  RULES_FILE=".harness/rules/simplification-rules.md"
else
  # 使用内置默认规则
  echo "Using built-in default simplification rules"
fi

# 初始化 ESLint 简化插件（如果已安装）
if npm list eslint-plugin-simple-import-sort >/dev/null 2>&1; then
  echo "✅ Simplification plugins detected"
fi
```

### Step 2：运行自动化扫描工具

```bash
# 使用 ESLint 进行初步死代码检测
npx eslint src/ --format json --rule '{"no-unused-vars": "error", "no-unreachable": "error"}'

# 使用 TypeScript 编译器检查未使用的导入
npx tsc --noEmit --pretty 2>&1 | grep "is declared but"

# 统计函数长度（找出超过50行的函数）
find src -name "*.ts" -exec awk 'NR>50 && /^function|^const \w+ = / {print FILENAME":"NR" ("NR" lines)"}' {} \;
```

### Step 3：逐项人工复核（应用 Chesterton 决策树）

对每个自动化工具的命中项进行人工判定：

| 检查维度 | 严重等级 | 判定规则 | 自动化工具支持 |
|---------|---------|---------|---------------|
| 死代码 | 🔴 严重 | 按 Chesterton 决策树判定为可安全删除 | `eslint no-unused-vars`, `typescript-eslint/no-unused-vars` |
| 重复代码 | 🟡 中等 | 相似度 ≥80% 且逻辑完全一致的代码块（≥3行） | `eslint-plugin-jest` (部分), SonarQube duplication detection |
| 过度抽象 | 🟡 中等 | 接口只有1个实现类 / 函数只有1个调用点 | 人工审核为主 |
| 嵌套过深 | 🟡 中等 | if/for/try 嵌套层级 ≥4 | `eslint max-depth`, `complexity` rules |
| 魔法值 | 🟢 低 | 出现 ≥2 次的硬编码数字/字符串 | `eslint no-magic-numbers` |
| 过长函数 | 🔴 严重 | 函数体（不含注释和空行）> 50 行 | `eslint max-lines-per-function` |
| 未使用的导入 | 🟢 低 | import 后无引用 | `typescript-eslint/no-unused-vars` |
| 复杂度过高 | 🟡 中等 | 圈复杂度 > 10 | `eslint complexity`, `cyclomatic-complexity` |

### Step 4：输出简化建议报告

```markdown
## 代码简化报告

**文件**：<文件名>
**审查日期**：YYYY-MM-DD
**审查依据**：simplification-rules.md v<X>
**自动化工具**：ESLint v9.x + TypeScript 5.x

### 统计摘要

| 类别 | 发现数量 | 严重程度分布 |
|------|---------|------------|
| 死代码 | N | 🔴X 🟡Y 🟢Z |
| 重复代码 | N | ... |
| 过长函数 | N | ... |
| **总计** | **N** | **预估节省 ~XX 行** |

### 可简化项详情

#### 1. [🔴 严重] 行号 — 问题描述

- **当前代码**：
  ```typescript
  // 优化前的冗长版本（60行）
  function processUserData(users: User[]): ProcessedUser[] {
    const result: ProcessedUser[] = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user.isActive && user.age >= 18) {
        if (user.emailVerified) {
          const processed: ProcessedUser = {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email.toLowerCase(),
            status: 'active',
          };
          result.push(processed);
        }
      }
    }
    return result;
  }
  ```

- **简化后代码**：
  ```typescript
  // 优化后的简洁版本（12行，减少80%）
  function processUserData(users: User[]): ProcessedUser[] {
    return users
      .filter(isActiveAdult)
      .filter(hasVerifiedEmail)
      .map(toProcessedUser);
  }

  const isActiveAdult = (user: User): boolean =>
    user.isActive && user.age >= 18;

  const hasVerifiedEmail = (user: User): boolean =>
    user.emailVerified;

  const toProcessedUser = (user: User): ProcessedUser => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email.toLowerCase(),
    status: 'active',
  });
  ```

- **改进效果**：
  - 行数：60 → 12 (-80%)
  - 圈复杂度：6 → 1 (-83%)
  - 可读性：显著提升（声明式 vs 命令式）
  - 可测试性：4个纯函数可独立测试

- **判定依据**：Chesterton 决策树 → 无外部依赖 / 纯函数转换 / 行为等价

#### 2. [🟡 中等] 行号 — 重复代码合并

- **发现**：3处相同的日期格式化逻辑
- **建议**：提取为 `formatDate(date: Date): string` 公共函数
- **预估节省**：~15 行（去除重复）+ 5 行（新函数）= 净省 10 行

### 保留项（Chesterton 栅栏）

- 行号 — 代码看似多余但有特定用途：<原因>
  - 判定路径：决策树第 N 层 → 结论
  - 建议：添加注释说明保留理由，避免未来误删
```

### Step 5：实施简化 + 验证

```bash
# 1. 创建 feature 分支
git checkout -b simplify/<feature-name>

# 2. 应用简化修改
# （手动或使用 automated refactoring tool）

# 3. 运行完整测试套件
npm run test

# 4. 运行 lint 检查
npm run lint

# 5. 如果全部通过，提交更改
git add .
git commit -m "[simplify] refactor: extract helper functions from processUserData

- Split 60-line function into 4 focused helpers
- Reduce cyclomatic complexity from 6 to 1
- Improve testability with pure functions

Closes #<issue-number>"
```

## 6大常见简化模式及示例

### 模式 1：命令式 → 声明式（数组操作）

**Before（命令式，40行）：**
```typescript
function getActiveAdminUsers(users: User[]): User[] {
  const result: User[] = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.role === 'admin') {
      if (user.status === 'active') {
        if (!user.isDeleted) {
          result.push(user);
        }
      }
    }
  }
  return result;
}
```

**After（声明式，8行）：**
```typescript
function getActiveAdminUsers(users: User[]): User[] {
  return users.filter(user =>
    user.role === 'admin' &&
    user.status === 'active' &&
    !user.isDeleted
  );
}
```

**提升指标：** 行数 -80%，圈复杂度 -75%

---

### 模式 2：嵌套条件 → 提前返回（Guard Clauses）

**Before（深层嵌套，35行）：**
```typescript
function validateAndProcess(input: Input): Result {
  if (input !== null) {
    if (typeof input === 'object') {
      if ('data' in input) {
        if (Array.isArray(input.data)) {
          if (input.data.length > 0) {
            // 实际处理逻辑（埋藏在5层嵌套中）
            return processData(input.data);
          } else {
            throw new Error('Empty data array');
          }
        } else {
          throw new Error('Data is not an array');
        }
      } else {
        throw new Error('Missing data field');
      }
    } else {
      throw new Error('Input is not an object');
    }
  } else {
    throw new Error('Input is null');
  }
}
```

**After（Guard Clauses，20行）：**
```typescript
function validateAndProcess(input: Input): Result {
  if (input === null) {
    throw new Error('Input is null');
  }

  if (typeof input !== 'object') {
    throw new Error('Input is not an object');
  }

  if (!('data' in input)) {
    throw new Error('Missing data field');
  }

  if (!Array.isArray(input.data)) {
    throw new Error('Data is not an array');
  }

  if (input.data.length === 0) {
    throw new Error('Empty data array');
  }

  // 主要逻辑清晰可见
  return processData(input.data);
}
```

**提升指标：** 可读性显著提升，错误位置一目了然

---

### 模式 3：重复逻辑 → 抽取函数

**Before（3处重复，共45行）：**
```typescript
// 文件 A
function calculateDiscountA(price: number): number {
  if (price > 1000) {
    return price * 0.9;
  } else if (price > 500) {
    return price * 0.95;
  } else {
    return price;
  }
}

// 文件 B
function calculateDiscountB(price: number): number {
  if (price > 1000) {
    return price * 0.9;
  } else if (price > 500) {
    return price * 0.95;
  } else {
    return price;
  }
}

// 文件 C（再次重复...）
```

**After（统一函数，15行净省30行）：**
```typescript
// utils/discount.ts
export function calculateDiscount(price: number): number {
  const DISCOUNT_TIERS = [
    { threshold: 1000, rate: 0.9 },
    { threshold: 500, rate: 0.95 },
  ] as const;

  for (const { threshold, rate } of DISCOUNT_TIERS) {
    if (price > threshold) return price * rate;
  }

  return price;
}
```

**提升指标：** DRY原则，单一修改点，易于测试

---

### 模式 4：魔法值 → 命名常量

**Before（魔法数字散落各处）：**
```typescript
if (user.age >= 18) { /* adult logic */ }
setTimeout(callback, 3000); // 3 seconds
const MAX_RETRIES = 5; // still unclear context
```

**After（语义化常量）：**
```typescript
const ADULT_AGE_THRESHOLD = 18;
const DEFAULT_TIMEOUT_MS = 3_000; // 3 seconds
const MAX_API_RETRIES = 5;

if (user.age >= ADULT_AGE_THRESHOLD) { /* adult logic */ }
setTimeout(callback, DEFAULT_TIMEOUT_MS);
```

**提升意图表达：** 代码自文档化，无需注释即可理解

---

### 模式 5：过长组件 → 拆分子组件（React 示例）

**Before（120行的巨型组件）：**
```tsx
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser);
    fetchUserPosts(userId).then(setPosts);
  }, [userId]);

  if (loading) return <Spinner />;
  if (!user) return <NotFound />;

  return (
    <div className="profile">
      <header>
        <img src={user.avatar} alt={user.name} />
        <h1>{user.name}</h1>
        <p>{user.bio}</p>
        <button onClick={() => follow(user.id)}>
          {user.isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      </header>

      <section>
        <h2>Posts ({posts.length})</h2>
        {posts.map(post => (
          <article key={post.id}>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <time>{formatDate(post.createdAt)}</time>
          </article>
        ))}
      </section>

      <aside>
        <Stats stats={user.stats} />
        <FriendsList friends={user.friends} />
      </aside>
    </div>
  );
}
```

**After（拆分为5个聚焦组件，每个<30行）：**
```tsx
// 主容器组件（15行）
function UserProfile({ userId }: Props) {
  const { user, posts, loading } = useUserProfile(userId);

  if (loading) return <Spinner />;
  if (!user) return <NotFound />;

  return (
    <div className="profile">
      <ProfileHeader user={user} />
      <PostList posts={posts} />
      <Sidebar user={user} />
    </div>
  );
}

// 自定义 Hook（数据获取逻辑）
function useUserProfile(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchUser(userId), fetchUserPosts(userId)])
      .then(([userData, postData]) => {
        setUser(userData);
        setPosts(postData);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, posts, loading };
}

// 子组件：头部信息
function ProfileHeader({ user }: { user: User }) { /* ~20 lines */ }

// 子组件：文章列表
function PostList({ posts }: { posts: Post[] }) { /* ~15 lines */ }

// 子组件：侧边栏
function Sidebar({ user }: { user: User }) { /* ~12 lines */ }
```

**提升指标：** 可维护性、可复用性、可测试性全面提升

---

### 模式 6：回调地狱 → async/await

**Before（Pyramid of Doom，25行）：**
```typescript
function fetchData(callback: (data: Data) => void) {
  fetch('/api/user')
    .then(response => response.json())
    .then(user => {
      fetch(`/api/posts?userId=${user.id}`)
        .then(response => response.json())
        .then(posts => {
          fetch(`/api/comments?postId=${posts[0].id}`)
            .then(response => response.json())
            .then(comments => {
              callback({ user, posts, comments });
            })
            .catch(err => console.error('Comments error:', err));
        })
        .catch(err => console.error('Posts error:', err));
    })
    .catch(err => console.error('User error:', err));
}
```

**After（线性异步流，15行）：**
```typescript
async function fetchData(): Promise<{ user: User; posts: Post[]; comments: Comment[] }> {
  try {
    const userResponse = await fetch('/api/user');
    const user = await userResponse.json();

    const postsResponse = await fetch(`/api/posts?userId=${user.id}`);
    const posts = await postsResponse.json();

    const commentsResponse = await fetch(`/api/comments?postId=${posts[0].id}`);
    const comments = await commentsResponse.json();

    return { user, posts, comments };
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

**提升指标：** 错误处理集中化，代码扁平化，易于调试

## 自动化工具配置

### ESLint 推荐规则集（`.eslintrc.js` 或 `eslint.config.js`）

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // 死代码检测
    'no-unused-vars': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-unreachable': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],

    // 复杂度控制
    'complexity': ['warn', { max: 10 }],
    'max-depth': ['warn', { max: 4 }],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-lines': ['warn', { max: 500, skipComments: true }],

    // 代码风格（辅助简化）
    'max-len': ['warn', { code: 100, ignoreUrls: true }],
    'max-params': ['warn', { max: 4 }],
    'max-nested-callbacks': ['warn', { max: 3 }],

    // 魔法值检测
    'no-magic-numbers': ['warn', { ignore: [0, 1, -1], ignoreArrayIndexes: true }],

    // 简化友好
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': ['error', 'always'],
    'prefer-template': 'error',
    'prefer-destructuring': ['warn', { object: true, array: false }],
  },
};
```

### Prettier 配置（`.prettierrc`）

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

## IDE 集成建议

### VS Code 推荐扩展

1. **ESLint** - 实时显示简化警告
2. **Prettier** - 格式化代码自动简化
3. **Code Spell Checker** - 避免因拼写导致的歧义变量名
4. **Import Cost** - 显示导入包的大小，提示是否可以移除
5. **TypeScript Hero** - 快捷重构（提取函数、内联变量等）

### VS Code 快捷键配置（`keybindings.json`）

```json
[
  {
    "key": "cmd+shift+r",
    "command": "editor.action.codeAction",
    "args": {
      "kind": "refactor.extract.function"
    },
    "when": "editorHasCodeActionsProvider && editorTextFocus"
  },
  {
    "key": "cmd+shift+i",
    "command": "editor.action.codeAction",
    "args": {
      "kind": "refactor.inline.variable"
    },
    "when": "editorHasCodeActionsProvider && editorTextFocus"
  }
]
```

## 重构安全清单（增强版）

每次执行简化操作前，必须逐项确认：

### 编译/类型安全
- [ ] 简化后的代码能通过 TypeScript 编译（`npx tsc --noEmit`）
- [ ] 删除的符号不会导致其他文件的类型错误
- [ ] 泛型类型推断仍然正确

### 行为等价性
- [ ] 现有测试套件全部通过（`npm run test`）
- [ ] 如果没有测试，必须先补充测试再执行简化
- [ ] 简化前后的输入-输出行为完全一致（针对纯函数可做属性测试）
- [ ] 边界情况覆盖（null、undefined、空数组、极端值）

### 性能影响评估
- [ ] 简化不会引入性能回归（如不必要的循环/内存分配）
- [ ] 新增的函数调用不会成为热点路径瓶颈
- [ ] 如果涉及渲染优化，需用 React Profiler 验证

### 影响范围控制
- [ ] 变更限定在单个文件内（跨文件简化需要额外 review）
- [ ] 不改变公共 API 签名（函数参数、返回值类型、class 公共方法）
- [ ] 不改变副作用行为（网络请求、DOM 操作、事件发射）

### 可回滚性
- [ ] 每次简化操作对应一个独立 commit（便于 `git revert`）
- [ ] commit message 包含 `[simplify]` 前缀和具体说明
- [ ] 关键简化前创建 Git tag 以便快速回退

## 失败处理（10个场景全覆盖）

| 失败场景 | 检测方式 | 处理策略 | 恢复命令 |
|---------|---------|---------|----------|
| **简化后测试失败** | `npm run test` exit code ≠ 0 | 立即回滚该次简化 | `git checkout -- <file> && npm run test` |
| **无法确定代码是否有用** | Chesterton 决策树无法得出结论 | 标记为「保留」，添加注释说明存疑原因 | 放入技术债务 backlog |
| **简化规则文件缺失** | 文件系统检查 `.harness/rules/` | 使用内置默认规则集继续执行 | 同时输出提示建议项目创建自定义规则 |
| **目标文件无测试覆盖** | glob `*.test.ts(x)` 无匹配 | 暂停简化，先生成基础测试 | 调用 test-generator 生成后再恢复 |
| **简化引入新的 lint 错误** | `npm run lint` 报新增错误 | 修复 lint 错误或调整简化方案 | 确保 lint 全部通过后才算完成 |
| **TypeScript 类型推断失败** | `npx tsc --noEmit` 报错 | 显式添加类型注解或调整重构策略 | 回退到上一次成功的 commit |
| **性能回归** | 性能基准测试对比 | 分析热点，可能需要保留原实现 | 使用 git cherry-pick 还原该次改动 |
| **循环依赖引入** | `madge --circular src/` 检测 | 调整模块结构或使用依赖注入 | 重构模块依赖关系图 |
| **Git 冲突** | `git status` 显示 conflict markers | 手动解决冲突或 abort | `git merge --abort` 后重新应用 |
| **团队评审意见分歧** | PR review comments | 召开技术讨论会决策 | 记录决策理由到简化报告中 |

## 产出物（6个关键交付物）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| 简化报告 | `.harness/reports/<filename>-simplify-YYYYMMDD.md` | Markdown | 所有发现和建议的完整记录（含统计摘要） | **必需** |
| 简化后代码 | 原文件路径（原地修改） | TypeScript/JavaScript | 应用简化建议后的实际代码 | **必需** |
| 安全清单确认 | 嵌入简化报告末尾 | Checklist | 重构安全清单每项的勾选状态 | **必需** |
| 性能对比数据 | `.harness/metrics/simplification-perf.json` | JSON | 简化前后的性能指标对比（可选） | 推荐 |
| Git Commit 历史 | Git log | 元数据 | 所有 `[simplify]` 前缀的 commit 记录 | **必需** |
| 团队评审记录 | PR/MR 评论 | 在线讨论 | Code Review 的讨论和最终决议 | 推荐 |

## 与其他 Skill 的协作矩阵

| 协作 Skill | 协作时机 | 协作内容 | 数据流向 |
|-----------|---------|---------|---------|
| **requesting-code-review / staff-review** | Review 发现简化标记时 | 接收 review 报告中的 `[SIMPLIFY]` 问题 | Review 报告 → 简化任务列表 |
| **verification-before-completion** | 简化完成后 | 验证行为不变性 | 简化报告 + 测试结果 → 验证通过 |
| **test-generator** | 目标文件无测试时先生成测试 | 生成基础测试套件 | 文件路径 → 测试文件 |
| **tdd** | 简化过程中补充边界测试 | TDD 红绿循环确保行为不变 | 简化需求 → 测试用例 |
| **systematic-debugging** | 简化导致意外失败时 | 定位根因并修复 | 错误现象 → 根因分析 |
| **gating** | Gate 6 (Simplify Gate) | 检查简化是否达标 | 简化报告 → 门禁通过/失败 |

## 质量门禁（Simplify Gate 增强）

| 门禁项 | 检查方式 | 通过标准 | 不通过处理 |
|-------|---------|---------|-----------|
| 简化报告存在 | 文件系统检查 | `.harness/reports/` 下有对应 simplify 报告 | 生成报告 |
| 安全清单全通过 | 报告内容解析 | 重构安全清单所有项均为 ✅ | 补充缺失的检查项 |
| 测试零回归 | 测试执行 | 简化前后测试通过数一致，无新增失败 | 回滚简化并重新分析 |
| 编译无错误 | `npx tsc --noEmit` | TypeScript 编译 0 errors | 修复类型错误 |
| Lint 无退化 | `npm run lint` | lint 错误数 ≤ 简化前（允许减少，不允许增加） | 修复 lint 错误或调整方案 |
| 每个删除有判定理由 | 报告内容搜索 | 每个「可简化项」包含「判定依据」字段 | 补充 Chesterton 判定过程 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） | （元检查，忽略） |
| 性能无回归 | 基准测试对比 | 关键路径性能差异 < 5% | 优化或回退 |

## 常见简化机会速查表

| 代码坏味道 | 简化方向 | 预估收益 | 难度 |
|-----------|---------|---------|------|
| 过长的渲染函数（>50行） | 拉子组件/子函数 | 高 | ⭐⭐ |
| 重复出现的样式/逻辑 | 抽取公共函数或常量 | 中 | ⭐ |
| 组件特定属性硬编码 | 配置化/数据驱动 | 中 | ⭐⭐⭐ |
| 重复的数据结构定义 | 工厂函数或映射表 | 中 | ⭐⭐ |
| 深层嵌套的回调 | async/await 或 Promise 链 | 高 | ⭐ |
| 多重 if-else 条件分支 | 策略模式或多态 | 高 | ⭐⭐⭐ |
| 大型 switch 语句 | 对象映射表或 Map | 中 | ⭐⭐ |
| 临时变量过多 | 管道/组合模式 | 低 | ⭐⭐ |

## 下一步行动

Code Simplification 完成后：

1. **有遗留问题？** → 进入 `/verification-before-completion` 验证行为不变性
2. **需要二次审查？** → 将简化后的代码提交给 `/requesting-code-review`
3. **准备发布？** → 确保 Gate 6 (Simplify Gate) 通过
4. **想继续优化？** → 识别下一批可简化的文件，开始新一轮迭代
