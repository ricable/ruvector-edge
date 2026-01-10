/**
 * MessageVerifier Entity
 *
 * Verifies message authenticity including signature validation,
 * timestamp checks, and nonce deduplication.
 */

import { Message, PublicKey, Ed25519Signature } from '../value-objects/message';

export interface VerificationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly details?: {
    signatureValid: boolean;
    timestampValid: boolean;
    nonceUnique: boolean;
    senderVerified: boolean;
  };
}

export interface VerifierConfig {
  readonly timestampWindowMs: number;    // Max message age (default: 5 minutes)
  readonly nonceRetentionMs: number;     // How long to remember nonces
  readonly maxNonceCache: number;        // Maximum nonces to cache
}

/**
 * MessageVerifier Entity
 */
export class MessageVerifier {
  readonly id: string;
  private _config: VerifierConfig;
  private _usedNonces: Map<string, number>;  // nonce -> timestamp
  private _knownSenders: Map<string, PublicKey>;
  private _verificationCount: number;
  private _failureCount: number;

  constructor(
    id: string,
    config: VerifierConfig = {
      timestampWindowMs: 5 * 60 * 1000,  // 5 minutes
      nonceRetentionMs: 10 * 60 * 1000,  // 10 minutes
      maxNonceCache: 10000
    }
  ) {
    this.id = id;
    this._config = config;
    this._usedNonces = new Map();
    this._knownSenders = new Map();
    this._verificationCount = 0;
    this._failureCount = 0;
  }

  /**
   * Register a known sender with their public key
   */
  registerSender(senderId: string, publicKey: PublicKey): void {
    this._knownSenders.set(senderId, publicKey);
  }

  /**
   * Unregister a sender
   */
  unregisterSender(senderId: string): void {
    this._knownSenders.delete(senderId);
  }

  /**
   * Verify a message
   */
  verify(message: Message, verifySignature?: (data: Uint8Array, sig: Ed25519Signature, pk: PublicKey) => boolean): VerificationResult {
    this._verificationCount++;

    // Check basic validity
    const basicValidity = message.isValid();
    if (!basicValidity.valid) {
      this._failureCount++;
      return {
        valid: false,
        reason: basicValidity.reason,
        details: {
          signatureValid: false,
          timestampValid: false,
          nonceUnique: false,
          senderVerified: false
        }
      };
    }

    // Check timestamp
    const timestampValid = this.isTimestampValid(message.timestamp);
    if (!timestampValid) {
      this._failureCount++;
      return {
        valid: false,
        reason: 'Message timestamp outside allowed window',
        details: {
          signatureValid: false,
          timestampValid: false,
          nonceUnique: true,
          senderVerified: false
        }
      };
    }

    // Check nonce uniqueness
    const nonceUnique = this.isNonceUnique(message.nonce);
    if (!nonceUnique) {
      this._failureCount++;
      return {
        valid: false,
        reason: 'Nonce has already been used (possible replay attack)',
        details: {
          signatureValid: false,
          timestampValid: true,
          nonceUnique: false,
          senderVerified: false
        }
      };
    }

    // Verify sender is known
    const senderPublicKey = this._knownSenders.get(message.senderId);
    if (!senderPublicKey) {
      this._failureCount++;
      return {
        valid: false,
        reason: `Unknown sender: ${message.senderId}`,
        details: {
          signatureValid: false,
          timestampValid: true,
          nonceUnique: true,
          senderVerified: false
        }
      };
    }

    // Verify signature (if verifier provided)
    let signatureValid = true;
    if (verifySignature) {
      const messageData = this.serializeForSignature(message);
      signatureValid = verifySignature(messageData, message.signature, senderPublicKey);

      if (!signatureValid) {
        this._failureCount++;
        return {
          valid: false,
          reason: 'Invalid signature',
          details: {
            signatureValid: false,
            timestampValid: true,
            nonceUnique: true,
            senderVerified: true
          }
        };
      }
    }

    // Record nonce as used
    this.recordNonce(message.nonce);

    return {
      valid: true,
      details: {
        signatureValid,
        timestampValid: true,
        nonceUnique: true,
        senderVerified: true
      }
    };
  }

  /**
   * Check if timestamp is within allowed window
   */
  private isTimestampValid(timestamp: number): boolean {
    const now = Date.now();
    const age = now - timestamp;
    return age >= 0 && age <= this._config.timestampWindowMs;
  }

  /**
   * Check if nonce is unique (not previously used)
   */
  private isNonceUnique(nonce: string): boolean {
    return !this._usedNonces.has(nonce);
  }

  /**
   * Record a nonce as used
   */
  private recordNonce(nonce: string): void {
    this._usedNonces.set(nonce, Date.now());

    // Clean up old nonces
    this.cleanupOldNonces();
  }

  /**
   * Remove expired nonces from cache
   */
  private cleanupOldNonces(): void {
    const cutoff = Date.now() - this._config.nonceRetentionMs;
    const toDelete: string[] = [];

    for (const [nonce, timestamp] of this._usedNonces) {
      if (timestamp < cutoff) {
        toDelete.push(nonce);
      }
    }

    for (const nonce of toDelete) {
      this._usedNonces.delete(nonce);
    }

    // If still over limit, remove oldest
    if (this._usedNonces.size > this._config.maxNonceCache) {
      const entries = Array.from(this._usedNonces.entries())
        .sort((a, b) => a[1] - b[1]);

      const toRemove = entries.slice(0, this._usedNonces.size - this._config.maxNonceCache);
      for (const [nonce] of toRemove) {
        this._usedNonces.delete(nonce);
      }
    }
  }

  /**
   * Serialize message for signature verification
   */
  private serializeForSignature(message: Message): Uint8Array {
    const data = JSON.stringify({
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      timestamp: message.timestamp,
      nonce: message.nonce,
      payload: typeof message.payload === 'string' ? message.payload : 'encrypted'
    });
    return new TextEncoder().encode(data);
  }

  /**
   * Get verification statistics
   */
  getStats(): {
    verificationCount: number;
    failureCount: number;
    successRate: number;
    knownSenders: number;
    cachedNonces: number;
  } {
    return {
      verificationCount: this._verificationCount,
      failureCount: this._failureCount,
      successRate: this._verificationCount > 0
        ? (this._verificationCount - this._failureCount) / this._verificationCount
        : 0,
      knownSenders: this._knownSenders.size,
      cachedNonces: this._usedNonces.size
    };
  }

  // Getters
  get config(): VerifierConfig { return this._config; }
  get knownSenderCount(): number { return this._knownSenders.size; }

  equals(other: MessageVerifier): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const stats = this.getStats();
    return `MessageVerifier(${this.id}, senders=${stats.knownSenders}, success=${(stats.successRate * 100).toFixed(1)}%)`;
  }
}
