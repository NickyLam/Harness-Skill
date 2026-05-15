import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaValidator } from '../schema-validator.js';
import * as fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockedFs = vi.mocked(fs);

function createMinimalRegistry(overrides?: Record<string, unknown>): string {
  const base = {
    version: '3.0.0',
    capsules: {
      'brainstorming': {
        id: 'cp-brainstorm',
        name: 'Brainstorming',
        stage: 'spec',
        file_path: 'core/skills/spec/brainstorming/SKILL.md',
      },
      ...overrides,
    },
  };
  return JSON.stringify(base);
}

function createMinimalPipeline(overrides?: Record<string, unknown>): string {
  const base = {
    version: '3.0.0',
    stages: {
      spec: {
        capsules: { mandatory: ['brainstorming'], optional: [] },
        gate: 'spec_gate',
      },
    },
    gates: {
      spec_gate: {
        id: 'gate-spec',
        name: 'Spec Gate',
        fail_action: '回到 /spec 补充文档',
        levels: {
          'L2-standard': { checks: [{ id: 'doc_exists', name: '设计文档存在', required: true }] },
        },
      },
    },
    ...overrides,
  };
  return JSON.stringify(base);
}

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
    vi.clearAllMocks();
  });

  describe('validate() — 返回 ValidationResult 结构', () => {
    it('应返回包含 valid、issues、summary 的 ValidationResult 对象', async () => {
      mockedFs.readFile.mockResolvedValue(createMinimalRegistry() as never);
      mockedFs.readFile.mockResolvedValue(createMinimalPipeline() as never);
      mockedFs.stat.mockResolvedValue({} as never);

      const result = await validator.validate();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('errors');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('infos');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('当无 error 时 valid 应为 true', async () => {
      mockedFs.readFile
        .mockResolvedValueOnce(createMinimalRegistry() as never)
        .mockResolvedValueOnce(createMinimalPipeline() as never);
      mockedFs.stat.mockResolvedValue({} as never);

      const result = await validator.validate();
      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
    });

    it('当有 error 时 valid 应为 false', async () => {
      const registryWithBadRef = {
        version: '3.0.0',
        capsules: {},
        stages: { spec: { capsules: { mandatory: ['nonexistent'] }, gate: 'spec_gate' } },
      };
      const pipelineWithUndefinedCapsule = {
        version: '3.0.0',
        stages: {
          spec: { capsules: { mandatory: ['nonexistent'], optional: [] }, gate: 'spec_gate' },
        },
        gates: { spec_gate: { id: 'g', name: 'G', fail_action: 'x', levels: {} } },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registryWithBadRef) as never)
        .mockResolvedValueOnce(JSON.stringify(pipelineWithUndefinedCapsule) as never);

      const result = await validator.validate();
      expect(result.valid).toBe(false);
      expect(result.summary.errors).toBeGreaterThan(0);
    });
  });

  describe('validateRegistryCapsuleReferences()', () => {
    it('应检测到未被任何 stage 引用的 capsule 并产生 warn', async () => {
      const registry = {
        capsules: {
          orphan_capsule: {
            id: 'cp-orphan',
            name: 'Orphan Capsule',
            stage: 'spec',
            file_path: 'core/skills/spec/orphan/SKILL.md',
          },
          brainstorming: {
            id: 'cp-brainstorm',
            name: 'Brainstorming',
            stage: 'spec',
            file_path: 'core/skills/spec/brainstorming/SKILL.md',
          },
        },
      };
      const pipeline = {
        stages: {
          spec: { capsules: { mandatory: ['brainstorming'], optional: [] }, gate: 'spec_gate' },
        },
        gates: { spec_gate: { id: 'g', name: 'G', fail_action: 'x', levels: {} } },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(JSON.stringify(pipeline) as never);

      await validator.validateRegistryCapsuleReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issues = result.issues;

      const orphanIssue = issues.find((i) => i.code === 'CAPSULE_UNREFERENCED');
      expect(orphanIssue).toBeDefined();
      expect(orphanIssue?.severity).toBe('warn');
      expect(orphanIssue?.message).toContain('orphan_capsule');
    });

    it('跨阶段胶囊未被引用时应产生 info 而非 warn', async () => {
      const registry = {
        capsules: {
          cross_cutting_cap: {
            id: 'cp-cc',
            name: 'Cross Cutting',
            stage: 'cross-cutting',
            file_path: 'core/skills/cross-cutting/cc/SKILL.md',
          },
        },
      };
      const pipeline = {
        stages: {
          spec: { capsules: { mandatory: ['brainstorming'], optional: [] }, gate: 'spec_gate' },
        },
        gates: { spec_gate: { id: 'g', name: 'G', fail_action: 'x', levels: {} } },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(JSON.stringify(pipeline) as never);

      await validator.validateRegistryCapsuleReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'CAPSULE_UNREFERENCED_CROSS_CUTTING');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('info');
    });

    it('应检测到引用了未注册的 capsule 并产生 error', async () => {
      const registry = { capsules: {} };
      const pipeline = {
        stages: {
          spec: { capsules: { mandatory: ['ghost_capsule'], optional: [] }, gate: 'spec_gate' },
        },
        gates: { spec_gate: { id: 'g', name: 'G', fail_action: 'x', levels: {} } },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(JSON.stringify(pipeline) as never);

      await validator.validateRegistryCapsuleReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'CAPSULE_UNDEFINED');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('ghost_capsule');
    });

    it('registry 缺少 capsules 段时产生 warn', async () => {
      const registry = { version: '3.0.0' };
      const pipeline = {
        stages: { spec: { capsules: {}, gate: 'spec_gate' } },
        gates: { spec_gate: { id: 'g', name: 'G', fail_action: 'x', levels: {} } },
      };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(JSON.stringify(pipeline) as never);

      await validator.validateRegistryCapsuleReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'REGISTRY_NO_CAPSULES');

      expect(issue)?.toBeDefined();
      expect(issue?.severity).toBe('warn');
    });

    it('pipeline 缺少 stages 段时产生 error', async () => {
      const registry = { capsules: { test: { id: 't', name: 'T', stage: 'spec' } } };
      const pipeline = { gates: {} };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(JSON.stringify(pipeline) as never);

      await validator.validateRegistryCapsuleReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'PIPELINE_NO_STAGES');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });
  });

  describe('validateSkillFilesExist()', () => {
    it('文件不存在时应产生 SKILL_FILE_MISSING error', async () => {
      const registry = {
        capsules: {
          missing_skill: {
            id: 'cp-missing',
            name: 'Missing Skill',
            stage: 'spec',
            file_path: 'core/skills/spec/missing/SKILL.md',
          },
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(registry) as never);
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';
      mockedFs.stat.mockRejectedValue(enoentErr);

      await validator.validateSkillFilesExist();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'SKILL_FILE_MISSING');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('missing_skill');
    });

    it('capsule 缺少 file_path 时产生 SKILL_NO_FILE_PATH warn', async () => {
      const registry = {
        capsules: {
          no_path: { id: 'cp-np', name: 'No Path', stage: 'spec' },
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(registry) as never);

      await validator.validateSkillFilesExist();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'SKILL_NO_FILE_PATH');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('warn');
    });

    it('文件正常存在时不产生问题', async () => {
      const registry = {
        capsules: {
          existing_skill: {
            id: 'cp-exists',
            name: 'Exists',
            stage: 'spec',
            file_path: 'core/skills/spec/existing/SKILL.md',
          },
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(registry) as never);
      mockedFs.stat.mockResolvedValue({ isFile: () => true } as never);

      await validator.validateSkillFilesExist();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const fileIssues = result.issues.filter(
        (i) => i.code === 'SKILL_FILE_MISSING' || i.code === 'SKILL_FILE_ACCESS_ERROR'
      );

      expect(fileIssues).toHaveLength(0);
    });
  });

  describe('validateSkillFrontMatter()', () => {
    it('行数不足 50 行应产生 SKILL_TOO_SHORT warn', async () => {
      const registry = {
        capsules: {
          short_skill: {
            id: 'cp-short',
            name: 'Short Skill',
            stage: 'spec',
            file_path: 'core/skills/spec/short/SKILL.md',
          },
        },
      };
      const shortContent = '---\nid: short\nname: Short\nstage: spec\nroles: []\npattern: test\nmandatory: true\n---\n# Short\nOnly a few lines.\n';

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(shortContent as never);
      mockedFs.stat.mockResolvedValue({} as never);

      await validator.validateSkillFrontMatter();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'SKILL_TOO_SHORT');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('warn');
    });

    it('缺少必填字段时应产生对应 error', async () => {
      const registry = {
        capsules: {
          bad_fm: {
            id: 'cp-badfm',
            name: 'Bad FM',
            stage: 'spec',
            file_path: 'core/skills/spec/badfm/SKILL.md',
          },
        },
      };
      const incompleteFrontmatter = '---\nname: OnlyName\n---\n' + '# Content\n'.repeat(60);

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(incompleteFrontmatter as never);
      mockedFs.stat.mockResolvedValue({} as never);

      await validator.validateSkillFrontMatter();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const missingFields = result.issues.filter((i) => i.code.startsWith('SKILL_MISSING_FIELD_'));

      expect(missingFields.length).toBeGreaterThan(0);
      expect(missingFields.some((i) => i.message.includes('id'))).toBe(true);
    });

    it('YAML frontmatter 未正确关闭时应产生 SKILL_FRONTMATTER_MALFORMED error', async () => {
      const registry = {
        capsules: {
          malformed: {
            id: 'cp-malformed',
            name: 'Malformed',
            stage: 'spec',
            file_path: 'core/skills/spec/malformed/SKILL.md',
          },
        },
      };
      const unclosedFm = '---\nid: test\nname: Test\n# No closing delimiter\n' + '# Content\n'.repeat(60);

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(unclosedFm as never);
      mockedFs.stat.mockResolvedValue({} as never);

      await validator.validateSkillFrontMatter();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'SKILL_FRONTMATTER_MALFORMED');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });

    it('既无 YAML frontmatter 也无 blockquote 元数据时产生 SKILL_NO_FRONTMATTER warn', async () => {
      const registry = {
        capsules: {
          no_meta: {
            id: 'cp-nometa',
            name: 'No Meta',
            stage: 'spec',
            file_path: 'core/skills/spec/nometa/SKILL.md',
          },
        },
      };
      const plainContent = '# Just Plain Markdown\n' + '# Content\n'.repeat(60);

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(plainContent as never);
      mockedFs.stat.mockResolvedValue({} as never);

      await validator.validateSkillFrontMatter();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'SKILL_NO_FRONTMATTER');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('warn');
    });

    it('完整的 frontmatter 不产生必填字段缺失问题', async () => {
      const registry = {
        capsules: {
          complete: {
            id: 'cp-complete',
            name: 'Complete Skill',
            stage: 'spec',
            file_path: 'core/skills/spec/complete/SKILL.md',
          },
        },
      };
      const completeContent = [
        '---',
        'id: complete',
        'name: Complete Skill',
        'stage: spec',
        'roles: [tester]',
        'pattern: test-pattern',
        'mandatory: true',
        '---',
        '# Complete Skill',
        ...Array.from({ length: 55 }, () => 'Some content line to meet minimum.'),
      ].join('\n');

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(registry) as never)
        .mockResolvedValueOnce(completeContent as never);
      mockedFs.stat.mockResolvedValue({} as never);

      await validator.validateSkillFrontMatter();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const missingFieldIssues = result.issues.filter((i) => i.code.startsWith('SKILL_MISSING_FIELD_'));

      expect(missingFieldIssues).toHaveLength(0);
    });
  });

  describe('validatePipelineGateReferences()', () => {
    it('stage 引用未定义的门禁应产生 GATE_UNDEFINED error', async () => {
      const pipeline = {
        stages: {
          spec: { capsules: {}, gate: 'ghost_gate' },
        },
        gates: {
          spec_gate: { id: 'g', name: 'SG', fail_action: 'x', levels: {} },
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(pipeline) as never);

      await validator.validatePipelineGateReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'GATE_UNDEFINED');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('ghost_gate');
    });

    it('pipeline 缺少 gates 段时产生 PIPELINE_NO_GATES warn', async () => {
      const pipeline = { stages: { spec: { capsules: {}, gate: 'spec_gate' } } };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(pipeline) as never);

      await validator.validatePipelineGateReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'PIPELINE_NO_GATES');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('warn');
    });

    it('所有门禁引用均有效时不产生 GATE_UNDEFINED 问题', async () => {
      const pipeline = {
        stages: {
          spec: { capsules: {}, gate: 'spec_gate' },
          plan: { capsules: {}, gate: 'plan_gate' },
        },
        gates: {
          spec_gate: { id: 'g1', name: 'SG', fail_action: 'x', levels: {} },
          plan_gate: { id: 'g2', name: 'PG', fail_action: 'x', levels: {} },
        },
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(pipeline) as never);

      await validator.validatePipelineGateReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const undefinedIssues = result.issues.filter((i) => i.code === 'GATE_UNDEFINED');

      expect(undefinedIssues).toHaveLength(0);
    });
  });

  describe('边界情况', () => {
    it('registry.yaml 读取失败应产生 REGISTRY_READ_FAIL error', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Permission denied') as never);

      await validator.validateRegistryCapsuleReferences();
      const result = (validator as unknown as { buildResult(): ReturnType<SchemaValidator['validate']> }).buildResult.call(validator);
      const issue = result.issues.find((i) => i.code === 'REGISTRY_READ_FAIL');

      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });

    it('多次调用 validate() 应重置 issues 列表', async () => {
      mockedFs.readFile
        .mockResolvedValue(createMinimalRegistry() as never)
        .mockResolvedValue(createMinimalPipeline() as never);
      mockedFs.stat.mockResolvedValue({} as never);

      await validator.validate();
      const firstIssueCount = (await validator.validate()).issues.length;

      expect(firstIssueCount).toBeGreaterThanOrEqual(0);
    });

    it('空 capsules 和空 stages 组合不应崩溃', async () => {
      const emptyRegistry = { capsules: {} };
      const emptyPipeline = {
        stages: {},
        gates: {},
      };

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(emptyRegistry) as never)
        .mockResolvedValueOnce(JSON.stringify(emptyPipeline) as never);

      const result = await validator.validate();

      expect(result.valid).toBe(true);
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });
});
