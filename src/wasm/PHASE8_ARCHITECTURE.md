# Phase 8 WASM SDK Architecture

## Executive Summary

Phase 8 implements the complete WASM-based SIMD-accelerated RAN optimization SDK for the ELEX Edge AI Agent Swarm. This architecture provides the foundation for deploying 593 specialized Ericsson RAN feature agents as WebAssembly modules with 3-8x performance improvements through SIMD acceleration.

**Key Deliverables:**
- Complete wasm-bindgen exports for JavaScript/TypeScript interop
- SIMD-accelerated vector operations (HNSW indexing, similarity search)
- Q-learning engine with persistent state and federated learning
- Agent registry and routing system with 593 feature agents
- Memory pool management with 500MB budget enforcement

**Performance Targets:**
- Vector similarity (128-dim): <100us (3-5x speedup)
- Q-table batch updates (100 states): <10ms (2-4x speedup)
- Parameter validation (1000 params): <5ms (4-8x speedup)
- Counter aggregation (500 counters): <2ms (3-6x speedup)
- Agent instantiation: <200ms
- Query processing: <50ms end-to-end

---

## 1. System Architecture Overview

### 1.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        JavaScript/TypeScript Layer                           │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ Agent Factory  │  │ Agent Runtime    │  │ Memory Manager          │    │
│  │ (Lazy Loading) │  │ (Query Processing)│  │ (LRU, 500MB Budget)     │    │
│  └────────┬───────┘  └────────┬─────────┘  └──────────┬───────────────┘    │
└───────────┼──────────────────┼─────────────────────────┼─────────────────────┘
            │                  │                         │
            │ wasm-bindgen     │                         │
            │ boundary         │                         │
┌───────────┼──────────────────┼─────────────────────────┼─────────────────────┐
│           │     WASM SDK Layer (Rust)                     │                    │
│  ┌────────▼──────────┐  ┌───────▼────────┐  ┌───────────▼──────────────┐   │
│  │ Agent Registry    │  │ SIMD Engine    │  │ Q-Learning Engine        │   │
│  │ (593 Agents)      │  │ (4 Categories) │  │ (Epsilon-Greedy)         │   │
│  └────────┬──────────┘  └───────┬────────┘  └───────────┬──────────────┘   │
│           │                     │                         │                   │
│  ┌────────▼─────────────────────▼─────────────────────────▼──────────────┐  │
│  │                   Core Agent Module                                     │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │ Feature     │ │ Query       │ │ Validation  │ │ Monitoring       │  │  │
│  │  │ Agent       │ │ Processing  │ │ Engine      │ │ (KPIs, Counters) │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│           │                     │                         │                   │
│  ┌────────▼──────────┐  ┌───────▼────────┐  ┌───────────▼──────────────┐   │
│  │ Memory Pool       │  │ HNSW Index     │  │ Crypto Module            │   │
│  │ (Pre-allocated)   │  │ (Vector Search)│  │ (Ed25519, AES-256)       │   │
│  └───────────────────┘  └────────────────┘  └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                         │
            │ WebAssembly Linear Memory (4GB max, 500MB budget)            │
            └─────────────────────┴─────────────────────────────────────────┘
```

### 1.2 Module Structure

```
src/wasm/agent/
├── Cargo.toml                          # Workspace configuration
├── build.sh                            # Build script with SIMD flags
├── rust-toolchain.toml                 # Rust version pinning
├── .cargo/config.toml                  # WASM target configuration
├── src/
│   ├── lib.rs                          # Public wasm-bindgen API (main entry)
│   ├── exports.rs                      # Exported WASM functions
│   ├── imports.rs                      # JS imports (console, Date, etc.)
│   ├── convert.rs                      # Type conversions (Rust ↔ JS)
│   ├── memory.rs                       # Memory management & pools
│   ├── registry.rs                     # Agent registry & routing
│   ├── feature_agent.rs                # Core agent data structures
│   ├── query.rs                        # Query processing logic
│   ├── validation.rs                   # Parameter validation engine
│   ├── monitoring.rs                   # KPI/counter monitoring
│   ├── q_learning/
│   │   ├── mod.rs                      # Q-learning module
│   │   ├── qtable.rs                   # Q-table storage
│   │   ├── policy.rs                   # Action selection policies
│   │   ├── batch.rs                    # SIMD batch operations
│   │   └── federated.rs                # Federated learning
│   ├── simd/
│   │   ├── mod.rs                      # SIMD module
│   │   ├── vector.rs                   # Vector similarity search
│   │   ├── validation.rs               # Parameter range checks
│   │   ├── aggregation.rs              # Counter/KPI aggregation
│   │   └── fallback.rs                 # Scalar fallbacks
│   ├── memory/
│   │   ├── mod.rs                      # Memory module
│   │   ├── hnsw.rs                     # HNSW index implementation
│   │   ├── pool.rs                     # Memory pool manager
│   │   └── persistence.rs              # IndexedDB persistence
│   ├── crypto/
│   │   ├── mod.rs                      # Crypto module
│   │   ├── signing.rs                  # Ed25519 signatures
│   │   ├── encryption.rs               # AES-256-GCM
│   │   └── identity.rs                 # Agent identity
│   └── utils/
│       ├── mod.rs                      # Utilities
│       ├── timestamp.rs                # Timestamp helpers
│       └── error.rs                    # Error types
└── tests/
    ├── simd_bench.rs                   # SIMD benchmarks
    ├── q_learning_test.rs              # Q-learning tests
    └── integration_test.rs             # Integration tests
```

---

## 2. WASM-Bindgen Exports

### 2.1 Core Agent API

```rust
// src/exports.rs

use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use crate::{
    feature_agent::{FeatureAgent, AgentConfig, AgentStats},
    query::{Query, QueryResponse},
    validation::{ValidationResult, ValidationParams},
    monitoring::KPIData,
    q_learning::QTableData,
};

/// Main agent handle exposed to JavaScript
#[wasm_bindgen]
pub struct EdgeAgent {
    inner: FeatureAgent,
}

#[wasm_bindgen]
impl EdgeAgent {
    // ========================================================================
    // Lifecycle Management
    // ========================================================================

    /// Create a new agent with configuration
    ///
    /// # JavaScript Example
    /// ```javascript
    /// const agent = new EdgeAgent({
    ///   id: "agent-faj-121-3094",
    ///   fajCode: "FAJ 121 3094",
    ///   category: "Energy Saving",
    ///   parameters: [...],
    ///   counters: [...],
    ///   kpis: [...]
    /// });
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<EdgeAgent, JsValue> {
        console_error_panic_hook::set_once();

        let cfg: AgentConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?;

        let agent = FeatureAgent::new(cfg)
            .map_err(|e| JsValue::from_str(&format!("Failed to create agent: {}", e)))?;

        Ok(EdgeAgent { inner: agent })
    }

    /// Initialize the agent (transition from Initializing → ColdStart)
    #[wasm_bindgen(js_name = initialize)]
    pub fn initialize(&mut self) -> Result<String, JsValue> {
        self.inner.initialize()
            .map(|_| format!("Agent {} initialized", self.inner.id()))
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Shutdown the agent (transition → Offline)
    #[wasm_bindgen(js_name = shutdown)]
    pub fn shutdown(&mut self) {
        self.inner.shutdown();
    }

    /// Check if agent is ready to handle queries
    #[wasm_bindgen(getter, js_name = isReady)]
    pub fn is_ready(&self) -> bool {
        self.inner.is_ready()
    }

    /// Get agent status as string
    #[wasm_bindgen(getter, js_name = status)]
    pub fn status(&self) -> String {
        format!("{:?}", self.inner.status())
    }

    // ========================================================================
    // Query Processing
    // ========================================================================

    /// Process a query and return response
    ///
    /// # JavaScript Example
    /// ```javascript
    /// const response = await agent.processQuery({
    ///   queryId: "query-123",
    ///   content: "How to optimize MIMO Sleep Mode?",
    ///   state: "active",
    ///   availableActions: ["DirectAnswer", "ContextAnswer"]
    /// });
    /// ```
    #[wasm_bindgen(js_name = processQuery)]
    pub fn process_query(&mut self, query: JsValue) -> Result<JsValue, JsValue> {
        let q: Query = serde_wasm_bindgen::from_value(query)
            .map_err(|e| JsValue::from_str(&format!("Invalid query: {}", e)))?;

        let response = self.inner.process_query(q)
            .map_err(|e| JsValue::from_str(&format!("Query failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&response)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Process query asynchronously (yields to event loop)
    #[wasm_bindgen(js_name = processQueryAsync)]
    pub async fn process_query_async(&mut self, query: JsValue) -> Result<JsValue, JsValue> {
        let q: Query = serde_wasm_bindgen::from_value(query)
            .map_err(|e| JsValue::from_str(&format!("Invalid query: {}", e)))?;

        let response = self.inner.process_query_async(q).await
            .map_err(|e| JsValue::from_str(&format!("Async query failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&response)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    // ========================================================================
    // Validation (SIMD-Accelerated)
    // ========================================================================

    /// Validate parameters using SIMD (4-8x faster)
    ///
    /// # JavaScript Example
    /// ```javascript
    /// const results = await agent.validateParameters([
    ///   { name: "mimoMode", value: 4, min: 1, max: 8 },
    ///   { name: "threshold", value: 75, min: 0, max: 100 }
    /// ]);
    /// // Returns: [{ parameter: "mimoMode", valid: true, value: 4 }, ...]
    /// ```
    #[wasm_bindgen(js_name = validateParameters)]
    pub fn validate_parameters(&self, params: JsValue) -> Result<JsValue, JsValue> {
        let validation_params: ValidationParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

        let results = self.inner.validate_parameters_simd(validation_params)
            .map_err(|e| JsValue::from_str(&format!("Validation failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Batch validate for multiple agents (SIMD-accelerated)
    #[wasm_bindgen(js_name = validateBatch)]
    pub fn validate_batch(&self, batch: JsValue) -> Result<JsValue, JsValue> {
        let batch_params: Vec<ValidationParams> = serde_wasm_bindgen::from_value(batch)
            .map_err(|e| JsValue::from_str(&format!("Invalid batch: {}", e)))?;

        let results = self.inner.validate_batch_simd(batch_params)
            .map_err(|e| JsValue::from_str(&format!("Batch validation failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    // ========================================================================
    // Monitoring (SIMD-Accelerated)
    // ========================================================================

    /// Monitor KPIs using SIMD aggregation (3-6x faster)
    ///
    /// # JavaScript Example
    /// ```javascript
    /// const kpiData = await agent.monitorKPIs();
    /// // Returns: { totalEvents: 1234, weightedScore: 45.6, peakValue: 100, alerts: 2 }
    /// ```
    #[wasm_bindgen(js_name = monitorKPIs)]
    pub fn monitor_kpis(&self) -> Result<JsValue, JsValue> {
        let data = self.inner.monitor_kpis_simd()
            .map_err(|e| JsValue::from_str(&format!("KPI monitoring failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&data)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Get detailed KPI data
    #[wasm_bindgen(js_name = getKPIData)]
    pub fn get_kpi_data(&self) -> Result<JsValue, JsValue> {
        let data = self.inner.get_kpi_data()
            .map_err(|e| JsValue::from_str(&format!("Failed to get KPI data: {}", e)))?;

        serde_wasm_bindgen::to_value(&data)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    // ========================================================================
    // Q-Learning
    // ========================================================================

    /// Update Q-learning with feedback
    ///
    /// # JavaScript Example
    /// ```javascript
    /// agent.updateLearning({
    ///   reward: 0.8,
    ///   state: "active",
    ///   action: "DirectAnswer"
    /// });
    /// ```
    #[wasm_bindgen(js_name = updateLearning)]
    pub fn update_learning(&mut self, feedback: JsValue) -> Result<(), JsValue> {
        let fb = serde_wasm_bindgen::from_value(feedback)
            .map_err(|e| JsValue::from_str(&format!("Invalid feedback: {}", e)))?;

        self.inner.update_learning(fb)
            .map_err(|e| JsValue::from_str(&format!("Learning update failed: {}", e)))
    }

    /// Export Q-table as bytes (for persistence/federated learning)
    #[wasm_bindgen(js_name = exportQTable)]
    pub fn export_q_table(&self) -> Vec<u8> {
        self.inner.export_q_table()
    }

    /// Import Q-table from bytes
    #[wasm_bindgen(js_name = importQTable)]
    pub fn import_q_table(&mut self, data: &[u8]) -> Result<(), JsValue> {
        self.inner.import_q_table(data)
            .map_err(|e| JsValue::from_str(&format!("Failed to import Q-table: {}", e)))
    }

    /// Get Q-table statistics
    #[wasm_bindgen(js_name = getQTableStats)]
    pub fn get_q_table_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.inner.get_q_table_stats()
            .map_err(|e| JsValue::from_str(&format!("Failed to get Q-table stats: {}", e)))?;

        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    // ========================================================================
    // Statistics & Debugging
    // ========================================================================

    /// Get comprehensive agent statistics
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.inner.get_stats();
        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Get agent ID
    #[wasm_bindgen(getter, js_name = id)]
    pub fn id(&self) -> String {
        self.inner.id().to_string()
    }

    /// Get agent FAJ code
    #[wasm_bindgen(getter, js_name = fajCode)]
    pub fn faj_code(&self) -> String {
        self.inner.faj_code().to_string()
    }

    /// Get confidence level (0.0-1.0)
    #[wasm_bindgen(getter, js_name = confidence)]
    pub fn confidence(&self) -> f32 {
        self.inner.confidence()
    }

    /// Get interaction count
    #[wasm_bindgen(getter, js_name = interactionCount)]
    pub fn interaction_count(&self) -> u32 {
        self.inner.interaction_count()
    }

    /// Estimate memory usage in bytes
    #[wasm_bindgen(js_name = estimateMemory)]
    pub fn estimate_memory(&self) -> u32 {
        self.inner.estimate_memory_bytes()
    }
}

// ========================================================================
// Batch Operations (Static Methods)
// ========================================================================

#[wasm_bindgen]
pub struct EdgeBatch;

#[wasm_bindgen]
impl EdgeBatch {
    /// Batch similarity search using SIMD (3-5x faster)
    ///
    /// # JavaScript Example
    /// ```javascript
    /// const results = EdgeBatch.similaritySearch(
    ///   queryVector,           // Float32Array(128)
    ///   candidateVectors,      // Array of Float32Array
    ///   10                     // top-k
    /// );
    /// // Returns: [{ index: 5, score: 0.95 }, ...]
    /// ```
    #[wasm_bindgen(js_name = similaritySearch)]
    pub fn similarity_search(
        query: JsValue,
        candidates: JsValue,
        k: usize
    ) -> Result<JsValue, JsValue> {
        let query_vec: Vec<f32> = serde_wasm_bindgen::from_value(query)
            .map_err(|e| JsValue::from_str(&format!("Invalid query: {}", e)))?;
        let candidates_vec: Vec<Vec<f32>> = serde_wasm_bindgen::from_value(candidates)
            .map_err(|e| JsValue::from_str(&format!("Invalid candidates: {}", e)))?;

        let results = crate::simd::batch_cosine_similarity(&query_vec, &candidates_vec, k)
            .map_err(|e| JsValue::from_str(&format!("Similarity search failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Batch Q-table update using SIMD (2-4x faster)
    #[wasm_bindgen(js_name = batchQUpdate)]
    pub fn batch_q_update(
        updates: JsValue,
        alpha: f32,
        gamma: f32
    ) -> Result<JsValue, JsValue> {
        let update_data: Vec<QUpdateBatch> = serde_wasm_bindgen::from_value(updates)
            .map_err(|e| JsValue::from_str(&format!("Invalid updates: {}", e)))?;

        let results = crate::q_learning::batch_update_simd(update_data, alpha, gamma)
            .map_err(|e| JsValue::from_str(&format!("Batch update failed: {}", e)))?;

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }
}

// ========================================================================
// Utility Functions
// ========================================================================

#[wasm_bindgen]
pub fn wasm_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen]
pub fn simd_available() -> bool {
    cfg!(target_arch = "wasm32")
}

#[wasm_bindgen]
pub fn memory_stats() -> JsValue {
    use wasm_bindgen::memory;

    let stats = MemoryStats {
        wasm_memory_size: memory().grow(0) as u32,
        wasm_memory_pages: memory().size() as u32,
        total_agents: crate::registry::agent_count(),
    };

    serde_wasm_bindgen::to_value(&stats).unwrap()
}

#[derive(serde::Serialize)]
struct MemoryStats {
    wasm_memory_size: u32,
    wasm_memory_pages: u32,
    total_agents: usize,
}
```

### 2.2 TypeScript Definitions (Generated + Enhanced)

```typescript
// types/edge-agent.d.ts

export interface AgentConfig {
  id: string;
  fajCode: string;
  category: string;
  parameters: ParameterConfig[];
  counters: CounterConfig[];
  kpis: KPIConfig[];
}

export interface ParameterConfig {
  name: string;
  valueType: string;
  rangeMin?: number;
  rangeMax?: number;
  currentValue?: string;
}

export interface CounterConfig {
  name: string;
  category: string;
  currentValue: number;
}

export interface KPIConfig {
  name: string;
  formula: string;
  threshold: number;
}

export interface Query {
  queryId: string;
  content: string;
  state: string;
  availableActions: Action[];
}

export type Action =
  | "DirectAnswer"
  | "ContextAnswer"
  | "ConsultPeer"
  | "RequestClarification"
  | "Escalate";

export interface QueryResponse {
  queryId: string;
  content: string;
  actionTaken: Action;
  confidence: number;
  latencyMs: number;
  qValue: number;
  metadata?: string;
}

export interface ValidationResult {
  parameter: string;
  valid: boolean;
  value: number;
}

export interface KPIData {
  totalEvents: number;
  weightedScore: number;
  peakValue: number;
  alerts: number;
}

export interface QTableStats {
  entriesCount: number;
  totalUpdates: number;
  currentEpsilon: number;
  minQValue: number;
  maxQValue: number;
  meanQValue: number;
}

export interface AgentStats {
  id: string;
  fajCode: string;
  status: string;
  interactions: number;
  confidence: number;
  health: number;
  parameterCount: number;
  counterCount: number;
  kpiCount: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  validationAccuracy: number;
  successRate: number;
  avgReward: number;
  memoryBytes: number;
}

export interface SimilarityResult {
  index: number;
  score: number;
}

export class EdgeAgent {
  constructor(config: AgentConfig);

  // Lifecycle
  initialize(): Promise<string>;
  shutdown(): void;
  readonly isReady: boolean;
  readonly status: string;

  // Query Processing
  processQuery(query: Query): Promise<QueryResponse>;
  processQueryAsync(query: Query): Promise<QueryResponse>;

  // Validation
  validateParameters(params: ValidationParams[]): Promise<ValidationResult[]>;
  validateBatch(batch: ValidationParams[][]): Promise<ValidationResult[][]>;

  // Monitoring
  monitorKPIs(): Promise<KPIData>;
  getKPIData(): Promise<KPIData[]>;

  // Q-Learning
  updateLearning(feedback: FeedbackData): Promise<void>;
  exportQTable(): Uint8Array;
  importQTable(data: Uint8Array): Promise<void>;
  getQTableStats(): Promise<QTableStats>;

  // Statistics
  getStats(): Promise<AgentStats>;
  readonly id: string;
  readonly fajCode: string;
  readonly confidence: number;
  readonly interactionCount: number;
  estimateMemory(): number;
}

export class EdgeBatch {
  static similaritySearch(
    query: Float32Array,
    candidates: Float32Array[],
    k: number
  ): Promise<SimilarityResult[]>;

  static batchQUpdate(
    updates: QUpdate[],
    alpha: number,
    gamma: number
  ): Promise<number[]>;
}

export function wasmVersion(): string;
export function simdAvailable(): boolean;
export function memoryStats(): MemoryStats;
```

---

## 3. SIMD Integration Points

### 3.1 SIMD Operation Categories

The SDK implements 4 SIMD-accelerated operation categories as defined in ADR-014:

| Category | Function | Speedup | Use Case |
|----------|----------|---------|----------|
| **Vector Similarity** | `cosine_similarity_simd()` | 3-5x | HNSW indexing, agent routing |
| **Q-Learning Batch** | `batch_q_update_simd()` | 2-4x | Federated learning updates |
| **Parameter Validation** | `validate_parameters_simd()` | 4-8x | Config validation |
| **Counter Aggregation** | `aggregate_counters_simd()` | 3-6x | KPI monitoring |

### 3.2 SIMD Implementation Details

```rust
// src/simd/mod.rs

#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// Vector operations for HNSW indexing and similarity search
pub mod vector;
/// Parameter validation using SIMD range checks
pub mod validation;
/// Counter/KPI aggregation using SIMD reduction
pub mod aggregation;
/// Scalar fallbacks for non-SIMD builds
pub mod fallback;

// Re-export based on target
#[cfg(target_arch = "wasm32")]
pub use vector::*;
#[cfg(not(target_arch = "wasm32"))]
pub use fallback::*;

/// Check if SIMD128 is available at runtime
pub fn is_simd128_available() -> bool {
    cfg!(target_arch = "wasm32") && cfg!(feature = "simd")
}
```

#### 3.2.1 Vector Similarity (HNSW Indexing)

```rust
// src/simd/vector.rs

/// Cosine similarity using WASM SIMD128 (3-5x speedup)
///
/// # Performance
/// - 128-dimensional vectors: <100us
/// - Processes 4 floats per iteration
/// - Automatic scalar fallback for remainder elements
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vector length mismatch");

    let mut dot_acc = v128_from_f32x4(0.0, 0.0, 0.0, 0.0);
    let mut norm_a_acc = v128_from_f32x4(0.0, 0.0, 0.0, 0.0);
    let mut norm_b_acc = v128_from_f32x4(0.0, 0.0, 0.0, 0.0);

    let chunks = a.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        let va = v128_load(a.as_ptr().add(offset));
        let vb = v128_load(b.as_ptr().add(offset));

        dot_acc = f32x4_add(dot_acc, f32x4_mul(va, vb));
        norm_a_acc = f32x4_add(norm_a_acc, f32x4_mul(va, va));
        norm_b_acc = f32x4_add(norm_b_acc, f32x4_mul(vb, vb));
    }

    let dot = horizontal_sum(dot_acc);
    let norm_a = horizontal_sum(norm_a_acc);
    let norm_b = horizontal_sum(norm_b_acc);

    // Handle remainder (scalar)
    let mut dot_rem = 0.0f32;
    let mut norm_a_rem = 0.0f32;
    let mut norm_b_rem = 0.0f32;

    for i in (chunks * 4)..a.len() {
        dot_rem += a[i] * b[i];
        norm_a_rem += a[i] * a[i];
        norm_b_rem += b[i] * b[i];
    }

    let total_dot = dot + dot_rem;
    let total_norm_a = norm_a + norm_a_rem;
    let total_norm_b = norm_b + norm_b_rem;

    if total_norm_a > 0.0 && total_norm_b > 0.0 {
        total_dot / (total_norm_a.sqrt() * total_norm_b.sqrt())
    } else {
        0.0
    }
}

/// Batch cosine similarity search (returns top-k)
pub fn batch_cosine_similarity(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize
) -> Result<Vec<(usize, f32)>, String> {
    if candidates.is_empty() {
        return Ok(vec![]);
    }

    let dim = query.len();
    if !candidates.iter().all(|v| v.len() == dim) {
        return Err("Vector dimension mismatch".to_string());
    }

    let mut results: Vec<(usize, f32)> = candidates
        .iter()
        .enumerate()
        .map(|(i, v)| {
            let sim = if is_simd128_available() {
                unsafe { cosine_similarity_simd(query, v) }
            } else {
                fallback::cosine_similarity_scalar(query, v)
            };
            (i, sim)
        })
        .collect();

    // Sort by similarity (descending) and take top-k
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    results.truncate(k);

    Ok(results)
}
```

#### 3.2.2 Parameter Validation

```rust
// src/simd/validation.rs

/// Validate parameters against range bounds using SIMD (4-8x speedup)
///
/// # Performance
/// - 1000 parameters: <5ms
/// - Results vector: 1 = valid, 0 = invalid
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

    let chunks = values.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;

        let v = v128_load(values.as_ptr().add(offset));
        let min_v = v128_load(min_bounds.as_ptr().add(offset));
        let max_v = v128_load(max_bounds.as_ptr().add(offset));

        // Check: v >= min && v <= max
        let ge_min = f32x4_ge(v, min_v);
        let le_max = f32x4_le(v, max_v);
        let valid = u32x4_and(ge_min, le_max);

        // Extract lane results
        for lane in 0..4 {
            let mask = 1u32 << lane;
            let lane_valid = (u32x4_extract_lane::<0>(valid) & mask) != 0;
            results[offset + lane] = if lane_valid { 1 } else { 0 };
        }
    }

    // Handle remainder (scalar)
    for i in (chunks * 4)..values.len() {
        results[i] = if values[i] >= min_bounds[i] && values[i] <= max_bounds[i] {
            1
        } else {
            0
        };
    }
}
```

#### 3.2.3 Counter Aggregation

```rust
// src/simd/aggregation.rs

/// Aggregate counter values using SIMD (3-6x speedup)
///
/// # Performance
/// - 500 counters: <2ms
/// # Returns
/// (sum, weighted_sum, max, count_above_threshold)
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn aggregate_counters_simd(
    counter_values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    assert_eq!(counter_values.len(), weights.len());

    if counter_values.is_empty() {
        return (0.0, 0.0, f32::NEG_INFINITY, 0);
    }

    let mut sum_acc = v128_from_f32x4(0.0, 0.0, 0.0, 0.0);
    let mut weighted_acc = v128_from_f32x4(0.0, 0.0, 0.0, 0.0);
    let mut max_acc = v128_from_f32x4(
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
    );
    let threshold_vec = v128_from_f32x4(threshold, threshold, threshold, threshold);
    let mut count_above = 0u32;

    let chunks = counter_values.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;

        let vals = v128_load(counter_values.as_ptr().add(offset));
        let w = v128_load(weights.as_ptr().add(offset));

        sum_acc = f32x4_add(sum_acc, vals);
        weighted_acc = f32x4_add(weighted_acc, f32x4_mul(vals, w));
        max_acc = f32x4_max(max_acc, vals);

        // Count above threshold
        let gt = f32x4_gt(vals, threshold_vec);
        let mask = u32x4_extract_lane::<0>(gt);
        count_above += (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
    }

    let sum = horizontal_sum(sum_acc);
    let weighted_sum = horizontal_sum(weighted_acc);
    let max = horizontal_max(max_acc);

    // Handle remainder
    let mut rem_sum = 0.0f32;
    let mut rem_weighted = 0.0f32;
    let mut rem_max = f32::NEG_INFINITY;

    for i in (chunks * 4)..counter_values.len() {
        rem_sum += counter_values[i];
        rem_weighted += counter_values[i] * weights[i];
        if counter_values[i] > rem_max {
            rem_max = counter_values[i];
        }
        if counter_values[i] > threshold {
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
```

---

## 4. Q-Learning Engine

### 4.1 Q-Table Structure

```rust
// src/q_learning/qtable.rs

use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Q-table for reinforcement learning
///
/// Memory layout:
/// - Uses hashbrown for cache efficiency
/// - String interner for state-action keys
/// - Compact Q-entry (12 bytes per entry)
pub struct QTable {
    /// State-action -> Q-value mapping
    entries: HashMap<StateActionKey, QEntry>,

    /// String interner for memory efficiency
    interner: StringInterner,

    /// Learning parameters
    config: QLearningConfig,

    /// Statistics
    stats: QTableStats,
}

/// Interned state-action key (8 bytes vs ~50 bytes for string)
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct StateActionKey(u32, u8);

/// Compact Q-entry (12 bytes)
#[repr(C)]
#[derive(Clone, Debug)]
struct QEntry {
    value: f32,        // 4 bytes
    visit_count: u32,  // 4 bytes
    last_updated: u32, // 4 bytes (relative timestamp)
}

impl QTable {
    pub fn new(config: QLearningConfig) -> Self {
        Self {
            entries: HashMap::new(),
            interner: StringInterner::new(),
            config,
            stats: QTableStats::default(),
        }
    }

    /// Get Q-value for state-action pair
    pub fn get(&self, state: &str, action: &str) -> f32 {
        let state_id = self.interner.intern(state);
        let action_id = self.action_to_id(action);
        let key = StateActionKey(state_id, action_id);

        self.entries.get(&key)
            .map(|e| e.value)
            .unwrap_or(self.config.initial_q_value)
    }

    /// Update Q-value using Q-learning formula
    /// Q(s,a) ← Q(s,a) + α[r + γ max(Q(s',a')) - Q(s,a)]
    pub fn update(&mut self, state: &str, action: &str, reward: f32, next_max_q: f32) -> f32 {
        let state_id = self.interner.intern(state);
        let action_id = self.action_to_id(action);
        let key = StateActionKey(state_id, action_id);

        let current_q = self.get(state, action);
        let target = reward + self.config.gamma * next_max_q;
        let td_error = target - current_q;
        let new_q = current_q + self.config.alpha * td_error;

        let entry = self.entries.entry(key).or_insert(QEntry {
            value: new_q,
            visit_count: 0,
            last_updated: 0,
        });

        entry.value = new_q;
        entry.visit_count += 1;
        entry.last_updated = self.current_timestamp();

        self.stats.total_updates += 1;

        new_q
    }

    /// Batch update using SIMD (2-4x faster)
    pub fn batch_update(&mut self, batch: Vec<QUpdateBatch>) {
        if batch.is_empty() {
            return;
        }

        // Extract arrays for SIMD processing
        let mut q_values: Vec<f32> = batch.iter()
            .map(|b| self.get(&b.state, &b.action))
            .collect();
        let rewards: Vec<f32> = batch.iter().map(|b| b.reward).collect();
        let next_max_q: Vec<f32> = batch.iter().map(|b| b.next_max_q).collect();

        // SIMD batch update
        #[cfg(target_arch = "wasm32")]
        {
            if crate::simd::is_simd128_available() {
                unsafe {
                    crate::simd::batch_q_update_simd(
                        &mut q_values,
                        &rewards,
                        &next_max_q,
                        self.config.alpha,
                        self.config.gamma,
                    );
                }
            } else {
                self.batch_update_scalar(&mut q_values, &rewards, &next_max_q);
            }
        }

        // Store updated values
        for (i, b) in batch.iter().enumerate() {
            let state_id = self.interner.intern(&b.state);
            let action_id = self.action_to_id(&b.action);
            let key = StateActionKey(state_id, action_id);

            self.entries.insert(key, QEntry {
                value: q_values[i],
                visit_count: b.visit_count + 1,
                last_updated: self.current_timestamp(),
            });
        }

        self.stats.total_updates += batch.len() as u32;
    }

    /// Merge Q-table from another agent (federated learning)
    pub fn merge_from(&mut self, other: &QTable, weight: f32) {
        let weight = weight.clamp(0.0, 1.0);
        let self_weight = 1.0 - weight;

        for (&key, other_entry) in &other.entries {
            let merged_value = if let Some(self_entry) = self.entries.get(&key) {
                self_entry.value * self_weight + other_entry.value * weight
            } else {
                other_entry.value * weight
            };

            self.entries.insert(key, QEntry {
                value: merged_value,
                visit_count: (self.entries.get(&key)
                    .map(|e| e.visit_count)
                    .unwrap_or(0) + other_entry.visit_count) / 2,
                last_updated: self.current_timestamp(),
            });
        }
    }

    /// Serialize Q-table for persistence
    pub fn serialize(&self) -> Vec<u8> {
        bincode::serialize(&QTableSnapshot {
            entries: self.entries.clone(),
            interner_data: self.interner.snapshot(),
            config: self.config.clone(),
            stats: self.stats.clone(),
        }).unwrap()
    }

    /// Deserialize Q-table from bytes
    pub fn deserialize(&mut self, data: &[u8]) -> Result<(), String> {
        let snapshot: QTableSnapshot = bincode::deserialize(data)
            .map_err(|e| format!("Deserialization failed: {}", e))?;

        self.entries = snapshot.entries;
        self.interner.restore(snapshot.interner_data);
        self.config = snapshot.config;
        self.stats = snapshot.stats;

        Ok(())
    }

    fn action_to_id(&self, action: &str) -> u8 {
        match action {
            "DirectAnswer" => 0,
            "ContextAnswer" => 1,
            "ConsultPeer" => 2,
            "RequestClarification" => 3,
            "Escalate" => 4,
            _ => 0,
        }
    }

    fn current_timestamp(&self) -> u32 {
        #[cfg(target_arch = "wasm32")]
        {
            (js_sys::Date::now() / 1000.0) as u32
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            use std::time::{SystemTime, UNIX_EPOCH};
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as u32
        }
    }
}
```

### 4.2 Action Selection (Epsilon-Greedy)

```rust
// src/q_learning/policy.rs

use crate::feature_agent::AgentAction;
use super::QTable;

/// Action selection policy
pub trait Policy {
    /// Select action given state and available actions
    fn select_action(
        &self,
        q_table: &QTable,
        state: &str,
        available_actions: &[AgentAction],
    ) -> (AgentAction, f32, bool);
}

/// Epsilon-greedy policy
pub struct EpsilonGreedy {
    pub epsilon: f32,
    pub epsilon_decay: f32,
    pub min_epsilon: f32,
}

impl EpsilonGreedy {
    pub fn new(epsilon: f32, decay: f32) -> Self {
        Self {
            epsilon,
            epsilon_decay: decay,
            min_epsilon: 0.01,
        }
    }

    pub fn decay(&mut self) {
        self.epsilon = (self.epsilon * self.epsilon_decay).max(self.min_epsilon);
    }
}

impl Policy for EpsilonGreedy {
    fn select_action(
        &self,
        q_table: &QTable,
        state: &str,
        available_actions: &[AgentAction],
    ) -> (AgentAction, f32, bool) {
        // Epsilon-greedy: explore with probability ε
        let should_explore = random() < self.epsilon;

        if should_explore {
            // Explore: random action
            let idx = (random() * available_actions.len() as f32) as usize
                % available_actions.len();
            let action = available_actions[idx];
            (action, 0.0, true)
        } else {
            // Exploit: best action
            let mut best_action = available_actions[0];
            let mut best_q = q_table.get(state, &format!("{:?}", best_action));

            for &action in available_actions.iter().skip(1) {
                let q = q_table.get(state, &format!("{:?}", action));
                if q > best_q {
                    best_q = q;
                    best_action = action;
                }
            }

            (best_action, best_q, false)
        }
    }
}

fn random() -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Math::random() as f32
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos();
        (nanos as f32) / u32::MAX as f32
    }
}
```

---

## 5. Agent Registry and Routing

### 5.1 Registry Implementation

```rust
// src/registry.rs

use hashbrown::HashMap;
use std::sync::{Arc, RwLock};
use crate::feature_agent::FeatureAgent;
use crate::simd::vector;

/// Global agent registry
pub struct AgentRegistry {
    /// Agent ID -> Agent mapping
    agents: HashMap<String, Arc<RwLock<FeatureAgent>>>,

    /// FAJ code -> Agent ID mapping (for routing)
    faj_index: HashMap<String, String>,

    /// Category -> Agent IDs mapping
    category_index: HashMap<String, Vec<String>>,

    /// Dependency graph for routing
    dependencies: DependencyGraph,

    /// Statistics
    stats: RegistryStats,
}

/// Dependency graph for P2P routing
pub struct DependencyGraph {
    /// Adjacency list: agent_id -> [(dependent_id, weight)]
    graph: HashMap<String, Vec<(String, f32)>>,

    /// Edge types: requires(1.0), conflicts(0.0), enhances(0.5)
    edge_types: HashMap<(String, String), EdgeType>,
}

#[derive(Clone, Copy, Debug)]
pub enum EdgeType {
    Requires,   // Hard dependency
    Conflicts,  // Mutual exclusion
    Enhances,   // Optional enhancement
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            faj_index: HashMap::new(),
            category_index: HashMap::new(),
            dependencies: DependencyGraph::new(),
            stats: RegistryStats::default(),
        }
    }

    /// Register an agent
    pub fn register(&mut self, agent: FeatureAgent) {
        let id = agent.id().to_string();
        let faj_code = agent.faj_code().to_string();
        let category = agent.category().to_string();

        // Store agent
        self.agents.insert(id.clone(), Arc::new(RwLock::new(agent)));

        // Index by FAJ code
        self.faj_index.insert(faj_code, id.clone());

        // Index by category
        self.category_index
            .entry(category)
            .or_insert_with(Vec::new)
            .push(id.clone());

        self.stats.total_agents += 1;
    }

    /// Get agent by ID
    pub fn get(&self, id: &str) -> Option<Arc<RwLock<FeatureAgent>>> {
        self.agents.get(id).cloned()
    }

    /// Get agent by FAJ code
    pub fn get_by_faj(&self, faj_code: &str) -> Option<Arc<RwLock<FeatureAgent>>> {
        self.faj_index.get(faj_code)
            .and_then(|id| self.agents.get(id).cloned())
    }

    /// Route query to best matching agent
    pub fn route(&self, query: &str, state_embedding: &[f32]) -> Vec<(String, f32)> {
        let mut candidates: Vec<(String, f32)> = Vec::new();

        // 1. Exact FAJ code match
        if let Some(faj_code) = self.extract_faj_code(query) {
            if let Some(agent_id) = self.faj_index.get(&faj_code) {
                if let Some(agent) = self.get(agent_id) {
                    let agent = agent.read().unwrap();
                    candidates.push((
                        agent_id.clone(),
                        agent.confidence() + 0.5, // Boost for exact match
                    ));
                }
            }
        }

        // 2. Semantic similarity search using HNSW
        let similar = self.semantic_search(state_embedding, 5);
        for (agent_id, similarity) in similar {
            candidates.push((agent_id, similarity));
        }

        // 3. Dependency-aware routing
        let routed = self.route_by_dependencies(query, &candidates);

        // Sort by confidence and deduplicate
        routed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        routed.dedup_by(|a, b| a.0 == b.0);
        routed.truncate(10);

        routed
    }

    /// Semantic search using HNSW index
    fn semantic_search(&self, query_embedding: &[f32], k: usize) -> Vec<(String, f32)> {
        let mut results: Vec<(String, f32)> = Vec::new();

        for (id, agent) in &self.agents {
            let agent = agent.read().unwrap();
            if let Some(embedding) = agent.embedding() {
                let similarity = vector::cosine_similarity_simd(query_embedding, embedding);
                results.push((id.clone(), similarity));
            }
        }

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        results.truncate(k);
        results
    }

    /// Route by dependency graph (P2P consultation)
    fn route_by_dependencies(&self, query: &str, candidates: &[(String, f32)]) -> Vec<(String, f32)> {
        let mut results = candidates.to_vec();

        // Add peer agents based on dependencies
        for (agent_id, base_score) in candidates {
            if let Some(peers) = self.dependencies.get_peers(agent_id) {
                for peer_id in peers {
                    if !results.iter().any(|(id, _)| id == peer_id) {
                        if let Some(peer) = self.get(peer_id) {
                            let peer = peer.read().unwrap();
                            results.push((peer_id.clone(), peer.confidence() * base_score * 0.8));
                        }
                    }
                }
            }
        }

        results
    }

    /// Extract FAJ code from query
    fn extract_faj_code(&self, query: &str) -> Option<String> {
        // Match patterns like "FAJ 121 3094" or "FAJ-121-3094"
        let re = regex::Regex::new(r"FAJ[\s-]?\d{3}[\s-]?\d{4}").unwrap();
        re.find(query)
            .map(|m| m.as_str().replace('-', " "))
    }

    /// Get registry statistics
    pub fn stats(&self) -> &RegistryStats {
        &self.stats
    }
}

#[derive(Debug, Default)]
pub struct RegistryStats {
    pub total_agents: usize,
    pub total_queries: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
}

/// Global registry instance
thread_local! {
    static REGISTRY: std::cell::RefCell<AgentRegistry> = std::cell::RefCell::new(AgentRegistry::new());
}

pub fn with_registry<F, R>(f: F) -> R
where
    F: FnOnce(&AgentRegistry) -> R,
{
    REGISTRY.with(|registry| f(&registry.borrow()))
}

pub fn with_registry_mut<F, R>(f: F) -> R
where
    F: FnOnce(&mut AgentRegistry) -> R,
{
    REGISTRY.with(|registry| f(&mut registry.borrow_mut()))
}

pub fn agent_count() -> usize {
    with_registry(|r| r.stats().total_agents)
}
```

---

## 6. Memory Pool Management

### 6.1 Memory Budget

```rust
// src/memory/pool.rs

use std::collections::VecDeque;

/// Memory pool manager with 500MB budget
pub struct MemoryPool {
    /// Total budget in bytes (500MB)
    budget: usize,

    /// Current usage in bytes
    used: usize,

    /// Pre-allocated state buffers (256B each)
    state_buffers: Pool<StateBuffer>,

    /// Pre-allocated trajectory storage (1KB each)
    trajectory_pool: Pool<Trajectory>,

    /// LRU cache for agent instances
    agent_cache: LRUCache<String, Box<FeatureAgent>>,
}

/// Memory pool configuration
pub struct PoolConfig {
    /// Maximum memory budget (default: 500MB)
    pub max_memory_mb: usize,

    /// State buffer pool size
    pub state_buffer_count: usize,

    /// Trajectory pool size
    pub trajectory_count: usize,

    /// Agent cache size
    pub agent_cache_size: usize,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 500,
            state_buffer_count: 1000,
            trajectory_count: 5000,
            agent_cache_size: 50,
        }
    }
}

impl MemoryPool {
    pub fn new(config: PoolConfig) -> Self {
        let budget = config.max_memory_mb * 1024 * 1024;

        // Pre-allocate state buffers
        let state_buffers = Pool::new(config.state_buffer_count, || {
            StateBuffer::new(64) // 64-dimensional state
        });

        // Pre-allocate trajectory storage
        let trajectory_pool = Pool::new(config.trajectory_count, || {
            Trajectory::new()
        });

        Self {
            budget,
            used: 0,
            state_buffers,
            trajectory_pool,
            agent_cache: LRUCache::new(config.agent_cache_size),
        }
    }

    /// Acquire state buffer from pool
    pub fn acquire_state_buffer(&self) -> PoolGuard<StateBuffer> {
        self.state_buffers.acquire()
    }

    /// Acquire trajectory from pool
    pub fn acquire_trajectory(&self) -> PoolGuard<Trajectory> {
        self.trajectory_pool.acquire()
    }

    /// Cache agent instance (LRU eviction at 80% capacity)
    pub fn cache_agent(&mut self, id: String, agent: Box<FeatureAgent>) {
        // Check if we're at 80% capacity
        if self.agent_cache.len() >= self.agent_cache.capacity() * 4 / 5 {
            // Evict LRU agent
            if let Some((id, _)) = self.agent_cache.remove_lru() {
                self.used -= self.estimate_agent_size(&id);
            }
        }

        let size = agent.estimate_memory_bytes();
        if self.used + size > self.budget {
            // Evict agents until we have space
            while self.used + size > self.budget {
                if let Some((id, _)) = self.agent_cache.remove_lru() {
                    self.used -= self.estimate_agent_size(&id);
                } else {
                    break; // Cache is empty, can't evict more
                }
            }
        }

        self.agent_cache.put(id.clone(), agent);
        self.used += size;
    }

    /// Get cached agent
    pub fn get_agent(&self, id: &str) -> Option<&FeatureAgent> {
        self.agent_cache.get(id)
    }

    /// Get memory usage statistics
    pub fn stats(&self) -> MemoryStats {
        MemoryStats {
            budget_bytes: self.budget,
            used_bytes: self.used,
            utilization_percent: (self.used as f32 / self.budget as f32) * 100.0,
            cached_agents: self.agent_cache.len(),
            state_buffers_available: self.state_buffers.available(),
            trajectories_available: self.trajectory_pool.available(),
        }
    }

    fn estimate_agent_size(&self, id: &str) -> usize {
        // Rough estimate: 5MB per agent
        5 * 1024 * 1024
    }
}

#[derive(Debug)]
pub struct MemoryStats {
    pub budget_bytes: usize,
    pub used_bytes: usize,
    pub utilization_percent: f32,
    pub cached_agents: usize,
    pub state_buffers_available: usize,
    pub trajectories_available: usize,
}

/// Generic memory pool
pub struct Pool<T> {
    items: VecDeque<T>,
    max_size: usize,
}

impl<T> Pool<T> {
    pub fn new(size: usize, factory: impl Fn() -> T) -> Self {
        let items = (0..size).map(|_| factory()).collect();
        Self {
            items,
            max_size: size,
        }
    }

    pub fn acquire(&self) -> PoolGuard<T> {
        PoolGuard {
            pool: unsafe { &*(self as *const _ as *const Pool<T>) },
            item: None,
        }
    }

    pub fn available(&self) -> usize {
        self.items.len()
    }
}

pub struct PoolGuard<'a, T> {
    pool: &'a Pool<T>,
    item: Option<T>,
}

impl<'a, T> std::ops::Deref for PoolGuard<'a, T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        self.item.as_ref().unwrap()
    }
}

impl<'a, T> std::ops::DerefMut for PoolGuard<'a, T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.item.as_mut().unwrap()
    }
}

impl<'a, T> Drop for PoolGuard<'a, T> {
    fn drop(&mut self) {
        // Return item to pool
        // Note: This is a simplified version - actual implementation would need unsafe
    }
}
```

### 6.2 HNSW Index Memory

```rust
// src/memory/hnsw.rs

use crate::simd::vector;

/// HNSW (Hierarchical Navigable Small World) index
///
/// Memory usage:
/// - Per node: ~600 bytes (512B vector + 64B connections + 24B metadata)
/// - 10,000 vectors: ~6MB
pub struct HNSWIndex {
    /// All vectors stored contiguously
    vectors: Vec<f32>,

    /// Vector dimension (fixed at 128)
    dim: usize,

    /// Graph connections: layers[layer][node] = Vec<neighbor_ids>
    layers: Vec<Vec<SmallVec<[u32; 16]>>>,

    /// Entry point for search
    entry_point: u32,

    /// Configuration
    config: HNSWConfig,
}

#[derive(Clone)]
pub struct HNSWConfig {
    /// Max connections per node at layer 0
    pub m: usize,

    /// Max connections per node at higher layers
    pub m_max: usize,

    /// Construction ef
    pub ef_construction: usize,

    /// Search ef
    pub ef_search: usize,

    /// Layer probability factor
    pub ml: f32,
}

impl Default for HNSWConfig {
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

impl HNSWIndex {
    pub fn new(dim: usize, config: HNSWConfig) -> Self {
        assert_eq!(dim, 128, "Only 128-dimensional vectors supported");

        Self {
            vectors: Vec::new(),
            dim,
            layers: vec![Vec::new()],
            entry_point: 0,
            config,
        }
    }

    /// Insert vector into index
    pub fn insert(&mut self, vector: &[f32]) -> Result<(), String> {
        if vector.len() != self.dim {
            return Err("Vector dimension mismatch".to_string());
        }

        let node_id = self.vectors.len() as u32 / self.dim as u32;

        // Add vector to storage
        self.vectors.extend_from_slice(vector);

        // Determine layer for this node
        let layer = self.sample_layer();

        // Ensure layers exist
        while self.layers.len() <= layer {
            self.layers.push(Vec::new());
        }

        // Add node to layer
        while self.layers[layer].len() <= node_id as usize {
            self.layers[layer].push(SmallVec::new());
        }

        // Build connections (simplified - actual HNSW is more complex)
        self.build_connections(node_id, layer);

        // Update entry point if needed
        if layer > self.layers.len() {
            self.entry_point = node_id;
        }

        Ok(())
    }

    /// Search for k nearest neighbors
    pub fn search(&self, query: &[f32], k: usize) -> Vec<(u32, f32)> {
        if self.vectors.is_empty() {
            return vec![];
        }

        let mut candidates = vec![(self.entry_point, f32::NEG_INFINITY)];
        let mut visited = std::collections::HashSet::new();
        let mut ef = self.config.ef_search;

        // Greedy search from top layer
        for layer in (0..self.layers.len()).rev() {
            let entry = candidates.first().map(|(id, _)| *id).unwrap_or(self.entry_point);
            let closest = self.search_layer(query, entry, layer, 1, &mut visited);
            candidates = closest;
        }

        // Extract top-k results
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        candidates.truncate(k);

        candidates
    }

    fn sample_layer(&self) -> usize {
        let uniform = random();
        (-uniform.ln() * self.config.ml).floor() as usize
    }

    fn search_layer(
        &self,
        query: &[f32],
        entry: u32,
        layer: usize,
        ef: usize,
        visited: &mut std::collections::HashSet<u32>,
    ) -> Vec<(u32, f32)> {
        let mut candidates = std::collections::BinaryHeap::new();
        let mut w = std::collections::BinaryHeap::new();

        candidates.push((std::cmp::Reverse(0.0), entry));
        visited.insert(entry);

        while let Some((std::cmp::Reverse(dist), v)) = candidates.pop() {
            if w.len() >= ef {
                if let Some(&(std::cmp::Reverse(max_dist), _)) = w.peek() {
                    if dist > max_dist {
                        break;
                    }
                }
            }

            // Get neighbors
            if let Some(neighbors) = self.layers.get(layer).and_then(|l| l.get(v as usize)) {
                for &u in neighbors {
                    if visited.contains(&u) {
                        continue;
                    }
                    visited.insert(u);

                    let u_vec = self.get_vector(u);
                    let dist = 1.0 - vector::cosine_similarity_simd(query, u_vec);

                    candidates.push((std::cmp::Reverse(dist), u));
                    w.push((std::cmp::Reverse(dist), u));

                    if w.len() > ef {
                        w.pop();
                    }
                }
            }
        }

        w.into_iter()
            .map(|(std::cmp::Reverse(dist), id)| (id, 1.0 - dist))
            .collect()
    }

    fn build_connections(&mut self, node_id: u32, layer: usize) {
        // Simplified connection building
        // Real HNSW uses heuristic selection of neighbors
        let m = if layer == 0 { self.config.m } else { self.config.m_max };

        // Connect to nearest m nodes in same layer
        // (simplified - actual implementation would search for nearest neighbors)
    }

    fn get_vector(&self, node_id: u32) -> &[f32] {
        let start = node_id as usize * self.dim;
        &self.vectors[start..start + self.dim]
    }

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

        vectors_size + layers_size + std::mem::size_of::<Self>()
    }
}

fn random() -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Math::random() as f32
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos();
        (nanos as f32) / u32::MAX as f32
    }
}
```

---

## 7. JavaScript Interop Patterns

### 7.1 Type Conversion Strategy

```rust
// src/convert.rs

use serde::{Deserialize, Serialize};
use wasm_bindgen::JsValue;
use serde_wasm_bindgen;

/// Trait for Rust-JavaScript type conversion
pub trait JsConvert: Sized {
    fn from_js(value: JsValue) -> Result<Self, JsValue>;
    fn to_js(&self) -> Result<JsValue, JsValue>;
}

impl<T: for<'de> Deserialize<'de> + Serialize> JsConvert for T {
    fn from_js(value: JsValue) -> Result<Self, JsValue> {
        serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))
    }

    fn to_js(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(self)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

/// Zero-copy typed array access
pub mod typed_arrays {
    use js_sys::{Float32Array, Uint8Array};

    /// Convert Float32Array to Vec<f32> (copies data)
    pub fn f32_array_to_vec(arr: &Float32Array) -> Vec<f32> {
        let mut vec = vec![0.0f32; arr.length() as usize];
        arr.copy_to(&mut vec);
        vec
    }

    /// Convert Vec<f32> to Float32Array (copies data)
    pub fn vec_to_f32_array(vec: &[f32]) -> Float32Array {
        let arr = Float32Array::new_with_length(vec.len() as u32);
        arr.copy_from(vec);
        arr
    }

    /// Get zero-copy view of WASM memory as Float32Array
    pub unsafe fn wasm_memory_as_f32_array(ptr: *mut f32, len: usize) -> Float32Array {
        Float32Array::view_mut_raw(ptr, len)
    }
}
```

### 7.2 Error Handling

```rust
// src/utils/error.rs

use wasm_bindgen::JsValue;
use thiserror::Error;

/// Result type for WASM operations
pub type WasmResult<T> = Result<T, WasmError>;

/// Error type for WASM operations
#[derive(Error, Debug)]
pub enum WasmError {
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Query processing failed: {0}")]
    QueryFailed(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Memory error: {0}")]
    MemoryError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("IO error: {0}")]
    IoError(String),
}

impl From<WasmError> for JsValue {
    fn from(err: WasmError) -> JsValue {
        let obj = js_sys::Object::new();

        let error_code = match &err {
            WasmError::InvalidConfig(_) => "INVALID_CONFIG",
            WasmError::QueryFailed(_) => "QUERY_FAILED",
            WasmError::ValidationError(_) => "VALIDATION_ERROR",
            WasmError::MemoryError(_) => "MEMORY_ERROR",
            WasmError::SerializationError(_) => "SERIALIZATION_ERROR",
            WasmError::IoError(_) => "IO_ERROR",
        };

        js_sys::Reflect::set(&obj, &"code".into(), &error_code.into()).unwrap();
        js_sys::Reflect::set(&obj, &"message".into(), &err.to_string().into()).unwrap();

        obj.into()
    }
}
```

---

## 8. Build and Deployment

### 8.1 Build Configuration

```toml
# Cargo.toml

[package]
name = "elex-wasm-sdk"
version = "2.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde-wasm-bindgen = "0.6"
bincode = "1.3"

# WASM dependencies
wasm-bindgen = "0.2"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }
wasm-bindgen-futures = "0.4"
console_error_panic_hook = "0.1"

# Crypto (WASM-compatible)
ed25519-dalek = { version = "2.1", features = ["rand_core"] }
aes-gcm = "0.10"
getrandom = { version = "0.2", features = ["js"] }

# Utilities
hashbrown = "0.14"
smallvec = { version = "1.11", features = ["serde"] }
regex = "1.10"
thiserror = "1.0"

[features]
default = ["console_error_panic_hook"]
simd = []

[dev-dependencies]
wasm-bindgen-test = "0.3"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true

[profile.wasm]
inherits = "release"
opt-level = "z"
lto = "fat"
```

```bash
#!/bin/bash
# build.sh

set -e

echo "Building ELEX WASM SDK..."

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    cargo install wasm-pack
fi

# Clean previous builds
rm -rf pkg/
rm -rf pkg-simd/
rm -rf pkg-scalar/

# Build SIMD version
echo "Building SIMD version..."
RUSTFLAGS='-C target-feature=+simd128' \
  wasm-pack build \
    --target web \
    --release \
    --out-dir pkg-simd \
    -- --features simd

# Build scalar fallback version
echo "Building scalar fallback version..."
wasm-pack build \
  --target web \
  --release \
  --out-dir pkg-scalar

# Report sizes
echo "Build complete!"
echo "SIMD version:"
ls -lh pkg-simd/*.wasm
echo "Scalar version:"
ls -lh pkg-scalar/*.wasm
```

### 8.2 Package Structure

```
pkg/
├── elex_wasm_sdk_bg.wasm           # WASM binary (SIMD)
├── elex_wasm_sdk.js                # JavaScript glue
├── elex_wasm_sdk.d.ts              # TypeScript definitions
└── package.json                    # NPM package

pkg-scalar/
├── elex_wasm_sdk_bg.wasm           # WASM binary (scalar)
├── elex_wasm_sdk.js
├── elex_wasm_sdk.d.ts
└── package.json
```

---

## 9. Performance Validation

### 9.1 Benchmark Suite

```rust
// tests/simd_bench.rs

#[cfg(test)]
mod benchmarks {
    use super::*;
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
        println!("Cosine similarity (128-dim): {:.2} ns/op ({:.2} us)", per_op, per_op / 1000.0);

        assert!(per_op < 100_000.0, "Target: <100us");
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

### 9.2 Integration Tests

```typescript
// tests/integration/agent.test.ts

import { EdgeAgent, EdgeBatch } from 'elex-wasm-sdk';

describe('EdgeAgent Integration', () => {
  let agent: EdgeAgent;

  beforeEach(() => {
    agent = new EdgeAgent({
      id: 'test-agent',
      fajCode: 'FAJ 121 3094',
      category: 'Test',
      parameters: [],
      counters: [],
      kpis: []
    });
  });

  test('should initialize successfully', async () => {
    const result = await agent.initialize();
    expect(result).toContain('initialized');
    expect(agent.isReady).toBe(true);
  });

  test('should process queries', async () => {
    const response = await agent.processQuery({
      queryId: 'test-1',
      content: 'Test query',
      state: 'active',
      availableActions: ['DirectAnswer', 'ContextAnswer']
    });

    expect(response.actionTaken).toBeDefined();
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });

  test('should validate parameters with SIMD', async () => {
    const results = await agent.validateParameters([
      { name: 'param1', value: 5, min: 0, max: 10 },
      { name: 'param2', value: 15, min: 0, max: 10 }
    ]);

    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
  });

  test('should monitor KPIs with SIMD', async () => {
    const kpiData = await agent.monitorKPIs();
    expect(kpiData.totalEvents).toBeGreaterThanOrEqual(0);
    expect(kpiData.alerts).toBeGreaterThanOrEqual(0);
  });
});
```

---

## 10. Implementation Checklist

### Phase 8.1: Core WASM Module (Week 1-2)
- [ ] Set up Cargo workspace with WASM target
- [ ] Implement core agent data structures
- [ ] Add wasm-bindgen exports for lifecycle
- [ ] Implement query processing logic
- [ ] Add error handling and type conversions

### Phase 8.2: SIMD Operations (Week 2-3)
- [ ] Implement vector similarity search
- [ ] Implement parameter validation (SIMD)
- [ ] Implement counter aggregation (SIMD)
- [ ] Add scalar fallbacks
- [ ] Benchmark SIMD vs scalar performance

### Phase 8.3: Q-Learning Engine (Week 3-4)
- [ ] Implement Q-table with string interning
- [ ] Add epsilon-greedy policy
- [ ] Implement batch updates (SIMD)
- [ ] Add federated learning merge
- [ ] Implement persistence (serialize/deserialize)

### Phase 8.4: Memory Management (Week 4-5)
- [ ] Implement memory pool manager
- [ ] Add HNSW index
- [ ] Implement LRU cache for agents
- [ ] Add memory budget enforcement (500MB)
- [ ] Add memory statistics

### Phase 8.5: Agent Registry (Week 5-6)
- [ ] Implement agent registry
- [ ] Add FAJ code indexing
- [ ] Implement semantic search
- [ ] Add dependency graph routing
- [ ] Implement P2P consultation

### Phase 8.6: Build and Deployment (Week 6-7)
- [ ] Configure build script (SIMD + scalar)
- [ ] Generate TypeScript definitions
- [ ] Add NPM package configuration
- [ ] Set up CI/CD pipeline
- [ ] Deploy to test environment

### Phase 8.7: Testing (Week 7-8)
- [ ] Write unit tests for all modules
- [ ] Add integration tests
- [ ] Benchmark SIMD operations
- [ ] Test memory budget compliance
- [ ] Validate performance targets

### Phase 8.8: Documentation (Week 8)
- [ ] Write API documentation
- [ ] Create usage examples
- [ ] Document performance characteristics
- [ ] Add architecture diagrams
- [ ] Create troubleshooting guide

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **SIMD Speedup** | 3-8x | Benchmark suite |
| **Agent Instantiation** | <200ms | Integration test |
| **Query Latency** | <50ms | End-to-end test |
| **Parameter Validation** | <5ms (1000 params) | SIMD benchmark |
| **KPI Monitoring** | <2ms (500 counters) | SIMD benchmark |
| **Memory Usage** | <500MB (50 agents) | Runtime stats |
| **Q-Table Size** | <50KB (1000 entries) | Memory estimate |
| **HNSW Index** | <6MB (10K vectors) | Memory estimate |
| **WASM Module Size** | <500KB (gzipped) | Build output |
| **TypeScript Coverage** | 100% | Generated .d.ts |

---

## 12. References

### Architecture Documents
- ADR-011: Rust Memory Model
- ADR-013: wasm-bindgen Strategy
- ADR-014: SIMD Implementation
- ADR-018: Concurrency Model
- ADR-005: Vector Memory HNSW
- ADR-006: Q-Learning Engine

### External References
- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320)
- [Q-Learning Fundamentals](https://en.wikipedia.org/wiki/Q-learning)

### Code Repositories
- `/Users/cedric/dev/2026/test-cfv3/src/wasm/agent/` - Existing WASM agent code
- `/Users/cedric/dev/2026/test-cfv3/docs/rust-architecture.md` - Complete Rust architecture
- `/Users/cedric/dev/2026/test-cfv3/docs/wasm-agents.md` - WASM specification

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Phase 8 Architecture - Ready for Implementation
