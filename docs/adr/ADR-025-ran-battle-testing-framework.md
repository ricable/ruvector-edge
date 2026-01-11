# ADR-025: RAN Feature Agent Battle Testing Framework

## Status
Accepted

## Context
The RAN Feature Agent system creates 50 specialized AI agents for 4G LTE features. To validate agent competence, we need:

1. **Question Bank**: 250 technical questions (5 per feature)
2. **Scoring System**: Quantitative assessment of agent performance
3. **Battle Test Mode**: Competitive evaluation between agents
4. **OODA Loop Validation**: Test autonomous decision-making capabilities
5. **Q-Learning Verification**: Ensure agents learn from interactions

Current challenges:
- No standardized way to measure agent expertise
- Manual testing is time-consuming for 50 agents
- Need to compare performance across agents
- Must validate autonomous state machine (ADR-024) integration
- Require objective scoring for Q-learning convergence

## Decision
We create a **RAN Battle Testing Framework** that:

### Test Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAN BATTLE TEST FRAMEWORK                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     QUESTION BANK (250 Qs)                          │    │
│  │  Category A: Knowledge (Q1-125)  │  Category B: Decision (126-200) │    │
│  │  Category C: Advanced (Q201-250) │                                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    BATTLE TEST ORCHESTRATOR                         │    │
│  │  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐       │    │
│  │  │ Query Router   │  │ Test Runner  │  │ Score Calculator   │       │    │
│  │  └────────────────┘  └──────────────┘  └────────────────────┘       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     50 FEATURE AGENTS                               │    │
│  │  MSM │ P │ D-PUCCH │ ... │ 4QADPP │ MC-PUSCH                       │    │
│  │  └─AutonomousStateMachine (OODA + Q-Learning)                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      SCORING & REPORTING                            │    │
│  │  - Knowledge Score (0-40/feature)                                   │    │
│  │  - OODA Efficiency (+20 bonus)                                      │    │
│  │  - Q-Learning Convergence (+20 bonus)                               │    │
│  │  - Cross-Feature Coordination (+20 bonus)                           │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Question Categories

| Category | Questions | Points | Test Type |
|----------|-----------|--------|-----------|
| A: Knowledge Retrieval | Q1-Q125 | 40 points/feature | Feature knowledge, parameters, counters |
| B: Decision Making | Q126-Q200 | 60 points/feature | Optimization decisions, KPI-based actions |
| C: Advanced Troubleshooting | Q201-Q250 | 60 points/feature | Multi-parameter, cross-feature |

### Scoring Formula

```typescript
// Per-feature score (0-200 points)
featureScore = (
  knowledgeScore * 0.4 +      // 80 points max
  decisionScore * 0.3 +       // 60 points max
  advancedScore * 0.3         // 60 points max
) + (
  oodaEfficiency ? 20 : 0 +
  qLearningConverged ? 20 : 0 +
  crossFeatureCoordination ? 20 : 0
);

// Overall system score (0-10,000 points)
totalScore = sum(featureScores) / 50 * 100;
```

### Test Execution Modes

1. **Solo Test**: Single agent answers all 5 questions for its feature
2. **Battle Mode**: Multiple agents compete on the same question
3. **Stress Test**: Agent answers questions from all 50 features
4. **OODA Validation**: Record and analyze OODA loop execution

### Domain Structure

```
ran-battle-test/
  entities/
    TestQuestion.ts         # Question entity with metadata
    TestSession.ts          # Test execution session
    TestResult.ts           # Individual result
  value-objects/
    QuestionCategory.ts     # A/B/C category
    Score.ts                # Calculated score
    TestMetrics.ts          # Performance metrics
  aggregates/
    BattleTest.ts           # Test orchestrator
    QuestionBank.ts         # Question management
  repositories/
    QuestionRepository.ts   # Question storage (AgentDB)
    ResultRepository.ts     # Result storage
  services/
    TestRunner.ts           # Test execution
    ScoreCalculator.ts      # Scoring logic
    OODAAnalyzer.ts         # OODA loop analysis
```

### Integration with Existing Systems

| Component | Integration Point |
|-----------|-------------------|
| EnhancedFeatureAgent | Direct query via `handleQueryEnhanced()` |
| AutonomousStateMachine | OODA loop recording via `runOODALoop()` |
| AgentDB (Memory) | Question storage with HNSW indexing |
| Q-Table | Learning verification via `getConfidence()` |

## Alternatives Considered

### Manual Testing
- **Pros**: Full control, detailed feedback
- **Cons**: Not scalable to 50 agents, subjective scoring
- **Rejected**: Cannot test 250 questions manually in reasonable time

### Simple Q&A Bot
- **Pros**: Easy to implement, fast
- **Cons**: Doesn't test OODA loop, no Q-learning validation
- **Rejected**: Fails to validate autonomous capabilities

### Human Evaluation Only
- **Pros**: Most accurate assessment
- **Cons**: Requires domain experts, expensive, slow
- **Rejected**: Not feasible for 250 questions

### LLM-as-Judge
- **Pros**: Scalable, automated
- **Cons**: May have bias, requires careful prompting
- **Partial**: Used for supplementary scoring, not primary assessment

## Consequences

### Positive
- **Objective Measurement**: Quantitative scores enable comparison
- **Automated**: Run tests continuously without manual intervention
- **OODA Validation**: Explicitly test autonomous decision-making
- **Learning Verification**: Q-learning convergence becomes measurable
- **Scalable**: Easy to add new questions or features
- **Regression Detection**: Score drops indicate issues

### Negative
- **Question Maintenance**: 250 questions require ongoing updates
- **False Confidence**: Agents may memorize answers without understanding
- **Test Data Leaks**: Training on test questions invalidates results
- **Scoring Complexity**: Multiple scoring dimensions add complexity

### Risks
- **Overfitting**: Agents optimize for test questions at expense of general knowledge
- **Stale Questions**: Ericsson feature updates may make questions obsolete
- **OODA Gaming**: Agents may exploit scoring patterns
- **Q-Learning Stagnation**: Low exploration rate prevents learning

### Mitigations
- **Question Rotation**: Maintain 500+ questions, test on random 250
- **Adversarial Testing**: Include edge cases and rare scenarios
- **OODA Logging**: Full trace for manual review of anomalies
- **Exploration Monitoring**: Alert if exploration rate falls below threshold
- **Quarterly Updates**: Refresh questions based on Ericsson releases

## Implementation Requirements

1. **Question Storage**: AgentDB with HNSW indexing (ran-battle-questions namespace)
2. **Test Runner**: Execute tests sequentially or in parallel
3. **Score Calculator**: Compute all scoring dimensions
4. **OODA Analyzer**: Parse and validate OODA loop execution
5. **Reporter**: Generate test results and leaderboards

## Success Metrics

- **Coverage**: All 50 agents tested with 250 questions
- **Speed**: Full test suite completes in < 10 minutes
- **Accuracy**: Scores correlate with human evaluation (>0.8)
- **Learning**: Q-learning confidence increases over time
- **OODA Efficiency**: Average OODA loop < 100ms

## References
- ADR-004: One Agent Per Feature Specialization
- ADR-024: Autonomous State Machine
- ADR-107: Domain-Driven Design Structure
- ADR-108: Ericsson Feature Ontology Integration
- docs/ran-250-questions.md
- src/domains/knowledge/aggregates/enhanced-feature-agent.ts
