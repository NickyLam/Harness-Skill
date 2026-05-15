import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SyncValidator } from '../sync-validator.js';

vi.mock('node:fs/promises');
vi.mock('glob', () => ({ glob: vi.fn() }));

const mockedFs = vi.mocked(fs);

let mockedGlob: ReturnType<typeof vi.fn>;

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(TEST_DIR, '..', '..', '..');
const MOCK_CORE_DIR = join(PROJECT_ROOT, 'core');
const MOCK_DIST_DIR = join(PROJECT_ROOT, 'skill-dist');

beforeAll(async () => {
  const globModule = await import('glob');
  mockedGlob = vi.mocked(globModule.glob);
});

function createMockFileContent(suffix: string): string {
  return `# Test File ${suffix}\n\nContent for ${suffix}.\n` + 'Line\n'.repeat(20);
}

describe('SyncValidator', () => {
  let validator: SyncValidator;

  beforeEach(() => {
    validator = new SyncValidator();
    vi.clearAllMocks();
    mockedGlob.mockResolvedValue([]);
  });

  describe('validate() — 返回 SyncValidationResult 结构', () => {
    it('应返回包含 SyncValidationResult 扩展字段的结果', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValueOnce(dirStat as never)
        .mockResolvedValueOnce(dirStat as never);

      const result = await validator.validate();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('coreOnlyFiles');
      expect(result).toHaveProperty('distOnlyFiles');
      expect(result).toHaveProperty('contentDiffs');
      expect(result).toHaveProperty('syncScore');
      expect(Array.isArray(result.coreOnlyFiles)).toBe(true);
      expect(Array.isArray(result.distOnlyFiles)).toBe(true);
      expect(Array.isArray(result.contentDiffs)).toBe(true);
      expect(typeof result.syncScore).toBe('number');
    });
  });

  describe('core/ 目录缺失', () => {
    it('应产生 SYNC_CORE_MISSING error', async () => {
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';
      mockedFs.stat.mockRejectedValue(enoentErr);

      const result = await validator.validate();

      const issue = result.issues.find(i => i.code === 'SYNC_CORE_MISSING');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
      expect(result.coreOnlyFiles).toHaveLength(0);
    });
  });

  describe('skill-dist/ 目录缺失', () => {
    it('应产生 SYNC_DIST_MISSING warn（不阻塞）', async () => {
      const dirStat = { isDirectory: () => true };
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';

      mockedFs.stat
        .mockResolvedValueOnce(dirStat as never)
        .mockRejectedValueOnce(enoentErr);

      const result = await validator.validate();

      const issue = result.issues.find(i => i.code === 'SYNC_DIST_MISSING');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('warn');
      expect(result.valid).toBe(true);
    });
  });

  describe('文件一致性比对', () => {
    it('glob 模式不应把扩展名前的点放进 brace，否则真实文件匹配为 0', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      await validator.validate();

      expect(mockedGlob).toHaveBeenCalledWith(
        '**/*.{md,yaml,yml,json,ts,sh}',
        expect.objectContaining({ cwd: MOCK_CORE_DIR })
      );
      expect(mockedGlob).toHaveBeenCalledWith(
        '**/*.{md,yaml,yml,json,ts,sh}',
        expect.objectContaining({ cwd: MOCK_DIST_DIR })
      );
    });

    it('应将 core/skills/<stage>/<id>/... 映射到 skill-dist/capsules/<id>/...', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const commonContent = createMockFileContent('mapped');
      mockedFs.readFile.mockResolvedValue(commonContent as never);

      mockedGlob
        .mockResolvedValueOnce([
          join(MOCK_CORE_DIR, 'skills/build/tdd/SKILL.md'),
          join(MOCK_CORE_DIR, 'skills/build/tdd/references/tdd-patterns.md'),
        ])
        .mockResolvedValueOnce([
          join(MOCK_DIST_DIR, 'capsules/tdd/SKILL.md'),
          join(MOCK_DIST_DIR, 'capsules/tdd/references/tdd-patterns.md'),
        ]);

      const result = await validator.validate();

      expect(result.coreOnlyFiles).toHaveLength(0);
      expect(result.distOnlyFiles).toHaveLength(0);
      expect(result.contentDiffs).toHaveLength(0);
      expect(result.syncScore).toBe(100);
    });

    it('应将 deep-requirements modules 映射到同名顶层 capsule', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const commonContent = createMockFileContent('module');
      mockedFs.readFile.mockResolvedValue(commonContent as never);

      mockedGlob
        .mockResolvedValueOnce([
          join(MOCK_CORE_DIR, 'skills/spec/deep-requirements/modules/business-rules/SKILL.md'),
        ])
        .mockResolvedValueOnce([
          join(MOCK_DIST_DIR, 'capsules/business-rules/SKILL.md'),
        ]);

      const result = await validator.validate();

      expect(result.coreOnlyFiles).toHaveLength(0);
      expect(result.distOnlyFiles).toHaveLength(0);
      expect(result.contentDiffs).toHaveLength(0);
    });

    it('内容完全一致时 syncScore 应为 100%', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const commonContent = createMockFileContent('common');

      mockedFs.readFile.mockResolvedValue(commonContent as never);

      const testRelPath = 'skills/test/SKILL.md';
      mockedGlob
        .mockResolvedValueOnce([join(MOCK_CORE_DIR, testRelPath)])
        .mockResolvedValueOnce([join(MOCK_DIST_DIR, testRelPath)]);

      const result = await validator.validate();

      expect(result.contentDiffs).toHaveLength(0);
      expect(result.syncScore).toBe(100);
      expect(result.coreOnlyFiles).toHaveLength(0);
      expect(result.distOnlyFiles).toHaveLength(0);
    });

    it('内容不一致时应报告差异并降低 syncScore', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const coreContent = createMockFileContent('core-v2');
      const distContent = createMockFileContent('dist-v1');

      let readCallCount = 0;
      mockedFs.readFile.mockImplementation(async () => {
        readCallCount++;
        return readCallCount % 2 === 1 ? coreContent : distContent;
      });

      mockedGlob
        .mockResolvedValueOnce([join(MOCK_CORE_DIR, 'skills/test/SKILL.md')])
        .mockResolvedValueOnce([join(MOCK_DIST_DIR, 'skills/test/SKILL.md')]);

      const result = await validator.validate();

      expect(result.contentDiffs.length).toBeGreaterThan(0);
      expect(result.syncScore).toBeLessThan(100);
      expect(result.coreOnlyFiles).toHaveLength(0);
      expect(result.distOnlyFiles).toHaveLength(0);

      const mismatchIssue = result.issues.find(i => i.code === 'SYNC_CONTENT_MISMATCH');
      expect(mismatchIssue).toBeDefined();
      expect(mismatchIssue?.severity).toBe('error');
    });

    it('core/ 独有文件应产生 SYNC_CORE_ONLY warn', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const contentA = createMockFileContent('a');
      mockedFs.readFile.mockResolvedValue(contentA as never);

      // core 有3个文件，dist 只有1个（test-a 匹配，其余 core-only）
      mockedGlob
        .mockResolvedValueOnce([
          join(MOCK_CORE_DIR, 'skills/test-a/SKILL.md'),
          join(MOCK_CORE_DIR, 'skills/test-b/SKILL.md'),
          join(MOCK_CORE_DIR, 'engine/types.ts'),
        ])
        .mockResolvedValueOnce([
          join(MOCK_DIST_DIR, 'skills/test-a/SKILL.md'),
        ]);

      const result = await validator.validate();

      expect(result.coreOnlyFiles.length).toBeGreaterThan(0);

      const coreOnlyIssue = result.issues.find(i => i.code === 'SYNC_CORE_ONLY');
      expect(coreOnlyIssue).toBeDefined();
      expect(coreOnlyIssue?.severity).toBe('warn');
    });

    it('skill-dist/ 独有文件应产生 SYNC_DIST_ONLY warn', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const contentA = createMockFileContent('a');
      mockedFs.readFile.mockResolvedValue(contentA as never);

      // core 只有 test-a，dist 有 test-a + 2个额外文件
      mockedGlob
        .mockResolvedValueOnce([
          join(MOCK_CORE_DIR, 'skills/test-a/SKILL.md'),
        ])
        .mockResolvedValueOnce([
          join(MOCK_DIST_DIR, 'skills/test-a/SKILL.md'),
          join(MOCK_DIST_DIR, 'gating/config.yaml'),
        ]);

      const result = await validator.validate();

      expect(result.distOnlyFiles.length).toBeGreaterThan(0);

      const distOnlyIssue = result.issues.find(i => i.code === 'SYNC_DIST_ONLY');
      expect(distOnlyIssue).toBeDefined();
      expect(distOnlyIssue?.severity).toBe('warn');
    });

    it('低同步率 (<80%) 应产生 SYNC_LOW_SCORE warn', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const coreFiles = Array.from({ length: 5 }, (_, i) =>
        join(MOCK_CORE_DIR, `skills/file${i}/SKILL.md`)
      );
      const distFiles = coreFiles.map(f =>
        f.replace(MOCK_CORE_DIR, MOCK_DIST_DIR)
      );

      mockedGlob
        .mockResolvedValueOnce(coreFiles)
        .mockResolvedValueOnce(distFiles);

      let readCallCount = 0;
      mockedFs.readFile.mockImplementation(async () => {
        readCallCount++;
        if (readCallCount <= 6) {
          return createMockFileContent(`diff-${readCallCount}`);
        }
        return createMockFileContent('same');
      });

      const result = await validator.validate();

      expect(result.syncScore).toBeLessThan(80);

      const lowScoreIssue = result.issues.find(i => i.code === 'SYNC_LOW_SCORE');
      expect(lowScoreIssue).toBeDefined();
      expect(lowScoreIssue?.severity).toBe('warn');
    });
  });

  describe('entrypoint validation', () => {
    function validRootSkill(version = '3.2.0'): string {
      return `---\nname: harness-engineering-skill\ndescription: "Use when the user asks to run a disciplined software delivery workflow."\n---\n\n# Harness\n\nVersion: ${version}\n\nRead \`core/pipeline.yaml\`.\n`;
    }

    function validDistSkill(version = '3.2.0'): string {
      return `---\nname: harness-engineering-skill\ndescription: "Use when the user asks to run a disciplined software delivery workflow."\n---\n\n# Harness\n\nVersion: ${version}\n\nRead \`capsules/tdd/SKILL.md\`.\n`;
    }

    it('validates entrypoint descriptions, paths, metadata, and aligned versions', async () => {
      const statOk = { isDirectory: () => true } as import('node:fs').Stats;
      mockedFs.stat.mockResolvedValue(statOk as never);
      mockedGlob.mockResolvedValue([]);
      mockedFs.readFile.mockImplementation(async (path) => {
        const p = String(path);
        if (p.endsWith('/SKILL.md') && !p.includes('/skill-dist/')) return validRootSkill();
        if (p.endsWith('/skill-dist/SKILL.md')) return validDistSkill();
        if (p.endsWith('/package.json')) return JSON.stringify({ version: '3.2.0' });
        return createMockFileContent('other');
      });

      const result = await validator.validate();

      expect(result.issues.find(i => i.code === 'ENTRYPOINT_BROKEN_PATH')).toBeUndefined();
      expect(result.issues.find(i => i.code === 'ENTRYPOINT_VERSION_MISMATCH')).toBeUndefined();
      expect(result.issues.find(i => i.code === 'OPENAI_METADATA_MISSING')).toBeUndefined();
    });

    it('reports broken paths referenced from the entrypoint router', async () => {
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';

      mockedFs.stat.mockImplementation(async (path) => {
        const p = String(path);
        if (p.endsWith('/skills/missing/SKILL.md')) throw enoentErr;
        return { isDirectory: () => true } as import('node:fs').Stats;
      });
      mockedGlob.mockResolvedValue([]);
      mockedFs.readFile.mockImplementation(async (path) => {
        const p = String(path);
        if (p.endsWith('/SKILL.md') && !p.includes('/skill-dist/')) {
          return validRootSkill().replace('`core/pipeline.yaml`', '`skills/missing/SKILL.md`');
        }
        if (p.endsWith('/skill-dist/SKILL.md')) return validDistSkill();
        if (p.endsWith('/package.json')) return JSON.stringify({ version: '3.2.0' });
        return createMockFileContent('other');
      });

      const result = await validator.validate();

      const issue = result.issues.find(i => i.code === 'ENTRYPOINT_BROKEN_PATH');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });

    it('reports version mismatches across root, dist, and package metadata', async () => {
      const statOk = { isDirectory: () => true } as import('node:fs').Stats;
      mockedFs.stat.mockResolvedValue(statOk as never);
      mockedGlob.mockResolvedValue([]);
      mockedFs.readFile.mockImplementation(async (path) => {
        const p = String(path);
        if (p.endsWith('/SKILL.md') && !p.includes('/skill-dist/')) return validRootSkill('3.2.0');
        if (p.endsWith('/skill-dist/SKILL.md')) return validDistSkill('3.1.0');
        if (p.endsWith('/package.json')) return JSON.stringify({ version: '3.2.0' });
        return createMockFileContent('other');
      });

      const result = await validator.validate();

      const issue = result.issues.find(i => i.code === 'ENTRYPOINT_VERSION_MISMATCH');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });
  });

  describe('validateSpecificFile() — 单文件校验', () => {
    it('两边都存在且一致时返回 isConsistent=true', async () => {
      const fileContent = createMockFileContent('test');
      mockedFs.readFile
        .mockResolvedValueOnce(fileContent as never)
        .mockResolvedValueOnce(fileContent as never);

      const fileStat = {} as import('node:fs').Stats;
      mockedFs.stat
        .mockResolvedValueOnce(fileStat as never)
        .mockResolvedValueOnce(fileStat as never);

      const result = await validator.validateSpecificFile('skills/test/SKILL.md');

      expect(result.inCore).toBe(true);
      expect(result.inDist).toBe(true);
      expect(result.isConsistent).toBe(true);
      expect(result.diff).toBeUndefined();
    });

    it('两边都存在但不一致时返回 diff 详情', async () => {
      const coreContent = createMockFileContent('core-new');
      const distContent = createMockFileContent('dist-old');

      mockedFs.readFile
        .mockResolvedValueOnce(coreContent as never)
        .mockResolvedValueOnce(distContent as never);

      const fileStat = {} as import('node:fs').Stats;
      mockedFs.stat
        .mockResolvedValueOnce(fileStat as never)
        .mockResolvedValueOnce(fileStat as never);

      const result = await validator.validateSpecificFile('skills/test/SKILL.md');

      expect(result.inCore).toBe(true);
      expect(result.inDist).toBe(true);
      expect(result.isConsistent).toBe(false);
      expect(result.diff).toBeDefined();
      expect(result.diff!.file).toBe('skills/test/SKILL.md');
      expect(result.diff!.coreHash).not.toBe(result.diff!.distHash);
    });

    it('仅在 core 中存在时 inCore=true, inDist=false', async () => {
      const fileStat = {} as import('node:fs').Stats;
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';

      mockedFs.stat
        .mockResolvedValueOnce(fileStat as never)
        .mockRejectedValueOnce(enoentErr);

      const result = await validator.validateSpecificFile('skills/orphan/SKILL.md');

      expect(result.inCore).toBe(true);
      expect(result.inDist).toBe(false);
      expect(result.isConsistent).toBe(false);
    });

    it('两边都不存在时 isConsistent=null', async () => {
      const enoentErr = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentErr.code = 'ENOENT';
      mockedFs.stat.mockRejectedValue(enoentErr);

      const result = await validator.validateSpecificFile('nonexistent/file.md');

      expect(result.inCore).toBe(false);
      expect(result.inDist).toBe(false);
      expect(result.isConsistent).toBeNull();
    });
  });

  describe('getSyncReport() — 同步报告', () => {
    it('应返回同步统计信息', async () => {
      const dirStat = { isDirectory: true, mtime: new Date() } as unknown as import('node:fs').Stats;
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      mockedGlob
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) =>
          join(MOCK_CORE_DIR, `file${i}.md`)
        ))
        .mockResolvedValueOnce(Array.from({ length: 8 }, (_, i) =>
          join(MOCK_DIST_DIR, `file${i}.md`)
        ));

      const report = await validator.getSyncReport();

      expect(report.totalCoreFiles).toBe(10);
      expect(report.totalDistFiles).toBe(8);
      expect(report.comparablePairs).toBe(8);
      expect(report.lastSyncTime).toBeDefined();
    });
  });

  describe('自定义选项', () => {
    it('ignorePatterns 应过滤匹配的文件', async () => {
      const v = new SyncValidator({
        ignorePatterns: [/test-b/, /types\.ts$/],
      });

      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const contentA = createMockFileContent('a');
      mockedFs.readFile.mockResolvedValue(contentA as never);

      mockedGlob
        .mockResolvedValueOnce([
          join(MOCK_CORE_DIR, 'skills/test-a/SKILL.md'),
          join(MOCK_CORE_DIR, 'skills/test-b/SKILL.md'),
          join(MOCK_CORE_DIR, 'engine/types.ts'),
        ])
        .mockResolvedValueOnce([
          join(MOCK_DIST_DIR, 'skills/test-a/SKILL.md'),
        ]);

      const result = await v.validate();

      expect(result.coreOnlyFiles.some(f => f.includes('test-b'))).toBe(false);
      expect(result.coreOnlyFiles.some(f => f.includes('types.ts'))).toBe(false);
    });

    it('compareExtensions 应限制比较的文件类型', async () => {
      const v = new SyncValidator({
        compareExtensions: ['.md'],
      });

      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      const content = createMockFileContent('x');
      mockedFs.readFile.mockResolvedValue(content as never);

      mockedGlob
        .mockResolvedValueOnce([join(MOCK_CORE_DIR, 'file.md')])
        .mockResolvedValueOnce([join(MOCK_DIST_DIR, 'file.md')]);

      const result = await v.validate();

      expect(result.syncScore).toBe(100);
    });
  });

  describe('边界情况', () => {
    it('文件读取错误不应崩溃，应产生 warn', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      mockedFs.readFile.mockRejectedValue(new Error('Permission denied'));

      mockedGlob
        .mockResolvedValueOnce([join(MOCK_CORE_DIR, 'file.md')])
        .mockResolvedValueOnce([join(MOCK_DIST_DIR, 'file.md')]);

      const result = await validator.validate();

      expect(result).toHaveProperty('valid');
      const errorIssues = result.issues.filter(i => i.severity === 'error' && i.code !== 'SYNC_CONTENT_MISMATCH');
      expect(errorIssues.length).toBe(0);
    });

    it('多次调用 validate() 应重置 issues', async () => {
      const dirStat = { isDirectory: () => true };
      mockedFs.stat
        .mockResolvedValue(dirStat as never)
        .mockResolvedValue(dirStat as never);

      mockedGlob.mockResolvedValue([]);

      const r1 = await validator.validate();
      const r2 = await validator.validate();

      expect(r1.issues.length).toEqual(r2.issues.length);
    });
  });
});
