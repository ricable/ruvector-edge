/**
 * GOAL-006 Workflow Coordinator
 *
 * Orchestrates Handover Success Rate Optimization across 48 Mobility agents.
 * Coordinates parallel OALA cycles with federated Q-learning.
 *
 * Target: Achieve >99.5% handover success rate (from current 94.0%)
 *
 * Key Features (48 agents):
 * - A3 Event Handover (FAJ 121 3001)
 * - A5 Event Handover (FAJ 121 3002)
 * - Automatic Neighbor Relation (FAJ 121 3010)
 * - Smart Handover Control (FAJ 121 3015)
 * - Ping-Pong Timer (FAJ 121 3020)
 * - Cell Individual Offset (FAJ 121 3025)
 */

import { HandoverOptimizer, HandoverMetrics, OALAOutcome, HandoverRootCause } from './handover-optimizer';
import { QTable } from '../../intelligence/aggregates/q-table';
import { Counter } from '../../knowledge/value-objects/counter';
import { KPI } from '../../knowledge/value-objects/kpi';

/**
 * Mobility Agent Features (48 agents)
 */
export const MOBILITY_AGENTS = [
  { fajeCode: 'FAJ 121 3001', name: 'A3 Event Handover', priority: 'HIGH' },
  { fajeCode: 'FAJ 121 3002', name: 'A5 Event Handover', priority: 'HIGH' },
  { fajeCode: 'FAJ 121 3010', name: 'Automatic Neighbor Relation', priority: 'MEDIUM' },
  { fajeCode: 'FAJ 121 3015', name: 'Smart Handover Control', priority: 'HIGH' },
  { fajeCode: 'FAJ 121 3020', name: 'Ping-Pong Timer', priority: 'HIGH' },
  { fajeCode: 'FAJ 121 3025', name: 'Cell Individual Offset', priority: 'MEDIUM' }
  // ... 42 more mobility agents
];

/**
 * Cell configuration for optimization
 */
export interface CellConfiguration {
  readonly cellId: string;
  readonly siteName: string;
  readonly rat: 'LTE' | 'NR';
  readonly frequencyBand: number;
  readonly initialParameters: {
    readonly a3Offset: number;
    readonly hysteresis: number;
    readonly timeToTrigger: number;
    readonly pingPongTimer: number;
    readonly cellIndividualOffset: number;
  };
}

/**
 * Federated Learning Configuration
 */
export interface FederatedLearningConfig {
  readonly enabled: boolean;
  readonly syncInterval: number;        // milliseconds (default: 60000 = 1 min)
  readonly minInteractions: number;     // Minimum interactions before sync (default: 10)
  readonly mergeStrategy: 'weighted' | 'average' | 'max';
}

/**
 * GOAL-006 Workflow Coordinator
 */
export class Goal006Coordinator {
  readonly id: string;
  private _optimizers: Map<string, HandoverOptimizer>;
  private _qTables: Map<string, QTable>;
  private _federatedConfig: FederatedLearningConfig;
  private _cells: CellConfiguration[];
  private _startTime: Date;
  private _completedCycles: number;
  private _outcomes: Map<string, OALAOutcome>;

  constructor(
    id: string,
    cells: CellConfiguration[],
    federatedConfig: FederatedLearningConfig = {
      enabled: true,
      syncInterval: 60000,
      minInteractions: 10,
      mergeStrategy: 'weighted'
    }
  ) {
    this.id = id;
    this._cells = cells;
    this._federatedConfig = federatedConfig;
    this._optimizers = new Map();
    this._qTables = new Map();
    this._startTime = new Date();
    this._completedCycles = 0;
    this._outcomes = new Map();

    this.initializeOptimizers();
  }

  /**
   * Factory method
   */
  static create(cells: CellConfiguration[], federatedConfig?: FederatedLearningConfig): Goal006Coordinator {
    const id = `goal006-coord-${Date.now()}`;
    return new Goal006Coordinator(id, cells, federatedConfig);
  }

  /**
   * Initialize optimizers for all cells
   */
  private initializeOptimizers(): void {
    for (const cell of this._cells) {
      // Create Q-table for this cell
      const qTable = new QTable(
        `qtable-${cell.cellId}`,
        `agent-${cell.cellId}`,
        { gamma: 0.95, alpha: 0.1, epsilon: 0.1 }
      );
      this._qTables.set(cell.cellId, qTable);

      // Create optimizer
      const optimizer = HandoverOptimizer.create(
        cell.cellId,
        qTable,
        cell.initialParameters,
        10 // max cycles
      );
      this._optimizers.set(cell.cellId, optimizer);
    }
  }

  /**
   * Execute OALA cycle for all cells (parallel)
   */
  async executeParallelCycle(counters: Map<string, Counter[]>, kpis: Map<string, KPI[]>): Promise<Map<string, OALAOutcome>> {
    const outcomes = new Map<string, OALAOutcome>();

    // Execute OALA cycle for each cell in parallel
    const promises = Array.from(this._optimizers.entries()).map(
      async ([cellId, optimizer]) => {
        const cellCounters = counters.get(cellId) ?? [];
        const cellKPIs = kpis.get(cellId) ?? [];

        return { cellId, outcome: await this.executeCellCycle(optimizer, cellCounters, cellKPIs) };
      }
    );

    const results = await Promise.all(promises);

    // Collect outcomes
    for (const { cellId, outcome } of results) {
      outcomes.set(cellId, outcome);
      this._outcomes.set(cellId, outcome);
    }

    this._completedCycles++;

    // Perform federated learning sync
    if (this._federatedConfig.enabled) {
      await this.performFederatedSync();
    }

    return outcomes;
  }

  /**
   * Execute OALA cycle for a single cell
   */
  private async executeCellCycle(
    optimizer: HandoverOptimizer,
    counters: Counter[],
    kpis: KPI[]
  ): Promise<OALAOutcome> {
    let maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations && optimizer.phase !== 'Completed') {
      switch (optimizer.phase) {
        case 'OBSERVE':
          optimizer.observe(counters);
          break;

        case 'ANALYZE':
          optimizer.analyze(counters, kpis);
          break;

        case 'LEARN':
          optimizer.learn();
          break;

        case 'ADAPT':
          optimizer.adapt();
          break;

        case 'Completed':
        case 'RolledBack':
          // Exit loop
          break;
      }

      iteration++;

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return optimizer.calculateOutcome();
  }

  /**
   * Perform federated learning sync across all cells
   *
   * Merges Q-tables from all cells using weighted averaging:
   * merged_q = (local_q * local_visits + peer_q * peer_visits) / total_visits
   */
  private async performFederatedSync(): Promise<void> {
    const qTableArray = Array.from(this._qTables.values());

    if (qTableArray.length < 2) return;

    // Merge each Q-table with all others
    for (let i = 0; i < qTableArray.length; i++) {
      for (let j = i + 1; j < qTableArray.length; j++) {
        // Bidirectional merge
        qTableArray[i].merge(qTableArray[j]);
        qTableArray[j].merge(qTableArray[i]);
      }
    }

    console.log(`[GOAL-006] Federated sync completed across ${qTableArray.length} cells`);
  }

  /**
   * Execute continuous optimization loop
   *
   * Runs OALA cycles continuously until:
   * - All cells meet success criteria, OR
   * - Maximum cycles reached, OR
   * - Manual stop requested
   */
  async executeContinuousOptimization(
    countersProvider: (cellId: string) => Counter[],
    kpisProvider: (cellId: string) => KPI[],
    maxCycles: number = 100,
    cycleDelay: number = 15000 // 15 seconds between cycles
  ): Promise<Map<string, OALAOutcome>> {
    console.log(`[GOAL-006] Starting continuous optimization (${maxCycles} cycles max)`);

    for (let cycle = 0; cycle < maxCycles; cycle++) {
      console.log(`[GOAL-006] Cycle ${cycle + 1}/${maxCycles}`);

      // Collect counters and KPIs for all cells
      const counters = new Map<string, Counter[]>();
      const kpis = new Map<string, KPI[]>();

      for (const cell of this._cells) {
        counters.set(cell.cellId, countersProvider(cell.cellId));
        kpis.set(cell.cellId, kpisProvider(cell.cellId));
      }

      // Execute parallel cycle
      const outcomes = await this.executeParallelCycle(counters, kpis);

      // Check if all cells have met success criteria
      const allMet = Array.from(outcomes.values()).every(o => o.success);
      if (allMet) {
        console.log('[GOAL-006] All cells met success criteria!');
        break;
      }

      // Wait before next cycle
      if (cycle < maxCycles - 1) {
        await new Promise(resolve => setTimeout(resolve, cycleDelay));
      }
    }

    return this._outcomes;
  }

  /**
   * Get aggregate statistics across all cells
   */
  getAggregateStatistics(): {
    totalCells: number;
    completedCells: number;
    averageHOSuccessRate: number;
    averagePingPongRate: number;
    cellsMeetingCriteria: number;
    cellsNeedingRollback: number;
  } {
    const outcomes = Array.from(this._outcomes.values());
    const completed = outcomes.filter(o => o !== undefined).length;

    if (completed === 0) {
      return {
        totalCells: this._cells.length,
        completedCells: 0,
        averageHOSuccessRate: 0,
        averagePingPongRate: 0,
        cellsMeetingCriteria: 0,
        cellsNeedingRollback: 0
      };
    }

    const avgSuccessRate = outcomes.reduce((sum, o) => sum + o.finalMetrics.hoSuccessRate, 0) / completed;
    const avgPingPongRate = outcomes.reduce((sum, o) => sum + o.finalMetrics.pingPongRate, 0) / completed;
    const meetingCriteria = outcomes.filter(o => o.success).length;
    const needingRollback = outcomes.filter(o => o.rollbackTriggered).length;

    return {
      totalCells: this._cells.length,
      completedCells: completed,
      averageHOSuccessRate: avgSuccessRate,
      averagePingPongRate: avgPingPongRate,
      cellsMeetingCriteria: meetingCriteria,
      cellsNeedingRollback: needingRollback
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getAggregateStatistics();
    const duration = Date.now() - this._startTime.getTime();
    const durationMinutes = Math.round(duration / 60000);

    let report = `
╔══════════════════════════════════════════════════════════════════════╗
║                    GOAL-006 EXECUTION REPORT                          ║
║            Handover Success Rate Optimization (48 Agents)              ║
╚══════════════════════════════════════════════════════════════════════╝

Execution Summary
─────────────────
  Coordinator ID:      ${this.id}
  Duration:            ${durationMinutes} minutes
  Cycles Completed:    ${this._completedCycles}
  Total Cells:         ${stats.totalCells}
  Completed Cells:     ${stats.completedCells}

Target vs Actual
─────────────────
  Target HO Success:   >99.5%
  Actual HO Success:   ${stats.averageHOSuccessRate.toFixed(2)}%
  Target Ping-Pong:    <1.0%
  Actual Ping-Pong:    ${stats.averagePingPongRate.toFixed(2)}%

Success Criteria
─────────────────
  Cells Meeting Target: ${stats.cellsMeetingCriteria}/${stats.totalCells}
  Rollbacks Triggered:  ${stats.cellsNeedingRollback}/${stats.totalCells}

Per-Cell Results
─────────────────
`;

    for (const [cellId, outcome] of this._outcomes) {
      if (!outcome) continue;

      report += `
  ${cellId}:
    HO Success:     ${outcome.finalMetrics.hoSuccessRate.toFixed(2)}% (Δ${outcome.hoSuccessRateDelta.toFixed(2)}%)
    Ping-Pong:      ${outcome.finalMetrics.pingPongRate.toFixed(2)}% (Δ${outcome.pingPongRateDelta.toFixed(2)}%)
    Cycles:         ${outcome.cyclesCompleted}
    Status:         ${outcome.success ? '✓ SUCCESS' : '✗ IN PROGRESS'}
`;
    }

    report += `
╔══════════════════════════════════════════════════════════════════════╗
║  GOAL-006: ${stats.cellsMeetingCriteria >= stats.totalCells * 0.95 ? '✓ ACHIEVED' : '⚠ IN PROGRESS'}                                          ║
╚══════════════════════════════════════════════════════════════════════╝
`;

    return report;
  }

  /**
   * Get all Q-tables for persistence
   */
  getAllQTables(): Map<string, QTable> {
    return new Map(this._qTables);
  }

  /**
   * Load Q-tables from external source
   */
  loadQTables(qTables: Map<string, QTable>): void {
    for (const [cellId, qTable] of qTables) {
      if (this._qTables.has(cellId)) {
        this._qTables.set(cellId, qTable);
      }
    }
  }

  // Getters
  get optimizers(): ReadonlyMap<string, HandoverOptimizer> { return this._optimizers; }
  get qTables(): ReadonlyMap<string, QTable> { return this._qTables; }
  get outcomes(): ReadonlyMap<string, OALAOutcome> { return this._outcomes; }
  get completedCycles(): number { return this._completedCycles; }

  equals(other: Goal006Coordinator): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `Goal006Coordinator(${this.id}, cells=${this._cells.length}, cycles=${this._completedCycles})`;
  }
}

/**
 * Helper function to create mock cell configurations for testing
 */
export function createMockCellConfigs(count: number = 48): CellConfiguration[] {
  const configs: CellConfiguration[] = [];

  for (let i = 0; i < count; i++) {
    configs.push({
      cellId: `Cell-${i + 1}`,
      siteName: `Site-${Math.floor(i / 3) + 1}`,
      rat: i % 2 === 0 ? 'LTE' : 'NR',
      frequencyBand: 1800 + (i % 10) * 100,
      initialParameters: {
        a3Offset: 0,
        hysteresis: 2,
        timeToTrigger: 320,
        pingPongTimer: 10,
        cellIndividualOffset: 0
      }
    });
  }

  return configs;
}

/**
 * Helper function to create mock counters for testing
 */
export function createMockCounters(cellId: string): Counter[] {
  return [
    { name: 'pmHoExeSucc', value: 9400, category: 'Primary', unit: 'count' },
    { name: 'pmHoExeAtt', value: 10000, category: 'Primary', unit: 'count' },
    { name: 'pmHoFail', value: 600, category: 'Primary', unit: 'count' },
    { name: 'pmHoPingPong', value: 150, category: 'Secondary', unit: 'count' }
  ];
}

/**
 * Helper function to create mock KPIs for testing
 */
export function createMockKPIs(cellId: string): KPI[] {
  return [
    {
      name: 'HO Success Rate',
      value: 94.0,
      unit: '%',
      threshold: 99.5,
      status: 'degraded',
      category: 'mobility'
    },
    {
      name: 'Ping-Pong Rate',
      value: 1.5,
      unit: '%',
      threshold: 1.0,
      status: 'degraded',
      category: 'mobility'
    }
  ];
}
