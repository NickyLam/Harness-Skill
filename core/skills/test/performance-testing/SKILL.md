---
id: cp-performance-testing
name: "Performance Testing — 性能测试"
stage: test
roles: [Performance Engineer, SRE]
pattern: Load Simulation
mandatory: false
depends: [tdd, e2e-qa]
version: "3.0.0"
min_lines: 50
description: "When the user mentions performance test, load test, benchmark, or needs to verify system performance under load, ALWAYS use this skill. Load injection, bottleneck analysis, and SLA verification."
---

# Performance Testing — 性能测试

> 通过模拟真实负载场景建立性能基线，检测回归退化，保障系统在高并发下仍满足 SLA

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 核心功能开发完成 | tdd + e2e-qa 通过后 | 建立首次性能基线 |
| 性能相关重构 | 数据库查询优化、缓存引入、算法改进 | 对比优化前后指标 |
| 发布前验证 | ship 阶段的发布检查 | 确认无性能回归 |
| 容量规划 | 预期流量增长评估 | 确认系统承载上限 |
| 定期巡检 | 周期性性能健康检查 | 发现渐进式性能退化 |

**不触发场景**：纯 UI 样式调整、文档更新、配置微调等不影响服务端性能的变更。

**与 e2e-qa 的区别**：e2e-qa 关注功能正确性和用户路径完整性；performance-testing 关注吞吐量、延迟、资源利用率等非功能性指标。两者互补但不互相替代。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 可用的测试环境 | 与生产配置相近的 staging 环境 | 必需 | 性能数据要有参考价值 |
| 核心接口列表 | api-design 阶段的 OpenAPI 规范 | 必需 | 确定要压测的目标端点 |
| 性能 SLA 定义 | 项目需求或运营指标 | 必需 | 判定通过的基准线 |
| 基础设施监控 | Prometheus/Grafana/DataDog | 推荐 | 辅助分析瓶颈 |

## 核心原则

1. **先建基线再比较** — 首次运行记录基准数据，后续对比检测回归
2. **模拟真实负载** — 测试场景应反映实际用户行为模式，不是简单的均匀压力
3. **关注 P95/P99** — 平均值掩盖尾部延迟问题，长尾才是用户体验的关键
4. **可重复可对比** — 相同条件下结果应一致，环境差异要记录并归一化

## 执行流程

### Step 1：定义性能指标与基线

确定本次性能测试要衡量的核心指标：

| 指标类别 | 指标名称 | 单位 | 说明 | 告警阈值示例 |
|---------|---------|------|------|-------------|
| **延迟** | P50 响应时间 | ms | 中位数用户感受 | < 200ms |
| **延迟** | P95 响应时间 | ms | 95% 用户的最差体验 | < 500ms |
| **延迟** | P99 响应时间 | ms | 1% 用户的极端情况 | < 1000ms |
| **吞吐** | QPS（每秒请求数） | req/s | 系统最大处理能力 | > 1000 req/s |
| **吞吐** | RPS（每秒渲染数） | page/s | 页面渲染能力（前端） | > 50 page/s |
| **错误率** | HTTP 错误率 | % | 非 2xx 响应占比 | < 0.1% |
| **资源** | CPU 使用率 | % | 服务器计算资源消耗 | < 80%（稳态） |
| **资源** | 内存使用 | MB | 内存占用及泄漏检测 | 无持续增长趋势 |
| **资源** | 数据库连接数 | 个 | 连接池饱和程度 | < 最大连接数的 80% |

**基线记录格式**：

```markdown
## Performance Baseline — YYYY-MM-DD

### 环境信息
- 环境: staging
- 机器配置: 4C8G
- Node.js 版本: v20.x
- 数据库: PostgreSQL 15 (2C4G)
- 并发工具: k6 v0.47

### 基线数据
| 端点 | P50(ms) | P95(ms) | P99(ms) | QPS(max) | 错误率 |
|------|---------|---------|---------|----------|-------|
| GET /api/health | 5 | 12 | 25 | 5000 | 0% |
| GET /api/users | 45 | 120 | 280 | 800 | 0% |
| POST /api/orders | 180 | 450 | 900 | 200 | 0.01% |
| POST /api/auth/login | 90 | 220 | 500 | 600 | 0% |
```

**输出**: `benchmarks/baseline-YYYYMMDD.md`

### Step 2：选择性能测试工具

根据项目特点选择合适的工具：

| 工具 | 语言 | 优势 | 劣势 | 适用场景 |
|------|------|------|------|---------|
| **k6** | JavaScript | 云原生、图表丰富、脚本易写 | 扩展性有限 | API 压测首选 |
| **Artillery** | JavaScript/YAML | 声明式场景定义、报告美观 | 社区较小 | 复杂用户旅程模拟 |
| **wrk** | Lua | 极致轻量、高并发能力 | 学习曲线陡峭 | 简单 HTTP 基准测试 |
| **Locust** | Python | 分布式压测、自定义逻辑强 | 依赖 Python 环境 | 复杂业务逻辑压测 |
| **JMeter** | Java | 功能全面、插件丰富 | 重量级、资源消耗大 | 企业级综合测试 |

**推荐默认选择**：k6（JavaScript 生态无缝衔接，报告开箱即用）

**输出**: 工具选型决策记录

### Step 3：编写性能测试脚本

以 k6 为例编写标准的性能测试场景：

```javascript
// benchmarks/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 预热：逐步爬升到 10 并发
    { duration: '1m', target: 50 },    // 正常负载：50 并发用户
    { duration: '2m', target: 100 },   // 峰值负载：100 并发
    { duration: '1m', target: 200 },   // 压力测试：200 并发（超出正常）
    { duration: '30s', target: 0 },    // 恢复：观察恢复速度
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // P95 延迟 < 500ms
    http_req_failed: ['rate<0.01'],     // 错误率 < 1%
    errors: ['rate<0.05'],              // 自定义错误率 < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 场景 A：健康检查（高频轻量）
  let healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health latency < 50ms': (r) => r.timings.duration < 50,
  });
  errorRate.add(healthRes.status !== 200);
  apiLatency.add(healthRes.timings.duration);

  // 场景 B：用户列表查询（中等复杂度）
  let usersRes = http.get(`${BASE_URL}/api/users?page=1&size=20`);
  check(usersRes, {
    'users status 200': (r) => r.status === 200,
    'users has data': (r) => JSON.parse(r.body).data.length > 0,
  });
  errorRate.add(usersRes.status !== 200);
  apiLatency.add(usersRes.timings.duration);

  // 模拟用户思考时间
  sleep(Math.random() * 2 + 1);  // 1-3 秒随机间隔
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify({
      p50: data.metrics.http_req_duration.values['p(50)'],
      p95: data.metrics.http_req_duration.values['p(95)'],
      p99: data.metrics.http_req_duration.values['p(99)'],
      qps: data.metrics.http_reqs.count / data.metrics.http_req_duration.values['count'],
      error_rate: data.metrics.http_req_failed.rate,
    }, null, 2),
  };
}
```

- [ ] 至少覆盖 3 个核心端点（高/中/低频各一个）
- [ ] 设置合理的 ramp-up/ramp-down 阶段（避免冷启动冲击）
- [ ] 定义 thresholds 作为自动通过/失败判定
- [ ] 包含自定义业务指标（不仅限于 HTTP 层面）
- [ ] 思考时间分布反映真实用户行为

**输出**: `benchmarks/load-test.{js,yml,py}`

### Step 4：执行多场景负载测试

按以下场景矩阵依次执行：

| 场景 | 并发数 | 持续时间 | 目的 | 通过标准 |
|------|-------|---------|------|---------|
| **基线测试** | 10 并发 | 2 min | 建立基准数据 | 记录所有指标 |
| **正常负载** | 预估日活 10% | 5 min | 验证日常表现 | P95 < SLA 阈值 |
| **峰值负载** | 预估峰值 QPS × 1.5 | 5 min | 验证抗压能力 | 无错误率激增 |
| **压力测试** | 逐步增加到崩溃 | 10 min | 寻找系统极限 | 记录最大容量 |
| **浸泡测试** | 正常负载 | 30+ min | 检测内存泄漏 | 资源无持续增长 |
| **恢复测试** | 峰值后降到 0 | 观察 5 min | 验证自愈能力 | 60s 内恢复正常 |

```bash
# 执行 k6 性能测试
k6 run benchmarks/load-test.js \
  --out json=results/raw.json \
  --summary-export=results/summary.json \
  --console-output=results/console.log

# 生成 HTML 报告
k6 run benchmarks/load-test.js --summary-export=results/report.html
```

- [ ] 每个场景独立执行，结果分别保存
- [ ] 压力测试在隔离环境进行（不影响 staging 服务）
- [ ] 记录测试期间的服务器资源快照
- [ ] 测试结果包含原始数据和聚合摘要

**输出**: `results/{scenario}-{timestamp}.{json,html}`

### Step 5：性能回归分析与报告

对比当前结果与历史基线，生成回归分析报告：

```markdown
## Performance Report — YYYY-MM-DD HH:MM

### 回归检测结果
| 端点 | 指标 | 基线值 | 当前值 | 变化 | 状态 |
|------|------|-------|-------|------|------|
| GET /api/users | P95 | 120ms | 145ms | +20.8% | ⚠️ WARNING |
| GET /api/users | QPS | 800 | 750 | -6.2% | ⚠️ WARNING |
| POST /api/orders | P99 | 900ms | 880ms | -2.2% | ✅ OK |

### 瓶颈分析
- 🔴 **数据库**: orders 查询缺少索引（EXPLAIN ANALYZE 显示 Seq Scan）
- 🟡 **内存**: Node.js 堆内存在压力测试期间达到 85%
- 🟢 **网络**: 带宽充足，无瓶颈

### 建议
1. 为 orders.user_id 添加联合索引（预期提升 40%）
2. 调整 Node.js --max-old-space-size 或排查内存泄漏
3. 下次发布前重新跑基线确认优化效果
```

**回归判断标准**：
- 🟢 **OK**：变化幅度 < 10%，在正常波动范围内
- ⚠️ **WARNING**：变化幅度 10%-30%，需关注但不必阻塞发布
- 🔴 **REGRESSION**：变化幅度 > 30% 或突破 SLA 阈值，必须调查原因

**输出**: `.harness/reports/performance-YYYYMMDD.md`

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 性能基线 | `benchmarks/baseline-YYYYMMDD.md` | Markdown | 历史基准数据记录 |
| 测试脚本 | `benchmarks/load-test.{js,py,yml}` | JS/Python/YAML | 可重复执行的测试场景 |
| 原始结果 | `results/raw-{timestamp}.json` | JSON | 每次执行的详细数据 |
| 汇总报告 | `results/summary-{timestamp}.json` | JSON | 聚合后的关键指标 |
| 回归分析 | `.harness/reports/performance-YYYYMMDD.md` | Markdown | 对比分析和建议 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 测试环境与生产差异过大导致数据失真 | 尽量缩小配置差距或在生产 off-peak 时段测试 | 至少保证 CPU/内存/数据库规格比例一致 |
| P95 突破阈值但 P50 正常 | 分析长尾请求的共性特征 | 可能是特定参数组合导致的慢查询，针对性优化 |
| 压力测试直接把测试环境打崩 | 降低初始并发量，缩短 ramp-up 时间 | 先找到系统的安全水位，再逐步逼近极限 |
| 结果不可重复（两次运行差异 >15%） | 检查环境干扰因素（其他进程、网络抖动、GC） | 固化测试环境，排除噪声源 |
| 发现严重性能回归（>50%） | 阻断发布，进入 systematic-debugging | 定位回归引入的具体 commit（可通过 git bisect） |
| 工具本身成为瓶颈（生成器资源耗尽） | 使用分布式压测模式（k6 分布式 / Locust master-worker） | 增加生成器节点数量 |

## 交接协议

```markdown
## Performance Testing 交接包

### 交付给 systematic-debugging（发现性能问题时）
- 回归端点和指标详情
- 瓶颈定位证据（火焰图/慢查询日志/资源截图）
- 基线对比数据

### 交付给 ci-cd-pipeline（集成到 CI）
- 轻量级冒烟性能测试脚本（短耗时版本）
- thresholds 配置（用于 CI 自动判定）
- 基线数据文件路径

### 交付给 ship-pipeline（发布决策）
- 性能回归结论：PASS / WARNING / BLOCK
- 如 BLOCK：具体的阻塞原因和建议修复方案
- 下次建议重新测试的时间点
```

**交接验证**：接收方能独立复现测试并获得一致的结论性结果。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 基线数据已建立 | 文件系统检查 | `benchmarks/baseline-*.md` 存在 |
| 测试脚本可执行 | 运行测试 | `k6 run benchmarks/load-test.js` 能正常结束 |
| 覆盖核心端点 | 脚本内容分析 | 至少包含 GET/POST 各 1 个核心端点 |
| 有 thresholds 定义 | 脚本内容搜索 | options.thresholds 非空 |
| 报告已生成 | 文件系统检查 | `results/` 下有最近的 summary 文件 |
| 回归分析已完成 | 文件系统检查 | `.harness/reports/performance-*.md` 存在且有结论 |
| P95/P99 指标已记录 | 报告内容搜索 | 包含 p(95)/p(99) 数据 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| e2e-qa | 功能正确性验证在前，性能测试在后，两者构成完整质量保障 |
| tdd | 单元级性能敏感代码（算法、循环）可在 TDD 阶段加入 benchmark |
| systematic-debugging | 性能回归的根因定位和修复 |
| ci-cd-pipeline | 轻量级性能冒烟测试集成到 CI pipeline |
| caching-strategy | 缓存引入前后的性能对比验证 |
| ship-pipeline | 发布前的性能回归门禁 |
| gating | 性能测试作为 Test/Ship Gate 的一部分 |
| containerization | 容器化环境的性能基准测试 |

---

## 增强内容（v3.1 升级）

### 完整 k6 负载测试脚本示例

```javascript
// benchmarks/load-test-api.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 预热：逐步增加到 10 用户
    { duration: '1m', target: 50 },    // 负载：50 用户持续 1 分钟
    { duration: '20s', target: 100 },  // 压力：峰值 100 用户
    { duration: '20s', target: 0 },    // 恢复：降到 0
  ],
  thresholds: {
    // 关键性能指标阈值
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // P95 < 500ms, P99 < 1s
    http_req_failed: ['rate<0.05'],                      // 错误率 < 5%
    errors: ['rate<0.01'],                                // 业务错误率 < 1%
  },
  ext: {
    loadimpact: {
      distribution: 'uniform',  // 负载分布：均匀/加权
      phases: 4,
    }
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 测试 1：健康检查端点
  let healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  });

  // 测试 2：核心 API - 用户列表（GET）
  let usersRes = http.get(`${BASE_URL}/api/users`);
  errorRate.add(usersRes.status !== 200);
  requestDuration.add(usersRes.timings.duration);

  check(usersRes, {
    'users list status 200': (r) => r.status === 200,
    'users list has data': (r) => JSON.parse(r.body).length > 0,
    'users response time p95 < 300ms': (r) => r.timings.duration < 300,
  });

  // 测试 3：创建用户（POST）
  const payload = JSON.stringify({
    name: `LoadTestUser_${__VU}`,
    email: `loadtest${__VU}@example.com`,
  });

  let createRes = http.post(`${BASE_URL}/api/users`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(createRes, {
    'create user status 201': (r) => r.status === 201,
    'create user has id': (r) => JSON.parse(r.body).id !== undefined,
  });

  sleep(1);  // 思考时间：模拟真实用户操作间隔
}

// 测试结束后输出摘要
export function handleSummary(data) {
  return {
    'Total Requests': data.metrics.http_reqs.values.count,
    'P95 Latency (ms)': data.metrics.http_req_duration.values['p(95)'],
    'P99 Latency (ms)': data.metrics.http_req_duration.values['p(99)'],
    'Error Rate (%)': (data.metrics.http_req_failed.rate * 100).toFixed(2),
    'Throughput (req/s)': (data.metrics.throughput.value).toFixed(2),
  };
}
```

### 运行命令和集成

```bash
# 安装 k6（如果尚未安装）
# macOS:
brew install k6

# Linux:
sudo apt-get install k6

# Windows:
choco install k6

# 运行负载测试
k6 run benchmarks/load-test-api.js \
  --out json=results/perf-test.json \
  --summary-export=results/summary.json \
  --web-dashboard

# CI 集成示例（在 GitHub Actions 中）
# k6 run --quiet --summary-export=results/summary.json --thresholds --out json=results/k6.json
```

### 性能基准对比模板

```markdown
## 性能回归分析报告

**日期**: 2026-05-06
**基线版本**: v1.0.0
**当前版本**: v1.1.0
**环境**: Staging (4核CPU / 8GB RAM)

### 核心指标对比

| 指标 | 基线值 | 当前值 | 变化 | 判定 | 风险等级 |
|------|--------|--------|------|------|---------|
| **P95 响应时间** | 320ms | 385ms | +20.3% | ⚠️ WARNING | 🟡 中 |
| **P99 响应时间** | 850ms | 1020ms | +20.0% | ⚠️ WARNING | 🟡 中 |
| **错误率** | 0.8% | 1.2% | +50.0% | ❌ FAIL | 🔴 高 |
| **吞吐量** | 150 req/s | 142 req/s | -5.3% | ✅ PASS | 🟢 低 |
| **CPU 使用率** | 45% | 62% | +37.8% | ⚠️ WARNING | 🟡 中 |
| **内存使用** | 280MB | 340MB | +21.4% | ⚠️ WARNING | 🟡 中 |

### 结论

- [ ] **无回归**: 所有指标在可接受范围内 → 可以发布
- [x] **轻微回归**: 个别指标超出阈值但影响有限 → 需要监控
- [ ] **严重回归**: 多个关键指标显著恶化 → 必须修复后才能发布

### 建议

1. **立即修复**: 错误率上升 50%，需要排查新增的失败请求
2. **持续观察**: P95/P99 延迟增加 ~20%，如果用户体验未受明显影响可以接受
3. **后续优化**: CPU/内存使用增加，建议下个迭代进行性能调优
```

### 扩展失败处理（10个场景）

| 失败场景 | 检测方式 | 解决方案 | 恢复命令 |
|---------|---------|---------|----------|
| **测试环境不可达** | 连接超时错误 | 检查目标服务是否启动 | `curl ${BASE_URL}/api/health` 验证可达性 |
| **脚本语法错误** | k6 解析失败 | 检查 JavaScript 语法 | `k6 run --dry-run script.js` 验证语法 |
| **阈值设置不合理** | 所有测试都 FAIL | 调整 thresholds 到合理范围 | 参考历史数据重新设定 baseline |
| **负载过高导致服务崩溃** | 大量 5xx 错误 | 降低虚拟用户数或延长 ramp-up 时间 | 将 `target: 100` 改为 `target: 50` |
| **测试数据不足** | 结果统计不显著 | 延长测试持续时间 | 将 `duration: '1m'` 改为 `'5m'` |
| **网络延迟干扰** | 响应时间波动大 | 在同网络环境下运行 baseline 和当前测试 | 使用 Docker 统一测试环境 |
| **认证/授权问题** | 401/403 错误 | 检查测试凭证是否过期 | 更新 `.env` 中的测试 token |
| **数据库连接池耗尽** | 连接超时错误 | 增加连接池大小或限制并发数 | 调整 `POOL_SIZE` 环境变量 |
| **缓存穿透** | 后端负载异常高 | 预热缓存或添加缓存保护 | 在测试前调用预热接口 |
| **资源竞争（CI 环境）** | 结果不稳定 | 使用独占的测试环境或错峰运行 | 在 CI 中使用 service container isolation |

### 增强产出物（6个）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| 测试脚本 | `benchmarks/load-test-{feature}.js` | JavaScript (k6) | 完整的负载测试定义 | **必需** |
| 原始结果数据 | `results/perf-test-{timestamp}.json` | JSON | k6 输出的详细指标数据 | **必需** |
| 执行摘要 | `results/summary-{timestamp}.json` | JSON | 关键指标的汇总统计 | **必需** |
| 回归分析报告 | `.harness/reports/performance-regression-YYYYMMDD.md` | Markdown | 与基线的对比分析和结论 | **必需** |
| 基线数据 | `benchmarks/baseline-{version}.md` | Markdown | 版本化的性能基线记录 | **必需** |
| 性能趋势图 | `docs/performance-trends.html` | HTML/Grafana | 历史性能数据的可视化趋势 | 推荐 |

### 性能测试 Checklist（执行前必检）

#### 环境准备
- [ ] 目标服务正在运行且可访问
- [ ] 数据库已预置测试数据（足够支撑负载测试）
- [ ] 缓存已预热（避免冷启动影响）
- [ ] 监控工具已就绪（Prometheus/Grafana 或 APM）

#### 脚本验证
- [ ] 脚本语法正确（`k6 run --dry-run` 通过）
- [ ] 阈值设置合理（基于历史基线数据）
- [ ] 覆盖了核心业务路径（Happy Path + 关键边界）
- [ ] 虚拟用户数和 ramp-up 策略符合预期

#### 执行过程
- [ ] 测试期间无人为干预（不重启服务、不改配置）
- [ ] 测试完成后收集完整的日志和指标
- [ ] 异常情况已记录（如突发错误、超时等）

## 下一步行动

Performance Testing 完成后：

1. **分析结果** → 查看报告，识别性能瓶颈
2. **定位根因** → 结合 systematic-debugging 分析慢请求原因
3. **制定优化方案** → 确定优先级（数据库查询？算法复杂度？N+1问题？）
4. **实施优化** → 代码修改并验证改进效果
5. **更新基线** → 如果优化成功，将新数据设为新基线
6. **持续监控** → 在生产环境部署性能告警
