/**
 * @fileoverview Security interfaces
 * @module @ruvector/edge/core/interfaces/security
 *
 * @see ADR-007: Security and Cryptography Architecture
 */

import type { AgentId, FAJCode } from '../types/identifiers.js';
import type {
  PublicKey,
  PrivateKey,
  Signature,
  EncryptedPayload,
  Timestamp
} from '../types/primitives.js';

/**
 * Agent identity keypair
 * Ed25519 for signing, X25519 for key exchange
 */
export interface IAgentIdentity {
  readonly agentId: AgentId;
  readonly publicKey: PublicKey;
  readonly fajCode: FAJCode;

  /** Sign data with private key */
  sign(data: Uint8Array): Promise<Signature>;

  /** Verify signature with public key */
  verify(data: Uint8Array, signature: Signature): Promise<boolean>;

  /** Derive shared secret for encryption */
  deriveSharedSecret(peerPublicKey: PublicKey): Promise<Uint8Array>;

  /** Export public key for sharing */
  exportPublicKey(): Uint8Array;
}

/**
 * Cryptographic operations provider
 */
export interface ICryptoProvider {
  /** Generate new Ed25519 keypair */
  generateKeypair(): Promise<IKeypair>;

  /** Sign data with Ed25519 */
  sign(data: Uint8Array, privateKey: PrivateKey): Promise<Signature>;

  /** Verify Ed25519 signature */
  verify(data: Uint8Array, signature: Signature, publicKey: PublicKey): Promise<boolean>;

  /** Encrypt with AES-256-GCM */
  encrypt(data: Uint8Array, key: Uint8Array): Promise<EncryptedPayload>;

  /** Decrypt with AES-256-GCM */
  decrypt(encrypted: EncryptedPayload, key: Uint8Array): Promise<Uint8Array>;

  /** X25519 key exchange */
  keyExchange(privateKey: PrivateKey, peerPublicKey: PublicKey): Promise<Uint8Array>;

  /** Generate random nonce */
  generateNonce(): string;

  /** Hash data with SHA-256 */
  hash(data: Uint8Array): Promise<Uint8Array>;
}

/**
 * Ed25519 keypair
 */
export interface IKeypair {
  readonly publicKey: PublicKey;
  readonly privateKey: PrivateKey;
}

/**
 * Session key for symmetric encryption
 * Rotated hourly per ADR-007
 */
export interface ISessionKey {
  readonly key: Uint8Array;
  readonly createdAt: Timestamp;
  readonly expiresAt: Timestamp;
  readonly peerId: AgentId;

  /** Check if key is expired */
  isExpired(): boolean;

  /** Get remaining validity in ms */
  remainingValidity(): number;
}

/**
 * Session key manager
 */
export interface ISessionKeyManager {
  /** Get or create session key for peer */
  getSessionKey(peerId: AgentId, peerPublicKey: PublicKey): Promise<ISessionKey>;

  /** Rotate session key for peer */
  rotateKey(peerId: AgentId): Promise<ISessionKey>;

  /** Remove expired keys */
  cleanup(): void;

  /** Get all active sessions */
  getActiveSessions(): AgentId[];
}

/**
 * Message security wrapper
 */
export interface IMessageSecurity {
  /** Create secure message */
  secure(
    senderId: AgentId,
    recipientId: AgentId,
    payload: Uint8Array
  ): Promise<ISecuredMessage>;

  /** Verify and decrypt message */
  unsecure(message: ISecuredMessage): Promise<Uint8Array>;

  /** Verify message without decrypting */
  verifyOnly(message: ISecuredMessage): Promise<boolean>;
}

/**
 * Secured message structure
 */
export interface ISecuredMessage {
  readonly id: string;
  readonly senderId: AgentId;
  readonly recipientId: AgentId;
  readonly encryptedPayload: EncryptedPayload;
  readonly signature: Signature;
  readonly timestamp: Timestamp;
  readonly nonce: string;
}

/**
 * Post-quantum hybrid signature
 * Ed25519 + Dilithium for quantum resistance
 */
export interface IHybridSignature {
  readonly classicalSignature: Signature;
  readonly postQuantumSignature: Uint8Array;
  readonly algorithm: 'ed25519+dilithium';
}

/**
 * Replay protection via nonce tracking
 */
export interface IReplayProtection {
  /** Check if nonce has been seen */
  isReplay(nonce: string, senderId: AgentId): boolean;

  /** Record nonce as used */
  recordNonce(nonce: string, senderId: AgentId, timestamp: Timestamp): void;

  /** Cleanup expired nonces (older than 5 min) */
  cleanup(): void;
}

/**
 * Agent registry for identity management
 */
export interface IAgentRegistry {
  /** Register agent identity */
  register(agentId: AgentId, publicKey: PublicKey, fajCode: FAJCode): Promise<void>;

  /** Get agent public key */
  getPublicKey(agentId: AgentId): Promise<PublicKey | undefined>;

  /** Get agent by FAJ code */
  getByFAJCode(fajCode: FAJCode): Promise<AgentId | undefined>;

  /** Verify agent identity */
  verifyIdentity(agentId: AgentId, signature: Signature, data: Uint8Array): Promise<boolean>;

  /** Remove agent from registry */
  unregister(agentId: AgentId): Promise<void>;

  /** Get all registered agents */
  getAllAgents(): Promise<AgentId[]>;
}
