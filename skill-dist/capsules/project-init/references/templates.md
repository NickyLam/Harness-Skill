# 项目模板详情

## 1. 前端 Web 模板

### React + TypeScript + Tailwind

**目录结构**:
```
src/
├── components/
│   ├── ui/              # UI 基础组件
│   └── layout/          # 布局组件
├── pages/               # 页面
├── hooks/               # 自定义 hooks
├── stores/              # 状态管理
├── types/               # 类型定义
├── utils/               # 工具函数
└── api/                # API 请求
```

**默认配置**:
- Vite + React 18
- TypeScript 严格模式
- Tailwind CSS
- React Router v6
- Zustand (状态管理)
- React Query (数据获取)

### Vue 3 + TypeScript

**目录结构**:
```
src/
├── components/
├── views/
├── composables/         # 组合式函数
├── stores/              # Pinia
├── types/
└── api/
```

## 2. 后端 API 模板

### Node.js + Express

```
src/
├── controllers/
├── services/
├── models/
├── middleware/
├── routes/
└── utils/
```

### Python + FastAPI

```
app/
├── routers/
├── models/
├── schemas/
├── services/
└── core/
```

### Go + Gin

```
internal/
├── handlers/
├── services/
├── repositories/
└── models/
cmd/
└── server/
```

## 3. 全栈模板

### Next.js (App Router)

```
app/
├── (auth)/
├── (dashboard)/
└── api/
src/
├── components/
├── lib/
└── types/
```

## 4. 库/包模板

### TypeScript Library

```
src/
├── index.ts
├── utils/
└── types/
tests/
dist/          # 构建输出
```

## 模板变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{PROJECT_NAME}}` | 项目名称 | my-app |
| `{{DESCRIPTION}}` | 项目描述 | A awesome app |
| `{{AUTHOR}}` | 作者 | John Doe |
| `{{YEAR}}` | 年份 | 2026 |
| `{{LICENSE}}` | 许可证 | MIT |
