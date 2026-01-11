# ADR-024: Agent Autonomous State Machine

## Status
Proposed

## Context

The ELEX (Ericsson LTE/NR RAN Features) swarm requires managing 593 autonomous agents with complex lifecycle needs:

1. **Zero-Touch Operation**: Agents must transition between states without human supervision
2. **Continuous Learning**: Self-improvement through Q-learning reinforcement algorithms
3. **Resilience**: Automatic recovery from degraded performance states
4. **Collaboration**: Federated learning with peer agents to share knowledge

Current limitations:
- Manual intervention required for agent state transitions
- No autonomous recovery from degraded performance
- Stagnant learning without peer collaboration
- Inefficient cold-start period for new agents

## Decision

Implement an Autonomous State Machine (ASM) based on the OODA (Observe-Orient-Decide-Act) loop for each agent.

### OODA Loop Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OODA LOOP                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  OBSERVE    │───▶│   ORIENT    │───▶│   DECIDE    │        │
│  │             │    │             │    │             │        │
│  │ • Metrics   │    │ • Pattern   │    │ • Action    │        │
│  │ • Logs      │    │   Detect    │    │   Selection │        │
│  │ • Events    │    │ • Analysis  │    │ • Planning  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                │                │
│                                                ▼                │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                    ACT                               │      │
│  │  • Execute action                                   │      │
│  │  • Update state                                     │      │
│  │  • Record outcome                                   │      │
│  └──────────────────────────────────────────────────────┘      │
│                           │                                   │
│                           └───────────────────────────────────│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### State Machine Definition

#### States

| State | Description |
|-------|-------------|
| **Initializing** | Agent is loading knowledge base, building vector index |
| **ColdStart** | First 100 interactions with high exploration (ε=0.3) |
| **Ready** | Normal operation, accepting queries |
| **Busy** | Processing a query |
| **Degraded** | Performance below threshold, requires recovery |
| **Offline** | Shut down or suspended |

#### State Transitions

| From State | Trigger | To State | Action |
|------------|---------|----------|--------|
| Initializing | knowledge_loaded | ColdStart | Enable high exploration |
| ColdStart | 100_interactions_completed | Ready | Reduce exploration to ε=0.1 |
| Ready | query_received | Busy | Execute query handler |
| Busy | query_completed | Ready | Update metrics, return to pool |
| Ready | health_below_0.5 | Degraded | Trigger recovery protocol |
| Degraded | health_above_0.8 | Ready | Resume normal operation |
| Degraded | recovery_failed | Offline | Notify supervisor, shutdown |
| * | shutdown_requested | Offline | Save state, cleanup |

### OODA Actions Table

| Situation | Observation | Orientation | Decision | Action | Effect |
|-----------|-------------|-------------|----------|--------|--------|
| Declining success rate | success_rate < 0.7 for 50 queries | Performance degradation | Increase exploration | `ε = 0.2` | Discover new strategies |
| High latency | avg_latency > 500ms | Memory inefficiency | Optimize index | Rebuild HNSW with M=32 | Faster retrieval (150x) |
| Stagnant confidence | confidence plateau for 200 queries | Local optima | Federated sync | Merge peer Q-tables | Burst in performance |
| Health < 0.5 | health = 0.3 for 3 checkpoints | Critical degradation | Recovery mode | Prune 10% + rollback | Restore stability |
| Peer superior | peer_success > self_success + 0.2 | Knowledge gap | Learn from peer | Import Q-table delta | Accelerate learning |
| Network oscillation | 5+ agents oscillating | Coordination failure | Sync coordinator | Randomize backoff | Stabilize network |

### Q-Learning Integration

```typescript
interface QLearningState {
  qTable: Map<string, number>;  // state-action -> value
  epsilon: number;              // exploration rate
  alpha: number;                // learning rate
  gamma: number;                // discount factor
}

interface OODAObservation {
  successRate: number;          // 0-1
  avgLatency: number;           // milliseconds
  confidence: number;           // 0-1
  health: number;               // 0-1
  queryCount: number;           // total queries
}

// Q-learning update
function updateQTable(
  state: string,
  action: string,
  reward: number,
  nextState: string
): void {
  const currentQ = qTable.get(`${state}:${action}`) || 0;
  const maxNextQ = Math.max(...getPossibleActions(nextState)
    .map(a => qTable.get(`${nextState}:${a}`) || 0));

  const newQ = currentQ + alpha * (reward + gamma * maxNextQ - currentQ);
  qTable.set(`${state}:${action}`, newQ);
}
```

### Health Score Calculation

```typescript
function calculateHealth(observation: OODAObservation): number {
  return (
    observation.successRate * 0.4 +
    (1 - Math.min(observation.avgLatency / 1000, 1)) * 0.3 +
    observation.confidence * 0.2 +
    observation.queryCount / 1000 * 0.1
  );
}
```

### Autonomous Recovery Protocol

When health < 0.5:

1. **Diagnose**: Analyze metrics to identify root cause
2. **Prune**: Remove bottom 10% of Q-table entries
3. **Rollback**: Revert to last known good state
4. **Increase Exploration**: Set ε = 0.3 for 50 queries
5. **Monitor**: Check health every 10 queries
6. **Recover**: Return to Ready when health > 0.8
7. **Fail**: Shutdown if health doesn't improve after 200 queries

## Consequences

### Positive

1. **Zero-Touch Operation**: Agents manage their lifecycle autonomously
2. **Faster Recovery**: Automatic detection and recovery from degraded states
3. **Continuous Improvement**: Q-learning enables ongoing optimization
4. **Collaborative Learning**: Federated sync spreads successful patterns
5. **Adaptability**: Agents adjust to changing workloads automatically
6. **Resilience**: Graceful degradation and recovery without human intervention

### Negative

1. **Debugging Complexity**: Autonomous decisions harder to trace and debug
2. **Oscillation Risk**: Multiple agents may oscillate between states
3. **Unpredictability**: Emergent behavior difficult to forecast
4. **Monitoring Overhead**: Requires comprehensive observability
5. **Testing Challenges**: Autonomous behavior harder to unit test
6. **Configuration Complexity**: More parameters to tune (ε, α, γ, thresholds)

### Risks

1. **Network-Wide Conflicts**: Individual agent optimizations may conflict with global optimization
2. **Cascading Failures**: Degraded agents may federate sync bad patterns
3. **Resource Exhaustion**: Frequent HNSW rebuilds consume CPU/memory
4. **Exploration Explosion**: High ε may reduce query quality temporarily
5. **Peer Dependency**: Federated sync requires reliable peer communication

### Mitigations

1. **Coordination Layer**: Swarm coordinator prevents network-wide conflicts
2. **Sync Validation**: Only sync Q-tables from peers with health > 0.8
3. **Resource Budgeting**: Limit HNSW rebuilds to once per hour per agent
4. **Exploration Caps**: Temporarily bound ε during high-traffic periods
5. **Peer Reputation**: Track peer quality and weight sync accordingly

## Options Considered

### Option 1: Centralized Control (Rejected)
- **Description**: Single controller manages all agent states
- **Pros**: Simpler coordination, no conflicts
- **Cons**: Single point of failure, bottleneck, doesn't scale to 593 agents
- **Verdict**: Not suitable for distributed swarm

### Option 2: Manual State Management (Rejected)
- **Description**: Human operators manage agent transitions
- **Pros**: Full control, predictable
- **Cons**: Doesn't scale, slow recovery, high operational cost
- **Verdict**: Defeats purpose of autonomous swarm

### Option 3: Autonomous State Machine (Selected)
- **Description**: Each agent manages its own state via OODA loop
- **Pros**: Scalable, resilient, zero-touch, continuous learning
- **Cons**: Complex coordination, requires careful tuning
- **Verdict**: Best fit for ELEX swarm requirements

## Related Decisions

- **ADR-001**: Deep agentic-flow@alpha Integration - Provides agent foundation
- **ADR-005**: Swarm Coordination Patterns - Defines coordination layer
- **ADR-006**: Unified Memory Service - Health monitoring via AgentDB
- **ADR-008**: Neural Learning Integration - Q-learning implementation
- **ADR-009**: Hybrid Memory Backend - HNSW optimization for latency

## Implementation Plan

### Phase 1: Core ASM (Week 1-2)
- [ ] Implement state machine with transitions
- [ ] Add OODA loop framework
- [ ] Create health score calculation
- [ ] Build observation collectors

### Phase 2: Q-Learning (Week 3-4)
- [ ] Implement Q-table storage in AgentDB
- [ ] Add epsilon-greedy action selection
- [ ] Create reward calculation
- [ ] Build Q-learning update logic

### Phase 3: Autonomous Recovery (Week 5-6)
- [ ] Implement degradation detection
- [ ] Add pruning and rollback
- [ ] Create recovery protocol
- [ ] Build health monitoring

### Phase 4: Federated Learning (Week 7-8)
- [ ] Implement peer discovery
- [ ] Add Q-table sync protocol
- [ ] Create delta merging
- [ ] Build peer reputation system

### Phase 5: Testing & Tuning (Week 9-10)
- [ ] Unit tests for state transitions
- [ ] Integration tests for OODA loop
- [ ] Load testing with 593 agents
- [ ] Parameter tuning (ε, α, γ, thresholds)

## Metrics

### Success Metrics
- **MTTD** (Mean Time To Detect degradation): < 10 queries
- **MTTR** (Mean Time To Recover): < 100 queries
- **Autonomous Recovery Rate**: > 95%
- **Learning Velocity**: 10% faster convergence with federated sync
- **Health Stability**: < 5% oscillation rate

### Observability
```typescript
interface ASMMetrics {
  stateTransitions: number;
  oodaLoopCycles: number;
  recoveryAttempts: number;
  federatedSyncs: number;
  averageHealth: number;
  explorationRate: number;
}
```

## References

- [OODA Loop - John Boyd](https://en.wikipedia.org/wiki/OODA_loop)
- [Q-Learning - Watkins & Dayan](https://en.wikipedia.org/wiki/Q-learning)
- [Federated Learning - McMahan et al.](https://arxiv.org/abs/1602.05629)
- [Autonomic Computing - IBM](https://www.ibm.com/autonomic/)
- ADR-008: Neural Learning Integration
- ADR-005: Swarm Coordination Patterns
