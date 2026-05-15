// === 阶段与流水线 ===
export type Stage = 'spec' | 'plan' | 'build' | 'test' | 'review' | 'simplify' | 'ship' | 'cross-cutting';

export interface StageDefinition {
  id: string;
  order: number;
  name: string;
  role: string;
  description: string;
  input: string[];
  output: string[];
  capsules: {
    mandatory: string[];
    optional: string[];
  };
  gate: string;
  estimatedDuration: string;
  dependsOn?: Stage[];
}

// === 门禁 ===
export type StrictnessLevel = 'L1-lightweight' | 'L2-standard' | 'L3-strict';

export type CheckType = 'file_exists' | 'command' | 'pattern_match' | 'git_status';

export interface CheckDefinition {
  id: string;
  name: string;
  type?: 'command' | 'pattern_match' | 'git_status' | 'file_exists';
  verify?: string;
  command?: string;
  pattern?: string;
  filePattern?: string;
  required: boolean;
}

export interface GateLevel {
  level: StrictnessLevel;
  checks: CheckDefinition[];
}

export interface GateDefinition {
  id: string;
  name: string;
  stageTransition: string;
  description: string;
  levels: Record<StrictnessLevel, GateLevel>;
  failAction: string;
}

export interface GateResult {
  gateId: string;
  level: StrictnessLevel;
  passed: boolean;
  checks: CheckResult[];
  durationMs: number;
  failAction: string;
  timestamp: string;
}

export interface CheckResult {
  checkId: string;
  name: string;
  passed: boolean;
  message: string;
  remediation?: string;
  durationMs: number;
  required?: boolean;
}

// === 技能 ===
export interface ProcessStep {
  step: number;
  name: string;
  actions: string[];
  output?: string;
}

export interface SkillManifest {
  id: string;
  name: string;
  stage: Stage;
  roles: string[];
  pattern: string;
  mandatory: boolean;
  depends: string[];
  version: string;
  process: ProcessStep[];
  output: string[];
  contentHash: string;
  filePath: string;
  hasAssets: boolean;
  hasReferences: boolean;
  lineCount: number;
}

// === 度量 ===
export interface MetricRecord {
  timestamp: string;
  runId: string;
  stage: string;
  gateId?: string;
  passed?: boolean;
  durationMs: number;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
}

// === 技术栈 Profile ===
export interface TechProfileBuild {
  typecheckCommand: string;
  buildCommand: string;
  testCommand: string;
  testCoverageCommand: string;
  lintCommand: string;
  coverageThreshold: number;
  strictCoverageThreshold: number;
}

export interface TechProfileTdd {
  testTemplate: string;
}

export interface TechProfileE2e {
  framework: 'playwright' | 'puppeteer' | 'cypress' | 'none';
  devServerStart: string;
  devServerPort: number;
  devServerReadyCheck?: string;
}

export interface GateOverrideEntry {
  [commandName: string]: string;
}

export interface GateOverrides {
  build_gate?: Record<string, string>;
  test_gate?: Record<string, string>;
}

export interface ProfileConventions {
  testDir: string;
  testSuffix: string;
  sourceDir: string;
  configFiles: string[];
}

export interface TechProfile {
  id: string;
  name: string;
  version?: string;
  priority?: number;
  build: TechProfileBuild;
  tdd: TechProfileTdd;
  e2e: TechProfileE2e;
  template: string | null;
  gateOverrides?: GateOverrides;
  conventions?: ProfileConventions;
  detectionFiles?: string[];
}

// === 校验结果 ===
export type Severity = 'error' | 'warn' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  source?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}
