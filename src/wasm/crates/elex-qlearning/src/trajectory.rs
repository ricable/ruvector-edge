//! Agent Trajectory Buffer for Enhanced Learning
//!
//! Ring buffer with 1000 max entries for storing agent trajectories.
//! Implements deduplication by context hash and reward-prioritized sampling.
//! Tracks trajectory outcomes (Success, Failure, Ongoing, Timeout) for learning.
//!
//! This module provides enhanced trajectory tracking with:
//! - Agent ID tracking (32-byte Ed25519 key hash)
//! - Time tracking (start/end/duration)
//! - Outcome classification
//! - Enhanced statistics
//!
//! # Example
//! ```ignore
//! use elex_qlearning::trajectory::{AgentTrajectoryBuffer, TrajectoryOutcome};
//!
//! let mut buffer = AgentTrajectoryBuffer::new(1000);
//! let agent_id = [0u8; 32];
//! let context_hash = 0xDEADBEEF;
//!
//! // Start a new trajectory
//! let trajectory_id = buffer.start(agent_id, context_hash);
//!
//! // Add transitions
//! buffer.add_transition(trajectory_id, transition);
//!
//! // Complete trajectory
//! buffer.complete(trajectory_id, TrajectoryOutcome::Success);
//!
//! // Sample highest-reward trajectories
//! let best = buffer.sample_by_reward(10);
//! ```

use crate::replay::Transition;
use crate::qtable::{StateHash, State};
use crate::policy::Action;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Agent Trajectory
// ============================================================================

/// Enhanced trajectory with agent tracking and outcome classification
///
/// Extended version of basic trajectory with:
/// - Agent ID tracking (32-byte Ed25519 key hash)
/// - Time tracking (start/end/duration)
/// - Outcome classification (Success, Failure, Ongoing, Timeout)
/// - Enhanced statistics (avg_reward, is_successful, etc.)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentTrajectory {
    /// Unique trajectory identifier
    pub id: u64,
    /// Agent identifier (32-byte Ed25519 key hash)
    pub agent_id: [u8; 32],
    /// Sequence of state transitions
    pub transitions: Vec<Transition>,
    /// Trajectory start time (Unix milliseconds)
    pub start_time: u64,
    /// Trajectory end time (None if ongoing)
    pub end_time: Option<u64>,
    /// Cumulative reward across all transitions
    pub total_reward: f32,
    /// Trajectory outcome for learning
    pub outcome: TrajectoryOutcome,
    /// Context hash for deduplication
    pub context_hash: u64,
}

impl AgentTrajectory {
    /// Create a new trajectory
    pub fn new(id: u64, agent_id: [u8; 32], context_hash: u64) -> Self {
        Self {
            id,
            agent_id,
            transitions: Vec::new(),
            start_time: now(),
            end_time: None,
            total_reward: 0.0,
            outcome: TrajectoryOutcome::Ongoing,
            context_hash,
        }
    }

    /// Add a transition to this trajectory
    pub fn add_transition(&mut self, transition: Transition) {
        self.total_reward += transition.reward;
        self.transitions.push(transition);
    }

    /// Mark trajectory as completed
    pub fn complete(&mut self, outcome: TrajectoryOutcome) {
        self.end_time = Some(now());
        self.outcome = outcome;
    }

    /// Get trajectory duration in milliseconds
    pub fn duration(&self) -> Option<u64> {
        self.end_time.map(|end| end.saturating_sub(self.start_time))
    }

    /// Check if trajectory is successful
    pub fn is_successful(&self) -> bool {
        matches!(self.outcome, TrajectoryOutcome::Success)
    }

    /// Check if trajectory is ongoing
    pub fn is_ongoing(&self) -> bool {
        matches!(self.outcome, TrajectoryOutcome::Ongoing)
    }

    /// Get average reward per transition
    pub fn avg_reward(&self) -> f32 {
        if self.transitions.is_empty() {
            0.0
        } else {
            self.total_reward / self.transitions.len() as f32
        }
    }
}

// ============================================================================
// Trajectory Outcome
// ============================================================================

/// Trajectory outcome classification
///
/// Used for prioritized replay and learning signal classification.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrajectoryOutcome {
    /// Successful trajectory (positive learning signal)
    Success,
    /// Failed trajectory (negative learning signal)
    Failure,
    /// Currently in progress
    Ongoing,
    /// Timed out (neutral learning signal)
    Timeout,
}

impl TrajectoryOutcome {
    /// Get outcome as numeric score (for prioritization)
    pub fn score(&self) -> f32 {
        match self {
            TrajectoryOutcome::Success => 1.0,
            TrajectoryOutcome::Ongoing => 0.5,
            TrajectoryOutcome::Timeout => 0.0,
            TrajectoryOutcome::Failure => -1.0,
        }
    }
}

// ============================================================================
// Agent Trajectory Buffer
// ============================================================================

/// Ring buffer for trajectory storage with deduplication
///
/// Implements a fixed-capacity ring buffer with:
/// - Context hash deduplication
/// - Reward-prioritized sampling
/// - Low-reward eviction when full
///
/// Default capacity: 1000 trajectories
#[derive(Clone, Serialize, Deserialize)]
pub struct AgentTrajectoryBuffer {
    /// Trajectory storage (ring buffer)
    trajectories: Vec<AgentTrajectory>,
    /// Context hash -> trajectory indices index
    context_index: HashMap<u64, Vec<usize>>,
    /// Maximum buffer capacity
    capacity: usize,
    /// Next trajectory ID
    next_id: u64,
}

impl AgentTrajectoryBuffer {
    /// Create a new trajectory buffer
    ///
    /// # Arguments
    /// * `capacity` - Maximum number of trajectories (default 1000)
    pub fn new(capacity: usize) -> Self {
        Self {
            trajectories: Vec::with_capacity(capacity),
            context_index: HashMap::new(),
            capacity,
            next_id: 0,
        }
    }

    /// Create with default capacity (1000)
    pub fn default() -> Self {
        Self::new(1000)
    }

    /// Start a new trajectory for an agent
    ///
    /// Checks for deduplication by context hash. If a trajectory
    /// with the same context exists, returns that trajectory ID.
    ///
    /// # Arguments
    /// * `agent_id` - Agent identifier (32-byte Ed25519 key hash)
    /// * `context_hash` - Context hash for deduplication
    ///
    /// # Returns
    /// Trajectory ID (existing or new)
    pub fn start(&mut self, agent_id: [u8; 32], context_hash: u64) -> u64 {
        // Check for existing trajectory with same context
        if let Some(existing) = self.find_by_context(context_hash) {
            if existing.is_ongoing() {
                // Return existing ongoing trajectory
                return existing.id;
            }
        }

        // Evict if at capacity
        if self.trajectories.len() >= self.capacity {
            self.evict_low_reward();
        }

        // Create new trajectory
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);

        let trajectory = AgentTrajectory::new(id, agent_id, context_hash);
        let idx = self.trajectories.len();

        self.trajectories.push(trajectory);

        // Update context index
        self.context_index
            .entry(context_hash)
            .or_insert_with(Vec::new)
            .push(idx);

        id
    }

    /// Add a transition to a trajectory
    ///
    /// # Arguments
    /// * `trajectory_id` - Trajectory identifier
    /// * `transition` - State transition to add
    pub fn add_transition(&mut self, trajectory_id: u64, transition: Transition) {
        if let Some(trajectory) = self.trajectories.get_mut(trajectory_id as usize) {
            trajectory.add_transition(transition);
        }
    }

    /// Complete a trajectory with an outcome
    ///
    /// # Arguments
    /// * `trajectory_id` - Trajectory identifier
    /// * `outcome` - Final trajectory outcome
    pub fn complete(&mut self, trajectory_id: u64, outcome: TrajectoryOutcome) {
        if let Some(trajectory) = self.trajectories.get_mut(trajectory_id as usize) {
            trajectory.complete(outcome);
        }
    }

    /// Sample trajectories by reward (prioritized replay)
    ///
    /// Returns the highest-reward trajectories for learning.
    ///
    /// # Arguments
    /// * `batch_size` - Number of trajectories to sample
    ///
    /// # Returns
    /// Vector of highest-reward trajectory references
    pub fn sample_by_reward(&self, batch_size: usize) -> Vec<&AgentTrajectory> {
        let mut sorted: Vec<_> = self.trajectories.iter().collect();

        // Sort by total reward (descending)
        sorted.sort_by(|a, b| {
            b.total_reward
                .partial_cmp(&a.total_reward)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        sorted.into_iter().take(batch_size).collect()
    }

    /// Sample successful trajectories only
    ///
    /// # Arguments
    /// * `batch_size` - Number of trajectories to sample
    pub fn sample_successful(&self, batch_size: usize) -> Vec<&AgentTrajectory> {
        let successful: Vec<_> = self.trajectories
            .iter()
            .filter(|t| t.is_successful())
            .collect();

        let mut sorted = successful;
        sorted.sort_by(|a, b| {
            b.total_reward
                .partial_cmp(&a.total_reward)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        sorted.into_iter().take(batch_size).collect()
    }

    /// Get trajectory by ID
    pub fn get(&self, trajectory_id: u64) -> Option<&AgentTrajectory> {
        self.trajectories.get(trajectory_id as usize)
    }

    /// Get mutable trajectory by ID
    pub fn get_mut(&mut self, trajectory_id: u64) -> Option<&mut AgentTrajectory> {
        self.trajectories.get_mut(trajectory_id as usize)
    }

    /// Find trajectory by context hash
    ///
    /// Returns the most recent trajectory with matching context.
    pub fn find_by_context(&self, context_hash: u64) -> Option<&AgentTrajectory> {
        self.context_index
            .get(&context_hash)
            .and_then(|indices| indices.last())
            .and_then(|&idx| self.trajectories.get(idx))
    }

    /// Get buffer statistics
    pub fn stats(&self) -> AgentTrajectoryBufferStats {
        let total_trajectories = self.trajectories.len();
        let ongoing = self.trajectories.iter().filter(|t| t.is_ongoing()).count();
        let successful = self.trajectories.iter().filter(|t| t.is_successful()).count();
        let failed = self.trajectories
            .iter()
            .filter(|t| matches!(t.outcome, TrajectoryOutcome::Failure))
            .count();
        let timed_out = self.trajectories
            .iter()
            .filter(|t| matches!(t.outcome, TrajectoryOutcome::Timeout))
            .count();

        let total_reward: f32 = self.trajectories.iter().map(|t| t.total_reward).sum();
        let avg_reward = if total_trajectories > 0 {
            total_reward / total_trajectories as f32
        } else {
            0.0
        };

        AgentTrajectoryBufferStats {
            total_trajectories,
            ongoing,
            successful,
            failed,
            timed_out,
            total_reward,
            avg_reward,
            capacity: self.capacity,
            utilization: total_trajectories as f32 / self.capacity as f32,
        }
    }

    /// Get current buffer length
    pub fn len(&self) -> usize {
        self.trajectories.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.trajectories.is_empty()
    }

    /// Clear all trajectories
    pub fn clear(&mut self) {
        self.trajectories.clear();
        self.context_index.clear();
    }

    // ========================================================================
    // Internal Helpers
    // ========================================================================

    /// Evict the lowest-reward trajectory
    fn evict_low_reward(&mut self) {
        // Find trajectory with minimum total_reward
        if let Some((min_idx, _)) = self.trajectories
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                a.total_reward
                    .partial_cmp(&b.total_reward)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
        {
            // Remove from context index
            let context = self.trajectories[min_idx].context_hash;
            if let Some(index_vec) = self.context_index.get_mut(&context) {
                index_vec.retain(|&idx| idx != min_idx);
            }

            // Remove trajectory
            self.trajectories.remove(min_idx);

            // Update indices in context_index
            for vec in self.context_index.values_mut() {
                vec.iter_mut().for_each(|idx| {
                    if *idx > min_idx {
                        *idx -= 1;
                    }
                });
            }
        }
    }
}

// ============================================================================
// Agent Trajectory Buffer Statistics
// ============================================================================

/// Trajectory buffer statistics snapshot
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentTrajectoryBufferStats {
    /// Total number of trajectories
    pub total_trajectories: usize,
    /// Number of ongoing trajectories
    pub ongoing: usize,
    /// Number of successful trajectories
    pub successful: usize,
    /// Number of failed trajectories
    pub failed: usize,
    /// Number of timed out trajectories
    pub timed_out: usize,
    /// Total reward across all trajectories
    pub total_reward: f32,
    /// Average reward per trajectory
    pub avg_reward: f32,
    /// Buffer capacity
    pub capacity: usize,
    /// Buffer utilization (0.0 to 1.0)
    pub utilization: f32,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get current timestamp (Unix milliseconds)
///
/// Uses `js_sys::Date::now()` in WASM, `SystemTime` otherwise.
fn now() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now() as u64
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::replay::Experience;

    #[test]
    fn test_trajectory_creation() {
        let agent_id = [0u8; 32];
        let context_hash = 0xDEADBEEF;

        let trajectory = AgentTrajectory::new(0, agent_id, context_hash);

        assert_eq!(trajectory.id, 0);
        assert_eq!(trajectory.agent_id, agent_id);
        assert_eq!(trajectory.context_hash, context_hash);
        assert!(trajectory.transitions.is_empty());
        assert_eq!(trajectory.total_reward, 0.0);
        assert_eq!(trajectory.outcome, TrajectoryOutcome::Ongoing);
        assert!(trajectory.end_time.is_none());
    }

    #[test]
    fn test_trajectory_add_transition() {
        let mut trajectory = AgentTrajectory::new(0, [0u8; 32], 0xDEADBEEF);

        let transition = Transition::new(123, Action::DirectAnswer, 1.0, 456, 0.5);
        trajectory.add_transition(transition);

        assert_eq!(trajectory.transitions.len(), 1);
        assert_eq!(trajectory.total_reward, 1.0);
    }

    #[test]
    fn test_trajectory_complete() {
        let mut trajectory = AgentTrajectory::new(0, [0u8; 32], 0xDEADBEEF);

        trajectory.complete(TrajectoryOutcome::Success);

        assert_eq!(trajectory.outcome, TrajectoryOutcome::Success);
        assert!(trajectory.end_time.is_some());
        assert!(trajectory.is_successful());
        assert!(!trajectory.is_ongoing());
    }

    #[test]
    fn test_trajectory_outcome_score() {
        assert_eq!(TrajectoryOutcome::Success.score(), 1.0);
        assert_eq!(TrajectoryOutcome::Ongoing.score(), 0.5);
        assert_eq!(TrajectoryOutcome::Timeout.score(), 0.0);
        assert_eq!(TrajectoryOutcome::Failure.score(), -1.0);
    }

    #[test]
    fn test_trajectory_buffer_creation() {
        let buffer = AgentTrajectoryBuffer::new(100);

        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
        assert_eq!(buffer.capacity, 100);
    }

    #[test]
    fn test_trajectory_start() {
        let mut buffer = AgentTrajectoryBuffer::new(100);
        let agent_id = [1u8; 32];
        let context_hash = 0xDEADBEEF;

        let id = buffer.start(agent_id, context_hash);

        assert_eq!(buffer.len(), 1);
        assert_eq!(id, 0);

        let trajectory = buffer.get(id).unwrap();
        assert_eq!(trajectory.agent_id, agent_id);
        assert_eq!(trajectory.context_hash, context_hash);
    }

    #[test]
    fn test_trajectory_deduplication() {
        let mut buffer = AgentTrajectoryBuffer::new(100);
        let agent_id = [1u8; 32];
        let context_hash = 0xDEADBEEF;

        // Start first trajectory
        let id1 = buffer.start(agent_id, context_hash);
        assert_eq!(id1, 0);

        // Complete it
        buffer.complete(id1, TrajectoryOutcome::Success);

        // Start with same context (should create new)
        let id2 = buffer.start(agent_id, context_hash);
        assert_eq!(id2, 1);
        assert_eq!(buffer.len(), 2);
    }

    #[test]
    fn test_trajectory_eviction() {
        let mut buffer = AgentTrajectoryBuffer::new(2);

        // Fill buffer
        let id1 = buffer.start([1u8; 32], 1);
        buffer.add_transition(id1, create_transition(1.0));
        buffer.complete(id1, TrajectoryOutcome::Success);

        let id2 = buffer.start([2u8; 32], 2);
        buffer.add_transition(id2, create_transition(2.0));
        buffer.complete(id2, TrajectoryOutcome::Success);

        assert_eq!(buffer.len(), 2);

        // Add third - should evict lowest reward (id1 with 1.0)
        let id3 = buffer.start([3u8; 32], 3);
        buffer.add_transition(id3, create_transition(3.0));
        buffer.complete(id3, TrajectoryOutcome::Success);

        assert_eq!(buffer.len(), 2);
        assert!(buffer.get(id1).is_none()); // Evicted
        assert!(buffer.get(id2).is_some()); // Kept
        assert!(buffer.get(id3).is_some()); // Kept
    }

    #[test]
    fn test_sample_by_reward() {
        let mut buffer = AgentTrajectoryBuffer::new(100);

        // Add trajectories with different rewards
        for i in 0..10 {
            let id = buffer.start([0u8; 32], i);
            let reward = i as f32;
            buffer.add_transition(id, create_transition(reward));
            buffer.complete(id, TrajectoryOutcome::Success);
        }

        let sampled = buffer.sample_by_reward(3);

        assert_eq!(sampled.len(), 3);
        // Should get highest rewards: 9.0, 8.0, 7.0
        assert_eq!(sampled[0].total_reward, 9.0);
        assert_eq!(sampled[1].total_reward, 8.0);
        assert_eq!(sampled[2].total_reward, 7.0);
    }

    #[test]
    fn test_sample_successful_only() {
        let mut buffer = AgentTrajectoryBuffer::new(100);

        // Add successful trajectories
        let id1 = buffer.start([1u8; 32], 1);
        buffer.add_transition(id1, create_transition(1.0));
        buffer.complete(id1, TrajectoryOutcome::Success);

        // Add failed trajectory
        let id2 = buffer.start([2u8; 32], 2);
        buffer.add_transition(id2, create_transition(2.0));
        buffer.complete(id2, TrajectoryOutcome::Failure);

        let sampled = buffer.sample_successful(10);

        assert_eq!(sampled.len(), 1);
        assert_eq!(sampled[0].id, id1);
    }

    #[test]
    fn test_buffer_stats() {
        let mut buffer = AgentTrajectoryBuffer::new(100);

        // Add various outcomes
        let id1 = buffer.start([1u8; 32], 1);
        buffer.add_transition(id1, create_transition(1.0));
        buffer.complete(id1, TrajectoryOutcome::Success);

        let id2 = buffer.start([2u8; 32], 2);
        buffer.add_transition(id2, create_transition(2.0));
        buffer.complete(id2, TrajectoryOutcome::Failure);

        let id3 = buffer.start([3u8; 32], 3);
        // Leave ongoing

        let stats = buffer.stats();

        assert_eq!(stats.total_trajectories, 3);
        assert_eq!(stats.successful, 1);
        assert_eq!(stats.failed, 1);
        assert_eq!(stats.ongoing, 1);
        assert_eq!(stats.total_reward, 3.0);
        assert_eq!(stats.avg_reward, 1.0);
    }

    #[test]
    fn test_find_by_context() {
        let mut buffer = AgentTrajectoryBuffer::new(100);
        let context_hash = 0xDEADBEEF;

        let id = buffer.start([1u8; 32], context_hash);

        let found = buffer.find_by_context(context_hash);
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, id);

        let not_found = buffer.find_by_context(0xFFFFFFFF);
        assert!(not_found.is_none());
    }

    #[test]
    fn test_buffer_clear() {
        let mut buffer = AgentTrajectoryBuffer::new(100);

        buffer.start([1u8; 32], 1);
        buffer.start([2u8; 32], 2);

        assert_eq!(buffer.len(), 2);

        buffer.clear();

        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
    }

    // ========================================================================
    // Helper Functions for Tests
    // ========================================================================

    fn create_transition(reward: f32) -> Transition {
        Transition::new(0, Action::DirectAnswer, reward, 1, 0.5)
    }
}
