/**
 * @fileoverview Optimization cycle interfaces
 * @module @ruvector/edge/core/interfaces/optimization
 *
 * @see ADR-010: Closed-Loop Optimization Cycle
 * @see ADR-008: Safe Zone Parameter Constraints
 */

import type {
  CycleId,
  FeatureId,
  AgentId
} from '../types/identifiers.js';

import type {
  OptimizationPhase,
  RiskLevel,
  SpatialLevel,
  TemporalLevel,
  ApprovalStatus,
  BlockingCondition
} from '../types/enums.js';

import type {
  Timestamp,
  ConfidenceScore,
  Duration
} from '../types/primitives.js';

import type { IKPI, ICounter, IParameter } from './feature.js';
import type { ICmeditCommand } from './query.js';

/**
 * Optimization cycle - Aggregate Root
 * 6-phase closed-loop optimization
 */
export interface IOptimizationCycle {
  readonly id: CycleId;
  phase: OptimizationPhase;

  // Context
  readonly targetKPI: IKPIObservation;
  rootCause: IRootCause | null;
  recommendation: IRecommendation | null;
  risk: RiskLevel;

  // Approval
  approvalStatus: ApprovalStatus;
  approver?: string;

  // Execution
  rollbackPoint: IRollbackPoint | null;
  timer: IOptimizationTimer | null;
  outcome: ICycleOutcome | null;

  // Operations
  execute(): Promise<ICycleOutcome>;
  rollback(): Promise<void>;
  approve(approver: string): void;
  reject(reason: string): void;

  // Phase transitions
  transitionTo(phase: OptimizationPhase): void;
  canTransitionTo(phase: OptimizationPhase): boolean;
}

/**
 * KPI observation at a point in time
 */
export interface IKPIObservation {
  readonly kpi: IKPI;
  readonly value: number;
  readonly spatialLevel: SpatialLevel;
  readonly temporalLevel: TemporalLevel;
  readonly timestamp: Timestamp;
  readonly cellId?: string;
  readonly nodeId?: string;

  /** Check if value is anomalous */
  isAnomaly(): boolean;

  /** Calculate delta from previous observation */
  delta(previous: IKPIObservation): number;
}

/**
 * Root cause analysis result
 * @see ADR-010: Closed-Loop Optimization Cycle
 */
export interface IRootCause {
  readonly kpi: IKPI;
  readonly counters: ICounterCorrelation[];
  readonly parameters: IParameter[];
  readonly confidence: ConfidenceScore;
  readonly explanation: string;
  readonly recommendations: IRecommendation[];

  /** Check if actionable (confidence >= 85%) */
  isActionable(): boolean;
}

/**
 * Counter correlation for root cause
 */
export interface ICounterCorrelation {
  readonly counter: ICounter;
  readonly correlation: number;
  readonly deltaValue: number;
  readonly significance: 'high' | 'medium' | 'low';
}

/**
 * Optimization recommendation
 */
export interface IRecommendation {
  readonly featureId: FeatureId;
  readonly agentId: AgentId;
  readonly description: string;
  readonly commands: ICmeditCommand[];
  readonly expectedImprovement: number;
  readonly confidence: ConfidenceScore;
  readonly risk: RiskLevel;
}

/**
 * Rollback point for safe recovery
 */
export interface IRollbackPoint {
  readonly id: string;
  readonly cycleId: CycleId;
  readonly timestamp: Timestamp;
  readonly parameters: IParameterSnapshot[];

  /** Restore to this rollback point */
  restore(): Promise<void>;
}

/**
 * Parameter value snapshot
 */
export interface IParameterSnapshot {
  readonly parameter: string;
  readonly managedObject: string;
  readonly previousValue: unknown;
  readonly newValue: unknown;
}

/**
 * Optimization timer for observation window
 * 30-minute default observation window
 */
export interface IOptimizationTimer {
  readonly startTime: Timestamp;
  readonly duration: Duration;

  /** Check if timer has elapsed */
  hasElapsed(): boolean;

  /** Get remaining time */
  remaining(): Duration;

  /** Cancel timer */
  cancel(): void;
}

/**
 * Optimization cycle outcome
 */
export interface ICycleOutcome {
  readonly cycleId: CycleId;
  readonly success: boolean;
  readonly kpiDelta: number;
  readonly executedCommands: ICmeditCommand[];
  readonly rolledBack: boolean;
  readonly rollbackReason?: string;
  readonly duration: Duration;
  readonly timestamp: Timestamp;
}

/**
 * KPI Monitor for multi-level observation
 */
export interface IKPIMonitor {
  readonly spatialLevel: SpatialLevel;
  readonly temporalLevel: TemporalLevel;

  /** Collect current observation */
  observe(): Promise<IKPIObservation[]>;

  /** Detect anomalies above threshold */
  detectAnomalies(threshold: number): Promise<IAnomaly[]>;

  /** Analyze trend over time window */
  analyzeTrend(window: Duration): Promise<ITrend>;

  /** Compute Min-Cut integrity score */
  computeIntegrity(): Promise<number>;
}

/**
 * Detected anomaly
 */
export interface IAnomaly {
  readonly kpi: IKPI;
  readonly value: number;
  readonly expected: number;
  readonly deviation: number;
  readonly severity: 'critical' | 'warning' | 'info';
  readonly timestamp: Timestamp;
}

/**
 * Trend analysis result
 */
export interface ITrend {
  readonly kpi: IKPI;
  readonly direction: 'improving' | 'stable' | 'degrading';
  readonly slope: number;
  readonly confidence: ConfidenceScore;
  readonly dataPoints: number;
}

/**
 * Blocking condition checker
 * @see ADR-008: Safe Zone Parameter Constraints
 */
export interface IBlockingChecker {
  /** Check if any blocking condition is active */
  isBlocked(): Promise<boolean>;

  /** Get active blocking conditions */
  getActiveConditions(): Promise<BlockingCondition[]>;

  /** Check specific condition */
  checkCondition(condition: BlockingCondition): Promise<boolean>;
}

/**
 * Approval logic for auto vs manual approval
 * @see ADR-010: Closed-Loop Optimization Cycle
 */
export interface IApprovalLogic {
  /** Evaluate if action can be auto-approved */
  canAutoApprove(recommendation: IRecommendation, history: ICycleOutcome[]): boolean;

  /** Get approval requirements */
  getRequirements(recommendation: IRecommendation): IApprovalRequirements;
}

/**
 * Approval requirements
 */
export interface IApprovalRequirements {
  readonly requiresManual: boolean;
  readonly reason: string;
  readonly riskLevel: RiskLevel;
  readonly confidence: ConfidenceScore;
  readonly previousSuccesses: number;
}
