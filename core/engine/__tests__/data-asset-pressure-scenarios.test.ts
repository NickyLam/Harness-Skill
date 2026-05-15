import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { SkillPressureRunner } from '../skill-pressure-runner.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..');
const SCENARIO_PATH = join(PROJECT_ROOT, 'templates', 'evolution', 'skill-pressure-scenarios.yaml');

describe('Data Asset Pressure Scenarios', () => {
  it('includes data asset platform scenarios', async () => {
    const runner = new SkillPressureRunner({ scenarioPath: SCENARIO_PATH });
    const scenarios = await runner.loadScenarios();
    const ids = scenarios.map((s) => s.id);

    expect(ids).toContain('data-asset-sdd-requirement-clarification');
    expect(ids).toContain('data-asset-quality-gate-enforcement');
    expect(ids).toContain('data-asset-lineage-and-audit');
    expect(ids).toContain('data-asset-parallel-ownership-safety');
  });

  it('passes quality-gate scenario with compliant transcript and artifact evidence', async () => {
    const runner = new SkillPressureRunner({ scenarioPath: SCENARIO_PATH });
    const scenarios = await runner.loadScenarios();
    const scenario = scenarios.find((s) => s.id === 'data-asset-quality-gate-enforcement');

    expect(scenario).toBeDefined();
    const result = runner.evaluateScenario(scenario!, {
      transcript: [
        '数据质量门禁失败时必须阻塞发布并回退修复。',
        'Gate failed 后回到 test/build 阶段修复。',
        '请补充完整性、唯一性、及时性和准确性的质量报告证据。',
      ].join('\n'),
      artifacts: {
        '.harness/metrics/data-quality-gate-report.md': '# Data Quality Gate Report',
      },
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(scenario!.minScore);
  });

  it('fails lineage-and-audit scenario when transcript postpones governance controls', async () => {
    const runner = new SkillPressureRunner({ scenarioPath: SCENARIO_PATH });
    const scenarios = await runner.loadScenarios();
    const scenario = scenarios.find((s) => s.id === 'data-asset-lineage-and-audit');

    expect(scenario).toBeDefined();
    const result = runner.evaluateScenario(scenario!, {
      transcript: '血缘和审计先不上线，后续运维再补。',
      artifacts: {},
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(scenario!.minScore);
    expect(result.checks.some((c) => c.id === 'postpone-lineage-audit' && !c.passed)).toBe(true);
  });
});
