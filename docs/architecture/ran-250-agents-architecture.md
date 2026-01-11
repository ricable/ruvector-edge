# Architecture Design: 250 Specialized RAN AI Agents

**Document Version**: 1.0.0
**Date**: 2026-01-11
**Status**: Proposed
**Author**: System Architecture Designer

---

## Executive Summary

This document defines the comprehensive architecture for 250 specialized RAN AI agents, scaling from the existing 50 LTE agents to support both LTE and NR/5G features. The architecture follows Domain-Driven Design (DDD) principles, implements the Autonomous State Machine (ADR-024), and integrates with the RAN Battle Testing Framework (ADR-025).

### Key Design Principles

1. **One Agent Per Feature**: Each of the 593 Ericsson RAN features gets a specialized agent
2. **OODA Loop Integration**: Per ADR-024, all agents implement autonomous decision-making
3. **Q-Learning Intelligence**: Agents learn from experience via Q-tables and federated sync
4. **Memory-First Design**: AgentDB provides HNSW-indexed vector search (150x-12,500x faster)
5. **Battle-Tested Validation**: ADR-025 framework ensures agent competence

---

## Table of Contents

1. [Agent Structure](#1-agent-structure)
2. [Memory Integration](#2-memory-integration)
3. [Question Generation System](#3-question-generation-system)
4. [OODA Loop Integration](#4-ooda-loop-integration)
5. [ADR Compliance](#5-adr-compliance)
6. [Agent Class Hierarchy](#6-agent-class-hierarchy)
7. [Memory Schema](#7-memory-schema)
8. [Question Templates](#8-question-templates)
9. [API Contracts](#9-api-contracts-between-contexts)
10. [Deployment Architecture](#10-deployment-architecture)

---

## 1. Agent Structure

### 1.1 Aggregate Root: FeatureAgent

Following the Knowledge bounded context, each agent is an aggregate root managing feature knowledge.

```typescript
interface FeatureAgentAggregate {
  readonly id: AgentId;
  readonly fajCode: FAJCode;
  readonly category: FeatureCategory;
  readonly stateMachine: AutonomousStateMachine;
  readonly qTable: QTable;
  readonly knowledge: FeatureKnowledge;
  readonly capabilities: Capability[];
}
```

### 1.2 Agent Categories (250 Agents Total)

#### Category 1: LTE Feature Agents (50 Agents)
- Existing 50 LTE features from `LTE_50_FEATURES`
- One agent per FAJ code
- Domains: CA, RRM, Mobility, Energy, MIMO, etc.

#### Category 2: NR/5G Feature Agents (57 Agents)
- NR/5G features (FAJ 3XX XXXX)
- NSA/SA, EN-DC, DSS features
- NR carrier configuration

#### Category 3: Carrier Aggregation Agents (89 Agents)
- Inter-band CA (4G+4G, 5G+5G, 4G+5G)
- Intra-band CA
- UL/DL CA optimization

#### Category 4: Radio Resource Management Agents (64 Agents)
- Load balancing
- Admission control
- Scheduling optimization
- Congestion management

#### Category 5: Transport Agents (52 Agents)
- Fronthaul optimization
- Backhaul management
- X2/Xn/S1/NG interfaces
- Ethernet configurations

#### Category 6: MIMO & Antenna Agents (40 Agents)
- Massive MIMO
- Beamforming
- TM mode optimization
- Antenna configuration

#### Category 7: Mobility Agents (36 Agents)
- Handover optimization
- ANR (Automatic Neighbor Relations)
- RRC state transitions
- Mobility robustness

#### Category 8: Energy Saving Agents (29 Agents)
- Cell sleep modes
- Micro sleep TX
- Power control
- Energy optimization

#### Category 9: Coverage & Capacity Agents (28 Agents)
- Cell configuration
- Sector management
- Extended range
- Capacity optimization

#### Category 10: Specialized Coordination Agents (10+ Agents)
- Domain coordinators (one per category)
- Cross-feature optimizers
- Emergency response agents
- Learning sync coordinators

### 1.3 Agent Lifecycle

Per ADR-024, each agent implements the 6-state lifecycle:

```
Initializing → ColdStart (100 interactions) → Ready ↔ Busy
     ↓                                              ↓
   Offline ←──────── Degraded ←────────────────────┘
```

### 1.4 Agent Factory Pattern

```typescript
class RANAgentFactory {
  // Create all 250 agents
  static createAllAgents(config: AgentSystemConfig): Map<string, FeatureAgent> {
    const agents = new Map();

    // 50 LTE agents
    agents.setAll(LTEFeatureAgentsFactory.createAll());

    // 57 NR/5G agents
    agents.setAll(NRFeatureAgentsFactory.createAll());

    // Additional 143 specialized agents
    agents.setAll(SpecializedAgentsFactory.createAll());

    // 10 coordination agents
    agents.setAll(CoordinationAgentsFactory.createAll());

    return agents;
  }

  // Create agent by FAJ code
  static createByFAJ(fajCode: string): FeatureAgent {
    const feature = loadFeatureKnowledge(fajCode);
    return new FeatureAgent({
      id: generateAgentId(fajCode),
      fajCode: FAJCode.create(fajCode),
      category: inferCategory(feature),
      stateMachine: AutonomousStateMachine.create(agentId),
      qTable: QTable.create(agentId),
      knowledge: feature
    });
  }
}
```

---

## 2. Memory Integration

### 2.1 AgentDB Namespace Strategy

Per ADR-006 (Unified Memory Service) and ADR-009 (Hybrid Memory Backend):

```typescript
interface MemoryNamespaces {
  // Agent state and knowledge
  'ran-agents': {
    description: 'Feature agent profiles and capabilities',
    indexing: 'HNSW',
    dimensions: 1536,
    max_entries: 250
  };

  // Battle test questions
  'ran-questions': {
    description: '250 battle test questions per agent',
    indexing: 'HNSW',
    dimensions: 1536,
    max_entries: 62500  // 250 agents × 250 questions
  };

  // Learned patterns
  'ran-patterns': {
    description: 'Discovered optimization patterns',
    indexing: 'HNSW',
    dimensions: 768,
    max_entries: 10000
  };

  // Q-table snapshots
  'ran-qtables': {
    description: 'Q-table entries for federated learning',
    indexing: 'hash',
    max_entries: 2500000  // 250 agents × 10000 entries
  };

  // Battle test results
  'ran-results': {
    description: 'Historical battle test results',
    indexing: 'B-tree',
    max_entries: 100000
  };
}
```

### 2.2 Vector Embeddings for Feature Routing

```typescript
interface FeatureEmbedding {
  // Feature semantic embedding
  feature_embedding: number[];  // 1536-dim from feature description

  // Parameter embeddings
  parameter_embeddings: Map<ParameterId, number[]>;

  // Counter embeddings
  counter_embeddings: Map<CounterId, number[]>;

  // KPI embeddings
  kpi_embeddings: Map<KPIId, number[]>;
}

class SemanticRouter {
  // Route query to most relevant agent using HNSW
  async route(query: string, agentPool: FeatureAgent[]): Promise<RoutingResult[]> {
    const queryEmbedding = await embed(query);

    // HNSW search: O(log n) instead of O(n)
    const matches = await agentDB.search('ran-agents', {
      vector: queryEmbedding,
      limit: 5,
      filter: {
        state: ['Ready', 'ColdStart'],
        health: { $gte: 0.7 }
      }
    });

    return matches.map(match => ({
      agent: match.agent,
      relevance: match.score,
      confidence: match.agent.getConfidence()
    }));
  }
}
```

### 2.3 HNSW Indexing Configuration

```typescript
interface HNSWConfig {
  // Performance tuning for 150x-12,500x speedup
  M: number;              // 16-64 (connectivity parameter)
  efConstruction: number; // 200-800 (index quality)
  efSearch: number;       // 50-500 (search accuracy)

  // Recommended settings for 250 agents
  agents: { M: 32, efConstruction: 400, efSearch: 100 };
  questions: { M: 16, efConstruction: 200, efSearch: 50 };
  patterns: { M: 64, efConstruction: 800, efSearch: 200 };
}
```

---

## 3. Question Generation System

Per ADR-025, the 250 questions per agent are organized into three categories:

### 3.1 Category A: Knowledge Retrieval (Q1-125)

#### Subcategory A1: Feature Knowledge (Q1-40)
- Feature purpose and functionality
- Activation/deactivation procedures
- Dependencies and conflicts
- Release history

**Template:**
```typescript
interface KnowledgeQuestion {
  category: 'A';
  subcategory: 'feature_knowledge';
  question_number: 1-40;

  template: (feature: Feature) => string;
  expected_topics: string[];
  validation: (answer: string) => QuestionValidation;
}

// Example Q1
const Q1: KnowledgeQuestion = {
  category: 'A',
  subcategory: 'feature_knowledge',
  question_number: 1,

  template: (feature) =>
    `What is the primary purpose of ${feature.name} [${feature.acronym}]? ` +
    `Explain its key functionality and use cases in ${feature.accessTechnology} networks.`,

  expected_topics: ['purpose', 'functionality', 'use_cases', 'technology'],

  validation: (answer) => ({
    contains_keywords: checkKeywords(answer, ['purpose', 'function']),
    mentions_feature: answer.includes(feature.acronym),
    min_length: 50,
    max_length: 500
  })
};
```

#### Subcategory A2: Parameters (Q41-80)
- Parameter definitions
- Valid ranges and bounds
- Impact of parameter changes
- Parameter relationships

**Template:**
```typescript
// Example Q41
const Q41: KnowledgeQuestion = {
  category: 'A',
  subcategory: 'parameters',
  question_number: 41,

  template: (feature) =>
    `List the key parameters for ${feature.acronym}. For parameter ` +
    `${feature.parameters[0]?.name || 'lbTpNonQualFraction'}, explain: ` +
    `1) Valid range, 2) Default value, 3) Impact on network performance`,

  expected_topics: ['parameters', 'range', 'default', 'impact'],
};
```

#### Subcategory A3: Counters & KPIs (Q81-125)
- Counter definitions
- KPI formulas
- Performance thresholds
- Troubleshooting metrics

### 3.2 Category B: Decision Making (Q126-200)

#### Subcategory B1: Optimization Decisions (Q126-165)
- Parameter tuning recommendations
- KPI optimization strategies
- Trade-off analysis
- Risk assessment

**Template:**
```typescript
interface DecisionQuestion {
  category: 'B';
  subcategory: 'optimization';
  question_number: 126-165;

  scenario: OptimizationScenario;
  constraints: Constraint[];
  objective: Objective;
  validation: (answer: string) => DecisionValidation;
}

// Example Q126
const Q126: DecisionQuestion = {
  category: 'B',
  subcategory: 'optimization',
  question_number: 126,

  scenario: {
    context: 'High load scenario during peak hours',
    current_kpis: {
      throughput: 45,  // Mbps, below target
      latency: 28,     // ms, above target
      success_rate: 97.5  // %, below target
    },
    target_kpis: {
      throughput: 50,
      latency: 25,
      success_rate: 98.0
    }
  },

  constraints: [
    'Must maintain service continuity',
    'No feature activation (parameter changes only)',
    'Safe zone boundaries must be respected'
  ],

  objective: 'Recommend parameter changes to improve KPIs to target levels',

  validation: (answer) => ({
    proposes_parameters: extractParameters(answer).length > 0,
    respects_safe_zones: checkSafeZones(answer),
    estimates_impact: extractKPIImpact(answer),
    considers_risk: mentionsRisk(answer)
  })
};
```

#### Subcategory B2: KPI-Based Actions (Q166-200)
- KPI threshold analysis
- Anomaly response
- Performance recovery
- Capacity planning

### 3.3 Category C: Advanced Troubleshooting (Q201-350)

#### Subcategory C1: Multi-Parameter (Q201-275)
- Complex parameter interactions
- Cross-feature dependencies
- Root cause analysis
- Systematic debugging

**Template:**
```typescript
interface TroubleshootingQuestion {
  category: 'C';
  subcategory: 'multi_parameter';
  question_number: 201-275;

  symptoms: Symptom[];
  current_config: ParameterSnapshot;
  logs: LogEntry[];
  metrics: Metric[];

  expected_approach: TroubleshootingApproach;
  validation: (answer: string) => TroubleshootingValidation;
}

// Example Q201
const Q201: TroubleshootingQuestion = {
  category: 'C',
  subcategory: 'multi_parameter',
  question_number: 201,

  symptoms: [
    'Sudden drop in handover success rate from 98% to 92%',
    'Increased ping-pong handovers',
    'User complaints on cell edge'
  ],

  current_config: {
    'lbTpNonQualFraction': 30,
    'hoA3Offset': 2,
    'hoHysteresis': 2
  },

  logs: [
    '14:32:15 - HO_FAILURE: Target cell not available',
    '14:33:22 - HO_FAILURE: Timeout waiting for HO command'
  ],

  metrics: {
    'pmHoSuccessRate': { before: 98, after: 92, unit: '%' },
    'pmHoPingPongRate': { before: 5, after: 15, unit: '%' },
    'pmRrcSetupSuccessRate': { current: 99.2, unit: '%' }
  },

  expected_approach: 'systematic_root_cause_analysis',

  validation: (answer) => ({
    identifies_root_cause: checkRootCauseIdentification(answer),
    proposes_solutions: extractSolutions(answer).length >= 2,
    prioritizes_actions: checkPrioritization(answer),
    includes_rollback: mentionsRollback(answer),
    considers_impact: analyzesImpact(answer)
  })
};
```

#### Subcategory C2: Cross-Feature (Q276-350)
- Feature interactions
- Dependency conflicts
- System-wide optimization
- Emergency procedures

### 3.4 Question Storage in AgentDB

```typescript
interface QuestionStorage {
  // Store questions with HNSW indexing
  async storeQuestion(
    agentId: string,
    question: TestQuestion
  ): Promise<void> {
    const embedding = await embed(question.content);

    await agentDB.store('ran-questions', {
      key: `${agentId}:Q${question.number}`,
      value: {
        agent_id: agentId,
        question_number: question.number,
        category: question.category,
        content: question.content,
        metadata: question.metadata,
        embedding: embedding
      },
      namespace: 'ran-questions'
    });
  }

  // Find similar questions for an agent
  async findSimilarQuestions(
    agentId: string,
    query: string,
    limit: number = 10
  ): Promise<TestQuestion[]> {
    const embedding = await embed(query);

    const results = await agentDB.search('ran-questions', {
      vector: embedding,
      filter: { agent_id: agentId },
      limit: limit
    });

    return results.map(r => r.value);
  }
}
```

---

## 4. OODA Loop Integration

Per ADR-024, each agent implements the OODA loop for autonomous decision-making.

### 4.1 OODA Loop Implementation

```typescript
interface OODALoop {
  // OBSERVE: Gather current state information
  observe(): Promise<Observations>;

  // ORIENT: Analyze context and update orientation
  orient(observations: Observations): Promise<Orientation>;

  // DECIDE: Select action based on orientation
  decide(orientation: Orientation): Promise<Decision>;

  // ACT: Execute the decision
  act(decision: Decision): Promise<ActionResult>;
}

class AgentOODALoop implements OODALoop {
  constructor(
    private agent: FeatureAgent,
    private qTable: QTable,
    private stateMachine: AutonomousStateMachine
  ) {}

  async observe(): Promise<Observations> {
    return {
      current_state: this.stateMachine.getCurrentState(),
      health_score: this.stateMachine.getHealth(),
      query_metrics: this.agent.getQueryMetrics(),
      kpi_values: await this.agent.getCurrentKPIs(),
      peer_status: await this.getPeerStatus(),
      memory_usage: process.memoryUsage(),
      timestamp: new Date()
    };
  }

  async orient(observations: Observations): Promise<Orientation> {
    // Analyze observations to build situational awareness
    const situation = await this.analyzeSituation(observations);

    return {
      situation: situation.type,
      health_trend: this.calculateHealthTrend(observations),
      recent_successes: this.stateMachine.getRecentSuccesses(),
      recent_failures: this.stateMachine.getRecentFailures(),
      peer_performance: await this.compareWithPeers(observations),
      confidence_level: this.calculateConfidence(observations)
    };
  }

  async decide(orientation: Orientation): Promise<Decision> {
    // Create Q-learning state
    const state = this.createQLearningState(orientation);

    // Select action using Q-table (epsilon-greedy)
    const action = await this.qTable.selectAction(
      state,
      this.getAvailableActions(orientation)
    );

    return {
      action: action.type,
      confidence: action.q_value,
      reasoning: this.explainDecision(state, action, orientation),
      q_value: action.q_value,
      exploration_rate: this.qTable.epsilon
    };
  }

  async act(decision: Decision): Promise<ActionResult> {
    const startTime = Date.now();

    // Execute the action
    const result = await this.executeAction(decision.action);

    // Calculate reward
    const reward = await this.calculateReward(decision, result);

    // Update Q-table
    const state = this.getCurrentState();
    const nextState = await this.observe();

    await this.qTable.update(
      state,
      decision.action,
      reward,
      nextState
    );

    return {
      action_taken: decision.action,
      result: result,
      reward: reward,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }
}
```

### 4.2 OODA Loop Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Observe Phase | < 10ms | Data collection time |
| Orient Phase | < 20ms | Analysis computation |
| Decide Phase | < 5ms | Q-table lookup |
| Act Phase | < 50ms | Action execution |
| **Total OODA Cycle** | **< 100ms** | End-to-end latency |

### 4.3 State Encoding for Q-Learning

```typescript
interface QLearningState {
  // Discretized state for Q-table lookup
  query_type: 'parameter' | 'troubleshoot' | 'procedure' | 'general';
  complexity: 'low' | 'medium' | 'high';
  context_hash: string;  // 4-char hex from query content
  confidence: number;    // 0-10 (discretized health)

  // State key format
  key: string;  // "query_type:complexity:context_hash:confidence"
}

function encodeState(
  queryType: QueryType,
  complexity: ComplexityLevel,
  content: string,
  confidence: number
): QLearningState {
  return {
    query_type: mapQueryType(queryType),
    complexity: mapComplexity(complexity),
    context_hash: generateContextHash(content),
    confidence: Math.floor(confidence * 10),
    key: `${mapQueryType(queryType)}:${mapComplexity(complexity)}:${generateContextHash(content)}:${Math.floor(confidence * 10)}`
  };
}
```

---

## 5. ADR Compliance

### 5.1 ADR-024: Autonomous State Machine

All 250 agents must implement the 6-state lifecycle:

```typescript
enum AgentLifecycleState {
  INITIALIZING = 'Initializing',
  COLD_START = 'ColdStart',
  READY = 'Ready',
  BUSY = 'Busy',
  DEGRADED = 'Degraded',
  OFFLINE = 'Offline'
}

interface ASMCompliance {
  // State transitions
  readonly currentState: AgentLifecycleState;
  canTransitionTo(targetState: AgentLifecycleState): boolean;
  transition(trigger: string): Promise<void>;

  // Health monitoring
  readonly healthScore: number;
  updateHealth(score: HealthScore): Promise<void>;

  // OODA loop
  executeOODALoop(): Promise<void>;

  // Autonomous recovery
  readonly recoveryPlan: string[];
  executeRecovery(): Promise<void>;
}
```

### 5.2 ADR-025: RAN Battle Testing Framework

All agents must be battle-testable:

```typescript
interface BattleTestable {
  // Query handling
  handleQuery(query: TestQuestion): Promise<TestResponse>;

  // Get test statistics
  getTestStats(): TestStatistics;

  // Reset for new test
  resetTest(): Promise<void>;
}

interface TestStatistics {
  total_questions: number;
  correct_answers: number;
  knowledge_score: number;    // 0-40
  decision_score: number;     // 0-60
  advanced_score: number;     // 0-60

  // Bonus points
  ooda_efficiency_bonus: number;   // +20
  q_learning_converged: boolean;   // +20
  cross_feature_coordination: boolean; // +20

  // Total
  total_score: number;  // 0-200
}
```

---

## 6. Agent Class Hierarchy

```typescript
// =============================================================================
// BASE AGENT CLASS
// =============================================================================

abstract class BaseAgent {
  protected readonly id: AgentId;
  protected readonly stateMachine: AutonomousStateMachine;
  protected readonly qTable: QTable;
  protected readonly oodaLoop: OODALoop;

  constructor(config: BaseAgentConfig) {
    this.id = config.id;
    this.stateMachine = AutonomousStateMachine.create(this.id.value);
    this.qTable = QTable.create(this.id.value);
    this.oodaLoop = new AgentOODALoop(this, this.qTable, this.stateMachine);
  }

  abstract initialize(): Promise<void>;
  abstract handleQuery(query: Query): Promise<Response>;
}

// =============================================================================
// FEATURE AGENT (Base for all RAN feature agents)
// =============================================================================

abstract class FeatureAgent extends BaseAgent {
  protected readonly fajCode: FAJCode;
  protected readonly category: FeatureCategory;
  protected readonly knowledge: FeatureKnowledge;
  protected readonly capabilities: Capability[];

  constructor(config: FeatureAgentConfig) {
    super(config);
    this.fajCode = config.fajCode;
    this.category = config.category;
    this.knowledge = config.knowledge;
    this.capabilities = config.capabilities;
  }

  // Feature-specific query handling
  async handleQuery(query: Query): Promise<Response> {
    // Run OODA loop
    const oodaResult = await this.oodaLoop.execute();

    // Execute action based on OODA decision
    return await this.executeAction(oodaResult.decision, query);
  }

  // Feature knowledge retrieval
  protected getFeatureKnowledge(topic: string): Knowledge {
    return this.knowledge.get(topic);
  }

  // Parameter handling
  protected async getParameter(paramName: string): Promise<Parameter> {
    return this.knowledge.getParameter(paramName);
  }

  // Counter retrieval
  protected async getCounter(counterName: string): Promise<Counter> {
    return this.knowledge.getCounter(counterName);
  }

  // KPI handling
  protected async getKPI(kpiName: string): Promise<KPI> {
    return this.knowledge.getKPI(kpiName);
  }

  // cmedit command generation
  protected generateCMEditCommand(
    action: 'get' | 'set',
    params: Record<string, unknown>
  ): string {
    return CMEditGenerator.generate(this.fajCode, action, params);
  }
}

// =============================================================================
// LTE FEATURE AGENT
// =============================================================================

class LTEFeatureAgent extends FeatureAgent {
  readonly accessTechnology: 'LTE' = 'LTE';

  async initialize(): Promise<void> {
    await this.stateMachine.loadKnowledge();
    await this.stateMachine.transition('knowledge_loaded');
  }

  // LTE-specific optimizations
  protected async optimizeLTEParameters(
    kpis: LTEKPIs
  ): Promise<ParameterChange[]> {
    // LTE-specific parameter optimization logic
  }
}

// =============================================================================
// NR/5G FEATURE AGENT
// =============================================================================

class NRFeatureAgent extends FeatureAgent {
  readonly accessTechnology: 'NR' = 'NR';

  async initialize(): Promise<void> {
    await this.stateMachine.loadKnowledge();
    await this.stateMachine.transition('knowledge_loaded');
  }

  // NR-specific optimizations
  protected async optimizeNRParameters(
    kpis: NRKPIs
  ): Promise<ParameterChange[]> {
    // NR-specific parameter optimization logic
  }

  // NR dual connectivity
  protected async handleENDC(): Promise<ParameterChange[]> {
    // EN-DC (E-UTRA-NR Dual Connectivity) logic
  }
}

// =============================================================================
// COORDINATION AGENT (Domain coordinators)
// =============================================================================

class CoordinationAgent extends BaseAgent {
  readonly domain: CoordinationDomain;
  protected readonly supervisedAgents: Set<AgentId>;

  constructor(config: CoordinationAgentConfig) {
    super(config);
    this.domain = config.domain;
    this.supervisedAgents = new Set();
  }

  // Add agent to supervision
  supervise(agentId: AgentId): void {
    this.supervisedAgents.add(agentId);
  }

  // Coordinate across multiple agents
  async coordinateAcrossAgents(
    objective: Objective
  ): Promise<CoordinationResult> {
    // Get all supervised agents' states
    const agentStates = await this.getAgentStates();

    // Identify conflicts and opportunities
    const conflicts = this.detectConflicts(agentStates);
    const opportunities = this.findOpportunities(agentStates);

    // Generate coordination plan
    return this.generateCoordinationPlan(
      objective,
      conflicts,
      opportunities
    );
  }

  // Federated learning sync
  async syncFederatedLearning(): Promise<void> {
    // Collect Q-table deltas from supervised agents
    const deltas = await this.collectQTableDeltas();

    // Merge using federated averaging
    const merged = this.federatedMerge(deltas);

    // Distribute merged Q-table updates
    await this.distributeMergedQTable(merged);
  }
}

// =============================================================================
// SPECIALIZED AGENT TYPES
// =============================================================================

// Carrier Aggregation Agent
class CAAgent extends FeatureAgent {
  async optimizeCA(
    scenario: CAScenario
  ): Promise<CAOptimization> {
    // CA-specific optimization
  }
}

// Mobility Agent
class MobilityAgent extends FeatureAgent {
  async optimizeHandover(
    metrics: HandoverMetrics
  ): Promise<HandoverOptimization> {
    // Handover optimization
  }
}

// Energy Saving Agent
class EnergyAgent extends FeatureAgent {
  async optimizeEnergy(
    load: LoadProfile
  ): Promise<EnergyOptimization> {
    // Energy optimization
  }
}

// MIMO Agent
class MIMOOptimizerAgent extends FeatureAgent {
  async optimizeMIMO(
    scenario: MIMOScenario
  ): Promise<MIMOOptimization> {
    // MIMO optimization
  }
}
```

---

## 7. Memory Schema

### 7.1 AgentDB Schema Definition

```sql
-- =============================================================================
-- AGENT PROFILES (ran-agents namespace)
-- =============================================================================

CREATE TABLE agent_profiles (
  agent_id TEXT PRIMARY KEY,
  faj_code TEXT NOT NULL,
  category TEXT NOT NULL,
  access_tech TEXT NOT NULL,
  acronym TEXT NOT NULL,
  cxc_code TEXT,

  -- State
  current_state TEXT NOT NULL,
  health_score REAL NOT NULL,
  confidence REAL NOT NULL,

  -- Statistics
  total_queries INTEGER DEFAULT 0,
  successful_queries INTEGER DEFAULT 0,
  avg_response_time REAL,

  -- Learning
  q_table_size INTEGER DEFAULT 0,
  exploration_rate REAL DEFAULT 0.3,
  interaction_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Vector embedding (for semantic search)
  embedding BLOB,

  -- Indexes
  INDEX idx_faj_code (faj_code),
  INDEX idx_category (category),
  INDEX idx_state (current_state),
  INDEX idx_health (health_score)
);

-- =============================================================================
-- BATTLE TEST QUESTIONS (ran-questions namespace)
-- =============================================================================

CREATE TABLE test_questions (
  question_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  category TEXT NOT NULL,  -- A, B, or C
  subcategory TEXT NOT NULL,

  -- Content
  content TEXT NOT NULL,
  expected_topics TEXT,  -- JSON array
  template_type TEXT,

  -- Validation
  validation_rules TEXT,  -- JSON object

  -- Embedding for semantic search
  embedding BLOB,

  -- Metadata
  difficulty TEXT,
  estimated_time_seconds INTEGER,
  tags TEXT,  -- JSON array

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (agent_id) REFERENCES agent_profiles(agent_id),
  INDEX idx_agent_category (agent_id, category),
  INDEX idx_difficulty (difficulty)
);

-- =============================================================================
-- BATTLE TEST RESULTS (ran-results namespace)
-- =============================================================================

CREATE TABLE test_results (
  result_id TEXT PRIMARY KEY,
  test_session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  question_id TEXT NOT NULL,

  -- Scores
  knowledge_score REAL,
  decision_score REAL,
  advanced_score REAL,
  total_score REAL,

  -- Bonus points
  ooda_efficiency_bonus INTEGER DEFAULT 0,
  q_learning_converged_bonus INTEGER DEFAULT 0,
  cross_feature_bonus INTEGER DEFAULT 0,

  -- Response details
  response TEXT,
  confidence REAL,
  action_taken TEXT,
  state_at_response TEXT,

  -- OODA metrics
  ooda_observe_time_ms INTEGER,
  ooda_orient_time_ms INTEGER,
  ooda_decide_time_ms INTEGER,
  ooda_act_time_ms,
  ooda_total_time_ms INTEGER,

  -- Timestamps
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (agent_id) REFERENCES agent_profiles(agent_id),
  FOREIGN KEY (question_id) REFERENCES test_questions(question_id),
  INDEX idx_session (test_session_id),
  INDEX idx_agent_scores (agent_id, total_score)
);

-- =============================================================================
-- Q-TABLE SNAPSHOTS (ran-qtables namespace)
-- =============================================================================

CREATE TABLE q_table_snapshots (
  entry_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  state_key TEXT NOT NULL,
  action TEXT NOT NULL,

  -- Q-value
  q_value REAL NOT NULL,
  visits INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0.0,

  -- Outcomes (for confidence calculation)
  recent_outcomes TEXT,  -- JSON array of last 10 outcomes

  -- Metadata
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER,

  FOREIGN KEY (agent_id) REFERENCES agent_profiles(agent_id),
  UNIQUE INDEX idx_state_action (agent_id, state_key, action),
  INDEX idx_q_value (agent_id, q_value)
);

-- =============================================================================
-- LEARNED PATTERNS (ran-patterns namespace)
-- =============================================================================

CREATE TABLE learned_patterns (
  pattern_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,

  -- Pattern definition
  state_signature TEXT NOT NULL,
  action_sequence TEXT NOT NULL,  -- JSON array

  -- Statistics
  occurrence_count INTEGER DEFAULT 1,
  success_rate REAL DEFAULT 1.0,
  average_reward REAL DEFAULT 0.0,

  -- Confidence
  confidence REAL NOT NULL,
  first_observed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_observed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Context
  context_features TEXT,  -- JSON array
  preconditions TEXT,     // JSON array

  -- Embedding for pattern matching
  embedding BLOB,

  FOREIGN KEY (agent_id) REFERENCES agent_profiles(agent_id),
  INDEX idx_pattern_type (pattern_type),
  INDEX idx_confidence (confidence),
  INDEX idx_success_rate (success_rate)
);

-- =============================================================================
-- FEDERATED LEARNING LOGS (ran-federated namespace)
-- =============================================================================

CREATE TABLE federated_sync_logs (
  sync_id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,  -- intra-domain, inter-domain, global
  participating_agents TEXT NOT NULL,  -- JSON array

  -- Sync details
  entries_merged INTEGER DEFAULT 0,
  merge_strategy TEXT NOT NULL,
  convergence_metric REAL,

  -- Before/after versions
  before_version INTEGER,
  after_version INTEGER,

  -- Timestamps
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  INDEX idx_sync_type (sync_type),
  INDEX idx_timestamp (started_at)
);
```

### 7.2 HNSW Index Configuration

```typescript
interface HNSWIndexes {
  // Agent profile index
  agent_profiles: {
    dimension: 1536,
    M: 32,
    efConstruction: 400,
    efSearch: 100
  };

  // Question index
  test_questions: {
    dimension: 1536,
    M: 16,
    efConstruction: 200,
    efSearch: 50
  };

  // Pattern index
  learned_patterns: {
    dimension: 768,
    M: 64,
    efConstruction: 800,
    efSearch: 200
  };
}
```

---

## 8. Question Templates

### 8.1 Template Factory

```typescript
class QuestionTemplateFactory {
  // Generate all 250 questions for an agent
  static generateAgentQuestions(
    agent: FeatureAgent
  ): TestQuestion[] {
    const questions: TestQuestion[] = [];

    // Category A: Knowledge Retrieval (Q1-125)
    questions.push(...this.generateKnowledgeQuestions(agent, 1, 125));

    // Category B: Decision Making (Q126-200)
    questions.push(...this.generateDecisionQuestions(agent, 126, 200));

    // Category C: Advanced Troubleshooting (Q201-350)
    questions.push(...this.generateTroubleshootingQuestions(agent, 201, 350));

    return questions;
  }

  // Category A: Knowledge Questions
  private static generateKnowledgeQuestions(
    agent: FeatureAgent,
    start: number,
    end: number
  ): TestQuestion[] {
    const questions: TestQuestion[] = [];

    // A1: Feature Knowledge (Q1-40)
    for (let i = 1; i <= 40; i++) {
      questions.push(this.createFeatureKnowledgeQuestion(agent, i));
    }

    // A2: Parameters (Q41-80)
    for (let i = 41; i <= 80; i++) {
      questions.push(this.createParameterQuestion(agent, i));
    }

    // A3: Counters & KPIs (Q81-125)
    for (let i = 81; i <= 125; i++) {
      questions.push(this.createCounterKPIQuestion(agent, i));
    }

    return questions;
  }

  // Create feature knowledge question
  private static createFeatureKnowledgeQuestion(
    agent: FeatureAgent,
    num: number
  ): TestQuestion {
    const templates = [
      // Q1: Purpose
      {
        num: 1,
        template: `What is the primary purpose of ${agent.acronym}? Explain its key functionality and use cases.`,
        topics: ['purpose', 'functionality', 'use_cases']
      },

      // Q2: Activation
      {
        num: 2,
        template: `Describe the activation procedure for ${agent.acronym}. What are the prerequisites?`,
        topics: ['activation', 'prerequisites', 'procedure']
      },

      // Q3: Deactivation
      {
        num: 3,
        template: `Describe the deactivation procedure for ${agent.acronym}. Are there any special considerations?`,
        topics: ['deactivation', 'considerations', 'procedure']
      },

      // Q4: Dependencies
      {
        num: 4,
        template: `What are the feature dependencies for ${agent.acronym}? Which features must be active first?`,
        topics: ['dependencies', 'prerequisites', 'features']
      },

      // Q5: Conflicts
      {
        num: 5,
        template: `Are there any known conflicts or incompatibilities with ${agent.acronym}?`,
        topics: ['conflicts', 'incompatibilities', 'limitations']
      }
    ];

    const template = templates[num - 1] || templates[0];

    return {
      id: `${agent.id.value}:Q${num}`,
      agent_id: agent.id.value,
      question_number: num,
      category: 'A',
      subcategory: 'feature_knowledge',
      content: template.template,
      expected_topics: template.topics,
      validation: this.getKnowledgeValidation(num),
      metadata: {
        difficulty: 'basic',
        estimated_time: 60  // seconds
      }
    };
  }

  // Category B: Decision Questions
  private static generateDecisionQuestions(
    agent: FeatureAgent,
    start: number,
    end: number
  ): TestQuestion[] {
    const questions: TestQuestion[] = [];

    // B1: Optimization Decisions (Q126-165)
    for (let i = 126; i <= 165; i++) {
      questions.push(this.createOptimizationDecisionQuestion(agent, i));
    }

    // B2: KPI-Based Actions (Q166-200)
    for (let i = 166; i <= 200; i++) {
      questions.push(this.createKPIBasedActionQuestion(agent, i));
    }

    return questions;
  }

  // Create optimization decision question
  private static createOptimizationDecisionQuestion(
    agent: FeatureAgent,
    num: number
  ): TestQuestion {
    const scenarios = this.getOptimizationScenarios(agent);

    return {
      id: `${agent.id.value}:Q${num}`,
      agent_id: agent.id.value,
      question_number: num,
      category: 'B',
      subcategory: 'optimization',
      content: this.formatOptimizationScenario(scenarios[num % scenarios.length]),
      scenario: scenarios[num % scenarios.length],
      validation: this.getDecisionValidation(num),
      metadata: {
        difficulty: 'intermediate',
        estimated_time: 120  // seconds
      }
    };
  }

  // Category C: Troubleshooting Questions
  private static generateTroubleshootingQuestions(
    agent: FeatureAgent,
    start: number,
    end: number
  ): TestQuestion[] {
    const questions: TestQuestion[] = [];

    // C1: Multi-Parameter (Q201-275)
    for (let i = 201; i <= 275; i++) {
      questions.push(this.createMultiParameterQuestion(agent, i));
    }

    // C2: Cross-Feature (Q276-350)
    for (let i = 276; i <= 350; i++) {
      questions.push(this.createCrossFeatureQuestion(agent, i));
    }

    return questions;
  }

  // Get optimization scenarios
  private static getOptimizationScenarios(agent: FeatureAgent): OptimizationScenario[] {
    return [
      {
        context: 'High load scenario during peak hours',
        current_kpis: {
          throughput: 45,
          latency: 28,
          success_rate: 97.5
        },
        target_kpis: {
          throughput: 50,
          latency: 25,
          success_rate: 98.0
        }
      },
      {
        context: 'Cell edge performance degradation',
        current_kpis: {
          rsrp: -105,
          sinr: 2,
          throughput: 15
        },
        target_kpis: {
          rsrp: -95,
          sinr: 5,
          throughput: 25
        }
      }
    ];
  }
}
```

---

## 9. API Contracts Between Contexts

### 9.1 Knowledge → Intelligence

```typescript
interface KnowledgeToIntelligenceAPI {
  // Query feature knowledge
  getFeatureKnowledge(fajCode: string): Promise<FeatureKnowledge>;

  // Get parameter bounds
  getParameterBounds(paramId: string): Promise<ParameterBounds>;

  // Get KPI definitions
  getKPIDefinition(kpiId: string): Promise<KPIDefinition>;

  // Subscribe to knowledge updates
  subscribeToUpdates(callback: (event: KnowledgeUpdatedEvent) => void): void;
}
```

### 9.2 Intelligence → Optimization

```typescript
interface IntelligenceToOptimizationAPI {
  // Get Q-value prediction
  getQValuePrediction(state: QLearningState, action: Action): number;

  // Get recommended patterns
  getRecommendedPatterns(state: QLearningState): Pattern[];

  // Get learning metrics
  getLearningMetrics(agentId: string): LearningMetrics;

  // Subscribe to pattern discovery
  subscribeToPatterns(callback: (event: PatternDiscoveredEvent) => void): void;
}
```

### 9.3 Optimization → Coordination

```typescript
interface OptimizationToCoordinationAPI {
  // Request optimization execution
  requestOptimization(cycleId: string): Promise<OptimizationResult>;

  // Request rollback
  requestRollback(cycleId: string): Promise<RollbackResult>;

  // Get optimization status
  getOptimizationStatus(cycleId: string): OptimizationStatus;

  // Subscribe to optimization events
  subscribeToEvents(callback: (event: OptimizationEvent) => void): void;
}
```

### 9.4 Coordination → All Contexts

```typescript
interface CoordinationAPI {
  // Route query to appropriate agent
  routeQuery(query: Query): Promise<RoutingResult>;

  // Get agent status
  getAgentStatus(agentId: string): AgentStatus;

  // Coordinate multi-agent action
  coordinateAction(action: MultiAgentAction): Promise<CoordinationResult>;

  // Sync federated learning
  syncFederatedLearning(domain: string): Promise<SyncResult>;
}
```

---

## 10. Deployment Architecture

### 10.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    250 RAN AI AGENTS - DEPLOYMENT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    API GATEWAY / ROUTER                             │    │
│  │  - Semantic routing with HNSW (150x-12,500x faster)                │    │
│  │  - Load balancing across agent pools                               │    │
│  │  - Request/response aggregation                                    │    │
│  └────────────────────────┬───────────────────────────────────────────┘    │
│                           │                                                 │
│  ┌────────────────────────┴───────────────────────────────────────────┐    │
│  │                   COORDINATION LAYER                                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐         │    │
│  │  │   Swarm      │  │  Topology    │  │  Consensus       │         │    │
│  │  │ Coordinator  │  │  Manager     │  │  Manager         │         │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘         │    │
│  └────────────────────────┬───────────────────────────────────────────┘    │
│                           │                                                 │
│  ┌────────────────────────┴───────────────────────────────────────────┐    │
│  │                      AGENT POOLS (250 agents)                       │    │
│  │                                                                     │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │    │
│  │  │   LTE Pool       │  │    NR/5G Pool   │  │  Specialized    │  │    │
│  │  │   (50 agents)    │  │   (57 agents)    │  │  Pool (143)     │  │    │
│  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │ ┌───────────┐ │  │    │
│  │  │  │ MSM, P,    │  │  │  │ NR CA,     │  │  │ │ Domain    │ │  │    │
│  │  │  │ D-PUCCH,   │  │  │  │ EN-DC,     │  │  │ │ Coords    │ │  │    │
│  │  │  │ ...        │  │  │  │ DSS, ...   │  │  │ │ ...       │ │  │    │
│  │  │  └────────────┘  │  │  └────────────┘  │  │ └───────────┘ │  │    │
│  │  └──────────────────┘  └──────────────────┘  └─────────────────┘  │    │
│  │                                                                     │    │
│  │  Each Agent:                                                        │    │
│  │  - AutonomousStateMachine (ADR-024)                                │    │
│  │  - QTable (Intelligence)                                            │    │
│  │  - FeatureKnowledge (Knowledge)                                     │    │
│  │  - OODA Loop                                                        │    │
│  └────────────────────────┬───────────────────────────────────────────┘    │
│                           │                                                 │
│  ┌────────────────────────┴───────────────────────────────────────────┐    │
│  │                   MEMORY LAYER (AgentDB)                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐         │    │
│  │  │   HNSW       │  │   SQLite     │  │   Vector         │         │    │
│  │  │   Index      │  │   Storage    │  │   Embeddings     │         │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘         │    │
│  │                                                                     │    │
│  │  Namespaces:                                                        │    │
│  │  - ran-agents (250 profiles)                                       │    │
│  │  - ran-questions (62,500 questions)                                 │    │
│  │  - ran-patterns (10,000 patterns)                                   │    │
│  │  - ran-qtables (2.5M entries)                                       │    │
│  │  - ran-results (100K results)                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Deployment Configuration

```typescript
interface DeploymentConfig {
  // Agent pools
  pools: {
    lte: {
      count: 50,
      instances: 5,      // 10 agents per instance
      memory: '2GB',
      cpu: '2 cores'
    },
    nr: {
      count: 57,
      instances: 6,      // ~10 agents per instance
      memory: '2GB',
      cpu: '2 cores'
    },
    specialized: {
      count: 143,
      instances: 15,     // ~10 agents per instance
      memory: '2GB',
      cpu: '2 cores'
    }
  };

  // Coordination
  coordination: {
    swarm_coordinators: 3,
    topology: 'hierarchical-mesh',
    consensus: 'raft'
  };

  // Memory
  memory: {
    backend: 'hybrid',  // SQLite + HNSW
    cache_size: '4GB',
    vector_index: 'HNSW',
    max_entries_per_namespace: 10000000
  };

  // API Gateway
  gateway: {
    instances: 2,
    load_balancing: 'semantic',
    routing_strategy: 'HNSW'
  };

  // Monitoring
  monitoring: {
    metrics: 'prometheus',
    logs: 'elasticsearch',
    traces: 'jaeger'
  };
}
```

### 10.3 Scaling Strategy

```typescript
interface ScalingStrategy {
  // Horizontal scaling
  horizontal: {
    min_instances: 26,  // Total agent instances
    max_instances: 52,  // 2x scaling
    target_cpu_utilization: 70,
    target_memory_utilization: 80
  };

  // Vertical scaling
  vertical: {
    min_memory_per_agent: '512MB',
    max_memory_per_agent: '4GB',
    min_cpu_per_agent: '0.5 cores',
    max_cpu_per_agent: '2 cores'
  };

  // Auto-scaling rules
  autoscaling: [
    {
      condition: 'avg_response_time > 500ms',
      action: 'scale_up_agents',
      cooldown: '5min'
    },
    {
      condition: 'cpu_utilization > 80%',
      action: 'scale_up_instances',
      cooldown: '3min'
    },
    {
      condition: 'query_queue_length > 100',
      action: 'scale_up_gateway',
      cooldown: '2min'
    }
  ];
}
```

---

## Appendices

### Appendix A: Agent Category Mapping

| Category | Count | FAJ Pattern | Examples |
|----------|-------|-------------|----------|
| LTE Features | 50 | FAJ 1XX XXXX | MSM, P, D-PUCCH, IFLB |
| NR/5G Features | 57 | FAJ 3XX XXXX | NR CA, EN-DC, DSS |
| Carrier Aggregation | 89 | FAJ 12X XXXX | CAE1, CAE2, CC |
| Radio Resource Management | 64 | Various | DUAC, MCPC, ANR |
| Transport | 52 | FAJ 2XX XXXX | CPRI, Ethernet |
| MIMO & Antenna | 40 | Various | 4QADPP, MC-PUSCH |
| Mobility | 36 | FAJ 3XX XXXX | HO, ANR, MRO |
| Energy Saving | 29 | FAJ 12X XXXX | Cell sleep, Micro sleep |
| Coverage & Capacity | 28 | Various | Sector, Cell config |
| Voice & IMS | 21 | Various | VoLTE, VoNR, CSFB |
| Coordination | 10+ | N/A | Domain coordinators |

### Appendix B: Question Distribution

| Category | Subcategory | Questions | Points |
|----------|-------------|-----------|--------|
| A: Knowledge | Feature Knowledge | Q1-40 | 40 |
| A: Knowledge | Parameters | Q41-80 | 40 |
| A: Knowledge | Counters & KPIs | Q81-125 | 45 |
| B: Decision | Optimization | Q126-165 | 60 |
| B: Decision | KPI-Based Actions | Q166-200 | 60 |
| C: Advanced | Multi-Parameter | Q201-275 | 75 |
| C: Advanced | Cross-Feature | Q276-350 | 75 |
| **Total** | | **350** | **395** |

### Appendix C: Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent initialization | < 5s | Knowledge load time |
| Query response time | < 200ms | End-to-end latency |
| OODA loop cycle | < 100ms | Decision latency |
| Q-table lookup | < 1ms | Hash map access |
| Semantic routing | < 50ms | HNSW search |
| Battle test execution | < 10min | Full test suite |
| Federated sync | < 30s | Q-table merge |
| Health monitoring | < 10ms | Metric collection |

### Appendix D: Success Criteria

- [ ] All 250 agents created and initialized
- [ ] Each agent has 250 questions (62,500 total)
- [ ] OODA loop implemented per ADR-024
- [ ] Battle test framework integrated per ADR-025
- [ ] HNSW indexing configured (150x-12,500x faster)
- [ ] Memory namespaces configured
- [ ] API contracts between contexts defined
- [ ] Deployment architecture validated
- [ ] Performance targets met
- [ ] Battle test execution successful

---

**End of Document**

This architecture design provides a comprehensive blueprint for implementing 250 specialized RAN AI agents following DDD principles, ADR-024 (Autonomous State Machine), and ADR-025 (RAN Battle Testing Framework).
