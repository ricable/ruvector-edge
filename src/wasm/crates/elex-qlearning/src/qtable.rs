//! Q-Table Implementation
//!
//! Core Q-learning data structure with state-action value storage.
//!
//! # Q-Learning Update Rule
//! ```text
//! Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
//! ```
//!
//! # Hyperparameters (from PRD)
//! - alpha (learning rate): 0.1
//! - gamma (discount factor): 0.95
//! - epsilon (exploration): 0.1 -> 0.01 (decaying)
//!
//! # State Space
//! - query_type: parameter | counter | kpi | procedure | troubleshoot | general
//! - complexity: simple | moderate | complex
//! - context_hash: hash of relevant context
//! - confidence: discretized confidence level (0-15)
//!
//! # Action Space
//! - direct_answer: Respond directly from knowledge
//! - context_answer: Provide contextual information
//! - consult_peer: Ask another agent
//! - request_clarification: Ask user for more details
//! - escalate: Escalate to human operator
//!
//! # Reward Signal
//! - user_rating: [-1, +1] user feedback
//! - resolution_success: +0.5 for successful resolution
//! - latency_penalty: small penalty for slow responses
//! - consultation_cost: small penalty for peer consultation

use serde::{Deserialize, Serialize};
use crate::policy::Action;
use hashbrown::HashMap;

// ============================================================================
// Reward Structure
// ============================================================================

/// Reward signal components for Q-learning
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Reward {
    /// User feedback rating [-1.0, +1.0]
    pub user_rating: f32,
    /// Successful resolution bonus (+0.5)
    pub resolution_success: f32,
    /// Latency penalty (small negative value)
    pub latency_penalty: f32,
    /// Consultation cost (small negative value)
    pub consultation_cost: f32,
}

impl Reward {
    /// Create a new reward with all components
    pub fn new(
        user_rating: f32,
        resolution_success: f32,
        latency_penalty: f32,
        consultation_cost: f32,
    ) -> Self {
        Self {
            user_rating: user_rating.clamp(-1.0, 1.0),
            resolution_success,
            latency_penalty,
            consultation_cost,
        }
    }

    /// Calculate total reward
    pub fn total(&self) -> f32 {
        self.user_rating + self.resolution_success + self.latency_penalty + self.consultation_cost
    }

    /// Create reward from user rating only
    pub fn from_user_rating(rating: f32) -> Self {
        Self {
            user_rating: rating.clamp(-1.0, 1.0),
            resolution_success: 0.0,
            latency_penalty: 0.0,
            consultation_cost: 0.0,
        }
    }

    /// Create successful resolution reward
    pub fn success() -> Self {
        Self {
            user_rating: 0.0,
            resolution_success: 0.5,
            latency_penalty: 0.0,
            consultation_cost: 0.0,
        }
    }

    /// Create failure reward
    pub fn failure() -> Self {
        Self {
            user_rating: -0.5,
            resolution_success: 0.0,
            latency_penalty: 0.0,
            consultation_cost: 0.0,
        }
    }

    /// Add latency penalty
    pub fn with_latency(mut self, penalty: f32) -> Self {
        self.latency_penalty = -penalty.abs(); // Always negative
        self
    }

    /// Add consultation cost
    pub fn with_consultation_cost(mut self, cost: f32) -> Self {
        self.consultation_cost = -cost.abs(); // Always negative
        self
    }
}

impl Default for Reward {
    fn default() -> Self {
        Self {
            user_rating: 0.0,
            resolution_success: 0.0,
            latency_penalty: 0.0,
            consultation_cost: 0.0,
        }
    }
}

// ============================================================================
// State Encoding
// ============================================================================

/// State identifier (64-bit hash)
pub type StateHash = u64;

/// State representation for encoding
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct State {
    pub query_type: u8,      // 3 bits
    pub complexity: u8,      // 2 bits
    pub confidence_bucket: u8, // 4 bits
    pub context_hash: u64,   // 55 bits (truncated)
}

impl State {
    /// Encode state components into 64-bit hash
    pub fn encode(&self) -> StateHash {
        let mut hash: u64 = 0;

        // query_type: bits 0-2
        hash |= (self.query_type as u64) & 0x7;

        // complexity: bits 3-4
        hash |= ((self.complexity as u64) & 0x3) << 3;

        // confidence_bucket: bits 5-8
        hash |= ((self.confidence_bucket as u64) & 0xF) << 5;

        // context_hash: bits 9-63 (55 bits)
        hash |= (self.context_hash & 0x3FFFFFFFFFFFFFF) << 9;

        hash
    }

    /// Create a new state
    pub fn new(query_type: u8, complexity: u8, confidence: f32, context_hash: u64) -> Self {
        // Convert confidence to bucket (0-15)
        let confidence_bucket = (confidence * 15.0) as u8;
        let confidence_bucket = confidence_bucket.min(15);

        Self {
            query_type,
            complexity,
            confidence_bucket,
            context_hash,
        }
    }
}

// ============================================================================
// Q-Learning Configuration
// ============================================================================

/// Q-Learning hyperparameters
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QLearningConfig {
    /// Learning rate (0.01-0.2)
    pub alpha: f32,
    /// Discount factor (0.9-0.99)
    pub gamma: f32,
    /// Initial exploration rate (0.05-0.2)
    pub epsilon: f32,
    /// Epsilon decay per episode (0.995-0.9999)
    pub epsilon_decay: f32,
    /// Minimum epsilon (prevents over-exploitation)
    pub epsilon_min: f32,
    /// Initial Q-value for new entries
    pub initial_q_value: f32,
}

impl Default for QLearningConfig {
    fn default() -> Self {
        Self {
            alpha: 0.1,
            gamma: 0.95,
            epsilon: 0.15,
            epsilon_decay: 0.995,
            epsilon_min: 0.01,
            initial_q_value: 0.0,
        }
    }
}

impl QLearningConfig {
    /// Create config with values from PRD
    pub fn elex_default() -> Self {
        Self {
            alpha: 0.1,
            gamma: 0.95,
            epsilon: 0.1,
            epsilon_decay: 0.995,
            epsilon_min: 0.01,
            initial_q_value: 0.0,
        }
    }
}

// ============================================================================
// Q-Table Entry
// ============================================================================

/// Single Q-table entry
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QEntry {
    /// State-action key
    pub state_action_key: String,
    /// Q-value
    pub value: f32,
    /// Visit count
    pub visit_count: u32,
    /// Last update timestamp
    pub last_updated: u64,
    /// Outcomes tracking (for confidence calculation)
    pub successes: u32,
    pub failures: u32,
}

impl QEntry {
    pub fn new(state_action_key: String) -> Self {
        Self {
            state_action_key,
            value: 0.0,
            visit_count: 0,
            last_updated: 0,
            successes: 0,
            failures: 0,
        }
    }

    /// Get success rate
    pub fn success_rate(&self) -> f32 {
        let total = self.successes + self.failures;
        if total == 0 {
            return 0.5;
        }
        (self.successes as f32) / (total as f32)
    }
}

// ============================================================================
// Q-Table
// ============================================================================

/// Q-table for storing state-action values
#[derive(Clone, Serialize, Deserialize)]
pub struct QTable {
    /// Q-value storage: state::action -> QEntry
    pub entries: HashMap<String, QEntry>,

    /// Configuration
    config: QLearningConfig,

    /// Current exploration rate
    current_epsilon: f32,

    /// Statistics
    pub total_updates: u32,
    pub total_episodes: u32,
}

impl QTable {
    /// Create a new Q-table
    pub fn new(config: QLearningConfig) -> Self {
        Self {
            entries: HashMap::new(),
            current_epsilon: config.epsilon,
            config,
            total_updates: 0,
            total_episodes: 0,
        }
    }

    /// Create with default config
    pub fn default() -> Self {
        Self::new(QLearningConfig::default())
    }

    /// Get Q-value for state-action pair
    pub fn get_q_value(&self, state: StateHash, action: Action) -> f32 {
        let key = Self::make_key(state, action);
        self.entries
            .get(&key)
            .map(|e| e.value)
            .unwrap_or(self.config.initial_q_value)
    }

    /// Set Q-value for state-action pair
    pub fn set_q_value(&mut self, state: StateHash, action: Action, value: f32) {
        let key = Self::make_key(state, action);
        self.entries
            .entry(key.clone())
            .and_modify(|e| e.value = value)
            .or_insert_with(|| {
                let mut entry = QEntry::new(key.clone());
                entry.value = value;
                entry
            });
    }

    /// Update Q-value using Q-learning formula
    /// Q(s,a) ← Q(s,a) + α[r + γ max(Q(s',a')) - Q(s,a)]
    pub fn update_q_value(
        &mut self,
        state: StateHash,
        action: Action,
        reward: f32,
        next_max_q: f32,
    ) -> f32 {
        let key = Self::make_key(state, action);
        let current_q = self.get_q_value(state, action);

        // TD-error: r + γ max(Q(s',a')) - Q(s,a)
        let target = reward + self.config.gamma * next_max_q;
        let td_error = target - current_q;

        // Q(s,a) ← Q(s,a) + α * td_error
        let new_q = current_q + self.config.alpha * td_error;

        // Update entry
        let entry = self.entries
            .entry(key.clone())
            .or_insert_with(|| QEntry::new(key.clone()));

        entry.value = new_q;
        entry.visit_count += 1;
        entry.last_updated = current_timestamp();

        // Track outcome
        if reward > 0.0 {
            entry.successes += 1;
        } else if reward < 0.0 {
            entry.failures += 1;
        }

        self.total_updates += 1;
        new_q
    }

    /// Get all Q-values for a state
    pub fn get_state_values(&self, state: StateHash) -> Vec<(Action, f32)> {
        Action::all()
            .iter()
            .map(|&action| (action, self.get_q_value(state, action)))
            .collect()
    }

    /// Get max Q-value for a state
    pub fn get_max_q(&self, state: StateHash) -> f32 {
        Action::all()
            .iter()
            .map(|&action| self.get_q_value(state, action))
            .fold(f32::NEG_INFINITY, f32::max)
    }

    /// Get best action for a state (argmax)
    pub fn get_best_action(&self, state: StateHash) -> Action {
        Action::all()
            .iter()
            .max_by(|&&a, &&b| {
                self.get_q_value(state, a)
                    .partial_cmp(&self.get_q_value(state, b))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .copied()
            .unwrap_or(Action::DirectAnswer)
    }

    /// Get best action from available actions only
    pub fn best_action(&self, state: StateHash, available_actions: &[Action]) -> Option<Action> {
        if available_actions.is_empty() {
            return None;
        }

        available_actions
            .iter()
            .max_by(|&&a, &&b| {
                self.get_q_value(state, a)
                    .partial_cmp(&self.get_q_value(state, b))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .copied()
    }

    /// Select action using epsilon-greedy policy
    ///
    /// Returns the selected action based on current epsilon value.
    /// With probability epsilon, selects a random action (exploration).
    /// With probability 1-epsilon, selects the best action (exploitation).
    pub fn select_action(&self, state: StateHash, available_actions: &[Action]) -> Action {
        if available_actions.is_empty() {
            return Action::DirectAnswer;
        }

        // Epsilon-greedy: explore with probability epsilon
        if random() < self.current_epsilon {
            // Explore: random action
            let idx = (random() * available_actions.len() as f32) as usize
                % available_actions.len();
            available_actions[idx]
        } else {
            // Exploit: best action
            self.best_action(state, available_actions)
                .unwrap_or(Action::DirectAnswer)
        }
    }

    /// Decay exploration rate
    pub fn decay_epsilon(&mut self) {
        self.current_epsilon *= self.config.epsilon_decay;
        self.current_epsilon = self.current_epsilon.max(self.config.epsilon_min);
        self.total_episodes += 1;
    }

    /// Get current epsilon
    pub fn epsilon(&self) -> f32 {
        self.current_epsilon
    }

    /// Get statistics
    pub fn get_stats(&self) -> QTableStats {
        let values: Vec<f32> = self.entries.values().map(|e| e.value).collect();

        let (min_q, max_q, mean_q) = if values.is_empty() {
            (0.0, 0.0, 0.0)
        } else {
            let min = values.iter().copied().fold(f32::INFINITY, f32::min);
            let max = values.iter().copied().fold(f32::NEG_INFINITY, f32::max);
            let mean = values.iter().sum::<f32>() / values.len() as f32;
            (min, max, mean)
        };

        QTableStats {
            entries_count: self.entries.len() as u32,
            total_updates: self.total_updates,
            total_episodes: self.total_episodes,
            current_epsilon: self.current_epsilon,
            min_q_value: min_q,
            max_q_value: max_q,
            mean_q_value: mean_q,
            alpha: self.config.alpha,
            gamma: self.config.gamma,
        }
    }

    /// Merge Q-table from another agent (federated learning)
    pub fn merge_from(&mut self, other: &QTable, weight: f32) {
        let weight = weight.max(0.0).min(1.0);
        let self_weight = 1.0 - weight;

        for (key, other_entry) in &other.entries {
            let merged_value = if let Some(self_entry) = self.entries.get(key) {
                // Visit-weighted average
                let total_visits = self_entry.visit_count + other_entry.visit_count;
                if total_visits == 0 {
                    self_entry.value * self_weight + other_entry.value * weight
                } else {
                    (self_entry.value * self_entry.visit_count as f32
                        + other_entry.value * other_entry.visit_count as f32)
                        / total_visits as f32
                }
            } else {
                other_entry.value * weight
            };

            self.entries
                .entry(key.clone())
                .and_modify(|e| {
                    e.value = merged_value;
                    e.visit_count = (e.visit_count as f32 * self_weight
                        + other_entry.visit_count as f32 * weight) as u32;
                })
                .or_insert_with(|| {
                    let mut entry = QEntry::new(key.clone());
                    entry.value = merged_value;
                    entry.visit_count = (other_entry.visit_count as f32 * weight) as u32;
                    entry
                });
        }
    }

    /// Export Q-table to bytes for federated learning
    ///
    /// Serializes the Q-table to a binary format for transmission
    /// to other agents or central coordinator.
    pub fn export(&self) -> Result<Vec<u8>, String> {
        serde_json::to_vec(self)
            .map_err(|e| format!("Failed to serialize Q-table: {}", e))
    }

    /// Import Q-table from bytes for federated learning
    ///
    /// Deserializes a Q-table from binary format received from
    /// another agent or central coordinator.
    pub fn import(data: &[u8]) -> Result<QTable, String> {
        serde_json::from_slice(data)
            .map_err(|e| format!("Failed to deserialize Q-table: {}", e))
    }

    /// Merge with another Q-table and return the result
    ///
    /// Creates a new Q-table that is a weighted merge of self and other.
    /// This is useful for federated learning without mutating self.
    pub fn merge(&self, other: &QTable, weight: f32) -> QTable {
        let mut result = self.clone();
        result.merge_from(other, weight);
        result
    }

    /// Reset Q-table
    pub fn reset(&mut self) {
        self.entries.clear();
        self.total_updates = 0;
        self.total_episodes = 0;
        self.current_epsilon = self.config.epsilon;
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    // ========================================================================
    // Internal Helpers
    // ========================================================================

    fn make_key(state: StateHash, action: Action) -> String {
        format!("{}::{}", state, action.index())
    }
}

/// Q-table statistics snapshot
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QTableStats {
    pub entries_count: u32,
    pub total_updates: u32,
    pub total_episodes: u32,
    pub current_epsilon: f32,
    pub min_q_value: f32,
    pub max_q_value: f32,
    pub mean_q_value: f32,
    pub alpha: f32,
    pub gamma: f32,
}

/// Get current timestamp
fn current_timestamp() -> u64 {
    // In WASM, would use js_sys::Date::now()
    // For now, placeholder
    0
}

/// Random number generator (0.0-1.0)
///
/// In WASM, would use js_sys::Math::random()
fn random() -> f32 {
    // Placeholder - in production, use proper randomness
    // For deterministic testing, this returns 0.5
    0.5
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_q_table_creation() {
        let qt = QTable::default();
        assert_eq!(qt.entries.len(), 0);
        assert_eq!(qt.config.alpha, 0.1);
        assert_eq!(qt.config.gamma, 0.95);
    }

    #[test]
    fn test_state_encoding() {
        let state = State::new(0, 0, 0.5, 0x123456789ABCDEF);
        let hash = state.encode();

        // Should be deterministic
        let hash2 = state.encode();
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_q_value_operations() {
        let mut qt = QTable::default();
        let state = 12345;

        // Initially default
        assert_eq!(qt.get_q_value(state, Action::DirectAnswer), 0.0);

        // Set and retrieve
        qt.set_q_value(state, Action::DirectAnswer, 0.5);
        assert_eq!(qt.get_q_value(state, Action::DirectAnswer), 0.5);
    }

    #[test]
    fn test_q_value_update() {
        let mut qt = QTable::default();
        let state = 12345;

        // Update with positive reward
        let new_q = qt.update_q_value(state, Action::DirectAnswer, 1.0, 0.8);
        assert!(new_q > 0.0);

        // Entry was created
        assert_eq!(qt.entries.len(), 1);
    }

    #[test]
    fn test_get_max_q() {
        let mut qt = QTable::default();
        let state = 12345;

        qt.set_q_value(state, Action::DirectAnswer, 0.5);
        qt.set_q_value(state, Action::ContextAnswer, 0.8);
        qt.set_q_value(state, Action::ConsultPeer, 0.3);

        assert_eq!(qt.get_max_q(state), 0.8);
    }

    #[test]
    fn test_epsilon_decay() {
        let mut qt = QTable::default();
        let initial = qt.epsilon();

        qt.decay_epsilon();
        assert!(qt.epsilon() < initial);
        assert!(qt.epsilon() >= qt.config.epsilon_min);
    }

    #[test]
    fn test_federated_merge() {
        let mut qt1 = QTable::default();
        let mut qt2 = QTable::default();
        let state = 12345;

        qt1.set_q_value(state, Action::DirectAnswer, 0.8);
        qt2.set_q_value(state, Action::DirectAnswer, 0.6);

        // Equal weight merge
        qt1.merge_from(&qt2, 0.5);

        let merged = qt1.get_q_value(state, Action::DirectAnswer);
        assert!((merged - 0.7).abs() < 0.01);
    }

    #[test]
    fn test_reset() {
        let mut qt = QTable::default();
        qt.set_q_value(12345, Action::DirectAnswer, 0.5);

        qt.reset();

        assert!(qt.is_empty());
        assert_eq!(qt.total_updates, 0);
        assert_eq!(qt.epsilon(), qt.config.epsilon);
    }

    #[test]
    fn test_reward_total() {
        let reward = Reward::new(0.5, 0.5, -0.1, -0.05);
        assert_eq!(reward.total(), 0.85);
    }

    #[test]
    fn test_reward_from_user_rating() {
        let reward = Reward::from_user_rating(0.8);
        assert_eq!(reward.user_rating, 0.8);
        assert_eq!(reward.total(), 0.8);
    }

    #[test]
    fn test_reward_success() {
        let reward = Reward::success();
        assert_eq!(reward.resolution_success, 0.5);
        assert_eq!(reward.total(), 0.5);
    }

    #[test]
    fn test_reward_failure() {
        let reward = Reward::failure();
        assert_eq!(reward.user_rating, -0.5);
        assert_eq!(reward.total(), -0.5);
    }

    #[test]
    fn test_reward_with_latency() {
        let reward = Reward::success().with_latency(0.1);
        assert_eq!(reward.latency_penalty, -0.1);
        assert_eq!(reward.total(), 0.4);
    }

    #[test]
    fn test_reward_with_consultation_cost() {
        let reward = Reward::success().with_consultation_cost(0.05);
        assert_eq!(reward.consultation_cost, -0.05);
        assert_eq!(reward.total(), 0.45);
    }

    #[test]
    fn test_reward_clamping() {
        let reward = Reward::from_user_rating(2.0); // Above max
        assert_eq!(reward.user_rating, 1.0);

        let reward = Reward::from_user_rating(-2.0); // Below min
        assert_eq!(reward.user_rating, -1.0);
    }

    #[test]
    fn test_best_action() {
        let mut qt = QTable::default();
        let state = 12345;

        qt.set_q_value(state, Action::DirectAnswer, 0.3);
        qt.set_q_value(state, Action::ContextAnswer, 0.8);
        qt.set_q_value(state, Action::ConsultPeer, 0.5);

        let available = vec![
            Action::DirectAnswer,
            Action::ContextAnswer,
            Action::ConsultPeer,
        ];

        let best = qt.best_action(state, &available);
        assert_eq!(best, Some(Action::ContextAnswer));
    }

    #[test]
    fn test_best_action_empty() {
        let qt = QTable::default();
        let state = 12345;
        let available = vec![];

        let best = qt.best_action(state, &available);
        assert_eq!(best, None);
    }

    #[test]
    fn test_select_action() {
        let mut qt = QTable::default();
        let state = 12345;

        qt.set_q_value(state, Action::DirectAnswer, 0.8);
        qt.set_q_value(state, Action::ContextAnswer, 0.3);

        let available = vec![
            Action::DirectAnswer,
            Action::ContextAnswer,
        ];

        // With epsilon=0.15 and random=0.5, should exploit (not explore)
        let action = qt.select_action(state, &available);
        // Since 0.5 > 0.15, should select best action
        assert_eq!(action, Action::DirectAnswer);
    }

    #[test]
    fn test_export_import() {
        let mut qt = QTable::default();
        let state = 12345;

        qt.set_q_value(state, Action::DirectAnswer, 0.7);
        qt.set_q_value(state, Action::ContextAnswer, 0.5);

        // Export
        let data = qt.export().expect("Export failed");
        assert!(!data.is_empty());

        // Import
        let qt2 = QTable::import(&data).expect("Import failed");
        assert_eq!(qt2.get_q_value(state, Action::DirectAnswer), 0.7);
        assert_eq!(qt2.get_q_value(state, Action::ContextAnswer), 0.5);
    }

    #[test]
    fn test_merge_new() {
        let mut qt1 = QTable::default();
        let mut qt2 = QTable::default();
        let state = 12345;

        qt1.set_q_value(state, Action::DirectAnswer, 0.8);
        qt2.set_q_value(state, Action::DirectAnswer, 0.4);

        let merged = qt1.merge(&qt2, 0.5);
        assert_eq!(merged.get_q_value(state, Action::DirectAnswer), 0.6);

        // Original should be unchanged
        assert_eq!(qt1.get_q_value(state, Action::DirectAnswer), 0.8);
    }

    #[test]
    fn test_config_elex_default() {
        let config = QLearningConfig::elex_default();
        assert_eq!(config.alpha, 0.1);
        assert_eq!(config.gamma, 0.95);
        assert_eq!(config.epsilon, 0.1);
        assert_eq!(config.epsilon_min, 0.01);
    }
}
