# ADR-017: Cargo Workspace Structure

## Status
Accepted

## Context
The 593-agent neural system is a complex project with multiple concerns:

- **Core Logic:** Q-learning, state management, safe zones
- **SIMD Operations:** Vectorized numerical computations
- **WASM Bindings:** JavaScript interoperability
- **Runtime:** Agent lifecycle, deployment
- **Networking:** Federated learning, P2P communication
- **Knowledge Base:** Ericsson RAN feature database

A single crate approach would:
- Slow compilation (full rebuild for any change)
- Couple unrelated concerns
- Make feature flag management complex
- Prevent independent versioning
- Complicate testing strategies

Cargo workspaces provide multi-crate organization with shared dependencies and coordinated builds.

## Decision
We adopt a **Workspace with Domain-Aligned Crates** structure:

### 1. Workspace Layout

```
elex-agent/
├── Cargo.toml                    # Workspace root
├── Cargo.lock                    # Shared lockfile
├── rust-toolchain.toml           # Toolchain pinning
├── .cargo/
│   └── config.toml               # Build configuration
│
├── crates/
│   ├── elex-core/                # Core abstractions and traits
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── agent.rs          # Agent trait
│   │       ├── learning.rs       # Learning trait
│   │       ├── memory.rs         # Memory trait
│   │       └── error.rs          # Error types
│   │
│   ├── elex-q-learning/          # Q-learning implementation
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── q_table.rs
│   │       ├── engine.rs
│   │       └── policy.rs
│   │
│   ├── elex-simd/                # SIMD-accelerated operations
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── dot_product.rs
│   │       ├── normalize.rs
│   │       ├── distance.rs
│   │       └── fallback.rs       # Scalar fallbacks
│   │
│   ├── elex-wasm/                # WASM bindings (wasm-bindgen)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── agent.rs          # JS-exposed Agent
│   │       ├── config.rs         # JS-exposed Config
│   │       └── error.rs          # JS error conversion
│   │
│   ├── elex-memory/              # Memory and vector search
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── hnsw.rs           # HNSW index
│   │       ├── pool.rs           # Memory pools
│   │       └── cache.rs          # LRU cache
│   │
│   ├── elex-federated/           # Federated learning
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── merge.rs          # Q-table merging
│   │       ├── protocol.rs       # Sync protocol
│   │       └── transport.rs      # Network transport
│   │
│   ├── elex-knowledge/           # RAN feature knowledge
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── feature.rs        # Feature definitions
│   │       ├── parameter.rs      # Parameter bounds
│   │       ├── safe_zone.rs      # Safe zone constraints
│   │       └── ontology.rs       # Category hierarchy
│   │
│   ├── elex-runtime/             # Agent runtime
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── spawner.rs        # Agent spawning
│   │       ├── lifecycle.rs      # Lifecycle management
│   │       └── metrics.rs        # Runtime metrics
│   │
│   └── elex-persistence/         # Serialization and storage
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── bincode.rs        # Binary serialization
│           ├── compression.rs    # LZ4 compression
│           └── indexeddb.rs      # Browser storage
│
├── benches/                      # Workspace-level benchmarks
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
│
├── tests/                        # Integration tests
│   ├── Cargo.toml
│   └── src/
│       └── integration_tests.rs
│
└── examples/                     # Example applications
    ├── Cargo.toml
    └── src/
        └── basic_agent.rs
```

### 2. Workspace Cargo.toml

```toml
# Cargo.toml (workspace root)
[workspace]
resolver = "2"
members = [
    "crates/elex-core",
    "crates/elex-q-learning",
    "crates/elex-simd",
    "crates/elex-wasm",
    "crates/elex-memory",
    "crates/elex-federated",
    "crates/elex-knowledge",
    "crates/elex-runtime",
    "crates/elex-persistence",
    "benches",
    "tests",
    "examples",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
license = "MIT OR Apache-2.0"
repository = "https://github.com/org/elex-agent"
authors = ["ELEX Team"]

[workspace.dependencies]
# Internal crates
elex-core = { path = "crates/elex-core" }
elex-q-learning = { path = "crates/elex-q-learning" }
elex-simd = { path = "crates/elex-simd" }
elex-wasm = { path = "crates/elex-wasm" }
elex-memory = { path = "crates/elex-memory" }
elex-federated = { path = "crates/elex-federated" }
elex-knowledge = { path = "crates/elex-knowledge" }
elex-runtime = { path = "crates/elex-runtime" }
elex-persistence = { path = "crates/elex-persistence" }

# External dependencies (version-locked at workspace level)
thiserror = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
bincode = "1.3"
lz4 = "1.24"
tracing = "0.1"
tracing-subscriber = "0.3"
parking_lot = "0.12"

# WASM-specific
wasm-bindgen = "0.2"
serde-wasm-bindgen = "0.6"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }
console_error_panic_hook = "0.1"

# Testing
proptest = "1.4"
criterion = "0.5"
wasm-bindgen-test = "0.3"

[workspace.lints.rust]
unsafe_code = "warn"
unsafe_op_in_unsafe_fn = "deny"

[workspace.lints.clippy]
all = "warn"
pedantic = "warn"
undocumented_unsafe_blocks = "deny"
```

### 3. Individual Crate Configuration

```toml
# crates/elex-core/Cargo.toml
[package]
name = "elex-core"
version.workspace = true
edition.workspace = true
rust-version.workspace = true
license.workspace = true

[dependencies]
thiserror.workspace = true
serde = { workspace = true, optional = true }

[features]
default = []
serde = ["dep:serde"]

[lints]
workspace = true
```

```toml
# crates/elex-simd/Cargo.toml
[package]
name = "elex-simd"
version.workspace = true
edition.workspace = true

[dependencies]
elex-core.workspace = true

[features]
default = ["simd128"]
simd128 = []
scalar = []

[target.'cfg(target_arch = "wasm32")'.dependencies]
# WASM-specific optimizations

[lints]
workspace = true
```

```toml
# crates/elex-wasm/Cargo.toml
[package]
name = "elex-wasm"
version.workspace = true
edition.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
elex-core.workspace = true
elex-q-learning.workspace = true
elex-simd = { workspace = true, features = ["simd128"] }
elex-memory.workspace = true
elex-knowledge.workspace = true
elex-persistence.workspace = true

wasm-bindgen.workspace = true
serde-wasm-bindgen.workspace = true
js-sys.workspace = true
web-sys.workspace = true
console_error_panic_hook.workspace = true

[features]
default = ["console_error_panic_hook"]

[lints]
workspace = true
```

### 4. Feature Flags Strategy

```toml
# Feature flag categories

[features]
# Build target features
default = ["simd", "serde"]
simd = ["elex-simd/simd128"]
scalar = ["elex-simd/scalar"]
wasm = ["elex-wasm"]

# Serialization features
serde = [
    "elex-core/serde",
    "elex-q-learning/serde",
    "elex-memory/serde",
]

# Optional capabilities
federated = ["elex-federated"]
tracing = ["dep:tracing", "dep:tracing-subscriber"]
metrics = ["elex-runtime/metrics"]

# Development features
dev = ["tracing", "metrics"]
bench = ["criterion"]
proptest = ["dep:proptest"]
```

### 5. Build Optimization

```toml
# .cargo/config.toml
[build]
rustflags = ["-C", "link-arg=-s"]  # Strip symbols

[target.wasm32-unknown-unknown]
rustflags = [
    "-C", "target-feature=+simd128",
    "-C", "link-arg=-s",
]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true

[profile.release-wasm]
inherits = "release"
opt-level = "z"  # Optimize for size

[profile.bench]
inherits = "release"
debug = true  # Enable profiling

[profile.dev]
opt-level = 1  # Faster dev builds
```

### 6. Crate Dependency Graph

```
elex-wasm (public API)
    ├── elex-q-learning
    │   └── elex-core
    ├── elex-simd
    │   └── elex-core
    ├── elex-memory
    │   ├── elex-core
    │   └── elex-simd
    ├── elex-knowledge
    │   └── elex-core
    ├── elex-persistence
    │   └── elex-core
    └── elex-runtime
        ├── elex-core
        ├── elex-q-learning
        └── elex-memory

elex-federated (optional)
    ├── elex-core
    ├── elex-q-learning
    └── elex-persistence
```

### 7. Build Scripts

```bash
#!/bin/bash
# scripts/build-wasm.sh

set -e

# Build SIMD variant
echo "Building SIMD WASM..."
RUSTFLAGS='-C target-feature=+simd128' \
    wasm-pack build crates/elex-wasm \
    --target web \
    --out-dir ../../pkg-simd \
    -- --features simd

# Build scalar variant
echo "Building scalar WASM..."
wasm-pack build crates/elex-wasm \
    --target web \
    --out-dir ../../pkg-scalar \
    -- --features scalar

# Optimize with wasm-opt
echo "Optimizing..."
wasm-opt -O3 pkg-simd/elex_wasm_bg.wasm -o pkg-simd/elex_wasm_bg.wasm
wasm-opt -O3 pkg-scalar/elex_wasm_bg.wasm -o pkg-scalar/elex_wasm_bg.wasm

echo "Build complete!"
ls -lh pkg-simd/*.wasm pkg-scalar/*.wasm
```

### 8. Documentation Structure

```toml
# Generate documentation for all crates
# cargo doc --workspace --no-deps --open

# docs.rs configuration in each Cargo.toml
[package.metadata.docs.rs]
all-features = true
rustdoc-args = ["--cfg", "docsrs"]
targets = ["x86_64-unknown-linux-gnu", "wasm32-unknown-unknown"]
```

## Alternatives Considered

### Single Crate with Modules
- **Pros:** Simple structure, no inter-crate coordination
- **Cons:** Slow builds, tight coupling, complex features
- **Rejected:** Does not scale to this project size

### Fine-Grained Crates (One per Module)
- **Pros:** Maximum modularity, minimal rebuilds
- **Cons:** Dependency management overhead, versioning complexity
- **Rejected:** Over-engineering for current needs

### Separate Repositories
- **Pros:** Independent versioning, team ownership
- **Cons:** Cross-cutting changes require multi-repo PRs
- **Rejected:** Tight integration needs outweigh independence

### Cargo Virtual Manifest Only
- **Pros:** Simpler workspace Cargo.toml
- **Cons:** No shared dependencies, no workspace-level commands
- **Rejected:** Need dependency deduplication

## Consequences

### Positive
- **Fast Incremental Builds:** Change in elex-core doesn't rebuild elex-wasm
- **Clear Boundaries:** Each crate has explicit public API
- **Feature Isolation:** WASM-specific code only in elex-wasm
- **Dependency Deduplication:** Workspace ensures single versions
- **Independent Testing:** Each crate can be tested in isolation
- **Parallel Compilation:** Cargo builds independent crates in parallel

### Negative
- **Initial Complexity:** More files, more configuration
- **Version Coordination:** Breaking changes require careful updates
- **Path Dependencies:** Development requires local paths
- **IDE Support:** Some tools struggle with workspaces

### Risks
- **Circular Dependencies:** Must design API carefully
- **Feature Leakage:** Optional features may accidentally become required
- **Build Script Complexity:** WASM builds need custom scripting
- **Documentation Fragmentation:** Docs spread across crates

### Mitigations
- **Dependency Linting:** cargo-deny prevents circularity
- **Feature Testing:** CI tests with minimal and full features
- **Makefile Wrapper:** Simplify common build commands
- **docs.rs Integration:** Cross-link documentation

## References
- ADR-011: Rust Memory Model
- ADR-016: Testing Strategy
- Cargo Workspaces - https://doc.rust-lang.org/cargo/reference/workspaces.html
- wasm-pack - https://rustwasm.github.io/wasm-pack/
- cargo-deny - https://docs.rs/cargo-deny
- "Large Rust Workspaces" by Raph Levien
