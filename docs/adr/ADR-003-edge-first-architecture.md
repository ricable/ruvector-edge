# ADR-003: Edge-First Zero-Cloud Architecture

## Status
Accepted

## Context
Current RAN optimization solutions rely heavily on cloud infrastructure:
- **Cloud-based ML:** $500-2,600/month operational cost
- **Latency:** Round-trip to cloud adds 50-200ms to query responses
- **Privacy:** Sensitive network configuration data transmitted to third parties
- **Vendor lock-in:** Dependency on cloud provider availability and pricing

The ELEX system must demonstrate a fundamentally different approach that:
- Eliminates recurring infrastructure costs
- Keeps all data on-premise or on-device
- Operates without internet connectivity if needed
- Scales without proportional cost increases

## Decision
We adopt an **edge-first, zero-cloud architecture** where:

### Primary Deployment Targets
1. **Browser (WASM):** Agents run directly in user browsers via WebAssembly
2. **Mobile (WASM):** Same agent binaries on mobile devices
3. **Edge Servers:** Node.js runtime for always-on deployments

### Infrastructure Model
- **$0/month baseline:** Full browser mode with GUN.js public relays
- **$5-20/month hybrid:** Small coordinator cluster + distributed agents
- **$15-60/month dedicated:** 3-7 node edge server cluster
- **No cloud compute:** All inference and learning happens at the edge

### P2P Transport
- GUN.js for browser-to-browser communication
- WebRTC for direct peer connections
- No central server required for agent coordination

## Consequences

### Positive
- **90% cost reduction:** $0-50/month vs $2,600/month cloud baseline
- **Zero latency penalty:** All computation local; <1ms task routing
- **Complete privacy:** No data leaves the network perimeter
- **Unlimited scale:** Each browser/device adds capacity, not cost
- **Offline capable:** Core functionality works without internet
- **No vendor lock-in:** Pure open-source stack

### Negative
- **Device constraints:** Browser agents limited by device memory and CPU
- **Persistence challenges:** Browser agents lose state on tab close (mitigated by sync)
- **Initial load time:** ~364KB WASM binary per agent must download
- **Resource competition:** Agents compete with other browser tabs for resources

### Risks
- **Browser compatibility:** WASM support varies; older browsers excluded
- **Mobile battery drain:** Continuous agent activity impacts battery life
- **State fragmentation:** Without central authority, state may diverge across devices
- **Cold start problem:** New deployments have no learned knowledge (see ADR-008)

## Alternatives Considered

### Cloud-Native Architecture
- **Pros:** Familiar deployment model, unlimited compute, managed infrastructure
- **Cons:** $500-2,600/month cost, latency, privacy concerns, vendor lock-in

### Hybrid Cloud-Edge
- **Pros:** Cloud for heavy lifting, edge for caching
- **Cons:** Still incurs cloud costs, complexity of two environments, partial privacy only

### On-Premise Server Only
- **Pros:** Full control, no cloud dependency
- **Cons:** Requires dedicated hardware, doesn't leverage user devices, scaling requires hardware

### Serverless Functions
- **Pros:** Pay-per-use, auto-scaling
- **Cons:** Cold starts add latency, still cloud-dependent, costs grow with usage

## References
- ELEX PRD Section: Problem Statement (Cloud-based ML costs)
- ELEX PRD Section: Key Metrics (Infrastructure Cost: $0/month)
- ELEX PRD Section: Deployment Strategy (Mode 1: Full Browser)
- ELEX PRD Section: Core Principles (Edge-Native, Zero-Cost Scale)
