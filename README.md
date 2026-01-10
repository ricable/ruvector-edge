# ELEX Edge AI Agent Swarm

**593 specialized self-learning agents** for Ericsson RAN feature optimization - edge-first, zero-cloud operation.

**Project**: ELEX Edge AI Agent Swarm
**Version**: 4.0.0
**Platform**: @ruvector/edge + claude-flow v3
**Status**: Phase 8 Complete - WASM SDK Production Ready ✅

---

## Quick Navigation

| Document | Description | Priority |
|----------|-------------|----------|
| **[Getting Started](./GETTING_STARTED.md)** | Quick start guide for WASM SDK | CRITICAL |
| **[Phase 8 Architecture](./src/wasm/PHASE8_ARCHITECTURE.md)** | WASM SDK architecture (2,309 lines) | CRITICAL |
| **[PRD](./docs/PRD.md)** | Product Requirements Document - Complete system specification | HIGH |
| **[ADR Index](./docs/adr/README.md)** | Architecture Decision Records (32 decisions) | HIGH |
| **[DDD Index](./docs/ddd/README.md)** | Domain-Driven Design documentation | HIGH |
| **[Architecture](./docs/architecture.md)** | Complete system architecture (merged ELEX + Claude Flow V3) | HIGH |

---

## Documentation Structure

```
docs/
├── README.md                      # Documentation index
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

src/wasm/                           # Phase 8 WASM SDK Implementation ✅
├── PHASE8_ARCHITECTURE.md          # Complete WASM SDK architecture (2,309 lines)
├── agent/                          # Main WASM agent package
│   ├── src/
│   │   ├── lib.rs                  # WASM exports (251 lines)
│   │   ├── simd_ops.rs             # SIMD operations (1,260 lines)
│   │   ├── feature_agent.rs        # Agent structures (448 lines)
│   │   ├── q_learning.rs           # Q-learning (587 lines)
│   │   ├── agent_registry.rs       # HNSW routing (594 lines)
│   │   └── *_test.rs               # Unit tests (1,914 lines)
│   ├── tests/
│   │   ├── integration/            # WASM integration tests
│   │   ├── property/               # Property-based tests
│   │   └── fixtures/               # Test fixtures
│   └── benches/                    # Performance benchmarks
│
└── crates/                         # 8 modular crates
    ├── elex-core/                  # Core types and traits
    ├── elex-simd/                  # SIMD operations
    ├── elex-qlearning/             # Q-learning engine
    ├── elex-crypto/                # Cryptography (Ed25519, AES-256)
    ├── elex-routing/               # Raft + Gossip coordination
    ├── elex-safety/                # Safe zone enforcement
    ├── elex-memory/                # HNSW index + caching
    └── elex-wasm/                  # WASM bindings
```

---

## Key Documents by Category

### Product & Requirements

| Document | Description | Links |
|----------|-------------|-------|
| [PRD](./docs/PRD.md) | Complete product requirements with 7-phase implementation (52 tasks) | [PRD](./docs/PRD.md) |
| [Implementation Roadmap](./docs/implementation-roadmap.md) | Phased development plan | [Roadmap](./docs/implementation-roadmap.md) |

### Architecture

| Document | Description | Links |
|----------|-------------|-------|
| [Architecture](./docs/architecture.md) | Complete system architecture (ELEX + Claude Flow V3) | [Architecture](./docs/architecture.md) |
| [Rust Architecture](./docs/rust-architecture.md) | Rust/WASM implementation architecture | [Rust](./docs/rust-architecture.md) |
| [WASM Agents](./docs/wasm-agents.md) | WebAssembly agent specification | [WASM](./docs/wasm-agents.md) |
| [Security Integration](./docs/security-integration.md) | Security architecture and integration | [Security](./docs/security-integration.md) |

### Architecture Decision Records (ADRs)

| Category | ADRs | Description |
|----------|------|-------------|
| **Core Architecture** (001-010) | 10 decisions | Swarm topology, consensus, Q-learning, HNSW, security |
| **Rust/WASM** (011-020) | 10 decisions | Memory model, unsafe policy, SIMD, error handling |
| **Extended** (101-108) | 8 decisions | Neural architecture, protocols, federated learning, DDD |
| **V3 Integration** (109-112) | 4 decisions | Claude-Flow V3 integration (proposed) |

**[View all ADRs →](./docs/adr/README.md)**

### Domain-Driven Design (DDD)

| Context | Files | Description |
|---------|-------|-------------|
| **Knowledge** | [context-knowledge.md](./docs/ddd/context-knowledge.md) | FeatureAgent aggregate, 593 features, 9,432 parameters |
| **Intelligence** | [context-intelligence.md](./docs/ddd/context-intelligence.md) | LearningAgent, Q-Tables, trajectories, federated sync |
| **Optimization** | [context-optimization.md](./docs/ddd/context-optimization.md) | OptimizationCycle, KPI monitoring, safe zones |
| **Coordination** | [context-coordination.md](./docs/ddd/context-coordination.md) | Swarm aggregate, consensus, routing, topology |
| **Security** | [context-security.md](./docs/ddd/context-security.md) | AgentIdentity, cryptography, access control |
| **Runtime** | [context-runtime.md](./docs/ddd/context-runtime.md) | RuntimeEnvironment, WASM modules, memory management |

**[View all DDD docs →](./docs/ddd/README.md)**

### Technical Analysis

| Document | Description | Links |
|----------|-------------|-------|
| [Technical Decisions Matrix](./docs/technical-decisions-matrix.md) | Cross-reference analysis of all decisions | [Matrix](./docs/technical-decisions-matrix.md) |
| [Decisions Matrix v2](./docs/decisions-matrix-v2.md) | Updated decisions matrix | [v2](./docs/decisions-matrix-v2.md) |

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
| **Task Routing Latency** | <1ms semantic matching |
| **Memory Budget** | 500MB max, 50 cached agents |

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

## Quick Start

```bash
# Install dependencies (using Bun for faster installs)
bun install

# Run tests
bun test

# Run WASM demo
bun run demo:node

# Run benchmark with JSON output (for CI)
bun run demo:benchmark

# Build WASM modules
cd src/wasm && ./build-optimized.sh

# Run development server
bun run dev
```

---

## Maintenance

### Adding New Documentation

1. **ADRs**: Add to `docs/adr/` directory, update `docs/adr/README.md`
2. **DDD Contexts**: Add to `docs/ddd/` directory, update `docs/ddd/README.md`
3. **Architecture**: Add to `docs/` directory, update this README

### Documentation Standards

- All ADRs follow MADR 3.0 format
- All DDD contexts follow bounded context template
- All documentation uses GitHub Flavored Markdown
- Include diagrams where appropriate (ASCII art for compatibility)

---

## License

MIT License - See LICENSE file for details

---

*Last Updated: 2026-01-10*
*Documentation Version: 3.1.0*
