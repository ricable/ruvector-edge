/**
 * ELEX Security Layer - Messaging Module
 *
 * Exports for secure message building, signing, and verification.
 *
 * @see ADR-007 Layer 2: Message Signing
 */

// Message builder
export {
  buildSecureMessage,
  createSignatureData,
  serializeSecureMessage,
  deserializeSecureMessage,
  MessageBuilder,
  type SerializedSecureMessage,
} from './message-builder.js';

// Message verifier
export {
  MessageVerifier,
  quickVerifySignature,
} from './message-verifier.js';
