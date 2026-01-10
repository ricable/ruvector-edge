# ELEX Edge AI Agent Swarm - Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting the key architectural decisions for the ELEX Edge AI Agent Swarm system.

---

## ADR Status Legend

| Status | Description |
|--------|-------------|
| ACCEPTED | Decision finalized and approved |
| PROPOSED | Under review |
| DEPRECATED | Superseded by newer decision |
| SUPERSEDED | Replaced by referenced ADR |

---

## ADR Index

### Core Architectural Decisions (001-010)

| ADR | Title | Status | Category | Impact |
|-----|-------|--------|----------|--------|
| [ADR-001](ADR-001-swarm-topology.md) | Swarm Topology Selection | Accepted | Architecture | HIGH |
| [ADR-002](ADR-002-consensus-protocol.md) | Consensus Protocol Selection | Accepted | Coordination | CRITICAL |
| [ADR-003](ADR-003-edge-first-architecture.md) | Edge-First Zero-Cloud Architecture | Accepted | Infrastructure | HIGH |
| [ADR-004](ADR-004-agent-specialization.md) | One Agent Per Feature Specialization | Accepted | Architecture | HIGH |
| [ADR-005](ADR-005-vector-memory-hnsw.md) | HNSW Vector Indexing for Semantic Routing | Accepted | Memory | HIGH |
| [ADR-006](ADR-006-q-learning-engine.md) | Q-Learning Engine for Self-Learning | Accepted | Intelligence | HIGH |
| [ADR-007](ADR-007-security-cryptography.md) | Security and Cryptography Architecture | Accepted | Security | CRITICAL |
| [ADR-008](ADR-008-safe-zone-constraints.md) | Safe Zone Parameter Constraints | Accepted | Safety | CRITICAL |
| [ADR-009](ADR-009-federated-learning.md) | Federated Learning for P2P Knowledge Sharing | Accepted | Intelligence | HIGH |
| [ADR-010](ADR-010-closed-loop-optimization.md) | Closed-Loop Optimization Cycle | Accepted | Operations | CRITICAL |

### Rust/WASM Implementation Decisions (011-020)

| ADR | Title | Status | Category | Impact |
|-----|-------|--------|----------|--------|
| [ADR-011](ADR-011-rust-memory-model.md) | Rust Memory Model for Agent System | Accepted | Rust/Memory | HIGH |
| [ADR-012](ADR-012-unsafe-rust-policy.md) | Unsafe Rust Policy | Accepted | Rust/Safety | CRITICAL |
| [ADR-013](ADR-013-wasm-bindgen-strategy.md) | wasm-bindgen Strategy for JS Interop | Accepted | WASM/Interop | HIGH |
| [ADR-014](ADR-014-simd-implementation.md) | SIMD Implementation Strategy | Accepted | Performance | HIGH |
| [ADR-015](ADR-015-error-handling.md) | Error Handling Strategy | Accepted | Rust/Quality | HIGH |
| [ADR-016](ADR-016-testing-strategy.md) | Testing Strategy for Rust/WASM | Accepted | Quality | HIGH |
| [ADR-017](ADR-017-workspace-structure.md) | Cargo Workspace Structure | Accepted | Rust/Build | MEDIUM |
| [ADR-018](ADR-018-concurrency-model.md) | Concurrency Model for WASM Agents | Accepted | WASM/Concurrency | HIGH |
| [ADR-019](ADR-019-persistence-format.md) | Persistence Format for Q-Tables | Accepted | Storage | HIGH |
| [ADR-020](ADR-020-trait-design.md) | Trait Design for Agent System | Accepted | Rust/Design | HIGH |

### Extended Architecture Decisions (101-108)

| ADR | Title | Status | Category | Impact |
|-----|-------|--------|----------|--------|
| [ADR-101](ADR-101-neural-agent-architecture.md) | Neural Agent Architecture for RAN | Accepted | Architecture | HIGH |
| [ADR-102](ADR-102-swarm-coordination-protocol.md) | ELEX Native Coordination Protocol (Raft + Gossip) | Accepted | Coordination | HIGH |
| [ADR-103](ADR-103-federated-learning-strategy.md) | Federated Learning Strategy | Accepted | Intelligence | HIGH |
| [ADR-104](ADR-104-ruvector-memory-integration.md) | RuVector Memory Integration | Accepted | Memory | HIGH |
| [ADR-105](ADR-105-wasm-simd-acceleration.md) | WASM SIMD Acceleration | Accepted | Performance | HIGH |
| [ADR-106](ADR-106-safe-zone-enforcement.md) | Safe Zone Enforcement | Accepted | Safety | CRITICAL |
| [ADR-107](ADR-107-domain-driven-design-structure.md) | Domain-Driven Design Structure | Accepted | Architecture | HIGH |
| [ADR-108](ADR-108-ericsson-feature-ontology.md) | Ericsson Feature Ontology | Accepted | Domain | HIGH |

### Claude-Flow V3 Integration Decisions (109-112)

| ADR | Title | Status | Category | Impact |
|-----|-------|--------|----------|--------|
| [ADR-109](ADR-109-claude-flow-v3-deep-integration.md) | Claude-Flow V3 Deep Integration | Proposed | Integration | CRITICAL |
| [ADR-110](ADR-110-swarm-coordination-alignment.md) | Swarm Coordination Protocol Alignment | Proposed | Coordination | HIGH |
| [ADR-111](ADR-111-memory-unification.md) | Memory Unification Strategy | Proposed | Memory | HIGH |
| [ADR-112](ADR-112-neural-learning-pipeline.md) | Neural Learning Pipeline Integration | Proposed | Intelligence | HIGH |

---

## ADR Categories

### By Domain

| Category | ADRs | Description |
|----------|------|-------------|
| **Architecture** | 001, 004, 101, 107 | System structure and organization |
| **Coordination** | 002, 102, 110 | Multi-agent coordination and consensus |
| **Infrastructure** | 003 | Deployment and runtime environment |
| **Memory** | 005, 104, 111 | Vector storage and semantic search |
| **Intelligence** | 006, 009, 103, 112 | Learning algorithms and knowledge sharing |
| **Security** | 007 | Cryptography and access control |
| **Safety** | 008, 106 | Parameter constraints and guardrails |
| **Operations** | 010 | Optimization and operational workflows |
| **Performance** | 014, 105 | SIMD acceleration and optimization |
| **Domain** | 108 | Ericsson RAN feature knowledge |
| **Integration** | 109 | Claude-Flow V3 integration architecture |

### By Technology

| Category | ADRs | Description |
|----------|------|-------------|
| **Rust Core** | 011, 012, 015, 017, 020 | Rust language patterns and practices |
| **WASM** | 013, 014, 018, 105 | WebAssembly-specific decisions |
| **Storage** | 019 | Persistence and serialization |
| **Testing** | 016 | Quality assurance strategy |

---

## Decision Matrix

### By Impact Level

| Impact | Count | ADRs |
|--------|-------|------|
| CRITICAL | 7 | 002, 007, 008, 010, 012, 106, 109 |
| HIGH | 25 | 001, 003, 004, 005, 006, 009, 011, 013, 014, 015, 016, 018, 019, 020, 101, 102, 103, 104, 105, 107, 108, 110, 111, 112 |
| MEDIUM | 1 | 017 |

### Critical Decisions Summary

These decisions have the highest impact and require careful implementation:

1. **ADR-002** - Consensus Protocol (Raft + Gossip hybrid)
2. **ADR-007** - Security Architecture (Ed25519, AES-256-GCM)
3. **ADR-008** - Safe Zone Constraints (parameter bounds enforcement)
4. **ADR-010** - Closed-Loop Optimization (OALA cycle)
5. **ADR-012** - Unsafe Rust Policy (SIMD intrinsics, FFI safety)
6. **ADR-106** - Safe Zone Enforcement (runtime validation)
7. **ADR-109** - Claude-Flow V3 Deep Integration (unified orchestration)

---

## ADR Dependencies

### Core Architecture Chain

```
ADR-003 (Edge-First)
    |
    v
ADR-004 (Agent Specialization)
    |
    +---> ADR-006 (Q-Learning)
    |         |
    |         v
    |     ADR-009 (Federated Learning)
    |
    v
ADR-001 (Topology)
    |
    v
ADR-002 (Consensus)
    |
    v
ADR-005 (HNSW Memory)
    |
    v
ADR-010 (Closed-Loop)
```

### Rust/WASM Implementation Chain

```
ADR-011 (Memory Model)
    |
    +---> ADR-012 (Unsafe Policy)
    |         |
    |         v
    |     ADR-014 (SIMD)
    |
    +---> ADR-020 (Traits)
    |
    v
ADR-017 (Workspace)
    |
    +---> ADR-013 (wasm-bindgen)
    |         |
    |         v
    |     ADR-015 (Error Handling)
    |
    +---> ADR-018 (Concurrency)
    |
    v
ADR-016 (Testing)
    |
    v
ADR-019 (Persistence)
```

### Cross-References

| ADR | References | Referenced By |
|-----|------------|---------------|
| ADR-011 | 003, 101, 105 | 012, 013, 017, 018, 019 |
| ADR-012 | 011, 014 | 016 |
| ADR-013 | 011, 015 | 018, 019 |
| ADR-014 | 012, 105 | 016 |
| ADR-015 | 012, 013 | 020 |
| ADR-016 | 012, 014 | - |
| ADR-017 | 011, 016 | - |
| ADR-018 | 011, 013 | - |
| ADR-019 | 011, 013 | - |
| ADR-020 | 011, 015 | - |

---

## Format

All ADRs follow the MADR (Markdown Any Decision Records) 3.0 format:

1. **Status**: Proposed | Accepted | Deprecated | Superseded
2. **Context**: Why the decision was needed
3. **Decision**: What was decided
4. **Alternatives Considered**: Other options evaluated
5. **Consequences**: Positive, negative, and risks
6. **References**: Links to related ADRs and external resources

---

## Rust/WASM ADR Quick Reference

### Memory Management (ADR-011)
- Ownership patterns: Agent-owned state, Arc for shared immutable, Arc<Mutex> for shared mutable
- Memory pools for allocation efficiency
- WASM linear memory management

### Unsafe Code (ADR-012)
- Acceptable: SIMD intrinsics, wasm-bindgen FFI, bounded unchecked access
- Forbidden: Mutable statics, unbounded transmute
- Required: SAFETY comments, Miri testing, enhanced review

### JS Interop (ADR-013)
- serde-wasm-bindgen for complex types
- Raw bytes for bulk data (Q-tables)
- JsError for cross-boundary errors

### SIMD (ADR-014)
- simd128 target feature for 3-8x speedup
- Scalar fallback for compatibility
- Runtime feature detection

### Error Handling (ADR-015)
- thiserror for library code
- anyhow for application code
- Error codes for programmatic handling

### Testing (ADR-016)
- wasm-bindgen-test for browser tests
- proptest for property-based testing
- criterion for benchmarks
- Miri for unsafe validation

### Workspace (ADR-017)
- Domain-aligned crates: core, simd, wasm, memory, etc.
- Feature flags for optional capabilities
- Dual SIMD/scalar builds

### Concurrency (ADR-018)
- Single-threaded async by default
- Web Worker offloading for heavy operations
- Optional SharedArrayBuffer for true parallelism

### Persistence (ADR-019)
- Bincode + LZ4 compression
- Versioned headers with CRC32 checksum
- IndexedDB for browser storage

### Traits (ADR-020)
- Generics for performance-critical paths
- Trait objects for heterogeneous collections
- Object-safe designs for dyn usage

---

## Related Documents

- [ELEX PRD](../PRD.md) - Product Requirements Document
- [Architecture](../architecture.md) - Complete system architecture (ELEX + Claude Flow V3)
- [DDD Context Map](../ddd/README.md) - Domain-Driven Design bounded contexts
- [Technical Decisions Matrix](../technical-decisions-matrix.md) - Cross-reference analysis

---

## Maintenance

When adding new ADRs:
1. Use the next sequential number in the appropriate series
   - Core decisions: 001-099
   - Rust/WASM implementation: 011-020 (complete)
   - Extended decisions: 101+
2. Follow the MADR 3.0 format
3. Update this index with title, status, category, and impact
4. Link to related ADRs in References section
5. Update dependency graph if applicable
6. Assess impact level (CRITICAL, HIGH, MEDIUM, LOW)

### Numbering Convention

| Range | Purpose | Status |
|-------|---------|--------|
| 001-010 | Core architectural decisions | Complete |
| 011-020 | Rust/WASM implementation | Complete |
| 021-099 | Future core decisions | Reserved |
| 101-108 | Extended architecture | Complete |
| 109-112 | Claude-Flow V3 Integration | Proposed |
| 113-199 | Future integration decisions | Reserved |
| 200+ | Future extensions | Reserved |

---

## Claude-Flow V3 Integration Summary

The ADRs 109-112 define integration between ELEX 593-agent system and claude-flow v3:

### ADR-109: Claude-Flow V3 Deep Integration
- Maps ELEX agents to claude-flow agent types
- Defines CLI integration commands
- Hook mapping for ELEX events
- Worker integration profile

### ADR-110: Swarm Coordination Protocol Alignment
- Aligns ELEX Raft/Gossip with claude-flow hive-mind
- Layered coordination model
- Byzantine fault tolerance integration
- CLI commands for consensus management

### Cross-Reference Notes
- **ADR-002**: Original consensus protocol decision (Raft + Gossip hybrid)
- **ADR-102**: ELEX native protocol specification (Raft for coordinators, Gossip for feature agents)
- **ADR-110**: Claude-Flow V3 integration layer (maps ELEX protocols to hive-mind)

### ADR-111: Memory Unification Strategy
- Federated memory architecture
- Unified HNSW index with dimension projection
- Namespace strategy for both systems
- EWC++ integration for forgetting prevention

### ADR-112: Neural Learning Pipeline Integration
- Enhances ELEX Q-learning with RuVector SONA/MoE
- ReasoningBank trajectory storage
- Decision Transformer for multi-step optimization
- Federated learning with neural corrections

### Claude-Flow V3 Cross-References

| ELEX ADR | Claude-Flow V3 ADR | Integration Point |
|----------|-------------------|-------------------|
| ADR-001 (Topology) | CF-ADR-003 (Coordination) | Swarm topology alignment |
| ADR-002 (Consensus) | CF-ADR-003 (Coordination) | Raft/Gossip unification |
| ADR-005 (HNSW) | CF-ADR-006 (Memory) | HNSW index sharing |
| ADR-006 (Q-Learning) | CF-ADR-017 (RuVector) | Neural learning pipeline |
| ADR-102 (Protocol) | CF-ADR-014 (Workers) | Background worker mapping |
| ADR-104 (Memory) | CF-ADR-006 (Memory) | Memory unification |
