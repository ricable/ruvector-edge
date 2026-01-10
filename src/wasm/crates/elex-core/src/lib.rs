//! ELEX Core
//!
//! Core data structures and utilities for the ELEX RAN optimization system.

pub mod error;
pub mod feature;
pub mod knowledge;
pub mod types;
pub mod traits;

// Re-export main types
pub use error::{ElexError, Result};
pub use feature::{Feature, Parameter, Counter, KPI, SafeZone, Procedure, ProcedureStep};
pub use knowledge::{FeatureAgent, AgentStats, AgentStatus};
pub use traits::{Agent, Learnable, Routable, Validatable, VectorIndex, QTable, cosine_similarity};
