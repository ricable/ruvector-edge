/**
 * Node.js Tests for ELEX WASM
 *
 * Run with: node tests/node_test.js
 */

const assert = require('assert');
const path = require('path');

// Load the WASM module
const pkgPath = path.join(__dirname, '..', 'pkg');
const wasmModule = require(path.join(pkgPath, 'elex_wasm.js'));

async function runTests() {
    console.log('🧪 Running ELEX WASM Node.js Tests\n');

    let passed = 0;
    let failed = 0;

    const tests = [
        {
            name: 'Version Check',
            fn: async () => {
                const version = wasmModule.version();
                assert.ok(version, 'Version should be defined');
                assert.ok(version.includes('.'), 'Version should contain dots');
                console.log(`  ✓ Version: ${version}`);
            }
        },
        {
            name: 'Build Info',
            fn: async () => {
                const info = wasmModule.build_info();
                assert.ok(info, 'Build info should be defined');
                assert.ok(info.includes('ELEX WASM'), 'Build info should contain "ELEX WASM"');
                console.log(`  ✓ ${info}`);
            }
        },
        {
            name: 'Supported Features',
            fn: async () => {
                const features = wasmModule.get_supported_features();
                assert.ok(Array.isArray(features), 'Features should be an array');
                assert.ok(features.length > 0, 'Should have at least one feature');
                assert.ok(features.includes('q-learning'), 'Should include q-learning');
                assert.ok(features.includes('hnsw-index'), 'Should include hnsw-index');
                console.log(`  ✓ Features: ${features.join(', ')}`);
            }
        },
        {
            name: 'SIMD Detection',
            fn: async () => {
                const hasSimd = wasmModule.is_simd_available();
                assert.strictEqual(typeof hasSimd, 'boolean', 'SIMD check should return boolean');
                console.log(`  ✓ SIMD Available: ${hasSimd}`);
            }
        },
        {
            name: 'Topology Creation',
            fn: async () => {
                const mesh = wasmModule.Topology.mesh();
                const hierarchical = wasmModule.Topology.hierarchical();
                const h_mesh = wasmModule.Topology.hierarchical_mesh();
                assert.ok(mesh, 'Mesh topology should be created');
                assert.ok(hierarchical, 'Hierarchical topology should be created');
                assert.ok(h_mesh, 'Hierarchical-mesh topology should be created');
                console.log('  ✓ All topologies created successfully');
            }
        },
        {
            name: 'Swarm Initialization',
            fn: async () => {
                const config = {
                    topology: 'hierarchical-mesh',
                    maxAgents: 10,
                    enableTelemetry: true,
                    lazyLoading: true
                };
                const swarm = await new wasmModule.ElexSwarm(config);
                assert.ok(swarm, 'Swarm should be initialized');
                console.log('  ✓ Swarm initialized successfully');
                await swarm.shutdown();
            }
        },
        {
            name: 'Swarm Query',
            fn: async () => {
                const swarm = await new wasmModule.ElexSwarm({
                    maxAgents: 5,
                    enableTelemetry: true
                });

                const query = {
                    text: 'Configure IFLB thresholds for load balancing',
                    queryType: wasmModule.QueryType.Parameter,
                    complexity: wasmModule.Complexity.Moderate
                };

                const response = await swarm.query(query);
                assert.ok(response, 'Response should be returned');
                assert.ok(response.text, 'Response should have text');
                assert.ok(response.agentId, 'Response should have agent ID');
                assert.ok(typeof response.confidence === 'number', 'Response should have confidence');
                assert.ok(typeof response.latencyMs === 'number', 'Response should have latency');
                console.log(`  ✓ Query processed in ${response.latencyMs.toFixed(2)}ms`);
                console.log(`    Confidence: ${response.confidence.toFixed(2)}`);
                console.log(`    Agent: ${response.agentId}`);

                await swarm.shutdown();
            }
        },
        {
            name: 'Query Types',
            fn: async () => {
                assert.strictEqual(wasmModule.QueryType.Parameter, 0);
                assert.strictEqual(wasmModule.QueryType.Counter, 1);
                assert.strictEqual(wasmModule.QueryType.Kpi, 2);
                assert.strictEqual(wasmModule.QueryType.Procedure, 3);
                assert.strictEqual(wasmModule.QueryType.Troubleshoot, 4);
                assert.strictEqual(wasmModule.QueryType.General, 5);
                console.log('  ✓ All query types defined correctly');
            }
        },
        {
            name: 'Complexity Levels',
            fn: async () => {
                assert.strictEqual(wasmModule.Complexity.Simple, 0);
                assert.strictEqual(wasmModule.Complexity.Moderate, 1);
                assert.strictEqual(wasmModule.Complexity.Complex, 2);
                console.log('  ✓ All complexity levels defined correctly');
            }
        },
        {
            name: 'Swarm Statistics',
            fn: async () => {
                const swarm = await new wasmModule.ElexSwarm({
                    maxAgents: 5,
                    enableTelemetry: true
                });

                // Process a query first
                await swarm.query({
                    text: 'Test query',
                    queryType: wasmModule.QueryType.General,
                    complexity: wasmModule.Complexity.Simple
                });

                const stats = await swarm.getSwarmStats();
                assert.ok(stats, 'Stats should be returned');
                assert.ok(typeof stats.totalAgents === 'number', 'Should have total agents');
                assert.ok(typeof stats.totalQueries === 'number', 'Should have total queries');
                assert.ok(typeof stats.uptimeMs === 'number', 'Should have uptime');
                console.log(`  ✓ Total Agents: ${stats.totalAgents}`);
                console.log(`    Total Queries: ${stats.totalQueries}`);
                console.log(`    Uptime: ${Math.round(stats.uptimeMs)}ms`);

                await swarm.shutdown();
            }
        },
        {
            name: 'Agent Feedback',
            fn: async () => {
                const swarm = await new wasmModule.ElexSwarm({
                    maxAgents: 5,
                    enableTelemetry: true
                });

                const response = await swarm.query({
                    text: 'Test query for feedback',
                    queryType: wasmModule.QueryType.General,
                    complexity: wasmModule.Complexity.Simple
                });

                // Should not throw
                await swarm.feedback(response.agentId, 0.8, true);
                console.log('  ✓ Feedback recorded successfully');

                await swarm.shutdown();
            }
        },
        {
            name: 'Telemetry System',
            fn: async () => {
                const telemetry = new wasmModule.TelemetrySystem(true);

                // Record some metrics
                telemetry.recordQuery(
                    100.0,
                    0.8,
                    'agent_123',
                    'FAJ 121 3094',
                    'Parameter',
                    'Moderate',
                    true
                );

                const metrics = telemetry.get_metrics();
                assert.ok(Array.isArray(metrics), 'Metrics should be an array');
                assert.strictEqual(metrics.length, 1, 'Should have one metric');

                const summary = telemetry.get_summary();
                assert.ok(summary, 'Summary should be returned');
                assert.strictEqual(summary.totalQueries, 1, 'Should have one query');

                telemetry.clear();
                const metricsAfter = telemetry.get_metrics();
                assert.strictEqual(metricsAfter.length, 0, 'Should have no metrics after clear');

                console.log('  ✓ Telemetry system working correctly');
            }
        },
        {
            name: 'Full Query Lifecycle',
            fn: async () => {
                const swarm = await new wasmModule.ElexSwarm({
                    maxAgents: 10,
                    enableTelemetry: true,
                    lazyLoading: true
                });

                // Process multiple queries
                const queries = [
                    'Configure IFLB thresholds',
                    'Optimize MIMO sleep mode',
                    'Check KPIs for cell load'
                ];

                for (const text of queries) {
                    const response = await swarm.query({
                        text,
                        queryType: wasmModule.QueryType.Parameter,
                        complexity: wasmModule.Complexity.Moderate
                    });

                    await swarm.feedback(response.agentId, 0.7, true);
                }

                const stats = await swarm.getSwarmStats();
                assert.ok(stats.totalQueries >= 3, 'Should have processed at least 3 queries');

                console.log(`  ✓ Processed ${stats.totalQueries} queries`);
                console.log(`    Success rate: ${stats.successRate ? (stats.successRate * 100).toFixed(1) + '%' : 'N/A'}`);

                await swarm.shutdown();
            }
        }
    ];

    // Run all tests
    for (const test of tests) {
        try {
            process.stdout.write(`Testing: ${test.name}...`);
            await test.fn();
            console.log('');
            passed++;
        } catch (error) {
            console.log(` ✗`);
            console.error(`  Error: ${error.message}`);
            failed++;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Tests Passed: ${passed}`);
    console.log(`Tests Failed: ${failed}`);
    console.log(`Total Tests: ${passed + failed}`);
    console.log('='.repeat(50));

    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
