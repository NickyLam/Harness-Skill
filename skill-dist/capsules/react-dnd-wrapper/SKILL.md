---
id: react-dnd-wrapper
name: "React DnD Wrapper — 第三方库知识封装"
stage: build
roles: [implementer]
pattern: tool-wrapper
mandatory: false
depends: []
version: "3.1"
description: "When the user mentions React DnD, drag and drop, or needs to implement drag-and-drop functionality using react-dnd library, ALWAYS use this skill. API patterns and best practices for react-dnd."
---

# Library Wrapper — React DnD 完整实现指南

> **设计模式**：Tool Wrapper（库级知识封装）> **阶段**：构建
> **触发**：/build（涉及拖拽功能时自动激活）
> **目标**：从需求到可运行代码的完整实现流程

## DnP 模式决策树（Design 'n' Pattern）

在开始编码前，先回答以下问题确定实现模式：

```
用户需要什么类型的拖拽？
├─ 列表项重新排序？
│  └─ → 使用【列表排序模式】(List Sorting)
│     适用：Todo列表、表格行排序、菜单项调整
│
├─ 从一个区域拖到另一个区域？
│  └─ → 使用【跨容器移动模式】(Cross-Container Transfer)
│     适用：看板、文件管理器、两栏选择器
│
├─ 需要自定义拖拽预览图像？
│  └─ → 使用【自定义预览模式】(Custom Preview)
│     适用：卡片拖拽、复杂元素拖拽、拖拽时显示缩略图
│
└─ 多种类型混合拖拽？
   └─ → 使用【多类型拖拽模式】(Multi-Type DnD)
      适用：工具箱拖放组件、表单构建器
```

## 核心原则（必须遵守）

1. **Provider 必须包裹所有使用该库的组件** — 不能在使用组件内部嵌套 Provider
2. **回调函数注意闭包陷阱** — 不要在回调中直接读取旧 state，使用 dispatch 或 ref
3. **类型字段必须匹配** — 拖拽源 type 和放置目标 accept 必须一致
4. **状态变化不等于操作完成** — 用悬停状态做视觉反馈，用完成回调做数据变更
5. **ref 必须正确传递** — 多个 ref 需要正确合并

## 完整实现流程（5步）

### Step 1：环境准备与依赖安装

```bash
# 安装核心依赖
npm install react-dnd react-dnd-html5-backend

# 或者使用触摸设备支持（可选）
npm install react-dnd-touch-backend

# 类型定义（TypeScript 项目必需）
npm install --save-dev @types/react-dnD @types/react-dnd-html5-backend
```

**验证安装成功：**
```bash
# 检查 package.json 是否包含依赖
grep -E "react-dnd|react-dnd-html5-backend" package.json
```

### Step 2：Provider 配置（全局一次）

在应用根组件或布局组件中配置 DnD Provider：

```typescript
// src/App.tsx 或 src/layouts/MainLayout.tsx
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      {/* 你的应用组件 */}
      <YourMainComponent />
    </DndProvider>
  );
}
```

**关键注意事项：**
- Provider 只需在组件树顶层配置一次
- 不要在多个地方重复包裹 Provider
- 如果使用 SSR（Next.js），需要在客户端动态导入

### Step 3：实现拖拽源组件（useDrag）

#### 基础模板：

```typescript
// src/components/draggable/DraggableItem.tsx
import { useDrag } from 'react-dnd';
import { ItemTypes } from './ItemTypes';

interface DraggableItemProps {
  id: string;
  type: string;
  children: React.ReactNode;
  index?: number;
  onMove?: (dragIndex: number, hoverIndex: number) => void;
}

export const DraggableItem: React.FC<DraggableItemProps> = ({
  id,
  type,
  children,
  index,
  onMove
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes[type], // 使用常量避免拼写错误
    item: () => ({ id, index }), // 使用工厂函数获取最新状态
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [id, index, type]); // 依赖数组确保更新

  // 应用 drag ref 到 DOM 元素
  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        padding: '8px',
        margin: '4px 0',
        backgroundColor: isDragging ? '#e3f2fd' : 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
      }}
    >
      {children}
    </div>
  );
};
```

**类型常量定义（推荐）：**
```typescript
// src/components/draggable/ItemTypes.ts
export const ItemTypes = {
  CARD: 'CARD',
  LIST_ITEM: 'LIST_ITEM',
  FILE: 'FILE',
  // 根据业务需求扩展
};
```

### Step 4：实现放置目标组件（useDrop）

#### 列表排序模式：

```typescript
// src/components/droppable/DroppableList.tsx
import { useDrop } from 'react-dnd';
import { ItemTypes } from './ItemTypes';

interface DroppableListProps {
  type: string;
  children: React.ReactNode;
  onDrop?: (item: { id: string; index: number }, newIndex: number) => void;
}

export const DroppableList: React.FC<DroppableListProps> = ({
  type,
  children,
  onDrop
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes[type], // 必须与 useDrag 的 type 匹配
    drop: (item: { id: string; index: number }) => {
      if (onDrop) {
        onDrop(item, 0); // 简化示例，实际需要计算新索引
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [type, onDrop]);

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      style={{
        backgroundColor: isOver ? '#f0f9ff' : 'white',
        padding: '16px',
        minHeight: '200px',
        border: `2px dashed ${isOver ? '#2196f3' : '#ccc'}`,
        borderRadius: '8px',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </div>
  );
};
```

#### 跨容器移动模式：

```typescript
// src/components/droppable/KanbanColumn.tsx
import { useDrop } from 'react-dnd';

interface KanbanColumnProps {
  columnId: string;
  title: string;
  acceptType: string;
  onCardDrop: (cardId: string, targetColumnId: string) => void;
  children: React.ReactNode;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  columnId,
  title,
  acceptType,
  onCardDrop,
  children
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: acceptType,
    drop: (item: { id: string }) => {
      onCardDrop(item.id, columnId); // 将卡片移到此列
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [columnId, acceptType, onCardDrop]);

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={`kanban-column ${isOver ? 'column-highlight' : ''}`}
      style={{
        opacity: canDrop ? 1 : 0.6,
      }}
    >
      <h3>{title}</h3>
      <div className="cards-container">
        {children}
      </div>
    </div>
  );
};
```

### Step 5：组合使用 + 测试验证

#### 同时作为拖拽源和放置目标（ref 合并）：

```typescript
// 当一个组件既可拖拽也可接收拖拽时
const [{ isDragging }, drag] = useDrag(() => ({ ... }));
const [{ isOver }, drop] = useDrop(() => ({ ... }));

// 合并 refs
<div ref={(node) => {
  drag(drop(node)); // 先 drop 后 drag
}}>
  内容
</div>
```

#### 集成示例（完整可运行）：

```typescript
// src/components/TodoListWithDnD.tsx
import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DraggableItem } from './draggable/DraggableItem';
import { DroppableList } from './droppable/DroppableList';
import { ItemTypes } from './draggable/ItemTypes';

interface TodoItem {
  id: string;
  text: string;
}

export const TodoListWithDnD: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([
    { id: '1', text: '学习 React DnD' },
    { id: '2', text: '实现拖拽排序' },
    { id: '3', text: '编写测试用例' },
  ]);

  const moveTodo = (dragIndex: number, hoverIndex: number) => {
    const newTodos = [...todos];
    const [removed] = newTodos.splice(dragIndex, 1);
    newTodos.splice(hoverIndex, 0, removed);
    setTodos(newTodos);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <h2>待办事项（支持拖拽排序）</h2>
      <DroppableList type="LIST_ITEM" onDrop={(item, newIndex) => {
        const dragIndex = todos.findIndex(t => t.id === item.id);
        if (dragIndex !== -1) {
          moveTodo(dragIndex, newIndex);
        }
      }}>
        {todos.map((todo, index) => (
          <DraggableItem
            key={todo.id}
            id={todo.id}
            type="LIST_ITEM"
            index={index}
            onMove={moveTodo}
          >
            {todo.text}
          </DraggableItem>
        ))}
      </DroppableList>
    </DndProvider>
  );
};
```

## API 速查表（快速参考）

### useDrag Hook 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | ✅ | 拖拽类型标识符（必须与 useDrop.accept 匹配） |
| `item` | object \| function | ✅ | 拖拽数据（推荐使用函数返回最新状态） |
| `collect` | function | ❌ | 收集拖拽状态（isDragging, canDrag 等） |
| `options` | object | ❌ | 配置选项（isDragging 等） |

### useDrop Hook 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accept` | string \| string[] | ✅ | 接受的拖拽类型 |
| `drop` | function | ❌ | 放置时的回调 |
| `collect` | function | ❌ | 收集放置状态（isOver, canDrop 等） |

## 常见坑及解决方案（扩展版）

| 坑 | 症状 | 解决方案 | 代码示例 |
|---|------|---------|----------|
| Provider 嵌套 | 功能不响应，控制台报错 | 确保只有一层 Provider 在 App 顶层 | `<App><DndProvider>...</DndProvider></App>` |
| 回调中读取旧状态 | 新数据没出现，显示旧值 | 使用 dispatch 而非直接读取 state | `dispatch({type: 'ADD', payload: item})` |
| 类型不匹配 | 拖拽无响应，无报错 | 检查 useDrag.type 和 useDrop.accept | `ItemTypes.CARD === ItemTypes.CARD` |
| 忘记传递 ref | 无视觉反馈，无法拖拽 | 确保 ref 绑定到 DOM 元素 | `<div ref={drag}>...</div>` |
| 闭包陷阱 | drop 回调中 state 过期 | 改用 useRef 存储最新回调 | `const callbackRef = useRef(onDrop)` |
| ref 冲突 | 拖拽和放置同时存在时异常 | 使用 ref 合并模式 | `drag(drop(node))` |
| 性能问题 | 大列表拖拽卡顿 | 使用 React.memo + 虚拟化列表 | `React.memo(DraggableItem)` |
| SSR 兼容性 | Next.js 报错 "window is undefined" | 动态导入 DnDProvider | `next/dynamic` + `ssr: false` |
| 触摸设备不支持 | 移动端无法拖拽 | 安装 touch-backend | `react-dnd-touch-backend` |
| TypeScript 类型错误 | 类型推断失败 | 显式声明类型泛型 | `useDrag<ItemType>()` |
| 自定义拖拽预览 | 默认预览不符合需求 | 使用 DragPreviewImage | `<DragPreviewImage src={preview} />` |

## 失败处理（12个场景全覆盖）

| 失败场景 | 检测方式 | 处理方式 | 恢复命令 |
|---------|---------|---------|----------|
| 库未安装 | `npm list react-dnd` 失败 | 提示用户安装依赖 | `npm install react-dnd react-dnd-html5-backend` |
| Provider 缺失 | 控制台报错 "Cannot use useDrag outside DndProvider" | 在 App 顶层添加 DndProvider | 在 `src/App.tsx` 或 `src/main.tsx` 中包裹 |
| 类型不匹配 | 拖拽无响应，无控制台报错 | 检查 type 和 accept 是否完全一致 | 统一使用 `ItemTypes` 常量对象 |
| 闭包陷阱 | drop 回调中读取旧 state 数据 | 改用 dispatch 或 useRef 存储最新回调 | 重构为 `useCallback` + 依赖数组 |
| ref 冲突 | 组件同时是 drag 和 drop 时功能异常 | 使用 ref 合并模式 `drag(drop(node))` | 参考上方 "Step 5" 示例 |
| 性能问题 | 大列表（>100项）拖拽帧率<30fps | 使用 React.memo 包裹 + 虚拟化列表 | `npm install react-window` + `React.memo(Component)` |
| SSR 报错 | Next.js 环境报 "window is undefined" | 使用动态导入禁用 SSR | `next/dynamic({ ssr: false })` |
| 触摸设备无效 | 移动端/平板无法拖拽 | 替换 backend 为 touch-backend | `npm install react-dnd-touch-backend` 并修改 Provider |
| TypeScript 编译错误 | 类型推断失败，tsc 报错 | 显式添加类型注解 | `useDrag<{ id: string }>()` |
| 测试环境失败 | Jest/Testing Library 测试报错 | mock DnD context 或使用测试工具 | `npm install --save-dev @testing-library/react-dnd` |
| 样式冲突 | 拖拽时样式异常或不显示 | 检查 CSS 优先级和 z-index | 添加 `!important` 或提升 specificity |
| 可访问性问题 | 键盘用户无法操作 | 添加键盘事件支持和 ARIA 属性 | `onKeyDown` + `role="listitem"` |

## 产出物（5个关键交付物）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| 拖拽组件代码 | `src/components/<FeatureName>/<ComponentName>.tsx` | TypeScript | 使用 useDrag/useDrop 的组件实现 | **必需** |
| 类型常量定义 | `src/components/<FeatureName>/ItemTypes.ts` | TypeScript | 所有拖拽类型的集中定义 | **必需** |
| 组件单元测试 | `src/components/<FeatureName>/<ComponentName>.test.tsx` | TypeScript+RTL | 拖拽交互行为测试 | **必需** |
| 使用示例/Story | `src/components/<FeatureName>/<ComponentName>.stories.tsx` | Storybook | 可视化展示不同状态 | 推荐 |
| 文档说明 | `docs/features/<feature-name>-dnd.md` | Markdown | API 使用说明和最佳实践 | 推荐 |

## 测试策略（TDD 要求）

### 单元测试模板：

```typescript
// src/components/TodoListWithDnD.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TodoListWithDnD } from './TodoListWithDnD';

// Mock DnD context（简化测试）
jest.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, jest.fn()],
  useDrop: () => [{ isOver: false }, jest.fn()],
  DndProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('TodoListWithDnD', () => {
  it('渲染所有待办事项', () => {
    render(<TodoListWithDnD />);
    expect(screen.getByText('学习 React DnD')).toBeInTheDocument();
    expect(screen.getByText('实现拖拽排序')).toBeInTheDocument();
  });

  it('显示正确的初始数量', () => {
    render(<TodoListWithDnD />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});
```

## 与其他 Skill 的协作矩阵

| 协作 Skill | 协作时机 | 协作内容 | 输出→输入 |
|-----------|---------|---------|----------|
| `/build` | 构建涉及拖拽功能时 | 自动加载本 Skill 提供实现指导 | 需求描述 → 拖拽组件代码 |
| `systematic-debugging` | 拖拽功能出现 Bug 时 | 先查本 Wrapper 的常见坑表 | Bug 现象 → 可能原因列表 |
| `tdd` | 实现拖拽功能前 | 先写拖拽交互测试 | 测试用例 → 实现代码 |
| `qa` | 功能完成后 | 验证拖拽在不同设备的可用性 | 组件代码 → QA 测试报告 |
| `code-simplification` | 代码审查时 | 检查是否遵循 DnD 最佳实践 | 当前代码 → 简化建议 |
| `performance-testing` | 大量数据场景 | 验证虚拟化列表性能 | 性能指标 → 优化方案 |

## 项目特定库配置

> 从 `.harness/config.yaml` 的 `libraryWrappers` 字段读取项目使用的特定库及其配置。
> 每个项目可在 config.yaml 中声明需要加载的库封装 Skill。

**config.yaml 示例：**
```yaml
libraryWrappers:
  react-dnd:
    version: "^16.0.0"
    backend: "html5-backend" # 或 touch-backend
    features:
      - sorting
      - cross-container
      - custom-preview
```

## 质量检查清单（发布前必检）

- [ ] Provider 已在应用顶层正确配置（仅一处）
- [ ] 所有 type/accept 使用 `ItemTypes` 常量（无硬编码字符串）
- [ ] 拖拽组件已用 `React.memo` 包裹（性能优化）
- [ ] drop 回调使用 dispatch/ref 而非直接读 state（避免闭包陷阱）
- [ ] ref 合并正确处理同时 drag+drop 的组件
- [ ] 单元测试覆盖正常拖拽、边界情况、失败场景
- [ ] 文档包含使用示例和 API 说明
- [ ] 支持 SSR（如适用）或明确标注仅客户端
- [ ] 可访问性：键盘操作支持 + ARIA 标签
- [ ] 性能：大列表（>100项）使用虚拟化
