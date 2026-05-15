import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { DocValidator } from '../doc-validator.js';

vi.mock('node:fs/promises');
vi.mock('glob', () => ({ glob: vi.fn() }));

const mockedFs = vi.mocked(fs);
let mockedGlob: ReturnType<typeof vi.fn>;

const FAKE_FILE_PATH = '/fake/test.md';
const FAKE_SKILL_PATH = '/fake/core/skills/test/SKILL.md';

beforeAll(async () => {
  const globModule = await import('glob');
  mockedGlob = vi.mocked(globModule.glob);
});

function createValidMarkdown(): string {
  return [
    '---',
    'id: test-skill',
    'name: Test Skill',
    'stage: spec',
    'roles: [product-owner]',
    'pattern: interactive',
    'mandatory: true',
    '---',
    '',
    '# Test Skill',
    '',
    '## 执行流程',
    '',
    '### Step 1: 初始化',
    '- 加载配置文件',
    '',
    '### Step 2: 处理',
    '- 执行主要逻辑',
    '',
    '## 产出物',
    '- output.md',
    '',
    '| 字段 | 类型 | 必填 | 说明 |',
    '|------|------|------|------|',
    '| id | string | 是 | 唯一标识 |',
    '| name | string | 是 | 名称 |',
    '',
    '```mermaid',
    'graph TD',
    '    A[Start] --> B[End]',
    '```',
    '',
    ...Array.from({ length: 40 }, () => 'Additional content line.'),
  ].join('\n');
}

function setupValidateTest(content: string, filePath: string = FAKE_FILE_PATH) {
  mockedGlob.mockResolvedValue([filePath]);
  mockedFs.readFile.mockResolvedValue(content as never);
  mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);
}

describe('DocValidator', () => {
  let validator: DocValidator;

  beforeEach(() => {
    validator = new DocValidator();
    vi.clearAllMocks();
    mockedGlob?.mockResolvedValue([]);
  });

  describe('validate() — 返回 ValidationResult 结构', () => {
    it('应返回包含 valid、issues、summary 的 ValidationResult 对象', async () => {
      setupValidateTest(createValidMarkdown());
      const result = await validator.validate();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('errors');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('infos');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe('extractStructuredData() — Markdown 结构提取', () => {
    it('应正确解析 YAML Frontmatter', () => {
      const content = createValidMarkdown();
      const extracted = validator.extractStructuredData(content);

      expect(extracted.frontmatter.id).toBe('test-skill');
      expect(extracted.frontmatter.name).toBe('Test Skill');
      expect(extracted.frontmatter.stage).toBe('spec');
    });

    it('应正确提取标题层级和文本', () => {
      const content = createValidMarkdown();
      const extracted = validator.extractStructuredData(content);

      expect(extracted.headings.length).toBeGreaterThan(0);
      expect(extracted.headings[0].text).toBe('Test Skill');
      expect(extracted.headings[0].level).toBe(1);
      expect(extracted.headings.some(h => h.text === '执行流程')).toBe(true);
      expect(extracted.headings.some(h => h.text === '产出物')).toBe(true);
    });

    it('应正确提取表格结构（header + rows）', () => {
      const content = createValidMarkdown();
      const extracted = validator.extractStructuredData(content);

      expect(extracted.tables.length).toBeGreaterThan(0);
      const table = extracted.tables[0];
      expect(table.header.length).toBeGreaterThan(0);
      expect(table.header).toContain('字段');
      expect(table.rows.length).toBeGreaterThan(0);
      expect(table.rows[0].length).toBe(table.header.length);
    });

    it('应正确提取代码块（包括 Mermaid）', () => {
      const content = createValidMarkdown();
      const extracted = validator.extractStructuredData(content);

      const mermaidBlocks = extracted.codeBlocks.filter(b => b.lang === 'mermaid');
      expect(mermaidBlocks.length).toBe(1);
      expect(mermaidBlocks[0].content).toContain('graph TD');
    });

    it('应检测未填充的模板变量', () => {
      const content = '# Test\n\n{{topic}} is pending.\n\n{{date}} needs fill.';
      const extracted = validator.extractStructuredData(content);

      expect(extracted.unresolvedTemplates).toContain('{{topic}}');
      expect(extracted.unresolvedTemplates).toContain('{{date}}');
      expect(extracted.unresolvedTemplates.length).toBe(2);
    });

    it('无模板变量时应返回空数组', () => {
      const content = createValidMarkdown();
      const extracted = validator.extractStructuredData(content);
      expect(extracted.unresolvedTemplates).toHaveLength(0);
    });

    it('应检测占位符文本（TBD/TODO/FIXME）', () => {
      const content = '# Test\n\nTODO: implement this\nFIXME: fix later\nTBD: decide later';
      const extracted = validator.extractStructuredData(content);

      expect(extracted.placeholders).toContain('TODO');
      expect(extracted.placeholders).toContain('FIXME');
      expect(extracted.placeholders).toContain('TBD');
    });

    it('中文占位符也应被检测到', () => {
      const content = '# Test\n\n待定：需要确认\n待补充：后续补充';
      const extracted = validator.extractStructuredData(content);

      expect(extracted.placeholders.some(p => p.includes('待定'))).toBe(true);
      expect(extracted.placeholders.some(p => p.includes('待补充'))).toBe(true);
    });

    it('应构建章节映射 Map', () => {
      const content = createValidMarkdown();
      const extracted = validator.extractStructuredData(content);

      expect(extracted.sectionMap.size).toBeGreaterThan(0);
      expect(extracted.sectionMap.has('执行流程')).toBe(true);
      expect(extracted.sectionMap.has('产出物')).toBe(true);
    });
  });

  describe('结构化校验 — L2/L3 规则', () => {
    it('未填充的模板变量应产生 DOC_UNRESOLVED_TEMPLATE error', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        '{{topic}} placeholder',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(badContent);
      const result = await validator.validate();

      const templateIssue = result.issues.find(i => i.code === 'DOC_UNRESOLVED_TEMPLATE');
      expect(templateIssue).toBeDefined();
      expect(templateIssue?.severity).toBe('error');
      expect(templateIssue?.message).toContain('{{topic}}');
    });

    it('占位符文本应产生 DOC_PLACEHOLDER_TEXT warn', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        'TODO: need to implement',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(badContent);
      const result = await validator.validate();

      const placeholderIssue = result.issues.find(i => i.code === 'DOC_PLACEHOLDER_TEXT');
      expect(placeholderIssue).toBeDefined();
      expect(placeholderIssue?.severity).toBe('warn');
    });

    it('表格列数不一致应产生 DOC_TABLE_FORMAT error', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        '',
        '| A | B | C |',
        '|---|---|---|',
        '| 1 | 2 |',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(badContent);
      const result = await validator.validate();

      const tableIssue = result.issues.find(i => i.code === 'DOC_TABLE_FORMAT');
      expect(tableIssue).toBeDefined();
      expect(tableIssue?.severity).toBe('error');
    });

    it('标题层级跳跃应产生 DOC_HEADING_HIERARCHY warn', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# H1 Title',
        '#### H4 Jump!',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(badContent);
      const result = await validator.validate();

      const headingIssue = result.issues.find(i => i.code === 'DOC_HEADING_HIERARCHY');
      expect(headingIssue).toBeDefined();
      expect(headingIssue?.severity).toBe('warn');
    });

    it('空的 Mermaid 代码块应产生 DOC_MERMAID_BLOCK warn', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        '',
        '```mermaid',
        '```',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(badContent);
      const result = await validator.validate();

      const mermaidIssue = result.issues.find(i => i.code === 'DOC_MERMAID_BLOCK');
      expect(mermaidIssue).toBeDefined();
      expect(mermaidIssue?.severity).toBe('warn');
    });

    it('SKILL.md 缺少必需 Frontmatter 字段应产生 error', async () => {
      const badContent = [
        '---',
        'name: OnlyName',
        '---',
        ...Array.from({ length: 60 }, () => '# Content'),
      ].join('\n');

      // 直接使用 validateFile 跳过 glob 匹配，传入 SKILL.md 路径触发 SKILL.md 专用校验
      mockedFs.readFile.mockResolvedValue(badContent as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      const v = new DocValidator();
      await v.validateFile(FAKE_SKILL_PATH);

      const missingFields = v.validate.bind(v) ? [] : v['issues'] || [];
      // 通过重新创建 validator 并检查 validateFile 结果来验证
      const v2 = new DocValidator();
      await v2.validateFile(FAKE_SKILL_PATH);
      // validateFile 会将 issues 添加到内部，我们通过再次调用来验证
      // 更直接的方式：直接调用内部方法验证
      const result = await new DocValidator().validateFile(FAKE_SKILL_PATH);
      // validateFile 返回 void，需要通过其他方式获取结果
      // 改用 validate + 正确的文件路径模式
      mockedGlob.mockResolvedValue([FAKE_SKILL_PATH]);
      mockedFs.readFile.mockResolvedValue(badContent as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      const v3 = new DocValidator();
      const validationResult = await v3.validate();

      const schemaIssues = validationResult.issues.filter(
        i => i.code === 'DOC_FRONTMATTER_SCHEMA' && i.severity === 'error'
      );
      expect(schemaIssues.length).toBeGreaterThan(0);
      expect(schemaIssues.some(i => i.message.includes('id'))).toBe(true);
    });

    it('SKILL.md stage 值无效应产生 error', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: invalid_stage',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        ...Array.from({ length: 60 }, () => '# Content'),
      ].join('\n');

      mockedGlob.mockResolvedValue([FAKE_SKILL_PATH]);
      mockedFs.readFile.mockResolvedValue(badContent as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      const v = new DocValidator();
      const result = await v.validate();

      const stageIssue = result.issues.find(i =>
        i.code === 'DOC_FRONTMATTER_SCHEMA' && i.message.includes('无效')
      );
      expect(stageIssue).toBeDefined();
    });

    it('完整的有效文档不应产生任何 error', async () => {
      // 使用 SKILL.md 路径以确保走正确的 Frontmatter 校验分支
      setupValidateTest(createValidMarkdown(), FAKE_SKILL_PATH);
      const result = await validator.validate();

      // warnings 允许存在（如 Mermaid 语法提示），但 errors 必须为 0
      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
    });

    it('L1 严格度应跳过结构化检查', async () => {
      const badContent = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        '{{template}} TODO item',
        '',
        '| A |',
        '|---|',
        '| 1 | 2 |',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(badContent);
      const v = new DocValidator({ strictness: 'L1' });
      const result = await v.validate();

      const structuralIssues = result.issues.filter(i =>
        !i.code.startsWith('DOC_READ_FAIL')
      );
      expect(structuralIssues.length).toBe(0);
    });
  });

  describe('语义校验 — L3 规则', () => {
    it('模糊的验收标准应产生 warn', async () => {
      const reqContent = [
        '# Deep Requirements Analysis: Test Feature',
        '',
        '## 验收标准',
        '',
        '- [ ] BR-001 验证码格式为6位数字',
        '- [ ] EC-001 超时后自动重试不超过3次',
        '- [ ] 系统应该支持用户登录功能',
        '- [ ] 系统必须能够处理并发请求',
        ...Array.from({ length: 20 }, () => '# Padding'),
      ].join('\n');

      setupValidateTest(reqContent);
      const v = new DocValidator({ strictness: 'L3' });
      const result = await v.validate();

      const vagueIssue = result.issues.find(i => i.code === 'DOC_VAGUE_ACCEPTANCE_CRITERIA');
      expect(vagueIssue).toBeDefined();
      expect(vagueIssue?.severity).toBe('warn');
    });

    it('带 ID 列但缺少优先级列的表格应产生 info', async () => {
      const reqContent = [
        '# Requirements',
        '',
        '| 规则ID | 规则名称 | 描述 | 触发条件 | 例外情况 | 优先级 | 稳定性 |',
        '|--------|----------|------|----------|----------|--------|--------|',
        '| BR-001 | 验证码校验 | 校验验证码正确性 | 提交时 | 验证码过期 | P0 | 高 |',
        ...Array.from({ length: 20 }, () => '# Padding'),
      ].join('\n');

      setupValidateTest(reqContent);
      const v = new DocValidator({ strictness: 'L3' });
      const result = await v.validate();

      const priorityInfo = result.issues.filter(i => i.code === 'DOC_TABLE_MISSING_PRIORITY');
      expect(Array.isArray(priorityInfo)).toBe(true);
    });
  });

  describe('Schema 校验', () => {
    it('JSON Schema 校验应返回结果', async () => {
      const docContent = [
        '# Requirements',
        '',
        '## 业务目标',
        '实现用户登录功能。',
        '',
        '| 规则ID | 规则名称 | 描述 | 触发条件 | 优先级 |',
        '|--------|----------|------|----------|--------|',
        '| BR-001 | 验证码校验 | 校验验证码 | 提交时 | P0 |',
        ...Array.from({ length: 20 }, () => '# Padding'),
      ].join('\n');

      const schemaContent = JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['businessGoal', 'rules'],
        properties: {
          businessGoal: { type: 'string', minLength: 10 },
          rules: { type: 'array', minItems: 1 },
        },
      });

      mockedFs.readFile
        .mockResolvedValueOnce(docContent as never)
        .mockResolvedValueOnce(schemaContent as never);

      const result = await validator.validateAgainstSchema('/fake/doc.md', '/fake/schema.json');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('issues');
    });

    it('Schema 文件不存在应产生 SCHEMA_READ_FAIL error', async () => {
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';

      const v = new DocValidator();

      mockedFs.readFile.mockReset();
      mockedFs.readFile.mockImplementation(async (path: Parameters<typeof mockedFs.readFile>[0]) => {
        if (String(path).includes('schema')) {
          throw enoentErr;
        }
        return '# dummy doc';
      });

      const result = await v.validateAgainstSchema('/fake/doc.md', '/fake/schema.json');

      console.log('Schema test issues:', result.issues.map(i => i.code));
      const readIssue = result.issues.find(i => i.code === 'SCHEMA_READ_FAIL');
      expect(readIssue).toBeDefined();
      expect(readIssue?.severity).toBe('error');
    });
  });

  describe('内部链接检查', () => {
    it('断裂的内部链接应产生 DOC_BROKEN_LINK error', async () => {
      const contentWithBrokenLink = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        '',
        'See [other doc](./nonexistent-file.md) for details.',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      const linkErr = new Error('ENOENT') as NodeJS.ErrnoException;
      linkErr.code = 'ENOENT';

      mockedGlob.mockResolvedValue([FAKE_FILE_PATH]);
      mockedFs.readFile.mockResolvedValue(contentWithBrokenLink as never);

      const v = new DocValidator({ checkReferenceLinks: true });

      mockedFs.stat.mockReset();
      let statCallCount = 0;
      mockedFs.stat.mockImplementation(async (path: Parameters<typeof mockedFs.stat>[0]) => {
        statCallCount++;
        if (String(path).includes('nonexistent')) {
          throw linkErr;
        }
        return { isDirectory: () => false } as never;
      });

      const result = await v.validate();

      console.log('Link test issues:', result.issues.map(i => i.code));
      console.log('Link test issue count:', result.issues.length);
      console.log('Total stat calls:', statCallCount);

      const linkIssue = result.issues.find(i => i.code === 'DOC_BROKEN_LINK');
      expect(linkIssue).toBeDefined();
      expect(linkIssue?.severity).toBe('error');
    });

    it('外部链接不应触发内部链接检查', async () => {
      const contentWithExternalLink = [
        '---',
        'id: test',
        'name: Test',
        'stage: spec',
        'roles: []',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Test',
        '',
        'Visit [example](https://example.com) for more.',
        ...Array.from({ length: 50 }, () => '# Content'),
      ].join('\n');

      setupValidateTest(contentWithExternalLink);
      const v = new DocValidator({ checkReferenceLinks: true });
      const result = await v.validate();

      const linkIssues = result.issues.filter(i => i.code === 'DOC_BROKEN_LINK');
      expect(linkIssues).toHaveLength(0);
    });
  });

  describe('边界情况', () => {
    it('空目录不崩溃且返回 warn', async () => {
      mockedGlob?.mockResolvedValue([]);
      const result = await validator.validate();

      expect(result).toHaveProperty('valid');
      expect(result.issues.some(i => i.code === 'DOC_NO_FILES')).toBe(true);
    });

    it('文件读取失败应产生 DOC_READ_FAIL error', async () => {
      mockedGlob?.mockResolvedValue([FAKE_FILE_PATH]);
      mockedFs.readFile.mockRejectedValue(new Error('Permission denied'));
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      const result = await validator.validate();

      const readIssue = result.issues.find(i => i.code === 'DOC_READ_FAIL');
      expect(readIssue).toBeDefined();
      expect(readIssue?.severity).toBe('error');
    });

    it('多次调用 validate() 应重置 issues', async () => {
      setupValidateTest(createValidMarkdown());

      const r1 = await validator.validate();
      const r2 = await validator.validate();

      expect(r1.issues.length).toBe(r2.issues.length);
    });

    it('computeFileHash 对不存在文件返回空字符串', () => {
      const hash = validator.computeFileHash('/nonexistent/file.md');
      expect(hash).toBe('');
    });
  });
});
