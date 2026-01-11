# ELEX WASM Agent Implementation Roadmap

**Version:** 2.1.0 | **Status:** Ready for AI Agent Execution | **Duration:** 14 Weeks

This roadmap provides concrete, executable tasks for AI coding agents to build the ELEX 593-agent neural system. Each task includes clear inputs, outputs, success criteria, and agent assignments.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 52 |
| Duration | 14 weeks |
| Parallel Tracks | 4 (Core, SIMD, Q-Learning, Memory) |
| Agent Types Required | coder, tester, reviewer, architect, security-auditor |
| Critical Path Length | 28 tasks |

---

## Dependency Graph Overview

```
Week 1-2: Core Infrastructure
  TASK-001 ─┬─> TASK-002 ─┬─> TASK-004 (SIMD)
            │             │
            │             └─> TASK-008 (Q-Learning)
            │
            └─> TASK-003 ─────> TASK-012 (Memory)

Week 3-4: SIMD Operations (parallel track)
  TASK-004 ─┬─> TASK-005 ─┬─> TASK-006
            │             │
            └─> TASK-007 ─┘

Week 5-6: Q-Learning Engine
  TASK-008 ─> TASK-009 ─> TASK-010 ─> TASK-011

Week 7-8: Memory System
  TASK-012 ─> TASK-013 ─> TASK-014 ─> TASK-015

Week 9-10: Security & Cryptography
  TASK-016 ─> TASK-017 ─> TASK-018 ─> TASK-019 ─> TASK-020

Week 11-12: Coordination & Routing
  TASK-021 ─> TASK-022 ─> TASK-023 ─> TASK-024 ─> TASK-025

Week 13-14: Integration & Safe Zones
  TASK-026 ─> ... ─> TASK-052 (Final Integration)
```

---

## Week 1-2: Core Infrastructure

### TASK-001: Create Cargo Workspace

| Field | Value |
|-------|-------|
| **Task ID** | TASK-001 |
| **Title** | Create Cargo workspace with crate structure |
| **Dependencies** | None |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-107 (Domain-Driven Design structure)
- Existing `/wasm/agent/Cargo.toml` as reference

**Expected Output Files:**
```
wasm/Cargo.toml                      # Workspace root
wasm/crates/elex-core/Cargo.toml     # Core types
wasm/crates/elex-simd/Cargo.toml     # SIMD operations
wasm/crates/elex-qlearning/Cargo.toml # Q-learning engine
wasm/crates/elex-memory/Cargo.toml   # Memory/HNSW
wasm/crates/elex-crypto/Cargo.toml   # Cryptography
wasm/crates/elex-routing/Cargo.toml  # Semantic routing
wasm/crates/elex-agent/Cargo.toml    # Agent binary
```

**Success Criteria:**
```bash
cd /Users/cedric/dev/2026/test-cfv3/wasm
cargo check --workspace
# Exit code: 0
```

**Implementation Notes:**
```toml
# wasm/Cargo.toml
[workspace]
members = [
    "crates/elex-core",
    "crates/elex-simd",
    "crates/elex-qlearning",
    "crates/elex-memory",
    "crates/elex-crypto",
    "crates/elex-routing",
    "crates/elex-agent",
]
resolver = "2"

[workspace.dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
thiserror = "1.0"
```

---

### TASK-002: Implement Core Types (elex-core)

| Field | Value |
|-------|-------|
| **Task ID** | TASK-002 |
| **Title** | Implement core types and traits |
| **Dependencies** | TASK-001 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-107 (DDD structure)
- ADR-006 (Q-Learning state/action types)
- ADR-005 (Vector memory types)

**Expected Output Files:**
```
wasm/crates/elex-core/src/lib.rs
wasm/crates/elex-core/src/types.rs       # Core domain types
wasm/crates/elex-core/src/error.rs       # Error types
wasm/crates/elex-core/src/traits.rs      # Core traits
wasm/crates/elex-core/src/feature.rs     # Feature entity (593 features)
wasm/crates/elex-core/src/parameter.rs   # Parameter value object
wasm/crates/elex-core/src/counter.rs     # Counter value object
wasm/crates/elex-core/src/kpi.rs         # KPI value object
```

**Success Criteria:**
```bash
cd /Users/cedric/dev/2026/test-cfv3/wasm/crates/elex-core
cargo test
cargo doc --no-deps
# All tests pass, documentation builds
```

**Key Types to Implement:**
```rust
// types.rs
pub type AgentId = [u8; 32];
pub type FeatureCode = String;  // FAJ/CXC format
pub type StateVector = [f32; 64];
pub type Embedding = [f32; 128];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QueryType {
    Parameter,
    Counter,
    Kpi,
    Procedure,
    Troubleshoot,
    General,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Complexity {
    Simple,
    Moderate,
    Complex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    DirectAnswer,
    ContextAnswer,
    ConsultPeer,
    RequestClarification,
    Escalate,
}

// error.rs
#[derive(Debug, thiserror::Error)]
pub enum ElexError {
    #[error("Agent not found: {0}")]
    AgentNotFound(String),
    #[error("Feature not found: {0}")]
    FeatureNotFound(String),
    #[error("Invalid state vector dimension: expected 64, got {0}")]
    InvalidStateDimension(usize),
    #[error("SIMD operation failed: {0}")]
    SimdError(String),
    #[error("Memory error: {0}")]
    MemoryError(String),
    #[error("Cryptographic error: {0}")]
    CryptoError(String),
}

// traits.rs
pub trait Agent: Send + Sync {
    fn id(&self) -> &AgentId;
    fn feature_code(&self) -> &FeatureCode;
    fn handle_query(&mut self, query: &Query) -> Result<Response, ElexError>;
    fn record_feedback(&mut self, query_id: &str, reward: f32);
}

pub trait VectorIndex: Send + Sync {
    fn insert(&mut self, id: u64, vector: &Embedding) -> Result<(), ElexError>;
    fn search(&self, query: &Embedding, k: usize) -> Result<Vec<(u64, f32)>, ElexError>;
    fn len(&self) -> usize;
}

pub trait QTable: Send + Sync {
    fn get(&self, state: &StateVector, action: Action) -> f32;
    fn update(&mut self, state: &StateVector, action: Action, value: f32);
    fn best_action(&self, state: &StateVector) -> Action;
}
```

---

### TASK-003: Implement Logging/Tracing for WASM

| Field | Value |
|-------|-------|
| **Task ID** | TASK-003 |
| **Title** | Implement WASM-compatible logging |
| **Dependencies** | TASK-001 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-105 (WASM constraints)
- Browser console API

**Expected Output Files:**
```
wasm/crates/elex-core/src/logging.rs
```

**Success Criteria:**
```javascript
// In browser console:
const agent = await initElexAgent();
agent.log_debug("Test message");
// Console shows: "[ELEX DEBUG] Test message"
```

**Implementation:**
```rust
// logging.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn warn(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

#[macro_export]
macro_rules! elex_debug {
    ($($arg:tt)*) => {
        $crate::logging::log(&format!("[ELEX DEBUG] {}", format!($($arg)*)));
    };
}

#[macro_export]
macro_rules! elex_info {
    ($($arg:tt)*) => {
        $crate::logging::log(&format!("[ELEX INFO] {}", format!($($arg)*)));
    };
}

#[macro_export]
macro_rules! elex_warn {
    ($($arg:tt)*) => {
        $crate::logging::warn(&format!("[ELEX WARN] {}", format!($($arg)*)));
    };
}

#[macro_export]
macro_rules! elex_error {
    ($($arg:tt)*) => {
        $crate::logging::error(&format!("[ELEX ERROR] {}", format!($($arg)*)));
    };
}

pub fn log(msg: &str) {
    #[cfg(target_arch = "wasm32")]
    log(msg);
    #[cfg(not(target_arch = "wasm32"))]
    println!("{}", msg);
}
```

---

## Week 3-4: SIMD Operations

### TASK-004: Implement SIMD Cosine Similarity

| Field | Value |
|-------|-------|
| **Task ID** | TASK-004 |
| **Title** | Implement SIMD-accelerated cosine similarity |
| **Dependencies** | TASK-001, TASK-002 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-105 (WASM SIMD128)
- ADR-005 (128-dim embeddings)

**Expected Output Files:**
```
wasm/crates/elex-simd/src/lib.rs
wasm/crates/elex-simd/src/similarity.rs
wasm/crates/elex-simd/src/tests.rs
```

**Success Criteria:**
```bash
# Benchmark: SIMD vs scalar
cargo bench --features simd
# Expected: 3-5x speedup for 128-dim vectors
```

**Implementation:**
```rust
// similarity.rs
use std::arch::wasm32::*;

/// SIMD-accelerated cosine similarity for 128-dim vectors
/// Returns similarity in range [-1, 1]
#[target_feature(enable = "simd128")]
pub unsafe fn cosine_similarity_simd(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    let mut dot_sum = f32x4_splat(0.0);
    let mut a_sq_sum = f32x4_splat(0.0);
    let mut b_sq_sum = f32x4_splat(0.0);

    for i in (0..128).step_by(4) {
        let a_vec = v128_load(a.as_ptr().add(i) as *const v128);
        let b_vec = v128_load(b.as_ptr().add(i) as *const v128);

        dot_sum = f32x4_add(dot_sum, f32x4_mul(a_vec, b_vec));
        a_sq_sum = f32x4_add(a_sq_sum, f32x4_mul(a_vec, a_vec));
        b_sq_sum = f32x4_add(b_sq_sum, f32x4_mul(b_vec, b_vec));
    }

    let dot = horizontal_sum(dot_sum);
    let a_norm = horizontal_sum(a_sq_sum).sqrt();
    let b_norm = horizontal_sum(b_sq_sum).sqrt();

    if a_norm * b_norm == 0.0 {
        0.0
    } else {
        dot / (a_norm * b_norm)
    }
}

#[inline]
unsafe fn horizontal_sum(v: v128) -> f32 {
    f32x4_extract_lane::<0>(v)
        + f32x4_extract_lane::<1>(v)
        + f32x4_extract_lane::<2>(v)
        + f32x4_extract_lane::<3>(v)
}
```

---

### TASK-005: Implement SIMD Q-Table Batch Operations

| Field | Value |
|-------|-------|
| **Task ID** | TASK-005 |
| **Title** | Implement SIMD batch Q-value updates |
| **Dependencies** | TASK-004 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-006 (Q-Learning update rule)
- ADR-105 (SIMD acceleration)

**Expected Output Files:**
```
wasm/crates/elex-simd/src/qlearning.rs
```

**Success Criteria:**
```bash
cargo bench --features simd -- q_batch
# Expected: 2-4x speedup for batch updates
```

**Implementation:**
```rust
// qlearning.rs
use std::arch::wasm32::*;

/// Batch Q-value update using SIMD
/// Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
#[target_feature(enable = "simd128")]
pub unsafe fn batch_q_update(
    q_values: &mut [f32],      // Current Q-values (len = batch_size * num_actions)
    rewards: &[f32],           // Rewards (len = batch_size)
    next_max_q: &[f32],        // max Q(s',a') (len = batch_size)
    num_actions: usize,
    alpha: f32,
    gamma: f32,
) {
    let alpha_vec = f32x4_splat(alpha);
    let gamma_vec = f32x4_splat(gamma);
    let batch_size = rewards.len();

    for batch_idx in (0..batch_size).step_by(4) {
        let r = v128_load(rewards.as_ptr().add(batch_idx) as *const v128);
        let next_q = v128_load(next_max_q.as_ptr().add(batch_idx) as *const v128);

        // TD target: r + gamma * max(Q(s',a'))
        let td_target = f32x4_add(r, f32x4_mul(gamma_vec, next_q));

        // Update each action's Q-value
        for action in 0..num_actions {
            let q_idx = batch_idx * num_actions + action;
            if q_idx + 4 <= q_values.len() {
                let current_q = v128_load(q_values.as_ptr().add(q_idx) as *const v128);
                let td_error = f32x4_sub(td_target, current_q);
                let update = f32x4_mul(alpha_vec, td_error);
                let new_q = f32x4_add(current_q, update);
                v128_store(q_values.as_mut_ptr().add(q_idx) as *mut v128, new_q);
            }
        }
    }
}
```

---

### TASK-006: Implement SIMD Parameter Validation

| Field | Value |
|-------|-------|
| **Task ID** | TASK-006 |
| **Title** | Implement SIMD parameter bounds checking |
| **Dependencies** | TASK-004 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-008 (Safe zone constraints)

**Expected Output Files:**
```
wasm/crates/elex-simd/src/validation.rs
```

**Success Criteria:**
```bash
cargo bench --features simd -- validate
# Expected: 4-8x speedup for batch validation (100+ parameters)
```

**Implementation:**
```rust
// validation.rs
use std::arch::wasm32::*;

/// Batch check if values are within [min, max] bounds
/// Returns bitmask: 1 = valid, 0 = invalid
#[target_feature(enable = "simd128")]
pub unsafe fn batch_bounds_check(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
) -> Vec<bool> {
    let n = values.len();
    let mut results = vec![false; n];

    for i in (0..n).step_by(4) {
        if i + 4 <= n {
            let v = v128_load(values.as_ptr().add(i) as *const v128);
            let min_v = v128_load(min_bounds.as_ptr().add(i) as *const v128);
            let max_v = v128_load(max_bounds.as_ptr().add(i) as *const v128);

            // v >= min AND v <= max
            let ge_min = f32x4_ge(v, min_v);
            let le_max = f32x4_le(v, max_v);
            let valid = v128_and(ge_min, le_max);

            // Extract lane results
            results[i] = i32x4_extract_lane::<0>(valid) != 0;
            results[i + 1] = i32x4_extract_lane::<1>(valid) != 0;
            results[i + 2] = i32x4_extract_lane::<2>(valid) != 0;
            results[i + 3] = i32x4_extract_lane::<3>(valid) != 0;
        }
    }

    // Handle remaining elements
    for i in (n / 4 * 4)..n {
        results[i] = values[i] >= min_bounds[i] && values[i] <= max_bounds[i];
    }

    results
}
```

---

### TASK-007: Implement Scalar Fallbacks

| Field | Value |
|-------|-------|
| **Task ID** | TASK-007 |
| **Title** | Implement scalar fallbacks for non-SIMD targets |
| **Dependencies** | TASK-004, TASK-005, TASK-006 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-105 (Feature detection and fallback)

**Expected Output Files:**
```
wasm/crates/elex-simd/src/scalar.rs
wasm/crates/elex-simd/src/dispatch.rs
```

**Success Criteria:**
```bash
# Build without SIMD
cargo build --target wasm32-unknown-unknown
# Tests pass on both SIMD and non-SIMD
cargo test
cargo test --features simd
```

**Implementation:**
```rust
// scalar.rs
pub fn cosine_similarity_scalar(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    let mut dot = 0.0f32;
    let mut a_sq = 0.0f32;
    let mut b_sq = 0.0f32;

    for i in 0..128 {
        dot += a[i] * b[i];
        a_sq += a[i] * a[i];
        b_sq += b[i] * b[i];
    }

    let denom = (a_sq * b_sq).sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

// dispatch.rs
pub fn cosine_similarity(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    unsafe { super::similarity::cosine_similarity_simd(a, b) }

    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    super::scalar::cosine_similarity_scalar(a, b)
}
```

---

## Week 5-6: Q-Learning Engine

### TASK-008: Implement Q-Table Structure

| Field | Value |
|-------|-------|
| **Task ID** | TASK-008 |
| **Title** | Implement Q-table data structure |
| **Dependencies** | TASK-002 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-006 (Q-Learning specification)
- State space: query_type, complexity, context_hash, confidence
- Action space: 5 actions

**Expected Output Files:**
```
wasm/crates/elex-qlearning/src/lib.rs
wasm/crates/elex-qlearning/src/qtable.rs
wasm/crates/elex-qlearning/src/tests.rs
```

**Success Criteria:**
```rust
#[test]
fn test_qtable_insert_lookup() {
    let mut qt = QTable::new(0.1, 0.95);
    let state = encode_state(...);
    qt.update(state, Action::DirectAnswer, 0.5);
    assert!(qt.get(state, Action::DirectAnswer) > 0.0);
}
```

**Implementation:**
```rust
// qtable.rs
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QEntry {
    pub value: f32,
    pub visits: u32,
    pub last_update: u64,  // Timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QTable {
    entries: HashMap<(u64, u8), QEntry>,  // (state_hash, action_idx) -> entry
    pub alpha: f32,   // Learning rate
    pub gamma: f32,   // Discount factor
    pub epsilon: f32, // Exploration rate
}

impl QTable {
    pub fn new(alpha: f32, gamma: f32) -> Self {
        Self {
            entries: HashMap::new(),
            alpha,
            gamma,
            epsilon: 0.1,
        }
    }

    pub fn get(&self, state_hash: u64, action: Action) -> f32 {
        self.entries
            .get(&(state_hash, action as u8))
            .map(|e| e.value)
            .unwrap_or(0.0)
    }

    pub fn update(&mut self, state_hash: u64, action: Action, reward: f32, next_max_q: f32) {
        let key = (state_hash, action as u8);
        let current_q = self.get(state_hash, action);

        // Q-learning update: Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
        let td_target = reward + self.gamma * next_max_q;
        let new_q = current_q + self.alpha * (td_target - current_q);

        let entry = self.entries.entry(key).or_insert(QEntry {
            value: 0.0,
            visits: 0,
            last_update: 0,
        });
        entry.value = new_q;
        entry.visits += 1;
        entry.last_update = now_timestamp();
    }

    pub fn best_action(&self, state_hash: u64) -> Action {
        Action::iter()
            .max_by(|a, b| {
                self.get(state_hash, *a)
                    .partial_cmp(&self.get(state_hash, *b))
                    .unwrap()
            })
            .unwrap_or(Action::DirectAnswer)
    }

    pub fn epsilon_greedy(&self, state_hash: u64, rng: &mut impl Rng) -> Action {
        if rng.gen::<f32>() < self.epsilon {
            Action::random(rng)
        } else {
            self.best_action(state_hash)
        }
    }

    pub fn confidence(&self, state_hash: u64, action: Action) -> f32 {
        let visits = self.entries
            .get(&(state_hash, action as u8))
            .map(|e| e.visits)
            .unwrap_or(0);
        1.0 - 1.0 / (visits as f32 + 1.0)
    }
}
```

---

### TASK-009: Implement State/Action Encoding

| Field | Value |
|-------|-------|
| **Task ID** | TASK-009 |
| **Title** | Implement deterministic state encoding |
| **Dependencies** | TASK-008 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-006 (State space definition)

**Expected Output Files:**
```
wasm/crates/elex-qlearning/src/encoding.rs
```

**Success Criteria:**
```rust
#[test]
fn test_encoding_deterministic() {
    let state1 = encode_state(QueryType::Parameter, Complexity::Simple, 0x123, 0.8);
    let state2 = encode_state(QueryType::Parameter, Complexity::Simple, 0x123, 0.8);
    assert_eq!(state1, state2);
}
```

**Implementation:**
```rust
// encoding.rs
use crate::types::{QueryType, Complexity};

/// Encode state components into a 64-bit hash
/// Layout: [query_type: 3 bits][complexity: 2 bits][confidence_bucket: 4 bits][context_hash: 55 bits]
pub fn encode_state(
    query_type: QueryType,
    complexity: Complexity,
    context_hash: u64,
    confidence: f32,
) -> u64 {
    let qt = query_type as u64;
    let cx = complexity as u64;
    let conf_bucket = discretize_confidence(confidence);
    let ctx = context_hash & 0x7FFFFFFFFFFFFF; // 55 bits

    (qt << 61) | (cx << 59) | (conf_bucket << 55) | ctx
}

/// Discretize confidence into 16 buckets (4 bits)
fn discretize_confidence(confidence: f32) -> u64 {
    let clamped = confidence.clamp(0.0, 1.0);
    (clamped * 15.0).round() as u64
}

/// Decode state hash back to components
pub fn decode_state(hash: u64) -> (QueryType, Complexity, u64, f32) {
    let qt = QueryType::from((hash >> 61) as u8);
    let cx = Complexity::from(((hash >> 59) & 0x3) as u8);
    let conf_bucket = ((hash >> 55) & 0xF) as f32 / 15.0;
    let ctx = hash & 0x7FFFFFFFFFFFFF;

    (qt, cx, ctx, conf_bucket)
}
```

---

### TASK-010: Implement Epsilon-Greedy Policy

| Field | Value |
|-------|-------|
| **Task ID** | TASK-010 |
| **Title** | Implement epsilon-greedy with decay |
| **Dependencies** | TASK-008, TASK-009 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-006 (User-consent-based exploration)

**Expected Output Files:**
```
wasm/crates/elex-qlearning/src/policy.rs
```

**Success Criteria:**
```rust
#[test]
fn test_epsilon_decay() {
    let mut policy = EpsilonGreedy::new(0.3, 0.01, 0.995);
    for _ in 0..100 {
        policy.decay();
    }
    assert!(policy.epsilon < 0.3);
    assert!(policy.epsilon >= 0.01);
}
```

**Implementation:**
```rust
// policy.rs
use crate::types::Action;
use rand::Rng;

pub struct EpsilonGreedy {
    pub epsilon: f32,
    pub epsilon_min: f32,
    pub decay_rate: f32,
    pub exploration_enabled: bool, // User consent
}

impl EpsilonGreedy {
    pub fn new(epsilon: f32, epsilon_min: f32, decay_rate: f32) -> Self {
        Self {
            epsilon,
            epsilon_min,
            decay_rate,
            exploration_enabled: false, // Opt-in
        }
    }

    pub fn enable_exploration(&mut self, enabled: bool) {
        self.exploration_enabled = enabled;
    }

    pub fn select_action<R: Rng>(
        &self,
        qtable: &QTable,
        state_hash: u64,
        rng: &mut R,
    ) -> Action {
        if self.exploration_enabled && rng.gen::<f32>() < self.epsilon {
            Action::random(rng)
        } else {
            qtable.best_action(state_hash)
        }
    }

    pub fn decay(&mut self) {
        self.epsilon = (self.epsilon * self.decay_rate).max(self.epsilon_min);
    }
}
```

---

### TASK-011: Implement Experience Replay Buffer

| Field | Value |
|-------|-------|
| **Task ID** | TASK-011 |
| **Title** | Implement prioritized experience replay |
| **Dependencies** | TASK-008 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-006 (Trajectory buffer)
- ADR-104 (Prioritized Experience Replay)

**Expected Output Files:**
```
wasm/crates/elex-qlearning/src/replay.rs
```

**Success Criteria:**
```rust
#[test]
fn test_replay_priority_sampling() {
    let mut buffer = ReplayBuffer::new(100);
    buffer.push(Experience { td_error: 0.1, ... });
    buffer.push(Experience { td_error: 0.9, ... });

    let samples = buffer.sample_prioritized(10);
    // Higher TD-error experiences should be sampled more often
}
```

**Implementation:**
```rust
// replay.rs
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Experience {
    pub state: u64,
    pub action: Action,
    pub reward: f32,
    pub next_state: u64,
    pub td_error: f32,
    pub timestamp: u64,
}

pub struct ReplayBuffer {
    buffer: Vec<Experience>,
    max_size: usize,
    alpha: f32,  // Prioritization exponent
    beta: f32,   // Importance sampling
}

impl ReplayBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(max_size),
            max_size,
            alpha: 0.6,
            beta: 0.4,
        }
    }

    pub fn push(&mut self, exp: Experience) {
        if self.buffer.len() >= self.max_size {
            // Remove oldest or lowest priority
            self.buffer.remove(0);
        }
        self.buffer.push(exp);
    }

    pub fn sample_prioritized<R: Rng>(&self, batch_size: usize, rng: &mut R) -> Vec<&Experience> {
        if self.buffer.is_empty() {
            return vec![];
        }

        // Calculate priorities
        let priorities: Vec<f32> = self.buffer
            .iter()
            .map(|e| (e.td_error.abs() + 0.01).powf(self.alpha))
            .collect();

        let total: f32 = priorities.iter().sum();
        let probs: Vec<f32> = priorities.iter().map(|p| p / total).collect();

        // Weighted sampling
        let mut samples = Vec::with_capacity(batch_size);
        for _ in 0..batch_size.min(self.buffer.len()) {
            let r: f32 = rng.gen();
            let mut cumsum = 0.0;
            for (i, &p) in probs.iter().enumerate() {
                cumsum += p;
                if r <= cumsum {
                    samples.push(&self.buffer[i]);
                    break;
                }
            }
        }
        samples
    }

    pub fn update_td_error(&mut self, idx: usize, td_error: f32) {
        if idx < self.buffer.len() {
            self.buffer[idx].td_error = td_error;
        }
    }

    pub fn len(&self) -> usize {
        self.buffer.len()
    }
}
```

---

## Week 7-8: Memory System

### TASK-012: Integrate HNSW Index

| Field | Value |
|-------|-------|
| **Task ID** | TASK-012 |
| **Title** | Implement HNSW vector index for WASM |
| **Dependencies** | TASK-002, TASK-004 |
| **Agent Type** | coder |
| **Complexity** | L (Large) |

**Input Requirements:**
- ADR-005 (HNSW configuration: M=16, efConstruction=200, efSearch=50)
- ADR-104 (Memory integration)

**Expected Output Files:**
```
wasm/crates/elex-memory/src/lib.rs
wasm/crates/elex-memory/src/hnsw.rs
wasm/crates/elex-memory/src/tests.rs
```

**Success Criteria:**
```rust
#[test]
fn test_hnsw_performance() {
    let mut index = HnswIndex::new(HnswConfig::default());

    // Insert 10,000 vectors
    for i in 0..10_000 {
        index.insert(i, &random_embedding());
    }

    // Search should be <1ms
    let start = now();
    let results = index.search(&query, 10);
    let elapsed = now() - start;

    assert!(elapsed < Duration::from_millis(1));
    assert_eq!(results.len(), 10);
}
```

**Implementation:**
```rust
// hnsw.rs
use crate::simd::cosine_similarity;
use rand::Rng;

pub struct HnswConfig {
    pub m: usize,              // Max connections per layer
    pub ef_construction: usize, // Build-time search width
    pub ef_search: usize,       // Query-time search width
    pub max_level: usize,
}

impl Default for HnswConfig {
    fn default() -> Self {
        Self {
            m: 16,
            ef_construction: 200,
            ef_search: 50,
            max_level: 16,
        }
    }
}

struct Node {
    id: u64,
    vector: [f32; 128],
    level: usize,
    neighbors: Vec<Vec<u64>>, // neighbors[level] = [node_ids]
}

pub struct HnswIndex {
    config: HnswConfig,
    nodes: HashMap<u64, Node>,
    entry_point: Option<u64>,
    level_mult: f32,
}

impl HnswIndex {
    pub fn new(config: HnswConfig) -> Self {
        Self {
            level_mult: 1.0 / (config.m as f32).ln(),
            config,
            nodes: HashMap::new(),
            entry_point: None,
        }
    }

    pub fn insert(&mut self, id: u64, vector: &[f32; 128]) {
        let level = self.random_level();
        let node = Node {
            id,
            vector: *vector,
            level,
            neighbors: vec![Vec::new(); level + 1],
        };

        if let Some(ep) = self.entry_point {
            // Search for nearest neighbors at each level
            let mut current = ep;
            for l in (level + 1..self.max_level()).rev() {
                current = self.search_layer(vector, current, 1, l)[0].0;
            }

            for l in (0..=level.min(self.max_level() - 1)).rev() {
                let neighbors = self.search_layer(vector, current, self.config.ef_construction, l);
                self.connect_neighbors(id, &neighbors, l);
                if !neighbors.is_empty() {
                    current = neighbors[0].0;
                }
            }
        }

        self.nodes.insert(id, node);

        if self.entry_point.is_none() || level > self.nodes[&self.entry_point.unwrap()].level {
            self.entry_point = Some(id);
        }
    }

    pub fn search(&self, query: &[f32; 128], k: usize) -> Vec<(u64, f32)> {
        let Some(ep) = self.entry_point else {
            return vec![];
        };

        let mut current = ep;

        // Traverse from top to level 1
        for l in (1..self.max_level()).rev() {
            let result = self.search_layer(query, current, 1, l);
            if !result.is_empty() {
                current = result[0].0;
            }
        }

        // Search at level 0 with ef_search
        let mut results = self.search_layer(query, current, self.config.ef_search, 0);
        results.truncate(k);
        results
    }

    fn search_layer(&self, query: &[f32; 128], entry: u64, ef: usize, level: usize) -> Vec<(u64, f32)> {
        // Greedy beam search implementation
        // ... (full implementation omitted for brevity)
        vec![]
    }

    fn random_level(&self) -> usize {
        let r: f32 = rand::thread_rng().gen();
        (-r.ln() * self.level_mult).floor() as usize
    }

    fn max_level(&self) -> usize {
        self.config.max_level
    }
}
```

---

### TASK-013: Implement Trajectory Buffer

| Field | Value |
|-------|-------|
| **Task ID** | TASK-013 |
| **Title** | Implement ring buffer for trajectories |
| **Dependencies** | TASK-012 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-104 (1000 trajectory max, deduplication)

**Expected Output Files:**
```
wasm/crates/elex-memory/src/trajectory.rs
```

**Success Criteria:**
```rust
#[test]
fn test_ring_buffer_overflow() {
    let mut buffer = TrajectoryBuffer::new(100);
    for i in 0..200 {
        buffer.push(Trajectory::new(i));
    }
    assert_eq!(buffer.len(), 100);
    assert!(buffer.oldest().id >= 100);
}
```

**Implementation:**
```rust
// trajectory.rs
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trajectory {
    pub id: u64,
    pub states: Vec<u64>,
    pub actions: Vec<Action>,
    pub rewards: Vec<f32>,
    pub cumulative_reward: f32,
    pub timestamp: u64,
    pub hash: u64, // For deduplication
}

pub struct TrajectoryBuffer {
    buffer: Vec<Trajectory>,
    max_size: usize,
    head: usize,
    seen_hashes: HashSet<u64>,
}

impl TrajectoryBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(max_size),
            max_size,
            head: 0,
            seen_hashes: HashSet::new(),
        }
    }

    pub fn push(&mut self, traj: Trajectory) {
        // Deduplication
        if self.seen_hashes.contains(&traj.hash) {
            return;
        }

        if self.buffer.len() < self.max_size {
            self.seen_hashes.insert(traj.hash);
            self.buffer.push(traj);
        } else {
            // Remove old hash
            self.seen_hashes.remove(&self.buffer[self.head].hash);
            self.seen_hashes.insert(traj.hash);
            self.buffer[self.head] = traj;
            self.head = (self.head + 1) % self.max_size;
        }
    }

    pub fn sample_by_reward<R: Rng>(&self, k: usize, rng: &mut R) -> Vec<&Trajectory> {
        // Prioritized by cumulative reward
        let mut weighted: Vec<_> = self.buffer.iter()
            .map(|t| (t, t.cumulative_reward.max(0.01)))
            .collect();

        weighted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        weighted.into_iter().take(k).map(|(t, _)| t).collect()
    }

    pub fn len(&self) -> usize {
        self.buffer.len()
    }
}
```

---

### TASK-014: Implement LZ4 Persistence

| Field | Value |
|-------|-------|
| **Task ID** | TASK-014 |
| **Title** | Implement compressed Q-table persistence |
| **Dependencies** | TASK-008, TASK-012 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-104 (LZ4 compression, 4-32x reduction)

**Expected Output Files:**
```
wasm/crates/elex-memory/src/persistence.rs
```

**Success Criteria:**
```rust
#[test]
fn test_compression_ratio() {
    let qtable = generate_large_qtable();
    let compressed = compress_qtable(&qtable);
    let ratio = qtable.serialized_size() as f32 / compressed.len() as f32;
    assert!(ratio >= 4.0); // At least 4x compression
}
```

**Implementation:**
```rust
// persistence.rs
use lz4_flex::{compress_prepend_size, decompress_size_prepended};
use serde::{Serialize, Deserialize};

pub fn compress_qtable(qtable: &QTable) -> Result<Vec<u8>, ElexError> {
    let serialized = bincode::serialize(qtable)
        .map_err(|e| ElexError::MemoryError(e.to_string()))?;

    let compressed = compress_prepend_size(&serialized);
    Ok(compressed)
}

pub fn decompress_qtable(data: &[u8]) -> Result<QTable, ElexError> {
    let decompressed = decompress_size_prepended(data)
        .map_err(|e| ElexError::MemoryError(e.to_string()))?;

    let qtable: QTable = bincode::deserialize(&decompressed)
        .map_err(|e| ElexError::MemoryError(e.to_string()))?;

    Ok(qtable)
}

/// Storage interface for browser IndexedDB / Node.js filesystem
#[wasm_bindgen]
pub struct Storage {
    #[cfg(target_arch = "wasm32")]
    db: web_sys::IdbDatabase,
    #[cfg(not(target_arch = "wasm32"))]
    path: PathBuf,
}

impl Storage {
    pub async fn save_qtable(&self, agent_id: &str, qtable: &QTable) -> Result<(), ElexError> {
        let compressed = compress_qtable(qtable)?;
        self.write(format!("qtable_{}", agent_id), &compressed).await
    }

    pub async fn load_qtable(&self, agent_id: &str) -> Result<QTable, ElexError> {
        let data = self.read(format!("qtable_{}", agent_id)).await?;
        decompress_qtable(&data)
    }
}
```

---

### TASK-015: Implement LRU Cache

| Field | Value |
|-------|-------|
| **Task ID** | TASK-015 |
| **Title** | Implement LRU cache with 80% eviction |
| **Dependencies** | TASK-012 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Input Requirements:**
- ADR-104 (Hot storage, eviction policy)

**Expected Output Files:**
```
wasm/crates/elex-memory/src/lru.rs
```

**Success Criteria:**
```rust
#[test]
fn test_lru_eviction_at_80_percent() {
    let mut cache = LruCache::new(100);
    for i in 0..85 {
        cache.put(i, format!("value_{}", i));
    }
    // Should trigger eviction
    assert!(cache.len() <= 80);
}
```

**Implementation:**
```rust
// lru.rs
use std::collections::HashMap;

struct LruEntry<V> {
    value: V,
    prev: Option<u64>,
    next: Option<u64>,
}

pub struct LruCache<V> {
    capacity: usize,
    eviction_threshold: f32,
    entries: HashMap<u64, LruEntry<V>>,
    head: Option<u64>,
    tail: Option<u64>,
}

impl<V> LruCache<V> {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            eviction_threshold: 0.8,
            entries: HashMap::new(),
            head: None,
            tail: None,
        }
    }

    pub fn get(&mut self, key: u64) -> Option<&V> {
        if self.entries.contains_key(&key) {
            self.move_to_front(key);
            Some(&self.entries[&key].value)
        } else {
            None
        }
    }

    pub fn put(&mut self, key: u64, value: V) {
        // Check if eviction needed
        if self.entries.len() >= (self.capacity as f32 * self.eviction_threshold) as usize {
            self.evict_lru();
        }

        let entry = LruEntry {
            value,
            prev: None,
            next: self.head,
        };

        self.entries.insert(key, entry);
        self.move_to_front(key);
    }

    fn evict_lru(&mut self) {
        // Evict 20% of entries
        let to_evict = (self.capacity as f32 * 0.2) as usize;
        for _ in 0..to_evict {
            if let Some(tail_key) = self.tail {
                self.remove(tail_key);
            }
        }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    fn move_to_front(&mut self, key: u64) {
        // ... doubly-linked list manipulation
    }

    fn remove(&mut self, key: u64) -> Option<V> {
        // ... remove and fix links
        self.entries.remove(&key).map(|e| e.value)
    }
}
```

---

## Week 9-10: Security and Cryptography

### TASK-016: Implement Ed25519 Identity

| Field | Value |
|-------|-------|
| **Task ID** | TASK-016 |
| **Title** | Implement Ed25519 keypair generation |
| **Dependencies** | TASK-002 |
| **Agent Type** | coder, security-auditor |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-007 (Security architecture)

**Expected Output Files:**
```
wasm/crates/elex-crypto/src/lib.rs
wasm/crates/elex-crypto/src/identity.rs
wasm/crates/elex-crypto/src/tests.rs
```

**Success Criteria:**
```rust
#[test]
fn test_identity_generation() {
    let identity = AgentIdentity::generate();
    assert_eq!(identity.public_key.len(), 32);
    assert_eq!(identity.agent_id.len(), 32);
}
```

---

### TASK-017: Implement Message Signing

| Field | Value |
|-------|-------|
| **Task ID** | TASK-017 |
| **Title** | Implement Ed25519 message signing/verification |
| **Dependencies** | TASK-016 |
| **Agent Type** | coder, security-auditor |
| **Complexity** | M (Medium) |

**Expected Output Files:**
```
wasm/crates/elex-crypto/src/signing.rs
```

**Success Criteria:**
```rust
#[test]
fn test_sign_verify() {
    let identity = AgentIdentity::generate();
    let message = SignedMessage::new("hello", &identity);
    assert!(message.verify(&identity.public_key));
}
```

---

### TASK-018: Implement AES-256-GCM Encryption

| Field | Value |
|-------|-------|
| **Task ID** | TASK-018 |
| **Title** | Implement authenticated encryption |
| **Dependencies** | TASK-016 |
| **Agent Type** | coder, security-auditor |
| **Complexity** | M (Medium) |

**Expected Output Files:**
```
wasm/crates/elex-crypto/src/encryption.rs
```

**Success Criteria:**
```rust
#[test]
fn test_encrypt_decrypt() {
    let key = generate_session_key();
    let plaintext = b"sensitive RAN config";
    let ciphertext = encrypt_aes_gcm(plaintext, &key);
    let decrypted = decrypt_aes_gcm(&ciphertext, &key);
    assert_eq!(plaintext, decrypted.as_slice());
}
```

---

### TASK-019: Implement X25519 Key Exchange

| Field | Value |
|-------|-------|
| **Task ID** | TASK-019 |
| **Title** | Implement ECDH key exchange |
| **Dependencies** | TASK-016, TASK-018 |
| **Agent Type** | coder, security-auditor |
| **Complexity** | M (Medium) |

**Expected Output Files:**
```
wasm/crates/elex-crypto/src/keyexchange.rs
```

**Success Criteria:**
```rust
#[test]
fn test_ecdh_shared_secret() {
    let alice = X25519KeyPair::generate();
    let bob = X25519KeyPair::generate();

    let alice_shared = alice.derive_shared(&bob.public_key);
    let bob_shared = bob.derive_shared(&alice.public_key);

    assert_eq!(alice_shared, bob_shared);
}
```

---

### TASK-020: Implement Replay Protection

| Field | Value |
|-------|-------|
| **Task ID** | TASK-020 |
| **Title** | Implement timestamp/nonce replay protection |
| **Dependencies** | TASK-017 |
| **Agent Type** | coder, security-auditor |
| **Complexity** | S (Small) |

**Expected Output Files:**
```
wasm/crates/elex-crypto/src/replay.rs
```

**Success Criteria:**
```rust
#[test]
fn test_replay_detection() {
    let mut guard = ReplayGuard::new(Duration::from_secs(300));
    let msg = SignedMessage::new("test", &identity);

    assert!(guard.check(&msg)); // First time: OK
    assert!(!guard.check(&msg)); // Replay: BLOCKED
}
```

---

## Week 11-12: Coordination and Routing

### TASK-021: Implement Semantic Router

| Field | Value |
|-------|-------|
| **Task ID** | TASK-021 |
| **Title** | Implement HNSW-based query routing |
| **Dependencies** | TASK-012 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-005 (<1ms routing latency)

**Expected Output Files:**
```
wasm/crates/elex-routing/src/lib.rs
wasm/crates/elex-routing/src/router.rs
```

**Success Criteria:**
```rust
#[test]
fn test_routing_latency() {
    let router = SemanticRouter::new();
    router.register_agents(&all_593_agents);

    let start = now();
    let agents = router.route("Configure MIMO sleep", 5);
    let latency = now() - start;

    assert!(latency < Duration::from_millis(1));
    assert!(agents[0].feature_code.contains("MSM"));
}
```

---

### TASK-022: Implement Federated Q-Table Merge

| Field | Value |
|-------|-------|
| **Task ID** | TASK-022 |
| **Title** | Implement weighted federated averaging |
| **Dependencies** | TASK-008 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-006 (Federated merge algorithm)

**Expected Output Files:**
```
wasm/crates/elex-routing/src/federation.rs
```

**Success Criteria:**
```rust
#[test]
fn test_weighted_merge() {
    let local = QTable::with_entry(state, action, 0.5, 10); // 10 visits
    let peer = QTable::with_entry(state, action, 0.8, 20);  // 20 visits

    let merged = federated_merge(&local, &peer);
    let expected = (0.5 * 10.0 + 0.8 * 20.0) / 30.0; // ~0.7

    assert!((merged.get(state, action) - expected).abs() < 0.01);
}
```

---

### TASK-023: Implement Gossip Protocol

| Field | Value |
|-------|-------|
| **Task ID** | TASK-023 |
| **Title** | Implement gossip-based state sync |
| **Dependencies** | TASK-022 |
| **Agent Type** | coder |
| **Complexity** | L (Large) |

**Input Requirements:**
- ADR-002 (Gossip + CRDT for feature agents)

**Expected Output Files:**
```
wasm/crates/elex-routing/src/gossip.rs
```

**Success Criteria:**
```rust
#[test]
fn test_gossip_propagation() {
    let mut swarm = MockSwarm::new(10); // 10 agents
    swarm.agents[0].update_qtable(state, action, 0.9);

    // After 3 rounds, all should have the update
    for _ in 0..3 {
        swarm.gossip_round();
    }

    for agent in &swarm.agents {
        assert!(agent.qtable.get(state, action) > 0.5);
    }
}
```

---

### TASK-024: Implement Raft Consensus

| Field | Value |
|-------|-------|
| **Task ID** | TASK-024 |
| **Title** | Implement Raft for coordinator cluster |
| **Dependencies** | TASK-021 |
| **Agent Type** | coder, architect |
| **Complexity** | L (Large) |

**Input Requirements:**
- ADR-002 (Raft for coordinators)

**Expected Output Files:**
```
wasm/crates/elex-routing/src/raft.rs
wasm/crates/elex-routing/src/raft_log.rs
wasm/crates/elex-routing/src/raft_state.rs
```

**Success Criteria:**
```rust
#[test]
fn test_raft_leader_election() {
    let cluster = RaftCluster::new(3);
    cluster.start();

    // Wait for election
    std::thread::sleep(Duration::from_secs(2));

    let leaders: Vec<_> = cluster.nodes.iter()
        .filter(|n| n.is_leader())
        .collect();

    assert_eq!(leaders.len(), 1);
}
```

---

### TASK-025: Implement Query Router

| Field | Value |
|-------|-------|
| **Task ID** | TASK-025 |
| **Title** | Implement full query routing pipeline |
| **Dependencies** | TASK-021, TASK-024 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Expected Output Files:**
```
wasm/crates/elex-routing/src/query.rs
```

**Success Criteria:**
```rust
#[test]
fn test_full_query_pipeline() {
    let router = QueryRouter::new(swarm);
    let response = router.route_and_process(Query {
        content: "How to configure IFLB thresholds?",
        query_type: QueryType::Parameter,
    });

    assert!(response.confidence > 0.6);
    assert!(response.agent_id.feature_code().contains("IFLB"));
}
```

---

## Week 13-14: Integration and Safe Zones

### TASK-026: Implement Safe Zone Enforcer

| Field | Value |
|-------|-------|
| **Task ID** | TASK-026 |
| **Title** | Implement hardcoded parameter constraints |
| **Dependencies** | TASK-002, TASK-006 |
| **Agent Type** | coder, security-auditor |
| **Complexity** | M (Medium) |

**Input Requirements:**
- ADR-008 (Safe zone constraints)

**Expected Output Files:**
```
wasm/crates/elex-agent/src/safezone.rs
```

**Success Criteria:**
```rust
#[test]
fn test_safezone_enforcement() {
    let enforcer = SafeZoneEnforcer::load_constraints();

    // Within safe zone
    assert!(enforcer.validate("lbActivationThreshold", 70.0));

    // Outside safe zone
    assert!(!enforcer.validate("lbActivationThreshold", 95.0));
}
```

---

### TASK-027: Implement Blocking Conditions

| Field | Value |
|-------|-------|
| **Task ID** | TASK-027 |
| **Title** | Implement optimization pause triggers |
| **Dependencies** | TASK-026 |
| **Agent Type** | coder |
| **Complexity** | S (Small) |

**Expected Output Files:**
```
wasm/crates/elex-agent/src/blocking.rs
```

**Success Criteria:**
```rust
#[test]
fn test_blocking_conditions() {
    let mut blocker = BlockingConditions::new();

    blocker.report_event(Event::CriticalHwFailure);
    assert!(blocker.is_blocked());

    blocker.clear_event(Event::CriticalHwFailure);
    assert!(!blocker.is_blocked());
}
```

---

### TASK-028: Implement Rollback Mechanism

| Field | Value |
|-------|-------|
| **Task ID** | TASK-028 |
| **Title** | Implement parameter change rollback |
| **Dependencies** | TASK-026 |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Expected Output Files:**
```
wasm/crates/elex-agent/src/rollback.rs
```

**Success Criteria:**
```rust
#[test]
fn test_rollback() {
    let mut mgr = RollbackManager::new();

    mgr.save_checkpoint("param1", 50.0);
    mgr.apply_change("param1", 70.0);

    // KPI degraded
    mgr.rollback("param1");

    assert_eq!(mgr.current_value("param1"), 50.0);
}
```

---

### TASK-029 to TASK-040: Feature Agent Implementation

| Task Range | Title | Complexity |
|------------|-------|------------|
| TASK-029 | Implement FeatureAgent base struct | M |
| TASK-030 | Implement query handler | M |
| TASK-031 | Implement feedback recorder | S |
| TASK-032 | Implement peer consultation | M |
| TASK-033 | Implement memory storage | S |
| TASK-034 | Implement memory search | S |
| TASK-035 | Load 593 feature metadata | M |
| TASK-036 | Implement cmedit command generator | M |
| TASK-037 | Implement confidence calculator | S |
| TASK-038 | Implement action selector | S |
| TASK-039 | Implement state encoder | S |
| TASK-040 | Implement reward calculator | S |

---

### TASK-041 to TASK-046: Integration Tests

| Task | Title | Agent Type | Complexity |
|------|-------|------------|------------|
| TASK-041 | Integration test: Q-learning loop | tester | M |
| TASK-042 | Integration test: HNSW routing | tester | M |
| TASK-043 | Integration test: Federated sync | tester | L |
| TASK-044 | Integration test: Safe zone enforcement | tester, security-auditor | M |
| TASK-045 | Integration test: Rollback mechanism | tester | M |
| TASK-046 | Load test: 593 agents | tester | L |

---

### TASK-047 to TASK-050: Performance Benchmarks

| Task | Title | Success Criteria |
|------|-------|-----------------|
| TASK-047 | Benchmark SIMD operations | 3-5x speedup |
| TASK-048 | Benchmark HNSW search | <1ms P95 |
| TASK-049 | Benchmark Q-table update | <5ms P95 |
| TASK-050 | Benchmark full query cycle | <500ms P95 |

---

### TASK-051: WASM Binary Optimization

| Field | Value |
|-------|-------|
| **Task ID** | TASK-051 |
| **Title** | Optimize WASM binary size |
| **Dependencies** | All previous tasks |
| **Agent Type** | coder |
| **Complexity** | M (Medium) |

**Success Criteria:**
```bash
wasm-pack build --release
ls -la pkg/elex_agent_bg.wasm
# Size should be < 500KB after brotli compression
brotli pkg/elex_agent_bg.wasm
ls -la pkg/elex_agent_bg.wasm.br
```

---

### TASK-052: Final Integration

| Field | Value |
|-------|-------|
| **Task ID** | TASK-052 |
| **Title** | Final system integration and smoke test |
| **Dependencies** | All previous tasks |
| **Agent Type** | coder, tester, reviewer |
| **Complexity** | L (Large) |

**Success Criteria:**
```javascript
// Browser test
const swarm = await ElexSwarm.initialize({
    topology: 'hierarchical-mesh',
    maxAgents: 593,
});

const response = await swarm.query("Configure IFLB for load balancing");
assert(response.confidence > 0.8);
assert(response.cmeditCommands.length > 0);
assert(response.latencyMs < 500);
```

---

## Parallel Execution Map

```
         Week 1-2          Week 3-4          Week 5-6          Week 7-8
         --------          --------          --------          --------
Track A: TASK-001 ───────> TASK-008 ───────> TASK-009 ───────> TASK-022
         (Workspace)       (Q-Table)         (Encoding)        (Federation)
              │
              └──────────> TASK-004 ───────> TASK-005 ───────> TASK-006
                           (SIMD Cosine)     (SIMD Q-Batch)    (SIMD Validate)
              │
              └──────────> TASK-012 ───────> TASK-013 ───────> TASK-014
                           (HNSW)            (Trajectory)      (Persistence)

Track B: TASK-002 ───────> TASK-003 ───────────────────────────────────────>
         (Core Types)      (Logging)

Track C:                                      TASK-016 ───────> TASK-017 ──>
                                             (Ed25519)         (Signing)

         Week 9-10         Week 11-12        Week 13-14
         ---------         ----------        ----------
Track A: TASK-023 ───────> TASK-025 ───────> TASK-041-046
         (Gossip)          (Query Router)    (Integration Tests)

Track B: TASK-018 ───────> TASK-019 ───────> TASK-020
         (AES-GCM)         (X25519)          (Replay)

Track C: TASK-021 ───────> TASK-024 ───────> TASK-026-028
         (Semantic Router) (Raft)            (Safe Zones)

Track D: TASK-029-040 ────────────────────────────────────>
         (Feature Agent Implementation)

Track E:                                      TASK-047-052
                                             (Benchmarks & Final)
```

---

## Agent Assignment Summary

| Agent Type | Task Count | Primary Responsibilities |
|------------|------------|-------------------------|
| coder | 42 | Core implementation, SIMD, Q-learning, routing |
| tester | 8 | Integration tests, load tests, benchmarks |
| reviewer | 4 | Code review, architecture validation |
| security-auditor | 6 | Crypto implementation, safe zone enforcement |
| architect | 2 | Raft consensus, system integration |

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|------------|-------|
| SIMD browser support | Scalar fallbacks (TASK-007) | coder |
| HNSW memory pressure | LRU eviction (TASK-015) | coder |
| Crypto implementation bugs | Security audit tasks | security-auditor |
| Integration complexity | Incremental integration tests | tester |
| Performance regression | Continuous benchmarks | tester |

---

## Success Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| Query routing latency | <1ms P95 | TASK-048 |
| Full query cycle | <500ms P95 | TASK-050 |
| SIMD speedup | 3-5x | TASK-047 |
| WASM binary size | <500KB | TASK-051 |
| Q-learning convergence | <100 interactions | TASK-041 |
| Agent availability | >99.5% | TASK-046 |
| Safe zone coverage | 100% | TASK-044 |

---

## References

- ADR-005: HNSW Vector Indexing
- ADR-006: Q-Learning Engine
- ADR-007: Security Architecture
- ADR-008: Safe Zone Constraints
- ADR-104: RuVector Memory Integration
- ADR-105: WASM SIMD Acceleration
- ADR-107: Domain-Driven Design Structure
- Architecture: `/docs/architecture.md`
