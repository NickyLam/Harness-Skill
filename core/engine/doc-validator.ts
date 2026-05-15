import { readFile, stat } from 'fs/promises';
import { join, relative, normalize, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { glob } from 'glob';
import type { ValidationResult, ValidationIssue, Severity } from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');

function isPathWithin(childPath: string, parentPath: string): boolean {
  const resolved = resolve(normalize(childPath));
  const parentResolved = resolve(normalize(parentPath));
  return resolved.startsWith(parentResolved + '/') || resolved === parentResolved;
}

export interface DocValidationOptions {
  targetDir?: string;
  filePattern?: string;
  strictness?: 'L1' | 'L2' | 'L3';
  checkUnresolvedTemplates?: boolean;
  checkPlaceholders?: boolean;
  checkTableFormat?: boolean;
  checkHeadingHierarchy?: boolean;
  checkMermaidBlocks?: boolean;
  checkFrontmatterSchema?: boolean;
  checkReferenceLinks?: boolean;
}

interface DocCheckRule {
  id: string;
  name: string;
  severity: Severity;
  layer: number;
  check: (content: string, filePath: string) => Promise<DocCheckOutcome>;
}

interface DocCheckOutcome {
  passed: boolean;
  message: string;
  suggestion?: string;
}

export interface ExtractedDocData {
  frontmatter: Record<string, unknown>;
  headings: Array<{ level: number; text: string; line: number }>;
  tables: Array<{ header: string[]; rows: string[][]; line: number }>;
  codeBlocks: Array<{ lang: string; content: string; startLine: number; endLine: number }>;
  links: Array<{ text: string; href: string; line: number; isInternal: boolean }>;
  unresolvedTemplates: string[];
  placeholders: string[];
  sectionMap: Map<string, string>;
}

export class DocValidator {
  private issues: ValidationIssue[] = [];
  private options: DocValidationOptions;

  constructor(options: DocValidationOptions = {}) {
    this.options = {
      strictness: 'L2',
      checkUnresolvedTemplates: true,
      checkPlaceholders: true,
      checkTableFormat: true,
      checkHeadingHierarchy: true,
      checkMermaidBlocks: true,
      checkFrontmatterSchema: true,
      checkReferenceLinks: false,
      ...options,
    };
  }

  async validate(): Promise<ValidationResult> {
    this.issues = [];

    const targetDir = this.options.targetDir ?? PROJECT_ROOT;
    const filePattern = this.options.filePattern ?? '**/*.md';

    const files = await this.globFiles(targetDir, filePattern);

    if (files.length === 0) {
      this.addIssue('warn', 'DOC_NO_FILES', `在 ${targetDir} 中未找到匹配 "${filePattern}" 的文件`, targetDir);
      return this.buildResult();
    }

    for (const file of files) {
      await this.validateFile(file);
    }

    return this.buildResult();
  }

  async validateFile(filePath: string): Promise<void> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.addIssue('error', 'DOC_READ_FAIL', `无法读取文件 ${filePath}: ${message}`, filePath);
      return;
    }

    const relativePath = relative(PROJECT_ROOT, filePath);
    const extracted = this.extractStructuredData(content);

    if (this.options.strictness !== 'L1') {
      await this.runStructuralChecks(content, filePath, extracted);
    }
    if (this.options.strictness === 'L3') {
      await this.runSemanticChecks(content, filePath, extracted);
    }
    if (this.options.checkReferenceLinks) {
      await this.runReferenceLinkChecks(content, filePath, extracted);
    }
  }

  async validateAgainstSchema(filePath: string, schemaPath: string): Promise<ValidationResult> {
    this.issues = [];

    let schemaContent: string;
    try {
      schemaContent = await readFile(schemaPath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.addIssue('error', 'SCHEMA_READ_FAIL', `无法读取 Schema 文件 ${schemaPath}: ${message}`, schemaPath);
      return this.buildResult();
    }

    let schema: unknown;
    try {
      schema = JSON.parse(schemaContent);
    } catch {
      this.addIssue('error', 'SCHEMA_PARSE_FAIL', `${schemaPath} 不是有效的 JSON`, schemaPath);
      return this.buildResult();
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.addIssue('error', 'DOC_READ_FAIL', `无法读取文档 ${filePath}: ${message}`, filePath);
      return this.buildResult();
    }

    const extracted = this.extractStructuredData(content);
    const structuredData = this.extractToJsonObject(extracted);

    await this.validateJsonAgainstSchema(structuredData, schema as object, filePath);

    return this.buildResult();
  }

  extractStructuredData(content: string): ExtractedDocData {
    return {
      frontmatter: this.parseFrontmatter(content),
      headings: this.extractHeadings(content),
      tables: this.extractTables(content),
      codeBlocks: this.extractCodeBlocks(content),
      links: this.extractLinks(content),
      unresolvedTemplates: this.findUnresolvedTemplates(content),
      placeholders: this.findPlaceholders(content),
      sectionMap: this.buildSectionMap(content),
    };
  }

  extractToJsonObject(extracted: ExtractedDocData): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    result.frontmatter = extracted.frontmatter;

    const rules: Array<Record<string, unknown>> = [];
    for (const table of extracted.tables) {
      if (table.header.some(h => h.includes('规则ID') || h.includes('规则名称'))) {
        for (const row of table.rows) {
          const rule: Record<string, unknown> = {};
          for (let i = 0; i < Math.min(table.header.length, row.length); i++) {
            rule[this.normalizeFieldName(table.header[i])] = row[i];
          }
          rules.push(rule);
        }
      }
    }
    if (rules.length > 0) result.rules = rules;

    result.headings = extracted.headings.map(h => ({ level: h.level, text: h.text }));
    result.sections = Object.fromEntries(extracted.sectionMap);

    return result;
  }

  private async runStructuralChecks(
    content: string,
    filePath: string,
    extracted: ExtractedDocData
  ): Promise<void> {
    const checks = this.getStructuralRules();

    for (const rule of checks) {
      try {
        const outcome = await rule.check(content, filePath);
        if (!outcome.passed) {
          this.addIssue(rule.severity, rule.id, outcome.message, filePath, outcome.suggestion);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.addIssue('warn', `${rule.id}_ERROR`, `校验规则 [${rule.name}] 执行异常: ${message}`, filePath);
      }
    }

    if (this.options.checkUnresolvedTemplates && extracted.unresolvedTemplates.length > 0) {
      this.addIssue(
        'error',
        'DOC_UNRESOLVED_TEMPLATE',
        `发现未填充的模板变量: ${extracted.unresolvedTemplates.join(', ')}`,
        filePath,
        '请确保所有 {{变量}} 都已被实际内容替换'
      );
    }

    if (this.options.checkPlaceholders && extracted.placeholders.length > 0) {
      this.addIssue(
        'warn',
        'DOC_PLACEHOLDER_TEXT',
        `发现占位符文本: ${extracted.placeholders.join(', ')}`,
        filePath,
        '将 TBD/TODO/FIXME 替换为实际内容或移除'
      );
    }
  }

  private getStructuralRules(): DocCheckRule[] {
    const rules: DocCheckRule[] = [];

    if (this.options.checkTableFormat) {
      rules.push({
        id: 'DOC_TABLE_FORMAT',
        name: '表格格式正确性',
        severity: 'error',
        layer: 3,
        check: async (content, _filePath) => {
          const tables = this.extractTablesRaw(content);
          const invalidTables = tables.filter(
            (t) =>
              t.header.length <= 1 ||
              t.rows.some((r) => r.cells.length !== t.header.length)
          );

          return {
            passed: invalidTables.length === 0,
            message:
              invalidTables.length > 0
                ? `${invalidTables.length} 个表格列数不一致（表头 ${invalidTables[0].header.length} 列，部分数据行不匹配）`
                : '通过',
            suggestion: '确保每个数据行的列数与表头一致，使用空单元格补齐缺失值',
          };
        },
      });
    }

    if (this.options.checkHeadingHierarchy) {
      rules.push({
        id: 'DOC_HEADING_HIERARCHY',
        name: '标题层级正确性',
        severity: 'warn',
        layer: 3,
        check: async (content, _filePath) => {
          const headings = this.extractHeadings(content);
          const jumps: number[] = [];

          for (let i = 1; i < headings.length; i++) {
            const diff = headings[i].level - headings[i - 1].level;
            if (diff > 1) jumps.push(headings[i].line);
          }

          return {
            passed: jumps.length === 0,
            message:
              jumps.length > 0
                ? `标题层级跳跃 ${jumps.length} 处（行号: ${jumps.join(', ')}，如 H1 直接到 H3）`
                : '通过',
            suggestion: '标题层级应逐级递增，避免跳跃（H2 下应接 H3，不应直接跳到 H4）',
          };
        },
      });
    }

    if (this.options.checkMermaidBlocks) {
      rules.push({
        id: 'DOC_MERMAID_BLOCK',
        name: 'Mermaid 代码块完整性',
        severity: 'warn',
        layer: 2,
        check: async (content, _filePath) => {
          const blocks = content.match(/```mermaid\n[\s\S]*?```/g) || [];
          const emptyBlocks = blocks.filter((b) => b.split('\n').length <= 2);

          return {
            passed: emptyBlocks.length === 0,
            message:
              emptyBlocks.length > 0
                ? `${emptyBlocks.length} 个空的 Mermaid 代码块（仅有开闭标记，无图表定义）`
                : '通过',
            suggestion: '为 Mermaid 代码块添加完整的图表定义，或删除空代码块',
          };
        },
      });

      rules.push({
        id: 'DOC_MERMAID_SYNTAX',
        name: 'Mermaid 基本语法检查',
        severity: 'warn',
        layer: 2,
        check: async (content, _filePath) => {
          const blocks = content.match(/```mermaid\n([\s\S]*?)```/g) || [];
          const syntaxErrors: string[] = [];

          for (const block of blocks) {
            const body = block.replace(/```mermaid\n?/, '').replace(/\n?```\s*$/, '');
            const lines = body.split('\n').filter((l) => l.trim());

            if (lines.length === 0) continue;

            const firstLine = lines[0].trim();
            const validStarters = [
              'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
              'stateDiagram-v2', 'erDiagram', 'pie', 'gitGraph',
              'mindmap', 'timeline', 'sankey', 'block', 'architecture',
            ];

            if (
              !validStarters.some((s) => firstLine.startsWith(s)) &&
              !firstLine.startsWith('%{') &&
              !firstLine.startsWith('%%')
            ) {
              syntaxErrors.push(`未知图表类型: "${firstLine.slice(0, 40)}"`);
            }

            const hasArrow = lines.some((l) => /[-->.]{2,}|-->|->/.test(l));
            if (
              (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) &&
              !hasArrow &&
              lines.length > 2
            ) {
              syntaxErrors.push('流程图缺少边定义（箭头连接）');
            }
          }

          return {
            passed: syntaxErrors.length === 0,
            message:
              syntaxErrors.length > 0
                ? `Mermaid 语法问题: ${syntaxErrors.join('; ')}`
                : '通过',
            suggestion: '检查 Mermaid 图表类型关键字和边定义语法',
          };
        },
      });
    }

    if (this.options.checkFrontmatterSchema) {
      rules.push({
        id: 'DOC_FRONTMATTER_SCHEMA',
        name: 'Frontmatter 结构校验',
        severity: 'error',
        layer: 3,
        check: async (content, filePath) => {
          if (!filePath.endsWith('.md') && !filePath.endsWith('.SKILL.md')) {
            return { passed: true, message: '跳过非 Markdown 文件' };
          }

          if (!content.startsWith('---')) {
            return { passed: true, message: '无 Frontmatter，跳过' };
          }

          const fmEnd = content.indexOf('---', 3);
          if (fmEnd === -1) {
            return { passed: false, message: 'YAML Frontmatter 未正确关闭（缺少结尾 ---）' };
          }

          const fmRaw = content.slice(3, fmEnd).trim();
          let fmData: Record<string, unknown>;

          try {
            fmData = parseYaml(fmRaw) as Record<string, unknown>;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { passed: false, message: `YAML Frontmatter 解析失败: ${message}` };
          }

          const isSkillFile = filePath.includes('/skills/') || filePath.endsWith('SKILL.md');
          const requiredFields = isSkillFile
            ? ['id', 'name', 'stage', 'roles', 'pattern', 'mandatory']
            : ['title', 'date'];

          const missingFields = requiredFields.filter((f) => !(f in fmData));

          if (isSkillFile && fmData.stage) {
            const validStages = [
              'spec', 'plan', 'build', 'test', 'review', 'simplify', 'ship', 'cross-cutting',
            ];
            const stageVal = fmData.stage;
            if (
              typeof stageVal === 'string' &&
              !validStages.includes(stageVal)
            ) {
              return {
                passed: false,
                message: `stage 值无效: "${stageVal}"，有效值为: ${validStages.join(', ')}`,
                suggestion: `修正 stage 为有效阶段名之一`,
              };
            }
          }

          if (fmData.roles && Array.isArray(fmData.roles) && fmData.roles.length === 0) {
            return {
              passed: false,
              message: 'roles 字段为空数组，至少需要一个角色',
              suggestion: '添加至少一个角色到 roles 字段',
            };
          }

          return {
            passed: missingFields.length === 0,
            message:
              missingFields.length > 0
                ? `缺少必需字段: ${missingFields.join(', ')}`
                : '通过',
            suggestion:
              missingFields.length > 0
                ? `请添加以下字段到 Frontmatter: ${missingFields.join(', ')}`
                : undefined,
          };
        },
      });
    }

    return rules;
  }

  private async runSemanticChecks(
    content: string,
    filePath: string,
    extracted: ExtractedDocData
  ): Promise<void> {
    const acceptanceSection = [...extracted.sectionMap.keys()].find((k) =>
      /验收|acceptance|标准|criteria/i.test(k)
    );

    if (acceptanceSection) {
      const sectionContent = extracted.sectionMap.get(acceptanceSection) ?? '';
      const vaguePatterns = /(?:^|\n)\s*-\s+\[\s*\]\s+(.*?(?:应该|必须|可以|需要|支持)[^\n]*)/gi;
      let match: RegExpExecArray | null;
      const vagueItems: string[] = [];

      while ((match = vaguePatterns.exec(sectionContent)) !== null) {
        const item = match[1].trim();
        const hasQuantifiable = /\d+|%|ms|秒|KB|MB|字符|行|个|次/.test(item);
        if (!hasQuantifiable) {
          vagueItems.push(item.slice(0, 60));
        }
      }

      if (vagueItems.length > 0) {
        this.addIssue(
          'warn',
          'DOC_VAGUE_ACCEPTANCE_CRITERIA',
          `验收标准中存在模糊描述（无可量化指标）: ${vagueItems.slice(0, 5).join('; ')}`,
          filePath,
          '建议为每条验收标准添加可量化的通过/失败条件（如具体数值、百分比、时间限制）'
        );
      }
    }

    for (const table of extracted.tables) {
      const hasIdCol = table.header.some((h) =>
        /^(规则)?ID$|^编号$/i.test(h.trim())
      );
      const hasPriorityCol = table.header.some((h) =>
        /^优先级$/i.test(h.trim())
      );

      if (hasIdCol && !hasPriorityCol) {
        this.addIssue(
          'info',
          'DOC_TABLE_MISSING_PRIORITY',
          `带 ID 列的表格 "${table.header[0]}" 缺少优先级列`,
          filePath,
          '建议增加优先级列以便 AI 按优先级处理'
        );
      }
    }
  }

  private async runReferenceLinkChecks(
    content: string,
    filePath: string,
    extracted: ExtractedDocData
  ): Promise<void> {
    for (const link of extracted.links) {
      if (!link.isInternal) continue;

      const linkPath = link.href.replace(/^\.?\.\//, '').split('#')[0];

      if (!linkPath || link.href.startsWith('#')) continue;

      const absolutePath = resolve(PROJECT_ROOT, linkPath);

      if (!isPathWithin(absolutePath, PROJECT_ROOT)) {
        this.addIssue(
          'warn',
          'DOC_LINK_PATH_TRAVERSAL',
          `链接逃逸项目根目录: ${link.href} (行 ${link.line})`,
          filePath
        );
        continue;
      }

      try {
        await stat(absolutePath);
      } catch {
        this.addIssue(
          'error',
          'DOC_BROKEN_LINK',
          `内部链接目标不存在: ${link.href} (行 ${link.line})`,
          filePath,
          `创建文件 ${linkPath} 或修正链接路径`
        );
      }
    }
  }

  private async validateJsonAgainstSchema(
    data: Record<string, unknown>,
    schema: object,
    filePath: string
  ): Promise<void> {
    const requiredFields = (schema as Record<string, unknown>).required as string[] | undefined;
    const properties = (schema as Record<string, unknown>).properties as
      | Record<string, unknown>
      | undefined;

    if (!requiredFields || !properties) {
      this.addIssue('info', 'SCHEMA_NO_CONSTRAINTS', `Schema 无必需字段或属性定义，跳过结构化校验`, filePath);
      return;
    }

    for (const field of requiredFields) {
      const value = data[field];

      if (value === undefined || value === null || value === '') {
        this.addIssue(
          'error',
          'SCHEMA_REQUIRED_MISSING',
          `Schema 校验失败: 缺少必需字段 "${field}"`,
          filePath,
          `在文档中补充 "${field}" 内容`
        );
        continue;
      }

      const propDef = properties[field] as Record<string, unknown> | undefined;
      if (!propDef) continue;

      const expectedType = propDef.type as string | undefined;

      if (expectedType === 'array' && !Array.isArray(value)) {
        this.addIssue(
          'error',
          'SCHEMA_TYPE_MISMATCH',
          `字段 "${field}" 类型错误: 期望 array，实际 ${typeof value}`,
          filePath
        );
      }

      if (expectedType === 'string' && typeof value !== 'string') {
        this.addIssue(
          'error',
          'SCHEMA_TYPE_MISMATCH',
          `字段 "${field}" 类型错误: 期望 string，实际 ${typeof value}`,
          filePath
        );
      }

      const minLength = propDef.minLength as number | undefined;
      if (expectedType === 'string' && typeof value === 'string' && minLength && value.length < minLength) {
        this.addIssue(
          'error',
          'SCHEMA_MIN_LENGTH',
          `字段 "${field}" 长度不足: 实际 ${value.length} 字符，最小要求 ${minLength}`,
          filePath
        );
      }

      const minItems = propDef.minItems as number | undefined;
      if (expectedType === 'array' && Array.isArray(value) && minItems && value.length < minItems) {
        this.addIssue(
          'error',
          'SCHEMA_MIN_ITEMS',
          `字段 "${field}" 元素数量不足: 实际 ${value.length} 个，最小要求 ${minItems}`,
          filePath
        );
      }
    }
  }

  private parseFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};

    try {
      return parseYaml(match[1]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private extractHeadings(content: string): Array<{ level: number; text: string; line: number }> {
    const headings: Array<{ level: number; text: string; line: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({ level: match[1].length, text: match[2].trim(), line: i + 1 });
      }
    }

    return headings;
  }

  private extractTables(content: string): Array<{ header: string[]; rows: string[][]; line: number }> {
    const raw = this.extractTablesRaw(content);
    return raw.map((t) => ({
      header: t.header,
      rows: t.rows.map((r) => r.cells),
      line: t.line,
    }));
  }

  private extractTablesRaw(content: string): Array<{
    header: string[];
    rows: { cells: string[] }[];
    line: number;
  }> {
    const tables: Array<{ header: string[]; rows: { cells: string[] }[]; line: number }> = [];
    const lines = content.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        const headerCells = line
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
          .filter((c) => c !== '' && c !== '---');

        if (headerCells.length === 0 || i + 1 >= lines.length) {
          i++;
          continue;
        }

        const nextLine = lines[i + 1].trim();
        if (!nextLine.startsWith('|') || !nextLine.endsWith('|')) {
          i++;
          continue;
        }

        const sepCells = nextLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        const isValidSeparator = sepCells.every(
          (c) => /^:?-+:?$/.test(c) || c === ''
        );

        if (!isValidSeparator) {
          i++;
          continue;
        }

        const tableRows: { cells: string[] }[] = [];
        let j = i + 2;

        while (j < lines.length) {
          const rowLine = lines[j].trim();
          if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) break;

          const cells = rowLine
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());

          if (cells.every((c) => c === '' || /^-+$/.test(c))) break;

          tableRows.push({ cells });
          j++;
        }

        tables.push({ header: headerCells, rows: tableRows, line: i + 1 });
        i = j;
      } else {
        i++;
      }
    }

    return tables;
  }

  private extractCodeBlocks(content: string): Array<{
    lang: string;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const blocks: Array<{
      lang: string;
      content: string;
      startLine: number;
      endLine: number;
    }> = [];
    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const match = lines[i].match(/^```(\w*)/);
      if (match) {
        const lang = match[1] || 'text';
        const startLine = i + 1;
        const codeLines: string[] = [];
        i++;

        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }

        blocks.push({
          lang,
          content: codeLines.join('\n'),
          startLine,
          endLine: i,
        });
      }

      i++;
    }

    return blocks;
  }

  private extractLinks(content: string): Array<{
    text: string;
    href: string;
    line: number;
    isInternal: boolean;
  }> {
    const links: Array<{
      text: string;
      href: string;
      line: number;
      isInternal: boolean;
    }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lines[i])) !== null) {
        const href = match[2];
        links.push({
          text: match[1],
          href,
          line: i + 1,
          isInternal: !href.startsWith('http://') &&
            !href.startsWith('https://') &&
            !href.startsWith('mailto:') &&
            !href.startsWith('#'),
        });
      }
    }

    return links;
  }

  private findUnresolvedTemplates(content: string): string[] {
    const matches = content.match(/\{\{[^}]+\}\}/g) || [];
    const seen = new Set<string>();
    const results: string[] = [];

    for (const m of matches) {
      if (!seen.has(m)) {
        seen.add(m);
        results.push(m);
      }
    }

    return results;
  }

  private findPlaceholders(content: string): string[] {
    const pattern = /(?:^|[^\w\u4e00-\u9fff])(TBD|TODO|FIXME|TBA|待定|待补充)(?:[^\w\u4e00-\u9fff]|$)/gi;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      matches.push(match[1]);
    }

    return [...new Set(matches)];
  }

  private buildSectionMap(content: string): Map<string, string> {
    const sectionMap = new Map<string, string>();
    const lines = content.split('\n');
    const headingRegex = /^(#{1,3})\s+(.+)$/;
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(headingRegex);

      if (headingMatch) {
        if (currentHeading && currentContent.length > 0) {
          sectionMap.set(currentHeading, currentContent.join('\n').trim());
        }

        currentHeading = headingMatch[2].trim();
        currentContent = [];
      } else if (currentHeading) {
        currentContent.push(line);
      }
    }

    if (currentHeading && currentContent.length > 0) {
      sectionMap.set(currentHeading, currentContent.join('\n').trim());
    }

    return sectionMap;
  }

  private normalizeFieldName(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private addIssue(severity: Severity, code: string, message: string, source?: string, suggestion?: string): void {
    this.issues.push({ severity, code, message, source, suggestion });
  }

  private buildResult(): ValidationResult {
    const errors = this.issues.filter((i) => i.severity === 'error').length;
    const warnings = this.issues.filter((i) => i.severity === 'warn').length;
    const infos = this.issues.filter((i) => i.severity === 'info').length;

    return {
      valid: errors === 0,
      issues: this.issues,
      summary: { errors, warnings, infos },
    };
  }

  private async globFiles(dir: string, pattern: string): Promise<string[]> {
    try {
      const files = await glob(pattern, {
        cwd: dir,
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/skill-dist/**',
          '**/__tests__/**',
          '**/*.test.ts',
          '**/*.test.js',
        ],
      });
      return files.sort();
    } catch {
      return [];
    }
  }

  computeFileHash(filePath: string): string {
    try {
      const content = require('fs').readFileSync(filePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex').slice(0, 16);
    } catch {
      return '';
    }
  }
}
