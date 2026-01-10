/**
 * @fileoverview Agent interfaces based on DDD domain model
 * @module @ruvector/edge/core/interfaces/agent
 *
 * @see docs/ddd/domain-model.md
 * @see ADR-004: One Agent Per Feature Specialization
 */

import type {
  AgentId,
  FAJCode,
  FeatureId,
  QueryId,
  QTableId,
  TrajectoryId
} from '../types/identifiers.js';

import type {
  AgentType,
  AgentStatus,
  Category,
  Action,
  QueryType,
  ComplexityLevel
} from '../types/enums.js';

import type {
  ConfidenceScore,
  HealthScore,
  Timestamp,
  Vector,
  DiscountFactor,
  LearningRate,
  QValue
} from '../types/primitives.js';

import type { IFeature } from './feature.js';
import type { IQuery, IResponse } from './query.js';

/**
 * Agent configuration for initialization
 */
export interface IAgentConfig {
  /** FAJ code this agent will master */
  fajCode: FAJCode;
  /** Agent type (LTE, NR, CrossRAT) */
  type: AgentType;
  /** Category for coordinator routing */
  category: Category;
  /** Q-learning parameters */
  qLearning: IQLearningConfig;
  /** Vector memory configuration */
  vectorMemory: IVectorMemoryConfig;
  /** Trajectory buffer size */
  trajectoryBufferSize: number;
}

/**
 * Q-Learning configuration
 * @see ADR-006: Q-Learning Engine
 */
export interface IQLearningConfig {
  /** Learning rate (alpha) - default 0.1 */
  alpha: LearningRate;
  /** Discount factor (gamma) - default 0.95 */
  gamma: DiscountFactor;
  /** Initial exploration rate (epsilon) */
  epsilon: number;
  /** Epsilon decay rate per episode */
  epsilonDecay: number;
  /** Minimum epsilon value */
  epsilonMin: number;
}

/**
 * Vector memory configuration
 * @see ADR-005: HNSW Vector Indexing
 */
export interface IVectorMemoryConfig {
  /** Maximum vectors per agent - default 10,000 */
  maxVectors: number;
  /** Embedding dimensions - default 128 */
  dimensions: number;
  /** HNSW M parameter (connections per layer) - default 16 */
  hnswM: number;
  /** HNSW efConstruction parameter - default 200 */
  hnswEfConstruction: number;
  /** HNSW efSearch parameter - default 50 */
  hnswEfSearch: number;
}

/**
 * Core Agent interface - Aggregate Root
 */
export interface IAgent {
  // Identity
  readonly id: AgentId;
  readonly fajCode: FAJCode;
  readonly type: AgentType;
  readonly category: Category;

  // State
  status: AgentStatus;
  health: HealthScore;
  confidence: ConfidenceScore;

  // Lifecycle
  initialize(config: IAgentConfig): Promise<void>;
  shutdown(): Promise<void>;

  // Query handling
  handleQuery(query: IQuery): Promise<IResponse>;
  recordFeedback(queryId: QueryId, feedback: IFeedback): void;

  // Peer consultation
  consultPeer(peerId: AgentId, query: IQuery): Promise<IResponse>;

  // Memory operations
  storeMemory(content: string, metadata: IMemoryMetadata): Promise<void>;
  searchMemory(query: string, k: number): Promise<IMemoryResult[]>;

  // Q-table operations
  getQTable(): IQTable;
  updateQValue(state: IState, action: Action, reward: number, nextState: IState): void;

  // Trajectory operations
  recordTrajectory(trajectory: ITrajectory): void;
  sampleTrajectories(k: number, prioritized: boolean): ITrajectory[];
}

/**
 * Q-Table interface for learned state-action values
 * @see ADR-006: Q-Learning Engine
 */
export interface IQTable {
  readonly id: QTableId;
  readonly agentId: AgentId;
  readonly gamma: DiscountFactor;
  readonly alpha: LearningRate;

  /** Lookup Q-value for state-action pair */
  lookup(state: IState, action: Action): QValue;

  /** Update Q-value using Bellman equation */
  update(state: IState, action: Action, reward: number, nextState: IState): void;

  /** Get best action for state */
  getBestAction(state: IState): Action;

  /** Get confidence for state-action pair */
  getConfidence(state: IState, action: Action): ConfidenceScore;

  /** Merge with peer Q-table (federated learning) */
  merge(peerQTable: IQTable): void;

  /** Get visit count for state-action pair */
  getVisits(state: IState, action: Action): number;

  /** Serialize for transmission */
  serialize(): Uint8Array;

  /** Deserialize from transmission */
  deserialize(data: Uint8Array): void;
}

/**
 * Q-Table entry
 */
export interface IQEntry {
  qValue: QValue;
  visits: number;
  confidence: ConfidenceScore;
  lastUpdated: Timestamp;
}

/**
 * State representation for Q-learning
 * @see ADR-006: Q-Learning Engine
 */
export interface IState {
  queryType: QueryType;
  complexity: ComplexityLevel;
  contextHash: string;
  confidence: ConfidenceScore;

  /** Encode state for Q-table key */
  encode(): string;

  /** Check equality with another state */
  equals(other: IState): boolean;
}

/**
 * State-Action-Reward tuple for trajectories
 */
export interface IStateActionReward {
  state: IState;
  action: Action;
  reward: number;
  nextState: IState;
  timestamp: Timestamp;
}

/**
 * Trajectory for experience replay
 */
export interface ITrajectory {
  readonly id: TrajectoryId;
  readonly agentId: AgentId;
  readonly steps: IStateActionReward[];
  readonly cumulativeReward: number;
  readonly startTime: Timestamp;
  readonly endTime: Timestamp;

  /** Iterate through steps */
  replay(): IterableIterator<IStateActionReward>;

  /** Sample a step with priority */
  sample(prioritized: boolean): IStateActionReward;

  /** Check if duplicate of another trajectory */
  isDuplicate(other: ITrajectory): boolean;
}

/**
 * Feedback from user or system
 */
export interface IFeedback {
  queryId: QueryId;
  rating: number; // [-1, +1]
  resolutionSuccess: boolean;
  comment?: string;
  timestamp: Timestamp;
}

/**
 * Memory metadata for vector storage
 */
export interface IMemoryMetadata {
  type: 'query' | 'response' | 'case' | 'feature';
  source: string;
  timestamp: Timestamp;
  tags?: string[];
}

/**
 * Memory search result
 */
export interface IMemoryResult {
  content: string;
  metadata: IMemoryMetadata;
  embedding: Vector;
  similarity: number;
}

/**
 * Reward signal components
 * @see ADR-006: Q-Learning Engine
 */
export interface IReward {
  userRating: number;       // [-1, +1]
  resolutionSuccess: number; // +0.5
  latencyPenalty: number;
  consultationCost: number;
  noveltyBonus: number;

  /** Calculate total reward */
  total(): number;
}
