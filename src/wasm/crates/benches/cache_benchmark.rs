//! Cache Performance Benchmarks (Phase 7)
//!
//! Targets:
//! - 500MB memory budget enforcement
//! - <1ms cache hit/miss latency
//! - Adaptive eviction based on memory pressure

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use elex_memory::{LruCache, CachedAgent};
use rand::Rng;
use rand_chacha::ChaCha8Rng;
use rand::SeedableRng;

/// Create test agent with specified size
fn create_test_agent(id: String, size_kb: usize) -> CachedAgent {
    CachedAgent {
        id,
        q_table: vec![0u8; size_kb * 1024],
        trajectory_buffer: vec![0u8; size_kb * 1024],
        hnsw_slice: None,
        memory_usage: 2 * size_kb * 1024,
        last_accessed: 0,
        access_count: 0,
    }
}

/// Benchmark cache insertion
fn bench_cache_insert(c: &mut Criterion) {
    let mut group = c.benchmark_group("cache_insert");

    for num_agents in [10, 25, 50].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(num_agents), num_agents, |b, &n| {
            let mut cache = LruCache::elex_default();

            b.iter(|| {
                for i in 0..n {
                    let agent = create_test_agent(format!("agent_{}", i), 1024); // 2MB each
                    black_box(cache.insert(agent).unwrap());
                }
            });
        });
    }

    group.finish();
}

/// Benchmark cache hit latency
fn bench_cache_hit(c: &mut Criterion) {
    let mut group = c.benchmark_group("cache_hit");

    let mut cache = LruCache::elex_default();

    // Insert 10 agents
    for i in 0..10 {
        let agent = create_test_agent(format!("agent_{}", i), 1024);
        cache.insert(agent).unwrap();
    }

    group.bench_function("get_10", |b| {
        b.iter(|| {
            black_box(cache.get("agent_5"));
        });
    });

    group.finish();
}

/// Benchmark cache miss latency
fn bench_cache_miss(c: &mut Criterion) {
    let mut group = c.benchmark_group("cache_miss");

    let mut cache = LruCache::elex_default();

    // Insert 10 agents
    for i in 0..10 {
        let agent = create_test_agent(format!("agent_{}", i), 1024);
        cache.insert(agent).unwrap();
    }

    group.bench_function("get_nonexistent", |b| {
        b.iter(|| {
            black_box(cache.get("agent_999"));
        });
    });

    group.finish();
}

/// Benchmark adaptive eviction (Phase 7)
fn bench_adaptive_eviction(c: &mut Criterion) {
    let mut group = c.benchmark_group("adaptive_eviction");

    let mut cache = LruCache::elex_default();

    // Fill cache to 70% (350MB)
    let num_agents = 175; // 175 agents * 2MB = 350MB
    for i in 0..num_agents {
        let agent = create_test_agent(format!("agent_{}", i), 1024);
        cache.insert(agent).unwrap();
    }

    println!("\n=== Adaptive Eviction Test ===");
    println!("Initial agents: {}", cache.len());
    println!("Initial memory: {}MB", cache.memory_usage_mb());
    println!("Memory pressure: {:.2}", cache.memory_pressure());

    // Add more agents to trigger eviction
    for i in num_agents..200 {
        let agent = create_test_agent(format!("agent_{}", i), 1024);
        cache.insert(agent).unwrap();

        if cache.memory_pressure() > 0.85 {
            println!("\nPressure threshold exceeded!");
            println!("Agents after eviction: {}", cache.len());
            println!("Memory after eviction: {}MB", cache.memory_usage_mb());
            println!("Eviction percentage: {:.1}%", cache.adaptive_eviction_percent() * 100.0);
            break;
        }
    }

    group.bench_function("trigger_eviction", |b| {
        let mut cache = LruCache::elex_default();

        // Fill to 70%
        for i in 0..175 {
            let agent = create_test_agent(format!("agent_{}", i), 1024);
            cache.insert(agent).unwrap();
        }

        b.iter(|| {
            let agent = create_test_agent("new_agent".to_string(), 1024);
            black_box(cache.insert(agent));
        });
    });

    group.finish();
}

/// Benchmark memory pressure monitoring (Phase 7)
fn bench_memory_pressure(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_pressure");

    let mut cache = LruCache::elex_default();

    // Gradually fill cache and monitor pressure
    println!("\n=== Memory Pressure Monitoring ===");
    println!("Target: 500MB budget");

    for batch in 0..5 {
        for i in 0..25 {
            let agent_id = format!("agent_{}_{}", batch, i);
            let agent = create_test_agent(agent_id, 1024);
            cache.insert(agent).unwrap();
        }

        let pressure = cache.memory_pressure();
        let usage_mb = cache.memory_usage_mb();
        let is_pressure = cache.is_under_pressure();

        println!("Batch {}: {}MB, pressure={:.2}, under_pressure={}",
            batch, usage_mb, pressure, is_pressure);
    }

    group.finish();
}

/// Benchmark hit rate
fn bench_hit_rate(c: &mut Criterion) {
    let mut group = c.benchmark_group("hit_rate");

    let mut cache = LruCache::elex_default();
    let mut rng = ChaCha8Rng::seed_from_u64(42);

    // Insert 50 agents
    for i in 0..50 {
        let agent = create_test_agent(format!("agent_{}", i), 1024);
        cache.insert(agent).unwrap();
    }

    // 80% hits, 20% misses
    group.bench_function("mixed_workload", |b| {
        b.iter(|| {
            for _ in 0..100 {
                let agent_id = if rng.gen_bool(0.8) {
                    format!("agent_{}", rng.gen_range(0..50))
                } else {
                    format!("agent_{}", rng.gen_range(50..100))
                };
                black_box(cache.get(&agent_id));
            }
        });
    });

    println!("\n=== Cache Hit Rate ===");
    println!("Total hits: {}", cache.stats().hits);
    println!("Total misses: {}", cache.stats().misses);
    println!("Hit rate: {:.2}%", cache.hit_rate() * 100.0);

    group.finish();
}

criterion_group!(
    benches,
    bench_cache_insert,
    bench_cache_hit,
    bench_cache_miss,
    bench_adaptive_eviction,
    bench_memory_pressure,
    bench_hit_rate
);

criterion_main!(benches);
