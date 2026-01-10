//! AES-256-GCM Encryption for Payload Confidentiality
//!
//! This module implements Layer 3 of the ELEX security architecture: Payload Encryption.
//!
//! ## Overview
//!
//! Sensitive payloads are encrypted using AES-256-GCM (Galois/Counter Mode), which
//! provides both confidentiality and integrity through authenticated encryption.
//!
//! ## Security Properties
//!
//! - **256-bit encryption key**: Strong confidentiality guarantees
//! - **128-bit authentication tag**: Detects any tampering
//! - **AEAD (Authenticated Encryption with Associated Data)**: No padding oracle vulnerabilities
//! - **Random nonces**: 12-byte nonces prevent nonce reuse
//!
//! ## Encryption Format
//!
//! ```text
//! EncryptedPayload {
//!     nonce: [u8; 12],      // Random nonce (prepended to ciphertext)
//!     ciphertext: Vec<u8>,  // Encrypted data + 128-bit auth tag
//! }
//! ```

use crate::{CryptoError, Result};
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use serde::{Deserialize, Serialize};

/// Session key for AES-256-GCM encryption (32 bytes)
///
/// Session keys are derived from X25519 ECDH and used for a limited time
/// (typically 60 minutes) before being rotated.
pub type SessionKey = [u8; 32];

/// Encrypted payload with nonce prepended
///
/// The nonce is randomly generated for each encryption and prepended to
/// the ciphertext for convenient decryption.
#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct EncryptedPayload {
    /// Nonce (12 bytes) - randomly generated per encryption
    nonce: [u8; 12],
    /// Ciphertext + authentication tag
    ciphertext: Vec<u8>,
}

impl EncryptedPayload {
    /// Create a new encrypted payload
    pub fn new(nonce: [u8; 12], ciphertext: Vec<u8>) -> Self {
        Self { nonce, ciphertext }
    }

    /// Get the nonce
    pub fn nonce(&self) -> &[u8; 12] {
        &self.nonce
    }

    /// Get the ciphertext (includes auth tag)
    pub fn ciphertext(&self) -> &[u8] {
        &self.ciphertext
    }

    /// Convert to bytes (nonce || ciphertext)
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(12 + self.ciphertext.len());
        bytes.extend_from_slice(&self.nonce);
        bytes.extend_from_slice(&self.ciphertext);
        bytes
    }

    /// Parse from bytes (nonce || ciphertext)
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        if bytes.len() < 12 {
            return Err(CryptoError::InvalidMessageFormat {
                reason: "Payload too short to contain nonce".to_string(),
            });
        }

        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&bytes[0..12]);
        let ciphertext = bytes[12..].to_vec();

        Ok(Self { nonce, ciphertext })
    }
}

/// Encrypt data with AES-256-GCM
///
/// This function encrypts the plaintext using a 256-bit key with a randomly
/// generated 12-byte nonce. The nonce is prepended to the ciphertext for
/// convenient decryption.
///
/// # Arguments
///
/// * `plaintext` - The data to encrypt
/// * `key` - The 256-bit encryption key
/// * `aad` - Additional authenticated data (optional, authenticated but not encrypted)
///
/// # Returns
///
/// An `EncryptedPayload` containing the nonce and ciphertext
///
/// # Example
///
/// ```rust
/// use elex_crypto::encryption::{encrypt, decrypt, SessionKey};
///
/// let key: SessionKey = [0u8; 32]; // In production, use a proper key!
/// let plaintext = b"Secret message";
/// let encrypted = encrypt(plaintext, &key, None)?;
/// let decrypted = decrypt(&encrypted, &key, None)?;
/// assert_eq!(decrypted, plaintext);
/// # Ok::<(), elex_crypto::CryptoError>(())
/// ```
///
/// # Security
///
/// - Uses cryptographically secure random nonce generation
/// - Nonces are 12 bytes (recommended for GCM)
/// - Each encryption uses a unique nonce (never reused)
/// - Authentication tag prevents tampering
pub fn encrypt(plaintext: &[u8], key: &SessionKey, aad: Option<&[u8]>) -> Result<EncryptedPayload> {
    // Create cipher from key
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::EncryptionFailed {
            reason: "Invalid key length".to_string(),
        })?;

    // Generate random nonce
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    // Encrypt with optional AAD
    let ciphertext = match aad {
        Some(aad) => cipher
            .encrypt(&nonce, aes_gcm::aead::Payload { msg: plaintext, aad })
            .map_err(|_| CryptoError::EncryptionFailed {
                reason: "Encryption failed".to_string(),
            })?,
        None => cipher
            .encrypt(&nonce, plaintext)
            .map_err(|_| CryptoError::EncryptionFailed {
                reason: "Encryption failed".to_string(),
            })?,
    };

    Ok(EncryptedPayload::new(nonce.into(), ciphertext))
}

/// Decrypt data with AES-256-GCM
///
/// This function decrypts the ciphertext and verifies the authentication tag.
/// If the ciphertext has been tampered with or the wrong key is used,
/// decryption will fail.
///
/// # Arguments
///
/// * `encrypted` - The encrypted payload
/// * `key` - The 256-bit decryption key
/// * `aad` - Additional authenticated data (must match encryption AAD)
///
/// # Returns
///
/// The decrypted plaintext
///
/// # Errors
///
/// Returns an error if:
/// - The ciphertext has been tampered with
/// - The wrong key is used
/// - The AAD doesn't match the encryption AAD
/// - The nonce is invalid
///
/// # Example
///
/// ```rust
/// use elex_crypto::encryption::{encrypt, decrypt, SessionKey};
///
/// let key: SessionKey = [0u8; 32];
/// let plaintext = b"Secret message";
/// let encrypted = encrypt(plaintext, &key, None)?;
/// let decrypted = decrypt(&encrypted, &key, None)?;
/// assert_eq!(decrypted, plaintext);
/// # Ok::<(), elex_crypto::CryptoError>(())
/// ```
pub fn decrypt(encrypted: &EncryptedPayload, key: &SessionKey, aad: Option<&[u8]>) -> Result<Vec<u8>> {
    // Create cipher from key
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::DecryptionFailed {
            reason: "Invalid key length".to_string(),
        })?;

    // Parse nonce
    let nonce = Nonce::from_slice(&encrypted.nonce);

    // Decrypt with optional AAD
    let plaintext = match aad {
        Some(aad) => cipher
            .decrypt(nonce, aes_gcm::aead::Payload { msg: &encrypted.ciphertext, aad })
            .map_err(|_| CryptoError::DecryptionFailed {
                reason: "Decryption failed (wrong key or tampered data)".to_string(),
            })?,
        None => cipher
            .decrypt(nonce, &encrypted.ciphertext[..])
            .map_err(|_| CryptoError::DecryptionFailed {
                reason: "Decryption failed (wrong key or tampered data)".to_string(),
            })?,
    };

    Ok(plaintext)
}

/// Generate a new random session key
///
/// This generates a cryptographically secure random 256-bit key for use
/// as a session key. Session keys should be rotated regularly (typically
/// every 60 minutes).
///
/// # Returns
///
/// A 256-bit session key
///
/// # Example
///
/// ```rust
/// use elex_crypto::encryption::generate_session_key;
///
/// let key = generate_session_key()?;
/// assert_eq!(key.len(), 32);
/// # Ok::<(), elex_crypto::CryptoError>(())
/// ```
pub fn generate_session_key() -> Result<SessionKey> {
    let mut key = [0u8; 32];
    getrandom::getrandom(&mut key)
        .map_err(|_| CryptoError::RandomGenerationFailed)?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key: SessionKey = [1u8; 32];
        let plaintext = b"Secret message";

        let encrypted = encrypt(plaintext, &key, None).unwrap();
        let decrypted = decrypt(&encrypted, &key, None).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_with_aad() {
        let key: SessionKey = [2u8; 32];
        let plaintext = b"Secret message";
        let aad = b"Additional authenticated data";

        let encrypted = encrypt(plaintext, &key, Some(aad)).unwrap();
        let decrypted = decrypt(&encrypted, &key, Some(aad)).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1: SessionKey = [1u8; 32];
        let key2: SessionKey = [2u8; 32];
        let plaintext = b"Secret message";

        let encrypted = encrypt(plaintext, &key1, None).unwrap();
        let result = decrypt(&encrypted, &key2, None);

        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_aad_fails() {
        let key: SessionKey = [1u8; 32];
        let plaintext = b"Secret message";
        let aad1 = b"First AAD";
        let aad2 = b"Second AAD";

        let encrypted = encrypt(plaintext, &key, Some(aad1)).unwrap();
        let result = decrypt(&encrypted, &key, Some(aad2));

        assert!(result.is_err());
    }

    #[test]
    fn test_tampering_detected() {
        let key: SessionKey = [1u8; 32];
        let plaintext = b"Secret message";

        let mut encrypted = encrypt(plaintext, &key, None).unwrap();

        // Tamper with the ciphertext
        if !encrypted.ciphertext.is_empty() {
            encrypted.ciphertext[0] ^= 0xFF;
        }

        let result = decrypt(&encrypted, &key, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_nonce_uniqueness() {
        let key: SessionKey = [1u8; 32];
        let plaintext = b"Secret message";

        let enc1 = encrypt(plaintext, &key, None).unwrap();
        let enc2 = encrypt(plaintext, &key, None).unwrap();

        // Nonces should be different
        assert_ne!(enc1.nonce(), enc2.nonce());

        // Ciphertexts should be different (even with same plaintext)
        assert_ne!(enc1.ciphertext(), enc2.ciphertext());
    }

    #[test]
    fn test_payload_serialization() {
        let key: SessionKey = [1u8; 32];
        let plaintext = b"Secret message";

        let encrypted = encrypt(plaintext, &key, None).unwrap();
        let bytes = encrypted.to_bytes();
        let parsed = EncryptedPayload::from_bytes(&bytes).unwrap();

        assert_eq!(encrypted.nonce, parsed.nonce);
        assert_eq!(encrypted.ciphertext, parsed.ciphertext);
    }

    #[test]
    fn test_generate_session_key() {
        let key1 = generate_session_key().unwrap();
        let key2 = generate_session_key().unwrap();

        assert_eq!(key1.len(), 32);
        assert_eq!(key2.len(), 32);

        // Keys should be different
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_empty_plaintext() {
        let key: SessionKey = [1u8; 32];
        let plaintext = b"";

        let encrypted = encrypt(plaintext, &key, None).unwrap();
        let decrypted = decrypt(&encrypted, &key, None).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_large_plaintext() {
        let key: SessionKey = [1u8; 32];
        let plaintext = vec![0u8; 10_000]; // 10 KB

        let encrypted = encrypt(&plaintext, &key, None).unwrap();
        let decrypted = decrypt(&encrypted, &key, None).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_invalid_payload_format() {
        let short_payload = vec![0u8; 8]; // Too short to contain nonce

        let result = EncryptedPayload::from_bytes(&short_payload);
        assert!(result.is_err());
    }
}
