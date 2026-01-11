# ADR-118: AgentDB Memory Namespace Strategy

**Status:** Accepted  
**Date:** 2026-01-11  
**Category:** Memory/Integration  
**Impact:** HIGH

---

## Context

The ELEX agent swarm requires persistent memory storage for features, Q-tables, trajectories, and coordination state. AgentDB provides indexed storage with semantic search, but namespace organization is critical for efficient data access and isolation.

**Problems Addressed:**
- Unstructured memory storage leads to key collisions
- No semantic grouping of related data
- Cross-agent data access patterns undefined
- Memory namespace isolation for different data types

**Related ADRs:**
- ADR-005: HNSW Vector Indexing for Semantic Routing
- ADR-104: RuVector Memory Integration
- ADR-111: Memory Unification Strategy

---

## Decision

**We will implement a structured namespace strategy for AgentDB with four primary namespaces aligned to data lifecycle and access patterns.**

### Namespace Architecture

```
AgentDB
├── elex-knowledge       # Feature metadata, parameters, counters, KPIs
│   └── 1,153 indexed features
├── elex-intelligence    # Q-tables, trajectories, patterns, verdicts
│   └── Learning state per agent
├── elex-optimization    # Optimization results, metrics, benchmarks
│   └── Performance data
└── elex-coordination    # Federated sync, peer status, consensus
    └── Distributed state
```

### Namespace Definitions

| Namespace | Purpose | Data Types | Access Pattern |
|-----------|---------|------------|----------------|
| `elex-knowledge` | Feature metadata, parameters, counters, KPIs | Feature specs, MO classes, 9,432 parameters | Read-heavy, rarely updated |
| `elex-intelligence` | Q-tables, trajectories, patterns, verdicts | QTable entries, TrajectoryBatch, ReasoningPattern | Write-heavy, per-interaction |
| `elex-optimization` | Optimization results, metrics, benchmarks | OptimizationResult, KPIMetric, Benchmark | Periodic writes, analytics reads |
| `elex-coordination` | Federated sync, peer status, consensus | SyncResult, PeerStatus, ConsensusState | Real-time updates |

### TypeScript Bridge Implementation

```typescript
export const MEMORY_NAMESPACES = {
  'elex-knowledge': 'Feature metadata, parameters, counters, KPIs',
  'elex-intelligence': 'Q-tables, trajectories, patterns, verdicts',
  'elex-optimization': 'Optimization results, metrics, benchmarks',
  'elex-coordination': 'Federated sync, peer status, consensus',
} as const;

export class AgentDBBridge {
  static async search(
    query: string, 
    namespace = 'elex-knowledge', 
    limit = 10
  ): Promise<SearchResult[]> {
    const cmd = `npx @claude-flow/cli@latest memory search \
      --query "${query}" \
      --namespace ${namespace} \
      --limit ${limit}`;
    return JSON.parse(execSync(cmd, { encoding: 'utf-8', timeout: 10000 }));
  }
  
  static async retrieve(
    key: string, 
    namespace = 'elex-knowledge'
  ): Promise<any> {
    const cmd = `npx @claude-flow/cli@latest memory retrieve \
      --namespace ${namespace} \
      --key "${key}"`;
    return JSON.parse(execSync(cmd, { encoding: 'utf-8', timeout: 5000 }));
  }
  
  static async store(
    key: string, 
    value: object, 
    namespace: string
  ): Promise<boolean> {
    const valueJson = JSON.stringify(value).replace(/"/g, '\\"');
    const cmd = `npx @claude-flow/cli@latest memory store \
      --namespace ${namespace} \
      --key "${key}" \
      --value "${valueJson}"`;
    execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
    return true;
  }
}
```

### Key Naming Conventions

| Namespace | Key Format | Example |
|-----------|-----------|---------|
| `elex-knowledge` | `feature:{faj_code}` | `feature:FAJ1234567` |
| `elex-intelligence` | `{agent_id}:qtable:{state_hash}` | `agent-001:qtable:0xABCD1234` |
| `elex-optimization` | `cycle:{cycle_id}:result` | `cycle:2026-01-11-001:result` |
| `elex-coordination` | `peer:{peer_id}:status` | `peer:coordinator-03:status` |

---

## Alternatives Considered

### 1. Single Flat Namespace
- **Pros:** Simpler implementation
- **Cons:** Key collisions, no logical grouping, poor isolation
- **Decision:** Rejected - structured namespaces provide better organization

### 2. Per-Agent Namespaces
- **Pros:** Complete isolation
- **Cons:** Cross-agent queries difficult, 593+ namespaces overhead
- **Decision:** Rejected - shared namespaces with key prefixes more scalable

### 3. Schema-Based Approach (SQL-like)
- **Pros:** Strong typing, relationships
- **Cons:** Overkill for key-value patterns, AgentDB is document-oriented
- **Decision:** Rejected - namespace + document approach matches AgentDB model

### 4. Hierarchical Namespaces (elex/knowledge/features)
- **Pros:** Fine-grained organization
- **Cons:** Deep paths add complexity, namespace switching overhead
- **Decision:** Rejected - flat 4-namespace structure balances organization and simplicity

---

## Consequences

### Positive

1. **Clear Separation:** Different data types isolated by namespace
2. **Efficient Queries:** Namespace-scoped searches reduce search space
3. **Access Control:** Potential for namespace-level permissions
4. **Scalability:** Namespaces can scale independently
5. **Discoverability:** Namespace names are self-documenting

### Negative

1. **Cross-Namespace Queries:** Joining data requires multiple calls
2. **Namespace Management:** Must track active namespaces
3. **Migration Complexity:** Changing namespace structure requires data migration

### Risks

1. **Namespace Sprawl:** Resist creating additional namespaces (mitigated by ADR governance)
2. **Key Collisions:** Multi-agent keys need unique prefixes
3. **Stale Data:** No automatic namespace TTL or cleanup

---

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Search Latency | <100ms | CLI timing |
| Store Latency | <50ms | CLI timing |
| Namespace Size | <1GB each | Storage monitoring |
| Index Rebuild | <10s | Recovery testing |

---

## Implementation

### New Files

```
scripts/self-learning-demo/
├── agentdb-bridge.ts    # [NEW] TypeScript bridge for AgentDB
└── namespaces.ts        # [NEW] Namespace constants and utilities
```

### CLI Commands

```bash
# Search in knowledge namespace
npx @claude-flow/cli@latest memory search \
  --query "MIMO sleep mode" \
  --namespace elex-knowledge \
  --limit 10

# Store Q-table entry
npx @claude-flow/cli@latest memory store \
  --namespace elex-intelligence \
  --key "agent-001:qtable:0x1234" \
  --value '{"state": 5, "action": 2, "q_value": 0.85}'

# Retrieve coordination status
npx @claude-flow/cli@latest memory retrieve \
  --namespace elex-coordination \
  --key "peer:coordinator-03:status"
```

### Browser Proxy Pattern (Phase 3)

For browser environments without CLI access:

```typescript
class AgentDBWebSocketProxy {
  private ws: WebSocket;
  
  async search(query: string, namespace: string): Promise<SearchResult[]> {
    return this.sendCommand({ 
      type: 'search', 
      query, 
      namespace 
    });
  }
  
  async store(key: string, value: object, namespace: string): Promise<boolean> {
    return this.sendCommand({ 
      type: 'store', 
      key, 
      value, 
      namespace 
    });
  }
}
```

---

## Verification

### Namespace Tests
```bash
# Verify all namespaces exist
for ns in elex-knowledge elex-intelligence elex-optimization elex-coordination; do
  npx @claude-flow/cli@latest memory stats --namespace $ns
done
```

### Integration Test
```typescript
// Test knowledge namespace
const features = await AgentDBBridge.search("MIMO beam", "elex-knowledge", 5);
assert(features.length > 0);

// Test intelligence namespace
await AgentDBBridge.store("agent-001:qtable:test", { q_value: 0.5 }, "elex-intelligence");
const qtable = await AgentDBBridge.retrieve("agent-001:qtable:test", "elex-intelligence");
assert(qtable.q_value === 0.5);
```

---

## References

- [ADR-005](ADR-005-vector-memory-hnsw.md) - HNSW Vector Indexing
- [ADR-104](ADR-104-ruvector-memory-integration.md) - RuVector Memory Integration
- [ADR-111](ADR-111-memory-unification.md) - Memory Unification Strategy
- [Claude-Flow CLI Documentation](https://github.com/ruvnet/claude-flow)
- [Self-Learning Swarm PRD](../self-learning-swarm-PRD.md) - Implementation specification

---

**Implementation Date:** 2026-01-11  
**Status:** ✅ Accepted
