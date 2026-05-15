---
id: project-init
name: "Project Init — 项目快速初始化"
description: "Use when the user mentions /init, scaffold, new project, or needs to initialize a project. Handles project scaffolding with templates. NOT for adding features to existing projects."
stage: cross-cutting
roles: [architect]
pattern: scaffolding
mandatory: false
depends: []
version: "4.0.0"
---

# Project Init — 项目快速初始化

> 5 分钟生成完整可运行的项目骨架

## 何时使用

✅ **使用**:
- 用户输入 `/init` 或 `scaffold`
- 新建项目需要快速搭建
- 创建符合规范的项目结构

❌ **不使用**:
- 为现有项目添加功能
- 修改现有配置

## 核心流程

### 1. 模式选择

```
项目类型:
├─ 前端 Web → React/Vue/HTML
├─ 后端 API → Node.js/Python/Go
├─ 全栈 → Next.js/Nuxt.js
└─ 库/包 → TypeScript Library
```

### 2. 特性选择

| 特性 | 默认 | 说明 |
|------|------|------|
| ESLint + Prettier | ✅ | 代码规范 |
| Git Hooks (Husky) | ✅ | 提交检查 |
| Testing (Vitest/Jest) | ✅ | 单元测试 |
| CI/CD (GitHub Actions) | ⬜ | 自动部署 |
| Docker | ⬜ | 容器化 |

### 3. 生成结构

```
my-project/
├── src/
│   ├── components/
│   ├── pages/
│   └── index.ts
├── tests/
├── .github/workflows/
├── package.json
└── README.md
```

## 使用方式

```bash
# 交互式
harness init

# 或指定模板
harness init --template react-ts --strictness L2
```

## 详细文档

| 文档 | 内容 |
|------|------|
| [references/templates.md](references/templates.md) | 所有模板详情 |
| [references/react-setup.md](references/react-setup.md) | React 项目配置 |
| [references/typescript.md](references/typescript.md) | TypeScript 配置 |
| [references/testing.md](references/testing.md) | 测试框架设置 |
| [references/ci-cd.md](references/ci-cd.md) | CI/CD 配置 |

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 4.0.0 | 2026-05-07 | 拆分为 references，优化触发条件 |
| 3.1 | 2026-04-30 | 添加银行模板支持 |
| 3.0 | 2026-04-28 | 初始版本 |
