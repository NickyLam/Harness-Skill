export interface BenchmarkTask {
  id: string;
  name: string;
  type: 'full_pipeline' | 'stage_only' | 'gate_test' | 'skill_test';
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  stages?: string[];
  stage?: string;
  skill?: string;
  input?: string;
  expected_artifacts?: string[];
  success_criteria: Record<string, boolean | number | string>;
  timeout_minutes: number;
  injected_defects?: string[];
  expected_behavior?: string;
}

export interface RunResult {
  taskId: string;
  iteration: number;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  success: boolean;
  gateResults?: Record<string, { passed: boolean; durationMs: number }>;
  testResults?: { passed: boolean; total: number; failed: number; coverage?: number };
  criteriaMet: Record<string, boolean>;
  tokenEstimate: number;
  error?: string;
  notes?: string;
}

export interface EvidenceReport {
  iteration: number;
  generatedAt: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    overallPassRate: number;
    avgDurationMs: number;
    avgTokenUsage: number;
    errorRate: number;
  };
  taskDetails: RunResult[];
  failurePatterns: FailurePattern[];
  componentMapping: ComponentImprovement[];
  recommendations: string[];
}

export interface FailurePattern {
  pattern: string;
  frequency: number;
  affectedTasks: string[];
  rootComponentClass: string;
  example: string;
}

export interface ComponentImprovement {
  componentClass: string;
  priority: 'high' | 'medium' | 'low';
  currentScore: number;
  reason: string;
  suggestedAction: string;
}

export interface PredictionRecord {
  id: string;
  iteration: number;
  component: string;
  file: string;
  changeDescription: string;
  predictedEffect: string;
  verificationMethod: string;
  createdAt: string;
  verifiedAt?: string;
  outcome: 'confirmed' | 'rejected' | 'pending';
}

export interface EvolutionConfig {
  maxIterations: number;
  targetPassRate: number;
  predictionAccuracyThreshold: number;
  noImprovementLimit: number;
  benchmarkFilter?: string[];
  simulateOnly?: boolean;
  taskRunner?: (task: BenchmarkTask) => Promise<RunResult>;
}

export interface EvolutionSummary {
  totalIterations: number;
  terminatedReason: 'target_reached' | 'max_iterations' | 'prediction_accuracy' | 'no_improvement' | 'manual';
  finalPassRate: number;
  bestPassRate: number;
  improvementTrend: number[];
  predictionsMade: number;
  predictionsConfirmed: number;
  totalDurationMs: number;
}
