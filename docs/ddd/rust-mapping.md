# DDD to Rust Mapping Patterns

## Overview

This document maps Domain-Driven Design tactical patterns to idiomatic Rust implementations. These patterns ensure that the 593-agent system maintains clean architecture, type safety, and efficient memory usage while preserving domain semantics.

---

## Pattern Quick Reference

| DDD Concept | Rust Implementation | Key Traits/Derives |
|-------------|--------------------|--------------------|
| Aggregate Root | struct with impl block | `Debug, Clone` |
| Entity | struct with Id field | `PartialEq` on Id only |
| Value Object | struct | `#[derive(Clone, Copy, PartialEq, Eq, Hash)]` |
| Domain Event | enum variants | `#[derive(Clone, Debug)]` |
| Repository | trait | `Send + Sync` bounds |
| Domain Service | struct with impl or functions | - |
| Factory | struct with builder pattern | - |

---

## Aggregates in Rust

### Aggregate Root Pattern

Aggregates in Rust are implemented as structs that own their entities and enforce invariants through encapsulation.

```rust
use std::collections::HashMap;

/// Aggregate Root: Swarm
///
/// The Swarm aggregate manages a coordinated group of agents.
/// All modifications go through the aggregate root to maintain invariants.
#[derive(Debug)]
pub struct Swarm {
    // Identity - immutable after creation
    id: SwarmId,

    // Configuration
    topology: Topology,
    max_agents: usize,

    // Owned entities - private, accessed through methods
    agents: HashMap<AgentId, Agent>,
    coordinator: Coordinator,
    router: Router,

    // Domain events to publish
    events: Vec<DomainEvent>,
}

impl Swarm {
    /// Create new swarm (factory method)
    pub fn new(id: SwarmId, topology: Topology, max_agents: usize) -> Self {
        Self {
            id,
            topology,
            max_agents,
            agents: HashMap::new(),
            coordinator: Coordinator::new(),
            router: Router::new(&topology),
            events: Vec::new(),
        }
    }

    /// Add agent - enforces invariants
    pub fn add_agent(&mut self, agent: Agent) -> Result<(), SwarmError> {
        // Invariant: cannot exceed max agents
        if self.agents.len() >= self.max_agents {
            return Err(SwarmError::CapacityExceeded);
        }

        // Invariant: no duplicate IDs
        if self.agents.contains_key(&agent.id()) {
            return Err(SwarmError::DuplicateAgent);
        }

        let agent_id = agent.id();
        self.agents.insert(agent_id, agent);

        // Record domain event
        self.events.push(DomainEvent::AgentJoined {
            swarm_id: self.id,
            agent_id,
            timestamp: Utc::now(),
        });

        Ok(())
    }

    /// Access to identity
    pub fn id(&self) -> SwarmId {
        self.id
    }

    /// Read-only access to agents
    pub fn agents(&self) -> impl Iterator<Item = &Agent> {
        self.agents.values()
    }

    /// Drain domain events (for publishing)
    pub fn drain_events(&mut self) -> Vec<DomainEvent> {
        std::mem::take(&mut self.events)
    }
}
```

### Aggregate Boundaries with Lifetimes

When aggregates need to provide references to internal entities, use lifetimes carefully.

```rust
impl Swarm {
    /// Get agent by ID (returns reference tied to aggregate lifetime)
    pub fn get_agent(&self, id: &AgentId) -> Option<&Agent> {
        self.agents.get(id)
    }

    /// Get mutable agent (controlled mutation)
    /// Private to enforce invariants at aggregate level
    fn get_agent_mut(&mut self, id: &AgentId) -> Option<&mut Agent> {
        self.agents.get_mut(id)
    }

    /// Update agent through aggregate (maintains invariants)
    pub fn update_agent_status(&mut self, id: &AgentId, status: AgentStatus) -> Result<(), SwarmError> {
        let agent = self.get_agent_mut(id)
            .ok_or(SwarmError::AgentNotFound)?;

        agent.set_status(status);

        self.events.push(DomainEvent::AgentStatusChanged {
            swarm_id: self.id,
            agent_id: *id,
            new_status: status,
            timestamp: Utc::now(),
        });

        Ok(())
    }
}
```

---

## Entities in Rust

### Entity Pattern

Entities have identity that persists across state changes. Implement `PartialEq` based on ID only.

```rust
use uuid::Uuid;

/// Entity: Agent
///
/// Agents have identity - two agents with same properties but different IDs are different.
#[derive(Debug, Clone)]
pub struct Agent {
    // Identity field
    id: AgentId,

    // Mutable state
    name: String,
    agent_type: AgentType,
    status: AgentStatus,
    capabilities: Vec<Capability>,

    // Timestamps
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

/// Strongly-typed ID for Agent entity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AgentId(Uuid);

impl AgentId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_bytes()
    }
}

impl Default for AgentId {
    fn default() -> Self {
        Self::new()
    }
}

impl Agent {
    pub fn new(name: String, agent_type: AgentType) -> Self {
        let now = Utc::now();
        Self {
            id: AgentId::new(),
            name,
            agent_type,
            status: AgentStatus::Created,
            capabilities: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    // Identity accessor
    pub fn id(&self) -> AgentId {
        self.id
    }

    // State mutators update timestamp
    pub fn set_status(&mut self, status: AgentStatus) {
        self.status = status;
        self.updated_at = Utc::now();
    }

    pub fn add_capability(&mut self, capability: Capability) {
        if !self.capabilities.contains(&capability) {
            self.capabilities.push(capability);
            self.updated_at = Utc::now();
        }
    }
}

/// Equality based on ID only (entity semantics)
impl PartialEq for Agent {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for Agent {}

/// Hash based on ID only
impl std::hash::Hash for Agent {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.id.hash(state);
    }
}
```

---

## Value Objects in Rust

### Value Object Pattern

Value objects are immutable and compared by value. Use `Copy` when possible for efficiency.

```rust
/// Value Object: FAJCode (Feature code)
///
/// Immutable, compared by value, implements Copy for efficiency.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FAJCode {
    // Internal representation
    number: u32,
}

impl FAJCode {
    /// Create from string with validation
    pub fn new(code: &str) -> Result<Self, FAJCodeError> {
        if !code.starts_with("FAJ") {
            return Err(FAJCodeError::InvalidPrefix);
        }

        let number = code[3..].parse::<u32>()
            .map_err(|_| FAJCodeError::InvalidNumber)?;

        if number == 0 {
            return Err(FAJCodeError::ZeroNotAllowed);
        }

        Ok(Self { number })
    }

    /// Create from number directly
    pub fn from_number(number: u32) -> Result<Self, FAJCodeError> {
        if number == 0 {
            return Err(FAJCodeError::ZeroNotAllowed);
        }
        Ok(Self { number })
    }

    /// Get the numeric part
    pub fn number(&self) -> u32 {
        self.number
    }
}

impl std::fmt::Display for FAJCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "FAJ{:06}", self.number)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum FAJCodeError {
    InvalidPrefix,
    InvalidNumber,
    ZeroNotAllowed,
}
```

### Complex Value Objects (non-Copy)

For larger value objects that can't implement `Copy`, use `Clone`.

```rust
/// Value Object: ParameterBounds
///
/// Immutable bounds specification for parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct ParameterBounds {
    min: Option<f64>,
    max: Option<f64>,
    allowed_values: Option<Vec<f64>>,
    step: Option<f64>,
}

impl ParameterBounds {
    /// Builder pattern for complex value objects
    pub fn builder() -> ParameterBoundsBuilder {
        ParameterBoundsBuilder::default()
    }

    /// Validate a value against these bounds
    pub fn validate(&self, value: f64) -> Result<(), BoundsError> {
        if let Some(min) = self.min {
            if value < min {
                return Err(BoundsError::BelowMinimum { value, min });
            }
        }

        if let Some(max) = self.max {
            if value > max {
                return Err(BoundsError::AboveMaximum { value, max });
            }
        }

        if let Some(ref allowed) = self.allowed_values {
            if !allowed.iter().any(|v| (*v - value).abs() < f64::EPSILON) {
                return Err(BoundsError::NotInAllowedSet { value });
            }
        }

        if let Some(step) = self.step {
            let base = self.min.unwrap_or(0.0);
            let remainder = (value - base) % step;
            if remainder.abs() > f64::EPSILON && (step - remainder).abs() > f64::EPSILON {
                return Err(BoundsError::InvalidStep { value, step });
            }
        }

        Ok(())
    }

    /// Check if value is within bounds (no error details)
    pub fn contains(&self, value: f64) -> bool {
        self.validate(value).is_ok()
    }
}

#[derive(Default)]
pub struct ParameterBoundsBuilder {
    min: Option<f64>,
    max: Option<f64>,
    allowed_values: Option<Vec<f64>>,
    step: Option<f64>,
}

impl ParameterBoundsBuilder {
    pub fn min(mut self, min: f64) -> Self {
        self.min = Some(min);
        self
    }

    pub fn max(mut self, max: f64) -> Self {
        self.max = Some(max);
        self
    }

    pub fn allowed_values(mut self, values: Vec<f64>) -> Self {
        self.allowed_values = Some(values);
        self
    }

    pub fn step(mut self, step: f64) -> Self {
        self.step = Some(step);
        self
    }

    pub fn build(self) -> ParameterBounds {
        ParameterBounds {
            min: self.min,
            max: self.max,
            allowed_values: self.allowed_values,
            step: self.step,
        }
    }
}
```

---

## Domain Events in Rust

### Event Pattern using Enums

Rust enums are perfect for domain events - type-safe, exhaustive matching, and efficient.

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Domain Events for the Swarm context
///
/// Each variant represents a significant domain occurrence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DomainEvent {
    // Swarm lifecycle events
    SwarmInitialized {
        swarm_id: SwarmId,
        topology: Topology,
        timestamp: DateTime<Utc>,
    },

    // Agent events
    AgentJoined {
        swarm_id: SwarmId,
        agent_id: AgentId,
        timestamp: DateTime<Utc>,
    },

    AgentLeft {
        swarm_id: SwarmId,
        agent_id: AgentId,
        reason: LeaveReason,
        timestamp: DateTime<Utc>,
    },

    AgentStatusChanged {
        swarm_id: SwarmId,
        agent_id: AgentId,
        new_status: AgentStatus,
        timestamp: DateTime<Utc>,
    },

    // Consensus events
    ConsensusReached {
        swarm_id: SwarmId,
        consensus_id: ConsensusId,
        term: u64,
        timestamp: DateTime<Utc>,
    },

    LeaderElected {
        swarm_id: SwarmId,
        leader_id: AgentId,
        term: u64,
        timestamp: DateTime<Utc>,
    },

    // Topology events
    TopologyChanged {
        swarm_id: SwarmId,
        old_topology: Topology,
        new_topology: Topology,
        timestamp: DateTime<Utc>,
    },
}

impl DomainEvent {
    /// Get timestamp from any event variant
    pub fn timestamp(&self) -> DateTime<Utc> {
        match self {
            DomainEvent::SwarmInitialized { timestamp, .. } => *timestamp,
            DomainEvent::AgentJoined { timestamp, .. } => *timestamp,
            DomainEvent::AgentLeft { timestamp, .. } => *timestamp,
            DomainEvent::AgentStatusChanged { timestamp, .. } => *timestamp,
            DomainEvent::ConsensusReached { timestamp, .. } => *timestamp,
            DomainEvent::LeaderElected { timestamp, .. } => *timestamp,
            DomainEvent::TopologyChanged { timestamp, .. } => *timestamp,
        }
    }

    /// Get event type name
    pub fn event_type(&self) -> &'static str {
        match self {
            DomainEvent::SwarmInitialized { .. } => "SwarmInitialized",
            DomainEvent::AgentJoined { .. } => "AgentJoined",
            DomainEvent::AgentLeft { .. } => "AgentLeft",
            DomainEvent::AgentStatusChanged { .. } => "AgentStatusChanged",
            DomainEvent::ConsensusReached { .. } => "ConsensusReached",
            DomainEvent::LeaderElected { .. } => "LeaderElected",
            DomainEvent::TopologyChanged { .. } => "TopologyChanged",
        }
    }

    /// Get affected swarm ID
    pub fn swarm_id(&self) -> SwarmId {
        match self {
            DomainEvent::SwarmInitialized { swarm_id, .. } => *swarm_id,
            DomainEvent::AgentJoined { swarm_id, .. } => *swarm_id,
            DomainEvent::AgentLeft { swarm_id, .. } => *swarm_id,
            DomainEvent::AgentStatusChanged { swarm_id, .. } => *swarm_id,
            DomainEvent::ConsensusReached { swarm_id, .. } => *swarm_id,
            DomainEvent::LeaderElected { swarm_id, .. } => *swarm_id,
            DomainEvent::TopologyChanged { swarm_id, .. } => *swarm_id,
        }
    }
}
```

### Event Handler Pattern

```rust
/// Event handler trait for processing domain events
pub trait EventHandler: Send + Sync {
    fn handle(&self, event: &DomainEvent) -> Result<(), EventError>;

    /// Filter events this handler cares about
    fn handles(&self, event: &DomainEvent) -> bool {
        true // Default: handle all events
    }
}

/// Event dispatcher for routing events to handlers
pub struct EventDispatcher {
    handlers: Vec<Box<dyn EventHandler>>,
}

impl EventDispatcher {
    pub fn new() -> Self {
        Self { handlers: Vec::new() }
    }

    pub fn register(&mut self, handler: Box<dyn EventHandler>) {
        self.handlers.push(handler);
    }

    pub fn dispatch(&self, event: &DomainEvent) -> Result<(), EventError> {
        for handler in &self.handlers {
            if handler.handles(event) {
                handler.handle(event)?;
            }
        }
        Ok(())
    }

    pub async fn dispatch_async(&self, event: DomainEvent) {
        // Clone event for async dispatch
        for handler in &self.handlers {
            if handler.handles(&event) {
                let _ = handler.handle(&event);
            }
        }
    }
}
```

---

## Repositories in Rust

### Repository Trait Pattern

```rust
use async_trait::async_trait;

/// Repository trait for Swarm aggregate
///
/// Defines persistence operations without implementation details.
#[async_trait]
pub trait SwarmRepository: Send + Sync {
    /// Find swarm by ID
    async fn find(&self, id: SwarmId) -> Result<Option<Swarm>, RepositoryError>;

    /// Find swarms by topology type
    async fn find_by_topology(&self, topology: TopologyType) -> Result<Vec<Swarm>, RepositoryError>;

    /// Save swarm (create or update)
    async fn save(&self, swarm: &Swarm) -> Result<(), RepositoryError>;

    /// Delete swarm
    async fn delete(&self, id: SwarmId) -> Result<(), RepositoryError>;

    /// Check if swarm exists
    async fn exists(&self, id: SwarmId) -> Result<bool, RepositoryError> {
        Ok(self.find(id).await?.is_some())
    }
}

/// Repository error types
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Duplicate entity: {0}")]
    Duplicate(String),

    #[error("Persistence error: {0}")]
    Persistence(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
```

### In-Memory Repository Implementation

```rust
use std::sync::RwLock;
use std::collections::HashMap;

/// In-memory implementation for testing
pub struct InMemorySwarmRepository {
    storage: RwLock<HashMap<SwarmId, Swarm>>,
}

impl InMemorySwarmRepository {
    pub fn new() -> Self {
        Self {
            storage: RwLock::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl SwarmRepository for InMemorySwarmRepository {
    async fn find(&self, id: SwarmId) -> Result<Option<Swarm>, RepositoryError> {
        let storage = self.storage.read()
            .map_err(|e| RepositoryError::Persistence(e.to_string()))?;
        Ok(storage.get(&id).cloned())
    }

    async fn find_by_topology(&self, topology: TopologyType) -> Result<Vec<Swarm>, RepositoryError> {
        let storage = self.storage.read()
            .map_err(|e| RepositoryError::Persistence(e.to_string()))?;
        Ok(storage.values()
            .filter(|s| s.topology().topology_type() == topology)
            .cloned()
            .collect())
    }

    async fn save(&self, swarm: &Swarm) -> Result<(), RepositoryError> {
        let mut storage = self.storage.write()
            .map_err(|e| RepositoryError::Persistence(e.to_string()))?;
        storage.insert(swarm.id(), swarm.clone());
        Ok(())
    }

    async fn delete(&self, id: SwarmId) -> Result<(), RepositoryError> {
        let mut storage = self.storage.write()
            .map_err(|e| RepositoryError::Persistence(e.to_string()))?;
        storage.remove(&id);
        Ok(())
    }
}
```

---

## Domain Services in Rust

### Service Pattern

```rust
/// Domain Service: SemanticRouter
///
/// Encapsulates complex routing logic that doesn't belong to a single entity.
pub struct SemanticRouter {
    index: HNSWIndex,
    config: RouterConfig,
}

impl SemanticRouter {
    pub fn new(config: RouterConfig) -> Self {
        Self {
            index: HNSWIndex::new(config.dimensions, config.ef_construction),
            config,
        }
    }

    /// Route query to most relevant agents
    pub fn route(&self, query: &Query, top_k: usize) -> Vec<RoutingResult> {
        let embedding = query.embedding();

        self.index.search(embedding, top_k)
            .into_iter()
            .map(|(agent_id, distance)| RoutingResult {
                agent_id,
                relevance: 1.0 - distance,  // Convert distance to relevance
            })
            .collect()
    }

    /// Update agent embedding
    pub fn update_agent(&mut self, agent_id: AgentId, embedding: Vec<f32>) {
        self.index.upsert(agent_id.as_index(), embedding);
    }

    /// Remove agent from index
    pub fn remove_agent(&mut self, agent_id: AgentId) {
        self.index.remove(agent_id.as_index());
    }
}

/// Stateless domain service as functions
pub mod consensus_service {
    use super::*;

    /// Calculate quorum size for given agent count
    pub fn quorum_size(agent_count: usize) -> usize {
        agent_count / 2 + 1
    }

    /// Check if votes meet quorum
    pub fn has_quorum(votes: &[AgentId], total_agents: usize) -> bool {
        votes.len() >= quorum_size(total_agents)
    }

    /// Determine election timeout with jitter
    pub fn election_timeout(base: Duration) -> Duration {
        use rand::Rng;
        let jitter = rand::thread_rng().gen_range(0..150);
        base + Duration::from_millis(jitter)
    }
}
```

---

## Factory Pattern in Rust

### Builder/Factory Pattern

```rust
/// Factory for creating configured Swarm instances
pub struct SwarmFactory {
    default_topology: Topology,
    default_max_agents: usize,
    coordinator_factory: CoordinatorFactory,
    router_factory: RouterFactory,
}

impl SwarmFactory {
    pub fn new() -> Self {
        Self {
            default_topology: Topology::mesh(100),
            default_max_agents: 100,
            coordinator_factory: CoordinatorFactory::new(),
            router_factory: RouterFactory::new(),
        }
    }

    /// Create swarm with defaults
    pub fn create(&self) -> Swarm {
        self.create_with_options(SwarmOptions::default())
    }

    /// Create swarm with options
    pub fn create_with_options(&self, options: SwarmOptions) -> Swarm {
        let topology = options.topology.unwrap_or_else(|| self.default_topology.clone());
        let max_agents = options.max_agents.unwrap_or(self.default_max_agents);

        let mut swarm = Swarm::new(SwarmId::new(), topology.clone(), max_agents);

        // Configure components
        if let Some(consensus_config) = options.consensus_config {
            swarm.configure_consensus(consensus_config);
        }

        if let Some(router_config) = options.router_config {
            swarm.configure_router(router_config);
        }

        swarm
    }
}

#[derive(Default)]
pub struct SwarmOptions {
    pub topology: Option<Topology>,
    pub max_agents: Option<usize>,
    pub consensus_config: Option<ConsensusConfig>,
    pub router_config: Option<RouterConfig>,
}

impl SwarmOptions {
    pub fn builder() -> SwarmOptionsBuilder {
        SwarmOptionsBuilder::default()
    }
}

#[derive(Default)]
pub struct SwarmOptionsBuilder {
    options: SwarmOptions,
}

impl SwarmOptionsBuilder {
    pub fn topology(mut self, topology: Topology) -> Self {
        self.options.topology = Some(topology);
        self
    }

    pub fn max_agents(mut self, max: usize) -> Self {
        self.options.max_agents = Some(max);
        self
    }

    pub fn consensus(mut self, config: ConsensusConfig) -> Self {
        self.options.consensus_config = Some(config);
        self
    }

    pub fn router(mut self, config: RouterConfig) -> Self {
        self.options.router_config = Some(config);
        self
    }

    pub fn build(self) -> SwarmOptions {
        self.options
    }
}
```

---

## Error Handling Pattern

### Domain-Specific Errors

```rust
use thiserror::Error;

/// Domain errors for the Swarm context
#[derive(Debug, Error)]
pub enum SwarmError {
    #[error("Swarm capacity exceeded: max {max}, current {current}")]
    CapacityExceeded { max: usize, current: usize },

    #[error("Agent {0} not found in swarm")]
    AgentNotFound(AgentId),

    #[error("Agent {0} already exists in swarm")]
    DuplicateAgent(AgentId),

    #[error("Invalid state transition: cannot transition from {from:?} to {to:?}")]
    InvalidStateTransition { from: SwarmState, to: SwarmState },

    #[error("Consensus error: {0}")]
    Consensus(#[from] ConsensusError),

    #[error("Routing error: {0}")]
    Routing(#[from] RoutingError),

    #[error("Not the leader (current leader: {leader:?})")]
    NotLeader { leader: Option<AgentId> },
}

/// Result type alias for Swarm operations
pub type SwarmResult<T> = Result<T, SwarmError>;
```

---

## Testing Pattern

### Domain Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Test fixture
    fn create_test_swarm() -> Swarm {
        SwarmFactory::new()
            .create_with_options(SwarmOptions::builder()
                .topology(Topology::mesh(10))
                .max_agents(10)
                .build())
    }

    fn create_test_agent(name: &str) -> Agent {
        Agent::new(name.to_string(), AgentType::Feature)
    }

    #[test]
    fn test_add_agent_to_swarm() {
        let mut swarm = create_test_swarm();
        let agent = create_test_agent("test-agent");
        let agent_id = agent.id();

        let result = swarm.add_agent(agent);

        assert!(result.is_ok());
        assert!(swarm.get_agent(&agent_id).is_some());
    }

    #[test]
    fn test_swarm_capacity_enforcement() {
        let mut swarm = SwarmFactory::new()
            .create_with_options(SwarmOptions::builder()
                .max_agents(2)
                .build());

        // Add two agents successfully
        swarm.add_agent(create_test_agent("agent-1")).unwrap();
        swarm.add_agent(create_test_agent("agent-2")).unwrap();

        // Third should fail
        let result = swarm.add_agent(create_test_agent("agent-3"));

        assert!(matches!(result, Err(SwarmError::CapacityExceeded { .. })));
    }

    #[test]
    fn test_domain_events_generated() {
        let mut swarm = create_test_swarm();
        let agent = create_test_agent("test-agent");

        swarm.add_agent(agent).unwrap();

        let events = swarm.drain_events();

        assert_eq!(events.len(), 1);
        assert!(matches!(events[0], DomainEvent::AgentJoined { .. }));
    }

    #[test]
    fn test_value_object_equality() {
        let code1 = FAJCode::new("FAJ000123").unwrap();
        let code2 = FAJCode::new("FAJ000123").unwrap();
        let code3 = FAJCode::new("FAJ000456").unwrap();

        assert_eq!(code1, code2);  // Same value = equal
        assert_ne!(code1, code3);  // Different value = not equal
    }

    #[test]
    fn test_entity_equality_by_id() {
        let agent1 = Agent::new("name".to_string(), AgentType::Feature);
        let agent2 = Agent::new("name".to_string(), AgentType::Feature);

        // Same properties but different IDs = not equal
        assert_ne!(agent1, agent2);

        // Clone preserves ID = equal
        let agent3 = agent1.clone();
        assert_eq!(agent1, agent3);
    }
}
```

---

## Module Organization

### Recommended Directory Structure

```
src/
├── lib.rs                    # Crate root, exports public API
├── domain/                   # Domain layer
│   ├── mod.rs
│   ├── swarm/               # Swarm bounded context
│   │   ├── mod.rs
│   │   ├── aggregate.rs     # Swarm aggregate root
│   │   ├── entities.rs      # Agent, Coordinator, Router
│   │   ├── value_objects.rs # Topology, AgentAddress
│   │   ├── events.rs        # Domain events
│   │   ├── errors.rs        # Domain errors
│   │   └── services.rs      # Domain services
│   ├── intelligence/        # Intelligence bounded context
│   │   └── ...
│   └── optimization/        # Optimization bounded context
│       └── ...
├── application/             # Application layer
│   ├── mod.rs
│   ├── commands.rs          # Command handlers
│   ├── queries.rs           # Query handlers
│   └── services.rs          # Application services
├── infrastructure/          # Infrastructure layer
│   ├── mod.rs
│   ├── persistence/         # Repository implementations
│   │   ├── mod.rs
│   │   ├── in_memory.rs
│   │   └── sqlite.rs
│   └── messaging/           # Event publishing
│       └── mod.rs
└── presentation/            # Presentation layer (API)
    ├── mod.rs
    ├── rest/
    └── cli/
```

---

## Summary

| Pattern | Rust Idiom | Key Points |
|---------|-----------|------------|
| **Aggregate** | struct + impl | Private fields, public methods enforce invariants |
| **Entity** | struct + ID field | `PartialEq`/`Hash` on ID only |
| **Value Object** | struct + derives | `Clone, Copy, PartialEq, Eq, Hash` |
| **Domain Event** | enum | Tagged variants with `Serialize/Deserialize` |
| **Repository** | async trait | `Send + Sync` bounds for thread safety |
| **Service** | struct or module | Stateless operations as functions |
| **Factory** | struct + builder | Fluent API for complex construction |
| **Error** | enum + thiserror | Domain-specific error types |
