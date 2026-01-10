/**
 * State Value Object
 *
 * Q-learning state representation encoding the current context for decision-making.
 */

export type QueryType = 'parameter' | 'counter' | 'kpi' | 'procedure' | 'troubleshoot' | 'general';
export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface StateVector {
  readonly dimensions: number[];
}

export class State {
  constructor(
    public readonly queryType: QueryType,
    public readonly complexity: ComplexityLevel,
    public readonly contextHash: string,
    public readonly confidence: number // 0.0 - 1.0
  ) {
    Object.freeze(this);
  }

  /**
   * Encode state for Q-table lookup
   */
  encode(): StateVector {
    const queryTypeIndex = ['parameter', 'counter', 'kpi', 'procedure', 'troubleshoot', 'general'].indexOf(this.queryType);
    const complexityIndex = ['low', 'medium', 'high'].indexOf(this.complexity);
    const contextValue = this.hashToNumber(this.contextHash);
    const confidenceBucket = Math.floor(this.confidence * 10);

    return {
      dimensions: [queryTypeIndex, complexityIndex, contextValue % 100, confidenceBucket]
    };
  }

  /**
   * Generate unique key for state
   */
  toKey(): string {
    return `${this.queryType}:${this.complexity}:${this.contextHash}:${Math.floor(this.confidence * 10)}`;
  }

  /**
   * Value equality
   */
  equals(other: State): boolean {
    return this.toKey() === other.toKey();
  }

  /**
   * Similarity measure (0-1)
   */
  similarity(other: State): number {
    let score = 0;
    if (this.queryType === other.queryType) score += 0.4;
    if (this.complexity === other.complexity) score += 0.2;
    if (this.contextHash === other.contextHash) score += 0.3;
    score += 0.1 * (1 - Math.abs(this.confidence - other.confidence));
    return score;
  }

  private hashToNumber(hash: string): number {
    let num = 0;
    for (let i = 0; i < hash.length; i++) {
      num = ((num << 5) - num) + hash.charCodeAt(i);
      num = num & num;
    }
    return Math.abs(num);
  }

  toString(): string {
    return `State(${this.queryType}, ${this.complexity}, conf=${this.confidence.toFixed(2)})`;
  }

  toJSON(): object {
    return {
      queryType: this.queryType,
      complexity: this.complexity,
      contextHash: this.contextHash,
      confidence: this.confidence
    };
  }
}
