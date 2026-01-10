/**
 * Intelligence Service
 * Unified service integrating Q-Learning, Trajectory, Federated Learning,
 * Pattern Recognition, and SNN Anomaly Detection
 */

import type {
  State,
  Action,
  RewardSignal,
  ComputedReward,
  Trajectory,
  PeerQTableInfo,
  PatternMatch,
  IntentClassification,
  ExtractedEntity,
  AnomalyResult,
  IntelligenceLayerEvent,
} from './types';

import { QTable } from './q-learning/q-table';
import { StateEncoder } from './q-learning/state-encoder';
import { RewardCalculator } from './q-learning/reward-calculator';
import { TrajectoryBuffer, TrajectoryBuilder } from './trajectory/trajectory-buffer';
import { FederatedMerger } from './federated/federated-merger';
import { SyncCoordinator } from './federated/sync-coordinator';
import { PatternStore } from './patterns/pattern-store';
import { IntentClassifier } from './patterns/intent-classifier';
import { SimpleEmbedder } from './patterns/embedder';
import { SNNAnomalyDetector, type CounterSample } from './snn/snn-anomaly-detector';

/** Intelligence service configuration */
export interface IntelligenceServiceConfig {
  agentId: string;
  qLearning: {
    alpha: number;
    gamma: number;
    epsilon: number;
  };
  trajectory: {
    maxSize: number;
    prioritizedSampling: boolean;
  };
  federated: {
    enabled: boolean;
    syncIntervalMs: number;
    minConfidence: number;
  };
  patterns: {
    dimension: number;
    maxPatterns: number;
  };
  snn: {
    enabled: boolean;
    numNeurons: number;
  };
}

const DEFAULT_CONFIG: IntelligenceServiceConfig = {
  agentId: 'default-agent',
  qLearning: {
    alpha: 0.1,
    gamma: 0.95,
    epsilon: 0.1,
  },
  trajectory: {
    maxSize: 1000,
    prioritizedSampling: true,
  },
  federated: {
    enabled: true,
    syncIntervalMs: 60000,
    minConfidence: 0.5,
  },
  patterns: {
    dimension: 128,
    maxPatterns: 10000,
  },
  snn: {
    enabled: true,
    numNeurons: 64,
  },
};

/**
 * IntelligenceService provides a unified interface to all intelligence components
 */
export class IntelligenceService {
  private readonly config: IntelligenceServiceConfig;

  // Core components
  readonly qTable: QTable;
  readonly stateEncoder: StateEncoder;
  readonly rewardCalculator: RewardCalculator;
  readonly trajectoryBuffer: TrajectoryBuffer;
  readonly federatedMerger: FederatedMerger;
  readonly syncCoordinator: SyncCoordinator;
  readonly patternStore: PatternStore;
  readonly intentClassifier: IntentClassifier;
  readonly embedder: SimpleEmbedder;
  readonly snnDetector: SNNAnomalyDetector | null;

  // Active trajectory tracking
  private activeTrajectory: TrajectoryBuilder | null;
  private eventListeners: Array<(event: IntelligenceLayerEvent) => void>;

  constructor(config: Partial<IntelligenceServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventListeners = [];

    // Initialize components
    this.stateEncoder = new StateEncoder();
    this.rewardCalculator = new RewardCalculator();

    this.qTable = new QTable(
      this.config.agentId,
      this.config.qLearning,
      this.stateEncoder
    );

    this.trajectoryBuffer = new TrajectoryBuffer({
      maxSize: this.config.trajectory.maxSize,
      prioritizedSampling: this.config.trajectory.prioritizedSampling,
    });

    this.federatedMerger = new FederatedMerger(this.config.agentId, {
      minConfidence: this.config.federated.minConfidence,
    });

    this.syncCoordinator = new SyncCoordinator(
      this.config.agentId,
      this.qTable,
      this.federatedMerger,
      { announceIntervalMs: this.config.federated.syncIntervalMs }
    );

    this.embedder = new SimpleEmbedder({
      dimension: this.config.patterns.dimension,
    });

    this.patternStore = new PatternStore(
      this.config.patterns.dimension,
      { maxPatterns: this.config.patterns.maxPatterns }
    );

    this.intentClassifier = new IntentClassifier();

    this.snnDetector = this.config.snn.enabled
      ? new SNNAnomalyDetector(this.config.agentId, {
          numNeurons: this.config.snn.numNeurons,
        })
      : null;

    this.activeTrajectory = null;

    // Wire up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Process a query and select an action
   */
  processQuery(
    query: string,
    context: string = '',
    forceExplore: boolean = false
  ): {
    state: State;
    action: Action;
    isExploration: boolean;
    intent: IntentClassification;
    entities: ExtractedEntity[];
    similarPatterns: PatternMatch[];
  } {
    // Classify intent and extract entities
    const { classification: intent, entities } = this.intentClassifier.analyze(query);

    // Estimate complexity
    const complexity = this.intentClassifier.estimateComplexity(query, entities);

    // Calculate confidence based on intent classification
    const confidence = intent.confidence;

    // Create state
    const state = this.stateEncoder.createState(
      intent.intent,
      complexity,
      context || query,
      confidence
    );

    // Search for similar patterns
    const queryEmbedding = this.embedder.embed(query + ' ' + context);
    const similarPatterns = this.patternStore.searchSuccessful(queryEmbedding, 3);

    // Select action using Q-Learning
    const { action, isExploration } = this.qTable.selectAction(state, forceExplore);

    // Start trajectory if not already active
    if (!this.activeTrajectory) {
      this.startTrajectory();
    }

    return {
      state,
      action,
      isExploration,
      intent,
      entities,
      similarPatterns,
    };
  }

  /**
   * Record feedback and update learning
   */
  recordFeedback(
    state: State,
    action: Action,
    signal: RewardSignal,
    nextState: State | null = null,
    _success: boolean = true
  ): ComputedReward {
    // Calculate reward
    const reward = this.rewardCalculator.calculate(signal, action);

    // Update Q-Table
    this.qTable.update(state, action, reward.total, nextState);

    // Add to trajectory
    if (this.activeTrajectory) {
      this.activeTrajectory.addStep(state, action, reward.total, nextState);
    }

    // Record interaction for federated sync
    this.federatedMerger.recordInteraction();

    // Check if sync needed
    if (this.config.federated.enabled && this.federatedMerger.shouldSync()) {
      this.syncCoordinator.announceVersion();
    }

    return reward;
  }

  /**
   * Store a successful pattern
   */
  storePattern(
    state: State,
    action: Action,
    context: string,
    success: boolean
  ): string {
    const embedding = this.embedder.embed(
      `${state.queryType} ${state.complexity} ${context}`
    );

    return this.patternStore.store(
      state,
      action,
      success ? 'success' : 'failure',
      context,
      embedding
    );
  }

  /**
   * Start a new trajectory
   */
  startTrajectory(): void {
    this.activeTrajectory = new TrajectoryBuilder(this.config.agentId);
  }

  /**
   * End current trajectory and add to buffer
   */
  endTrajectory(success: boolean): Trajectory | null {
    if (!this.activeTrajectory) {
      return null;
    }

    const trajectory = this.activeTrajectory.build(success);
    this.trajectoryBuffer.add(trajectory);
    this.activeTrajectory = null;

    return trajectory;
  }

  /**
   * Sample trajectories for experience replay
   */
  sampleTrajectories(count: number): Trajectory[] {
    return this.trajectoryBuffer.sample(count);
  }

  /**
   * Replay trajectories for learning
   */
  replayTrajectories(count: number = 10): void {
    const trajectories = this.sampleTrajectories(count);

    for (const trajectory of trajectories) {
      this.qTable.updateFromTrajectory(trajectory.steps);
    }
  }

  /**
   * Merge with peer Q-Table
   */
  mergeWithPeer(peerInfo: PeerQTableInfo): number {
    const results = this.federatedMerger.merge(this.qTable, peerInfo);
    return results.length;
  }

  /**
   * Process counter samples for anomaly detection
   */
  detectAnomalies(samples: CounterSample[]): AnomalyResult | null {
    if (!this.snnDetector) {
      return null;
    }

    return this.snnDetector.process(samples);
  }

  /**
   * Train SNN on labeled anomaly data
   */
  trainAnomalyDetector(
    samples: CounterSample[],
    isAnomaly: boolean
  ): void {
    if (this.snnDetector) {
      this.snnDetector.train(samples, isAnomaly);
    }
  }

  /**
   * Start federated sync
   */
  startSync(): void {
    if (this.config.federated.enabled) {
      this.syncCoordinator.start();
    }
  }

  /**
   * Stop federated sync
   */
  stopSync(): void {
    this.syncCoordinator.stop();
  }

  /**
   * Set exploration enabled/disabled
   */
  setExplorationEnabled(enabled: boolean): void {
    this.qTable.setExplorationEnabled(enabled);
  }

  /**
   * Decay exploration rate
   */
  decayExploration(rate: number = 0.995, min: number = 0.01): void {
    this.qTable.decayEpsilon(rate, min);
  }

  /**
   * Add event listener
   */
  addEventListener(callback: (event: IntelligenceLayerEvent) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: (event: IntelligenceLayerEvent) => void): void {
    const index = this.eventListeners.indexOf(callback);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private setupEventForwarding(): void {
    // Forward Q-Table events
    this.qTable.addEventListener((event) => {
      this.emitEvent(event);
    });

    // Forward federated events
    this.federatedMerger.addEventListener((event) => {
      this.emitEvent(event);
    });

    // Forward SNN events
    if (this.snnDetector) {
      this.snnDetector.addEventListener((event) => {
        this.emitEvent(event);
      });
    }
  }

  private emitEvent(event: IntelligenceLayerEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in intelligence service event listener:', error);
      }
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    qTable: ReturnType<QTable['getStats']>;
    trajectory: ReturnType<TrajectoryBuffer['getStats']>;
    federated: ReturnType<FederatedMerger['getStats']>;
    patterns: ReturnType<PatternStore['getStats']>;
    snn: ReturnType<SNNAnomalyDetector['getStats']> | null;
  } {
    return {
      qTable: this.qTable.getStats(),
      trajectory: this.trajectoryBuffer.getStats(),
      federated: this.federatedMerger.getStats(),
      patterns: this.patternStore.getStats(),
      snn: this.snnDetector?.getStats() ?? null,
    };
  }

  /**
   * Export all state for persistence
   */
  export(): {
    qTable: ReturnType<QTable['toData']>;
    trajectories: Trajectory[];
    patterns: ReturnType<PatternStore['export']>;
  } {
    return {
      qTable: this.qTable.toData(),
      trajectories: this.trajectoryBuffer.export(),
      patterns: this.patternStore.export(),
    };
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.config.agentId;
  }
}

/**
 * Create a pre-configured intelligence service for a feature agent
 */
export function createFeatureAgentIntelligence(
  agentId: string,
  _featureCode?: string
): IntelligenceService {
  return new IntelligenceService({
    agentId,
    qLearning: {
      alpha: 0.1,
      gamma: 0.95,
      epsilon: 0.15, // Slightly higher exploration for feature agents
    },
    trajectory: {
      maxSize: 500, // Smaller buffer for individual agents
      prioritizedSampling: true,
    },
    federated: {
      enabled: true,
      syncIntervalMs: 60000,
      minConfidence: 0.5,
    },
    patterns: {
      dimension: 128,
      maxPatterns: 5000, // Smaller pattern store per agent
    },
    snn: {
      enabled: true,
      numNeurons: 32, // Smaller network per agent
    },
  });
}
