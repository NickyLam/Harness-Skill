---
id: cp-error-monitoring
name: "Error Monitoring — 错误监控"
stage: build
roles: [SRE, Backend Developer, Frontend Developer]
pattern: Observability Pattern
mandatory: false
depends: [tdd, cp-containerization]
version: "3.0.0"
min_lines: 50
description: "When the user mentions error monitoring, observability, or needs to set up error tracking and alerting, ALWAYS use this skill. Instrumentation, aggregation, and alerting pipeline."
---

# Error Monitoring — 错误监控

> 构建从客户端采集到服务端聚合再到智能告警的全链路可观测体系，让每个错误都可追踪、可分类、可定位

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 项目初始化可观测性 | 需要建立基础监控能力 | 首次接入错误监控 SDK |
| 新增核心业务模块 | 新功能上线需要有错误兜底 | 为新模块配置错误捕获 |
| 监控告警规则调整 | SLA 变更或业务峰值预期变化 | 调整阈值和通知策略 |
| 排查线上问题 | systematic-debugging 需要更多上下文 | 利用监控数据辅助定位根因 |
| 合规审计要求 | 需要满足日志留存和审计规范 | 确保日志格式和保留策略合规 |

**不触发场景**：纯本地开发调试（使用 console.log 即可）、一次性脚本的临时运行。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 应用框架信息 | React / Express / Next.js 等 | 必需 | 决定 SDK 选择和集成方式 |
| 错误监控平台选型 | Sentry / DataDog / 自建 | 必需 | 确定上报目标和配置参数 |
| 日志基础设施 | ELK / Loki / CloudWatch | 推荐 | 结构化日志的存储和查询后端 |
| PII 数据分类 | 数据隐私合规文档 | 必需 | 明确哪些字段不能出现在日志中 |

## 核心原则

1. **结构化优先** — 日志必须是机器可解析的结构化格式（JSON），禁止自由格式文本
2. **PII 零泄露** — 个人身份信息绝不出现在日志和错误报告中
3. **分级响应** — 不同级别的错误触发不同的告警策略和处理时效
4. **上下文丰富** — 错误报告必须携带足够的上下文（用户 ID、版本号、操作链路）

## 执行流程

### Step 1：设计错误监控架构

规划完整的错误采集→聚合→分析→告警链路：

```
┌─────────────────────────────────────────────────────────┐
│                    错误监控架构                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ 前端 SDK  │   │ 后端 SDK │   │ 服务日志  │            │
│  │ (Sentry)  │   │ (Sentry) │   │(Structured)           │
│  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘            │
│        │               │               │                  │
│        └───────┬───────┘               │                  │
│                ▼                       ▼                  │
│        ┌─────────────────────────────────┐               │
│        │      聚合 & 存储 (Sentry/Loki)    │               │
│        └──────────────┬──────────────────┘               │
│                       ▼                                  │
│        ┌─────────────────────────────────┐               │
│        │   分析 & 告警 (Alert Rules)       │               │
│        └──────────────┬──────────────────┘               │
│                       ▼                                  │
│        ┌──────────┬──────────┬──────────┐                │
│        │ Slack   │ PagerDuty│  Email   │                │
│        │ 通知    │  升级    │  报告    │                │
│        └──────────┴──────────┴──────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**架构决策记录**：
- [ ] 前端错误采集方案：Sentry Browser SDK / 自建
- [ ] 后端错误采集方案：Sentry Node SDK / Winston + transport
- [ ] 日志存储方案：Sentry / Loki / CloudWatch Logs
- [ ] 告警通知渠道：Slack / 钉钉 / PagerDuty / 短信
- [ ] 数据保留策略：Hot 7天 / Warm 30天 / Cold 90天

**输出**: `.harness/monitoring/architecture.md`

### Step 2：实现错误分类与分级体系

定义清晰的错误级别和判定标准：

| 级别 | 名称 | 判定标准 | 示例 | 响应时效 | 通知对象 |
|------|------|---------|------|---------|---------|
| **FATAL** | 致命错误 | 服务完全不可用，核心功能全部中断 | DB 连接池耗尽、进程 OOM Kill | 立即（< 5 min） | 全员 + on-call |
| **ERROR** | 错误 | 单个功能不可用或严重异常 | 支付回调失败、关键 API 500 | 15 分钟内 | 开发团队 |
| **WARN** | 警告 | 功能降级运行或潜在风险 | 缓存命中率突降、第三方 API 超时 | 1 小时内 | 负责人 |
| **INFO** | 信息 | 正常业务事件记录 | 用户登录、订单创建 | 不主动通知 | 仅存储 |

**前端错误分类**：

| 类别 | 来源 | 采集方式 | 上报策略 |
|------|------|---------|---------|
| JS Runtime Error | 未捕获异常 | `window.onerror` + `unhandledrejection` | 立即上报 |
| React Error Boundary | 组件渲染崩溃 | ErrorBoundary catch | 附带组件栈上报 |
| Network Error | API 请求失败 | Axios/Fetch interceptor | 按状态码分级 |
| Resource Load Error | 图片/字体加载失败 | `addEventListener('error')` | 批量聚合上报 |
| Console Error | 开发者误留的 console.error | 重写 console（仅生产） | 采样上报（10%） |
| Performance | CLS / FCP / LCP 异常 | PerformanceObserver | 每日聚合报告 |

**输出**: `src/lib/error-classification.ts`

### Step 3：实现结构化日志策略

编写统一的结构化日志模块：

```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.creditCard',
      'user.email',
      'user.phone',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-request-id': req.headers['x-request-id'],
      },
      remoteAddress: req.remoteAddress,
    }),
    err: pino.stdSerializers.err,
  },
});

export function logWithContext(
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context: Record<string, unknown>,
  error?: Error,
): void {
  const entry = {
    msg: message,
    ...context,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  };

  if (error) {
    entry['error'] = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  logger[level](entry);
}
```

**日志规范**：

| 规范项 | 要求 | 示例 |
|-------|------|------|
| 格式 | JSON，一行一条 | `{"level":"info","msg":"...","time":"..."}` |
| 时间戳 | ISO 8601 + UTC | `"2026-05-06T14:30:00.000Z"` |
| 关联 ID | 每个请求携带 traceId + spanId | `"traceId":"abc123","spanId":"def456"` |
| PII 过滤 | 密码/token/邮箱/手机号脱敏 | `[REDACTED]` |
| 敏感度标记 | 含 PII 的日志标记敏感等级 | `"sensitivity":"pii"` |
| 大小限制 | 单条日志 ≤ 4KB | 截断过长字段 |

**输出**: `src/lib/logger.ts`, `logging-config.yaml`

### Step 4：实现客户端错误采集 SDK

前端错误自动采集和上报：

```typescript
// src/lib/error-monitor.ts
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  sampleRate: 1.0,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 错误分组优化
  normalizeDepth: 5,

  // 忽略已知无害的错误
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /Loading chunk \d+ failed/,
    /Loading CSS chunk \d+ failed/,
    /NetworkError when attempting to fetch resource/,
  ],

  // PII 自动过滤
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.phone;
      delete event.user.ip_address;
    }
    // 移除 URL 中的 query 参数（可能含 token）
    if (event.request?.url) {
      event.request.url = event.request.url.split('?')[0];
    }
    return event;
  },

  // 附加业务上下文
  initialScope: {
    tags: {
      component: 'frontend',
    },
  },
});

// 手动捕获业务错误
export function captureBusinessError(
  error: Error | string,
  context: {
    action?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  Sentry.captureException(error instanceof error ? error : new Error(error), {
    tags: {
      type: 'business_error',
      action: context.action || 'unknown',
    },
    user: context.userId ? { id: context.userId } : undefined,
    extra: context.metadata,
  });
}

// 性能指标上报
export function capturePerformanceMetric(
  name: string,
  value: number,
  unit: 'milliseconds' | 'bytes' = 'milliseconds',
): void {
  Sentry.metrics.increment(name, value, { unit, tags: { environment: process.env.NODE_ENV } });
}
```

- [ ] SDK 在应用入口处初始化
- [ ] 生产环境启用，开发环境可选关闭或降低采样率
- [ ] PII 过滤规则已配置并在 beforeSend 中生效
- [ ] 已知无害错误已在 ignoreErrors 中列出
- [ ] 手动上报接口暴露给业务代码使用

**输出**: `src/lib/error-monitor.ts`

### Step 5：配置告警规则

基于 SLA 定义自动化告警规则：

**告警规则矩阵**：

| 规则名称 | 指标 | 条件 | 严重度 | 通知渠道 | 静默期 |
|---------|------|------|-------|---------|--------|
| Error Rate Spike | 错误率 | > 1% 持续 5 min | Critical | Slack + PagerDuty | 15 min |
| P99 Latency Degradation | P99 延迟 | > 2s 持续 10 min | Warning | Slack | 30 min |
| Fatal Error Burst | Fatal 数量 | > 10 次 / 5 min | Critical | Slack + 电话 | 无 |
| New Error Type | 新增 error fingerprint | 首次出现 | Info | Slack | 1 hour |
| Uptime Drop | 可用性 | < 99.9% 持续 5 min | Critical | PagerDuty | 无 |
| CDN Error Rate | 静态资源错误率 | > 5% | Warning | Slack | 1 hour |

**告警通知格式**：

```markdown
🚨 [CRITICAL] Error Rate Spike Detected
📈 Metric: error_rate = 1.8% (threshold: 1%)
⏰ Duration: 7 minutes (since 14:23:00 UTC)
🏷️ Environment: production
🔗 Investigate: https://sentry.io/issues/xxx
👤 On-call: @backend-team
```

- [ ] 至少配置 3 个以上告警规则（Error Rate / Fatal / P99）
- [ ] 每条规则有明确的通知渠道和升级路径
- [ ] 设置合理的静默期防止告警风暴
- [ ] 告警消息包含足够的上下文用于快速定位
- [ ] 定期 review 告警规则有效性（减少误报）

**输出**: 告警规则配置（Sentry/Grafana/DataDog 平台配置或 IaC 文件）

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 日志模块 | `src/lib/logger.ts` | TypeScript | 结构化日志的核心库封装 |
| 错误监控 SDK | `src/lib/error-monitor.ts` | TypeScript | 前端/后端错误采集和上报 |
| 错误分类定义 | `src/lib/error-classification.ts` | TypeScript | 级别标准和分类逻辑 |
| 监控架构文档 | `.harness/monitoring/architecture.md` | Markdown | 整体架构和决策记录 |
| 日志配置 | `logging-config.yaml` | YAML | 输出格式、级别、过滤规则 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| SDK 初始化失败（DSN 无效） | 降级为 noop 模式，不影响主流程 | 应用正常运行，仅丢失监控数据 |
| 日志量暴增导致存储成本过高 | 调整采样率和日志级别 | INFO 级别在生产环境采样 50% |
| PII 泄露到日志中发现 | 立即 rotate 相关密钥 + 更新 redact 规则 | 审计受影响的时间范围 |
| 告警疲劳（大量误报） | 分析误报模式，调整阈值或加入 ignore list | 引入告警聚合窗口（同类型 5 分钟内只通知一次） |
| 错误上报本身失败（网络不通） | 本地队列缓存 + 重试 | IndexedDB（前端）/ 内存缓冲区（后端），最大重试 3 次 |
| Sentry 配额超限 | 启动采样率动态调整 | Error 采样从 100% 降到 50%，Breadcrumb 从 100 降到 30 |

## 交接协议

```markdown
## Error Monitoring 交接包

### 交付给 systematic-debugging（问题排查）
- Sentry/Dashbaord 访问地址和查询技巧
- 如何通过 traceId 关联前后端日志
- 常见错误类型的快速定位指南

### 交付给 ci-cd-pipeline（部署验证）
- 部署后的冒烟检查命令（确认 SDK 正常工作）
- 新版本的 release tag 是否正确上报
- 错误率基线值（用于回归检测）

### 交付给 ship-pipeline（发布决策）
- 当前错误率趋势图
- 发布前的 error budget 剩余量
- 新版本引入的新 error fingerprint 预估
```

**交接验证**：接收方能通过监控面板看到一个真实的错误事件及其完整上下文。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 日志模块存在 | 文件系统检查 | `src/lib/logger.ts` 存在 |
| 错误监控 SDK 存在 | 文件系统检查 | `src/lib/error-monitor.ts` 存在 |
| PII 过滤规则已配置 | 内容搜索 | redact/censor/REDACTED 关键词出现 |
| 错误分级定义完整 | 内容搜索 | FATAL/ERROR/WARN/INFO 四级均有定义 |
| 无硬编码 DSN | 正则搜索 | 代码中无明文的 Sentry DSN（应使用环境变量） |
| 日志格式为 JSON | 配置检查 | pino/formatter 或等效配置为 JSON output |
| 有告警规则文档 | 文件系统检查 | `.harness/monitoring/` 下有 alert-rules 相关文件 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| systematic-debugging | 监控发现的异常模式 → 进入调试流程定位根因 |
| tdd | 错误处理逻辑的单元测试（确保错误被正确捕获和分类） |
| ci-cd-pipeline | CI 中验证 SDK 初始化正常，部署后冒烟检查监控 |
| security-audit | 日志中无敏感信息泄露是安全审计的一项 |
| ship-pipeline | 发布前检查 error budget 和错误率趋势 |
| caching-strategy | 缓存相关错误（miss/stale/ttl）有专门的监控指标 |
