//! HNSW Performance Benchmarks (Phase 7)
//!
//! Targets:
//! - <1ms P95 search latency for 10K vectors
//! - 150x-12,500x faster than linear search
//! - SIMD128: 3-8x speedup on cosine distance

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use elex_memory::hnsw::{HnswIndex, HnswConfig};
use rand::Rng;
use rand_chacha::ChaCha8Rng;
use rand::SeedableRng;

/// Generate random vector
fn random_vector(rng: &mut ChaCha8Rng, dim: usize) -> Vec<f32> {
    (0..dim).map(|_| rng.gen()).collect()
}

/// Generate normalized random vector (unit length)
fn random_normalized_vector(rng: &mut ChaCha8Rng, dim: usize) -> Vec<f32> {
    let mut v = random_vector(rng, dim);
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    v.iter_mut().for_each(|x| *x /= norm);
    v
}

/// Benchmark HNSW insertion
fn bench_hnsw_insert(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_insert");

    for num_vectors in [100, 1_000, 5_000, 10_000].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        group.bench_with_input(BenchmarkId::from_parameter(num_vectors), num_vectors, |b, &n| {
            let config = HnswConfig::default();
            let mut index = HnswIndex::with_config(config);

            b.iter(|| {
                for _ in 0..n {
                    let vec = random_normalized_vector(&mut rng, 128);
                    black_box(index.insert(&vec));
                }
            });
        });
    }

    group.finish();
}

/// Benchmark HNSW search (critical path)
fn bench_hnsw_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_search");

    for num_vectors in [100, 1_000, 5_000, 10_000].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // Build index
        let config = HnswConfig::default();
        let mut index = HnswIndex::with_config(config);

        for _ in 0..*num_vectors {
            let vec = random_normalized_vector(&mut rng, 128);
            index.insert(&vec);
        }

        group.bench_with_input(BenchmarkId::from_parameter(num_vectors), num_vectors, |b, &_n| {
            let mut rng = ChaCha8Rng::seed_from_u64(43);
            let query = random_normalized_vector(&mut rng, 128);

            b.iter(|| {
                black_box(index.search(&query, 10));
            });
        });
    }

    group.finish();
}

/// Benchmark HNSW search P95 latency (critical metric)
fn bench_hnsw_search_p95(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_search_p95");

    // Target: <1ms P95 for 10K vectors
    let num_vectors = 10_000;
    let mut rng = ChaCha8Rng::seed_from_u64(42);

    // Build index
    let config = HnswConfig::default();
    let mut index = HnswIndex::with_config(config);

    for _ in 0..num_vectors {
        let vec = random_normalized_vector(&mut rng, 128);
        index.insert(&vec);
    }

    // Collect samples for P95 calculation
    let mut samples = Vec::with_capacity(1000);
    let mut query_rng = ChaCha8Rng::seed_from_u64(43);

    for _ in 0..1000 {
        let query = random_normalized_vector(&mut query_rng, 128);
        let start = std::time::Instant::now();
        index.search(&query, 10);
        samples.push(start.elapsed().as_secs_f64());
    }

    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p95 = samples[950]; // 95th percentile

    println!("\n=== HNSW Search P95 Latency ===");
    println!("Vectors: {}", num_vectors);
    println!("P95: {:.3}ms", p95 * 1000.0);
    println!("Target: <1ms");
    println!("Status: {}", if p95 < 0.001 { "PASS" } else { "FAIL" });

    group.bench_function("p95_target", |b| {
        let mut query_rng = ChaCha8Rng::seed_from_u64(43);
        let query = random_normalized_vector(&mut query_rng, 128);

        b.iter(|| {
            black_box(index.search(&query, 10));
        });
    });

    group.finish();
}

/// Benchmark HNSW vs Linear Search
fn bench_hnsw_vs_linear(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_vs_linear");

    let num_vectors = 10_000;
    let mut rng = ChaCha8Rng::seed_from_u64(42);

    // Build HNSW index
    let config = HnswConfig::default();
    let mut hnsw_index = HnswIndex::with_config(config);

    // Build linear index
    let mut linear_index: Vec<Vec<f32>> = Vec::new();

    for _ in 0..num_vectors {
        let vec = random_normalized_vector(&mut rng, 128);
        hnsw_index.insert(&vec);
        linear_index.push(vec.clone());
    }

    // HNSW search
    group.bench_function("hnsw_10k", |b| {
        let mut query_rng = ChaCha8Rng::seed_from_u64(43);
        let query = random_normalized_vector(&mut query_rng, 128);

        b.iter(|| {
            black_box(hnsw_index.search(&query, 10));
        });
    });

    // Linear search (for comparison)
    group.bench_function("linear_10k", |b| {
        let mut query_rng = ChaCha8Rng::seed_from_u64(43);
        let query = random_normalized_vector(&mut query_rng, 128);

        b.iter(|| {
            // Compute cosine similarity with all vectors
            let mut results: Vec<(usize, f32)> = linear_index
                .iter()
                .enumerate()
                .map(|(i, v)| {
                    let dot: f32 = query.iter().zip(v.iter()).map(|(a, b)| a * b).sum();
                    (i, dot)
                })
                .collect();

            results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
            black_box(&results[..10]);
        });
    });

    group.finish();
}

/// Benchmark memory usage
fn bench_hnsw_memory(c: &mut Criterion) {
    let mut group = c.benchmark_group("hnsw_memory");

    for num_vectors in [100, 1_000, 5_000, 10_000].iter() {
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
                let memory_kb = memory_bytes / 1024;

                black_box(memory_kb);
            });
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_hnsw_insert,
    bench_hnsw_search,
    bench_hnsw_search_p95,
    bench_hnsw_vs_linear,
    bench_hnsw_memory
);

criterion_main!(benches);
