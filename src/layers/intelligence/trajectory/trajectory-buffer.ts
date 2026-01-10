/**
 * Trajectory Buffer
 * Ring buffer for storing and sampling learning trajectories
 */

import type {
  Trajectory,
  TrajectoryStep,
  TrajectoryBufferConfig,
  State,
  Action,
} from '../types';

const DEFAULT_CONFIG: TrajectoryBufferConfig = {
  maxSize: 1000,
  prioritizedSampling: true,
  deduplicationEnabled: true,
  similarityThreshold: 0.85,
};

/**
 * TrajectoryBuffer implements a ring buffer for experience replay
 * with prioritized sampling and deduplication
 */
export class TrajectoryBuffer {
  private readonly buffer: Trajectory[];
  private readonly config: TrajectoryBufferConfig;
  private writeIndex: number;
  private size: number;
  private totalAdded: number;

  constructor(config: Partial<TrajectoryBufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = new Array(this.config.maxSize);
    this.writeIndex = 0;
    this.size = 0;
    this.totalAdded = 0;
  }

  /**
   * Add a trajectory to the buffer
   */
  add(trajectory: Trajectory): boolean {
    // Check for duplicates if deduplication is enabled
    if (this.config.deduplicationEnabled) {
      const isDuplicate = this.checkDuplicate(trajectory);
      if (isDuplicate) {
        return false;
      }
    }

    // Add to ring buffer
    this.buffer[this.writeIndex] = trajectory;
    this.writeIndex = (this.writeIndex + 1) % this.config.maxSize;
    this.size = Math.min(this.size + 1, this.config.maxSize);
    this.totalAdded++;

    return true;
  }

  /**
   * Create and add a trajectory from steps
   */
  createAndAdd(
    agentId: string,
    steps: TrajectoryStep[],
    success: boolean,
    metadata?: Record<string, unknown>
  ): Trajectory {
    const cumulativeReward = steps.reduce((sum, step) => sum + step.reward, 0);
    const startTime = steps.length > 0 ? steps[0].timestamp : Date.now();
    const endTime = steps.length > 0 ? steps[steps.length - 1].timestamp : Date.now();

    const trajectory: Trajectory = {
      id: this.generateId(),
      agentId,
      steps,
      cumulativeReward,
      startTime,
      endTime,
      success,
      metadata,
    };

    this.add(trajectory);
    return trajectory;
  }

  /**
   * Sample trajectories using prioritized or uniform sampling
   */
  sample(count: number): Trajectory[] {
    if (this.size === 0) {
      return [];
    }

    const actualCount = Math.min(count, this.size);

    if (this.config.prioritizedSampling) {
      return this.prioritizedSample(actualCount);
    } else {
      return this.uniformSample(actualCount);
    }
  }

  /**
   * Uniform random sampling
   */
  private uniformSample(count: number): Trajectory[] {
    const indices = this.getValidIndices();
    const sampled: Trajectory[] = [];

    // Fisher-Yates shuffle for random selection
    for (let i = 0; i < count && i < indices.length; i++) {
      const j = i + Math.floor(Math.random() * (indices.length - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
      sampled.push(this.buffer[indices[i]]);
    }

    return sampled;
  }

  /**
   * Prioritized sampling based on cumulative reward
   * Higher reward trajectories are more likely to be sampled
   */
  private prioritizedSample(count: number): Trajectory[] {
    const validTrajectories = this.getValidTrajectories();
    if (validTrajectories.length === 0) {
      return [];
    }

    // Calculate priorities based on cumulative reward
    const minReward = Math.min(...validTrajectories.map(t => t.cumulativeReward));
    const maxReward = Math.max(...validTrajectories.map(t => t.cumulativeReward));
    const rewardRange = maxReward - minReward || 1;

    // Normalize rewards to [0, 1] and add small epsilon for uniform baseline
    const priorities = validTrajectories.map(t => {
      const normalized = (t.cumulativeReward - minReward) / rewardRange;
      return normalized + 0.1; // Epsilon for minimum sampling probability
    });

    // Calculate cumulative probabilities
    const totalPriority = priorities.reduce((sum, p) => sum + p, 0);
    const cumulative: number[] = [];
    let cumSum = 0;
    for (const p of priorities) {
      cumSum += p / totalPriority;
      cumulative.push(cumSum);
    }

    // Sample using cumulative distribution
    const sampled: Trajectory[] = [];
    const sampledIndices = new Set<number>();

    while (sampled.length < count && sampledIndices.size < validTrajectories.length) {
      const rand = Math.random();
      let idx = cumulative.findIndex(c => c >= rand);
      if (idx === -1) idx = cumulative.length - 1;

      if (!sampledIndices.has(idx)) {
        sampledIndices.add(idx);
        sampled.push(validTrajectories[idx]);
      }
    }

    return sampled;
  }

  /**
   * Get trajectories with highest cumulative reward
   */
  getTopTrajectories(count: number): Trajectory[] {
    const valid = this.getValidTrajectories();
    return valid
      .sort((a, b) => b.cumulativeReward - a.cumulativeReward)
      .slice(0, count);
  }

  /**
   * Get trajectories by success status
   */
  getBySuccess(success: boolean): Trajectory[] {
    return this.getValidTrajectories().filter(t => t.success === success);
  }

  /**
   * Get trajectories for a specific agent
   */
  getByAgentId(agentId: string): Trajectory[] {
    return this.getValidTrajectories().filter(t => t.agentId === agentId);
  }

  /**
   * Check if a trajectory is a duplicate
   */
  private checkDuplicate(trajectory: Trajectory): boolean {
    const validTrajectories = this.getValidTrajectories();

    for (const existing of validTrajectories) {
      const similarity = this.computeTrajectorySimilarity(trajectory, existing);
      if (similarity >= this.config.similarityThreshold) {
        // Keep the one with higher reward
        if (trajectory.cumulativeReward > existing.cumulativeReward) {
          // Replace existing with new
          const index = this.buffer.indexOf(existing);
          if (index !== -1) {
            this.buffer[index] = trajectory;
          }
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Compute similarity between two trajectories
   */
  private computeTrajectorySimilarity(t1: Trajectory, t2: Trajectory): number {
    // Different length trajectories are less similar
    if (t1.steps.length !== t2.steps.length) {
      const lengthRatio = Math.min(t1.steps.length, t2.steps.length) /
        Math.max(t1.steps.length, t2.steps.length);
      if (lengthRatio < 0.5) {
        return 0;
      }
    }

    // Compare states and actions
    let matchingSteps = 0;
    const minLength = Math.min(t1.steps.length, t2.steps.length);

    for (let i = 0; i < minLength; i++) {
      const step1 = t1.steps[i];
      const step2 = t2.steps[i];

      const stateMatch = this.computeStateSimilarity(step1.state, step2.state);
      const actionMatch = step1.action === step2.action ? 1 : 0;

      matchingSteps += (stateMatch + actionMatch) / 2;
    }

    return matchingSteps / Math.max(t1.steps.length, t2.steps.length);
  }

  /**
   * Compute similarity between two states
   */
  private computeStateSimilarity(s1: State, s2: State): number {
    let score = 0;

    if (s1.queryType === s2.queryType) score += 0.3;
    if (s1.complexity === s2.complexity) score += 0.2;
    if (s1.contextHash === s2.contextHash) score += 0.3;

    const confidenceDiff = Math.abs(s1.confidence - s2.confidence);
    score += 0.2 * (1 - confidenceDiff);

    return score;
  }

  /**
   * Get all valid (non-null) indices in buffer
   */
  private getValidIndices(): number[] {
    const indices: number[] = [];
    for (let i = 0; i < this.config.maxSize; i++) {
      if (this.buffer[i] !== undefined) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * Get all valid trajectories
   */
  private getValidTrajectories(): Trajectory[] {
    return this.buffer.filter(t => t !== undefined) as Trajectory[];
  }

  /**
   * Generate unique trajectory ID
   */
  private generateId(): string {
    return `traj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer.fill(undefined as unknown as Trajectory);
    this.writeIndex = 0;
    this.size = 0;
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    totalAdded: number;
    avgReward: number;
    successRate: number;
    avgTrajectoryLength: number;
  } {
    const valid = this.getValidTrajectories();
    const totalReward = valid.reduce((sum, t) => sum + t.cumulativeReward, 0);
    const successCount = valid.filter(t => t.success).length;
    const totalLength = valid.reduce((sum, t) => sum + t.steps.length, 0);

    return {
      size: this.size,
      maxSize: this.config.maxSize,
      totalAdded: this.totalAdded,
      avgReward: valid.length > 0 ? totalReward / valid.length : 0,
      successRate: valid.length > 0 ? successCount / valid.length : 0,
      avgTrajectoryLength: valid.length > 0 ? totalLength / valid.length : 0,
    };
  }

  /**
   * Export buffer for persistence
   */
  export(): Trajectory[] {
    return this.getValidTrajectories();
  }

  /**
   * Import trajectories
   */
  import(trajectories: Trajectory[]): void {
    for (const trajectory of trajectories) {
      this.add(trajectory);
    }
  }

  /**
   * Get current size
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.size >= this.config.maxSize;
  }
}

/**
 * TrajectoryBuilder - Helper for incrementally building trajectories
 */
export class TrajectoryBuilder {
  private readonly agentId: string;
  private steps: TrajectoryStep[];
  private startTime: number;
  private metadata: Record<string, unknown>;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.steps = [];
    this.startTime = Date.now();
    this.metadata = {};
  }

  /**
   * Add a step to the trajectory
   */
  addStep(state: State, action: Action, reward: number, nextState: State | null): this {
    this.steps.push({
      state,
      action,
      reward,
      nextState,
      timestamp: Date.now(),
    });
    return this;
  }

  /**
   * Set metadata
   */
  setMetadata(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Build the trajectory
   */
  build(success: boolean): Trajectory {
    const cumulativeReward = this.steps.reduce((sum, step) => sum + step.reward, 0);
    const endTime = this.steps.length > 0 ?
      this.steps[this.steps.length - 1].timestamp : Date.now();

    return {
      id: `traj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: this.agentId,
      steps: this.steps,
      cumulativeReward,
      startTime: this.startTime,
      endTime,
      success,
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : undefined,
    };
  }

  /**
   * Reset builder for reuse
   */
  reset(): this {
    this.steps = [];
    this.startTime = Date.now();
    this.metadata = {};
    return this;
  }

  /**
   * Get current step count
   */
  getStepCount(): number {
    return this.steps.length;
  }
}
