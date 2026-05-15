# Rollback Protocol — 回滚协议

> **触发条件**: 当前增量满足以下任一条件时触发
> **目的**: 安全地回退有问题的变更，恢复到稳定状态

## 触发条件

当前增量出现以下情况之一时**必须**执行回滚:

1. **测试大面积失败** — 测试失败率 > 50%
2. **无法快速修复的 Bug** — 预估修复时间 > 15 分钟
3. **功能回归** — 破坏了现有正常功能
4. **范围蔓延** — 变更量远超预期（如单 Wave >200 行）
5. **用户明确取消**

## 回滚步骤

### Step 1: 影响评估（≤1 分钟）

```bash
# 查看当前变更范围
git diff --stat
git status
git diff --name-only > /tmp/rollback-scope.txt
```

记录:
- 涉及多少个文件
- 新增/删除了多少行
- 是否有已提交的 commit

### Step 2: 创建备份分支（推荐）

```bash
# 保留当前工作以便后续分析
git checkout -b backup/{feature}-{date}
git add .
git commit -m "backup: {feature} rollback backup"
git checkout -
```

### Step 3: 执行回滚

根据情况选择回滚方式:

**方式 A: 未提交的变更（最常见）**
```bash
# 丢弃所有未提交的变更
git checkout -- .
git clean -fd
```

**方式 B: 已提交但未推送**
```bash
# 回退最近一次 commit（保留文件变更）
git reset --hard HEAD~1
```

**方式 C: 已推送到远程**
```bash
# 创建 revert commit（安全回退）
git revert {commit_hash}
git push origin main
```

**方式 D: 选择性回滚**
```bash
# 只回滚特定文件
git checkout -- {file_path1} {file_path2}
```

### Step 4: 验证回滚成功

```bash
# 1. 确认工作区干净
git status

# 2. 确认测试通过（回归验证）
npm run test

# 3. 确认构建成功
npm run build

# 4. 手动验证核心功能正常
```

### Step 5: 记录回滚

在 `.harness/progress/current.md` 中追加:

```markdown
## ⚠️ 回滚记录

**增量**: #{N} {功能描述}
**回滚时间**: YYYY-MM-DD HH:MM
**回滚原因**: {为什么失败 — 从触发条件中选择}
**回滚范围**: {回滚了哪些文件}
**回滚方式**: {A/B/C/D}
**恢复方式**: {如何恢复到回滚前状态}
**经验教训**: {下次如何避免此类问题}
```

同时在 `.harness/audits/rollbacks/` 中创建详细记录。

## 回滚后处理

### 情况 A: 任务需要重做
1. 回到 PO 或 Architect 重新分析
2. 判断是需求理解错误 → 回到 `/spec`
3. 判断是任务拆分不当 → 回到 `/plan`
4. 重新执行 `/build` → `/test` → `/review`

### 情况 B: 缩小范围继续
1. 从当前增量的子任务中选取更小的范围
2. 更新计划文件标注"缩小范围"
3. 继续执行

### 情况 C: 任务完全取消
1. 清理所有相关临时文件
2. 在 progress 中标记"已取消"
3. 更新 MEMORY.md 记录取消原因

## 预防措施（应在执行中遵守）

- 每个 Wave 完成后立即 `git commit`（原子提交）
- 单个 Wave 变更控制在 ≤100 行
- 复杂变更先在 feature 分支上进行
- 定期运行测试（每 Wave 至少一次）
- 上下文接近 80% 时及时持久化
