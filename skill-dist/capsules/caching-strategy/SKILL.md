---
id: cp-caching-strategy
name: "Caching Strategy — 缓存策略"
stage: build
roles: [Backend Developer, System Architect]
pattern: Cache Hierarchy
mandatory: false
depends: [cp-api-design, tdd]
version: "3.0.0"
min_lines: 50
description: "When the user mentions cache, performance optimization, or needs to implement multi-level caching, ALWAYS use this skill. Cache selection, invalidation strategy, and penetration/avalanche/breakdown protection."
---

# Caching Strategy — 缓存策略

> 设计多层缓存架构，平衡性能收益与数据一致性，防范穿透、击穿、雪崩三大经典问题

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| API 响应延迟超标 | 性能测试发现 P95 > SLA 阈值 | 引入缓存加速热点数据读取 |
| 数据库负载过高 | DB CPU/连接数接近上限 | 用缓存分担读压力 |
| 高频重复查询 | 同一数据在短时间内被多次请求 | 天然适合缓存的场景 |
| 外部 API 调用昂贵 | 第三方接口有速率限制或费用 | 缓存外部响应减少调用 |
| 缓存重构 | 现有缓存策略效果不佳 | 重新评估和设计缓存方案 |

**不触发场景**：写密集型操作（频繁 INSERT/UPDATE）、实时性要求极高的数据（股票行情）、数据集过大的全表扫描。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| API 热点分析 | performance-testing 的基线数据 | 必需 | 确定哪些端点和数据值得缓存 |
| 数据模型 | spec 阶段的实体关系定义 | 必需 | 了解数据的读写比例和更新频率 |
| 一致性要求 | 业务需求中的数据新鲜度要求 | 必需 | 决定 TTL 和失效策略 |
| 基础设施 | Redis / Memcached 集群可用性 | 必需 | 分布式缓存的后端存储 |

## 核心原则

1. **分层递进** — L1 进程内存 → L2 Redis → L3 CDN，逐层扩大容量和延迟
2. **Cache Aside** — 应用层管理缓存读写，保持简单可控
3. **保护后端** — 缓存的最终目的是减轻数据库/外部服务压力
4. **可观测** — 缓存命中率、穿透率、失效次数必须有监控

## 执行流程

### Step 1：缓存决策分析

用决策框架判断什么该缓存、什么不该缓存：

**缓存适用性评估矩阵**：

| 评估维度 | 适合缓存 | 不适合缓存 | 边界情况 |
|---------|---------|-----------|---------|
| **读/写比** | 读多写少 (> 10:1) | 写多读少 (< 3:1) | 读写均衡 (3:1 ~ 10:1) |
| **数据量** | 热点数据集 < 总量 20% | 几乎每次请求都不同 | 中等热度，部分命中 |
| **新鲜度容忍** | 秒级~分钟级延迟可接受 | 需要 real-time | 可接受短暂不一致 |
| **计算成本** | 查询耗时 > 10ms 或涉及 JOIN | 简单的主键查询 | 中等复杂度的聚合查询 |
| **访问模式** | 相同参数重复请求多 | 参数空间几乎无限 | 有局部热点 |

**典型缓存候选**：

| 数据类型 | 推荐层级 | TTL 建议 | 理由 |
|---------|---------|---------|------|
| 系统配置项 | L1 (进程内存) | 5-10 min | 低频变更、全局共享 |
| 用户 Session | L2 (Redis) | 15-30 min | 按用户隔离、中等频率 |
| 热点商品详情 | L2 + L3 (CDN) | 1-5 min | 高并发读取、低频更新 |
| 权限/角色数据 | L1 + L2 | 10-30 min | 影响认证性能的关键路径 |
| API 聚合结果 | L2 (Redis) | 30s-5 min | 计算成本高、可容忍短延迟 |
| 全局计数器 | L2 (Redis) | N/A (持久化) | 需要原子操作和持久化 |

**不应缓存的数据**：
- ❌ 金融交易记录（必须实时准确）
- ❌ 库存数量（需要强一致性）
- ❌ 用户的实时个性化推荐结果
- ❌ 验证码 / OTP（一次性使用）
- ❌ 超大数据集的全量结果（缓存成本高于收益）

**输出**: `.harness/cache/decision-matrix.md`

### Step 2：设计缓存层级架构

根据项目需求设计多层缓存：

```
请求进入
    ↓
┌─────────────────────────────────────────────┐
│  L1: 进程内缓存 (In-Memory Cache)            │
│  ├─ 工具: Node.js Map / lru-cache          │
│  ├─ 容量: ~100MB (受限于进程内存)           │
│  ├─ 延迟: < 0.1ms                          │
│  └─ 适用: 配置、权限、高频本地数据           │
│         ↓ MISS                              │
├─────────────────────────────────────────────┤
│  L2: 分布式缓存 (Redis Cluster)             │
│  ├─ 工具: Redis / ioredis                  │
│  ├─ 容量: GB 级 (取决于集群配置)            │
│  ├─ 延迟: 1-5ms                             │
│  └─ 适用: Session、热点数据、共享状态       │
│         ↓ MISS                              │
├─────────────────────────────────────────────┤
│  L3: CDN / 边缘缓存 (可选)                   │
│  ├─ 工具: Cloudflare / AWS CloudFront      │
│  ├─ 容量: 无限（边缘节点分布）              │
│  ├─ 延迟: 取决于用户位置                     │
│  └─ 适用: 静态资源、公开 API 响应            │
│         ↓ MISS                              │
├─────────────────────────────────────────────┤
│  Origin: 数据库 / 外部 API                   │
│  └─ 延迟: 10-100ms+                         │
└─────────────────────────────────────────────┘
```

**L1 进程内缓存实现**：

```typescript
// src/lib/cache/l1-cache.ts
import LRU from 'lru-cache';

interface CacheOptions<T> {
  ttl: number;           // 毫秒
  maxSize?: number;      // 最大条目数
  updateAgeOnGet?: boolean;
}

export function createLRUCache<T>(options: CacheOptions<T>) {
  return new LRU<string, T>({
    max: options.maxSize ?? 1000,
    ttl: options.ttl,
    allowStale: false,
    updateAgeOnGet: options.updateAgeOnGet ?? true,
  });
}

// 使用示例：系统配置缓存
const configCache = createLRUCache<Record<string, unknown>>({
  ttl: 5 * 60 * 1000,  // 5 分钟
  maxSize: 50,
});

export async function getConfig(key: string): Promise<unknown> {
  const cached = configCache.get(key);
  if (cached !== undefined) return cached;

  const value = await db.config.findUnique({ where: { key } });
  if (value) configCache.set(key, value);
  return value;
}
```

**L2 Redis 缓存实现**：

```typescript
// src/lib/cache/l2-cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

export async function getWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: {
    ttlSeconds: number;
    useNullCache?: boolean;  // 是否缓存空值防穿透
  },
): Promise<T | null> {
  // 1. 尝试从 Redis 获取
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  // 2. 缓存未命中，从数据源获取
  const data = await fetcher();

  // 3. 写入缓存
  if (data !== null || options.useNullCache) {
    await redis.setex(
      cacheKey,
      options.ttlSeconds,
      JSON.stringify(data),
    );
  }

  return data;
}

// 带分布式锁的缓存重建（防缓存击穿）
export async function getWithLock<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: { ttlSeconds: number; lockTimeoutMs: number },
): Promise<T | null> {
  const cached = await redis.get(cacheKey);
  if (cached !== null) return JSON.parse(cached) as T;

  const lockKey = `lock:${cacheKey}`;
  const locked = await redis.set(lockKey, '1', 'NX', 'PX', options.lockTimeoutMs);

  try {
    const data = await fetcher();
    if (data !== null) {
      await redis.setex(cacheKey, options.ttlSeconds, JSON.stringify(data));
    }
    return data;
  } finally {
    if (locked) await redis.del(lockKey);
  }
}
```

**输出**: `src/lib/cache/l1-cache.ts`, `src/lib/cache/l2-cache.ts`

### Step 3：设计缓存失效策略

针对不同场景选择合适的失效机制：

| 策略 | 实现方式 | 适用场景 | 优点 | 缺点 |
|------|---------|---------|------|------|
| **TTL 过期** | 设置 EX/PX | 大多数通用场景 | 简单可靠 | 过期内数据可能陈旧 |
| **主动失效** | 写操作时 DEL | 强一致性需求 | 数据即时一致 | 写放大 |
| **Tag 失效** | SET + Tag 集合 | 关联数据批量清理 | 精细控制 | 实现复杂度高 |
| **Lazy 过期** | 访问时检查 | 低频访问数据 | 无额外写入 | 可能返回过期数据 |
| **版本号** | key 带 version 后缀 | 需要批量切换的场景 | 原子切换 | key 数量增长 |

**Tag 失效实现**：

```typescript
// 基于 Tag 的关联缓存失效
async function setWithTag(
  key: string,
  value: unknown,
  tags: string[],
  ttlSeconds: number,
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.setex(key, ttlSeconds, JSON.stringify(value));

  for (const tag of tags) {
    pipeline.sadd(`tag:${tag}`, key);
    pipeline.expire(`tag:${tag}`, ttlSeconds + 60);  // tag 比 data 多活 60s
  }

  await pipeline.exec();
}

async function invalidateByTag(tag: string): Promise<number> {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length === 0) return 0;

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.del(key);
  }
  pipeline.del(`tag:${tag}`);
  await pipeline.exec();

  return keys.length;
}

// 使用示例
await setWithTag('user:42:profile', profileData, ['user:42'], 300);
await setWithTag('user:42:orders', ordersData, ['user:42'], 120);

// 用户更新资料时一键清除所有相关缓存
await invalidateByTag('user:42');  // 清除 profile + orders
```

**输出**: `src/lib/cache/invalidation.ts`

### Step 4：防护三大经典问题

实现缓存穿透、击穿、雪崩的防护措施：

#### 缓存穿透（Cache Penetration）

**问题**：查询不存在的数据，每次都打到数据库

**解决方案**：布隆过滤器 + 空值缓存

```typescript
import BloomFilter from 'bloom-filters';

const validIdFilter = BloomFilter.create(1000000, 0.01);  // 100万容量，1%误判率

export async function getUserById(id: string) {
  // 1. 布隆过滤器快速判断 ID 可能不存在
  if (!validIdFilter.has(id)) {
    return null;  // 一定不存在，直接返回
  }

  // 2. 正常缓存查询流程
  return getWithCache(`user:${id}`, () => db.users.findUnique({ where: { id } }), {
    ttlSeconds: 300,
    useNullCache: true,  // 缓存空值，TTL 较短（如 60s）
  });
}
```

#### 缓存击穿（Cache Breakdown）

**问题**：热点 Key 过期瞬间，大量并发请求同时打到数据库

**解决方案**：分布式锁 + 热点 Key 永不过期（异步刷新）

```typescript
// 热点 Key 永不过期 + 逻辑过期
export async function getHotData(key: string) {
  const raw = await redis.get(key);
  if (!raw) return null;

  const { data, expireAt } = JSON.parse(raw);

  // 逻辑上未过期，直接返回
  if (Date.now() < expireAt) return data;

  // 逻辑上已过期，尝试获取锁重建
  const lockKey = `rebuild:${key}`;
  const locked = await redis.set(lockKey, '1', 'NX', 'PX', 5000);

  if (locked) {
    // 获取锁成功，异步重建
    rebuildInBackground(key).finally(() => redis.del(lockKey));
  }

  // 无论是否获取锁成功，都返回旧数据（允许短期不一致）
  return data;
}
```

#### 缓存雪崩（Cache Avalanche）

**问题**：大量 Key 同时过期，导致数据库瞬时流量激增

**解决方案**：TTL 随机抖动 + 多级缓存兜底

```typescript
function jitteredTTL(baseTTLSeconds: number): number {
  // TTL 在 baseTTL 的 ±20% 范围内随机波动
  const jitter = baseTTLSeconds * 0.2;
  return Math.floor(baseTTLSeconds + (Math.random() * 2 - 1) * jitter);
}

// 使用
const ttl = jitteredTTL(300);  // 基础 5 分钟，实际在 240s~360s 之间
await redis.setex(key, ttl, JSON.stringify(data));
```

**输出**: `src/lib/cache/protection.ts`

### Step 5：缓存监控指标埋点

建立缓存健康度监控体系：

| 指标名称 | 计算公式 | 告警阈值 | 说明 |
|---------|---------|---------|------|
| **命中率 (Hit Rate)** | hits / (hits + misses) × 100% | < 80% WARNING | 核心指标，越接近 100% 越好 |
| **穿透率 (Penetration Rate)** | misses that returned null / total misses | > 5% WARNING | 可能存在穿透攻击或无效查询 |
| **平均获取延迟** | 缓存读取耗时 (P50/P95/P99) | P95 > 5ms WARNING | 缓存变慢可能是网络/内存问题 |
| **内存使用率** | used_memory / maxmemory × 100% | > 85% CRITICAL | 接近上限可能导致 eviction |
| **eviction/s** | 每秒被驱逐的 key 数量 | > 100/s WARNING | TTL 设置过短或内存不足 |
| **重建 QPS** | 每秒缓存重建请求数 | > 基线 3× WARNING | 可能存在击穿或大量失效 |

**输出**: `src/lib/cache/metrics.ts`

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| L1 缓存模块 | `src/lib/cache/l1-cache.ts` | TypeScript | 进程内 LRU 缓存实现 |
| L2 缓存模块 | `src/lib/cache/l2-cache.ts` | TypeScript | Redis 分布式缓存封装 |
| 失效策略模块 | `src/lib/cache/invalidation.ts` | TypeScript | TTL / Tag / 主动失效 |
| 防护模块 | `src/lib/cache/protection.ts` | TypeScript | 穿透/击穿/雪崩防护 |
| 监控指标 | `src/lib/cache/metrics.ts` | TypeScript | 缓存健康度指标埋点 |
| 决策矩阵 | `.harness/cache/decision-matrix.md` | Markdown | 缓存选型分析记录 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| Redis 连接断开 | 自动降级为直连数据库（cache aside 模式的天然优势） | 返回旧数据或空数据，不等缓存恢复 |
| 缓存数据与数据库不一致 | 设置合理 TTL 作为最终安全网 | 对于关键数据提供手动刷新接口 |
| LRU 缓存内存泄漏 | 设置 maxSize 上限并监控进程内存 | 使用 weak-ref 或定期清理 |
| 热点 Key 导致单节点压力集中 | 将大 Key 拆分为多个小 Key（sharding） | Redis Cluster 自动分片 |
| 缓存预热慢导致启动初期延迟高 | 实现异步预热任务，启动时后台填充 | 启动期间允许较高的 miss rate |
| 序列化/反序列化性能瓶颈 | 使用 MessagePack 替代 JSON（体积更小、速度更快） | 对比 benchmark 选择最优序列化方案 |

## 交接协议

```markdown
## Caching Strategy 交接包

### 交付给 performance-testing（性能验证）
- 缓存前后的延迟对比基线
- 需要重点验证的缓存命中场景列表
- 缓存命中率的目标值

### 交付给 error-monitoring（监控集成）
- 缓存相关指标的 key 名称和标签
- 告警阈值建议值
- 缓存故障时的降级策略说明

### 交付给 ci-cd-pipeline（部署检查）
- Redis 连接配置的环境变量清单
- 部署后的缓存预热命令（如有）
- 缓存版本/配置变更时的灰度策略
```

**交接验证**：接收方执行一次缓存读写操作，确认命中率和延迟在预期范围内。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 缓存模块存在 | 文件系统检查 | `src/lib/cache/` 目录下有 .ts 文件 |
| 有 TTL 配置 | 内容搜索 | setex / expiry / ttl 关键词出现 |
| 有穿透防护 | 内容搜索 | bloom / null cache / filter 关键词出现 |
| 有击穿防护 | 内容搜索 | lock / mutex / rebuild 关键词出现 |
| 有雪崩防护 | 内容搜索 | jitter / random / spread 关键词出现 |
| 有监控指标 | 内容搜索 | hit_rate / metrics / counter 关键词出现 |
| 决策文档存在 | 文件系统检查 | `.harness/cache/decision-matrix.md` 存在 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| api-design | 缓存策略影响 API 的响应头设计（Cache-Control / ETag） |
| tdd | 缓存逻辑（命中/未命中/失效）需要单元测试覆盖 |
| performance-testing | 缓存效果的性能基准测试和回归检测 |
| error-monitoring | 缓存命中率、穿透率等指标纳入监控告警 |
| database-migration | 缓存表结构的迁移需要注意与 Redis key 的一致性 |
| ci-cd-pipeline | 部署流程中包含缓存预热和健康检查步骤 |
