/// Property-Based Tests for Q-Learning (ADR-016)
///
/// Uses proptest to verify invariants and properties:
/// - Q-table update invariants
/// - Monotonicity properties
/// - Bellman equation correctness
/// - Federated learning properties

use proptest::prelude::*;
use edge_agent_wasm::q_learning::{QTableWasm, QLearningConfig, QUpdateBatch};
use rand;

// =========================================================================
// Q-Update Invariants
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Q-value updates should always stay within reasonable bounds
    #[test]
    fn prop_q_update_bounds(
        initial_q in -100.0f32..100.0f32,
        reward in -10.0f32..10.0f32,
        next_max_q in -10.0f32..10.0f32,
        alpha in 0.01f32..1.0f32,
        gamma in 0.0f32..1.0f32,
    ) {
        let mut config = QLearningConfig::default();
        config.alpha = alpha;
        config.gamma = gamma;

        let mut q_table = QTableWasm::new(config);
        q_table.set_q_value("s0", "a0", initial_q);

        let new_q = q_table.update_q_value("s0", "a0", reward, next_max_q);

        // Q-values should stay within reasonable bounds
        // With the update formula, extreme values are possible but not infinite
        prop_assert!(new_q.is_finite());
        prop_assert!(new_q > -1000.0 && new_q < 1000.0, "Q-value should stay bounded");
    }

    /// Positive rewards should not decrease Q-value when next_max_q >= 0
    #[test]
    fn prop_positive_reward_monotonic(
        initial_q in -10.0f32..10.0f32,
        reward in 0.1f32..10.0f32,
        next_max_q in 0.0f32..10.0f32,
        alpha in 0.01f32..0.5f32,
    ) {
        let mut config = QLearningConfig::default();
        config.alpha = alpha;

        let mut q_table = QTableWasm::new(config);
        q_table.set_q_value("s0", "a0", initial_q);

        let new_q = q_table.update_q_value("s0", "a0", reward, next_max_q);

        // With positive reward and non-negative future value, Q should not decrease significantly
        // It may stay same or increase, but not decrease much
        prop_assert!(new_q >= initial_q - 0.01, "Positive reward should not decrease Q significantly");
    }

    /// Q-update should satisfy Bellman equation exactly
    #[test]
    fn prop_bellman_equation(
        current_q in -10.0f32..10.0f32,
        reward in -5.0f32..5.0f32,
        next_max_q in -5.0f32..5.0f32,
        alpha in 0.01f32..1.0f32,
        gamma in 0.0f32..1.0f32,
    ) {
        let mut config = QLearningConfig::default();
        config.alpha = alpha;
        config.gamma = gamma;

        let mut q_table = QTableWasm::new(config);
        q_table.set_q_value("s0", "a0", current_q);

        // Expected new Q from Bellman equation
        let target = reward + gamma * next_max_q;
        let td_error = target - current_q;
        let expected_q = current_q + alpha * td_error;

        let actual_q = q_table.update_q_value("s0", "a0", reward, next_max_q);

        prop_assert!((actual_q - expected_q).abs() < 0.001,
            "Q-update should match Bellman equation: expected {}, got {}",
            expected_q, actual_q
        );
    }

    /// Discount factor gamma should reduce future value impact
    #[test]
    fn prop_gamma_discounts_future(
        reward in 1.0f32..10.0f32,
        next_max_q in 1.0f32..10.0f32,
        gamma1 in 0.1f32..0.5f32,
        gamma2 in 0.6f32..0.99f32,
    ) {
        let mut config1 = QLearningConfig::default();
        config1.gamma = gamma1;
        let mut config2 = QLearningConfig::default();
        config2.gamma = gamma2;

        let mut qt1 = QTableWasm::new(config1);
        let mut qt2 = QTableWasm::new(config2);

        qt1.set_q_value("s0", "a0", 0.0);
        qt2.set_q_value("s0", "a0", 0.0);

        let q1 = qt1.update_q_value("s0", "a0", reward, next_max_q);
        let q2 = qt2.update_q_value("s0", "a0", reward, next_max_q);

        // Higher gamma should give more weight to future value
        prop_assert!(q2 > q1 || q1 == q2,
            "Higher gamma ({}) should produce higher Q than lower gamma ({}): {} vs {}",
            gamma2, gamma1, q2, q1
        );
    }

    /// Learning rate alpha should control update speed
    #[test]
    fn prop_alpha_controls_speed(
        current_q in 0.0f32..10.0f32,
        reward in -5.0f32..5.0f32,
        alpha1 in 0.01f32..0.1f32,
        alpha2 in 0.5f32..1.0f32,
    ) {
        let mut config1 = QLearningConfig::default();
        config1.alpha = alpha1;
        let mut config2 = QLearningConfig::default();
        config2.alpha = alpha2;

        let mut qt1 = QTableWasm::new(config1);
        let mut qt2 = QTableWasm::new(config2);

        qt1.set_q_value("s0", "a0", current_q);
        qt2.set_q_value("s0", "a0", current_q);

        let q1 = qt1.update_q_value("s0", "a0", reward, 0.0);
        let q2 = qt2.update_q_value("s0", "a0", reward, 0.0);

        let target = reward;

        // Higher alpha should move Q closer to target
        let diff1 = (target - q1).abs();
        let diff2 = (target - q2).abs();

        prop_assert!(diff2 <= diff1 + 0.001,
            "Higher alpha should move Q closer to target: diff2={}, diff1={}",
            diff2, diff1
        );
    }

    /// Epsilon should stay in [0, 1] after decay
    #[test]
    fn prop_epsilon_bounds(
        initial_epsilon in 0.1f32..1.0f32,
        decay in 0.9f32..1.0f32,
        iterations in 1u32..100u32,
    ) {
        let mut config = QLearningConfig::default();
        config.epsilon = initial_epsilon;
        config.epsilon_decay = decay;

        let mut q_table = QTableWasm::new(config);

        for _ in 0..iterations {
            q_table.decay_epsilon();
        }

        prop_assert!(q_table.current_epsilon >= 0.0 && q_table.current_epsilon <= 1.0,
            "Epsilon should stay in [0, 1], got {}",
            q_table.current_epsilon
        );
    }

    /// Epsilon should monotonically decrease with decay < 1
    #[test]
    fn prop_epsilon_monotonic_decrease(
        initial_epsilon in 0.2f32..1.0f32,
        decay in 0.9f32..0.999f32,
        iterations in 2u32..50u32,
    ) {
        let mut config = QLearningConfig::default();
        config.epsilon = initial_epsilon;
        config.epsilon_decay = decay;

        let mut q_table = QTableWasm::new(config);

        let first_epsilon = q_table.current_epsilon;
        for _ in 0..iterations {
            q_table.decay_epsilon();
        }
        let last_epsilon = q_table.current_epsilon;

        prop_assert!(last_epsilon < first_epsilon,
            "Epsilon should decrease: {} -> {}",
            first_epsilon, last_epsilon
        );
    }

    /// Batch update should be equivalent to individual updates
    #[test]
    fn prop_batch_equivalence(
        seed in 0u32..10000u32,
        batch_size in 2usize..10usize,
    ) {
        use std::collections::HashMap;

        let mut config = QLearningConfig::default();
        config.alpha = 0.1;
        config.gamma = 0.95;

        let mut rng = rand::thread_rng();
        let mut individual_qt = QTableWasm::new(config.clone());
        let mut batch_qt = QTableWasm::new(config);

        let mut batch = Vec::new();

        for i in 0..batch_size {
            let state = format!("s{}", i);
            let action = format!("a{}", i);
            let current_q = (i as f32) * 0.1;
            let reward = (i as f32) % 5.0;
            let next_max_q = (i as f32) % 3.0;

            individual_qt.set_q_value(&state, &action, current_q);
            batch_qt.set_q_value(&state, &action, current_q);

            // Individual update
            individual_qt.update_q_value(&state, &action, reward, next_max_q);

            batch.push(QUpdateBatch {
                state_action_key: format!("{}::{}", state, action),
                current_q,
                reward,
                next_max_q,
                visit_count: 1,
            });
        }

        // Batch update
        batch_qt.batch_update(batch);

        // Results should be similar (allowing for small floating-point differences)
        for i in 0..batch_size {
            let state = format!("s{}", i);
            let action = format!("a{}", i);

            let individual_q = individual_qt.get_q_value(&state, &action);
            let batch_q = batch_qt.get_q_value(&state, &action);

            prop_assert!((individual_q - batch_q).abs() < 0.01,
                "Individual and batch updates should match: {} vs {}",
                individual_q, batch_q
            );
        }
    }
}

// =========================================================================
// Federated Learning Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Merge with weight 0.0 should keep original values
    #[test]
    fn prop_merge_zero_weight(
        q1 in -10.0f32..10.0f32,
        q2 in -10.0f32..10.0f32,
    ) {
        let mut config = QLearningConfig::default();
        let mut qt1 = QTableWasm::new(config.clone());
        let qt2 = QTableWasm::new(config);

        qt1.set_q_value("s0", "a0", q1);
        qt2.set_q_value("s0", "a0", q2);

        qt1.merge_from(&qt2, 0.0);

        prop_assert!((qt1.get_q_value("s0", "a0") - q1).abs() < 0.001,
            "Merge with weight 0 should keep original: {} vs {}",
            qt1.get_q_value("s0", "a0"), q1
        );
    }

    /// Merge with weight 1.0 should fully adopt other values
    #[test]
    fn prop_merge_full_weight(
        q1 in -10.0f32..10.0f32,
        q2 in -10.0f32..10.0f32,
    ) {
        let mut config = QLearningConfig::default();
        let mut qt1 = QTableWasm::new(config.clone());
        let qt2 = QTableWasm::new(config);

        qt1.set_q_value("s0", "a0", q1);
        qt2.set_q_value("s0", "a0", q2);

        qt1.merge_from(&qt2, 1.0);

        prop_assert!((qt1.get_q_value("s0", "a0") - q2).abs() < 0.001,
            "Merge with weight 1 should adopt other: {} vs {}",
            qt1.get_q_value("s0", "a0"), q2
        );
    }

    /// Merge with equal weights should average
    #[test]
    fn prop_merge_average(
        q1 in -10.0f32..10.0f32,
        q2 in -10.0f32..10.0f32,
    ) {
        let mut config = QLearningConfig::default();
        let mut qt1 = QTableWasm::new(config.clone());
        let qt2 = QTableWasm::new(config);

        qt1.set_q_value("s0", "a0", q1);
        qt2.set_q_value("s0", "a0", q2);

        qt1.merge_from(&qt2, 0.5);

        let expected = (q1 + q2) / 2.0;
        prop_assert!((qt1.get_q_value("s0", "a0") - expected).abs() < 0.001,
            "Merge with weight 0.5 should average: {} vs {}",
            qt1.get_q_value("s0", "a0"), expected
        );
    }

    /// Merge should be commutative with symmetric weights
    #[test]
    fn prop_merge_commutative(
        q1 in -10.0f32..10.0f32,
        q2 in -10.0f32..10.0f32,
        weight in 0.1f32..0.9f32,
    ) {
        let config = QLearningConfig::default();

        let mut qt1a = QTableWasm::new(config.clone());
        let mut qt2a = QTableWasm::new(config.clone());
        let mut qt1b = QTableWasm::new(config.clone());
        let mut qt2b = QTableWasm::new(config);

        qt1a.set_q_value("s0", "a0", q1);
        qt2a.set_q_value("s0", "a0", q2);
        qt1b.set_q_value("s0", "a0", q1);
        qt2b.set_q_value("s0", "a0", q2);

        // Merge in one direction
        qt1a.merge_from(&qt2a, weight);

        // Merge in opposite direction with complementary weight
        qt2b.merge_from(&qt1b, 1.0 - weight);

        prop_assert!((qt1a.get_q_value("s0", "a0") - qt2b.get_q_value("s0", "a0")).abs() < 0.001,
            "Commutative merge should give same result: {} vs {}",
            qt1a.get_q_value("s0", "a0"), qt2b.get_q_value("s0", "a0")
        );
    }

    /// Merge should handle missing entries
    #[test]
    fn prop_merge_missing_entries(
        q1 in -10.0f32..10.0f32,
        q2 in -10.0f32..10.0f32,
        weight in 0.0f32..1.0f32,
    ) {
        let mut config = QLearningConfig::default();
        let mut qt1 = QTableWasm::new(config.clone());
        let qt2 = QTableWasm::new(config);

        qt1.set_q_value("s0", "a0", q1);
        // qt2 doesn't have this entry

        qt1.merge_from(&qt2, weight);

        // Entry should still exist with original value weighted by (1 - weight)
        let expected = q1 * (1.0 - weight);
        prop_assert!((qt1.get_q_value("s0", "a0") - expected).abs() < 0.001,
            "Missing entry should be handled correctly: {} vs {}",
            qt1.get_q_value("s0", "a0"), expected
        );
    }
}

// =========================================================================
// Statistics Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Min Q-value should be <= mean Q-value
    #[test]
    fn prop_stats_min_le_mean(
        values in prop::collection::vec(-10.0f32..10.0f32, 1..20),
    ) {
        let config = QLearningConfig::default();
        let mut q_table = QTableWasm::new(config);

        for (i, &val) in values.iter().enumerate() {
            q_table.set_q_value("s0", &format!("a{}", i), val);
        }

        let stats = q_table.get_stats();

        if !values.is_empty() {
            prop_assert!(stats.min_q_value <= stats.mean_q_value + 0.001,
                "Min should be <= mean: {} <= {}",
                stats.min_q_value, stats.mean_q_value
            );
        }
    }

    /// Mean Q-value should be between min and max
    #[test]
    fn prop_stats_mean_between_min_max(
        values in prop::collection::vec(-10.0f32..10.0f32, 1..20),
    ) {
        let config = QLearningConfig::default();
        let mut q_table = QTableWasm::new(config);

        for (i, &val) in values.iter().enumerate() {
            q_table.set_q_value("s0", &format!("a{}", i), val);
        }

        let stats = q_table.get_stats();

        if !values.is_empty() {
            prop_assert!(stats.min_q_value <= stats.mean_q_value + 0.001);
            prop_assert!(stats.mean_q_value <= stats.max_q_value + 0.001,
                "Mean should be between min and max: {} <= {} <= {}",
                stats.min_q_value, stats.mean_q_value, stats.max_q_value
            );
        }
    }

    /// Stats should count all entries correctly
    #[test]
    fn prop_stats_entry_count(
        num_entries in 1usize..50usize,
    ) {
        let config = QLearningConfig::default();
        let mut q_table = QTableWasm::new(config);

        for i in 0..num_entries {
            q_table.set_q_value("s0", &format!("a{}", i), i as f32);
        }

        let stats = q_table.get_stats();

        prop_assert_eq!(stats.entries_count as usize, num_entries);
    }
}
