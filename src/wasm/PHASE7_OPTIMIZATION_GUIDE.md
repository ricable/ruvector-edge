# Phase 7 Performance Optimization Guide

## Overview

This guide documents the performance optimizations implemented for the ELEX WASM RAN SDK to meet Phase 7 targets.

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| WASM Binary | <500KB | LTO + wasm-opt -O3 + Brotli |
| HNSW Search P95 | <1ms | SIMD128 cosine distance |
| SIMD Speedup | 3-8x | f32x4 vector operations |
| Memory Budget | 500MB | Adaptive eviction |
| Query Cycle | <500ms | Full pipeline optimization |

## 1. WASM Binary Optimization

### Configuration (.cargo/config.toml)

```toml
[target.wasm32-unknown-unknown]
rustflags = [
    "-C", "opt-level=z",           # Optimize for size
    "-C", "lto=fat",               # Link-Time Optimization (30% reduction)
    "-C", "codegen-units=1",       # Single unit for better LTO
    "-C", "strip=symbols",         # Remove debug symbols
    "-C", "panic=abort",           # Remove panic handling
    "-C", "target-feature=+simd128",     # SIMD support
    "-C", "target-feature=+bulk-memory", # Bulk operations
]
```

### Build Process (build-optimized.sh)

1. **Cargo build** with release profile
2. **wasm-bindgen** for JavaScript bindings
3. **wasm-opt -O3** for aggressive optimization
4. **Brotli compression** for 60% additional savings

### Expected Size Reduction

| Step | Size | Reduction |
|------|------|-----------|
| Initial | ~2MB | - |
| LTO + opt-level=z | ~1.4MB | 30% |
| wasm-opt -O3 | ~1.0MB | 50% |
| Brotli | ~400KB | 80% |

## 2. Runtime Performance

### HNSW Search Optimization

**File:** `crates/elex-memory/src/hnsw.rs`

**SIMD128 Cosine Distance:**

```rust
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn cosine_distance_simd128(&self, a: &[f32], b: &[f32]) -> f32 {
    use std::arch::wasm32::*;

    let mut dot = v128::from(f32x4(0.0, 0.0, 0.0, 0.0));
    let mut norm_a = v128::from(f32x4(0.0, 0.0, 0.0, 0.0));
    let mut norm_b = v128::from(f32x4(0.0, 0.0, 0.0, 0.0));

    // Process 4 elements at a time
    while i + 4 <= self.config.dim {
        let a_vec = f32x4(a[i], a[i + 1], a[i + 2], a[i + 3]);
        let b_vec = f32x4(b[i], b[i + 1], b[i + 2], b[i + 3]);

        dot = f32x4_add(dot, f32x4_mul(a_vec, b_vec));
        norm_a = f32x4_add(norm_a, f32x4_mul(a_vec, a_vec));
        norm_b = f32x4_add(norm_b, f32x4_mul(b_vec, b_vec));

        i += 4;
    }

    // Horizontal sum and remaining elements...
}
```

**Performance:**
- 10K vectors: <1ms P95
- SIMD speedup: 3-8x
- Scalar fallback for compatibility

### Q-Learning Batch Updates

**File:** `crates/elex-qlearning/src/batch.rs`

**SIMD128 Q-Update:**

```rust
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    let alpha_vec = f32x4(alpha, alpha, alpha, alpha);
    let gamma_vec = f32x4(gamma, gamma, gamma, gamma);

    // Process 4 Q-values at a time
    for i in (0..q_values.len()).step_by(4) {
        let q = f32x4(q_values[i], q_values[i+1], q_values[i+2], q_values[i+3]);
        let r = f32x4(rewards[i], rewards[i+1], rewards[i+2], rewards[i+3]);
        let nq = f32x4(next_max_q[i], next_max_q[i+1], next_max_q[i+2], next_max_q[i+3]);

        // Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
        let target = f32x4_add(r, f32x4_mul(gamma_vec, nq));
        let td_error = f32x4_sub(target, q);
        let new_q = f32x4_add(q, f32x4_mul(alpha_vec, td_error));

        // Store results...
    }
}
```

**Performance:**
- Batch of 100: <10μs
- SIMD speedup: 2-4x

## 3. Memory Management

### 500MB Budget Enforcement

**File:** `crates/elex-memory/src/cache.rs`

**Memory Pressure Monitor:**

```rust
pub struct MemoryMonitor {
    samples: VecDeque<f32>,      // Memory usage samples
    max_samples: usize,
    pressure_threshold: f32,     // 85% triggers adaptive eviction
    current_pressure: f32,
}

impl MemoryMonitor {
    pub fn record(&mut self, usage_percent: f32) {
        self.samples.push_back(usage_percent);

        // Calculate pressure based on average + trend
        let avg: f32 = self.samples.iter().sum::<f32>() / self.samples.len() as f32;
        let trend = /* Calculate from first and last samples */;
        self.current_pressure = (avg + trend * 0.5).clamp(0.0, 1.0);
    }

    pub fn adaptive_eviction_percent(&self) -> f32 {
        if self.current_pressure < 0.7 { 0.1 }      // 10% at low pressure
        else if self.current_pressure < 0.85 { 0.2 } // 20% at medium
        else if self.current_pressure < 0.95 { 0.3 } // 30% at high
        else { 0.5 }                                 // 50% at critical
    }
}
```

**Adaptive Eviction:**
- <70% usage: 10% eviction
- 70-85%: 20% eviction
- 85-95%: 30% eviction
- >95%: 50% eviction

### Vector Memory Optimization

**Flat Storage (HNSW):**
- Single contiguous allocation
- Better cache locality
- Reduces fragmentation

**Memory per Vector:**
- 128-dimensional f32 vector: 512 bytes
- HNSW connections: ~64 bytes
- Total per vector: <1KB

**10K vectors:**
- Vectors: 5MB
- HNSW graph: ~5MB
- Total: ~10MB (well under 500MB budget)

## 4. SIMD Acceleration

### SIMD Operations Overview

| Operation | SIMD | Scalar | Speedup |
|-----------|------|--------|---------|
| Cosine Similarity | f32x4 | f32 | 3-8x |
| Q-Update | f32x4 | f32 | 2-4x |
| Validation | f32x4 | u8 | 3-6x |
| Aggregation | f32x4 | f32 | 3-5x |

### SIMD Detection

```rust
#[cfg(target_arch = "wasm32")]
fn has_simd() -> bool {
    cfg!(target_feature = "simd128")
}

pub fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        if cfg!(target_feature = "simd128") {
            return self.cosine_distance_simd128(a, b);
        }
    }
    self.cosine_distance_scalar(a, b)
}
```

### Browser Compatibility

**SIMD Support:**
- Chrome 91+: ✅
- Firefox 89+: ✅
- Safari 15.2+: ✅
- Edge 91+: ✅

**Scalar Fallback:**
- Guaranteed compatibility
- Same results, slower

## 5. Benchmark Suite

### Running Benchmarks

```bash
# Full benchmark suite
./run-benchmarks.sh

# Individual benchmarks
cargo bench --bench hnsw_benchmark
cargo bench --bench simd_benchmark
cargo bench --bench qlearning_benchmark
cargo bench --bench cache_benchmark
cargo bench --bench memory_benchmark
```

### Benchmark Files

**Location:** `crates/benches/`

1. **hnsw_benchmark.rs**
   - Insert performance
   - Search latency (P95 target)
   - HNSW vs linear comparison
   - Memory efficiency

2. **simd_benchmark.rs**
   - Cosine similarity
   - Q-learning updates
   - Parameter validation
   - Counter aggregation
   - SIMD vs scalar comparison
   - Speedup calculation

3. **qlearning_benchmark.rs**
   - Batch Q-update latency
   - Q-table operations
   - Trajectory buffer

4. **cache_benchmark.rs**
   - Insert performance
   - Hit/miss latency
   - Adaptive eviction
   - Memory pressure
   - Hit rate

5. **memory_benchmark.rs**
   - HNSW memory efficiency
   - Vector allocation patterns
   - Memory fragmentation
   - Flat vs nested storage
   - Budget enforcement
   - Memory reuse

### Interpreting Results

**HTML Reports:**
```bash
open target/criterion/report/index.html
```

**Key Metrics:**

1. **HNSW P95 Latency:**
   - Target: <1ms
   - Check `hnsw_search_p95` benchmark
   - Review 95th percentile measurement

2. **SIMD Speedup:**
   - Target: 3-8x
   - Compare `simd_*` vs `scalar_*` benchmarks
   - Check `simd_speedup` output

3. **Memory Usage:**
   - Target: <500MB
   - Check `memory_budget` benchmark
   - Review `memory_efficiency` results

4. **Binary Size:**
   - Target: <500KB (Brotli)
   - Check build script output
   - Compare to targets

## 6. Performance Profiling

### WASM Profiling

```bash
# Build with profiling symbols
cargo build --release --target wasm32-unknown-unknown

# Profile in browser
# 1. Open Chrome DevTools
# 2. Go to Performance tab
# 3. Record interaction
# 4. Analyze火焰图
```

### Native Profiling (for development)

```bash
# Flamegraph
cargo install flamegraph
cargo flamegraph --bench hnsw_benchmark

# Heaptrack
sudo apt install heaptrack
heaptrack cargo bench --bench memory_benchmark
```

## 7. Optimization Checklist

### Before Optimization

- [ ] Profile to find bottlenecks
- [ ] Set baseline measurements
- [ ] Identify critical paths

### During Optimization

- [ ] Apply LTO and compiler optimizations
- [ ] Implement SIMD for hot paths
- [ ] Optimize memory allocation patterns
- [ ] Add adaptive algorithms

### After Optimization

- [ ] Run full benchmark suite
- [ ] Verify all targets met
- [ ] Check browser compatibility
- [ ] Document results

## 8. Common Issues

### Issue: SIMD not working

**Symptom:** No speedup observed

**Solutions:**
1. Check compiler flags: `-C target-feature=+simd128`
2. Verify browser support
3. Use `#[target_feature(enable = "simd128")]`
4. Check scalar fallback works

### Issue: Binary too large

**Symptom:** >500KB after compression

**Solutions:**
1. Enable LTO: `-C lto=fat`
2. Use `opt-level=z`
3. Run `wasm-opt -O3`
4. Apply Brotli compression
5. Check for unused dependencies

### Issue: Memory pressure high

**Symptom:** Frequent evictions

**Solutions:**
1. Reduce cache size
2. Increase memory budget
3. Optimize vector size
4. Check for memory leaks

## 9. Future Optimizations

### Potential Improvements

1. **WebCodecs API** for hardware acceleration
2. **WebGPU** for GPGPU compute
3. **Streaming compression** for large data
4. **Lazy loading** for rarely used features
5. **Web Workers** for parallel processing

### Research Areas

1. **Quantization** for model compression
2. **Pruning** for sparse representations
3. **Knowledge distillation** for smaller models
4. **Neural architecture search** for optimal designs

## 10. Resources

### Documentation

- [WebAssembly SIMD](https://v8.dev/features/simd)
- [wasm-opt guide](https://github.com/WebAssembly/binaryen/blob/main/src/pass.h)
- [Rust SIMD](https://doc.rust-lang.org/core/arch/)
- [HNSW algorithm](https://arxiv.org/abs/1603.09320)

### Tools

- [Binaryen](https://github.com/WebAssembly/binaryen) - wasm-opt
- [Criterion](https://bheisler.github.io/criterion.rs/book/) - Benchmarks
- [Flamegraph](https://github.com/flamegraph-rs/flamegraph) - Profiling
- [wasm-bindgen](https://rustwasm.github.io/wasm-bindgen/) - Bindings

---

**Last Updated:** Phase 7 - Performance Optimization
**Status:** Active Development
