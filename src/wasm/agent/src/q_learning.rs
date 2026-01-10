/// Q-Learning Implementation with SIMD Acceleration
///
/// Implements reinforcement learning for feature agents:
/// - Epsilon-greedy action selection
/// - Q-table updates with SIMD batch operations (2-4x faster)
/// - Experience replay and federated learning support

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::simd_ops::batch_q_update_simd;
use crate::feature_agent::AgentAction;

/// Q-Learning Configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QLearningConfig {
    pub alpha: f32,                    // Learning rate (0.01-0.2)
    pub gamma: f32,                    // Discount factor (0.9-0.99)
    pub epsilon: f32,                  // Exploration rate (0.05-0.2)
    pub epsilon_decay: f32,            // Decay per episode (0.995-0.9999)
    pub initial_q_value: f32,          // Initial Q-value (typically 0.0)
}

impl Default for QLearningConfig {
    fn default() -> Self {
        Self {
            alpha: 0.1,
            gamma: 0.95,
            epsilon: 0.15,
            epsilon_decay: 0.995,
            initial_q_value: 0.0,
        }
    }
}

/// Q-Learning entry: state-action pair and its value
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QEntry {
    pub state_action_key: String,  // Format: "state::action"
    pub value: f32,                // Q-value
    pub visit_count: u32,          // Times this entry was updated
    pub last_updated: u64,         // Timestamp of last update
}

/// Batch update for Q-learning (used with SIMD)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QUpdateBatch {
    pub state_action_key: String,
    pub current_q: f32,
    pub reward: f32,
    pub next_max_q: f32,
    pub visit_count: u32,
}

/// Q-Table for feature agents
///
/// Stores and manages state-action value estimates for Q-learning.
/// Supports SIMD batch updates for efficiency.
#[derive(Clone, Serialize, Deserialize)]
pub struct QTableWasm {
    // Q-values storage: map of state::action -> value
    pub entries: HashMap<String, QEntry>,

    // Configuration
    pub alpha: f32,
    pub gamma: f32,
    pub epsilon: f32,

    // Statistics
    pub total_updates: u32,
    pub total_episodes: u32,
    pub current_epsilon: f32,
    pub epsilon_decay: f32,

    // Experience trajectory for replay learning
    pub trajectory: ExperienceTrajectory,
}

impl QTableWasm {
    /// Create a new Q-table with configuration
    pub fn new(config: QLearningConfig) -> Self {
        Self {
            entries: HashMap::new(),
            alpha: config.alpha,
            gamma: config.gamma,
            epsilon: config.epsilon,
            total_updates: 0,
            total_episodes: 0,
            current_epsilon: config.epsilon,
            epsilon_decay: config.epsilon_decay,
            trajectory: ExperienceTrajectory::new(10000), // Store up to 10k experiences
        }
    }

    /// Get Q-value for state-action pair
    pub fn get_q_value(&self, state: &str, action: &str) -> f32 {
        let key = format!("{}::{}", state, action);
        self.entries.get(&key).map(|e| e.value).unwrap_or(0.0)
    }

    /// Set Q-value for state-action pair
    pub fn set_q_value(&mut self, state: &str, action: &str, value: f32) {
        let key = format!("{}::{}", state, action);
        self.entries.insert(key.clone(), QEntry {
            state_action_key: key,
            value,
            visit_count: 1,
            last_updated: 0,
        });
    }

    /// Update Q-value using standard Q-learning formula
    /// Q(s,a) ← Q(s,a) + α[r + γ max(Q(s',a')) - Q(s,a)]
    pub fn update_q_value(
        &mut self,
        state: &str,
        action: &str,
        reward: f32,
        next_max_q: f32,
    ) -> f32 {
        let key = format!("{}::{}", state, action);
        let current_q = self.get_q_value(state, action);

        // TD-error: r + γ max(Q(s',a')) - Q(s,a)
        let target = reward + self.gamma * next_max_q;
        let td_error = target - current_q;

        // Q(s,a) ← Q(s,a) + α * td_error
        let new_q = current_q + self.alpha * td_error;

        // Update entry
        let entry = self.entries.entry(key.clone()).or_insert(QEntry {
            state_action_key: format!("{}::{}", state, action),
            value: new_q,
            visit_count: 0,
            last_updated: 0,
        });

        entry.value = new_q;
        entry.visit_count += 1;

        self.total_updates += 1;

        // Store experience in trajectory
        let experience = Experience {
            state: state.to_string(),
            action: action.to_string(),
            reward,
            next_state: String::new(), // Would be set by caller
            done: false,
            timestamp: current_timestamp_q(),
            q_value_before: current_q,
            q_value_after: new_q,
        };
        self.trajectory.add(experience);

        new_q
    }

    /// Batch update using SIMD (2-4x faster)
    /// Requires aligned data: values, rewards, next_max_q all same length
    pub fn batch_update(
        &mut self,
        batch: Vec<QUpdateBatch>,
    ) {
        if batch.is_empty() {
            return;
        }

        // Extract data for SIMD operations
        let mut q_values: Vec<f32> = batch.iter()
            .map(|b| b.current_q)
            .collect();
        let rewards: Vec<f32> = batch.iter()
            .map(|b| b.reward)
            .collect();
        let next_max_q: Vec<f32> = batch.iter()
            .map(|b| b.next_max_q)
            .collect();

        // SIMD batch update (2-4x faster for large batches)
        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, self.alpha, self.gamma);

        // Store updated values
        for (i, b) in batch.iter().enumerate() {
            self.entries.insert(
                b.state_action_key.clone(),
                QEntry {
                    state_action_key: b.state_action_key.clone(),
                    value: q_values[i],
                    visit_count: b.visit_count + 1,
                    last_updated: 0,
                },
            );
        }

        self.total_updates += batch.len() as u32;
    }

    /// Select action using epsilon-greedy strategy
    /// Returns (action, q_value, is_exploration)
    pub fn select_action(&self, state: &str, available_actions: &[AgentAction]) -> (AgentAction, f32, bool) {
        // Epsilon-greedy: explore with probability ε, exploit with probability 1-ε
        let should_explore = random() < self.current_epsilon;

        if should_explore {
            // Explore: random action
            let idx = (random() * (available_actions.len() as f32)) as usize % available_actions.len();
            (available_actions[idx], 0.0, true)
        } else {
            // Exploit: best action
            let mut best_action = available_actions[0];
            let mut best_q = self.get_q_value(state, &format!("{:?}", best_action));

            for &action in available_actions.iter().skip(1) {
                let q = self.get_q_value(state, &format!("{:?}", action));
                if q > best_q {
                    best_q = q;
                    best_action = action;
                }
            }

            (best_action, best_q, false)
        }
    }

    /// Decay exploration rate
    pub fn decay_epsilon(&mut self) {
        self.current_epsilon *= self.epsilon_decay;
        self.current_epsilon = self.current_epsilon.max(0.01); // Min epsilon
        self.total_episodes += 1;
    }

    /// Get max Q-value for a state across all actions
    pub fn get_max_q(&self, state: &str, available_actions: &[AgentAction]) -> f32 {
        available_actions
            .iter()
            .map(|a| self.get_q_value(state, &format!("{:?}", a)))
            .fold(f32::NEG_INFINITY, f32::max)
    }

    /// Get statistics about Q-table
    pub fn get_stats(&self) -> QTableStats {
        let (min_val, max_val, mean_val) = self.compute_value_stats();

        QTableStats {
            entries_count: self.entries.len() as u32,
            total_updates: self.total_updates,
            total_episodes: self.total_episodes,
            current_epsilon: self.current_epsilon,
            min_q_value: min_val,
            max_q_value: max_val,
            mean_q_value: mean_val,
            alpha: self.alpha,
            gamma: self.gamma,
            trajectory_count: self.trajectory.episode_length,
            trajectory_size_bytes: self.trajectory.estimate_memory_bytes(),
        }
    }

    /// Merge Q-table from another agent (federated learning)
    pub fn merge_from(&mut self, other: &QTableWasm, weight: f32) {
        let weight = weight.max(0.0).min(1.0); // Clamp to [0, 1]
        let self_weight = 1.0 - weight;

        for (key, other_entry) in &other.entries {
            let merged_value = if let Some(self_entry) = self.entries.get(key) {
                self_entry.value * self_weight + other_entry.value * weight
            } else {
                other_entry.value * weight
            };

            self.entries.insert(key.clone(), QEntry {
                state_action_key: key.clone(),
                value: merged_value,
                visit_count: (self.entries.get(key)
                    .map(|e| e.visit_count)
                    .unwrap_or(0) + other_entry.visit_count) / 2,
                last_updated: 0,
            });
        }
    }

    /// Reset Q-table (full learning restart)
    pub fn reset(&mut self) {
        self.entries.clear();
        self.total_updates = 0;
        self.total_episodes = 0;
        self.current_epsilon = self.epsilon;
        self.trajectory.clear();
    }

    /// Compute value statistics
    fn compute_value_stats(&self) -> (f32, f32, f32) {
        if self.entries.is_empty() {
            return (0.0, 0.0, 0.0);
        }

        let values: Vec<f32> = self.entries.values().map(|e| e.value).collect();
        let min = values.iter().copied().fold(f32::INFINITY, f32::min);
        let max = values.iter().copied().fold(f32::NEG_INFINITY, f32::max);
        let mean = values.iter().sum::<f32>() / values.len() as f32;

        (min, max, mean)
    }
}

/// Q-Table statistics
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
    pub trajectory_count: u32,
    pub trajectory_size_bytes: u32,
}

// ============================================================================
// Experience Trajectory Storage
// ============================================================================

/// Experience tuple for trajectory storage
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Experience {
    pub state: String,
    pub action: String,
    pub reward: f32,
    pub next_state: String,
    pub done: bool,
    pub timestamp: u64,
    pub q_value_before: f32,
    pub q_value_after: f32,
}

/// Experience trajectory for memory replay and learning
#[derive(Clone, Serialize, Deserialize)]
pub struct ExperienceTrajectory {
    pub experiences: Vec<Experience>,
    pub max_size: usize,
    pub total_reward: f32,
    pub episode_length: u32,
    pub created_at: u64,
    pub last_updated: u64,
}

impl ExperienceTrajectory {
    /// Create a new trajectory buffer
    pub fn new(max_size: usize) -> Self {
        Self {
            experiences: Vec::with_capacity(max_size),
            max_size,
            total_reward: 0.0,
            episode_length: 0,
            created_at: current_timestamp_q(),
            last_updated: current_timestamp_q(),
        }
    }

    /// Add an experience to the trajectory
    pub fn add(&mut self, experience: Experience) {
        self.total_reward += experience.reward;
        self.episode_length += 1;
        self.last_updated = current_timestamp_q();

        if self.experiences.len() >= self.max_size {
            // Remove oldest experience (FIFO)
            self.experiences.remove(0);
        }

        self.experiences.push(experience);
    }

    /// Get a random sample of experiences for replay
    pub fn sample(&self, batch_size: usize) -> Vec<&Experience> {
        if self.experiences.is_empty() {
            return Vec::new();
        }

        let mut sampled = std::collections::HashSet::new();
        let mut result = Vec::with_capacity(batch_size.min(self.experiences.len()));

        while sampled.len() < batch_size.min(self.experiences.len()) {
            let idx = (random() * self.experiences.len() as f32) as usize % self.experiences.len();
            if sampled.insert(idx) {
                result.push(&self.experiences[idx]);
            }
        }

        result
    }

    /// Get all experiences since a timestamp
    pub fn get_since(&self, timestamp: u64) -> Vec<&Experience> {
        self.experiences
            .iter()
            .filter(|e| e.timestamp >= timestamp)
            .collect()
    }

    /// Clear all experiences
    pub fn clear(&mut self) {
        self.experiences.clear();
        self.total_reward = 0.0;
        self.episode_length = 0;
        self.last_updated = current_timestamp_q();
    }

    /// Calculate average reward per experience
    pub fn avg_reward(&self) -> f32 {
        if self.episode_length == 0 {
            0.0
        } else {
            self.total_reward / self.episode_length as f32
        }
    }

    /// Estimate memory usage
    pub fn estimate_memory_bytes(&self) -> u32 {
        // Each experience ~200 bytes (strings + floats)
        self.experiences.len() as u32 * 200
    }
}

/// Get current timestamp
#[cfg(target_arch = "wasm32")]
fn current_timestamp_q() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
fn current_timestamp_q() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Random number generator (0.0-1.0)
/// Uses js-sys for true randomness in WASM
#[cfg(target_arch = "wasm32")]
fn random() -> f32 {
    js_sys::Math::random() as f32
}

/// Random number generator for native testing
#[cfg(not(target_arch = "wasm32"))]
fn random() -> f32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    (nanos as f32) / u32::MAX as f32
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_q_table_creation() {
        let config = QLearningConfig::default();
        let qt = QTableWasm::new(config);

        assert_eq!(qt.entries.len(), 0);
        assert_eq!(qt.alpha, 0.1);
        assert_eq!(qt.gamma, 0.95);
    }

    #[test]
    fn test_q_value_operations() {
        let config = QLearningConfig::default();
        let mut qt = QTableWasm::new(config);

        // Initially zero
        assert_eq!(qt.get_q_value("s0", "a0"), 0.0);

        // Set and retrieve
        qt.set_q_value("s0", "a0", 0.5);
        assert_eq!(qt.get_q_value("s0", "a0"), 0.5);

        // Update
        qt.update_q_value("s0", "a0", 1.0, 0.8);
        let updated = qt.get_q_value("s0", "a0");
        assert!(updated > 0.5, "Q-value should increase");
    }

    #[test]
    fn test_epsilon_greedy() {
        let config = QLearningConfig::default();
        let qt = QTableWasm::new(config);

        let actions = vec![
            AgentAction::DirectAnswer,
            AgentAction::ContextAnswer,
            AgentAction::ConsultPeer,
        ];

        let (action, q_value, is_exploration) = qt.select_action("s0", &actions);
        assert!(actions.contains(&action), "Action should be available");
    }

    #[test]
    fn test_epsilon_decay() {
        let mut config = QLearningConfig::default();
        config.epsilon_decay = 0.99;

        let mut qt = QTableWasm::new(config);
        let initial = qt.current_epsilon;

        qt.decay_epsilon();
        assert!(qt.current_epsilon < initial, "Epsilon should decay");
        assert!(qt.current_epsilon >= 0.01, "Epsilon should stay above min");
    }

    #[test]
    fn test_batch_update() {
        let config = QLearningConfig::default();
        let mut qt = QTableWasm::new(config);

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

        qt.batch_update(batch);
        assert!(qt.entries.len() >= 2, "Batch update should add entries");
    }

    #[test]
    fn test_federated_learning_merge() {
        let config = QLearningConfig::default();
        let mut qt1 = QTableWasm::new(config.clone());
        let mut qt2 = QTableWasm::new(config);

        qt1.set_q_value("s0", "a0", 0.8);
        qt2.set_q_value("s0", "a0", 0.6);

        // Merge: equal weight
        qt1.merge_from(&qt2, 0.5);

        let merged = qt1.get_q_value("s0", "a0");
        assert!((merged - 0.7).abs() < 0.01, "Merged value should be average");
    }

    #[test]
    fn test_q_table_stats() {
        let config = QLearningConfig::default();
        let mut qt = QTableWasm::new(config);

        qt.set_q_value("s0", "a0", 0.5);
        qt.set_q_value("s0", "a1", 0.7);
        qt.set_q_value("s0", "a2", 0.3);

        let stats = qt.get_stats();
        assert_eq!(stats.entries_count, 3);
        assert!(stats.min_q_value <= stats.mean_q_value);
        assert!(stats.mean_q_value <= stats.max_q_value);
    }
}
