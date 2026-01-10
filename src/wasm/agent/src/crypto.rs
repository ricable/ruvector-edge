//! Cryptography Module for Agent WASM (ADR-007)
//!
//! Implements ADR-007 security requirements:
//! - Ed25519 keypair generation and storage
//! - Message signing with Ed25519
//! - AES-256-GCM encryption
//! - X25519 key exchange
//! - Replay protection (nonce/timestamp tracking)

use serde::{Deserialize, Serialize};
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use x25519_dalek::{StaticSecret, PublicKey as XPublicKey};
use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
use aes_gcm::aead::{Aead, AeadCore};
use rand_core::OsRng as RandOsRng;
use std::collections::HashMap;

/// Cryptographic identity for agent (ADR-007)
#[derive(Clone, Serialize, Deserialize)]
pub struct CryptoIdentity {
    pub agent_id: String,
    pub public_key: Vec<u8>,  // Ed25519 public key (32 bytes)
    pub x_public_key: Vec<u8>, // X25519 public key (32 bytes) for key exchange
}

/// Agent with full cryptographic capabilities
#[derive(Clone, Serialize, Deserialize)]
pub struct CryptoAgent {
    pub id: String,
    pub signing_key: Vec<u8>,  // Ed25519 signing key (serialized)
    pub verifying_key: Vec<u8>, // Ed25519 verifying key (serialized)
    pub x_secret: Vec<u8>,      // X25519 secret key (serialized)
    pub x_public: Vec<u8>,      // X25519 public key (serialized)
    pub nonces: HashMap<String, u64>,  // Replay protection
}

/// Signed message (ADR-007)
#[derive(Clone, Serialize, Deserialize)]
pub struct SignedMessage {
    pub content: String,
    pub signature: Vec<u8>,  // 64 bytes Ed25519 signature
    pub sender: String,
    pub timestamp: u64,
    pub nonce: u64,
}

/// Encrypted message (ADR-007)
#[derive(Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,  // 12 bytes for AES-256-GCM
    pub sender: String,
    pub timestamp: u64,
}

impl CryptoAgent {
    pub fn new(agent_id: String) -> Self {
        let mut csprng = RandOsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key: VerifyingKey = (&signing_key).into();

        let x_secret = StaticSecret::random_from_rng(&mut csprng);
        let x_public = XPublicKey::from(&x_secret);

        Self {
            id: agent_id,
            signing_key: signing_key.to_bytes().to_vec(),
            verifying_key: verifying_key.to_bytes().to_vec(),
            x_secret: x_secret.to_bytes().to_vec(),
            x_public: x_public.to_bytes().to_vec(),
            nonces: HashMap::new(),
        }
    }

    pub fn get_identity(&self) -> CryptoIdentity {
        CryptoIdentity {
            agent_id: self.id.clone(),
            public_key: self.verifying_key.clone(),
            x_public_key: self.x_public.clone(),
        }
    }

    /// Get the signing key (deserialized)
    pub fn get_signing_key(&self) -> SigningKey {
        SigningKey::from_bytes(self.signing_key.as_slice().try_into().unwrap())
    }

    /// Get the verifying key (deserialized)
    pub fn get_verifying_key(&self) -> VerifyingKey {
        let bytes: [u8; 32] = self.verifying_key.as_slice().try_into().expect("Invalid verifying key length");
        VerifyingKey::from_bytes(&bytes).expect("Invalid verifying key")
    }

    /// Get the x25519 secret key (deserialized)
    pub fn get_x_secret(&self) -> StaticSecret {
        let bytes: [u8; 32] = self.x_secret.as_slice().try_into().expect("Invalid x25519 secret length");
        StaticSecret::from(bytes)
    }

    /// Get the x25519 public key (deserialized)
    pub fn get_x_public(&self) -> XPublicKey {
        let bytes: [u8; 32] = self.x_public.as_slice().try_into().expect("Invalid x25519 public length");
        XPublicKey::from(bytes)
    }

    /// Sign a message
    pub fn sign(&self, content: &str) -> SignedMessage {
        let timestamp = get_timestamp();
        let nonce = self.generate_nonce();
        let message_bytes = format!("{}:{}:{}", content, timestamp, nonce);

        let signing_key = self.get_signing_key();
        let signature = signing_key.sign(message_bytes.as_bytes());

        SignedMessage {
            content: content.to_string(),
            signature: signature.to_bytes().to_vec(),
            sender: self.id.clone(),
            timestamp,
            nonce,
        }
    }

    /// Verify a signed message
    pub fn verify(signed: &SignedMessage, verifying_key_bytes: &[u8]) -> bool {
        let verifying_key = match VerifyingKey::from_bytes(
            verifying_key_bytes.try_into().unwrap()
        ) {
            Ok(key) => key,
            Err(_) => return false,
        };

        let message_bytes = format!("{}:{}:{}", signed.content, signed.timestamp, signed.nonce);
        let signature_bytes: [u8; 64] = match signed.signature.clone().try_into() {
            Ok(arr) => arr,
            Err(_) => return false,
        };
        let signature = Signature::from_bytes(&signature_bytes);

        verifying_key.verify(message_bytes.as_bytes(), &signature).is_ok()
    }

    /// Encrypt using AES-256-GCM
    pub fn encrypt(&self, plaintext: &[u8]) -> EncryptedMessage {
        let x_secret = self.get_x_secret();
        let cipher = Aes256Gcm::new(x_secret.as_bytes().into());
        let nonce = Aes256Gcm::generate_nonce(&mut RandOsRng);
        let ciphertext = cipher.encrypt(&nonce, plaintext).unwrap();

        EncryptedMessage {
            ciphertext,
            nonce: nonce.to_vec(),
            sender: self.id.clone(),
            timestamp: get_timestamp(),
        }
    }

    /// Decrypt using AES-256-GCM
    pub fn decrypt(&self, encrypted: &EncryptedMessage) -> Result<Vec<u8>, String> {
        let x_secret = self.get_x_secret();
        let cipher = Aes256Gcm::new(x_secret.as_bytes().into());
        let nonce = Nonce::from_slice(&encrypted.nonce);
        cipher.decrypt(nonce, encrypted.ciphertext.as_ref())
            .map_err(|e: aes_gcm::aead::Error| e.to_string())
    }

    /// Derive shared secret for key exchange
    pub fn derive_shared_secret(&self, their_public_bytes: &[u8]) -> Vec<u8> {
        let x_secret = self.get_x_secret();
        let their_public_bytes_array: [u8; 32] = their_public_bytes.try_into().unwrap();
        let their_public = XPublicKey::from(their_public_bytes_array);
        x_secret.diffie_hellman(&their_public).as_bytes().to_vec()
    }

    /// Replay protection: check and update nonce
    pub fn check_replay(&mut self, sender: &str, nonce: u64) -> bool {
        let entry = self.nonces.entry(sender.to_string()).or_insert(0);
        if nonce > *entry {
            *entry = nonce;
            true
        } else {
            false
        }
    }

    fn generate_nonce(&self) -> u64 {
        #[cfg(target_arch = "wasm32")]
        {
            js_sys::Date::now() as u64
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            use std::time::{SystemTime, UNIX_EPOCH};
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64
        }
    }
}

fn get_timestamp() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now() as u64
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

// Export all types and functions
// Note: Types are already public above, no need to re-export
