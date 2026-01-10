# ADR-104: RuVector Memory System Integration

## Status
Accepted

## Context
The 593-agent neural system requires a sophisticated memory architecture to:

1. **Semantic Search:** Find relevant patterns and past experiences by meaning, not just keywords
2. **Persistent Learning:** Store and retrieve Q-learning trajectories across sessions
3. **Catastrophic Forgetting Prevention:** Retain old knowledge while learning new
4. **Fast Retrieval:** Sub-millisecond pattern lookup for real-time decisions
5. **Cross-Agent Knowledge:** Share learned patterns across feature agents

Traditional databases and key-value stores cannot provide:
- Vector similarity search at scale
- Neural network-native storage formats
- Hierarchical attention for context retrieval
- Online learning with forgetting prevention

The RuVector memory system, developed for the agentic-flow framework, provides these capabilities through a unified memory architecture.

## Decision
We integrate **RuVector Memory System** with the following components:

### 1. HNSW Indexing for Semantic Search
- **Algorithm:** Hierarchical Navigable Small World graphs
- **Configuration:**
  - M (max connections): 16
  - efConstruction: 200
  - efSearch: 100
  - Distance metric: Cosine similarity
- **Performance:** 150x-12,500x faster than linear scan
- **Capacity:** 10M+ vectors with sub-millisecond lookup

### 2. Trajectory Buffer for Experience Replay
- **Purpose:** Store (state, action, reward, next_state) tuples
- **Capacity:** 100,000 experiences per agent (rotating buffer)
- **Prioritization:** Prioritized Experience Replay (PER)
  - Priority: |TD-error| + epsilon
  - Alpha (prioritization): 0.6
  - Beta (importance sampling): 0.4 -> 1.0

### 3. EWC++ for Catastrophic Forgetting Prevention
- **Algorithm:** Elastic Weight Consolidation with online updates
- **Implementation:**
  - Fisher information matrix computed online
  - Lambda (importance): 5000
  - Update frequency: Every 1000 learning steps
- **Effect:** Protects important Q-values from being overwritten

### 4. Hierarchical Attention for Context Retrieval
- **Purpose:** Weight memory retrieval by relevance and recency
- **Implementation:**
  - Multi-head attention (8 heads, 64 dims)
  - Temporal decay: exp(-t/tau) with tau = 1 hour
  - Semantic relevance: Cosine similarity threshold 0.7

### Memory Architecture
```
+------------------+
|   Query Vector   |
+--------+---------+
         |
         v
+--------+---------+
|   HNSW Index     |  <- 150x-12,500x faster search
+--------+---------+
         |
         v
+--------+---------+
| Attention Layer  |  <- Contextual weighting
+--------+---------+
         |
         v
+--------+---------+
| Trajectory Buffer|  <- Experience replay
+--------+---------+
         |
         v
+--------+---------+
|    EWC++ Layer   |  <- Forgetting prevention
+--------+---------+
         |
         v
+--------+---------+
|   Q-Table Store  |  <- Persistent learning
+------------------+
```

### Storage Layout
- **Hot Storage:** In-memory HNSW index for active patterns
- **Warm Storage:** SQLite with vector extension for recent history
- **Cold Storage:** Compressed archive for long-term patterns

## Alternatives Considered

### Traditional Vector Databases (Pinecone, Weaviate)
- **Pros:** Managed service, proven at scale, rich features
- **Cons:** Cloud dependency, latency, cost at 593 agent scale
- **Rejected:** Edge-first requires local operation

### Pure Key-Value Store (Redis, LevelDB)
- **Pros:** Fast, simple, well-understood
- **Cons:** No semantic search, no vector similarity
- **Rejected:** Cannot support pattern matching by meaning

### Graph Databases (Neo4j, DGraph)
- **Pros:** Relationship modeling, traversal queries
- **Cons:** Not optimized for vector operations, higher overhead
- **Rejected:** Primary need is vector similarity, not graph traversal

### Custom FAISS Implementation
- **Pros:** High performance, flexible, well-documented
- **Cons:** C++ dependency, complex WASM compilation, no persistence
- **Rejected:** Integration complexity with WASM agents

### No Persistent Memory (Ephemeral Learning)
- **Pros:** Simple, no storage overhead
- **Cons:** Loses all learning on restart, no cross-session improvement
- **Rejected:** Unacceptable loss of learned optimizations

## Consequences

### Positive
- **Fast Retrieval:** 150x-12,500x faster than linear search via HNSW
- **Semantic Understanding:** Find patterns by meaning, not keywords
- **Continuous Learning:** Agents improve across sessions without forgetting
- **Experience Efficiency:** Prioritized replay maximizes learning from rare events
- **Cross-Agent Sharing:** Patterns stored centrally, retrieved by any agent
- **Edge Compatible:** Works in browser, Node.js, and native runtimes

### Negative
- **Memory Overhead:** HNSW index requires ~1KB per vector
- **Build Time:** Index construction takes O(N log N) time
- **Complexity:** Multiple memory layers increase debugging difficulty
- **Tuning Required:** EWC++ lambda and HNSW parameters need calibration

### Risks
- **Index Corruption:** HNSW graph damage could degrade search quality
- **EWC Rigidity:** Over-protection may prevent beneficial updates
- **Trajectory Staleness:** Old experiences may become irrelevant
- **Memory Pressure:** Large trajectory buffers on resource-limited devices

### Mitigations
- **Index Checksums:** Periodic integrity verification with rebuild capability
- **EWC Decay:** Gradual importance decay for very old constraints
- **Trajectory Pruning:** Age-based and relevance-based cleanup
- **Adaptive Sizing:** Buffer sizes scale based on available memory

## References
- ADR-101: Neural Agent Architecture
- ADR-103: Federated Learning Strategy
- Malkov, Y.A., & Yashunin, D.A. (2018). Efficient and robust approximate nearest neighbor search using HNSW
- Schaul, T., et al. (2015). Prioritized Experience Replay
- Kirkpatrick, J., et al. (2017). Overcoming catastrophic forgetting in neural networks (EWC)
- Schwarz, J., et al. (2018). Progress & Compress: A scalable framework for continual learning (EWC++)
- RuVector Documentation: agentic-flow v2.0.0-alpha
