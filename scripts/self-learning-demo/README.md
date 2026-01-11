# Advanced Multi-Agent Self-Learning Demo

This demo showcases an advanced multi-agent self-learning system with **25 randomly selected Ericsson RAN feature documents**, dedicated agents answering specific questions, and continuous self-learning with AgentDB memory.

## 🎯 Overview

The Self-Learning Swarm Demo implements the architecture specified in [self-learning-swarm-PRD.md](../../docs/self-learning-swarm-PRD.md):

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **AgentDB Bridge** | Memory persistence & retrieval | `agentdb-bridge.ts` |
| **Self-Learning Agent** | Q-Learning + Reasoning pipeline | `self-learning-agent.ts` |
| **Document Selector** | Random document selection | `document-selector.ts` |
| **Swarm Manager** | Agent coordination & federation | `swarm-manager.ts` |
| **Interactive CLI** | User interface | `interactive-cli.ts` |
| **Battle Arena** | Competitive evaluation | `battle-arena.ts` |

## 🚀 Quick Start

```bash
# Run the interactive demo
bun run scripts/self-learning-demo/interactive-cli.ts

# Run automated demo (non-interactive)
bun run scripts/self-learning-demo/interactive-cli.ts --auto

# Run battle test arena
bun run scripts/self-learning-demo/battle-arena.ts --rounds=3
```

## 📋 Features

### 1. Random Document Selection
- Selects 25 documents from 1,153 Ericsson RAN feature docs
- Ensures domain diversity (MIMO, Carrier Aggregation, Mobility, etc.)
- Generates 3 specific questions per document (75 total)

### 2. Dedicated Agents
- Each document gets a specialized agent
- Agents have domain expertise and feature knowledge
- Q-Learning optimizes response strategies over time

### 3. Self-Learning
- **Q-Learning**: Model-free RL for action selection
- **4-Step Reasoning**: RETRIEVE → JUDGE → DISTILL → CONSOLIDATE
- **State Machine**: EXPLORING → LEARNING → CONFIDENT → TEACHING
- **Trajectory Recording**: Learns from interaction history

### 4. AgentDB Memory
- Persistent Q-tables across sessions
- Shared knowledge through federated sync
- Trajectory storage for Decision Transformer training

### 5. Federated Learning
- Agents in same domain share knowledge
- Visit-weighted Q-table merging
- Automatic periodic synchronization

## 🖥️ Interactive CLI Commands

| Option | Description |
|--------|-------------|
| **1. Query Agent** | Ask any question to the swarm |
| **2. View Agents** | List all active agents by domain |
| **3. Run Questions** | Process generated Q&A set |
| **4. View Statistics** | Swarm learning metrics |
| **5. Federated Sync** | Trigger knowledge sharing |
| **6. Benchmark** | Performance test |
| **7. Exit** | Shutdown with state persistence |

## ⚔️ Battle Arena

Competitive evaluation of 4 agent configurations:

| Configuration | Components |
|--------------|------------|
| **Q-Learning Only** | Pure RL with epsilon-greedy |
| **Decision Transformer** | Trajectory-based prediction |
| **Hybrid (Q+DT)** | Combined approaches |
| **Full Stack** | All learning components |

```bash
# Run battle with custom parameters
bun run scripts/self-learning-demo/battle-arena.ts --rounds=5 --queries=100 --json
```

## 📊 Metrics & Statistics

### Agent States
- 🔍 **EXPLORING**: < 10 interactions
- 📚 **LEARNING**: 10-50 interactions
- ✓ **CONFIDENT**: 50-100 interactions
- 🎓 **TEACHING**: > 100 interactions

### Performance Targets
| Metric | Target |
|--------|--------|
| Response Latency | < 100ms |
| Success Rate | > 70% |
| Learning Progress | Continuous improvement |
| Federated Sync | < 5s for 25 agents |

## 🗂️ File Structure

```
scripts/self-learning-demo/
├── README.md                  # This file
├── agentdb-bridge.ts         # AgentDB memory operations
├── self-learning-agent.ts    # Q-Learning + Reasoning agent
├── document-selector.ts      # Random document selection
├── swarm-manager.ts          # Agent swarm coordination
├── interactive-cli.ts        # Main interactive demo
└── battle-arena.ts           # Competitive evaluation
```

## 🔧 Configuration

### AgentDB Namespaces
| Namespace | Content |
|-----------|---------|
| `elex-knowledge` | Feature metadata, documents |
| `elex-intelligence` | Q-tables, trajectories, patterns |
| `elex-optimization` | Metrics, benchmarks, results |
| `elex-coordination` | Federated sync, peer status |

### Q-Learning Parameters
```typescript
LEARNING_RATE = 0.1
DISCOUNT_FACTOR = 0.95
EPSILON_START = 0.9
EPSILON_MIN = 0.1
EPSILON_DECAY = 0.995
```

## 📚 Related Documentation

- [Self-Learning Swarm PRD](../../docs/self-learning-swarm-PRD.md)
- [PRD.md](../../docs/PRD.md)
- [RAN Domain Guide](../../docs/ran-domain/README.md)
- [250 Questions](../../docs/ran-domain/250-questions.md)

## 🧪 Testing

```bash
# Run unit tests
bun test tests/unit

# Run integration tests
bun test tests/integration

# Run battle arena tests
bun test tests/battle-arena/ran-agent-battle-arena.ts
```

## 📈 Example Output

```
╔════════════════════════════════════════════════════════════╗
  ADVANCED MULTI-AGENT SELF-LEARNING DEMO
  ═══════════════════════════════════════════════════════════
╝

Initializing swarm infrastructure...

✓ Swarm manager initialized
✓ Selected 25 documents
✓ Generated 75 questions

Domain Distribution:
MIMO & Antenna           ██████████ 6
Carrier Aggregation      █████████░ 5
Radio Resource Mgmt      ████████░░ 4
...

╔════════════════════════════════════════════╗
║        Self-Learning Swarm Demo            ║
╠════════════════════════════════════════════╣
  1. Query Agent (ask the swarm)
  2. View Agents (list active agents)
  3. Run Questions (process generated Q&A)
  4. View Statistics (swarm metrics)
  5. Federated Sync (share knowledge)
  6. Benchmark (performance test)
  7. Exit
╚════════════════════════════════════════════╝
```

## 🎓 Learning Progression

As agents process more queries:

1. **Initial State (EXPLORING)**
   - High epsilon (90% random exploration)
   - Building Q-table entries
   - Low confidence scores

2. **Learning Phase (LEARNING)**
   - Epsilon decays (exploring less)
   - Q-values converging
   - Pattern recognition improving

3. **Confident Phase (CONFIDENT)**
   - Low epsilon (mostly exploitation)
   - High confidence predictions
   - Consistent response quality

4. **Teaching Phase (TEACHING)**
   - Stable Q-values
   - Knowledge ready for federation
   - Can help train newer agents

---

*Part of the ELEX Edge AI Agent Swarm project*
