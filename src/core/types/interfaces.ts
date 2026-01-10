/**
 * ELEX Edge AI Agent Swarm - Core Interfaces
 *
 * Type definitions for domain entities and value objects.
 */

import type {
  AgentId,
  FeatureId,
  QueryId,
  FAJCode,
} from './ids.js';
import type {
  AgentType,
  Category,
  QueryType,
  Action,
  ComplexityLevel,
  RiskLevel,
  SpatialLevel,
  TemporalLevel,
  CounterCategory,
  DataType,
  AccessTechnology,
} from './enums.js';

// ============================================================================
// Scores and Metrics
// ============================================================================

/**
 * Health score: 0.0 (unhealthy) to 1.0 (fully healthy)
 */
export type HealthScore = number;

/**
 * Confidence score: 0.0 (no confidence) to 1.0 (full confidence)
 */
export type ConfidenceScore = number;

/**
 * Q-value for state-action pairs
 */
export type QValue = number;

/**
 * Discount factor for Q-learning (gamma)
 */
export type DiscountFactor = number;

/**
 * Learning rate for Q-learning (alpha)
 */
export type LearningRate = number;

/**
 * Exploration rate (epsilon)
 */
export type ExplorationRate = number;

/**
 * Percentage value (0-100)
 */
export type Percentage = number;

/**
 * Duration in milliseconds
 */
export type Duration = number;

/**
 * Timestamp as Unix epoch milliseconds
 */
export type Timestamp = number;

/**
 * 128-dimensional embedding vector
 */
export type Vector = Float32Array;

/**
 * Hash value for context/state
 */
export type Hash = string;

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  id?: AgentId;
  fajCode: FAJCode;
  type: AgentType;
  category: Category;
  maxMemoryVectors?: number;
  embeddingDimension?: number;
  qLearningConfig?: QLearningConfig;
}

export interface QLearningConfig {
  gamma: DiscountFactor;
  alpha: LearningRate;
  epsilon: ExplorationRate;
  maxTrajectories?: number;
}

// ============================================================================
// Query and Response
// ============================================================================

export interface QueryContext {
  sessionId?: string;
  previousQueryId?: QueryId;
  userPreferences?: Record<string, unknown>;
  spatialScope?: SpatialLevel;
  temporalScope?: TemporalLevel;
}

export interface Query {
  id: QueryId;
  type: QueryType;
  content: string;
  context: QueryContext;
  timestamp: Timestamp;
  complexity?: ComplexityLevel;
  embedding?: Vector;
}

export interface Source {
  type: 'parameter' | 'counter' | 'kpi' | 'procedure' | 'documentation';
  name: string;
  reference?: string;
}

export interface CmeditCommand {
  command: string;
  targetMO: string;
  parameter: string;
  value: string | number | boolean;
  verificationSteps: string[];
}

export interface Response {
  queryId: QueryId;
  agentId: AgentId;
  featureFaj: FAJCode;
  content: string;
  confidence: ConfidenceScore;
  sources: Source[];
  cmeditCommands: CmeditCommand[];
  relatedFeatures: FAJCode[];
  consultedAgents: AgentId[];
  latencyMs: number;
}

// ============================================================================
// Feedback and Rewards
// ============================================================================

export interface Feedback {
  rating: number;  // -1 to +1
  helpful: boolean;
  comment?: string;
  resolved?: boolean;
}

export interface Reward {
  userRating: number;       // [-1, +1]
  resolutionSuccess: number; // +0.5
  latencyPenalty: number;
  consultationCost: number;
  noveltyBonus: number;
}

export function calculateTotalReward(reward: Reward): number {
  return reward.userRating +
         reward.resolutionSuccess +
         reward.latencyPenalty +
         reward.consultationCost +
         reward.noveltyBonus;
}

// ============================================================================
// Q-Learning State
// ============================================================================

export interface State {
  queryType: QueryType;
  complexity: ComplexityLevel;
  contextHash: Hash;
  confidence: ConfidenceScore;
}

export interface StateActionKey {
  state: State;
  action: Action;
}

export interface QEntry {
  qValue: QValue;
  visits: number;
  confidence: ConfidenceScore;
  outcomes: OutcomeHistory;
  lastUpdated: Timestamp;
}

export interface OutcomeHistory {
  successes: number;
  failures: number;
  totalReward: number;
}

export interface StateActionReward {
  state: State;
  action: Action;
  reward: Reward;
  nextState: State;
}

// ============================================================================
// Feature Knowledge
// ============================================================================

export interface ParameterConstraints {
  min?: number;
  max?: number;
  changeLimit?: Percentage;
  cooldown?: Duration;
}

export interface SafeZone {
  min: number;
  max: number;
  changeLimit: Percentage;
  cooldown: Duration;
}

export interface ParameterDefinition {
  name: string;
  dataType: DataType;
  defaultValue?: string | number | boolean;
  constraints?: ParameterConstraints;
  safeZone?: SafeZone;
  description?: string;
  moClass?: string;
}

export interface CounterDefinition {
  name: string;
  category: CounterCategory;
  description?: string;
  unit?: string;
  aggregationType?: 'sum' | 'avg' | 'max' | 'min';
}

export interface KPIDefinition {
  name: string;
  formula?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  unit?: string;
  description?: string;
}

export interface ProcedureStep {
  order: number;
  description: string;
  command?: string;
  verification?: string;
}

export interface Procedure {
  name: string;
  description?: string;
  steps: ProcedureStep[];
  prerequisites?: string[];
}

export interface Feature {
  id: FeatureId;
  fajCode: FAJCode;
  name: string;
  description?: string;
  category: Category;
  accessTechnology: AccessTechnology;
  parameters: ParameterDefinition[];
  counters: CounterDefinition[];
  kpis: KPIDefinition[];
  procedures: Procedure[];
  dependencies: FeatureId[];
  conflicts: FeatureId[];
  relatedFeatures: FeatureId[];
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryMetadata {
  source: 'query' | 'response' | 'case' | 'pattern';
  outcome?: 'success' | 'failure' | 'partial';
  confidence?: ConfidenceScore;
  queryType?: QueryType;
  timestamp: Timestamp;
}

export interface Memory {
  id: string;
  content: string;
  embedding: Vector;
  metadata: MemoryMetadata;
  score?: number;  // Similarity score when returned from search
}

export interface VectorSearchResult {
  memory: Memory;
  distance: number;
  similarity: number;
}

// ============================================================================
// Agent Metrics
// ============================================================================

export interface AgentMetrics {
  totalQueries: number;
  successfulQueries: number;
  averageLatencyMs: number;
  averageConfidence: ConfidenceScore;
  consultationCount: number;
  learningIterations: number;
  memoryVectorCount: number;
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface RootCause {
  kpiName: string;
  counters: string[];
  parameters: string[];
  confidence: ConfidenceScore;
  explanation: string;
  recommendations: Recommendation[];
}

export interface Recommendation {
  parameter: string;
  currentValue: string | number;
  suggestedValue: string | number;
  expectedImpact: string;
  risk: RiskLevel;
}

export interface RollbackPoint {
  timestamp: Timestamp;
  parameters: Record<string, string | number>;
  reason?: string;
}
