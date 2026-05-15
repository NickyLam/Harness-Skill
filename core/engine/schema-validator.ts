import { readFile, stat } from 'fs/promises';
import { join, relative, normalize, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { glob } from 'glob';
import type { ValidationResult, ValidationIssue, Severity } from './types.js';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');

function isPathWithin(childPath: string, parentPath: string): boolean {
  const resolved = resolve(normalize(childPath));
  const parentResolved = resolve(normalize(parentPath));
  return resolved.startsWith(parentResolved + '/') || resolved === parentResolved;
}

interface RegistryCapsule {
  id: string;
  name: string;
  stage: string | string[];
  file_path: string;
}

interface PipelineStage {
  capsules?: {
    mandatory?: string[];
    optional?: string[];
  };
  gate?: string;
}

interface PipelineData {
  stages?: Record<string, PipelineStage>;
  gates?: Record<string, unknown>;
}

interface RegistryData {
  capsules?: Record<string, RegistryCapsule>;
}

export class SchemaValidator {
  private issues: ValidationIssue[] = [];

  async validate(): Promise<ValidationResult> {
    this.issues = [];

    await this.validateRegistryCapsuleReferences();
    await this.validateSkillFilesExist();
    await this.validateSkillFrontMatter();
    await this.validatePipelineGateReferences();

    return this.buildResult();
  }

  private async loadRegistry(): Promise<RegistryData> {
    const registryPath = join(PROJECT_ROOT, 'core', 'registry.yaml');
    const content = await readFile(registryPath, 'utf-8');
    return parseYaml(content) as RegistryData;
  }

  private async loadPipeline(): Promise<PipelineData> {
    const pipelinePath = join(PROJECT_ROOT, 'core', 'pipeline.yaml');
    const content = await readFile(pipelinePath, 'utf-8');
    return parseYaml(content) as PipelineData;
  }

  private addIssue(severity: Severity, code: string, message: string, source?: string, suggestion?: string): void {
    this.issues.push({ severity, code, message, source, suggestion });
  }

  private buildResult(): ValidationResult {
    const errors = this.issues.filter(i => i.severity === 'error').length;
    const warnings = this.issues.filter(i => i.severity === 'warn').length;
    const infos = this.issues.filter(i => i.severity === 'info').length;
    return {
      valid: errors === 0,
      issues: this.issues,
      summary: { errors, warnings: warnings, infos }
    };
  }

  async validateRegistryCapsuleReferences(): Promise<void> {
    let registry: RegistryData;
    try {
      registry = await this.loadRegistry();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.addIssue('error', 'REGISTRY_READ_FAIL', `无法读取 core/registry.yaml: ${message}`, 'core/registry.yaml');
      return;
    }

    let pipeline: PipelineData;
    try {
      pipeline = await this.loadPipeline();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.addIssue('error', 'PIPELINE_READ_FAIL', `无法读取 core/pipeline.yaml: ${message}`, 'core/pipeline.yaml');
      return;
    }

    if (!registry.capsules) {
      this.addIssue('warn', 'REGISTRY_NO_CAPSULES', 'registry.yaml 中未找到 capsules 段', 'core/registry.yaml');
      return;
    }

    if (!pipeline.stages) {
      this.addIssue('error', 'PIPELINE_NO_STAGES', 'pipeline.yaml 中未找到 stages 段', 'core/pipeline.yaml');
      return;
    }

    const capsuleKeys = Object.keys(registry.capsules);
    const referencedCapsules = new Set<string>();

    for (const [stageName, stageDef] of Object.entries(pipeline.stages)) {
      const mandatory = stageDef.capsules?.mandatory ?? [];
      const optional = stageDef.capsules?.optional ?? [];
      for (const cap of [...mandatory, ...optional]) {
        referencedCapsules.add(cap);
      }
    }

    for (const capsuleKey of capsuleKeys) {
      if (!referencedCapsules.has(capsuleKey)) {
        const capsule = registry.capsules[capsuleKey];
        const capsuleStage = capsule?.stage;
        const isCrossCutting = Array.isArray(capsuleStage)
          ? capsuleStage.includes('cross-cutting')
          : capsuleStage === 'cross-cutting';

        if (isCrossCutting) {
          this.addIssue(
            'info',
            'CAPSULE_UNREFERENCED_CROSS_CUTTING',
            `胶囊 "${capsuleKey}" (${capsule?.name ?? capsuleKey}) 是跨阶段胶囊，未被任何 stage.capsules 显式引用`,
            `core/registry.yaml > capsules.${capsuleKey}`,
            '跨阶段胶囊可在运行时动态加载，此信息仅供参考'
          );
        } else {
          this.addIssue(
            'warn',
            'CAPSULE_UNREFERENCED',
            `胶囊 "${capsuleKey}" (${capsule?.name ?? capsuleKey}) 未被 pipeline.yaml 的任何 stage.capsules 引用`,
            `core/registry.yaml > capsules.${capsuleKey}`,
            `请在 pipeline.yaml 的对应 stage 中添加该胶囊到 mandatory 或 optional 列表`
          );
        }
      }
    }

    for (const [stageName, stageDef] of Object.entries(pipeline.stages)) {
      const mandatory = stageDef.capsules?.mandatory ?? [];
      const optional = stageDef.capsules?.optional ?? [];
      const allStageCapsules = [...mandatory, ...optional];

      for (const ref of allStageCapsules) {
        if (!registry.capsules[ref]) {
          this.addIssue(
            'error',
            'CAPSULE_UNDEFINED',
            `stage "${stageName}" 引用了未注册的胶囊 "${ref}"`,
            `core/pipeline.yaml > stages.${stageName}.capsules`,
            `请在 core/registry.yaml 的 capsules 段中注册 "${ref}"`
          );
        }
      }
    }
  }

  async validateSkillFilesExist(): Promise<void> {
    let registry: RegistryData;
    try {
      registry = await this.loadRegistry();
    } catch (err) {
      return;
    }

    if (!registry.capsules) {
      return;
    }

    for (const [capsuleKey, capsule] of Object.entries(registry.capsules)) {
      if (!capsule.file_path) {
        this.addIssue(
          'warn',
          'SKILL_NO_FILE_PATH',
          `胶囊 "${capsuleKey}" 缺少 file_path 字段，无法校验 SKILL.md 是否存在`,
          `core/registry.yaml > capsules.${capsuleKey}`
        );
        continue;
      }

      const skillAbsolutePath = join(PROJECT_ROOT, capsule.file_path);

      if (!isPathWithin(skillAbsolutePath, PROJECT_ROOT)) {
        this.addIssue(
          'error',
          'SKILL_PATH_TRAVERSAL',
          `胶囊 "${capsuleKey}" 的 file_path 逃逸了项目根目录: ${capsule.file_path}`,
          `core/registry.yaml > capsules.${capsuleKey}.file_path`,
          '修正 file_path 使其指向项目根目录内的文件'
        );
        continue;
      }

      try {
        await stat(skillAbsolutePath);
      } catch (err) {
        const errorCode = (err as NodeJS.ErrnoException).code;
        if (errorCode === 'ENOENT') {
          this.addIssue(
            'error',
            'SKILL_FILE_MISSING',
            `胶囊 "${capsuleKey}" 声明的 SKILL.md 文件不存在: ${capsule.file_path}`,
            `core/registry.yaml > capsules.${capsuleKey}.file_path`,
            `请创建 ${capsule.file_path} 或修正 file_path 路径`
          );
        } else {
          const message = err instanceof Error ? err.message : String(err);
          this.addIssue(
            'error',
            'SKILL_FILE_ACCESS_ERROR',
            `无法访问胶囊 "${capsuleKey}" 的 SKILL.md 文件 (${capsule.file_path}): ${message}`,
            capsule.file_path
          );
        }
      }
    }
  }

  async validateSkillFrontMatter(): Promise<void> {
    let registry: RegistryData;
    try {
      registry = await this.loadRegistry();
    } catch (err) {
      return;
    }

    if (!registry.capsules) {
      return;
    }

    for (const [capsuleKey, capsule] of Object.entries(registry.capsules)) {
      if (!capsule.file_path) {
        continue;
      }

      const skillAbsolutePath = join(PROJECT_ROOT, capsule.file_path);

      if (!isPathWithin(skillAbsolutePath, PROJECT_ROOT)) {
        continue;
      }

      let fileStat;
      try {
        fileStat = await stat(skillAbsolutePath);
      } catch {
        continue;
      }

      let content: string;
      try {
        content = await readFile(skillAbsolutePath, 'utf-8');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.addIssue('error', 'SKILL_READ_FAIL', `无法读取 ${capsule.file_path}: ${message}`, capsule.file_path);
        continue;
      }

      const lineCount = content.split('\n').length;

      if (lineCount < 50) {
        this.addIssue(
          'warn',
          'SKILL_TOO_SHORT',
          `胶囊 "${capsuleKey}" 的 SKILL.md 仅 ${lineCount} 行，低于最低要求 50 行`,
          capsule.file_path,
          '建议补充更多执行规则、示例和边界条件说明'
        );
      }

      const hasYamlFrontmatter = content.startsWith('---');
      const blockquoteMetaMatch = content.match(/^>\s*\*\*(\w+)\*\*:\s*(.+)$/m);

      if (!hasYamlFrontmatter && !blockquoteMetaMatch) {
        this.addIssue(
          'warn',
          'SKILL_NO_FRONTMATTER',
          `胶囊 "${capsuleKey}" 的 SKILL.md 缺少元数据声明（无 YAML frontmatter 也无 blockquote 元数据）`,
          capsule.file_path,
          '建议在文件开头添加 YAML frontmatter（---）或 blockquote 格式的 id/name/stage/roles/pattern/mandatory 字段'
        );
      }

      if (hasYamlFrontmatter) {
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd === -1) {
          this.addIssue('error', 'SKILL_FRONTMATTER_MALFORMED', `胶囊 "${capsuleKey}" 的 SKILL.md YAML frontmatter 未正确关闭（缺少结尾 ---）`, capsule.file_path);
          continue;
        }

        const frontmatterRaw = content.slice(3, frontmatterEnd).trim();
        let frontmatterData: Record<string, unknown>;
        try {
          frontmatterData = parseYaml(frontmatterRaw) as Record<string, unknown>;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.addIssue('error', 'SKILL_FRONTMATTER_PARSE_ERROR', `胶囊 "${capsuleKey}" 的 SKILL.md YAML frontmatter 解析失败: ${message}`, capsule.file_path);
          continue;
        }

        const requiredFields = ['id', 'name', 'stage', 'roles', 'pattern', 'mandatory'];
        for (const field of requiredFields) {
          if (!(field in frontmatterData)) {
            this.addIssue(
              'error',
              `SKILL_MISSING_FIELD_${field.toUpperCase()}`,
              `胶囊 "${capsuleKey}" 的 SKILL.md frontmatter 缺少必需字段: ${field}`,
              capsule.file_path,
              `请添加 ${field}: <value> 到 YAML frontmatter 中`
            );
          }
        }
      }

      if (blockquoteMetaMatch && !hasYamlFrontmatter) {
        const metaLines = content.match(/^>\s*\*\*(\w+)\*\*:\s*(.+)$/gm) ?? [];
        const metaMap = new Map<string, string>();
        for (const line of metaLines) {
          const match = line.match(/^>\s*\*\*(\w+)\*\*:\s*(.+)$/);
          if (match) {
            metaMap.set(match[1].toLowerCase(), match[2].trim());
          }
        }

        const expectedKeys = ['id', 'name', 'stage', 'roles', 'pattern'];
        for (const key of expectedKeys) {
          if (!metaMap.has(key)) {
            this.addIssue(
              'info',
              `SKILL_BLOCKQUOTE_MISSING_${key.toUpperCase()}`,
              `胶囊 "${capsuleKey}" 的 SKILL.md blockquote 元数据中可能缺少 "${key}" 字段（使用非标准格式时可能以其他名称存在）`,
              capsule.file_path
            );
          }
        }
      }
    }
  }

  async validatePipelineGateReferences(): Promise<void> {
    let pipeline: PipelineData;
    try {
      pipeline = await this.loadPipeline();
    } catch (err) {
      return;
    }

    if (!pipeline.gates) {
      this.addIssue('warn', 'PIPELINE_NO_GATES', 'pipeline.yaml 中未找到 gates 段', 'core/pipeline.yaml');
      return;
    }

    const definedGateIds = new Set(Object.keys(pipeline.gates));
    const referencedGateIds = new Set<string>();

    if (pipeline.stages) {
      for (const [stageName, stageDef] of Object.entries(pipeline.stages)) {
        if (stageDef.gate) {
          referencedGateIds.add(stageDef.gate);
        }
      }
    }

    for (const gateRef of referencedGateIds) {
      if (!definedGateIds.has(gateRef)) {
        this.addIssue(
          'error',
          'GATE_UNDEFINED',
          `stage 引用了未定义的门禁 "${gateRef}"，但在 gates 段中找不到对应定义`,
          `core/pipeline.yaml > stages.*.gate`,
          `请在 core/pipeline.yaml 的 gates 段中添加 "${gateRef}" 的定义`
        );
      }
    }

    for (const [gateId, gateDef] of Object.entries(pipeline.gates)) {
      const gateRecord = gateDef as Record<string, unknown>;
      const levels = gateRecord.levels as Record<string, unknown> | undefined;

      if (levels) {
        for (const [levelName, levelDef] of Object.entries(levels)) {
          const levelRecord = levelDef as Record<string, unknown>;
          const checks = levelRecord.checks as Array<Record<string, unknown>> | undefined;

          if (checks) {
            for (const check of checks) {
              if (check.command && typeof check.command === 'string') {
                const cmdParts = check.command.trim().split(/\s+/);
                const exeName = cmdParts[0];

                if (exeName && !exeName.includes('/') && !exeName.includes('\\')) {
                  if (!(await this.commandExists(exeName))) {
                    this.addIssue(
                      'warn',
                      'GATE_COMMAND_NOT_FOUND',
                      `门禁 "${gateId}" > ${levelName} 的检查项 "${check.name ?? check.id}" 引用的命令 "${exeName}" 在 PATH 中未找到`,
                      `core/pipeline.yaml > gates.${gateId}.levels.${levelName}`,
                      `确认 "${exeName}" 已安装并在 PATH 中可用，或忽略此警告（运行时会使用完整 PATH 查找）`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private async commandExists(commandName: string): Promise<boolean> {
    const pathEntries = (process.env.PATH ?? '')
      .split(':')
      .filter(Boolean);

    for (const dir of pathEntries) {
      try {
        await stat(join(dir, commandName));
        return true;
      } catch {
        // Continue searching PATH.
      }
    }

    return false;
  }
}
