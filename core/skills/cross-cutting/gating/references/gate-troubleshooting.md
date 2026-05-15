# Gate Troubleshooting Guide

## Gate 1: Spec Gate

### 症状：PRD.md 不存在

**诊断**：
```bash
ls -la docs/PRD.md
```

**修复**：
```bash
# 创建 PRD 模板
cat > docs/PRD.md << 'EOF'
# Feature: {Feature Name}

## 背景
{业务背景}

## 需求描述
{功能描述}

## 验收标准
- [ ] 标准 1
- [ ] 标准 2

## 技术考量
{技术方案}

## 状态
status: draft
EOF
```

### 症状：无验收标准

**诊断**：
```bash
grep -c '^\- \[ \]' docs/PRD.md
```

**修复**：至少添加 1 条验收标准 checklist。

## Gate 2: Plan Gate

### 症状：任务数不合理

**诊断**：
```bash
grep -c '^### Task' docs/PLAN.md
```

**修复**：
- 任务数 < 1：拆分为至少 3 个任务
- 任务数 > 15：合并相关任务或拆分为多个 feature

### 症状：循环依赖

**诊断**：
```bash
# 检查 depends 字段是否自引用
grep 'depends.*自身' docs/PLAN.md
```

**修复**：重新设计任务依赖关系，确保 DAG 无环。

## Gate 3: Build Gate

### 症状：TypeScript 编译失败

**诊断**：
```bash
npx tsc --noEmit 2>&1 | head -20
```

**修复**：
1. 检查类型定义是否完整
2. 检查 import 路径是否正确
3. 检查 tsconfig.json 配置

### 症状：ESLint 失败

**诊断**：
```bash
npm run lint 2>&1 | grep "error"
```

**修复**：
```bash
# 自动修复
npm run lint -- --fix
```

## Gate 4: Test Gate

### 症状：测试覆盖率 < 80%

**诊断**：
```bash
npm run test:coverage 2>&1 | grep "Coverage"
```

**修复**：
1. 检查未覆盖的分支
2. 补充边界条件测试
3. 补充错误处理测试

### 症状：Flaky Test

**诊断**：
```bash
# 运行 5 次，观察是否稳定
for i in {1..5}; do npm test -- --testPathPattern="flaky"; done
```

**修复**：
1. 移除 setTimeout/setInterval
2. 使用 fake timers
3. 等待异步操作完成

## Gate 5: Review Gate

### 症状：P0 问题未修复

**诊断**：
```bash
grep "^\- \[P0\]" .harness/reviews/latest.md
```

**修复**：
1. 按优先级修复 P0 问题
2. 重新运行 review

## Gate 6: Simplify Gate

### 症状：函数超过 50 行

**诊断**：
```bash
find src -name "*.ts" -exec awk 'NR>50 {print FILENAME}' {} \;
```

**修复**：
1. 提取辅助函数
2. 使用策略模式
3. 拆分条件分支

### 症状：文件超过 500 行

**诊断**：
```bash
find src -name "*.ts" -exec awk 'NR>500 {print FILENAME}' {} \;
```

**修复**：
1. 按职责拆分为多个文件
2. 提取公共逻辑到 utils

## Gate 7: Ship Gate

### 症状：Git 工作区不干净

**诊断**：
```bash
git status --short
```

**修复**：
```bash
git add .
git commit -m "feat: prepare for release"
```

### 症状：版本号未更新

**诊断**：
```bash
node -p "require('./package.json').version"
```

**修复**：
```bash
npm version {patch|minor|major}
```
