# ADR-102: ELEX Native Coordination Protocol (Raft + Gossip)

## Status
Accepted

## Context
The 593-agent neural system requires coordination without a central authority to:

- Route queries to appropriate feature agents
- Maintain consensus on system-wide decisions
- Propagate learned patterns across the swarm
- Handle agent failures and network partitions
- Scale from single-node to globally distributed deployments

The agents are organized into 14 category domains (Carrier Aggregation, MIMO, Load Balancing, etc.), each containing 20-80 feature agents. Coordination requirements differ between:

1. **Cross-category decisions:** Require strong consistency (e.g., activating features with dependencies)
2. **Intra-category state:** Requires eventual consistency (e.g., sharing learned Q-values)
3. **Health monitoring:** Requires fast failure detection across all agents

No single consensus protocol optimally addresses all three requirements.

## Decision
We adopt a **Hybrid Coordination Protocol** combining:

### 1. Raft Consensus for Category Coordinators (14 nodes)
- **Purpose:** Strong consistency for critical decisions
- **Scope:** Feature activation ordering, dependency resolution, safe zone enforcement
- **Configuration:**
  - Election timeout: 150-300ms
  - Heartbeat interval: 50ms
  - Log compaction: Every 10,000 entries
- **Quorum:** Majority (8 of 14) required for commits

### 2. Gossip Protocol for Feature Agents (593 nodes)
- **Purpose:** Eventual consistency for state propagation
- **Scope:** Q-table synchronization, pattern sharing, health monitoring
- **Configuration:**
  - Gossip interval: 1 second
  - Fanout: 3 peers per round
  - Failure detection: Phi-accrual with threshold 8
- **Convergence:** O(log N) rounds for N agents

### 3. Coordination Flow
```
Query Arrives
    |
    v
Category Coordinator (Raft Leader)
    |
    +-- Intra-category query --> Gossip to feature agents
    |
    +-- Cross-category query --> Raft consensus --> Multi-coordinator routing
    |
    v
Feature Agent(s) Process Query
    |
    v
Response aggregated and returned
```

### Message Types
| Type | Protocol | Consistency |
|------|----------|-------------|
| Feature activation | Raft | Strong |
| Dependency check | Raft | Strong |
| Q-table sync | Gossip | Eventual |
| Health heartbeat | Gossip | Eventual |
| Pattern broadcast | Gossip | Eventual |
| Safe zone update | Raft | Strong |

## Alternatives Considered

### Pure Raft (All 593 Agents)
- **Pros:** Strong consistency everywhere, proven protocol
- **Cons:** O(n) message complexity per decision, 593-node Raft is impractical
- **Analysis:** Raft scales to ~7-11 nodes; 593 nodes would have unacceptable latency
- **Rejected:** Does not scale to swarm size

### Pure Gossip (Including Coordinators)
- **Pros:** Scalable, fault-tolerant, no leader election overhead
- **Cons:** Only eventual consistency, no strong ordering guarantees
- **Analysis:** Feature activation ordering requires strong consistency
- **Rejected:** Cannot guarantee activation dependencies

### Central Coordinator (Single Master)
- **Pros:** Simple, strong consistency, clear authority
- **Cons:** Single point of failure, scalability bottleneck
- **Analysis:** Violates edge-first and resilience requirements
- **Rejected:** Unacceptable failure mode

### Blockchain Consensus (PBFT/PoS)
- **Pros:** Byzantine fault tolerance, decentralized
- **Cons:** High message complexity O(n^2), latency overhead
- **Analysis:** RAN optimization requires sub-second responses
- **Rejected:** Latency incompatible with real-time requirements

### CRDTs Only (Conflict-Free Replicated Data Types)
- **Pros:** Automatic conflict resolution, no coordination needed
- **Cons:** Limited to commutative/associative operations
- **Analysis:** Feature activation has ordering requirements incompatible with CRDTs
- **Rejected:** Cannot model all coordination requirements

## Consequences

### Positive
- **Scalable:** Gossip handles 593+ agents with O(log N) convergence
- **Consistent:** Raft ensures critical decisions are strongly consistent
- **Fault Tolerant:**
  - Raft: Tolerates (n-1)/2 coordinator failures
  - Gossip: Handles arbitrary agent churn
- **Low Latency:** Intra-category queries avoid Raft overhead
- **Partition Tolerant:** Gossip continues during network splits

### Negative
- **Complexity:** Two protocols require careful integration
- **Coordinator Dependency:** Cross-category queries require coordinator availability
- **Split-Brain Risk:** Network partitions may cause temporary inconsistency
- **Debugging Difficulty:** Distributed traces span two protocols

### Risks
- **Coordinator Bottleneck:** High cross-category query volume may overwhelm Raft leaders
- **Gossip Lag:** Large Q-tables may slow gossip propagation
- **Protocol Mismatch:** Edge cases where Raft and Gossip state diverge

### Mitigations
- **Load Balancing:** Distribute query load across category coordinators
- **Delta Gossip:** Only propagate Q-table changes, not full tables
- **Consistency Barriers:** Explicit synchronization points between protocols
- **Monitoring:** Track Raft commit latency and gossip convergence time

## References
- ADR-001: Swarm Topology Selection
- Ongaro, D., & Ousterhout, J. (2014). In Search of an Understandable Consensus Algorithm (Raft)
- Demers, A., et al. (1987). Epidemic Algorithms for Replicated Database Maintenance (Gossip)
- Van Renesse, R., et al. (1998). Gossip-Style Failure Detection
- Phi-Accrual Failure Detector: Hayashibara et al. (2004)
