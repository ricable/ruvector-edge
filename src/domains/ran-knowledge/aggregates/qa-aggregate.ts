/**
 * QA Aggregate Root
 *
 * Main aggregate for managing question-answer lifecycle.
 *
 * @module domains/ran-knowledge/aggregates/qa-aggregate
 */

import { QuestionCategory } from '../value-objects/qa-types';
import { AnswerAction } from '../value-objects/qa-types';
import { ConfidenceLevel } from '../value-objects/qa-types';
import { ProcessingTime } from '../value-objects/qa-types';
import { WorkflowExecution, WorkflowExecutionFactory } from '../entities/workflow-entity';

/**
 * QA Aggregate Root
 *
 * Manages the complete lifecycle of a question-answer interaction
 * from initial query through feedback and learning.
 */
export class QAAggregate {
  private executions: Map<string, WorkflowExecution>;
  private totalQuestions: number;
  private successfulAnswers: number;

  constructor() {
    this.executions = new Map();
    this.totalQuestions = 0;
    this.successfulAnswers = 0;
  }

  /**
   * Process a new question
   */
  processQuestion(props: {
    question: string;
    category: QuestionCategory;
    action: AnswerAction;
    confidence: number;
    processingTimeMs: number;
    agentsConsulted: string[];
  }): WorkflowExecution {
    this.totalQuestions++;

    const execution = WorkflowExecutionFactory.create(props);
    this.executions.set(execution.getId(), execution);

    return execution;
  }

  /**
   * Record feedback for an execution
   */
  recordFeedback(executionId: string, rating: number): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.recordFeedback(rating);

    if (execution.isSuccessful()) {
      this.successfulAnswers++;
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const successfulRate = this.totalQuestions > 0
      ? (this.successfulAnswers / this.totalQuestions) * 100
      : 0;

    const withFeedback = Array.from(this.executions.values()).filter(e => e.hasFeedback()).length;

    return {
      totalQuestions: this.totalQuestions,
      successfulAnswers: this.successfulAnswers,
      successRate: successfulRate.toFixed(2) + '%',
      feedbackReceived: withFeedback,
      feedbackRate: this.totalQuestions > 0
        ? ((withFeedback / this.totalQuestions) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Clear old executions (for memory management)
   */
  clearOldExecutions(olderThanHours: number = 24): number {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, execution] of this.executions) {
      if (execution.getTimestamp().getTime() < cutoff) {
        this.executions.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}
