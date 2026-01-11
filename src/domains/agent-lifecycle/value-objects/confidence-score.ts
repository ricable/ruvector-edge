/**
 * ConfidenceScore Value Object
 *
 * Bounded confidence score [0, 1] with validation and operations.
 * Represents the agent's confidence in its knowledge and decision-making.
 */

/**
 * Confidence level categories
 */
export enum ConfidenceLevel {
  VERY_LOW = 'very_low',    // 0.0 - 0.2
  LOW = 'low',              // 0.2 - 0.5
  MEDIUM = 'medium',        // 0.5 - 0.7
  HIGH = 'high',            // 0.7 - 0.9
  VERY_HIGH = 'very_high'   // 0.9 - 1.0
}

/**
 * Invalid confidence score error
 */
export class InvalidConfidenceScoreError extends Error {
  constructor(value: number) {
    super(`Confidence score must be between 0 and 1, got: ${value}`);
    this.name = 'InvalidConfidenceScoreError';
  }
}

/**
 * ConfidenceScore Value Object
 *
 * Immutable value object with bounded score [0, 1].
 */
export class ConfidenceScore {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
    Object.freeze(this);
  }

  /**
   * Factory method to create ConfidenceScore
   */
  static create(value: number): ConfidenceScore {
    if (value < 0 || value > 1) {
      throw new InvalidConfidenceScoreError(value);
    }
    return new ConfidenceScore(Math.round(value * 10000) / 10000); // Round to 4 decimal places
  }

  /**
   * Create minimum confidence (0)
   */
  static min(): ConfidenceScore {
    return new ConfidenceScore(0);
  }

  /**
   * Create maximum confidence (1)
   */
  static max(): ConfidenceScore {
    return new ConfidenceScore(1);
  }

  /**
   * Create from percentage (0-100)
   */
  static fromPercentage(percentage: number): ConfidenceScore {
    return ConfidenceScore.create(percentage / 100);
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
   * Get confidence level category
   */
  get level(): ConfidenceLevel {
    if (this.value < 0.2) return ConfidenceLevel.VERY_LOW;
    if (this.value < 0.5) return ConfidenceLevel.LOW;
    if (this.value < 0.7) return ConfidenceLevel.MEDIUM;
    if (this.value < 0.9) return ConfidenceLevel.HIGH;
    return ConfidenceLevel.VERY_HIGH;
  }

  /**
   * Check if confidence is very low (< 0.2)
   */
  isVeryLow(): boolean {
    return this.value < 0.2;
  }

  /**
   * Check if confidence is low (< 0.5)
   */
  isLow(): boolean {
    return this.value < 0.5;
  }

  /**
   * Check if confidence is medium (0.5 - 0.7)
   */
  isMedium(): boolean {
    return this.value >= 0.5 && this.value < 0.7;
  }

  /**
   * Check if confidence is high (>= 0.7)
   */
  isHigh(): boolean {
    return this.value >= 0.7;
  }

  /**
   * Check if confidence is very high (>= 0.9)
   */
  isVeryHigh(): boolean {
    return this.value >= 0.9;
  }

  /**
   * Increase confidence by amount, capped at 1
   */
  increase(amount: number): ConfidenceScore {
    const newValue = Math.min(1, this.value + amount);
    return ConfidenceScore.create(newValue);
  }

  /**
   * Decrease confidence by amount, floored at 0
   */
  decrease(amount: number): ConfidenceScore {
    const newValue = Math.max(0, this.value - amount);
    return ConfidenceScore.create(newValue);
  }

  /**
   * Multiply confidence by factor
   */
  multiply(factor: number): ConfidenceScore {
    const newValue = Math.max(0, Math.min(1, this.value * factor));
    return ConfidenceScore.create(newValue);
  }

  /**
   * Average with another confidence score
   */
  average(other: ConfidenceScore): ConfidenceScore {
    const avg = (this.value + other.value) / 2;
    return ConfidenceScore.create(avg);
  }

  /**
   * Weighted average with another confidence score
   */
  weightedAverage(other: ConfidenceScore, weight: number): ConfidenceScore {
    const clampedWeight = Math.max(0, Math.min(1, weight));
    const avg = this.value * clampedWeight + other.value * (1 - clampedWeight);
    return ConfidenceScore.create(avg);
  }

  /**
   * Value equality
   */
  equals(other: ConfidenceScore): boolean {
    return this.value === other.value;
  }

  /**
   * Compare confidence scores
   */
  compare(other: ConfidenceScore): number {
    return this.value - other.value;
  }

  /**
   * Check if greater than other
   */
  greaterThan(other: ConfidenceScore): boolean {
    return this.value > other.value;
  }

  /**
   * Check if less than other
   */
  lessThan(other: ConfidenceScore): boolean {
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
    return `ConfidenceScore(${this.percentage}%, ${this.level})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      score: this.value,
      percentage: this.percentage,
      level: this.level
    };
  }
}
