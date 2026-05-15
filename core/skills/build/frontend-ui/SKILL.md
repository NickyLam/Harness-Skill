---
id: frontend-ui
name: "Frontend UI - 高质量前端界面"
description: "Use when the user asks to build web interfaces, create landing pages, design components, or develop visually appealing UI. Covers both creative design (art direction) and production code. NOT for backend API design or database tasks."
stage: build
roles: [frontend-engineer]
pattern: frontend-ui
mandatory: false
depends: []
version: "1.0.0"
compatibility:
  tools: [Read, Write, Glob, Grep, RunCommand]
  dependencies: []
---

# Frontend UI - 高质量前端界面

> 融合创意设计 + 生产级代码

## 何时使用

✅ **使用 Frontend UI**:
- 创建网页/落地页
- 设计 UI 组件
- 美化现有界面
- React/Vue/HTML/CSS 开发

❌ **不使用**:
- 后端 API 设计
- 数据库任务
- 移动端原生开发

## 两种模式

### 模式 1: 创意设计 (Creative)

**触发**: 用户要求"创建独特的"、"艺术感"、"印象深刻"的界面

**流程**:
1. **设计思维**: 确定美学方向（极简/野兽派/复古未来等）
2. **视觉 thesis**: 一句话描述氛围、材质、能量
3. **执行**: 差异化设计，避免 AI 生成感

**设计原则**:
- 字体: 独特、有个性（避免 Inter/Roboto）
- 颜色: 统一、精准（避免紫渐变白底）
- 动效: 有意义、增强层次
- 空间: 出人意料的布局

### 模式 2: 产品 UI (Product)

**触发**: 仪表盘、管理后台、数据展示

**原则**:
- 保持克制（Linear 风格）
- 信息密度高但可读
- 强调排版和间距
- 少量颜色用于强调

## 核心规范

### 字体选择

| 类型 | 推荐 | 避免 |
|------|------|------|
| 展示字体 | Playfair Display, DM Serif | Inter, Roboto |
| 正文字体 | Source Sans Pro, Lora | Arial, Helvetica |

### 颜色系统

```css
:root {
  --primary: #3B82F6;
  --secondary: #64748B;
  --accent: #F59E0B;
  --background: #FFFFFF;
  --surface: #F8FAFC;
  --text: #1E293B;
  --text-muted: #64748B;
}
```

### 动效规则

| 类型 | 用途 | 时长 |
|------|------|------|
| 进入 | 建立层次 | 300-500ms |
| 悬停 | 增强反馈 | 150-200ms |
| 过渡 | 状态变化 | 200-300ms |

## 框架选择

| 框架 | 使用场景 |
|------|----------|
| React + Tailwind | 现代管理后台 |
| Vue 3 | 渐进增强 |
| 纯 HTML/CSS | 静态页面 |

## 文件结构

```
src/
├── components/      # 可复用组件
├── pages/          # 页面组件
├── hooks/          # 自定义 hooks
├── styles/         # 全局样式
└── utils/         # 工具函数
```

## 质量检查

- [ ] 设计独特，无 AI 生成感
- [ ] 响应式布局完整
- [ ] 交互状态完整（hover/active/disabled）
- [ ] 加载态/空态/错误态处理
- [ ] 可访问性（语义化 HTML）
