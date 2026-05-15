# Mermaid Charts Generator — Mermaid 图表生成器

> **所属 Capsule**: deep-requirements
> **生成器类型**: 产出物生成器 (Output Generator)
> **输入来源**: MODULE A (business-rules) + MODULE B (user-journey) + MODULE C (edge-cases)
> **输出格式**: Mermaid (.mmd)

## 生成器职责

根据分析模块的输出，生成各类 **Mermaid 可视化图表**，嵌入到 REQUIREMENTS.md 中或独立保存。

---

## 支持的图表类型

| 类型 | Mermaid 语法 | 来源模块 | 使用场景 |
|------|-------------|----------|----------|
| **流程图 (Flowchart)** | `graph TD/LR` | A, B, C | 规则依赖、审批流程、异常处理流 |
| **状态机 (State Diagram)** | `stateDiagram-v2` | B, C | 实体生命周期、订单状态、任务流转 |
| **旅程图 (Journey)** | `journey` | B | 用户情感体验地图 |
| **时序图 (Sequence)** | `sequenceDiagram` | B, C | API 调用时序、组件交互 |
| **ER 图 (ER Diagram)** | `erDiagram` | A, C | 数据模型关系 |

---

## 图表生成规则

### 1. 规则依赖关系图（graph TD）

**来源**: MODULE A - 业务规则的触发条件和依赖关系

```mermaid
graph TD
    subgraph "触发层"
        A[用户操作] --> B[规则BR-001]
        C[定时任务] --> D[规则BR-002]
    end

    subgraph "执行层"
        B --> E{条件判断}
        D --> E
        E -->|满足| F[执行动作X]
        E -->|不满足| G[执行动作Y]
    end

    subgraph "互斥组"
        F -.->|互斥| H[规则BR-004]
        G --> I[规则BR-005]
    end

    style A fill:#e1f5fe
    style F fill:#c8e6c9
    style G fill:#ffcdd2
```

**生成规则**:
- 使用 TD（Top-Down）布局
- 用 subgraph 分组（触发层、执行层、输出层）
- 互斥关系用虚线 `-.-` 表示
- 不同类型节点用不同颜色区分

---

### 2. 流程状态机（stateDiagram-v2）

**来源**: MODULE B - 用户旅程 + MODULE C - 异常处理

```mermaid
stateDiagram-v2
    [*] --> 待处理: 创建请求

    待处理 --> 处理中: 分配处理人
    待处理 --> 已拒绝: 不符合条件

    处理中 --> 等待审批: 提交审批
    处理中 --> 处理失败: 异常发生

    等待审批 --> 已通过: 审批通过
    等待审批 --> 已驳回: 审批驳回
    等待审批 --> 处理中: 补充材料

    已通过 --> [*]: 完成
    已驳回 --> 处理中: 修改后重新提交
    处理失败 --> 待处理: 重试
    处理失败 --> [*]: 放弃

    note right of 处理失败
        可能原因：网络超时、数据格式错误、权限不足
    end note
```

**生成规则**:
- 使用 v2 语法（支持 note）
- 包含所有主要状态和转换
- 标注关键异常状态的原因
- 循环/重试路径清晰展示

---

### 3. 用户旅程图（journey）

**来源**: MODULE B - 用户角色画像 + UJ-Q2 旅程路径

```mermaid
journey
    title {角色名} 的核心用户旅程
    section 发现与进入
      了解功能: 3: 用户
      访问入口: 4: 用户
      首次使用引导: 2: 用户
    section 核心操作
      步骤A: 5: 用户
      步骤B: 4: 用户
      步骤C: 3: 用户
      等待响应: 2: 用户
    section 完成与反馈
      任务完成: 5: 用户
      查看结果: 4: 用户
      分享/导出: 3: User
```

**生成规则**:
- 横轴为阶段，纵轴为步骤
- 评分 1-5（5=最佳体验）
- 明确标注低分环节（优化机会点）

---

### 4. 时序图（sequenceDiagram）

**来源**: MODULE B - 多角色交互 + MODULE C - 并发场景

```mermaid
sequenceDiagram
    actor User as 👤 用户
    participant FE as 🖥️ 前端
    participant API as 🔌 后端API
    participant DB as 💾 数据库

    User->>FE: 发起请求
    FE->>API: POST /api/resource
    API->>DB: 查询数据
    
    alt 数据存在
        DB-->>API: 返回数据
        API-->>FE: 200 OK + 数据
        FE-->>User: 展示结果
    else 数据不存在
        DB-->>API: 404 Not Found
        API-->>FE: 404 Error
        FE-->>User: 显示"未找到"
    end

    User->>FE: 确认操作
    FE->>API: PUT /api/resource/{id}
    API->>DB: 更新数据
    DB-->>API: 更新成功
    API-->>FE: 200 OK
    FE-->>User: 操作成功提示
```

**生成规则**:
- 使用 alt/opt/loop/par 控制流程
- 标注 HTTP 方法和状态码
- 清晰展示异步调用（如有）

---

### 5. ER 图（erDiagram）

**来源**: MODULE A - 业务实体 + MODULE C - 数据边界

```mermaid
erDiagram    USER ||--o{ ORDER : places
    USER {
        string id PK
        string name
        string email UK
        datetime created_at
    }

    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        string id PK
        string user_id FK
        status status
        decimal total_amount
        datetime created_at
        datetime updated_at
    }

    ORDER_ITEM }o--|| PRODUCT : references
    ORDER_ITEM {
        string id PK
        string order_id FK
        string product_id FK
        int quantity
        decimal unit_price
    }
```

**生成规则**:
- 标注 PK/FK/UK 约束
- 标注字段类型
- 展示 cardinality (||, o{|, |{)

---

## 输出规范

### 文件命名

| 图表类型 | 文件名示例 | 存放位置 |
|----------|------------|----------|
| 规则依赖图 | `rule-dependencies.mmd` | `.harness/diagrams/` |
| 状态机 | `{entity}-state-machine.mmd` | `.harness/diagrams/` |
| 旅程图 | `{role}-journey.mmd` | `.harness/diagrams/` |
| 时序图 | `{interaction}-sequence.mmd` | `.harness/diagrams/` |
| ER 图 | `{domain}-er-diagram.mmd` | `.harness/diagrams/` |

### 嵌入 REQUIREMENTS.md

在 REQUIREMENTS.md 中使用代码块嵌入：

````markdown
### 1.3 规则依赖关系图

```mermaid
{mermaid_code}
```
````

### 校验要求

- [ ] 所有图表可通过 [Mermaid Live Editor](https://mermaid.live) 渲染
- [ ] 无语法错误（标签匹配、箭头方向正确）
- [ ] 节点 ID 使用有效字符（不含特殊符号）
- [ ] 中文内容正常显示
