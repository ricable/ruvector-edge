/**
 * Intelligence Layer Types
 * Core type definitions for Q-Learning, Trajectory, Federated Learning, and Pattern Recognition
 */

// ============================================================================
// State-Action-Reward Framework Types
// ============================================================================

/** Query types for state encoding */
export type QueryType =
  | 'parameter'
  | 'counter'
  | 'kpi'
  | 'procedure'
  | 'troubleshoot'
  | 'general';

/** Complexity levels for state encoding */
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

/** Available actions for Q-Learning */
export type Action =
  | 'direct_answer'
  | 'context_answer'
  | 'consult_peer'
  | 'request_clarification'
  | 'escalate';

/** State representation for Q-Learning */
export interface State {
  queryType: QueryType;
  complexity: ComplexityLevel;
  contextHash: string;
  confidence: number; // Discretized to 0.0, 0.25, 0.5, 0.75, 1.0
}

/** Encoded state key for Q-Table lookup */
export type StateKey = string;

/** State-Action pair key for Q-Table */
export type StateActionKey = string;

// ============================================================================
// Reward Types
// ============================================================================

/** Reward signal components */
export interface RewardSignal {
  userRating: number;           // [-1, +1] from explicit feedback
  resolutionSuccess: boolean;   // +0.5 for confirmed resolution
  latencyMs: number;            // For latency penalty calculation
  consultedPeers: number;       // For consultation cost
  isNovelQuery: boolean;        // For novelty bonus
}

/** Computed reward with breakdown */
export interface ComputedReward {
  total: number;
  breakdown: {
    userRating: number;
    resolutionBonus: number;
    latencyPenalty: number;
    consultationCost: number;
    noveltyBonus: number;
  };
}

// ============================================================================
// Q-Table Types
// ============================================================================

/** Q-Value entry with metadata */
export interface QValueEntry {
  value: number;
  visits: number;
  lastUpdated: number; // timestamp
}

/** Q-Table structure */
export interface QTableData {
  entries: Map<StateActionKey, QValueEntry>;
  version: number;
  agentId: string;
  createdAt: number;
  updatedAt: number;
}

/** Q-Learning hyperparameters */
export interface QLearningConfig {
  alpha: number;      // Learning rate (default: 0.1)
  gamma: number;      // Discount factor (default: 0.95)
  epsilon: number;    // Exploration rate (default: 0.1)
  initialQValue: number; // Initial Q-value for new entries
}

// ============================================================================
// Trajectory Types
// ============================================================================

/** Single step in a trajectory */
export interface TrajectoryStep {
  state: State;
  action: Action;
  reward: number;
  nextState: State | null;
  timestamp: number;
}

/** Complete trajectory (episode) */
export interface Trajectory {
  id: string;
  agentId: string;
  steps: TrajectoryStep[];
  cumulativeReward: number;
  startTime: number;
  endTime: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

/** Trajectory buffer configuration */
export interface TrajectoryBufferConfig {
  maxSize: number;                // Maximum entries (default: 1000)
  prioritizedSampling: boolean;   // Sample by cumulative reward
  deduplicationEnabled: boolean;  // Remove similar trajectories
  similarityThreshold: number;    // Threshold for deduplication
}

// ============================================================================
// Federated Learning Types
// ============================================================================

/** Merge trigger condition */
export interface MergeTrigger {
  timeBased: number;    // Seconds (default: 60)
  eventBased: number;   // Interactions (default: 10)
}

/** Peer Q-Table information for merging */
export interface PeerQTableInfo {
  agentId: string;
  version: number;
  entries: Map<StateActionKey, QValueEntry>;
  lastSync: number;
}

/** Merge result for a single state-action pair */
export interface MergeResult {
  stateActionKey: StateActionKey;
  localValue: number;
  peerValue: number;
  mergedValue: number;
  localVisits: number;
  peerVisits: number;
  totalVisits: number;
  confidence: number;
}

/** Federated learning configuration */
export interface FederatedConfig {
  mergeTrigger: MergeTrigger;
  significanceThreshold: number;  // Minimum difference to merge
  minConfidence: number;          // Minimum confidence for merge
  deltaCompression: boolean;      // Enable delta compression
}

// ============================================================================
// Pattern Recognition Types
// ============================================================================

/** Intent classification result */
export interface IntentClassification {
  intent: QueryType;
  confidence: number;
  alternativeIntents: Array<{ intent: QueryType; confidence: number }>;
}

/** Entity extraction result */
export interface ExtractedEntity {
  type: 'parameter' | 'counter' | 'kpi' | 'feature' | 'cell' | 'node' | 'alarm';
  value: string;
  confidence: number;
  position: { start: number; end: number };
}

/** Pattern match from HNSW search */
export interface PatternMatch {
  id: string;
  similarity: number;
  state: State;
  action: Action;
  outcome: 'success' | 'failure';
  context: string;
}

/** Pattern recognition configuration */
export interface PatternConfig {
  hnswM: number;                // HNSW M parameter (connections per node)
  hnswEfConstruction: number;   // Construction time/accuracy tradeoff
  hnswEfSearch: number;         // Search time/accuracy tradeoff
  maxPatterns: number;          // Maximum stored patterns
}

// ============================================================================
// SNN (Spiking Neural Network) Types
// ============================================================================

/** Neuron state in SNN */
export interface NeuronState {
  id: string;
  potential: number;           // Membrane potential
  threshold: number;           // Firing threshold
  lastSpikeTime: number;       // Time of last spike
  refractoryUntil: number;     // Refractory period end time
}

/** Synapse with STDP learning */
export interface Synapse {
  preNeuronId: string;
  postNeuronId: string;
  weight: number;
  lastUpdate: number;
}

/** STDP (Spike-Timing-Dependent Plasticity) parameters */
export interface STDPConfig {
  tauPlus: number;    // Time constant for potentiation (ms)
  tauMinus: number;   // Time constant for depression (ms)
  aPlus: number;      // Amplitude for potentiation
  aMinus: number;     // Amplitude for depression
  wMax: number;       // Maximum synaptic weight
  wMin: number;       // Minimum synaptic weight
}

/** Anomaly detection result */
export interface AnomalyResult {
  isAnomaly: boolean;
  confidence: number;
  pattern: string;
  timestamp: number;
  counterValues: Record<string, number>;
  expectedValues: Record<string, number>;
}

/** SNN configuration */
export interface SNNConfig {
  numNeurons: number;
  stdp: STDPConfig;
  timeStep: number;           // Simulation time step (ms)
  restPotential: number;      // Resting membrane potential
  spikeThreshold: number;     // Default spike threshold
  refractoryPeriod: number;   // Refractory period (ms)
}

// ============================================================================
// Event Types for Intelligence Layer
// ============================================================================

/** Base event interface */
export interface IntelligenceEvent {
  type: string;
  timestamp: number;
  agentId: string;
}

/** Q-Table updated event */
export interface QTableUpdatedEvent extends IntelligenceEvent {
  type: 'q_table_updated';
  stateActionKey: StateActionKey;
  oldValue: number;
  newValue: number;
  reward: number;
}

/** Action selected event */
export interface ActionSelectedEvent extends IntelligenceEvent {
  type: 'action_selected';
  state: State;
  action: Action;
  qValue: number;
  isExploration: boolean;
}

/** Federated merge event */
export interface FederatedMergeEvent extends IntelligenceEvent {
  type: 'federated_merge';
  peerId: string;
  mergedEntries: number;
  skippedEntries: number;
}

/** Anomaly detected event */
export interface AnomalyDetectedEvent extends IntelligenceEvent {
  type: 'anomaly_detected';
  anomaly: AnomalyResult;
}

/** Pattern matched event */
export interface PatternMatchedEvent extends IntelligenceEvent {
  type: 'pattern_matched';
  queryHash: string;
  matches: PatternMatch[];
  topMatchSimilarity: number;
}

export type IntelligenceLayerEvent =
  | QTableUpdatedEvent
  | ActionSelectedEvent
  | FederatedMergeEvent
  | AnomalyDetectedEvent
  | PatternMatchedEvent;
