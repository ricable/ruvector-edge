/**
 * Sync Coordinator
 * Coordinates P2P synchronization between agents
 */

import type { PeerQTableInfo, StateActionKey, QValueEntry } from '../types';
import { QTable } from '../q-learning/q-table';
import { FederatedMerger, compressEntries, decompressEntries } from './federated-merger';

/** Sync message types */
export type SyncMessageType = 'announce' | 'request' | 'response' | 'delta';

/** Sync message structure */
export interface SyncMessage {
  type: SyncMessageType;
  senderId: string;
  version: number;
  timestamp: number;
  payload?: Uint8Array;
}

/** Peer connection info */
export interface PeerConnection {
  peerId: string;
  lastSeen: number;
  version: number;
  isOnline: boolean;
}

/** Sync coordinator configuration */
export interface SyncCoordinatorConfig {
  announceIntervalMs: number;    // How often to announce version
  staleThresholdMs: number;      // When to consider peer stale
  maxPeers: number;              // Maximum peers to track
  autoSync: boolean;             // Automatically sync on announce
}

const DEFAULT_CONFIG: SyncCoordinatorConfig = {
  announceIntervalMs: 30000,  // 30 seconds
  staleThresholdMs: 120000,   // 2 minutes
  maxPeers: 20,
  autoSync: true,
};

/**
 * SyncCoordinator manages P2P sync protocol
 */
export class SyncCoordinator {
  private readonly config: SyncCoordinatorConfig;
  private readonly agentId: string;
  private readonly qTable: QTable;
  private readonly merger: FederatedMerger;
  private readonly peers: Map<string, PeerConnection>;
  private announceTimer: ReturnType<typeof setInterval> | null;
  private messageHandler: ((message: SyncMessage) => void) | null;
  private sendHandler: ((peerId: string, message: SyncMessage) => void) | null;

  constructor(
    agentId: string,
    qTable: QTable,
    merger: FederatedMerger,
    config: Partial<SyncCoordinatorConfig> = {}
  ) {
    this.agentId = agentId;
    this.qTable = qTable;
    this.merger = merger;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.peers = new Map();
    this.announceTimer = null;
    this.messageHandler = null;
    this.sendHandler = null;
  }

  /**
   * Start sync coordination
   */
  start(): void {
    if (this.announceTimer !== null) {
      return;
    }

    this.announceTimer = setInterval(() => {
      this.announceVersion();
      this.cleanupStalePeers();
    }, this.config.announceIntervalMs);

    // Initial announce
    this.announceVersion();
  }

  /**
   * Stop sync coordination
   */
  stop(): void {
    if (this.announceTimer !== null) {
      clearInterval(this.announceTimer);
      this.announceTimer = null;
    }
  }

  /**
   * Set message handler for incoming messages
   */
  onMessage(handler: (message: SyncMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Set send handler for outgoing messages
   */
  onSend(handler: (peerId: string, message: SyncMessage) => void): void {
    this.sendHandler = handler;
  }

  /**
   * Handle incoming sync message
   */
  handleMessage(message: SyncMessage): void {
    // Update peer info
    this.updatePeer(message.senderId, message.version);

    switch (message.type) {
      case 'announce':
        this.handleAnnounce(message);
        break;
      case 'request':
        this.handleRequest(message);
        break;
      case 'response':
        this.handleResponse(message);
        break;
      case 'delta':
        this.handleDelta(message);
        break;
    }

    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  /**
   * Handle version announcement from peer
   */
  private handleAnnounce(message: SyncMessage): void {
    const peerVersion = message.version;
    const lastKnown = this.merger.getPeerVersion(message.senderId);

    // Request update if peer has newer version
    if (this.config.autoSync && (lastKnown === undefined || peerVersion > lastKnown)) {
      this.requestUpdate(message.senderId, lastKnown ?? 0);
    }
  }

  /**
   * Handle update request from peer
   */
  private handleRequest(message: SyncMessage): void {
    if (!message.payload) {
      return;
    }

    // Decode the since timestamp from payload
    const decoder = new TextDecoder();
    const since = parseInt(decoder.decode(message.payload), 10);

    // Create delta with entries since requested timestamp
    const delta = this.merger.createDelta(this.qTable, since);

    if (delta.size > 0) {
      this.sendDelta(message.senderId, delta);
    }
  }

  /**
   * Handle full response from peer
   */
  private handleResponse(message: SyncMessage): void {
    if (!message.payload) {
      return;
    }

    const entries = decompressEntries(message.payload);
    const peerInfo: PeerQTableInfo = {
      agentId: message.senderId,
      version: message.version,
      entries,
      lastSync: message.timestamp,
    };

    this.merger.merge(this.qTable, peerInfo);
  }

  /**
   * Handle delta update from peer
   */
  private handleDelta(message: SyncMessage): void {
    if (!message.payload) {
      return;
    }

    const entries = decompressEntries(message.payload);
    const peerInfo: PeerQTableInfo = {
      agentId: message.senderId,
      version: message.version,
      entries,
      lastSync: message.timestamp,
    };

    this.merger.merge(this.qTable, peerInfo);
  }

  /**
   * Announce current version to all peers
   */
  announceVersion(): void {
    const message: SyncMessage = {
      type: 'announce',
      senderId: this.agentId,
      version: this.qTable.getVersion(),
      timestamp: Date.now(),
    };

    this.broadcast(message);
  }

  /**
   * Request update from specific peer
   */
  requestUpdate(peerId: string, since: number = 0): void {
    const encoder = new TextEncoder();
    const message: SyncMessage = {
      type: 'request',
      senderId: this.agentId,
      version: this.qTable.getVersion(),
      timestamp: Date.now(),
      payload: encoder.encode(since.toString()),
    };

    this.sendToPeer(peerId, message);
  }

  /**
   * Send delta to specific peer
   */
  sendDelta(peerId: string, entries: Map<StateActionKey, QValueEntry>): void {
    const message: SyncMessage = {
      type: 'delta',
      senderId: this.agentId,
      version: this.qTable.getVersion(),
      timestamp: Date.now(),
      payload: compressEntries(entries),
    };

    this.sendToPeer(peerId, message);
  }

  /**
   * Send message to specific peer
   */
  private sendToPeer(peerId: string, message: SyncMessage): void {
    if (this.sendHandler) {
      this.sendHandler(peerId, message);
    }
  }

  /**
   * Broadcast message to all known peers
   */
  private broadcast(message: SyncMessage): void {
    for (const [peerId, connection] of this.peers) {
      if (connection.isOnline && peerId !== this.agentId) {
        this.sendToPeer(peerId, message);
      }
    }
  }

  /**
   * Update peer connection info
   */
  private updatePeer(peerId: string, version: number): void {
    this.peers.set(peerId, {
      peerId,
      lastSeen: Date.now(),
      version,
      isOnline: true,
    });

    // Trim peers if over limit
    if (this.peers.size > this.config.maxPeers) {
      this.trimOldestPeers();
    }
  }

  /**
   * Clean up stale peers
   */
  private cleanupStalePeers(): void {
    const now = Date.now();

    for (const [, connection] of this.peers) {
      if (now - connection.lastSeen > this.config.staleThresholdMs) {
        connection.isOnline = false;
      }
    }
  }

  /**
   * Trim oldest peers to stay under limit
   */
  private trimOldestPeers(): void {
    const sorted = Array.from(this.peers.entries())
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen);

    while (this.peers.size > this.config.maxPeers) {
      const oldest = sorted.shift();
      if (oldest) {
        this.peers.delete(oldest[0]);
      }
    }
  }

  /**
   * Get all known peers
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get online peers
   */
  getOnlinePeers(): PeerConnection[] {
    return this.getPeers().filter(p => p.isOnline);
  }

  /**
   * Mark peer as discovered
   */
  addPeer(peerId: string): void {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        peerId,
        lastSeen: Date.now(),
        version: 0,
        isOnline: true,
      });
    }
  }

  /**
   * Remove peer
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    totalPeers: number;
    onlinePeers: number;
    localVersion: number;
    isRunning: boolean;
  } {
    return {
      totalPeers: this.peers.size,
      onlinePeers: this.getOnlinePeers().length,
      localVersion: this.qTable.getVersion(),
      isRunning: this.announceTimer !== null,
    };
  }
}
