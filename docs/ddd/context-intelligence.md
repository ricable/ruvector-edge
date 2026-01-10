# Intelligence Bounded Context

## Domain Purpose

The Intelligence context implements reinforcement learning and pattern discovery for the 593-agent system. It manages Q-learning engines, federated learning synchronization, experience replay, and pattern recognition. This is a **Core Domain** that enables agents to learn and improve from experience.

---

## Context Map Position

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INTELLIGENCE CONTEXT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upstream Dependencies:                                            │
│  ├── Knowledge (Partnership) - feature semantics, parameter bounds │
│  └── Coordination (Customer-Supplier) - agent coordination state   │
│                                                                     │
│  Downstream Consumers:                                              │
│  ├── Optimization (Domain Events) - patterns inform optimization   │
│  └── Coordination (Published Language) - routing predictions       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Root: LearningAgent

The `LearningAgent` is the aggregate root that manages an agent's learning state, including its Q-table, experience buffer, and discovered patterns.

### Aggregate Boundary

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LearningAgent Aggregate                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │  LearningAgent  │ (Aggregate Root)                               │
│  │                 │                                                │
│  │  id             │                                                │
│  │  learning_rate  │                                                │
│  │  discount_factor│                                                │
│  │  exploration    │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           │ owns                                                     │
│           ▼                                                          │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │     QTable      │     │   Trajectory    │                        │
│  │    (Entity)     │     │   (Entity)      │                        │
│  │                 │     │                 │                        │
│  │  state-action   │     │  transitions    │                        │
│  │  values         │     │  rewards        │                        │
│  └─────────────────┘     └────────┬────────┘                        │
│                                   │                                  │
│                                   │ generates                        │
│                                   ▼                                  │
│                          ┌─────────────────┐                        │
│                          │    Pattern      │                        │
│                          │   (Entity)      │                        │
│                          │                 │                        │
│                          │  recurring      │                        │
│                          │  behaviors      │                        │
│                          └─────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invariants

1. **Q-Value Bounds**: Q-values must remain within configured bounds
2. **Experience Buffer Size**: Experience buffer cannot exceed maximum capacity
3. **Exploration Decay**: Exploration rate must decrease over time but never reach zero
4. **Pattern Confidence**: Patterns are only registered above confidence threshold

---

## Entities

### QTable

Stores state-action value mappings for Q-learning.

```rust
struct QTable {
    // Identity
    id: QTableId,
    agent_id: AgentId,

    // State-Action Values
    values: HashMap<StateActionPair, QValue>,

    // Learning Statistics
    update_count: u64,
    last_update: DateTime<Utc>,
    average_reward: f64,

    // Configuration
    default_value: QValue,
    value_bounds: (f64, f64),

    // Versioning (for federated sync)
    version: u64,
    merkle_root: [u8; 32],
}

impl QTable {
    /// Get Q-value for state-action pair
    fn get(&self, state: &State, action: &Action) -> QValue {
        let key = StateActionPair::new(state.clone(), action.clone());
        self.values.get(&key).copied().unwrap_or(self.default_value)
    }

    /// Update Q-value using TD learning
    fn update(
        &mut self,
        state: &State,
        action: &Action,
        reward: Reward,
        next_state: &State,
        learning_rate: f64,
        discount_factor: f64,
    ) {
        let current_q = self.get(state, action);
        let max_next_q = self.max_value(next_state);

        let new_q = current_q + learning_rate * (
            reward.value() + discount_factor * max_next_q - current_q
        );

        // Clamp to bounds
        let bounded_q = new_q.clamp(self.value_bounds.0, self.value_bounds.1);

        let key = StateActionPair::new(state.clone(), action.clone());
        self.values.insert(key, bounded_q);
        self.update_count += 1;
        self.last_update = Utc::now();
        self.version += 1;
    }

    /// Get best action for a state
    fn best_action(&self, state: &State, available_actions: &[Action]) -> Option<Action> {
        available_actions.iter()
            .max_by(|a, b| {
                let q_a = self.get(state, a);
                let q_b = self.get(state, b);
                q_a.partial_cmp(&q_b).unwrap_or(std::cmp::Ordering::Equal)
            })
            .cloned()
    }
}
```

### Trajectory

A sequence of state-action-reward transitions.

```rust
struct Trajectory {
    // Identity
    id: TrajectoryId,
    agent_id: AgentId,

    // Transitions
    transitions: Vec<Transition>,

    // Metadata
    start_time: DateTime<Utc>,
    end_time: Option<DateTime<Utc>>,
    total_reward: f64,

    // Outcome
    outcome: TrajectoryOutcome,
    terminal_state: Option<State>,
}

struct Transition {
    state: State,
    action: Action,
    reward: Reward,
    next_state: State,
    timestamp: DateTime<Utc>,
    metadata: TransitionMetadata,
}

impl Trajectory {
    /// Add a new transition
    fn add_transition(
        &mut self,
        state: State,
        action: Action,
        reward: Reward,
        next_state: State,
    ) {
        let transition = Transition {
            state,
            action,
            reward,
            next_state,
            timestamp: Utc::now(),
            metadata: TransitionMetadata::default(),
        };
        self.total_reward += reward.value();
        self.transitions.push(transition);
    }

    /// Mark trajectory as complete
    fn complete(&mut self, outcome: TrajectoryOutcome, terminal_state: State) {
        self.end_time = Some(Utc::now());
        self.outcome = outcome;
        self.terminal_state = Some(terminal_state);
    }

    /// Get trajectory length
    fn len(&self) -> usize {
        self.transitions.len()
    }

    /// Calculate discounted return
    fn discounted_return(&self, discount_factor: f64) -> f64 {
        self.transitions.iter()
            .enumerate()
            .map(|(i, t)| discount_factor.powi(i as i32) * t.reward.value())
            .sum()
    }
}
```

### Pattern

A discovered recurring behavior or optimization.

```rust
struct Pattern {
    // Identity
    id: PatternId,

    // Pattern Definition
    pattern_type: PatternType,
    state_signature: StateSignature,
    action_sequence: Vec<Action>,

    // Statistics
    occurrence_count: u64,
    success_rate: f64,
    average_reward: f64,

    // Confidence
    confidence: Confidence,
    last_observed: DateTime<Utc>,
    first_observed: DateTime<Utc>,

    // Context
    context_features: Vec<ContextFeature>,
    preconditions: Vec<Precondition>,
}

enum PatternType {
    OptimizationSequence,    // Sequence of parameter changes
    RecoveryProcedure,       // Actions to recover from error state
    PerformanceBoost,        // Actions that improve KPIs
    AvoidancePattern,        // Actions to avoid known problems
    ExplorationPath,         // Promising exploration directions
}

impl Pattern {
    /// Check if pattern applies to current state
    fn matches(&self, state: &State) -> bool {
        self.state_signature.matches(state) &&
        self.preconditions.iter().all(|p| p.satisfied(state))
    }

    /// Update pattern statistics
    fn record_observation(&mut self, success: bool, reward: f64) {
        self.occurrence_count += 1;
        let n = self.occurrence_count as f64;

        // Update running averages
        self.success_rate = ((n - 1.0) * self.success_rate + if success { 1.0 } else { 0.0 }) / n;
        self.average_reward = ((n - 1.0) * self.average_reward + reward) / n;

        // Update confidence
        self.confidence = self.calculate_confidence();
        self.last_observed = Utc::now();
    }

    fn calculate_confidence(&self) -> Confidence {
        // Confidence based on occurrence count and recency
        let recency_factor = self.recency_factor();
        let occurrence_factor = (self.occurrence_count as f64).ln() / 10.0;
        let success_factor = self.success_rate;

        Confidence::new(
            (recency_factor * 0.2 + occurrence_factor * 0.3 + success_factor * 0.5)
                .clamp(0.0, 1.0)
        )
    }
}
```

---

## Value Objects

### State

Represents the current state of the environment.

```rust
#[derive(Clone, PartialEq, Eq, Hash)]
struct State {
    // Feature states
    feature_states: BTreeMap<FeatureId, FeatureState>,

    // Current KPI values
    kpi_values: BTreeMap<KPIId, DiscretizedValue>,

    // Context
    context: StateContext,
}

impl State {
    /// Create state hash for Q-table lookup
    fn hash(&self) -> StateHash {
        let mut hasher = DefaultHasher::new();
        self.feature_states.hash(&mut hasher);
        self.kpi_values.hash(&mut hasher);
        StateHash(hasher.finish())
    }

    /// Get distance to another state
    fn distance(&self, other: &State) -> f64 {
        let feature_diff = self.feature_distance(&other.feature_states);
        let kpi_diff = self.kpi_distance(&other.kpi_values);
        (feature_diff + kpi_diff) / 2.0
    }
}
```

### Action

Represents an action that can be taken.

```rust
#[derive(Clone, PartialEq, Eq, Hash)]
enum Action {
    // Parameter modification
    SetParameter {
        parameter_id: ParameterId,
        value: DiscreteValue,
    },

    // Feature control
    ActivateFeature(FeatureId),
    DeactivateFeature(FeatureId),

    // Optimization
    ApplyOptimization {
        optimization_id: OptimizationId,
        intensity: DiscreteLevel,
    },

    // Coordination
    RequestConsensus(ConsensusType),
    DelegateToAgent(AgentId),

    // No-op
    Wait(Duration),
}
```

### Reward

Represents the reward received after an action.

```rust
#[derive(Clone, Copy, PartialEq)]
struct Reward {
    value: f64,
    components: RewardComponents,
}

struct RewardComponents {
    kpi_improvement: f64,    // Positive for KPI gains
    stability_bonus: f64,    // Bonus for stable changes
    risk_penalty: f64,       // Penalty for risky actions
    efficiency_bonus: f64,   // Bonus for efficient solutions
}

impl Reward {
    fn value(&self) -> f64 {
        self.value
    }

    fn from_kpi_change(before: &KPIValues, after: &KPIValues, risk: f64) -> Self {
        let improvement = after.total_score() - before.total_score();
        let stability = if improvement.abs() < 0.01 { 0.1 } else { 0.0 };
        let risk_penalty = risk * -0.5;

        let components = RewardComponents {
            kpi_improvement: improvement,
            stability_bonus: stability,
            risk_penalty,
            efficiency_bonus: 0.0,
        };

        Reward {
            value: improvement + stability + risk_penalty,
            components,
        }
    }
}
```

### Confidence

Represents confidence level in a prediction or pattern.

```rust
#[derive(Clone, Copy, PartialEq, PartialOrd)]
struct Confidence(f64);

impl Confidence {
    const MINIMUM_THRESHOLD: f64 = 0.3;
    const HIGH_THRESHOLD: f64 = 0.8;

    fn new(value: f64) -> Self {
        Confidence(value.clamp(0.0, 1.0))
    }

    fn is_sufficient(&self) -> bool {
        self.0 >= Self::MINIMUM_THRESHOLD
    }

    fn is_high(&self) -> bool {
        self.0 >= Self::HIGH_THRESHOLD
    }

    fn value(&self) -> f64 {
        self.0
    }
}
```

---

## Domain Services

### QLearningEngine

Core Q-learning implementation.

```rust
struct QLearningEngine {
    config: QLearningConfig,
    exploration_strategy: Box<dyn ExplorationStrategy>,
}

struct QLearningConfig {
    learning_rate: f64,           // Alpha
    discount_factor: f64,         // Gamma
    initial_exploration: f64,     // Epsilon
    exploration_decay: f64,
    min_exploration: f64,
}

impl QLearningEngine {
    /// Select action using epsilon-greedy or other strategy
    fn select_action(
        &self,
        q_table: &QTable,
        state: &State,
        available_actions: &[Action],
        episode: u64,
    ) -> Action {
        self.exploration_strategy.select(
            q_table,
            state,
            available_actions,
            episode,
        )
    }

    /// Update Q-table based on transition
    fn learn(
        &self,
        q_table: &mut QTable,
        transition: &Transition,
    ) {
        q_table.update(
            &transition.state,
            &transition.action,
            transition.reward,
            &transition.next_state,
            self.config.learning_rate,
            self.config.discount_factor,
        );
    }

    /// Batch update from trajectory
    fn learn_from_trajectory(
        &self,
        q_table: &mut QTable,
        trajectory: &Trajectory,
    ) {
        // Backward pass for TD(lambda) or similar
        for transition in trajectory.transitions.iter().rev() {
            self.learn(q_table, transition);
        }
    }
}

trait ExplorationStrategy: Send + Sync {
    fn select(
        &self,
        q_table: &QTable,
        state: &State,
        available_actions: &[Action],
        episode: u64,
    ) -> Action;
}

struct EpsilonGreedy {
    initial_epsilon: f64,
    decay_rate: f64,
    min_epsilon: f64,
}

impl ExplorationStrategy for EpsilonGreedy {
    fn select(
        &self,
        q_table: &QTable,
        state: &State,
        available_actions: &[Action],
        episode: u64,
    ) -> Action {
        let epsilon = (self.initial_epsilon * (-self.decay_rate * episode as f64).exp())
            .max(self.min_epsilon);

        if rand::random::<f64>() < epsilon {
            // Explore: random action
            available_actions.choose(&mut rand::thread_rng())
                .cloned()
                .unwrap_or(Action::Wait(Duration::from_secs(1)))
        } else {
            // Exploit: best known action
            q_table.best_action(state, available_actions)
                .unwrap_or(Action::Wait(Duration::from_secs(1)))
        }
    }
}
```

### FederatedMerger

Merges Q-tables from multiple agents without centralizing data.

```rust
struct FederatedMerger {
    merge_strategy: MergeStrategy,
    privacy_config: PrivacyConfig,
}

enum MergeStrategy {
    FedAvg { weighted: bool },      // Federated Averaging
    FedProx { mu: f64 },            // Federated Proximal
    SecureAggregation,              // Cryptographic aggregation
}

impl FederatedMerger {
    /// Merge Q-tables from multiple agents
    fn merge(&self, tables: Vec<QTableDelta>) -> QTableDelta {
        match &self.merge_strategy {
            MergeStrategy::FedAvg { weighted } => {
                self.federated_average(tables, *weighted)
            }
            MergeStrategy::FedProx { mu } => {
                self.federated_proximal(tables, *mu)
            }
            MergeStrategy::SecureAggregation => {
                self.secure_aggregate(tables)
            }
        }
    }

    fn federated_average(&self, tables: Vec<QTableDelta>, weighted: bool) -> QTableDelta {
        let mut merged = HashMap::new();
        let total_weight: f64 = if weighted {
            tables.iter().map(|t| t.weight).sum()
        } else {
            tables.len() as f64
        };

        for table in &tables {
            let weight = if weighted { table.weight } else { 1.0 };
            for (key, value) in &table.deltas {
                *merged.entry(key.clone()).or_insert(0.0) += value * weight / total_weight;
            }
        }

        QTableDelta {
            deltas: merged,
            weight: total_weight,
            version: tables.iter().map(|t| t.version).max().unwrap_or(0),
        }
    }

    /// Apply differential privacy noise
    fn apply_privacy(&self, delta: &mut QTableDelta) {
        if self.privacy_config.enabled {
            for value in delta.deltas.values_mut() {
                let noise = self.laplace_noise(self.privacy_config.epsilon);
                *value += noise;
            }
        }
    }
}

struct QTableDelta {
    deltas: HashMap<StateActionPair, f64>,
    weight: f64,
    version: u64,
}
```

### ExperienceReplay

Manages experience buffer for efficient learning.

```rust
struct ExperienceReplay {
    buffer: VecDeque<Transition>,
    capacity: usize,
    prioritized: bool,
    priorities: Option<Vec<f64>>,
}

impl ExperienceReplay {
    /// Add transition to buffer
    fn add(&mut self, transition: Transition, priority: Option<f64>) {
        if self.buffer.len() >= self.capacity {
            self.buffer.pop_front();
            if let Some(ref mut p) = self.priorities {
                p.remove(0);
            }
        }
        self.buffer.push_back(transition);
        if let Some(ref mut p) = self.priorities {
            p.push(priority.unwrap_or(1.0));
        }
    }

    /// Sample batch for training
    fn sample(&self, batch_size: usize) -> Vec<&Transition> {
        if self.prioritized {
            self.prioritized_sample(batch_size)
        } else {
            self.uniform_sample(batch_size)
        }
    }

    fn uniform_sample(&self, batch_size: usize) -> Vec<&Transition> {
        let mut rng = rand::thread_rng();
        self.buffer.iter()
            .choose_multiple(&mut rng, batch_size.min(self.buffer.len()))
    }

    fn prioritized_sample(&self, batch_size: usize) -> Vec<&Transition> {
        let priorities = self.priorities.as_ref().unwrap();
        let total: f64 = priorities.iter().sum();

        let mut result = Vec::with_capacity(batch_size);
        let mut rng = rand::thread_rng();

        for _ in 0..batch_size {
            let threshold = rng.gen::<f64>() * total;
            let mut cumulative = 0.0;

            for (i, p) in priorities.iter().enumerate() {
                cumulative += p;
                if cumulative >= threshold {
                    result.push(&self.buffer[i]);
                    break;
                }
            }
        }
        result
    }
}
```

### PatternDiscovery

Discovers patterns from trajectories.

```rust
struct PatternDiscovery {
    min_occurrence: u64,
    min_confidence: Confidence,
    sequence_matcher: SequenceMatcher,
}

impl PatternDiscovery {
    /// Analyze trajectories to discover patterns
    fn discover(&self, trajectories: &[Trajectory]) -> Vec<Pattern> {
        let mut candidates = HashMap::new();

        // Extract action sequences
        for trajectory in trajectories {
            if trajectory.outcome == TrajectoryOutcome::Success {
                let sequences = self.extract_sequences(trajectory);
                for seq in sequences {
                    candidates.entry(seq.signature())
                        .or_insert_with(Vec::new)
                        .push(seq);
                }
            }
        }

        // Filter by occurrence and build patterns
        candidates.into_iter()
            .filter(|(_, seqs)| seqs.len() as u64 >= self.min_occurrence)
            .filter_map(|(sig, seqs)| self.build_pattern(sig, seqs))
            .filter(|p| p.confidence.is_sufficient())
            .collect()
    }

    fn extract_sequences(&self, trajectory: &Trajectory) -> Vec<ActionSequence> {
        let mut sequences = Vec::new();

        // Sliding window over transitions
        for window_size in 2..=5 {
            for window in trajectory.transitions.windows(window_size) {
                let state_sig = StateSignature::from(&window[0].state);
                let actions: Vec<_> = window.iter().map(|t| t.action.clone()).collect();
                let total_reward: f64 = window.iter().map(|t| t.reward.value()).sum();

                sequences.push(ActionSequence {
                    state_signature: state_sig,
                    actions,
                    total_reward,
                });
            }
        }
        sequences
    }
}
```

---

## Domain Events

### QTableUpdated

Emitted when a Q-table is updated.

```rust
struct QTableUpdated {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    agent_id: AgentId,
    q_table_id: QTableId,
    update_count: u64,
    entries_modified: usize,
    average_delta: f64,
    version: u64,
}
```

### PatternDiscovered

Emitted when a new pattern is discovered.

```rust
struct PatternDiscovered {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    pattern_id: PatternId,
    pattern_type: PatternType,
    confidence: Confidence,
    occurrence_count: u64,
    action_count: usize,
    discovering_agent: AgentId,
}
```

### FederatedSyncCompleted

Emitted when federated learning sync completes.

```rust
struct FederatedSyncCompleted {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    sync_id: SyncId,
    participating_agents: Vec<AgentId>,
    entries_merged: usize,
    merge_strategy: MergeStrategy,
    new_global_version: u64,
    convergence_metric: f64,
}
```

### TrajectoryCompleted

Emitted when a learning trajectory completes.

```rust
struct TrajectoryCompleted {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    trajectory_id: TrajectoryId,
    agent_id: AgentId,
    outcome: TrajectoryOutcome,
    total_reward: f64,
    steps: usize,
    duration: Duration,
}
```

### ExplorationRateDecayed

Emitted when exploration rate changes significantly.

```rust
struct ExplorationRateDecayed {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    agent_id: AgentId,
    old_rate: f64,
    new_rate: f64,
    episode_count: u64,
}
```

---

## Repository Interfaces

### QTableRepository

```rust
trait QTableRepository {
    /// Load Q-table for agent
    fn load(&self, agent_id: &AgentId) -> Option<QTable>;

    /// Save Q-table
    fn save(&mut self, q_table: &QTable) -> Result<(), RepositoryError>;

    /// Get Q-table version
    fn get_version(&self, agent_id: &AgentId) -> Option<u64>;

    /// Get delta since version
    fn get_delta(&self, agent_id: &AgentId, since_version: u64) -> Option<QTableDelta>;

    /// Apply delta to stored Q-table
    fn apply_delta(&mut self, agent_id: &AgentId, delta: QTableDelta) -> Result<(), RepositoryError>;
}
```

### TrajectoryRepository

```rust
trait TrajectoryRepository {
    /// Save trajectory
    fn save(&mut self, trajectory: &Trajectory) -> Result<(), RepositoryError>;

    /// Get trajectories for agent
    fn find_by_agent(&self, agent_id: &AgentId, limit: usize) -> Vec<Trajectory>;

    /// Get successful trajectories
    fn find_successful(&self, limit: usize) -> Vec<Trajectory>;

    /// Get trajectories with state
    fn find_by_state(&self, state: &State, limit: usize) -> Vec<Trajectory>;

    /// Prune old trajectories
    fn prune(&mut self, older_than: DateTime<Utc>) -> usize;
}
```

### PatternRepository

```rust
trait PatternRepository {
    /// Find patterns by type
    fn find_by_type(&self, pattern_type: PatternType) -> Vec<Pattern>;

    /// Find patterns matching state
    fn find_matching(&self, state: &State) -> Vec<Pattern>;

    /// Save pattern
    fn save(&mut self, pattern: &Pattern) -> Result<(), RepositoryError>;

    /// Get high-confidence patterns
    fn find_high_confidence(&self) -> Vec<Pattern>;

    /// Update pattern statistics
    fn record_usage(&mut self, pattern_id: &PatternId, success: bool, reward: f64);
}
```

---

## Integration Points

### Events Published

| Event | Consumer Context | Action |
|-------|-----------------|--------|
| `PatternDiscovered` | Optimization | Consider pattern for optimization |
| `QTableUpdated` | Coordination | Update routing predictions |
| `FederatedSyncCompleted` | Coordination | Notify agents of new knowledge |

### Events Consumed

| Event | Source Context | Action |
|-------|----------------|--------|
| `FeatureLoaded` | Knowledge | Initialize Q-table entries |
| `KnowledgeUpdated` | Knowledge | Trigger relearning |
| `OptimizationProposed` | Optimization | Evaluate via Q-table |
| `RollbackTriggered` | Optimization | Learn from failure |

### Queries Exposed

| Query | Consumer | Response |
|-------|----------|----------|
| Best action for state | Coordination | Action with confidence |
| Pattern recommendations | Optimization | Matching patterns |
| Agent learning status | Coordination | Learning metrics |
