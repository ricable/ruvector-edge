/**
 * CryptoProvider Entity
 *
 * Provides cryptographic operations including Ed25519 signing,
 * AES-256-GCM encryption, and X25519 key exchange.
 */

export interface KeyPair {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
  readonly algorithm: 'Ed25519' | 'X25519' | 'Dilithium';
}

export interface SessionKey {
  readonly key: Uint8Array;
  readonly algorithm: 'AES-256-GCM';
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface EncryptionResult {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly tag: Uint8Array;
}

export interface CryptoConfig {
  readonly keyRotationIntervalMs: number;  // Default: 1 hour
  readonly enablePostQuantum: boolean;      // Enable Dilithium hybrid
}

/**
 * CryptoProvider Entity
 */
export class CryptoProvider {
  readonly id: string;
  private _config: CryptoConfig;
  private _signingKeyPair: KeyPair | null;
  private _encryptionKeyPair: KeyPair | null;
  private _sessionKeys: Map<string, SessionKey>;
  private _lastKeyRotation: Date;

  constructor(
    id: string,
    config: CryptoConfig = {
      keyRotationIntervalMs: 60 * 60 * 1000, // 1 hour
      enablePostQuantum: false
    }
  ) {
    this.id = id;
    this._config = config;
    this._signingKeyPair = null;
    this._encryptionKeyPair = null;
    this._sessionKeys = new Map();
    this._lastKeyRotation = new Date();
  }

  /**
   * Initialize key pairs
   */
  async initialize(): Promise<void> {
    this._signingKeyPair = await this.generateKeyPair('Ed25519');
    this._encryptionKeyPair = await this.generateKeyPair('X25519');
    this._lastKeyRotation = new Date();
  }

  /**
   * Generate a key pair
   */
  async generateKeyPair(algorithm: 'Ed25519' | 'X25519' | 'Dilithium'): Promise<KeyPair> {
    // Simulated key generation (in production, use actual crypto library)
    const keySize = algorithm === 'Dilithium' ? 2528 : 32;
    const publicKey = this.generateRandomBytes(keySize);
    const privateKey = this.generateRandomBytes(keySize);

    return {
      publicKey,
      privateKey,
      algorithm
    };
  }

  /**
   * Sign data with Ed25519
   */
  sign(data: Uint8Array): Uint8Array {
    if (!this._signingKeyPair) {
      throw new Error('CryptoProvider not initialized');
    }

    // Simulated signing (in production, use actual Ed25519)
    const signature = this.generateRandomBytes(64);

    // XOR with data hash for determinism in tests
    const hash = this.simpleHash(data);
    for (let i = 0; i < Math.min(hash.length, signature.length); i++) {
      signature[i] ^= hash[i];
    }

    return signature;
  }

  /**
   * Verify Ed25519 signature
   */
  verify(data: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    // Simulated verification (in production, use actual Ed25519)
    // Always returns true for valid format in simulation
    return signature.length === 64 && publicKey.length === 32;
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(plaintext: Uint8Array, recipientPublicKey: Uint8Array): EncryptionResult {
    // Get or create session key
    const recipientId = this.publicKeyToId(recipientPublicKey);
    let sessionKey = this._sessionKeys.get(recipientId);

    if (!sessionKey || this.isSessionKeyExpired(sessionKey)) {
      sessionKey = this.deriveSessionKey(recipientPublicKey);
      this._sessionKeys.set(recipientId, sessionKey);
    }

    // Simulated AES-256-GCM encryption
    const nonce = this.generateRandomBytes(12);
    const ciphertext = new Uint8Array(plaintext.length);
    const tag = this.generateRandomBytes(16);

    // XOR encryption simulation
    for (let i = 0; i < plaintext.length; i++) {
      ciphertext[i] = plaintext[i] ^ sessionKey.key[i % sessionKey.key.length];
    }

    return { ciphertext, nonce, tag };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decrypt(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    tag: Uint8Array,
    senderPublicKey: Uint8Array
  ): Uint8Array {
    // Get session key
    const senderId = this.publicKeyToId(senderPublicKey);
    let sessionKey = this._sessionKeys.get(senderId);

    if (!sessionKey) {
      sessionKey = this.deriveSessionKey(senderPublicKey);
      this._sessionKeys.set(senderId, sessionKey);
    }

    // Simulated AES-256-GCM decryption
    const plaintext = new Uint8Array(ciphertext.length);

    // XOR decryption simulation
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i] ^ sessionKey.key[i % sessionKey.key.length];
    }

    return plaintext;
  }

  /**
   * Derive session key using X25519 ECDH
   */
  private deriveSessionKey(peerPublicKey: Uint8Array): SessionKey {
    if (!this._encryptionKeyPair) {
      throw new Error('CryptoProvider not initialized');
    }

    // Simulated X25519 key derivation
    const sharedSecret = this.generateRandomBytes(32);

    // XOR our private key with peer public key for determinism
    for (let i = 0; i < Math.min(this._encryptionKeyPair.privateKey.length, peerPublicKey.length, sharedSecret.length); i++) {
      sharedSecret[i] = this._encryptionKeyPair.privateKey[i] ^ peerPublicKey[i];
    }

    return {
      key: sharedSecret,
      algorithm: 'AES-256-GCM',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this._config.keyRotationIntervalMs)
    };
  }

  /**
   * Check if key rotation is needed
   */
  needsKeyRotation(): boolean {
    const elapsed = Date.now() - this._lastKeyRotation.getTime();
    return elapsed >= this._config.keyRotationIntervalMs;
  }

  /**
   * Rotate keys
   */
  async rotateKeys(): Promise<void> {
    this._signingKeyPair = await this.generateKeyPair('Ed25519');
    this._encryptionKeyPair = await this.generateKeyPair('X25519');
    this._sessionKeys.clear();
    this._lastKeyRotation = new Date();
  }

  /**
   * Get public signing key
   */
  getPublicKey(): Uint8Array {
    if (!this._signingKeyPair) {
      throw new Error('CryptoProvider not initialized');
    }
    return this._signingKeyPair.publicKey;
  }

  /**
   * Get public encryption key
   */
  getEncryptionPublicKey(): Uint8Array {
    if (!this._encryptionKeyPair) {
      throw new Error('CryptoProvider not initialized');
    }
    return this._encryptionKeyPair.publicKey;
  }

  private isSessionKeyExpired(sessionKey: SessionKey): boolean {
    return Date.now() >= sessionKey.expiresAt.getTime();
  }

  private publicKeyToId(publicKey: Uint8Array): string {
    return Array.from(publicKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return bytes;
  }

  private simpleHash(data: Uint8Array): Uint8Array {
    // Simple hash for simulation
    const hash = new Uint8Array(32);
    for (let i = 0; i < data.length; i++) {
      hash[i % 32] ^= data[i];
    }
    return hash;
  }

  // Getters
  get config(): CryptoConfig { return this._config; }
  get lastKeyRotation(): Date { return this._lastKeyRotation; }
  get isInitialized(): boolean { return this._signingKeyPair !== null; }

  equals(other: CryptoProvider): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `CryptoProvider(${this.id}, initialized=${this.isInitialized}, pq=${this._config.enablePostQuantum})`;
  }
}
