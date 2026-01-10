/**
 * P2P Transport
 * Peer-to-peer transport layer for edge-first architecture
 *
 * Transport options:
 * - GUN.js for browser-to-browser communication
 * - WebRTC for direct peer connections
 * - No central server required
 *
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 */

import type { AgentId } from '../../../core/types/ids.js';
import type { Timestamp } from '../../../core/types/interfaces.js';

export interface IP2PConfig {
  /** Node ID */
  nodeId: string;
  /** GUN.js relay URLs (optional) */
  gunRelays?: string[];
  /** WebRTC STUN servers */
  stunServers?: string[];
  /** Connection timeout in ms */
  connectionTimeout?: number;
}

export interface IP2PMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: string;
  payload: unknown;
  timestamp: Timestamp;
}

export interface IPeerInfo {
  peerId: string;
  connected: boolean;
  lastSeen: Timestamp;
  transport: 'gun' | 'webrtc' | 'local';
}

type MessageHandler = (message: IP2PMessage) => void;

/**
 * P2PTransport provides peer-to-peer messaging
 */
export class P2PTransport {
  private readonly config: Required<IP2PConfig>;
  private readonly peers: Map<string, IPeerInfo>;
  private readonly messageHandlers: MessageHandler[];
  private readonly messageQueue: IP2PMessage[];
  private connected: boolean;
  private messageCounter: number;

  constructor(config: IP2PConfig) {
    this.config = {
      nodeId: config.nodeId,
      gunRelays: config.gunRelays ?? ['https://gun-manhattan.herokuapp.com/gun'],
      stunServers: config.stunServers ?? ['stun:stun.l.google.com:19302'],
      connectionTimeout: config.connectionTimeout ?? 10000,
    };

    this.peers = new Map();
    this.messageHandlers = [];
    this.messageQueue = [];
    this.connected = false;
    this.messageCounter = 0;
  }

  /**
   * Connect to P2P network
   */
  async connect(): Promise<void> {
    // In production: Initialize GUN.js and/or WebRTC
    // This is a simplified implementation for the architecture

    this.connected = true;

    // Process queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.deliverMessage(message);
      }
    }
  }

  /**
   * Disconnect from P2P network
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.peers.clear();
  }

  /**
   * Send message to a specific peer
   */
  async send(peerId: string, type: string, payload: unknown): Promise<void> {
    const message: IP2PMessage = {
      id: this.generateMessageId(),
      from: this.config.nodeId,
      to: peerId,
      type,
      payload,
      timestamp: Date.now(),
    };

    if (!this.connected) {
      this.messageQueue.push(message);
      return;
    }

    await this.deliverMessage(message);
  }

  /**
   * Broadcast message to all peers
   */
  async broadcast(type: string, payload: unknown): Promise<void> {
    const message: IP2PMessage = {
      id: this.generateMessageId(),
      from: this.config.nodeId,
      to: 'broadcast',
      type,
      payload,
      timestamp: Date.now(),
    };

    if (!this.connected) {
      this.messageQueue.push(message);
      return;
    }

    // Send to all connected peers
    for (const peer of this.peers.values()) {
      if (peer.connected) {
        await this.deliverMessage({ ...message, to: peer.peerId });
      }
    }
  }

  /**
   * Subscribe to incoming messages
   */
  subscribe(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index !== -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming message from network
   */
  handleIncomingMessage(message: IP2PMessage): void {
    // Verify message is for us
    if (message.to !== this.config.nodeId && message.to !== 'broadcast') {
      return;
    }

    // Update peer info
    const peerInfo = this.peers.get(message.from);
    if (peerInfo) {
      peerInfo.lastSeen = Date.now();
    }

    // Notify handlers
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    }
  }

  /**
   * Add a peer
   */
  addPeer(peerId: string, transport: 'gun' | 'webrtc' | 'local' = 'local'): void {
    this.peers.set(peerId, {
      peerId,
      connected: true,
      lastSeen: Date.now(),
      transport,
    });
  }

  /**
   * Remove a peer
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  /**
   * Get connected peers
   */
  getPeers(): IPeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get connected peer IDs
   */
  getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Check if connected to network
   */
  isConnected(): boolean {
    return this.connected;
  }

  private async deliverMessage(message: IP2PMessage): Promise<void> {
    // In production: Send via GUN.js or WebRTC
    // For local testing, directly invoke handler on target peer
    const targetPeer = this.peers.get(message.to as string);
    if (!targetPeer || !targetPeer.connected) {
      console.warn(`Peer ${message.to} not connected`);
      return;
    }

    // Simulate network delivery
    // In production: Use actual transport
  }

  private generateMessageId(): string {
    this.messageCounter++;
    return `${this.config.nodeId}-${Date.now()}-${this.messageCounter}`;
  }

  /**
   * Get transport statistics
   */
  getStats(): {
    nodeId: string;
    connected: boolean;
    peerCount: number;
    queuedMessages: number;
    totalMessagesSent: number;
  } {
    return {
      nodeId: this.config.nodeId,
      connected: this.connected,
      peerCount: this.peers.size,
      queuedMessages: this.messageQueue.length,
      totalMessagesSent: this.messageCounter,
    };
  }
}
