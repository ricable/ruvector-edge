# ADR-013: wasm-bindgen Strategy for JavaScript Interop

## Status
Accepted

## Context
The 593-agent neural system must operate in JavaScript environments (browsers, Node.js, Deno) while core logic is implemented in Rust/WASM. The boundary between Rust and JavaScript requires:

- **Efficient Data Transfer:** Q-tables (256KB+), state vectors (256B), messages (4KB)
- **Type Safety:** Prevent type mismatches across the boundary
- **Error Propagation:** Rust errors must be meaningful in JavaScript
- **Memory Management:** Clear ownership semantics at the boundary
- **API Ergonomics:** JavaScript-friendly API despite Rust implementation

wasm-bindgen is the de facto standard for Rust-WASM-JS interop, but its usage patterns significantly impact performance and developer experience.

## Decision
We adopt a **Layered wasm-bindgen Strategy** with distinct patterns for different use cases:

### 1. Public API Design

Expose a minimal, JavaScript-friendly API:

```rust
use wasm_bindgen::prelude::*;

/// Public agent interface for JavaScript consumers
#[wasm_bindgen]
pub struct Agent {
    inner: AgentCore,  // Not exposed to JS
}

#[wasm_bindgen]
impl Agent {
    /// Create a new agent for a specific feature
    #[wasm_bindgen(constructor)]
    pub fn new(feature_code: &str, config: JsValue) -> Result<Agent, JsError> {
        let config: AgentConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsError::new(&format!("Invalid config: {}", e)))?;

        Ok(Agent {
            inner: AgentCore::new(feature_code, config)?,
        })
    }

    /// Select best action for current state
    #[wasm_bindgen(js_name = selectAction)]
    pub fn select_action(&mut self, state: &[f32]) -> Result<Action, JsError> {
        self.inner.select_action(state)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Update Q-values with observed reward
    #[wasm_bindgen(js_name = updateReward)]
    pub fn update_reward(&mut self, reward: f64) -> Result<(), JsError> {
        self.inner.update(reward)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Export Q-table as transferable bytes
    #[wasm_bindgen(js_name = exportQTable)]
    pub fn export_q_table(&self) -> Vec<u8> {
        self.inner.q_table.serialize()
    }

    /// Import Q-table from bytes
    #[wasm_bindgen(js_name = importQTable)]
    pub fn import_q_table(&mut self, data: &[u8]) -> Result<(), JsError> {
        self.inner.q_table = QTable::deserialize(data)
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(())
    }
}
```

**Naming Conventions:**
- Use `js_name` to provide camelCase names for JavaScript
- Constructors use `#[wasm_bindgen(constructor)]`
- Methods that return `Result` use `JsError` for JS-friendly errors

### 2. Serialization Strategy

Use `serde-wasm-bindgen` for complex types, raw bytes for bulk data:

```rust
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen;

/// Configuration passed from JavaScript
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub learning_rate: f64,
    pub discount_factor: f64,
    pub exploration_rate: f64,
    pub safe_zone_enabled: bool,
}

/// Action returned to JavaScript
#[derive(Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Action {
    #[wasm_bindgen(readonly)]
    pub parameter_id: u32,

    #[wasm_bindgen(readonly)]
    pub adjustment: f64,

    #[wasm_bindgen(readonly)]
    pub confidence: f64,
}

/// Bulk data uses raw bytes (more efficient than serde for large arrays)
#[wasm_bindgen]
impl Agent {
    /// Get state as Float32Array-compatible buffer
    #[wasm_bindgen(js_name = getStateBuffer)]
    pub fn get_state_buffer(&self) -> Vec<f32> {
        self.inner.current_state.to_vec()
    }
}
```

**Serialization Decision Matrix:**

| Data Type | Size | Frequency | Strategy |
|-----------|------|-----------|----------|
| Config objects | <1KB | Once | serde-wasm-bindgen |
| Actions | <100B | Per decision | wasm-bindgen struct |
| State vectors | 256B | Per decision | `&[f32]` / `Vec<f32>` |
| Q-tables | 256KB+ | Periodic | Raw bytes (`Vec<u8>`) |
| Messages | 1-4KB | Frequent | serde-wasm-bindgen |

### 3. Error Handling Across Boundary

```rust
use wasm_bindgen::JsError;
use thiserror::Error;

/// Internal Rust errors
#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Invalid state dimension: expected {expected}, got {actual}")]
    InvalidStateDimension { expected: usize, actual: usize },

    #[error("Safe zone violation: {parameter} value {value} outside [{min}, {max}]")]
    SafeZoneViolation {
        parameter: String,
        value: f64,
        min: f64,
        max: f64,
    },

    #[error("Q-table corruption: {0}")]
    QTableCorruption(String),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

/// Convert to JavaScript error at boundary
impl From<AgentError> for JsError {
    fn from(err: AgentError) -> JsError {
        JsError::new(&err.to_string())
    }
}

/// Public API uses Result<T, JsError>
#[wasm_bindgen]
impl Agent {
    #[wasm_bindgen(js_name = validateState)]
    pub fn validate_state(&self, state: &[f32]) -> Result<bool, JsError> {
        if state.len() != 64 {
            return Err(AgentError::InvalidStateDimension {
                expected: 64,
                actual: state.len(),
            }.into());
        }
        Ok(true)
    }
}
```

**JavaScript Error Handling:**
```javascript
try {
    const action = agent.selectAction(state);
} catch (e) {
    if (e.message.includes('Safe zone violation')) {
        // Handle constraint violation
    } else if (e.message.includes('Invalid state dimension')) {
        // Handle dimension mismatch
    } else {
        // Unknown error
        console.error('Agent error:', e.message);
    }
}
```

### 4. Memory Ownership at Boundary

Clear ownership rules prevent leaks and use-after-free:

```rust
/// Ownership transfer patterns
#[wasm_bindgen]
impl Agent {
    /// BORROW: JavaScript retains ownership, Rust borrows
    /// Use for: Input data, temporary access
    #[wasm_bindgen(js_name = processState)]
    pub fn process_state(&mut self, state: &[f32]) -> f64 {
        // state is borrowed, JS still owns it
        self.inner.compute_value(state)
    }

    /// TAKE: Rust takes ownership from JavaScript
    /// Use for: Large data that Rust needs to store
    #[wasm_bindgen(js_name = setQTable)]
    pub fn set_q_table(&mut self, data: Vec<u8>) {
        // data ownership transferred to Rust, JS copy is consumed
        self.inner.q_table = QTable::from_bytes(data);
    }

    /// GIVE: Rust transfers ownership to JavaScript
    /// Use for: Computed results, exported data
    #[wasm_bindgen(js_name = getQTable)]
    pub fn get_q_table(&self) -> Vec<u8> {
        // Returns owned Vec, JS takes ownership
        self.inner.q_table.to_bytes()
    }

    /// CLONE: Both sides get independent copies
    /// Use for: Shared data that both need to modify
    #[wasm_bindgen(js_name = cloneConfig)]
    pub fn clone_config(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.inner.config).unwrap()
    }
}
```

### 5. TypeScript Definitions

Generate TypeScript definitions for type safety:

```rust
// build.rs or wasm-pack configuration
// Generates: pkg/agent.d.ts
```

```typescript
// Generated TypeScript definitions (enhanced manually)
export interface AgentConfig {
    learningRate: number;
    discountFactor: number;
    explorationRate: number;
    safeZoneEnabled: boolean;
}

export interface Action {
    readonly parameterId: number;
    readonly adjustment: number;
    readonly confidence: number;
}

export class Agent {
    constructor(featureCode: string, config: AgentConfig);

    selectAction(state: Float32Array): Action;
    updateReward(reward: number): void;
    exportQTable(): Uint8Array;
    importQTable(data: Uint8Array): void;

    free(): void;  // Explicit cleanup
}
```

### 6. Performance Optimizations

```rust
/// Avoid repeated boundary crossings
#[wasm_bindgen]
impl Agent {
    /// Batch operation: single boundary crossing for multiple actions
    #[wasm_bindgen(js_name = batchSelectActions)]
    pub fn batch_select_actions(&mut self, states: &[f32], state_count: usize) -> Vec<u8> {
        let state_dim = 64;
        let actions: Vec<Action> = (0..state_count)
            .map(|i| {
                let start = i * state_dim;
                let end = start + state_dim;
                self.inner.select_action(&states[start..end]).unwrap()
            })
            .collect();

        // Serialize all actions at once
        bincode::serialize(&actions).unwrap()
    }
}

/// Use typed arrays for zero-copy access where possible
#[wasm_bindgen]
impl Agent {
    /// Direct access to internal buffer (zero-copy view)
    #[wasm_bindgen(js_name = getQTableView)]
    pub fn get_q_table_view(&self) -> js_sys::Float32Array {
        let ptr = self.inner.q_table.as_ptr();
        let len = self.inner.q_table.len();

        // SAFETY: Q-table remains valid while Agent exists
        unsafe {
            js_sys::Float32Array::view_mut_raw(ptr as *mut f32, len)
        }
    }
}
```

## Alternatives Considered

### Direct FFI without wasm-bindgen
- **Pros:** Maximum control, potentially smaller binary
- **Cons:** Manual glue code, no type safety, error-prone
- **Rejected:** Development overhead too high for 593 agents

### stdweb (deprecated)
- **Pros:** Alternative API, some features wasm-bindgen lacks
- **Cons:** No longer maintained, ecosystem moved to wasm-bindgen
- **Rejected:** Deprecated, no future support

### serde_json at Boundary
- **Pros:** Human-readable, easy debugging
- **Cons:** 3-5x slower than binary, larger payloads
- **Rejected:** Performance requirements prohibit JSON for bulk data

### AssemblyScript Instead of Rust
- **Pros:** TypeScript-like syntax, easier for JS developers
- **Cons:** Less mature, no SIMD, weaker type system
- **Rejected:** Performance and type safety requirements

### WebIDL Bindings
- **Pros:** Standard interface definition
- **Cons:** Less flexible, worse ergonomics
- **Partial:** May use for browser API bindings in future

## Consequences

### Positive
- **Type Safety:** TypeScript definitions catch errors at compile time
- **Performance:** Efficient binary transfer for bulk data
- **Ergonomics:** JavaScript-friendly API despite Rust internals
- **Memory Safety:** Clear ownership rules prevent leaks
- **Debugging:** Meaningful error messages cross boundary

### Negative
- **Build Complexity:** wasm-pack adds build steps
- **Bundle Size:** wasm-bindgen glue code adds ~10KB
- **API Surface:** Must maintain two API views (Rust internal, JS external)
- **Version Coupling:** wasm-bindgen version must match JS glue

### Risks
- **ABI Stability:** wasm-bindgen ABI may change between versions
- **Performance Overhead:** Boundary crossing still has cost
- **Memory Views:** Zero-copy views require careful lifetime management
- **Error Information Loss:** Rich Rust errors become string messages

### Mitigations
- **Version Pinning:** Lock wasm-bindgen version in CI
- **Boundary Auditing:** Profile boundary crossing frequency
- **View Lifetime Docs:** Document view invalidation conditions
- **Error Codes:** Include error codes for programmatic handling

## References
- ADR-011: Rust Memory Model
- ADR-015: Error Handling
- wasm-bindgen Guide - https://rustwasm.github.io/wasm-bindgen/
- serde-wasm-bindgen - https://github.com/cloudflare/serde-wasm-bindgen
- wasm-pack - https://rustwasm.github.io/wasm-pack/
- TypeScript Declaration Files - https://www.typescriptlang.org/docs/handbook/declaration-files/
