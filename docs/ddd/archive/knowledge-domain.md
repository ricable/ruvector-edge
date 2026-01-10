# Knowledge Bounded Context

## Purpose

The Knowledge Context is the authoritative source of Ericsson RAN feature expertise. It manages 593 features, 9,432 parameters, 3,368 counters, 752 MO classes, and 199 KPIs, enabling specialized agents to answer technical queries with precision.

---

## Domain Model

```
+------------------------------------------------------------------+
|                    KNOWLEDGE BOUNDED CONTEXT                     |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+                                      |
|  |    FeatureCatalog      |  <-- Aggregate Root                  |
|  |    (Aggregate)         |                                      |
|  +------------------------+                                      |
|  | - catalogId: CatalogId |                                      |
|  | - features: Feature[]  |                                      |
|  | - version: string      |                                      |
|  | - lastUpdated: Date    |                                      |
|  +------------------------+                                      |
|           |                                                      |
|           | 1:N                                                  |
|           v                                                      |
|  +------------------------+     +------------------------+       |
|  |       Feature          |     |     FeatureAgent       |       |
|  |       (Entity)         |     |     (Aggregate)        |       |
|  +------------------------+     +------------------------+       |
|  | - fajCode: FAJCode     |<--->| - agentId: AgentId     |       |
|  | - name: string         |     | - features: FAJCode[]  |       |
|  | - domain: FeatureDomain|     | - expertise: number    |       |
|  | - release: string      |     | - embedding: Float32[] |       |
|  | - parameters: Param[]  |     +------------------------+       |
|  | - counters: Counter[]  |                                      |
|  | - kpis: KPI[]          |                                      |
|  | - moClasses: MOClass[] |                                      |
|  | - dependencies: Dep[]  |                                      |
|  +------------------------+                                      |
|           |                                                      |
|           | contains                                             |
|           v                                                      |
|  +-------------+  +-------------+  +-------------+  +----------+ |
|  |  Parameter  |  |   Counter   |  |     KPI     |  | MOClass  | |
|  | (Value Obj) |  | (Value Obj) |  | (Value Obj) |  |(Val Obj) | |
|  +-------------+  +-------------+  +-------------+  +----------+ |
|  | - name      |  | - name      |  | - name      |  | - name   | |
|  | - type      |  | - pmGroup   |  | - formula   |  | - attrs  | |
|  | - range     |  | - unit      |  | - threshold |  | - rels   | |
|  | - default   |  | - aggMethod |  | - direction |  +----------+ |
|  +-------------+  +-------------+  +-------------+               |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Aggregates

### FeatureCatalog (Aggregate Root)

The master catalog containing all 593 Ericsson RAN features.

```typescript
class FeatureCatalog {
  private readonly catalogId: CatalogId;
  private features: Map<FAJCode, Feature>;
  private version: string;
  private lastUpdated: Date;

  // Factory method
  static create(version: string): FeatureCatalog;

  // Commands
  addFeature(feature: Feature): void;
  updateFeature(fajCode: FAJCode, updates: FeatureUpdates): void;
  removeFeature(fajCode: FAJCode): void;

  // Queries
  findByFAJCode(fajCode: FAJCode): Feature | undefined;
  findByDomain(domain: FeatureDomain): Feature[];
  findByRelease(release: string): Feature[];
  searchByKeyword(keyword: string): Feature[];

  // Invariants
  private ensureUniqueFAJCode(fajCode: FAJCode): void;
  private validateDependencies(feature: Feature): void;

  // Domain Events
  raise(event: FeatureAdded | FeatureUpdated | CatalogRefreshed): void;
}
```

### FeatureAgent (Aggregate Root)

Specialized agent responsible for one or more features.

```typescript
class FeatureAgent {
  private readonly agentId: AgentId;
  private assignedFeatures: Set<FAJCode>;
  private expertise: ExpertiseLevel;
  private embedding: Float32Array;
  private qTable: QTableReference;

  // Factory
  static spawn(features: FAJCode[], config: AgentConfig): FeatureAgent;

  // Commands
  assignFeature(fajCode: FAJCode): void;
  unassignFeature(fajCode: FAJCode): void;
  updateExpertise(level: ExpertiseLevel): void;
  updateEmbedding(embedding: Float32Array): void;

  // Queries
  canHandle(query: Query): boolean;
  getSpecializationScore(fajCode: FAJCode): number;
  getSimilarity(queryEmbedding: Float32Array): number;

  // Domain Events
  raise(event: AgentSpawned | FeatureAssigned | ExpertiseUpdated): void;
}
```

---

## Entities

### Feature

Represents a single Ericsson RAN feature with its complete technical specification.

```typescript
class Feature {
  readonly fajCode: FAJCode;
  readonly cxcCode: CXCCode;
  readonly name: string;
  readonly description: string;
  readonly domain: FeatureDomain;
  readonly release: ReleaseVersion;
  readonly parameters: Parameter[];
  readonly counters: Counter[];
  readonly kpis: KPI[];
  readonly moClasses: MOClass[];
  readonly dependencies: FeatureDependency[];
  readonly documents: TechnicalDocument[];

  // Behavior
  getActivationProcedure(): ActivationProcedure;
  getDeactivationProcedure(): DeactivationProcedure;
  validateParameterChange(param: Parameter, newValue: any): ValidationResult;
  getRelatedFeatures(): FAJCode[];
  getCmeditCommands(): CmeditCommand[];
}
```

### KnowledgeBase

Indexed repository of all feature knowledge for semantic search.

```typescript
class KnowledgeBase {
  private readonly baseId: KnowledgeBaseId;
  private documents: TechnicalDocument[];
  private embeddings: Map<DocumentId, Float32Array>;
  private hnswIndex: HNSWIndex;

  // Commands
  indexDocument(doc: TechnicalDocument): void;
  updateIndex(): void;
  rebuildIndex(): void;

  // Queries
  semanticSearch(query: string, k: number): SearchResult[];
  findSimilar(embedding: Float32Array, k: number): SearchResult[];
  getDocumentById(docId: DocumentId): TechnicalDocument;
}
```

---

## Value Objects

### FAJCode

Ericsson Feature Article Journal code (immutable identifier).

```typescript
class FAJCode {
  private readonly value: string;

  constructor(value: string) {
    if (!this.isValid(value)) {
      throw new InvalidFAJCodeError(value);
    }
    this.value = value.toUpperCase();
  }

  private isValid(value: string): boolean {
    // FAJ codes follow pattern: FAJ 123 4567/8
    return /^FAJ\s?\d{3}\s?\d{4}\/\d$/.test(value);
  }

  equals(other: FAJCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

### Parameter

Configuration parameter with type, range, and constraints.

```typescript
class Parameter {
  readonly name: string;
  readonly type: ParameterType;
  readonly range: ParameterRange;
  readonly defaultValue: any;
  readonly unit: string | null;
  readonly moClass: string;
  readonly description: string;
  readonly constraints: ParameterConstraint[];

  isValidValue(value: any): boolean;
  isWithinSafeZone(value: any, safeZone: SafeZone): boolean;
  formatForCmedit(): string;
}

type ParameterType = 'integer' | 'string' | 'boolean' | 'enum' | 'struct';

interface ParameterRange {
  min?: number;
  max?: number;
  enumValues?: string[];
  pattern?: RegExp;
}
```

### Counter

Performance measurement counter from network elements.

```typescript
class Counter {
  readonly name: string;
  readonly pmGroup: string;
  readonly unit: CounterUnit;
  readonly aggregationMethod: AggregationMethod;
  readonly description: string;
  readonly resetBehavior: ResetBehavior;

  calculateDelta(previous: number, current: number): number;
  aggregate(values: number[], method: AggregationMethod): number;
}

type AggregationMethod = 'sum' | 'avg' | 'max' | 'min' | 'weighted_avg';
type CounterUnit = 'count' | 'ms' | 'bytes' | 'percent' | 'dBm';
```

### KPI

Key Performance Indicator derived from counters.

```typescript
class KPI {
  readonly name: string;
  readonly formula: KPIFormula;
  readonly threshold: KPIThreshold;
  readonly direction: KPIDirection; // 'higher_better' | 'lower_better'
  readonly counters: string[]; // Counter names used in formula
  readonly description: string;

  calculate(counterValues: Map<string, number>): number;
  isHealthy(value: number): boolean;
  getDegradationLevel(value: number): DegradationLevel;
}

interface KPIFormula {
  expression: string;
  variables: string[];
  evaluate(values: Map<string, number>): number;
}
```

---

## Domain Events

```typescript
// Catalog Events
interface FeatureLoaded extends DomainEvent {
  type: 'FeatureLoaded';
  fajCode: string;
  featureName: string;
  domain: string;
  parameterCount: number;
  counterCount: number;
}

interface CatalogRefreshed extends DomainEvent {
  type: 'CatalogRefreshed';
  catalogId: string;
  version: string;
  featureCount: number;
  addedFeatures: string[];
  updatedFeatures: string[];
}

// Parameter Events
interface ParameterChanged extends DomainEvent {
  type: 'ParameterChanged';
  fajCode: string;
  parameterName: string;
  previousValue: any;
  newValue: any;
  changedBy: string;
}

// KPI Events
interface KPICalculated extends DomainEvent {
  type: 'KPICalculated';
  kpiName: string;
  value: number;
  isHealthy: boolean;
  relatedFeatures: string[];
  timestamp: Date;
}

interface KPIDegraded extends DomainEvent {
  type: 'KPIDegraded';
  kpiName: string;
  currentValue: number;
  threshold: number;
  degradationLevel: 'warning' | 'critical';
  possibleCauses: string[];
}

// Agent Events
interface FeatureAssigned extends DomainEvent {
  type: 'FeatureAssigned';
  agentId: string;
  fajCode: string;
  expertiseLevel: number;
}

interface ExpertiseUpdated extends DomainEvent {
  type: 'ExpertiseUpdated';
  agentId: string;
  previousLevel: number;
  newLevel: number;
  trigger: 'learning' | 'manual' | 'federated_merge';
}
```

---

## Domain Services

### FeatureLookupService

Fast feature lookup and search across the catalog.

```typescript
class FeatureLookupService {
  constructor(
    private readonly catalog: FeatureCatalog,
    private readonly hnswIndex: HNSWIndex
  ) {}

  // Exact lookup
  findByFAJCode(fajCode: FAJCode): Feature | undefined;
  findByCXCCode(cxcCode: CXCCode): Feature | undefined;

  // Domain filtering
  findByDomain(domain: FeatureDomain): Feature[];
  findByRelease(release: string): Feature[];

  // Semantic search
  searchByNaturalLanguage(query: string, k: number): RankedFeature[];
  findSimilarFeatures(fajCode: FAJCode, k: number): RankedFeature[];

  // Parameter/Counter lookup
  findFeaturesWithParameter(paramName: string): Feature[];
  findFeaturesAffectingKPI(kpiName: string): Feature[];
}

interface RankedFeature {
  feature: Feature;
  score: number;
  matchReason: string;
}
```

### DependencyResolver

Resolves feature dependencies for activation/deactivation.

```typescript
class DependencyResolver {
  constructor(private readonly catalog: FeatureCatalog) {}

  // Dependency analysis
  getDependencies(fajCode: FAJCode): FeatureDependency[];
  getDependents(fajCode: FAJCode): FAJCode[];
  getTransitiveDependencies(fajCode: FAJCode): FAJCode[];

  // Activation order
  getActivationOrder(features: FAJCode[]): FAJCode[];
  getDeactivationOrder(features: FAJCode[]): FAJCode[];

  // Conflict detection
  detectConflicts(features: FAJCode[]): FeatureConflict[];
  validateCoexistence(features: FAJCode[]): ValidationResult;

  // Impact analysis
  analyzeActivationImpact(fajCode: FAJCode): ImpactAnalysis;
  analyzeDeactivationImpact(fajCode: FAJCode): ImpactAnalysis;
}

interface FeatureDependency {
  fajCode: FAJCode;
  type: 'requires' | 'conflicts_with' | 'enhances' | 'replaces';
  minRelease?: string;
}
```

---

## Repositories

### FeatureRepository

```typescript
interface FeatureRepository {
  // CRUD
  save(feature: Feature): Promise<void>;
  findById(fajCode: FAJCode): Promise<Feature | undefined>;
  findAll(): Promise<Feature[]>;
  delete(fajCode: FAJCode): Promise<void>;

  // Queries
  findByDomain(domain: FeatureDomain): Promise<Feature[]>;
  findByRelease(release: string): Promise<Feature[]>;
  findByMOClass(moClass: string): Promise<Feature[]>;

  // Bulk operations
  saveAll(features: Feature[]): Promise<void>;
  refreshFromSource(): Promise<RefreshResult>;
}
```

### CatalogRepository

```typescript
interface CatalogRepository {
  getCurrent(): Promise<FeatureCatalog>;
  getVersion(version: string): Promise<FeatureCatalog | undefined>;
  save(catalog: FeatureCatalog): Promise<void>;
  listVersions(): Promise<CatalogVersion[]>;
}
```

---

## Integration with Ericsson Skill

The Knowledge Context integrates with the `ericsson-ran-features` skill which provides:

- **593 Features**: Complete feature definitions
- **9,432 Parameters**: All configurable parameters
- **3,368 Counters**: Performance measurement counters
- **752 MO Classes**: Managed Object class definitions
- **199 KPIs**: Key Performance Indicator formulas
- **118 Technical Documents**: Configuration guides, troubleshooting docs

### Feature Domains

| Domain | Features | Description |
|--------|----------|-------------|
| Carrier Aggregation | 89 | Inter/intra-band CA, UL/DL CA, NR-DC |
| Radio Resource Management | 64 | Load balancing, admission control, scheduling |
| NR/5G | 57 | NSA/SA, EN-DC, DSS, NR carrier config |
| Transport | 52 | Fronthaul, backhaul, X2/Xn/S1/NG interfaces |
| MIMO & Antenna | 40 | Massive MIMO, beamforming, TM modes |
| Mobility | 36 | Handover, ANR, neighbor relations |
| Energy Saving | 29 | Cell/MIMO sleep, micro sleep TX |
| Coverage & Capacity | 28 | Cell config, sector management |
| Voice & IMS | 21 | VoLTE, VoNR, CSFB, speech codecs |
| UE Handling | 11 | Paging, DRX/DTX, idle mode |
| QoS | 8 | Priority scheduling, GBR bearers |
| Interference | 5 | ICIC, eICIC, CoMP |
| Timing | 5 | IEEE 1588, GPS sync |
| Security | 3 | MACsec, encryption |
| SON | 2 | Self-optimization |

### Skill Integration Pattern

```typescript
class EricssonSkillAdapter {
  constructor(private readonly skillClient: SkillClient) {}

  async loadFeatures(): Promise<Feature[]> {
    const rawFeatures = await this.skillClient.query('list all features');
    return rawFeatures.map(this.translateToFeature);
  }

  async getFeatureDetails(acronym: string): Promise<Feature> {
    const details = await this.skillClient.query(`describe ${acronym}`);
    return this.translateToFeature(details);
  }

  async generateCmeditCommand(
    moClass: string,
    attribute: string,
    value: any
  ): Promise<CmeditCommand> {
    const cmd = await this.skillClient.query(
      `cmedit for ${moClass}.${attribute} = ${value}`
    );
    return new CmeditCommand(cmd);
  }

  private translateToFeature(raw: any): Feature {
    // Anti-corruption layer translation
    return new Feature(
      new FAJCode(raw.faj_code),
      raw.name,
      // ... map all fields
    );
  }
}
```

---

## Agent Specialization Strategy

Each of the 593 agents specializes in related features:

```typescript
interface AgentSpecialization {
  agentId: string;
  primaryFeatures: FAJCode[];   // Main expertise (1-3 features)
  secondaryFeatures: FAJCode[]; // Supporting knowledge
  domain: FeatureDomain;
  expertiseVector: Float32Array; // Semantic embedding
}

// Example: Carrier Aggregation Agent
const caAgent: AgentSpecialization = {
  agentId: 'agent-ca-001',
  primaryFeatures: ['FAJ 123 4567/1', 'FAJ 123 4568/2'],
  secondaryFeatures: ['FAJ 123 4569/3'],
  domain: 'carrier_aggregation',
  expertiseVector: embeddings.encode('carrier aggregation inter-band...')
};
```

---

## Invariants

1. **Unique FAJ Codes**: No two features can share the same FAJ code
2. **Valid Dependencies**: All feature dependencies must reference existing features
3. **Parameter Ranges**: Parameter values must be within defined ranges
4. **KPI Formula Validity**: All counters referenced in KPI formulas must exist
5. **Agent Coverage**: Every feature must have at least one assigned agent
6. **Expertise Bounds**: Agent expertise levels must be in [0.0, 1.0]
