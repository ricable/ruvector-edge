# Knowledge Bounded Context

## Domain Purpose

The Knowledge context manages the comprehensive knowledge base of Ericsson RAN features, including 593 features, 9432 parameters, 3368 counters, 752 MO classes, 199 KPIs, and 118 technical documents. This is a **Core Domain** that provides the foundational data and semantics for all other contexts.

---

## Context Map Position

```
┌─────────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE CONTEXT                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upstream Dependencies: None (source of truth)                     │
│                                                                     │
│  Downstream Consumers:                                              │
│  ├── Intelligence (Partnership) - feature semantics for learning   │
│  ├── Optimization (Published Language) - parameter bounds, KPIs    │
│  └── All Contexts (Shared Kernel) - ubiquitous language terms      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Root: FeatureAgent

The `FeatureAgent` is the aggregate root that manages feature knowledge. Each FeatureAgent is responsible for a subset of the 593 features, typically organized by domain (e.g., Mobility, Energy Saving, Carrier Aggregation).

### Aggregate Boundary

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FeatureAgent Aggregate                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                                                    │
│  │FeatureAgent │ (Aggregate Root)                                   │
│  │             │                                                    │
│  │  id         │─────────────────────────────────────┐              │
│  │  domain     │                                     │              │
│  │  version    │                                     │              │
│  └──────┬──────┘                                     │              │
│         │                                            │              │
│         │ owns                                       │              │
│         ▼                                            │              │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────▼──────────┐   │
│  │   Feature   │────▶│  Parameter  │     │  DependencyGraph    │   │
│  │   (Entity)  │     │  (Entity)   │     │  (Value Object)     │   │
│  └──────┬──────┘     └─────────────┘     └─────────────────────┘   │
│         │                                                           │
│         │ references                                                │
│         ▼                                                           │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │   Counter   │     │     KPI     │     │  Procedure  │           │
│  │   (Entity)  │     │   (Entity)  │     │  (Entity)   │           │
│  └─────────────┘     └─────────────┘     └─────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invariants

1. **Unique FAJ Code**: Each feature has a unique FAJ code within the system
2. **Parameter Bounds**: All parameter values must be within defined bounds
3. **Dependency Integrity**: Features cannot be activated without required dependencies
4. **Version Consistency**: All entities within the aggregate share the same version

---

## Entities

### Feature

A configurable RAN capability with activation/deactivation procedures.

```rust
struct Feature {
    // Identity
    id: FeatureId,
    faj_code: FAJCode,
    cxc_code: Option<String>,

    // Metadata
    name: String,
    acronym: String,
    description: String,
    domain: FeatureDomain,

    // Configuration
    parameters: Vec<ParameterId>,
    counters: Vec<CounterId>,
    kpis: Vec<KPIId>,

    // Relationships
    dependencies: DependencyGraph,
    mo_classes: Vec<MOClassId>,

    // Procedures
    activation_procedure: Procedure,
    deactivation_procedure: Procedure,

    // Versioning
    releases: Vec<ReleaseVersion>,
    status: FeatureStatus,
}
```

**Feature Domains (89 categories):**
- Carrier Aggregation (89 features)
- Radio Resource Management (64 features)
- NR/5G (57 features)
- Transport (52 features)
- MIMO & Antenna (40 features)
- Mobility (36 features)
- Energy Saving (29 features)
- Coverage & Capacity (28 features)
- Voice & IMS (21 features)
- UE Handling (11 features)
- QoS (8 features)
- Interference (5 features)
- Timing (5 features)
- Security (3 features)
- SON (2 features)

### Parameter

A tunable configuration value within a feature.

```rust
struct Parameter {
    // Identity
    id: ParameterId,
    name: String,
    mo_path: String,

    // Type and bounds
    data_type: ParameterType,
    bounds: ParameterBounds,
    default_value: ParameterValue,

    // Semantics
    description: String,
    unit: Option<String>,
    impact: ParameterImpact,

    // Relationships
    feature_id: FeatureId,
    related_counters: Vec<CounterId>,

    // Change tracking
    requires_restart: bool,
    change_history: Vec<ParameterChange>,
}
```

### Counter

A performance metric collected from the RAN.

```rust
struct Counter {
    // Identity
    id: CounterId,
    name: String,          // e.g., "pmLbEvalSucc"

    // Metadata
    description: String,
    collection_interval: Duration,
    aggregation_type: AggregationType,

    // Type
    counter_type: CounterType,  // Cumulative, Gauge, Delta
    unit: Option<String>,

    // Relationships
    mo_class: MOClassId,
    related_features: Vec<FeatureId>,
    used_in_kpis: Vec<KPIId>,
}
```

### KPI

Key Performance Indicator derived from counters.

```rust
struct KPI {
    // Identity
    id: KPIId,
    name: String,

    // Definition
    formula: KPIFormula,
    input_counters: Vec<CounterId>,

    // Thresholds
    target: f64,
    warning_threshold: f64,
    critical_threshold: f64,

    // Metadata
    description: String,
    domain: KPIDomain,
    impact_level: ImpactLevel,
}
```

### Procedure

Step-by-step instructions for feature activation/deactivation.

```rust
struct Procedure {
    // Identity
    id: ProcedureId,
    procedure_type: ProcedureType,  // Activation, Deactivation, Verification

    // Steps
    steps: Vec<ProcedureStep>,
    preconditions: Vec<Precondition>,
    postconditions: Vec<Postcondition>,

    // Risk assessment
    risk_level: RiskLevel,
    rollback_steps: Vec<ProcedureStep>,

    // Timing
    estimated_duration: Duration,
    maintenance_window_required: bool,
}
```

---

## Value Objects

### FAJCode

Unique feature identifier in Ericsson format.

```rust
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct FAJCode {
    prefix: [char; 3],  // "FAJ"
    number: u32,        // Numeric identifier
}

impl FAJCode {
    fn new(code: &str) -> Result<Self, FAJCodeError> {
        // Validate format: FAJ followed by digits
        if !code.starts_with("FAJ") {
            return Err(FAJCodeError::InvalidPrefix);
        }
        let number = code[3..].parse::<u32>()
            .map_err(|_| FAJCodeError::InvalidNumber)?;
        Ok(Self { prefix: ['F', 'A', 'J'], number })
    }
}
```

### ParameterBounds

Defines valid range for parameter values.

```rust
#[derive(Clone, PartialEq)]
struct ParameterBounds {
    min: Option<ParameterValue>,
    max: Option<ParameterValue>,
    allowed_values: Option<Vec<ParameterValue>>,  // For enums
    step: Option<ParameterValue>,                  // For discrete ranges
}

impl ParameterBounds {
    fn validate(&self, value: &ParameterValue) -> Result<(), BoundsError> {
        if let Some(ref min) = self.min {
            if value < min { return Err(BoundsError::BelowMinimum); }
        }
        if let Some(ref max) = self.max {
            if value > max { return Err(BoundsError::AboveMaximum); }
        }
        if let Some(ref allowed) = self.allowed_values {
            if !allowed.contains(value) { return Err(BoundsError::NotAllowed); }
        }
        Ok(())
    }
}
```

### DependencyGraph

Represents feature dependencies.

```rust
#[derive(Clone, PartialEq)]
struct DependencyGraph {
    required: Vec<FeatureId>,           // Must be active before activation
    optional: Vec<FeatureId>,           // Enhanced functionality if active
    conflicts: Vec<FeatureId>,          // Cannot be active simultaneously
    prerequisite_parameters: Vec<ParameterPrerequisite>,
}

impl DependencyGraph {
    fn can_activate(&self, active_features: &HashSet<FeatureId>) -> Result<(), DependencyError> {
        // Check all required features are active
        for required in &self.required {
            if !active_features.contains(required) {
                return Err(DependencyError::MissingRequired(*required));
            }
        }
        // Check no conflicts are active
        for conflict in &self.conflicts {
            if active_features.contains(conflict) {
                return Err(DependencyError::ConflictActive(*conflict));
            }
        }
        Ok(())
    }
}
```

### ParameterValue

Type-safe parameter value representation.

```rust
#[derive(Clone, PartialEq)]
enum ParameterValue {
    Integer(i64),
    Float(f64),
    Boolean(bool),
    String(String),
    Enum(String),
    List(Vec<ParameterValue>),
}
```

### ReleaseVersion

Software release version.

```rust
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct ReleaseVersion {
    major: u8,
    minor: u8,
    patch: u8,
}
```

---

## Repository Interfaces

### FeatureRepository

```rust
trait FeatureRepository {
    /// Find feature by FAJ code
    fn find_by_faj(&self, code: &FAJCode) -> Option<Feature>;

    /// Find features by domain
    fn find_by_domain(&self, domain: FeatureDomain) -> Vec<Feature>;

    /// Find features by acronym (e.g., "IFLB", "DUAC")
    fn find_by_acronym(&self, acronym: &str) -> Option<Feature>;

    /// Get all features for a release
    fn find_by_release(&self, release: ReleaseVersion) -> Vec<Feature>;

    /// Search features by keyword
    fn search(&self, query: &str, limit: usize) -> Vec<Feature>;

    /// Save or update feature
    fn save(&mut self, feature: Feature) -> Result<(), RepositoryError>;

    /// Get feature count by domain
    fn count_by_domain(&self) -> HashMap<FeatureDomain, usize>;
}
```

### ParameterRepository

```rust
trait ParameterRepository {
    /// Find parameter by name
    fn find_by_name(&self, name: &str) -> Option<Parameter>;

    /// Find parameters for a feature
    fn find_by_feature(&self, feature_id: FeatureId) -> Vec<Parameter>;

    /// Find parameters by MO class
    fn find_by_mo_class(&self, mo_class: MOClassId) -> Vec<Parameter>;

    /// Search parameters by pattern
    fn search(&self, pattern: &str) -> Vec<Parameter>;

    /// Get parameters with specific impact
    fn find_by_impact(&self, impact: ParameterImpact) -> Vec<Parameter>;
}
```

### CounterRepository

```rust
trait CounterRepository {
    /// Find counter by name pattern (e.g., "pmLb*")
    fn find_by_pattern(&self, pattern: &str) -> Vec<Counter>;

    /// Find counters for a feature
    fn find_by_feature(&self, feature_id: FeatureId) -> Vec<Counter>;

    /// Find counters used in KPI
    fn find_by_kpi(&self, kpi_id: KPIId) -> Vec<Counter>;

    /// Get counter statistics
    fn get_statistics(&self) -> CounterStatistics;
}
```

### KPIRepository

```rust
trait KPIRepository {
    /// Find KPI by name
    fn find_by_name(&self, name: &str) -> Option<KPI>;

    /// Find KPIs by domain
    fn find_by_domain(&self, domain: KPIDomain) -> Vec<KPI>;

    /// Find KPIs affected by feature
    fn find_by_feature(&self, feature_id: FeatureId) -> Vec<KPI>;

    /// Get all critical KPIs
    fn find_critical(&self) -> Vec<KPI>;
}
```

### DocumentRepository

```rust
trait DocumentRepository {
    /// Find document by type
    fn find_by_type(&self, doc_type: DocumentType) -> Vec<Document>;

    /// Search documents by content
    fn search(&self, query: &str) -> Vec<Document>;

    /// Get documents for feature
    fn find_by_feature(&self, feature_id: FeatureId) -> Vec<Document>;
}
```

---

## Domain Events

### FeatureLoaded

Emitted when a feature is loaded into the knowledge base.

```rust
struct FeatureLoaded {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    feature_id: FeatureId,
    faj_code: FAJCode,
    domain: FeatureDomain,
    parameter_count: usize,
    counter_count: usize,
}
```

### KnowledgeUpdated

Emitted when knowledge is updated (new release, corrections, etc.).

```rust
struct KnowledgeUpdated {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    update_type: KnowledgeUpdateType,
    affected_features: Vec<FeatureId>,
    affected_parameters: Vec<ParameterId>,
    source: UpdateSource,
    version: ReleaseVersion,
}

enum KnowledgeUpdateType {
    NewRelease,
    ParameterCorrection,
    DocumentationUpdate,
    DependencyChange,
    Deprecation,
}
```

### FeatureDependencyChanged

Emitted when feature dependencies are modified.

```rust
struct FeatureDependencyChanged {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    feature_id: FeatureId,
    added_dependencies: Vec<FeatureId>,
    removed_dependencies: Vec<FeatureId>,
    reason: String,
}
```

### ParameterBoundsUpdated

Emitted when parameter bounds are changed.

```rust
struct ParameterBoundsUpdated {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    parameter_id: ParameterId,
    old_bounds: ParameterBounds,
    new_bounds: ParameterBounds,
    reason: String,
}
```

---

## Domain Services

### FeatureLookupService

```rust
struct FeatureLookupService<R: FeatureRepository> {
    repository: R,
    cache: LruCache<FAJCode, Feature>,
}

impl<R: FeatureRepository> FeatureLookupService<R> {
    /// Look up feature by any identifier
    fn lookup(&mut self, identifier: &str) -> Option<Feature> {
        // Try FAJ code first
        if let Ok(faj) = FAJCode::new(identifier) {
            if let Some(cached) = self.cache.get(&faj) {
                return Some(cached.clone());
            }
            if let Some(feature) = self.repository.find_by_faj(&faj) {
                self.cache.put(faj, feature.clone());
                return Some(feature);
            }
        }
        // Try acronym
        if let Some(feature) = self.repository.find_by_acronym(identifier) {
            return Some(feature);
        }
        // Try CXC code
        self.repository.search(identifier, 1).into_iter().next()
    }
}
```

### DependencyValidationService

```rust
struct DependencyValidationService<R: FeatureRepository> {
    repository: R,
}

impl<R: FeatureRepository> DependencyValidationService<R> {
    /// Validate that a feature can be activated
    fn can_activate(
        &self,
        feature_id: FeatureId,
        active_features: &HashSet<FeatureId>,
    ) -> Result<ActivationPlan, DependencyError> {
        let feature = self.repository.find_by_faj(&feature_id.into())
            .ok_or(DependencyError::FeatureNotFound)?;

        feature.dependencies.can_activate(active_features)?;

        // Build activation plan with dependency order
        let plan = self.build_activation_plan(&feature, active_features);
        Ok(plan)
    }

    /// Get transitive dependencies for a feature
    fn get_transitive_dependencies(&self, feature_id: FeatureId) -> Vec<FeatureId> {
        let mut visited = HashSet::new();
        let mut result = Vec::new();
        self.traverse_dependencies(feature_id, &mut visited, &mut result);
        result
    }
}
```

### CMEditCommandGenerator

```rust
struct CMEditCommandGenerator {
    mo_path_resolver: MOPathResolver,
}

impl CMEditCommandGenerator {
    /// Generate cmedit CLI command for parameter change
    fn generate_set_command(
        &self,
        parameter: &Parameter,
        value: &ParameterValue,
    ) -> Result<String, CommandError> {
        parameter.bounds.validate(value)?;

        let mo_path = self.mo_path_resolver.resolve(&parameter.mo_path)?;

        Ok(format!(
            "cmedit set {} {}={}",
            mo_path,
            parameter.name,
            value.to_cmedit_format()
        ))
    }

    /// Generate activation commands for feature
    fn generate_activation_commands(
        &self,
        feature: &Feature,
    ) -> Vec<String> {
        feature.activation_procedure.steps
            .iter()
            .filter_map(|step| step.to_cmedit_command())
            .collect()
    }
}
```

---

## Usage Examples

### Loading Feature by Acronym

```rust
let service = FeatureLookupService::new(repository);

// Look up IFLB (Intra-Frequency Load Balancing)
if let Some(iflb) = service.lookup("IFLB") {
    println!("Feature: {} ({})", iflb.name, iflb.faj_code);
    println!("Parameters: {}", iflb.parameters.len());
    println!("Domain: {:?}", iflb.domain);
}
```

### Validating Activation

```rust
let validator = DependencyValidationService::new(repository);
let active = active_feature_ids();

match validator.can_activate(feature_id, &active) {
    Ok(plan) => {
        println!("Activation plan:");
        for step in plan.steps {
            println!("  - Activate: {}", step.feature_id);
        }
    }
    Err(DependencyError::MissingRequired(dep)) => {
        println!("Missing dependency: {}", dep);
    }
    Err(e) => println!("Cannot activate: {:?}", e),
}
```

### Generating cmedit Commands

```rust
let generator = CMEditCommandGenerator::new();

// Set a parameter
let param = repository.find_by_name("lbTpNonQualFraction").unwrap();
let cmd = generator.generate_set_command(&param, &ParameterValue::Integer(30))?;
println!("{}", cmd);
// Output: cmedit set ENodeBFunction=1,EUtranCellFDD=Cell1 lbTpNonQualFraction=30

// Get activation commands
let feature = repository.find_by_acronym("IFLB").unwrap();
for cmd in generator.generate_activation_commands(&feature) {
    println!("{}", cmd);
}
```

---

## Integration Points

### Published Events Consumed By

| Event | Consumer Context | Action |
|-------|-----------------|--------|
| `FeatureLoaded` | Intelligence | Initialize Q-table for feature |
| `KnowledgeUpdated` | Intelligence | Trigger relearning |
| `ParameterBoundsUpdated` | Optimization | Update safe zones |
| `FeatureDependencyChanged` | Optimization | Recalculate optimization graph |

### Queries Exposed To

| Query | Consumer | Response |
|-------|----------|----------|
| Feature by FAJ | All | Full feature data |
| Parameters for feature | Optimization | Parameter list with bounds |
| KPIs affected by feature | Optimization | KPI list with thresholds |
| Counters for KPI | Optimization | Counter definitions |
