# ELEX Documentation Index

**Project**: ELEX Edge AI Agent Swarm
**Version**: 3.1.0
**Platform**: @ruvector/edge + claude-flow v3
**Status**: Architecture Finalized

---

## Quick Navigation

| Document | Description | Priority |
|----------|-------------|----------|
| **[PRD](./PRD.md)** | Product Requirements Document - Complete system specification | CRITICAL |
| **[ADR Index](./adr/README.md)** | Architecture Decision Records (32 decisions) | HIGH |
| **[DDD Index](./ddd/README.md)** | Domain-Driven Design documentation | HIGH |
| **[Architecture](./architecture.md)** | Complete system architecture (merged ELEX + Claude Flow V3) | HIGH |
| **[Technical Decisions Matrix](./technical-decisions-matrix.md)** | Cross-reference analysis | MEDIUM |

---

## Documentation Structure

```
docs/
├── README.md                      # This file - documentation index
├── PRD.md                         # Product Requirements Document
├── architecture.md                # Complete system architecture (merged)
├── technical-decisions-matrix.md  # Cross-reference analysis
│
├── adr/                           # Architecture Decision Records (32 total)
│   ├── README.md                  # ADR Index with all decisions
│   ├── ADR-001 to ADR-020        # Core & Rust/WASM decisions
│   ├── ADR-101 to ADR-108        # Extended architecture decisions
│   └── ADR-109 to ADR-112        # Claude-Flow V3 integration
│
├── ddd/                           # Domain-Driven Design documentation
│   ├── README.md                  # DDD index
│   ├── bounded-contexts.md        # Bounded contexts overview
│   ├── context-map.md             # Detailed context map
│   ├── context-*.md               # Individual context files (6 contexts)
│   ├── aggregates.md              # Aggregate definitions
│   ├── domain-model.md            # Domain model details
│   ├── domain-events.md           # Domain events catalog
│   ├── event-storming.md          # Event storming results
│   ├── ubiquitous-language.md     # Ubiquitous language dictionary
│   ├── rust-mapping.md            # DDD to Rust implementation guide
│   └── archive/                   # Legacy DDD documentation
│
└── archive/                       # Historical/archived documents
    ├── PRD-*.md                   # Previous PRD versions
    └── shortPRD.md                # Executive summary PRD
```

---

## Key Documents by Category

### Product & Requirements

| Document | Description | Links |
|----------|-------------|-------|
| [PRD](./PRD.md) | Complete product requirements with 7-phase implementation (52 tasks) | [PRD](./PRD.md) |
| [Implementation Roadmap](./implementation-roadmap.md) | Phased development plan | [Roadmap](./implementation-roadmap.md) |

### Architecture

| Document | Description | Links |
|----------|-------------|-------|
| [Architecture](./architecture.md) | Complete system architecture (ELEX + Claude Flow V3) | [Architecture](./architecture.md) |
| [Rust Architecture](./rust-architecture.md) | Rust/WASM implementation architecture | [Rust](./rust-architecture.md) |
| [WASM Agents](./wasm-agents.md) | WebAssembly agent specification | [WASM](./wasm-agents.md) |
| [Security Integration](./security-integration.md) | Security architecture and integration | [Security](./security-integration.md) |

### Architecture Decision Records (ADRs)

| Category | ADRs | Description |
|----------|------|-------------|
| **Core Architecture** (001-010) | 10 decisions | Swarm topology, consensus, Q-learning, HNSW, security |
| **Rust/WASM** (011-020) | 10 decisions | Memory model, unsafe policy, SIMD, error handling |
| **Extended** (101-108) | 8 decisions | Neural architecture, protocols, federated learning, DDD |
| **V3 Integration** (109-112) | 4 decisions | Claude-Flow V3 integration (proposed) |

**[View all ADRs →](./adr/README.md)**

### Domain-Driven Design (DDD)

| Context | Files | Description |
|---------|-------|-------------|
| **Knowledge** | [context-knowledge.md](./ddd/context-knowledge.md) | FeatureAgent aggregate, 593 features, 9,432 parameters |
| **Intelligence** | [context-intelligence.md](./ddd/context-intelligence.md) | LearningAgent, Q-Tables, trajectories, federated sync |
| **Optimization** | [context-optimization.md](./ddd/context-optimization.md) | OptimizationCycle, KPI monitoring, safe zones |
| **Coordination** | [context-coordination.md](./ddd/context-coordination.md) | Swarm aggregate, consensus, routing, topology |
| **Security** | [context-security.md](./ddd/context-security.md) | AgentIdentity, cryptography, access control |
| **Runtime** | [context-runtime.md](./ddd/context-runtime.md) | RuntimeEnvironment, WASM modules, memory management |

**[View all DDD docs →](./ddd/README.md)**

### Technical Analysis

| Document | Description | Links |
|----------|-------------|-------|
| [Technical Decisions Matrix](./technical-decisions-matrix.md) | Cross-reference analysis of all decisions | [Matrix](./technical-decisions-matrix.md) |
| [Decisions Matrix v2](./decisions-matrix-v2.md) | Updated decisions matrix | [v2](./decisions-matrix-v2.md) |

---

## Document Summary

### ADR Summary (32 Decisions)

| Number | Status | Category |
|--------|--------|----------|
| 001-010 | Accepted | Core Architecture |
| 011-020 | Accepted | Rust/WASM Implementation |
| 101-108 | Accepted | Extended Architecture |
| 109-112 | Proposed | Claude-Flow V3 Integration |

### DDD Bounded Contexts (6 Contexts)

| Context | Type | Key Aggregates |
|---------|------|---------------|
| Knowledge | Core | FeatureAgent, FeatureCatalog |
| Intelligence | Core | QTable, TrajectoryBuffer, FederatedMerger |
| Optimization | Supporting | OptimizationCycle |
| Coordination | Core | Swarm |
| Security | Generic | AgentIdentity |
| Runtime | Generic | RuntimeEnvironment |

---

## Quick Reference

### Key Metrics

| Metric | Value |
|--------|-------|
| **Feature Agents** | 593 specialized experts |
| **Parameters** | 9,432 across 593 features |
| **Counters** | 3,368 across 593 features |
| **KPIs** | 199 across 593 features |
| **Infrastructure Cost** | $0/month (edge-first) |
| **HNSW Search Speedup** | 150x-12,500x faster |
| **SIMD Speedup** | 3-8x performance improvement |

### Technology Stack

| Layer | Technology |
|-------|------------|
| Core | Rust/WASM |
| SIMD | wasm32 simd128 |
| Memory | HNSW, IndexedDB |
| Coordination | Raft, Gossip |
| Security | Ed25519, AES-256-GCM |
| Integration | claude-flow v3 |

---

## Maintenance

### Adding New Documentation

1. **ADRs**: Add to `adr/` directory, update `adr/README.md`
2. **DDD Contexts**: Add to `ddd/` directory, update `ddd/README.md`
3. **Architecture**: Add to root `docs/` directory, update this README

### Documentation Standards

- All ADRs follow MADR 3.0 format
- All DDD contexts follow bounded context template
- All documentation uses GitHub Flavored Markdown
- Include diagrams where appropriate (ASCII art for compatibility)

---

## Related Resources

- **Project Root**: [../README.md](../README.md)
- **Claude Flow V3**: [claude-flow-v3/](../claude-flow-v3/)
- **Configuration**: [CLAUDE.md](../CLAUDE.md)

---

*Last Updated: 2026-01-10*
*Documentation Version: 3.1.0*
