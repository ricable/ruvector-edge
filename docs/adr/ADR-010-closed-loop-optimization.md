# ADR-010: Closed-Loop Optimization Cycle

## Status
Accepted

## Context
Traditional RAN optimization is open-loop:
1. Engineer observes KPI degradation
2. Manual root cause analysis (days to weeks)
3. Parameter change implemented
4. Wait and observe (no systematic feedback)
5. Repeat if needed

This approach is:
- **Slow:** Weeks from detection to resolution
- **Incomplete:** No systematic learning from outcomes
- **Resource intensive:** Requires expert engineers
- **Reactive:** Only responds after problems manifest

ELEX must transform this into a continuous, autonomous optimization engine that:
- Detects issues proactively (before KPI degradation)
- Identifies root causes automatically
- Implements changes safely
- Learns from every outcome

## Decision
We implement a **6-phase closed-loop optimization cycle**:

### Phase 1: Observe
- Collect KPIs at multiple spatio-temporal granularities
- Monitor counters, alarms, and configurations
- Spatial levels: Cell -> Sector -> Node -> Cluster -> Network
- Temporal levels: 15min -> 1hr -> 4hr -> 24hr -> 7day

### Phase 2: Analyze
- Detect anomalies and trends
- Identify root causes via counter investigation
- Compute integrity score using Min-Cut analysis
- Correlate counter changes with KPI deltas

### Phase 3: Decide
- Route to appropriate feature agents
- Gather recommendations from specialists
- Assess risk level: LOW / MEDIUM / HIGH
- Apply approval logic (auto vs manual)

### Phase 4: Act
- Generate cmedit commands with validation
- Create rollback point before execution
- Execute changes within safe zones
- Set 30-minute observation timer

### Phase 5: Learn
- Measure KPI delta after change
- Update Q-table with reward signal
- Record trajectory in replay buffer
- Trigger automatic rollback if KPIs degrade

### Phase 6: Repeat
- Continuous cycle with feedback
- Each iteration improves future decisions
- Aggregate learning across agent swarm

## Consequences

### Positive
- **Autonomous operation:** Minimal human intervention required
- **Fast response:** Minutes vs weeks for optimization cycle
- **Systematic learning:** Every outcome improves future decisions
- **Proactive detection:** Min-Cut identifies fragility before symptoms
- **Safe execution:** Rollback mechanisms prevent sustained damage
- **Measurable improvement:** +15% KPI improvement target

### Negative
- **Complexity:** 6-phase system with many interdependencies
- **Latency:** 30-minute observation window delays feedback
- **False positives:** May attempt optimization for transient issues
- **Rollback overhead:** Maintaining rollback points consumes resources

### Risks
- **Feedback loops:** Optimization may trigger counter-optimization
- **Cascading rollbacks:** Related changes may all revert together
- **Measurement noise:** KPI variance may mask true impact
- **Cold start:** Insufficient data for initial decision quality

## Approval Logic

### Auto-Approve When
- Risk = LOW
- Confidence > 80%
- Similar action succeeded > 5 times
- All parameters within safe zone

### Manual Approval Required When
- Risk = HIGH
- Confidence < 60%
- Novel action (never tried before)
- Affects critical services

## Cycle Timing

| Phase | Target Duration |
|-------|-----------------|
| Observe | Continuous (15min aggregation) |
| Analyze | < 30 seconds |
| Decide | < 10 seconds |
| Act | < 60 seconds |
| Learn | 30 minutes (observation window) |
| Total Cycle | < 35 minutes |

## Alternatives Considered

### Open-Loop Optimization
- **Pros:** Simpler, no feedback complexity
- **Cons:** No learning, no automatic rollback, no improvement over time

### Batch Optimization (Daily/Weekly)
- **Pros:** More data for decisions, reduced frequency
- **Cons:** Slow response to issues, missed optimization windows

### Human-in-the-Loop Always
- **Pros:** Maximum safety, engineer oversight
- **Cons:** Doesn't scale, defeats automation purpose

### Predictive-Only (No Action)
- **Pros:** Zero risk, provides recommendations
- **Cons:** Requires human execution, no learning from outcomes

### Continuous Optimization (No Observation Window)
- **Pros:** Faster feedback, more iterations
- **Cons:** Cannot distinguish signal from noise, unstable

## References
- ELEX PRD Section: Closed-Loop Optimization
- ELEX PRD Section: 6-Phase Control Loop
- ELEX PRD Section: Approval Logic
- ELEX PRD Section: Spatio-Temporal Granularity
- ELEX PRD Section: Core Principles (Closed-Loop Optimization)
- OODA Loop (Observe-Orient-Decide-Act) military decision cycle
