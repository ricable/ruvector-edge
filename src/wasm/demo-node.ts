#!/usr/bin/env bun
/**
 * ELEX Edge AI Agent Swarm - Advanced Node.js/Bun Demo
 * 
 * This comprehensive demo showcases ALL available functionality from:
 * - Rust WASM bindings (elex-wasm)
 * - TypeScript core modules (types, utils, agents)
 * 
 * Usage:
 *   bun run demo-node.ts                  # Run all demos
 *   bun run demo-node.ts --benchmark      # Run only benchmark
 *   bun run demo-node.ts --json           # Output JSON results
 *   bun run demo-node.ts --demo=info      # Run specific demo section
 *   bun run demo-node.ts --help           # Show help
 * 
 * Features demonstrated:
 * - Swarm initialization with all topology options
 * - All query types and complexity levels
 * - Q-learning feedback system
 * - Agent and swarm statistics
 * - Performance measurement utilities
 * - Rate limiting and batching
 * - Federated sync and persistence
 */

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface DemoOptions {
    benchmark: boolean;
    json: boolean;
    verbose: boolean;
    demo?: string;
    help: boolean;
}

function parseArgs(): DemoOptions {
    const args = process.argv.slice(2);
    return {
        benchmark: args.includes('--benchmark') || args.includes('-b'),
        json: args.includes('--json') || args.includes('-j'),
        verbose: args.includes('--verbose') || args.includes('-v'),
        demo: args.find(a => a.startsWith('--demo='))?.split('=')[1],
        help: args.includes('--help') || args.includes('-h'),
    };
}

function showHelp(): void {
    console.log(`
ELEX Edge AI Agent Swarm - Demo Runner

Usage: bun run demo-node.ts [options]

Options:
  --benchmark, -b    Run only the benchmark section
  --json, -j         Output results as JSON (for CI integration)
  --verbose, -v      Enable verbose output
  --demo=<name>      Run specific demo (info, topology, query, feedback, stats, sync, benchmark)
  --help, -h         Show this help message

Examples:
  bun run demo-node.ts                    # Run all demos
  bun run demo-node.ts --benchmark --json # Run benchmark with JSON output
  bun run demo-node.ts --demo=info        # Run only WASM info demo
`);
}

const options = parseArgs();

if (options.help) {
    showHelp();
    process.exit(0);
}

// ============================================================================
// WASM Module Loading with Error Handling
// ============================================================================

const wasmPath = './crates/elex-wasm/pkg-nodejs/elex_wasm.js';

let wasm: typeof import('./crates/elex-wasm/pkg-nodejs/elex_wasm.js');

try {
    wasm = await import(wasmPath);
} catch (err) {
    console.error('❌ WASM module not found at:', wasmPath);
    console.error('');
    console.error('Build the WASM module first:');
    console.error('  bun run build:wasm');
    console.error('');
    console.error('Or build manually:');
    console.error('  cd src/wasm && wasm-pack build --target nodejs crates/elex-wasm');
    process.exit(1);
}

// Import all WASM exports
const {
    ElexSwarm,
    Topology,
    QueryType,
    Complexity,
    is_simd_available,
    version,
    build_info,
    get_supported_features,
} = wasm;

// Export to make this a proper ES module
export { };

// ============================================================================
// Utility Classes (TypeScript Native)
// ============================================================================

/**
 * High-resolution timer for performance measurement
 */
class Timer {
    private startTime: number = 0;
    private endTime: number = 0;
    private running: boolean = false;

    start(): void {
        this.startTime = performance.now();
        this.running = true;
    }

    stop(): number {
        this.endTime = performance.now();
        this.running = false;
        return this.elapsed;
    }

    get elapsed(): number {
        if (this.running) {
            return performance.now() - this.startTime;
        }
        return this.endTime - this.startTime;
    }

    reset(): void {
        this.startTime = 0;
        this.endTime = 0;
        this.running = false;
    }
}

/**
 * Benchmark result structure for JSON output
 */
interface BenchmarkResult {
    iterations: number;
    totalTimeMs: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    throughputQps: number;
    timestamp: string;
    wasmVersion: string;
    simdEnabled: boolean;
}

/**
 * Rolling average calculator for latency tracking
 */
class RollingAverage {
    private values: number[] = [];
    private readonly maxSize: number;
    private sum: number = 0;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
    }

    add(value: number): void {
        this.values.push(value);
        this.sum += value;
        if (this.values.length > this.maxSize) {
            this.sum -= this.values.shift()!;
        }
    }

    get average(): number {
        if (this.values.length === 0) return 0;
        return this.sum / this.values.length;
    }

    get count(): number {
        return this.values.length;
    }

    reset(): void {
        this.values = [];
        this.sum = 0;
    }
}

/**
 * Rate limiter for controlled query execution
 */
class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number;

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    tryAcquire(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens--;
            return true;
        }
        return false;
    }

    async acquire(): Promise<void> {
        while (!this.tryAcquire()) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function printHeader(title: string): void {
    const line = '═'.repeat(60);
    console.log(`\n╔${line}╗`);
    console.log(`║  ${title.padEnd(56)}  ║`);
    console.log(`╚${line}╝\n`);
}

function printSection(title: string): void {
    console.log(`\n┌─ ${title} ${'─'.repeat(55 - title.length)}┐`);
}

function printSubsection(title: string): void {
    console.log(`\n  ▸ ${title}`);
}

function printResult(label: string, value: unknown): void {
    console.log(`    ${label}: ${value}`);
}

function formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// Demo Sections
// ============================================================================

async function demoWasmInfo(): Promise<void> {
    printSection('WASM Module Information');

    printResult('Version', version());
    printResult('Build Info', build_info());
    printResult('SIMD Available', is_simd_available() ? 'Yes ✓' : 'No ✗');

    printSubsection('Supported Features');
    const features = get_supported_features();
    features.forEach((feature: string, index: number) => {
        console.log(`      ${index + 1}. ${feature}`);
    });
}

async function demoTopologyOptions(): Promise<void> {
    printSection('Topology Options');

    const topologies = [
        { name: 'Mesh', factory: () => Topology.mesh(), description: 'All agents connected to all others' },
        { name: 'Hierarchical', factory: () => Topology.hierarchical(), description: 'Coordinators manage agent groups' },
        { name: 'Hierarchical Mesh', factory: () => Topology.hierarchical_mesh(), description: 'Hybrid approach (recommended)' },
    ];

    for (const topo of topologies) {
        const topology = topo.factory();
        printResult(topo.name, topo.description);
    }
}

async function demoQueryTypes(): Promise<void> {
    printSection('Query Types & Complexity Levels');

    printSubsection('Query Types');
    const queryTypes = [
        { type: QueryType.Parameter, name: 'Parameter', description: 'Configuration parameter queries' },
        { type: QueryType.Counter, name: 'Counter', description: 'Performance counter queries' },
        { type: QueryType.Kpi, name: 'KPI', description: 'Key Performance Indicator queries' },
        { type: QueryType.Procedure, name: 'Procedure', description: 'Operational procedure queries' },
        { type: QueryType.Troubleshoot, name: 'Troubleshoot', description: 'Problem diagnosis queries' },
        { type: QueryType.General, name: 'General', description: 'General information queries' },
    ];

    for (const qt of queryTypes) {
        console.log(`      [${qt.type}] ${qt.name.padEnd(15)} - ${qt.description}`);
    }

    printSubsection('Complexity Levels');
    const complexities = [
        { level: Complexity.Simple, name: 'Simple', description: 'Single-agent resolution' },
        { level: Complexity.Moderate, name: 'Moderate', description: 'May require context lookup' },
        { level: Complexity.Complex, name: 'Complex', description: 'Multi-agent collaboration needed' },
    ];

    for (const c of complexities) {
        console.log(`      [${c.level}] ${c.name.padEnd(10)} - ${c.description}`);
    }
}

async function demoSwarmLifecycle(): Promise<void> {
    printSection('Swarm Lifecycle');

    const timer = new Timer();

    // Test different configurations
    const configs = [
        {
            name: 'Minimal (Lazy Loading)',
            config: {
                topology: Topology.mesh(),
                maxAgents: 5,
                enableTelemetry: false,
                enableIndexedDB: false,
                lazyLoading: true,
                cacheSizeMB: 10,
            },
        },
        {
            name: 'Standard (Telemetry Enabled)',
            config: {
                topology: Topology.hierarchical_mesh(),
                maxAgents: 50,
                enableTelemetry: true,
                enableIndexedDB: false,
                lazyLoading: true,
                cacheSizeMB: 50,
            },
        },
        {
            name: 'Full (All Features)',
            config: {
                topology: Topology.hierarchical_mesh(),
                maxAgents: 100,
                enableTelemetry: true,
                enableIndexedDB: false,
                lazyLoading: false,
                cacheSizeMB: 100,
                autoSync: true,
                syncIntervalMs: 30000,
            },
        },
    ];

    for (const { name, config } of configs) {
        printSubsection(`Configuration: ${name}`);

        timer.reset();
        timer.start();
        try {
            const swarm = await new ElexSwarm(config);
            const initTime = timer.stop();

            printResult('Initialization Time', formatDuration(initTime));
            printResult('Max Agents', config.maxAgents);
            printResult('Cache Size', `${config.cacheSizeMB} MB`);

            // Cleanup
            await swarm.shutdown();
        } catch (error) {
            printResult('Error', (error as Error).message);
        }
    }
}

async function demoQueryProcessing(): Promise<void> {
    printSection('Query Processing');

    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 10,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: true,
        cacheSizeMB: 50,
    };

    const swarm = await new ElexSwarm(config);
    const latencyTracker = new RollingAverage(100);
    const timer = new Timer();

    // Define comprehensive test queries
    const testQueries = [
        // Parameter queries
        { text: 'Configure MIMO sleep mode timer', queryType: QueryType.Parameter, complexity: Complexity.Simple },
        { text: 'Set IFLB thresholds for inter-frequency load balancing', queryType: QueryType.Parameter, complexity: Complexity.Moderate },
        { text: 'Optimize PRACH configuration for dense urban deployment', queryType: QueryType.Parameter, complexity: Complexity.Complex },

        // Counter queries
        { text: 'Check pmRrcConnEstabSucc counter value', queryType: QueryType.Counter, complexity: Complexity.Simple },
        { text: 'Analyze handover failure counters per cell', queryType: QueryType.Counter, complexity: Complexity.Moderate },

        // KPI queries
        { text: 'Calculate cell availability KPI', queryType: QueryType.Kpi, complexity: Complexity.Simple },
        { text: 'Compute VoLTE MOS score trends', queryType: QueryType.Kpi, complexity: Complexity.Complex },

        // Procedure queries
        { text: 'Steps to enable carrier aggregation', queryType: QueryType.Procedure, complexity: Complexity.Moderate },

        // Troubleshooting queries
        { text: 'Diagnose high RACH failure rate', queryType: QueryType.Troubleshoot, complexity: Complexity.Complex },
        { text: 'Root cause analysis for call drops', queryType: QueryType.Troubleshoot, complexity: Complexity.Complex },

        // General queries
        { text: 'Explain PUSCH power control mechanism', queryType: QueryType.General, complexity: Complexity.Moderate },
    ];

    printSubsection('Processing Queries');
    let successCount = 0;
    let totalLatency = 0;

    for (let i = 0; i < testQueries.length; i++) {
        const query = testQueries[i];

        timer.reset();
        timer.start();

        try {
            const response = await swarm.query(query);
            const latency = timer.stop();

            latencyTracker.add(latency);
            totalLatency += latency;
            successCount++;

            console.log(`\n    Query ${i + 1}/${testQueries.length}:`);
            console.log(`      Input: "${query.text.substring(0, 45)}..."`);
            console.log(`      Type: ${['Parameter', 'Counter', 'KPI', 'Procedure', 'Troubleshoot', 'General'][query.queryType]}`);
            console.log(`      Agent: ${response.agentId.substring(0, 16)}...`);
            console.log(`      Feature: ${response.featureCode}`);
            console.log(`      Confidence: ${(response.confidence * 100).toFixed(1)}%`);
            console.log(`      Latency: ${formatDuration(latency)}`);
            console.log(`      Response: "${response.text.substring(0, 60)}..."`);
        } catch (error) {
            console.log(`\n    Query ${i + 1} failed: ${(error as Error).message}`);
        }
    }

    printSubsection('Query Statistics');
    printResult('Total Queries', testQueries.length);
    printResult('Successful', successCount);
    printResult('Success Rate', `${((successCount / testQueries.length) * 100).toFixed(1)}%`);
    printResult('Avg Latency', formatDuration(latencyTracker.average));
    printResult('Total Time', formatDuration(totalLatency));

    // Cleanup
    await swarm.shutdown();
}

async function demoFeedbackSystem(): Promise<void> {
    printSection('Q-Learning Feedback System');

    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 10,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: true,
        cacheSizeMB: 50,
    };

    const swarm = await new ElexSwarm(config);

    // Process a query to get agent ID
    const query = {
        text: 'Configure MIMO antenna tilting',
        queryType: QueryType.Parameter,
        complexity: Complexity.Moderate,
    };

    printSubsection('Initial Query');
    const response = await swarm.query(query);
    printResult('Agent ID', response.agentId);
    printResult('Initial Confidence', `${(response.confidence * 100).toFixed(1)}%`);

    // Simulate feedback loop
    printSubsection('Feedback Simulation');
    const feedbackScenarios = [
        { reward: 1.0, success: true, description: 'Positive - Excellent response' },
        { reward: 0.5, success: true, description: 'Positive - Good response' },
        { reward: 0.0, success: true, description: 'Neutral - Acceptable' },
        { reward: -0.5, success: false, description: 'Negative - Room for improvement' },
        { reward: 1.0, success: true, description: 'Positive - Recovery' },
    ];

    for (const scenario of feedbackScenarios) {
        try {
            await swarm.feedback(response.agentId, scenario.reward, scenario.success);
            console.log(`    Feedback: ${scenario.description} (reward: ${scenario.reward.toFixed(1)})`);
        } catch (error) {
            console.log(`    Feedback failed: ${(error as Error).message}`);
        }
    }

    // Cleanup
    await swarm.shutdown();
}

async function demoSwarmStatistics(): Promise<void> {
    printSection('Swarm & Agent Statistics');

    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 20,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: false,
        cacheSizeMB: 50,
    };

    const swarm = await new ElexSwarm(config);

    // Run some queries to generate statistics
    const queries = [
        { text: 'Query 1: Parameter check', queryType: QueryType.Parameter, complexity: Complexity.Simple },
        { text: 'Query 2: Counter analysis', queryType: QueryType.Counter, complexity: Complexity.Moderate },
        { text: 'Query 3: KPI calculation', queryType: QueryType.Kpi, complexity: Complexity.Complex },
        { text: 'Query 4: Troubleshooting', queryType: QueryType.Troubleshoot, complexity: Complexity.Complex },
    ];

    let lastAgentId = '';
    for (const query of queries) {
        const response = await swarm.query(query);
        lastAgentId = response.agentId;
    }

    // Get swarm statistics
    printSubsection('Swarm Statistics');
    const swarmStats = await swarm.get_swarm_stats();
    printResult('Total Agents', swarmStats.totalAgents);
    printResult('Active Agents', swarmStats.activeAgents);
    printResult('Total Queries', swarmStats.totalQueries);
    printResult('Total Successes', swarmStats.totalSuccesses);
    printResult('Avg Latency', formatDuration(swarmStats.avgLatencyMs));
    printResult('Uptime', formatDuration(swarmStats.uptimeMs));

    // Get agent-specific statistics
    if (lastAgentId) {
        printSubsection('Agent Statistics (Last Active)');
        try {
            const agentStats = await swarm.get_agent_stats(lastAgentId);
            printResult('Agent ID', agentStats.agentId.substring(0, 24) + '...');
            printResult('Feature Code', agentStats.featureCode);
            printResult('Feature Name', agentStats.featureName);
            printResult('Query Count', agentStats.queryCount);
            printResult('Success Count', agentStats.successCount);
            printResult('Success Rate', `${(agentStats.successRate * 100).toFixed(1)}%`);
            printResult('Avg Latency', formatDuration(agentStats.avgLatencyMs));
            printResult('Confidence', `${(agentStats.confidence * 100).toFixed(1)}%`);
            printResult('Health', `${(agentStats.health * 100).toFixed(1)}%`);
        } catch (error) {
            console.log(`    Could not retrieve agent stats: ${(error as Error).message}`);
        }
    }

    // Cleanup
    await swarm.shutdown();
}

async function demoSyncAndPersist(): Promise<void> {
    printSection('Sync & Persistence');

    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 10,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: true,
        cacheSizeMB: 50,
        autoSync: true,
        syncIntervalMs: 60000,
    };

    const swarm = await new ElexSwarm(config);
    const timer = new Timer();

    // Federated Sync
    printSubsection('Federated Learning Sync');
    timer.reset();
    timer.start();
    await swarm.sync();
    const syncTime = timer.stop();
    printResult('Sync Time', formatDuration(syncTime));
    printResult('Status', 'Completed ✓');

    // Persistence (Note: IndexedDB not available in Node.js)
    printSubsection('State Persistence');
    timer.reset();
    timer.start();
    await swarm.persist();
    const persistTime = timer.stop();
    printResult('Persist Time', formatDuration(persistTime));
    printResult('Status', 'Completed ✓ (No-op in Node.js without IndexedDB)');

    // Cleanup
    await swarm.shutdown();
}

async function demoPerformanceUtilities(): Promise<void> {
    printSection('Performance Utilities (TypeScript)');

    // Timer Demo
    printSubsection('High-Resolution Timer');
    const timer = new Timer();
    timer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    const elapsed = timer.stop();
    printResult('100ms sleep measured as', formatDuration(elapsed));

    // Rolling Average Demo
    printSubsection('Rolling Average Calculator');
    const avg = new RollingAverage(5);
    const values = [10, 20, 30, 40, 50, 60, 70];
    for (const v of values) {
        avg.add(v);
    }
    printResult('Values added', values.join(', '));
    printResult('Window size', 5);
    printResult('Current average', avg.average.toFixed(2));
    printResult('Sample count', avg.count);

    // Rate Limiter Demo
    printSubsection('Rate Limiter');
    const limiter = new RateLimiter(3, 10); // 3 tokens, 10 per second refill
    let acquired = 0;
    for (let i = 0; i < 5; i++) {
        if (limiter.tryAcquire()) acquired++;
    }
    printResult('Tokens requested', 5);
    printResult('Tokens acquired', acquired);
    printResult('Rate limit', '3 tokens, 10/sec refill');
}

async function demoRateLimitedQueries(): Promise<void> {
    printSection('Rate-Limited Query Execution');

    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 10,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: true,
        cacheSizeMB: 50,
    };

    const swarm = await new ElexSwarm(config);
    const limiter = new RateLimiter(2, 5); // 2 concurrent, 5/sec
    const timer = new Timer();

    const queries = Array.from({ length: 5 }, (_, i) => ({
        text: `Batch query ${i + 1}: Parameter optimization`,
        queryType: QueryType.Parameter,
        complexity: Complexity.Simple,
    }));

    printSubsection('Executing 5 Queries with Rate Limiting');
    timer.start();

    let completed = 0;
    for (const query of queries) {
        await limiter.acquire();
        const response = await swarm.query(query);
        completed++;
        console.log(`    Query ${completed}/5 completed (confidence: ${(response.confidence * 100).toFixed(0)}%)`);
    }

    const totalTime = timer.stop();
    printResult('Total Queries', queries.length);
    printResult('Total Time', formatDuration(totalTime));
    printResult('Avg Time per Query', formatDuration(totalTime / queries.length));

    // Cleanup
    await swarm.shutdown();
}

async function demoBenchmark(): Promise<void> {
    printSection('Performance Benchmark');

    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 50,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: true,
        cacheSizeMB: 100,
    };

    const swarm = await new ElexSwarm(config);
    const latencyTracker = new RollingAverage(1000);
    const timer = new Timer();

    const ITERATIONS = 50;

    printSubsection(`Running ${ITERATIONS} Query Iterations`);

    timer.start();
    let minLatency = Infinity;
    let maxLatency = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        const queryTimer = new Timer();
        queryTimer.start();

        await swarm.query({
            text: `Benchmark query ${i}`,
            queryType: QueryType.Parameter,
            complexity: Complexity.Simple,
        });

        const latency = queryTimer.stop();
        latencyTracker.add(latency);
        minLatency = Math.min(minLatency, latency);
        maxLatency = Math.max(maxLatency, latency);

        // Progress indicator
        if ((i + 1) % 10 === 0) {
            console.log(`    Progress: ${i + 1}/${ITERATIONS} queries completed`);
        }
    }

    const totalTime = timer.stop();

    printSubsection('Benchmark Results');
    printResult('Total Queries', ITERATIONS);
    printResult('Total Time', formatDuration(totalTime));
    printResult('Throughput', `${(ITERATIONS / (totalTime / 1000)).toFixed(2)} queries/sec`);
    printResult('Avg Latency', formatDuration(latencyTracker.average));
    printResult('Min Latency', formatDuration(minLatency));
    printResult('Max Latency', formatDuration(maxLatency));

    // Get final statistics
    const stats = await swarm.get_swarm_stats();
    printResult('Total Swarm Queries', stats.totalQueries);
    printResult('Swarm Uptime', formatDuration(stats.uptimeMs));

    // Cleanup
    await swarm.shutdown();
}

// ============================================================================
// Main Entry Point
// ============================================================================

// Demo name to function mapping
const demoMap: Record<string, () => Promise<void>> = {
    info: demoWasmInfo,
    topology: demoTopologyOptions,
    query: demoQueryProcessing,
    feedback: demoFeedbackSystem,
    stats: demoSwarmStatistics,
    sync: demoSyncAndPersist,
    benchmark: demoBenchmark,
};

async function runBenchmarkWithJson(): Promise<void> {
    const config = {
        topology: Topology.hierarchical_mesh(),
        maxAgents: 50,
        enableTelemetry: true,
        enableIndexedDB: false,
        lazyLoading: true,
        cacheSizeMB: 100,
    };

    const swarm = await new ElexSwarm(config);
    const latencyTracker = new RollingAverage(1000);
    const timer = new Timer();

    const ITERATIONS = 50;
    timer.start();
    let minLatency = Infinity;
    let maxLatency = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        const queryTimer = new Timer();
        queryTimer.start();
        await swarm.query({
            text: `Benchmark query ${i}`,
            queryType: QueryType.Parameter,
            complexity: Complexity.Simple,
        });
        const latency = queryTimer.stop();
        latencyTracker.add(latency);
        minLatency = Math.min(minLatency, latency);
        maxLatency = Math.max(maxLatency, latency);
    }

    const totalTime = timer.stop();
    await swarm.shutdown();

    const result: BenchmarkResult = {
        iterations: ITERATIONS,
        totalTimeMs: totalTime,
        avgLatencyMs: latencyTracker.average,
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        throughputQps: ITERATIONS / (totalTime / 1000),
        timestamp: new Date().toISOString(),
        wasmVersion: version(),
        simdEnabled: is_simd_available(),
    };

    console.log(JSON.stringify(result, null, 2));
}

async function main() {
    // Handle --benchmark --json for CI
    if (options.benchmark && options.json) {
        await runBenchmarkWithJson();
        return;
    }

    // Handle single demo selection
    if (options.demo) {
        const demoFn = demoMap[options.demo];
        if (!demoFn) {
            console.error(`❌ Unknown demo: ${options.demo}`);
            console.error(`Available demos: ${Object.keys(demoMap).join(', ')}`);
            process.exit(1);
        }
        printHeader(`ELEX Demo: ${options.demo}`);
        await demoFn();
        return;
    }

    // Handle benchmark only
    if (options.benchmark) {
        printHeader('ELEX Benchmark');
        await demoBenchmark();
        return;
    }

    // Full demo
    printHeader('ELEX Edge AI Agent Swarm - Advanced TypeScript/WASM Demo');

    console.log('This demo showcases all available functionality from both');
    console.log('Rust WASM bindings and TypeScript core modules.\n');

    const timer = new Timer();
    timer.start();

    try {
        // Run all demo sections
        await demoWasmInfo();
        await demoTopologyOptions();
        await demoQueryTypes();
        await demoSwarmLifecycle();
        await demoQueryProcessing();
        await demoFeedbackSystem();
        await demoSwarmStatistics();
        await demoSyncAndPersist();
        await demoPerformanceUtilities();
        await demoRateLimitedQueries();
        await demoBenchmark();

        const totalTime = timer.stop();

        printHeader('Demo Complete');
        console.log(`✓ All sections executed successfully`);
        console.log(`✓ Total execution time: ${formatDuration(totalTime)}`);
        console.log(`\nFor browser demo, run: bun run serve:browser`);
        console.log(`For more details, see: EXPERIENCE_GUIDE.md`);

    } catch (error) {
        console.error('\n✗ Demo failed with error:', error);
        process.exit(1);
    }
}

main().catch(console.error);
