//! Integration tests for encoding and policy modules

use elex_qlearning::encoding::{QueryType, Complexity, confidence_bucket, hash_context};
use elex_qlearning::policy::{Action, EpsilonGreedy, Policy};
use elex_qlearning::qtable::{QTable, QLearningConfig, StateHash};

#[test]
fn test_encoding_basic() {
    // Test QueryType enum
    assert_eq!(QueryType::Parameter.index(), 0);
    assert_eq!(QueryType::Counter.index(), 1);
    assert_eq!(QueryType::Kpi.index(), 2);
    assert_eq!(QueryType::Procedure.index(), 3);
    assert_eq!(QueryType::Troubleshoot.index(), 4);
    assert_eq!(QueryType::General.index(), 5);

    // Test Complexity enum
    assert_eq!(Complexity::Simple.index(), 0);
    assert_eq!(Complexity::Moderate.index(), 1);
    assert_eq!(Complexity::Complex.index(), 2);

    // Test confidence bucket
    assert_eq!(confidence_bucket(0.0), 0);
    assert_eq!(confidence_bucket(1.0), 15);
}

#[test]
fn test_policy_basic() {
    let mut policy = EpsilonGreedy::new(42, true);

    assert_eq!(policy.epsilon(), 0.1);
    assert!(policy.is_exploration_enabled());
    assert_eq!(policy.name(), "epsilon-greedy");

    // Test epsilon decay
    policy.decay_epsilon();
    assert!(policy.epsilon() < 0.1);
}

#[test]
fn test_policy_without_exploration() {
    let mut policy = EpsilonGreedy::new(42, false); // exploration disabled

    assert!(!policy.is_exploration_enabled());

    let config = QLearningConfig::elex_default();
    let mut qt = QTable::new(config);
    let state = 12345u64;

    // Set up Q-values
    qt.set_q_value(state, Action::DirectAnswer, 0.3);
    qt.set_q_value(state, Action::ContextAnswer, 0.8);

    let selection = policy.select_action(&qt, state, Action::all());

    // Without exploration, should always exploit (select best action)
    assert!(!selection.is_exploration);
    assert_eq!(selection.action, Action::ContextAnswer);
}

#[test]
fn test_epsilon_decay_to_minimum() {
    let mut policy = EpsilonGreedy::new(42, true);
    policy = policy.with_epsilon(0.011, 0.01, 0.995); // Just above min

    // Decay multiple times
    for _ in 0..10 {
        policy.decay_epsilon();
    }

    // Should reach minimum
    assert_eq!(policy.epsilon(), 0.01);
}

#[test]
fn test_hash_context() {
    let hash1 = hash_context("test query");
    let hash2 = hash_context("test query");
    let hash3 = hash_context("different query");

    // Same input should produce same hash
    assert_eq!(hash1, hash2);

    // Different input should produce different hash
    assert_ne!(hash1, hash3);
}
