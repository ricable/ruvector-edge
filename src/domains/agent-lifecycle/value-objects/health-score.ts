/**
 * HealthScore Value Object
 *
 * Agent health metric [0, 1] combining performance metrics.
 * Used for autonomous state transitions and degradation detection.
 */

/**
 * Health status categories
 */
export enum HealthStatus {
  CRITICAL = 'critical',    // 0.0 - 0.3
  WARNING = 'warning',      // 0.3 - 0.7
  HEALTHY = 'healthy'       // 0.7 - 1.0
}

/**
 * Invalid health score error
 */
export class InvalidHealthScoreError extends Error {
  constructor(value: number) {
    super(`Health score must be between 0 and 1, got: ${value}`);
    this.name = 'InvalidHealthScoreError';
  }
}

/**
 * Health metrics input
 */
export interface HealthMetrics {
  readonly cpuUsage: number;        // 0-100
  readonly memoryUsage: number;     // 0-100
  readonly errorRate: number;       // 0-1
  readonly latency: number;         // milliseconds
  readonly successRate?: number;    // 0-1
  readonly throughput?: number;     // requests per second
}

/**
 * HealthScore Value Object
 *
 * Immutable value object with bounded score [0, 1].
 */
export class HealthScore {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
    Object.freeze(this);
  }

  /**
   * Factory method to create HealthScore
   */
  static create(value: number): HealthScore {
    if (value < 0 || value > 1) {
      throw new InvalidHealthScoreError(value);
    }
    return new HealthScore(Math.round(value * 10000) / 10000);
  }

  /**
   * Create from health metrics
   *
   * Combines multiple metrics into a single health score:
   * - CPU usage (inverted): 40% weight
   * - Memory usage (inverted): 30% weight
   * - Error rate (inverted): 20% weight
   * - Latency (inverted): 10% weight
   */
  static fromMetrics(metrics: HealthMetrics): HealthScore {
    const cpuScore = 1 - Math.min(1, metrics.cpuUsage / 100);
    const memoryScore = 1 - Math.min(1, metrics.memoryUsage / 100);
    const errorScore = 1 - Math.min(1, metrics.errorRate);
    const latencyScore = 1 - Math.min(1, metrics.latency / 1000);

    const overall = cpuScore * 0.4 + memoryScore * 0.3 + errorScore * 0.2 + latencyScore * 0.1;
    return HealthScore.create(overall);
  }

  /**
   * Create minimum health (0)
   */
  static min(): HealthScore {
    return new HealthScore(0);
  }

  /**
   * Create maximum health (1)
   */
  static max(): HealthScore {
    return new HealthScore(1);
  }

  /**
   * Create from percentage (0-100)
   */
  static fromPercentage(percentage: number): HealthScore {
    return HealthScore.create(percentage / 100);
  }

  /**
   * Get the raw score value
   */
  get score(): number {
    return this.value;
  }

  /**
   * Get percentage value (0-100)
   */
  get percentage(): number {
    return Math.round(this.value * 100);
  }

  /**
   * Get health status category
   */
  get status(): HealthStatus {
    if (this.value < 0.3) return HealthStatus.CRITICAL;
    if (this.value < 0.7) return HealthStatus.WARNING;
    return HealthStatus.HEALTHY;
  }

  /**
   * Check if health is critical (< 0.3)
   */
  isCritical(): boolean {
    return this.value < 0.3;
  }

  /**
   * Check if health is warning (0.3 - 0.7)
   */
  isWarning(): boolean {
    return this.value >= 0.3 && this.value < 0.7;
  }

  /**
   * Check if health is healthy (>= 0.7)
   */
  isHealthy(): boolean {
    return this.value >= 0.7;
  }

  /**
   * Check if health is below threshold
   */
  isBelow(threshold: number): boolean {
    return this.value < threshold;
  }

  /**
   * Check if health is above threshold
   */
  isAbove(threshold: number): boolean {
    return this.value >= threshold;
  }

  /**
   * Increase health by amount, capped at 1
   */
  increase(amount: number): HealthScore {
    const newValue = Math.min(1, this.value + amount);
    return HealthScore.create(newValue);
  }

  /**
   * Decrease health by amount, floored at 0
   */
  decrease(amount: number): HealthScore {
    const newValue = Math.max(0, this.value - amount);
    return HealthScore.create(newValue);
  }

  /**
   * Value equality
   */
  equals(other: HealthScore): boolean {
    return this.value === other.value;
  }

  /**
   * Compare health scores
   */
  compare(other: HealthScore): number {
    return this.value - other.value;
  }

  /**
   * Check if greater than other
   */
  greaterThan(other: HealthScore): boolean {
    return this.value > other.value;
  }

  /**
   * Check if less than other
   */
  lessThan(other: HealthScore): boolean {
    return this.value < other.value;
  }

  /**
   * String representation
   */
  toString(): string {
    return `${this.percentage}%`;
  }

  /**
   * Detailed string representation
   */
  toDetailedString(): string {
    return `HealthScore(${this.percentage}%, ${this.status})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      score: this.value,
      percentage: this.percentage,
      status: this.status
    };
  }
}
