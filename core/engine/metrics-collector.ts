import { writeFile, mkdir, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { MetricRecord } from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const METRICS_DIR = join(PROJECT_ROOT, '.harness', 'metrics');

interface StageAccumulator {
  count: number;
  totalPasses: number;
  totalDuration: number;
}

interface GateAccumulator {
  runs: number;
  totalPasses: number;
  totalDuration: number;
}

export interface AggregateMetrics {
  totalRuns: number;
  gatePassRate: number;
  avgGateDurationMs: number;
  avgTokenUsage: number;
  byStage: Record<string, { count: number; passRate: number; avgDuration: number }>;
  byGate: Record<string, { runs: number; passRate: number; avgDuration: number }>;
}

export class MetricsCollector {
  private currentRunId: string;

  constructor(runId?: string) {
    this.currentRunId = runId ?? this.generateRunId();
  }

  async recordGate(result: {
    gateId: string;
    passed: boolean;
    durationMs: number;
    stage?: string;
  }): Promise<void> {
    const record: MetricRecord = {
      timestamp: new Date().toISOString(),
      runId: this.currentRunId,
      stage: result.stage ?? this.gateToStage(result.gateId),
      gateId: result.gateId,
      passed: result.passed,
      durationMs: result.durationMs,
      tokenEstimate: 0,
    };
    await this.appendRecord(record);
  }

  async recordSkillExecution(result: {
    skillId: string;
    stage: string;
    durationMs: number;
    inputChars: number;
    outputChars: number;
    success: boolean;
  }): Promise<void> {
    const totalChars = result.inputChars + result.outputChars;
    const record: MetricRecord = {
      timestamp: new Date().toISOString(),
      runId: this.currentRunId,
      stage: result.stage,
      passed: result.success,
      durationMs: result.durationMs,
      tokenEstimate: this.estimateTokens(totalChars),
      metadata: {
        skillId: result.skillId,
        inputChars: result.inputChars,
        outputChars: result.outputChars,
      },
    };
    await this.appendRecord(record);
  }

  async getAggregateMetrics(): Promise<AggregateMetrics> {
    const records = await this.loadAllRecords();

    const gateRecords = records.filter((r): r is MetricRecord & { gateId: string } => r.gateId !== undefined && r.gateId !== '');

    const totalRuns = new Set(records.map((r) => r.runId)).size;
    const gatePassRate = this.calcPassRate(gateRecords);
    const avgGateDurationMs = this.calcAvgDuration(gateRecords);
    const avgTokenUsage = this.calcAvgTokens(records);
    const byStage = this.aggregateByStage(gateRecords);
    const byGate = this.aggregateByGate(gateRecords);

    return { totalRuns, gatePassRate, avgGateDurationMs, avgTokenUsage, byStage, byGate };
  }

  getRunId(): string {
    return this.currentRunId;
  }

  private async appendRecord(record: MetricRecord): Promise<void> {
    try {
      await mkdir(METRICS_DIR, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create metrics directory "${METRICS_DIR}": ${this.errMsg(err)}`);
    }

    const dateStr = new Date().toISOString().split('T')[0] ?? 'unknown';
    const filePath = join(METRICS_DIR, `${dateStr}.jsonl`);
    const line = JSON.stringify(record) + '\n';

    try {
      await writeFile(filePath, line, { flag: 'a' });
    } catch (err) {
      throw new Error(`Failed to write metric record to "${filePath}": ${this.errMsg(err)}`);
    }
  }

  private async loadAllRecords(): Promise<MetricRecord[]> {
    const records: MetricRecord[] = [];

    try {
      const files = await readdir(METRICS_DIR);
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const filePath = join(METRICS_DIR, file);
        const content = await this.safeReadFile(filePath);
        if (content === null) continue;

        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = this.safeParseJson<MetricRecord>(trimmed);
          if (parsed !== null) {
            records.push(parsed);
          }
        }
      }
    } catch {
      return [];
    }

    return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private safeParseJson<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private calcPassRate(gateRecords: MetricRecord[]): number {
    if (gateRecords.length === 0) return 0;
    const passes = gateRecords.filter((r) => r.passed).length;
    return passes / gateRecords.length;
  }

  private calcAvgDuration(records: MetricRecord[]): number {
    if (records.length === 0) return 0;
    const total = records.reduce((sum, r) => sum + r.durationMs, 0);
    return total / records.length;
  }

  private calcAvgTokens(records: MetricRecord[]): number {
    if (records.length === 0) return 0;
    const total = records.reduce((sum, r) => sum + r.tokenEstimate, 0);
    return total / records.length;
  }

  private aggregateByStage(
    gateRecords: MetricRecord[]
  ): Record<string, { count: number; passRate: number; avgDuration: number }> {
    const raw: Record<string, StageAccumulator> = {};

    for (const r of gateRecords) {
      if (!raw[r.stage]) {
        raw[r.stage] = { count: 0, totalPasses: 0, totalDuration: 0 };
      }
      const acc = raw[r.stage];
      acc.count += 1;
      acc.totalDuration += r.durationMs;
      if (r.passed) {
        acc.totalPasses += 1;
      }
    }

    const result: Record<string, { count: number; passRate: number; avgDuration: number }> = {};
    for (const [stage, acc] of Object.entries(raw)) {
      result[stage] = {
        count: acc.count,
        passRate: acc.count > 0 ? acc.totalPasses / acc.count : 0,
        avgDuration: acc.count > 0 ? acc.totalDuration / acc.count : 0,
      };
    }
    return result;
  }

  private aggregateByGate(
    gateRecords: MetricRecord[]
  ): Record<string, { runs: number; passRate: number; avgDuration: number }> {
    const raw: Record<string, GateAccumulator> = {};

    for (const r of gateRecords) {
      const gateId = r.gateId!;
      if (!raw[gateId]) {
        raw[gateId] = { runs: 0, totalPasses: 0, totalDuration: 0 };
      }
      const acc = raw[gateId];
      acc.runs += 1;
      acc.totalDuration += r.durationMs;
      if (r.passed) {
        acc.totalPasses += 1;
      }
    }

    const result: Record<string, { runs: number; passRate: number; avgDuration: number }> = {};
    for (const [gateId, acc] of Object.entries(raw)) {
      result[gateId] = {
        runs: acc.runs,
        passRate: acc.runs > 0 ? acc.totalPasses / acc.runs : 0,
        avgDuration: acc.runs > 0 ? acc.totalDuration / acc.runs : 0,
      };
    }
    return result;
  }

  private generateRunId(): string {
    const suffix = Math.random().toString(36).slice(2, 8);
    return `run-${Date.now()}-${suffix}`;
  }

  private gateToStage(gateId: string): string {
    const mapping: Record<string, string> = {
      spec_gate: 'spec',
      plan_gate: 'plan',
      build_gate: 'build',
      test_gate: 'test',
      review_gate: 'review',
      simplify_gate: 'simplify',
      ship_gate: 'ship',
    };
    return mapping[gateId] ?? 'unknown';
  }

  private estimateTokens(charCount: number): number {
    if (charCount <= 0) return 0;
    return Math.ceil(charCount / 3.5);
  }

  private errMsg(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
