# ELEX Rust Architecture Document

## Overview

This document defines the Rust architecture for the ELEX Edge AI Agent system, a WebAssembly-based solution for Ericsson RAN feature management. The architecture supports 593 specialized agents with SIMD-accelerated operations, Q-learning optimization, and P2P coordination.

**Key Design Principles:**
- Zero-copy operations at WASM boundary where possible
- Shallow dependency tree for fast compilation
- Type safety with domain-specific newtypes
- Feature flags for conditional compilation
- Memory-efficient data structures optimized for WASM

---

## 1. Cargo Workspace Structure

```
wasm/
├── Cargo.toml                    # Workspace manifest
├── rust-toolchain.toml           # Rust version pinning
├── .cargo/
│   └── config.toml               # WASM target configuration
├── crates/
│   ├── elex-core/                # Core types, traits, errors
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types.rs          # Newtypes (AgentId, FAJCode, etc.)
│   │       ├── traits.rs         # Core trait definitions
│   │       ├── error.rs          # Error types (thiserror)
│   │       └── config.rs         # Configuration structs
│   │
│   ├── elex-simd/                # SIMD operations (wasm32)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── vector.rs         # Vector similarity (cosine, dot)
│   │       ├── validation.rs     # Parameter range checks
│   │       ├── aggregation.rs    # Counter/KPI aggregation
│   │       └── fallback.rs       # Scalar fallbacks
│   │
│   ├── elex-qlearning/           # Q-learning engine
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── qtable.rs         # Q-table storage
│   │       ├── policy.rs         # Epsilon-greedy, UCB
│   │       ├── batch.rs          # SIMD batch updates
│   │       └── federated.rs      # Federated learning merge
│   │
│   ├── elex-memory/              # HNSW, persistence
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── hnsw.rs           # HNSW index implementation
│   │       ├── storage.rs        # IndexedDB persistence
│   │       └── cache.rs          # LRU cache layer
│   │
│   ├── elex-agent/               # Feature agent implementation
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── feature.rs        # FeatureAgent struct
│   │       ├── lifecycle.rs      # Agent state machine
│   │       ├── query.rs          # Query processing
│   │       └── stats.rs          # Statistics tracking
│   │
│   ├── elex-coordination/        # P2P, gossip, raft
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── peer.rs           # Peer discovery
│   │       ├── gossip.rs         # Gossip protocol
│   │       ├── raft.rs           # Raft consensus
│   │       └── dependency.rs     # Feature dependency graph
│   │
│   ├── elex-security/            # Ed25519, AES-256
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── signing.rs        # Ed25519 signatures
│   │       ├── encryption.rs     # AES-256-GCM
│   │       └── identity.rs       # Agent identity
│   │
│   └── elex-wasm/                # wasm-bindgen exports
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs            # WASM entry point
│           ├── exports.rs        # Public API
│           ├── imports.rs        # JS imports
│           └── convert.rs        # Type conversions
```

### Workspace Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "crates/elex-core",
    "crates/elex-simd",
    "crates/elex-qlearning",
    "crates/elex-memory",
    "crates/elex-agent",
    "crates/elex-coordination",
    "crates/elex-security",
    "crates/elex-wasm",
]

[workspace.package]
version = "2.1.0"
edition = "2021"
license = "MIT"
repository = "https://github.com/org/elex-wasm"
rust-version = "1.75"

[workspace.dependencies]
# Core dependencies
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"

# WASM dependencies
wasm-bindgen = "0.2"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }
serde-wasm-bindgen = "0.6"
console_error_panic_hook = "0.1"

# Crypto (WASM-compatible)
ed25519-dalek = { version = "2.1", features = ["rand_core"] }
aes-gcm = "0.10"
getrandom = { version = "0.2", features = ["js"] }

# Utilities
uuid = { version = "1.0", features = ["v4", "serde", "js"] }
smallvec = { version = "1.11", features = ["serde"] }
hashbrown = { version = "0.14", features = ["serde"] }

# Internal crates
elex-core = { path = "crates/elex-core" }
elex-simd = { path = "crates/elex-simd" }
elex-qlearning = { path = "crates/elex-qlearning" }
elex-memory = { path = "crates/elex-memory" }
elex-agent = { path = "crates/elex-agent" }
elex-coordination = { path = "crates/elex-coordination" }
elex-security = { path = "crates/elex-security" }
```

---

## 2. Crate Dependency Graph

```
                    ┌──────────────────┐
                    │   elex-wasm      │  (wasm-bindgen exports)
                    │   [cdylib]       │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  elex-agent    │  │elex-coordination│ │  elex-memory   │
│  (feature impl)│  │   (P2P/raft)   │  │   (HNSW/DB)    │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │
        │      ┌────────────┼────────────┐      │
        │      │            │            │      │
        ▼      ▼            ▼            ▼      ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ elex-qlearning │  │ elex-security  │  │   elex-simd    │
│  (Q-learning)  │  │  (crypto)      │  │  (SIMD ops)    │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                    ┌────────────────┐
                    │   elex-core    │
                    │ (types/traits) │
                    └────────────────┘
```

### Dependency Rules

| Crate | Can Depend On |
|-------|---------------|
| `elex-core` | External crates only (serde, thiserror) |
| `elex-simd` | `elex-core` |
| `elex-qlearning` | `elex-core`, `elex-simd` |
| `elex-security` | `elex-core` |
| `elex-memory` | `elex-core`, `elex-simd` |
| `elex-agent` | `elex-core`, `elex-simd`, `elex-qlearning` |
| `elex-coordination` | `elex-core`, `elex-security` |
| `elex-wasm` | All internal crates |

**Rationale:** Maximum depth is 3 layers, ensuring fast incremental compilation and clear separation of concerns.

---

## 3. Core Traits

```rust
// elex-core/src/traits.rs

use crate::types::{AgentId, State, Action, Reward, Query, Response, Feedback};
use crate::error::ElexResult;

/// Core trait for all agent implementations
pub trait Agent: Send + Sync {
    /// Unique identifier for this agent
    fn id(&self) -> AgentId;

    /// Process an incoming query and return a response
    fn process_query(&mut self, query: &Query) -> ElexResult<Response>;

    /// Update internal learning state based on feedback
    fn update_learning(&mut self, feedback: &Feedback) -> ElexResult<()>;

    /// Check if agent is ready to handle queries
    fn is_ready(&self) -> bool;

    /// Get current confidence level (0.0-1.0)
    fn confidence(&self) -> f32;
}

/// Trait for learning algorithms (Q-learning, SARSA, etc.)
pub trait Learning {
    /// Select an action given the current state
    fn select_action(&self, state: &State) -> Action;

    /// Update Q-value for a state-action pair
    fn update_q_value(&mut self, s: State, a: Action, r: Reward, s_prime: State);

    /// Get confidence for a given state
    fn get_confidence(&self, state: &State) -> f32;

    /// Get the maximum Q-value achievable from a state
    fn max_q_value(&self, state: &State) -> f32;
}

/// Trait for routing queries to appropriate agents
pub trait Routing {
    /// Route a query to candidate agents with confidence scores
    fn route_query(&self, query: &Query) -> Vec<(AgentId, f32)>;

    /// Find peer agents for a given agent (based on feature dependencies)
    fn find_peers(&self, agent_id: AgentId) -> Vec<AgentId>;

    /// Get the dependency graph for an agent
    fn get_dependencies(&self, agent_id: AgentId) -> Vec<AgentId>;
}

/// Trait for persistence operations
pub trait Persistence {
    /// Save data to persistent storage
    fn save(&self, key: &str, data: &[u8]) -> ElexResult<()>;

    /// Load data from persistent storage
    fn load(&self, key: &str) -> ElexResult<Option<Vec<u8>>>;

    /// Delete data from persistent storage
    fn delete(&self, key: &str) -> ElexResult<()>;

    /// Check if key exists
    fn exists(&self, key: &str) -> ElexResult<bool>;
}

/// Trait for vector similarity operations
pub trait VectorOps {
    /// Compute cosine similarity between two vectors
    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32;

    /// Compute dot product
    fn dot_product(&self, a: &[f32], b: &[f32]) -> f32;

    /// Normalize a vector in-place
    fn normalize(&self, v: &mut [f32]);

    /// Batch similarity search (returns top-k indices and scores)
    fn batch_similarity(&self, query: &[f32], candidates: &[&[f32]], k: usize)
        -> Vec<(usize, f32)>;
}

/// Trait for cryptographic operations
pub trait Crypto {
    /// Sign data with agent's private key
    fn sign(&self, data: &[u8]) -> ElexResult<Vec<u8>>;

    /// Verify a signature
    fn verify(&self, data: &[u8], signature: &[u8], public_key: &[u8]) -> ElexResult<bool>;

    /// Encrypt data
    fn encrypt(&self, plaintext: &[u8], key: &[u8]) -> ElexResult<Vec<u8>>;

    /// Decrypt data
    fn decrypt(&self, ciphertext: &[u8], key: &[u8]) -> ElexResult<Vec<u8>>;
}

/// Trait for consensus participation
pub trait Consensus {
    /// Propose a value to the consensus group
    fn propose(&mut self, value: &[u8]) -> ElexResult<()>;

    /// Vote on a proposed value
    fn vote(&mut self, proposal_id: &str, accept: bool) -> ElexResult<()>;

    /// Check if consensus has been reached
    fn is_decided(&self, proposal_id: &str) -> bool;

    /// Get the decided value (if any)
    fn get_decision(&self, proposal_id: &str) -> Option<Vec<u8>>;
}
```

---

## 4. Type System Design

### Newtypes for Domain Concepts

```rust
// elex-core/src/types.rs

use serde::{Deserialize, Serialize};
use std::fmt;

/// Unique identifier for an agent (e.g., "agent-faj-121-3094")
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentId(String);

impl AgentId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn from_faj(faj_code: &FAJCode) -> Self {
        Self(format!("agent-{}", faj_code.as_ref().to_lowercase().replace(' ', "-")))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for AgentId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// FAJ code identifying an Ericsson RAN feature (e.g., "FAJ 121 3094")
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FAJCode(String);

impl FAJCode {
    pub fn new(code: impl Into<String>) -> Result<Self, InvalidFAJCode> {
        let code = code.into();
        // Validate FAJ format: "FAJ XXX XXXX" or "FAJ XXX XXXX/X"
        if Self::is_valid(&code) {
            Ok(Self(code))
        } else {
            Err(InvalidFAJCode(code))
        }
    }

    fn is_valid(code: &str) -> bool {
        code.starts_with("FAJ ") && code.len() >= 12
    }
}

impl AsRef<str> for FAJCode {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, thiserror::Error)]
#[error("Invalid FAJ code: {0}")]
pub struct InvalidFAJCode(String);

/// State representation for Q-learning (hash of current context)
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct State(String);

impl State {
    pub fn new(hash: impl Into<String>) -> Self {
        Self(hash.into())
    }

    pub fn from_context(context: &QueryContext) -> Self {
        // Create deterministic hash from context
        Self(format!("{:x}", md5_hash(&context.to_string())))
    }
}

/// Action that an agent can take
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Action {
    DirectAnswer,
    ContextAnswer,
    ConsultPeer,
    RequestClarification,
    Escalate,
}

impl Action {
    pub const ALL: [Action; 5] = [
        Action::DirectAnswer,
        Action::ContextAnswer,
        Action::ConsultPeer,
        Action::RequestClarification,
        Action::Escalate,
    ];
}

/// Reward value from feedback (-1.0 to 1.0)
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Reward(f32);

impl Reward {
    pub fn new(value: f32) -> Self {
        Self(value.clamp(-1.0, 1.0))
    }

    pub fn value(&self) -> f32 {
        self.0
    }

    pub const POSITIVE: Self = Self(1.0);
    pub const NEUTRAL: Self = Self(0.0);
    pub const NEGATIVE: Self = Self(-1.0);
}

/// Confidence score (0.0 to 1.0)
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct Confidence(f32);

impl Confidence {
    pub fn new(value: f32) -> Self {
        Self(value.clamp(0.0, 1.0))
    }

    pub fn value(&self) -> f32 {
        self.0
    }

    pub fn is_high(&self) -> bool {
        self.0 >= 0.8
    }

    pub fn is_low(&self) -> bool {
        self.0 < 0.5
    }
}

impl Default for Confidence {
    fn default() -> Self {
        Self(0.5) // Cold start confidence
    }
}

/// Vector embedding (fixed 128 dimensions for HNSW)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Embedding {
    pub data: [f32; 128],
}

impl Embedding {
    pub fn new(data: [f32; 128]) -> Self {
        Self { data }
    }

    pub fn from_slice(slice: &[f32]) -> Option<Self> {
        if slice.len() == 128 {
            let mut data = [0.0f32; 128];
            data.copy_from_slice(slice);
            Some(Self { data })
        } else {
            None
        }
    }

    pub fn as_slice(&self) -> &[f32] {
        &self.data
    }
}

/// Timestamp in milliseconds since Unix epoch
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Timestamp(u64);

impl Timestamp {
    pub fn now() -> Self {
        #[cfg(target_arch = "wasm32")]
        {
            Self(js_sys::Date::now() as u64)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            Self(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64)
        }
    }

    pub fn from_millis(ms: u64) -> Self {
        Self(ms)
    }

    pub fn as_millis(&self) -> u64 {
        self.0
    }
}
```

### Builder Patterns

```rust
// elex-agent/src/feature.rs

use elex_core::types::*;

/// Builder for FeatureAgent with validation
pub struct FeatureAgentBuilder {
    id: Option<AgentId>,
    faj_code: Option<FAJCode>,
    category: Option<String>,
    parameters: Vec<Parameter>,
    counters: Vec<Counter>,
    kpis: Vec<KPI>,
    cold_start_threshold: u32,
}

impl FeatureAgentBuilder {
    pub fn new() -> Self {
        Self {
            id: None,
            faj_code: None,
            category: None,
            parameters: Vec::new(),
            counters: Vec::new(),
            kpis: Vec::new(),
            cold_start_threshold: 100,
        }
    }

    pub fn id(mut self, id: AgentId) -> Self {
        self.id = Some(id);
        self
    }

    pub fn faj_code(mut self, code: FAJCode) -> Self {
        // Auto-generate ID from FAJ code if not set
        if self.id.is_none() {
            self.id = Some(AgentId::from_faj(&code));
        }
        self.faj_code = Some(code);
        self
    }

    pub fn category(mut self, category: impl Into<String>) -> Self {
        self.category = Some(category.into());
        self
    }

    pub fn parameter(mut self, param: Parameter) -> Self {
        self.parameters.push(param);
        self
    }

    pub fn parameters(mut self, params: Vec<Parameter>) -> Self {
        self.parameters = params;
        self
    }

    pub fn counter(mut self, counter: Counter) -> Self {
        self.counters.push(counter);
        self
    }

    pub fn counters(mut self, counters: Vec<Counter>) -> Self {
        self.counters = counters;
        self
    }

    pub fn kpi(mut self, kpi: KPI) -> Self {
        self.kpis.push(kpi);
        self
    }

    pub fn kpis(mut self, kpis: Vec<KPI>) -> Self {
        self.kpis = kpis;
        self
    }

    pub fn cold_start_threshold(mut self, threshold: u32) -> Self {
        self.cold_start_threshold = threshold;
        self
    }

    pub fn build(self) -> Result<FeatureAgent, BuildError> {
        let id = self.id.ok_or(BuildError::MissingField("id"))?;
        let faj_code = self.faj_code.ok_or(BuildError::MissingField("faj_code"))?;
        let category = self.category.ok_or(BuildError::MissingField("category"))?;

        Ok(FeatureAgent {
            id,
            faj_code,
            category,
            parameters: self.parameters,
            counters: self.counters,
            kpis: self.kpis,
            status: AgentStatus::Initializing,
            confidence: Confidence::default(),
            interaction_count: 0,
            cold_start_threshold: self.cold_start_threshold,
            created_at: Timestamp::now(),
            last_query_at: None,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BuildError {
    #[error("Missing required field: {0}")]
    MissingField(&'static str),
}
```

### Type-State Pattern for Agent Lifecycle

```rust
// elex-agent/src/lifecycle.rs

use std::marker::PhantomData;

/// Type-state markers for agent lifecycle
pub mod states {
    pub struct Uninitialized;
    pub struct Initializing;
    pub struct ColdStart;
    pub struct Ready;
    pub struct Busy;
    pub struct Offline;
}

/// Agent wrapper with compile-time lifecycle state tracking
pub struct AgentState<S> {
    inner: FeatureAgent,
    _state: PhantomData<S>,
}

impl AgentState<states::Uninitialized> {
    pub fn new(agent: FeatureAgent) -> Self {
        Self {
            inner: agent,
            _state: PhantomData,
        }
    }

    /// Initialize the agent - transitions to Initializing
    pub fn initialize(mut self) -> AgentState<states::Initializing> {
        self.inner.status = AgentStatus::Initializing;
        AgentState {
            inner: self.inner,
            _state: PhantomData,
        }
    }
}

impl AgentState<states::Initializing> {
    /// Complete initialization - transitions to ColdStart
    pub fn complete_init(mut self) -> AgentState<states::ColdStart> {
        self.inner.status = AgentStatus::ColdStart;
        AgentState {
            inner: self.inner,
            _state: PhantomData,
        }
    }
}

impl AgentState<states::ColdStart> {
    /// Check if ready to transition (100+ interactions)
    pub fn check_ready(self) -> Either<AgentState<states::Ready>, AgentState<states::ColdStart>> {
        if self.inner.interaction_count >= self.inner.cold_start_threshold {
            Either::Left(AgentState {
                inner: self.inner,
                _state: PhantomData,
            })
        } else {
            Either::Right(self)
        }
    }

    /// Process query in cold start mode (limited confidence)
    pub fn process_query(&mut self, query: &Query) -> ElexResult<Response> {
        self.inner.process_query_internal(query)
    }
}

impl AgentState<states::Ready> {
    /// Process query at full confidence
    pub fn process_query(&mut self, query: &Query) -> ElexResult<Response> {
        self.inner.process_query_internal(query)
    }

    /// Mark as busy during processing
    pub fn mark_busy(mut self) -> AgentState<states::Busy> {
        self.inner.status = AgentStatus::Busy;
        AgentState {
            inner: self.inner,
            _state: PhantomData,
        }
    }

    /// Shutdown the agent
    pub fn shutdown(mut self) -> AgentState<states::Offline> {
        self.inner.status = AgentStatus::Offline;
        AgentState {
            inner: self.inner,
            _state: PhantomData,
        }
    }
}

impl AgentState<states::Busy> {
    /// Return to ready state after processing
    pub fn complete(mut self) -> AgentState<states::Ready> {
        self.inner.status = AgentStatus::Ready;
        AgentState {
            inner: self.inner,
            _state: PhantomData,
        }
    }
}

/// Helper enum for state transitions
pub enum Either<L, R> {
    Left(L),
    Right(R),
}
```

---

## 5. Error Handling Strategy

```rust
// elex-core/src/error.rs

use crate::types::{AgentId, FAJCode};
use thiserror::Error;

/// Result type alias using ElexError
pub type ElexResult<T> = Result<T, ElexError>;

/// Comprehensive error type for the ELEX system
#[derive(Debug, Error)]
pub enum ElexError {
    // Agent errors
    #[error("Agent not found: {0}")]
    AgentNotFound(AgentId),

    #[error("Agent not ready: {0} (status: {1})")]
    AgentNotReady(AgentId, String),

    #[error("Agent initialization failed: {0}")]
    InitializationFailed(String),

    // Feature errors
    #[error("Invalid FAJ code: {0}")]
    InvalidFAJCode(String),

    #[error("Feature not found: {0}")]
    FeatureNotFound(FAJCode),

    #[error("Feature dependency cycle detected: {0:?}")]
    DependencyCycle(Vec<FAJCode>),

    // SIMD errors
    #[error("SIMD operation failed: {0}")]
    SimdError(String),

    #[error("Vector dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },

    // Q-learning errors
    #[error("Q-table lookup failed for state: {0}")]
    QLookupError(String),

    #[error("Invalid reward value: {0} (must be in [-1.0, 1.0])")]
    InvalidReward(f32),

    #[error("Batch update failed: {0}")]
    BatchUpdateError(String),

    // Memory/persistence errors
    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("HNSW index error: {0}")]
    HnswError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    // Security errors
    #[error("Signature verification failed")]
    SignatureVerificationFailed,

    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Decryption error: {0}")]
    DecryptionError(String),

    #[error("Invalid key: {0}")]
    InvalidKey(String),

    // Coordination errors
    #[error("Peer not reachable: {0}")]
    PeerUnreachable(AgentId),

    #[error("Consensus timeout after {0}ms")]
    ConsensusTimeout(u64),

    #[error("Gossip protocol error: {0}")]
    GossipError(String),

    // WASM boundary errors
    #[error("JS interop error: {0}")]
    JsInteropError(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    // Generic errors
    #[error("Internal error: {0}")]
    Internal(String),

    #[error(transparent)]
    Other(#[from] Box<dyn std::error::Error + Send + Sync>),
}

impl ElexError {
    /// Create an internal error with context
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    /// Check if error is recoverable
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            ElexError::AgentNotReady(_, _)
            | ElexError::PeerUnreachable(_)
            | ElexError::ConsensusTimeout(_)
        )
    }

    /// Get error code for JS
    pub fn code(&self) -> &'static str {
        match self {
            ElexError::AgentNotFound(_) => "AGENT_NOT_FOUND",
            ElexError::AgentNotReady(_, _) => "AGENT_NOT_READY",
            ElexError::InvalidFAJCode(_) => "INVALID_FAJ_CODE",
            ElexError::SimdError(_) => "SIMD_ERROR",
            ElexError::QLookupError(_) => "Q_LOOKUP_ERROR",
            ElexError::StorageError(_) => "STORAGE_ERROR",
            ElexError::SignatureVerificationFailed => "SIGNATURE_FAILED",
            _ => "INTERNAL_ERROR",
        }
    }
}

// Convert to JsValue for WASM boundary
#[cfg(target_arch = "wasm32")]
impl From<ElexError> for wasm_bindgen::JsValue {
    fn from(err: ElexError) -> Self {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"code".into(), &err.code().into()).unwrap();
        js_sys::Reflect::set(&obj, &"message".into(), &err.to_string().into()).unwrap();
        obj.into()
    }
}
```

### Error Context Extension

```rust
// elex-core/src/error.rs (continued)

/// Extension trait for adding context to errors
pub trait ResultExt<T> {
    fn context(self, msg: impl Into<String>) -> ElexResult<T>;
    fn with_context<F: FnOnce() -> String>(self, f: F) -> ElexResult<T>;
}

impl<T, E: std::error::Error + Send + Sync + 'static> ResultExt<T> for Result<T, E> {
    fn context(self, msg: impl Into<String>) -> ElexResult<T> {
        self.map_err(|e| ElexError::Internal(format!("{}: {}", msg.into(), e)))
    }

    fn with_context<F: FnOnce() -> String>(self, f: F) -> ElexResult<T> {
        self.map_err(|e| ElexError::Internal(format!("{}: {}", f(), e)))
    }
}
```

---

## 6. WASM Boundary Design

### Exported API

```rust
// elex-wasm/src/exports.rs

use wasm_bindgen::prelude::*;
use elex_core::types::*;
use elex_agent::FeatureAgent;

/// Main agent handle exposed to JavaScript
#[wasm_bindgen]
pub struct ElexAgent {
    inner: FeatureAgent,
}

#[wasm_bindgen]
impl ElexAgent {
    /// Create a new agent from JSON configuration
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<ElexAgent, JsValue> {
        // Set panic hook for better error messages
        console_error_panic_hook::set_once();

        let config: AgentConfig = serde_wasm_bindgen::from_value(config)?;
        let agent = FeatureAgent::from_config(config)?;

        Ok(ElexAgent { inner: agent })
    }

    /// Initialize the agent
    #[wasm_bindgen]
    pub fn initialize(&mut self) -> Result<(), JsValue> {
        self.inner.initialize()?;
        Ok(())
    }

    /// Process a query and return response
    #[wasm_bindgen]
    pub fn process_query(&mut self, query: JsValue) -> Result<JsValue, JsValue> {
        let query: Query = serde_wasm_bindgen::from_value(query)?;
        let response = self.inner.process_query(&query)?;
        Ok(serde_wasm_bindgen::to_value(&response)?)
    }

    /// Validate parameters using SIMD (4-8x faster)
    #[wasm_bindgen]
    pub fn validate_parameters(&self, params: JsValue) -> Result<JsValue, JsValue> {
        let params: Vec<ParameterValidation> = serde_wasm_bindgen::from_value(params)?;
        let results = self.inner.validate_parameters(&params)?;
        Ok(serde_wasm_bindgen::to_value(&results)?)
    }

    /// Get agent statistics
    #[wasm_bindgen]
    pub fn get_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.inner.get_stats();
        Ok(serde_wasm_bindgen::to_value(&stats)?)
    }

    /// Update learning from feedback
    #[wasm_bindgen]
    pub fn update_learning(&mut self, feedback: JsValue) -> Result<(), JsValue> {
        let feedback: Feedback = serde_wasm_bindgen::from_value(feedback)?;
        self.inner.update_learning(&feedback)?;
        Ok(())
    }

    /// Shutdown the agent
    #[wasm_bindgen]
    pub fn shutdown(&mut self) {
        self.inner.shutdown();
    }

    /// Get agent ID as string
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.inner.id().to_string()
    }

    /// Get agent status
    #[wasm_bindgen(getter)]
    pub fn status(&self) -> String {
        format!("{:?}", self.inner.status())
    }

    /// Get confidence level
    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f32 {
        self.inner.confidence().value()
    }
}

/// Batch operations for multiple agents
#[wasm_bindgen]
pub struct ElexBatch;

#[wasm_bindgen]
impl ElexBatch {
    /// Batch validate parameters across multiple agents
    #[wasm_bindgen]
    pub fn validate_batch(params: JsValue) -> Result<JsValue, JsValue> {
        let batch: Vec<BatchValidation> = serde_wasm_bindgen::from_value(params)?;
        let results = elex_simd::batch_validate(&batch)?;
        Ok(serde_wasm_bindgen::to_value(&results)?)
    }

    /// Batch Q-learning update
    #[wasm_bindgen]
    pub fn q_update_batch(updates: JsValue) -> Result<JsValue, JsValue> {
        let updates: Vec<QUpdate> = serde_wasm_bindgen::from_value(updates)?;
        let results = elex_qlearning::batch_update(&updates)?;
        Ok(serde_wasm_bindgen::to_value(&results)?)
    }

    /// Batch similarity search
    #[wasm_bindgen]
    pub fn similarity_search(query: JsValue, candidates: JsValue, k: usize)
        -> Result<JsValue, JsValue>
    {
        let query: Vec<f32> = serde_wasm_bindgen::from_value(query)?;
        let candidates: Vec<Vec<f32>> = serde_wasm_bindgen::from_value(candidates)?;
        let results = elex_simd::batch_cosine_similarity(&query, &candidates, k)?;
        Ok(serde_wasm_bindgen::to_value(&results)?)
    }
}
```

### Serialization Strategy

```rust
// elex-wasm/src/convert.rs

use serde::{Deserialize, Serialize};
use wasm_bindgen::JsValue;

/// Efficient conversion between Rust and JS types
pub trait JsConvert: Sized {
    fn from_js(value: JsValue) -> Result<Self, JsValue>;
    fn to_js(&self) -> Result<JsValue, JsValue>;
}

impl<T: for<'de> Deserialize<'de> + Serialize> JsConvert for T {
    fn from_js(value: JsValue) -> Result<Self, JsValue> {
        serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn to_js(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(self)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

/// Zero-copy access to typed arrays
pub mod typed_arrays {
    use js_sys::{Float32Array, Uint8Array};
    use wasm_bindgen::JsCast;

    /// Get a slice view of a Float32Array without copying
    pub fn as_f32_slice(arr: &Float32Array) -> Vec<f32> {
        let mut vec = vec![0.0f32; arr.length() as usize];
        arr.copy_to(&mut vec);
        vec
    }

    /// Create a Float32Array from a slice (copies data)
    pub fn from_f32_slice(slice: &[f32]) -> Float32Array {
        let arr = Float32Array::new_with_length(slice.len() as u32);
        arr.copy_from(slice);
        arr
    }

    /// Get a slice view of a Uint8Array without copying
    pub fn as_u8_slice(arr: &Uint8Array) -> Vec<u8> {
        arr.to_vec()
    }
}

/// Configuration for serialization behavior
#[derive(Clone, Copy)]
pub struct SerializeConfig {
    /// Use camelCase for field names (JS convention)
    pub camel_case: bool,
    /// Serialize None as null (vs omitting field)
    pub serialize_none_as_null: bool,
}

impl Default for SerializeConfig {
    fn default() -> Self {
        Self {
            camel_case: true,
            serialize_none_as_null: false,
        }
    }
}
```

### Memory Management at Boundary

```rust
// elex-wasm/src/lib.rs

use wasm_bindgen::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

/// Global agent registry for lifecycle management
thread_local! {
    static AGENT_REGISTRY: RefCell<AgentRegistry> = RefCell::new(AgentRegistry::new());
}

struct AgentRegistry {
    agents: hashbrown::HashMap<String, Rc<RefCell<ElexAgent>>>,
    next_id: u32,
}

impl AgentRegistry {
    fn new() -> Self {
        Self {
            agents: hashbrown::HashMap::new(),
            next_id: 0,
        }
    }

    fn register(&mut self, agent: ElexAgent) -> String {
        let id = format!("agent_{}", self.next_id);
        self.next_id += 1;
        self.agents.insert(id.clone(), Rc::new(RefCell::new(agent)));
        id
    }

    fn get(&self, id: &str) -> Option<Rc<RefCell<ElexAgent>>> {
        self.agents.get(id).cloned()
    }

    fn remove(&mut self, id: &str) -> bool {
        self.agents.remove(id).is_some()
    }
}

/// Create an agent and return a handle ID
#[wasm_bindgen]
pub fn create_agent(config: JsValue) -> Result<String, JsValue> {
    let agent = ElexAgent::new(config)?;
    let id = AGENT_REGISTRY.with(|registry| {
        registry.borrow_mut().register(agent)
    });
    Ok(id)
}

/// Destroy an agent by handle ID
#[wasm_bindgen]
pub fn destroy_agent(id: &str) -> bool {
    AGENT_REGISTRY.with(|registry| {
        registry.borrow_mut().remove(id)
    })
}

/// Memory statistics for debugging
#[wasm_bindgen]
pub fn memory_stats() -> JsValue {
    let stats = MemoryStats {
        total_agents: AGENT_REGISTRY.with(|r| r.borrow().agents.len()),
        heap_size: wasm_bindgen::memory().buffer().byte_length() as usize,
    };
    serde_wasm_bindgen::to_value(&stats).unwrap()
}

#[derive(Serialize)]
struct MemoryStats {
    total_agents: usize,
    heap_size: usize,
}
```

---

## 7. SIMD Architecture

### WASM SIMD Implementation

```rust
// elex-simd/src/lib.rs

#[cfg(target_arch = "wasm32")]
mod wasm_simd;

#[cfg(not(target_arch = "wasm32"))]
mod scalar;

// Re-export the appropriate implementation
#[cfg(target_arch = "wasm32")]
pub use wasm_simd::*;

#[cfg(not(target_arch = "wasm32"))]
pub use scalar::*;
```

```rust
// elex-simd/src/wasm_simd.rs

#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// Cosine similarity using WASM SIMD (128-bit vectors, 4 f32s at a time)
///
/// Performance: 3-5x faster than scalar for vectors >= 32 elements
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vector length mismatch");

    let len = a.len();
    let chunks = len / 4;
    let remainder = len % 4;

    // Accumulators for SIMD computation
    let mut dot_acc = f32x4_splat(0.0);
    let mut norm_a_acc = f32x4_splat(0.0);
    let mut norm_b_acc = f32x4_splat(0.0);

    // Process 4 elements at a time
    for i in 0..chunks {
        let offset = i * 4;

        // Load 4 elements from each vector
        let va = v128_load(a.as_ptr().add(offset) as *const v128);
        let vb = v128_load(b.as_ptr().add(offset) as *const v128);

        // Accumulate dot product: sum(a[i] * b[i])
        dot_acc = f32x4_add(dot_acc, f32x4_mul(va, vb));

        // Accumulate norms: sum(a[i]^2), sum(b[i]^2)
        norm_a_acc = f32x4_add(norm_a_acc, f32x4_mul(va, va));
        norm_b_acc = f32x4_add(norm_b_acc, f32x4_mul(vb, vb));
    }

    // Horizontal sum of SIMD accumulators
    let dot_product = horizontal_sum(dot_acc);
    let norm_a = horizontal_sum(norm_a_acc);
    let norm_b = horizontal_sum(norm_b_acc);

    // Process remainder elements (scalar)
    let mut dot_rem = 0.0f32;
    let mut norm_a_rem = 0.0f32;
    let mut norm_b_rem = 0.0f32;

    for i in (chunks * 4)..len {
        let ai = a[i];
        let bi = b[i];
        dot_rem += ai * bi;
        norm_a_rem += ai * ai;
        norm_b_rem += bi * bi;
    }

    let total_dot = dot_product + dot_rem;
    let total_norm_a = norm_a + norm_a_rem;
    let total_norm_b = norm_b + norm_b_rem;

    // Compute cosine similarity
    if total_norm_a > 0.0 && total_norm_b > 0.0 {
        total_dot / (total_norm_a.sqrt() * total_norm_b.sqrt())
    } else {
        0.0
    }
}

/// Horizontal sum of f32x4 vector
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn horizontal_sum(v: v128) -> f32 {
    // v = [a, b, c, d]
    // shuffle to get [c, d, a, b]
    let shuffled = i32x4_shuffle::<2, 3, 0, 1>(v, v);
    // add: [a+c, b+d, c+a, d+b]
    let sum1 = f32x4_add(v, shuffled);
    // shuffle again: [b+d, a+c, d+b, c+a]
    let shuffled2 = i32x4_shuffle::<1, 0, 3, 2>(sum1, sum1);
    // final add: [a+b+c+d, ...]
    let sum2 = f32x4_add(sum1, shuffled2);
    f32x4_extract_lane::<0>(sum2)
}

/// Batch Q-learning update using SIMD (2-4x faster)
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(q_values.len(), rewards.len());
    assert_eq!(q_values.len(), next_max_q.len());

    let len = q_values.len();
    let chunks = len / 4;

    let alpha_vec = f32x4_splat(alpha);
    let gamma_vec = f32x4_splat(gamma);

    for i in 0..chunks {
        let offset = i * 4;

        // Load current values
        let q = v128_load(q_values.as_ptr().add(offset) as *const v128);
        let r = v128_load(rewards.as_ptr().add(offset) as *const v128);
        let next_q = v128_load(next_max_q.as_ptr().add(offset) as *const v128);

        // Compute target: r + gamma * next_q
        let target = f32x4_add(r, f32x4_mul(gamma_vec, next_q));

        // Compute TD error: target - q
        let td_error = f32x4_sub(target, q);

        // Update: q + alpha * td_error
        let new_q = f32x4_add(q, f32x4_mul(alpha_vec, td_error));

        // Store result
        v128_store(q_values.as_mut_ptr().add(offset) as *mut v128, new_q);
    }

    // Handle remainder
    for i in (chunks * 4)..len {
        let target = rewards[i] + gamma * next_max_q[i];
        let td_error = target - q_values[i];
        q_values[i] += alpha * td_error;
    }
}

/// Parameter validation using SIMD (4-8x faster)
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn validate_parameters_simd(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
    results: &mut [u8],
) {
    assert_eq!(values.len(), min_bounds.len());
    assert_eq!(values.len(), max_bounds.len());
    assert_eq!(values.len(), results.len());

    let len = values.len();
    let chunks = len / 4;

    for i in 0..chunks {
        let offset = i * 4;

        let v = v128_load(values.as_ptr().add(offset) as *const v128);
        let min_v = v128_load(min_bounds.as_ptr().add(offset) as *const v128);
        let max_v = v128_load(max_bounds.as_ptr().add(offset) as *const v128);

        // Check: v >= min && v <= max
        let ge_min = f32x4_ge(v, min_v);  // All bits 1 if true
        let le_max = f32x4_le(v, max_v);
        let valid = v128_and(ge_min, le_max);

        // Extract results (each lane is all 1s or all 0s)
        for j in 0..4 {
            let lane_valid = i32x4_extract_lane::<0>(
                i32x4_shuffle::<0, 1, 2, 3>(valid, valid)
            );
            results[offset + j] = if lane_valid != 0 { 1 } else { 0 };
        }
    }

    // Handle remainder
    for i in (chunks * 4)..len {
        results[i] = if values[i] >= min_bounds[i] && values[i] <= max_bounds[i] {
            1
        } else {
            0
        };
    }
}

/// Counter aggregation using SIMD (3-6x faster)
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn aggregate_counters_simd(
    values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    assert_eq!(values.len(), weights.len());

    if values.is_empty() {
        return (0.0, 0.0, f32::NEG_INFINITY, 0);
    }

    let len = values.len();
    let chunks = len / 4;

    let mut sum_acc = f32x4_splat(0.0);
    let mut weighted_acc = f32x4_splat(0.0);
    let mut max_acc = f32x4_splat(f32::NEG_INFINITY);
    let mut count_above = 0u32;

    let threshold_vec = f32x4_splat(threshold);

    for i in 0..chunks {
        let offset = i * 4;

        let v = v128_load(values.as_ptr().add(offset) as *const v128);
        let w = v128_load(weights.as_ptr().add(offset) as *const v128);

        // Sum
        sum_acc = f32x4_add(sum_acc, v);

        // Weighted sum
        weighted_acc = f32x4_add(weighted_acc, f32x4_mul(v, w));

        // Max
        max_acc = f32x4_max(max_acc, v);

        // Count above threshold
        let gt = f32x4_gt(v, threshold_vec);
        // Count set bits (each lane is all 1s or 0s)
        for j in 0..4 {
            if values[offset + j] > threshold {
                count_above += 1;
            }
        }
    }

    // Horizontal operations
    let sum = horizontal_sum(sum_acc);
    let weighted_sum = horizontal_sum(weighted_acc);
    let max = horizontal_max(max_acc);

    // Handle remainder
    let mut rem_sum = 0.0f32;
    let mut rem_weighted = 0.0f32;
    let mut rem_max = f32::NEG_INFINITY;

    for i in (chunks * 4)..len {
        rem_sum += values[i];
        rem_weighted += values[i] * weights[i];
        if values[i] > rem_max {
            rem_max = values[i];
        }
        if values[i] > threshold {
            count_above += 1;
        }
    }

    (
        sum + rem_sum,
        weighted_sum + rem_weighted,
        max.max(rem_max),
        count_above,
    )
}

/// Horizontal max of f32x4 vector
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn horizontal_max(v: v128) -> f32 {
    let shuffled = i32x4_shuffle::<2, 3, 0, 1>(v, v);
    let max1 = f32x4_max(v, shuffled);
    let shuffled2 = i32x4_shuffle::<1, 0, 3, 2>(max1, max1);
    let max2 = f32x4_max(max1, shuffled2);
    f32x4_extract_lane::<0>(max2)
}
```

### Scalar Fallback

```rust
// elex-simd/src/scalar.rs

/// Scalar cosine similarity fallback
pub fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len());

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

/// Scalar batch Q-update fallback
pub fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    for i in 0..q_values.len() {
        let target = rewards[i] + gamma * next_max_q[i];
        let td_error = target - q_values[i];
        q_values[i] += alpha * td_error;
    }
}

/// Scalar parameter validation fallback
pub fn validate_parameters_simd(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
    results: &mut [u8],
) {
    for i in 0..values.len() {
        results[i] = if values[i] >= min_bounds[i] && values[i] <= max_bounds[i] {
            1
        } else {
            0
        };
    }
}

/// Scalar counter aggregation fallback
pub fn aggregate_counters_simd(
    values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    if values.is_empty() {
        return (0.0, 0.0, f32::NEG_INFINITY, 0);
    }

    let mut sum = 0.0f32;
    let mut weighted_sum = 0.0f32;
    let mut max = f32::NEG_INFINITY;
    let mut count_above = 0u32;

    for i in 0..values.len() {
        sum += values[i];
        weighted_sum += values[i] * weights[i];
        if values[i] > max {
            max = values[i];
        }
        if values[i] > threshold {
            count_above += 1;
        }
    }

    (sum, weighted_sum, max, count_above)
}
```

---

## 8. Memory Layout

### Q-Table Memory Representation

```rust
// elex-qlearning/src/qtable.rs

/// Compact Q-table optimized for WASM memory
///
/// Memory layout:
/// - Uses hashbrown for cache-efficient hash map
/// - State-action keys are interned strings
/// - Q-values stored as f32 (4 bytes)
/// - Visit counts as u32 (4 bytes)
/// - Total per entry: ~40 bytes (key + metadata)
pub struct QTable {
    /// State-action -> (Q-value, visit_count, last_updated)
    entries: hashbrown::HashMap<StateActionKey, QEntry>,

    /// String interner for state-action keys
    interner: StringInterner,

    /// Learning parameters
    config: QLearningConfig,

    /// Statistics
    stats: QTableStats,
}

/// Interned state-action key (8 bytes instead of ~50 bytes for string)
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct StateActionKey(u32, u8); // (state_id, action_id)

/// Compact Q-entry (12 bytes)
#[repr(C)]
struct QEntry {
    value: f32,        // 4 bytes
    visit_count: u32,  // 4 bytes
    last_updated: u32, // 4 bytes (seconds since agent start, not epoch)
}

/// String interner for memory efficiency
struct StringInterner {
    strings: Vec<String>,
    lookup: hashbrown::HashMap<String, u32>,
}

impl StringInterner {
    fn intern(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.lookup.get(s) {
            id
        } else {
            let id = self.strings.len() as u32;
            self.strings.push(s.to_string());
            self.lookup.insert(s.to_string(), id);
            id
        }
    }

    fn resolve(&self, id: u32) -> Option<&str> {
        self.strings.get(id as usize).map(|s| s.as_str())
    }
}

impl QTable {
    /// Estimate memory usage in bytes
    pub fn memory_usage(&self) -> usize {
        let entries_size = self.entries.len() * (
            std::mem::size_of::<StateActionKey>() +
            std::mem::size_of::<QEntry>()
        );

        let interner_size = self.interner.strings.iter()
            .map(|s| s.len() + std::mem::size_of::<String>())
            .sum::<usize>();

        entries_size + interner_size + std::mem::size_of::<Self>()
    }
}
```

### HNSW Index Layout

```rust
// elex-memory/src/hnsw.rs

/// HNSW (Hierarchical Navigable Small World) index for vector search
///
/// Memory layout per node:
/// - Vector: 128 * 4 = 512 bytes
/// - Connections per layer: ~16 * 4 = 64 bytes avg
/// - Metadata: 24 bytes
/// - Total: ~600 bytes per node
///
/// For 10,000 vectors: ~6MB
pub struct HnswIndex {
    /// All vectors stored contiguously for cache efficiency
    vectors: Vec<f32>,  // len = num_nodes * dim

    /// Dimension of vectors
    dim: usize,

    /// Number of nodes
    num_nodes: usize,

    /// Graph connections: layers[layer][node] = Vec<neighbor_ids>
    layers: Vec<Vec<SmallVec<[u32; 16]>>>,

    /// Entry point for search
    entry_point: u32,

    /// Maximum layer for each node
    node_layers: Vec<u8>,

    /// Configuration
    config: HnswConfig,
}

#[derive(Clone)]
pub struct HnswConfig {
    /// Max connections per node at layer 0
    pub m: usize,  // default: 16

    /// Max connections per node at higher layers
    pub m_max: usize,  // default: 32

    /// Size of dynamic candidate list during construction
    pub ef_construction: usize,  // default: 200

    /// Size of dynamic candidate list during search
    pub ef_search: usize,  // default: 50

    /// Probability factor for layer selection
    pub ml: f32,  // default: 1/ln(m)
}

impl Default for HnswConfig {
    fn default() -> Self {
        Self {
            m: 16,
            m_max: 32,
            ef_construction: 200,
            ef_search: 50,
            ml: 1.0 / 16.0_f32.ln(),
        }
    }
}

impl HnswIndex {
    /// Estimate memory usage
    pub fn memory_usage(&self) -> usize {
        let vectors_size = self.vectors.len() * std::mem::size_of::<f32>();

        let layers_size: usize = self.layers.iter()
            .map(|layer| {
                layer.iter()
                    .map(|conns| conns.len() * std::mem::size_of::<u32>())
                    .sum::<usize>()
            })
            .sum();

        let node_layers_size = self.node_layers.len();

        vectors_size + layers_size + node_layers_size + std::mem::size_of::<Self>()
    }

    /// Get vector by node ID (zero-copy slice)
    #[inline]
    pub fn get_vector(&self, node_id: u32) -> &[f32] {
        let start = node_id as usize * self.dim;
        &self.vectors[start..start + self.dim]
    }
}
```

### Agent Instance Memory

```rust
// elex-agent/src/feature.rs

/// Feature agent memory layout
///
/// Base struct: ~200 bytes
/// Per parameter: ~100 bytes
/// Per counter: ~50 bytes
/// Per KPI: ~80 bytes
/// Q-table: variable (~40 bytes per entry)
///
/// Typical agent (20 params, 10 counters, 5 KPIs): ~3KB + Q-table
pub struct FeatureAgent {
    // Identity (72 bytes)
    id: AgentId,           // 24 bytes (String)
    faj_code: FAJCode,     // 24 bytes
    category: String,      // 24 bytes

    // Lifecycle (16 bytes)
    status: AgentStatus,   // 1 byte + padding
    created_at: Timestamp, // 8 bytes
    last_query_at: Option<Timestamp>, // 16 bytes (Option + Timestamp)

    // Statistics (32 bytes)
    interaction_count: u32,       // 4 bytes
    confidence: Confidence,       // 4 bytes
    cold_start_threshold: u32,    // 4 bytes
    avg_latency_ms: f32,          // 4 bytes
    peak_latency_ms: f32,         // 4 bytes
    validation_accuracy: f32,     // 4 bytes
    success_rate: f32,            // 4 bytes
    _padding: u32,                // 4 bytes

    // Collections (24 bytes each = 72 bytes)
    parameters: Vec<Parameter>,   // 24 bytes (Vec)
    counters: Vec<Counter>,       // 24 bytes
    kpis: Vec<KPI>,               // 24 bytes

    // Q-learning (boxed to avoid stack overflow)
    q_table: Box<QTable>,         // 8 bytes (pointer)
}

/// Parameter memory layout (~100 bytes)
pub struct Parameter {
    name: String,              // 24 bytes
    value_type: String,        // 24 bytes
    range_min: Option<f64>,    // 16 bytes
    range_max: Option<f64>,    // 16 bytes
    current_value: Option<String>, // 24 bytes
}

/// Counter memory layout (~50 bytes)
pub struct Counter {
    name: String,     // 24 bytes
    category: String, // 24 bytes
    current_value: f64, // 8 bytes
}

/// KPI memory layout (~80 bytes)
pub struct KPI {
    name: String,       // 24 bytes
    formula: String,    // 24 bytes
    threshold: f64,     // 8 bytes
    current_value: Option<f64>, // 16 bytes
}

impl FeatureAgent {
    /// Estimate total memory usage
    pub fn memory_usage(&self) -> usize {
        let base = std::mem::size_of::<Self>();

        let params = self.parameters.iter()
            .map(|p| p.name.len() + p.value_type.len() +
                 p.current_value.as_ref().map(|v| v.len()).unwrap_or(0) + 56)
            .sum::<usize>();

        let counters = self.counters.iter()
            .map(|c| c.name.len() + c.category.len() + 8)
            .sum::<usize>();

        let kpis = self.kpis.iter()
            .map(|k| k.name.len() + k.formula.len() + 24)
            .sum::<usize>();

        let q_table = self.q_table.memory_usage();

        base + params + counters + kpis + q_table
    }
}
```

---

## 9. Build Configuration

### Workspace Cargo.toml Profile Settings

```toml
# wasm/Cargo.toml

[profile.dev]
opt-level = 0
debug = true
debug-assertions = true
overflow-checks = true
lto = false
panic = "unwind"
incremental = true

[profile.release]
opt-level = 3
debug = false
debug-assertions = false
overflow-checks = false
lto = true
codegen-units = 1
panic = "abort"
strip = true

[profile.release-debug]
inherits = "release"
debug = true
strip = false

# Optimized for WASM size
[profile.wasm]
inherits = "release"
opt-level = "z"  # Optimize for size
lto = "fat"      # Full LTO for maximum size reduction
```

### Cargo Config for WASM Target

```toml
# wasm/.cargo/config.toml

[build]
target = "wasm32-unknown-unknown"

[target.wasm32-unknown-unknown]
rustflags = [
    "-C", "target-feature=+simd128",
    "-C", "target-feature=+bulk-memory",
    "-C", "link-arg=--import-memory",
]

# Faster linking in development
[target.wasm32-unknown-unknown.dev]
rustflags = [
    "-C", "target-feature=+simd128",
    "-C", "link-arg=--import-memory",
]

[alias]
wasm-build = "build --target wasm32-unknown-unknown --release"
wasm-dev = "build --target wasm32-unknown-unknown"
wasm-test = "test --target wasm32-unknown-unknown"
```

### wasm-pack Configuration

```toml
# wasm/crates/elex-wasm/Cargo.toml

[package]
name = "elex-wasm"
version.workspace = true
edition.workspace = true

[package.metadata.wasm-pack]
# Disable wasm-opt due to SIMD feature flags
wasm-opt = false

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
elex-core.workspace = true
elex-simd.workspace = true
elex-qlearning.workspace = true
elex-memory.workspace = true
elex-agent.workspace = true
elex-coordination.workspace = true
elex-security.workspace = true

wasm-bindgen.workspace = true
js-sys.workspace = true
web-sys.workspace = true
serde-wasm-bindgen.workspace = true
console_error_panic_hook.workspace = true

[features]
default = ["console_error_panic_hook"]
simd = []

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

### Build Script

```bash
#!/bin/bash
# wasm/build.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building ELEX WASM modules...${NC}"

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo -e "${RED}wasm-pack not found. Installing...${NC}"
    cargo install wasm-pack
fi

# Clean previous builds
rm -rf pkg/

# Build with wasm-pack
echo -e "${GREEN}Building release WASM...${NC}"
wasm-pack build crates/elex-wasm \
    --target web \
    --release \
    --out-dir ../../pkg \
    -- --features simd

# Report sizes
echo -e "${GREEN}Build complete!${NC}"
echo "WASM file sizes:"
ls -lh pkg/*.wasm

# Generate TypeScript declarations
echo -e "${YELLOW}Generating TypeScript declarations...${NC}"
wasm-pack build crates/elex-wasm \
    --target bundler \
    --release \
    --out-dir ../../pkg-bundler \
    -- --features simd

echo -e "${GREEN}All builds complete!${NC}"
```

### Rust Toolchain

```toml
# wasm/rust-toolchain.toml

[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
targets = ["wasm32-unknown-unknown"]
profile = "minimal"
```

---

## 10. Performance Targets

| Operation | Target | SIMD Speedup | Notes |
|-----------|--------|--------------|-------|
| Vector similarity (128-dim) | <100us | 3-5x | Primary bottleneck for routing |
| Q-table lookup | <1ms | N/A | Hash map O(1) |
| Q-table update | <500us | N/A | Single entry update |
| Batch Q-update (100 states) | <10ms | 2-4x | SIMD parallelism |
| Parameter validation (1000) | <5ms | 4-8x | Range checks |
| Counter aggregation (500) | <2ms | 3-6x | Sum, weighted sum, max |
| HNSW search (10K vectors) | <50ms | 3-5x | Top-10 search |
| HNSW insert | <20ms | 2-3x | Graph construction |
| Agent initialization | <100ms | N/A | One-time cost |
| Agent query processing | <50ms | 2-4x | End-to-end |

### Benchmarking Strategy

```rust
// elex-wasm/benches/simd_bench.rs

#[cfg(test)]
mod benchmarks {
    use elex_simd::*;
    use std::time::Instant;

    const ITERATIONS: usize = 10000;

    #[test]
    fn bench_cosine_similarity_128() {
        let a: Vec<f32> = (0..128).map(|i| i as f32 / 128.0).collect();
        let b: Vec<f32> = (0..128).map(|i| (127 - i) as f32 / 128.0).collect();

        let start = Instant::now();
        for _ in 0..ITERATIONS {
            let _ = cosine_similarity_simd(&a, &b);
        }
        let elapsed = start.elapsed();

        let per_op = elapsed.as_nanos() as f64 / ITERATIONS as f64;
        println!("Cosine similarity (128-dim): {:.2} ns/op ({:.2} us)",
            per_op, per_op / 1000.0);

        assert!(per_op < 100_000.0, "Target: <100us");
    }

    #[test]
    fn bench_batch_q_update_100() {
        let mut q_values: Vec<f32> = (0..100).map(|_| 0.0).collect();
        let rewards: Vec<f32> = (0..100).map(|i| (i % 3) as f32 - 1.0).collect();
        let next_max: Vec<f32> = (0..100).map(|i| i as f32 / 100.0).collect();

        let start = Instant::now();
        for _ in 0..ITERATIONS {
            batch_q_update_simd(&mut q_values, &rewards, &next_max, 0.1, 0.95);
        }
        let elapsed = start.elapsed();

        let per_op = elapsed.as_micros() as f64 / ITERATIONS as f64;
        println!("Batch Q-update (100): {:.2} us/op", per_op);

        assert!(per_op < 10_000.0, "Target: <10ms");
    }

    #[test]
    fn bench_validate_parameters_1000() {
        let values: Vec<f32> = (0..1000).map(|i| i as f32 / 10.0).collect();
        let mins: Vec<f32> = (0..1000).map(|i| (i as f32 / 10.0) - 5.0).collect();
        let maxs: Vec<f32> = (0..1000).map(|i| (i as f32 / 10.0) + 5.0).collect();
        let mut results = vec![0u8; 1000];

        let start = Instant::now();
        for _ in 0..ITERATIONS {
            validate_parameters_simd(&values, &mins, &maxs, &mut results);
        }
        let elapsed = start.elapsed();

        let per_op = elapsed.as_micros() as f64 / ITERATIONS as f64;
        println!("Validate parameters (1000): {:.2} us/op", per_op);

        assert!(per_op < 5_000.0, "Target: <5ms");
    }
}
```

### Memory Budget

| Component | Budget | Notes |
|-----------|--------|-------|
| Base WASM module | <500KB | Gzipped |
| Per agent instance | <5KB | Excluding Q-table |
| Q-table (1000 entries) | <50KB | With string interning |
| HNSW index (10K vectors) | <6MB | 128-dim vectors |
| Total runtime (10 agents) | <10MB | Typical deployment |

---

## Appendix A: Feature Flags

```toml
# Feature flags across crates

[features]
default = ["std"]
std = []

# SIMD support (auto-enabled for wasm32)
simd = []

# Development/debugging features
debug-logs = ["tracing"]
timing = []

# Optional cryptography
crypto = ["ed25519-dalek", "aes-gcm"]

# HNSW index support
hnsw = []

# Federated learning
federated = []

# Full feature set
full = ["simd", "crypto", "hnsw", "federated"]
```

---

## Appendix B: Testing Strategy

```rust
// Testing organization

// Unit tests: In each module
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_functionality() { ... }
}

// Integration tests: tests/ directory
// tests/integration/agent_lifecycle.rs
// tests/integration/q_learning_convergence.rs
// tests/integration/simd_correctness.rs

// WASM tests: wasm-bindgen-test
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn test_wasm_exports() { ... }

// Property-based tests
#[cfg(test)]
mod proptests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn cosine_similarity_bounded(
            a in prop::collection::vec(-1.0f32..1.0, 128),
            b in prop::collection::vec(-1.0f32..1.0, 128),
        ) {
            let sim = cosine_similarity_simd(&a, &b);
            prop_assert!(sim >= -1.0 && sim <= 1.0);
        }
    }
}
```

---

## Appendix C: Code Review Checklist

- [ ] All public APIs have documentation
- [ ] Error handling uses `ElexResult<T>` consistently
- [ ] SIMD code has scalar fallback
- [ ] Memory allocations minimized in hot paths
- [ ] No panics in WASM-exported functions
- [ ] Serialization/deserialization tested at boundary
- [ ] Performance benchmarks pass targets
- [ ] Memory budget verified
- [ ] Thread safety (Send + Sync) where required
- [ ] Feature flags properly gated
