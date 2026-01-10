/**
 * State Encoder
 * Encodes query context into discrete states for Q-Learning
 */

import type {
  State,
  StateKey,
  StateActionKey,
  QueryType,
  ComplexityLevel,
  Action,
} from '../types';

/** Configuration for state encoding */
export interface StateEncoderConfig {
  confidenceBuckets: number[];  // Discretization buckets for confidence
  contextHashLength: number;    // Length of context hash
}

const DEFAULT_CONFIG: StateEncoderConfig = {
  confidenceBuckets: [0.0, 0.25, 0.5, 0.75, 1.0],
  contextHashLength: 8,
};

/**
 * StateEncoder handles encoding of query context into discrete states
 * suitable for Q-Table lookup
 */
export class StateEncoder {
  private readonly config: StateEncoderConfig;

  constructor(config: Partial<StateEncoderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a state from query context
   */
  createState(
    queryType: QueryType,
    complexity: ComplexityLevel,
    context: string,
    rawConfidence: number
  ): State {
    return {
      queryType,
      complexity,
      contextHash: this.hashContext(context),
      confidence: this.discretizeConfidence(rawConfidence),
    };
  }

  /**
   * Encode state to a unique string key for Q-Table lookup
   */
  encodeState(state: State): StateKey {
    return `${state.queryType}|${state.complexity}|${state.contextHash}|${state.confidence}`;
  }

  /**
   * Decode state key back to state object
   */
  decodeState(stateKey: StateKey): State {
    const [queryType, complexity, contextHash, confidence] = stateKey.split('|');
    return {
      queryType: queryType as QueryType,
      complexity: complexity as ComplexityLevel,
      contextHash,
      confidence: parseFloat(confidence),
    };
  }

  /**
   * Create state-action key for Q-Table
   */
  encodeStateAction(state: State, action: Action): StateActionKey {
    return `${this.encodeState(state)}::${action}`;
  }

  /**
   * Decode state-action key
   */
  decodeStateAction(stateActionKey: StateActionKey): { state: State; action: Action } {
    const [stateKey, action] = stateActionKey.split('::');
    return {
      state: this.decodeState(stateKey),
      action: action as Action,
    };
  }

  /**
   * Discretize confidence value to nearest bucket
   */
  discretizeConfidence(confidence: number): number {
    const clamped = Math.max(0, Math.min(1, confidence));
    let closest = this.config.confidenceBuckets[0];
    let minDiff = Math.abs(clamped - closest);

    for (const bucket of this.config.confidenceBuckets) {
      const diff = Math.abs(clamped - bucket);
      if (diff < minDiff) {
        minDiff = diff;
        closest = bucket;
      }
    }

    return closest;
  }

  /**
   * Hash context string to fixed-length hash
   * Uses djb2 algorithm for fast, deterministic hashing
   */
  hashContext(context: string): string {
    let hash = 5381;
    for (let i = 0; i < context.length; i++) {
      hash = ((hash << 5) + hash) ^ context.charCodeAt(i);
      hash = hash >>> 0; // Convert to unsigned 32-bit
    }
    return hash.toString(16).padStart(this.config.contextHashLength, '0')
      .slice(0, this.config.contextHashLength);
  }

  /**
   * Classify query type from query text
   */
  classifyQueryType(query: string): QueryType {
    const lowerQuery = query.toLowerCase();

    // Parameter-related keywords
    if (this.matchesKeywords(lowerQuery, ['parameter', 'param', 'setting', 'configure', 'value'])) {
      return 'parameter';
    }

    // Counter-related keywords
    if (this.matchesKeywords(lowerQuery, ['counter', 'metric', 'measurement', 'count'])) {
      return 'counter';
    }

    // KPI-related keywords
    if (this.matchesKeywords(lowerQuery, ['kpi', 'performance', 'indicator', 'throughput', 'latency'])) {
      return 'kpi';
    }

    // Procedure-related keywords
    if (this.matchesKeywords(lowerQuery, ['procedure', 'how to', 'steps', 'process', 'workflow'])) {
      return 'procedure';
    }

    // Troubleshooting-related keywords
    if (this.matchesKeywords(lowerQuery, ['troubleshoot', 'problem', 'issue', 'error', 'fix', 'debug', 'alarm'])) {
      return 'troubleshoot';
    }

    return 'general';
  }

  /**
   * Estimate query complexity
   */
  estimateComplexity(query: string, entityCount: number = 0): ComplexityLevel {
    const wordCount = query.split(/\s+/).length;
    const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1;
    const hasConditionals = /\b(if|when|unless|while|whether)\b/i.test(query);

    // Complex indicators
    if (wordCount > 30 || entityCount > 3 || hasMultipleQuestions) {
      return 'complex';
    }

    // Moderate indicators
    if (wordCount > 15 || entityCount > 1 || hasConditionals) {
      return 'moderate';
    }

    return 'simple';
  }

  /**
   * Compute state similarity for deduplication
   */
  computeStateSimilarity(state1: State, state2: State): number {
    let similarity = 0;
    let weights = 0;

    // Query type match (weight: 0.3)
    if (state1.queryType === state2.queryType) {
      similarity += 0.3;
    }
    weights += 0.3;

    // Complexity match (weight: 0.2)
    if (state1.complexity === state2.complexity) {
      similarity += 0.2;
    }
    weights += 0.2;

    // Context hash match (weight: 0.3)
    if (state1.contextHash === state2.contextHash) {
      similarity += 0.3;
    }
    weights += 0.3;

    // Confidence proximity (weight: 0.2)
    const confidenceDiff = Math.abs(state1.confidence - state2.confidence);
    similarity += 0.2 * (1 - confidenceDiff);
    weights += 0.2;

    return similarity / weights;
  }

  /**
   * Get all possible actions
   */
  getAllActions(): Action[] {
    return ['direct_answer', 'context_answer', 'consult_peer', 'request_clarification', 'escalate'];
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
  }
}

// Export singleton instance with default config
export const stateEncoder = new StateEncoder();
