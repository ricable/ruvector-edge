/**
 * Energy Optimizer Entity
 *
 * Core entity for energy optimization decisions.
 * Implements Q-learning state-action selection for both MIMO and Cell sleep.
 */

import { EnergyState, MIMOSleepState, CellSleepState } from '../value-objects/energy-state';
import { EnergyAction, getApplicableActions, getEnergyActionMetadata } from '../value-objects/energy-action';
import { EnergyReward, MIMOSleepReward, CellSleepReward } from '../value-objects/energy-reward';

export interface OptimizationResult {
  readonly selectedAction: EnergyAction;
  readonly expectedSavings: number;
  readonly qosImpact: number;
  readonly transitionTime: number;
  reasoning: string;
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

/**
 * Energy Optimizer Entity
 */
export class EnergyOptimizer {
  readonly id: string;
  private readonly _type: 'mimo' | 'cell';
  private _currentState: EnergyState | null;
  private _lastAction: EnergyAction | null;
  private _modeTransitionCount: number;
  private _transitionHistory: { timestamp: Date; from: string; to: string; }[];

  constructor(
    id: string,
    type: 'mimo' | 'cell'
  ) {
    this.id = id;
    this._type = type;
    this._currentState = null;
    this._lastAction = null;
    this._modeTransitionCount = 0;
    this._transitionHistory = [];
  }

  /**
   * Evaluate state and recommend action
   */
  evaluate(state: EnergyState, qValues: Map<string, number> | null = null): OptimizationResult {
    this._currentState = state;

    // Get applicable actions for current state
    const applicableActions = getApplicableActions(
      this._type === 'mimo',
      {
        trafficLoad: state.trafficLoad,
        activeUEs: state.activeUEs,
        qosIndex: state.qosIndex
      }
    );

    if (applicableActions.length === 0) {
      return {
        selectedAction: EnergyAction.MAINTAIN_CURRENT,
        expectedSavings: 0,
        qosImpact: 0,
        transitionTime: 0,
        reasoning: 'No applicable actions - maintaining current state'
      };
    }

    // Select action based on Q-values or heuristics
    const selectedAction = this.selectAction(state, applicableActions, qValues);
    const metadata = getEnergyActionMetadata(selectedAction);

    // Track transitions
    if (this._lastAction && this._lastAction !== selectedAction) {
      this._modeTransitionCount++;
      this._transitionHistory.push({
        timestamp: new Date(),
        from: this._lastAction,
        to: selectedAction
      });
    }

    this._lastAction = selectedAction;

    return {
      selectedAction,
      expectedSavings: metadata.energySavings,
      qosImpact: metadata.qosImpact,
      transitionTime: metadata.transitionTime,
      reasoning: this.generateReasoning(state, selectedAction, metadata)
    };
  }

  /**
   * Select action using Q-values or heuristics
   */
  private selectAction(
    state: EnergyState,
    applicableActions: EnergyAction[],
    qValues: Map<string, number> | null
  ): EnergyAction {
    if (qValues && qValues.size > 0) {
      // Q-learning selection
      return this.selectActionWithQ(state, applicableActions, qValues);
    } else {
      // Heuristic selection
      return this.selectActionHeuristic(state, applicableActions);
    }
  }

  /**
   * Q-learning action selection
   */
  private selectActionWithQ(
    state: EnergyState,
    applicableActions: EnergyAction[],
    qValues: Map<string, number>
  ): EnergyAction {
    let bestAction = applicableActions[0];
    let bestValue = Number.NEGATIVE_INFINITY;

    for (const action of applicableActions) {
      const key = `${state.encode()}:${action}`;
      const value = qValues.get(key) ?? 0;

      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Heuristic action selection (rule-based)
   */
  private selectActionHeuristic(
    state: EnergyState,
    applicableActions: EnergyAction[]
  ): EnergyAction {
    // Priority-based selection

    // High priority: Wake up if QoS degraded
    if (state.isQoSDegraded()) {
      if (this._type === 'mimo') {
        if (applicableActions.includes(EnergyAction.WAKE_TO_FULL_MIMO)) {
          return EnergyAction.WAKE_TO_FULL_MIMO;
        }
      } else {
        if (applicableActions.includes(EnergyAction.IMMEDIATE_WAKE)) {
          return EnergyAction.IMMEDIATE_WAKE;
        }
      }
    }

    // Medium priority: Deep sleep for very low traffic
    if (state.isLowTraffic()) {
      if (this._type === 'mimo') {
        const mimoState = state as MIMOSleepState;
        if (mimoState.canEnableDeepSleep() &&
            applicableActions.includes(EnergyAction.ENABLE_DEEP_SLEEP)) {
          return EnergyAction.ENABLE_DEEP_SLEEP;
        }
        if (mimoState.canEnablePartialSleep() &&
            applicableActions.includes(EnergyAction.ENABLE_PARTIAL_SLEEP)) {
          return EnergyAction.ENABLE_PARTIAL_SLEEP;
        }
      } else {
        const cellState = state as CellSleepState;
        if (cellState.canDeepSleep() &&
            applicableActions.includes(EnergyAction.SLEEP_SECONDARY_CELLS)) {
          return EnergyAction.SLEEP_SECONDARY_CELLS;
        }
        if (cellState.canPartialSleep() &&
            applicableActions.includes(EnergyAction.REDUCE_LAYERS)) {
          return EnergyAction.REDUCE_LAYERS;
        }
      }
    }

    // Default: Maintain current
    return EnergyAction.MAINTAIN_CURRENT;
  }

  /**
   * Generate reasoning explanation
   */
  private generateReasoning(state: EnergyState, action: EnergyAction, metadata: any): string {
    const parts: string[] = [];

    // Traffic analysis
    parts.push(`Traffic: ${state.trafficLoad} (${state.activeUEs} UEs)`);

    // QoS status
    if (state.isQoSDegraded()) {
      parts.push('QoS DEGRADED - prioritizing recovery');
    } else if (state.qosIndex >= 95) {
      parts.push('QoS excellent - energy saving viable');
    }

    // Action rationale
    if (action === EnergyAction.MAINTAIN_CURRENT) {
      parts.push('Maintaining current mode (stable conditions)');
    } else if (action === EnergyAction.WAKE_TO_FULL_MIMO || action === EnergyAction.IMMEDIATE_WAKE) {
      parts.push('Waking to full capacity (high traffic or QoS needs)');
    } else if (metadata.energySavings > 30) {
      parts.push(`Aggressive sleep mode (${metadata.energySavings}% savings expected)`);
    } else {
      parts.push(`Partial optimization (${metadata.energySavings}% savings expected)`);
    }

    // Transition warning
    if (this._modeTransitionCount > 8) {
      parts.push('⚠️ High transition count - stabilizing');
    }

    return parts.join(' | ');
  }

  /**
   * Calculate reward for action taken
   */
  calculateReward(
    beforeMetrics: EnergyMetrics,
    afterMetrics: EnergyMetrics
  ): EnergyReward {
    const baseReward = EnergyReward.fromMetrics(
      {
        powerWatts: beforeMetrics.powerWatts,
        downlinkThroughput: beforeMetrics.downlinkThroughput,
        uplinkThroughput: beforeMetrics.uplinkThroughput,
        callSetupSuccess: beforeMetrics.callSetupSuccess
      },
      {
        powerWatts: afterMetrics.powerWatts,
        downlinkThroughput: afterMetrics.downlinkThroughput,
        uplinkThroughput: afterMetrics.uplinkThroughput,
        callSetupSuccess: afterMetrics.callSetupSuccess
      },
      this._lastAction ?? EnergyAction.MAINTAIN_CURRENT,
      this._modeTransitionCount
    );

    return baseReward;
  }

  /**
   * Reset transition counter (e.g., new hour)
   */
  resetTransitionCounter(): void {
    this._modeTransitionCount = 0;
  }

  /**
   * Get recent transition rate (per hour)
   */
  getTransitionRate(): number {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentTransitions = this._transitionHistory.filter(
      t => t.timestamp.getTime() > oneHourAgo
    );

    return recentTransitions.length;
  }

  // Getters
  get currentState(): EnergyState | null { return this._currentState; }
  get lastAction(): EnergyAction | null { return this._lastAction; }
  get modeTransitionCount(): number { return this._modeTransitionCount; }
  get type(): 'mimo' | 'cell' { return this._type; }

  equals(other: EnergyOptimizer): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `EnergyOptimizer(${this.id}, type=${this._type}, transitions=${this._modeTransitionCount})`;
  }
}

/**
 * MIMO Sleep Optimizer (GOAL-008)
 */
export class MIMOSleepOptimizer extends EnergyOptimizer {
  constructor(id: string) {
    super(id, 'mimo');
  }

  /**
   * Evaluate MIMO-specific state
   */
  evaluateMIMO(state: MIMOSleepState, qValues: Map<string, number> | null = null): OptimizationResult {
    // Add MIMO-specific reasoning
    const result = super.evaluate(state, qValues);

    // Check antenna layer reduction
    if (state.antennaLayers === 8 && result.selectedAction === EnergyAction.ENABLE_PARTIAL_SLEEP) {
      result.reasoning += ' | 8x8 → 4x4 layer reduction';
    } else if (state.antennaLayers === 4 && result.selectedAction === EnergyAction.ENABLE_DEEP_SLEEP) {
      result.reasoning += ' | 4x4 → 2x2 layer reduction';
    }

    return result;
  }

  /**
   * Calculate MIMO-specific reward
   */
  calculateMIMOReward(
    before: {
      powerWatts: number;
      antennaLayers: number;
      downlinkThroughput: number;
      callSetupSuccess: number;
    },
    after: {
      powerWatts: number;
      antennaLayers: number;
      downlinkThroughput: number;
      callSetupSuccess: number;
    }
  ): MIMOSleepReward {
    return MIMOSleepReward.fromMIMOMetrics(before, after, this.modeTransitionCount);
  }
}

/**
 * Cell Sleep Optimizer (GOAL-009)
 */
export class CellSleepOptimizer extends EnergyOptimizer {
  constructor(id: string) {
    super(id, 'cell');
  }

  /**
   * Evaluate cell-specific state
   */
  evaluateCell(state: CellSleepState, qValues: Map<string, number> | null = null): OptimizationResult {
    const result = super.evaluate(state, qValues);

    // Add cell-specific reasoning
    if (!state.isPrimary && result.selectedAction === EnergyAction.SLEEP_SECONDARY_CELLS) {
      result.reasoning += ' | Secondary cell sleep available';
    }

    if (state.cellType === 'pico' && state.timeOfDay === 'night') {
      result.reasoning += ' | Pico cell night hibernation';
    }

    return result;
  }

  /**
   * Calculate cell-specific reward
   */
  calculateCellReward(
    before: {
      clusterPowerWatts: number;
      activeCells: number;
      totalCells: number;
      downlinkThroughput: number;
      callSetupSuccess: number;
    },
    after: {
      clusterPowerWatts: number;
      activeCells: number;
      totalCells: number;
      downlinkThroughput: number;
      callSetupSuccess: number;
    }
  ): CellSleepReward {
    return CellSleepReward.fromCellMetrics(before, after, this.modeTransitionCount);
  }
}
