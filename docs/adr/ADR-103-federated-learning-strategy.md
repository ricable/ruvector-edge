# ADR-103: Federated Learning for Distributed Intelligence

## Status
Accepted

## Context
The 593 feature agents learn independently through Q-learning, each developing specialized knowledge about their respective RAN features. However, isolated learning has limitations:

1. **Knowledge Silos:** Agents cannot benefit from each other's experiences
2. **Slow Convergence:** Each agent must learn from scratch
3. **Inconsistent Behavior:** Similar features may develop divergent strategies
4. **Cold Start Problem:** New deployments have no prior knowledge

Traditional centralized learning approaches (sending all data to a central server) are unsuitable because:
- Edge devices have limited connectivity
- Raw training data is sensitive (network configurations, performance metrics)
- Central server becomes a single point of failure
- Latency requirements preclude round-trip to central model

The system needs a way to share learned knowledge across agents without centralizing data or computation.

## Decision
We adopt **Federated Learning with Q-table Averaging** where agents periodically merge their learned Q-values:

### Synchronization Protocol
1. **Local Learning Phase (60 seconds):**
   - Each agent updates its Q-table from local experience
   - Q(s,a) <- Q(s,a) + alpha * [R + gamma * max(Q(s',a')) - Q(s,a)]
   - Experience tuples stored in trajectory buffer

2. **Federated Merge Phase (every 60 seconds):**
   - Agents within same category exchange Q-table updates
   - Weighted averaging based on experience count
   - Q_merged(s,a) = SUM(w_i * Q_i(s,a)) / SUM(w_i)
   - Weights: w_i = count of (s,a) visits by agent i

3. **Cross-Category Merge (every 5 minutes):**
   - Category coordinators exchange aggregate Q-tables
   - Enables knowledge transfer between related features
   - E.g., Carrier Aggregation learnings inform MIMO agents

### Merge Algorithm
```python
def federated_merge(q_tables: List[QTable], visit_counts: List[Dict]) -> QTable:
    merged = QTable()
    for state, action in all_state_actions(q_tables):
        weights = [counts.get((state, action), 0) for counts in visit_counts]
        if sum(weights) > 0:
            merged[state, action] = sum(
                w * q[state, action] for w, q in zip(weights, q_tables)
            ) / sum(weights)
        else:
            merged[state, action] = mean([q[state, action] for q in q_tables])
    return merged
```

### Differential Privacy
- Noise addition: Gaussian noise with sigma = 0.1 * max_q_value
- Gradient clipping: Max norm 1.0 before averaging
- Privacy budget: epsilon = 1.0 per merge cycle

### Staleness Handling
- Q-values older than 24 hours receive 50% weight reduction
- Values older than 7 days are marked stale and excluded
- Fresh local values prioritized over stale federated values

## Alternatives Considered

### Centralized Model Training
- **Pros:** Optimal model, consistent behavior, easier debugging
- **Cons:** Single point of failure, connectivity requirements, data privacy
- **Rejected:** Violates edge-first architecture and privacy requirements

### No Knowledge Sharing (Pure Local Learning)
- **Pros:** Simple, no coordination overhead, maximum privacy
- **Cons:** Slow convergence, knowledge silos, cold start problem
- **Rejected:** Wastes learning opportunities, poor new deployment experience

### Model Distillation (Central Teacher)
- **Pros:** Smaller student models, consistent behavior
- **Cons:** Requires central teacher model, periodic retraining
- **Rejected:** Central dependency incompatible with edge-first

### Gossip-Only Learning (No Structured Merge)
- **Pros:** Fully decentralized, no coordination
- **Cons:** Slow convergence, no quality control, drift accumulation
- **Rejected:** Uncontrolled drift may degrade performance

### Blockchain-Based Learning Registry
- **Pros:** Immutable learning history, verifiable updates
- **Cons:** High overhead, storage requirements, latency
- **Rejected:** Overhead incompatible with 60-second merge cycles

## Consequences

### Positive
- **Collective Intelligence:** Agents benefit from swarm-wide experience
- **No Single Point of Failure:** Any agent can operate independently
- **Privacy Preserving:** Raw data never leaves the agent
- **Fast Convergence:** New agents bootstrap from federated knowledge
- **Resilient:** Network partitions don't prevent local learning
- **Scalable:** Merge complexity O(agents per category), not O(total agents)

### Negative
- **Merge Overhead:** 60-second sync cycles consume bandwidth and compute
- **Convergence Variance:** Different deployments may converge to different optima
- **Staleness Risk:** Federated values may lag behind rapid environment changes
- **Weight Imbalance:** High-activity agents dominate merged values

### Risks
- **Byzantine Agents:** Malicious agents could poison federated values
- **Catastrophic Forgetting:** Aggressive merging may overwrite valid local learning
- **Herding Behavior:** All agents converge to same (possibly suboptimal) strategy
- **Network Partitions:** Long partitions cause significant value drift

### Mitigations
- **Byzantine Detection:** Statistical anomaly detection on Q-value updates
- **EWC++ Integration:** Elastic weight consolidation prevents forgetting (see ADR-104)
- **Diversity Bonus:** Reward exploration to prevent premature convergence
- **Partition Recovery:** Gradual merge with conflict detection after reconnection

## References
- ADR-101: Neural Agent Architecture
- ADR-104: RuVector Memory Integration
- McMahan, H.B., et al. (2017). Communication-Efficient Learning of Deep Networks from Decentralized Data
- Kairouz, P., et al. (2021). Advances and Open Problems in Federated Learning
- Abadi, M., et al. (2016). Deep Learning with Differential Privacy
- Elastic Weight Consolidation: Kirkpatrick, J., et al. (2017)
