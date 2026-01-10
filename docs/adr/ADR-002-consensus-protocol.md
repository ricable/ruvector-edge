# ADR-002: Consensus Protocol Selection

## Status
Accepted

## Context
The ELEX distributed agent swarm requires consensus mechanisms for:
1. **Task routing indices:** Must be strongly consistent to ensure deterministic agent selection
2. **Feature agent coordination:** Can tolerate eventual consistency for learning state
3. **Configuration updates:** WASM binary distribution and parameter changes
4. **Q-table synchronization:** Federated learning merge operations

The system operates in challenging network conditions including:
- Browser-based agents with intermittent connectivity
- Mobile devices with variable latency
- Edge servers with potential network partitions
- P2P transport without central authority

## Decision
We adopt a **dual-consensus architecture**:

### Raft for Coordinators
- Used by the 14 category coordinator nodes
- Provides strong consistency for:
  - Vector index routing tables
  - Agent registry and identity
  - Configuration and WASM versioning
  - Critical operational decisions
- Requires 3+ nodes for fault tolerance (tolerates f < n/2 failures)

### Gossip + CRDT for Feature Agents
- Used by the 593 feature agents within their category swarms
- Provides eventual consistency for:
  - Q-table state synchronization
  - Trajectory sharing and federated learning
  - Peer discovery and health monitoring
- Uses CRDT (Conflict-free Replicated Data Types) for automatic merge resolution

## Consequences

### Positive
- **Appropriate consistency:** Strong where needed (routing), eventual where acceptable (learning)
- **Partition tolerant:** Gossip continues operating during network splits
- **Scalable:** Gossip scales to thousands of agents with O(log n) message overhead
- **Automatic conflict resolution:** CRDTs eliminate manual merge logic for Q-tables
- **Low overhead:** No leader election for feature agents reduces coordination cost

### Negative
- **Dual implementation:** Maintaining two consensus protocols increases codebase complexity
- **Consistency boundaries:** Cross-boundary operations require careful transaction handling
- **Gossip convergence time:** May take several seconds for all agents to receive updates
- **CRDT storage overhead:** Some CRDT types require maintaining operation history

### Risks
- **Raft leader failover:** During leader election (1-5 seconds), coordinator cluster cannot accept writes
- **Gossip amplification:** In large swarms, gossip messages may consume significant bandwidth
- **CRDT merge conflicts:** Complex Q-table merges may produce unexpected intermediate states
- **Byzantine actors:** Neither Raft nor basic Gossip handles malicious agents (see ADR for oracle validation)

## Alternatives Considered

### Pure Raft
- **Pros:** Strong consistency everywhere, well-understood failure modes
- **Cons:** Requires stable cluster membership; poorly suited for browser agents; high latency for federated learning

### Pure Gossip + CRDT
- **Pros:** Maximum flexibility, handles high churn
- **Cons:** Cannot guarantee routing consistency; eventual consistency insufficient for task assignment

### Paxos
- **Pros:** Theoretically optimal for consensus
- **Cons:** Complex implementation; Raft provides equivalent guarantees with simpler protocol

### Byzantine Fault Tolerant (PBFT)
- **Pros:** Handles malicious actors directly
- **Cons:** O(n^2) message complexity; impractical for 593 agents; separate oracle approach preferred

## References
- ELEX PRD Section: 35 Critical Architectural Decisions (Vector Index: Strong consistency Raft-based)
- ELEX PRD Section: Swarm Coordination (Raft/Gossip Consensus)
- ELEX PRD Section: Federated Merge Algorithm
- Raft Consensus Algorithm: https://raft.github.io/
- CRDT Literature: Shapiro et al., "Conflict-free Replicated Data Types"
