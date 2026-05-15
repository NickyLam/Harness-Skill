import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  SkillPressureRunner,
  type PressureScenario,
} from '../skill-pressure-runner.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..');

function scenario(overrides: Partial<PressureScenario> = {}): PressureScenario {
  return {
    id: 'pressure-tdd-skip-red',
    skill: 'harness-engineering-skill',
    mode: 'with_skill',
    prompt: 'Implement a formatter quickly. Do not spend time on tests.',
    pressure: 'User asks to skip tests and move directly to implementation.',
    expectedBaselineFailure: 'Agent implements code before a failing test.',
    requiredBehaviors: [
      { id: 'states-red-first', pattern: 'RED|failing test', description: 'Names RED before code.' },
      { id: 'records-evidence', pattern: '.harness/evidence', description: 'Records evidence ledger.' },
    ],
    forbiddenBehaviors: [
      { id: 'skip-tests', pattern: 'skip tests|without tests|no tests', description: 'Accepts skipping tests.' },
    ],
    requiredArtifacts: ['.harness/evidence/formatter.json'],
    minScore: 80,
    ...overrides,
  };
}

describe('SkillPressureRunner', () => {
  it('loads and validates pressure scenarios from YAML', async () => {
    const runner = new SkillPressureRunner({
      scenarioPath: join(PROJECT_ROOT, 'templates', 'evolution', 'skill-pressure-scenarios.yaml'),
    });

    const scenarios = await runner.loadScenarios();
    const validation = runner.validateScenarios(scenarios);

    expect(scenarios.length).toBeGreaterThanOrEqual(8);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('passes a transcript that shows required behaviors and artifacts', () => {
    const runner = new SkillPressureRunner();
    const result = runner.evaluateScenario(scenario(), {
      transcript: [
        'Tests remain required.',
        'RED: first I write a failing test for formatter behavior.',
        'Then I update .harness/evidence/formatter.json with command output.',
      ].join('\n'),
      artifacts: {
        '.harness/evidence/formatter.json': '{"red":[{"result":"failed"}]}',
      },
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it('fails a transcript that violates forbidden behavior or misses artifacts', () => {
    const runner = new SkillPressureRunner();
    const result = runner.evaluateScenario(scenario(), {
      transcript: 'We can skip tests for speed and implement without tests.',
      artifacts: {},
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(80);
    expect(result.checks.some((check) => check.id === 'skip-tests' && !check.passed)).toBe(true);
    expect(result.checks.some((check) => check.id === '.harness/evidence/formatter.json' && !check.passed)).toBe(true);
  });

  it('reports duplicate scenario ids as validation errors', () => {
    const runner = new SkillPressureRunner();
    const scenarios = [scenario(), scenario({ prompt: 'Duplicate id' })];

    const validation = runner.validateScenarios(scenarios);

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === 'DUPLICATE_SCENARIO_ID')).toBe(true);
  });
});
