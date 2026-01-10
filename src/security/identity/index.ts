/**
 * ELEX Security Layer - Identity Module
 *
 * Exports for Ed25519 keypair generation, agent identity management,
 * and agent registry.
 *
 * @see ADR-007 Layer 1: Agent Identity
 */

// Keypair operations
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
} from './keypair.js';

// Agent identity
export {
  createAgentIdentity,
  createAgentIdentityFromKeypair,
  extractPublicIdentity,
  verifyAgentIdentity,
  serializeAgentIdentity,
  deserializeAgentIdentity,
  AgentIdentityManager,
} from './agent-identity.js';

// Agent registry
export { AgentRegistry } from './registry.js';
