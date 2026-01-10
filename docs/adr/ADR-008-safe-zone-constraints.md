# ADR-008: Safe Zone Parameter Constraints

## Status
Accepted

## Context
The ELEX optimization engine generates cmedit commands that modify live RAN parameters. Without proper safeguards:
- Aggressive optimization could degrade network performance
- Parameter changes during critical periods could cause outages
- Cascading failures could affect thousands of users
- Recovery from bad configurations may take hours

The system must balance:
- Autonomous optimization (speed and scale benefits)
- Safety (prevent harmful configurations)
- Operator control (ultimate authority over network)

Key questions resolved:
1. Can operators override safety limits? **No - hardcoded constraints**
2. What happens during network events? **Automatic optimization pause**
3. How quickly can optimization be stopped? **Within one heartbeat**

## Decision
We implement **hardcoded safe zone constraints** with no operator overrides:

### Safe Zone Definition
Each parameter has:
- **Absolute min/max:** Physical limits from RAN specification
- **Safe min/max:** Operational limits determined by domain experts
- **Change limit:** Maximum percentage change per optimization cycle
- **Cooldown period:** Minimum time between changes to same parameter

### Example: IFLB Parameters
```yaml
lbActivationThreshold:
  absoluteMin: 10
  absoluteMax: 100
  safeMin: 50
  safeMax: 90
  changeLimit: 15%  # Max 15% change per cycle
  cooldown: 60min   # 1 hour between changes
```

### Blocking Conditions
Optimization automatically pauses during:
- `CRITICAL_HW_FAILURE`: Hardware failure detected
- `SITE_DOWN`: Cell site offline
- `HIGH_CALL_DROP`: Call drop rate > 2%
- `NIGHT_WINDOW`: 00:00-06:00 (configurable)
- `OPERATOR_PAUSE`: Manual pause request

### Enforcement
- Safe zones are **hardcoded in WASM binaries**
- Cannot be modified at runtime
- Updated only via signed binary updates
- Validated by external oracle against ground-truth KPIs

## Consequences

### Positive
- **Prevents disasters:** Impossible to set parameters outside safe range
- **Regulatory compliance:** Documented safety limits for auditing
- **Operator confidence:** Known bounds on system behavior
- **Automatic protection:** No human intervention needed during events
- **Consistent enforcement:** Same limits across all agents and deployments

### Negative
- **Reduced flexibility:** Cannot explore aggressive optimizations
- **Update friction:** Changing safe zones requires binary release
- **Conservative defaults:** May miss optimization opportunities at boundaries
- **No site-specific tuning:** Same limits apply to all sites

### Risks
- **Stale constraints:** Safe zones may not reflect current network reality
- **False positives:** Blocking conditions may trigger incorrectly
- **Optimization ceiling:** Performance limited by conservative bounds
- **Edge cases:** Some valid configurations may fall outside safe zones

## Alternatives Considered

### Operator-Configurable Limits
- **Pros:** Flexibility for advanced users, site-specific tuning
- **Cons:** Risk of misconfiguration, liability issues, inconsistent enforcement

### Soft Limits with Warnings
- **Pros:** Allows exploration, operator maintains control
- **Cons:** Warnings may be ignored, no guaranteed protection

### ML-Learned Constraints
- **Pros:** Adapts to observed network behavior
- **Cons:** May learn incorrect boundaries, black-box limits, trust issues

### No Constraints (Trust the Agent)
- **Pros:** Maximum optimization potential
- **Cons:** Unacceptable risk for production networks

### Tiered Constraints by Environment
- **Pros:** Stricter in production, looser in lab
- **Cons:** Risk of lab configurations leaking to production

## References
- ELEX PRD Section: Safe Zone Configuration
- ELEX PRD Section: 35 Critical Decisions (Safe Zones: Hardcoded, no operator overrides)
- ELEX PRD Section: Approval Logic
- ELEX PRD Section: Core Principles (Safe-by-Default)
