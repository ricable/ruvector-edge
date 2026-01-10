//! SIMD Performance Benchmarks (Phase 7)
//!
//! Targets:
//! - 3-8x speedup on SIMD128 operations
//! - Cosine similarity, Q-learning updates, validation, aggregation

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use elex_simd::VectorOps;
use rand::Rng;
use rand_chacha::ChaCha8Rng;
use rand::SeedableRng;

/// Generate random vector
fn random_vector(rng: &mut ChaCha8Rng, size: usize) -> Vec<f32> {
    (0..size).map(|_| rng.gen()).collect()
}

/// Benchmark cosine similarity
fn bench_cosine_similarity(c: &mut Criterion) {
    let mut group = c.benchmark_group("cosine_similarity");

    for size in [4, 16, 64, 128, 256, 512].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let a = random_vector(&mut rng, *size);
        let b = random_vector(&mut rng, *size);

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &_size| {
            let ops = VectorOps::new();

            b.iter(|| {
                black_box(ops.cosine_similarity(&a, &b));
            });
        });
    }

    group.finish();
}

/// Benchmark Q-learning batch updates
fn bench_qlearning_batch_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("qlearning_batch_update");

    for size in [16, 64, 256, 1024, 4096].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let mut q_values = random_vector(&mut rng, *size);
        let rewards = random_vector(&mut rng, *size);
        let next_max_q = random_vector(&mut rng, *size);

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &_size| {
            let ops = VectorOps::new();

            b.iter(|| {
                let mut q_clone = q_values.clone();
                ops.batch_q_update(&mut q_clone, &rewards, &next_max_q, 0.1, 0.95);
                black_box(&q_clone);
            });
        });
    }

    group.finish();
}

/// Benchmark parameter validation
fn bench_parameter_validation(c: &mut Criterion) {
    let mut group = c.benchmark_group("parameter_validation");

    for size in [16, 64, 256, 1024].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let values = random_vector(&mut rng, *size);
        let mins: Vec<f32> = (0..*size).map(|_| rng.gen()).collect();
        let maxs: Vec<f32> = (0..*size).map(|_| rng.gen()).collect();
        let mut results = vec![0u8; *size];

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &_size| {
            let ops = VectorOps::new();

            b.iter(|| {
                let mut results_clone = results.clone();
                ops.validate_parameters(&values, &mins, &maxs, &mut results_clone);
                black_box(&results_clone);
            });
        });
    }

    group.finish();
}

/// Benchmark counter aggregation
fn bench_counter_aggregation(c: &mut Criterion) {
    let mut group = c.benchmark_group("counter_aggregation");

    for size in [16, 64, 256, 1024].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let values = random_vector(&mut rng, *size);
        let weights = random_vector(&mut rng, *size);
        let threshold = 50.0;

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &_size| {
            let ops = VectorOps::new();

            b.iter(|| {
                black_box(ops.aggregate_counters(&values, &weights, threshold));
            });
        });
    }

    group.finish();
}

/// Benchmark SIMD vs Scalar comparison
fn bench_simd_vs_scalar(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_vs_scalar");

    let size = 128;
    let mut rng = ChaCha8Rng::seed_from_u64(42);
    let a = random_vector(&mut rng, size);
    let b = random_vector(&mut rng, size);

    // SIMD version
    group.bench_function("simd_cosine_128", |b| {
        b.iter(|| {
            #[cfg(target_arch = "wasm32")]
            {
                use elex_simd::cosine_similarity_simd;
                unsafe { black_box(cosine_similarity_simd(&a, &b)) }
            }

            #[cfg(not(target_arch = "wasm32"))]
            {
                use elex_simd::cosine_similarity_scalar;
                black_box(cosine_similarity_scalar(&a, &b))
            }
        });
    });

    // Scalar version
    group.bench_function("scalar_cosine_128", |b| {
        b.iter(|| {
            use elex_simd::cosine_similarity_scalar;
            black_box(cosine_similarity_scalar(&a, &b))
        });
    });

    group.finish();
}

/// Calculate SIMD speedup
fn bench_simd_speedup(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_speedup");

    let sizes = [64, 128, 256, 512, 1024];

    for size in sizes.iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let a = random_vector(&mut rng, *size);
        let b = random_vector(&mut rng, *size);

        // Measure SIMD time
        let simd_samples = measure_samples(100, || {
            #[cfg(target_arch = "wasm32")]
            {
                use elex_simd::cosine_similarity_simd;
                unsafe { cosine_similarity_simd(&a, &b) }
            }

            #[cfg(not(target_arch = "wasm32"))]
            {
                use elex_simd::cosine_similarity_scalar;
                cosine_similarity_scalar(&a, &b)
            }
        });

        // Measure scalar time
        let scalar_samples = measure_samples(100, || {
            use elex_simd::cosine_similarity_scalar;
            cosine_similarity_scalar(&a, &b)
        });

        let simd_avg = simd_samples.iter().sum::<f64>() / simd_samples.len() as f64;
        let scalar_avg = scalar_samples.iter().sum::<f64>() / scalar_samples.len() as f64;
        let speedup = scalar_avg / simd_avg;

        println!("\n=== SIMD Speedup for size {} ===", size);
        println!("SIMD: {:.3}μs", simd_avg * 1_000_000.0);
        println!("Scalar: {:.3}μs", scalar_avg * 1_000_000.0);
        println!("Speedup: {:.2}x", speedup);
        println!("Target: 3-8x");
        println!("Status: {}", if speedup >= 3.0 { "PASS" } else { "FAIL" });
    }

    group.finish();
}

fn measure_samples<F>(n: usize, mut f: F) -> Vec<f64>
where
    F: FnMut() -> f32,
{
    let mut samples = Vec::with_capacity(n);

    // Warm-up
    for _ in 0..10 {
        black_box(f());
    }

    // Measure
    for _ in 0..n {
        let start = std::time::Instant::now();
        black_box(f());
        samples.push(start.elapsed().as_secs_f64());
    }

    samples
}

criterion_group!(
    benches,
    bench_cosine_similarity,
    bench_qlearning_batch_update,
    bench_parameter_validation,
    bench_counter_aggregation,
    bench_simd_vs_scalar,
    bench_simd_speedup
);

criterion_main!(benches);
