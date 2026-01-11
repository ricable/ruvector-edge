# ADR-114: ReasoningBank 4-Step Pipeline

**Status:** Accepted  
**Date:** 2026-01-11  
**Category:** Intelligence  
**Impact:** HIGH

---

## Context

The ELEX agent swarm requires structured reasoning capabilities beyond simple Q-table lookups. Agents need to retrieve relevant knowledge, judge response quality, distill patterns from trajectories, and consolidate the reasoning bank for memory efficiency.

**Problems Addressed:**
- No systematic reasoning pipeline for complex RAN optimization queries
- Pattern extraction from trajectories is ad-hoc
- No quality judgment mechanism for agent responses
- Memory grows unbounded without consolidation

**Related ADRs:**
- ADR-005: HNSW Vector Indexing for Semantic Routing
- ADR-006: Q-Learning Engine for Self-Learning
- ADR-113: Decision Transformer Integration

---

## Decision

**We will implement a 4-step ReasoningBank pipeline as a new WASM crate (`elex-reasoningbank`) that provides RETRIEVE → JUDGE → DISTILL → CONSOLIDATE operations.**

### Pipeline Architecture

```
Query → RETRIEVE → Patterns → JUDGE → Verdict → DISTILL → New Patterns → CONSOLIDATE
           ↑                                        ↓                        ↓
      HNSW Index                              Trajectory              LZ4 Compression
```

### Step Definitions

| Step | Purpose | Input | Output |
|------|---------|-------|--------|
| **RETRIEVE** | Semantic search for relevant patterns | Query string, K | Patterns with similarity scores |
| **JUDGE** | Score response quality | Response, Criteria | Verdict with confidence |
| **DISTILL** | Extract patterns from trajectories | Trajectory batch | New reasoning patterns |
| **CONSOLIDATE** | Compress and deduplicate bank | - | Memory saved, duplicates removed |

### Core Structures

```rust
pub struct ReasoningBank {
    hnsw_index: HnswIndex,
    patterns: Vec<ReasoningPattern>,
    verdicts: Vec<Verdict>,
}

pub struct ReasoningPattern {
    pub id: String,
    pub context_embedding: Vec<f32>,
    pub action_sequence: Vec<String>,
    pub success_rate: f32,
    pub usage_count: usize,
}

pub struct Verdict {
    pub score: f32,           // 0.0-1.0
    pub confidence: f32,      // 0.0-1.0
    pub rationale: String,
    pub criteria_scores: HashMap<String, f32>,
}
```

### WASM Integration

```rust
#[wasm_bindgen]
impl ReasoningBank {
    pub fn retrieve(&self, query: &str, k: usize) -> Result<JsValue, JsValue>;
    pub fn judge(&self, response: &str, criteria: JsValue) -> Result<JsValue, JsValue>;
    pub fn distill(&self, trajectories: JsValue) -> Result<JsValue, JsValue>;
    pub fn consolidate(&mut self) -> Result<JsValue, JsValue>;
}
```

---

## Alternatives Considered

### 1. External LLM for Judgment
- **Pros:** More sophisticated reasoning
- **Cons:** Network dependency, latency, cost, privacy concerns
- **Decision:** Rejected - rule-based judgment sufficient for RAN domain, zero external dependencies

### 2. Single-Step Pattern Matching
- **Pros:** Simpler implementation
- **Cons:** No quality assurance, no learning, no memory management
- **Decision:** Rejected - 4-step pipeline provides complete reasoning lifecycle

### 3. Separate Services per Step
- **Pros:** Independent scaling
- **Cons:** Inter-service latency, coordination overhead
- **Decision:** Rejected - single WASM module minimizes latency and complexity

---

## Consequences

### Positive

1. **Structured Reasoning:** Clear 4-step pipeline for all reasoning operations
2. **Self-Contained:** No external LLM dependencies (rule-based judgment)
3. **Memory Efficient:** LZ4 compression in consolidation phase
4. **Pattern Reuse:** High-quality patterns accumulate over time
5. **Explainable:** Verdict includes rationale and criteria scores

### Negative

1. **Rule-Based Limits:** Judge step less sophisticated than LLM-based evaluation
2. **Pattern Drift:** May accumulate outdated patterns without TTL
3. **Cold Start:** Empty reasoning bank requires warmup period

### Risks

1. **Index Corruption:** HNSW corruption could lose patterns (mitigated by periodic snapshots)
2. **Criteria Bias:** Judgment criteria may embed domain assumptions
3. **Compression Loss:** LZ4 is lossless but adds CPU overhead

---

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Retrieve Latency | <5ms | `cargo bench -p elex-reasoningbank` |
| Judge Latency | <10ms | Rust benchmarks |
| Distill Throughput | 100 trajectories/s | Integration tests |
| Consolidate | 4-32x compression | Memory usage comparison |
| Total Pipeline | <50ms | End-to-end timing |

---

## Implementation

### New Files

```
src/wasm/crates/elex-reasoningbank/
├── Cargo.toml           # Workspace member, lzzzz dependency
├── src/
│   ├── lib.rs           # Module exports, WASM bindings
│   ├── retrieve.rs      # HNSW-based semantic retrieval
│   ├── judge.rs         # Rule-based verdict scoring
│   ├── distill.rs       # Pattern extraction from trajectories
│   ├── consolidate.rs   # Bank maintenance with LZ4 compression
│   └── sona.rs          # SONA self-optimizing integration
```

### Dependencies

- `elex-memory`: HNSW index implementation
- `lzzzz`: LZ4 compression for consolidation
- `wasm-bindgen`: JavaScript interop
- `serde`: Serialization

---

## Verification

### Unit Tests
```bash
cd src/wasm && cargo test -p elex-reasoningbank
```

### Pipeline Test
```typescript
const rb = new ReasoningBank();
const patterns = await rb.retrieve("MIMO sleep mode", 5);
const verdict = await rb.judge(response, { accuracy: 0.3, relevance: 0.7 });
await rb.distill(trajectories);
const result = await rb.consolidate();
assert(result.memory_saved_bytes > 0);
```

---

## References

- [ADR-005](ADR-005-vector-memory-hnsw.md) - HNSW Vector Indexing
- [ADR-006](ADR-006-q-learning-engine.md) - Q-Learning Engine
- [ADR-113](ADR-113-decision-transformer.md) - Decision Transformer
- [Self-Learning Swarm PRD](../self-learning-swarm-PRD.md) - Implementation specification

---

**Implementation Date:** 2026-01-11  
**Status:** ✅ Accepted
