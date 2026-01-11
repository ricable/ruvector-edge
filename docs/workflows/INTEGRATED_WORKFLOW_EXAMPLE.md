# 🚀 Integrated Workflow: SPARC + DDD + ADR + Goal Agent + MCP Skills

## Scenario: Building a "Neural Memory Consolidation" Feature

This detailed workflow demonstrates building a new feature using all V3 components together.

---

## 📋 Feature Overview

**Feature**: Neural Memory Consolidation for Agent Learning
**Goal**: Implement a system that periodically consolidates learned patterns from short-term to long-term memory, preventing catastrophic forgetting while optimizing retrieval performance.

---

## Phase 0: Goal Agent Planning 🎯

### Step 0.1: Initialize Goal-Oriented Planning

The Goal Agent first analyzes the high-level objective and decomposes it into actionable sub-goals.

```javascript
// The Goal Agent (GOAP) creates an optimal action plan
// Located in: .claude/agents/goal/agent.md

// Define the complex goal
const consolidationGoal = {
  objective: "Implement neural memory consolidation system",
  constraints: [
    "Must not block main agent operations",
    "Memory consolidation latency < 500ms",
    "Preserve 99.9% of high-value patterns",
    "Integrate with existing AgentDB and ReasoningBank"
  ],
  successCriteria: [
    "EWC++ algorithm implemented",
    "Background worker active",
    "Test coverage > 90%",
    "ADR documented"
  ]
};

// Goal Agent uses PageRank to prioritize actions
const prioritizedPlan = await mcp__sublinear_time_solver__pageRank({
  adjacency: buildDependencyGraph(consolidationGoal),
  damping: 0.85,
  epsilon: 1e-6
});

// Result: Prioritized action sequence
/*
1. Research existing consolidation approaches (priority: 0.95)
2. Define bounded context & domain model (priority: 0.92)
3. Create ADR for consolidation decision (priority: 0.88)
4. Design component interfaces (priority: 0.85)
5. TDD implementation (priority: 0.82)
6. Integration testing (priority: 0.78)
7. Documentation (priority: 0.75)
*/
```

### Step 0.2: Spawn Planning Swarm

```javascript
// Initialize coordinated swarm for planning phase
await mcp__claude_flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 6,
  strategy: "specialized"
});

// Spawn planning agents in parallel
const planningAgents = await Promise.all([
  mcp__claude_flow__agent_spawn({ 
    type: "researcher", 
    capabilities: ["literature_review", "pattern_analysis"] 
  }),
  mcp__claude_flow__agent_spawn({ 
    type: "ddd-domain-expert", 
    capabilities: ["bounded_context_design", "aggregate_modeling"] 
  }),
  mcp__claude_flow__agent_spawn({ 
    type: "architect", 
    capabilities: ["system_design", "interface_definition"] 
  })
]);
```

---

## Phase 1: Specification (SPARC-S) 📋

### Step 1.1: Activate Specification Agent

```javascript
// Activate SPARC Specification mode
// Agent located at: .claude/agents/sparc/specification.md
await mcp__claude_flow__sparc_mode({
  mode: "specification",
  task_description: "Define requirements for neural memory consolidation",
  options: {
    memory_enabled: true,
    learn_from_history: true
  }
});
```

### Step 1.2: Search for Similar Past Specifications (Self-Learning)

```bash
# The Specification agent's pre-hook automatically runs:
npx @claude-flow/cli@latest memory search \
  --query "memory consolidation specification" \
  --namespace patterns \
  --limit 5

# Output:
# Found 3 similar specification patterns:
# - "agentdb-memory-patterns" (reward: 0.92)
# - "reasoningbank-consolidation" (reward: 0.88)
# - "ewc-implementation-spec" (reward: 0.85)
```

### Step 1.3: Create Specification Document

```yaml
# Created specification stored in memory
specification:
  id: "SPEC-2026-001-memory-consolidation"
  title: "Neural Memory Consolidation System"
  version: "1.0.0"
  
  functional_requirements:
    - id: "FR-001"
      description: "System shall consolidate patterns from ShortTermMemory to LongTermMemory"
      priority: "critical"
      acceptance_criteria:
        - "Patterns with reward > 0.8 are preserved"
        - "Consolidation runs as background worker"
        - "Supports incremental updates"
    
    - id: "FR-002"
      description: "System shall implement EWC++ to prevent catastrophic forgetting"
      priority: "high"
      acceptance_criteria:
        - "Fisher information matrix computed per pattern"
        - "Importance weights preserved across consolidations"
        - "Forgetting rate < 0.1% for high-value patterns"
    
    - id: "FR-003"
      description: "System shall optimize HNSW index after consolidation"
      priority: "medium"
      acceptance_criteria:
        - "Index rebuilt incrementally"
        - "Search performance maintained at 150x-12500x baseline"
        - "Memory usage optimized via quantization"
  
  non_functional_requirements:
    - id: "NFR-001"
      category: "performance"
      description: "Consolidation cycle completes in < 500ms"
      measurement: "p95 latency metric"
    
    - id: "NFR-002"
      category: "reliability"
      description: "Zero data loss during consolidation"
      validation: "Checksum verification after each cycle"
  
  constraints:
    technical:
      - "Must use existing agentic-flow infrastructure"
      - "Compatible with AgentDB v2.0.0-alpha"
      - "Run within 500MB memory budget"
    
    architectural:
      - "Follow DDD patterns (bounded contexts)"
      - "Implement as background worker"
      - "Support graceful degradation"
```

### Step 1.4: Store Specification in Memory

```javascript
// Store specification for cross-agent access
await mcp__claude_flow__memory_usage({
  action: "store",
  namespace: "specifications",
  key: "SPEC-2026-001-memory-consolidation",
  value: JSON.stringify(specification),
  ttl: 86400000 * 30 // 30 days
});

// Also store in patterns namespace for future learning
await mcp__claude_flow__memory_usage({
  action: "store",
  namespace: "patterns",
  key: "spec:memory-consolidation:2026-01-11",
  value: JSON.stringify({
    type: "specification",
    task: "neural memory consolidation",
    quality_score: 0.92,
    reusable_patterns: ["ewc++", "background-worker", "hnsw-optimization"]
  })
});
```

---

## Phase 2: Architecture with DDD (SPARC-PA) 🏗️

### Step 2.1: Activate DDD Domain Expert

```javascript
// Activate DDD Domain Expert agent
// Agent located at: .claude/agents/v3/ddd-domain-expert.md
await mcp__claude_flow__agent_spawn({
  type: "ddd-domain-expert",
  capabilities: [
    "bounded_context_design",
    "aggregate_modeling",
    "domain_event_design",
    "anti_corruption_layer"
  ]
});
```

### Step 2.2: DDD Pre-Hook Executes

```bash
# The DDD agent's pre-hook automatically runs:
echo "🏛️ DDD Domain Expert analyzing domain model"

# Search for existing domain patterns
npx @claude-flow/cli@latest memory search \
  --pattern "ddd:*" \
  --namespace architecture \
  --limit 10

# Load existing domain context
npx @claude-flow/cli@latest memory retrieve \
  --namespace architecture \
  --key "domain:model"
```

### Step 2.3: Define Bounded Context

```typescript
// Bounded Context: Memory Consolidation (Supporting Domain)
// This context supports the Core Domain (Swarm Coordination)

interface BoundedContext {
  name: "MemoryConsolidation";
  type: "supporting";
  responsibility: "Pattern preservation and memory optimization";
  
  // Context relationships
  upstream: ["AgentLifecycle", "TaskExecution"];
  downstream: ["NeuralLearning"];
  
  // Anti-corruption layers
  acl: {
    agentDB: "MemoryRepositoryAdapter",
    reasoningBank: "PatternRepositoryAdapter"
  };
}
```

### Step 2.4: Design Aggregates

```typescript
// Aggregate Root: ConsolidationSession
// Ensures transactional consistency for consolidation operations

class ConsolidationSession {
  private readonly id: ConsolidationSessionId;
  private status: ConsolidationStatus;
  private patterns: PatternCollection;
  private fisherMatrix: FisherInformationMatrix;
  private checkpoint: ConsolidationCheckpoint;
  
  // Domain Events
  raise(event: ConsolidationStarted | PatternConsolidated | ConsolidationCompleted): void;
  
  // Invariants enforced here
  startConsolidation(): void;
  consolidatePattern(pattern: LearnedPattern): ConsolidationResult;
  completeWith(summary: ConsolidationSummary): void;
}

// Value Objects
class ConsolidationSessionId {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) throw new InvalidSessionIdError();
  }
}

class ImportanceWeight {
  constructor(private readonly value: number) {
    if (value < 0 || value > 1) throw new InvalidWeightError();
  }
  
  // Immutable - operations return new instances
  decay(factor: number): ImportanceWeight {
    return new ImportanceWeight(this.value * factor);
  }
}

// Entity
class LearnedPattern {
  constructor(
    private readonly id: PatternId,
    private embedding: Float32Array,
    private importanceWeight: ImportanceWeight,
    private lastConsolidated: Date
  ) {}
  
  shouldConsolidate(threshold: number): boolean {
    return this.importanceWeight.value >= threshold;
  }
}
```

### Step 2.5: Define Domain Events

```typescript
// Domain Events for Event Sourcing
interface ConsolidationStarted {
  type: 'ConsolidationStarted';
  sessionId: string;
  patternCount: number;
  strategy: 'ewc++' | 'selective' | 'full';
  timestamp: Date;
}

interface PatternConsolidated {
  type: 'PatternConsolidated';
  sessionId: string;
  patternId: string;
  previousWeight: number;
  newWeight: number;
  fisherDiagonal: number[];
  timestamp: Date;
}

interface ConsolidationCompleted {
  type: 'ConsolidationCompleted';
  sessionId: string;
  patternsConsolidated: number;
  patternsDiscarded: number;
  memoryReclaimed: number; // bytes
  duration: number; // ms
  timestamp: Date;
}
```

### Step 2.6: Store Domain Model

```javascript
// Store domain model in memory for other agents
await mcp__claude_flow__memory_usage({
  action: "store",
  namespace: "architecture",
  key: "ddd:consolidation:domain-model",
  value: JSON.stringify({
    boundedContext: "MemoryConsolidation",
    aggregates: [
      { name: "ConsolidationSession", type: "aggregate-root" },
      { name: "LearnedPattern", type: "entity" },
      { name: "ImportanceWeight", type: "value-object" }
    ],
    domainEvents: [
      "ConsolidationStarted",
      "PatternConsolidated",
      "ConsolidationCompleted"
    ],
    repositories: [
      "PatternRepository",
      "ConsolidationSessionRepository"
    ],
    domainServices: [
      "EWCConsolidationService",
      "HNSWOptimizationService"
    ]
  })
});
```

### Step 2.7: Track DDD Progress

```bash
# The DDD tracker helper automatically updates progress
./.claude/helpers/ddd-tracker.sh run

# Output:
# [00:28:45] Tracking DDD progress...
# [00:28:45] ✓ DDD: 72% | Domains: 4/5 | Entities: 15 | Services: 10
```

---

## Phase 3: ADR Documentation 📝

### Step 3.1: Create Architecture Decision Record

```markdown
# ADR-023: Memory Consolidation Strategy

## Status
Accepted

## Context
The Agent Swarm system accumulates learned patterns in ShortTermMemory
during operation. Without consolidation, this leads to:
- Memory pressure (exceeding 500MB budget)
- Degraded retrieval performance (HNSW index bloat)
- Pattern conflicts and redundancy
- Catastrophic forgetting when patterns are pruned

We need a systematic approach to consolidate valuable patterns while
discarding low-value ones, without disrupting ongoing agent operations.

## Decision
We will implement Elastic Weight Consolidation++ (EWC++) as the 
consolidation strategy, running as a background worker that:

1. **Triggers**: Every 2 hours OR when memory usage > 80% budget
2. **Selection**: Consolidate patterns with importance_weight > 0.8
3. **Algorithm**: EWC++ with Fisher Information Matrix diagonal
4. **Integration**: Incremental HNSW index optimization post-consolidation

### Why EWC++ over alternatives:
- **vs. Full Replay**: 10x lower memory overhead
- **vs. Selective Forgetting**: Preserves pattern relationships
- **vs. Distillation**: Works with existing embedding format

## Consequences

### Positive
- Memory usage stays within 500MB budget
- Retrieval performance maintained (150x-12500x speedup)
- High-value patterns preserved (99.9% retention)
- Non-blocking background operation

### Negative
- Additional complexity (Fisher matrix computation)
- 2-5% CPU overhead during consolidation cycles
- Requires careful tuning of importance thresholds

### Risks
- Consolidation may take >500ms for large pattern sets
- Mitigation: Batch processing with checkpointing

## Related
- ADR-006: Unified Memory Service
- ADR-017: RuVector Integration
- SPEC-2026-001: Memory Consolidation Specification
```

### Step 3.2: Store ADR and Check Compliance

```bash
# Store ADR in memory
npx @claude-flow/cli@latest memory store \
  --namespace adr \
  --key "ADR-023-memory-consolidation-strategy" \
  --value "$(cat docs/adr/ADR-023-memory-consolidation-strategy.md)"

# Run ADR compliance checker
./.claude/helpers/adr-compliance.sh run

# Output:
# [00:29:12] Checking ADR compliance...
# [00:29:12] ✓ ADR Compliance: 82% | Compliant: 9/11
```

---

## Phase 4: TDD Implementation (SPARC-R) 🧪

### Step 4.1: Initialize TDD Swarm

```javascript
// Initialize TDD-focused swarm
await mcp__claude_flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 8,
  strategy: "specialized"
});

// Spawn TDD agents in parallel
Task({ 
  prompt: "Write failing tests for ConsolidationSession aggregate",
  subagent_type: "tester",
  run_in_background: true
});

Task({
  prompt: "Write failing tests for EWCConsolidationService",
  subagent_type: "tester", 
  run_in_background: true
});

Task({
  prompt: "Write failing tests for HNSWOptimizationService",
  subagent_type: "tester",
  run_in_background: true
});
```

### Step 4.2: RED Phase - Write Failing Tests

```typescript
// tests/domains/memory-consolidation/consolidation-session.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ConsolidationSession } from '@/domains/memory-consolidation/domain';

describe('ConsolidationSession Aggregate', () => {
  let session: ConsolidationSession;
  
  beforeEach(() => {
    session = ConsolidationSession.create({
      strategy: 'ewc++',
      threshold: 0.8
    });
  });
  
  describe('startConsolidation', () => {
    it('should raise ConsolidationStarted event', () => {
      const events = session.startConsolidation();
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ConsolidationStarted');
      expect(events[0].strategy).toBe('ewc++');
    });
    
    it('should reject if already started', () => {
      session.startConsolidation();
      
      expect(() => session.startConsolidation())
        .toThrow('Consolidation already in progress');
    });
  });
  
  describe('consolidatePattern', () => {
    it('should preserve high-importance patterns', () => {
      session.startConsolidation();
      
      const pattern = createPattern({ importanceWeight: 0.95 });
      const result = session.consolidatePattern(pattern);
      
      expect(result.preserved).toBe(true);
      expect(result.newWeight).toBeGreaterThanOrEqual(0.9);
    });
    
    it('should discard low-importance patterns', () => {
      session.startConsolidation();
      
      const pattern = createPattern({ importanceWeight: 0.3 });
      const result = session.consolidatePattern(pattern);
      
      expect(result.preserved).toBe(false);
    });
    
    it('should compute Fisher diagonal for EWC++', () => {
      session.startConsolidation();
      
      const pattern = createPattern({ 
        importanceWeight: 0.9,
        embedding: new Float32Array([0.1, 0.2, 0.3, 0.4])
      });
      const result = session.consolidatePattern(pattern);
      
      expect(result.fisherDiagonal).toBeDefined();
      expect(result.fisherDiagonal.length).toBe(4);
    });
  });
  
  describe('completeWith', () => {
    it('should raise ConsolidationCompleted event with summary', () => {
      session.startConsolidation();
      session.consolidatePattern(createPattern({ importanceWeight: 0.9 }));
      session.consolidatePattern(createPattern({ importanceWeight: 0.2 }));
      
      const events = session.completeWith({
        patternsProcessed: 2,
        memoryReclaimed: 1024
      });
      
      expect(events[0].type).toBe('ConsolidationCompleted');
      expect(events[0].patternsConsolidated).toBe(1);
      expect(events[0].patternsDiscarded).toBe(1);
    });
  });
});
```

### Step 4.3: Run Tests (All Failing - RED)

```bash
# Run the tests - they should fail
bun test tests/domains/memory-consolidation/

# Output:
# ❌ FAIL tests/domains/memory-consolidation/consolidation-session.test.ts
#    ❌ should raise ConsolidationStarted event
#    ❌ should reject if already started
#    ❌ should preserve high-importance patterns
#    ❌ should discard low-importance patterns
#    ❌ should compute Fisher diagonal for EWC++
#    ❌ should raise ConsolidationCompleted event with summary
#
# Tests: 6 failed, 0 passed
```

### Step 4.4: GREEN Phase - Implement Minimum Code

```typescript
// src/domains/memory-consolidation/domain/consolidation-session.ts
import { v4 as uuid } from 'uuid';
import { DomainEvent, AggregateRoot } from '@/shared/domain';
import { 
  ConsolidationStarted, 
  PatternConsolidated, 
  ConsolidationCompleted 
} from './events';
import { LearnedPattern, ImportanceWeight } from './value-objects';
import { ConsolidationResult, ConsolidationSummary } from './types';

export type ConsolidationStrategy = 'ewc++' | 'selective' | 'full';
export type ConsolidationStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface ConsolidationConfig {
  strategy: ConsolidationStrategy;
  threshold: number;
}

export class ConsolidationSession extends AggregateRoot {
  private readonly id: string;
  private status: ConsolidationStatus = 'pending';
  private readonly strategy: ConsolidationStrategy;
  private readonly threshold: number;
  private consolidatedCount = 0;
  private discardedCount = 0;
  private startTime?: Date;
  
  private constructor(config: ConsolidationConfig) {
    super();
    this.id = uuid();
    this.strategy = config.strategy;
    this.threshold = config.threshold;
  }
  
  static create(config: ConsolidationConfig): ConsolidationSession {
    return new ConsolidationSession(config);
  }
  
  startConsolidation(): DomainEvent[] {
    if (this.status !== 'pending') {
      throw new Error('Consolidation already in progress');
    }
    
    this.status = 'in_progress';
    this.startTime = new Date();
    
    const event: ConsolidationStarted = {
      type: 'ConsolidationStarted',
      sessionId: this.id,
      patternCount: 0, // Will be updated
      strategy: this.strategy,
      timestamp: this.startTime
    };
    
    return [event];
  }
  
  consolidatePattern(pattern: LearnedPattern): ConsolidationResult {
    if (this.status !== 'in_progress') {
      throw new Error('Consolidation not started');
    }
    
    const shouldPreserve = pattern.shouldConsolidate(this.threshold);
    
    if (shouldPreserve) {
      this.consolidatedCount++;
      
      // Compute Fisher Information diagonal for EWC++
      const fisherDiagonal = this.computeFisherDiagonal(pattern);
      const newWeight = this.computeNewWeight(pattern, fisherDiagonal);
      
      return {
        preserved: true,
        newWeight,
        fisherDiagonal
      };
    } else {
      this.discardedCount++;
      return {
        preserved: false,
        newWeight: 0,
        fisherDiagonal: []
      };
    }
  }
  
  completeWith(summary: Partial<ConsolidationSummary>): DomainEvent[] {
    if (this.status !== 'in_progress') {
      throw new Error('Cannot complete - consolidation not in progress');
    }
    
    this.status = 'completed';
    const endTime = new Date();
    const duration = endTime.getTime() - (this.startTime?.getTime() || 0);
    
    const event: ConsolidationCompleted = {
      type: 'ConsolidationCompleted',
      sessionId: this.id,
      patternsConsolidated: this.consolidatedCount,
      patternsDiscarded: this.discardedCount,
      memoryReclaimed: summary.memoryReclaimed || 0,
      duration,
      timestamp: endTime
    };
    
    return [event];
  }
  
  private computeFisherDiagonal(pattern: LearnedPattern): number[] {
    // EWC++ Fisher Information Matrix diagonal approximation
    // F_ii ≈ (∂L/∂θ_i)²
    const embedding = pattern.embedding;
    return Array.from(embedding).map(v => v * v);
  }
  
  private computeNewWeight(pattern: LearnedPattern, fisher: number[]): number {
    // Apply importance decay with Fisher regularization
    const fisherMean = fisher.reduce((a, b) => a + b, 0) / fisher.length;
    const decayFactor = Math.max(0.9, 1 - (1 - pattern.importanceWeight.value) * 0.1);
    return Math.min(1, pattern.importanceWeight.value * decayFactor + fisherMean * 0.01);
  }
}
```

### Step 4.5: Run Tests (All Passing - GREEN)

```bash
# Run the tests - they should pass now
bun test tests/domains/memory-consolidation/

# Output:
# ✓ PASS tests/domains/memory-consolidation/consolidation-session.test.ts
#    ✓ should raise ConsolidationStarted event (2ms)
#    ✓ should reject if already started (1ms)
#    ✓ should preserve high-importance patterns (3ms)
#    ✓ should discard low-importance patterns (1ms)
#    ✓ should compute Fisher diagonal for EWC++ (2ms)
#    ✓ should raise ConsolidationCompleted event with summary (2ms)
#
# Tests: 6 passed, 0 failed
# Coverage: 94.2%
```

### Step 4.6: REFACTOR Phase

```typescript
// Extract EWC++ computation to dedicated domain service
// src/domains/memory-consolidation/domain/services/ewc-consolidation.service.ts

export class EWCConsolidationService {
  private readonly regularizationLambda: number;
  
  constructor(config: { lambda?: number } = {}) {
    this.regularizationLambda = config.lambda ?? 0.4;
  }
  
  computeFisherDiagonal(embedding: Float32Array): Float32Array {
    // Diagonal Fisher Information Matrix approximation
    // F_ii ≈ E[(∂log p(x|θ)/∂θ_i)²]
    const fisher = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      fisher[i] = embedding[i] * embedding[i];
    }
    return fisher;
  }
  
  computeEWCLoss(
    currentWeights: Float32Array,
    optimalWeights: Float32Array,
    fisher: Float32Array
  ): number {
    // L_EWC = L_new + (λ/2) * Σ F_i * (θ_i - θ*_i)²
    let ewcPenalty = 0;
    for (let i = 0; i < currentWeights.length; i++) {
      const diff = currentWeights[i] - optimalWeights[i];
      ewcPenalty += fisher[i] * diff * diff;
    }
    return (this.regularizationLambda / 2) * ewcPenalty;
  }
  
  consolidateWithEWC(
    pattern: LearnedPattern,
    threshold: number
  ): ConsolidationResult {
    if (!pattern.shouldConsolidate(threshold)) {
      return { preserved: false, newWeight: 0, fisherDiagonal: [] };
    }
    
    const fisher = this.computeFisherDiagonal(pattern.embedding);
    const fisherMean = fisher.reduce((a, b) => a + b, 0) / fisher.length;
    
    // Apply importance preservation with EWC regularization
    const decayFactor = 1 - (1 - pattern.importanceWeight.value) * 0.05;
    const newWeight = Math.min(1, 
      pattern.importanceWeight.value * decayFactor + 
      Math.tanh(fisherMean) * 0.02 // Fisher contribution
    );
    
    return {
      preserved: true,
      newWeight,
      fisherDiagonal: Array.from(fisher)
    };
  }
}
```

---

## Phase 5: Background Worker Integration 🔄

### Step 5.1: Create Consolidation Worker

```typescript
// src/domains/memory-consolidation/infrastructure/consolidation.worker.ts
import { EventEmitter } from 'events';
import { ConsolidationSession } from '../domain/consolidation-session';
import { EWCConsolidationService } from '../domain/services/ewc-consolidation.service';
import { PatternRepository } from '../domain/repositories/pattern.repository';
import { ConsolidationMetrics } from './metrics';

interface WorkerConfig {
  intervalMs: number;  // 2 hours default
  memoryThreshold: number;  // 0.8 = 80%
  batchSize: number;  // 100 patterns per batch
}

export class ConsolidationWorker extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly ewcService: EWCConsolidationService;
  private readonly patternRepo: PatternRepository;
  private readonly metrics: ConsolidationMetrics;
  
  constructor(
    private readonly config: WorkerConfig,
    dependencies: {
      ewcService: EWCConsolidationService;
      patternRepo: PatternRepository;
      metrics: ConsolidationMetrics;
    }
  ) {
    super();
    this.ewcService = dependencies.ewcService;
    this.patternRepo = dependencies.patternRepo;
    this.metrics = dependencies.metrics;
  }
  
  start(): void {
    if (this.timer) return;
    
    console.log('[ConsolidationWorker] Starting background consolidation');
    
    // Schedule periodic consolidation
    this.timer = setInterval(
      () => this.runConsolidationCycle(),
      this.config.intervalMs
    );
    
    // Also trigger on memory pressure
    this.setupMemoryPressureHandler();
    
    this.emit('started');
  }
  
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit('stopped');
  }
  
  async runConsolidationCycle(): Promise<void> {
    if (this.isRunning) {
      console.log('[ConsolidationWorker] Cycle already in progress, skipping');
      return;
    }
    
    this.isRunning = true;
    const startTime = performance.now();
    
    try {
      const session = ConsolidationSession.create({
        strategy: 'ewc++',
        threshold: 0.8
      });
      
      // Start consolidation
      const startEvents = session.startConsolidation();
      this.emit('consolidation:started', startEvents[0]);
      
      // Process patterns in batches
      let offset = 0;
      let totalProcessed = 0;
      
      while (true) {
        const patterns = await this.patternRepo.findBatch(
          offset, 
          this.config.batchSize
        );
        
        if (patterns.length === 0) break;
        
        for (const pattern of patterns) {
          const result = session.consolidatePattern(pattern);
          
          if (!result.preserved) {
            await this.patternRepo.remove(pattern.id);
          } else {
            await this.patternRepo.updateWeight(pattern.id, result.newWeight);
          }
          
          totalProcessed++;
        }
        
        offset += this.config.batchSize;
        
        // Checkpoint for long-running consolidations
        if (totalProcessed % 500 === 0) {
          await this.saveCheckpoint(session, offset);
        }
      }
      
      // Complete consolidation
      const completeEvents = session.completeWith({
        patternsProcessed: totalProcessed,
        memoryReclaimed: await this.calculateReclaimedMemory()
      });
      
      this.emit('consolidation:completed', completeEvents[0]);
      
      // Record metrics
      const duration = performance.now() - startTime;
      this.metrics.recordCycle({
        duration,
        patternsProcessed: totalProcessed,
        success: true
      });
      
      console.log(`[ConsolidationWorker] Cycle complete: ${totalProcessed} patterns in ${duration.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('[ConsolidationWorker] Cycle failed:', error);
      this.metrics.recordCycle({ success: false });
      this.emit('consolidation:failed', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  private setupMemoryPressureHandler(): void {
    // Check memory usage periodically
    setInterval(async () => {
      const usage = await this.getMemoryUsageRatio();
      if (usage > this.config.memoryThreshold) {
        console.log(`[ConsolidationWorker] Memory pressure detected: ${(usage * 100).toFixed(1)}%`);
        await this.runConsolidationCycle();
      }
    }, 60000); // Check every minute
  }
  
  private async getMemoryUsageRatio(): Promise<number> {
    const used = process.memoryUsage().heapUsed;
    const budget = 500 * 1024 * 1024; // 500MB budget
    return used / budget;
  }
  
  private async saveCheckpoint(session: ConsolidationSession, offset: number): Promise<void> {
    // Implementation for checkpointing
  }
  
  private async calculateReclaimedMemory(): Promise<number> {
    // Implementation for memory calculation
    return 0;
  }
}
```

### Step 5.2: Register Worker with Daemon

```bash
# Register the consolidation worker with claude-flow daemon
npx @claude-flow/cli@latest hooks worker dispatch \
  --trigger consolidate \
  --config '{"intervalMs": 7200000, "memoryThreshold": 0.8}'

# Verify worker is registered
npx @claude-flow/cli@latest hooks worker list

# Output:
# Background Workers:
# ├── consolidate (priority: low, interval: 2h) ✓ registered
# ├── optimize (priority: high, interval: 30m) ✓ active
# ├── audit (priority: critical, interval: 1h) ✓ active
# └── ultralearn (priority: normal, interval: 1h) ✓ active
```

---

## Phase 6: Integration & Testing 🔗

### Step 6.1: Integration Test

```typescript
// tests/integration/memory-consolidation.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConsolidationWorker } from '@/domains/memory-consolidation/infrastructure';
import { AgentDBAdapter } from '@/infrastructure/agentdb';
import { createTestPatterns } from '../fixtures/patterns';

describe('Memory Consolidation Integration', () => {
  let worker: ConsolidationWorker;
  let agentDB: AgentDBAdapter;
  
  beforeAll(async () => {
    agentDB = await AgentDBAdapter.create({ inMemory: true });
    worker = new ConsolidationWorker(
      { intervalMs: 1000, memoryThreshold: 0.5, batchSize: 10 },
      { ewcService: new EWCConsolidationService(), patternRepo: agentDB, metrics: new MockMetrics() }
    );
  });
  
  afterAll(async () => {
    worker.stop();
    await agentDB.close();
  });
  
  it('should consolidate patterns with EWC++ algorithm', async () => {
    // Seed test patterns
    const patterns = createTestPatterns(50, { 
      highValueRatio: 0.6,  // 60% high-value patterns
      embeddingDim: 128 
    });
    await agentDB.bulkInsert(patterns);
    
    // Run consolidation
    await worker.runConsolidationCycle();
    
    // Verify results
    const remaining = await agentDB.count();
    expect(remaining).toBe(30); // 60% of 50 preserved
    
    // Verify high-value patterns preserved
    const highValuePattern = patterns.find(p => p.importanceWeight > 0.9);
    const retrieved = await agentDB.findById(highValuePattern.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.importanceWeight).toBeGreaterThanOrEqual(0.85);
  });
  
  it('should complete consolidation within 500ms target', async () => {
    const patterns = createTestPatterns(1000);
    await agentDB.bulkInsert(patterns);
    
    const start = performance.now();
    await worker.runConsolidationCycle();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
  
  it('should emit domain events during consolidation', async () => {
    const events: any[] = [];
    worker.on('consolidation:started', e => events.push(e));
    worker.on('consolidation:completed', e => events.push(e));
    
    await worker.runConsolidationCycle();
    
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('ConsolidationStarted');
    expect(events[1].type).toBe('ConsolidationCompleted');
  });
});
```

### Step 6.2: Run Full Test Suite

```bash
# Run all tests with coverage
bun test --coverage

# Output:
# ✓ tests/domains/memory-consolidation/consolidation-session.test.ts (6 tests)
# ✓ tests/domains/memory-consolidation/ewc-service.test.ts (8 tests)
# ✓ tests/integration/memory-consolidation.integration.test.ts (3 tests)
#
# Coverage:
# ├── consolidation-session.ts: 96.4%
# ├── ewc-consolidation.service.ts: 94.1%
# ├── consolidation.worker.ts: 91.2%
# └── Overall: 93.8%
#
# Tests: 17 passed, 0 failed
```

---

## Phase 7: Documentation & Completion (SPARC-C) 📚

### Step 7.1: Store Learned Patterns

```javascript
// Store successful implementation patterns for future learning
await mcp__claude_flow__memory_usage({
  action: "store",
  namespace: "patterns",
  key: "impl:memory-consolidation:ewc++:2026-01-11",
  value: JSON.stringify({
    type: "implementation",
    task: "neural memory consolidation with EWC++",
    quality_score: 0.94,
    test_coverage: 93.8,
    performance: { p95_latency_ms: 387 },
    reusable_patterns: [
      "background-worker-with-checkpointing",
      "ddd-aggregate-with-domain-events",
      "ewc++-fisher-diagonal-approximation",
      "batch-processing-with-memory-pressure"
    ],
    learnings: [
      "Fisher diagonal approximation is sufficient for pattern consolidation",
      "Checkpointing every 500 patterns prevents data loss",
      "Memory pressure trigger prevents OOM conditions"
    ]
  })
});

// Train neural patterns on the successful approach
await npx @claude-flow/cli@latest neural train \
  --pattern-type coordination \
  --training-data memory-consolidation-success \
  --epochs 50
```

### Step 7.2: Final ADR Compliance Check

```bash
# Run full compliance checks
./.claude/helpers/adr-compliance.sh force
./.claude/helpers/ddd-tracker.sh force

# Output:
# [00:32:45] Checking ADR compliance...
# [00:32:45] ✓ ADR Compliance: 92% | Compliant: 10/11
#
# [00:32:46] Tracking DDD progress...
# [00:32:46] ✓ DDD: 78% | Domains: 4/5 | Entities: 16 | Services: 11
```

### Step 7.3: Store Session Summary

```javascript
// End session with learning export
await npx @claude-flow/cli@latest hooks session-end \
  --generate-summary true \
  --persist-state true \
  --export-metrics true

// Session summary stored:
// {
//   "sessionId": "session-2026-01-11-001",
//   "duration": "4h 12m",
//   "tasks_completed": 17,
//   "agents_spawned": 8,
//   "patterns_learned": 12,
//   "test_coverage": 93.8,
//   "adr_compliance": 92,
//   "ddd_progress": 78
// }
```

---

## 📊 Workflow Summary

| Phase | Components Used | Outputs |
|-------|----------------|---------|
| **0. Planning** | Goal Agent, PageRank | Prioritized action plan |
| **1. Specification** | SPARC-S, Memory | Requirements doc |
| **2. Architecture** | DDD Expert, Memory | Domain model |
| **3. Decisions** | ADR, Compliance Check | ADR-023 |
| **4. Implementation** | SPARC-R, TDD | Tested code (93.8%) |
| **5. Integration** | Worker, Daemon | Background service |
| **6. Testing** | Integration tests | Validated feature |
| **7. Documentation** | Neural training | Learned patterns |

---

## 🔑 Key Takeaways

1. **Goal Agent** plans the optimal sequence using sublinear optimization
2. **SPARC** provides the methodology structure (S→P→A→R→C)
3. **DDD** organizes code into bounded contexts with aggregates
4. **ADR** documents architectural decisions with compliance tracking
5. **MCP Skills** execute all operations via claude-flow tools
6. **Memory** persists patterns across sessions for learning
7. **Hooks** automate pre/post actions for self-improvement
