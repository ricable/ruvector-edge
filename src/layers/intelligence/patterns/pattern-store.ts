/**
 * Pattern Store
 * Stores and retrieves similar case patterns using HNSW index
 */

import type {
  State,
  Action,
  PatternMatch,
  PatternConfig,
} from '../types';
import { HNSWIndex, type Vector } from './hnsw-index';

const DEFAULT_CONFIG: PatternConfig = {
  hnswM: 16,
  hnswEfConstruction: 200,
  hnswEfSearch: 50,
  maxPatterns: 10000,
};

/** Stored pattern structure */
export interface StoredPattern {
  id: string;
  state: State;
  action: Action;
  outcome: 'success' | 'failure';
  context: string;
  embedding: Vector;
  timestamp: number;
  usageCount: number;
}

/**
 * PatternStore manages pattern storage and retrieval
 * using HNSW for fast similarity search
 */
export class PatternStore {
  private readonly config: PatternConfig;
  private readonly index: HNSWIndex;
  private readonly patterns: Map<string, StoredPattern>;
  private readonly dimension: number;

  constructor(dimension: number = 128, config: Partial<PatternConfig> = {}) {
    this.dimension = dimension;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.index = new HNSWIndex(dimension, {
      M: this.config.hnswM,
      efConstruction: this.config.hnswEfConstruction,
      efSearch: this.config.hnswEfSearch,
    });
    this.patterns = new Map();
  }

  /**
   * Store a new pattern
   */
  store(
    state: State,
    action: Action,
    outcome: 'success' | 'failure',
    context: string,
    embedding: Vector
  ): string {
    // Generate pattern ID
    const id = this.generateId();

    const pattern: StoredPattern = {
      id,
      state,
      action,
      outcome,
      context,
      embedding: new Float32Array(embedding),
      timestamp: Date.now(),
      usageCount: 0,
    };

    // Check capacity
    if (this.patterns.size >= this.config.maxPatterns) {
      this.evictLeastUsed();
    }

    // Store in index and map
    this.index.insert(id, embedding, {
      state,
      action,
      outcome,
      context,
    });
    this.patterns.set(id, pattern);

    return id;
  }

  /**
   * Search for similar patterns
   */
  search(queryEmbedding: Vector, k: number = 5): PatternMatch[] {
    const results = this.index.search(queryEmbedding, k);

    return results.map(result => {
      const pattern = this.patterns.get(result.id);
      if (pattern) {
        // Increment usage count
        pattern.usageCount++;
      }

      return {
        id: result.id,
        similarity: 1 - result.distance, // Convert distance to similarity
        state: pattern?.state ?? {
          queryType: 'general',
          complexity: 'simple',
          contextHash: '',
          confidence: 0,
        },
        action: pattern?.action ?? 'direct_answer',
        outcome: pattern?.outcome ?? 'failure',
        context: pattern?.context ?? '',
      };
    });
  }

  /**
   * Search patterns with outcome filter
   */
  searchSuccessful(queryEmbedding: Vector, k: number = 5): PatternMatch[] {
    // Search for more candidates and filter
    const candidates = this.index.search(queryEmbedding, k * 3);

    const successful = candidates.filter(result => {
      const pattern = this.patterns.get(result.id);
      return pattern?.outcome === 'success';
    });

    return successful.slice(0, k).map(result => {
      const pattern = this.patterns.get(result.id)!;
      pattern.usageCount++;

      return {
        id: result.id,
        similarity: 1 - result.distance,
        state: pattern.state,
        action: pattern.action,
        outcome: pattern.outcome,
        context: pattern.context,
      };
    });
  }

  /**
   * Get pattern by ID
   */
  get(id: string): StoredPattern | null {
    return this.patterns.get(id) ?? null;
  }

  /**
   * Update pattern outcome
   */
  updateOutcome(id: string, outcome: 'success' | 'failure'): boolean {
    const pattern = this.patterns.get(id);
    if (!pattern) {
      return false;
    }
    pattern.outcome = outcome;
    return true;
  }

  /**
   * Delete pattern
   */
  delete(id: string): boolean {
    const deleted = this.index.delete(id);
    this.patterns.delete(id);
    return deleted;
  }

  /**
   * Evict least used pattern
   */
  private evictLeastUsed(): void {
    let minUsage = Infinity;
    let minId: string | null = null;

    for (const [id, pattern] of this.patterns) {
      if (pattern.usageCount < minUsage) {
        minUsage = pattern.usageCount;
        minId = id;
      }
    }

    if (minId) {
      this.delete(minId);
    }
  }

  /**
   * Generate unique pattern ID
   */
  private generateId(): string {
    return `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get store statistics
   */
  getStats(): {
    patternCount: number;
    maxPatterns: number;
    indexStats: ReturnType<HNSWIndex['getStats']>;
    avgUsageCount: number;
    successRate: number;
  } {
    let totalUsage = 0;
    let successCount = 0;

    for (const pattern of this.patterns.values()) {
      totalUsage += pattern.usageCount;
      if (pattern.outcome === 'success') {
        successCount++;
      }
    }

    return {
      patternCount: this.patterns.size,
      maxPatterns: this.config.maxPatterns,
      indexStats: this.index.getStats(),
      avgUsageCount: this.patterns.size > 0 ? totalUsage / this.patterns.size : 0,
      successRate: this.patterns.size > 0 ? successCount / this.patterns.size : 0,
    };
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.index.clear();
    this.patterns.clear();
  }

  /**
   * Get dimension
   */
  getDimension(): number {
    return this.dimension;
  }

  /**
   * Export patterns for persistence
   */
  export(): StoredPattern[] {
    return Array.from(this.patterns.values()).map(p => ({
      ...p,
      embedding: new Float32Array(p.embedding),
    }));
  }

  /**
   * Import patterns
   */
  import(patterns: StoredPattern[]): void {
    for (const pattern of patterns) {
      this.index.insert(pattern.id, pattern.embedding, {
        state: pattern.state,
        action: pattern.action,
        outcome: pattern.outcome,
        context: pattern.context,
      });
      this.patterns.set(pattern.id, {
        ...pattern,
        embedding: new Float32Array(pattern.embedding),
      });
    }
  }
}
