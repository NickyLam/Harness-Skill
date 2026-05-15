# 增量回滚协议

> Orchestrator 的故障恢复机制

## 触发条件

以下情况需要执行回滚：

- 当前增量导致测试大面积失败（>50%）
- 当前增量引入无法快速修复的 Bug（预估 >15 分钟）
- 当前增量破坏了现有功能（回归问题）
- 当前增量变更超出预期范围（范围蔓延）
- 用户明确取消当前增量

## 回滚步骤

### Step 1：评估影响范围（1 分钟）

```bash
# 查看当前变更
git diff --stat

# 查看新增文件
git status

# 记录变更列表
git diff --name-only > /tmp/rollback-files.txt
```

### Step 2：创建回滚点（可选但推荐）

```bash
# 如果部分工作值得保留，创建分支
git checkout -b backup/<功能名>-<日期>
git add .
git commit -m "backup: <功能名> 回滚前备份"
git checkout -
```

### Step 3：执行回滚

```bash
# 方式 1：回滚所有未提交变更（推荐）
git checkout -- .
git clean -fd

# 方式 2：回滚到上次提交（如果已提交）
git reset --hard HEAD~1

# 方式 3：选择性回滚（只回滚特定文件）
git checkout -- <文件路径>
```

### Step 4：验证回滚成功

```bash
# 1. 确认工作区干净
git status

# 2. 确认测试通过
npm run test

# 3. 确认构建成功
npm run build

# 4. 确认功能正常（手动验证核心路径）
```

### Step 5：记录回滚

在 `.harness/progress/current.md` 中标记：

```markdown
## ⚠️ 回滚记录

**增量**：#X <描述>
**回滚时间**：YYYY-MM-DD HH:MM
**回滚原因**：<为什么失败>
**回滚范围**：<回滚了哪些文件>
**恢复方式**：<如何恢复到回滚前状态>
**经验教训**：<下次如何避免>
```

## 回滚后处理

### 情况 A：任务需要重做

1. 回到 PO 或 Architect 重新分析
2. 检查是否是需求理解错误 → 回到 /spec
3. 检查是否是任务拆分不当 → 回到 /plan
4. 重新执行 /build → /test → /review

### 情况 B：任务可以缩小范围继续做

1. 从当前增量的子任务中选取一个更小的范围
2. 更新计划文件，标注"缩小范围"
3. 继续执行

### 情况 C：任务完全取消

1. 清理所有相关文件
2. 在 progress 中标记"已取消"
3. 更新 MEMORY.md 记录取消原因

## 预防措施

- 每个任务完成后立即 commit（原子提交）
- 变更 >100 行时考虑拆分
- 复杂变更先在分支上进行
- 定期运行测试（每 5 分钟至少一次）

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| GSD | GSD 的 Wave 汇总验证可提前发现需要回滚的问题 |
| systematic-debugging | 回滚前如需定位根因，使用调试流程 |
| governance | 回滚经验写入 memory，提炼规则 |
