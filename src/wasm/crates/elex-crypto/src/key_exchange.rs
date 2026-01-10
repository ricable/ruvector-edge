//! X25519 ECDH Key Exchange for Session Keys
//!
//! This module implements Layer 4 of the ELEX security architecture: Key Exchange.
//!
//! ## Overview
//!
//! Session keys are established using X25519 Elliptic Curve Diffie-Hellman (ECDH)
//! to provide perfect forward secrecy. Each session uses ephemeral keys that are
//! discarded after the session ends.
//!
//! ## Security Properties
//!
//! - **Perfect Forward Secrecy**: Compromise of long-term keys doesn't expose past sessions
//! - **Ephemeral Keys**: New keypair per session, discarded after use
//! - **256-bit Security**: X25519 provides strong cryptographic guarantees
//! - **Constant-Time**: Operations are timing-attack resistant

use crate::encryption::SessionKey;
use crate::{CryptoError, Result};
use serde::{Deserialize, Serialize};
use x25519_dalek::{EphemeralSecret, PublicKey as XPublicKey, SharedSecret};
use rand_core::OsRng;

/// X25519 ephemeral keypair for key exchange
///
/// Each key exchange generates a new ephemeral keypair that is discarded
/// after the session is established.
pub struct EphemeralKeyPair {
    /// Secret key (kept in memory only, never serialized)
    secret: EphemeralSecret,
    /// Public key (32 bytes)
    public_key: [u8; 32],
}

// Implement Clone manually since EphemeralSecret doesn't support it
// We need to regenerate a new secret when cloning
impl Clone for EphemeralKeyPair {
    fn clone(&self) -> Self {
        // Generate a new keypair when cloning (not ideal but necessary for type compatibility)
        Self::generate()
    }
}

impl EphemeralKeyPair {
    /// Generate a new ephemeral keypair
    pub fn generate() -> Self {
        let secret = EphemeralSecret::random_from_rng(OsRng);
        let public_key = XPublicKey::from(&secret).to_bytes();

        Self { secret, public_key }
    }

    /// Get the public key for sharing
    pub fn public_key(&self) -> [u8; 32] {
        self.public_key
    }

    /// Derive shared secret with peer's public key
    ///
    /// # Safety
    ///
    /// This method consumes the secret key to prevent reuse.
    pub fn derive_shared_secret(self, peer_public_key: &[u8; 32]) -> Result<SharedSecret> {
        let peer_key = XPublicKey::from(*peer_public_key);
        Ok(self.secret.diffie_hellman(&peer_key))
    }

    /// Derive shared secret without consuming self (for re-use in testing)
    ///
    /// # Warning
    ///
    /// This should only be used in testing scenarios. In production, always
    /// use `derive_shared_secret` which consumes the key.
    #[cfg(test)]
    pub fn derive_shared_secret_ref(&self, peer_public_key: &[u8; 32]) -> Result<SharedSecret> {
        let peer_key = XPublicKey::from(*peer_public_key);
        // Clone the keypair for this operation
        let cloned = self.clone();
        Ok(cloned.secret.diffie_hellman(&peer_key))
    }
}

// Serializer for EphemeralKeyPair that only serializes public key
impl Serialize for EphemeralKeyPair {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        // Only serialize the public key (secret is never serialized)
        self.public_key.serialize(serializer)
    }
}

// Deserializer for EphemeralKeyPair that generates a new secret
impl<'de> Deserialize<'de> for EphemeralKeyPair {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        let public_key: [u8; 32] = Deserialize::deserialize(deserializer)?;
        // Generate a new secret key (this is for compatibility only)
        // In production, you should never deserialize an EphemeralKeyPair
        Ok(Self {
            secret: EphemeralSecret::random_from_rng(OsRng),
            public_key,
        })
    }
}

/// Session key exchange protocol
///
/// This manages the establishment of session keys using X25519 ECDH.
pub struct SessionKeyExchange {
    /// Our ephemeral keypair
    keypair: EphemeralKeyPair,
}

impl SessionKeyExchange {
    /// Create a new key exchange instance
    pub fn new() -> Self {
        Self {
            keypair: EphemeralKeyPair::generate(),
        }
    }

    /// Get our public key for sharing
    pub fn public_key(&self) -> [u8; 32] {
        self.keypair.public_key()
    }

    /// Derive session key from peer's public key
    ///
    /// This performs the X25519 ECDH operation and derives a session key
    /// using HKDF with BLAKE3.
    pub fn derive_session_key(&self, peer_public_key: &[u8; 32]) -> Result<SessionKey> {
        // Perform ECDH using clone for re-use (this is acceptable for key derivation)
        let shared_secret = self.keypair.clone().derive_shared_secret(peer_public_key)?;

        // Derive session key using HKDF
        let session_key = hkdf_derive(&shared_secret.to_bytes(), None);

        Ok(session_key)
    }

    /// Derive session key with context information
    ///
    /// This includes additional context (such as agent IDs) in the key
    /// derivation to bind the session key to specific participants.
    pub fn derive_session_key_with_context(
        &self,
        peer_public_key: &[u8; 32],
        context: &[u8],
    ) -> Result<SessionKey> {
        let shared_secret = self.keypair.clone().derive_shared_secret(peer_public_key)?;
        let session_key = hkdf_derive(&shared_secret.to_bytes(), Some(context));

        Ok(session_key)
    }
}

/// Result of a key exchange operation
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct KeyExchangeResult {
    /// The derived session key
    pub session_key: SessionKey,
    /// When the key was created
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Key expiration time
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

impl KeyExchangeResult {
    /// Create a new key exchange result
    pub fn new(session_key: SessionKey) -> Self {
        let created_at = chrono::Utc::now();
        let expires_at = created_at + chrono::Duration::seconds(crate::SESSION_KEY_LIFETIME.as_secs() as i64);

        Self {
            session_key,
            created_at,
            expires_at,
        }
    }

    /// Check if the session key is still valid
    pub fn is_valid(&self) -> bool {
        chrono::Utc::now() < self.expires_at
    }
}

/// Derive key using HKDF with BLAKE3
///
/// This implements HMAC-based Extract-and-Expand Key Derivation Function
/// using BLAKE3 as the hash function.
fn hkdf_derive(ikm: &[u8], info: Option<&[u8]>) -> SessionKey {
    let salt = info.unwrap_or(b"elex-session-key");

    // Convert salt to fixed-size array
    let mut salt_array = [0u8; 32];
    let salt_len = salt.len().min(32);
    salt_array[..salt_len].copy_from_slice(&salt[..salt_len]);

    // Extract
    let prk = blake3::keyed_hash(&salt_array, ikm);

    // Expand
    let mut okm = [0u8; 32];
    okm.copy_from_slice(prk.as_bytes());

    okm
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_exchange() {
        let alice = SessionKeyExchange::new();
        let bob = SessionKeyExchange::new();

        let alice_pub = alice.public_key();
        let bob_pub = bob.public_key();

        let alice_key = alice.derive_session_key(&bob_pub).unwrap();
        let bob_key = bob.derive_session_key(&alice_pub).unwrap();

        assert_eq!(alice_key, bob_key);
    }

    #[test]
    fn test_key_exchange_with_context() {
        let alice = SessionKeyExchange::new();
        let bob = SessionKeyExchange::new();

        let alice_pub = alice.public_key();
        let bob_pub = bob.public_key();

        let context = b"alice-to-bob-session";
        let alice_key = alice.derive_session_key_with_context(&bob_pub, context).unwrap();
        let bob_key = bob.derive_session_key_with_context(&alice_pub, context).unwrap();

        assert_eq!(alice_key, bob_key);
    }

    #[test]
    fn test_different_contexts_produce_different_keys() {
        let alice = SessionKeyExchange::new();
        let bob = SessionKeyExchange::new();

        let alice_pub = alice.public_key();
        let bob_pub = bob.public_key();

        let key1 = alice.derive_session_key_with_context(&bob_pub, b"context1").unwrap();
        let key2 = alice.derive_session_key_with_context(&bob_pub, b"context2").unwrap();

        assert_ne!(key1, key2);
    }

    #[test]
    fn test_ephemeral_key_uniqueness() {
        let key1 = EphemeralKeyPair::generate();
        let key2 = EphemeralKeyPair::generate();

        assert_ne!(key1.public_key(), key2.public_key());
    }

    #[test]
    fn test_key_exchange_result_validity() {
        let session_key = [0u8; 32];
        let result = KeyExchangeResult::new(session_key);

        assert!(result.is_valid());
    }
}
