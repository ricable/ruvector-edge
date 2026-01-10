#!/usr/bin/env node

/**
 * ELEX WASM RAN SDK - Node.js Test Script
 *
 * Run with: node test-node.js
 *
 * This script tests the ELEX WASM SDK in a Node.js environment.
 */

const wasm = require('./pkg-nodejs/elex_wasm.js');
const { ElexSwarm, QueryType, Complexity, isSimdAvailable, wasm_version } = wasm;

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'white') {
    console.log(colorize(message, color));
}

function header(text) {
    console.log(`\n${colorize('═'.repeat(60), 'dim')}`);
    console.log(colorize(`  ${text}`, 'cyan bright'));
    console.log(colorize('═'.repeat(60), 'dim')}\n`);
}

function success(text) {
    log(`✓ ${text}`, 'green');
}

function error(text) {
    log(`✗ ${text}`, 'red');
}

function info(text) {
    log(`  ${text}`, 'dim');
}

async function runTests() {
    try {
        header('ELEX WASM RAN SDK - Node.js Test Suite');

        // ============================================================
        // 1. System Information
        // ============================================================

        header('1. System Information');

        const simd = isSimdAvailable();
        log(`WASM Version: ${wasm_version()}`, 'cyan');
        log(`SIMD Available: ${simd ? 'Yes' : 'No'}`, simd ? 'green' : 'yellow');
        log(`Node.js Version: ${process.version}`, 'cyan');
        log(`Platform: ${process.platform} ${process.arch}`, 'cyan');

        // ============================================================
        // 2. Initialize WASM
        // ============================================================

        header('2. WASM Initialization');
        info('Loading WASM module...');
        await wasm.default();
        success('WASM module loaded');

        // ============================================================
        // 3. Create Swarm
        // ============================================================

        header('3. Swarm Initialization');
        info('Creating swarm with configuration:');

        const config = {
            topology: 'hierarchical-mesh',
            maxAgents: 50,
            enableTelemetry: true,
            enableIndexedDB: false,  // Not available in Node.js
            lazyLoading: true,
            cacheSizeMB: 50
        };

        console.log(JSON.stringify(config, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

        info('Initializing swarm...');
        const swarm = await new ElexSwarm(config);
        success('Swarm initialized');

        // ============================================================
        // 4. Test Queries
        // ============================================================

        header('4. Query Processing Test');

        const queries = [
            {
                text: "Configure IFLB thresholds for load balancing",
                type: QueryType.Parameter,
                complexity: Complexity.Moderate,
                expected: ["IFLB", "load", "balancing", "threshold"]
            },
            {
                text: "Optimize MIMO sleep mode for energy saving",
                type: QueryType.Parameter,
                complexity: Complexity.Moderate,
                expected: ["MIMO", "sleep", "energy"]
            },
            {
                text: "Enable LTE carrier aggregation with CA configuration",
                type: QueryType.Procedure,
                complexity: Complexity.Complex,
                expected: ["CA", "carrier", "aggregation"]
            },
            {
                text: "Check LTE handover parameters and timers",
                type: QueryType.General,
                complexity: Complexity.Moderate,
                expected: ["handover", "LTE", "timer"]
            },
            {
                text: "Configure DRX parameters for UE power saving",
                type: QueryType.Parameter,
                complexity: Complexity.Moderate,
                expected: ["DRX", "power", "UE"]
            }
        ];

        const results = [];

        for (let i = 0; i < queries.length; i++) {
            const q = queries[i];
            const num = i + 1;

            log(`\n[${num}/${queries.length}] Query: ${q.text}`, 'blue');
            info(`Type: ${QueryType[q.type]}, Complexity: ${Complexity[q.complexity]}`);

            const startTime = Date.now();
            const response = await swarm.query({
                text: q.text,
                queryType: q.type,
                complexity: q.complexity
            });
            const elapsed = Date.now() - startTime;

            results.push({ query: q, response, elapsed });

            log(`Response: ${response.text.substring(0, 80)}...`, 'cyan');
            log(`Agent: ${response.agentId}`, 'dim');
            log(`Feature: ${response.featureCode}`, 'dim');
            log(`Confidence: ${(response.confidence * 100).toFixed(1)}%`, response.confidence > 0.7 ? 'green' : 'yellow');
            log(`Latency: ${response.latencyMs}ms (actual: ${elapsed}ms)`, 'dim');
        }

        // ============================================================
        // 5. Statistics
        // ============================================================

        header('5. Swarm Statistics');

        const stats = await swarm.getSwarmStats();
        const statsDisplay = {
            'Total Agents': stats.totalAgents,
            'Active Agents': stats.activeAgents,
            'Total Queries': stats.totalQueries,
            'Total Successes': stats.totalSuccesses,
            'Success Rate': `${(stats.successRate * 100).toFixed(1)}%`,
            'Average Latency': `${stats.avgLatencyMs.toFixed(2)}ms`,
            'Cache Hit Rate': `${(stats.cacheHitRate * 100).toFixed(1)}%`,
            'Memory Usage': `${stats.memoryUsageMB.toFixed(2)}MB`,
            'Uptime': `${(stats.uptimeMs / 1000).toFixed(2)}s`,
            'Topology': stats.topology
        };

        Object.entries(statsDisplay).forEach(([key, value]) => {
            log(`${key.padEnd(20)}: ${value}`, 'cyan');
        });

        // ============================================================
        // 6. Performance Summary
        // ============================================================

        header('6. Performance Summary');

        const latencies = results.map(r => r.elapsed);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);

        const confidences = results.map(r => response.confidence);
        const avgConfidence = results.reduce((s, r) => s + r.response.confidence, 0) / results.length;

        const perfDisplay = {
            'Total Queries': results.length,
            'Average Latency': `${avgLatency.toFixed(2)}ms`,
            'Min Latency': `${minLatency}ms`,
            'Max Latency': `${maxLatency}ms`,
            'Average Confidence': `${(avgConfidence * 100).toFixed(1)}%`
        };

        Object.entries(perfDisplay).forEach(([key, value]) => {
            const numValue = parseFloat(value);
            const color = key.includes('Latency') ?
                (numValue < 500 ? 'green' : 'yellow') : 'cyan';
            log(`${key.padEnd(20)}: ${value}`, color);
        });

        // ============================================================
        // 7. Cleanup
        // ============================================================

        header('7. Cleanup');
        info('Shutting down swarm...');
        await swarm.shutdown();
        success('Swarm shutdown complete');

        // ============================================================
        // 8. Final Status
        // ============================================================

        header('Test Complete');

        const allPassed = results.length === queries.length &&
                         avgLatency < 500 &&
                         avgConfidence > 0.5;

        if (allPassed) {
            success('All tests passed!');
            log('The ELEX WASM SDK is functioning correctly.', 'green');
            process.exit(0);
        } else {
            error('Some tests failed!');
            process.exit(1);
        }

    } catch (err) {
        error(`Error: ${err.message}`);
        console.error(err);
        process.exit(1);
    }
}

// Run tests
runTests().catch(err => {
    error(`Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
});
