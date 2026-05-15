import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionEngine } from '../evolution/engine.js';
import * as fsPromises from 'fs/promises';

vi.mock('fs/promises');
vi.mock('../metrics-collector.js', () => ({
  MetricsCollector: vi.fn().mockImplementation(() => ({
    recordSkillExecution: vi.fn().mockResolvedValue(undefined),
    recordGate: vi.fn().mockResolvedValue(undefined),
    getAggregateMetrics: vi.fn().mockResolvedValue({
      totalRuns: 0,
      gatePassRate: 0,
      avgGateDurationMs: 0,
      avgTokenUsage: 0,
      byStage: {},
      byGate: {},
    }),
    getRunId: vi.fn().mockReturnValue('evo-test-001'),
  })),
}));

const mockedFsPromises = vi.mocked(fsPromises);

function makeBenchmarkYaml(): string {
  return JSON.stringify({
    tasks: [
      {
        id: 'task-1',
        name: 'Test Task 1',
        description: 'A test benchmark task',
        timeout_minutes: 5,
        success_criteria: {
          correctness: true,
          completeness: 0.8,
        },
      },
      {
        id: 'task-2',
        name: 'Test Task 2',
        description: 'Another test benchmark task',
        timeout_minutes: 3,
        success_criteria: {
          correctness: true,
        },
      },
    ],
  });
}

describe('EvolutionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsPromises.readFile.mockResolvedValue(makeBenchmarkYaml());
    mockedFsPromises.mkdir.mockResolvedValue(undefined);
    mockedFsPromises.writeFile.mockResolvedValue(undefined);
    mockedFsPromises.readdir.mockResolvedValue([]);
  });

  describe('run() — 迭代循环', () => {
    it('应返回 EvolutionSummary 结构', async () => {
      const engine = new EvolutionEngine({ maxIterations: 1 });
      const summary = await engine.run();

      expect(summary).toHaveProperty('totalIterations');
      expect(summary).toHaveProperty('finalPassRate');
      expect(summary).toHaveProperty('terminatedReason');
      expect(summary).toHaveProperty('improvementTrend');
      expect(typeof summary.totalIterations).toBe('number');
      expect(typeof summary.finalPassRate).toBe('number');
      expect(typeof summary.terminatedReason).toBe('string');
    });

    it('应在 maxIterations 次后终止', async () => {
      const engine = new EvolutionEngine({ maxIterations: 2 });
      const summary = await engine.run();

      expect(summary.totalIterations).toBeLessThanOrEqual(2);
      expect(summary.terminatedReason).toBeDefined();
    });

    it('单次迭代应正常完成', async () => {
      const engine = new EvolutionEngine({ maxIterations: 1 });
      const summary = await engine.run();

      expect(summary.totalIterations).toBe(1);
      expect(summary.finalPassRate).toBeGreaterThanOrEqual(0);
      expect(summary.finalPassRate).toBeLessThanOrEqual(1);
    });
  });

  describe('checkTermination() — 终止条件', () => {
    it('达到目标通过率时应终止', async () => {
      const engine = new EvolutionEngine({
        maxIterations: 10,
        targetPassRate: 0.01,
      });
      const summary = await engine.run();

      expect(summary.terminatedReason).toBe('target_reached');
    });

    it('maxIterations 为 0 时应立即终止', async () => {
      const engine = new EvolutionEngine({ maxIterations: 0 });
      const summary = await engine.run();

      expect(summary.totalIterations).toBe(0);
    });
  });

  describe('benchmark 文件加载', () => {
    it('benchmark 文件不存在时应抛出错误', async () => {
      mockedFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));

      const engine = new EvolutionEngine({ maxIterations: 1 });
      await expect(engine.run()).rejects.toThrow('Failed to load benchmark');
    });
  });

  describe('benchmarkFilter', () => {
    it('应只运行过滤后的任务', async () => {
      const engine = new EvolutionEngine({
        maxIterations: 1,
        benchmarkFilter: ['task-1'],
      });
      const summary = await engine.run();

      expect(summary.totalIterations).toBe(1);
    });
  });
});
