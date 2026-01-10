//! Core Traits
//!
//! Defines the key traits that agents and components must implement.

use crate::types::{AgentId, Embedding, FeatureCode, Action, QueryType, Complexity, Confidence};
use crate::error::Result;

// ============================================================================
// Agent Trait
// ============================================================================

/// Core agent trait that all feature agents must implement
pub trait Agent: Send + Sync {
    /// Get unique agent identifier
    fn id(&self) -> &AgentId;

    /// Get feature code this agent specializes in
    fn feature_code(&self) -> &FeatureCode;

    /// Get current agent status
    fn status(&self) -> &str;

    /// Initialize the agent
    fn initialize(&mut self) -> Result<()>;

    /// Shutdown the agent
    fn shutdown(&mut self) -> Result<()>;

    /// Get agent statistics
    fn stats(&self) -> String;
}

// ============================================================================
// Vector Index Trait
// ============================================================================

/// Vector index for semantic search
///
/// Implemented by HNSW and other ANN (Approximate Nearest Neighbor) indices.
pub trait VectorIndex: Send + Sync {
    /// Insert a vector into the index
    fn insert(&mut self, id: u64, vector: &Embedding) -> Result<()>;

    /// Search for k nearest neighbors
    fn search(&self, query: &Embedding, k: usize) -> Result<Vec<(u64, f32)>>;

    /// Get index size
    fn len(&self) -> usize;

    /// Check if index is empty
    fn is_empty(&self) -> bool;

    /// Clear all entries
    fn clear(&mut self);
}

// ============================================================================
// Q-Table Trait
// ============================================================================

/// Q-table for reinforcement learning
pub trait QTable: Send + Sync {
    /// Get Q-value for state-action pair
    fn get_q_value(&self, state: u64, action: Action) -> f32;

    /// Set Q-value for state-action pair
    fn set_q_value(&mut self, state: u64, action: Action, value: f32);

    /// Update Q-value using reward and next state
    fn update_q_value(&mut self, state: u64, action: Action, reward: f32, next_max_q: f32) -> f32;

    /// Get number of entries
    fn len(&self) -> usize;
}

// ============================================================================
// Learnable Trait
// ============================================================================

/// Trait for components that can learn from feedback
pub trait Learnable: Send + Sync {
    /// Select action using current policy (e.g., epsilon-greedy)
    fn select_action(&mut self, state: u64, available_actions: &[Action]) -> Action;

    /// Update from feedback
    fn update(&mut self, state: u64, action: Action, reward: f32) -> Result<()>;

    /// Get confidence in learned knowledge
    fn confidence(&self) -> Confidence;
}

// ============================================================================
// Routable Trait
// ============================================================================

/// Trait for components that can be semantically routed to
pub trait Routable: Send + Sync {
    /// Get expertise embedding for semantic routing
    fn expertise_embedding(&self) -> &Embedding;

    /// Compute similarity with query embedding
    fn similarity(&self, query: &Embedding) -> f32 {
        // Default cosine similarity
        cosine_similarity(self.expertise_embedding(), query)
    }

    /// Get category for routing
    fn category(&self) -> &str;
}

/// Cosine similarity between two embeddings
pub fn cosine_similarity(a: &Embedding, b: &Embedding) -> f32 {
    assert_eq!(a.len(), b.len(), "Embeddings must have same length");

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

// ============================================================================
// Validatable Trait
// ============================================================================

/// Trait for components that validate parameters and commands
pub trait Validatable: Send + Sync {
    /// Validate a parameter value
    fn validate_parameter(&self, parameter: &str, value: &str) -> Result<bool>;

    /// Generate cmedit command for parameter change
    fn generate_command(&self, parameter: &str, value: &str) -> Result<String>;

    /// Check if parameter is in cooldown period
    fn check_cooldown(&self, parameter: &str) -> Result<bool>;
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_identical() {
        let mut a_full: Embedding = [0.0; 128];
        let mut b_full: Embedding = [0.0; 128];
        a_full[0] = 1.0;
        b_full[0] = 1.0;

        let sim = cosine_similarity(&a_full, &b_full);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let mut a_full: Embedding = [0.0; 128];
        let mut b_full: Embedding = [0.0; 128];
        a_full[0] = 1.0;
        b_full[1] = 1.0;

        let sim = cosine_similarity(&a_full, &b_full);
        assert!(sim.abs() < 0.001);
    }
}
