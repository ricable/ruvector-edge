//! ELEX Error Types
//!
//! Comprehensive error handling for all bounded contexts.
//! Uses thiserror for actionable error messages.

use std::fmt;

/// ELEX unified error type
///
/// Covers all error categories across the 6 bounded contexts.
#[derive(Clone, Debug)]
pub enum ElexError {
    // ==================== Knowledge Context ====================
    /// Invalid feature code format
    InvalidFeatureCode { code: String, reason: String },

    /// Feature not found in catalog
    FeatureNotFound { code: String },

    /// Parameter validation failed
    ParameterValidation {
        parameter: String,
        value: String,
        reason: String,
    },

    // ==================== Intelligence Context ====================
    /// Q-learning error
    QLearning { reason: String },

    /// HNSW index error
    HnswIndex { reason: String },

    /// Vector dimension mismatch
    VectorMismatch {
        expected: usize,
        actual: usize,
    },

    // ==================== Optimization Context ====================
    /// Optimization blocked by safety rule
    OptimizationBlocked { rule: String },

    /// Rollback failed
    RollbackFailed { reason: String },

    // ==================== Coordination Context ====================
    /// Invalid query format or content
    InvalidQuery { reason: String },

    /// Routing failed
    RoutingFailed { query: String, reason: String },

    /// Consensus error
    Consensus { reason: String },

    /// Gossip protocol error
    Gossip { reason: String },

    // ==================== Security Context ====================
    /// Cryptographic error
    Crypto { reason: String },

    /// Signature verification failed
    InvalidSignature,

    /// Encryption/decryption failed
    EncryptionFailed,

    // ==================== Runtime Context ====================
    /// Agent not found
    AgentNotFound { id: String },

    /// Agent initialization failed
    InitializationFailed { reason: String },

    /// Memory allocation failed
    OutOfMemory { requested: usize, available: usize },

    /// WASM runtime error
    WasmRuntime { reason: String },

    // ==================== Generic ====================
    /// Generic error with message
    Generic { message: String },

    /// I/O error
    Io(String),
}

impl fmt::Display for ElexError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ElexError::InvalidFeatureCode { code, reason } => {
                write!(f, "Invalid feature code '{}': {}", code, reason)
            }
            ElexError::FeatureNotFound { code } => {
                write!(f, "Feature '{}' not found in catalog", code)
            }
            ElexError::ParameterValidation {
                parameter,
                value,
                reason,
            } => {
                write!(
                    f,
                    "Parameter '{}' validation failed for value '{}': {}",
                    parameter, value, reason
                )
            }
            ElexError::QLearning { reason } => {
                write!(f, "Q-learning error: {}", reason)
            }
            ElexError::HnswIndex { reason } => {
                write!(f, "HNSW index error: {}", reason)
            }
            ElexError::VectorMismatch { expected, actual } => {
                write!(
                    f,
                    "Vector dimension mismatch: expected {}, got {}",
                    expected, actual
                )
            }
            ElexError::OptimizationBlocked { rule } => {
                write!(f, "Optimization blocked: {}", rule)
            }
            ElexError::RollbackFailed { reason } => {
                write!(f, "Rollback failed: {}", reason)
            }
            ElexError::InvalidQuery { reason } => {
                write!(f, "Invalid query: {}", reason)
            }
            ElexError::RoutingFailed { query, reason } => {
                write!(f, "Routing failed for query '{}': {}", query, reason)
            }
            ElexError::Consensus { reason } => {
                write!(f, "Consensus error: {}", reason)
            }
            ElexError::Gossip { reason } => {
                write!(f, "Gossip protocol error: {}", reason)
            }
            ElexError::Crypto { reason } => {
                write!(f, "Cryptography error: {}", reason)
            }
            ElexError::InvalidSignature => {
                write!(f, "Signature verification failed")
            }
            ElexError::EncryptionFailed => {
                write!(f, "Encryption/decryption failed")
            }
            ElexError::AgentNotFound { id } => {
                write!(f, "Agent '{}' not found", id)
            }
            ElexError::InitializationFailed { reason } => {
                write!(f, "Initialization failed: {}", reason)
            }
            ElexError::OutOfMemory { requested, available } => {
                write!(
                    f,
                    "Out of memory: requested {} bytes, {} available",
                    requested, available
                )
            }
            ElexError::WasmRuntime { reason } => {
                write!(f, "WASM runtime error: {}", reason)
            }
            ElexError::Generic { message } => {
                write!(f, "Error: {}", message)
            }
            ElexError::Io(msg) => {
                write!(f, "I/O error: {}", msg)
            }
        }
    }
}

impl std::error::Error for ElexError {}

// ============================================================================
// Conversions
// ============================================================================

impl From<std::io::Error> for ElexError {
    fn from(err: std::io::Error) -> Self {
        ElexError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for ElexError {
    fn from(err: serde_json::Error) -> Self {
        ElexError::Generic {
            message: format!("JSON error: {}", err),
        }
    }
}

// ============================================================================
// Result Type
// ============================================================================

/// Standard result type for ELEX operations
pub type Result<T> = std::result::Result<T, ElexError>;

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use crate::types::{RiskLevel, FeatureCode, QueryType, Action};

    #[test]
    fn test_feature_code_parsing() {
        let valid = FeatureCode::parse("FAJ 121 3094").unwrap();
        assert_eq!(valid.as_str(), "FAJ 121 3094");
        assert_eq!(valid.category(), 121);
        assert_eq!(valid.feature(), 3094);
    }

    #[test]
    fn test_feature_code_case_insensitive() {
        let lower = FeatureCode::parse("faj 121 3094").unwrap();
        let upper = FeatureCode::parse("FAJ 121 3094").unwrap();
        assert_eq!(lower.as_str(), upper.as_str());
    }

    #[test]
    fn test_invalid_feature_code() {
        let result = FeatureCode::parse("INVALID");
        assert!(result.is_err());
    }

    #[test]
    fn test_query_type_indices() {
        assert_eq!(QueryType::Parameter.index(), 0);
        assert_eq!(QueryType::Counter.index(), 1);
        assert_eq!(QueryType::Kpi.index(), 2);
        assert_eq!(QueryType::Procedure.index(), 3);
        assert_eq!(QueryType::Troubleshoot.index(), 4);
        assert_eq!(QueryType::General.index(), 5);
    }

    #[test]
    fn test_action_indices() {
        assert_eq!(Action::DirectAnswer.index(), 0);
        assert_eq!(Action::ContextAnswer.index(), 1);
        assert_eq!(Action::ConsultPeer.index(), 2);
        assert_eq!(Action::RequestClarification.index(), 3);
        assert_eq!(Action::Escalate.index(), 4);
    }

    #[test]
    fn test_risk_level_from_score() {
        assert_eq!(RiskLevel::from_score(0.1), RiskLevel::Low);
        assert_eq!(RiskLevel::from_score(0.3), RiskLevel::Medium);
        assert_eq!(RiskLevel::from_score(0.6), RiskLevel::High);
        assert_eq!(RiskLevel::from_score(0.9), RiskLevel::Critical);
    }
}
