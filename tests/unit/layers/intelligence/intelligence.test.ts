/**
 * Intelligence Layer Tests
 * Tests for Q-Learning, Trajectory Buffer, Federated Learning,
 * Pattern Recognition, and SNN Anomaly Detection
 */

import {
  // Q-Learning
  QTable,
  StateEncoder,
  RewardCalculator,
  // Trajectory
  TrajectoryBuffer,
  TrajectoryBuilder,
  // Federated
  FederatedMerger,
  // Patterns
  HNSWIndex,
  PatternStore,
  IntentClassifier,
  SimpleEmbedder,
  // SNN
  SpikingNeuron,
  SNNAnomalyDetector,
  // Service
  IntelligenceService,
  createFeatureAgentIntelligence,
  // Types
  type State,
  type Action,
  type RewardSignal,
} from '../../../src/layers/intelligence';

describe('Q-Learning Module', () => {
  describe('StateEncoder', () => {
    const encoder = new StateEncoder();

    test('should create state from query context', () => {
      const state = encoder.createState('parameter', 'simple', 'test context', 0.85);

      expect(state.queryType).toBe('parameter');
      expect(state.complexity).toBe('simple');
      expect(state.confidence).toBe(0.75); // Discretized to nearest bucket
      expect(state.contextHash).toHaveLength(8);
    });

    test('should encode and decode state', () => {
      const state: State = {
        queryType: 'counter',
        complexity: 'moderate',
        contextHash: 'abc12345',
        confidence: 0.5,
      };

      const encoded = encoder.encodeState(state);
      const decoded = encoder.decodeState(encoded);

      expect(decoded).toEqual(state);
    });

    test('should classify query type', () => {
      expect(encoder.classifyQueryType('What is the default parameter value?')).toBe('parameter');
      expect(encoder.classifyQueryType('Show me the counter metrics')).toBe('counter');
      expect(encoder.classifyQueryType('What is the KPI throughput?')).toBe('kpi');
      expect(encoder.classifyQueryType('How to configure the system?')).toBe('procedure');
      expect(encoder.classifyQueryType('There is an error in the system')).toBe('troubleshoot');
    });

    test('should estimate complexity', () => {
      expect(encoder.estimateComplexity('What is X?')).toBe('simple');
      expect(encoder.estimateComplexity('What is the relationship between X and Y when Z happens?', 2)).toBe('moderate');
      expect(encoder.estimateComplexity(
        'When configuring the system with multiple parameters across different cells, ' +
        'what are the optimal values for maximizing throughput while minimizing latency? ' +
        'Also, how does this interact with the mobility settings?',
        4
      )).toBe('complex');
    });
  });

  describe('QTable', () => {
    let qTable: QTable;

    beforeEach(() => {
      qTable = new QTable('test-agent', { alpha: 0.1, gamma: 0.95, epsilon: 0.1 });
    });

    test('should initialize with default Q-values', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      expect(qTable.getQValue(state, 'direct_answer')).toBe(0);
    });

    test('should update Q-values using Q-learning rule', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      // Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
      // With initial Q=0, reward=1, no next state: Q = 0 + 0.1 * [1 + 0 - 0] = 0.1
      qTable.update(state, 'direct_answer', 1.0, null);

      expect(qTable.getQValue(state, 'direct_answer')).toBeCloseTo(0.1);
    });

    test('should select best action', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      // Set different Q-values
      qTable.setQValue(state, 'direct_answer', 0.5);
      qTable.setQValue(state, 'context_answer', 0.8);
      qTable.setQValue(state, 'consult_peer', 0.3);

      const bestAction = qTable.getBestAction(state);
      expect(bestAction).toBe('context_answer');
    });

    test('should track statistics', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      qTable.update(state, 'direct_answer', 1.0, null);
      qTable.update(state, 'direct_answer', 0.5, null);

      const stats = qTable.getStats();
      expect(stats.entryCount).toBe(1);
      expect(stats.version).toBe(2);
    });
  });

  describe('RewardCalculator', () => {
    const calculator = new RewardCalculator();

    test('should calculate reward from signal', () => {
      const signal: RewardSignal = {
        userRating: 0.8,
        resolutionSuccess: true,
        latencyMs: 500,
        consultedPeers: 0,
        isNovelQuery: false,
      };

      const reward = calculator.calculate(signal, 'direct_answer');

      expect(reward.total).toBeGreaterThan(0);
      expect(reward.breakdown.userRating).toBe(0.8);
      expect(reward.breakdown.resolutionBonus).toBe(0.5);
      expect(reward.breakdown.latencyPenalty).toBe(0);
    });

    test('should apply latency penalty', () => {
      const signal: RewardSignal = {
        userRating: 0.8,
        resolutionSuccess: true,
        latencyMs: 3000, // 3 seconds, above threshold
        consultedPeers: 0,
        isNovelQuery: false,
      };

      const reward = calculator.calculate(signal, 'direct_answer');
      expect(reward.breakdown.latencyPenalty).toBeLessThan(0);
    });
  });
});

describe('Trajectory Module', () => {
  describe('TrajectoryBuffer', () => {
    let buffer: TrajectoryBuffer;

    beforeEach(() => {
      buffer = new TrajectoryBuffer({ maxSize: 10, prioritizedSampling: true });
    });

    test('should add trajectories', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      buffer.createAndAdd('agent-1', [
        { state, action: 'direct_answer', reward: 1.0, nextState: null, timestamp: Date.now() }
      ], true);

      expect(buffer.getSize()).toBe(1);
    });

    test('should sample trajectories', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      for (let i = 0; i < 5; i++) {
        buffer.createAndAdd('agent-1', [
          { state, action: 'direct_answer', reward: i, nextState: null, timestamp: Date.now() }
        ], true);
      }

      const sampled = buffer.sample(3);
      expect(sampled.length).toBe(3);
    });

    test('should prioritize high-reward trajectories', () => {
      const state: State = {
        queryType: 'parameter',
        complexity: 'simple',
        contextHash: 'test1234',
        confidence: 0.5,
      };

      // Add trajectories with varying rewards
      for (let i = 0; i < 10; i++) {
        buffer.createAndAdd('agent-1', [
          { state, action: 'direct_answer', reward: i / 10, nextState: null, timestamp: Date.now() }
        ], true);
      }

      // Get top trajectories
      const top = buffer.getTopTrajectories(3);
      expect(top.length).toBe(3);
      expect(top[0].cumulativeReward).toBeGreaterThanOrEqual(top[1].cumulativeReward);
    });
  });

  describe('TrajectoryBuilder', () => {
    test('should build trajectory incrementally', () => {
      const builder = new TrajectoryBuilder('agent-1');
      const state: State = {
        queryType: 'counter',
        complexity: 'moderate',
        contextHash: 'test5678',
        confidence: 0.75,
      };

      builder
        .addStep(state, 'context_answer', 0.5, state)
        .addStep(state, 'direct_answer', 0.8, null)
        .setMetadata('queryId', 'q123');

      const trajectory = builder.build(true);

      expect(trajectory.steps.length).toBe(2);
      expect(trajectory.cumulativeReward).toBeCloseTo(1.3);
      expect(trajectory.success).toBe(true);
      expect(trajectory.metadata?.queryId).toBe('q123');
    });
  });
});

describe('Federated Learning Module', () => {
  describe('FederatedMerger', () => {
    let merger: FederatedMerger;
    let localQTable: QTable;

    beforeEach(() => {
      merger = new FederatedMerger('local-agent');
      localQTable = new QTable('local-agent');
    });

    test('should calculate confidence from visits', () => {
      expect(merger.calculateConfidence(0)).toBe(0);
      expect(merger.calculateConfidence(10)).toBeCloseTo(0.909, 2);
      expect(merger.calculateConfidence(100)).toBeCloseTo(0.99, 2);
    });

    test('should merge peer Q-tables', () => {
      const state: State = {
        queryType: 'kpi',
        complexity: 'complex',
        contextHash: 'kpi12345',
        confidence: 0.5,
      };

      // Set local value
      localQTable.setQValue(state, 'context_answer', 0.5, 10);

      // Create peer info with different value
      const peerEntries = new Map();
      const key = localQTable.getEncoder().encodeStateAction(state, 'context_answer');
      peerEntries.set(key, { value: 0.9, visits: 20, lastUpdated: Date.now() });

      const peerInfo = {
        agentId: 'peer-agent',
        version: 1,
        entries: peerEntries,
        lastSync: Date.now(),
      };

      const results = merger.merge(localQTable, peerInfo);

      // Expected: (0.5 * 10 + 0.9 * 20) / 30 = 0.767
      expect(results.length).toBe(1);
      expect(localQTable.getQValue(state, 'context_answer')).toBeCloseTo(0.767, 2);
    });

    test('should track sync triggers', () => {
      for (let i = 0; i < 10; i++) {
        merger.recordInteraction();
      }

      expect(merger.shouldSync()).toBe(true);
    });
  });
});

describe('Pattern Recognition Module', () => {
  describe('HNSWIndex', () => {
    let index: HNSWIndex;

    beforeEach(() => {
      index = new HNSWIndex(4, { M: 4, efConstruction: 20, efSearch: 10 });
    });

    test('should insert and search vectors', () => {
      // Insert vectors
      index.insert('v1', new Float32Array([1, 0, 0, 0]));
      index.insert('v2', new Float32Array([0, 1, 0, 0]));
      index.insert('v3', new Float32Array([0.9, 0.1, 0, 0]));

      // Search for nearest neighbors
      const results = index.search(new Float32Array([1, 0, 0, 0]), 2);

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('v1');
    });

    test('should handle deletion', () => {
      index.insert('v1', new Float32Array([1, 0, 0, 0]));
      index.insert('v2', new Float32Array([0, 1, 0, 0]));

      expect(index.size()).toBe(2);

      index.delete('v1');

      expect(index.size()).toBe(1);
      expect(index.has('v1')).toBe(false);
    });
  });

  describe('IntentClassifier', () => {
    const classifier = new IntentClassifier();

    test('should classify intents', () => {
      const result = classifier.classify('What is the default parameter value for zMaxPower?');

      expect(result.intent).toBe('parameter');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test('should extract entities', () => {
      const entities = classifier.extractEntities(
        'Check the pmCounter1 value for cell ID 12345'
      );

      expect(entities.length).toBeGreaterThan(0);
      const counterEntity = entities.find(e => e.type === 'counter');
      expect(counterEntity).toBeDefined();
    });

    test('should analyze query completely', () => {
      const { classification, entities } = classifier.analyze(
        'How to troubleshoot the alarm for pmErrorCounter?'
      );

      expect(classification.intent).toBe('troubleshoot');
      expect(entities.some(e => e.type === 'counter')).toBe(true);
    });
  });

  describe('SimpleEmbedder', () => {
    const embedder = new SimpleEmbedder({ dimension: 64 });

    test('should generate embeddings', () => {
      const embedding = embedder.embed('Test query about parameters');

      expect(embedding.length).toBe(64);
      expect(embedding.some(v => v !== 0)).toBe(true);
    });

    test('should calculate similarity', () => {
      const sim1 = embedder.similarity('parameter configuration', 'parameter settings');
      const sim2 = embedder.similarity('parameter configuration', 'unrelated topic');

      expect(sim1).toBeGreaterThan(sim2);
    });
  });
});

describe('SNN Anomaly Detection Module', () => {
  describe('SpikingNeuron', () => {
    test('should fire when threshold reached', () => {
      const neuron = new SpikingNeuron('test-neuron', {
        threshold: 1.0,
        restPotential: 0,
      });

      // Sub-threshold input
      let spiked = neuron.update(0.5, 0, 1);
      expect(spiked).toBe(false);

      // Threshold-reaching input
      spiked = neuron.update(0.6, 1, 1);
      expect(spiked).toBe(true);

      // Should be in refractory period
      spiked = neuron.update(1.5, 2, 1);
      expect(spiked).toBe(false);
    });
  });

  describe('SNNAnomalyDetector', () => {
    let detector: SNNAnomalyDetector;

    beforeEach(() => {
      detector = new SNNAnomalyDetector('test-agent', { numNeurons: 16 });
    });

    test('should process counter samples', () => {
      const samples = [
        { name: 'counter1', value: 100, timestamp: Date.now() },
        { name: 'counter2', value: 50, timestamp: Date.now() },
      ];

      const result = detector.process(samples);

      expect(result).toHaveProperty('isAnomaly');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('counterValues');
    });

    test('should build statistics over time', () => {
      // Feed normal data
      for (let i = 0; i < 20; i++) {
        detector.process([
          { name: 'counter1', value: 100 + Math.random() * 10, timestamp: Date.now() + i * 1000 },
        ]);
      }

      const stats = detector.getStats();
      expect(stats.trackedCounters).toBe(1);
    });
  });
});

describe('Intelligence Service', () => {
  let service: IntelligenceService;

  beforeEach(() => {
    service = new IntelligenceService({
      agentId: 'test-agent',
      federated: { enabled: false, syncIntervalMs: 60000, minConfidence: 0.5 },
    });
  });

  test('should process queries end-to-end', () => {
    const result = service.processQuery(
      'What is the default value for maxPower parameter?',
      'network configuration context'
    );

    expect(result.state).toBeDefined();
    expect(result.action).toBeDefined();
    expect(result.intent.intent).toBe('parameter');
    expect(['direct_answer', 'context_answer', 'consult_peer', 'request_clarification', 'escalate'])
      .toContain(result.action);
  });

  test('should record feedback and update learning', () => {
    const { state, action } = service.processQuery('Test query');

    const signal: RewardSignal = {
      userRating: 0.9,
      resolutionSuccess: true,
      latencyMs: 200,
      consultedPeers: 0,
      isNovelQuery: false,
    };

    const reward = service.recordFeedback(state, action, signal);

    expect(reward.total).toBeGreaterThan(0);
  });

  test('should manage trajectories', () => {
    service.startTrajectory();

    const { state, action } = service.processQuery('Query 1');
    service.recordFeedback(state, action, {
      userRating: 0.8,
      resolutionSuccess: true,
      latencyMs: 100,
      consultedPeers: 0,
      isNovelQuery: false,
    });

    const trajectory = service.endTrajectory(true);

    expect(trajectory).not.toBeNull();
    expect(trajectory?.steps.length).toBeGreaterThan(0);
    expect(trajectory?.success).toBe(true);
  });

  test('should provide comprehensive statistics', () => {
    const stats = service.getStats();

    expect(stats.qTable).toBeDefined();
    expect(stats.trajectory).toBeDefined();
    expect(stats.federated).toBeDefined();
    expect(stats.patterns).toBeDefined();
  });

  test('should create feature agent intelligence', () => {
    const featureIntelligence = createFeatureAgentIntelligence('FAJ1234567');

    expect(featureIntelligence).toBeInstanceOf(IntelligenceService);
    expect(featureIntelligence.getAgentId()).toBe('FAJ1234567');
  });
});
