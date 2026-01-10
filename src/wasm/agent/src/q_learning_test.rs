/// Unit Tests for Q-Learning Module (ADR-016)
///
/// Tests cover:
/// - Q-table initialization and operations
/// - Bellman update correctness
/// - Epsilon-greedy exploration
/// - Batch updates with SIMD
/// - Federated learning merge
/// - Statistics computation

#[cfg(test)]
mod q_learning_unit_tests {
    use crate::q_learning::{QTableWasm, QLearningConfig, QUpdateBatch, QTableStats};
    use crate::feature_agent::AgentAction;

    const EPSILON: f32 = 1e-6;

    fn assert_float_eq(a: f32, b: f32, msg: &str) {
        assert!((a - b).abs() < EPSILON, "{}: expected {}, got {}", msg, b, a);
    }

    fn create_test_config() -> QLearningConfig {
        QLearningConfig {
            alpha: 0.1,
            gamma: 0.95,
            epsilon: 0.15,
            epsilon_decay: 0.995,
            initial_q_value: 0.0,
        }
    }

    #[test]
    fn test_q_table_initialization() {
        let config = create_test_config();
        let q_table = QTableWasm::new(config);

        assert_eq!(q_table.entries.len(), 0, "New Q-table should be empty");
        assert_eq!(q_table.total_updates, 0, "Update count should be 0");
        assert_eq!(q_table.total_episodes, 0, "Episode count should be 0");
        assert_float_eq(q_table.alpha, 0.1, "Alpha");
        assert_float_eq(q_table.gamma, 0.95, "Gamma");
        assert_float_eq(q_table.current_epsilon, 0.15, "Epsilon");
    }

    #[test]
    fn test_q_table_initial_values() {
        let q_table = QTableWasm::new(create_test_config());

        // All Q-values should default to 0.0
        assert_float_eq(q_table.get_q_value("s0", "a0"), 0.0, "Initial Q-value");
        assert_float_eq(q_table.get_q_value("unknown_state", "unknown_action"), 0.0, "Unknown Q-value");
    }

    #[test]
    fn test_q_value_set_and_get() {
        let mut q_table = QTableWasm::new(create_test_config());

        q_table.set_q_value("s0", "a0", 0.5);
        assert_float_eq(q_table.get_q_value("s0", "a0"), 0.5, "Set Q-value");

        q_table.set_q_value("s0", "a1", -0.3);
        assert_float_eq(q_table.get_q_value("s0", "a1"), -0.3, "Negative Q-value");
    }

    #[test]
    fn test_bellman_update_formula() {
        let mut q_table = QTableWasm::new(create_test_config());

        // Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
        // With Q(s,a)=0, r=1.0, max(Q(s',a'))=0.5, α=0.1, γ=0.95:
        // Q(s,a) = 0 + 0.1 * (1.0 + 0.95*0.5 - 0) = 0.1 * 1.475 = 0.1475
        let new_q = q_table.update_q_value("s0", "a0", 1.0, 0.5);
        assert_float_eq(new_q, 0.1475, "Bellman update");

        // Verify stored value
        assert_float_eq(q_table.get_q_value("s0", "a0"), 0.1475, "Stored Q-value");
        assert_eq!(q_table.total_updates, 1, "Update count");
    }

    #[test]
    fn test_bellman_update_with_existing_q() {
        let mut q_table = QTableWasm::new(create_test_config());

        // Set initial Q-value
        q_table.set_q_value("s0", "a0", 0.5);

        // Update: Q(s,a) = 0.5 + 0.1 * (1.0 + 0.95*0.8 - 0.5)
        // Q(s,a) = 0.5 + 0.1 * (1.0 + 0.76 - 0.5) = 0.5 + 0.1 * 1.26 = 0.626
        let new_q = q_table.update_q_value("s0", "a0", 1.0, 0.8);
        assert_float_eq(new_q, 0.626, "Update with existing Q");
    }

    #[test]
    fn test_get_max_q() {
        let mut q_table = QTableWasm::new(create_test_config());

        q_table.set_q_value("s0", "a0", 0.3);
        q_table.set_q_value("s0", "a1", 0.7);
        q_table.set_q_value("s0", "a2", 0.5);

        let actions = vec![
            AgentAction::DirectAnswer,
            AgentAction::ContextAnswer,
            AgentAction::ConsultPeer,
        ];

        let max_q = q_table.get_max_q("s0", &actions);
        assert_float_eq(max_q, 0.7, "Max Q-value");
    }

    #[test]
    fn test_get_max_q_empty() {
        let q_table = QTableWasm::new(create_test_config());
        let actions = vec![AgentAction::DirectAnswer];

        // Should return negative infinity if no Q-values exist
        let max_q = q_table.get_max_q("s0", &actions);
        assert!(max_q.is_finite(), "Max Q should be finite");
        assert!(max_q < 0.0, "Max Q should be negative for empty table");
    }

    #[test]
    fn test_select_action_returns_valid() {
        let q_table = QTableWasm::new(create_test_config());
        let actions = vec![
            AgentAction::DirectAnswer,
            AgentAction::ContextAnswer,
            AgentAction::ConsultPeer,
        ];

        let (action, q_value, is_exploration) = q_table.select_action("s0", &actions);

        assert!(actions.contains(&action), "Selected action should be valid");
        assert!(q_value >= 0.0 || q_value.is_finite(), "Q-value should be valid");
    }

    #[test]
    fn test_epsilon_decay() {
        let config = QLearningConfig {
            epsilon_decay: 0.99,
            ..create_test_config()
        };
        let mut q_table = QTableWasm::new(config);

        let initial_epsilon = q_table.current_epsilon;
        q_table.decay_epsilon();

        assert!(q_table.current_epsilon < initial_epsilon, "Epsilon should decay");
        assert_float_eq(q_table.current_epsilon, initial_epsilon * 0.99, "Decay amount");
        assert_eq!(q_table.total_episodes, 1, "Episode count");
    }

    #[test]
    fn test_epsilon_decay_minimum() {
        let config = QLearningConfig {
            epsilon: 0.01,
            epsilon_decay: 0.5,
            ..create_test_config()
        };
        let mut q_table = QTableWasm::new(config);

        // Decay multiple times
        for _ in 0..10 {
            q_table.decay_epsilon();
        }

        // Should clamp at minimum 0.01
        assert_float_eq(q_table.current_epsilon, 0.01, "Minimum epsilon");
    }

    #[test]
    fn test_batch_update() {
        let mut q_table = QTableWasm::new(create_test_config());

        let batch = vec![
            QUpdateBatch {
                state_action_key: "s0::a0".to_string(),
                current_q: 0.0,
                reward: 1.0,
                next_max_q: 0.5,
                visit_count: 1,
            },
            QUpdateBatch {
                state_action_key: "s1::a1".to_string(),
                current_q: 0.0,
                reward: 0.5,
                next_max_q: 0.3,
                visit_count: 1,
            },
        ];

        q_table.batch_update(batch);

        assert_eq!(q_table.entries.len(), 2, "Batch should add entries");
        assert_eq!(q_table.total_updates, 2, "Update count");
    }

    #[test]
    fn test_batch_update_empty() {
        let mut q_table = QTableWasm::new(create_test_config());
        q_table.batch_update(vec![]);

        assert_eq!(q_table.entries.len(), 0, "Empty batch should not add entries");
    }

    #[test]
    fn test_batch_update_correctness() {
        let mut q_table = QTableWasm::new(create_test_config());

        let batch = vec![
            QUpdateBatch {
                state_action_key: "s0::a0".to_string(),
                current_q: 0.0,
                reward: 1.0,
                next_max_q: 0.0,
                visit_count: 1,
            },
        ];

        q_table.batch_update(batch);

        // Q = 0 + 0.1 * (1.0 + 0.95*0 - 0) = 0.1
        let updated_q = q_table.get_q_value("s0", "a0");
        assert_float_eq(updated_q, 0.1, "Batch update Q-value");
    }

    #[test]
    fn test_federated_learning_merge_equal() {
        let mut q_table1 = QTableWasm::new(create_test_config());
        let mut q_table2 = QTableWasm::new(create_test_config());

        q_table1.set_q_value("s0", "a0", 0.8);
        q_table2.set_q_value("s0", "a0", 0.6);

        // Merge with equal weights: (0.8 + 0.6) / 2 = 0.7
        q_table1.merge_from(&q_table2, 0.5);

        let merged = q_table1.get_q_value("s0", "a0");
        assert_float_eq(merged, 0.7, "Merged Q-value (equal weight)");
    }

    #[test]
    fn test_federated_learning_merge_weighted() {
        let mut q_table1 = QTableWasm::new(create_test_config());
        let mut q_table2 = QTableWasm::new(create_test_config());

        q_table1.set_q_value("s0", "a0", 1.0);
        q_table2.set_q_value("s0", "a0", 0.0);

        // Merge with 0.3 weight from q_table2: 1.0 * 0.7 + 0.0 * 0.3 = 0.7
        q_table1.merge_from(&q_table2, 0.3);

        let merged = q_table1.get_q_value("s0", "a0");
        assert_float_eq(merged, 0.7, "Merged Q-value (weighted)");
    }

    #[test]
    fn test_federated_learning_merge_new_entry() {
        let mut q_table1 = QTableWasm::new(create_test_config());
        let mut q_table2 = QTableWasm::new(create_test_config());

        q_table1.set_q_value("s0", "a0", 0.5);
        q_table2.set_q_value("s0", "a1", 0.7);

        q_table1.merge_from(&q_table2, 0.5);

        // Both entries should exist
        assert_float_eq(q_table1.get_q_value("s0", "a0"), 0.5, "Existing entry");
        assert_float_eq(q_table1.get_q_value("s0", "a1"), 0.35, "New entry (weighted)");
    }

    #[test]
    fn test_federated_learning_merge_clamps_weight() {
        let mut q_table1 = QTableWasm::new(create_test_config());
        let mut q_table2 = QTableWasm::new(create_test_config());

        q_table1.set_q_value("s0", "a0", 1.0);
        q_table2.set_q_value("s0", "a0", 0.0);

        // Weight > 1.0 should be clamped to 1.0 (fully adopt other)
        q_table1.merge_from(&q_table2, 1.5);

        let merged = q_table1.get_q_value("s0", "a0");
        assert_float_eq(merged, 0.0, "Weight clamped to 1.0");
    }

    #[test]
    fn test_q_table_stats() {
        let mut q_table = QTableWasm::new(create_test_config());

        q_table.set_q_value("s0", "a0", 0.3);
        q_table.set_q_value("s0", "a1", 0.7);
        q_table.set_q_value("s0", "a2", 0.5);
        q_table.update_q_value("s0", "a0", 1.0, 0.5);
        q_table.decay_epsilon();

        let stats = q_table.get_stats();

        assert_eq!(stats.entries_count, 3, "Entries count");
        assert_eq!(stats.total_updates, 1, "Total updates");
        assert_eq!(stats.total_episodes, 1, "Total episodes");
        assert_float_eq(stats.min_q_value, 0.3, "Min Q-value");
        assert_float_eq(stats.max_q_value, 0.7, "Max Q-value");
        assert_float_eq(stats.mean_q_value, 0.5, "Mean Q-value (average of 0.3, 0.5, 0.7)");
    }

    #[test]
    fn test_q_table_stats_empty() {
        let q_table = QTableWasm::new(create_test_config());
        let stats = q_table.get_stats();

        assert_eq!(stats.entries_count, 0, "Empty entries");
        assert_float_eq(stats.min_q_value, 0.0, "Min Q (empty)");
        assert_float_eq(stats.max_q_value, 0.0, "Max Q (empty)");
        assert_float_eq(stats.mean_q_value, 0.0, "Mean Q (empty)");
    }

    #[test]
    fn test_q_table_reset() {
        let mut q_table = QTableWasm::new(create_test_config());

        q_table.set_q_value("s0", "a0", 0.5);
        q_table.update_q_value("s0", "a0", 1.0, 0.5);
        q_table.decay_epsilon();

        q_table.reset();

        assert_eq!(q_table.entries.len(), 0, "Entries cleared");
        assert_eq!(q_table.total_updates, 0, "Updates reset");
        assert_eq!(q_table.total_episodes, 0, "Episodes reset");
        assert_float_eq(q_table.current_epsilon, 0.15, "Epsilon reset");
    }

    #[test]
    fn test_multiple_updates_converge() {
        let mut q_table = QTableWasm::new(create_test_config());

        // Repeatedly update the same state-action pair with positive rewards
        let mut q_value = 0.0;
        for _ in 0..10 {
            q_value = q_table.update_q_value("s0", "a0", 1.0, 0.0);
        }

        // Q-value should converge toward the reward
        assert!(q_value > 0.5, "Q-value should converge with positive rewards");
        assert!(q_value < 1.0, "Q-value should not exceed reward");
    }

    #[test]
    fn test_negative_rewards_decrease_q() {
        let mut q_table = QTableWasm::new(create_test_config());

        q_table.set_q_value("s0", "a0", 0.5);

        // Negative reward should decrease Q-value
        let new_q = q_table.update_q_value("s0", "a0", -1.0, 0.0);

        assert!(new_q < 0.5, "Negative reward should decrease Q-value");
    }

    #[test]
    fn test_serialization_roundtrip() {
        let mut q_table1 = QTableWasm::new(create_test_config());

        q_table1.set_q_value("s0", "a0", 0.5);
        q_table1.set_q_value("s1", "a1", 0.7);

        // Serialize
        let serialized = serde_json::to_string(&q_table1).unwrap();

        // Deserialize
        let q_table2: QTableWasm = serde_json::from_str(&serialized).unwrap();

        assert_float_eq(q_table2.get_q_value("s0", "a0"), 0.5, "Deserialized Q-value 1");
        assert_float_eq(q_table2.get_q_value("s1", "a1"), 0.7, "Deserialized Q-value 2");
    }
}
