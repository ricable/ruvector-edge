/**
 * Query Value Object
 *
 * Represents an incoming user query with type classification and context.
 */

export type QueryType = 'parameter' | 'counter' | 'kpi' | 'procedure' | 'troubleshoot' | 'general';
export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface QueryContext {
  readonly sessionId?: string;
  readonly previousQueries?: string[];
  readonly userRole?: string;
  readonly networkContext?: string;
}

export interface Vector {
  readonly dimensions: number[];
}

export class Query {
  constructor(
    public readonly id: string,
    public readonly type: QueryType,
    public readonly content: string,
    public readonly context: QueryContext,
    public readonly timestamp: Date,
    public readonly complexity: ComplexityLevel = 'medium',
    public readonly embedding?: Vector
  ) {
    Object.freeze(this);
    Object.freeze(this.context);
  }

  /**
   * Create query with auto-generated ID
   */
  static create(
    type: QueryType,
    content: string,
    context: QueryContext = {},
    complexity?: ComplexityLevel
  ): Query {
    const id = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const inferredComplexity = complexity ?? Query.inferComplexity(content);
    return new Query(id, type, content, context, new Date(), inferredComplexity);
  }

  /**
   * Infer complexity from query content
   */
  static inferComplexity(content: string): ComplexityLevel {
    const wordCount = content.split(/\s+/).length;
    const hasMultipleQuestions = (content.match(/\?/g) || []).length > 1;
    const hasTechnicalTerms = /parameter|counter|kpi|threshold|optimization/i.test(content);

    if (wordCount > 50 || hasMultipleQuestions) {
      return 'high';
    }
    if (hasTechnicalTerms || wordCount > 20) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Check if query has embedding
   */
  hasEmbedding(): boolean {
    return this.embedding !== undefined && this.embedding.dimensions.length > 0;
  }

  /**
   * Create query with embedding
   */
  withEmbedding(embedding: Vector): Query {
    return new Query(
      this.id,
      this.type,
      this.content,
      this.context,
      this.timestamp,
      this.complexity,
      embedding
    );
  }

  /**
   * Value equality
   */
  equals(other: Query): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `Query(${this.id}, type=${this.type}, complexity=${this.complexity})`;
  }

  toJSON(): object {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      complexity: this.complexity,
      hasEmbedding: this.hasEmbedding()
    };
  }
}
