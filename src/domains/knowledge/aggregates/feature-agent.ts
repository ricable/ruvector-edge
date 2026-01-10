/**
 * FeatureAgent Aggregate Root
 *
 * The central aggregate for the Knowledge bounded context.
 * Each FeatureAgent masters a single Ericsson RAN feature identified by FAJ code.
 */

import { FAJCode } from '../value-objects/faj-code';
import { Feature, AccessTechnology, Category } from '../entities/feature';
import { KnowledgeBase } from '../entities/knowledge-base';
import { ParameterCatalog } from '../entities/parameter-catalog';
import { CounterCatalog } from '../entities/counter-catalog';

export type AgentStatus = 'Initializing' | 'Ready' | 'Busy' | 'Offline' | 'ColdStart';

export interface AgentId {
  readonly value: string;
}

export interface AgentConfig {
  readonly fajCode: FAJCode;
  readonly type: AccessTechnology;
  readonly category: Category;
  readonly featureData: Feature;
}

export interface HealthScore {
  readonly value: number; // 0.0 - 1.0
}

export interface ConfidenceScore {
  readonly value: number; // 0.0 - 1.0
}

/**
 * Domain Events for FeatureAgent
 */
export interface AgentInitialized {
  readonly type: 'AgentInitialized';
  readonly agentId: AgentId;
  readonly fajCode: FAJCode;
  readonly timestamp: Date;
}

export interface QueryProcessed {
  readonly type: 'QueryProcessed';
  readonly agentId: AgentId;
  readonly queryId: string;
  readonly responseTime: number;
  readonly timestamp: Date;
}

export interface FeedbackRecorded {
  readonly type: 'FeedbackRecorded';
  readonly agentId: AgentId;
  readonly queryId: string;
  readonly reward: number;
  readonly timestamp: Date;
}

export interface PeerConsulted {
  readonly type: 'PeerConsulted';
  readonly agentId: AgentId;
  readonly peerId: AgentId;
  readonly queryId: string;
  readonly timestamp: Date;
}

export type FeatureAgentEvent = AgentInitialized | QueryProcessed | FeedbackRecorded | PeerConsulted;

/**
 * FeatureAgent Aggregate Root
 */
export class FeatureAgent {
  private _id: AgentId;
  private _fajCode: FAJCode;
  private _type: AccessTechnology;
  private _category: Category;
  private _status: AgentStatus;
  private _health: HealthScore;
  private _confidence: ConfidenceScore;
  private _knowledgeBase: KnowledgeBase;
  private _parameterCatalog: ParameterCatalog;
  private _counterCatalog: CounterCatalog;
  private _interactionCount: number;
  private _events: FeatureAgentEvent[];

  private constructor(
    id: AgentId,
    fajCode: FAJCode,
    type: AccessTechnology,
    category: Category,
    feature: Feature
  ) {
    this._id = id;
    this._fajCode = fajCode;
    this._type = type;
    this._category = category;
    this._status = 'Initializing';
    this._health = { value: 1.0 };
    this._confidence = { value: 0.5 };
    this._knowledgeBase = new KnowledgeBase(`kb-${id.value}`, [feature]);
    this._parameterCatalog = new ParameterCatalog(`pc-${id.value}`);
    this._counterCatalog = new CounterCatalog(`cc-${id.value}`);
    this._interactionCount = 0;
    this._events = [];

    // Initialize catalogs from feature
    this.initializeCatalogs(feature);
  }

  /**
   * Factory method - only way to create FeatureAgent
   */
  static create(config: AgentConfig): FeatureAgent {
    const id: AgentId = { value: `agent-${config.fajCode.toString().replace(/\s/g, '-')}` };
    const agent = new FeatureAgent(
      id,
      config.fajCode,
      config.type,
      config.category,
      config.featureData
    );
    return agent;
  }

  /**
   * Initialize agent - loads knowledge and prepares for queries
   */
  async initialize(): Promise<void> {
    if (this._status !== 'Initializing') {
      throw new Error(`Cannot initialize agent in status: ${this._status}`);
    }

    // Transition to ColdStart if low interactions, otherwise Ready
    this._status = this._interactionCount < 100 ? 'ColdStart' : 'Ready';

    this.raise({
      type: 'AgentInitialized',
      agentId: this._id,
      fajCode: this._fajCode,
      timestamp: new Date()
    });
  }

  /**
   * Handle incoming query
   */
  async handleQuery(queryId: string, queryContent: string): Promise<{ content: string; confidence: number }> {
    if (this._status === 'Initializing' || this._status === 'Offline') {
      throw new Error(`Agent not ready to handle queries. Status: ${this._status}`);
    }

    const previousStatus = this._status;
    this._status = 'Busy';

    const startTime = Date.now();
    try {
      // Process query using knowledge base
      const response = this.processQuery(queryContent);
      const responseTime = Date.now() - startTime;

      this._interactionCount++;

      // Check if we should transition from ColdStart to Ready
      if (previousStatus === 'ColdStart' && this._interactionCount >= 100) {
        this._status = 'Ready';
      } else {
        this._status = previousStatus;
      }

      this.raise({
        type: 'QueryProcessed',
        agentId: this._id,
        queryId,
        responseTime,
        timestamp: new Date()
      });

      return response;
    } catch (error) {
      this._status = previousStatus;
      throw error;
    }
  }

  /**
   * Record feedback for a query (for Q-learning)
   */
  recordFeedback(queryId: string, reward: number): void {
    // Update confidence based on feedback
    const adjustedConfidence = this._confidence.value + (reward * 0.1);
    this._confidence = { value: Math.max(0, Math.min(1, adjustedConfidence)) };

    this.raise({
      type: 'FeedbackRecorded',
      agentId: this._id,
      queryId,
      reward,
      timestamp: new Date()
    });
  }

  /**
   * Request help from a peer agent
   */
  async consultPeer(peerId: AgentId, queryId: string): Promise<void> {
    this.raise({
      type: 'PeerConsulted',
      agentId: this._id,
      peerId,
      queryId,
      timestamp: new Date()
    });
  }

  /**
   * Shutdown the agent
   */
  shutdown(): void {
    this._status = 'Offline';
  }

  /**
   * Restart the agent
   */
  restart(): void {
    this._status = 'Initializing';
  }

  // Private methods

  private initializeCatalogs(feature: Feature): void {
    // Add parameters to catalog
    for (const param of feature.parameters) {
      this._parameterCatalog.add({
        parameter: param,
        featureId: feature.id,
        featureName: feature.name,
        fajCode: feature.fajCode.toString()
      });
    }

    // Add counters to catalog
    for (const counter of feature.counters) {
      this._counterCatalog.add({
        counter,
        featureId: feature.id,
        featureName: feature.name,
        fajCode: feature.fajCode.toString()
      });
    }
  }

  private processQuery(queryContent: string): { content: string; confidence: number } {
    // Basic query processing using knowledge base
    const stats = this._knowledgeBase.getStats();
    return {
      content: `Processed query for ${this._fajCode.toString()}. Knowledge base contains ${stats.parameterCount} parameters and ${stats.counterCount} counters.`,
      confidence: this._confidence.value
    };
  }

  private raise(event: FeatureAgentEvent): void {
    this._events.push(event);
  }

  // Getters

  get id(): AgentId { return this._id; }
  get fajCode(): FAJCode { return this._fajCode; }
  get type(): AccessTechnology { return this._type; }
  get category(): Category { return this._category; }
  get status(): AgentStatus { return this._status; }
  get health(): HealthScore { return this._health; }
  get confidence(): ConfidenceScore { return this._confidence; }
  get knowledgeBase(): KnowledgeBase { return this._knowledgeBase; }
  get parameterCatalog(): ParameterCatalog { return this._parameterCatalog; }
  get counterCatalog(): CounterCatalog { return this._counterCatalog; }
  get interactionCount(): number { return this._interactionCount; }
  get isColdStart(): boolean { return this._status === 'ColdStart'; }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): FeatureAgentEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  /**
   * Identity equality
   */
  equals(other: FeatureAgent): boolean {
    return this._id.value === other._id.value;
  }

  toString(): string {
    return `FeatureAgent(${this._fajCode.toString()}) [${this._status}]`;
  }
}
