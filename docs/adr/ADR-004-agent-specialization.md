# ADR-004: One Agent Per Feature Specialization

## Status
Accepted

## Context
The Ericsson RAN feature catalog contains 593 distinct features across LTE and NR technologies. Each feature has:
- Unique parameters (5,230 total across 452 features)
- Specific counters (5,416 total across 344 features)
- Related KPIs (736 total across 156 features)
- Domain-specific procedures and troubleshooting steps

Architectural options for handling this complexity:
1. **Single monolithic agent:** One agent knows everything
2. **Category-based agents:** ~14 agents, one per category
3. **Feature-specialized agents:** 593 agents, one per FAJ code
4. **Dynamic agent pool:** Spawn agents on-demand based on query

## Decision
We adopt the **one agent per feature** model, creating 593 specialized agents where:

### Agent Distribution
- **LTE Features:** 307 agents (51.8%)
- **NR/5G Features:** 284 agents (47.9%)
- **Cross-RAT:** 2 agents (0.2%)

### Category Breakdown
| Category | Agents | Percentage |
|----------|--------|------------|
| NR/5G | 130 | 21.9% |
| Radio Resource Management | 76 | 12.8% |
| Mobility & Handover | 48 | 8.1% |
| Carrier Aggregation | 47 | 7.9% |
| MIMO & Antenna | 42 | 7.1% |
| Coverage & Capacity | 37 | 6.2% |
| Transport | 25 | 4.2% |
| Voice & IMS | 16 | 2.7% |
| Interference | 14 | 2.4% |
| QoS & Scheduling | 12 | 2.0% |
| Timing & Sync | 10 | 1.7% |
| Security | 8 | 1.3% |
| Energy Saving | 7 | 1.2% |
| UE Handling | 7 | 1.2% |
| Other | 114 | 19.2% |

### Agent Responsibilities
Each agent exclusively handles:
- All parameters for its feature
- All counters associated with its feature
- All KPIs influenced by its feature
- Feature-specific optimization recommendations
- Q-learning for its domain only

## Consequences

### Positive
- **Deep expertise:** Each agent becomes world-class expert on one feature
- **Focused learning:** Q-tables remain small and converge faster
- **Parallel optimization:** Multiple features can be optimized simultaneously
- **Clear accountability:** Each recommendation traces to specific agent
- **Modular updates:** Individual agents can be updated without system-wide changes
- **Resource isolation:** One agent's resource usage doesn't impact others

### Negative
- **Agent count:** 593 agents require significant coordination infrastructure
- **Cross-feature knowledge:** Inter-feature dependencies require agent consultation
- **Deployment size:** Total system size (~364KB x 593 = ~216MB) if all agents loaded
- **Cold start:** Each agent needs individual training before effectiveness

### Risks
- **Feature conflicts:** Multiple agents may recommend conflicting parameters
- **Knowledge silos:** Agents may miss cross-domain optimization opportunities
- **Coordination overhead:** Swarm communication increases with agent count
- **Uneven load:** Popular features (e.g., IFLB, MIMO) may overwhelm their agents

## Alternatives Considered

### Single Monolithic Agent
- **Pros:** Simple architecture, no coordination needed, single training target
- **Cons:** Cannot scale; 593 features too complex for one model; no parallelism

### Category-Based Agents (~14)
- **Pros:** Reduces agent count, logical grouping, simpler coordination
- **Cons:** Each agent still handles 40+ features; loses specialization benefit; larger Q-tables

### Dynamic Agent Pool
- **Pros:** Resource efficient (spawn on demand), flexible scaling
- **Cons:** Cold start for every query; no persistent learning; complex lifecycle management

### Hierarchical Agent Clusters
- **Pros:** Balance between specialization and coordination
- **Cons:** Adds management layer complexity; harder to reason about responsibilities

## References
- ELEX PRD Section: Core Innovation (593 specialized self-learning agents)
- ELEX PRD Section: Knowledge Layer (593 Features)
- ELEX PRD Section: Feature Catalog Summary
- ELEX PRD Section: Core Principles (One Agent, One Feature)
