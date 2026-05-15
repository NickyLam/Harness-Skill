---
id: e2e-qa
name: "E2E QA — 真实浏览器验证"
stage: [test, ship]
roles: [tester, shipper]
pattern: browser-validation
mandatory: false
depends: []
version: "3.0"
description: "When the user mentions e2e test, browser validation, end-to-end test, or needs to verify functionality in real browsers, ALWAYS use this skill. Provides multi-viewport validation with automatic bug fixing."
---

# E2E QA — 真实浏览器验证

> **层级**: L2 方法论能力库
> **模式**: Browser Validation（浏览器验证）
> **阶段**: test, ship
> **角色**: Tester, Shipper
> **严格度要求**: L2+
> **浏览器引擎**: Playwright (默认) / Obscura (可选加速，详见 [obscura-browser.md](./obscura-browser.md))

## 核心原则

1. **真实环境验证** — 在真实浏览器中验证，不是模拟
2. **用户路径驱动** — 按用户实际操作路径验证
3. **自动修复** — 发现 Bug 自动修 + 自动生成回归测试
4. **全视口覆盖** — 桌面 + 平板 + 手机

## 浏览器引擎选择策略

支持两种浏览器引擎，按可用性自动选择：

| 优先级 | 引擎 | 条件 | 说明 |
|--------|------|------|------|
| 🥇 | Playwright (内置) | 始终可用 | 默认选择，功能完整 |
| 🥈 | Obscura (可选) | 已安装时优先 | 轻量快速，详见 [obscura-browser.md](./obscura-browser.md) |

> **Obscura 安装与配置指南**：详见同目录下 [obscura-browser.md](./obscura-browser.md)，包含安装脚本、CDP 配置、Stealth 模式和故障排查。

## 执行流程

### Phase 1: 浏览器环境准备

```bash
# 1. 执行浏览器检测与初始化（见上方代码）
# 2. 启动开发服务器
npm run dev &
DEV_SERVER_PID=$!
sleep 3

# 3. 等待服务就绪
until curl -s http://localhost:5173 > /dev/null; do
  sleep 1
done
echo "✅ 开发服务器已就绪: http://localhost:5173"
```

### Phase 2: 核心 E2E 测试（基于 Playwright + Obscura CDP）

```typescript
// e2e/obscura-setup.ts
import { chromium } from 'playwright-core';

export async function createBrowser() {
  const cdpUrl = process.env.HARNESS_CDP_URL || 'ws://127.0.0.1:9222';
  
  const browser = await chromium.connectOverCDP({
    endpointURL: cdpUrl,
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  
  return context.newPage();
}
```

```typescript
// e2e/user-flow.spec.ts
import { test, expect } from '@playwright/test';
import { createBrowser } from './obscura-setup';

test.describe('核心用户路径', () => {
  test('首页加载与渲染', async () => {
    const page = await createBrowser();
    await page.goto('http://localhost:5173');
    
    // 验证页面标题
    await expect(page).toHaveTitle(/Todo App/);
    
    // 验证核心元素存在
    await expect(page.locator('[data-testid="todo-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="todo-list"]')).toBeVisible();
    
    await page.close();
  });

  test('添加 Todo 流程', async () => {
    const page = await createBrowser();
    await page.goto('http://localhost:5173');
    
    // 输入新任务
    await page.fill('[data-testid="todo-input"]', '学习 Harness Skill');
    await page.click('[data-testid="submit-btn"]');
    
    // 验证添加成功
    await expect(page.locator('[data-testid="todo-item"]')).toContainText('学习 Harness Skill');
    
    await page.close();
  });
});
```

### Phase 3: 多视口覆盖测试

```typescript
// e2e/viewport.spec.ts
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 600 },
  mobile: { width: 375, height: 667 },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`${name} 视口布局验证`, async () => {
    const page = await createBrowser();
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:5173');
    
    // 截图对比
    await page.screenshot({ path: `e2e-screenshots/${name}-layout.png`, fullPage: true });
    
    // 验证响应式布局
    if (name === 'mobile') {
      await expect(page.locator('.mobile-nav')).toBeVisible();
    }
    
    await page.close();
  });
}
```

### Phase 4: 边界情况与异常处理

```typescript
// e2e/boundary.spec.ts
test.describe('边界情况', () => {
  test('空提交处理', async () => {
    const page = await createBrowser();
    await page.goto('http://localhost:5173');
    
    // 不输入直接提交
    await page.click('[data-testid="submit-btn"]');
    
    // 应显示验证提示或无变化
    await expect(page.locator('.error-message')).toHaveCount(0);
    
    await page.close();
  });

  test('超长文本输入', async () => {
    const page = await createBrowser();
    await page.goto('http://localhost:5173');
    
    const longText = 'A'.repeat(10000);
    await page.fill('[data-testid="todo-input"]', longText);
    
    // 应截断或拒绝
    const inputValue = await page.inputValue('[data-testid="todo-input"]');
    expect(inputValue.length).toBeLessThanOrEqual(500);
    
    await page.close();
  });

  test('网络错误恢复', async () => {
    const page = await createBrowser();
    
    // Mock 网络失败
    await page.route('**/api/todos', route => route.abort());
    await page.goto('http://localhost:5173');
    
    // 应显示错误状态而非白屏
    await expect(page.locator('.error-state') || page.locator('.retry-btn')).toBeVisible();
    
    await page.close();
  });
});
```

### Phase 5: Bug 发现与自动修复循环

```
发现 Bug
    ↓
调用 systematic-debugging Capsule
    ↓
定位根因 (四阶段调查)
    ↓
TDD 修复 (RED → GREEN → REFACTOR)
    ↓
回归测试 (本 Capsule 重新运行)
    ↓
通过? ──No──→ 继续 Fix Loop (最多 3 轮)
    │
   Yes
    ↓
生成证据报告
```

## 浏览器引擎高级用法

> **Stealth 模式、并行爬取、DOM 提取**等高级功能详见 [obscura-browser.md](./obscura-browser.md)。

## 清理资源

```bash
# 测试完成后清理
function cleanup() {
  # 关闭 Obscura CDP 服务
  if [ -n "$OBSUCRA_PID" ]; then
    kill $OBSUCRA_PID 2>/dev/null
  fi
  
  # 关闭开发服务器
  if [ -n "$DEV_SERVER_PID" ]; then
    kill $DEV_SERVER_PID 2>/dev/null
  fi
}

trap cleanup EXIT
```

## 触发条件

- `/harness test` 在 L2+ 严格度下触发
- 发布前验证 (`/harness ship`)
- Fix Loop 回归测试

## 输出交接

→ `verification`: 浏览器验证结果作为验证证据
→ `systematic-debugging`: 发现的 Bug 进入调试流程
→ `capsules/obscura-browser.md`: 浏览器配置参考文档

## 性能基准

> **详细性能对比数据（Obscura vs Chrome）** 详见 [obscura-browser.md](./obscura-browser.md)。

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| Obscura/浏览器引擎不可用 | 回退到标准 Playwright 模式 | 安装浏览器后重新启用 |
| Dev Server 启动失败 | 检查端口占用和启动命令 | 修复启动命令后重试 |
| 测试用例超时 | 按场景调整超时阈值 | 优化测试步骤后重试 |
| 跨浏览器不一致 | 记录差异，标注为浏览器特定问题 | 针对性修复后重试 |
