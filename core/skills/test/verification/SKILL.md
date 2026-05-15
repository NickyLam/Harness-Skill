---
id: verification
name: Verification Before Completion — 完成前验证
description: "When the user mentions verification, evidence collection, task completion check, done criteria, or needs to validate that a feature is truly complete before marking it done, ALWAYS use this skill. Enforces evidence-based completion with automated verification, functional validation against acceptance criteria, and manual acceptance confirmation."
stage: test
roles: [QA Engineer, Developer]
pattern: EvidenceCollector
mandatory: true
depends: []
version: "3.0"
min_lines: 50
---

# Verification Before Completion — 完成前验证

> Superpowers 工程方法论层：声明完成前必须收集证据

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 声明开发任务完成时 | 开发者标记任务为 done | 自动触发全量验证流程 |
| 提交代码审查前 | 准备发起 PR/MR 时 | 收集证据作为 PR 描述的附件 |
| 合并分支前 | CI/CD pipeline 的 pre-merge gate | 作为自动化门禁的一部分 |
| TDD 循环结束后 | TDD REFACTOR 阶段完成 | 验证本轮实现的完整性 |
| 重构操作完成后 | code-simplification 执行完毕 | 确认重构未引入回归 |

**不触发场景**：代码编写过程中间状态、仅修改注释/文档、实验性分支（WIP）。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 测试套件 | `__tests__/` 目录 | 必需 | 用于自动化测试验证 |
| 设计文档中的验收标准 | `.harness/specs/*.md` | 必需 | 功能验证的对标依据 |
| 实现代码 | `src/` 目录 | 必需 | 被验证的目标代码 |
| 类型配置 | `tsconfig.json` | 必需 | TypeScript 编译检查依据 |
| Lint 配置 | `.eslintrc.*` / `eslint.config.*` | 必需 | 代码质量检查依据 |
| 构建脚本 | `package.json` 的 scripts | 必需 | 构建验证命令来源 |

**前置检查**：如果任何前置依赖缺失，应在报告中标注「N/A」并说明原因。

## 核心原则

1. **没有证据就不算完成** — 不能口头说"完成了"
2. **自动化验证优先** — 测试、类型检查、Lint 都应自动化
3. **人工验证补充** — 自动化无法覆盖的场景需手动验证

## 执行流程

### Step 1：自动化验证（必须全部通过）

按以下类别逐一执行，每类必须记录结果：

#### 1A. 编译验证

```bash
npx tsc --noEmit
```

**有效证据标准**：
- ✅ 通过：输出为空（0 errors）+ 截图或日志片段显示 "Success" 或无 error 输出
- ❌ 失败：完整错误列表（文件名 + 行号 + 错误信息）
- ⚠️ 警告：warnings 数量和内容（如非零需说明是否可接受）

#### 1B. 单元测试验证

```bash
npm run test -- --coverage --reporter=verbose
```

**有效证据标准**：
- ✅ 通过：`X passed / Y total (100%)` + 0 failures + 截图/日志
- ❌ 失败：失败用例名称 + 失败原因（expect vs actual）+ 完整 stack trace
- ⚠️ 部分通过：列出通过的 N 个和失败的 M 个具体用例名

#### 1C. Lint 检查

```bash
npm run lint
```

**有效证据标准**：
- ✅ 通过：输出为空或显示 "No problems found"
- ❌ 失败：错误数量 + 按文件分组的错误列表
- ⚠️ 有警告：warnings 数量 + 是否在允许阈值内

#### 1D. 构建验证

```bash
npm run build
```

**有效证据标准**：
- ✅ 通过：构建成功 + `dist/` 目录产物清单（文件列表 + 大小）
- ❌ 失败：构建错误信息 + 阶段定位（TS 编译 / 打包 / 优化）

### Step 2：功能验证（按验收标准逐项）

对于设计文档中的每个验收标准（AC1, AC2, ...）：

1. **明确验证方法**：
   - 🤖 自动测试 → 引用对应测试用例名和执行结果
   - 👁 手动验证 → 记录操作步骤 + 截图/录屏
   - 📋 文档审查 → 核对代码实现与需求描述的一致性

2. **记录验证结果**：
   - ✅ 通过：附证据（测试输出截图 / 手动操作截图）
   - ❌ 未通过：附失败详情 + 根因分析
   - 🔜 待验证：标注原因和计划验证时间

3. **如有失败，回到 systematic-debugging 流程**

### Step 3：手动验收确认

对于自动化无法覆盖的场景，执行手动验收：

#### 手动验收场景清单

| 场景类型 | 验证方法 | 证据形式 |
|---------|---------|---------|
| UI 视觉还原度 | 对比设计稿与实际渲染 | 并排截图 |
| 交互流畅度 | 手动操作核心用户路径 | 录屏（≤30s） |
| 响应式布局 | 在不同视口尺寸下检查 | 多尺寸截图集合 |
| 无障碍访问 | 使用屏幕阅读器导航 | 操作记录 + 截图 |
| 性能感知 | DevTools Performance 面板录制 | 性能报告截图 |
| 浏览器兼容性 | 在目标浏览器列表中逐一打开 | 每个浏览器的截图 |

### Step 4：生成证据报告

## 完整的证据收集模板

什么算有效证据？以下标准定义了每种验证类型的证据有效性：

```markdown
## 验证证据报告

**日期：** YYYY-MM-DD HH:MM
**任务：** <任务描述>
**执行者：** <Agent ID / 人名>
**验证环境：** Node vXX.XX | TypeScript vX.X | OS <平台>

---

### 一、自动化验证结果

#### 1.1 编译验证（TypeScript）
- **状态**：✅ 通过 / ❌ 失败 / ⚠️ 有警告
- **命令**：`npx tsc --noEmit`
- **执行时间**：MM:SS
- **证据**：
  ```
  （粘贴完整输出或标注"见附件 screenshot-ts-compile.png"）
  ```
- **结论**：<一句话总结>

#### 1.2 单元测试
- **状态**：✅ 全部通过 / ❌ 有失败 / ⚠️ 有跳过
- **命令**：`npm run test -- --coverage`
- **统计**：X passed / Y failed / Z skipped (total: N)
- **覆盖率**：Statements XX% | Branches XX% | Functions XX% | Lines XX%
- **证据**：
  ```
  （粘贴测试运行输出的最后 20 行，包含 pass/fail 汇总）
  ```
- **失败详情**（如有）：
  | 用例名 | 期望值 | 实际值 | 错误信息 |
  |-------|-------|-------|---------|

#### 1.3 Lint 检查
- **状态**：✅ 通过 / ❌ 有错误 / ⚠️ 有警告
- **命令**：`npm run lint`
- **统计**：X errors | Y warnings
- **证据**：（粘贴 lint 输出摘要）

#### 1.4 构建验证
- **状态**：✅ 成功 / ❌ 失败
- **命令**：`npm run build`
- **产物清单**：
  | 文件 | 大小 | gzip 后大小 |
  |-----|------|-----------|
  | dist/index.js | XX KB | XX KB |
  | dist/index.css | XX KB | XX KB |
- **证据**：（粘贴构建输出）

---

### 二、功能验证结果（验收标准对标）

| AC 编号 | 验收标准描述 | 验证方法 | 状态 | 证据引用 |
|--------|------------|---------|------|---------|
| AC1 | <从设计文档复制> | 🤖 自动 / 👁 手动 | ✅/❌ | test: xxx.test.ts::'should ...' / screenshot: ac1-login.png |
| AC2 | <从设计文档复制> | 🤖 自动 / 👁 手动 | ✅/❌ | ... |
| ... | ... | ... | ... | ... |

**验收标准覆盖率**：M/N (XX%)

---

### 三、手动验证记录

| 场景 | 操作步骤 | 预期结果 | 实际结果 | 状态 | 证据 |
|-----|---------|---------|---------|------|------|
| UI 还原度 | 打开页面 /components/X | 与设计稿 Figma 一致 | 一致/不一致(差异描述) | ✅/❌ | screenshot-ui-compare.png |
| 交互流程 | 点击按钮 A → 填写表单 → 提交 | 显示成功提示 | 符合预期 | ✅ | recording-interaction.webm |
| ... | ... | ... | ... | ... | ... |

---

### 四、遗留问题

| # | 问题描述 | 严重等级 | 影响范围 | 建议处理方式 | 计划解决时间 |
|---|---------|---------|---------|------------|------------|
| 1 | <描述> | P0/P1/P2 | <模块/功能> | 修复/降级接受/延后 | Sprint X 或 具体日期 |
| 2 | ... | ... | ... | ... | ... |

> 如果遗留问题数为 0，填写：「无遗留问题」

---

### 五、验证结论

**总体判定**：✅ 通过 / ⚠️ 有条件通过（见遗留问题）/ ❌ 不通过

**通过条件**：
- [ ] 所有自动化验证 ✅
- [ ] 所有 P0 验收标准 ✅
- [ ] 遗留问题 ≤ N 个且均为 P2
- [ ] 无 P0/P1 遗留问题

**签署**：（自动生成的时间戳签名）
```
Verified at: YYYY-MM-DD HH:MM:SS UTC
Verification hash: <git commit SHA of verified codebase>
```
```

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 验证证据报告 | `.harness/reports/verification-<task>-YYYYMMDD.md` | Markdown | 完整的证据收集报告 |
| 截图/录屏附件 | `.harness/reports/screenshots/<task>-*.png|.webm` | 二进制 | 手动验证的视觉证据 |
| 覆盖率报告 | `coverage/index.html` | HTML | Istanbul/Vitest 覆盖率详细数据 |
| 构建产物校验和 | `.harness/reports/build-checksum-YYYYMMDD.txt` | 文本 | dist/ 产物的 SHA256 校验值 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 自动化测试有失败用例 | 定位失败用例 → 进入 systematic-debugging 流程 | 修复后重新运行完整验证 |
| 类型检查报错 | 分析 TS 错误 → 修复类型问题 | 修复后重新运行 tsc --noEmit |
| Lint 不通过 | 按 lint 报告逐项修复 | 修复后重新运行 lint |
| 构建失败 | 分析构建错误（通常是上述问题的累积） | 从编译→测试→lint 顺序修复后重试 |
| 验收标准无法全部满足 | 区分 P0/P1/P2：P0 必须满足，P2 可放入 backlog | 更新设计文档标注未覆盖的 AC |
| 手动验证环境不可用 | 标注为「待验证」，不阻塞发布但必须在上线前补齐 | 创建跟踪 issue |
| 证据收集不完整 | 补充缺失的证据项 | 重新执行对应的验证步骤 |

## 交接协议

```markdown
## Verification 交接包

### 交付给 requesting-code-review
- 验证证据报告路径：`.harness/reports/verification-<task>-YYYYMMDD.md`
- 自动化验证汇总：[编译 ✅, 测试 X/Y, Lint ✅, 构建 ✅]
- 验收标准覆盖率：M/N (XX%)
- 遗留问题数：K 个（P0: a, P1: b, P2: c）
- 判定结论：✅ 通过 / ⚠️ 有条件通过

### 交付给 ship-pipeline（准备发布时）
- 完整证据报告 + 所有附件
- 构建产物校验和
- 版本兼容性声明
```

**交接验证**：接收方 Skill 必须确认证据报告存在且总体判定不为「❌ 不通过」。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 证据报告存在 | 文件系统检查 | `.harness/reports/` 下有 verification 报告 |
| 编译零错误 | 报告内容解析 | TypeScript 编译 0 errors |
| 测试零失败 | 报告内容解析 | unit tests 0 failures（skipped = 0） |
| Lint 可接受 | 报告内容解析 | errors = 0，warnings ≤ 项目阈值（默认 5） |
| 构建成功 | 报告内容解析 | `dist/` 产物存在且非空 |
| AC 覆盖率达标 | 报告内容解析 | P0 AC 100% 覆盖，总覆盖率 ≥ 80% |
| 有明确结论 | 报告内容搜索 | 包含「总体判定」字段且值为 ✅ 或 ⚠️ |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 标准验收清单（从 .harness/specs/ 读取项目验收标准）

> 验收标准来自 /spec 阶段生成的设计文档，每个项目的验收标准不同。
> 验证时逐项检查设计文档中的验收标准（AC1, AC2, ...），确保每条都有对应的验证证据。

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| Superpowers: TDD | TDD 测试通过是验证的前提条件 |
| Superpowers: systematic-debugging | 验证失败 → 进入调试流程 |
| GSTACK: /qa | 自动化验证通过 → /qa 浏览器端到端验证 |
| Superpowers: requesting-code-review | 验证通过 → 请求代码审查 |
| qa | 浏览器端到端验证（自动化验证通过后） |
| gating | 作为 Test Gate 的一部分 |
| performance-testing | 性能基准验证（如适用） |
| security-audit | 安全漏洞扫描验证 |

---

## 增强内容（v3.1 升级）

### 自动化验证脚本示例

```bash
#!/bin/bash
# .harness/scripts/run-verification.sh
set -e

echo "==========================================="
echo "  Verification Before Completion"
echo "==========================================="
echo "Date: $(date)"
echo "Commit: $(git rev-parse --short HEAD)"
echo ""

REPORT_DIR=".harness/reports/verification-$(date +%Y%m%d)"
mkdir -p "$REPORT_DIR"
mkdir -p "$REPORT_DIR/screenshots"

# Step 1: TypeScript 编译检查
echo "📋 Step 1/5: TypeScript Compilation..."
if npx tsc --noEmit 2>&1 | tee "$REPORT_DIR/tsc-output.txt"; then
  TSC_STATUS="✅ PASS (0 errors)"
else
  TSC_STATUS="❌ FAIL (see tsc-output.txt)"
fi
echo "Result: $TSC_STATUS"
echo ""

# Step 2: 单元测试执行
echo "🧪 Step 2/5: Unit Tests..."
if npm run test -- --coverage --reporters=json 2>&1 | tee "$REPORT_DIR/test-output.txt"; then
  TEST_STATUS="✅ PASS (all tests passed)"
else
  TEST_STATUS="❌ FAIL (some tests failed, see test-output.txt)"
fi
cp -r coverage "$REPORT_DIR/" 2>/dev/null || true
echo "Result: $TEST_STATUS"
echo ""

# Step 3: Lint 检查
echo "🔍 Step 3/5: ESLint..."
if npm run lint 2>&1 | tee "$REPORT_DIR/lint-output.txt"; then
  LINT_STATUS="✅ PASS (0 errors)"
else
  LINT_STATUS="⚠️ WARNING (errors found, see lint-output.txt)"
fi
echo "Result: $LINT_STATUS"
echo ""

# Step 4: 构建验证
echo "🏗️ Step 4/5: Build..."
if npm run build 2>&1 | tee "$REPORT_DIR/build-output.txt"; then
  BUILD_STATUS="✅ PASS (build successful)"
  
  # 计算构建产物校验和
  echo "" > "$REPORT_DIR/build-checksums.txt"
  find dist -type f -exec sh -c 'sha256 "$1" >> "$REPORT_DIR/build-checksums.txt"' _ {} \;
  echo "Checksums saved to build-checksums.txt"
else
  BUILD_STATUS="❌ FAIL (build failed, see build-output.txt)"
fi
echo "Result: $BUILD_STATUS"
echo ""

# Step 5: 生成汇总报告
echo "📊 Step 5/5: Generating Report..."

cat > "$REPORT_DIR/report.md" << EOF
# Verification Evidence Report

**Generated**: $(date)
**Commit**: $(git rev-parse HEAD)
**Branch**: $(git branch --show-current)

## Summary

| Check | Status | Details |
|-------|--------|---------|
| TypeScript | $TSC_STATUS | $(grep -c 'error TS' "$REPORT_DIR/tsc-output.txt" 2>/dev/null || echo 0) errors |
| Unit Tests | $TEST_STATUS | $(npm run test -- --silent 2>/dev/null | grep -oP '\d+ passed' || echo 'N/A') |
| ESLint | $LINT_STATUS | $(grep -c 'error' "$REPORT_DIR/lint-output.txt" 2>/dev/null || echo 0) errors |
| Build | $BUILD_STATUS | $(du -sh dist/ 2>/dev/null || echo 'N/A') |

## Conclusion

**Overall**: $(if [ "$TSC_STATUS" = "✅ PASS (0 errors)" ] && [ "$TEST_STATUS" = "✅ PASS (all tests passed)" ]; then echo "✅ PASSED"; else echo "⚠️ CONDITIONAL"; fi)

## Evidence Files

- TypeScript output: \`tsc-output.txt\`
- Test output + coverage: \`test-output.txt\` + \`coverage/\`
- Lint output: \`lint-output.txt\`
- Build output + checksums: \`build-output.txt\` + \`build-checksums.txt\`
EOF

echo ""
echo "==========================================="
echo "  Verification Complete!"
echo "==========================================="
echo "Report: $REPORT_DIR/report.md"
```

### 扩展失败处理（10个场景）

| 失败场景 | 检测方式 | 解决方案 | 恢复命令 |
|---------|---------|---------|----------|
| **TypeScript 编译错误** | `tsc --noEmit` exit code ≠ 0 | 分析错误类型并修复 | 查看 `$REPORT_DIR/tsc-output.txt` 定位具体错误行 |
| **单元测试失败** | Jest exit code ≠ 0 | 运行失败的测试查看详情 | `npm run test -- --testNamePattern="<failed test>" --verbose` |
| **测试覆盖率不足** | coverage < 80% | 补充缺失的测试用例 | `npx vitest --coverage --uncovered-files` 找到未覆盖的文件 |
| **ESLint 错误** | lint 报告有 errors | 按 error 级别逐项修复 | `npm run lint -- --fix` 自动修复可修复的问题 |
| **构建产物为空** | dist/ 目录不存在或为空 | 检查构建配置和入口文件 | `npm run build -- --debug` 查看详细构建日志 |
| **依赖安装失败** | npm install 报错 | 清除缓存重试 | `rm -rf node_modules package-lock.json && npm install` |
| **Git 工作区不干净** | git status 有未提交变更 | 提交或暂存所有变更 | `git add . && git commit -m "chore: pre-verification cleanup"` |
| **环境变量缺失** | 应用启动报错 undefined | 检查 `.env.example` 并创建 `.env` | `cp .env.example .env && 编辑填入实际值` |
| **端口被占用** | dev server 启动失败 EADDRINUSE | 杀掉占用进程或更换端口 | `lsof -ti :3000 | xargs kill -9` |
| **截图/录屏保存失败** | 磁盘权限问题 | 检查目录权限 | `chmod 755 $REPORT_DIR/screenshots` |

### 增强产出物（6个）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| 完整证据报告 | `.harness/reports/verification-<task>-YYYYMMDD/report.md` | Markdown | 所有验证步骤的汇总报告 | **必需** |
| 编译输出日志 | `.../tsc-output.txt` | 文本 | TypeScript 编译的完整输出 | **必需** |
| 测试结果+覆盖率 | `.../test-output.txt` + `.../coverage/` | 文本+HTML | 单元测试结果和覆盖率详细数据 | **必需** |
| Lint 报告 | `.../lint-output.txt` | 文本 | ESLint 的完整检查结果 | **必需** |
| 构建产物校验和 | `.../build-checksums.txt` | 文本 | dist/ 下所有文件的 SHA256 哈希值 | 推荐 |
| 截屏/录屏证据 | `.../screenshots/*.png|*.webm` | 二进制 | 手动验证的视觉证据（如有） | 可选 |

### 与其他 Skill 的协作矩阵（增强版）

| 协作 Skill | 协作时机 | 输入→输出 | 数据流向 |
|-----------|---------|----------|---------|
| **tdd** | 验证前 | 测试代码 → 测试结果 | `*.test.ts` → JUnit XML |
| **systematic-debugging** | 任何步骤失败时 | 错误现象 → 根因分析 | Error Log → Fix Suggestion |
| **qa** | 自动化全通过后 | 本地验证 → 浏览器 E2E | App URL → QA Report |
| **requesting-code-review / staff-review** | 验证通过后 | 证据报告 → Review 请求 | Report → PR/MR |
| **gating** | Gate 4 (Test Gate) | 验证结果 → 门禁判定 | Checklist → Pass/Fail |
| **performance-testing** | 性能敏感功能 | 基准数据 → 回归分析 | Metrics → Regression Report |
| **security-audit** | 安全相关变更 | 依赖扫描 → 漏洞报告 | package-lock → SARIF |
| **code-simplification** | 验证发现复杂度问题时 | 当前代码 → 简化建议 | Source → Simplified Source |
| **ship-pipeline** | 准备发布时 | 全部证据 → 发布决策 | All Reports → Deploy |

### 验证质量门禁（增强版）

| 门禁项 | 检查方式 | 通过标准 | 不通过处理 |
|-------|---------|---------|-----------|
| 证据报告存在且格式正确 | 文件系统 + 内容解析 | report.md 包含所有必需章节 | 重新运行验证脚本 |
| TypeScript 零编译错误 | tsc 输出解析 | 0 errors (warnings 允许) | 修复类型错误后重新运行 |
| 单元测试零失败 | Jest 输出解析 | 0 failures (skipped=0) | 进入 systematic-debugging 流程 |
| 测试覆盖率达标 | Istanbul 输出 | 总覆盖率 ≥80%, 关键路径 ≥90% | 补充测试用例 |
| Lint 错误数可接受 | ESLint 输出 | 0 errors, warnings ≤ 项目阈值 | 修复 lint 问题 |
| 构建成功且有产物 | 文件系统检查 | dist/ 存在且非空 | 排查构建配置问题 |
| AC 验收覆盖率达标 | 设计文档对比 | P0 AC 100%, 总体 ≥80% | 更新设计文档或补充实现 |
| Git 工作区干净 | git status | 无未提交的变更（或已暂存） | 提交所有变更 |
| 有明确的总体判定 | 报告内容搜索 | 包含 ✅ 或 ⚠️（不允许 ❌） | 修复问题后重新验证 |

## 下一步行动

Verification 完成后：

1. **全部通过？** → 进入 `/requesting-code-review` 或 `/staff-review`
2. **有条件通过？** → 评估遗留问题的风险，决定是否可以继续
3. **不通过？** → 根据失败的步骤回到对应的 Skill 修复
4. **需要浏览器验证？** → 进入 `/qa` 进行端到端测试
5. **准备发布？** → 将完整的证据包交接给 `/ship-pipeline`
