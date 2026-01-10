# ADR-011: Rust Memory Model for Agent System

## Status
Accepted

## Context
The 593-agent neural system requires careful memory management across edge environments (browsers, mobile devices, edge servers). Key challenges include:

- **Ownership Complexity:** Agents share state (Q-tables, patterns) while maintaining isolation
- **WASM Constraints:** Linear memory model with 4GB limit, no automatic garbage collection
- **Performance Requirements:** Q-table lookup <1ms, state encoding <5ms
- **Concurrent Access:** Multiple agents may access shared memory pools
- **Memory Efficiency:** ~10MB per agent target, 593 agents = ~6GB total budget

The Rust ownership system provides memory safety guarantees, but the choice between ownership patterns significantly impacts:
- API ergonomics and ease of implementation
- Runtime performance and allocation overhead
- Memory fragmentation in long-running processes
- WASM boundary crossing efficiency

## Decision
We adopt a **tiered memory ownership strategy** with the following patterns:

### 1. Agent-Owned State (Ownership)
Each agent owns its primary state exclusively:

```rust
pub struct Agent {
    /// Exclusively owned Q-table - no sharing needed
    q_table: QTable,

    /// Owned trajectory buffer for experience replay
    trajectory_buffer: VecDeque<Trajectory>,

    /// Agent-specific configuration
    config: AgentConfig,
}
```

**Rationale:** Agent state is never shared; ownership eliminates synchronization overhead.

### 2. Shared Immutable Resources (Arc)
Read-only resources shared across agents use `Arc`:

```rust
/// Shared feature knowledge base (read-only after initialization)
pub type FeatureKnowledge = Arc<FeatureKnowledgeBase>;

/// Shared HNSW index for semantic search
pub type SharedIndex = Arc<HNSWIndex>;

/// Shared safe zone constraints
pub type SafeZones = Arc<SafeZoneConfig>;

pub struct AgentRuntime {
    knowledge: FeatureKnowledge,   // Shared across all 593 agents
    index: SharedIndex,             // Shared HNSW index
    safe_zones: SafeZones,          // Shared constraints
}
```

**Rationale:** `Arc` provides cheap cloning and thread-safe sharing for immutable data.

### 3. Mutable Shared State (Arc<Mutex> / Arc<RwLock>)
State requiring concurrent mutation uses appropriate locking:

```rust
/// Federated learning accumulator - write-heavy
pub type FederatedAccumulator = Arc<Mutex<QTableAccumulator>>;

/// Metrics collector - read-heavy
pub type MetricsStore = Arc<RwLock<MetricsCollection>>;

/// Message queue - write-heavy with fairness
pub type MessageQueue = Arc<Mutex<VecDeque<Message>>>;
```

**Lock Selection:**
- `Mutex`: Write-heavy or fairness-required scenarios
- `RwLock`: Read-heavy scenarios (>80% reads)
- `parking_lot` crate variants for WASM compatibility

### 4. Memory Pools for Allocations
Pre-allocated pools reduce allocation overhead:

```rust
pub struct MemoryPool {
    /// Pre-allocated vector buffers for state encoding
    state_buffers: Pool<StateBuffer>,

    /// Pre-allocated trajectory storage
    trajectory_pool: Pool<Trajectory>,

    /// Reusable message buffers
    message_pool: Pool<MessageBuffer>,
}

impl MemoryPool {
    pub fn acquire_state_buffer(&self) -> PoolGuard<StateBuffer> {
        self.state_buffers.acquire()
    }
}
```

**Pool Sizing:**
| Buffer Type | Size | Pool Count | Total |
|-------------|------|------------|-------|
| State (64 dims) | 256B | 1000 | 256KB |
| Trajectory | 1KB | 5000 | 5MB |
| Message | 4KB | 500 | 2MB |

### 5. WASM Linear Memory Management

```rust
/// WASM memory allocator with growth tracking
pub struct WasmMemoryManager {
    /// Current memory pages (64KB each)
    pages: u32,

    /// Maximum allowed pages
    max_pages: u32,

    /// Allocation tracking for debugging
    allocations: Vec<AllocationRecord>,
}

impl WasmMemoryManager {
    /// Grow memory with bounds checking
    pub fn grow(&mut self, delta_pages: u32) -> Result<u32, MemoryError> {
        let new_pages = self.pages.checked_add(delta_pages)
            .ok_or(MemoryError::Overflow)?;

        if new_pages > self.max_pages {
            return Err(MemoryError::ExceedsLimit);
        }

        let result = core::arch::wasm32::memory_grow(0, delta_pages);
        if result == usize::MAX {
            return Err(MemoryError::GrowthFailed);
        }

        self.pages = new_pages;
        Ok(result as u32)
    }
}
```

**Memory Layout:**
```
WASM Linear Memory (up to 4GB):
+------------------+------------------+------------------+------------------+
| Stack (1MB)      | Heap (Dynamic)   | Memory Pools     | Static Data      |
+------------------+------------------+------------------+------------------+
0                  1MB               Variable           End-16KB           End
```

### 6. Interior Mutability Patterns

```rust
use std::cell::RefCell;

/// Single-threaded agent with interior mutability
pub struct SingleThreadAgent {
    /// Interior mutability for learning state
    learning_state: RefCell<LearningState>,

    /// Thread-local random number generator
    rng: RefCell<StdRng>,
}

/// Cell for simple copy types (counters, flags)
pub struct AgentMetrics {
    action_count: Cell<u64>,
    reward_sum: Cell<f64>,
    last_update: Cell<u64>,
}
```

**Usage:**
- `RefCell`: Complex mutable state in single-threaded contexts (WASM without threads)
- `Cell`: Simple copy types (counters, timestamps)

## Alternatives Considered

### Garbage Collection via wasm-gc
- **Pros:** Automatic memory management, no manual ownership
- **Cons:** wasm-gc not yet stable, runtime overhead, unpredictable pauses
- **Rejected:** Performance requirements demand deterministic memory management

### Reference Counting Only (Rc everywhere)
- **Pros:** Simple mental model, no borrow checker fights
- **Cons:** Cycle risks, no thread safety, overhead on every clone
- **Rejected:** Performance overhead unacceptable for hot paths

### Arena Allocation for Everything
- **Pros:** Fast allocation, cache-friendly, simple deallocation
- **Cons:** Cannot free individual objects, lifetime complexity
- **Partial:** Used for trajectory buffers where batch deallocation is acceptable

### Custom Allocator (wee_alloc)
- **Pros:** Smaller binary size (~1KB vs 10KB for dlmalloc)
- **Cons:** Slower allocation, fragmentation in long-running processes
- **Partial:** Used for size-constrained builds, not default

## Consequences

### Positive
- **Memory Safety:** Rust ownership prevents use-after-free, double-free, data races
- **Predictable Performance:** No GC pauses, deterministic allocation
- **Efficient Sharing:** Arc provides zero-cost sharing for immutable data
- **WASM Compatibility:** Linear memory model maps well to explicit management
- **Debugging:** Allocation tracking enables memory leak detection

### Negative
- **Complexity:** Multiple ownership patterns require developer understanding
- **Borrow Checker:** Learning curve for Rust newcomers
- **Pool Sizing:** Must estimate pool sizes; underestimation causes fallback to heap
- **WASM Fragmentation:** Long-running processes may fragment linear memory

### Risks
- **Memory Leaks:** Rc/Arc cycles if not careful (mitigated by weak references)
- **Pool Exhaustion:** High load may exhaust pre-allocated pools
- **Lock Contention:** Arc<Mutex> on hot paths may cause bottlenecks
- **WASM Memory Pressure:** Near 4GB limit causes OOM in older browsers

### Mitigations
- **Static Analysis:** Clippy lints for Arc cycles, unnecessary clones
- **Pool Monitoring:** Metrics for pool utilization, growth patterns
- **Lock-Free Alternatives:** crossbeam channels for message passing
- **Memory Budgets:** Per-agent limits enforced at runtime

## References
- ADR-003: Edge-First Zero-Cloud Architecture
- ADR-101: Neural Agent Architecture
- ADR-105: WASM SIMD Acceleration
- Rust Reference: Ownership Model - https://doc.rust-lang.org/reference/ownership.html
- wasm-bindgen Memory Management - https://rustwasm.github.io/wasm-bindgen/reference/types/boxed-slices.html
- parking_lot Crate (WASM-compatible locks) - https://docs.rs/parking_lot
