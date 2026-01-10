/**
 * Feature Agent
 * Specialized agent for a single Ericsson RAN feature
 *
 * Each agent exclusively handles:
 * - All parameters for its feature
 * - All counters associated with its feature
 * - All KPIs influenced by its feature
 * - Feature-specific optimization recommendations
 * - Q-learning for its domain only
 *
 * @see ADR-004: One Agent Per Feature Specialization
 */

import type {
  AgentConfig,
  Query,
  Response,
  Feedback,
  Feature,
  State,
  Memory,
  ConfidenceScore,
  HealthScore,
  Timestamp,
} from '../../../core/types/interfaces.js';
import type { AgentId, FAJCode, QueryId } from '../../../core/types/ids.js';
import { AgentStatus, AgentType, Category, Action } from '../../../core/types/enums.js';
import { QTable } from '../../intelligence/q-learning/q-table.js';

export interface IFeatureAgentConfig extends AgentConfig {
  /** Feature data for this agent */
  feature?: Feature;
}

export interface IFeatureAgentDependencies {
  /** Embedding function for vector operations */
  embedder?: (text: string) => Promise<Float32Array>;
  /** Peer consultation function */
  consultPeer?: (peerId: AgentId, query: Query) => Promise<Response>;
}

/**
 * FeatureAgent implements a specialized agent for one RAN feature
 */
export class FeatureAgent {
  readonly id: AgentId;
  readonly fajCode: FAJCode;
  readonly type: AgentType;
  readonly category: Category;

  private status: AgentStatus;
  private health: HealthScore;
  private confidence: ConfidenceScore;
  private feature: Feature | null;
  private qTable: QTable;
  private memories: Memory[];
  private readonly maxMemories: number;
  private readonly dependencies: IFeatureAgentDependencies;

  private totalQueries: number;
  private successfulQueries: number;
  private totalLatencyMs: number;
  private createdAt: Timestamp;
  private lastActiveAt: Timestamp;

  constructor(config: IFeatureAgentConfig, dependencies: IFeatureAgentDependencies = {}) {
    this.id = config.id ?? this.generateAgentId(config.fajCode);
    this.fajCode = config.fajCode;
    this.type = config.type;
    this.category = config.category;

    this.status = AgentStatus.Initializing;
    this.health = 1.0;
    this.confidence = 0.5; // Start with moderate confidence
    this.feature = config.feature ?? null;

    this.qTable = new QTable(this.id, config.qLearningConfig);
    this.memories = [];
    this.maxMemories = config.maxMemoryVectors ?? 10000;
    this.dependencies = dependencies;

    this.totalQueries = 0;
    this.successfulQueries = 0;
    this.totalLatencyMs = 0;
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
  }

  private generateAgentId(fajCode: FAJCode): AgentId {
    // Simple ID generation - in production would use Ed25519 key derivation
    return `agent-${fajCode.toString().replace(/\s+/g, '-').toLowerCase()}` as AgentId;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.status = AgentStatus.Initializing;

    try {
      // Initialize vector memory index (HNSW)
      // In production: await this.initializeHNSWIndex();

      // Load any persisted Q-table state
      // In production: await this.loadQTableState();

      this.status = AgentStatus.Ready;
    } catch (error) {
      this.status = AgentStatus.Error;
      throw error;
    }
  }

  /**
   * Handle an incoming query
   */
  async handleQuery(query: Query): Promise<Response> {
    const startTime = Date.now();
    this.status = AgentStatus.Busy;
    this.lastActiveAt = startTime;
    this.totalQueries++;

    try {
      // 1. Build state representation
      const state = this.buildState(query);

      // 2. Select action using Q-learning policy
      const { action: selectedAction } = this.qTable.selectAction(state as any);

      // 3. Execute action (convert action type)
      const action = this.mapActionFromQL(selectedAction);
      const response = await this.executeAction(action, query, state);

      // 4. Record latency
      const latencyMs = Date.now() - startTime;
      this.totalLatencyMs += latencyMs;

      // 5. Update response with metadata
      const fullResponse: Response = {
        ...response,
        latencyMs,
      };

      this.status = AgentStatus.Ready;
      return fullResponse;
    } catch (error) {
      this.status = AgentStatus.Error;
      throw error;
    }
  }

  /**
   * Record feedback for a query
   */
  recordFeedback(queryId: QueryId, feedback: Feedback): void {
    // Calculate reward from feedback
    const reward = this.calculateReward(feedback);

    // Find the corresponding state-action pair (simplified)
    // In production: lookup from trajectory buffer

    // Update Q-table
    // this.qTable.update(state, action, reward, nextState);

    // Update success metrics
    if (feedback.helpful || feedback.resolved) {
      this.successfulQueries++;
    }

    // Update confidence based on feedback history
    this.updateConfidence(feedback);
  }

  private buildState(query: Query): State {
    return {
      queryType: query.type,
      complexity: query.complexity ?? 'moderate' as any,
      contextHash: this.hashContext(query),
      confidence: this.confidence,
    };
  }

  /**
   * Map Q-learning action type to core Action enum
   */
  private mapActionFromQL(qlAction: string): Action {
    const actionMap: Record<string, Action> = {
      'direct_answer': Action.DirectAnswer,
      'context_answer': Action.ContextAnswer,
      'consult_peer': Action.ConsultPeer,
      'request_clarification': Action.RequestClarification,
      'escalate': Action.Escalate,
    };
    return actionMap[qlAction] ?? Action.DirectAnswer;
  }

  private hashContext(query: Query): string {
    // Simple hash for demo - in production use proper hashing
    const contextStr = JSON.stringify(query.context);
    let hash = 0;
    for (let i = 0; i < contextStr.length; i++) {
      const char = contextStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async executeAction(action: Action, query: Query, state: State): Promise<Response> {
    switch (action) {
      case Action.DirectAnswer:
        return this.generateDirectAnswer(query);

      case Action.ContextAnswer:
        return this.generateContextAnswer(query);

      case Action.ConsultPeer:
        return this.consultPeerAgent(query);

      case Action.RequestClarification:
        return this.generateClarificationRequest(query);

      case Action.Escalate:
        return this.generateEscalation(query);

      default:
        return this.generateDirectAnswer(query);
    }
  }

  private generateDirectAnswer(query: Query): Response {
    const content = this.feature
      ? `Based on ${this.feature.name} (${this.fajCode}): [Direct answer would be generated here based on feature knowledge]`
      : `Response for ${this.fajCode}: [Feature data not loaded]`;

    return {
      queryId: query.id,
      agentId: this.id,
      featureFaj: this.fajCode,
      content,
      confidence: this.confidence,
      sources: [],
      cmeditCommands: [],
      relatedFeatures: (this.feature?.relatedFeatures ?? []) as unknown as FAJCode[],
      consultedAgents: [],
      latencyMs: 0,
    };
  }

  private async generateContextAnswer(query: Query): Promise<Response> {
    // Search vector memory for relevant context
    const context = await this.searchMemory(query.content, 5);

    const content = context.length > 0
      ? `Based on ${context.length} relevant memories and ${this.feature?.name ?? this.fajCode}: [Context-enhanced answer]`
      : this.generateDirectAnswer(query).content;

    return {
      queryId: query.id,
      agentId: this.id,
      featureFaj: this.fajCode,
      content,
      confidence: Math.min(this.confidence + 0.1, 1.0),
      sources: context.map(m => ({
        type: m.metadata.source as any,
        name: m.id,
      })),
      cmeditCommands: [],
      relatedFeatures: (this.feature?.relatedFeatures ?? []) as unknown as FAJCode[],
      consultedAgents: [],
      latencyMs: 0,
    };
  }

  private async consultPeerAgent(query: Query): Promise<Response> {
    if (this.dependencies.consultPeer) {
      // Find relevant peer (simplified - would use semantic routing)
      const peerId = 'peer-agent' as AgentId;
      try {
        const peerResponse = await this.dependencies.consultPeer(peerId, query);
        return {
          ...peerResponse,
          consultedAgents: [peerId],
        };
      } catch {
        return this.generateDirectAnswer(query);
      }
    }
    return this.generateDirectAnswer(query);
  }

  private generateClarificationRequest(query: Query): Response {
    return {
      queryId: query.id,
      agentId: this.id,
      featureFaj: this.fajCode,
      content: `I need more information to answer your question about ${this.fajCode}. Could you provide: [specific clarification needed]`,
      confidence: 0.3,
      sources: [],
      cmeditCommands: [],
      relatedFeatures: [],
      consultedAgents: [],
      latencyMs: 0,
    };
  }

  private generateEscalation(query: Query): Response {
    return {
      queryId: query.id,
      agentId: this.id,
      featureFaj: this.fajCode,
      content: `This query requires expert review. Escalating to human operator. Query context: ${query.content.substring(0, 100)}...`,
      confidence: 0.2,
      sources: [],
      cmeditCommands: [],
      relatedFeatures: [],
      consultedAgents: [],
      latencyMs: 0,
    };
  }

  private calculateReward(feedback: Feedback): number {
    let reward = feedback.rating; // -1 to +1

    if (feedback.resolved) {
      reward += 0.5;
    }

    if (!feedback.helpful) {
      reward -= 0.2;
    }

    return reward;
  }

  private updateConfidence(feedback: Feedback): void {
    const alpha = 0.1; // Confidence learning rate
    const feedbackScore = feedback.helpful ? 1.0 : 0.0;
    this.confidence = this.confidence + alpha * (feedbackScore - this.confidence);
    this.confidence = Math.max(0, Math.min(1, this.confidence));
  }

  /**
   * Store memory for future reference
   */
  async storeMemory(content: string, metadata: Memory['metadata']): Promise<void> {
    // Generate embedding if embedder available
    let embedding: Float32Array;
    if (this.dependencies.embedder) {
      embedding = await this.dependencies.embedder(content);
    } else {
      // Placeholder embedding
      embedding = new Float32Array(128);
    }

    const memory: Memory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      embedding,
      metadata,
    };

    this.memories.push(memory);

    // Prune if over limit
    if (this.memories.length > this.maxMemories) {
      this.memories.shift(); // Remove oldest
    }
  }

  /**
   * Search memory by similarity
   */
  async searchMemory(query: string, k: number): Promise<Memory[]> {
    if (this.memories.length === 0) return [];

    // In production: use HNSW index for <1ms search
    // This is a simplified linear search
    return this.memories.slice(-k);
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent health
   */
  getHealth(): HealthScore {
    return this.health;
  }

  /**
   * Get Q-table reference
   */
  getQTable(): QTable {
    return this.qTable;
  }

  /**
   * Get agent metrics
   */
  getMetrics(): {
    totalQueries: number;
    successfulQueries: number;
    successRate: number;
    averageLatencyMs: number;
    memoryCount: number;
    qTableSize: number;
    uptime: number;
  } {
    return {
      totalQueries: this.totalQueries,
      successfulQueries: this.successfulQueries,
      successRate: this.totalQueries > 0 ? this.successfulQueries / this.totalQueries : 0,
      averageLatencyMs: this.totalQueries > 0 ? this.totalLatencyMs / this.totalQueries : 0,
      memoryCount: this.memories.length,
      qTableSize: this.qTable.getStats().entryCount,
      uptime: Date.now() - this.createdAt,
    };
  }

  /**
   * Shutdown agent gracefully
   */
  async shutdown(): Promise<void> {
    this.status = AgentStatus.Offline;
    // Persist Q-table state
    // In production: await this.persistQTableState();
  }
}
