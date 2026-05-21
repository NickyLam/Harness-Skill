# Harness Engineering — 自定义智能体配置

> **版本**: 2.0.0（修正版，符合 Trae 实际格式）
> **适用平台**: Trae（非 SOLO 模式）
> **与现有 Skill 的关系**: 智能体引用已安装的 Harness Skill，不重复实现

## 文件说明

| 文件 | 用途 |
|------|------|
| `harness-engineer.md` | 智能体配置文件，复制到 `~/.trae-cn/agents/` |
| `scripts/init_dirs.py` | 目录初始化脚本（首次使用时通过 Bash 执行） |
| `scripts/memory_ops.py` | 记忆持久化脚本（通过 Bash 执行） |
| `scripts/evolve_ops.py` | 进化日志脚本（通过 Bash 执行） |

## 导入步骤

### 1. 安装 Harness Skill（如果尚未安装）

确保以下 Skill 已安装在 `~/.trae-cn/skills/`：
- `harness-engineering-skill/` — 7 个 Stage 的完整执行指南
- `harness-skill/` — Capsule + Engine + Profile + Role

### 2. 安装智能体

```bash
cp agent/harness-engineer.md ~/.trae-cn/agents/harness-engineer.md
```

或在 Trae UI 中：设置 → 智能体 → 新建 → 粘贴 `harness-engineer.md` 的内容。

### 3. 绑定 Skill

在智能体配置中绑定：
- `harness-engineering-skill`
- `harness-skill`

### 4. 复制辅助脚本到项目目录

```bash
cp -r agent/scripts/ ./agent_scripts/
```

### 5. 重启智能体

关闭并重新打开智能体对话，确保配置生效。

## 智能体与 Skill 的协作关系

```
用户选择 Harness Engineer 智能体
    │
    ├── 智能体 .md 文件（角色 + 执行流程 + 偏差规则 + 自进化）
    │   └── 内嵌：编排路由、记忆管理、健康度检查、自我进化
    │
    ├── 绑定 Skill: harness-engineering-skill（已安装）
    │   └── 提供 7 个 Stage 的完整执行指南
    │
    └── 绑定 Skill: harness-skill（已安装）
        └── 提供 Capsule + Engine + Profile + Role
```

**核心关系**：智能体是"入口和编排者"，已有的 Harness Skill 是"能力底座"。智能体不重复实现 Skill 的内容，只引用它。

## 持久化目录

```
./agent_memory/
├── memory_list.md        # 长期项目记忆（蒸馏产出）
└── logs/
    └── YYYY-MM-DD.md     # 每日工作日志（append-only）

./agent_config/
└── rule_update.log       # 进化迭代日志
```

## 注意事项

- 本目录（`agent/`）与现有 Skill 目录（`core/`、`skill-dist/`）完全独立
- 智能体通过引用已安装的 Skill 获取能力，不重复实现
- 辅助脚本需要复制到项目目录中，通过 Bash 工具执行
- 本智能体仅在 Trae 非 SOLO 模式下使用
- Trae SOLO 支持自定义智能体后，需重新适配
