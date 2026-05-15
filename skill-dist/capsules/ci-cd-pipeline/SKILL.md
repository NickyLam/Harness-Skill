---
id: cp-ci-cd-pipeline
name: "CI/CD Pipeline — 持续集成与部署流水线"
stage: ship
roles: [DevOps, Release Engineer]
pattern: Pipeline as Code
mandatory: false
depends: [tdd, verification, requesting-code-review]
version: "3.0.0"
min_lines: 50
description: "When the user mentions CI/CD, continuous integration, deployment pipeline, or needs to set up automated delivery pipelines, ALWAYS use this skill. Pipeline orchestration, environment management, and deployment automation."
---

# CI/CD Pipeline — 持续集成与部署流水线

> 将构建、测试、部署流程编码为可复现的 Pipeline as Code，实现从提交到上线的自动化闭环

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 项目初始化完成 | 需要建立自动化流水线 | 首次搭建 CI/CD 基础设施 |
| 新增环境（staging/prod） | 需要为新环境配置部署通道 | 多环境 pipeline 扩展 |
| 构建流程变更 | 工具链升级或构建步骤调整 | 更新 workflow 定义 |
| 部署策略调整 | 从 rolling 更新改为 blue-green | 修改 deployment stage |
| 安全合规要求 | 需要增加安全扫描 stage | 在 pipeline 中嵌入 SAST/DAST |

**不触发场景**：一次性手动部署脚本、本地开发环境配置、纯静态站点无构建需求。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 项目构建配置 | `package.json` scripts / `Makefile` | 必需 | pipeline 调用的构建命令 |
| 测试命令 | `npm test` / `pytest` 等已可用 | 必需 | CI 中运行的自动化测试 |
| 目标部署平台信息 | Vercel / AWS / Docker / K8s | 必需 | 决定 deployment stage 的具体实现 |
| 环境变量清单 | `.env.example` 或配置文档 | 必需 | 区分哪些变量需要在 CI 中注入 |
| 代码仓库托管平台 | GitHub / GitLab / Gitea | 必需 | 决定 workflow 文件格式（Actions / CI） |

## 核心原则

1. **Pipeline as Code** — 流水线定义与项目代码同仓库管理，版本可控
2. **环境一致性** — dev/staging/prod 使用同一套 pipeline，仅配置不同
3. **快速反馈** — CI 阶段 ≤ 5 分钟给出结果，不让开发者等待
4. **秘密不入库** — 所有密钥通过 Secrets Manager 管理，绝不提交到代码库

## 执行流程

### Step 1：选择 CI 平台并创建基础 Workflow

根据项目托管平台选择对应格式：

**GitHub Actions（推荐用于 GitHub 仓库）**：

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  test:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    name: Production Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-artifact
          path: dist/
          retention-days: 7
```

**GitLab CI（替代方案）**：

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - deploy

variables:
  NODE_IMAGE: node:20-alpine
  CACHE_KEY: "$CI_COMMIT_REF_SLUG-$CI_PIPELINE_ID"

lint:typecheck:
  image: $NODE_IMAGE
  stage: lint
  script:
    - npm ci
    - npm run lint
    - npx tsc --noEmit
  cache:
    key: npm-$CACHE_KEY
    paths:
      - node_modules/

test:unit:
  image: $NODE_IMAGE
  stage: test
  script:
    - npm ci
    - npm run test:coverage
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura.xml

build:production:
  image: $NODE_IMAGE
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 7 days
```

- [ ] 选择与仓库托管平台匹配的 CI 格式
- [ ] 配置并发控制（同一分支多次 push 取消旧的运行）
- [ ] 设置 job 依赖关系（lint → test → build 串行，同层级可并行）
- [ ] 缓存 node_modules 加速构建
- [ ] 上传 build artifact 供 deploy stage 使用

**输出**: `.github/workflows/ci.yml` 或 `.gitlab-ci.yml`

### Step 2：配置 CD 部署 Stage

根据部署目标添加自动化部署步骤：

```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options: [staging, production]

permissions:
  contents: read
  id-token: write

jobs:
  deploy-staging:
    name: Deploy to Staging
    if: github.event_name == 'push' || inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    needs: [build]  # 引用 CI pipeline 的 build job
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build-artifact
          path: dist/
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging..."
          # 具体部署命令取决于目标平台
          # Vercel: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
          # Docker: docker push && ssh deploy...
      - name: Smoke Test
        run: |
          curl -sf https://staging.example.com/api/health > /dev/null \
            || (echo "Smoke test failed" && exit 1)

  deploy-production:
    name: Deploy to Production
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    needs: [deploy-staging]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build-artifact
          path: dist/
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
          # 生产部署命令
      - name: Notify Deployment
        if: always()
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK }}" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"Deployment to production: ${{ job.status }}\"}"
```

- [ ] 区分 staging 和 production 环境
- [ ] production 部署设置 approval gate（人工审批）
- [ ] 部署后执行 smoke test 验证基本可用性
- [ ] 部署结果通知到 Slack/钉钉/邮件
- [ ] 使用 GitHub Environment Protection Rules 保护生产环境

**输出**: `.github/workflows/deploy.yml`（或合并在 ci.yml 中）

### Step 3：环境管理与配置差异化

管理多环境之间的配置差异：

```
项目根目录/
├── .env.example              # 所有变量的模板（提交到仓库）
├── .env.development          # 开发环境（不提交）
├── .env.staging              # 预发环境（不提交）
├── .env.production           # 生产环境（不提交）
└── .github/
    └── workflows/
        └── ci.yml            # 引用 GitHub Secrets
```

**GitHub Secrets 配置清单**：

| Secret 名称 | 用途 | 示例值 | 配置位置 |
|------------|------|--------|---------|
| `NODE_ENV` | 运行环境标识 | `production` | Settings → Secrets |
| `DATABASE_URL` | 数据库连接串 | `postgres://...` | Settings → Secrets |
| `JWT_SECRET` | JWT 签名密钥 | 随机字符串 | Settings → Secrets |
| `API_KEY_EXTERNAL` | 第三方服务密钥 | `sk-xxx` | Settings → Secrets |
| `CODECOV_TOKEN` | 覆盖率上报 token | `uuid` | Settings → Secrets |
| `SLACK_WEBHOOK` | 部署通知 webhook | `https://hooks.slack.com/...` | Settings → Secrets |

**禁止事项**：
- ❌ 绝不将 `.env.production` 提交到代码库
- ❌ 绝不在 workflow 文件中硬编码密钥
- ❌ 绝不使用 `echo $SECRET` 打印日志（会出现在 CI 日志中）

**输出**: `.env.example`、Secrets 配置文档

### Step 4：秘密管理策略实施

建立完整的秘密管理流程：

```yaml
# CI 中安全使用 secrets 的模式
- name: Run with secrets
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
  run: |
    # ✅ 正确：通过环境变量注入，不出现在日志中
    node dist/index.js

    # ❌ 错误：不要这样做
    # echo "DB is $DATABASE_URL"
    # curl -X POST -d "key=$API_KEY" https://example.com/log
```

- [ ] 所有敏感值通过平台 Secrets 功能管理
- [ ] `.gitignore` 包含 `.env*.local`, `.env.*.local`
- [ ] 添加 `pre-commit` hook 检测意外提交的密钥
- [ ] 定期轮换密钥（建议 90 天周期）
- [ ] 使用 `dependabot` 或 `renovatebot` 自动更新依赖减少漏洞面

**输出**: `.gitignore` 更新、pre-commit 配置

### Step 5：部署回滚机制配置

确保每次部署都可以快速回退：

```yaml
# .github/workflows/rollback.yml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        type: choice
        options: [staging, production]
      target_sha:
        description: 'Commit SHA to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.target_sha }}
      - name: Rebuild and redeploy target version
        run: |
          npm ci
          npm run build
          # 重新部署到指定环境的命令
      - name: Notify Rollback
        if: always()
        run: |
          echo "Rolled back ${{ inputs.environment }} to ${{ inputs.target_sha }}"
```

- [ ] 提供 manual trigger 的回滚 workflow
- [ ] 回滚操作有审计日志（who/when/why）
- [ ] 回滚后自动通知相关人员
- [ ] 回滚不影响数据库（数据库回滚单独处理）

**输出**: `.github/workflows/rollback.yml`

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| CI Workflow | `.github/workflows/ci.yml` | YAML | 构建+测试+质量检查流水线 |
| CD Workflow | `.github/workflows/deploy.yml` | YAML | 自动化部署流水线 |
| 回滚 Workflow | `.github/workflows/rollback.yml` | YAML | 手动触发的回滚流水线 |
| 环境变量模板 | `.env.example` | Env | 所需环境变量清单（不含真实值） |
| GitIgnore 更新 | `.gitignore` | Git | 排除敏感文件 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| CI 构建超时（>10 分钟） | 分析慢步骤，拆分 job 或优化缓存 | 增加缓存命中率，并行化独立任务 |
| Secret 泄露到 CI 日志 | 立即在平台上 rotate 该 secret | 清除日志，通知所有使用者更新 |
| 部署到 staging 成功但 prod 失败 | 对比两个环境的配置差异 | 通常为 secret 或域名配置问题 |
| flaky test 导致 CI 不稳定 | 标记 flaky test，隔离到单独 job 或修复 | 重试机制最多 2 次，超过则必须修复 |
| 依赖安装失败（registry 不可用） | 配置镜像源 fallback | 使用淘宝/npmjs 镜像作为备用 |
| 并发部署冲突（两人同时推 main） | 利用 concurrency 控制取消旧运行 | 只保留最新的 pipeline 运行 |

## 交接协议

```markdown
## CI/CD Pipeline 交接包

### 交付给 containerization（容器化阶段）
- CI build 阶段的产物路径：dist/
- 构建上下文和 Dockerfile 期望的目录结构
- 需要传递到容器的环境变量列表

### 交付给 ship-pipeline（发布阶段）
- 触发部署的条件：main 分支 push / tag push / manual
- 各环境的部署地址和凭证配置位置
- 回滚操作的入口和步骤

### 交付给 monitoring（运维阶段）
- 部署健康检查端点：/api/health
- 需要监控的部署指标：部署时长、成功率、回滚次数
```

**交接验证**：在 fork 或测试仓库上成功运行一次完整 pipeline（push → CI → deploy staging）。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| Workflow 文件存在 | 文件系统检查 | `.github/workflows/` 下有 .yml 文件 |
| YAML 语法正确 | `actionlint` / `gitlab-ci-lint` | 0 syntax errors |
| 无硬编码密钥 | 正则搜索 | 无 password/token/secret/key 的明文值 |
| `.env.example` 存在 | 文件系统检查 | 包含所有必需的环境变量名 |
| `.gitignore` 排除 env 文件 | 内容搜索 | 匹配 `.env*.local` / `.env.*.local` |
| 有回滚 workflow | 文件系统检查 | 存在 rollback 相关的 .yml 文件 |
| concurrency 已配置 | YAML 解析 | 有 `concurrency` 字段防止并行冲突 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 自动化部署检查清单

```
□ 代码已合并到目标分支（main/release）
□ 所有 CI 检查通过（lint / test / typecheck / build）
□ 代码审查已批准（至少 1 个 reviewer）
□ 无 blocking 的 security issues
□ CHANGELOG 已更新
□ 版本号已正确递增（Semver）
□ 数据库迁移脚本已准备就绪
□ Feature flag 已配置（灰度发布场景）
□ 回滚预案已确认可行
□ 相关人员已收到部署通知
```

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| tdd | CI 中自动运行测试套件，测试失败阻断 pipeline |
| verification | CI 中集成各类自动化检查门禁 |
| requesting-code-review | PR merge 前的审批 gate |
| containerization | CI 中构建 Docker 镜像，CD 中推送部署 |
| ship-pipeline | 发布流程的底层执行引擎 |
| security-audit | CI 中嵌入依赖扫描和安全检查 |
| performance-testing | CI 中集成性能基准测试 |
| gating | CI stage 作为质量门禁的自动化实现 |

---

## 增强内容（v3.1 升级）

### 完整 CD 部署 Workflow 示例

```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline

on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options: [staging, production]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    if: github.event.inputs.environment == 'staging' || startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to Staging
        run: |
          echo "Deploying image ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}"
          # kubectl apply / docker compose / vercel --prod here

  deploy-production:
    needs: [build-and-push, deploy-staging]
    if: github.event.inputs.environment == 'production' || startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Production
        run: |
          echo "🚀 Production deployment with blue-green strategy"
          # Implementation depends on target platform
```

### 三大部署策略对比与选择

| 策略 | 适用场景 | 优点 | 缺点 | 复杂度 |
|------|---------|------|------|-------|
| **Rolling Update** | 无状态应用、可水平扩展 | 零停机、资源利用率高 | 版本共存期间兼容性风险 | ⭐⭐ |
| **Blue-Green** | 关键业务、需要即时回滚 | 切换瞬间完成、回滚简单 | 双倍资源成本、数据迁移复杂 | ⭐⭐⭐ |
| **Canary** | 大流量、需渐进验证 | 风险可控、真实流量测试 | 监控要求高、配置复杂 | ⭐⭐⭐⭐ |

#### Rolling Update 配置示例（Kubernetes）

```yaml
# k8s/deployment.yaml (strategy 部分)
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 滚动更新时最多多启动1个pod
      maxUnavailable: 0   # 滚动更新时允许最多0个不可用（零停机）
```

#### Blue-Green 配置示例（Docker Compose + Nginx）

```yaml
# docker-compose.blue-green.yml
version: '3.8'
services:
  app-blue:
    image: myapp:${BLUE_TAG}
    networks: [internal]
  app-green:
    image: myapp:${GREEN_TAG}
    networks: [internal]
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on: [app-blue, app-green]
networks:
  internal:
```

### CI/CD 性能优化技巧

1. **缓存依赖**：`actions/setup-node@v4` 的 `cache: 'npm'` 可减少 70% 安装时间
2. **并行 Jobs**：无依赖的 Job 并行执行（lint 和 test 可同时跑）
3. **增量构建**：基于 git diff 只构建变更的模块（monorepo 场景）
4. **Docker Layer Caching**：`cache-from: type=gha` 利用 GitHub Actions 缓存
5. **选择性测试**：PR 只跑改动的相关测试（使用 `--testPathPattern`）

### 扩展失败处理（12个场景）

| 失败场景 | 检测方式 | 自动处理 | 人工介入 | 恢复命令 |
|---------|---------|---------|---------|----------|
| **Workflow 语法错误** | `actionlint` 检查 | 阻止提交 | 否（修复 YAML） | `npx actionlint fix .github/workflows/*.yml` |
| **Secrets 缺失** | Pipeline 启动时验证 | 暂停并提示 | 是（添加 Secrets） | Settings → Secrets → New secret |
| **构建超时（>30min）** | Job timeout-minutes | 终止 Job | 是（优化构建或拆分） | 在 job 级别添加 `timeout-minutes: 20` |
| **测试环境不一致** | Matrix strategy 失败 | 标记为 flaky | 是（检查容器版本） | 锁定工具版本号（如 node: 20.11.0 而非 20） |
| **部署凭证过期** | 401/403 错误 | 回滚到上一版本 | 是（刷新 token） | 重新生成 Deployment Key / Service Account |
| **DNS/网络问题** | 连接超时 | 自动重试 3 次 | 否（通常临时） | 检查 VPC/防火墙规则 |
| **磁盘空间不足** | df -h 检测 | 清理缓存 | 否（自动清理） | GitHub Actions 会自动清理 workspace |
| **并发部署冲突** | concurrency 组 | 取消旧运行 | 否（预期行为） | 已通过 `cancel-in-progress: true` 处理 |
| **镜像推送失败** | registry 返回 500 | 重试 + 退避 | 是（检查 registry 状态） | 检查 Docker Hub / GHCR 服务状态 |
| **数据库迁移失败** | migration exit code ≠ 0 | 回滚 deployment | 是（检查 SQL） | 手动执行回滚 SQL 后重试 |
| **健康检查未通过** | /health endpoint 200? | 自动回滚 | 是（检查日志） | `kubectl rollout undo deployment/appname` |
| **监控告警误报** | Prometheus alert | 静默 10min | 是（调整阈值） | 调整 alert rule 的 threshold |

### 增强产出物定义（6个）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| CI Workflow 文件 | `.github/workflows/{ci,cd,deploy}.yml` | YAML | 完整的流水线定义 | **必需** |
| 环境变量文档 | `.env.example` + `docs/env-vars.md` | Markdown+env | 所需环境变量及说明 | **必需** |
| Dockerfile（如适用） | `Dockerfile` + `docker-compose*.yml` | Dockerfile | 容器化构建配置 | 推荐 |
| 部署脚本 | `scripts/deploy-{env}.sh` | Shell | 特定环境的部署逻辑 | 推荐 |
| 监控 Dashboard | Grafana JSON / Datadog Dashboard | JSON | 部署健康度可视化 | 可选 |
| Runbook（运维手册） | `docs/runbook.md` | Markdown | 故障排查和操作指南 | **必需**（生产环境）|

### 与其他 Skill 的协作矩阵（增强版）

| 协作 Skill | 协作时机 | 输入→输出 | 数据流向 |
|-----------|---------|----------|---------|
| **tdd** | CI test stage | 测试命令 → 测试报告 | `npm run test` → JUnit XML |
| **verification-before-completion** | CI gate stage | 门禁检查结果 → 通过/失败 | Checklist → Exit code |
| **requesting-code-review** | PR merge gate | Review 状态 → 允许合并 | PR status checks |
| **containerization** | CI build stage | Dockerfile → 镜像 | Source → Registry |
| **ship-pipeline** | CD deploy stage | 镜像 → 运行实例 | Registry → K8s/VM |
| **security-audit** | CI security stage | 依赖列表 → 漏洞报告 | package-lock.json → SARIF |
| **performance-testing** | CI perf stage | 基准测试 → 性能指标 | k6 script → InfluxDB |
| **gating** | 整个 pipeline | 所有 Gate → 最终状态 | Gate results → Deploy decision |
| **qa** | Staging 验证 | 部署 URL → E2E 测试结果 | Staging URL → Test report |

## 下一步行动

CI/CD Pipeline 配置完成后：

1. **本地测试** → 使用 `act` 工具在本地模拟 GitHub Actions 运行
2. **推送到测试分支** → 触发真实的 CI 流程验证
3. **Staging 部署** → 先在预发布环境验证完整流程
4. **生产部署** → 确认所有门禁通过后执行
5. **设置监控** → 集成告警和仪表盘
6. **文档化** → 编写 Runbook 供团队参考
