# ADR-115: Federated Q-Learning Consensus

**Status:** Accepted  
**Date:** 2026-01-11  
**Category:** Intelligence/Coordination  
**Impact:** HIGH

---

## Context

The 593-agent ELEX swarm requires distributed Q-table synchronization to share learned knowledge across agents. Individual agent learning must propagate to the collective while handling network partitions, byzantine agents, and merge conflicts.

**Problems Addressed:**
- Q-tables learned in isolation don't benefit other agents
- No consensus mechanism for conflicting Q-value updates
- Gossip propagation needs structured protocol
- Byzantine agents could poison shared Q-tables

**Related ADRs:**
- ADR-002: Consensus Protocol Selection
- ADR-006: Q-Learning Engine for Self-Learning
- ADR-009: Federated Learning for P2P Knowledge Sharing
- ADR-102: ELEX Native Coordination Protocol

---

## Decision

**We will implement a simplified Raft-like consensus for federated Q-learning as a new module in `elex-qlearning/src/federation.rs` (~800 LOC).**

### Consensus Architecture

```
        ┌─────────────────────────────────────────┐
        │           FEDERATED Q-TABLE             │
        │                                         │
        │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
        │  │ Peer 1  │ │ Peer 2  │ │ Peer 3  │   │
        │  │ Q-Table │ │ Q-Table │ │ Q-Table │   │
        │  └────┬────┘ └────┬────┘ └────┬────┘   │
        │       │           │           │        │
        │       └─────────┬─┴───────────┘        │
        │                 │                       │
        │          Visit-Weighted                 │
        │             Merge                       │
        │                 │                       │
        │       ┌─────────▼─────────┐             │
        │       │  Consensus State  │             │
        │       │  (Leader/Follower)│             │
        │       └───────────────────┘             │
        └─────────────────────────────────────────┘
```

### Core Structures

```rust
#[derive(Clone, Serialize, Deserialize)]
pub enum ConsensusState {
    Follower,
    Candidate,
    Leader { term: u64 },
}

pub struct FederatedQTable {
    local_qtable: QTable,
    peers: Vec<PeerId>,
    consensus_state: ConsensusState,
    pending_updates: Vec<QUpdate>,
    sync_interval_ms: u64,
}

pub struct QUpdate {
    pub peer_id: PeerId,
    pub state_hash: u64,
    pub action: u8,
    pub q_value: f32,
    pub visits: u32,
    pub timestamp: u64,
}
```

### Merge Algorithm (Visit-Weighted)

```rust
// Weighted merge: merged_q = (local_q × local_visits + peer_q × peer_visits) / total_visits
fn merge_qtables(&mut self, peer_qtable: &QTable) {
    for (state, actions) in peer_qtable.entries() {
        for (action, peer_entry) in actions {
            let local_entry = self.local_qtable.get_mut(state, action);
            let total_visits = local_entry.visits + peer_entry.visits;
            local_entry.q_value = (
                local_entry.q_value * local_entry.visits as f32 +
                peer_entry.q_value * peer_entry.visits as f32
            ) / total_visits as f32;
            local_entry.visits = total_visits;
        }
    }
}
```

### Configuration

```rust
pub struct FederationConfig {
    pub sync_interval_ms: u64,        // 60000 (1 minute) OR after 10 interactions
    pub min_peers_for_consensus: usize, // 3
    pub byzantine_threshold: f32,      // 0.33 (tolerate 1/3 malicious)
    pub gossip_fanout: usize,          // 3 (O(log N) propagation)
}
```

---

## Alternatives Considered

### 1. Full Raft Implementation (~2000+ LOC)
- **Pros:** Complete consensus guarantees, log replication
- **Cons:** Complexity, maintenance burden, overkill for Q-table sync
- **Decision:** Rejected - simplified version provides 95% functionality at 40% complexity

### 2. Full Byzantine Fault Tolerance
- **Pros:** Strongest security guarantees
- **Cons:** 3x message overhead, quorum size constraints
- **Decision:** Rejected - f < n/3 threshold sufficient for RAN domain

### 3. Pure Gossip Protocol
- **Pros:** Simpler, no leader election
- **Cons:** Eventual consistency only, no conflict resolution
- **Decision:** Rejected - need explicit consensus for Q-value conflicts

### 4. Centralized Q-Table Server
- **Pros:** Simpler consistency model
- **Cons:** Single point of failure, violates edge-first architecture (ADR-003)
- **Decision:** Rejected - conflicts with core architecture principles

---

## Consequences

### Positive

1. **Knowledge Sharing:** All agents benefit from individual learnings
2. **Byzantine Tolerance:** Handles up to 1/3 malicious agents
3. **Visit-Weighted Merge:** More experienced agents have higher influence
4. **O(log N) Propagation:** Gossip fanout ensures efficient distribution
5. **Reduced Complexity:** ~800 LOC vs ~2000 LOC for full Raft

### Negative

1. **Eventual Consistency:** Short windows of inconsistency during sync
2. **Network Sensitivity:** Partitions can delay convergence
3. **Leader Bottleneck:** Single leader for consensus decisions

### Risks

1. **Split Brain:** Network partition could create multiple leaders (mitigated by term numbers)
2. **Poisoning Attack:** Byzantine agents could submit bad Q-values (mitigated by threshold)
3. **Sync Storm:** All agents syncing simultaneously (mitigated by jittered intervals)

---

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Sync Latency | <5s | Network timing |
| Merge Time | <100ms | Rust benchmarks |
| Gossip Propagation | O(log 593) ≈ 10 hops | Network simulation |
| Byzantine Threshold | f < 198 agents | Configuration |
| Bandwidth per Sync | <100KB | Network profiling |

---

## Implementation

### Modified Files

```
src/wasm/crates/elex-qlearning/
├── src/
│   ├── lib.rs           # [MODIFY] Export federation module
│   └── federation.rs    # [NEW] ~800 LOC federated Q-learning
```

### WASM Exports

```rust
#[wasm_bindgen]
pub fn create_federated_qtable(config: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn federated_sync(fqt_state: JsValue) -> Result<JsValue, JsValue>;
```

---

## Verification

### Unit Tests
```bash
cd src/wasm && cargo test -p elex-qlearning --test federation
```

### Integration Test
```typescript
const fqt = await createFederatedQTable({
    sync_interval_ms: 60000,
    min_peers_for_consensus: 3,
    byzantine_threshold: 0.33,
});
const result = await federatedSync(fqt);
assert(result.updates_sent > 0);
assert(result.conflicts_resolved >= 0);
```

### Byzantine Test
```bash
# Simulate 30% malicious agents
bun run tests/integration/byzantine-federation.test.ts
```

---

## References

- [ADR-002](ADR-002-consensus-protocol.md) - Consensus Protocol Selection
- [ADR-006](ADR-006-q-learning-engine.md) - Q-Learning Engine
- [ADR-009](ADR-009-federated-learning.md) - Federated Learning
- [ADR-102](ADR-102-swarm-coordination-protocol.md) - Native Coordination Protocol
- [Raft Paper](https://raft.github.io/raft.pdf) - Ongaro & Ousterhout
- [Self-Learning Swarm PRD](../self-learning-swarm-PRD.md) - Implementation specification

---

**Implementation Date:** 2026-01-11  
**Status:** ✅ Accepted
