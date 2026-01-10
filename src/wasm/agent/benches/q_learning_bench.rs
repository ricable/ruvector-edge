/// Criterion Benchmarks for Q-Learning (ADR-016)
///
/// Performance targets:
/// - Q-table lookup: <1ms (fail threshold: >2ms)
/// - Q-table update: <500us (fail threshold: >1ms)
/// - Action selection: <500us (fail threshold: >1ms)
/// - Batch update (100 entries): <5ms (fail threshold: >15ms)

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use edge_agent_wasm::q_learning::{QTableWasm, QLearningConfig, QUpdateBatch};
use edge_agent_wasm::feature_agent::AgentAction;
use std::time::Duration;

fn bench_q_table_creation(c: &mut Criterion) {
    c.bench_function("q_table_creation", |b| {
        b.iter(|| {
            let config = QLearningConfig::default();
            black_box(QTableWasm::new(config))
        })
    });
}

fn bench_q_table_lookup(c: &mut Criterion) {
    let config = QLearningConfig::default();
    let mut q_table = QTableWasm::new(config);

    // Populate Q-table
    for s in 0..100 {
        for a in 0..20 {
            q_table.set_q_value(&format!("s{}", s), &format!("a{}", a), s as f32 * 0.1);
        }
    }

    c.bench_function("q_table_lookup", |b| {
        b.iter(|| {
            for s in 0..100 {
                for a in 0..20 {
                    black_box(q_table.get_q_value(&format!("s{}", s), &format!("a{}", a)));
                }
            }
        })
    });
}

fn bench_q_table_update(c: &mut Criterion) {
    c.bench_function("q_table_update", |b| {
        b.iter(|| {
            let config = QLearningConfig::default();
            let mut q_table = QTableWasm::new(config);
            q_table.set_q_value("s0", "a0", 0.5);
            black_box(q_table.update_q_value("s0", "a0", 1.0, 0.8))
        })
    });
}

fn bench_action_selection(c: &mut Criterion) {
    let config = QLearningConfig::default();
    let q_table = QTableWasm::new(config);

    let actions = vec![
        AgentAction::DirectAnswer,
        AgentAction::ContextAnswer,
        AgentAction::ConsultPeer,
        AgentAction::RequestClarification,
        AgentAction::Escalate,
    ];

    c.bench_function("action_selection", |b| {
        b.iter(|| black_box(q_table.select_action("s0", &actions)))
    });
}

fn bench_batch_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_update");

    for size in [10, 50, 100, 500, 1000].iter() {
        let config = QLearningConfig::default();
        let mut q_table = QTableWasm::new(config);

        let batch: Vec<QUpdateBatch> = (0..*size)
            .map(|i| QUpdateBatch {
                state_action_key: format!("s{}::a{}", i, i),
                current_q: 0.0,
                reward: 1.0,
                next_max_q: 0.5,
                visit_count: 1,
            })
            .collect();

        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            b.iter(|| black_box(q_table.batch_update(batch.clone())))
        });
    }

    group.finish();
}

fn bench_epsilon_decay(c: &mut Criterion) {
    c.bench_function("epsilon_decay", |b| {
        b.iter(|| {
            let config = QLearningConfig::default();
            let mut q_table = QTableWasm::new(config);
            for _ in 0..100 {
                black_box(q_table.decay_epsilon());
            }
        })
    });
}

fn bench_get_stats(c: &mut Criterion) {
    let config = QLearningConfig::default();
    let mut q_table = QTableWasm::new(config);

    // Populate Q-table
    for s in 0..100 {
        for a in 0..20 {
            q_table.set_q_value(&format!("s{}", s), &format!("a{}", a), s as f32 * 0.1);
        }
    }

    c.bench_function("get_stats", |b| {
        b.iter(|| black_box(q_table.get_stats()))
    });
}

fn bench_federated_learning_merge(c: &mut Criterion) {
    let config = QLearningConfig::default();

    c.bench_function("federated_merge", |b| {
        b.iter(|| {
            let mut qt1 = QTableWasm::new(config.clone());
            let qt2 = QTableWasm::new(config.clone());

            // Populate both tables
            for s in 0..100 {
                for a in 0..10 {
                    qt1.set_q_value(&format!("s{}", s), &format!("a{}", a), s as f32 * 0.1);
                    qt2.set_q_value(&format!("s{}", s), &format!("a{}", a), s as f32 * 0.2);
                }
            }

            black_box(qt1.merge_from(&qt2, 0.5))
        })
    });
}

criterion_group! {
    name = q_learning_benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .sample_size(100);
    targets =
        bench_q_table_creation,
        bench_q_table_lookup,
        bench_q_table_update,
        bench_action_selection,
        bench_batch_update,
        bench_epsilon_decay,
        bench_get_stats,
        bench_federated_learning_merge,
}

criterion_main!(q_learning_benches);
