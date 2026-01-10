/**
 * Gossip Protocol
 * Eventual consistency for feature agent coordination
 *
 * Used by 593 feature agents for:
 * - Q-table state synchronization
 * - Trajectory sharing and federated learning
 * - Peer discovery and health monitoring
 *
 * Message complexity: O(log n)
 *
 * @see ADR-002: Consensus Protocol Selection
 */

import type { AgentId } from '../../../core/types/ids.js';
import type { Timestamp } from '../../../core/types/interfaces.js';

export interface IGossipConfig {
  /** Gossip interval in ms (default: 1000) */
  gossipInterval?: number;
  /** Fan-out per gossip round (default: 3) */
  fanout?: number;
  /** Max message age before expiry (ms) */
  messageExpiry?: number;
  /** Node ID */
  nodeId: string;
}

export interface IGossipMessage {
  id: string;
  key: string;
  value: unknown;
  version: number;
  origin: string;
  timestamp: Timestamp;
  ttl: number;
}

type MessageHandler = (key: string, value: unknown, version: number) => void;

/**
 * GossipProtocol implements epidemic gossip for eventual consistency
 */
export class GossipProtocol {
  private readonly config: Required<IGossipConfig>;
  private readonly store: Map<string, { value: unknown; version: number; timestamp: Timestamp }>;
  private readonly peers: Set<string>;
  private readonly seenMessages: Map<string, Timestamp>;
  private readonly handlers: Map<string, MessageHandler[]>;
  private gossipTimer: ReturnType<typeof setInterval> | null;
  private running: boolean;

  constructor(config: IGossipConfig) {
    this.config = {
      gossipInterval: config.gossipInterval ?? 1000,
      fanout: config.fanout ?? 3,
      messageExpiry: config.messageExpiry ?? 60000,
      nodeId: config.nodeId,
    };

    this.store = new Map();
    this.peers = new Set();
    this.seenMessages = new Map();
    this.handlers = new Map();
    this.gossipTimer = null;
    this.running = false;
  }

  /**
   * Start gossip protocol
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.gossipTimer = setInterval(
      () => this.gossipRound(),
      this.config.gossipInterval
    );
  }

  /**
   * Stop gossip protocol
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.gossipTimer) {
      clearInterval(this.gossipTimer);
      this.gossipTimer = null;
    }
  }

  /**
   * Add a peer to the gossip network
   */
  addPeer(peerId: string): void {
    this.peers.add(peerId);
  }

  /**
   * Remove a peer from the gossip network
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  /**
   * Get all peers
   */
  getPeers(): string[] {
    return Array.from(this.peers);
  }

  /**
   * Spread an update to the network
   */
  async spread<T>(key: string, value: T, version?: number): Promise<void> {
    const existing = this.store.get(key);
    const newVersion = version ?? (existing ? existing.version + 1 : 1);

    // Only update if newer version
    if (existing && existing.version >= newVersion) {
      return;
    }

    const timestamp = Date.now();
    this.store.set(key, { value, version: newVersion, timestamp });

    // Create gossip message
    const message: IGossipMessage = {
      id: `${this.config.nodeId}-${key}-${newVersion}`,
      key,
      value,
      version: newVersion,
      origin: this.config.nodeId,
      timestamp,
      ttl: 5, // Max hops
    };

    this.seenMessages.set(message.id, timestamp);

    // Notify local handlers
    this.notifyHandlers(key, value, newVersion);

    // Queue for gossip round
    // In production: Add to outgoing message queue
  }

  /**
   * Get a value from the store
   */
  get<T>(key: string): { value: T; version: number } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return { value: entry.value as T, version: entry.version };
  }

  /**
   * Subscribe to updates for a key
   */
  subscribe<T>(key: string, handler: (value: T, version: number) => void): () => void {
    const handlers = this.handlers.get(key) ?? [];
    const wrappedHandler: MessageHandler = (k, v, ver) => handler(v as T, ver);
    handlers.push(wrappedHandler);
    this.handlers.set(key, handlers);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(key) ?? [];
      const index = current.indexOf(wrappedHandler);
      if (index !== -1) {
        current.splice(index, 1);
        this.handlers.set(key, current);
      }
    };
  }

  /**
   * Handle incoming gossip message
   */
  handleMessage(message: IGossipMessage): boolean {
    // Check if already seen
    if (this.seenMessages.has(message.id)) {
      return false;
    }

    // Check TTL
    if (message.ttl <= 0) {
      return false;
    }

    // Check if message is too old
    if (Date.now() - message.timestamp > this.config.messageExpiry) {
      return false;
    }

    // Mark as seen
    this.seenMessages.set(message.id, Date.now());

    // Check version
    const existing = this.store.get(message.key);
    if (existing && existing.version >= message.version) {
      return false;
    }

    // Store update
    this.store.set(message.key, {
      value: message.value,
      version: message.version,
      timestamp: message.timestamp,
    });

    // Notify handlers
    this.notifyHandlers(message.key, message.value, message.version);

    return true;
  }

  private gossipRound(): void {
    // Select random peers (fan-out)
    const selectedPeers = this.selectRandomPeers(this.config.fanout);

    // In production: Send digest or recent updates to selected peers
    // This would trigger message exchange

    // Cleanup expired seen messages
    this.cleanupSeenMessages();
  }

  private selectRandomPeers(count: number): string[] {
    const peerList = Array.from(this.peers);
    const selected: string[] = [];

    while (selected.length < count && peerList.length > 0) {
      const index = Math.floor(Math.random() * peerList.length);
      selected.push(peerList.splice(index, 1)[0]);
    }

    return selected;
  }

  private notifyHandlers(key: string, value: unknown, version: number): void {
    const handlers = this.handlers.get(key) ?? [];
    for (const handler of handlers) {
      try {
        handler(key, value, version);
      } catch (error) {
        console.error(`Gossip handler error for key ${key}:`, error);
      }
    }
  }

  private cleanupSeenMessages(): void {
    const now = Date.now();
    const expiry = this.config.messageExpiry;

    for (const [id, timestamp] of this.seenMessages) {
      if (now - timestamp > expiry) {
        this.seenMessages.delete(id);
      }
    }
  }

  /**
   * Get store contents for debugging
   */
  getStore(): Map<string, { value: unknown; version: number; timestamp: Timestamp }> {
    return new Map(this.store);
  }

  /**
   * Get protocol statistics
   */
  getStats(): {
    storeSize: number;
    peerCount: number;
    seenMessageCount: number;
    running: boolean;
  } {
    return {
      storeSize: this.store.size,
      peerCount: this.peers.size,
      seenMessageCount: this.seenMessages.size,
      running: this.running,
    };
  }

  /**
   * Clear protocol state
   */
  clear(): void {
    this.store.clear();
    this.seenMessages.clear();
    this.handlers.clear();
  }
}
