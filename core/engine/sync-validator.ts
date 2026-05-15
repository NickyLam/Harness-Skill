import { readFile, stat, readdir } from 'fs/promises';
import { join, relative, normalize, resolve, basename } from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import type { ValidationResult, ValidationIssue, Severity } from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const CORE_DIR = join(PROJECT_ROOT, 'core');
const DIST_DIR = join(PROJECT_ROOT, 'skill-dist');

function isPathWithin(childPath: string, parentPath: string): boolean {
  const resolved = resolve(normalize(childPath));
  const parentResolved = resolve(normalize(parentPath));
  return resolved.startsWith(parentResolved + '/') || resolved === parentResolved;
}

export interface SyncFileDiff {
  file: string;
  coreHash: string;
  distHash: string;
  coreSize: number;
  distSize: number;
}

export interface SyncValidationResult extends ValidationResult {
  coreOnlyFiles: string[];
  distOnlyFiles: string[];
  contentDiffs: SyncFileDiff[];
  syncScore: number;
}

export interface SyncValidatorOptions {
  ignorePatterns?: RegExp[];
  hashAlgorithm?: string;
  compareExtensions?: string[];
  includeBinary?: boolean;
}

export class SyncValidator {
  private issues: ValidationIssue[] = [];
  private options: Required<SyncValidatorOptions>;

  constructor(options: SyncValidatorOptions = {}) {
    this.options = {
      ignorePatterns: [
        /^node_modules/,
        /^\.git/,
        /^__tests__/,
        /\.test\.(ts|js)$/,
        /\.map$/,
        /^tsconfig\.json$/,
        /^package\.json$/,
      ],
      hashAlgorithm: 'sha256',
      compareExtensions: ['.md', '.yaml', '.yml', '.json', '.ts', '.sh'],
      includeBinary: false,
      ...options,
    };
  }

  async validate(): Promise<SyncValidationResult> {
    this.issues = [];

    const [coreExists, distExists] = await Promise.all([
      this.dirExists(CORE_DIR),
      this.dirExists(DIST_DIR),
    ]);

    if (!coreExists) {
      this.addIssue('error', 'SYNC_CORE_MISSING', `核心目录不存在: ${CORE_DIR}`, CORE_DIR);
      return this.buildSyncResult([], [], []);
    }

    if (!distExists) {
      this.addIssue('warn', 'SYNC_DIST_MISSING', `分发目录不存在: ${DIST_DIR}（首次运行或尚未同步）`, DIST_DIR);
      return this.buildSyncResult([], [], []);
    }

    const coreFiles = await this.collectComparableFiles(CORE_DIR);
    const distFiles = await this.collectComparableFiles(DIST_DIR);

    const coreRelativeMap = new Map<string, string>();
    for (const f of coreFiles) {
      const comparablePath = this.toComparablePath('core', relative(CORE_DIR, f));
      if (comparablePath) {
        coreRelativeMap.set(comparablePath, f);
      }
    }

    const distRelativeMap = new Map<string, string>();
    for (const f of distFiles) {
      const comparablePath = this.toComparablePath('dist', relative(DIST_DIR, f));
      if (comparablePath) {
        distRelativeMap.set(comparablePath, f);
      }
    }

    const coreOnly: string[] = [];
    const distOnly: string[] = [];
    const commonPaths: string[] = [];

    for (const [relPath, absPath] of coreRelativeMap) {
      if (this.shouldIgnore(relPath)) continue;

      if (distRelativeMap.has(relPath)) {
        commonPaths.push(relPath);
      } else {
        coreOnly.push(relPath);
      }
    }

    for (const [relPath] of distRelativeMap) {
      if (this.shouldIgnore(relPath)) continue;

      if (!coreRelativeMap.has(relPath)) {
        distOnly.push(relPath);
      }
    }

    if (coreOnly.length > 0) {
      this.addIssue(
        'warn',
        'SYNC_CORE_ONLY',
        `${coreOnly.length} 个文件仅在 core/ 中存在，未同步到 skill-dist/: ${coreOnly.slice(0, 10).join(', ')}` +
          (coreOnly.length > 10 ? ` ... 及其他 ${coreOnly.length - 10} 个` : ''),
        CORE_DIR,
        '运行 sync-to-global.sh 同步这些文件'
      );
    }

    if (distOnly.length > 0) {
      this.addIssue(
        'warn',
        'SYNC_DIST_ONLY',
        `${distOnly.length} 个文件仅在 skill-dist/ 中存在，在 core/ 中无对应源文件: ${distOnly.slice(0, 10).join(', ')}` +
          (distOnly.length > 10 ? ` ... 及其他 ${distOnly.length - 10} 个` : ''),
        DIST_DIR,
        '确认这些文件是否为手动添加的分发专用文件，或在 core/ 中补充对应源文件'
      );
    }

    const diffs: SyncFileDiff[] = [];

    for (const relPath of commonPaths.sort()) {
      const coreAbs = coreRelativeMap.get(relPath)!;
      const distAbs = distRelativeMap.get(relPath)!;

      try {
        const [coreContent, distContent] = await Promise.all([
          readFile(coreAbs, 'utf-8'),
          readFile(distAbs, 'utf-8'),
        ]);

        const coreHash = createHash(this.options.hashAlgorithm)
          .update(coreContent)
          .digest('hex')
          .slice(0, 16);

        const distHash = createHash(this.options.hashAlgorithm)
          .update(distContent)
          .digest('hex')
          .slice(0, 16);

        if (coreHash !== distHash) {
          diffs.push({
            file: relPath,
            coreHash,
            distHash,
            coreSize: coreContent.length,
            distSize: distContent.length,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.addIssue(
          'warn',
          'SYNC_FILE_READ_ERROR',
          `无法比对文件 ${relPath}: ${message}`,
          relPath
        );
      }
    }

    if (diffs.length > 0) {
      this.addIssue(
        'error',
        'SYNC_CONTENT_MISMATCH',
        `${diffs.length} 个文件在 core/ 和 skill-dist/ 内容不一致` +
          `\n  不一致文件:\n${diffs.slice(0, 5).map((d) => `    - ${d.file} (core=${d.coreHash}, dist=${d.distHash})`).join('\n')}` +
          (diffs.length > 5 ? `\n  ... 及其他 ${diffs.length - 5} 个` : ''),
        undefined,
        '运行 scripts/sync-to-global.sh 重新同步，或检查是否需要选择性同步'
      );
    }

    const totalComparable = commonPaths.length;
    const consistentCount = totalComparable - diffs.length;
    const syncScore = totalComparable > 0 ? Math.round((consistentCount / totalComparable) * 100) : 100;

    if (syncScore < 80 && totalComparable > 0) {
      this.addIssue(
        'warn',
        'SYNC_LOW_SCORE',
        `同步一致率仅 ${syncScore}% (${consistentCount}/${totalComparable})，建议立即执行同步`,
        undefined,
        '运行 npm run sync 或 scripts/sync-to-global.sh'
      );
    }

    await this.validateSkillEntrypoints();

    return this.buildSyncResult(coreOnly, distOnly, diffs, syncScore);
  }

  async validateSpecificFile(relPath: string): Promise<{
    inCore: boolean;
    inDist: boolean;
    isConsistent: boolean | null;
    diff?: SyncFileDiff;
  }> {
    const coreAbs = join(CORE_DIR, relPath);
    const distAbs = join(DIST_DIR, relPath);

    const [inCore, inDist] = await Promise.all([
      this.fileExists(coreAbs),
      this.fileExists(distAbs),
    ]);

    if (!inCore && !inDist) {
      return { inCore: false, inDist: false, isConsistent: null };
    }

    if (!inCore || !inDist) {
      return { inCore, inDist, isConsistent: false };
    }

    try {
      const [coreContent, distContent] = await Promise.all([
        readFile(coreAbs, 'utf-8'),
        readFile(distAbs, 'utf-8'),
      ]);

      const coreHash = createHash(this.options.hashAlgorithm).update(coreContent).digest('hex').slice(0, 16);
      const distHash = createHash(this.options.hashAlgorithm).update(distContent).digest('hex').slice(0, 16);

      const isConsistent = coreHash === distHash;

      return {
        inCore,
        inDist,
        isConsistent,
        diff: !isConsistent
          ? {
              file: relPath,
              coreHash,
              distHash,
              coreSize: coreContent.length,
              distSize: distContent.length,
            }
          : undefined,
      };
    } catch {
      return { inCore, inDist, isConsistent: null };
    }
  }

  async getSyncReport(): Promise<{
    totalCoreFiles: number;
    totalDistFiles: number;
    comparablePairs: number;
    lastSyncTime?: Date;
  }> {
    const [coreFiles, distFiles] = await Promise.all([
      this.collectComparableFiles(CORE_DIR),
      this.collectComparableFiles(DIST_DIR),
    ]);

    let lastSyncTime: Date | undefined;
    try {
      const syncScriptStat = await stat(join(PROJECT_ROOT, 'scripts', 'sync-to-global.sh'));
      lastSyncTime = syncScriptStat.mtime;
    } catch {
      // sync script not found, skip
    }

    return {
      totalCoreFiles: coreFiles.length,
      totalDistFiles: distFiles.length,
      comparablePairs: Math.min(coreFiles.length, distFiles.length),
      lastSyncTime,
    };
  }

  private shouldIgnore(relPath: string): boolean {
    return this.options.ignorePatterns.some((pattern) => pattern.test(relPath));
  }

  private async collectComparableFiles(dir: string): Promise<string[]> {
    const extensions = this.options.compareExtensions
      .map((ext) => ext.replace(/^\./, ''))
      .join(',');
    const pattern = `**/*.{${extensions}}`;

    try {
      const files = await glob(pattern, {
        cwd: dir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/__tests__/**'],
      });

      return files.filter((f) => this.shouldInclude(f)).sort();
    } catch {
      return [];
    }
  }

  private shouldInclude(filePath: string): boolean {
    const ext = basename(filePath).includes('.') ? '.' + basename(filePath).split('.').pop()! : '';

    if (!this.options.compareExtensions.includes(ext)) {
      return false;
    }

    const relPath = relative(PROJECT_ROOT, filePath);
    return !this.shouldIgnore(relPath);
  }

  private toComparablePath(side: 'core' | 'dist', relPath: string): string | null {
    const normalized = relPath.replace(/\\/g, '/');

    if (side === 'dist') {
      if (
        normalized === 'SKILL.md' ||
        normalized === 'capsules/registry.yaml' ||
        normalized === 'gating/gate-definitions.yaml'
      ) {
        return null;
      }
      return normalized;
    }

    const moduleSkillMatch = normalized.match(/^skills\/spec\/deep-requirements\/modules\/([^/]+)\/(.+)$/);
    if (moduleSkillMatch) {
      return `capsules/${moduleSkillMatch[1]}/${moduleSkillMatch[2]}`;
    }

    const skillMatch = normalized.match(/^skills\/[^/]+\/([^/]+)\/(.+)$/);
    if (skillMatch) {
      return `capsules/${skillMatch[1]}/${skillMatch[2]}`;
    }

    const legacySkillMatch = normalized.match(/^skills\/[^/]+\/.+$/);
    if (legacySkillMatch) {
      return normalized;
    }

    const roleMatch = normalized.match(/^roles\/([^/]+)\.md$/);
    if (roleMatch) {
      return `roles/${roleMatch[1]}/SKILL.md`;
    }

    if (
      normalized.startsWith('engine/') ||
      normalized.startsWith('profiles/') ||
      normalized.startsWith('protocol/') ||
      normalized.startsWith('templates/')
    ) {
      if (
        normalized.endsWith('.ts') ||
        normalized === 'engine/tsconfig.json' ||
        normalized === 'profiles/directory-standards.md'
      ) {
        return null;
      }
      return normalized;
    }

    return null;
  }

  private async dirExists(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async validateSkillEntrypoints(): Promise<void> {
    const rootSkillPath = join(PROJECT_ROOT, 'SKILL.md');
    const distSkillPath = join(DIST_DIR, 'SKILL.md');
    const packagePath = join(PROJECT_ROOT, 'package.json');
    const agentsMetadataPath = join(PROJECT_ROOT, 'agents', 'openai.yaml');
    const manifestPaths = [
      join(PROJECT_ROOT, 'core', 'registry.yaml'),
      join(PROJECT_ROOT, 'core', 'pipeline.yaml'),
      join(DIST_DIR, 'capsules', 'registry.yaml'),
      join(DIST_DIR, 'gating', 'gate-definitions.yaml'),
    ];

    const [rootExists, distExists, rootSkill, distSkill, packageJson, ...manifestContents] = await Promise.all([
      this.fileExists(rootSkillPath),
      this.fileExists(distSkillPath),
      this.safeReadText(rootSkillPath),
      this.safeReadText(distSkillPath),
      this.safeReadText(packagePath),
      ...manifestPaths.map((path) => this.safeReadText(path)),
    ]);

    if (!rootExists) {
      this.addIssue('error', 'ENTRYPOINT_ROOT_MISSING', 'Root SKILL.md is missing or unreadable', rootSkillPath);
    } else if (!rootSkill) {
      this.addIssue('warn', 'ENTRYPOINT_ROOT_UNREADABLE', 'Root SKILL.md exists but could not be read', rootSkillPath);
    }
    if (!distExists) {
      this.addIssue('error', 'ENTRYPOINT_DIST_MISSING', 'skill-dist/SKILL.md is missing or unreadable', distSkillPath);
    } else if (!distSkill) {
      this.addIssue('warn', 'ENTRYPOINT_DIST_UNREADABLE', 'skill-dist/SKILL.md exists but could not be read', distSkillPath);
    }

    if (!(await this.fileExists(agentsMetadataPath))) {
      this.addIssue(
        'warn',
        'OPENAI_METADATA_MISSING',
        'agents/openai.yaml is missing; UI metadata and default prompt will be unavailable',
        agentsMetadataPath,
        'Add agents/openai.yaml with display_name, short_description, and default_prompt.'
      );
    }

    if (rootSkill) {
      this.validateEntrypointDescription(rootSkill, rootSkillPath);
      await this.validateReferencedRepoPaths(rootSkill, PROJECT_ROOT, rootSkillPath);
    }

    if (distSkill) {
      this.validateEntrypointDescription(distSkill, distSkillPath);
      await this.validateReferencedRepoPaths(distSkill, DIST_DIR, distSkillPath);
    }

    this.validateVersionAlignment(rootSkill, distSkill, packageJson, manifestPaths, manifestContents);
  }

  private async safeReadText(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  private validateEntrypointDescription(content: string, source: string): void {
    const description = this.extractFrontmatterField(content, 'description');
    if (!description) {
      this.addIssue('error', 'ENTRYPOINT_DESCRIPTION_MISSING', 'Skill entrypoint missing frontmatter description', source);
      return;
    }

    if (!description.startsWith('Use when ')) {
      this.addIssue(
        'warn',
        'ENTRYPOINT_DESCRIPTION_TRIGGER_FORMAT',
        'Skill entrypoint description should start with "Use when" and describe trigger conditions only',
        source
      );
    }

    if (description.length > 500) {
      this.addIssue(
        'warn',
        'ENTRYPOINT_DESCRIPTION_TOO_LONG',
        `Skill entrypoint description is ${description.length} characters; keep it under 500 characters`,
        source
      );
    }

    if (/\bALWAYS\b|Covers\b|7-stage|RED-GREEN|step\s*\d/i.test(description.replace(/^Use when /, ''))) {
      this.addIssue(
        'warn',
        'ENTRYPOINT_DESCRIPTION_PROCESS_LEAK',
        'Skill entrypoint description appears to include process details; keep process in the body, not metadata',
        source
      );
    }
  }

  private async validateReferencedRepoPaths(content: string, baseDir: string, source: string): Promise<void> {
    const paths = this.extractReferencedRepoPaths(content);
    for (const relPath of paths) {
      const target = join(baseDir, relPath);
      if (!isPathWithin(target, baseDir)) {
        this.addIssue('error', 'ENTRYPOINT_PATH_ESCAPE', `Referenced path escapes skill root: ${relPath}`, source);
        continue;
      }

      if (!(await this.fileExists(target))) {
        this.addIssue(
          'error',
          'ENTRYPOINT_BROKEN_PATH',
          `Entrypoint references missing path: ${relPath}`,
          source,
          'Fix the path or remove the reference from the entrypoint router.'
        );
      }
    }
  }

  private extractReferencedRepoPaths(content: string): string[] {
    const prefixes = [
      'agents/',
      'capsules/',
      'core/',
      'doc_template/',
      'engine/',
      'evals/',
      'gating/',
      'profiles/',
      'protocol/',
      'roles/',
      'scripts/',
      'skill-dist/',
      'skills/',
      'templates/',
    ];
    const singletonFiles = new Set(['SKILL.md', 'package.json', 'package-lock.json']);
    const refs = new Set<string>();
    const backtickRe = /`([^`]+)`/g;
    let match: RegExpExecArray | null;

    while ((match = backtickRe.exec(content)) !== null) {
      const raw = match[1].trim();
      if (!raw || raw.includes('*') || raw.includes('{') || raw.includes('<') || raw.includes(' ')) continue;
      if (raw.startsWith('.') || raw.startsWith('/')) continue;

      if (prefixes.some((prefix) => raw.startsWith(prefix)) || singletonFiles.has(raw)) {
        refs.add(raw.replace(/\/$/, ''));
      }
    }

    return Array.from(refs).sort();
  }

  private validateVersionAlignment(
    rootSkill: string | null,
    distSkill: string | null,
    packageJson: string | null,
    manifestPaths: string[],
    manifestContents: Array<string | null>
  ): void {
    const versions = new Map<string, string>();

    const rootVersion = rootSkill ? this.extractBodyVersion(rootSkill) : null;
    const distVersion = distSkill ? this.extractBodyVersion(distSkill) : null;
    const packageVersion = this.extractPackageVersion(packageJson);

    if (rootVersion) versions.set('SKILL.md', rootVersion);
    if (distVersion) versions.set('skill-dist/SKILL.md', distVersion);
    if (packageVersion) versions.set('package.json', packageVersion);
    manifestContents.forEach((content, index) => {
      const version = content ? this.extractYamlVersion(content) : null;
      if (version) versions.set(relative(PROJECT_ROOT, manifestPaths[index]), version);
    });

    const uniqueVersions = new Set(versions.values());
    if (uniqueVersions.size > 1) {
      this.addIssue(
        'error',
        'ENTRYPOINT_VERSION_MISMATCH',
        `Entrypoint versions are not aligned: ${Array.from(versions.entries()).map(([file, version]) => `${file}=${version}`).join(', ')}`,
        PROJECT_ROOT,
        'Update all entrypoint version references together.'
      );
    }
  }

  private extractFrontmatterField(content: string, field: string): string | null {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) return null;

    const fieldRe = new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, 'm');
    const fieldMatch = frontmatterMatch[1].match(fieldRe);
    return fieldMatch?.[1]?.trim() ?? null;
  }

  private extractBodyVersion(content: string): string | null {
    return content.match(/^Version:\s*([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1] ?? null;
  }

  private extractYamlVersion(content: string): string | null {
    return content.match(/^version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?\s*$/m)?.[1] ?? null;
  }

  private extractPackageVersion(packageJson: string | null): string | null {
    if (!packageJson) return null;
    if (!packageJson.trim().startsWith('{')) return null;
    try {
      const parsed = JSON.parse(packageJson) as { version?: unknown };
      return typeof parsed.version === 'string' ? parsed.version : null;
    } catch {
      this.addIssue('error', 'PACKAGE_JSON_INVALID', 'package.json is not valid JSON', join(PROJECT_ROOT, 'package.json'));
      return null;
    }
  }

  private addIssue(severity: Severity, code: string, message: string, source?: string, suggestion?: string): void {
    this.issues.push({ severity, code, message, source, suggestion });
  }

  private buildSyncResult(
    coreOnly: string[],
    distOnly: string[],
    diffs: SyncFileDiff[],
    syncScore?: number
  ): SyncValidationResult {
    const errors = this.issues.filter((i) => i.severity === 'error').length;
    const warnings = this.issues.filter((i) => i.severity === 'warn').length;
    const infos = this.issues.filter((i) => i.severity === 'info').length;

    return {
      valid: errors === 0,
      issues: this.issues,
      summary: { errors, warnings, infos },
      coreOnlyFiles: coreOnly,
      distOnlyFiles: distOnly,
      contentDiffs: diffs,
      syncScore: syncScore ?? 100,
    };
  }
}
