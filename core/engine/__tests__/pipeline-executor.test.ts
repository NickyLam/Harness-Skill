import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineExecutor } from '../pipeline-executor.js';
import type { PipelineExecutionResult } from '../pipeline-executor.js';
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
vi.mock('../metrics-collector.js', () => {
  return {
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
      getRunId: vi.fn().mockReturnValue('test-run-001'),
    })),
  };
});

const mockedFsPromises = vi.mocked(fsPromises);
const mockedFs = vi.mocked(fs);
const mockedExecAsync = vi.mocked(execAsyncModule.execAsync);
const mockedSafeExec = vi.mocked(execAsyncModule.safeExec);

function makePipelineYaml(stages: Record<string, unknown> = {}): string {
  const defaultStages = {
    spec: {
      id: 'stage-spec',
      order: 1,
      name: '产品定义',
      role: 'product-owner',
      gate: 'spec_gate',
      capsules: { mandatory: ['brainstorming'], optional: [] },
    },
    plan: {
      id: 'stage-plan',
      order: 2,
      name: '架构规划',
      role: 'architect',
      gate: 'plan_gate',
      capsules: { mandatory: ['writing-plans'], optional: [] },
    },
    build: {
      id: 'stage-build',
      order: 3,
      name: '构建实现',
      role: 'implementer',
      gate: 'build_gate',
      capsules: { mandatory: ['tdd'], optional: [] },
    },
    test: {
      id: 'stage-test',
      order: 4,
      name: '验证测试',
      role: 'tester',
      gate: 'test_gate',
      capsules: { mandatory: ['verification'], optional: [] },
    },
    review: {
      id: 'stage-review',
      order: 5,
      name: '代码审查',
      role: 'reviewer',
      gate: 'review_gate',
      capsules: { mandatory: ['staff-review'], optional: [] },
    },
    simplify: {
      id: 'stage-simplify',
      order: 6,
      name: '代码简化',
      role: 'reviewer',
      gate: 'simplify_gate',
      capsules: { mandatory: ['code-simplification'], optional: [] },
    },
    ship: {
      id: 'stage-ship',
      order: 7,
      name: '发布上线',
      role: 'shipper',
      gate: 'ship_gate',
      capsules: { mandatory: ['ship-pipeline'], optional: [] },
    },
    ...stages,
  };

  const gates: Record<string, unknown> = {};
  for (const [stageName] of Object.entries(defaultStages)) {
    const gateId = `${stageName}_gate`;
    gates[gateId] = {
      id: `gate-${stageName}`,
      name: `${stageName} Gate`,
      stage_transition: `${stageName} → ${stageName}_complete`,
      description: `Test gate for ${stageName}`,
      failAction: `回到 /${stageName}`,
      levels: {
        'L1-lightweight': {
          checks: [
            { id: `${stageName}_check_l1`, name: `${stageName} L1 check`, command: 'echo ok', required: true },
          ],
        },
        'L2-standard': {
          checks: [
            { id: `${stageName}_check`, name: `${stageName} check`, command: 'echo ok', required: true },
          ],
        },
      },
    };
  }

  return JSON.stringify({ version: '3.0.0', stages: defaultStages, gates });
}

function makeRegistryYaml(): string {
  return JSON.stringify({
    version: '3.0.0',
    capsules: {
      brainstorming: {
        id: 'cp-brainstorm',
        name: 'Brainstorming',
        stage: 'spec',
        roles: ['product-owner'],
        pattern: 'inversion-interview',
        mandatory: true,
        file_path: 'core/skills/spec/brainstorming/SKILL.md',
      },
      'writing-plans': {
        id: 'cp-writing-plans',
        name: 'Writing Plans',
        stage: 'plan',
        roles: ['architect'],
        pattern: 'task-decomposition',
        mandatory: true,
        file_path: 'core/skills/plan/writing-plans/SKILL.md',
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
      'staff-review': {
        id: 'cp-staff-review',
        name: 'Staff Review',
        stage: 'review',
        roles: ['reviewer'],
        pattern: 'six-dimension-checklist',
        mandatory: true,
        file_path: 'core/skills/review/staff-review/SKILL.md',
      },
      'code-simplification': {
        id: 'cp-simplify',
        name: 'Code Simplification',
        stage: 'simplify',
        roles: ['reviewer'],
        pattern: 'simplification-checklist',
        mandatory: false,
        file_path: 'core/skills/review/code-simplification/SKILL.md',
      },
      'ship-pipeline': {
        id: 'cp-ship',
        name: 'Ship Pipeline',
        stage: 'ship',
        roles: ['shipper'],
        pattern: 'gated-release',
        mandatory: true,
        file_path: 'core/skills/ship/ship-pipeline/SKILL.md',
      },
    },
  });
}

function makeSkillContent(id: string, name: string, stage: string): string {
  return `---
id: ${id}
name: "${name}"
stage: ${stage}
roles: [implementer]
pattern: test-pattern
mandatory: true
depends: []
version: "3.0"
---

# ${name}

## 执行流程

### Step 1: Do something

Action description here.

## 产出物

- Output file
`;
}

describe('PipelineExecutor', () => {
  let executor: PipelineExecutor;

  beforeEach(() => {
    vi.clearAllMocks();

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockImplementation(((path: string) => {
      if (typeof path === 'string' && path.includes('registry.yaml')) {
        return makeRegistryYaml();
      }
      if (typeof path === 'string' && path.includes('pipeline.yaml')) {
        return makePipelineYaml();
      }
      return '';
    }) as unknown as typeof fs.readFileSync);

    mockedFsPromises.readFile.mockImplementation(((path: string) => {
      if (typeof path === 'string' && path.includes('registry.yaml')) {
        return Promise.resolve(makeRegistryYaml());
      }
      if (typeof path === 'string' && path.includes('pipeline.yaml')) {
        return Promise.resolve(makePipelineYaml());
      }
      if (typeof path === 'string' && path.endsWith('SKILL.md')) {
        return Promise.resolve(makeSkillContent('test', 'Test Skill', 'spec'));
      }
      return Promise.resolve('');
    }) as unknown as typeof fsPromises.readFile);

    mockedFsPromises.mkdir.mockResolvedValue(undefined);
    mockedFsPromises.writeFile.mockResolvedValue(undefined);
    mockedFsPromises.readdir.mockResolvedValue([]);
    mockedExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
    mockedSafeExec.mockResolvedValue({ stdout: '', stderr: '' });
  });

  describe('execute() — 正常流程', () => {
    it('应返回 PipelineExecutionResult 结构', async () => {
      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result).toHaveProperty('completedStages');
      expect(result).toHaveProperty('gateResults');
      expect(result).toHaveProperty('skillsLoaded');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('success');
    });

    it('所有 gate 通过时 success=true 且 completedStages 包含所有阶段', async () => {
      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.completedStages).toEqual(['spec', 'plan', 'build', 'test', 'review', 'simplify', 'ship']);
      expect(result.failedAt).toBeUndefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('每个阶段应有对应的 gateResult', async () => {
      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.gateResults.size).toBe(7);
      expect(result.gateResults.has('spec')).toBe(true);
      expect(result.gateResults.has('ship')).toBe(true);
    });
  });

  describe('execute() — 中间阶段失败', () => {
    it('gate 失败时应提前终止，failedAt 指向失败阶段', async () => {
      let callCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedSafeExec as any).mockImplementation((_cmd: string) => {
        callCount++;
        if (callCount > 2) return Promise.reject(new Error('Build failed'));
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.failedAt).toBeDefined();
      expect(result.completedStages.length).toBeLessThan(7);
    });
  });

  describe('execute() — fromStage 参数', () => {
    it('从指定阶段开始执行', async () => {
      executor = new PipelineExecutor({ fromStage: 'test', dryRun: true });
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.completedStages).not.toContain('spec');
      expect(result.completedStages).not.toContain('plan');
      expect(result.completedStages).not.toContain('build');
      expect(result.completedStages).toContain('test');
      expect(result.completedStages).toContain('review');
      expect(result.completedStages).toContain('simplify');
      expect(result.completedStages).toContain('ship');
    });

    it('无效 fromStage 应抛出错误', async () => {
      executor = new PipelineExecutor({ fromStage: 'invalid' as any });
      await expect(executor.execute()).rejects.toThrow('Invalid fromStage "invalid"');
    });
  });

  describe('execute() — pipeline.yaml 缺失或格式错误', () => {
    it('pipeline.yaml 不存在时应抛出错误', async () => {
      mockedFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));

      executor = new PipelineExecutor({ dryRun: true });
      await expect(executor.execute()).rejects.toThrow();
    });

    it('pipeline.yaml 缺少 stages 段应抛出错误', async () => {
      mockedFsPromises.readFile.mockResolvedValue(JSON.stringify({ version: '3.0.0' }));

      executor = new PipelineExecutor({ dryRun: true });
      await expect(executor.execute()).rejects.toThrow('pipeline.yaml');
    });
  });

  describe('execute() — stage 未定义或缺少 gate', () => {
    it('stage 未定义时应跳过并继续', async () => {
      const stages = {
        spec: { gate: 'spec_gate', capsules: { mandatory: [], optional: [] } },
        plan: { gate: 'plan_gate', capsules: { mandatory: [], optional: [] } },
      };
      mockedFsPromises.readFile.mockImplementation(((path: string) => {
        if (typeof path === 'string' && path.includes('pipeline.yaml')) {
          return Promise.resolve(makePipelineYaml(stages));
        }
        if (typeof path === 'string' && path.includes('registry.yaml')) {
          return Promise.resolve(makeRegistryYaml());
        }
        return Promise.resolve('');
      }) as unknown as typeof fsPromises.readFile);

      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.completedStages).toContain('spec');
      expect(result.completedStages).toContain('plan');
      expect(result.completedStages.length).toBeGreaterThanOrEqual(2);
    });

    it('stage 缺少 gate 时应跳过', async () => {
      const stages = {
        spec: { gate: 'spec_gate', capsules: { mandatory: [], optional: [] } },
        plan: { capsules: { mandatory: [], optional: [] } },
        build: { gate: 'build_gate', capsules: { mandatory: [], optional: [] } },
      };
      mockedFsPromises.readFile.mockImplementation(((path: string) => {
        if (typeof path === 'string' && path.includes('pipeline.yaml')) {
          return Promise.resolve(makePipelineYaml(stages));
        }
        if (typeof path === 'string' && path.includes('registry.yaml')) {
          return Promise.resolve(makeRegistryYaml());
        }
        return Promise.resolve('');
      }) as unknown as typeof fsPromises.readFile);

      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.completedStages).toContain('spec');
      expect(result.completedStages).not.toContain('plan');
      expect(result.completedStages).toContain('build');
    });
  });

  describe('execute() — mandatory skill 未找到', () => {
    it('应输出警告但不阻塞执行', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const stages = {
        spec: {
          gate: 'spec_gate',
          capsules: { mandatory: ['nonexistent-skill'], optional: [] },
        },
      };
      mockedFsPromises.readFile.mockImplementation(((path: string) => {
        if (typeof path === 'string' && path.includes('pipeline.yaml')) {
          return Promise.resolve(makePipelineYaml(stages));
        }
        if (typeof path === 'string' && path.includes('registry.yaml')) {
          return Promise.resolve(makeRegistryYaml());
        }
        return Promise.resolve('');
      }) as unknown as typeof fsPromises.readFile);

      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mandatory skill "nonexistent-skill" not found')
      );

      warnSpy.mockRestore();
    });
  });

  describe('execute() — 进度文件写入', () => {
    it('每个阶段完成后应写入进度文件', async () => {
      executor = new PipelineExecutor({ dryRun: true });
      await executor.execute();

      expect(mockedFsPromises.mkdir).toHaveBeenCalled();
      expect(mockedFsPromises.writeFile).toHaveBeenCalled();
    });

    it('进度文件写入失败不应阻塞执行', async () => {
      mockedFsPromises.writeFile.mockRejectedValue(new Error('Write failed'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      executor = new PipelineExecutor({ dryRun: true });
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('execute() — strictness 参数', () => {
    it('应将 strictness 传递给 GateRunner', async () => {
      executor = new PipelineExecutor({ strictness: 'L1-lightweight', dryRun: true });
      const result = await executor.execute();

      expect(result.success).toBe(true);
      for (const [, gateResult] of result.gateResults) {
        expect(gateResult.level).toBe('L1-lightweight');
      }
    });
  });
});
