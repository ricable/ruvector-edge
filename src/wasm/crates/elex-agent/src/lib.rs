//! ELEX Agent
//!
//! Core agent implementation for RAN feature optimization.
//!
//! This crate provides the FeatureAgent aggregate root that integrates:
//! - **Identity** (Ed25519 keypair, agent_id) from elex-crypto
//! - **Knowledge** (Feature metadata, parameters, counters, KPIs) from elex-core
//! - **Q-Table** (State-action values, visits, confidence) from elex-qlearning
//! - **Trajectory Buffer** (Experience replay) from elex-qlearning
//! - **SIMD Operations** (Vectorized processing) from elex-simd
//! - **Vector Memory** (HNSW index slice) from elex-memory
//!
//! # FeatureAgent Components
//!
//! ## Identity Layer (elex-crypto)
//! - Ed25519 keypair for cryptographic signing
//! - Agent ID derived from public key (32 bytes)
//! - Public key for federated learning and peer authentication
//!
//! ## Knowledge Layer (elex-core)
//! - Feature metadata (name, category, description)
//! - Parameters (average 16 per feature)
//! - Counters (average 6 per feature)
//! - KPIs (average 1.3 per feature)
//!
//! ## Intelligence Layer (elex-qlearning)
//! - Q-table with state-action values
//! - Visit tracking for confidence scoring
//! - Trajectory buffer (1000 max) with priority sampling
//! - Epsilon-greedy policy (0.1 -> 0.01 decay)
//!
//! ## Processing Layer (elex-simd)
//! - SIMD-accelerated cosine similarity
//! - Batch Q-learning updates
//! - Parameter validation with bitmasks
//! - Counter aggregation
//!
//! ## Memory Layer (elex-memory)
//! - HNSW vector index with 128-dim embeddings
//! - <1ms P95 search latency for 10K vectors
//! - 150x-12,500x faster than linear search
//!
//! ## Safety Layer (elex-safety)
//! - Safe zone validation on all parameter changes
//! - Blocking conditions for critical failures
//! - Automatic rollback on KPI degradation
//!
//! # Example
//!
//! ```ignore
//! use elex_agent::FeatureAgent;
//! use elex_core::types::FeatureCode;
//! use elex_core::feature::Feature;
//!
//! // Create agent for MIMO Sleep feature
//! let code = FeatureCode::parse("FAJ 121 3094").unwrap();
//! let feature = Feature::new(
//!     code.clone(),
//!     "MIMO Sleep".to_string(),
//!     "Energy Saving".to_string(),
//!     "LTE".to_string(),
//! );
//!
//! let mut agent = FeatureAgent::new(code, feature);
//! agent.initialize().unwrap();
//!
//! // Process a query
//! let response = agent.process_query(
//!     "How do I activate MIMO sleep?",
//!     QueryType::Procedure,
//!     Complexity::Moderate,
//!     None,
//! ).unwrap();
//!
//! // Receive feedback
//! agent.receive_feedback(trajectory_id, 1.0, true).unwrap();
//!
//! // Federated sync with peers
//! let peer_q_tables = vec![&peer_agent.q_table];
//! let weights = vec![0.5];
//! agent.federated_sync(&peer_q_tables, &weights).unwrap();
//! ```

pub mod agent;
pub mod query_handler;
pub mod cmedit;

// Re-export the main FeatureAgent type
pub use agent::FeatureAgent;

// Re-export QueryHandler
pub use query_handler::{
    QueryHandler,
    QueryInput,
    QueryResponse,
    ExtractedEntities,
    ContextResult,
    SimilarQuery,
    CmeditCommand as QueryCmeditCommand,
};

// Re-export cmedit command generator (ELEX-038)
pub use cmedit::{
    CmeditGenerator,
    CmeditCommand,
    CmeditType,
    ParameterChange,
    ParameterQuery,
    MoClass,
    parse_mo_class,
    parse_mo_id,
    format_mo_path,
};

// Re-export statistics
pub use agent::AgentStats;

// Re-export core types for convenience
pub use elex_core::types::{
    AgentId, FeatureCode, Action, QueryType, Complexity, Confidence, Embedding,
};
pub use elex_core::traits::{Agent, Learnable, Routable, Validatable};
pub use elex_core::feature::Feature;

// Re-export crypto types
pub use elex_crypto::identity::{AgentIdentity, PublicKey};

// Re-export Q-learning types
pub use elex_qlearning::{
    qtable::{QTable, QLearningConfig, StateHash, State},
    trajectory::{AgentTrajectoryBuffer, TrajectoryOutcome},
    policy::EpsilonGreedy,
};

// Re-export SIMD operations
pub use elex_simd::VectorOps;

// Re-export memory types
pub use elex_memory::{HnswIndex, HnswConfig, SearchResult};

// Re-export safety types
pub use elex_safety::{SafeZoneValidator, BlockingManager};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn test_feature_agent_reexport() {
        // Ensure FeatureAgent is accessible
        let code = FeatureCode::parse("FAJ 121 3094").unwrap();
        let feature = Feature::new(
            code.clone(),
            "Test".to_string(),
            "Test".to_string(),
            "LTE".to_string(),
        );

        let agent = FeatureAgent::new(code, feature);
        assert_eq!(agent.query_count, 0);
    }

    #[test]
    fn test_types_reexport() {
        // Ensure types are re-exported
        let _action = Action::DirectAnswer;
        let _query_type = QueryType::General;
        let _complexity = Complexity::Simple;
    }
}
