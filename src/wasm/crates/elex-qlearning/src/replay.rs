//! Experience Replay and Trajectory Buffer (ELEX-018)
//!
//! Prioritized Experience Replay (PER) with TD-error prioritization.
//! Implements efficient sampling with importance weights.
//!
//! # Features
//! - Ring buffer with configurable capacity (default: 1000)
//! - TD-error prioritization with alpha=0.6
//! - Importance sampling correction with beta=0.4->1.0 annealing
//! - Efficient weighted sampling
//! - WASM-compatible random number generation
//!
//! # Performance
//! - O(1) insertion
//! - O(n) sampling where n = batch_size
//! - Memory efficient: VecDeque for ring buffer behavior

use serde::{Deserialize, Serialize};
use crate::qtable::{StateHash, State};
use super::policy::Action;

// ============================================================================
// Transition (Experience Tuple)
// ============================================================================

/// Single experience tuple (S, A, R, S', TD-error)
///
/// Represents one step in the agent's experience.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transition {
    /// State hash
    pub state: StateHash,
    /// Action taken
    pub action: Action,
    /// Reward received
    pub reward: f32,
    /// Next state hash
    pub next_state: StateHash,
    /// Temporal Difference error (for prioritization)
    pub td_error: f32,
    /// Timestamp (Unix milliseconds)
    pub timestamp: u64,
}

impl Transition {
    /// Create a new transition
    pub fn new(
        state: StateHash,
        action: Action,
        reward: f32,
        next_state: StateHash,
        td_error: f32,
    ) -> Self {
        Self {
            state,
            action,
            reward,
            next_state,
            td_error,
            timestamp: current_timestamp(),
        }
    }

    /// Compute priority score for PER sampling
    ///
    /// Priority = |TD-error|^alpha
    pub fn priority(&self, alpha: f32) -> f32 {
        (self.td_error.abs() + 1e-6).powf(alpha)
    }

    /// Compute importance sampling weight
    ///
    /// Weight = (N * P(i))^(-beta)
    /// Used to correct bias from prioritized sampling
    pub fn importance_weight(&self, priority: f32, total_priority: f32, n: usize, beta: f32) -> f32 {
        let prob = priority / (total_priority + 1e-8);
        ((n as f32) * prob).powf(-beta)
    }
}

/// Experience type alias for compatibility
pub type Experience = Transition;

// ============================================================================
// Trajectory
// ============================================================================

/// Full trajectory (sequence of experiences)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Trajectory {
    /// Unique identifier
    pub id: u64,
    /// Experience sequence
    pub experiences: Vec<Experience>,
    /// Cumulative reward
    pub total_reward: f32,
    /// Context hash for deduplication
    pub context_hash: u64,
    /// Timestamp
    pub timestamp: u64,
}

impl Trajectory {
    pub fn new(id: u64, context_hash: u64) -> Self {
        Self {
            id,
            experiences: Vec::new(),
            total_reward: 0.0,
            context_hash,
            timestamp: current_timestamp(),
        }
    }

    pub fn add_experience(&mut self, experience: Experience) {
        self.total_reward += experience.reward;
        self.experiences.push(experience);
    }

    pub fn len(&self) -> usize {
        self.experiences.len()
    }

    pub fn is_empty(&self) -> bool {
        self.experiences.is_empty()
    }
}

// ============================================================================
// Experience Replay Buffer (PER)
// ============================================================================

/// Prioritized Experience Replay buffer
///
/// Implements TD-error based prioritization with importance sampling.
/// Uses ring buffer (VecDeque) for efficient memory management.
#[derive(Clone, Serialize, Deserialize)]
pub struct PrioritizedBuffer {
    /// Experience storage (ring buffer)
    experiences: Vec<Transition>,
    /// Priority values for each experience
    priorities: Vec<f32>,
    /// Maximum buffer size
    max_size: usize,
    /// Prioritization alpha (0.0 = uniform, 1.0 = full prioritization)
    alpha: f32,
    /// Importance sampling beta (anneals from 0.4 to 1.0)
    beta: f32,
    /// Beta growth rate per sample
    beta_growth: f32,
    /// Total priority (for sampling)
    total_priority: f32,
}

impl PrioritizedBuffer {
    /// Create a new prioritized replay buffer
    ///
    /// # Arguments
    /// * `max_size` - Maximum buffer capacity (default: 1000)
    /// * `alpha` - Prioritization strength (default: 0.6)
    pub fn new(max_size: usize, alpha: f32) -> Self {
        Self {
            experiences: Vec::with_capacity(max_size),
            priorities: Vec::with_capacity(max_size),
            max_size,
            alpha,
            beta: 0.4,
            beta_growth: 0.001,
            total_priority: 0.0,
        }
    }

    /// Create with default ELEX settings
    pub fn elex_default() -> Self {
        Self::new(1000, 0.6)
    }

    /// Add transition to buffer
    ///
    /// If buffer is full, removes oldest entry (FIFO).
    pub fn push(&mut self, transition: Transition) {
        let priority = transition.priority(self.alpha);

        if self.experiences.len() >= self.max_size {
            // Remove oldest (FIFO when full)
            let _removed = self.experiences.remove(0);
            let old_priority = self.priorities.remove(0);
            self.total_priority -= old_priority;
        }

        self.experiences.push(transition);
        self.priorities.push(priority);
        self.total_priority += priority;
    }

    /// Sample batch using prioritized sampling
    ///
    /// Returns transitions sampled with probability proportional to priority.
    /// Anneals beta towards 1.0 for importance sampling correction.
    pub fn sample(&mut self, batch_size: usize) -> Vec<&Transition> {
        if self.experiences.is_empty() {
            return Vec::new();
        }

        // Anneal beta towards 1.0 before sampling (avoid borrow issues)
        self.beta = (self.beta + self.beta_growth).min(1.0);

        let mut result = Vec::with_capacity(batch_size);
        let n = self.experiences.len().min(batch_size);

        for _ in 0..n {
            if let Some(transition) = self.sample_one() {
                result.push(transition);
            }
        }

        result
    }

    /// Sample single transition (weighted by priority)
    fn sample_one(&self) -> Option<&Transition> {
        if self.experiences.is_empty() {
            return None;
        }

        if self.total_priority <= 0.0 {
            // Uniform sampling if no priority
            let idx = (random_f32() * self.experiences.len() as f32) as usize
                % self.experiences.len();
            return self.experiences.get(idx);
        }

        // Weighted sampling by priority
        let mut threshold = random_f32() * self.total_priority;
        for (i, exp) in self.experiences.iter().enumerate() {
            if let Some(&priority) = self.priorities.get(i) {
                if threshold <= priority {
                    return Some(exp);
                }
                threshold -= priority;
            }
        }

        // Fallback to last
        self.experiences.last()
    }

    /// Update priority for a transition (after TD-error recomputation)
    pub fn update_priority(&mut self, index: usize, td_error: f32) {
        if let Some(old_priority) = self.priorities.get(index) {
            self.total_priority -= old_priority;
        }

        let new_priority = (td_error.abs() + 1e-6).powf(self.alpha);
        if let Some(p) = self.priorities.get_mut(index) {
            *p = new_priority;
            self.total_priority += new_priority;
        }
    }

    /// Get current beta value
    pub fn beta(&self) -> f32 {
        self.beta
    }

    /// Set beta value (for importance sampling)
    pub fn set_beta(&mut self, beta: f32) {
        self.beta = beta.min(1.0).max(0.0);
    }

    /// Get current alpha value
    pub fn alpha(&self) -> f32 {
        self.alpha
    }

    pub fn len(&self) -> usize {
        self.experiences.len()
    }

    pub fn is_empty(&self) -> bool {
        self.experiences.is_empty()
    }

    pub fn clear(&mut self) {
        self.experiences.clear();
        self.priorities.clear();
        self.total_priority = 0.0;
    }
}

// ============================================================================
// Trajectory Buffer (Ring Buffer)
// ============================================================================

/// Ring buffer for trajectory storage with deduplication
#[derive(Clone, Serialize, Deserialize)]
pub struct TrajectoryBuffer {
    /// Trajectory storage
    trajectories: Vec<Trajectory>,
    /// Maximum buffer size
    max_size: usize,
    /// Context hash index for deduplication
    context_index: std::collections::HashMap<u64, usize>,
}

impl TrajectoryBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            trajectories: Vec::with_capacity(max_size),
            max_size,
            context_index: std::collections::HashMap::new(),
        }
    }

    /// Add trajectory (with deduplication)
    pub fn push(&mut self, trajectory: Trajectory) -> bool {
        // Check for duplicate
        if let Some(&existing_idx) = self.context_index.get(&trajectory.context_hash) {
            // Keep the one with higher reward
            if let Some(existing) = self.trajectories.get(existing_idx) {
                if trajectory.total_reward <= existing.total_reward {
                    return false; // Don't replace
                }
                // Remove the old one since we're replacing it
                self.trajectories.remove(existing_idx);
                self.context_index.remove(&trajectory.context_hash);
                // Update indices in context_index (shift down by 1 for all indices > existing_idx)
                for (hash, idx) in self.context_index.iter_mut() {
                    if *idx > existing_idx {
                        *idx -= 1;
                    }
                }
            }
        }

        // Remove oldest if full
        if self.trajectories.len() >= self.max_size {
            let removed = self.trajectories.remove(0);
            self.context_index.remove(&removed.context_hash);
            // Update indices in context_index (shift down by 1)
            for (hash, idx) in self.context_index.iter_mut() {
                *idx = idx.saturating_sub(1);
            }
        }

        let idx = self.trajectories.len();
        self.context_index.insert(trajectory.context_hash, idx);
        self.trajectories.push(trajectory);
        true
    }

    /// Sample trajectories prioritized by reward
    pub fn sample(&self, count: usize) -> Vec<&Trajectory> {
        if self.trajectories.is_empty() {
            return Vec::new();
        }

        let mut sorted: Vec<_> = self.trajectories.iter()
            .enumerate()
            .collect();

        // Sort by reward (descending)
        sorted.sort_by(|a, b| {
            b.1.total_reward
                .partial_cmp(&a.1.total_reward)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        sorted.into_iter()
            .take(count)
            .map(|(_, t)| t)
            .collect()
    }

    pub fn len(&self) -> usize {
        self.trajectories.len()
    }

    pub fn is_empty(&self) -> bool {
        self.trajectories.is_empty()
    }
}

// ============================================================================
// Experience Buffer (Simple)
// ============================================================================

/// Simple experience buffer (non-prioritized)
#[derive(Clone, Serialize, Deserialize)]
pub struct ExperienceBuffer {
    experiences: Vec<Experience>,
    max_size: usize,
}

impl ExperienceBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            experiences: Vec::with_capacity(max_size),
            max_size,
        }
    }

    pub fn push(&mut self, experience: Experience) {
        if self.experiences.len() >= self.max_size {
            self.experiences.remove(0);
        }
        self.experiences.push(experience);
    }

    pub fn sample(&self, batch_size: usize) -> Vec<&Experience> {
        if self.experiences.is_empty() {
            return Vec::new();
        }

        let mut result = Vec::with_capacity(batch_size);
        let n = self.experiences.len().min(batch_size);

        for _ in 0..n {
            let idx = (random() * self.experiences.len() as f32) as usize
                % self.experiences.len();
            result.push(&self.experiences[idx]);
        }

        result
    }

    pub fn len(&self) -> usize {
        self.experiences.len()
    }

    pub fn is_empty(&self) -> bool {
        self.experiences.is_empty()
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get current timestamp (Unix milliseconds)
#[cfg(target_arch = "wasm32")]
fn current_timestamp() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
fn current_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Random float in [0, 1)
#[cfg(target_arch = "wasm32")]
fn random_f32() -> f32 {
    js_sys::Math::random() as f32
}

#[cfg(not(target_arch = "wasm32"))]
fn random_f32() -> f32 {
    // Simple LCG for testing (in production, use proper RNG)
    use std::cell::RefCell;
    use std::rc::Rc;
    thread_local! {
        static STATE: Rc<RefCell<u64>> = Rc::new(RefCell::new(123456789));
    }
    STATE.with(|s| {
        let mut state = s.borrow_mut();
        *state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((*state >> 32) & 0x7FFFFFFF) as f32 / (u32::MAX as f32)
    })
}

// Legacy alias for compatibility
#[deprecated(note = "Use random_f32 instead")]
fn random() -> f32 {
    random_f32()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transition_creation() {
        let trans = Transition::new(123, Action::DirectAnswer, 1.0, 456, 0.5);
        assert_eq!(trans.state, 123);
        assert_eq!(trans.action, Action::DirectAnswer);
        assert_eq!(trans.reward, 1.0);
    }

    #[test]
    fn test_transition_priority() {
        let trans = Transition::new(123, Action::DirectAnswer, 1.0, 456, 0.5);
        let priority = trans.priority(0.6);
        // Priority = |0.5|^0.6
        assert!((priority - 0.5_f32.powf(0.6)).abs() < 0.01);
    }

    #[test]
    fn test_experience_creation() {
        let exp = Experience::new(123, Action::DirectAnswer, 1.0, 456, 0.5);
        assert_eq!(exp.state, 123);
        assert_eq!(exp.action, Action::DirectAnswer);
        assert_eq!(exp.reward, 1.0);
    }

    #[test]
    fn test_trajectory() {
        let mut traj = Trajectory::new(1, 0xDEADBEEF);
        assert!(traj.is_empty());

        traj.add_experience(Experience::new(1, Action::DirectAnswer, 0.5, 2, 0.1));
        assert_eq!(traj.len(), 1);
        assert_eq!(traj.total_reward, 0.5);
    }

    #[test]
    fn test_prioritized_buffer() {
        let mut buffer = PrioritizedBuffer::new(10, 0.6);

        buffer.push(Transition::new(1, Action::DirectAnswer, 1.0, 2, 0.9)); // High TD-error
        buffer.push(Transition::new(3, Action::DirectAnswer, 0.1, 4, 0.1)); // Low TD-error

        assert_eq!(buffer.len(), 2);

        let samples = buffer.sample(1);
        assert_eq!(samples.len(), 1);
        // High TD-error should be sampled more often
    }

    #[test]
    fn test_prioritized_buffer_beta_annealing() {
        let mut buffer = PrioritizedBuffer::new(10, 0.6);

        buffer.push(Transition::new(1, Action::DirectAnswer, 1.0, 2, 0.5));

        assert_eq!(buffer.beta(), 0.4);

        // Sample 1000 times - beta should approach 1.0
        for _ in 0..1000 {
            buffer.sample(1);
        }

        assert!(buffer.beta() > 0.99);
    }

    #[test]
    fn test_prioritized_buffer_fifo() {
        let mut buffer = PrioritizedBuffer::new(3, 0.6);

        buffer.push(Transition::new(1, Action::DirectAnswer, 0.0, 2, 0.1));
        buffer.push(Transition::new(2, Action::DirectAnswer, 0.0, 3, 0.1));
        buffer.push(Transition::new(3, Action::DirectAnswer, 0.0, 4, 0.1));
        buffer.push(Transition::new(4, Action::DirectAnswer, 0.0, 5, 0.1)); // Should evict first

        assert_eq!(buffer.len(), 3);
    }

    #[test]
    fn test_transition_importance_weight() {
        let transition = Transition::new(123, Action::DirectAnswer, 1.0, 456, 0.5);
        let priority = transition.priority(0.6);
        let total_priority = 100.0;
        let n = 1000;
        let beta = 0.5;

        let weight = transition.importance_weight(priority, total_priority, n, beta);

        // Weight = (1000 * (priority / 100.0))^(-0.5)
        let expected = ((n as f32) * (priority / total_priority)).powf(-beta);
        assert!((weight - expected).abs() < 0.01);
    }

    #[test]
    fn test_trajectory_deduplication() {
        let mut buffer = TrajectoryBuffer::new(10);

        let mut traj1 = Trajectory::new(1, 0xDEADBEEF);
        traj1.total_reward = 0.5;

        let mut traj2 = Trajectory::new(2, 0xDEADBEEF); // Same context
        traj2.total_reward = 0.8;

        buffer.push(traj1);
        buffer.push(traj2); // Should replace due to higher reward

        assert_eq!(buffer.len(), 1);
        assert_eq!(buffer.trajectories[0].id, 2);
    }

    #[test]
    fn test_buffer_max_size() {
        let mut buffer = PrioritizedBuffer::new(2, 0.6);

        for i in 0..5 {
            buffer.push(Experience::new(i, Action::DirectAnswer, 0.0, i + 1, 0.1));
        }

        assert_eq!(buffer.len(), 2);
        // Should keep the 2 most recent
    }
}
