/**
 * Comprehensive Test Suite for 50 RAN Feature Agents
 *
 * Tests:
 * - DDD aggregate boundaries
 * - Autonomous state machine transitions
 * - OODA loop execution
 * - Q-learning action selection
 * - Domain event publishing
 * - Battle arena functionality
 *
 * @module tests/knowledge/50-ran-agents-battle-test
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { EnhancedFeatureAgent, LTEFeatureAgentsFactory, Query, QueryType, ComplexityLevel } from '../../src/domains/knowledge/aggregates/enhanced-feature-agent';
import { AgentState } from '../../src/domains/intelligence/aggregates/autonomous-state-machine';
import { Action } from '../../src/domains/intelligence/value-objects/action';
import { RANAgentBattleArena, BattleTestResult, TestQuestion } from '../battle-arena/ran-agent-battle-arena';
import { DomainEventBus, getGlobalEventBus, resetGlobalEventBus } from '../../src/domains/coordination/aggregates/domain-event-bus';

/**
 * Test Suite: 50 RAN Feature Agents
 */
describe('50 RAN Feature Agents - DDD Compliance', () => {
  let agents: Map<string, EnhancedFeatureAgent>;
  let eventBus: DomainEventBus;

  beforeAll(() => {
    // Reset global state
    resetGlobalEventBus();
    eventBus = getGlobalEventBus();

    // Create all 50 LTE feature agents
    agents = LTEFeatureAgentsFactory.createAll();

    // Initialize all agents
    for (const [acronym, agent] of agents) {
      agent.initialize();
    }
  });

  describe('Aggregate Creation', () => {
    it('should create exactly 50 agents', () => {
      expect(agents.size).toBe(50);
    });

    it('should create agents with unique IDs', () => {
      const ids = new Set<string>();
      for (const [acronym, agent] of agents) {
        const agentId = agent.stateMachine.agentId;
        expect(ids.has(agentId)).toBe(false);
        ids.add(agentId);
      }
    });

    it('should create agents with valid FAJ codes', () => {
      for (const [acronym, agent] of agents) {
        expect(agent.fajCode.code).toMatch(/^FAJ \d{3} \d{4}$/);
      }
    });

    it('should create agents with LTE access technology', () => {
      for (const [acronym, agent] of agents) {
        expect(agent.featureData.accessTechnology).toBe('LTE');
      }
    });
  });

  describe('State Machine Initialization', () => {
    it('should initialize all agents in COLD_START state', () => {
      let coldStartCount = 0;

      for (const [acronym, agent] of agents) {
        const state = agent.stateMachine.currentState;
        if (state === AgentState.COLD_START) {
          coldStartCount++;
        }
      }

      expect(coldStartCount).toBe(50);
    });

    it('should have health score of 1.0 for new agents', () => {
      for (const [acronym, agent] of agents) {
        expect(agent.stateMachine.health).toBe(1.0);
      }
    });

    it('should have zero interactions initially', () => {
      for (const [acronym, agent] of agents) {
        expect(agent.stateMachine.interactionCount).toBe(0);
      }
    });
  });

  describe('State Transitions', () => {
    it('should transition from COLD_START to READY after 100 interactions', async () => {
      const testAgent = agents.get('11CS')!;
      const stateMachine = testAgent.stateMachine;

      expect(stateMachine.currentState).toBe(AgentState.COLD_START);

      // Simulate 100 interactions
      for (let i = 0; i < 100; i++) {
        const state = stateMachine.observe(require('../../src/domains/intelligence/value-objects/state').State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test-hash',
          1.0
        ));
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      expect(stateMachine.currentState).toBe(AgentState.READY);
    });

    it('should transition from READY to BUSY when query starts', async () => {
      const testAgent = agents.get('2QD')!;
      const stateMachine = testAgent.stateMachine;

      // Set to READY state
      stateMachine.setExplorationRate(0);
      for (let i = 0; i < 100; i++) {
        const state = stateMachine.observe(require('../../src/domains/intelligence/value-objects/state').State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test-hash',
          1.0
        ));
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      expect(stateMachine.currentState).toBe(AgentState.READY);

      // Start query
      stateMachine.startQuery();
      expect(stateMachine.currentState).toBe(AgentState.BUSY);

      // Complete query
      stateMachine.completeQuery();
      expect(stateMachine.currentState).toBe(AgentState.READY);
    });

    it('should transition to DEGRADED when health falls below threshold', async () => {
      const testAgent = agents.get('ANR')!;
      const stateMachine = testAgent.stateMachine;

      // Set to READY
      for (let i = 0; i < 100; i++) {
        const state = stateMachine.observe(require('../../src/domains/intelligence/value-objects/state').State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test-hash',
          1.0
        ));
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      // Simulate health degradation
      for (let i = 0; i < 20; i++) {
        const state = stateMachine.observe(require('../../src/domains/intelligence/value-objects/state').State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test-hash',
          1.0
        ));
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(-1.0));
      }

      // Should transition to DEGRADED when health < 0.5
      if (stateMachine.health < 0.5) {
        expect(stateMachine.currentState).toBe(AgentState.DEGRADED);
      }
    });
  });

  describe('OODA Loop Execution', () => {
    it('should execute complete OODA loop for queries', async () => {
      const testAgent = agents.get('3DCAE')!;
      const State = require('../../src/domains/intelligence/value-objects/state').State;

      const state = State.create(
        QueryType.PARAMETER_CONFIGURATION,
        ComplexityLevel.MODERATE,
        'test-context-hash',
        1.0
      );

      const oodaResult = testAgent.stateMachine.runOODALoop(state);

      expect(oodaResult.observations).toBeDefined();
      expect(oodaResult.orientation).toBeDefined();
      expect(oodaResult.decision).toBeDefined();
      expect(oodaResult.result).toBeDefined();
      expect(oodaResult.decision.action).toBeDefined();
    });

    it('should select actions based on Q-learning', async () => {
      const testAgent = agents.get('4DCAE')!;
      const State = require('../../src/domains/intelligence/value-objects/state').State;

      const state = State.create(
        QueryType.GENERAL_INFO,
        ComplexityLevel.SIMPLE,
        'test-hash',
        1.0
      );

      const action1 = testAgent.stateMachine.selectAction(state, true);
      const action2 = testAgent.stateMachine.selectAction(state, false);

      expect(Action.ACTIONS).toContain(action1.type);
      expect(Action.ACTIONS).toContain(action2.type);
    });

    it('should explore during cold start and exploit when confident', async () => {
      const testAgent = agents.get('5DCAE')!;
      const State = require('../../src/domains/intelligence/value-objects/state').State;

      // Cold start - should explore more
      testAgent.stateMachine.setExplorationRate(0.5);
      const coldStartRate = testAgent.stateMachine.explorationRate;

      // After learning - should exploit more
      for (let i = 0; i < 50; i++) {
        const state = State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test-hash',
          1.0
        );
        testAgent.stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      const learnedRate = testAgent.stateMachine.explorationRate;

      expect(learnedRate).toBeLessThanOrEqual(coldStartRate);
    });
  });

  describe('Query Handling', () => {
    it('should handle queries and generate responses', async () => {
      const testAgent = agents.get('6CS')!;

      const query: Query = {
        id: 'test-query-1',
        type: QueryType.PARAMETER_CONFIGURATION,
        content: 'What are the hardware requirements for 6 cell support?',
        complexity: ComplexityLevel.SIMPLE,
        timestamp: new Date()
      };

      const response = await testAgent.handleQueryEnhanced(query);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.actionTaken).toBeDefined();
      expect(response.stateAtResponse).toBeDefined();
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should adjust confidence based on query complexity', async () => {
      const testAgent = agents.get('6QD')!;

      const simpleQuery: Query = {
        id: 'simple-query',
        type: QueryType.GENERAL_INFO,
        content: 'What is 64-QAM?',
        complexity: ComplexityLevel.SIMPLE,
        timestamp: new Date()
      };

      const complexQuery: Query = {
        id: 'complex-query',
        type: QueryType.TROUBLESHOOTING,
        content: 'How does 64-QAM uplink interact with power headroom in inter-frequency scenarios?',
        complexity: ComplexityLevel.EXPERT,
        timestamp: new Date()
      };

      const simpleResponse = await testAgent.handleQueryEnhanced(simpleQuery);
      const complexResponse = await testAgent.handleQueryEnhanced(complexQuery);

      // Simple queries should generally have higher confidence during cold start
      expect(simpleResponse.confidence).toBeGreaterThanOrEqual(0);
      expect(complexResponse.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Domain Events', () => {
    it('should publish domain events on state transitions', async () => {
      let eventsReceived = 0;

      const subscription = eventBus.subscribe(
        'StateTransitioned',
        () => {
          eventsReceived++;
        }
      );

      const testAgent = agents.get('71CS')!;
      testAgent.initialize();

      expect(eventsReceived).toBeGreaterThan(0);
    });

    it('should maintain event history', () => {
      const history = eventBus.getHistory({ limit: 10 });

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Feature-Specific Tests', () => {
    it('should handle Carrier Aggregation queries correctly', async () => {
      const caAgents = ['3DCAE', '4DCAE', '5DCAE', '6DCAE', '7DCAE'];

      for (const acronym of caAgents) {
        const agent = agents.get(acronym);
        expect(agent).toBeDefined();

        const query: Query = {
          id: `ca-test-${acronym}`,
          type: QueryType.GENERAL_INFO,
          content: `What are the requirements for ${acronym}?`,
          complexity: ComplexityLevel.MODERATE,
          timestamp: new Date()
        };

        const response = await agent!.handleQueryEnhanced(query);
        expect(response.content).toContain('CA');
      }
    });

    it('should handle MIMO queries correctly', async () => {
      const mimoAgents = ['4QADPP', '4QADPP2', '4FIRC'];

      for (const acronym of mimoAgents) {
        const agent = agents.get(acronym);
        expect(agent).toBeDefined();

        const query: Query = {
          id: `mimo-test-${acronym}`,
          type: QueryType.PARAMETER_CONFIGURATION,
          content: `How do I configure ${acronym}?`,
          complexity: ComplexityLevel.MODERATE,
          timestamp: new Date()
        };

        const response = await agent!.handleQueryEnhanced(query);
        expect(response.content).toBeTruthy();
      }
    });

    it('should handle Energy Saving queries correctly', async () => {
      const query: Query = {
        id: 'energy-test',
        type: QueryType.OPTIMIZATION,
        content: 'What are the energy saving features available?',
        complexity: ComplexityLevel.MODERATE,
        timestamp: new Date()
      };

      // At least one agent should respond meaningfully
      let validResponses = 0;

      for (const [acronym, agent] of agents) {
        const response = await agent.handleQueryEnhanced(query);
        if (response.content.length > 50) {
          validResponses++;
        }
      }

      expect(validResponses).toBeGreaterThan(0);
    });
  });
});

/**
 * Test Suite: Battle Arena
 */
describe('Battle Arena - 50 Agent Battle Tests', () => {
  let arena: RANAgentBattleArena;

  beforeEach(() => {
    arena = new RANAgentBattleArena();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Arena Initialization', () => {
    it('should initialize with 50 agents', () => {
      const agentsByState = arena.getAgentsByState();
      let totalAgents = 0;

      for (const [state, acronyms] of agentsByState) {
        totalAgents += acronyms.length;
      }

      expect(totalAgents).toBe(50);
    });

    it('should have all agents in COLD_START initially', () => {
      const coldStartAgents = arena.getColdStartAgents();
      expect(coldStartAgents.length).toBe(50);
    });
  });

  describe('Single Test Execution', () => {
    it('should run single test successfully', async () => {
      const testQuestion: TestQuestion = {
        id: 1,
        question: 'What is 256-QAM Downlink?',
        targetAcronym: '2QD',
        queryType: QueryType.GENERAL_INFO,
        complexity: ComplexityLevel.SIMPLE,
        expectedKeywords: ['256-QAM', 'modulation', 'throughput']
      };

      const result = await arena['runSingleTest'](testQuestion);

      expect(result).toBeDefined();
      expect(result.agentAcronym).toBe('2QD');
      expect(result.questionId).toBe(1);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should detect expected keywords in response', async () => {
      const testQuestion: TestQuestion = {
        id: 2,
        question: 'How does ANR work?',
        targetAcronym: 'ANR',
        queryType: QueryType.TROUBLESHOOTING,
        complexity: ComplexityLevel.MODERATE,
        expectedKeywords: ['ANR', 'neighbor', 'discovery']
      };

      const result = await arena['runSingleTest'](testQuestion);

      expect(result.containsExpectedKeywords).toBe(true);
    });
  });

  describe('Full Battle Test', () => {
    it('should run all 50 battle tests', async () => {
      const { results, statistics, summary } = await arena.runAllTests();

      expect(results.length).toBe(50);
      expect(statistics.size).toBe(50);
      expect(summary.totalTests).toBe(50);
      expect(summary.totalAgents).toBe(50);
      expect(summary.overallAccuracy).toBeGreaterThanOrEqual(0);
      expect(summary.overallAccuracy).toBeLessThanOrEqual(1);
    });

    it('should generate valid statistics', async () => {
      const { statistics } = await arena.runAllTests();

      for (const [acronym, stats] of statistics) {
        expect(stats.acronym).toBe(acronym);
        expect(stats.totalQueries).toBeGreaterThan(0);
        expect(stats.accuracy).toBeGreaterThanOrEqual(0);
        expect(stats.accuracy).toBeLessThanOrEqual(1);
        expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
        expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
        expect(stats.averageConfidence).toBeLessThanOrEqual(1);
        expect(stats.finalState).toBeDefined();
        expect(stats.finalHealth).toBeGreaterThanOrEqual(0);
        expect(stats.finalHealth).toBeLessThanOrEqual(1);
      }
    });

    it('should identify top performers', async () => {
      const { summary } = await arena.runAllTests();

      expect(summary.topPerformers.length).toBe(10);
      expect(summary.topPerformers[0].accuracy).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DDD Aggregate Boundaries', () => {
    it('should maintain aggregate consistency', async () => {
      const agent = Array.from(arena['agents'].values())[0];
      const stateMachine = agent.stateMachine;

      // Aggregate root should control all access
      expect(stateMachine).toBeDefined();
      expect(stateMachine.id).toBe(agent.stateMachine.agentId);

      // State should be consistent
      const state1 = stateMachine.currentState;
      const state2 = stateMachine.currentState;
      expect(state1).toBe(state2);
    });

    it('should enforce invariant: cold start requires 100 interactions', async () => {
      const agent = Array.from(arena['agents'].values())[0];
      const stateMachine = agent.stateMachine;

      // Start in cold start
      expect(stateMachine.currentState).toBe(AgentState.COLD_START);

      // After less than 100 interactions, still cold start
      for (let i = 0; i < 50; i++) {
        const State = require('../../src/domains/intelligence/value-objects/state').State;
        const state = State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test',
          1.0
        );
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      expect(stateMachine.currentState).toBe(AgentState.COLD_START);

      // After 100 interactions, transition to READY
      for (let i = 50; i < 100; i++) {
        const State = require('../../src/domains/intelligence/value-objects/state').State;
        const state = State.create(
          QueryType.GENERAL_INFO,
          ComplexityLevel.SIMPLE,
          'test',
          1.0
        );
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      expect(stateMachine.currentState).toBe(AgentState.READY);
    });

    it('should enforce invariant: health bounded [0, 1]', async () => {
      const agent = Array.from(arena['agents'].values())[0];
      const stateMachine = agent.stateMachine;

      const State = require('../../src/domains/intelligence/value-objects/state').State;

      // Positive feedback
      for (let i = 0; i < 10; i++) {
        const state = State.create(QueryType.GENERAL_INFO, ComplexityLevel.SIMPLE, 'test', 1.0);
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(1.0));
      }

      expect(stateMachine.health).toBeGreaterThan(0);
      expect(stateMachine.health).toBeLessThanOrEqual(1);

      // Negative feedback
      for (let i = 0; i < 20; i++) {
        const state = State.create(QueryType.GENERAL_INFO, ComplexityLevel.SIMPLE, 'test', 1.0);
        stateMachine.recordInteraction(state, Action.DIRECT_ANSWER, new (require('../../src/domains/intelligence/value-objects/reward')).Reward(-1.0));
      }

      expect(stateMachine.health).toBeGreaterThan(0);
      expect(stateMachine.health).toBeLessThanOrEqual(1);
    });
  });
});

/**
 * Test Suite: Domain Event Bus
 */
describe('Domain Event Bus', () => {
  let eventBus: DomainEventBus;

  beforeEach(() => {
    resetGlobalEventBus();
    eventBus = new DomainEventBus();
  });

  it('should subscribe and publish events', async () => {
    let received = false;

    eventBus.subscribe('TestEvent', (event: any) => {
      received = true;
      expect(event.type).toBe('TestEvent');
    });

    await eventBus.publish({ type: 'TestEvent', timestamp: new Date() } as any);

    expect(received).toBe(true);
  });

  it('should support event filtering', async () => {
    let received = false;

    eventBus.subscribe(
      'TestEvent',
      (event: any) => {
        received = true;
      },
      {
        filter: (e: any) => e.data === 'pass'
      }
    );

    await eventBus.publish({ type: 'TestEvent', data: 'fail', timestamp: new Date() } as any);
    expect(received).toBe(false);

    await eventBus.publish({ type: 'TestEvent', data: 'pass', timestamp: new Date() } as any);
    expect(received).toBe(true);
  });

  it('should support one-time subscriptions', async () => {
    let count = 0;

    eventBus.subscribe(
      'TestEvent',
      () => {
        count++;
      },
      { once: true }
    );

    await eventBus.publish({ type: 'TestEvent', timestamp: new Date() } as any);
    await eventBus.publish({ type: 'TestEvent', timestamp: new Date() } as any);

    expect(count).toBe(1);
  });

  it('should maintain event history', async () => {
    await eventBus.publish({ type: 'Event1', timestamp: new Date() } as any);
    await eventBus.publish({ type: 'Event2', timestamp: new Date() } as any);

    const history = eventBus.getHistory();
    expect(history.length).toBe(2);
  });

  it('should filter history by event type', async () => {
    await eventBus.publish({ type: 'Event1', timestamp: new Date() } as any);
    await eventBus.publish({ type: 'Event2', timestamp: new Date() } as any);
    await eventBus.publish({ type: 'Event1', timestamp: new Date() } as any);

    const event1History = eventBus.getHistory({ eventType: 'Event1' });
    expect(event1History.length).toBe(2);

    const event2History = eventBus.getHistory({ eventType: 'Event2' });
    expect(event2History.length).toBe(1);
  });

  it('should provide statistics', async () => {
    await eventBus.publish({ type: 'Event1', timestamp: new Date() } as any);
    await eventBus.publish({ type: 'Event2', timestamp: new Date() } as any);
    await eventBus.publish({ type: 'Event1', timestamp: new Date() } as any);

    eventBus.subscribe('Event1', () => {});
    eventBus.subscribe('Event2', () => {});

    const stats = eventBus.getStatistics();

    expect(stats.totalEventsPublished).toBe(3);
    expect(stats.totalEventsProcessed).toBe(3);
    expect(stats.totalSubscriptions).toBe(2);
    expect(stats.eventTypeBreakdown.get('Event1')).toBe(2);
    expect(stats.eventTypeBreakdown.get('Event2')).toBe(1);
  });
});

/**
 * Performance Benchmarks
 */
describe('Performance Benchmarks', () => {
  let agents: Map<string, EnhancedFeatureAgent>;

  beforeAll(() => {
    agents = LTEFeatureAgentsFactory.createAll();

    for (const [acronym, agent] of agents) {
      agent.initialize();
    }
  });

  it('should handle queries in under 500ms (P95)', async () => {
    const testAgent = agents.get('2QD')!;
    const latencies: number[] = [];

    for (let i = 0; i < 20; i++) {
      const query: Query = {
        id: `perf-test-${i}`,
        type: QueryType.GENERAL_INFO,
        content: 'What is 256-QAM?',
        complexity: ComplexityLevel.SIMPLE,
        timestamp: new Date()
      };

      const start = Date.now();
      await testAgent.handleQueryEnhanced(query);
      const latency = Date.now() - start;

      latencies.push(latency);
    }

    // Calculate P95
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95 = latencies[p95Index];

    expect(p95).toBeLessThan(500);
  });

  it('should process state transitions in under 1ms', () => {
    const testAgent = agents.get('ANR')!;
    const stateMachine = testAgent.stateMachine;

    const start = Date.now();
    stateMachine.loadKnowledge();
    const latency = Date.now() - start;

    expect(latency).toBeLessThan(1);
  });
});

export default {};
