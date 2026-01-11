# RAN Agent Memory Guide - AgentDB Integration

## Overview

This guide explains how RAN AI agents integrate with AgentDB for persistent memory storage, HNSW-accelerated vector search, and pattern learning. The memory system enables agents to learn from interactions, share knowledge via federated learning, and maintain state across sessions.

## AgentDB Namespace Structure

The RAN agent system uses structured namespaces to organize different types of data:

```
┌─────────────────────────────────────────────────────────────┐
│                   AGENTDB NAMESPACES                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  elex-knowledge          Feature data, parameters, counters │
│  elex-intelligence       Q-tables, trajectories, patterns   │
│  elex-optimization       KPIs, safe zones, recommendations  │
│  elex-coordination       Swarm state, topology, consensus    │
│  ran-battle-test         Test questions, results, reports    │
│  elex-patterns           Learned patterns for reuse         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Namespace: elex-knowledge

**Purpose**: Store feature-specific knowledge including parameters, counters, KPIs, and procedures.

**Data Structure**:
```typescript
interface FeatureKnowledge {
  readonly fajCode: string;
  readonly acronym: string;
  readonly name: string;
  readonly category: string;
  readonly domain: string;

  // Feature metadata
  readonly parameters: Parameter[];
  readonly counters: Counter[];
  readonly kpis: KPI[];
  readonly moClasses: string[];

  // Vector embedding for HNSW search
  readonly embedding: Float32Array; // 128-dimensional vector

  // Documentation references
  readonly documents: DocumentReference[];
  readonly procedures: ActivationProcedure[];

  // Dependencies
  readonly requiredFeatures: string[];
  readonly optionalFeatures: string[];
  readonly conflictingFeatures: string[];
}

interface Parameter {
  readonly name: string;
  readonly moPath: string;
  readonly dataType: 'integer' | 'float' | 'boolean' | 'enum';
  readonly defaultValue: number | boolean | string;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly allowedValues?: (number | string)[];
  readonly description: string;
  readonly impact: 'high' | 'medium' | 'low';
}

interface Counter {
  readonly name: string;
  readonly pmPrefix: string;
  readonly description: string;
  readonly collectionInterval: number; // seconds
  readonly aggregationType: 'sum' | 'avg' | 'rate';
  readonly relatedKPIs: string[];
}
```

**Storage Pattern**:
```typescript
await agentDB.store({
  namespace: 'elex-knowledge',
  key: `feature:${fajCode.toString().replace(/\s/g, '-')}`,
  value: JSON.stringify({
    fajCode: 'FAJ 121 3094',
    acronym: 'MSM',
    name: 'MIMO Sleep Mode',
    category: 'Energy Saving',
    domain: 'LTE',
    parameters: [
      {
        name: 'mimoSleepMode',
        moPath: 'EnodeBFunction=1,EutranCellFDD=1',
        dataType: 'enum',
        defaultValue: 0,
        allowedValues: [0, 1, 2],
        description: 'MIMO sleep mode activation',
        impact: 'high'
      },
      // ... more parameters
    ],
    counters: [
      {
        name: 'pmMimoSleepTransition',
        pmPrefix: 'pm',
        description: 'MIMO sleep state transitions',
        collectionInterval: 900,
        aggregationType: 'sum',
        relatedKPIs: ['MimoSleepActivationRate', 'EnergySavingRatio']
      }
      // ... more counters
    ],
    embedding: new Float32Array(128), // HNSW-indexed
    documents: [
      { fajCode: 'FAJ 121 3094', type: 'Feature Description' }
    ],
    requiredFeatures: [],
    optionalFeatures: ['EE', 'MST'],
    conflictingFeatures: []
  }),
  tags: ['feature', 'lte', 'energy-saving', 'mimo', 'sleep-mode']
});
```

**Retrieval Pattern**:
```typescript
// Retrieve specific feature
const feature = await agentDB.retrieve({
  namespace: 'elex-knowledge',
  key: 'feature:FAJ-121-3094'
});

// Semantic search for similar features
const similarFeatures = await agentDB.search({
  namespace: 'elex-knowledge',
  query: 'load balancing energy saving',
  limit: 5,
  threshold: 0.75
});

// List features by category
const energyFeatures = await agentDB.list({
  namespace: 'elex-knowledge',
  filter: { tags: ['energy-saving'] },
  limit: 50
});
```

### Namespace: elex-intelligence

**Purpose**: Store Q-learning data, trajectories, and learned patterns.

**Data Structure**:
```typescript
interface QTableEntry {
  readonly agentId: string;
  readonly stateKey: string;
  readonly actionKey: string;

  // Q-value
  readonly qValue: number;
  readonly visitCount: number;
  readonly lastUpdate: Date;

  // Learning metadata
  readonly averageReward: number;
  readonly explorationRate: number;
  readonly convergenceScore: number;
}

interface Trajectory {
  readonly id: string;
  readonly agentId: string;
  readonly startTime: Date;
  readonly endTime: Date;

  // State-action-reward sequence
  readonly steps: TrajectoryStep[];

  // Performance metrics
  readonly cumulativeReward: number;
  readonly averageReward: number;
  readonly success: boolean;
}

interface TrajectoryStep {
  readonly timestamp: number;
  readonly state: State;
  readonly action: Action;
  readonly reward: number;
  readonly nextState: State;
  readonly done: boolean;
}

interface LearnedPattern {
  readonly id: string;
  readonly type: 'q-trajectory' | 'decision' | 'optimization';
  readonly pattern: string;

  // Pattern metadata
  readonly frequency: number;
  readonly successRate: number;
  readonly reward: number;

  // Vector embedding
  readonly embedding: Float32Array;
}
```

**Storage Pattern**:
```typescript
// Store Q-table entry after learning
await agentDB.store({
  namespace: 'elex-intelligence',
  key: `qtable:${agentId}:${stateKey}:${actionKey}`,
  value: JSON.stringify({
    agentId: 'agent-msm',
    stateKey: 'state:query:parameter:low-traffic',
    actionKey: 'DirectAnswer',
    qValue: 0.85,
    visitCount: 42,
    lastUpdate: new Date().toISOString(),
    averageReward: 0.82,
    explorationRate: 0.1,
    convergenceScore: 0.9
  }),
  tags: ['q-learning', 'state-action', 'msm', 'converged']
});

// Store trajectory after episode completion
await agentDB.store({
  namespace: 'elex-intelligence',
  key: `trajectory:${agentId}:${trajectoryId}`,
  value: JSON.stringify({
    id: trajectoryId,
    agentId: 'agent-msm',
    startTime: episodeStart.toISOString(),
    endTime: episodeEnd.toISOString(),
    steps: trajectorySteps,
    cumulativeReward: 42.5,
    averageReward: 0.85,
    success: true
  }),
  tags: ['trajectory', 'msm', 'successful']
});

// Store learned pattern
await agentDB.store({
  namespace: 'elex-intelligence',
  key: `pattern:${patternId}`,
  value: JSON.stringify({
    id: patternId,
    type: 'q-trajectory',
    pattern: 'low-traffic + energy-saving-question -> DirectAnswer',
    frequency: 25,
    successRate: 0.92,
    reward: 0.88,
    embedding: new Float32Array(128)
  }),
  tags: ['pattern', 'msm', 'low-traffic', 'energy-saving']
});
```

**Retrieval Pattern**:
```typescript
// Retrieve Q-value for state-action
const qEntry = await agentDB.retrieve({
  namespace: 'elex-intelligence',
  key: 'qtable:agent-msm:state:query:parameter:low-traffic:DirectAnswer'
});

// Search for similar patterns
const similarPatterns = await agentDB.search({
  namespace: 'elex-intelligence',
  query: 'energy saving activation decision',
  limit: 10
});

// List all trajectories for an agent
const trajectories = await agentDB.list({
  namespace: 'elex-intelligence',
  filter: { tags: ['msm', 'trajectory'] },
  limit: 100
});
```

### Namespace: ran-battle-test

**Purpose**: Store battle test questions, results, and reports.

**Data Structure**:
```typescript
interface BattleQuestion {
  readonly id: string;
  readonly category: 'A' | 'B' | 'C';
  readonly type: string;
  readonly question: string;
  readonly acronym: string;
  readonly featureName: string;
  readonly fajCode: string;
  readonly expectedElements: string[];
  readonly scoringCriteria: Record<string, number>;
}

interface BattleTestResult {
  readonly questionId: string;
  readonly agentId: string;
  readonly acronym: string;

  // Response metrics
  readonly responseTime: number;
  readonly confidence: number;
  readonly actionTaken: string;
  readonly stateAtResponse: string;
  readonly oodaExecuted: boolean;

  // Content
  readonly response: string;
  readonly consultedPeers: string[];
  readonly sources: string[];

  // Timestamp
  readonly timestamp: Date;
}

interface BattleTestReport {
  readonly timestamp: Date;
  readonly totalAgents: number;
  readonly totalQuestions: number;
  readonly results: BattleTestResult[];
  readonly summary: BattleTestSummary;
}
```

**Storage Pattern**:
```typescript
// Store battle test result
await agentDB.store({
  namespace: 'ran-battle-test',
  key: `result:${questionId}:${agentId}`,
  value: JSON.stringify({
    questionId: 'q1',
    agentId: 'agent-msm',
    acronym: 'MSM',
    responseTime: 45,
    confidence: 0.92,
    actionTaken: 'DirectAnswer',
    stateAtResponse: 'READY',
    oodaExecuted: true,
    response: 'MIMO Sleep Mode requires...',
    consultedPeers: [],
    sources: ['FAJ 121 3094'],
    timestamp: new Date().toISOString()
  }),
  tags: ['battle-test', 'category-a', 'msm', 'result']
});

// Store battle test report
await agentDB.store({
  namespace: 'ran-battle-test',
  key: `report:${Date.now()}`,
  value: JSON.stringify({
    timestamp: new Date().toISOString(),
    totalAgents: 50,
    totalQuestions: 250,
    results: allResults,
    summary: {
      totalTests: 250,
      avgResponseTime: 67.5,
      avgConfidence: 0.87,
      categoryBreakdown: {
        categoryA: { count: 125, avgConfidence: 0.91 },
        categoryB: { count: 75, avgConfidence: 0.85 },
        categoryC: { count: 150, avgConfidence: 0.82 }
      }
    }
  }),
  tags: ['battle-test', 'report', '250-questions']
});
```

## HNSW Indexing Configuration

HNSW (Hierarchical Navigable Small World) graphs provide 150x-12,500x faster vector search compared to brute-force methods.

### Configuration Parameters

```typescript
interface HNSWConfig {
  // Graph connectivity
  readonly M: number;              // Max connections per node (default: 16)

  // Accuracy parameters
  readonly efConstruction: number; // Build-time accuracy (default: 200)
  readonly efSearch: number;       // Search-time accuracy (default: 50)

  // Vector dimensions
  readonly dimensions: number;     // Vector dimensions (default: 128)

  // Performance tuning
  readonly seed: number;           // Random seed for reproducibility
}
```

### Indexing Strategy

```typescript
// Create vector embedding for feature
async function createFeatureEmbedding(feature: FeatureKnowledge): Promise<Float32Array> {
  const text = [
    feature.name,
    feature.description,
    ...feature.parameters.map(p => p.name + ' ' + p.description),
    ...feature.counters.map(c => c.name + ' ' + c.description),
    ...feature.kpis.map(k => k.name + ' ' + k.description)
  ].join(' ');

  // Use text embedding model (e.g., Universal Sentence Encoder)
  const embedding = await embedText(text, { dimensions: 128 });
  return new Float32Array(embedding);
}

// Index feature with HNSW
async function indexFeature(feature: FeatureKnowledge): Promise<void> {
  const embedding = await createFeatureEmbedding(feature);

  await agentDB.store({
    namespace: 'elex-knowledge',
    key: `feature:${feature.fajCode.replace(/\s/g, '-')}`,
    value: JSON.stringify({
      ...feature,
      embedding: Array.from(embedding) // Store as array for JSON serialization
    }),
    tags: [...feature.tags, 'indexed']
  });

  // HNSW indexing is automatic on store
}
```

### Search Performance

```
┌─────────────────────────────────────────────────────────────┐
│                   HNSW SEARCH PERFORMANCE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Brute Force (593 features)                                 │
│  - Search time: ~1000ms                                     │
│  - Accuracy: 100%                                           │
│                                                             │
│  HNSW (M=16, efConstruction=200, efSearch=50)               │
│  - Search time: ~8ms (125x faster)                          │
│  - Accuracy: 95%+                                           │
│                                                             │
│  HNSW (M=32, efConstruction=400, efSearch=100)              │
│  - Search time: ~2ms (500x faster)                          │
│  - Accuracy: 99%+                                           │
│                                                             │
│  Recommended Configuration                                  │
│  - M: 16 (balance speed/memory)                             │
│  - efConstruction: 200 (good accuracy)                      │
│  - efSearch: 50 (fast search)                               │
│  - Expected speedup: 150x                                   │
│  - Expected accuracy: 95%+                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Memory Search Queries

### Semantic Search

```typescript
// Search for similar features using natural language
const results = await agentDB.search({
  namespace: 'elex-knowledge',
  query: 'energy saving features for MIMO',
  limit: 5,
  threshold: 0.75
});

// Returns:
// [
//   { key: 'feature:FAJ-121-3094', score: 0.92, value: {...} },  // MSM
//   { key: 'feature:FAJ-121-4390', score: 0.88, value: {...} },  // EE
//   { key: 'feature:FAJ-121-3089', score: 0.85, value: {...} },  // MST
//   ...
// ]
```

### Tag-Based Filtering

```typescript
// List features by category
const energyFeatures = await agentDB.list({
  namespace: 'elex-knowledge',
  filter: { tags: ['energy-saving'] },
  limit: 50
});

// List all battle test results
const allResults = await agentDB.list({
  namespace: 'ran-battle-test',
  filter: { tags: ['battle-test', 'result'] },
  limit: 1000
});

// List converged Q-table entries
const convergedEntries = await agentDB.list({
  namespace: 'elex-intelligence',
  filter: { tags: ['converged'] },
  limit: 500
});
```

### Composite Queries

```typescript
// Search energy features with high confidence
const energyHighConfidence = await agentDB.search({
  namespace: 'ran-battle-test',
  query: 'energy saving',
  filter: {
    tags: ['category-a'],
    minConfidence: 0.85
  },
  limit: 20
});

// Search failed optimizations
const failedOptimizations = await agentDB.search({
  namespace: 'elex-optimization',
  query: 'optimization failed rollback',
  filter: {
    tags: ['rollback', 'failed']
  },
  limit: 50
});
```

## Pattern Learning Workflow

### 1. Trajectory Recording

```typescript
// Record trajectory during agent interactions
class TrajectoryRecorder {
  private steps: TrajectoryStep[] = [];

  async recordStep(
    state: State,
    action: Action,
    reward: number,
    nextState: State
  ): Promise<void> {
    this.steps.push({
      timestamp: Date.now(),
      state,
      action,
      reward,
      nextState,
      done: false
    });
  }

  async completeTrajectory(agentId: string): Promise<string> {
    const trajectory: Trajectory = {
      id: `traj-${Date.now()}`,
      agentId,
      startTime: new Date(this.steps[0].timestamp),
      endTime: new Date(this.steps[this.steps.length - 1].timestamp),
      steps: this.steps,
      cumulativeReward: this.steps.reduce((sum, s) => sum + s.reward, 0),
      averageReward: this.steps.reduce((sum, s) => sum + s.reward, 0) / this.steps.length,
      success: this.steps[this.steps.length - 1].reward > 0
    };

    // Store trajectory
    await agentDB.store({
      namespace: 'elex-intelligence',
      key: `trajectory:${agentId}:${trajectory.id}`,
      value: JSON.stringify(trajectory),
      tags: ['trajectory', agentId, trajectory.success ? 'successful' : 'failed']
    });

    return trajectory.id;
  }
}
```

### 2. Pattern Extraction

```typescript
// Extract patterns from trajectories
class PatternExtractor {
  async extractPatterns(trajectories: Trajectory[]): Promise<LearnedPattern[]> {
    const patterns: Map<string, LearnedPattern> = new Map();

    // Group trajectories by state-action sequences
    for (const trajectory of trajectories) {
      const patternKey = this.generatePatternKey(trajectory.steps);

      const existing = patterns.get(patternKey);
      if (existing) {
        // Update pattern statistics
        existing.frequency++;
        existing.successRate =
          (existing.successRate * (existing.frequency - 1) +
           (trajectory.success ? 1 : 0)) / existing.frequency;
        existing.reward =
          (existing.reward * (existing.frequency - 1) +
           trajectory.averageReward) / existing.frequency;
      } else {
        // Create new pattern
        const embedding = await this.createPatternEmbedding(trajectory.steps);
        patterns.set(patternKey, {
          id: `pattern-${Date.now()}-${Math.random()}`,
          type: 'q-trajectory',
          pattern: patternKey,
          frequency: 1,
          successRate: trajectory.success ? 1 : 0,
          reward: trajectory.averageReward,
          embedding
        });
      }
    }

    return Array.from(patterns.values());
  }

  private generatePatternKey(steps: TrajectoryStep[]): string {
    // Generate key from state-action sequence
    return steps
      .slice(0, 5) // First 5 steps
      .map(s => `${s.state.key}:${s.action.name}`)
      .join(' -> ');
  }

  private async createPatternEmbedding(steps: TrajectoryStep[]): Promise<Float32Array> {
    const text = steps
      .map(s => `${s.state.description} ${s.action.description}`)
      .join(' ');
    return await embedText(text, { dimensions: 128 });
  }
}
```

### 3. Pattern Retrieval

```typescript
// Retrieve similar patterns for decision making
async function retrieveSimilarPatterns(
  currentState: State,
  limit: number = 10
): Promise<LearnedPattern[]> {
  const stateEmbedding = await embedText(currentState.description, { dimensions: 128 });

  const results = await agentDB.search({
    namespace: 'elex-intelligence',
    query: currentState.description,
    filter: { tags: ['pattern'] },
    limit,
    threshold: 0.7
  });

  return results.map(r => JSON.parse(r.value));
}
```

## CLI Commands for Memory Operations

### Store Operations

```bash
# Store feature knowledge
npx @claude-flow/cli@latest memory store \
  --namespace elex-knowledge \
  --key "feature:FAJ-121-3094" \
  --value '{"fajCode":"FAJ 121 3094","acronym":"MSM",...}' \
  --tags "feature,lte,energy-saving,mimo"

# Store Q-table entry
npx @claude-flow/cli@latest memory store \
  --namespace elex-intelligence \
  --key "qtable:agent-msm:state-123:DirectAnswer" \
  --value '{"qValue":0.85,"visitCount":42,"convergenceScore":0.9}' \
  --tags "q-learning,state-action,msm,converged"

# Store trajectory
npx @claude-flow/cli@latest memory store \
  --namespace elex-intelligence \
  --key "trajectory:agent-msm:traj-123456" \
  --value '{"cumulativeReward":42.5,"averageReward":0.85,"success":true}' \
  --tags "trajectory,msm,successful"

# Store battle test result
npx @claude-flow/cli@latest memory store \
  --namespace ran-battle-test \
  --key "result:q1:agent-msm" \
  --value '{"confidence":0.92,"responseTime":45,"actionTaken":"DirectAnswer"}' \
  --tags "battle-test,category-a,msm"
```

### Search Operations

```bash
# Semantic search for features
npx @claude-flow/cli@latest memory search \
  --namespace elex-knowledge \
  --query "MIMO Sleep Mode activation" \
  --limit 5 \
  --threshold 0.7

# Search for similar patterns
npx @claude-flow/cli@latest memory search \
  --namespace elex-intelligence \
  --query "low traffic energy saving decision" \
  --limit 10 \
  --threshold 0.75

# Search battle test results
npx @claude-flow/cli@latest memory search \
  --namespace ran-battle-test \
  --query "Category A knowledge questions high confidence" \
  --limit 20
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

# Retrieve trajectory
npx @claude-flow/cli@latest memory retrieve \
  --namespace elex-intelligence \
  --key "trajectory:agent-msm:traj-123456"
```

### List Operations

```bash
# List all features in category
npx @claude-flow/cli@latest memory list \
  --namespace elex-knowledge \
  --filter '{"tags":["energy-saving"]}' \
  --limit 50

# List all battle test results
npx @claude-flow/cli@latest memory list \
  --namespace ran-battle-test \
  --filter '{"tags":["battle-test","result"]}' \
  --limit 250

# List converged Q-table entries
npx @claude-flow/cli@latest memory list \
  --namespace elex-intelligence \
  --filter '{"tags":["converged"]}' \
  --limit 100
```

## Memory Persistence

### Hybrid Backend Configuration

```typescript
interface HybridMemoryConfig {
  // In-memory cache (hot data)
  readonly cacheSizeMB: number;      // Default: 50MB
  readonly cacheTTL: number;          // Default: 3600s (1 hour)

  // Persistent storage (cold data)
  readonly persistPath: string;       // Default: ./data/memory
  readonly persistInterval: number;   // Default: 300s (5 min)

  // HNSW indexing
  readonly hnswConfig: HNSWConfig;

  // Compression
  readonly compressionEnabled: boolean; // Default: true
  readonly compressionLevel: number;    // Default: 6
}
```

### Persistence Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                  MEMORY PERSISTENCE STRATEGY                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hot Data (In-Memory Cache)                                 │
│  - Recent Q-table entries (last 1000)                       │
│  - Active agent states                                      │
│  - Current trajectories                                     │
│  - Battle test results (current session)                    │
│  - Size: ~50MB                                              │
│                                                             │
│  Warm Data (Indexed Storage)                                │
│  - All Q-table entries (HNSW indexed)                       │
│  - Feature embeddings (HNSW indexed)                        │
│  - Learned patterns (HNSW indexed)                          │
│  - Size: ~200MB                                             │
│                                                             │
│  Cold Data (Compressed Archive)                             │
│  - Historical trajectories                                  │
│  - Past battle test reports                                 │
│  - Old optimization logs                                    │
│  - Size: ~250MB                                             │
│                                                             │
│  Total: ~500MB (enforced budget)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## References

- ADR-005: Vector Memory HNSW
- ADR-006: Q-Learning Engine
- ADR-009: Federated Learning
- docs/ran-agent-architecture.md
- docs/ddd/context-knowledge.md
