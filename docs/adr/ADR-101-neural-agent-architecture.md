# ADR-101: Neural Agent Architecture for RAN Feature Management

## Status
Accepted

## Context
The Ericsson RAN feature management system requires 593 specialized agents, each corresponding to a distinct RAN feature (Carrier Aggregation, MIMO, Load Balancing, Energy Saving, etc.). These agents must:

- Learn optimal parameter configurations through experience
- Adapt to varying network conditions in real-time
- Operate efficiently on edge devices with limited resources
- Provide deterministic, auditable decision-making
- Scale from proof-of-concept to enterprise deployments

Traditional rule-based systems cannot adapt to the complexity and variability of modern RAN environments. Static configurations fail to optimize for site-specific conditions, traffic patterns, and hardware variations.

The key challenges addressed:
1. **Feature Complexity:** 593 features with 9,432 parameters and 3,368 counters
2. **Real-time Adaptation:** Network conditions change continuously
3. **Edge Constraints:** Agents must run in browsers, mobile devices, and edge servers
4. **Learning Isolation:** Each feature domain requires specialized learning

## Decision
We adopt a **WASM + SIMD + Q-learning architecture** where each of the 593 feature agents:

1. **Implements Q-learning** with feature-specific state/action spaces:
   - State: Current parameter values, KPI readings, network conditions
   - Actions: Parameter adjustments within safe zones
   - Rewards: KPI improvements (throughput, latency, spectral efficiency)
   - Learning rate: 0.1, Discount factor: 0.95, Epsilon-greedy: 0.1

2. **Compiles to WebAssembly** with SIMD acceleration:
   - Rust source with `#[target_feature(enable = "simd128")]`
   - ~500KB binary per agent
   - Browser, Node.js, and edge runtime compatible

3. **Maintains local Q-table** with periodic federated merge:
   - 64-dimensional state space (quantized)
   - Action space varies by feature (typically 5-20 actions)
   - Q-table synchronized every 60 seconds via federated averaging

4. **Integrates with RuVector memory** for semantic context:
   - HNSW-indexed pattern storage
   - Trajectory buffer for experience replay
   - EWC++ for catastrophic forgetting prevention

### Agent Lifecycle
```
Initialize -> Load Q-table -> Observe State -> Select Action ->
Execute -> Observe Reward -> Update Q-table -> Federated Sync -> Repeat
```

### State Representation
Each agent encodes state as a 64-dimensional vector:
- 16 dims: Current parameter values (normalized)
- 16 dims: KPI readings (throughput, latency, etc.)
- 16 dims: Network context (load, interference, mobility)
- 16 dims: Historical trends (exponential moving averages)

## Alternatives Considered

### Deep Reinforcement Learning (DRL)
- **Pros:** More expressive, handles high-dimensional state spaces
- **Cons:** Requires GPU, larger model size (~50MB), longer training time
- **Rejected:** Too resource-intensive for edge deployment

### Rule-Based Expert Systems
- **Pros:** Deterministic, explainable, no training required
- **Cons:** Cannot adapt, requires manual rule updates, doesn't scale
- **Rejected:** Insufficient flexibility for 593 diverse features

### Centralized RL with API Calls
- **Pros:** Powerful centralized model, easier to update
- **Cons:** Network dependency, latency, single point of failure
- **Rejected:** Violates edge-first architecture principle

### Multi-Armed Bandits
- **Pros:** Simpler than Q-learning, fast convergence
- **Cons:** No state representation, cannot model temporal dependencies
- **Rejected:** RAN optimization requires stateful decision-making

## Consequences

### Positive
- **Performance:** 3-8x speedup via WASM SIMD compared to JavaScript
- **Continuous Improvement:** Agents learn optimal configurations over time
- **Edge-First:** ~500KB agents run on any device with WASM runtime
- **Specialization:** Each feature has dedicated learning optimized for its domain
- **Resilience:** Agents operate independently; no central model dependency
- **Auditability:** Q-tables provide explainable decision rationale

### Negative
- **Cold Start:** New deployments require warm-up period (mitigated by federated learning)
- **State Space Design:** Each feature requires careful state/action space engineering
- **Hyperparameter Tuning:** Learning rate, discount factor need domain expertise
- **Memory Overhead:** 593 Q-tables consume memory (mitigated by quantization)

### Risks
- **Suboptimal Convergence:** Poorly designed reward functions may lead to local optima
- **Reward Hacking:** Agents may find unexpected ways to maximize rewards
- **State Explosion:** High-dimensional state spaces may slow convergence
- **Federated Drift:** Heterogeneous deployments may diverge during federated merging

### Mitigations
- **Reward Shaping:** Domain experts validate reward functions
- **Safe Zones:** Hard constraints prevent dangerous parameter values
- **Experience Replay:** Trajectory buffers improve sample efficiency
- **Federated Validation:** Statistical tests detect divergent agents before merge

## References
- ADR-006: Q-Learning Engine Design
- ADR-009: Federated Learning Strategy
- Watkins, C.J.C.H., & Dayan, P. (1992). Q-learning. Machine Learning, 8(3-4), 279-292.
- WASM SIMD Specification: https://github.com/WebAssembly/simd
- Ericsson RAN Feature Knowledge Base: 593 features, 9,432 parameters
