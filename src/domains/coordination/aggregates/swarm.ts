/**
 * Swarm Aggregate Root
 *
 * Manages the collective of feature agents, their topology, consensus, and routing.
 * This is the main coordination point for the entire agent swarm.
 */

import { Query } from '../value-objects/query';
import { Response, AgentId } from '../value-objects/response';
import { Router, AgentEmbedding, RoutingResult } from '../entities/router';
import { ConsensusManager, ConsensusProtocol, Proposal } from '../entities/consensus-manager';
import { TopologyManager, TopologyType, TopologyNode } from '../entities/topology-manager';

export interface SwarmConfig {
  readonly topology: TopologyType;
  readonly maxAgents: number;
  readonly consensusProtocol: ConsensusProtocol;
  readonly routingEnabled: boolean;
}

export interface AgentInfo {
  readonly id: AgentId;
  readonly fajCode: string;
  readonly category: string;
  readonly status: 'active' | 'inactive' | 'busy';
  readonly health: number;
}

/**
 * Domain Events for Swarm
 */
export interface SwarmInitialized {
  readonly type: 'SwarmInitialized';
  readonly swarmId: string;
  readonly topology: TopologyType;
  readonly timestamp: Date;
}

export interface AgentSpawned {
  readonly type: 'AgentSpawned';
  readonly swarmId: string;
  readonly agentId: string;
  readonly fajCode: string;
  readonly timestamp: Date;
}

export interface AgentTerminated {
  readonly type: 'AgentTerminated';
  readonly swarmId: string;
  readonly agentId: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export interface QueryRouted {
  readonly type: 'QueryRouted';
  readonly swarmId: string;
  readonly queryId: string;
  readonly targetAgentId: string;
  readonly confidence: number;
  readonly timestamp: Date;
}

export interface TopologyChanged {
  readonly type: 'TopologyChanged';
  readonly swarmId: string;
  readonly oldTopology: TopologyType;
  readonly newTopology: TopologyType;
  readonly timestamp: Date;
}

export interface ConsensusReached {
  readonly type: 'ConsensusReached';
  readonly swarmId: string;
  readonly proposalId: string;
  readonly result: 'accepted' | 'rejected';
  readonly timestamp: Date;
}

export type SwarmEvent =
  | SwarmInitialized
  | AgentSpawned
  | AgentTerminated
  | QueryRouted
  | TopologyChanged
  | ConsensusReached;

/**
 * Swarm Aggregate Root
 */
export class Swarm {
  readonly id: string;
  private _config: SwarmConfig;
  private _agents: Map<string, AgentInfo>;
  private _router: Router;
  private _consensusManager: ConsensusManager;
  private _topologyManager: TopologyManager;
  private _initialized: boolean;
  private _events: SwarmEvent[];

  private constructor(
    id: string,
    config: SwarmConfig,
    router: Router,
    consensusManager: ConsensusManager,
    topologyManager: TopologyManager
  ) {
    this.id = id;
    this._config = config;
    this._agents = new Map();
    this._router = router;
    this._consensusManager = consensusManager;
    this._topologyManager = topologyManager;
    this._initialized = false;
    this._events = [];
  }

  /**
   * Factory method
   */
  static create(config: SwarmConfig): Swarm {
    const id = `swarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const router = new Router(`router-${id}`);
    const consensusManager = new ConsensusManager(`consensus-${id}`, {
      protocol: config.consensusProtocol,
      quorumSize: 2,
      timeoutMs: 5000,
      heartbeatIntervalMs: 1000
    });
    const topologyManager = new TopologyManager(`topology-${id}`, {
      type: config.topology,
      maxNodesPerShard: 100,
      maxConnections: 50,
      replicationFactor: 3
    });

    return new Swarm(id, config, router, consensusManager, topologyManager);
  }

  /**
   * Initialize the swarm
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      throw new Error('Swarm already initialized');
    }

    this._initialized = true;

    this.raise({
      type: 'SwarmInitialized',
      swarmId: this.id,
      topology: this._config.topology,
      timestamp: new Date()
    });
  }

  /**
   * Spawn a new agent into the swarm
   */
  spawnAgent(
    agentId: AgentId,
    fajCode: string,
    category: string,
    embedding: AgentEmbedding
  ): void {
    if (!this._initialized) {
      throw new Error('Swarm not initialized');
    }

    if (this._agents.size >= this._config.maxAgents) {
      throw new Error(`Maximum agents (${this._config.maxAgents}) reached`);
    }

    if (this._agents.has(agentId.value)) {
      throw new Error(`Agent ${agentId.value} already exists`);
    }

    // Add agent info
    const agentInfo: AgentInfo = {
      id: agentId,
      fajCode,
      category,
      status: 'active',
      health: 1.0
    };
    this._agents.set(agentId.value, agentInfo);

    // Register with router
    if (this._config.routingEnabled) {
      this._router.registerAgent(embedding);
    }

    // Add to topology
    this._topologyManager.addNode(agentId.value, 'agent', category);

    // Register as consensus peer
    this._consensusManager.registerPeer(agentId.value);

    this.raise({
      type: 'AgentSpawned',
      swarmId: this.id,
      agentId: agentId.value,
      fajCode,
      timestamp: new Date()
    });
  }

  /**
   * Terminate an agent
   */
  terminateAgent(agentId: AgentId, reason: string = 'requested'): void {
    if (!this._agents.has(agentId.value)) {
      throw new Error(`Agent ${agentId.value} not found`);
    }

    // Remove from router
    this._router.unregisterAgent(agentId.value);

    // Remove from topology
    this._topologyManager.removeNode(agentId.value);

    // Remove from consensus
    this._consensusManager.unregisterPeer(agentId.value);

    // Remove agent info
    this._agents.delete(agentId.value);

    this.raise({
      type: 'AgentTerminated',
      swarmId: this.id,
      agentId: agentId.value,
      reason,
      timestamp: new Date()
    });
  }

  /**
   * Route a query to the best agent(s)
   */
  routeQuery(query: Query, topK: number = 1): RoutingResult[] {
    if (!this._initialized) {
      throw new Error('Swarm not initialized');
    }

    if (!this._config.routingEnabled) {
      throw new Error('Routing not enabled for this swarm');
    }

    const results = this._router.route(query, topK);

    if (results.length > 0) {
      this.raise({
        type: 'QueryRouted',
        swarmId: this.id,
        queryId: query.id,
        targetAgentId: results[0].agentId,
        confidence: results[0].confidence,
        timestamp: new Date()
      });
    }

    return results;
  }

  /**
   * Change swarm topology
   */
  changeTopology(newTopology: TopologyType): void {
    if (!this._initialized) {
      throw new Error('Swarm not initialized');
    }

    const oldTopology = this._config.topology;
    this._config = { ...this._config, topology: newTopology };
    this._topologyManager.changeTopology(newTopology);

    this.raise({
      type: 'TopologyChanged',
      swarmId: this.id,
      oldTopology,
      newTopology,
      timestamp: new Date()
    });
  }

  /**
   * Propose a decision for consensus
   */
  propose(type: string, value: unknown, proposerId: string): Proposal {
    if (!this._initialized) {
      throw new Error('Swarm not initialized');
    }

    return this._consensusManager.propose(type, value, proposerId);
  }

  /**
   * Vote on a consensus proposal
   */
  vote(proposalId: string, voterId: string, inFavor: boolean): boolean {
    const result = this._consensusManager.vote(proposalId, voterId, inFavor);

    const proposal = this._consensusManager.getProposal(proposalId);
    if (proposal && (proposal.status === 'accepted' || proposal.status === 'rejected')) {
      this.raise({
        type: 'ConsensusReached',
        swarmId: this.id,
        proposalId,
        result: proposal.status as 'accepted' | 'rejected',
        timestamp: new Date()
      });
    }

    return result;
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: AgentId, status: 'active' | 'inactive' | 'busy', health?: number): void {
    const agent = this._agents.get(agentId.value);
    if (!agent) {
      throw new Error(`Agent ${agentId.value} not found`);
    }

    this._agents.set(agentId.value, {
      ...agent,
      status,
      health: health ?? agent.health
    });
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this._agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this._agents.values());
  }

  /**
   * Get active agents
   */
  getActiveAgents(): AgentInfo[] {
    return Array.from(this._agents.values()).filter(a => a.status === 'active');
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: string): AgentInfo[] {
    return Array.from(this._agents.values()).filter(a => a.category === category);
  }

  /**
   * Find path between two agents
   */
  findPath(fromAgentId: string, toAgentId: string): string[] | null {
    return this._topologyManager.findPath(fromAgentId, toAgentId);
  }

  /**
   * Get swarm health summary
   */
  getHealthSummary(): {
    totalAgents: number;
    activeAgents: number;
    avgHealth: number;
    topologyStats: ReturnType<TopologyManager['getStats']>;
    routerStats: ReturnType<Router['getStats']>;
  } {
    const agents = Array.from(this._agents.values());
    const activeAgents = agents.filter(a => a.status === 'active');
    const avgHealth = agents.length > 0
      ? agents.reduce((sum, a) => sum + a.health, 0) / agents.length
      : 0;

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      avgHealth,
      topologyStats: this._topologyManager.getStats(),
      routerStats: this._router.getStats()
    };
  }

  private raise(event: SwarmEvent): void {
    this._events.push(event);
  }

  // Getters
  get config(): SwarmConfig { return this._config; }
  get agentCount(): number { return this._agents.size; }
  get initialized(): boolean { return this._initialized; }
  get router(): Router { return this._router; }
  get consensusManager(): ConsensusManager { return this._consensusManager; }
  get topologyManager(): TopologyManager { return this._topologyManager; }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): SwarmEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  equals(other: Swarm): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `Swarm(${this.id}, agents=${this._agents.size}, topology=${this._config.topology})`;
  }
}
