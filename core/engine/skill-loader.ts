import { readFile, stat } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml } from 'yaml';
import type {
  SkillManifest, Stage, ProcessStep, ValidationResult,
  ValidationIssue, Severity
} from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const SKILLS_DIR = join(PROJECT_ROOT, 'core', 'skills');
const REGISTRY_PATH = join(PROJECT_ROOT, 'core', 'registry.yaml');

export class SkillLoader {
  private manifests: Map<string, SkillManifest> = new Map();
  private issues: ValidationIssue[] = [];

  async loadAll(): Promise<SkillManifest[]> {
    this.manifests.clear();
    this.issues = [];

    let registryContent: string;
    try {
      registryContent = await readFile(REGISTRY_PATH, 'utf-8');
    } catch (err) {
      throw new Error(`Cannot read registry at ${REGISTRY_PATH}: ${(err as Error).message}`);
    }

    let registry: Record<string, unknown>;
    try {
      registry = parseYaml(registryContent) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Invalid YAML in registry.yaml: ${(err as Error).message}`);
    }

    const capsules = registry?.capsules as Record<string, Record<string, unknown>> | undefined;
    if (!capsules || typeof capsules !== 'object') {
      throw new Error('registry.yaml missing "capsules" section or it is not an object');
    }

    for (const [id, capsule] of Object.entries(capsules)) {
      const filePath = capsule.file_path as string | undefined ??
        this.resolveSkillPath(id, (capsule.stage as string) ?? 'cross-cutting');

      try {
        const manifest = await this.loadSkillFile(id, filePath, capsule);
        if (manifest !== null) {
          this.manifests.set(id, manifest);
        }
      } catch (err) {
        this.addIssue('error', 'SKILL_NOT_FOUND',
          `Skill "${id}" file not found at ${filePath}: ${(err as Error).message}`, id);
      }
    }

    return Array.from(this.manifests.values());
  }

  private resolveSkillPath(id: string, stage: string): string {
    return join(SKILLS_DIR, stage, id, 'SKILL.md');
  }

  private async loadSkillFile(
    id: string,
    filePath: string | undefined,
    capsuleMeta: Record<string, unknown>
  ): Promise<SkillManifest | null> {
    if (!filePath) {
      throw new Error(`Skill "${id}" has no file_path defined in registry`);
    }

    const absolutePath = filePath.startsWith('/')
      ? filePath
      : join(PROJECT_ROOT, filePath);
    const content = await readFile(absolutePath, 'utf-8');
    const lines = content.split('\n');

    const frontmatter = this.parseFrontmatter(content);
    const processSteps = this.extractProcessSteps(content);
    const outputs = this.extractOutputs(content);
    const resolvedProcessSteps = processSteps.length > 0
      ? processSteps
      : this.processStepsFromRegistry(capsuleMeta.process);
    const resolvedOutputs = outputs.length > 0
      ? outputs
      : this.normalizeStringArray(capsuleMeta.output);

    const dir = dirname(absolutePath);
    const [hasAssets, hasReferences] = await Promise.all([
      this.dirExists(join(dir, 'assets')),
      this.dirExists(join(dir, 'references'))
    ]);

    this.validateSkillQuality(id, lines.length, frontmatter, resolvedProcessSteps, resolvedOutputs);

    return {
      id,
      name: (frontmatter.name || capsuleMeta.name || id) as string,
      stage: (frontmatter.stage || capsuleMeta.stage || 'cross-cutting') as Stage | 'cross-cutting',
      roles: this.normalizeStringArray(frontmatter.roles || capsuleMeta.roles || []),
      pattern: (frontmatter.pattern || capsuleMeta.pattern || '') as string,
      mandatory: (frontmatter.mandatory ?? capsuleMeta.mandatory ?? true) as boolean,
      depends: this.normalizeStringArray(frontmatter.depends || capsuleMeta.depends || []),
      version: (frontmatter.version || '3.0.0') as string,
      process: resolvedProcessSteps,
      output: resolvedOutputs,
      contentHash: this.hashContent(content),
      filePath,
      hasAssets,
      hasReferences,
      lineCount: lines.length,
    };
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    if (typeof value === 'string') {
      return [value];
    }
    if (value == null) {
      return [];
    }
    return [];
  }

  private parseFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    try {
      return parseYaml(match[1]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private extractProcessSteps(content: string): ProcessStep[] {
    const steps: ProcessStep[] = [];

    const patterns = [
      /^### (?:Step\s+)?(\d+)[.:]\s*(.+)$/gm,
      /^### (?:Phase|阶段)\s+(\d+)[.:]\s*(.+)$/gm,
      /^## (\d+)[.:]\s*(.+)$/gm,
      /^### (\d+)[.:]\s*(.+)$/gm,
    ];

    for (const regex of patterns) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        if (!steps.find(s => s.step === parseInt(match![1], 10))) {
          steps.push({
            step: parseInt(match[1], 10),
            name: match[2].trim(),
            actions: [],
          });
        }
      }
      if (steps.length > 0) break;
    }

    if (steps.length === 0) {
      const sectionMatch = content.match(/^##\s+((?:.*(?:流程|工作流|Workflow|Process|Steps|步骤).*))\s*$/m);
      if (sectionMatch) {
        steps.push({ step: 1, name: sectionMatch[1].trim(), actions: ['见完整文档'] });
      }
    }

    return steps.sort((a, b) => a.step - b.step);
  }

  private extractOutputs(content: string): string[] {
    const outputs: string[] = [];

    const patterns = [
      /^## (?:产出物|输出物|Output)\s*\n((?:[-*] .+\n?)+)/m,
      /^## 产出物\s*\n\|[^\n]+\n\|[-|\s]+\n((?:\|.+\n?)+)/m,
      /^output:\s*(.+)/im,
    ];

    for (const regex of patterns) {
      const match = regex.exec(content);
      if (match && match[1] != null) {
        const matchContent = String(match[1]);
        if (matchContent.includes('\n')) {
          const lines = matchContent.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.startsWith('- ') || line.startsWith('* ')) {
              outputs.push(line.trim());
            } else if (line.startsWith('|')) {
              const cells = line.split('|').map(c => c.trim()).filter(c => c && c !== '------');
              if (cells.length >= 2) {
                outputs.push(`${cells[0]}: ${cells[1]}`);
              } else if (cells.length === 1) {
                outputs.push(cells[0]);
              }
            }
          }
          if (outputs.length > 0) break;
        } else {
          outputs.push(matchContent.trim());
          break;
        }
      }
    }

    if (outputs.length === 0) {
      const pathMatch = content.match(/`(.[^`]+)`\s*(?:→|->|→)/);
      if (pathMatch) outputs.push(pathMatch[1].trim());
    }

    return outputs;
  }

  private processStepsFromRegistry(value: unknown): ProcessStep[] {
    const entries = this.normalizeStringArray(value);
    return entries.map((entry, index) => ({
      step: index + 1,
      name: entry,
      actions: [],
    }));
  }

  private validateSkillQuality(
    id: string,
    lineCount: number,
    frontmatter: Record<string, unknown>,
    processSteps: ProcessStep[],
    outputs: string[]
  ): void {
    if (lineCount < 50) {
      this.addIssue('warn', 'SKILL_TOO_SHORT',
        `Skill "${id}" has only ${lineCount} lines (minimum 50). Consider expanding with more detailed process steps and examples.`,
        id, 'Add more detail to process steps, add examples, expand failure handling section.');
    }

    const requiredFields = ['name', 'stage', 'pattern'];
    for (const field of requiredFields) {
      if (!frontmatter[field]) {
        this.addIssue('warn', 'MISSING_FRONTMATTER_FIELD',
          `Skill "${id}" missing frontmatter field: "${field}"`, id,
          `Add "${field}: value" to the YAML frontmatter.`);
      }
    }

    if (processSteps.length < 1) {
      this.addIssue('warn', 'NO_PROCESS_STEPS',
        `Skill "${id}" has no extractable process steps`, id,
        'Add "## 执行流程" section with "### Step 1: ..." format.');
    }

    if (outputs.length < 1) {
      this.addIssue('info', 'NO_OUTPUT_DEFINED',
        `Skill "${id}" has no defined outputs`, id,
        'Add "## 产出物" section listing output files.');
    }
  }

  private async dirExists(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private addIssue(severity: Severity, code: string, message: string, source?: string, suggestion?: string): void {
    this.issues.push({ severity, code, message, source, suggestion });
  }

  getValidationResult(): ValidationResult {
    const errors = this.issues.filter(i => i.severity === 'error').length;
    const warnings = this.issues.filter(i => i.severity === 'warn').length;
    const infos = this.issues.filter(i => i.severity === 'info').length;
    return {
      valid: errors === 0,
      issues: this.issues,
      summary: { errors, warnings, infos },
    };
  }

  getManifest(id: string): SkillManifest | undefined {
    return this.manifests.get(id);
  }

  getAllManifests(): SkillManifest[] {
    return Array.from(this.manifests.values());
  }
}
