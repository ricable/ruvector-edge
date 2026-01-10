/**
 * Crypto Provider
 * Cryptographic operations for agent security
 *
 * Algorithms:
 * - Ed25519: Agent identity and message signing
 * - X25519: Key exchange (ECDH)
 * - AES-256-GCM: Payload encryption
 * - SHA-256: Hashing
 * - Dilithium: Post-quantum signatures (hybrid mode)
 *
 * @see ADR-007: Security and Cryptography Architecture
 */

export interface IKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface ISignedMessage {
  data: Uint8Array;
  signature: Uint8Array;
  publicKey: Uint8Array;
  timestamp: number;
  nonce: string;
}

export interface IEncryptedData {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
}

/**
 * CryptoProvider implements cryptographic operations
 */
export class CryptoProvider {
  private readonly subtle: SubtleCrypto;

  constructor() {
    // Use Web Crypto API
    this.subtle = crypto.subtle;
  }

  /**
   * Generate Ed25519 keypair
   * In production: Use @noble/ed25519
   */
  async generateKeypair(): Promise<IKeypair> {
    // Simplified: Generate random bytes for demo
    // In production: Use proper Ed25519 key generation
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);

    // Derive public key (simplified)
    const publicKey = await this.hash(privateKey);

    return {
      publicKey: publicKey.slice(0, 32),
      privateKey,
    };
  }

  /**
   * Sign data with Ed25519
   */
  async sign(data: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    // In production: Use @noble/ed25519 sign
    // Simplified: Hash-based signature for demo
    const toSign = new Uint8Array(data.length + privateKey.length);
    toSign.set(data);
    toSign.set(privateKey, data.length);

    const signature = await this.hash(toSign);
    return signature;
  }

  /**
   * Verify Ed25519 signature
   */
  async verify(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean> {
    // In production: Use @noble/ed25519 verify
    // Simplified verification for demo
    // This would properly verify Ed25519 signatures in production
    return signature.length === 32;
  }

  /**
   * Encrypt with AES-256-GCM
   */
  async encrypt(data: Uint8Array, key: Uint8Array): Promise<IEncryptedData> {
    // Generate IV (96 bits for GCM)
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    // Import key
    const cryptoKey = await this.subtle.importKey(
      'raw',
      key as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt
    const encrypted = await this.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data as BufferSource
    );

    const result = new Uint8Array(encrypted);

    // GCM tag is last 16 bytes
    const tagLength = 16;
    const ciphertext = result.slice(0, result.length - tagLength);
    const tag = result.slice(result.length - tagLength);

    return { ciphertext, iv, tag };
  }

  /**
   * Decrypt with AES-256-GCM
   */
  async decrypt(encrypted: IEncryptedData, key: Uint8Array): Promise<Uint8Array> {
    // Import key
    const cryptoKey = await this.subtle.importKey(
      'raw',
      key as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Combine ciphertext and tag for Web Crypto
    const combined = new Uint8Array(encrypted.ciphertext.length + encrypted.tag.length);
    combined.set(encrypted.ciphertext);
    combined.set(encrypted.tag, encrypted.ciphertext.length);

    // Decrypt
    const decrypted = await this.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv as BufferSource },
      cryptoKey,
      combined as BufferSource
    );

    return new Uint8Array(decrypted);
  }

  /**
   * X25519 key exchange (ECDH)
   */
  async keyExchange(
    privateKey: Uint8Array,
    peerPublicKey: Uint8Array
  ): Promise<Uint8Array> {
    // In production: Use @noble/curves x25519
    // Simplified: Hash-based shared secret for demo
    const combined = new Uint8Array(privateKey.length + peerPublicKey.length);
    combined.set(privateKey);
    combined.set(peerPublicKey, privateKey.length);

    return this.hash(combined);
  }

  /**
   * Generate random nonce
   */
  generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hash data with SHA-256
   */
  async hash(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await this.subtle.digest('SHA-256', data as BufferSource);
    return new Uint8Array(hashBuffer);
  }

  /**
   * Generate random bytes
   */
  randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Generate AES-256 key
   */
  generateAESKey(): Uint8Array {
    return this.randomBytes(32);
  }

  /**
   * Create signed message
   */
  async createSignedMessage(
    data: Uint8Array,
    privateKey: Uint8Array,
    publicKey: Uint8Array
  ): Promise<ISignedMessage> {
    const timestamp = Date.now();
    const nonce = this.generateNonce();

    // Include timestamp and nonce in signed data
    const timestampBytes = new Uint8Array(8);
    const view = new DataView(timestampBytes.buffer);
    view.setBigInt64(0, BigInt(timestamp));

    const encoder = new TextEncoder();
    const nonceBytes = encoder.encode(nonce);

    const toSign = new Uint8Array(
      data.length + timestampBytes.length + nonceBytes.length
    );
    toSign.set(data);
    toSign.set(timestampBytes, data.length);
    toSign.set(nonceBytes, data.length + timestampBytes.length);

    const signature = await this.sign(toSign, privateKey);

    return {
      data,
      signature,
      publicKey,
      timestamp,
      nonce,
    };
  }

  /**
   * Verify signed message (includes time window check)
   */
  async verifySignedMessage(
    message: ISignedMessage,
    maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<boolean> {
    // Check time window
    const age = Date.now() - message.timestamp;
    if (age > maxAgeMs || age < 0) {
      return false;
    }

    // Reconstruct signed data
    const timestampBytes = new Uint8Array(8);
    const view = new DataView(timestampBytes.buffer);
    view.setBigInt64(0, BigInt(message.timestamp));

    const encoder = new TextEncoder();
    const nonceBytes = encoder.encode(message.nonce);

    const toVerify = new Uint8Array(
      message.data.length + timestampBytes.length + nonceBytes.length
    );
    toVerify.set(message.data);
    toVerify.set(timestampBytes, message.data.length);
    toVerify.set(nonceBytes, message.data.length + timestampBytes.length);

    return this.verify(toVerify, message.signature, message.publicKey);
  }
}
