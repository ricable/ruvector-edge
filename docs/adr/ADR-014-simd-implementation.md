# ADR-014: SIMD Implementation Strategy

## Status
Accepted

## Context
The 593-agent neural system performs intensive numerical computations:

- **Q-value Computation:** 64-dimensional dot products, thousands per second
- **State Normalization:** L2 normalization of state vectors
- **Distance Calculations:** Euclidean/cosine distance for HNSW search
- **Matrix Operations:** Q-table updates, federated averaging

Performance requirements:
- Q-table lookup: <1ms
- State encoding: <5ms
- Full decision cycle: <50ms

WebAssembly SIMD (simd128) provides 128-bit vector operations that can process 4 f32 values simultaneously, offering 3-8x speedup for numerical operations.

Browser support (as of 2024):
- Chrome 91+ (May 2021)
- Firefox 89+ (June 2021)
- Safari 16.4+ (March 2023)
- Edge 91+ (May 2021)
- Node.js 16+ (April 2021)

## Decision
We adopt **WASM SIMD128 with scalar fallback** for all vectorized operations:

### 1. Target Features Configuration

```toml
# .cargo/config.toml
[target.wasm32-unknown-unknown]
rustflags = ["-C", "target-feature=+simd128"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
```

```rust
// Crate-level feature gate
#![cfg_attr(target_arch = "wasm32", feature(stdarch_wasm32_simd128))]

// Module-level imports
#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;
```

### 2. Core SIMD Operations

```rust
use std::arch::wasm32::*;

/// Vectorized dot product for 64-dimensional vectors (16x unrolled)
#[target_feature(enable = "simd128")]
pub unsafe fn simd_dot_product_64(a: &[f32; 64], b: &[f32; 64]) -> f32 {
    let mut sum0 = f32x4_splat(0.0);
    let mut sum1 = f32x4_splat(0.0);
    let mut sum2 = f32x4_splat(0.0);
    let mut sum3 = f32x4_splat(0.0);

    // Process 16 elements per iteration (4 vectors of 4 floats)
    for i in (0..64).step_by(16) {
        let a0 = v128_load(a.as_ptr().add(i) as *const v128);
        let b0 = v128_load(b.as_ptr().add(i) as *const v128);
        sum0 = f32x4_add(sum0, f32x4_mul(a0, b0));

        let a1 = v128_load(a.as_ptr().add(i + 4) as *const v128);
        let b1 = v128_load(b.as_ptr().add(i + 4) as *const v128);
        sum1 = f32x4_add(sum1, f32x4_mul(a1, b1));

        let a2 = v128_load(a.as_ptr().add(i + 8) as *const v128);
        let b2 = v128_load(b.as_ptr().add(i + 8) as *const v128);
        sum2 = f32x4_add(sum2, f32x4_mul(a2, b2));

        let a3 = v128_load(a.as_ptr().add(i + 12) as *const v128);
        let b3 = v128_load(b.as_ptr().add(i + 12) as *const v128);
        sum3 = f32x4_add(sum3, f32x4_mul(a3, b3));
    }

    // Combine partial sums
    let sum01 = f32x4_add(sum0, sum1);
    let sum23 = f32x4_add(sum2, sum3);
    let sum = f32x4_add(sum01, sum23);

    // Horizontal sum
    f32x4_extract_lane::<0>(sum) +
    f32x4_extract_lane::<1>(sum) +
    f32x4_extract_lane::<2>(sum) +
    f32x4_extract_lane::<3>(sum)
}

/// Vectorized L2 normalization
#[target_feature(enable = "simd128")]
pub unsafe fn simd_normalize_64(v: &mut [f32; 64]) {
    // Compute squared magnitude
    let mut sum_sq = f32x4_splat(0.0);
    for i in (0..64).step_by(4) {
        let vec = v128_load(v.as_ptr().add(i) as *const v128);
        sum_sq = f32x4_add(sum_sq, f32x4_mul(vec, vec));
    }

    let mag_sq = f32x4_extract_lane::<0>(sum_sq) +
                 f32x4_extract_lane::<1>(sum_sq) +
                 f32x4_extract_lane::<2>(sum_sq) +
                 f32x4_extract_lane::<3>(sum_sq);

    let inv_mag = 1.0 / mag_sq.sqrt();
    let inv_mag_vec = f32x4_splat(inv_mag);

    // Normalize
    for i in (0..64).step_by(4) {
        let vec = v128_load(v.as_ptr().add(i) as *const v128);
        let normalized = f32x4_mul(vec, inv_mag_vec);
        v128_store(v.as_mut_ptr().add(i) as *mut v128, normalized);
    }
}

/// Vectorized Euclidean distance
#[target_feature(enable = "simd128")]
pub unsafe fn simd_euclidean_distance_64(a: &[f32; 64], b: &[f32; 64]) -> f32 {
    let mut sum = f32x4_splat(0.0);

    for i in (0..64).step_by(4) {
        let va = v128_load(a.as_ptr().add(i) as *const v128);
        let vb = v128_load(b.as_ptr().add(i) as *const v128);
        let diff = f32x4_sub(va, vb);
        sum = f32x4_add(sum, f32x4_mul(diff, diff));
    }

    let total = f32x4_extract_lane::<0>(sum) +
                f32x4_extract_lane::<1>(sum) +
                f32x4_extract_lane::<2>(sum) +
                f32x4_extract_lane::<3>(sum);

    total.sqrt()
}

/// Vectorized max finding (for Q-value argmax)
#[target_feature(enable = "simd128")]
pub unsafe fn simd_argmax(values: &[f32]) -> usize {
    if values.len() < 4 {
        return values.iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(i, _)| i)
            .unwrap_or(0);
    }

    let mut max_vals = v128_load(values.as_ptr() as *const v128);
    let mut max_idx = i32x4(0, 1, 2, 3);
    let increment = i32x4_splat(4);
    let mut current_idx = i32x4(4, 5, 6, 7);

    for i in (4..values.len()).step_by(4) {
        let vals = v128_load(values.as_ptr().add(i) as *const v128);
        let mask = f32x4_gt(vals, max_vals);
        max_vals = v128_bitselect(vals, max_vals, mask);
        max_idx = v128_bitselect(current_idx, max_idx, mask);
        current_idx = i32x4_add(current_idx, increment);
    }

    // Find max among 4 lanes
    let lane0 = f32x4_extract_lane::<0>(max_vals);
    let lane1 = f32x4_extract_lane::<1>(max_vals);
    let lane2 = f32x4_extract_lane::<2>(max_vals);
    let lane3 = f32x4_extract_lane::<3>(max_vals);

    let idx0 = i32x4_extract_lane::<0>(max_idx) as usize;
    let idx1 = i32x4_extract_lane::<1>(max_idx) as usize;
    let idx2 = i32x4_extract_lane::<2>(max_idx) as usize;
    let idx3 = i32x4_extract_lane::<3>(max_idx) as usize;

    let mut max_val = lane0;
    let mut max_index = idx0;

    if lane1 > max_val { max_val = lane1; max_index = idx1; }
    if lane2 > max_val { max_val = lane2; max_index = idx2; }
    if lane3 > max_val { max_index = idx3; }

    max_index
}
```

### 3. Scalar Fallback Implementation

```rust
/// Scalar dot product fallback
pub fn scalar_dot_product_64(a: &[f32; 64], b: &[f32; 64]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

/// Scalar L2 normalization fallback
pub fn scalar_normalize_64(v: &mut [f32; 64]) {
    let mag = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    let inv_mag = 1.0 / mag;
    for x in v.iter_mut() {
        *x *= inv_mag;
    }
}

/// Scalar Euclidean distance fallback
pub fn scalar_euclidean_distance_64(a: &[f32; 64], b: &[f32; 64]) -> f32 {
    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
}
```

### 4. Feature Detection and Dispatch

```rust
/// Runtime SIMD capability check
pub struct SimdCapability {
    pub simd128_available: bool,
}

impl SimdCapability {
    /// Detect SIMD support at runtime
    pub fn detect() -> Self {
        #[cfg(target_arch = "wasm32")]
        {
            // SIMD is compile-time feature in WASM; if compiled with simd128, it's available
            // Runtime check done via JavaScript before loading SIMD binary
            SimdCapability { simd128_available: true }
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            // Native: check CPU features
            SimdCapability {
                simd128_available: is_x86_feature_detected!("sse4.1"),
            }
        }
    }
}

/// Dispatch to appropriate implementation
pub struct VectorOps {
    use_simd: bool,
}

impl VectorOps {
    pub fn new(capability: &SimdCapability) -> Self {
        VectorOps { use_simd: capability.simd128_available }
    }

    pub fn dot_product(&self, a: &[f32; 64], b: &[f32; 64]) -> f32 {
        if self.use_simd {
            // SAFETY: SIMD capability verified in constructor
            unsafe { simd_dot_product_64(a, b) }
        } else {
            scalar_dot_product_64(a, b)
        }
    }

    pub fn normalize(&self, v: &mut [f32; 64]) {
        if self.use_simd {
            unsafe { simd_normalize_64(v) }
        } else {
            scalar_normalize_64(v)
        }
    }
}
```

### 5. JavaScript Feature Detection

```javascript
// Detect SIMD support before loading WASM
const simdSupported = (() => {
    try {
        // Test SIMD instruction encoding
        return WebAssembly.validate(new Uint8Array([
            0x00, 0x61, 0x73, 0x6d,  // WASM magic
            0x01, 0x00, 0x00, 0x00,  // Version 1
            0x01, 0x05, 0x01, 0x60,  // Type section
            0x00, 0x01, 0x7b,        // () -> v128
            0x03, 0x02, 0x01, 0x00,  // Function section
            0x0a, 0x0a, 0x01, 0x08,  // Code section
            0x00, 0xfd, 0x0c,        // v128.const
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x0b                     // end
        ]));
    } catch {
        return false;
    }
})();

// Load appropriate WASM binary
const wasmPath = simdSupported
    ? '/wasm/agent_simd.wasm'
    : '/wasm/agent_scalar.wasm';

const wasmModule = await WebAssembly.instantiateStreaming(fetch(wasmPath));
```

### 6. Build Configuration

```toml
# Cargo.toml
[features]
default = ["simd"]
simd = []
scalar = []

[lib]
crate-type = ["cdylib", "rlib"]

# Build script selects features
# build.rs or Makefile handles dual builds
```

```bash
# Build both variants
# SIMD build
RUSTFLAGS='-C target-feature=+simd128' \
  wasm-pack build --target web --out-dir pkg-simd -- --features simd

# Scalar build
wasm-pack build --target web --out-dir pkg-scalar -- --features scalar
```

### 7. Performance Requirements

| Operation | Scalar Target | SIMD Target | SIMD Speedup |
|-----------|---------------|-------------|--------------|
| dot_product_64 | <50us | <15us | 3-4x |
| normalize_64 | <30us | <10us | 3x |
| euclidean_64 | <40us | <12us | 3-4x |
| argmax (20 values) | <5us | <2us | 2-3x |
| Q-table lookup | <1ms | <300us | 3x |

## Alternatives Considered

### No SIMD (Scalar Only)
- **Pros:** Maximum compatibility, simpler code
- **Cons:** 3-8x slower, may not meet performance requirements
- **Rejected:** Performance requirements mandate vectorization

### WebGPU Compute Shaders
- **Pros:** Massive parallelism, GPU acceleration
- **Cons:** Limited browser support, high overhead for small operations
- **Rejected:** Q-table operations don't benefit from GPU parallelism

### SIMD.js (Deprecated)
- **Pros:** JavaScript-native SIMD
- **Cons:** Deprecated, removed from browsers
- **Rejected:** No longer available

### Relaxed SIMD (Future)
- **Pros:** More operations, better performance
- **Cons:** Not yet standardized, limited support
- **Deferred:** Will adopt when widely available

### Portable SIMD (std::simd)
- **Pros:** Portable across architectures
- **Cons:** Nightly-only, API unstable
- **Deferred:** Will migrate when stabilized

## Consequences

### Positive
- **Performance:** 3-8x speedup for vectorized operations
- **Battery Efficiency:** Less CPU time means lower power consumption
- **Scalability:** Can handle more agents per device
- **Broad Support:** 95%+ browser coverage with SIMD

### Negative
- **Dual Binaries:** Must build and deploy SIMD and scalar variants
- **Code Complexity:** Unsafe code for intrinsics
- **Testing Burden:** Must test both code paths
- **Debugging:** SIMD bugs harder to diagnose

### Risks
- **Browser Bugs:** SIMD implementations may have edge cases
- **Performance Variance:** Different engines have different SIMD performance
- **Feature Drift:** Future SIMD extensions may require code changes
- **Alignment Issues:** Unaligned access may cause performance penalties

### Mitigations
- **Comprehensive Testing:** Property tests compare SIMD vs scalar results
- **Benchmarking:** CI benchmarks across V8, SpiderMonkey, JavaScriptCore
- **Abstraction Layer:** VectorOps struct isolates SIMD details
- **Alignment Enforcement:** All vector data 16-byte aligned

## References
- ADR-012: Unsafe Rust Policy
- ADR-105: WASM SIMD Acceleration
- WebAssembly SIMD Proposal - https://github.com/WebAssembly/simd
- Rust std::arch::wasm32 - https://doc.rust-lang.org/std/arch/wasm32/
- Can I Use: WASM SIMD - https://caniuse.com/wasm-simd
- "Fast SIMD Dot Product in WebAssembly" - Performance benchmarks
