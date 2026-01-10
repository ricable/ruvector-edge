# ADR-105: WASM SIMD Acceleration for Edge Deployment

## Status
Accepted

## Context
The 593-agent neural system must operate efficiently on edge devices including:

- **Web Browsers:** Chrome, Firefox, Safari, Edge
- **Mobile Devices:** iOS Safari, Android Chrome
- **Edge Servers:** Linux containers, ARM processors
- **Embedded Systems:** Network equipment with limited resources

Performance requirements:
- Q-table lookup: <1ms
- State encoding: <5ms
- Action selection: <10ms
- Full decision cycle: <50ms

Resource constraints:
- Binary size: <1MB per agent
- Memory usage: <10MB per agent
- CPU: Single core operation
- No GPU dependency

Native code would provide optimal performance but cannot run in browsers. JavaScript provides portability but insufficient performance. WebAssembly bridges this gap with near-native performance and universal deployment.

## Decision
We adopt **Rust-compiled WebAssembly with SIMD128** for all 593 feature agents:

### Compilation Target
```toml
# Cargo.toml
[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"

[target.wasm32-unknown-unknown]
rustflags = ["-C", "target-feature=+simd128"]
```

### SIMD Operations
```rust
use std::arch::wasm32::*;

// Vectorized Q-value computation
#[target_feature(enable = "simd128")]
pub fn compute_q_values(state: &[f32; 64], weights: &[f32; 64]) -> f32 {
    let mut sum = f32x4_splat(0.0);
    for i in (0..64).step_by(4) {
        let s = v128_load(&state[i] as *const f32 as *const v128);
        let w = v128_load(&weights[i] as *const f32 as *const v128);
        sum = f32x4_add(sum, f32x4_mul(s, w));
    }
    f32x4_extract_lane::<0>(sum) + f32x4_extract_lane::<1>(sum) +
    f32x4_extract_lane::<2>(sum) + f32x4_extract_lane::<3>(sum)
}

// Vectorized state normalization
#[target_feature(enable = "simd128")]
pub fn normalize_state(state: &mut [f32; 64]) {
    let mut sum_sq = f32x4_splat(0.0);
    for i in (0..64).step_by(4) {
        let v = v128_load(&state[i] as *const f32 as *const v128);
        sum_sq = f32x4_add(sum_sq, f32x4_mul(v, v));
    }
    let magnitude = f32x4_sqrt(sum_sq);
    // ... normalize by magnitude
}
```

### Binary Optimization
| Optimization | Size Reduction |
|--------------|----------------|
| LTO (Link-Time Optimization) | -30% |
| wasm-opt -O3 | -15% |
| Compression (brotli) | -60% |
| **Final size** | **~500KB** |

### Runtime Integration
```javascript
// Browser/Node.js loading
const wasmModule = await WebAssembly.instantiateStreaming(
    fetch('feature_agent.wasm'),
    {
        env: {
            memory: new WebAssembly.Memory({ initial: 256, maximum: 1024 }),
            // ... imports
        }
    }
);

const agent = wasmModule.instance.exports;
const action = agent.select_action(statePtr, stateLen);
```

### Feature Detection and Fallback
```javascript
const simdSupported = WebAssembly.validate(new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
    0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
    0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x0b
]));

const wasmPath = simdSupported
    ? 'feature_agent_simd.wasm'
    : 'feature_agent_scalar.wasm';
```

## Alternatives Considered

### Pure JavaScript
- **Pros:** Maximum portability, no compilation step, easy debugging
- **Cons:** 10-50x slower than WASM, high memory overhead, GC pauses
- **Rejected:** Performance insufficient for real-time decisions

### Native Binaries (Rust/C++)
- **Pros:** Maximum performance, full hardware access
- **Cons:** No browser support, platform-specific compilation
- **Rejected:** Cannot meet browser deployment requirement

### WebAssembly without SIMD
- **Pros:** Wider browser support, simpler compilation
- **Cons:** 3-8x slower than SIMD version
- **Analysis:** Fallback provided for older browsers
- **Partial:** Used as fallback, not primary target

### AssemblyScript (TypeScript to WASM)
- **Pros:** TypeScript syntax, easier for web developers
- **Cons:** Less mature, fewer optimizations, no SIMD support
- **Rejected:** Performance gap and missing SIMD

### WebGPU/WebGL Compute
- **Pros:** Massive parallelism, GPU acceleration
- **Cons:** Complex API, not suitable for small workloads, battery impact
- **Rejected:** Q-table operations don't benefit from GPU parallelism

### Emscripten (C/C++ to WASM)
- **Pros:** Mature toolchain, large ecosystem
- **Cons:** Larger binaries, complex build, less memory-safe
- **Rejected:** Rust provides better safety and similar performance

## Consequences

### Positive
- **Performance:** 3-8x speedup via SIMD vectorization
- **Portability:** Single binary runs on browser, Node.js, Deno, edge
- **Size Efficiency:** ~500KB per agent after optimization
- **Memory Safety:** Rust prevents buffer overflows and memory leaks
- **Deterministic:** No GC pauses, predictable execution time
- **Security:** WASM sandbox prevents host system access

### Negative
- **Compilation Complexity:** Rust + WASM + SIMD toolchain required
- **Debugging Difficulty:** Source maps imperfect, stack traces obscured
- **Browser Variance:** SIMD support varies (Chrome 91+, Firefox 89+, Safari 16.4+)
- **Cold Start:** WASM compilation adds ~100ms initial delay

### Risks
- **SIMD Support Gaps:** Some browsers/devices lack SIMD support
- **Memory Limits:** WASM linear memory capped at 4GB (sufficient for our use)
- **Toolchain Instability:** wasm-bindgen and wasm-pack evolving rapidly
- **Performance Variance:** Different WASM runtimes have different performance

### Mitigations
- **Graceful Fallback:** Scalar WASM binary for non-SIMD environments
- **Memory Pooling:** Pre-allocated memory to avoid growth overhead
- **Version Pinning:** Lock toolchain versions in CI/CD
- **Runtime Testing:** Benchmark across V8, SpiderMonkey, JavaScriptCore

## References
- ADR-101: Neural Agent Architecture
- WebAssembly SIMD Specification: https://github.com/WebAssembly/simd
- Rust WASM Book: https://rustwasm.github.io/docs/book/
- wasm-bindgen: https://rustwasm.github.io/wasm-bindgen/
- Browser SIMD Support: https://caniuse.com/wasm-simd
- Benchmark: "WebAssembly SIMD performance analysis" (2023)
