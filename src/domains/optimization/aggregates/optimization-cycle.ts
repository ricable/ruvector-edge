/**
 * OptimizationCycle Aggregate Root
 *
 * Manages the 6-phase closed-loop optimization process:
 * Observe -> Analyze -> Decide -> Act -> Learn -> Repeat
 */

import { KPI } from '../../knowledge/value-objects/kpi';
import { Counter } from '../../knowledge/value-objects/counter';
import { Parameter } from '../../knowledge/value-objects/parameter';
import { RootCause, RiskLevel, Recommendation } from '../value-objects/root-cause';
import { CmeditCommand } from '../value-objects/cmedit-command';
import { KPIMonitor, Observation } from '../entities/kpi-monitor';
import { RootCauseAnalyzer } from '../entities/root-cause-analyzer';
import { SafeZone, SafeZoneViolation } from '../entities/safe-zone';

export type OptimizationPhase = 'Observe' | 'Analyze' | 'Decide' | 'Act' | 'Learn' | 'Repeat' | 'Completed' | 'RolledBack';

export interface RollbackPoint {
  readonly parameters: Map<string, number | string>;
  readonly timestamp: Date;
  readonly commands: CmeditCommand[];
}

export interface CycleOutcome {
  readonly success: boolean;
  readonly kpiDelta: number;
  readonly rollbackTriggered: boolean;
  readonly reason: string;
  readonly duration: number;
}

export interface Approver {
  readonly id: string;
  readonly name: string;
  readonly timestamp: Date;
}

/**
 * Domain Events for OptimizationCycle
 */
export interface CycleStarted {
  readonly type: 'CycleStarted';
  readonly cycleId: string;
  readonly targetKPI: string;
  readonly timestamp: Date;
}

export interface DataCollected {
  readonly type: 'DataCollected';
  readonly cycleId: string;
  readonly observationCount: number;
  readonly timestamp: Date;
}

export interface AnomalyDetected {
  readonly type: 'AnomalyDetected';
  readonly cycleId: string;
  readonly kpiName: string;
  readonly deviation: number;
  readonly timestamp: Date;
}

export interface RootCauseIdentified {
  readonly type: 'RootCauseIdentified';
  readonly cycleId: string;
  readonly confidence: number;
  readonly timestamp: Date;
}

export interface ApprovalRequested {
  readonly type: 'ApprovalRequested';
  readonly cycleId: string;
  readonly riskLevel: RiskLevel;
  readonly timestamp: Date;
}

export interface ParameterChanged {
  readonly type: 'ParameterChanged';
  readonly cycleId: string;
  readonly parameterName: string;
  readonly oldValue: number | string;
  readonly newValue: number | string;
  readonly timestamp: Date;
}

export interface OutcomeLearned {
  readonly type: 'OutcomeLearned';
  readonly cycleId: string;
  readonly success: boolean;
  readonly kpiDelta: number;
  readonly timestamp: Date;
}

export interface RollbackTriggered {
  readonly type: 'RollbackTriggered';
  readonly cycleId: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export type OptimizationCycleEvent =
  | CycleStarted
  | DataCollected
  | AnomalyDetected
  | RootCauseIdentified
  | ApprovalRequested
  | ParameterChanged
  | OutcomeLearned
  | RollbackTriggered;

/**
 * OptimizationCycle Aggregate Root
 */
export class OptimizationCycle {
  readonly id: string;
  private _phase: OptimizationPhase;
  private _targetKPI: KPI | null;
  private _rootCause: RootCause | null;
  private _recommendations: Recommendation[];
  private _risk: RiskLevel;
  private _rollbackPoint: RollbackPoint | null;
  private _executedCommands: CmeditCommand[];
  private _timerStart: Date | null;
  private _timerDuration: number;
  private _outcome: CycleOutcome | null;
  private _approver: Approver | null;
  private _startTime: Date;
  private _kpiMonitor: KPIMonitor;
  private _rootCauseAnalyzer: RootCauseAnalyzer;
  private _safeZones: Map<string, SafeZone>;
  private _events: OptimizationCycleEvent[];

  constructor(
    id: string,
    kpiMonitor: KPIMonitor,
    rootCauseAnalyzer: RootCauseAnalyzer,
    timerDuration: number = 30 * 60 * 1000 // 30 minutes default
  ) {
    this.id = id;
    this._phase = 'Observe';
    this._targetKPI = null;
    this._rootCause = null;
    this._recommendations = [];
    this._risk = 'LOW';
    this._rollbackPoint = null;
    this._executedCommands = [];
    this._timerStart = null;
    this._timerDuration = timerDuration;
    this._outcome = null;
    this._approver = null;
    this._startTime = new Date();
    this._kpiMonitor = kpiMonitor;
    this._rootCauseAnalyzer = rootCauseAnalyzer;
    this._safeZones = new Map();
    this._events = [];
  }

  /**
   * Factory method
   */
  static create(
    kpiMonitor: KPIMonitor,
    rootCauseAnalyzer: RootCauseAnalyzer,
    timerDuration?: number
  ): OptimizationCycle {
    const id = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new OptimizationCycle(id, kpiMonitor, rootCauseAnalyzer, timerDuration);
  }

  /**
   * Register a safe zone for a parameter
   */
  registerSafeZone(safeZone: SafeZone): void {
    this._safeZones.set(safeZone.parameterId, safeZone);
  }

  /**
   * Phase 1: Observe - Collect KPIs and counters
   */
  observe(kpis: KPI[], counters: Counter[]): Observation[] {
    if (this._phase !== 'Observe') {
      throw new Error(`Cannot observe in phase: ${this._phase}`);
    }

    const observations: Observation[] = [];
    for (const kpi of kpis) {
      observations.push(this._kpiMonitor.observe(kpi));
    }

    this.raise({
      type: 'DataCollected',
      cycleId: this.id,
      observationCount: observations.length,
      timestamp: new Date()
    });

    // Check for anomalies
    const anomalies = this._kpiMonitor.getCurrentAnomalies();
    if (anomalies.length > 0) {
      const worstAnomaly = anomalies[0];
      this._targetKPI = worstAnomaly.kpi;
      this._phase = 'Analyze';

      this.raise({
        type: 'AnomalyDetected',
        cycleId: this.id,
        kpiName: worstAnomaly.kpi.name,
        deviation: worstAnomaly.deviation,
        timestamp: new Date()
      });
    }

    return observations;
  }

  /**
   * Phase 2: Analyze - Identify root cause
   */
  analyze(counters: Counter[], parameters: Parameter[]): RootCause | null {
    if (this._phase !== 'Analyze' || !this._targetKPI) {
      throw new Error(`Cannot analyze in phase: ${this._phase}`);
    }

    this._rootCause = this._rootCauseAnalyzer.analyze(
      this._targetKPI,
      counters,
      parameters
    );

    if (this._rootCause.isActionable()) {
      this._recommendations = [...this._rootCause.recommendations];
      this._risk = this._rootCause.riskLevel;
      this._phase = 'Decide';

      this.raise({
        type: 'RootCauseIdentified',
        cycleId: this.id,
        confidence: this._rootCause.confidence,
        timestamp: new Date()
      });
    } else {
      // Not actionable, go back to observe
      this._phase = 'Observe';
    }

    return this._rootCause;
  }

  /**
   * Phase 3: Decide - Get approval if needed
   */
  decide(): { needsApproval: boolean; reason: string } {
    if (this._phase !== 'Decide' || !this._rootCause) {
      throw new Error(`Cannot decide in phase: ${this._phase}`);
    }

    if (this._rootCause.canAutoApprove()) {
      this._phase = 'Act';
      return { needsApproval: false, reason: 'Auto-approved: LOW risk with high confidence' };
    }

    this.raise({
      type: 'ApprovalRequested',
      cycleId: this.id,
      riskLevel: this._risk,
      timestamp: new Date()
    });

    return {
      needsApproval: true,
      reason: `Manual approval required: ${this._risk} risk, confidence ${(this._rootCause.confidence * 100).toFixed(1)}%`
    };
  }

  /**
   * Approve the optimization (for manual approval)
   */
  approve(approver: Approver): void {
    if (this._phase !== 'Decide') {
      throw new Error(`Cannot approve in phase: ${this._phase}`);
    }

    this._approver = approver;
    this._phase = 'Act';
  }

  /**
   * Reject the optimization
   */
  reject(reason: string): void {
    if (this._phase !== 'Decide') {
      throw new Error(`Cannot reject in phase: ${this._phase}`);
    }

    this._phase = 'Observe';
    this._outcome = {
      success: false,
      kpiDelta: 0,
      rollbackTriggered: false,
      reason: `Rejected: ${reason}`,
      duration: Date.now() - this._startTime.getTime()
    };
  }

  /**
   * Phase 4: Act - Execute parameter changes
   */
  act(currentValues: Map<string, number | string>): CmeditCommand[] {
    if (this._phase !== 'Act') {
      throw new Error(`Cannot act in phase: ${this._phase}`);
    }

    // Create rollback point
    this._rollbackPoint = {
      parameters: new Map(currentValues),
      timestamp: new Date(),
      commands: []
    };

    // Validate changes against safe zones
    const commands: CmeditCommand[] = [];
    const violations: SafeZoneViolation[] = [];

    for (const rec of this._recommendations) {
      const safeZone = this._safeZones.get(rec.parameterId);
      const currentValue = currentValues.get(rec.parameterId);

      if (safeZone && typeof currentValue === 'number' && typeof rec.suggestedValue === 'number') {
        const zoneViolations = safeZone.validate(currentValue, rec.suggestedValue);
        if (zoneViolations.length > 0) {
          violations.push(...zoneViolations);
          continue;
        }
      }

      // Generate cmedit command
      const command = new CmeditCommand(
        'set',
        {
          subNetwork: 'ONRM_ROOT',
          meContext: 'Node1',
          managedElement: '1'
        },
        rec.parameterName,
        rec.suggestedValue,
        [{
          description: 'Verify parameter change',
          command: `cmedit get * ${rec.parameterName}`,
          expectedOutput: String(rec.suggestedValue),
          timeout: 5000
        }]
      );

      commands.push(command);

      this.raise({
        type: 'ParameterChanged',
        cycleId: this.id,
        parameterName: rec.parameterName,
        oldValue: rec.currentValue,
        newValue: rec.suggestedValue,
        timestamp: new Date()
      });
    }

    this._executedCommands = commands;
    this._timerStart = new Date();
    this._phase = 'Learn';

    return commands;
  }

  /**
   * Phase 5: Learn - Evaluate outcome
   */
  learn(newKPI: KPI): CycleOutcome {
    if (this._phase !== 'Learn' || !this._targetKPI) {
      throw new Error(`Cannot learn in phase: ${this._phase}`);
    }

    const kpiDelta = newKPI.value - this._targetKPI.value;
    const improved = this._targetKPI.isAnomaly() && !newKPI.isAnomaly();

    // Check if rollback is needed
    const timerElapsed = Date.now() - (this._timerStart?.getTime() ?? Date.now());
    const timerExpired = timerElapsed >= this._timerDuration;
    const needsRollback = newKPI.isAnomaly() && !improved && timerExpired;

    if (needsRollback) {
      this._phase = 'RolledBack';

      this.raise({
        type: 'RollbackTriggered',
        cycleId: this.id,
        reason: 'KPI did not improve within timer period',
        timestamp: new Date()
      });

      this._outcome = {
        success: false,
        kpiDelta,
        rollbackTriggered: true,
        reason: 'KPI degradation detected, rollback triggered',
        duration: Date.now() - this._startTime.getTime()
      };
    } else {
      this._phase = 'Completed';

      this.raise({
        type: 'OutcomeLearned',
        cycleId: this.id,
        success: improved,
        kpiDelta,
        timestamp: new Date()
      });

      this._outcome = {
        success: improved,
        kpiDelta,
        rollbackTriggered: false,
        reason: improved ? 'KPI improved' : 'KPI stable',
        duration: Date.now() - this._startTime.getTime()
      };
    }

    return this._outcome;
  }

  /**
   * Execute rollback
   */
  async rollback(): Promise<CmeditCommand[]> {
    if (!this._rollbackPoint) {
      throw new Error('No rollback point available');
    }

    const rollbackCommands: CmeditCommand[] = [];

    for (const cmd of this._executedCommands) {
      const originalValue = this._rollbackPoint.parameters.get(cmd.parameter);
      if (originalValue !== undefined) {
        const rollbackCmd = cmd.createRollback(originalValue);
        if (rollbackCmd) {
          rollbackCommands.push(rollbackCmd);
        }
      }
    }

    this._phase = 'RolledBack';
    return rollbackCommands;
  }

  /**
   * Check if timer has expired
   */
  isTimerExpired(): boolean {
    if (!this._timerStart) return false;
    return Date.now() - this._timerStart.getTime() >= this._timerDuration;
  }

  /**
   * Get remaining timer time
   */
  getRemainingTime(): number {
    if (!this._timerStart) return this._timerDuration;
    return Math.max(0, this._timerDuration - (Date.now() - this._timerStart.getTime()));
  }

  private raise(event: OptimizationCycleEvent): void {
    this._events.push(event);
  }

  // Getters
  get phase(): OptimizationPhase { return this._phase; }
  get targetKPI(): KPI | null { return this._targetKPI; }
  get rootCause(): RootCause | null { return this._rootCause; }
  get recommendations(): ReadonlyArray<Recommendation> { return this._recommendations; }
  get risk(): RiskLevel { return this._risk; }
  get rollbackPoint(): RollbackPoint | null { return this._rollbackPoint; }
  get executedCommands(): ReadonlyArray<CmeditCommand> { return this._executedCommands; }
  get outcome(): CycleOutcome | null { return this._outcome; }
  get approver(): Approver | null { return this._approver; }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): OptimizationCycleEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  equals(other: OptimizationCycle): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `OptimizationCycle(${this.id}, phase=${this._phase}, risk=${this._risk})`;
  }
}
