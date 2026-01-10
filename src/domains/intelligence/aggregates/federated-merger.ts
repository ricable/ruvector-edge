/**
 * FederatedMerger Aggregate
 *
 * Manages federated learning between agents, merging Q-tables and trajectories
 * without centralizing data. Supports periodic and threshold-based merging.
 */

import { QTable } from './q-table';

export interface MergeConfig {
  readonly mergeIntervalMs: number;        // Time between merges (default: 60000)
  readonly interactionThreshold: number;   // Interactions before merge (default: 10)
  readonly minPeerConfidence: number;      // Minimum peer confidence to merge (default: 0.3)
}

export interface MergeRecord {
  readonly peerId: string;
  readonly timestamp: Date;
  readonly entriesMerged: number;
  readonly success: boolean;
}

/**
 * Domain Events for FederatedMerger
 */
export interface FederatedMergeStarted {
  readonly type: 'FederatedMergeStarted';
  readonly mergerId: string;
  readonly peerId: string;
  readonly timestamp: Date;
}

export interface FederatedMergeCompleted {
  readonly type: 'FederatedMergeCompleted';
  readonly mergerId: string;
  readonly peerId: string;
  readonly entriesMerged: number;
  readonly timestamp: Date;
}

export interface FederatedMergeFailed {
  readonly type: 'FederatedMergeFailed';
  readonly mergerId: string;
  readonly peerId: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export type FederatedMergerEvent = FederatedMergeStarted | FederatedMergeCompleted | FederatedMergeFailed;

/**
 * FederatedMerger Aggregate
 */
export class FederatedMerger {
  readonly id: string;
  readonly agentId: string;
  private _config: MergeConfig;
  private _lastMergeTime: Date;
  private _interactionsSinceLastMerge: number;
  private _mergeHistory: MergeRecord[];
  private _events: FederatedMergerEvent[];

  constructor(
    id: string,
    agentId: string,
    config: MergeConfig = {
      mergeIntervalMs: 60000,
      interactionThreshold: 10,
      minPeerConfidence: 0.3
    }
  ) {
    this.id = id;
    this.agentId = agentId;
    this._config = config;
    this._lastMergeTime = new Date();
    this._interactionsSinceLastMerge = 0;
    this._mergeHistory = [];
    this._events = [];
  }

  /**
   * Record an interaction (for threshold-based merging)
   */
  recordInteraction(): void {
    this._interactionsSinceLastMerge++;
  }

  /**
   * Check if merge should be triggered
   */
  shouldMerge(): boolean {
    const timeSinceLastMerge = Date.now() - this._lastMergeTime.getTime();

    // Check time-based trigger
    if (timeSinceLastMerge >= this._config.mergeIntervalMs) {
      return true;
    }

    // Check interaction-based trigger
    if (this._interactionsSinceLastMerge >= this._config.interactionThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Merge local Q-table with peer Q-table
   */
  merge(localQTable: QTable, peerQTable: QTable, peerConfidence: number = 1.0): boolean {
    // Check minimum confidence
    if (peerConfidence < this._config.minPeerConfidence) {
      this.raise({
        type: 'FederatedMergeFailed',
        mergerId: this.id,
        peerId: peerQTable.agentId,
        reason: `Peer confidence ${peerConfidence} below threshold ${this._config.minPeerConfidence}`,
        timestamp: new Date()
      });
      return false;
    }

    this.raise({
      type: 'FederatedMergeStarted',
      mergerId: this.id,
      peerId: peerQTable.agentId,
      timestamp: new Date()
    });

    try {
      const beforeCount = localQTable.entryCount;
      localQTable.merge(peerQTable);
      const afterCount = localQTable.entryCount;
      const entriesMerged = afterCount - beforeCount + peerQTable.entryCount;

      // Record merge
      this._mergeHistory.push({
        peerId: peerQTable.agentId,
        timestamp: new Date(),
        entriesMerged,
        success: true
      });

      // Keep only last 100 records
      if (this._mergeHistory.length > 100) {
        this._mergeHistory = this._mergeHistory.slice(-100);
      }

      // Reset counters
      this._lastMergeTime = new Date();
      this._interactionsSinceLastMerge = 0;

      this.raise({
        type: 'FederatedMergeCompleted',
        mergerId: this.id,
        peerId: peerQTable.agentId,
        entriesMerged,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this._mergeHistory.push({
        peerId: peerQTable.agentId,
        timestamp: new Date(),
        entriesMerged: 0,
        success: false
      });

      this.raise({
        type: 'FederatedMergeFailed',
        mergerId: this.id,
        peerId: peerQTable.agentId,
        reason: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });

      return false;
    }
  }

  /**
   * Get merge statistics
   */
  getStats(): {
    totalMerges: number;
    successfulMerges: number;
    failedMerges: number;
    successRate: number;
    avgEntriesMerged: number;
    timeSinceLastMerge: number;
  } {
    const successful = this._mergeHistory.filter(r => r.success);
    const failed = this._mergeHistory.filter(r => !r.success);

    return {
      totalMerges: this._mergeHistory.length,
      successfulMerges: successful.length,
      failedMerges: failed.length,
      successRate: this._mergeHistory.length > 0
        ? successful.length / this._mergeHistory.length
        : 0,
      avgEntriesMerged: successful.length > 0
        ? successful.reduce((sum, r) => sum + r.entriesMerged, 0) / successful.length
        : 0,
      timeSinceLastMerge: Date.now() - this._lastMergeTime.getTime()
    };
  }

  /**
   * Get recent merge history
   */
  getRecentMerges(count: number = 10): MergeRecord[] {
    return this._mergeHistory.slice(-count);
  }

  private raise(event: FederatedMergerEvent): void {
    this._events.push(event);
  }

  // Getters
  get lastMergeTime(): Date { return this._lastMergeTime; }
  get interactionsSinceLastMerge(): number { return this._interactionsSinceLastMerge; }
  get mergeHistory(): ReadonlyArray<MergeRecord> { return this._mergeHistory; }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): FederatedMergerEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  /**
   * Identity equality
   */
  equals(other: FederatedMerger): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const stats = this.getStats();
    return `FederatedMerger(${this.id}, merges=${stats.totalMerges}, rate=${(stats.successRate * 100).toFixed(1)}%)`;
  }
}
