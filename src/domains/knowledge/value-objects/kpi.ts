/**
 * KPI (Key Performance Indicator) Value Object
 *
 * Derived metric indicating network health or performance.
 * KPIs are computed from counters and monitored for anomalies.
 */

export type SpatialLevel = 'Cell' | 'Sector' | 'Node' | 'Cluster' | 'Network';
export type TemporalLevel = '15min' | '1hr' | '4hr' | '24hr' | '7day';

export interface Threshold {
  readonly min: number;
  readonly max: number;
  readonly warningMin?: number;
  readonly warningMax?: number;
}

export type Unit = 'percentage' | 'count' | 'milliseconds' | 'bytes' | 'bps' | 'ratio' | 'dB' | 'dBm';

export class KPI {
  constructor(
    public readonly name: string,
    public readonly value: number,
    public readonly unit: Unit,
    public readonly threshold: Threshold,
    public readonly spatialScope: SpatialLevel,
    public readonly temporalScope: TemporalLevel,
    public readonly timestamp: Date
  ) {
    Object.freeze(this);
  }

  /**
   * Check if KPI value is anomalous (outside threshold)
   */
  isAnomaly(): boolean {
    return this.value < this.threshold.min || this.value > this.threshold.max;
  }

  /**
   * Check if KPI is in warning range but not anomalous
   */
  isWarning(): boolean {
    if (this.isAnomaly()) {
      return false;
    }
    const warningMin = this.threshold.warningMin ?? this.threshold.min;
    const warningMax = this.threshold.warningMax ?? this.threshold.max;
    return this.value < warningMin || this.value > warningMax;
  }

  /**
   * Check if KPI is healthy (within normal range)
   */
  isHealthy(): boolean {
    return !this.isAnomaly() && !this.isWarning();
  }

  /**
   * Calculate delta from previous KPI value
   */
  delta(previous: KPI): number {
    if (this.name !== previous.name) {
      throw new Error(`Cannot compute delta between different KPIs: ${this.name} vs ${previous.name}`);
    }
    return this.value - previous.value;
  }

  /**
   * Calculate percentage change from previous
   */
  percentageChange(previous: KPI): number {
    if (previous.value === 0) {
      return this.value === 0 ? 0 : Infinity;
    }
    return ((this.value - previous.value) / Math.abs(previous.value)) * 100;
  }

  /**
   * Get health status as string
   */
  get status(): 'healthy' | 'warning' | 'anomaly' {
    if (this.isAnomaly()) return 'anomaly';
    if (this.isWarning()) return 'warning';
    return 'healthy';
  }

  /**
   * Value equality
   */
  equals(other: KPI): boolean {
    return (
      this.name === other.name &&
      this.value === other.value &&
      this.spatialScope === other.spatialScope &&
      this.temporalScope === other.temporalScope &&
      this.timestamp.getTime() === other.timestamp.getTime()
    );
  }

  /**
   * Create a new KPI with updated value and timestamp
   */
  withValue(newValue: number, newTimestamp: Date = new Date()): KPI {
    return new KPI(
      this.name,
      newValue,
      this.unit,
      this.threshold,
      this.spatialScope,
      this.temporalScope,
      newTimestamp
    );
  }

  toString(): string {
    return `${this.name}=${this.value}${this.unit} [${this.status}]`;
  }

  toJSON(): object {
    return {
      name: this.name,
      value: this.value,
      unit: this.unit,
      threshold: this.threshold,
      spatialScope: this.spatialScope,
      temporalScope: this.temporalScope,
      timestamp: this.timestamp.toISOString(),
      status: this.status
    };
  }
}
