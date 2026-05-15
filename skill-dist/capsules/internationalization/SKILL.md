---
id: cp-internationalization
name: "Internationalization — 国际化（i18n）"
stage: build
roles: [Frontend Developer, Localization Engineer]
pattern: i18n Extraction
mandatory: false
depends: [cp-spec-generator, tdd]
version: "3.0.0"
min_lines: 50
description: "When the user mentions i18n, internationalization, localization, or needs multi-language support, ALWAYS use this skill. Text extraction, locale architecture, and RTL support."
---

# Internationalization — 国际化（i18n）

> 从硬编码字符串到可翻译 key 的系统性提取流程，支持多语言、复数形式、RTL 和本地化格式

## 触发条件

| 触发场景 | 触发方式 | 说明 |
|---------|---------|------|
| 项目需要支持多语言 | 产品需求明确要求国际化 | 首次建立 i18n 基础设施 |
| 新增 UI 页面/组件 | 新代码中包含用户可见文本 | 新增文本必须走 i18n 流程 |
| 翻译文件更新 | 收到新的翻译内容 | 合并翻译并验证完整性 |
| 支持新语言 | 新增目标语言（如日语/阿拉伯语） | 添加新 locale 并处理特殊规则 |
| 复数/日期格式需求 | 发现硬编码的复数或日期格式 | 统一使用 i18n 格式化工具 |

**不触发场景**：开发者注释、console.log 调试信息、纯 CSS content 属性中的装饰性符号。

## 前置依赖

| 依赖项 | 来源 | 必需性 | 说明 |
|-------|------|-------|------|
| UI 组件清单 | `src/components/` 目录结构 | 必需 | 确定需要国际化的范围 |
| 目标语言列表 | 产品需求文档 | 必需 | 确定首批支持的语言 |
| 项目框架类型 | React / Vue / Native 等 | 必需 | 决定 i18n 库的选择 |
| 设计稿中的文本 | Figma / 设计文档 | 推荐 | 提取所有可见文案作为初始 key |

## 核心原则

1. **默认提取，不默认跳过** — 所有用户可见的文本都应走 i18n，无例外
2. **Key 语义化** — 使用有意义的 key 名而非 auto-generated id
3. **Fallback 链** — 缺失翻译时优雅降级到默认语言，不显示裸 key
4. **编译时安全** — 尽可能在构建阶段发现缺失的 key 或未使用的 key

## 执行流程

### Step 1：选择 i18n 架构方案

根据项目规模和需求选择合适的技术方案：

| 方案 | 适用规模 | 库推荐 | 优点 | 缺点 |
|------|---------|--------|------|------|
| **Simple Key-Value** | 小型项目 (< 50 个 key) | i18next / vue-i18n | 简单直接、学习成本低 | 无复数/插值的高级能力 |
| **ICU MessageFormat** | 中大型项目 | react-intl / formatjs ICU | 复数/性别/选择格式原生支持 | 语法稍复杂 |
| **自定义 Schema** | 特殊需求项目 | 自建 | 完全可控 | 维护成本高 |

**推荐默认方案**：i18next + react-i18next（React 生态最成熟，插件丰富）

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)              // 按需加载翻译文件
  .use(LanguageDetector)     // 自动检测浏览器语言
  .use(initReactI18next)     // React 绑定
  init({
    fallbackLng: 'en',       // 默认回退语言
    supportedLngs: ['en', 'zh-CN', 'ja', 'ko', 'ar'],
    ns: ['common', 'errors', 'validation'],  // 命名空间
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,    // React 已做 XSS 防护
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
```

**输出**: `src/i18n/config.ts`

### Step 2：文本提取与 Key 规范设计

建立统一的 key 命名和组织规范：

**Key 命名规范**：

```
{namespace}.{component}.{element}.{variant}

示例：
common.nav.home           → 导航栏首页
common.nav.settings       → 导航栏设置
auth.login.title          → 登录页标题
auth.login.submit         → 登录提交按钮
auth.login.forgotPassword → 忘记密码链接
errors.network.unreachable → 网络不可达错误
validation.email.invalid   → 邮箱格式校验失败
users.list.empty          → 用户列表为空提示
users.list.loading        → 加载状态文字
```

**组织原则**：
- 按 feature/domain 划分 namespace，不按文件路径
- 同一语义的文本在整个应用中使用同一个 key（如「确认」= `common.actions.confirm`）
- key 使用 dot-notation 分层，不超过 4 层
- key 全部小写，单词间用下划线或 camelCase 连接

**输出**: `.harness/i18n/key-conventions.md`

### Step 3：批量提取硬编码字符串

系统性地将源码中的硬编码字符串替换为 i18n 调用：

**替换前后对比**：

```tsx
// ❌ 替换前：硬编码字符串
function Header() {
  return (
    <header>
      <h1>用户管理系统</h1>
      <button>登出</button>
      <span>欢迎回来，管理员</span>
    </header>
  );
}

// ✅ 替换后：使用 i18n hook
function Header() {
  const { t } = useTranslation('common');
  const user = useCurrentUser();

  return (
    <header>
      <h1>{t('header.title')}</h1>
      <button>{t('actions.logout')}</button>
      <span>{t('header.welcome', { name: user.name })}</span>
    </header>
  );
}
```

**提取流程**：

1. **扫描阶段**：使用 `i18next-parser` 或 `formatjs-cli` 自动提取所有字面量字符串
   ```bash
   npx i18next-parser 'src/**/*.{ts,tsx}' -o locales/$LOCALE/
   ```

2. **分类阶段**：将提取出的字符串分配到正确的 namespace 和 key
   - 用户可见文本 → 对应 feature namespace
   - 错误消息 → errors namespace
   - 校验提示 → validation namespace
   - 通用操作按钮 → common namespace

3. **替换阶段**：将源码中的字符串替换为 `t('key')` 调用
   - 带变量使用插值：`{t('key', { count, name })}`
   - 带富文本使用 Trans 组件或 HTML 转义

4. **验证阶段**：确认替换后页面渲染正常，无裸 key 显示

- [ ] 所有 JSX 中的字符串字面量已替换
- [ ] template string 中包含的用户可见文本已提取
- [ ] placeholder / title / aria-label 等属性中的文本已提取
- [ ] 硬编码的错误消息和校验文本已提取
- [ ] 替换后运行全量测试确保无回归

**输出**: 更新后的源码文件 + 初始翻译文件

### Step 4：处理复杂格式场景

处理国际化中的常见复杂情况：

#### 复数形式（Plurals）

```typescript
// 翻译文件 (locales/en/common.json)
{
  "inbox": {
    "count_one": "{{count}} message",
    "count_other": "{{count}} messages",
    "count_zero": "No messages"
  }
}

// 翻译文件 (locales/zh-CN/common.json)
{
  "inbox": {
    "count_0": "没有消息",
    "count_1": "{{count}} 条消息",
    "count_other": "{{count}} 条消息"
  }
}

// 使用
const count = messages.length;
return <span>{t('inbox.count', { count })}</span>;
```

#### 日期/数字/货币格式化

```typescript
// 使用 Intl API（不依赖 i18n 库）
const formatter = new Intl.DateTimeFormat(locale, {
  dateStyle: 'full',
  timeStyle: 'short',
});

const numberFormatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'CNY',
});

const relativeFormatter = new Intl.RelativeTimeFormat(locale, {
  numeric: 'auto',
});
```

#### RTL 语言支持

```css
/* 支持 RTL 的布局模式 */
.direction-rtl {
  direction: rtl;
  text-align: right;
}

/* Flexbox 自动翻转 */
.direction-rtl .flex-row {
  flex-direction: row-reverse;
}

/* margin/padding 镜像 */
.direction-rtl [data-margin-start] {
  margin-right: var(--margin-value);
  margin-left: 0;
}
```

- [ ] 复数形式覆盖了目标语言的所有复数类别（英语 2 种、俄语 3 种、阿拉伯语 6 种）
- [ ] 日期时间使用 Intl API 或 i18n 库的格式化函数
- [ ] 数字格式考虑千分位分隔符和小数点差异（1,234.56 vs 1.234,56）
- [ ] RTL 语言有对应的 CSS 方向适配
- [ ] 图片/图标不含文字方向依赖（避免左右箭头在 RTL 中含义反转）

**输出**: `locales/{lang}/{namespace}.json`

### Step 5：缺失 Key 检测与翻译工作流

建立持续检测和补充翻译的机制：

**CI 中的缺失 key 检测**：

```bash
# 检查是否有未翻译的 key
# 方法 1: 使用 i18next-check
npx i18next-check --config i18next-check.config.json

# 方法 2: 自定义脚本对比默认语言和其他语言的 key 差异
node scripts/check-missing-keys.js en zh-CN ja
```

**翻译文件管理规范**：

```
locales/
├── en/                    # 英语（源语言，始终最完整）
│   ├── common.json
│   ├── errors.json
│   └── validation.json
├── zh-CN/                 # 简体中文
│   ├── common.json        # 必须与 en/ 的 key 集合完全一致
│   ├── errors.json
│   └── validation.json
├── ja/                    # 日本語
│   └── ...
└── index.ts               # 翻译文件导入汇总
```

**翻译更新流程**：
1. 开发者在源语言（en）中添加/修改 key
2. CI 检测到其他语言的 key 不完整 → 报 Warning（不阻断但提醒）
3. 翻译人员根据 `en/*.json` 的变更更新对应语言的 JSON
4. PR 中包含翻译文件的同步更新
5. 合并后 CI 确认所有语言 key 集合一致

- [ ] CI 中配置了 missing key 检查
- [ ] 源语言（通常是英语）作为 canonical source
- [ ] 非 source 语言的 fallback 到 source 语言（不显示裸 key）
- [ ] 有明确的翻译更新流程和负责人
- [ ] 翻译文件使用 UTF-8 编码，无 BOM

**输出**: CI 检测配置 + 翻译工作流文档

## 产出物

| 产出物 | 路径模板 | 格式 | 说明 |
|-------|---------|------|------|
| i18n 配置 | `src/i18n/config.ts` | TypeScript | i18n 实例初始化和中间件配置 |
| 翻译文件 | `locales/{lang}/{namespace}.json` | JSON | 各语言的翻译字典 |
| Key 规范文档 | `.harness/i18n/key-conventions.md` | Markdown | 命名和组织规范 |
| 类型定义 | `src/i18n/types.ts` | TypeScript | 翻译 key 的类型安全定义 |
| 缺失检测脚本 | `scripts/check-missing-keys.js` | JS | CI 中运行的 key 完整性检查 |

## 失败处理

| 失败场景 | 处理方式 | 恢复策略 |
|---------|---------|---------|
| 某语言缺少翻译 key 导致显示裸 key | 配置 fallbackLng 回退到默认语言 | 同时告警通知翻译负责人补齐 |
| 复数形式在某些语言显示异常 | 检查该语言的 plural category 定义 | 参考 CLDR 数据修正 plural rule |
| RTL 布局错乱（元素重叠/溢出） | 使用 CSS logical properties 替代 directional 属性 | `margin-left` → `margin-inline-start` |
| 翻译文件过大影响首屏加载 | 按 namespace 按需加载（lazy loading） | 使用 i18next 的 ns 加载机制 |
| 相同语义的文本使用了不同 key 导致翻译不一致 | 统一到 common namespace 的共享 key | 定期 audit 发现重复 key |
| 特殊字符（emoji/数学符号）在不同语言渲染异常 | 使用 Unicode 转义或图片替代 | 测试覆盖所有目标语言的渲染效果 |

## 交接协议

```markdown
## Internationalization 交接包

### 交付给 tdd（后续开发）
- i18n 配置和使用方法说明
- 新增文本时的标准操作流程
- 当前支持的完整语言列表

### 交付给 e2e-qa（多语言测试）
- 每种语言的测试账号和预期文案
- 需要特别关注的 RTL 布局页面列表
- 复数形式的测试数据（0/1/2/many）

### 交付给 ci-cd-pipeline（构建阶段）
- 翻译文件构建命令（如有预编译步骤）
- 缺失 key 检测命令和阈值配置
- 翻译文件大小监控（防止膨胀）
```

**交接验证**：切换到每种目标语言后，核心页面无裸 key 显示且布局正常。

## 质量门禁

| 门禁项 | 检查方式 | 通过标准 |
|-------|---------|---------|
| i18n 配置存在 | 文件系统检查 | `src/i18n/config.ts` 存在 |
| 翻译文件目录完整 | 目录检查 | `locales/` 下有 ≥ 1 个语言目录 |
| 默认语言翻译完整 | JSON 解析 | `locales/en/` 包含所有 namespace 的 .json |
| 源码无硬编码用户文本 | 正则搜索 | `src/` 中 JSX 字符串字面量 ≤ 阈值（排除 test/） |
| 有 key 命名规范 | 文件系统检查 | `.harness/i18n/key-conventions.md` 存在 |
| 缺失 key 检测已配置 | CI 配置检查 | pipeline 中有 i18n check 步骤 |
| RTL 支持（如有 RTL 语言） | CSS 检查 | 存在 direction/inline-* 相关样式 |
| 行数达标 | 行计数 | SKILL.md 本身 ≥ 50 行（v3 标准） |

## 与其他 Skill 的协作

| 协作 Skill | 协作方式 |
|-----------|---------|
| spec-generator | 产品需求中的多语言支持要求驱动 i18n 范围确定 |
| tdd | 国际化相关的逻辑（格式切换、语言检测）同样遵循 TDD |
| e2e-qa | 多语言环境下的端到端测试验证 |
| ci-cd-pipeline | CI 中集成缺失 key 检测和翻译一致性校验 |
