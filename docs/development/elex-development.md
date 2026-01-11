# ELEX Edge AI Agent Swarm - Development Guide

This guide provides practical development guidance for the ELEX Edge AI Agent Swarm repository.

## Quick Start Commands

### Build System
```bash
# Build TypeScript
bun run build

# Build WASM (from src/wasm)
cd src/wasm && ./build-optimized.sh

# Development mode
bun run dev

# Clean artifacts
bun run clean
```

### Testing
```bash
# Run all tests
bun test

# Specific test file
bun test path/to/test.spec.ts

# With coverage
bun run test:coverage

# WASM tests
cd src/wasm && cargo test --target wasm32-unknown-unknown

# Individual test
bun test --test-name-pattern "test name"
```

### Linting & Type Checking
```bash
# Lint
bun run lint

# Fix linting
bun run lint:fix

# Type check
bun run typecheck

# Format
bun run format
```

### WASM Development
```bash
# Dev build
wasm-pack build --dev --target web

# Release build
wasm-pack build --release --target web

# Node.js build
wasm-pack build --release --target nodejs

# Benchmarks
./run-benchmarks.sh
cargo bench --bench hnsw_benchmark
```

## Architecture Overview

**ELEX Edge AI Agent Swarm** - 593-agent distributed AI system for Ericsson RAN optimization using WASM + SIMD acceleration.

### Core Architecture
```
JavaScript/TypeScript Layer -> wasm-bindgen boundary -> WASM SDK Layer (Rust)
+-----------------------------------------------------------------------------+
| JS/TS: Agent Factory | Agent Runtime | Memory Manager (LRU, 500MB budget)   |
+---------+----------------+---------------------------+---------------------+
          |                |                           |
          | wasm-bindgen   |                           |
+---------+----------------+---------------------------+---------------------+
| Rust: Agent Registry (593) | SIMD Engine | Q-Learning Engine             |
|         |                       |              |                            |
| Core: Feature Agent | Query Processing | Validation | Monitoring           |
|         |                       |              |                            |
| Memory Pool | HNSW Index | Crypto (Ed25519, AES-256)                       |
+-----------------------------------------------------------------------------+
| WebAssembly Linear Memory (4GB max, 500MB budget)                            |
+-----------------------------------------------------------------------------+
```

### Key Components

| Component | Description |
|-----------|-------------|
| **Agent Registry** | 593 specialized agents, lazy loading, HNSW routing, topology management |
| **SIMD Engine** | 4x acceleration categories, 3-8x speedup, automatic fallback |
| **Q-Learning Engine** | Epsilon-Greedy policy, batch operations with SIMD, federated learning |
| **Memory Management** | Pre-allocated pools, LRU caching (50MB), HNSW indexing, 500MB budget |
| **Security Module** | Ed25519 signatures, AES-256-GCM encryption, agent authentication |

### Performance Targets
```
Vector similarity (128-dim): <100us (3-5x speedup)
Q-table batch updates (100 states): <10ms (2-4x speedup)
Parameter validation (1000 params): <5ms (4-8x speedup)
Counter aggregation (500 counters): <2ms (3-6x speedup)
Agent instantiation: <200ms
Query processing (end-to-end): <50ms
```

## Codebase Structure

### Root Directory
```
/
+-- .claude/          # Claude Flow V3 config/agents
+-- claude-flow-v3/  # Claude Flow V3 implementation
+-- dist/            # Build outputs
+-- docs/            # Documentation (PRD, ADRs, DDD)
+-- scripts/         # Utility scripts
+-- src/             # TypeScript source
|   +-- core/        # Core domain logic
|   +-- domains/     # DDD modules
|   +-- infrastructure/ # Infrastructure
|   +-- layers/      # Architectural layers
|   +-- security/    # Security modules
|   +-- shared/      # Shared utilities
|   +-- wasm/        # WASM integration
+-- tests/           # Test suites
+-- wasm/            # WASM build outputs
```

### WASM Module Structure
```
src/wasm/
+-- agent/           # Main WASM package
|   +-- src/         # Rust source
|   |   +-- lib.rs    # Main entry + exports
|   |   +-- simd_ops.rs
|   |   +-- feature_agent.rs
|   |   +-- q_learning.rs
|   |   +-- agent_registry.rs
|   +-- tests/       # Integration tests
|   +-- benches/     # Performance benchmarks
+-- hnsw/            # HNSW indexing module
```

## Development Workflow

### Common Tasks

**Adding Feature Agent**: 1) Add to registry, 2) Implement in Rust, 3) Expose via wasm-bindgen, 4) Add TS wrapper, 5) Write tests

**Development Server**:
```bash
# Terminal 1: TS watch
bun run dev

# Terminal 2: Serve WASM
cd src/wasm && python3 -m http.server 8080 --directory pkg
```

**Debugging WASM**:
```bash
# Build with debug symbols
cargo build --target wasm32-unknown-unknown

# Chrome DevTools: Sources > WebAssembly > Set breakpoints
```

**Performance Profiling**:
```bash
# Install flamegraph
cargo install flamegraph

# Profile benchmark
cargo flamegraph --bench hnsw_benchmark

# Analyze
open flamegraph.svg
```

## Testing Strategy

### Test Types
- **Unit tests**: Individual components (Rust & TypeScript)
- **Integration tests**: Module interactions
- **WASM tests**: WebAssembly functionality
- **Property tests**: Fuzz testing/edge cases
- **Benchmark tests**: Performance validation
- **Regression tests**: Docker-based end-to-end

### Test Commands
```bash
# All tests
bun test

# WASM tests
cd src/wasm && cargo test

# Detailed output
bun test --verbose

# Specific file
bun test tests/core/agent.test.ts

# Coverage
bun run test:coverage
```

## Build & Deployment

### Build Pipeline
```bash
# 1. Build TypeScript
bun run build

# 2. Build WASM
cd src/wasm && ./build-optimized.sh

# 3. Run tests
bun test

# 4. Generate coverage
bun run test:coverage

# 5. Package
bun run prepublishOnly
```

### WASM Build Options
```bash
# Dev (fast, unoptimized)
wasm-pack build --dev --target web

# Release (optimized)
wasm-pack build --release --target web

# Production (fully optimized)
./build-optimized.sh

# Different targets
wasm-pack build --release --target nodejs
wasm-pack build --release --target bundler
```

## Key Files & Entry Points

### Main Entry Points
- **TypeScript**: `src/index.ts`
- **WASM**: `src/wasm/agent/src/lib.rs`
- **Tests**: `tests/` directory
- **Benchmarks**: `src/wasm/agent/benches/`

### Configuration Files
- **TypeScript**: `tsconfig.json`
- **Rust**: `src/wasm/agent/Cargo.toml`
- **WASM**: `src/wasm/agent/.cargo/config.toml`
- **Bun**: `bunfig.toml`
- **Package**: `package.json`

### Documentation
- **PRD**: `docs/PRD.md`
- **Architecture**: `docs/architecture.md`
- **ADRs**: `docs/adr/`
- **DDD**: `docs/ddd/`
- **WASM Architecture**: `src/wasm/PHASE8_ARCHITECTURE.md`

## Best Practices

### Working with WASM
1. Check SIMD availability before using accelerated functions
2. Use wasm-bindgen for JavaScript interop
3. Prefer pre-allocated memory for performance-critical operations
4. Test in both browser and Node.js environments
5. Monitor memory usage - 500MB budget strictly enforced

### TypeScript Development
1. Follow domain-driven design patterns
2. Use dependency injection for testability
3. Write property-based tests for critical logic
4. Document public APIs with JSDoc comments
5. Keep bundle size in mind for edge deployment

### Performance Optimization
1. Profile before optimizing - use flamegraph/benchmarks
2. Use SIMD for vector operations when possible
3. Minimize memory allocations in hot paths
4. Cache frequently accessed agents/data
5. Batch operations where possible

## Troubleshooting

### WASM Build Problems
```bash
# wasm-pack not found
cargo install wasm-pack

# wasm-opt not found
brew install binaryen  # macOS
sudo apt install binaryen  # Linux

# target wasm32-unknown-unknown not found
rustup target add wasm32-unknown-unknown
```

### SIMD Issues
```javascript
// Check SIMD support
const hasSIMD = isSimdAvailable();
console.log('SIMD supported:', hasSIMD);
// Auto-fallback to scalar operations
```

### Memory Budget Problems
```javascript
// Reduce cache/agents
const swarm = await new ElexSwarm({
    maxAgents: 25,      // Reduced from 50
    cacheSizeMB: 25     // Reduced from 50
});
```

### Browser Compatibility
```bash
# Different port
python3 -m http.server 9000 --directory pkg

# Disable CORS
npx http-server pkg -p 8080 -c-1 --cors
```

## Resources

### Tools
- **Bun**: Fast JavaScript runtime/package manager
- **wasm-pack**: WebAssembly packaging tool
- **wasm-opt**: Binaryen optimizer for WASM
- **cargo**: Rust package manager/build system
- **vitest**: Testing framework
- **eslint**: JavaScript/TypeScript linter

### Related Documentation
- **Getting Started**: `GETTING_STARTED.md`
- **Phase 8 Architecture**: `src/wasm/PHASE8_ARCHITECTURE.md`
- **System Architecture**: `docs/architecture.md`
- **Product Requirements**: `docs/PRD.md`
