/**
 * TrajectoryBuffer Aggregate
 *
 * Ring buffer for storing trajectories with prioritized sampling.
 * Supports experience replay for improved learning.
 */

import { Trajectory, StateActionReward, SamplingPriority } from '../entities/trajectory';

export interface TrajectoryBufferConfig {
  readonly maxSize: number;          // Maximum trajectories (default: 1000)
  readonly deduplicationThreshold: number; // Similarity threshold (default: 0.8)
}

/**
 * TrajectoryBuffer Aggregate
 */
export class TrajectoryBuffer {
  readonly id: string;
  readonly agentId: string;
  private _trajectories: Trajectory[];
  private _maxSize: number;
  private _deduplicationThreshold: number;
  private _totalSampled: number;

  constructor(
    id: string,
    agentId: string,
    config: TrajectoryBufferConfig = { maxSize: 1000, deduplicationThreshold: 0.8 }
  ) {
    this.id = id;
    this.agentId = agentId;
    this._trajectories = [];
    this._maxSize = config.maxSize;
    this._deduplicationThreshold = config.deduplicationThreshold;
    this._totalSampled = 0;
  }

  /**
   * Add a trajectory to the buffer
   */
  add(trajectory: Trajectory): boolean {
    // Check for duplicates
    if (this.isDuplicate(trajectory)) {
      return false;
    }

    this._trajectories.push(trajectory);

    // Evict oldest if over capacity (ring buffer)
    while (this._trajectories.length > this._maxSize) {
      this._trajectories.shift();
    }

    return true;
  }

  /**
   * Sample trajectories for replay
   */
  sample(count: number = 1, priority: SamplingPriority = 'uniform'): Trajectory[] {
    if (this._trajectories.length === 0) {
      return [];
    }

    const samples: Trajectory[] = [];
    const indices = new Set<number>();

    while (samples.length < count && indices.size < this._trajectories.length) {
      let idx: number;

      switch (priority) {
        case 'td_error':
          // Prioritize by cumulative reward magnitude
          const sorted = [...this._trajectories]
            .map((t, i) => ({ t, i, priority: Math.abs(t.cumulativeReward) }))
            .sort((a, b) => b.priority - a.priority);
          const errorIdx = Math.floor(Math.random() * Math.min(count * 2, sorted.length));
          idx = sorted[errorIdx].i;
          break;

        case 'reward':
          // Prioritize high-reward trajectories
          const byReward = [...this._trajectories]
            .map((t, i) => ({ t, i, reward: t.cumulativeReward }))
            .sort((a, b) => b.reward - a.reward);
          const rewardIdx = Math.floor(Math.random() * Math.min(count * 2, byReward.length));
          idx = byReward[rewardIdx].i;
          break;

        default:
          // Uniform random sampling
          idx = Math.floor(Math.random() * this._trajectories.length);
      }

      if (!indices.has(idx)) {
        indices.add(idx);
        samples.push(this._trajectories[idx]);
        this._totalSampled++;
      }
    }

    return samples;
  }

  /**
   * Sample individual steps from all trajectories
   */
  sampleSteps(count: number, priority: SamplingPriority = 'uniform'): StateActionReward[] {
    const steps: StateActionReward[] = [];

    for (const trajectory of this._trajectories) {
      const sampled = trajectory.sampleBatch(Math.ceil(count / this._trajectories.length), priority);
      steps.push(...sampled);
    }

    // Shuffle and limit
    return steps
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  /**
   * Check if a trajectory is a duplicate
   */
  private isDuplicate(trajectory: Trajectory): boolean {
    for (const existing of this._trajectories) {
      if (existing.isDuplicate(trajectory, this._deduplicationThreshold)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get completed trajectories only
   */
  getCompleted(): Trajectory[] {
    return this._trajectories.filter(t => t.completed);
  }

  /**
   * Get trajectories with positive reward
   */
  getSuccessful(): Trajectory[] {
    return this._trajectories.filter(t => t.cumulativeReward > 0);
  }

  /**
   * Get trajectories with negative reward
   */
  getFailed(): Trajectory[] {
    return this._trajectories.filter(t => t.cumulativeReward < 0);
  }

  /**
   * Clear all trajectories
   */
  clear(): void {
    this._trajectories = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    count: number;
    totalSteps: number;
    avgReward: number;
    successRate: number;
    totalSampled: number;
  } {
    const totalSteps = this._trajectories.reduce((sum, t) => sum + t.length, 0);
    const avgReward = this._trajectories.length > 0
      ? this._trajectories.reduce((sum, t) => sum + t.cumulativeReward, 0) / this._trajectories.length
      : 0;
    const successRate = this._trajectories.length > 0
      ? this._trajectories.filter(t => t.cumulativeReward > 0).length / this._trajectories.length
      : 0;

    return {
      count: this._trajectories.length,
      totalSteps,
      avgReward,
      successRate,
      totalSampled: this._totalSampled
    };
  }

  // Getters
  get size(): number { return this._trajectories.length; }
  get maxSize(): number { return this._maxSize; }
  get isEmpty(): boolean { return this._trajectories.length === 0; }
  get isFull(): boolean { return this._trajectories.length >= this._maxSize; }

  /**
   * Identity equality
   */
  equals(other: TrajectoryBuffer): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const stats = this.getStats();
    return `TrajectoryBuffer(${this.id}, size=${stats.count}/${this._maxSize}, avgReward=${stats.avgReward.toFixed(3)})`;
  }
}
