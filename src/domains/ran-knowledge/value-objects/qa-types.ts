/**
 * QA Type Value Objects
 *
 * Core value objects for the autonomous QA workflow.
 *
 * @module domains/ran-knowledge/value-objects/qa-types
 */

/**
 * Question Category
 */
export enum QuestionCategory {
  PARAMETER = 'parameter',
  COUNTER = 'counter',
  KPI = 'kpi',
  PROCEDURE = 'procedure',
  TROUBLESHOOT = 'troubleshoot',
  GENERAL = 'general',
}

/**
 * Question Complexity
 */
export enum QuestionComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
}

/**
 * Answer Action
 */
export enum AnswerAction {
  DIRECT_ANSWER = 'DirectAnswer',
  CONTEXT_ANSWER = 'ContextAnswer',
  CONSULT_PEER = 'ConsultPeer',
  REQUEST_CLARIFICATION = 'RequestClarification',
  ESCALATE = 'Escalate',
}

/**
 * Confidence Level
 */
export class ConfidenceLevel {
  private readonly value: number;

  constructor(value: number) {
    if (value < 0 || value > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }

  getPercentage(): number {
    return Math.round(this.value * 100);
  }

  getLevel(): 'low' | 'medium' | 'high' {
    if (this.value < 0.4) return 'low';
    if (this.value < 0.7) return 'medium';
    return 'high';
  }

  isAbove(threshold: number): boolean {
    return this.value >= threshold;
  }

  toString(): string {
    return `${this.getPercentage()}% (${this.getLevel()})`;
  }
}

/**
 * Processing Time
 */
export class ProcessingTime {
  private readonly ms: number;

  constructor(ms: number) {
    if (ms < 0) {
      throw new Error('Processing time cannot be negative');
    }
    this.ms = ms;
  }

  getValue(): number {
    return this.ms;
  }

  isInSeconds(): boolean {
    return this.ms >= 1000;
  }

  format(): string {
    if (this.ms < 1) {
      return `${(this.ms * 1000).toFixed(2)}μs`;
    } else if (this.ms < 1000) {
      return `${this.ms.toFixed(2)}ms`;
    } else {
      return `${(this.ms / 1000).toFixed(2)}s`;
    }
  }

  toString(): string {
    return this.format();
  }
}
