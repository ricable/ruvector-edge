# ADR-007: Security and Cryptography Architecture

## Status
Accepted

## Context
The ELEX distributed agent swarm handles sensitive RAN configuration data and generates commands that directly modify network parameters. Security requirements:
- **Agent identity:** Each agent must prove its identity cryptographically
- **Message integrity:** All inter-agent messages must be tamper-proof
- **Confidentiality:** Sensitive payloads must be encrypted
- **Replay protection:** Old messages cannot be reused maliciously
- **Future-proofing:** Must prepare for quantum computing threats

Threat model includes:
- Malicious agents attempting to join the swarm
- Man-in-the-middle attacks on P2P transport
- Replay attacks using captured messages
- Quantum computers breaking current cryptography (future)

## Decision
We adopt a **multi-layer cryptographic architecture**:

### Layer 1: Agent Identity (Ed25519)
- Each agent generates Ed25519 keypair at initialization
- 32-byte private key, 32-byte public key
- Agent ID derived from public key hash
- FAJ code cryptographically bound to agent ID

### Layer 2: Message Signing (Ed25519)
Every message includes:
- UUID (unique identifier)
- Ed25519 signature
- Timestamp (5-minute validity window)
- Nonce (for replay protection)

### Layer 3: Payload Encryption (AES-256-GCM)
- Symmetric encryption for sensitive data
- 256-bit keys with authenticated encryption
- Session keys rotated hourly

### Layer 4: Key Exchange (X25519 ECDH)
- Ephemeral X25519 keys for session establishment
- Diffie-Hellman key agreement
- Perfect forward secrecy per session

### Layer 5: Post-Quantum Hybrid (Ed25519 + Dilithium)
- Hybrid signature scheme for future-proofing
- Both classical and post-quantum signatures
- Fallback to classical if quantum detection fails

## Consequences

### Positive
- **Strong identity:** Ed25519 provides 128-bit security level
- **Authenticated encryption:** AES-256-GCM prevents tampering and provides confidentiality
- **Forward secrecy:** Ephemeral keys protect past sessions if long-term key compromised
- **Replay protection:** Timestamp + nonce combination prevents message replay
- **Quantum ready:** Dilithium hybrid provides post-quantum security
- **Efficient:** Ed25519/X25519 are fast elliptic curve operations

### Negative
- **Complexity:** Multiple cryptographic layers increase implementation surface
- **Performance overhead:** Signature verification on every message adds latency
- **Key management:** Must securely store and rotate keys
- **Post-quantum size:** Dilithium signatures are larger (~2KB vs 64 bytes)

### Risks
- **Implementation bugs:** Cryptography is easy to implement incorrectly
- **Side-channel attacks:** Browser environment may leak timing information
- **Key compromise:** Single agent compromise allows impersonation
- **Clock skew:** Timestamp validation fails if clocks are unsynchronized

## Alternatives Considered

### RSA Signatures
- **Pros:** Widely understood, hardware support
- **Cons:** Larger keys (2048+ bits), slower than Ed25519, not quantum-resistant

### AES-256-CBC
- **Pros:** Simple, widely supported
- **Cons:** No authentication (need separate MAC), padding oracle vulnerabilities

### TLS 1.3 Only
- **Pros:** Standard protocol, handles everything
- **Cons:** Not available for all P2P transports, doesn't provide agent identity

### Pure Post-Quantum (Dilithium Only)
- **Pros:** Maximum quantum resistance
- **Cons:** Larger signatures, slower operations, newer and less audited

### No Encryption (Signed Only)
- **Pros:** Simpler, faster
- **Cons:** Exposes sensitive RAN configuration data to eavesdroppers

## References
- ELEX PRD Section: Security & Identity
- ELEX PRD Section: Edge Runtime (Security)
- ELEX PRD Section: Message Security
- ELEX PRD Section: 35 Critical Decisions (Byzantine Tolerance)
- NIST Post-Quantum Cryptography Standardization (Dilithium)
- libsodium documentation for Ed25519/X25519
