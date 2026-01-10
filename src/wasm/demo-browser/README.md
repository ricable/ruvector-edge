# ELEX WASM - WebAssembly Bindings

WebAssembly bindings for the ELEX Edge AI Agent Swarm, enabling deployment in browsers, Node.js, and edge environments.

## Features

- **Browser/Node.js Compatibility**: Works in all modern browsers and Node.js
- **Lazy Loading**: On-demand agent instantiation to reduce memory footprint
- **IndexedDB Persistence**: Seamless storage for Q-tables and trajectories
- **Telemetry Hooks**: Built-in monitoring and performance tracking
- **TypeScript Definitions**: Full TypeScript type definitions for JS consumers
- **SIMD Acceleration**: 3-8x speedup when SIMD support is available

## Installation

```bash
# Install dependencies
cd src/wasm/crates/elex-wasm
cargo build --release --target wasm32-unknown-unknown
```

## Quick Start

### Browser

```javascript
import { ElexSwarm, QueryType, Complexity } from 'elex-wasm';

// Initialize the swarm
const swarm = await new ElexSwarm({
    topology: 'hierarchical-mesh',
    maxAgents: 50,
    enableTelemetry: true,
    enableIndexedDB: true
});

// Process a query
const response = await swarm.query({
    text: "Configure IFLB thresholds for load balancing",
    queryType: QueryType.Parameter,
    complexity: Complexity.Moderate
});

console.log(`Response: ${response.text}`);
console.log(`Confidence: ${response.confidence}`);
console.log(`Latency: ${response.latencyMs}ms`);

// Provide feedback for Q-learning
await swarm.feedback(response.agentId, 0.8, true);

// Get statistics
const stats = await swarm.getSwarmStats();
console.log(`Total queries: ${stats.totalQueries}`);
console.log(`Avg latency: ${stats.avgLatencyMs}ms`);
```

### Node.js

```javascript
const { ElexSwarm, QueryType, Complexity } = require('elex-wasm');

// Same API as browser
const swarm = await new ElexSwarm({
    maxAgents: 100,
    enableTelemetry: true
});

const response = await swarm.query({
    text: "How to optimize MIMO sleep mode?",
    queryType: QueryType.General,
    complexity: Complexity.Moderate
});

console.log(response);
```

## Configuration

### Swarm Options

```typescript
interface SwarmConfig {
    topology?: 'mesh' | 'hierarchical' | 'hierarchical-mesh';
    maxAgents?: number;              // Default: 50
    enableTelemetry?: boolean;       // Default: true
    enableIndexedDB?: boolean;       // Default: true (browser only)
    cacheSizeMB?: number;            // Default: 50
    lazyLoading?: boolean;           // Default: true
    autoSync?: boolean;              // Default: true
    syncIntervalMs?: number;         // Default: 60000 (1 minute)
}
```

### Topology Selection

- **Mesh**: All agents connected to all others. Best for small deployments (<100 agents).
- **Hierarchical**: Coordinators manage agent groups. Simple but has single point of failure.
- **Hierarchical-Mesh** (Recommended): Hybrid approach with coordinators and mesh connectivity.

## API Reference

### ElexSwarm

Main swarm coordinator for multi-agent orchestration.

#### Constructor

```typescript
const swarm = await new ElexSwarm(config: SwarmConfig);
```

#### Methods

##### query()

Process a query through the swarm.

```typescript
const response = await swarm.query({
    text: string,
    queryType: QueryType,
    complexity: Complexity,
    context?: number
}): Promise<QueryResponse>;
```

**Query Types:**
- `QueryType.Parameter`: Parameter configuration query
- `QueryType.Counter`: Counter monitoring query
- `QueryType.Kpi`: KPI analysis query
- `QueryType.Procedure`: Procedure/activation query
- `QueryType.Troubleshoot`: Troubleshooting query
- `QueryType.General`: General knowledge query

**Complexity Levels:**
- `Complexity.Simple`: Single-parameter query
- `Complexity.Moderate`: Multi-parameter or single-feature query
- `Complexity.Complex`: Cross-feature or system-wide query

##### feedback()

Provide feedback on a previous query (for Q-learning).

```typescript
await swarm.feedback(
    agentId: string,
    reward: number,  // -1.0 to +1.0
    success: boolean
): Promise<void>;
```

##### getAgentStats()

Get statistics for a specific agent.

```typescript
const stats = await swarm.getAgentStats(agentId: string): Promise<AgentStats>;
```

**AgentStats Interface:**
```typescript
interface AgentStats {
    agentId: string;
    featureCode: string;
    featureName: string;
    queryCount: number;
    successCount: number;
    successRate: number;
    avgLatencyMs: number;
    confidence: number;
    health: number;
    qTableEntries: number;
    trajectoryCount: number;
    epsilon: number;
    memoryEntries: number;
    status: string;
}
```

##### getSwarmStats()

Get overall swarm statistics.

```typescript
const stats = await swarm.getSwarmStats(): Promise<SwarmStats>;
```

**SwarmStats Interface:**
```typescript
interface SwarmStats {
    totalAgents: number;
    activeAgents: number;
    totalQueries: number;
    totalSuccesses: number;
    avgLatencyMs: number;
    cacheHitRate: number;
    memoryUsageMB: number;
    uptimeMs: number;
    topology: string;
}
```

##### sync()

Synchronize Q-tables with federated learning.

```typescript
await swarm.sync(): Promise<void>;
```

##### persist()

Persist agent state to IndexedDB.

```typescript
await swarm.persist(): Promise<void>;
```

##### shutdown()

Shutdown the swarm and release resources.

```typescript
await swarm.shutdown(): Promise<void>;
```

## Performance Tuning

### Memory Management

The ELEX swarm uses lazy loading to minimize memory footprint:

```javascript
// Enable lazy loading (default)
const swarm = await new ElexSwarm({
    lazyLoading: true,
    maxAgents: 50,
    cacheSizeMB: 50
});

// Agents are loaded on-demand and evicted when cache is full
// LRU eviction policy keeps frequently-used agents in memory
```

### SIMD Acceleration

SIMD provides 3-8x speedup for vector operations:

```javascript
import { isSimdAvailable } from 'elex-wasm';

if (isSimdAvailable()) {
    console.log('SIMD acceleration enabled');
    // Vector operations will use SIMD automatically
} else {
    console.log('SIMD not available, using scalar fallback');
}
```

### IndexedDB Persistence

Enable persistent storage for Q-tables and trajectories:

```javascript
const swarm = await new ElexSwarm({
    enableIndexedDB: true,
    autoSync: true,
    syncIntervalMs: 60000  // Sync every minute
});

// Manual persistence
await swarm.persist();

// Data persists across browser sessions
```

## Telemetry

Monitor swarm performance with built-in telemetry:

```javascript
const swarm = await new ElexSwarm({
    enableTelemetry: true
});

// Telemetry is automatically collected
// Access metrics through stats
const stats = await swarm.getSwarmStats();
console.log(`P95 latency: ${stats.p95LatencyMs}ms`);
console.log(`Success rate: ${stats.successRate}`);
```

## Deployment

### Browser Deployment

1. Build WASM module:
```bash
wasm-pack build --release --target web
```

2. Include in HTML:
```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        import init, { ElexSwarm } from './pkg/elex_wasm.js';

        const swarm = await init().then(() => new ElexSwarm({
            maxAgents: 50,
            enableTelemetry: true
        }));

        const response = await swarm.query({
            text: "Configure IFLB",
            queryType: 0,  // Parameter
            complexity: 1  // Moderate
        });

        console.log(response);
    </script>
</head>
<body>
    <h1>ELEX Swarm Demo</h1>
</body>
</html>
```

### Node.js Deployment

1. Build WASM module:
```bash
wasm-pack build --release --target nodejs
```

2. Use in Node.js:
```javascript
const wasm = require('./pkg/elex_wasm.js');
const { ElexSwarm } = wasm;

async function main() {
    const swarm = await new ElexSwarm({
        maxAgents: 100,
        enableTelemetry: true
    });

    const response = await swarm.query({
        text: "Optimize MIMO sleep",
        queryType: 0,
        complexity: 1
    });

    console.log(response);
}

main();
```

## Error Handling

All async methods return promises that reject on error:

```javascript
try {
    const response = await swarm.query({
        text: "Configure IFLB",
        queryType: QueryType.Parameter,
        complexity: Complexity.Moderate
    });
} catch (error) {
    console.error('Query failed:', error.message);
    // Handle error appropriately
}
```

Common errors:
- **"Agent not found"**: Agent not loaded (enable lazy loading)
- **"Database not initialized"**: IndexedDB not available
- **"Invalid query"**: Missing or malformed query fields

## Best Practices

### 1. Enable Telemetry

Always enable telemetry in production to monitor performance:

```javascript
const swarm = await new ElexSwarm({
    enableTelemetry: true
});
```

### 2. Use Lazy Loading

Enable lazy loading for large swarms to reduce memory:

```javascript
const swarm = await new ElexSwarm({
    lazyLoading: true,
    maxAgents: 50
});
```

### 3. Provide Feedback

Always provide feedback for Q-learning to improve responses:

```javascript
const response = await swarm.query({ ... });

// Get user feedback
const feedback = confirm("Was this response helpful?");

// Record feedback
await swarm.feedback(response.agentId, feedback ? 1.0 : -1.0, feedback);
```

### 4. Handle Errors Gracefully

Always wrap async calls in try-catch:

```javascript
try {
    const response = await swarm.query({ ... });
} catch (error) {
    console.error('Query error:', error);
    // Fallback or retry logic
}
```

### 5. Monitor Memory Usage

Check memory usage periodically:

```javascript
const stats = await swarm.getSwarmStats();
if (stats.memoryUsageMB > stats.cacheSizeMB * 0.9) {
    console.warn('Cache almost full, consider increasing cacheSizeMB');
}
```

## Performance Benchmarks

Expected performance on modern hardware:

| Metric | Value |
|--------|-------|
| Query Routing Latency | <1ms (P95) |
| Response Generation | <500ms (P95) |
| HNSW Search | <1ms (P95) |
| Q-Learning Convergence | <100 interactions |
| Memory per Agent | ~7MB |
| Binary Size | <500KB (compressed) |

## Troubleshooting

### SIMD Not Available

If SIMD is not available, the system falls back to scalar operations:

```javascript
if (!isSimdAvailable()) {
    console.warn('SIMD not available, performance will be reduced');
}
```

### IndexedDB Errors

IndexedDB may not be available in all environments:

```javascript
try {
    await swarm.persist();
} catch (error) {
    if (error.message.includes('indexedDB')) {
        console.warn('IndexedDB not available, using in-memory storage');
    }
}
```

### Memory Pressure

If memory usage is high:

```javascript
const stats = await swarm.getSwarmStats();
if (stats.memoryUsageMB > config.cacheSizeMB) {
    // Reduce cache size or enable lazy loading
    await swarm.shutdown();
    const newSwarm = await new ElexSwarm({
        ...config,
        cacheSizeMB: config.cacheSizeMB / 2
    });
}
```

## License

MIT License - see LICENSE file for details.
