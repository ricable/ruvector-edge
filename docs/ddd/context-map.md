# Context Map

## Overview

This document provides a detailed context map showing the relationships between all 6 bounded contexts in the 593-agent Ericsson RAN neural agentic system. The context map visualizes upstream/downstream relationships, integration patterns, and data flows.

---

## Full Context Map Diagram

```
+==============================================================================+
||                    ERICSSON RAN NEURAL AGENTIC SYSTEM                      ||
||                           CONTEXT MAP v3.0                                  ||
+==============================================================================+

                              UPSTREAM
                                 |
                                 v
+------------------------------------------------------------------------------+
|                                                                              |
|    +---------------------+                    +---------------------+        |
|    |                     |   Published        |                     |        |
|    |      KNOWLEDGE      |   Language         |    INTELLIGENCE     |        |
|    |       CONTEXT       |===================>|       CONTEXT       |        |
|    |                     |                    |                     |        |
|    |  * FeatureCatalog   |   Domain Events:   |  * QTable           |        |
|    |  * FeatureAgent     |   - FeatureLoaded  |  * TrajectoryBuffer |        |
|    |  * 593 Features     |   - KPICalculated  |  * FederatedMerger  |        |
|    |  * 9432 Parameters  |                    |  * PatternStore     |        |
|    |                     |                    |                     |        |
|    +----------+----------+                    +----------+----------+        |
|               |                                          |                   |
|               | Shared Kernel                            | Customer-Supplier |
|               | (FeatureRoutingData)                     | (Predictions)     |
|               |                                          |                   |
|               v                                          v                   |
|    +---------------------+                    +---------------------+        |
|    |                     |<==================>|                     |        |
|    |    COORDINATION     |  Anti-Corruption   |    OPTIMIZATION     |        |
|    |       CONTEXT       |      Layer         |       CONTEXT       |        |
|    |                     |                    |                     |        |
|    |  * Swarm (Root)     |  Translations:     |  * OptimizeCycle    |        |
|    |  * Router           |  - OptCmd->Action  |  * SafeZone         |        |
|    |  * Consensus        |  - Result->Event   |  * KPIMonitor       |        |
|    |  * TopologyMgr      |                    |  * RootCauseAnalyze |        |
|    |                     |                    |                     |        |
|    +----------+----------+                    +----------+----------+        |
|               |                                          |                   |
|               | Open Host Service                        | ACL to External   |
|               | (Swarm API)                              | (Ericsson ENM)    |
|               |                                          |                   |
|               v                                          v                   |
|    +---------------------+                    +---------------------+        |
|    |                     |<==================>|                     |        |
|    |      RUNTIME        |   Partnership      |      SECURITY       |        |
|    |       CONTEXT       |   (Mutual Auth)    |       CONTEXT       |        |
|    |                     |                    |                     |        |
|    |  * RuntimeEnv       |  Shared:           |  * AgentIdentity    |        |
|    |  * WASMModule       |  - Module signing  |  * CryptoProvider   |        |
|    |  * ResourceManager  |  - Secure loading  |  * MessageVerifier  |        |
|    |  * ModuleLoader     |                    |  * SessionManager   |        |
|    |                     |                    |                     |        |
|    +---------------------+                    +---------------------+        |
|                                                                              |
+------------------------------------------------------------------------------+
                                 |
                                 v
                             DOWNSTREAM
                                 |
                       +---------+---------+
                       |                   |
                       v                   v
              +----------------+   +----------------+
              |                |   |                |
              |   Ericsson     |   |   External     |
              |     ENM        |   |   Monitoring   |
              |   (External)   |   |   (External)   |
              |                |   |                |
              +----------------+   +----------------+
```

---

## Integration Patterns Detail

### 1. Published Language (Knowledge -> Intelligence)

```
+------------------------------------------------------------------+
|           PUBLISHED LANGUAGE: Knowledge -> Intelligence           |
+------------------------------------------------------------------+
|                                                                  |
|  Knowledge Context                    Intelligence Context       |
|                                                                  |
|  +------------------+                 +------------------+       |
|  | FeatureLoaded    |                 | LearningService  |       |
|  |   Event          |================>|   Consumer       |       |
|  +------------------+                 +------------------+       |
|  | - fajCode        |                 | Extracts:        |       |
|  | - featureName    |                 | - Feature state  |       |
|  | - domain         |                 | - Context for    |       |
|  | - paramCount     |                 |   Q-learning     |       |
|  +------------------+                 +------------------+       |
|                                                                  |
|  +------------------+                 +------------------+       |
|  | KPICalculated    |                 | RewardCalculator |       |
|  |   Event          |================>|   Consumer       |       |
|  +------------------+                 +------------------+       |
|  | - kpiName        |                 | Uses KPI values  |       |
|  | - value          |                 | to compute       |       |
|  | - isHealthy      |                 | rewards for      |       |
|  | - timestamp      |                 | trajectories     |       |
|  +------------------+                 +------------------+       |
|                                                                  |
|  Contract:                                                       |
|  - Events are immutable once published                           |
|  - Schema versioning with backward compatibility                 |
|  - At-least-once delivery with idempotent consumers             |
|                                                                  |
+------------------------------------------------------------------+
```

### 2. Shared Kernel (Knowledge <-> Coordination)

```
+------------------------------------------------------------------+
|           SHARED KERNEL: Knowledge <-> Coordination              |
+------------------------------------------------------------------+
|                                                                  |
|  Shared Module: feature-routing-data                             |
|                                                                  |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  interface FeatureRoutingData {                          |   |
|  |    fajCode: FAJCode;           // Feature identifier     |   |
|  |    domain: FeatureDomain;      // Routing category       |   |
|  |    embedding: Float32Array;    // Semantic vector        |   |
|  |    agentAffinity: AgentId[];   // Preferred agents       |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  |  class FAJCode {                                         |   |
|  |    // Value object shared by both contexts               |   |
|  |    constructor(value: string);                           |   |
|  |    equals(other: FAJCode): boolean;                      |   |
|  |    toString(): string;                                   |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  |  enum FeatureDomain {                                    |   |
|  |    CARRIER_AGGREGATION,                                  |   |
|  |    RADIO_RESOURCE_MANAGEMENT,                            |   |
|  |    NR_5G,                                                |   |
|  |    // ... 12 more domains                                |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Governance:                                                     |
|  - Joint ownership between Knowledge and Coordination teams     |
|  - Changes require approval from both teams                     |
|  - Versioned releases with migration guides                     |
|                                                                  |
+------------------------------------------------------------------+
```

### 3. Customer-Supplier (Intelligence -> Optimization)

```
+------------------------------------------------------------------+
|        CUSTOMER-SUPPLIER: Intelligence -> Optimization           |
+------------------------------------------------------------------+
|                                                                  |
|  Supplier: Intelligence Context                                  |
|  Customer: Optimization Context                                  |
|                                                                  |
|  +------------------------+     +------------------------+       |
|  | Intelligence           |     | Optimization           |       |
|  | (Upstream Supplier)    |     | (Downstream Customer)  |       |
|  +------------------------+     +------------------------+       |
|  |                        |     |                        |       |
|  | Provides:              |     | Needs:                 |       |
|  | - Action predictions   |     | - Best action for      |       |
|  | - Pattern matches      |     |   current state        |       |
|  | - Q-value queries      |     | - Historical patterns  |       |
|  | - Success likelihoods  |     | - Risk estimates       |       |
|  |                        |     |                        |       |
|  +------------------------+     +------------------------+       |
|           |                              ^                       |
|           |    Service Interface         |                       |
|           +-----------------------------+                       |
|                                                                  |
|  interface IntelligenceService {                                 |
|    // Customer-facing API                                        |
|    predictBestAction(state: State): Action;                      |
|    getQValue(state: State, action: Action): number;              |
|    findSimilarPatterns(state: State): Pattern[];                 |
|    estimateSuccessProbability(action: Action): number;           |
|  }                                                               |
|                                                                  |
|  Relationship:                                                   |
|  - Optimization defines requirements                             |
|  - Intelligence implements to meet requirements                  |
|  - Regular sync meetings to review needs                         |
|                                                                  |
+------------------------------------------------------------------+
```

### 4. Anti-Corruption Layer (Coordination <-> Optimization)

```
+------------------------------------------------------------------+
|      ANTI-CORRUPTION LAYER: Coordination <-> Optimization        |
+------------------------------------------------------------------+
|                                                                  |
|  +----------------+   +------------------+   +----------------+  |
|  |                |   |                  |   |                |  |
|  | Coordination   |   |       ACL        |   | Optimization   |  |
|  |    Context     |<=>|    Translator    |<=>|    Context     |  |
|  |                |   |                  |   |                |  |
|  +----------------+   +------------------+   +----------------+  |
|                              |                                   |
|                              v                                   |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  class OptimizationACL {                                 |   |
|  |                                                          |   |
|  |    // Translate Coordination -> Optimization             |   |
|  |    translateConsensusResult(                             |   |
|  |      result: ConsensusResult                             |   |
|  |    ): OptimizationApproval {                             |   |
|  |      return {                                            |   |
|  |        approved: result.outcome === 'accepted',          |   |
|  |        voters: result.votes,                             |   |
|  |        confidence: result.quorumSize / result.totalVotes |   |
|  |      };                                                  |   |
|  |    }                                                     |   |
|  |                                                          |   |
|  |    // Translate Optimization -> Coordination             |   |
|  |    translateOptimizationRequest(                         |   |
|  |      request: OptimizationRequest                        |   |
|  |    ): ConsensusProposal {                                |   |
|  |      return {                                            |   |
|  |        type: 'parameter_change',                         |   |
|  |        payload: request.proposedChanges,                 |   |
|  |        requiredQuorum: request.riskLevel === 'high'      |   |
|  |          ? 'super_majority' : 'simple_majority'          |   |
|  |      };                                                  |   |
|  |    }                                                     |   |
|  |                                                          |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Purpose:                                                        |
|  - Isolate Optimization from Coordination implementation details |
|  - Translate between different domain languages                 |
|  - Allow independent evolution of both contexts                 |
|                                                                  |
+------------------------------------------------------------------+
```

### 5. Open Host Service (Coordination -> All)

```
+------------------------------------------------------------------+
|            OPEN HOST SERVICE: Coordination -> All                |
+------------------------------------------------------------------+
|                                                                  |
|                      Coordination Context                        |
|                              |                                   |
|                    +-------------------+                         |
|                    |   Swarm API       |                         |
|                    | (Open Host)       |                         |
|                    +-------------------+                         |
|                              |                                   |
|        +--------------------+--------------------+               |
|        |                    |                    |               |
|        v                    v                    v               |
|  +----------+        +----------+        +----------+            |
|  |          |        |          |        |          |            |
|  | Knowledge|        |  Runtime |        |  Security|            |
|  |          |        |          |        |          |            |
|  +----------+        +----------+        +----------+            |
|                                                                  |
|  Published API (REST/gRPC):                                      |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  // Agent Management                                     |   |
|  |  POST   /swarm/agents              - Spawn agent         |   |
|  |  DELETE /swarm/agents/{id}         - Terminate agent     |   |
|  |  GET    /swarm/agents/{id}/status  - Get agent status    |   |
|  |                                                          |   |
|  |  // Query Routing                                        |   |
|  |  POST   /swarm/query               - Route query         |   |
|  |  GET    /swarm/query/{id}/status   - Query status        |   |
|  |                                                          |   |
|  |  // Topology                                             |   |
|  |  GET    /swarm/topology            - Current topology    |   |
|  |  PUT    /swarm/topology            - Change topology     |   |
|  |                                                          |   |
|  |  // Consensus                                            |   |
|  |  POST   /swarm/consensus/propose   - Start consensus     |   |
|  |  GET    /swarm/consensus/{id}      - Consensus result    |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Characteristics:                                                |
|  - Versioned API (v1, v2, etc.)                                  |
|  - OpenAPI/Swagger specification                                 |
|  - Rate limiting and authentication                             |
|  - Backward compatible changes only                             |
|                                                                  |
+------------------------------------------------------------------+
```

### 6. Partnership (Runtime <-> Security)

```
+------------------------------------------------------------------+
|              PARTNERSHIP: Runtime <-> Security                   |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+     +------------------------+       |
|  |     Runtime Context    |<===>|    Security Context    |       |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  Shared Responsibilities:                                        |
|                                                                  |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  1. Module Signing                                       |   |
|  |     Runtime: Requests signature verification             |   |
|  |     Security: Provides signature validation              |   |
|  |                                                          |   |
|  |  2. Secure Module Loading                                |   |
|  |     Security: Signs trusted modules                      |   |
|  |     Runtime: Verifies before loading                     |   |
|  |                                                          |   |
|  |  3. Memory Isolation                                     |   |
|  |     Runtime: Implements WASM sandbox                     |   |
|  |     Security: Audits isolation boundaries                |   |
|  |                                                          |   |
|  |  4. Execution Authentication                             |   |
|  |     Security: Issues execution tokens                    |   |
|  |     Runtime: Validates tokens before execution           |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Joint Interface:                                                |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  interface SecureRuntimeBridge {                         |   |
|  |    // Called by Runtime, implemented by Security         |   |
|  |    verifyModuleSignature(module: WASMBinary): boolean;   |   |
|  |    getExecutionToken(moduleId: ModuleId): Token;         |   |
|  |                                                          |   |
|  |    // Called by Security, implemented by Runtime         |   |
|  |    getModuleHash(moduleId: ModuleId): Hash;              |   |
|  |    auditMemoryBoundaries(): AuditReport;                 |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Governance:                                                     |
|  - Joint design sessions                                         |
|  - Shared responsibility for security-critical code             |
|  - Regular security audits of integration points                |
|                                                                  |
+------------------------------------------------------------------+
```

### 7. Conformist (Runtime -> Coordination)

```
+------------------------------------------------------------------+
|             CONFORMIST: Runtime -> Coordination                  |
+------------------------------------------------------------------+
|                                                                  |
|  Upstream: Coordination Context (defines protocols)              |
|  Downstream: Runtime Context (conforms to protocols)             |
|                                                                  |
|  +------------------------+     +------------------------+       |
|  |    Coordination        |     |      Runtime           |       |
|  |    (Upstream)          |     |    (Conformist)        |       |
|  +------------------------+     +------------------------+       |
|  |                        |     |                        |       |
|  | Defines:               |     | Implements:            |       |
|  | - Agent spawn protocol |---->| - SpawnHandler         |       |
|  | - Health check format  |---->| - HealthReporter       |       |
|  | - Status reporting API |---->| - StatusPublisher      |       |
|  | - Shutdown sequence    |---->| - GracefulShutdown     |       |
|  |                        |     |                        |       |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  Example Conformance:                                            |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  // Runtime MUST implement Coordination's interface      |   |
|  |                                                          |   |
|  |  interface AgentLifecycleHandler {                       |   |
|  |    // Defined by Coordination, implemented by Runtime    |   |
|  |    onSpawn(config: AgentConfig): Promise<AgentHandle>;   |   |
|  |    onTerminate(agentId: AgentId): Promise<void>;         |   |
|  |    onHealthCheck(): HealthStatus;                        |   |
|  |    onStatusRequest(): AgentStatus;                       |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  |  class RuntimeAgentHandler implements AgentLifecycleHandler {|
|  |    // Runtime conforms without modifying the interface   |   |
|  |    async onSpawn(config: AgentConfig) {                  |   |
|  |      const module = await this.loadModule(config);       |   |
|  |      return new AgentHandle(module);                     |   |
|  |    }                                                     |   |
|  |    // ... other implementations                          |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Trade-offs:                                                     |
|  - Runtime has no influence on Coordination's protocol design   |
|  - Simple integration but limited flexibility                   |
|  - Changes in Coordination require Runtime updates              |
|                                                                  |
+------------------------------------------------------------------+
```

### 8. External ACL (Optimization -> Ericsson ENM)

```
+------------------------------------------------------------------+
|        EXTERNAL ACL: Optimization -> Ericsson ENM                |
+------------------------------------------------------------------+
|                                                                  |
|  +----------------+   +------------------+   +----------------+  |
|  |                |   |                  |   |                |  |
|  | Optimization   |   |   Ericsson ACL   |   |  Ericsson ENM  |  |
|  |    Context     |==>|   (Translator)   |==>|   (External)   |  |
|  |                |   |                  |   |                |  |
|  +----------------+   +------------------+   +----------------+  |
|                              |                                   |
|                              v                                   |
|  +----------------------------------------------------------+   |
|  |                                                          |   |
|  |  class EricssonENMAdapter {                              |   |
|  |                                                          |   |
|  |    // Translate internal commands to ENM format          |   |
|  |    translateToCmedit(                                    |   |
|  |      command: OptimizationCommand                        |   |
|  |    ): string {                                           |   |
|  |      // Build cmedit CLI command                         |   |
|  |      const scope = this.buildScope(command.scope);       |   |
|  |      const attribute = this.mapAttribute(command.param); |   |
|  |      const value = this.formatValue(command.value);      |   |
|  |                                                          |   |
|  |      return `cmedit set ${scope} ${command.moClass}. ` + |   |
|  |             `${attribute}=${value}`;                     |   |
|  |    }                                                     |   |
|  |                                                          |   |
|  |    // Translate ENM responses to internal events         |   |
|  |    translateFromENM(                                     |   |
|  |      response: ENMResponse                               |   |
|  |    ): OptimizationResult {                               |   |
|  |      return {                                            |   |
|  |        success: response.returnCode === 0,               |   |
|  |        affectedNodes: this.parseAffected(response),      |   |
|  |        errors: this.parseErrors(response)                |   |
|  |      };                                                  |   |
|  |    }                                                     |   |
|  |                                                          |   |
|  |    // Query ENM for current values                       |   |
|  |    async queryCurrentValue(                              |   |
|  |      moClass: string,                                    |   |
|  |      attribute: string,                                  |   |
|  |      scope: Scope                                        |   |
|  |    ): Promise<any> {                                     |   |
|  |      const cmeditGet = `cmedit get ${scope} ` +          |   |
|  |                        `${moClass}.(${attribute})`;      |   |
|  |      const response = await this.execute(cmeditGet);     |   |
|  |      return this.parseGetResponse(response);             |   |
|  |    }                                                     |   |
|  |                                                          |   |
|  |  }                                                       |   |
|  |                                                          |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  Protection:                                                     |
|  - Isolates internal model from ENM's data model                |
|  - Handles ENM version differences                              |
|  - Provides retry and error handling                            |
|  - Logs all external interactions for audit                     |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Data Flow Summary

```
+------------------------------------------------------------------+
|                       DATA FLOW SUMMARY                          |
+------------------------------------------------------------------+
|                                                                  |
|  1. Query Flow                                                   |
|     User -> Coordination -> Knowledge -> Intelligence -> User   |
|                                                                  |
|  2. Learning Flow                                                |
|     Knowledge -> Intelligence -> (stored in Q-tables)           |
|                                                                  |
|  3. Optimization Flow                                            |
|     Knowledge -> Optimization -> Coordination -> ENM (external) |
|                                                                  |
|  4. Security Flow                                                |
|     All Contexts <-> Security (authentication, signing)         |
|                                                                  |
|  5. Runtime Flow                                                 |
|     Coordination -> Runtime (module lifecycle)                  |
|     Security <-> Runtime (secure execution)                     |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Integration Pattern Summary

| Upstream Context | Downstream Context | Pattern | Rationale |
|------------------|-------------------|---------|-----------|
| Knowledge | Intelligence | Published Language | Event-based feature data sharing |
| Knowledge | Coordination | Shared Kernel | Common routing data model |
| Intelligence | Optimization | Customer-Supplier | Optimization defines learning needs |
| Coordination | All Contexts | Open Host Service | Well-defined Swarm API |
| Coordination | Optimization | Anti-Corruption Layer | Isolate consensus from optimization |
| Security | Runtime | Partnership | Mutual authentication |
| Runtime | Coordination | Conformist | Runtime conforms to protocols |
| Optimization | ENM | Anti-Corruption Layer | External system isolation |

---

## Team Topology Alignment

| Context | Team | Upstream Dependencies | Downstream Consumers |
|---------|------|----------------------|---------------------|
| Knowledge | Feature Experts | Ericsson Skill | Intelligence, Coordination |
| Intelligence | ML Engineers | Knowledge | Optimization |
| Coordination | Platform Team | - | All other contexts |
| Optimization | Network Engineers | Intelligence, Coordination | Ericsson ENM |
| Runtime | Infrastructure Team | Coordination | - |
| Security | Security Team | - | All other contexts |

---

## Evolution Strategy

1. **Knowledge Context**: May split into Feature Catalog and Knowledge Base subdomains
2. **Intelligence Context**: May introduce separate Pattern Store bounded context
3. **Coordination Context**: Stable core, unlikely to split
4. **Optimization Context**: May introduce Real-time vs Batch optimization contexts
5. **Runtime Context**: May split WASM management from Resource management
6. **Security Context**: May introduce dedicated Audit/Compliance context

---

## Team Boundaries

| Team | Contexts Owned | Responsibilities |
|------|----------------|------------------|
| Domain Team | Knowledge, Intelligence, Optimization | RAN feature expertise, learning algorithms |
| Platform Team | Coordination, Security, Runtime | Infrastructure, protocols, deployment |
| Integration Team | ENM Adapter | External system connectivity |
