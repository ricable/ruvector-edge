/**
 * Security Bounded Context
 *
 * Supporting Domain: Agent identity, message authentication, encryption,
 * access control, and post-quantum security.
 *
 * Responsibility:
 * - Ed25519 identity keypairs (32-byte)
 * - AES-256-GCM payload encryption
 * - X25519 ECDH key exchange (hourly rotation)
 * - Ed25519 + Dilithium hybrid for post-quantum
 * - Message verification with replay protection
 *
 * Key Aggregates:
 * - AgentIdentity (Aggregate Root)
 * - CryptoProvider
 * - MessageVerifier
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';
