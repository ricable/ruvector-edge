/**
 * AutonomousStateMachine Aggregate Root (Agent Lifecycle Context)
 *
 * Manages agent state transitions, OODA loop execution for autonomous decision-making.
 * This is the Agent Lifecycle context version which follows the bounded context map specification.
 *
 * Implements:
 * - Event sourcing for state transitions
 * - Invariants preservation (state transition rules, health thresholds)
 * - Domain event publishing
 * - Proper encapsulation
 */

import {
  HealthScore,
  AgentLifecycleState,
  AgentLifecycleStateVO
} from '../value-objects';
import {
  AgentLifecycleEvent,
  StateTransitionedEvent,
  AutonomousDecisionMadeEvent,
  ColdStartCompletedEvent,
  HealthThresholdBreachedEvent,
  AgentDegradedEvent,
  AgentRecoveredEvent
} from '../domain-events';

/**
 * State transition trigger
 */
export type StateTrigger =
  | 'knowledge_loaded'
  | 'cold_start_complete'
  | 'query_received'
  | 'query_completed'
  | 'health_threshold_breached'
  | 'health_recovered'
  | 'shutdown_requested';

/**
 * State transition rule
 */
interface TransitionRule {
  readonly from: AgentLifecycleState;
  readonly to: AgentLifecycleState;
  readonly trigger: StateTrigger;
  readonly guard: (context: TransitionGuardContext) => boolean;
}

/**
 * Context for guard condition evaluation
 */
interface TransitionGuardContext {
  readonly interactionCount: number;
  readonly healthScore: HealthScore;
  readonly knowledgeLoaded: boolean;
  readonly shutdownRequested: boolean;
  readonly hasCurrentQuery: boolean;
}

/**
 * Configuration for AutonomousStateMachine
 */
export interface AutonomousStateMachineConfig {
  readonly coldStartThreshold: number;        // Interactions before Ready (default: 100)
  readonly healthWarningThreshold: number;    // Health < 0.7 -> Warning (default: 0.7)
  readonly healthCriticalThreshold: number;   // Health < 0.5 -> Degraded (default: 0.5)
  readonly recoveryThreshold: number;         // Health > 0.8 -> Recovered (default: 0.8)
  readonly maxConsecutiveFailures: number;    // Max failures before degradation (default: 5)
  readonly observationWindowMs: number;       // OODA observation window (default: 5000)
}

/**
 * Default configuration
 */
export const DEFAULT_STATE_MACHINE_CONFIG: AutonomousStateMachineConfig = {
  coldStartThreshold: 100,
  healthWarningThreshold: 0.7,
  healthCriticalThreshold: 0.5,
  recoveryThreshold: 0.8,
  maxConsecutiveFailures: 5,
  observationWindowMs: 5000
};

/**
 * State statistics
 */
export interface StateStatistics {
  readonly currentState: AgentLifecycleState;
  readonly previousState: AgentLifecycleState | null;
  readonly timeInState: number;
  readonly totalTransitions: number;
  readonly coldStartCompleted: boolean;
  readonly healthScore: number;
  readonly interactionCount: number;
}

/**
 * OODA Loop Context
 */
interface OODAContext {
  readonly phase: 'Observe' | 'Orient' | 'Decide' | 'Act';
  readonly observations: Map<string, unknown>;
  readonly orientation: {
    readonly currentState: AgentLifecycleState;
    readonly healthTrend: 'improving' | 'stable' | 'declining';
    readonly recentSuccesses: number;
    readonly recentFailures: number;
  };
  readonly decision?: {
    readonly action: string;
    readonly confidence: number;
    readonly reasoning: string;
  };
}

/**
 * AutonomousStateMachine Aggregate Root
 *
 * Manages the 6-state lifecycle machine with OODA loop for autonomous decision making.
 *
 * State Flow:
 *   Initializing -> ColdStart -> Ready <-> Busy
 *       ^                |           |
 *       |                v           v
 *       +------------- Degraded <----+
 *                     |    |
 *                     v    |
 *                  Offline <--- (any state on shutdown)
 */
export class AutonomousStateMachine {
  readonly id: string;
  readonly agentId: string;
  readonly config: AutonomousStateMachineConfig;

  // Aggregate state
  private _currentState: AgentLifecycleState;
  private _previousState: AgentLifecycleState | null;
  private _healthScore: HealthScore;
  private _interactionCount: number;
  private _consecutiveFailures: number;
  private _knowledgeLoaded: boolean;
  private _shutdownRequested: boolean;
  private _coldStartCompleted: boolean;

  // OODA loop state
  private _oodaContext: OODAContext;

  // Timing
  private _stateEnteredAt: Date;
  private _lastTransitionAt: Date;
  private _coldStartStartedAt: Date | null;
  private _degradedEnteredAt: Date | null;

  // Event sourcing
  private _events: AgentLifecycleEvent[];
  private _version: number;

  // State transition rules (invariants)
  private static readonly TRANSITION_RULES: ReadonlyArray<TransitionRule> = [
    // Initializing transitions
    {
      from: AgentLifecycleState.INITIALIZING,
      to: AgentLifecycleState.COLD_START,
      trigger: 'knowledge_loaded',
      guard: (ctx) => ctx.knowledgeLoaded
    },
    {
      from: AgentLifecycleState.INITIALIZING,
      to: AgentLifecycleState.OFFLINE,
      trigger: 'shutdown_requested',
      guard: (ctx) => ctx.shutdownRequested
    },

    // ColdStart transitions
    {
      from: AgentLifecycleState.COLD_START,
      to: AgentLifecycleState.READY,
      trigger: 'cold_start_complete',
      guard: (ctx) => ctx.interactionCount >= 100
    },
    {
      from: AgentLifecycleState.COLD_START,
      to: AgentLifecycleState.OFFLINE,
      trigger: 'shutdown_requested',
      guard: (ctx) => ctx.shutdownRequested
    },

    // Ready transitions
    {
      from: AgentLifecycleState.READY,
      to: AgentLifecycleState.BUSY,
      trigger: 'query_received',
      guard: (ctx) => ctx.hasCurrentQuery
    },
    {
      from: AgentLifecycleState.READY,
      to: AgentLifecycleState.DEGRADED,
      trigger: 'health_threshold_breached',
      guard: (ctx) => ctx.healthScore.score < 0.5
    },
    {
      from: AgentLifecycleState.READY,
      to: AgentLifecycleState.OFFLINE,
      trigger: 'shutdown_requested',
      guard: (ctx) => ctx.shutdownRequested
    },

    // Busy transitions
    {
      from: AgentLifecycleState.BUSY,
      to: AgentLifecycleState.READY,
      trigger: 'query_completed',
      guard: () => true // Always allow completion
    },
    {
      from: AgentLifecycleState.BUSY,
      to: AgentLifecycleState.DEGRADED,
      trigger: 'health_threshold_breached',
      guard: (ctx) => ctx.healthScore.score < 0.5
    },
    {
      from: AgentLifecycleState.BUSY,
      to: AgentLifecycleState.OFFLINE,
      trigger: 'shutdown_requested',
      guard: (ctx) => ctx.shutdownRequested
    },

    // Degraded transitions
    {
      from: AgentLifecycleState.DEGRADED,
      to: AgentLifecycleState.READY,
      trigger: 'health_recovered',
      guard: (ctx) => ctx.healthScore.score >= 0.8
    },
    {
      from: AgentLifecycleState.DEGRADED,
      to: AgentLifecycleState.OFFLINE,
      trigger: 'shutdown_requested',
      guard: (ctx) => ctx.shutdownRequested
    },

    // Offline is terminal (no outgoing transitions)
  ];

  private constructor(
    id: string,
    agentId: string,
    config: AutonomousStateMachineConfig = DEFAULT_STATE_MACHINE_CONFIG
  ) {
    this.id = id;
    this.agentId = agentId;
    this.config = config;

    // Initialize state
    this._currentState = AgentLifecycleState.INITIALIZING;
    this._previousState = null;
    this._healthScore = HealthScore.create(1.0);
    this._interactionCount = 0;
    this._consecutiveFailures = 0;
    this._knowledgeLoaded = false;
    this._shutdownRequested = false;
    this._coldStartCompleted = false;

    // Initialize OODA context
    this._oodaContext = {
      phase: 'Observe',
      observations: new Map(),
      orientation: {
        currentState: AgentLifecycleState.INITIALIZING,
        healthTrend: 'stable',
        recentSuccesses: 0,
        recentFailures: 0
      }
    };

    // Timing
    const now = new Date();
    this._stateEnteredAt = now;
    this._lastTransitionAt = now;
    this._coldStartStartedAt = null;
    this._degradedEnteredAt = null;

    // Event sourcing
    this._events = [];
    this._version = 0;
  }

  // ===========================================================================
  // FACTORY METHODS
  // ===========================================================================

  /**
   * Factory method to create new state machine
   */
  static create(
    agentId: string,
    config?: AutonomousStateMachineConfig
  ): AutonomousStateMachine {
    const id = `asm-${agentId}-${Date.now()}`;
    return new AutonomousStateMachine(id, agentId, config);
  }

  /**
   * Factory method to create with custom ID
   */
  static createWithId(
    id: string,
    agentId: string,
    config?: AutonomousStateMachineConfig
  ): AutonomousStateMachine {
    return new AutonomousStateMachine(id, agentId, config);
  }

  // ===========================================================================
  // PUBLIC API - State Transitions
  // ===========================================================================

  /**
   * Get current lifecycle state
   */
  getCurrentState(): AgentLifecycleState {
    return this._currentState;
  }

  /**
   * Get current state as value object
   */
  getCurrentStateVO(): AgentLifecycleStateVO {
    return AgentLifecycleStateVO.create(this._currentState);
  }

  /**
   * Check if transition to target state is valid
   */
  canTransitionTo(targetState: AgentLifecycleState): boolean {
    const currentStateVO = AgentLifecycleStateVO.create(this._currentState);
    const targetStateVO = AgentLifecycleStateVO.create(targetState);
    return currentStateVO.canTransitionTo(targetStateVO);
  }

  /**
   * Execute state transition by trigger
   */
  async transition(trigger: StateTrigger, context?: Partial<TransitionGuardContext>): Promise<void> {
    const rule = this.findTransitionRule(trigger);

    if (!rule) {
      throw new Error(
        `Invalid transition trigger '${trigger}' from state '${this._currentState}'`
      );
    }

    // Build guard context
    const guardContext: TransitionGuardContext = {
      interactionCount: context?.interactionCount ?? this._interactionCount,
      healthScore: context?.healthScore ?? this._healthScore,
      knowledgeLoaded: context?.knowledgeLoaded ?? this._knowledgeLoaded,
      shutdownRequested: context?.shutdownRequested ?? this._shutdownRequested,
      hasCurrentQuery: context?.hasCurrentQuery ?? false
    };

    // Check guard condition (invariant preservation)
    if (!rule.guard(guardContext)) {
      throw new Error(
        `Guard condition failed for transition from '${this._currentState}' to '${rule.to}'`
      );
    }

    // Execute transition
    await this.executeTransition(rule, trigger, guardContext);
  }

  /**
   * Load knowledge (feature catalog) and transition to ColdStart
   */
  async loadKnowledge(): Promise<void> {
    if (this._currentState !== AgentLifecycleState.INITIALIZING) {
      throw new Error('Cannot load knowledge: not in Initializing state');
    }

    this._knowledgeLoaded = true;
    await this.transition('knowledge_loaded', { knowledgeLoaded: true });
  }

  /**
   * Record interaction and check for cold start completion
   */
  async recordInteraction(success: boolean = true): Promise<void> {
    this._interactionCount++;

    if (success) {
      this._consecutiveFailures = 0;
      this._oodaContext.orientation.recentSuccesses++;
    } else {
      this._consecutiveFailures++;
      this._oodaContext.orientation.recentFailures++;
    }

    // Check cold start completion
    if (
      this._currentState === AgentLifecycleState.COLD_START &&
      this._interactionCount >= this.config.coldStartThreshold &&
      !this._coldStartCompleted
    ) {
      await this.transition('cold_start_complete');
    }
  }

  /**
   * Receive query and transition to Busy
   */
  async receiveQuery(queryId: string): Promise<void> {
    if (this._currentState !== AgentLifecycleState.READY) {
      throw new Error(`Cannot receive query: not in Ready state (current: ${this._currentState})`);
    }

    await this.transition('query_received', { hasCurrentQuery: true });
  }

  /**
   * Complete query and transition back to Ready
   */
  async completeQuery(): Promise<void> {
    if (this._currentState !== AgentLifecycleState.BUSY) {
      throw new Error(`Cannot complete query: not in Busy state (current: ${this._currentState})`);
    }

    await this.transition('query_completed');
    await this.recordInteraction(true);
  }

  /**
   * Update health score and check for degraded state
   */
  async updateHealth(score: HealthScore): Promise<void> {
    const previousScore = this._healthScore;
    this._healthScore = score;

    // Update health trend
    if (score.score > previousScore.score + 0.1) {
      this._oodaContext.orientation.healthTrend = 'improving';
    } else if (score.score < previousScore.score - 0.1) {
      this._oodaContext.orientation.healthTrend = 'declining';
    }

    // Check for degradation
    if (
      (this._currentState === AgentLifecycleState.READY ||
        this._currentState === AgentLifecycleState.BUSY) &&
      score.score < this.config.healthCriticalThreshold
    ) {
      await this.transition('health_threshold_breached', { healthScore: score });
    }

    // Check for recovery
    if (
      this._currentState === AgentLifecycleState.DEGRADED &&
      score.score >= this.config.recoveryThreshold
    ) {
      await this.transition('health_recovered', { healthScore: score });
    }
  }

  /**
   * Request graceful shutdown
   */
  async requestShutdown(): Promise<void> {
    this._shutdownRequested = true;
    await this.transition('shutdown_requested', { shutdownRequested: true });
  }

  // ===========================================================================
  // OODA LOOP IMPLEMENTATION
  // ===========================================================================

  /**
   * Execute one OODA loop iteration
   *
   * Observe -> Orient -> Decide -> Act
   */
  async executeOODALoop(): Promise<void> {
    // OBSERVE: Gather current state information
    const observations = await this.observe();

    // ORIENT: Analyze context and update orientation
    const orientation = await this.orient(observations);

    // DECIDE: Select action based on orientation
    const decision = await this.decide(orientation);

    // ACT: Execute the decision
    await this.act(decision);

    // Publish autonomous decision event
    this.raise({
      type: 'AutonomousDecisionMade',
      aggregateId: this.id,
      aggregateType: 'agent-lifecycle',
      version: ++this._version,
      timestamp: new Date(),
      payload: {
        agentId: this.agentId,
        currentState: this._currentState,
        contextState: orientation.currentState,
        action: decision.action,
        confidence: decision.confidence,
        qValue: decision.qValue ?? 0,
        reasoning: decision.reasoning
      }
    });
  }

  /**
   * OBSERVE: Collect current state metrics
   */
  private async observe(): Promise<Map<string, unknown>> {
    const observations = new Map<string, unknown>();

    observations.set('currentState', this._currentState);
    observations.set('healthScore', this._healthScore.score);
    observations.set('interactionCount', this._interactionCount);
    observations.set('consecutiveFailures', this._consecutiveFailures);
    observations.set('timeInState', Date.now() - this._stateEnteredAt.getTime());
    observations.set('healthTrend', this._oodaContext.orientation.healthTrend);

    // State-specific observations
    switch (this._currentState) {
      case AgentLifecycleState.COLD_START:
        observations.set('progress', this._interactionCount / this.config.coldStartThreshold);
        observations.set('remaining', this.config.coldStartThreshold - this._interactionCount);
        break;

      case AgentLifecycleState.DEGRADED:
        observations.set(
          'timeInDegraded',
          this._degradedEnteredAt ? Date.now() - this._degradedEnteredAt.getTime() : 0
        );
        observations.set('recoveryPlan', this.generateRecoveryPlan());
        break;

      case AgentLifecycleState.BUSY:
        observations.set('queryDuration', Date.now() - this._stateEnteredAt.getTime());
        break;
    }

    this._oodaContext = { ...this._oodaContext, phase: 'Observe', observations };

    return observations;
  }

  /**
   * ORIENT: Analyze observations and build orientation
   */
  private async orient(observations: Map<string, unknown>): Promise<{
    currentState: AgentLifecycleState;
    healthTrend: 'improving' | 'stable' | 'declining';
    recentSuccesses: number;
    recentFailures: number;
    situation: string;
  }> {
    const healthScore = this._healthScore.score;
    let situation = 'normal';

    // Determine situation
    if (this._currentState === AgentLifecycleState.DEGRADED) {
      situation = 'degraded';
    } else if (this._currentState === AgentLifecycleState.COLD_START) {
      situation = 'cold_start';
    } else if (healthScore < this.config.healthWarningThreshold) {
      situation = 'warning';
    } else if (this._consecutiveFailures >= this.config.maxConsecutiveFailures) {
      situation = 'critical';
    }

    this._oodaContext = {
      ...this._oodaContext,
      phase: 'Orient',
      orientation: {
        currentState: this._currentState,
        healthTrend: this._oodaContext.orientation.healthTrend,
        recentSuccesses: this._oodaContext.orientation.recentSuccesses,
        recentFailures: this._oodaContext.orientation.recentFailures
      }
    };

    return {
      currentState: this._currentState,
      healthTrend: this._oodaContext.orientation.healthTrend,
      recentSuccesses: this._oodaContext.orientation.recentSuccesses,
      recentFailures: this._oodaContext.orientation.recentFailures,
      situation
    };
  }

  /**
   * DECIDE: Select action based on orientation
   */
  private async decide(orientation: Awaited<ReturnType<typeof this.orient>>): Promise<{
    action: string;
    confidence: number;
    reasoning: string;
    qValue?: number;
  }> {
    this._oodaContext = { ...this._oodaContext, phase: 'Decide' };

    // Decision logic based on state and orientation
    let action: string;
    let reasoning: string;
    let confidence = this._healthScore.score;

    switch (this._currentState) {
      case AgentLifecycleState.COLD_START:
        // Prioritize exploration and learning
        action = 'explore';
        reasoning = `Cold start: ${this._interactionCount}/${this.config.coldStartThreshold} interactions completed`;
        confidence = this._interactionCount / this.config.coldStartThreshold;
        break;

      case AgentLifecycleState.READY:
        // Decide based on health trend
        if (orientation.healthTrend === 'declining') {
          action = 'increase_exploration';
          reasoning = 'Health declining: increasing exploration to find better strategies';
          confidence = this._healthScore.score * 0.8;
        } else {
          action = 'exploit';
          reasoning = 'Health stable: exploiting known successful patterns';
        }
        break;

      case AgentLifecycleState.DEGRADED:
        // Recovery actions
        action = 'execute_recovery_plan';
        reasoning = `Degraded: executing recovery plan (${this.generateRecoveryPlan().join(', ')})`;
        confidence = 1 - this._healthScore.score; // Lower confidence when degraded
        break;

      case AgentLifecycleState.BUSY:
        action = 'continue_query';
        reasoning = 'Query in progress: continuing execution';
        confidence = 0.9;
        break;

      default:
        action = 'maintain';
        reasoning = `Maintaining current state: ${this._currentState}`;
        break;
    }

    // Store decision in context
    this._oodaContext = {
      ...this._oodaContext,
      decision: { action, confidence, reasoning }
    };

    return { action, confidence, reasoning };
  }

  /**
   * ACT: Execute the decided action
   */
  private async act(decision: Awaited<ReturnType<typeof this.decide>>): Promise<void> {
    this._oodaContext = { ...this._oodaContext, phase: 'Act' };

    // Execute action based on decision
    switch (decision.action) {
      case 'explore':
      case 'exploit':
      case 'increase_exploration':
      case 'continue_query':
      case 'maintain':
      case 'execute_recovery_plan':
        // Actions are handled by external systems
        break;
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Find transition rule by trigger
   */
  private findTransitionRule(trigger: StateTrigger): TransitionRule | undefined {
    return AutonomousStateMachine.TRANSITION_RULES.find(
      rule => rule.from === this._currentState && rule.trigger === trigger
    );
  }

  /**
   * Execute state transition
   */
  private async executeTransition(
    rule: TransitionRule,
    trigger: StateTrigger,
    context: TransitionGuardContext
  ): Promise<void> {
    const fromState = this._currentState;
    const toState = rule.to;

    // Update state
    this._previousState = fromState;
    this._currentState = toState;
    this._lastTransitionAt = new Date();
    this._stateEnteredAt = new Date();

    // State-specific initialization
    switch (toState) {
      case AgentLifecycleState.COLD_START:
        this._coldStartStartedAt = new Date();
        break;

      case AgentLifecycleState.DEGRADED:
        this._degradedEnteredAt = new Date();
        break;

      case AgentLifecycleState.OFFLINE:
        // Terminal state: cleanup
        break;
    }

    // Publish domain events
    this.raise({
      type: 'StateTransitioned',
      aggregateId: this.id,
      aggregateType: 'agent-lifecycle',
      version: ++this._version,
      timestamp: new Date(),
      payload: {
        agentId: this.agentId,
        fromState,
        toState,
        trigger,
        interactionCount: context.interactionCount,
        healthScore: context.healthScore.score
      }
    });

    // Special case events
    if (toState === AgentLifecycleState.READY && fromState === AgentLifecycleState.COLD_START) {
      const coldStartDuration = this._coldStartStartedAt
        ? Date.now() - this._coldStartStartedAt.getTime()
        : 0;

      this.raise({
        type: 'ColdStartCompleted',
        aggregateId: this.id,
        aggregateType: 'agent-lifecycle',
        version: ++this._version,
        timestamp: new Date(),
        payload: {
          agentId: this.agentId,
          interactionCount: this._interactionCount,
          finalConfidence: this._healthScore.score,
          qTableSize: 0,
          duration: coldStartDuration
        }
      });
    }

    if (toState === AgentLifecycleState.DEGRADED) {
      this.raise({
        type: 'AgentDegraded',
        aggregateId: this.id,
        aggregateType: 'agent-lifecycle',
        version: ++this._version,
        timestamp: new Date(),
        payload: {
          agentId: this.agentId,
          previousState: fromState,
          healthScore: this._healthScore.score,
          recoveryPlan: this.generateRecoveryPlan()
        }
      });
    }

    if (fromState === AgentLifecycleState.DEGRADED && toState === AgentLifecycleState.READY) {
      const recoveryDuration = this._degradedEnteredAt
        ? Date.now() - this._degradedEnteredAt.getTime()
        : 0;

      this.raise({
        type: 'AgentRecovered',
        aggregateId: this.id,
        aggregateType: 'agent-lifecycle',
        version: ++this._version,
        timestamp: new Date(),
        payload: {
          agentId: this.agentId,
          healthScore: this._healthScore.score,
          recoveryDuration
        }
      });
    }
  }

  /**
   * Generate recovery plan for degraded state
   */
  private generateRecoveryPlan(): string[] {
    const plan: string[] = [];

    if (this._healthScore.score < 0.3) {
      plan.push('emergency_memory_cleanup');
      plan.push('reset_learning_rates');
    } else {
      plan.push('prune_low_value_trajectories');
      plan.push('increase_exploration_temporarily');
    }

    if (this._consecutiveFailures > 0) {
      plan.push('analyze_failure_patterns');
      plan.push('request_federated_sync');
    }

    return plan;
  }

  /**
   * Raise domain event
   */
  private raise(event: AgentLifecycleEvent): void {
    this._events.push(event);
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  get currentState(): AgentLifecycleState {
    return this._currentState;
  }

  get previousState(): AgentLifecycleState | null {
    return this._previousState;
  }

  get healthScore(): HealthScore {
    return this._healthScore;
  }

  get interactionCount(): number {
    return this._interactionCount;
  }

  get consecutiveFailures(): number {
    return this._consecutiveFailures;
  }

  get coldStartCompleted(): boolean {
    return this._coldStartCompleted;
  }

  get oodaPhase(): string {
    return this._oodaContext.phase;
  }

  get timeInCurrentState(): number {
    return Date.now() - this._stateEnteredAt.getTime();
  }

  get version(): number {
    return this._version;
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
  static fromHistory(events: AgentLifecycleEvent[]): AutonomousStateMachine {
    if (events.length === 0) {
      throw new Error('Cannot rebuild from empty event history');
    }

    const firstEvent = events[0];
    if (!firstEvent.aggregateId.startsWith('asm-')) {
      throw new Error('Invalid event history for AutonomousStateMachine');
    }

    // Extract agent ID from aggregate ID
    const agentId = firstEvent.payload.agentId;
    const stateMachine = AutonomousStateMachine.create(agentId);
    stateMachine._events = []; // Clear initial events

    // Replay events
    for (const event of events) {
      if (event.type === 'StateTransitioned') {
        stateMachine._currentState = event.payload.toState;
        stateMachine._previousState = event.payload.fromState;
        stateMachine._lastTransitionAt = event.timestamp;
        stateMachine._stateEnteredAt = event.timestamp;
        stateMachine._version = event.version;

        if (event.payload.interactionCount !== undefined) {
          stateMachine._interactionCount = event.payload.interactionCount;
        }
        if (event.payload.healthScore !== undefined) {
          stateMachine._healthScore = HealthScore.create(event.payload.healthScore);
        }
      }
    }

    return stateMachine;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Check if agent is in operational state (Ready or Busy)
   */
  isOperational(): boolean {
    const stateVO = AgentLifecycleStateVO.create(this._currentState);
    return stateVO.isOperational;
  }

  /**
   * Check if agent is in healthy state
   */
  isHealthy(): boolean {
    return this._healthScore.isHealthy();
  }

  /**
   * Get state statistics
   */
  getStateStatistics(): StateStatistics {
    return {
      currentState: this._currentState,
      previousState: this._previousState,
      timeInState: this.timeInCurrentState,
      totalTransitions: this._version,
      coldStartCompleted: this._coldStartCompleted,
      healthScore: this._healthScore.score,
      interactionCount: this._interactionCount
    };
  }

  /**
   * Value equality
   */
  equals(other: AutonomousStateMachine): boolean {
    return this.id === other.id;
  }

  /**
   * String representation
   */
  toString(): string {
    return `AutonomousStateMachine(${this.id}, state=${this._currentState}, health=${this._healthScore})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      id: this.id,
      agentId: this.agentId,
      currentState: this._currentState,
      previousState: this._previousState,
      healthScore: this._healthScore.score,
      interactionCount: this._interactionCount,
      coldStartCompleted: this._coldStartCompleted,
      oodaPhase: this._oodaContext.phase,
      version: this._version
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type TransitionGuardContext,
  type TransitionRule,
  type OODAContext
};

export default AutonomousStateMachine;
