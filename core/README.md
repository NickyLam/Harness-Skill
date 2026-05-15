# Harness Skill — Multi-Agent Software Development Engine

> 融合 GSD + GSTACKS + Superpowers 四大研发流程优势，构建统一的全生命周期 AI 研发引擎

## 🚀 特性

### Core Engine
- **Wave-Based Execution**: 波次并行执行引擎
- **Subagent Orchestration**: 多角色子代理协调
- **Mandatory Checkpoints**: 质量门禁守护
- **Evolution Loop**: 持续演进反馈

### Skills 体系
| 阶段 | Skills | 职责 |
|------|--------|------|
| **Plan** | writing-plans | 规划与任务分解 |
| **Spec** | brainstorming, deep-requirements, spec-generator, office-hours | 需求分析与规格设计 |
| **Build** | api-design, frontend-ui, systematic-debugging, tdd, subagent-driven-dev | 开发与测试驱动 |
| **Review** | requesting-code-review, receiving-code-review, code-simplification, staff-review | 代码审查 |
| **Ship** | ci-cd-pipeline, containerization, ship-pipeline | 部署交付 |
| **Test** | browser-automation, e2e-qa, performance-testing, security-audit, verification | 测试与验证 |
| **Cross-Cutting** | gsd, gating, governance, memory-management, onboarding, orchestrator, project-init, verification-before-completion | 跨阶段能力 |

## 🔧 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/harness-skill.git
cd harness-skill

# 安装依赖
npm install

# 同步到全局
./scripts/sync-to-global.sh
```

### 使用

```bash
# 初始化项目
harness init

# 运行评估
npm test

# 构建发布包
npm run build
```

## 📁 项目结构

```
Harness_Skill/
├── core/                     # 核心引擎与技能
│   ├── engine/              # 执行引擎
│   ├── skills/              # 技能库 (按阶段组织)
│   ├── roles/               # 角色定义
│   ├── profiles/            # 语言配置文件
│   └── pipeline/            # 流水线协议
├── skill-dist/              # 技能分发包
├── docs/                    # 文档
├── evals/                   # 评估测试
└── scripts/                 # 辅助脚本
```

## 🎯 Skills 分类

### Plan 阶段
- **writing-plans**: 编写详细执行计划

### Spec 阶段
- **brainstorming**: 头脑风暴与需求收集
- **deep-requirements**: 深度需求分析
- **spec-generator**: 规格文档生成
- **office-hours**: 需求澄清会议

### Build 阶段
- **api-design**: API 设计规范
- **frontend-ui**: 高质量前端界面开发
- **systematic-debugging**: 系统化调试
- **tdd**: 测试驱动开发
- **subagent-driven-dev**: 子代理驱动开发

### Review 阶段
- **requesting-code-review**: 请求代码审查
- **receiving-code-review**: 接收审查反馈
- **code-simplification**: 代码简化优化
- **staff-review**: 高级人员审查

### Ship 阶段
- **ci-cd-pipeline**: CI/CD 流水线配置
- **containerization**: 容器化部署
- **ship-pipeline**: 发布流水线

### Test 阶段
- **browser-automation**: 浏览器自动化测试
- **e2e-qa**: 端到端测试
- **performance-testing**: 性能测试
- **security-audit**: 安全审计
- **verification**: 功能验证

### Cross-Cutting 阶段
- **gsd**: Getting Stuff Done 核心引擎
- **gating**: 质量门禁系统
- **governance**: 治理与合规
- **memory-management**: 记忆管理
- **onboarding**: 项目入门引导
- **orchestrator**: 任务编排
- **project-init**: 项目初始化
- **verification-before-completion**: 完成前验证

## 📋 设计规范

### Skill 命名规范
- 使用 `kebab-case` 命名
- 格式: `{category}-{subcategory}`

### 文件结构
```
skill-name/
├── SKILL.md              # 主文件 (< 200 行)
├── README.md             # 详细文档
├── references/           # 参考文档
├── scripts/              # 可执行脚本
└── templates/            # 模板文件
```

### 触发条件规范
```yaml
---
name: "skill-name"
description: "触发条件 + 功能描述。不在什么场景触发。"
---
```

## 🧪 评估与测试

### 运行评估

```bash
# 运行所有评估
npm run eval

# 运行特定评估
npm run eval -- --skill gsd
npm run eval -- --skill tdd
```

### 评估报告

评估结果保存在 `evals/` 目录：
- `gsd-eval.json` - GSD 引擎评估
- `tdd-eval.json` - TDD 技能评估
- `gating-eval.json` - 门禁系统评估

## 🔄 同步到全局

```bash
# 同步所有 skills 到 Trae 全局
./scripts/sync-to-global.sh

# 同步单个 skill
./scripts/sync-to-global.sh --skill frontend-ui
```

## 📜 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**版本**: v4.0.0  
**最后更新**: 2026-05-07
