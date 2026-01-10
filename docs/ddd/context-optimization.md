# Optimization Bounded Context

## Domain Purpose

The Optimization context manages the optimization lifecycle for RAN parameters, including KPI monitoring, root cause analysis, safe zone enforcement, and rollback capabilities. This is a **Core Domain** that translates intelligence insights into safe, effective parameter changes.

---

## Context Map Position

```
┌─────────────────────────────────────────────────────────────────────┐
│                     OPTIMIZATION CONTEXT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upstream Dependencies:                                            │
│  ├── Knowledge (Published Language) - parameter bounds, KPI defs   │
│  └── Intelligence (Domain Events) - patterns, Q-table predictions  │
│                                                                     │
│  Downstream Consumers:                                              │
│  └── Coordination (Customer-Supplier) - requests agent execution   │
│                                                                     │
│  Integration Style:                                                 │
│  └── Anti-Corruption Layer toward external RAN systems             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Root: OptimizationCycle

The `OptimizationCycle` is the aggregate root that manages a complete optimization workflow, from monitoring through execution and potential rollback.

### Aggregate Boundary

```
┌─────────────────────────────────────────────────────────────────────┐
│                   OptimizationCycle Aggregate                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────┐                                              │
│  │ OptimizationCycle │ (Aggregate Root)                             │
│  │                   │                                              │
│  │  id               │                                              │
│  │  state            │                                              │
│  │  start_time       │                                              │
│  │  target_kpis      │                                              │
│  └─────────┬─────────┘                                              │
│            │                                                         │
│            │ owns                                                    │
│            ▼                                                         │
│  ┌─────────────────┐     ┌───────────────────┐                      │
│  │   KPIMonitor    │     │ RootCauseAnalyzer │                      │
│  │    (Entity)     │────▶│    (Entity)       │                      │
│  │                 │     │                   │                      │
│  │  thresholds     │     │  correlations     │                      │
│  │  current_values │     │  hypotheses       │                      │
│  └─────────────────┘     └───────────────────┘                      │
│            │                      │                                  │
│            │                      │ generates                        │
│            ▼                      ▼                                  │
│  ┌─────────────────┐     ┌───────────────────┐                      │
│  │  RollbackPoint  │     │OptimizationResult │                      │
│  │ (Value Object)  │     │ (Value Object)    │                      │
│  │                 │     │                   │                      │
│  │  checkpoint_id  │     │  proposed_changes │                      │
│  │  parameters     │     │  expected_impact  │                      │
│  └─────────────────┘     └───────────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invariants

1. **Safe Zone Compliance**: All proposed changes must be within defined safe zones
2. **Rollback Available**: Every change must have a rollback point before execution
3. **Single Active Cycle**: Only one optimization cycle per scope can be active
4. **Cooldown Period**: Minimum time between optimization attempts for same parameters
5. **Impact Threshold**: Changes must meet minimum expected impact to proceed

---

## Entities

### OptimizationCycle

Manages a complete optimization workflow.

```rust
struct OptimizationCycle {
    // Identity
    id: CycleId,

    // State
    state: CycleState,
    phase: OptimizationPhase,

    // Timing
    start_time: DateTime<Utc>,
    end_time: Option<DateTime<Utc>>,
    cooldown_until: Option<DateTime<Utc>>,

    // Scope
    target_features: Vec<FeatureId>,
    target_parameters: Vec<ParameterId>,
    target_kpis: Vec<KPIId>,

    // Components
    monitors: Vec<KPIMonitor>,
    analyzer: RootCauseAnalyzer,

    // Checkpoints
    rollback_point: Option<RollbackPoint>,

    // Results
    proposed_result: Option<OptimizationResult>,
    applied_result: Option<AppliedResult>,

    // Audit
    decisions: Vec<OptimizationDecision>,
}

#[derive(Clone, Copy, PartialEq)]
enum CycleState {
    Initializing,
    Monitoring,
    Analyzing,
    Proposing,
    Validating,
    Executing,
    Verifying,
    Completed,
    RolledBack,
    Failed,
}

#[derive(Clone, Copy, PartialEq)]
enum OptimizationPhase {
    Observation,      // Collecting baseline data
    Analysis,         // Identifying optimization opportunities
    Proposal,         // Generating change proposals
    SafetyCheck,      // Validating against safe zones
    Execution,        // Applying changes
    Verification,     // Confirming improvement
    Stabilization,    // Waiting for system to stabilize
}

impl OptimizationCycle {
    /// Start monitoring phase
    fn start_monitoring(&mut self) -> Result<(), CycleError> {
        if self.state != CycleState::Initializing {
            return Err(CycleError::InvalidStateTransition);
        }
        self.state = CycleState::Monitoring;
        self.phase = OptimizationPhase::Observation;
        for monitor in &mut self.monitors {
            monitor.start();
        }
        Ok(())
    }

    /// Transition to analysis phase
    fn begin_analysis(&mut self) -> Result<(), CycleError> {
        if self.state != CycleState::Monitoring {
            return Err(CycleError::InvalidStateTransition);
        }

        // Ensure enough data collected
        for monitor in &self.monitors {
            if !monitor.has_sufficient_data() {
                return Err(CycleError::InsufficientData);
            }
        }

        self.state = CycleState::Analyzing;
        self.phase = OptimizationPhase::Analysis;
        Ok(())
    }

    /// Create rollback point before execution
    fn create_rollback_point(&mut self, current_params: &ParameterSnapshot) {
        self.rollback_point = Some(RollbackPoint {
            checkpoint_id: CheckpointId::new(),
            timestamp: Utc::now(),
            parameters: current_params.clone(),
            kpi_baseline: self.get_kpi_baseline(),
        });
    }

    /// Execute proposed optimization
    fn execute(&mut self, result: OptimizationResult) -> Result<Vec<ParameterChange>, CycleError> {
        if self.rollback_point.is_none() {
            return Err(CycleError::NoRollbackPoint);
        }

        // Validate all changes are within safe zones
        for change in &result.proposed_changes {
            if !self.is_within_safe_zone(change) {
                return Err(CycleError::SafeZoneViolation(change.parameter_id));
            }
        }

        self.state = CycleState::Executing;
        self.phase = OptimizationPhase::Execution;
        self.proposed_result = Some(result.clone());

        Ok(result.proposed_changes)
    }

    /// Trigger rollback
    fn rollback(&mut self) -> Result<ParameterSnapshot, CycleError> {
        let rollback_point = self.rollback_point.as_ref()
            .ok_or(CycleError::NoRollbackPoint)?;

        self.state = CycleState::RolledBack;
        self.decisions.push(OptimizationDecision::Rollback {
            reason: "Verification failed".to_string(),
            timestamp: Utc::now(),
        });

        Ok(rollback_point.parameters.clone())
    }
}
```

### KPIMonitor

Monitors KPI values and detects anomalies.

```rust
struct KPIMonitor {
    // Identity
    id: MonitorId,
    kpi_id: KPIId,

    // Configuration
    thresholds: KPIThresholds,
    collection_interval: Duration,

    // State
    status: MonitorStatus,
    current_value: Option<f64>,
    historical_values: VecDeque<TimestampedValue>,

    // Statistics
    baseline: Option<BaselineStatistics>,
    trend: Option<TrendAnalysis>,

    // Alerts
    active_alerts: Vec<KPIAlert>,
}

struct KPIThresholds {
    target: f64,
    warning_low: f64,
    warning_high: f64,
    critical_low: f64,
    critical_high: f64,
}

impl KPIMonitor {
    /// Record new KPI value
    fn record(&mut self, value: f64, timestamp: DateTime<Utc>) {
        self.historical_values.push_back(TimestampedValue { value, timestamp });
        self.current_value = Some(value);

        // Maintain window size
        while self.historical_values.len() > 1000 {
            self.historical_values.pop_front();
        }

        // Update statistics
        self.update_statistics();

        // Check thresholds
        self.check_thresholds(value);
    }

    /// Detect anomaly
    fn detect_anomaly(&self) -> Option<Anomaly> {
        let current = self.current_value?;
        let baseline = self.baseline.as_ref()?;

        let z_score = (current - baseline.mean) / baseline.std_dev;

        if z_score.abs() > 3.0 {
            Some(Anomaly {
                kpi_id: self.kpi_id,
                value: current,
                expected: baseline.mean,
                deviation: z_score,
                severity: if z_score.abs() > 5.0 {
                    Severity::Critical
                } else {
                    Severity::Warning
                },
            })
        } else {
            None
        }
    }

    /// Get trend direction
    fn get_trend(&self) -> TrendDirection {
        if let Some(ref trend) = self.trend {
            if trend.slope > 0.01 {
                TrendDirection::Improving
            } else if trend.slope < -0.01 {
                TrendDirection::Degrading
            } else {
                TrendDirection::Stable
            }
        } else {
            TrendDirection::Unknown
        }
    }
}
```

### RootCauseAnalyzer

Analyzes correlations to identify root causes.

```rust
struct RootCauseAnalyzer {
    // State
    correlations: Vec<Correlation>,
    hypotheses: Vec<Hypothesis>,

    // Configuration
    correlation_threshold: f64,
    min_samples: usize,

    // Data
    parameter_history: HashMap<ParameterId, Vec<TimestampedValue>>,
    kpi_history: HashMap<KPIId, Vec<TimestampedValue>>,
}

struct Correlation {
    parameter_id: ParameterId,
    kpi_id: KPIId,
    coefficient: f64,       // Pearson correlation
    lag: Duration,          // Time lag for correlation
    samples: usize,
    confidence: Confidence,
}

struct Hypothesis {
    root_cause: RootCause,
    evidence: Vec<Evidence>,
    likelihood: f64,
    proposed_action: Option<Action>,
}

enum RootCause {
    ParameterMisconfiguration(ParameterId),
    FeatureInteraction(FeatureId, FeatureId),
    LoadIncrease,
    ExternalInterference,
    HardwareIssue(String),
    Unknown,
}

impl RootCauseAnalyzer {
    /// Analyze correlations between parameters and KPIs
    fn analyze_correlations(&mut self) {
        self.correlations.clear();

        for (param_id, param_values) in &self.parameter_history {
            for (kpi_id, kpi_values) in &self.kpi_history {
                if let Some(corr) = self.calculate_correlation(param_values, kpi_values) {
                    if corr.coefficient.abs() >= self.correlation_threshold {
                        self.correlations.push(corr);
                    }
                }
            }
        }

        // Sort by correlation strength
        self.correlations.sort_by(|a, b| {
            b.coefficient.abs().partial_cmp(&a.coefficient.abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    /// Generate hypotheses for KPI degradation
    fn generate_hypotheses(&mut self, degraded_kpi: KPIId) -> Vec<Hypothesis> {
        let mut hypotheses = Vec::new();

        // Find correlated parameters
        for corr in &self.correlations {
            if corr.kpi_id == degraded_kpi && corr.confidence.is_sufficient() {
                hypotheses.push(Hypothesis {
                    root_cause: RootCause::ParameterMisconfiguration(corr.parameter_id),
                    evidence: vec![Evidence::Correlation(corr.clone())],
                    likelihood: corr.coefficient.abs(),
                    proposed_action: None,
                });
            }
        }

        // Rank by likelihood
        hypotheses.sort_by(|a, b| {
            b.likelihood.partial_cmp(&a.likelihood)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        self.hypotheses = hypotheses.clone();
        hypotheses
    }

    /// Get most likely root cause
    fn most_likely_cause(&self) -> Option<&Hypothesis> {
        self.hypotheses.first()
    }
}
```

---

## Value Objects

### SafeZone

Defines safe operating ranges for parameters.

```rust
#[derive(Clone, PartialEq)]
struct SafeZone {
    parameter_id: ParameterId,
    min_value: ParameterValue,
    max_value: ParameterValue,
    nominal_value: ParameterValue,

    // Context-dependent adjustments
    load_adjustments: Option<LoadAdjustments>,
    time_adjustments: Option<TimeAdjustments>,
}

impl SafeZone {
    /// Check if value is within safe zone
    fn contains(&self, value: &ParameterValue, context: &OperationContext) -> bool {
        let (adjusted_min, adjusted_max) = self.adjusted_bounds(context);
        value >= &adjusted_min && value <= &adjusted_max
    }

    /// Get distance from safe zone boundary
    fn distance_from_boundary(&self, value: &ParameterValue) -> f64 {
        let v = value.as_f64().unwrap_or(0.0);
        let min = self.min_value.as_f64().unwrap_or(0.0);
        let max = self.max_value.as_f64().unwrap_or(0.0);

        if v < min {
            min - v
        } else if v > max {
            v - max
        } else {
            // Inside zone, return distance to nearest boundary as negative
            -f64::min(v - min, max - v)
        }
    }
}
```

### RollbackPoint

Checkpoint for reverting changes.

```rust
#[derive(Clone, PartialEq)]
struct RollbackPoint {
    checkpoint_id: CheckpointId,
    timestamp: DateTime<Utc>,
    parameters: ParameterSnapshot,
    kpi_baseline: KPIBaseline,
}

#[derive(Clone)]
struct ParameterSnapshot {
    values: HashMap<ParameterId, ParameterValue>,
    captured_at: DateTime<Utc>,
}

impl RollbackPoint {
    /// Get changes needed to rollback
    fn get_rollback_changes(&self, current: &ParameterSnapshot) -> Vec<ParameterChange> {
        let mut changes = Vec::new();

        for (param_id, original_value) in &self.parameters.values {
            if let Some(current_value) = current.values.get(param_id) {
                if current_value != original_value {
                    changes.push(ParameterChange {
                        parameter_id: *param_id,
                        old_value: current_value.clone(),
                        new_value: original_value.clone(),
                        reason: ChangeReason::Rollback,
                    });
                }
            }
        }

        changes
    }
}
```

### OptimizationResult

Result of optimization analysis.

```rust
#[derive(Clone, PartialEq)]
struct OptimizationResult {
    cycle_id: CycleId,
    proposed_changes: Vec<ParameterChange>,
    expected_impact: ExpectedImpact,
    confidence: Confidence,
    risk_assessment: RiskAssessment,
    rationale: String,
}

struct ExpectedImpact {
    kpi_improvements: HashMap<KPIId, f64>,
    overall_score: f64,
    time_to_effect: Duration,
}

struct RiskAssessment {
    overall_risk: RiskLevel,
    risks: Vec<IdentifiedRisk>,
    mitigations: Vec<Mitigation>,
}

#[derive(Clone, Copy, PartialEq)]
enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}
```

---

## Domain Services

### ParameterOptimizer

Generates optimization proposals.

```rust
struct ParameterOptimizer {
    safe_zones: HashMap<ParameterId, SafeZone>,
    optimization_strategies: Vec<Box<dyn OptimizationStrategy>>,
}

trait OptimizationStrategy: Send + Sync {
    fn name(&self) -> &str;
    fn applies_to(&self, context: &OptimizationContext) -> bool;
    fn generate_proposal(&self, context: &OptimizationContext) -> Option<OptimizationProposal>;
}

impl ParameterOptimizer {
    /// Generate optimization proposal
    fn optimize(
        &self,
        context: &OptimizationContext,
    ) -> Result<OptimizationResult, OptimizationError> {
        // Find applicable strategies
        let applicable: Vec<_> = self.optimization_strategies
            .iter()
            .filter(|s| s.applies_to(context))
            .collect();

        if applicable.is_empty() {
            return Err(OptimizationError::NoApplicableStrategy);
        }

        // Generate proposals from each strategy
        let mut proposals: Vec<OptimizationProposal> = applicable
            .iter()
            .filter_map(|s| s.generate_proposal(context))
            .collect();

        // Filter proposals by safe zone
        proposals.retain(|p| self.validate_safe_zones(p));

        if proposals.is_empty() {
            return Err(OptimizationError::NoSafeProposals);
        }

        // Rank by expected impact
        proposals.sort_by(|a, b| {
            b.expected_impact.overall_score
                .partial_cmp(&a.expected_impact.overall_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Convert best proposal to result
        let best = proposals.remove(0);
        Ok(self.proposal_to_result(context.cycle_id, best))
    }

    fn validate_safe_zones(&self, proposal: &OptimizationProposal) -> bool {
        proposal.changes.iter().all(|change| {
            self.safe_zones.get(&change.parameter_id)
                .map(|zone| zone.contains(&change.new_value, &proposal.context))
                .unwrap_or(false)
        })
    }
}
```

### AnomalyDetector

Detects anomalies in KPI patterns.

```rust
struct AnomalyDetector {
    detection_methods: Vec<DetectionMethod>,
    sensitivity: f64,
}

enum DetectionMethod {
    ZScore { threshold: f64 },
    IQR { multiplier: f64 },
    MovingAverage { window: usize, threshold: f64 },
    ARIMA { p: usize, d: usize, q: usize },
}

impl AnomalyDetector {
    /// Detect anomalies in KPI time series
    fn detect(&self, values: &[TimestampedValue]) -> Vec<Anomaly> {
        let mut anomalies = Vec::new();

        for method in &self.detection_methods {
            let detected = match method {
                DetectionMethod::ZScore { threshold } => {
                    self.detect_zscore(values, *threshold)
                }
                DetectionMethod::IQR { multiplier } => {
                    self.detect_iqr(values, *multiplier)
                }
                DetectionMethod::MovingAverage { window, threshold } => {
                    self.detect_moving_average(values, *window, *threshold)
                }
                DetectionMethod::ARIMA { p, d, q } => {
                    self.detect_arima(values, *p, *d, *q)
                }
            };
            anomalies.extend(detected);
        }

        // Deduplicate by timestamp
        anomalies.sort_by_key(|a| a.timestamp);
        anomalies.dedup_by_key(|a| a.timestamp);

        anomalies
    }

    fn detect_zscore(&self, values: &[TimestampedValue], threshold: f64) -> Vec<Anomaly> {
        let mean: f64 = values.iter().map(|v| v.value).sum::<f64>() / values.len() as f64;
        let variance: f64 = values.iter()
            .map(|v| (v.value - mean).powi(2))
            .sum::<f64>() / values.len() as f64;
        let std_dev = variance.sqrt();

        values.iter()
            .filter(|v| ((v.value - mean) / std_dev).abs() > threshold)
            .map(|v| Anomaly {
                timestamp: v.timestamp,
                value: v.value,
                expected: mean,
                deviation: (v.value - mean) / std_dev,
                severity: self.severity_from_deviation((v.value - mean) / std_dev),
                kpi_id: KPIId::default(), // Set by caller
            })
            .collect()
    }
}
```

---

## Domain Events

### OptimizationProposed

Emitted when an optimization is proposed.

```rust
struct OptimizationProposed {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    cycle_id: CycleId,
    proposed_changes: Vec<ParameterChange>,
    expected_impact: ExpectedImpact,
    confidence: Confidence,
    requires_approval: bool,
}
```

### RollbackTriggered

Emitted when a rollback is triggered.

```rust
struct RollbackTriggered {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    cycle_id: CycleId,
    rollback_point_id: CheckpointId,
    reason: RollbackReason,
    affected_parameters: Vec<ParameterId>,
    kpi_state_at_rollback: HashMap<KPIId, f64>,
}

enum RollbackReason {
    KPIDegradation { kpi_id: KPIId, threshold_breached: f64 },
    VerificationFailed { expected: f64, actual: f64 },
    ManualRequest { requester: String },
    Timeout,
    SystemError(String),
}
```

### AnomalyDetected

Emitted when a KPI anomaly is detected.

```rust
struct AnomalyDetected {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    kpi_id: KPIId,
    anomaly: Anomaly,
    related_parameters: Vec<ParameterId>,
    suggested_actions: Vec<Action>,
}
```

### OptimizationCompleted

Emitted when optimization cycle completes.

```rust
struct OptimizationCompleted {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    cycle_id: CycleId,
    outcome: OptimizationOutcome,
    changes_applied: Vec<ParameterChange>,
    actual_impact: HashMap<KPIId, f64>,
    duration: Duration,
}

enum OptimizationOutcome {
    Success { improvement: f64 },
    PartialSuccess { improvement: f64, issues: Vec<String> },
    NoChange { reason: String },
    RolledBack { reason: RollbackReason },
    Failed { error: String },
}
```

---

## Repository Interfaces

### OptimizationRepository

```rust
trait OptimizationRepository {
    /// Get active optimization cycle
    fn get_active_cycle(&self) -> Option<OptimizationCycle>;

    /// Save cycle state
    fn save(&mut self, cycle: &OptimizationCycle) -> Result<(), RepositoryError>;

    /// Get cycle history
    fn get_history(&self, limit: usize) -> Vec<OptimizationCycle>;

    /// Get cycles affecting parameter
    fn find_by_parameter(&self, param_id: ParameterId) -> Vec<OptimizationCycle>;

    /// Check if parameter is in cooldown
    fn is_in_cooldown(&self, param_id: ParameterId) -> bool;
}
```

### SafeZoneRepository

```rust
trait SafeZoneRepository {
    /// Get safe zone for parameter
    fn get(&self, param_id: ParameterId) -> Option<SafeZone>;

    /// Get all safe zones
    fn get_all(&self) -> HashMap<ParameterId, SafeZone>;

    /// Update safe zone
    fn update(&mut self, zone: SafeZone) -> Result<(), RepositoryError>;

    /// Check value against safe zone
    fn is_safe(&self, param_id: ParameterId, value: &ParameterValue) -> bool;
}
```

### RollbackRepository

```rust
trait RollbackRepository {
    /// Save rollback point
    fn save_checkpoint(&mut self, point: RollbackPoint) -> Result<(), RepositoryError>;

    /// Get rollback point
    fn get_checkpoint(&self, id: CheckpointId) -> Option<RollbackPoint>;

    /// Get latest checkpoint for cycle
    fn get_latest(&self, cycle_id: CycleId) -> Option<RollbackPoint>;

    /// Prune old checkpoints
    fn prune(&mut self, older_than: DateTime<Utc>) -> usize;
}
```

---

## Integration Points

### Events Published

| Event | Consumer Context | Action |
|-------|-----------------|--------|
| `OptimizationProposed` | Coordination | Coordinate execution across agents |
| `RollbackTriggered` | Coordination | Emergency coordination |
| `AnomalyDetected` | Intelligence | Learn from anomaly |

### Events Consumed

| Event | Source Context | Action |
|-------|----------------|--------|
| `PatternDiscovered` | Intelligence | Consider pattern in optimization |
| `KnowledgeUpdated` | Knowledge | Update safe zones |
| `ParameterBoundsUpdated` | Knowledge | Refresh safe zones |

### Queries Required

| Query | Source | Purpose |
|-------|--------|---------|
| Parameter bounds | Knowledge | Define safe zones |
| KPI definitions | Knowledge | Set thresholds |
| Q-table predictions | Intelligence | Evaluate proposals |
| Pattern recommendations | Intelligence | Inform strategy |
