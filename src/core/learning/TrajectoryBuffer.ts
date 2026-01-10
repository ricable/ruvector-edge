/**
 * ELEX Edge AI Agent Swarm - Trajectory Buffer
 *
 * Experience replay buffer for storing state-action-reward trajectories.
 * Supports prioritized sampling based on cumulative reward.
 */

import type {
  StateActionReward,
  TrajectoryId,
} from '../types/index.js';
import { createTrajectoryId, calculateTotalReward } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Trajectory Buffer configuration
 */
export interface TrajectoryBufferConfig {
  maxTrajectories?: number;   // Maximum trajectories to store (default: 1000)
  prioritizedSampling?: boolean; // Use prioritized sampling (default: true)
  deduplication?: boolean;    // Deduplicate similar trajectories (default: true)
  similarityThreshold?: number; // Similarity threshold for deduplication (default: 0.9)
}

/**
 * Single trajectory entry
 */
export interface Trajectory {
  id: TrajectoryId;
  steps: StateActionReward[];
  cumulativeReward: number;
  startTime: number;
  endTime?: number;
  completed: boolean;
}

/**
 * Sampling options
 */
export interface SamplingOptions {
  batchSize?: number;
  prioritized?: boolean;
  minReward?: number;
  maxAge?: number;
}

/**
 * Trajectory Buffer
 *
 * Ring buffer for storing trajectories with:
 * - Prioritized sampling by reward
 * - Deduplication of similar trajectories
 * - Batch sampling for training
 */
export class TrajectoryBuffer {
  private readonly config: Required<TrajectoryBufferConfig>;

  // Ring buffer storage
  private readonly trajectories: Trajectory[] = [];
  private writeIndex: number = 0;
  private count: number = 0;

  // Active trajectory being recorded
  private activeTrajectory: Trajectory | null = null;

  // Cumulative reward index for prioritized sampling
  private readonly rewardIndex: Array<{ id: TrajectoryId; reward: number }> = [];

  constructor(config: TrajectoryBufferConfig = {}) {
    this.config = {
      maxTrajectories: config.maxTrajectories ?? 1000,
      prioritizedSampling: config.prioritizedSampling ?? true,
      deduplication: config.deduplication ?? true,
      similarityThreshold: config.similarityThreshold ?? 0.9,
    };
  }

  /**
   * Start recording a new trajectory
   */
  startTrajectory(): TrajectoryId {
    const id = createTrajectoryId(uuidv4());

    this.activeTrajectory = {
      id,
      steps: [],
      cumulativeReward: 0,
      startTime: Date.now(),
      completed: false,
    };

    return id;
  }

  /**
   * Record a single step in the active trajectory
   */
  record(step: StateActionReward): void {
    // Auto-start trajectory if not active
    if (!this.activeTrajectory) {
      this.startTrajectory();
    }

    const totalReward = calculateTotalReward(step.reward);

    this.activeTrajectory!.steps.push(step);
    this.activeTrajectory!.cumulativeReward += totalReward;
  }

  /**
   * Complete the active trajectory and store it
   */
  completeTrajectory(): Trajectory | null {
    if (!this.activeTrajectory) {
      return null;
    }

    const trajectory = this.activeTrajectory;
    trajectory.endTime = Date.now();
    trajectory.completed = true;

    // Check for duplicates if deduplication is enabled
    if (this.config.deduplication) {
      const duplicate = this.findDuplicate(trajectory);
      if (duplicate) {
        // Update existing instead of adding new
        duplicate.cumulativeReward =
          (duplicate.cumulativeReward + trajectory.cumulativeReward) / 2;
        this.activeTrajectory = null;
        return duplicate;
      }
    }

    // Add to ring buffer
    this.addTrajectory(trajectory);

    this.activeTrajectory = null;
    return trajectory;
  }

  /**
   * Cancel active trajectory without storing
   */
  cancelTrajectory(): void {
    this.activeTrajectory = null;
  }

  /**
   * Sample trajectories for training
   */
  sample(options: SamplingOptions = {}): Trajectory[] {
    const {
      batchSize = 32,
      prioritized = this.config.prioritizedSampling,
      minReward,
      maxAge,
    } = options;

    if (this.count === 0) {
      return [];
    }

    // Filter trajectories
    let candidates = this.getCompletedTrajectories();

    // Apply filters
    if (minReward !== undefined) {
      candidates = candidates.filter(t => t.cumulativeReward >= minReward);
    }

    if (maxAge !== undefined) {
      const cutoff = Date.now() - maxAge;
      candidates = candidates.filter(t => t.startTime >= cutoff);
    }

    if (candidates.length === 0) {
      return [];
    }

    // Sample
    if (prioritized) {
      return this.prioritizedSample(candidates, batchSize);
    } else {
      return this.uniformSample(candidates, batchSize);
    }
  }

  /**
   * Sample individual steps from trajectories
   */
  sampleSteps(batchSize: number = 32): StateActionReward[] {
    const trajectories = this.sample({ batchSize: Math.ceil(batchSize / 5) });
    const steps: StateActionReward[] = [];

    for (const trajectory of trajectories) {
      for (const step of trajectory.steps) {
        steps.push(step);
        if (steps.length >= batchSize) {
          return steps;
        }
      }
    }

    return steps;
  }

  /**
   * Get a specific trajectory by ID
   */
  get(id: TrajectoryId): Trajectory | undefined {
    for (let i = 0; i < this.count; i++) {
      const index = (this.writeIndex - 1 - i + this.config.maxTrajectories) % this.config.maxTrajectories;
      if (this.trajectories[index]?.id === id) {
        return this.trajectories[index];
      }
    }
    return undefined;
  }

  /**
   * Get all completed trajectories
   */
  getCompletedTrajectories(): Trajectory[] {
    const result: Trajectory[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.writeIndex - 1 - i + this.config.maxTrajectories) % this.config.maxTrajectories;
      const trajectory = this.trajectories[index];
      if (trajectory?.completed) {
        result.push(trajectory);
      }
    }
    return result;
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    count: number;
    maxSize: number;
    averageReward: number;
    averageLength: number;
    totalSteps: number;
    successRate: number;
  } {
    const trajectories = this.getCompletedTrajectories();

    if (trajectories.length === 0) {
      return {
        count: 0,
        maxSize: this.config.maxTrajectories,
        averageReward: 0,
        averageLength: 0,
        totalSteps: 0,
        successRate: 0,
      };
    }

    let totalReward = 0;
    let totalLength = 0;
    let successCount = 0;

    for (const t of trajectories) {
      totalReward += t.cumulativeReward;
      totalLength += t.steps.length;
      if (t.cumulativeReward > 0) {
        successCount++;
      }
    }

    return {
      count: trajectories.length,
      maxSize: this.config.maxTrajectories,
      averageReward: totalReward / trajectories.length,
      averageLength: totalLength / trajectories.length,
      totalSteps: totalLength,
      successRate: successCount / trajectories.length,
    };
  }

  /**
   * Get top trajectories by reward
   */
  getTopTrajectories(k: number = 10): Trajectory[] {
    const trajectories = this.getCompletedTrajectories();
    trajectories.sort((a, b) => b.cumulativeReward - a.cumulativeReward);
    return trajectories.slice(0, k);
  }

  /**
   * Clear all trajectories
   */
  clear(): void {
    this.trajectories.length = 0;
    this.rewardIndex.length = 0;
    this.writeIndex = 0;
    this.count = 0;
    this.activeTrajectory = null;
  }

  /**
   * Export trajectories for persistence
   */
  export(): Trajectory[] {
    return this.getCompletedTrajectories();
  }

  /**
   * Import trajectories from persistence
   */
  import(trajectories: Trajectory[]): void {
    for (const trajectory of trajectories) {
      this.addTrajectory(trajectory);
    }
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Add trajectory to ring buffer
   */
  private addTrajectory(trajectory: Trajectory): void {
    // Overwrite if buffer is full
    if (this.count >= this.config.maxTrajectories) {
      // Remove old trajectory from reward index
      const oldTrajectory = this.trajectories[this.writeIndex];
      if (oldTrajectory) {
        const indexInReward = this.rewardIndex.findIndex(r => r.id === oldTrajectory.id);
        if (indexInReward !== -1) {
          this.rewardIndex.splice(indexInReward, 1);
        }
      }
    } else {
      this.count++;
    }

    // Add new trajectory
    this.trajectories[this.writeIndex] = trajectory;

    // Update reward index
    this.rewardIndex.push({ id: trajectory.id, reward: trajectory.cumulativeReward });
    this.rewardIndex.sort((a, b) => b.reward - a.reward);

    // Advance write index
    this.writeIndex = (this.writeIndex + 1) % this.config.maxTrajectories;
  }

  /**
   * Find duplicate trajectory based on similarity
   */
  private findDuplicate(trajectory: Trajectory): Trajectory | null {
    for (let i = 0; i < this.count; i++) {
      const index = (this.writeIndex - 1 - i + this.config.maxTrajectories) % this.config.maxTrajectories;
      const existing = this.trajectories[index];

      if (existing && this.isSimilar(trajectory, existing)) {
        return existing;
      }
    }
    return null;
  }

  /**
   * Check if two trajectories are similar
   */
  private isSimilar(a: Trajectory, b: Trajectory): boolean {
    // Quick length check
    if (Math.abs(a.steps.length - b.steps.length) > 2) {
      return false;
    }

    // Compare steps
    const minLength = Math.min(a.steps.length, b.steps.length);
    let matches = 0;

    for (let i = 0; i < minLength; i++) {
      if (this.stepsEqual(a.steps[i], b.steps[i])) {
        matches++;
      }
    }

    const similarity = matches / Math.max(a.steps.length, b.steps.length);
    return similarity >= this.config.similarityThreshold;
  }

  /**
   * Check if two steps are equal
   */
  private stepsEqual(a: StateActionReward, b: StateActionReward): boolean {
    return (
      a.action === b.action &&
      a.state.queryType === b.state.queryType &&
      a.state.complexity === b.state.complexity
    );
  }

  /**
   * Uniform random sampling
   */
  private uniformSample(candidates: Trajectory[], batchSize: number): Trajectory[] {
    const result: Trajectory[] = [];
    const indices = new Set<number>();

    while (result.length < batchSize && result.length < candidates.length) {
      const index = Math.floor(Math.random() * candidates.length);
      if (!indices.has(index)) {
        indices.add(index);
        result.push(candidates[index]);
      }
    }

    return result;
  }

  /**
   * Prioritized sampling by reward
   */
  private prioritizedSample(candidates: Trajectory[], batchSize: number): Trajectory[] {
    // Sort by reward
    const sorted = [...candidates].sort((a, b) => b.cumulativeReward - a.cumulativeReward);

    // Calculate priorities (softmax-like)
    const temperatures = sorted.map((t, i) => {
      // Higher priority for higher reward and more recent
      const rewardPriority = Math.max(t.cumulativeReward + 1, 0.1);
      const positionPriority = 1 / (i + 1);
      return rewardPriority * positionPriority;
    });

    const totalPriority = temperatures.reduce((a, b) => a + b, 0);
    const probabilities = temperatures.map(t => t / totalPriority);

    // Sample based on probabilities
    const result: Trajectory[] = [];
    const selected = new Set<number>();

    while (result.length < batchSize && result.length < candidates.length) {
      const rand = Math.random();
      let cumulative = 0;

      for (let i = 0; i < probabilities.length; i++) {
        cumulative += probabilities[i];
        if (rand <= cumulative && !selected.has(i)) {
          selected.add(i);
          result.push(sorted[i]);
          break;
        }
      }

      // Fallback for numerical precision issues
      if (result.length === selected.size - 1) {
        for (let i = 0; i < sorted.length; i++) {
          if (!selected.has(i)) {
            selected.add(i);
            result.push(sorted[i]);
            break;
          }
        }
      }
    }

    return result;
  }
}
