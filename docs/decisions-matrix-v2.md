# ELEX Implementation Decisions Matrix v2

**Version:** 2.0.0 | **Status:** Ready for AI Agent Execution | **Last Updated:** 2026-01-10

This document provides definitive technical decisions for AI coding agents implementing the ELEX 593-agent neural system in Rust/WASM. Each decision includes evaluated options, chosen solution, and clear rationale for autonomous agent execution.

---

## Document Purpose

This matrix serves as the authoritative reference for AI coding agents to make consistent implementation decisions. Each decision is:
- **Deterministic:** Clear choice, no ambiguity
- **Justified:** Rationale based on ADRs and project requirements
- **Actionable:** Direct commands and configurations provided
- **Testable:** Success criteria defined

---

## Category 1: Rust Toolchain

### 1.1 Rust Version

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Rust version | 1.75, 1.76, 1.77, 1.78+ | **1.77.0** | Stable WASM SIMD support, std::arch::wasm32 stable, 2024 edition preparation | coder |

**Implementation:**
```bash
# Agent must verify Rust version before starting
rustup default 1.77.0
rustc --version  # Expected: rustc 1.77.0

# Or use rust-toolchain.toml (preferred)
```

**rust-toolchain.toml:**
```toml
[toolchain]
channel = "1.77.0"
targets = ["wasm32-unknown-unknown"]
components = ["rustfmt", "clippy"]
```

**Decision Rationale:**
- 1.75: SIMD intrinsics not fully stable
- 1.76: Some WASM memory64 issues
- **1.77**: Optimal - stable SIMD, improved error messages, wasm32 target mature
- 1.78+: Newer but less tested in production WASM contexts

---

### 1.2 WASM Target

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| WASM target | wasm32-unknown-unknown, wasm32-wasi, wasm32-unknown-emscripten | **wasm32-unknown-unknown** | Browser-first deployment, no WASI runtime dependency, smallest binary | coder |

**Implementation:**
```bash
# Install target
rustup target add wasm32-unknown-unknown

# Build command
cargo build --target wasm32-unknown-unknown --release
```

**Decision Rationale:**
- **wasm32-unknown-unknown**: Pure WASM, no system dependencies, browser-native
- wasm32-wasi: Requires WASI runtime, adds syscall overhead, larger binary
- wasm32-unknown-emscripten: Legacy, requires Emscripten SDK, bloated output

**ADR Reference:** ADR-105 (Edge Deployment)

---

### 1.3 Build Tool

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Build tool | wasm-pack, trunk, cargo-only, cargo-component | **wasm-pack** | Best JS interop, TypeScript generation, optimized output | coder |

**Implementation:**
```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build for web target
wasm-pack build --target web --release

# Build for Node.js
wasm-pack build --target nodejs --release
```

**package.json Integration:**
```json
{
  "scripts": {
    "build:wasm": "wasm-pack build --target web --release",
    "build:wasm:debug": "wasm-pack build --target web --dev"
  }
}
```

**Decision Rationale:**
- **wasm-pack**: TypeScript definitions, JS glue code, npm-ready output
- trunk: Good for full-stack Rust, overkill for library
- cargo-only: No JS bindings, manual glue code needed
- cargo-component: Component model not yet stable

**ADR Reference:** ADR-013 (wasm-bindgen Strategy)

---

### 1.4 Package Manager / Workspace

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Workspace structure | Single crate, Cargo workspace, Virtual workspace | **Cargo workspace** | Modular crates, shared dependencies, parallel builds | coder |

**Implementation (Cargo.toml at workspace root):**
```toml
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
wasm-bindgen = "0.2.92"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
uuid = { version = "1.0", features = ["v4", "serde", "js"] }

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

---

## Category 2: SIMD Strategy

### 2.1 SIMD Intrinsics

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| SIMD intrinsics | std::arch::wasm32, portable_simd (nightly), wide crate | **std::arch::wasm32** | Stable API, direct SIMD128 access, optimal performance | coder |

**Implementation:**
```rust
// Enable in lib.rs
#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

// Example: SIMD cosine similarity
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

    if a_norm * b_norm == 0.0 { 0.0 } else { dot / (a_norm * b_norm) }
}

#[inline(always)]
unsafe fn horizontal_sum(v: v128) -> f32 {
    f32x4_extract_lane::<0>(v)
        + f32x4_extract_lane::<1>(v)
        + f32x4_extract_lane::<2>(v)
        + f32x4_extract_lane::<3>(v)
}
```

**Decision Rationale:**
- **std::arch::wasm32**: Stable in Rust 1.77, direct hardware intrinsics
- portable_simd: Nightly-only, API unstable
- wide crate: Abstraction overhead, less control

**ADR Reference:** ADR-014 (SIMD Implementation), ADR-105 (WASM SIMD)

---

### 2.2 SIMD Fallback Strategy

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Fallback strategy | Runtime detection, compile-time features, dual binaries | **Compile-time + dual binaries** | Optimal performance per target, no runtime overhead | coder |

**Implementation:**

**.cargo/config.toml:**
```toml
[target.wasm32-unknown-unknown]
rustflags = ["-C", "target-feature=+simd128"]
```

**Cargo.toml Features:**
```toml
[features]
default = ["simd"]
simd = []
scalar = []
```

**Dispatch Code:**
```rust
// dispatch.rs
pub fn cosine_similarity(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    #[cfg(all(target_arch = "wasm32", feature = "simd"))]
    unsafe { simd::cosine_similarity_simd(a, b) }

    #[cfg(any(not(target_arch = "wasm32"), feature = "scalar"))]
    scalar::cosine_similarity_scalar(a, b)
}
```

**Build Script (Makefile or npm scripts):**
```bash
# SIMD build
RUSTFLAGS='-C target-feature=+simd128' wasm-pack build --target web --out-dir pkg-simd -- --features simd

# Scalar build
wasm-pack build --target web --out-dir pkg-scalar -- --features scalar --no-default-features
```

**JavaScript Feature Detection:**
```javascript
const simdSupported = WebAssembly.validate(new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
    0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
    0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x0b
]));

const wasmPath = simdSupported ? '/wasm/agent_simd.wasm' : '/wasm/agent_scalar.wasm';
```

**Decision Rationale:**
- Runtime detection: Adds conditional branches, slower
- **Compile-time + dual binaries**: Zero overhead, optimal codegen for each
- Dual binaries: ~500KB each, acceptable for edge deployment

---

### 2.3 SIMD Alignment

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Data alignment | Natural alignment, 16-byte forced, repr(align) | **16-byte alignment via repr(align(16))** | SIMD load/store optimal, prevents misaligned access penalties | coder |

**Implementation:**
```rust
/// Aligned state vector for SIMD operations
#[repr(C, align(16))]
#[derive(Debug, Clone, Copy)]
pub struct AlignedVec64([f32; 64]);

/// Aligned embedding for SIMD operations
#[repr(C, align(16))]
#[derive(Debug, Clone, Copy)]
pub struct AlignedVec128([f32; 128]);

impl AlignedVec128 {
    pub fn as_slice(&self) -> &[f32; 128] {
        &self.0
    }

    pub fn as_ptr(&self) -> *const f32 {
        self.0.as_ptr()
    }
}
```

---

## Category 3: Memory Architecture

### 3.1 HNSW Implementation

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| HNSW implementation | hnswlib-rs, instant-distance, custom impl, hnsw crate | **Custom WASM-native implementation** | Full control, SIMD-optimized, no C++ dependencies | coder |

**Implementation Configuration:**
```rust
/// HNSW index configuration per ADR-005
pub struct HnswConfig {
    /// Max connections per node per layer
    pub m: usize,               // = 16
    /// Build-time search width
    pub ef_construction: usize,  // = 200
    /// Query-time search width
    pub ef_search: usize,        // = 50
    /// Maximum index levels
    pub max_level: usize,        // = 16
    /// Vector dimension
    pub dimension: usize,        // = 128
}

impl Default for HnswConfig {
    fn default() -> Self {
        Self {
            m: 16,
            ef_construction: 200,
            ef_search: 50,
            max_level: 16,
            dimension: 128,
        }
    }
}
```

**Decision Rationale:**
- hnswlib-rs: C++ dependency, WASM compilation issues
- instant-distance: Good but less control over SIMD
- hnsw crate: Abandoned, no WASM support
- **Custom**: SIMD-optimized, WASM-native, full control

**ADR Reference:** ADR-005 (HNSW Configuration), ADR-104 (Memory Integration)

---

### 3.2 Persistence Backend

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Persistence backend | IndexedDB, sql.js, localStorage, OPFS | **sql.js (SQLite WASM)** | SQL queries, cross-platform, proven, vector extension support | coder |

**Implementation:**
```javascript
// Initialize sql.js for persistence
import initSqlJs from 'sql.js';

const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
});

const db = new SQL.Database();

// Create tables for ELEX data
db.run(`
    CREATE TABLE IF NOT EXISTS q_entries (
        state_hash INTEGER,
        action_idx INTEGER,
        value REAL,
        visits INTEGER,
        last_update INTEGER,
        PRIMARY KEY (state_hash, action_idx)
    );

    CREATE TABLE IF NOT EXISTS vectors (
        id INTEGER PRIMARY KEY,
        embedding BLOB,
        metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_q_state ON q_entries(state_hash);
`);
```

**Rust Side (via wasm-bindgen):**
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub type SqlJs;

    #[wasm_bindgen(method)]
    pub fn run(this: &SqlJs, sql: &str);

    #[wasm_bindgen(method)]
    pub fn exec(this: &SqlJs, sql: &str) -> JsValue;
}
```

**Decision Rationale:**
- IndexedDB: Complex API, poor query support
- **sql.js**: SQL power, WASM-native, persistence
- localStorage: 5MB limit, synchronous, blocking
- OPFS: Newer API, limited browser support

---

### 3.3 Q-Table Compression

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Compression algorithm | LZ4, Brotli, zstd, gzip | **LZ4** | Fastest decompression, 4-8x compression, WASM-ready | coder |

**Implementation (Cargo.toml):**
```toml
[dependencies]
lz4_flex = "0.11"
bincode = "1.3"
```

**Rust Code:**
```rust
use lz4_flex::{compress_prepend_size, decompress_size_prepended};
use bincode;

/// Compress Q-table for storage
pub fn compress_qtable(qtable: &QTable) -> Result<Vec<u8>, ElexError> {
    let serialized = bincode::serialize(qtable)
        .map_err(|e| ElexError::Serialization(e.to_string()))?;

    Ok(compress_prepend_size(&serialized))
}

/// Decompress Q-table from storage
pub fn decompress_qtable(data: &[u8]) -> Result<QTable, ElexError> {
    let decompressed = decompress_size_prepended(data)
        .map_err(|e| ElexError::Decompression(e.to_string()))?;

    bincode::deserialize(&decompressed)
        .map_err(|e| ElexError::Deserialization(e.to_string()))
}
```

**Decision Rationale:**
- **LZ4**: Fastest decompress (~4GB/s), good compression
- Brotli: Better ratio but 10x slower decompress
- zstd: Excellent but larger WASM binary
- gzip: Slowest, poor for hot path

**ADR Reference:** ADR-104 (4-32x compression target)

---

### 3.4 Memory Layer Structure

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Memory architecture | Single layer, 3-layer, 4-layer | **4-layer hierarchy** | Hot/warm/cold separation, optimal access patterns | coder |

**Layer Configuration per ADR-104:**

| Layer | Purpose | Storage | Capacity | TTL |
|-------|---------|---------|----------|-----|
| **L1: Hot** | Active Q-entries | In-memory HashMap | 10,000 entries | Session |
| **L2: Vector** | HNSW embeddings | In-memory index | 10,000 vectors | Session |
| **L3: Warm** | Recent history | sql.js | 100,000 entries | 7 days |
| **L4: Cold** | Archive | Compressed blobs | Unlimited | Permanent |

**Implementation:**
```rust
pub struct MemorySystem {
    /// L1: Hot storage (in-memory LRU)
    hot: LruCache<u64, QEntry>,
    /// L2: Vector index (HNSW)
    vectors: HnswIndex,
    /// L3: Warm storage (sql.js handle)
    warm: SqliteStorage,
    /// L4: Cold storage (compressed blobs)
    cold: BlobStorage,
}

impl MemorySystem {
    pub fn new(config: MemoryConfig) -> Self {
        Self {
            hot: LruCache::new(config.hot_capacity),      // 10,000
            vectors: HnswIndex::new(config.hnsw_config),
            warm: SqliteStorage::new(),
            cold: BlobStorage::new(config.cold_path),
        }
    }

    /// Lookup with layer fallback
    pub fn get_q_entry(&mut self, state_hash: u64, action: u8) -> Option<QEntry> {
        // Try L1 first
        if let Some(entry) = self.hot.get(&(state_hash, action)) {
            return Some(entry.clone());
        }

        // Fallback to L3
        if let Some(entry) = self.warm.get_q_entry(state_hash, action) {
            // Promote to L1
            self.hot.put((state_hash, action), entry.clone());
            return Some(entry);
        }

        None
    }
}
```

---

## Category 4: Claude-Flow Integration

### 4.1 Hook Timing Strategy

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Hook timing | Pre-task only, post-task only, full lifecycle | **Full lifecycle** | Complete traceability, learning integration, metrics | coder, tester |

**Hook Configuration:**
```bash
# Session start - restore context
npx @claude-flow/cli@latest hooks session-start --session-id "elex-dev-001"

# Pre-task - get suggestions, check memory
npx @claude-flow/cli@latest hooks pre-task --description "Implement SIMD cosine similarity"

# Post-edit - train neural patterns
npx @claude-flow/cli@latest hooks post-edit --file "src/simd/similarity.rs" --train-neural true

# Post-task - record completion
npx @claude-flow/cli@latest hooks post-task --task-id "TASK-004" --success true --store-results true

# Session end - persist state
npx @claude-flow/cli@latest hooks session-end --generate-summary true --export-metrics true
```

**Integration Points:**

| Hook | Trigger | Purpose |
|------|---------|---------|
| `session-start` | Agent spawn | Load memory, configure context |
| `pre-task` | Before implementation | Get routing suggestions, load patterns |
| `post-edit` | After file changes | Train neural patterns, validate |
| `post-task` | After completion | Store successful patterns |
| `session-end` | Agent termination | Persist state, export metrics |

---

### 4.2 Memory Backend

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Claude-Flow memory backend | AgentDB, SQLite, Hybrid | **Hybrid** | Best of both - AgentDB vectors + SQLite persistence | coder |

**Configuration (claude-flow.config.json):**
```json
{
  "memory": {
    "backend": "hybrid",
    "agentdb": {
      "enabled": true,
      "vectorDimension": 128,
      "hnswConfig": {
        "m": 16,
        "efConstruction": 200,
        "efSearch": 100
      }
    },
    "sqlite": {
      "enabled": true,
      "path": "./data/elex-memory.db",
      "walMode": true
    }
  }
}
```

**Usage:**
```bash
# Store pattern with vector embedding
npx @claude-flow/cli@latest memory store \
  --key "simd-cosine-pattern" \
  --value "Use f32x4_splat for initialization, horizontal_sum for reduction" \
  --namespace patterns \
  --tags "simd,optimization"

# Vector search for similar patterns
npx @claude-flow/cli@latest memory search \
  --query "SIMD dot product implementation" \
  --namespace patterns \
  --limit 5
```

---

### 4.3 Swarm Topology

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Swarm topology | mesh, hierarchical, hierarchical-mesh, adaptive | **hierarchical-mesh** | Coordinator control + peer collaboration | coder, architect |

**Configuration:**
```bash
# Initialize swarm with hierarchical-mesh
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical-mesh \
  --max-agents 15 \
  --v3-mode
```

**Agent Hierarchy:**
```
                    +----------------+
                    |  Coordinator   |
                    |  (Orchestrator)|
                    +-------+--------+
                            |
            +---------------+---------------+
            |               |               |
    +-------v------+ +------v------+ +------v------+
    |   Research   | |   Coding    | |   Testing   |
    |   Cluster    | |   Cluster   | |   Cluster   |
    +-------+------+ +------+------+ +------+------+
            |               |               |
    +---+---+---+   +---+---+---+   +---+---+---+
    | R | R | R |   | C | C | C |   | T | T | T |
    +---+---+---+   +---+---+---+   +---+---+---+
```

**Decision Rationale:**
- mesh: Good for small swarms, overhead at scale
- hierarchical: Bottleneck at coordinator
- **hierarchical-mesh**: Best of both - coordination + peer efficiency
- adaptive: Overhead of topology switching

---

### 4.4 Agent Types for ELEX Tasks

| Task Category | Primary Agent | Support Agents |
|---------------|---------------|----------------|
| Rust implementation | coder | researcher |
| SIMD optimization | coder, performance-engineer | tester |
| Q-learning engine | coder | researcher, tester |
| Memory system | coder, memory-specialist | tester |
| Cryptography | coder, security-auditor | security-architect |
| Integration tests | tester | coder |
| Architecture decisions | architect | researcher |
| Code review | reviewer | security-auditor |

---

## Category 5: Testing Strategy

### 5.1 Test Framework

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Rust test framework | cargo test, wasm-bindgen-test, wasm-pack test | **wasm-bindgen-test + cargo test** | Both native and WASM testing | tester |

**Implementation (Cargo.toml):**
```toml
[dev-dependencies]
wasm-bindgen-test = "0.3"
proptest = "1.0"
criterion = "0.5"
```

**Test Structure:**
```rust
// Native tests (cargo test)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_basic() {
        let a = [1.0f32; 128];
        let b = [1.0f32; 128];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_orthogonal_vectors() {
        let mut a = [0.0f32; 128];
        let mut b = [0.0f32; 128];
        a[0] = 1.0;
        b[1] = 1.0;
        let sim = cosine_similarity(&a, &b);
        assert!(sim.abs() < 0.001);
    }
}

// WASM tests (wasm-pack test)
#[cfg(target_arch = "wasm32")]
mod wasm_tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_simd_in_browser() {
        let a = [1.0f32; 128];
        let b = [0.5f32; 128];
        let sim = cosine_similarity(&a, &b);
        assert!(sim > 0.9);
    }
}
```

**Test Commands:**
```bash
# Native tests
cargo test --workspace

# WASM tests in headless browser
wasm-pack test --headless --chrome crates/elex-simd

# WASM tests in Node.js
wasm-pack test --node crates/elex-simd

# Property-based tests
cargo test --features proptest
```

---

### 5.2 Integration Testing Framework

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| JS integration tests | vitest, jest, playwright | **vitest** | Fast, ESM-native, WASM-friendly | tester |

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.ts'],
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
    },
});
```

**Test Example (tests/agent.test.ts):**
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import init, { Agent } from '../pkg-simd';

describe('ELEX Agent Integration', () => {
    beforeAll(async () => {
        await init();
    });

    it('should create agent with valid config', () => {
        const agent = new Agent('IFLB', {
            learningRate: 0.1,
            discountFactor: 0.95,
            explorationRate: 0.1,
            safeZoneEnabled: true,
        });

        expect(agent).toBeDefined();
    });

    it('should select action for state vector', () => {
        const agent = new Agent('IFLB', { /* config */ });
        const state = new Float32Array(64).fill(0.5);

        const action = agent.selectAction(state);

        expect(action.confidence).toBeGreaterThan(0);
        expect(action.parameterId).toBeGreaterThanOrEqual(0);
    });

    it('should achieve <1ms routing latency', async () => {
        const agent = new Agent('IFLB', { /* config */ });
        const state = new Float32Array(64).fill(0.5);

        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            agent.selectAction(state);
        }
        const elapsed = performance.now() - start;

        expect(elapsed / 1000).toBeLessThan(1); // <1ms per call
    });
});
```

---

### 5.3 Benchmark Configuration

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Benchmark framework | criterion, divan, iai | **criterion** | Mature, detailed stats, WASM support | tester |

**benches/simd_benchmarks.rs:**
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};

fn benchmark_cosine_similarity(c: &mut Criterion) {
    let a = [1.0f32; 128];
    let b = [0.5f32; 128];

    let mut group = c.benchmark_group("cosine_similarity");

    group.bench_function("simd_128", |bencher| {
        bencher.iter(|| {
            black_box(cosine_similarity_simd(black_box(&a), black_box(&b)))
        })
    });

    group.bench_function("scalar_128", |bencher| {
        bencher.iter(|| {
            black_box(cosine_similarity_scalar(black_box(&a), black_box(&b)))
        })
    });

    group.finish();
}

fn benchmark_hnsw_search(c: &mut Criterion) {
    let mut index = HnswIndex::new(HnswConfig::default());

    // Insert 10,000 vectors
    for i in 0..10_000 {
        index.insert(i, &random_embedding());
    }

    let query = random_embedding();

    c.bench_function("hnsw_search_k10", |bencher| {
        bencher.iter(|| {
            black_box(index.search(black_box(&query), 10))
        })
    });
}

criterion_group!(benches, benchmark_cosine_similarity, benchmark_hnsw_search);
criterion_main!(benches);
```

**Performance Targets:**

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Cosine similarity (SIMD) | <15us | criterion P50 |
| Cosine similarity (scalar) | <50us | criterion P50 |
| HNSW search (k=10, n=10k) | <1ms | criterion P95 |
| Q-table lookup | <1ms | criterion P95 |
| Full decision cycle | <50ms | integration test |

---

## Category 6: Error Handling

### 6.1 Error Type Strategy

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Error handling | anyhow, thiserror, custom | **thiserror** | Typed errors, wasm-bindgen compatible | coder |

**Implementation:**
```rust
use thiserror::Error;
use wasm_bindgen::JsError;

#[derive(Error, Debug)]
pub enum ElexError {
    #[error("Invalid state dimension: expected {expected}, got {actual}")]
    InvalidStateDimension { expected: usize, actual: usize },

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Feature not found: {0}")]
    FeatureNotFound(String),

    #[error("Safe zone violation: {parameter} = {value} outside [{min}, {max}]")]
    SafeZoneViolation {
        parameter: String,
        value: f64,
        min: f64,
        max: f64,
    },

    #[error("SIMD operation failed: {0}")]
    SimdError(String),

    #[error("Memory error: {0}")]
    MemoryError(String),

    #[error("Cryptographic error: {0}")]
    CryptoError(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Deserialization error: {0}")]
    Deserialization(String),

    #[error("Decompression error: {0}")]
    Decompression(String),
}

impl From<ElexError> for JsError {
    fn from(err: ElexError) -> JsError {
        JsError::new(&err.to_string())
    }
}
```

---

## Category 7: Security

### 7.1 Cryptographic Primitives

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Identity crypto | ed25519-dalek, ring, openssl | **ed25519-dalek** | Pure Rust, WASM-native, audited | coder, security-auditor |

**Cargo.toml:**
```toml
[dependencies]
ed25519-dalek = { version = "2.0", features = ["rand_core"] }
x25519-dalek = "2.0"
aes-gcm = "0.10"
rand = { version = "0.8", features = ["getrandom"] }
getrandom = { version = "0.2", features = ["js"] }
```

**Implementation:**
```rust
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use rand::rngs::OsRng;

pub struct AgentIdentity {
    signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
    pub agent_id: [u8; 32],
}

impl AgentIdentity {
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let agent_id = *verifying_key.as_bytes();

        Self {
            signing_key,
            verifying_key,
            agent_id,
        }
    }

    pub fn sign(&self, message: &[u8]) -> Signature {
        self.signing_key.sign(message)
    }

    pub fn verify(&self, message: &[u8], signature: &Signature) -> bool {
        self.verifying_key.verify(message, signature).is_ok()
    }
}
```

**ADR Reference:** ADR-007 (Security Cryptography)

---

### 7.2 Random Number Generation

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| RNG for WASM | getrandom, js_sys::Math::random, custom | **getrandom with js feature** | Crypto-secure, browser-compatible | coder, security-auditor |

**Implementation:**
```rust
use rand::rngs::OsRng;
use rand::Rng;

/// Secure random float for exploration
pub fn secure_random() -> f32 {
    OsRng.gen()
}

/// Secure random bytes for nonces
pub fn random_bytes(buf: &mut [u8]) {
    OsRng.fill(buf);
}
```

---

## Category 8: Binary Optimization

### 8.1 Binary Size Optimization

| Decision | Options | Chosen | Rationale | Agent Type |
|----------|---------|--------|-----------|------------|
| Size optimization | opt-level z, opt-level s, opt-level 3 | **opt-level z + wasm-opt** | Smallest binary, acceptable performance | coder |

**Cargo.toml:**
```toml
[profile.release]
opt-level = "z"      # Optimize for size
lto = true           # Link-time optimization
codegen-units = 1    # Single codegen unit for better optimization
panic = "abort"      # No unwinding code
strip = true         # Strip debug symbols
```

**Post-build Optimization:**
```bash
# wasm-opt for additional size reduction
wasm-opt -Oz --enable-simd -o output.wasm input.wasm

# Brotli compression for deployment
brotli -9 output.wasm -o output.wasm.br
```

**Target Sizes:**

| Stage | Size Target |
|-------|-------------|
| Unoptimized debug | ~5MB |
| Release (opt-level z) | ~800KB |
| After wasm-opt | ~600KB |
| After Brotli | <500KB |

---

## Summary: Quick Reference

### Agent Decision Checklist

```
[x] Rust 1.77.0 with rust-toolchain.toml
[x] wasm32-unknown-unknown target
[x] wasm-pack for building
[x] Cargo workspace structure
[x] std::arch::wasm32 for SIMD
[x] Dual binary (SIMD + scalar) builds
[x] 16-byte alignment for vectors
[x] Custom HNSW implementation
[x] sql.js for persistence
[x] LZ4 compression
[x] 4-layer memory hierarchy
[x] Full lifecycle hooks
[x] Hybrid memory backend
[x] hierarchical-mesh topology
[x] wasm-bindgen-test + vitest
[x] criterion benchmarks
[x] thiserror for errors
[x] ed25519-dalek for crypto
[x] getrandom with js feature
[x] opt-level z + wasm-opt
```

### Key Performance Targets

| Metric | Target | Validation Task |
|--------|--------|-----------------|
| SIMD speedup | 3-5x | TASK-047 |
| HNSW search P95 | <1ms | TASK-048 |
| Q-table lookup P95 | <1ms | TASK-049 |
| Full decision cycle | <50ms | TASK-050 |
| WASM binary (Brotli) | <500KB | TASK-051 |

---

## Cross-References

- **Technical Decisions Matrix (v1):** [technical-decisions-matrix.md](./technical-decisions-matrix.md)
- **Implementation Roadmap:** [implementation-roadmap.md](./implementation-roadmap.md)
- **Architecture:** [architecture.md](./architecture.md)
- **ADR Index:** [adr/README.md](./adr/README.md)
- **Claude-Flow Configuration:** Project CLAUDE.md

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0.0 | 2026-01-10 | Research Agent | Initial comprehensive matrix |
