//! ELEX Q-Learning Reinforcement Learning Engine
//!
//! This crate provides Q-learning algorithms for the ELEX WASM RAN Optimization SDK.
//! Implements SIMD-accelerated batch updates for 2-4x performance improvement.
//!
//! # Features
//! - SIMD-accelerated batch Q-value updates (ELEX-011)
//! - Scalar fallback for non-SIMD environments
//! - Thread-safe Q-table operations
//! - Comprehensive test coverage
//!
//! # Q-Learning Formula
//! Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
//!
//! # Typical Hyperparameters
//! - alpha (learning rate): 0.1
//! - gamma (discount factor): 0.95
//!
//! # Example
//! ```ignore
//! use elex_qlearning::batch;
//!
//! let mut q_values = vec![0.0f32; 100];
//! let rewards: Vec<f32> = (0..100).map(|i| i as f32 / 100.0).collect();
//! let next_max_q: Vec<f32> = (0..100).map(|i| i as f32 / 200.0).collect();
//!
//! // Automatically uses SIMD if available
//! batch::batch_q_update(
//!     &mut q_values,
//!     &rewards,
//!     &next_max_q,
//!     0.1,   // alpha
//!     0.95,  // gamma
//! );
//! ```

pub mod batch;
pub mod encoding;
pub mod qtable;
pub mod policy;
pub mod replay;
pub mod trajectory;

// Re-export main functions and types
pub use batch::{
    batch_q_update,
    batch_q_update_scalar,
    get_implementation,
    QUpdateImpl,
};

#[cfg(target_arch = "wasm32")]
pub use batch::batch_q_update_simd;

// Re-export Q-learning types
pub use qtable::{
    QTable, QEntry, QLearningConfig, QTableStats, State, StateHash, Reward,
};

// Re-export encoding types
pub use encoding::{
    QueryType, Complexity, StateHash as EncodedStateHash, DecodedState,
    confidence_bucket, hash_context,
};

// Re-export policy types
pub use policy::{
    Action, Policy, EpsilonGreedy, ActionSelection,
};

// Re-export replay buffer types
pub use replay::{
    Experience, Trajectory, PrioritizedBuffer, TrajectoryBuffer, ExperienceBuffer,
};

// Re-export enhanced trajectory types
pub use trajectory::{
    AgentTrajectory,
    AgentTrajectoryBuffer,
    AgentTrajectoryBufferStats,
    TrajectoryOutcome,
};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Q-Learning default hyperparameters
pub mod defaults {
    /// Default learning rate (alpha)
    pub const ALPHA: f32 = 0.1;

    /// Default discount factor (gamma)
    pub const GAMMA: f32 = 0.95;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn test_defaults() {
        assert_eq!(defaults::ALPHA, 0.1);
        assert_eq!(defaults::GAMMA, 0.95);
    }
}
