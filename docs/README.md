# Documentation Hub

Welcome to the Claude Flow V3 documentation. This is your entry point to understanding the architecture, development workflow, and implementation details.

## Quick Start

**Getting Started**: [Development Guide](development/GETTING_STARTED.md)
**Architecture Overview**: [Architecture Overview](architecture/overview.md)
**Claude Code Setup**: [Claude Code Guide](development/claude-code-guide.md)

## Documentation Structure

### 📚 Core Architecture
- **[Architecture](architecture/)** - System design, bounded contexts, architectural decisions
- **[Domain-Driven Design](ddd/)** - DDD principles, bounded context mappings, aggregate designs
- **[Architecture Decision Records](adr/)** - Technical decisions and their rationale (35 ADRs)

### 🛠️ Development
- **[Development Guide](development/GETTING_STARTED.md)** - Quick start guide
- **[Claude Code Guide](development/claude-code-guide.md)** - Using Claude Code for development
- **[Claude Flow Integration](development/claude-flow-integration.md)** - Claude Flow V3 integration
- **[Elex Development](development/elex-development.md)** - Domain-specific development patterns

### 🏗️ Implementation
- **[Implementation Roadmap](implementation/implementation-roadmap.md)** - Implementation phases and milestones
- **[Autonomic State Machine](implementation/asm-implementation-guide.md)** - FSM implementation guide
- **[Implementation Summaries](implementation/summaries/)** - Feature implementation details
- **[Product Requirements](PRD.md)** - Complete product specification

### 📡 RAN Domain
- **[RAN Architecture](ran-domain/agent-architecture.md)** - Radio Access Network architecture
- **[Memory Guide](ran-domain/memory-guide.md)** - Agent memory and learning
- **[Feature Indexing](ran-domain/features-indexing-report.md)** - RAN feature documentation
- **[250 Agents Guide](ran-domain/250-questions.md)** - Comprehensive Q&A for 250 RAN agents
- **[AI Agents Summary](ran-domain/ai-agents-implementation-summary.md)** - AI agent implementations

### 🧪 Testing
- **[Testing Guide](testing/summary.md)** - Testing methodology and coverage
- **[Memory Training](testing/memory-training-summary.md)** - Memory training reports

### 🎯 Goals
- **[RAN Domain Goals](goals/definitions/RAN_DOMAIN_GOALS.md)** - RAN-specific goals and objectives
- **[Execution Reports](goals/execution-reports/)** - Goal execution reports

### 🔀 Workflows
- **[Examples](workflows/INTEGRATED_WORKFLOW_EXAMPLE.md)** - Workflow examples and patterns
- **[Reports](workflows/reports/)** - Workflow execution reports

### ⚙️ Decisions
- **[Technical Decisions Matrix](decisions/technical-decisions-matrix.md)** - Cross-reference of technical decisions

## Key Metrics

| Metric | Value |
|--------|-------|
| **Feature Agents** | 593 specialized experts |
| **Parameters** | 9,432 across 593 features |
| **Counters** | 3,368 across 593 features |
| **KPIs** | 199 across 593 features |
| **Infrastructure Cost** | $0/month (edge-first) |
| **HNSW Search Speedup** | 150x-12,500x faster |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Core | Rust/WASM |
| SIMD | wasm32 simd128 |
| Memory | HNSW, IndexedDB |
| Coordination | Raft, Gossip |
| Security | Ed25519, AES-256-GCM |
| Integration | claude-flow v3 |

## Navigation

Each directory contains a README.md file explaining its specific purpose and contents. Use these for detailed navigation within each domain.

## Related Resources

- **[Project README](../README.md)** - Project overview and setup
- **[CHANGELOG](development/CHANGELOG.md)** - Version history and changes
- **[Package.json](../package.json)** - Dependencies and scripts

## Need Help?

1. Start with [Getting Started](development/GETTING_STARTED.md)
2. Review [Architecture Overview](architecture/overview.md) for system context
3. Check [Claude Code Guide](development/claude-code-guide.md) for development workflow
4. Browse specific ADRs for technical decisions

## Maintenance

### Adding New Documentation

1. **ADRs**: Add to `adr/` directory, update `adr/README.md`
2. **Development docs**: Add to `development/` directory, update this README
3. **Implementation docs**: Add to `implementation/` directory, update this README
4. **RAN docs**: Add to `ran-domain/` directory, update this README
5. **Testing docs**: Add to `testing/` directory, update this README
6. **Goals docs**: Add to `goals/` directory, update this README
7. **Workflows**: Add to `workflows/` directory, update this README

---

*Last updated: 2026-01-11*
*Version: Claude Flow V3*
*Total documentation files: 85*