/**
 * Optimization Cycle
 * 6-phase closed-loop optimization implementation
 *
 * Phases:
 * 1. Observe - Collect KPIs at multiple granularities
 * 2. Analyze - Detect anomalies, identify root causes
 * 3. Decide - Route to agents, assess risk
 * 4. Act - Execute cmedit, set timer
 * 5. Learn - Update Q-table, record trajectory
 * 6. Repeat - Continue cycle
 *
 * Cycle Timing:
 * - Observe: Continuous (15min aggregation)
 * - Analyze: < 30 seconds
 * - Decide: < 10 seconds
 * - Act: < 60 seconds
 * - Learn: 30 minutes (observation window)
 * - Total Cycle: < 35 minutes
 *
 * @see ADR-010: Closed-Loop Optimization Cycle
 */

import type {
  Recommendation,
  CmeditCommand,
  RollbackPoint,
  Timestamp,
  Duration,
  ConfidenceScore,
} from '../../../core/types/interfaces.js';
import {
  OptimizationPhase,
  RiskLevel,
  ApprovalStatus,
  BlockingCondition,
} from '../../../core/types/enums.js';

export interface IOptimizationCycleConfig {
  /** Observation window duration (default: 30 minutes) */
  observationWindow?: Duration;
  /** Auto-approve confidence threshold (default: 0.8) */
  autoApproveThreshold?: ConfidenceScore;
  /** Minimum previous successes for auto-approve (default: 5) */
  minSuccessesForAutoApprove?: number;
}

export interface ICycleOutcome {
  cycleId: string;
  success: boolean;
  kpiDelta: number;
  executedCommands: CmeditCommand[];
  rolledBack: boolean;
  rollbackReason?: string;
  duration: Duration;
  timestamp: Timestamp;
}

/**
 * OptimizationCycle manages the 6-phase optimization loop
 */
export class OptimizationCycle {
  readonly id: string;
  private phase: OptimizationPhase;
  private recommendation: Recommendation | null;
  private risk: RiskLevel;
  private approvalStatus: ApprovalStatus;
  private rollbackPoint: RollbackPoint | null;
  private observationTimer: ReturnType<typeof setTimeout> | null;
  private startTime: Timestamp;
  private readonly config: Required<IOptimizationCycleConfig>;
  private activeBlockingConditions: BlockingCondition[];
  private executedCommands: CmeditCommand[];
  private baselineKPI: number | null;
  private postChangeKPI: number | null;

  constructor(config?: IOptimizationCycleConfig) {
    this.id = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.phase = OptimizationPhase.Observe;
    this.recommendation = null;
    this.risk = RiskLevel.Low;
    this.approvalStatus = ApprovalStatus.Pending;
    this.rollbackPoint = null;
    this.observationTimer = null;
    this.startTime = Date.now();
    this.config = {
      observationWindow: config?.observationWindow ?? 30 * 60 * 1000, // 30 minutes
      autoApproveThreshold: config?.autoApproveThreshold ?? 0.8,
      minSuccessesForAutoApprove: config?.minSuccessesForAutoApprove ?? 5,
    };
    this.activeBlockingConditions = [];
    this.executedCommands = [];
    this.baselineKPI = null;
    this.postChangeKPI = null;
  }

  /**
   * Get current phase
   */
  getPhase(): OptimizationPhase {
    return this.phase;
  }

  /**
   * Get risk level
   */
  getRisk(): RiskLevel {
    return this.risk;
  }

  /**
   * Get approval status
   */
  getApprovalStatus(): ApprovalStatus {
    return this.approvalStatus;
  }

  /**
   * Check if cycle can proceed
   */
  isBlocked(): boolean {
    return this.activeBlockingConditions.length > 0;
  }

  /**
   * Set blocking condition
   */
  setBlockingCondition(condition: BlockingCondition): void {
    if (!this.activeBlockingConditions.includes(condition)) {
      this.activeBlockingConditions.push(condition);
    }
  }

  /**
   * Clear blocking condition
   */
  clearBlockingCondition(condition: BlockingCondition): void {
    this.activeBlockingConditions = this.activeBlockingConditions.filter(
      c => c !== condition
    );
  }

  /**
   * Transition to next phase
   */
  transitionTo(phase: OptimizationPhase): boolean {
    if (!this.canTransitionTo(phase)) {
      return false;
    }

    this.phase = phase;
    return true;
  }

  /**
   * Check if transition is valid
   */
  canTransitionTo(phase: OptimizationPhase): boolean {
    const validTransitions: Record<OptimizationPhase, OptimizationPhase[]> = {
      [OptimizationPhase.Observe]: [OptimizationPhase.Analyze],
      [OptimizationPhase.Analyze]: [OptimizationPhase.Decide, OptimizationPhase.Observe],
      [OptimizationPhase.Decide]: [OptimizationPhase.Act, OptimizationPhase.Observe],
      [OptimizationPhase.Act]: [OptimizationPhase.Learn],
      [OptimizationPhase.Learn]: [OptimizationPhase.Repeat, OptimizationPhase.Observe],
      [OptimizationPhase.Repeat]: [OptimizationPhase.Observe],
    };

    return validTransitions[this.phase]?.includes(phase) ?? false;
  }

  /**
   * Set recommendation for this cycle
   */
  setRecommendation(recommendation: Recommendation): void {
    this.recommendation = recommendation;
    this.risk = recommendation.risk;
  }

  /**
   * Evaluate if action can be auto-approved
   * @see ADR-010: Approval Logic
   */
  canAutoApprove(previousSuccesses: number): boolean {
    if (!this.recommendation) return false;

    // Auto-approve when:
    // - Risk = LOW
    // - Confidence > 80%
    // - Similar action succeeded > 5 times
    // - All parameters within safe zone
    return (
      this.risk === RiskLevel.Low &&
      previousSuccesses >= this.config.minSuccessesForAutoApprove
    );
  }

  /**
   * Approve the cycle
   */
  approve(approver: string, isAuto: boolean = false): void {
    this.approvalStatus = isAuto
      ? ApprovalStatus.AutoApproved
      : ApprovalStatus.ManualApproved;
  }

  /**
   * Reject the cycle
   */
  reject(reason: string): void {
    this.approvalStatus = ApprovalStatus.Rejected;
  }

  /**
   * Create rollback point before execution
   */
  createRollbackPoint(parameters: Record<string, string | number>): void {
    this.rollbackPoint = {
      timestamp: Date.now(),
      parameters,
      reason: undefined,
    };
  }

  /**
   * Record baseline KPI before change
   */
  setBaselineKPI(value: number): void {
    this.baselineKPI = value;
  }

  /**
   * Record post-change KPI
   */
  setPostChangeKPI(value: number): void {
    this.postChangeKPI = value;
  }

  /**
   * Record executed command
   */
  recordCommand(command: CmeditCommand): void {
    this.executedCommands.push(command);
  }

  /**
   * Start observation timer
   */
  startObservationTimer(callback: () => void): void {
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
    }

    this.observationTimer = setTimeout(() => {
      this.observationTimer = null;
      callback();
    }, this.config.observationWindow);
  }

  /**
   * Cancel observation timer
   */
  cancelObservationTimer(): void {
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }
  }

  /**
   * Check if KPIs degraded (requires rollback)
   */
  shouldRollback(): boolean {
    if (this.baselineKPI === null || this.postChangeKPI === null) {
      return false;
    }

    // Rollback if KPI degraded by more than 5%
    const degradation = (this.baselineKPI - this.postChangeKPI) / this.baselineKPI;
    return degradation > 0.05;
  }

  /**
   * Get cycle outcome
   */
  getOutcome(): ICycleOutcome {
    const kpiDelta = this.postChangeKPI !== null && this.baselineKPI !== null
      ? this.postChangeKPI - this.baselineKPI
      : 0;

    const rolledBack = this.shouldRollback();

    return {
      cycleId: this.id,
      success: !rolledBack && kpiDelta >= 0,
      kpiDelta,
      executedCommands: this.executedCommands,
      rolledBack,
      rollbackReason: rolledBack ? 'KPI degradation detected' : undefined,
      duration: Date.now() - this.startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Get cycle duration
   */
  getDuration(): Duration {
    return Date.now() - this.startTime;
  }

  /**
   * Get rollback point
   */
  getRollbackPoint(): RollbackPoint | null {
    return this.rollbackPoint;
  }

  /**
   * Cleanup cycle resources
   */
  cleanup(): void {
    this.cancelObservationTimer();
  }
}
