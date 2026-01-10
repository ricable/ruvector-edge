# ADR-009: Federated Learning for Peer-to-Peer Knowledge Sharing

## Status
Accepted

## Context
The 593 ELEX agents learn independently from their local interactions. Without knowledge sharing:
- Each agent must learn from scratch
- Deployment-specific insights remain siloed
- Convergence to optimal policies is slow
- Network-wide patterns are invisible to individual agents

Requirements for knowledge sharing:
- **No central server:** Must work in P2P architecture
- **Privacy preserving:** Raw interaction data stays local
- **Bandwidth efficient:** Cannot transmit full Q-tables frequently
- **Conflict resolution:** Must handle divergent learning gracefully
- **Edge compatible:** Must run in browser WASM

## Decision
We adopt **federated learning with weighted Q-table merging**:

### Merge Protocol
Agents synchronize every:
- 60 seconds (time-based trigger), OR
- 10 interactions (event-based trigger)

### Merge Algorithm
```
merged_q = (local_q * local_visits + peer_q * peer_visits) / (local_visits + peer_visits)
```

### Merge Conditions
Only merge if:
- State-action pair exists in both tables
- Difference exceeds significance threshold
- Both agents have sufficient visits (confidence)

### Confidence Calculation
```
confidence = 1 - 1 / (visits + 1)
```
- 0 visits: 0% confidence
- 10 visits: 91% confidence
- 100 visits: 99% confidence

### Sync Protocol
1. Agent announces latest Q-table version
2. Peers with newer versions identified
3. Delta compressed and transmitted
4. Weighted merge applied locally
5. Version incremented

## Consequences

### Positive
- **No central coordinator:** Pure P2P knowledge sharing
- **Privacy preserving:** Only aggregated Q-values shared, not raw interactions
- **Bandwidth efficient:** Delta compression reduces transmission size (LZ4: 4-32x)
- **Visit-weighted:** More experienced agents have greater influence
- **Significance filtering:** Avoids propagating noise
- **Continuous improvement:** Network-wide learning accelerates individual agents

### Negative
- **Convergence time:** May take many sync cycles for consensus
- **Stale knowledge:** 60-second window means some lag
- **Conflict accumulation:** Divergent policies may persist if rarely exercised
- **Version explosion:** Frequent updates create version tracking overhead

### Risks
- **Poisoning attacks:** Malicious agent could inject bad Q-values
- **Herding:** All agents may converge to suboptimal policy
- **Feature isolation:** Cross-feature learning not captured in per-agent Q-tables
- **Sync storms:** Many agents syncing simultaneously may overwhelm network

## Alternatives Considered

### Centralized Aggregation Server
- **Pros:** Single source of truth, controlled merge logic
- **Cons:** Violates edge-first principle, single point of failure, infrastructure cost

### No Knowledge Sharing
- **Pros:** Simpler, no sync overhead, maximum privacy
- **Cons:** Slow convergence, missed network-wide insights, duplicated learning effort

### Model Averaging (FedAvg)
- **Pros:** Standard federated learning approach
- **Cons:** Designed for neural networks, Q-tables are not gradient-based

### Gossip-Only Propagation
- **Pros:** Epidemic spread of knowledge
- **Cons:** No merge logic, conflicting updates, eventual consistency issues

### Blockchain-Based Consensus
- **Pros:** Immutable learning history, verifiable updates
- **Cons:** Massive overhead, impractical for real-time learning

## References
- ELEX PRD Section: Federated Learning (Intelligence Layer)
- ELEX PRD Section: Federated Merge Algorithm
- ELEX PRD Section: Memory & Vector Architecture (Layer 3: Q-Table)
- ELEX PRD Section: Core Principles (Swarm Intelligence)
- McMahan et al., "Communication-Efficient Learning of Deep Networks from Decentralized Data" (FedAvg)
