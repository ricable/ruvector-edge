/**
 * AgentDB HNSW Index - Stub Implementation
 *
 * This is a stub for the @agentdb/hnsw package.
 * In production, this would be the actual HNSW index implementation.
 */

export interface HNSWIndexConfig {
  M?: number; // Max connections per node (default: 16)
  efConstruction?: number; // Build-time accuracy (default: 200)
  dimensions?: number; // Vector dimensions (default: 128)
}

export interface HNSWSearchOptions {
  k: number;
  ef?: number; // Search-time accuracy (default: k)
}

export interface HNSWSearchResult {
  id: string;
  score: number;
  distance?: number;
}

export class HNSWIndex {
  private static instances: Map<string, HNSWIndex> = new Map();
  private vectors: Map<string, number[]> = new Map();

  static async create(config: HNSWIndexConfig = {}): Promise<HNSWIndex> {
    const key = JSON.stringify(config);
    if (!HNSWIndex.instances.has(key)) {
      HNSWIndex.instances.set(key, new HNSWIndex(config));
    }
    return HNSWIndex.instances.get(key)!;
  }

  private constructor(public readonly config: HNSWIndexConfig) {}

  async addVector(id: string, vector: number[]): Promise<void> {
    this.vectors.set(id, vector);
  }

  async search(queryVector: number[], options: HNSWSearchOptions): Promise<HNSWSearchResult[]> {
    const results: HNSWSearchResult[] = [];

    // Simple cosine similarity search
    for (const [id, vector] of this.vectors.entries()) {
      if (vector.length !== queryVector.length) continue;

      const similarity = this.cosineSimilarity(queryVector, vector);
      results.push({ id, score: similarity });

      if (results.length >= options.k) break;
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, options.k);
  }

  async remove(id: string): Promise<boolean> {
    return this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }

  get size(): number {
    return this.vectors.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }
}

export const createHNSWIndex = HNSWIndex.create;
