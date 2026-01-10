# Security Bounded Context

## Domain Purpose

The Security context manages cryptographic identity, message authentication, access control, and audit logging for the 593-agent system. This is a **Supporting Domain** that provides security services to all other contexts.

---

## Context Map Position

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SECURITY CONTEXT                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upstream Dependencies: None (foundational security)               │
│                                                                     │
│  Downstream Consumers (Conformist):                                │
│  ├── Coordination - agent authentication, message verification     │
│  ├── Runtime - module signing, execution authorization             │
│  ├── Intelligence - secure federated learning                      │
│  ├── Optimization - change authorization                           │
│  └── Knowledge - access control for sensitive data                 │
│                                                                     │
│  Integration Style:                                                 │
│  └── Open Host Service with published security interfaces          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Root: AgentIdentity

The `AgentIdentity` is the aggregate root that manages an agent's cryptographic identity, including keypairs, access policies, and audit records.

### Aggregate Boundary

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AgentIdentity Aggregate                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │  AgentIdentity  │ (Aggregate Root)                               │
│  │                 │                                                │
│  │  id             │                                                │
│  │  public_key     │                                                │
│  │  created_at     │                                                │
│  │  status         │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           │ owns                                                     │
│           ▼                                                          │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │     Keypair     │     │  AccessPolicy   │                        │
│  │    (Entity)     │     │    (Entity)     │                        │
│  │                 │     │                 │                        │
│  │  algorithm      │     │  permissions    │                        │
│  │  created_at     │     │  constraints    │                        │
│  └─────────────────┘     └────────┬────────┘                        │
│                                   │                                  │
│                                   │ records                          │
│                                   ▼                                  │
│                          ┌─────────────────┐                        │
│                          │    AuditLog     │                        │
│                          │    (Entity)     │                        │
│                          │                 │                        │
│                          │  events         │                        │
│                          │  retention      │                        │
│                          └─────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invariants

1. **Unique Identity**: Each agent has exactly one identity
2. **Key Validity**: Private keys must not be exposed outside secure boundary
3. **Signature Freshness**: Signatures must include timestamp to prevent replay
4. **Policy Consistency**: Access policies cannot contradict each other
5. **Audit Completeness**: All security-relevant operations must be logged

---

## Entities

### AgentIdentity

Manages an agent's cryptographic identity.

```rust
struct AgentIdentity {
    // Identity
    id: AgentId,
    bound_feature: Option<FeatureId>,  // For feature agents

    // Cryptography
    keypair: Keypair,
    session_keys: HashMap<AgentId, SessionKey>,

    // Authorization
    policies: Vec<AccessPolicy>,
    capabilities: HashSet<Capability>,

    // Audit
    audit_log: AuditLog,

    // Status
    status: IdentityStatus,
    created_at: DateTime<Utc>,
    last_authenticated: Option<DateTime<Utc>>,
}

#[derive(Clone, Copy, PartialEq)]
enum IdentityStatus {
    Active,
    Suspended,
    Revoked,
    PendingVerification,
}

impl AgentIdentity {
    /// Sign a message
    fn sign(&self, message: &[u8]) -> Result<Signature, SecurityError> {
        if self.status != IdentityStatus::Active {
            return Err(SecurityError::IdentityNotActive);
        }

        let timestamp = Utc::now();
        let nonce = Self::generate_nonce();

        // Create signed payload with timestamp and nonce
        let payload = SignedPayload {
            message: message.to_vec(),
            timestamp,
            nonce,
            signer_id: self.id,
        };

        let signature = self.keypair.sign(&payload.to_bytes())?;

        self.audit_log.record(AuditEvent::MessageSigned {
            timestamp,
            message_hash: Self::hash(message),
        });

        Ok(Signature {
            value: signature,
            timestamp,
            nonce,
            signer_id: self.id,
            algorithm: self.keypair.algorithm(),
        })
    }

    /// Verify a signature from another agent
    fn verify(&self, message: &[u8], signature: &Signature, signer_pubkey: &PublicKey) -> Result<(), SecurityError> {
        // Check signature freshness (prevent replay)
        let age = Utc::now() - signature.timestamp;
        if age > Duration::minutes(5) {
            return Err(SecurityError::SignatureExpired);
        }

        // Reconstruct payload
        let payload = SignedPayload {
            message: message.to_vec(),
            timestamp: signature.timestamp,
            nonce: signature.nonce,
            signer_id: signature.signer_id,
        };

        // Verify signature
        signer_pubkey.verify(&payload.to_bytes(), &signature.value)?;

        self.audit_log.record(AuditEvent::SignatureVerified {
            timestamp: Utc::now(),
            signer_id: signature.signer_id,
            valid: true,
        });

        Ok(())
    }

    /// Check if action is authorized
    fn authorize(&self, action: &Action, resource: &Resource) -> Result<(), SecurityError> {
        if self.status != IdentityStatus::Active {
            return Err(SecurityError::IdentityNotActive);
        }

        for policy in &self.policies {
            match policy.evaluate(action, resource) {
                PolicyResult::Allow => {
                    self.audit_log.record(AuditEvent::AccessGranted {
                        timestamp: Utc::now(),
                        action: action.clone(),
                        resource: resource.clone(),
                    });
                    return Ok(());
                }
                PolicyResult::Deny(reason) => {
                    self.audit_log.record(AuditEvent::AccessDenied {
                        timestamp: Utc::now(),
                        action: action.clone(),
                        resource: resource.clone(),
                        reason: reason.clone(),
                    });
                    return Err(SecurityError::AccessDenied(reason));
                }
                PolicyResult::Continue => continue,
            }
        }

        // Default deny
        Err(SecurityError::NoMatchingPolicy)
    }

    /// Establish session with another agent
    fn establish_session(&mut self, peer_id: AgentId, peer_pubkey: &PublicKey) -> Result<SessionKey, SecurityError> {
        // X25519 key exchange
        let ephemeral = X25519Keypair::generate();
        let shared_secret = ephemeral.diffie_hellman(peer_pubkey)?;

        let session_key = SessionKey::derive(&shared_secret, &self.id, &peer_id);

        self.session_keys.insert(peer_id, session_key.clone());

        self.audit_log.record(AuditEvent::SessionEstablished {
            timestamp: Utc::now(),
            peer_id,
        });

        Ok(session_key)
    }

    /// Rotate keypair
    fn rotate_keys(&mut self) -> Result<PublicKey, SecurityError> {
        let old_public = self.keypair.public_key().clone();
        let new_keypair = Keypair::generate(self.keypair.algorithm())?;

        self.keypair = new_keypair;
        self.session_keys.clear(); // Invalidate all sessions

        self.audit_log.record(AuditEvent::KeyRotated {
            timestamp: Utc::now(),
            old_key_fingerprint: old_public.fingerprint(),
        });

        Ok(self.keypair.public_key().clone())
    }
}
```

### Keypair

Cryptographic key pair.

```rust
struct Keypair {
    // Algorithm
    algorithm: KeyAlgorithm,

    // Keys (private key never leaves this struct)
    private_key: PrivateKey,
    public_key: PublicKey,

    // Metadata
    created_at: DateTime<Utc>,
    expires_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Copy, PartialEq)]
enum KeyAlgorithm {
    Ed25519,           // Default for signatures
    X25519,            // For key exchange
    Dilithium3,        // Post-quantum (hybrid)
}

impl Keypair {
    /// Generate new keypair
    fn generate(algorithm: KeyAlgorithm) -> Result<Self, SecurityError> {
        let (private_key, public_key) = match algorithm {
            KeyAlgorithm::Ed25519 => {
                let keypair = ed25519_dalek::SigningKey::generate(&mut rand::thread_rng());
                (
                    PrivateKey::Ed25519(keypair.to_bytes()),
                    PublicKey::Ed25519(keypair.verifying_key().to_bytes()),
                )
            }
            KeyAlgorithm::X25519 => {
                let private = x25519_dalek::StaticSecret::random_from_rng(&mut rand::thread_rng());
                let public = x25519_dalek::PublicKey::from(&private);
                (
                    PrivateKey::X25519(private.to_bytes()),
                    PublicKey::X25519(public.to_bytes()),
                )
            }
            KeyAlgorithm::Dilithium3 => {
                // Post-quantum signature (hybrid with Ed25519)
                let (pk, sk) = pqcrypto_dilithium::dilithium3::keypair();
                (
                    PrivateKey::Dilithium3(sk),
                    PublicKey::Dilithium3(pk),
                )
            }
        };

        Ok(Self {
            algorithm,
            private_key,
            public_key,
            created_at: Utc::now(),
            expires_at: None,
        })
    }

    /// Sign message
    fn sign(&self, message: &[u8]) -> Result<Vec<u8>, SecurityError> {
        match (&self.algorithm, &self.private_key) {
            (KeyAlgorithm::Ed25519, PrivateKey::Ed25519(key)) => {
                let signing_key = ed25519_dalek::SigningKey::from_bytes(key);
                let signature = signing_key.sign(message);
                Ok(signature.to_bytes().to_vec())
            }
            (KeyAlgorithm::Dilithium3, PrivateKey::Dilithium3(sk)) => {
                let sig = pqcrypto_dilithium::dilithium3::sign(message, sk);
                Ok(sig.as_bytes().to_vec())
            }
            _ => Err(SecurityError::AlgorithmMismatch),
        }
    }

    fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    fn algorithm(&self) -> KeyAlgorithm {
        self.algorithm
    }
}
```

### AccessPolicy

Defines access control rules.

```rust
struct AccessPolicy {
    // Identity
    id: PolicyId,
    name: String,

    // Rules
    permissions: Vec<Permission>,
    constraints: Vec<Constraint>,

    // Scope
    applies_to: PolicyScope,

    // Metadata
    priority: i32,  // Higher = evaluated first
    enabled: bool,
}

struct Permission {
    actions: HashSet<ActionType>,
    resources: ResourcePattern,
    effect: Effect,
}

#[derive(Clone, Copy, PartialEq)]
enum Effect {
    Allow,
    Deny,
}

struct Constraint {
    constraint_type: ConstraintType,
    parameters: HashMap<String, String>,
}

#[derive(Clone)]
enum ConstraintType {
    TimeWindow { start: NaiveTime, end: NaiveTime },
    RateLimit { max_requests: u32, window: Duration },
    IPRange { ranges: Vec<IpNet> },
    RequireAuthentication { min_strength: AuthStrength },
}

enum PolicyScope {
    Global,
    Agent(AgentId),
    Feature(FeatureId),
    Domain(String),
}

impl AccessPolicy {
    /// Evaluate policy for action on resource
    fn evaluate(&self, action: &Action, resource: &Resource) -> PolicyResult {
        if !self.enabled {
            return PolicyResult::Continue;
        }

        // Check constraints first
        for constraint in &self.constraints {
            if !constraint.satisfied(action, resource) {
                return PolicyResult::Deny(format!("Constraint not satisfied: {:?}", constraint.constraint_type));
            }
        }

        // Check permissions
        for permission in &self.permissions {
            if permission.matches(action, resource) {
                return match permission.effect {
                    Effect::Allow => PolicyResult::Allow,
                    Effect::Deny => PolicyResult::Deny("Explicitly denied".to_string()),
                };
            }
        }

        PolicyResult::Continue
    }
}
```

### AuditLog

Records security-relevant events.

```rust
struct AuditLog {
    // Identity
    agent_id: AgentId,

    // Events
    events: VecDeque<AuditEntry>,
    max_entries: usize,

    // Retention
    retention_period: Duration,

    // Integrity
    chain_hash: [u8; 32],  // Hash chain for tamper detection
}

struct AuditEntry {
    id: AuditEntryId,
    timestamp: DateTime<Utc>,
    event: AuditEvent,
    previous_hash: [u8; 32],
    entry_hash: [u8; 32],
}

#[derive(Clone)]
enum AuditEvent {
    // Authentication
    AgentAuthenticated { peer_id: AgentId, method: AuthMethod },
    AuthenticationFailed { peer_id: AgentId, reason: String },

    // Signatures
    MessageSigned { timestamp: DateTime<Utc>, message_hash: [u8; 32] },
    SignatureVerified { timestamp: DateTime<Utc>, signer_id: AgentId, valid: bool },

    // Authorization
    AccessGranted { timestamp: DateTime<Utc>, action: Action, resource: Resource },
    AccessDenied { timestamp: DateTime<Utc>, action: Action, resource: Resource, reason: String },

    // Sessions
    SessionEstablished { timestamp: DateTime<Utc>, peer_id: AgentId },
    SessionTerminated { timestamp: DateTime<Utc>, peer_id: AgentId, reason: String },

    // Keys
    KeyRotated { timestamp: DateTime<Utc>, old_key_fingerprint: [u8; 32] },
    KeyCompromised { timestamp: DateTime<Utc>, reason: String },

    // Policy
    PolicyUpdated { timestamp: DateTime<Utc>, policy_id: PolicyId },
    PolicyViolation { timestamp: DateTime<Utc>, policy_id: PolicyId, details: String },
}

impl AuditLog {
    /// Record an audit event
    fn record(&mut self, event: AuditEvent) {
        let previous_hash = self.chain_hash;

        let entry = AuditEntry {
            id: AuditEntryId::new(),
            timestamp: Utc::now(),
            event,
            previous_hash,
            entry_hash: [0; 32], // Calculated below
        };

        // Calculate entry hash for chain integrity
        let entry_bytes = bincode::serialize(&entry).unwrap();
        let entry_hash = blake3::hash(&entry_bytes).into();

        let entry = AuditEntry { entry_hash, ..entry };

        self.chain_hash = entry_hash;
        self.events.push_back(entry);

        // Enforce retention
        while self.events.len() > self.max_entries {
            self.events.pop_front();
        }
    }

    /// Verify chain integrity
    fn verify_integrity(&self) -> Result<(), AuditError> {
        let mut expected_prev = [0u8; 32];

        for entry in &self.events {
            if entry.previous_hash != expected_prev {
                return Err(AuditError::ChainBroken { entry_id: entry.id });
            }
            expected_prev = entry.entry_hash;
        }

        if expected_prev != self.chain_hash {
            return Err(AuditError::ChainMismatch);
        }

        Ok(())
    }

    /// Query events by type
    fn query(&self, filter: AuditFilter) -> Vec<&AuditEntry> {
        self.events.iter()
            .filter(|e| filter.matches(e))
            .collect()
    }
}
```

---

## Value Objects

### Signature

Cryptographic signature with metadata.

```rust
#[derive(Clone, PartialEq)]
struct Signature {
    value: Vec<u8>,
    timestamp: DateTime<Utc>,
    nonce: [u8; 16],
    signer_id: AgentId,
    algorithm: KeyAlgorithm,
}

impl Signature {
    /// Check if signature is still valid (not expired)
    fn is_fresh(&self, max_age: Duration) -> bool {
        Utc::now() - self.timestamp <= max_age
    }

    /// Get signature bytes for transmission
    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.value);
        bytes.extend_from_slice(&self.timestamp.timestamp().to_le_bytes());
        bytes.extend_from_slice(&self.nonce);
        bytes.extend_from_slice(self.signer_id.as_bytes());
        bytes.push(self.algorithm as u8);
        bytes
    }
}
```

### Token

Authentication/authorization token.

```rust
#[derive(Clone, PartialEq)]
struct Token {
    token_type: TokenType,
    value: String,
    issued_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    claims: TokenClaims,
    signature: Signature,
}

#[derive(Clone, Copy, PartialEq)]
enum TokenType {
    Access,
    Refresh,
    Session,
    OneTime,
}

#[derive(Clone)]
struct TokenClaims {
    subject: AgentId,
    issuer: AgentId,
    audience: Option<AgentId>,
    permissions: Vec<Permission>,
    custom: HashMap<String, String>,
}

impl Token {
    /// Check if token is valid
    fn is_valid(&self) -> bool {
        let now = Utc::now();
        now >= self.issued_at && now < self.expires_at
    }

    /// Check if token has permission
    fn has_permission(&self, action: &ActionType, resource: &Resource) -> bool {
        self.claims.permissions.iter()
            .any(|p| p.actions.contains(action) && p.resources.matches(resource))
    }
}
```

### Permission

Access permission specification.

```rust
#[derive(Clone, PartialEq)]
struct Permission {
    actions: HashSet<ActionType>,
    resources: ResourcePattern,
    effect: Effect,
}

#[derive(Clone, PartialEq, Eq, Hash)]
enum ActionType {
    Read,
    Write,
    Execute,
    Delete,
    Configure,
    Delegate,
    Audit,
}

#[derive(Clone, PartialEq)]
enum ResourcePattern {
    Exact(Resource),
    Prefix(String),
    Regex(String),
    All,
}

impl Permission {
    fn matches(&self, action: &Action, resource: &Resource) -> bool {
        self.actions.contains(&action.action_type) && self.resources.matches(resource)
    }
}
```

---

## Domain Services

### CryptoProvider

Provides cryptographic operations.

```rust
struct CryptoProvider {
    default_algorithm: KeyAlgorithm,
    secure_random: Box<dyn SecureRandom>,
}

impl CryptoProvider {
    /// Generate secure random bytes
    fn random_bytes(&self, length: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; length];
        self.secure_random.fill(&mut bytes);
        bytes
    }

    /// Hash data
    fn hash(&self, data: &[u8]) -> [u8; 32] {
        blake3::hash(data).into()
    }

    /// Derive key from password
    fn derive_key(&self, password: &str, salt: &[u8]) -> [u8; 32] {
        argon2::hash_raw(
            password.as_bytes(),
            salt,
            &argon2::Config::default(),
        ).unwrap().try_into().unwrap()
    }

    /// Encrypt with AES-256-GCM
    fn encrypt(&self, key: &[u8; 32], plaintext: &[u8], aad: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let cipher = Aes256Gcm::new_from_slice(key)?;
        let nonce = self.random_bytes(12);
        let nonce_array: [u8; 12] = nonce.clone().try_into().unwrap();

        let ciphertext = cipher.encrypt(
            aes_gcm::Nonce::from_slice(&nonce_array),
            aes_gcm::aead::Payload { msg: plaintext, aad },
        )?;

        // Prepend nonce to ciphertext
        let mut result = nonce;
        result.extend(ciphertext);
        Ok(result)
    }

    /// Decrypt with AES-256-GCM
    fn decrypt(&self, key: &[u8; 32], ciphertext: &[u8], aad: &[u8]) -> Result<Vec<u8>, CryptoError> {
        if ciphertext.len() < 12 {
            return Err(CryptoError::InvalidCiphertext);
        }

        let (nonce, encrypted) = ciphertext.split_at(12);
        let cipher = Aes256Gcm::new_from_slice(key)?;

        cipher.decrypt(
            aes_gcm::Nonce::from_slice(nonce),
            aes_gcm::aead::Payload { msg: encrypted, aad },
        ).map_err(|_| CryptoError::DecryptionFailed)
    }
}
```

### MessageVerifier

Verifies message authenticity and integrity.

```rust
struct MessageVerifier {
    identity_registry: Box<dyn IdentityRegistry>,
    signature_cache: LruCache<MessageId, VerificationResult>,
    max_message_age: Duration,
}

impl MessageVerifier {
    /// Verify message signature
    fn verify(&mut self, message: &SignedMessage) -> Result<VerificationResult, SecurityError> {
        // Check cache
        if let Some(cached) = self.signature_cache.get(&message.id) {
            return Ok(cached.clone());
        }

        // Check message age
        let age = Utc::now() - message.signature.timestamp;
        if age > self.max_message_age {
            return Err(SecurityError::MessageTooOld);
        }

        // Get signer's public key
        let signer_identity = self.identity_registry
            .get(&message.signature.signer_id)
            .ok_or(SecurityError::UnknownSigner)?;

        // Verify identity is active
        if signer_identity.status != IdentityStatus::Active {
            return Err(SecurityError::SignerNotActive);
        }

        // Verify signature
        signer_identity.keypair.public_key()
            .verify(&message.payload, &message.signature.value)?;

        let result = VerificationResult {
            valid: true,
            signer: message.signature.signer_id,
            verified_at: Utc::now(),
        };

        self.signature_cache.put(message.id, result.clone());

        Ok(result)
    }

    /// Verify message chain (for ordered messages)
    fn verify_chain(&mut self, messages: &[SignedMessage]) -> Result<(), SecurityError> {
        let mut prev_hash: Option<[u8; 32]> = None;

        for message in messages {
            // Verify individual signature
            self.verify(message)?;

            // Verify chain link
            if let Some(expected) = prev_hash {
                if message.prev_hash != expected {
                    return Err(SecurityError::ChainBroken);
                }
            }

            prev_hash = Some(blake3::hash(&message.payload).into());
        }

        Ok(())
    }
}
```

### AccessController

Manages access control decisions.

```rust
struct AccessController {
    policies: Vec<AccessPolicy>,
    role_assignments: HashMap<AgentId, Vec<Role>>,
    resource_owners: HashMap<Resource, AgentId>,
}

impl AccessController {
    /// Check if agent can perform action on resource
    fn check_access(
        &self,
        agent: &AgentIdentity,
        action: &Action,
        resource: &Resource,
    ) -> AccessDecision {
        // Get agent's roles
        let roles = self.role_assignments.get(&agent.id)
            .map(|r| r.as_slice())
            .unwrap_or(&[]);

        // Check direct ownership
        if self.resource_owners.get(resource) == Some(&agent.id) {
            return AccessDecision::Allow { reason: "Resource owner".to_string() };
        }

        // Evaluate policies in priority order
        let mut sorted_policies: Vec<_> = self.policies.iter()
            .filter(|p| p.enabled)
            .collect();
        sorted_policies.sort_by(|a, b| b.priority.cmp(&a.priority));

        for policy in sorted_policies {
            if !policy.applies_to_agent(agent, roles) {
                continue;
            }

            match policy.evaluate(action, resource) {
                PolicyResult::Allow => {
                    return AccessDecision::Allow {
                        reason: format!("Policy {} allowed", policy.name),
                    };
                }
                PolicyResult::Deny(reason) => {
                    return AccessDecision::Deny { reason };
                }
                PolicyResult::Continue => continue,
            }
        }

        // Default deny
        AccessDecision::Deny { reason: "No policy allowed access".to_string() }
    }

    /// Grant role to agent
    fn grant_role(&mut self, agent_id: AgentId, role: Role) {
        self.role_assignments
            .entry(agent_id)
            .or_insert_with(Vec::new)
            .push(role);
    }

    /// Revoke role from agent
    fn revoke_role(&mut self, agent_id: AgentId, role: &Role) {
        if let Some(roles) = self.role_assignments.get_mut(&agent_id) {
            roles.retain(|r| r != role);
        }
    }
}
```

---

## Domain Events

### AgentAuthenticated

Emitted when an agent successfully authenticates.

```rust
struct AgentAuthenticated {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    agent_id: AgentId,
    method: AuthenticationMethod,
    session_id: Option<SessionId>,
    ip_address: Option<IpAddr>,
}

enum AuthenticationMethod {
    Signature,
    Token,
    Certificate,
    MutualTLS,
}
```

### MessageVerified

Emitted when a message signature is verified.

```rust
struct MessageVerified {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    message_id: MessageId,
    signer_id: AgentId,
    valid: bool,
    verification_duration: Duration,
}
```

### AccessDenied

Emitted when access is denied.

```rust
struct AccessDenied {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    agent_id: AgentId,
    action: Action,
    resource: Resource,
    reason: String,
    policy_id: Option<PolicyId>,
}
```

### KeyRotated

Emitted when keys are rotated.

```rust
struct KeyRotated {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    agent_id: AgentId,
    key_type: KeyType,
    old_fingerprint: [u8; 32],
    new_fingerprint: [u8; 32],
    rotation_reason: RotationReason,
}

enum RotationReason {
    Scheduled,
    Compromised,
    PolicyRequirement,
    Manual,
}
```

### SecurityIncident

Emitted when a security incident is detected.

```rust
struct SecurityIncident {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    incident_type: IncidentType,
    severity: IncidentSeverity,
    affected_agents: Vec<AgentId>,
    details: String,
    recommended_actions: Vec<String>,
}

enum IncidentType {
    BruteForceAttempt,
    InvalidSignature,
    ReplayAttack,
    UnauthorizedAccess,
    KeyCompromise,
    AnomalousActivity,
}

enum IncidentSeverity {
    Low,
    Medium,
    High,
    Critical,
}
```

---

## Repository Interfaces

### IdentityRepository

```rust
trait IdentityRepository {
    /// Find identity by agent ID
    fn find(&self, agent_id: AgentId) -> Option<AgentIdentity>;

    /// Find identity by public key
    fn find_by_public_key(&self, pubkey: &PublicKey) -> Option<AgentIdentity>;

    /// Save identity
    fn save(&mut self, identity: &AgentIdentity) -> Result<(), RepositoryError>;

    /// List active identities
    fn list_active(&self) -> Vec<AgentIdentity>;

    /// Revoke identity
    fn revoke(&mut self, agent_id: AgentId) -> Result<(), RepositoryError>;
}
```

### PolicyRepository

```rust
trait PolicyRepository {
    /// Get policy by ID
    fn find(&self, policy_id: PolicyId) -> Option<AccessPolicy>;

    /// Get policies for agent
    fn find_by_agent(&self, agent_id: AgentId) -> Vec<AccessPolicy>;

    /// Get all active policies
    fn get_active(&self) -> Vec<AccessPolicy>;

    /// Save policy
    fn save(&mut self, policy: &AccessPolicy) -> Result<(), RepositoryError>;

    /// Delete policy
    fn delete(&mut self, policy_id: PolicyId) -> Result<(), RepositoryError>;
}
```

### AuditRepository

```rust
trait AuditRepository {
    /// Append audit entry
    fn append(&mut self, agent_id: AgentId, event: AuditEvent) -> Result<(), RepositoryError>;

    /// Query audit log
    fn query(&self, filter: AuditFilter) -> Vec<AuditEntry>;

    /// Get audit log for agent
    fn get_log(&self, agent_id: AgentId) -> Option<AuditLog>;

    /// Export audit log
    fn export(&self, agent_id: AgentId, format: ExportFormat) -> Result<Vec<u8>, RepositoryError>;
}
```

---

## Integration Points

### Services Exposed (Open Host)

| Service | Consumer | Purpose |
|---------|----------|---------|
| `authenticate` | All | Verify agent identity |
| `authorize` | All | Check access permissions |
| `sign` | All | Sign messages |
| `verify` | All | Verify signatures |
| `encrypt` | All | Encrypt data |
| `decrypt` | All | Decrypt data |

### Events Published

| Event | Consumer | Action |
|-------|----------|--------|
| `AgentAuthenticated` | Coordination | Allow agent to join |
| `AccessDenied` | Audit | Record security event |
| `SecurityIncident` | All | Trigger security response |

### Conformist Consumers

All other contexts conform to Security's interfaces without translation:
- Coordination uses `authenticate`, `verify` directly
- Runtime uses `authorize` for module execution
- Intelligence uses `encrypt/decrypt` for federated learning
