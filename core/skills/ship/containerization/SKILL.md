---
id: cp-containerization
name: "Containerization — 容器化"
stage: ship
roles: [DevOps, Release Engineer]
pattern: Container Standardization
mandatory: false
depends: [cp-ci-cd-pipeline]
version: "3.0.0"
min_lines: 50
description: "When the user mentions docker, container, kubernetes, or needs to containerize applications, ALWAYS use this skill. Dockerfile optimization, image building, and K8s/Docker Compose orchestration."
---

# Containerization — 容器化

> 以标准化 Docker 容器封装应用及其全部依赖，确保「在我机器上能跑」在任何环境中都能一致运行

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 项目首次容器化 | 需要统一开发和部署环境 | 创建 Dockerfile 和 docker-compose |
| CI/CD 需要容器构建 | ci-cd-pipeline 要求镜像构建 | 确保 Dockerfile 可在 CI 中正确构建 |
| 部署目标为 K8s/ECS | 平台要求容器化交付 | 优化镜像以符合平台规范 |
| 开发环境标准化 | 新成员加入需要快速搭建环境 | docker-compose 一键启动全套服务 |
| 镜像安全加固 | 安全审计要求基础镜像更新 | 升级基础镜像并重新构建 |

**不触发场景**：纯静态站点（Netlify/Vercel 直接部署即可）、无需运行时的文档项目。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 应用构建产物 | `npm run build` 的 dist/ 目录 | 必需 | 容器要打包的内容 |
| 运行时依赖 | package.json dependencies | 必需 | 容器内安装的 npm 包 |
| 环境变量清单 | `.env.example` | 必需 | 容器启动需要的配置注入 |
| 端口和进程信息 | 应用监听端口、启动命令 | 必需 | Dockerfile EXPOSE/CMD 配置 |

## 核心原则

1. **最小镜像** — 只包含运行必需的文件，镜像越小越安全、越快
2. **不可变性** — 镜像构建后不再修改，变更通过重新构建新镜像实现
3. **非 root 运行** — 容器内进程不以 root 身份运行，减小攻击面
4. **构建可重现** — 给定相同的 Dockerfile 和上下文，构建结果应一致

## 执行流程

### Step 1：编写优化的 Dockerfile

遵循多阶段构建最佳实践：

```dockerfile
# ============================================
# Stage 1: Build — 构建阶段
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖定义文件，利用 Docker 层缓存
COPY package.json package-lock.json* ./

RUN npm ci --only=production=false

# 再复制源码进行构建
COPY . .

RUN npm run build

# ============================================
# Stage 2: Production — 运行阶段（最小镜像）
# ============================================
FROM node:20-alpine AS runner

# 安全：创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser

WORKDIR /app

# 设置必要的环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    # 禁用 npm 交互式行为
    npm_config_yes=true

# 从 builder 阶段复制构建产物
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# 切换到非 root 用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]
```

**Dockerfile 最佳实践 Checklist**：

- [ ] 使用多阶段构建（Build + Run 分离）
- [ ] 基础镜像使用 alpine 变体（体积缩小 5x 以上）
- [ ] `.dockerignore` 排除不必要的文件（node_modules, .git, dist 等）
- [ ] COPY 指令利用层缓存（先 copy package.json，再 copy 源码）
- [ ] 使用 `npm ci` 而非 `npm install`（确定性构建）
- [ ] 运行阶段使用非 root 用户
- [ ] 配置 HEALTHCHECK 指令
- [ ] EXPOSE 声明监听端口
- [ ] CMD 使用 exec 形式（数组语法，非 shell 形式）
- [ ] 不在镜像中硬编码密钥或敏感配置

**`.dockerignore` 配置**：

```
# 依赖（由 npm ci 安装）
node_modules
npm-debug.log*

# 构建产物（由多阶段构建处理）
dist
.next
build
.cache

# 版本控制
.git
.gitignore

# IDE 和工具
.vscode
.idea
*.swp
*.swo

# 环境和密钥
.env*
!.env.example

# 测试
coverage
__tests__
*.test.js
*.test.ts
*.spec.js
*.spec.ts

# Docker
Dockerfile
docker-compose*.yml
.dockerignore

# 文档
README.md
CHANGELOG.md
.harness

# OS
.DS_Store
Thumbs.db
```

**输出**: `Dockerfile`, `.dockerignore`

### Step 2：编写 docker-compose 开发环境配置

为本地开发提供一键启动的完整环境：

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: runner
    container_name: myapp-app
    ports:
      - '${PORT:-3000}:3000'
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379
      - PORT=3000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    # 资源限制
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.5'

  postgres:
    image: postgres:16-alpine
    container_name: myapp-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-apppass}
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-appuser}']
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    ports:
      - '${REDIS_PORT:-6379}:6379'
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 192M

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

**开发环境专用 override**：

```yaml
# docker-compose.override.yml（仅本地开发使用，不提交到仓库）
version: '3.8'

services:
  app:
    build:
      context: .
      target: builder       # 使用 builder 阶段（含 devDependencies）
    volumes:
      - .:/app              # 挂载源码实现热重载
      - /app/node_modules   # 防止宿主 node_modules 覆盖容器内的
    environment:
      - NODE_ENV=development
    command: npm run dev     # 开发模式启动
    ports:
      - '3000:3000'
      - '9229:9229'         # Node.js debugger port
```

- [ ] 应用服务 + 所需依赖服务（DB/Cache/Queue）齐全
- [ ] 使用命名 volumes 持久化数据
- [ ] 所有服务都有 healthcheck
- [ ] 配置了资源限制（memory/cpu limits）
- [ ] 服务间通过自定义网络通信
- [ ] 环境变量通过 `.env` 文件或 compose 环境注入
- [ ] `docker-compose.override.yml` 在 `.gitignore` 中

**输出**: `docker-compose.yml`

### Step 3：配置容器健康检查

确保容器的健康状态可被编排系统感知：

**应用层健康检查端点**：

```typescript
// src/routes/health.ts
import { Router } from 'express';
import { promisify } from 'util';

const router = Router();

router.get('/health', async (_req, res) => {
  const checks = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
    uptime: process.uptime(),
    checks: {
      database: 'unknown' as string,
      redis: 'unknown' as string,
    },
  };

  // 数据库连通性检查
  try {
    await db.$queryRaw`SELECT 1`;
    checks.checks.database = 'ok';
  } catch {
    checks.status = 'degraded';
    checks.checks.database = 'error';
  }

  // Redis 连通性检查
  try {
    await redis.ping();
    checks.checks.redis = 'ok';
  } catch {
    checks.status = 'degraded';
    checks.checks.redis = 'error';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// 就绪检查（区分于存活检查）
router.get('/ready', async (_req, res) => {
  // 仅检查自身是否准备好接受流量
  // 不检查下游依赖（那是 /health 的事）
  res.status(200).json({ status: 'ready' });
});
```

**健康检查策略对照**：

| 检查类型 | 用途 | 失败行为 | 检查内容 |
|---------|------|---------|---------|
| **Liveness** | 进程是否存活 | 重启容器 | 进程是否卡死 |
| **Readiness** | 是否能接收流量 | 从 LB 摘除 | 端口是否监听 |
| **Startup** | 启动是否完成 | 等待就绪 | 应用初始化是否完成 |

- [ ] `/health` 端点检查自身 + 所有关键依赖
- [ ] `/ready` 端点只检查自身状态（轻量快速）
- [ ] Dockerfile HEALTHCHECK 与应用端点配合使用
- [ ] K8s 部署时分别配置 livenessProbe 和 readinessProbe
- [ ] 健康检查间隔合理（30s 左右，不过频也不过稀）

**输出**: `src/routes/health.ts`（或集成到现有路由中）

### Step 4：设置资源限制与安全加固

配置容器的资源边界和安全约束：

```yaml
# docker-compose.yml 中的 resource limits（见上文 app service 的 deploy 部分）

# 如果使用 Kubernetes，额外的安全上下文：
# k8s/deployment.yaml（片段）
spec:
  containers:
    - name: app
      resources:
        requests:
          cpu: 250m
          memory: 256Mi
        limits:
          cpu: 1000m
          memory: 512Mi
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/.cache
  volumes:
    - name: tmp
      emptyDir: {}
    - name: cache
      emptyDir: {}
```

**安全加固 Checklist**：

- [ ] 容器以非 root 用户运行
- [ ] 文件系统只读（readOnlyRootFilesystem），仅挂载必要的可写目录
- [ ] 移除所有 Linux capabilities（drop ALL）
- [ ] 禁止特权提升（allowPrivilegeEscalation: false）
- [ ] 设置 memory 和 CPU limits（防止 OOM 影响宿主机）
- [ ] 不使用 `--privileged` 标志
- [ ] 不挂载敏感的宿主机目录（/var/run/docker.sock 等）
- [ ] 基础镜像定期更新（跟踪安全公告）

**输出**: `k8s/deployment.yaml`（如使用 K8s）或 docker-compose 更新

### Step 5：与 CI/CD Pipeline 集成

将容器构建和推送嵌入自动化流水线：

```yaml
# .github/workflows/docker.yml（追加到现有 CI）
jobs:
  build-and-push:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    needs: [test, build]  # 确保测试和构建都通过
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/myapp
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64  # 多架构支持
```

- [ ] 镜像构建在测试通过之后执行
- [ ] 使用 Buildx 支持多平台构建（amd64 + arm64）
- [ ] 镜像 tag 包含 git SHA（可追溯）
- [ ] 使用 GitHub Actions / GHA 缓存加速构建
- [ ] 推送到私有 Registry（GHCR / ECR / Harbor）
- [ ] 镜像扫描（Trivy / Grype）可在 push 前插入

**输出**: CI workflow 更新（Docker 构建步骤）

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| Dockerfile | `Dockerfile` | Dockerfile | 多阶段构建定义 |
| Ignore 文件 | `.dockerignore` | Text | 构建上下文排除规则 |
| Compose 文件 | `docker-compose.yml` | YAML | 本地开发 + 依赖服务编排 |
| Compose Override | `docker-compose.override.yml` | YAML | 开发环境热重载配置（不入库） |
| 健康检查路由 | `src/routes/health.ts` | TypeScript | /health 和 /ready 端点 |
| K8s 部署配置 | `k8s/deployment.yaml` | YAML | 生产环境容器编排（可选） |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 镜像构建失败（层缓存失效） | 清除缓存重新构建，检查 Dockerfile 指令顺序 | 优化 COPY 顺序以最大化缓存利用率 |
| 镜像体积过大（> 1GB） | 使用 `docker history` 分析各层大小，精简不必要的文件 | 移除调试工具、使用 alpine 基础镜像、多阶段裁剪 |
| 容器启动后立即退出 | 检查 CMD/ENTRYPOINT 是否正确，查看容器日志 | 确保前台进程运行，不要让主进程退出 |
| 健康检查一直失败 | 确认健康检查端点在容器内部可访问（不是 localhost 从外部访问） | 使用 docker exec 进入容器手动 curl 测试 |
| 时间不一致导致签名验证失败 | 容器内安装 tzdata 并设置正确的 TZ 环境变量 | 在 Dockerfile 中添加 `RUN apk add tzdata` |
| docker-compose 服务启动顺序问题 | 依赖服务尚未就绪就启动应用 | 使用 depends_on + condition: service_healthy |
| 权限问题（非 root 用户无法写文件） | 检查 volume 挂载权限和文件属主 | 使用 `--chown` 在 COPY 时设置正确的 owner |

## 交接协议

```markdown
## Containerization 交接包

### 交付给 ci-cd-pipeline（CI/CD 集成）
- Docker 构建命令和参数
- 镜像 Registry 地址和认证方式
- 镜像 tag 命名规范
- 多架构构建配置（amd64/arm64）

### 交付给 ship-pipeline（部署阶段）
- 生产环境的 docker-compose 或 K8s 配置
- 环境变量差异说明（dev vs staging vs prod）
- 滚动更新策略和健康检查配置
- 回滚时的镜像版本选择方法

### 交付给 monitoring（运维监控）
- 容器资源使用基线（CPU/Memory）
- 容器重启策略和期望副本数
- 健康检查端点地址
```

**交接验证**：接收方执行 `docker compose up -d` 后所有服务 healthy，且应用可通过端口正常访问。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| Dockerfile 存在 | 文件系统检查 | 项目根目录有 `Dockerfile` |
| 多阶段构建 | 内容搜索 | 出现 `AS` 关键词（≥ 2 个 stage） |
| 非 root 用户 | 内容搜索 | `adduser\|USER` 关键词出现 |
| .dockerignore 存在 | 文件系统检查 | `.dockerignore` 文件存在 |
| 健康检查配置 | 内容搜索 | `HEALTHCHECK\|healthcheck` 关键词出现 |
| docker-compose 存在 | 文件系统检查 | `docker-compose.yml` 文件存在 |
| 资源限制配置 | 内容搜索 | `limits\|deploy.resources` 关键词出现 |
| 镜像可构建 | `docker build -t test .` | 构建成功退出码 0 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## Dockerfile 反模式速查

```
❌ 最新标签: FROM node:latest          →  锁定版本: FROM node:20-alpine
❌ Root 运行: （无 USER 指令）          →  添加: USER appuser
❌ 单阶段构建: 直接 RUN npm install     →  多阶段: AS builder → AS runner
❌ COPY 全部: COPY . .                  →  利用缓存: 先 COPY package.json
❌ Shell CMD: CMD npm start             →  Exec CMD: CMD ["node", "dist/index.js"]
❌ 无健康检查: （无 HEALTHCHECK）        →  添加: HEALTHCHECK --interval=30s ...
❌ 大镜像: 基础镜像 > 800MB             →  使用 alpine: FROM node:20-alpine
❌ 密钥硬编码: ENV PASSWORD=xxx         →  使用: docker secrets 或环境变量
❌ 无 .dockerignore: node_modules 入镜像 →  添加: .dockerignore 排除
```

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| ci-cd-pipeline | CI 中构建镜像 → CD 中推送到 Registry → 部署拉取运行 |
| ship-pipeline | 容器化是发布的底层载体，镜像版本对应发布版本 |
| security-audit | 基础镜像漏洞扫描 + 容器安全配置审查 |
| error-monitoring | 容器内应用的错误采集 SDK 配置 |
| caching-strategy | 如 Redis 以容器形式部署，在此统一编排 |
| database-migration | 数据库容器化的 schema 初始化和迁移执行 |
| performance-testing | 容器性能基准测试（启动时间、内存占用、CPU） |
| gating | 容器构建和部署作为 Build/Ship Gate 的一部分 |

---

## 增强内容（v3.1 升级）

### 完整多阶段 Dockerfile 示例

```dockerfile
# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖定义文件，利用 Docker 缓存层
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# 再复制源代码并构建
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS runner

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# 从 builder 阶段复制构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
```

### docker-compose 完整示例（开发 + 生产）

```yaml
# docker-compose.yml (开发环境)
version: '3.8'

services:
  app:
    build:
      context: .
      target: runner
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    volumes:
      - ./src:/app/src          # 热重载：挂载源码
      - /app/node_modules      # 匿名卷：避免覆盖依赖
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### 容器安全加固清单

```bash
# 1. 使用非基础镜像的最小权限用户
RUN groupadd -r appuser && useradd -r -g appuser appuser
USER appuser

# 2. 只读文件系统（如果应用不需要写入）
VOLUME ["/tmp", "/app/logs"]

# 3. 移除不必要的包（Alpine）
RUN apk add --no-cache --virtual .build-deps ... && \
    apk del .build-deps

# 4. 禁用 suid/sgid 位
RUN find / -perm /6000 -type f -exec chmod a-s {} \; || true

# 5. 能力限制（Docker Compose）
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE  # 仅保留绑定端口的能力
```

### 扩展失败处理（10个场景）

| 失败场景 | 检测方式 | 解决方案 | 恢复命令 |
|---------|---------|---------|----------|
| **镜像构建失败** | `docker build` exit code ≠ 0 | 检查 Dockerfile 语法、依赖可用性 | `docker build --progress=plain` 查看详细日志 |
| **容器启动后立即退出** | `docker logs container_id` | 通常是因为入口点命令错误或缺少依赖 | `docker run -it <image> sh` 进入调试 |
| **端口冲突** | `bind: address already in use` | 停止占用端口的进程或修改映射 | `lsof -i :3000 | kill -9 <PID>` |
| **健康检查一直失败** | `docker inspect --format='{{.State.Health.Status}}'` | 检查健康检查命令和应用实际状态 | 调整 HEALTHCHECK 参数或修复应用 |
| **磁盘空间不足** | `Error: no space left on device` | 清理未使用的镜像和容器 | `docker system prune -af` |
| **网络不通** | 容器无法访问宿主机或其他容器 | 检查网络模式（bridge/host）和防火墙 | `docker network inspect <network_name>` |
| **权限问题** | `Permission denied` | 确保 USER 指令正确，文件权限匹配 | 在 Dockerfile 中使用 RUN chown |
| **内存溢出 OOM** | 容器被 kill（exit code 137） | 增加 memory limit 或优化应用 | `docker stats` 监控资源使用 |
| **数据持久化丢失** | 重启后数据消失 | 确保使用了 volume 或 bind mount | `docker volume ls` 检查卷状态 |
| **镜像过大（>1GB）** | `docker images` 显示大小大 | 多阶段构建、清理缓存、使用 alpine | `docker history <image>` 分析各层大小 |

### 增强产出物（6个）

| 产出物 | 路径模板 | 格式 | 说明 | 必要性 |
|-------|---------|------|------|-------|
| Dockerfile | `Dockerfile` | Dockerfile | 多阶段构建定义 | **必需** |
| docker-compose 配置 | `docker-compose.yml` / `docker-compose.{env}.yml` | YAML | 开发/生产环境编排 | **必需** |
| .dockerignore | `.dockerignore` | 文本 | 排除不需要的文件 | **必需** |
| 安全扫描报告 | `.harness/reports/container-security-YYYYMMDD.md` | Markdown | Trivy/Grype 扫描结果 | 推荐 |
| 镜像仓库凭证 | `docs/container-registry.md` | Markdown | Registry 认证信息（不含密码） | 推荐 |
| 运维手册 | `docs/container-runbook.md` | Markdown | 常见操作指南（启停、备份、升级） | **必需** |

### 性能优化建议

1. **镜像层缓存优化**：
   - 先复制 `package*.json`，再复制源代码
   - 将不常变化的依赖安装放在前面
   
2. **镜像体积优化**：
   - 使用 Alpine 基础镜像（比 Debian 小 5 倍）
   - 多阶段构建只复制运行时需要的文件
   - 使用 `npm ci --only=production` 减少依赖

3. **启动速度优化**：
   - 使用 `tini` 作为 PID 1 进程（正确处理僵尸进程）
   - 预编译 TypeScript（在构建阶段而非运行时）
   - 启用 Node.js 的 `--enable-source-maps=false`（生产环境）

4. **运行时资源优化**：
   - 设置合理的 memory/CPU limits
   - 使用 `.dockerignore` 排除 `node_modules`, `.git`, `dist`
   - 启用 Node.js 的 `--max-old-space-size=512` 限制堆内存

## 下一步行动

Containerization 配置完成后：

1. **本地验证** → `docker-compose up --build` 启动完整环境
2. **安全扫描** → `trivy image myapp:latest` 检查漏洞
3. **推送到 Registry** → `docker push registry/myapp:tag`
4. **CI 集成** → 在 ci-cd-pipeline 中添加构建和推送步骤
5. **监控配置** → 集成 Prometheus/Grafana 监控容器指标
