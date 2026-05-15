---
id: onboarding
name: "Onboarding — 快速启动与项目初始化"
stage: cross-cutting
roles: [product-owner]
pattern: onboarding
mandatory: false
depends: []
version: "3.1"
description: "When the user mentions onboarding, getting started, or needs a quick start guide, ALWAYS use this skill. Rapid start guides and project setup assistance."
---

# Onboarding — 完整快速启动指南

> **层级**：Harness 全局
> **触发**：新用户首次使用 / 新项目初始化 / 新功能首次开发
> **目标**：30秒理解概念，5分钟完成初始化，10分钟开始第一次增量

## 三级上手路径

### ⚡ Level 1：30秒速览（概念理解）

```
Harness 是什么？
├─ 一套软件工程方法论（类似 Scrum 的 AI 增强版）
├─ 核心思想：小增量 + 质量门禁 + 角色分离
└─ 7 个阶段：spec → plan → build → test → review → simplify → ship

怎么用？
├─ 输入 /harness <阶段名> 触发对应流程
├─ 每个阶段有质量门禁，不通过不能进入下一阶段
└─ 目标：每个增量 ≤100行代码，≤30分钟完成
```

### 🔥 Level 2：5分钟初始化（新项目启动）

#### Step 1：创建项目结构（1分钟）

```bash
# 创建 Harness 目录结构
mkdir -p .harness/{specs,plans,metrics,progress,qa}
mkdir -p .workbuddy/memory

# 创建必要的配置文件
touch .harness/config.yaml
touch .workbuddy/memory/MEMORY.md
```

**验证目录创建成功：**
```bash
ls -la .harness/
# 应该看到：config.yaml, specs/, plans/, metrics/, progress/, qa/

ls -la .workbuddy/
# 应该看到：memory/MEMORY.md
```

#### Step 2：生成项目配置文件（1分钟）

自动检测或手动创建 `.harness/config.yaml`：

```yaml
# .harness/config.yaml
project:
  name: "your-project-name"
  description: "简短描述项目目标"
  tech_stack: "react-typescript" # 或 java, go, python, generic

quality_gates:
  strictness: "L2-standard" # L1-fast, L2-standard, L3-strict
  test_coverage_threshold: 80
  max_function_lines: 50
  max_file_lines: 500

roles:
  enabled: true # 启用角色分离模式

increment_rules:
  max_lines_per_increment: 100
  max_time_per_increment: "30min"
  test_first: true # TDD 模式
```

**技术栈自动检测命令（可选）：**
```bash
# 检测前端框架
if [ -f "package.json" ]; then
  grep -E "\"(react|vue|angular)\"" package.json && echo "Detected: Frontend Framework"

# 检测后端框架
if [ -f "pom.xml" ]; then echo "Detected: Java/Maven"; fi
if [ -f "go.mod" ]; then echo "Detected: Go"; fi
if [ -f "requirements.txt" ]; then echo "Detected: Python"; fi
```

#### Step 3：安装依赖和工具（1分钟）

```bash
# Node.js 项目
npm install --save-dev typescript @types/react @types/node eslint prettier

# 初始化 TypeScript（如果尚未配置）
npx tsc --init

# 安装测试框架
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# 安装代码质量工具
npm install --save-dev eslint-config-prettier husky lint-staged
```

**验证安装成功：**
```bash
# 检查关键依赖
npm list typescript jest eslint prettier --depth=0

# 验证 TypeScript 配置
npx tsc --version

# 验证测试框架
npx jest --version
```

#### Step 4：配置 Git Hooks（1分钟）

```bash
# 初始化 Husky（Git hooks 管理）
npx husky init

# 添加 pre-commit hook（自动运行 lint 和格式化）
echo "npm run lint && npm run format" > .husky/pre-commit

# 添加 commit-msg hook（检查 commit message 格式）
echo 'npx commitlint --edit $1' > .husky/commit-msg
```

**验证 hooks 配置成功：**
```bash
ls -la .husky/
# 应该看到：pre-commit, commit-msg, _
```

#### Step 5：创建初始记忆文件（1分钟）

```markdown
<!-- .workbuddy/memory/MEMORY.md -->
# Project Memory

## 项目概述
- **名称**: your-project-name
- **技术栈**: React + TypeScript
- **创建日期**: 2026-05-06
- **当前状态**: 初始化完成

## 关键决策记录
- [ ] （首次增量完成后填写）

## 技术约定
- 文件组织：src/components/, src/pages/, src/utils/
- 命名规范：camelCase for variables, PascalCase for components
- Git flow：main ← develop ← feature/*

## 已知问题
- 无（初始状态）
```

**验证记忆文件创建成功：**
```bash
cat .workbuddy/memory/MEMORY.md | head -20
```

### 🚀 Level 3：10分钟第一次增量（实战演练）

#### 场景："我要添加一个用户登录功能"

```
╔══════════════════════════════════════════════════╗
║           第一次增量时间线（~10分钟）            ║
╠══════════════════════════════════════════════════╣
║  0-2 min  /harness spec   → PO 采集需求          ║
║  2-4 min  /harness plan   → Architect 拆任务     ║
║  4-8 min  /harness build  → Implementer 写代码   ║
║  8-9 min  /harness test   → Tester 验证         ║
║  9-10 min /harness review → Reviewer 审查       ║
╚══════════════════════════════════════════════════╝
```

**详细执行步骤：**

```bash
# 1. 开始 spec 阶段（PO 角色）
/harness spec
# → PO 会问：目标用户是谁？核心场景是什么？验收标准？

# 2. 进入 plan 阶段（Architect 角色）
/harness plan
# → Architect 会拆分为微任务（≤5分钟/个）

# 3. 执行 build 阶段（Implementer 角色）
/harness build
# → Implementer 先写测试，再写实现（TDD）

# 4. 运行 test 阶段（Tester 角色）
/harness test
# → Tester 验证边界条件和异常情况

# 5. 进行 review 阶段（Reviewer 角色）
/harness review
# → Reviewer 按 Checklist 审查代码质量
```

## 7大核心命令速查表

| 命令 | 触发词 | 角色 | 输入 | 输出 | 时间 |
|------|--------|------|------|------|------|
| `/harness spec` | "新功能", "需求", "设计" | PO | 功能描述 | 设计文档 | 2min |
| `/harness plan` | "拆分任务", "实施计划" | Architect | 设计文档 | 任务列表 | 2min |
| `/harness build` | "写代码", "实现" | Implementer | 任务列表 | 代码+测试 | 5min |
| `/harness test` | "验证", "测试" | Tester | 代码 | 测试报告 | 1min |
| `/harness review` | "审查", "code review" | Reviewer | 代码 | 审查报告 | 1min |
| `/harness simplify` | "简化", "重构" | Reviewer | 代码 | 简化报告 | 1min |
| `/harness ship` | "发布", "部署" | Shipper | 所有产物 | 发布确认 | 1min |

## 6大角色职责矩阵

| 角色 | 职责 | 能做 | 不能做 | 协作对象 |
|------|------|------|--------|---------|
| **PO (Product Owner)** | 需求管理 | 问问题、写设计文档、定优先级 | 写代码、改代码 | → Architect |
| **Architect** | 任务规划 | 拆任务、排依赖、定计划 | 写实现代码 | ← PO, → Implementer |
| **Implementer** | 代码实现 | 写代码、写测试（TDD） | 自己审查自己的代码 | ← Architect, → Tester |
| **Tester** | 质量保证 | 写边界测试、验证功能 | 改实现代码 | ← Implementer, → Reviewer |
| **Reviewer** | 代码审查 | 找问题、提建议、检查复杂度 | 直接修改代码 | ← Tester, → Shipper |
| **Shipper** | 发布部署 | 执行门禁、打包发布、最后把关 | 回到之前的阶段 | ← Reviewer |

## 7大质量门禁详解

### Gate 1: Spec Gate（定义→规划）

**检查项：**
- [ ] 需求文档已创建（`.harness/specs/<feature>.md`）
- [ ] 文档包含验收标准（至少1条 `[ ]` 格式）
- [ ] PO 已审批（文档状态字段为 "approved"）

**不通过处理：**
```bash
# 回到 brainstorming 重新采访
/harness spec --revise
```

### Gate 2: Plan Gate（规划→构建）

**检查项：**
- [ ] 任务列表已创建（`.harness/plans/<feature>.md`）
- [ ] 每个任务 ≤5分钟（人工确认或工具估算）
- [ ] 每个任务有明确的输出文件路径
- [ ] 依赖关系已标注（使用 `depends-on:` 字段）

**不通过处理：**
```bash
# 回到 writing-plans 重新拆分
/harness plan --refine
```

### Gate 3: Build Gate（构建→验证）

**检查项：**
- [ ] TypeScript 编译通过：`npx tsc --noEmit`
- [ ] 构建成功：`npm run build`
- [ ] 变更行数 ≤100：`git diff --stat | tail -1`

**自动化检查脚本：**
```bash
#!/bin/bash
# .harness/scripts/check-build-gate.sh

echo "🔍 Checking Build Gate..."

# 1. TypeScript 编译
if ! npx tsc --noEmit; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi

# 2. 构建
if ! npm run build; then
  echo "❌ Build failed"
  exit 1
fi

# 3. 行数检查
CHANGED_LINES=$(git diff --stat --cached | tail -1 | awk '{print $4}')
if [ "$CHANGED_LINES" -gt 100 ]; then
  echo "⚠️ Warning: $CHANGED_LINES lines changed (limit: 100)"
  echo "Consider splitting into smaller increments"
fi

echo "✅ Build Gate passed"
```

### Gate 4: Test Gate（验证→评审）

**检查项：**
- [ ] 全部测试通过：`npm run test` (0 failures)
- [ ] 测试覆盖率 ≥80%：`npm run test:coverage`
- [ ] 新代码有对应测试文件

**不通过处理：**
```bash
# 回到 TDD 红绿循环
/harness build --fix-tests
```

### Gate 5: Review Gate（评审→简化）

**检查项：**
- [ ] 无 P0 问题（必须修复的严重问题）
- [ ] P1 问题 ≤3 个（一般性问题）
- [ ] ESLint 通过：`npm run lint` (0 errors)

**不通过处理：**
```bash
# 回到 /review 修复问题
/harness review --fix
```

### Gate 6: Simplify Gate（简化→发布）

**检查项：**
- [ ] 无严重复杂度警告（圈复杂度 ≤10）
- [ ] 函数长度 ≤50 行
- [ ] 文件长度 ≤500 行

**不通过处理：**
```bash
# 回到 /simplify 重构
/harness simplify --refactor
```

### Gate 7: Ship Gate（发布→完成）

**检查项：**
- [ ] 全部门禁通过（Gate 1-6 全部 ✅）
- [ ] 最终构建成功：`npm run build`
- [ ] Git 工作区干净：`git status` (无未提交变更)
- [ ] 版本号已更新（如适用）

**发布命令：**
```bash
# 自动化发布流程
/harness ship
# → Shipper 会执行：
#   1. 重新运行所有门禁
#   2. 打包构建产物
#   3. 创建 Git tag
#   4. 推送到远程仓库
```

## 失败处理（10个常见场景）

| 失败场景 | 错误信息/症状 | 原因分析 | 解决方案 | 恢复命令 |
|---------|--------------|---------|---------|----------|
| **目录结构缺失** | `.harness/ not found` | 首次使用未初始化 | 运行初始化脚本 | 见下方 "一键初始化" |
| **config.yaml 格式错误** | `YAML parse error` | 手动编辑时语法错误 | 使用模板重新生成 | `cp .harness/templates/config.yaml .harness/config.yaml` |
| **依赖安装失败** | `npm ERR!` | 网络问题或版本冲突 | 清除缓存重试 | `rm -rf node_modules package-lock.json && npm install` |
| **TypeScript 编译错误** | `error TSxxxx` | 类型错误或配置问题 | 查看具体错误并修复 | `npx tsc --noEmit 2>&1 | head -20` |
| **测试失败** | `✗ × failed` | 测试用例或实现有问题 | 查看 failing tests | `npm run test -- --verbose` |
| **Git hooks 不工作** | pre-commit 未触发 | Husky 未正确安装 | 重新安装 husky | `npx husky install` |
| **角色权限混乱** | Implementer 在 review | 未遵循角色分离规则 | 明确角色分工 | 参考 "6大角色职责矩阵" |
| **增量超时** | 任务 >30 分钟 | 任务粒度太粗 | 拆分为更小的子任务 | `/harness plan --split-task <task-id>` |
| **门禁全部失败** | All Gates ❌ | 基础环境问题 | 检查依赖和配置 | `/harness onboard --check-environment` |
| **记忆文件损坏** | `MEMORY.md corrupted` | 并发写入冲突 | 从备份恢复 | `cp .workbuddy/memory/MEMORY.md.bak .workbuddy/memory/MEMORY.md` |

## 一键初始化脚本

将以下内容保存为 `scripts/init-harness.sh`：

```bash
#!/bin/bash
set -e

echo "🚀 Initializing Harness Engineering Skill..."

# Step 1: Create directory structure
echo "📁 Creating directory structure..."
mkdir -p .harness/{specs,plans,metrics,progress,qa,templates,scripts}
mkdir -p .workbuddy/memory

# Step 2: Generate default config
echo "⚙️ Generating default config..."
cat > .harness/config.yaml << 'EOF'
project:
  name: "$(basename $(pwd))"
  description: "Auto-generated by Harness init script"
  tech_stack: "auto-detect"

quality_gates:
  strictness: "L2-standard"
  test_coverage_threshold: 80
  max_function_lines: 50
  max_file_lines: 500

roles:
  enabled: true

increment_rules:
  max_lines_per_increment: 100
  max_time_per_increment: "30min"
  test_first: true
EOF

# Step 3: Initialize memory file
echo "🧠 Initializing memory..."
cat > .workbuddy/memory/MEMORY.md << 'EOF'
# Project Memory

## 项目概述
- **名称**: $(basename $(pwd))
- **创建日期**: $(date +%Y-%m-%d)
- **当前状态**: 初始化完成

## 技术约定
- （首次增量后补充）

## 关键决策
- （待记录）
EOF

# Step 4: Create gate check script
echo "🔧 Creating gate check script..."
cat > .harness/scripts/check-all-gates.sh << 'GATEEOF'
#!/bin/bash
echo "Running all gates..."

# Add gate checks here
echo "✅ Environment ready"
GATEEOF
chmod +x .harness/scripts/check-all-gates.sh

# Step 5: Verify setup
echo "✅ Verifying setup..."
if [ -f ".harness/config.yaml" ] && [ -f ".workbuddy/memory/MEMORY.md" ]; then
  echo ""
  echo "🎉 Harness initialization complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Edit .harness/config.yaml with your project details"
  echo "  2. Run /harness spec to start your first increment"
  echo "  3. Check /harness help for all available commands"
else
  echo "❌ Initialization failed. Please check the error messages above."
  exit 1
fi
```

**使用方法：**
```bash
chmod +x scripts/init-harness.sh
./scripts/init-harness.sh
```

## 产出物（6个关键交付物）

| 产出物 | 路径模板 | 格式 | 创建时机 | 必要性 |
|-------|---------|------|---------|-------|
| 项目配置文件 | `.harness/config.yaml` | YAML | 初始化时 | **必需** |
| 目录结构 | `.harness/`, `.workbuddy/` | 目录 | 初始化时 | **必需** |
| 项目记忆文件 | `.workbuddy/memory/MEMORY.md` | Markdown | 初始化时 | **必需** |
| 门禁检查脚本 | `.harness/scripts/check-all-gates.sh` | Bash | 初始化时 | 推荐 |
| Git Hooks 配置 | `.husky/` | Shell | 初始化时 | 推荐 |
| 初始化日志 | `.harness/progress/onboarding-log.md` | Markdown | 初始化后 | 可选 |

## 快速故障排除指南

### Q: 我输入 `/harness spec` 但没有反应？

**可能原因：**
1. Skill 未正确加载
2. 命令拼写错误
3. 当前上下文不支持该命令

**排查步骤：**
```bash
# 1. 检查 Skill 是否可用
/harness help

# 2. 检查 config.yaml 是否存在
ls -la .harness/config.yaml

# 3. 尝试完整命令
/harness spec --verbose
```

### Q: 门禁总是失败怎么办？

**常见原因：**
- TypeScript 类型错误
- 测试未通过
- ESLint 报错

**解决策略：**
```bash
# 1. 查看具体哪个门禁失败
/harness status

# 2. 只运行失败的门禁
/harness check --gate <gate-name>

# 3. 查看详细日志
cat .harness/metrics/latest-run.jsonl
```

### Q: 如何查看当前进度？

```bash
# 方法1：查看进度文件
cat .harness/progress/current.md

# 方法2：使用命令
/harness progress

# 方法3：查看最近的记忆条目
ls -lt .workbuddy/memory/*.md | head -5
```

### Q: 可以跳过某个阶段吗？

**答案：不可以。**

原因：
- 每个阶段对应一个质量门禁
- 跳过 = 质量失控
- 后续阶段会因缺少前置产物而失败

**替代方案：**
- 如果某个阶段的产出很简单，可以快速完成（<1分钟）
- 使用 `/harness <stage> --quick` 快速模式（如果支持）

### Q: 团队协作时如何同步？

**推荐做法：**
1. 将 `.harness/` 和 `.workbuddy/` 加入 Git 仓库
2. 使用 Git 分支进行并行开发
3. 定期合并主分支的配置更新

```bash
# 添加到 .gitignore（可选，根据团队规范）
# .harness/metrics/*.jsonl
# .workbuddy/memory/YYYY-MM-DD*.md
```

## 与其他 Skill 的协作关系图

```
onboarding (初始化)
    ↓
brainstorming (需求探索) → deep-requirements (深度需求)
    ↓
writing-plans (任务规划)
    ↓
tdd/subagent-driven-dev (代码实现)
    ↓
verification/qa/e2e-qa (质量验证)
    ↓
requesting-code-review/staff-review (代码审查)
    ↓
code-simplification (代码简化)
    ↓
ci-cd-pipeline/containerization/ship-pipeline (发布部署)
    ↓
gating (贯穿所有阶段的质量门禁)
orchestrator (跨阶段协调)
gsd (全局调度)
memory-management (经验积累)
governance (治理规范)
```

## 质量检查清单（初始化完成后必检）

### 环境准备
- [ ] Node.js ≥18.x 已安装 (`node --version`)
- [ ] npm ≥9.x 已安装 (`npm --version`)
- [ ] Git 已配置 (`git config user.name/email`)
- [ ] 编辑器已安装 Prettier 和 ESLint 插件

### 项目结构
- [ ] `.harness/` 目录存在且包含子目录
- [ ] `.workbuddy/memory/` 目录存在
- [ ] `.harness/config.yaml` 已创建且格式正确
- [ ] `.workbuddy/memory/MEMORY.md` 已创建

### 依赖安装
- [ ] `package.json` 存在
- [ ] `node_modules/` 已安装
- [ ] TypeScript 可编译 (`npx tsc --noEmit`)
- [ ] 测试框架可运行 (`npx jest --version`)

### 工具配置
- [ ] ESLint 配置文件存在 (`.eslintrc.js`)
- [ ] Prettier 配置文件存在 (`.prettierrc`)
- [ ] Git Hooks 已配置 (`.husky/`)
- [ ] EditorConfig 存在 (`.editorconfig`)

### 文档完整性
- [ ] README.md 包含项目简介
- [ ] CONTRIBUTING.md 包含贡献指南（团队项目）
- [ ] LICENSE 文件存在

## 下一步行动建议

初始化完成后，按以下顺序开始你的第一个增量：

1. **了解需求** → 运行 `/harness spec` 让 PO 采集需求
2. **制定计划** → 运行 `/harness plan` 让 Architect 拆分任务
3. **开始编码** → 运行 `/harness build` 让 Implementer 实现
4. **验证质量** → 运行 `/harness test` + `/harness review`
5. **发布上线** → 运行 `/harness ship` 完成

**需要帮助？** 运行 `/harness help` 或查阅各 Skill 的详细文档。
