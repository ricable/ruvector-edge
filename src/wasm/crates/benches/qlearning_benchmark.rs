//! Q-Learning Performance Benchmarks (Phase 7)
//!
//! Targets:
//! - 2-4x speedup on batch Q-updates with SIMD
//! - <10μs per Q-update for batch of 100
//! - Efficient trajectory replay

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use elex_qlearning::{batch, qtable::QTable, replay::TrajectoryBuffer};
use rand::Rng;
use rand_chacha::ChaCha8Rng;
use rand::SeedableRng;

/// Generate random Q-values
fn random_q_values(rng: &mut ChaCha8Rng, size: usize) -> Vec<f32> {
    (0..size).map(|_| rng.gen::<f32>() * 10.0 - 5.0).collect()
}

/// Benchmark batch Q-update (SIMD-accelerated)
fn bench_batch_q_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_q_update");

    for size in [16, 64, 256, 1024, 4096].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let mut q_values = random_q_values(&mut rng, *size);
        let rewards = random_q_values(&mut rng, *size);
        let next_max_q = random_q_values(&mut rng, *size);

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &_size| {
            b.iter(|| {
                let mut q_clone = q_values.clone();
                batch::batch_q_update(&mut q_clone, &rewards, &next_max_q, 0.1, 0.95);
                black_box(&q_clone);
            });
        });
    }

    group.finish();
}

/// Benchmark batch Q-update latency (target: <10μs for batch of 100)
fn bench_batch_q_update_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_q_update_latency");

    let size = 100;
    let mut rng = ChaCha8Rng::seed_from_u64(42);
    let mut q_values = random_q_values(&mut rng, size);
    let rewards = random_q_values(&mut rng, size);
    let next_max_q = random_q_values(&mut rng, size);

    // Collect samples for latency analysis
    let mut samples = Vec::with_capacity(1000);

    for _ in 0..1000 {
        let mut q_clone = q_values.clone();
        let start = std::time::Instant::now();
        batch::batch_q_update(&mut q_clone, &rewards, &next_max_q, 0.1, 0.95);
        samples.push(start.elapsed().as_secs_f64());
    }

    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p50 = samples[500];
    let p95 = samples[950];
    let p99 = samples[990];
    let avg = samples.iter().sum::<f64>() / samples.len() as f64;

    println!("\n=== Batch Q-Update Latency (size={}) ===", size);
    println!("Average: {:.3}μs", avg * 1_000_000.0);
    println!("P50: {:.3}μs", p50 * 1_000_000.0);
    println!("P95: {:.3}μs", p95 * 1_000_000.0);
    println!("P99: {:.3}μs", p99 * 1_000_000.0);
    println!("Target: <10μs");
    println!("Status: {}", if avg < 10e-6 { "PASS" } else { "FAIL" });

    group.bench_function("batch_100", |b| {
        b.iter(|| {
            let mut q_clone = q_values.clone();
            batch::batch_q_update(&mut q_clone, &rewards, &next_max_q, 0.1, 0.95);
            black_box(&q_clone);
        });
    });

    group.finish();
}

/// Benchmark Q-table operations
fn bench_qtable_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("qtable");

    // Q-table insertion
    group.bench_function("insert_1000", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let mut qtable = QTable::new(100, 10); // 100 states, 10 actions

        b.iter(|| {
            for _ in 0..1000 {
                let state = rng.gen_range(0..100);
                let action = rng.gen_range(0..10);
                let value = rng.gen::<f32>() * 10.0 - 5.0;
                qtable.insert(state, action, value);
            }
            black_box(&qtable);
        });
    });

    // Q-table lookup
    group.bench_function("lookup_1000", |b| {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let mut qtable = QTable::new(100, 10);

        for i in 0..100 {
            for j in 0..10 {
                qtable.insert(i, j, rng.gen::<f32>() * 10.0 - 5.0);
            }
        }

        b.iter(|| {
            for _ in 0..1000 {
                let state = rng.gen_range(0..100);
                let action = rng.gen_range(0..10);
                black_box(qtable.get(state, action));
            }
        });
    });

    group.finish();
}

/// Benchmark trajectory buffer operations
fn bench_trajectory_buffer(c: &mut Criterion) {
    let mut group = c.benchmark_group("trajectory_buffer");

    // Push operations
    group.bench_function("push_1000", |b| {
        use elex_qlearning::{Experience, trajectory::TrajectoryOutcome};
        let mut buffer = TrajectoryBuffer::new(10000);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        b.iter(|| {
            for _ in 0..1000 {
                let exp = Experience {
                    state: rng.gen_range(0..100),
                    action: rng.gen_range(0..10),
                    reward: rng.gen::<f32>() * 10.0 - 5.0,
                    next_state: rng.gen_range(0..100),
                    done: rng.gen_bool(0.1),
                };
                buffer.push(exp, TrajectoryOutcome::Success);
            }
            black_box(&buffer);
        });
    });

    // Sample operations
    group.bench_function("sample_100", |b| {
        use elex_qlearning::{Experience, trajectory::TrajectoryOutcome};
        let mut buffer = TrajectoryBuffer::new(10000);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        for _ in 0..5000 {
            let exp = Experience {
                state: rng.gen_range(0..100),
                action: rng.gen_range(0..10),
                reward: rng.gen::<f32>() * 10.0 - 5.0,
                next_state: rng.gen_range(0..100),
                done: rng.gen_bool(0.1),
            };
            buffer.push(exp, TrajectoryOutcome::Success);
        }

        b.iter(|| {
            black_box(buffer.sample(100));
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_batch_q_update,
    bench_batch_q_update_latency,
    bench_qtable_operations,
    bench_trajectory_buffer
);

criterion_main!(benches);
