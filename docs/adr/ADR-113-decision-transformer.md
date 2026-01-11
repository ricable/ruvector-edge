# ADR-113: Decision Transformer Integration

**Status:** Accepted  
**Date:** 2026-01-11  
**Category:** Intelligence  
**Impact:** HIGH

---

## Context

The ELEX agent swarm requires sequence-based trajectory prediction for optimal RAN optimization actions. While Q-learning (ADR-006) provides model-free reinforcement learning, it lacks the ability to predict optimal action sequences based on historical trajectory patterns.

**Problems Addressed:**
- Q-learning alone cannot leverage temporal patterns in optimization sequences
- Multi-step optimization requires forward-looking action prediction
- Historical trajectory data is underutilized for decision making
- Context window processing needs efficient attention mechanisms

**Related ADRs:**
- ADR-006: Q-Learning Engine for Self-Learning
- ADR-014: SIMD Implementation Strategy
- ADR-112: Neural Learning Pipeline Integration

---

## Decision

**We will implement a Decision Transformer as a new WASM crate (`elex-decision-transformer`) that uses causal attention over offline trajectories to predict optimal RAN optimization actions.**

### Architecture

```
Input Trajectory → Embedding → Causal Attention → MLP Head → Action Prediction
     ↑                              ↑
   [states, actions,             [num_heads=4,
    rewards, timesteps,           context_window=20,
    returns_to_go]                embed_dim=128]
```

### Configuration

```rust
pub struct TransformerConfig {
    pub embed_dim: usize,        // 128 (matches HNSW dimension)
    pub num_heads: usize,        // 4 attention heads
    pub num_layers: usize,       // 3 transformer blocks
    pub context_window: usize,   // 20 timesteps
    pub dropout: f32,            // 0.1
}
```

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| `DecisionTransformer` | `transformer.rs` | Main transformer struct with forward pass |
| `CausalAttention` | `attention.rs` | SIMD-accelerated causal attention |
| `TrajectoryBatch` | `trajectory.rs` | Batched trajectory processing |
| `AttentionHead` | `attention.rs` | Individual attention head computation |

### WASM Integration

```rust
#[wasm_bindgen]
pub fn create_decision_transformer(config: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn forward_pass(transformer: &DecisionTransformer, trajectory: JsValue) -> Result<JsValue, JsValue>;
```

---

## Alternatives Considered

### 1. RNN/LSTM-based Sequence Modeling
- **Pros:** Lower memory usage, simpler implementation
- **Cons:** Cannot parallelize across sequence, slower training, gradient issues
- **Decision:** Rejected - attention mechanisms provide better parallelization and performance

### 2. Vanilla Transformer
- **Pros:** Standard architecture, well-documented
- **Cons:** Doesn't naturally handle returns-to-go conditioning
- **Decision:** Rejected - Decision Transformer's conditioning mechanism is purpose-built for RL

### 3. External ML Framework (ONNX Runtime)
- **Pros:** Full ML framework capabilities
- **Cons:** Large binary size, complex WASM integration, additional dependencies
- **Decision:** Rejected - native Rust implementation minimizes binary size and maximizes control

---

## Consequences

### Positive

1. **Sequence-Aware Predictions:** Leverages temporal patterns in optimization trajectories
2. **SIMD Acceleration:** 3-8x speedup through `elex-simd` integration
3. **Q-Learning Synergy:** Complements tabular Q-learning with trajectory-based predictions
4. **Offline Learning:** Can learn from historical trajectory data without live exploration
5. **Bounded Latency:** <10ms forward pass for real-time decision support

### Negative

1. **Memory Overhead:** Context window requires ~64KB per agent for trajectory storage
2. **Training Complexity:** Requires curated trajectory datasets for effective learning
3. **Hyperparameter Tuning:** num_heads, context_window, embed_dim require domain-specific tuning

### Risks

1. **Embedding Dimension Mismatch:** Must align with HNSW 128-dim vectors (mitigated by config validation)
2. **Trajectory Quality:** Garbage-in-garbage-out - requires quality trajectory collection
3. **WASM SIMD Support:** Requires simd128 target feature (fallback to scalar implemented)

---

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Forward Pass Latency | <10ms | Rust benchmarks (`cargo bench -p elex-decision-transformer`) |
| Memory per Agent | <64KB | WASM heap profiling |
| SIMD Speedup | 3-8x vs scalar | Comparative benchmarks |
| Batch Processing | 32 trajectories/call | Integration tests |

---

## Implementation

### New Files

```
src/wasm/crates/elex-decision-transformer/
├── Cargo.toml          # Workspace member, wasm-bindgen dependency
├── src/
│   ├── lib.rs          # Module exports, WASM bindings
│   ├── transformer.rs  # DecisionTransformer struct
│   ├── attention.rs    # CausalAttention, AttentionHead
│   └── trajectory.rs   # TrajectoryBatch, TrajectoryProcessor
```

### Workspace Integration

```toml
# src/wasm/Cargo.toml
members = [
    ...
    "crates/elex-decision-transformer",
]
```

### Dependencies

- `elex-core`: Base types and utilities
- `elex-qlearning`: Trajectory data structures
- `wasm-bindgen`: JavaScript interop
- `serde`: Serialization

---

## Verification

### Unit Tests
```bash
cd src/wasm && cargo test -p elex-decision-transformer
```

### WASM Build
```bash
cd src/wasm && wasm-pack build --target web crates/elex-wasm
```

### Integration Test
```typescript
const dt = await createDecisionTransformer({ embed_dim: 128, num_heads: 4 });
const prediction = await decisionTransformerForward(dt, trajectoryBatch);
assert(prediction.latency_ms < 10);
```

---

## References

- [Decision Transformer Paper](https://arxiv.org/abs/2106.01345) - Chen et al., 2021
- [ADR-006](ADR-006-q-learning-engine.md) - Q-Learning Engine
- [ADR-014](ADR-014-simd-implementation.md) - SIMD Implementation
- [ADR-112](ADR-112-neural-learning-pipeline.md) - Neural Learning Pipeline
- [Self-Learning Swarm PRD](../self-learning-swarm-PRD.md) - Implementation specification

---

**Implementation Date:** 2026-01-11  
**Status:** ✅ Accepted
