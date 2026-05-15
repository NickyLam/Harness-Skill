# Memory Management Schema — 记忆管理规范

> **层级**: L5 治理层支撑
> **设计模式**: Pipeline（写入 → 检索 → 提炼 → 固化）

## 核心原则

1. **写入即承诺** — 写入 memory 的内容必须准确、可追溯
2. **分层存储** — Daily Log（原始）→ MEMORY.md（提炼）→ Skill（固化）
3. **检索优先** — 遇到同类任务先查 memory，不重复踩坑
4. **定期蒸馏** — 30 天以上的 daily log 必须提炼后归档

## 目录结构

```
.harness/memory/
├── MEMORY.md              # 长期项目记忆（curated，人工维护）
├── YYYY-MM-DD.md          # 每日工作日志（append-only，自动生成）
└── archive/               # 已蒸馏的旧日志归档
```

## Daily Log 格式

每次任务完成后**自动追加**到当日日志:

```markdown
### HH:MM — {任务简述}

**执行**: {做了什么}
**结果**: ✅ 成功 / ❌ 失败 / ⚠️ 部分成功
**关键决策**: {为什么选这个方案}
**踩坑**: {遇到的问题和解决方法}
**经验**: {下次遇到同样情况该怎么做}
```

## MEMORY.md 更新规则

MEMORY.md 是长期项目记忆，只在以下情况下更新:

| 触发条件 | 更新内容 | 示例 |
|---------|---------|------|
| 技术决策 | 决策及理由 | "选用 Vitest: Vite 原生支持" |
| 踩坑经验 | 问题和方案 | "react-dnd drop 用 dispatch" |
| 项目约定 | 团队规范 | "Hook 测试放 src/__tests__/hooks/" |
| 用户偏好 | 使用习惯 | "用户偏好中文输出" |
| Skill 效果 | 命中率统计 | "TDD命中率100%" |

**禁止写入**:
- ❌ 临时文件路径
- ❌ 中间搜索结果
- ❌ 工具错误信息（除非有解决方案）
- ❌ 敏感信息（密码/密钥/token）
- ❌ 未经确认的事实

## 检索流程

Agent 开始任何任务前:

```
1. 读取 .harness/memory/MEMORY.md     → 了解项目全貌
2. 读取最近 2 天的 Daily Log           → 了解近期上下文
3. 搜索相关 Capsule/SKILL            → 获取执行指南
4. 执行任务
5. 将新经验写入当日 Daily Log          → 沉淀知识
```

## 蒸馏规范（每月执行）

### 步骤
1. 读取 30 天前的 Daily Log 文件
2. 按主题分组（技术决策 / 踩坑 / 约定 / 偏好）
3. 将具体事件提炼为通用规则
4. 写入/更新 MEMORY.md
5. 将已蒸馏的 Daily Log 移入 archive/

### 提炼示例

**原始 Daily Log**:
```
2026-04-27: 安装 vitest 时 npm install 卡住，
改用写入 package.json 后重新 install 解决
```

**提炼后的 MEMORY.md 条目**:
```markdown
### 包管理
- **npm install 卡住**: 直接修改 package.json 后运行 `npm install`
  比命令行添加依赖更可靠
```

## 与其他组件的协作

| 组件 | 协作方式 |
|------|---------|
| governance | governance 定义"何时沉淀"，memory 定义"怎么写" |
| orchestrator | 角色切换时读 memory 获取上下文 |
| systematic-debugging | 调试前先查 memory 中的 bug patterns |
| gating | Gate 失败的原因记入 memory |
