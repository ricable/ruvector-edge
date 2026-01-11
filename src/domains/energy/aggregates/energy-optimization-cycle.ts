/**
 * Energy Optimization Cycle Aggregate Root
 *
 * Manages closed-loop energy optimization for GOAL-008 (MIMO Sleep) and GOAL-009 (Cell Sleep).
 * Implements 6-phase optimization: Observe -> Analyze -> Decide -> Act -> Learn -> Repeat
 */

import { EnergyState, MIMOSleepState, CellSleepState } from '../value-objects/energy-state';
import { EnergyAction, SleepPolicy, WakeTrigger } from '../value-objects/energy-action';
import { EnergyReward, MIMOSleepReward, CellSleepReward } from '../value-objects/energy-reward';
import { EnergyOptimizer, MIMOSleepOptimizer, CellSleepOptimizer, OptimizationResult } from '../entities/energy-optimizer';

export type EnergyPhase = 'Observe' | 'Analyze' | 'Decide' | 'Act' | 'Learn' | 'Completed';
export type EnergyGoalType = 'MIMO_SLEEP' | 'CELL_SLEEP';

export interface EnergyCycleConfig {
  readonly cycleId: string;
  readonly goalType: EnergyGoalType;
  readonly timerDuration: number;
  readonly maxTransitions: number;
}

export interface EnergyMetrics {
  readonly powerWatts: number;
  readonly downlinkThroughput: number;
  readonly uplinkThroughput: number;
  readonly callSetupSuccess: number;
  readonly activeUEs: number;
  readonly hour: number;
  readonly trafficLoadPercent: number;
}

export interface EnergyPolicy {
  readonly id: string;
  readonly name: string;
  readonly conditions: any;
  readonly action: EnergyAction;
  readonly expectedSavings: number;
}

/**
 * Energy Optimization Cycle Aggregate Root
 */
export class EnergyOptimizationCycle {
  readonly id: string;
  private readonly _goalType: EnergyGoalType;
  private readonly _optimizer: EnergyOptimizer;
  private _phase: EnergyPhase;
  private _currentState: EnergyState | null;
  private _beforeMetrics: EnergyMetrics | null;
  private _afterMetrics: EnergyMetrics | null;
  private _selectedAction: EnergyAction | null;
  private _optimizationResult: OptimizationResult | null;
  private _calculatedReward: EnergyReward | null;
  private _transitionCount: number;
  private _phaseStartTime: Date;
  private _events: any[];

  constructor(config: EnergyCycleConfig) {
    this.id = config.cycleId;
    this._goalType = config.goalType;
    this._optimizer = config.goalType === 'MIMO_SLEEP'
      ? new MIMOSleepOptimizer(`${config.cycleId}-mimo`)
      : new CellSleepOptimizer(`${config.cycleId}-cell`);

    this._phase = 'Observe';
    this._currentState = null;
    this._beforeMetrics = null;
    this._afterMetrics = null;
    this._selectedAction = null;
    this._optimizationResult = null;
    this._calculatedReward = null;
    this._transitionCount = 0;
    this._phaseStartTime = new Date();
    this._events = [];
  }

  /**
   * Factory method for MIMO Sleep cycle (GOAL-008)
   */
  static createMIMOCycle(cycleId?: string): EnergyOptimizationCycle {
    return new EnergyOptimizationCycle({
      cycleId: cycleId || `mimo-cycle-${Date.now()}`,
      goalType: 'MIMO_SLEEP',
      timerDuration: 30 * 60 * 1000, // 30 minutes
      maxTransitions: 10
    });
  }

  /**
   * Factory method for Cell Sleep cycle (GOAL-009)
   */
  static createCellCycle(cycleId?: string): EnergyOptimizationCycle {
    return new EnergyOptimizationCycle({
      cycleId: cycleId || `cell-cycle-${Date.now()}`,
      goalType: 'CELL_SLEEP',
      timerDuration: 30 * 60 * 1000,
      maxTransitions: 10
    });
  }

  /**
   * Phase 1: Observe - Collect energy and performance metrics
   */
  observe(metrics: EnergyMetrics): EnergyState {
    if (this._phase !== 'Observe') {
      throw new Error(`Cannot observe in phase: ${this._phase}`);
    }

    this._beforeMetrics = metrics;

    // Create appropriate state based on goal type
    if (this._goalType === 'MIMO_SLEEP') {
      this._currentState = MIMOSleepState.fromFeatureAgent({
        trafficLoadPercent: metrics.trafficLoadPercent,
        hour: metrics.hour,
        activeUEs: metrics.activeUEs,
        currentPowerWatts: metrics.powerWatts,
        antennaLayers: 4, // Default, should come from metrics
        sleepThreshold: -85,
        downlinkThroughput: metrics.downlinkThroughput,
        callSetupSuccess: metrics.callSetupSuccess
      });
    } else {
      this._currentState = CellSleepState.fromCellMetrics({
        trafficLoadPercent: metrics.trafficLoadPercent,
        hour: metrics.hour,
        activeUEs: metrics.activeUEs,
        campingUEs: metrics.activeUEs, // Assume active = camping for now
        currentPowerWatts: metrics.powerWatts,
        cellType: 'micro',
        isPrimary: false,
        downlinkThroughput: metrics.downlinkThroughput,
        callSetupSuccess: metrics.callSetupSuccess
      });
    }

    this._phase = 'Analyze';
    this.raiseEvent({
      type: 'Observed',
      cycleId: this.id,
      goalType: this._goalType,
      state: this._currentState.toString(),
      timestamp: new Date()
    });

    return this._currentState;
  }

  /**
   * Phase 2: Analyze - Evaluate optimization opportunities
   */
  analyze(qValues: Map<string, number> | null = null): OptimizationResult {
    if (this._phase !== 'Analyze' || !this._currentState) {
      throw new Error(`Cannot analyze in phase: ${this._phase}`);
    }

    // Get optimization recommendation
    this._optimizationResult = this._optimizer.evaluate(this._currentState, qValues);
    this._selectedAction = this._optimizationResult.selectedAction;

    this._phase = 'Decide';
    this.raiseEvent({
      type: 'Analyzed',
      cycleId: this.id,
      action: this._selectedAction,
      expectedSavings: this._optimizationResult.expectedSavings,
      reasoning: this._optimizationResult.reasoning,
      timestamp: new Date()
    });

    return this._optimizationResult;
  }

  /**
   * Phase 3: Decide - Check constraints and get approval
   */
  decide(): {
    approved: boolean;
    reason: string;
    requiresManualApproval: boolean;
  } {
    if (this._phase !== 'Decide' || !this._optimizationResult) {
      throw new Error(`Cannot decide in phase: ${this._phase}`);
    }

    const result = this._optimizationResult;

    // Check transition count limit
    if (this._transitionCount >= 10) {
      this._phase = 'Completed';
      return {
        approved: false,
        reason: 'Max transition count reached (10/hour) - stabilizing',
        requiresManualApproval: false
      };
    }

    // Auto-approve safe actions
    const safeActions = [
      EnergyAction.MAINTAIN_CURRENT,
      EnergyAction.WAKE_TO_FULL_MIMO,
      EnergyAction.IMMEDIATE_WAKE
    ];

    if (safeActions.includes(result.selectedAction)) {
      this._phase = 'Act';
      return {
        approved: true,
        reason: 'Auto-approved: Safe action or QoS recovery',
        requiresManualApproval: false
      };
    }

    // Check if significant QoS impact expected
    if (result.qosImpact < -5) {
      this._phase = 'Completed';
      return {
        approved: false,
        reason: 'QoS impact exceeds threshold (-5%) - safety first',
        requiresManualApproval: true
      };
    }

    // Approve energy-saving actions
    this._phase = 'Act';
    return {
      approved: true,
      reason: `Auto-approved: Expected ${result.expectedSavings}% energy savings with acceptable QoS impact`,
      requiresManualApproval: false
    };
  }

  /**
   * Phase 4: Act - Execute the energy optimization action
   */
  act(): {
    action: EnergyAction;
    commands: string[];
    expectedDuration: number;
  } {
    if (this._phase !== 'Act' || !this._selectedAction) {
      throw new Error(`Cannot act in phase: ${this._phase}`);
    }

    const action = this._selectedAction;
    const commands = this.generateCommands(action);
    const metadata = this._optimizationResult;

    // Increment transition count if mode changing
    if (action !== EnergyAction.MAINTAIN_CURRENT) {
      this._transitionCount++;
    }

    this._phase = 'Learn';
    this.raiseEvent({
      type: 'Acted',
      cycleId: this.id,
      action: action,
      commands: commands,
      timestamp: new Date()
    });

    return {
      action,
      commands,
      expectedDuration: metadata?.transitionTime ?? 0
    };
  }

  /**
   * Generate CMED commands for action
   */
  private generateCommands(action: EnergyAction): string[] {
    const commands: string[] = [];

    switch (action) {
      case EnergyAction.ENABLE_PARTIAL_SLEEP:
        commands.push('cmedit set * MimoSleepFunction.mimoMode=PARTIAL_SLEEP');
        commands.push('cmedit set * MimoSleepFunction.antennaLayers=2');
        break;

      case EnergyAction.ENABLE_DEEP_SLEEP:
        commands.push('cmedit set * MimoSleepFunction.mimoMode=DEEP_SLEEP');
        commands.push('cmedit set * MimoSleepFunction.antennaLayers=1');
        break;

      case EnergyAction.WAKE_TO_FULL_MIMO:
        commands.push('cmedit set * MimoSleepFunction.mimoMode=FULL');
        commands.push('cmedit set * MimoSleepFunction.antennaLayers=4');
        break;

      case EnergyAction.SLEEP_SECONDARY_CELLS:
        commands.push('cmedit set * EUtranCellFDD.cellAdminState=SLEEP');
        break;

      case EnergyAction.REDUCE_LAYERS:
        commands.push('cmedit set * CarrierComponent.numberOfLayers=2');
        break;

      case EnergyAction.IMMEDIATE_WAKE:
        commands.push('cmedit set * EUtranCellFDD.cellAdminState=ACTIVE');
        break;

      case EnergyAction.GRADUAL_SLEEP:
        commands.push('cmedit set * EnergySavingMode.state=GRADUAL');
        break;

      case EnergyAction.DISTRIBUTE_LOAD:
        commands.push('cmedit set * LoadBalancing.distributeFromOverloaded=true');
        break;
    }

    return commands;
  }

  /**
   * Phase 5: Learn - Evaluate outcome and calculate reward
   */
  learn(afterMetrics: EnergyMetrics): EnergyReward {
    if (this._phase !== 'Learn' || !this._beforeMetrics) {
      throw new Error(`Cannot learn in phase: ${this._phase}`);
    }

    this._afterMetrics = afterMetrics;

    // Calculate reward based on goal type
    if (this._goalType === 'MIMO_SLEEP') {
      this._calculatedReward = this.calculateMIMOReward();
    } else {
      this._calculatedReward = this.calculateCellReward();
    }

    this._phase = 'Completed';
    this.raiseEvent({
      type: 'Learned',
      cycleId: this.id,
      reward: this._calculatedReward.toJSON(),
      success: this._calculatedReward.meetsSuccessCriteria().overall,
      timestamp: new Date()
    });

    return this._calculatedReward;
  }

  /**
   * Calculate MIMO-specific reward
   */
  private calculateMIMOReward(): MIMOSleepReward {
    if (!this._beforeMetrics || !this._afterMetrics) {
      throw new Error('Metrics not available');
    }

    const mimoOptimizer = this._optimizer as MIMOSleepOptimizer;

    return mimoOptimizer.calculateMIMOReward(
      {
        powerWatts: this._beforeMetrics.powerWatts,
        antennaLayers: 4,
        downlinkThroughput: this._beforeMetrics.downlinkThroughput,
        callSetupSuccess: this._beforeMetrics.callSetupSuccess
      },
      {
        powerWatts: this._afterMetrics.powerWatts,
        antennaLayers: 2, // Assume reduced
        downlinkThroughput: this._afterMetrics.downlinkThroughput,
        callSetupSuccess: this._afterMetrics.callSetupSuccess
      }
    );
  }

  /**
   * Calculate Cell-specific reward
   */
  private calculateCellReward(): CellSleepReward {
    if (!this._beforeMetrics || !this._afterMetrics) {
      throw new Error('Metrics not available');
    }

    const cellOptimizer = this._optimizer as CellSleepOptimizer;

    return cellOptimizer.calculateCellReward(
      {
        clusterPowerWatts: this._beforeMetrics.powerWatts,
        activeCells: 10,
        totalCells: 15,
        downlinkThroughput: this._beforeMetrics.downlinkThroughput,
        callSetupSuccess: this._beforeMetrics.callSetupSuccess
      },
      {
        clusterPowerWatts: this._afterMetrics.powerWatts,
        activeCells: 7,
        totalCells: 15,
        downlinkThroughput: this._afterMetrics.downlinkThroughput,
        callSetupSuccess: this._afterMetrics.callSetupSuccess
      }
    );
  }

  /**
   * Get cycle summary
   */
  getSummary(): {
    cycleId: string;
    goalType: EnergyGoalType;
    phase: EnergyPhase;
    action: EnergyAction | null;
    reward: EnergyReward | null;
    success: boolean;
    energySavings: number;
    qosDegradation: number;
    transitions: number;
  } {
    const criteria = this._calculatedReward?.meetsSuccessCriteria();

    return {
      cycleId: this.id,
      goalType: this._goalType,
      phase: this._phase,
      action: this._selectedAction,
      reward: this._calculatedReward,
      success: criteria?.overall ?? false,
      energySavings: this._calculatedReward?.energySavingsPercent ?? 0,
      qosDegradation: this._calculatedReward?.qosDegradationPercent ?? 0,
      transitions: this._transitionCount
    };
  }

  private raiseEvent(event: any): void {
    this._events.push(event);
  }

  // Getters
  get phase(): EnergyPhase { return this._phase; }
  get goalType(): EnergyGoalType { return this._goalType; }
  get currentState(): EnergyState | null { return this._currentState; }
  get selectedAction(): EnergyAction | null { return this._selectedAction; }
  get reward(): EnergyReward | null { return this._calculatedReward; }
  get events(): ReadonlyArray<any> { return this._events; }

  getUncommittedEvents(): any[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  equals(other: EnergyOptimizationCycle): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `EnergyOptimizationCycle(${this.id}, goal=${this._goalType}, phase=${this._phase})`;
  }
}
