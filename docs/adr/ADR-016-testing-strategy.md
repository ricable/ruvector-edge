# ADR-016: Testing Strategy for Rust/WASM Agent System

## Status
Accepted

## Context
The 593-agent neural system requires comprehensive testing across multiple layers:

- **Rust Core Logic:** Q-learning algorithms, state management, SIMD operations
- **WASM Runtime:** Browser compatibility, memory management, performance
- **JavaScript Integration:** wasm-bindgen boundaries, TypeScript types
- **Distributed Behavior:** Federated learning, consensus protocols

Testing challenges:
- WASM cannot run directly in Rust test harness
- Browser tests require different tooling than unit tests
- SIMD code paths differ from scalar fallbacks
- Performance requirements need benchmarks, not just correctness
- Floating-point comparisons need epsilon tolerance
- Property-based testing reveals edge cases unit tests miss

## Decision
We adopt a **Multi-Layer Testing Strategy** with specialized tools per layer:

### 1. Unit Test Organization

```
tests/
├── unit/                    # Pure Rust unit tests
│   ├── q_learning_tests.rs
│   ├── state_encoding_tests.rs
│   ├── memory_pool_tests.rs
│   └── mod.rs
├── integration/             # Cross-module integration
│   ├── agent_lifecycle_tests.rs
│   ├── federated_sync_tests.rs
│   └── mod.rs
├── wasm/                    # wasm-bindgen-test tests
│   ├── browser_tests.rs
│   ├── memory_tests.rs
│   └── mod.rs
├── property/                # Property-based tests
│   ├── q_table_properties.rs
│   ├── simd_equivalence.rs
│   └── mod.rs
└── benches/                 # Criterion benchmarks
    ├── q_learning_bench.rs
    ├── simd_bench.rs
    └── hnsw_bench.rs
```

### 2. Unit Tests (Native Rust)

```rust
// tests/unit/q_learning_tests.rs
use elex_agent::{QTable, QLearningEngine, State, Action};

#[cfg(test)]
mod q_learning_tests {
    use super::*;

    const EPSILON: f64 = 1e-10;

    fn assert_float_eq(a: f64, b: f64) {
        assert!((a - b).abs() < EPSILON, "Expected {}, got {}", b, a);
    }

    #[test]
    fn test_q_table_initialization() {
        let table = QTable::new(64, 10);
        assert_eq!(table.state_count(), 64);
        assert_eq!(table.action_count(), 10);

        // All Q-values should be initialized to zero
        for s in 0..64 {
            for a in 0..10 {
                assert_float_eq(table.get(s, a), 0.0);
            }
        }
    }

    #[test]
    fn test_q_update_bellman() {
        let mut engine = QLearningEngine::new(
            learning_rate: 0.1,
            discount_factor: 0.95,
        );

        // Initial state: Q(s, a) = 0
        let s = State::new([0.0; 64]);
        let a = Action::new(0);
        let r = 1.0;
        let s_prime = State::new([1.0; 64]);

        // Q(s, a) = Q(s, a) + alpha * (r + gamma * max_a' Q(s', a') - Q(s, a))
        // Q(s, a) = 0 + 0.1 * (1.0 + 0.95 * 0 - 0) = 0.1
        engine.update(&s, &a, r, &s_prime);

        assert_float_eq(engine.get_q_value(&s, &a), 0.1);
    }

    #[test]
    fn test_epsilon_greedy_exploration() {
        let mut engine = QLearningEngine::new(
            learning_rate: 0.1,
            discount_factor: 0.95,
        );
        engine.set_exploration_rate(1.0); // Always explore

        let state = State::new([0.5; 64]);
        let mut action_counts = [0u32; 10];

        // With epsilon = 1.0, should sample uniformly
        for _ in 0..10000 {
            let action = engine.select_action(&state);
            action_counts[action.id()] += 1;
        }

        // Each action should be selected roughly 1000 times
        for count in action_counts.iter() {
            assert!(*count > 800 && *count < 1200,
                "Expected ~1000, got {}", count);
        }
    }

    #[test]
    fn test_safe_zone_enforcement() {
        let safe_zone = SafeZone {
            min: 0.0,
            max: 100.0,
            default: 50.0,
        };

        assert!(safe_zone.validate(50.0).is_ok());
        assert!(safe_zone.validate(0.0).is_ok());
        assert!(safe_zone.validate(100.0).is_ok());

        assert!(safe_zone.validate(-0.1).is_err());
        assert!(safe_zone.validate(100.1).is_err());
    }
}
```

### 3. wasm-bindgen-test for Browser Tests

```rust
// tests/wasm/browser_tests.rs
use wasm_bindgen_test::*;
use elex_agent::Agent;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_agent_creation_in_browser() {
    let config = serde_wasm_bindgen::to_value(&AgentConfig {
        learning_rate: 0.1,
        discount_factor: 0.95,
        exploration_rate: 0.1,
    }).unwrap();

    let agent = Agent::new("IFLB", config);
    assert!(agent.is_ok());
}

#[wasm_bindgen_test]
fn test_action_selection_in_browser() {
    let agent = create_test_agent();
    let state = vec![0.5f32; 64];

    let action = agent.select_action(&state);
    assert!(action.is_ok());

    let action = action.unwrap();
    assert!(action.confidence() >= 0.0);
    assert!(action.confidence() <= 1.0);
}

#[wasm_bindgen_test]
async fn test_async_q_table_export() {
    let agent = create_test_agent();

    // Train the agent
    for _ in 0..100 {
        let state = random_state();
        let _ = agent.select_action(&state);
        agent.update_reward(1.0).unwrap();
    }

    // Export Q-table
    let q_table_bytes = agent.export_q_table();
    assert!(!q_table_bytes.is_empty());

    // Verify it can be imported
    let mut new_agent = create_test_agent();
    let result = new_agent.import_q_table(&q_table_bytes);
    assert!(result.is_ok());
}

#[wasm_bindgen_test]
fn test_memory_growth() {
    // Start with minimal memory
    let initial_pages = wasm_memory_pages();

    // Create many agents
    let mut agents: Vec<Agent> = (0..100)
        .map(|_| create_test_agent())
        .collect();

    // Memory should have grown
    let final_pages = wasm_memory_pages();
    assert!(final_pages >= initial_pages);

    // Clean up
    agents.clear();

    // Note: WASM memory doesn't shrink, but we should not have leaked
}
```

**Running Browser Tests:**
```bash
# Install wasm-pack
cargo install wasm-pack

# Run tests in headless Chrome
wasm-pack test --headless --chrome

# Run tests in headless Firefox
wasm-pack test --headless --firefox

# Run tests in Node.js
wasm-pack test --node
```

### 4. Property-Based Testing (proptest)

```rust
// tests/property/simd_equivalence.rs
use proptest::prelude::*;
use elex_agent::simd::{simd_dot_product_64, scalar_dot_product_64};

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10000))]

    /// SIMD dot product must equal scalar dot product
    #[test]
    fn simd_dot_product_matches_scalar(
        a in prop::array::uniform64(-1000.0f32..1000.0f32),
        b in prop::array::uniform64(-1000.0f32..1000.0f32),
    ) {
        let simd_result = unsafe { simd_dot_product_64(&a, &b) };
        let scalar_result = scalar_dot_product_64(&a, &b);

        // Allow small floating-point differences
        let diff = (simd_result - scalar_result).abs();
        let tolerance = scalar_result.abs() * 1e-5 + 1e-10;

        prop_assert!(diff < tolerance,
            "SIMD: {}, Scalar: {}, Diff: {}", simd_result, scalar_result, diff);
    }

    /// Q-table updates must be monotonic with positive rewards
    #[test]
    fn q_updates_monotonic_positive_reward(
        initial_q in -100.0f64..100.0f64,
        reward in 0.0f64..10.0f64,
        learning_rate in 0.01f64..1.0f64,
        discount_factor in 0.0f64..1.0f64,
    ) {
        let max_next_q = 0.0; // Simplified: no future value
        let new_q = initial_q + learning_rate * (reward + discount_factor * max_next_q - initial_q);

        // With positive reward and no future value, Q should move toward reward
        prop_assert!(new_q >= initial_q.min(reward) - 1e-10);
        prop_assert!(new_q <= initial_q.max(reward) + 1e-10);
    }

    /// State normalization must produce unit vectors
    #[test]
    fn normalization_produces_unit_vector(
        v in prop::array::uniform64(0.01f32..1000.0f32), // Avoid near-zero
    ) {
        let mut normalized = v.clone();
        scalar_normalize_64(&mut normalized);

        let magnitude: f32 = normalized.iter().map(|x| x * x).sum::<f32>().sqrt();

        prop_assert!((magnitude - 1.0).abs() < 1e-5,
            "Expected unit vector, got magnitude {}", magnitude);
    }

    /// Safe zone clipping must respect bounds
    #[test]
    fn safe_zone_clipping_respects_bounds(
        value in -1000.0f64..1000.0f64,
        min in -500.0f64..0.0f64,
        max in 0.0f64..500.0f64,
    ) {
        prop_assume!(min < max);

        let safe_zone = SafeZone { min, max, default: (min + max) / 2.0 };
        let clipped = safe_zone.clip(value);

        prop_assert!(clipped >= min);
        prop_assert!(clipped <= max);
    }
}
```

### 5. Criterion Benchmarks

```rust
// benches/q_learning_bench.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use elex_agent::{QTable, QLearningEngine, State, Action};

fn benchmark_q_table_lookup(c: &mut Criterion) {
    let table = QTable::new(1000, 20);

    c.bench_function("q_table_lookup", |b| {
        b.iter(|| {
            for s in 0..1000 {
                for a in 0..20 {
                    black_box(table.get(s, a));
                }
            }
        })
    });
}

fn benchmark_dot_product(c: &mut Criterion) {
    let a = [0.5f32; 64];
    let b = [0.3f32; 64];

    let mut group = c.benchmark_group("dot_product");

    group.bench_function("scalar", |b| {
        b.iter(|| scalar_dot_product_64(black_box(&a), black_box(&b)))
    });

    group.bench_function("simd", |b| {
        b.iter(|| unsafe { simd_dot_product_64(black_box(&a), black_box(&b)) })
    });

    group.finish();
}

fn benchmark_action_selection(c: &mut Criterion) {
    let mut engine = QLearningEngine::default();
    let state = State::random();

    c.bench_function("action_selection", |b| {
        b.iter(|| engine.select_action(black_box(&state)))
    });
}

fn benchmark_hnsw_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_search");

    for size in [1000, 10000, 100000].iter() {
        let index = build_hnsw_index(*size);
        let query = random_vector();

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            b.iter(|| index.search(black_box(&query), 10))
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_q_table_lookup,
    benchmark_dot_product,
    benchmark_action_selection,
    benchmark_hnsw_search,
);
criterion_main!(benches);
```

**Performance Requirements (CI Enforced):**

| Operation | Target | Fail Threshold |
|-----------|--------|----------------|
| Q-table lookup | <1ms | >2ms |
| Dot product (SIMD) | <15us | >50us |
| Action selection | <500us | >1ms |
| HNSW search (10K) | <5ms | >15ms |
| State encoding | <5ms | >15ms |

### 6. Test Coverage Requirements

```toml
# .cargo/config.toml
[env]
CARGO_INCREMENTAL = "0"
RUSTFLAGS = "-Cinstrument-coverage"
LLVM_PROFILE_FILE = "target/coverage/%p-%m.profraw"
```

```bash
# Generate coverage report
cargo test
grcov . --binary-path ./target/debug/ -s . -t html --branch --ignore-not-existing -o ./target/coverage/

# Coverage thresholds
# - Core modules: 90%
# - SIMD code: 80% (both paths)
# - Integration tests: 70%
# - Overall: 85%
```

### 7. Miri for Unsafe Code

```bash
# Run all tests under Miri
cargo +nightly miri test

# Run with strict checks
MIRIFLAGS="-Zmiri-symbolic-alignment-check -Zmiri-strict-provenance" \
  cargo +nightly miri test

# Miri cannot test WASM SIMD directly; use scalar equivalence tests
```

### 8. CI Pipeline Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --lib --bins

  wasm-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - run: cargo install wasm-pack
      - run: wasm-pack test --headless --chrome
      - run: wasm-pack test --headless --firefox

  property-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --features proptest -- --test-threads=4

  miri:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@nightly
        with:
          components: miri
      - run: cargo +nightly miri test --lib

  benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo bench -- --noplot
      - uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: target/criterion/

  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: llvm-tools-preview
      - run: cargo install grcov
      - run: cargo test
        env:
          CARGO_INCREMENTAL: "0"
          RUSTFLAGS: "-Cinstrument-coverage"
      - run: grcov . -s . -t lcov -o coverage.lcov
      - uses: codecov/codecov-action@v4
        with:
          files: coverage.lcov
          fail_ci_if_error: true
```

## Alternatives Considered

### Jest for All Tests
- **Pros:** Familiar to JS developers, good tooling
- **Cons:** Cannot test Rust internals, slower
- **Rejected:** Need to test Rust logic directly

### No Property Testing
- **Pros:** Simpler, faster CI
- **Cons:** Misses edge cases, less confidence in correctness
- **Rejected:** SIMD equivalence and numerical stability need property tests

### Manual Benchmarking
- **Pros:** Flexible, custom metrics
- **Cons:** Not reproducible, hard to automate
- **Rejected:** Criterion provides reproducible, statistical benchmarks

### QuickCheck Instead of proptest
- **Pros:** More mature, Haskell heritage
- **Cons:** Less flexible shrinking, fewer strategies
- **Rejected:** proptest has better Rust ergonomics

## Consequences

### Positive
- **Confidence:** Multi-layer testing catches bugs at appropriate level
- **Performance Tracking:** Benchmarks prevent regressions
- **WASM Verification:** Browser tests ensure real-world compatibility
- **Edge Case Coverage:** Property tests find unexpected failures
- **Memory Safety:** Miri catches undefined behavior

### Negative
- **CI Time:** Full test suite takes 15-20 minutes
- **Complexity:** Multiple test frameworks to understand
- **Flakiness:** Browser tests occasionally fail due to timing
- **Maintenance:** Test infrastructure requires upkeep

### Risks
- **False Confidence:** 100% coverage doesn't mean correct
- **Benchmark Gaming:** Optimizing for benchmarks not real usage
- **Property Test Limits:** Random testing may miss systematic issues
- **Miri Limitations:** Cannot test all unsafe patterns

### Mitigations
- **Mutation Testing:** cargo-mutants verifies test quality
- **Production Metrics:** Compare benchmarks to real performance
- **Directed Testing:** Supplement random with targeted tests
- **Runtime Sanitizers:** AddressSanitizer for native tests

## References
- ADR-012: Unsafe Rust Policy
- ADR-014: SIMD Implementation
- Rust Testing Book - https://doc.rust-lang.org/book/ch11-00-testing.html
- wasm-bindgen-test - https://rustwasm.github.io/wasm-bindgen/wasm-bindgen-test/
- proptest - https://docs.rs/proptest
- Criterion - https://docs.rs/criterion
- Miri - https://github.com/rust-lang/miri
