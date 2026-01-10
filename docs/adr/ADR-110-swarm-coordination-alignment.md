# ADR-110: Swarm Coordination Protocol Alignment

## Status
Proposed

## Date
2026-01-10

## Context

The ELEX system uses a dual-consensus architecture (Raft + Gossip) for coordinating 593 feature agents across 14 category domains. Claude-flow v3 introduces a hive-mind consensus system with multiple topologies and strategies. This ADR defines how to align these coordination approaches.

### ELEX Coordination (ADR-002, ADR-102)
- **Raft Consensus:** 14 category coordinators for strong consistency
- **Gossip Protocol:** 593 feature agents for eventual consistency
- **Message Types:** Feature activation (Raft), Q-table sync (Gossip)
- **Quorum:** Majority (8 of 14) for Raft commits
- **Gossip Fanout:** 3 peers per round, O(log N) convergence

### Claude-Flow V3 Hive-Mind
- **Topologies:** hierarchical, mesh, hierarchical-mesh, adaptive
- **Consensus Strategies:** byzantine, raft, gossip, crdt, quorum
- **Agent Types:** Queen, Worker, byzantine-coordinator, raft-manager
- **Performance:** <100ms MCP response, <500ms CLI startup

### Alignment Challenges
1. ELEX has fixed 14+593 agent hierarchy; claude-flow is dynamic
2. ELEX Raft is domain-specific; claude-flow Raft is general-purpose
3. ELEX Gossip carries Q-tables; claude-flow Gossip carries state
4. Byzantine tolerance approaches differ (oracle vs BFT)

## Decision

We adopt a **Layered Coordination Model** where ELEX consensus runs as a domain-specific layer on top of claude-flow's hive-mind infrastructure.

### 1. Topology Mapping

```
Claude-Flow Topology: hierarchical-mesh (recommended)
├── Queen (claude-flow orchestrator)
│   └── ELEX Category Coordinators (14 raft-manager agents)
│       ├── Carrier Aggregation Coordinator
│       ├── MIMO Coordinator
│       ├── Load Balancing Coordinator
│       └── ... (11 more)
└── Gossip Mesh
    └── ELEX Feature Agents (593 gossip-coordinator agents)
        ├── CA Features (89 agents)
        ├── MIMO Features (40 agents)
        └── ... (464 more)
```

### 2. Consensus Strategy Selection

| Decision Type | ELEX Protocol | Claude-Flow Strategy | Rationale |
|--------------|---------------|---------------------|-----------|
| Feature Activation | Raft | `raft` | Strong consistency required |
| Q-Table Sync | Gossip | `gossip` | Eventual consistency acceptable |
| Safe Zone Enforcement | Raft | `quorum` | Critical safety decisions |
| KPI Routing | Gossip | `crdt` | Automatic merge resolution |
| Byzantine Detection | Oracle | `byzantine` | Fault tolerance |
| Cross-Category | Raft | `quorum` | Multi-coordinator consensus |

### 3. Hive-Mind Configuration

```typescript
// claude-flow.config.json
{
  "swarm": {
    "topology": "hierarchical-mesh",
    "maxAgents": 607,  // 14 coordinators + 593 features
    "consensus": {
      "default": "gossip",
      "overrides": {
        "feature-activation": "raft",
        "safe-zone": "quorum",
        "kpi-routing": "crdt"
      }
    },
    "elex": {
      "raftCluster": {
        "size": 14,
        "electionTimeout": [150, 300],  // ms range
        "heartbeatInterval": 50,         // ms
        "logCompaction": 10000           // entries
      },
      "gossipConfig": {
        "interval": 1000,    // ms
        "fanout": 3,
        "failureThreshold": 8  // phi-accrual
      }
    }
  }
}
```

### 4. Coordinator Bridge

```typescript
// elex-coordinator-bridge.ts
import { RaftManager } from '@claude-flow/swarm';
import { ElexCategoryCoordinator } from './elex-coordinator';

export class ElexRaftBridge {
  private raftManager: RaftManager;
  private elexCoordinator: ElexCategoryCoordinator;

  async handleFeatureActivation(request: FeatureActivationRequest): Promise<void> {
    // Step 1: ELEX validates safe zones
    const safeZoneCheck = await this.elexCoordinator.validateSafeZone(request);
    if (!safeZoneCheck.valid) {
      throw new SafeZoneViolationError(safeZoneCheck.reason);
    }

    // Step 2: Claude-flow Raft commits decision
    await this.raftManager.propose({
      type: 'feature-activation',
      payload: request,
      category: this.elexCoordinator.category
    });

    // Step 3: Notify via hooks
    await this.notifyHooks('feature-activated', request);
  }

  async syncQTable(agentId: string, qTable: QTable): Promise<void> {
    // Use claude-flow gossip for Q-table distribution
    await this.raftManager.gossip({
      type: 'q-table-sync',
      agentId,
      delta: qTable.getDelta(),  // Only changed values
      timestamp: Date.now()
    });
  }
}
```

### 5. CLI Commands for Coordination

```bash
# Initialize ELEX swarm with aligned topology
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical-mesh \
  --config elex-swarm.json

# Start hive-mind with ELEX consensus overrides
npx @claude-flow/cli@latest hive-mind start \
  --strategy adaptive \
  --elex-raft-cluster 14

# Check consensus status
npx @claude-flow/cli@latest hive-mind status
# Output:
# Topology: hierarchical-mesh
# Total Agents: 607
# Raft Cluster: 14 coordinators (leader: CA-Coordinator)
# Gossip Mesh: 593 feature agents
# Consensus Health: 98.5%

# Propose feature activation via Raft
npx @claude-flow/cli@latest hive-mind propose \
  --type feature-activation \
  --category "carrier_aggregation" \
  --feature "IFLB" \
  --parameters '{"lbTpNonQualFraction": 0.15}'

# Force gossip propagation
npx @claude-flow/cli@latest hive-mind gossip \
  --type q-table-sync \
  --category "mimo"
```

### 6. Hooks for Coordination Events

```bash
# Pre-activation hook (Raft proposal)
npx @claude-flow/cli@latest hooks pre-command \
  --command "feature-activate" \
  --validate-quorum true

# Post-activation hook (Gossip propagation)
npx @claude-flow/cli@latest hooks post-command \
  --command "feature-activate" \
  --trigger-gossip true

# Consensus monitoring hook
npx @claude-flow/cli@latest hooks worker dispatch \
  --trigger audit \
  --context "consensus-health"
```

### 7. Byzantine Fault Tolerance

```typescript
// Byzantine detection integration
interface ByzantineDetector {
  // ELEX oracle-based detection
  elexOracleValidate(proposerId: string, proposal: any): Promise<boolean>;

  // Claude-flow BFT validation
  bftValidate(proposal: any, signatures: string[]): Promise<boolean>;
}

// Combined validation for critical decisions
async function validateCriticalDecision(
  proposal: FeatureActivationProposal
): Promise<ValidationResult> {
  const [oracleResult, bftResult] = await Promise.all([
    byzantineDetector.elexOracleValidate(proposal.proposer, proposal),
    byzantineDetector.bftValidate(proposal, proposal.signatures)
  ]);

  return {
    valid: oracleResult && bftResult,
    confidence: (oracleResult ? 0.5 : 0) + (bftResult ? 0.5 : 0)
  };
}
```

## Consequences

### Positive
- **Unified Coordination:** Single hive-mind manages both ELEX and claude-flow agents
- **Protocol Flexibility:** Different consensus for different decision types
- **Fault Tolerance:** Combined oracle + BFT provides robust Byzantine detection
- **Scalability:** Gossip mesh scales to 593+ agents with O(log N) convergence
- **Monitoring:** Unified status and health checking

### Negative
- **Complexity:** Two coordination systems increase operational complexity
- **Latency:** Bridge layer adds coordination overhead (~10-20ms)
- **State Sync:** Raft and Gossip state must be kept consistent
- **Debugging:** Coordination issues span two systems

### Risks
- **Split-Brain:** Network partitions may cause inconsistency between Raft and Gossip
- **Leader Bottleneck:** ELEX Raft leaders may become coordination hotspots
- **Gossip Storms:** Large Q-table updates may overwhelm gossip bandwidth
- **Version Drift:** Protocol changes in either system may break alignment

### Mitigations
- **Partition Detection:** Heartbeat monitoring with automatic fallback
- **Load Balancing:** Distribute Raft leadership across categories
- **Delta Gossip:** Only propagate Q-table changes, not full tables
- **Version Contracts:** Explicit protocol version compatibility matrix

## Claude-Flow Integration

### Swarm Initialization
```bash
# Full ELEX swarm initialization
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical-mesh \
  --max-agents 607 \
  --consensus-strategy adaptive \
  --raft-enabled true \
  --gossip-enabled true \
  --elex-mode true
```

### Coordination Monitoring
```bash
# Real-time coordination status
npx @claude-flow/cli@latest hooks statusline --elex

# Output: [ELEX] R:14/14 G:593/593 | Q:OK | L:CA-001 | H:98.5%
```

### Worker Integration
```bash
# Daemon with coordination workers
npx @claude-flow/cli@latest daemon start --profile elex-coordination

# Workers enabled:
# - audit (consensus health)
# - optimize (coordination performance)
# - consolidate (state consistency)
```

## References
- ADR-002: Consensus Protocol Selection
- ADR-102: ELEX Native Coordination Protocol (Raft + Gossip)
- Claude-Flow ADR-003: Single Coordination Engine
- Claude-Flow Hive-Mind Documentation

---

**Author:** SPARC Architecture Agent
**Last Updated:** 2026-01-10
