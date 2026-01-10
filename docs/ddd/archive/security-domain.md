# Security Bounded Context

## Purpose

The Security Context provides cryptographic identity, message authentication, and secure communication for the 593-agent swarm. It implements Ed25519 for signatures, X25519 for key exchange, AES-256-GCM for encryption, and prepares for post-quantum security with Dilithium hybrid signatures.

---

## Domain Model

```
+------------------------------------------------------------------+
|                     SECURITY BOUNDED CONTEXT                      |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+                                      |
|  |     AgentIdentity      |  <-- Aggregate Root                  |
|  |      (Aggregate)       |                                      |
|  +------------------------+                                      |
|  | - identityId: IdentId  |                                      |
|  | - publicKey: Ed25519   |                                      |
|  | - privateKey: Ed25519  |                                      |
|  | - certificate: Cert    |                                      |
|  | - sessions: Session[]  |                                      |
|  +------------------------+                                      |
|           |                                                      |
|           | manages                                              |
|           v                                                      |
|  +------------------------+     +------------------------+       |
|  |    CryptoProvider      |     |   MessageVerifier      |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - providerId: ProvId   |     | - verifierId: VerId    |       |
|  | - algorithms: Algo[]   |     | - trustedKeys: PubKey[]|       |
|  | - keyStore: KeyStore   |     | - revokedKeys: PubKey[]|       |
|  | - rng: SecureRandom    |     | - verifyCache: Cache   |       |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  +------------------------+     +------------------------+       |
|  |    SessionManager      |     |   TrustChainValidator  |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - managerId: MgrId     |     | - validatorId: ValId   |       |
|  | - activeSessions: Map  |     | - rootCerts: Cert[]    |       |
|  | - sessionTimeout: ms   |     | - crlList: CRL[]       |       |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  +---------------+  +---------------+  +---------------+         |
|  |    Message    |  |   Signature   |  |  SessionKey   |         |
|  |  (Value Obj)  |  |  (Value Obj)  |  |  (Value Obj)  |         |
|  +---------------+  +---------------+  +---------------+         |
|  | - payload     |  | - algorithm   |  | - key: bytes  |         |
|  | - signature   |  | - value: bytes|  | - expiresAt   |         |
|  | - sender      |  | - publicKey   |  | - nonce       |         |
|  +---------------+  +---------------+  +---------------+         |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Cryptographic Algorithms

| Purpose | Algorithm | Key Size | Notes |
|---------|-----------|----------|-------|
| **Signatures** | Ed25519 | 256-bit | Fast, secure, deterministic |
| **Key Exchange** | X25519 | 256-bit | Curve25519 ECDH |
| **Encryption** | AES-256-GCM | 256-bit | Authenticated encryption |
| **Hashing** | SHA-256/SHA-512 | 256/512-bit | For message digests |
| **KDF** | HKDF-SHA256 | Variable | Key derivation |
| **Post-Quantum** | Dilithium3 | ~2KB | Hybrid with Ed25519 |

---

## Aggregates

### AgentIdentity (Aggregate Root)

The cryptographic identity for each agent in the swarm.

```typescript
class AgentIdentity {
  private readonly identityId: IdentityId;
  private readonly publicKey: Ed25519PublicKey;
  private readonly privateKey: Ed25519PrivateKey;
  private certificate: Certificate | null;
  private sessions: Map<AgentId, Session>;
  private dilithiumKeys: DilithiumKeyPair | null;

  // Factory - Generate new identity
  static generate(): AgentIdentity {
    const keyPair = Ed25519.generateKeyPair();

    const identity = new AgentIdentity(
      IdentityId.generate(),
      keyPair.publicKey,
      keyPair.privateKey,
      null,
      new Map(),
      null
    );

    identity.raise(new IdentityCreated(identity.identityId, keyPair.publicKey));
    return identity;
  }

  // Factory - Restore from storage
  static fromStorage(data: StoredIdentity): AgentIdentity;

  // Signing
  sign(message: Uint8Array): Signature {
    const signatureBytes = Ed25519.sign(message, this.privateKey);

    return new Signature(
      'Ed25519',
      signatureBytes,
      this.publicKey
    );
  }

  // Hybrid post-quantum signing
  signHybrid(message: Uint8Array): HybridSignature {
    if (!this.dilithiumKeys) {
      throw new PostQuantumNotEnabledError();
    }

    const ed25519Sig = Ed25519.sign(message, this.privateKey);
    const dilithiumSig = Dilithium.sign(message, this.dilithiumKeys.privateKey);

    return new HybridSignature(ed25519Sig, dilithiumSig);
  }

  // Key Exchange
  deriveSharedSecret(otherPublicKey: X25519PublicKey): SharedSecret {
    const x25519Private = Ed25519.toX25519Private(this.privateKey);
    const sharedSecret = X25519.deriveSharedSecret(x25519Private, otherPublicKey);

    return new SharedSecret(sharedSecret);
  }

  // Session Management
  establishSession(otherAgent: AgentId, otherPublicKey: X25519PublicKey): Session {
    const sharedSecret = this.deriveSharedSecret(otherPublicKey);
    const sessionKey = HKDF.derive(
      sharedSecret.bytes,
      32,
      `session:${this.identityId}:${otherAgent}`
    );

    const session = new Session(
      SessionId.generate(),
      otherAgent,
      new SessionKey(sessionKey, Date.now() + 3600000), // 1 hour
      new Nonce()
    );

    this.sessions.set(otherAgent, session);
    this.raise(new SessionEstablished(this.identityId, otherAgent));

    return session;
  }

  getSession(otherAgent: AgentId): Session | undefined {
    const session = this.sessions.get(otherAgent);
    if (session && session.isExpired()) {
      this.sessions.delete(otherAgent);
      return undefined;
    }
    return session;
  }

  terminateSession(otherAgent: AgentId): void {
    this.sessions.delete(otherAgent);
    this.raise(new SessionTerminated(this.identityId, otherAgent));
  }

  // Certificate Management
  setCertificate(cert: Certificate): void {
    if (!cert.isValidFor(this.publicKey)) {
      throw new CertificateMismatchError();
    }
    this.certificate = cert;
  }

  getCertificate(): Certificate | null {
    return this.certificate;
  }

  // Post-Quantum Upgrade
  enablePostQuantum(): void {
    this.dilithiumKeys = Dilithium.generateKeyPair();
    this.raise(new PostQuantumEnabled(this.identityId));
  }

  // Serialization
  getPublicIdentity(): PublicIdentity {
    return {
      identityId: this.identityId,
      publicKey: this.publicKey,
      certificate: this.certificate,
      dilithiumPublicKey: this.dilithiumKeys?.publicKey ?? null,
    };
  }

  // Domain Events
  raise(event: SecurityDomainEvent): void;
}
```

---

## Entities

### CryptoProvider

Provides cryptographic operations for the security context.

```typescript
class CryptoProvider {
  private readonly providerId: CryptoProviderId;
  private algorithms: Map<string, CryptoAlgorithm>;
  private keyStore: KeyStore;
  private rng: SecureRandom;

  // Factory
  static create(config: CryptoConfig): CryptoProvider {
    const provider = new CryptoProvider(
      CryptoProviderId.generate(),
      new Map(),
      new KeyStore(config.keyStorePath),
      new SecureRandom()
    );

    // Register algorithms
    provider.registerAlgorithm('Ed25519', new Ed25519Algorithm());
    provider.registerAlgorithm('X25519', new X25519Algorithm());
    provider.registerAlgorithm('AES-256-GCM', new AESGCMAlgorithm());
    provider.registerAlgorithm('SHA-256', new SHA256Algorithm());

    if (config.postQuantumEnabled) {
      provider.registerAlgorithm('Dilithium3', new DilithiumAlgorithm());
    }

    return provider;
  }

  // Algorithm Management
  registerAlgorithm(name: string, algorithm: CryptoAlgorithm): void {
    this.algorithms.set(name, algorithm);
  }

  getAlgorithm(name: string): CryptoAlgorithm {
    const algo = this.algorithms.get(name);
    if (!algo) {
      throw new UnsupportedAlgorithmError(name);
    }
    return algo;
  }

  // Key Generation
  generateKeyPair(algorithm: string): KeyPair {
    const algo = this.getAlgorithm(algorithm);
    return algo.generateKeyPair(this.rng);
  }

  generateSymmetricKey(bits: number = 256): SymmetricKey {
    const keyBytes = this.rng.getRandomBytes(bits / 8);
    return new SymmetricKey(keyBytes);
  }

  // Encryption
  encrypt(
    plaintext: Uint8Array,
    key: SymmetricKey,
    associatedData?: Uint8Array
  ): EncryptedData {
    const algo = this.getAlgorithm('AES-256-GCM') as AESGCMAlgorithm;
    const nonce = this.rng.getRandomBytes(12);

    const { ciphertext, tag } = algo.encrypt(plaintext, key.bytes, nonce, associatedData);

    return new EncryptedData(ciphertext, nonce, tag);
  }

  decrypt(
    encrypted: EncryptedData,
    key: SymmetricKey,
    associatedData?: Uint8Array
  ): Uint8Array {
    const algo = this.getAlgorithm('AES-256-GCM') as AESGCMAlgorithm;
    return algo.decrypt(
      encrypted.ciphertext,
      key.bytes,
      encrypted.nonce,
      encrypted.tag,
      associatedData
    );
  }

  // Signing
  sign(message: Uint8Array, privateKey: PrivateKey): Uint8Array {
    const algo = this.getAlgorithm('Ed25519') as Ed25519Algorithm;
    return algo.sign(message, privateKey.bytes);
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: PublicKey): boolean {
    const algo = this.getAlgorithm('Ed25519') as Ed25519Algorithm;
    return algo.verify(message, signature, publicKey.bytes);
  }

  // Hashing
  hash(data: Uint8Array, algorithm: string = 'SHA-256'): Uint8Array {
    const algo = this.getAlgorithm(algorithm);
    return algo.hash(data);
  }

  // Key Derivation
  deriveKey(
    sharedSecret: Uint8Array,
    length: number,
    info: string
  ): Uint8Array {
    return HKDF.derive(sharedSecret, length, info);
  }

  // Secure Random
  getRandomBytes(length: number): Uint8Array {
    return this.rng.getRandomBytes(length);
  }
}
```

### MessageVerifier

Verifies message signatures and manages trust.

```typescript
class MessageVerifier {
  private readonly verifierId: MessageVerifierId;
  private trustedKeys: Map<IdentityId, PublicKey>;
  private revokedKeys: Set<string>;
  private verifyCache: LRUCache<string, boolean>;
  private trustChainValidator: TrustChainValidator;

  // Factory
  static create(config: VerifierConfig): MessageVerifier;

  // Key Trust Management
  trustKey(identityId: IdentityId, publicKey: PublicKey): void {
    this.trustedKeys.set(identityId, publicKey);
  }

  untrustKey(identityId: IdentityId): void {
    this.trustedKeys.delete(identityId);
  }

  revokeKey(publicKey: PublicKey): void {
    this.revokedKeys.add(publicKey.toHex());
    this.invalidateCache(publicKey);
  }

  isKeyTrusted(publicKey: PublicKey): boolean {
    if (this.revokedKeys.has(publicKey.toHex())) {
      return false;
    }

    for (const trusted of this.trustedKeys.values()) {
      if (trusted.equals(publicKey)) {
        return true;
      }
    }

    return false;
  }

  // Message Verification
  verify(message: SignedMessage): VerificationResult {
    const cacheKey = this.computeCacheKey(message);

    // Check cache
    const cached = this.verifyCache.get(cacheKey);
    if (cached !== undefined) {
      return { valid: cached, fromCache: true };
    }

    // Verify signature
    const signatureValid = Ed25519.verify(
      message.payload,
      message.signature.bytes,
      message.signature.publicKey
    );

    if (!signatureValid) {
      this.verifyCache.set(cacheKey, false);
      return { valid: false, reason: 'invalid_signature' };
    }

    // Check trust
    if (!this.isKeyTrusted(message.signature.publicKey)) {
      return { valid: false, reason: 'untrusted_key' };
    }

    // Check certificate if present
    if (message.certificate) {
      const certResult = this.trustChainValidator.validate(message.certificate);
      if (!certResult.valid) {
        return { valid: false, reason: 'invalid_certificate', details: certResult };
      }
    }

    this.verifyCache.set(cacheKey, true);
    return { valid: true };
  }

  // Batch Verification
  async verifyBatch(messages: SignedMessage[]): Promise<BatchVerificationResult> {
    const results = await Promise.all(
      messages.map(msg => this.verify(msg))
    );

    return {
      total: messages.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      results,
    };
  }

  // Hybrid Post-Quantum Verification
  verifyHybrid(message: SignedMessage, hybridSig: HybridSignature): VerificationResult {
    // Verify Ed25519 signature
    const ed25519Valid = Ed25519.verify(
      message.payload,
      hybridSig.ed25519Signature,
      message.signature.publicKey
    );

    // Verify Dilithium signature
    const dilithiumValid = Dilithium.verify(
      message.payload,
      hybridSig.dilithiumSignature,
      message.dilithiumPublicKey
    );

    // Both must be valid for hybrid verification
    return {
      valid: ed25519Valid && dilithiumValid,
      ed25519Valid,
      dilithiumValid,
    };
  }

  private computeCacheKey(message: SignedMessage): string {
    return SHA256.hash(
      `${message.signature.toHex()}:${message.payload.length}`
    );
  }

  private invalidateCache(publicKey: PublicKey): void {
    // Clear cache entries related to this key
    // (simplified - real implementation would track key-cache associations)
    this.verifyCache.clear();
  }
}

interface VerificationResult {
  valid: boolean;
  reason?: string;
  fromCache?: boolean;
  ed25519Valid?: boolean;
  dilithiumValid?: boolean;
}
```

### SessionManager

Manages encrypted communication sessions between agents.

```typescript
class SessionManager {
  private readonly managerId: SessionManagerId;
  private activeSessions: Map<string, Session>;
  private sessionTimeout: number;
  private maxSessionsPerAgent: number;

  // Factory
  static create(config: SessionConfig): SessionManager;

  // Session Lifecycle
  createSession(
    localIdentity: AgentIdentity,
    remoteIdentity: PublicIdentity
  ): Session {
    const sessionKey = this.performKeyExchange(localIdentity, remoteIdentity);

    const session = new Session(
      SessionId.generate(),
      remoteIdentity.identityId,
      sessionKey,
      new Nonce(),
      Date.now() + this.sessionTimeout
    );

    const key = this.sessionKey(localIdentity.identityId, remoteIdentity.identityId);
    this.activeSessions.set(key, session);

    return session;
  }

  getSession(localId: IdentityId, remoteId: IdentityId): Session | undefined {
    const key = this.sessionKey(localId, remoteId);
    const session = this.activeSessions.get(key);

    if (session && session.isExpired()) {
      this.activeSessions.delete(key);
      return undefined;
    }

    return session;
  }

  refreshSession(session: Session): Session {
    session.refresh(this.sessionTimeout);
    return session;
  }

  terminateSession(localId: IdentityId, remoteId: IdentityId): void {
    const key = this.sessionKey(localId, remoteId);
    const session = this.activeSessions.get(key);

    if (session) {
      session.zeroize(); // Secure memory wipe
      this.activeSessions.delete(key);
    }
  }

  // Message Encryption/Decryption
  encryptMessage(session: Session, plaintext: Uint8Array): EncryptedMessage {
    const nonce = session.nextNonce();
    const associatedData = this.buildAssociatedData(session);

    const encrypted = AES256GCM.encrypt(
      plaintext,
      session.key.bytes,
      nonce.bytes,
      associatedData
    );

    return new EncryptedMessage(
      encrypted.ciphertext,
      encrypted.tag,
      nonce,
      session.sessionId
    );
  }

  decryptMessage(session: Session, encrypted: EncryptedMessage): Uint8Array {
    const associatedData = this.buildAssociatedData(session);

    if (!session.validateNonce(encrypted.nonce)) {
      throw new NonceReuseError();
    }

    return AES256GCM.decrypt(
      encrypted.ciphertext,
      session.key.bytes,
      encrypted.nonce.bytes,
      encrypted.tag,
      associatedData
    );
  }

  // Cleanup
  cleanupExpiredSessions(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        session.zeroize();
        this.activeSessions.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  private performKeyExchange(
    local: AgentIdentity,
    remote: PublicIdentity
  ): SessionKey {
    const sharedSecret = local.deriveSharedSecret(
      Ed25519.toX25519Public(remote.publicKey)
    );

    const keyMaterial = HKDF.derive(
      sharedSecret.bytes,
      32,
      `session:${local.identityId}:${remote.identityId}`
    );

    return new SessionKey(keyMaterial, Date.now() + this.sessionTimeout);
  }

  private sessionKey(local: IdentityId, remote: IdentityId): string {
    return `${local}:${remote}`;
  }

  private buildAssociatedData(session: Session): Uint8Array {
    return new TextEncoder().encode(
      `session:${session.sessionId}:${session.remoteAgent}`
    );
  }
}
```

---

## Value Objects

### Message

A message with payload and cryptographic metadata.

```typescript
class Message {
  readonly messageId: MessageId;
  readonly payload: Uint8Array;
  readonly sender: IdentityId;
  readonly recipient: IdentityId;
  readonly timestamp: Date;
  readonly signature: Signature | null;

  constructor(
    payload: Uint8Array,
    sender: IdentityId,
    recipient: IdentityId,
    signature?: Signature
  ) {
    this.messageId = MessageId.generate();
    this.payload = payload;
    this.sender = sender;
    this.recipient = recipient;
    this.timestamp = new Date();
    this.signature = signature ?? null;
  }

  sign(identity: AgentIdentity): SignedMessage {
    const signature = identity.sign(this.payload);
    return new SignedMessage(this, signature);
  }

  toBytes(): Uint8Array {
    // Serialize message for signing/transmission
    const encoder = new TextEncoder();
    const header = encoder.encode(
      JSON.stringify({
        messageId: this.messageId.value,
        sender: this.sender.value,
        recipient: this.recipient.value,
        timestamp: this.timestamp.toISOString(),
      })
    );

    const result = new Uint8Array(header.length + 4 + this.payload.length);
    result.set(header, 0);
    new DataView(result.buffer).setUint32(header.length, this.payload.length);
    result.set(this.payload, header.length + 4);

    return result;
  }

  equals(other: Message): boolean {
    return this.messageId.equals(other.messageId);
  }
}

class SignedMessage extends Message {
  readonly signature: Signature;

  constructor(message: Message, signature: Signature) {
    super(message.payload, message.sender, message.recipient);
    this.signature = signature;
  }
}
```

### Signature

Cryptographic signature with algorithm metadata.

```typescript
class Signature {
  readonly algorithm: SignatureAlgorithm;
  readonly bytes: Uint8Array;
  readonly publicKey: PublicKey;

  constructor(algorithm: SignatureAlgorithm, bytes: Uint8Array, publicKey: PublicKey) {
    if (bytes.length !== this.getExpectedLength(algorithm)) {
      throw new InvalidSignatureLengthError(algorithm, bytes.length);
    }
    this.algorithm = algorithm;
    this.bytes = bytes;
    this.publicKey = publicKey;
  }

  private getExpectedLength(algorithm: SignatureAlgorithm): number {
    switch (algorithm) {
      case 'Ed25519': return 64;
      case 'Dilithium3': return 3293;
      default: throw new UnsupportedAlgorithmError(algorithm);
    }
  }

  toHex(): string {
    return Array.from(this.bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static fromHex(hex: string, algorithm: SignatureAlgorithm, publicKey: PublicKey): Signature {
    const bytes = new Uint8Array(
      hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    return new Signature(algorithm, bytes, publicKey);
  }

  equals(other: Signature): boolean {
    return this.algorithm === other.algorithm &&
           this.bytes.length === other.bytes.length &&
           this.bytes.every((b, i) => b === other.bytes[i]);
  }
}

type SignatureAlgorithm = 'Ed25519' | 'Dilithium3';
```

### SessionKey

Symmetric key for encrypted session communication.

```typescript
class SessionKey {
  readonly bytes: Uint8Array;
  readonly expiresAt: number;
  private nonce: bigint;

  constructor(bytes: Uint8Array, expiresAt: number) {
    if (bytes.length !== 32) {
      throw new InvalidKeyLengthError(256, bytes.length * 8);
    }
    this.bytes = bytes;
    this.expiresAt = expiresAt;
    this.nonce = BigInt(0);
  }

  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  nextNonce(): Nonce {
    this.nonce++;
    return Nonce.fromBigInt(this.nonce);
  }

  validateNonce(nonce: Nonce): boolean {
    // Prevent nonce reuse (replay attacks)
    const nonceValue = nonce.toBigInt();
    return nonceValue > this.nonce - BigInt(1000) && nonceValue <= this.nonce;
  }

  zeroize(): void {
    // Secure memory wipe
    this.bytes.fill(0);
  }

  equals(other: SessionKey): boolean {
    return this.bytes.every((b, i) => b === other.bytes[i]);
  }
}

class Nonce {
  readonly bytes: Uint8Array;

  constructor(bytes?: Uint8Array) {
    this.bytes = bytes ?? crypto.getRandomValues(new Uint8Array(12));
  }

  static fromBigInt(value: bigint): Nonce {
    const bytes = new Uint8Array(12);
    for (let i = 0; i < 8; i++) {
      bytes[11 - i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
    }
    return new Nonce(bytes);
  }

  toBigInt(): bigint {
    let value = BigInt(0);
    for (let i = 0; i < 8; i++) {
      value |= BigInt(this.bytes[11 - i]) << BigInt(i * 8);
    }
    return value;
  }
}
```

---

## Domain Events

```typescript
// Identity Events
interface IdentityCreated extends DomainEvent {
  type: 'IdentityCreated';
  identityId: string;
  publicKey: string;
  timestamp: Date;
}

interface IdentityRevoked extends DomainEvent {
  type: 'IdentityRevoked';
  identityId: string;
  reason: string;
  revokedBy: string;
}

interface PostQuantumEnabled extends DomainEvent {
  type: 'PostQuantumEnabled';
  identityId: string;
  dilithiumPublicKey: string;
}

// Session Events
interface SessionEstablished extends DomainEvent {
  type: 'SessionEstablished';
  localIdentity: string;
  remoteIdentity: string;
  sessionId: string;
  expiresAt: number;
}

interface SessionTerminated extends DomainEvent {
  type: 'SessionTerminated';
  localIdentity: string;
  remoteIdentity: string;
  reason: 'explicit' | 'expired' | 'error';
}

// Verification Events
interface MessageVerified extends DomainEvent {
  type: 'MessageVerified';
  messageId: string;
  senderId: string;
  valid: boolean;
  algorithm: string;
}

interface SignatureRejected extends DomainEvent {
  type: 'SignatureRejected';
  messageId: string;
  senderId: string;
  reason: 'invalid_signature' | 'untrusted_key' | 'revoked_key';
}

// Security Events
interface SecurityThreatDetected extends DomainEvent {
  type: 'SecurityThreatDetected';
  threatType: 'replay_attack' | 'nonce_reuse' | 'key_compromise';
  sourceIdentity: string;
  details: object;
}
```

---

## Post-Quantum Security

### Hybrid Signature Scheme

```
+------------------------------------------+
|         HYBRID SIGNATURE SCHEME          |
+------------------------------------------+
|                                          |
|  Message M                               |
|     |                                    |
|     +--> Ed25519.sign(M) --> sig_ed      |
|     |                                    |
|     +--> Dilithium.sign(M) --> sig_dil   |
|                                          |
|  HybridSig = sig_ed || sig_dil           |
|                                          |
|  Verification:                           |
|    valid = Ed25519.verify(M, sig_ed)     |
|         && Dilithium.verify(M, sig_dil)  |
|                                          |
+------------------------------------------+
```

### Why Hybrid?

1. **Backward Compatibility**: Ed25519 works with existing systems
2. **Future-Proofing**: Dilithium provides quantum resistance
3. **Defense in Depth**: Both must be broken to forge signatures
4. **Gradual Migration**: Can phase out Ed25519 when confident

---

## Security Threat Model

| Threat | Mitigation |
|--------|------------|
| **Man-in-the-Middle** | X25519 key exchange, mutual authentication |
| **Replay Attacks** | Nonces, timestamps, message counters |
| **Key Compromise** | Key rotation, certificate revocation |
| **Quantum Attacks** | Dilithium hybrid signatures |
| **Side-Channel** | Constant-time implementations |
| **Byzantine Agents** | Threshold signatures, consensus |

---

## Key Management

### Key Hierarchy

```
+------------------------------------------+
|            KEY HIERARCHY                 |
+------------------------------------------+
|                                          |
|  Root Key (HSM-protected)                |
|     |                                    |
|     +--> Coordinator Keys                |
|     |       |                            |
|     |       +--> Worker Agent Keys       |
|     |                                    |
|     +--> Session Keys (ephemeral)        |
|                                          |
+------------------------------------------+
```

### Key Rotation Policy

| Key Type | Rotation Period | Trigger |
|----------|-----------------|---------|
| Root Key | 1 year | Manual |
| Coordinator Key | 30 days | Automatic |
| Agent Key | 7 days | Automatic |
| Session Key | 1 hour | Per session |

---

## Invariants

1. **Key Uniqueness**: Each identity has unique key pair
2. **Nonce Uniqueness**: Nonces never reused in same session
3. **Signature Validity**: Messages must have valid signatures
4. **Trust Chain**: Keys must be traceable to trusted root
5. **Session Isolation**: Sessions are independent and isolated
6. **Secure Deletion**: Keys are zeroized when no longer needed
