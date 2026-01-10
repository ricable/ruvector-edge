/**
 * ELEX Security Layer - Type Definitions
 *
 * Defines interfaces for the multi-layer cryptographic architecture:
 * - Layer 1: Agent Identity (Ed25519)
 * - Layer 2: Message Signing (Ed25519)
 * - Layer 3: Payload Encryption (AES-256-GCM)
 * - Layer 4: Key Exchange (X25519 ECDH)
 * - Layer 5: Post-Quantum Hybrid (Ed25519 + Dilithium)
 *
 * @see ADR-007-security-cryptography.md
 */

// =============================================================================
// Core Security Types
// =============================================================================

/**
 * 32-byte private key for Ed25519/X25519 operations
 */
export type PrivateKey = Uint8Array;

/**
 * 32-byte public key for Ed25519/X25519 operations
 */
export type PublicKey = Uint8Array;

/**
 * 64-byte Ed25519 signature
 */
export type Signature = Uint8Array;

/**
 * Agent identifier derived from public key hash (32 bytes, hex-encoded)
 */
export type AgentId = string;

/**
 * FAJ (Feature Activation Journal) code for Ericsson RAN features
 */
export type FAJCode = string;

/**
 * UUID v4 string for message identification
 */
export type MessageId = string;

/**
 * Random 16-byte nonce for replay protection (hex-encoded)
 */
export type Nonce = string;

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number;

// =============================================================================
// Identity Types
// =============================================================================

/**
 * Ed25519 keypair for agent identity
 */
export interface Keypair {
  /** 32-byte private key (keep secret) */
  privateKey: PrivateKey;
  /** 32-byte public key (can be shared) */
  publicKey: PublicKey;
}

/**
 * Agent identity with cryptographic binding
 */
export interface AgentIdentity {
  /** Unique agent identifier (derived from public key hash) */
  agentId: AgentId;
  /** Ed25519 public key for signature verification */
  publicKey: PublicKey;
  /** FAJ code this agent is authorized for (cryptographically bound) */
  fajCode: FAJCode;
  /** Creation timestamp */
  createdAt: Timestamp;
  /** Signature binding agentId to fajCode */
  fajBinding: Signature;
}

/**
 * Agent identity with private key (for local agent operations)
 */
export interface AgentIdentityWithKeys extends AgentIdentity {
  /** Ed25519 private key for signing */
  privateKey: PrivateKey;
}

/**
 * Registry entry for verified agents
 */
export interface AgentRegistryEntry {
  /** Agent identity information */
  identity: AgentIdentity;
  /** Registry signature validating this agent */
  registrySignature: Signature;
  /** When this entry was registered */
  registeredAt: Timestamp;
  /** Expiration timestamp (0 = no expiry) */
  expiresAt: Timestamp;
  /** Whether this agent is currently active */
  isActive: boolean;
}

// =============================================================================
// Message Security Types
// =============================================================================

/**
 * Secure message envelope with cryptographic protection
 */
export interface SecureMessage<T = unknown> {
  /** Unique message identifier (UUID v4) */
  messageId: MessageId;
  /** Sender agent ID */
  senderId: AgentId;
  /** Recipient agent ID (or 'broadcast' for swarm-wide) */
  recipientId: AgentId | 'broadcast';
  /** Message creation timestamp (milliseconds) */
  timestamp: Timestamp;
  /** Random nonce for replay protection */
  nonce: Nonce;
  /** Message payload (may be encrypted) */
  payload: T;
  /** Whether payload is encrypted */
  isEncrypted: boolean;
  /** Ed25519 signature of message (covers all fields except signature) */
  signature: Signature;
}

/**
 * Message verification result
 */
export interface MessageVerificationResult {
  /** Whether the message passed all verification checks */
  isValid: boolean;
  /** Verification error if invalid */
  error?: MessageVerificationError;
  /** Verified sender identity (if valid) */
  senderIdentity?: AgentIdentity;
  /** Verification timestamp */
  verifiedAt: Timestamp;
}

/**
 * Possible message verification errors
 */
export enum MessageVerificationError {
  /** Signature does not match */
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  /** Timestamp outside valid window (5 minutes) */
  EXPIRED_TIMESTAMP = 'EXPIRED_TIMESTAMP',
  /** Timestamp is in the future */
  FUTURE_TIMESTAMP = 'FUTURE_TIMESTAMP',
  /** Nonce has been seen before (replay attack) */
  DUPLICATE_NONCE = 'DUPLICATE_NONCE',
  /** Sender not found in registry */
  UNKNOWN_SENDER = 'UNKNOWN_SENDER',
  /** Sender is not active */
  INACTIVE_SENDER = 'INACTIVE_SENDER',
  /** Message format is invalid */
  MALFORMED_MESSAGE = 'MALFORMED_MESSAGE',
}

/**
 * Nonce cache entry for deduplication
 */
export interface NonceEntry {
  /** The nonce value */
  nonce: Nonce;
  /** When this nonce was first seen */
  seenAt: Timestamp;
  /** Sender agent ID */
  senderId: AgentId;
}

// =============================================================================
// Encryption Types
// =============================================================================

/**
 * AES-256-GCM encrypted payload
 */
export interface EncryptedPayload {
  /** Encrypted ciphertext */
  ciphertext: Uint8Array;
  /** 12-byte initialization vector */
  iv: Uint8Array;
  /** 16-byte authentication tag */
  authTag: Uint8Array;
  /** Key identifier for session key lookup */
  keyId: string;
}

/**
 * Session key for symmetric encryption
 */
export interface SessionKey {
  /** Unique key identifier */
  keyId: string;
  /** 256-bit AES key */
  key: Uint8Array;
  /** When this key was created */
  createdAt: Timestamp;
  /** When this key expires (hourly rotation) */
  expiresAt: Timestamp;
  /** Peer agent ID this key is shared with */
  peerId: AgentId;
}

/**
 * X25519 key exchange result
 */
export interface KeyExchangeResult {
  /** Derived shared secret (32 bytes) */
  sharedSecret: Uint8Array;
  /** Ephemeral public key to send to peer */
  ephemeralPublicKey: PublicKey;
  /** Session key derived from shared secret */
  sessionKey: SessionKey;
}

/**
 * Key exchange request message
 */
export interface KeyExchangeRequest {
  /** Initiator's ephemeral public key */
  ephemeralPublicKey: PublicKey;
  /** Initiator's agent ID */
  initiatorId: AgentId;
  /** Responder's agent ID */
  responderId: AgentId;
  /** Request timestamp */
  timestamp: Timestamp;
  /** Signature from initiator */
  signature: Signature;
}

/**
 * Key exchange response message
 */
export interface KeyExchangeResponse {
  /** Responder's ephemeral public key */
  ephemeralPublicKey: PublicKey;
  /** Resulting session key ID */
  sessionKeyId: string;
  /** Response timestamp */
  timestamp: Timestamp;
  /** Signature from responder */
  signature: Signature;
}

// =============================================================================
// Post-Quantum Types
// =============================================================================

/**
 * Supported signature algorithms
 */
export enum SignatureAlgorithm {
  /** Classical Ed25519 only */
  ED25519 = 'ed25519',
  /** Dilithium only (post-quantum) */
  DILITHIUM = 'dilithium',
  /** Hybrid Ed25519 + Dilithium */
  HYBRID = 'hybrid',
}

/**
 * Hybrid signature (Ed25519 + Dilithium)
 */
export interface HybridSignature {
  /** Classical Ed25519 signature (64 bytes) */
  ed25519Signature: Signature;
  /** Post-quantum Dilithium signature (~2420 bytes for Dilithium2) */
  dilithiumSignature?: Uint8Array;
  /** Algorithm used */
  algorithm: SignatureAlgorithm;
}

/**
 * Hybrid public key
 */
export interface HybridPublicKey {
  /** Ed25519 public key (32 bytes) */
  ed25519PublicKey: PublicKey;
  /** Dilithium public key (~1312 bytes for Dilithium2) */
  dilithiumPublicKey?: Uint8Array;
}

/**
 * Hybrid keypair
 */
export interface HybridKeypair {
  /** Ed25519 keypair */
  ed25519: Keypair;
  /** Dilithium keypair (optional, for post-quantum) */
  dilithium?: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };
}

// =============================================================================
// Access Control Types
// =============================================================================

/**
 * Capability grant for an agent
 */
export interface Capability {
  /** Unique capability identifier */
  capabilityId: string;
  /** Agent this capability is granted to */
  granteeId: AgentId;
  /** FAJ codes this capability applies to */
  fajCodes: FAJCode[];
  /** Allowed actions */
  actions: CapabilityAction[];
  /** When capability was granted */
  grantedAt: Timestamp;
  /** When capability expires (0 = no expiry) */
  expiresAt: Timestamp;
  /** Signature from registry/grantor */
  signature: Signature;
}

/**
 * Actions that can be performed on a feature
 */
export enum CapabilityAction {
  /** Read feature configuration */
  READ = 'read',
  /** Generate parameter recommendations */
  RECOMMEND = 'recommend',
  /** Execute cmedit commands */
  EXECUTE = 'execute',
  /** Consult peer agents */
  CONSULT = 'consult',
  /** Update Q-learning table */
  LEARN = 'learn',
  /** Participate in consensus */
  VOTE = 'vote',
}

/**
 * Access control verification result
 */
export interface AccessVerificationResult {
  /** Whether access is granted */
  isGranted: boolean;
  /** Reason for denial (if not granted) */
  denialReason?: AccessDenialReason;
  /** Matching capability (if granted) */
  capability?: Capability;
}

/**
 * Reasons for access denial
 */
export enum AccessDenialReason {
  /** No capability found for this agent/action */
  NO_CAPABILITY = 'NO_CAPABILITY',
  /** Capability has expired */
  EXPIRED_CAPABILITY = 'EXPIRED_CAPABILITY',
  /** Invalid capability signature */
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  /** FAJ code not covered by capability */
  FAJ_NOT_COVERED = 'FAJ_NOT_COVERED',
  /** Action not allowed by capability */
  ACTION_NOT_ALLOWED = 'ACTION_NOT_ALLOWED',
  /** Agent is not active */
  AGENT_INACTIVE = 'AGENT_INACTIVE',
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Security layer configuration
 */
export interface SecurityConfig {
  /** Timestamp window for message validity (default: 5 minutes) */
  timestampWindowMs: number;
  /** How long to keep nonces for deduplication (default: 10 minutes) */
  nonceRetentionMs: number;
  /** Session key rotation interval (default: 1 hour) */
  keyRotationIntervalMs: number;
  /** Signature algorithm to use */
  signatureAlgorithm: SignatureAlgorithm;
  /** Whether to require post-quantum signatures */
  requirePostQuantum: boolean;
  /** Registry public key for agent verification */
  registryPublicKey?: PublicKey;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  timestampWindowMs: 5 * 60 * 1000, // 5 minutes
  nonceRetentionMs: 10 * 60 * 1000, // 10 minutes
  keyRotationIntervalMs: 60 * 60 * 1000, // 1 hour
  signatureAlgorithm: SignatureAlgorithm.ED25519,
  requirePostQuantum: false,
  registryPublicKey: undefined,
};

// =============================================================================
// Error Types
// =============================================================================

/**
 * Security-related error
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: SecurityErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Security error codes
 */
export enum SecurityErrorCode {
  /** Key generation failed */
  KEY_GENERATION_FAILED = 'KEY_GENERATION_FAILED',
  /** Signing operation failed */
  SIGNING_FAILED = 'SIGNING_FAILED',
  /** Verification operation failed */
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  /** Encryption operation failed */
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  /** Decryption operation failed */
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  /** Key exchange failed */
  KEY_EXCHANGE_FAILED = 'KEY_EXCHANGE_FAILED',
  /** Invalid input data */
  INVALID_INPUT = 'INVALID_INPUT',
  /** Session key not found */
  SESSION_KEY_NOT_FOUND = 'SESSION_KEY_NOT_FOUND',
  /** Session key expired */
  SESSION_KEY_EXPIRED = 'SESSION_KEY_EXPIRED',
  /** Agent not registered */
  AGENT_NOT_REGISTERED = 'AGENT_NOT_REGISTERED',
  /** Post-quantum not available */
  POST_QUANTUM_UNAVAILABLE = 'POST_QUANTUM_UNAVAILABLE',
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Serialized form of a secure message (for transport)
 */
export interface SerializedSecureMessage {
  messageId: string;
  senderId: string;
  recipientId: string;
  timestamp: number;
  nonce: string;
  payload: string; // Base64 or JSON
  isEncrypted: boolean;
  signature: string; // Base64
}

/**
 * Hex-encoded bytes for JSON serialization
 */
export type HexString = string;

/**
 * Base64-encoded bytes for transport
 */
export type Base64String = string;
