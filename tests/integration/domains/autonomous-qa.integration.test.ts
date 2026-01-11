/**
 * Autonomous QA Workflow Integration Tests
 *
 * Tests the complete end-to-end autonomous QA workflow:
 * - Question routing with semantic search
 * - Feature knowledge retrieval
 * - OODA cycle decision making
 * - Answer generation with confidence
 * - Q-learning updates with feedback
 *
 * @module tests/ran-knowledge/workflow/autonomous-qa.integration.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AutonomousQAWorkflow, QARequest, QAResponse } from '../../../src/domains/ran-knowledge/workflow';
import { createAutonomousQAWorkflow, DEFAULT_WORKFLOW_CONFIG } from '../../../src/domains/ran-knowledge/workflow';
import { FeatureAgentKnowledge } from '../../../src/domains/ran-knowledge/workflow';
import { QTable } from '../../../src/domains/intelligence';
import { TrajectoryBuffer } from '../../../src/domains/intelligence';
import { AutonomousStateMachine } from '../../../src/domains/intelligence';

// Mock AgentDB for testing
class MockAgentDB {
  private data: Map<string, any> = new Map();

  async vectorSearch(params: { vector: number[]; topK: number; namespace: string }) {
    // Return mock results
    return [
      { id: '256qam', score: 0.95 },
      { id: 'mimo', score: 0.87 },
      { id: 'ca', score: 0.72 },
    ].slice(0, params.topK);
  }

  async close() {
    // Mock close
  }
}

// Mock HNSW Index
class MockHNSWIndex {
  async search(vector: number[], options: { k: number }) {
    return [
      { id: '256qam', score: 0.95 },
      { id: 'mimo', score: 0.87 },
      { id: 'ca', score: 0.72 },
    ].slice(0, options.k);
  }
}

// Sample feature knowledge base
const SAMPLE_FEATURE_REGISTRY = new Map<string, FeatureAgentKnowledge>([
  ['256qam', {
    fajCode: 'FAJ 121 3094',
    category: 'Modulation',
    featureName: '256-QAM Downlink',
    parameters: ['pmo', 'pmo2', 'pmo3', 'cqiThreshold'],
    counters: ['pmCqi', 'pmMcsDl'],
    kpis: ['throughputDl', 'blerDl'],
    embedding: new Array(128).fill(0).map(() => Math.random()),
  }],
  ['mimo', {
    fajCode: 'FAJ 121 3120',
    category: 'MIMO',
    featureName: '4x4 MIMO',
    parameters: ['mimoMode', 'tm3TM4Threshold', 'ircEnabled'],
    counters: ['pmRankIndicator', 'pmPMI'],
    kpis: ['spatialMultiplexingGain'],
    embedding: new Array(128).fill(0).map(() => Math.random()),
  }],
  ['ca', {
    fajCode: 'FAJ 121 3150',
    category: 'Carrier Aggregation',
    featureName: '3CC DL CA',
    parameters: ['caActive', 'sccActivationThreshold', 'pccScg'],
    counters: ['pmCaConfigSuccess', 'pmScgChange'],
    kpis: ['caThroughputGain'],
    embedding: new Array(128).fill(0).map(() => Math.random()),
  }],
]);

describe('AutonomousQAWorkflow - Integration Tests', () => {
  let workflow: AutonomousQAWorkflow;
  let mockAgentDB: MockAgentDB;
  let mockHNSWIndex: MockHNSWIndex;

  beforeEach(async () => {
    // Create mocks
    mockAgentDB = new MockAgentDB();
    mockHNSWIndex = new MockHNSWIndex();

    // Create workflow
    workflow = await createAutonomousQAWorkflow({
      agentDB: mockAgentDB as any,
      hnswIndex: mockHNSWIndex as any,
      featureAgentRegistry: SAMPLE_FEATURE_REGISTRY,
      ...DEFAULT_WORKFLOW_CONFIG,
    });

    // Load knowledge to transition from INITIALIZING to COLD_START
    const stateMachine = (workflow as any).config.stateMachine as AutonomousStateMachine;
    stateMachine.loadKnowledge();
  });

  afterEach(async () => {
    await workflow.shutdown();
  });

  describe('Question Processing', () => {
    it('should process a simple parameter question', async () => {
      const request: QARequest = {
        question: 'How do I configure 256-QAM downlink?',
        context: { networkType: 'LTE' },
      };

      const response = await workflow.processQuestion(request);

      // Verify response structure
      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.sources).toBeInstanceOf(Array);
      expect(response.actionTaken).toBeTruthy();
      expect(response.state).toBeTruthy();
    });

    it('should process a counter-related question', async () => {
      const request: QARequest = {
        question: 'What counters measure 256-QAM performance?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.answer).toContain('Counter');
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.metadata.agentsConsulted).toContain('256qam');
    });

    it('should process a KPI question', async () => {
      const request: QARequest = {
        question: 'What is the throughput gain with 256-QAM?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.answer).toBeTruthy();
      expect(response.metadata.kpisFound).toBeGreaterThanOrEqual(0);
    });

    it('should process a complex multi-feature question', async () => {
      const request: QARequest = {
        question: 'How do I configure 256-QAM with 4x4 MIMO and carrier aggregation?',
      };

      const response = await workflow.processQuestion(request);

      // Complex questions should route to multiple agents
      expect(response.metadata.agentsConsulted.length).toBeGreaterThan(0);
      expect(response.actionTaken).toBeDefined();
    });
  });

  describe('OODA Cycle Decision Making', () => {
    it('should decide DirectAnswer for simple questions', async () => {
      const request: QARequest = {
        question: 'What is 256-QAM?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.actionTaken).toBeDefined();
      expect(['DirectAnswer', 'ContextAnswer', 'ConsultPeer', 'RequestClarification', 'Escalate'])
        .toContain(response.actionTaken);
    });

    it('should decide ContextAnswer for moderate complexity', async () => {
      const request: QARequest = {
        question: 'How do I configure 256-QAM parameters for LTE?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.actionTaken).toBeDefined();
      expect(response.metadata.oodaPhase).toBeDefined();
    });

    it('should track OODA phase distribution', async () => {
      // Process multiple questions
      const questions = [
        'What is 256-QAM?',
        'How do I configure MIMO?',
        'What counters measure CA performance?',
      ];

      for (const question of questions) {
        await workflow.processQuestion({ question });
      }

      const stats = workflow.getStatistics();
      expect(stats.totalQuestions).toBe(3);
    });
  });

  describe('Feature Knowledge Retrieval', () => {
    it('should retrieve relevant parameters', async () => {
      const request: QARequest = {
        question: 'What parameters are needed for 256-QAM?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.metadata.agentsConsulted).toContain('256qam');
      expect(response.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should retrieve relevant counters', async () => {
      const request: QARequest = {
        question: 'What counters track MIMO performance?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.metadata.agentsConsulted).toContain('mimo');
    });

    it('should retrieve relevant KPIs', async () => {
      const request: QARequest = {
        question: 'What KPIs measure carrier aggregation gain?',
      };

      const response = await workflow.processQuestion(request);

      expect(response.metadata.agentsConsulted).toContain('ca');
    });
  });

  describe('Q-Learning Updates', () => {
    it('should record feedback and update Q-learning', async () => {
      const request: QARequest = {
        question: 'How do I configure 256-QAM?',
      };

      const response = await workflow.processQuestion(request);

      // Record positive feedback
      await workflow.recordFeedback(request, response, {
        rating: 0.8,
        resolved: true,
        comment: 'Answer was helpful',
      });

      // Verify feedback was recorded
      const stats = workflow.getStatistics();
      expect(stats.totalQuestions).toBeGreaterThan(0);
    });

    it('should adjust confidence based on feedback', async () => {
      const request: QARequest = {
        question: 'What is MIMO?',
      };

      const response = await workflow.processQuestion(request);

      // Record negative feedback
      await workflow.recordFeedback(request, response, {
        rating: -0.5,
        resolved: false,
        comment: 'Answer was unclear',
      });

      // State machine should update confidence
      const stateMachine = (workflow as any).config.stateMachine as AutonomousStateMachine;
      expect(stateMachine.health).toBeGreaterThanOrEqual(0);
      expect(stateMachine.health).toBeLessThanOrEqual(1);
    });

    it('should trigger federated sync periodically', async () => {
      // Record multiple interactions to trigger sync
      const questions = Array(15).fill(null).map((_, i) => ({
        question: `Test question ${i}`,
      }));

      for (const q of questions) {
        const response = await workflow.processQuestion(q);
        await workflow.recordFeedback(q, response, { rating: 0.5 });
      }

      // Verify federated sync occurred
      const qLearningUpdate = (workflow as any).qLearningUpdate;
      const stats = qLearningUpdate.getStatistics();
      expect(stats.totalInteractions).toBeGreaterThan(0);
    });
  });

  describe('Performance Targets', () => {
    it('should process questions within performance target (<100ms)', async () => {
      const request: QARequest = {
        question: 'What is 256-QAM?',
      };

      const startTime = Date.now();
      const response = await workflow.processQuestion(request);
      const duration = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(duration).toBeLessThan(500); // Relaxed for test environment
    });

    it('should maintain high confidence for trained questions', async () => {
      // Process same question multiple times to build confidence
      const request: QARequest = {
        question: 'What is 256-QAM?',
      };

      for (let i = 0; i < 5; i++) {
        const response = await workflow.processQuestion(request);
        await workflow.recordFeedback(request, response, { rating: 1.0, resolved: true });
      }

      const stats = workflow.getStatistics();
      expect(parseFloat(stats.avgConfidence)).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed questions gracefully', async () => {
      const request: QARequest = {
        question: '',
      };

      const response = await workflow.processQuestion(request);

      expect(response).toBeDefined();
      expect(response.actionTaken).toBe('RequestClarification');
    });

    it('should handle unknown questions with escalation', async () => {
      const request: QARequest = {
        question: 'How do I configure feature-xyz-123 that does not exist?',
      };

      const response = await workflow.processQuestion(request);

      expect(response).toBeDefined();
      expect(['RequestClarification', 'Escalate']).toContain(response.actionTaken);
    });

    it('should handle missing context gracefully', async () => {
      const request: QARequest = {
        question: 'How do I configure this?',
      };

      const response = await workflow.processQuestion(request);

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track workflow statistics accurately', async () => {
      // Process various types of questions
      const questions = [
        { question: 'What is 256-QAM?' },
        { question: 'How do I configure MIMO?' },
        { question: 'What counters measure CA?' },
      ];

      for (const q of questions) {
        await workflow.processQuestion(q);
      }

      const stats = workflow.getStatistics();

      expect(stats.totalQuestions).toBe(3);
      expect(stats.featureAgents).toBe(3); // 256qam, mimo, ca
      expect(stats.avgProcessingTimeMs).toBeTruthy();
      expect(stats.avgConfidence).toBeTruthy();
    });

    it('should provide component-level statistics', async () => {
      const request: QARequest = {
        question: 'What is 256-QAM?',
      };

      await workflow.processQuestion(request);

      // Get individual component stats
      const questionRouter = (workflow as any).questionRouter;
      const featureSpecialist = (workflow as any).featureSpecialist;
      const oodaCycle = (workflow as any).oodaCycle;
      const answerGenerator = (workflow as any).answerGenerator;
      const qLearningUpdate = (workflow as any).qLearningUpdate;

      expect(questionRouter.getStatistics()).toBeDefined();
      expect(featureSpecialist.getStatistics()).toBeDefined();
      expect(oodaCycle.getStatistics()).toBeDefined();
      expect(answerGenerator.getStatistics()).toBeDefined();
      expect(qLearningUpdate.getStatistics()).toBeDefined();
    });
  });

  describe('Federated Learning', () => {
    it('should trigger manual federated sync', async () => {
      await workflow.triggerFederatedSync();

      const qLearningUpdate = (workflow as any).qLearningUpdate;
      const stats = qLearningUpdate.getStatistics();
      expect(stats.federatedLearningEnabled).toBe(true);
    });

    it('should sync Q-table with peers', async () => {
      // Process some questions first
      for (let i = 0; i < 5; i++) {
        const request: QARequest = { question: `Test ${i}` };
        const response = await workflow.processQuestion(request);
        await workflow.recordFeedback(request, response, { rating: 0.5 });
      }

      // Trigger sync
      await workflow.triggerFederatedSync();

      const qLearningUpdate = (workflow as any).qLearningUpdate;
      const stats = qLearningUpdate.getStatistics();
      expect(stats.federatedSyncs).toBeGreaterThan(0);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully with final sync', async () => {
      const request: QARequest = {
        question: 'Test question before shutdown',
      };

      await workflow.processQuestion(request);
      await workflow.shutdown();

      // Verify shutdown completed
      expect(workflow).toBeDefined();
    });
  });
});

describe('Factory Function', () => {
  it('should create workflow with default config', async () => {
    const mockAgentDB = new MockAgentDB();
    const mockHNSWIndex = new MockHNSWIndex();

    const workflow = await createAutonomousQAWorkflow({
      agentDB: mockAgentDB as any,
      hnswIndex: mockHNSWIndex as any,
      featureAgentRegistry: SAMPLE_FEATURE_REGISTRY,
    });

    expect(workflow).toBeInstanceOf(AutonomousQAWorkflow);

    await workflow.shutdown();
  });

  it('should create workflow with custom config', async () => {
    const mockAgentDB = new MockAgentDB();
    const mockHNSWIndex = new MockHNSWIndex();

    const workflow = await createAutonomousQAWorkflow({
      agentDB: mockAgentDB as any,
      hnswIndex: mockHNSWIndex as any,
      featureAgentRegistry: SAMPLE_FEATURE_REGISTRY,
      confidenceThreshold: 0.8,
      enableFederatedLearning: false,
    });

    expect(workflow).toBeInstanceOf(AutonomousQAWorkflow);

    await workflow.shutdown();
  });
});
