# ELEX Edge AI Agent Swarm - Product Requirements Document

**Version:** 4.0.0 | **Status:** Production Ready | **Platform:** @ruvector/edge + claude-flow v3 + GNN

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture](#7-system-architecture)
8. [Domain Model](#8-domain-model)
9. [Agent Types](#9-agent-types)
10. [Learning Pipeline](#10-learning-pipeline)
11. [RuVector Memory](#11-ruvector-memory)
12. [Success Metrics](#12-success-metrics)
13. [Risks](#13-risks)
14. [Dependencies](#14-dependencies)
15. [Glossary](#15-glossary)
16. [Implementation Phases](#16-implementation-phases)
17. [Documentation References](#17-documentation-references)
    - [Appendix A: Claude-Flow V3 Integration](#appendix-a-claude-flow-v3-integration)
    - [Appendix B: Technical Architecture](#appendix-b-technical-architecture)
    - [Appendix C: Success Metrics Summary](#appendix-c-success-metrics-summary)
    - [Appendix D: Risk Mitigation](#appendix-d-risk-mitigation)
    - [Appendix E: Version History](#appendix-e-version-history)

---

## 1. Executive Summary

### 1.1 Vision

ELEX is a revolutionary edge-first AI agent swarm deploying **593 specialized self-learning agents**, each mastering a single Ericsson RAN feature. These agents coordinate as a distributed swarm in browsers, mobile devices, and edge servers—with zero cloud infrastructure costs.

### 1.2 Core Innovation

The system transforms from passive Q&A to an **active RAN optimization engine** that:

1. **Monitors** KPIs at multiple spatio-temporal granularities
2. **Investigates** counters to identify root causes
3. **Optimizes** parameters automatically with safe rollback
4. **Learns** continuously from operational outcomes
5. **Detects** system fragility before symptoms appear (Min-Cut)

### 1.3 Key Metrics

| Metric | Value |
|--------|-------|
| **Feature Agents** | 593 specialized experts |
| **Parameters Covered** | 5,230 across 452 features |
| **Counters Covered** | 5,416 across 344 features |
| **KPIs Tracked** | 736 across 156 features |
| **Infrastructure Cost** | $0/month (edge-first, P2P) |
| **Task Routing Latency** | <1ms semantic matching |
| **Root Cause Accuracy** | >85% |
| **SIMD Speedup** | 3-8x performance improvement |
| **Memory Budget** | 500MB max, 50 cached agents |
| **HNSW Search** | 150x-12,500x faster than brute force |

### 1.4 Technology Stack

- **Core:** Rust/WASM with SIMD acceleration (3-8x speedup)
- **Intelligence:** Q-Learning + HNSW vector indexing (150x-12,500x faster)
- **Coordination:** Raft consensus + Gossip protocol
- **Security:** Ed25519 identity, AES-256-GCM encryption
- **Integration:** claude-flow v3 orchestration

### 1.5 Claude-Flow V3 Integration Points

| Component | V3 Feature | Purpose |
|-----------|------------|---------|
| Memory | HNSW-indexed AgentDB | 150x-12,500x faster pattern search |
| Learning | RuVector Intelligence | 4-step RETRIEVE-JUDGE-DISTILL-CONSOLIDATE |
| Coordination | Hierarchical-Mesh Topology | 593-agent swarm management |
| Hooks | 17 hooks + 12 workers | Continuous learning and optimization |
| Security | Byzantine Consensus | Fault-tolerant agent coordination |

---

## 2. Problem Statement

### 2.1 Current Challenges

Current Ericsson RAN optimization approaches:

- **Manual tuning:** Weeks to implement, limited to obvious parameter relationships
- **Cloud-based ML:** $500-2,600/month; introduces latency; privacy concerns
- **Rule-based systems:** Brittle, can't adapt, require constant updates

### 2.2 Target Users

- **RAN Optimization Engineers:** Need faster parameter tuning recommendations
- **Network Operations Center (NOC) Staff:** Require root cause analysis tools
- **Field Technicians:** Need mobile-accessible troubleshooting guidance
- **Network Planners:** Require capacity and coverage optimization assistance

### 2.3 ELEX Solution

Deploy self-learning agents directly to edge infrastructure for real-time, autonomous RAN optimization without cloud dependency.

---

## 3. Solution Overview

### 3.1 Architecture Highlights

#### 6-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│  User Interface (Browser, Mobile, CLI)                      │
├─────────────────────────────────────────────────────────────┤
│  Coordination Layer (Raft + Gossip, Semantic Router)         │
├─────────────────────────────────────────────────────────────┤
│  Optimization Layer (KPI Monitor, Root Cause, Auto-Tune)     │
├─────────────────────────────────────────────────────────────┤
│  Intelligence Layer (Q-Learning, HNSW Memory, Federated)     │
├─────────────────────────────────────────────────────────────┤
│  Knowledge Layer (593 Feature Agents, Parameters, Counters)  │
├─────────────────────────────────────────────────────────────┤
│  Edge Runtime (WASM Browser, Node.js Server, Mobile)         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Semantic Query Routing** | <1ms HNSW-based routing to best agent |
| **Q-Learning** | Self-improving responses from feedback |
| **Federated Learning** | Knowledge sharing across P2P swarm |
| **Closed-Loop Optimization** | OALA cycle: Observe→Analyze→Optimize→Act→Learn |
| **Safe Zone Enforcement** | Hardcoded parameter constraints |
| **Rollback Safety** | Immediate revert on KPI degradation |

### 3.3 Deployment Modes

| Mode | Cost | Agents | Latency | Use Case |
|------|------|--------|---------|----------|
| **Browser** | $0/month | 50 | ~100ms | PoC, testing |
| **Edge Server** | $15-60/month | 200 | <50ms | Production |
| **Hybrid** | $5-20/month | 593 | <50ms | Enterprise (recommended) |

---

## 4. User Stories

### 4.1 RAN Optimization Engineer

| ID | Story | Priority |
|----|-------|----------|
| US-001 | As a RAN engineer, I want to query "configure IFLB thresholds" and get parameter recommendations with cmedit commands | HIGH |
| US-002 | As a RAN engineer, I want the system to automatically suggest optimal load balancing parameters based on current KPIs | HIGH |
| US-003 | As a RAN engineer, I want to see root cause analysis when handover success rate drops | MEDIUM |
| US-004 | As a RAN engineer, I want safe zone validation on all recommended parameter changes | CRITICAL |

### 4.2 NOC Staff

| ID | Story | Priority |
|----|-------|----------|
| US-005 | As NOC staff, I want real-time KPI monitoring with anomaly alerts | HIGH |
| US-006 | As NOC staff, I want the system to identify which cells need optimization | HIGH |
| US-007 | As NOC staff, I want to pause/resume optimization with one command | MEDIUM |
| US-008 | As NOC staff, I want audit trails of all parameter changes | MEDIUM |

### 4.3 Field Technician

| ID | Story | Priority |
|----|-------|----------|
| US-009 | As a field technician, I want mobile-accessible troubleshooting guidance | MEDIUM |
| US-010 | As a field technician, I want step-by-step procedures for common issues | MEDIUM |
| US-011 | As a field technician, I want offline capability when network is unavailable | LOW |

### 4.4 Network Planner

| ID | Story | Priority |
|----|-------|----------|
| US-012 | As a network planner, I want capacity optimization recommendations | MEDIUM |
| US-013 | As a network planner, I want coverage analysis with antenna tuning suggestions | MEDIUM |
| US-014 | As a network planner, I want what-if scenario modeling | LOW |
| US-015 | As a network planner, I want multi-site rollout planning | LOW |

---

## 5. Functional Requirements

### 5.1 Knowledge Management (FR-001 to FR-005)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-001 | System shall load 593 Ericsson RAN feature definitions | All features accessible |
| FR-002 | System shall index 5,230 parameters with safe zones | 100% coverage |
| FR-003 | System shall index 5,416 counters by category | All counters queryable |
| FR-004 | System shall track 736 KPIs with thresholds | All KPIs monitored |
| FR-005 | System shall generate cmedit commands for ENM | Valid syntax verified |

### 5.2 Intelligence & Learning (FR-006 to FR-010)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-006 | System shall implement Q-learning with alpha=0.1, gamma=0.95 | Convergence <100 interactions |
| FR-007 | System shall maintain experience replay buffer (1000 max) | Deduplication working |
| FR-008 | System shall perform federated learning every 60s or 10 interactions | Merge accuracy verified |
| FR-009 | System shall use HNSW for semantic search | <1ms P95 latency |
| FR-010 | System shall support trajectory replay with priority sampling | TD-error priority works |

### 5.3 Coordination (FR-011 to FR-015)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-011 | System shall route queries using semantic similarity | Top-5 accuracy >90% |
| FR-012 | System shall implement Raft consensus for coordinators | Single leader elected |
| FR-013 | System shall implement Gossip for feature agents | O(log N) convergence |
| FR-014 | System shall support 3 topologies: mesh, hierarchical, hierarchical-mesh | All topologies functional |
| FR-015 | System shall handle network partitions gracefully | No data loss |

### 5.4 Optimization (FR-016 to FR-020)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-016 | System shall monitor KPIs at multiple granularities | Cell→cluster hierarchy works |
| FR-017 | System shall perform root cause analysis with >85% accuracy | Validated on test cases |
| FR-018 | System shall recommend parameter changes with risk assessment | LOW/MEDIUM/HIGH labels |
| FR-019 | System shall implement Min-Cut integrity monitoring | Fragility detected early |
| FR-020 | System shall execute closed-loop optimization cycle | All 6 phases working |

### 5.5 Safety & Security (FR-021 to FR-025)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-021 | System shall enforce hardcoded safe zones | No override possible |
| FR-022 | System shall implement rollback within 30 minutes | 99.9% success rate |
| FR-023 | System shall sign all messages with Ed25519 | All signatures valid |
| FR-024 | System shall encrypt sensitive payloads with AES-256-GCM | Decryption works |
| FR-025 | System shall prevent replay attacks (5-min window) | Duplicate nonces blocked |

---

## 6. Non-Functional Requirements

### 6.1 Performance (NFR-001 to NFR-005)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Query routing latency | <1ms P95 |
| NFR-002 | Response generation time | <500ms P95 |
| NFR-003 | HNSW search latency | <1ms P95 |
| NFR-004 | Q-learning convergence | <100 interactions |
| NFR-005 | Swarm synchronization time | <5s |

### 6.2 Scalability (NFR-006 to NFR-010)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-006 | Support 593 concurrent agents | All agents responsive |
| NFR-007 | Support 50 cached agents in memory | <500MB total |
| NFR-008 | Support 10,000 vectors per agent | HNSW index functional |
| NFR-009 | Support hierarchical-mesh topology | 593 agents coordinated |
| NFR-010 | Support federated learning across swarm | Merge accuracy >95% |

### 6.3 Reliability (NFR-011 to NFR-015)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-011 | Agent availability | >99.5% |
| NFR-012 | Rollback success rate | 99.9% |
| NFR-013 | Fault tolerance | Tolerate (n-1)/2 failures |
| NFR-014 | Data persistence | Zero data loss |
| NFR-015 | Recovery time | <30s from failure |

---

## 7. System Architecture

### 7.1 6-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Browser   │  │    Mobile   │  │    CLI      │  │   REST API  │    │
│  │   (WASM)    │  │   (WASM)    │  │  (Node.js)  │  │  (Node.js)  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                          COORDINATION LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Semantic   │  │    Raft     │  │   Gossip    │  │  P2P        │    │
│  │  Router     │  │ Consensus   │  │  Protocol   │  │  Transport  │    │
│  │  (HNSW)     │  │ (Strong)    │  │ (Eventual)  │  │  (GUN/WebRTC)│   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                          OPTIMIZATION LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   KPI       │  │  Root Cause │  │ Parameter   │  │  Min-Cut    │    │
│  │  Monitor    │  │  Analyzer   │  │ Optimizer   │  │  Integrity  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                         INTELLIGENCE LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Q-Learning  │  │  Trajectory │  │  Federated  │  │   HNSW      │    │
│  │  Engine     │  │   Replay    │  │  Learning   │  │   Memory    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   GNN       │  │   SONA      │  │  Min-Cut    │  │ Tiny Dancer │    │
│  │  Layer      │  │  Self-Learn │  │  Integrity  │  │  Router     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                           KNOWLEDGE LAYER                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              593 Feature Agents (One per RAN Feature)            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ... ┌─────────┐            │   │
│  │  │  IFLB   │ │  DUAC   │ │   MSM   │     │  EN-DC  │            │   │
│  │  └─────────┘ └─────────┘ └─────────┘     └─────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                            SECURITY LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Ed25519   │  │  AES-256    │  │   Claims    │  │  Safe Zone  │    │
│  │  Identity   │  │   GCM       │  │  Authorization│  Enforcement  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                             RUNTIME LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   WASM      │  │   SIMD      │  │    LRU      │  │ IndexedDB   │    │
│  │  Runtime    │  │ Acceleration│  │   Cache     │  │ Persistence │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Swarm Topology Options

| Topology | Agents | Latency | Fault Tolerance | Use Case |
|----------|--------|---------|-----------------|----------|
| **Mesh** | <100 | Lowest | O(n²) links | Small deployments |
| **Hierarchical** | Any | Medium | Single point | Simple deployments |
| **Hierarchical-Mesh** | 593 | Low | Best | **Recommended** |
| **Sharded** | Any | Medium | Domain isolation | Multi-tenant |

### 7.3 Critical Architectural Decisions

#### Conflict Resolution & Resource Management

| Decision | Description |
|----------|-------------|
| **ADR-CR-001** | Context-aware selection with temporal filtering for contradictory recommendations |
| **ADR-CR-002** | Dynamic task offloading from resource-constrained to available agents |
| **ADR-CR-003** | Priority-based queuing for critical RAN operations |
| **ADR-CR-004** | Resource pooling with SIMD vector sharing |
| **ADR-CR-005** | Adaptive scaling based on query load |

#### Signal Detection & Learning

| Decision | Description |
|----------|-------------|
| **ADR-SD-001** | Multi-window validation (1min, 5min, 15min) to prevent false positives |
| **ADR-SD-002** | STDP-based spiking neural networks for counter anomalies |
| **ADR-SD-003** | Trajectory deduplication by context hash |
| **ADR-SD-004** | User-consent-based exploration (opt-in Q-learning) |

#### Vector Index & Consensus

| Decision | Description |
|----------|-------------|
| **ADR-VI-001** | Strong consistency (Raft-based) for task routing indices |
| **ADR-VI-002** | Eventual consistency (Gossip) for Q-table sync |
| **ADR-VI-003** | HNSW M=16, efConstruction=200, efSearch=50 for optimal recall/latency |

#### Safety & Rollback

| Decision | Description |
|----------|-------------|
| **ADR-SR-001** | Immediate revert with mandatory validation period before re-attempting |
| **ADR-SR-002** | 30-minute rollback window with checkpoint restoration |
| **ADR-SR-003** | Hardcoded parameter constraints with no operator overrides |
| **ADR-SR-004** | Blocking conditions during critical events (HW failure, site down) |
| **ADR-SR-005** | Cold-start read-only mode until >100 interactions per feature |

#### AI Agent Routing (Tiny Dancer)

| Decision | Description |
|----------|-------------|
| **ADR-TD-001** | FastGRNN neural inference for <1ms routing decisions |
| **ADR-TD-002** | Multi-model orchestration across 593 agents |
| **ADR-TD-003** | Cost-optimized routing based on query complexity |
| **ADR-TD-004** | Load balancing with intelligent request distribution |

**Routing Performance:**
- Decision Latency: <1ms
- Model Size: ~5KB per router
- Accuracy: >95% optimal routing
- Throughput: 100K+ decisions/sec

---

## 8. Domain Model

### 8.1 Bounded Contexts (DDD)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ELEX DOMAIN ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │   KNOWLEDGE      │  │  INTELLIGENCE    │  │  OPTIMIZATION    │      │
│  │   (Core)         │  │  (Core)          │  │  (Core)          │      │
│  │                  │  │                  │  │                  │      │
│  │  FeatureAgent    │  │  QTable          │  │  Optimization    │      │
│  │  Parameter       │  │  Trajectory      │  │  Cycle           │      │
│  │  Counter         │  │  ReplayBuffer    │  │  KPIMonitor      │      │
│  │  KPI             │  │  FederatedMerge  │  │  RootCause       │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│           │                      │                      │               │
│           └──────────────────────┼──────────────────────┘               │
│                                  │                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     SUPPORTING CONTEXTS                         │    │
│  ├──────────────┐  ├──────────────┐  ├──────────────┐              │    │
│  │ COORDINATION │  │  SECURITY    │  │   RUNTIME    │              │    │
│  │              │  │              │  │              │              │    │
│  │  Swarm       │  │  AgentIdentity│  │  WASMModule  │              │    │
│  │  Router      │  │  Signature    │  │  Deployment  │              │    │
│  │  Consensus   │  │  Encryption   │  │  ResourceMgr │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│                                                                  │    │
└──────────────────────────────────────────────────────────────────┘    │
```

### 8.2 Core Aggregates

| Aggregate | Root | Entities | Value Objects |
|-----------|------|----------|---------------|
| **FeatureAgent** | FeatureAgent | - | FAJCode, Parameter, Counter, KPI |
| **QTable** | QTable | QEntry | StateVector, Action, Reward |
| **OptimizationCycle** | OptimizationCycle | - | RiskLevel, Recommendation, RollbackPoint |

---

## 9. Agent Types

### 9.1 Distribution by Domain

| Domain | Agent Count | Percentage |
|--------|-------------|------------|
| **Knowledge** | 593 | 100% (primary) |
| **Intelligence** | 593 | 100% (embedded) |
| **Coordination** | 14 coordinators | 2.4% |
| **Optimization** | 593 | 100% (embedded) |
| **Security** | 593 | 100% (embedded) |

### 9.2 Specialized Feature Agents

| Category | Agents | Examples |
|----------|--------|----------|
| Carrier Aggregation | 89 | 2CC, 3CC, 4CC, UL CA, DL CA |
| Radio Resource Management | 76 | IFLB, DUAC, MCPC, MLB |
| NR/5G | 57 | EN-DC, DSS, SUL, NSA, SA |
| Transport | 52 | F1, X2, Xn, S1, NG |
| MIMO & Antenna | 42 | MSM, BF, TM modes |
| Mobility & Handover | 48 | A3, A5, ANR, SHC |
| Coverage & Capacity | 37 | MRO, CCO, FFR |
| Voice & IMS | 21 | VoLTE, VoNR, SRVCC |
| Interference | 14 | ICIC, eICIC, CoMP |
| QoS & Scheduling | 12 | GBR, QCI, 5QI |
| Timing & Sync | 10 | IEEE 1588, GPS |
| Security | 8 | MACsec, Encryption |
| Energy Saving | 7 | MIMO Sleep, Cell Sleep |
| UE Handling | 7 | Paging, DRX, DTX |

---

## 10. Learning Pipeline

### 10.1 Q-Learning Architecture

```
User Query → Intent Classification → Entity Extraction → Context Retrieval
    ↓                                                          ↓
State Encoding ← ── ── ── ← Q-Table Lookup ← Similar Cases
    ↓
Action Selection → Response Generation → User Feedback → Reward Signal
    ↓
Q-Table Update: Q(s,a) ← Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]
```

### 10.2 State-Action-Reward Framework

| Component | Values |
|-----------|--------|
| **States** | query_type (6), complexity (3), context_hash, confidence (10) |
| **Actions** | DirectAnswer, ContextAnswer, ConsultPeer, RequestClarification, Escalate |
| **Rewards** | user_rating [-1,+1], resolution_success (+0.5), latency_penalty, consultation_cost |

### 10.3 Federated Learning

**Merge Algorithm:**
```rust
merged_q = (local_q × local_visits + peer_q × peer_visits) / (local_visits + peer_visits)
```

**Sync Triggers:**
- Every 60 seconds OR
- After 10 interactions OR
- On explicit peer request

### 10.4 Hyperparameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| alpha | 0.1 | Learning rate |
| gamma | 0.95 | Discount factor |
| epsilon | 0.1 → 0.01 | Exploration rate (decaying) |
| buffer_size | 1000 | Trajectory replay buffer |
| priority_alpha | 0.6 | PER prioritization |
| importance_beta | 0.4 → 1.0 | Importance sampling |

---

## 11. RuVector Memory

### 11.1 4-Layer Memory System

**Layer 1: Static Knowledge** (~3.2MB compressed)
- Feature metadata, parameters, counters, KPIs, procedures
- O(1) lookup; WASM heap storage

**Layer 2: Vector Memory (HNSW Index)**
- 10,000 vectors per agent; 128-dim embeddings
- Stores: query/response/case content with metadata
- Search: 150x faster than brute force

**Layer 3: Q-Table** (Learned state-action values)
- state:action key → q_value, visits, confidence, outcomes
- Federated sync every 60s or 10 interactions
- Compression: LZ4 (4-32x reduction)

**Layer 4: Trajectory Memory** (Experience replay buffer)
- Ring buffer (1000 max); stores full trajectories
- Prioritized sampling by cumulative reward
- Deduplication of similar trajectories

### 11.2 Memory Budget

| Component | Allocation |
|-----------|------------|
| Shared HNSW Index | 100MB |
| 50 Cached Agents | 350MB (~7MB each) |
| Static Knowledge | 3.2MB |
| Runtime Overhead | ~47MB |
| **Total** | **500MB** |

### 11.3 HNSW Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| dimensions | 128 | Balance expressiveness and memory |
| M | 16 | Connections per node (memory vs recall) |
| efConstruction | 200 | Build-time accuracy |
| efSearch | 50 | Query-time latency vs accuracy |
| maxElements | 10,000 | Per-agent vector capacity |
| distance | Cosine | Semantic similarity for embeddings |

### 11.4 Graph Query Capabilities

RuVector enables hybrid vector-graph queries with Cypher/SPARQL:

**Cypher Query Example:**
```cypher
// Find related features by parameter dependency
MATCH (f1:Feature)-[:DEPENDS_ON]->(f2:Feature)
WHERE f1.category = 'MIMO' 
  AND vector_similarity(f1.embedding, $query_embedding) > 0.8
RETURN f1, f2 ORDER BY f1.priority DESC
```

**Use Cases:**
- Parameter dependency traversal
- Counter correlation analysis  
- KPI impact chain discovery
- Feature relationship mapping

### 11.5 Dynamic Min-Cut Integrity

Breakthrough subpolynomial algorithm for RAN topology analysis, based on the December 2025 paper ["Deterministic and Exact Fully-dynamic Minimum Cut of Superpolylogarithmic Size in Subpolynomial Time"](https://arxiv.org/abs/2512.13105):

- First deterministic exact fully-dynamic min-cut algorithm
- n^0.12 subpolynomial update scaling
- Detects RAN topology fragility before symptoms appear
- Real-time network partition risk assessment

**Applications:**
- Network resilience prediction
- Agent coordination bottleneck detection
- Cell handover path analysis

---

## 12. Success Metrics

### 12.1 Performance KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Query Routing Latency | <1ms (P95) | HNSW benchmark |
| Response Generation | <500ms (P95) | End-to-end timing |
| Learning Convergence | <100 interactions | Q-table stabilization |
| Swarm Sync Time | <5s | Gossip propagation |
| Agent Availability | >99.5% | Uptime monitoring |

### 12.2 Quality KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Accuracy | >90% | User feedback |
| Feature Coverage | 100% (593/593) | Agent count |
| Parameter Coverage | >95% | Safe zone validation |
| cmedit Correctness | >99% | ENM validation |
| Conflict Detection | 100% | Dependency graph |

### 12.3 Optimization KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Optimization Cycle Time | <5 minutes | OALA timing |
| Root Cause Accuracy | >85% | Validation tests |
| Auto-Approve Rate | >60% | Risk assessment |
| Rollback Rate | <5% | Rollback monitoring |
| KPI Improvement | +15% average | Baseline comparison |

---

## 13. Risks

### 13.1 Risk Framework

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **SIMD browser support** | Medium | High | Scalar fallbacks |
| **Memory pressure** | Medium | Medium | LRU eviction + compression |
| **Security vulnerabilities** | Low | Critical | Ed25519 + regular audits |
| **Performance regression** | Low | High | Continuous benchmarking |
| **Federated learning quality** | Medium | Medium | Visit-weighted averaging |

### 13.2 Dependency Risks

| Risk | Mitigation |
|------|------------|
| Browser WASM limitations | Progressive enhancement |
| Network partitions | Gossip eventual consistency |
| Feature spec changes | Versioned knowledge base |
| KPI threshold accuracy | Expert validation |

---

## 14. Dependencies

### 14.1 External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Rust | 1.70+ | Core language |
| wasm-pack | 0.12+ | WASM compilation |
| wasm-bindgen | 0.2+ | JS interop |
| claude-flow v3 | 3.0+ | Orchestration |

### 14.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Core | Rust/WASM |
| SIMD | wasm32 simd128 |
| Memory | HNSW, IndexedDB |
| Coordination | Raft, Gossip |
| Security | Ed25519, AES-256-GCM |
| Integration | claude-flow v3 |

---

## 15. Glossary

### 15.1 Ericsson RAN Terms

| Term | Definition |
|------|------------|
| **FAJ Code** | Feature Adjustment Code (e.g., FAJ 121 3094 = MSM) |
| **IFLB** | Inter-Frequency Load Balancing |
| **DUAC** | DL UL Admission Control |
| **MSM** | MIMO Sleep Mode |
| **EN-DC** | E-UTRA-NR Dual Connectivity (4G-5G) |
| **DSS** | Dynamic Spectrum Sharing |
| **cmedit** | Command-line ENM interface |

### 15.2 AI/ML Terms

| Term | Definition |
|------|------------|
| **Q-Learning** | Model-free reinforcement learning |
| **HNSW** | Hierarchical Navigable Small World (vector index) |
| **Q-Table** | State-action value mapping |
| **Federated Learning** | Distributed knowledge sharing |
| **Trajectory** | Sequence of state-action-reward tuples |
| **TD-Error** | Temporal Difference error (prediction error) |

---

## 16. Implementation Phases

### Overview: 7 Phases, 52 Tasks (ELEX-001 to ELEX-052)

| Phase | Weeks | Focus | Tasks |
|-------|-------|-------|-------|
| **0** | 0 | Foundation Setup | ELEX-001 to ELEX-004 |
| **1** | 1-2 | Core Infrastructure | ELEX-005 to ELEX-009 |
| **2** | 3-4 | SIMD Engine | ELEX-010 to ELEX-014 |
| **3** | 5-6 | Intelligence Layer | ELEX-015 to ELEX-022 |
| **4** | 7-8 | Coordination Layer | ELEX-023 to ELEX-027 |
| **5** | 9-10 | Security Layer | ELEX-028 to ELEX-035 |
| **6** | 11-14 | Full Integration | ELEX-036 to ELEX-052 |

---

### Phase 0: Foundation Setup (Week 0)

#### ELEX-001: Initialize Claude-Flow V3 Project

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-001 |
| **Title** | Initialize claude-flow v3 project configuration |
| **Dependencies** | None |
| **Complexity** | S (Small) |
| **Agent Types** | `coder`, `system-architect` |

**Description:**
Configure the project with claude-flow v3 settings, memory backend, and hook system.

**Claude-Flow V3 Hooks:**
```bash
# Pre-task: Record initialization
npx @claude-flow/cli@latest hooks pre-task --description "Initialize ELEX project with claude-flow v3" --coordinate-swarm true

# Session start: Create new session
npx @claude-flow/cli@latest hooks session-start --session-id "elex-foundation" --auto-configure true

# Post-task: Store completion
npx @claude-flow/cli@latest hooks post-task --task-id "ELEX-001" --success true --store-results true
```

**Success Criteria:**
- [ ] `claude-flow.config.json` created with hierarchical-mesh topology
- [ ] Memory backend initialized (hybrid: SQLite + AgentDB)
- [ ] HNSW indexing enabled
- [ ] Neural learning (SONA) configured
- [ ] Doctor health check passes

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "elex-project-config" --value "topology:hierarchical-mesh,maxAgents:593,memoryBackend:hybrid" --namespace patterns
```

---

#### ELEX-002: Setup Rust Toolchain for WASM

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-002 |
| **Title** | Configure Rust toolchain with WASM SIMD support |
| **Dependencies** | ELEX-001 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Install and configure Rust with wasm32-unknown-unknown target and SIMD128 support.

**Claude-Flow V3 Hooks:**
```bash
# Route to optimal agent
npx @claude-flow/cli@latest hooks route --task "Rust WASM toolchain setup" --context "wasm32,simd128,wasm-bindgen"

# Pre-command validation
npx @claude-flow/cli@latest hooks pre-command --command "rustup target add wasm32-unknown-unknown" --validate-safety true
```

**Success Criteria:**
- [ ] Rust stable channel installed
- [ ] `wasm32-unknown-unknown` target added
- [ ] `wasm-pack` installed
- [ ] `wasm-bindgen-cli` installed
- [ ] SIMD128 flag validated

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "rust-toolchain-config" --value "wasm-pack:0.12,wasm-bindgen:0.2,target:wasm32-unknown-unknown" --namespace tooling
```

---

#### ELEX-003: Initialize Memory Database

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-003 |
| **Title** | Initialize AgentDB with HNSW indexing |
| **Dependencies** | ELEX-001 |
| **Complexity** | M (Medium) |
| **Agent Types** | `memory-specialist`, `coder` |

**Description:**
Set up the RuVector memory system with HNSW indexing for semantic search across 593 agents.

**Claude-Flow V3 Hooks:**
```bash
# Initialize memory
npx @claude-flow/cli@latest memory init --force --verbose

# Configure HNSW
npx @claude-flow/cli@latest memory search --query "test initialization" --namespace default

# Store initialization pattern
npx @claude-flow/cli@latest hooks post-task --task-id "ELEX-003" --success true --store-results true
```

**Success Criteria:**
- [ ] AgentDB initialized
- [ ] HNSW index created (M=16, efConstruction=200, efSearch=50)
- [ ] Vector dimensions set to 128
- [ ] Search latency <1ms verified
- [ ] Memory capacity supports 10,000 vectors per agent

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "hnsw-config" --value "M:16,efConstruction:200,efSearch:50,dimensions:128" --namespace memory
```

---

#### ELEX-004: Load Ericsson Feature Knowledge Base

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-004 |
| **Title** | Ingest 593 Ericsson RAN feature definitions |
| **Dependencies** | ELEX-003 |
| **Complexity** | L (Large) |
| **Agent Types** | `researcher`, `coder` |

**Description:**
Load feature metadata, parameters, counters, and KPIs into the knowledge base for agent specialization.

**Claude-Flow V3 Hooks:**
```bash
# Pre-task planning
npx @claude-flow/cli@latest hooks pre-task --description "Load 593 Ericsson features" --coordinate-swarm true

# Store feature categories
npx @claude-flow/cli@latest memory store --key "feature-categories" --value "CA:89,RRM:64,NR:57,Transport:52,MIMO:40,Mobility:36,Energy:29,Coverage:28,Voice:21,UE:11,QoS:8,Interference:5,Timing:5,Security:3,SON:2" --namespace knowledge

# Dispatch knowledge mapping worker
npx @claude-flow/cli@latest hooks worker dispatch --trigger map
```

**Success Criteria:**
- [ ] 593 feature definitions loaded
- [ ] 9,432 parameters indexed
- [ ] 3,368 counters indexed
- [ ] 199 KPIs indexed
- [ ] 752 MO classes mapped
- [ ] Dependency graph constructed

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "feature-count" --value "593" --namespace knowledge
npx @claude-flow/cli@latest memory store --key "param-count" --value "9432" --namespace knowledge
npx @claude-flow/cli@latest memory store --key "counter-count" --value "3368" --namespace knowledge
```

---

### Phase 1: Core Infrastructure (Weeks 1-2)

#### ELEX-005: Create Cargo Workspace

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-005 |
| **Title** | Create Cargo workspace with crate structure |
| **Dependencies** | ELEX-002 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Set up Rust workspace following DDD structure with 8 crates.

**Claude-Flow V3 Hooks:**
```bash
# Search for similar workspace patterns
npx @claude-flow/cli@latest memory search --query "rust workspace cargo structure wasm" --namespace patterns

# Pre-task registration
npx @claude-flow/cli@latest hooks pre-task --description "Create Cargo workspace" --coordinate-swarm false

# Post-edit neural training
npx @claude-flow/cli@latest hooks post-edit --file "wasm/Cargo.toml" --train-neural true
```

**Expected Output Files:**
```
wasm/
  Cargo.toml                         # Workspace root
  crates/
    elex-core/Cargo.toml             # Core types & traits
    elex-simd/Cargo.toml             # SIMD operations
    elex-qlearning/Cargo.toml        # Q-learning engine
    elex-memory/Cargo.toml           # Memory/HNSW
    elex-crypto/Cargo.toml           # Cryptography
    elex-routing/Cargo.toml          # Semantic routing
    elex-agent/Cargo.toml            # Agent runtime
    elex-wasm/Cargo.toml             # wasm-bindgen exports
```

**Success Criteria:**
```bash
cd wasm && cargo check --workspace
# Exit code: 0
```

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "workspace-structure" --value "8-crate-workspace:elex-core,elex-simd,elex-qlearning,elex-memory,elex-crypto,elex-routing,elex-agent,elex-wasm" --namespace architecture
```

---

#### ELEX-006: Implement Core Types (elex-core)

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-006 |
| **Title** | Implement core domain types and traits |
| **Dependencies** | ELEX-005 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `system-architect` |

**Description:**
Implement fundamental types: AgentId, FeatureCode, StateVector, Embedding, Query, Response, Actions.

**Claude-Flow V3 Hooks:**
```bash
# Route for architectural guidance
npx @claude-flow/cli@latest hooks route --task "core types implementation" --context "DDD,aggregates,value-objects,entities"

# Pre-task with swarm coordination
npx @claude-flow/cli@latest hooks pre-task --description "Implement elex-core types" --coordinate-swarm true
```

**Key Types:**
```rust
// Types to implement
pub type AgentId = [u8; 32];
pub type FeatureCode = String;
pub type StateVector = [f32; 64];
pub type Embedding = [f32; 128];

pub enum QueryType { Parameter, Counter, Kpi, Procedure, Troubleshoot, General }
pub enum Complexity { Simple, Moderate, Complex }
pub enum Action { DirectAnswer, ContextAnswer, ConsultPeer, RequestClarification, Escalate }

pub trait Agent: Send + Sync { ... }
pub trait VectorIndex: Send + Sync { ... }
pub trait QTable: Send + Sync { ... }
```

**Success Criteria:**
```bash
cd wasm/crates/elex-core && cargo test && cargo doc --no-deps
# All tests pass, documentation builds
```

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "core-types-pattern" --value "AgentId:[u8;32],StateVector:[f32;64],Embedding:[f32;128],Actions:5" --namespace types
```

---

#### ELEX-007: Implement Error Types

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-007 |
| **Title** | Implement comprehensive error handling |
| **Dependencies** | ELEX-005 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Implement error types following error handling strategy.

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest hooks pre-edit --file "wasm/crates/elex-core/src/error.rs" --operation "create"
npx @claude-flow/cli@latest hooks post-edit --file "wasm/crates/elex-core/src/error.rs" --success true --train-neural true
```

**Success Criteria:**
- [ ] ElexError enum with thiserror derive
- [ ] Error categories: Agent, Feature, Memory, SIMD, Crypto, Routing
- [ ] Error conversion from std errors
- [ ] WASM-compatible error handling

---

#### ELEX-008: Implement WASM Logging

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-008 |
| **Title** | Implement WASM-compatible logging macros |
| **Dependencies** | ELEX-005 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Create logging infrastructure that works across WASM (browser console) and native (stdout).

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest hooks route --task "WASM logging" --context "console.log,wasm-bindgen,conditional-compilation"
```

**Success Criteria:**
- [ ] `elex_debug!`, `elex_info!`, `elex_warn!`, `elex_error!` macros
- [ ] Browser console output in WASM
- [ ] Stdout output in native
- [ ] Level filtering

---

#### ELEX-009: Implement Feature Entity

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-009 |
| **Title** | Implement Feature aggregate root |
| **Dependencies** | ELEX-006 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `researcher` |

**Description:**
Implement the Feature entity that represents one of 593 Ericsson RAN features with parameters, counters, and KPIs.

**Claude-Flow V3 Hooks:**
```bash
# Search Ericsson feature knowledge
npx @claude-flow/cli@latest memory search --query "Ericsson RAN feature structure FAJ" --namespace knowledge

# Store successful pattern
npx @claude-flow/cli@latest hooks post-task --task-id "ELEX-009" --success true --store-results true
```

**Success Criteria:**
- [ ] Feature struct with FAJ code, name, category, RAT
- [ ] Parameter collection (avg 16 per feature)
- [ ] Counter collection (avg 6 per feature)
- [ ] KPI collection (avg 1.3 per feature)
- [ ] Dependency graph edges
- [ ] Serialization support (serde)

---

### Phase 2: SIMD Engine (Weeks 3-4)

#### ELEX-010: SIMD Cosine Similarity

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-010 |
| **Title** | Implement SIMD-accelerated cosine similarity |
| **Dependencies** | ELEX-006 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `performance-engineer` |

**Description:**
Implement cosine similarity using WASM SIMD128 for 128-dimensional embeddings with 3-5x speedup.

**Claude-Flow V3 Hooks:**
```bash
# Search for SIMD patterns
npx @claude-flow/cli@latest memory search --query "SIMD cosine similarity f32x4 wasm32" --namespace patterns

# Route to performance specialist
npx @claude-flow/cli@latest hooks route --task "SIMD cosine similarity" --context "wasm32,simd128,f32x4,vectorization"

# Dispatch benchmark worker after completion
npx @claude-flow/cli@latest hooks worker dispatch --trigger benchmark
```

**Implementation Pattern:**
```rust
#[target_feature(enable = "simd128")]
pub unsafe fn cosine_similarity_simd(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    // Process 4 floats per iteration (32 iterations for 128 dims)
    // Use f32x4_mul, f32x4_add, horizontal_sum
}
```

**Success Criteria:**
```bash
cargo bench --features simd -- cosine
# Expected: 3-5x speedup vs scalar baseline
```

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "simd-cosine-pattern" --value "iterations:32,lanes:4,speedup:3-5x" --namespace simd
```

---

#### ELEX-011: SIMD Q-Table Batch Updates

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-011 |
| **Title** | Implement SIMD batch Q-value updates |
| **Dependencies** | ELEX-010 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `performance-engineer` |

**Description:**
Implement batch Q-learning updates using SIMD for TD-error calculations.

**Claude-Flow V3 Hooks:**
```bash
# Search Q-learning patterns
npx @claude-flow/cli@latest memory search --query "Q-learning batch update TD-error SIMD" --namespace patterns

# Neural training on successful implementation
npx @claude-flow/cli@latest hooks post-edit --file "wasm/crates/elex-simd/src/qlearning.rs" --train-neural true
```

**Update Formula (SIMD-vectorized):**
```
Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
```

**Success Criteria:**
```bash
cargo bench --features simd -- q_batch
# Expected: 2-4x speedup for batch updates
```

---

#### ELEX-012: SIMD Parameter Validation

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-012 |
| **Title** | Implement SIMD parameter bounds checking |
| **Dependencies** | ELEX-010 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Implement parallel bounds checking for safe zone validation.

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest hooks route --task "SIMD bounds checking" --context "f32x4_ge,f32x4_le,bitmask"
```

**Success Criteria:**
```bash
cargo bench --features simd -- validate
# Expected: 4-8x speedup for 100+ parameter validation
```

---

#### ELEX-013: SIMD Counter Aggregation

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-013 |
| **Title** | Implement SIMD counter/KPI aggregation |
| **Dependencies** | ELEX-010 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Implement SIMD-accelerated sum, weighted sum, max, and threshold counting.

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest memory store --key "simd-aggregation-ops" --value "sum,weighted-sum,max,threshold-count,mean" --namespace simd
```

**Success Criteria:**
```bash
cargo bench --features simd -- aggregate
# Expected: 3-6x speedup
```

---

#### ELEX-014: Scalar Fallbacks

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-014 |
| **Title** | Implement scalar fallbacks for non-SIMD targets |
| **Dependencies** | ELEX-010, ELEX-011, ELEX-012, ELEX-013 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Create scalar implementations for browsers/devices without SIMD support.

**Claude-Flow V3 Hooks:**
```bash
# Route for fallback strategy
npx @claude-flow/cli@latest hooks route --task "SIMD fallback strategy" --context "feature-detection,conditional-compilation,cfg"
```

**Success Criteria:**
```bash
# Build without SIMD
cargo build --target wasm32-unknown-unknown
# Tests pass on both paths
cargo test
cargo test --features simd
```

---

### Phase 3: Intelligence Layer (Weeks 5-6)

#### ELEX-015: Q-Table Data Structure

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-015 |
| **Title** | Implement Q-table data structure |
| **Dependencies** | ELEX-006 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `ml-developer` |

**Description:**
Implement Q-table with state-action values, visit counts, and confidence scoring.

**Claude-Flow V3 Hooks:**
```bash
# Search for Q-learning patterns
npx @claude-flow/cli@latest memory search --query "Q-table state-action hashmap epsilon-greedy" --namespace patterns

# Route to ML specialist
npx @claude-flow/cli@latest hooks route --task "Q-table implementation" --context "reinforcement-learning,Q-learning,epsilon-greedy"

# Intelligence trajectory tracking
npx @claude-flow/cli@latest hooks intelligence trajectory-start --session-id "qlearning-impl"
```

**Key Parameters:**
- alpha (learning rate): 0.1
- gamma (discount factor): 0.95
- epsilon (exploration): 0.1 -> 0.01 (decaying)

**Success Criteria:**
```rust
#[test]
fn test_qtable_insert_lookup() {
    let mut qt = QTable::new(0.1, 0.95);
    qt.update(state_hash, Action::DirectAnswer, 0.5, 0.0);
    assert!(qt.get(state_hash, Action::DirectAnswer) > 0.0);
}
```

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "qlearning-hyperparams" --value "alpha:0.1,gamma:0.95,epsilon:0.1->0.01" --namespace intelligence
```

---

#### ELEX-016: State/Action Encoding

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-016 |
| **Title** | Implement deterministic state encoding |
| **Dependencies** | ELEX-015 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Encode state components (query_type, complexity, context_hash, confidence) into 64-bit hash.

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest hooks route --task "state encoding" --context "hash,discretization,64-bit"
```

**State Layout:**
```
[query_type: 3 bits][complexity: 2 bits][confidence_bucket: 4 bits][context_hash: 55 bits]
```

**Success Criteria:**
```rust
#[test]
fn test_encoding_deterministic() {
    let state1 = encode_state(QueryType::Parameter, Complexity::Simple, 0x123, 0.8);
    let state2 = encode_state(QueryType::Parameter, Complexity::Simple, 0x123, 0.8);
    assert_eq!(state1, state2);
}
```

---

#### ELEX-017: Epsilon-Greedy Policy

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-017 |
| **Title** | Implement epsilon-greedy with decay |
| **Dependencies** | ELEX-015 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Implement exploration policy with user-consent-based exploration toggle.

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest memory store --key "exploration-policy" --value "epsilon-greedy,consent-based,decay:0.995" --namespace intelligence
```

**Success Criteria:**
- [ ] Epsilon decay from 0.1 to 0.01
- [ ] User consent toggle for exploration
- [ ] Best action selection when not exploring

---

#### ELEX-018: Experience Replay Buffer

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-018 |
| **Title** | Implement prioritized experience replay |
| **Dependencies** | ELEX-015 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `ml-developer` |

**Description:**
Implement PER with TD-error prioritization for efficient learning.

**Claude-Flow V3 Hooks:**
```bash
# Search for experience replay patterns
npx @claude-flow/cli@latest memory search --query "prioritized experience replay TD-error sampling" --namespace patterns

# Intelligence pattern storage
npx @claude-flow/cli@latest hooks intelligence pattern-store --pattern-type "experience-replay" --description "PER implementation"
```

**PER Parameters:**
- alpha (prioritization): 0.6
- beta (importance sampling): 0.4 -> 1.0
- Buffer size: 1000 experiences per agent

**Success Criteria:**
```rust
#[test]
fn test_replay_priority_sampling() {
    let mut buffer = ReplayBuffer::new(100);
    buffer.push(Experience { td_error: 0.1, ... });
    buffer.push(Experience { td_error: 0.9, ... });
    // Higher TD-error sampled more frequently
}
```

---

#### ELEX-019: HNSW Index Implementation

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-019 |
| **Title** | Implement HNSW vector index for WASM |
| **Dependencies** | ELEX-010 |
| **Complexity** | L (Large) |
| **Agent Types** | `coder`, `memory-specialist` |

**Description:**
Implement HNSW algorithm for 150x-12,500x faster semantic search.

**Claude-Flow V3 Hooks:**
```bash
# Route to memory specialist
npx @claude-flow/cli@latest hooks route --task "HNSW implementation" --context "HNSW,vector-index,ANN,semantic-search"

# Dispatch optimization worker
npx @claude-flow/cli@latest hooks worker dispatch --trigger optimize
```

**HNSW Configuration:**
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| M | 16 | Balance recall/memory |
| efConstruction | 200 | High build accuracy |
| efSearch | 50 | Query latency tradeoff |
| Dimensions | 128 | Embedding size |
| Distance | Cosine | Semantic similarity |

**Success Criteria:**
```rust
#[test]
fn test_hnsw_performance() {
    let mut index = HnswIndex::new(HnswConfig::default());
    for i in 0..10_000 { index.insert(i, &random_embedding()); }
    let start = now();
    let results = index.search(&query, 10);
    assert!(now() - start < Duration::from_millis(1));
}
```

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "hnsw-implementation" --value "M:16,efConstruction:200,efSearch:50,speedup:150x-12500x" --namespace memory
```

---

#### ELEX-020: Trajectory Buffer

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-020 |
| **Title** | Implement ring buffer for trajectories |
| **Dependencies** | ELEX-019 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Implement trajectory storage with deduplication and reward-based sampling.

**Success Criteria:**
- [ ] Ring buffer with 1000 max entries
- [ ] Deduplication by context hash
- [ ] Reward-prioritized sampling

---

#### ELEX-021: LZ4 Persistence

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-021 |
| **Title** | Implement compressed Q-table persistence |
| **Dependencies** | ELEX-015, ELEX-019 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder` |

**Description:**
Implement Q-table persistence with LZ4 compression (4-32x reduction).

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest hooks route --task "LZ4 compression" --context "compression,persistence,bincode,IndexedDB"
```

**Success Criteria:**
```rust
#[test]
fn test_compression_ratio() {
    let qtable = generate_large_qtable();
    let compressed = compress_qtable(&qtable);
    let ratio = qtable.serialized_size() as f32 / compressed.len() as f32;
    assert!(ratio >= 4.0);
}
```

---

#### ELEX-022: LRU Cache

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-022 |
| **Title** | Implement LRU cache with 80% eviction |
| **Dependencies** | ELEX-019 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Implement LRU eviction for 50-agent cache within 500MB budget.

**Success Criteria:**
- [ ] 80% threshold triggers eviction
- [ ] Evict 20% of entries on pressure
- [ ] Persist Q-table before eviction

---

### Phase 4: Coordination Layer (Weeks 7-8)

#### ELEX-023: Semantic Router

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-023 |
| **Title** | Implement HNSW-based query routing |
| **Dependencies** | ELEX-019 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `system-architect` |

**Description:**
Route queries to appropriate agents using semantic similarity (<1ms P95).

**Claude-Flow V3 Hooks:**
```bash
# Route for routing (meta!)
npx @claude-flow/cli@latest hooks route --task "semantic router" --context "query-routing,HNSW,agent-selection"

# Session coordination
npx @claude-flow/cli@latest hooks session-start --session-id "routing-impl"
```

**Success Criteria:**
```rust
#[test]
fn test_routing_latency() {
    let router = SemanticRouter::new();
    router.register_agents(&all_593_agents);
    let start = now();
    let agents = router.route("Configure MIMO sleep", 5);
    assert!(now() - start < Duration::from_millis(1));
    assert!(agents[0].feature_code.contains("MSM"));
}
```

---

#### ELEX-024: Federated Q-Table Merge

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-024 |
| **Title** | Implement weighted federated averaging |
| **Dependencies** | ELEX-015 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `ml-developer` |

**Description:**
Merge Q-tables across agents with visit-weighted averaging.

**Merge Formula:**
```
merged_q = (local_q * local_visits + peer_q * peer_visits) / total_visits
```

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest memory search --query "federated learning merge weighted average" --namespace patterns
```

**Success Criteria:**
```rust
#[test]
fn test_weighted_merge() {
    let local = QTable::with_entry(state, action, 0.5, 10);  // 10 visits
    let peer = QTable::with_entry(state, action, 0.8, 20);   // 20 visits
    let merged = federated_merge(&local, &peer);
    // Expected: (0.5*10 + 0.8*20) / 30 = ~0.7
    assert!((merged.get(state, action) - 0.7).abs() < 0.01);
}
```

---

#### ELEX-025: Gossip Protocol

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-025 |
| **Title** | Implement gossip-based state sync |
| **Dependencies** | ELEX-024 |
| **Complexity** | L (Large) |
| **Agent Types** | `coder`, `system-architect` |

**Description:**
Implement epidemic-style gossip for eventual consistency across agents.

**Claude-Flow V3 Hooks:**
```bash
# Route for distributed systems expertise
npx @claude-flow/cli@latest hooks route --task "gossip protocol" --context "gossip,CRDT,eventual-consistency,epidemic"

# Coordinate with swarm agents
npx @claude-flow/cli@latest swarm init --topology mesh --max-agents 10
```

**Gossip Parameters:**
- Fanout: 3 peers per round
- Interval: 60 seconds
- Trigger: Every 10 interactions

**Success Criteria:**
```rust
#[test]
fn test_gossip_propagation() {
    let mut swarm = MockSwarm::new(10);
    swarm.agents[0].update_qtable(state, action, 0.9);
    for _ in 0..3 { swarm.gossip_round(); }
    for agent in &swarm.agents {
        assert!(agent.qtable.get(state, action) > 0.5);
    }
}
```

---

#### ELEX-026: Raft Consensus for Coordinators

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-026 |
| **Title** | Implement Raft for coordinator cluster |
| **Dependencies** | ELEX-023 |
| **Complexity** | L (Large) |
| **Agent Types** | `coder`, `system-architect` |

**Description:**
Implement Raft consensus for 3-5 coordinator nodes managing the routing index.

**Claude-Flow V3 Hooks:**
```bash
# Route for consensus expertise
npx @claude-flow/cli@latest hooks route --task "Raft consensus" --context "Raft,leader-election,log-replication,fault-tolerance"

# Dispatch audit worker for security review
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

**Success Criteria:**
```rust
#[test]
fn test_raft_leader_election() {
    let cluster = RaftCluster::new(3);
    cluster.start();
    std::thread::sleep(Duration::from_secs(2));
    let leaders: Vec<_> = cluster.nodes.iter().filter(|n| n.is_leader()).collect();
    assert_eq!(leaders.len(), 1);
}
```

---

#### ELEX-027: Query Pipeline

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-027 |
| **Title** | Implement full query routing pipeline |
| **Dependencies** | ELEX-023, ELEX-026 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder` |

**Description:**
End-to-end query processing from routing through response.

**Success Criteria:**
```rust
#[test]
fn test_full_query_pipeline() {
    let router = QueryRouter::new(swarm);
    let response = router.route_and_process(Query {
        content: "How to configure IFLB thresholds?",
        query_type: QueryType::Parameter,
    });
    assert!(response.confidence > 0.6);
    assert!(response.agent_id.feature_code().contains("IFLB"));
}
```

---

### Phase 5: Security Layer (Weeks 9-10)

#### ELEX-028: Ed25519 Identity

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-028 |
| **Title** | Implement Ed25519 keypair generation |
| **Dependencies** | ELEX-006 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `security-architect` |

**Description:**
Generate Ed25519 keypairs for agent identity and message signing.

**Claude-Flow V3 Hooks:**
```bash
# Route to security specialist
npx @claude-flow/cli@latest hooks route --task "Ed25519 identity" --context "Ed25519,keypair,digital-signature,cryptography"

# Dispatch security audit
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

**Success Criteria:**
```rust
#[test]
fn test_identity_generation() {
    let identity = AgentIdentity::generate();
    assert_eq!(identity.public_key.len(), 32);
    assert_eq!(identity.agent_id.len(), 32);
}
```

---

#### ELEX-029: Message Signing

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-029 |
| **Title** | Implement Ed25519 message signing/verification |
| **Dependencies** | ELEX-028 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `security-architect` |

**Description:**
Sign all inter-agent messages with Ed25519 signatures.

**Success Criteria:**
```rust
#[test]
fn test_sign_verify() {
    let identity = AgentIdentity::generate();
    let message = SignedMessage::new("hello", &identity);
    assert!(message.verify(&identity.public_key));
}
```

---

#### ELEX-030: AES-256-GCM Encryption

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-030 |
| **Title** | Implement authenticated encryption |
| **Dependencies** | ELEX-028 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `security-architect` |

**Description:**
Encrypt sensitive payloads with AES-256-GCM.

**Success Criteria:**
```rust
#[test]
fn test_encrypt_decrypt() {
    let key = generate_session_key();
    let plaintext = b"sensitive RAN config";
    let ciphertext = encrypt_aes_gcm(plaintext, &key);
    let decrypted = decrypt_aes_gcm(&ciphertext, &key);
    assert_eq!(plaintext, decrypted.as_slice());
}
```

---

#### ELEX-031: X25519 Key Exchange

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-031 |
| **Title** | Implement ECDH key exchange |
| **Dependencies** | ELEX-028, ELEX-030 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `security-architect` |

**Description:**
Implement X25519 ECDH for session key derivation with hourly rotation.

**Success Criteria:**
```rust
#[test]
fn test_ecdh_shared_secret() {
    let alice = X25519KeyPair::generate();
    let bob = X25519KeyPair::generate();
    let alice_shared = alice.derive_shared(&bob.public_key);
    let bob_shared = bob.derive_shared(&alice.public_key);
    assert_eq!(alice_shared, bob_shared);
}
```

---

#### ELEX-032: Replay Protection

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-032 |
| **Title** | Implement timestamp/nonce replay protection |
| **Dependencies** | ELEX-029 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder`, `security-auditor` |

**Description:**
Reject messages outside 5-minute window and with duplicate nonces.

**Success Criteria:**
```rust
#[test]
fn test_replay_detection() {
    let mut guard = ReplayGuard::new(Duration::from_secs(300));
    let msg = SignedMessage::new("test", &identity);
    assert!(guard.check(&msg));  // First: OK
    assert!(!guard.check(&msg)); // Replay: BLOCKED
}
```

---

#### ELEX-033: Safe Zone Enforcer

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-033 |
| **Title** | Implement hardcoded parameter constraints |
| **Dependencies** | ELEX-006, ELEX-012 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `security-architect` |

**Description:**
Implement safe zone validation with compile-time embedded constraints.

**Claude-Flow V3 Hooks:**
```bash
# Search safe zone patterns
npx @claude-flow/cli@latest memory search --query "safe zone parameter bounds constraint" --namespace patterns

# Route to security specialist
npx @claude-flow/cli@latest hooks route --task "safe zone enforcement" --context "parameter-bounds,safe-zone,validation"
```

**Safe Zone Structure:**
```rust
pub struct SafeZone {
    pub absolute_min: f32,
    pub absolute_max: f32,
    pub safe_min: f32,
    pub safe_max: f32,
    pub change_limit_percent: f32,
    pub cooldown_seconds: u64,
}
```

**Success Criteria:**
```rust
#[test]
fn test_safezone_enforcement() {
    let enforcer = SafeZoneEnforcer::load_constraints();
    assert!(enforcer.validate("lbActivationThreshold", 70.0));   // In zone
    assert!(!enforcer.validate("lbActivationThreshold", 95.0));  // Out of zone
}
```

---

#### ELEX-034: Blocking Conditions

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-034 |
| **Title** | Implement optimization pause triggers |
| **Dependencies** | ELEX-033 |
| **Complexity** | S (Small) |
| **Agent Types** | `coder` |

**Description:**
Pause optimization during critical events (HW failure, site down, high call drop).

**Blocking Conditions:**
- CRITICAL_HW_FAILURE
- SITE_DOWN
- HIGH_CALL_DROP (>2%)
- NIGHT_WINDOW
- OPERATOR_PAUSE

**Success Criteria:**
```rust
#[test]
fn test_blocking_conditions() {
    let mut blocker = BlockingConditions::new();
    blocker.report_event(Event::CriticalHwFailure);
    assert!(blocker.is_blocked());
    blocker.clear_event(Event::CriticalHwFailure);
    assert!(!blocker.is_blocked());
}
```

---

#### ELEX-035: Rollback Mechanism

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-035 |
| **Title** | Implement parameter change rollback |
| **Dependencies** | ELEX-033 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `security-auditor` |

**Description:**
Save checkpoints and rollback on KPI degradation within 30 minutes.

**Claude-Flow V3 Hooks:**
```bash
npx @claude-flow/cli@latest hooks route --task "rollback mechanism" --context "checkpoint,rollback,KPI-monitoring"
```

**Success Criteria:**
```rust
#[test]
fn test_rollback() {
    let mut mgr = RollbackManager::new();
    mgr.save_checkpoint("param1", 50.0);
    mgr.apply_change("param1", 70.0);
    mgr.rollback("param1");  // KPI degraded
    assert_eq!(mgr.current_value("param1"), 50.0);
}
```

---

### Phase 6: Full Integration (Weeks 11-14)

#### ELEX-036: Feature Agent Implementation

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-036 |
| **Title** | Implement FeatureAgent struct |
| **Dependencies** | All Phase 1-5 tasks |
| **Complexity** | L (Large) |
| **Agent Types** | `coder`, `system-architect` |

**Description:**
Integrate all components into the FeatureAgent aggregate root.

**Claude-Flow V3 Hooks:**
```bash
# Full swarm coordination
npx @claude-flow/cli@latest swarm init --topology hierarchical-mesh --max-agents 15

# Route for integration guidance
npx @claude-flow/cli@latest hooks route --task "feature agent integration" --context "DDD,aggregate-root,all-domains"
```

**FeatureAgent Components:**
- Identity (Ed25519 keypair, agent_id)
- Knowledge (Feature metadata, parameters, counters, KPIs)
- Q-Table (State-action values, visits, confidence)
- Trajectory Buffer (Experience replay)
- SIMD Operations (Vectorized processing)
- Vector Memory (HNSW index slice)

**Success Criteria:**
- [ ] Agent handles query lifecycle
- [ ] Q-learning updates on feedback
- [ ] Federated sync with peers
- [ ] Safe zone validation on outputs

---

#### ELEX-037: Query Handler

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-037 |
| **Title** | Implement query processing pipeline |
| **Dependencies** | ELEX-036 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder` |

**Description:**
Process queries through classification, context retrieval, action selection, and response generation.

**Query Pipeline:**
1. Intent classification
2. Entity extraction
3. Context retrieval (HNSW)
4. State encoding
5. Action selection (Q-table)
6. Response generation
7. cmedit command generation
8. Feedback recording

---

#### ELEX-038: cmedit Command Generator

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-038 |
| **Title** | Implement ENM cmedit command generation |
| **Dependencies** | ELEX-036 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `researcher` |

**Description:**
Generate validated cmedit commands for Ericsson Network Manager.

**Claude-Flow V3 Hooks:**
```bash
# Search cmedit patterns
npx @claude-flow/cli@latest memory search --query "cmedit MO parameter ENM command" --namespace knowledge
```

**Command Format:**
```
cmedit set <MO_Path> <Parameter>=<Value>
cmedit get <MO_Path> <Parameter>
```

---

#### ELEX-039: Load 593 Feature Metadata

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-039 |
| **Title** | Load all feature definitions into agents |
| **Dependencies** | ELEX-036, ELEX-004 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `researcher` |

**Description:**
Instantiate 593 agents with their respective feature knowledge.

**Memory Patterns to Store:**
```bash
npx @claude-flow/cli@latest memory store --key "agent-distribution" --value "LTE:307,NR:284,CrossRAT:2" --namespace agents
```

---

#### ELEX-040-046: Integration Tests

| Task Range | Title | Agent Type | Complexity |
|------------|-------|------------|------------|
| ELEX-040 | Q-learning loop integration | tester | M |
| ELEX-041 | HNSW routing integration | tester | M |
| ELEX-042 | Federated sync integration | tester | L |
| ELEX-043 | Safe zone enforcement integration | tester, security-auditor | M |
| ELEX-044 | Rollback mechanism integration | tester | M |
| ELEX-045 | Full 593-agent load test | tester, performance-engineer | L |
| ELEX-046 | Browser compatibility test | tester | M |

**Claude-Flow V3 Hooks for Testing:**
```bash
# Dispatch test gap analysis
npx @claude-flow/cli@latest hooks worker dispatch --trigger testgaps

# Run security audit
npx @claude-flow/cli@latest security audit --depth full

# Performance benchmark
npx @claude-flow/cli@latest performance benchmark --suite all
```

---

#### ELEX-047-050: Performance Benchmarks

| Task | Title | Success Criteria |
|------|-------|-----------------|
| ELEX-047 | SIMD operations benchmark | 3-5x speedup |
| ELEX-048 | HNSW search benchmark | <1ms P95 |
| ELEX-049 | Q-table update benchmark | <5ms P95 |
| ELEX-050 | Full query cycle benchmark | <500ms P95 |

---

#### ELEX-051: WASM Binary Optimization

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-051 |
| **Title** | Optimize WASM binary size |
| **Dependencies** | ELEX-036 |
| **Complexity** | M (Medium) |
| **Agent Types** | `coder`, `performance-engineer` |

**Optimizations:**
- LTO (Link-Time Optimization): -30%
- wasm-opt -O3: -15%
- Brotli compression: -60%

**Success Criteria:**
```bash
wasm-pack build --release
ls -la pkg/elex_agent_bg.wasm.br
# Size < 500KB after brotli
```

---

#### ELEX-052: Final System Integration

| Field | Value |
|-------|-------|
| **Task ID** | ELEX-052 |
| **Title** | Final integration and smoke test |
| **Dependencies** | All previous tasks |
| **Complexity** | L (Large) |
| **Agent Types** | `coder`, `tester`, `reviewer` |

**Description:**
Complete end-to-end validation of 593-agent swarm.

**Claude-Flow V3 Hooks:**
```bash
# Full swarm validation
npx @claude-flow/cli@latest swarm init --topology hierarchical-mesh --max-agents 593

# Final metrics export
npx @claude-flow/cli@latest hooks session-end --generate-summary true --export-metrics true --persist-state true

# Store completion
npx @claude-flow/cli@latest memory store --key "elex-v1-complete" --value "agents:593,simd:3-8x,hnsw:<1ms,qlearning:<100" --namespace releases
```

**Success Criteria:**
```javascript
// Browser test
const swarm = await ElexSwarm.initialize({
    topology: 'hierarchical-mesh',
    maxAgents: 593,
});

const response = await swarm.query("Configure IFLB for load balancing");
assert(response.confidence > 0.8);
assert(response.cmeditCommands.length > 0);
assert(response.latencyMs < 500);
```

---

## 17. Documentation References

This section provides a comprehensive index of all project documentation.

### 17.1 Core Documentation

| Document | Description | Location |
|----------|-------------|----------|
| **Product Requirements Document (PRD)** | This document - comprehensive product requirements and specifications | `docs/PRD.md` |
| **Architecture** | Complete system architecture (ELEX + Claude Flow V3) | `docs/architecture.md` |
| **Technical Decisions Matrix** | ADR inventory, risk assessments, and implementation phases | `docs/technical-decisions-matrix.md` |
| **Implementation Roadmap** | 10-week implementation plan for 593 WASM SIMD agents | `docs/implementation-roadmap.md` |

### 17.2 Architecture Documents

| Document | Description | Location |
|----------|-------------|----------|
| **Rust Architecture** | Rust/WASM module architecture | `docs/rust-architecture.md` |
| **WASM Agents** | 593 WASM SIMD agents deployment plan | `docs/wasm-agents.md` |
| **Security Integration** | Security and cryptography architecture | `docs/security-integration.md` |
| **Decisions Matrix V2** | Alternative decisions matrix format | `docs/decisions-matrix-v2.md` |

### 17.3 Domain-Driven Design (DDD)

| Document | Description | Location |
|----------|-------------|----------|
| **Domain Model** | Core domain entities and relationships | `docs/ddd/domain-model.md` |
| **Aggregates** | DDD aggregate patterns | `docs/ddd/aggregates.md` |
| **Domain Events** | Event-driven architecture | `docs/ddd/domain-events.md` |
| **Ubiquitous Language** | Shared domain vocabulary | `docs/ddd/ubiquitous-language.md` |

### 17.4 Architecture Decision Records (ADRs)

| ADR | Title | Location |
|-----|-------|----------|
| **ADR-001** | Swarm Topology | `docs/adr/ADR-001-swarm-topology.md` |
| **ADR-002** | Consensus Protocol | `docs/adr/ADR-002-consensus-protocol.md` |
| **ADR-003** | Edge-First Architecture | `docs/adr/ADR-003-edge-first-architecture.md` |
| **ADR-004** | Agent Specialization | `docs/adr/ADR-004-agent-specialization.md` |
| **ADR-005** | Vector Memory (HNSW) | `docs/adr/ADR-005-vector-memory-hnsw.md` |
| **ADR-006** | Q-Learning Engine | `docs/adr/ADR-006-q-learning-engine.md` |
| **ADR-007** | Security Cryptography | `docs/adr/ADR-007-security-cryptography.md` |
| **ADR-008** | Safe Zone Constraints | `docs/adr/ADR-008-safe-zone-constraints.md` |
| **ADR-009** | Federated Learning | `docs/adr/ADR-009-federated-learning.md` |
| **ADR-010** | Closed-Loop Optimization | `docs/adr/ADR-010-closed-loop-optimization.md` |

### 17.5 Documentation Navigation

- **For Developers**: Start with [Architecture](./architecture.md) and [Technical Decisions Matrix](./technical-decisions-matrix.md)
- **For Product Managers**: Start with [PRD](./PRD.md) and [Implementation Roadmap](./implementation-roadmap.md)
- **For Architects**: Review all [ADR documents](./adr/) and [DDD documents](./ddd/)
- **For Security**: Review [Security Integration](./security-integration.md) and [ADR-007](./adr/ADR-007-security-cryptography.md)

---

## Appendix A: Claude-Flow V3 Integration

### A.1 Integration Points

| Component | V3 Feature | Purpose |
|-----------|------------|---------|
| Memory | HNSW-indexed AgentDB | 150x-12,500x faster pattern search |
| Learning | RuVector Intelligence | 4-step RETRIEVE-JUDGE-DISTILL-CONSOLIDATE |
| Coordination | Hierarchical-Mesh Topology | 593-agent swarm management |
| Hooks | 17 hooks + 12 workers | Continuous learning and optimization |
| Security | Byzantine Consensus | Fault-tolerant agent coordination |

### A.2 Hooks Usage Matrix

| Phase | pre-task | post-task | route | session | worker | intelligence |
|-------|----------|-----------|-------|---------|--------|--------------|
| 0 | X | X | X | X | - | - |
| 1 | X | X | X | - | map | - |
| 2 | X | X | X | - | benchmark | - |
| 3 | X | X | X | X | optimize | X |
| 4 | X | X | X | X | - | - |
| 5 | X | X | X | - | audit | - |
| 6 | X | X | X | X | testgaps | X |

### A.3 Memory Namespaces

| Namespace | Purpose | Key Examples |
|-----------|---------|--------------|
| patterns | Reusable implementation patterns | simd-cosine, qlearning-hyperparams |
| architecture | System design decisions | workspace-structure, ddd-domains |
| knowledge | Ericsson RAN feature data | feature-count, param-count |
| intelligence | Learning configurations | hnsw-config, exploration-policy |
| progress | Phase completion tracking | phase1-complete, phase2-complete |
| tooling | Development toolchain | rust-toolchain-config |
| memory | Memory system config | hnsw-implementation |
| agents | Agent distribution | agent-distribution |
| releases | Release milestones | elex-v1-complete |

### A.4 Agent Type Matrix

| Agent Type | Phases Used | Primary Tasks |
|------------|-------------|---------------|
| coder | 0-6 | All implementation |
| system-architect | 0,1,4,6 | Architecture, coordination |
| researcher | 0,1,6 | Knowledge gathering |
| memory-specialist | 0,3 | HNSW, memory |
| ml-developer | 3,4 | Q-learning, federation |
| performance-engineer | 2,6 | SIMD, benchmarks |
| tester | 2,6 | Testing |
| security-architect | 5 | Cryptography |
| security-auditor | 5,6 | Security review |
| reviewer | 5,6 | Code review |
| raft-manager | 4 | Consensus |
| gossip-coordinator | 4 | Gossip protocol |
| hierarchical-coordinator | 6 | Swarm coordination |

---

## Appendix B: Technical Architecture

### B.1 Rust Crate Dependency Graph

```
elex-core ──────────────────────────────────────────┐
    │                                                │
    ├── elex-simd ──────────────────────────────────┤
    │       │                                        │
    │       └── elex-qlearning ─────────────────────┤
    │               │                                │
    │               └── elex-memory ────────────────┤
    │                       │                        │
    │                       └── elex-agent ─────────┤
    │                               │                │
    ├── elex-crypto ─────────────────┤                │
    │       │                       │                │
    │       └── elex-p2p ──────────┤                │
    │                               │                │
    └── elex-safety ───────────────┴────────────────┤
                                                     │
                                         elex-wasm ──┘
```

### B.2 Directory Structure

```
wasm/
├── Cargo.toml                    # Workspace root
├── rust-toolchain.toml           # Pin Rust version
├── .cargo/config.toml            # WASM target config with SIMD
└── crates/
    ├── elex-core/               # Core types and traits
    ├── elex-simd/               # SIMD operations
    ├── elex-qlearning/          # Q-learning engine
    ├── elex-memory/             # Memory/HNSW
    ├── elex-crypto/             # Cryptography
    ├── elex-routing/            # Semantic routing
    ├── elex-p2p/                # P2P coordination
    ├── elex-safety/             # Safe zone enforcement
    ├── elex-agent/              # Agent runtime
    └── elex-wasm/               # wasm-bindgen exports
```

### B.3 Key Structs and Traits

**AgentId** - Derived from Ed25519 public key hash (16 bytes hex = 32 chars)

**FeatureCode** - Parses "FAJ XXX YYYY" format with validation

**Parameter** - Contains SafeZone with absolute_min/max, safe_min/max, change_limit, cooldown

**SafeZone** - Hardcoded constraints, no runtime override:
- absolute_min/max: Physical limits from RAN spec
- safe_min/max: Operational limits from domain experts
- change_limit_percent: Max % change per cycle (e.g., 15%)
- cooldown_seconds: Min time between changes (e.g., 3600)

**Agent Trait** - id(), feature_code(), status(), initialize(), shutdown(), stats()

**Learnable Trait** - select_action(), update_q_value(), get_q_value(), export_q_table(), merge_q_table()

**Routable Trait** - expertise_embedding() returns [f32; 128], similarity(), category()

**Validatable Trait** - validate_parameter(), validate_command(), generate_command(), check_cooldown()

**ElexError** - Covers all 6 bounded contexts with actionable messages

---

## Appendix C: Success Metrics Summary

| Metric | Target | Phase | Verification |
|--------|--------|-------|--------------|
| Feature Agents | 593 | 6 | Agent count query |
| SIMD Speedup | 3-8x | 2 | `cargo bench --features simd` |
| HNSW Search | <1ms P95 | 3 | HNSW benchmark |
| Q-Learning Convergence | <100 interactions | 3 | Convergence test |
| Memory Budget | <500MB | 4 | Memory profiling |
| Routing Latency | <1ms P95 | 4 | Router benchmark |
| Federated Sync | 99% success | 4 | Sync test |
| Safe Zone Coverage | 100% | 5 | Validation test |
| Rollback Success | 99.9% | 5 | Rollback test |
| Binary Size | <500KB | 6 | `ls -la *.wasm.br` |
| Query Latency | <500ms P95 | 6 | E2E benchmark |
| Browser Compat | Chrome/FF/Safari | 6 | Browser tests |

---

## Appendix D: Risk Mitigation

### D.1 Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **R-001: Rollback Failure** | Low | Critical | Dual-path verification, mandatory testing, human escalation |
| **R-002: Byzantine Agent Corruption** | Low | Critical | External oracle validation, outcome correlation, agent isolation |
| **R-003: Safe Zone Violation** | Very Low | Critical | Hardcoded limits, compile-time verification, no runtime override |
| **R-004: Consensus Split-Brain** | Low | Critical | Raft quorum enforcement, partition detection, automatic healing |
| **R-005: Network Degradation from Optimization** | Medium | High | 30-minute validation window, automatic rollback, approval gates |

### D.2 Risk Mitigation Strategy

```
+=========================================================================+
|                      RISK MITIGATION LAYERS                              |
+=========================================================================+

  +------------------------------------------------------------------+
  |  LAYER 1: PREVENTION                                              |
  |  - Hardcoded safe zones (no override)                             |
  |  - Compile-time constraint verification                           |
  |  - Ed25519 + AES-256 cryptography                                 |
  |  - Raft consensus for critical decisions                          |
  +------------------------------------------------------------------+
                                 |
                                 v
  +------------------------------------------------------------------+
  |  LAYER 2: DETECTION                                               |
  |  - SNN anomaly detection                                          |
  |  - KPI degradation monitoring                                     |
  |  - Byzantine behavior analysis                                    |
  |  - Message signature verification                                 |
  +------------------------------------------------------------------+
                                 |
                                 v
  +------------------------------------------------------------------+
  |  LAYER 3: RESPONSE                                                |
  |  - Automatic rollback within 30 minutes                           |
  |  - Agent isolation on suspicious behavior                         |
  |  - Optimization pause on network events                           |
  |  - Escalation to human operators                                  |
  +------------------------------------------------------------------+
                                 |
                                 v
  +------------------------------------------------------------------+
  |  LAYER 4: RECOVERY                                                |
  |  - Rollback point restoration                                     |
  |  - Q-table version rollback                                       |
  |  - Agent respawn with clean state                                 |
  |  - Incident post-mortem and learning                              |
  +------------------------------------------------------------------+
```

### D.3 Claude-Flow V3 Risk Mitigation

**Risk: SIMD Browser Support**

**Mitigation via Hooks:**
```bash
# Detect SIMD support and route appropriately
npx @claude-flow/cli@latest hooks coverage-route --task "SIMD deployment" --path "wasm/crates/elex-simd"
```

**Risk: Memory Pressure**

**Mitigation via Workers:**
```bash
# Monitor and optimize memory
npx @claude-flow/cli@latest hooks worker dispatch --trigger optimize
npx @claude-flow/cli@latest hooks worker dispatch --trigger consolidate
```

**Risk: Security Vulnerabilities**

**Mitigation via Security Commands:**
```bash
# Regular security scans
npx @claude-flow/cli@latest security scan --depth full
npx @claude-flow/cli@latest security audit --output report.json
npx @claude-flow/cli@latest security cve --check-dependencies
```

**Risk: Performance Regression**

**Mitigation via Benchmarking:**
```bash
# Continuous benchmarking
npx @claude-flow/cli@latest performance benchmark --suite all
npx @claude-flow/cli@latest performance profile --target "query-pipeline"
```

---

## Appendix E: Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-10 | ELEX Team | Initial PRD |
| 2.0.0 | 2026-01-10 | ELEX Team | Added phased implementation |
| 2.0.0 | 2026-01-10 | ELEX Team | Added 8-phase Rust/WASM |
| 3.0.0 | 2026-01-10 | ELEX Team | Merged all PRDs into single comprehensive document |
| 3.1.0 | 2026-01-10 | ELEX Team | **Enhanced integration with full Claude-Flow V3 hooks, detailed task specifications, and comprehensive technical appendices** |
| 4.0.0 | 2026-01-11 | ELEX Team | **Added GNN self-learning, SONA architecture, Tiny Dancer routing, dynamic Min-Cut, and graph query capabilities from RuVector spec** |

---

## Cross-References

> **Implementation Details**: For WASM crate implementations, code samples, and detailed Rust specifications, see [self-learning-swarm-PRD.md](./self-learning-swarm-PRD.md).

---

*End of PRD v4.0.0*

**Platform:** @ruvector/edge (npm) + elex-* (Rust crates) + claude-flow v3 | **Cost:** $0-50/month | **Scale:** Unlimited (edge-first) | **ROI:** 90% cost reduction vs. cloud AI
