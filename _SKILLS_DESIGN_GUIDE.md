# Trae Skills 设计规范

## 1. 命名规范

### Skill 名称
- 使用 `kebab-case` 命名
- 格式: `{category}-{subcategory}` 或 `{framework}-{purpose}`
- 示例: `gsd-core`, `frontend-ui`, `browser-automation`

### Description 规范
```yaml
---
name: "skill-name"
description: "触发条件 + 功能描述。不在什么场景触发。"
---
```

**描述应该包含**:
1. **触发条件**: 何时使用此 skill
2. **核心功能**: skill 做什么
3. **排除条件**: 不在什么场景触发

## 2. 文件结构规范

```
skill-name/
├── SKILL.md              # 主文件 (< 200 行)
├── README.md             # 可选，详细文档
├── references/           # 参考文档
│   ├── overview.md
│   └── examples.md
├── scripts/              # 可执行脚本
└── templates/            # 模板文件
```

## 3. SKILL.md 结构

```yaml
---
name: "skill-name"
description: "简短触发描述"
version: "1.0.0"
---

# Skill 名称

## 概览
1-2 句话描述

## 触发条件
- 场景1
- 场景2

## 核心流程
### 步骤1
### 步骤2

## 最佳实践
-

## 示例
```
示例命令
```
```

## 4. 复杂度分级

| 级别 | SKILL.md 行数 | 引用文件 | 脚本 |
|------|--------------|----------|------|
| 简单 | < 100 行 | 0-1 | 0 |
| 中等 | 100-300 行 | 2-5 | 1-3 |
| 复杂 | > 300 行 | > 5 | > 3 |

**复杂 skill 应该拆分**: 拆分为中等 skill + references/

## 5. 触发条件优化

### 避免
- 过于宽泛: "Use for coding" (不知道何时触发)
- 过于具体: "Use when user types exactly 'create react app with redux'"
- 重复触发: 两个 skill 有相同触发条件

### 推荐
```yaml
# 好例子
description: "Use when user wants to create a React project from scratch. Not for existing projects."

# 避免
description: "Use for React development."
```

## 6. 必需元素

### frontmatter
```yaml
---
name: "required"
description: "required"
version: "recommended"
---
```

### 核心章节
1. **概览**: 1-2 句话
2. **触发条件**: 何时使用
3. **核心流程**: 主要步骤
4. **示例**: 使用示例

## 7. 禁止事项

- ❌ SKILL.md 超过 500 行（拆分为 references/）
- ❌ 内联大量代码示例（使用 scripts/）
- ❌ 与其他 skill 功能重叠
- ❌ 缺少错误处理
- ❌ 没有测试用例（复杂 skill 必须有）

## 8. 测试要求

### 简单 skill
- 手动测试清单
- 3-5 个测试用例

### 复杂 skill
- 使用 skill-creator 创建评估
- 至少 5 个测试用例
- 量化指标（通过率、时间等）

## 9. 版本管理

### 版本号格式
- `MAJOR.MINOR.PATCH`
- MAJOR: 破坏性变更
- MINOR: 新功能（向后兼容）
- PATCH: Bug 修复

### 更新记录
在 README.md 或 CHANGELOG.md 中记录

## 10. 质量检查清单

- [ ] description 清晰、可触发
- [ ] SKILL.md < 200 行（复杂 skill < 500 行）
- [ ] 无功能重叠
- [ ] 有使用示例
- [ ] 有错误处理
- [ ] 复杂 skill 有测试用例
- [ ] 版本号已更新

## 11. Skill 合并原则

### 合并条件
- 功能高度重叠（> 70%）
- 维护成本高
- 用户体验差（不知道选哪个）

### 合并策略
1. 保留最完善的一个
2. 将其他 skill 的功能合并进来
3. 创建 redirect 或 alias

## 12. Skill 拆分原则

### 拆分条件
- SKILL.md > 500 行
- 包含多个独立功能
- 用户只会用到其中部分功能

### 拆分策略
```
# 原 skill
skill-old/
└── SKILL.md (1000行)

# 新结构
skill-old/
├── SKILL.md (200行 - 核心流程)
└── references/
    ├── feature-a.md
    ├── feature-b.md
    └── feature-c.md
```
