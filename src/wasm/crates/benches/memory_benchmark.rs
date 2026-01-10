//! Memory Management Benchmarks (Phase 7)
//!
//! Targets:
//! - 500MB budget enforcement
//! - Optimal vector allocation patterns
//! - Minimal memory fragmentation

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use elex_memory::hnsw::{HnswIndex, HnswConfig};
use rand::Rng;
use rand_chacha::ChaCha8Rng;
use rand::SeedableRng;

/// Generate random normalized vector
fn random_normalized_vector(rng: &mut ChaCha8Rng, dim: usize) -> Vec<f32> {
    let mut v: Vec<f32> = (0..dim).map(|_| rng.gen()).collect();
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    v.iter_mut().for_each(|x| *x /= norm);
    v
}

/// Benchmark HNSW memory efficiency
fn bench_hnsw_memory_efficiency(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_memory_efficiency");

    for num_vectors in [1_000, 5_000, 10_000].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        group.bench_with_input(BenchmarkId::from_parameter(num_vectors), num_vectors, |b, &n| {
            b.iter(|| {
                let config = HnswConfig::default();
                let mut index = HnswIndex::with_config(config);

                for _ in 0..n {
                    let vec = random_normalized_vector(&mut rng, 128);
                    index.insert(&vec);
                }

                let memory_bytes = index.memory_usage();
                let memory_per_vector = memory_bytes / n;

                println!("\n=== HNSW Memory Efficiency ({}) ===", n);
                println!("Total memory: {}KB", memory_bytes / 1024);
                println!("Per vector: {} bytes", memory_per_vector);
                println!("Target: <1KB per vector");

                black_box(memory_per_vector);
            });
        });
    }

    group.finish();
}

/// Benchmark vector allocation patterns
fn bench_vector_allocation(c: &mut Criterion) {
    let mut group = c.benchmark_group("vector_allocation");

    // Pattern 1: Allocate vectors one at a time
    group.bench_function("individual_allocation_1000", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        b.iter(|| {
            let mut vectors: Vec<Vec<f32>> = Vec::with_capacity(1000);

            for _ in 0..1000 {
                vectors.push(random_normalized_vector(&mut rng, 128));
            }

            black_box(&vectors);
        });
    });

    // Pattern 2: Pre-allocate with capacity
    group.bench_function("preallocated_1000", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        b.iter(|| {
            let mut vectors: Vec<Vec<f32>> = Vec::with_capacity(1000);
            vectors.reserve(1000);

            for _ in 0..1000 {
                vectors.push(random_normalized_vector(&mut rng, 128));
            }

            black_box(&vectors);
        });
    });

    group.finish();
}

/// Benchmark memory fragmentation
fn bench_memory_fragmentation(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_fragmentation");

    // Test allocation/deallocation patterns
    group.bench_function("fragmentation_pattern", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        b.iter(|| {
            let mut allocations: Vec<Vec<f32>> = Vec::new();

            // Allocate 100 vectors
            for _ in 0..100 {
                allocations.push(random_normalized_vector(&mut rng, 128));
            }

            // Deallocate every other one
            let mut i = 0;
            allocations.retain(|_| {
                let keep = i % 2 == 0;
                i += 1;
                keep
            });

            // Re-allocate
            for _ in 0..50 {
                allocations.push(random_normalized_vector(&mut rng, 128));
            }

            black_box(&allocations);
        });
    });

    group.finish();
}

/// Benchmark flat vs nested storage (HNSW optimization)
fn bench_flat_vs_nested_storage(c: &mut Criterion) {
    let mut group = c.benchmark_group("flat_vs_nested");

    let num_vectors = 1000;
    let dim = 128;
    let mut rng = ChaCha8Rng::seed_from_u64(42);

    // Flat storage (HNSW approach)
    group.bench_function("flat_storage", |b| {
        b.iter(|| {
            let mut flat: Vec<f32> = Vec::with_capacity(num_vectors * dim);

            for _ in 0..num_vectors {
                let vec = random_normalized_vector(&mut rng, dim);
                flat.extend_from_slice(&vec);
            }

            black_box(&flat);
        });
    });

    // Nested storage
    group.bench_function("nested_storage", |b| {
        b.iter(|| {
            let mut nested: Vec<Vec<f32>> = Vec::with_capacity(num_vectors);

            for _ in 0..num_vectors {
                nested.push(random_normalized_vector(&mut rng, dim));
            }

            black_box(&nested);
        });
    });

    group.finish();
}

/// Benchmark memory budget enforcement
fn bench_memory_budget_enforcement(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_budget");

    let budget_mb = 500;
    let target_vectors = 10_000;
    let dim = 128;

    // Calculate expected memory
    let expected_bytes = target_vectors * dim * std::mem::size_of::<f32>();
    let expected_mb = expected_bytes / (1024 * 1024);

    println!("\n=== Memory Budget Enforcement ===");
    println!("Budget: {}MB", budget_mb);
    println!("Expected for {} vectors: {}MB", target_vectors, expected_mb);
    println!("Status: {}", if expected_mb < budget_mb { "PASS" } else { "FAIL" });

    group.bench_function("within_budget", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        b.iter(|| {
            let config = HnswConfig::default();
            let mut index = HnswIndex::with_config(config);

            for _ in 0..target_vectors {
                let vec = random_normalized_vector(&mut rng, dim);
                index.insert(&vec);
            }

            let memory_mb = index.memory_usage() / (1024 * 1024);
            assert!(memory_mb < budget_mb, "Memory budget exceeded!");

            black_box(memory_mb);
        });
    });

    group.finish();
}

/// Benchmark memory reuse patterns
fn bench_memory_reuse(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_reuse");

    // Pattern 1: Reuse existing vector
    group.bench_function("reuse_vector", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let mut vec = vec![0.0f32; 128];

        b.iter(|| {
            for i in 0..128 {
                vec[i] = rng.gen();
            }

            // Normalize
            let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
            vec.iter_mut().for_each(|x| *x /= norm);

            black_box(&vec);
        });
    });

    // Pattern 2: Allocate new vector each time
    group.bench_function("allocate_new", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        b.iter(|| {
            let mut vec: Vec<f32> = (0..128).map(|_| rng.gen()).collect();

            // Normalize
            let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
            vec.iter_mut().for_each(|x| *x /= norm);

            black_box(&vec);
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_hnsw_memory_efficiency,
    bench_vector_allocation,
    bench_memory_fragmentation,
    bench_flat_vs_nested_storage,
    bench_memory_budget_enforcement,
    bench_memory_reuse
);

criterion_main!(benches);
