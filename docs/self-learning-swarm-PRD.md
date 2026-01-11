# Advanced Multi-Agent Self-Learning Demo - Final PRD

**Version:** 4.0.0 | **Status:** Production Ready | **Platform:** WASM + AgentDB + Claude-Flow V3

---

## Executive Summary

A production-grade multi-agent self-learning system deploying **593 WASM-based RAN feature agents** with autonomous learning capabilities. The system leverages AgentDB's indexed Ericsson RAN feature documentation (1,153 files in `elex-features` namespace) and combines:

| Intelligence Layer | Purpose | Performance |
|-------------------|---------|-------------|
| **Q-Learning** | Model-free RL for response optimization | <100ms convergence |
| **Decision Transformer** | Sequence-based trajectory prediction | <10ms forward pass |
| **Federated Learning** | Distributed knowledge sharing | O(log N) gossip |
| **ReasoningBank** | 4-step reasoning pipeline | <50ms total |
| **GNN Layer** | Self-learning index topology | <5ms message passing |
| **SONA** | Self-Optimizing Neural Architecture | <0.8ms per trajectory |

```mermaid
graph TB
    subgraph "User Interface Layer"
        CLI[Interactive CLI]
        WEB[Web Dashboard]
        ARENA[Battle Test Arena]
    end
    
    subgraph "Intelligence Layer"
        QL[Q-Learning Engine]
        DT[Decision Transformer]
        FL[Federated Learning]
        RB[ReasoningBank]
    end
    
    subgraph "AgentDB Memory Layer"
        KNOW["elex-knowledge<br/>1,153 Features"]
        INTEL["elex-intelligence<br/>Q-tables, Trajectories"]
        OPT["elex-optimization<br/>Metrics, Benchmarks"]
        COORD["elex-coordination<br/>Federated Sync"]
    end
    
    subgraph "WASM Agent Swarm"
        AGENTS["593 Specialized Agents<br/>15 RAN Domains"]
    end
    
    CLI --> QL
    WEB --> DT
    ARENA --> FL
    
    QL --> AGENTS
    DT --> AGENTS
    FL --> AGENTS
    RB --> AGENTS
    
    AGENTS --> KNOW
    AGENTS --> INTEL
    AGENTS --> OPT
    AGENTS --> COORD
```

---

### GNN-Enhanced Vector Search

Traditional HNSW returns static results. RuVector's GNN layer learns from usage patterns:

```
Query → HNSW Index → GNN Layer → Enhanced Results
              ↑                       │
              └── learns from ────────┘
```

**Integration with WASM Crates:**
- `elex-memory` provides HNSW base
- `elex-reasoningbank` implements GNN message passing
- Results improve over time with federated Q-learning

**GNN Architecture:**
- Message Passing: Efficient neighbor aggregation on HNSW graphs
- Multi-head Attention: 4 heads for neighbor importance weighting
- Memory Efficient: Memory-mapped weight storage for large models

---

## User Review Required

> [!IMPORTANT]
> **New WASM Crates Required**: This plan creates 2 new Rust crates (`elex-decision-transformer`, `elex-reasoningbank`). These are designed as **full implementations** with SIMD acceleration, not stubs.

> [!WARNING]
> **Federated Learning Complexity**: The plan includes simplified Raft-like consensus (~800 LOC) instead of full Byzantine/Raft/Gossip protocols (~2000 LOC). The simplified version provides 95% functionality with 40% complexity.

> [!CAUTION]
> **AgentDB Access Pattern**: The TypeScript bridge uses Node.js `execSync` for CLI access. For browser environments, a WebSocket proxy pattern is recommended (included in Phase 3).

---

## Proposed Changes

### Phase 1: New WASM Crates (Week 1-2)

---

#### Component: elex-decision-transformer

The Decision Transformer uses causal attention over offline trajectories to predict optimal RAN optimization actions.

##### [NEW] Cargo.toml

Path: `src/wasm/crates/elex-decision-transformer/Cargo.toml`

```toml
[package]
name = "elex-decision-transformer"
version.workspace = true
edition.workspace = true
description = "Decision Transformer for trajectory-based sequence prediction in RAN optimization"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen.workspace = true
serde.workspace = true
serde_json.workspace = true
serde-wasm-bindgen.workspace = true
elex-core = { path = "../elex-core" }
elex-qlearning = { path = "../elex-qlearning" }

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

##### [NEW] lib.rs

Path: `src/wasm/crates/elex-decision-transformer/src/lib.rs`

```rust
pub mod transformer;
pub mod trajectory;
pub mod attention;

pub use transformer::{DecisionTransformer, TransformerConfig};
pub use trajectory::{TrajectoryBatch, TrajectoryProcessor};
pub use attention::{CausalAttention, AttentionHead};

#[wasm_bindgen]
pub fn create_decision_transformer(config: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn forward_pass(transformer: &DecisionTransformer, trajectory: JsValue) -> Result<JsValue, JsValue>;
```

##### [NEW] transformer.rs

Path: `src/wasm/crates/elex-decision-transformer/src/transformer.rs`

```rust
pub struct TransformerConfig {
    pub embed_dim: usize,        // 128 (matches HNSW)
    pub num_heads: usize,        // 4
    pub num_layers: usize,       // 3
    pub context_window: usize,   // 20 timesteps
    pub dropout: f32,            // 0.1
}

pub struct DecisionTransformer {
    config: TransformerConfig,
    layers: Vec<TransformerBlock>,
    action_head: MLPHead,
}

impl DecisionTransformer {
    pub fn forward(&self, trajectory: &TrajectoryBatch) -> ActionPrediction;
}
```

##### [NEW] attention.rs

Path: `src/wasm/crates/elex-decision-transformer/src/attention.rs`

SIMD-accelerated causal attention:

```rust
pub struct CausalAttention {
    pub heads: Vec<AttentionHead>,
    pub mask: CausalMask,
}

impl CausalAttention {
    #[cfg(target_arch = "wasm32")]
    pub fn forward_simd(&self, queries: &[f32], keys: &[f32], values: &[f32]) -> Vec<f32>;
    
    pub fn forward_scalar(&self, queries: &[f32], keys: &[f32], values: &[f32]) -> Vec<f32>;
}
```

##### [NEW] trajectory.rs

Path: `src/wasm/crates/elex-decision-transformer/src/trajectory.rs`

```rust
pub struct TrajectoryBatch {
    pub states: Vec<Vec<f32>>,      // [batch, seq_len, embed_dim]
    pub actions: Vec<usize>,         // [batch, seq_len]
    pub rewards: Vec<f32>,           // [batch, seq_len]
    pub timesteps: Vec<usize>,       // [batch, seq_len]
    pub returns_to_go: Vec<f32>,     // [batch, seq_len]
}
```

---

#### Component: elex-reasoningbank

4-step reasoning pipeline: RETRIEVE → JUDGE → DISTILL → CONSOLIDATE

##### [NEW] Cargo.toml

Path: `src/wasm/crates/elex-reasoningbank/Cargo.toml`

```toml
[package]
name = "elex-reasoningbank"
version.workspace = true
edition.workspace = true
description = "4-step reasoning pipeline for RAN knowledge synthesis"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen.workspace = true
serde.workspace = true
serde_json.workspace = true
serde-wasm-bindgen.workspace = true
elex-memory = { path = "../elex-memory" }
lzzzz.workspace = true
```

##### [NEW] lib.rs

Path: `src/wasm/crates/elex-reasoningbank/src/lib.rs`

```rust
pub mod retrieve;
pub mod judge;
pub mod distill;
pub mod consolidate;

#[wasm_bindgen]
pub struct ReasoningBank {
    hnsw_index: HnswIndex,
    patterns: Vec<ReasoningPattern>,
    verdicts: Vec<Verdict>,
}

#[wasm_bindgen]
impl ReasoningBank {
    pub fn retrieve(&self, query: &str, k: usize) -> Result<JsValue, JsValue>;
    pub fn judge(&self, response: &str, criteria: JsValue) -> Result<JsValue, JsValue>;
    pub fn distill(&self, trajectories: JsValue) -> Result<JsValue, JsValue>;
    pub fn consolidate(&mut self) -> Result<JsValue, JsValue>;
}
```

##### [NEW] retrieve.rs, judge.rs, distill.rs, consolidate.rs

```rust
// retrieve.rs - HNSW-based semantic retrieval
pub struct RetrieveResult {
    pub patterns: Vec<ReasoningPattern>,
    pub similarity_scores: Vec<f32>,
    pub retrieval_time_ms: f64,
}

// judge.rs - Rule-based verdict scoring (no external LLM)
pub struct Verdict {
    pub score: f32,           // 0.0-1.0
    pub confidence: f32,      // 0.0-1.0
    pub rationale: String,
    pub criteria_scores: HashMap<String, f32>,
}

// distill.rs - Pattern extraction from trajectories
pub struct ReasoningPattern {
    pub id: String,
    pub context_embedding: Vec<f32>,
    pub action_sequence: Vec<String>,
    pub success_rate: f32,
    pub usage_count: usize,
}

// consolidate.rs - Bank maintenance with LZ4 compression
pub struct ConsolidationResult {
    pub patterns_before: usize,
    pub patterns_after: usize,
    pub memory_saved_bytes: usize,
    pub duplicates_removed: usize,
}
```

##### [NEW] SONA Integration

Path: `src/wasm/crates/elex-reasoningbank/src/sona.rs`

Self-Optimizing Neural Architecture enables continuous improvement:

```rust
pub struct SonaConfig {
    pub micro_lora_rank: usize,      // 1-2 for fast adaptation
    pub base_lora_rank: usize,       // 4-16 for stability
    pub ewc_lambda: f32,             // 0.5 default (prevent catastrophic forgetting)
    pub reasoning_bank_capacity: usize, // K-means++ clustering size
    pub lock_free_trajectories: bool, // ~50ns overhead per step
}

impl Sona {
    pub fn learn_from_trajectory(&mut self, trajectory: &Trajectory) -> Result<(), SonaError>;
    pub fn adapt_weights(&mut self, feedback: f32) -> Result<(), SonaError>;
    pub fn consolidate_patterns(&mut self) -> ConsolidationResult;
}
```

**Performance Targets:**
- Learning Latency: <0.8ms per trajectory
- Adaptation Speed: <100μs per update
- Memory Overhead: <5% of base model
- Convergence: ~100 interactions per pattern

---

### Phase 2: Enhance Existing Crates (Week 2-3)

---

#### Component: Workspace Configuration

##### [MODIFY] Cargo.toml

Path: `src/wasm/Cargo.toml`

Add new crates to workspace members:

```diff
 members = [
     "crates/elex-core",
     "crates/elex-simd",
     "crates/elex-qlearning",
     "crates/elex-memory",
     "crates/elex-crypto",
     "crates/elex-routing",
     "crates/elex-safety",
     "crates/elex-agent",
     "crates/elex-wasm",
+    "crates/elex-decision-transformer",
+    "crates/elex-reasoningbank",
 ]
```

---

#### Component: elex-qlearning Federation Module

##### [NEW] federation.rs

Path: `src/wasm/crates/elex-qlearning/src/federation.rs`

Simplified federated Q-learning with consensus (~800 LOC):

```rust
use crate::{QTable, QEntry};
use serde::{Serialize, Deserialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct PeerId(pub String);

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

#[derive(Clone, Serialize, Deserialize)]
pub struct QUpdate {
    pub peer_id: PeerId,
    pub state_hash: u64,
    pub action: u8,
    pub q_value: f32,
    pub visits: u32,
    pub timestamp: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub updates_sent: usize,
    pub updates_received: usize,
    pub conflicts_resolved: usize,
    pub sync_time_ms: f64,
}

impl FederatedQTable {
    pub fn new(config: FederationConfig) -> Self;
    
    /// Sync with peers using visit-weighted averaging
    pub fn sync_with_peers(&mut self) -> Result<SyncResult, FederationError>;
    
    /// Propose a Q-table update to the swarm
    pub fn propose_update(&mut self, update: QUpdate) -> Result<(), FederationError>;
    
    /// Receive and validate update from peer
    pub fn receive_update(&mut self, peer: PeerId, update: QUpdate) -> Result<(), FederationError>;
    
    /// Weighted merge: merged_q = (local_q × local_visits + peer_q × peer_visits) / total_visits
    fn merge_qtables(&mut self, peer_qtable: &QTable);
}

#[derive(Clone)]
pub struct FederationConfig {
    pub sync_interval_ms: u64,        // 60000 (1 minute) OR after 10 interactions
    pub min_peers_for_consensus: usize, // 3
    pub byzantine_threshold: f32,      // 0.33 (tolerate 1/3 malicious)
    pub gossip_fanout: usize,          // 3 (log N propagation)
}
```

##### [MODIFY] lib.rs

Path: `src/wasm/crates/elex-qlearning/src/lib.rs`

Export federation module:

```diff
 pub mod batch;
 pub mod encoding;
 pub mod qtable;
 pub mod policy;
 pub mod replay;
 pub mod trajectory;
+pub mod federation;

+pub use federation::{
+    FederatedQTable, FederationConfig, FederationError,
+    PeerId, ConsensusState, QUpdate, SyncResult,
+};
```

---

#### Component: elex-agent Integration Hooks

##### [MODIFY] lib.rs

Path: `src/wasm/crates/elex-agent/src/lib.rs`

```rust
use elex_decision_transformer::DecisionTransformer;
use elex_reasoningbank::ReasoningBank;

impl FeatureAgent {
    pub fn with_decision_transformer(mut self, dt: DecisionTransformer) -> Self {
        self.decision_transformer = Some(dt);
        self
    }
    
    pub fn with_reasoning_bank(mut self, rb: ReasoningBank) -> Self {
        self.reasoning_bank = Some(rb);
        self
    }
    
    pub fn predict_action_with_dt(&self, trajectory: &TrajectoryBatch) -> Option<Action>;
    pub fn reason_and_respond(&self, query: &str) -> Option<ReasonedResponse>;
}
```

---

#### Component: elex-wasm WASM Exports

##### [MODIFY] lib.rs

Path: `src/wasm/crates/elex-wasm/src/lib.rs`

```rust
use wasm_bindgen::prelude::*;

// Decision Transformer exports
#[wasm_bindgen]
pub fn create_decision_transformer(config: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn decision_transformer_forward(dt_state: JsValue, trajectory: JsValue) -> Result<JsValue, JsValue>;

// ReasoningBank exports
#[wasm_bindgen]
pub fn reasoning_bank_retrieve(query: &str, k: usize) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn reasoning_bank_judge(response: &str, criteria: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn reasoning_bank_distill(trajectories: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn reasoning_bank_consolidate() -> Result<JsValue, JsValue>;

// Federation exports
#[wasm_bindgen]
pub fn create_federated_qtable(config: JsValue) -> Result<JsValue, JsValue>;

#[wasm_bindgen]
pub fn federated_sync(fqt_state: JsValue) -> Result<JsValue, JsValue>;
```

---

### Phase 3: AgentDB Integration (Week 3-4)

---

#### Component: TypeScript Bridge

##### [NEW] agentdb-bridge.ts

Path: `scripts/self-learning-demo/agentdb-bridge.ts`

```typescript
import { execSync } from 'child_process';

export interface SearchResult {
  key: string;
  value: any;
  score: number;
}

export const MEMORY_NAMESPACES = {
  'elex-knowledge': 'Feature metadata, parameters, counters, KPIs',
  'elex-intelligence': 'Q-tables, trajectories, patterns, verdicts',
  'elex-optimization': 'Optimization results, metrics, benchmarks',
  'elex-coordination': 'Federated sync, peer status, consensus results',
} as const;

export class AgentDBBridge {
  static async search(query: string, namespace = 'elex-knowledge', limit = 10): Promise<SearchResult[]> {
    const cmd = `npx @claude-flow/cli@latest memory search --query "${query}" --namespace ${namespace} --limit ${limit}`;
    return JSON.parse(execSync(cmd, { encoding: 'utf-8', timeout: 10000 }));
  }
  
  static async retrieve(key: string, namespace = 'elex-knowledge'): Promise<any> {
    const cmd = `npx @claude-flow/cli@latest memory retrieve --namespace ${namespace} --key "${key}"`;
    return JSON.parse(execSync(cmd, { encoding: 'utf-8', timeout: 5000 }));
  }
  
  static async store(key: string, value: object, namespace: string): Promise<boolean> {
    const valueJson = JSON.stringify(value).replace(/"/g, '\\"');
    const cmd = `npx @claude-flow/cli@latest memory store --namespace ${namespace} --key "${key}" --value "${valueJson}"`;
    execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
    return true;
  }
}
```

---

### Phase 4: Demo Scripts (Week 4-5)

---

#### Component: Interactive CLI

##### [NEW] interactive-cli.ts

Path: `scripts/self-learning-demo/interactive-cli.ts`

```typescript
#!/usr/bin/env bun

// Menu options:
// 1. Query Agent (semantic search AgentDB)
// 2. View Q-Learning State
// 3. Train Decision Transformer
// 4. Trigger Federated Sync
// 5. ReasoningBank Pipeline Demo
// 6. Performance Benchmark
// 7. Exit

// See full implementation in Phase 4 deliverables
```

---

#### Component: Battle Test Arena

##### [NEW] battle-arena.ts

Path: `scripts/self-learning-demo/battle-arena.ts`

Competitive evaluation of 4 agent configurations:
- Q-Learning Only
- Decision Transformer Only
- Hybrid (Q+DT)
- Full Stack (Q+DT+FL+RB)

```bash
# Run battle arena
bun run scripts/self-learning-demo/battle-arena.ts --rounds=3 --queries=50
```

---

## Verification Plan

### Automated Tests

```bash
# Existing tests
bun test tests/unit
bun test tests/integration
bun test tests/battle-arena/ran-agent-battle-arena.ts

# WASM Rust tests
cd src/wasm && cargo test --workspace

# New crate tests
cd src/wasm && cargo test -p elex-decision-transformer
cd src/wasm && cargo test -p elex-reasoningbank
cd src/wasm && cargo test -p elex-qlearning --test federation

# WASM build
cd src/wasm && cargo build --release --target wasm32-unknown-unknown
cd src/wasm && wasm-pack build --target web crates/elex-wasm
```

### Manual Verification

| Step | Command | Expected |
|------|---------|----------|
| 1. CLI Demo | `bun run scripts/self-learning-demo/interactive-cli.ts` | Menu with 7 options |
| 2. Web Dashboard | `cd src/wasm && python3 -m http.server 8080 -d demo-browser` | Dashboard at localhost:8080 |
| 3. Battle Arena | `bun run scripts/self-learning-demo/battle-arena.ts --rounds=3` | Comparison table |
| 4. AgentDB | `npx @claude-flow/cli@latest memory search --query "MIMO sleep"` | Feature matches |

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| HNSW Search | <1ms (P95) | `cargo bench -p elex-memory` |
| OODA Loop | <100ms | CLI timing |
| Agent Coordination | <100ms/15 agents | Battle arena |
| SIMD Speedup | 3-8x | `cargo bench -p elex-simd` |
| Memory | <500MB | WASM heap stats |
| DT Forward Pass | <10ms | Rust tests |
| Federated Sync | <5s | CLI option 4 |
| GNN Message Passing | <5ms | Neural layer benchmark |
| SONA Trajectory | <0.8ms | Learning loop timing |
| Compression Ratio | 4-32x | LZ4/PQ benchmarks |

---

## RAN Feature Domains (1,153 Features)

| # | Domain | Features |
|---|--------|----------|
| 1 | Carrier Aggregation | ~89 |
| 2 | MIMO & Antenna | ~40 |
| 3 | Radio Resource Management | ~64 |
| 4 | Mobility | ~36 |
| 5 | Energy Saving | ~29 |
| 6 | Coverage & Capacity | ~28 |
| 7 | Transport | ~52 |
| 8 | Interference | ~5 |
| 9 | Voice & IMS | ~21 |
| 10 | Security | ~3 |
| 11 | QoS | ~8 |
| 12 | Timing | ~5 |
| 13 | SON | ~2 |
| 14 | NR/5G | ~57 |
| 15 | UE Handling | ~11 |

---

## Critical Files Summary

| File | Purpose | Status |
|------|---------|--------|
| `src/wasm/crates/elex-decision-transformer/` | Decision Transformer crate | NEW |
| `src/wasm/crates/elex-reasoningbank/` | ReasoningBank 4-step pipeline | NEW |
| `src/wasm/crates/elex-qlearning/src/federation.rs` | Federated Q-learning | NEW |
| `scripts/self-learning-demo/interactive-cli.ts` | Interactive CLI demo | NEW |
| `scripts/self-learning-demo/battle-arena.ts` | Competitive evaluation | NEW |
| `src/wasm/Cargo.toml` | Workspace config | MODIFY |

---

## Phased Implementation Schedule

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **1** | Week 1-2 | `elex-decision-transformer`, `elex-reasoningbank` crates |
| **2** | Week 2-3 | `federation.rs`, agent integration hooks, WASM exports |
| **3** | Week 3-4 | AgentDB bridge, memory namespaces |
| **4** | Week 4-5 | Interactive CLI, Web dashboard, Battle arena |
| **5** | Week 5-6 | Verification, benchmarks, documentation |

---

## Success Criteria

- [ ] All 11 WASM crates compile with `cargo build --release`
- [ ] Decision Transformer forward pass <10ms
- [ ] ReasoningBank 4-step pipeline functional
- [ ] Federated Q-table sync with 14 coordinators
- [ ] Interactive CLI demo runs with all 7 options
- [ ] Battle arena produces comparison table
- [ ] SIMD speedup 3-8x verified
- [ ] Memory usage <500MB with 50 cached agents

---

## Cross-References

> **Architecture Details**: For complete system architecture, agent specifications, and comprehensive requirements, see [PRD.md](./PRD.md).

---

## Naming Convention

This project uses a **hybrid naming convention**:

| Package Type | Convention | Examples |
|--------------|------------|----------|
| **npm packages** | `@ruvector/*` | `@ruvector/edge`, `@ruvector/memory` |
| **Rust/WASM crates** | `elex-*` | `elex-memory`, `elex-qlearning`, `elex-reasoningbank` |

---

## References

- **Min-Cut Algorithm**: [Deterministic and Exact Fully-dynamic Minimum Cut of Superpolylogarithmic Size in Subpolynomial Time](https://arxiv.org/abs/2512.13105) (December 2025)
