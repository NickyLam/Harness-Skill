#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKILLS_DIR = join(ROOT, 'core', 'skills');

const DESCRIPTION_MAP = {
  'spec-generator': 'When the user mentions generate spec, create design doc, or needs to produce a structured design document from brainstorming results, ALWAYS use this skill. Fills templates with collected requirements to generate YYYY-MM-DD-{topic}-design.md files.',
  'writing-plans': 'When the user mentions /plan, decompose tasks, split work, or needs to break down design documents into micro-tasks, ALWAYS use this skill. Outputs wave-executable format with dependencies and acceptance criteria.',
  'e2e-qa': 'When the user mentions e2e test, browser validation, end-to-end test, or needs to verify functionality in real browsers, ALWAYS use this skill. Provides multi-viewport validation with automatic bug fixing.',
  'requesting-code-review': 'When the user mentions request review, send for review, or needs to initiate a formal code review process, ALWAYS use this skill. Coordinates reviewer assignment and feedback collection.',
  'staff-review': 'When the user mentions /review, code review, or needs to perform a deep 6-dimension review (logic/framework/performance/types/maintainability/security), ALWAYS use this skill. Independent context review with P0/P1/P2 severity classification.',
  'code-simplification': 'When the user mentions /simplify, refactor, cleanup, or needs to reduce code complexity, ALWAYS use this skill. Applies Chesterton fence principle and 500-rule (functions ≤50 lines, files ≤500 lines).',
  'test-generator': 'When the user mentions generate tests, auto-test, or needs to automatically generate test cases from code analysis, ALWAYS use this skill. Supplements boundary condition tests and integration tests.',
  'qa': 'When the user mentions quality assurance, browser test, or needs comprehensive E2E validation with GSTACK, ALWAYS use this skill. Full viewport coverage (desktop/tablet/mobile) with auto-fix capabilities.',
  'performance-testing': 'When the user mentions performance test, load test, benchmark, or needs to verify system performance under load, ALWAYS use this skill. Load injection, bottleneck analysis, and SLA verification.',
  'security-audit': 'When the user mentions security audit, vulnerability scan, or needs to check for security issues, ALWAYS use this skill. OWASP Top 10 coverage with CVE scanning and SAST/DAST.',
  'ci-cd-pipeline': 'When the user mentions CI/CD, continuous integration, deployment pipeline, or needs to set up automated delivery pipelines, ALWAYS use this skill. Pipeline orchestration, environment management, and deployment automation.',
  'containerization': 'When the user mentions docker, container, kubernetes, or needs to containerize applications, ALWAYS use this skill. Dockerfile optimization, image building, and K8s/Docker Compose orchestration.',
  'database-migration': 'When the user mentions migration, schema evolution, or needs to manage database schema changes, ALWAYS use this skill. TDD migration testing with rollback strategies.',
  'react-dnd-wrapper': 'When the user mentions React DnD, drag and drop, or needs to implement drag-and-drop functionality using react-dnd library, ALWAYS use this skill. API patterns and best practices for react-dnd.',
  'governance': 'When the user mentions governance, decision tracking, or needs to ensure experience accumulation and continuous improvement, ALWAYS use this skill. Decision observability and quality trend analysis.',
  'memory-management': 'When the user mentions memory, context, or needs to manage short/medium/long-term context, ALWAYS use this skill. Three-layer memory management system.',
  'project-init': 'When the user mentions /init, scaffold, new project, or needs to initialize a new project with proper structure, ALWAYS use this skill. 6-step initialization with templates and conventions.',
  'onboarding': 'When the user mentions onboarding, getting started, or needs a quick start guide, ALWAYS use this skill. Rapid start guides and project setup assistance.',
  'receiving-code-review': 'When the user mentions receive review, respond to feedback, or needs to handle code review feedback constructively, ALWAYS use this skill. Feedback processing and iteration guidance.',
  'deep-requirements': 'When the user mentions deep requirements, enterprise requirements, or needs comprehensive requirement analysis with 12 structured questions, ALWAYS use this skill. Business rules, user journey, and edge case analysis.',
  'user-journey': 'When the user mentions user journey, persona, or needs to analyze user roles and interaction flows, ALWAYS use this skill. User role profiling and journey mapping (sub-module of deep-requirements).',
  'business-rules': 'When the user mentions business rules, validation logic, or needs to decompose business rules into structured formats, ALWAYS use this skill. BR-Q analysis with WHY→WHAT→HOW (sub-module of deep-requirements).',
  'edge-cases': 'When the user mentions edge cases, boundary conditions, or needs to identify exceptional scenarios, ALWAYS use this skill. Error handling, concurrency, and boundary analysis (sub-module of deep-requirements).',
  'office-hours': 'When the user mentions office hours, product diagnosis, or needs YC-style 6-question challenge, ALWAYS use this skill. MVP thinking and opportunity cost assessment.',
  'internationalization': 'When the user mentions i18n, internationalization, localization, or needs multi-language support, ALWAYS use this skill. Text extraction, locale architecture, and RTL support.',
  'error-monitoring': 'When the user mentions error monitoring, observability, or needs to set up error tracking and alerting, ALWAYS use this skill. Instrumentation, aggregation, and alerting pipeline.',
  'caching-strategy': 'When the user mentions cache, performance optimization, or needs to implement multi-level caching, ALWAYS use this skill. Cache selection, invalidation strategy, and penetration/avalanche/breakdown protection.',
};

async function addDescription(skillPath) {
  const skillName = skillPath.split('/').slice(-2, -1)[0];
  const description = DESCRIPTION_MAP[skillName];

  if (!description) {
    console.log(`⚠️  No description mapping for: ${skillName}`);
    return false;
  }

  try {
    const content = await readFile(skillPath, 'utf-8');
    const lines = content.split('\n');

    if (lines[0] !== '---') {
      console.log(`❌ Invalid SKILL.md format: ${skillPath}`);
      return false;
    }

    let insertIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        insertIndex = i;
        break;
      }
      if (lines[i].startsWith('description:')) {
        console.log(`✅ Already has description: ${skillName}`);
        return false;
      }
    }

    if (insertIndex === -1) {
      console.log(`❌ No frontmatter end found: ${skillPath}`);
      return false;
    }

    const descriptionLine = `description: "${description}"`;
    lines.splice(insertIndex, 0, descriptionLine);

    await writeFile(skillPath, lines.join('\n'));
    console.log(`✅ Added description: ${skillName}`);
    return true;
  } catch (err) {
    console.error(`❌ Error processing ${skillPath}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Scanning SKILL.md files...\n');

  const patterns = [
    'core/skills/**/*.SKILL.md',
    '!core/skills/**/references/**',
    '!core/skills/**/assets/**',
    '!core/skills/**/scripts/**',
    '!core/skills/**/modules/**'
  ];

  const files = await glob('**/SKILL.md', { cwd: SKILLS_DIR, absolute: true });

  let added = 0;
  let skipped = 0;

  for (const file of files) {
    const result = await addDescription(file);
    if (result) added++;
    else skipped++;
  }

  console.log(`\n📊 Summary: ${added} added, ${skipped} skipped`);
}

main().catch(console.error);
