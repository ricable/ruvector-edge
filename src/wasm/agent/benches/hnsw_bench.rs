/// Criterion Benchmarks for HNSW and Search Operations (ADR-016)
///
/// Performance targets:
/// - HNSW search (10K vectors): <5ms (fail threshold: >15ms)
/// - Vector similarity search: <1ms (fail threshold: >3ms)
/// - Batch similarity: <10ms for 100 queries (fail threshold: >30ms)

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use edge_agent_wasm::simd_ops::cosine_similarity_simd;
use std::time::Duration;

// Simple HNSW-like index for benchmarking

struct SimpleVectorIndex {
    vectors: Vec<Vec<f32>>,
    dimension: usize,
}

impl SimpleVectorIndex {
    fn new(dimension: usize) -> Self {
        Self {
            vectors: Vec::new(),
            dimension,
        }
    }

    fn insert(&mut self, vector: Vec<f32>) {
        assert_eq!(vector.len(), self.dimension);
        self.vectors.push(vector);
    }

    fn search(&self, query: &[f32], k: usize) -> Vec<(usize, f32)> {
        let mut similarities = Vec::new();

        for (idx, vec) in self.vectors.iter().enumerate() {
            let sim = cosine_similarity_simd(query, vec);
            similarities.push((idx, sim));
        }

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        similarities.truncate(k);
        similarities
    }

    fn batch_search(&self, queries: &[Vec<f32>], k: usize) -> Vec<Vec<(usize, f32)>> {
        queries
            .iter()
            .map(|query| self.search(query, k))
            .collect()
    }
}

fn bench_index_construction(c: &mut Criterion) {
    let mut group = c.benchmark_group("index_construction");

    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.iter(|| {
                let mut index = SimpleVectorIndex::new(64);
                for _ in 0..size {
                    let vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();
                    black_box(index.insert(vec));
                }
            })
        });
    }

    group.finish();
}

fn bench_vector_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("vector_search");

    for size in [100, 1000, 10000].iter() {
        // Build index
        let mut index = SimpleVectorIndex::new(64);
        for _ in 0..*size {
            let vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();
            index.insert(vec);
        }

        let query: Vec<f32> = (0..64).map(|_| rand::random()).collect();

        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            b.iter(|| black_box(index.search(&query, 10)))
        });
    }

    group.finish();
}

fn bench_batch_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_search");

    for (index_size, query_count) in [(1000, 10), (1000, 100), (10000, 10), (10000, 100)].iter() {
        // Build index
        let mut index = SimpleVectorIndex::new(64);
        for _ in 0..*index_size {
            let vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();
            index.insert(vec);
        }

        let queries: Vec<Vec<f32>> = (0..*query_count)
            .map(|_| (0..64).map(|_| rand::random()).collect())
            .collect();

        group.bench_with_input(
            BenchmarkId::new("index", index_size),
            &(*index_size, *query_count),
            |b, _| {
                b.iter(|| black_box(index.batch_search(&queries, 10)))
            }
        );
    }

    group.finish();
}

fn bench_knn_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("knn_search");

    // Build index with 10K vectors
    let mut index = SimpleVectorIndex::new(64);
    for _ in 0..10000 {
        let vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();
        index.insert(vec);
    }

    let query: Vec<f32> = (0..64).map(|_| rand::random()).collect();

    for k in [1, 5, 10, 20, 50].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(k), k, |b, &k| {
            b.iter(|| black_box(index.search(&query, k)))
        });
    }

    group.finish();
}

fn bench_vector_similarity_various_dimensions(c: &mut Criterion) {
    let mut group = c.benchmark_group("similarity_by_dimension");

    for dim in [8, 16, 32, 64, 128, 256].iter() {
        let a: Vec<f32> = (0..*dim).map(|_| rand::random()).collect();
        let b: Vec<f32> = (0..*dim).map(|_| rand::random()).collect();

        group.throughput(Throughput::Elements(*dim as u64));

        group.bench_with_input(BenchmarkId::from_parameter(dim), dim, |b, _| {
            b.iter(|| black_box(cosine_similarity_simd(&a, &b)))
        });
    }

    group.finish();
}

fn bench_memory_usage(c: &mut Criterion) {
    // Estimate memory per vector
    c.bench_function("single_vector_64d", |b| {
        b.iter(|| {
            black_box(vec![0.0f32; 64])
        })
    });

    c.bench_function("index_100_vectors", |b| {
        b.iter(|| {
            let mut index = SimpleVectorIndex::new(64);
            for _ in 0..100 {
                let vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();
                index.insert(vec);
            }
            black_box(index)
        })
    });

    c.bench_function("index_1000_vectors", |b| {
        b.iter(|| {
            let mut index = SimpleVectorIndex::new(64);
            for _ in 0..1000 {
                let vec: Vec<f32> = (0..64).map(|_| rand::random()).collect();
                index.insert(vec);
            }
            black_box(index)
        })
    });
}

criterion_group! {
    name = hnsw_benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .sample_size(100);
    targets =
        bench_index_construction,
        bench_vector_search,
        bench_batch_search,
        bench_knn_search,
        bench_vector_similarity_various_dimensions,
        bench_memory_usage,
}

criterion_main!(hnsw_benches);
