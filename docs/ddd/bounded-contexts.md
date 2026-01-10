# ELEX Edge AI Agent Swarm - Bounded Contexts V2

## Overview

This document defines the refined DDD architecture for the ELEX system, establishing clear bounded context mappings between the Rust/WASM edge layer and the claude-flow TypeScript/Node coordination layer. The architecture enables 593 specialized Ericsson RAN feature agents to operate at the edge while integrating seamlessly with claude-flow v3's orchestration capabilities.

```
+==============================================================================+
|                        BOUNDED CONTEXT ARCHITECTURE                          |
+==============================================================================+
|                                                                              |
|  +------------------------+         +----------------------------------+     |
|  |     RUST/WASM EDGE     |  <ACL>  |      TYPESCRIPT/NODE HOST        |     |
|  |    (Browser/Edge)      |         |       (claude-flow v3)           |     |
|  +------------------------+         +----------------------------------+     |
|  |                        |         |                                  |     |
|  |  elex-knowledge        |<------->|  memory-management               |     |
|  |  elex-intelligence     |<------->|  coordination (swarm/hive-mind)  |     |
|  |  elex-optimization     |<------->|  task-execution                  |     |
|  |  elex-coordination     |<------->|  agent-lifecycle                 |     |
|  |  elex-security         |<------->|  claims/security                 |     |
|  |  elex-runtime          |<------->|  mcp-transport                   |     |
|  |                        |         |                                  |     |
|  +------------------------+         +----------------------------------+     |
|                                                                              |
+==============================================================================+
```

---

## Part 1: ELEX Rust Crate Structure

### Workspace Organization

```
elex/
+-- Cargo.toml                    # Workspace root
+-- crates/
|   +-- elex-core/                # Shared kernel (types, traits, errors)
|   +-- elex-knowledge/           # Core: 593 Feature Agents
|   +-- elex-intelligence/        # Core: Q-Learning, Patterns
|   +-- elex-optimization/        # Core: KPI, Root Cause
|   +-- elex-coordination/        # Supporting: Routing, Consensus
|   +-- elex-security/            # Supporting: Identity, Encryption
|   +-- elex-runtime/             # Generic: WASM, Edge Deploy
|   +-- elex-wasm-bindings/       # WASM-bindgen exports
+-- pkg/                          # Generated WASM packages
```

### Crate Dependency Graph

```
                    +----------------+
                    |   elex-core    |
                    | (shared kernel)|
                    +-------+--------+
                            |
          +-----------------+-----------------+
          |                 |                 |
          v                 v                 v
+------------------+ +------------------+ +------------------+
|  elex-knowledge  | | elex-intelligence| | elex-optimization|
|  (Core Domain)   | |  (Core Domain)   | |  (Core Domain)   |
+--------+---------+ +--------+---------+ +--------+---------+
         |                    |                    |
         +--------------------+--------------------+
                              |
                    +---------+---------+
                    |                   |
                    v                   v
          +------------------+ +------------------+
          | elex-coordination| |  elex-security   |
          | (Supporting)     | |  (Supporting)    |
          +--------+---------+ +--------+---------+
                   |                    |
                   +----------+---------+
                              |
                              v
                    +------------------+
                    |  elex-runtime    |
                    | (Generic Domain) |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |elex-wasm-bindings|
                    | (Anti-Corruption)|
                    +------------------+
```

---

## Part 2: Bounded Context Definitions

### 2.1 Core Domain: Knowledge Context (elex-knowledge)

**Responsibility:** Managing 593 specialized feature agents, each mastering a single Ericsson RAN feature.

#### Rust Crate Structure

```
elex-knowledge/
+-- src/
|   +-- lib.rs
|   +-- domain/
|   |   +-- mod.rs
|   |   +-- models/
|   |   |   +-- feature_agent.rs     # Aggregate Root
|   |   |   +-- feature.rs           # Entity
|   |   |   +-- parameter.rs         # Value Object
|   |   |   +-- counter.rs           # Value Object
|   |   |   +-- kpi.rs               # Value Object
|   |   |   +-- faj_code.rs          # Value Object (ID)
|   |   +-- events/
|   |   |   +-- agent_initialized.rs
|   |   |   +-- query_processed.rs
|   |   |   +-- confidence_updated.rs
|   |   +-- services/
|   |   |   +-- feature_matcher.rs   # Domain Service
|   |   |   +-- cmedit_generator.rs  # Domain Service
|   |   +-- interfaces/
|   |       +-- feature_repository.rs
|   |       +-- knowledge_store.rs
|   +-- application/
|   |   +-- services/
|   |   |   +-- agent_service.rs
|   |   |   +-- query_handler.rs
|   |   +-- handlers/
|   |       +-- query_event_handler.rs
|   +-- infrastructure/
|       +-- repositories/
|       |   +-- wasm_feature_repository.rs
|       +-- adapters/
|           +-- vector_memory_adapter.rs
```

#### Aggregate: FeatureAgent

```rust
// elex-knowledge/src/domain/models/feature_agent.rs

use elex_core::{AgentId, FAJCode, DomainEvent};

/// Aggregate Root: FeatureAgent
/// Represents a specialized WASM agent mastering one Ericsson RAN feature.
#[derive(Clone)]
pub struct FeatureAgent {
    // Identity (immutable)
    id: AgentId,
    faj_code: FAJCode,

    // State
    status: AgentStatus,
    knowledge: KnowledgeBase,

    // Learning state
    confidence: Confidence,
    interaction_count: u32,

    // Domain events
    events: Vec<DomainEvent>,
}

impl FeatureAgent {
    /// Factory method with validation
    pub fn create(
        id: AgentId,
        faj_code: FAJCode,
        knowledge: KnowledgeBase,
    ) -> Result<Self, DomainError> {
        faj_code.validate()?;

        let agent = Self {
            id: id.clone(),
            faj_code: faj_code.clone(),
            status: AgentStatus::Initializing,
            knowledge,
            confidence: Confidence::cold_start(),
            interaction_count: 0,
            events: vec![],
        };

        agent.raise(DomainEvent::AgentCreated {
            agent_id: id,
            faj_code,
            timestamp: Timestamp::now(),
        });

        Ok(agent)
    }

    /// Handle a user query (Command)
    pub fn handle_query(&mut self, query: Query) -> Result<Response, DomainError> {
        self.ensure_ready()?;
        self.status = AgentStatus::Busy;

        let response = self.knowledge.answer(&query)?;

        self.interaction_count += 1;
        self.check_cold_start_transition();

        self.raise(DomainEvent::QueryProcessed {
            agent_id: self.id.clone(),
            query_id: query.id,
            confidence: self.confidence.value(),
            timestamp: Timestamp::now(),
        });

        self.status = AgentStatus::Ready;
        Ok(response)
    }

    /// Record feedback for learning (Command)
    pub fn record_feedback(&mut self, feedback: Feedback) -> Result<(), DomainError> {
        self.confidence.update(feedback.reward);

        self.raise(DomainEvent::ConfidenceUpdated {
            agent_id: self.id.clone(),
            new_confidence: self.confidence.value(),
            reward: feedback.reward,
            timestamp: Timestamp::now(),
        });

        Ok(())
    }

    /// Consult a peer agent (raises event for coordination context)
    pub fn request_peer_consultation(&mut self, peer_id: AgentId, query: Query) {
        self.raise(DomainEvent::PeerConsultationRequested {
            from_agent: self.id.clone(),
            to_agent: peer_id,
            query_id: query.id,
            timestamp: Timestamp::now(),
        });
    }

    // Invariant enforcement
    fn ensure_ready(&self) -> Result<(), DomainError> {
        match self.status {
            AgentStatus::Ready | AgentStatus::ColdStart => Ok(()),
            _ => Err(DomainError::AgentNotReady(self.id.clone())),
        }
    }

    fn check_cold_start_transition(&mut self) {
        if self.status == AgentStatus::ColdStart
            && self.interaction_count >= COLD_START_THRESHOLD {
            self.status = AgentStatus::Ready;
            self.confidence = Confidence::new(0.7);
        }
    }

    fn raise(&mut self, event: DomainEvent) {
        self.events.push(event);
    }

    pub fn take_events(&mut self) -> Vec<DomainEvent> {
        std::mem::take(&mut self.events)
    }
}
```

#### Value Objects

```rust
// elex-knowledge/src/domain/models/faj_code.rs

/// Value Object: FAJCode
/// Immutable identifier for an Ericsson feature.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct FAJCode(String);

impl FAJCode {
    /// Create a new FAJ code with validation
    pub fn new(value: impl Into<String>) -> Result<Self, ValidationError> {
        let value = value.into();
        Self::validate_format(&value)?;
        Ok(Self(value))
    }

    fn validate_format(value: &str) -> Result<(), ValidationError> {
        // Format: "FAJ XXX YYYY" where XXX is 3 digits, YYYY is 4 digits
        let re = regex::Regex::new(r"^FAJ \d{3} \d{4}$").unwrap();
        if re.is_match(value) {
            Ok(())
        } else {
            Err(ValidationError::InvalidFAJCode(value.to_string()))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// elex-knowledge/src/domain/models/parameter.rs

/// Value Object: Parameter
/// Configurable network parameter with validation rules.
#[derive(Clone, Debug)]
pub struct Parameter {
    name: ParameterName,
    value_type: DataType,
    range: Option<Range<f64>>,
    current_value: Option<ParameterValue>,
    safe_zone: SafeZone,
}

impl Parameter {
    pub fn is_within_safe_zone(&self, value: f64) -> bool {
        self.safe_zone.contains(value)
    }

    pub fn validate_change(&self, new_value: f64) -> ValidationResult {
        if !self.is_within_safe_zone(new_value) {
            return ValidationResult::OutOfSafeZone;
        }

        if let Some(current) = self.current_value.as_ref().and_then(|v| v.as_f64()) {
            let delta = (new_value - current).abs() / current;
            if delta > self.safe_zone.max_change_percent {
                return ValidationResult::ExceedsChangeLimit(delta);
            }
        }

        ValidationResult::Valid
    }
}

/// Value Object: SafeZone
/// Defines operational boundaries for parameters.
#[derive(Clone, Debug)]
pub struct SafeZone {
    min: f64,
    max: f64,
    max_change_percent: f64,  // e.g., 0.15 for 15%
    cooldown: Duration,
}

impl SafeZone {
    pub fn contains(&self, value: f64) -> bool {
        value >= self.min && value <= self.max
    }
}
```

---

### 2.2 Core Domain: Intelligence Context (elex-intelligence)

**Responsibility:** Self-learning capabilities including Q-learning, trajectory replay, pattern recognition, and federated learning.

#### Rust Crate Structure

```
elex-intelligence/
+-- src/
|   +-- lib.rs
|   +-- domain/
|   |   +-- models/
|   |   |   +-- q_table.rs           # Aggregate Root
|   |   |   +-- trajectory.rs        # Entity
|   |   |   +-- state_action.rs      # Value Object
|   |   |   +-- reward.rs            # Value Object
|   |   +-- events/
|   |   |   +-- q_value_updated.rs
|   |   |   +-- trajectory_completed.rs
|   |   |   +-- pattern_learned.rs
|   |   +-- services/
|   |       +-- action_selector.rs   # Domain Service
|   |       +-- federated_merger.rs  # Domain Service
|   +-- application/
|   |   +-- services/
|   |       +-- learning_service.rs
|   |       +-- pattern_recognition.rs
|   +-- infrastructure/
|       +-- simd/
|           +-- batch_update.rs
```

#### Aggregate: QTable

```rust
// elex-intelligence/src/domain/models/q_table.rs

/// Aggregate Root: QTable
/// Stores and manages state-action value estimates for Q-learning.
pub struct QTable {
    id: QTableId,
    agent_id: AgentId,

    // Configuration
    config: QLearningConfig,

    // State
    entries: HashMap<StateActionKey, QEntry>,
    current_epsilon: f32,

    // Statistics
    total_updates: u32,
    total_episodes: u32,

    // Events
    events: Vec<DomainEvent>,
}

impl QTable {
    /// Update Q-value using Bellman equation
    /// Q(s,a) <- Q(s,a) + alpha[r + gamma*max(Q(s',a')) - Q(s,a)]
    pub fn update(
        &mut self,
        transition: StateTransition,
    ) -> Result<QValue, DomainError> {
        let key = StateActionKey::new(&transition.state, &transition.action);
        let current_q = self.get_q_value(&key);

        // Bellman update
        let target = transition.reward.value()
            + self.config.gamma * transition.next_max_q.unwrap_or(0.0);
        let td_error = target - current_q;
        let new_q = current_q + self.config.alpha * td_error;

        // Update entry
        self.entries
            .entry(key.clone())
            .and_modify(|e| {
                e.value = new_q;
                e.visit_count += 1;
            })
            .or_insert_with(|| QEntry::new(key.clone(), new_q));

        self.total_updates += 1;

        self.raise(DomainEvent::QValueUpdated {
            q_table_id: self.id.clone(),
            state_action: key,
            old_value: current_q,
            new_value: new_q,
            td_error,
            timestamp: Timestamp::now(),
        });

        Ok(QValue(new_q))
    }

    /// Batch update using SIMD (2-4x faster)
    pub fn batch_update(&mut self, transitions: Vec<StateTransition>) {
        // Delegate to SIMD infrastructure
        let updates = simd::batch_q_update(
            &transitions,
            self.config.alpha,
            self.config.gamma,
        );

        for (key, new_value) in updates {
            self.entries
                .entry(key)
                .and_modify(|e| {
                    e.value = new_value;
                    e.visit_count += 1;
                });
        }

        self.total_updates += transitions.len() as u32;
    }

    /// Select action using epsilon-greedy strategy
    pub fn select_action(
        &self,
        state: &State,
        available_actions: &[Action],
    ) -> ActionSelection {
        let should_explore = random() < self.current_epsilon;

        if should_explore {
            ActionSelection::exploration(random_choice(available_actions))
        } else {
            let (best_action, best_q) = self.find_best_action(state, available_actions);
            ActionSelection::exploitation(best_action, best_q)
        }
    }

    /// Merge Q-table from another agent (Federated Learning)
    pub fn merge_from(&mut self, other: &QTable, weight: f32) {
        let weight = weight.clamp(0.0, 1.0);
        let self_weight = 1.0 - weight;

        for (key, other_entry) in &other.entries {
            let merged_value = if let Some(self_entry) = self.entries.get(key) {
                self_entry.value * self_weight + other_entry.value * weight
            } else {
                other_entry.value * weight
            };

            self.entries.insert(key.clone(), QEntry::merged(key.clone(), merged_value));
        }

        self.raise(DomainEvent::QTableMerged {
            q_table_id: self.id.clone(),
            from_table_id: other.id.clone(),
            merge_weight: weight,
            entries_merged: other.entries.len(),
            timestamp: Timestamp::now(),
        });
    }

    /// Decay exploration rate
    pub fn decay_epsilon(&mut self) {
        self.current_epsilon *= self.config.epsilon_decay;
        self.current_epsilon = self.current_epsilon.max(0.01);
        self.total_episodes += 1;
    }
}
```

---

### 2.3 Core Domain: Optimization Context (elex-optimization)

**Responsibility:** KPI monitoring, root cause analysis, parameter optimization, and network integrity assessment.

#### Rust Crate Structure

```
elex-optimization/
+-- src/
|   +-- lib.rs
|   +-- domain/
|   |   +-- models/
|   |   |   +-- optimization_cycle.rs   # Aggregate Root
|   |   |   +-- kpi_monitor.rs          # Entity
|   |   |   +-- root_cause.rs           # Value Object
|   |   |   +-- recommendation.rs       # Value Object
|   |   +-- events/
|   |   |   +-- anomaly_detected.rs
|   |   |   +-- optimization_executed.rs
|   |   |   +-- rollback_triggered.rs
|   |   +-- services/
|   |       +-- root_cause_analyzer.rs
|   |       +-- min_cut_analyzer.rs
|   +-- application/
|       +-- services/
|           +-- control_loop_service.rs
```

#### Aggregate: OptimizationCycle

```rust
// elex-optimization/src/domain/models/optimization_cycle.rs

/// Aggregate Root: OptimizationCycle
/// Represents a single closed-loop optimization cycle (6 phases).
pub struct OptimizationCycle {
    id: CycleId,

    // Current phase
    phase: OptimizationPhase,

    // Context
    target_kpi: KPI,
    root_cause: Option<RootCause>,
    recommendation: Option<Recommendation>,
    risk: RiskLevel,

    // Rollback
    rollback_point: Option<RollbackPoint>,
    timer: Timer,

    // Events
    events: Vec<DomainEvent>,
}

#[derive(Clone, Copy, PartialEq)]
pub enum OptimizationPhase {
    Observe,     // 1. Collect KPIs, counters, alarms
    Analyze,     // 2. Detect anomalies, root causes
    Decide,      // 3. Route to agents, assess risk
    Act,         // 4. Execute cmedit, set timer
    Learn,       // 5. Measure delta, update Q-table
    Repeat,      // 6. Continuous cycle
}

impl OptimizationCycle {
    /// Create new optimization cycle
    pub fn start(target_kpi: KPI) -> Self {
        let cycle = Self {
            id: CycleId::new(),
            phase: OptimizationPhase::Observe,
            target_kpi,
            root_cause: None,
            recommendation: None,
            risk: RiskLevel::Unknown,
            rollback_point: None,
            timer: Timer::new(Duration::from_secs(30 * 60)), // 30 min
            events: vec![],
        };

        cycle.raise(DomainEvent::OptimizationCycleStarted {
            cycle_id: cycle.id.clone(),
            target_kpi: target_kpi.clone(),
            timestamp: Timestamp::now(),
        });

        cycle
    }

    /// Transition through phases
    pub fn advance(&mut self) -> Result<(), DomainError> {
        self.phase = match self.phase {
            OptimizationPhase::Observe => {
                self.ensure_observations_collected()?;
                OptimizationPhase::Analyze
            }
            OptimizationPhase::Analyze => {
                self.ensure_root_cause_identified()?;
                OptimizationPhase::Decide
            }
            OptimizationPhase::Decide => {
                self.ensure_recommendation_approved()?;
                OptimizationPhase::Act
            }
            OptimizationPhase::Act => {
                self.create_rollback_point();
                self.timer.start();
                OptimizationPhase::Learn
            }
            OptimizationPhase::Learn => {
                self.evaluate_outcome()?;
                OptimizationPhase::Repeat
            }
            OptimizationPhase::Repeat => OptimizationPhase::Observe,
        };

        self.raise(DomainEvent::PhaseAdvanced {
            cycle_id: self.id.clone(),
            new_phase: self.phase,
            timestamp: Timestamp::now(),
        });

        Ok(())
    }

    /// Execute rollback if needed
    pub fn rollback(&mut self) -> Result<(), DomainError> {
        let rollback_point = self.rollback_point.take()
            .ok_or(DomainError::NoRollbackPoint)?;

        self.raise(DomainEvent::RollbackTriggered {
            cycle_id: self.id.clone(),
            rollback_point,
            reason: "Timer expired or negative outcome".into(),
            timestamp: Timestamp::now(),
        });

        self.phase = OptimizationPhase::Observe;
        Ok(())
    }
}
```

---

### 2.4 Supporting Domain: Coordination Context (elex-coordination)

**Responsibility:** Semantic routing, consensus protocols, P2P transport, and swarm topology management.

#### Rust Crate Structure

```
elex-coordination/
+-- src/
|   +-- lib.rs
|   +-- domain/
|   |   +-- models/
|   |   |   +-- swarm.rs                # Aggregate Root
|   |   |   +-- router.rs               # Entity
|   |   |   +-- topology.rs             # Value Object
|   |   |   +-- message.rs              # Value Object
|   |   +-- events/
|   |   |   +-- agent_joined.rs
|   |   |   +-- consensus_reached.rs
|   |   |   +-- topology_changed.rs
|   |   +-- services/
|   |       +-- semantic_router.rs      # HNSW-based routing
|   |       +-- consensus_manager.rs
|   +-- infrastructure/
|       +-- hnsw/
|           +-- index.rs
```

#### Aggregate: Swarm

```rust
// elex-coordination/src/domain/models/swarm.rs

/// Aggregate Root: Swarm
/// Coordinates a group of feature agents.
pub struct Swarm {
    id: SwarmId,

    // Topology
    topology: Topology,

    // Members
    agents: HashMap<AgentId, AgentMembership>,

    // Consensus
    consensus_strategy: ConsensusStrategy,

    // Events
    events: Vec<DomainEvent>,
}

#[derive(Clone)]
pub enum Topology {
    Mesh,                       // Fully connected
    Hierarchical(CoordinatorId),// Single coordinator
    Sharded(Vec<ShardId>),      // Multiple shards
    HierarchicalMesh {          // Hybrid (recommended)
        coordinators: Vec<CoordinatorId>,
        mesh_agents: Vec<AgentId>,
    },
}

#[derive(Clone)]
pub enum ConsensusStrategy {
    Byzantine,   // BFT: tolerates f < n/3 faulty
    Raft,        // Leader-based: tolerates f < n/2
    Gossip,      // Epidemic eventual consistency
    CRDT,        // Conflict-free replicated data
    Quorum(u32), // Configurable quorum
}

impl Swarm {
    /// Route a query to the best agent(s)
    pub fn route_query(&self, query: &Query) -> Vec<AgentId> {
        match &self.topology {
            Topology::Mesh => {
                // HNSW semantic search
                self.semantic_route(query)
            }
            Topology::Hierarchical(coord) => {
                // Coordinator decides
                vec![coord.as_agent_id()]
            }
            Topology::HierarchicalMesh { coordinators, .. } => {
                // Coordinators + semantic fallback
                let mut targets = coordinators.iter()
                    .map(|c| c.as_agent_id())
                    .collect::<Vec<_>>();
                targets.extend(self.semantic_route(query));
                targets
            }
            _ => self.semantic_route(query),
        }
    }

    /// Achieve consensus on a decision
    pub fn achieve_consensus(&mut self, proposal: Proposal) -> ConsensusResult {
        match &self.consensus_strategy {
            ConsensusStrategy::Byzantine => {
                // BFT requires 2f+1 agreement
                let required = self.agents.len() * 2 / 3 + 1;
                self.collect_votes(proposal, required)
            }
            ConsensusStrategy::Raft => {
                // Leader proposes, majority confirms
                self.raft_consensus(proposal)
            }
            ConsensusStrategy::Gossip => {
                // Epidemic propagation
                self.gossip_consensus(proposal)
            }
            ConsensusStrategy::CRDT => {
                // Conflict-free merge
                ConsensusResult::Immediate(proposal.value)
            }
            ConsensusStrategy::Quorum(q) => {
                self.collect_votes(proposal, *q as usize)
            }
        }
    }

    /// Change topology
    pub fn change_topology(&mut self, new_topology: Topology) {
        let old_topology = std::mem::replace(&mut self.topology, new_topology.clone());

        self.raise(DomainEvent::TopologyChanged {
            swarm_id: self.id.clone(),
            old_topology,
            new_topology,
            timestamp: Timestamp::now(),
        });
    }
}
```

---

### 2.5 Supporting Domain: Security Context (elex-security)

**Responsibility:** Agent identity, message authentication, encryption, access control, and post-quantum security.

#### Rust Crate Structure

```
elex-security/
+-- src/
|   +-- lib.rs
|   +-- domain/
|   |   +-- models/
|   |   |   +-- agent_identity.rs       # Aggregate Root
|   |   |   +-- crypto_provider.rs      # Entity
|   |   |   +-- claims.rs               # Value Object
|   |   |   +-- signature.rs            # Value Object
|   |   +-- services/
|   |       +-- message_verifier.rs
|   |       +-- access_controller.rs
|   +-- infrastructure/
|       +-- crypto/
|           +-- ed25519.rs
|           +-- aes_gcm.rs
|           +-- x25519.rs
```

#### Aggregate: AgentIdentity

```rust
// elex-security/src/domain/models/agent_identity.rs

/// Aggregate Root: AgentIdentity
/// Manages cryptographic identity for an agent.
pub struct AgentIdentity {
    id: AgentId,

    // Keys
    public_key: Ed25519PublicKey,
    signing_key: Ed25519SigningKey,  // Private

    // Session keys (rotated hourly)
    session_key: Option<SessionKey>,
    key_expires_at: Option<Timestamp>,

    // Claims-based authorization
    claims: Vec<Claim>,

    // Events
    events: Vec<DomainEvent>,
}

impl AgentIdentity {
    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> Signature {
        Signature::new(self.signing_key.sign(message))
    }

    /// Verify a message signature
    pub fn verify(&self, message: &[u8], signature: &Signature) -> bool {
        self.public_key.verify(message, signature.as_bytes())
    }

    /// Create a secure message
    pub fn create_message(
        &self,
        recipient_id: AgentId,
        payload: Vec<u8>,
    ) -> Result<SecureMessage, SecurityError> {
        let nonce = Nonce::generate();
        let timestamp = Timestamp::now();

        // Sign the payload
        let signature = self.sign(&payload);

        Ok(SecureMessage {
            id: MessageId::new(),
            sender_id: self.id.clone(),
            recipient_id,
            payload,
            signature,
            timestamp,
            nonce,
        })
    }

    /// Rotate session key
    pub fn rotate_session_key(&mut self) {
        let new_key = SessionKey::generate();
        self.session_key = Some(new_key);
        self.key_expires_at = Some(Timestamp::now() + Duration::from_secs(3600));

        self.raise(DomainEvent::SessionKeyRotated {
            agent_id: self.id.clone(),
            expires_at: self.key_expires_at.unwrap(),
            timestamp: Timestamp::now(),
        });
    }

    /// Check if agent has a specific claim
    pub fn has_claim(&self, claim_type: &str, value: &str) -> bool {
        self.claims.iter().any(|c| c.claim_type == claim_type && c.value == value)
    }

    /// Grant a claim
    pub fn grant_claim(&mut self, claim: Claim) {
        self.claims.push(claim.clone());

        self.raise(DomainEvent::ClaimGranted {
            agent_id: self.id.clone(),
            claim,
            timestamp: Timestamp::now(),
        });
    }
}
```

---

### 2.6 Generic Domain: Runtime Context (elex-runtime)

**Responsibility:** WASM compilation, edge deployment, resource management, and cross-platform execution.

#### Rust Crate Structure

```
elex-runtime/
+-- src/
|   +-- lib.rs
|   +-- domain/
|   |   +-- models/
|   |   |   +-- runtime_environment.rs  # Aggregate Root
|   |   |   +-- wasm_module.rs          # Entity
|   |   |   +-- deployment_config.rs    # Value Object
|   |   +-- services/
|   |       +-- resource_manager.rs
|   |       +-- module_loader.rs
|   +-- infrastructure/
|       +-- wasm/
|           +-- bindings.rs
```

---

## Part 3: Anti-Corruption Layer (ACL)

### 3.1 WASM Bindings Crate

The `elex-wasm-bindings` crate serves as the Anti-Corruption Layer between Rust/WASM and TypeScript/claude-flow.

```
elex-wasm-bindings/
+-- src/
|   +-- lib.rs
|   +-- adapters/
|   |   +-- knowledge_adapter.rs    # Knowledge <-> memory-management
|   |   +-- intelligence_adapter.rs # Intelligence <-> neural/hooks
|   |   +-- coordination_adapter.rs # Coordination <-> swarm/hive-mind
|   |   +-- security_adapter.rs     # Security <-> claims/security
|   +-- dto/
|   |   +-- query_dto.rs
|   |   +-- response_dto.rs
|   |   +-- event_dto.rs
|   +-- translators/
|       +-- event_translator.rs
|       +-- type_translator.rs
```

### 3.2 Type Translation

```rust
// elex-wasm-bindings/src/translators/type_translator.rs

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

/// Translate between Rust domain types and JS-compatible DTOs

// Rust Domain -> JS DTO
impl From<FeatureAgent> for JsFeatureAgentDTO {
    fn from(agent: FeatureAgent) -> Self {
        JsFeatureAgentDTO {
            id: agent.id.as_str().to_string(),
            faj_code: agent.faj_code.as_str().to_string(),
            status: agent.status.to_string(),
            confidence: agent.confidence.value(),
            interaction_count: agent.interaction_count,
        }
    }
}

// JS DTO -> Rust Domain
impl TryFrom<JsQueryDTO> for Query {
    type Error = ValidationError;

    fn try_from(dto: JsQueryDTO) -> Result<Self, Self::Error> {
        Ok(Query {
            id: QueryId::new(dto.id),
            query_type: QueryType::from_str(&dto.query_type)?,
            content: dto.content,
            context: QueryContext::from_json(&dto.context)?,
            timestamp: Timestamp::from_millis(dto.timestamp),
        })
    }
}

/// DTO for JavaScript interop
#[derive(Serialize, Deserialize)]
#[wasm_bindgen(getter_with_clone)]
pub struct JsFeatureAgentDTO {
    pub id: String,
    pub faj_code: String,
    pub status: String,
    pub confidence: f32,
    pub interaction_count: u32,
}

#[derive(Serialize, Deserialize)]
pub struct JsQueryDTO {
    pub id: String,
    pub query_type: String,
    pub content: String,
    pub context: String,  // JSON string
    pub timestamp: u64,
}
```

### 3.3 Event Translation for Integration

```rust
// elex-wasm-bindings/src/translators/event_translator.rs

/// Translate ELEX domain events to claude-flow compatible events

pub fn translate_to_claude_flow(event: DomainEvent) -> JsValue {
    match event {
        DomainEvent::AgentCreated { agent_id, faj_code, timestamp } => {
            serde_wasm_bindgen::to_value(&ClaudeFlowEvent {
                event_type: "agent:spawned".into(),
                namespace: "elex".into(),
                key: agent_id.as_str().into(),
                value: serde_json::json!({
                    "faj_code": faj_code.as_str(),
                    "timestamp": timestamp.as_millis(),
                }).to_string(),
            }).unwrap()
        }

        DomainEvent::QueryProcessed { agent_id, query_id, confidence, timestamp } => {
            serde_wasm_bindgen::to_value(&ClaudeFlowEvent {
                event_type: "task:completed".into(),
                namespace: "elex".into(),
                key: format!("query:{}", query_id.as_str()),
                value: serde_json::json!({
                    "agent_id": agent_id.as_str(),
                    "confidence": confidence,
                    "timestamp": timestamp.as_millis(),
                }).to_string(),
            }).unwrap()
        }

        DomainEvent::QValueUpdated { q_table_id, state_action, new_value, td_error, .. } => {
            serde_wasm_bindgen::to_value(&ClaudeFlowEvent {
                event_type: "neural:pattern:stored".into(),
                namespace: "elex-learning".into(),
                key: state_action.as_str().into(),
                value: serde_json::json!({
                    "q_table_id": q_table_id.as_str(),
                    "q_value": new_value,
                    "td_error": td_error,
                }).to_string(),
            }).unwrap()
        }

        DomainEvent::ConsensusReached { swarm_id, proposal_id, result, .. } => {
            serde_wasm_bindgen::to_value(&ClaudeFlowEvent {
                event_type: "hive-mind:consensus:reached".into(),
                namespace: "elex-coordination".into(),
                key: proposal_id.as_str().into(),
                value: serde_json::json!({
                    "swarm_id": swarm_id.as_str(),
                    "result": result,
                }).to_string(),
            }).unwrap()
        }

        _ => JsValue::NULL,
    }
}

#[derive(Serialize)]
struct ClaudeFlowEvent {
    event_type: String,
    namespace: String,
    key: String,
    value: String,
}
```

---

## Part 4: Context Integration Patterns

### 4.1 Knowledge Context <-> claude-flow memory-management

```
+-----------------------------------------------------------------------+
|                    KNOWLEDGE <-> MEMORY INTEGRATION                    |
+-----------------------------------------------------------------------+
|                                                                       |
|  ELEX Knowledge (Rust/WASM)          claude-flow memory (TypeScript)  |
|  +--------------------------+        +-----------------------------+  |
|  | FeatureAgent             |        | memory-management/          |  |
|  |  - KnowledgeBase         |<------>|  - AgentDB (HNSW)          |  |
|  |  - VectorMemory          |        |  - Vector embeddings        |  |
|  +--------------------------+        +-----------------------------+  |
|                                                                       |
|  Integration Points:                                                  |
|  1. Vector storage: WASM generates embeddings -> AgentDB stores       |
|  2. Semantic search: Query -> HNSW lookup -> Return ranked agents     |
|  3. Pattern persistence: Feature patterns -> memory store             |
|                                                                       |
+-----------------------------------------------------------------------+
```

**TypeScript Integration Code:**

```typescript
// claude-flow integration: memory-adapter.ts

import { MemoryService } from '@claude-flow/memory-management';
import type { ElexKnowledgeEvent } from './types';

export class ElexMemoryAdapter {
  constructor(private memory: MemoryService) {}

  /**
   * Store feature knowledge from WASM agent
   */
  async storeFeatureKnowledge(event: ElexKnowledgeEvent): Promise<void> {
    await this.memory.store({
      namespace: 'elex-knowledge',
      key: `feature:${event.fajCode}`,
      value: JSON.stringify({
        faj_code: event.fajCode,
        category: event.category,
        parameters: event.parameters,
        counters: event.counters,
        kpis: event.kpis,
        embedding: event.embedding,  // From WASM HNSW
      }),
      tags: ['feature', event.category, event.rat],
    });
  }

  /**
   * Search for relevant features using HNSW
   */
  async searchFeatures(query: string, k: number = 5): Promise<FeatureResult[]> {
    const results = await this.memory.search({
      namespace: 'elex-knowledge',
      query,
      limit: k,
      threshold: 0.7,  // Minimum similarity
    });

    return results.map(r => ({
      fajCode: JSON.parse(r.value).faj_code,
      similarity: r.score,
      ...JSON.parse(r.value),
    }));
  }
}
```

---

### 4.2 Intelligence Context <-> claude-flow neural/hooks

```
+-----------------------------------------------------------------------+
|                 INTELLIGENCE <-> NEURAL/HOOKS INTEGRATION              |
+-----------------------------------------------------------------------+
|                                                                       |
|  ELEX Intelligence (Rust/WASM)       claude-flow neural (TypeScript)  |
|  +--------------------------+        +-----------------------------+  |
|  | QTable                   |        | hooks/                      |  |
|  |  - Q-Learning            |<------>|  - pre/post-task           |  |
|  |  - Trajectory            |        |  - route                    |  |
|  |  - FederatedMerger       |        |  - intelligence             |  |
|  +--------------------------+        +-----------------------------+  |
|                                      | neural/                      |  |
|                                      |  - SONA adaptation          |  |
|                                      |  - Pattern learning         |  |
|                                      +-----------------------------+  |
|                                                                       |
|  Integration Points:                                                  |
|  1. Trajectory storage: WASM records -> hooks post-task              |
|  2. Pattern retrieval: hooks route -> WASM Q-table lookup            |
|  3. Federated merge: Multiple WASM tables -> neural consolidate      |
|                                                                       |
+-----------------------------------------------------------------------+
```

**TypeScript Integration Code:**

```typescript
// claude-flow integration: intelligence-adapter.ts

import { HooksService } from '@claude-flow/hooks';
import { NeuralService } from '@claude-flow/neural';
import type { ElexTrajectory, ElexQUpdate } from './types';

export class ElexIntelligenceAdapter {
  constructor(
    private hooks: HooksService,
    private neural: NeuralService,
  ) {}

  /**
   * Record trajectory from WASM Q-learning
   */
  async recordTrajectory(trajectory: ElexTrajectory): Promise<void> {
    // Map to claude-flow hooks intelligence format
    await this.hooks.execute('intelligence', {
      action: 'trajectory-end',
      trajectoryId: trajectory.id,
      steps: trajectory.steps.map(s => ({
        state: s.state,
        action: s.action,
        reward: s.reward,
        nextState: s.nextState,
      })),
      cumulativeReward: trajectory.cumulativeReward,
      metadata: {
        agentId: trajectory.agentId,
        fajCode: trajectory.fajCode,
      },
    });

    // Store pattern for future retrieval
    await this.hooks.execute('intelligence', {
      action: 'pattern-store',
      pattern: {
        type: 'q-trajectory',
        key: `trajectory:${trajectory.id}`,
        embedding: await this.neural.embed(trajectory.stateSequence),
        verdict: trajectory.cumulativeReward > 0 ? 'success' : 'failure',
      },
    });
  }

  /**
   * Route query using learned patterns
   */
  async routeWithPatterns(query: string): Promise<AgentRouting> {
    const routing = await this.hooks.execute('route', {
      task: query,
      context: { domain: 'elex' },
      topK: 5,
    });

    return {
      recommendedAgents: routing.agents,
      confidence: routing.confidence,
      patterns: routing.matchedPatterns,
    };
  }

  /**
   * Trigger federated merge of Q-tables
   */
  async federatedMerge(qTables: ElexQUpdate[]): Promise<void> {
    await this.neural.train({
      patternType: 'q-federated',
      epochs: 1,
      data: qTables.map(qt => ({
        agentId: qt.agentId,
        entries: qt.entries,
        weight: qt.interactionCount / qt.totalInteractions,
      })),
    });
  }
}
```

---

### 4.3 Coordination Context <-> claude-flow swarm/hive-mind

```
+-----------------------------------------------------------------------+
|              COORDINATION <-> SWARM/HIVE-MIND INTEGRATION              |
+-----------------------------------------------------------------------+
|                                                                       |
|  ELEX Coordination (Rust/WASM)       claude-flow swarm (TypeScript)   |
|  +--------------------------+        +-----------------------------+  |
|  | Swarm                    |        | swarm/                      |  |
|  |  - Topology              |<------>|  - init                     |  |
|  |  - ConsensusManager      |        |  - status                   |  |
|  |  - Router                |        |  - coordinate               |  |
|  +--------------------------+        +-----------------------------+  |
|                                      | hive-mind/                   |  |
|                                      |  - Byzantine consensus       |  |
|                                      |  - Raft/Gossip/CRDT         |  |
|                                      +-----------------------------+  |
|                                                                       |
|  Integration Points:                                                  |
|  1. Swarm init: claude-flow swarm init -> WASM topology setup        |
|  2. Consensus: WASM proposal -> hive-mind vote -> WASM apply         |
|  3. Routing: claude-flow route -> WASM semantic search               |
|                                                                       |
+-----------------------------------------------------------------------+
```

**TypeScript Integration Code:**

```typescript
// claude-flow integration: coordination-adapter.ts

import { SwarmService } from '@claude-flow/swarm';
import { HiveMindService } from '@claude-flow/hive-mind';
import type { ElexSwarmConfig, ElexConsensusProposal } from './types';

export class ElexCoordinationAdapter {
  constructor(
    private swarm: SwarmService,
    private hiveMind: HiveMindService,
  ) {}

  /**
   * Initialize ELEX swarm with claude-flow coordination
   */
  async initializeSwarm(config: ElexSwarmConfig): Promise<string> {
    // Initialize claude-flow swarm
    const swarmId = await this.swarm.init({
      topology: this.mapTopology(config.topology),
      maxAgents: config.maxAgents,
      strategy: config.consensusStrategy,
    });

    // Configure hive-mind consensus
    await this.hiveMind.configure({
      swarmId,
      consensusType: config.consensusStrategy,
      quorumSize: Math.floor(config.maxAgents * 2 / 3) + 1,
      timeout: 30000,  // 30s consensus timeout
    });

    return swarmId;
  }

  /**
   * Achieve consensus using hive-mind
   */
  async achieveConsensus(proposal: ElexConsensusProposal): Promise<ConsensusResult> {
    const result = await this.hiveMind.propose({
      swarmId: proposal.swarmId,
      proposalType: proposal.type,
      value: proposal.value,
      requiredVotes: proposal.quorum,
    });

    return {
      accepted: result.accepted,
      votes: result.votes,
      finalValue: result.finalValue,
    };
  }

  /**
   * Route query through swarm
   */
  async routeQuery(swarmId: string, query: string): Promise<AgentId[]> {
    const routing = await this.swarm.route({
      swarmId,
      query,
      strategy: 'semantic',  // Use HNSW
    });

    return routing.targetAgents;
  }

  private mapTopology(elexTopology: string): string {
    const mapping: Record<string, string> = {
      'Mesh': 'mesh',
      'Hierarchical': 'hierarchical',
      'Sharded': 'sharded',
      'HierarchicalMesh': 'hierarchical-mesh',
    };
    return mapping[elexTopology] || 'mesh';
  }
}
```

---

### 4.4 Security Context <-> claude-flow claims/security

```
+-----------------------------------------------------------------------+
|                 SECURITY <-> CLAIMS/SECURITY INTEGRATION               |
+-----------------------------------------------------------------------+
|                                                                       |
|  ELEX Security (Rust/WASM)           claude-flow security (TS)        |
|  +--------------------------+        +-----------------------------+  |
|  | AgentIdentity            |        | claims/                     |  |
|  |  - Ed25519 keys          |<------>|  - check                    |  |
|  |  - Claims                |        |  - grant                    |  |
|  |  - MessageVerifier       |        |  - revoke                   |  |
|  +--------------------------+        +-----------------------------+  |
|                                      | security/                    |  |
|                                      |  - scan                      |  |
|                                      |  - audit                     |  |
|                                      +-----------------------------+  |
|                                                                       |
|  Integration Points:                                                  |
|  1. Claims sync: WASM claims <-> claude-flow claims store            |
|  2. Key rotation: claude-flow triggers -> WASM rotates               |
|  3. Audit: WASM security events -> claude-flow audit log             |
|                                                                       |
+-----------------------------------------------------------------------+
```

**TypeScript Integration Code:**

```typescript
// claude-flow integration: security-adapter.ts

import { ClaimsService } from '@claude-flow/claims';
import { SecurityService } from '@claude-flow/security';
import type { ElexClaim, ElexSecurityEvent } from './types';

export class ElexSecurityAdapter {
  constructor(
    private claims: ClaimsService,
    private security: SecurityService,
  ) {}

  /**
   * Sync claims between WASM and claude-flow
   */
  async syncClaims(agentId: string, wasmClaims: ElexClaim[]): Promise<void> {
    for (const claim of wasmClaims) {
      await this.claims.grant({
        subject: agentId,
        claimType: claim.claimType,
        value: claim.value,
        issuer: 'elex-wasm',
        expiresAt: claim.expiresAt,
      });
    }
  }

  /**
   * Check if agent has required claim
   */
  async checkClaim(agentId: string, claimType: string, value: string): Promise<boolean> {
    const result = await this.claims.check({
      subject: agentId,
      claimType,
      value,
    });
    return result.valid;
  }

  /**
   * Record security event for audit
   */
  async recordSecurityEvent(event: ElexSecurityEvent): Promise<void> {
    await this.security.audit({
      eventType: event.type,
      agentId: event.agentId,
      severity: event.severity,
      details: event.details,
      timestamp: event.timestamp,
    });
  }

  /**
   * Trigger key rotation
   */
  async triggerKeyRotation(agentId: string): Promise<void> {
    // Notify WASM agent to rotate keys
    // This is handled via the WASM bindings callback
    await this.security.dispatch({
      type: 'key-rotation-required',
      agentId,
      deadline: Date.now() + 60000,  // 1 minute to rotate
    });
  }
}
```

---

## Part 5: Ubiquitous Language Bridge

### 5.1 Cross-Platform Term Mapping

| ELEX Rust Term | claude-flow TypeScript Term | Definition |
|----------------|----------------------------|------------|
| `FeatureAgent` | `Agent` | Autonomous unit managing RAN feature |
| `FAJCode` | `agentType` | Unique feature identifier |
| `Swarm` | `Swarm` | Coordinated agent group |
| `QTable` | `neural patterns` | Learned state-action values |
| `Trajectory` | `trajectory` | Sequence of state-action-reward |
| `ConsensusResult` | `consensus` | Agreement from hive-mind |
| `Parameter` | `config` | Network configuration value |
| `Counter` | `metric` | Network measurement |
| `KPI` | `kpi` | Key performance indicator |
| `OptimizationCycle` | `task` | Closed-loop optimization |
| `Topology` | `topology` | Swarm communication structure |
| `AgentIdentity` | `claims` + `identity` | Cryptographic identity |
| `DomainEvent` | `event` | Something that happened |
| `SafeZone` | `constraints` | Operational boundaries |

### 5.2 Event Type Mapping

| ELEX Domain Event | claude-flow Event | Namespace |
|-------------------|-------------------|-----------|
| `AgentCreated` | `agent:spawned` | elex |
| `AgentInitialized` | `agent:ready` | elex |
| `QueryProcessed` | `task:completed` | elex |
| `ConfidenceUpdated` | `neural:pattern:stored` | elex-learning |
| `QValueUpdated` | `neural:pattern:stored` | elex-learning |
| `TrajectoryCompleted` | `hooks:post-task` | elex-learning |
| `ConsensusReached` | `hive-mind:consensus:reached` | elex-coordination |
| `TopologyChanged` | `swarm:topology:changed` | elex-coordination |
| `AnomalyDetected` | `security:alert` | elex-optimization |
| `OptimizationExecuted` | `task:executed` | elex-optimization |
| `ClaimGranted` | `claims:granted` | elex-security |
| `SessionKeyRotated` | `security:key:rotated` | elex-security |

### 5.3 API Contract

```typescript
// Shared interface between WASM and TypeScript

/**
 * Query request from claude-flow to WASM agent
 */
interface ElexQuery {
  id: string;
  type: 'parameter' | 'counter' | 'kpi' | 'procedure' | 'troubleshoot' | 'general';
  content: string;
  context: {
    previousQueries?: string[];
    selectedFeatures?: string[];
    networkContext?: NetworkContext;
  };
  timestamp: number;
}

/**
 * Response from WASM agent to claude-flow
 */
interface ElexResponse {
  queryId: string;
  agentId: string;
  fajCode: string;
  content: string;
  confidence: number;
  action: 'DirectAnswer' | 'ContextAnswer' | 'ConsultPeer' | 'RequestClarification' | 'Escalate';
  sources: Source[];
  cmeditCommands?: CmeditCommand[];
  relatedFeatures?: string[];
  consultedAgents?: string[];
  latencyMs: number;
}

/**
 * Event published by WASM agent
 */
interface ElexEvent {
  type: string;
  agentId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}
```

---

## Part 6: Integration Architecture Diagram

```
+==============================================================================+
|                      ELEX + claude-flow v3 INTEGRATION                       |
+==============================================================================+
|                                                                              |
|  BROWSER/EDGE                                                                |
|  +------------------------------------------------------------------------+  |
|  |                          WASM RUNTIME                                  |  |
|  |  +--------------------+  +--------------------+  +------------------+  |  |
|  |  | elex-knowledge     |  | elex-intelligence  |  | elex-optimization|  |  |
|  |  | - 593 Agents       |  | - Q-Learning       |  | - KPI Monitor    |  |  |
|  |  | - HNSW Index       |  | - Trajectories     |  | - Root Cause     |  |  |
|  |  +--------+-----------+  +--------+-----------+  +--------+---------+  |  |
|  |           |                       |                       |            |  |
|  |  +--------+-----------+  +--------+-----------+                        |  |
|  |  | elex-coordination  |  | elex-security      |                        |  |
|  |  | - Routing          |  | - Ed25519          |                        |  |
|  |  | - Consensus        |  | - Claims           |                        |  |
|  |  +--------+-----------+  +--------+-----------+                        |  |
|  |           |                       |                                    |  |
|  |  +--------+-------------------+---+-------+                            |  |
|  |  |           elex-wasm-bindings (ACL)     |                            |  |
|  |  +-------------------+--------------------+                            |  |
|  +----------------------|----------------------------------------------------+
|                         | wasm-bindgen                                       |
|                         v                                                    |
|  NODE.JS / DENO                                                              |
|  +------------------------------------------------------------------------+  |
|  |                       claude-flow v3                                   |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  |  | memory-management|  | swarm/hive-mind  |  | agent-lifecycle      |  |  |
|  |  | - AgentDB        |  | - Coordination   |  | - Spawn/Stop         |  |  |
|  |  | - HNSW (150x)    |  | - Consensus      |  | - Health             |  |  |
|  |  +--------+---------+  +--------+---------+  +----------+-----------+  |  |
|  |           |                     |                       |              |  |
|  |  +--------+---------+  +--------+---------+  +----------+-----------+  |  |
|  |  | hooks            |  | neural           |  | security/claims      |  |  |
|  |  | - pre/post-task  |  | - SONA           |  | - Scan/Audit         |  |  |
|  |  | - route          |  | - MoE            |  | - Claims             |  |  |
|  |  +--------+---------+  +--------+---------+  +----------+-----------+  |  |
|  |           |                     |                       |              |  |
|  |  +--------+---------------------+---------------+-------+              |  |
|  |  |                      MCP Transport                   |              |  |
|  |  +------------------------------------------------------+              |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+==============================================================================+
```

---

## Part 7: Implementation Checklist

### Phase 1: Crate Structure (Week 1-2)

- [ ] Create Cargo workspace with all 7 crates
- [ ] Define shared kernel types in `elex-core`
- [ ] Implement domain models for `elex-knowledge`
- [ ] Implement domain models for `elex-intelligence`
- [ ] Implement domain models for `elex-optimization`

### Phase 2: Supporting Domains (Week 3-4)

- [ ] Implement `elex-coordination` with consensus protocols
- [ ] Implement `elex-security` with Ed25519 and claims
- [ ] Implement `elex-runtime` for WASM deployment

### Phase 3: ACL & Integration (Week 5-6)

- [ ] Create `elex-wasm-bindings` with wasm-bindgen
- [ ] Implement TypeScript adapters for claude-flow
- [ ] Define event translation layer
- [ ] Test cross-platform type conversions

### Phase 4: Integration Testing (Week 7-8)

- [ ] Integration tests: Knowledge <-> memory
- [ ] Integration tests: Intelligence <-> neural/hooks
- [ ] Integration tests: Coordination <-> swarm/hive-mind
- [ ] Integration tests: Security <-> claims
- [ ] End-to-end workflow tests

---

## References

- ADR-002: DDD Structure (claude-flow v3)
- ELEX Bounded Contexts v1
- ELEX Domain Model v1
- claude-flow v3 Architecture Documentation
- wasm-bindgen Reference Guide
