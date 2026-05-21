# Harness Engineering Skill

> 多智能体软件研发协作引擎 — 融合 GSD + GSTACKS + Superpowers 四大研发流程优势，构建统一的全生命周期 AI 研发引擎

## 概述

Harness 是一个规范驱动的软件交付 Skill，提供从需求到发布的全生命周期管控：

- **SDD（规范驱动开发）** — 先规范，后实现
- **TDD（测试驱动开发）** — 先测试，后编码
- **Gate 门禁** — 每个阶段必须通过质量检查

## 7-Stage 增量流水线

```
spec → plan → build → test → review → simplify → ship
```

| 阶段 | 职责 | 触发命令 |
|------|------|---------|
| spec | 需求分析、方案决策 | `/harness spec` |
| plan | 架构规划、任务拆分 | `/harness plan` |
| build | TDD 编码、微任务执行 | `/harness build` |
| test | 测试执行、覆盖率分析 | `/harness test` |
| review | 代码审查、质量检查 | `/harness review` |
| simplify | 代码简化、复杂度降低 | `/harness simplify` |
| ship | 发布准备、上线 | `/harness ship` |

## 核心特性

### 1. Append-Only 记忆 + 阶段蒸馏

- 运行时只追加日志，避免并行写入冲突
- 阶段完成时自动提炼为结构化记忆
- 跨会话持久化，经验可复用

### 2. 超时约束 + 文件心跳

- 子代理声明超时上限
- 关键步骤写入心跳文件
- 事后检测执行完整性

### 3. 协作等级声明

| 等级 | 名称 | 确认策略 |
|------|------|---------|
| L3 | 高协作 | 每个关键决策都确认 |
| L2 | 标准协作 | 关键决策确认，非关键自动执行 |
| L1 | 低协作 | 仅 P0 确认，其余自动 |
| L0 | 全自主 | 零确认 |

### 4. 条件触发式 Evolution

- 会话启动时自动健康度检查
- Gate 通过率低于阈值时建议运行进化评估
- `/harness evolve` 手动触发改进

## 目录结构

```
Harness_Skill/
├── core/                    # 核心 Skill 定义
│   ├── skills/              # 37+ Capsule 能力模块
│   ├── engine/              # 执行引擎
│   ├── memory/              # 记忆管理
│   ├── evolution/           # 进化循环
│   ├── roles/               # 6 个角色定义
│   ├── profiles/            # 技术栈配置
│   └── pipeline.yaml        # 流水线定义
├── agent/                   # Trae 自定义智能体
│   ├── harness-engineer.md  # 智能体配置
│   ├── scripts/             # 辅助脚本
│   └── README.md            # 使用说明
├── .workbuddy/              # WorkBuddy Agent YAML
├── skill-dist/              # 分发版本
└── SKILL.md                 # 主入口
```

## 安装

### 方式 1：使用同步脚本

```bash
cd Harness_Skill
bash scripts/sync-to-global.sh
```

### 方式 2：手动复制

```bash
cp -r skill-dist/ ~/.trae-cn/skills/harness-skill/
```

### 安装智能体

```bash
cp agent/harness-engineer.md ~/.trae-cn/agents/harness-engineer.md
```

## 使用方式

### 方式 1：作为 Skill 使用

在 Trae 中直接输入命令：

```
/harness spec 帮我实现一个用户登录功能
```

### 方式 2：作为智能体使用

1. 在 Trae 中选择 `harness-engineer` 智能体
2. 输入你的软件开发需求
3. 智能体会自动路由到正确的阶段并执行

## 技术栈支持

| 技术栈 | 配置文件 |
|--------|---------|
| Generic | `profiles/generic.yaml` |
| Python | `profiles/python.yaml` |
| Java | `profiles/java.yaml` |
| Go | `profiles/go.yaml` |
| React + TypeScript | `profiles/react-typescript.yaml` |

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 4.0.0 | 2026-05-21 | Loop 优化：Append-Only 记忆 + 协作等级 + 条件触发 Evolution |
| 3.2.0 | 2026-05-15 | Expert Team 模式 + Wave 并行执行 |
| 3.0.0 | 2026-04-30 | Pre-Execution Safety Gate |
| 2.0.0 | 2026-04-28 | MCP 增强版 |

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
