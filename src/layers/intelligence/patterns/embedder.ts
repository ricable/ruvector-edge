/**
 * Text Embedder
 * Generates embeddings for text queries and patterns
 * Provides a simple bag-of-words + character n-gram embedding for edge deployment
 */

import type { Vector } from './hnsw-index';

/** Embedder configuration */
export interface EmbedderConfig {
  dimension: number;
  hashSeed: number;
  ngramRange: [number, number];
  normalize: boolean;
}

const DEFAULT_CONFIG: EmbedderConfig = {
  dimension: 128,
  hashSeed: 0x811c9dc5, // FNV-1a seed
  ngramRange: [2, 4],
  normalize: true,
};

/**
 * SimpleEmbedder generates deterministic embeddings using hashing
 * Suitable for edge deployment without neural network inference
 */
export class SimpleEmbedder {
  private readonly config: EmbedderConfig;

  constructor(config: Partial<EmbedderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Embed a text string
   */
  embed(text: string): Vector {
    const vector = new Float32Array(this.config.dimension);

    // Preprocess text
    const processed = this.preprocess(text);

    // Extract tokens
    const tokens = this.tokenize(processed);

    // Extract n-grams
    const ngrams = this.extractNgrams(processed);

    // Hash tokens into vector
    for (const token of tokens) {
      const hash = this.hash(token);
      const index = Math.abs(hash) % this.config.dimension;
      const sign = hash > 0 ? 1 : -1;
      vector[index] += sign;
    }

    // Hash n-grams into vector (with different weight)
    for (const ngram of ngrams) {
      const hash = this.hash(ngram);
      const index = Math.abs(hash) % this.config.dimension;
      const sign = hash > 0 ? 1 : -1;
      vector[index] += sign * 0.5;
    }

    // Normalize if configured
    if (this.config.normalize) {
      this.normalizeVector(vector);
    }

    return vector;
  }

  /**
   * Embed multiple texts
   */
  embedBatch(texts: string[]): Vector[] {
    return texts.map(text => this.embed(text));
  }

  /**
   * Compute similarity between two texts
   */
  similarity(text1: string, text2: string): number {
    const v1 = this.embed(text1);
    const v2 = this.embed(text2);
    return this.cosineSimilarity(v1, v2);
  }

  /**
   * Preprocess text for embedding
   */
  private preprocess(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(t => t.length > 0);
  }

  /**
   * Extract character n-grams
   */
  private extractNgrams(text: string): string[] {
    const ngrams: string[] = [];
    const [minN, maxN] = this.config.ngramRange;

    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= text.length - n; i++) {
        ngrams.push(text.substring(i, i + n));
      }
    }

    return ngrams;
  }

  /**
   * Hash function (FNV-1a variant)
   */
  private hash(text: string): number {
    let hash = this.config.hashSeed;

    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }

    return hash;
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: Float32Array): void {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
  }

  /**
   * Compute cosine similarity
   */
  private cosineSimilarity(v1: Vector, v2: Vector): number {
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Get embedding dimension
   */
  getDimension(): number {
    return this.config.dimension;
  }
}

// Export singleton
export const simpleEmbedder = new SimpleEmbedder();

/**
 * Create embedding from state representation
 */
export function embedState(
  queryType: string,
  complexity: string,
  contextHash: string,
  confidence: number,
  embedder: SimpleEmbedder = simpleEmbedder
): Vector {
  const stateText = `${queryType} ${complexity} ${contextHash} confidence:${confidence.toFixed(2)}`;
  return embedder.embed(stateText);
}

/**
 * Create embedding from context string
 */
export function embedContext(
  context: string,
  embedder: SimpleEmbedder = simpleEmbedder
): Vector {
  return embedder.embed(context);
}
