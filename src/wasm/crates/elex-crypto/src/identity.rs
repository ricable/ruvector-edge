//! Agent Identity using Ed25519 Cryptographic Signatures
//!
//! This module implements Layer 1 of the ELEX security architecture: Agent Identity.
//!
//! ## Overview
//!
//! Each agent in the 593-agent swarm has a unique cryptographic identity based on
//! Ed25519 public-key cryptography. The AgentId is derived from the public key,
//! ensuring that identity cannot be forged or spoofed.
//!
//! ## Security Properties
//!
//! - **128-bit security level**: Ed25519 provides strong cryptographic guarantees
//! - **Deterministic signatures**: Prevents nonce reuse attacks
//! - **Fast verification**: < 1ms per signature in WASM
//! - **Identity binding**: AgentId = BLAKE3(public_key)[0..16]
//!
//! ## Key Management
//!
//! Private keys are never exported from the AgentIdentity struct. They are only
//! used internally for signing operations. Public keys are shared with the swarm
//! for signature verification.
//!
//! ## Example
//!
//! ```rust
//! use elex_crypto::identity::AgentIdentity;
//!
//! // Generate new agent identity
//! let identity = AgentIdentity::generate();
//!
//! // Get agent ID (derived from public key)
//! let agent_id = identity.id();
//!
//! // Get public key (for sharing with swarm)
//! let public_key = identity.public_key();
//! ```

use crate::{CryptoError, Result, SignatureAlgorithm};
use ed25519_dalek::{SigningKey as EdSigningKey, VerifyingKey as EdVerifyingKey, Signature as EdSignature, Signer as EdSigner};
use serde::{Deserialize, Serialize};
use rand_core::OsRng;
use std::fmt;

/// Agent identifier (16 bytes, derived from public key)
///
/// The AgentId is the first 16 bytes of the BLAKE3 hash of the Ed25519 public key.
/// This ensures that AgentIds are unique and cannot be forged without compromising
/// the private key.
#[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct AgentId([u8; 16]);

impl AgentId {
    /// Generate AgentId from public key
    ///
    /// This uses BLAKE3 to hash the public key and takes the first 16 bytes.
    /// This provides a 128-bit identifier space with collision resistance.
    pub fn from_public_key(public_key: &PublicKey) -> Self {
        let hash = blake3::hash(&public_key.to_bytes());
        let mut id = [0u8; 16];
        id.copy_from_slice(&hash.as_bytes()[0..16]);
        AgentId(id)
    }

    /// Create AgentId from bytes (validation required)
    ///
    /// # Safety
    ///
    /// This should only be used when reconstructing an AgentId from trusted storage.
    /// For arbitrary bytes, use `from_validated_bytes` instead.
    pub fn from_bytes(bytes: [u8; 16]) -> Self {
        AgentId(bytes)
    }

    /// Get AgentId as byte slice
    pub fn as_bytes(&self) -> &[u8; 16] {
        &self.0
    }

    /// Convert to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    /// Parse from hex string
    pub fn from_hex(hex_str: &str) -> Result<Self> {
        let bytes = hex::decode(hex_str)
            .map_err(|_| CryptoError::InvalidKeyFormat {
                reason: "Invalid hex encoding".to_string(),
            })?;

        if bytes.len() != 16 {
            return Err(CryptoError::InvalidKeyFormat {
                reason: format!("Expected 16 bytes, got {}", bytes.len()),
            });
        }

        let mut id = [0u8; 16];
        id.copy_from_slice(&bytes);
        Ok(AgentId(id))
    }
}

impl fmt::Debug for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("AgentId")
            .field(&self.to_hex())
            .finish()
    }
}

impl fmt::Display for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

/// Ed25519 public key (32 bytes)
///
/// Public keys are shared with the swarm for signature verification.
/// They can be freely distributed without security implications.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicKey {
    bytes: [u8; 32],
}

impl PublicKey {
    /// Create public key from bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { bytes }
    }

    /// Get public key as bytes
    pub fn to_bytes(&self) -> [u8; 32] {
        self.bytes
    }

    /// Get public key as hex string
    pub fn to_hex(&self) -> String {
        hex::encode(self.bytes)
    }

    /// Parse from hex string
    pub fn from_hex(hex_str: &str) -> Result<Self> {
        let bytes = hex::decode(hex_str)
            .map_err(|_| CryptoError::InvalidKeyFormat {
                reason: "Invalid hex encoding".to_string(),
            })?;

        if bytes.len() != 32 {
            return Err(CryptoError::InvalidKeyFormat {
                reason: format!("Expected 32 bytes, got {}", bytes.len()),
            });
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        Ok(Self { bytes: key })
    }

    /// Get the underlying ed25519_dalek public key
    pub(crate) fn as_ed25519(&self) -> EdVerifyingKey {
        EdVerifyingKey::from_bytes(&self.bytes)
            .expect("Invalid public key bytes")
    }
}

impl fmt::Debug for PublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("PublicKey")
            .field(&self.to_hex())
            .finish()
    }
}

/// Ed25519 key pair (private + public key)
///
/// The private key is never exported and is only used internally for signing.
/// This ensures that private keys remain secure within the AgentIdentity.
pub struct KeyPair {
    signing_key: EdSigningKey,
    verifying_key: EdVerifyingKey,
    algorithm: SignatureAlgorithm,
}

impl KeyPair {
    /// Generate a new Ed25519 key pair
    ///
    /// This uses cryptographically secure random number generation via
    /// `getrandom` with JavaScript support for WASM environments.
    pub fn generate() -> Self {
        // Generate 32 random bytes for the private key
        let mut bytes = [0u8; 32];
        getrandom::getrandom(&mut bytes)
            .expect("getrandom failed");

        let signing_key = EdSigningKey::from_bytes(&bytes);
        let verifying_key = signing_key.verifying_key();

        Self {
            signing_key,
            verifying_key,
            algorithm: SignatureAlgorithm::Ed25519,
        }
    }

    /// Get the public key component
    pub fn public_key(&self) -> PublicKey {
        PublicKey::from_bytes(self.verifying_key.to_bytes())
    }

    /// Get the algorithm used
    pub fn algorithm(&self) -> SignatureAlgorithm {
        self.algorithm
    }

    /// Sign a message
    pub(crate) fn sign(&self, message: &[u8]) -> EdSignature {
        self.signing_key.sign(message)
    }

    /// Get the verifying key
    pub(crate) fn verifying_key(&self) -> &EdVerifyingKey {
        &self.verifying_key
    }
}

/// Agent identity with cryptographic keypair
///
/// This is the primary identity structure for all agents in the swarm.
/// It combines the AgentId, keypair, and creation timestamp.
///
/// ## Security
///
/// The private key is never accessible outside this struct. All signing
/// operations are performed internally, ensuring that private keys cannot
/// be extracted or exposed.
///
/// ## Example
///
/// ```rust
/// use elex_crypto::identity::AgentIdentity;
///
/// let identity = AgentIdentity::generate();
///
/// // Get agent ID (derived from public key)
/// let agent_id = identity.id();
///
/// // Get public key (for sharing)
/// let public_key = identity.public_key();
///
/// // Private key is inaccessible (security)
/// // identity.private_key(); // This doesn't exist!
/// ```
pub struct AgentIdentity {
    /// Agent identifier (derived from public key)
    agent_id: AgentId,
    /// Cryptographic keypair
    keypair: KeyPair,
    /// Creation timestamp
    created_at: chrono::DateTime<chrono::Utc>,
}

impl AgentIdentity {
    /// Generate a new agent identity
    ///
    /// This creates a new Ed25519 keypair and derives the AgentId from
    /// the public key using BLAKE3.
    ///
    /// # Example
    ///
    /// ```rust
    /// use elex_crypto::identity::AgentIdentity;
    ///
    /// let identity = AgentIdentity::generate();
    /// println!("Agent ID: {}", identity.id());
    /// ```
    pub fn generate() -> Self {
        let keypair = KeyPair::generate();
        let public_key = keypair.public_key();
        let agent_id = AgentId::from_public_key(&public_key);

        Self {
            agent_id,
            keypair,
            created_at: chrono::Utc::now(),
        }
    }

    /// Create agent identity from existing keypair
    ///
    /// This is used when reconstructing an identity from stored keys.
    /// The private key bytes are securely stored and never exported.
    ///
    /// # Safety
    ///
    /// This should only be used with keys from trusted storage.
    pub fn from_keypair(keypair: KeyPair) -> Self {
        let public_key = keypair.public_key();
        let agent_id = AgentId::from_public_key(&public_key);

        Self {
            agent_id,
            keypair,
            created_at: chrono::Utc::now(),
        }
    }

    /// Get the agent ID
    ///
    /// The AgentId is derived from the public key and cannot be changed
    /// without compromising the private key.
    pub fn id(&self) -> AgentId {
        self.agent_id
    }

    /// Get the public key
    ///
    /// Public keys can be freely shared with the swarm for signature
    /// verification. They have no security implications if exposed.
    pub fn public_key(&self) -> PublicKey {
        self.keypair.public_key()
    }

    /// Get the creation timestamp
    pub fn created_at(&self) -> chrono::DateTime<chrono::Utc> {
        self.created_at
    }

    /// Get the algorithm used for this identity
    pub fn algorithm(&self) -> SignatureAlgorithm {
        self.keypair.algorithm()
    }

    /// Sign a message (internal use)
    pub(crate) fn sign(&self, message: &[u8]) -> EdSignature {
        self.keypair.sign(message)
    }
}

impl fmt::Debug for AgentIdentity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AgentIdentity")
            .field("agent_id", &self.agent_id)
            .field("public_key", &self.public_key())
            .field("algorithm", &self.algorithm())
            .field("created_at", &self.created_at)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_identity_generation() {
        let identity = AgentIdentity::generate();
        let agent_id = identity.id();

        // AgentId should be 16 bytes
        assert_eq!(agent_id.as_bytes().len(), 16);

        // Public key should be 32 bytes
        let pub_key = identity.public_key();
        assert_eq!(pub_key.to_bytes().len(), 32);
    }

    #[test]
    fn test_agent_id_from_public_key() {
        let identity = AgentIdentity::generate();
        let public_key = identity.public_key();
        let agent_id = AgentId::from_public_key(&public_key);

        assert_eq!(agent_id, identity.id());
    }

    #[test]
    fn test_agent_id_hex_roundtrip() {
        let identity = AgentIdentity::generate();
        let agent_id = identity.id();
        let hex = agent_id.to_hex();
        let parsed = AgentId::from_hex(&hex).unwrap();

        assert_eq!(agent_id, parsed);
    }

    #[test]
    fn test_public_key_hex_roundtrip() {
        let identity = AgentIdentity::generate();
        let public_key = identity.public_key();
        let hex = public_key.to_hex();
        let parsed = PublicKey::from_hex(&hex).unwrap();

        assert_eq!(public_key, parsed);
    }

    #[test]
    fn test_unique_agent_ids() {
        let id1 = AgentIdentity::generate();
        let id2 = AgentIdentity::generate();

        assert_ne!(id1.id(), id2.id());
    }

    #[test]
    fn test_invalid_agent_id_hex() {
        let result = AgentId::from_hex("invalid");
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_agent_id_length() {
        let result = AgentId::from_hex("deadbeef");
        assert!(result.is_err());
    }
}
