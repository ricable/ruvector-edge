/**
 * Q-Learning Update for Feedback Learning
 *
 * Handles Q-learning updates based on user feedback,
 * federated learning synchronization, and experience replay.
 *
 * @module workflow/q-learning-update
 */

import { QTable } from '../../intelligence/aggregates/q-table';
import { TrajectoryBuffer } from '../../intelligence/aggregates/trajectory-buffer';
import { State, Action, Reward } from '../../intelligence/value-objects';
import { Trajectory } from '../../intelligence/entities/trajectory';

/**
 * Q-Learning Update Configuration
 */
export interface QLearningUpdateConfig {
  qTable: QTable;
  trajectoryBuffer: TrajectoryBuffer;
  federatedLearning?: boolean; // Default: true
  syncInterval?: number; // Default: 60000ms (60s)
}

/**
 * Interaction Record
 */
export interface InteractionRecord {
  state: State;
  action: Action;
  question: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Feedback Data
 */
export interface FeedbackData {
  rating: number; // -1 to 1
  resolved?: boolean;
  comment?: string;
}

/**
 * Q-Learning Update
 *
 * Manages Q-learning updates, experience replay, and federated synchronization
 */
export class QLearningUpdate {
  private config: QLearningUpdateConfig;
  private pendingUpdates: Map<string, InteractionRecord>;
  private lastSync: number;

  // Statistics
  private stats = {
    totalInteractions: 0,
    totalUpdates: 0,
    totalFeedback: 0,
    federatedSyncs: 0,
    avgReward: 0,
  };

  constructor(config: QLearningUpdateConfig) {
    this.config = config;
    this.pendingUpdates = new Map();
    this.lastSync = Date.now();

    // Start federated sync interval if enabled
    if (this.config.federatedLearning) {
      this.startFederatedSync();
    }
  }

  /**
   * Record an interaction for learning
   */
  async recordInteraction(record: InteractionRecord): Promise<void> {
    const key = `${record.state.toKey()}::${record.action}`;
    this.pendingUpdates.set(key, record);
    this.stats.totalInteractions++;

    // Note: QTable initializes Q-values to 0 on first access via lookup
    // We don't need to explicitly initialize here

    // Create a trajectory for this interaction
    const trajectory = new Trajectory(
      `trajectory-${Date.now()}`,
      'qa-workflow',
      record.timestamp
    );

    // Add the step to trajectory
    trajectory.addStep({
      state: record.state,
      action: record.action,
      reward: Reward.zero(), // Will be updated when feedback received
      nextState: record.state, // Terminal episode
      timestamp: record.timestamp
    });

    // Mark as completed
    trajectory.complete();

    // Add to buffer (will be deduplicated if similar exists)
    this.config.trajectoryBuffer.add(trajectory);
  }

  /**
   * Update with feedback
   *
   * Uses the QTable's built-in update method which handles the Q-learning formula:
   * Q(s,a) <- Q(s,a) + α[r + γ * max(Q(s',a')) - Q(s,a)]
   */
  async updateWithFeedback(data: {
    state: State;
    action: Action;
    reward: Reward;
    feedback: FeedbackData;
    question: string;
    timestamp: Date;
  }): Promise<void> {
    this.stats.totalFeedback++;

    // Get current Q-value before update
    const currentQ = this.config.qTable.lookup(data.state, data.action);

    // Use QTable's built-in update method (handles Q-learning formula internally)
    this.config.qTable.update(
      data.state,
      data.action,
      data.reward,
      data.state // Use same state as next state for terminal episodes
    );

    // Get updated Q-value
    const newQ = this.config.qTable.lookup(data.state, data.action);

    // Update statistics
    this.stats.totalUpdates++;
    this.stats.avgReward = 0.95 * this.stats.avgReward + 0.05 * data.reward.total();

    // Remove from pending
    const key = `${data.state.toKey()}::${data.action}`;
    this.pendingUpdates.delete(key);

    // Trigger federated sync if threshold reached
    if (this.config.federatedLearning && this.stats.totalFeedback % 10 === 0) {
      await this.triggerFederatedSync();
    }

    console.log(`Q-Learning Update: ${data.state.toKey()}::${data.action} | Q: ${currentQ.toFixed(3)} -> ${newQ.toFixed(3)} | Reward: ${data.reward.total().toFixed(3)}`);
  }

  /**
   * Trigger federated learning sync
   *
   * Synchronizes Q-table with peer agents using gossip protocol
   */
  async triggerFederatedSync(): Promise<void> {
    if (!this.config.federatedLearning) {
      return;
    }

    const now = Date.now();
    const timeSinceLastSync = now - this.lastSync;

    // Rate limiting: minimum 30 seconds between syncs
    if (timeSinceLastSync < 30000) {
      return;
    }

    this.stats.federatedSyncs++;
    this.lastSync = now;

    try {
      // In a real implementation, this would sync with peer agents
      // For now, we'll simulate the sync
      const entryCount = this.config.qTable.entryCount;

      console.log(`Federated Sync: ${entryCount} entries synced`);

      // Simulate peer sync (in production, use actual gossip protocol)
      await this.simulatePeerSync();
    } catch (error) {
      console.error('Federated sync error:', error);
    }
  }

  /**
   * Experience replay
   *
   * Replays past experiences to reinforce learning
   */
  async experienceReplay(batchSize: number = 32): Promise<void> {
    const trajectories = this.config.trajectoryBuffer.sample(batchSize, 'td_error');

    for (const trajectory of trajectories) {
      for (const step of trajectory.steps) {
        // Use QTable's built-in update method
        this.config.qTable.update(
          step.state,
          step.action,
          step.reward,
          step.nextState
        );
      }
    }

    console.log(`Experience Replay: ${trajectories.length} trajectories replayed`);
  }

  /**
   * Get Q-learning statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      avgReward: this.stats.avgReward.toFixed(3),
      qTableSize: this.config.qTable.entryCount,
      trajectorySize: this.config.trajectoryBuffer.size,
      pendingUpdates: this.pendingUpdates.size,
      federatedLearningEnabled: this.config.federatedLearning ?? true,
      lastSync: new Date(this.lastSync).toISOString(),
    };
  }

  /**
   * Export Q-table for persistence or analysis
   */
  exportQTable(): Record<string, number> {
    const result: Record<string, number> = {};

    for (const { key, entry } of this.config.qTable.entries) {
      result[key] = entry.qValue;
    }

    return result;
  }

  /**
   * Import Q-table (for federated learning or restoration)
   */
  importQTable(data: Record<string, number>): void {
    for (const [keyStr, value] of Object.entries(data)) {
      const [stateKey, actionStr] = keyStr.split('::');
      const state = State.create(stateKey);
      const action = actionStr as Action;

      // Create a reward to update the Q-value
      // This is a simplified import - in production would merge properly
      this.config.qTable.update(
        state,
        action,
        Reward.fromComponents({
          userRating: value,
          resolutionSuccess: 0,
          latencyPenalty: 0,
          consultationCost: 0,
          noveltyBonus: 0
        }),
        state
      );
    }
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    // Final federated sync
    if (this.config.federatedLearning) {
      await this.triggerFederatedSync();
    }

    // Clear pending updates
    this.pendingUpdates.clear();

    console.log('QLearningUpdate shutdown complete');
  }

  // Private methods

  private startFederatedSync(): void {
    const syncInterval = this.config.syncInterval ?? 60000;

    setInterval(async () => {
      await this.triggerFederatedSync();
    }, syncInterval);
  }

  private async simulatePeerSync(): Promise<void> {
    // Simulate federated learning with peer agents
    // In production, this would use actual gossip protocol

    // For now, just log that we would sync
    // Real implementation would use QTable.merge() with peer Q-tables
    console.log('Peer Sync: Simulated federated sync completed');
  }
}

export type {
  QLearningUpdateConfig,
  InteractionRecord,
  FeedbackData,
};
