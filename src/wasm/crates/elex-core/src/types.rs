//! Core Domain Types
//!
//! Defines all fundamental types used across the ELEX system.
//! These types are WASM-compatible and optimized for edge deployment.

use serde::{Deserialize, Serialize};
use std::fmt;
use crate::error::{ElexError, Result};

// ============================================================================
// Identity Types
// ============================================================================

/// Agent unique identifier (32 bytes - Ed25519 public key hash)
///
/// Derived from Ed25519 public key, represented as hex string.
/// Example: "a1b2c3d4e5f6...7890" (64 hex chars)
pub type AgentId = [u8; 32];

/// Feature code (FAJ code) for Ericsson RAN features
///
/// Format: "FAJ XXX YYYY" where XXX = category, YYYY = feature
/// Example: "FAJ 121 3094" = MIMO Sleep Mode
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FeatureCode(String);

impl FeatureCode {
    /// Parse a feature code from string
    pub fn parse(code: &str) -> Result<Self> {
        let code = code.trim().to_uppercase();
        if !code.starts_with("FAJ") {
            return Err(ElexError::InvalidFeatureCode {
                code: code.clone(),
                reason: "Must start with 'FAJ'".to_string(),
            });
        }

        let parts: Vec<&str> = code.split_whitespace().collect();
        if parts.len() != 3 {
            return Err(ElexError::InvalidFeatureCode {
                code,
                reason: "Must be 'FAJ XXX YYYY' format".to_string(),
            });
        }

        Ok(FeatureCode(format!("FAJ {} {}", parts[1], parts[2])))
    }

    /// Get the category code (XXX part)
    pub fn category(&self) -> u16 {
        self.0
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    }

    /// Get the feature code (YYYY part)
    pub fn feature(&self) -> u16 {
        self.0
            .split_whitespace()
            .nth(2)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for FeatureCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for FeatureCode {
    fn from(s: String) -> Self {
        FeatureCode(s.to_uppercase())
    }
}

impl From<&str> for FeatureCode {
    fn from(s: &str) -> Self {
        FeatureCode(s.to_uppercase())
    }
}

// ============================================================================
// Vector Types
// ============================================================================

/// State vector for Q-learning state encoding
///
/// 64-dimensional float array for encoding agent state.
/// Used as Q-table lookup keys.
pub type StateVector = [f32; 64];

/// Embedding vector for semantic search
///
/// 128-dimensional float array for HNSW indexing.
/// Represents semantic meaning of queries, responses, features.
pub type Embedding = [f32; 128];

/// Context hash for trajectory deduplication
///
/// 64-bit hash of query context for identifying similar interactions.
pub type ContextHash = u64;

// ============================================================================
// Query Types
// ============================================================================

/// Query type classification
///
/// Determines the intent category of user queries.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum QueryType {
    /// Parameter configuration query
    Parameter,
    /// Counter monitoring query
    Counter,
    /// KPI analysis query
    Kpi,
    /// Procedure/activation query
    Procedure,
    /// Troubleshooting query
    Troubleshoot,
    /// General knowledge query
    General,
}

impl QueryType {
    /// Get all query type variants
    pub fn all() -> &'static [QueryType] {
        &[
            QueryType::Parameter,
            QueryType::Counter,
            QueryType::Kpi,
            QueryType::Procedure,
            QueryType::Troubleshoot,
            QueryType::General,
        ]
    }

    /// Get query type index (for encoding)
    pub fn index(&self) -> u8 {
        match self {
            QueryType::Parameter => 0,
            QueryType::Counter => 1,
            QueryType::Kpi => 2,
            QueryType::Procedure => 3,
            QueryType::Troubleshoot => 4,
            QueryType::General => 5,
        }
    }

    /// Parse from index
    pub fn from_index(i: u8) -> Option<Self> {
        match i {
            0 => Some(QueryType::Parameter),
            1 => Some(QueryType::Counter),
            2 => Some(QueryType::Kpi),
            3 => Some(QueryType::Procedure),
            4 => Some(QueryType::Troubleshoot),
            5 => Some(QueryType::General),
            _ => None,
        }
    }
}

/// Query complexity classification
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Complexity {
    /// Single-parameter query
    Simple,
    /// Multi-parameter or single-feature query
    Moderate,
    /// Cross-feature or system-wide query
    Complex,
}

impl Complexity {
    pub fn index(&self) -> u8 {
        match self {
            Complexity::Simple => 0,
            Complexity::Moderate => 1,
            Complexity::Complex => 2,
        }
    }
}

// ============================================================================
// Action Types (Q-Learning)
// ============================================================================

/// Agent action for Q-learning
///
/// Represents the possible responses an agent can take.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Action {
    /// Answer directly from feature knowledge
    DirectAnswer,
    /// Answer + vector memory context
    ContextAnswer,
    /// Consult related feature agents
    ConsultPeer,
    /// Request more information from user
    RequestClarification,
    /// Escalate to human expert
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
// Risk and Safety Types
// ============================================================================

/// Risk level for parameter changes
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum RiskLevel {
    /// Safe to apply automatically
    Low,
    /// Requires validation before applying
    Medium,
    /// Requires explicit approval
    High,
    /// Blocked - cannot apply
    Critical,
}

impl RiskLevel {
    pub fn from_score(score: f32) -> Self {
        if score < 0.25 {
            RiskLevel::Low
        } else if score < 0.5 {
            RiskLevel::Medium
        } else if score < 0.75 {
            RiskLevel::High
        } else {
            RiskLevel::Critical
        }
    }

    pub fn as_score(&self) -> f32 {
        match self {
            RiskLevel::Low => 0.1,
            RiskLevel::Medium => 0.4,
            RiskLevel::High => 0.7,
            RiskLevel::Critical => 1.0,
        }
    }
}

/// Reward signal for Q-learning
///
/// Typical range: [-1.0, 1.0]
/// - Positive: successful/helpful response
/// - Negative: failed/unhelpful response
pub type Reward = f32;

/// Confidence score (0.0 to 1.0)
pub type Confidence = f32;

// ============================================================================
// Helper Types
// ============================================================================

/// Timestamp (Unix milliseconds)
pub type Timestamp = u64;

/// Duration in milliseconds
pub type DurationMs = u64;
