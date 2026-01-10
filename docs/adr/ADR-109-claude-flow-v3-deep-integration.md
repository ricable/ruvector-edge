# ADR-109: Claude-Flow V3 Deep Integration

## Status
Proposed

## Date
2026-01-10

## Context

The ELEX Edge AI Agent Swarm system requires tight integration with claude-flow v3 to leverage its advanced orchestration, memory, and learning capabilities. This ADR defines how 593 Ericsson RAN feature agents map to claude-flow v3's architecture.

### Current ELEX Architecture
- **593 Feature Agents:** WASM + SIMD + Q-learning agents for RAN feature management
- **14 Category Coordinators:** Raft consensus for cross-category decisions
- **Hybrid Topology:** Raft coordinators + Gossip feature swarms
- **4-Layer Memory:** Hot, Warm, Cold storage with HNSW indexing
- **Q-Learning Engine:** Tabular state-action-reward framework

### Claude-Flow V3 Capabilities
- **26 CLI Commands, 140+ Subcommands:** Comprehensive orchestration
- **60+ Agent Types:** Including specialized swarm coordinators
- **Unified Memory Service:** AgentDB + SQLite + Hybrid backends
- **12 Background Workers:** Continuous optimization and learning
- **RuVector Intelligence:** SONA, MoE, HNSW, EWC++
- **Hooks System:** 27 hooks for lifecycle management

### Integration Challenges
1. ELEX agents run in WASM; claude-flow runs in Node.js
2. ELEX uses Raft/Gossip; claude-flow uses hierarchical-mesh
3. ELEX has 593 specialized agents; claude-flow has 60+ generic types
4. Memory architectures differ in structure but share HNSW indexing

## Decision

We adopt a **Bridge Architecture** that maps ELEX components to claude-flow v3 equivalents while preserving ELEX's domain-specific optimizations.

### 1. Agent Mapping

| ELEX Agent Type | Claude-Flow Agent | Bridge Function |
|-----------------|-------------------|-----------------|
| Category Coordinator (14) | `hierarchical-coordinator` | `elex-coordinator-bridge` |
| Feature Agent (593) | `specialized-worker` | `elex-feature-bridge` |
| Gossip Node | `gossip-coordinator` | Native support |
| Raft Leader | `raft-manager` | Native support |
| Byzantine Validator | `byzantine-coordinator` | Native support |

### 2. CLI Integration

```bash
# Register ELEX agents with claude-flow
npx @claude-flow/cli@latest agent spawn -t elex-feature --name "IFLB-001" --config '{
  "faj": "FAJ1234567",
  "category": "load_balancing",
  "parameters": ["lbTpNonQualFraction", "lbThreshold"]
}'

# Initialize ELEX swarm via claude-flow
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical-mesh \
  --max-agents 607 \
  --strategy adaptive \
  --config elex.swarm.json

# Route ELEX tasks through hooks
npx @claude-flow/cli@latest hooks route \
  --task "Optimize MIMO configuration for cell site A" \
  --context "ericsson-ran"
```

### 3. Hook Mapping

| ELEX Event | Claude-Flow Hook | Purpose |
|------------|------------------|---------|
| Q-table update | `post-task` | Record learning outcomes |
| Feature activation | `pre-command` | Validate safe zone constraints |
| KPI anomaly | `pre-edit` | Trigger optimization cycle |
| Federated merge | `post-command` | Sync Q-tables across swarm |
| Session start | `session-start` | Initialize agent context |
| Session end | `session-end` | Persist learned patterns |

### 4. Worker Integration

```typescript
// Map ELEX workers to claude-flow daemon workers
const elexWorkerMapping = {
  // ELEX Worker -> Claude-Flow Worker
  'kpi-monitor': 'optimize',        // Performance optimization
  'anomaly-detector': 'audit',      // Security/anomaly analysis
  'pattern-consolidator': 'consolidate', // Memory consolidation
  'federated-merger': 'ultralearn', // Deep knowledge acquisition
  'safe-zone-validator': 'audit',   // Critical safety checks
  'q-table-optimizer': 'optimize',  // Q-table compression/optimization
};

// Start daemon with ELEX worker profile
npx @claude-flow/cli@latest daemon start --profile elex
```

### 5. Memory Bridge Configuration

```json
{
  "memory": {
    "backend": "hybrid",
    "elex": {
      "enabled": true,
      "namespaces": {
        "qtables": "elex.qtables",
        "trajectories": "elex.trajectories",
        "patterns": "elex.patterns",
        "kpis": "elex.kpis"
      },
      "syncInterval": 60000,
      "hnswConfig": {
        "M": 16,
        "efConstruction": 200,
        "efSearch": 100
      }
    }
  }
}
```

### 6. Custom ELEX Agent Types

Register ELEX-specific agent types with claude-flow:

```typescript
// elex-agents.ts
export const elexAgentTypes = {
  'elex-feature': {
    description: 'ELEX RAN Feature Agent (Q-Learning)',
    systemPrompt: `You are an Ericsson RAN feature optimization agent.
      - Monitor KPIs and parameter performance
      - Suggest optimizations within safe zones
      - Coordinate with peer agents via federated learning
      - Explain decisions using Q-table insights`,
    allowedTools: ['memory_*', 'task_*', 'hooks_*'],
    model: 'sonnet'
  },
  'elex-coordinator': {
    description: 'ELEX Category Coordinator (Raft)',
    systemPrompt: `You are an ELEX category coordinator managing feature agents.
      - Route tasks to appropriate feature agents
      - Maintain consensus on feature activations
      - Enforce safe zone constraints
      - Coordinate cross-category decisions`,
    allowedTools: ['*'],
    model: 'opus'
  }
};
```

## Consequences

### Positive
- **Unified Orchestration:** Single CLI for both ELEX and claude-flow operations
- **Shared Memory:** HNSW-indexed storage accessible by both systems
- **Hook Integration:** ELEX events trigger claude-flow learning pipelines
- **Worker Synergy:** Background workers optimize both systems
- **Extensibility:** New ELEX features can leverage claude-flow infrastructure

### Negative
- **Bridge Complexity:** Additional layer between ELEX WASM and claude-flow Node.js
- **Version Coupling:** Both systems must be version-compatible
- **Performance Overhead:** Cross-system calls add latency (~5-10ms)
- **Learning Curve:** Developers must understand both architectures

### Risks
- **Protocol Mismatch:** ELEX Raft/Gossip may conflict with claude-flow consensus
- **Memory Conflicts:** Concurrent writes from both systems
- **Hook Timing:** ELEX real-time requirements may exceed hook timeouts

### Mitigations
- **Protocol Adapter:** Bridge layer translates between consensus protocols
- **Write Locking:** Namespace-level locks prevent concurrent modifications
- **Async Hooks:** Non-blocking hook execution with configurable timeouts

## Claude-Flow Integration

### Hooks Configuration
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": ["npx @claude-flow/cli@latest hooks pre-command --context elex"]
    }],
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": ["npx @claude-flow/cli@latest hooks post-command --track-metrics true"]
    }],
    "UserPromptSubmit": [{
      "hooks": ["npx @claude-flow/cli@latest hooks route --task \"$PROMPT\" --context ericsson-ran"]
    }]
  }
}
```

### CLI Commands for ELEX
```bash
# List ELEX feature agents
npx @claude-flow/cli@latest agent list --type elex-feature

# Check ELEX swarm health
npx @claude-flow/cli@latest swarm status --filter elex

# Search ELEX patterns in memory
npx @claude-flow/cli@latest memory search --query "MIMO optimization" --namespace elex.patterns

# Trigger ELEX-specific worker
npx @claude-flow/cli@latest daemon trigger optimize --context elex
```

### MCP Tool Extensions
```typescript
// Additional MCP tools for ELEX
const elexMCPTools = [
  'elex/feature-status',      // Get feature agent status
  'elex/kpi-query',           // Query KPI data
  'elex/safe-zone-check',     // Validate parameter changes
  'elex/federated-sync',      // Trigger federated merge
  'elex/q-table-export',      // Export Q-table for analysis
];
```

## References
- ADR-001: Swarm Topology Selection
- ADR-004: One Agent Per Feature Specialization
- ADR-101: Neural Agent Architecture
- Claude-Flow ADR-001: Adopt agentic-flow as Core Foundation
- Claude-Flow ADR-018: Claude Code Deep Integration
- Claude-Flow ADR-014: Cross-Platform Workers System

---

**Author:** SPARC Architecture Agent
**Last Updated:** 2026-01-10
