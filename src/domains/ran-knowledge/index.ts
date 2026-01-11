/**
 * RAN Knowledge Domain
 *
 * Autonomous Question-Answering workflow for Ericsson RAN features
 * using WASM-based agents, OODA cycle, and Q-learning.
 *
 * @module domains/ran-knowledge
 */

// Main workflow orchestrator
export {
  AutonomousQAWorkflow,
  QuestionRouter,
  FeatureSpecialist,
  OODACycle,
  AnswerGenerator,
  QLearningUpdate,
} from './workflow/autonomous-qa';

export type {
  AutonomousQAConfig,
  QARequest,
  QAResponse,
  FeatureAgentKnowledge,
  RoutingResult,
  OODADecision,
  FeatureKnowledge,
  GeneratedAnswer,
} from './workflow/autonomous-qa';

// Workflow components
export { QuestionRouter } from './workflow/question-router';
export type { QuestionRouterConfig, RoutingResult } from './workflow/question-router';

export { FeatureSpecialist } from './workflow/feature-specialist';
export type {
  FeatureSpecialistConfig,
  FeatureKnowledge,
  ParameterInfo,
  CounterInfo,
  KPIInfo,
} from './workflow/feature-specialist';

export { OODACycle } from './workflow/ooda-cycle';
export type {
  OODACycleConfig,
  OODAContext,
  OODADecision,
  ObservePhase,
  OrientPhase,
  DecidePhase,
} from './workflow/ooda-cycle';

export { AnswerGenerator } from './workflow/answer-generator';
export type {
  AnswerGeneratorConfig,
  AnswerGenerationContext,
  GeneratedAnswer,
} from './workflow/answer-generator';

export { QLearningUpdate } from './workflow/q-learning-update';
export type {
  QLearningUpdateConfig,
  InteractionRecord,
  FeedbackData,
} from './workflow/q-learning-update';

// Value objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';
