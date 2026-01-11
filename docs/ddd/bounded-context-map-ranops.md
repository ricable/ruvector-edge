# RANOps Autonomous State Machine - Bounded Context Map

## Context Overview

The **Agent Lifecycle** bounded context manages the autonomous behavior and state transitions of RAN feature agents using Goal-Oriented Action Planning (GOAP) and Q-learning reinforcement learning.

## Bounded Context Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT LIFECYCLE BOUNDED CONTEXT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ CORE DOMAIN: AGENT LIFECYCLE                                         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │    │
│  │  │   Autonomous     │  │   Feature        │  │  Lifecycle       │    │    │
│  │  │  State Machine   │  │    Agent         │  │    Manager       │    │    │
│  │  │   (Aggregate)    │  │   (Aggregate)    │  │  (Entity)        │    │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │    │
│  │                                                                             │
│  │  Value Objects: AgentLifecycleState, FAJCode, ConfidenceScore              │
│  │  Domain Events: StateTransitioned, AutonomousDecisionMade, AgentSpawned   │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SUPPORTING DOMAIN: INTELLIGENCE (Shared)                            │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │    │
│  │  │   Q-Table        │  │  Trajectory      │  │  Federated       │    │    │
│  │  │  (Aggregate)     │  │    Buffer        │  │    Merger        │    │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │    │
│  │                                                                             │
│  │  Entities: QEntry, Trajectory | VOs: State, Action, Reward                 │
│  │  Events: QTableUpdated, QTableMerged, TrajectoryRecorded                  │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SUPPORTING DOMAIN: COORDINATION (Shared)                             │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │    │
│  │  │     Swarm        │  │  Topology        │  │   Consensus      │    │    │
│  │  │  (Aggregate)     │  │   Manager        │  │    Manager       │    │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │    │
│  │                                                                             │
│  │  Entities: Router, ConsensusManager | VOs: Query, Response                   │
│  │  Events: SwarmInitialized, AgentSpawned, TopologyChanged                    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Context Mapping

### Upstream Contexts
- **Knowledge Domain**: Provides feature definitions, FAJ codes, safe zones
- **Optimization Domain**: Provides KPI targets, optimization constraints

### Downstream Contexts
- **Coordination Domain**: Consumes agent state for swarm routing
- **Intelligence Domain**: Consumes state transitions for Q-learning updates

### Shared Kernel
- **Domain Events**: All contexts subscribe to AgentLifecycle events
- **Value Objects**: State, Action, Reward (from Intelligence)
- **Agent Types**: FeatureAgent, Coordinator, Specialist

## Aggregates Overview

| Aggregate | Root Entity | Key Entities | Value Objects | Domain Events |
|-----------|-------------|--------------|---------------|---------------|
| **AutonomousStateMachine** | AutonomousStateMachine | StateTransition | AgentLifecycleState, FAJCode | StateTransitioned, AutonomousDecisionMade |
| **FeatureAgent** | FeatureAgent | Capability, Knowledge | FAJCode, ConfidenceScore | AgentSpawned, QueryHandled |
| **QTable** | QTable | QEntry | State, Action, Reward | QTableUpdated, QTableMerged |
| **TrajectoryBuffer** | TrajectoryBuffer | Trajectory | Step | TrajectoryRecorded, BufferConsolidated |
| **Swarm** | Swarm | TopologyManager, ConsensusManager, Router | Query, Response | SwarmInitialized, AgentSpawned, TopologyChanged |

## Aggregate Relationships

```
FeatureAgent (1) ────┐
                    ├──> (1:1) AutonomousStateMachine
FeatureAgent (1) ────┘        │
                              ├──> (1:1) QTable
                              │
FeatureAgent (1) ─────────────┘
                              │
Swarm (1) ───> (1:N) ─────────┴── FeatureAgent (N)
                              │
FeatureAgent (1) ───> (1:N) ───┴── TrajectoryBuffer (N)
```

## Core Domain: Agent Lifecycle

### AutonomousStateMachine Aggregate

**Purpose**: Manages autonomous state transitions using OODA loop and GOAP planning.

**Aggregate Root**: `AutonomousStateMachine`

**Invariants**:
- State transitions must follow defined rules
- ColdStart requires 100 interactions before Ready
- Degraded state requires health threshold validation
- Offline is terminal (no transitions out)

**State Model**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│                     AGENT LIFECYCLE STATE MACHINE                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┐    knowledge_loaded    ┌──────────────┐                  │
│  │ Initializing │ ─────────────────────▶ │  ColdStart   │                  │
│  └──────────────┘                        └──────┬───────┘                  │
│                                                 │                          │
│                                    100 interactions                        │
│                                                 ▼                          │
│  ┌──────────────┐    health_recovered    ┌──────────────┐                  │
│  │   Degraded   │ ◀──────────────────── │    Ready      │ ◀───────┐       │
│  └──────┬───────┘                        └──────┬───────┘         │       │
│         │                                       │                  │       │
│         │ health_below_threshold   query_received                   │       │
│         │                                       ▼                  │       │
│         └─────────────────────────▶ ┌──────────────┐               │       │
│                                      │     Busy     │ ─────────────┘       │
│                                      └──────────────┘  query_completed     │
│                                                                            │
│                        shutdown_requested                                  │
│  ┌──────────────┐ ◀─────────────────────────────┐                         │
│  │   Offline    │                                │                         │
│  └──────────────┘ ◀──────────────── (any state) ─┘                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**State Transition Rules**:

| From State | To State | Trigger | Guard Condition | Side Effects |
|------------|----------|---------|-----------------|--------------|
| Initializing | ColdStart | knowledge_loaded | Feature catalog loaded | Initialize Q-table |
| Initializing | Offline | shutdown_requested | - | Cleanup resources |
| ColdStart | Ready | cold_start_complete | interactions >= 100 | Decay epsilon to 0.1 |
| ColdStart | Offline | shutdown_requested | - | Persist Q-table |
| Ready | Busy | query_received | - | Record query start |
| Ready | Degraded | health_threshold_breached | health < 0.5 | Trigger recovery |
| Ready | Offline | shutdown_requested | - | Persist learning |
| Busy | Ready | query_completed | - | Update Q-table |
| Busy | Degraded | health_threshold_breached | health < 0.5 | Abort query |
| Degraded | Ready | health_recovered | health >= 0.8 | Resume normal ops |
| Degraded | Offline | shutdown_requested | - | Emergency persist |

### FeatureAgent Aggregate

**Purpose**: Represents a specialized RAN feature agent with FAJ code expertise.

**Aggregate Root**: `FeatureAgent`

**Invariants**:
- FAJ code must be valid (format: FAJ XXX XXXX)
- Category must match one of 9 feature categories
- Confidence score bounded [0, 1]
- Must have at least one capability

**Entity**: `FeatureAgent`
- `id: AgentId` - Unique agent identifier
- `fajCode: FAJCode` - Ericsson feature code
- `category: FeatureCategory` - Energy Saving, Mobility, etc.
- `capabilities: Capability[]` - Query handling abilities
- `confidence: ConfidenceScore` - Current confidence level
- `stateMachine: AutonomousStateMachine` - State management

**Value Objects**:
- `FAJCode`: Immutable feature code representation
- `ConfidenceScore`: Bounded confidence (0-1)
- `FeatureCategory`: Enum of 9 categories

**Domain Events**:
- `AgentSpawned`: New agent created
- `QueryHandled`: Query processed
- `CapabilityAdded`: New capability learned

## Supporting Domain: Intelligence

### QTable Aggregate

**Purpose**: Stores and updates Q-values for reinforcement learning.

**Aggregate Root**: `QTable`

**Invariants**:
- Q-values bounded by reward range
- Confidence = 1 - (1 / (1 + visits))
- Alpha, Gamma, Epsilon must be in valid ranges

**Entity**: `QEntry`
- `qValue: number` - Learned value
- `visits: number` - Access count
- `confidence: number` - Computed confidence
- `outcomes: number[]` - Recent outcomes
- `lastUpdated: Date` - Update timestamp

**Value Objects**:
- `State`: Q-learning state (query type, complexity, confidence)
- `Action`: Action (DirectAnswer, ContextAnswer, ConsultPeer, etc.)
- `Reward`: Reward value with components

**Domain Events**:
- `QTableUpdated`: Q-value changed
- `QTableMerged`: Federated learning merge completed

### TrajectoryBuffer Aggregate

**Purpose**: Stores experience trajectories for replay learning.

**Aggregate Root**: `TrajectoryBuffer`

**Invariants**:
- Max 1000 trajectories (priority replay)
- Trajectories ordered by priority
- Automatic consolidation at 80% capacity

**Entity**: `Trajectory`
- `id: string` - Unique trajectory ID
- `steps: Step[]` - State-action-reward sequence
- `priority: number` - Priority for replay
- `createdAt: Date` - Creation timestamp

**Domain Events**:
- `TrajectoryRecorded`: New trajectory added
- `BufferConsolidated`: Buffer consolidated

## Supporting Domain: Coordination

### Swarm Aggregate

**Purpose**: Manages 593-agent collective with topology and consensus.

**Aggregate Root**: `Swarm`

**Invariants**:
- Max 593 agents
- Consensus requires quorum
- Topology changes require consensus

**Entities**:
- `TopologyManager`: Manages network topology (mesh/hierarchical/hierarchical-mesh)
- `ConsensusManager`: Byzantine fault-tolerant consensus
- `Router`: HNSW-based semantic routing

**Domain Events**:
- `SwarmInitialized`: Swarm created
- `AgentSpawned`: Agent added to swarm
- `TopologyChanged`: Topology reconfigured
- `ConsensusReached`: Consensus decision made

## Cross-Context Communication

### Event-Driven Architecture

```typescript
// Agent Lifecycle publishes events
interface StateTransitioned {
  readonly type: 'StateTransitioned';
  readonly aggregateId: string; // AutonomousStateMachine.id
  readonly aggregateType: 'agent-lifecycle';
  readonly fromState: AgentLifecycleState;
  readonly toState: AgentLifecycleState;
  readonly trigger: string;
  readonly timestamp: Date;
}

// Intelligence subscribes to state transitions
interface QLearningUpdate {
  readonly type: 'QLearningUpdate';
  readonly agentId: string;
  readonly state: State;
  readonly action: Action;
  readonly reward: Reward;
  readonly nextState: State;
}

// Coordination subscribes to agent status
interface AgentStatusChanged {
  readonly type: 'AgentStatusChanged';
  readonly agentId: string;
  readonly previousStatus: string;
  readonly newStatus: string;
  readonly health: number;
}
```

### Integration Patterns

**Pattern 1: State-Triggered Learning**
- AutonomousStateMachine fires `StateTransitioned` event
- QTable aggregate subscribes and updates learning parameters
- Example: ColdStart -> Ready triggers epsilon decay

**Pattern 2: Health-Based Routing**
- FeatureAgent publishes health status
- Swarm aggregate subscribes and adjusts routing
- Example: Degraded agents excluded from routing

**Pattern 3: Federated Learning Sync**
- Multiple FeatureAgents reach Ready state
- Swarm coordinates federated Q-table merge
- TrajectoryBuffer consolidates experiences

## Context Boundaries

### Public Interfaces (Exposed to Other Contexts)

**Agent Lifecycle Context**:
```typescript
interface IAutonomousStateMachine {
  getCurrentState(): AgentLifecycleState;
  canTransitionTo(targetState: AgentLifecycleState): boolean;
  transition(trigger: string): Promise<void>;
  getHealth(): number;
}

interface IFeatureAgent {
  getId(): AgentId;
  getFAJCode(): FAJCode;
  getCategory(): FeatureCategory;
  handleQuery(query: Query): Promise<Response>;
  getConfidence(): number;
}
```

**Intelligence Context**:
```typescript
interface IQTable {
  lookup(state: State, action: Action): number;
  update(state: State, action: Action, reward: Reward, nextState: State): void;
  selectAction(state: State): Action;
  merge(peerQTable: IQTable): void;
}

interface ITrajectoryBuffer {
  record(trajectory: Trajectory): void;
  sample(batchSize: number): Trajectory[];
  consolidate(): void;
}
```

**Coordination Context**:
```typescript
interface ISwarm {
  spawnAgent(agentId: AgentId, fajCode: string, category: string): void;
  routeQuery(query: Query): RoutingResult[];
  changeTopology(newTopology: TopologyType): void;
  getAgent(agentId: string): AgentInfo | undefined;
}
```

### Anti-Corruption Layer

**External System: Ericsson ENM**
- Adapter converts ENM alarms to domain events
- Translator maps ENM parameter codes to FAJ codes
- Sanitizer validates safe zone constraints

**External System: Human Operators**
- CLI adapter for operator commands
- Event publisher for operator notifications
- Audit logger for compliance

## Strategic Patterns

### Domain-Driven Design Patterns

1. **Aggregate Pattern**: AutonomousStateMachine is consistency boundary
2. **Event Sourcing**: State transitions stored as event log
3. **CQRS**: Separate read models for swarm monitoring
4. **Saga**: Distributed transaction across contexts
5. **Policy**: State transition rules as policy objects

### Learning Patterns

1. **Q-Learning**: Model-free RL for action selection
2. **Experience Replay**: TrajectoryBuffer for sample efficiency
3. **Federated Learning**: Peer-to-peer Q-table merging
4. **Epsilon Annealing**: Decay exploration over time
5. **Priority Replay**: High-value trajectories prioritized

### Coordination Patterns

1. **HNSW Routing**: Semantic similarity-based routing
2. **Byzantine Consensus**: Fault-tolerant decision making
3. **Topology Management**: Adaptive network reconfiguration
4. **Gossip Protocol**: O(log N) state dissemination
5. **Leader Election**: Raft for coordinator selection

## Implementation Notes

### Technology Stack
- **Language**: TypeScript 5.3+
- **Runtime**: Bun (WASM-compatible)
- **Persistence**: SQLite (event sourcing)
- **Vector Search**: HNSW (AgentDB)
- **WASM**: Rust for performance-critical operations

### Performance Considerations
- State transition validation: <1ms
- Q-table lookup: O(1) hash map
- Trajectory replay: O(n) sampling
- Swarm routing: O(log n) HNSW
- Federated merge: O(m) where m = peer entries

### Scalability Limits
- Max agents: 593 (feature registry size)
- Max Q-table entries: 10,000 per agent
- Trajectory buffer: 1,000 per agent
- Swarm topologies: 3 (mesh, hierarchical, hierarchical-mesh)
- Consensus participants: Up to swarm size

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-11
**Related Documents**:
- `/Users/cedric/dev/2026/test-cfv3/docs/ddd/autonomous-state-machine-model.ts` - Domain Model Implementation
- `/Users/cedric/dev/2026/test-cfv3/src/domains/agent-lifecycle/` - TypeScript Implementation
- `/Users/cedric/dev/2026/test-cfv3/.claude/agents/goal/ran-autonomic-agent.md` - Goal Agent Spec
