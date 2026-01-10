//! ELEX Cryptography - Security Layer for 593-Agent Swarm
//!
//! This crate implements the cryptographic foundation for the ELEX distributed
//! agent swarm system, providing identity, signing, encryption, and safe zone
//! enforcement as specified in ADR-007 and ADR-008.
//!
//! ## Architecture
//!
//! The security layer is organized into five cryptographic layers:
//!
//! 1. **Identity** (Ed25519): Agent identity with cryptographic keypairs
//! 2. **Signing** (Ed25519): Message authentication with replay protection
//! 3. **Encryption** (AES-256-GCM): Payload confidentiality
//! 4. **Key Exchange** (X25519): Session key establishment
//! 5. **Safe Zones**: Hardcoded parameter constraints
//!
//! ## Security Properties
//!
//! - **128-bit security level**: Ed25519 provides strong security guarantees
//! - **Replay protection**: 5-minute validity window with nonce deduplication
//! - **Perfect forward secrecy**: Ephemeral X25519 keys per session
//! - **Hardcoded safety**: Safe zones cannot be overridden at runtime
//!
//! ## Usage
//!
//! ```rust
//! use elex_crypto::{AgentIdentity, Signature, sign_message, verify_signature};
//!
//! // Generate agent identity
//! let identity = AgentIdentity::generate();
//!
//! // Sign a message
//! let message = b"Hello, swarm!";
//! let signature = sign_message(&identity, message)?;
//!
//! // Verify signature (in production, use peer's public key)
//! let valid = verify_signature(message, &signature, &identity.public_key())?;
//! assert!(valid);
//! # Ok::<(), elex_crypto::CryptoError>(())
//! ```
//!
//! ## Threat Model
//!
//! See [SECURITY.md](SECURITY.md) for comprehensive threat analysis and mitigations.
//!
//! ## ADR Compliance
//!
//! - ADR-007: Security and Cryptography Architecture
//! - ADR-008: Safe Zone Parameter Constraints
//! - ADR-012: Unsafe Rust Policy

#![deny(missing_docs)]
#![warn(unsafe_code)]
#![warn(clippy::undocumented_unsafe_blocks)]

pub mod identity;
pub mod signing;
pub mod encryption;
pub mod key_exchange;
// safe_zone is now in elex-safety crate
// TODO: Implement audit and replay modules
// pub mod audit;
// pub mod replay;

// Re-export key types for convenience
pub use identity::{AgentIdentity, AgentId, KeyPair, PublicKey};
pub use signing::{Signature, sign_message, verify_signature, SignedMessage};
pub use encryption::{encrypt, decrypt, SessionKey, EncryptedPayload};
pub use key_exchange::{SessionKeyExchange, KeyExchangeResult};
// safe_zone is now in elex-safety crate
// TODO: Implement audit and replay modules
// pub use audit::{AuditEvent, AuditLog};
// pub use replay::{ReplayProtection, ReplayAttack};

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Maximum age for signature validity (5 minutes)
pub const MAX_SIGNATURE_AGE: Duration = Duration::from_secs(5 * 60);

/// Session key lifetime (60 minutes)
pub const SESSION_KEY_LIFETIME: Duration = Duration::from_secs(60 * 60);

/// Nonce size for replay protection (16 bytes)
pub const NONCE_SIZE: usize = 16;

/// Signature algorithm identifier
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum SignatureAlgorithm {
    /// Ed25519 signature (default)
    Ed25519,
    /// Post-quantum Dilithium3 (future)
    Dilithium3,
    /// Hybrid Ed25519 + Dilithium3 (future)
    Hybrid,
}

/// Cryptographic error types
#[derive(thiserror::Error, Debug)]
pub enum CryptoError {
    /// Signature verification failed
    #[error("Signature verification failed")]
    SignatureVerificationFailed,

    /// Signature has expired
    #[error("Signature expired (created at {timestamp:?})")]
    SignatureExpired {
        /// Timestamp when the signature was created
        timestamp: chrono::DateTime<chrono::Utc>,
    },

    /// Potential replay attack detected
    #[error("Replay attack detected: nonce {nonce:x?} already seen from agent {agent_id}")]
    ReplayAttack {
        /// The nonce that was reused
        nonce: [u8; 16],
        /// The agent ID that reused the nonce
        agent_id: String,
    },

    /// Invalid key format
    #[error("Invalid key format: {reason}")]
    InvalidKeyFormat {
        /// Description of why the key format is invalid
        reason: String,
    },

    /// Encryption failed
    #[error("Encryption failed: {reason}")]
    EncryptionFailed {
        /// Description of why encryption failed
        reason: String,
    },

    /// Decryption failed
    #[error("Decryption failed: {reason}")]
    DecryptionFailed {
        /// Description of why decryption failed
        reason: String,
    },

    /// Key exchange failed
    #[error("Key exchange failed: {reason}")]
    KeyExchangeFailed {
        /// Description of why key exchange failed
        reason: String,
    },

    /// Safe zone violation (handled by elex-safety crate)
    #[error("Safe zone violation: {violation}")]
    SafeZoneViolation {
        /// Description of the violation
        violation: String,
    },

    /// Invalid algorithm specified
    #[error("Invalid algorithm: {algorithm}")]
    InvalidAlgorithm {
        /// The algorithm that was specified
        algorithm: String,
    },

    /// Random number generation failed
    #[error("Random number generation failed")]
    RandomGenerationFailed,

    /// Invalid nonce size
    #[error("Invalid nonce size: expected {expected}, got {got}")]
    InvalidNonceSize {
        /// The expected nonce size
        expected: usize,
        /// The actual nonce size received
        got: usize,
    },

    /// Invalid message format
    #[error("Invalid message format: {reason}")]
    InvalidMessageFormat {
        /// Description of why the message format is invalid
        reason: String,
    },
}

/// Result type for cryptographic operations
pub type Result<T> = std::result::Result<T, CryptoError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(MAX_SIGNATURE_AGE.as_secs(), 300);
        assert_eq!(SESSION_KEY_LIFETIME.as_secs(), 3600);
        assert_eq!(NONCE_SIZE, 16);
    }

    #[test]
    fn test_error_display() {
        let err = CryptoError::SignatureVerificationFailed;
        assert!(err.to_string().contains("verification failed"));

        let err = CryptoError::ReplayAttack {
            nonce: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            agent_id: "test-agent".to_string(),
        };
        assert!(err.to_string().contains("Replay attack"));
    }
}
