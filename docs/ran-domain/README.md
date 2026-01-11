# RAN Domain Documentation

This section contains specialized documentation for the Radio Access Network (RAN) domain implementation.

## RAN Architecture

- **[agent-architecture.md](./agent-architecture.md)** - RAN agent architecture and design patterns
- **[memory-guide.md](./memory-guide.md)** - Agent memory and learning systems for RAN features
- **[features-indexing-report.md](./features-indexing-report.md)** - RAN feature indexing and organization

## Implementation Guides

- **[ai-agents-implementation-summary.md](./ai-agents-implementation-summary.md)** - AI agent implementations for RAN
- **[250-questions.md](./250-questions.md)** - Comprehensive Q&A for 250 RAN agents and their features

## Key Metrics

| Metric | Value | Description |
|--------|-------|-------------|
| **Feature Documents** | 1,153 | Indexed Ericsson RAN feature documents |
| **Test Questions** | 250 | Standardized battle test questions (Category A, B, C) |
| **Feature Agents** | 50 | Specialized agents tested in Battle Arena |
| **HNSW Indexing** | <1ms | Ultra-fast semantic retrieval performance |

## Technology Stack

- **Core**: Rust/WASM agents for edge deployment
- **Memory**: AgentDB (HNSW vector search) for feature retrieval
- **Learning**: Q-Learning + Decision Transformer hybrid
- **Orchestration**: Claude Flow V3 for agent coordination

## Battle Test Suite

The **[250-questions.md](./250-questions.md)** file serves as the standardized benchmark for evaluating agent performance. It covers 50 RAN features with 5 questions each, categorized into:
- **Category A**: Knowledge Retrieval (125 Qs)
- **Category B**: Decision Making (75 Qs)
- **Category C**: Advanced Scenarios (50 Qs)

Usage:
```bash
bun run scripts/self-learning-demo/battle-arena.ts --questions-file=docs/ran-domain/250-questions.md
```

## Documentation Structure

```
ran-domain/
├── agent-architecture.md      # RAN agent architecture
├── memory-guide.md          # Memory and learning systems
├── features-indexing-report.md  # Feature indexing approach
├── ai-agents-implementation-summary.md  # Implementation details
├── 250-questions.md          # Battle Test Question dataset
└── agent-questions.md       # Additional agent questions
```

## Quick Reference

| File | Description | Focus |
|------|-------------|-------|
| [agent-architecture.md](./agent-architecture.md) | Architecture overview | Design Patterns |
| [250-questions.md](./250-questions.md) | Battle Test Questions | Benchmarking |
| [memory-guide.md](./memory-guide.md) | Memory systems | HNSW/AgentDB |
| [features-indexing-report.md](./features-indexing-report.md) | Indexing approach | Data Layout |

---

*Part of [Documentation Hub](../README.md)*