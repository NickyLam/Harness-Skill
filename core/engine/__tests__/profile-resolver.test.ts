import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileResolver } from '../profile-resolver.js';
import * as fsAsync from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockedFsAsync = vi.mocked(fsAsync);

function createEnoentError(): NodeJS.ErrnoException {
  const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return err;
}

function createProfileYaml(overrides?: Record<string, unknown>): string {
  const base = {
    id: 'test-profile',
    name: 'Test Profile',
    version: '1.0.0',
    priority: 50,
    build: {
      typecheck_command: 'tsc --noEmit',
      build_command: 'npm run build',
      test_command: 'npm test',
      test_coverage_command: '',
      lint_command: 'eslint src/',
      coverage_threshold: 80,
      strict_coverage_threshold: 90,
    },
    tdd: { test_template: '' },
    e2e: {
      framework: 'playwright',
      dev_server_start: 'npm run dev',
      dev_server_port: 5173,
    },
    template: null,
    detection_files: ['package.json'],
    ...overrides,
  };
  return JSON.stringify(base);
}

describe('ProfileResolver', () => {
  let resolver: ProfileResolver;

  beforeEach(() => {
    resolver = new ProfileResolver();
    vi.clearAllMocks();

    mockedFsAsync.stat.mockRejectedValue(createEnoentError());
    mockedFsAsync.readFile.mockResolvedValue('');
    mockedFsAsync.readdir.mockResolvedValue([]);
  });

  describe('resolve() — 返回 DetectionResult', () => {
    it('应返回包含 profile、detectionMethod、confidence 的 DetectionResult', async () => {
      const result = await resolver.resolve('/tmp/test-project');

      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('detectionMethod');
      expect(result).toHaveProperty('confidence');
      expect(['explicit', 'auto', 'fallback']).toContain(result.detectionMethod);
    });
  });

  describe('显式配置优先级最高 — .harness/config.yaml 中指定 tech_profile', () => {
    it('config.yaml 存在且包含 tech_profile 时应使用 explicit 检测方式', async () => {
      const configYaml = JSON.stringify({ tech_profile: 'react-typescript' });
      const profileYaml = createProfileYaml({
        id: 'react-typescript',
        name: 'React + TypeScript + Vite',
        priority: 100,
        detection_files: ['package.json', 'tsconfig.json'],
      });

      const statMock = mockedFsAsync.stat.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('.harness') && p.includes('config.yaml')) return Promise.resolve({} as any);
        if (p.includes('react-typescript.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });

      const readMock = mockedFsAsync.readFile.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('config.yaml')) return Promise.resolve(configYaml);
        if (p.includes('react-typescript')) return Promise.resolve(profileYaml);
        return Promise.resolve('');
      });

      mockedFsAsync.readdir.mockResolvedValue([
        'generic.yaml',
        'react-typescript.yaml',
        'python.yaml',
      ]);

      const result = await resolver.resolve('/tmp/project');

      expect(result.detectionMethod).toBe('explicit');
      expect(result.confidence).toBe(100);
      expect(result.profile.id).toBe('react-typescript');

      statMock.mockRestore();
      readMock.mockRestore();
    });

    it('config.yaml 存在但 tech_profile 为空时应走自动检测流程', async () => {
      const configYaml = JSON.stringify({ other_setting: 'value' });

      mockedFsAsync.stat.mockImplementation((path: string) => {
        if (String(path).includes('config.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });
      mockedFsAsync.readFile.mockImplementation((path: string) => {
        if (String(path).includes('config.yaml')) return Promise.resolve(configYaml);
        return Promise.resolve('');
      });

      const result = await resolver.resolve('/tmp/project');

      expect(result.detectionMethod).not.toBe('explicit');
    });
  });

  describe('自动检测 — 根据 detection_files 匹配', () => {
    it('匹配到足够 detectionFiles 时应使用 auto 检测方式', async () => {
      const reactTsProfile = createProfileYaml({
        id: 'react-typescript',
        name: 'React TS',
        priority: 100,
        detection_files: ['package.json', 'tsconfig.json', 'vite.config.ts'],
      });

      const pythonProfile = createProfileYaml({
        id: 'python',
        name: 'Python',
        priority: 80,
        detection_files: ['pyproject.toml', 'requirements.txt'],
      });

      mockedFsAsync.readdir.mockResolvedValue([
        'generic.yaml',
        'react-typescript.yaml',
        'python.yaml',
      ]);

      mockedFsAsync.stat.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('package.json')) return Promise.resolve({} as any);
        if (p.includes('tsconfig.json')) return Promise.resolve({} as any);
        if (p.includes('vite.config.ts')) return Promise.resolve({} as any);
        if (p.includes('pyproject.toml')) return Promise.reject(createEnoentError());
        if (p.includes('react-typescript.yaml')) return Promise.resolve({} as any);
        if (p.includes('python.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });

      mockedFsAsync.readFile.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('react-typescript.yaml')) return Promise.resolve(reactTsProfile);
        if (p.includes('python.yaml')) return Promise.resolve(pythonProfile);
        return Promise.resolve('');
      });

      const result = await resolver.resolve('/tmp/react-project');

      expect(result.detectionMethod).toBe('auto');
      expect(result.profile.id).toBe('react-typescript');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('confidence 应基于匹配文件数与总检测文件数的比例计算', async () => {
      const profileWith3DetectionFiles = createProfileYaml({
        id: 'partial-match',
        name: 'Partial Match',
        priority: 50,
        detection_files: ['file-a.txt', 'file-b.txt', 'file-c.txt', 'file-d.txt'],
      });

      mockedFsAsync.readdir.mockResolvedValue(['partial-match.yaml']);

      mockedFsAsync.stat.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('file-a.txt')) return Promise.resolve({} as any);
        if (p.includes('file-b.txt')) return Promise.resolve({} as any);
        if (p.includes('file-c.txt')) return Promise.reject(createEnoentError());
        if (p.includes('file-d.txt')) return Promise.reject(createEnoentError());
        if (p.includes('partial-match.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });

      mockedFsAsync.readFile.mockImplementation((path: string) => {
        if (String(path).includes('partial-match.yaml')) return Promise.resolve(profileWith3DetectionFiles);
        return Promise.resolve('');
      });

      const result = await resolver.resolve('/tmp/partial-project');

      const expectedConfidence = Math.round((2 / 4) * 100);
      expect(result.confidence).toBe(expectedConfidence);
    });

    it('匹配数不足阈值（< 50%）时不应触发 auto 检测', async () => {
      const strictProfile = createProfileYaml({
        id: 'strict-detect',
        name: 'Strict Detect',
        priority: 50,
        detection_files: ['f1', 'f2', 'f3', 'f4', 'f5'],
      });

      mockedFsAsync.readdir.mockResolvedValue(['strict-detect.yaml']);

      mockedFsAsync.stat.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('f1')) return Promise.resolve({} as any);
        if (p.includes('f2')) return Promise.reject(createEnoentError());
        if (p.includes('strict-detect.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });

      mockedFsAsync.readFile.mockImplementation((path: string) => {
        if (String(path).includes('strict-detect.yaml')) return Promise.resolve(strictProfile);
        return Promise.resolve('');
      });

      const result = await resolver.resolve('/tmp/low-match');

      expect(result.detectionMethod).toBe('fallback');
    });
  });

  describe('兜底 generic profile', () => {
    it('无显式配置且无自动匹配时返回 generic profile', async () => {
      mockedFsAsync.readdir.mockResolvedValue(['generic.yaml']);

      const result = await resolver.resolve('/tmp/unknown-project');

      expect(result.detectionMethod).toBe('fallback');
      expect(result.profile.id).toBe('generic');
      expect(result.confidence).toBe(10);
    });

    it('generic profile 应有正确的默认值结构', async () => {
      const result = await resolver.resolve('/tmp/unknown');

      const p = result.profile;
      expect(p.id).toBe('generic');
      expect(p.name).toContain('Generic');
      expect(p.build.typecheckCommand).toBeTruthy();
      expect(p.build.buildCommand).toBeTruthy();
      expect(p.e2e.framework).toBe('none');
      expect(p.template).toBeNull();
    });
  });

  describe('loadProfile(id)', () => {
    it('应加载指定的 profile 并返回 TechProfile 对象', async () => {
      const yamlContent = createProfileYaml({ id: 'custom-profile', name: 'Custom' });

      mockedFsAsync.stat.mockImplementation((path: string) => {
        if (String(path).includes('custom-profile.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });
      mockedFsAsync.readFile.mockImplementation((path: string) => {
        if (String(path).includes('custom-profile.yaml')) return Promise.resolve(yamlContent);
        return Promise.resolve('');
      });

      const profile = await resolver.loadProfile('custom-profile');

      expect(profile).not.toBeNull();
      expect(profile?.id).toBe('custom-profile');
      expect(profile?.name).toBe('Custom');
      expect(profile?.build.typecheckCommand).toBe('tsc --noEmit');
    });

    it('profile 文件不存在时应返回 null', async () => {
      mockedFsAsync.stat.mockRejectedValue(createEnoentError());

      const profile = await resolver.loadProfile('nonexistent-profile');

      expect(profile).toBeNull();
    });

    it('第二次调用相同 ID 时应从缓存返回（不重复读取文件）', async () => {
      const yamlContent = createProfileYaml({ id: 'cached-profile', name: 'Cached' });
      let readCount = 0;

      mockedFsAsync.stat.mockResolvedValue({} as any);
      mockedFsAsync.readFile.mockImplementation(() => {
        readCount++;
        return Promise.resolve(yamlContent);
      });

      await resolver.loadProfile('cached-profile');
      await resolver.loadProfile('cached-profile');

      expect(readCount).toBe(1);
    });
  });

  describe('loadAllProfiles()', () => {
    it('应返回全部 profiles 并按 priority 降序排列', async () => {
      const highPriority = createProfileYaml({ id: 'high', name: 'High', priority: 100 });
      const lowPriority = createProfileYaml({ id: 'low', name: 'Low', priority: 10 });
      const mediumPriority = createProfileYaml({ id: 'medium', name: 'Medium', priority: 50 });

      mockedFsAsync.readdir.mockResolvedValue([
        '_schema.yaml',
        'high.yaml',
        'medium.yaml',
        'low.yaml',
        'generic.yaml',
      ]);

      mockedFsAsync.stat.mockResolvedValue({} as any);
      mockedFsAsync.readFile.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('high.yaml')) return Promise.resolve(highPriority);
        if (p.includes('medium.yaml')) return Promise.resolve(mediumPriority);
        if (p.includes('low.yaml')) return Promise.resolve(lowPriority);
        if (p.includes('generic.yaml')) return Promise.resolve(createProfileYaml({ id: 'generic', name: 'Generic', priority: 0 }));
        return Promise.resolve('');
      });

      const profiles = await resolver.loadAllProfiles();

      expect(profiles.length).toBeGreaterThanOrEqual(4);
      const priorities = profiles.map((p) => p.priority ?? 0);
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i + 1]);
      }
    });

    it('应以 _ 开头的文件和 .yaml 以外的文件被过滤', async () => {
      mockedFsAsync.readdir.mockResolvedValue([
        '_schema.yaml',
        'valid.yaml',
        '.hidden.yaml',
        'readme.md',
        'also-valid.yaml',
      ]);

      mockedFsAsync.stat.mockResolvedValue({} as any);
      mockedFsAsync.readFile.mockImplementation((path: string) => {
        const p = String(path);
        if (p.endsWith('/valid.yaml') || p.includes('/valid.yaml')) return Promise.resolve(createProfileYaml({ id: 'valid' }));
        if (p.endsWith('/also-valid.yaml') || p.includes('/also-valid.yaml')) return Promise.resolve(createProfileYaml({ id: 'also-valid' }));
        return Promise.resolve('');
      });

      const profiles = await resolver.loadAllProfiles();

      const ids = profiles.map((p) => p.id);
      expect(ids).not.toContain('_schema');
      expect(ids).not.toContain('.hidden');
      expect(ids).not.toContain('readme');
      expect(ids).toContain('valid');
      expect(ids).toContain('also-valid');
    });
  });

  describe('confidence 值合理性', () => {
    it('explicit 方式 confidence 固定为 100', async () => {
      const configYaml = JSON.stringify({ tech_profile: 'some-id' });
      const profileYaml = createProfileYaml({ id: 'some-id' });

      mockedFsAsync.stat.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('config.yaml')) return Promise.resolve({} as any);
        if (p.includes('some-id.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });
      mockedFsAsync.readFile.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes('config.yaml')) return Promise.resolve(configYaml);
        if (p.includes('some-id.yaml')) return Promise.resolve(profileYaml);
        return Promise.resolve('');
      });
      mockedFsAsync.readdir.mockResolvedValue(['some-id.yaml']);

      const result = await resolver.resolve('/tmp/explicit-test');

      expect(result.confidence).toBe(100);
    });

    it('auto 方式 confidence 应在 0~100 之间', async () => {
      const profileYaml = createProfileYaml({
        id: 'auto-test',
        detection_files: ['a', 'b', 'c'],
      });

      mockedFsAsync.readdir.mockResolvedValue(['auto-test.yaml']);
      mockedFsAsync.stat.mockImplementation((path: string) => {
        const p = String(path);
        if (p === '/tmp/auto/a' || p.endsWith('/a')) return Promise.resolve({} as any);
        if (p === '/tmp/auto/b' || p.endsWith('/b')) return Promise.resolve({} as any);
        if (p.includes('auto-test.yaml')) return Promise.resolve({} as any);
        return Promise.reject(createEnoentError());
      });
      mockedFsAsync.readFile.mockImplementation((path: string) => {
        if (String(path).includes('auto-test.yaml')) return Promise.resolve(profileYaml);
        return Promise.resolve('');
      });

      const result = await resolver.resolve('/tmp/auto');

      expect(result.detectionMethod).toBe('auto');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('fallback 方式 confidence 固定为 10', async () => {
      mockedFsAsync.readdir.mockResolvedValue(['generic.yaml']);

      const result = await resolver.resolve('/tmp/fallback-test');

      expect(result.detectionMethod).toBe('fallback');
      expect(result.confidence).toBe(10);
    });
  });

  describe('clearCache()', () => {
    it('清除缓存后重新 loadProfile 应再次读取文件', async () => {
      const yamlContent = createProfileYaml({ id: 'cacheable', name: 'Cacheable' });
      let readCount = 0;

      mockedFsAsync.stat.mockResolvedValue({} as any);
      mockedFsAsync.readFile.mockImplementation(() => {
        readCount++;
        return Promise.resolve(yamlContent);
      });

      await resolver.loadProfile('cacheable');
      expect(readCount).toBe(1);

      resolver.clearCache();

      await resolver.loadProfile('cacheable');
      expect(readCount).toBe(2);
    });
  });

  describe('normalizeProfile 字段映射', () => {
    it('snake_case YAML key 应正确映射到 camelCase 属性', async () => {
      const snakeCaseYaml = JSON.stringify({
        id: 'snake-test',
        name: 'Snake Case Test',
        build: {
          typecheck_command: 'tsc',
          build_command: 'build',
          test_command: 'test',
          test_coverage_command: 'coverage',
          lint_command: 'lint',
          coverage_threshold: 85,
          strict_coverage_threshold: 95,
        },
        tdd: { test_template: 'template' },
        e2e: {
          framework: 'cypress',
          dev_server_start: 'serve',
          dev_server_port: 3000,
          dev_server_ready_check: 'curl check',
        },
        conventions: {
          test_dir: '__tests__',
          test_suffix: '.spec.ts',
          source_dir: 'src',
          config_files: ['tsconfig.json'],
        },
        detection_files: ['pkg.json'],
      });

      mockedFsAsync.stat.mockResolvedValue({} as any);
      mockedFsAsync.readFile.mockResolvedValue(snakeCaseYaml);

      const profile = await resolver.loadProfile('snake-test');

      expect(profile).not.toBeNull();
      expect(profile!.build.typecheckCommand).toBe('tsc');
      expect(profile!.build.buildCommand).toBe('build');
      expect(profile!.build.testCommand).toBe('test');
      expect(profile!.build.testCoverageCommand).toBe('coverage');
      expect(profile!.build.lintCommand).toBe('lint');
      expect(profile!.build.coverageThreshold).toBe(85);
      expect(profile!.build.strictCoverageThreshold).toBe(95);
      expect(profile!.tdd.testTemplate).toBe('template');
      expect(profile!.e2e.framework).toBe('cypress');
      expect(profile!.e2e.devServerStart).toBe('serve');
      expect(profile!.e2e.devServerPort).toBe(3000);
      expect(profile!.e2e.devServerReadyCheck).toBe('curl check');
      expect(profile!.conventions).toBeDefined();
      expect(profile!.conventions!.testDir).toBe('__tests__');
      expect(profile!.conventions!.testSuffix).toBe('.spec.ts');
      expect(profile!.conventions!.sourceDir).toBe('src');
      expect(profile!.conventions!.configFiles).toEqual(['tsconfig.json']);
      expect(profile!.detectionFiles).toEqual(['pkg.json']);
    });
  });
});
