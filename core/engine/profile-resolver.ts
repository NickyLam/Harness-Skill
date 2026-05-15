/**
 * ProfileResolver — 技术栈自动检测与解析
 *
 * 检测优先级：
 *   1. .harness/config.yaml 中显式指定 tech_profile
 *   2. 根据项目文件自动推断（package.json → react-ts, pyproject.toml → python, ...）
 *   3. 兜底 generic
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { TechProfile } from './types.js';

const PROJECT_ROOT = join(import.meta.dirname ?? '', '..', '..');
const PROFILES_DIR = join(PROJECT_ROOT, 'core', 'profiles');

export interface DetectionResult {
  profile: TechProfile;
  detectionMethod: 'explicit' | 'auto' | 'fallback';
  confidence: number;
}

export class ProfileResolver {
  private cache: Map<string, TechProfile> = new Map();

  async resolve(projectDir?: string): Promise<DetectionResult> {
    const dir = projectDir ?? PROJECT_ROOT;

    const explicit = await this.resolveExplicit(dir);
    if (explicit !== null) return explicit;

    const autoDetected = await this.autoDetect(dir);
    if (autoDetected !== null) return autoDetected;

    return this.fallback();
  }

  private async resolveExplicit(dir: string): Promise<DetectionResult | null> {
    const configPath = join(dir, '.harness', 'config.yaml');
    try {
      await stat(configPath);
    } catch {
      return null;
    }

    try {
      const content = await readFile(configPath, 'utf-8');
      const config = parseYaml(content) as Record<string, unknown>;
      const profileId = config.tech_profile as string | undefined;

      if (profileId) {
        const profile = await this.loadProfile(profileId);
        if (profile !== null) {
          return { profile, detectionMethod: 'explicit', confidence: 100 };
        }
      }
    } catch {
      // 配置文件读取或解析失败，继续走自动检测流程
    }
    return null;
  }

  private async autoDetect(dir: string): Promise<DetectionResult | null> {
    const profiles = await this.loadAllProfiles();

    for (const profile of profiles) {
      if (profile.id === 'generic') continue;

      const detectionFiles = profile.detectionFiles;
      if (!detectionFiles || detectionFiles.length === 0) continue;

      let matchCount = 0;
      for (const file of detectionFiles) {
        try {
          await stat(join(dir, file));
          matchCount++;
        } catch {
          // file doesn't exist
        }
      }

      const threshold = Math.ceil(detectionFiles.length / 2);
      if (matchCount >= threshold) {
        return {
          profile,
          detectionMethod: 'auto',
          confidence: Math.round((matchCount / detectionFiles.length) * 100),
        };
      }
    }

    return null;
  }

  private fallback(): DetectionResult {
    return {
      profile: this.getGenericProfile(),
      detectionMethod: 'fallback',
      confidence: 10,
    };
  }

  async loadProfile(id: string): Promise<TechProfile | null> {
    const cached = this.cache.get(id);
    if (cached !== undefined) return cached;

    const filePath = join(PROFILES_DIR, `${id}.yaml`);
    try {
      await stat(filePath);
    } catch {
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const raw = parseYaml(content) as Record<string, unknown>;
      const profile = this.normalizeProfile(raw);
      this.cache.set(id, profile);
      return profile;
    } catch {
      return null;
    }
  }

  async loadAllProfiles(): Promise<TechProfile[]> {
    const files = await readdir(PROFILES_DIR).catch(() => [] as string[]);
    const profiles: TechProfile[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml') && !file.startsWith('_')) {
        const id = file.replace(/\.yaml$/, '');
        const profile = await this.loadProfile(id);
        if (profile !== null) {
          profiles.push(profile);
        }
      }
    }

    return profiles.sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      return pb - pa;
    });
  }

  private normalizeProfile(raw: Record<string, unknown>): TechProfile {
    const build = raw.build as Record<string, unknown> ?? {};
    const tdd = raw.tdd as Record<string, unknown> ?? {};
    const e2e = raw.e2e as Record<string, unknown> ?? {};
    const conventions = raw.conventions as Record<string, unknown> | undefined;

    return {
      id: raw.id as string,
      name: raw.name as string,
      version: raw.version as string | undefined,
      priority: raw.priority as number | undefined,
      build: {
        typecheckCommand: (build.typecheck_command as string) ?? '',
        buildCommand: (build.build_command as string) ?? '',
        testCommand: (build.test_command as string) ?? '',
        testCoverageCommand: (build.test_coverage_command as string) ?? '',
        lintCommand: (build.lint_command as string) ?? '',
        coverageThreshold: (build.coverage_threshold as number) ?? 80,
        strictCoverageThreshold: (build.strict_coverage_threshold as number) ?? 90,
      },
      tdd: {
        testTemplate: (tdd.test_template as string) ?? '',
      },
      e2e: {
        framework: ((e2e.framework as string) ?? 'none') as TechProfile['e2e']['framework'],
        devServerStart: (e2e.dev_server_start as string) ?? '',
        devServerPort: (e2e.dev_server_port as number) ?? 0,
        devServerReadyCheck: e2e.dev_server_ready_check as string | undefined,
      },
      template: (raw.template as string ?? null) as string | null,
      gateOverrides: raw.gate_overrides as TechProfile['gateOverrides'],
      conventions: conventions
        ? {
            testDir: (conventions.test_dir as string) ?? '',
            testSuffix: (conventions.test_suffix as string) ?? '',
            sourceDir: (conventions.source_dir as string) ?? '',
            configFiles: (conventions.config_files as string[]) ?? [],
          }
        : undefined,
      detectionFiles: (raw.detection_files as string[]) ?? undefined,
    };
  }

  private getGenericProfile(): TechProfile {
    return {
      id: 'generic',
      name: 'Generic (Minimal)',
      priority: 0,
      build: {
        typecheckCommand: "echo 'No typecheck configured for this profile'",
        buildCommand: "echo 'No build command configured'",
        testCommand: "echo 'No test command configured'",
        testCoverageCommand: '',
        lintCommand: "echo 'No lint configured'",
        coverageThreshold: 0,
        strictCoverageThreshold: 0,
      },
      tdd: { testTemplate: '' },
      e2e: { framework: 'none', devServerStart: '', devServerPort: 0 },
      template: null,
      detectionFiles: [],
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
