import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsCollector } from '../metrics-collector.js';
import * as fs from 'node:fs/promises';
import type { AggregateMetrics } from '../metrics-collector.js';

vi.mock('node:fs/promises');

const mockedFs = vi.mocked(fs);

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector('test-run-001');
    vi.clearAllMocks();

    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
  });

  describe('recordGate() — 追加门禁记录到 JSONL', () => {
    it('应调用 mkdir 创建 metrics 目录', async () => {
      await collector.recordGate({
        gateId: 'spec_gate',
        passed: true,
        durationMs: 100,
        stage: 'spec',
      });

      expect(mockedFs.mkdir).toHaveBeenCalled();
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('应写入包含正确字段的 JSONL 记录', async () => {
      const writeCalls: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedFs.writeFile.mockImplementation(async (_path: string, data: string | Uint8Array) => {
        writeCalls.push(typeof data === 'string' ? data : data.toString());
      });

      await collector.recordGate({
        gateId: 'build_gate',
        passed: false,
        durationMs: 250,
        stage: 'build',
      });

      expect(writeCalls.length).toBe(1);
      const writtenLine = writeCalls[0];
      const record = JSON.parse(writtenLine);

      expect(record.runId).toBe('test-run-001');
      expect(record.gateId).toBe('build_gate');
      expect(record.passed).toBe(false);
      expect(record.durationMs).toBe(250);
      expect(record.stage).toBe('build');
      expect(record.tokenEstimate).toBe(0);
      expect(record.timestamp).toBeDefined();
    });

    it('未指定 stage 时应根据 gateId 自动推断', async () => {
      const writeCalls: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedFs.writeFile.mockImplementation(async (_path: string, data: string | Uint8Array) => {
        writeCalls.push(typeof data === 'string' ? data : data.toString());
      });

      await collector.recordGate({
        gateId: 'test_gate',
        passed: true,
        durationMs: 500,
      });

      const record = JSON.parse(writeCalls[0]);
      expect(record.stage).toBe('test');
    });
  });

  describe('recordSkillExecution() — 记录 skill 执行并估算 token', () => {
    it('应基于字符数计算 token 估算值', async () => {
      const writeCalls: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedFs.writeFile.mockImplementation(async (_path: string, data: string | Uint8Array) => {
        writeCalls.push(typeof data === 'string' ? data : data.toString());
      });

      await collector.recordSkillExecution({
        skillId: 'brainstorming',
        stage: 'spec',
        durationMs: 3000,
        inputChars: 1000,
        outputChars: 500,
        success: true,
      });

      const record = JSON.parse(writeCalls[0]);
      expect(record.tokenEstimate).toBeGreaterThan(0);
      expect(record.tokenEstimate).toBe(Math.ceil(1500 / 3.5));
    });

    it('token 估算应为零当输入输出均为零时', async () => {
      const writeCalls: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedFs.writeFile.mockImplementation(async (_path: string, data: string | Uint8Array) => {
        writeCalls.push(typeof data === 'string' ? data : data.toString());
      });

      await collector.recordSkillExecution({
        skillId: 'empty_skill',
        stage: 'spec',
        durationMs: 0,
        inputChars: 0,
        outputChars: 0,
        success: false,
      });

      const record = JSON.parse(writeCalls[0]);
      expect(record.tokenEstimate).toBe(0);
    });

    it('metadata 应包含 skillId、inputChars、outputChars', async () => {
      const writeCalls: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedFs.writeFile.mockImplementation(async (_path: string, data: string | Uint8Array) => {
        writeCalls.push(typeof data === 'string' ? data : data.toString());
      });

      await collector.recordSkillExecution({
        skillId: 'tdd',
        stage: 'build',
        durationMs: 1200,
        inputChars: 2000,
        outputChars: 800,
        success: true,
      });

      const record = JSON.parse(writeCalls[0]);
      expect(record.metadata).toEqual({
        skillId: 'tdd',
        inputChars: 2000,
        outputChars: 800,
      });
    });
  });

  describe('getAggregateMetrics() — 聚合统计', () => {
    function setupJsonlFiles(records: Record<string, unknown>[]): void {
      const jsonlContent = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
      mockedFs.readdir.mockResolvedValue(['2026-01-15.jsonl']);
      mockedFs.readFile.mockResolvedValue(jsonlContent);
    }

    it('空数据集应返回零值而非崩溃', async () => {
      setupJsonlFiles([]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.totalRuns).toBe(0);
      expect(metrics.gatePassRate).toBe(0);
      expect(metrics.avgGateDurationMs).toBe(0);
      expect(metrics.avgTokenUsage).toBe(0);
      expect(Object.keys(metrics.byStage)).toHaveLength(0);
      expect(Object.keys(metrics.byGate)).toHaveLength(0);
    });

    it('gatePassRate 应正确计算通过率', async () => {
      setupJsonlFiles([
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'spec_gate', passed: true, durationMs: 100, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'r1', stage: 'plan', gateId: 'plan_gate', passed: true, durationMs: 200, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'r1', stage: 'build', gateId: 'build_gate', passed: false, durationMs: 300, tokenEstimate: 0 },
      ]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.gatePassRate).toBeCloseTo(2 / 3, 5);
    });

    it('avgGateDurationMs 应正确计算平均耗时', async () => {
      setupJsonlFiles([
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'g1', passed: true, durationMs: 100, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'g2', passed: true, durationMs: 200, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'g3', passed: true, durationMs: 300, tokenEstimate: 0 },
      ]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.avgGateDurationMs).toBe(200);
    });

    it('byStage 应按阶段分组统计', async () => {
      setupJsonlFiles([
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'spec_gate', passed: true, durationMs: 100, tokenEstimate: 10 },
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'spec_gate', passed: true, durationMs: 150, tokenEstimate: 20 },
        { timestamp: 'T', runId: 'r1', stage: 'build', gateId: 'build_gate', passed: false, durationMs: 300, tokenEstimate: 30 },
        { timestamp: 'T', runId: 'r1', stage: 'build', gateId: 'build_gate', passed: true, durationMs: 400, tokenEstimate: 40 },
        { timestamp: 'T', runId: 'r1', stage: 'test', gateId: 'test_gate', passed: true, durationMs: 500, tokenEstimate: 50 },
      ]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.byStage.spec).toEqual({ count: 2, passRate: 1.0, avgDuration: 125 });
      expect(metrics.byStage.build).toEqual({ count: 2, passRate: 0.5, avgDuration: 350 });
      expect(metrics.byStage.test).toEqual({ count: 1, passRate: 1.0, avgDuration: 500 });
    });

    it('byGate 应按门禁 ID 分组统计', async () => {
      setupJsonlFiles([
        { timestamp: 'T', runId: 'r1', stage: 'spec', gateId: 'spec_gate', passed: true, durationMs: 100, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'r2', stage: 'spec', gateId: 'spec_gate', passed: false, durationMs: 200, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'r1', stage: 'build', gateId: 'build_gate', passed: true, durationMs: 300, tokenEstimate: 0 },
      ]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.byGate.spec_gate).toEqual({ runs: 2, passRate: 0.5, avgDuration: 150 });
      expect(metrics.byGate.build_gate).toEqual({ runs: 1, passRate: 1.0, avgDuration: 300 });
    });

    it('totalRuns 应统计不同 runId 的数量', async () => {
      setupJsonlFiles([
        { timestamp: 'T', runId: 'run-a', stage: 's', gateId: 'g1', passed: true, durationMs: 100, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'run-b', stage: 's', gateId: 'g1', passed: true, durationMs: 100, tokenEstimate: 0 },
        { timestamp: 'T', runId: 'run-a', stage: 's', gateId: 'g2', passed: true, durationMs: 100, tokenEstimate: 0 },
      ]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.totalRuns).toBe(2);
    });

    it('avgTokenUsage 应正确计算平均 token 使用量', async () => {
      setupJsonlFiles([
        { timestamp: 'T', runId: 'r1', stage: 's', gateId: 'g1', passed: true, durationMs: 100, tokenEstimate: 350 },
        { timestamp: 'T', runId: 'r1', stage: 's', gateId: 'g2', passed: true, durationMs: 100, tokenEstimate: 700 },
      ]);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.avgTokenUsage).toBe(525);
    });

    it('多次记录后聚合结果应反映全部数据', async () => {
      const allRecords: Record<string, unknown>[] = [];
      for (let i = 0; i < 20; i++) {
        allRecords.push({
          timestamp: new Date().toISOString(),
          runId: `run-${i < 10 ? 'a' : 'b'}`,
          stage: ['spec', 'plan', 'build'][i % 3],
          gateId: ['spec_gate', 'plan_gate', 'build_gate'][i % 3],
          passed: i % 4 !== 0,
          durationMs: 100 + i * 50,
          tokenEstimate: i * 10,
        });
      }

      setupJsonlFiles(allRecords);

      const metrics = await collector.getAggregateMetrics() as AggregateMetrics;

      expect(metrics.totalRuns).toBeGreaterThan(0);
      expect(metrics.gatePassRate).toBeGreaterThanOrEqual(0);
      expect(metrics.gatePassRate).toBeLessThanOrEqual(1);
      expect(Object.keys(metrics.byStage).length).toBeGreaterThan(0);
      expect(Object.keys(metrics.byGate).length).toBeGreaterThan(0);
    });
  });

  describe('getRunId()', () => {
    it('应返回构造时指定的 runId', () => {
      expect(collector.getRunId()).toBe('test-run-001');
    });

    it('未指定 runId 时应自动生成格式正确的 ID', () => {
      const autoCollector = new MetricsCollector();
      const runId = autoCollector.getRunId();

      expect(runId).toMatch(/^run-\d+-[a-z0-9]{6}$/);
    });
  });

  describe('边界情况', () => {
    it('readdir 失败时应返回空聚合数据而非崩溃', async () => {
      mockedFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.totalRuns).toBe(0);
      expect(metrics.gatePassRate).toBe(0);
    });

    it('JSONL 中包含无效行时应跳过而不崩溃', async () => {
      const mixedContent = [
        JSON.stringify({ timestamp: 'T', runId: 'r1', stage: 's', gateId: 'g1', passed: true, durationMs: 100, tokenEstimate: 0 }),
        'this is not valid json',
        '',
        JSON.stringify({ timestamp: 'T', runId: 'r1', stage: 's', gateId: 'g2', passed: false, durationMs: 200, tokenEstimate: 0 }),
        '{broken json',
      ].join('\n');

      mockedFs.readdir.mockResolvedValue(['2026-01-15.jsonl']);
      mockedFs.readFile.mockResolvedValue(mixedContent);

      const metrics = await collector.getAggregateMetrics();

      expect(metrics.totalRuns).toBe(1);
      expect(metrics.avgGateDurationMs).toBe(150);
    });

    it('writeFile 失败时 recordGate 应抛出错误', async () => {
      mockedFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        collector.recordGate({ gateId: 'test', passed: true, durationMs: 0 })
      ).rejects.toThrow('Failed to write');
    });
  });

  describe('gateToStage() 完整映射', () => {
    it('recordGate 写入的 JSONL 应包含正确的 stage 字段', async () => {
      const gateMappings: Record<string, string> = {
        spec_gate: 'spec',
        plan_gate: 'plan',
        build_gate: 'build',
        test_gate: 'test',
        review_gate: 'review',
        simplify_gate: 'simplify',
        ship_gate: 'ship',
      };

      for (const [gateId, expectedStage] of Object.entries(gateMappings)) {
        await collector.recordGate({ gateId, passed: true, durationMs: 10 });
        const lastCall = mockedFs.writeFile.mock.calls[mockedFs.writeFile.mock.calls.length - 1];
        const writtenLine = lastCall?.[1] as string;
        const record = JSON.parse(writtenLine.trim());
        expect(record.stage).toBe(expectedStage);
      }
    });

    it('未知 gateId 应映射到 unknown stage', async () => {
      await collector.recordGate({ gateId: 'custom_gate', passed: true, durationMs: 10 });
      const lastCall = mockedFs.writeFile.mock.calls[mockedFs.writeFile.mock.calls.length - 1];
      const writtenLine = lastCall?.[1] as string;
      const record = JSON.parse(writtenLine.trim());
      expect(record.stage).toBe('unknown');
    });
  });

  describe('mkdir 失败', () => {
    it('应抛出包含 "Failed to create" 的错误', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const failCollector = new MetricsCollector('/tmp/test-metrics-fail');
      await expect(
        failCollector.recordGate({ gateId: 'test', passed: true, durationMs: 0 })
      ).rejects.toThrow('Failed to create');
    });
  });
});
