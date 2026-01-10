/**
 * Federated Merger
 * P2P weighted Q-table merging with confidence calculation
 */

import type {
  StateActionKey,
  QValueEntry,
  PeerQTableInfo,
  MergeResult,
  FederatedConfig,
  FederatedMergeEvent,
  MergeTrigger,
} from '../types';
import { QTable } from '../q-learning/q-table';

const DEFAULT_CONFIG: FederatedConfig = {
  mergeTrigger: {
    timeBased: 60,   // 60 seconds
    eventBased: 10,  // 10 interactions
  },
  significanceThreshold: 0.05, // 5% difference required to merge
  minConfidence: 0.5,          // Minimum 50% confidence
  deltaCompression: true,
};

/** Event callback for federated merge events */
export type FederatedEventCallback = (event: FederatedMergeEvent) => void;

/**
 * FederatedMerger handles P2P Q-table synchronization
 * using weighted averaging based on visit counts
 */
export class FederatedMerger {
  private readonly config: FederatedConfig;
  private readonly agentId: string;
  private lastSyncTime: number;
  private interactionsSinceSync: number;
  private eventListeners: FederatedEventCallback[];
  private peerVersions: Map<string, number>;

  constructor(agentId: string, config: Partial<FederatedConfig> = {}) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastSyncTime = Date.now();
    this.interactionsSinceSync = 0;
    this.eventListeners = [];
    this.peerVersions = new Map();
  }

  /**
   * Calculate confidence from visit count
   * confidence = 1 - 1 / (visits + 1)
   */
  calculateConfidence(visits: number): number {
    return 1 - 1 / (visits + 1);
  }

  /**
   * Check if merge should be triggered
   */
  shouldSync(): boolean {
    const timeSinceSync = (Date.now() - this.lastSyncTime) / 1000;
    const timeTriggered = timeSinceSync >= this.config.mergeTrigger.timeBased;
    const eventTriggered = this.interactionsSinceSync >= this.config.mergeTrigger.eventBased;

    return timeTriggered || eventTriggered;
  }

  /**
   * Record an interaction (for event-based triggering)
   */
  recordInteraction(): void {
    this.interactionsSinceSync++;
  }

  /**
   * Merge peer Q-table into local Q-table
   * merged_q = (local_q * local_visits + peer_q * peer_visits) / (local_visits + peer_visits)
   */
  merge(localQTable: QTable, peerInfo: PeerQTableInfo): MergeResult[] {
    const results: MergeResult[] = [];
    const localEntries = localQTable.getAllEntries();
    let mergedCount = 0;
    let skippedCount = 0;

    // Process peer entries
    for (const [key, peerEntry] of peerInfo.entries) {
      const localEntry = localEntries.get(key);

      // Skip if peer confidence is too low
      const peerConfidence = this.calculateConfidence(peerEntry.visits);
      if (peerConfidence < this.config.minConfidence) {
        skippedCount++;
        continue;
      }

      if (localEntry !== undefined) {
        // Both have the entry - check if merge is needed
        // Note: localConfidence could be used for more sophisticated merge strategies
        // const localConfidence = this.calculateConfidence(localEntry.visits);

        // Check significance threshold
        const difference = Math.abs(localEntry.value - peerEntry.value);
        const avgValue = (Math.abs(localEntry.value) + Math.abs(peerEntry.value)) / 2 || 1;
        const relativeChange = difference / avgValue;

        if (relativeChange < this.config.significanceThreshold) {
          skippedCount++;
          continue;
        }

        // Weighted average merge
        const totalVisits = localEntry.visits + peerEntry.visits;
        const mergedValue = (
          localEntry.value * localEntry.visits +
          peerEntry.value * peerEntry.visits
        ) / totalVisits;

        // Update local Q-table
        const { state, action } = localQTable.getEncoder().decodeStateAction(key);
        localQTable.setQValue(state, action, mergedValue, peerEntry.visits);

        results.push({
          stateActionKey: key,
          localValue: localEntry.value,
          peerValue: peerEntry.value,
          mergedValue,
          localVisits: localEntry.visits,
          peerVisits: peerEntry.visits,
          totalVisits,
          confidence: this.calculateConfidence(totalVisits),
        });
        mergedCount++;
      } else {
        // Only peer has the entry - adopt if confidence is sufficient
        if (peerConfidence >= this.config.minConfidence) {
          const { state, action } = localQTable.getEncoder().decodeStateAction(key);
          localQTable.setQValue(state, action, peerEntry.value, peerEntry.visits);

          results.push({
            stateActionKey: key,
            localValue: 0,
            peerValue: peerEntry.value,
            mergedValue: peerEntry.value,
            localVisits: 0,
            peerVisits: peerEntry.visits,
            totalVisits: peerEntry.visits,
            confidence: peerConfidence,
          });
          mergedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    // Update sync tracking
    this.lastSyncTime = Date.now();
    this.interactionsSinceSync = 0;
    this.peerVersions.set(peerInfo.agentId, peerInfo.version);

    // Emit merge event
    this.emitEvent({
      type: 'federated_merge',
      timestamp: Date.now(),
      agentId: this.agentId,
      peerId: peerInfo.agentId,
      mergedEntries: mergedCount,
      skippedEntries: skippedCount,
    });

    return results;
  }

  /**
   * Create delta update for sync
   * Only includes entries modified since peer's last known version
   */
  createDelta(localQTable: QTable, peerLastSync: number): Map<StateActionKey, QValueEntry> {
    if (this.config.deltaCompression) {
      return localQTable.getEntriesSince(peerLastSync);
    }
    return localQTable.getAllEntries();
  }

  /**
   * Create peer info from Q-table for sharing
   */
  createPeerInfo(qTable: QTable): PeerQTableInfo {
    return {
      agentId: qTable.getAgentId(),
      version: qTable.getVersion(),
      entries: qTable.getAllEntries(),
      lastSync: Date.now(),
    };
  }

  /**
   * Get last known version for a peer
   */
  getPeerVersion(peerId: string): number | undefined {
    return this.peerVersions.get(peerId);
  }

  /**
   * Check if peer has newer version
   */
  isPeerNewer(peerId: string, peerVersion: number): boolean {
    const lastKnown = this.peerVersions.get(peerId);
    return lastKnown === undefined || peerVersion > lastKnown;
  }

  /**
   * Add event listener
   */
  addEventListener(callback: FederatedEventCallback): void {
    this.eventListeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: FederatedEventCallback): void {
    const index = this.eventListeners.indexOf(callback);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: FederatedMergeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in federated merge event listener:', error);
      }
    }
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    lastSyncTime: number;
    timeSinceSync: number;
    interactionsSinceSync: number;
    peersKnown: number;
    mergeTrigger: MergeTrigger;
  } {
    return {
      lastSyncTime: this.lastSyncTime,
      timeSinceSync: (Date.now() - this.lastSyncTime) / 1000,
      interactionsSinceSync: this.interactionsSinceSync,
      peersKnown: this.peerVersions.size,
      mergeTrigger: this.config.mergeTrigger,
    };
  }

  /**
   * Reset sync timing
   */
  resetSync(): void {
    this.lastSyncTime = Date.now();
    this.interactionsSinceSync = 0;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }
}

/**
 * Compress Q-table entries for network transmission
 * Uses simple delta encoding
 */
export function compressEntries(
  entries: Map<StateActionKey, QValueEntry>
): Uint8Array {
  const data = JSON.stringify(Array.from(entries.entries()));
  const encoder = new TextEncoder();
  return encoder.encode(data);
}

/**
 * Decompress Q-table entries
 */
export function decompressEntries(
  compressed: Uint8Array
): Map<StateActionKey, QValueEntry> {
  const decoder = new TextDecoder();
  const data = decoder.decode(compressed);
  const entries = JSON.parse(data) as Array<[StateActionKey, QValueEntry]>;
  return new Map(entries);
}
