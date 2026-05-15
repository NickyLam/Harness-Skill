# Directory Standards by Tech Stack

## React / TypeScript / Node.js

```
project/
├── src/                    # 源代码
│   ├── components/         # React 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── utils/              # 工具函数
│   ├── types/              # 类型定义
│   └── __tests__/          # 测试文件（与实现同目录或独立）
├── docs/                   # 文档
│   ├── PRD.md              # 产品需求文档
│   └── PLAN.md             # 实施计划
├── .harness/               # Harness 工作区
│   ├── checkpoints/        # 检查点记录
│   ├── metrics/            # 度量数据
│   ├── plans/              # 波次计划
│   ├── reviews/            # 审查报告
│   ├── reports/            # 汇总报告
│   └── scripts/            # 门禁脚本
├── core/                   # Harness 核心配置
│   └── pipeline.yaml       # 流水线配置
└── package.json            # 项目依赖
```

## Python

```
project/
├── src/                    # 源代码
│   ├── __init__.py
│   ├── modules/
│   └── tests/              # 测试文件
├── docs/                   # 文档
├── .harness/               # Harness 工作区
├── core/                   # Harness 核心配置
└── requirements.txt        # 项目依赖
```

## Go

```
project/
├── cmd/                    # 入口点
├── internal/               # 内部包
├── pkg/                    # 公开包
├── docs/                   # 文档
├── .harness/               # Harness 工作区
├── core/                   # Harness 核心配置
└── go.mod                  # 模块定义
```

## 通用规范

- **测试文件命名**: 与实现文件同名，后缀 `.test.{ext}` 或 `.spec.{ext}`
- **文档位置**: `docs/` 目录，PRD.md 和 PLAN.md 为必需
- **Harness 工作区**: `.harness/` 目录，包含所有 Harness 产出物
- **流水线配置**: `core/pipeline.yaml` 为统一配置入口
