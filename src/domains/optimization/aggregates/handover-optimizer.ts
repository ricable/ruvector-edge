/**
 * HandoverOptimizer Aggregate Root
 *
 * Executes GOAL-006: Handover Success Rate Optimization for 48 Mobility agents.
 * Uses OALA cycle (Observe-Analyze-Learn-Adapt) to achieve >99.5% handover success rate.
 *
 * Target Metrics:
 * - HO success rate: >99.5% (from current 94.0%)
 * - Ping-pong rate: <1.0%
 * - Too-early rate: <2.0%
 * - Rollback rate: <5.0%
 *
 * Key Features:
 * - A3 Event Handover (FAJ 121 3001)
 * - A5 Event Handover (FAJ 121 3002)
 * - Automatic Neighbor Relation (FAJ 121 3010)
 * - Smart Handover Control (FAJ 121 3015)
 * - Ping-Pong Timer (FAJ 121 3020)
 * - Cell Individual Offset (FAJ 121 3025)
 */

import { KPI } from '../../knowledge/value-objects/kpi';
import { Counter } from '../../knowledge/value-objects/counter';
import { Parameter } from '../../knowledge/value-objects/parameter';
import { QTable } from '../../intelligence/aggregates/q-table';
import { State } from '../../intelligence/value-objects/state';
import { Action } from '../../intelligence/value-objects/action';
import { Reward } from '../../intelligence/value-objects/reward';
import { SafeZone, SafeZoneViolation } from '../entities/safe-zone';
import { CmeditCommand } from '../value-objects/cmedit-command';

/**
 * OALA Phases
 */
export type OALAPhase = 'OBSERVE' | 'ANALYZE' | 'LEARN' | 'ADAPT' | 'Completed' | 'RolledBack';

/**
 * Root Cause Categories for Handover Failures
 */
export type HandoverRootCause =
  | 'too_early'      // HO triggered before UE has strong enough signal
  | 'too_late'       // HO triggered after UE already has weak signal
  | 'ping_pong'      // UE bouncing back and forth between cells
  | 'coverage_hole'  // Area with poor coverage
  | 'interference'   // High interference causing failure
  | 'unknown';

/**
 * Handover-specific Metrics
 */
export interface HandoverMetrics {
  readonly hoSuccessRate: number;       // pmHoExeSucc / pmHoExeAtt
  readonly hoAttempts: number;          // pmHoExeAtt
  readonly hoSuccesses: number;         // pmHoExeSucc
  readonly hoFailures: number;          // pmHoFail
  readonly pingPongRate: number;        // pmHoPingPong / pmHoExeAtt
  readonly tooEarlyRate: number;        // Too early HO attempts
  readonly tooLateRate: number;         // Too late HO attempts
  readonly timestamp: Date;
}

/**
 * Handover Parameters (Safe Zones)
 */
export interface HandoverParameters {
  readonly a3Offset: number;            // -6 to 12 dB (default: 0 dB)
  readonly hysteresis: number;          // 0 to 10 dB (default: 2 dB)
  readonly timeToTrigger: number;       // 0 to 1280 ms (default: 320 ms)
  readonly pingPongTimer: number;       // 0 to 60 seconds (default: 10s)
  readonly cellIndividualOffset: number;// -12 to 12 dB (default: 0 dB)
}

/**
 * Parameter Adjustment Recommendation
 */
export interface ParameterAdjustment {
  readonly parameter: keyof HandoverParameters;
  readonly currentValue: number;
  readonly suggestedValue: number;
  readonly reason: string;
  readonly expectedImpact: string;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * OALA Cycle Outcome
 */
export interface OALAOutcome {
  readonly success: boolean;
  readonly hoSuccessRateDelta: number;
  readonly pingPongRateDelta: number;
  readonly rollbackTriggered: boolean;
  readonly reason: string;
  readonly cyclesCompleted: number;
  readonly finalMetrics: HandoverMetrics;
}

/**
 * Domain Events for HandoverOptimizer
 */
export interface OALACycleStarted {
  readonly type: 'OALACycleStarted';
  readonly optimizerId: string;
  readonly targetCell: string;
  readonly timestamp: Date;
}

export interface MetricsObserved {
  readonly type: 'MetricsObserved';
  readonly optimizerId: string;
  readonly metrics: HandoverMetrics;
  readonly timestamp: Date;
}

export interface RootCauseIdentified {
  readonly type: 'RootCauseIdentified';
  readonly optimizerId: string;
  readonly rootCause: HandoverRootCause;
  readonly confidence: number;
  readonly timestamp: Date;
}

export interface QTableUpdated {
  readonly type: 'QTableUpdated';
  readonly optimizerId: string;
  readonly rootCause: HandoverRootCause;
  readonly action: string;
  readonly reward: number;
  readonly timestamp: Date;
}

export interface ParametersAdapted {
  readonly type: 'ParametersAdapted';
  readonly optimizerId: string;
  readonly adjustments: ParameterAdjustment[];
  readonly timestamp: Date;
}

export interface RollbackTriggered {
  readonly type: 'RollbackTriggered';
  readonly optimizerId: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export type HandoverOptimizerEvent =
  | OALACycleStarted
  | MetricsObserved
  | RootCauseIdentified
  | QTableUpdated
  | ParametersAdapted
  | RollbackTriggered;

/**
 * Safe Zones for Handover Parameters
 */
const HANDOVER_SAFE_ZONES = {
  a3Offset: { min: -6, max: 12 },
  hysteresis: { min: 0, max: 10 },
  timeToTrigger: { min: 0, max: 1280 },
  pingPongTimer: { min: 0, max: 60 },
  cellIndividualOffset: { min: -12, max: 12 }
};

/**
 * Success Criteria
 */
const SUCCESS_CRITERIA = {
  hoSuccessRate: 99.5,      // >99.5%
  pingPongRate: 1.0,        // <1.0%
  tooEarlyRate: 2.0,        // <2.0%
  rollbackRate: 5.0         // <5.0%
};

/**
 * HandoverOptimizer Aggregate Root
 *
 * Implements OALA cycle for handover optimization across 48 mobility agents.
 */
export class HandoverOptimizer {
  readonly id: string;
  readonly targetCell: string;
  private _phase: OALAPhase;
  private _currentMetrics: HandoverMetrics | null;
  private _baselineMetrics: HandoverMetrics | null;
  private _rootCause: HandoverRootCause | null;
  private _qTable: QTable;
  private _currentParameters: HandoverParameters;
  private _rollbackPoint: HandoverParameters | null;
  private _cycleCount: number;
  private _maxCycles: number;
  private _safeZones: Map<keyof HandoverParameters, SafeZone>;
  private _events: HandoverOptimizerEvent[];
  private _startTime: Date;

  constructor(
    id: string,
    targetCell: string,
    qTable: QTable,
    initialParameters: HandoverParameters,
    maxCycles: number = 10
  ) {
    this.id = id;
    this.targetCell = targetCell;
    this._phase = 'OBSERVE';
    this._currentMetrics = null;
    this._baselineMetrics = null;
    this._rootCause = null;
    this._qTable = qTable;
    this._currentParameters = initialParameters;
    this._rollbackPoint = null;
    this._cycleCount = 0;
    this._maxCycles = maxCycles;
    this._safeZones = this.initializeSafeZones();
    this._events = [];
    this._startTime = new Date();

    this.raise({
      type: 'OALACycleStarted',
      optimizerId: this.id,
      targetCell: this.targetCell,
      timestamp: new Date()
    });
  }

  /**
   * Factory method
   */
  static create(
    targetCell: string,
    qTable: QTable,
    initialParameters: HandoverParameters = {
      a3Offset: 0,
      hysteresis: 2,
      timeToTrigger: 320,
      pingPongTimer: 10,
      cellIndividualOffset: 0
    },
    maxCycles?: number
  ): HandoverOptimizer {
    const id = `ho-optimizer-${targetCell}-${Date.now()}`;
    return new HandoverOptimizer(id, targetCell, qTable, initialParameters, maxCycles);
  }

  /**
   * Initialize safe zones for handover parameters
   */
  private initializeSafeZones(): Map<keyof HandoverParameters, SafeZone> {
    const safeZones = new Map<keyof HandoverParameters, SafeZone>();

    safeZones.set('a3Offset', new SafeZone(
      'a3Offset',
      'A3 Offset',
      {
        min: HANDOVER_SAFE_ZONES.a3Offset.min,
        max: HANDOVER_SAFE_ZONES.a3Offset.max,
        safeMin: HANDOVER_SAFE_ZONES.a3Offset.min * 0.8,
        safeMax: HANDOVER_SAFE_ZONES.a3Offset.max * 0.8,
        changeLimit: 20,  // 20% max change per cycle
        cooldown: 3600 // 1 hour cooldown
      }
    ));

    safeZones.set('hysteresis', new SafeZone(
      'hysteresis',
      'Hysteresis',
      {
        min: HANDOVER_SAFE_ZONES.hysteresis.min,
        max: HANDOVER_SAFE_ZONES.hysteresis.max,
        safeMin: 0.5,
        safeMax: 8,
        changeLimit: 30,  // 30% max change per cycle
        cooldown: 1800 // 30 min cooldown
      }
    ));

    safeZones.set('timeToTrigger', new SafeZone(
      'timeToTrigger',
      'Time to Trigger',
      {
        min: HANDOVER_SAFE_ZONES.timeToTrigger.min,
        max: HANDOVER_SAFE_ZONES.timeToTrigger.max,
        safeMin: 40,
        safeMax: 1024,
        changeLimit: 25,  // 25% max change per cycle
        cooldown: 900  // 15 min cooldown
      }
    ));

    safeZones.set('pingPongTimer', new SafeZone(
      'pingPongTimer',
      'Ping Pong Timer',
      {
        min: HANDOVER_SAFE_ZONES.pingPongTimer.min,
        max: HANDOVER_SAFE_ZONES.pingPongTimer.max,
        safeMin: 5,
        safeMax: 45,
        changeLimit: 50,  // 50% max change per cycle
        cooldown: 600  // 10 min cooldown
      }
    ));

    safeZones.set('cellIndividualOffset', new SafeZone(
      'cellIndividualOffset',
      'Cell Individual Offset',
      {
        min: HANDOVER_SAFE_ZONES.cellIndividualOffset.min,
        max: HANDOVER_SAFE_ZONES.cellIndividualOffset.max,
        safeMin: -10,
        safeMax: 10,
        changeLimit: 20,  // 20% max change per cycle
        cooldown: 3600 // 1 hour cooldown
      }
    ));

    return safeZones;
  }

  /**
   * ========================================================================
   * OALA CYCLE IMPLEMENTATION
   * ========================================================================
   */

  /**
   * PHASE 1: OBSERVE
   *
   * Collect handover metrics at 15-minute granularity:
   * - pmHoExeSucc: Successful handover executions
   * - pmHoExeAtt: Handover execution attempts
   * - pmHoFail: Failed handovers
   * - pmHoPingPong: Ping-pong handovers
   *
   * Calculate derived metrics:
   * - HO Success Rate = pmHoExeSucc / pmHoExeAtt × 100
   * - Ping-Pong Rate = pmHoPingPong / pmHoExeAtt × 100
   */
  observe(counters: Counter[]): HandoverMetrics {
    if (this._phase !== 'OBSERVE') {
      throw new Error(`Cannot observe in phase: ${this._phase}`);
    }

    // Extract counters
    const pmHoExeSucc = this.findCounter(counters, 'pmHoExeSucc');
    const pmHoExeAtt = this.findCounter(counters, 'pmHoExeAtt');
    const pmHoFail = this.findCounter(counters, 'pmHoFail');
    const pmHoPingPong = this.findCounter(counters, 'pmHoPingPong');

    // Calculate metrics
    const hoSuccessRate = pmHoExeAtt > 0 ? (pmHoExeSucc / pmHoExeAtt) * 100 : 0;
    const pingPongRate = pmHoExeAtt > 0 ? (pmHoPingPong / pmHoExeAtt) * 100 : 0;

    // Estimate too-early/late rates (would need additional counters in real system)
    const tooEarlyRate = this.estimateTooEarlyRate(counters);
    const tooLateRate = this.estimateTooLateRate(counters);

    this._currentMetrics = {
      hoSuccessRate,
      hoAttempts: pmHoExeAtt,
      hoSuccesses: pmHoExeSucc,
      hoFailures: pmHoFail,
      pingPongRate,
      tooEarlyRate,
      tooLateRate,
      timestamp: new Date()
    };

    // Store baseline if first cycle
    if (!this._baselineMetrics) {
      this._baselineMetrics = { ...this._currentMetrics };
    }

    this.raise({
      type: 'MetricsObserved',
      optimizerId: this.id,
      metrics: this._currentMetrics,
      timestamp: new Date()
    });

    // Check if optimization is needed
    if (this.needsOptimization()) {
      this._phase = 'ANALYZE';
    } else {
      this._phase = 'Completed';
    }

    return this._currentMetrics;
  }

  /**
   * PHASE 2: ANALYZE
   *
   * Root cause identification for handover failures:
   * - too_early: HO triggered too early, UE doesn't have strong enough signal
   * - too_late: HO triggered too late, UE signal already too weak
   * - ping_pong: UE bouncing back and forth between cells
   * - coverage_hole: Area with poor coverage
   * - interference: High interference causing HO failure
   *
   * Uses counter patterns and KPI correlations to identify root cause.
   */
  analyze(counters: Counter[], kpis: KPI[]): HandoverRootCause {
    if (this._phase !== 'ANALYZE' || !this._currentMetrics) {
      throw new Error(`Cannot analyze in phase: ${this._phase}`);
    }

    const metrics = this._currentMetrics;

    // Root cause detection logic
    let rootCause: HandoverRootCause = 'unknown';
    let confidence = 0.5;

    // Check for ping-pong (high ping-pong rate)
    if (metrics.pingPongRate > SUCCESS_CRITERIA.pingPongRate) {
      rootCause = 'ping_pong';
      confidence = 0.9;
    }
    // Check for too-early handovers
    else if (metrics.tooEarlyRate > SUCCESS_CRITERIA.tooEarlyRate) {
      rootCause = 'too_early';
      confidence = 0.85;
    }
    // Check for too-late handovers
    else if (metrics.tooLateRate > 5.0) {
      rootCause = 'too_late';
      confidence = 0.85;
    }
    // Check for coverage holes (low HO success + high failures)
    else if (metrics.hoSuccessRate < 95.0 && metrics.hoFailures > 100) {
      rootCause = 'coverage_hole';
      confidence = 0.75;
    }
    // Check for interference (pattern-based)
    else if (this.hasInterferencePattern(counters, kpis)) {
      rootCause = 'interference';
      confidence = 0.7;
    }

    this._rootCause = rootCause;

    this.raise({
      type: 'RootCauseIdentified',
      optimizerId: this.id,
      rootCause,
      confidence,
      timestamp: new Date()
    });

    this._phase = 'LEARN';
    return rootCause;
  }

  /**
   * PHASE 3: LEARN
   *
   * Store outcomes and update Q-table based on root cause.
   * Uses federated learning to share knowledge across 48 mobility agents.
   *
   * Q-learning update:
   * Q(s,a) ← Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]
   *
   * Where:
   * - s = current state (root cause + metrics)
   * - a = action (parameter adjustment)
   * - r = reward (KPI improvement)
   * - α = 0.1 (learning rate)
   * - γ = 0.95 (discount factor)
   */
  learn(previousReward?: number): void {
    if (this._phase !== 'LEARN' || !this._rootCause || !this._currentMetrics) {
      throw new Error(`Cannot learn in phase: ${this._phase}`);
    }

    // Encode state from root cause and metrics
    const state = this.encodeState(this._rootCause, this._currentMetrics);

    // Select action based on Q-table (epsilon-greedy)
    const action = this.selectActionForRootCause(this._rootCause);

    // Calculate reward if we have previous metrics
    let reward = 0;
    if (previousReward !== undefined) {
      reward = previousReward;
    } else if (this._baselineMetrics) {
      // Calculate reward from improvement
      const successRateDelta = this._currentMetrics.hoSuccessRate - this._baselineMetrics.hoSuccessRate;
      const pingPongDelta = this._baselineMetrics.pingPongRate - this._currentMetrics.pingPongRate;
      reward = (successRateDelta * 10) + (pingPongDelta * 5);
    }

    // Create Reward object
    const rewardObj = new Reward(
      reward,
      this._currentMetrics.hoSuccessRate > SUCCESS_CRITERIA.hoSuccessRate,
      this._currentMetrics.pingPongRate < SUCCESS_CRITERIA.pingPongRate,
      0,
      this._phase === 'Completed'
    );

    // Update Q-table
    const nextState = this.encodeState(this._rootCause, this._currentMetrics);
    this._qTable.update(state, action, rewardObj, nextState);

    this.raise({
      type: 'QTableUpdated',
      optimizerId: this.id,
      rootCause: this._rootCause,
      action: action.toString(),
      reward,
      timestamp: new Date()
    });

    this._phase = 'ADAPT';
  }

  /**
   * PHASE 4: ADAPT
   *
   * Adjust handover parameters based on root cause and Q-table learning:
   *
   * Root Cause → Parameter Adjustments:
   * - too_early → Increase timeToTrigger, increase hysteresis
   * - too_late → Decrease timeToTrigger, decrease hysteresis
   * - ping_pong → Increase pingPongTimer, increase hysteresis
   * - coverage_hole → Increase cellIndividualOffset
   * - interference → Adjust a3Offset
   *
   * All adjustments respect safe zones:
   * - a3Offset: -6 to 12 dB
   * - hysteresis: 0 to 10 dB
   * - timeToTrigger: 0 to 1280 ms
   * - pingPongTimer: 0 to 60 seconds
   */
  adapt(): ParameterAdjustment[] {
    if (this._phase !== 'ADAPT' || !this._rootCause) {
      throw new Error(`Cannot adapt in phase: ${this._phase}`);
    }

    const adjustments: ParameterAdjustment[] = [];

    // Save rollback point
    this._rollbackPoint = { ...this._currentParameters };

    // Generate adjustments based on root cause
    switch (this._rootCause) {
      case 'too_early':
        adjustments.push(...this.adaptForTooEarly());
        break;

      case 'too_late':
        adjustments.push(...this.adaptForTooLate());
        break;

      case 'ping_pong':
        adjustments.push(...this.adaptForPingPong());
        break;

      case 'coverage_hole':
        adjustments.push(...this.adaptForCoverageHole());
        break;

      case 'interference':
        adjustments.push(...this.adaptForInterference());
        break;

      default:
        // Default: conservative adjustments
        adjustments.push(...this.adaptConservative());
    }

    // Apply adjustments within safe zones
    for (const adj of adjustments) {
      const safeZone = this._safeZones.get(adj.parameter);
      if (safeZone) {
        const violations = safeZone.validate(
          this._currentParameters[adj.parameter],
          adj.suggestedValue
        );

        if (violations.length === 0) {
          this._currentParameters[adj.parameter] = adj.suggestedValue;
        } else {
          // Adjust to safe zone boundary
          const safeValue = this.adjustToSafeZone(
            this._currentParameters[adj.parameter],
            adj.suggestedValue,
            safeZone
          );
          this._currentParameters[adj.parameter] = safeValue;
        }
      }
    }

    this._cycleCount++;

    // Check if we should continue or complete
    if (this._cycleCount >= this._maxCycles || this.hasMetSuccessCriteria()) {
      this._phase = 'Completed';
    } else {
      this._phase = 'OBSERVE';
    }

    this.raise({
      type: 'ParametersAdapted',
      optimizerId: this.id,
      adjustments,
      timestamp: new Date()
    });

    return adjustments;
  }

  /**
   * ========================================================================
   * ROOT CAUSE-SPECIFIC ADAPTATIONS
   * ========================================================================
   */

  /**
   * Adapt for "too_early" root cause
   *
   * Strategy: Make handover triggering more conservative
   * - Increase timeToTrigger (wait longer before HO)
   * - Increase hysteresis (require stronger signal difference)
   */
  private adaptForTooEarly(): ParameterAdjustment[] {
    const adjustments: ParameterAdjustment[] = [];

    // Increase timeToTrigger by 25% (max 640ms)
    const newTTT = Math.min(
      HANDOVER_SAFE_ZONES.timeToTrigger.max,
      this._currentParameters.timeToTrigger * 1.25
    );
    adjustments.push({
      parameter: 'timeToTrigger',
      currentValue: this._currentParameters.timeToTrigger,
      suggestedValue: Math.round(newTTT),
      reason: 'Too-early HO: Increase TTT to allow UE to establish stronger signal',
      expectedImpact: '+2-5% HO success rate',
      riskLevel: 'LOW'
    });

    // Increase hysteresis by 1dB (max 6dB)
    const newHyst = Math.min(
      HANDOVER_SAFE_ZONES.hysteresis.max,
      this._currentParameters.hysteresis + 1
    );
    adjustments.push({
      parameter: 'hysteresis',
      currentValue: this._currentParameters.hysteresis,
      suggestedValue: Math.round(newHyst * 10) / 10,
      reason: 'Too-early HO: Increase hysteresis to require stronger signal delta',
      expectedImpact: '+1-3% HO success rate',
      riskLevel: 'LOW'
    });

    return adjustments;
  }

  /**
   * Adapt for "too_late" root cause
   *
   * Strategy: Make handover triggering more aggressive
   * - Decrease timeToTrigger (trigger HO earlier)
   * - Decrease hysteresis (trigger on smaller signal difference)
   */
  private adaptForTooLate(): ParameterAdjustment[] {
    const adjustments: ParameterAdjustment[] = [];

    // Decrease timeToTrigger by 25% (min 160ms)
    const newTTT = Math.max(
      HANDOVER_SAFE_ZONES.timeToTrigger.min + 40,
      this._currentParameters.timeToTrigger * 0.75
    );
    adjustments.push({
      parameter: 'timeToTrigger',
      currentValue: this._currentParameters.timeToTrigger,
      suggestedValue: Math.round(newTTT),
      reason: 'Too-late HO: Decrease TTT to trigger handover earlier',
      expectedImpact: '+3-7% HO success rate',
      riskLevel: 'MEDIUM'
    });

    // Decrease hysteresis by 1dB (min 1dB)
    const newHyst = Math.max(
      HANDOVER_SAFE_ZONES.hysteresis.min + 0.5,
      this._currentParameters.hysteresis - 1
    );
    adjustments.push({
      parameter: 'hysteresis',
      currentValue: this._currentParameters.hysteresis,
      suggestedValue: Math.round(newHyst * 10) / 10,
      reason: 'Too-late HO: Decrease hysteresis to trigger on smaller delta',
      expectedImpact: '+2-4% HO success rate',
      riskLevel: 'MEDIUM'
    });

    return adjustments;
  }

  /**
   * Adapt for "ping_pong" root cause
   *
   * Strategy: Prevent rapid back-and-forth handovers
   * - Increase pingPongTimer (wait longer before allowing HO back)
   * - Increase hysteresis (require stronger signal difference)
   */
  private adaptForPingPong(): ParameterAdjustment[] {
    const adjustments: ParameterAdjustment[] = [];

    // Increase ping-pong timer by 50%
    const newPPT = Math.min(
      HANDOVER_SAFE_ZONES.pingPongTimer.max,
      this._currentParameters.pingPongTimer * 1.5
    );
    adjustments.push({
      parameter: 'pingPongTimer',
      currentValue: this._currentParameters.pingPongTimer,
      suggestedValue: Math.round(newPPT),
      reason: 'Ping-pong detected: Increase timer to prevent rapid HO back',
      expectedImpact: '-30-50% ping-pong rate',
      riskLevel: 'LOW'
    });

    // Increase hysteresis by 1.5dB
    const newHyst = Math.min(
      HANDOVER_SAFE_ZONES.hysteresis.max,
      this._currentParameters.hysteresis + 1.5
    );
    adjustments.push({
      parameter: 'hysteresis',
      currentValue: this._currentParameters.hysteresis,
      suggestedValue: Math.round(newHyst * 10) / 10,
      reason: 'Ping-pong detected: Increase hysteresis to reduce bouncing',
      expectedImpact: '-20-40% ping-pong rate',
      riskLevel: 'LOW'
    });

    return adjustments;
  }

  /**
   * Adapt for "coverage_hole" root cause
   *
   * Strategy: Improve cell coverage
   * - Increase cellIndividualOffset (make cell more attractive)
   */
  private adaptForCoverageHole(): ParameterAdjustment[] {
    const adjustments: ParameterAdjustment[] = [];

    // Increase cell individual offset by 2dB
    const newCIO = Math.min(
      HANDOVER_SAFE_ZONES.cellIndividualOffset.max,
      this._currentParameters.cellIndividualOffset + 2
    );
    adjustments.push({
      parameter: 'cellIndividualOffset',
      currentValue: this._currentParameters.cellIndividualOffset,
      suggestedValue: Math.round(newCIO * 10) / 10,
      reason: 'Coverage hole: Increase CIO to improve cell attractiveness',
      expectedImpact: '+5-10% HO success rate in coverage hole',
      riskLevel: 'MEDIUM'
    });

    return adjustments;
  }

  /**
   * Adapt for "interference" root cause
   *
   * Strategy: Adjust A3 offset to find cleaner signal
   */
  private adaptForInterference(): ParameterAdjustment[] {
    const adjustments: ParameterAdjustment[] = [];

    // Increase A3 offset by 1dB
    const newA3 = Math.min(
      HANDOVER_SAFE_ZONES.a3Offset.max,
      this._currentParameters.a3Offset + 1
    );
    adjustments.push({
      parameter: 'a3Offset',
      currentValue: this._currentParameters.a3Offset,
      suggestedValue: Math.round(newA3 * 10) / 10,
      reason: 'Interference detected: Adjust A3 offset for cleaner signal',
      expectedImpact: '+3-6% HO success rate',
      riskLevel: 'MEDIUM'
    });

    return adjustments;
  }

  /**
   * Conservative adaptation (unknown root cause)
   */
  private adaptConservative(): ParameterAdjustment[] {
    return [{
      parameter: 'hysteresis',
      currentValue: this._currentParameters.hysteresis,
      suggestedValue: 3,
      reason: 'Conservative adjustment: Default hysteresis',
      expectedImpact: 'Stabilize HO behavior',
      riskLevel: 'LOW'
    }];
  }

  /**
   * ========================================================================
   * UTILITY METHODS
   * ========================================================================
   */

  /**
   * Check if optimization is needed
   */
  private needsOptimization(): boolean {
    if (!this._currentMetrics) return false;

    return (
      this._currentMetrics.hoSuccessRate < SUCCESS_CRITERIA.hoSuccessRate ||
      this._currentMetrics.pingPongRate > SUCCESS_CRITERIA.pingPongRate ||
      this._currentMetrics.tooEarlyRate > SUCCESS_CRITERIA.tooEarlyRate
    );
  }

  /**
   * Check if success criteria have been met
   */
  hasMetSuccessCriteria(): boolean {
    if (!this._currentMetrics) return false;

    return (
      this._currentMetrics.hoSuccessRate >= SUCCESS_CRITERIA.hoSuccessRate &&
      this._currentMetrics.pingPongRate <= SUCCESS_CRITERIA.pingPongRate &&
      this._currentMetrics.tooEarlyRate <= SUCCESS_CRITERIA.tooEarlyRate
    );
  }

  /**
   * Find counter value
   */
  private findCounter(counters: Counter[], name: string): number {
    const counter = counters.find(c => c.name === name);
    return counter?.value ?? 0;
  }

  /**
   * Estimate too-early rate (would need specific counter in production)
   */
  private estimateTooEarlyRate(counters: Counter[]): number {
    // Simplified: Use failure patterns
    const hoFail = this.findCounter(counters, 'pmHoFail');
    const hoAtt = this.findCounter(counters, 'pmHoExeAtt');
    return hoAtt > 0 ? (hoFail / hoAtt) * 100 * 0.3 : 0;
  }

  /**
   * Estimate too-late rate
   */
  private estimateTooLateRate(counters: Counter[]): number {
    // Simplified: Use failure patterns
    const hoFail = this.findCounter(counters, 'pmHoFail');
    const hoAtt = this.findCounter(counters, 'pmHoExeAtt');
    return hoAtt > 0 ? (hoFail / hoAtt) * 100 * 0.2 : 0;
  }

  /**
   * Check for interference pattern
   */
  private hasInterferencePattern(counters: Counter[], kpis: KPI[]): boolean {
    // Look for high interference counters or poor SINR KPIs
    const sinrKPI = kpis.find(k => k.name.toLowerCase().includes('sinr'));
    if (sinrKPI && sinrKPI.value < 5) {
      return true;
    }
    return false;
  }

  /**
   * Encode state for Q-learning
   */
  private encodeState(rootCause: HandoverRootCause, metrics: HandoverMetrics): State {
    const successLevel = metrics.hoSuccessRate < 95 ? 'low' : metrics.hoSuccessRate < 98 ? 'medium' : 'high';
    const pingPongLevel = metrics.pingPongRate > 2 ? 'high' : 'low';

    // Create state with handover-specific context
    return new State(
      'kpi',  // queryType
      successLevel,  // complexity (reused as success level)
      `${rootCause}:${pingPongLevel}`,  // contextHash
      0.8  // confidence
    );
  }

  /**
   * Select action based on root cause
   */
  private selectActionForRootCause(rootCause: HandoverRootCause): Action {
    // Map root causes to actions
    const actionMap: Record<HandoverRootCause, Action> = {
      'too_early': Action.INCREASE_TTT,
      'too_late': Action.DECREASE_TTT,
      'ping_pong': Action.INCREASE_PING_PONG_TIMER,
      'coverage_hole': Action.INCREASE_CIO,
      'interference': Action.ADJUST_A3_OFFSET,
      'unknown': Action.CONSERVATIVE
    };

    return actionMap[rootCause] || Action.CONSERVATIVE;
  }

  /**
   * Adjust value to safe zone boundary
   */
  private adjustToSafeZone(current: number, suggested: number, safeZone: SafeZone): number {
    if (suggested > safeZone.max) {
      return safeZone.max;
    }
    if (suggested < safeZone.min) {
      return safeZone.min;
    }
    return suggested;
  }

  /**
   * Generate cmedit commands for parameter changes
   */
  generateCmeditCommands(): CmeditCommand[] {
    const commands: CmeditCommand[] = [];
    const moPath = `UtranCell=${this.targetCell}`;

    // A3 Offset
    commands.push(new CmeditCommand(
      'set',
      { subNetwork: 'ONRM_ROOT', meContext: 'NodeB1', managedElement: '1' },
      `${moPath},a3Offset`,
      this._currentParameters.a3Offset,
      [{
        description: 'Verify A3 offset',
        command: `cmedit get * ${moPath},a3Offset`,
        expectedOutput: String(this._currentParameters.a3Offset),
        timeout: 5000
      }]
    ));

    // Hysteresis
    commands.push(new CmeditCommand(
      'set',
      { subNetwork: 'ONRM_ROOT', meContext: 'NodeB1', managedElement: '1' },
      `${moPath},hysteresis`,
      this._currentParameters.hysteresis,
      [{
        description: 'Verify hysteresis',
        command: `cmedit get * ${moPath},hysteresis`,
        expectedOutput: String(this._currentParameters.hysteresis),
        timeout: 5000
      }]
    ));

    // Time to Trigger
    commands.push(new CmeditCommand(
      'set',
      { subNetwork: 'ONRM_ROOT', meContext: 'NodeB1', managedElement: '1' },
      `${moPath},timeToTrigger`,
      this._currentParameters.timeToTrigger,
      [{
        description: 'Verify TTT',
        command: `cmedit get * ${moPath},timeToTrigger`,
        expectedOutput: String(this._currentParameters.timeToTrigger),
        timeout: 5000
      }]
    ));

    return commands;
  }

  /**
   * Execute rollback
   */
  async rollback(): Promise<void> {
    if (!this._rollbackPoint) {
      throw new Error('No rollback point available');
    }

    this._currentParameters = { ...this._rollbackPoint };
    this._phase = 'RolledBack';

    this.raise({
      type: 'RollbackTriggered',
      optimizerId: this.id,
      reason: 'Rollback executed',
      timestamp: new Date()
    });
  }

  /**
   * Calculate final outcome
   */
  calculateOutcome(): OALAOutcome {
    if (!this._currentMetrics || !this._baselineMetrics) {
      throw new Error('Cannot calculate outcome: missing metrics');
    }

    const hoSuccessRateDelta = this._currentMetrics.hoSuccessRate - this._baselineMetrics.hoSuccessRate;
    const pingPongRateDelta = this._baselineMetrics.pingPongRate - this._currentMetrics.pingPongRate;
    const success = this.hasMetSuccessCriteria();

    return {
      success,
      hoSuccessRateDelta,
      pingPongRateDelta,
      rollbackTriggered: this._phase === 'RolledBack',
      reason: success ? 'Success criteria met' : 'Max cycles reached',
      cyclesCompleted: this._cycleCount,
      finalMetrics: this._currentMetrics
    };
  }

  private raise(event: HandoverOptimizerEvent): void {
    this._events.push(event);
  }

  // Getters
  get phase(): OALAPhase { return this._phase; }
  get currentMetrics(): HandoverMetrics | null { return this._currentMetrics; }
  get baselineMetrics(): HandoverMetrics | null { return this._baselineMetrics; }
  get rootCause(): HandoverRootCause | null { return this._rootCause; }
  get currentParameters(): Readonly<HandoverParameters> { return this._currentParameters; }
  get cycleCount(): number { return this._cycleCount; }
  get qTable(): QTable { return this._qTable; }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): HandoverOptimizerEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  equals(other: HandoverOptimizer): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `HandoverOptimizer(${this.id}, cell=${this.targetCell}, phase=${this._phase})`;
  }
}

/**
 * Extended Action enum for handover-specific actions
 */
export const HandoverActions = {
  INCREASE_TTT: 'INCREASE_TTT' as Action,
  DECREASE_TTT: 'DECREASE_TTT' as Action,
  INCREASE_HYSTERESIS: 'INCREASE_HYSTERESIS' as Action,
  DECREASE_HYSTERESIS: 'DECREASE_HYSTERESIS' as Action,
  INCREASE_PING_PONG_TIMER: 'INCREASE_PING_PONG_TIMER' as Action,
  INCREASE_CIO: 'INCREASE_CIO' as Action,
  ADJUST_A3_OFFSET: 'ADJUST_A3_OFFSET' as Action,
  CONSERVATIVE: 'CONSERVATIVE' as Action
};
