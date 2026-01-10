/**
 * P2P Coordination Service - Agent-to-Agent Communication
 *
 * Implements peer-to-peer messaging for agent coordination without central coordinator.
 * Message types: query, response, sync (federated learning), heartbeat
 *
 * Features:
 * - P2P query routing via dependency graph
 * - Q-table synchronization for federated learning
 * - Liveness detection (5s heartbeat interval)
 * - Message queue for reliability
 */

import { DependencyRouter, RoutingPath } from '../../domains/coordination/entities/dependency-router';
import { AgentRuntime } from '../wasm/agent-runtime';

export type MessageType = 'query' | 'response' | 'sync' | 'heartbeat';

export interface P2PMessage {
  id: string;
  type: MessageType;
  fromFajCode: string;
  toFajCode: string;
  content: any;
  timestamp: number;
  ttl: number; // Time-to-live in hops
}

export interface P2PQueryMessage extends P2PMessage {
  type: 'query';
  content: {
    queryText: string;
    state: string;
    availableActions: string[];
  };
}

export interface P2PResponseMessage extends P2PMessage {
  type: 'response';
  content: {
    responseText: string;
    confidence: number;
    latencyMs: number;
    action: string;
  };
}

export interface P2PSyncMessage extends P2PMessage {
  type: 'sync';
  content: {
    qTableEntries: Array<{ key: string; value: number }>;
    weight: number; // Merge weight for federated learning
  };
}

export interface P2PHeartbeat extends P2PMessage {
  type: 'heartbeat';
  content: {
    status: string;
    health: number;
    confidence: number;
  };
}

/**
 * P2P Coordination Service - Manages agent-to-agent communication
 */
export class P2PCoordination {
  private static instance: P2PCoordination;
  private router: DependencyRouter;
  private runtime: AgentRuntime;
  private messageQueue: P2PMessage[] = [];
  private deliveryHistory: Map<string, P2PMessage> = new Map();
  private peerHeartbeats: Map<string, number> = new Map(); // fajCode -> lastHeartbeatTime
  private heartbeatInterval = 5000; // 5s
  private heartbeatTimeout = 15000; // 15s
  private maxQueueSize = 1000;

  private constructor() {
    this.router = DependencyRouter.getInstance();
    this.runtime = AgentRuntime.getInstance();
    this.startHeartbeatMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): P2PCoordination {
    if (!P2PCoordination.instance) {
      P2PCoordination.instance = new P2PCoordination();
    }
    return P2PCoordination.instance;
  }

  /**
   * Initialize coordination with feature list
   */
  async initialize(features: any[]): Promise<void> {
    console.log('[P2PCoordination] Initializing with feature dependency graph...');
    this.router.buildGraph(features);

    const stats = this.router.getGraphStats();
    console.log(
      `[P2PCoordination] Initialized: ${stats.totalNodes} features, ` +
      `${stats.totalEdges} dependencies, ${stats.categories.length} categories`
    );
  }

  /**
   * Route and execute query through P2P network
   * Returns aggregated response from primary and peer agents
   */
  async routeQuery(
    sourceFajCode: string,
    queryText: string,
    queryType: string = 'default'
  ): Promise<{
    primaryResponse: any;
    peerResponses: any[];
    routingPath: RoutingPath;
    totalLatencyMs: number;
  }> {
    const startTime = performance.now();

    try {
      // Get routing path through dependency graph
      const routingPath = this.router.routeQuery(sourceFajCode, queryType);

      console.log(
        `[P2PCoordination] Routed query from ${sourceFajCode} through ${routingPath.fajCodes.length} agents`
      );

      // Execute query on primary agent
      const primaryResponse = await this.runtime.handleQuery({
        agentId: this.getFajCodeToAgentId(sourceFajCode),
        content: queryText,
        state: 'default',
        availableActions: ['DirectAnswer', 'ConsultPeer'],
      });

      // Consult peer agents if confidence is low or needed
      const peerResponses: any[] = [];
      if (primaryResponse.confidence < 0.7 && routingPath.fajCodes.length > 1) {
        const peers = this.router.findPeersForAgent(sourceFajCode, 2);

        for (const peer of peers) {
          try {
            const peerResponse = await this.runtime.handleQuery({
              agentId: this.getFajCodeToAgentId(peer.fajCode),
              content: queryText,
              state: 'peer_consultation',
              availableActions: ['DirectAnswer'],
            });

            peerResponses.push({
              fajCode: peer.fajCode,
              response: peerResponse,
              distance: peer.distance,
              weight: peer.weight,
            });
          } catch (error) {
            console.warn(
              `[P2PCoordination] Failed to consult peer ${peer.fajCode}:`,
              error
            );
          }
        }
      }

      const totalLatency = performance.now() - startTime;

      return {
        primaryResponse,
        peerResponses,
        routingPath,
        totalLatencyMs: totalLatency,
      };
    } catch (error) {
      console.error(
        `[P2PCoordination] Query routing failed for ${sourceFajCode}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send P2P message to peer agent
   */
  async sendMessage(message: P2PMessage): Promise<void> {
    try {
      // Add to queue
      if (this.messageQueue.length >= this.maxQueueSize) {
        // Remove oldest message
        this.messageQueue.shift();
      }
      this.messageQueue.push(message);

      // Track delivery
      this.deliveryHistory.set(message.id, message);

      console.log(
        `[P2PCoordination] Queued ${message.type} message from ` +
        `${message.fromFajCode} to ${message.toFajCode}`
      );

      // Process immediately if low TTL (direct message)
      if (message.ttl <= 1) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('[P2PCoordination] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all reachable peers
   */
  async broadcastMessage(fromFajCode: string, messageType: MessageType, content: any): Promise<void> {
    try {
      const peers = this.router.findPeersForAgent(fromFajCode, 10);

      console.log(
        `[P2PCoordination] Broadcasting ${messageType} message to ${peers.length} peers`
      );

      for (const peer of peers) {
        const message: P2PMessage = {
          id: `${fromFajCode}:${peer.fajCode}:${Date.now()}`,
          type: messageType,
          fromFajCode,
          toFajCode: peer.fajCode,
          content,
          timestamp: Date.now(),
          ttl: 2,
        };

        await this.sendMessage(message);
      }
    } catch (error) {
      console.error('[P2PCoordination] Broadcast failed:', error);
      throw error;
    }
  }

  /**
   * Process message from queue
   */
  private async processMessage(message: P2PMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'query':
          await this.handleQueryMessage(message as P2PQueryMessage);
          break;
        case 'response':
          await this.handleResponseMessage(message as P2PResponseMessage);
          break;
        case 'sync':
          await this.handleSyncMessage(message as P2PSyncMessage);
          break;
        case 'heartbeat':
          await this.handleHeartbeat(message as P2PHeartbeat);
          break;
        default:
          console.warn(`[P2PCoordination] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`[P2PCoordination] Message processing failed:`, error);
    }
  }

  /**
   * Handle query message from peer
   */
  private async handleQueryMessage(message: P2PQueryMessage): Promise<void> {
    try {
      const agentId = this.getFajCodeToAgentId(message.toFajCode);
      const response = await this.runtime.handleQuery({
        agentId,
        content: message.content.queryText,
        state: message.content.state,
        availableActions: message.content.availableActions,
      });

      // Send response back
      const responseMessage: P2PResponseMessage = {
        id: `resp:${message.id}`,
        type: 'response',
        fromFajCode: message.toFajCode,
        toFajCode: message.fromFajCode,
        content: {
          responseText: response.content,
          confidence: response.confidence,
          latencyMs: response.latencyMs,
          action: response.action,
        },
        timestamp: Date.now(),
        ttl: 1,
      };

      await this.sendMessage(responseMessage);
    } catch (error) {
      console.error(
        `[P2PCoordination] Query handling failed for ${message.toFajCode}:`,
        error
      );
    }
  }

  /**
   * Handle response message from peer
   */
  private async handleResponseMessage(message: P2PResponseMessage): Promise<void> {
    // In real implementation, would aggregate responses
    console.log(
      `[P2PCoordination] Received response from ${message.fromFajCode} ` +
      `(confidence: ${message.content.confidence.toFixed(2)})`
    );
  }

  /**
   * Handle Q-table synchronization message (federated learning)
   */
  private async handleSyncMessage(message: P2PSyncMessage): Promise<void> {
    try {
      const agentId = this.getFajCodeToAgentId(message.toFajCode);
      // In real implementation, would update Q-table with federated learning merge
      console.log(
        `[P2PCoordination] Syncing Q-table from ${message.fromFajCode} ` +
        `to ${message.toFajCode} (${message.content.qTableEntries.length} entries)`
      );
    } catch (error) {
      console.error('[P2PCoordination] Sync handling failed:', error);
    }
  }

  /**
   * Handle heartbeat message
   */
  private async handleHeartbeat(message: P2PHeartbeat): Promise<void> {
    this.peerHeartbeats.set(message.fromFajCode, Date.now());
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      const deadPeers: string[] = [];

      for (const [fajCode, lastHeartbeat] of this.peerHeartbeats.entries()) {
        if (now - lastHeartbeat > this.heartbeatTimeout) {
          deadPeers.push(fajCode);
        }
      }

      if (deadPeers.length > 0) {
        console.warn(
          `[P2PCoordination] Detected ${deadPeers.length} dead peers: ${deadPeers.join(', ')}`
        );
      }
    }, this.heartbeatInterval);
  }

  /**
   * Get message queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    historySize: number;
    alivePeers: number;
    deadPeers: number;
  } {
    const now = Date.now();
    let alivePeers = 0;
    let deadPeers = 0;

    for (const [_, lastHeartbeat] of this.peerHeartbeats.entries()) {
      if (now - lastHeartbeat < this.heartbeatTimeout) {
        alivePeers += 1;
      } else {
        deadPeers += 1;
      }
    }

    return {
      queueSize: this.messageQueue.length,
      historySize: this.deliveryHistory.size,
      alivePeers,
      deadPeers,
    };
  }

  /**
   * Get routing graph statistics
   */
  getGraphStats(): any {
    return this.router.getGraphStats();
  }

  /**
   * Clear message queue and history
   */
  clearQueues(): void {
    this.messageQueue = [];
    this.deliveryHistory.clear();
    console.log('[P2PCoordination] Cleared message queues');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Convert FAJ code to agent ID
   * In real implementation, would use actual mapping
   */
  private getFajCodeToAgentId(fajCode: string): string {
    return `agent-${fajCode.toLowerCase().replace(/\s+/g, '-')}`;
  }
}
