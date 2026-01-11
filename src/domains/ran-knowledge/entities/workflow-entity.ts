/**
 * Workflow Entity
 *
 * Core entity for workflow execution tracking.
 *
 * @module domains/ran-knowledge/entities/workflow-entity
 */

import { QuestionCategory } from '../value-objects/qa-types';
import { AnswerAction } from '../value-objects/qa-types';
import { ConfidenceLevel } from '../value-objects/qa-types';
import { ProcessingTime } from '../value-objects/qa-types';

/**
 * Workflow Execution Entity
 */
export class WorkflowExecution {
  private readonly id: string;
  private readonly question: string;
  private readonly category: QuestionCategory;
  private readonly action: AnswerAction;
  private readonly confidence: ConfidenceLevel;
  private readonly processingTime: ProcessingTime;
  private readonly timestamp: Date;
  private readonly agentsConsulted: string[];
  private feedbackReceived: boolean;
  private userRating?: number;

  constructor(props: {
    id: string;
    question: string;
    category: QuestionCategory;
    action: AnswerAction;
    confidence: ConfidenceLevel;
    processingTime: ProcessingTime;
    agentsConsulted: string[];
  }) {
    this.id = props.id;
    this.question = props.question;
    this.category = props.category;
    this.action = props.action;
    this.confidence = props.confidence;
    this.processingTime = props.processingTime;
    this.agentsConsulted = props.agentsConsulted;
    this.timestamp = new Date();
    this.feedbackReceived = false;
  }

  getId(): string {
    return this.id;
  }

  getQuestion(): string {
    return this.question;
  }

  getCategory(): QuestionCategory {
    return this.category;
  }

  getAction(): AnswerAction {
    return this.action;
  }

  getConfidence(): ConfidenceLevel {
    return this.confidence;
  }

  getProcessingTime(): ProcessingTime {
    return this.processingTime;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getAgentsConsulted(): string[] {
    return [...this.agentsConsulted];
  }

  hasFeedback(): boolean {
    return this.feedbackReceived;
  }

  recordFeedback(rating: number): void {
    this.feedbackReceived = true;
    this.userRating = rating;
  }

  getUserRating(): number | undefined {
    return this.userRating;
  }

  isSuccessful(): boolean {
    if (!this.feedbackReceived || this.userRating === undefined) {
      return false;
    }
    return this.userRating >= 0;
  }

  getReward(): number {
    if (!this.isSuccessful()) {
      return 0;
    }
    // Normalize rating from [-1, 1] to reward
    return this.userRating!;
  }

  toString(): string {
    return `WorkflowExecution(${this.id}) - ${this.action} [${this.confidence.toString()}]`;
  }
}

/**
 * Workflow Factory
 */
export class WorkflowExecutionFactory {
  static create(props: {
    question: string;
    category: QuestionCategory;
    action: AnswerAction;
    confidence: number;
    processingTimeMs: number;
    agentsConsulted: string[];
  }): WorkflowExecution {
    const id = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const confidence = new ConfidenceLevel(confidence);
    const processingTime = new ProcessingTime(processingTimeMs);

    return new WorkflowExecution({
      id,
      question: props.question,
      category: props.category,
      action: props.action,
      confidence,
      processingTime,
      agentsConsulted: props.agentsConsulted,
    });
  }
}
