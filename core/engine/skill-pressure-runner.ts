import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { parse as parseYaml } from 'yaml';
import type { ValidationIssue, ValidationResult } from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const DEFAULT_SCENARIO_PATH = join(PROJECT_ROOT, 'templates', 'evolution', 'skill-pressure-scenarios.yaml');

export interface PressureBehavior {
  id: string;
  pattern: string;
  description: string;
}

export interface PressureScenario {
  id: string;
  skill: string;
  mode: 'baseline' | 'with_skill';
  prompt: string;
  pressure: string;
  expectedBaselineFailure: string;
  requiredBehaviors: PressureBehavior[];
  forbiddenBehaviors: PressureBehavior[];
  requiredArtifacts: string[];
  minScore: number;
}

export interface PressureEvaluationInput {
  transcript: string;
  artifacts?: Record<string, string>;
}

export interface PressureCheckResult {
  id: string;
  kind: 'required_behavior' | 'forbidden_behavior' | 'required_artifact';
  description: string;
  passed: boolean;
  message: string;
}

export interface PressureEvaluationResult {
  scenarioId: string;
  skill: string;
  mode: PressureScenario['mode'];
  score: number;
  minScore: number;
  passed: boolean;
  checks: PressureCheckResult[];
}

export interface SkillPressureRunnerOptions {
  scenarioPath?: string;
}

export class SkillPressureRunner {
  private scenarioPath: string;

  constructor(options: SkillPressureRunnerOptions = {}) {
    this.scenarioPath = options.scenarioPath ?? DEFAULT_SCENARIO_PATH;
  }

  async loadScenarios(): Promise<PressureScenario[]> {
    const content = await readFile(this.scenarioPath, 'utf-8');
    const parsed = parseYaml(content) as { scenarios?: PressureScenario[] };
    return Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
  }

  validateScenarios(scenarios: PressureScenario[]): ValidationResult {
    const issues: ValidationIssue[] = [];
    const seenIds = new Set<string>();

    scenarios.forEach((scenario, index) => {
      const source = scenario.id || `scenario[${index}]`;

      if (!scenario.id) {
        issues.push({ severity: 'error', code: 'MISSING_SCENARIO_ID', message: `Scenario at index ${index} is missing id`, source });
      } else if (seenIds.has(scenario.id)) {
        issues.push({ severity: 'error', code: 'DUPLICATE_SCENARIO_ID', message: `Duplicate pressure scenario id: ${scenario.id}`, source });
      } else {
        seenIds.add(scenario.id);
      }

      if (!scenario.skill) {
        issues.push({ severity: 'error', code: 'MISSING_SKILL', message: 'Pressure scenario is missing skill', source });
      }

      if (!['baseline', 'with_skill'].includes(scenario.mode)) {
        issues.push({ severity: 'error', code: 'INVALID_MODE', message: `Invalid pressure scenario mode: ${scenario.mode}`, source });
      }

      if (!scenario.prompt || scenario.prompt.trim().length < 20) {
        issues.push({ severity: 'error', code: 'PROMPT_TOO_SHORT', message: 'Pressure scenario prompt must be at least 20 characters', source });
      }

      if (!scenario.pressure) {
        issues.push({ severity: 'warn', code: 'MISSING_PRESSURE', message: 'Pressure scenario should describe the failure pressure', source });
      }

      if (!scenario.expectedBaselineFailure) {
        issues.push({ severity: 'warn', code: 'MISSING_BASELINE_FAILURE', message: 'Pressure scenario should document expected baseline failure', source });
      }

      if (!Array.isArray(scenario.requiredBehaviors) || scenario.requiredBehaviors.length === 0) {
        issues.push({ severity: 'error', code: 'NO_REQUIRED_BEHAVIORS', message: 'Pressure scenario needs at least one required behavior', source });
      } else {
        this.validateBehaviors(scenario.requiredBehaviors, 'requiredBehaviors', source, issues);
      }

      if (!Array.isArray(scenario.forbiddenBehaviors)) {
        issues.push({ severity: 'error', code: 'INVALID_FORBIDDEN_BEHAVIORS', message: 'forbiddenBehaviors must be an array', source });
      } else {
        this.validateBehaviors(scenario.forbiddenBehaviors, 'forbiddenBehaviors', source, issues);
      }

      if (!Array.isArray(scenario.requiredArtifacts)) {
        issues.push({ severity: 'error', code: 'INVALID_REQUIRED_ARTIFACTS', message: 'requiredArtifacts must be an array', source });
      }

      if (typeof scenario.minScore !== 'number' || scenario.minScore < 0 || scenario.minScore > 100) {
        issues.push({ severity: 'error', code: 'INVALID_MIN_SCORE', message: 'minScore must be a number from 0 to 100', source });
      }
    });

    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warn').length;
    const infos = issues.filter((issue) => issue.severity === 'info').length;

    return {
      valid: errors === 0,
      issues,
      summary: { errors, warnings, infos },
    };
  }

  evaluateScenario(scenario: PressureScenario, input: PressureEvaluationInput): PressureEvaluationResult {
    const transcript = input.transcript ?? '';
    const artifacts = input.artifacts ?? {};
    const checks: PressureCheckResult[] = [];

    for (const behavior of scenario.requiredBehaviors) {
      const passed = this.matches(behavior.pattern, transcript);
      checks.push({
        id: behavior.id,
        kind: 'required_behavior',
        description: behavior.description,
        passed,
        message: passed
          ? `Required behavior found: ${behavior.description}`
          : `Missing required behavior: ${behavior.description}`,
      });
    }

    for (const behavior of scenario.forbiddenBehaviors) {
      const passed = !this.matches(behavior.pattern, transcript);
      checks.push({
        id: behavior.id,
        kind: 'forbidden_behavior',
        description: behavior.description,
        passed,
        message: passed
          ? `Forbidden behavior absent: ${behavior.description}`
          : `Forbidden behavior present: ${behavior.description}`,
      });
    }

    for (const artifactPath of scenario.requiredArtifacts) {
      const content = artifacts[artifactPath];
      const passed = typeof content === 'string' && content.trim().length > 0;
      checks.push({
        id: artifactPath,
        kind: 'required_artifact',
        description: artifactPath,
        passed,
        message: passed ? `Artifact provided: ${artifactPath}` : `Missing required artifact: ${artifactPath}`,
      });
    }

    const score = checks.length > 0
      ? Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
      : 0;

    return {
      scenarioId: scenario.id,
      skill: scenario.skill,
      mode: scenario.mode,
      score,
      minScore: scenario.minScore,
      passed: score >= scenario.minScore && checks.every((check) => check.passed),
      checks,
    };
  }

  private validateBehaviors(
    behaviors: PressureBehavior[],
    field: string,
    source: string,
    issues: ValidationIssue[]
  ): void {
    const seen = new Set<string>();
    behaviors.forEach((behavior, index) => {
      if (!behavior.id) {
        issues.push({ severity: 'error', code: 'MISSING_BEHAVIOR_ID', message: `${field}[${index}] is missing id`, source });
      } else if (seen.has(behavior.id)) {
        issues.push({ severity: 'error', code: 'DUPLICATE_BEHAVIOR_ID', message: `Duplicate behavior id in ${field}: ${behavior.id}`, source });
      } else {
        seen.add(behavior.id);
      }

      if (!behavior.pattern) {
        issues.push({ severity: 'error', code: 'MISSING_BEHAVIOR_PATTERN', message: `${field}[${index}] is missing pattern`, source });
      } else {
        try {
          new RegExp(behavior.pattern, 'i');
        } catch {
          issues.push({ severity: 'error', code: 'INVALID_BEHAVIOR_PATTERN', message: `${field}[${index}] has invalid regex pattern`, source });
        }
      }
    });
  }

  private matches(pattern: string, transcript: string): boolean {
    return new RegExp(pattern, 'i').test(transcript);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenarioPathArgIndex = args.findIndex((arg) => arg === '--scenario-path');
  const scenarioPath = scenarioPathArgIndex >= 0 ? args[scenarioPathArgIndex + 1] : undefined;
  const runner = new SkillPressureRunner({ scenarioPath });

  const scenarios = await runner.loadScenarios();
  const validation = runner.validateScenarios(scenarios);

  console.log(`Pressure scenarios: ${scenarios.length}`);
  console.log(`Validation: ${validation.valid ? 'PASS' : 'FAIL'} (${validation.summary.errors} errors, ${validation.summary.warnings} warnings)`);

  for (const issue of validation.issues) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}${issue.source ? ` (${issue.source})` : ''}`);
  }

  process.exit(validation.valid ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`Pressure scenario validation failed: ${(err as Error).message}`);
    process.exit(2);
  });
}

export default SkillPressureRunner;
