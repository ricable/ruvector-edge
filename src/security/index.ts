/**
 * ELEX Security Layer
 *
 * Multi-layer cryptographic architecture for the ELEX Edge AI Agent Swarm:
 *
 * Layer 1: Agent Identity (Ed25519)
 * - Keypair generation and management
 * - Agent ID derived from public key hash
 * - FAJ code cryptographic binding
 *
 * Layer 2: Message Signing (Ed25519)
 * - UUID, timestamp, nonce for each message
 * - 5-minute timestamp window validation
 * - Nonce deduplication for replay protection
 *
 * Layer 3: Payload Encryption (AES-256-GCM)
 * - Authenticated encryption for sensitive data
 * - 256-bit keys with GCM mode
 *
 * Layer 4: Key Exchange (X25519 ECDH)
 * - Ephemeral keys for session establishment
 * - Perfect forward secrecy
 * - Hourly key rotation
 *
 * Layer 5: Post-Quantum Hybrid (Ed25519 + Dilithium)
 * - Future-proofing against quantum attacks
 * - Graceful fallback to classical signatures
 *
 * @see docs/adr/ADR-007-security-cryptography.md
 * @see docs/ddd/bounded-contexts.md (Security Context)
 */

// Types
export * from './types.js';

// Identity module
export {
  generateKeypair,
  deriveAgentId,
  sign,
  verify,
  serializeKeypair,
  deserializeKeypair,
  publicKeyToHex,
  hexToPublicKey,
  signatureToHex,
  hexToSignature,
  validateKeypair,
  clearPrivateKey,
  createAgentIdentity,
  createAgentIdentityFromKeypair,
  extractPublicIdentity,
  verifyAgentIdentity,
  serializeAgentIdentity,
  deserializeAgentIdentity,
  AgentIdentityManager,
  AgentRegistry,
} from './identity/index.js';

// Messaging module
export {
  buildSecureMessage,
  createSignatureData,
  serializeSecureMessage,
  deserializeSecureMessage,
  MessageBuilder,
  MessageVerifier,
  quickVerifySignature,
  type SerializedSecureMessage,
} from './messaging/index.js';

// Encryption module
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
  SessionKeyManager,
} from './encryption/index.js';

// Post-quantum module
export {
  type PostQuantumProvider,
  HybridSignatureManager,
  serializeHybridSignature,
  deserializeHybridSignature,
  serializeHybridPublicKey,
  deserializeHybridPublicKey,
  createHybridSignatureManager,
} from './postquantum/index.js';

// Access control module
export {
  createCapability,
  verifyCapability,
  isCapabilityExpired,
  capabilityCovers,
  capabilityAllows,
  serializeCapability,
  deserializeCapability,
  createSelfCapability,
  createReadOnlyCapability,
  createConsultCapability,
  createExecuteCapability,
  type SerializedCapability,
  AccessController,
} from './access/index.js';

// Unified crypto provider
export { CryptoProvider, createCryptoProvider } from './crypto-provider.js';
