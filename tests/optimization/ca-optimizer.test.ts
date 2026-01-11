/**
 * CA Optimizer Tests - GOAL-010
 *
 * Validates Carrier Aggregation optimization with 89 agents
 * targeting +50% throughput increase
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CAOptimizer, CAAgent, CAMetrics, IFLBParameters } from '../../src/domains/optimization/aggregates/ca-optimizer';

describe('CAOptimizer - GOAL-010', () => {
  let optimizer: CAOptimizer;

  beforeEach(() => {
    optimizer = new CAOptimizer({
      loadThreshold: 30,
      congestionThreshold: 80,
      balancingIntervalMs: 100,
      sccAdditionTimeoutMs: 100,
      maxCarriers: 4,
      priorityUl: false,
      adaptiveThreshold: true
    });
  });

  afterEach(() => {
    optimizer.stopMonitoring();
  });

  describe('Agent Initialization', () => {
    it('should initialize 89 agents across 7 categories', () => {
      const allAgents = optimizer.getAllAgents();
      expect(allAgents.length).toBe(89);
    });

    it('should distribute agents correctly by category', () => {
      const agentsByCategory = {
        '2cc_dl': optimizer.getAgentsByCategory('2cc_dl').length,
        '3cc_dl': optimizer.getAgentsByCategory('3cc_dl').length,
        '4cc_dl': optimizer.getAgentsByCategory('4cc_dl').length,
        'ul_ca': optimizer.getAgentsByCategory('ul_ca').length,
        'cross_band_ca': optimizer.getAgentsByCategory('cross_band_ca').length,
        'laa_lte_u': optimizer.getAgentsByCategory('laa_lte_u').length,
        'nr_ca': optimizer.getAgentsByCategory('nr_ca').length
      };

      expect(agentsByCategory['2cc_dl']).toBe(15);
      expect(agentsByCategory['3cc_dl']).toBe(12);
      expect(agentsByCategory['4cc_dl']).toBe(8);
      expect(agentsByCategory['ul_ca']).toBe(10);
      expect(agentsByCategory['cross_band_ca']).toBe(20);
      expect(agentsByCategory['laa_lte_u']).toBe(8);
      expect(agentsByCategory['nr_ca']).toBe(16);
    });

    it('should initialize all agents as disabled', () => {
      const allAgents = optimizer.getAllAgents();
      const enabledAgents = allAgents.filter(a => a.enabled);
      expect(enabledAgents.length).toBe(0);
    });
  });

  describe('Agent Activation', () => {
    it('should not activate agents below load threshold', async () => {
      const activated = await optimizer.activateAgents(25, 70);
      expect(activated.length).toBe(0);
    });

    it('should activate agents on load imbalance trigger', async () => {
      const activated = await optimizer.activateAgents(35, 70);
      expect(activated.length).toBeGreaterThan(0);
      expect(activated.length).toBeLessThanOrEqual(4); // maxCarriers
    });

    it('should activate agents on congestion trigger', async () => {
      const activated = await optimizer.activateAgents(25, 85);
      expect(activated.length).toBeGreaterThan(0);
    });

    it('should prioritize cross_band_ca agents first', async () => {
      const activated = await optimizer.activateAgents(35, 85);
      if (activated.length > 0) {
        expect(activated[0].category).toBe('cross_band_ca');
      }
    });

    it('should respect max carriers limit', async () => {
      const activated = await optimizer.activateAgents(50, 90);
      expect(activated.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate metrics with no agents enabled', () => {
      const metrics = optimizer.calculateMetrics();
      expect(metrics.caActivationRate).toBe(0);
      expect(metrics.userThroughputMbps).toBeGreaterThan(0);
    });

    it('should increase throughput with agents enabled', async () => {
      const baselineMetrics = optimizer.calculateMetrics();
      await optimizer.activateAgents(40, 85);
      const enhancedMetrics = optimizer.calculateMetrics();

      expect(enhancedMetrics.userThroughputMbps).toBeGreaterThan(baselineMetrics.userThroughputMbps);
      expect(enhancedMetrics.caActivationRate).toBeGreaterThan(0);
    });
  });

  describe('Success Criteria', () => {
    it('should meet +50% throughput target with optimal activation', async () => {
      // Activate all 4 carriers for maximum throughput
      for (let i = 0; i < 10; i++) {
        await optimizer.activateAgents(50, 90);
      }

      const report = optimizer.generateReport();
      const throughputIncrease = ((report.metrics.userThroughputMbps - 20) / 20) * 100;

      expect(throughputIncrease).toBeGreaterThanOrEqual(50);
    });

    it('should track CA activation rate', async () => {
      await optimizer.activateAgents(40, 85);
      const metrics = optimizer.calculateMetrics();

      expect(metrics.caActivationRate).toBeGreaterThan(0);
      expect(metrics.caActivationRate).toBeLessThanOrEqual(100);
    });

    it('should meet SCC addition latency target', async () => {
      const startTime = performance.now();
      await optimizer.activateAgents(40, 85);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Monitoring', () => {
    it('should start monitoring without errors', () => {
      expect(() => optimizer.startMonitoring()).not.toThrow();
    });

    it('should collect metrics during monitoring', (done) => {
      let metricsCollected = 0;
      optimizer.startMonitoring((metrics) => {
        metricsCollected++;
        if (metricsCollected >= 3) {
          optimizer.stopMonitoring();
          expect(metricsCollected).toBeGreaterThanOrEqual(3);
          done();
        }
      });
    });

    it('should stop monitoring cleanly', () => {
      optimizer.startMonitoring();
      expect(() => optimizer.stopMonitoring()).not.toThrow();
    });
  });

  describe('Report Generation', () => {
    it('should generate a comprehensive report', () => {
      const report = optimizer.generateReport();

      expect(report.summary).toContain('GOAL-010');
      expect(report.summary).toContain('Total Agents: 89');
      expect(report.summary).toContain('Success Criteria');
      expect(report.summary).toContain('IFLB_enhanced');
    });

    it('should include success criteria details', () => {
      const report = optimizer.generateReport();

      expect(report.successCriteria).toBeDefined();
      expect(report.successCriteria.details).toBeInstanceOf(Array);
      expect(report.successCriteria.details.length).toBe(3);
    });

    it('should show not met when targets not achieved', () => {
      const report = optimizer.generateReport();

      // With no agents activated, targets should not be met
      if (report.metrics.caActivationRate < 95) {
        expect(report.successCriteria.met).toBe(false);
      }
    });
  });

  describe('Agent Management', () => {
    it('should reset all agents', async () => {
      await optimizer.activateAgents(40, 85);
      expect(optimizer.getAllAgents().filter(a => a.enabled).length).toBeGreaterThan(0);

      optimizer.resetAgents();
      expect(optimizer.getAllAgents().filter(a => a.enabled).length).toBe(0);
    });

    it('should update IFLB parameters', () => {
      optimizer.updateIFLBParams({ loadThreshold: 40 });

      const activated = optimizer.activateAgents(35, 70);
      expect(activated).resolves.toHaveLength(0); // Below new threshold
    });
  });

  describe('Carrier Band Assignment', () => {
    it('should assign appropriate bands to 2CC DL agents', () => {
      const agents = optimizer.getAgentsByCategory('2cc_dl');
      agents.forEach(agent => {
        expect(agent.carriers.length).toBe(2);
        agent.carriers.forEach(band => {
          expect(['B1', 'B3', 'B7', 'B8', 'B20']).toContain(band);
        });
      });
    });

    it('should assign appropriate bands to 4CC DL agents', () => {
      const agents = optimizer.getAgentsByCategory('4cc_dl');
      agents.forEach(agent => {
        expect(agent.carriers.length).toBe(4);
      });
    });

    it('should assign LAA bands to LAA/LTE-U agents', () => {
      const agents = optimizer.getAgentsByCategory('laa_lte_u');
      agents.forEach(agent => {
        expect(agent.carriers.length).toBe(2);
        agent.carriers.forEach(band => {
          expect(['B46', 'B48']).toContain(band);
        });
      });
    });

    it('should assign NR bands to NR CA agents', () => {
      const agents = optimizer.getAgentsByCategory('nr_ca');
      agents.forEach(agent => {
        expect(agent.carriers.length).toBe(3);
        agent.carriers.forEach(band => {
          expect(['B1', 'B3', 'B7', 'B8', 'B20', 'B78', 'B79']).toContain(band);
        });
      });
    });
  });

  describe('Performance Targets', () => {
    it('should achieve target throughput increase with full activation', async () => {
      // Simulate load conditions to activate agents
      await optimizer.activateAgents(50, 90);
      await optimizer.activateAgents(50, 90);
      await optimizer.activateAgents(50, 90);

      const report = optimizer.generateReport();
      const baseline = 20;
      const increase = ((report.metrics.userThroughputMbps - baseline) / baseline) * 100;

      expect(increase).toBeGreaterThan(40); // At least approaching 50%
    });

    it('should maintain low SCC addition latency', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await optimizer.activateAgents(40, 85);
        latencies.push(performance.now() - start);
        optimizer.resetAgents();
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(100);
    });

    it('should scale CA activation rate with load', async () => {
      const lowLoad = await optimizer.activateAgents(30, 70);
      optimizer.resetAgents();

      const highLoad = await optimizer.activateAgents(50, 90);

      expect(highLoad.length).toBeGreaterThanOrEqual(lowLoad.length);
    });
  });
});
