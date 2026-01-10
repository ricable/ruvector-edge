# ELEX Edge AI Agent Swarm - Ubiquitous Language

## Overview

This glossary defines the ubiquitous language used throughout the ELEX system. All team members, documentation, and code should use these terms consistently.

---

## Core Domain Terms

### Agent

A specialized, self-learning software entity that masters a single Ericsson RAN feature. Each agent:
- Has a unique identity derived from Ed25519 keypair
- Owns exclusive expertise on one FAJ code
- Learns continuously from interactions
- Operates autonomously at the edge

**Example:** "The MIMO Sleep Mode Agent handles all queries related to FAJ 121 3094."

---

### Feature

A discrete Ericsson RAN capability identified by a unique FAJ code. Features contain:
- Configurable parameters
- Measurable counters
- Derived KPIs
- Operational procedures

**Example:** "The IFLB feature (Inter-Frequency Load Balancing) optimizes traffic distribution."

---

### FAJ Code

Feature Activation Journal code - Ericsson's unique identifier for RAN features.

**Format:** `FAJ XXX YYYY` (e.g., FAJ 121 3094)

**Usage:** Every feature agent is identified by its FAJ code.

---

### Swarm

A coordinated collective of feature agents that work together to answer queries, share knowledge, and optimize network performance.

**Example:** "The swarm routes queries to the most capable agent."

---

## Network Configuration Terms

### Parameter

A configurable setting that controls RAN behavior. Parameters have:
- Name and data type
- Value constraints (min/max)
- Safe zone boundaries
- Change limits and cooldowns

**Example:** `lbActivationThreshold` controls when load balancing activates.

---

### Counter

A measurable metric collected from network elements. Counters are:
- Aggregated at various spatial levels
- Sampled at temporal intervals
- Used to compute KPIs
- Categorized as Primary, Contributing, or Contextual

**Example:** `pmRrcConnEstabSucc` counts successful RRC connection establishments.

---

### KPI (Key Performance Indicator)

A derived metric that indicates network health or performance. KPIs are:
- Computed from one or more counters
- Monitored for anomalies
- Subject to thresholds
- Used to trigger optimization cycles

**Example:** "Call Drop Rate exceeded 2%, triggering investigation."

---

### cmedit

Ericsson Network Manager command-line tool for modifying network configuration.

**Format:** `cmedit set <ManagedObject> <parameter>=<value>`

**Usage:** Agents generate cmedit commands for parameter changes.

---

### Managed Object (MO)

An addressable network element in the Ericsson model hierarchy.

**Example:** `SubNetwork=ONRM_ROOT,MeContext=Node1,ManagedElement=1`

---

### Safe Zone

The allowable range for a parameter value where changes are considered low-risk.

**Properties:**
- `safeMin`: Minimum safe value
- `safeMax`: Maximum safe value
- `changeLimit`: Maximum allowed change percentage
- `cooldown`: Minimum time between changes

**Example:** "lbActivationThreshold safe zone is 50-90, with 15% max change per hour."

---

## Learning Terms

### Q-Learning

A reinforcement learning algorithm where agents learn optimal actions through experience.

**Formula:** `Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]`

**Components:**
- Q(s,a): Value of taking action 'a' in state 's'
- alpha: Learning rate
- gamma: Discount factor (0.95)
- r: Reward received

---

### Q-Table

A data structure storing learned state-action values for an agent.

**Entry Format:**
```
StateActionKey -> { qValue, visits, confidence, outcomes }
```

**Usage:** "The Q-table indicates that 'direct_answer' has the highest value for this state."

---

### State

The current context encoded for Q-learning decisions.

**Components:**
- `query_type`: Type of user query
- `complexity`: Estimated complexity level
- `context_hash`: Hash of contextual information
- `confidence`: Current confidence level

---

### Action

An available response strategy for an agent.

**Types:**
| Action | Description |
|--------|-------------|
| `direct_answer` | Answer directly from knowledge |
| `context_answer` | Answer with retrieved context |
| `consult_peer` | Seek help from another agent |
| `request_clarification` | Ask user for more information |
| `escalate` | Escalate to human operator |

---

### Reward

A feedback signal that reinforces learning.

**Components:**
- `user_rating`: User satisfaction [-1, +1]
- `resolution_success`: Problem solved [+0.5]
- `latency_penalty`: Speed penalty [variable]
- `consultation_cost`: Peer consultation overhead [variable]
- `novelty_bonus`: Reward for new knowledge [variable]

---

### Trajectory

A recorded sequence of state-action-reward transitions.

**Format:** `[state_0, action_0, reward_0] -> ... -> [state_n, action_n, reward_n]`

**Usage:** Trajectories enable experience replay for improved learning.

---

### Federated Learning

A distributed learning approach where agents share knowledge without centralizing data.

**Merge Algorithm:**
```
merged_q = (local_q * local_visits + peer_q * peer_visits) / (local_visits + peer_visits)
```

**Usage:** "Agents perform federated merge every 60 seconds or 10 interactions."

---

## Optimization Terms

### Optimization Cycle

A closed-loop process for autonomous network tuning.

**Phases:**
1. **Observe**: Collect KPIs, counters, alarms
2. **Analyze**: Detect anomalies, identify root causes
3. **Decide**: Assess risk, get approval
4. **Act**: Execute parameter changes
5. **Learn**: Measure outcome, update Q-table
6. **Repeat**: Continue cycle

---

### Root Cause

The underlying reason for a KPI degradation, identified through counter analysis.

**Confidence Target:** >85%

**Example:** "Root cause analysis identified excessive handover failures due to incorrect threshold."

---

### Rollback

Reverting a parameter change to its previous value when the optimization fails.

**Trigger Conditions:**
- KPI degradation within 30-minute window
- Immediate failure detection
- Manual operator request

---

### Risk Level

Assessment of potential impact from a parameter change.

| Level | Criteria |
|-------|----------|
| LOW | Within safe zone, high confidence, proven history |
| MEDIUM | Near safe zone boundary, moderate confidence |
| HIGH | Outside safe zone, low confidence, critical service |

---

### Approval

Authorization required before executing parameter changes.

**Auto-Approve Criteria:**
- Risk = LOW
- Confidence > 80%
- Similar action succeeded >5 times
- Within safe zone

**Manual Approval Required:**
- Risk = HIGH
- Confidence < 60%
- Novel action
- Affects critical services

---

## Swarm Topology Terms

### Topology

The communication structure between agents in the swarm.

| Type | Description | Use Case |
|------|-------------|----------|
| Mesh | Fully connected | <100 agents |
| Hierarchical | Tree structure | Large deployments |
| Sharded | Category partitions | Domain isolation |
| Hybrid | Raft + Gossip | Enterprise (recommended) |

---

### Coordinator

A special agent that manages consensus and routing for a group of feature agents.

**Responsibilities:**
- Raft consensus participation
- Query routing
- Health monitoring
- Topology management

---

### Consensus

Agreement reached by multiple agents on a decision.

| Protocol | Use Case | Tolerance |
|----------|----------|-----------|
| Raft | Strong consistency for coordinators | f < n/2 failures |
| Gossip | Eventual consistency for agents | High availability |
| CRDT | Conflict-free replication | Network partitions |
| Byzantine | Fault tolerance | f < n/3 malicious |

---

### HNSW (Hierarchical Navigable Small World)

A vector index algorithm for fast semantic search.

**Performance:** 150x faster than brute force

**Usage:** Routes queries to the most capable agent based on semantic similarity.

---

## Security Terms

### Agent Identity

Cryptographic identity based on Ed25519 keypair.

**Components:**
- Private key (32 bytes) - kept secret
- Public key (32 bytes) - shared
- Agent ID - derived from public key

---

### Ed25519

Digital signature algorithm for agent authentication.

**Usage:** Every message is signed with the sender's Ed25519 private key.

---

### AES-256-GCM

Symmetric encryption algorithm for sensitive data.

**Usage:** Encrypts message payloads between agents.

---

### X25519

Elliptic curve Diffie-Hellman for key exchange.

**Usage:** Establishes ephemeral session keys, rotated hourly.

---

### Dilithium

Post-quantum digital signature algorithm.

**Usage:** Hybrid mode with Ed25519 for quantum-resistant signatures.

---

### Nonce

A unique value used once to prevent replay attacks.

**Validation:** Combined with 5-minute timestamp window for message freshness.

---

## Runtime Terms

### WASM (WebAssembly)

Binary format for executing agent code in browsers and edge devices.

**Size:** ~364KB per agent

**Platforms:** Browser, Mobile, Edge Server

---

### GUN.js

Decentralized P2P database for zero-infrastructure deployment.

**Usage:** Browser mode uses GUN.js public relays.

---

### Cold Start

Initial deployment period when agents operate in read-only mode.

**Threshold:** >100 interactions per feature before optimization enabled

**Rationale:** Ensures sufficient learning before making changes.

---

## Spatio-Temporal Terms

### Spatial Level

The geographic scope of KPI monitoring.

| Level | Scope |
|-------|-------|
| Cell | Single cell |
| Sector | Multiple cells in sector |
| Node | All cells on node |
| Cluster | Group of nodes |
| Network | Entire network |

---

### Temporal Level

The time granularity for KPI aggregation.

| Level | Duration |
|-------|----------|
| 15min | Near real-time |
| 1hr | Short-term trends |
| 4hr | Medium-term patterns |
| 24hr | Daily patterns |
| 7day | Weekly patterns |

---

## Intelligence Terms

### SNN (Spiking Neural Network)

Neural network using spike timing for temporal pattern detection.

**Learning:** STDP (Spike-Timing-Dependent Plasticity)

**Usage:** Detects counter anomalies (Traffic Surge, Config Mismatch, Hardware Degradation)

---

### Min-Cut Analysis

Graph algorithm identifying critical parameter dependencies.

**Usage:** Proactively detects system fragility before KPI degradation.

**Scale:** 5,230 parameters x 5,416 counters dependency graph

---

### STDP (Spike-Timing-Dependent Plasticity)

Learning rule for spiking neural networks based on spike timing.

**Principle:** Connections strengthen when pre-synaptic spikes precede post-synaptic spikes.

---

## Access Technology Terms

### LTE (4G)

Fourth-generation cellular technology.

**Coverage:** 307 agents (51.8%)

---

### NR (5G)

Fifth-generation New Radio technology.

**Coverage:** 284 agents (47.9%)

---

### Cross-RAT

Features spanning multiple radio access technologies.

**Coverage:** 2 agents (0.2%)

---

## Category Terms

| Abbreviation | Full Name |
|--------------|-----------|
| CA | Carrier Aggregation |
| RRM | Radio Resource Management |
| MIMO | Multiple-Input Multiple-Output |
| QoS | Quality of Service |
| IMS | IP Multimedia Subsystem |
| UE | User Equipment |
| DSS | Dynamic Spectrum Sharing |
| SUL | Supplementary Uplink |
| EN-DC | E-UTRA-NR Dual Connectivity |
| IFLB | Inter-Frequency Load Balancing |
| DUAC | Dynamic UL Attenuation Control |
| MLB | Mobility Load Balancing |
| MSM | MIMO Sleep Mode |

---

## Metric Terms

| Metric | Description | Target |
|--------|-------------|--------|
| Query Routing Latency | Time to route query to agent | <1ms (P95) |
| Response Generation | Time to generate response | <500ms (P95) |
| Learning Convergence | Interactions to reach stable Q-values | <100 |
| Swarm Sync Time | Time to synchronize swarm state | <5s |
| Agent Availability | Uptime percentage | >99.5% |
| Response Accuracy | Correct response rate | >90% |
| Root Cause Accuracy | Correct root cause identification | >85% |
| cmedit Correctness | Valid command generation | >99% |
| Rollback Rate | Changes requiring rollback | <5% |
| Auto-Approve Rate | Automatic approval percentage | >60% |

---

## Usage Guidelines

1. **Consistency**: Always use these exact terms in code, documentation, and communication
2. **No Synonyms**: Avoid alternate terms (e.g., use "Agent" not "Bot" or "Worker")
3. **Context**: Terms may have domain-specific meanings different from general usage
4. **Evolution**: This glossary evolves with the domain - propose additions via PR
5. **Code Alignment**: Class names, method names, and variables should match these terms
