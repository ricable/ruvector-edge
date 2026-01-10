/**
 * Swarm Coordinator
 * Hybrid topology coordinator for 593 feature agents
 *
 * Topology: Coordinator Cluster (Raft) + Feature Swarms (Gossip)
 * - 14 category coordinators running Raft consensus
 * - 593 feature agents organized into category-based Gossip networks
 *
 * @see ADR-001: Swarm Topology Selection
 */

import type { AgentId, FAJCode } from '../../../core/types/ids.js';
import type { Query, Timestamp, Vector } from '../../../core/types/interfaces.js';
import { Category, SwarmTopology } from '../../../core/types/enums.js';
import { SemanticRouter, IRoutingResult } from '../semantic-router/semantic-router.js';
import { RaftConsensus } from '../consensus/raft-consensus.js';
import { GossipProtocol } from '../consensus/gossip-protocol.js';

export interface ISwarmCoordinatorConfig {
  /** Swarm topology (default: hybrid) */
  topology?: SwarmTopology;
  /** Maximum agents (default: 1000) */
  maxAgents?: number;
  /** Number of category coordinators (default: 14) */
  coordinatorCount?: number;
  /** Gossip interval in ms (default: 1000) */
  gossipInterval?: number;
  /** Raft election timeout in ms (default: 150) */
  raftElectionTimeout?: number;
  /** Coordinator node ID */
  nodeId: string;
}

export interface ICategoryCoordinatorInfo {
  category: Category;
  agentCount: number;
  isLeader: boolean;
}

export interface ISwarmHealth {
  activeAgents: number;
  healthyAgents: number;
  coordinatorStatus: ICategoryCoordinatorInfo[];
  lastGossipRound: Timestamp;
  consensusReady: boolean;
  topology: SwarmTopology;
}

interface AgentInfo {
  agentId: AgentId;
  fajCode: FAJCode;
  category: Category;
  healthy: boolean;
  lastHeartbeat: Timestamp;
}

/**
 * SwarmCoordinator manages the hybrid topology
 */
export class SwarmCoordinator {
  private readonly config: Required<ISwarmCoordinatorConfig>;
  private readonly router: SemanticRouter;
  private readonly agents: Map<string, AgentInfo>;
  private readonly categoryAgents: Map<Category, Set<AgentId>>;
  private readonly categoryConsensus: Map<Category, RaftConsensus>;
  private readonly gossip: GossipProtocol;
  private lastGossipRound: Timestamp;
  private running: boolean;

  constructor(config: ISwarmCoordinatorConfig) {
    this.config = {
      topology: config.topology ?? SwarmTopology.Hybrid,
      maxAgents: config.maxAgents ?? 1000,
      coordinatorCount: config.coordinatorCount ?? 14,
      gossipInterval: config.gossipInterval ?? 1000,
      raftElectionTimeout: config.raftElectionTimeout ?? 150,
      nodeId: config.nodeId,
    };

    this.router = new SemanticRouter();
    this.agents = new Map();
    this.categoryAgents = new Map();
    this.categoryConsensus = new Map();
    this.gossip = new GossipProtocol({
      nodeId: config.nodeId,
      gossipInterval: this.config.gossipInterval,
    });
    this.lastGossipRound = Date.now();
    this.running = false;

    // Initialize category maps
    for (const category of Object.values(Category)) {
      this.categoryAgents.set(category, new Set());
    }
  }

  /**
   * Initialize the swarm coordinator
   */
  async initialize(): Promise<void> {
    // Start Raft consensus for each category
    for (const category of Object.values(Category)) {
      const raft = new RaftConsensus({
        nodeId: `${this.config.nodeId}-${category}`,
        peers: [], // In production: Other coordinators for same category
        electionTimeoutMin: this.config.raftElectionTimeout,
        electionTimeoutMax: this.config.raftElectionTimeout * 2,
      });
      this.categoryConsensus.set(category, raft);
      raft.start();
    }

    // Start gossip protocol
    this.gossip.start();
    this.running = true;
  }

  /**
   * Shutdown the swarm coordinator
   */
  async shutdown(): Promise<void> {
    this.running = false;

    // Stop all Raft instances
    for (const raft of this.categoryConsensus.values()) {
      raft.stop();
    }

    // Stop gossip
    this.gossip.stop();
  }

  /**
   * Register an agent to the swarm
   */
  async registerAgent(
    agentId: AgentId,
    fajCode: FAJCode,
    category: Category,
    embedding: Vector
  ): Promise<void> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Maximum agent limit (${this.config.maxAgents}) reached`);
    }

    // Store agent info
    const agentInfo: AgentInfo = {
      agentId,
      fajCode,
      category,
      healthy: true,
      lastHeartbeat: Date.now(),
    };
    this.agents.set(agentId, agentInfo);

    // Add to category
    const categorySet = this.categoryAgents.get(category);
    categorySet?.add(agentId);

    // Add to semantic router
    await this.router.addAgent(agentId, fajCode, category, embedding);

    // Spread registration via gossip
    await this.gossip.spread(`agent:${agentId}`, {
      fajCode,
      category,
      registered: true,
    });
  }

  /**
   * Unregister an agent from the swarm
   */
  async unregisterAgent(agentId: AgentId): Promise<void> {
    const agentInfo = this.agents.get(agentId);
    if (!agentInfo) return;

    // Remove from category
    const categorySet = this.categoryAgents.get(agentInfo.category);
    categorySet?.delete(agentId);

    // Remove from semantic router
    await this.router.removeAgent(agentId);

    // Remove from agents map
    this.agents.delete(agentId);

    // Spread unregistration via gossip
    await this.gossip.spread(`agent:${agentId}`, {
      registered: false,
    });
  }

  /**
   * Route a query to appropriate agents
   */
  async routeQuery(query: Query, k: number = 5): Promise<IRoutingResult> {
    if (!query.embedding) {
      throw new Error('Query must have embedding for routing');
    }

    return this.router.route(query.embedding, k);
  }

  /**
   * Route query to specific category
   */
  async routeToCategory(
    query: Query,
    category: Category,
    k: number = 5
  ): Promise<IRoutingResult> {
    if (!query.embedding) {
      throw new Error('Query must have embedding for routing');
    }

    return this.router.routeToCategory(query.embedding, category, k);
  }

  /**
   * Update agent heartbeat
   */
  recordHeartbeat(agentId: AgentId): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      agent.healthy = true;
    }
  }

  /**
   * Get agents in a category
   */
  getAgentsByCategory(category: Category): AgentId[] {
    const categorySet = this.categoryAgents.get(category);
    return categorySet ? Array.from(categorySet) : [];
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): AgentId[] {
    return Array.from(this.agents.keys()) as AgentId[];
  }

  /**
   * Get category coordinator info
   */
  getCategoryCoordinator(category: Category): ICategoryCoordinatorInfo | undefined {
    const raft = this.categoryConsensus.get(category);
    const agentSet = this.categoryAgents.get(category);

    if (!raft || !agentSet) return undefined;

    return {
      category,
      agentCount: agentSet.size,
      isLeader: raft.isLeader(),
    };
  }

  /**
   * Get swarm health status
   */
  getHealth(): ISwarmHealth {
    let healthyAgents = 0;
    const now = Date.now();
    const heartbeatTimeout = 30000; // 30 seconds

    for (const agent of this.agents.values()) {
      if (now - agent.lastHeartbeat < heartbeatTimeout) {
        healthyAgents++;
      }
    }

    const coordinatorStatus: ICategoryCoordinatorInfo[] = [];
    for (const category of Object.values(Category)) {
      const info = this.getCategoryCoordinator(category);
      if (info) {
        coordinatorStatus.push(info);
      }
    }

    const consensusReady = coordinatorStatus.some(c => c.isLeader);

    return {
      activeAgents: this.agents.size,
      healthyAgents,
      coordinatorStatus,
      lastGossipRound: this.lastGossipRound,
      consensusReady,
      topology: this.config.topology,
    };
  }

  /**
   * Get semantic router reference
   */
  getRouter(): SemanticRouter {
    return this.router;
  }

  /**
   * Get gossip protocol reference
   */
  getGossip(): GossipProtocol {
    return this.gossip;
  }

  /**
   * Check if coordinator is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
