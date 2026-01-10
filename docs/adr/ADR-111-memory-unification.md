# ADR-111: Memory Unification Strategy

## Status
Proposed

## Date
2026-01-10

## Context

Both ELEX and claude-flow v3 implement sophisticated memory architectures with HNSW vector indexing. This ADR defines how to unify these memory systems to enable cross-system knowledge sharing and avoid duplication.

### ELEX Memory Architecture (ADR-005, ADR-104)
- **4-Layer Memory:**
  - Layer 1: Hot (in-memory cache)
  - Layer 2: Vector Memory (HNSW, 10K vectors/agent)
  - Layer 3: Q-Table Storage
  - Layer 4: Cold Archive
- **HNSW Configuration:** M=16, efConstruction=200, efSearch=50
- **Trajectory Buffer:** 100K experiences per agent with PER
- **EWC++:** Elastic Weight Consolidation for forgetting prevention
- **Total Capacity:** ~5.93M vectors (593 agents x 10K each)

### Claude-Flow V3 Memory (ADR-006)
- **Unified Memory Service:** Single interface, pluggable backends
- **Backends:** SQLite, AgentDB, Hybrid
- **HNSW Configuration:** M=16, efConstruction=200, efSearch=100
- **Schema:** 6 tables (memory_entries, vectors, patterns, sessions, trajectories, metadata)
- **Performance:** 150x-12,500x faster via HNSW, <100ms query latency

### Unification Challenges
1. Different storage formats (ELEX WASM vs Node.js SQLite)
2. Different embedding dimensions (ELEX 128-dim vs claude-flow 768-dim)
3. Namespace collision risk between systems
4. Synchronization timing (ELEX 60s vs claude-flow on-demand)

## Decision

We adopt a **Federated Memory Architecture** where both systems share a common HNSW index while maintaining domain-specific storage layers.

### 1. Unified Storage Schema

```sql
-- Extended schema for ELEX integration
-- (Added to claude-flow's memory.db)

-- ELEX Q-Tables
CREATE TABLE elex_qtables (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    category TEXT NOT NULL,
    feature_faj TEXT NOT NULL,
    qtable_data BLOB,  -- Compressed Q-table
    visit_counts BLOB, -- State-action visit counts
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_elex_agent (agent_id),
    INDEX idx_elex_category (category),
    INDEX idx_elex_faj (feature_faj)
);

-- ELEX Trajectories (experience replay)
CREATE TABLE elex_trajectories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    session_id TEXT,
    state BLOB,         -- 64-dim state vector
    action INTEGER,
    reward REAL,
    next_state BLOB,
    priority REAL,      -- PER priority
    td_error REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_elex_traj_agent (agent_id),
    INDEX idx_elex_traj_priority (priority DESC)
);

-- ELEX KPI Snapshots
CREATE TABLE elex_kpis (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    kpi_value REAL,
    baseline_value REAL,
    deviation_pct REAL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_elex_kpi_agent (agent_id),
    INDEX idx_elex_kpi_name (kpi_name),
    INDEX idx_elex_kpi_time (timestamp)
);

-- ELEX Safe Zone Definitions
CREATE TABLE elex_safe_zones (
    id TEXT PRIMARY KEY,
    parameter_name TEXT NOT NULL UNIQUE,
    min_value REAL,
    max_value REAL,
    default_value REAL,
    blocking_condition TEXT,
    category TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. HNSW Index Unification

```typescript
// Unified HNSW configuration
interface UnifiedHNSWConfig {
  // Shared parameters
  M: 16,
  efConstruction: 200,
  efSearch: 100,
  distanceMetric: 'cosine',

  // Dimension mapping
  dimensions: {
    elex: 128,        // ELEX state vectors
    claudeFlow: 768,  // Claude-flow embeddings
    unified: 768      // Projection target
  },

  // Projection for dimension alignment
  projection: {
    elex128to768: 'learned_projection',  // Trained projection matrix
    claudeFlow768to128: 'pca_reduction'  // For ELEX queries
  }
}

// Unified search interface
interface UnifiedMemorySearch {
  async search(
    query: Float32Array,
    options: {
      namespace?: 'elex' | 'claudeFlow' | 'all',
      k: number,
      efSearch?: number,
      filters?: Record<string, any>
    }
  ): Promise<SearchResult[]>
}
```

### 3. Namespace Strategy

```typescript
// Namespace hierarchy
const namespaceHierarchy = {
  // ELEX namespaces
  'elex': {
    'qtables': 'elex.qtables',
    'trajectories': 'elex.trajectories',
    'patterns': 'elex.patterns',
    'kpis': 'elex.kpis',
    'safe_zones': 'elex.safe_zones',
    // Category-specific
    'ca': 'elex.ca',        // Carrier Aggregation
    'mimo': 'elex.mimo',
    'lb': 'elex.lb',        // Load Balancing
    'es': 'elex.es',        // Energy Saving
  },

  // Claude-flow namespaces
  'claudeFlow': {
    'patterns': 'cf.patterns',
    'sessions': 'cf.sessions',
    'tasks': 'cf.tasks',
    'agents': 'cf.agents',
  },

  // Shared namespaces
  'shared': {
    'cross_domain': 'shared.cross_domain',
    'federated': 'shared.federated',
  }
};
```

### 4. Memory Bridge Service

```typescript
// memory-bridge.ts
import { UnifiedMemoryService } from '@claude-flow/memory';
import { ElexMemoryAdapter } from './elex-memory-adapter';

export class MemoryBridge {
  private cfMemory: UnifiedMemoryService;
  private elexAdapter: ElexMemoryAdapter;
  private projectionMatrix: Float32Array;

  constructor(config: MemoryBridgeConfig) {
    this.cfMemory = new UnifiedMemoryService(config.claudeFlow);
    this.elexAdapter = new ElexMemoryAdapter(config.elex);
    this.projectionMatrix = loadProjectionMatrix(config.projectionPath);
  }

  // Store ELEX Q-table with projection
  async storeQTable(agentId: string, qTable: QTable): Promise<void> {
    // Store raw Q-table in ELEX format
    await this.cfMemory.store({
      namespace: 'elex.qtables',
      key: agentId,
      content: qTable.serialize(),
      metadata: {
        category: qTable.category,
        faj: qTable.faj,
        version: qTable.version
      }
    });

    // Project state vectors for cross-system search
    const projectedVectors = qTable.states.map(state =>
      this.projectTo768(state)
    );

    // Index projected vectors
    await this.cfMemory.indexVectors(projectedVectors, {
      namespace: 'elex.qtables.vectors',
      metadata: { agentId, type: 'q-state' }
    });
  }

  // Unified semantic search across both systems
  async searchUnified(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.cfMemory.embed(query);

    // Search both namespaces in parallel
    const [cfResults, elexResults] = await Promise.all([
      this.cfMemory.searchSemantic(queryEmbedding, {
        namespace: options.claudeFlowNamespace,
        k: options.k
      }),
      this.searchElexWithProjection(queryEmbedding, {
        namespace: options.elexNamespace,
        k: options.k
      })
    ]);

    // Merge and rank results
    return this.mergeResults(cfResults, elexResults, options);
  }

  private projectTo768(vector128: Float32Array): Float32Array {
    // Linear projection: 128-dim -> 768-dim
    const result = new Float32Array(768);
    for (let i = 0; i < 768; i++) {
      let sum = 0;
      for (let j = 0; j < 128; j++) {
        sum += vector128[j] * this.projectionMatrix[i * 128 + j];
      }
      result[i] = sum;
    }
    return result;
  }
}
```

### 5. CLI Commands for Unified Memory

```bash
# Initialize unified memory with ELEX tables
npx @claude-flow/cli@latest memory init --elex-integration

# Store Q-table
npx @claude-flow/cli@latest memory store \
  --namespace elex.qtables \
  --key "IFLB-001" \
  --value "$(cat qtable.json)" \
  --metadata '{"category": "load_balancing", "faj": "FAJ1234567"}'

# Search across both systems
npx @claude-flow/cli@latest memory search \
  --query "MIMO beam optimization patterns" \
  --namespace all \
  --limit 10

# Sync ELEX trajectories
npx @claude-flow/cli@latest memory sync \
  --source elex.trajectories \
  --target shared.federated \
  --batch-size 1000

# Export Q-table for analysis
npx @claude-flow/cli@latest memory retrieve \
  --namespace elex.qtables \
  --key "IFLB-001" \
  --format json
```

### 6. Hooks for Memory Operations

```bash
# Post-edit hook for Q-table updates
npx @claude-flow/cli@latest hooks post-edit \
  --file "qtables/IFLB-001.json" \
  --train-neural true \
  --namespace elex.qtables

# Session end hook for trajectory persistence
npx @claude-flow/cli@latest hooks session-end \
  --persist-state true \
  --export-metrics true \
  --sync-elex-trajectories true

# Worker for memory consolidation
npx @claude-flow/cli@latest hooks worker dispatch \
  --trigger consolidate \
  --context "elex-memory"
```

### 7. EWC++ Integration

```typescript
// Unified EWC++ for both systems
interface UnifiedEWCConfig {
  // Lambda controls importance of old tasks
  lambda: 5000,

  // Fisher information update frequency
  updateFrequency: 1000, // learning steps

  // Per-namespace configurations
  namespaceConfigs: {
    'elex.qtables': {
      lambda: 7500,  // Higher protection for Q-tables
      protectedStates: ['critical', 'safe_zone']
    },
    'cf.patterns': {
      lambda: 3000,  // Lower for general patterns
    }
  }
}

// EWC++ loss computation
function ewcLoss(
  currentParams: Float32Array,
  originalParams: Float32Array,
  fisherDiagonal: Float32Array,
  lambda: number
): number {
  let loss = 0;
  for (let i = 0; i < currentParams.length; i++) {
    const diff = currentParams[i] - originalParams[i];
    loss += fisherDiagonal[i] * diff * diff;
  }
  return 0.5 * lambda * loss;
}
```

## Consequences

### Positive
- **Unified Search:** Single query searches both ELEX and claude-flow data
- **Shared HNSW:** 150x-12,500x faster search across all memory
- **Cross-System Learning:** Patterns from one system inform the other
- **EWC++ Protection:** Prevents catastrophic forgetting across both systems
- **Reduced Duplication:** Shared storage for common patterns

### Negative
- **Projection Overhead:** Dimension projection adds ~5ms per query
- **Storage Complexity:** Additional tables and indexes
- **Sync Latency:** Cross-system sync adds 10-20ms
- **Training Required:** Projection matrix needs training data

### Risks
- **Projection Accuracy:** Poor projection may reduce search quality
- **Namespace Pollution:** Incorrect namespace usage causes data mixing
- **Memory Pressure:** Combined storage may exceed limits
- **Consistency Lag:** Async sync may cause temporary inconsistency

### Mitigations
- **Projection Validation:** Regular accuracy testing against ground truth
- **Namespace Guards:** Strict validation on all write operations
- **Memory Quotas:** Per-namespace storage limits
- **Sync Monitoring:** Alerting on sync lag exceeding thresholds

## Claude-Flow Integration

### Memory Configuration
```json
{
  "memory": {
    "backend": "hybrid",
    "hybridConfig": {
      "structuredBackend": "sqlite",
      "vectorBackend": "agentdb"
    },
    "elexIntegration": {
      "enabled": true,
      "projectionModel": "./models/elex-projection.onnx",
      "syncInterval": 60000,
      "ewcLambda": 5000
    }
  }
}
```

### Performance Targets
| Operation | Target | HNSW Speedup |
|-----------|--------|--------------|
| Q-table lookup | <1ms | 150x |
| Pattern search | <10ms | 2,500x |
| Cross-system search | <50ms | 500x |
| Trajectory query | <5ms | 1,000x |

## References
- ADR-005: HNSW Vector Indexing for Semantic Routing
- ADR-104: RuVector Memory System Integration
- Claude-Flow ADR-006: Unified Memory Service
- Claude-Flow ADR-009: Hybrid Memory Backend

---

**Author:** SPARC Architecture Agent
**Last Updated:** 2026-01-10
