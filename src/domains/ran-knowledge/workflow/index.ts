/**
 * RAN Knowledge Workflow Module
 *
 * Autonomous Question-Answering workflow for Ericsson RAN domain
 * with WASM-fast feature lookup, OODA cycle, and Q-learning.
 *
 * @module ran-knowledge/workflow
 */

// Main workflow orchestrator
export { AutonomousQAWorkflow } from './autonomous-qa';
export type {
  AutonomousQAConfig,
  QARequest,
  QAResponse,
  FeatureAgentKnowledge,
  RoutingResult,
  OODADecision,
  FeatureKnowledge,
  GeneratedAnswer,
} from './autonomous-qa';

// Question Router - WASM-fast semantic routing
export { QuestionRouter } from './question-router';
export type {
  QuestionRouterConfig,
  RoutingResult,
} from './question-router';

// Feature Specialist - Fast feature knowledge retrieval
export { FeatureSpecialist } from './feature-specialist';
export type {
  FeatureSpecialistConfig,
  FeatureKnowledge,
  ParameterInfo,
  CounterInfo,
  KPIInfo,
} from './feature-specialist';

// OODA Cycle - Autonomous decision-making
export { OODACycle } from './ooda-cycle';
export type {
  OODACycleConfig,
  OODAContext,
  OODADecision,
  ObservePhase,
  OrientPhase,
  DecidePhase,
} from './ooda-cycle';

// Answer Generator - Confidence-scored responses
export { AnswerGenerator } from './answer-generator';
export type {
  AnswerGeneratorConfig,
  AnswerGenerationContext,
  GeneratedAnswer,
} from './answer-generator';

// Q-Learning Update - Continuous learning
export { QLearningUpdate } from './q-learning-update';
export type {
  QLearningUpdateConfig,
  InteractionRecord,
  FeedbackData,
} from './q-learning-update';

// Factory function for creating a complete workflow
import { AgentDB } from '@agentdb/core';
import { HNSWIndex } from '@agentdb/hnsw';
import { QTable, QTableConfig } from '../../intelligence';
import { TrajectoryBuffer } from '../../intelligence';
import { AutonomousStateMachine, AutonomousStateMachineConfig } from '../../intelligence';
import { AutonomousQAWorkflow, AutonomousQAConfig } from './autonomous-qa';
import { QuestionRouter } from './question-router';
import { FeatureSpecialist } from './feature-specialist';
import { OODACycle } from './ooda-cycle';
import { AnswerGenerator } from './answer-generator';
import { QLearningUpdate } from './q-learning-update';
import type { FeatureAgentKnowledge } from './autonomous-qa';

/**
 * Create a complete Autonomous QA Workflow
 *
 * Factory function that initializes all components with proper dependencies.
 *
 * @param config - Workflow configuration
 * @returns Initialized AutonomousQAWorkflow
 */
export async function createAutonomousQAWorkflow(
  config: {
    agentId: string;
    agentDB: AgentDB;
    hnswIndex?: HNSWIndex;
    featureAgentRegistry: Map<string, FeatureAgentKnowledge>;
    qTableConfig?: QTableConfig;
    stateMachineConfig?: AutonomousStateMachineConfig;
    maxContextRetrieval?: number;
    confidenceThreshold?: number;
    enableFederatedLearning?: boolean;
    federatedSyncInterval?: number;
  }
): Promise<AutonomousQAWorkflow> {
  // Initialize Q-table
  const qTable = new QTable(
    `ran-qa-qtable-${Date.now()}`,
    config.agentId,
    config.qTableConfig
  );

  // Initialize trajectory buffer
  const trajectoryBuffer = new TrajectoryBuffer(
    `ran-qa-trajectory-${Date.now()}`,
    config.agentId,
    { maxSize: 1000 }
  );

  // Initialize state machine
  const stateMachine = new AutonomousStateMachine(
    `ran-qa-state-machine-${Date.now()}`,
    config.stateMachineConfig ?? {
      agentId: config.agentId,
      coldStartThreshold: 100,
      degradedThreshold: 0.5,
      explorationBaseRate: 0.1,
      recoveryThreshold: 0.3,
    }
  );

  // Create workflow config
  const workflowConfig: AutonomousQAConfig = {
    agentId: config.agentId,
    agentDB: config.agentDB,
    hnswIndex: config.hnswIndex,
    qTable,
    trajectoryBuffer,
    stateMachine,
    featureAgentRegistry: config.featureAgentRegistry,
    maxContextRetrieval: config.maxContextRetrieval ?? 10,
    confidenceThreshold: config.confidenceThreshold ?? 0.7,
    enableFederatedLearning: config.enableFederatedLearning ?? true,
    federatedSyncInterval: config.federatedSyncInterval ?? 60000,
  };

  // Create and return workflow
  return new AutonomousQAWorkflow(workflowConfig);
}

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG = {
  agentId: 'ran-qa-workflow',
  maxContextRetrieval: 10,
  confidenceThreshold: 0.7,
  enableFederatedLearning: true,
  federatedSyncInterval: 60000,
  qTableConfig: {
    gamma: 0.95,
    alpha: 0.1,
    epsilon: 0.1,
  } as QTableConfig,
  stateMachineConfig: {
    agentId: 'ran-qa-workflow',
    coldStartThreshold: 100,
    degradedThreshold: 0.5,
    explorationBaseRate: 0.1,
    recoveryThreshold: 0.3,
  } as AutonomousStateMachineConfig,
};
