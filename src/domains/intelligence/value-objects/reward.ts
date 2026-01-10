/**
 * Reward Value Object
 *
 * Reward signal for Q-learning that reinforces agent behavior.
 * Total reward is computed from multiple components.
 */

export interface RewardComponents {
  readonly userRating: number;        // [-1, +1] User satisfaction
  readonly resolutionSuccess: number; // +0.5 if problem was resolved
  readonly latencyPenalty: number;    // Negative value based on response time
  readonly consultationCost: number;  // Cost for consulting peers
  readonly noveltyBonus: number;      // Bonus for learning new patterns
}

export class Reward {
  constructor(
    public readonly userRating: number,
    public readonly resolutionSuccess: number,
    public readonly latencyPenalty: number,
    public readonly consultationCost: number,
    public readonly noveltyBonus: number
  ) {
    Object.freeze(this);
  }

  /**
   * Create reward from components object
   */
  static fromComponents(components: RewardComponents): Reward {
    return new Reward(
      components.userRating,
      components.resolutionSuccess,
      components.latencyPenalty,
      components.consultationCost,
      components.noveltyBonus
    );
  }

  /**
   * Create default zero reward
   */
  static zero(): Reward {
    return new Reward(0, 0, 0, 0, 0);
  }

  /**
   * Create positive reward for successful resolution
   */
  static success(userRating: number = 1.0): Reward {
    return new Reward(userRating, 0.5, 0, 0, 0);
  }

  /**
   * Create negative reward for failure
   */
  static failure(userRating: number = -1.0): Reward {
    return new Reward(userRating, 0, 0, 0, 0);
  }

  /**
   * Calculate latency penalty based on response time
   */
  static calculateLatencyPenalty(latencyMs: number, targetMs: number = 500): number {
    if (latencyMs <= targetMs) {
      return 0;
    }
    // Linear penalty for exceeding target
    return -Math.min(0.5, (latencyMs - targetMs) / 10000);
  }

  /**
   * Calculate consultation cost
   */
  static calculateConsultationCost(peerCount: number): number {
    return -0.1 * peerCount;
  }

  /**
   * Calculate total reward
   */
  total(): number {
    return (
      this.userRating +
      this.resolutionSuccess +
      this.latencyPenalty +
      this.consultationCost +
      this.noveltyBonus
    );
  }

  /**
   * Get individual components
   */
  get components(): RewardComponents {
    return {
      userRating: this.userRating,
      resolutionSuccess: this.resolutionSuccess,
      latencyPenalty: this.latencyPenalty,
      consultationCost: this.consultationCost,
      noveltyBonus: this.noveltyBonus
    };
  }

  /**
   * Check if overall reward is positive
   */
  isPositive(): boolean {
    return this.total() > 0;
  }

  /**
   * Check if overall reward is negative
   */
  isNegative(): boolean {
    return this.total() < 0;
  }

  /**
   * Value equality
   */
  equals(other: Reward): boolean {
    return (
      this.userRating === other.userRating &&
      this.resolutionSuccess === other.resolutionSuccess &&
      this.latencyPenalty === other.latencyPenalty &&
      this.consultationCost === other.consultationCost &&
      this.noveltyBonus === other.noveltyBonus
    );
  }

  /**
   * Add two rewards together
   */
  add(other: Reward): Reward {
    return new Reward(
      this.userRating + other.userRating,
      this.resolutionSuccess + other.resolutionSuccess,
      this.latencyPenalty + other.latencyPenalty,
      this.consultationCost + other.consultationCost,
      this.noveltyBonus + other.noveltyBonus
    );
  }

  /**
   * Scale reward by factor
   */
  scale(factor: number): Reward {
    return new Reward(
      this.userRating * factor,
      this.resolutionSuccess * factor,
      this.latencyPenalty * factor,
      this.consultationCost * factor,
      this.noveltyBonus * factor
    );
  }

  toString(): string {
    return `Reward(total=${this.total().toFixed(3)})`;
  }

  toJSON(): object {
    return {
      userRating: this.userRating,
      resolutionSuccess: this.resolutionSuccess,
      latencyPenalty: this.latencyPenalty,
      consultationCost: this.consultationCost,
      noveltyBonus: this.noveltyBonus,
      total: this.total()
    };
  }
}
