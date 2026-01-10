# Coordination Bounded Context

## Purpose

The Coordination Context orchestrates the 593-agent swarm, managing agent lifecycle, semantic query routing, topology configuration, and consensus protocols. It ensures efficient collaboration while maintaining Byzantine fault tolerance.

---

## Domain Model

```
+------------------------------------------------------------------+
|                   COORDINATION BOUNDED CONTEXT                    |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+                                      |
|  |        Swarm           |  <-- Aggregate Root                  |
|  |      (Aggregate)       |                                      |
|  +------------------------+                                      |
|  | - swarmId: SwarmId     |                                      |
|  | - topology: Topology   |                                      |
|  | - agents: AgentPool    |                                      |
|  | - status: SwarmStatus  |                                      |
|  | - consensusConfig      |                                      |
|  +------------------------+                                      |
|           |                                                      |
|           | coordinates                                          |
|           v                                                      |
|  +------------------------+     +------------------------+       |
|  |       Router           |     |   ConsensusManager     |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - routerId: RouterId   |     | - managerId: MgrId     |       |
|  | - embeddings: Map      |     | - protocol: Protocol   |       |
|  | - routingTable         |     | - quorumSize: number   |       |
|  | - loadBalancer         |     | - faultTolerance: f    |       |
|  +------------------------+     +------------------------+       |
|                                          |                       |
|  +------------------------+              v                       |
|  |   TopologyManager      |     +------------------------+       |
|  |       (Entity)         |     |   ConsensusRound       |       |
|  +------------------------+     |       (Entity)         |       |
|  | - currentTopology      |     +------------------------+       |
|  | - connections: Graph   |     | - roundId: RoundId     |       |
|  | - metrics: TopMetrics  |     | - proposal: Proposal   |       |
|  +------------------------+     | - votes: Vote[]        |       |
|                                 | - outcome: Outcome     |       |
|  +-------------+                +------------------------+       |
|  |    Query    |                                                 |
|  | (Value Obj) |  +-------------+  +-------------+               |
|  +-------------+  |  Response   |  |   AgentId   |               |
|  | - text      |  | (Value Obj) |  | (Value Obj) |               |
|  | - embedding |  +-------------+  +-------------+               |
|  | - metadata  |  | - content   |  | - value     |               |
|  +-------------+  | - source    |  | - type      |               |
|                   | - confidence|  +-------------+               |
|                   +-------------+                                |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Aggregates

### Swarm (Aggregate Root)

The root aggregate managing the entire 593-agent swarm.

```typescript
class Swarm {
  private readonly swarmId: SwarmId;
  private topology: Topology;
  private agents: AgentPool;
  private router: Router;
  private consensusManager: ConsensusManager;
  private topologyManager: TopologyManager;
  private status: SwarmStatus;

  // Factory
  static initialize(config: SwarmConfig): Swarm {
    const swarm = new Swarm(
      SwarmId.generate(),
      Topology.create(config.topology),
      AgentPool.empty(),
      Router.create(config.routing),
      ConsensusManager.create(config.consensus),
      TopologyManager.create(config.topology)
    );
    swarm.raise(new SwarmInitialized(swarm.swarmId, config));
    return swarm;
  }

  // Agent Lifecycle
  spawnAgent(type: AgentType, config: AgentConfig): AgentId {
    const agentId = this.agents.spawn(type, config);
    this.router.registerAgent(agentId, config.embedding);
    this.topologyManager.addNode(agentId);
    this.raise(new AgentSpawned(this.swarmId, agentId, type));
    return agentId;
  }

  terminateAgent(agentId: AgentId): void {
    this.agents.terminate(agentId);
    this.router.unregisterAgent(agentId);
    this.topologyManager.removeNode(agentId);
    this.raise(new AgentTerminated(this.swarmId, agentId));
  }

  // Query Routing
  async routeQuery(query: Query): Promise<Response> {
    const targetAgent = this.router.route(query);
    this.raise(new QueryRouted(this.swarmId, query.id, targetAgent));

    const response = await this.agents.executeQuery(targetAgent, query);
    return response;
  }

  // Topology Management
  changeTopology(newTopology: TopologyType): void {
    const previousTopology = this.topology.type;
    this.topology = Topology.create(newTopology);
    this.topologyManager.reconfigure(newTopology);
    this.raise(new TopologyChanged(this.swarmId, previousTopology, newTopology));
  }

  // Consensus Operations
  async proposeChange(proposal: Proposal): Promise<ConsensusResult> {
    const round = this.consensusManager.startRound(proposal);
    const result = await round.execute();

    if (result.accepted) {
      this.applyProposal(proposal);
    }

    this.raise(new ConsensusReached(this.swarmId, proposal.id, result));
    return result;
  }

  // Status
  getStatus(): SwarmStatus {
    return {
      swarmId: this.swarmId,
      topology: this.topology.type,
      activeAgents: this.agents.count,
      healthyAgents: this.agents.healthyCount,
      routingLoad: this.router.getLoadMetrics(),
      consensusState: this.consensusManager.getState(),
    };
  }

  // Domain Events
  raise(event: SwarmDomainEvent): void;
}

type SwarmStatus = 'initializing' | 'active' | 'degraded' | 'recovering' | 'shutdown';
```

---

## Entities

### Router

Semantic router that dispatches queries to appropriate agents.

```typescript
class Router {
  private readonly routerId: RouterId;
  private agentEmbeddings: Map<AgentId, Float32Array>;
  private hnswIndex: HNSWIndex;
  private loadBalancer: LoadBalancer;
  private routingHistory: RoutingHistory;

  // Factory
  static create(config: RouterConfig): Router;

  // Agent Registration
  registerAgent(agentId: AgentId, embedding: Float32Array): void {
    this.agentEmbeddings.set(agentId, embedding);
    this.hnswIndex.insert(embedding, agentId);
  }

  unregisterAgent(agentId: AgentId): void {
    const embedding = this.agentEmbeddings.get(agentId);
    if (embedding) {
      this.hnswIndex.remove(embedding);
      this.agentEmbeddings.delete(agentId);
    }
  }

  // Semantic Routing
  route(query: Query): AgentId {
    // 1. Find semantically similar agents
    const candidates = this.hnswIndex.search(query.embedding, 10);

    // 2. Filter by availability and load
    const available = candidates.filter(c =>
      this.loadBalancer.isAvailable(c.agentId)
    );

    // 3. Select based on combined score
    const scored = available.map(c => ({
      agentId: c.agentId,
      score: this.computeRoutingScore(c, query),
    }));

    const best = scored.reduce((a, b) => a.score > b.score ? a : b);
    this.routingHistory.record(query.id, best.agentId);

    return best.agentId;
  }

  private computeRoutingScore(candidate: Candidate, query: Query): number {
    const semanticScore = candidate.similarity;
    const loadScore = this.loadBalancer.getLoadScore(candidate.agentId);
    const historyScore = this.routingHistory.getSuccessRate(candidate.agentId);

    return semanticScore * 0.5 + loadScore * 0.3 + historyScore * 0.2;
  }

  // Multi-agent routing for complex queries
  routeToMultiple(query: Query, k: number): AgentId[] {
    const candidates = this.hnswIndex.search(query.embedding, k * 2);
    return candidates
      .filter(c => this.loadBalancer.isAvailable(c.agentId))
      .slice(0, k)
      .map(c => c.agentId);
  }

  // Load Metrics
  getLoadMetrics(): LoadMetrics {
    return this.loadBalancer.getMetrics();
  }
}
```

### ConsensusManager

Manages distributed consensus across coordinator agents.

```typescript
class ConsensusManager {
  private readonly managerId: ConsensusManagerId;
  private protocol: ConsensusProtocol;
  private quorumSize: number;
  private faultTolerance: number;
  private currentRound: ConsensusRound | null;
  private electionState: ElectionState;

  // Factory
  static create(config: ConsensusConfig): ConsensusManager {
    const protocol = config.protocol === 'raft'
      ? new RaftProtocol(config)
      : new GossipProtocol(config);

    return new ConsensusManager(
      ConsensusManagerId.generate(),
      protocol,
      config.quorumSize,
      config.faultTolerance
    );
  }

  // Start consensus round
  startRound(proposal: Proposal): ConsensusRound {
    if (this.currentRound?.isActive) {
      throw new ConsensusInProgressError();
    }

    this.currentRound = new ConsensusRound(
      RoundId.generate(),
      proposal,
      this.protocol,
      this.quorumSize
    );

    return this.currentRound;
  }

  // Raft-specific: Leader election
  async electLeader(): Promise<AgentId> {
    if (!(this.protocol instanceof RaftProtocol)) {
      throw new ProtocolMismatchError('Leader election requires Raft protocol');
    }

    const election = await this.protocol.startElection();
    this.electionState = {
      term: election.term,
      leader: election.winner,
      electedAt: new Date(),
    };

    return election.winner;
  }

  // Get current state
  getState(): ConsensusState {
    return {
      protocol: this.protocol.name,
      quorumSize: this.quorumSize,
      faultTolerance: this.faultTolerance,
      currentRound: this.currentRound?.id ?? null,
      leader: this.electionState?.leader ?? null,
      term: this.electionState?.term ?? 0,
    };
  }
}

class ConsensusRound {
  readonly roundId: RoundId;
  readonly proposal: Proposal;
  private votes: Map<AgentId, Vote>;
  private outcome: ConsensusOutcome | null;
  private protocol: ConsensusProtocol;
  private quorumSize: number;

  get isActive(): boolean {
    return this.outcome === null;
  }

  async execute(): Promise<ConsensusResult> {
    // Broadcast proposal to all voters
    const voters = await this.protocol.getVoters();
    const votePromises = voters.map(voter =>
      this.protocol.requestVote(voter, this.proposal)
    );

    // Collect votes with timeout
    const votes = await Promise.allSettled(votePromises);
    this.processVotes(votes);

    // Determine outcome
    this.outcome = this.determineOutcome();
    return {
      accepted: this.outcome === 'accepted',
      votes: this.votes.size,
      quorumReached: this.votes.size >= this.quorumSize,
    };
  }

  private determineOutcome(): ConsensusOutcome {
    const approvals = [...this.votes.values()].filter(v => v.approved).length;
    if (approvals >= this.quorumSize) {
      return 'accepted';
    }
    if (this.votes.size - approvals >= this.quorumSize) {
      return 'rejected';
    }
    return 'inconclusive';
  }
}

type ConsensusOutcome = 'accepted' | 'rejected' | 'inconclusive';
```

### TopologyManager

Manages the communication topology between agents.

```typescript
class TopologyManager {
  private currentTopology: TopologyType;
  private connections: ConnectionGraph;
  private metrics: TopologyMetrics;

  // Factory
  static create(topology: TopologyType): TopologyManager;

  // Node management
  addNode(agentId: AgentId): void {
    this.connections.addNode(agentId);
    this.reconnectBasedOnTopology(agentId);
  }

  removeNode(agentId: AgentId): void {
    this.connections.removeNode(agentId);
    this.healConnections();
  }

  // Topology reconfiguration
  reconfigure(newTopology: TopologyType): void {
    this.currentTopology = newTopology;
    this.connections.clear();
    this.buildTopology();
  }

  private buildTopology(): void {
    const nodes = this.connections.getNodes();

    switch (this.currentTopology) {
      case 'mesh':
        this.buildMeshTopology(nodes);
        break;
      case 'hierarchical':
        this.buildHierarchicalTopology(nodes);
        break;
      case 'hierarchical-mesh':
        this.buildHybridTopology(nodes);
        break;
      case 'adaptive':
        this.buildAdaptiveTopology(nodes);
        break;
    }
  }

  private buildMeshTopology(nodes: AgentId[]): void {
    // Full mesh: every node connects to every other
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        this.connections.connect(nodes[i], nodes[j]);
      }
    }
  }

  private buildHierarchicalTopology(nodes: AgentId[]): void {
    // Tree structure: coordinator at root, agents as leaves
    const [coordinator, ...workers] = nodes;
    for (const worker of workers) {
      this.connections.connect(coordinator, worker);
    }
  }

  private buildHybridTopology(nodes: AgentId[]): void {
    // Hierarchical among domains, mesh within domains
    const domains = this.groupByDomain(nodes);
    const domainCoordinators: AgentId[] = [];

    for (const [domain, domainNodes] of domains) {
      // Mesh within domain
      this.buildMeshTopology(domainNodes);
      // Designate coordinator
      domainCoordinators.push(domainNodes[0]);
    }

    // Mesh among coordinators
    this.buildMeshTopology(domainCoordinators);
  }

  // Get routing paths
  getPath(from: AgentId, to: AgentId): AgentId[] {
    return this.connections.shortestPath(from, to);
  }

  getNeighbors(agentId: AgentId): AgentId[] {
    return this.connections.getNeighbors(agentId);
  }
}

type TopologyType = 'mesh' | 'hierarchical' | 'hierarchical-mesh' | 'adaptive';
```

---

## Value Objects

### Query

Represents an incoming query to the swarm.

```typescript
class Query {
  readonly id: QueryId;
  readonly text: string;
  readonly embedding: Float32Array;
  readonly metadata: QueryMetadata;
  readonly timestamp: Date;

  constructor(text: string, metadata: QueryMetadata) {
    this.id = QueryId.generate();
    this.text = text;
    this.embedding = embeddings.encode(text);
    this.metadata = metadata;
    this.timestamp = new Date();
  }

  // Complexity estimation
  getComplexity(): QueryComplexity {
    const factors = [
      this.text.length > 200 ? 1 : 0,
      this.metadata.requiresMultipleFeatures ? 2 : 0,
      this.metadata.isOptimizationRequest ? 2 : 0,
      this.metadata.requiresConsensus ? 1 : 0,
    ];
    const score = factors.reduce((a, b) => a + b, 0);
    if (score >= 4) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
  }

  equals(other: Query): boolean {
    return this.id.equals(other.id);
  }
}

interface QueryMetadata {
  source: 'api' | 'cli' | 'internal';
  priority: 'low' | 'normal' | 'high' | 'critical';
  requiresMultipleFeatures: boolean;
  isOptimizationRequest: boolean;
  requiresConsensus: boolean;
  timeout?: number;
}

type QueryComplexity = 'simple' | 'moderate' | 'complex';
```

### Response

Represents a response from an agent.

```typescript
class Response {
  readonly id: ResponseId;
  readonly queryId: QueryId;
  readonly content: string;
  readonly sourceAgent: AgentId;
  readonly confidence: number;
  readonly metadata: ResponseMetadata;
  readonly timestamp: Date;

  constructor(
    queryId: QueryId,
    content: string,
    sourceAgent: AgentId,
    confidence: number,
    metadata: ResponseMetadata
  ) {
    this.id = ResponseId.generate();
    this.queryId = queryId;
    this.content = content;
    this.sourceAgent = sourceAgent;
    this.confidence = confidence;
    this.metadata = metadata;
    this.timestamp = new Date();
  }

  // Merge multiple responses
  static merge(responses: Response[]): Response {
    // Weight by confidence
    const totalConfidence = responses.reduce((s, r) => s + r.confidence, 0);
    const weightedContents = responses.map(r => ({
      content: r.content,
      weight: r.confidence / totalConfidence,
    }));

    const mergedContent = responses
      .sort((a, b) => b.confidence - a.confidence)
      .map(r => r.content)
      .join('\n\n---\n\n');

    return new Response(
      responses[0].queryId,
      mergedContent,
      AgentId.swarm(), // Aggregate response
      Math.max(...responses.map(r => r.confidence)),
      { merged: true, sources: responses.map(r => r.sourceAgent.value) }
    );
  }
}

interface ResponseMetadata {
  latencyMs?: number;
  tokensUsed?: number;
  merged?: boolean;
  sources?: string[];
}
```

### AgentId

Unique identifier for an agent in the swarm.

```typescript
class AgentId {
  private readonly value: string;
  private readonly type: AgentType;

  constructor(value: string, type: AgentType) {
    if (!this.isValid(value)) {
      throw new InvalidAgentIdError(value);
    }
    this.value = value;
    this.type = type;
  }

  static generate(type: AgentType = 'worker'): AgentId {
    return new AgentId(`${type}-${crypto.randomUUID()}`, type);
  }

  static swarm(): AgentId {
    return new AgentId('swarm-aggregate', 'coordinator');
  }

  private isValid(value: string): boolean {
    return /^[a-z]+-[a-f0-9-]+$/.test(value);
  }

  equals(other: AgentId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

type AgentType = 'coordinator' | 'worker' | 'specialist' | 'optimizer';
```

---

## Domain Events

```typescript
// Swarm Lifecycle Events
interface SwarmInitialized extends DomainEvent {
  type: 'SwarmInitialized';
  swarmId: string;
  topology: string;
  maxAgents: number;
  consensusProtocol: string;
}

interface SwarmShutdown extends DomainEvent {
  type: 'SwarmShutdown';
  swarmId: string;
  reason: 'manual' | 'error' | 'timeout';
  activeAgents: number;
}

// Agent Lifecycle Events
interface AgentSpawned extends DomainEvent {
  type: 'AgentSpawned';
  swarmId: string;
  agentId: string;
  agentType: string;
  assignedFeatures: string[];
}

interface AgentTerminated extends DomainEvent {
  type: 'AgentTerminated';
  swarmId: string;
  agentId: string;
  reason: 'normal' | 'error' | 'idle' | 'resource_limit';
}

interface AgentHealthChanged extends DomainEvent {
  type: 'AgentHealthChanged';
  agentId: string;
  previousHealth: string;
  currentHealth: string;
  metrics: object;
}

// Routing Events
interface QueryRouted extends DomainEvent {
  type: 'QueryRouted';
  swarmId: string;
  queryId: string;
  targetAgent: string;
  routingScore: number;
  alternativeCandidates: string[];
}

interface QueryCompleted extends DomainEvent {
  type: 'QueryCompleted';
  queryId: string;
  responseId: string;
  latencyMs: number;
  confidence: number;
  success: boolean;
}

// Topology Events
interface TopologyChanged extends DomainEvent {
  type: 'TopologyChanged';
  swarmId: string;
  previousTopology: string;
  newTopology: string;
  nodeCount: number;
  edgeCount: number;
}

// Consensus Events
interface ConsensusReached extends DomainEvent {
  type: 'ConsensusReached';
  swarmId: string;
  proposalId: string;
  outcome: string;
  votes: number;
  quorumSize: number;
  duration: number;
}

interface LeaderElected extends DomainEvent {
  type: 'LeaderElected';
  swarmId: string;
  leaderId: string;
  term: number;
  votesReceived: number;
}
```

---

## Domain Services

### SemanticRouter

High-level routing service with fallback strategies.

```typescript
class SemanticRouterService {
  constructor(
    private readonly router: Router,
    private readonly swarm: Swarm,
    private readonly eventBus: EventBus
  ) {}

  async route(query: Query): Promise<Response> {
    const complexity = query.getComplexity();

    switch (complexity) {
      case 'simple':
        return this.routeToSingleAgent(query);
      case 'moderate':
        return this.routeWithFallback(query);
      case 'complex':
        return this.routeToMultipleAgents(query);
    }
  }

  private async routeToSingleAgent(query: Query): Promise<Response> {
    const targetAgent = this.router.route(query);
    return this.swarm.executeQuery(targetAgent, query);
  }

  private async routeWithFallback(query: Query): Promise<Response> {
    const primaryAgent = this.router.route(query);

    try {
      const response = await this.swarm.executeQuery(primaryAgent, query);
      if (response.confidence >= 0.7) {
        return response;
      }
      // Fallback to secondary agent
      const fallbackAgents = this.router.routeToMultiple(query, 2);
      const fallbackResponse = await this.swarm.executeQuery(fallbackAgents[1], query);
      return Response.merge([response, fallbackResponse]);
    } catch (error) {
      // Retry with different agent
      const alternates = this.router.routeToMultiple(query, 3);
      return this.swarm.executeQuery(alternates[1], query);
    }
  }

  private async routeToMultipleAgents(query: Query): Promise<Response> {
    const agents = this.router.routeToMultiple(query, 5);
    const responses = await Promise.all(
      agents.map(agent => this.swarm.executeQuery(agent, query))
    );
    return Response.merge(responses);
  }
}
```

### ConsensusService

Orchestrates consensus for critical decisions.

```typescript
class ConsensusService {
  constructor(
    private readonly swarm: Swarm,
    private readonly eventBus: EventBus
  ) {}

  async proposeParameterChange(change: ParameterChange): Promise<ConsensusResult> {
    const proposal = new Proposal('parameter_change', change);
    return this.swarm.proposeChange(proposal);
  }

  async proposeTopologyChange(topology: TopologyType): Promise<ConsensusResult> {
    const proposal = new Proposal('topology_change', { topology });
    return this.swarm.proposeChange(proposal);
  }

  async proposeAgentEviction(agentId: AgentId, reason: string): Promise<ConsensusResult> {
    const proposal = new Proposal('agent_eviction', { agentId, reason });
    return this.swarm.proposeChange(proposal);
  }
}
```

---

## Consensus Protocols

### Raft (Coordinators)

Used among coordinator agents for strong consistency.

| Property | Value |
|----------|-------|
| **Tolerance** | f < n/2 failures |
| **Latency** | 2 RTT (normal case) |
| **Use Case** | Leader election, log replication |
| **Guarantee** | Strong consistency |

### Gossip (Workers)

Used among worker agents for eventual consistency.

| Property | Value |
|----------|-------|
| **Tolerance** | Any number of failures |
| **Latency** | O(log n) rounds |
| **Use Case** | State dissemination, failure detection |
| **Guarantee** | Eventual consistency |

---

## Topology Comparison

| Topology | Connections | Latency | Use Case |
|----------|-------------|---------|----------|
| **Mesh** | O(n^2) | O(1) | Small swarms (< 50) |
| **Hierarchical** | O(n) | O(log n) | Large swarms with clear hierarchy |
| **Hybrid** | O(n + d^2) | O(1) within domain | Domain-based organization |
| **Adaptive** | Dynamic | Variable | Load-dependent optimization |

---

## Invariants

1. **Unique Agent IDs**: No duplicate agent IDs in the swarm
2. **Quorum Size**: Quorum must be > n/2 for safety
3. **Byzantine Tolerance**: f < n/3 for Byzantine consensus
4. **Topology Connectivity**: All agents must be reachable
5. **Single Active Round**: Only one consensus round at a time
6. **Leader Uniqueness**: At most one leader per term (Raft)
