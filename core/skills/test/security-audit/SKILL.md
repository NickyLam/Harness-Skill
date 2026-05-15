---
id: cp-security-audit
name: "Security Audit — 安全审计"
stage: test
roles: [Security Engineer, Security Champion]
pattern: Defense in Depth
mandatory: false
depends: [tdd, code-simplification]
version: "3.0.0"
min_lines: 50
description: "When the user mentions security audit, vulnerability scan, or needs to check for security issues, ALWAYS use this skill. OWASP Top 10 coverage with CVE scanning and SAST/DAST."
---

# Security Audit — 安全审计

> 基于 OWASP Top 10 和纵深防御理念，系统化地扫描代码、依赖和配置层面的安全隐患

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 发布前安全检查 | ship 阶段的强制门禁 | 确保上线代码无已知安全问题 |
| 新增第三方依赖 | package.json / requirements.txt 变更 | 扫描新引入依赖的漏洞 |
| 认证授权模块变更 | 涉及 auth / session / permission 的代码 | 重点审查身份认证安全性 |
| 定期安全巡检 | 月度/季度例行审计 | 发现渐进式引入的安全债务 |
| 安全事件响应 | 收到漏洞报告或入侵告警 | 应急性的深度安全审查 |

**不触发场景**：纯 CSS 样式调整、文案修改、不涉及数据处理的前端展示变更。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 完整源码 | 项目 `src/` 目录 | 必需 | 审计对象是全部可执行代码 |
| 依赖清单 | `package.json` / `pom.xml` / `requirements.txt` | 必需 | 依赖漏洞扫描的基础 |
| 环境配置 | `.env.example` / 配置文件模板 | 必需 | 检查是否存在硬编码密钥 |
| API 接口定义 | `api/openapi.yaml`（如有） | 推荐 | 审查认证鉴权覆盖完整性 |

## 核心原则

1. **纵深防御** — 单一安全措施不够，多层防护互相兜底
2. **最小权限** — 默认拒绝，只开放必要的最小权限
3. **安全左移** — 越早发现安全问题，修复成本越低
4. **可审计可追溯** — 所有安全相关操作留痕，异常可回溯

## 执行流程

### Step 1：OWASP Top 10 逐项检查

按照 OWASP Top 10 (2021) 分类逐项审查代码：

| # | 风险类别 | 检查要点 | 扫描方法 | 常见问题 |
|---|---------|---------|---------|---------|
| A01 | **Broken Access Control** | 权限边界、水平/垂直越权 | Code Review + E2E 测试 | 缺少权限校验、IDOR 漏洞 |
| A02 | **Cryptographic Failures** | 传输加密、存储加密、密钥管理 | 配置扫描 + 代码搜索 | 明文传输、弱加密算法 |
| A03 | **Injection** | SQL/NoSQL/Command/LDAP 注入 | SAST 工具 + 代码审查 | 字符串拼接构造查询 |
| A04 | **Insecure Design | 架构层面安全缺陷 | 架构 Review | 缺乏威胁建模、业务逻辑漏洞 |
| A05 | **Security Misconfiguration | 默认配置、错误配置 | 配置文件扫描 | Debug 模式开启、目录列表 |
| A06 | **Vulnerable Components** | 过时依赖的已知漏洞 | Dependabot / SCA 工具 | 未及时更新的框架/库 |
| A07 | **Auth Failures | 弱密码、暴力破解、Session 管理 | Auth 模块审查 | 无速率限制、Token 不过期 |
| A08 | **Software/Data Integrity** | CI/CD 供应链攻击 | Pipeline 审核 | 不安全的依赖源、无签名验证 |
| A09 | **Logging/Monitoring Failure | 日志缺失、告警不足 | 日志审计 | 无登录失败日志、无异常告警 |
| A10 | **Server-Side Request Forgery** | SSRF 用户可控 URL | URL 参数追踪 | 用户输入直接发起请求 |

**检查执行方式**：

```bash
# 1. 使用自动化 SAST 工具初步扫描
npm audit --audit-level=moderate
# 或
pip audit

# 2. 搜索常见安全反模式
grep -rn "eval(" src/ --include="*.ts" --include="*.js"
grep -rn "innerHTML" src/ --include="*.ts" --include="*.tsx"
grep -rn "password.*=.*['\"]" src/ --include="*.ts" --include="*.js"
grep -rn "hardcoded\|secret\|apikey\|api_key" src/ --include="*.env*"

# 3. 检查 SQL 拼接（高危）
grep -rn "query(`\|query('\|query(\"src/db/" --include="*.ts"
# 应使用 parameterized query 而非字符串拼接
```

- [ ] 10 个类别逐一打分（Critical/High/Medium/Low/Info/Pass）
- [ ] 每个发现的问题记录具体文件路径和行号
- [ ] 区分「确认漏洞」和「潜在风险」
- [ ] 高危以上问题必须有复现步骤

**输出**: OWASP 检查清单 `.harness/audits/owasp-checklist-YYYYMMDD.md`

### Step 2：依赖漏洞扫描

系统性扫描项目依赖的安全状况：

```bash
# Node.js 项目
npm audit --json > audits/npm-audit.json

# Python 项目
pip audit --format=json > audits/pip-audit.json

# Java 项目（Maven）
mvn org.owasp:dependency-check-maven:check

# 检查 Dependabot alerts（GitHub）
gh api repos/{owner}/{repo}/dependabot/alerts \
  --jq '.[] | {state: .state, severity: .security_advisory.severity, package: .dependency.package.name}'
```

**漏洞分级处理策略**：

| 严重等级 | CVSS 范围 | 处理时限 | 处理方式 |
|---------|----------|---------|---------|
| **Critical** | 9.0-10.0 | 24 小时内 | 立即修复或禁用受影响功能 |
| **High** | 7.0-8.9 | 7 天内 | 升级依赖或添加 workaround |
| **Medium** | 4.0-6.9 | 30 天内 | 纳入下一个 sprint 修复 |
| **Low** | 0.1-3.9 | 下个版本 | 低优先级跟踪 |

- [ ] 全部依赖已扫描
- [ ] Critical/High 漏洞数为 0（否则阻断发布）
- [ ] Medium 漏洞有明确的修复计划
- [ ] 开启 Dependabot / Renovatebot 自动更新

**输出**: `audits/dependency-vulnerabilities-YYYYMMDD.json`

### Step 3：敏感信息检测

扫描代码库中的敏感信息泄露：

```bash
# 使用 truffleHog 或 gitleaks 检测 git 历史中的密钥
gitleaks detect --source . -v --report-format json -o audits/gitleaks-report.json

# 检测当前代码中的硬编码敏感信息
patterns=(
  "AKIA[A-Z0-9]{16}"           # AWS Access Key
  "sk-[a-fA-F0-9]{32}"         # OpenAI API Key
  "ghp_[a-zA-Z0-9]{36}"        # GitHub PAT
  "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"  # 邮箱（可选）
  "password\s*=\s*['\"][^'\"]+['\"]"
  "secret\s*=\s*['\"][^'\"]+['\"]"
  "api_key\s*=\s*['\"][^'\"]+['\"]"
  "token\s*=\s*['\"][^'\"]+['\"]"
)

for pattern in "${patterns[@]}"; do
  echo "=== Scanning: $pattern ==="
  grep -rn --include="*.ts" --include="*.js" --include="*.py" --include="*.yml" "$pattern" src/ 2>/dev/null || echo "Clean"
done
```

**检测范围**：

| 类别 | 检测目标 | 风险等级 |
|------|---------|---------|
| 云服务商密钥 | AWS / GCP / Azure credentials | 🔴 Critical |
| 第三方 API Key | OpenAI / Stripe / SendGrid keys | 🔴 Critical |
| 版本控制 Token | GitHub / GitLab PAT | 🔴 Critical |
| 数据库凭证 | Connection strings / passwords | 🔴 High |
| JWT Secret | HMAC shared secrets | 🟡 Medium |
| 私钥文件 | PEM / key files | 🔴 Critical |
| IP 白名单 | 内网 IP 硬编码 | 🟡 Medium |

- [ ] git 历史扫描完成（含已删除文件）
- [ ] 当前代码树扫描完成
- [ ] 发现的敏感信息已 rotate（轮换）并从历史中清除
- [ ] pre-commit hook 已配置防止未来泄露

**输出**: `audits/secrets-scan-YYYYMMDD.json`

### Step 4：认证授权专项审查

深入审查身份认证和权限控制系统：

**JWT 安全配置检查**：

```typescript
// ✅ 安全的 JWT 配置
const jwtConfig = {
  algorithm: 'RS256',           // 非对称签名（优于 HS256）
  expiresIn: '15m',             // 短有效期
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
  keyId: true,                  // 支持密钥轮换
};

// ❌ 不安全的配置
const badConfig = {
  algorithm: 'none',            // 禁用签名验证！
  expiresIn: '365d',            // 有效期过长
  secret: 'hardcoded-secret',   // 硬编码密钥
};
```

**权限边界检查清单**：

- [ ] 每个需要认证的端点都有 middleware 保护
- [ ] 资源操作做了归属校验（用户只能操作自己的数据）
- [ ] 管理员操作有二次确认或操作日志
- [ ] 敏感操作（删除/批量操作）有 CSRF 保护
- [ ] 登录有暴力破解防护（速率限制 / CAPTCHA / 账户锁定）
- [ ] Password 使用 bcrypt/scrypt/argon2 哈希（ salt ≥ 12 rounds）
- [ ] Session/Token 有合理的过期时间和刷新机制
- [ ] Logout 使 token 立即失效（token blacklist 或 short TTL）

**输出**: `.harness/audits/auth-review-YYYYMMDD.md`

### Step 5：生成安全审计报告

汇总所有检查结果，输出标准化安全报告：

```markdown
# Security Audit Report

**审计日期**: YYYY-MM-DD
**审计范围**: Full Codebase
**审计工具**: npm audit + gitleaks + Manual Review
**审计人员**: AI Security Auditor

## 总体评级: B+ （可发布，有中等风险待修复）

## 发现摘要
| 严重度 | 数量 | 状态 |
|-------|------|------|
| 🔴 Critical | 0 | - |
| 🟠 High | 1 | 待修复 |
| 🟡 Medium | 3 | 跟踪中 |
| 🔵 Low | 5 | 已知悉 |

## 详细发现

### [HIGH-001] SQL Injection Risk in Search API
- **位置**: `src/api/search.ts:42`
- **描述**: 用户输入直接拼接到 SQL 查询中
- **复现**: `search?q='; DROP TABLE users; --`
- **修复建议**: 使用 parameterized query
- **CVSS**: 8.6 (High)

### [MED-001] Missing Rate Limit on Login Endpoint
- **位置**: `src/middleware/auth.ts`
- **描述**: 登录接口无速率限制，可被暴力破解
- **修复建议**: 添加 rate-limit middleware（100次/15分钟）
- **CVSS**: 5.3 (Medium)

## 修复计划
| Issue ID | 优先级 | 计划修复版本 | 负责人 |
|---------|-------|-------------|-------|
| HIGH-001 | P0 | v1.2.1 (hotfix) | - |
| MED-001 | P1 | v1.3.0 | - |
```

**报告分发**：
- Critical/High 发现 → 立即通知项目负责人
- Medium 发现 → 纳入 backlog 跟踪
- 完整报告 → 存档至 `.harness/audits/`

**输出**: `.harness/audits/security-report-YYYYMMDD.md`

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| OWASP 检查清单 | `.harness/audits/owasp-checklist-YYYYMMDD.md` | Markdown | 10 大类逐项审查记录 |
| 依赖漏洞报告 | `audits/dependency-vulnerabilities-YYYYMMDD.json` | JSON | SCA 工具扫描结果 |
| 敏感信息扫描 | `audits/secrets-scan-YYYYMMDD.json` | JSON | gitleaks/truffleHog 扫描结果 |
| 认证授权审查 | `.harness/audits/auth-review-YYYYMMDD.md` | Markdown | Auth 模块深度审查 |
| 安全审计总报告 | `.harness/audits/security-report-YYYYMMDD.md` | Markdown | 汇总报告 + 修复计划 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 发现 Critical 漏洞 | 阻断发布，立即修复 | 24 小时内修复或禁用受影响功能路径 |
| High 漏洞但无法立即修复 | 评估风险后决定是否带 workaround 发布 | Workaround 必须有效降低风险等级 |
| 依赖存在不可升级的漏洞 | 寻找替代库或添加补偿控制 | 如果无法替换，在报告中标注接受风险的理由 |
| 误报过多导致噪音 | 调整扫描规则，添加白名单 | 白名单必须逐条审核并有理由 |
| git 历史中发现已删除的密钥 | 立即 rotate 该密钥并使用 BFG Repo Cleaner 清除历史 | 通知所有使用该密钥的服务更换 |
| 审计工具本身有漏洞 | 使用容器化/沙箱化方式运行扫描工具 | 不信任工具输出的可执行部分 |

## 交接协议

```markdown
## Security Audit 交接包

### 交付给 ship-pipeline（发布决策）
- 安全总体评级：A/B/C/D/F
- 阻塞发布的 issue 列表（如有）：[HIGH-001, ...]
- 非阻塞 issue 列表及建议修复版本
- 安全签署意见：APPROVE / APPROVE_WITH_COMMENTS / REJECT

### 交付给 systematic-debugging（安全 Bug 修复）
- 具体漏洞的复现步骤
- 修复建议和安全编码规范引用
- 修复后的回归验证方法

### 交付给 ci-cd-pipeline（持续安全）
- 集成到 CI 的安全扫描命令
- 阻断阈值配置（如：Critical=阻断, High=警告）
- Dependabot/Renovatebot 配置状态
```

**交接验证**：接收方确认 Critical 数量为 0 且 High 问题已接受或有明确修复计划。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 安全报告存在 | 文件系统检查 | `.harness/audits/security-report-*.md` 存在 |
| Critical 漏洞数 = 0 | 报告内容解析 | Critical 级别发现数量为 0 |
| 依赖扫描已执行 | 文件系统检查 | `audits/dependency-vulnerabilities-*.json` 存在 |
| 敏感信息扫描已执行 | 文件系统检查 | `audits/secrets-scan-*.json` 存在 |
| OWASP 10 类全覆盖 | 检查清单统计 | 10 个类别均有 Pass 或有据的评分 |
| 高危问题有修复方案 | 报告内容解析 | 每个 High 以上 issue 有 fix suggestion |
| 无硬编码密钥残留 | gitleaks 扫描 | 当前代码树扫描 clean |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 常见安全编码规范速查

```
□ 用户输入永远不可信 → 全部做 validate + sanitize
□ SQL 查询必须参数化 → 禁止字符串拼接
□ 密码必须哈希存储 → bcrypt(cost≥12) / argon2id
□ JWT 使用 RS256 + 短 TTL → 禁止 alg:none
□ 敏感操作需二次确认 → 删除/转账/权限变更
□ 错误信息不泄露内部细节 → 返回通用错误给客户端
□ Cookie 设置 HttpOnly + Secure + SameSite
□ 重定向目标必须白名单校验 → 防 Open Redirect
□ 文件上传限制类型+大小+存储隔离 → 防 RCE
□ API 限流防滥用 → 特别注意公开端点
```

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| tdd | 安全相关的 bug 修复遵循 TDD 流程 |
| code-simplification | 简化代码过程中不引入新的安全风险 |
| ci-cd-pipeline | 安全扫描集成到 CI pipeline，阻断有问题代码 |
| ship-pipeline | 发布前的安全门禁，安全不通过则不能发布 |
| systematic-debugging | 安全漏洞的根因定位和修复验证 |
| database-migration | 涉及权限表结构的迁移需额外安全审查 |
