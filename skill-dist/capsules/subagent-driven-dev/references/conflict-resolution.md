# Conflict Resolution Mechanisms

## 场景 1：两个 Implementer 修改同一文件

**检测方法：**

```typescript
function detectFileConflicts(results: ImplementationResult[]): Conflict[] {
  const fileMap = new Map<string, string[]>();

  for (const result of results) {
    for (const file of result.modifiedFiles) {
      if (!fileMap.has(file)) {
        fileMap.set(file, []);
      }
      fileMap.get(file)!.push(result.taskId);
    }
  }

  const conflicts: Conflict[] = [];
  for (const [file, taskIds] of fileMap) {
    if (taskIds.length > 1) {
      conflicts.push({
        file,
        taskIds,
        type: 'file-conflict',
        resolution: 'manual-merge-required',
      });
    }
  }

  return conflicts;
}
```

**解决方案：**
1. **预防优于治疗**：在任务拆分时就避免文件重叠
2. **自动合并**：如果修改的是文件的不同区域，尝试自动合并
3. **人工协调**：如果无法自动合并，Coordinator 创建协调任务

## 场景 2：Reviewers 给出矛盾的建议

**解决策略：**

```typescript
function resolveConflictingSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const suggestionGroups = groupBy(suggestions, s => s.category);

  const resolved = [];
  for (const [category, group] of suggestionGroups) {
    if (group.length === 1) {
      resolved.push(group[0]);
    } else {
      // 有冲突：选择最严格的建议（安全原则）
      const strictest = group.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
      resolved.push({
        ...strictest,
        note: `Multiple reviewers suggested changes. Adopted strictest option.`,
      });
    }
  }

  return resolved;
}
```

## 场景 3：Implementer 超时或失败

**处理流程：**

```
Implementer 超时（>15分钟无响应）
    ↓
Coordinator 终止该子代理
    ↓
标记任务状态为 "timeout"
    ↓
分析原因：
  ├─ 任务太复杂 → 拆分为更小的子任务
  ├─ 依赖缺失 → 补充依赖后重新分配
  └─ 环境问题 → 重试一次
    ↓
重新分配给新的 Implementer（降低复杂度或提供更多上下文）
```
