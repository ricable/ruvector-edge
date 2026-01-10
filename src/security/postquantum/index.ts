/**
 * ELEX Security Layer - Post-Quantum Module
 *
 * Exports for hybrid Ed25519 + Dilithium signatures.
 *
 * @see ADR-007 Layer 5: Post-Quantum Hybrid (Ed25519 + Dilithium)
 */

export {
  type PostQuantumProvider,
  HybridSignatureManager,
  serializeHybridSignature,
  deserializeHybridSignature,
  serializeHybridPublicKey,
  deserializeHybridPublicKey,
  createHybridSignatureManager,
} from './hybrid-signature.js';
