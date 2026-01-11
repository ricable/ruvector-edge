/**
 * Test Question Entity
 *
 * Represents a single technical question for RAN feature agent battle testing.
 * Part of the RAN Battle Test bounded context (ADR-025).
 *
 * @module ran-battle-test/entities/test-question
 */

import { FAJCode } from '../../knowledge/value-objects/faj-code';

/**
 * Question Category Enum
 */
export enum QuestionCategory {
  /** Category A: Knowledge Retrieval (Q1-Q125) */
  KNOWLEDGE = 'A',

  /** Category B: Decision Making (Q126-Q200) */
  DECISION = 'B',

  /** Category C: Advanced Troubleshooting (Q201-Q250) */
  ADVANCED = 'C'
}

/**
 * Question Type Enum
 */
export enum QuestionType {
  /** Basic feature knowledge */
  BASIC_KNOWLEDGE = 'K01',
  /** Parameter understanding */
  PARAMETER_KNOWLEDGE = 'K02',
  /** Counter/KPI knowledge */
  COUNTER_KNOWLEDGE = 'K03',
  /** Decision criteria */
  DECISION_CRITERIA = 'D01',
  /** Advanced scenario */
  ADVANCED_SCENARIO = 'A01'
}

/**
 * Complexity Level Enum
 */
export enum ComplexityLevel {
  SIMPLE = 'Simple',
  MODERATE = 'Moderate',
  COMPLEX = 'Complex',
  EXPERT = 'Expert'
}

/**
 * Test Question Entity
 */
export class TestQuestion {
  readonly id: string;
  readonly questionNumber: number;
  readonly category: QuestionCategory;
  readonly type: QuestionType;
  readonly featureAcronym: string;
  readonly featureFAJ: FAJCode;
  readonly featureName: string;
  readonly content: string;
  readonly complexity: ComplexityLevel;
  readonly expectedKeywords: string[];
  readonly expectedParameters: string[];
  readonly expectedCounters: string[];
  readonly points: number;
  readonly metadata: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly sourceDocument?: string;
    readonly tags: string[];
  };

  private constructor(
    id: string,
    questionNumber: number,
    category: QuestionCategory,
    type: QuestionType,
    featureAcronym: string,
    featureFAJ: FAJCode,
    featureName: string,
    content: string,
    complexity: ComplexityLevel,
    expectedKeywords: string[],
    expectedParameters: string[],
    expectedCounters: string[],
    points: number,
    metadata: {
      createdAt: Date;
      updatedAt: Date;
      sourceDocument?: string;
      tags: string[];
    }
  ) {
    this.id = id;
    this.questionNumber = questionNumber;
    this.category = category;
    this.type = type;
    this.featureAcronym = featureAcronym;
    this.featureFAJ = featureFAJ;
    this.featureName = featureName;
    this.content = content;
    this.complexity = complexity;
    this.expectedKeywords = expectedKeywords;
    this.expectedParameters = expectedParameters;
    this.expectedCounters = expectedCounters;
    this.points = points;
    this.metadata = metadata;
  }

  /**
   * Factory method to create a TestQuestion
   */
  static create(props: {
    questionNumber: number;
    category: QuestionCategory;
    type: QuestionType;
    featureAcronym: string;
    featureFAJ: string;
    featureName: string;
    content: string;
    complexity: ComplexityLevel;
    expectedKeywords?: string[];
    expectedParameters?: string[];
    expectedCounters?: string[];
    points?: number;
    sourceDocument?: string;
    tags?: string[];
  }): TestQuestion {
    const fajCode = new FAJCode(props.featureFAJ);
    // Include type in ID for filtering: Q{number}-{acronym}-{type}
    const typeSuffix = props.type.substring(0, 2); // 'K0', 'K1', 'K2', 'D0', 'A0'
    const id = `Q${props.questionNumber}-${props.featureAcronym}-${typeSuffix}`;
    const points = props.points ?? this.defaultPoints(props.category, props.type);

    return new TestQuestion(
      id,
      props.questionNumber,
      props.category,
      props.type,
      props.featureAcronym,
      fajCode,
      props.featureName,
      props.content,
      props.complexity,
      props.expectedKeywords ?? [],
      props.expectedParameters ?? [],
      props.expectedCounters ?? [],
      points,
      {
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceDocument: props.sourceDocument,
        tags: props.tags ?? []
      }
    );
  }

  /**
   * Get default points based on category and type
   */
  private static defaultPoints(category: QuestionCategory, type: QuestionType): number {
    if (category === QuestionCategory.KNOWLEDGE) {
      return 5; // 40 points per feature = 8 questions × 5 points
    } else if (category === QuestionCategory.DECISION) {
      return 8; // Higher points for decision-making
    } else {
      return 10; // Highest points for advanced scenarios
    }
  }

  /**
   * Check if answer contains expected keywords
   */
  hasExpectedKeywords(answer: string): boolean {
    const lowerAnswer = answer.toLowerCase();
    return this.expectedKeywords.every(keyword =>
      lowerAnswer.includes(keyword.toLowerCase())
    );
  }

  /**
   * Calculate partial score based on content matching
   */
  calculatePartialScore(answer: string): number {
    let score = 0;
    const maxScore = this.points;

    // Check keyword presence (40% of score)
    if (this.expectedKeywords.length > 0) {
      const keywordMatches = this.expectedKeywords.filter(keyword =>
        answer.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += (keywordMatches / this.expectedKeywords.length) * maxScore * 0.4;
    } else {
      score += maxScore * 0.4; // Full points if no keywords expected
    }

    // Check parameter mentions (30% of score)
    if (this.expectedParameters.length > 0) {
      const paramMatches = this.expectedParameters.filter(param =>
        answer.toLowerCase().includes(param.toLowerCase())
      ).length;
      score += (paramMatches / this.expectedParameters.length) * maxScore * 0.3;
    } else {
      score += maxScore * 0.3;
    }

    // Check counter mentions (30% of score)
    if (this.expectedCounters.length > 0) {
      const counterMatches = this.expectedCounters.filter(counter =>
        answer.toLowerCase().includes(counter.toLowerCase())
      ).length;
      score += (counterMatches / this.expectedCounters.length) * maxScore * 0.3;
    } else {
      score += maxScore * 0.3;
    }

    return Math.min(maxScore, Math.max(0, score));
  }

  /**
   * Get question identifier for storage
   */
  getStorageKey(): string {
    return `ran-battle-questions:${this.id}`;
  }

  /**
   * Convert to storage format
   */
  toStorage(): {
    key: string;
    value: string;
    metadata: { namespace: string; tags: string[] };
  } {
    return {
      key: this.getStorageKey(),
      value: JSON.stringify({
        id: this.id,
        questionNumber: this.questionNumber,
        category: this.category,
        type: this.type,
        featureAcronym: this.featureAcronym,
        featureFAJ: this.featureFAJ.toString(),
        featureName: this.featureName,
        content: this.content,
        complexity: this.complexity,
        expectedKeywords: this.expectedKeywords,
        expectedParameters: this.expectedParameters,
        expectedCounters: this.expectedCounters,
        points: this.points
      }),
      metadata: {
        namespace: 'ran-battle-questions',
        tags: [
          this.featureAcronym,
          this.category,
          this.type,
          this.complexity,
          ...this.metadata.tags
        ]
      }
    };
  }

  /**
   * Create from storage format
   */
  static fromStorage(data: {
    id: string;
    questionNumber: number;
    category: QuestionCategory;
    type: QuestionType;
    featureAcronym: string;
    featureFAJ: string;
    featureName: string;
    content: string;
    complexity: ComplexityLevel;
    expectedKeywords: string[];
    expectedParameters: string[];
    expectedCounters: string[];
    points: number;
  }): TestQuestion {
    return new TestQuestion(
      data.id,
      data.questionNumber,
      data.category,
      data.type,
      data.featureAcronym,
      new FAJCode(data.featureFAJ),
      data.featureName,
      data.content,
      data.complexity,
      data.expectedKeywords,
      data.expectedParameters,
      data.expectedCounters,
      data.points,
      {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: []
      }
    );
  }

  /**
   * Equality check
   */
  equals(other: TestQuestion): boolean {
    return this.id === other.id;
  }

  /**
   * String representation
   */
  toString(): string {
    return `TestQuestion(${this.id}, ${this.featureAcronym}, ${this.category}, ${this.points}pts)`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      id: this.id,
      questionNumber: this.questionNumber,
      category: this.category,
      type: this.type,
      featureAcronym: this.featureAcronym,
      featureFAJ: this.featureFAJ.toString(),
      featureName: this.featureName,
      content: this.content,
      complexity: this.complexity,
      expectedKeywords: this.expectedKeywords,
      expectedParameters: this.expectedParameters,
      expectedCounters: this.expectedCounters,
      points: this.points
    };
  }
}

/**
 * Question Bank Value Object
 * Contains all 250 test questions
 */
export interface QuestionBank {
  readonly questions: Map<string, TestQuestion>;
  readonly byFeature: Map<string, TestQuestion[]>;
  readonly byCategory: Map<QuestionCategory, TestQuestion[]>;

  getQuestion(id: string): TestQuestion | undefined;
  getFeatureQuestions(acronym: string): TestQuestion[];
  getCategoryQuestions(category: QuestionCategory): TestQuestion[];
  getTotalPoints(): number;
}

/**
 * Default Question Bank Implementation
 */
export class DefaultQuestionBank implements QuestionBank {
  readonly questions: Map<string, TestQuestion>;
  readonly byFeature: Map<string, TestQuestion[]>;
  readonly byCategory: Map<QuestionCategory, TestQuestion[]>;

  constructor(questions: TestQuestion[]) {
    this.questions = new Map(questions.map(q => [q.id, q]));
    this.byFeature = this.groupByFeature(questions);
    this.byCategory = this.groupByCategory(questions);
  }

  private groupByFeature(questions: TestQuestion[]): Map<string, TestQuestion[]> {
    const grouped = new Map<string, TestQuestion[]>();
    for (const question of questions) {
      const existing = grouped.get(question.featureAcronym) ?? [];
      existing.push(question);
      grouped.set(question.featureAcronym, existing);
    }
    return grouped;
  }

  private groupByCategory(questions: TestQuestion[]): Map<QuestionCategory, TestQuestion[]> {
    const grouped = new Map<QuestionCategory, TestQuestion[]>();
    for (const question of questions) {
      const existing = grouped.get(question.category) ?? [];
      existing.push(question);
      grouped.set(question.category, existing);
    }
    return grouped;
  }

  getQuestion(id: string): TestQuestion | undefined {
    return this.questions.get(id);
  }

  getFeatureQuestions(acronym: string): TestQuestion[] {
    return this.byFeature.get(acronym) ?? [];
  }

  getCategoryQuestions(category: QuestionCategory): TestQuestion[] {
    return this.byCategory.get(category) ?? [];
  }

  getTotalPoints(): number {
    let total = 0;
    for (const question of this.questions.values()) {
      total += question.points;
    }
    return total;
  }
}

export default TestQuestion;
