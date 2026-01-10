# Coordination Bounded Context

## Domain Purpose

The Coordination context manages multi-agent swarm coordination, consensus protocols, message routing, and topology management for the 593-agent system. This is a **Core Domain** that enables agents to work together effectively as a coordinated swarm.

---

## Context Map Position

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COORDINATION CONTEXT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upstream Dependencies:                                            │
│  ├── Security (Conformist) - authentication, message verification  │
│  └── Runtime (ACL) - agent lifecycle events                        │
│                                                                     │
│  Downstream Consumers:                                              │
│  ├── Optimization (Supplier) - provides orchestration services     │
│  └── Intelligence (Published Language) - routing predictions       │
│                                                                     │
│  Integration Style:                                                 │
│  └── Open Host Service for external coordination requests          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Root: Swarm

The `Swarm` is the aggregate root that manages a coordinated group of agents, their topology, consensus state, and message routing.

### Aggregate Boundary

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Swarm Aggregate                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │      Swarm      │ (Aggregate Root)                               │
│  │                 │                                                │
│  │  id             │                                                │
│  │  topology       │                                                │
│  │  state          │                                                │
│  │  max_agents     │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           │ owns                                                     │
│           ▼                                                          │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │   Coordinator   │     │     Router      │                        │
│  │    (Entity)     │     │    (Entity)     │                        │
│  │                 │     │                 │                        │
│  │  leader_state   │     │  routing_table  │                        │
│  │  term           │     │  hnsw_index     │                        │
│  └────────┬────────┘     └─────────────────┘                        │
│           │                                                          │
│           │ manages                                                  │
│           ▼                                                          │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │  MessageQueue   │     │ ConsensusState  │                        │
│  │    (Entity)     │     │ (Value Object)  │                        │
│  │                 │     │                 │                        │
│  │  pending        │     │  term           │                        │
│  │  in_flight      │     │  votes          │                        │
│  └─────────────────┘     └─────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invariants

1. **Single Leader**: At most one leader per consensus term
2. **Topology Consistency**: All agents must be connected per topology rules
3. **Message Ordering**: Messages within a topic maintain causal ordering
4. **Capacity Limits**: Agent count cannot exceed topology's max_agents
5. **Quorum Requirements**: Consensus requires quorum (n/2 + 1) participation

---

## Entities

### Swarm

Manages a coordinated group of agents.

```rust
struct Swarm {
    // Identity
    id: SwarmId,
    name: String,

    // Configuration
    topology: Topology,
    max_agents: usize,

    // State
    state: SwarmState,
    agents: HashMap<AgentId, AgentAddress>,

    // Components
    coordinator: Coordinator,
    router: Router,
    message_queue: MessageQueue,

    // Metrics
    metrics: SwarmMetrics,
    created_at: DateTime<Utc>,
}

#[derive(Clone, Copy, PartialEq)]
enum SwarmState {
    Initializing,
    Forming,           // Discovering and connecting agents
    Stabilizing,       // Establishing consensus
    Active,            // Normal operation
    Rebalancing,       // Topology adjustment in progress
    Degraded,          // Operating with reduced capacity
    Shutdown,
}

impl Swarm {
    /// Add agent to swarm
    fn add_agent(&mut self, agent_id: AgentId, address: AgentAddress) -> Result<(), SwarmError> {
        if self.agents.len() >= self.max_agents {
            return Err(SwarmError::CapacityExceeded);
        }

        if self.agents.contains_key(&agent_id) {
            return Err(SwarmError::AgentAlreadyExists);
        }

        self.agents.insert(agent_id, address.clone());
        self.router.update_routes(&self.agents);

        // Raise domain event
        self.raise(AgentJoined {
            swarm_id: self.id,
            agent_id,
            address,
            timestamp: Utc::now(),
        });

        Ok(())
    }

    /// Remove agent from swarm
    fn remove_agent(&mut self, agent_id: AgentId) -> Result<AgentAddress, SwarmError> {
        let address = self.agents.remove(&agent_id)
            .ok_or(SwarmError::AgentNotFound)?;

        self.router.update_routes(&self.agents);

        // Check if coordinator needs update
        if self.coordinator.is_leader(&agent_id) {
            self.coordinator.trigger_election();
        }

        self.raise(AgentLeft {
            swarm_id: self.id,
            agent_id,
            reason: LeaveReason::Removed,
            timestamp: Utc::now(),
        });

        Ok(address)
    }

    /// Route message to appropriate agent
    fn route_message(&self, message: Message) -> Result<AgentId, RoutingError> {
        self.router.route(&message, &self.agents)
    }

    /// Initiate consensus for a proposal
    fn propose(&mut self, proposal: Proposal) -> Result<ConsensusId, SwarmError> {
        if self.state != SwarmState::Active {
            return Err(SwarmError::InvalidState);
        }

        self.coordinator.propose(proposal, &self.agents)
    }

    /// Change topology
    fn change_topology(&mut self, new_topology: Topology) -> Result<(), SwarmError> {
        if !new_topology.supports_agent_count(self.agents.len()) {
            return Err(SwarmError::IncompatibleTopology);
        }

        let old_topology = std::mem::replace(&mut self.topology, new_topology.clone());
        self.state = SwarmState::Rebalancing;
        self.router.rebuild_for_topology(&new_topology, &self.agents);

        self.raise(TopologyChanged {
            swarm_id: self.id,
            old_topology,
            new_topology,
            timestamp: Utc::now(),
        });

        Ok(())
    }
}
```

### Coordinator

Manages consensus and leader election.

```rust
struct Coordinator {
    // Identity
    id: CoordinatorId,
    agent_id: AgentId,

    // Raft State
    role: CoordinatorRole,
    current_term: Term,
    voted_for: Option<AgentId>,
    log: Vec<LogEntry>,
    commit_index: u64,
    last_applied: u64,

    // Leader state (only valid if leader)
    next_index: HashMap<AgentId, u64>,
    match_index: HashMap<AgentId, u64>,

    // Timing
    election_timeout: Duration,
    heartbeat_interval: Duration,
    last_heartbeat: DateTime<Utc>,
}

#[derive(Clone, Copy, PartialEq)]
enum CoordinatorRole {
    Follower,
    Candidate,
    Leader,
}

struct LogEntry {
    term: Term,
    index: u64,
    command: ConsensusCommand,
    timestamp: DateTime<Utc>,
}

impl Coordinator {
    /// Request vote from peers (Raft RequestVote RPC)
    fn request_vote(&mut self, candidate_id: AgentId, term: Term, last_log: (u64, Term)) -> VoteResponse {
        // If term is stale, reject
        if term < self.current_term {
            return VoteResponse::Reject { term: self.current_term };
        }

        // If higher term, convert to follower
        if term > self.current_term {
            self.current_term = term;
            self.role = CoordinatorRole::Follower;
            self.voted_for = None;
        }

        // Check if already voted
        if self.voted_for.is_some() && self.voted_for != Some(candidate_id) {
            return VoteResponse::Reject { term: self.current_term };
        }

        // Check log is up-to-date
        let our_last = self.last_log_info();
        if last_log < our_last {
            return VoteResponse::Reject { term: self.current_term };
        }

        // Grant vote
        self.voted_for = Some(candidate_id);
        VoteResponse::Grant { term: self.current_term }
    }

    /// Append entries from leader (Raft AppendEntries RPC)
    fn append_entries(
        &mut self,
        leader_id: AgentId,
        term: Term,
        prev_log: (u64, Term),
        entries: Vec<LogEntry>,
        leader_commit: u64,
    ) -> AppendResponse {
        if term < self.current_term {
            return AppendResponse::Reject { term: self.current_term };
        }

        if term > self.current_term {
            self.current_term = term;
            self.role = CoordinatorRole::Follower;
        }

        self.last_heartbeat = Utc::now();

        // Check prev_log matches
        if !self.log_matches(prev_log.0, prev_log.1) {
            return AppendResponse::Reject { term: self.current_term };
        }

        // Append entries
        self.append_to_log(entries, prev_log.0);

        // Update commit index
        if leader_commit > self.commit_index {
            self.commit_index = leader_commit.min(self.log.len() as u64);
        }

        AppendResponse::Accept {
            term: self.current_term,
            match_index: self.log.len() as u64,
        }
    }

    /// Propose a command (if leader)
    fn propose(&mut self, proposal: Proposal, agents: &HashMap<AgentId, AgentAddress>) -> Result<ConsensusId, SwarmError> {
        if self.role != CoordinatorRole::Leader {
            return Err(SwarmError::NotLeader);
        }

        let entry = LogEntry {
            term: self.current_term,
            index: self.log.len() as u64 + 1,
            command: ConsensusCommand::Proposal(proposal.clone()),
            timestamp: Utc::now(),
        };

        self.log.push(entry);

        Ok(ConsensusId::new())
    }

    /// Trigger a new election
    fn trigger_election(&mut self) {
        self.current_term += 1;
        self.role = CoordinatorRole::Candidate;
        self.voted_for = Some(self.agent_id);
    }

    /// Check if agent is current leader
    fn is_leader(&self, agent_id: &AgentId) -> bool {
        self.role == CoordinatorRole::Leader && &self.agent_id == agent_id
    }
}
```

### Router

Handles message routing using semantic similarity.

```rust
struct Router {
    // Routing table
    routing_table: HashMap<AgentId, RoutingEntry>,

    // HNSW index for semantic routing
    hnsw_index: Option<HNSWIndex>,

    // Configuration
    routing_strategy: RoutingStrategy,
    load_balancing: LoadBalancingStrategy,
}

struct RoutingEntry {
    agent_id: AgentId,
    address: AgentAddress,
    capabilities: Vec<Capability>,
    embedding: Option<Vec<f32>>,
    load: f64,
    last_seen: DateTime<Utc>,
}

#[derive(Clone)]
enum RoutingStrategy {
    Direct,                    // Direct routing by agent ID
    Semantic { top_k: usize }, // HNSW-based semantic routing
    Broadcast,                 // Send to all agents
    LoadBalanced,              // Round-robin with load awareness
}

impl Router {
    /// Route message to appropriate agent
    fn route(&self, message: &Message, agents: &HashMap<AgentId, AgentAddress>) -> Result<AgentId, RoutingError> {
        match &self.routing_strategy {
            RoutingStrategy::Direct => {
                // Route to specified target
                message.target.ok_or(RoutingError::NoTarget)
            }
            RoutingStrategy::Semantic { top_k } => {
                // Semantic routing using HNSW
                self.route_semantic(message, *top_k)
            }
            RoutingStrategy::LoadBalanced => {
                // Load-balanced routing
                self.route_load_balanced(agents)
            }
            RoutingStrategy::Broadcast => {
                // Return error - broadcast handled separately
                Err(RoutingError::BroadcastNotRouted)
            }
        }
    }

    fn route_semantic(&self, message: &Message, top_k: usize) -> Result<AgentId, RoutingError> {
        let index = self.hnsw_index.as_ref()
            .ok_or(RoutingError::IndexNotAvailable)?;

        let query_embedding = message.embedding.as_ref()
            .ok_or(RoutingError::NoEmbedding)?;

        let results = index.search(query_embedding, top_k);

        if results.is_empty() {
            return Err(RoutingError::NoMatchingAgent);
        }

        // Apply load balancing among top results
        let selected = self.select_from_candidates(&results);
        Ok(selected)
    }

    fn route_load_balanced(&self, agents: &HashMap<AgentId, AgentAddress>) -> Result<AgentId, RoutingError> {
        let entries: Vec<_> = self.routing_table.values()
            .filter(|e| agents.contains_key(&e.agent_id))
            .collect();

        if entries.is_empty() {
            return Err(RoutingError::NoAvailableAgent);
        }

        // Select agent with lowest load
        entries.iter()
            .min_by(|a, b| a.load.partial_cmp(&b.load).unwrap_or(std::cmp::Ordering::Equal))
            .map(|e| e.agent_id)
            .ok_or(RoutingError::NoAvailableAgent)
    }

    /// Update routing table when topology changes
    fn update_routes(&mut self, agents: &HashMap<AgentId, AgentAddress>) {
        // Remove stale entries
        self.routing_table.retain(|id, _| agents.contains_key(id));

        // Add new entries
        for (id, address) in agents {
            self.routing_table.entry(*id)
                .or_insert_with(|| RoutingEntry {
                    agent_id: *id,
                    address: address.clone(),
                    capabilities: Vec::new(),
                    embedding: None,
                    load: 0.0,
                    last_seen: Utc::now(),
                });
        }
    }

    /// Rebuild index for new topology
    fn rebuild_for_topology(&mut self, topology: &Topology, agents: &HashMap<AgentId, AgentAddress>) {
        self.update_routes(agents);

        if topology.supports_semantic_routing() {
            self.hnsw_index = Some(self.build_hnsw_index());
        }
    }
}
```

### MessageQueue

Manages message delivery and ordering.

```rust
struct MessageQueue {
    // Queues
    pending: VecDeque<QueuedMessage>,
    in_flight: HashMap<MessageId, InFlightMessage>,

    // Configuration
    max_pending: usize,
    max_in_flight: usize,
    retry_policy: RetryPolicy,

    // Metrics
    total_sent: u64,
    total_delivered: u64,
    total_failed: u64,
}

struct QueuedMessage {
    message: Message,
    queued_at: DateTime<Utc>,
    priority: Priority,
}

struct InFlightMessage {
    message: Message,
    sent_at: DateTime<Utc>,
    target: AgentId,
    attempts: u32,
    deadline: DateTime<Utc>,
}

impl MessageQueue {
    /// Enqueue message for delivery
    fn enqueue(&mut self, message: Message, priority: Priority) -> Result<(), QueueError> {
        if self.pending.len() >= self.max_pending {
            return Err(QueueError::QueueFull);
        }

        let queued = QueuedMessage {
            message,
            queued_at: Utc::now(),
            priority,
        };

        // Insert based on priority
        let pos = self.pending.iter()
            .position(|m| m.priority < priority)
            .unwrap_or(self.pending.len());

        self.pending.insert(pos, queued);
        Ok(())
    }

    /// Get next message to send
    fn dequeue(&mut self) -> Option<Message> {
        if self.in_flight.len() >= self.max_in_flight {
            return None;
        }

        self.pending.pop_front().map(|m| m.message)
    }

    /// Mark message as sent
    fn mark_sent(&mut self, message_id: MessageId, target: AgentId) {
        let deadline = Utc::now() + self.retry_policy.timeout;

        self.in_flight.insert(message_id, InFlightMessage {
            message: Message::default(), // Simplified - would store actual message
            sent_at: Utc::now(),
            target,
            attempts: 1,
            deadline,
        });

        self.total_sent += 1;
    }

    /// Acknowledge message delivery
    fn acknowledge(&mut self, message_id: MessageId) -> Result<(), QueueError> {
        self.in_flight.remove(&message_id)
            .ok_or(QueueError::MessageNotFound)?;
        self.total_delivered += 1;
        Ok(())
    }

    /// Handle delivery failure
    fn handle_failure(&mut self, message_id: MessageId) -> RetryAction {
        if let Some(mut in_flight) = self.in_flight.remove(&message_id) {
            in_flight.attempts += 1;

            if in_flight.attempts <= self.retry_policy.max_retries {
                // Re-queue for retry
                self.pending.push_back(QueuedMessage {
                    message: in_flight.message,
                    queued_at: Utc::now(),
                    priority: Priority::Normal,
                });
                return RetryAction::Retrying { attempt: in_flight.attempts };
            } else {
                self.total_failed += 1;
                return RetryAction::Failed;
            }
        }

        RetryAction::NotFound
    }
}
```

---

## Value Objects

### Topology

Defines the communication structure between agents.

```rust
#[derive(Clone, PartialEq)]
enum Topology {
    Mesh {
        max_connections: usize,
    },
    Hierarchical {
        levels: usize,
        branching_factor: usize,
    },
    HierarchicalMesh {
        coordinator_count: usize,
        mesh_size: usize,
    },
    Sharded {
        shard_count: usize,
        replication_factor: usize,
    },
    Adaptive {
        min_connections: usize,
        max_connections: usize,
    },
}

impl Topology {
    fn supports_agent_count(&self, count: usize) -> bool {
        match self {
            Topology::Mesh { max_connections } => count <= max_connections * 2,
            Topology::Hierarchical { levels, branching_factor } => {
                count <= branching_factor.pow(*levels as u32)
            }
            Topology::HierarchicalMesh { coordinator_count, mesh_size } => {
                count <= coordinator_count * mesh_size
            }
            Topology::Sharded { shard_count, .. } => count <= shard_count * 100,
            Topology::Adaptive { max_connections, .. } => count <= max_connections * 10,
        }
    }

    fn supports_semantic_routing(&self) -> bool {
        matches!(self, Topology::HierarchicalMesh { .. } | Topology::Adaptive { .. })
    }

    fn quorum_size(&self, total_agents: usize) -> usize {
        total_agents / 2 + 1
    }
}
```

### AgentAddress

Network address for an agent.

```rust
#[derive(Clone, PartialEq, Eq, Hash)]
struct AgentAddress {
    transport: TransportType,
    host: String,
    port: u16,
    path: Option<String>,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
enum TransportType {
    WebSocket,
    WebRTC,
    HTTP,
    GUN,
}

impl AgentAddress {
    fn to_uri(&self) -> String {
        let scheme = match self.transport {
            TransportType::WebSocket => "ws",
            TransportType::WebRTC => "webrtc",
            TransportType::HTTP => "http",
            TransportType::GUN => "gun",
        };

        match &self.path {
            Some(path) => format!("{}://{}:{}/{}", scheme, self.host, self.port, path),
            None => format!("{}://{}:{}", scheme, self.host, self.port),
        }
    }
}
```

### ConsensusState

Current consensus state.

```rust
#[derive(Clone, PartialEq)]
struct ConsensusState {
    term: Term,
    leader_id: Option<AgentId>,
    votes_received: HashSet<AgentId>,
    commit_index: u64,
    last_log_term: Term,
    last_log_index: u64,
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct Term(u64);

impl ConsensusState {
    fn has_quorum(&self, total_agents: usize) -> bool {
        self.votes_received.len() >= (total_agents / 2 + 1)
    }

    fn is_leader_known(&self) -> bool {
        self.leader_id.is_some()
    }
}
```

---

## Domain Services

### RaftConsensus

Implements Raft consensus protocol.

```rust
struct RaftConsensus {
    config: RaftConfig,
    state_machine: Box<dyn StateMachine>,
}

struct RaftConfig {
    election_timeout_min: Duration,
    election_timeout_max: Duration,
    heartbeat_interval: Duration,
    max_log_entries_per_request: usize,
}

trait StateMachine: Send + Sync {
    fn apply(&mut self, command: &ConsensusCommand) -> Result<(), StateMachineError>;
    fn snapshot(&self) -> Snapshot;
    fn restore(&mut self, snapshot: Snapshot) -> Result<(), StateMachineError>;
}

impl RaftConsensus {
    /// Process election timeout
    fn on_election_timeout(&self, coordinator: &mut Coordinator) {
        coordinator.trigger_election();
    }

    /// Process heartbeat timeout (leader only)
    fn on_heartbeat_timeout(&self, coordinator: &mut Coordinator, agents: &[AgentId]) -> Vec<(AgentId, AppendEntriesRequest)> {
        if coordinator.role != CoordinatorRole::Leader {
            return Vec::new();
        }

        agents.iter()
            .filter(|id| *id != &coordinator.agent_id)
            .map(|id| {
                let next_idx = coordinator.next_index.get(id).copied().unwrap_or(1);
                let prev_log = coordinator.log.get(next_idx.saturating_sub(1) as usize)
                    .map(|e| (e.index, e.term))
                    .unwrap_or((0, Term(0)));

                let entries: Vec<_> = coordinator.log[next_idx as usize..]
                    .iter()
                    .take(self.config.max_log_entries_per_request)
                    .cloned()
                    .collect();

                (*id, AppendEntriesRequest {
                    term: coordinator.current_term,
                    leader_id: coordinator.agent_id,
                    prev_log_index: prev_log.0,
                    prev_log_term: prev_log.1,
                    entries,
                    leader_commit: coordinator.commit_index,
                })
            })
            .collect()
    }
}
```

### GossipProtocol

Implements epidemic gossip for eventual consistency.

```rust
struct GossipProtocol {
    fanout: usize,
    gossip_interval: Duration,
    state: CRDTState,
}

struct CRDTState {
    // G-Counter for monotonic values
    counters: HashMap<String, GCounter>,
    // LWW-Register for mutable values
    registers: HashMap<String, LWWRegister>,
    // OR-Set for collections
    sets: HashMap<String, ORSet>,
}

impl GossipProtocol {
    /// Select random peers for gossip
    fn select_peers(&self, agents: &[AgentId], exclude: &AgentId) -> Vec<AgentId> {
        let mut rng = rand::thread_rng();
        agents.iter()
            .filter(|id| *id != exclude)
            .cloned()
            .choose_multiple(&mut rng, self.fanout)
    }

    /// Create gossip message with local state
    fn create_gossip(&self) -> GossipMessage {
        GossipMessage {
            counters: self.state.counters.clone(),
            registers: self.state.registers.clone(),
            sets: self.state.sets.clone(),
            timestamp: Utc::now(),
        }
    }

    /// Merge received gossip with local state
    fn merge_gossip(&mut self, gossip: GossipMessage) {
        // Merge G-Counters
        for (key, remote) in gossip.counters {
            self.state.counters.entry(key)
                .and_modify(|local| local.merge(&remote))
                .or_insert(remote);
        }

        // Merge LWW-Registers (last-writer-wins)
        for (key, remote) in gossip.registers {
            self.state.registers.entry(key)
                .and_modify(|local| {
                    if remote.timestamp > local.timestamp {
                        *local = remote.clone();
                    }
                })
                .or_insert(remote);
        }

        // Merge OR-Sets
        for (key, remote) in gossip.sets {
            self.state.sets.entry(key)
                .and_modify(|local| local.merge(&remote))
                .or_insert(remote);
        }
    }
}
```

### SemanticRouter

HNSW-based semantic message routing.

```rust
struct SemanticRouter {
    index: HNSWIndex,
    embedding_model: Box<dyn EmbeddingModel>,
    agent_embeddings: HashMap<AgentId, Vec<f32>>,
}

impl SemanticRouter {
    /// Route message to most semantically similar agent
    fn route(&self, message: &Message, top_k: usize) -> Vec<(AgentId, f32)> {
        let query_embedding = self.embedding_model.embed(&message.content);

        let results = self.index.search(&query_embedding, top_k);

        results.into_iter()
            .filter_map(|(idx, distance)| {
                self.index_to_agent(idx).map(|id| (id, distance))
            })
            .collect()
    }

    /// Update agent embedding
    fn update_agent_embedding(&mut self, agent_id: AgentId, capabilities: &[String]) {
        let combined = capabilities.join(" ");
        let embedding = self.embedding_model.embed(&combined);

        self.agent_embeddings.insert(agent_id, embedding.clone());
        self.index.add_item(agent_id.as_index(), &embedding);
    }

    /// Find agents with similar capabilities
    fn find_similar_agents(&self, agent_id: AgentId, k: usize) -> Vec<AgentId> {
        let embedding = match self.agent_embeddings.get(&agent_id) {
            Some(e) => e,
            None => return Vec::new(),
        };

        self.index.search(embedding, k + 1)
            .into_iter()
            .filter_map(|(idx, _)| self.index_to_agent(idx))
            .filter(|id| id != &agent_id)
            .take(k)
            .collect()
    }
}
```

---

## Domain Events

### AgentJoined

Emitted when an agent joins the swarm.

```rust
struct AgentJoined {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    swarm_id: SwarmId,
    agent_id: AgentId,
    address: AgentAddress,
    capabilities: Vec<Capability>,
}
```

### AgentLeft

Emitted when an agent leaves the swarm.

```rust
struct AgentLeft {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    swarm_id: SwarmId,
    agent_id: AgentId,
    reason: LeaveReason,
}

enum LeaveReason {
    Graceful,
    Timeout,
    Evicted,
    Removed,
    Crashed,
}
```

### ConsensusReached

Emitted when consensus is reached on a proposal.

```rust
struct ConsensusReached {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    swarm_id: SwarmId,
    consensus_id: ConsensusId,
    term: Term,
    proposal: Proposal,
    votes_for: usize,
    votes_against: usize,
    duration: Duration,
}
```

### LeaderElected

Emitted when a new leader is elected.

```rust
struct LeaderElected {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    swarm_id: SwarmId,
    leader_id: AgentId,
    term: Term,
    previous_leader: Option<AgentId>,
}
```

### TopologyChanged

Emitted when swarm topology changes.

```rust
struct TopologyChanged {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    swarm_id: SwarmId,
    old_topology: Topology,
    new_topology: Topology,
    rebalance_required: bool,
}
```

---

## Repository Interfaces

### SwarmRepository

```rust
trait SwarmRepository {
    /// Find swarm by ID
    fn find(&self, id: SwarmId) -> Option<Swarm>;

    /// Find swarms by topology
    fn find_by_topology(&self, topology: &Topology) -> Vec<Swarm>;

    /// Save swarm state
    fn save(&mut self, swarm: &Swarm) -> Result<(), RepositoryError>;

    /// Get all active swarms
    fn get_active(&self) -> Vec<Swarm>;

    /// Delete swarm
    fn delete(&mut self, id: SwarmId) -> Result<(), RepositoryError>;
}
```

### ConsensusLogRepository

```rust
trait ConsensusLogRepository {
    /// Append entry to log
    fn append(&mut self, entry: LogEntry) -> Result<u64, RepositoryError>;

    /// Get entries from index
    fn get_from(&self, index: u64) -> Vec<LogEntry>;

    /// Get entry at index
    fn get(&self, index: u64) -> Option<LogEntry>;

    /// Truncate log from index
    fn truncate_from(&mut self, index: u64) -> Result<(), RepositoryError>;

    /// Get last log info
    fn last_log_info(&self) -> Option<(u64, Term)>;
}
```

### RoutingTableRepository

```rust
trait RoutingTableRepository {
    /// Get routing entry for agent
    fn get(&self, agent_id: AgentId) -> Option<RoutingEntry>;

    /// Update routing entry
    fn update(&mut self, entry: RoutingEntry) -> Result<(), RepositoryError>;

    /// Remove routing entry
    fn remove(&mut self, agent_id: AgentId) -> Result<(), RepositoryError>;

    /// Get all entries
    fn get_all(&self) -> Vec<RoutingEntry>;
}
```

---

## Integration Points

### Events Published

| Event | Consumer Context | Action |
|-------|-----------------|--------|
| `AgentJoined` | Runtime | Allocate resources |
| `AgentLeft` | Runtime | Release resources |
| `ConsensusReached` | Optimization | Execute coordinated changes |
| `LeaderElected` | All | Update routing |

### Events Consumed

| Event | Source Context | Action |
|-------|----------------|--------|
| `AgentSpawned` | Runtime | Register in swarm |
| `AgentEvicted` | Runtime | Remove from swarm |
| `OptimizationProposed` | Optimization | Coordinate execution |

### Services Exposed

| Service | Consumer | Purpose |
|---------|----------|---------|
| Route message | All | Semantic message routing |
| Request consensus | Optimization | Coordinate changes |
| Get topology | All | Query swarm structure |
