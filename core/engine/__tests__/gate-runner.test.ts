import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GateRunner } from '../gate-runner.js';
import * as fs from 'node:fs';
import * as fsPromises from 'fs/promises';
import * as execAsyncModule from '../exec-async.js';

vi.mock('node:fs');
vi.mock('fs/promises');
vi.mock('../exec-async.js', () => ({
  execAsync: vi.fn(),
  safeExec: vi.fn(),
}));

const mockedFs = vi.mocked(fs);
const mockedFsPromises = vi.mocked(fsPromises);
const mockedExecAsync = vi.mocked(execAsyncModule.execAsync);
const mockedSafeExec = vi.mocked(execAsyncModule.safeExec);

function makePipeline(overrides?: Record<string, unknown>): string {
  const base = {
    version: '3.0.0',
    stages: {
      spec: { capsules: {}, gate: 'spec_gate' },
    },
    gates: {
      spec_gate: {
        id: 'gate-spec',
        name: 'Spec Gate',
        stage_transition: 'none → spec_complete',
        description: 'Test gate',
        failAction: '回到 /spec 补充文档',
        levels: {
          'L1-lightweight': {
            checks: [
              { id: 'cmd_ok', name: '命令OK', command: 'echo hello', required: true },
            ],
          },
          'L2-standard': {
            checks: [
              { id: 'cmd_ok', name: '命令OK', command: 'echo hello', required: true },
              { id: 'cmd_build', name: '构建命令', command: 'npm run build', required: true },
            ],
          },
        },
      },
    },
    ...overrides,
  };
  return JSON.stringify(base);
}

describe('GateRunner', () => {
  let runner: GateRunner;

  beforeEach(() => {
    runner = new GateRunner();
    vi.clearAllMocks();

    mockedFs.existsSync.mockReturnValue(true);
    mockedFsPromises.readFile.mockResolvedValue(makePipeline() as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedSafeExec as any).mockResolvedValue({ stdout: '', stderr: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedSafeExec as any).mockResolvedValue({ stdout: '', stderr: '' });
  });

  describe('runGate(gateId) — 返回 GateResult 结构', () => {
    it('应返回包含 gateId、level、passed、checks、durationMs、failAction、timestamp 的对象', async () => {
      const result = await runner.runGate('spec_gate', { dryRun: true });

      expect(result).toHaveProperty('gateId', 'spec_gate');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('failAction');
      expect(result).toHaveProperty('timestamp');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(typeof result.durationMs).toBe('number');
      expect(typeof result.passed).toBe('boolean');
    });

    it('命令成功时所有 command check 通过，passed 为 true，checks 非空', async () => {
      const result = await runner.runGate('spec_gate', {
        strictness: 'L2-standard',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      expect(result.passed).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
      result.checks.forEach((c) => {
        expect(c.passed).toBe(true);
      });
    });

    it('durationMs 应为非负数', async () => {
      const result = await runner.runGate('spec_gate', { dryRun: true });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(10000);
    });

    it('timestamp 应为有效的 ISO 时间字符串', async () => {
      const result = await runner.runGate('spec_gate', { dryRun: true });

      const parsed = Date.parse(result.timestamp);
      expect(parsed).not.toBeNaN();
    });

    it('failAction 应来自 gate 定义', async () => {
      const result = await runner.runGate('spec_gate', { dryRun: true });

      expect(result.failAction).toBe('回到 /spec 补充文档');
    });
  });

  describe('command 类型 check — 命令执行控制', () => {
    it('命令正常返回时 command check 的 message 包含 "Command succeeded"', async () => {
      const result = await runner.runGate('spec_gate', {
        strictness: 'L2-standard',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      const cmdChecks = result.checks.filter((c) => c.message.includes('Command succeeded'));
      expect(cmdChecks.length).toBeGreaterThan(0);
    });

    it('命令抛出含 stderr 的错误时 command check 失败并包含 remediation', async () => {
      const customPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'fix-it',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'failing_cmd', name: '失败命令', command: 'exit 1', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'failing_cmd', name: '失败命令', command: 'exit 1', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(customPipeline);

      const err = new Error('Command failed') as Error & { stderr?: string; stdout?: string };
      err.stderr = 'Type error: cannot find name "X"';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockRejectedValue(err);

      const result = await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      expect(result.passed).toBe(false);
      expect(result.checks.length).toBe(1);
      expect(result.checks[0].checkId).toBe('failing_cmd');
      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].message).toContain('Command failed');
      expect(result.checks[0].remediation).toBeDefined();
      expect(typeof result.checks[0].remediation).toBe('string');
      expect(result.checks[0].remediation!.length).toBeGreaterThan(0);
    });

    it('命令失败时 stderr 内容应被捕获到 message 中', async () => {
      const customPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'err_cmd', name: '错误命令', command: 'npx tsc', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'err_cmd', name: '错误命令', command: 'npx tsc', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(customPipeline);

      const err = new Error('fail') as Error & { stderr?: string; stdout?: string };
      err.stderr = 'error: TS2307: Cannot find module X';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockRejectedValue(err);

      const result = await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      expect(result.checks[0].message).toContain('TS2307');
    });
  });

  describe('dryRun 模式', () => {
    it('dryRun=true + 门禁失败时不抛异常，正常返回结果', async () => {
      const customPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'abort-now',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'fc', name: 'FC', command: 'exit 1', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'fc', name: 'FC', command: 'exit 1', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(customPipeline);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockRejectedValue(new Error('simulated failure'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      expect(result.passed).toBe(false);
      expect(result.failAction).toBe('abort-now');
      expect(result.checks[0].checkId).toBe('fc');

      consoleSpy.mockRestore();
    });

    it('dryRun=false + 门禁失败时应调用 console.error 输出失败信息', async () => {
      const customPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'stop',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'fc', name: 'FC', command: 'false', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'fc', name: 'FC', command: 'false', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(customPipeline);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockRejectedValue(new Error('fail'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: false,
        projectDir: '/tmp/test',
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('strictness 参数过滤', () => {
    it('L1-lightweight 的检查项数量应少于 L2-standard', async () => {
      const l1Result = await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      const l2Result = await runner.runGate('spec_gate', {
        strictness: 'L2-standard',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      expect(l1Result.checks.length).toBeLessThan(l2Result.checks.length);
      expect(l1Result.level).toBe('L1-lightweight');
      expect(l2Result.level).toBe('L2-standard');
    });

    it('不存在的严格度级别应抛出包含级别名称的错误', async () => {
      await expect(
        runner.runGate('spec_gate', { strictness: 'L4-nonexistent' as never })
      ).rejects.toThrow('Strictness level "L4-nonexistent"');
    });

    it('不指定 strictness 时默认使用 L2-standard', async () => {
      const result = await runner.runGate('spec_gate', { dryRun: true });
      expect(result.level).toBe('L2-standard');
    });
  });

  describe('runAllGates() — 按顺序执行所有 gates', () => {
    it('应返回与 gates 定义数量一致的 GateResult 数组', async () => {
      const multiGatePipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g1', name: 'Spec Gate', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': { checks: [{ id: 'c1', name: 'C1', command: 'echo 1', required: true }] },
              'L2-standard': { checks: [{ id: 'c1', name: 'C1', command: 'echo 1', required: true }] },
            },
          },
          plan_gate: {
            id: 'g2', name: 'Plan Gate', stage_transition: '', description: '',
            failAction: 'y',
            levels: {
              'L1-lightweight': { checks: [{ id: 'c2', name: 'C2', command: 'echo 2', required: true }] },
              'L2-standard': { checks: [{ id: 'c2', name: 'C2', command: 'echo 2', required: true }] },
            },
          },
          ship_gate: {
            id: 'g3', name: 'Ship Gate', stage_transition: '', description: '',
            failAction: 'z',
            levels: {
              'L1-lightweight': { checks: [{ id: 'c3', name: 'C3', command: 'echo 3', required: true }] },
              'L2-standard': { checks: [{ id: 'c3', name: 'C3', command: 'echo 3', required: true }] },
            },
          },
        },
        stages: {
          spec: { capsules: {}, gate: 'spec_gate' },
          plan: { capsules: {}, gate: 'plan_gate' },
          ship: { capsules: {}, gate: 'ship_gate' },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(multiGatePipeline);

      const results = await runner.runAllGates({ dryRun: true, projectDir: '/tmp/test' });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      expect(results.map((r) => r.gateId)).toEqual(['spec_gate', 'plan_gate', 'ship_gate']);
    });

    it('第一个门禁失败且非 dryRun 时提前终止后续执行', async () => {
      const failingPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g1', name: 'SG', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': { checks: [{ id: 'fail', name: 'F', command: 'exit 1', required: true }] },
              'L2-standard': { checks: [{ id: 'fail', name: 'F', command: 'exit 1', required: true }] },
            },
          },
          plan_gate: {
            id: 'g2', name: 'PG', stage_transition: '', description: '',
            failAction: 'y',
            levels: {
              'L1-lightweight': { checks: [{ id: 'ok', name: 'O', command: 'echo ok', required: true }] },
              'L2-standard': { checks: [{ id: 'ok', name: 'O', command: 'echo ok', required: true }] },
            },
          },
        },
        stages: {
          spec: { capsules: {}, gate: 'spec_gate' },
          plan: { capsules: {}, gate: 'plan_gate' },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(failingPipeline);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockImplementation((_cmd: string) => {
        if (_cmd.includes('exit 1')) return Promise.reject(new Error('fail'));
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await runner.runAllGates({ dryRun: false, projectDir: '/tmp/test' });

      expect(results.length).toBe(1);
      expect(results[0].gateId).toBe('spec_gate');
      expect(results[0].passed).toBe(false);

      vi.spyOn(console, 'error').mockRestore();
    });

    it('dryRun 模式下即使门禁失败也应执行全部 gates', async () => {
      const allFailPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g1', name: 'S', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': { checks: [{ id: 'f1', name: 'F1', command: 'exit 1', required: true }] },
              'L2-standard': { checks: [{ id: 'f1', name: 'F1', command: 'exit 1', required: true }] },
            },
          },
          plan_gate: {
            id: 'g2', name: 'P', stage_transition: '', description: '',
            failAction: 'y',
            levels: {
              'L1-lightweight': { checks: [{ id: 'f2', name: 'F2', command: 'exit 1', required: true }] },
              'L2-standard': { checks: [{ id: 'f2', name: 'F2', command: 'exit 1', required: true }] },
            },
          },
        },
        stages: {
          spec: { capsules: {}, gate: 'spec_gate' },
          plan: { capsules: {}, gate: 'plan_gate' },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(allFailPipeline);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockRejectedValue(new Error('fail'));

      const results = await runner.runAllGates({ dryRun: true, projectDir: '/tmp/test' });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.passed === false)).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('不存在的 gateId 应抛出包含该 ID 的错误', async () => {
      await expect(
        runner.runGate('nonexistent_gate')
      ).rejects.toThrow('"nonexistent_gate"');
    });

    it('pipeline.yaml 文件不存在时应抛出 "not found" 错误', async () => {
      mockedFs.existsSync.mockReturnValueOnce(false);

      await expect(
        runner.runGate('spec_gate')
      ).rejects.toThrow('not found');
    });

    it('无 gates 定义时应抛出 "No gates defined" 错误', async () => {
      mockedFsPromises.readFile.mockResolvedValue(JSON.stringify({ version: '3.0.0', stages: {}, gates: {} }));

      await expect(
        runner.runAllGates()
      ).rejects.toThrow('No gates defined');
    });

    it('每个 CheckResult 都应有完整的结构字段', async () => {
      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      for (const check of result.checks) {
        expect(check).toHaveProperty('checkId');
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('passed', expect.any(Boolean));
        expect(check).toHaveProperty('message', expect.any(String));
        expect(check).toHaveProperty('durationMs');
        expect(typeof check.durationMs).toBe('number');
        expect(check.durationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('TechProfile 命令替换', () => {
    it('有 profile 时 command 占位符 {typecheck_command} 应被替换为实际命令', async () => {
      const profile: import('../types.js').TechProfile = {
        id: 'react-ts',
        name: 'React TS',
        build: {
          typecheckCommand: 'npx tsc --noEmit',
          buildCommand: 'npm run build',
          testCommand: 'vitest run',
          testCoverageCommand: '',
          lintCommand: 'eslint src/',
          coverageThreshold: 80,
          strictCoverageThreshold: 90,
        },
        tdd: { testTemplate: '' },
        e2e: { framework: 'none', devServerStart: '', devServerPort: 0 },
        template: null,
      };

      const cmdPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g1', name: 'SG', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'tc', name: 'TC', command: '{typecheck_command}', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'tc', name: 'TC', command: '{typecheck_command}', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(cmdPipeline);

      const profileRunner = new GateRunner(profile);
      const result = await profileRunner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((mockedSafeExec as any)).toHaveBeenCalledWith(
        'npx tsc --noEmit',
        expect.objectContaining({ cwd: '/tmp/test' })
      );
    });

    it('无 profile 时占位符原样传递给命令执行', async () => {
      const placeholderPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'pc', name: 'PC', command: '{test_command}', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'pc', name: 'PC', command: '{test_command}', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(placeholderPipeline);

      const noProfileRunner = new GateRunner();
      await noProfileRunner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((mockedSafeExec as any)).toHaveBeenCalledWith(
        '{test_command}',
        expect.objectContaining({ cwd: '/tmp/test' })
      );
    });
  });

  describe('pattern_match 类型 check', () => {
    it('pattern 匹配成功时 passed=true', async () => {
      const patternPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'doc_has_ac', name: '验收标准检查', pattern: '验收标准|Acceptance', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'doc_has_ac', name: '验收标准检查', pattern: '验收标准|Acceptance', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockImplementation(((path: string) => {
        if (typeof path === 'string' && path.endsWith('pipeline.yaml')) return patternPipeline;
        if (typeof path === 'string' && path.endsWith('.md')) return '# Design\n## 验收标准\n- AC1: test';
        return patternPipeline;
      }) as Parameters<typeof mockedFsPromises.readFile.mockImplementation>[0]);

      (runner as unknown as { glob: (p: string) => Promise<string[]> }).glob = vi.fn().mockResolvedValue(['/tmp/test/.harness/specs/design.md']);

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(true);
      expect(result.checks[0].message).toContain('Pattern');
    });

    it('pattern 匹配失败时 passed=false 且含 remediation', async () => {
      const patternPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'doc_has_ac', name: '验收标准检查', pattern: '验收标准|Acceptance', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'doc_has_ac', name: '验收标准检查', pattern: '验收标准|Acceptance', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockImplementation(((path: string) => {
        if (typeof path === 'string' && path.endsWith('pipeline.yaml')) return patternPipeline;
        if (typeof path === 'string' && path.endsWith('.md')) return '# Design\n## Overview\nNo AC here';
        return patternPipeline;
      }) as Parameters<typeof mockedFsPromises.readFile.mockImplementation>[0]);

      (runner as unknown as { glob: (p: string) => Promise<string[]> }).glob = vi.fn().mockResolvedValue(['/tmp/test/.harness/specs/design.md']);

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].remediation).toBeDefined();
      expect(result.checks[0].message).toContain('not found');
    });

    it('verify 字段含"匹配"时推断为 pattern_match 类型', async () => {
      const verifyPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'doc_check', name: '文档检查', verify: '匹配验收标准', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'doc_check', name: '文档检查', verify: '匹配验收标准', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(verifyPipeline);
      (runner as unknown as { glob: (p: string) => Promise<string[]> }).glob = vi.fn().mockResolvedValue([]);

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].message).not.toContain('Unknown check type');
    });

    it('无 pattern 也无 verify 时 inferCheckType 推断为 file_exists 而非 pattern_match', async () => {
      const noPatternPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'empty_check', name: '空检查', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'empty_check', name: '空检查', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(noPatternPipeline);
      (runner as unknown as { glob: (p: string) => Promise<string[]> }).glob = vi.fn().mockResolvedValue([]);

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(false);
    });
  });

  describe('git_status 类型 check', () => {
    it('工作区干净时 passed=true', async () => {
      const gitPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'git_clean', name: 'Git Clean', verify: 'git status clean', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'git_clean', name: 'Git Clean', verify: 'git status clean', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(gitPipeline);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockResolvedValue({ stdout: '', stderr: '' });

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(true);
      expect(result.checks[0].message).toContain('clean');
    });

    it('工作区有未提交变更时 passed=false 并含 remediation', async () => {
      const gitPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'git_clean', name: 'Git Clean', verify: 'git status clean', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'git_clean', name: 'Git Clean', verify: 'git status clean', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(gitPipeline);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockImplementation((_cmd: string) => {
        if (_cmd.includes('git status')) {
          return Promise.resolve({ stdout: 'M src/index.ts\n?? new-file.ts', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].remediation).toBeDefined();
      expect(result.checks[0].message).toContain('uncommitted');
    });

    it('git 命令失败（非 git 仓库）时 passed=false 并提示 git init', async () => {
      const gitPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'git_clean', name: 'Git Clean', verify: 'git status clean', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'git_clean', name: 'Git Clean', verify: 'git status clean', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(gitPipeline);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockImplementation((_cmd: string) => {
        if (_cmd.includes('git status')) {
          return Promise.reject(new Error('not a git repository'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(false);
      expect(result.checks[0].remediation).toContain('git init');
    });

    it('check id 含 "dirty" 时允许脏工作区', async () => {
      const dirtyPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'git_dirty_check', name: 'Git Dirty Check', verify: 'git dirty allowed', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'git_dirty_check', name: 'Git Dirty Check', verify: 'git dirty allowed', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(dirtyPipeline);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockImplementation((_cmd: string) => {
        if (_cmd.includes('git status')) return Promise.resolve({ stdout: 'M src/index.ts', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await runner.runGate('spec_gate', { dryRun: true, projectDir: '/tmp/test' });

      expect(result.checks[0].passed).toBe(true);
    });
  });

  describe('CheckResult 边界情况', () => {
    it('required: false 的 check 失败后仍可获取其结果', async () => {
      const mixedPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [
                  { id: 'pass_cmd', name: '通过', command: 'echo ok', required: true },
                  { id: 'opt_fail', name: '可选失败', command: 'exit 1', required: false },
                ],
              },
              'L2-standard': {
                checks: [
                  { id: 'pass_cmd', name: '通过', command: 'echo ok', required: true },
                  { id: 'opt_fail', name: '可选失败', command: 'exit 1', required: false },
                ],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(mixedPipeline);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockImplementation((_cmd: string) => {
        if (_cmd.includes('exit 1')) return Promise.reject(new Error('fail'));
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      const optFailCheck = result.checks.find((c) => c.checkId === 'opt_fail');
      expect(optFailCheck).toBeDefined();
      expect(optFailCheck!.passed).toBe(false);
    });

    it('每个 check 的 durationMs 都应为非负数', async () => {
      const result = await runner.runGate('spec_gate', {
        strictness: 'L2-standard',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      for (const check of result.checks) {
        expect(check.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('executeCheck 内部异常时返回 passed=false 且 message 含 "Command failed"', async () => {
      const customPipeline = makePipeline({
        gates: {
          spec_gate: {
            id: 'g', name: 'G', stage_transition: '', description: '',
            failAction: 'x',
            levels: {
              'L1-lightweight': {
                checks: [{ id: 'boom', name: 'Boom', command: 'explode', required: true }],
              },
              'L2-standard': {
                checks: [{ id: 'boom', name: 'Boom', command: 'explode', required: true }],
              },
            },
          },
        },
      });

      mockedFsPromises.readFile.mockResolvedValue(customPipeline);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockRejectedValue(new Error('unexpected internal error'));

      const result = await runner.runGate('spec_gate', {
        strictness: 'L1-lightweight',
        dryRun: true,
        projectDir: '/tmp/test',
      });

      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain('Command failed');
    });
  });
});
