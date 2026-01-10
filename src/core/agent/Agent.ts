/**
 * ELEX Edge AI Agent Swarm - Agent Implementation
 *
 * Core Agent class implementing the specialized feature agent with:
 * - Lifecycle management (initialize, handleQuery, recordFeedback)
 * - Q-learning for self-improvement
 * - Vector memory for semantic search
 * - Peer consultation for knowledge sharing
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentId,
  QueryId,
  FAJCode,
  AgentConfig,
  Query,
  Response,
  Feedback,
  Feature,
  ConfidenceScore,
  HealthScore,
  AgentMetrics,
  Memory,
  MemoryMetadata,
  State,
  Reward,
  ParameterDefinition,
  Procedure,
} from '../types/index.js';
import {
  AgentStatus,
  AgentType,
  Category,
  Action,
  QueryType,
  ComplexityLevel,
  createAgentId,
} from '../types/index.js';
import type { VectorMemory } from '../memory/VectorMemory.js';
import type { QTable } from '../learning/QTable.js';
import type { TrajectoryBuffer } from '../learning/TrajectoryBuffer.js';

/**
 * Peer agent reference for consultation
 */
export interface PeerAgent {
  id: AgentId;
  fajCode: FAJCode;
  handleQuery(query: Query): Promise<Response>;
}

/**
 * Agent dependencies for injection
 */
export interface AgentDependencies {
  vectorMemory: VectorMemory;
  qTable: QTable;
  trajectoryBuffer: TrajectoryBuffer;
  peerResolver?: (peerId: AgentId) => Promise<PeerAgent | null>;
}

/**
 * Specialized Feature Agent
 *
 * Each agent masters exactly one Ericsson RAN feature identified by its FAJ code.
 * Agents use Q-learning for continuous self-improvement and can consult peers.
 */
export class Agent {
  // Identity
  public readonly id: AgentId;
  public readonly fajCode: FAJCode;
  public readonly type: AgentType;
  public readonly category: Category;

  // State
  private _status: AgentStatus = AgentStatus.Initializing;
  private _health: HealthScore = 1.0;
  private _confidence: ConfidenceScore = 0.5;

  // Knowledge
  private _feature: Feature | null = null;

  // Components
  private readonly vectorMemory: VectorMemory;
  private readonly qTable: QTable;
  private readonly trajectoryBuffer: TrajectoryBuffer;
  private peerResolver?: (peerId: AgentId) => Promise<PeerAgent | null>;

  // Metrics
  private metrics: AgentMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    averageLatencyMs: 0,
    averageConfidence: 0.5,
    consultationCount: 0,
    learningIterations: 0,
    memoryVectorCount: 0,
  };

  // Active queries for feedback tracking
  private activeQueries = new Map<QueryId, { query: Query; response: Response; state: State }>();

  constructor(config: AgentConfig, deps: AgentDependencies) {
    this.id = config.id ?? createAgentId(uuidv4());
    this.fajCode = config.fajCode;
    this.type = config.type;
    this.category = config.category;

    this.vectorMemory = deps.vectorMemory;
    this.qTable = deps.qTable;
    this.trajectoryBuffer = deps.trajectoryBuffer;
    this.peerResolver = deps.peerResolver;
  }

  // =========================================================================
  // Accessors
  // =========================================================================

  get status(): AgentStatus {
    return this._status;
  }

  get health(): HealthScore {
    return this._health;
  }

  get confidence(): ConfidenceScore {
    return this._confidence;
  }

  get feature(): Feature | null {
    return this._feature;
  }

  get agentMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Initialize the agent with feature knowledge
   */
  async initialize(feature: Feature): Promise<void> {
    this._status = AgentStatus.Initializing;

    try {
      // Validate feature matches this agent's FAJ code
      if (!feature.fajCode.equals(this.fajCode)) {
        throw new Error(
          `Feature FAJ code mismatch: expected ${this.fajCode}, got ${feature.fajCode}`
        );
      }

      this._feature = feature;

      // Initialize vector memory with feature knowledge
      await this.initializeMemory();

      // Initialize Q-table
      await this.qTable.initialize();

      this._status = AgentStatus.Ready;
      this._health = 1.0;
    } catch (error) {
      this._status = AgentStatus.Error;
      this._health = 0.0;
      throw error;
    }
  }

  /**
   * Handle an incoming query and generate a response
   */
  async handleQuery(query: Query): Promise<Response> {
    const startTime = performance.now();

    if (this._status !== AgentStatus.Ready) {
      throw new Error(`Agent not ready: status is ${this._status}`);
    }

    this._status = AgentStatus.Busy;
    this.metrics.totalQueries++;

    try {
      // 1. Encode current state
      const state = this.encodeState(query);

      // 2. Select action using Q-table (epsilon-greedy)
      const action = await this.qTable.selectAction(state);

      // 3. Execute action
      const response = await this.executeAction(action, query, state);

      // 4. Calculate latency
      const latencyMs = performance.now() - startTime;
      response.latencyMs = latencyMs;

      // 5. Update metrics
      this.updateMetrics(latencyMs, response.confidence);

      // 6. Store for feedback tracking
      this.activeQueries.set(query.id, { query, response, state });

      // Clean up old active queries (keep last 100)
      if (this.activeQueries.size > 100) {
        const oldestKey = this.activeQueries.keys().next().value;
        if (oldestKey) {
          this.activeQueries.delete(oldestKey);
        }
      }

      this._status = AgentStatus.Ready;
      return response;
    } catch (error) {
      this._status = AgentStatus.Ready;
      throw error;
    }
  }

  /**
   * Record feedback for a completed query and update Q-table
   */
  recordFeedback(queryId: QueryId, feedback: Feedback): void {
    const queryRecord = this.activeQueries.get(queryId);
    if (!queryRecord) {
      console.warn(`No active query found for feedback: ${queryId}`);
      return;
    }

    const { query, response, state } = queryRecord;

    // Calculate reward from feedback
    const reward = this.calculateReward(feedback, response);

    // Determine next state (simplified - same state with updated confidence)
    const nextState: State = {
      ...state,
      confidence: feedback.resolved ? Math.min(state.confidence + 0.1, 1.0) : state.confidence,
    };

    // Get the action that was taken
    const action = this.inferActionFromResponse(response);

    // Update Q-table
    this.qTable.update(state, action, reward, nextState);

    // Record trajectory
    this.trajectoryBuffer.record({
      state,
      action,
      reward,
      nextState,
    });

    // Update metrics
    if (feedback.resolved || feedback.helpful) {
      this.metrics.successfulQueries++;
    }
    this.metrics.learningIterations++;

    // Update agent confidence
    this._confidence = this.qTable.getAverageConfidence();

    // Store successful interactions in memory
    if (feedback.resolved || feedback.rating > 0) {
      this.storeSuccessfulInteraction(query, response, feedback);
    }

    // Clean up
    this.activeQueries.delete(queryId);
  }

  /**
   * Consult a peer agent for expertise
   */
  async consultPeer(peerId: AgentId, query: Query): Promise<Response | null> {
    if (!this.peerResolver) {
      console.warn('No peer resolver configured');
      return null;
    }

    const peer = await this.peerResolver(peerId);
    if (!peer) {
      console.warn(`Peer not found: ${peerId}`);
      return null;
    }

    this.metrics.consultationCount++;
    return peer.handleQuery(query);
  }

  // =========================================================================
  // Memory Operations
  // =========================================================================

  /**
   * Store content in vector memory with metadata
   */
  async storeMemory(content: string, metadata: MemoryMetadata): Promise<void> {
    await this.vectorMemory.store(content, metadata);
    this.metrics.memoryVectorCount = await this.vectorMemory.count();
  }

  /**
   * Search memory using semantic similarity
   */
  async searchMemory(query: string, k: number = 5): Promise<Memory[]> {
    return this.vectorMemory.search(query, k);
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Initialize memory with feature knowledge
   */
  private async initializeMemory(): Promise<void> {
    if (!this._feature) return;

    // Store feature description
    if (this._feature.description) {
      await this.storeMemory(this._feature.description, {
        source: 'case',
        timestamp: Date.now(),
      });
    }

    // Store parameter knowledge
    for (const param of this._feature.parameters) {
      const content = `Parameter ${param.name}: ${param.description ?? 'No description'}. Type: ${param.dataType}`;
      await this.storeMemory(content, {
        source: 'case',
        queryType: QueryType.Parameter,
        timestamp: Date.now(),
      });
    }

    // Store procedure knowledge
    for (const proc of this._feature.procedures) {
      const steps = proc.steps.map(s => `${s.order}. ${s.description}`).join('\n');
      const content = `Procedure ${proc.name}: ${proc.description ?? ''}\nSteps:\n${steps}`;
      await this.storeMemory(content, {
        source: 'case',
        queryType: QueryType.Procedure,
        timestamp: Date.now(),
      });
    }

    this.metrics.memoryVectorCount = await this.vectorMemory.count();
  }

  /**
   * Encode query into Q-learning state
   */
  private encodeState(query: Query): State {
    // Simple hash based on query content
    const contextHash = this.hashString(query.content + (query.context.sessionId ?? ''));

    return {
      queryType: query.type,
      complexity: query.complexity ?? ComplexityLevel.Moderate,
      contextHash,
      confidence: this._confidence,
    };
  }

  /**
   * Execute selected action
   */
  private async executeAction(action: Action, query: Query, _state: State): Promise<Response> {
    const queryId = query.id;
    const baseResponse: Omit<Response, 'latencyMs'> = {
      queryId,
      agentId: this.id,
      featureFaj: this.fajCode,
      content: '',
      confidence: 0,
      sources: [],
      cmeditCommands: [],
      relatedFeatures: [],
      consultedAgents: [],
    };

    switch (action) {
      case Action.DirectAnswer:
        return this.generateDirectAnswer(query, baseResponse);

      case Action.ContextAnswer:
        return this.generateContextAnswer(query, baseResponse);

      case Action.ConsultPeer:
        return this.handleConsultPeer(query, baseResponse);

      case Action.RequestClarification:
        return this.requestClarification(query, baseResponse);

      case Action.Escalate:
        return this.escalateQuery(query, baseResponse);

      default:
        return this.generateDirectAnswer(query, baseResponse);
    }
  }

  /**
   * Generate a direct answer from feature knowledge
   */
  private async generateDirectAnswer(
    query: Query,
    baseResponse: Omit<Response, 'latencyMs'>
  ): Promise<Response> {
    if (!this._feature) {
      return {
        ...baseResponse,
        content: 'Agent not initialized with feature knowledge.',
        confidence: 0,
        latencyMs: 0,
      };
    }

    // Search memory for relevant context
    const memories = await this.searchMemory(query.content, 3);

    // Build response content based on query type
    let content = '';
    let confidence: ConfidenceScore = 0.7;
    const sources: Response['sources'] = [];

    switch (query.type) {
      case QueryType.Parameter:
        const param = this.findRelevantParameter(query.content);
        if (param) {
          content = this.formatParameterResponse(param);
          sources.push({ type: 'parameter', name: param.name });
          confidence = 0.9;
        }
        break;

      case QueryType.Counter:
        const counter = this.findRelevantCounter(query.content);
        if (counter) {
          content = `Counter: ${counter.name}\nCategory: ${counter.category}\n${counter.description ?? ''}`;
          sources.push({ type: 'counter', name: counter.name });
          confidence = 0.85;
        }
        break;

      case QueryType.KPI:
        const kpi = this.findRelevantKPI(query.content);
        if (kpi) {
          content = `KPI: ${kpi.name}\n${kpi.description ?? ''}\nFormula: ${kpi.formula ?? 'N/A'}`;
          sources.push({ type: 'kpi', name: kpi.name });
          confidence = 0.85;
        }
        break;

      case QueryType.Procedure:
        const proc = this.findRelevantProcedure(query.content);
        if (proc) {
          content = this.formatProcedureResponse(proc);
          sources.push({ type: 'procedure', name: proc.name });
          confidence = 0.9;
        }
        break;

      default:
        // Use memory search results
        if (memories.length > 0) {
          content = memories.map(m => m.content).join('\n\n');
          confidence = Math.max(...memories.map(m => m.metadata.confidence ?? 0.6));
        }
    }

    // Fallback to feature description if no specific match
    if (!content) {
      content = `Feature: ${this._feature.name}\n${this._feature.description ?? 'No description available.'}`;
      confidence = 0.5;
    }

    return {
      ...baseResponse,
      content,
      confidence,
      sources,
      relatedFeatures: this._feature.relatedFeatures.map(_id => this._feature!.fajCode),
      latencyMs: 0,
    };
  }

  /**
   * Generate context-enriched answer using memory
   */
  private async generateContextAnswer(
    query: Query,
    baseResponse: Omit<Response, 'latencyMs'>
  ): Promise<Response> {
    const memories = await this.searchMemory(query.content, 5);
    const directResponse = await this.generateDirectAnswer(query, baseResponse);

    // Enrich with memory context
    if (memories.length > 0) {
      const context = memories
        .filter(m => m.metadata.outcome === 'success')
        .map(m => m.content)
        .join('\n\n---\n\n');

      if (context) {
        directResponse.content = `${directResponse.content}\n\n**Related Context:**\n${context}`;
        directResponse.confidence = Math.min(directResponse.confidence + 0.1, 1.0);
      }
    }

    return directResponse;
  }

  /**
   * Handle peer consultation
   */
  private async handleConsultPeer(
    query: Query,
    baseResponse: Omit<Response, 'latencyMs'>
  ): Promise<Response> {
    if (!this._feature || this._feature.relatedFeatures.length === 0) {
      return this.generateDirectAnswer(query, baseResponse);
    }

    // Try to consult related feature agents
    // In a real implementation, this would resolve peer IDs from FAJ codes
    const directResponse = await this.generateDirectAnswer(query, baseResponse);
    directResponse.content = `${directResponse.content}\n\n(Note: Peer consultation requested but no peers available)`;

    return directResponse;
  }

  /**
   * Request clarification from user
   */
  private async requestClarification(
    _query: Query,
    baseResponse: Omit<Response, 'latencyMs'>
  ): Promise<Response> {
    return {
      ...baseResponse,
      content: `I need more information to answer your question about ${this._feature?.name ?? 'this feature'}. Could you please provide:\n- Specific parameter or counter name?\n- Current configuration context?\n- What outcome are you trying to achieve?`,
      confidence: 0.3,
      latencyMs: 0,
    };
  }

  /**
   * Escalate query to human expert
   */
  private async escalateQuery(
    query: Query,
    baseResponse: Omit<Response, 'latencyMs'>
  ): Promise<Response> {
    return {
      ...baseResponse,
      content: `This query requires human expert review. The question involves complex aspects of ${this._feature?.name ?? 'this feature'} that require careful consideration.\n\nQuery: ${query.content}`,
      confidence: 0.2,
      latencyMs: 0,
    };
  }

  /**
   * Find a parameter matching the query content
   */
  private findRelevantParameter(content: string): ParameterDefinition | undefined {
    if (!this._feature) return undefined;

    const lowerContent = content.toLowerCase();
    return this._feature.parameters.find(
      p => lowerContent.includes(p.name.toLowerCase())
    );
  }

  /**
   * Find a counter matching the query content
   */
  private findRelevantCounter(content: string) {
    if (!this._feature) return undefined;

    const lowerContent = content.toLowerCase();
    return this._feature.counters.find(
      c => lowerContent.includes(c.name.toLowerCase())
    );
  }

  /**
   * Find a KPI matching the query content
   */
  private findRelevantKPI(content: string) {
    if (!this._feature) return undefined;

    const lowerContent = content.toLowerCase();
    return this._feature.kpis.find(
      k => lowerContent.includes(k.name.toLowerCase())
    );
  }

  /**
   * Find a procedure matching the query content
   */
  private findRelevantProcedure(content: string) {
    if (!this._feature) return undefined;

    const lowerContent = content.toLowerCase();
    return this._feature.procedures.find(
      p => lowerContent.includes(p.name.toLowerCase())
    );
  }

  /**
   * Format parameter response
   */
  private formatParameterResponse(param: ParameterDefinition): string {
    const lines = [
      `**Parameter: ${param.name}**`,
      `Type: ${param.dataType}`,
    ];

    if (param.description) {
      lines.push(`Description: ${param.description}`);
    }

    if (param.defaultValue !== undefined) {
      lines.push(`Default: ${param.defaultValue}`);
    }

    if (param.constraints) {
      if (param.constraints.min !== undefined) {
        lines.push(`Min: ${param.constraints.min}`);
      }
      if (param.constraints.max !== undefined) {
        lines.push(`Max: ${param.constraints.max}`);
      }
    }

    if (param.safeZone) {
      lines.push(`Safe Zone: ${param.safeZone.min} - ${param.safeZone.max}`);
    }

    if (param.moClass) {
      lines.push(`MO Class: ${param.moClass}`);
    }

    return lines.join('\n');
  }

  /**
   * Format procedure response
   */
  private formatProcedureResponse(proc: Procedure): string {
    const lines = [
      `**Procedure: ${proc.name}**`,
    ];

    if (proc.description) {
      lines.push(proc.description);
    }

    if (proc.prerequisites && proc.prerequisites.length > 0) {
      lines.push('\n**Prerequisites:**');
      proc.prerequisites.forEach(pre => lines.push(`- ${pre}`));
    }

    lines.push('\n**Steps:**');
    proc.steps.forEach(step => {
      lines.push(`${step.order}. ${step.description}`);
      if (step.command) {
        lines.push(`   Command: \`${step.command}\``);
      }
    });

    return lines.join('\n');
  }

  /**
   * Calculate reward from feedback
   */
  private calculateReward(feedback: Feedback, response: Response): Reward {
    const latencyPenalty = response.latencyMs > 500 ? -0.1 : 0;
    const consultationCost = response.consultedAgents.length > 0 ? -0.05 : 0;
    const noveltyBonus = 0; // Would require tracking unique queries

    return {
      userRating: feedback.rating,
      resolutionSuccess: feedback.resolved ? 0.5 : 0,
      latencyPenalty,
      consultationCost,
      noveltyBonus,
    };
  }

  /**
   * Infer action from response
   */
  private inferActionFromResponse(response: Response): Action {
    if (response.consultedAgents.length > 0) {
      return Action.ConsultPeer;
    }
    if (response.confidence < 0.3) {
      return Action.RequestClarification;
    }
    if (response.confidence < 0.5) {
      return Action.Escalate;
    }
    if (response.sources.length > 0) {
      return Action.ContextAnswer;
    }
    return Action.DirectAnswer;
  }

  /**
   * Store successful interaction in memory
   */
  private async storeSuccessfulInteraction(
    query: Query,
    response: Response,
    _feedback: Feedback
  ): Promise<void> {
    const content = `Q: ${query.content}\nA: ${response.content}`;
    await this.storeMemory(content, {
      source: 'response',
      outcome: 'success',
      confidence: response.confidence,
      queryType: query.type,
      timestamp: Date.now(),
    });
  }

  /**
   * Update metrics with new query data
   */
  private updateMetrics(latencyMs: number, confidence: ConfidenceScore): void {
    const n = this.metrics.totalQueries;
    this.metrics.averageLatencyMs =
      (this.metrics.averageLatencyMs * (n - 1) + latencyMs) / n;
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence * (n - 1) + confidence) / n;
  }

  /**
   * Simple string hash for state encoding
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<void> {
    this._status = AgentStatus.Offline;
    this.activeQueries.clear();
  }
}
