# ADR-001: Swarm Topology Selection

## Status
Accepted

## Context
The ELEX system requires 593 specialized agents to coordinate effectively across diverse deployment environments (browsers, mobile devices, edge servers). The topology choice fundamentally impacts:
- Message routing efficiency and latency
- Fault tolerance and resilience
- Scalability from PoC (10 users) to Enterprise (1000+ users)
- Resource consumption on edge devices

Four topology options were evaluated:
1. **Mesh:** All agents directly connected (O(n^2) links)
2. **Hierarchical:** Category coordinators at top, feature agents as leaves
3. **Sharded:** Category-based partitions with cross-shard routing
4. **Hybrid:** Coordinator cluster (Raft) + feature swarms (Gossip)

## Decision
We adopt **Hybrid Topology** as the recommended default, combining:
- **Coordinator Cluster:** 14 category coordinators running Raft consensus for strong consistency
- **Feature Swarms:** 593 feature agents organized into category-based Gossip networks for eventual consistency

The hybrid approach allows:
- Mesh topology for small deployments (<100 agents)
- Hierarchical for large single-domain deployments
- Full hybrid for enterprise scale with geographic distribution

## Consequences

### Positive
- **Scalable:** Handles 10 to 1000+ concurrent users without architectural changes
- **Efficient routing:** Category coordinators provide O(1) routing to feature swarms
- **Fault tolerant:** Gossip protocol handles agent churn; Raft handles coordinator failures
- **Resource efficient:** Feature agents don't maintain full mesh, reducing connection overhead
- **Deployment flexible:** Same architecture works for browser, edge server, and hybrid modes

### Negative
- **Complexity:** Two consensus protocols (Raft + Gossip) increase implementation complexity
- **Coordinator dependency:** Category coordinators become critical path for cross-category queries
- **Split-brain risk:** Network partitions may cause temporary inconsistency between Raft and Gossip layers

### Risks
- **Coordinator bottleneck:** High query volumes may overwhelm the 14 coordinator nodes
- **Cross-shard latency:** Queries spanning multiple categories require multi-hop routing
- **Learning divergence:** Federated learning across Gossip boundaries may converge slowly

## Alternatives Considered

### Pure Mesh
- **Pros:** Simple, low latency, full connectivity
- **Cons:** O(n^2) = 351,649 connections for 593 agents; impractical for edge devices

### Pure Hierarchical
- **Pros:** Clear routing paths, efficient for read-heavy workloads
- **Cons:** Single points of failure at each level; rigid structure limits dynamic scaling

### Pure Sharded
- **Pros:** Domain isolation, parallel operation
- **Cons:** Cross-shard queries require complex routing; no global consensus

## References
- ELEX PRD Section: Swarm Coordination / Topology Options
- ELEX PRD Section: Deployment Strategy
- CAP Theorem considerations for distributed edge systems
