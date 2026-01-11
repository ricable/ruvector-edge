/**
 * FeatureAgent Aggregate Root
 *
 * The central aggregate for the Agent Lifecycle bounded context.
 * Each FeatureAgent masters a single Ericsson RAN feature identified by FAJ code.
 *
 * This aggregate implements:
 * - Event sourcing for state transitions
 * - Invariants preservation (FAJ code validation, confidence bounds, etc.)
 * - Domain event publishing
 * - Proper encapsulation
 */

import {
  FAJCode,
  FeatureCategory,
  ConfidenceScore,
  HealthScore,
  AgentLifecycleStateVO,
  AgentLifecycleState
} from '../value-objects';
import {
  AgentLifecycleEvent,
  AgentSpawnedEvent,
  QueryHandledEvent,
  CapabilityAddedEvent
} from '../domain-events';
import { AutonomousStateMachine } from './autonomous-state-machine';

/**
 * Agent capability
 */
export interface Capability {
  readonly name: string;
  readonly description: string;
  readonly confidence: number;
}

/**
 * Agent configuration
 */
export interface FeatureAgentConfig {
  readonly fajCode: string;
  readonly category: FeatureCategory;
  readonly capabilities?: Capability[];
}

/**
 * Agent ID value object
 */
export interface AgentId {
  readonly value: string;
}

/**
 * FeatureAgent Aggregate Root
 *
 * Manages the lifecycle of a specialized RAN feature agent.
 */
export class FeatureAgent {
  readonly id: AgentId;

  // Aggregate state
  private _fajCode: FAJCode;
  private _category: FeatureCategory;
  private _capabilities: Capability[];
  private _confidence: ConfidenceScore;
  private _health: HealthScore;
  private _stateMachine: AutonomousStateMachine;
  private _interactionCount: number;
  private _createdAt: Date;

  // Event sourcing
  private _events: AgentLifecycleEvent[];
  private _version: number;

  private constructor(
    id: AgentId,
    fajCode: FAJCode,
    category: FeatureCategory,
    stateMachine: AutonomousStateMachine
  ) {
    this.id = id;
    this._fajCode = fajCode;
    this._category = category;
    this._stateMachine = stateMachine;
    this._capabilities = [];
    this._confidence = ConfidenceScore.create(0.5); // Start with medium confidence
    this._health = HealthScore.create(1.0); // Start healthy
    this._interactionCount = 0;
    this._createdAt = new Date();
    this._events = [];
    this._version = 0;
  }

  /**
   * Factory method to create new FeatureAgent
   */
  static create(config: FeatureAgentConfig): FeatureAgent {
    // Validate FAJ code
    const fajCode = FAJCode.create(config.fajCode);

    // Validate category matches FAJ code
    if (fajCode.category !== config.category) {
      throw new Error(
        `Category mismatch: FAJ code ${config.fajCode} belongs to ${fajCode.category}, not ${config.category}`
      );
    }

    // Create agent ID
    const id: AgentId = {
      value: `agent-${fajCode.code.replace(/\s+/g, '-').toLowerCase()}`
    };

    // Create state machine
    const stateMachine = AutonomousStateMachine.create(id.value);

    // Create agent
    const agent = new FeatureAgent(id, fajCode, config.category, stateMachine);

    // Add initial capabilities if provided
    if (config.capabilities) {
      for (const capability of config.capabilities) {
        agent.addCapabilityInternal(capability);
      }
    }

    // Raise AgentSpawned event
    agent.raise({
      type: 'AgentSpawned',
      aggregateId: id.value,
      aggregateType: 'agent-lifecycle',
      version: ++agent._version,
      timestamp: new Date(),
      payload: {
        agentId: id.value,
        fajCode: fajCode.code,
        category: config.category,
        capabilities: agent._capabilities.map(c => c.name)
      }
    });

    return agent;
  }

  // ===========================================================================
  // PUBLIC API - Lifecycle Management
  // ===========================================================================

  /**
   * Initialize agent by loading knowledge and entering ColdStart
   */
  async initialize(): Promise<void> {
    const currentState = this._stateMachine.getCurrentState();

    if (currentState !== AgentLifecycleState.INITIALIZING) {
      throw new Error(`Cannot initialize agent in state: ${currentState}`);
    }

    // Load knowledge and transition to ColdStart
    await this._stateMachine.loadKnowledge();

    // Collect events from state machine
    this.collectStateMachineEvents();
  }

  /**
   * Handle incoming query
   */
  async handleQuery(queryId: string): Promise<void> {
    const currentState = this._stateMachine.getCurrentState();

    if (!this.canHandleQueries()) {
      throw new Error(`Agent cannot handle queries in state: ${currentState}`);
    }

    const startTime = Date.now();
    let success = false;

    try {
      // Transition to Busy
      await this._stateMachine.receiveQuery(queryId);

      // Process query (simulated)
      await this.processQuery(queryId);

      success = true;

      // Complete query
      await this._stateMachine.completeQuery();

      // Update confidence on success
      this._confidence = this._confidence.increase(0.01);

    } catch (error) {
      // Update confidence on failure
      this._confidence = this._confidence.decrease(0.05);
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this._interactionCount++;

      // Update health based on response time
      this.updateHealthFromResponseTime(responseTime);

      // Collect state machine events
      this.collectStateMachineEvents();

      // Raise QueryHandled event
      this.raise({
        type: 'QueryHandled',
        aggregateId: this.id.value,
        aggregateType: 'agent-lifecycle',
        version: ++this._version,
        timestamp: new Date(),
        payload: {
          agentId: this.id.value,
          queryId,
          success,
          responseTime,
          confidence: this._confidence.score
        }
      });
    }
  }

  /**
   * Add a new capability to the agent
   */
  addCapability(
    name: string,
    description: string,
    source: 'federated_sync' | 'learning' | 'manual' = 'learning'
  ): void {
    if (this._capabilities.some(c => c.name === name)) {
      throw new Error(`Capability ${name} already exists`);
    }

    const capability: Capability = {
      name,
      description,
      confidence: this._confidence.score
    };

    this.addCapabilityInternal(capability);

    // Raise CapabilityAdded event
    this.raise({
      type: 'CapabilityAdded',
      aggregateId: this.id.value,
      aggregateType: 'agent-lifecycle',
      version: ++this._version,
      timestamp: new Date(),
      payload: {
        agentId: this.id.value,
        capability: name,
        source
      }
    });
  }

  /**
   * Update health score
   */
  async updateHealth(score: HealthScore): Promise<void> {
    this._health = score;
    await this._stateMachine.updateHealth(score);
    this.collectStateMachineEvents();
  }

  /**
   * Update health from metrics
   */
  async updateHealthFromMetrics(metrics: {
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    latency: number;
  }): Promise<void> {
    const score = HealthScore.fromMetrics(metrics);
    await this.updateHealth(score);
  }

  /**
   * Request graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this._stateMachine.requestShutdown();
    this.collectStateMachineEvents();
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Check if agent can handle queries in current state
   */
  canHandleQueries(): boolean {
    const state = this._stateMachine.getCurrentState();
    const stateVO = AgentLifecycleStateVO.create(state);
    return stateVO.canHandleQueries;
  }

  /**
   * Check if agent is in operational state
   */
  isOperational(): boolean {
    return this._stateMachine.isOperational();
  }

  /**
   * Check if agent is healthy
   */
  isHealthy(): boolean {
    return this._health.isHealthy();
  }

  /**
   * Check if agent is in cold start
   */
  isColdStart(): boolean {
    return this._stateMachine.getCurrentState() === AgentLifecycleState.COLD_START;
  }

  /**
   * Check if cold start is complete
   */
  isColdStartComplete(): boolean {
    return this._stateMachine.coldStartCompleted;
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  get fajCode(): FAJCode {
    return this._fajCode;
  }

  get category(): FeatureCategory {
    return this._category;
  }

  get capabilities(): Capability[] {
    return [...this._capabilities];
  }

  get confidence(): ConfidenceScore {
    return this._confidence;
  }

  get health(): HealthScore {
    return this._health;
  }

  get stateMachine(): AutonomousStateMachine {
    return this._stateMachine;
  }

  get currentState(): AgentLifecycleState {
    return this._stateMachine.getCurrentState();
  }

  get interactionCount(): number {
    return this._interactionCount;
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // ===========================================================================
  // EVENT SOURCING
  // ===========================================================================

  /**
   * Get uncommitted domain events
   */
  getUncommittedEvents(): AgentLifecycleEvent[] {
    return [...this._events];
  }

  /**
   * Clear uncommitted events
   */
  markEventsAsCommitted(): void {
    this._events = [];
  }

  /**
   * Rebuild aggregate from event history
   */
  static fromHistory(events: AgentLifecycleEvent[]): FeatureAgent {
    if (events.length === 0) {
      throw new Error('Cannot rebuild from empty event history');
    }

    // Find AgentSpawned event
    const agentSpawnedEvent = events.find(
      (e): e is AgentSpawnedEvent => e.type === 'AgentSpawned'
    );

    if (!agentSpawnedEvent) {
      throw new Error('Event history must start with AgentSpawned event');
    }

    // Create agent from AgentSpawned event
    const fajCode = FAJCode.create(agentSpawnedEvent.payload.fajCode);
    const category = agentSpawnedEvent.payload.category as FeatureCategory;
    const id: AgentId = { value: agentSpawnedEvent.payload.agentId };

    const stateMachine = AutonomousStateMachine.create(id.value);
    const agent = new FeatureAgent(id, fajCode, category, stateMachine);

    // Replay events
    for (const event of events) {
      if (event.type === 'CapabilityAdded') {
        agent.addCapabilityInternal({
          name: event.payload.capability,
          description: '',
          confidence: agent._confidence.score
        });
      } else if (event.type === 'QueryHandled') {
        agent._interactionCount++;
        if (event.payload.success) {
          agent._confidence = agent._confidence.increase(0.01);
        } else {
          agent._confidence = agent._confidence.decrease(0.05);
        }
      }
      agent._version = event.version;
    }

    return agent;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Internal method to add capability without raising event
   */
  private addCapabilityInternal(capability: Capability): void {
    this._capabilities.push({ ...capability });
  }

  /**
   * Process query (simulated)
   */
  private async processQuery(queryId: string): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }

  /**
   * Update health from response time
   */
  private updateHealthFromResponseTime(responseTime: number): void {
    // Simple health adjustment based on response time
    if (responseTime > 1000) {
      this._health = this._health.decrease(0.05);
    } else if (responseTime < 100) {
      this._health = this._health.increase(0.01);
    }
  }

  /**
   * Collect events from state machine
   */
  private collectStateMachineEvents(): void {
    const stateMachineEvents = this._stateMachine.getUncommittedEvents();
    this._events.push(...stateMachineEvents);
    this._stateMachine.markEventsAsCommitted();
  }

  /**
   * Raise domain event
   */
  private raise(event: AgentLifecycleEvent): void {
    this._events.push(event);
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Value equality
   */
  equals(other: FeatureAgent): boolean {
    return this.id.value === other.id.value;
  }

  /**
   * String representation
   */
  toString(): string {
    return `FeatureAgent(${this._fajCode.code}) [${this.currentState}] confidence=${this._confidence}`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      id: this.id.value,
      fajCode: this._fajCode.code,
      category: this._category,
      currentState: this.currentState,
      confidence: this._confidence.score,
      health: this._health.score,
      interactionCount: this._interactionCount,
      capabilities: this._capabilities.length,
      version: this._version
    };
  }
}
