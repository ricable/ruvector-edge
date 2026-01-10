/**
 * RootCauseAnalyzer Entity
 *
 * Analyzes KPI degradations to identify root causes through counter
 * correlation and parameter investigation.
 */

import { KPI } from '../../knowledge/value-objects/kpi';
import { Counter } from '../../knowledge/value-objects/counter';
import { Parameter } from '../../knowledge/value-objects/parameter';
import { RootCause, Recommendation, RiskLevel } from '../value-objects/root-cause';

export interface AnalysisConfig {
  readonly confidenceThreshold: number;   // Minimum confidence (default: 0.85)
  readonly maxCounters: number;           // Max counters to analyze (default: 50)
  readonly correlationThreshold: number;  // Minimum correlation (default: 0.7)
}

export interface CounterCorrelation {
  readonly counter: Counter;
  readonly correlation: number;          // -1 to 1
  readonly significance: number;         // 0 to 1
}

export class RootCauseAnalyzer {
  readonly id: string;
  private _config: AnalysisConfig;
  private _analysisHistory: RootCause[];

  constructor(
    id: string,
    config: AnalysisConfig = {
      confidenceThreshold: 0.85,
      maxCounters: 50,
      correlationThreshold: 0.7
    }
  ) {
    this.id = id;
    this._config = config;
    this._analysisHistory = [];
  }

  /**
   * Analyze KPI degradation to find root cause
   */
  analyze(
    degradedKPI: KPI,
    counters: Counter[],
    parameters: Parameter[],
    historicalKPIs: KPI[] = [],
    historicalCounters: Map<string, Counter[]> = new Map()
  ): RootCause {
    // Find correlated counters
    const correlatedCounters = this.findCorrelatedCounters(
      degradedKPI,
      counters,
      historicalKPIs,
      historicalCounters
    );

    // Identify suspect parameters
    const suspectParameters = this.identifySuspectParameters(
      correlatedCounters,
      parameters
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(
      correlatedCounters,
      suspectParameters,
      historicalKPIs.length
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      degradedKPI,
      correlatedCounters,
      suspectParameters
    );

    // Assess risk level
    const riskLevel = this.assessRisk(
      degradedKPI,
      suspectParameters,
      recommendations
    );

    // Generate explanation
    const explanation = this.generateExplanation(
      degradedKPI,
      correlatedCounters,
      suspectParameters
    );

    const rootCause = new RootCause(
      degradedKPI,
      correlatedCounters.map(c => c.counter),
      suspectParameters,
      confidence,
      explanation,
      recommendations,
      riskLevel
    );

    // Record in history
    this._analysisHistory.push(rootCause);
    if (this._analysisHistory.length > 100) {
      this._analysisHistory = this._analysisHistory.slice(-100);
    }

    return rootCause;
  }

  /**
   * Find counters that correlate with KPI degradation
   */
  private findCorrelatedCounters(
    kpi: KPI,
    counters: Counter[],
    historicalKPIs: KPI[],
    historicalCounters: Map<string, Counter[]>
  ): CounterCorrelation[] {
    const correlations: CounterCorrelation[] = [];

    for (const counter of counters.slice(0, this._config.maxCounters)) {
      const historical = historicalCounters.get(counter.name) ?? [];

      // Calculate correlation if we have historical data
      let correlation = 0;
      let significance = 0.5;

      if (historical.length >= 5 && historicalKPIs.length >= 5) {
        const kpiValues = historicalKPIs.map(k => k.value);
        const counterValues = historical.map(c => c.value);
        correlation = this.pearsonCorrelation(kpiValues, counterValues);
        significance = Math.min(1, historical.length / 20);
      } else {
        // Heuristic: Primary counters more likely correlated
        correlation = counter.category === 'Primary' ? 0.5 : 0.3;
        significance = 0.3;
      }

      if (Math.abs(correlation) >= this._config.correlationThreshold) {
        correlations.push({ counter, correlation, significance });
      }
    }

    return correlations.sort((a, b) =>
      Math.abs(b.correlation) * b.significance - Math.abs(a.correlation) * a.significance
    );
  }

  /**
   * Identify parameters that might be causing the issue
   */
  private identifySuspectParameters(
    correlations: CounterCorrelation[],
    parameters: Parameter[]
  ): Parameter[] {
    const suspects: Parameter[] = [];

    for (const param of parameters) {
      // Check if parameter is outside safe zone
      if (!param.isWithinSafeZone()) {
        suspects.push(param);
        continue;
      }

      // Check if near safe zone boundary
      if (typeof param.value === 'number') {
        const distanceToMin = param.value - param.safeZone.min;
        const distanceToMax = param.safeZone.max - param.value;
        const range = param.safeZone.max - param.safeZone.min;

        if (distanceToMin / range < 0.1 || distanceToMax / range < 0.1) {
          suspects.push(param);
        }
      }
    }

    return suspects;
  }

  /**
   * Calculate confidence in the root cause analysis
   */
  private calculateConfidence(
    correlations: CounterCorrelation[],
    parameters: Parameter[],
    historicalDataPoints: number
  ): number {
    let confidence = 0;

    // Factor 1: Strong correlations found
    if (correlations.length > 0) {
      const avgCorrelation = correlations.reduce(
        (sum, c) => sum + Math.abs(c.correlation) * c.significance, 0
      ) / correlations.length;
      confidence += avgCorrelation * 0.4;
    }

    // Factor 2: Parameters outside safe zone
    const unsafeParams = parameters.filter(p => !p.isWithinSafeZone());
    if (unsafeParams.length > 0) {
      confidence += 0.3;
    }

    // Factor 3: Historical data availability
    const historicalFactor = Math.min(1, historicalDataPoints / 50) * 0.3;
    confidence += historicalFactor;

    return Math.min(1, confidence);
  }

  /**
   * Generate parameter change recommendations
   */
  private generateRecommendations(
    kpi: KPI,
    correlations: CounterCorrelation[],
    parameters: Parameter[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const param of parameters) {
      if (!param.isWithinSafeZone() && typeof param.value === 'number') {
        // Recommend moving toward safe zone center
        const safeCenter = (param.safeZone.min + param.safeZone.max) / 2;
        const suggestedValue = param.value + (safeCenter - param.value) * 0.5;

        recommendations.push({
          parameterId: param.name,
          parameterName: param.name,
          currentValue: param.value,
          suggestedValue: Math.round(suggestedValue * 100) / 100,
          rationale: `Parameter outside safe zone (${param.safeZone.min}-${param.safeZone.max})`,
          priority: param.value < param.safeZone.min ? 'high' : 'medium'
        });
      }
    }

    return recommendations;
  }

  /**
   * Assess risk level for the root cause
   */
  private assessRisk(
    kpi: KPI,
    parameters: Parameter[],
    recommendations: Recommendation[]
  ): RiskLevel {
    // High risk if KPI is critical and severely degraded
    if (kpi.name.toLowerCase().includes('drop') && kpi.value > 0.05) {
      return 'HIGH';
    }

    // High risk if any high-priority recommendations
    if (recommendations.some(r => r.priority === 'high')) {
      return 'HIGH';
    }

    // Medium risk if multiple parameters affected
    if (parameters.filter(p => !p.isWithinSafeZone()).length > 1) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    kpi: KPI,
    correlations: CounterCorrelation[],
    parameters: Parameter[]
  ): string {
    const parts: string[] = [];

    parts.push(`KPI ${kpi.name} is ${kpi.status} (value: ${kpi.value}).`);

    if (correlations.length > 0) {
      const topCorrelated = correlations.slice(0, 3).map(c => c.counter.name);
      parts.push(`Correlated counters: ${topCorrelated.join(', ')}.`);
    }

    const unsafeParams = parameters.filter(p => !p.isWithinSafeZone());
    if (unsafeParams.length > 0) {
      parts.push(`Parameters outside safe zone: ${unsafeParams.map(p => p.name).join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Getters
  get analysisHistory(): ReadonlyArray<RootCause> { return this._analysisHistory; }
  get config(): AnalysisConfig { return this._config; }

  equals(other: RootCauseAnalyzer): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `RootCauseAnalyzer(${this.id}, analyses=${this._analysisHistory.length})`;
  }
}
