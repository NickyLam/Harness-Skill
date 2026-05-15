import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillLoader } from '../skill-loader.js';
import * as fs from 'node:fs/promises';
import type { SkillManifest } from '../types.js';

vi.mock('node:fs/promises');

const mockedFs = vi.mocked(fs);

function createValidSkillContent(overrides?: Record<string, string>): string {
  const defaults = {
    id: 'test-skill',
    name: 'Test Skill',
    stage: 'spec',
    roles: '["product-owner"]',
    pattern: 'test-pattern',
    mandatory: 'true',
  };
  const merged = { ...defaults, ...overrides };
  const fmLines = Object.entries(merged).map(([k, v]) => `${k}: ${v}`);
  const frontmatter = ['---', ...fmLines, '---'].join('\n');
  const body = [
    '# Test Skill',
    '',
    '## 执行流程',
    '',
    '### Step 1: 初始化',
    '- 准备工作',
    '',
    '### Step 2: 执行',
    '- 核心逻辑',
    '',
    '## 产出物',
    '- 设计文档',
    '- 验收标准',
    '',
    ...Array.from({ length: 45 }, (_, i) => `Content line ${i + 1} to meet minimum length.`),
  ].join('\n');
  return frontmatter + '\n' + body;
}

function createRegistryContent(capsules: Record<string, Record<string, unknown>>): string {
  return JSON.stringify({ version: '3.0.0', capsules });
}

describe('SkillLoader', () => {
  let loader: SkillLoader;

  beforeEach(() => {
    loader = new SkillLoader();
    vi.clearAllMocks();
  });

  describe('loadAll() — 加载所有注册的 skills', () => {
    it('应返回 SkillManifest 数组', async () => {
      const registry = {
        'brainstorming': {
          name: 'Brainstorming',
          stage: 'spec',
          file_path: 'core/skills/spec/brainstorming/SKILL.md',
        },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent() as never);
      mockedFs.stat
        .mockResolvedValueOnce({ isDirectory: () => false } as never)
        .mockResolvedValueOnce({ isDirectory: () => false } as never);

      const manifests = await loader.loadAll();

      expect(Array.isArray(manifests)).toBe(true);
      expect(manifests.length).toBeGreaterThan(0);
      expect(manifests[0]).toHaveProperty('id');
      expect(manifests[0]).toHaveProperty('name');
      expect(manifests[0]).toHaveProperty('stage');
    });

    it('应加载 registry 中所有 capsule 对应的 skill', async () => {
      const registry = {
        skill_a: { name: 'Skill A', stage: 'spec', file_path: 'skills/a/SKILL.md' },
        skill_b: { name: 'Skill B', stage: 'build', file_path: 'skills/b/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 'skill_a', name: 'Skill A' }) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 'skill_b', name: 'Skill B' }) as never);
      mockedFs.stat
        .mockResolvedValue({ isDirectory: () => false } as never);

      const manifests = await loader.loadAll();

      expect(manifests).toHaveLength(2);
      const ids = manifests.map((m) => m.id);
      expect(ids).toContain('skill_a');
      expect(ids).toContain('skill_b');
    });

    it('registry.yaml 缺少 capsules 段时应抛出错误', async () => {
      mockedFs.readFile.mockResolvedValue(JSON.stringify({ version: '3.0.0' }) as never);

      await expect(loader.loadAll()).rejects.toThrow('capsules');
    });

    it('registry.yaml 不是有效 YAML 时应抛出错误', async () => {
      mockedFs.readFile.mockResolvedValue('[[[invalid yaml' as never);

      await expect(loader.loadAll()).rejects.toThrow('Invalid YAML');
    });
  });

  describe('getManifest(id) — 按 id 查找', () => {
    it('已加载的 manifest 应能通过 id 查到', async () => {
      const registry = {
        my_skill: { name: 'My Skill', stage: 'spec', file_path: 'skills/my/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 'my_skill', name: 'My Skill' }) as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('my_skill');

      expect(manifest).toBeDefined();
      expect(manifest?.id).toBe('my_skill');
      expect(manifest?.name).toBe('My Skill');
    });

    it('未注册的 id 应返回 undefined', async () => {
      const registry = {
        existing: { name: 'Existing', stage: 'spec', file_path: 'skills/ex/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 'existing' }) as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const result = loader.getManifest('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllManifests() — 返回全部', () => {
    it('应返回与 loadAll 相同的结果', async () => {
      const registry = {
        s1: { name: 'S1', stage: 'spec', file_path: 's1/SKILL.md' },
        s2: { name: 'S2', stage: 'build', file_path: 's2/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 's1' }) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 's2' }) as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      const loaded = await loader.loadAll();
      const all = loader.getAllManifests();

      expect(all).toEqual(loaded);
      expect(all).toHaveLength(2);
    });
  });

  describe('getValidationResult() — 返回校验结果', () => {
    it('应返回 ValidationResult 结构', async () => {
      const registry = {
        ok_skill: { name: 'OK', stage: 'spec', file_path: 'ok/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent() as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const result = loader.getValidationResult();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('errors');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('infos');
    });

    it('行数不足 50 行时产生 warn 级别 issue', async () => {
      const shortContent = [
        '---',
        'id: short',
        'name: Short Skill',
        'stage: spec',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Short',
        ...Array.from({ length: 10 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        short_skill: { name: 'Short', stage: 'spec', file_path: 'short/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(shortContent as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const result = loader.getValidationResult();

      const shortIssue = result.issues.find((i) => i.code === 'SKILL_TOO_SHORT');
      expect(shortIssue).toBeDefined();
      expect(shortIssue?.severity).toBe('warn');
    });

    it('缺少必填字段时产生 warn 级别 issue', async () => {
      const incompleteFm = [
        '---',
        'id: incomplete',
        '---',
        '# Incomplete',
        ...Array.from({ length: 55 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        incomplete: { name: 'Incomplete', stage: 'spec', file_path: 'inc/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(incompleteFm as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const result = loader.getValidationResult();

      const missingFields = result.issues.filter((i) => i.code === 'MISSING_FRONTMATTER_FIELD');
      expect(missingFields.length).toBeGreaterThan(0);
    });
  });

  describe('frontmatter 解析正确性', () => {
    it('YAML frontmatter 字段应正确解析到 manifest', async () => {
      const content = createValidSkillContent({
        id: 'fm-test',
        name: 'FM Test Skill',
        stage: 'plan',
        roles: '["architect", "reviewer"]',
        pattern: 'task-decomposition',
        mandatory: 'false',
        version: '2.5.0',
      });

      const registry = {
        fm_test: { name: 'FM Test', stage: 'plan', file_path: 'fmt/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(content as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('fm_test');

      expect(manifest).toBeDefined();
      expect(manifest?.name).toBe('FM Test Skill');
      expect(manifest?.stage).toBe('plan');
      expect(manifest?.roles).toEqual(['architect', 'reviewer']);
      expect(manifest?.pattern).toBe('task-decomposition');
      expect(manifest?.mandatory).toBe(false);
      expect(manifest?.version).toBe('2.5.0');
    });

    it('无 frontmatter 时使用 capsule 元数据作为回退', async () => {
      const noFmContent = '# No Frontmatter\n' + 'Content\n'.repeat(60);

      const registry = {
        no_fm: { name: 'Fallback Name', stage: 'build', file_path: 'nofm/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(noFmContent as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('no_fm');

      expect(manifest).toBeDefined();
      expect(manifest?.name).toBe('Fallback Name');
      expect(manifest?.stage).toBe('build');
    });
  });

  describe('process steps 提取', () => {
    it('应正确提取 ### Step N: 格式的步骤', async () => {
      const contentWithSteps = [
        '---',
        'id: step-test',
        'name: Step Test',
        'stage: spec',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Step Test',
        '',
        '## 执行流程',
        '',
        '### Step 1: 分析需求',
        '- 收集信息',
        '',
        '### Step 2: 设计方案',
        '- 制定方案',
        '',
        '### Step 3: 实施验证',
        '- 执行并验证',
        '',
        ...Array.from({ length: 45 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        step_test: { name: 'Step Test', stage: 'spec', file_path: 'st/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(contentWithSteps as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('step_test');

      expect(manifest?.process).toHaveLength(3);
      expect(manifest?.process[0].step).toBe(1);
      expect(manifest?.process[0].name).toBe('分析需求');
      expect(manifest?.process[1].step).toBe(2);
      expect(manifest?.process[1].name).toBe('设计方案');
      expect(manifest?.process[2].step).toBe(3);
      expect(manifest?.process[2].name).toBe('实施验证');
    });

    it('有 ## 执行流程 但无 Step 格式时提供兜底步骤', async () => {
      const contentWithSectionOnly = [
        '---',
        'id: section-only',
        'name: Section Only',
        'stage: spec',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Title',
        '',
        '## 执行流程',
        'Some description here.',
        '',
        ...Array.from({ length: 50 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        section_only: { name: 'Section Only', stage: 'spec', file_path: 'so/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(contentWithSectionOnly as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('section_only');

      expect(manifest?.process).toHaveLength(1);
      expect(manifest?.process[0].name).toBe('执行流程');
    });

    it('常见流程标题应作为兜底流程段识别', async () => {
      const contentWithWorkflowSection = [
        '---',
        'id: workflow-section',
        'name: Workflow Section',
        'stage: build',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Title',
        '',
        '## 完整执行流程',
        '',
        '### PHASE 4: 深度分析',
        '- 分析内容',
        '',
        ...Array.from({ length: 50 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        workflow_section: { name: 'Workflow Section', stage: 'build', file_path: 'wf/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(contentWithWorkflowSection as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('workflow_section');

      expect(manifest?.process).toHaveLength(1);
      expect(manifest?.process[0].name).toBe('完整执行流程');
    });
  });

  describe('outputs 提取', () => {
    it('应从 ## 产出物 列表项中提取输出', async () => {
      const contentWithOutputs = [
        '---',
        'id: output-test',
        'name: Output Test',
        'stage: spec',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Output Test',
        '',
        '## 产出物',
        '- design-doc.md',
        '- acceptance-criteria.md',
        '- mermaid-diagram.mmd',
        '',
        ...Array.from({ length: 50 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        output_test: { name: 'Output Test', stage: 'spec', file_path: 'ot/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(contentWithOutputs as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('output_test');

      expect(manifest?.output).toContain('- design-doc.md');
      expect(manifest?.output).toContain('- acceptance-criteria.md');
      expect(manifest?.output).toContain('- mermaid-diagram.mmd');
      expect(manifest?.output).toHaveLength(3);
    });

    it('无 ## 产出物 时尝试从 output: 字段提取', async () => {
      const contentWithOutputField = [
        '---',
        'id: field-output',
        'name: Field Output',
        'stage: spec',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Field Output',
        '',
        'output: some-output-file.txt',
        '',
        ...Array.from({ length: 50 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        field_output: { name: 'Field Output', stage: 'spec', file_path: 'fo/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(contentWithOutputField as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('field_output');

      expect(manifest?.output).toContain('some-output-file.txt');
    });

    it('正文无产出声明时应使用 registry output 作为 fallback', async () => {
      const contentWithoutOutput = [
        '---',
        'id: registry-output',
        'name: Registry Output',
        'stage: spec',
        'roles: "[]"',
        'pattern: test',
        'mandatory: true',
        '---',
        '# Registry Output',
        '',
        '## 执行流程',
        '',
        '### Step 1: 执行',
        '',
        ...Array.from({ length: 50 }, (_, i) => `Line ${i}`),
      ].join('\n');

      const registry = {
        registry_output: {
          name: 'Registry Output',
          stage: 'spec',
          file_path: 'ro/SKILL.md',
          output: ['.harness/specs/example.md', '.harness/specs/example.feature'],
        },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(contentWithoutOutput as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('registry_output');

      expect(manifest?.output).toEqual(['.harness/specs/example.md', '.harness/specs/example.feature']);
    });
  });

  describe('manifest 属性完整性', () => {
    it('manifest 应包含所有必需属性', async () => {
      const registry = {
        full_test: { name: 'Full Test', stage: 'spec', file_path: 'ft/SKILL.md' },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 'full_test' }) as never);
      mockedFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as never)
        .mockResolvedValueOnce({ isDirectory: () => true } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('full_test') as SkillManifest;

      const expectedKeys: (keyof SkillManifest)[] = [
        'id', 'name', 'stage', 'roles', 'pattern', 'mandatory',
        'depends', 'version', 'process', 'output', 'contentHash',
        'filePath', 'hasAssets', 'hasReferences', 'lineCount',
      ];
      for (const key of expectedKeys) {
        expect(manifest).toHaveProperty(key);
      }
      expect(typeof manifest.contentHash).toBe('string');
      expect(typeof manifest.lineCount).toBe('number');
      expect(typeof manifest.hasAssets).toBe('boolean');
      expect(typeof manifest.hasReferences).toBe('boolean');
    });

    it('contentHash 应基于内容生成非空字符串', async () => {
      const registry = { hash_test: { name: 'Hash Test', stage: 'spec', file_path: 'ht/SKILL.md' } };

      mockedFs.readFile
        .mockResolvedValueOnce(createRegistryContent(registry) as never)
        .mockResolvedValueOnce(createValidSkillContent({ id: 'hash_test' }) as never);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as never);

      await loader.loadAll();
      const manifest = loader.getManifest('hash_test');

      expect(manifest?.contentHash).toBeTruthy();
      expect(manifest?.contentHash.length).toBeGreaterThan(0);
    });
  });
});
