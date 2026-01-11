/**
 * Energy Reward Value Object
 *
 * Calculates rewards for Q-learning based on energy savings and QoS impact.
 * Balances energy efficiency against performance degradation.
 */

import { EnergyAction, getEnergyActionMetadata } from './energy-action';

export interface RewardComponents {
  readonly energySavings: number;        // Positive for savings
  readonly qosImpact: number;             // Negative for degradation
  readonly stabilityBonus: number;        // Bonus for mode stability
  readonly transitionPenalty: number;     // Penalty for frequent transitions
  readonly policyCompliance: number;      // Bonus for following policies
}

/**
 * Energy Reward for Q-learning
 */
export class EnergyReward {
  constructor(
    public readonly energySavingsPercent: number,
    public readonly qosDegradationPercent: number,
    public readonly modeTransitions: number,
    public readonly policyComplied: boolean,
    public readonly coverageMaintained: boolean
  ) {
    // Immutability through readonly, no freeze needed
  }

  /**
   * Create from before/after metrics
   */
  static fromMetrics(before: {
    powerWatts: number;
    downlinkThroughput: number;
    uplinkThroughput: number;
    callSetupSuccess: number;
  }, after: {
    powerWatts: number;
    downlinkThroughput: number;
    uplinkThroughput: number;
    callSetupSuccess: number;
  }, action: EnergyAction, transitions: number): EnergyReward {
    const baselinePower = before.powerWatts;
    const currentPower = after.powerWatts;
    const energySavings = ((baselinePower - currentPower) / baselinePower) * 100;

    const dlDegradation = ((before.downlinkThroughput - after.downlinkThroughput) / before.downlinkThroughput) * 100;
    const ulDegradation = ((before.uplinkThroughput - after.uplinkThroughput) / before.uplinkThroughput) * 100;
    const qosDegradation = Math.max(dlDegradation, ulDegradation);

    const callSetupDelta = after.callSetupSuccess - before.callSetupSuccess;
    const coverageMaintained = callSetupDelta >= -1; // Allow 1% degradation

    return new EnergyReward(
      energySavings,
      qosDegradation,
      transitions,
      false, // Policy compliance determined externally
      coverageMaintained
    );
  }

  /**
   * Calculate total reward
   */
  total(): number {
    const components = this.calculateComponents();
    return Object.values(components).reduce((sum, value) => sum + value, 0);
  }

  /**
   * Calculate individual reward components
   */
  calculateComponents(): RewardComponents {
    // Energy savings: Positive reward (max +1.0 for 50%+ savings)
    const energySavings = Math.min(1.0, this.energySavingsPercent / 50);

    // QoS impact: Negative penalty (max -1.0 for 10%+ degradation)
    const qosImpact = this.qosDegradationPercent > 5
      ? -1.0
      : -(this.qosDegradationPercent / 5);

    // Stability bonus: Penalize frequent transitions (>10/hour)
    const transitionPenalty = this.modeTransitions > 10
      ? -((this.modeTransitions - 10) / 10)
      : 0;
    const stabilityBonus = this.modeTransitions < 5
      ? 0.2
      : 0;

    // Coverage bonus
    const coverageBonus = this.coverageMaintained ? 0.3 : -0.5;

    // Policy compliance bonus
    const policyCompliance = this.policyComplied ? 0.2 : 0;

    return {
      energySavings,
      qosImpact,
      stabilityBonus: stabilityBonus + transitionPenalty,
      transitionPenalty,
      policyCompliance: policyCompliance + coverageBonus
    };
  }

  /**
   * Check if reward meets success criteria
   */
  meetsSuccessCriteria(): {
    energySavings: boolean;
    qosImpact: boolean;
    stability: boolean;
    overall: boolean;
  } {
    const components = this.calculateComponents();

    return {
      energySavings: this.energySavingsPercent >= 30,
      qosImpact: this.qosDegradationPercent <= 5,
      stability: this.modeTransitions <= 10,
      overall: this.energySavingsPercent >= 30 &&
                this.qosDegradationPercent <= 5 &&
                this.modeTransitions <= 10
    };
  }

  /**
   * Get reward category for learning
   */
  getCategory(): 'excellent' | 'good' | 'acceptable' | 'poor' | 'failure' {
    const criteria = this.meetsSuccessCriteria();

    if (criteria.overall) {
      return this.energySavingsPercent >= 40 ? 'excellent' : 'good';
    }

    if (criteria.energySavings && criteria.qosImpact) {
      return 'acceptable';
    }

    if (this.qosDegradationPercent > 10 || !this.coverageMaintained) {
      return 'failure';
    }

    return 'poor';
  }

  /**
   * Calculate shaping reward for better convergence
   */
  shaped(): number {
    const total = this.total();
    const category = this.getCategory();

    // Apply shaping bonuses/penalties
    const shaping: Record<string, number> = {
      'excellent': 0.5,
      'good': 0.2,
      'acceptable': 0,
      'poor': -0.3,
      'failure': -1.0
    };

    return total + shaping[category];
  }

  toString(): string {
    const components = this.calculateComponents();
    const criteria = this.meetsSuccessCriteria();
    const category = this.getCategory();

    return `EnergyReward(savings=${this.energySavingsPercent.toFixed(1)}%, qos=${this.qosDegradationPercent.toFixed(1)}%, transitions=${this.modeTransitions}, category=${category}, success=${criteria.overall})`;
  }

  toJSON(): object {
    const components = this.calculateComponents();
    const criteria = this.meetsSuccessCriteria();

    return {
      energySavingsPercent: this.energySavingsPercent,
      qosDegradationPercent: this.qosDegradationPercent,
      modeTransitions: this.modeTransitions,
      policyComplied: this.policyComplied,
      coverageMaintained: this.coverageMaintained,
      components,
      criteria,
      category: this.getCategory(),
      totalReward: this.total()
    };
  }
}

/**
 * MIMO Sleep Reward (GOAL-008)
 */
export class MIMOSleepReward extends EnergyReward {
  constructor(
    energySavingsPercent: number,
    qosDegradationPercent: number,
    modeTransitions: number,
    policyComplied: boolean,
    coverageMaintained: boolean,
    public readonly antennaLayers: number, // Current active layers
    public readonly targetLayers: number   // Target layers
  ) {
    super(energySavingsPercent, qosDegradationPercent, modeTransitions, policyComplied, coverageMaintained);
  }

  /**
   * Create from MIMO-specific metrics
   */
  static fromMIMOMetrics(before: {
    powerWatts: number;
    antennaLayers: number;
    downlinkThroughput: number;
    callSetupSuccess: number;
  }, after: {
    powerWatts: number;
    antennaLayers: number;
    downlinkThroughput: number;
    callSetupSuccess: number;
  }, transitions: number): MIMOSleepReward {
    const base = EnergyReward.fromMetrics(
      {
        powerWatts: before.powerWatts,
        downlinkThroughput: before.downlinkThroughput,
        uplinkThroughput: before.downlinkThroughput * 0.3, // Estimate
        callSetupSuccess: before.callSetupSuccess
      },
      {
        powerWatts: after.powerWatts,
        downlinkThroughput: after.downlinkThroughput,
        uplinkThroughput: after.downlinkThroughput * 0.3,
        callSetupSuccess: after.callSetupSuccess
      },
      EnergyAction.MAINTAIN_CURRENT, // Placeholder
      transitions
    );

    return new MIMOSleepReward(
      base.energySavingsPercent,
      base.qosDegradationPercent,
      base.modeTransitions,
      base.policyComplied,
      base.coverageMaintained,
      after.antennaLayers,
      before.antennaLayers
    );
  }

  /**
   * Check if MIMO-specific success criteria met
   */
  meetsMIMOSuccess(): boolean {
    const base = this.meetsSuccessCriteria();
    const targetAchieved = this.antennaLayers === this.targetLayers;

    return base.overall && targetAchieved;
  }

  toString(): string {
    return `MIMOSleepReward(savings=${this.energySavingsPercent.toFixed(1)}%, layers=${this.antennaLayers}/${this.targetLayers}, qos=${this.qosDegradationPercent.toFixed(1)}%)`;
  }
}

/**
 * Cell Sleep Reward (GOAL-009)
 */
export class CellSleepReward extends EnergyReward {
  constructor(
    energySavingsPercent: number,
    qosDegradationPercent: number,
    modeTransitions: number,
    policyComplied: boolean,
    coverageMaintained: boolean,
    public readonly cellsActive: number,     // Currently active cells
    public readonly cellsSleeping: number,   // Currently sleeping cells
    public readonly totalCells: number       // Total cells in cluster
  ) {
    super(energySavingsPercent, qosDegradationPercent, modeTransitions, policyComplied, coverageMaintained);
  }

  /**
   * Create from cell-specific metrics
   */
  static fromCellMetrics(before: {
    clusterPowerWatts: number;
    activeCells: number;
    totalCells: number;
    downlinkThroughput: number;
    callSetupSuccess: number;
  }, after: {
    clusterPowerWatts: number;
    activeCells: number;
    totalCells: number;
    downlinkThroughput: number;
    callSetupSuccess: number;
  }, transitions: number): CellSleepReward {
    const base = EnergyReward.fromMetrics(
      {
        powerWatts: before.clusterPowerWatts,
        downlinkThroughput: before.downlinkThroughput,
        uplinkThroughput: before.downlinkThroughput * 0.3,
        callSetupSuccess: before.callSetupSuccess
      },
      {
        powerWatts: after.clusterPowerWatts,
        downlinkThroughput: after.downlinkThroughput,
        uplinkThroughput: after.downlinkThroughput * 0.3,
        callSetupSuccess: after.callSetupSuccess
      },
      EnergyAction.MAINTAIN_CURRENT,
      transitions
    );

    return new CellSleepReward(
      base.energySavingsPercent,
      base.qosDegradationPercent,
      base.modeTransitions,
      base.policyComplied,
      base.coverageMaintained,
      after.activeCells,
      after.totalCells - after.activeCells,
      after.totalCells
    );
  }

  /**
   * Check if cell-specific success criteria met
   */
  meetsCellSuccess(): boolean {
    const base = this.meetsSuccessCriteria();

    // GOAL-009: >40% energy reduction
    const energyTarget = this.energySavingsPercent >= 40;

    // Coverage maintained >99%
    const coverageTarget = this.coverageMaintained;

    return base.overall && energyTarget && coverageTarget;
  }

  /**
   * Get cell sleep ratio
   */
  getSleepRatio(): number {
    return this.cellsSleeping / this.totalCells;
  }

  toString(): string {
    return `CellSleepReward(savings=${this.energySavingsPercent.toFixed(1)}%, cells=${this.cellsActive}/${this.totalCells}, qos=${this.qosDegradationPercent.toFixed(1)}%)`;
  }
}
