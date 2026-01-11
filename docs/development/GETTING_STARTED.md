# ELEX WASM RAN SDK - Getting Started Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Building WASM](#building-wasm)
4. [Running Benchmarks](#running-benchmarks)
5. [Testing in Browser](#testing-in-browser)
6. [Testing in Node.js](#testing-in-nodejs)
7. [Development Workflow](#development-workflow)
8. [Useful Commands](#useful-commands)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# Rust toolchain (with WASM target)
rustup install stable
rustup target add wasm32-unknown-unknown

# Node.js (for Node.js testing)
node --version  # v18+ recommended

# wasm-pack (for building WASM packages)
cargo install wasm-pack

# Binaryen (for wasm-opt optimization)
# macOS
brew install binaryen brotli

# Linux
sudo apt install binaryen brotli

# Verify installation
wasm-pack --version
wasm-opt --version
```

### Optional Tools

```bash
# Criterion benchmark visualizer
cargo install cargo-criterion

# HTTP server for browser testing
# Python 3 comes with built-in server
python3 --version

# or install a dedicated server
npm install -g http-server
```

---

## Quick Start

### 1. Clone and Navigate

```bash
cd /Users/cedric/dev/2026/test-cfv3/src/wasm
```

### 2. Build Optimized WASM

```bash
./build-optimized.sh
```

### 3. Run Benchmarks

```bash
./run-benchmarks.sh
```

### 4. View Results

```bash
# Open HTML benchmark reports
open target/criterion/report/index.html

# Or check text output
cat results/*.txt
```

---

## Building WASM

### Development Build (Fast)

```bash
# Quick build without optimizations
wasm-pack build --dev --target web

# Output: pkg-dev/ directory
# Size: ~5MB (unoptimized)
```

### Release Build (Optimized)

```bash
# Standard release build
wasm-pack build --release --target web

# Output: pkg/ directory
# Size: ~1.5MB
```

### Production Build (Fully Optimized)

```bash
# Use the provided build script
./build-optimized.sh

# This script:
# 1. Builds with LTO and optimizations
# 2. Runs wasm-bindgen for JavaScript bindings
# 3. Applies wasm-opt -O3 optimizations
# 4. Compresses with Brotli

# Expected output:
# - elex_wasm_bg.wasm      (~1MB)
# - elex_wasm_bg.wasm.br   (~400KB compressed)
```

### Build for Node.js

```bash
# Build specifically for Node.js
wasm-pack build --release --target nodejs --out-dir pkg-nodejs

# This produces CommonJS modules
```

### Build for Bundlers

```bash
# For webpack, rollup, etc.
wasm-pack build --release --target bundler --out-dir pkg-bundler

# This produces ES modules
```

---

## Running Benchmarks

### Full Benchmark Suite

```bash
# Run all benchmarks
./run-benchmarks.sh

# This runs:
# - HNSW search benchmarks
# - SIMD vs scalar comparisons
# - Q-learning benchmarks
# - Cache benchmarks
# - Memory benchmarks
```

### Individual Benchmarks

```bash
# HNSW performance
cargo bench --bench hnsw_benchmark

# SIMD acceleration
cargo bench --bench simd_benchmark

# Q-learning
cargo bench --bench qlearning_benchmark

# Cache performance
cargo bench --bench cache_benchmark

# Memory usage
cargo bench --bench memory_benchmark
```

### Benchmark Options

```bash
# Small sample size (faster)
cargo bench --bench hnsw_benchmark -- --sample-size 10

# Detailed output
cargo bench --bench hnsw_benchmark -- --nocapture

# Save baseline
cargo bench --bench hnsw_benchmark -- --save-baseline main

# Compare with baseline
cargo bench --bench hnsw_benchmark -- --baseline main
```

### HTML Reports

```bash
# Generate HTML report
cargo bench

# Open in browser
open target/criterion/report/index.html
# or
xdg-open target/criterion/report/index.html
```

---

## Testing in Browser

### 1. Start HTTP Server

```bash
# From the wasm directory
cd /Users/cedric/dev/2026/test-cfv3/src/wasm

# Using Python (built-in)
python3 -m http.server 8080 --directory pkg

# Using Node.js http-server
npx http-server pkg -p 8080

# Or the provided script
./serve-browser.sh
```

### 2. Create Test HTML

Create `pkg/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>ELEX WASM Test</title>
</head>
<body>
    <h1>ELEX WASM RAN SDK Test</h1>
    <div id="output"></div>

    <script type="module">
        import init, { ElexSwarm, QueryType, Complexity, isSimdAvailable } from './elex_wasm.js';

        async function run() {
            // Check SIMD support
            const simd = isSimdAvailable();
            document.getElementById('output').innerHTML += `<p>SIMD: ${simd}</p>`;

            // Initialize
            const wasm = await init();
            document.getElementById('output').innerHTML += `<p>WASM loaded!</p>`;

            // Create swarm
            const swarm = await new ElexSwarm({
                topology: 'hierarchical-mesh',
                maxAgents: 10,
                enableTelemetry: true
            });
            document.getElementById('output').innerHTML += `<p>Swarm initialized!</p>`;

            // Run query
            const response = await swarm.query({
                text: "Configure IFLB thresholds for load balancing",
                queryType: QueryType.Parameter,
                complexity: Complexity.Moderate
            });

            document.getElementById('output').innerHTML += `
                <p>Response: ${response.text}</p>
                <p>Confidence: ${response.confidence}</p>
                <p>Latency: ${response.latencyMs}ms</p>
                <p>Agent: ${response.agentId}</p>
            `;

            // Get stats
            const stats = await swarm.getSwarmStats();
            document.getElementById('output').innerHTML += `
                <h2>Swarm Stats</h2>
                <p>Total Queries: ${stats.totalQueries}</p>
                <p>Avg Latency: ${stats.avgLatencyMs}ms</p>
                <p>Memory: ${stats.memoryUsageMB}MB</p>
            `;
        }

        run().catch(console.error);
    </script>
</body>
</html>
```

### 3. Open Browser

```bash
# Navigate to
open http://localhost:8080

# Check browser console for:
# - SIMD support detection
# - WASM loading status
# - Query results
# - Performance metrics
```

### 4. Browser Compatibility

| Browser | SIMD | Minimum Version |
|---------|------|----------------|
| Chrome  | ✅   | 91+            |
| Firefox | ✅   | 89+            |
| Safari  | ✅   | 15.2+          |
| Edge    | ✅   | 91+            |

---

## Testing in Node.js

### 1. Build for Node.js

```bash
cd /Users/cedric/dev/2026/test-cfv3/src/wasm
wasm-pack build --release --target nodejs --out-dir pkg-nodejs
```

### 2. Create Test Script

Create `test-node.js`:

```javascript
const wasm = require('./pkg-nodejs/elex_wasm.js');
const { ElexSwarm, QueryType, Complexity, isSimdAvailable } = wasm;

async function test() {
    console.log('=== ELEX WASM Node.js Test ===\n');

    // Check SIMD
    console.log('SIMD Available:', isSimdAvailable());

    // Initialize WASM
    console.log('\nInitializing WASM...');
    await wasm.default();

    // Create swarm
    console.log('Creating swarm...');
    const swarm = await new ElexSwarm({
        topology: 'hierarchical-mesh',
        maxAgents: 50,
        enableTelemetry: true,
        enableIndexedDB: false  // Not available in Node.js
    });
    console.log('Swarm created!');

    // Run queries
    console.log('\nRunning queries...');
    const queries = [
        "Configure IFLB thresholds",
        "Optimize MIMO sleep mode",
        "Enable carrier aggregation",
        "Check LTE handover parameters"
    ];

    for (const q of queries) {
        const start = Date.now();
        const response = await swarm.query({
            text: q,
            queryType: QueryType.Parameter,
            complexity: Complexity.Moderate
        });
        const elapsed = Date.now() - start;

        console.log(`\nQuery: ${q}`);
        console.log(`  Response: ${response.text.substring(0, 50)}...`);
        console.log(`  Confidence: ${(response.confidence * 100).toFixed(1)}%`);
        console.log(`  Latency: ${response.latencyMs}ms`);
        console.log(`  Actual: ${elapsed}ms`);
        console.log(`  Agent: ${response.agentId}`);
    }

    // Get swarm stats
    console.log('\n=== Swarm Statistics ===');
    const stats = await swarm.getSwarmStats();
    console.log(`Total Agents: ${stats.totalAgents}`);
    console.log(`Active Agents: ${stats.activeAgents}`);
    console.log(`Total Queries: ${stats.totalQueries}`);
    console.log(`Avg Latency: ${stats.avgLatencyMs.toFixed(2)}ms`);
    console.log(`Memory Usage: ${stats.memoryUsageMB.toFixed(2)}MB`);
    console.log(`Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Uptime: ${(stats.uptimeMs / 1000).toFixed(2)}s`);

    // Cleanup
    await swarm.shutdown();
    console.log('\nTest complete!');
}

test().catch(console.error);
```

### 3. Run Test

```bash
node test-node.js
```

---

## Development Workflow

### Watch Mode for Development

```bash
# In one terminal - watch for changes and rebuild
cargo watch -x 'wasm-pack build --dev --target web'

# In another terminal - serve the files
python3 -m http.server 8080 --directory pkg
```

### Run Tests

```bash
# Run all tests
cargo test

# Run WASM-specific tests
cargo test --target wasm32-unknown-unknown

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_version
```

### Debugging

```bash
# Build with debug symbols
cargo build --target wasm32-unknown-unknown

# Use with Chrome DevTools
# 1. Load WASM in browser
# 2. Open DevTools > Sources > WebAssembly
# 3. Set breakpoints and inspect
```

### Linting

```bash
# Run clippy
cargo clippy --target wasm32-unknown-unknown

# Format code
cargo fmt

# Check formatting
cargo fmt --check
```

---

## Useful Commands

### Project Commands

```bash
# Navigate to project
cd /Users/cedric/dev/2026/test-cfv3/src/wasm

# Show workspace status
cargo tree
cargo metadata

# Check for updates
cargo outdated

# Clean build artifacts
cargo clean

# Clean and rebuild
cargo clean && ./build-optimized.sh
```

### Build Commands

```bash
# Quick dev build
wasm-pack build --dev --target web

# Release build
wasm-pack build --release --target web

# Node.js build
wasm-pack build --release --target nodejs

# Bundler build
wasm-pack build --release --target bundler

# Full production build
./build-optimized.sh
```

### Benchmark Commands

```bash
# All benchmarks
./run-benchmarks.sh

# Individual benchmark
cargo bench --bench hnsw_benchmark

# With custom options
cargo bench --bench simd_benchmark -- --sample-size 100 --nocapture

# Compare baselines
cargo bench --bench hnsw_benchmark -- --baseline main

# HTML report
cargo bench && open target/criterion/report/index.html
```

### Test Commands

```bash
# All tests
cargo test

# WASM tests
cargo test --target wasm32-unknown-unknown

# Specific test
cargo test test_query_processing

# With output
cargo test -- --nocapture

# Show test output
cargo test -- --show-output
```

### Server Commands

```bash
# Start browser server
python3 -m http.server 8080 --directory pkg

# Or with Node.js
npx http-server pkg -p 8080 -o

# Or with basic configuration
npx http-server pkg -p 8080 -c-1 --cors
```

### Inspection Commands

```bash
# Check WASM binary size
ls -lh pkg/*.wasm
ls -lh pkg/*.wasm.br

# Check binary details
wasm-objdump -h pkg/elex_wasm_bg.wasm

# Disassemble WASM
wasm-dis pkg/elex_wasm_bg.wasm -o output.wat

# Validate WASM
wasm-validate pkg/elex_wasm_bg.wasm

# Check dependencies
cargo tree
cargo tree --duplicates
```

### Monitoring Commands

```bash
# Watch file changes
cargo watch -x build

# Monitor with watchexec
watchexec -w src -w Cargo.toml cargo build

# Profile with flamegraph
cargo install flamegraph
cargo flamegraph --bench hnsw_benchmark
```

---

## Troubleshooting

### Build Errors

#### "wasm-pack not found"

```bash
cargo install wasm-pack
```

#### "wasm-opt not found"

```bash
# macOS
brew install binaryen

# Linux
sudo apt install binaryen

# Verify
wasm-opt --version
```

#### "target wasm32-unknown-unknown not found"

```bash
rustup target add wasm32-unknown-unknown
```

#### "Link error" or "undefined symbol"

```bash
# Clean and rebuild
cargo clean
cargo build --release --target wasm32-unknown-unknown
```

### Runtime Errors

#### "SIMD not available"

**Cause:** Browser doesn't support SIMD128

**Solution:** System automatically falls back to scalar. Verify with:
```javascript
const hasSIMD = WebAssembly.validate(
    new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])
);
console.log('SIMD supported:', hasSIMD);
```

#### "IndexedDB not available"

**Cause:** IndexedDB not available in current environment

**Solution:** Disable IndexedDB in config:
```javascript
const swarm = await new ElexSwarm({
    enableIndexedDB: false  // Use in-memory storage
});
```

#### "Memory budget exceeded"

**Cause:** Too many agents loaded

**Solution:** Reduce cache size or max agents:
```javascript
const swarm = await new ElexSwarm({
    maxAgents: 25,      // Reduce from 50
    cacheSizeMB: 25     // Reduce from 50
});
```

### Performance Issues

#### "Benchmarks too slow"

```bash
# Reduce sample size
cargo bench --bench hnsw_benchmark -- --sample-size 10

# Run specific benchmark only
cargo bench --bench hnsw_benchmark -- --bench-name hnsw_search
```

#### "Binary too large"

```bash
# Verify optimizations are enabled
cat .cargo/config.toml

# Check for unused dependencies
cargo tree

# Rebuild with full optimization
./build-optimized.sh
```

#### "SIMD speedup not observed"

**Checklist:**
- [ ] Compiler flags include `-C target-feature=+simd128`
- [ ] Using release build (`--release`)
- [ ] Browser supports SIMD (Chrome 91+, Firefox 89+, Safari 15.2+)
- [ ] SIMD detection working: `isSimdAvailable()` returns true

### Server Issues

#### "Port 8080 already in use"

```bash
# Use different port
python3 -m http.server 9000 --directory pkg

# Or kill existing process
lsof -ti:8080 | xargs kill -9
```

#### "CORS errors"

```bash
# Disable CORS for testing
npx http-server pkg -p 8080 -c-1 --cors
```

---

## Quick Reference Card

```bash
# === BUILD ===
./build-optimized.sh          # Full production build
wasm-pack build --dev --target web      # Quick dev build

# === BENCHMARK ===
./run-benchmarks.sh           # All benchmarks
cargo bench --bench hnsw_benchmark       # Individual

# === TEST ===
cargo test                    # All tests
cargo test --target wasm32-unknown-unknown  # WASM tests

# === SERVE ===
python3 -m http.server 8080 --directory pkg    # Browser
node test-node.js                        # Node.js

# === INSPECT ===
ls -lh pkg/*.wasm*            # Check binary size
cargo tree                    # Show dependencies
```

---

## Next Steps

1. **Build and verify:**
   ```bash
   ./build-optimized.sh
   ls -lh pkg/*.wasm.br
   ```

2. **Run benchmarks:**
   ```bash
   ./run-benchmarks.sh
   open target/criterion/report/index.html
   ```

3. **Test in browser:**
   ```bash
   python3 -m http.server 8080 --directory pkg
   open http://localhost:8080
   ```

4. **Test in Node.js:**
   ```bash
   wasm-pack build --release --target nodejs --out-dir pkg-nodejs
   node test-node.js
   ```

---

## Additional Resources

- **Project README:** `/Users/cedric/dev/2026/test-cfv3/README.md`
- **PRD:** `/Users/cedric/dev/2026/test-cfv3/docs/PRD.md`
- **Architecture:** `/Users/cedric/dev/2026/test-cfv3/src/wasm/PHASE8_ARCHITECTURE.md`
- **WASM Crate README:** `/Users/cedric/dev/2026/test-cfv3/src/wasm/crates/elex-wasm/README.md`

---

**Last Updated:** 2026-01-10
**Phase:** 7 - WASM SDK Implementation Complete ✅
