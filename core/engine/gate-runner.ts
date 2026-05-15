import { readFile } from 'fs/promises';
import { existsSync, readdir } from 'fs';
import { join, relative, dirname } from 'path';
import { parse as parseYaml } from 'yaml';
import { execAsync, safeExec } from './exec-async.js';
import type {
  GateResult, CheckResult, GateDefinition, StrictnessLevel,
  CheckDefinition, CheckType, TechProfile
} from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const PIPELINE_PATH = join(PROJECT_ROOT, 'core', 'pipeline.yaml');

// ============================================================================
// ReDoS 安全策略
// ============================================================================

/** 正则模式最大长度 */
const MAX_PATTERN_LENGTH = 500;

/** 危险的 ReDoS 模式 — 嵌套量词、指数级回溯 */
const REDOS_DANGEROUS_PATTERNS = [
  /\([^(]+\+[+*?][)]*\)[+*?]/,    // (a+)+ (嵌套量词)
  /\([^(]+\*[+*?][)]*\)[+*?]/,    // (a*)+
  /\([^{]+\{[\d,]*\}[)]*[+*?]/,   // (a{2,})+
  /[+*?]\([^(]+\)[+*?]/,           // a+(b+)c
  /(\|\|)+/,                        // |||| (空分支)
  /\(\?[=!].*[+*]\)/,               // lookahead + 量词
];

/**
 * 校验正则表达式是否安全
 * @throws Error 当检测到潜在 ReDoS 或非法模式时
 */
function validateRegexPattern(pattern: string): void {
  if (!pattern) {
    throw new Error('Pattern cannot be empty');
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(
      `Pattern too long (${pattern.length} > ${MAX_PATTERN_LENGTH} chars). ` +
      'If you need complex matching, simplify the pattern or split into multiple checks.'
    );
  }

  for (const dangerousRe of REDOS_DANGEROUS_PATTERNS) {
    // 在原始字符串层面检测，避免构造 RegExp 本身触发
    try {
      if (dangerousRe.test(pattern)) {
        throw new Error(
          `Pattern "${pattern.slice(0, 80)}" looks like a potential ReDoS risk. ` +
          'Avoid nested quantifiers like (a+)+ or exponential backtracking patterns. ' +
          'Use simple literal patterns instead.'
        );
      }
    } catch {
      continue; // 如果检测正则本身有问题，跳过该规则
    }
  }

  // 最终安全性检查：尝试构造并在有限时间内运行
  const testRe = new RegExp(pattern, 'i');
  const testString = 'a'.repeat(100); // 100字符测试串
  const startTime = Date.now();
  try {
    testRe.test(testString);
  } catch {
    throw new Error(`Invalid RegExp syntax in pattern: "${pattern.slice(0, 80)}"`);
  }
  const elapsed = Date.now() - startTime;
  if (elapsed > 200) { // 超过 200ms 认为有回溯风险
    throw new Error(
      `Pattern "${pattern.slice(0, 80)}" took ${elapsed}ms on safety test — likely ReDoS vulnerable. Simplify the pattern.`
    );
  }
}

interface CheckOutcome {
  passed: boolean;
  message: string;
  remediation?: string;
}

export class GateRunner {
  private profile?: TechProfile;
  private pipelineCache: Record<string, unknown> | null = null;

  constructor(profile?: TechProfile) {
    this.profile = profile;
  }

  async runGate(
    gateId: string,
    options: { strictness?: StrictnessLevel; dryRun?: boolean; projectDir?: string } = {}
  ): Promise<GateResult> {
    const { strictness = 'L2-standard', dryRun = false, projectDir = PROJECT_ROOT } = options;
    const startTime = Date.now();

    const pipelineData = await this.loadPipeline();
    const gateDef = this.findGateDefinition(pipelineData, gateId);
    if (!gateDef) {
      throw new Error(`Gate "${gateId}" not found in pipeline.yaml`);
    }

    const levelChecks = gateDef.levels[strictness];
    if (!levelChecks) {
      throw new Error(`Strictness level "${strictness}" not defined for gate "${gateId}"`);
    }

    const checkResults: CheckResult[] = [];
    for (const check of levelChecks.checks) {
      const result = await this.executeCheck(check, projectDir);
      checkResults.push(result);
    }

    const allPassed = checkResults
      .filter(c => c.required !== false)
      .every(c => c.passed);
    const durationMs = Date.now() - startTime;

    const result: GateResult = {
      gateId,
      level: strictness,
      passed: allPassed,
      checks: checkResults,
      durationMs,
      failAction: gateDef.failAction,
      timestamp: new Date().toISOString(),
    };

    if (!allPassed && !dryRun) {
      console.error(`\n❌ Gate "${gateId}" FAILED (${strictness}):`);

      const failedRequired = checkResults.filter(c => !c.passed && c.required !== false);
      const failedOptional = checkResults.filter(c => !c.passed && c.required === false);

      if (failedRequired.length > 0) {
        console.error(`\n🔴 Required checks failed:`);
        for (const c of failedRequired) {
          console.error(`   ✗ ${c.name}: ${c.message}`);
          if (c.remediation) console.error(`     → ${c.remediation}`);
        }
      }

      if (failedOptional.length > 0) {
        console.error(`\n🟡 Optional checks failed (warnings only):`);
        for (const c of failedOptional) {
          console.error(`   ⚠ ${c.name}: ${c.message}`);
        }
      }

      console.error(`\n   Action: ${gateDef.failAction}`);
    }

    const passedRequired = checkResults.filter(c => c.required !== false && c.passed).length;
    const totalRequired = checkResults.filter(c => c.required !== false).length;
    const passedOptional = checkResults.filter(c => c.required === false && c.passed).length;
    const totalOptional = checkResults.filter(c => c.required === false).length;

    if (allPassed) {
      console.log(`\n✅ Gate "${gateId}" PASSED (${passedRequired}/${totalRequired} required checks)`);
      if (totalOptional > 0) {
        console.log(`   📋 Optional: ${passedOptional}/${totalOptional} passed (warnings don't block)`);
      }
    }

    return result;
  }

  async runAllGates(options: { strictness?: StrictnessLevel; dryRun?: boolean; projectDir?: string } = {}): Promise<GateResult[]> {
    const pipelineData = await this.loadPipeline();
    const gates = pipelineData.gates as Record<string, GateDefinition> | undefined;

    if (!gates || Object.keys(gates).length === 0) {
      throw new Error('No gates defined in pipeline.yaml');
    }

    const results: GateResult[] = [];
    for (const gateId of Object.keys(gates)) {
      const result = await this.runGate(gateId, options);
      results.push(result);
      if (!result.passed && !options.dryRun) break;
    }

    return results;
  }

  private async loadPipeline(): Promise<Record<string, unknown>> {
    if (this.pipelineCache) {
      return this.pipelineCache;
    }

    if (!existsSync(PIPELINE_PATH)) {
      throw new Error(`Pipeline file not found at ${PIPELINE_PATH}`);
    }

    let content: string;
    try {
      content = await readFile(PIPELINE_PATH, 'utf-8');
    } catch (err) {
      throw new Error(`Cannot read pipeline.yaml: ${(err as Error).message}`);
    }

    try {
      this.pipelineCache = parseYaml(content) as Record<string, unknown>;
      return this.pipelineCache;
    } catch (err) {
      throw new Error(`Invalid YAML in pipeline.yaml: ${(err as Error).message}`);
    }
  }

  private findGateDefinition(pipelineData: Record<string, unknown>, gateId: string): GateDefinition | undefined {
    const gates = pipelineData.gates as Record<string, GateDefinition> | undefined;
    return gates?.[gateId];
  }

  private async executeCheck(check: CheckDefinition, projectDir: string): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      const checkType = this.inferCheckType(check);
      let outcome: CheckOutcome;

      switch (checkType) {
        case 'file_exists':
          outcome = await this.checkFileExists(check, projectDir);
          break;
        case 'command':
          outcome = await this.checkCommand(check, projectDir);
          break;
        case 'pattern_match':
          outcome = await this.checkPatternMatch(check, projectDir);
          break;
        case 'git_status':
          outcome = await this.checkGitStatus(check, projectDir);
          break;
        default:
          outcome = {
            passed: false,
            message: `Unknown check type for: ${check.id}`,
          };
      }

      return {
        checkId: check.id,
        name: check.name,
        passed: outcome.passed,
        message: outcome.message,
        remediation: outcome.remediation,
        durationMs: Date.now() - startTime,
        required: check.required !== false,
      };
    } catch (err) {
      return {
        checkId: check.id,
        name: check.name,
        passed: false,
        message: `Check error: ${(err as Error).message}`,
        durationMs: Date.now() - startTime,
        required: check.required !== false,
      };
    }
  }

  private inferCheckType(check: CheckDefinition): CheckType {
    if (check.type && ['command', 'pattern_match', 'git_status', 'file_exists'].includes(check.type)) {
      return check.type as CheckType;
    }
    if (check.command) return 'command';
    if (check.pattern || check.verify?.includes('匹配') || check.verify?.includes('contain')) return 'pattern_match';
    if (check.verify?.includes('git') || check.id.includes('git')) return 'git_status';
    return 'file_exists';
  }

  private async checkFileExists(check: CheckDefinition, projectDir: string): Promise<CheckOutcome> {
    const pattern = check.filePattern ?? this.inferFilePattern(check.id);
    const files = await this.glob(pattern, projectDir);
    const exists = files.length > 0;

    return {
      passed: exists,
      message: exists
        ? `Found ${files.length} file(s) matching "${relative(projectDir, files[0])}"`
        : `No files found matching "${pattern}"`,
      remediation: exists ? undefined : 'Create the required file or run the corresponding /harness command first.',
    };
  }

  private async checkCommand(check: CheckDefinition, projectDir: string): Promise<CheckOutcome> {
    const command = this.resolveCommand(check.command!);

    try {
      // 使用 safeExec 进行安全校验的命令执行
      await safeExec(command, {
        cwd: projectDir,
        timeout: 120_000,
      });
      return {
        passed: true,
        message: `Command succeeded: ${command}`,
      };
    } catch (err) {
      const execErr = err as { stderr?: string; stdout?: string; message?: string };
      const errorOutput = execErr.stderr?.trim() ||
                          execErr.stdout?.trim() ||
                          execErr.message ||
                          'Unknown error';
      return {
        passed: false,
        message: `Command failed: ${command}\n${errorOutput.slice(0, 500)}`,
        remediation: this.suggestRemediation(check.id, command),
      };
    }
  }

  private async checkPatternMatch(check: CheckDefinition, projectDir: string): Promise<CheckOutcome> {
    const pattern = check.pattern ?? check.verify ?? '';
    if (!pattern) {
      return {
        passed: false,
        message: `Check "${check.id}" has no pattern or verify field defined`,
        remediation: 'Add a "pattern" or "verify" field to the check definition.',
      };
    }

    const searchDirs = [
      join(projectDir, '.harness', 'specs'),
      join(projectDir, '.harness', 'plans'),
      join(projectDir, 'src'),
    ];

    // 安全校验：正则模式必须通过 ReDoS 检测
    try {
      validateRegexPattern(pattern);
    } catch (validationErr) {
      return {
        passed: false,
        message: `Pattern validation failed: ${(validationErr as Error).message}`,
        remediation: 'Use a simple literal pattern (e.g., "Acceptance Criteria" or "TODO"). Avoid complex regex with nested quantifiers.',
      };
    }

    // 安全的预编译正则（已通过校验）
    const regex = new RegExp(pattern, 'i');

    for (const dir of searchDirs) {
      try {
        const files = await this.glob('**/*.md', dir);
        for (const file of files) {
          const content = await readFile(file, 'utf-8');
          if (regex.test(content)) {
            return {
              passed: true,
              message: `Pattern "${pattern}" found in ${relative(projectDir, file)}`,
            };
          }
        }
      } catch {
        continue;
      }
    }

    return {
      passed: false,
      message: `Pattern "${pattern}" not found in any harness artifact`,
      remediation: `Ensure your design documents include the required content matching: ${pattern}`,
    };
  }

  private async checkGitStatus(check: CheckDefinition, projectDir: string): Promise<CheckOutcome> {
    try {
      // git status 是硬编码安全命令，使用 allowShellMeta=true
      const { stdout } = await safeExec('git status --porcelain', {
        cwd: projectDir,
        allowShellMeta: true,
      });
      const status = stdout.trim();

      const hasChanges = status.length > 0;
      const expectedClean = !check.id.includes('dirty') && !check.verify?.includes('dirty');

      if (expectedClean) {
        return {
          passed: !hasChanges,
          message: hasChanges
            ? `Working tree has ${status.split('\n').length} uncommitted change(s)`
            : 'Working tree is clean',
          remediation: hasChanges ? 'Commit or stash changes before proceeding' : undefined,
        };
      }

      return { passed: true, message: `Git status: ${status || 'clean'}` };
    } catch (err) {
      return {
        passed: false,
        message: `Git error: ${(err as Error).message}`,
        remediation: 'Initialize git repository: git init',
      };
    }
  }

  private resolveCommand(command: string): string {
    if (!this.profile) return command;

    return command
      .replace('{typecheck_command}', this.profile.build.typecheckCommand)
      .replace('{build_command}', this.profile.build.buildCommand)
      .replace('{test_command}', this.profile.build.testCommand)
      .replace('{lint_command}', this.profile.build.lintCommand);
  }

  private inferFilePattern(checkId: string): string {
    const patterns: Record<string, string> = {
      doc_exists: '.harness/specs/*.md',
      task_list_exists: '.harness/plans/*.md',
      compile_pass: 'package.json',
      typecheck_pass: 'package.json',
      tests_pass: 'src/**/*.test.{ts,js}',
      git_clean: '.git',
      tag_created: '',
    };
    return patterns[checkId] ?? '**/*';
  }

  private suggestRemediation(checkId: string, command: string): string {
    const suggestions: Record<string, string> = {
      typecheck_pass: 'Run: npx tsc --noEmit and fix type errors',
      build_pass: 'Run: npm run build and fix build errors',
      all_tests_pass: 'Run: npm run test and fix failing tests',
      coverage_threshold: 'Run: npm run test:coverage to improve coverage',
      lint_pass: 'Run: npm run lint and fix lint errors',
      p0_zero: 'Review and fix all P0 issues from /harness review output',
      function_length_ok: 'Refactor long functions to be ≤50 lines each',
      file_length_ok: 'Split large files to be ≤500 lines each',
    };
    return suggestions[checkId] ?? `Fix the issue indicated by: ${command}`;
  }

  private async glob(pattern: string, cwd: string): Promise<string[]> {
    const { glob: globFn } = await import('glob');
    return globFn(pattern, { cwd, absolute: true, ignore: ['**/node_modules/**'] });
  }
}

export default GateRunner;
