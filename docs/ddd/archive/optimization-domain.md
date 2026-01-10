# Optimization Bounded Context

## Purpose

The Optimization Context implements closed-loop RAN parameter optimization. It observes KPIs, analyzes degradations, decides on parameter changes within safe zones, acts via cmedit commands, learns from outcomes, and repeats continuously. This enables autonomous network tuning with safety constraints.

---

## Domain Model

```
+------------------------------------------------------------------+
|                   OPTIMIZATION BOUNDED CONTEXT                    |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+                                      |
|  |   OptimizationCycle    |  <-- Aggregate Root                  |
|  |      (Aggregate)       |                                      |
|  +------------------------+                                      |
|  | - cycleId: CycleId     |                                      |
|  | - phase: Phase         |  [Observe->Analyze->Decide->         |
|  | - target: KPI          |   Act->Learn->Repeat]                |
|  | - safeZone: SafeZone   |                                      |
|  | - history: History[]   |                                      |
|  +------------------------+                                      |
|           |                                                      |
|           | manages                                              |
|           v                                                      |
|  +------------------------+     +------------------------+       |
|  |       SafeZone         |     |      KPIMonitor        |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - zoneId: ZoneId       |     | - monitorId: MonitorId |       |
|  | - parameter: string    |     | - kpi: KPI             |       |
|  | - minValue: number     |     | - threshold: number    |       |
|  | - maxValue: number     |     | - samples: Sample[]    |       |
|  | - constraints: Rule[]  |     | - alerts: Alert[]      |       |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  +------------------------+     +------------------------+       |
|  |   RootCauseAnalyzer    |     |   ChangeExecutor       |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - analyzerId: Id       |     | - executorId: Id       |       |
|  | - rules: CausalRule[]  |     | - pendingChanges: Cmd[]|       |
|  | - history: Analysis[]  |     | - executedChanges: Cmd[]|      |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  +---------------+  +---------------+  +---------------+         |
|  | CmeditCommand |  |   RootCause   |  |   KPISample   |         |
|  |  (Value Obj)  |  |  (Value Obj)  |  |  (Value Obj)  |         |
|  +---------------+  +---------------+  +---------------+         |
|  | - moClass     |  | - cause       |  | - timestamp   |         |
|  | - attribute   |  | - confidence  |  | - value       |         |
|  | - value       |  | - evidence    |  | - metadata    |         |
|  | - scope       |  +---------------+  +---------------+         |
|  +---------------+                                               |
|                                                                  |
+------------------------------------------------------------------+
```

---

## The 6-Phase Optimization Loop

```
    +----------+     +----------+     +----------+
    |          |     |          |     |          |
    | OBSERVE  |---->| ANALYZE  |---->|  DECIDE  |
    |          |     |          |     |          |
    +----------+     +----------+     +----------+
         ^                                  |
         |                                  v
    +----------+     +----------+     +----------+
    |          |     |          |     |          |
    |  REPEAT  |<----| LEARN    |<----|   ACT    |
    |          |     |          |     |          |
    +----------+     +----------+     +----------+
```

### Phase 1: OBSERVE

Collect KPI measurements and network state.

```typescript
class ObservePhase {
  async execute(cycle: OptimizationCycle): Promise<ObservationResult> {
    const kpiMonitor = cycle.getKPIMonitor();

    // Collect samples
    const samples = await this.collectKPISamples(kpiMonitor);

    // Detect anomalies
    const anomalies = this.detectAnomalies(samples);

    // Record observations
    cycle.recordObservation({
      timestamp: new Date(),
      samples,
      anomalies,
      networkState: await this.captureNetworkState(),
    });

    // Transition to ANALYZE if degradation detected
    if (anomalies.length > 0) {
      cycle.transitionTo('analyze');
    }

    return { samples, anomalies };
  }

  private detectAnomalies(samples: KPISample[]): Anomaly[] {
    return samples.filter(s => !s.kpi.isHealthy(s.value));
  }
}
```

### Phase 2: ANALYZE

Perform root cause analysis on degraded KPIs.

```typescript
class AnalyzePhase {
  async execute(cycle: OptimizationCycle): Promise<AnalysisResult> {
    const analyzer = cycle.getRootCauseAnalyzer();
    const anomalies = cycle.getLatestObservation().anomalies;

    const rootCauses: RootCause[] = [];

    for (const anomaly of anomalies) {
      const cause = await analyzer.analyze(anomaly);
      rootCauses.push(cause);
    }

    // Rank by confidence
    const rankedCauses = rootCauses.sort((a, b) => b.confidence - a.confidence);

    cycle.recordAnalysis({
      timestamp: new Date(),
      rootCauses: rankedCauses,
      recommendation: this.generateRecommendation(rankedCauses),
    });

    cycle.transitionTo('decide');
    return { rootCauses: rankedCauses };
  }
}
```

### Phase 3: DECIDE

Select parameter changes within safe zone constraints.

```typescript
class DecidePhase {
  async execute(cycle: OptimizationCycle): Promise<DecisionResult> {
    const analysis = cycle.getLatestAnalysis();
    const safeZone = cycle.getSafeZone();

    const decisions: OptimizationDecision[] = [];

    for (const cause of analysis.rootCauses) {
      const parameterChanges = this.proposeChanges(cause);

      // Validate against safe zone
      const validChanges = parameterChanges.filter(change =>
        safeZone.isWithinBounds(change.parameter, change.newValue)
      );

      if (validChanges.length > 0) {
        decisions.push({
          cause,
          changes: validChanges,
          expectedImpact: this.estimateImpact(validChanges),
        });
      }
    }

    // Require consensus for significant changes
    if (this.requiresConsensus(decisions)) {
      const consensus = await this.seekConsensus(decisions);
      if (!consensus.approved) {
        cycle.recordDecision({ decisions: [], reason: 'consensus_rejected' });
        cycle.transitionTo('observe');
        return { decisions: [], approved: false };
      }
    }

    cycle.recordDecision({ decisions, approved: true });
    cycle.transitionTo('act');
    return { decisions, approved: true };
  }

  private requiresConsensus(decisions: OptimizationDecision[]): boolean {
    return decisions.some(d =>
      d.changes.some(c => c.riskLevel === 'high')
    );
  }
}
```

### Phase 4: ACT

Execute parameter changes via cmedit commands.

```typescript
class ActPhase {
  async execute(cycle: OptimizationCycle): Promise<ActionResult> {
    const decision = cycle.getLatestDecision();
    const executor = cycle.getChangeExecutor();

    const results: ChangeResult[] = [];

    for (const opt of decision.decisions) {
      for (const change of opt.changes) {
        // Generate cmedit command
        const command = this.generateCmeditCommand(change);

        // Store rollback point
        const rollbackPoint = await executor.captureState(change.parameter);

        // Execute change
        const result = await executor.execute(command);

        results.push({
          command,
          success: result.success,
          rollbackPoint,
          executedAt: new Date(),
        });

        // Raise event
        cycle.raise(new ParameterChanged(
          cycle.cycleId,
          change.parameter,
          change.previousValue,
          change.newValue,
          command
        ));
      }
    }

    cycle.recordAction({ results });
    cycle.transitionTo('learn');
    return { results };
  }

  private generateCmeditCommand(change: ParameterChange): CmeditCommand {
    return new CmeditCommand(
      change.moClass,
      change.attribute,
      change.newValue,
      change.scope
    );
  }
}
```

### Phase 5: LEARN

Evaluate outcomes and update Q-tables.

```typescript
class LearnPhase {
  async execute(cycle: OptimizationCycle): Promise<LearningResult> {
    const action = cycle.getLatestAction();

    // Wait for KPI stabilization
    await this.waitForStabilization();

    // Observe post-change KPIs
    const postChangeKPIs = await this.observeKPIs(cycle.getKPIMonitor());
    const preChangeKPIs = cycle.getLatestObservation().samples;

    // Calculate reward based on KPI improvement
    const reward = this.calculateReward(preChangeKPIs, postChangeKPIs, cycle.target);

    // Update Q-table
    const qLearningResult = await this.updateQLearning(
      cycle.getState(),
      action,
      reward,
      this.getCurrentState()
    );

    // Trigger rollback if degradation detected
    if (reward.value < -0.5) {
      await this.triggerRollback(cycle, action);
      cycle.raise(new RollbackTriggered(cycle.cycleId, 'kpi_degradation'));
    }

    cycle.recordLearning({
      preChangeKPIs,
      postChangeKPIs,
      reward,
      qLearningResult,
      rollbackTriggered: reward.value < -0.5,
    });

    cycle.transitionTo('repeat');
    return { reward, improved: reward.value > 0 };
  }

  private calculateReward(
    before: KPISample[],
    after: KPISample[],
    targetKPI: KPI
  ): Reward {
    const kpiBefore = before.find(s => s.kpi.name === targetKPI.name)?.value ?? 0;
    const kpiAfter = after.find(s => s.kpi.name === targetKPI.name)?.value ?? 0;

    return rewardCalculator.calculateOptimizationReward(
      kpiBefore,
      kpiAfter,
      targetKPI.threshold.target,
      targetKPI.direction
    );
  }
}
```

### Phase 6: REPEAT

Schedule next optimization cycle.

```typescript
class RepeatPhase {
  async execute(cycle: OptimizationCycle): Promise<void> {
    const learning = cycle.getLatestLearning();

    // Determine next cycle timing
    const delay = this.calculateDelay(learning);

    // Archive current cycle
    await this.archiveCycle(cycle);

    // Schedule next iteration
    cycle.transitionTo('observe');
    cycle.scheduleNext(delay);

    cycle.raise(new OptimizationCycleCompleted(cycle.cycleId, learning.reward));
  }

  private calculateDelay(learning: LearningResult): number {
    // Faster cycles if degraded, slower if stable
    if (learning.reward.value < 0) {
      return 60_000; // 1 minute
    } else if (learning.reward.value > 0.5) {
      return 3600_000; // 1 hour
    }
    return 300_000; // 5 minutes
  }
}
```

---

## Aggregates

### OptimizationCycle (Aggregate Root)

The root aggregate managing a complete optimization loop.

```typescript
class OptimizationCycle {
  private readonly cycleId: CycleId;
  private phase: OptimizationPhase;
  private targetKPI: KPI;
  private safeZone: SafeZone;
  private kpiMonitor: KPIMonitor;
  private rootCauseAnalyzer: RootCauseAnalyzer;
  private changeExecutor: ChangeExecutor;
  private history: CycleHistory[];
  private nextSchedule: Date | null;

  // Factory
  static start(target: KPI, config: OptimizationConfig): OptimizationCycle {
    const cycle = new OptimizationCycle(
      CycleId.generate(),
      'observe',
      target,
      SafeZone.fromConfig(config.safeZone),
      new KPIMonitor(target),
      new RootCauseAnalyzer(config.causalRules),
      new ChangeExecutor(config.enmConnection)
    );
    cycle.raise(new OptimizationStarted(cycle.cycleId, target));
    return cycle;
  }

  // Phase transitions
  transitionTo(phase: OptimizationPhase): void {
    const previousPhase = this.phase;
    this.validateTransition(previousPhase, phase);
    this.phase = phase;
    this.raise(new PhaseTransitioned(this.cycleId, previousPhase, phase));
  }

  // Execute current phase
  async executeCurrentPhase(): Promise<PhaseResult> {
    switch (this.phase) {
      case 'observe': return new ObservePhase().execute(this);
      case 'analyze': return new AnalyzePhase().execute(this);
      case 'decide': return new DecidePhase().execute(this);
      case 'act': return new ActPhase().execute(this);
      case 'learn': return new LearnPhase().execute(this);
      case 'repeat': return new RepeatPhase().execute(this);
    }
  }

  // Recording
  recordObservation(observation: Observation): void;
  recordAnalysis(analysis: Analysis): void;
  recordDecision(decision: Decision): void;
  recordAction(action: Action): void;
  recordLearning(learning: Learning): void;

  // Getters
  getLatestObservation(): Observation;
  getLatestAnalysis(): Analysis;
  getLatestDecision(): Decision;
  getLatestAction(): Action;
  getLatestLearning(): Learning;
  getSafeZone(): SafeZone;
  getKPIMonitor(): KPIMonitor;
  getRootCauseAnalyzer(): RootCauseAnalyzer;
  getChangeExecutor(): ChangeExecutor;

  // Scheduling
  scheduleNext(delayMs: number): void;
  cancelSchedule(): void;

  // Domain Events
  raise(event: OptimizationDomainEvent): void;
}

type OptimizationPhase =
  | 'observe'
  | 'analyze'
  | 'decide'
  | 'act'
  | 'learn'
  | 'repeat';
```

---

## Entities

### SafeZone

Defines safe bounds for parameter optimization.

```typescript
class SafeZone {
  private readonly zoneId: SafeZoneId;
  private readonly parameterBounds: Map<string, ParameterBounds>;
  private readonly constraints: SafetyConstraint[];
  private readonly overrideRules: OverrideRule[];

  // Factory
  static fromConfig(config: SafeZoneConfig): SafeZone;

  // Validation
  isWithinBounds(parameter: string, value: any): boolean {
    const bounds = this.parameterBounds.get(parameter);
    if (!bounds) {
      return false; // Unknown parameters are not allowed
    }

    if (typeof value === 'number') {
      return value >= bounds.min && value <= bounds.max;
    }

    if (bounds.allowedValues) {
      return bounds.allowedValues.includes(value);
    }

    return true;
  }

  // Multi-parameter constraints
  validateConstraints(changes: ParameterChange[]): ConstraintResult[] {
    return this.constraints.map(constraint => ({
      constraint: constraint.name,
      satisfied: constraint.evaluate(changes),
      violations: constraint.getViolations(changes),
    }));
  }

  // Bounds management
  getBounds(parameter: string): ParameterBounds | undefined;
  updateBounds(parameter: string, bounds: ParameterBounds): void;
  expandBounds(parameter: string, factor: number): void;
  contractBounds(parameter: string, factor: number): void;

  // Override for special cases
  applyOverride(rule: OverrideRule): void;
  removeOverride(ruleId: string): void;
}

interface ParameterBounds {
  min: number;
  max: number;
  step?: number;
  allowedValues?: any[];
  unit?: string;
}

interface SafetyConstraint {
  name: string;
  expression: string;
  evaluate(changes: ParameterChange[]): boolean;
  getViolations(changes: ParameterChange[]): string[];
}
```

### KPIMonitor

Monitors KPI values and detects degradations.

```typescript
class KPIMonitor {
  private readonly monitorId: KPIMonitorId;
  private readonly kpi: KPI;
  private readonly threshold: KPIThreshold;
  private samples: KPISample[];
  private alerts: Alert[];
  private baseline: number | null;

  constructor(kpi: KPI) {
    this.monitorId = KPIMonitorId.generate();
    this.kpi = kpi;
    this.threshold = kpi.threshold;
    this.samples = [];
    this.alerts = [];
    this.baseline = null;
  }

  // Sample collection
  async collectSample(): Promise<KPISample> {
    const counterValues = await this.fetchCounterValues();
    const value = this.kpi.calculate(counterValues);

    const sample: KPISample = {
      timestamp: new Date(),
      value,
      kpi: this.kpi,
      counterValues,
    };

    this.samples.push(sample);
    this.trimOldSamples();

    // Check threshold
    if (!this.kpi.isHealthy(value)) {
      this.raiseAlert(sample);
    }

    return sample;
  }

  // Baseline management
  establishBaseline(samples: KPISample[]): void {
    const values = samples.map(s => s.value);
    this.baseline = values.reduce((a, b) => a + b, 0) / values.length;
  }

  getDeviationFromBaseline(value: number): number {
    if (this.baseline === null) return 0;
    return (value - this.baseline) / this.baseline;
  }

  // Trend analysis
  getTrend(windowSize: number = 10): 'improving' | 'stable' | 'degrading' {
    const recent = this.samples.slice(-windowSize);
    if (recent.length < 2) return 'stable';

    const slope = this.calculateSlope(recent);

    if (this.kpi.direction === 'higher_better') {
      if (slope > 0.01) return 'improving';
      if (slope < -0.01) return 'degrading';
    } else {
      if (slope < -0.01) return 'improving';
      if (slope > 0.01) return 'degrading';
    }

    return 'stable';
  }

  private calculateSlope(samples: KPISample[]): number {
    // Simple linear regression slope
    const n = samples.length;
    const sumX = samples.reduce((s, _, i) => s + i, 0);
    const sumY = samples.reduce((s, sample) => s + sample.value, 0);
    const sumXY = samples.reduce((s, sample, i) => s + i * sample.value, 0);
    const sumX2 = samples.reduce((s, _, i) => s + i * i, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  // Alert management
  private raiseAlert(sample: KPISample): void {
    const alert: Alert = {
      alertId: AlertId.generate(),
      kpi: this.kpi.name,
      value: sample.value,
      threshold: this.threshold,
      severity: this.kpi.getDegradationLevel(sample.value),
      timestamp: sample.timestamp,
    };
    this.alerts.push(alert);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }
}
```

### RootCauseAnalyzer

Analyzes KPI degradations to identify root causes.

```typescript
class RootCauseAnalyzer {
  private readonly analyzerId: RootCauseAnalyzerId;
  private causalRules: CausalRule[];
  private history: RootCauseAnalysis[];

  constructor(rules: CausalRule[]) {
    this.analyzerId = RootCauseAnalyzerId.generate();
    this.causalRules = rules;
    this.history = [];
  }

  async analyze(anomaly: Anomaly): Promise<RootCause> {
    const candidates: RootCauseCandidate[] = [];

    // Apply causal rules
    for (const rule of this.causalRules) {
      if (rule.appliesTo(anomaly.kpi)) {
        const evidence = await this.gatherEvidence(rule, anomaly);
        if (evidence.sufficient) {
          candidates.push({
            cause: rule.rootCause,
            confidence: evidence.confidence,
            evidence: evidence.data,
            suggestedFix: rule.suggestedFix,
          });
        }
      }
    }

    // Rank by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    const bestCandidate = candidates[0];
    const rootCause = new RootCause(
      bestCandidate.cause,
      bestCandidate.confidence,
      bestCandidate.evidence,
      bestCandidate.suggestedFix
    );

    this.history.push({
      anomaly,
      rootCause,
      analyzedAt: new Date(),
    });

    return rootCause;
  }

  private async gatherEvidence(rule: CausalRule, anomaly: Anomaly): Promise<Evidence> {
    // Query related counters and parameters
    const relatedCounters = await this.queryCounters(rule.evidenceCounters);
    const relatedParams = await this.queryParameters(rule.evidenceParameters);

    // Evaluate evidence
    const confidence = rule.evaluateEvidence(relatedCounters, relatedParams, anomaly);

    return {
      sufficient: confidence > 0.6,
      confidence,
      data: { counters: relatedCounters, parameters: relatedParams },
    };
  }

  // Rule management
  addRule(rule: CausalRule): void;
  removeRule(ruleId: string): void;
  updateRuleConfidence(ruleId: string, adjustment: number): void;
}

interface CausalRule {
  ruleId: string;
  name: string;
  rootCause: string;
  appliesToKPIs: string[];
  evidenceCounters: string[];
  evidenceParameters: string[];
  suggestedFix: ParameterChange[];
  appliesTo(kpi: string): boolean;
  evaluateEvidence(counters: any, params: any, anomaly: Anomaly): number;
}
```

---

## Value Objects

### CmeditCommand

Ericsson CLI command for parameter modification.

```typescript
class CmeditCommand {
  readonly moClass: string;
  readonly attribute: string;
  readonly value: any;
  readonly scope: CommandScope;
  readonly command: string;

  constructor(
    moClass: string,
    attribute: string,
    value: any,
    scope: CommandScope
  ) {
    this.moClass = moClass;
    this.attribute = attribute;
    this.value = value;
    this.scope = scope;
    this.command = this.buildCommand();
  }

  private buildCommand(): string {
    const scopeFilter = this.buildScopeFilter();
    const setValue = this.formatValue();

    return `cmedit set ${scopeFilter} ${this.moClass}. ${this.attribute}=${setValue}`;
  }

  private buildScopeFilter(): string {
    switch (this.scope.type) {
      case 'all':
        return '*';
      case 'cell':
        return `SubNetwork=${this.scope.subNetwork},MeContext=${this.scope.meContext}`;
      case 'node':
        return `MeContext=${this.scope.meContext}`;
      case 'filter':
        return this.scope.filter;
    }
  }

  private formatValue(): string {
    if (typeof this.value === 'string') return `"${this.value}"`;
    if (typeof this.value === 'boolean') return this.value ? 'true' : 'false';
    return String(this.value);
  }

  // Validation
  isValid(): boolean {
    return this.moClass.length > 0 &&
           this.attribute.length > 0 &&
           this.value !== undefined;
  }

  equals(other: CmeditCommand): boolean {
    return this.command === other.command;
  }

  toString(): string {
    return this.command;
  }
}

interface CommandScope {
  type: 'all' | 'cell' | 'node' | 'filter';
  subNetwork?: string;
  meContext?: string;
  filter?: string;
}
```

### RootCause

Identified source of KPI degradation.

```typescript
class RootCause {
  readonly cause: string;
  readonly confidence: number;
  readonly evidence: Evidence;
  readonly suggestedFix: ParameterChange[];

  constructor(
    cause: string,
    confidence: number,
    evidence: Evidence,
    suggestedFix: ParameterChange[]
  ) {
    if (confidence < 0 || confidence > 1) {
      throw new InvalidConfidenceError(confidence);
    }
    this.cause = cause;
    this.confidence = confidence;
    this.evidence = evidence;
    this.suggestedFix = suggestedFix;
  }

  isHighConfidence(): boolean {
    return this.confidence >= 0.8;
  }

  getMediumConfidence(): boolean {
    return this.confidence >= 0.5 && this.confidence < 0.8;
  }

  equals(other: RootCause): boolean {
    return this.cause === other.cause &&
           Math.abs(this.confidence - other.confidence) < 0.01;
  }
}

interface Evidence {
  counters: Map<string, number>;
  parameters: Map<string, any>;
  correlations: Correlation[];
}
```

---

## Domain Events

```typescript
// Cycle Lifecycle Events
interface OptimizationStarted extends DomainEvent {
  type: 'OptimizationStarted';
  cycleId: string;
  targetKPI: string;
  safeZoneBounds: object;
}

interface OptimizationCycleCompleted extends DomainEvent {
  type: 'OptimizationCycleCompleted';
  cycleId: string;
  reward: number;
  kpiImprovement: number;
  changesApplied: number;
}

interface PhaseTransitioned extends DomainEvent {
  type: 'PhaseTransitioned';
  cycleId: string;
  fromPhase: string;
  toPhase: string;
  timestamp: Date;
}

// Parameter Change Events
interface ParameterChanged extends DomainEvent {
  type: 'ParameterChanged';
  cycleId: string;
  moClass: string;
  attribute: string;
  previousValue: any;
  newValue: any;
  cmeditCommand: string;
}

interface RollbackTriggered extends DomainEvent {
  type: 'RollbackTriggered';
  cycleId: string;
  reason: 'kpi_degradation' | 'safety_violation' | 'manual';
  rolledBackChanges: string[];
}

// Analysis Events
interface RootCauseIdentified extends DomainEvent {
  type: 'RootCauseIdentified';
  cycleId: string;
  kpi: string;
  rootCause: string;
  confidence: number;
}

// Safety Events
interface SafeZoneViolation extends DomainEvent {
  type: 'SafeZoneViolation';
  cycleId: string;
  parameter: string;
  attemptedValue: any;
  allowedRange: object;
}
```

---

## Domain Services

### OptimizationService

Orchestrates the optimization workflow.

```typescript
class OptimizationService {
  constructor(
    private readonly cycleRepo: OptimizationCycleRepository,
    private readonly eventBus: EventBus,
    private readonly consensusService: ConsensusService
  ) {}

  async startOptimization(kpi: KPI, config: OptimizationConfig): Promise<CycleId> {
    const cycle = OptimizationCycle.start(kpi, config);
    await this.cycleRepo.save(cycle);
    return cycle.cycleId;
  }

  async runCycle(cycleId: CycleId): Promise<void> {
    const cycle = await this.cycleRepo.findById(cycleId);

    while (cycle.phase !== 'repeat') {
      await cycle.executeCurrentPhase();
      await this.cycleRepo.save(cycle);
    }
  }

  async stopOptimization(cycleId: CycleId): Promise<void> {
    const cycle = await this.cycleRepo.findById(cycleId);
    cycle.cancelSchedule();
    await this.cycleRepo.save(cycle);
  }
}
```

### SafeZoneValidator

Validates parameter changes against safety constraints.

```typescript
class SafeZoneValidator {
  constructor(private readonly safeZone: SafeZone) {}

  validate(changes: ParameterChange[]): ValidationResult {
    const violations: Violation[] = [];

    for (const change of changes) {
      // Check bounds
      if (!this.safeZone.isWithinBounds(change.parameter, change.newValue)) {
        violations.push({
          type: 'bounds_violation',
          parameter: change.parameter,
          value: change.newValue,
          bounds: this.safeZone.getBounds(change.parameter),
        });
      }
    }

    // Check multi-parameter constraints
    const constraintResults = this.safeZone.validateConstraints(changes);
    for (const result of constraintResults) {
      if (!result.satisfied) {
        violations.push({
          type: 'constraint_violation',
          constraint: result.constraint,
          violations: result.violations,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  suggestSafeValue(parameter: string, desiredValue: number): number {
    const bounds = this.safeZone.getBounds(parameter);
    if (!bounds) return desiredValue;

    return Math.max(bounds.min, Math.min(bounds.max, desiredValue));
  }
}
```

---

## Example Causal Rules

| KPI | Root Cause | Evidence | Suggested Fix |
|-----|------------|----------|---------------|
| Call Setup Success Rate | High RACH contention | pmRachAttempts high, pmRachSuccess low | Increase rach-PreambleParameters |
| Handover Success Rate | Late HO triggering | pmHoTooLate high | Reduce a3Offset, increase hysteresis |
| DL Throughput | High interference | pmCqiDistribution shifted left | Adjust referenceSigPwr |
| Voice Quality | Poor coverage | pmRsrpDistribution shifted left | Adjust cellIndividualOffset |

---

## Invariants

1. **Safe Zone Bounds**: All parameter changes must be within safe zone
2. **Phase Ordering**: Phases must follow defined sequence
3. **Rollback Capability**: Every change must have a rollback point
4. **Consensus for Risk**: High-risk changes require consensus
5. **KPI Monotonicity**: Optimization should not degrade target KPI
6. **Change Atomicity**: Related parameter changes are atomic
