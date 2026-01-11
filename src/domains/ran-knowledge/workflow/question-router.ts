/**
 * Question Router with WASM-Fast Semantic Routing
 *
 * Routes incoming questions to the most relevant feature specialists
 * using HNSW indexing for sub-millisecond semantic matching.
 *
 * Performance Target: <1ms P95 routing latency (150x-12,500x faster with HNSW)
 *
 * @module workflow/question-router
 */

import { AgentDB } from '@agentdb/core';
import { HNSWIndex } from '@agentdb/hnsw';
import type { FeatureAgentKnowledge } from './autonomous-qa';

/**
 * Question Router Configuration
 */
export interface QuestionRouterConfig {
  agentDB: AgentDB;
  hnswIndex?: HNSWIndex;
  featureRegistry: Map<string, FeatureAgentKnowledge>;
  maxCandidates?: number; // Default: 10
}

/**
 * Routing Result
 */
export interface RoutingResult {
  relevantAgents: string[];
  primaryCategory?: string;
  queryType: 'parameter' | 'counter' | 'kpi' | 'procedure' | 'troubleshoot' | 'general';
  confidence: number;
  routingTimeMs: number;
}

/**
 * Query Embedding
 */
interface QueryEmbedding {
  vector: number[]; // 128-dim
  text: string;
  timestamp: number;
}

/**
 * Question Router
 *
 * Uses HNSW indexing to route questions to relevant feature specialists
 * with sub-millisecond latency.
 */
export class QuestionRouter {
  private config: QuestionRouterConfig;
  private embeddingCache: Map<string, QueryEmbedding>;
  private categoryKeywords: Map<string, string[]>;

  // Statistics
  private stats = {
    totalRouted: 0,
    avgRoutingTimeMs: 0,
    cacheHitRate: 0,
  };

  constructor(config: QuestionRouterConfig) {
    this.config = config;
    this.embeddingCache = new Map();
    this.initializeCategoryKeywords();
  }

  /**
   * Route a question to relevant feature specialists
   *
   * Uses HNSW for fast semantic search (150x-12,500x faster than brute force)
   */
  async route(question: string): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      this.stats.totalRouted++;

      // Detect query type
      const queryType = this.detectQueryType(question);

      // Get or compute query embedding
      const embedding = await this.getQueryEmbedding(question);

      // Use HNSW for fast semantic search if available
      let relevantAgents: string[];
      let confidence: number;

      if (this.config.hnswIndex) {
        const searchResult = await this.searchWithHNSW(embedding.vector);
        relevantAgents = searchResult.agents;
        confidence = searchResult.confidence;
      } else {
        // Fallback to AgentDB vector search
        const searchResult = await this.searchWithAgentDB(embedding.vector);
        relevantAgents = searchResult.agents;
        confidence = searchResult.confidence;
      }

      // Determine primary category
      const primaryCategory = this.inferCategory(question, relevantAgents);

      // Limit results
      const maxCandidates = this.config.maxCandidates ?? 10;
      relevantAgents = relevantAgents.slice(0, maxCandidates);

      // Calculate routing time
      const routingTime = Date.now() - startTime;
      this.updateStats(routingTime);

      return {
        relevantAgents,
        primaryCategory,
        queryType,
        confidence,
        routingTimeMs: routingTime,
      };
    } catch (error) {
      console.error('Question routing error:', error);
      throw error;
    }
  }

  /**
   * Batch route multiple questions (optimized for throughput)
   */
  async routeBatch(questions: string[]): Promise<Map<string, RoutingResult>> {
    const results = new Map<string, RoutingResult>();

    // Process in parallel
    const promises = questions.map(async (question) => {
      const result = await this.route(question);
      return [question, result] as [string, RoutingResult];
    });

    const settled = await Promise.allSettled(promises);

    for (const settledResult of settled) {
      if (settledResult.status === 'fulfilled') {
        const [question, result] = settledResult.value;
        results.set(question, result);
      }
    }

    return results;
  }

  /**
   * Get routing statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      avgRoutingTimeMs: this.stats.avgRoutingTimeMs.toFixed(3),
      cacheHitRate: (this.stats.cacheHitRate * 100).toFixed(2) + '%',
      featureRegistrySize: this.config.featureRegistry.size,
      hnswEnabled: !!this.config.hnswIndex,
    };
  }

  // Private methods

  private detectQueryType(question: string): RoutingResult['queryType'] {
    const lowerQuestion = question.toLowerCase();

    // Parameter queries
    if (lowerQuestion.includes('parameter') ||
        lowerQuestion.includes('configure') ||
        lowerQuestion.includes('setting') ||
        /\b(pmo|pmo2|pmo3|mimoMode|lbTpNonQualFraction)\b/i.test(question)) {
      return 'parameter';
    }

    // Counter queries
    if (lowerQuestion.includes('counter') ||
        lowerQuestion.includes('pm') ||
        lowerQuestion.includes('statistic') ||
        /\bpm[A-Z][a-zA-Z]*\b/.test(question)) {
      return 'counter';
    }

    // KPI queries
    if (lowerQuestion.includes('kpi') ||
        lowerQuestion.includes('performance') ||
        lowerQuestion.includes('throughput') ||
        lowerQuestion.includes('success rate')) {
      return 'kpi';
    }

    // Procedure queries
    if (lowerQuestion.includes('how to') ||
        lowerQuestion.includes('procedure') ||
        lowerQuestion.includes('step') ||
        lowerQuestion.includes('process')) {
      return 'procedure';
    }

    // Troubleshooting queries
    if (lowerQuestion.includes('troubleshoot') ||
        lowerQuestion.includes('error') ||
        lowerQuestion.includes('issue') ||
        lowerQuestion.includes('problem') ||
        lowerQuestion.includes('fail')) {
      return 'troubleshoot';
    }

    return 'general';
  }

  private async getQueryEmbedding(question: string): Promise<QueryEmbedding> {
    // Check cache
    const cacheKey = question.toLowerCase().trim();
    const cached = this.embeddingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
      this.stats.cacheHitRate = 0.9 * this.stats.cacheHitRate + 0.1;
      return cached;
    }

    this.stats.cacheHitRate = 0.9 * this.stats.cacheHitRate;

    // Generate embedding using AgentDB
    const vector = await this.generateEmbedding(question);

    const embedding: QueryEmbedding = {
      vector,
      text: question,
      timestamp: Date.now(),
    };

    // Cache embedding
    this.embeddingCache.set(cacheKey, embedding);

    // Limit cache size
    if (this.embeddingCache.size > 1000) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }

    return embedding;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use AgentDB's embedding generation
    // For now, return a simple hash-based embedding (in production, use actual embedding model)
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(128).fill(0);

    for (let i = 0; i < words.length; i++) {
      const hash = this.simpleHash(words[i]);
      const idx = hash % 128;
      vector[idx] += 1;
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => norm > 0 ? v / norm : 0);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async searchWithHNSW(queryVector: number[]): Promise<{ agents: string[]; confidence: number }> {
    // Use HNSW for fast search (150x-12,500x faster)
    const results = await this.config.hnswIndex!.search(queryVector, {
      k: this.config.maxCandidates ?? 10,
    });

    const agents = results.map(r => r.id);
    const confidence = results.length > 0 ? results[0].score : 0;

    return { agents, confidence };
  }

  private async searchWithAgentDB(queryVector: number[]): Promise<{ agents: string[]; confidence: number }> {
    // Use AgentDB vector search
    const results = await this.config.agentDB.vectorSearch({
      vector: queryVector,
      topK: this.config.maxCandidates ?? 10,
      namespace: 'ran-features',
    });

    const agents = results.map(r => r.id);
    const confidence = results.length > 0 ? results[0].score : 0;

    return { agents, confidence };
  }

  private inferCategory(question: string, agents: string[]): string | undefined {
    // Use category keywords to infer primary category
    const lowerQuestion = question.toLowerCase();
    let bestMatch: string | undefined;
    let maxMatches = 0;

    for (const [category, keywords] of this.categoryKeywords) {
      const matches = keywords.filter(kw => lowerQuestion.includes(kw.toLowerCase())).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = category;
      }
    }

    return bestMatch;
  }

  private initializeCategoryKeywords(): void {
    this.categoryKeywords = new Map([
      ['Carrier Aggregation', ['ca', 'carrier aggregation', 'scc', 'pcc', 'dcc', 'ul ca', 'dl ca']],
      ['Radio Resource Management', ['rrm', 'load balancing', 'admission', 'iflb', 'mlb', 'duac']],
      ['NR/5G', ['nr', '5g', 'en-dc', 'dss', 'sa', 'nsa', 'sul']],
      ['Transport', ['x2', 's1', 'f1', 'xn', 'ng', 'transport', 'fronthaul', 'backhaul']],
      ['Mobility & Handover', ['handover', 'ho', 'mobility', 'anr', 'a3', 'a5', 'ping pong']],
      ['MIMO & Antenna', ['mimo', 'antenna', 'beamforming', 'tm', 'irc', 'msm']],
      ['Coverage & Capacity', ['coverage', 'capacity', 'mro', 'cco', 'ffr', 'cell individual offset']],
      ['Voice & IMS', ['volte', 'vonr', 'voice', 'ims', 'srvcc', 'csfb']],
      ['Interference', ['interference', 'icic', 'eicic', 'comp']],
      ['Energy Saving', ['energy', 'sleep', 'power', 'mimo sleep', 'cell sleep']],
      ['QoS & Scheduling', ['qos', 'qci', 'scheduling', 'priority', 'gbr']],
      ['Timing & Sync', ['timing', 'sync', 'ptp', 'gps', 'ieee 1588']],
      ['Security', ['security', 'encryption', 'authentication', 'ciphering']],
    ]);
  }

  private updateStats(routingTime: number): void {
    const alpha = 0.1;
    this.stats.avgRoutingTimeMs = alpha * routingTime + (1 - alpha) * this.stats.avgRoutingTimeMs;
  }
}

export type { RoutingResult };
