# ADR-108: Ericsson RAN Feature Ontology Integration

## Status
Accepted

## Context
The neural agent system must manage 593 distinct Ericsson RAN features, each with:

- **Feature Metadata:** Name, description, category, FAJ/CXC codes
- **Parameters:** 9,432 total parameters with types, bounds, and defaults
- **Counters:** 3,368 performance counters for monitoring
- **KPIs:** 199 Key Performance Indicators derived from counters
- **Dependencies:** Complex activation ordering and prerequisites
- **Release History:** Feature availability across 49 Ericsson releases

The features span 14 major categories:
| Category | Count | Examples |
|----------|-------|----------|
| Carrier Aggregation | 89 | Inter-band CA, UL CA, NR-DC |
| Radio Resource Mgmt | 64 | Load Balancing, Admission Control |
| NR/5G Features | 57 | NSA, SA, EN-DC, DSS |
| Transport | 52 | Fronthaul, Backhaul, X2/Xn |
| MIMO & Antenna | 40 | Massive MIMO, Beamforming |
| Mobility | 36 | Handover, ANR, RRC Transitions |
| Energy Saving | 29 | Cell Sleep, MIMO Sleep, Micro TX |
| Coverage & Capacity | 28 | Cell Config, Extended Range |
| Voice & IMS | 21 | VoLTE, VoNR, CSFB |
| UE Handling | 11 | Paging, DRX/DTX |
| QoS | 8 | Priority Scheduling, GBR |
| Interference | 5 | ICIC, eICIC, CoMP |
| Timing | 5 | IEEE 1588, GPS Sync |
| Security | 3 | MACsec, Encryption |
| SON | 2 | Self-Optimization |

Each agent requires:
1. Complete knowledge of its feature's parameters and dependencies
2. Understanding of related features in the same category
3. Access to KPI definitions for reward calculation
4. Release compatibility information

## Decision
We integrate the **Ericsson RAN Feature Skill Knowledge Base** as the authoritative ontology, with one neural agent per feature:

### Feature-to-Agent Mapping
```typescript
interface FeatureAgent {
    featureCode: string;        // FAJ number (e.g., "FAJ 123 456")
    cxcCode: string;            // Product code
    featureName: string;        // Human-readable name
    category: FeatureCategory;  // One of 14 categories
    parameters: Parameter[];    // Associated parameters
    counters: Counter[];        // Performance counters
    kpis: KPI[];                // Relevant KPIs
    dependencies: Dependency[]; // Activation prerequisites
    releases: Release[];        // Supported releases
    moClasses: MOClass[];       // Managed Object classes
}

// 593 agents, one per feature
const agents: FeatureAgent[] = await loadFromSkillKnowledgeBase();
```

### Knowledge Base Integration
```typescript
// Skill query interface for agents
interface SkillKnowledgeBase {
    // Feature lookup
    getFeature(code: string): Feature;
    getFeaturesByCategory(category: string): Feature[];
    getFeaturesByRelease(release: string): Feature[];

    // Parameter queries
    getParameters(featureCode: string): Parameter[];
    getParameterBounds(paramName: string): SafeZone;
    getParameterDependencies(paramName: string): string[];

    // Counter and KPI queries
    getCounters(featureCode: string): Counter[];
    getKPIs(featureCode: string): KPI[];
    getKPIFormula(kpiName: string): string;

    // Dependency resolution
    getDependencies(featureCode: string): Dependency[];
    getActivationOrder(features: string[]): string[];
    checkCompatibility(features: string[]): CompatibilityResult;

    // Document access
    getTechnicalDocuments(featureCode: string): Document[];
}
```

### Ontology Structure
```yaml
ontology:
  features:
    count: 593
    attributes:
      - code (FAJ number)
      - name
      - description
      - category
      - subcategory
      - release_introduced
      - release_deprecated (if applicable)
      - license_required

  parameters:
    count: 9432
    attributes:
      - name
      - feature_code
      - mo_class
      - data_type
      - unit
      - min_value
      - max_value
      - default_value
      - description
      - restart_required

  counters:
    count: 3368
    attributes:
      - name
      - feature_code
      - counter_type (cumulative, gauge, delta)
      - unit
      - description
      - collection_interval

  kpis:
    count: 199
    attributes:
      - name
      - formula
      - counters_used
      - target_value
      - threshold_warning
      - threshold_critical

  mo_classes:
    count: 752
    attributes:
      - name
      - parent_class
      - attributes
      - actions
      - feature_associations

  documents:
    count: 118
    types:
      - hardware
      - troubleshooting
      - configuration
      - installation
      - safety
```

### Agent Initialization from Ontology
```typescript
async function initializeFeatureAgent(featureCode: string): Promise<Agent> {
    const kb = getSkillKnowledgeBase();

    // Load feature definition
    const feature = kb.getFeature(featureCode);
    const parameters = kb.getParameters(featureCode);
    const counters = kb.getCounters(featureCode);
    const kpis = kb.getKPIs(featureCode);
    const dependencies = kb.getDependencies(featureCode);

    // Build state space from parameters
    const stateSpace = buildStateSpace(parameters, counters);

    // Build action space from parameter bounds
    const actionSpace = buildActionSpace(parameters);

    // Build reward function from KPIs
    const rewardFunction = buildRewardFunction(kpis);

    // Initialize Q-table
    const qTable = await loadOrCreateQTable(featureCode, stateSpace, actionSpace);

    return new Agent({
        featureCode,
        feature,
        stateSpace,
        actionSpace,
        rewardFunction,
        qTable,
        dependencies
    });
}
```

### Category Coordinator Mapping
Each of the 14 categories has a coordinator agent:
```typescript
const CATEGORY_COORDINATORS = {
    "carrier-aggregation": { agentId: "coord-ca", features: 89 },
    "radio-resource-mgmt": { agentId: "coord-rrm", features: 64 },
    "nr-5g": { agentId: "coord-nr", features: 57 },
    "transport": { agentId: "coord-transport", features: 52 },
    "mimo-antenna": { agentId: "coord-mimo", features: 40 },
    "mobility": { agentId: "coord-mobility", features: 36 },
    "energy-saving": { agentId: "coord-energy", features: 29 },
    "coverage-capacity": { agentId: "coord-coverage", features: 28 },
    "voice-ims": { agentId: "coord-voice", features: 21 },
    "ue-handling": { agentId: "coord-ue", features: 11 },
    "qos": { agentId: "coord-qos", features: 8 },
    "interference": { agentId: "coord-interference", features: 5 },
    "timing": { agentId: "coord-timing", features: 5 },
    "security": { agentId: "coord-security", features: 3 },
};
// Total: 14 coordinators + 593 feature agents = 607 agents
```

## Alternatives Considered

### Generic Agent Pool (No Feature Mapping)
- **Pros:** Simpler design, dynamic allocation
- **Cons:** Loses domain specialization, no persistent learning per feature
- **Rejected:** Feature-specific learning is core value proposition

### Manual Feature Configuration
- **Pros:** Full control, no external dependency
- **Cons:** 593 features x many attributes = massive manual effort
- **Rejected:** Unmaintainable, error-prone

### External Ontology Service (API Calls)
- **Pros:** Always up-to-date, centralized management
- **Cons:** Network dependency, latency, single point of failure
- **Rejected:** Edge-first requires local ontology

### Partial Feature Coverage (Top 100)
- **Pros:** Faster implementation, focus on high-impact features
- **Cons:** Missing features limit use cases, inconsistent coverage
- **Rejected:** Enterprise customers need comprehensive coverage

### Dynamic Feature Discovery
- **Pros:** Adapts to new features automatically
- **Cons:** Unpredictable agent count, harder to test
- **Partial:** Used for release updates, not initial deployment

## Consequences

### Positive
- **Comprehensive Coverage:** All 593 features have dedicated agents
- **Domain Expertise:** Each agent specializes in its feature
- **Dependency Awareness:** Activation ordering from ontology
- **KPI Alignment:** Rewards directly from official KPI definitions
- **Release Tracking:** Feature availability per software version
- **Documentation Access:** Agents can reference technical docs

### Negative
- **Ontology Maintenance:** Must track Ericsson releases for updates
- **Storage Requirements:** 593 agents with Q-tables consume memory
- **Cold Start:** All 593 agents need initialization
- **Sync Complexity:** Ontology updates require agent updates

### Risks
- **Ontology Staleness:** Skill knowledge base falls behind Ericsson releases
- **Missing Relationships:** Undocumented dependencies between features
- **Parameter Changes:** New releases may change parameter semantics
- **Licensing Conflicts:** Features requiring specific licenses

### Mitigations
- **Release Automation:** CI/CD pipeline to update from skill repository
- **Dependency Discovery:** Learning-based detection of hidden dependencies
- **Version Tagging:** Q-tables tagged with ontology version
- **License Validation:** Pre-activation license checks

## References
- Ericsson RAN Feature Knowledge Base (593 features skill)
- ADR-101: Neural Agent Architecture
- ADR-107: Domain-Driven Design Structure
- 3GPP TS 28.541 - NR Network Resource Model
- 3GPP TS 28.622 - Generic NRM Integration Reference Point
- Ericsson Radio System technical documentation
