/// Criterion Benchmarks for SIMD Operations (ADR-016)
///
/// Performance targets:
/// - Dot product (SIMD): <15us (fail threshold: >50us)
/// - Cosine similarity: <20us (fail threshold: >60us)
/// - Validation (SIMD): <10us (fail threshold: >30us)
/// - Aggregation (SIMD): <15us (fail threshold: >50us)
/// - SIMD speedup: 3-8x over scalar

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use edge_agent_wasm::simd_ops::{
    cosine_similarity_simd,
    batch_q_update_simd,
    validate_parameters_simd,
    aggregate_counters_simd,
};
use std::time::Duration;

// Scalar fallback implementations for comparison

fn scalar_cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

fn bench_cosine_similarity(c: &mut Criterion) {
    let mut group = c.benchmark_group("cosine_similarity");

    for size in [8, 16, 32, 64, 128, 256, 512, 1024].iter() {
        let a: Vec<f32> = (0..*size).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..*size).map(|i| i as f32 * 2.0).collect();

        group.throughput(Throughput::Elements(*size as u64));

        // SIMD version
        group.bench_with_input(BenchmarkId::new("simd", size), size, |b, _| {
            b.iter(|| black_box(cosine_similarity_simd(&a, &b)))
        });

        // Scalar version
        group.bench_with_input(BenchmarkId::new("scalar", size), size, |b, _| {
            b.iter(|| black_box(scalar_cosine_similarity(&a, &b)))
        });
    }

    group.finish();
}

fn bench_batch_q_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_q_update");

    for size in [10, 50, 100, 500, 1000].iter() {
        let mut q_values: Vec<f32> = vec![0.0; *size];
        let rewards: Vec<f32> = (0..*size).map(|_| rand::random()).collect();
        let next_max_q: Vec<f32> = (0..*size).map(|_| rand::random()).collect();

        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            let mut q_values_clone = q_values.clone();
            b.iter(|| {
                black_box(batch_q_update_simd(
                    &mut q_values_clone,
                    &rewards,
                    &next_max_q,
                    0.1,
                    0.95,
                ))
            })
        });
    }

    group.finish();
}

fn bench_validate_parameters(c: &mut Criterion) {
    let mut group = c.benchmark_group("validate_parameters");

    for size in [10, 50, 100, 500, 1000, 5000].iter() {
        let values: Vec<f32> = (0..*size).map(|_| rand::random() * 100.0).collect();
        let mins: Vec<f32> = (0..*size).map(|_| rand::random() * 50.0).collect();
        let maxs: Vec<f32> = (0..*size).map(|_| 50.0 + rand::random() * 50.0).collect();

        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            let mut results = vec![0u8; *size];
            b.iter(|| {
                black_box(validate_parameters_simd(&values, &mins, &maxs, &mut results))
            })
        });
    }

    group.finish();
}

fn bench_aggregate_counters(c: &mut Criterion) {
    let mut group = c.benchmark_group("aggregate_counters");

    for size in [10, 50, 100, 500, 1000, 5000].iter() {
        let counter_values: Vec<f32> = (0..*size).map(|_| rand::random() * 200.0).collect();
        let weights: Vec<f32> = (0..*size).map(|_| 1.0 / *size as f32).collect();
        let threshold = 100.0;

        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            b.iter(|| {
                black_box(aggregate_counters_simd(&counter_values, &weights, threshold))
            })
        });
    }

    group.finish();
}

fn bench_dot_product_vectors(c: &mut Criterion) {
    let mut group = c.benchmark_group("dot_product");

    // Standard 64-dimensional vectors (common in embeddings)
    let a64: Vec<f32> = (0..64).map(|_| rand::random()).collect();
    let b64: Vec<f32> = (0..64).map(|_| rand::random()).collect();

    group.bench_function("64_dim", |b| {
        b.iter(|| {
            let mut sum = 0.0f32;
            for i in 0..64 {
                sum += a64[i] * b64[i];
            }
            black_box(sum)
        })
    });

    // 128-dimensional vectors (larger embeddings)
    let a128: Vec<f32> = (0..128).map(|_| rand::random()).collect();
    let b128: Vec<f32> = (0..128).map(|_| rand::random()).collect();

    group.bench_function("128_dim", |b| {
        b.iter(|| {
            let mut sum = 0.0f32;
            for i in 0..128 {
                sum += a128[i] * b128[i];
            }
            black_box(sum)
        })
    });
}

fn bench_vector_normalization(c: &mut Criterion) {
    c.bench_function("normalize_64", |b| {
        let mut vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();

        b.iter(|| {
            let norm: f32 = vec.iter().map(|&x| x * x).sum::<f32>().sqrt();
            if norm > 0.0 {
                for v in vec.iter_mut() {
                    *v /= norm;
                }
            }
            black_box(&mut vec)
        })
    });
}

fn bench_memory_allocation(c: &mut Criterion) {
    c.bench_function("alloc_1000_vec", |b| {
        b.iter(|| {
            black_box(vec![0.0f32; 1000])
        })
    });

    c.bench_function("alloc_10000_vec", |b| {
        b.iter(|| {
            black_box(vec![0.0f32; 10000])
        })
    });
}

criterion_group! {
    name = simd_benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .sample_size(100);
    targets =
        bench_cosine_similarity,
        bench_batch_q_update,
        bench_validate_parameters,
        bench_aggregate_counters,
        bench_dot_product_vectors,
        bench_vector_normalization,
        bench_memory_allocation,
}

criterion_main!(simd_benches);
