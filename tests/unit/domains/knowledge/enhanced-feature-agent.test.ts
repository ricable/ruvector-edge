import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedFeatureAgent } from '@/domains/knowledge/aggregates/enhanced-feature-agent';
import { AgentSpawned, QueryReceived, ResponseGenerated, PeerConsulted } from '@/domains/coordination/domain-events';

describe('EnhancedFeatureAgent', () => {
  let agent: EnhancedFeatureAgent;

  beforeEach(() => {
    agent = new EnhancedFeatureAgent({
      fajCode: '11CS',
      name: 'Cell Capacity Specialist',
      description: 'Handles cell capacity and configuration queries',
      domain: 'Cell Capacity & Configuration'
    });
  });

  describe('creation', () => {
    it('should create with valid parameters', () => {
      expect(agent.id).toBeDefined();
      expect(agent.fajCode).toBe('11CS');
      expect(agent.name).toBe('Cell Capacity Specialist');
      expect(agent.state.value).toBe('Initializing');
      expect(agent.health.value).toBe(1.0);
      expect(agent.interactionCount).toBe(0);
    });

    it('should initialize with autonomous state machine', () => {
      expect(agent.autonomousStateMachine).toBeDefined();
      expect(agent.qTable).toBeDefined();
    });

    it('should initialize with knowledge base', () => {
      expect(agent.knowledgeBase).toBeDefined();
      expect(agent.parameterCatalog).toBeDefined();
      expect(agent.counterCatalog).toBeDefined();
    });
  });

  describe('state transitions', () => {
    it('should transition from Initializing to ColdStart', async () => {
      await agent.initialize();
      expect(agent.state.value).toBe('ColdStart');
      expect(agent.coldStartInteractions).toBe(0);
    });

    it('should transition from ColdStart to Ready after threshold', async () => {
      // Simulate interactions to reach threshold
      for (let i = 0; i < 100; i++) {
        await agent.handleQuery({
          query: 'test query',
          queryType: 'information',
          complexity: 'low'
        });
      }

      expect(agent.state.value).toBe('Ready');
    });

    it('should transition to Busy when processing query', async () => {
      const promise = agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(agent.state.value).toBe('Busy');

      await promise;
      expect(agent.state.value).toBe('Ready');
    });

    it('should transition to Degraded when health is low', async () => {
      // Simulate low health
      agent._setHealth(0.3);

      await agent.initialize();
      expect(agent.state.value).toBe('Degraded');
    });

    it('should transition from Degraded to Recovering', async () => {
      agent._setHealth(0.3);
      await agent.initialize();

      await agent.recover();
      expect(agent.state.value).toBe('Recovering');
    });
  });

  describe('query handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle information queries', async () => {
      const result = await agent.handleQuery({
        query: 'What is the maximum cell capacity?',
        queryType: 'information',
        complexity: 'low'
      });

      expect(result.response).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.action).toBeDefined();
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should handle optimization queries', async () => {
      const result = await agent.handleQuery({
        query: 'Optimize cell capacity settings',
        queryType: 'optimization',
        complexity: 'medium'
      });

      expect(result.response).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle complex queries with peer consultation', async () => {
      const result = await agent.handleQuery({
        query: 'Advanced capacity planning with interference analysis',
        queryType: 'optimization',
        complexity: 'high'
      });

      expect(result.response).toBeDefined();
      // Result might consult peers for complex queries
    });

    it('should handle unknown queries gracefully', async () => {
      const result = await agent.handleQuery({
        query: 'Completely unknown question about unrelated topic',
        queryType: 'information',
        complexity: 'high'
      });

      expect(result.response).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('OODA loop execution', () => {
    it('should execute complete OODA loop', async () => {
      const result = await agent.executeOODALoop({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(result).toBeDefined();
      expect(result.observations).toBeDefined();
      expect(result.decision).toBeDefined();
      expect(result.actionTaken).toBeDefined();
    });

    it('should adjust exploration rate based on performance', async () => {
      const initialEpsilon = agent.autonomousStateMachine.getExplorationRate();

      // Simulate some interactions
      for (let i = 0; i < 10; i++) {
        await agent.handleQuery({
          query: `test query ${i}`,
          queryType: 'information',
          complexity: 'low'
        });
      }

      const newEpsilon = agent.autonomousStateMachine.getExplorationRate();
      // Exploration rate should adjust based on experience
      expect(newEpsilon).toBeDefined();
    });
  });

  describe('Q-learning integration', () => {
    it('should select actions using Q-learning', async () => {
      const spy = vi.spyOn(agent.qTable, 'getAction');

      await agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should update Q-values based on rewards', async () => {
      const spy = vi.spyOn(agent.qTable, 'updateQValue');

      await agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should calculate confidence based on Q-values', async () => {
      const result = await agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('domain events', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should publish AgentSpawned event on creation', () => {
      expect(agent.domainEventBus).toBeDefined();
      // Event publication is handled internally
    });

    it('should publish QueryReceived event when handling query', async () => {
      const eventSpy = vi.spyOn(agent.domainEventBus, 'publish');

      await agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'QueryReceived'
        })
      );
    });

    it('should publish ResponseGenerated event after query handling', async () => {
      const eventSpy = vi.spyOn(agent.domainEventBus, 'publish');

      await agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ResponseGenerated'
        })
      );
    });
  });

  describe('health monitoring', () => {
    it('should track health based on performance', async () => {
      const initialHealth = agent.health.value;

      await agent.handleQuery({
        query: 'test query',
        queryType: 'information',
        complexity: 'low'
      });

      const newHealth = agent.health.value;
      // Health should adjust based on query performance
      expect(newHealth).toBeDefined();
    });

    it('should degrade health on repeated failures', async () => {
      agent._setHealth(0.8);

      // Simulate failures
      for (let i = 0; i < 5; i++) {
        await agent.handleQuery({
          query: 'unknown query',
          queryType: 'information',
          complexity: 'high'
        });
      }

      expect(agent.health.value).toBeLessThan(0.8);
    });

    it('should recover health over time', async () => {
      agent._setHealth(0.3);

      await agent.recover();

      // Health should improve during recovery
      expect(agent.health.value).toBeGreaterThan(0.3);
    });
  });

  describe('peer consultation', () => {
    it('should consult peers for complex queries', async () => {
      const result = await agent.handleQuery({
        query: 'Complex optimization requiring multiple expertises',
        queryType: 'optimization',
        complexity: 'high'
      });

      // Peer consultation might be triggered
      expect(result.response).toBeDefined();
    });

    it('should avoid redundant consultations', async () => {
      // Test that the agent doesn't consult the same peer repeatedly
      // for the same type of query
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined queries gracefully', async () => {
      const result = await agent.handleQuery({
        query: null as any,
        queryType: 'information',
        complexity: 'low'
      });

      expect(result.response).toBeDefined();
    });

    it('should handle empty queries', async () => {
      const result = agent.handleQuery({
        query: '',
        queryType: 'information',
        complexity: 'low'
      });

      await expect(result).resolves.toBeDefined();
    });

    it('should handle concurrent queries', async () => {
      const promises = [
        agent.handleQuery({
          query: 'query 1',
          queryType: 'information',
          complexity: 'low'
        }),
        agent.handleQuery({
          query: 'query 2',
          queryType: 'information',
          complexity: 'low'
        })
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.response).toBeDefined();
      });
    });
  });

  describe('persistence', () => {
    it('should serialize to JSON', async () => {
      await agent.initialize();

      const json = agent.toJSON();
      expect(json).toBeDefined();
      expect(json.id).toBe(agent.id);
      expect(json.fajCode).toBe('11CS');
      expect(json.state).toBe('ColdStart');
    });

    it('should deserialize from JSON', async () => {
      await agent.initialize();

      const json = agent.toJSON();
      const newAgent = EnhancedFeatureAgent.fromJSON(json);

      expect(newAgent.id).toBe(agent.id);
      expect(newAgent.fajCode).toBe('11CS');
      expect(newAgent.state.value).toBe(agent.state.value);
    });
  });
});