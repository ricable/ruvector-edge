/**
 * Energy State Value Object
 *
 * Q-learning state representation for energy optimization decisions.
 * Encodes traffic load, time of day, active UEs, and current mode.
 */

export type TrafficLoad = 'low' | 'medium' | 'high';
export type TimeOfDay = 'night' | 'morning' | 'afternoon' | 'evening';
export type MIMOMode = 'full_mimo' | 'partial_sleep' | 'deep_sleep';
export type CellState = 'active' | 'partial_sleep' | 'deep_sleep' | 'hibernate';

export interface EnergyStateVector {
  readonly trafficLoad: TrafficLoad;
  readonly timeOfDay: TimeOfDay;
  readonly activeUEs: number;
  readonly currentMode: MIMOMode | CellState;
  readonly energyConsumption: number; // watts
  readonly qosIndex: number; // 0-100
}

/**
 * Energy State for Q-learning
 */
export class EnergyState {
  constructor(
    public readonly trafficLoad: TrafficLoad,
    public readonly timeOfDay: TimeOfDay,
    public readonly activeUEs: number,
    public readonly currentMode: MIMOMode | CellState,
    public readonly energyConsumption: number,
    public readonly qosIndex: number
  ) {
    // Immutability through readonly, no freeze needed
  }

  /**
   * Create state from real-time metrics
   */
  static fromMetrics(metrics: {
    trafficLoadPercent: number;
    hour: number;
    activeUEs: number;
    currentPowerWatts: number;
    downlinkThroughput: number;
    uplinkThroughput: number;
    callSetupSuccess: number;
  }): EnergyState {
    const trafficLoad = EnergyState.categorizeTraffic(metrics.trafficLoadPercent);
    const timeOfDay = EnergyState.categorizeTime(metrics.hour);
    const qosIndex = EnergyState.calculateQoS(
      metrics.downlinkThroughput,
      metrics.uplinkThroughput,
      metrics.callSetupSuccess
    );

    return new EnergyState(
      trafficLoad,
      timeOfDay,
      metrics.activeUEs,
      'full_mimo', // Default, will be updated by current mode
      metrics.currentPowerWatts,
      qosIndex
    );
  }

  /**
   * Categorize traffic load
   */
  private static categorizeTraffic(percent: number): TrafficLoad {
    if (percent < 20) return 'low';
    if (percent < 60) return 'medium';
    return 'high';
  }

  /**
   * Categorize time of day
   */
  private static categorizeTime(hour: number): TimeOfDay {
    if (hour >= 0 && hour < 6) return 'night';
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  }

  /**
   * Calculate QoS index (0-100)
   */
  private static calculateQoS(
    dlThroughput: number,
    ulThroughput: number,
    callSetupSuccess: number
  ): number {
    // Weighted QoS calculation
    const throughputScore = Math.min(100, (dlThroughput + ulThroughput) / 10);
    const successScore = callSetupSuccess;
    return Math.round(throughputScore * 0.6 + successScore * 0.4);
  }

  /**
   * Encode state for Q-table lookup
   */
  encode(): string {
    return `${this.trafficLoad}:${this.timeOfDay}:${this.UEBucket()}:${this.currentMode}`;
  }

  /**
   * Bucket active UEs for discrete state space
   */
  private UEBucket(): string {
    if (this.activeUEs === 0) return '0';
    if (this.activeUEs <= 5) return '1-5';
    if (this.activeUEs <= 10) return '6-10';
    if (this.activeUEs <= 20) return '11-20';
    if (this.activeUEs <= 50) return '21-50';
    return '50+';
  }

  /**
   * Check if state is low traffic (candidate for sleep)
   */
  isLowTraffic(): boolean {
    return this.trafficLoad === 'low' && this.activeUEs < 10;
  }

  /**
   * Check if state is high traffic (should wake up)
   */
  isHighTraffic(): boolean {
    return this.trafficLoad === 'high' || this.activeUEs > 50;
  }

  /**
   * Check if QoS is degraded
   */
  isQoSDegraded(): boolean {
    return this.qosIndex < 90;
  }

  /**
   * Value equality
   */
  equals(other: EnergyState): boolean {
    return this.encode() === other.encode();
  }

  /**
   * Similarity measure (0-1)
   */
  similarity(other: EnergyState): number {
    let score = 0;
    if (this.trafficLoad === other.trafficLoad) score += 0.3;
    if (this.timeOfDay === other.timeOfDay) score += 0.2;
    if (this.currentMode === other.currentMode) score += 0.3;
    score += 0.2 * (1 - Math.abs(this.qosIndex - other.qosIndex) / 100);
    return score;
  }

  toString(): string {
    return `EnergyState(${this.trafficLoad}, ${this.timeOfDay}, UEs=${this.activeUEs}, mode=${this.currentMode}, qos=${this.qosIndex})`;
  }

  toJSON(): object {
    return {
      trafficLoad: this.trafficLoad,
      timeOfDay: this.timeOfDay,
      activeUEs: this.activeUEs,
      currentMode: this.currentMode,
      energyConsumption: this.energyConsumption,
      qosIndex: this.qosIndex
    };
  }
}

/**
 * MIMO Sleep State (GOAL-008)
 */
export class MIMOSleepState extends EnergyState {
  constructor(
    trafficLoad: TrafficLoad,
    timeOfDay: TimeOfDay,
    activeUEs: number,
    currentMode: MIMOMode,
    energyConsumption: number,
    qosIndex: number,
    public readonly antennaLayers: number, // 2x2, 4x4, 8x8
    public readonly sleepThreshold: number // dBm
  ) {
    super(trafficLoad, timeOfDay, activeUEs, currentMode, energyConsumption, qosIndex);
  }

  /**
   * Create from feature agent state
   */
  static fromFeatureAgent(metrics: {
    trafficLoadPercent: number;
    hour: number;
    activeUEs: number;
    currentPowerWatts: number;
    antennaLayers: number;
    sleepThreshold: number;
    downlinkThroughput: number;
    uplinkThroughput?: number;
    callSetupSuccess: number;
  }): MIMOSleepState {
    const baseState = EnergyState.fromMetrics({
      ...metrics,
      uplinkThroughput: metrics.uplinkThroughput ?? metrics.downlinkThroughput * 0.3
    });

    return new MIMOSleepState(
      baseState.trafficLoad,
      baseState.timeOfDay,
      baseState.activeUEs,
      'full_mimo', // Will be updated
      baseState.energyConsumption,
      baseState.qosIndex,
      metrics.antennaLayers,
      metrics.sleepThreshold
    );
  }

  /**
   * Check if partial sleep is viable
   */
  canEnablePartialSleep(): boolean {
    return (
      this.trafficLoad === 'low' &&
      this.activeUEs < 20 &&
      this.qosIndex >= 95 &&
      this.antennaLayers >= 4
    );
  }

  /**
   * Check if deep sleep is viable
   */
  canEnableDeepSleep(): boolean {
    return (
      this.trafficLoad === 'low' &&
      this.activeUEs < 5 &&
      this.qosIndex >= 99 &&
      (this.timeOfDay === 'night' || this.timeOfDay === 'morning')
    );
  }

  /**
   * Check if should wake to full MIMO
   */
  shouldWakeFullMIMO(): boolean {
    return (
      this.trafficLoad === 'high' ||
      this.activeUEs > 20 ||
      this.qosIndex < 90
    );
  }

  toString(): string {
    return `MIMOSleepState(${this.trafficLoad}, ${this.timeOfDay}, UEs=${this.activeUEs}, mode=${this.currentMode}, layers=${this.antennaLayers}x${this.antennaLayers})`;
  }
}

/**
 * Cell Sleep State (GOAL-009)
 */
export class CellSleepState extends EnergyState {
  constructor(
    trafficLoad: TrafficLoad,
    timeOfDay: TimeOfDay,
    activeUEs: number,
    currentMode: CellState,
    energyConsumption: number,
    qosIndex: number,
    public readonly cellType: 'macro' | 'micro' | 'pico',
    public readonly isPrimary: boolean,
    public readonly campingUEs: number
  ) {
    super(trafficLoad, timeOfDay, activeUEs, currentMode, energyConsumption, qosIndex);
  }

  /**
   * Create from cell metrics
   */
  static fromCellMetrics(metrics: {
    trafficLoadPercent: number;
    hour: number;
    activeUEs: number;
    campingUEs: number;
    currentPowerWatts: number;
    cellType: 'macro' | 'micro' | 'pico';
    isPrimary: boolean;
    downlinkThroughput: number;
    uplinkThroughput?: number;
    callSetupSuccess: number;
  }): CellSleepState {
    const baseState = EnergyState.fromMetrics({
      ...metrics,
      uplinkThroughput: metrics.uplinkThroughput ?? metrics.downlinkThroughput * 0.3
    });

    return new CellSleepState(
      baseState.trafficLoad,
      baseState.timeOfDay,
      baseState.activeUEs,
      'active',
      baseState.energyConsumption,
      baseState.qosIndex,
      metrics.cellType,
      metrics.isPrimary,
      metrics.campingUEs
    );
  }

  /**
   * Check if cell can enter partial sleep
   */
  canPartialSleep(): boolean {
    // Secondary cells with low traffic
    return (
      !this.isPrimary &&
      this.trafficLoad === 'low' &&
      this.campingUEs < 10 &&
      this.qosIndex >= 95
    );
  }

  /**
   * Check if cell can enter deep sleep
   */
  canDeepSleep(): boolean {
    // Night time with very low traffic
    return (
      !this.isPrimary &&
      this.trafficLoad === 'low' &&
      this.campingUEs === 0 &&
      this.timeOfDay === 'night' &&
      this.qosIndex >= 99
    );
  }

  /**
   * Check if cell can hibernate
   */
  canHibernate(): boolean {
    return (
      this.cellType === 'pico' &&
      this.trafficLoad === 'low' &&
      this.campingUEs === 0 &&
      (this.timeOfDay === 'night' || this.timeOfDay === 'afternoon')
    );
  }

  /**
   * Check if should wake immediately
   */
  shouldWakeImmediate(): boolean {
    return (
      this.trafficLoad === 'high' ||
      this.campingUEs > 20 ||
      this.qosIndex < 90
    );
  }

  toString(): string {
    return `CellSleepState(${this.trafficLoad}, ${this.timeOfDay}, UEs=${this.activeUEs}, camping=${this.campingUEs}, type=${this.cellType}, primary=${this.isPrimary})`;
  }
}
