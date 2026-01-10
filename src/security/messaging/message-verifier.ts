/**
 * ELEX Security Layer - Message Verifier
 *
 * Verifies secure messages: signature, timestamp window, nonce deduplication,
 * and sender identity against the agent registry.
 *
 * @see ADR-007 Layer 2: Message Signing
 */

import type {
  AgentId,
  AgentIdentity,
  MessageVerificationResult,
  Nonce,
  NonceEntry,
  SecureMessage,
  Timestamp,
} from '../types.js';
import {
  MessageVerificationError,
  SecurityError,
  SecurityErrorCode,
  DEFAULT_SECURITY_CONFIG,
} from '../types.js';
import { verify } from '../identity/keypair.js';
import type { AgentRegistry } from '../identity/registry.js';
import { createSignatureData } from './message-builder.js';

/**
 * Message Verifier
 *
 * Performs comprehensive message verification:
 * 1. Signature verification with sender's public key
 * 2. Timestamp within 5-minute window
 * 3. Nonce deduplication (replay protection)
 * 4. Sender verification against registry
 */
export class MessageVerifier {
  /** Seen nonces for replay protection */
  private nonceCache: Map<string, NonceEntry> = new Map();

  /** Timestamp window in milliseconds (default: 5 minutes) */
  private timestampWindowMs: number;

  /** Nonce retention period in milliseconds (default: 10 minutes) */
  private nonceRetentionMs: number;

  /** Last nonce cleanup time */
  private lastCleanup: Timestamp = 0;

  /** Cleanup interval (every 1 minute) */
  private cleanupIntervalMs = 60 * 1000;

  constructor(
    private registry: AgentRegistry,
    config: Partial<{
      timestampWindowMs: number;
      nonceRetentionMs: number;
    }> = {}
  ) {
    this.timestampWindowMs =
      config.timestampWindowMs ?? DEFAULT_SECURITY_CONFIG.timestampWindowMs;
    this.nonceRetentionMs =
      config.nonceRetentionMs ?? DEFAULT_SECURITY_CONFIG.nonceRetentionMs;
  }

  /**
   * Verify a secure message
   *
   * @param message - Message to verify
   * @returns Verification result with status and sender identity
   */
  async verifyMessage<T>(
    message: SecureMessage<T>
  ): Promise<MessageVerificationResult> {
    const now = Date.now();

    // Periodic cleanup of old nonces
    this.maybeCleanupNonces(now);

    // Step 1: Check message format
    if (!this.isValidMessageFormat(message)) {
      return {
        isValid: false,
        error: MessageVerificationError.MALFORMED_MESSAGE,
        verifiedAt: now,
      };
    }

    // Step 2: Check timestamp (not expired, not in future)
    const timestampResult = this.checkTimestamp(message.timestamp, now);
    if (timestampResult !== null) {
      return {
        isValid: false,
        error: timestampResult,
        verifiedAt: now,
      };
    }

    // Step 3: Check nonce (replay protection)
    const nonceKey = `${message.senderId}:${message.nonce}`;
    if (this.nonceCache.has(nonceKey)) {
      return {
        isValid: false,
        error: MessageVerificationError.DUPLICATE_NONCE,
        verifiedAt: now,
      };
    }

    // Step 4: Get sender from registry
    const senderIdentity = this.registry.getAgentIdentity(message.senderId);
    if (!senderIdentity) {
      return {
        isValid: false,
        error: MessageVerificationError.UNKNOWN_SENDER,
        verifiedAt: now,
      };
    }

    // Step 5: Check sender is active
    if (!this.registry.isAgentActive(message.senderId)) {
      return {
        isValid: false,
        error: MessageVerificationError.INACTIVE_SENDER,
        verifiedAt: now,
      };
    }

    // Step 6: Verify signature
    const signatureData = createSignatureData({
      messageId: message.messageId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      timestamp: message.timestamp,
      nonce: message.nonce,
      payload: message.payload,
      isEncrypted: message.isEncrypted,
    });

    const isSignatureValid = await verify(
      message.signature,
      signatureData,
      senderIdentity.publicKey
    );

    if (!isSignatureValid) {
      return {
        isValid: false,
        error: MessageVerificationError.INVALID_SIGNATURE,
        verifiedAt: now,
      };
    }

    // Step 7: Record nonce (prevent replay)
    this.nonceCache.set(nonceKey, {
      nonce: message.nonce,
      seenAt: now,
      senderId: message.senderId,
    });

    // All checks passed
    return {
      isValid: true,
      senderIdentity,
      verifiedAt: now,
    };
  }

  /**
   * Verify message for a specific recipient
   *
   * @param message - Message to verify
   * @param recipientId - Expected recipient ID
   * @returns Verification result
   */
  async verifyMessageForRecipient<T>(
    message: SecureMessage<T>,
    recipientId: AgentId
  ): Promise<MessageVerificationResult> {
    // First do standard verification
    const result = await this.verifyMessage(message);
    if (!result.isValid) {
      return result;
    }

    // Check recipient matches (or is broadcast)
    if (message.recipientId !== 'broadcast' && message.recipientId !== recipientId) {
      return {
        isValid: false,
        error: MessageVerificationError.MALFORMED_MESSAGE,
        verifiedAt: result.verifiedAt,
      };
    }

    return result;
  }

  /**
   * Check if message format is valid
   */
  private isValidMessageFormat<T>(message: SecureMessage<T>): boolean {
    if (!message.messageId || typeof message.messageId !== 'string') {
      return false;
    }
    if (!message.senderId || typeof message.senderId !== 'string') {
      return false;
    }
    if (!message.recipientId || typeof message.recipientId !== 'string') {
      return false;
    }
    if (typeof message.timestamp !== 'number') {
      return false;
    }
    if (!message.nonce || typeof message.nonce !== 'string') {
      return false;
    }
    if (typeof message.isEncrypted !== 'boolean') {
      return false;
    }
    if (!message.signature || !(message.signature instanceof Uint8Array)) {
      return false;
    }
    if (message.signature.length !== 64) {
      return false;
    }
    return true;
  }

  /**
   * Check timestamp validity
   *
   * @returns null if valid, error code if invalid
   */
  private checkTimestamp(
    timestamp: Timestamp,
    now: Timestamp
  ): MessageVerificationError | null {
    const delta = now - timestamp;

    // Check if timestamp is too far in the future (with 30s tolerance for clock skew)
    if (delta < -30000) {
      return MessageVerificationError.FUTURE_TIMESTAMP;
    }

    // Check if timestamp is too old
    if (delta > this.timestampWindowMs) {
      return MessageVerificationError.EXPIRED_TIMESTAMP;
    }

    return null;
  }

  /**
   * Clean up old nonces if enough time has passed
   */
  private maybeCleanupNonces(now: Timestamp): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    const cutoff = now - this.nonceRetentionMs;
    for (const [key, entry] of this.nonceCache) {
      if (entry.seenAt < cutoff) {
        this.nonceCache.delete(key);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Get nonce cache size (for monitoring)
   */
  getNonceCacheSize(): number {
    return this.nonceCache.size;
  }

  /**
   * Force nonce cleanup (for testing or maintenance)
   */
  forceCleanupNonces(): number {
    const before = this.nonceCache.size;
    const cutoff = Date.now() - this.nonceRetentionMs;

    for (const [key, entry] of this.nonceCache) {
      if (entry.seenAt < cutoff) {
        this.nonceCache.delete(key);
      }
    }

    return before - this.nonceCache.size;
  }

  /**
   * Clear all cached nonces
   */
  clearNonceCache(): void {
    this.nonceCache.clear();
  }

  /**
   * Check if a nonce has been seen
   */
  hasSeenNonce(senderId: AgentId, nonce: Nonce): boolean {
    return this.nonceCache.has(`${senderId}:${nonce}`);
  }
}

/**
 * Quick verification without full registry check
 * (useful for performance-critical paths where sender is pre-verified)
 */
export async function quickVerifySignature<T>(
  message: SecureMessage<T>,
  senderPublicKey: Uint8Array
): Promise<boolean> {
  const signatureData = createSignatureData({
    messageId: message.messageId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload: message.payload,
    isEncrypted: message.isEncrypted,
  });

  return verify(message.signature, signatureData, senderPublicKey);
}
