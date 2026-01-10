# ADR-018: Concurrency Model for WASM Agents

## Status
Accepted

## Context
The 593-agent neural system must handle concurrent operations in constrained environments:

- **Browser Main Thread:** UI responsiveness is critical; blocking >50ms causes jank
- **Web Workers:** Background threads available but with limitations
- **SharedArrayBuffer:** Cross-thread memory sharing (requires COOP/COEP headers)
- **Atomics:** Low-level synchronization primitives
- **Async/Await:** JavaScript's concurrency model

Concurrency challenges in WASM:
1. **Single-threaded by default:** WASM runs on one thread unless explicitly parallelized
2. **No std::thread:** Rust's threading primitives don't work in WASM
3. **SharedArrayBuffer restrictions:** Security mitigations limit availability
4. **Memory model differences:** JavaScript's event loop vs Rust's ownership

Performance requirements:
- Agent decision: <50ms (avoid UI jank)
- Federated sync: Non-blocking
- Q-table updates: Background-capable
- HNSW search: Parallelizable for large indices

## Decision
We adopt a **Hybrid Single-Thread + Web Worker Architecture** with optional SharedArrayBuffer:

### 1. Default: Single-Threaded Async

Primary model uses JavaScript async/await with Rust futures:

```rust
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use js_sys::Promise;

/// Async agent operations using JavaScript event loop
#[wasm_bindgen]
impl Agent {
    /// Non-blocking action selection
    #[wasm_bindgen(js_name = selectActionAsync)]
    pub async fn select_action_async(&mut self, state: &[f32]) -> Result<JsValue, JsError> {
        // Yield to event loop periodically for long operations
        let action = self.compute_action_with_yields(state).await?;
        serde_wasm_bindgen::to_value(&action).map_err(|e| e.into())
    }

    async fn compute_action_with_yields(&mut self, state: &[f32]) -> Result<Action, AgentError> {
        // Encode state (fast, no yield needed)
        let encoded = self.encode_state(state)?;

        // Q-value computation (may need yielding for large tables)
        let q_values = self.compute_q_values_chunked(&encoded).await?;

        // Action selection (fast)
        Ok(self.select_best_action(&q_values))
    }

    async fn compute_q_values_chunked(&self, state: &EncodedState) -> Result<Vec<f64>, AgentError> {
        let mut q_values = Vec::with_capacity(self.action_count);

        for chunk in self.q_table.chunks(CHUNK_SIZE) {
            // Process chunk
            for entry in chunk {
                q_values.push(self.compute_q_value(state, entry));
            }

            // Yield to event loop every chunk
            yield_now().await;
        }

        Ok(q_values)
    }
}

/// Yield to JavaScript event loop
async fn yield_now() {
    let promise = Promise::resolve(&JsValue::UNDEFINED);
    JsFuture::from(promise).await.unwrap();
}
```

### 2. Web Worker Offloading

Heavy operations can be offloaded to Web Workers:

```rust
// worker.rs - Runs in Web Worker context
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WorkerAgent {
    inner: AgentCore,
}

#[wasm_bindgen]
impl WorkerAgent {
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<WorkerAgent, JsError> {
        // Initialize in worker thread
        Ok(WorkerAgent {
            inner: AgentCore::from_config(config)?,
        })
    }

    /// Synchronous operation (OK in worker, not main thread)
    #[wasm_bindgen(js_name = trainBatch)]
    pub fn train_batch(&mut self, trajectories: &[u8]) -> Result<(), JsError> {
        let batch: Vec<Trajectory> = bincode::deserialize(trajectories)
            .map_err(|e| JsError::new(&e.to_string()))?;

        for trajectory in batch {
            self.inner.update(trajectory)?;
        }

        Ok(())
    }

    /// Export Q-table for transfer back to main thread
    #[wasm_bindgen(js_name = exportQTable)]
    pub fn export_q_table(&self) -> Vec<u8> {
        self.inner.q_table.serialize()
    }
}
```

**JavaScript Worker Setup:**
```javascript
// main.js
const worker = new Worker('worker.js', { type: 'module' });

worker.onmessage = (event) => {
    const { type, data } = event.data;
    if (type === 'trained') {
        // Q-table returned from worker
        mainAgent.importQTable(data.qTable);
    }
};

// Offload training to worker
function trainInBackground(trajectories) {
    const serialized = serializeTrajectories(trajectories);
    worker.postMessage({ type: 'train', data: serialized }, [serialized.buffer]);
}

// worker.js
import init, { WorkerAgent } from './elex_wasm.js';

let agent;

self.onmessage = async (event) => {
    const { type, data } = event.data;

    if (type === 'init') {
        await init();
        agent = new WorkerAgent(data.config);
    } else if (type === 'train') {
        agent.trainBatch(data);
        const qTable = agent.exportQTable();
        self.postMessage({ type: 'trained', data: { qTable } }, [qTable.buffer]);
    }
};
```

### 3. SharedArrayBuffer (When Available)

For environments with SharedArrayBuffer, enable true parallelism:

```rust
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

/// Shared memory Q-table for cross-worker access
pub struct SharedQTable {
    /// Backing SharedArrayBuffer
    buffer: js_sys::SharedArrayBuffer,

    /// Atomic version counter for cache invalidation
    version: AtomicU64,

    /// Read-write lock simulation
    readers: AtomicU32,
    writer: AtomicU32,
}

impl SharedQTable {
    pub fn new(state_count: usize, action_count: usize) -> Self {
        let size = state_count * action_count * std::mem::size_of::<f32>();
        let buffer = js_sys::SharedArrayBuffer::new(size as u32);

        SharedQTable {
            buffer,
            version: AtomicU64::new(0),
            readers: AtomicU32::new(0),
            writer: AtomicU32::new(0),
        }
    }

    /// Acquire read lock
    pub fn read_lock(&self) {
        loop {
            // Wait for no writer
            while self.writer.load(Ordering::Acquire) > 0 {
                std::hint::spin_loop();
            }

            // Increment readers
            self.readers.fetch_add(1, Ordering::AcqRel);

            // Double-check no writer snuck in
            if self.writer.load(Ordering::Acquire) == 0 {
                break;
            }

            // Writer appeared, back off
            self.readers.fetch_sub(1, Ordering::AcqRel);
        }
    }

    pub fn read_unlock(&self) {
        self.readers.fetch_sub(1, Ordering::AcqRel);
    }

    /// Acquire write lock
    pub fn write_lock(&self) {
        // Set writer flag
        while self.writer.compare_exchange(0, 1, Ordering::AcqRel, Ordering::Acquire).is_err() {
            std::hint::spin_loop();
        }

        // Wait for readers to drain
        while self.readers.load(Ordering::Acquire) > 0 {
            std::hint::spin_loop();
        }
    }

    pub fn write_unlock(&self) {
        self.version.fetch_add(1, Ordering::Release);
        self.writer.store(0, Ordering::Release);
    }

    /// Get Q-value (requires read lock held)
    pub unsafe fn get(&self, state: usize, action: usize) -> f32 {
        let view = js_sys::Float32Array::new(&self.buffer);
        let index = state * self.action_count + action;
        view.get_index(index as u32)
    }

    /// Set Q-value (requires write lock held)
    pub unsafe fn set(&self, state: usize, action: usize, value: f32) {
        let view = js_sys::Float32Array::new(&self.buffer);
        let index = state * self.action_count + action;
        view.set_index(index as u32, value);
    }
}
```

**Feature Detection:**
```javascript
const sharedArrayBufferAvailable = (() => {
    try {
        new SharedArrayBuffer(1);
        return true;
    } catch {
        return false;
    }
})();

// Requires these headers:
// Cross-Origin-Opener-Policy: same-origin
// Cross-Origin-Embedder-Policy: require-corp
```

### 4. Atomics for Synchronization

```rust
use std::sync::atomic::{AtomicI32, Ordering};
use js_sys::Atomics;

/// Wait/notify synchronization using Atomics
pub struct AtomicSignal {
    value: AtomicI32,
}

impl AtomicSignal {
    pub fn new() -> Self {
        AtomicSignal {
            value: AtomicI32::new(0),
        }
    }

    /// Wait for signal (blocks worker thread)
    pub fn wait(&self, expected: i32) {
        let array = self.as_int32_array();
        // Atomics.wait blocks until value changes or timeout
        let _ = Atomics::wait(&array, 0, expected);
    }

    /// Wait with timeout (milliseconds)
    pub fn wait_timeout(&self, expected: i32, timeout_ms: f64) -> bool {
        let array = self.as_int32_array();
        let result = Atomics::wait_with_timeout(&array, 0, expected, timeout_ms);
        result.as_string().map(|s| s != "timed-out").unwrap_or(false)
    }

    /// Signal one waiting thread
    pub fn notify_one(&self) {
        let array = self.as_int32_array();
        let _ = Atomics::notify(&array, 0, 1);
    }

    /// Signal all waiting threads
    pub fn notify_all(&self) {
        let array = self.as_int32_array();
        let _ = Atomics::notify(&array, 0);
    }

    fn as_int32_array(&self) -> js_sys::Int32Array {
        // Create view over atomic value
        unsafe {
            js_sys::Int32Array::view(std::slice::from_raw_parts(
                &self.value as *const AtomicI32 as *const i32,
                1,
            ))
        }
    }
}
```

### 5. Future Async Patterns

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

/// Cooperative yielding for long-running operations
pub struct YieldingIterator<I> {
    inner: I,
    processed: usize,
    yield_every: usize,
}

impl<I: Iterator> YieldingIterator<I> {
    pub fn new(iter: I, yield_every: usize) -> Self {
        YieldingIterator {
            inner: iter,
            processed: 0,
            yield_every,
        }
    }
}

impl<I: Iterator + Unpin> Future for YieldingIterator<I> {
    type Output = Option<I::Item>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.as_mut().get_mut();

        if this.processed > 0 && this.processed % this.yield_every == 0 {
            // Schedule wake-up and yield
            cx.waker().wake_by_ref();
            this.processed += 1;
            return Poll::Pending;
        }

        match this.inner.next() {
            Some(item) => {
                this.processed += 1;
                Poll::Ready(Some(item))
            }
            None => Poll::Ready(None),
        }
    }
}
```

### 6. Concurrency Decision Matrix

| Scenario | Single Thread | Web Worker | SharedArrayBuffer |
|----------|--------------|------------|-------------------|
| Action selection | Yes (async) | No | No |
| Q-table update | Yes (async) | Optional | If available |
| Batch training | No | Yes | Yes |
| Federated sync | Yes (async) | Yes | Yes |
| HNSW search (small) | Yes | No | No |
| HNSW search (large) | No | Yes | Yes |
| Background learning | No | Yes | Yes |

## Alternatives Considered

### Pure Single-Threaded
- **Pros:** Simple, maximum compatibility, no synchronization
- **Cons:** UI blocking for heavy operations, poor performance
- **Rejected:** Cannot meet performance requirements

### wasm-threads (Rust std::thread)
- **Pros:** Familiar Rust threading model
- **Cons:** Requires SharedArrayBuffer, not widely available
- **Partial:** Optional feature when SAB available

### Rayon in WASM
- **Pros:** Easy parallelism, work stealing
- **Cons:** Requires wasm-bindgen-rayon, SAB, complex setup
- **Deferred:** May adopt when tooling matures

### Single Worker Pool
- **Pros:** Simple architecture, one worker per task
- **Cons:** Overhead for small tasks, worker startup cost
- **Partial:** Use for batch operations, not individual decisions

### Comlink for Worker Communication
- **Pros:** RPC-style API, cleaner than postMessage
- **Cons:** Additional dependency, abstraction overhead
- **Deferred:** Consider for complex worker interactions

## Consequences

### Positive
- **Responsiveness:** Main thread stays responsive via async yields
- **Scalability:** Heavy work offloads to workers
- **Compatibility:** Works without SharedArrayBuffer (degraded mode)
- **Flexibility:** Multiple concurrency strategies per use case

### Negative
- **Complexity:** Multiple concurrency models to understand
- **Data Transfer:** Worker communication requires serialization
- **Feature Detection:** Must handle SAB availability at runtime
- **Testing Difficulty:** Concurrent behavior hard to test

### Risks
- **Race Conditions:** SharedArrayBuffer code may have data races
- **Deadlock:** Improper lock ordering with atomics
- **Worker Overhead:** Spinning up workers has latency cost
- **Memory Pressure:** Multiple workers multiply memory usage

### Mitigations
- **Loom Testing:** Use loom for concurrency testing
- **Lock-Free Designs:** Prefer message passing over shared state
- **Worker Pooling:** Reuse workers instead of creating new ones
- **Memory Budgets:** Limit worker count based on available memory

## References
- ADR-011: Rust Memory Model
- ADR-013: wasm-bindgen Strategy
- WebAssembly Threads Proposal - https://github.com/WebAssembly/threads
- SharedArrayBuffer MDN - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- wasm-bindgen-rayon - https://github.com/RReverser/wasm-bindgen-rayon
- "Parallelism in JavaScript" by Surma
