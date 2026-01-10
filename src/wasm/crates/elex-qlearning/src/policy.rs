//! Epsilon-Greedy Policy
//!
//! Exploration-exploitation tradeoff for action selection with decay and user consent.

use serde::{Deserialize, Serialize};
use crate::qtable::{QTable, StateHash};
use rand::{Rng, SeedableRng, rngs::StdRng};

// ============================================================================
// Action Enum
// ============================================================================

/// Agent actions for Q-learning
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Action {
    DirectAnswer,
    ContextAnswer,
    ConsultPeer,
    RequestClarification,
    Escalate,
}

impl Action {
    pub fn all() -> &'static [Action] {
        &[
            Action::DirectAnswer,
            Action::ContextAnswer,
            Action::ConsultPeer,
            Action::RequestClarification,
            Action::Escalate,
        ]
    }

    pub fn index(&self) -> u8 {
        match self {
            Action::DirectAnswer => 0,
            Action::ContextAnswer => 1,
            Action::ConsultPeer => 2,
            Action::RequestClarification => 3,
            Action::Escalate => 4,
        }
    }
}

// ============================================================================
// Action Selection Result
// ============================================================================

/// Result of action selection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActionSelection {
    /// Selected action
    pub action: Action,
    /// Q-value of selected action
    pub q_value: f32,
    /// Whether this was an exploration action
    pub is_exploration: bool,
}

// ============================================================================
// Policy Trait
// ============================================================================

/// Action selection policy
pub trait Policy: Send + Sync {
    /// Select action based on Q-values
    fn select_action(
        &mut self,
        q_table: &QTable,
        state: StateHash,
        available_actions: &[Action],
    ) -> ActionSelection;

    /// Get policy name
    fn name(&self) -> &str;
}

// ============================================================================
// Epsilon-Greedy Policy
// ============================================================================

/// Epsilon-greedy action selection with decay and user consent
///
/// Implements the epsilon-greedy policy for balancing exploration and exploitation.
/// Epsilon decays over time from initial value to minimum, following:
/// `epsilon = max(epsilon_min, epsilon * decay_rate)`
///
/// # Features
/// - Epsilon decay from 0.1 to 0.01
/// - User-consent-based exploration toggle
/// - Deterministic with seeded RNG for reproducibility
/// - Best action selection when not exploring
#[derive(Clone, Debug)]
pub struct EpsilonGreedy {
    /// Current exploration rate
    epsilon: f32,
    /// Minimum exploration rate (prevents over-exploitation)
    epsilon_min: f32,
    /// Decay rate per selection
    decay_rate: f32,
    /// Whether exploration is enabled (user consent)
    exploration_enabled: bool,
    /// Seeded RNG for reproducibility
    rng: StdRng,
}

impl EpsilonGreedy {
    /// Create a new epsilon-greedy policy
    ///
    /// # Arguments
    /// * `seed` - RNG seed for reproducibility
    /// * `exploration_enabled` - Whether exploration requires user consent
    ///
    /// # Example
    /// ```ignore
    /// let policy = EpsilonGreedy::new(42, true);
    /// let action = policy.select_action(&q_table, &state, &available_actions);
    /// ```
    pub fn new(seed: u64, exploration_enabled: bool) -> Self {
        Self {
            epsilon: 0.1,
            epsilon_min: 0.01,
            decay_rate: 0.995,
            exploration_enabled,
            rng: StdRng::seed_from_u64(seed),
        }
    }

    /// Create with default settings (exploration enabled)
    pub fn default() -> Self {
        Self::new(42, true)
    }

    /// Create with exploration disabled (exploitation only)
    pub fn exploit_only(seed: u64) -> Self {
        Self::new(seed, false)
    }

    /// Set exploration enabled flag
    pub fn with_exploration(mut self, enabled: bool) -> Self {
        self.exploration_enabled = enabled;
        self
    }

    /// Set custom epsilon parameters
    pub fn with_epsilon(mut self, initial: f32, min: f32, decay: f32) -> Self {
        self.epsilon = initial;
        self.epsilon_min = min;
        self.decay_rate = decay;
        self
    }

    /// Select action using epsilon-greedy policy
    ///
    /// # Behavior
    /// - With probability epsilon: random action (explore)
    /// - With probability 1-epsilon: best action (exploit)
    /// - Exploration only occurs if `exploration_enabled` is true
    ///
    /// # Arguments
    /// * `q_table` - Q-table for value lookup
    /// * `state` - Current state hash
    /// * `available_actions` - Actions available in current state
    ///
    /// # Returns
    /// Selected action with metadata
    fn select_action_internal(
        &mut self,
        q_table: &QTable,
        state: StateHash,
        available_actions: &[Action],
    ) -> ActionSelection {
        // Check if we should explore
        let should_explore = self.exploration_enabled
            && self.rng.gen::<f32>() < self.epsilon;

        let (action, is_exploration) = if should_explore {
            // Explore: random action
            let action = if available_actions.is_empty() {
                Action::DirectAnswer
            } else {
                available_actions[self.rng.gen_range(0..available_actions.len())]
            };
            (action, true)
        } else {
            // Exploit: best action from Q-table
            let action = q_table.get_best_action(state);
            (action, false)
        };

        let q_value = q_table.get_q_value(state, action);

        // Decay epsilon after selection
        self.decay_epsilon();

        ActionSelection {
            action,
            q_value,
            is_exploration,
        }
    }

    /// Public interface for action selection
    pub fn select_action(
        &mut self,
        q_table: &QTable,
        state: StateHash,
        available_actions: &[Action],
    ) -> ActionSelection {
        self.select_action_internal(q_table, state, available_actions)
    }

    /// Decay epsilon towards minimum value
    ///
    /// Follows: `epsilon = max(epsilon_min, epsilon * decay_rate)`
    pub fn decay_epsilon(&mut self) {
        self.epsilon = (self.epsilon * self.decay_rate).max(self.epsilon_min);
    }

    /// Get current epsilon value
    pub fn epsilon(&self) -> f32 {
        self.epsilon
    }

    /// Check if exploration is enabled
    pub fn is_exploration_enabled(&self) -> bool {
        self.exploration_enabled
    }

    /// Enable or disable exploration
    pub fn set_exploration_enabled(&mut self, enabled: bool) {
        self.exploration_enabled = enabled;
    }

    /// Reset epsilon to initial value
    pub fn reset_epsilon(&mut self) {
        self.epsilon = 0.1;
    }
}

impl Policy for EpsilonGreedy {
    fn select_action(
        &mut self,
        q_table: &QTable,
        state: StateHash,
        available_actions: &[Action],
    ) -> ActionSelection {
        // Delegate to the internal implementation
        self.select_action_internal(q_table, state, available_actions)
    }

    fn name(&self) -> &str {
        "epsilon-greedy"
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::qtable::{QLearningConfig, QTable};

    #[test]
    fn test_action_indices() {
        assert_eq!(Action::DirectAnswer.index(), 0);
        assert_eq!(Action::ContextAnswer.index(), 1);
        assert_eq!(Action::ConsultPeer.index(), 2);
        assert_eq!(Action::RequestClarification.index(), 3);
        assert_eq!(Action::Escalate.index(), 4);
    }

    #[test]
    fn test_epsilon_greedy_creation() {
        let policy = EpsilonGreedy::new(42, true);
        assert_eq!(policy.epsilon(), 0.1);
        assert!(policy.is_exploration_enabled());
    }

    #[test]
    fn test_epsilon_greedy_no_consent() {
        let mut policy = EpsilonGreedy::new(42, false); // exploration disabled
        let config = QLearningConfig::elex_default();
        let mut qt = QTable::new(config);
        let state = 12345;

        // Set up Q-values
        qt.set_q_value(state, Action::DirectAnswer, 0.3);
        qt.set_q_value(state, Action::ContextAnswer, 0.8);

        let selection = policy.select_action(&qt, state, Action::all());

        // Without consent, should not explore (always exploit)
        assert!(!selection.is_exploration);
        assert_eq!(selection.action, Action::ContextAnswer); // Best action
    }

    #[test]
    fn test_epsilon_greedy_with_consent() {
        let mut policy = EpsilonGreedy::new(42, true); // exploration enabled

        // Force epsilon to 1.0 for testing exploration
        policy = policy.with_epsilon(1.0, 1.0, 0.995);

        let config = QLearningConfig::elex_default();
        let mut qt = QTable::new(config);
        let state = 12345;

        // Set up Q-values
        qt.set_q_value(state, Action::DirectAnswer, 0.3);
        qt.set_q_value(state, Action::ContextAnswer, 0.8);

        let selection = policy.select_action(&qt, state, Action::all());

        // With consent and epsilon=1.0, should explore (random action)
        // Note: Random action could be any, but should be exploration
        assert!(selection.is_exploration);
    }

    #[test]
    fn test_epsilon_greedy_best_action() {
        let mut policy = EpsilonGreedy::new(42, true);
        policy = policy.with_epsilon(0.0, 0.01, 0.995); // Never explore

        let config = QLearningConfig::elex_default();
        let mut qt = QTable::new(config);
        let state = 12345;

        // Set up known Q-values
        qt.set_q_value(state, Action::DirectAnswer, 0.3);
        qt.set_q_value(state, Action::ContextAnswer, 0.8);
        qt.set_q_value(state, Action::ConsultPeer, 0.5);

        let selection = policy.select_action(&qt, state, Action::all());

        // Should select best action (ContextAnswer with 0.8)
        assert_eq!(selection.action, Action::ContextAnswer);
        assert_eq!(selection.q_value, 0.8);
        assert!(!selection.is_exploration);
    }

    #[test]
    fn test_epsilon_decay() {
        let mut policy = EpsilonGreedy::new(42, true);

        let initial_epsilon = policy.epsilon();
        assert_eq!(initial_epsilon, 0.1);

        // Decay epsilon
        policy.decay_epsilon();

        let decayed_epsilon = policy.epsilon();
        assert!(decayed_epsilon < initial_epsilon);
        assert!((decayed_epsilon - (0.1 * 0.995)).abs() < 0.0001);
    }

    #[test]
    fn test_epsilon_decay_to_min() {
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
    fn test_epsilon_reset() {
        let mut policy = EpsilonGreedy::new(42, true);

        // Decay epsilon
        policy.decay_epsilon();
        assert!(policy.epsilon() < 0.1);

        // Reset
        policy.reset_epsilon();
        assert_eq!(policy.epsilon(), 0.1);
    }

    #[test]
    fn test_exploration_toggle() {
        let mut policy = EpsilonGreedy::new(42, true);
        assert!(policy.is_exploration_enabled());

        policy.set_exploration_enabled(false);
        assert!(!policy.is_exploration_enabled());

        policy.set_exploration_enabled(true);
        assert!(policy.is_exploration_enabled());
    }

    #[test]
    fn test_deterministic_with_seed() {
        let seed = 12345;

        let mut policy1 = EpsilonGreedy::new(seed, true);
        let mut policy2 = EpsilonGreedy::new(seed, true);

        let config = QLearningConfig::elex_default();
        let mut qt = QTable::new(config);
        let state = 12345;

        // Both policies should make same decisions with same seed
        let selection1 = policy1.select_action(&qt, state, Action::all());
        let selection2 = policy2.select_action(&qt, state, Action::all());

        assert_eq!(selection1.action, selection2.action);
        assert_eq!(selection1.is_exploration, selection2.is_exploration);
    }

    #[test]
    fn test_exploit_only_constructor() {
        let policy = EpsilonGreedy::exploit_only(42);
        assert!(!policy.is_exploration_enabled());
        assert_eq!(policy.epsilon(), 0.1);
    }

    #[test]
    fn test_custom_epsilon_params() {
        let policy = EpsilonGreedy::new(42, true)
            .with_epsilon(0.2, 0.05, 0.99);

        assert_eq!(policy.epsilon(), 0.2);
        // Note: Can't access private fields directly, but behavior reflects this
    }

    #[test]
    fn test_empty_available_actions() {
        let mut policy = EpsilonGreedy::new(42, true);
        policy = policy.with_epsilon(1.0, 0.01, 0.995); // Always explore

        let config = QLearningConfig::elex_default();
        let mut qt = QTable::new(config);
        let state = 12345;

        // Empty available actions should default to DirectAnswer
        let selection = policy.select_action(&qt, state, &[]);
        assert_eq!(selection.action, Action::DirectAnswer);
    }

    #[test]
    fn test_policy_trait() {
        let mut policy = EpsilonGreedy::new(42, true);
        assert_eq!(policy.name(), "epsilon-greedy");
    }
}
