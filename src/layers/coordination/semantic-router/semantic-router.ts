/**
 * Semantic Router
 * HNSW-based semantic routing for sub-millisecond agent selection
 *
 * Performance Target: <1ms routing latency (P95)
 *
 * HNSW Configuration:
 * - M (connections per layer): 16
 * - efConstruction: 200
 * - efSearch: 50
 * - Distance metric: Cosine similarity
 *
 * @see ADR-005: HNSW Vector Indexing
 */

import type { Timestamp, Vector } from '../../../core/types/interfaces.js';
import type { AgentId, FAJCode } from '../../../core/types/ids.js';
import { Category } from '../../../core/types/enums.js';

export interface ISemanticRouterConfig {
  /** Embedding dimensions (default: 128) */
  dimensions?: number;
  /** HNSW M parameter (default: 16) */
  hnswM?: number;
  /** HNSW efConstruction (default: 200) */
  hnswEfConstruction?: number;
  /** HNSW efSearch (default: 50) */
  hnswEfSearch?: number;
  /** Maximum agents in index */
  maxAgents?: number;
}

export interface IRoutedAgent {
  agentId: AgentId;
  fajCode: FAJCode;
  category: Category;
  similarity: number;
}

export interface IRoutingResult {
  agents: IRoutedAgent[];
  queryEmbedding: Vector;
  latencyMs: number;
}

interface AgentEntry {
  agentId: AgentId;
  fajCode: FAJCode;
  category: Category;
  embedding: Vector;
}

/**
 * SemanticRouter provides sub-millisecond agent routing
 */
export class SemanticRouter {
  private readonly config: Required<ISemanticRouterConfig>;
  private readonly agents: Map<string, AgentEntry>;
  private totalRoutes: number;
  private totalLatencyMs: number;
  private lastRebuild: Timestamp;

  // In production: private hnswIndex: HNSWLib.HierarchicalNSW;

  constructor(config?: ISemanticRouterConfig) {
    this.config = {
      dimensions: config?.dimensions ?? 128,
      hnswM: config?.hnswM ?? 16,
      hnswEfConstruction: config?.hnswEfConstruction ?? 200,
      hnswEfSearch: config?.hnswEfSearch ?? 50,
      maxAgents: config?.maxAgents ?? 1000,
    };
    this.agents = new Map();
    this.totalRoutes = 0;
    this.totalLatencyMs = 0;
    this.lastRebuild = Date.now();
  }

  /**
   * Add agent to routing index
   */
  async addAgent(
    agentId: AgentId,
    fajCode: FAJCode,
    category: Category,
    embedding: Vector
  ): Promise<void> {
    if (embedding.length !== this.config.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`
      );
    }

    const entry: AgentEntry = {
      agentId,
      fajCode,
      category,
      embedding,
    };

    this.agents.set(agentId, entry);

    // In production: this.hnswIndex.addPoint(embedding, agentId);
  }

  /**
   * Remove agent from routing index
   */
  async removeAgent(agentId: AgentId): Promise<void> {
    this.agents.delete(agentId);
    // In production: this.hnswIndex.markDelete(agentId);
  }

  /**
   * Route query to top-K agents
   * Target: <1ms latency
   */
  async route(queryEmbedding: Vector, k: number = 5): Promise<IRoutingResult> {
    const startTime = performance.now();

    if (queryEmbedding.length !== this.config.dimensions) {
      throw new Error(
        `Query embedding dimension mismatch: expected ${this.config.dimensions}, got ${queryEmbedding.length}`
      );
    }

    // In production: Use HNSW search
    // const results = this.hnswIndex.searchKnn(queryEmbedding, k, this.config.hnswEfSearch);

    // Fallback: Linear search (for demo/testing)
    const similarities = this.calculateSimilarities(queryEmbedding);
    const topK = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    const latencyMs = performance.now() - startTime;
    this.totalRoutes++;
    this.totalLatencyMs += latencyMs;

    return {
      agents: topK,
      queryEmbedding,
      latencyMs,
    };
  }

  /**
   * Route query to specific category
   */
  async routeToCategory(
    queryEmbedding: Vector,
    category: Category,
    k: number = 5
  ): Promise<IRoutingResult> {
    const startTime = performance.now();

    const categoryAgents = Array.from(this.agents.values())
      .filter(a => a.category === category);

    if (categoryAgents.length === 0) {
      return {
        agents: [],
        queryEmbedding,
        latencyMs: performance.now() - startTime,
      };
    }

    const similarities = categoryAgents.map(agent => ({
      agentId: agent.agentId,
      fajCode: agent.fajCode,
      category: agent.category,
      similarity: this.cosineSimilarity(queryEmbedding, agent.embedding),
    }));

    const topK = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    const latencyMs = performance.now() - startTime;
    this.totalRoutes++;
    this.totalLatencyMs += latencyMs;

    return {
      agents: topK,
      queryEmbedding,
      latencyMs,
    };
  }

  private calculateSimilarities(queryEmbedding: Vector): IRoutedAgent[] {
    const results: IRoutedAgent[] = [];

    for (const agent of this.agents.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, agent.embedding);
      results.push({
        agentId: agent.agentId,
        fajCode: agent.fajCode,
        category: agent.category,
        similarity,
      });
    }

    return results;
  }

  private cosineSimilarity(a: Vector, b: Vector): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Rebuild HNSW index
   */
  async rebuild(): Promise<void> {
    // In production: Rebuild HNSW index from scratch
    this.lastRebuild = Date.now();
  }

  /**
   * Get router statistics
   */
  getStats(): {
    totalAgents: number;
    indexSize: number;
    totalRoutes: number;
    averageLatencyMs: number;
    lastRebuild: Timestamp;
    dimensions: number;
  } {
    return {
      totalAgents: this.agents.size,
      indexSize: this.agents.size * this.config.dimensions * 4, // Float32 = 4 bytes
      totalRoutes: this.totalRoutes,
      averageLatencyMs: this.totalRoutes > 0 ? this.totalLatencyMs / this.totalRoutes : 0,
      lastRebuild: this.lastRebuild,
      dimensions: this.config.dimensions,
    };
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: AgentId): AgentEntry | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agent IDs
   */
  getAllAgentIds(): AgentId[] {
    return Array.from(this.agents.keys()) as AgentId[];
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: Category): AgentId[] {
    return Array.from(this.agents.values())
      .filter(a => a.category === category)
      .map(a => a.agentId);
  }

  /**
   * Clear router
   */
  clear(): void {
    this.agents.clear();
    this.totalRoutes = 0;
    this.totalLatencyMs = 0;
  }
}
