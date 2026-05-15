#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { SchemaValidator } from './schema-validator.js';
import { SkillLoader } from './skill-loader.js';
import { GateRunner } from './gate-runner.js';
import { MetricsCollector } from './metrics-collector.js';
import { PipelineExecutor } from './pipeline-executor.js';
import { DocValidator, type DocValidationOptions } from './doc-validator.js';
import { SyncValidator, type SyncValidatorOptions } from './sync-validator.js';
import type { StrictnessLevel, Stage } from './types.js';

const program = new Command();

program
  .name('harness')
  .description('Harness Engineering Skill — 多智能体软件研发协作引擎 CLI')
  .version('3.0.0');

function formatValidationResult(result: { valid: boolean; issues: Array<{ severity: string; code: string; message: string; source?: string; suggestion?: string }>; summary: { errors: number; warnings: number; infos: number } }): void {
  const { valid, issues, summary } = result;

  console.log(chalk.bold('\n━━━ 校验结果 ━━━'));
  console.log(`  总计: ${issues.length} 条问题`);
  console.log(`  ${chalk.red(summary.errors > 0 ? `✗ ${summary.errors} 错误` : `✓ 0 错误`)}`);
  console.log(`  ${chalk.yellow(`${summary.warnings} 警告`)}`);
  console.log(`  ${chalk.gray(`${summary.infos} 信息`)}`);

  if (issues.length > 0) {
    console.log(chalk.bold('\n━━━ 问题详情 ━━━'));
    for (const issue of issues) {
      const icon = issue.severity === 'error'
        ? chalk.red.bold('✗ ERROR')
        : issue.severity === 'warn'
          ? chalk.yellow.bold('⚠ WARN ')
          : chalk.blue.bold('ℹ INFO ');
      console.log(`  ${icon} ${chalk.cyan(`[${issue.code}]`)} ${issue.message}`);
      if (issue.source) {
        console.log(chalk.gray(`       来源: ${issue.source}`));
      }
      if (issue.suggestion) {
        console.log(chalk.green(`       建议: ${issue.suggestion}`));
      }
    }
  }

  console.log(chalk.bold('\n' + (valid ? chalk.green('✓ 校验通过') : chalk.red('✗ 校验未通过'))));
}

program
  .command('schema')
  .description('Schema 与注册表一致性校验')
  .addCommand(
    new Command('validate')
      .description('运行注册表一致性校验（capsule 引用、文件存在性、frontmatter、gate 引用）')
      .action(async () => {
        console.log(chalk.blue.bold('\n🔍 运行 Schema 注册表一致性校验...\n'));
        try {
          const validator = new SchemaValidator();
          const result = await validator.validate();
          formatValidationResult(result);
          process.exit(result.valid ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ 校验过程出错: ${message}`));
          process.exit(2);
        }
      })
  );

program
  .command('skill')
  .description('Skill 加载与校验')
  .addCommand(
    new Command('validate')
      .description('加载并校验所有已注册 Skills（frontmatter、流程步骤、产出物）')
      .action(async () => {
        console.log(chalk.blue.bold('\n📦 加载并校验所有 Skills...\n'));
        try {
          const loader = new SkillLoader();
          const manifests = await loader.loadAll();
          const result = loader.getValidationResult();

          console.log(chalk.gray(`  已加载 ${manifests.length} 个 Skill Manifest:`));
          for (const m of manifests) {
            const stageTag = m.stage === 'cross-cutting' ? chalk.gray('[cross-cutting]') : chalk.cyan(`[${m.stage}]`);
            const mandatoryTag = m.mandatory ? chalk.green('[mandatory]') : chalk.yellow('[optional]');
            console.log(`    ${chalk.bold(m.name)} ${stageTag} ${mandatoryTag} (${m.lineCount} 行)`);
          }

          formatValidationResult(result);
          process.exit(result.valid ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ Skill 加载失败: ${message}`));
          process.exit(2);
        }
      })
  );

const STRICTNESS_CHOICES: StrictnessLevel[] = ['L1-lightweight', 'L2-standard', 'L3-strict'];

function parseStrictness(input: string | undefined): StrictnessLevel {
  if (!input) return 'L2-standard';
  const normalized = input.toLowerCase();
  if (normalized.startsWith('l1') || normalized.includes('lightweight')) return 'L1-lightweight';
  if (normalized.startsWith('l3') || normalized.includes('strict')) return 'L3-strict';
  return 'L2-standard';
}

program
  .command('gate')
  .description('Gate 门禁检查')
  .addCommand(
    new Command('check <gateId>')
      .description('运行单个 Gate 检查')
      .option('-s, --strictness <level>', '严格等级: L1, L2, L3 (或完整名称)', 'L2')
      .option('--dry-run', '仅模拟执行，不触发 failAction', false)
      .action(async (gateId: string, opts: { strictness?: string; dryRun?: boolean }) => {
        const strictness = parseStrictness(opts.strictness);
        console.log(chalk.blue.bold(`\n🛡️  运行 Gate 检查: ${chalk.bold(gateId)} [${strictness}]${opts.dryRun ? chalk.yellow(' (dry-run)') : ''}\n`));
        try {
          const runner = new GateRunner();
          const result = await runner.runGate(gateId, {
            strictness,
            dryRun: opts.dryRun ?? false,
          });

          const passedIcon = result.passed ? chalk.green.bold('✅ PASSED') : chalk.red.bold('❌ FAILED');
          console.log(`\n  ${passedIcon}  Gate: ${result.gateId}  |  Level: ${result.level}  |  Checks: ${result.checks.length}  |  耗时: ${result.durationMs}ms`);

          for (const check of result.checks) {
            const checkIcon = check.passed ? chalk.green('  ✓') : chalk.red('  ✗');
            console.log(`${checkIcon} ${check.name}: ${check.message}`);
            if (!check.passed && check.remediation) {
              console.log(chalk.gray(`     → ${check.remediation}`));
            }
          }

          if (!result.passed) {
            console.log(chalk.yellow(`\n  Fail Action: ${result.failAction}`));
          }

          process.exit(result.passed ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ Gate 执行错误: ${message}`));
          process.exit(2);
        }
      })
  )
  .addCommand(
    new Command('check-all')
      .description('按顺序运行所有 Gate 检查')
      .option('-s, --strictness <level>', '严格等级: L1, L2, L3', 'L2')
      .option('--dry-run', '仅模拟执行，遇到失败不中断', false)
      .action(async (opts: { strictness?: string; dryRun?: boolean }) => {
        const strictness = parseStrictness(opts.strictness);
        console.log(chalk.blue.bold(`\n🛡️  运行所有 Gate 检查 [${strictness}]${opts.dryRun ? chalk.yellow(' (dry-run)') : ''}\n`));
        try {
          const runner = new GateRunner();
          const results = await runner.runAllGates({
            strictness,
            dryRun: opts.dryRun ?? false,
          });

          let allPassed = true;
          for (const result of results) {
            const icon = result.passed ? chalk.green('✅') : chalk.red('❌');
            console.log(`  ${icon} ${result.gateId}: ${result.checks.length} checks, ${result.durationMs}ms`);
            if (!result.passed) allPassed = false;
          }

          const passedCount = results.filter(r => r.passed).length;
          console.log(chalk.bold(`\n  结果: ${passedCount}/${results.length} Gates 通过`));

          process.exit(allPassed ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ 批量 Gate 执行错误: ${message}`));
          process.exit(2);
        }
      })
  );

const STAGE_CHOICES: Stage[] = ['spec', 'plan', 'build', 'test', 'review', 'simplify', 'ship'];

program
  .command('pipeline')
  .description('流水线执行')
  .addCommand(
    new Command('run')
      .description('执行完整 Harness 流水线（spec → plan → build → test → review → simplify → ship）')
      .option('-f, --from <stage>', `起始阶段: ${STAGE_CHOICES.join(', ')}`, 'spec')
      .option('-s, --strictness <level>', 'Gate 严格等级: L1, L2, L3', 'L2')
      .option('--dry-run', '仅模拟执行，不触发 failAction', false)
      .action(async (opts: { from?: string; strictness?: string; dryRun?: boolean }) => {
        const fromStage = (opts.from ?? 'spec') as Stage;
        const strictness = parseStrictness(opts.strictness);

        if (!STAGE_CHOICES.includes(fromStage)) {
          console.error(chalk.red(`\n✗ 无效的起始阶段 "${fromStage}"，可选值: ${STAGE_CHOICES.join(', ')}`));
          process.exit(2);
        }

        console.log(chalk.blue.bold(`\n🚀 执行 Harness 流水线`));
        console.log(chalk.gray(`   起始阶段: ${fromStage}  |  严格等级: ${strictness}  |  Dry Run: ${!!opts.dryRun}\n`));

        try {
          const executor = new PipelineExecutor({
            fromStage,
            strictness,
            dryRun: opts.dryRun ?? false,
          });
          const result = await executor.execute();

          if (result.success) {
            console.log(chalk.green.bold(`\n🎉 流水线执行成功!`));
            console.log(chalk.gray(`   完成阶段: ${result.completedStages.join(' → ')}`));
            console.log(chalk.gray(`   总耗时: ${result.durationMs}ms`));
          } else {
            console.log(chalk.red.bold(`\n💥 流水线在阶段 "${result.failedAt}" 失败`));
            console.log(chalk.gray(`   已完成: ${result.completedStages.join(' → ') || '(无)'}`));
            console.log(chalk.gray(`   总耗时: ${result.durationMs}ms`));
          }

          process.exit(result.success ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ 流水线执行错误: ${message}`));
          process.exit(2);
        }
      })
  );

program
  .command('metrics')
  .description('度量与统计')
  .addCommand(
    new Command('show')
      .description('显示聚合度量统计（通过率、平均耗时、Token 用量等）')
      .option('-j, --json', '以 JSON 格式输出（方便程序化消费）', false)
      .option('-r, --run <runId>', '筛选特定运行的度量数据')
      .action(async (opts: { json?: boolean; run?: string }) => {
        try {
          const collector = new MetricsCollector();
          const metrics = await collector.getAggregateMetrics();

          if (opts.json) {
            console.log(JSON.stringify(metrics, null, 2));
            return;
          }

          const hasData = metrics.totalRuns > 0;

          if (!hasData) {
            console.log(chalk.blue.bold('\n📊 度量总览\n'));
            console.log(chalk.yellow('  暂无度量数据。'));
            console.log(chalk.gray('  运行以下命令后数据会自动记录：'));
            console.log(chalk.gray('    harness pipeline run        # 执行完整流水线'));
            console.log(chalk.gray('    harness gate check <gateId> # 执行单个 Gate 检查'));
            console.log('');
            return;
          }

          console.log(chalk.blue.bold('\n📊 度量总览\n'));

          console.log(chalk.bold('  ┌────────────────────────────────────┐'));
          console.log(chalk.bold('  │        度量总览                     │'));
          console.log(chalk.bold('  ├────────────────────────────────────┤'));
          console.log(`  │  总运行次数:     ${String(metrics.totalRuns).padEnd(18)}│`);
          console.log(`  │  Gate 通过率:    ${(metrics.gatePassRate * 100).toFixed(1).padEnd(10)}%          │`);
          console.log(`  │  平均 Gate 耗时: ${metrics.avgGateDurationMs.toFixed(0).padEnd(10)}ms         │`);
          console.log(`  │  平均 Token:     ${String(Math.round(metrics.avgTokenUsage)).padEnd(18)}│`);
          console.log(chalk.bold('  └────────────────────────────────────\u2529'));

          const stageEntries = Object.entries(metrics.byStage);
          if (stageEntries.length > 0) {
            console.log(chalk.bold('\n  按阶段统计:'));
            console.log('  ┌──────────┬───────┬──────────┬────────────┐');
            console.log('  │ Stage    │ Count │ Pass%   │ Avg(ms)    │');
            console.log('  ├──────────┼───────┼──────────┼────────────┤');
            for (const [stage, data] of stageEntries) {
              const passColor = data.passRate >= 0.9 ? chalk.green : data.passRate >= 0.7 ? chalk.yellow : chalk.red;
              console.log(`  │ ${stage.padEnd(8)} │ ${String(data.count).padEnd(5)} │ ${passColor((data.passRate * 100).toFixed(1).padEnd(8) + '%').padEnd(8)} │ ${data.avgDuration.toFixed(0).padEnd(10)} │`);
            }
            console.log('  └──────────┴───────┴──────────┴────────────┘');
          }

          const gateEntries = Object.entries(metrics.byGate);
          if (gateEntries.length > 0) {
            console.log(chalk.bold('\n  按 Gate 统计:'));
            console.log('  ┌──────────────┬──────┬──────────┬────────────┐');
            console.log('  │ Gate         │ Runs │ Pass%   │ Avg(ms)    │');
            console.log('  ├──────────────┼──────┼──────────┼────────────┤');
            for (const [gateId, data] of gateEntries) {
              const passIcon = data.passRate >= 1 ? chalk.green('✅') : data.passRate >= 0.7 ? chalk.yellow('⚠️') : chalk.red('❌');
              console.log(`  │ ${gateId.padEnd(12)} │ ${String(data.runs).padEnd(4)} │ ${(data.passRate * 100).toFixed(1).padEnd(8)}% ${passIcon} │ ${data.avgDuration.toFixed(0).padEnd(10)} │`);
            }
            console.log('  └──────────────┴──────┴──────────┴────────────┘');
          }

          if (opts.run) {
            console.log(chalk.gray(`\n  筛选条件: runId = "${opts.run}"`));
          }
          console.log('');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ 度量加载失败: ${message}`));
          process.exit(2);
        }
      })
  );

program
  .command('doc')
  .description('文档校验（结构化 Markdown 验证）')
  .addCommand(
    new Command('validate')
      .description('运行文档结构化校验（模板变量、表格格式、标题层级、Mermaid、Frontmatter 等）')
      .option('-d, --dir <path>', '目标目录', '.')
      .option('-p, --pattern <glob>', '文件匹配模式', '**/*.md')
      .option('-s, --strictness <level>', '严格等级: L1, L2, L3', 'L2')
      .option('--no-templates', '跳过未填充模板变量检查')
      .option('--no-placeholders', '跳过占位符文本检查')
      .option('--no-tables', '跳过表格格式检查')
      .option('--no-headings', '跳过标题层级检查')
      .option('--no-mermaid', '跳过 Mermaid 代码块检查')
      .option('--no-frontmatter', '跳过 Frontmatter Schema 检查')
      .option('--check-links', '启用内部链接存在性检查')
      .action(async (opts: {
        dir?: string;
        pattern?: string;
        strictness?: string;
        templates?: boolean;
        placeholders?: boolean;
        tables?: boolean;
        headings?: boolean;
        mermaid?: boolean;
        frontmatter?: boolean;
        checkLinks?: boolean;
      }) => {
        const strictness = opts.strictness as DocValidationOptions['strictness'];
        console.log(chalk.blue.bold(`\n📄 运行文档结构化校验 [${strictness}]...\n`));
        try {
          const validator = new DocValidator({
            targetDir: opts.dir,
            filePattern: opts.pattern,
            strictness,
            checkUnresolvedTemplates: opts.templates ?? true,
            checkPlaceholders: opts.placeholders ?? true,
            checkTableFormat: opts.tables ?? true,
            checkHeadingHierarchy: opts.headings ?? true,
            checkMermaidBlocks: opts.mermaid ?? true,
            checkFrontmatterSchema: opts.frontmatter ?? true,
            checkReferenceLinks: opts.checkLinks ?? false,
          });
          const result = await validator.validate();
          formatValidationResult(result);
          process.exit(result.valid ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ 文档校验出错: ${message}`));
          process.exit(2);
        }
      })
  );

program
  .command('sync')
  .description('core/ 与 skill-dist/ 同步一致性校验')
  .addCommand(
    new Command('validate')
      .description('校验 core/ 和 skill-dist/ 目录的文件同步状态（内容哈希比对）')
      .option('-j, --json', '以 JSON 格式输出详细差异信息', false)
      .action(async (opts: { json?: boolean }) => {
        console.log(chalk.blue.bold('\n🔄 校验 core/ ↔ skill-dist/ 同步状态...\n'));
        try {
          const validator = new SyncValidator();
          const result = await validator.validate();

          if (opts.json) {
            console.log(JSON.stringify({
              valid: result.valid,
              summary: result.summary,
              coreOnlyFiles: result.coreOnlyFiles,
              distOnlyFiles: result.distOnlyFiles,
              contentDiffs: result.contentDiffs.map(d => ({
                file: d.file,
                coreHash: d.coreHash,
                distHash: d.distHash,
              })),
              syncScore: result.syncScore,
              issues: result.issues,
            }, null, 2));
            process.exit(result.valid ? 0 : 1);
            return;
          }

          formatValidationResult(result);

          if (result.coreOnlyFiles.length > 0) {
            console.log(chalk.yellow(`\n  📂 仅在 core/ 中 (${result.coreOnlyFiles.length} 个):`));
            for (const f of result.coreOnlyFiles.slice(0, 5)) {
              console.log(chalk.gray(`     - ${f}`));
            }
            if (result.coreOnlyFiles.length > 5) {
              console.log(chalk.gray(`     ... +${result.coreOnlyFiles.length - 5} 个`));
            }
          }

          if (result.distOnlyFiles.length > 0) {
            console.log(chalk.yellow(`\n  📂 仅在 skill-dist/ 中 (${result.distOnlyFiles.length} 个):`));
            for (const f of result.distOnlyFiles.slice(0, 5)) {
              console.log(chalk.gray(`     - ${f}`));
            }
            if (result.distOnlyFiles.length > 5) {
              console.log(chalk.gray(`     ... +${result.distOnlyFiles.length - 5} 个`));
            }
          }

          if (result.contentDiffs.length > 0) {
            console.log(chalk.red(`\n  🔀 内容不一致 (${result.contentDiffs.length} 个):`));
            for (const d of result.contentDiffs.slice(0, 5)) {
              console.log(chalk.gray(`     - ${d.file} (core=${d.coreHash}, dist=${d.distHash})`));
            }
            if (result.contentDiffs.length > 5) {
              console.log(chalk.gray(`     ... +${result.contentDiffs.length - 5} 个`));
            }
          }

          const scoreColor = result.syncScore >= 90 ? chalk.green : result.syncScore >= 70 ? chalk.yellow : chalk.red;
          console.log(chalk.bold(`\n  同步一致率: ${scoreColor(`${result.syncScore}%`)}`));

          process.exit(result.valid ? 0 : 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n✗ 同步校验出错: ${message}`));
          process.exit(2);
        }
      })
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`\n✗ 未预期的错误: ${message}`));
  process.exit(2);
});
