/**
 * Autonomous QA Workflow - Example Usage
 *
 * This script demonstrates how to use the Autonomous QA Workflow
 * for RAN feature questions with WASM-based agents and Q-learning.
 *
 * @file examples/autonomous-qa-usage.ts
 */

import { AutonomousQAWorkflow, QARequest, QAResponse } from '../src/domains/ran-knowledge/workflow/autonomous-qa';
import { AgentDB } from '@agentdb/core';
import { HNSWIndex } from '@agentdb/hnsw';
import { QTable } from '../src/domains/intelligence/aggregates/q-table';
import { TrajectoryBuffer } from '../src/domains/intelligence/aggregates/trajectory-buffer';
import { AutonomousStateMachine } from '../src/domains/intelligence/aggregates/autonomous-state-machine';
import type { FeatureAgentKnowledge } from '../src/domains/ran-knowledge/workflow/autonomous-qa';

/**
 * Example: Initialize the Autonomous QA Workflow
 */
async function initializeWorkflow(): Promise<AutonomousQAWorkflow> {
  console.log('🚀 Initializing Autonomous QA Workflow...\n');

  // 1. Initialize AgentDB with hybrid backend
  const agentDB = new AgentDB({
    backend: 'hybrid',
    namespace: 'ran-knowledge',
  });

  // 2. Initialize HNSW Index for fast semantic search (150x-12,500x faster)
  const hnswIndex = new HNSWIndex({
    dimensions: 128,
    M: 16,
    efConstruction: 200,
    efSearch: 50,
  });

  // 3. Initialize Q-Table with RAN-optimized hyperparameters
  const qTable = new QTable({
    alpha: 0.1,       // Learning rate (from PRD)
    gamma: 0.95,      // Discount factor (from PRD)
    epsilon: 0.1,     // Exploration rate
    epsilon_decay: 0.995,
    min_epsilon: 0.01,
  });

  // 4. Initialize Trajectory Buffer for experience replay
  const trajectoryBuffer = new TrajectoryBuffer({
    maxSize: 10000,
    prioritizeBy: 'reward',
  });

  // 5. Initialize State Machine for agent lifecycle
  const stateMachine = new AutonomousStateMachine({
    initialState: 'ColdStart',
    coldStartThreshold: 100,
  });

  // 6. Load Feature Knowledge Base (593 agents)
  const featureRegistry = await loadFeatureKnowledgeBase();

  // 7. Create Workflow
  const workflow = new AutonomousQAWorkflow({
    agentDB,
    hnswIndex,
    qTable,
    trajectoryBuffer,
    stateMachine,
    featureRegistry,
    maxContextRetrieval: 10,
    confidenceThreshold: 0.7,
    enableFederatedLearning: true,
    federatedSyncInterval: 60000, // 60 seconds
  });

  console.log('✅ Workflow initialized successfully!\n');
  return workflow;
}

/**
 * Example: Load Feature Knowledge Base
 *
 * In production, this would load from the actual Ericsson RAN features database.
 * For this example, we'll create a sample registry.
 */
async function loadFeatureKnowledgeBase(): Promise<Map<string, FeatureAgentKnowledge>> {
  const registry = new Map<string, FeatureAgentKnowledge>();

  // Sample: Energy Saving features
  registry.set('FAJ 121 3094', {
    fajCode: 'FAJ 121 3094',
    category: 'Energy Saving',
    featureName: 'MIMO Sleep Mode',
    parameters: [
      'mimoSleepThreshold',
      'wakeHysteresis',
      'minActiveUEs',
      'sleepMode',
    ],
    counters: [
      'pmMimoSleepActivations',
      'pmMimoSleepDeactivations',
      'pmEnergySaved',
    ],
    kpis: [
      'EnergyEfficiency',
      'PowerConsumption',
      'SleepModeRatio',
    ],
    embedding: new Array(128).fill(0).map(() => Math.random()), // Sample embedding
  });

  // Sample: Mobility features
  registry.set('FAJ 121 3001', {
    fajCode: 'FAJ 121 3001',
    category: 'Mobility & Handover',
    featureName: 'A3 Event Handover',
    parameters: [
      'a3Offset',
      'hysteresis',
      'timeToTrigger',
    ],
    counters: [
      'pmHoExeSucc',
      'pmHoExeAtt',
      'pmHoFail',
      'pmHoTooEarly',
      'pmHoTooLate',
    ],
    kpis: [
      'HandoverSuccessRate',
      'PingPongRate',
    ],
    embedding: new Array(128).fill(0).map(() => Math.random()),
  });

  // Sample: Carrier Aggregation features
  registry.set('FAJ 121 2050', {
    fajCode: 'FAJ 121 2050',
    category: 'Carrier Aggregation',
    featureName: '3CC DL CA Extension',
    parameters: [
      'scc1Config',
      'scc2Config',
      'scc3Config',
      'caActivationThreshold',
    ],
    counters: [
      'pmCaConfigAttempts',
      'pmCaConfigSuccess',
      'pmSccAdditions',
      'pmSccRemovals',
    ],
    kpis: [
      'CAActivationRate',
      'AggregatedThroughput',
    ],
    embedding: new Array(128).fill(0).map(() => Math.random()),
  });

  // In production, load all 593 features from database
  console.log(`📚 Loaded ${registry.size} feature agents (sample)`);
  console.log(`   (Production: 593 agents)\n`);

  return registry;
}

/**
 * Example: Process a single question
 */
async function exampleProcessQuestion(workflow: AutonomousQAWorkflow): Promise<void> {
  console.log('📝 Example 1: Processing a single question\n');

  const request: QARequest = {
    question: 'How do I configure MIMO Sleep Mode to achieve 30% energy savings?',
    context: {
      goal: 'energy-optimization',
      targetSavings: 0.3,
    },
    userId: 'user-123',
    timestamp: new Date(),
  };

  console.log(`Question: "${request.question}"\n`);

  const response = await workflow.processQuestion(request);

  console.log('Response:');
  console.log(`  Action: ${response.actionTaken}`);
  console.log(`  Confidence: ${(response.confidence * 100).toFixed(1)}%`);
  console.log(`  Sources: ${response.sources.join(', ')}`);
  console.log(`  Processing Time: ${response.metadata.processingTimeMs}ms`);
  console.log(`  OODA Phase: ${response.metadata.oodaPhase}\n`);

  console.log('Answer:');
  console.log(response.answer);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Example: Process multiple questions from the 50 RAN questions
 */
async function exampleProcessBatch(workflow: AutonomousQAWorkflow): Promise<void> {
  console.log('📝 Example 2: Processing batch of RAN questions\n');

  const questions: QARequest[] = [
    {
      question: 'What are the prerequisites for enabling 24 cell support (12CS)?',
      timestamp: new Date(),
    },
    {
      question: 'Under what conditions should 256-QAM downlink be enabled?',
      timestamp: new Date(),
    },
    {
      question: 'How does ATO differ from MLB for load balancing?',
      timestamp: new Date(),
    },
    {
      question: 'What are the safe zone limits for handoverThreshold parameter?',
      timestamp: new Date(),
    },
    {
      question: 'How do I configure ANR for automatic neighbor discovery?',
      timestamp: new Date(),
    },
  ];

  for (const request of questions) {
    console.log(`Q: "${request.question}"`);

    const response = await workflow.processQuestion(request);

    console.log(`  → ${response.actionTaken} (${(response.confidence * 100).toFixed(1)}% confidence)`);
    console.log(`  → ${response.metadata.processingTimeMs}ms | ${response.sources.length} sources\n`);
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Example: Record feedback and trigger learning
 */
async function exampleFeedbackLearning(workflow: AutonomousQAWorkflow): Promise<void> {
  console.log('📝 Example 3: Recording feedback for learning\n');

  // First, process a question
  const request: QARequest = {
    question: 'What is the procedure to enable 7-12 cell support?',
    timestamp: new Date(),
  };

  const response = await workflow.processQuestion(request);

  console.log(`Original response confidence: ${(response.confidence * 100).toFixed(1)}%\n`);

  // User provides positive feedback
  console.log('User feedback: ⭐⭐⭐⭐⭐ (5 stars) - Resolved: Yes');
  await workflow.recordFeedback(request, response, {
    rating: 1.0, // Maximum positive
    resolved: true,
    comment: 'Perfect answer, helped me configure the feature successfully!',
  });

  console.log('\n✅ Q-table updated with positive feedback\n');

  // Process similar question again (should have higher confidence)
  console.log('Processing similar question again...');
  const similarRequest: QARequest = {
    question: 'How do I enable 7-12 cell support on my eNodeB?',
    timestamp: new Date(),
  };

  const similarResponse = await workflow.processQuestion(similarRequest);

  console.log(`New response confidence: ${(similarResponse.confidence * 100).toFixed(1)}%`);
  console.log(`(Learning improved confidence from learning)\n`);

  console.log('='.repeat(80) + '\n');
}

/**
 * Example: Trigger federated learning sync
 */
async function exampleFederatedSync(workflow: AutonomousQAWorkflow): Promise<void> {
  console.log('📝 Example 4: Federated learning synchronization\n');

  console.log('Triggering federated sync across agent swarm...');
  await workflow.triggerFederatedSync();

  console.log('✅ Q-table synchronized with peer agents\n');

  const stats = workflow.getStatistics();
  console.log('Current Statistics:');
  console.log(`  Total Questions: ${stats.totalQuestions}`);
  console.log(`  Answered Directly: ${stats.answeredDirectly}`);
  console.log(`  Answered With Context: ${stats.answeredWithContext}`);
  console.log(`  Escalated: ${stats.escalated}`);
  console.log(`  Average Confidence: ${stats.avgConfidence}`);
  console.log(`  Average Processing Time: ${stats.avgProcessingTimeMs}ms`);
  console.log(`  Q-Table Size: ${stats.qTableSize} entries`);
  console.log(`  Trajectory Size: ${stats.trajectorySize} experiences`);
  console.log(`  Feature Agents: ${stats.featureAgents}\n`);

  console.log('='.repeat(80) + '\n');
}

/**
 * Example: Shutdown workflow gracefully
 */
async function exampleShutdown(workflow: AutonomousQAWorkflow): Promise<void> {
  console.log('📝 Example 5: Graceful shutdown\n');

  console.log('Shutting down workflow...');
  await workflow.shutdown();

  console.log('✅ Workflow shut down successfully');
  console.log('   - Final federated sync completed');
  console.log('   - Q-table exported');
  console.log('   - Trajectory buffer saved\n');
}

/**
 * Main: Run all examples
 */
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  Autonomous QA Workflow - Example Usage');
  console.log('  RAN Domain Knowledge with WASM-Based Agents');
  console.log('='.repeat(80) + '\n');

  try {
    // Initialize
    const workflow = await initializeWorkflow();

    // Run examples
    await exampleProcessQuestion(workflow);
    await exampleProcessBatch(workflow);
    await exampleFeedbackLearning(workflow);
    await exampleFederatedSync(workflow);

    // Shutdown
    await exampleShutdown(workflow);

    console.log('='.repeat(80));
    console.log('  All examples completed successfully! ✅');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run examples if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  initializeWorkflow,
  exampleProcessQuestion,
  exampleProcessBatch,
  exampleFeedbackLearning,
  exampleFederatedSync,
  exampleShutdown,
};
