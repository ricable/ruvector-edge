# ADR-005: HNSW Vector Indexing for Semantic Routing

## Status
Accepted

## Context
The ELEX system must route incoming queries to the most appropriate agent(s) among 593 specialists. Requirements:
- **Sub-millisecond latency:** Task routing must complete in <1ms (P95)
- **Semantic matching:** Queries expressed in natural language must match feature expertise
- **Scalability:** Index must handle 10,000+ vectors per agent efficiently
- **Edge deployment:** Indexing must work in browser WASM environment

Vector similarity search options:
1. **Brute force:** O(n) linear scan
2. **LSH (Locality-Sensitive Hashing):** Approximate with hash buckets
3. **IVF (Inverted File Index):** Cluster-based search
4. **HNSW (Hierarchical Navigable Small World):** Graph-based approximate nearest neighbor

## Decision
We adopt **HNSW (Hierarchical Navigable Small World)** for all vector operations:

### Vector Memory Architecture
**Layer 2: Vector Memory (HNSW Index)**
- 10,000 vectors per agent capacity
- 128-dimensional embeddings
- Stores: query/response/case content with metadata

### Indexed Content
- Query embeddings (user questions)
- Response embeddings (agent answers)
- Case embeddings (troubleshooting scenarios)
- Feature metadata embeddings
- Parameter and counter descriptions

### HNSW Configuration
- **M (connections per layer):** 16 (balance between recall and memory)
- **efConstruction:** 200 (build-time accuracy)
- **efSearch:** 50 (query-time accuracy)
- **Distance metric:** Cosine similarity

## Consequences

### Positive
- **150x faster:** Than brute force for large vector sets
- **Sub-millisecond queries:** Achieves <1ms routing latency target
- **Incremental updates:** Vectors can be added without full rebuild
- **High recall:** >95% recall at 10x speedup typical
- **WASM compatible:** Can run in browser via hnswlib-wasm
- **Memory efficient:** Compressed vector storage with quantization

### Negative
- **Build time:** Initial index construction takes O(n log n)
- **Memory overhead:** Graph structure requires ~1.2x vector memory
- **Approximate results:** Not guaranteed to find exact nearest neighbors
- **Parameter tuning:** M and ef parameters require optimization per use case

### Risks
- **Index corruption:** Graph structure vulnerable to partial writes
- **Dimension lock-in:** Cannot easily change embedding dimensions after deployment
- **Memory pressure:** Large indices may exceed browser memory limits
- **Cold start:** Empty index provides no routing until vectors added

## Alternatives Considered

### Brute Force (Flat Index)
- **Pros:** Exact results, simple implementation, no build time
- **Cons:** O(n) query time; 10,000 vectors = 10ms+ per query; fails latency target

### LSH (Locality-Sensitive Hashing)
- **Pros:** O(1) average lookup, simple hash-based
- **Cons:** Lower recall than HNSW, requires multiple hash tables, memory inefficient

### IVF (Inverted File Index)
- **Pros:** Good for static datasets, clustered structure
- **Cons:** Requires training on data distribution, poor for incremental updates

### Annoy (Approximate Nearest Neighbors Oh Yeah)
- **Pros:** Spotify-proven, tree-based, memory-mapped
- **Cons:** Cannot add vectors after build, requires full rebuild for updates

### ScaNN (Google)
- **Pros:** State-of-the-art accuracy
- **Cons:** Complex implementation, not WASM-ready, heavy dependencies

## References
- ELEX PRD Section: Task Routing (Semantic HNSW)
- ELEX PRD Section: Memory & Vector Architecture (Layer 2: Vector Memory)
- ELEX PRD Section: Coordination Layer (Semantic Routing: HNSW vector search <1ms)
- HNSW Paper: Malkov & Yashunin, "Efficient and robust approximate nearest neighbor search using HNSW graphs"
