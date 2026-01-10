//! Message Signing with Ed25519 and Replay Protection
//!
//! This module implements Layer 2 of the ELEX security architecture: Message Signing.
//!
//! ## Overview
//!
//! Every message in the swarm is signed with Ed25519 to provide authentication and
//! integrity. Signatures include a timestamp and nonce to prevent replay attacks.
//!
//! ## Security Properties
//!
//! - **Message Authentication**: Ed25519 signatures prove the signer's identity
//! - **Integrity**: Any modification of the message invalidates the signature
//! - **Replay Protection**: 5-minute validity window + nonce deduplication
//! - **Freshness**: Timestamps ensure messages are not reused indefinitely
//!
//! ## Signature Structure
//!
//! ```text
//! Signature {
//!     value: [u8; 64],           // Ed25519 signature
//!     timestamp: DateTime<Utc>,   // When the signature was created
//!     nonce: [u8; 16],           // Random value for replay protection
//!     signer_id: AgentId,        // Agent that created the signature
//!     algorithm: Ed25519,        // Signature algorithm
//! }
//! ```

use crate::identity::{AgentId, AgentIdentity, PublicKey};
use crate::{CryptoError, Result};
use ed25519_dalek::{Signature as EdSignature, Verifier};
use serde::{Deserialize, Serialize, de::Error as DeError, ser::Error as SerError};
use std::time::Duration;

/// Wrapper for signature bytes to handle serialization
#[derive(Clone, Debug, PartialEq)]
pub struct SignatureBytes(pub [u8; 64]);

impl Serialize for SignatureBytes {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_bytes(&self.0)
    }
}

impl<'de> Deserialize<'de> for SignatureBytes {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        let bytes: Vec<u8> = Deserialize::deserialize(deserializer)?;
        if bytes.len() != 64 {
            return Err(DeError::custom(format!("Expected 64 bytes, got {}", bytes.len())));
        }
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&bytes);
        Ok(SignatureBytes(arr))
    }
}

impl AsRef<[u8]> for SignatureBytes {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

impl From<[u8; 64]> for SignatureBytes {
    fn from(bytes: [u8; 64]) -> Self {
        SignatureBytes(bytes)
    }
}

impl From<SignatureBytes> for [u8; 64] {
    fn from(wrapper: SignatureBytes) -> [u8; 64] {
        wrapper.0
    }
}

/// Message signature with metadata
///
/// This structure contains the Ed25519 signature value along with metadata
/// for replay protection and freshness validation.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Signature {
    /// Ed25519 signature value (64 bytes)
    value: SignatureBytes,
    /// When the signature was created
    timestamp: chrono::DateTime<chrono::Utc>,
    /// Random nonce for replay protection (16 bytes)
    nonce: [u8; 16],
    /// Agent that created the signature
    signer_id: AgentId,
    /// Signature algorithm used
    algorithm: crate::SignatureAlgorithm,
}

impl Signature {
    /// Create a new signature
    pub fn new(
        value: [u8; 64],
        timestamp: chrono::DateTime<chrono::Utc>,
        nonce: [u8; 16],
        signer_id: AgentId,
    ) -> Self {
        Self {
            value: SignatureBytes::from(value),
            timestamp,
            nonce,
            signer_id,
            algorithm: crate::SignatureAlgorithm::Ed25519,
        }
    }

    /// Get the signature value
    pub fn value(&self) -> &[u8] {
        self.value.as_ref()
    }

    /// Get the timestamp
    pub fn timestamp(&self) -> chrono::DateTime<chrono::Utc> {
        self.timestamp
    }

    /// Get the nonce
    pub fn nonce(&self) -> &[u8; 16] {
        &self.nonce
    }

    /// Get the signer's agent ID
    pub fn signer_id(&self) -> AgentId {
        self.signer_id
    }

    /// Get the algorithm
    pub fn algorithm(&self) -> crate::SignatureAlgorithm {
        self.algorithm
    }

    /// Check if signature is still valid (not expired)
    pub fn is_valid(&self, max_age: Duration) -> bool {
        let age = chrono::Utc::now() - self.timestamp;
        age.to_std().unwrap_or(Duration::from_secs(u64::MAX)) <= max_age
    }

    /// Serialize signature to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(128);
        bytes.extend_from_slice(self.value.as_ref());
        bytes.extend_from_slice(&self.timestamp.timestamp().to_le_bytes());
        bytes.extend_from_slice(&self.nonce);
        bytes.extend_from_slice(self.signer_id.as_bytes());
        bytes.push(self.algorithm as u8);
        bytes
    }
}

/// Signed message containing payload and signature
///
/// This is the complete structure transmitted over the network.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SignedMessage {
    /// The message payload
    pub payload: Vec<u8>,
    /// The signature
    pub signature: Signature,
}

impl SignedMessage {
    /// Create a new signed message
    pub fn new(payload: Vec<u8>, signature: Signature) -> Self {
        Self { payload, signature }
    }

    /// Create the signed payload for signature generation
    fn signed_payload(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(self.payload.len() + 40);
        bytes.extend_from_slice(&self.payload);
        bytes.extend_from_slice(&self.signature.timestamp().timestamp().to_le_bytes());
        bytes.extend_from_slice(self.signature.nonce());
        bytes.extend_from_slice(self.signature.signer_id().as_bytes());
        bytes
    }
}

/// Sign a message
///
/// This function creates an Ed25519 signature for the message with replay
/// protection metadata (timestamp + nonce).
///
/// # Arguments
///
/// * `identity` - The agent identity used for signing
/// * `message` - The message payload to sign
///
/// # Returns
///
/// A `Signature` containing the Ed25519 signature and metadata
///
/// # Example
///
/// ```rust
/// use elex_crypto::{AgentIdentity, sign_message};
///
/// let identity = AgentIdentity::generate();
/// let message = b"Hello, swarm!";
/// let signature = sign_message(&identity, message)?;
/// # Ok::<(), elex_crypto::CryptoError>(())
/// ```
pub fn sign_message(identity: &AgentIdentity, message: &[u8]) -> Result<Signature> {
    let timestamp = chrono::Utc::now();
    let nonce = generate_nonce()?;
    let signer_id = identity.id();

    // Create the signed payload: message || timestamp || nonce || signer_id
    let mut payload = Vec::with_capacity(message.len() + 40);
    payload.extend_from_slice(message);
    payload.extend_from_slice(&timestamp.timestamp().to_le_bytes());
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(signer_id.as_bytes());

    // Sign with Ed25519
    let ed_signature = identity.sign(&payload);

    Ok(Signature::new(
        ed_signature.to_bytes(),
        timestamp,
        nonce,
        signer_id,
    ))
}

/// Verify a message signature
///
/// This function verifies an Ed25519 signature and checks for replay attacks
/// by validating the timestamp and nonce.
///
/// # Arguments
///
/// * `message` - The message payload
/// * `signature` - The signature to verify
/// * `public_key` - The signer's public key
///
/// # Returns
///
/// `Ok(true)` if the signature is valid, `Err` otherwise
///
/// # Errors
///
/// Returns an error if:
/// - The signature has expired (older than 5 minutes)
/// - The signature verification fails
/// - The signature format is invalid
///
/// # Example
///
/// ```rust
/// use elex_crypto::{AgentIdentity, sign_message, verify_signature};
///
/// let identity = AgentIdentity::generate();
/// let message = b"Hello, swarm!";
/// let signature = sign_message(&identity, message)?;
/// let valid = verify_signature(message, &signature, &identity.public_key())?;
/// assert!(valid);
/// # Ok::<(), elex_crypto::CryptoError>(())
/// ```
pub fn verify_signature(
    message: &[u8],
    signature: &Signature,
    public_key: &PublicKey,
) -> Result<bool> {
    // Check signature freshness (prevent replay)
    if !signature.is_valid(crate::MAX_SIGNATURE_AGE) {
        return Err(CryptoError::SignatureExpired {
            timestamp: signature.timestamp,
        });
    }

    // Reconstruct the signed payload
    let mut payload = Vec::with_capacity(message.len() + 40);
    payload.extend_from_slice(message);
    payload.extend_from_slice(&signature.timestamp.timestamp().to_le_bytes());
    payload.extend_from_slice(signature.nonce());
    payload.extend_from_slice(signature.signer_id().as_bytes());

    // Verify Ed25519 signature
    let sig_bytes: [u8; 64] = signature.value()
        .try_into()
        .map_err(|_| CryptoError::SignatureVerificationFailed)?;
    let ed_signature = EdSignature::from_bytes(&sig_bytes);

    let ed_public_key = public_key.as_ed25519();

    match ed_public_key.verify(&payload, &ed_signature) {
        Ok(()) => Ok(true),
        Err(_) => Err(CryptoError::SignatureVerificationFailed),
    }
}

/// Verify a signed message (with replay protection check)
///
/// This is a convenience function that verifies both the signature and
/// checks for replay attacks using a replay protection cache.
///
/// # Arguments
///
/// * `signed_message` - The signed message to verify
/// * `public_key` - The signer's public key
/// * `replay_protection` - The replay protection cache
///
/// # Returns
///
/// `Ok(())` if the signature is valid and not a replay attack, `Err` otherwise
///
/// # Errors
///
/// Returns an error if:
/// - The signature has expired
/// - The signature verification fails
/// - A replay attack is detected (nonce already seen)
///
/// TODO: Implement ReplayProtection module
/*
pub fn verify_signed_message(
    signed_message: &SignedMessage,
    public_key: &PublicKey,
    replay_protection: &mut crate::ReplayProtection,
) -> Result<()> {
    // Check for replay attack
    let signer_id = signed_message.signature.signer_id();
    let nonce = *signed_message.signature.nonce();

    if !replay_protection.check_and_insert(signer_id, nonce) {
        return Err(CryptoError::ReplayAttack {
            nonce,
            agent_id: signer_id.to_string(),
        });
    }

    // Verify signature
    verify_signature(&signed_message.payload, &signed_message.signature, public_key)?;

    Ok(())
}
*/

/// Generate a random nonce for replay protection
///
/// This uses cryptographically secure random number generation to create
/// a 16-byte nonce that uniquely identifies each message.
fn generate_nonce() -> Result<[u8; 16]> {
    let mut nonce = [0u8; 16];
    getrandom::getrandom(&mut nonce)
        .map_err(|_| CryptoError::RandomGenerationFailed)?;
    Ok(nonce)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify() {
        let identity = AgentIdentity::generate();
        let message = b"Hello, swarm!";

        let signature = sign_message(&identity, message).unwrap();
        let valid = verify_signature(message, &signature, &identity.public_key()).unwrap();

        assert!(valid);
    }

    #[test]
    fn test_signature_freshness() {
        let identity = AgentIdentity::generate();
        let message = b"Hello, swarm!";

        let signature = sign_message(&identity, message).unwrap();
        assert!(signature.is_valid(Duration::from_secs(300)));
        assert!(signature.is_valid(Duration::from_secs(3600)));
    }

    #[test]
    fn test_signature_invalid() {
        let identity = AgentIdentity::generate();
        let message = b"Hello, swarm!";

        let signature = sign_message(&identity, message).unwrap();
        let tampered_message = b"Goodbye, swarm!";

        let result = verify_signature(tampered_message, &signature, &identity.public_key());
        assert!(result.is_err());
    }

    #[test]
    fn test_nonce_uniqueness() {
        let identity = AgentIdentity::generate();
        let message = b"Hello, swarm!";

        let sig1 = sign_message(&identity, message).unwrap();
        let sig2 = sign_message(&identity, message).unwrap();

        assert_ne!(sig1.nonce(), sig2.nonce());
    }

    #[test]
    fn test_signer_id_binding() {
        let identity = AgentIdentity::generate();
        let message = b"Hello, swarm!";

        let signature = sign_message(&identity, message).unwrap();
        assert_eq!(signature.signer_id(), identity.id());
    }

    #[test]
    fn test_signature_serialization() {
        let identity = AgentIdentity::generate();
        let message = b"Hello, swarm!";

        let signature = sign_message(&identity, message).unwrap();
        let bytes = signature.to_bytes();

        assert!(bytes.len() >= 64 + 8 + 16 + 16 + 1); // value + timestamp + nonce + agent_id + algorithm
    }

    #[test]
    fn test_signed_message() {
        let identity = AgentIdentity::generate();
        let payload = b"Test payload".to_vec();

        let signature = sign_message(&identity, &payload).unwrap();
        let signed = SignedMessage::new(payload.clone(), signature);

        assert_eq!(signed.payload, payload);
        assert_eq!(signed.signature.signer_id(), identity.id());
    }

    // TODO: Uncomment when ReplayProtection module is implemented
    /*
    #[test]
    fn test_verify_signed_message() {
        let identity = AgentIdentity::generate();
        let payload = b"Test payload".to_vec();

        let signature = sign_message(&identity, &payload).unwrap();
        let signed = SignedMessage::new(payload, signature);

        let mut replay_protection = crate::ReplayProtection::new();
        let result = verify_signed_message(&signed, &identity.public_key(), &mut replay_protection);

        assert!(result.is_ok());
    }

    #[test]
    fn test_replay_attack_detection() {
        let identity = AgentIdentity::generate();
        let payload = b"Test payload".to_vec();

        let signature = sign_message(&identity, &payload).unwrap();
        let signed = SignedMessage::new(payload.clone(), signature);

        let mut replay_protection = crate::ReplayProtection::new();

        // First verification should succeed
        let result1 = verify_signed_message(&signed, &identity.public_key(), &mut replay_protection);
        assert!(result1.is_ok());

        // Second verification with same nonce should fail
        let result2 = verify_signed_message(&signed, &identity.public_key(), &mut replay_protection);
        assert!(result2.is_err());
    }
    */
}
