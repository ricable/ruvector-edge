/**
 * RootCause Value Object
 *
 * Represents an identified root cause for a KPI degradation,
 * including the analysis confidence and recommended actions.
 */

import { KPI } from '../../knowledge/value-objects/kpi';
import { Counter } from '../../knowledge/value-objects/counter';
import { Parameter } from '../../knowledge/value-objects/parameter';

export interface Recommendation {
  readonly parameterId: string;
  readonly parameterName: string;
  readonly currentValue: number | string;
  readonly suggestedValue: number | string;
  readonly rationale: string;
  readonly priority: 'low' | 'medium' | 'high';
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export class RootCause {
  constructor(
    public readonly kpi: KPI,
    public readonly counters: ReadonlyArray<Counter>,
    public readonly parameters: ReadonlyArray<Parameter>,
    public readonly confidence: number, // 0.0 - 1.0, target >0.85
    public readonly explanation: string,
    public readonly recommendations: ReadonlyArray<Recommendation>,
    public readonly riskLevel: RiskLevel
  ) {
    Object.freeze(this);
    Object.freeze(this.counters);
    Object.freeze(this.parameters);
    Object.freeze(this.recommendations);
  }

  /**
   * Check if root cause is actionable (confidence >= 85%)
   */
  isActionable(): boolean {
    return this.confidence >= 0.85;
  }

  /**
   * Check if requires manual approval
   */
  requiresApproval(): boolean {
    return this.riskLevel === 'HIGH' || this.confidence < 0.6;
  }

  /**
   * Check if can be auto-approved
   */
  canAutoApprove(): boolean {
    return (
      this.riskLevel === 'LOW' &&
      this.confidence >= 0.8 &&
      this.recommendations.every(r => r.priority !== 'high')
    );
  }

  /**
   * Get high-priority recommendations
   */
  getHighPriorityRecommendations(): Recommendation[] {
    return this.recommendations.filter(r => r.priority === 'high');
  }

  /**
   * Value equality
   */
  equals(other: RootCause): boolean {
    return (
      this.kpi.equals(other.kpi) &&
      this.confidence === other.confidence &&
      this.explanation === other.explanation
    );
  }

  toString(): string {
    return `RootCause(${this.kpi.name}, conf=${(this.confidence * 100).toFixed(1)}%, risk=${this.riskLevel})`;
  }

  toJSON(): object {
    return {
      kpi: this.kpi.toJSON(),
      counterCount: this.counters.length,
      parameterCount: this.parameters.length,
      confidence: this.confidence,
      explanation: this.explanation,
      recommendations: [...this.recommendations],
      riskLevel: this.riskLevel,
      isActionable: this.isActionable(),
      requiresApproval: this.requiresApproval()
    };
  }
}
