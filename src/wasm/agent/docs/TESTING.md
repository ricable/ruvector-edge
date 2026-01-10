# Testing Guide - ELEX Edge AI Agent WASM SDK

## Overview

This document describes the comprehensive testing strategy for the ELEX Edge AI Agent WASM SDK, following ADR-016. The test suite includes unit tests, integration tests, property-based tests, and benchmarks with 80%+ coverage targets.

## Test Structure

```
src/wasm/agent/
├── src/
│   ├── *_test.rs              # Unit tests (in each module)
├── tests/
│   ├── unit/                  # Pure Rust unit tests
│   ├── integration/           # WASM integration tests
│   ├── wasm/                  # wasm-bindgen-test tests
│   ├── property/              # Property-based tests (proptest)
│   └── fixtures/              # Test fixtures and data
├── benches/                   # Criterion benchmarks
└── Cargo.toml                 # Dev dependencies
```

## Running Tests

### Unit Tests (Native Rust)

```bash
# Run all unit tests
cargo test --lib

# Run specific test
cargo test test_q_table_creation

# Run with output
cargo test -- --nocapture

# Run tests in a module
cargo test q_learning_test
```

### WASM Integration Tests

```bash
# Install wasm-pack
cargo install wasm-pack

# Run tests in Firefox (headless)
wasm-pack test --firefox --headless

# Run tests in Chrome (headless)
wasm-pack test --chrome --headless

# Run tests in Node.js
wasm-pack test --node
```

### Property-Based Tests

```bash
# Run all property tests
cargo test --features proptest

# Run specific property test with more cases
cargo test prop_q_update_bounds -- --test-threads=1

# Run with custom configuration
PROPTEST_NUMBER_OF_TESTS=10000 cargo test --features proptest
```

### Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench q_table_lookup

# Run with custom settings
cargo bench -- --sample-size 1000 --warm-up-time 3 --measurement-time 10

# Generate plots (requires gnuplot)
cargo bench -- --plotting-backend gnuplot
```

## Coverage

### Generate Coverage Report

```bash
# Install cargo-llvm-cov
cargo install cargo-llvm-cov

# Generate coverage
cargo llvm-cov --lcov --output-path lcov.info

# Generate HTML report
cargo llvm-cov --html --output-dir coverage/html

# View in browser
open coverage/html/index.html
```

### Coverage Targets

| Module | Target | Current |
|--------|--------|---------|
| Q-Learning | 90% | - |
| SIMD Ops | 85% | - |
| Feature Agent | 90% | - |
| Crypto | 85% | - |
| **Overall** | **80%** | - |

## Test Fixtures

### Ericsson RAN Features

```rust
use tests::fixtures::iflb_feature;

let feature_config = iflb_feature();
let agent = FeatureAgent::new(feature_config)?;
```

Available fixtures:
- `iflb_feature()` - Inter-Frequency Load Balancing
- `duac_feature()` - Downlink User Association Control
- `mcpc_feature()` - Multi-Cell Power Control
- `anr_feature()` - Automatic Neighbor Relation
- `msm_feature()` - Mobility State Management
- `mimo_feature()` - MIMO Configuration
- `drx_feature()` - Discontinuous Reception

### Q-Table Test Vectors

```rust
use tests::fixtures::{create_prepopulated_q_table, bellman_test_cases};

let q_table = create_prepopulated_q_table();
let cases = bellman_test_cases();
```

### SIMD Test Vectors

```rust
use tests::fixtures::{
    create_test_vectors,
    create_orthogonal_vectors,
    validation_test_cases,
};
```

## Writing Tests

### Unit Test Example

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_something() {
        let result = function_under_test();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_with_floating_point() {
        let result = 0.1 + 0.2;
        assert!((result - 0.3).abs() < 0.001);
    }
}
```

### Property-Based Test Example

```rust
proptest! {
    #[test]
    fn prop_some_property(
        input1 in 0.0f32..100.0f32,
        input2 in 0.0f32..100.0f32,
    ) {
        let result = function_under_test(input1, input2);
        prop_assert!(result >= 0.0);
    }
}
```

### WASM Integration Test Example

```rust
#[wasm_bindgen_test]
fn test_agent_in_browser() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let result = agent.initialize();
    assert!(result.is_ok());
}
```

### Benchmark Example

```rust
fn bench_something(c: &mut Criterion) {
    c.bench_function("operation_name", |b| {
        b.iter(|| {
            black_box(function_under_test())
        })
    });
}
```

## Performance Targets

### Q-Learning

| Operation | Target | Fail Threshold |
|-----------|--------|----------------|
| Q-table creation | <100us | >500us |
| Q-table lookup | <1ms | >2ms |
| Q-table update | <500us | >1ms |
| Action selection | <500us | >1ms |
| Batch update (100) | <5ms | >15ms |

### SIMD Operations

| Operation | Target | Fail Threshold | Speedup |
|-----------|--------|----------------|---------|
| Cosine similarity (64) | <15us | >50us | 3-8x |
| Batch Q-update (100) | <1ms | >3ms | 2-4x |
| Validation (1000) | <100us | >300us | 4-8x |
| Aggregation (1000) | <200us | >600us | 3-6x |

### HNSW Search

| Index Size | Target | Fail Threshold |
|------------|--------|----------------|
| 100 vectors | <100us | >500us |
| 1K vectors | <1ms | >3ms |
| 10K vectors | <5ms | >15ms |
| 100K vectors | <50ms | >150ms |

## CI/CD Integration

The GitHub Actions workflow (`./.github/workflows/test.yml`) runs:

1. **Unit tests** - All Rust unit tests
2. **WASM tests** - Firefox and Chrome headless tests
3. **Property tests** - proptest with 1000 cases
4. **Benchmarks** - Performance validation
5. **Coverage** - Code coverage reporting

### Local CI Testing

```bash
# Run all checks locally
cargo test --lib
cargo test --features proptest
cargo clippy --all-targets
cargo fmt --all -- --check
```

## Debugging Tests

### Verbose Output

```bash
# Show test output
cargo test -- --nocapture

# Show detailed test execution
cargo test -- --show-output

# Enable logging
RUST_LOG=debug cargo test
```

### Run Single Test

```bash
# Run exact test
cargo test test_name

# Run tests matching pattern
cargo test test_pattern

# Run tests in file
cargo test --lib path::to::module::tests
```

### Debugging WASM Tests

```bash
# Run with browser console
wasm-pack test --firefox

# Check browser console for:
# - Panic messages
# - console.log output
# - WASM errors
```

## Common Issues

### WASM SIMD Not Detected

If SIMD tests fail, ensure:
- Rust target includes `+simd128` feature
- Browser supports WASM SIMD
- wasm-opt is disabled in Cargo.toml

### Floating-Point Comparison

Use epsilon tolerance for float comparisons:

```rust
const EPSILON: f32 = 1e-6;
assert!((a - b).abs() < EPSILON);
```

### Property Test Failures

When proptest fails, it will:
1. Show the failing input
2. Find minimal failing case
3. Provide seed for reproduction

```bash
# Replay specific failure
cargo test prop_test -- --exact 'prop_test' --seed <seed>
```

## Best Practices

1. **Write tests first** (TDD when applicable)
2. **Keep tests fast** - Unit tests should run in <100ms
3. **Test edge cases** - Empty, single element, max values
4. **Use fixtures** - Don't duplicate test data
5. **Test invariants** - Use property tests for properties
6. **Measure coverage** - Aim for 80%+ coverage
7. **Benchmark critical paths** - Validate performance
8. **Test WASM separately** - Browser tests for JS interop

## Resources

- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [wasm-bindgen-test](https://rustwasm.github.io/wasm-bindgen/wasm-bindgen-test/)
- [proptest](https://docs.rs/proptest)
- [Criterion](https://docs.rs/criterion)
- [ADR-016](../../docs/adr/ADR-016-testing-strategy.md)
