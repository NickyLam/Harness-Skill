---
id: browser-automation
name: "Browser Automation - 浏览器自动化"
description: "Use when the user needs to interact with websites, fill forms, click buttons, take screenshots, extract data, test web apps, or automate browser tasks. Supports Playwright, agent-browser, and web testing. NOT for backend testing or API testing."
stage: test
roles: [tester]
pattern: browser-automation
mandatory: false
depends: []
version: "1.0.0"
compatibility:
  tools: [RunCommand]
  dependencies: [Playwright, agent-browser]
---

# Browser Automation - 浏览器自动化

> 融合 agent-browser + webapp-testing

## 何时使用

✅ **使用 Browser Automation**:
- 网站交互自动化
- 表单填写和提交
- 截图和视觉测试
- 数据抓取
- E2E 测试
- 登录流程自动化

❌ **不使用**:
- 后端 API 测试
- 单元测试
- 数据库验证

## 工具选择

| 工具 | 场景 | 优势 |
|------|------|------|
| agent-browser | AI 代理使用 | CLI 友好、CDP 直连 |
| Playwright | Python/JS 测试 | 跨浏览器、生态丰富 |
| Selenium | 传统 Web | 历史项目兼容 |

## Playwright 工作流

### 基础模式

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # 导航
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # 交互
    page.fill('#username', 'admin')
    page.click('button[type="submit"]')

    # 验证
    assert page.url.endswith('/dashboard')

    browser.close()
```

### 服务器管理

```bash
# 启动开发服务器
python scripts/with_server.py \
  --server "npm run dev" --port 5173 \
  -- python test.py
```

## agent-browser 工作流

### 基础模式

```bash
# 安装
npm i -g agent-browser

# 交互流程
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser fill @e1 "text"
agent-browser click @e2
agent-browser screenshot result.png
```

### 认证处理

```bash
# 方式 1: 导入已有浏览器状态
agent-browser --auto-connect state save ./auth.json

# 方式 2: 持久化 profile
agent-browser --profile ~/.myapp open https://app.example.com/login

# 方式 3: Auth vault
echo "$PASSWORD" | agent-browser auth save myapp \
  --url https://app.example.com/login \
  --username user --password-stdin
```

## 测试模式

### 1. 探索-执行模式

```
1. 导航 + 等待 networkidle
2. 截图或检查 DOM
3. 从渲染状态识别选择器
4. 使用发现的选择器执行操作
```

### 2. 数据提取

```bash
agent-browser open https://example.com/products
agent-browser snapshot -i
agent-browser get text @e5           # 获取文本
agent-browser get text body > page.txt  # 全部文本
```

### 3. 视觉回归

```bash
# 基准截图
agent-browser screenshot baseline.png

# 比较
agent-browser diff screenshot --baseline baseline.png
```

## 最佳实践

| 实践 | 说明 |
|------|------|
| 等待 networkidle | 动态应用必须等待 |
| 使用语义选择器 | `text=`, `role=`, `data-testid` |
| 描述性命名 | 测试意图清晰 |
| 资源清理 | 总是关闭浏览器 |

## 常见陷阱

❌ **错误**: 在等待 `networkidle` 前检查 DOM
✅ **正确**: 先 `wait_for_load_state('networkidle')`

❌ **错误**: 使用脆弱的选择器（XPath 索引）
✅ **正确**: 使用 `role=`, `text=`, 语义化选择器

❌ **错误**: 忘记关闭浏览器
✅ **正确**: 使用 `with` 或 `finally` 确保清理

## 文件结构

```
tests/
├── e2e/
│   ├── login.spec.ts
│   ├── checkout.spec.ts
│   └── fixtures/
│       └── auth.json
├── screenshots/
│   ├── baseline/
│   └── diff/
└── helpers/
    └── with_server.py
```

## 集成 CI/CD

```yaml
# GitHub Actions 示例
- name: E2E Tests
  run: |
    npx playwright install
    npx playwright test
```

## 与其他 Skills

| Skill | 协作方式 |
|-------|---------|
| verification | 测试后验证 |
| e2e-qa | 完整 QA 流程 |
| performance-testing | 性能指标 |
