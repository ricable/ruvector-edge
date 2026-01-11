/**
 * RAN Battle Test Domain
 *
 * Domain for testing and validating RAN feature agent competence through
 * battle testing framework per ADR-025.
 *
 * Bounded Context: RAN Battle Testing
 *
 * @module ran-battle-test
 */

// Entities
export { TestQuestion, QuestionCategory, QuestionType, ComplexityLevel, DefaultQuestionBank } from './entities/test-question';
export type { QuestionBank } from './entities/test-question';

// Aggregates
export { BattleTest, TestMode, TestResultStatus } from './aggregates/battle-test';
export type {
  QuestionResult,
  FeatureTestResult,
  BattleTestResult,
  OODAMetrics,
  BattleTestConfig
} from './aggregates/battle-test';

export { QuestionBankLoader } from './aggregates/question-bank-loader';

// Re-export commonly used types
export type {
  TestQuestion as ITestQuestion,
  BattleTest as IBattleTest
} from '.';
