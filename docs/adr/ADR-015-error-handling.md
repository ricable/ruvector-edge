# ADR-015: Error Handling Strategy

## Status
Accepted

## Context
The 593-agent neural system operates across multiple boundaries:

- **Rust Core:** Agent logic, Q-learning, SIMD operations
- **WASM Runtime:** Memory operations, host function calls
- **JavaScript Boundary:** wasm-bindgen interop
- **Network:** Federated learning, P2P communication
- **Storage:** IndexedDB, file system, memory persistence

Each boundary has different error semantics:
- Rust: `Result<T, E>` with rich error types
- WASM: Traps (abort), no exceptions
- JavaScript: Exceptions with `Error` objects
- Network: Timeouts, disconnections, malformed data
- Storage: Quota exceeded, corruption, permissions

Key requirements:
- **No Silent Failures:** All errors must be observable
- **Debuggability:** Errors must include context for diagnosis
- **Performance:** Error path should not impact happy path
- **WASM Safety:** Panics must not corrupt state

## Decision
We adopt a **Layered Error Handling Strategy** with distinct patterns per layer:

### 1. Error Type Hierarchy

```rust
use thiserror::Error;

/// Top-level agent errors (public API)
#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Configuration error: {0}")]
    Configuration(#[from] ConfigError),

    #[error("Learning error: {0}")]
    Learning(#[from] LearningError),

    #[error("Memory error: {0}")]
    Memory(#[from] MemoryError),

    #[error("Coordination error: {0}")]
    Coordination(#[from] CoordinationError),

    #[error("Serialization error: {0}")]
    Serialization(#[from] SerializationError),

    #[error("Safe zone violation: {0}")]
    SafeZone(#[from] SafeZoneError),
}

/// Configuration-specific errors
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Missing required field: {field}")]
    MissingField { field: String },

    #[error("Invalid value for {field}: {value} (expected {expected})")]
    InvalidValue {
        field: String,
        value: String,
        expected: String,
    },

    #[error("Unknown feature code: {code}")]
    UnknownFeature { code: String },
}

/// Learning-specific errors
#[derive(Error, Debug)]
pub enum LearningError {
    #[error("Invalid state dimension: expected {expected}, got {actual}")]
    InvalidStateDimension { expected: usize, actual: usize },

    #[error("Q-table not initialized for state {state_id}")]
    UninitializedState { state_id: u64 },

    #[error("Reward out of bounds: {reward} (expected [{min}, {max}])")]
    RewardOutOfBounds { reward: f64, min: f64, max: f64 },

    #[error("Convergence failed after {iterations} iterations")]
    ConvergenceFailed { iterations: u32 },
}

/// Memory-specific errors
#[derive(Error, Debug)]
pub enum MemoryError {
    #[error("Out of memory: requested {requested} bytes, available {available}")]
    OutOfMemory { requested: usize, available: usize },

    #[error("Pool exhausted: {pool_name}")]
    PoolExhausted { pool_name: String },

    #[error("HNSW index corruption: {details}")]
    IndexCorruption { details: String },

    #[error("Allocation alignment error: {0}")]
    AlignmentError(String),
}

/// Safe zone enforcement errors
#[derive(Error, Debug)]
pub enum SafeZoneError {
    #[error("Parameter {param} value {value} violates constraint [{min}, {max}]")]
    ConstraintViolation {
        param: String,
        value: f64,
        min: f64,
        max: f64,
    },

    #[error("Dependency not met: {param} requires {dependency}")]
    DependencyNotMet { param: String, dependency: String },

    #[error("Read-only parameter: {param}")]
    ReadOnlyParameter { param: String },
}

/// Serialization errors
#[derive(Error, Debug)]
pub enum SerializationError {
    #[error("Bincode error: {0}")]
    Bincode(String),

    #[error("Invalid format version: expected {expected}, got {actual}")]
    VersionMismatch { expected: u32, actual: u32 },

    #[error("Checksum mismatch: expected {expected:x}, got {actual:x}")]
    ChecksumMismatch { expected: u32, actual: u32 },

    #[error("Decompression failed: {0}")]
    DecompressionFailed(String),
}
```

### 2. thiserror vs anyhow Decision

| Use Case | Library | Rationale |
|----------|---------|-----------|
| Library code (core, simd, wasm) | thiserror | Typed errors for API contracts |
| Application code (CLI, tests) | anyhow | Convenient context addition |
| WASM boundary | thiserror | Must convert to JsError |

```rust
// Library code: thiserror
use thiserror::Error;

#[derive(Error, Debug)]
pub enum QTableError {
    #[error("Index out of bounds: {index} >= {size}")]
    IndexOutOfBounds { index: usize, size: usize },
}

pub fn get_q_value(table: &QTable, state: usize, action: usize)
    -> Result<f64, QTableError>
{
    // ...
}

// Application code: anyhow
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = load_config()
        .context("Failed to load configuration")?;

    let agent = Agent::new(&config)
        .context("Failed to initialize agent")?;

    Ok(())
}
```

### 3. Error Propagation Across WASM Boundary

```rust
use wasm_bindgen::prelude::*;

/// Convert Rust errors to JavaScript errors
impl From<AgentError> for JsError {
    fn from(err: AgentError) -> JsError {
        JsError::new(&format!("{:#}", err))
    }
}

/// Public API always returns Result<T, JsError>
#[wasm_bindgen]
impl Agent {
    #[wasm_bindgen(js_name = selectAction)]
    pub fn select_action(&mut self, state: &[f32]) -> Result<JsValue, JsError> {
        let action = self.inner.select_action(state)
            .map_err(|e| {
                // Log for debugging
                web_sys::console::error_1(&format!("Agent error: {:#}", e).into());
                e
            })?;

        serde_wasm_bindgen::to_value(&action)
            .map_err(|e| JsError::new(&e.to_string()))
    }
}
```

**JavaScript Error Handling:**
```javascript
try {
    const action = agent.selectAction(state);
} catch (error) {
    // error.message contains formatted Rust error
    if (error.message.includes('Safe zone violation')) {
        handleSafeZoneViolation(error);
    } else if (error.message.includes('Out of memory')) {
        handleMemoryError(error);
    } else {
        console.error('Unexpected agent error:', error);
        reportError(error);
    }
}
```

### 4. Panic Handling in WASM

```rust
use std::panic;

/// Set up panic hook for debugging
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Catch panics at WASM boundary
#[wasm_bindgen]
pub fn safe_operation(input: &[u8]) -> Result<Vec<u8>, JsError> {
    let result = panic::catch_unwind(|| {
        // Potentially panicking operation
        process_input(input)
    });

    match result {
        Ok(Ok(output)) => Ok(output),
        Ok(Err(e)) => Err(e.into()),
        Err(_) => Err(JsError::new("Internal error: operation panicked")),
    }
}
```

**Panic Policy:**
- **Development:** Panic with full backtrace via console_error_panic_hook
- **Production:** Catch panics, return error, log for diagnostics
- **Critical Operations:** Never panic; use Result everywhere

### 5. Result Type Design

```rust
/// Type alias for common Result types
pub type AgentResult<T> = Result<T, AgentError>;
pub type LearningResult<T> = Result<T, LearningError>;
pub type MemoryResult<T> = Result<T, MemoryError>;

/// Extension trait for Result ergonomics
pub trait ResultExt<T, E> {
    /// Add context without changing error type
    fn with_context<F, S>(self, f: F) -> Result<T, E>
    where
        F: FnOnce() -> S,
        S: Into<String>,
        E: std::error::Error;
}

/// Option-like methods for agent-specific handling
impl<T> AgentResult<T> {
    /// Log error and return None
    pub fn log_err(self) -> Option<T> {
        match self {
            Ok(v) => Some(v),
            Err(e) => {
                log::error!("Agent error: {:#}", e);
                None
            }
        }
    }

    /// Convert to JavaScript error for boundary
    pub fn to_js(self) -> Result<T, JsError> {
        self.map_err(|e| e.into())
    }
}
```

### 6. Error Context and Debugging

```rust
use tracing::{error, warn, instrument};

/// Instrument functions for error tracing
#[instrument(skip(self), fields(agent_id = %self.id))]
pub fn select_action(&mut self, state: &[f32]) -> AgentResult<Action> {
    // Validate input
    if state.len() != 64 {
        error!(expected = 64, actual = state.len(), "Invalid state dimension");
        return Err(LearningError::InvalidStateDimension {
            expected: 64,
            actual: state.len(),
        }.into());
    }

    // Compute Q-values
    let q_values = self.compute_q_values(state)
        .map_err(|e| {
            warn!(error = %e, "Q-value computation failed");
            e
        })?;

    // Select action
    let action_idx = self.select_action_idx(&q_values);

    Ok(self.actions[action_idx].clone())
}
```

### 7. Error Codes for Programmatic Handling

```rust
/// Error codes for JavaScript error handling
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum ErrorCode {
    // Configuration errors (1xx)
    ConfigMissingField = 101,
    ConfigInvalidValue = 102,
    ConfigUnknownFeature = 103,

    // Learning errors (2xx)
    LearnInvalidState = 201,
    LearnUninitializedState = 202,
    LearnRewardOutOfBounds = 203,
    LearnConvergenceFailed = 204,

    // Memory errors (3xx)
    MemOutOfMemory = 301,
    MemPoolExhausted = 302,
    MemIndexCorruption = 303,

    // Safe zone errors (4xx)
    SafeConstraintViolation = 401,
    SafeDependencyNotMet = 402,
    SafeReadOnly = 403,

    // Serialization errors (5xx)
    SerBincodeError = 501,
    SerVersionMismatch = 502,
    SerChecksumMismatch = 503,
}

impl AgentError {
    pub fn code(&self) -> ErrorCode {
        match self {
            AgentError::Configuration(ConfigError::MissingField { .. }) => ErrorCode::ConfigMissingField,
            AgentError::Learning(LearningError::InvalidStateDimension { .. }) => ErrorCode::LearnInvalidState,
            // ... etc
        }
    }
}

/// JavaScript-friendly error with code
#[wasm_bindgen]
pub struct JsAgentError {
    code: u32,
    message: String,
}
```

## Alternatives Considered

### anyhow Everywhere
- **Pros:** Simple, flexible, good context support
- **Cons:** Loses type information, cannot pattern match on errors
- **Rejected:** WASM boundary requires typed conversion

### Custom Error Framework
- **Pros:** Full control, optimized for our needs
- **Cons:** Maintenance burden, reinventing the wheel
- **Rejected:** thiserror provides sufficient functionality

### Exception-like Patterns (panic + catch)
- **Pros:** Simpler control flow, familiar to JS developers
- **Cons:** Performance overhead, not idiomatic Rust, unsafe in WASM
- **Rejected:** Result-based handling is safer and more explicit

### Error Numbers Only
- **Pros:** Small binary size, fast comparison
- **Cons:** Poor debugging, no context
- **Partial:** Error codes supplement rich error types

## Consequences

### Positive
- **Type Safety:** Compiler enforces error handling
- **Debuggability:** Rich error messages with context
- **Interoperability:** Clean conversion to JavaScript errors
- **Performance:** Zero-cost until error occurs
- **Traceability:** Error codes enable analytics

### Negative
- **Verbosity:** Must handle Result at every call site
- **Boilerplate:** Error type conversions require From implementations
- **Binary Size:** thiserror adds some code size
- **Complexity:** Multiple error types to understand

### Risks
- **Error Swallowing:** Developers may use `.unwrap()` inappropriately
- **Context Loss:** Error chain may be truncated at boundaries
- **Code Mismatch:** Error codes may drift from implementations
- **Panic Leakage:** Unhandled panics may abort WASM

### Mitigations
- **Clippy Lints:** `#[deny(clippy::unwrap_used)]` in production code
- **Error Chain Preservation:** Use `{:#}` formatting for full context
- **Code Generation:** Derive error codes from error types
- **Panic Hook:** Always install console_error_panic_hook

## References
- ADR-012: Unsafe Rust Policy
- ADR-013: wasm-bindgen Strategy
- thiserror Crate - https://docs.rs/thiserror
- anyhow Crate - https://docs.rs/anyhow
- Rust Error Handling Book - https://doc.rust-lang.org/book/ch09-00-error-handling.html
- console_error_panic_hook - https://github.com/rustwasm/console_error_panic_hook
