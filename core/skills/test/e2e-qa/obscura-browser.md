# Browser Engine — E2E 测试浏览器配置

> **层级**: L1 基础设施
> **类型**: Browser Engine（浏览器引擎）
> **阶段**: test, ship
> **策略**: 自动检测 + 优先级降级

## 浏览器优先级

系统按以下顺序自动检测可用浏览器引擎，**优先使用第一个可用的**：

```
优先级顺序:
1. Obscura        — 轻量无头浏览器（如已安装）
2. Playwright     — 通过 Node.js 生态（chromium/firefox/webkit）
3. Puppeteer      — Headless Chrome（需 Chrome/Chromium）
4. 系统浏览器    — 已安装的 Chrome / Safari / Firefox（有头模式）
```

## 自动检测与选择

### 检测脚本（内置）

```bash
# === browser-detect.sh — 自动选择最佳浏览器引擎 ===

detect_browser() {
    # 1. 检测 Obscura（轻量首选）
    if command -v obscura &> /dev/null; then
        echo "obscura"
        return 0
    fi

    # 2. 检测 Playwright
    if command -v npx &> /dev/null && npx playwright --version &> /dev/null 2>&1; then
        echo "playwright"
        return 0
    fi

    # 3. 检测 Puppeteer / Chrome
    if command -v npx &> /dev/null && [ -d "node_modules/puppeteer" ] 2>/dev/null; then
        echo "puppeteer"
        return 0
    fi

    # 4. 检测系统 Chrome
    if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] 2>/dev/null \
       || command -v google-chrome &> /dev/null \
       || command -v chromium-browser &> /dev/null; then
        echo "chrome"
        return 0
    fi

    # 5. 检测系统 Firefox
    if command -v firefox &> /dev/null; then
        echo "firefox"
        return 0
    fi

    # 无可用浏览器
    echo "none"
    return 1
}

BROWSER_ENGINE=$(detect_browser)
echo "Detected browser engine: ${BROWSER_ENGINE}"
```

### TypeScript 检测实现

```typescript
// browser-detect.ts — E2E 浏览器自动检测

export type BrowserEngine = 'obscura' | 'playwright' | 'puppeteer' | 'chrome' | 'firefox' | 'none';

interface BrowserDetectionResult {
  engine: BrowserEngine;
  displayName: string;
  launchOptions: Record<string, unknown>;
}

const BROWSER_PRIORITY: Array<{ engine: BrowserEngine; name: string; detect: () => Promise<boolean> }> = [
  {
    engine: 'obscura',
    name: 'Obscura (Lightweight Headless)',
    detect: async () => {
      const { execAsync } = await import('../exec-async.js');
      try {
        await execAsync('command -v obscura', { timeout: 5000 });
        return true;
      } catch { return false; }
    },
  },
  {
    engine: 'playwright',
    name: 'Playwright (Node.js Ecosystem)',
    detect: async () => {
      const { execAsync } = await import('../exec-async.js');
      try {
        await execAsync('npx playwright --version', { timeout: 10000 });
        return true;
      } catch { return false; }
    },
  },
  {
    engine: 'puppeteer',
    name: 'Puppeteer (Headless Chrome)',
    detect: async () => {
      const { existsSync } = await import('fs');
      return existsSync('node_modules/puppeteer') || existsSync('node_modules/puppeteer-core');
    },
  },
  {
    engine: 'chrome',
    name: 'System Chrome/Chromium',
    detect: async () => {
      const { execAsync } = await import('../exec-async.js');
      try {
        await execAsync('command -v google-chrome || command -v chromium-browser || test -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"', { timeout: 5000 });
        return true;
      } catch { return false; }
    },
  },
  {
    engine: 'firefox',
    name: 'System Firefox',
    detect: async () => {
      const { execAsync } = await import('../exec-async.js');
      try {
        await execAsync('command -v firefox', { timeout: 5000 });
        return true;
      } catch { return false; }
    },
  },
];

/**
 * 自动检测最佳可用浏览器引擎
 * @returns 第一个可用的浏览器引擎检测结果
 */
export async function detectBrowser(): Promise<BrowserDetectionResult> {
  for (const candidate of BROWSER_PRIORITY) {
    const available = await candidate.detect();
    if (available) {
      return {
        engine: candidate.engine,
        displayName: candidate.name,
        launchOptions: getLaunchOptions(candidate.engine),
      };
    }
  }

  return {
    engine: 'none',
    displayName: 'No browser detected',
    launchOptions: {},
  };
}

function getLaunchOptions(engine: BrowserEngine): Record<string, unknown> {
  switch (engine) {
    case 'obscura':
      return { cdpEndpoint: 'ws://127.0.0.1:9222', stealth: true };
    case 'playwright':
      return { channel: 'chromium', headless: true };
    case 'puppeteer':
      return { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    case 'chrome':
      return { channel: 'chrome', headless: true };
    case 'firefox':
      return { channel: 'firefox', headless: true };
    default:
      return {};
  }
}
```

## 各引擎使用方式

### Obscura（如已安装）

```bash
# 启动 CDP 服务
obscura serve --port 9222 --stealth

# CLI 快速抓取
obscura fetch https://example.com --eval "document.title"

# Playwright 集成（通过 CDP）
npx playwright open --cdp-url ws://127.0.0.1:9222
```

> **注意**: Obscura 为可选依赖。系统不强制要求安装 Obscura，未安装时自动降级到其他浏览器。

### Playwright（默认推荐）

```bash
# 安装（如尚未安装）
npm init playwright@latest
# 或
npx playwright install chromium

# 运行测试
npx playwright test

# 有头模式调试
npx playwright test --headed
```

### Puppeteer（Chrome 降级）

```typescript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.goto('https://example.com');
console.log(await page.title());
await browser.close();
```

### 系统浏览器（最终降级）

当上述所有 Node.js 浏览器均不可用时，回退到系统已安装的浏览器：

| 系统 | 检测路径 |
|------|---------|
| macOS | `/Applications/Google Chrome.app/...` 或 `/Applications/Firefox.app/...` |
| Linux | `which google-chrome` 或 `which chromium-browser` 或 `which firefox` |
| Windows | `$PROGRAMFILES\\Google\\Chrome\\Application\\chrome.exe` |

## Harness Skill 集成配置

### 环境变量

```bash
# .harness/config.yaml 或 shell 环境
HARNESS_BROWSER_ENGINE=auto          # auto(默认) | obscura | playwright | puppeteer | chrome | firefox
HARNESS_CDP_PORT=9222                # CDP 服务端口（仅 obscura 需要）
HARNESS_HEADLESS=true                # 是否使用无头模式
```

### Playwright 配置示例

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { detectBrowser } from '../core/engine/browser-detect';

export default defineConfig({
  use: {
    // 根据检测结果自动配置
    ...(() => {
      // 同步模式下使用默认 chromium；异步检测在 test setup 中处理
      return { launchOptions: {} };
    })(),
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
  ],
});
```

### E2E 测试 Setup 中的自动选择

```typescript
// e2e/setup.ts — 测试前自动选择并启动浏览器
import { test as base, expect } from '@playwright/test';
import { detectBrowser } from '../../core/engine/browser-detect';

type WorkerFixture = {
  browserEngine: Awaited<ReturnType<typeof detectBrowser>>;
};

export const test = base.extend<WorkerFixture>({
  browserEngine: [async ({}, use) => {
    const result = await detectBrowser();
    if (result.engine === 'none') {
      throw new Error(
        'No usable browser detected. Install one of:\n' +
        '  • npm install playwright && npx playwright install\n' +
        '  • npm install puppeteer\n' +
        '  • Or ensure Chrome/Firefox is installed on the system'
      );
    }
    console.log(`[Harness] Using browser engine: ${result.displayName}`);
    await use(result);
  }, { scope: 'worker' }],
});

export { expect };
```

## 安装引导（可选）

当检测到无任何可用浏览器时，向用户提供安装建议：

```
╔══════════════════════════════════════════════════════════════╗
║  🔍 未检测到可用的 E2E 测试浏览器                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  请选择一种浏览器引擎进行安装:                                 ║
║                                                              ║
║  ① Playwright (推荐)                                        ║
║     npm init playwright@latest && npx playwright install     ║
║                                                              ║
║  ② Puppeteer                                                ║
║     npm install puppeteer                                    ║
║                                                              ║
║  ③ 系统浏览器降级                                           ║
║     确保 Chrome 或 Firefox 已安装在系统中                     ║
║                                                              ║
║  安装完成后重新运行即可自动检测。                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

## 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| No browser detected | 系统未安装任何支持的浏览器 | 按上方安装指引安装 Playwright 或 Puppeteer |
| `command not found: obscura` | Obscura 未安装（非必需） | 忽略此警告，系统会自动降级到 Playwright/Puppeteer |
| Connection refused on port 9222 | Obscura CDP 服务未启动 | 如需使用 Obscura，先运行 `obscura serve --port 9222` |
| 页面渲染异常 | 浏览器兼容性问题 | 在 config 中设置 `HARNESS_BROWSER_ENGINE=playwright` 强制切换 |
| 反爬检测触发 | 目标站有强 WAF | 使用 Playwright 的 stealth 插件或设置合理 User-Agent |

## 版本要求

- **最低要求**: 至少安装 Playwright 或 Puppeteer 其中之一
- **推荐配置**: Playwright + Chromium（开箱即用）
- **Obscura**: 可选，v0.1.0+（如有安装将自动优先使用）
