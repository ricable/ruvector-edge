//! State/Action Encoding for Q-Learning
//!
//! Deterministic state encoding into 64-bit hash for efficient Q-table lookup.
//!
//! # State Layout (64-bit hash)
//! ```text
//! [query_type: 3 bits][complexity: 2 bits][confidence_bucket: 4 bits][context_hash: 55 bits]
//! ```
//!
//! # Features
//! - Deterministic encoding: same input always produces same hash
//! - Efficient bit packing for minimal state space
//! - Confidence discretization into 16 buckets
//! - WASM-compatible (no external dependencies)
//!
//! # Example
//! ```ignore
//! use elex_qlearning::encoding::{StateHash, QueryType, Complexity};
//!
//! let hash = StateHash::encode(
//!     QueryType::Parameter,
//!     Complexity::Moderate,
//!     0x123456789ABCDEF,
//!     0.75
//! );
//! ```

use std::hash::Hash;

// ============================================================================
// Type Definitions
// ============================================================================

/// Query type enumeration
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum QueryType {
    /// Parameter query (e.g., "What is lbTpNonQualFraction?")
    Parameter = 0,
    /// Counter query (e.g., "Show pmLbEval results")
    Counter = 1,
    /// KPI query (e.g., "What is the current handover success rate?")
    Kpi = 2,
    /// Procedure query (e.g., "How do I configure CA?")
    Procedure = 3,
    /// Troubleshooting query (e.g., "Why is handover failing?")
    Troubleshoot = 4,
    /// General query (fallback)
    General = 5,
}

impl QueryType {
    /// Get all query types
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

    /// Get index (0-5)
    pub fn index(&self) -> u8 {
        *self as u8
    }

    /// Create from index
    pub fn from_index(idx: u8) -> Option<Self> {
        match idx {
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

/// Query complexity enumeration
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum Complexity {
    /// Simple query (single parameter, direct answer)
    Simple = 0,
    /// Moderate query (multiple parameters, some context)
    Moderate = 1,
    /// Complex query (cross-feature, requires analysis)
    Complex = 2,
}

impl Complexity {
    /// Get all complexity levels
    pub fn all() -> &'static [Complexity] {
        &[Complexity::Simple, Complexity::Moderate, Complexity::Complex]
    }

    /// Get index (0-2)
    pub fn index(&self) -> u8 {
        *self as u8
    }

    /// Create from index
    pub fn from_index(idx: u8) -> Option<Self> {
        match idx {
            0 => Some(Complexity::Simple),
            1 => Some(Complexity::Moderate),
            2 => Some(Complexity::Complex),
            _ => None,
        }
    }
}

// ============================================================================
// State Hash
// ============================================================================

/// Deterministic 64-bit state hash
///
/// Encodes query characteristics into a compact hash for Q-table indexing.
/// Same inputs always produce the same hash (deterministic).
#[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Debug)]
pub struct StateHash(pub u64);

impl StateHash {
    /// Encode state components into 64-bit hash
    ///
    /// # Bit Layout
    /// ```text
    /// Bits 0-2:   query_type (3 bits, values 0-5)
    /// Bits 3-4:   complexity (2 bits, values 0-2)
    /// Bits 5-8:   confidence_bucket (4 bits, values 0-15)
    /// Bits 9-63:  context_hash (55 bits, truncated)
    /// ```
    ///
    /// # Arguments
    /// * `query_type` - Type of query (Parameter, Counter, etc.)
    /// * `complexity` - Query complexity (Simple, Moderate, Complex)
    /// * `context_hash` - Hash of query context (e.g., feature hash)
    /// * `confidence` - Confidence score (0.0-1.0), discretized into 16 buckets
    ///
    /// # Example
    /// ```ignore
    /// let hash = StateHash::encode(
    ///     QueryType::Parameter,
    ///     Complexity::Simple,
    ///     0x123456789ABCDEF,
    ///     0.75
    /// );
    /// ```
    #[inline]
    pub fn encode(query_type: QueryType, complexity: Complexity, context_hash: u64, confidence: f32) -> Self {
        // 3 bits: query_type (0-5)
        let type_bits = (query_type as u64) & 0x7;

        // 2 bits: complexity (0-2)
        let complexity_bits = ((complexity as u64) & 0x3) << 3;

        // 4 bits: confidence bucket (0-15)
        let confidence_bits = ((confidence_bucket(confidence) as u64) & 0xF) << 5;

        // 55 bits: context_hash (truncated)
        let context_bits = (context_hash & 0x3FFFFFFFFFFFFFF) << 9;

        StateHash(type_bits | complexity_bits | confidence_bits | context_bits)
    }

    /// Get the raw u64 value
    #[inline]
    pub fn value(&self) -> u64 {
        self.0
    }

    /// Decode state hash into components (for debugging/testing)
    #[inline]
    pub fn decode(&self) -> DecodedState {
        DecodedState {
            query_type: QueryType::from_index((self.0 & 0x7) as u8).unwrap_or(QueryType::General),
            complexity: Complexity::from_index(((self.0 >> 3) & 0x3) as u8).unwrap_or(Complexity::Simple),
            confidence_bucket: ((self.0 >> 5) & 0xF) as u8,
            context_hash: (self.0 >> 9) & 0x3FFFFFFFFFFFFFF,
        }
    }

    /// Create from raw u64 value
    #[inline]
    pub fn from_u64(value: u64) -> Self {
        StateHash(value)
    }
}

/// Decoded state components (for debugging/testing)
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DecodedState {
    pub query_type: QueryType,
    pub complexity: Complexity,
    pub confidence_bucket: u8,
    pub context_hash: u64,
}

impl DecodedState {
    /// Get confidence value from bucket
    pub fn confidence(&self) -> f32 {
        (self.confidence_bucket as f32) / 15.0
    }
}

// ============================================================================
// Confidence Bucket
// ============================================================================

/// Discretize confidence into 16 buckets (0-15)
///
/// Maps continuous confidence [0.0, 1.0] to discrete buckets [0, 15].
///
/// # Mapping
/// - 0.00 - 0.0625 -> bucket 0
/// - 0.0625 - 0.125 -> bucket 1
/// - ...
/// - 0.9375 - 1.0 -> bucket 15
#[inline]
pub fn confidence_bucket(confidence: f32) -> u8 {
    let clamped = confidence.clamp(0.0, 1.0);
    // Multiply by 15 and round to nearest bucket
    let bucket = (clamped * 15.0).round() as u8;
    bucket.min(15)
}

// ============================================================================
// Context Hashing
// ============================================================================

/// Simple hash for context string
///
/// In production, would use a proper hashing algorithm.
/// This is a placeholder for demonstration.
pub fn hash_context(context: &str) -> u64 {
    let mut hash: u64 = 5381;
    for byte in context.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
    }
    hash
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

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
    fn test_query_type_from_index() {
        assert_eq!(QueryType::from_index(0), Some(QueryType::Parameter));
        assert_eq!(QueryType::from_index(5), Some(QueryType::General));
        assert_eq!(QueryType::from_index(6), None);
    }

    #[test]
    fn test_complexity_indices() {
        assert_eq!(Complexity::Simple.index(), 0);
        assert_eq!(Complexity::Moderate.index(), 1);
        assert_eq!(Complexity::Complex.index(), 2);
    }

    #[test]
    fn test_complexity_from_index() {
        assert_eq!(Complexity::from_index(0), Some(Complexity::Simple));
        assert_eq!(Complexity::from_index(2), Some(Complexity::Complex));
        assert_eq!(Complexity::from_index(3), None);
    }

    #[test]
    fn test_confidence_bucket() {
        assert_eq!(confidence_bucket(0.0), 0);
        assert_eq!(confidence_bucket(0.5), 8); // ~0.5 * 15 = 7.5 -> 8
        assert_eq!(confidence_bucket(1.0), 15);

        // Clamping
        assert_eq!(confidence_bucket(-0.5), 0);
        assert_eq!(confidence_bucket(1.5), 15);
    }

    #[test]
    fn test_state_hash_deterministic() {
        let hash1 = StateHash::encode(
            QueryType::Parameter,
            Complexity::Simple,
            0x123456789ABCDEF,
            0.75,
        );

        let hash2 = StateHash::encode(
            QueryType::Parameter,
            Complexity::Simple,
            0x123456789ABCDEF,
            0.75,
        );

        assert_eq!(hash1, hash2, "Same inputs should produce same hash");
    }

    #[test]
    fn test_state_hash_different_inputs() {
        let hash1 = StateHash::encode(
            QueryType::Parameter,
            Complexity::Simple,
            0x123456789ABCDEF,
            0.75,
        );

        let hash2 = StateHash::encode(
            QueryType::Counter,
            Complexity::Simple,
            0x123456789ABCDEF,
            0.75,
        );

        assert_ne!(hash1, hash2, "Different query types should produce different hashes");
    }

    #[test]
    fn test_state_hash_encoding() {
        // Test bit layout
        let hash = StateHash::encode(
            QueryType::Parameter,      // 0
            Complexity::Simple,         // 0
            0xFFFFFFFFFFFFFF,          // max context
            1.0,                        // bucket 15
        );

        let value = hash.value();

        // Bits 0-2: query_type = 0
        assert_eq!(value & 0x7, 0);

        // Bits 3-4: complexity = 0
        assert_eq!((value >> 3) & 0x3, 0);

        // Bits 5-8: confidence_bucket = 15
        assert_eq!((value >> 5) & 0xF, 15);

        // Bits 9-63: context_hash (truncated to 55 bits)
        assert_eq!((value >> 9) & 0x3FFFFFFFFFFFFFF, 0xFFFFFFFFFFFFFF & 0x3FFFFFFFFFFFFFF);
    }

    #[test]
    fn test_state_hash_decode() {
        let original_hash = StateHash::encode(
            QueryType::Troubleshoot,
            Complexity::Complex,
            0xABCDEF123456789,
            0.6,
        );

        let decoded = original_hash.decode();

        assert_eq!(decoded.query_type, QueryType::Troubleshoot);
        assert_eq!(decoded.complexity, Complexity::Complex);
        assert_eq!(decoded.confidence_bucket, confidence_bucket(0.6));
        assert_eq!(decoded.context_hash, 0xABCDEF123456789 & 0x3FFFFFFFFFFFFFF);
    }

    #[test]
    fn test_state_hash_from_u64() {
        let value = 0x123456789ABCDEF;
        let hash = StateHash::from_u64(value);
        assert_eq!(hash.value(), value);
    }

    #[test]
    fn test_confidence_rounding() {
        // Test edge cases for rounding
        assert_eq!(confidence_bucket(0.0), 0);
        assert_eq!(confidence_bucket(0.033), 0); // Rounds to 0
        assert_eq!(confidence_bucket(0.034), 1); // Rounds to 1
        assert_eq!(confidence_bucket(0.5), 8);
        assert_eq!(confidence_bucket(0.967), 15);
        assert_eq!(confidence_bucket(0.966), 14); // Rounds to 14
    }

    #[test]
    fn test_hash_context() {
        let hash1 = hash_context("lbTpNonQualFraction");
        let hash2 = hash_context("lbTpNonQualFraction");
        let hash3 = hash_context("different");

        assert_eq!(hash1, hash2, "Same context should produce same hash");
        assert_ne!(hash1, hash3, "Different context should produce different hash");
    }

    #[test]
    fn test_decoded_state_confidence() {
        let decoded = DecodedState {
            query_type: QueryType::General,
            complexity: Complexity::Simple,
            confidence_bucket: 8,
            context_hash: 0,
        };

        assert!((decoded.confidence() - 0.5333).abs() < 0.01, "Bucket 8 should be ~0.53");
    }
}
