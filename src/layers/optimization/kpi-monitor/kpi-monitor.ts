/**
 * KPI Monitor
 * Multi-level KPI observation and anomaly detection
 *
 * Spatio-Temporal Granularity:
 * - Spatial: Cell -> Sector -> Node -> Cluster -> Network
 * - Temporal: 15min -> 1hr -> 4hr -> 24hr -> 7day
 *
 * @see ADR-010: Closed-Loop Optimization Cycle
 */

import type {
  KPIDefinition,
  ConfidenceScore,
  Timestamp,
  Duration,
} from '../../../core/types/interfaces.js';
import { SpatialLevel, TemporalLevel } from '../../../core/types/enums.js';

export interface IKPIMonitorConfig {
  spatialLevel: SpatialLevel;
  temporalLevel: TemporalLevel;
  /** Threshold for anomaly detection (standard deviations) */
  anomalyThreshold?: number;
  /** Window size for trend analysis */
  trendWindow?: Duration;
}

export interface IKPIObservation {
  kpi: KPIDefinition;
  value: number;
  spatialLevel: SpatialLevel;
  temporalLevel: TemporalLevel;
  timestamp: Timestamp;
  cellId?: string;
  nodeId?: string;
  clusterId?: string;
}

export interface IAnomaly {
  kpi: KPIDefinition;
  value: number;
  expected: number;
  deviation: number;
  severity: 'critical' | 'warning' | 'info';
  timestamp: Timestamp;
  spatialLevel: SpatialLevel;
}

export interface ITrend {
  kpi: KPIDefinition;
  direction: 'improving' | 'stable' | 'degrading';
  slope: number;
  confidence: ConfidenceScore;
  dataPoints: number;
  startTime: Timestamp;
  endTime: Timestamp;
}

/**
 * KPIMonitor implements multi-level KPI observation
 */
export class KPIMonitor {
  private readonly config: Required<IKPIMonitorConfig>;
  private readonly observations: IKPIObservation[];
  private readonly maxObservations: number;

  constructor(config: IKPIMonitorConfig) {
    this.config = {
      spatialLevel: config.spatialLevel,
      temporalLevel: config.temporalLevel,
      anomalyThreshold: config.anomalyThreshold ?? 2.0,
      trendWindow: config.trendWindow ?? 4 * 60 * 60 * 1000, // 4 hours default
    };
    this.observations = [];
    this.maxObservations = 1000;
  }

  /**
   * Record a KPI observation
   */
  observe(observation: IKPIObservation): void {
    this.observations.push(observation);

    // Maintain bounded buffer
    if (this.observations.length > this.maxObservations) {
      this.observations.shift();
    }
  }

  /**
   * Get recent observations for a KPI
   */
  getObservations(kpiName: string, since?: Timestamp): IKPIObservation[] {
    return this.observations.filter(obs =>
      obs.kpi.name === kpiName &&
      (since === undefined || obs.timestamp >= since)
    );
  }

  /**
   * Detect anomalies in recent observations
   */
  detectAnomalies(kpiName?: string): IAnomaly[] {
    const anomalies: IAnomaly[] = [];
    const kpiGroups = this.groupByKPI(kpiName);

    for (const [name, observations] of kpiGroups) {
      if (observations.length < 3) continue;

      // Calculate statistics
      const values = observations.map(o => o.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Check latest observation for anomaly
      const latest = observations[observations.length - 1];
      const deviation = Math.abs(latest.value - mean) / (stdDev || 1);

      if (deviation > this.config.anomalyThreshold) {
        anomalies.push({
          kpi: latest.kpi,
          value: latest.value,
          expected: mean,
          deviation,
          severity: this.classifySeverity(deviation),
          timestamp: latest.timestamp,
          spatialLevel: latest.spatialLevel,
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze trend for a KPI
   */
  analyzeTrend(kpiName: string): ITrend | null {
    const observations = this.getObservations(
      kpiName,
      Date.now() - this.config.trendWindow
    );

    if (observations.length < 3) return null;

    // Sort by timestamp
    observations.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate linear regression slope
    const n = observations.length;
    const times = observations.map(o => o.timestamp);
    const values = observations.map(o => o.value);

    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((acc, t, i) => acc + t * values[i], 0);
    const sumX2 = times.reduce((acc, t) => acc + t * t, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Normalize slope
    const normalizedSlope = slope * 1000 * 60; // Per minute

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssRes = values.reduce((acc, y, i) => {
      const predicted = slope * times[i] + (meanY - slope * (sumX / n));
      return acc + Math.pow(y - predicted, 2);
    }, 0);
    const ssTot = values.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
    const rSquared = 1 - ssRes / (ssTot || 1);

    return {
      kpi: observations[0].kpi,
      direction: this.classifyDirection(normalizedSlope, observations[0].kpi),
      slope: normalizedSlope,
      confidence: Math.max(0, rSquared) as ConfidenceScore,
      dataPoints: n,
      startTime: times[0],
      endTime: times[n - 1],
    };
  }

  /**
   * Compute Min-Cut integrity score
   * Higher score = more fragile KPI dependencies
   */
  computeIntegrity(kpiNames: string[]): number {
    // Simplified Min-Cut calculation
    // In production: use proper graph algorithm
    const anomalyCount = this.detectAnomalies().filter(a =>
      kpiNames.includes(a.kpi.name)
    ).length;

    const degradingTrends = kpiNames.filter(name => {
      const trend = this.analyzeTrend(name);
      return trend?.direction === 'degrading';
    }).length;

    // Integrity = 1 - (fragility factors)
    const fragility = (anomalyCount * 0.3 + degradingTrends * 0.2) / kpiNames.length;
    return Math.max(0, 1 - fragility);
  }

  private groupByKPI(kpiName?: string): Map<string, IKPIObservation[]> {
    const groups = new Map<string, IKPIObservation[]>();

    for (const obs of this.observations) {
      if (kpiName && obs.kpi.name !== kpiName) continue;

      const existing = groups.get(obs.kpi.name) ?? [];
      existing.push(obs);
      groups.set(obs.kpi.name, existing);
    }

    return groups;
  }

  private classifySeverity(deviation: number): 'critical' | 'warning' | 'info' {
    if (deviation > 3.0) return 'critical';
    if (deviation > 2.0) return 'warning';
    return 'info';
  }

  private classifyDirection(
    slope: number,
    kpi: KPIDefinition
  ): 'improving' | 'stable' | 'degrading' {
    const threshold = 0.01; // 1% change per minute is significant

    if (Math.abs(slope) < threshold) return 'stable';

    // Determine if positive slope is good or bad based on KPI type
    // For most KPIs, higher is better (throughput, success rate)
    // For some, lower is better (latency, error rate)
    const lowerIsBetter = kpi.name.toLowerCase().includes('latency') ||
                          kpi.name.toLowerCase().includes('error') ||
                          kpi.name.toLowerCase().includes('drop');

    if (lowerIsBetter) {
      return slope < 0 ? 'improving' : 'degrading';
    } else {
      return slope > 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Get monitor statistics
   */
  getStats(): {
    observationCount: number;
    spatialLevel: SpatialLevel;
    temporalLevel: TemporalLevel;
    oldestObservation: Timestamp | null;
    newestObservation: Timestamp | null;
  } {
    return {
      observationCount: this.observations.length,
      spatialLevel: this.config.spatialLevel,
      temporalLevel: this.config.temporalLevel,
      oldestObservation: this.observations.length > 0
        ? this.observations[0].timestamp
        : null,
      newestObservation: this.observations.length > 0
        ? this.observations[this.observations.length - 1].timestamp
        : null,
    };
  }

  /**
   * Clear all observations
   */
  clear(): void {
    this.observations.length = 0;
  }
}
