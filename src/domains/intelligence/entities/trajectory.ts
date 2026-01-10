/**
 * Trajectory Entity
 *
 * Records a sequence of state-action-reward transitions for experience replay.
 * Used in prioritized experience replay for improved learning.
 */

import { State } from '../value-objects/state';
import { Action } from '../value-objects/action';
import { Reward } from '../value-objects/reward';

export interface StateActionReward {
  readonly state: State;
  readonly action: Action;
  readonly reward: Reward;
  readonly nextState: State;
  readonly timestamp: Date;
}

export type SamplingPriority = 'uniform' | 'td_error' | 'reward';

export class Trajectory {
  readonly id: string;
  readonly agentId: string;
  private _steps: StateActionReward[];
  private _cumulativeReward: number;
  private _startTime: Date;
  private _endTime: Date | null;
  private _completed: boolean;

  constructor(
    id: string,
    agentId: string,
    startTime: Date = new Date()
  ) {
    this.id = id;
    this.agentId = agentId;
    this._steps = [];
    this._cumulativeReward = 0;
    this._startTime = startTime;
    this._endTime = null;
    this._completed = false;
  }

  /**
   * Add a step to the trajectory
   */
  addStep(step: StateActionReward): void {
    if (this._completed) {
      throw new Error('Cannot add steps to a completed trajectory');
    }
    this._steps.push(step);
    this._cumulativeReward += step.reward.total();
  }

  /**
   * Mark trajectory as completed
   */
  complete(): void {
    this._completed = true;
    this._endTime = new Date();
  }

  /**
   * Get iterator for replay
   */
  *replay(): Generator<StateActionReward> {
    for (const step of this._steps) {
      yield step;
    }
  }

  /**
   * Sample a step based on priority
   */
  sample(priority: SamplingPriority = 'uniform'): StateActionReward | undefined {
    if (this._steps.length === 0) {
      return undefined;
    }

    switch (priority) {
      case 'uniform':
        return this._steps[Math.floor(Math.random() * this._steps.length)];

      case 'td_error':
        // Higher TD error = higher priority (simplified)
        const byError = [...this._steps].sort((a, b) =>
          Math.abs(b.reward.total()) - Math.abs(a.reward.total())
        );
        const errorIdx = Math.floor(Math.random() * Math.min(10, byError.length));
        return byError[errorIdx];

      case 'reward':
        // Higher absolute reward = higher priority
        const byReward = [...this._steps].sort((a, b) =>
          Math.abs(b.reward.total()) - Math.abs(a.reward.total())
        );
        const rewardIdx = Math.floor(Math.random() * Math.min(10, byReward.length));
        return byReward[rewardIdx];

      default:
        return this._steps[Math.floor(Math.random() * this._steps.length)];
    }
  }

  /**
   * Sample multiple steps
   */
  sampleBatch(count: number, priority: SamplingPriority = 'uniform'): StateActionReward[] {
    const samples: StateActionReward[] = [];
    for (let i = 0; i < count && i < this._steps.length; i++) {
      const step = this.sample(priority);
      if (step) {
        samples.push(step);
      }
    }
    return samples;
  }

  /**
   * Check if this trajectory is similar to another (for deduplication)
   */
  isDuplicate(other: Trajectory, threshold: number = 0.8): boolean {
    if (this._steps.length !== other._steps.length) {
      return false;
    }

    let matches = 0;
    for (let i = 0; i < this._steps.length; i++) {
      if (
        this._steps[i].state.equals(other._steps[i].state) &&
        this._steps[i].action === other._steps[i].action
      ) {
        matches++;
      }
    }

    return matches / this._steps.length >= threshold;
  }

  /**
   * Get duration in milliseconds
   */
  get duration(): number {
    const endTime = this._endTime ?? new Date();
    return endTime.getTime() - this._startTime.getTime();
  }

  // Getters
  get steps(): ReadonlyArray<StateActionReward> { return this._steps; }
  get length(): number { return this._steps.length; }
  get cumulativeReward(): number { return this._cumulativeReward; }
  get startTime(): Date { return this._startTime; }
  get endTime(): Date | null { return this._endTime; }
  get completed(): boolean { return this._completed; }

  /**
   * Get average reward per step
   */
  get averageReward(): number {
    return this._steps.length > 0 ? this._cumulativeReward / this._steps.length : 0;
  }

  /**
   * Identity equality
   */
  equals(other: Trajectory): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `Trajectory(${this.id}, steps=${this._steps.length}, reward=${this._cumulativeReward.toFixed(3)})`;
  }

  toJSON(): object {
    return {
      id: this.id,
      agentId: this.agentId,
      length: this._steps.length,
      cumulativeReward: this._cumulativeReward,
      averageReward: this.averageReward,
      duration: this.duration,
      completed: this._completed,
      startTime: this._startTime.toISOString(),
      endTime: this._endTime?.toISOString()
    };
  }
}
