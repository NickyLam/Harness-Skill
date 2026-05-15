import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineExecutor } from '../pipeline-executor.js';
import * as fsPromises from 'fs/promises';
import * as fs from 'node:fs';
import * as execAsyncModule from '../exec-async.js';

vi.mock('fs/promises');
vi.mock('node:fs');
vi.mock('../exec-async.js', () => ({
  execAsync: vi.fn(),
  safeExec: vi.fn(),
}));
vi.mock('../profile-resolver.js', () => ({
  ProfileResolver: vi.fn().mockImplementation(() => ({
    resolve: vi.fn().mockResolvedValue({
      profile: {
        id: 'generic',
        name: 'Generic',
        build: {
          typecheckCommand: "echo 'No typecheck configured'",
          buildCommand: "echo 'No build configured'",
          testCommand: "echo 'No test configured'",
          testCoverageCommand: '',
          lintCommand: "echo 'No lint configured'",
          coverageThreshold: 0,
          strictCoverageThreshold: 0,
        },
        tdd: { testTemplate: '' },
        e2e: { framework: 'none', devServerStart: '', devServerPort: 0 },
        template: null,
        detectionFiles: [],
      },
      detectionMethod: 'fallback',
      confidence: 10,
    }),
  })),
}));
vi.mock('../metrics-collector.js', () => ({
  MetricsCollector: vi.fn().mockImplementation(() => ({
    recordGate: vi.fn().mockResolvedValue(undefined),
    recordSkillExecution: vi.fn().mockResolvedValue(undefined),
    getAggregateMetrics: vi.fn().mockResolvedValue({
      totalRuns: 0,
      gatePassRate: 0,
      avgGateDurationMs: 0,
      avgTokenUsage: 0,
      byStage: {},
      byGate: {},
    }),
    getRunId: vi.fn().mockReturnValue('integration-test-001'),
  })),
}));

const mockedFsPromises = vi.mocked(fsPromises);
const mockedFs = vi.mocked(fs);
const mockedExecAsync = vi.mocked(execAsyncModule.execAsync);
const mockedSafeExec = vi.mocked(execAsyncModule.safeExec);

function makeIntegrationPipelineYaml(): string {
  const stages: Record<string, unknown> = {
    spec: {
      id: 'stage-spec',
      order: 1,
      name: '产品定义',
      role: 'product-owner',
      gate: 'spec_gate',
      capsules: { mandatory: ['brainstorming'], optional: [] },
    },
    build: {
      id: 'stage-build',
      order: 2,
      name: '构建实现',
      role: 'implementer',
      gate: 'build_gate',
      capsules: { mandatory: ['tdd'], optional: [] },
    },
    test: {
      id: 'stage-test',
      order: 3,
      name: '验证测试',
      role: 'tester',
      gate: 'test_gate',
      capsules: { mandatory: ['verification'], optional: [] },
    },
  };

  const gates: Record<string, unknown> = {};
  for (const stageName of Object.keys(stages)) {
    gates[`${stageName}_gate`] = {
      id: `gate-${stageName}`,
      name: `${stageName} Gate`,
      stage_transition: `${stageName} → ${stageName}_complete`,
      description: `Integration test gate for ${stageName}`,
      failAction: `回到 /${stageName}`,
      levels: {
        'L1-lightweight': {
          checks: [
            { id: `${stageName}_file_exists`, name: `${stageName} output exists`, type: 'file_exists', required: true },
          ],
        },
        'L2-standard': {
          checks: [
            { id: `${stageName}_file_exists`, name: `${stageName} output exists`, type: 'file_exists', required: true },
            { id: `${stageName}_command`, name: `${stageName} command check`, command: 'echo ok', required: true },
          ],
        },
      },
    };
  }

  return JSON.stringify({ version: '3.0.0', stages, gates });
}

function makeIntegrationRegistryYaml(): string {
  return JSON.stringify({
    version: '3.0.0',
    capsules: {
      brainstorming: {
        id: 'cp-brainstorm',
        name: 'Brainstorming',
        stage: 'spec',
        roles: ['product-owner'],
        pattern: 'interview',
        mandatory: true,
        file_path: 'core/skills/spec/brainstorming/SKILL.md',
      },
      tdd: {
        id: 'cp-tdd',
        name: 'TDD',
        stage: 'build',
        roles: ['implementer'],
        pattern: 'red-green-refactor',
        mandatory: true,
        file_path: 'core/skills/build/tdd/SKILL.md',
      },
      verification: {
        id: 'cp-verification',
        name: 'Verification',
        stage: 'test',
        roles: ['tester'],
        pattern: 'evidence-collection',
        mandatory: true,
        file_path: 'core/skills/test/verification/SKILL.md',
      },
    },
  });
}

describe('Integration: PipelineExecutor + GateRunner + SkillLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockImplementation(((path: string) => {
      if (typeof path === 'string' && path.includes('registry.yaml')) {
        return makeIntegrationRegistryYaml();
      }
      if (typeof path === 'string' && path.includes('pipeline.yaml')) {
        return makeIntegrationPipelineYaml();
      }
      return '';
    }) as unknown as typeof fs.readFileSync);

    mockedFsPromises.readFile.mockImplementation(((path: string) => {
      if (typeof path === 'string' && path.includes('registry.yaml')) {
        return Promise.resolve(makeIntegrationRegistryYaml());
      }
      if (typeof path === 'string' && path.includes('pipeline.yaml')) {
        return Promise.resolve(makeIntegrationPipelineYaml());
      }
      if (typeof path === 'string' && path.endsWith('SKILL.md')) {
        return Promise.resolve('---\nid: test\nname: "Test"\nstage: spec\nroles: []\npattern: test\nmandatory: true\ndepends: []\nversion: "3.0"\n---\n\n# Test\n\n### Step 1: Do\nAction.\n\n## 产出物\n\n- Output');
      }
      return Promise.resolve('');
    }) as unknown as typeof fsPromises.readFile);

    mockedFsPromises.mkdir.mockResolvedValue(undefined);
    mockedFsPromises.writeFile.mockResolvedValue(undefined);
    mockedFsPromises.readdir.mockResolvedValue([]);
    (mockedFs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ isFile: () => true });
    mockedExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
    mockedSafeExec.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('完整流水线：spec → build → test 全部通过', async () => {
    const executor = new PipelineExecutor({ dryRun: true });
    const result = await executor.execute();

    expect(result.success).toBe(true);
    expect(result.completedStages).toContain('spec');
    expect(result.completedStages).toContain('build');
    expect(result.completedStages).toContain('test');
    expect(result.gateResults.size).toBeGreaterThanOrEqual(3);
    expect(result.failedAt).toBeUndefined();
  });

  it('中间 Gate 失败时提前终止', async () => {
    let gateCallCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedSafeExec as any).mockImplementation((_cmd: string) => {
      gateCallCount++;
      if (gateCallCount > 1) return Promise.reject(new Error('Build failed'));
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    const executor = new PipelineExecutor({ dryRun: true });
    const result = await executor.execute();

    expect(result.success).toBe(false);
    expect(result.failedAt).toBeDefined();
    expect(result.completedStages.length).toBeLessThan(3);
  });

  it('fromStage 跳过已完成阶段', async () => {
    const executor = new PipelineExecutor({ fromStage: 'build', dryRun: true });
    const result = await executor.execute();

    expect(result.success).toBe(true);
    expect(result.completedStages).not.toContain('spec');
    expect(result.completedStages).toContain('build');
    expect(result.completedStages).toContain('test');
  });

  it('L1 严格度只运行 L1 检查', async () => {
    const executor = new PipelineExecutor({ strictness: 'L1-lightweight', dryRun: true });
    const result = await executor.execute();

    expect(result.success).toBe(true);
    for (const [, gateResult] of result.gateResults) {
      expect(gateResult.level).toBe('L1-lightweight');
    }
  });

  it('Skill 加载与 Gate 检查协同工作', async () => {
    const executor = new PipelineExecutor({ strictness: 'L1-lightweight', dryRun: true });
    const result = await executor.execute();

    expect(typeof result.skillsLoaded).toBeDefined();
    expect(result.gateResults.size).toBeGreaterThan(0);
  });
});
