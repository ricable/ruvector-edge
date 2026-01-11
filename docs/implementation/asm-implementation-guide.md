# Agent Autonomous State Machine - Implementation Guide

## Quick Reference

### State Transitions

```
┌──────────────┐     knowledge_loaded      ┌──────────────┐
│Initializing │──────────────────────────────▶│  ColdStart   │
└──────────────┘                            └──────────────┘
                                                │
                                                │ 100 interactions
                                                ▼
┌──────────────┐  query_completed  ┌──────────────┐
│   Offline    │◀──────────────────│    Busy      │
└──────────────┘   shutdown_requested └──────────────┘
                      ▲                    │
                      │                    │ query_completed
                      │                    ▼
                      │               ┌──────────────┐
                      │               │    Ready     │◀─────────────┐
                      └───────────────│              │              │
                         health > 0.8  └──────────────┘              │
                                      ▲              │              │
                                      │              │ health < 0.5 │
                                      │              ▼              │
                                      └─────────────│ Degraded     │───┐
                                                    └──────────────┘   │
                                                                      │ recovery failed
                                                                      ▼
                                                                   ┌──────────────┐
                                                                   │   Offline    │
                                                                   └──────────────┘
```

### OODA Loop Actions

| Trigger | Action | Parameters | Duration |
|---------|--------|------------|----------|
| `success_rate < 0.7` | increase_exploration | `ε = 0.2` | 50 queries |
| `latency > 500ms` | optimize_memory | `HNSW rebuild, M=32` | 1-5 min |
| `confidence plateau` | federated_sync | `merge peer Q-tables` | 10-30 sec |
| `health < 0.5` | recover | `prune 10% + rollback` | until health > 0.8 |
| `peer_success > self + 0.2` | learn_from_peer | `import Q-delta` | 5-10 sec |

## Implementation Checklist

### Core Components

- [ ] **State Machine Engine**
  - [ ] State transition logic
  - [ ] Event handling system
  - [ ] State persistence
  - [ ] Transition logging

- [ ] **OODA Loop Framework**
  - [ ] Observation collectors
  - [ ] Pattern detection
  - [ ] Decision engine
  - [ ] Action executor

- [ ] **Q-Learning Module**
  - [ ] Q-table storage (AgentDB)
  - [ ] Epsilon-greedy selection
  - [ ] Reward calculation
  - [ ] Q-value update

- [ ] **Health Monitor**
  - [ ] Metric collection
  - [ ] Health score calculation
  - [ ] Threshold checking
  - [ ] Alert generation

- [ ] **Recovery System**
  - [ ] Degradation detection
  - [ ] Pruning strategy
  - [ ] Rollback mechanism
  - [ ] Recovery validation

- [ ] **Federated Learning**
  - [ ] Peer discovery
  - [ ] Sync protocol
  - [ ] Delta merging
  - [ ] Reputation tracking

## Code Structure

```
src/agents/asm/
├── core/
│   ├── StateMachine.ts        # State transition engine
│   ├── OODALoop.ts            # OODA framework
│   ├── QLearning.ts           # Q-learning implementation
│   └── HealthMonitor.ts       # Health calculation
├── states/
│   ├── InitializingState.ts
│   ├── ColdStartState.ts
│   ├── ReadyState.ts
│   ├── BusyState.ts
│   ├── DegradedState.ts
│   └── OfflineState.ts
├── actions/
│   ├── IncreaseExploration.ts
│   ├── OptimizeMemory.ts
│   ├── FederatedSync.ts
│   └── Recovery.ts
├── recovery/
│   ├── PruningStrategy.ts
│   ├── RollbackManager.ts
│   └── RecoveryValidator.ts
├── federated/
│   ├── PeerDiscovery.ts
│   ├── SyncProtocol.ts
│   ├── DeltaMerger.ts
│   └── ReputationTracker.ts
└── types/
    ├── State.ts
    ├── Action.ts
    ├── Observation.ts
    └── Metrics.ts
```

## Configuration

```typescript
// src/agents/asm/config.ts
export const ASM_CONFIG = {
  // State thresholds
  COLD_START_QUERIES: 100,
  HEALTH_THRESHOLD_READY: 0.8,
  HEALTH_THRESHOLD_DEGRADED: 0.5,
  RECOVERY_MAX_QUERIES: 200,

  // Q-learning parameters
  EPSILON_COLD_START: 0.3,
  EPSILON_READY: 0.1,
  EPSILON_EXPLORATION: 0.2,
  ALPHA: 0.1,              // Learning rate
  GAMMA: 0.9,              // Discount factor

  // OODA triggers
  SUCCESS_RATE_THRESHOLD: 0.7,
  LATENCY_THRESHOLD_MS: 500,
  CONFIDENCE_PLATEAU_QUERIES: 200,
  HEALTH_CHECK_INTERVAL: 10,

  // Recovery parameters
  PRUNE_PERCENTAGE: 0.1,
  FEDERATED_SYNC_MIN_HEALTH: 0.8,
  PEER_SUPERIORITY_GAP: 0.2,

  // Resource limits
  HNSW_REBUILD_INTERVAL_MS: 3600000,  // 1 hour
  MAX_RECOVERY_ATTEMPTS: 3,
} as const;
```

## Testing Strategy

### Unit Tests

```typescript
describe('StateMachine', () => {
  it('should transition from Initializing to ColdStart on knowledge_loaded');
  it('should transition from ColdStart to Ready after 100 interactions');
  it('should transition from Ready to Degraded when health < 0.5');
  it('should transition from Degraded to Ready when health > 0.8');
});

describe('OODALoop', () => {
  it('should increase exploration when success rate declines');
  it('should optimize memory when latency is high');
  it('should trigger federated sync when confidence plateaus');
  it('should initiate recovery when health < 0.5');
});

describe('QLearning', () => {
  it('should update Q-table correctly');
  it('should select action with epsilon-greedy');
  it('should converge to optimal policy');
  it('should handle unknown states');
});
```

### Integration Tests

```typescript
describe('ASM Integration', () => {
  it('should complete full lifecycle: Initializing -> Ready -> Offline');
  it('should recover from degraded state');
  it('should federate sync with peers');
  it('should handle shutdown during any state');
});
```

## Monitoring & Observability

### Key Metrics

```typescript
interface ASMMetrics {
  // State metrics
  currentState: string;
  stateTransitions: number;
  timeInState: number;

  // OODA metrics
  oodaCycles: number;
  observationCount: number;
  actionCount: number;

  // Q-learning metrics
  explorationRate: number;
  averageReward: number;
  qTableSize: number;

  // Health metrics
  healthScore: number;
  successRate: number;
  avgLatency: number;
  confidence: number;

  // Recovery metrics
  recoveryAttempts: number;
  recoverySuccesses: number;
  pruneCount: number;
  rollbackCount: number;

  // Federated metrics
  peerSyncs: number;
  deltaMerges: number;
  peerReputation: number;
}
```

### Logging

```typescript
logger.info('State transition', {
  from: 'ColdStart',
  to: 'Ready',
  reason: '100 interactions completed',
  timestamp: Date.now(),
});

logger.warn('Health degradation detected', {
  health: 0.42,
  threshold: 0.5,
  cause: 'declining success rate',
  action: 'increase_exploration',
});

logger.info('Recovery completed', {
  duration: 45,
  queries: 67,
  finalHealth: 0.85,
  actions: ['prune', 'rollback', 'increase_exploration'],
});
```

## Deployment

### Phase 1: Canary (10 agents)
- Deploy to 10% of agents
- Monitor for 48 hours
- Collect metrics and adjust thresholds

### Phase 2: Progressive Rollout (50%)
- Deploy to 50% of agents
- Compare with control group
- Validate autonomous recovery

### Phase 3: Full Rollout (100%)
- Deploy to all 593 agents
- Enable federated learning
- Monitor network-wide effects

## Rollback Plan

If critical issues detected:
1. Disable autonomous transitions
2. Revert to manual state management
3. Preserve Q-tables for analysis
4. Root cause analysis
5. Fix and redeploy

## References

- [ADR-024: Agent Autonomous State Machine](./adr/ADR-024-autonomous-state-machine.md)
- [ADR-008: Neural Learning Integration](./adr/ADR-008-neural-learning.md)
- [ADR-005: Swarm Coordination Patterns](./adr/ADR-005-swarm-coordination.md)
