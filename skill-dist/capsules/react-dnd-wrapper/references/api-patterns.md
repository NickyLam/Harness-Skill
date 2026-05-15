# 第三方库 API 速查

> library-wrapper Skill 的 references/ 目录文件
> 项目特定库配置请记录到 .harness/config.yaml 中

## 核心概念（以 React DnD 为例）

| 概念 | 说明 |
|------|------|
| **Provider** | 上下文提供者，必须在所有使用组件外层 |
| **useDrag** | 让组件可拖拽（Drag Source） |
| **useDrop** | 让组件可接收拖放（Drop Target） |
| **Backend** | 平台原生交互后端（如 HTML5Backend） |

## 完整交互流程

```
1. App 顶层包裹 Provider
   └── <Provider backend={Backend}>
         <App />
       </Provider>

2. 源组件使用 useDrag
   └── item: { itemType: '{type}' }
       type: '{type}'

3. 目标组件使用 useDrop
   └── accept: '{type}'
       drop: (item) => handleDrop(item)

4. 用户操作 → useDrag collect 状态变化
   → 拖到目标上方 → useDrop collect 状态变化
   → 松开 → drop 回调执行 → 数据更新
```

## 项目特定配置

> 从 .harness/config.yaml 的 `libraryWrappers` 字段读取项目使用的库及其配置。
> 每个项目可在 config.yaml 中声明：
> - 使用的库及其版本
> - 拖拽源/放置目标清单
> - 特定 API 配置
