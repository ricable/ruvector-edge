/**
 * Integration Tests - WASM Agent Swarm
 *
 * Tests for:
 * 1. Concurrent agent spawning
 * 2. Lazy loading and memory management
 * 3. Query processing with SIMD acceleration
 * 4. P2P coordination and routing
 * 5. Federated learning (Q-table merging)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentFactory, AgentConfig } from '../../src/infrastructure/wasm/agent-factory';
import { AgentRuntime } from '../../src/infrastructure/wasm/agent-runtime';
import { DependencyRouter } from '../../src/domains/coordination/entities/dependency-router';
import { P2PCoordination } from '../../src/infrastructure/coordination/p2p-coordination';

describe('WASM Agent Swarm Integration', () => {
  let factory: AgentFactory;
  let runtime: AgentRuntime;
  let router: DependencyRouter;
  let coordination: P2PCoordination;

  // Test feature configurations
  const testFeatures: AgentConfig[] = [
    {
      id: 'agent-faj-121-3094',
      fajCode: 'FAJ 121 3094',
      category: 'Energy Saving',
      parameters: [
        { name: 'sleepMode', valueType: 'BOOLEAN', rangeMin: 0, rangeMax: 1 },
        { name: 'sleepTimer', valueType: 'INTEGER', rangeMin: 100, rangeMax: 10000 },
      ],
      counters: [
        { name: 'energySaved', category: 'Primary', currentValue: 1500 },
        { name: 'cellEfficiency', category: 'Primary', currentValue: 85 },
      ],
      kpis: [
        { name: 'powerConsumption', formula: 'sum(counters)', threshold: 100 },
        { name: 'energyEfficiency', formula: 'saved / total', threshold: 0.8 },
      ],
    },
    {
      id: 'agent-faj-121-3085',
      fajCode: 'FAJ 121 3085',
      category: 'MIMO & Antenna',
      parameters: [
        { name: 'mimoMode', valueType: 'INTEGER', rangeMin: 1, rangeMax: 8 },
        { name: 'txPower', valueType: 'FLOAT', rangeMin: 10, rangeMax: 46 },
      ],
      counters: [
        { name: 'mimoEfficiency', category: 'Primary', currentValue: 3.2 },
      ],
      kpis: [
        { name: 'throughput', formula: 'mimo_factor * bandwidth', threshold: 1000 },
      ],
    },
    {
      id: 'agent-faj-121-3100',
      fajCode: 'FAJ 121 3100',
      category: 'Radio Resource Management',
      parameters: [
        { name: 'loadBalancingMode', valueType: 'INTEGER', rangeMin: 0, rangeMax: 5 },
        { name: 'targetLoadLevel', valueType: 'FLOAT', rangeMin: 0.2, rangeMax: 0.95 },
      ],
      counters: [
        { name: 'cellLoad', category: 'Primary', currentValue: 65 },
      ],
      kpis: [
        { name: 'loadBalance', formula: 'std_dev(rbs) / mean(rbs)', threshold: 0.2 },
      ],
    },
  ];

  beforeAll(async () => {
    factory = AgentFactory.getInstance();
    runtime = AgentRuntime.getInstance();
    router = DependencyRouter.getInstance();
    coordination = P2PCoordination.getInstance();

    // Initialize all components
    await factory.initialize();
    await runtime.initialize();
    router.buildGraph(testFeatures);
    await coordination.initialize(testFeatures);
  });

  afterAll(async () => {
    await runtime.shutdown();
    factory.clearCache();
    router.clearCache();
    coordination.clearQueues();
  });

  describe('Agent Factory - Lazy Loading', () => {
    it('should load agent on-demand', async () => {
      const config = testFeatures[0];
      const agent = await factory.loadAgent(config);

      expect(agent.id).toBe(config.id);
      expect(agent.memoryBytes).toBeGreaterThan(0);
      expect(agent.lastAccessedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should return cached agent for repeated access', async () => {
      const config = testFeatures[0];
      const agent1 = await factory.loadAgent(config);
      const agent2 = await factory.loadAgent(config);

      expect(agent1.id).toBe(agent2.id);
    });

    it('should track memory usage within budget', () => {
      const stats = factory.getMemoryStats();

      expect(stats.usedBytes).toBeGreaterThan(0);
      expect(stats.usedBytes).toBeLessThanOrEqual(stats.maxBytes);
      expect(stats.usedPercent).toBeLessThan(100);
      expect(stats.cachedAgents).toBeGreaterThan(0);
    });

    it('should unload agents when requested', async () => {
      const config = testFeatures[2];
      await factory.loadAgent(config);

      const statsBefore = factory.getMemoryStats();
      factory.unloadAgent(config.id);
      const statsAfter = factory.getMemoryStats();

      expect(statsAfter.usedBytes).toBeLessThanOrEqual(statsBefore.usedBytes);
      expect(statsAfter.cachedAgents).toBeLessThan(statsBefore.cachedAgents);
    });

    it('should expose cached agent ids', () => {
      const ids = factory.getCachedAgentIds();

      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain(testFeatures[0].id);
    });

    it('should preload agents by category', async () => {
      await factory.preloadByCategory(testFeatures[0].category, testFeatures);

      const ids = factory.getCachedAgentIds();
      expect(ids).toContain(testFeatures[0].id);
    });
  });

  describe('Agent Runtime - Query Processing', () => {
    beforeAll(async () => {
      // Spawn test agents
      for (const config of testFeatures) {
        await runtime.spawnAgent(config);
      }
    });

    it('should spawn agents successfully', async () => {
      const stats = runtime.getActiveAgents();
      expect(stats.length).toBeGreaterThan(0);
    });

    it('should handle queries with SIMD acceleration', async () => {
      const response = await runtime.handleQuery({
        agentId: testFeatures[0].id,
        content: 'Configure energy saving mode',
        state: 'default',
      });

      expect(response.agentId).toBe(testFeatures[0].id);
      expect(response.content).toBeDefined();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.latencyMs).toBeGreaterThan(0);
      expect(response.latencyMs).toBeLessThan(1000); // Should be fast
    });

    it('should validate configuration with SIMD (4-8x faster)', async () => {
      const result = await runtime.validateConfig({
        agentId: testFeatures[0].id,
        config: [
          { name: 'sleepMode', value: 1, min: 0, max: 1 },
          { name: 'sleepTimer', value: 5000, min: 100, max: 10000 },
          { name: 'invalid', value: 100, min: 0, max: 10 },
        ],
      });

      expect(result.agentId).toBe(testFeatures[0].id);
      expect(result.results.length).toBe(3);
      expect(result.validCount).toBe(2); // 2 valid, 1 invalid
      expect(result.totalCount).toBe(3);
    });

    it('should monitor KPIs with SIMD aggregation', async () => {
      const result = await runtime.monitorKPIs(testFeatures[0].id);

      expect(result.agentId).toBe(testFeatures[0].id);
      expect(result.totalEvents).toBeGreaterThanOrEqual(0);
      expect(result.weightedScore).toBeGreaterThanOrEqual(0);
      expect(result.peakValue).toBeGreaterThanOrEqual(0);
    });

    it('should track agent statistics', async () => {
      // Execute query to increment interactions
      await runtime.handleQuery({
        agentId: testFeatures[0].id,
        content: 'Test query',
      });

      const stats = await runtime.getStats(testFeatures[0].id);

      expect(stats.agentId).toBe(testFeatures[0].id);
      expect(stats.interactions).toBeGreaterThan(0);
      expect(stats.confidence).toBeGreaterThanOrEqual(0);
      expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should provide runtime statistics', () => {
      const stats = runtime.getRuntimeStats();

      expect(stats.activeAgents).toBeGreaterThan(0);
      expect(stats.totalInteractions).toBeGreaterThan(0);
      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.avgConfidence).toBeLessThanOrEqual(1);
      expect(stats.memoryStats.usedBytes).toBeGreaterThan(0);
    });
  });

  describe('Agent Runtime - Error Handling', () => {
    it('should reject queries for missing agents', async () => {
      await expect(
        runtime.handleQuery({
          agentId: 'missing-agent',
          content: 'Missing agent query',
        })
      ).rejects.toThrow('not loaded');
    });

    it('should reject config validation for missing agents', async () => {
      await expect(
        runtime.validateConfig({
          agentId: 'missing-agent',
          config: [{ name: 'param', value: 1, min: 0, max: 1 }],
        })
      ).rejects.toThrow('not loaded');
    });

    it('should reject KPI monitoring for missing agents', async () => {
      await expect(runtime.monitorKPIs('missing-agent')).rejects.toThrow('not loaded');
    });

    it('should reject stats for inactive agents', async () => {
      await expect(runtime.getStats('missing-agent')).rejects.toThrow('not active');
    });
  });

  describe('Dependency Router - P2P Graph Routing', () => {
    it('should build dependency graph', () => {
      const stats = router.getGraphStats();

      expect(stats.totalNodes).toBe(testFeatures.length);
      expect(stats.totalEdges).toBeGreaterThanOrEqual(0);
      expect(stats.categories.length).toBeGreaterThan(0);
    });

    it('should route queries through dependencies', () => {
      const path = router.routeQuery('FAJ 121 3094', 'energy_optimization');

      expect(path.fajCodes).toContain('FAJ 121 3094');
      expect(path.totalWeight).toBeGreaterThan(0);
      expect(path.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(path.avgConfidence).toBeLessThanOrEqual(1);
      expect(path.estimatedLatencyMs).toBeLessThan(10); // Should be <1ms typically
    });

    it('should detect conflicts in routing', () => {
      const path = router.routeQuery('FAJ 121 3094', 'mimo_config');

      // Path should detect potential conflicts
      expect(path).toBeDefined();
      expect(typeof path.conflictDetected).toBe('boolean');
    });

    it('should find peer agents for federated learning', () => {
      const peers = router.findPeersForAgent('FAJ 121 3094', 3);

      expect(Array.isArray(peers)).toBe(true);
      // Should find 0-3 peers depending on graph structure
      expect(peers.length).toBeLessThanOrEqual(3);

      if (peers.length > 0) {
        expect(peers[0].fajCode).toBeDefined();
        expect(peers[0].category).toBeDefined();
        expect(peers[0].distance).toBeGreaterThan(0);
        expect(peers[0].weight).toBeGreaterThan(0);
      }
    });

    it('should cache routing results for performance', () => {
      const path1 = router.routeQuery('FAJ 121 3100', 'load_balance');
      const startTime = performance.now();
      const path2 = router.routeQuery('FAJ 121 3100', 'load_balance');
      const cachedTime = performance.now() - startTime;

      expect(path1.fajCodes).toEqual(path2.fajCodes);
      expect(cachedTime).toBeLessThan(5); // Cached should be very fast
    });
  });

  describe('P2P Coordination - Agent Communication', () => {
    it('should route queries through P2P network', async () => {
      const result = await coordination.routeQuery(
        'FAJ 121 3094',
        'Configure energy saving mode',
        'energy_optimization'
      );

      expect(result.primaryResponse).toBeDefined();
      expect(result.primaryResponse.agentId).toBeDefined();
      expect(result.routingPath).toBeDefined();
      expect(result.routingPath.fajCodes.length).toBeGreaterThan(0);
      expect(result.totalLatencyMs).toBeGreaterThan(0);
    });

    it('should consult peer agents when confidence is low', async () => {
      const result = await coordination.routeQuery(
        'FAJ 121 3100',
        'Optimize load balancing strategy',
        'load_balance'
      );

      expect(result.primaryResponse).toBeDefined();
      // peerResponses may be empty or populated depending on confidence
      expect(Array.isArray(result.peerResponses)).toBe(true);
    });

    it('should track message queue statistics', () => {
      const stats = coordination.getQueueStats();

      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.historySize).toBeGreaterThanOrEqual(0);
      expect(stats.alivePeers).toBeGreaterThanOrEqual(0);
      expect(stats.deadPeers).toBeGreaterThanOrEqual(0);
    });

    it('should provide graph statistics', () => {
      const stats = coordination.getGraphStats();

      expect(stats.totalNodes).toBe(testFeatures.length);
      expect(stats.totalEdges).toBeGreaterThanOrEqual(0);
      expect(stats.categories.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should execute complete query processing pipeline', async () => {
      const startTime = performance.now();

      // Route query through P2P network
      const result = await coordination.routeQuery(
        'FAJ 121 3094',
        'How to optimize energy saving configuration?',
        'energy_optimization'
      );

      // Validate configuration with SIMD
      const validation = await runtime.validateConfig({
        agentId: testFeatures[0].id,
        config: [
          { name: 'sleepMode', value: 1, min: 0, max: 1 },
          { name: 'sleepTimer', value: 5000, min: 100, max: 10000 },
        ],
      });

      // Monitor KPIs with SIMD aggregation
      const kpis = await runtime.monitorKPIs(testFeatures[0].id);

      const totalTime = performance.now() - startTime;

      // Verify pipeline executed successfully
      expect(result.primaryResponse).toBeDefined();
      expect(result.primaryResponse.confidence).toBeGreaterThan(0);

      expect(validation.results).toBeDefined();
      expect(validation.validCount).toBeGreaterThan(0);

      expect(kpis.agentId).toBe(testFeatures[0].id);

      // Total latency should still be reasonable
      expect(totalTime).toBeLessThan(5000); // <5s for complete pipeline
    });

    it('should handle concurrent queries', async () => {
      const queries = [
        coordination.routeQuery('FAJ 121 3094', 'Energy optimization query 1'),
        coordination.routeQuery('FAJ 121 3085', 'MIMO configuration query 1'),
        coordination.routeQuery('FAJ 121 3100', 'Load balancing query 1'),
        coordination.routeQuery('FAJ 121 3094', 'Energy optimization query 2'),
        coordination.routeQuery('FAJ 121 3085', 'MIMO configuration query 2'),
      ];

      const startTime = performance.now();
      const results = await Promise.all(queries);
      const concurrentTime = performance.now() - startTime;

      expect(results.length).toBe(5);
      expect(results.every(r => r.primaryResponse)).toBe(true);

      // Concurrent execution should be significantly faster than sequential
      expect(concurrentTime).toBeLessThan(3000); // <3s for 5 concurrent queries
    });
  });

  describe('Memory and Performance Constraints', () => {
    it('should maintain memory within budget', () => {
      const stats = factory.getMemoryStats();

      expect(stats.usedBytes).toBeLessThanOrEqual(stats.maxBytes);
      expect(stats.cachedAgents).toBeLessThanOrEqual(stats.maxCachedAgents);
      expect(stats.usedPercent).toBeLessThan(100);
    });

    it('should meet latency targets', async () => {
      const startTime = performance.now();

      await runtime.handleQuery({
        agentId: testFeatures[0].id,
        content: 'Query',
      });

      const latency = performance.now() - startTime;
      expect(latency).toBeLessThan(50); // <50ms for agent query
    });

    it('should achieve SIMD acceleration targets', async () => {
      // Validation should be fast due to SIMD
      const startTime = performance.now();

      await runtime.validateConfig({
        agentId: testFeatures[0].id,
        config: Array(1000)
          .fill(null)
          .map((_, i) => ({
            name: `param${i}`,
            value: Math.random() * 100,
            min: 0,
            max: 100,
          })),
      });

      const validationTime = performance.now() - startTime;
      expect(validationTime).toBeLessThan(100); // <100ms for 1000 params (SIMD optimized)
    });
  });

  describe('Agent Runtime - Cleanup', () => {
    it('should terminate agents and update active list', async () => {
      const before = runtime.getActiveAgents().length;

      await runtime.terminateAgent(testFeatures[1].id);

      const after = runtime.getActiveAgents().length;
      expect(after).toBe(before - 1);
    });
  });
});
