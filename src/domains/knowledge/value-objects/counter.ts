/**
 * Counter Value Object
 *
 * Network measurement counter that tracks specific metrics from network elements.
 * Counters are aggregated at various spatial levels and sampled at temporal intervals.
 */

export type CounterCategory = 'Primary' | 'Contributing' | 'Contextual';

export type FeatureId = string;

export class Counter {
  constructor(
    public readonly name: string,
    public readonly value: number,
    public readonly featureId: FeatureId,
    public readonly category: CounterCategory,
    public readonly timestamp: Date
  ) {
    Object.freeze(this);
  }

  /**
   * Calculate delta from a previous counter value
   */
  deltaEncode(previous: Counter): number {
    if (this.name !== previous.name) {
      throw new Error(`Cannot compute delta between different counters: ${this.name} vs ${previous.name}`);
    }
    return this.value - previous.value;
  }

  /**
   * Check if delta from previous value exceeds threshold
   */
  exceedsThreshold(previous: Counter, threshold: number): boolean {
    return Math.abs(this.deltaEncode(previous)) > threshold;
  }

  /**
   * Calculate rate of change per second
   */
  rateOfChange(previous: Counter): number {
    const delta = this.deltaEncode(previous);
    const timeDiff = (this.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    if (timeDiff <= 0) {
      return 0;
    }
    return delta / timeDiff;
  }

  /**
   * Check if this counter is more recent than another
   */
  isNewerThan(other: Counter): boolean {
    return this.timestamp > other.timestamp;
  }

  /**
   * Value equality
   */
  equals(other: Counter): boolean {
    return (
      this.name === other.name &&
      this.value === other.value &&
      this.featureId === other.featureId &&
      this.timestamp.getTime() === other.timestamp.getTime()
    );
  }

  /**
   * Create a new Counter with updated value and timestamp
   */
  withValue(newValue: number, newTimestamp: Date = new Date()): Counter {
    return new Counter(
      this.name,
      newValue,
      this.featureId,
      this.category,
      newTimestamp
    );
  }

  toString(): string {
    return `${this.name}=${this.value} (${this.category})`;
  }

  toJSON(): object {
    return {
      name: this.name,
      value: this.value,
      featureId: this.featureId,
      category: this.category,
      timestamp: this.timestamp.toISOString()
    };
  }
}
