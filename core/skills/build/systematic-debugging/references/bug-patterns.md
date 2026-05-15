# 通用 Bug 模式库

> systematic-debugging Skill 的 references/ 目录文件
> 项目特定 Bug 模式请记录到 .harness/memory/ 中

## 模式 1：递归数据结构问题

**症状**：操作后节点丢失或重复
**常见根因**：
- 递归函数没有处理空 children
- 更新操作返回新对象但遗漏了子节点展开
- 删除操作过滤条件错误

**验证方法**：
```typescript
// 添加后检查 children 长度
expect(tree.children).toHaveLength(prevLength + 1);
// 删除后检查节点不存在
expect(findNodeById(tree, deletedId)).toBeNull();
```

## 模式 2：异步状态不同步

**症状**：操作后状态未更新或重复操作
**常见根因**：
- 回调中读取了旧的 state（闭包陷阱）
- 异步回调时序问题
- 事件类型不匹配

**验证方法**：
```typescript
// 操作后检查状态已更新
fireEvent.click(button);
expect(screen.getByText('预期文本')).toBeInTheDocument();
```

## 模式 3：选中/焦点状态残留

**症状**：删除/切换后仍显示旧状态
**常见根因**：
- 删除操作没有清除关联状态
- 重置操作遗漏了部分状态字段

**验证方法**：
```typescript
act(() => result.current.deleteItem(id));
expect(result.current.state.selectedId).toBeNull();
```

## 模式 4：条件分支遗漏

**症状**：特定场景功能缺失或异常
**常见根因**：
- 条件判断不完整
- 枚举值未全覆盖
- 边界条件未处理

**验证方法**：
```typescript
// 测试所有枚举值
Object.values(MyEnum).forEach(value => {
  const result = processValue(value);
  expect(result).toBeDefined();
});
```

## 模式 5：引用比较失败

**症状**：判断逻辑异常，条件不生效
**常见根因**：
- 浅比较 vs 深比较混淆
- 对象引用每次创建新实例
- useMemo/useCallback 依赖缺失

**验证方法**：
```typescript
// 确保引用稳定
const { rerender } = renderHook(() => useHook());
const firstResult = result.current.callback;
rerender();
expect(result.current.callback).toBe(firstResult);
```

## 新模式收集区

> 每次发现新 Bug 模式，追加到 .harness/memory/ 中。
> 格式：### 模式 N：名称 → 症状 / 常见根因 / 验证方法
