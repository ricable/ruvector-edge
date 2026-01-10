/// Test Vectors for Q-Table Operations (ADR-016)
///
/// Provides predefined test data for:
/// - Q-table initial states
/// - Bellman update scenarios
/// - Epsilon-greedy selection cases
/// - Federated learning merge scenarios

use edge_agent_wasm::q_learning::{QTableWasm, QLearningConfig, QUpdateBatch};
use edge_agent_wasm::feature_agent::AgentAction;

/// Create a Q-table with predefined Q-values for testing
pub fn create_prepopulated_q_table() -> QTableWasm {
    let config = QLearningConfig::default();
    let mut q_table = QTableWasm::new(config);

    // State s0 with varying Q-values
    q_table.set_q_value("s0", "a0", 0.3);
    q_table.set_q_value("s0", "a1", 0.7);
    q_table.set_q_value("s0", "a2", 0.5);

    // State s1
    q_table.set_q_value("s1", "a0", -0.2);
    q_table.set_q_value("s1", "a1", 0.1);

    // State s2
    q_table.set_q_value("s2", "a0", 0.9);
    q_table.set_q_value("s2", "a1", 0.8);
    q_table.set_q_value("s2", "a2", 0.85);

    q_table
}

/// Create a batch of Q-update test data
pub fn create_test_batch() -> Vec<QUpdateBatch> {
    vec![
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
        QUpdateBatch {
            state_action_key: "s2::a2".to_string(),
            current_q: 0.0,
            reward: -0.5,
            next_max_q: 0.1,
            visit_count: 1,
        },
    ]
}

/// Test cases for Bellman update verification
pub struct BellmanTestCase {
    pub current_q: f32,
    pub reward: f32,
    pub next_max_q: f32,
    pub alpha: f32,
    pub gamma: f32,
    pub expected_new_q: f32,
}

pub fn bellman_test_cases() -> Vec<BellmanTestCase> {
    vec![
        // Basic case: Q = 0 + 0.1 * (1.0 + 0.95*0 - 0) = 0.1
        BellmanTestCase {
            current_q: 0.0,
            reward: 1.0,
            next_max_q: 0.0,
            alpha: 0.1,
            gamma: 0.95,
            expected_new_q: 0.1,
        },
        // With future value: Q = 0 + 0.1 * (1.0 + 0.95*0.5 - 0) = 0.1475
        BellmanTestCase {
            current_q: 0.0,
            reward: 1.0,
            next_max_q: 0.5,
            alpha: 0.1,
            gamma: 0.95,
            expected_new_q: 0.1475,
        },
        // With existing Q: Q = 0.5 + 0.1 * (1.0 + 0.95*0.8 - 0.5) = 0.5 + 0.126 = 0.626
        BellmanTestCase {
            current_q: 0.5,
            reward: 1.0,
            next_max_q: 0.8,
            alpha: 0.1,
            gamma: 0.95,
            expected_new_q: 0.626,
        },
        // Negative reward: Q = 0.5 + 0.1 * (-1.0 + 0 - 0.5) = 0.5 - 0.15 = 0.35
        BellmanTestCase {
            current_q: 0.5,
            reward: -1.0,
            next_max_q: 0.0,
            alpha: 0.1,
            gamma: 0.95,
            expected_new_q: 0.35,
        },
        // High learning rate: Q = 0.0 + 0.5 * (1.0 + 0 - 0) = 0.5
        BellmanTestCase {
            current_q: 0.0,
            reward: 1.0,
            next_max_q: 0.0,
            alpha: 0.5,
            gamma: 0.95,
            expected_new_q: 0.5,
        },
    ]
}

/// Test vectors for epsilon-greedy exploration
pub struct EpsilonGreedyTestCase {
    pub epsilon: f32,
    pub should_explore: bool,
}

pub fn epsilon_greedy_test_cases() -> Vec<EpsilonGreedyTestCase> {
    vec![
        // High epsilon - always explore (for test)
        EpsilonGreedyTestCase {
            epsilon: 1.0,
            should_explore: true,
        },
        // Low epsilon - always exploit (for test)
        EpsilonGreedyTestCase {
            epsilon: 0.0,
            should_explore: false,
        },
        // Medium epsilon - either
        EpsilonGreedyTestCase {
            epsilon: 0.15,
            should_explore: false, // Default assumption
        },
    ]
}

/// Test vectors for federated learning merge
pub struct FederatedMergeTestCase {
    pub q1_values: Vec<(String, String, f32)>,
    pub q2_values: Vec<(String, String, f32)>,
    pub weight: f32,
    pub expected_merged: Vec<(String, String, f32)>,
}

pub fn federated_merge_test_cases() -> Vec<FederatedMergeTestCase> {
    vec![
        // Equal weight merge
        FederatedMergeTestCase {
            q1_values: vec![("s0".to_string(), "a0".to_string(), 0.8)],
            q2_values: vec![("s0".to_string(), "a0".to_string(), 0.6)],
            weight: 0.5,
            expected_merged: vec![("s0".to_string(), "a0".to_string(), 0.7)],
        },
        // Weighted merge (more weight to q2)
        FederatedMergeTestCase {
            q1_values: vec![("s0".to_string(), "a0".to_string(), 1.0)],
            q2_values: vec![("s0".to_string(), "a0".to_string(), 0.0)],
            weight: 0.7,
            expected_merged: vec![("s0".to_string(), "a0".to_string(), 0.3)], // 1.0*0.3 + 0.0*0.7
        },
        // New entry from q2
        FederatedMergeTestCase {
            q1_values: vec![("s0".to_string(), "a0".to_string(), 0.5)],
            q2_values: vec![
                ("s0".to_string(), "a0".to_string(), 0.7),
                ("s0".to_string(), "a1".to_string(), 0.9),
            ],
            weight: 0.5,
            expected_merged: vec![
                ("s0".to_string(), "a0".to_string(), 0.6),
                ("s0".to_string(), "a1".to_string(), 0.45), // New entry weighted
            ],
        },
    ]
}

/// Create test actions for epsilon-greedy selection
pub fn create_test_actions() -> Vec<AgentAction> {
    vec![
        AgentAction::DirectAnswer,
        AgentAction::ContextAnswer,
        AgentAction::ConsultPeer,
        AgentAction::RequestClarification,
        AgentAction::Escalate,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prepopulated_q_table() {
        let q_table = create_prepopulated_q_table();

        assert_eq!(q_table.get_q_value("s0", "a0"), 0.3);
        assert_eq!(q_table.get_q_value("s0", "a1"), 0.7);
        assert_eq!(q_table.get_q_value("s0", "a2"), 0.5);
        assert_eq!(q_table.get_q_value("s1", "a0"), -0.2);
        assert_eq!(q_table.get_q_value("s1", "a1"), 0.1);
        assert_eq!(q_table.get_q_value("s2", "a0"), 0.9);
        assert_eq!(q_table.get_q_value("s2", "a1"), 0.8);
        assert_eq!(q_table.get_q_value("s2", "a2"), 0.85);
    }

    #[test]
    fn test_bellman_cases() {
        let cases = bellman_test_cases();

        for case in cases {
            let mut config = QLearningConfig::default();
            config.alpha = case.alpha;
            config.gamma = case.gamma;

            let mut q_table = QTableWasm::new(config);
            q_table.set_q_value("s0", "a0", case.current_q);

            let new_q = q_table.update_q_value("s0", "a0", case.reward, case.next_max_q);

            assert!(
                (new_q - case.expected_new_q).abs() < 0.001,
                "Bellman update failed: expected {}, got {}",
                case.expected_new_q,
                new_q
            );
        }
    }

    #[test]
    fn test_federated_merge_cases() {
        let cases = federated_merge_test_cases();

        for case in cases {
            let mut config1 = QLearningConfig::default();
            let mut config2 = QLearningConfig::default();
            let mut qt1 = QTableWasm::new(config1);
            let qt2 = QTableWasm::new(config2);

            for (state, action, value) in &case.q1_values {
                qt1.set_q_value(state, action, *value);
            }

            for (state, action, value) in &case.q2_values {
                qt2.set_q_value(state, action, *value);
            }

            qt1.merge_from(&qt2, case.weight);

            for (state, action, expected_value) in &case.expected_merged {
                let actual = qt1.get_q_value(state, action);
                assert!(
                    (actual - expected_value).abs() < 0.01,
                    "Merge failed for {}::{}: expected {}, got {}",
                    state,
                    action,
                    expected_value,
                    actual
                );
            }
        }
    }

    #[test]
    fn test_create_test_actions() {
        let actions = create_test_actions();
        assert_eq!(actions.len(), 5);
    }
}
