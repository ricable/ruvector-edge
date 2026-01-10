/**
 * AgentIdentity Aggregate Root
 *
 * Manages cryptographic identity for an agent including keypairs,
 * signing, encryption, and identity verification.
 */

import { Message, Ed25519Signature, PublicKey, EncryptedPayload } from '../value-objects/message';
import { CryptoProvider, KeyPair } from '../entities/crypto-provider';
import { MessageVerifier, VerificationResult } from '../entities/message-verifier';

export interface AgentIdentityConfig {
  readonly enablePostQuantum: boolean;
  readonly keyRotationIntervalMs: number;
  readonly autoRotate: boolean;
}

/**
 * Domain Events for AgentIdentity
 */
export interface IdentityCreated {
  readonly type: 'IdentityCreated';
  readonly agentId: string;
  readonly publicKey: string;
  readonly timestamp: Date;
}

export interface KeysRotated {
  readonly type: 'KeysRotated';
  readonly agentId: string;
  readonly newPublicKey: string;
  readonly timestamp: Date;
}

export interface MessageSigned {
  readonly type: 'MessageSigned';
  readonly agentId: string;
  readonly messageId: string;
  readonly timestamp: Date;
}

export interface MessageVerified {
  readonly type: 'MessageVerified';
  readonly agentId: string;
  readonly messageId: string;
  readonly valid: boolean;
  readonly timestamp: Date;
}

export type AgentIdentityEvent = IdentityCreated | KeysRotated | MessageSigned | MessageVerified;

/**
 * AgentIdentity Aggregate Root
 */
export class AgentIdentity {
  readonly agentId: string;
  private _cryptoProvider: CryptoProvider;
  private _messageVerifier: MessageVerifier;
  private _config: AgentIdentityConfig;
  private _initialized: boolean;
  private _createdAt: Date;
  private _events: AgentIdentityEvent[];

  private constructor(
    agentId: string,
    cryptoProvider: CryptoProvider,
    messageVerifier: MessageVerifier,
    config: AgentIdentityConfig
  ) {
    this.agentId = agentId;
    this._cryptoProvider = cryptoProvider;
    this._messageVerifier = messageVerifier;
    this._config = config;
    this._initialized = false;
    this._createdAt = new Date();
    this._events = [];
  }

  /**
   * Factory method
   */
  static create(agentId: string, config?: Partial<AgentIdentityConfig>): AgentIdentity {
    const fullConfig: AgentIdentityConfig = {
      enablePostQuantum: config?.enablePostQuantum ?? false,
      keyRotationIntervalMs: config?.keyRotationIntervalMs ?? 60 * 60 * 1000,
      autoRotate: config?.autoRotate ?? true
    };

    const cryptoProvider = new CryptoProvider(`crypto-${agentId}`, {
      keyRotationIntervalMs: fullConfig.keyRotationIntervalMs,
      enablePostQuantum: fullConfig.enablePostQuantum
    });

    const messageVerifier = new MessageVerifier(`verifier-${agentId}`);

    return new AgentIdentity(agentId, cryptoProvider, messageVerifier, fullConfig);
  }

  /**
   * Initialize identity (generates key pairs)
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      throw new Error('Identity already initialized');
    }

    await this._cryptoProvider.initialize();
    this._initialized = true;

    const publicKeyHex = this.publicKeyToHex(this._cryptoProvider.getPublicKey());

    this.raise({
      type: 'IdentityCreated',
      agentId: this.agentId,
      publicKey: publicKeyHex,
      timestamp: new Date()
    });
  }

  /**
   * Get public key for sharing with other agents
   */
  getPublicKey(): PublicKey {
    this.ensureInitialized();
    return {
      bytes: this._cryptoProvider.getPublicKey(),
      algorithm: 'Ed25519'
    };
  }

  /**
   * Get encryption public key
   */
  getEncryptionPublicKey(): PublicKey {
    this.ensureInitialized();
    return {
      bytes: this._cryptoProvider.getEncryptionPublicKey(),
      algorithm: 'Ed25519' // X25519 derived
    };
  }

  /**
   * Sign a message
   */
  signMessage(message: string | Uint8Array): Ed25519Signature {
    this.ensureInitialized();

    const data = typeof message === 'string'
      ? new TextEncoder().encode(message)
      : message;

    const signatureBytes = this._cryptoProvider.sign(data);

    return { bytes: signatureBytes };
  }

  /**
   * Create a signed message to send to another agent
   */
  createMessage(recipientId: string, payload: string): Message {
    this.ensureInitialized();

    const messageData = JSON.stringify({
      senderId: this.agentId,
      recipientId,
      payload,
      timestamp: Date.now()
    });

    const signature = this.signMessage(messageData);

    const message = Message.create(this.agentId, recipientId, payload, signature);

    this.raise({
      type: 'MessageSigned',
      agentId: this.agentId,
      messageId: message.id,
      timestamp: new Date()
    });

    return message;
  }

  /**
   * Create an encrypted message
   */
  createEncryptedMessage(recipientId: string, payload: string, recipientPublicKey: Uint8Array): Message {
    this.ensureInitialized();

    const plaintext = new TextEncoder().encode(payload);
    const encrypted = this._cryptoProvider.encrypt(plaintext, recipientPublicKey);

    const encryptedPayload: EncryptedPayload = {
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      algorithm: 'AES-256-GCM'
    };

    const messageData = JSON.stringify({
      senderId: this.agentId,
      recipientId,
      encrypted: true,
      timestamp: Date.now()
    });

    const signature = this.signMessage(messageData);

    return Message.create(this.agentId, recipientId, encryptedPayload, signature);
  }

  /**
   * Register a known peer for verification
   */
  registerPeer(peerId: string, publicKey: PublicKey): void {
    this._messageVerifier.registerSender(peerId, publicKey);
  }

  /**
   * Unregister a peer
   */
  unregisterPeer(peerId: string): void {
    this._messageVerifier.unregisterSender(peerId);
  }

  /**
   * Verify a message from another agent
   */
  verifyMessage(message: Message): VerificationResult {
    const result = this._messageVerifier.verify(message, (data, sig, pk) => {
      return this._cryptoProvider.verify(data, sig.bytes, pk.bytes);
    });

    this.raise({
      type: 'MessageVerified',
      agentId: this.agentId,
      messageId: message.id,
      valid: result.valid,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Decrypt a message payload
   */
  decryptPayload(encrypted: EncryptedPayload, senderPublicKey: Uint8Array): string {
    this.ensureInitialized();

    const plaintext = this._cryptoProvider.decrypt(
      encrypted.ciphertext,
      encrypted.nonce,
      new Uint8Array(16), // tag
      senderPublicKey
    );

    return new TextDecoder().decode(plaintext);
  }

  /**
   * Rotate keys if needed
   */
  async rotateKeysIfNeeded(): Promise<boolean> {
    if (!this._config.autoRotate) {
      return false;
    }

    if (this._cryptoProvider.needsKeyRotation()) {
      await this._cryptoProvider.rotateKeys();

      const newPublicKeyHex = this.publicKeyToHex(this._cryptoProvider.getPublicKey());

      this.raise({
        type: 'KeysRotated',
        agentId: this.agentId,
        newPublicKey: newPublicKeyHex,
        timestamp: new Date()
      });

      return true;
    }

    return false;
  }

  /**
   * Force key rotation
   */
  async forceKeyRotation(): Promise<void> {
    this.ensureInitialized();
    await this._cryptoProvider.rotateKeys();

    const newPublicKeyHex = this.publicKeyToHex(this._cryptoProvider.getPublicKey());

    this.raise({
      type: 'KeysRotated',
      agentId: this.agentId,
      newPublicKey: newPublicKeyHex,
      timestamp: new Date()
    });
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('AgentIdentity not initialized. Call initialize() first.');
    }
  }

  private publicKeyToHex(publicKey: Uint8Array): string {
    return Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private raise(event: AgentIdentityEvent): void {
    this._events.push(event);
  }

  // Getters
  get initialized(): boolean { return this._initialized; }
  get createdAt(): Date { return this._createdAt; }
  get config(): AgentIdentityConfig { return this._config; }
  get verifierStats() { return this._messageVerifier.getStats(); }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): AgentIdentityEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  equals(other: AgentIdentity): boolean {
    return this.agentId === other.agentId;
  }

  toString(): string {
    return `AgentIdentity(${this.agentId}, initialized=${this._initialized}, pq=${this._config.enablePostQuantum})`;
  }
}
