# RAN AI Agent Configuration Index

This directory contains 50 specialized RAN AI agent configuration files following ADR-108 (Ericsson RAN Feature Ontology) and ADR-024 (Agent Autonomous State Machine) specifications.

## Agent Distribution

| Category | Count | Agent IDs | Description |
|----------|-------|-----------|-------------|
| **Carrier Aggregation** | 10 | agent-ca-001 to agent-ca-010 | Inter-band, intra-band, UL CA, 4CC, TDD CA, cross-carrier scheduling, scrambling, PCC change, CA load balancing |
| **Radio Resource Management** | 8 | agent-rrm-001 to agent-rrm-008 | Admission control, load balancing, packet scheduling, SPS, inter-frequency LB, congestion control, QoS scheduling, UL power control |
| **NR/5G** | 7 | agent-nr-001 to agent-nr-007 | NSA, SA, EN-DC, DSS, mmWave, NR CA, Massive MIMO |
| **Transport** | 6 | agent-tr-001 to agent-tr-006 | CPRI fronthaul, backhaul (S1/X2), F1 interface, Xn interface, Ethernet transport, SCTP |
| **MIMO & Antenna** | 5 | agent-mimo-001 to agent-mimo-005 | 2x2 MIMO, 4x4 MIMO, beamforming, antenna tilting, antenna port configuration |
| **Mobility** | 4 | agent-mob-001 to agent-mob-004 | Handover, ANR, mobility load balancing, RRC state management |
| **Energy Saving** | 3 | agent-eng-001 to agent-eng-003 | Cell sleep, MIMO sleep, micro sleep TX |
| **Coverage & Capacity** | 2 | agent-cc-001 to agent-cc-002 | Cell configuration, extended range |
| **Voice & IMS** | 2 | agent-vim-001 to agent-vim-002 | VoLTE, VoNR |
| **UE Handling** | 1 | agent-ue-001 | DRX configuration |
| **QoS** | 1 | agent-qos-001 | QoS differentiation |
| **Interference** | 1 | agent-int-001 | Interference rejection combining |

**Total: 50 agents**

## Configuration Structure

Each agent configuration file contains:

### Required Fields
- `agentId`: Unique agent identifier (format: agent-{category}-{number})
- `fajCode`: Ericsson FAJ feature code (format: FAJ XXX XXXX)
- `cxcCode`: Product CXC code
- `featureName`: Human-readable feature name
- `acronym`: Feature abbreviation
- `category`: One of 12 feature categories
- `subcategory`: Specific feature subcategory
- `accessTechnology`: LTE or NR

### Q-Learning Configuration
- `alpha`: Learning rate (0.1-0.2 based on category complexity)
- `gamma`: Discount factor (0.8-0.9)
- `epsilon`: Initial exploration rate (0.2-0.3)
- `epsilonDecay`: Exploration decay rate (0.994-0.995)
- `epsilonMin`: Minimum exploration rate (0.05)
- `learningRateStrategy`: Adaptive learning strategy
- `rewardDiscounting`: Temporal reward discounting

### State Machine Configuration
- `coldStartThreshold`: Interactions before Ready state (100)
- `healthWarningThreshold`: Health warning level (0.7)
- `healthCriticalThreshold`: Degraded state trigger (0.5)
- `recoveryThreshold`: Recovery completion level (0.8)
- `maxConsecutiveFailures`: Max failures before degradation (5)
- `observationWindowMs`: OODA observation window (5000ms)
- `degradedActions`: Recovery actions (prune, explore, sync)

### Agent Capabilities
- `capabilities`: Query types the agent can handle
  - ParameterConfiguration
  - Troubleshooting
  - Optimization
  - Activation
  - Deactivation
  - Comparison
  - GeneralInfo

### Feature Metadata
- `parameters`: Associated configuration parameters with MO classes
- `counters`: Performance counters for monitoring
- `kpis`: Key Performance Indicators with targets and thresholds
- `dependencies`: Required feature dependencies
- `conflicts`: Conflicting features
- `relatedFeatures`: Related feature FAJ codes
- `releases`: Ericsson release compatibility
- `moClasses`: Managed Object classes used
- `documents`: Relevant documentation

## Autonomous State Machine Integration

All agents implement the 6-state lifecycle from ADR-024:

1. **Initializing**: Loading knowledge base
2. **ColdStart**: First 100 interactions (ε=0.3)
3. **Ready**: Normal operation (ε=0.1)
4. **Busy**: Processing queries
5. **Degraded**: Health < 0.5, recovery mode
6. **Offline**: Shutdown state

## Usage

```typescript
import { EnhancedFeatureAgent } from './domains/knowledge/aggregates/enhanced-feature-agent';

// Load agent configuration
const config = require('./.claude/agents/ran-agents/agent-ca-001.json');

// Create agent instance
const agent = EnhancedFeatureAgent.createEnhanced(config);

// Initialize agent
await agent.initialize();

// Handle queries
const response = await agent.handleQueryEnhanced({
  id: 'query-001',
  type: QueryType.PARAMETER_CONFIGURATION,
  content: 'How do I configure inter-band CA?',
  complexity: ComplexityLevel.COMPLEX,
  timestamp: new Date()
});
```

## DDD Compliance

These configurations follow the Domain-Driven Design bounded context for Agent Lifecycle:

- **Aggregate Root**: FeatureAgent
- **Value Objects**: FAJCode, ConfidenceScore, FeatureCategory
- **Entities**: Capability, Knowledge
- **Domain Events**: AgentSpawned, QueryHandled, CapabilityAdded

## ADR Compliance

- **ADR-108**: Ericsson RAN Feature Ontology integration
- **ADR-024**: Agent Autonomous State Machine implementation
- **ADR-001**: Deep agentic-flow@alpha integration

## Metadata

- **Ontology Version**: ADR-108-v1.0
- **Created**: 2026-01-11
- **Author**: RANOps Swarm
- **Total Features Covered**: 50/593 (8.4%)

## Next Steps

To reach full coverage of 593 features:
- 443 additional agent configurations needed
- Prioritize high-impact features per category
- Add category coordinator agents (14 total)
- Total target: 657 agents (593 features + 14 coordinators + 50 specialists)

---

**Location**: `/Users/cedric/dev/2026/test-cfv3/.claude/agents/ran-agents/`
**Files**: 50 JSON configurations
**Size**: ~3KB per configuration
