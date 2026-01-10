/**
 * Router Entity
 *
 * Semantic routing using HNSW vector search for finding the best agent
 * to handle a query. Target: <1ms routing latency.
 */

import { Query, Vector } from '../value-objects/query';

export interface AgentEmbedding {
  readonly agentId: string;
  readonly fajCode: string;
  readonly category: string;
  readonly embedding: Vector;
  readonly keywords: string[];
}

export interface RoutingResult {
  readonly agentId: string;
  readonly score: number;        // Similarity score (0-1)
  readonly confidence: number;   // Routing confidence (0-1)
  readonly latencyMs: number;
}

export interface HNSWConfig {
  readonly dimensions: number;
  readonly maxElements: number;
  readonly efConstruction: number;
  readonly m: number;           // Number of connections per layer
}

/**
 * Router Entity - Semantic query routing
 */
export class Router {
  readonly id: string;
  private _agentEmbeddings: Map<string, AgentEmbedding>;
  private _config: HNSWConfig;
  private _queryCount: number;
  private _avgLatency: number;

  constructor(
    id: string,
    config: HNSWConfig = {
      dimensions: 128,
      maxElements: 1000,
      efConstruction: 200,
      m: 16
    }
  ) {
    this.id = id;
    this._agentEmbeddings = new Map();
    this._config = config;
    this._queryCount = 0;
    this._avgLatency = 0;
  }

  /**
   * Register an agent with its embedding
   */
  registerAgent(agent: AgentEmbedding): void {
    this._agentEmbeddings.set(agent.agentId, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this._agentEmbeddings.delete(agentId);
  }

  /**
   * Route a query to the best agent(s)
   */
  route(query: Query, topK: number = 3): RoutingResult[] {
    const startTime = performance.now();

    let results: RoutingResult[];

    if (query.hasEmbedding()) {
      // Use vector similarity search (HNSW simulation)
      results = this.vectorSearch(query.embedding!, topK);
    } else {
      // Fall back to keyword matching
      results = this.keywordSearch(query.content, topK);
    }

    const latencyMs = performance.now() - startTime;
    this.updateMetrics(latencyMs);

    return results.map(r => ({ ...r, latencyMs }));
  }

  /**
   * Vector similarity search (simulated HNSW)
   */
  private vectorSearch(queryEmbedding: Vector, topK: number): RoutingResult[] {
    const scores: Array<{ agentId: string; score: number }> = [];

    for (const [agentId, agent] of this._agentEmbeddings) {
      const score = this.cosineSimilarity(queryEmbedding, agent.embedding);
      scores.push({ agentId, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({
        agentId: s.agentId,
        score: s.score,
        confidence: this.scoreToConfidence(s.score),
        latencyMs: 0
      }));
  }

  /**
   * Keyword-based search fallback
   */
  private keywordSearch(content: string, topK: number): RoutingResult[] {
    const queryWords = content.toLowerCase().split(/\s+/);
    const scores: Array<{ agentId: string; score: number }> = [];

    for (const [agentId, agent] of this._agentEmbeddings) {
      let matchCount = 0;
      for (const word of queryWords) {
        if (agent.keywords.some(k => k.toLowerCase().includes(word))) {
          matchCount++;
        }
        if (agent.fajCode.toLowerCase().includes(word)) {
          matchCount += 2;
        }
        if (agent.category.toLowerCase().includes(word)) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        scores.push({ agentId, score: matchCount / queryWords.length });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({
        agentId: s.agentId,
        score: s.score,
        confidence: this.scoreToConfidence(s.score),
        latencyMs: 0
      }));
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: Vector, b: Vector): number {
    const dims = Math.min(a.dimensions.length, b.dimensions.length);
    if (dims === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < dims; i++) {
      dotProduct += a.dimensions[i] * b.dimensions[i];
      normA += a.dimensions[i] * a.dimensions[i];
      normB += b.dimensions[i] * b.dimensions[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Convert similarity score to confidence
   */
  private scoreToConfidence(score: number): number {
    // Sigmoid-like transformation
    return 1 / (1 + Math.exp(-10 * (score - 0.5)));
  }

  /**
   * Update routing metrics
   */
  private updateMetrics(latencyMs: number): void {
    this._queryCount++;
    this._avgLatency = (this._avgLatency * (this._queryCount - 1) + latencyMs) / this._queryCount;
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    agentCount: number;
    queryCount: number;
    avgLatencyMs: number;
  } {
    return {
      agentCount: this._agentEmbeddings.size,
      queryCount: this._queryCount,
      avgLatencyMs: this._avgLatency
    };
  }

  // Getters
  get agentCount(): number { return this._agentEmbeddings.size; }
  get config(): HNSWConfig { return this._config; }

  equals(other: Router): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const stats = this.getStats();
    return `Router(${this.id}, agents=${stats.agentCount}, avgLatency=${stats.avgLatencyMs.toFixed(2)}ms)`;
  }
}
