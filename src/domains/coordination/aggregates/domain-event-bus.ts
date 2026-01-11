/**
 * Domain Event Bus - Pub/Sub System for RAN Agent Swarm
 *
 * Implements event-driven architecture for:
 * - State transition notifications
 * - Query routing and responses
 * - Federated learning triggers
 * - Health monitoring
 * - Consensus coordination
 *
 * @module coordination/aggregates/domain-event-bus
 */

import { AgentState, StateTransitionedEvent, OODAUpdateEvent } from '../../intelligence/aggregates/autonomous-state-machine';
import { AgentSpawnedEvent, QueryReceivedEvent, ResponseGeneratedEvent, PeerConsultedEvent } from '../../knowledge/aggregates/enhanced-feature-agent';

/**
 * Domain Event Types
 */
export type DomainEvent =
  | StateTransitionedEvent
  | OODAUpdateEvent
  | AgentSpawnedEvent
  | QueryReceivedEvent
  | ResponseGeneratedEvent
  | PeerConsultedEvent;

/**
 * Event Handler Function Type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T
) => void | Promise<void>;

/**
 * Event Subscription
 */
interface EventSubscription {
  readonly id: string;
  readonly eventType: string;
  readonly handler: EventHandler;
  readonly filter?: (event: DomainEvent) => boolean;
  readonly once: boolean;
}

/**
 * Event Bus Statistics
 */
export interface EventBusStatistics {
  readonly totalEventsPublished: number;
  readonly totalEventsProcessed: number;
  readonly totalSubscriptions: number;
  readonly eventTypeBreakdown: Map<string, number>;
  readonly averageProcessingTime: number;
}

/**
 * Domain Event Bus
 *
 * Implements publish-subscribe pattern for domain events.
 * Supports filtering, one-time handlers, and async processing.
 */
export class DomainEventBus {
  private readonly subscriptions: Map<string, EventSubscription[]>;
  private readonly subscriptionsByEventType: Map<string, Set<string>>;
  private readonly eventHistory: DomainEvent[];
  private readonly processingTimes: number[];

  private _totalEventsPublished: number;
  private _totalEventsProcessed: number;
  private readonly maxHistorySize: number;
  private subscriptionCounter: number;

  constructor(maxHistorySize: number = 10000) {
    this.subscriptions = new Map();
    this.subscriptionsByEventType = new Map();
    this.eventHistory = [];
    this.processingTimes = [];
    this._totalEventsPublished = 0;
    this._totalEventsProcessed = 0;
    this.maxHistorySize = maxHistorySize;
    this.subscriptionCounter = 0;
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options?: {
      filter?: (event: T) => boolean;
      once?: boolean;
    }
  ): string {
    const subscriptionId = `sub-${this.subscriptionCounter++}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      filter: options?.filter as (event: DomainEvent) => boolean,
      once: options?.once ?? false
    };

    // Store subscription
    if (!this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, []);
    }
    this.subscriptions.get(subscriptionId)!.push(subscription);

    // Index by event type
    if (!this.subscriptionsByEventType.has(eventType)) {
      this.subscriptionsByEventType.set(eventType, new Set());
    }
    this.subscriptionsByEventType.get(eventType)!.add(subscriptionId);

    return subscriptionId;
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(
    handler: EventHandler,
    options?: {
      filter?: (event: DomainEvent) => boolean;
      once?: boolean;
    }
  ): string {
    return this.subscribe('*', handler, options);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    for (const sub of subscription) {
      this.subscriptionsByEventType.get(sub.eventType)?.delete(subscriptionId);
    }

    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Publish an event
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const startTime = Date.now();

    this._totalEventsPublished++;

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Get subscriptions for this event type
    const eventType = event.type;
    const subscriptionIds = new Set<string>();

    // Add type-specific subscriptions
    for (const id of this.subscriptionsByEventType.get(eventType) ?? []) {
      subscriptionIds.add(id);
    }

    // Add wildcard subscriptions
    for (const id of this.subscriptionsByEventType.get('*') ?? []) {
      subscriptionIds.add(id);
    }

    // Process subscriptions
    const toRemove: string[] = [];

    for (const subscriptionId of subscriptionIds) {
      const subscriptions = this.subscriptions.get(subscriptionId);
      if (!subscriptions) continue;

      for (const subscription of subscriptions) {
        // Apply filter if present
        if (subscription.filter && !subscription.filter(event)) {
          continue;
        }

        // Execute handler
        try {
          await subscription.handler(event);
          this._totalEventsProcessed++;

          // Mark one-time subscriptions for removal
          if (subscription.once) {
            toRemove.push(subscriptionId);
          }
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }

    // Remove one-time subscriptions
    for (const id of toRemove) {
      this.unsubscribe(id);
    }

    // Track processing time
    this.processingTimes.push(Date.now() - startTime);
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
  }

  /**
   * Publish multiple events
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Get event history
   */
  getHistory(filter?: {
    eventType?: string;
    since?: Date;
    limit?: number;
  }): DomainEvent[] {
    let history = [...this.eventHistory];

    if (filter?.eventType) {
      history = history.filter(e => e.type === filter.eventType);
    }

    if (filter?.since) {
      history = history.filter(e => new Date(e.timestamp) >= filter.since);
    }

    if (filter?.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Get statistics
   */
  getStatistics(): EventBusStatistics {
    const eventTypeBreakdown = new Map<string, number>();

    for (const event of this.eventHistory) {
      const count = eventTypeBreakdown.get(event.type) ?? 0;
      eventTypeBreakdown.set(event.type, count + 1);
    }

    const averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length
      : 0;

    return {
      totalEventsPublished: this._totalEventsPublished,
      totalEventsProcessed: this._totalEventsProcessed,
      totalSubscriptions: this.subscriptions.size,
      eventTypeBreakdown,
      averageProcessingTime
    };
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.subscriptionsByEventType.clear();
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
  }
}

/**
 * State Transition Handler
 *
 * Handles state transition events and triggers appropriate actions
 */
export class StateTransitionHandler {
  constructor(private readonly eventBus: DomainEventBus) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    this.eventBus.subscribe<StateTransitionedEvent>(
      'StateTransitioned',
      this.handleStateTransition.bind(this)
    );
  }

  private async handleStateTransition(event: StateTransitionedEvent): Promise<void> {
    // Log state transition
    console.log(`[StateTransition] ${event.machineId}: ${event.fromState} -> ${event.toState}`);

    // Trigger actions based on new state
    switch (event.toState) {
      case AgentState.READY:
        // Agent is ready for queries
        await this.onAgentReady(event);
        break;

      case AgentState.DEGRADED:
        // Agent needs recovery
        await this.onAgentDegraded(event);
        break;

      case AgentState.COLD_START:
        // Agent in cold start phase
        await this.onAgentColdStart(event);
        break;
    }
  }

  private async onAgentReady(event: StateTransitionedEvent): Promise<void> {
    // Could trigger initialization tasks
  }

  private async onAgentDegraded(event: StateTransitionedEvent): Promise<void> {
    // Could trigger recovery procedures
  }

  private async onAgentColdStart(event: StateTransitionedEvent): Promise<void> {
    // Could trigger accelerated learning
  }
}

/**
 * Query Router Handler
 *
 * Routes queries to appropriate agents based on content
 */
export class QueryRouterHandler {
  private readonly agentRegistry: Map<string, Set<string>>; // acronym -> keywords

  constructor(private readonly eventBus: DomainEventBus) {
    this.agentRegistry = new Map();
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    this.eventBus.subscribe<QueryReceivedEvent>(
      'QueryReceived',
      this.handleQueryReceived.bind(this)
    );
  }

  /**
   * Register an agent with keywords for routing
   */
  registerAgent(acronym: string, keywords: string[]): void {
    this.agentRegistry.set(acronym, new Set(keywords));
  }

  private async handleQueryReceived(event: QueryReceivedEvent): Promise<void> {
    const { queryId, agentId, content } = event.payload;

    // Find relevant agents based on keywords
    const relevantAgents = this.findRelevantAgents(content);

    // Could publish routing event or forward query
    if (relevantAgents.size > 0) {
      console.log(`[QueryRouter] Query ${queryId} routed to ${Array.from(relevantAgents).join(', ')}`);
    }
  }

  private findRelevantAgents(queryContent: string): Set<string> {
    const relevant = new Set<string>();
    const queryLower = queryContent.toLowerCase();

    for (const [acronym, keywords] of this.agentRegistry) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          relevant.add(acronym);
          break;
        }
      }
    }

    return relevant;
  }
}

/**
 * Health Monitor Handler
 *
 * Monitors agent health and triggers alerts
 */
export class HealthMonitorHandler {
  private readonly healthThreshold: number = 0.5;

  constructor(private readonly eventBus: DomainEventBus) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    this.eventBus.subscribe<OODAUpdateEvent>(
      'OODAUpdate',
      this.handleOODAUpdate.bind(this)
    );
  }

  private async handleOODAUpdate(event: OODAUpdateEvent): Promise<void> {
    if (event.observations && event.observations.health < this.healthThreshold) {
      console.log(`[HealthAlert] Agent ${event.machineId} health: ${event.observations.health.toFixed(2)}`);

      // Could trigger health recovery or alert
      await this.triggerHealthAlert(event);
    }
  }

  private async triggerHealthAlert(event: OODAUpdateEvent): Promise<void> {
    // Implementation for health alert
  }
}

/**
 * Federated Learning Coordinator
 *
 * Coordinates federated learning events between agents
 */
export class FederatedLearningCoordinator {
  private readonly syncInterval: number = 60000; // 60 seconds
  private readonly interactionThreshold: number = 10;

  private lastSyncTime: number = Date.now();
  private interactionCount: number = 0;

  constructor(private readonly eventBus: DomainEventBus) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    this.eventBus.subscribe<ResponseGeneratedEvent>(
      'ResponseGenerated',
      this.handleResponseGenerated.bind(this)
    );
  }

  private async handleResponseGenerated(event: ResponseGeneratedEvent): Promise<void> {
    this.interactionCount++;

    // Check if sync is needed
    const timeSinceSync = Date.now() - this.lastSyncTime;
    const shouldSync = timeSinceSync >= this.syncInterval || this.interactionCount >= this.interactionThreshold;

    if (shouldSync) {
      await this.triggerFederatedSync();
      this.lastSyncTime = Date.now();
      this.interactionCount = 0;
    }
  }

  private async triggerFederatedSync(): Promise<void> {
    console.log('[FederatedLearning] Triggering federated sync across agents');
    // Implementation for federated sync
  }
}

/**
 * Event Bus Factory
 *
 * Creates a fully configured event bus with all handlers
 */
export class EventBusFactory {
  static create(): DomainEventBus {
    const eventBus = new DomainEventBus(10000);

    // Register handlers
    new StateTransitionHandler(eventBus);
    new QueryRouterHandler(eventBus);
    new HealthMonitorHandler(eventBus);
    new FederatedLearningCoordinator(eventBus);

    return eventBus;
  }
}

/**
 * Global event bus instance
 */
let globalEventBus: DomainEventBus | null = null;

/**
 * Get or create global event bus
 */
export function getGlobalEventBus(): DomainEventBus {
  if (!globalEventBus) {
    globalEventBus = EventBusFactory.create();
  }
  return globalEventBus;
}

/**
 * Reset global event bus (for testing)
 */
export function resetGlobalEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clear();
    globalEventBus.clearHistory();
  }
  globalEventBus = null;
}

export default DomainEventBus;
