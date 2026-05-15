---
id: cp-api-design
name: "API Design — 接口契约设计"
description: "When the user mentions API design, REST endpoint, OpenAPI spec, interface contract, URL routing, or needs to define HTTP APIs, ALWAYS use this skill. Provides Contract-First methodology with OpenAPI YAML, versioning strategy, and mock server validation."
stage: build
roles: [API Architect, Backend Developer]
pattern: Contract First
mandatory: false
depends: [cp-spec-generator, cp-deep-requirements]
version: "3.0.0"
min_lines: 50
compatibility:
  tools: [Read, Write, WebFetch, WebSearch]
  dependencies: ["node >= 18", "npm", "swagger-codegen"]
---

# API Design — 接口契约设计

> Contract First 方法论：先定义接口契约，再实现业务逻辑，确保 API 可预测、可测试、可演进

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 新增 API 端点 | spec 阶段定义了新的业务能力 | 需要暴露新的 HTTP 接口 |
| 重构现有 API | 性能优化或架构调整需要改变接口形状 | 修改 URL、请求/响应格式 |
| API 版本升级 | 不兼容变更需要新版本接口 | v1 → v2 的版本化设计 |
| 第三方集成 | 需要对外提供标准化接口 | OpenAPI 规范作为合同文档 |
| Mock 服务搭建 | 前后端并行开发需要 API 契约先行 | 基于 OpenAPI 生成 Mock Server |

**不触发场景**：纯内部函数调用、事件驱动内部消息、不对外暴露的模块间调用。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 需求规格说明 | `.harness/specs/` 下的需求文档 | 必需 | 明确 API 要解决的业务问题 |
| 数据模型定义 | spec 阶段的 ER 图 / 类型定义 | 必需 | API 的请求/响应结构基于数据模型 |
| 认证授权方案 | 项目安全规范文档 | 必需 | 确定 Auth 中间件和权限模型 |
| 项目技术栈决策 | 已确定的框架（Express/Fastify/NestJS 等） | 必需 | 影响路由组织和中间件选择 |

## 核心原则

1. **契约优先** — OpenAPI/YAML 先于代码，接口定义即合同
2. **RESTful 语义** — URL 是资源名词，HTTP 方法表达动作意图
3. **统一错误格式** — 所有端点返回相同的错误响应结构
4. **渐进式演进** — 通过版本化而非破坏性变更来迭代

## 执行流程

### Step 1：资源建模与 URL 设计

将业务需求映射为 RESTful 资源：

- [ ] 识别领域名词作为资源（User、Order、Product）
- [ ] 确定资源间的层级关系（嵌套 vs 扁平）
- [ ] 设计 URL 路径，遵循 kebab-case 命名
- [ ] 避免动词出现在 URL 中（动作由 HTTP 方法表达）

**URL 命名规范**：

```
✅ 正确示例：
GET    /api/v1/users              # 获取用户列表
GET    /api/v1/users/:id          # 获取单个用户
POST   /api/v1/users              # 创建用户
PUT    /api/v1/users/:id          # 全量更新用户
PATCH  /api/v1/users/:id          # 部分更新用户
DELETE /api/v1/users/:id          # 删除用户
GET    /api/v1/users/:id/orders   # 获取用户的订单（子资源）

❌ 错误示例：
GET    /api/v1/getUsers           # URL 中包含动词
POST   /api/v1/users/create       # 动词应通过 POST 表达
GET    /api/v1/user_info          # 使用单数形式而非复数
```

**输出**: 资源映射表 `.harness/api/resource-map.md`

### Step 2：编写 OpenAPI 规范（YAML）

以 YAML 格式编写完整的接口契约：

```yaml
openapi: 3.0.3
info:
  title: Project API
  version: 1.0.0
  description: RESTful API for project management

servers:
  - url: http://localhost:3000/api/v1
    description: Local development

paths:
  /users:
    post:
      summary: Create a new user
      operationId: createUser
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
            example:
              email: "user@example.com"
              name: "Alice"
              role: "member"
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /users/{userId}:
    get:
      summary: Get user by ID
      operationId: getUser
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          $ref: '#/components/responses/NotFound'

components:
  schemas:
    User:
      type: object
      required: [id, email, name, role, createdAt]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [admin, member, guest]
        createdAt:
          type: string
          format: date-time

    CreateUserRequest:
      type: object
      required: [email, name]
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [admin, member, guest]
          default: member

    ErrorResponse:
      type: object
      required: [code, message, timestamp]
      properties:
        code:
          type: string
          description: Error code for programmatic handling
          example: VALIDATION_ERROR
        message:
          type: string
          description: Human-readable error message
          example: Email address is invalid
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              issue:
                type: string
        timestamp:
          type: string
          format: date-time
        traceId:
          type: string
          description: Correlation ID for debugging

  responses:
    BadRequest:
      description: Invalid request parameters
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

- [ ] 所有端点都有完整的 request/response schema 定义
- [ ] 使用 `$ref` 复用公共 schema 组件
- [ ] 错误响应至少覆盖 400/401/403/404/422/500
- [ ] 每个操作有唯一的 `operationId`
- [ ] security scheme 在全局或操作级别声明

**输出**: `api/openapi.yaml`

### Step 3：版本化策略确定

选择适合项目的 API 版本管理方式：

| 策略 | 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|---------|
| **URL Versioning** | `/api/v1/users`, `/api/v2/users` | 直观、缓存友好 | URL 冗长 | 公开 API、多版本长期共存 |
| **Header Versioning** | `Accept: application/vnd.api.v2+json` | URL 干净 | 不便于调试、缓存复杂 | 内部 API、工具链完善 |
| **Media Type Versioning** | Content-Type negotiation | 符合 HTTP 语义 | 客户端支持度低 | 高度规范的成熟团队 |

**推荐默认策略**：URL Versioning（最广泛采用，工具链支持最好）

**版本生命周期**：
```
v1 (Current)  ← 默认路由，稳定维护
v2 (Beta)     ← 新功能在此版本实验
v0 (Deprecated) → 6 个月后移除
```

**输出**: 版本化策略文档（记录在 openapi.yaml 注释或独立文件中）

### Step 4：从契约生成代码骨架

基于 OpenAPI 规范生成路由骨架和类型定义：

```typescript
// api/routes/users.ts — 由 openapi.yaml 自动生成的骨架
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'member', 'guest']).optional().default('member'),
});

router.post('/users', async (req, res) => {
  // TODO: 实现 createUser 业务逻辑
  res.status(501).json({ code: 'NOT_IMPLEMENTED', message: 'TODO' });
});

router.get('/users/:userId', async (req, res) => {
  // TODO: 实现 getUser 业务逻辑
  res.status(501).json({ code: 'NOT_IMPLEMENTED', message: 'TODO' });
});

export default router;
```

- [ ] 路由结构与 OpenAPI paths 一一对应
- [ ] 请求体验证 schema 自动生成（Zod/Ajv/Joi）
- [ ] 响应类型定义导出供前端使用
- [ ] 所有骨架端点返回 501 Not Implemented

**输出**: `api/routes/*.ts`, `api/types/*.ts`, `api/schemas/*.ts`

### Step 5：Mock Server 启动验证

在实现业务逻辑之前，启动 Mock Server 验证契约正确性：

```bash
# 使用 prism 作为 Mock Server（基于 OpenAPI 规范）
npx prism mock api/openapi.yaml -p 3001

# 验证端点可访问
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test"}'
```

- [ ] 所有定义的端点均可访问
- [ ] 请求体验证按 schema 工作（非法输入返回 400）
- [ ] 响应格式符合 OpenAPI 定义的 structure
- [ ] 前端团队可以基于 Mock 开始并行开发

**输出**: 可访问的 Mock Server 端点

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| OpenAPI 规范 | `api/openapi.yaml` | YAML | 完整的 API 契约定义 |
| 路由骨架代码 | `api/routes/{resource}.ts` | TypeScript | 由契约生成的空实现路由 |
| 类型定义 | `api/types/{resource}.ts` | TypeScript | 请求/响应的 TS 类型 |
| 验证 Schema | `api/schemas/{resource}.ts` | TypeScript | Zod/Ajv 请求体验证规则 |
| 资源映射表 | `.harness/api/resource-map.md` | Markdown | URL 到业务资源的映射 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| OpenAPI 校验失败（语法/引用错误） | 使用 `spectral lint api/openapi.yaml` 检查 | 按 OAS 规范修复错误后重试 |
| 资源建模争议（URL 设计无法达成一致） | 回到 spec 阶段澄清领域模型 | 组织 domain expert review 后再决策 |
| 版本兼容性问题（旧客户端无法迁移） | 维护旧版本的兼容层或适配器 | 设定 sunset date，逐步引导迁移 |
| Mock 数据不符合前端预期 | 前后端对齐数据格式理解 | 以 OpenAPI 规范为准，更新 mock example |
| Schema 过度设计（属性过多/嵌套过深） | 按 YAGNI 原则精简 | 只保留当前需要的字段，后续扩展通过 PATCH |

## 交接协议

```markdown
## API Design 交接包

### 交付给 tdd（实现阶段）
- OpenAPI 规范路径：api/openapi.yaml
- 待实现的端点列表（operationId 列表）：[createUser, getUser, ...]
- 生成的路由骨架路径：api/routes/*.ts
- 类型定义路径：api/types/*.ts

### 交付给 e2e-qa（测试阶段）
- Mock Server 地址和启动命令
- 每个端点的预期请求/响应示例
- 认证方式说明（Bearer Token / API Key / Session）

### 交付给 ci-cd-pipeline（发布阶段）
- API 文档构建命令（Redoc/Swagger UI）
- Breaking change 检查清单
- 版本发布流程（何时引入 v2）
```

**交接验证**：接收方可通过 `prism mock` 启动服务并成功调用所有端点。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| OpenAPI 文件存在 | 文件系统检查 | `api/openapi.yaml` 存在且非空 |
| OAS 3.x 规范合规 | `spectral lint` | 0 errors, warnings ≤ 5 |
| 所有端点有 operationId | YAML 解析 | 每个 path item 都有唯一 operationId |
| 错误响应标准化 | schema 引用检查 | 所有 error response 引用统一的 ErrorResponse schema |
| 无未定义的裸字符串 | 类型扫描 | 所有 property 有 type/format/enum 定义 |
| 路由骨架已生成 | 文件系统检查 | `api/routes/` 下有对应 resource 的 .ts 文件 |
| Mock Server 可启动 | HTTP 请求测试 | `prism mock` 启动后 GET / 返回有效响应 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## HTTP 状态码使用规范

| 状态码 | 场景 | 示例 |
|-------|------|------|
| 200 OK | 成功 GET / PUT / PATCH | 返回资源或更新结果 |
| 201 Created | 成功 POST 创建 | Location header 包含新资源 URL |
| 204 No Content | 成功 DELETE | 无响应体 |
| 400 Bad Request | 参数校验失败 | 返回具体字段错误信息 |
| 401 Unauthorized | 未认证 / Token 过期 | WWW-Authenticate header |
| 403 Forbidden | 已认证但无权限 | 不应区分「不存在」vs「无权访问」 |
| 404 Not Found | 资源不存在 | 统一格式，不泄露内部细节 |
| 409 Conflict | 资源冲突（如重复创建） | 返回冲突原因 |
| 422 Unprocessable Entity | 语义正确但无法处理 | 业务规则校验失败 |
| 429 Too Many Requests | 限流触发 | Retry-After header |
| 500 Internal Server Error | 服务器内部错误 | 不泄露堆栈信息 |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| spec-generator | API 契约基于 spec 阶段的需求和数据模型 |
| tdd | 每个端点的实现遵循 TDD 流程 |
| e2e-qa | OpenAPI 规范指导 E2E 测试用例编写 |
| ci-cd-pipeline | CI 中自动校验 OpenAPI 规范合规性 |
| security-audit | 认证/授权/限流等安全相关端点审查 |
