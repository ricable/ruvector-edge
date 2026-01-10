/**
 * KPIMonitor Entity
 *
 * Monitors KPIs at multiple spatio-temporal granularities.
 * Detects anomalies and tracks trends.
 */

import { KPI, SpatialLevel, TemporalLevel, Threshold } from '../../knowledge/value-objects/kpi';

export interface Observation {
  readonly kpi: KPI;
  readonly timestamp: Date;
  readonly spatialLevel: SpatialLevel;
  readonly temporalLevel: TemporalLevel;
}

export interface Anomaly {
  readonly kpi: KPI;
  readonly deviation: number;      // How far from threshold
  readonly direction: 'above' | 'below';
  readonly duration: number;       // milliseconds
  readonly timestamp: Date;
}

export interface Trend {
  readonly kpiName: string;
  readonly direction: 'improving' | 'degrading' | 'stable';
  readonly rate: number;           // Change per hour
  readonly confidence: number;     // 0-1
  readonly windowSize: number;     // Number of observations
}

export interface IntegrityScore {
  readonly score: number;          // 0-1
  readonly factors: string[];
}

export class KPIMonitor {
  readonly id: string;
  private _spatialLevel: SpatialLevel;
  private _temporalLevel: TemporalLevel;
  private _observations: Observation[];
  private _anomalies: Anomaly[];
  private _trends: Map<string, Trend>;
  private _maxObservations: number;

  constructor(
    id: string,
    spatialLevel: SpatialLevel,
    temporalLevel: TemporalLevel,
    maxObservations: number = 1000
  ) {
    this.id = id;
    this._spatialLevel = spatialLevel;
    this._temporalLevel = temporalLevel;
    this._observations = [];
    this._anomalies = [];
    this._trends = new Map();
    this._maxObservations = maxObservations;
  }

  /**
   * Record a new observation
   */
  observe(kpi: KPI): Observation {
    const observation: Observation = {
      kpi,
      timestamp: new Date(),
      spatialLevel: this._spatialLevel,
      temporalLevel: this._temporalLevel
    };

    this._observations.push(observation);

    // Ring buffer behavior
    if (this._observations.length > this._maxObservations) {
      this._observations.shift();
    }

    // Check for anomaly
    if (kpi.isAnomaly()) {
      this.recordAnomaly(kpi);
    }

    // Update trend
    this.updateTrend(kpi);

    return observation;
  }

  /**
   * Detect anomalies based on threshold
   */
  detectAnomaly(kpi: KPI): Anomaly | null {
    if (!kpi.isAnomaly()) {
      return null;
    }

    const deviation = kpi.value < kpi.threshold.min
      ? kpi.threshold.min - kpi.value
      : kpi.value - kpi.threshold.max;

    const direction = kpi.value < kpi.threshold.min ? 'below' : 'above';

    // Calculate duration of anomaly
    const recentObs = this.getRecentObservations(kpi.name, 10);
    let duration = 0;
    for (const obs of recentObs.reverse()) {
      if (obs.kpi.isAnomaly()) {
        duration += this.getTemporalDuration();
      } else {
        break;
      }
    }

    return {
      kpi,
      deviation,
      direction,
      duration,
      timestamp: new Date()
    };
  }

  /**
   * Analyze trend for a specific KPI
   */
  analyzeTrend(kpiName: string, windowSize: number = 10): Trend {
    const observations = this.getRecentObservations(kpiName, windowSize);

    if (observations.length < 2) {
      return {
        kpiName,
        direction: 'stable',
        rate: 0,
        confidence: 0,
        windowSize: observations.length
      };
    }

    // Calculate linear regression
    const values = observations.map(o => o.kpi.value);
    const times = observations.map(o => o.timestamp.getTime());
    const { slope, rSquared } = this.linearRegression(times, values);

    // Convert slope to per-hour rate
    const ratePerHour = slope * 3600000;

    // Determine direction
    let direction: 'improving' | 'degrading' | 'stable';
    if (Math.abs(ratePerHour) < 0.01) {
      direction = 'stable';
    } else if (ratePerHour > 0) {
      // Depends on threshold direction - assume higher is worse for now
      direction = 'degrading';
    } else {
      direction = 'improving';
    }

    return {
      kpiName,
      direction,
      rate: ratePerHour,
      confidence: rSquared,
      windowSize: observations.length
    };
  }

  /**
   * Compute overall integrity score
   */
  computeIntegrity(): IntegrityScore {
    const factors: string[] = [];
    let score = 1.0;

    // Factor 1: Recent anomaly rate
    const recentAnomalyRate = this.getRecentAnomalyRate();
    if (recentAnomalyRate > 0.1) {
      score -= 0.3;
      factors.push(`High anomaly rate: ${(recentAnomalyRate * 100).toFixed(1)}%`);
    }

    // Factor 2: Degrading trends
    const degradingTrends = Array.from(this._trends.values())
      .filter(t => t.direction === 'degrading');
    if (degradingTrends.length > 0) {
      score -= 0.1 * degradingTrends.length;
      factors.push(`${degradingTrends.length} degrading KPIs`);
    }

    // Factor 3: Observation coverage
    if (this._observations.length < 10) {
      score -= 0.2;
      factors.push('Insufficient observations');
    }

    return {
      score: Math.max(0, score),
      factors
    };
  }

  /**
   * Get recent observations for a KPI
   */
  getRecentObservations(kpiName: string, count: number): Observation[] {
    return this._observations
      .filter(o => o.kpi.name === kpiName)
      .slice(-count);
  }

  /**
   * Get all current anomalies
   */
  getCurrentAnomalies(): Anomaly[] {
    const cutoff = Date.now() - this.getTemporalDuration() * 2;
    return this._anomalies.filter(a => a.timestamp.getTime() > cutoff);
  }

  private recordAnomaly(kpi: KPI): void {
    const anomaly = this.detectAnomaly(kpi);
    if (anomaly) {
      this._anomalies.push(anomaly);
      // Keep only recent anomalies
      if (this._anomalies.length > 100) {
        this._anomalies = this._anomalies.slice(-100);
      }
    }
  }

  private updateTrend(kpi: KPI): void {
    const trend = this.analyzeTrend(kpi.name);
    this._trends.set(kpi.name, trend);
  }

  private getTemporalDuration(): number {
    const durations: Record<TemporalLevel, number> = {
      '15min': 15 * 60 * 1000,
      '1hr': 60 * 60 * 1000,
      '4hr': 4 * 60 * 60 * 1000,
      '24hr': 24 * 60 * 60 * 1000,
      '7day': 7 * 24 * 60 * 60 * 1000
    };
    return durations[this._temporalLevel];
  }

  private getRecentAnomalyRate(): number {
    const recent = this._observations.slice(-100);
    if (recent.length === 0) return 0;
    const anomalyCount = recent.filter(o => o.kpi.isAnomaly()).length;
    return anomalyCount / recent.length;
  }

  private linearRegression(x: number[], y: number[]): { slope: number; rSquared: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // R-squared calculation
    const meanY = sumY / n;
    const ssTot = y.reduce((acc, yi) => acc + Math.pow(yi - meanY, 2), 0);
    const ssRes = y.reduce((acc, yi, i) => {
      const predicted = slope * x[i] + (meanY - slope * (sumX / n));
      return acc + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope: isNaN(slope) ? 0 : slope, rSquared: Math.max(0, rSquared) };
  }

  // Getters
  get spatialLevel(): SpatialLevel { return this._spatialLevel; }
  get temporalLevel(): TemporalLevel { return this._temporalLevel; }
  get observations(): ReadonlyArray<Observation> { return this._observations; }
  get anomalies(): ReadonlyArray<Anomaly> { return this._anomalies; }
  get trends(): Map<string, Trend> { return new Map(this._trends); }

  equals(other: KPIMonitor): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `KPIMonitor(${this.id}, ${this._spatialLevel}/${this._temporalLevel}, obs=${this._observations.length})`;
  }
}
