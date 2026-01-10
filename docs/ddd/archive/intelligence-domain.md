# Intelligence Bounded Context

## Purpose

The Intelligence Context enables self-learning through reinforcement learning (Q-learning), trajectory recording, and federated knowledge sharing. It continuously improves agent behavior based on feedback, stores learned patterns in vector memory (HNSW), and enables predictive routing.

---

## Domain Model

```
+------------------------------------------------------------------+
|                   INTELLIGENCE BOUNDED CONTEXT                    |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+                                      |
|  |        QTable          |  <-- Aggregate Root                  |
|  |      (Aggregate)       |                                      |
|  +------------------------+                                      |
|  | - tableId: QTableId    |                                      |
|  | - entries: QEntry[]    |                                      |
|  | - alpha: number        |  (learning rate)                     |
|  | - gamma: number        |  (discount factor)                   |
|  | - epsilon: number      |  (exploration rate)                  |
|  +------------------------+                                      |
|           |                                                      |
|           | contains                                             |
|           v                                                      |
|  +------------------------+                                      |
|  |        QEntry          |                                      |
|  |        (Entity)        |                                      |
|  +------------------------+                                      |
|  | - state: State         |                                      |
|  | - action: Action       |                                      |
|  | - qValue: number       |                                      |
|  | - visits: number       |                                      |
|  | - lastUpdated: Date    |                                      |
|  +------------------------+                                      |
|                                                                  |
|  +------------------------+     +------------------------+       |
|  |   TrajectoryBuffer     |     |   FederatedMerger      |       |
|  |      (Aggregate)       |     |      (Aggregate)       |       |
|  +------------------------+     +------------------------+       |
|  | - bufferId: BufferId   |     | - mergerId: MergerId   |       |
|  | - trajectories: Traj[] |     | - localTables: QTable[]|       |
|  | - maxSize: number      |     | - mergeStrategy: enum  |       |
|  | - replayPriority: enum |     | - lastMerge: Date      |       |
|  +------------------------+     +------------------------+       |
|           |                              |                       |
|           v                              v                       |
|  +------------------------+     +------------------------+       |
|  |      Trajectory        |     |    MergedQTable        |       |
|  |       (Entity)         |     |      (Entity)          |       |
|  +------------------------+     +------------------------+       |
|  | - trajectoryId: TrajId |     | - contributions: Map   |       |
|  | - steps: Step[]        |     | - conflictResolutions  |       |
|  | - totalReward: number  |     | - consensusLevel       |       |
|  | - success: boolean     |     +------------------------+       |
|  +------------------------+                                      |
|                                                                  |
|  +-------------+  +-------------+  +-------------+               |
|  |    State    |  |   Action    |  |   Reward    |               |
|  | (Value Obj) |  | (Value Obj) |  | (Value Obj) |               |
|  +-------------+  +-------------+  +-------------+               |
|  | - features  |  | - actionId  |  | - value     |               |
|  | - context   |  | - params    |  | - breakdown |               |
|  | - embedding |  | - target    |  | - timestamp |               |
|  +-------------+  +-------------+  +-------------+               |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Aggregates

### QTable (Aggregate Root)

The Q-Table stores learned state-action values for reinforcement learning.

```typescript
class QTable {
  private readonly tableId: QTableId;
  private entries: Map<StateActionKey, QEntry>;
  private alpha: number;   // Learning rate (0.1 default)
  private gamma: number;   // Discount factor (0.99 default)
  private epsilon: number; // Exploration rate (decays from 1.0 to 0.01)

  // Factory
  static create(config: QTableConfig): QTable;
  static fromSnapshot(snapshot: QTableSnapshot): QTable;

  // Q-Learning Update
  // Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
  update(
    state: State,
    action: Action,
    reward: Reward,
    nextState: State
  ): void {
    const currentQ = this.getQValue(state, action);
    const maxNextQ = this.getMaxQValue(nextState);
    const tdTarget = reward.value + this.gamma * maxNextQ;
    const tdError = tdTarget - currentQ;
    const newQ = currentQ + this.alpha * tdError;

    this.setQValue(state, action, newQ);
    this.raise(new QTableUpdated(this.tableId, state, action, newQ, tdError));
  }

  // Action Selection (epsilon-greedy)
  selectAction(state: State, availableActions: Action[]): Action {
    if (Math.random() < this.epsilon) {
      // Exploration: random action
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }
    // Exploitation: best known action
    return this.getBestAction(state, availableActions);
  }

  // Queries
  getQValue(state: State, action: Action): number;
  getMaxQValue(state: State): number;
  getBestAction(state: State, actions: Action[]): Action;
  getVisitCount(state: State, action: Action): number;

  // Exploration decay
  decayEpsilon(decayRate: number): void {
    this.epsilon = Math.max(0.01, this.epsilon * decayRate);
  }

  // Serialization for federated sharing
  toSnapshot(): QTableSnapshot;
  getEntriesModifiedSince(timestamp: Date): QEntry[];

  // Domain Events
  raise(event: QTableUpdated | QTableMerged | EpsilonDecayed): void;
}
```

### TrajectoryBuffer (Aggregate Root)

Stores experience trajectories for replay and pattern learning.

```typescript
class TrajectoryBuffer {
  private readonly bufferId: BufferId;
  private trajectories: Trajectory[];
  private maxSize: number;
  private replayPriority: ReplayPriority;

  // Factory
  static create(maxSize: number, priority: ReplayPriority): TrajectoryBuffer;

  // Commands
  record(trajectory: Trajectory): void {
    if (this.trajectories.length >= this.maxSize) {
      this.evictLowestPriority();
    }
    this.trajectories.push(trajectory);
    this.updatePriorities();
    this.raise(new TrajectoryRecorded(trajectory));
  }

  // Replay
  sampleBatch(batchSize: number): Trajectory[] {
    switch (this.replayPriority) {
      case 'uniform':
        return this.uniformSample(batchSize);
      case 'prioritized':
        return this.prioritizedSample(batchSize);
      case 'reward_weighted':
        return this.rewardWeightedSample(batchSize);
    }
  }

  // Pattern extraction
  extractSuccessfulPatterns(): Pattern[] {
    return this.trajectories
      .filter(t => t.success && t.totalReward > 0.8)
      .map(this.trajectoryToPattern);
  }

  // Queries
  getSuccessRate(): number;
  getAverageReward(): number;
  getTrajectoryById(id: TrajectoryId): Trajectory | undefined;
}

type ReplayPriority = 'uniform' | 'prioritized' | 'reward_weighted';
```

### FederatedMerger (Aggregate Root)

Combines Q-tables from multiple agents using federated learning.

```typescript
class FederatedMerger {
  private readonly mergerId: MergerId;
  private localTables: Map<AgentId, QTableSnapshot>;
  private mergeStrategy: MergeStrategy;
  private lastMerge: Date;
  private consensusThreshold: number;

  // Factory
  static create(strategy: MergeStrategy): FederatedMerger;

  // Receive updates from agents
  receiveUpdate(agentId: AgentId, snapshot: QTableSnapshot): void {
    this.localTables.set(agentId, snapshot);
    if (this.shouldTriggerMerge()) {
      this.merge();
    }
  }

  // Merge algorithm
  merge(): MergedQTable {
    const allEntries = this.collectAllEntries();
    const mergedEntries = new Map<StateActionKey, MergedQEntry>();

    for (const [key, entries] of allEntries) {
      const merged = this.mergeEntries(key, entries);
      mergedEntries.set(key, merged);
    }

    const merged = new MergedQTable(mergedEntries, this.computeConsensus());
    this.raise(new QTablesMerged(this.mergerId, merged));
    return merged;
  }

  // Merge strategies
  private mergeEntries(key: StateActionKey, entries: QEntry[]): MergedQEntry {
    switch (this.mergeStrategy) {
      case 'weighted_average':
        // Weight by visit count
        const totalVisits = entries.reduce((sum, e) => sum + e.visits, 0);
        const weightedQ = entries.reduce(
          (sum, e) => sum + (e.qValue * e.visits / totalVisits), 0
        );
        return { qValue: weightedQ, visits: totalVisits };

      case 'max_optimistic':
        // Take the maximum Q-value (optimistic)
        return entries.reduce((best, e) =>
          e.qValue > best.qValue ? e : best
        );

      case 'median_robust':
        // Use median for robustness to outliers
        const sorted = entries.map(e => e.qValue).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return { qValue: median, visits: entries.reduce((s, e) => s + e.visits, 0) };

      case 'byzantine_tolerant':
        // Exclude outliers (Byzantine fault tolerance)
        return this.byzantineMerge(entries);
    }
  }

  private byzantineMerge(entries: QEntry[]): MergedQEntry {
    // Sort by Q-value and exclude top/bottom 1/3 (f < n/3 tolerance)
    const sorted = entries.slice().sort((a, b) => a.qValue - b.qValue);
    const n = sorted.length;
    const f = Math.floor(n / 3);
    const trusted = sorted.slice(f, n - f);

    const avgQ = trusted.reduce((s, e) => s + e.qValue, 0) / trusted.length;
    const totalVisits = trusted.reduce((s, e) => s + e.visits, 0);
    return { qValue: avgQ, visits: totalVisits };
  }
}

type MergeStrategy =
  | 'weighted_average'
  | 'max_optimistic'
  | 'median_robust'
  | 'byzantine_tolerant';
```

---

## Entities

### Trajectory

A sequence of state-action-reward transitions from a single episode.

```typescript
class Trajectory {
  readonly trajectoryId: TrajectoryId;
  readonly agentId: AgentId;
  readonly steps: TrajectoryStep[];
  readonly startTime: Date;
  readonly endTime: Date;
  readonly totalReward: number;
  readonly success: boolean;
  readonly context: TrajectoryContext;

  // Calculated properties
  get length(): number { return this.steps.length; }
  get averageReward(): number { return this.totalReward / this.length; }
  get duration(): number { return this.endTime.getTime() - this.startTime.getTime(); }

  // Analysis
  getDecisiveSteps(): TrajectoryStep[]; // Steps with high reward impact
  getExplorationRatio(): number; // Fraction of exploratory actions
  extractPattern(): Pattern; // Convert to storable pattern
}

interface TrajectoryStep {
  stepIndex: number;
  state: State;
  action: Action;
  reward: Reward;
  nextState: State;
  wasExploration: boolean;
  timestamp: Date;
}
```

### QEntry

A single state-action-value entry in the Q-table.

```typescript
class QEntry {
  readonly state: State;
  readonly action: Action;
  qValue: number;
  visits: number;
  lastUpdated: Date;
  tdErrors: number[]; // Recent TD errors for prioritized replay

  // Priority score for replay sampling
  get priority(): number {
    const recency = Date.now() - this.lastUpdated.getTime();
    const avgTdError = this.tdErrors.reduce((s, e) => s + Math.abs(e), 0) / this.tdErrors.length;
    return avgTdError * Math.exp(-recency / 86400000); // Decay over 24h
  }

  update(newQ: number, tdError: number): void {
    this.qValue = newQ;
    this.visits++;
    this.lastUpdated = new Date();
    this.tdErrors.push(tdError);
    if (this.tdErrors.length > 100) this.tdErrors.shift();
  }
}
```

---

## Value Objects

### State

Represents the current state for Q-learning decisions.

```typescript
class State {
  readonly features: StateFeatures;
  readonly context: StateContext;
  readonly embedding: Float32Array;

  constructor(features: StateFeatures, context: StateContext) {
    this.features = features;
    this.context = context;
    this.embedding = this.computeEmbedding();
  }

  // State comparison
  equals(other: State): boolean {
    return this.getKey() === other.getKey();
  }

  getKey(): string {
    return JSON.stringify(this.features);
  }

  // Similarity for generalization
  similarity(other: State): number {
    return cosineSimilarity(this.embedding, other.embedding);
  }

  private computeEmbedding(): Float32Array {
    // Encode state features into dense vector
    return embeddings.encode(this.features);
  }
}

interface StateFeatures {
  queryType: string;
  queryComplexity: 'simple' | 'moderate' | 'complex';
  featureDomain: string;
  hasParameters: boolean;
  hasCounters: boolean;
  hasKPIs: boolean;
  userExpertise: 'beginner' | 'intermediate' | 'expert';
}

interface StateContext {
  previousActions: Action[];
  sessionLength: number;
  timeOfDay: number;
  recentRewards: number[];
}
```

### Action

Represents an action the agent can take.

```typescript
class Action {
  readonly actionId: ActionId;
  readonly type: ActionType;
  readonly parameters: ActionParameters;
  readonly targetAgent?: AgentId;

  constructor(type: ActionType, params: ActionParameters) {
    this.actionId = ActionId.generate();
    this.type = type;
    this.parameters = params;
  }

  equals(other: Action): boolean {
    return this.actionId.equals(other.actionId);
  }

  getKey(): string {
    return `${this.type}:${JSON.stringify(this.parameters)}`;
  }
}

type ActionType =
  | 'route_to_agent'
  | 'answer_directly'
  | 'request_clarification'
  | 'delegate_to_swarm'
  | 'escalate_to_human'
  | 'optimize_parameter'
  | 'search_knowledge_base';

interface ActionParameters {
  targetAgentId?: string;
  searchQuery?: string;
  parameterName?: string;
  confidenceThreshold?: number;
}
```

### Reward

Numerical feedback signal with breakdown.

```typescript
class Reward {
  readonly value: number; // -1 to +1
  readonly breakdown: RewardBreakdown;
  readonly timestamp: Date;

  constructor(components: RewardComponents) {
    this.breakdown = this.calculateBreakdown(components);
    this.value = this.aggregateReward(this.breakdown);
    this.timestamp = new Date();
  }

  private calculateBreakdown(components: RewardComponents): RewardBreakdown {
    return {
      accuracy: components.wasCorrect ? 0.4 : -0.4,
      latency: this.latencyReward(components.responseTimeMs),
      userSatisfaction: components.userRating ? (components.userRating - 3) / 2 : 0,
      resourceEfficiency: this.efficiencyReward(components.resourceUsage),
    };
  }

  private latencyReward(ms: number): number {
    // Fast responses get positive reward, slow get negative
    if (ms < 100) return 0.2;
    if (ms < 500) return 0.1;
    if (ms < 1000) return 0;
    if (ms < 5000) return -0.1;
    return -0.2;
  }

  private aggregateReward(breakdown: RewardBreakdown): number {
    const weights = { accuracy: 0.5, latency: 0.2, userSatisfaction: 0.2, resourceEfficiency: 0.1 };
    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
      total += breakdown[key] * weight;
    }
    return Math.max(-1, Math.min(1, total));
  }
}

interface RewardBreakdown {
  accuracy: number;
  latency: number;
  userSatisfaction: number;
  resourceEfficiency: number;
}
```

---

## Domain Events

```typescript
// Q-Learning Events
interface QTableUpdated extends DomainEvent {
  type: 'QTableUpdated';
  tableId: string;
  state: string;
  action: string;
  previousQ: number;
  newQ: number;
  tdError: number;
}

interface QTablesMerged extends DomainEvent {
  type: 'QTablesMerged';
  mergerId: string;
  contributingAgents: string[];
  entriesMerged: number;
  consensusLevel: number;
  strategy: string;
}

interface EpsilonDecayed extends DomainEvent {
  type: 'EpsilonDecayed';
  tableId: string;
  previousEpsilon: number;
  newEpsilon: number;
}

// Trajectory Events
interface TrajectoryRecorded extends DomainEvent {
  type: 'TrajectoryRecorded';
  trajectoryId: string;
  agentId: string;
  steps: number;
  totalReward: number;
  success: boolean;
}

interface TrajectoryReplayed extends DomainEvent {
  type: 'TrajectoryReplayed';
  trajectoryId: string;
  replayReason: 'prioritized' | 'periodic' | 'manual';
}

// Pattern Events
interface PatternLearned extends DomainEvent {
  type: 'PatternLearned';
  patternId: string;
  sourceTrajectories: string[];
  patternType: string;
  confidence: number;
}

interface PatternApplied extends DomainEvent {
  type: 'PatternApplied';
  patternId: string;
  agentId: string;
  state: string;
  predictedAction: string;
}
```

---

## Domain Services

### QLearningService

Orchestrates Q-learning updates across the system.

```typescript
class QLearningService {
  constructor(
    private readonly qTableRepo: QTableRepository,
    private readonly trajectoryBuffer: TrajectoryBuffer,
    private readonly eventBus: EventBus
  ) {}

  // Online learning from single step
  async learnFromStep(
    agentId: AgentId,
    state: State,
    action: Action,
    reward: Reward,
    nextState: State
  ): Promise<void> {
    const qTable = await this.qTableRepo.getForAgent(agentId);
    qTable.update(state, action, reward, nextState);
    await this.qTableRepo.save(qTable);
  }

  // Batch learning from trajectory replay
  async replayTrajectories(batchSize: number): Promise<ReplayResult> {
    const batch = this.trajectoryBuffer.sampleBatch(batchSize);
    let totalUpdates = 0;
    let totalTdError = 0;

    for (const trajectory of batch) {
      for (const step of trajectory.steps) {
        const qTable = await this.qTableRepo.getForAgent(trajectory.agentId);
        qTable.update(step.state, step.action, step.reward, step.nextState);
        totalUpdates++;
        totalTdError += Math.abs(step.reward.value);
      }
    }

    return { trajectoriesReplayed: batch.length, totalUpdates, averageTdError: totalTdError / totalUpdates };
  }

  // Decay exploration across all agents
  async decayExploration(decayRate: number = 0.995): Promise<void> {
    const allTables = await this.qTableRepo.findAll();
    for (const qTable of allTables) {
      qTable.decayEpsilon(decayRate);
      await this.qTableRepo.save(qTable);
    }
  }
}
```

### RewardCalculator

Computes rewards based on multiple signals.

```typescript
class RewardCalculator {
  constructor(private readonly config: RewardConfig) {}

  calculate(outcome: ActionOutcome): Reward {
    const components: RewardComponents = {
      wasCorrect: outcome.wasCorrect,
      responseTimeMs: outcome.responseTimeMs,
      userRating: outcome.userRating,
      resourceUsage: outcome.resourceUsage,
    };

    return new Reward(components);
  }

  // Specialized reward for optimization actions
  calculateOptimizationReward(
    kpiBefore: number,
    kpiAfter: number,
    kpiTarget: number,
    kpiDirection: 'higher_better' | 'lower_better'
  ): Reward {
    let improvement: number;
    if (kpiDirection === 'higher_better') {
      improvement = (kpiAfter - kpiBefore) / Math.abs(kpiTarget - kpiBefore);
    } else {
      improvement = (kpiBefore - kpiAfter) / Math.abs(kpiBefore - kpiTarget);
    }

    // Clip and scale
    const value = Math.max(-1, Math.min(1, improvement));
    return new Reward({ wasCorrect: value > 0, responseTimeMs: 0, resourceUsage: 0 });
  }
}
```

### PatternRecognitionService

Extracts and stores patterns from successful trajectories.

```typescript
class PatternRecognitionService {
  constructor(
    private readonly trajectoryBuffer: TrajectoryBuffer,
    private readonly hnswIndex: HNSWIndex,
    private readonly eventBus: EventBus
  ) {}

  // Extract patterns from successful trajectories
  async extractPatterns(): Promise<Pattern[]> {
    const patterns = this.trajectoryBuffer.extractSuccessfulPatterns();

    for (const pattern of patterns) {
      await this.hnswIndex.insert(pattern.embedding, pattern);
      this.eventBus.publish(new PatternLearned(pattern));
    }

    return patterns;
  }

  // Find applicable patterns for current state
  async findApplicablePatterns(state: State, k: number = 5): Promise<Pattern[]> {
    const results = await this.hnswIndex.search(state.embedding, k);
    return results
      .filter(r => r.similarity > 0.8)
      .map(r => r.item as Pattern);
  }

  // Predict action based on learned patterns
  async predictAction(state: State): Promise<Action | null> {
    const patterns = await this.findApplicablePatterns(state, 1);
    if (patterns.length === 0) return null;

    const bestPattern = patterns[0];
    this.eventBus.publish(new PatternApplied(bestPattern.id, state, bestPattern.action));
    return bestPattern.action;
  }
}
```

---

## RuVector HNSW Integration

The Intelligence Context integrates with RuVector's HNSW index for fast pattern search.

```typescript
interface HNSWIntegration {
  // Index configuration
  config: {
    dimensions: 384,        // Embedding dimensions
    maxElements: 1_000_000, // Max stored patterns
    efConstruction: 200,    // Build-time accuracy
    M: 16,                  // Connections per node
    efSearch: 100,          // Query-time accuracy
  };

  // Performance targets
  performance: {
    searchSpeed: '150x-12,500x faster than brute force',
    insertSpeed: '< 1ms per vector',
    memoryOverhead: '~1.5x raw vector size',
  };

  // Integration points
  integration: {
    patternStorage: 'Store learned patterns with embeddings',
    patternSearch: 'Find similar patterns in < 1ms',
    stateHashing: 'Efficient state lookup via embedding similarity',
  };
}
```

---

## Q-Learning Hyperparameters

| Parameter | Symbol | Default | Description |
|-----------|--------|---------|-------------|
| Learning Rate | alpha | 0.1 | How much to update Q-values |
| Discount Factor | gamma | 0.99 | Future reward importance |
| Initial Epsilon | epsilon_0 | 1.0 | Initial exploration rate |
| Min Epsilon | epsilon_min | 0.01 | Minimum exploration |
| Epsilon Decay | decay | 0.995 | Per-episode decay rate |
| Replay Buffer | N | 100,000 | Max trajectories stored |
| Batch Size | B | 32 | Trajectories per replay |
| Target Update | tau | 0.001 | Soft target network update |

---

## Invariants

1. **Q-Value Bounds**: Q-values should converge within reasonable bounds
2. **Epsilon Bounds**: Epsilon must be in [epsilon_min, 1.0]
3. **Trajectory Completeness**: Trajectories must have matching state-action-reward-nextState
4. **Buffer Capacity**: Buffer cannot exceed maxSize
5. **Merge Participation**: Federated merge requires minimum agent participation
6. **Reward Normalization**: Rewards must be in [-1, +1]
