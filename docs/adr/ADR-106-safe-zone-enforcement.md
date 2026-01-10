# ADR-106: Safe Zone Parameter Enforcement

## Status
Accepted

## Context
Ericsson RAN parameters control critical network behavior. Incorrect configurations can cause:

- **Service Outages:** Cells becoming unavailable
- **Performance Degradation:** Throughput drops, increased latency
- **Interference Issues:** Cross-cell interference, neighbor problems
- **Regulatory Violations:** Exceeding power limits, spectrum violations
- **Safety Hazards:** Excessive RF exposure (though unlikely in normal operation)

The 593 feature agents autonomously adjust 9,432 parameters through Q-learning. While learning improves configurations over time, the system must prevent:

1. **Dangerous Configurations:** Parameters outside safe operational bounds
2. **Unauthorized Changes:** Modifications without proper approval
3. **Rapid Oscillation:** Frequent parameter flapping causing instability
4. **Cascade Failures:** One bad parameter affecting dependent features

Human operators must retain ultimate control while allowing agents to optimize within defined boundaries.

## Decision
We implement **Multi-Layer Safe Zone Enforcement** with the following controls:

### 1. Hardcoded Constraints (Immutable)
```typescript
interface SafeZone {
    min: number;
    max: number;
    default: number;
    step: number;           // Minimum change increment
    rateLimit: number;      // Max changes per hour
    requiresApproval: boolean;
}

const SAFE_ZONES: Record<string, SafeZone> = {
    "txPowerMax": { min: -10, max: 43, default: 23, step: 1, rateLimit: 4, requiresApproval: false },
    "handoverMargin": { min: 0, max: 10, default: 3, step: 0.5, rateLimit: 12, requiresApproval: false },
    "cellBarred": { min: 0, max: 1, default: 0, step: 1, rateLimit: 2, requiresApproval: true },
    "frequencyBand": { min: 1, max: 77, default: 7, step: 1, rateLimit: 1, requiresApproval: true },
    // ... 9,428 more parameters
};
```

### 2. Automatic Rollback Mechanism
```typescript
interface RollbackTrigger {
    kpi: string;
    threshold: number;
    direction: 'below' | 'above';
    window: number;        // Observation window in seconds
    rollbackDepth: number; // How many changes to undo
}

const ROLLBACK_TRIGGERS: RollbackTrigger[] = [
    { kpi: "cellAvailability", threshold: 95, direction: 'below', window: 300, rollbackDepth: 5 },
    { kpi: "dropCallRate", threshold: 2, direction: 'above', window: 180, rollbackDepth: 3 },
    { kpi: "throughputDegradation", threshold: 20, direction: 'above', window: 120, rollbackDepth: 2 },
];
```

### 3. Approval Workflow for Critical Parameters
```
Agent Proposes Change
        |
        v
+-------+--------+
| Safe Zone Check |
+-------+--------+
        |
   +----+----+
   |         |
   v         v
PASS      FAIL --> Reject with reason
   |
   v
+--+-------------+
| Requires Approval? |
+--+-------------+
   |         |
   v         v
  YES        NO --> Execute immediately
   |
   v
Queue for human approval
   |
   v
30-minute validation window
   |
   +----+----+
   |         |
   v         v
Approved   Timeout --> Auto-reject, rollback
   |
   v
Execute with audit log
```

### 4. Parameter Change Auditing
```typescript
interface ParameterChangeRecord {
    timestamp: Date;
    agentId: string;
    featureCode: string;
    parameterName: string;
    previousValue: number;
    newValue: number;
    justification: string;    // Q-learning rationale
    kpiSnapshot: Record<string, number>;
    approvedBy?: string;      // Human approver if required
    rollbackId?: string;      // Link to rollback if triggered
}
```

### 5. Rate Limiting and Dampening
- **Change Rate:** Maximum N changes per hour per parameter (configurable)
- **Cooldown Period:** Minimum 60 seconds between changes to same parameter
- **Dampening Factor:** Exponential backoff after rollbacks
- **Aggregate Limit:** Maximum 100 parameter changes per hour per feature

### 6. Dependency Validation
Before any parameter change:
1. Check dependent parameters are in valid state
2. Verify prerequisite features are activated
3. Validate hardware capability supports new value
4. Confirm license allows the configuration

## Alternatives Considered

### Pure Human Approval (All Changes)
- **Pros:** Maximum control, zero autonomous risk
- **Cons:** Eliminates autonomy benefit, operator overload, delays
- **Rejected:** Defeats purpose of autonomous optimization

### No Constraints (Full Agent Autonomy)
- **Pros:** Maximum optimization potential, fastest learning
- **Cons:** Unacceptable risk of outages and violations
- **Rejected:** Network stability is non-negotiable

### Soft Limits Only (Warnings but No Enforcement)
- **Pros:** Agents can override in exceptional cases
- **Cons:** No guarantee of safety, audit liability
- **Rejected:** Regulatory and operational risk too high

### Simulation-First Validation
- **Pros:** Test changes before production
- **Cons:** Simulation fidelity issues, delay in optimization
- **Partial:** Used for high-risk changes requiring approval

### Machine Learning-Based Anomaly Detection
- **Pros:** Adaptive, learns normal patterns
- **Cons:** May miss novel failure modes, false positives
- **Supplementary:** Used alongside hardcoded constraints

## Consequences

### Positive
- **Zero Unauthorized Changes:** Hardcoded constraints cannot be bypassed
- **Automatic Recovery:** Rollback triggers restore stability quickly
- **Audit Trail:** Complete history of all parameter modifications
- **Human Override:** Critical changes require explicit approval
- **Rate Control:** Prevents rapid oscillation and instability
- **Regulatory Compliance:** Constraints enforce legal/license limits

### Negative
- **Reduced Optimization Space:** Agents cannot explore beyond safe zones
- **Approval Delays:** 30-minute window slows critical parameter changes
- **False Rollbacks:** Legitimate changes may trigger unnecessary rollback
- **Constraint Maintenance:** 9,432 parameter constraints must be maintained

### Risks
- **Constraint Staleness:** Safe zones may become outdated with new releases
- **Rollback Cascades:** Rollback of one parameter triggers others
- **Approval Bottleneck:** Too many changes queued for human review
- **Edge Cases:** Valid configurations outside defined safe zones

### Mitigations
- **Release Automation:** Constraints updated automatically with feature releases
- **Atomic Rollback:** Group related parameters for coordinated rollback
- **Priority Queuing:** Critical changes get expedited review
- **Exception Workflow:** Process for expanding safe zones with justification

## References
- Ericsson RAN Parameter Reference Documentation
- ADR-101: Neural Agent Architecture
- ADR-108: Ericsson Feature Ontology
- 3GPP TS 32.500 - Self-Organizing Networks (SON) concepts
- GSMA NG.116 - Network slicing security guidelines
- IEC 61508 - Functional safety standards (adapted for telecom)
