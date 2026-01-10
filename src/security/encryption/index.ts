/**
 * ELEX Security Layer - Encryption Module
 *
 * Exports for AES-256-GCM encryption and X25519 key exchange.
 *
 * @see ADR-007 Layer 3: Payload Encryption
 * @see ADR-007 Layer 4: Key Exchange (X25519 ECDH)
 */

// AES-256-GCM encryption
export {
  AES_KEY_SIZE,
  AES_IV_SIZE,
  AES_TAG_SIZE,
  encrypt,
  decrypt,
  encryptString,
  decryptString,
  encryptJSON,
  decryptJSON,
  generateKey,
  serializeEncryptedPayload,
  deserializeEncryptedPayload,
  clearKey,
} from './aes-gcm.js';

// X25519 key exchange
export {
  X25519_PRIVATE_KEY_SIZE,
  X25519_PUBLIC_KEY_SIZE,
  generateEphemeralKeypair,
  computeSharedSecret,
  deriveSessionKey,
  initiateKeyExchange,
  respondToKeyExchange,
  completeKeyExchange,
  isSessionKeyExpired,
  clearSessionKey,
} from './key-exchange.js';

// Session key manager
export { SessionKeyManager } from './session-manager.js';
