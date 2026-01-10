/**
 * Root Cause Analyzer
 * Identifies root causes for KPI degradation
 *
 * Target: >85% root cause accuracy
 *
 * @see ADR-010: Closed-Loop Optimization Cycle
 */

import type {
  KPIDefinition,
  CounterDefinition,
  ParameterDefinition,
  Recommendation,
  ConfidenceScore,
} from '../../../core/types/interfaces.js';
import { RiskLevel, CounterCategory } from '../../../core/types/enums.js';

export interface ICounterCorrelation {
  counter: CounterDefinition;
  correlation: number;
  deltaValue: number;
  significance: 'high' | 'medium' | 'low';
}

export interface IRootCauseResult {
  kpi: KPIDefinition;
  counters: ICounterCorrelation[];
  parameters: ParameterDefinition[];
  confidence: ConfidenceScore;
  explanation: string;
  recommendations: Recommendation[];
}

interface CounterSample {
  name: string;
  value: number;
  timestamp: number;
}

interface KPISample {
  name: string;
  value: number;
  timestamp: number;
}

/**
 * RootCauseAnalyzer performs counter correlation analysis
 */
export class RootCauseAnalyzer {
  private counterHistory: Map<string, CounterSample[]>;
  private kpiHistory: Map<string, KPISample[]>;
  private readonly maxHistorySize: number;
  private readonly correlationThreshold: number;

  constructor(config?: { maxHistorySize?: number; correlationThreshold?: number }) {
    this.counterHistory = new Map();
    this.kpiHistory = new Map();
    this.maxHistorySize = config?.maxHistorySize ?? 100;
    this.correlationThreshold = config?.correlationThreshold ?? 0.5;
  }

  /**
   * Record counter sample
   */
  recordCounter(sample: CounterSample): void {
    const history = this.counterHistory.get(sample.name) ?? [];
    history.push(sample);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    this.counterHistory.set(sample.name, history);
  }

  /**
   * Record KPI sample
   */
  recordKPI(sample: KPISample): void {
    const history = this.kpiHistory.get(sample.name) ?? [];
    history.push(sample);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    this.kpiHistory.set(sample.name, history);
  }

  /**
   * Analyze root cause for KPI degradation
   */
  analyze(
    kpi: KPIDefinition,
    relatedCounters: CounterDefinition[],
    relatedParameters: ParameterDefinition[]
  ): IRootCauseResult {
    const kpiHistory = this.kpiHistory.get(kpi.name) ?? [];

    if (kpiHistory.length < 3) {
      return this.createEmptyResult(kpi, 'Insufficient KPI history for analysis');
    }

    // Calculate counter correlations
    const correlations: ICounterCorrelation[] = [];

    for (const counter of relatedCounters) {
      const counterHistory = this.counterHistory.get(counter.name) ?? [];
      if (counterHistory.length < 3) continue;

      const correlation = this.calculateCorrelation(kpiHistory, counterHistory);
      const delta = this.calculateDelta(counterHistory);

      if (Math.abs(correlation) >= this.correlationThreshold) {
        correlations.push({
          counter,
          correlation,
          deltaValue: delta,
          significance: this.classifySignificance(correlation),
        });
      }
    }

    // Sort by correlation strength
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    // Calculate confidence based on correlation strength
    const avgCorrelation = correlations.length > 0
      ? correlations.reduce((sum, c) => sum + Math.abs(c.correlation), 0) / correlations.length
      : 0;
    const confidence = Math.min(avgCorrelation + 0.3, 0.95) as ConfidenceScore;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      kpi,
      correlations,
      relatedParameters
    );

    // Build explanation
    const explanation = this.buildExplanation(kpi, correlations);

    return {
      kpi,
      counters: correlations.slice(0, 10), // Top 10
      parameters: relatedParameters.slice(0, 5),
      confidence,
      explanation,
      recommendations,
    };
  }

  private calculateCorrelation(
    kpiSamples: KPISample[],
    counterSamples: CounterSample[]
  ): number {
    // Align samples by timestamp (simplified)
    const n = Math.min(kpiSamples.length, counterSamples.length);
    if (n < 2) return 0;

    const kpiValues = kpiSamples.slice(-n).map(s => s.value);
    const counterValues = counterSamples.slice(-n).map(s => s.value);

    // Pearson correlation coefficient
    const meanKpi = kpiValues.reduce((a, b) => a + b, 0) / n;
    const meanCounter = counterValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomKpi = 0;
    let denomCounter = 0;

    for (let i = 0; i < n; i++) {
      const diffKpi = kpiValues[i] - meanKpi;
      const diffCounter = counterValues[i] - meanCounter;
      numerator += diffKpi * diffCounter;
      denomKpi += diffKpi * diffKpi;
      denomCounter += diffCounter * diffCounter;
    }

    const denominator = Math.sqrt(denomKpi * denomCounter);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateDelta(samples: CounterSample[]): number {
    if (samples.length < 2) return 0;
    const first = samples[0].value;
    const last = samples[samples.length - 1].value;
    return last - first;
  }

  private classifySignificance(correlation: number): 'high' | 'medium' | 'low' {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'high';
    if (abs >= 0.5) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    kpi: KPIDefinition,
    correlations: ICounterCorrelation[],
    parameters: ParameterDefinition[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Generate recommendations based on high-correlation counters
    const highCorrelation = correlations.filter(c => c.significance === 'high');

    for (const corr of highCorrelation.slice(0, 3)) {
      // Find related parameters
      const relatedParam = parameters.find(p =>
        p.name.toLowerCase().includes(corr.counter.name.split('_')[0].toLowerCase())
      );

      if (relatedParam) {
        recommendations.push({
          parameter: relatedParam.name,
          currentValue: (typeof relatedParam.defaultValue === 'boolean' ? String(relatedParam.defaultValue) : relatedParam.defaultValue) ?? 'unknown',
          suggestedValue: 'Adjust based on correlation analysis',
          expectedImpact: `May improve ${kpi.name} based on ${Math.abs(corr.correlation * 100).toFixed(1)}% correlation with ${corr.counter.name}`,
          risk: this.assessRisk(corr.correlation, relatedParam),
        });
      }
    }

    return recommendations;
  }

  private assessRisk(correlation: number, parameter: ParameterDefinition): RiskLevel {
    // Higher correlation = lower risk (more predictable impact)
    const absCorr = Math.abs(correlation);

    // Parameters with safe zones are lower risk
    if (parameter.safeZone) {
      return absCorr > 0.7 ? RiskLevel.Low : RiskLevel.Medium;
    }

    return absCorr > 0.8 ? RiskLevel.Low : absCorr > 0.5 ? RiskLevel.Medium : RiskLevel.High;
  }

  private buildExplanation(
    kpi: KPIDefinition,
    correlations: ICounterCorrelation[]
  ): string {
    if (correlations.length === 0) {
      return `No significant counter correlations found for ${kpi.name} degradation.`;
    }

    const topCorr = correlations[0];
    const direction = topCorr.deltaValue > 0 ? 'increase' : 'decrease';
    const kpiDirection = topCorr.correlation > 0 ? 'positive' : 'negative';

    return `${kpi.name} degradation shows ${kpiDirection} correlation (${(topCorr.correlation * 100).toFixed(1)}%) with ${topCorr.counter.name}. Recent ${direction} of ${Math.abs(topCorr.deltaValue).toFixed(2)} in ${topCorr.counter.name} appears to be a primary contributing factor.`;
  }

  private createEmptyResult(kpi: KPIDefinition, explanation: string): IRootCauseResult {
    return {
      kpi,
      counters: [],
      parameters: [],
      confidence: 0 as ConfidenceScore,
      explanation,
      recommendations: [],
    };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.counterHistory.clear();
    this.kpiHistory.clear();
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    counterTypes: number;
    kpiTypes: number;
    totalCounterSamples: number;
    totalKPISamples: number;
  } {
    let totalCounterSamples = 0;
    let totalKPISamples = 0;

    for (const samples of this.counterHistory.values()) {
      totalCounterSamples += samples.length;
    }
    for (const samples of this.kpiHistory.values()) {
      totalKPISamples += samples.length;
    }

    return {
      counterTypes: this.counterHistory.size,
      kpiTypes: this.kpiHistory.size,
      totalCounterSamples,
      totalKPISamples,
    };
  }
}
