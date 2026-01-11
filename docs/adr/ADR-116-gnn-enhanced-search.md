# ADR-116: GNN-Enhanced Vector Search

**Status:** Accepted  
**Date:** 2026-01-11  
**Category:** Memory/Intelligence  
**Impact:** HIGH

---

## Context

Traditional HNSW vector search returns static results based on embedding similarity. For the ELEX agent swarm, search quality should improve over time based on usage patterns, query frequencies, and feedback signals.

**Problems Addressed:**
- HNSW returns same results regardless of historical usage
- No learning from user feedback on search quality
- Semantic similarity alone doesn't capture domain relevance
- Query patterns not leveraged for result improvement

**Related ADRs:**
- ADR-005: HNSW Vector Indexing for Semantic Routing
- ADR-104: RuVector Memory Integration
- ADR-114: ReasoningBank 4-Step Pipeline

---

## Decision

**We will implement a Graph Neural Network (GNN) layer on top of HNSW that learns from usage patterns to enhance vector search results.**

### Architecture

```
Query → HNSW Index → GNN Layer → Enhanced Results
             ↑            │
             └── learns ──┘
                 from
               feedback
```

### GNN Components

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| Message Passing | Neighbor aggregation on HNSW graphs | Efficient neighbor traversal |
| Multi-head Attention | Neighbor importance weighting | 4 attention heads |
| Memory-Mapped Weights | Large model support | mmap for weight storage |
| Feedback Integration | Learn from user interactions | Gradient updates from rewards |

### Core Structures

```rust
pub struct GNNLayer {
    pub attention_heads: Vec<AttentionHead>,
    pub weight_matrices: MemoryMappedWeights,
    pub hnsw_graph: Arc<HnswIndex>,
}

pub struct AttentionHead {
    pub query_weights: Vec<f32>,
    pub key_weights: Vec<f32>,
    pub value_weights: Vec<f32>,
    pub output_weights: Vec<f32>,
}

pub struct GNNConfig {
    pub num_heads: usize,        // 4
    pub hidden_dim: usize,       // 128
    pub num_layers: usize,       // 2
    pub dropout: f32,            // 0.1
    pub learning_rate: f32,      // 0.001
}
```

### Message Passing Algorithm

```rust
impl GNNLayer {
    /// Aggregate information from HNSW neighbors
    pub fn message_pass(&self, node_id: usize, k: usize) -> Vec<f32> {
        let neighbors = self.hnsw_graph.get_neighbors(node_id, k);
        let mut aggregated = vec![0.0; self.config.hidden_dim];
        
        for (neighbor_id, attention_weight) in self.compute_attention(node_id, &neighbors) {
            let neighbor_embedding = self.hnsw_graph.get_embedding(neighbor_id);
            for (i, val) in neighbor_embedding.iter().enumerate() {
                aggregated[i] += val * attention_weight;
            }
        }
        
        aggregated
    }
}
```

---

## Alternatives Considered

### 1. Static HNSW Only
- **Pros:** Simpler, no learning complexity
- **Cons:** No improvement over time, ignores usage patterns
- **Decision:** Rejected - learning from usage is a core requirement

### 2. Full Graph Transformer
- **Pros:** State-of-the-art graph learning
- **Cons:** Too heavy for WASM, requires full graph in memory
- **Decision:** Rejected - GNN layer is more lightweight and sufficient

### 3. Collaborative Filtering
- **Pros:** Well-understood, simple implementation
- **Cons:** Doesn't leverage graph structure, cold-start problem
- **Decision:** Rejected - HNSW graph structure provides rich connectivity information

### 4. Query Expansion with LLM
- **Pros:** Semantic query understanding
- **Cons:** External dependency, latency, cost
- **Decision:** Rejected - GNN provides local learning without external calls

---

## Consequences

### Positive

1. **Continuous Improvement:** Search quality improves with usage
2. **Graph-Aware:** Leverages HNSW neighbor structure
3. **Attention-Based:** Learns which neighbors are most relevant
4. **Memory Efficient:** Memory-mapped weights for large models
5. **Fast Inference:** <5ms message passing per query

### Negative

1. **Training Data Required:** Needs feedback signals for learning
2. **Model Updates:** Periodic weight updates add overhead
3. **Cold Start:** New nodes don't benefit until patterns emerge

### Risks

1. **Overfitting:** May overfit to specific query patterns (mitigated by dropout)
2. **Weight Corruption:** Memory-mapped weights could corrupt (mitigated by checksums)
3. **Gradient Explosion:** Deep GNN layers could diverge (mitigated by gradient clipping)

---

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Message Passing | <5ms | `cargo bench -p elex-reasoningbank` |
| Attention Computation | <2ms | Per-head timing |
| Memory per Node | <1KB | Weight analysis |
| Training Update | <100ms | Batch gradient timing |
| Improvement vs HNSW | >15% recall@10 | A/B testing |

---

## Implementation

### Integration Points

```
src/wasm/crates/elex-reasoningbank/
├── src/
│   ├── gnn.rs           # [NEW] GNN layer implementation
│   ├── attention.rs     # [NEW] Multi-head attention
│   └── retrieve.rs      # [MODIFY] Integrate GNN post-processing
```

### WASM Exports

```rust
#[wasm_bindgen]
pub fn gnn_enhanced_search(query: &str, k: usize) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn gnn_update_weights(feedback: JsValue) -> Result<(), JsValue>;
```

---

## Verification

### Unit Tests
```bash
cd src/wasm && cargo test -p elex-reasoningbank --test gnn
```

### Performance Test
```typescript
// Compare HNSW vs GNN-enhanced results
const hnsw_results = await hnswSearch(query, 10);
const gnn_results = await gnnEnhancedSearch(query, 10);
assert(measureRecall(gnn_results) > measureRecall(hnsw_results));
```

### Learning Test
```typescript
// Verify learning from feedback
for (const feedback of trainingData) {
    await gnnUpdateWeights(feedback);
}
const improved_results = await gnnEnhancedSearch(testQuery, 10);
assert(improved_results.quality > baseline);
```

---

## References

- [ADR-005](ADR-005-vector-memory-hnsw.md) - HNSW Vector Indexing
- [ADR-104](ADR-104-ruvector-memory-integration.md) - RuVector Memory Integration
- [ADR-114](ADR-114-reasoningbank-pipeline.md) - ReasoningBank Pipeline
- [Graph Attention Networks](https://arxiv.org/abs/1710.10903) - Veličković et al.
- [Self-Learning Swarm PRD](../self-learning-swarm-PRD.md) - Implementation specification

---

**Implementation Date:** 2026-01-11  
**Status:** ✅ Accepted
