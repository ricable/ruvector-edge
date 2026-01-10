# ADR-006: Q-Learning Engine for Self-Learning Agents

## Status
Accepted

## Context
Each of the 593 ELEX agents must learn and improve from operational experience. Requirements:
- **Online learning:** Agents must learn from each interaction without batch retraining
- **Edge deployment:** Learning algorithm must run efficiently in browser WASM
- **Federated sync:** Agents must share learned knowledge without central coordination
- **Interpretable:** Learned policies must be auditable and explainable
- **Safe exploration:** Cannot make dangerous recommendations while exploring

Learning algorithm candidates:
1. **Supervised learning:** Requires labeled training data
2. **Deep reinforcement learning (DQN, PPO):** Neural network policies
3. **Q-Learning:** Tabular state-action value learning
4. **Contextual bandits:** Single-step action selection
5. **Imitation learning:** Learn from expert demonstrations

## Decision
We adopt **Q-Learning with tabular Q-tables** for agent self-learning:

### Q-Learning Update Rule
```
Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
```

### Hyperparameters
- **Learning rate (alpha):** 0.1 (moderate learning speed)
- **Discount factor (gamma):** 0.95 (value future rewards highly)
- **Epsilon (exploration):** User-consent-based (opt-in exploration)

### State Space
- `query_type`: parameter | counter | kpi | procedure | troubleshoot | general
- `complexity`: simple | moderate | complex
- `context_hash`: hash of relevant context
- `confidence`: discretized confidence level

### Action Space
- `direct_answer`: Respond immediately from knowledge
- `context_answer`: Retrieve context then respond
- `consult_peer`: Query another agent for expertise
- `request_clarification`: Ask user for more information
- `escalate`: Defer to human expert

### Reward Signal
- `user_rating`: [-1, +1] from explicit feedback
- `resolution_success`: +0.5 for confirmed resolution
- `latency_penalty`: Negative reward for slow responses
- `consultation_cost`: Small penalty for peer consultation
- `novelty_bonus`: Reward for handling new query types

## Consequences

### Positive
- **Online learning:** Updates after every interaction, no batch required
- **Lightweight:** Q-tables are simple dictionaries, fit in browser memory
- **Interpretable:** Can inspect Q(s,a) values to understand policy
- **Federated friendly:** Q-tables merge via weighted averaging
- **No neural networks:** Eliminates deep learning infrastructure requirements
- **Convergence guarantee:** Proven to converge under standard conditions

### Negative
- **Discrete state space:** Must discretize continuous features (loses precision)
- **State explosion:** Large state spaces increase memory and slow convergence
- **No generalization:** New states start with zero knowledge (no transfer)
- **Exploration risk:** Random exploration may produce bad recommendations

### Risks
- **Cold start:** New agents have empty Q-tables, cannot make informed decisions
- **Sparse rewards:** User feedback may be infrequent, slowing learning
- **State aliasing:** Different situations mapped to same state may confuse learning
- **Adversarial feedback:** Malicious users could poison Q-tables with false rewards

## Alternatives Considered

### Deep Q-Networks (DQN)
- **Pros:** Handles continuous states, generalizes to unseen inputs
- **Cons:** Requires neural network inference, not WASM-friendly, needs GPU

### Policy Gradient (PPO, A2C)
- **Pros:** Handles continuous actions, state-of-the-art performance
- **Cons:** High sample complexity, requires millions of interactions, unstable training

### Contextual Bandits
- **Pros:** Simple, stateless, good for recommendation systems
- **Cons:** No sequential decision making, cannot model multi-step interactions

### Imitation Learning
- **Pros:** Learn from expert demonstrations, no exploration needed
- **Cons:** Requires labeled expert data, cannot exceed expert performance

### Model-Based RL
- **Pros:** Sample efficient, learns environment dynamics
- **Cons:** Complex to implement, model errors compound, computational overhead

## References
- ELEX PRD Section: Self-Learning Intelligence
- ELEX PRD Section: State-Action-Reward Framework
- ELEX PRD Section: Q-Table (Layer 3 Memory)
- ELEX PRD Section: 35 Critical Decisions (Exploration: User-consent-based)
- Watkins & Dayan, "Q-Learning", Machine Learning, 1992
