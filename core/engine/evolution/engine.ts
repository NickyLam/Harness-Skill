import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  EvolutionConfig,
  EvolutionSummary,
  EvidenceReport,
  PredictionRecord,
  RunResult,
  BenchmarkTask,
  FailurePattern,
  ComponentImprovement,
} from './types.js';
import { MetricsCollector } from '../metrics-collector.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..');
const EVOLUTION_DIR = join(PROJECT_ROOT, '.harness', 'evolution');
const BENCHMARK_PATH = join(PROJECT_ROOT, 'templates', 'evolution', 'benchmark-tasks.yaml');

export class EvolutionEngine {
  private config: EvolutionConfig;
  private metrics: MetricsCollector;
  private history: Map<number, EvidenceReport> = new Map();
  private predictions: PredictionRecord[] = [];

  private startTime: number = 0;

  constructor(config?: Partial<EvolutionConfig>) {
    this.config = {
      maxIterations: 10,
      targetPassRate: 0.95,
      predictionAccuracyThreshold: 0.8,
      noImprovementLimit: 2,
      simulateOnly: true,
      ...config,
    };
    this.metrics = new MetricsCollector(`evolution-${Date.now()}`);
  }

  async run(): Promise<EvolutionSummary> {
    this.startTime = Date.now();
    console.log('🧬 Evolution Engine starting...');
    console.log(`   Max iterations: ${this.config.maxIterations}`);
    console.log(`   Target pass rate: ${(this.config.targetPassRate * 100).toFixed(0)}%`);
    console.log('');

    const tasks = await this.loadBenchmarkTasks();
    const passRates: number[] = [];
    let lastImprovementIteration = 0;

    for (let i = 1; i <= this.config.maxIterations; i++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Iteration ${i}/${this.config.maxIterations}`);
      console.log(`${'='.repeat(60)}`);

      // Step 1: EVALUATE
      console.log('\n📊 Step 1: EVALUATE — Running benchmark tasks...');
      const rollouts = await this.evaluate(tasks, i);

      // Step 2: ANALYZE
      console.log('\n🔬 Step 2: ANALYZE — Distilling evidence...');
      const report = await this.analyze(rollouts, i);
      this.history.set(i, report);
      passRates.push(report.summary.overallPassRate);

      // 终止条件检查
      const shouldTerminate = this.checkTermination(passRates, i, lastImprovementIteration);
      if (shouldTerminate.terminate) {
        return this.buildSummary(passRates, shouldTerminate.reason, i);
      }

      if (!this.isImproving(passRates)) {
        lastImprovementIteration = i;
      }

      // Step 3: IMPROVE
      console.log('\n🛠️  Step 3: IMPROVE — Generating improvements...');
      const newPredictions = await this.improve(report, i);
      this.predictions.push(...newPredictions);

      // 记录度量
      await this.metrics.recordSkillExecution({
        skillId: 'evolution-loop',
        stage: 'evolution',
        durationMs: report.summary.avgDurationMs * tasks.length,
        inputChars: JSON.stringify(report).length,
        outputChars: newPredictions.length * 200,
        success: true,
      });

      console.log(`\n✅ Iteration ${i} complete. Pass rate: ${(report.summary.overallPassRate * 100).toFixed(1)}%`);
    }

    return this.buildSummary(passRates, 'max_iterations', this.config.maxIterations);
  }

  private async loadBenchmarkTasks(): Promise<BenchmarkTask[]> {
    try {
      const content = await readFile(BENCHMARK_PATH, 'utf-8');
      const parsed = parseYaml(content) as { tasks: BenchmarkTask[] };
      return parsed.tasks;
    } catch (err) {
      throw new Error(`Failed to load benchmark tasks from ${BENCHMARK_PATH}: ${(err as Error).message}`);
    }
  }

  private async evaluate(tasks: BenchmarkTask[], iteration: number): Promise<RunResult[]> {
    const results: RunResult[] = [];

    if (this.config.simulateOnly !== false) {
      console.warn(
        '\n⚠️  [EvolutionEngine] SIMULATE MODE ENABLED\n' +
        '   evaluate() is using Math.random() to simulate results.\n' +
        '   To enable real execution, set config.simulateOnly = false\n' +
        '   and provide a taskRunner implementation.\n'
      );
    }

    for (const task of tasks) {
      if (this.config.benchmarkFilter && !this.config.benchmarkFilter.includes(task.id)) {
        continue;
      }

      console.log(`   Running ${task.id} (${task.name})...`);

      const result: RunResult = {
        taskId: task.id,
        iteration,
        startTime: new Date().toISOString(),
        success: false,
        criteriaMet: {},
        tokenEstimate: 0,
      };

      try {
        if (this.config.simulateOnly !== false) {
          result.success = Math.random() > 0.3;
          result.endTime = new Date().toISOString();
          result.durationMs = Math.floor(Math.random() * task.timeout_minutes * 60 * 1000);
          result.tokenEstimate = Math.floor(Math.random() * 15000) + 3000;

          for (const [key, value] of Object.entries(task.success_criteria)) {
            result.criteriaMet[key] = result.success
              ? typeof value === 'number'
                ? Math.random() > 0.2
                : true
              : false;
          }
        } else if (this.config.taskRunner) {
          const taskResult = await this.config.taskRunner(task);
          Object.assign(result, taskResult);
          result.iteration = iteration;
        } else {
          throw new Error('Real task execution not yet implemented. Provide config.taskRunner.');
        }
      } catch (err) {
        result.error = (err as Error).message;
        result.success = false;
      }

      results.push(result);

      const icon = result.success ? '✅' : '❌';
      console.log(
        `      ${icon} ${task.id}: ${result.success ? 'PASSED' : 'FAILED'}${result.durationMs ? ` (${result.durationMs}ms)` : ''}`,
      );
    }
    return results;
  }

  private async analyze(results: RunResult[], iteration: number): Promise<EvidenceReport> {
    const completed = results.filter((r) => r.success).length;
    const total = results.length;
    const passRate = total > 0 ? completed / total : 0;
    const avgDuration = results.reduce((s, r) => s + (r.durationMs ?? 0), 0) / Math.max(total, 1);
    const avgTokens = results.reduce((s, r) => s + r.tokenEstimate, 0) / Math.max(total, 1);

    const failurePatterns = this.identifyFailurePatterns(results);
    const componentMapping = this.mapToComponents(failurePatterns);

    const report: EvidenceReport = {
      iteration,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTasks: total,
        completedTasks: completed,
        overallPassRate: passRate,
        avgDurationMs: avgDuration,
        avgTokenUsage: avgTokens,
        errorRate: (total - completed) / Math.max(total, 1),
      },
      taskDetails: results,
      failurePatterns,
      componentMapping,
      recommendations: this.generateRecommendations(componentMapping),
    };

    await this.saveReport(report);
    return report;
  }

  private identifyFailurePatterns(results: RunResult[]): FailurePattern[] {
    const patterns: Map<string, { count: number; tasks: string[] }> = new Map();

    for (const r of results.filter((r) => !r.success)) {
      const pattern = r.error?.slice(0, 80) || 'unknown_failure';
      const existing = patterns.get(pattern) || { count: 0, tasks: [] };
      existing.count++;
      existing.tasks.push(r.taskId);
      patterns.set(pattern, existing);
    }

    return Array.from(patterns.entries()).map(([pattern, data]) => ({
      pattern,
      frequency: data.count,
      affectedTasks: data.tasks,
      rootComponentClass: this.inferComponentClass(pattern),
      example: pattern,
    }));
  }

  private inferComponentClass(pattern: string): string {
    if (pattern.includes('type') || pattern.includes('compile')) return 'tool_implementation';
    if (pattern.includes('test') || pattern.includes('assert')) return 'skill';
    if (pattern.includes('timeout') || pattern.includes('memory')) return 'middleware';
    if (pattern.includes('missing') || pattern.includes('not found')) return 'system_prompt';
    return 'unknown';
  }

  private mapToComponents(patterns: FailurePattern[]): ComponentImprovement[] {
    const byComponent = new Map<string, FailurePattern[]>();
    for (const p of patterns) {
      const existing = byComponent.get(p.rootComponentClass) || [];
      existing.push(p);
      byComponent.set(p.rootComponentClass, existing);
    }

    return Array.from(byComponent.entries()).map(([component, patterns]) => ({
      componentClass: component,
      priority: patterns.some((p) => p.frequency >= 2) ? ('high' as const) : ('medium' as const),
      currentScore: Math.max(0, 100 - patterns.reduce((s, p) => s + p.frequency * 10, 0)),
      reason: `${patterns.length} failure pattern(s): ${patterns.map((p) => p.pattern.slice(0, 40)).join(', ')}`,
      suggestedAction: `Review and improve ${component}-related components`,
    }));
  }

  private generateRecommendations(mapping: ComponentImprovement[]): string[] {
    const recs: string[] = [];
    for (const m of mapping.sort((a, b) => a.currentScore - b.currentScore)) {
      recs.push(`[${m.priority.toUpperCase()}] ${m.componentClass}: ${m.suggestedAction} (score: ${m.currentScore}/100)`);
    }
    return recs;
  }

  private async improve(report: EvidenceReport, iteration: number): Promise<PredictionRecord[]> {
    const predictions: PredictionRecord[] = [];

    for (const component of report.componentMapping.slice(0, 2)) {
      const prediction: PredictionRecord = {
        id: `pred-${iteration}-${component.componentClass}`,
        iteration,
        component: component.componentClass,
        file: `core/skills/${this.guessSkillFile(component.componentClass)}/SKILL.md`,
        changeDescription: `Improve based on: ${component.reason.slice(0, 100)}`,
        predictedEffect: `Increase pass rate for tasks affected by ${component.componentClass}`,
        verificationMethod: 'Re-run benchmarks in next iteration and compare gate results',
        createdAt: new Date().toISOString(),
        outcome: 'pending',
      };
      predictions.push(prediction);
    }

    await this.savePredictions(predictions, iteration);
    return predictions;
  }

  private guessSkillFile(componentClass: string): string {
    const mapping: Record<string, string> = {
      system_prompt: 'cross-cutting/orchestrator',
      tool_implementation: 'build/tdd',
      skill: 'spec/brainstorming',
      middleware: 'build/subagent-driven-dev',
      sub_agent: 'review/staff-review',
      long_term_memory: 'cross-cutting/memory-management',
      unknown: 'spec/brainstorming',
    };
    return mapping[componentClass] || mapping.unknown;
  }

  private async saveReport(report: EvidenceReport): Promise<void> {
    await mkdir(join(EVOLUTION_DIR, 'reports'), { recursive: true });
    const filePath = join(EVOLUTION_DIR, 'reports', `iteration-${report.iteration}.md`);
    const content = this.formatReportAsMarkdown(report);
    await writeFile(filePath, content);
  }

  private async savePredictions(predictions: PredictionRecord[], iteration: number): Promise<void> {
    await mkdir(join(EVOLUTION_DIR, 'predictions'), { recursive: true });
    const filePath = join(EVOLUTION_DIR, 'predictions', `iteration-${iteration}.json`);
    await writeFile(filePath, JSON.stringify(predictions, null, 2));
  }

  private formatReportAsMarkdown(report: EvidenceReport): string {
    const lines: string[] = [
      `# Iteration ${report.iteration}`,
      '',
      `**Date**: ${report.generatedAt}`,
      '**Status**: COMPLETED',
      '',
      '## Summary',
      '',
      `- **Total Tasks**: ${report.summary.totalTasks}`,
      `- **Completed**: ${report.summary.completedTasks}`,
      `- **Pass Rate**: ${(report.summary.overallPassRate * 100).toFixed(1)}%`,
      `- **Avg Duration**: ${Math.round(report.summary.avgDurationMs)}ms`,
      `- **Avg Tokens**: ${Math.round(report.summary.avgTokenUsage)}`,
      `- **Error Rate**: ${(report.summary.errorRate * 100).toFixed(1)}%`,
      '',
      '## Task Details',
      '',
      ...report.taskDetails.map(
        (r) =>
          `- ${r.success ? '✅' : '❌'} **${r.taskId}**: ${r.durationMs ? `${r.durationMs}ms` : 'N/A'}${r.error ? ` — ${r.error}` : ''}`,
      ),
      '',
    ];

    if (report.recommendations.length > 0) {
      lines.push(
        '## Recommendations',
        '',
        ...report.recommendations.map((r) => `- ${r}`),
        '',
      );
    }

    return lines.join('\n');
  }

  private checkTermination(
    passRates: number[],
    iteration: number,
    lastImprovement: number,
  ): { terminate: boolean; reason: EvolutionSummary['terminatedReason'] } {
    const currentRate = passRates[passRates.length - 1] || 0;

    if (currentRate >= this.config.targetPassRate) {
      return { terminate: true, reason: 'target_reached' };
    }

    if (iteration >= this.config.maxIterations) {
      return { terminate: true, reason: 'max_iterations' };
    }

    if (passRates.length >= 3) {
      const recent3 = passRates.slice(-3);
      const confirmed = recent3.filter((r) => r >= this.config.predictionAccuracyThreshold).length;
      if (confirmed >= 3) {
        return { terminate: true, reason: 'prediction_accuracy' };
      }
    }

    if (iteration - lastImprovement >= this.config.noImprovementLimit && iteration > 3) {
      return { terminate: true, reason: 'no_improvement' };
    }

    return { terminate: false, reason: 'manual' as const };
  }

  private isImproving(passRates: number[]): boolean {
    if (passRates.length < 2) return true;
    const latest = passRates[passRates.length - 1];
    const previous = passRates[passRates.length - 2];
    return latest >= previous;
  }

  private buildSummary(passRates: number[], reason: EvolutionSummary['terminatedReason'], finalIteration: number): EvolutionSummary {
    const confirmedPredictions = this.predictions.filter((p) => p.outcome === 'confirmed').length;
    return {
      totalIterations: finalIteration,
      terminatedReason: reason,
      finalPassRate: passRates[passRates.length - 1] || 0,
      bestPassRate: Math.max(...passRates, 0),
      improvementTrend: passRates,
      predictionsMade: this.predictions.length,
      predictionsConfirmed: confirmedPredictions,
      totalDurationMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }
}
