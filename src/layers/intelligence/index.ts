/**
 * Intelligence Layer
 * Self-learning intelligence with Q-Learning, Trajectory Replay,
 * Federated Learning, Pattern Recognition, and SNN Anomaly Detection
 *
 * @module @elex/intelligence
 */

// Types
export type {
  // State-Action-Reward Framework
  QueryType,
  ComplexityLevel,
  Action,
  State,
  StateKey,
  StateActionKey,
  RewardSignal,
  ComputedReward,

  // Q-Table
  QValueEntry,
  QTableData,
  QLearningConfig,

  // Trajectory
  TrajectoryStep,
  Trajectory,
  TrajectoryBufferConfig,

  // Federated Learning
  MergeTrigger,
  PeerQTableInfo,
  MergeResult,
  FederatedConfig,

  // Pattern Recognition
  IntentClassification,
  ExtractedEntity,
  PatternMatch,
  PatternConfig,

  // SNN
  NeuronState,
  Synapse,
  STDPConfig,
  AnomalyResult,
  SNNConfig,

  // Events
  IntelligenceEvent,
  QTableUpdatedEvent,
  ActionSelectedEvent,
  FederatedMergeEvent,
  AnomalyDetectedEvent,
  PatternMatchedEvent,
  IntelligenceLayerEvent,
} from './types';

// Q-Learning Module
export {
  QTable,
  StateEncoder,
  stateEncoder,
  RewardCalculator,
  rewardCalculator,
  type QTableEventCallback,
  type StateEncoderConfig,
  type RewardCalculatorConfig,
} from './q-learning';

// Trajectory Module
export {
  TrajectoryBuffer,
  TrajectoryBuilder,
} from './trajectory';

// Federated Learning Module
export {
  FederatedMerger,
  SyncCoordinator,
  compressEntries,
  decompressEntries,
  type FederatedEventCallback,
  type SyncMessage,
  type SyncMessageType,
  type PeerConnection,
  type SyncCoordinatorConfig,
} from './federated';

// Pattern Recognition Module
export {
  HNSWIndex,
  PatternStore,
  IntentClassifier,
  intentClassifier,
  SimpleEmbedder,
  simpleEmbedder,
  embedState,
  embedContext,
  type Vector,
  type SearchResult,
  type HNSWConfig,
  type StoredPattern,
  type IntentClassifierConfig,
  type EmbedderConfig,
} from './patterns';

// SNN Module
export {
  SpikingNeuron,
  STDPSynapse,
  SNNAnomalyDetector,
  type LIFParams,
  type CounterSample,
  type SNNEventCallback,
} from './snn';

// Intelligence Service
export {
  IntelligenceService,
  createFeatureAgentIntelligence,
  type IntelligenceServiceConfig,
} from './intelligence-service';
