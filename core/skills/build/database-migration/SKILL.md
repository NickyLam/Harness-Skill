---
id: cp-database-migration
name: "Database Migration — 数据库迁移"
stage: build
roles: [Backend Developer, DBA]
pattern: Schema Evolution
mandatory: false
depends: [cp-spec-generator, tdd]
version: "3.0.0"
min_lines: 50
description: "When the user mentions migration, schema evolution, or needs to manage database schema changes, ALWAYS use this skill. TDD migration testing with rollback strategies."
---

# Database Migration — 数据库迁移

> 以 TDD 驱动的数据库 Schema 演进流程，确保每次变更可追溯、可回滚、向后兼容

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 数据模型变更 | spec 阶段定义了新的实体/字段/关系 | 新增表、修改列、添加索引等 |
| 重构现有表结构 | 优化查询性能需要调整 schema | 拆分大表、合并冗余字段、修改列类型 |
| 环境初始化 | 新开发人员加入或新环境部署 | 从零创建完整数据库 schema |
| 版本升级 | 跨版本部署需要增量迁移 | 从 v1.2 的 schema 升级到 v1.3 |
| 回滚操作 | 发布后发现问题需要回退数据库 | 执行 down 迁移恢复上一版 schema |

**不触发场景**：纯 CRUD 数据插入/更新/删除、临时数据修复脚本（不属于 schema 变更）。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| 数据模型设计文档 | `.harness/specs/` 下的 ER 图 / 数据字典 | 必需 | 明确目标 schema 结构 |
| TDD 测试框架配置 | 项目已配置测试运行器 | 必需 | 迁移也需要先写测试验证 |
| 当前数据库 schema 快照 | `db/schema.sql` 或 ORM model 文件 | 必需 | 了解当前状态才能编写差量迁移 |
| 数据库连接配置 | `.env` 或 config 文件中的 DB_URL | 必需 | 迁移执行需要可用的数据库连接 |

**前置检查**：如果项目尚未建立迁移目录结构，应先执行初始化：

```bash
# 创建标准迁移目录
mkdir -p db/migrations
echo "-- Migration files will be placed here" > db/migrations/.gitkeep
```

## 核心原则

1. **每个迁移必须可回滚** — up 和 down 成对出现，down 必须能完全撤销 up 的效果
2. **迁移是幂等的** — 同一迁移重复执行不应报错或产生副作用
3. **先写迁移测试再写迁移** — 与 TDD 一致，数据库变更也遵循 Red-Green-Refactor
4. **保持向后兼容** — 不破坏已有应用对当前 schema 的依赖

## 执行流程

### Step 1：分析变更范围

在编写任何迁移代码之前，完成以下分析：

- [ ] 对比目标 schema 与当前 schema，列出所有差异点
- [ ] 判断每个差异点的变更类型：ADD / MODIFY / DROP / RENAME / INDEX
- [ ] 评估变更的影响范围：哪些表/列被外部代码引用？
- [ ] 确定迁移顺序：外键约束要求父表先于子表变更
- [ ] 识别是否需要数据迁移（不仅是 schema 变更，还有数据转换）

**输出**: 变更分析文档 `.harness/migrations/analysis-{timestamp}.md`

### Step 2：编写迁移测试（RED）

为即将编写的迁移编写失败测试：

```typescript
// db/__tests__/migrations/add_user_avatar.test.ts
import { migrate, rollback } from '../migrate';

describe('Migration: add_user_avatar', () => {
  it('should add avatar_url column to users table', async () => {
    const columns = await getColumns('users');
    expect(columns).toContain('avatar_url');
  });

  it('should set default value for existing rows', async () => {
    const rows = await query('SELECT avatar_url FROM users LIMIT 1');
    expect(rows[0].avatar_url).toBe('https://default.avatar.png');
  });

  it('rollback should remove avatar_url column', async () => {
    await rollback();
    const columns = await getColumns('users');
    expect(columns).not.toContain('avatar_url');
  });
});
```

- [ ] 测试覆盖 up 操作的预期结果
- [ ] 测试覆盖 down 操作的回滚效果
- [ ] 测试覆盖边界情况（空表、大数据量表）
- [ ] 运行确认所有测试处于 RED 状态

**输出**: `db/__tests__/migrations/{name}.test.ts`

### Step 3：编写迁移文件（GREEN）

创建符合命名规范的迁移文件：

```
命名规范：YYYYMMDDHHMMSS_{snake_case_description}.sql
示例：   20260506143000_add_user_avatar_url.sql
```

```sql
-- Migration: add_user_avatar_url
-- Up: 添加用户头像字段

BEGIN;

ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(512)
  DEFAULT 'https://default.avatar.png'
  NOT NULL;

CREATE INDEX idx_users_avatar_url ON users(avatar_url);

COMMIT;
```

对应的 down 迁移：

```sql
-- Down: 移除用户头像字段

BEGIN;

DROP INDEX IF EXISTS idx_users_avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;

COMMIT;
```

- [ ] 文件名使用 UTC 时间戳前缀（精确到秒）
- [ ] up 和 down 在同一文件中用注释分隔，或分两个文件
- [ ] 使用事务包裹 DDL 操作（支持事务的数据库）
- [ ] 大表操作考虑 ONLINE DDL 或分批执行
- [ ] 运行迁移测试确认 GREEN

**输出**: `db/migrations/YYYYMMDDHHMMSS_{description}.sql`

### Step 4：向后兼容性检查

迁移完成后执行兼容性验证：

| 检查项 | 方法 | 通过标准 |
|-------|------|---------|
| 现有 SELECT 查询不受影响 | 运行全量单元/集成测试 | 所有测试通过 |
| 现有 INSERT 语句兼容 | 新列有合理默认值 | 无 NOT NULL violation |
| 外键关系完整 | 检查引用完整性 | 无 orphan 记录 |
| 应用层 ORM 映射正确 | 检查 model 定义与 schema 一致 | 无类型不匹配 |
| 索引不影响写入性能 | 对比迁移前后写入延迟 | 延迟增长 < 20% |

**输出**: 兼容性检查报告 `.harness/migrations/compat-{timestamp}.md`

### Step 5：迁移注册与基线更新

- [ ] 将新迁移文件登记到迁移追踪表中（如 `schema_migrations`）
- [ ] 更新 schema 快照文件 `db/schema.sql` 为最新状态
- [ ] 更新 ER 图 / 数据字典文档（如有）
- [ ] 在 CHANGELOG 中记录本次 schema 变更

**输出**: 更新后的 `db/schema.sql`、迁移追踪记录

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| 迁移文件 | `db/migrations/YYYYMMDDHHMMSS_{description}.{sql,ts}` | SQL / TypeScript | 包含 up + down 的完整迁移 |
| 迁移测试 | `db/__tests__/migrations/{name}.test.ts` | TypeScript | TDD 驱动的迁移验证测试 |
| 变更分析 | `.harness/migrations/analysis-{timestamp}.md` | Markdown | 变更范围和影响评估 |
| Schema 快照 | `db/schema.sql` | SQL | 当前数据库的完整 schema 导出 |
| 兼容性报告 | `.harness/migrations/compat-{timestamp}.md` | Markdown | 向后兼容性验证结果 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 迁移执行中途失败（事务内） | 数据库自动回滚未完成的操作 | 检查失败原因（如锁冲突、磁盘空间），修复后重新执行 |
| down 无法完全撤销 up 的效果 | 说明该迁移属于不可逆变更 | 必须在迁移文件头部标注 `-- IRREVERSIBLE:` 并记录原因，同时备份数据 |
| 大表 ALTER 超时 | 表数据量大导致锁等待超时 | 改用 pt-online-schema-change 或 gh-ost 等 online DDL 工具，分批执行 |
| 迁移顺序冲突（多个开发者并行提交） | 时间戳冲突导致执行顺序不确定 | 合并时重新生成时间戳，确保逻辑顺序正确 |
| 测试环境通过但生产环境失败 | 环境 schema 版本不一致 | 强制在生产环境执行 `db:migrate:status` 检查当前版本后再执行 |
| 数据迁移丢失精度 | 类型转换导致数据截断或舍入 | 先备份受影响数据，迁移完成后逐行校验关键字段 |

## 交接协议

```markdown
## Database Migration 交接包

### 交付给 tdd（后续功能开发）
- 最新 schema 快照路径：db/schema.sql
- 本次新增/修改的表和列：[users.avatar_url, ...]
- 需要更新的 ORM Model 列表：[User.ts, ...]

### 交付给 ci-cd-pipeline（部署阶段）
- 待执行的迁移文件列表：[20260506143000_*.sql, ...]
- 迁移执行命令：npm run db:migrate
- 回滚命令：npm run db:migrate:down
- 预计停机时间：<有/无>，预计 <N> 秒

### 交付给 security-audit（安全审查）
- 新增的权限/角色相关表（如有）
- 敏感字段变更（加密、脱敏策略）
```

**交接验证**：接收方确认 `db:migrate:status` 显示最新版本号，且全量测试通过。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| 迁移文件存在且命名合规 | 正则匹配 | 文件名匹配 `^\d{14}_[a-z_]+\.(sql\|ts)$` |
| up/down 成对出现 | 文件内容扫描 | 每个 up 有对应 down，无孤立迁移 |
| 迁移测试全部通过 | `npm run test -- db/` | 0 failures, 0 errors |
| 事务包裹 DDL | 关键字搜索 | `BEGIN` / `COMMIT` 成对出现 |
| 无硬编码环境值 | 内容扫描 | 无 IP 地址、绝对路径、特定用户名 |
| Schema 快照已更新 | 文件时间戳对比 | `db/schema.sql` 修改时间 ≥ 最新迁移文件 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| tdd | 迁移代码同样遵循 TDD：先写迁移测试 → 写迁移 → 验证 |
| spec-generator | 数据模型设计来自 spec 阶段的产出物 |
| ci-cd-pipeline | CI 流水线中自动执行 `db:migrate` 并验证 |
| security-audit | 涉及权限/敏感字段的迁移需经过安全审计 |
| systematic-debugging | 迁移执行失败的根因排查 |

## 向后兼容性检查清单速查

```
□ 新增列：是否有合理的 DEFAULT 值？
□ 修改列类型：是否向下兼容（如 varchar(50) → varchar(100)）？
□ 删除列：确认没有活跃代码引用该列
□ 重命名列：先 ADD 新列 → 迁移数据 → 确认无误 → 再 DROP 旧列
□ 添加外键：确认被引用表的记录已存在
□ 删除外键：确认无级联删除风险
□ 添加索引：评估对写入性能的影响
□ 大表操作：是否需要维护窗口或 online DDL？
```
