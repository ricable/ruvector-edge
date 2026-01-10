/**
 * Message Value Object
 *
 * Secure inter-agent message with signature, encryption, and replay protection.
 */

export interface EncryptedPayload {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly algorithm: 'AES-256-GCM';
}

export interface Ed25519Signature {
  readonly bytes: Uint8Array;
}

export interface PublicKey {
  readonly bytes: Uint8Array;
  readonly algorithm: 'Ed25519' | 'Dilithium';
}

export type UUID = string;
export type Nonce = string;
export type Timestamp = number;

export interface MessageHeader {
  readonly id: UUID;
  readonly senderId: string;
  readonly recipientId: string;
  readonly timestamp: Timestamp;
  readonly nonce: Nonce;
  readonly version: string;
}

/**
 * Message Value Object - Secure inter-agent communication
 */
export class Message {
  constructor(
    public readonly id: UUID,
    public readonly senderId: string,
    public readonly recipientId: string,
    public readonly payload: EncryptedPayload | string,
    public readonly signature: Ed25519Signature,
    public readonly timestamp: Timestamp,
    public readonly nonce: Nonce
  ) {
    Object.freeze(this);
  }

  /**
   * Create a new message
   */
  static create(
    senderId: string,
    recipientId: string,
    payload: EncryptedPayload | string,
    signature: Ed25519Signature
  ): Message {
    const id = Message.generateUUID();
    const nonce = Message.generateNonce();
    const timestamp = Date.now();

    return new Message(id, senderId, recipientId, payload, signature, timestamp, nonce);
  }

  /**
   * Verify message is valid (must also verify signature externally)
   */
  isValid(): { valid: boolean; reason?: string } {
    // Check timestamp window (5 minutes)
    if (!this.isWithinTimeWindow()) {
      return { valid: false, reason: 'Message timestamp outside 5-minute window' };
    }

    // Check nonce format
    if (!this.isNonceValid()) {
      return { valid: false, reason: 'Invalid nonce format' };
    }

    return { valid: true };
  }

  /**
   * Check if timestamp is within 5-minute window
   */
  isWithinTimeWindow(): boolean {
    const now = Date.now();
    const age = now - this.timestamp;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return age >= 0 && age <= maxAge;
  }

  /**
   * Check if nonce format is valid
   */
  isNonceValid(): boolean {
    return this.nonce.length >= 16;
  }

  /**
   * Check if payload is encrypted
   */
  isEncrypted(): boolean {
    return typeof this.payload !== 'string' && 'ciphertext' in this.payload;
  }

  /**
   * Get message header
   */
  getHeader(): MessageHeader {
    return {
      id: this.id,
      senderId: this.senderId,
      recipientId: this.recipientId,
      timestamp: this.timestamp,
      nonce: this.nonce,
      version: '1.0'
    };
  }

  /**
   * Generate UUID v4
   */
  private static generateUUID(): UUID {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate cryptographic nonce
   */
  private static generateNonce(): Nonce {
    const array = new Uint8Array(24);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for non-browser environments
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Value equality
   */
  equals(other: Message): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `Message(${this.id}, from=${this.senderId}, to=${this.recipientId})`;
  }

  toJSON(): object {
    return {
      id: this.id,
      senderId: this.senderId,
      recipientId: this.recipientId,
      timestamp: this.timestamp,
      nonce: this.nonce,
      isEncrypted: this.isEncrypted(),
      isValid: this.isValid().valid
    };
  }
}
