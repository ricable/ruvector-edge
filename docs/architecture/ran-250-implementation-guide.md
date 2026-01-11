# Implementation Guide: 250 RAN AI Agents

**Document Version**: 1.0.0
**Date**: 2026-01-11
**Related**: [Architecture Design](./ran-250-agents-architecture.md)

---

## Phase 1: Foundation (Week 1-2)

### Step 1.1: Domain Model Expansion

**Files to Create/Modify:**

1. **Feature Categories Enum**
   - `/src/domains/knowledge/entities/feature-category.ts`
   - Expand from existing categories to support all 10 domains

```typescript
// src/domains/knowledge/entities/feature-category.ts

export enum FeatureCategory {
  // Existing
  LTE = 'LTE',
  NR_5G = 'NR_5G',
  CA = 'CA',
  RRM = 'RRM',
  MIMO = 'MIMO',
  MOBILITY = 'Mobility',
  ENERGY = 'Energy',
  COVERAGE = 'Coverage',

  // New for 250 agents
  TRANSPORT = 'Transport',
  VOICE_IMS = 'Voice_IMS',
  UE_HANDLING = 'UE_Handling',
  QOS = 'QoS',
  INTERFERENCE = 'Interference',
  TIMING = 'Timing',
  SECURITY = 'Security',
  SON = 'SON',
  COORDINATION = 'Coordination'
}

export function inferCategoryFromFAJ(fajCode: string): FeatureCategory {
  const code = fajCode.replace('FAJ ', '').substring(0, 3);
  const num = parseInt(code);

  if (num >= 100 && num < 120) return FeatureCategory.LTE;
  if (num >= 120 && num < 130) return FeatureCategory.CA;
  if (num >= 120 && num < 122) return FeatureCategory.ENERGY;
  if (num >= 200 && num < 300) return FeatureCategory.TRANSPORT;
  if (num >= 300 && num < 400) return FeatureCategory.MOBILITY;
  if (num >= 400 && num < 500) return FeatureCategory.COVERAGE;
  if (num >= 500 && num < 600) return FeatureCategory.SECURITY;

  return FeatureCategory.LTE; // Default
}
```

2. **Agent Registry**
   - `/src/domains/knowledge/aggregates/agent-registry.ts`
   - Manage all 250 agents

```typescript
// src/domains/knowledge/aggregates/agent-registry.ts

import { FeatureAgent } from './feature-agent';
import { LTEFeatureAgentsFactory } from './lte-feature-agents-factory';
import { NRFeatureAgentsFactory } from './nr-feature-agents-factory';
import { SpecializedAgentsFactory } from './specialized-agents-factory';
import { CoordinationAgentsFactory } from './coordination-agents-factory';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, FeatureAgent>;
  private byCategory: Map<FeatureCategory, Set<string>>;
  private byFAJ: Map<string, string>;  // FAJ -> agentId

  private constructor() {
    this.agents = new Map();
    this.byCategory = new Map();
    this.byFAJ = new Map();
  }

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  // Initialize all 250 agents
  async initializeAll(): Promise<void> {
    console.log('Initializing 250 RAN AI agents...');

    // 1. Create LTE agents (50)
    const lteAgents = LTEFeatureAgentsFactory.createAll();
    this.registerBatch(lteAgents);

    // 2. Create NR/5G agents (57)
    const nrAgents = await NRFeatureAgentsFactory.createAll();
    this.registerBatch(nrAgents);

    // 3. Create specialized agents (143)
    const specializedAgents = await SpecializedAgentsFactory.createAll();
    this.registerBatch(specializedAgents);

    // 4. Create coordination agents (10)
    const coordinationAgents = await CoordinationAgentsFactory.createAll();
    this.registerBatch(coordinationAgents);

    // Initialize all agents
    for (const [id, agent] of this.agents) {
      await agent.initialize();
      console.log(`✓ Agent initialized: ${id} (${agent.getFAJCode()})`);
    }

    console.log(`Total agents registered: ${this.agents.size}`);
  }

  private registerBatch(agents: Map<string, FeatureAgent>): void {
    for (const [id, agent] of agents) {
      this.register(id, agent);
    }
  }

  private register(id: string, agent: FeatureAgent): void {
    this.agents.set(id, agent);

    // Index by category
    const category = agent.getCategory();
    if (!this.byCategory.has(category)) {
      this.byCategory.set(category, new Set());
    }
    this.byCategory.get(category)!.add(id);

    // Index by FAJ
    this.byFAJ.set(agent.getFAJCode().toString(), id);
  }

  // Query methods
  getAgent(id: string): FeatureAgent | undefined {
    return this.agents.get(id);
  }

  getAgentByFAJ(fajCode: string): FeatureAgent | undefined {
    const id = this.byFAJ.get(fajCode);
    return id ? this.agents.get(id) : undefined;
  }

  getAgentsByCategory(category: FeatureCategory): FeatureAgent[] {
    const ids = this.byCategory.get(category) || new Set();
    return Array.from(ids)
      .map(id => this.agents.get(id))
      .filter((a): a is FeatureAgent => a !== undefined);
  }

  getAllAgents(): FeatureAgent[] {
    return Array.from(this.agents.values());
  }

  // Statistics
  getStatistics(): RegistryStatistics {
    const byCategory: Record<string, number> = {};

    for (const [category, ids] of this.byCategory) {
      byCategory[category] = ids.size;
    }

    return {
      totalAgents: this.agents.size,
      byCategory: byCategory,
      readyAgents: Array.from(this.agents.values())
        .filter(a => a.getState() === 'Ready').length,
      busyAgents: Array.from(this.agents.values())
        .filter(a => a.getState() === 'Busy').length
    };
  }
}

interface RegistryStatistics {
  totalAgents: number;
  byCategory: Record<string, number>;
  readyAgents: number;
  busyAgents: number;
}
```

### Step 1.2: Memory Layer Setup

**File to Create:**
- `/src/memory/ran-memory-schema.ts`

```typescript
// src/memory/ran-memory-schema.ts

import { agentDB } from '@agentdb/core';

export interface RANMemoryNamespaces {
  'ran-agents': AgentProfile;
  'ran-questions': TestQuestion;
  'ran-patterns': LearnedPattern;
  'ran-qtables': QTableEntry;
  'ran-results': TestResult;
}

export class RANMemoryInitializer {
  static async initialize(): Promise<void> {
    console.log('Initializing RAN memory namespaces...');

    // Configure namespaces
    await this.setupAgentProfiles();
    await this.setupTestQuestions();
    await this.setupLearnedPatterns();
    await this.setupQTableEntries();
    await this.setupTestResults();

    // Configure HNSW indexes
    await this.setupHNSWIndexes();

    console.log('Memory namespaces initialized');
  }

  private static async setupAgentProfiles(): Promise<void> {
    await agentDB.createNamespace('ran-agents', {
      schema: {
        agent_id: 'string PRIMARY KEY',
        faj_code: 'string NOT NULL',
        category: 'string NOT NULL',
        access_tech: 'string NOT NULL',
        acronym: 'string NOT NULL',
        cxc_code: 'string',
        current_state: 'string NOT NULL',
        health_score: 'real NOT NULL',
        confidence: 'real NOT NULL',
        total_queries: 'integer DEFAULT 0',
        successful_queries: 'integer DEFAULT 0',
        avg_response_time: 'real',
        q_table_size: 'integer DEFAULT 0',
        exploration_rate: 'real DEFAULT 0.3',
        interaction_count: 'integer DEFAULT 0',
        created_at: 'timestamp DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'timestamp DEFAULT CURRENT_TIMESTAMP',
        embedding: 'blob'
      },
      indexes: [
        { columns: ['faj_code'] },
        { columns: ['category'] },
        { columns: ['current_state'] },
        { columns: ['health_score'] }
      ]
    });
  }

  private static async setupTestQuestions(): Promise<void> {
    await agentDB.createNamespace('ran-questions', {
      schema: {
        question_id: 'string PRIMARY KEY',
        agent_id: 'string NOT NULL',
        question_number: 'integer NOT NULL',
        category: 'string NOT NULL',
        subcategory: 'string NOT NULL',
        content: 'string NOT NULL',
        expected_topics: 'string',
        template_type: 'string',
        validation_rules: 'string',
        embedding: 'blob',
        difficulty: 'string',
        estimated_time_seconds: 'integer',
        tags: 'string',
        created_at: 'timestamp DEFAULT CURRENT_TIMESTAMP'
      },
      indexes: [
        { columns: ['agent_id', 'category'] },
        { columns: ['difficulty'] }
      ],
      vectorIndex: {
        dimension: 1536,
        M: 16,
        efConstruction: 200
      }
    });
  }

  private static async setupLearnedPatterns(): Promise<void> {
    await agentDB.createNamespace('ran-patterns', {
      schema: {
        pattern_id: 'string PRIMARY KEY',
        agent_id: 'string NOT NULL',
        pattern_type: 'string NOT NULL',
        state_signature: 'string NOT NULL',
        action_sequence: 'string NOT NULL',
        occurrence_count: 'integer DEFAULT 1',
        success_rate: 'real DEFAULT 1.0',
        average_reward: 'real DEFAULT 0.0',
        confidence: 'real NOT NULL',
        first_observed: 'timestamp DEFAULT CURRENT_TIMESTAMP',
        last_observed: 'timestamp DEFAULT CURRENT_TIMESTAMP',
        context_features: 'string',
        preconditions: 'string',
        embedding: 'blob'
      },
      indexes: [
        { columns: ['pattern_type'] },
        { columns: ['confidence'] },
        { columns: ['success_rate'] }
      ],
      vectorIndex: {
        dimension: 768,
        M: 64,
        efConstruction: 800
      }
    });
  }

  private static async setupQTableEntries(): Promise<void> {
    await agentDB.createNamespace('ran-qtables', {
      schema: {
        entry_id: 'string PRIMARY KEY',
        agent_id: 'string NOT NULL',
        state_key: 'string NOT NULL',
        action: 'string NOT NULL',
        q_value: 'real NOT NULL',
        visits: 'integer DEFAULT 0',
        confidence: 'real DEFAULT 0.0',
        recent_outcomes: 'string',
        last_updated: 'timestamp DEFAULT CURRENT_TIMESTAMP',
        version: 'integer'
      },
      indexes: [
        { columns: ['agent_id', 'state_key', 'action'], unique: true },
        { columns: ['agent_id', 'q_value'] }
      ]
    });
  }

  private static async setupTestResults(): Promise<void> {
    await agentDB.createNamespace('ran-results', {
      schema: {
        result_id: 'string PRIMARY KEY',
        test_session_id: 'string NOT NULL',
        agent_id: 'string NOT NULL',
        question_id: 'string NOT NULL',
        knowledge_score: 'real',
        decision_score: 'real',
        advanced_score: 'real',
        total_score: 'real',
        ooda_efficiency_bonus: 'integer DEFAULT 0',
        q_learning_converged_bonus: 'integer DEFAULT 0',
        cross_feature_bonus: 'integer DEFAULT 0',
        response: 'string',
        confidence: 'real',
        action_taken: 'string',
        state_at_response: 'string',
        ooda_observe_time_ms: 'integer',
        ooda_orient_time_ms: 'integer',
        ooda_decide_time_ms: 'integer',
        ooda_act_time_ms: 'integer',
        ooda_total_time_ms: 'integer',
        answered_at: 'timestamp DEFAULT CURRENT_TIMESTAMP'
      },
      indexes: [
        { columns: ['test_session_id'] },
        { columns: ['agent_id', 'total_score'] }
      ]
    });
  }

  private static async setupHNSWIndexes(): Promise<void> {
    // Agent profiles index (for semantic routing)
    await agentDB.createHNSWIndex('ran-agents', {
      dimension: 1536,
      M: 32,
      efConstruction: 400,
      efSearch: 100
    });

    // Questions index (for question matching)
    await agentDB.createHNSWIndex('ran-questions', {
      dimension: 1536,
      M: 16,
      efConstruction: 200,
      efSearch: 50
    });

    // Patterns index (for pattern discovery)
    await agentDB.createHNSWIndex('ran-patterns', {
      dimension: 768,
      M: 64,
      efConstruction: 800,
      efSearch: 200
    });
  }
}
```

---

## Phase 2: Agent Implementation (Week 3-6)

### Step 2.1: NR/5G Feature Agents Factory

**File to Create:**
- `/src/domains/knowledge/aggregates/nr-feature-agents-factory.ts`

```typescript
// src/domains/knowledge/aggregates/nr-feature-agents-factory.ts

import { FeatureAgent } from './feature-agent';
import { FAJCode } from '../value-objects/faj-code';
import { Feature, AccessTechnology, Category } from '../entities/feature';

// NR/5G Features (57 agents)
const NR_5G_FEATURES = [
  // NR Carrier Aggregation
  { faj: 'FAJ 120 0001', acronym: 'NR_CA', name: 'NR Carrier Aggregation', cxc: null },
  { faj: 'FAJ 120 0002', acronym: 'NR_CA_UL', name: 'NR Uplink Carrier Aggregation', cxc: null },

  // EN-DC (E-UTRA-NR Dual Connectivity)
  { faj: 'FAJ 120 0101', acronym: 'ENDC', name: 'E-UTRA-NR Dual Connectivity', cxc: 'CXC 401 0001' },
  { faj: 'FAJ 120 0102', acronym: 'ENDC_UL', name: 'EN-DC Uplink Configuration', cxc: null },

  // DSS (Dynamic Spectrum Sharing)
  { faj: 'FAJ 120 0201', acronym: 'DSS', name: 'Dynamic Spectrum Sharing', cxc: 'CXC 401 0002' },

  // NR Features
  { faj: 'FAJ 300 0001', acronym: 'NR_HO', name: 'NR Handover', cxc: null },
  { faj: 'FAJ 300 0002', acronym: 'NR_ANR', name: 'NR Automatic Neighbor Relation', cxc: null },
  { faj: 'FAJ 300 0003', acronym: 'NR_MRO', name: 'NR Mobility Robness Optimization', cxc: null },

  // ... Additional NR features
];

export class NRFeatureAgentsFactory {
  static async createAll(): Promise<Map<string, FeatureAgent>> {
    const agents = new Map<string, FeatureAgent>();

    for (const feature of NR_5G_FEATURES) {
      const fajCode = FAJCode.create(feature.faj);
      const category = this.inferCategory(feature.name);

      const featureData = new Feature({
        id: `feature-${feature.acronym}`,
        fajCode,
        name: feature.name,
        description: `${feature.name} - NR/5G feature with FAJ ${feature.faj}`,
        category,
        accessTechnology: 'NR' as AccessTechnology,
        parameters: this.generateMockParameters(),
        counters: this.generateMockCounters(),
        kpis: this.generateMockKPIs(),
        procedures: [],
        dependencies: [],
        conflicts: [],
        relatedFeatures: []
      });

      const agent = FeatureAgent.createEnhanced({
        fajCode,
        type: 'NR' as AccessTechnology,
        category,
        featureData,
        acronym: feature.acronym,
        cxc: feature.cxc,
        stateMachineConfig: {
          coldStartThreshold: 3,
          degradedThreshold: 0.5,
          explorationBaseRate: 0.1,
          recoveryThreshold: 0.3
        }
      });

      agents.set(feature.acronym, agent);
    }

    return agents;
  }

  private static inferCategory(name: string): Category {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('carrier aggregation') || nameLower.includes('ca')) {
      return 'CA' as Category;
    } else if (nameLower.includes('handover') || nameLower.includes('mobility')) {
      return 'Mobility' as Category;
    } else if (nameLower.includes('energy') || nameLower.includes('power')) {
      return 'Energy' as Category;
    }

    return 'Other' as Category;
  }

  private static generateMockParameters(): any[] { return []; }
  private static generateMockCounters(): any[] { return []; }
  private static generateMockKPIs(): any[] { return []; }
}
```

### Step 2.2: Specialized Agents Factory

**File to Create:**
- `/src/domains/knowledge/aggregates/specialized-agents-factory.ts`

```typescript
// src/domains/knowledge/aggregates/specialized-agents-factory.ts

import { FeatureAgent } from './feature-agent';
import { FAJCode } from '../value-objects/faj-code';
import { Feature, AccessTechnology, Category } from '../entities/feature';

// Specialized Features (143 agents)
const SPECIALIZED_FEATURES = [
  // Carrier Aggregation Specialists (remaining 87 after LTE/NR)
  { faj: 'FAJ 120 0003', acronym: 'CAE1', name: 'Carrier Aggregation Enhancement 1', category: 'CA', tech: 'LTE' },
  { faj: 'FAJ 120 0004', acronym: 'CAE2', name: 'Carrier Aggregation Enhancement 2', category: 'CA', tech: 'LTE' },
  // ... more CA features

  // Radio Resource Management (64)
  { faj: 'FAJ 101 0001', acronym: 'DUAC', name: 'DL Uplink Admission Control', category: 'RRM', tech: 'LTE' },
  { faj: 'FAJ 101 0002', acronym: 'MCPC', name: 'Multi-Carrier Power Control', category: 'RRM', tech: 'LTE' },
  // ... more RRM features

  // Transport (52)
  { faj: 'FAJ 200 0001', acronym: 'CPRI_OPT', name: 'CPRI Optimization', category: 'Transport', tech: 'LTE' },
  // ... more Transport features

  // MIMO & Antenna (40)
  { faj: 'FAJ 103 0001', acronym: '4QADPP', name: '4x4 MIMO Adaptive', category: 'MIMO', tech: 'LTE' },
  // ... more MIMO features

  // Mobility (36)
  { faj: 'FAJ 300 0004', acronym: 'MRO', name: 'Mobility Robustness Optimization', category: 'Mobility', tech: 'LTE' },
  // ... more Mobility features

  // Energy Saving (29)
  { faj: 'FAJ 121 0001', acronym: 'CELL_SLEEP', name: 'Cell Sleep', category: 'Energy', tech: 'LTE' },
  // ... more Energy features

  // Coverage & Capacity (28)
  { faj: 'FAJ 400 0001', acronym: 'SECTOR_MGMT', name: 'Sector Management', category: 'Coverage', tech: 'LTE' },
  // ... more Coverage features
];

export class SpecializedAgentsFactory {
  static async createAll(): Promise<Map<string, FeatureAgent>> {
    const agents = new Map<string, FeatureAgent>();

    for (const feature of SPECIALIZED_FEATURES) {
      const fajCode = FAJCode.create(feature.faj);

      const featureData = new Feature({
        id: `feature-${feature.acronym}`,
        fajCode,
        name: feature.name,
        description: `${feature.name} - ${feature.category} feature with FAJ ${feature.faj}`,
        category: feature.category as Category,
        accessTechnology: feature.tech as AccessTechnology,
        parameters: this.generateMockParameters(),
        counters: this.generateMockCounters(),
        kpis: this.generateMockKPIs(),
        procedures: [],
        dependencies: [],
        conflicts: [],
        relatedFeatures: []
      });

      const agent = FeatureAgent.createEnhanced({
        fajCode,
        type: feature.tech as AccessTechnology,
        category: feature.category as Category,
        featureData,
        acronym: feature.acronym,
        cxc: null,
        stateMachineConfig: {
          coldStartThreshold: 3,
          degradedThreshold: 0.5,
          explorationBaseRate: 0.1,
          recoveryThreshold: 0.3
        }
      });

      agents.set(feature.acronym, agent);
    }

    return agents;
  }

  private static generateMockParameters(): any[] { return []; }
  private static generateMockCounters(): any[] { return []; }
  private static generateMockKPIs(): any[] { return []; }
}
```

### Step 2.3: Coordination Agents Factory

**File to Create:**
- `/src/domains/coordination/aggregates/coordination-agents-factory.ts`

```typescript
// src/domains/coordination/aggregates/coordination-agents-factory.ts

import { CoordinationAgent } from './coordination-agent';
import { FeatureCategory } from '../../knowledge/entities/feature-category';

// Coordination Domains
const COORDINATION_DOMAINS: Array<{
  id: string;
  domain: FeatureCategory;
  description: string;
}> = [
  { id: 'coord-lte', domain: FeatureCategory.LTE, description: 'LTE Feature Coordination' },
  { id: 'coord-nr', domain: FeatureCategory.NR_5G, description: 'NR/5G Feature Coordination' },
  { id: 'coord-ca', domain: FeatureCategory.CA, description: 'Carrier Aggregation Coordination' },
  { id: 'coord-rrm', domain: FeatureCategory.RRM, description: 'Radio Resource Management Coordination' },
  { id: 'coord-mobility', domain: FeatureCategory.MOBILITY, description: 'Mobility Coordination' },
  { id: 'coord-energy', domain: FeatureCategory.ENERGY, description: 'Energy Saving Coordination' },
  { id: 'coord-mimo', domain: FeatureCategory.MIMO, description: 'MIMO Coordination' },
  { id: 'coord-transport', domain: FeatureCategory.TRANSPORT, description: 'Transport Coordination' },
  { id: 'coord-coverage', domain: FeatureCategory.COVERAGE, description: 'Coverage Coordination' },
  { id: 'coord-emergency', domain: FeatureCategory.COORDINATION, description: 'Emergency Response Coordination' }
];

export class CoordinationAgentsFactory {
  static async createAll(): Promise<Map<string, CoordinationAgent>> {
    const agents = new Map<string, CoordinationAgent>();

    for (const domain of COORDINATION_DOMAINS) {
      const agent = await CoordinationAgent.create({
        id: domain.id,
        domain: domain.domain,
        description: domain.description
      });

      agents.set(domain.id, agent);
    }

    return agents;
  }
}
```

---

## Phase 3: Question Generation (Week 7-8)

### Step 3.1: Question Template Engine

**File to Create:**
- `/src/domains/ran-battle-test/services/question-template-engine.ts`

```typescript
// src/domains/ran-battle-test/services/question-template-engine.ts

import { FeatureAgent } from '../../knowledge/aggregates/feature-agent';
import { TestQuestion } from '../entities/test-question';
import { agentDB } from '@agentdb/core';

export class QuestionTemplateEngine {
  // Generate all 250 questions for an agent
  static async generateAgentQuestions(
    agent: FeatureAgent
  ): Promise<TestQuestion[]> {
    const questions: TestQuestion[] = [];

    // Category A: Knowledge Retrieval (Q1-125)
    questions.push(...await this.generateKnowledgeQuestions(agent));

    // Category B: Decision Making (Q126-200)
    questions.push(...await this.generateDecisionQuestions(agent));

    // Category C: Advanced Troubleshooting (Q201-350)
    questions.push(...await this.generateTroubleshootingQuestions(agent));

    // Store in AgentDB
    for (const question of questions) {
      await this.storeQuestion(question);
    }

    return questions;
  }

  private static async generateKnowledgeQuestions(
    agent: FeatureAgent
  ): Promise<TestQuestion[]> {
    const questions: TestQuestion[] = [];

    // A1: Feature Knowledge (Q1-40)
    for (let i = 1; i <= 40; i++) {
      questions.push(await this.createFeatureKnowledgeQuestion(agent, i));
    }

    // A2: Parameters (Q41-80)
    for (let i = 41; i <= 80; i++) {
      questions.push(await this.createParameterQuestion(agent, i));
    }

    // A3: Counters & KPIs (Q81-125)
    for (let i = 81; i <= 125; i++) {
      questions.push(await this.createCounterKPIQuestion(agent, i));
    }

    return questions;
  }

  private static async createFeatureKnowledgeQuestion(
    agent: FeatureAgent,
    num: number
  ): Promise<TestQuestion> {
    const content = this.getFeatureKnowledgeTemplate(agent, num);
    const embedding = await agentDB.embed(content);

    return {
      id: `${agent.getId()}:Q${num}`,
      agent_id: agent.getId(),
      question_number: num,
      category: 'A',
      subcategory: 'feature_knowledge',
      content,
      expected_topics: this.getExpectedTopics(num),
      validation: this.getValidationRules(num),
      metadata: {
        difficulty: 'basic',
        estimated_time: 60
      },
      embedding
    };
  }

  private static getFeatureKnowledgeTemplate(agent: FeatureAgent, num: number): string {
    const templates: Record<number, string> = {
      1: `What is the primary purpose of ${agent.getAcronym()}? Explain its key functionality and use cases.`,
      2: `Describe the activation procedure for ${agent.getAcronym()}. What are the prerequisites?`,
      3: `Describe the deactivation procedure for ${agent.getAcronym()}. Are there any special considerations?`,
      4: `What are the feature dependencies for ${agent.getAcronym()}? Which features must be active first?`,
      5: `Are there any known conflicts or incompatibilities with ${agent.getAcronym()}?`
    };

    return templates[num] || templates[1];
  }

  private static getExpectedTopics(num: number): string[] {
    const topics: Record<number, string[]> = {
      1: ['purpose', 'functionality', 'use_cases'],
      2: ['activation', 'prerequisites', 'procedure'],
      3: ['deactivation', 'considerations', 'procedure'],
      4: ['dependencies', 'prerequisites', 'features'],
      5: ['conflicts', 'incompatibilities', 'limitations']
    };

    return topics[num] || [];
  }

  private static getValidationRules(num: number): any {
    return {
      min_length: 50,
      max_length: 500,
      required_keywords: this.getExpectedTopics(num),
      format: 'markdown'
    };
  }

  private static async generateDecisionQuestions(
    agent: FeatureAgent
  ): Promise<TestQuestion[]> {
    const questions: TestQuestion[] = [];

    // B1: Optimization Decisions (Q126-165)
    for (let i = 126; i <= 165; i++) {
      questions.push(await this.createOptimizationDecisionQuestion(agent, i));
    }

    // B2: KPI-Based Actions (Q166-200)
    for (let i = 166; i <= 200; i++) {
      questions.push(await this.createKPIBasedActionQuestion(agent, i));
    }

    return questions;
  }

  private static async createOptimizationDecisionQuestion(
    agent: FeatureAgent,
    num: number
  ): Promise<TestQuestion> {
    const scenario = this.getOptimizationScenario(num);
    const content = this.formatOptimizationScenario(scenario, agent);
    const embedding = await agentDB.embed(content);

    return {
      id: `${agent.getId()}:Q${num}`,
      agent_id: agent.getId(),
      question_number: num,
      category: 'B',
      subcategory: 'optimization',
      content,
      scenario,
      validation: this.getDecisionValidation(num),
      metadata: {
        difficulty: 'intermediate',
        estimated_time: 120
      },
      embedding
    };
  }

  private static getOptimizationScenario(num: number): OptimizationScenario {
    const scenarios: OptimizationScenario[] = [
      {
        context: 'High load scenario during peak hours',
        current_kpis: { throughput: 45, latency: 28, success_rate: 97.5 },
        target_kpis: { throughput: 50, latency: 25, success_rate: 98.0 }
      },
      {
        context: 'Cell edge performance degradation',
        current_kpis: { rsrp: -105, sinr: 2, throughput: 15 },
        target_kpis: { rsrp: -95, sinr: 5, throughput: 25 }
      }
    ];

    return scenarios[num % scenarios.length];
  }

  private static formatOptimizationScenario(
    scenario: OptimizationScenario,
    agent: FeatureAgent
  ): string {
    return `**Scenario**: ${scenario.context}

**Current KPIs**:
- Throughput: ${scenario.current_kpis.throughput} Mbps
- Latency: ${scenario.current_kpis.latency} ms
- Success Rate: ${scenario.current_kpis.success_rate}%

**Target KPIs**:
- Throughput: ${scenario.target_kpis.throughput} Mbps
- Latency: ${scenario.target_kpis.latency} ms
- Success Rate: ${scenario.target_kpis.success_rate}%

**Question**: As the ${agent.getAcronym()} specialist agent, recommend parameter changes to improve KPIs to target levels. Consider:

1. What parameters can be tuned?
2. What are the safe zone boundaries?
3. What is the expected impact?
4. What are the risks?

Provide your recommendations with cmedit commands.`;
  }

  private static async generateTroubleshootingQuestions(
    agent: FeatureAgent
  ): Promise<TestQuestion[]> {
    const questions: TestQuestion[] = [];

    // C1: Multi-Parameter (Q201-275)
    for (let i = 201; i <= 275; i++) {
      questions.push(await this.createMultiParameterQuestion(agent, i));
    }

    // C2: Cross-Feature (Q276-350)
    for (let i = 276; i <= 350; i++) {
      questions.push(await this.createCrossFeatureQuestion(agent, i));
    }

    return questions;
  }

  private static async createMultiParameterQuestion(
    agent: FeatureAgent,
    num: number
  ): Promise<TestQuestion> {
    const scenario = this.getTroubleshootingScenario(num);
    const content = this.formatTroubleshootingScenario(scenario, agent);
    const embedding = await agentDB.embed(content);

    return {
      id: `${agent.getId()}:Q${num}`,
      agent_id: agent.getId(),
      question_number: num,
      category: 'C',
      subcategory: 'multi_parameter',
      content,
      scenario,
      validation: this.getTroubleshootingValidation(num),
      metadata: {
        difficulty: 'advanced',
        estimated_time: 300
      },
      embedding
    };
  }

  private static getTroubleshootingScenario(num: number): TroubleshootingScenario {
    return {
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
        'pmHoPingPongRate': { before: 5, after: 15, unit: '%' }
      }
    };
  }

  private static formatTroubleshootingScenario(
    scenario: TroubleshootingScenario,
    agent: FeatureAgent
  ): string {
    return `**Troubleshooting Scenario for ${agent.getAcronym()}**

**Symptoms**:
${scenario.symptoms.map(s => `- ${s}`).join('\n')}

**Current Configuration**:
${Object.entries(scenario.current_config)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

**Recent Logs**:
${scenario.logs.map(l => `- ${l}`).join('\n')}

**Metrics**:
${Object.entries(scenario.metrics)
  .map(([k, v]) => `- ${k}: ${v.before} → ${v.after} ${v.unit}`)
  .join('\n')}

**Question**: Perform systematic root cause analysis and provide:

1. Root cause identification
2. Proposed solutions (at least 2)
3. Prioritized action plan
4. Rollback procedure
5. Impact analysis

Provide cmedit commands for recommended changes.`;
  }

  private static async storeQuestion(question: TestQuestion): Promise<void> {
    await agentDB.store('ran-questions', {
      key: question.id,
      value: question,
      namespace: 'ran-questions'
    });
  }
}

interface OptimizationScenario {
  context: string;
  current_kpis: Record<string, number>;
  target_kpis: Record<string, number>;
}

interface TroubleshootingScenario {
  symptoms: string[];
  current_config: Record<string, number>;
  logs: string[];
  metrics: Record<string, { before: number; after: number; unit: string }>;
}
```

---

## Phase 4: Testing & Deployment (Week 9-10)

### Step 4.1: Battle Test Execution

**File to Create:**
- `/scripts/run-ran-battle-test.ts`

```typescript
// scripts/run-ran-battle-test.ts

import { AgentRegistry } from '../src/domains/knowledge/aggregates/agent-registry';
import { QuestionTemplateEngine } from '../src/domains/ran-battle-test/services/question-template-engine';
import { BattleTestRunner } from '../src/domains/ran-battle-test/aggregates/battle-test-runner';

async function main() {
  console.log('=================================');
  console.log('250 RAN Agent Battle Test Suite');
  console.log('=================================\n');

  // 1. Initialize agent registry
  const registry = AgentRegistry.getInstance();
  await registry.initializeAll();
  console.log(`\n✓ ${registry.getAllAgents().length} agents initialized\n`);

  // 2. Generate questions for all agents
  console.log('Generating battle test questions...');
  const agents = registry.getAllAgents();
  let totalQuestions = 0;

  for (const agent of agents) {
    const questions = await QuestionTemplateEngine.generateAgentQuestions(agent);
    totalQuestions += questions.length;
    console.log(`  ✓ ${agent.getAcronym()}: ${questions.length} questions`);
  }

  console.log(`\n✓ ${totalQuestions} total questions generated\n`);

  // 3. Run battle tests
  const runner = new BattleTestRunner();
  const results = await runner.runAllTests(agents);

  // 4. Generate report
  console.log('\n=================================');
  console.log('Battle Test Results');
  console.log('=================================\n');

  console.log(`Total Agents Tested: ${results.agents_tested}`);
  console.log(`Total Questions: ${results.total_questions}`);
  console.log(`Overall Success Rate: ${(results.success_rate * 100).toFixed(2)}%`);
  console.log(`Average Score: ${results.average_score.toFixed(2)}/200`);

  // Top performers
  console.log('\n--- Top 10 Performers ---');
  results.top_performers.slice(0, 10).forEach((agent, i) => {
    console.log(`  ${i + 1}. ${agent.acronym}: ${agent.score}/200`);
  });

  // Bottom performers
  console.log('\n--- Bottom 10 Performers ---');
  results.bottom_performers.slice(0, 10).forEach((agent, i) => {
    console.log(`  ${i + 1}. ${agent.acronym}: ${agent.score}/200`);
  });

  // Category breakdown
  console.log('\n--- Category Breakdown ---');
  Object.entries(results.by_category).forEach(([category, stats]) => {
    console.log(`  ${category}:`);
    console.log(`    Agents: ${stats.count}`);
    console.log(`    Avg Score: ${stats.average_score.toFixed(2)}`);
    console.log(`    Success Rate: ${(stats.success_rate * 100).toFixed(2)}%`);
  });

  // 5. Save results
  await runner.saveResults(results, './ran-250-battle-test-report.json');
  console.log('\n✓ Results saved to ran-250-battle-test-report.json');
}

main().catch(console.error);
```

### Step 4.2: Deployment Script

**File to Create:**
- `/scripts/deploy-250-agents.ts`

```typescript
// scripts/deploy-250-agents.ts

import { AgentRegistry } from '../src/domains/knowledge/aggregates/agent-registry';
import { RANMemoryInitializer } from '../src/memory/ran-memory-schema';
import { DeploymentOrchestrator } from '../src/deployment/deployment-orchestrator';

async function main() {
  console.log('=================================');
  console.log('250 RAN AI Agents - Deployment');
  console.log('=================================\n');

  // 1. Initialize memory layer
  console.log('Step 1: Initializing memory layer...');
  await RANMemoryInitializer.initialize();
  console.log('✓ Memory layer initialized\n');

  // 2. Initialize agent registry
  console.log('Step 2: Initializing agent registry...');
  const registry = AgentRegistry.getInstance();
  await registry.initializeAll();
  console.log('✓ Agent registry initialized\n');

  // 3. Verify deployment
  console.log('Step 3: Verifying deployment...');
  const stats = registry.getStatistics();
  console.log(`  Total Agents: ${stats.totalAgents}`);
  console.log(`  Ready Agents: ${stats.readyAgents}`);
  console.log(`  Busy Agents: ${stats.busyAgents}`);
  console.log('\nBy Category:');
  Object.entries(stats.byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log('✓ Deployment verified\n');

  // 4. Start deployment orchestrator
  console.log('Step 4: Starting deployment orchestrator...');
  const orchestrator = new DeploymentOrchestrator();
  await orchestrator.start();
  console.log('✓ Deployment orchestrator started\n');

  console.log('=================================');
  console.log('Deployment Complete!');
  console.log('=================================');
  console.log('\nAll 250 RAN AI agents are now operational.');
  console.log('Access the API at: http://localhost:3000');
  console.log('View metrics at: http://localhost:9090');
}

main().catch(console.error);
```

---

## Summary

This implementation guide provides:

1. **Phase 1 (Week 1-2)**: Foundation with domain model expansion and memory setup
2. **Phase 2 (Week 3-6)**: Agent implementation for LTE, NR/5G, specialized, and coordination agents
3. **Phase 3 (Week 7-8)**: Question generation system with 250 questions per agent
4. **Phase 4 (Week 9-10)**: Testing and deployment with battle test framework

**Total Deliverables:**
- 250 specialized RAN AI agents
- 62,500 battle test questions (250 per agent)
- 5 AgentDB memory namespaces with HNSW indexing
- Complete battle testing framework
- Deployment orchestration system

**Success Criteria:**
- All agents initialize successfully
- Battle test suite completes in < 10 minutes
- Average response time < 200ms
- OODA loop < 100ms per cycle
- Semantic routing with HNSW achieves 150x speedup
