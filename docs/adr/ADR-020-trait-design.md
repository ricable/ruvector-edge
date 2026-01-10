# ADR-020: Trait Design for Agent System

## Status
Accepted

## Context
The 593-agent neural system requires extensible abstractions for:

- **Agent Behavior:** Common interface across specialized agents
- **Learning Algorithms:** Q-learning, federated learning, experience replay
- **Memory Systems:** HNSW, caching, persistence
- **Communication:** Message passing, consensus protocols
- **Routing:** Query routing, load balancing

Design tensions:
- **Generics vs Trait Objects:** Monomorphization vs dynamic dispatch
- **Associated Types vs Generic Parameters:** Flexibility vs complexity
- **Object Safety:** Not all traits can be used as trait objects
- **Backward Compatibility:** Traits are public API contracts
- **Performance:** Virtual dispatch has overhead

Rust traits provide the foundation for polymorphism, but design choices impact performance, usability, and evolution.

## Decision
We adopt a **Layered Trait Hierarchy** with clear guidelines for generics vs trait objects:

### 1. Core Agent Traits

```rust
/// Core agent abstraction - the fundamental interface
pub trait Agent: Send + Sync {
    /// Agent's unique identifier
    fn id(&self) -> &AgentId;

    /// Feature this agent specializes in
    fn feature(&self) -> &FeatureCode;

    /// Current agent state
    fn state(&self) -> AgentState;

    /// Process input and produce output
    fn process(&mut self, input: &Input) -> Result<Output, AgentError>;

    /// Reset agent to initial state
    fn reset(&mut self);
}

/// Extension for agents with learning capability
pub trait LearningAgent: Agent {
    /// Learning algorithm type
    type Learner: Learner;

    /// Access the learner
    fn learner(&self) -> &Self::Learner;

    /// Mutable access to learner
    fn learner_mut(&mut self) -> &mut Self::Learner;

    /// Update from experience
    fn learn(&mut self, experience: &Experience) -> Result<(), LearningError> {
        self.learner_mut().update(experience)
    }

    /// Export learned state
    fn export_knowledge(&self) -> Vec<u8> {
        self.learner().export()
    }

    /// Import learned state
    fn import_knowledge(&mut self, data: &[u8]) -> Result<(), LearningError> {
        self.learner_mut().import(data)
    }
}

/// Marker trait for agents that can be queried
pub trait Queryable: Agent {
    /// Query types this agent handles
    type Query;
    type Response;

    /// Handle a query
    fn query(&self, query: &Self::Query) -> Result<Self::Response, AgentError>;
}
```

### 2. Learning Trait Hierarchy

```rust
/// Core learning abstraction
pub trait Learner: Send + Sync {
    /// State representation type
    type State;

    /// Action representation type
    type Action;

    /// Select action for given state
    fn select_action(&self, state: &Self::State) -> Self::Action;

    /// Update from experience
    fn update(&mut self, experience: &Experience) -> Result<(), LearningError>;

    /// Export learned parameters
    fn export(&self) -> Vec<u8>;

    /// Import learned parameters
    fn import(&mut self, data: &[u8]) -> Result<(), LearningError>;
}

/// Q-learning specific interface
pub trait QLearner: Learner {
    /// Get Q-value for state-action pair
    fn get_q_value(&self, state: &Self::State, action: &Self::Action) -> f64;

    /// Get all Q-values for a state
    fn get_q_values(&self, state: &Self::State) -> Vec<f64>;

    /// Get current exploration rate
    fn exploration_rate(&self) -> f64;

    /// Set exploration rate
    fn set_exploration_rate(&mut self, rate: f64);

    /// Decay exploration rate
    fn decay_exploration(&mut self, factor: f64) {
        let current = self.exploration_rate();
        self.set_exploration_rate(current * factor);
    }
}

/// Federated learning participant
pub trait FederatedLearner: Learner {
    /// Get local model delta since last sync
    fn get_delta(&self) -> ModelDelta;

    /// Apply aggregated delta from federation
    fn apply_delta(&mut self, delta: &ModelDelta) -> Result<(), LearningError>;

    /// Mark sync point
    fn mark_sync(&mut self);
}

/// Experience replay capability
pub trait ReplayBuffer {
    type Experience;

    /// Add experience to buffer
    fn push(&mut self, experience: Self::Experience);

    /// Sample batch for training
    fn sample(&self, batch_size: usize) -> Vec<&Self::Experience>;

    /// Current buffer size
    fn len(&self) -> usize;

    /// Clear buffer
    fn clear(&mut self);
}
```

### 3. Memory and Search Traits

```rust
/// Vector storage abstraction
pub trait VectorStore: Send + Sync {
    /// Insert vector with ID
    fn insert(&mut self, id: VectorId, vector: &[f32]) -> Result<(), MemoryError>;

    /// Remove vector by ID
    fn remove(&mut self, id: &VectorId) -> Result<bool, MemoryError>;

    /// Search for k nearest neighbors
    fn search(&self, query: &[f32], k: usize) -> Result<Vec<SearchResult>, MemoryError>;

    /// Get vector by ID
    fn get(&self, id: &VectorId) -> Option<&[f32]>;

    /// Number of stored vectors
    fn len(&self) -> usize;

    fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// HNSW-specific interface
pub trait HNSWIndex: VectorStore {
    /// Build index from scratch
    fn build(&mut self, vectors: &[(VectorId, Vec<f32>)]) -> Result<(), MemoryError>;

    /// Get index parameters
    fn params(&self) -> HNSWParams;

    /// Resize index capacity
    fn resize(&mut self, new_capacity: usize) -> Result<(), MemoryError>;
}

/// Caching abstraction
pub trait Cache<K, V>: Send + Sync {
    /// Get value by key
    fn get(&self, key: &K) -> Option<&V>;

    /// Insert key-value pair
    fn insert(&mut self, key: K, value: V) -> Option<V>;

    /// Remove by key
    fn remove(&mut self, key: &K) -> Option<V>;

    /// Check if key exists
    fn contains(&self, key: &K) -> bool {
        self.get(key).is_some()
    }

    /// Current cache size
    fn len(&self) -> usize;

    /// Clear all entries
    fn clear(&mut self);
}
```

### 4. Communication Traits

```rust
/// Message routing abstraction
pub trait Router: Send + Sync {
    /// Route query to appropriate agent(s)
    fn route(&self, query: &Query) -> Vec<AgentId>;

    /// Get routing metrics
    fn metrics(&self) -> RouterMetrics;
}

/// Semantic routing using embeddings
pub trait SemanticRouter: Router {
    /// Update routing index with agent capabilities
    fn register_agent(&mut self, agent_id: AgentId, capabilities: &[f32]);

    /// Remove agent from routing
    fn unregister_agent(&mut self, agent_id: &AgentId);
}

/// Message handling
pub trait MessageHandler: Send + Sync {
    type Message: Message;

    /// Handle incoming message
    fn handle(&mut self, message: Self::Message) -> Result<Option<Self::Message>, AgentError>;

    /// Check if handler accepts message type
    fn accepts(&self, message: &Self::Message) -> bool;
}

/// Message trait for type-safe messaging
pub trait Message: Clone + Send + 'static {
    /// Message type identifier
    fn message_type(&self) -> &'static str;

    /// Serialize to bytes
    fn to_bytes(&self) -> Vec<u8>;

    /// Deserialize from bytes
    fn from_bytes(bytes: &[u8]) -> Result<Self, SerializationError>
    where
        Self: Sized;
}
```

### 5. Trait Object vs Generics Guidelines

```rust
/// When to use trait objects (dyn Trait)
///
/// Use trait objects when:
/// 1. Heterogeneous collections needed
/// 2. Plugin/extension architecture
/// 3. Runtime polymorphism required
/// 4. Binary size is a concern

// Example: Agent registry with different agent types
pub struct AgentRegistry {
    agents: HashMap<AgentId, Box<dyn Agent>>,
}

impl AgentRegistry {
    pub fn register(&mut self, agent: Box<dyn Agent>) {
        self.agents.insert(agent.id().clone(), agent);
    }

    pub fn get(&self, id: &AgentId) -> Option<&dyn Agent> {
        self.agents.get(id).map(|b| b.as_ref())
    }
}

/// When to use generics
///
/// Use generics when:
/// 1. Performance critical (avoid virtual dispatch)
/// 2. Type information needed at compile time
/// 3. Associated types needed
/// 4. Static dispatch preferred

// Example: High-performance learning loop
pub fn train_agent<L: QLearner>(
    learner: &mut L,
    experiences: &[Experience],
) -> f64 {
    let mut total_loss = 0.0;
    for exp in experiences {
        // Static dispatch - no virtual call overhead
        learner.update(exp).unwrap();
        total_loss += compute_loss(learner, exp);
    }
    total_loss / experiences.len() as f64
}

// Example: Generic SIMD operations
pub trait SimdOps {
    fn dot_product(&self, a: &[f32], b: &[f32]) -> f32;
    fn normalize(&self, v: &mut [f32]);
}

pub struct SimdAccelerated<S: SimdOps> {
    ops: S,
}
```

### 6. Object Safety Considerations

```rust
/// Object-safe version of Agent trait
pub trait DynAgent: Send + Sync {
    fn id(&self) -> &AgentId;
    fn feature(&self) -> &FeatureCode;
    fn state(&self) -> AgentState;

    // Object-safe: no Self in return type
    fn process_boxed(&mut self, input: &Input) -> Result<Box<dyn Any>, AgentError>;
}

/// Non-object-safe trait (has associated types with generics)
pub trait TypedAgent {
    type Input;
    type Output;

    // Not object-safe: associated types are generic
    fn process(&mut self, input: Self::Input) -> Result<Self::Output, AgentError>;
}

/// Make non-object-safe traits usable via wrapper
pub struct DynWrapper<T>(T);

impl<T: TypedAgent> DynAgent for DynWrapper<T>
where
    T::Input: 'static,
    T::Output: 'static,
    T: Send + Sync,
{
    fn id(&self) -> &AgentId { /* ... */ }
    fn feature(&self) -> &FeatureCode { /* ... */ }
    fn state(&self) -> AgentState { /* ... */ }

    fn process_boxed(&mut self, input: &Input) -> Result<Box<dyn Any>, AgentError> {
        // Downcast input, process, box output
        let typed_input = input.downcast_ref::<T::Input>()
            .ok_or(AgentError::TypeMismatch)?;
        let output = self.0.process(typed_input.clone())?;
        Ok(Box::new(output))
    }
}
```

### 7. Extension Points

```rust
/// Extension trait pattern for optional functionality
pub trait AgentExt: Agent {
    /// Check if agent supports capability
    fn has_capability(&self, cap: Capability) -> bool {
        false // Default: no extra capabilities
    }

    /// Get metrics if supported
    fn metrics(&self) -> Option<AgentMetrics> {
        None
    }
}

// Blanket implementation for all agents
impl<T: Agent> AgentExt for T {}

/// Capability marker traits
pub trait Debuggable: Agent {
    fn debug_state(&self) -> String;
}

pub trait Inspectable: Agent {
    fn inspect(&self) -> AgentInspection;
}

// Conditional implementation based on feature
#[cfg(feature = "debug")]
impl<T: Agent + std::fmt::Debug> Debuggable for T {
    fn debug_state(&self) -> String {
        format!("{:?}", self)
    }
}
```

### 8. Backward Compatibility Strategy

```rust
/// Sealed trait pattern for controlled extension
mod private {
    pub trait Sealed {}
}

/// Public trait that cannot be implemented outside crate
pub trait CoreAgent: private::Sealed + Agent {
    // Methods that should not be overridden
}

// Only internal types can implement CoreAgent
impl private::Sealed for FeatureAgent {}
impl CoreAgent for FeatureAgent {}

/// Versioned trait for evolution
pub trait AgentV1 {
    fn process_v1(&mut self, input: &InputV1) -> OutputV1;
}

pub trait AgentV2: AgentV1 {
    fn process_v2(&mut self, input: &InputV2) -> OutputV2;

    // Default implementation bridges to V1
    fn process_v1(&mut self, input: &InputV1) -> OutputV1 {
        let v2_input = InputV2::from(input);
        let v2_output = self.process_v2(&v2_input);
        OutputV1::from(v2_output)
    }
}
```

## Alternatives Considered

### No Traits (Concrete Types Only)
- **Pros:** Simple, maximum performance
- **Cons:** No polymorphism, code duplication
- **Rejected:** 593 specialized agents need common interface

### Enum-based Polymorphism
- **Pros:** No heap allocation, pattern matching
- **Cons:** Cannot extend without modifying enum
- **Partial:** Used for closed sets (message types)

### Type Erasure via Any
- **Pros:** Maximum flexibility
- **Cons:** No type safety, runtime errors
- **Rejected:** Type safety is a core value

### Async Traits (async_trait)
- **Pros:** Async in trait methods
- **Cons:** Boxing overhead, HRTB issues
- **Partial:** Used where async is essential, not everywhere

### Trait Aliases
- **Pros:** Combine multiple traits conveniently
- **Cons:** Unstable feature
- **Deferred:** Will use when stabilized

## Consequences

### Positive
- **Extensibility:** New agent types implement existing traits
- **Testability:** Mock implementations for testing
- **Performance Choice:** Generics where speed matters, dyn where flexibility matters
- **Type Safety:** Compile-time checks prevent misuse
- **Documentation:** Traits serve as interface documentation

### Negative
- **Learning Curve:** Trait system has complexity
- **Object Safety Rules:** Some designs impossible with dyn
- **Compilation Time:** Heavy generics slow builds
- **API Stability:** Trait changes break implementations

### Risks
- **Over-Abstraction:** Too many traits increase complexity
- **Leaky Abstractions:** Implementation details leak through traits
- **Orphan Rules:** Cannot implement external traits for external types
- **Trait Object Overhead:** dyn has ~15-20% overhead vs static dispatch

### Mitigations
- **Minimal Traits:** Start simple, add traits as needed
- **Clear Boundaries:** Document what traits abstract
- **Newtype Pattern:** Wrap external types when needed
- **Profile-Guided:** Use generics in hot paths identified by profiling

## References
- ADR-011: Rust Memory Model
- ADR-015: Error Handling
- Rust Book: Traits - https://doc.rust-lang.org/book/ch10-02-traits.html
- Rust API Guidelines - https://rust-lang.github.io/api-guidelines/
- "Abstraction without overhead" - https://blog.rust-lang.org/2015/05/11/traits.html
- Object Safety RFC - https://github.com/rust-lang/rfcs/blob/master/text/0255-object-safety.md
