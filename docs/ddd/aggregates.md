# ELEX Edge AI Agent Swarm - Aggregates

## Overview

Aggregates define transactional consistency boundaries in the ELEX domain. Each aggregate has a root entity that controls all access to entities within the boundary.

```mermaid
graph TB
    subgraph "AgentAggregate"
        A[Agent<br/>Aggregate Root]
        A --> KB[KnowledgeBase]
        A --> QT[QTable]
        A --> TB[TrajectoryBuffer]
        A --> VM[VectorMemory]
    end

    subgraph "SwarmAggregate"
        S[Swarm<br/>Aggregate Root]
        S --> T[Topology]
        S --> CM[ConsensusManager]
        S --> R[Router]
        S --> AC[AgentCollection]
    end

    subgraph "MemoryAggregate"
        M[MemoryStore<br/>Aggregate Root]
        M --> SL[StaticLayer]
        M --> VL[VectorLayer]
        M --> QL[QTableLayer]
        M --> TL[TrajectoryLayer]
    end

    subgraph "OptimizationAggregate"
        O[OptimizationCycle<br/>Aggregate Root]
        O --> KM[KPIMonitor]
        O --> RCA[RootCauseAnalyzer]
        O --> PE[ParameterExecutor]
        O --> RP[RollbackPoint]
    end
```

---

## 1. AgentAggregate

**Root Entity:** Agent

**Purpose:** Encapsulates a single feature agent's complete lifecycle, knowledge, and learning capabilities.

### Boundary

```typescript
class AgentAggregate {
  // Aggregate Root
  private readonly agent: Agent;

  // Entities within boundary
  private readonly knowledgeBase: KnowledgeBase;
  private readonly qTable: QTable;
  private readonly trajectoryBuffer: TrajectoryBuffer;
  private readonly vectorMemory: VectorMemory;

  // Factory method (only way to create)
  static create(config: AgentConfig): AgentAggregate {
    const agent = new Agent(
      AgentId.generate(),
      config.fajCode,
      config.type,
      config.category
    );
    return new AgentAggregate(
      agent,
      new KnowledgeBase(config.featureData),
      new QTable(config.qParams),
      new TrajectoryBuffer(1000),
      new VectorMemory(10000)
    );
  }
}
```

### Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| One Agent Per FAJ | Each FAJ code has exactly one agent | Factory validation |
| Valid Status Transitions | Status follows defined state machine | State machine guard |
| Q-Table Consistency | Q-values updated atomically | Transaction boundary |
| Trajectory Limit | Buffer never exceeds 1000 entries | Ring buffer eviction |
| Memory Capacity | Vector memory capped at 10,000 entries | HNSW pruning |

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Initializing
    Initializing --> Ready : knowledge_loaded
    Ready --> Busy : query_received
    Busy --> Ready : response_sent
    Ready --> Offline : shutdown
    Busy --> Offline : force_shutdown
    Offline --> Initializing : restart

    Ready --> ColdStart : interactions < 100
    ColdStart --> Ready : interactions >= 100
```

### Commands

| Command | Description | Raises Event |
|---------|-------------|--------------|
| Initialize | Load knowledge base, initialize Q-table | AgentInitialized |
| HandleQuery | Process incoming query | QueryProcessed |
| RecordFeedback | Update Q-table with reward | FeedbackRecorded |
| ConsultPeer | Request expertise from another agent | PeerConsulted |
| StoreMemory | Add to HNSW vector index | MemoryStored |

### Example

```typescript
// Creating and using an AgentAggregate
const config: AgentConfig = {
  fajCode: new FAJCode('FAJ 121 3094'),
  type: AgentType.NR,
  category: Category.MIMO,
  featureData: mimoSleepModeData,
  qParams: { gamma: 0.95, alpha: 0.1, epsilon: 0.1 }
};

const agent = AgentAggregate.create(config);
await agent.initialize();

const response = await agent.handleQuery(query);
agent.recordFeedback(query.id, feedback);
```

---

## 2. SwarmAggregate

**Root Entity:** Swarm

**Purpose:** Manages the collective of agents, their topology, consensus, and routing.

### Boundary

```typescript
class SwarmAggregate {
  // Aggregate Root
  private readonly swarm: Swarm;

  // Entities within boundary
  private readonly topology: Topology;
  private readonly consensusManager: ConsensusManager;
  private readonly router: Router;
  private readonly agents: AgentCollection;

  // Factory method
  static create(config: SwarmConfig): SwarmAggregate {
    const swarm = new Swarm(
      SwarmId.generate(),
      config.topology,
      config.maxAgents
    );
    return new SwarmAggregate(
      swarm,
      Topology.create(config.topology),
      ConsensusManager.create(config.consensus),
      Router.create(config.routing),
      new AgentCollection()
    );
  }
}
```

### Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| Max Agents | Never exceed configured maximum | Spawn validation |
| Unique Agents | No duplicate agent IDs | Collection constraint |
| Topology Consistency | All agents follow topology rules | Topology validator |
| Consensus Quorum | Raft requires 3+ coordinators | Startup validation |
| Router Index Sync | HNSW index always in sync | Event-driven update |

### Topology Rules

```mermaid
graph TB
    subgraph "Mesh (< 100 agents)"
        M1((A1)) --- M2((A2))
        M2 --- M3((A3))
        M3 --- M4((A4))
        M4 --- M1
        M1 --- M3
        M2 --- M4
    end

    subgraph "Hierarchical"
        HC[Coordinator] --> HA1((A1))
        HC --> HA2((A2))
        HC --> HA3((A3))
    end

    subgraph "Sharded"
        S1[CA Shard] --> SA1((CA Agent))
        S1 --> SA2((CA Agent))
        S2[RRM Shard] --> SB1((RRM Agent))
        S2 --> SB2((RRM Agent))
    end

    subgraph "Hybrid (Recommended)"
        RC[Raft Cluster]
        RC --> GS1[Gossip Swarm]
        RC --> GS2[Gossip Swarm]
        GS1 --> GA1((Agent))
        GS1 --> GA2((Agent))
        GS2 --> GA3((Agent))
    end
```

### Commands

| Command | Description | Raises Event |
|---------|-------------|--------------|
| Initialize | Set up topology and consensus | SwarmInitialized |
| SpawnAgent | Add new agent to swarm | AgentSpawned |
| TerminateAgent | Remove agent from swarm | AgentTerminated |
| RouteQuery | Find best agent for query | QueryRouted |
| ChangeTopology | Reconfigure swarm topology | TopologyChanged |
| ReachConsensus | Coordinate decision across agents | ConsensusReached |

### Example

```typescript
const swarmConfig: SwarmConfig = {
  topology: 'hybrid',
  maxAgents: 593,
  consensus: 'raft',
  routing: 'hnsw'
};

const swarm = SwarmAggregate.create(swarmConfig);
await swarm.initialize();

// Spawn all 593 feature agents
for (const feature of features) {
  await swarm.spawnAgent(AgentAggregate.create(feature));
}

// Route query to best agent
const response = await swarm.routeQuery(query);
```

---

## 3. MemoryAggregate

**Root Entity:** MemoryStore

**Purpose:** Manages the 4-layer memory system with persistence and synchronization.

### Boundary

```typescript
class MemoryAggregate {
  // Aggregate Root
  private readonly store: MemoryStore;

  // Layers within boundary
  private readonly staticLayer: StaticKnowledgeLayer;    // ~3.2MB
  private readonly vectorLayer: VectorMemoryLayer;       // HNSW
  private readonly qTableLayer: QTableLayer;             // LZ4 compressed
  private readonly trajectoryLayer: TrajectoryLayer;     // Ring buffer

  // Factory method
  static create(config: MemoryConfig): MemoryAggregate {
    return new MemoryAggregate(
      new MemoryStore(config.storageBackend),
      new StaticKnowledgeLayer(config.knowledgeData),
      new VectorMemoryLayer(config.hnswParams),
      new QTableLayer(config.compressionLevel),
      new TrajectoryLayer(config.bufferSize)
    );
  }
}
```

### 4-Layer Architecture

```mermaid
graph TB
    subgraph "Layer 1: Static Knowledge (~3.2MB)"
        SK[Feature Metadata]
        SK --> P[Parameters]
        SK --> C[Counters]
        SK --> K[KPIs]
        SK --> PR[Procedures]
    end

    subgraph "Layer 2: Vector Memory (HNSW)"
        VM[10,000 vectors per agent]
        VM --> QR[Query Embeddings]
        VM --> RE[Response Embeddings]
        VM --> CE[Case Embeddings]
    end

    subgraph "Layer 3: Q-Table (LZ4)"
        QT[State-Action Values]
        QT --> QV[Q-Values]
        QT --> VI[Visits]
        QT --> CO[Confidence]
    end

    subgraph "Layer 4: Trajectory (Ring Buffer)"
        TR[1000 max entries]
        TR --> ST[States]
        TR --> AC[Actions]
        TR --> RW[Rewards]
    end
```

### Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| Static Immutability | Layer 1 never modified at runtime | Readonly interface |
| Vector Capacity | Max 10,000 vectors per agent | HNSW eviction |
| Compression Ratio | Q-tables compressed 4-32x | LZ4 enforcement |
| Buffer Limit | Trajectories capped at 1000 | Ring buffer |
| Sync Frequency | Federated merge every 60s or 10 interactions | Timer + counter |

### Commands

| Command | Description | Raises Event |
|---------|-------------|--------------|
| Store | Add memory to appropriate layer | MemoryStored |
| Search | Vector similarity search | MemorySearched |
| UpdateQTable | Modify Q-values atomically | QTableUpdated |
| RecordTrajectory | Add to trajectory buffer | TrajectoryRecorded |
| FederatedMerge | Sync with peer memories | FederatedMergeCompleted |
| Compress | Reduce storage footprint | MemoryCompressed |

### Example

```typescript
const memoryConfig: MemoryConfig = {
  storageBackend: 'wasm-heap',
  knowledgeData: featureKnowledge,
  hnswParams: { dimensions: 128, maxElements: 10000 },
  compressionLevel: 'lz4-fast',
  bufferSize: 1000
};

const memory = MemoryAggregate.create(memoryConfig);

// Store and search
await memory.store(embedding, metadata);
const similar = await memory.search(queryEmbedding, { k: 5 });

// Federated merge
await memory.federatedMerge(peerMemory);
```

---

## 4. OptimizationAggregate

**Root Entity:** OptimizationCycle

**Purpose:** Manages the closed-loop optimization process from observation to learning.

### Boundary

```typescript
class OptimizationAggregate {
  // Aggregate Root
  private readonly cycle: OptimizationCycle;

  // Entities within boundary
  private readonly kpiMonitor: KPIMonitor;
  private readonly rootCauseAnalyzer: RootCauseAnalyzer;
  private readonly parameterExecutor: ParameterExecutor;
  private readonly rollbackPoint: RollbackPoint;
  private readonly timer: OptimizationTimer;

  // Factory method
  static create(config: OptimizationConfig): OptimizationAggregate {
    return new OptimizationAggregate(
      new OptimizationCycle(CycleId.generate()),
      new KPIMonitor(config.spatialLevel, config.temporalLevel),
      new RootCauseAnalyzer(config.counters),
      new ParameterExecutor(config.safeZones),
      new RollbackPoint(),
      new OptimizationTimer(30 * 60 * 1000) // 30 minutes
    );
  }
}
```

### 6-Phase Control Loop

```mermaid
stateDiagram-v2
    [*] --> Observe
    Observe --> Analyze : data_collected
    Analyze --> Decide : anomaly_detected
    Analyze --> Observe : no_anomaly
    Decide --> Act : approved
    Decide --> Observe : rejected
    Act --> Learn : timer_expired
    Act --> Learn : immediate_failure
    Learn --> Observe : continue
    Learn --> Act : rollback_triggered

    note right of Observe
        Collect KPIs, counters, alarms, configs
        Multi-level spatio-temporal
    end note

    note right of Analyze
        Detect anomalies
        Compute integrity score (Min-Cut)
        Identify root causes
    end note

    note right of Decide
        Route to feature agents
        Assess risk (LOW/MEDIUM/HIGH)
        Require approval if needed
    end note

    note right of Act
        Execute cmedit commands
        Set rollback point
        Start 30-minute timer
    end note

    note right of Learn
        Measure KPI delta
        Update Q-table
        Record trajectory
        Trigger rollback if needed
    end note
```

### Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| Safe Zone Enforcement | Parameters never exceed safe zones | Pre-execution validation |
| Rollback Required | Every change must have rollback point | Command pattern |
| Timer Active | 30-minute timer during Act phase | Timer guard |
| Approval Required | HIGH risk requires manual approval | Risk assessor |
| Blocked Conditions | No changes during CRITICAL_HW_FAILURE, etc. | Condition checker |
| Cooldown Period | Respect parameter cooldown windows | Cooldown tracker |

### Approval Logic

```mermaid
flowchart TD
    R[Recommendation] --> RiskAssess{Risk Level?}

    RiskAssess -->|LOW| ConfCheck{Confidence > 80%?}
    RiskAssess -->|MEDIUM| ManualReview[Manual Review]
    RiskAssess -->|HIGH| ManualApproval[Manual Approval Required]

    ConfCheck -->|Yes| HistoryCheck{Similar succeeded > 5x?}
    ConfCheck -->|No| ManualReview

    HistoryCheck -->|Yes| SafeZoneCheck{Within safe zone?}
    HistoryCheck -->|No| ManualReview

    SafeZoneCheck -->|Yes| AutoApprove[Auto-Approve]
    SafeZoneCheck -->|No| ManualReview

    ManualReview --> Approve[Execute]
    ManualReview --> Reject[Skip]

    ManualApproval --> Approve
    ManualApproval --> Reject

    AutoApprove --> Execute[Execute cmedit]
    Approve --> Execute
```

### Commands

| Command | Description | Raises Event |
|---------|-------------|--------------|
| StartCycle | Begin new optimization cycle | CycleStarted |
| Observe | Collect KPI and counter data | DataCollected |
| Analyze | Detect anomalies, find root causes | AnomalyDetected / RootCauseIdentified |
| Decide | Assess risk, request approval | ApprovalRequested / AutoApproved |
| Act | Execute parameter changes | ParameterChanged |
| Learn | Update Q-table, record outcome | OutcomeLearned |
| Rollback | Revert to rollback point | RollbackTriggered |

### Safe Zone Configuration Example

```typescript
const iflbSafeZone: SafeZoneConfig = {
  parameter: 'lbActivationThreshold',
  constraints: {
    min: 10,
    max: 100,
    safeMin: 50,
    safeMax: 90,
    changeLimit: 0.15,     // 15% max change
    cooldown: 60 * 60 * 1000  // 60 minutes
  },
  blockedConditions: [
    'CRITICAL_HW_FAILURE',
    'SITE_DOWN',
    { metric: 'callDropRate', operator: '>', value: 0.02 },
    { timeWindow: '00:00-06:00' }  // Night maintenance
  ]
};
```

### Example

```typescript
const optimizationConfig: OptimizationConfig = {
  spatialLevel: SpatialLevel.Node,
  temporalLevel: TemporalLevel.FourHour,
  counters: iflbCounters,
  safeZones: [iflbSafeZone]
};

const optimization = OptimizationAggregate.create(optimizationConfig);

// Run optimization cycle
const outcome = await optimization.run();

if (outcome.rollbackTriggered) {
  console.log('Rollback triggered:', outcome.reason);
} else {
  console.log('KPI improvement:', outcome.kpiDelta);
}
```

---

## Aggregate Relationships

```mermaid
graph TB
    subgraph "Cross-Aggregate Communication"
        AA[AgentAggregate] -->|Domain Events| SA[SwarmAggregate]
        SA -->|Domain Events| AA
        AA -->|Domain Events| MA[MemoryAggregate]
        MA -->|Domain Events| AA
        AA -->|Domain Events| OA[OptimizationAggregate]
        OA -->|Domain Events| AA
    end

    subgraph "Event Bus"
        EB[Event Bus]
        AA -.-> EB
        SA -.-> EB
        MA -.-> EB
        OA -.-> EB
    end
```

## Consistency Model

| Aggregate | Consistency | Rationale |
|-----------|-------------|-----------|
| AgentAggregate | Strong | Agent state must be consistent |
| SwarmAggregate | Strong (Raft) / Eventual (Gossip) | Coordinators need strong, agents eventual |
| MemoryAggregate | Eventual | Performance over strict consistency |
| OptimizationAggregate | Strong | Safety-critical operations |
