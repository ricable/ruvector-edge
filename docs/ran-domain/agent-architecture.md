# RAN Agent Architecture - 250 Specialized AI Agents

## System Overview

The RAN (Radio Access Network) AI Agent system implements 250 specialized autonomous agents for Ericsson LTE/NR feature optimization. Each agent masters specific RAN features using Domain-Driven Design (DDD) patterns, Q-learning reinforcement algorithms, and OODA loop autonomous decision-making.

### Architecture Summary

```
+======================================================================================+
|                        RAN AI AGENT SYSTEM - 250 AGENTS                             |
+======================================================================================+
|                                                                                      |
|  +----------------------------------------------------------------------------------+  |
|  |                           KNOWLEDGE BOUNDED CONTEXT                              |  |
|  |                                                                                    |  |
|  |  250 Feature Agents (50 LTE Features x 5 Questions Each)                         |  |
|  |  - 593 Ericsson Features (593 agents in full system)                             |  |
|  |  - 9,432 Parameters                                                              |  |
|  |  - 3,368 Counters                                                                 |  |
|  |  - 752 MO Classes                                                                 |  |
|  |  - 199 KPIs                                                                       |  |
|  |  - 118 Technical Documents                                                        |  |
|  +----------------------------------------------------------------------------------+  |
|                                      |                                               |
|                                      v                                               |
|  +----------------------------------------------------------------------------------+  |
|  |                        INTELLIGENCE BOUNDED CONTEXT                               |  |
|  |                                                                                    |  |
|  |  Q-Learning Engine          OODA Loop                  Federated Learning         |  |
|  |  - State-Action Values      - Observe                  - Peer Sync                |  |
|  |  - Epsilon-Greedy           - Orient                   - Pattern Sharing          |  |
|  |  - Bellman Updates          - Decide                   - Knowledge Merge          |  |
|  |  - Trajectory Replay        - Act                      - Consensus                |  |
|  +----------------------------------------------------------------------------------+  |
|                                      |                                               |
|                                      v                                               |
|  +----------------------------------------------------------------------------------+  |
|  |                       OPTIMIZATION BOUNDED CONTEXT                                 |  |
|  |                                                                                    |  |
|  |  KPI Monitor                 Root Cause Analyzer        Safe Zone Manager          |  |
|  |  - Threshold Detection       - Min-Cut Analysis          - Parameter Bounds        |  |
|  |  - Anomaly Detection         - Dependency Tracing        - Change Validation       |  |
|  |  - Trend Analysis            - Impact Assessment         - Rollback Protection     |  |
|  +----------------------------------------------------------------------------------+  |
|                                      |                                               |
|                                      v                                               |
|  +----------------------------------------------------------------------------------+  |
|  |                     COORDINATION BOUNDED CONTEXT                                   |  |
|  |                                                                                    |  |
|  |  Swarm Manager               Consensus Protocol         Semantic Router            |  |
|  |  - Topology Management       - Byzantine Fault Tol.      - HNSW Indexing           |  |
|  |  - Agent Lifecycle           - Raft/Gossip/CRDT          - Vector Search           |  |
|  |  - Health Monitoring         - Quorum Voting             - Feature Matching        |  |
|  +----------------------------------------------------------------------------------+  |
|                                      |                                               |
|                                      v                                               |
|  +----------------------------------------------------------------------------------+  |
|  |                       MEMORY SYSTEM (AgentDB + HNSW)                               |  |
|  |                                                                                    |  |
|  |  - 150x-12,500x Faster Search (HNSW Indexing)                                    |  |
|  |  - Hybrid Backend (In-Memory + Persistent)                                       |  |
|  |  - Pattern Learning Storage                                                      |  |
|  |  - Q-Table Persistence                                                           |  |
|  +----------------------------------------------------------------------------------+  |
|                                                                                      |
+======================================================================================+
```

## Bounded Context Mapping

### Knowledge Context (Core Domain)

**Responsibility**: Manage 250-593 specialized feature agents, each mastering a specific Ericsson RAN feature.

**Aggregate Roots**:
- `EnhancedFeatureAgent` - Manages feature knowledge, queries, and responses
- `FeatureAgent` - Base agent with knowledge base and HNSW indexing

**Entities**:
- `Feature` - RAN feature with FAJ code, parameters, counters
- `Parameter` - Tunable configuration values with bounds
- `Counter` - Performance metrics collection
- `KPI` - Key Performance Indicators

**Value Objects**:
- `FAJCode` - Ericsson feature identifier (FAJ XXX YYYY format)
- `Query` - User query with type and complexity
- `Response` - Agent response with confidence and action
- `ComplexityLevel` - Simple, Moderate, Complex, Expert

**Key Capabilities**:
```typescript
// Enhanced feature agent with autonomous state machine
const agent = EnhancedFeatureAgent.createEnhanced({
  fajCode: FAJCode.new('FAJ 121 3094'),
  acronym: 'MSM',
  name: 'MIMO Sleep Mode',
  type: AccessTechnology.LTE,
  category: Category.ENERGY_SAVING,
  stateMachineConfig: {
    coldStartThreshold: 3,
    degradedThreshold: 0.5,
    explorationBaseRate: 0.1,
    recoveryThreshold: 0.3
  }
});

// Handle query with OODA loop
const response = await agent.handleQueryEnhanced({
  id: 'query-1',
  type: QueryType.PARAMETER_CONFIGURATION,
  content: 'What are the activation prerequisites for MIMO Sleep Mode?',
  complexity: ComplexityLevel.MODERATE,
  timestamp: new Date()
});
```

**Domain Events**:
```typescript
interface FeatureLoadedEvent {
  type: 'FeatureLoaded';
  agentId: string;
  fajCode: string;
  featureName: string;
  parameterCount: number;
  counterCount: number;
  timestamp: Date;
}

interface QueryProcessedEvent {
  type: 'QueryProcessed';
  agentId: string;
  queryId: string;
  confidence: number;
  actionTaken: string;
  latencyMs: number;
  timestamp: Date;
}
```

### Intelligence Context (Core Domain)

**Responsibility**: Self-learning capabilities including Q-learning, trajectory replay, pattern recognition, and federated learning.

**Aggregate Roots**:
- `AutonomousStateMachine` - OODA loop execution and state transitions
- `QTable` - State-action value storage and updates
- `TrajectoryBuffer` - Experience replay for learning
- `FederatedMerger` - Peer-to-peer knowledge synchronization

**Entities**:
- `QEntry` - Individual Q-value entry
- `Trajectory` - Sequence of state-action-reward transitions

**Value Objects**:
- `State` - Agent state representation
- `Action` - Agent action (DirectAnswer, ConsultPeer, etc.)
- `Reward` - Reinforcement learning reward signal
- `Observations` - OODA Observe phase output
- `Orientation` - OODA Orient phase output
- `Decision` - OODA Decide phase output

**Agent Lifecycle**:
```typescript
enum AgentState {
  INITIALIZING = 'initializing',    // Loading knowledge base
  COLD_START = 'cold_start',        // First 100 interactions (ε=0.3)
  READY = 'ready',                  // Normal operation (ε=0.1)
  BUSY = 'busy',                    // Processing query
  DEGRADED = 'degraded',            // Performance < 0.5 health
  RECOVERING = 'recovering',        // Recovery protocol active
  FAILED = 'failed'                 // Critical error
}
```

**OODA Loop Integration**:
```typescript
// OODA Loop executed per query
const observations = stateMachine.observe(currentState);
const orientation = stateMachine.orient(observations);
const decision = stateMachine.decide(orientation);
const actionResult = stateMachine.act(decision);

// Q-learning update
const reward = Reward.fromActionResult(actionResult);
qTable.update(currentState, action, reward, nextState);
```

**Q-Learning Configuration**:
```typescript
interface QTableConfig {
  readonly alpha: number;           // Learning rate (default: 0.1)
  readonly gamma: number;           // Discount factor (default: 0.9)
  readonly epsilon: number;         // Exploration rate (ColdStart: 0.3, Ready: 0.1)
  readonly epsilonDecay: number;    // Decay factor (default: 0.995)
  readonly minEpsilon: number;      // Minimum exploration (default: 0.01)
}
```

### Optimization Context (Core Domain)

**Responsibility**: KPI monitoring, root cause analysis, parameter optimization, and network integrity assessment.

**Aggregate Roots**:
- `OptimizationCycle` - Closed-loop optimization (6 phases)
- `CAOptimizer` - Carrier Aggregation optimization
- `HandoverOptimizer` - Mobility parameter tuning

**Entities**:
- `KPIMonitor` - KPI collection and threshold checking
- `RootCauseAnalyzer` - Min-cut based root cause identification

**Value Objects**:
- `SafeZone` - Parameter safe operating boundaries
- `OptimizationRecommendation` - Action proposal with risk assessment
- `RollbackPoint` - Safe state for recovery

**Optimization Cycle**:
```typescript
enum OptimizationPhase {
  OBSERVE = 'observe',      // 1. Collect KPIs, counters, alarms
  ANALYZE = 'analyze',      // 2. Detect anomalies, root causes
  DECIDE = 'decide',        // 3. Route to agents, assess risk
  ACT = 'act',              // 4. Execute cmedit, set timer
  LEARN = 'learn',          // 5. Measure delta, update Q-table
  REPEAT = 'repeat'         // 6. Continuous cycle
}
```

### Coordination Context (Supporting Domain)

**Responsibility**: Semantic routing, consensus protocols, P2P transport, and swarm topology management.

**Aggregate Roots**:
- `Swarm` - Agent coordination and topology management
- `DomainEventBus` - Event-driven communication

**Value Objects**:
- `Topology` - Mesh, Hierarchical, Sharded, HierarchicalMesh
- `ConsensusStrategy` - Byzantine, Raft, Gossip, CRDT, Quorum

**Topologies**:
```typescript
type Topology =
  | 'Mesh'                       // Fully connected (HNSW routing)
  | 'Hierarchical'               // Single coordinator
  | 'Sharded'                    // Multiple shards
  | 'HierarchicalMesh';          // Hybrid (recommended for 250 agents)

interface HierarchicalMeshTopology {
  coordinators: string[];        // Coordinator agents
  meshAgents: string[];          // Mesh-connected agents
  semanticFallback: boolean;     // Use HNSW if coord fails
}
```

## Agent Lifecycle

### Initialization Flow

```typescript
// 1. Create agent with autonomous state machine
const agent = EnhancedFeatureAgent.createEnhanced({
  fajCode: FAJCode.new('FAJ 121 3094'),
  acronym: 'MSM',
  name: 'MIMO Sleep Mode',
  type: AccessTechnology.LTE,
  category: Category.ENERGY_SAVING,
  featureData: feature,
  stateMachineConfig: {
    coldStartThreshold: 3,
    degradedThreshold: 0.5,
    explorationBaseRate: 0.1,
    recoveryThreshold: 0.3
  }
});

// 2. Initialize agent (builds HNSW index)
await agent.initialize();

// 3. State transitions: INITIALIZING -> COLD_START
// Agent is ready to handle queries with high exploration (ε=0.3)
```

### Query Processing Flow

```typescript
// 1. Receive query
const query: Query = {
  id: 'query-1',
  type: QueryType.PARAMETER_CONFIGURATION,
  content: 'What are the activation prerequisites for MIMO Sleep Mode?',
  complexity: ComplexityLevel.MODERATE,
  timestamp: new Date()
};

// 2. Handle query with OODA loop
const response = await agent.handleQueryEnhanced(query);

// 3. Response includes:
// - content: Answer content
// - confidence: 0.0-1.0
// - actionTaken: Action enum
// - stateAtResponse: AgentState
// - consultedPeers: Peer agent IDs
// - sources: FAJ codes, documents
// - cmeditCommands: CLI commands
// - latencyMs: Response time
```

### State Transitions

```
┌──────────────┐
│ INITIALIZING │ (Loading knowledge base, building HNSW index)
└──────┬───────┘
       │ knowledge_loaded
       v
┌──────────────┐
│  COLD_START  │ (First 3-100 queries, ε=0.3)
└──────┬───────┘
       │ threshold_interactions (3-100)
       v
┌──────────────┐
│    READY     │ (Normal operation, ε=0.1)
└──────┬───────┘
       │ query_received
       v
┌──────────────┐
│    BUSY      │ (Processing query)
└──────┬───────┘
       │ query_completed
       v
┌──────────────┐
│    READY     │
└──────┬───────┘
       │ health < 0.5
       v
┌──────────────┐
│  DEGRADED    │ (Recovery protocol)
└──────┬───────┘
       │ health > 0.8
       v
┌──────────────┐
│    READY     │
└──────────────────┘
       │ recovery_failed
       v
┌──────────────┐
│    FAILED    │ (Critical error)
└──────────────┘
```

## Integration with Claude-Flow Memory

### AgentDB Namespace Structure

```typescript
// Memory storage namespaces
const AGENTDB_NAMESPACES = {
  KNOWLEDGE: 'elex-knowledge',           // Feature data, parameters, counters
  INTELLIGENCE: 'elex-intelligence',     // Q-tables, trajectories, patterns
  OPTIMIZATION: 'elex-optimization',     // KPIs, safe zones, recommendations
  COORDINATION: 'elex-coordination',     // Swarm state, topology, consensus
  BATTLE_TEST: 'ran-battle-test',        // Test questions, results, reports
  PATTERNS: 'elex-patterns'              // Learned patterns for reuse
};
```

### HNSW Indexing Configuration

```typescript
interface HNSWConfig {
  readonly M: number;              // Max connections per node (default: 16)
  readonly efConstruction: number; // Build-time accuracy (default: 200)
  readonly efSearch: number;       // Search-time accuracy (default: 50)
  readonly dimensions: number;     // Vector dimensions (default: 128)
}

// 150x-12,500x faster search with HNSW
const vectorSearch = await agentDB.search({
  namespace: 'elex-knowledge',
  query: 'MIMO Sleep Mode activation prerequisites',
  limit: 5,
  threshold: 0.7
});
```

### Memory Storage Pattern

```typescript
// Store feature knowledge
await agentDB.store({
  namespace: 'elex-knowledge',
  key: `feature:${fajCode.toString()}`,
  value: JSON.stringify({
    fajCode: fajCode.toString(),
    acronym: 'MSM',
    name: 'MIMO Sleep Mode',
    category: 'Energy Saving',
    parameters: [...],
    counters: [...],
    embedding: vector128d  // HNSW-indexed
  }),
  tags: ['feature', 'lte', 'energy-saving', 'mimo']
});

// Store Q-table entry after learning
await agentDB.store({
  namespace: 'elex-intelligence',
  key: `qtable:${agentId}:${stateKey}:${actionKey}`,
  value: JSON.stringify({
    qValue: 0.85,
    visitCount: 42,
    lastUpdate: timestamp
  }),
  tags: ['q-learning', 'state-action', agentId]
});

// Store battle test result
await agentDB.store({
  namespace: 'ran-battle-test',
  key: `result:${questionId}:${agentId}`,
  value: JSON.stringify({
    questionId,
    category: 'A',
    confidence: 0.92,
    actionTaken: 'DirectAnswer',
    latencyMs: 45,
    timestamp
  }),
  tags: ['battle-test', 'category-a', questionId]
});
```

### Memory Retrieval Pattern

```typescript
// Search for similar features (semantic)
const similarFeatures = await agentDB.search({
  namespace: 'elex-knowledge',
  query: 'load balancing parameters',
  limit: 10,
  threshold: 0.75
});

// Retrieve Q-table for state-action
const qValue = await agentDB.retrieve({
  namespace: 'elex-intelligence',
  key: `qtable:${agentId}:${stateKey}:${actionKey}`
});

// List battle test results by category
const categoryAResults = await agentDB.list({
  namespace: 'ran-battle-test',
  filter: { tags: ['category-a'] },
  limit: 125
});
```

## CLI Commands for Memory Operations

### Store Operations

```bash
# Store feature knowledge
npx @claude-flow/cli@latest memory store \
  --namespace elex-knowledge \
  --key "feature:FAJ-121-3094" \
  --value '{"fajCode":"FAJ 121 3094","acronym":"MSM",...}' \
  --tags "feature,lte,energy-saving"

# Store Q-table entry
npx @claude-flow/cli@latest memory store \
  --namespace elex-intelligence \
  --key "qtable:agent-msm:state-123:DirectAnswer" \
  --value '{"qValue":0.85,"visitCount":42}' \
  --tags "q-learning,state-action"

# Store battle test result
npx @claude-flow/cli@latest memory store \
  --namespace ran-battle-test \
  --key "result:q1:agent-msm" \
  --value '{"questionId":1,"confidence":0.92,"latencyMs":45}' \
  --tags "battle-test,category-a"
```

### Search Operations

```bash
# Semantic search for features
npx @claude-flow/cli@latest memory search \
  --namespace elex-knowledge \
  --query "MIMO Sleep Mode activation" \
  --limit 5 \
  --threshold 0.7

# Search for battle test results
npx @claude-flow/cli@latest memory search \
  --namespace ran-battle-test \
  --query "Category A knowledge questions" \
  --limit 20

# List all entries in namespace
npx @claude-flow/cli@latest memory list \
  --namespace elex-intelligence \
  --limit 100
```

### Retrieve Operations

```bash
# Retrieve specific feature
npx @claude-flow/cli@latest memory retrieve \
  --namespace elex-knowledge \
  --key "feature:FAJ-121-3094"

# Retrieve Q-table entry
npx @claude-flow/cli@latest memory retrieve \
  --namespace elex-intelligence \
  --key "qtable:agent-msm:state-123:DirectAnswer"
```

## Testing Procedures

### Unit Tests

```typescript
// Test agent creation
describe('EnhancedFeatureAgent', () => {
  it('should create agent with autonomous state machine', async () => {
    const agent = EnhancedFeatureAgent.createEnhanced({
      fajCode: FAJCode.new('FAJ 121 3094'),
      acronym: 'MSM',
      name: 'MIMO Sleep Mode',
      type: AccessTechnology.LTE,
      category: Category.ENERGY_SAVING,
      featureData: mockFeature
    });

    await agent.initialize();

    expect(agent.state).toBe(AgentState.COLD_START);
    expect(agent.health).toBeGreaterThan(0);
  });

  it('should handle query with OODA loop', async () => {
    const response = await agent.handleQueryEnhanced({
      id: 'q1',
      type: QueryType.GENERAL_INFO,
      content: 'What is MIMO Sleep Mode?',
      complexity: ComplexityLevel.SIMPLE,
      timestamp: new Date()
    });

    expect(response.confidence).toBeGreaterThan(0);
    expect(response.actionTaken).toBeDefined();
    expect(response.latencyMs).toBeLessThan(1000);
  });
});
```

### Integration Tests

```typescript
// Test 250-question battle
describe('250-Question Battle Test', () => {
  it('should complete all 250 questions with >0.7 avg confidence', async () => {
    const questions = generate250Questions();
    const agents = LTEFeatureAgentsFactory.createAll();

    let totalConfidence = 0;
    let totalLatency = 0;

    for (const question of questions) {
      const agent = agents.get(question.acronym)!;
      const response = await agent.handleQueryEnhanced(question.toQuery());

      totalConfidence += response.confidence;
      totalLatency += response.latencyMs;
    }

    const avgConfidence = totalConfidence / questions.length;
    const avgLatency = totalLatency / questions.length;

    expect(avgConfidence).toBeGreaterThan(0.7);
    expect(avgLatency).toBeLessThan(500);
  });
});
```

### Battle Test Execution

```bash
# Run 250-question battle test
bun run scripts/run-ran-battle-test.ts

# Run with coverage
bun test tests/knowledge/50-ran-agents-battle-test.spec.ts

# Run specific test
bun test --test-name-pattern "Category A knowledge"
```

## Success Metrics

### Agent Performance Metrics

```typescript
interface AgentMetrics {
  // Query Performance
  averageResponseTime: number;        // Target: < 100ms
  averageConfidence: number;          // Target: > 0.8
  successRate: number;                // Target: > 0.9

  // Learning Metrics
  qTableSize: number;                 // Q-table entries
  explorationRate: number;            // Current epsilon
  averageReward: number;              // Rolling average reward

  // Health Metrics
  health: number;                     // Composite health score
  interactionCount: number;           // Total interactions
  stateDistribution: Record<AgentState, number>;

  // OODA Metrics
  oodaLoopCycles: number;             // Total OODA executions
  averageOODALatency: number;         // Target: < 50ms

  // Battle Test Metrics
  categoryAScore: number;             // Knowledge (0-40)
  categoryBScore: number;             // Decision (0-60)
  categoryCScore: number;             // Advanced (0-60)
  oodaEfficiencyBonus: number;        // +20 if OODA < 100ms
  qLearningConverged: boolean;        // +20 if converged
  crossFeatureCoordination: boolean;  // +20 if coordinated
  totalScore: number;                 // Max 200 per feature
}
```

### System-Level Metrics

```typescript
interface SystemMetrics {
  // Swarm Metrics
  totalAgents: number;                // 250 (50 features x 5 questions)
  activeAgents: number;
  averageHealth: number;

  // Memory Metrics
  memoryUsageMB: number;              // Target: < 500MB
  hnswIndexSize: number;
  averageSearchTime: number;          // Target: < 10ms

  // Learning Metrics
  federatedSyncs: number;
  patternsStored: number;
  averageConvergenceRate: number;

  // Battle Test Metrics
  totalQuestions: number;             // 250
  avgCategoryAConfidence: number;     // Target: > 0.85
  avgCategoryBConfidence: number;     // Target: > 0.75
  avgCategoryCConfidence: number;     // Target: > 0.70
  totalTestTime: number;              // Target: < 10 minutes
}
```

## Architecture Diagrams

### Agent Internal Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EnhancedFeatureAgent                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Knowledge Base (HNSW-Indexed)              │   │
│  │  - Feature Data (FAJ, Parameters, Counters)             │   │
│  │  - Vector Embeddings (128-dim)                          │   │
│  │  - Semantic Search Index                               │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                        │
│  ┌────────────────────▼────────────────────────────────────┐   │
│  │         AutonomousStateMachine (OODA Loop)              │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Observe  │─▶│ Orient   │─▶│ Decide   │─▶│  Act   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  │       │             │             │            │        │   │
│  │       v             v             v            v        │   │
│  │  Observations  Orientation    Decision   ActionResult │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                        │
│  ┌────────────────────▼────────────────────────────────────┐   │
│  │                  Q-Table                                │   │
│  │  - State-Action Values                                  │   │
│  │  - Epsilon-Greedy Selection                              │   │
│  │  - Bellman Updates                                       │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                        │
│  ┌────────────────────▼────────────────────────────────────┐   │
│  │               Trajectory Buffer                         │   │
│  │  - Experience Replay                                     │   │
│  │  - Pattern Learning                                      │   │
│  │  - Federated Sync                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent Coordination

```
┌─────────────────────────────────────────────────────────────────┐
│                      Swarm Coordination                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   HierarchicalMesh                       │   │
│  │                                                          │   │
│  │  ┌──────────────┐        ┌──────────────┐              │   │
│  │  │ Coordinator  │        │ Coordinator  │              │   │
│  │  │     1       │◀──────▶│     2       │              │   │
│  │  └──────┬───────┘        └──────┬───────┘              │   │
│  │         │                       │                       │   │
│  │         └───────────┬───────────┘                       │   │
│  │                     │                                   │   │
│  │    ┌────────────────┼────────────────┐                 │   │
│  │    │                │                │                 │   │
│  │    v                v                v                 │   │
│  │  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐              │   │
│  │  │MSM │  │ P  │  │DPUC│  │CIBL│  │TMS │ ... 250 agents │   │
│  │  └────┘  └────┘  └────┘  └────┘  └────┘              │   │
│  │                                                          │   │
│  │  HNSW Semantic Router:                                   │   │
│  │  - Query embedding                                       │   │
│  │  - Vector similarity search                              │   │
│  │  - Top-K agent selection                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## References

- ADR-024: Autonomous State Machine
- ADR-025: RAN Battle Testing Framework
- ADR-107: Domain-Driven Design Structure
- docs/ddd/bounded-contexts.md
- docs/ddd/context-map.md
- docs/ddd/context-knowledge.md
- docs/elex-development.md
