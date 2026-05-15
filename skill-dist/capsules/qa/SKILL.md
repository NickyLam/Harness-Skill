---
id: qa
name: "QA — 质量保证（轻量级浏览器E2E验证）"
stage: test
roles: [tester]
pattern: browser-e2e-validation
mandatory: false
depends: []
version: "3.1"
description: "When the user mentions quality assurance, browser test, or needs comprehensive E2E validation with GSTACK, ALWAYS use this skill. Full viewport coverage (desktop/tablet/mobile) with auto-fix capabilities."
---

# QA — 真实浏览器端到端验证（轻量级）

> **层级**：Test 阶段（L1 快速验证）
> **触发**：`/qa` 或 TDD 单元测试通过后
> **与 e2e-qa 的关系**：
> - **qa（本 Skill）**：L1 严格度，标准 Playwright，适合 build/test 阶段快速验证
> - **e2e-qa**：L2+ 严格度，Obscura 增强引擎，适合 test/ship 阶段完整 E2E

## 核心原则

1. **真实环境验证**：在真实 Chromium/Firefox/WebKit 浏览器中验证，不是 jsdom 模拟
2. **用户路径驱动**：按真实用户操作路径验证，而非单纯检查 DOM
3. **自动修复 + 回归**：发现 Bug 自动定位根因 → 修复 → 生成回归测试
4. **全视口覆盖**：桌面(1440×900) + 平板(768×600) + 手机(375×667)
5. **Selector 稳定性优先**：使用用户可见的文本/角色属性，避免脆弱的 CSS 类名

## 触发条件

- 用户输入 `/qa`
- TDD 单元测试全部通过后（`npm run test` 0 failures）
- 开发任务完成前（pre-ship gate）
- PR/MR 提交时（CI/CD pipeline）

## 完整验证流程（6步）

### Step 1：环境准备与启动

```bash
# 安装 Playwright（如果尚未安装）
npm install --save-dev @playwright/test

# 安装浏览器（一次性）
npx playwright install chromium firefox webkit

# 启动开发服务器（后台运行）
npm run dev -- --port 3000 &
DEV_SERVER_PID=$!
echo "Dev server started with PID: $DEV_SERVER_PID"

# 等待服务器就绪
sleep 3

# 验证服务器运行
curl -s http://localhost:3000 > /dev/null && echo "✅ Server ready" || echo "❌ Server failed"
```

**环境变量配置（可选）：**
```bash
# .env.qa（或 .env.test）
BASE_URL=http://localhost:3000
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_SLOW_MO=100 # 每步延迟100ms（便于调试）
```

### Step 2：核心用户路径验证（5条路径）

#### 路径 1：核心功能流程（Happy Path）

```typescript
// e2e/core-functionality.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Core Functionality', () => {
  test('should complete main user flow', async ({ page }) => {
    // 1. 导航到首页
    await page.goto('/');

    // 2. 执行核心操作（以登录为例）
    await page.click('text=Login'); // 使用文本选择器
    await page.fill('[placeholder="Email"]', 'test@example.com');
    await page.fill('[placeholder="Password"]', 'password123');
    await page.click('button[type="submit"]');

    // 3. 验证预期结果
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });

    // 4. 验证数据正确显示
    const userName = await page.locator('.user-name').textContent();
    expect(userName).toContain('test@example.com');
  });
});
```

#### 路径 2：编辑/修改流程

```typescript
// e2e/edit-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Edit Flow', () => {
  test('should edit item and persist changes', async ({ page }) => {
    // 1. 进入编辑模式
    await page.goto('/items/1');
    await page.click('button:text("Edit")'); // 组合选择器

    // 2. 修改属性
    await page.clear('#title-input');
    await page.fill('#title-input', 'Updated Title');

    // 3. 验证实时更新（防抖）
    await page.waitForTimeout(300);
    const preview = await page.locator('.preview-title').textContent();
    expect(preview).toBe('Updated Title');

    // 4. 保存并验证
    await page.click('button:text("Save")');
    await expect(page.locator('text=Saved successfully')).toBeVisible();

    // 5. 取消操作验证（状态回退）
    await page.goto('/items/1');
    const savedTitle = await page.locator('.item-title').textContent();
    expect(savedTitle).toBe('Updated Title');
  });
});
```

#### 路径 3：状态切换流程

```typescript
// e2e/state-toggle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('State Toggle', () => {
  beforeEach(async ({ page }) => {
    await page.loginAs('test-user'); // 自定义 fixture
  });

  test('should toggle between states correctly', async ({ page }) => {
    // 1. 初始状态验证
    const initialState = await page.locator('.status-badge').getAttribute('data-status');
    expect(initialState).toBe('active');

    // 2. 切换状态
    await page.click('[data-testid="toggle-button"]');

    // 3. 验证 UI 变化
    await expect(page.locator('.status-inactive')).toBeVisible();
    await expect(page.locator('.status-active')).not.toBeVisible();

    // 4. 在新状态下操作
    await page.click('text=Perform Action in Inactive State');
    await expect(page.locator('text=Action disabled in inactive state')).toBeVisible();

    // 5. 恢复默认状态
    await page.click('[data-testid="toggle-button"]');
    await expect(page.locator('.status-active')).toBeVisible();
  });
});
```

#### 路径 4：导出/输出流程

```typescript
// e2e/export-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Export Flow', () => {
  test('should export data to file', async ({ page }) => {
    // 1. 触发导出
    await page.goto('/dashboard');
    await page.click('button:text("Export")');

    // 2. 处理下载事件
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download as CSV');
    const download = await downloadPromise;

    // 3. 验证文件
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/export-\d{8}\.csv$/);

    // 4. 保存并验证内容
    const filePath = `./downloads/${fileName}`;
    await download.saveAs(filePath);

    const content = require('fs').readFileSync(filePath, 'utf-8');
    expect(content.split('\n').length).toBeGreaterThan(1); // 至少有header+1行数据
  });
});
```

#### 路径 5：预览/展示流程

```typescript
// e2e/preview-mode.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Preview Mode', () => {
  test('should show preview and return to edit mode', async ({ page }) => {
    // 1. 进入预览
    await page.goto('/editor/123');
    await page.click('button:text("Preview")');

    // 2. 验证预览展示正确
    await expect(page.locator('.preview-container')).toBeVisible();
    await expect(page.locator('.editor-toolbar')).not.toBeVisible();

    // 3. 验证预览内容与实际一致
    const editorContent = await page.locator('.editor-content').innerHTML();
    const previewContent = await page.locator('.preview-rendered').innerHTML();
    // 注意：这里可能需要简化比较逻辑
    expect(previewContent.length).toBeGreaterThan(0);

    // 4. 退出预览
    await page.click('button:text("Exit Preview")');
    await expect(page.locator('.editor-toolbar')).toBeVisible();
  });
});
```

### Step 3：边界情况检查（8个场景）

| 场景 | 测试方法 | 预期行为 |
|------|---------|----------|
| **空数据状态** | 清空所有数据后访问页面 | 显示"暂无数据"提示，无 JS 错误 |
| **删除最后一条** | 删除列表最后一项 | 显示空状态，不崩溃 |
| **快速连续操作** | 快速点击按钮5次 | 只执行一次，或显示节流提示 |
| **同一操作重复执行** | 提交相同表单两次 | 幂等性：第二次应提示"已存在" |
| **网络超时** | mock API 延迟 >10s | 显示超时提示，提供重试按钮 |
| **无效输入** | 输入特殊字符、XSS 尝试 | 自动转义或拒绝，无安全漏洞 |
| **大数量数据** | 加载1000+项 | 虚拟滚动正常工作，无卡顿 |
| **并发请求** | 同时触发多个异步操作 | 正确处理竞态条件 |

**边界情况测试示例：**

```typescript
// e2e/boundary-cases.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Boundary Cases', () => {
  test('should handle empty state gracefully', async ({ page }) => {
    await page.route('**/api/items', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );

    await page.goto('/items');
    await expect(page.locator('text=No items found')).toBeVisible();
    await expect(page.locator('.error-message')).not.toBeVisible();
  });

  test('should handle rapid clicks', async ({ page }) => {
    let clickCount = 0;
    await page.route('**/api/submit', route => {
      clickCount++;
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.goto('/form');
    const button = page.locator('button[type="submit"]');

    // 快速点击5次
    await Promise.all([
      button.click(),
      button.click(),
      button.click(),
      button.click(),
      button.click(),
    ]);

    // 验证只发送了1次请求（防抖/节流）
    expect(clickCount).toBeLessThanOrEqual(2);
  });
});
```

### Step 4：视口测试（响应式布局）

```typescript
// e2e/responsive.spec.ts
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 600 },
  { name: 'Mobile', width: 375, height: 667 },
];

for (const viewport of viewports) {
  test(`${viewport.name}: layout should be usable`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    // 验证主要内容可见
    await expect(page.locator('main')).toBeVisible();

    if (viewport.width < 768) {
      // 移动端：汉堡菜单应该可见
      await expect(page.locator('.hamburger-menu')).toBeVisible();
      // 侧边栏应该隐藏
      await expect(page.locator('.sidebar')).not.toBeVisible();
    } else {
      // 桌面端：侧边栏应该可见
      await expect(page.locator('.sidebar')).toBeVisible();
    }
  });
}
```

### Step 5：发现 Bug 自动修复流程

当 QA 发现 Bug 时，按以下流程处理：

```
发现 Bug
    ↓
记录到 Bug 列表 (.harness/qa/bugs-YYYY-MM-DD.md)
    ↓
调用 systematic-debugging 定位根因
    ↓
修复 Bug + 编写回归测试
    ↓
重新运行 QA 验证修复
    ↓
关闭 Bug 并更新报告
```

**Bug 报告模板：**

```markdown
## Bug Report: [简短描述]

**日期**: 2026-05-06
**严重程度**: P0/P1/P2/P3
**复现步骤**:
1. 打开页面 `/path`
2. 点击元素 `[selector]`
3. 输入值 `...`
4. 观察结果

**预期行为**: [应该发生什么]
**实际行为**: [实际发生了什么]

**环境**: Chrome 120 / macOS / 1440x900

**截图**: `.harness/qa/screenshots/bug-001.png`

**根因分析**: [systematic-debugging 的结论]
**修复方案**: [具体修复代码位置]
**回归测试**: [新增的测试用例]
```

### Step 6：生成 QA 报告

```typescript
// scripts/generate-qa-report.ts（辅助脚本）
import * as fs from 'fs';
import * as path from 'path';

interface QAResult {
  path: string;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
}

function generateReport(results: QAResult[]): string {
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return `# QA Verification Report

**Date**: ${new Date().toISOString().split('T')[0]}
**Environment**: Chromium 120 / macOS
**Summary**: ${passed} passed, ${failed} failed (${((passed / results.length) * 100).toFixed(1)}%)

## Test Results

${results.map(r => `- [${r.status === 'passed' ? '✅' : '❌'}] ${r.path} (${r.duration}ms)`).join('\n')}

## Failed Tests Details

${results.filter(r => r.status === 'failed').map(r => `
### ${r.path}
**Error**: ${r.error}
`).join('\n')}

## Screenshots
See `.harness/qa/screenshots/` for visual evidence.
`;
}

// Usage: npx ts-node scripts/generate-qa-report.ts
```

## Playwright Selector 策略指南（关键！）

### 优先级排序（从高到低）

#### 1️⃣ **角色属性选择器**（最稳定，推荐）

```typescript
// ✅ 最佳实践：使用 role 属性
page.getByRole('button', { name: 'Submit' });
page.getByRole('link', { name: 'Learn more' });
page.getByRole('textbox', { label: 'Email' });
page.getByRole('heading', { level: 1 });
page.getByRole('img', { name: 'Logo' });

// 表格专用
page.getByRole('row', { name: 'User: John Doe' });
page.getByRole('cell', { name: 'admin' });
```

**何时使用：** 交互元素、表单控件、导航链接、重要内容块

#### 2️⃣ **文本选择器**（较稳定）

```typescript
// ✅ 好的选择：使用可见文本
page.locator('text=Submit');
page.locator('text=/Submit Order/');
page.getByText('Welcome back');

// ⚠️ 注意：文本可能会变化（国际化）
page.locator('text=提交'); // 中文场景
```

**何时使用：** 按钮、链接标题、静态文本内容

#### 3️⃣ **测试 ID 选择器**（专为测试设计）

```typescript
// ✅ 专门用于测试的 data-testid 属性
page.locator('[data-testid="submit-button"]');
page.locator('[data-testid="email-input"]');
page.locator('[data-testid="user-avatar"]');

// React 示例：
// <Button data-testid="submit-button">Submit</Button>
```

**何时使用：** 复杂组件、无明确 role/文本的元素

#### 4️⃣ **Placeholder/Label 选择器**（表单专用）

```typescript
// ✅ 表单元素的好选择
page.getByPlaceholder('Enter email');
page.getByLabel('Username');
page.getByTitle('Close dialog');
```

**何时使用：** 表单输入框、带标签的控件

#### 5️⃣ **CSS 选择器**（最后手段，较脆弱）

```typescript
// ⚠️ 可能因重构而失效
page.locator('.btn-primary');
page.locator('#login-form');
page.locator('> div > form input[type="email"]');

// ❌ 避免：过于具体的选择器
page.locator('div.container > div.row > div.col-md-6 > form > div.form-group > input');
```

**何时使用：** 无法使用上述方法时的备用方案

### Selector 稳定性最佳实践

```typescript
// ❌ 脆弱：依赖 CSS 类名
await page.click('.submit-btn-class-123');

// ✅ 稳定：使用 role + 文本组合
await page.getByRole('button', { name: 'Submit' }).click();

// ❌ 脆弱：DOM 结构依赖
await page.locator('div > div:nth-child(2) > button');

// ✅ 稳定：使用 data-testid + 近邻选择器
await page.locator('[data-testid="form"]').getByRole('button', { name: 'Submit' });
```

## 页面等待策略

### 1. 智能等待（推荐）

```typescript
// ✅ 自动等待元素可交互
await page.getByRole('button', { name: 'Submit' }).click();
// Playwright 会自动等待：visible + enabled + stable

// ✅ 等待特定状态
await expect(page.locator('.loading-spinner')).not.toBeVisible(); // 等待消失
await expect(page.locator('.success-message')).toBeVisible(); // 等待出现
```

### 2. 显式等待（复杂场景）

```typescript
// 等待 API 请求完成
await page.waitForResponse('**/api/users');

// 等待网络空闲
await page.waitForLoadState('networkidle');

// 等待自定义条件
await page.waitForFunction(() => window.appReady === true);

// 带超时的等待
await page.waitForSelector('.modal', { timeout: 10000 });
```

### 3. 避免硬编码等待

```typescript
// ❌ 不推荐：固定时间等待
await page.waitForTimeout(3000); // 即使元素已就绪也要等3秒

// ✅ 推荐：智能等待
await page.locator('.result').waitFor({ state: 'attached' }); // 元素已挂载
```

## 失败处理（10个场景全覆盖）

| 失败场景 | 错误信息 | 检测方式 | 解决方案 | 恢复命令 |
|---------|---------|---------|---------|----------|
| **浏览器启动失败** | `Executable doesn't exist` | try-catch 包裹 launch | 运行安装命令 | `npx playwright install chromium` |
| **开发服务器未启动** | `ECONNREFUSED` | curl 检查端口 | 启动 dev server | `npm run dev &` |
| **页面加载超时** | `Navigation timeout` | `page.goto()` timeout | 增加超时或优化页面 | `await page.goto('/', { timeout: 60000 })` |
| **元素定位失败** | `Timeout waiting for selector` | `locator().waitFor()` | 更新选择器策略 | 参考 "Selector 策略指南" |
| **截图保存失败** | `ENOENT: no such file or directory` | try-catch screenshot | 创建输出目录 | `mkdir -p .harness/qa/screenshots` |
| **网络请求失败** | `NET::ERR_CONNECTION_REFUSED` | 监听 page.on('request') | mock API 或启动后端 | `page.route('**/api', mockHandler)` |
| **权限不足** | `Permission denied` | 检查文件系统权限 | 修改目录权限 | `chmod 755 .harness/qa/` |
| **内存溢出** | `JavaScript heap out of memory` | 进程监控 | 减少并行测试数 | `npx playwright test --workers=2` |
| **视频录制失败** | `Failed to capture video` | 配置 video 选项 | 禁用视频或增加空间 | `use: { video: 'off' }` |
| **CI 环境兼容性** | `Display not found` | 检测 CI 环境 | 使用 headless 模式 | `PLAYWRIGHT_HEADLESS=1 npx playwright test` |

## 产出物（4个关键交付物）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| QA 验证报告 | `.harness/qa/YYYY-MM-DD-qa-report.md` | Markdown | 测试结果汇总、通过率、失败详情 | **必需** |
| 截图证据 | `.harness/qa/screenshots/<scenario>-<viewport>.png` | PNG | 关键步骤的视觉证据（失败时必留） | **必需** |
| Bug 列表 | `.harness/qa/bugs-YYYY-MM-DD.md` | Markdown | 发现的问题及跟踪状态 | **必需** |
| 测试覆盖率报告 | `.harness/qa/coverage/` | HTML/Istanbul | E2E 覆盖率统计（如启用） | 推荐 |

## 与其他 Skill 的协作矩阵

| 协作 Skill | 协作时机 | 协作内容 | 数据流向 |
|-----------|---------|---------|---------|
| **TDD** | TDD 单测通过后 | 接管浏览器验证 | 单测结果 → QA 触发 |
| **systematic-debugging** | 发现 Bug 时 | 定位根因 | Bug 现象 → 根因分析 |
| **verification-before-completion** | QA 通过后 | 收集最终证据 | QA 报告 → 验证清单 |
| **requesting-code-review** | QA 通过后 | 代码审查 | Bug 修复 → Review |
| **e2e-qa** | L1 通过后需要更严格验证 | 升级到 L2+/Obscura | L1 结果 → L2 测试 |
| **performance-testing** | 性能相关 Bug | 深入性能分析 | 性能指标 → 优化建议 |

## 配置文件示例

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: '.harness/qa/report' }],
    ['json', { outputFile: '.harness/qa/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## 质量门禁检查（QA 通过标准）

- [ ] 所有核心路径测试通过（5/5）
- [ ] 边界情况覆盖率 ≥ 80%（至少 6/8）
- [ ] 三种视口测试全部通过（桌面/平板/手机）
- [ ] 无 P0 Bug（阻塞性问题）
- [ ] P1 Bug ≤ 2 个（一般性问题）
- [ ] 截图证据完整（每个失败场景都有截图）
- [ ] QA 报告已生成且格式正确
- [ ] 测试执行时间合理（<5分钟）

## 下一步行动

QA 通过后：

1. **有 Bug？** → 调用 `systematic-debugging` 修复，然后重新运行 QA
2. **全部通过？** → 进入 `/review` 阶段进行代码审查
3. **需要更严格测试？** → 升级到 `e2e-qa`（L2+ 严格度）
4. **准备发布？** → 运行 `/verification-before-completion` 收集证据
