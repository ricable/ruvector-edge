// SIMD Benchmarks for elex-simd
// Note: Criterion doesn't work well with WASM, this is a placeholder for native benchmarks

#[cfg(not(target_arch = "wasm32"))]
mod benches {
    use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
    use elex_simd::{validate_parameters_simd, validate_parameters_scalar};

    fn bench_validation(c: &mut Criterion) {
        let mut group = c.benchmark_group("parameter_validation");
        
        for size in [4, 16, 64, 256, 1024].iter() {
            let values: Vec<f32> = (0..*size).map(|i| i as f32 * 0.1).collect();
            let mins: Vec<f32> = (0..*size).map(|i| 0.0).collect();
            let maxs: Vec<f32> = (0..*size).map(|i| 100.0).collect();
            let mut results = vec![0u8; *size];
            
            group.bench_with_input(BenchmarkId::new("scalar", size), &size, |b, _| {
                b.iter(|| {
                    let mut r = vec![0u8; *size];
                    validate_parameters_scalar(
                        black_box(&values),
                        black_box(&mins),
                        black_box(&maxs),
                        &mut r
                    );
                });
            });
        }
        
        group.finish();
    }

    criterion_group!(benches, bench_validation);
    criterion_main!(benches);
}

#[cfg(target_arch = "wasm32")]
fn main() {
    println!("Benchmarks are not available on WASM targets");
}
