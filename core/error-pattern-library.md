# Harness Skill - Error Pattern Library

> **版本**: 1.0.0
> **用途**: 快速诊断和修复常见错误
> **使用方式**: 搜索错误信息 → 找到对应 Pattern → 按照 Fix 步骤修复

---

## 🔴 P0: 初始化阶段错误

### E001: Cannot find module 'xxx'

**症状**:
```
Error: Cannot find module './test-utils'
or
Error: Failed to resolve import "xxx" from "yyy"
```

**Stage 1: Symptom** → 模块导入路径错误或文件不存在

**Stage 2: Source** → 
- 路径层级计算错误（相对路径问题）
- 文件扩展名不匹配 (.ts vs .js)
- ESM/CJS 模块系统冲突
- 文件未创建但已 import

**Stage 3: Fix**:
```bash
# 1. 确认文件存在
ls -la src/__tests__/utils/test-utils.ts

# 2. 检查路径层级 (从当前文件到目标文件的相对路径)
# 例如: src/__tests__/config/project-config.test.ts 
#       → src/__tests__/utils/test-utils.ts
# 需要往上 1 级 (../) 再进入 utils/ (utils/)
# 正确路径: ../utils/test-utils

# 3. 如果是 ESM/CJS 问题，使用内联路径工具:
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../../');

function requireConfig(fileName: string): unknown {
  return require(resolve(PROJECT_ROOT, fileName));
}
```

**Stage 4: Verify**:
```bash
npm run test -- --run src/__tests__/config/project-config.test.ts
```

---

### E002: biome@^1.x not found / version not exist

**症状**:
```
npm ERR! code ETARGET
npm ERR! not Found No matching version found for biome@^1.9.2
```

**Stage 1: Symptom** → NPM 包版本不存在或 registry 问题

**Stage 2: Source** → 
- biome 版本号错误（可能还未发布）
- npm registry 缓存问题
- package.json 中版本号格式错误 (`@` vs `^`)

**Stage 3: Fix**:
```json
// 方案 A: 使用 ESLint 替代 (推荐)
{
  "devDependencies": {
    // 移除: "biome": "^1.9.2",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.15.0",
    "@typescript-eslint/parser": "^7.15.0",
    "eslint-plugin-react-hooks": "^4.6.2"
  }
}

// 方案 B: 如果坚持用 biome，锁定正确版本
{
  "devDependencies": {
    "biome": "^1.8.0"  // 使用已验证的稳定版
  }
}
```

**Stage 4: Verify**:
```bash
rm -rf node_modules package-lock.json
npm install
npx eslint --version  # 或 npx biome --version
```

---

### E003: tailwind.config.js exports empty object {}

**症状**:
```
TypeError: Cannot read properties of undefined (reading 'content')
or
expect(tailwindConfig.content).toBeDefined()  // FAIL
```

**Stage 1: Symptom** → TailwindCSS 配置文件导出为空对象

**Stage 2: Source** → 
- `package.json` 设置 `"type": "module"` 导致 `.js` 文件被当作 ESM 解析
- `export default` 与 `module.exports` 冲突
- Vite/Rollup 对 CJS/ESM interop 处理不当

**Stage 3: Fix**:
```javascript
// ❌ 错误: tailwind.config.js (当 package.json 有 type: module)
export default { content: [...], theme: {...} }

// ✅ 正确: tailwind.config.cjs (强制 CommonJS)
const config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {...} },
  plugins: [],
};
module.exports = config;
```

然后重命名文件:
```bash
mv tailwind.config.js tailwind.config.cjs
```

更新测试中的引用:
```typescript
requireConfig('tailwind.config.cjs')  // 注意 .cjs 后缀
```

**Stage 4: Verify**:
```bash
node -e "const tw = require('./tailwind.config.cjs'); console.log('keys:', Object.keys(tw))"
```

---

## 🟡 P1: 构建阶段错误

### E004: TypeScript error TS5055: Cannot write file xxx because it would overwrite input file

**症状**:
```
error TS5055: Cannot write file 'xxx.d.ts' because it would overwrite input file.
```

**Stage 1: Symptom** → TypeScript 输出文件与源文件冲突

**Stage 2: Source** → 
- `tsconfig.json` 缺少 `noEmit: true`
- 使用了 project references 但配置冲突
- `outDir` 设置为 `src/` 目录

**Stage 3: Fix**:
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "noEmit": true,        // ← 关键！Vite 项目不需要 tsc 输出
    "declaration": false,  // 不生成 .d.ts
    // 如果需要 declaration，设置单独的 outDir:
    // "declarationDir": "./dist-types"
  }
}

// 或移除 project references (简化配置):
// 删除 tsconfig.node.json 和 references 字段
```

**Stage 4: Verify**:
```bash
npx tsc --noEmit  # 只检查类型，不生成文件
npm run build     # Vite 构建应该成功
```

---

### E005: vitest error "An update to TestComponent inside a test was not wrapped in act(...)"

**症状**:
```
Warning: An update to TestComponent inside a test was not wrapped in act(...).
```

**Stage 1: Symptom** → React Hook 测试中状态更新未被正确包装

**Stage 2: Source** → 
- 异步操作 (如 login/logout) 触发 setState
- 未使用 `act()` 包装异步状态变更
- `waitFor()` 内部直接调用 hook 方法

**Stage 3: Fix**:
```typescript
import { renderHook, waitFor, act } from '@testing-library/react';

// ❌ 错误写法:
await waitFor(async () => {
  await result.current.login('admin', 'password');
});
expect(result.current.isAuthenticated).toBe(true);  // 可能失败！

// ✅ 正确写法:
await act(async () => {
  await result.current.login('admin', 'password');
});

expect(result.current.isAuthenticated).toBe(true);  // 稳定通过
```

**Stage 4: Verify**:
```bash
npm run test -- --run src/__tests__/hooks/auth.test.ts
```

---

## 🟢 P2: 运行时错误

### E006: fetch is not defined (in Node.js test environment)

**症状**:
```
ReferenceError: fetch is not defined
```

**Stage 1: Symptom** → Node.js 环境 (≤18) 不支持全局 fetch

**Stage 2: Source** → 
- Vitest jsdom 环境未模拟 fetch
- Node.js 版本 < 18
- 未安装 node-fetch 或 undici

**Stage 3: Fix**:
```typescript
// 方案 A: 在测试 setup 中 polyfill (vitest.setup.ts)
import { vi } from 'vitest';

Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(),
  writable: true,
});

// 方案 B: 升级 Node.js 到 18+
node --version  # 需要 >= 18.0.0

// 方案 C: 安装 undici (Node.js 原生 fetch)
npm install --save-dev undici
```

**Stage 4: Verify**:
```bash
node -e "console.log(typeof fetch)"  # 应输出: function
```

---

### E007: localStorage is not defined

**症状**:
```
ReferenceError: localStorage is not defined
```

**Stage 1: Symptom** → jsdom 环境未完整模拟浏览器 API

**Stage 2: Source** → 
- Vitest environment 配置为 'node' 而非 'jsdom'
- 测试文件级别覆盖了全局 environment

**Stage 3: Fix**:
```typescript
// vite.config.ts
test: {
  environment: 'jsdom',  // ← 必须是 jsdom
  globals: true,
}

// 或在单个测试文件顶部:
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
```

**Stage 4: Verify**:
```bash
npm run test -- --run 2>&1 | grep -i "localStorage"
```

---

## 🔧 通用调试流程

当遇到未知错误时，按以下步骤排查：

```
Step 1: 隔离问题
├── 运行单个失败测试: npm run test -- --run path/to/failing.test.ts
├── 检查是否所有测试都失败还是只有特定测试
└── 尝试注释掉部分代码缩小范围

Step 2: 收集信息
├── 完整错误堆栈 (stack trace)
├── 相关文件内容 (代码上下文)
├── Node.js 版本: node --version
├── NPM 版本: npm --version
└── 操作系统: uname -a

Step 3: 查找模式
├── 搜索本 Error Pattern Library (E001-E007)
├── 搜索 GitHub Issues: https://github.com/vitest-dev/vitest/issues
├── 搜索 Stack Overflow: https://stackoverflow.com/questions/tagged/vitest+react
└── 搜索官方文档: https://vitest.dev/guide/

Step 4: 应用修复
├── 按照对应 Pattern 的 Fix 步骤操作
├── 先备份当前代码: git stash
├── 应用修复后立即运行测试验证
└── 如果修复无效，回退并尝试其他方案

Step 5: 记录经验
├── 将新发现的错误模式添加到本 Library
├── 更新项目 FAQ 文档
└── 提交 PR 改进 Skill 模板 (如有必要)
```

---

## 📊 错误统计 (本次测试)

| Error Code | 出现次数 | 解决时间 | 难度 |
|------------|----------|----------|------|
| E001 (模块找不到) | 3 次 | ~10min | 🟡 中等 |
| E002 (依赖版本) | 1 次 | ~5min | 🟢 简单 |
| E003 (Tailwind 导出) | 2 次 | ~15min | 🟡 中等 |
| E004 (TS 编译) | 1 次 | ~10min | 🟡 中等 |
| E005 (React act) | 2 次 | ~20min | 🔴 困难 |

**总计**: 9 个错误，全部解决，平均修复时间 **12min**

---

*最后更新: 2026-05-05 by Harness Skill Testing*
