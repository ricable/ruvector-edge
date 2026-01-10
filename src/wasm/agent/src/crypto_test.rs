/// Unit Tests for Crypto Module (ADR-016)
///
/// Tests cover:
/// - Keypair generation
/// - Message signing and verification
/// - AES-256-GCM encryption/decryption
/// - X25519 key exchange
/// - Replay protection
/// - Edge cases and error handling

#[cfg(test)]
mod crypto_unit_tests {
    use crate::crypto::{
        CryptoAgent, CryptoIdentity, SignedMessage, EncryptedMessage,
    };
    use ed25519_dalek::Signature;
    use std::collections::HashMap;

    // =========================================================================
    // Agent Creation Tests
    // =========================================================================

    #[test]
    fn test_crypto_agent_creation() {
        let agent = CryptoAgent::new("test-agent".to_string());

        assert_eq!(agent.id, "test-agent");
        assert_eq!(agent.nonces.len(), 0);
    }

    #[test]
    fn test_crypto_agent_unique_keys() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());

        // Different agents should have different keys
        let id1 = agent1.get_identity();
        let id2 = agent2.get_identity();

        assert_ne!(id1.public_key, id2.public_key, "Public keys should differ");
        assert_ne!(id1.x_public_key, id2.x_public_key, "X25519 keys should differ");
    }

    #[test]
    fn test_get_identity() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let identity = agent.get_identity();

        assert_eq!(identity.agent_id, "test-agent");
        assert_eq!(identity.public_key.len(), 32, "Ed25519 public key is 32 bytes");
        assert_eq!(identity.x_public_key.len(), 32, "X25519 public key is 32 bytes");
    }

    // =========================================================================
    // Message Signing Tests
    // =========================================================================

    #[test]
    fn test_sign_message() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let signed = agent.sign("Hello, world!");

        assert_eq!(signed.content, "Hello, world!");
        assert_eq!(signed.sender, "test-agent");
        assert_eq!(signed.signature.len(), 64, "Ed25519 signature is 64 bytes");
        assert!(signed.timestamp > 0, "Timestamp should be set");
        assert!(signed.nonce > 0, "Nonce should be set");
    }

    #[test]
    fn test_sign_different_messages() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let signed1 = agent.sign("message1");
        let signed2 = agent.sign("message2");

        assert_ne!(signed1.signature, signed2.signature, "Different messages produce different signatures");
    }

    #[test]
    fn test_sign_same_message_different_time() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let signed1 = agent.sign("test");
        // Allow time for nonce to change
        std::thread::sleep(std::time::Duration::from_millis(10));
        let signed2 = agent.sign("test");

        // Signatures should differ due to different nonce/timestamp
        assert_ne!(signed1.signature, signed2.signature, "Same message at different time produces different signatures");
        assert_ne!(signed1.nonce, signed2.nonce, "Nonces should differ");
    }

    // =========================================================================
    // Signature Verification Tests
    // =========================================================================

    #[test]
    fn test_verify_valid_signature() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let signed = agent.sign("Hello!");

        let verifying_key_bytes = &agent.get_identity().public_key;
        let is_valid = CryptoAgent::verify(&signed, verifying_key_bytes);

        assert!(is_valid, "Valid signature should verify");
    }

    #[test]
    fn test_verify_tampered_content() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let mut signed = agent.sign("Hello!");

        signed.content = "Goodbye!".to_string();

        let verifying_key_bytes = &agent.get_identity().public_key;
        let is_valid = CryptoAgent::verify(&signed, verifying_key_bytes);

        assert!(!is_valid, "Tampered content should fail verification");
    }

    #[test]
    fn test_verify_tampered_signature() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let mut signed = agent.sign("Hello!");

        signed.signature[0] ^= 0xFF; // Flip bits

        let verifying_key_bytes = &agent.get_identity().public_key;
        let is_valid = CryptoAgent::verify(&signed, verifying_key_bytes);

        assert!(!is_valid, "Tampered signature should fail verification");
    }

    #[test]
    fn test_verify_tampered_sender() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let mut signed = agent.sign("Hello!");

        signed.sender = "attacker".to_string();

        let verifying_key_bytes = &agent.get_identity().public_key;
        let is_valid = CryptoAgent::verify(&signed, verifying_key_bytes);

        // Sender is not part of the signature, so this should still verify
        // (The signature only covers content, timestamp, and nonce)
        assert!(is_valid, "Tampered sender doesn't affect signature");
    }

    #[test]
    fn test_verify_wrong_public_key() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());

        let signed = agent1.sign("Hello!");

        let wrong_key_bytes = &agent2.get_identity().public_key;
        let is_valid = CryptoAgent::verify(&signed, wrong_key_bytes);

        assert!(!is_valid, "Wrong public key should fail verification");
    }

    // =========================================================================
    // Encryption Tests
    // =========================================================================

    #[test]
    fn test_encrypt_decrypt() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let plaintext = b"Secret message";
        let encrypted = agent.encrypt(plaintext);

        assert_ne!(encrypted.ciphertext, plaintext, "Ciphertext should differ from plaintext");
        assert_eq!(encrypted.nonce.len(), 12, "AES-256-GCM nonce is 12 bytes");
        assert_eq!(encrypted.sender, "test-agent");

        let decrypted = agent.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext, "Decrypted text should match plaintext");
    }

    #[test]
    fn test_encrypt_different_nonces() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let encrypted1 = agent.encrypt(b"message");
        let encrypted2 = agent.encrypt(b"message");

        assert_ne!(encrypted1.nonce, encrypted2.nonce, "Nonces should be unique");
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext, "Same plaintext with different nonce produces different ciphertext");
    }

    #[test]
    fn test_decrypt_wrong_agent() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());

        let encrypted = agent1.encrypt(b"Secret");

        let result = agent2.decrypt(&encrypted);
        assert!(result.is_err(), "Different agent should fail to decrypt");
    }

    #[test]
    fn test_decrypt_tampered_ciphertext() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let mut encrypted = agent.encrypt(b"Secret");

        encrypted.ciphertext[0] ^= 0xFF;

        let result = agent.decrypt(&encrypted);
        assert!(result.is_err(), "Tampered ciphertext should fail decryption");
    }

    #[test]
    fn test_decrypt_tampered_nonce() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let mut encrypted = agent.encrypt(b"Secret");

        encrypted.nonce[0] ^= 0xFF;

        let result = agent.decrypt(&encrypted);
        assert!(result.is_err(), "Tampered nonce should fail decryption");
    }

    #[test]
    fn test_encrypt_empty_message() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let encrypted = agent.encrypt(b"");
        let decrypted = agent.decrypt(&encrypted).unwrap();

        assert_eq!(decrypted, b"");
    }

    #[test]
    fn test_encrypt_large_message() {
        let agent = CryptoAgent::new("test-agent".to_string());

        let large_message = vec![0u8; 10000];
        let encrypted = agent.encrypt(&large_message);
        let decrypted = agent.decrypt(&encrypted).unwrap();

        assert_eq!(decrypted, large_message);
    }

    // =========================================================================
    // Key Exchange Tests
    // =========================================================================

    #[test]
    fn test_key_exchange() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());

        let shared1 = agent1.derive_shared_secret(&agent2.get_identity().x_public_key);
        let shared2 = agent2.derive_shared_secret(&agent1.get_identity().x_public_key);

        // Shared secrets should be identical
        assert_eq!(shared1, shared2, "Shared secrets should match");
    }

    #[test]
    fn test_key_exchange_different_pairs() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());
        let agent3 = CryptoAgent::new("agent3".to_string());

        let shared12 = agent1.derive_shared_secret(&agent2.get_identity().x_public_key);
        let shared13 = agent1.derive_shared_secret(&agent3.get_identity().x_public_key);

        assert_ne!(shared12, shared13, "Different pairs produce different shared secrets");
    }

    #[test]
    fn test_key_exchange_symmetric() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());

        let shared1 = agent1.derive_shared_secret(&agent2.get_identity().x_public_key);
        let shared2 = agent2.derive_shared_secret(&agent1.get_identity().x_public_key);

        // X25519 is symmetric
        assert_eq!(shared1, shared2);
    }

    // =========================================================================
    // Replay Protection Tests
    // =========================================================================

    #[test]
    fn test_replay_protection_first_message() {
        let mut agent = CryptoAgent::new("test-agent".to_string());

        let is_valid = agent.check_replay("sender1".to_string(), 100);

        assert!(is_valid, "First message should always be valid");
    }

    #[test]
    fn test_replay_protection_higher_nonce() {
        let mut agent = CryptoAgent::new("test-agent".to_string());

        agent.check_replay("sender1".to_string(), 100);
        let is_valid = agent.check_replay("sender1".to_string(), 200);

        assert!(is_valid, "Higher nonce should be valid");
    }

    #[test]
    fn test_replay_protection_lower_nonce() {
        let mut agent = CryptoAgent::new("test-agent".to_string());

        agent.check_replay("sender1".to_string(), 200);
        let is_valid = agent.check_replay("sender1".to_string(), 100);

        assert!(!is_valid, "Lower nonce should be rejected (replay attack)");
    }

    #[test]
    fn test_replay_protection_same_nonce() {
        let mut agent = CryptoAgent::new("test-agent".to_string());

        agent.check_replay("sender1".to_string(), 100);
        let is_valid = agent.check_replay("sender1".to_string(), 100);

        assert!(!is_valid, "Same nonce should be rejected (duplicate message)");
    }

    #[test]
    fn test_replay_protection_different_senders() {
        let mut agent = CryptoAgent::new("test-agent".to_string());

        agent.check_replay("sender1".to_string(), 100);
        let is_valid = agent.check_replay("sender2".to_string(), 50);

        assert!(is_valid, "Different sender with lower nonce should be valid");
    }

    #[test]
    fn test_replay_protection_multiple_senders() {
        let mut agent = CryptoAgent::new("test-agent".to_string());

        let r1 = agent.check_replay("sender1".to_string(), 100);
        let r2 = agent.check_replay("sender2".to_string(), 200);
        let r3 = agent.check_replay("sender3".to_string(), 150);

        assert!(r1 && r2 && r3, "All senders' first messages should be valid");
    }

    // =========================================================================
    // Serialization Tests
    // Note: CryptoAgent does not support serialization (keeps keys secure)
    // Only CryptoIdentity, SignedMessage, and EncryptedMessage can be serialized
    // =========================================================================

    #[test]
    fn test_identity_serialization() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let identity = agent.get_identity();

        let serialized = serde_json::to_string(&identity).unwrap();
        let deserialized: CryptoIdentity = serde_json::from_str(&serialized).unwrap();

        assert_eq!(identity.agent_id, deserialized.agent_id);
        assert_eq!(identity.public_key, deserialized.public_key);
        assert_eq!(identity.x_public_key, deserialized.x_public_key);
    }

    #[test]
    fn test_signed_message_serialization() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let signed = agent.sign("Hello!");

        let serialized = serde_json::to_string(&signed).unwrap();
        let deserialized: SignedMessage = serde_json::from_str(&serialized).unwrap();

        assert_eq!(signed.content, deserialized.content);
        assert_eq!(signed.signature, deserialized.signature);
        assert_eq!(signed.sender, deserialized.sender);
        assert_eq!(signed.timestamp, deserialized.timestamp);
        assert_eq!(signed.nonce, deserialized.nonce);
    }

    #[test]
    fn test_encrypted_message_serialization() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let encrypted = agent.encrypt(b"Secret");

        let serialized = serde_json::to_string(&encrypted).unwrap();
        let deserialized: EncryptedMessage = serde_json::from_str(&serialized).unwrap();

        assert_eq!(encrypted.ciphertext, deserialized.ciphertext);
        assert_eq!(encrypted.nonce, deserialized.nonce);
        assert_eq!(encrypted.sender, deserialized.sender);
        assert_eq!(encrypted.timestamp, deserialized.timestamp);

        // Verify we can still decrypt
        let decrypted = agent.decrypt(&deserialized).unwrap();
        assert_eq!(decrypted, b"Secret");
    }

    // =========================================================================
    // Edge Cases
    // =========================================================================

    #[test]
    fn test_sign_empty_message() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let signed = agent.sign("");

        assert_eq!(signed.content, "");
        assert_eq!(signed.signature.len(), 64);
    }

    #[test]
    fn test_sign_unicode_message() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let unicode_msg = "Hello 🦀 Rust! 🚀";
        let signed = agent.sign(unicode_msg);

        assert_eq!(signed.content, unicode_msg);

        let public_key_bytes = &agent.get_identity().public_key;
        assert!(CryptoAgent::verify(&signed, public_key_bytes));
    }

    #[test]
    fn test_sign_very_long_message() {
        let agent = CryptoAgent::new("test-agent".to_string());
        let long_msg = "a".repeat(10000);
        let signed = agent.sign(&long_msg);

        assert_eq!(signed.content, long_msg);

        let public_key_bytes = &agent.get_identity().public_key;
        assert!(CryptoAgent::verify(&signed, public_key_bytes));
    }

    #[test]
    fn test_multiple_agents_independent_nonces() {
        let agent1 = CryptoAgent::new("agent1".to_string());
        let agent2 = CryptoAgent::new("agent2".to_string());

        let signed1 = agent1.sign("test");
        std::thread::sleep(std::time::Duration::from_millis(10));
        let signed2 = agent2.sign("test");

        // Nonces should be independent (not shared between agents)
        // Though they might coincidentally be the same due to timestamp-based generation
        assert!(signed1.nonce != signed2.nonce || signed1.timestamp != signed2.timestamp,
                "Agents should have independent nonce/timestamp combinations");
    }
}
