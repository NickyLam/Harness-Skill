import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { parse as parseYaml } from 'yaml';
import type { Stage, GateResult, StrictnessLevel, SkillManifest } from './types.js';
import { GateRunner } from './gate-runner.js';
import { SkillLoader } from './skill-loader.js';
import { MetricsCollector } from './metrics-collector.js';
import { ProfileResolver } from './profile-resolver.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const PIPELINE_PATH = join(PROJECT_ROOT, 'core', 'pipeline.yaml');
const PROGRESS_PATH = join(PROJECT_ROOT, '.harness', 'progress', 'current.md');

const STAGE_ORDER: readonly Stage[] = [
  'spec',
  'plan',
  'build',
  'test',
  'review',
  'simplify',
  'ship',
] as const;

interface ParsedStageDef {
  name?: string;
  role?: string;
  gate?: string;
  capsules?: {
    mandatory?: string[];
    optional?: string[];
  };
  output?: string | string[];
}

interface PipelineYaml {
  stages: Record<string, unknown>;
}

export interface PipelineOptions {
  strictness?: StrictnessLevel;
  fromStage?: Stage;
  dryRun?: boolean;
  projectDir?: string;
}

export interface PipelineExecutionResult {
  completedStages: Stage[];
  failedAt?: Stage;
  gateResults: Map<Stage, GateResult>;
  skillsLoaded: Map<Stage, SkillManifest[]>;
  durationMs: number;
  success: boolean;
}

export class PipelineExecutor {
  private gateRunner: GateRunner;
  private skillLoader: SkillLoader;
  private metrics: MetricsCollector;
  private cachedSkills: SkillManifest[] | null = null;
  private profileResolver: ProfileResolver;

  constructor(private options: PipelineOptions = {}) {
    this.profileResolver = new ProfileResolver();
    this.gateRunner = new GateRunner();
    this.skillLoader = new SkillLoader();
    this.metrics = new MetricsCollector();
  }

  async execute(): Promise<PipelineExecutionResult> {
    const startTime = Date.now();

    const profileResult = await this.profileResolver.resolve(this.options.projectDir);
    this.gateRunner = new GateRunner(profileResult.profile);

    const pipelineData = await this.loadPipeline();
    const stages = pipelineData.stages;

    const startFrom = this.options.fromStage ?? 'spec';
    const startIndex = STAGE_ORDER.indexOf(startFrom);
    if (startIndex === -1) {
      throw new Error(`Invalid fromStage "${startFrom}". Must be one of: ${STAGE_ORDER.join(', ')}`);
    }

    const result: PipelineExecutionResult = {
      completedStages: [],
      gateResults: new Map(),
      skillsLoaded: new Map(),
      durationMs: 0,
      success: false,
    };

    for (let i = startIndex; i < STAGE_ORDER.length; i++) {
      const stageName = STAGE_ORDER[i];
      const stageRaw = stages[stageName];

      if (!stageRaw || typeof stageRaw !== 'object') {
        console.warn(`⚠️ Stage "${stageName}" not defined in pipeline.yaml, skipping`);
        continue;
      }

      const stageDef = stageRaw as ParsedStageDef;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 Stage ${i + 1}/${STAGE_ORDER.length}: ${stageDef.name ?? stageName}`);
      console.log(`${'='.repeat(60)}`);

      const gateId = stageDef.gate;
      if (!gateId) {
        console.warn(`⚠️ Stage "${stageName}" has no gate defined, skipping`);
        continue;
      }

      console.log(`\n🛡️  Running Gate: ${gateId}`);
      const gateResult = await this.gateRunner.runGate(gateId, {
        strictness: this.options.strictness ?? 'L2-standard',
        dryRun: this.options.dryRun,
        projectDir: this.options.projectDir,
      });
      result.gateResults.set(stageName, gateResult);

      await this.metrics.recordGate({
        gateId,
        passed: gateResult.passed,
        durationMs: gateResult.durationMs,
        stage: stageName,
      });

      if (!gateResult.passed) {
        console.error(`\n❌ Gate "${gateId}" FAILED at stage "${stageName}"`);
        result.failedAt = stageName;
        this.logFailureDetails(gateResult);
        result.durationMs = Date.now() - startTime;
        return result;
      }

      console.log(
        `✅ Gate "${gateId}" PASSED (${gateResult.checks.length} checks, ${gateResult.durationMs}ms)`
      );

      const skills = await this.loadStageSkills(stageName, stageDef);
      result.skillsLoaded.set(stageName, skills);

      let skillLoadStart = Date.now();
      for (const skill of skills) {
        const skillDuration = Date.now() - skillLoadStart;
        skillLoadStart = Date.now();
        await this.metrics.recordSkillExecution({
          skillId: skill.id,
          stage: stageName,
          durationMs: skillDuration,
          inputChars: skill.lineCount * 40,
          outputChars: skill.output.length > 0 ? skill.output.join('\n').length : 0,
          success: true,
        });
      }

      this.printStageSummary(stageName, stageDef, skills);
      result.completedStages.push(stageName);

      await this.updateProgress(stageName, stageDef, gateResult, skills);
    }

    result.durationMs = Date.now() - startTime;
    result.success = true;
    console.log(`\n🎉 All stages completed in ${result.durationMs}ms`);
    return result;
  }

  private async loadPipeline(): Promise<PipelineYaml> {
    try {
      const raw = await readFile(PIPELINE_PATH, 'utf-8');
      const parsed = parseYaml(raw);
      if (!parsed || typeof parsed !== 'object' || !('stages' in parsed)) {
        throw new Error('pipeline.yaml is missing "stages" key or is not a valid object');
      }
      return parsed as PipelineYaml;
    } catch (err) {
      if (err instanceof Error && err.message.includes('pipeline.yaml')) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load pipeline config at "${PIPELINE_PATH}": ${msg}`);
    }
  }

  private async loadStageSkills(
    stageName: string,
    stageDef: ParsedStageDef
  ): Promise<SkillManifest[]> {
    const capsules = stageDef.capsules;
    const mandatoryIds: string[] = capsules?.mandatory ?? [];
    const optionalIds: string[] = capsules?.optional ?? [];
    const allIds = [...mandatoryIds, ...optionalIds];

    if (allIds.length === 0) return [];

    if (!this.cachedSkills) {
      this.cachedSkills = await this.skillLoader.loadAll();
    }
    const stageSkills = this.cachedSkills.filter((s) => allIds.includes(s.id));

    for (const id of mandatoryIds) {
      if (!stageSkills.find((s) => s.id === id)) {
        console.warn(`⚠️ Mandatory skill "${id}" not found for stage "${stageName}"`);
      }
    }

    return stageSkills;
  }

  private printStageSummary(
    stageName: string,
    stageDef: ParsedStageDef,
    skills: SkillManifest[]
  ): void {
    console.log(`\n📋 ${stageDef.name ?? stageName} Summary:`);
    console.log(`   Role: ${stageDef.role ?? 'N/A'}`);
    console.log(`   Skills loaded: ${skills.map((s) => s.name).join(', ') || '(none)'}`);

    const output = stageDef.output;
    if (Array.isArray(output)) {
      console.log(`   Expected output: ${output.join(', ') || 'N/A'}`);
    } else if (typeof output === 'string') {
      console.log(`   Expected output: ${output}`);
    } else {
      console.log(`   Expected output: N/A`);
    }
  }

  private logFailureDetails(gateResult: GateResult): void {
    const failedChecks = gateResult.checks.filter((c) => !c.passed);
    if (failedChecks.length === 0) {
      console.error('\n📊 No failed checks recorded (unexpected state)');
      return;
    }

    console.error('\n📊 Failed Checks:');
    for (const check of failedChecks) {
      console.error(`   [FAIL] ${check.name}: ${check.message}`);
      if (check.remediation) {
        console.error(`          💡 ${check.remediation}`);
      }
    }
    console.error(`\n🔧 Suggested action: ${gateResult.failAction}`);
  }

  private async updateProgress(
    stage: Stage,
    stageDef: ParsedStageDef,
    gateResult: GateResult,
    skills: SkillManifest[]
  ): Promise<void> {
    try {
      await mkdir(dirname(PROGRESS_PATH), { recursive: true });
    } catch (err) {
      console.warn(`⚠️ Failed to create progress directory: ${this.errMsg(err)}`);
      return;
    }

    const now = new Date().toISOString();
    const statusLabel = gateResult.passed ? '✅ 通过' : '❌ 未通过';
    const skillRows = skills
      .map((s) => `| ${s.name} | ✅ | ${gateResult.durationMs}ms | ${s.pattern} |`)
      .join('\n');

    const content = [
      '# 当前进度',
      '',
      `**最后更新**: ${now}`,
      `**当前阶段**: ${stageDef.name ?? stage}`,
      `**Gate 结果**: ${statusLabel}`,
      '',
      '## 已完成阶段',
      '',
      '| 技能 | 状态 | Gate 耗时 | Pattern |',
      '|------|------|----------|---------|',
      skillRows || '(无)',
      '',
      '## 下一步',
      '- 继续执行下一阶段或进行手动验证',
    ].join('\n');

    try {
      await writeFile(PROGRESS_PATH, content);
    } catch (err) {
      console.warn(`⚠️ Failed to write progress file: ${this.errMsg(err)}`);
    }
  }

  private errMsg(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
