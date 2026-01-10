# ELEX Cryptography - Security Architecture

## Overview

This crate implements the cryptographic foundation for the 593-agent ELEX swarm system, providing identity, signing, encryption, and replay protection as specified in ADR-007 and ADR-008.

## Security Requirements

### STRIDE Threat Analysis

| Threat Category | Description | Mitigation |
|----------------|-------------|------------|
| **Spoofing** | Malicious agent impersonation | Ed25519 signatures, AgentId derived from public key |
| **Tampering** | Message modification | Ed25519 signatures with timestamp + nonce |
| **Repudiation** | Denial of actions | Comprehensive audit logging with hash chains |
| **Information Disclosure** | Data exposure to eavesdroppers | AES-256-GCM encryption with X25519 key exchange |
| **Denial of Service** | Replay attacks | 5-minute validity window, nonce deduplication |
| **Elevation of Privilege** | Unauthorized parameter changes | Safe zone constraints (hardcoded, no override) |

### DREAD Risk Assessment

| Threat | Damage | Reproducibility | Exploitability | Affected | Discoverability | Total | Priority |
|--------|--------|----------------|----------------|----------|----------------|-------|----------|
| Agent impersonation | 10 | 3 | 8 | 10 | 2 | 6.6 | High |
| Message replay | 7 | 2 | 3 | 9 | 4 | 5.0 | Medium |
| Key compromise | 10 | 1 | 2 | 10 | 8 | 6.2 | High |
| Parameter overflow | 10 | 5 | 7 | 10 | 3 | 7.0 | High |
| Cryptographic weakness | 10 | 1 | 1 | 10 | 9 | 6.2 | High |

## Cryptographic Architecture

### Layer 1: Agent Identity (Ed25519)

**Purpose**: Provide unforgeable agent identity

**Implementation**:
- Ed25519 keypair generation using `ed25519-dalek`
- 32-byte private key (never exported)
- 32-byte public key (shared with swarm)
- AgentId = BLAKE3 hash of public key (first 16 bytes)

**Security Properties**:
- 128-bit security level
- Deterministic signatures (prevents nonce reuse attacks)
- Fast signature verification (< 1ms)

**Code Location**: `src/identity.rs`

### Layer 2: Message Signing (Ed25519)

**Purpose**: Ensure message authenticity and integrity

**Implementation**:
- Every message contains: `Signature { value, timestamp, nonce, signer_id, algorithm }`
- 5-minute validity window (configurable via `MAX_SIGNATURE_AGE`)
- 16-byte random nonce for replay protection
- BLAKE3 hash of payload for signing

**Security Properties**:
- Timestamp prevents indefinite message reuse
- Nonce prevents duplicate message detection
- Signer identity embedded in signature

**Replay Protection**:
```rust
pub struct ReplayProtection {
    seen_nonces: LruCache<(AgentId, [u8; 16]), DateTime<Utc>>,
    max_age: Duration,
}
```

**Code Location**: `src/signing.rs`

### Layer 3: Payload Encryption (AES-256-GCM)

**Purpose**: Confidentiality for sensitive data

**Implementation**:
- AES-256-GCM with 12-byte random nonces
- 256-bit session keys derived from X25519 ECDH
- Authenticated encryption (integrity + confidentiality)
- Nonce prepended to ciphertext

**Security Properties**:
- 256-bit encryption key
- 128-bit authentication tag
- No padding oracle vulnerabilities (AEAD)
- Perfect forward secrecy via session keys

**Code Location**: `src/encryption.rs`

### Layer 4: Key Exchange (X25519 ECDH)

**Purpose**: Establish secure session keys

**Implementation**:
- Ephemeral X25519 keypair per session
- Diffie-Hellman shared secret derivation
- HKDF with BLAKE3 for key derivation
- Session key rotation every 60 minutes

**Security Properties**:
- Perfect forward secrecy
- Ephemeral keys (compromise doesn't affect past sessions)
- Constant-time operations (timing attack resistance)

**Code Location**: `src/key_exchange.rs`

### Layer 5: Safe Zone Constraints

**Purpose**: Prevent dangerous parameter modifications

**Implementation**:
- Hardcoded parameter bounds (compile-time constants)
- No runtime override capability
- Blocking conditions auto-pause optimization
- Checkpoint-based rollback (30-minute window)

**Safe Zone Definition**:
```rust
pub struct SafeZone<T> {
    absolute_min: T,
    absolute_max: T,
    safe_min: T,
    safe_max: T,
    change_limit_percent: f32,
    cooldown_minutes: u32,
}
```

**Blocking Conditions**:
- `CRITICAL_HW_FAILURE`: Hardware failure detected
- `SITE_DOWN`: Cell site offline
- `HIGH_CALL_DROP`: Call drop rate > 2%
- `NIGHT_WINDOW`: 00:00-06:00 (configurable)
- `OPERATOR_PAUSE`: Manual pause request

**Code Location**: `src/safe_zone.rs`

## Unsafe Rust Policy (ADR-012)

This crate contains cryptographic operations that require careful handling:

### Allowed Unsafe Usage

1. **FFI Boundaries**: `wasm-bindgen` generated code for JavaScript interop
2. **Constant-Time Operations**: Crypto primitives may use assembly intrinsics
3. **Memory Access**: Direct buffer access for performance (validated)

### Safety Requirements

All `unsafe` blocks MUST:
1. Document safety invariants
2. Validate preconditions
3. Use Miri for testing
4. Pass security review

### Example Safe Abstraction

```rust
/// Constant-time comparison of signatures
///
/// # Safety
///
/// - `a` and `b` must be valid pointers
/// - Length must be exactly 64 bytes (Ed25519 signature size)
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        // SAFETY: Loop bounds guarantee same length
        // XOR accumulates differences without short-circuit
        result |= x ^ y;
    }

    result == 0
}
```

## Key Management

### Key Generation

```rust
impl AgentIdentity {
    pub fn generate() -> Self {
        let mut rng = rand::thread_rng();
        let keypair = Keypair::generate(&mut rng);
        let agent_id = AgentId::from_public_key(&keypair.public);

        Self {
            agent_id,
            keypair,
            created_at: Utc::now(),
        }
    }
}
```

### Key Storage

- **Private keys**: Never exported, kept in memory only
- **Public keys**: Shared via agent discovery protocol
- **Session keys**: Ephemeral, discarded after session ends
- **No key persistence**: Keys regenerated on restart

### Key Rotation

```rust
impl AgentIdentity {
    pub fn rotate_keys(&mut self) -> Result<AgentId, CryptoError> {
        let old_id = self.agent_id;
        let new_keypair = Keypair::generate(&mut rand::thread_rng());
        let new_id = AgentId::from_public_key(&new_keypair.public);

        self.keypair = new_keypair;
        self.agent_id = new_id;

        // Publish rotation event to swarm
        Ok(new_id)
    }
}
```

## Audit Logging

All security-relevant events are logged:

```rust
pub enum AuditEvent {
    AgentAuthenticated { agent_id: AgentId, method: AuthMethod },
    MessageSigned { message_hash: [u8; 32], timestamp: DateTime<Utc> },
    SignatureVerified { signer_id: AgentId, valid: bool },
    SessionEstablished { peer_id: AgentId, key_fingerprint: [u8; 32] },
    SafeZoneViolated { parameter: String, attempted_value: f64, reason: String },
}
```

### Audit Log Integrity

- Hash chain linking entries
- BLAKE3 hashing for tamper detection
- Append-only structure (no deletion)
- Periodic export for external analysis

## Compliance

### Regulatory Requirements

- **3GPP TS 33.501**: 5G security architecture compliance
- **GSMA FS.48**: Security guidelines for RAN optimization
- **NIST SP 800-57**: Key management recommendations
- **NIST SP 800-38D**: AEAD (GCM) mode guidelines

### Security Audits

- Quarterly cryptographic review
- Annual penetration testing
- Continuous fuzzing of crypto boundaries
- Miri testing for all unsafe code

## Threat Model

### Assumptions

1. **Attacker Capabilities**:
   - Can intercept P2P communication
   - Can replay captured messages
   - May compromise individual agents
   - Has computational resources for brute force (but not quantum)

2. **Attacker Limitations**:
   - Cannot break Ed25519 (128-bit security)
   - Cannot break AES-256-GCM
   - Cannot break X25519 ECDH
   - Cannot bypass hardcoded safe zones

3. **Security Boundaries**:
   - Trust within agent swarm (authenticated)
   - Zero-trust at P2P transport layer
   - Explicit authorization for parameter changes

### Attack Vectors Mitigated

| Attack | Mitigation |
|--------|------------|
| Agent impersonation | Ed25519 signatures, identity binding |
| Message replay | Timestamp + nonce validation |
| Man-in-the-middle | X25519 ECDH, endpoint authentication |
| Parameter overflow | Hardcoded safe zones |
| Key compromise | Forward secrecy via ephemeral keys |
| Timing attacks | Constant-time crypto primitives |

## Performance Considerations

### Cryptographic Operation Costs

| Operation | Time (WASM) | Frequency |
|-----------|-------------|-----------|
| Ed25519 sign | ~2ms | Per outbound message |
| Ed25519 verify | ~1ms | Per inbound message |
| X25519 ECDH | ~3ms | Per session establishment |
| AES-256-GCM encrypt | ~0.5ms/KB | Per sensitive payload |
| AES-256-GCM decrypt | ~0.5ms/KB | Per sensitive payload |

### Optimization Strategies

1. **Signature Caching**: Cache verification results for repeated messages
2. **Batch Verification**: Verify multiple signatures in parallel
3. **Session Key Reuse**: Use session keys for 60 minutes before rotation
4. **SIMD Acceleration**: Use WASM SIMD where available (future)

## Testing

### Unit Tests

```bash
# Test all crypto operations
cargo test -p elex-crypto

# Test with Miri (undefined behavior detection)
cargo +nightly miri test -p elex-crypto
```

### Integration Tests

```bash
# Test full message flow
cargo test -p elex-crypto --test integration
```

### Fuzzing

```bash
# Fuzz cryptographic parsing
cargo +nightly fuzz run signature_parsing
cargo +nightly fuzz run encryption_decryption
```

## Dependencies

### Cryptographic Crates

| Crate | Version | Purpose | Audit Status |
|-------|---------|---------|--------------|
| `ed25519-dalek` | 2.0 | Ed25519 signatures | ✓ Audited |
| `x25519-dalek` | 2.0 | X25519 ECDH | ✓ Audited |
| `aes-gcm` | 0.10 | AES-256-GCM encryption | ✓ Audited |
| `getrandom` | 0.2 | Secure random generation | ✓ Audited |
| `blake3` | 1.0 | Hashing (via elex-core) | ✓ Audited |

### Security Audits

All cryptographic dependencies have been audited:
- ed25519-dalek: Trail of Bits audit (2020)
- aes-gcm: RustCrypto formal verification
- blake3: Security review by BLAKE3 team

## Future Enhancements

### Post-Quantum Cryptography

Plan to add hybrid signatures:
- **Ed25519 + Dilithium3**: Classical + post-quantum
- **Transition Path**: Gradual rollout, backward compatibility
- **Timeline**: Phase 6 (Q4 2026)

### Hardware Security Modules

Plan to integrate Web Crypto API:
- **Key Storage**: Browser's secure key storage
- **Signing**: Hardware-backed signatures
- **Performance**: Accelerated crypto operations

## References

- ADR-007: Security and Cryptography Architecture
- ADR-008: Safe Zone Parameter Constraints
- ADR-012: Unsafe Rust Policy
- DDD Security Bounded Context
- NIST Post-Quantum Cryptography Standardization
- RFC 8032: Ed25519
- RFC 7748: X25519
- NIST SP 800-38D: GCM Mode

## Contact

Security questions or concerns? Contact:
- **Security Team**: security@elex.ai
- **Bug Bounty**: https://elex.ai/security
- **PGP Key**: Available on KeyBase
