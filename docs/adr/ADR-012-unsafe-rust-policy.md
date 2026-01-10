# ADR-012: Unsafe Rust Policy

## Status
Accepted

## Context
The 593-agent neural system requires maximum performance for critical operations:

- **SIMD Intrinsics:** Vectorized Q-value computation requires `std::arch` intrinsics
- **FFI Boundaries:** WASM-JavaScript interop requires raw pointer handling
- **Memory Operations:** Bulk memory operations benefit from unchecked access
- **Performance Critical Paths:** Q-table lookup, state encoding, HNSW search

Rust's `unsafe` keyword enables operations that the compiler cannot verify as safe:
- Dereferencing raw pointers
- Calling unsafe functions (including FFI)
- Accessing mutable statics
- Implementing unsafe traits
- Accessing union fields

Unrestricted unsafe usage undermines Rust's safety guarantees. A clear policy ensures unsafe code is used appropriately, reviewed thoroughly, and tested rigorously.

## Decision
We adopt a **Restricted Unsafe Policy** with the following requirements:

### 1. Acceptable Uses of Unsafe

| Category | Allowed | Example |
|----------|---------|---------|
| SIMD Intrinsics | Yes | `std::arch::wasm32::f32x4_add` |
| wasm-bindgen FFI | Yes | `#[wasm_bindgen]` generated code |
| Unchecked Indexing | Conditional | `slice.get_unchecked(i)` with bounds proof |
| Raw Pointer Arithmetic | Conditional | Memory pool implementation |
| Inline Assembly | No | Not supported in WASM |
| Mutable Statics | No | Use thread-local or atomic instead |

### 2. Unsafe Code Requirements

Every `unsafe` block must satisfy:

```rust
// SAFETY: Document the invariants that make this safe
// 1. What preconditions must hold?
// 2. Why are those preconditions guaranteed?
// 3. What postconditions does this establish?
unsafe {
    // ... unsafe code ...
}
```

**Example:**
```rust
/// Compute dot product using SIMD (4x speedup)
#[target_feature(enable = "simd128")]
pub fn simd_dot_product(a: &[f32; 64], b: &[f32; 64]) -> f32 {
    let mut sum = f32x4_splat(0.0);

    for i in (0..64).step_by(4) {
        // SAFETY: Loop bounds guarantee i+3 < 64, so indices are valid.
        // Arrays are aligned and sized for v128 loads (64 * 4 = 256 bytes, 16-byte aligned).
        unsafe {
            let va = v128_load(a.as_ptr().add(i) as *const v128);
            let vb = v128_load(b.as_ptr().add(i) as *const v128);
            sum = f32x4_add(sum, f32x4_mul(va, vb));
        }
    }

    // Extract and sum lanes
    f32x4_extract_lane::<0>(sum) + f32x4_extract_lane::<1>(sum) +
    f32x4_extract_lane::<2>(sum) + f32x4_extract_lane::<3>(sum)
}
```

### 3. Review Requirements

| Unsafe Category | Review Level | Required Reviewers |
|-----------------|--------------|-------------------|
| SIMD Intrinsics | Standard | 1 Rust expert |
| FFI Boundary | Enhanced | 2 reviewers + security |
| Unchecked Access | Enhanced | 1 Rust expert + proof review |
| New Unsafe Abstractions | Critical | 2 Rust experts + architect |

**Enhanced Review Checklist:**
- [ ] Safety invariants documented
- [ ] Preconditions verified at call sites
- [ ] No undefined behavior possible
- [ ] Miri testing passes
- [ ] Fuzz testing performed (where applicable)

### 4. Miri Testing Requirements

All unsafe code must pass Miri analysis:

```bash
# Run Miri on all tests
cargo +nightly miri test

# Run Miri with strict flags
MIRIFLAGS="-Zmiri-symbolic-alignment-check -Zmiri-strict-provenance" \
  cargo +nightly miri test
```

**Miri Detects:**
- Out-of-bounds memory access
- Use of uninitialized memory
- Invalid pointer use
- Data races (with threads)
- Memory leaks

### 5. Safe Abstraction Pattern

Unsafe operations must be encapsulated in safe abstractions:

```rust
/// Safe wrapper around unchecked Q-table access
pub struct QTableView<'a> {
    data: &'a [f32],
    state_size: usize,
    action_count: usize,
}

impl<'a> QTableView<'a> {
    /// Get Q-value with bounds checking
    pub fn get(&self, state: usize, action: usize) -> Option<f32> {
        if state < self.state_size && action < self.action_count {
            // SAFETY: Bounds checked above, index is valid
            Some(unsafe { *self.data.get_unchecked(state * self.action_count + action) })
        } else {
            None
        }
    }

    /// Get Q-value without bounds checking
    ///
    /// # Safety
    /// Caller must ensure state < state_size and action < action_count
    pub unsafe fn get_unchecked(&self, state: usize, action: usize) -> f32 {
        *self.data.get_unchecked(state * self.action_count + action)
    }
}
```

### 6. Documentation Requirements

Unsafe functions must document:

```rust
/// Perform bulk memory copy without bounds checking
///
/// # Safety
///
/// - `src` must be valid for reads of `len * size_of::<T>()` bytes
/// - `dst` must be valid for writes of `len * size_of::<T>()` bytes
/// - `src` and `dst` must not overlap
/// - `src` and `dst` must be properly aligned for type T
///
/// # Panics
///
/// This function does not panic (undefined behavior on violation instead)
///
/// # Examples
///
/// ```rust
/// let src = [1.0f32, 2.0, 3.0, 4.0];
/// let mut dst = [0.0f32; 4];
///
/// // SAFETY: src and dst are same size, non-overlapping, aligned
/// unsafe { bulk_copy(src.as_ptr(), dst.as_mut_ptr(), 4) };
/// ```
pub unsafe fn bulk_copy<T: Copy>(src: *const T, dst: *mut T, len: usize) {
    std::ptr::copy_nonoverlapping(src, dst, len);
}
```

### 7. Forbidden Patterns

The following patterns are **prohibited**:

```rust
// FORBIDDEN: Mutable statics (use atomics or thread-local)
static mut GLOBAL_STATE: u32 = 0;

// FORBIDDEN: Transmute between unrelated types
let x: u32 = unsafe { std::mem::transmute(1.0f32) }; // Use to_bits() instead

// FORBIDDEN: Unbounded lifetime extension
fn extend_lifetime<'a, 'b>(x: &'a str) -> &'b str {
    unsafe { std::mem::transmute(x) }
}

// FORBIDDEN: Dereferencing user-provided pointers without validation
pub fn process(ptr: *const u8) {
    unsafe { *ptr }; // No validation!
}
```

### 8. Clippy Configuration

Enable unsafe-related lints:

```toml
# Cargo.toml or .cargo/config.toml
[lints.rust]
unsafe_code = "warn"              # Warn on all unsafe
unsafe_op_in_unsafe_fn = "deny"   # Require unsafe blocks even in unsafe fn

[lints.clippy]
undocumented_unsafe_blocks = "deny"
multiple_unsafe_ops_per_block = "warn"
ptr_as_ptr = "warn"
transmute_ptr_to_ref = "deny"
```

## Alternatives Considered

### No Unsafe Allowed
- **Pros:** Maximum safety, no UB possible
- **Cons:** Cannot use SIMD intrinsics, significant performance loss
- **Rejected:** Performance requirements mandate SIMD; 3-8x slowdown unacceptable

### Unrestricted Unsafe
- **Pros:** Developer freedom, maximum performance potential
- **Cons:** Safety guarantees undermined, increased bug risk
- **Rejected:** Safety is a core value; discipline required

### Unsafe Only in Separate Crates
- **Pros:** Clear boundary, easier auditing
- **Cons:** Overhead of crate boundaries, API complexity
- **Partial:** SIMD operations in dedicated `simd` crate

### Third-Party Unsafe Wrappers Only
- **Pros:** Leverage audited code, reduce in-house unsafe
- **Cons:** Dependency on external maintenance, potential version conflicts
- **Partial:** Use `bytemuck` for safe transmutes, `safe-arch` where available

## Consequences

### Positive
- **Controlled Risk:** Unsafe usage is deliberate, documented, reviewed
- **Performance:** Critical paths achieve near-C performance
- **Auditability:** Safety invariants documented for security review
- **Tooling:** Miri catches UB before production

### Negative
- **Review Overhead:** Enhanced reviews slow development
- **Documentation Burden:** Every unsafe block requires justification
- **Miri Limitations:** Miri cannot test WASM-specific intrinsics
- **Learning Curve:** Team must understand unsafe semantics

### Risks
- **Undiscovered UB:** Miri may miss edge cases
- **Safety Invariant Violations:** Callers may violate documented preconditions
- **Toolchain Bugs:** Compiler bugs may introduce UB
- **Evolution Risk:** Safe code changes may invalidate unsafe assumptions

### Mitigations
- **Fuzz Testing:** cargo-fuzz on unsafe boundaries
- **Property Testing:** proptest for invariant validation
- **Compiler Updates:** Track Rust release notes for soundness fixes
- **Periodic Audits:** Quarterly unsafe code review

## References
- ADR-011: Rust Memory Model
- ADR-014: SIMD Implementation
- Rustonomicon: Unsafe Rust - https://doc.rust-lang.org/nomicon/
- Miri: Undefined Behavior Detector - https://github.com/rust-lang/miri
- Clippy Unsafe Lints - https://rust-lang.github.io/rust-clippy/master/
- "Learn Rust With Entirely Too Many Linked Lists" - https://rust-unofficial.github.io/too-many-lists/
