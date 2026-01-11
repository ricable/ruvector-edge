/**
 * RANOps Autonomous State Machine - Domain Model
 *
 * SPARC Phase 2: Architecture with DDD
 *
 * This module implements the core domain model for the Agent Lifecycle bounded context,
 * including the AutonomousStateMachine aggregate, value objects, entities, and domain events.
 *
 * @module domains/agent-lifecycle/autonomous-state-machine
 */

// =============================================================================
// VALUE OBJECTS
// =============================================================================

/**
 * AgentLifecycleState Value Object
 *
 * Represents the 6 states in the agent lifecycle state machine.
 */
export enum AgentLifecycleState {
  INITIALIZING = 'Initializing',
  COLD_START = 'ColdStart',
  READY = 'Ready',
  BUSY = 'Busy',
  DEGRADED = 'Degraded',
  OFFLINE = 'Offline'
}

/**
 * State transition metadata
 */
export interface StateTransition {
  readonly fromState: AgentLifecycleState;
  readonly toState: AgentLifecycleState;
  readonly trigger: string;
  readonly timestamp: Date;
  readonly guardResult?: boolean;
}

/**
 * FAJCode Value Object
 *
 * Immutable representation of Ericsson Feature Code.
 * Format: "FAJ XXX XXXX" where X is digit.
 */
export class FAJCode {
  private readonly value: string;
  private readonly VALID_PATTERN = /^FAJ\s\d{3}\s\d{4}$/;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static create(value: string): FAJCode {
    const trimmed = value.trim().toUpperCase();
    const instance = new FAJCode(trimmed);

    if (!instance.isValid()) {
      throw new Error(`Invalid FAJ code format: ${value}. Expected format: FAJ XXX XXXX`);
    }

    return instance;
  }

  private isValid(): boolean {
    return this.VALID_PATTERN.test(this.value);
  }

  get category(): string {
    const match = this.value.match(/\d{3}/);
    if (!match) return 'Unknown';

    const categoryCode = parseInt(match[0]);

    // Map FAJ category codes to feature categories
    if (categoryCode >= 100 && categoryCode < 200) return 'Radio';
    if (categoryCode >= 200 && categoryCode < 300) return 'Transport';
    if (categoryCode >= 300 && categoryCode < 400) return 'Mobility';
    if (categoryCode >= 400 && categoryCode < 500) return 'Coverage';
    if (categoryCode >= 500 && categoryCode < 600) return 'Security';
    if (categoryCode >= 120 && categoryCode < 130) return 'Energy Saving';
    if (categoryCode >= 121 && categoryCode < 122) return 'Carrier Aggregation';

    return 'Other';
  }

  get code(): string {
    return this.value;
  }

  equals(other: FAJCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): object {
    return { value: this.value, category: this.category };
  }
}

/**
 * ConfidenceScore Value Object
 *
 * Bounded confidence score [0, 1] with validation.
 */
export class ConfidenceScore {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
    Object.freeze(this);
  }

  static create(value: number): ConfidenceScore {
    if (value < 0 || value > 1) {
      throw new Error(`Confidence score must be between 0 and 1, got: ${value}`);
    }
    return new ConfidenceScore(value);
  }

  get score(): number {
    return this.value;
  }

  isLow(): boolean {
    return this.value < 0.5;
  }

  isMedium(): boolean {
    return this.value >= 0.5 && this.value < 0.8;
  }

  isHigh(): boolean {
    return this.value >= 0.8;
  }

  increase(amount: number): ConfidenceScore {
    return ConfidenceScore.create(Math.min(1, this.value + amount));
  }

  decrease(amount: number): ConfidenceScore {
    return ConfidenceScore.create(Math.max(0, this.value - amount));
  }

  equals(other: ConfidenceScore): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return `${(this.value * 100).toFixed(1)}%`;
  }

  toJSON(): object {
    return { score: this.value, percentage: `${(this.value * 100).toFixed(1)}%` };
  }
}

/**
 * HealthScore Value Object
 *
 * Agent health metric [0, 1] combining performance metrics.
 */
export class HealthScore {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
    Object.freeze(this);
  }

  static create(value: number): HealthScore {
    if (value < 0 || value > 1) {
      throw new Error(`Health score must be between 0 and 1, got: ${value}`);
    }
    return new HealthScore(value);
  }

  static fromMetrics(metrics: {
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    latency: number;
  }): HealthScore {
    const cpuScore = 1 - Math.min(1, metrics.cpuUsage / 100);
    const memoryScore = 1 - Math.min(1, metrics.memoryUsage / 100);
    const errorScore = 1 - Math.min(1, metrics.errorRate);
    const latencyScore = 1 - Math.min(1, metrics.latency / 1000);

    const overall = (cpuScore + memoryScore + errorScore + latencyScore) / 4;
    return HealthScore.create(overall);
  }

  get score(): number {
    return this.value;
  }

  isCritical(): boolean {
    return this.value < 0.3;
  }

  isWarning(): boolean {
    return this.value >= 0.3 && this.value < 0.7;
  }

  isHealthy(): boolean {
    return this.value >= 0.7;
  }

  equals(other: HealthScore): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return `${(this.value * 100).toFixed(1)}%`;
  }
}

// =============================================================================
// DOMAIN EVENTS
// =============================================================================

/**
 * Base domain event interface
 */
export interface DomainEvent {
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly timestamp: Date;
  readonly correlationId?: string;
}

/**
 * StateTransitioned Event
 *
 * Published when agent transitions between lifecycle states.
 */
export interface StateTransitionedEvent extends DomainEvent {
  readonly type: 'StateTransitioned';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly fromState: AgentLifecycleState;
    readonly toState: AgentLifecycleState;
    readonly trigger: string;
    readonly interactionCount?: number;
    readonly healthScore?: number;
  };
}

/**
 * AutonomousDecisionMade Event
 *
 * Published when agent makes autonomous action decision via OODA.
 */
export interface AutonomousDecisionMadeEvent extends DomainEvent {
  readonly type: 'AutonomousDecisionMade';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly currentState: AgentLifecycleState;
    readonly contextState: string; // OODA context
    readonly action: string; // Selected action
    readonly confidence: number;
    readonly qValue: number;
    readonly reasoning: string;
  };
}

/**
 * ColdStartCompleted Event
 *
 * Published when agent completes cold start phase.
 */
export interface ColdStartCompletedEvent extends DomainEvent {
  readonly type: 'ColdStartCompleted';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly interactionCount: number;
    readonly finalConfidence: number;
    readonly qTableSize: number;
    readonly duration: number; // milliseconds
  };
}

/**
 * HealthThresholdBreached Event
 *
 * Published when agent health drops below threshold.
 */
export interface HealthThresholdBreachedEvent extends DomainEvent {
  readonly type: 'HealthThresholdBreached';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly healthScore: number;
    readonly threshold: number;
    readonly reason: string;
    readonly metrics: {
      cpuUsage: number;
      memoryUsage: number;
      errorRate: number;
      latency: number;
    };
  };
}

/**
 * AgentDegraded Event
 *
 * Published when agent enters Degraded state.
 */
export interface AgentDegradedEvent extends DomainEvent {
  readonly type: 'AgentDegraded';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly previousState: AgentLifecycleState;
    readonly healthScore: number;
    readonly recoveryPlan: string[];
  };
}

/**
 * AgentRecovered Event
 *
 * Published when agent recovers from Degraded state.
 */
export interface AgentRecoveredEvent extends DomainEvent {
  readonly type: 'AgentRecovered';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly healthScore: number;
    readonly recoveryDuration: number; // milliseconds
  };
}

export type AgentLifecycleEvent =
  | StateTransitionedEvent
  | AutonomousDecisionMadeEvent
  | ColdStartCompletedEvent
  | HealthThresholdBreachedEvent
  | AgentDegradedEvent
  | AgentRecoveredEvent;

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * AutonomousStateMachine Configuration
 */
export interface AutonomousStateMachineConfig {
  readonly coldStartThreshold: number; // Interactions before Ready
  readonly healthWarningThreshold: number; // Health < 0.7 -> Warning
  readonly healthCriticalThreshold: number; // Health < 0.5 -> Degraded
  readonly recoveryThreshold: number; // Health > 0.8 -> Recovered
  readonly maxConsecutiveFailures: number;
  readonly observationWindowMs: number; // OODA observation window
}

export const DEFAULT_STATE_MACHINE_CONFIG: AutonomousStateMachineConfig = {
  coldStartThreshold: 100,
  healthWarningThreshold: 0.7,
  healthCriticalThreshold: 0.5,
  recoveryThreshold: 0.8,
  maxConsecutiveFailures: 5,
  observationWindowMs: 5000 // 5 seconds
};

// =============================================================================
// AGGREGATE ROOT: AutonomousStateMachine
// =============================================================================

/**
 * State transition rule
 */
interface TransitionRule {
  readonly from: AgentLifecycleState;
  readonly to: AgentLifecycleState;
  readonly trigger: string;
  readonly guard?: (context: StateMachineContext) => boolean;
  readonly sideEffect?: () => void | Promise<void>;
}

/**
 * State machine context for guard conditions
 */
interface StateMachineContext {
  readonly interactionCount: number;
  readonly healthScore: HealthScore;
  readonly consecutiveFailures: number;
  readonly knowledgeLoaded: boolean;
  readonly shutdownRequested: boolean;
  readonly currentQuery?: string;
}

/**
 * OODA Loop Phase
 */
enum OODAPhase {
  OBSERVE = 'Observe',
  ORIENT = 'Orient',
  DECIDE = 'Decide',
  ACT = 'Act'
}

/**
 * OODA Context for decision making
 */
interface OODAContext {
  readonly phase: OODAPhase;
  readonly observations: Map<string, unknown>;
  readonly orientation: {
    currentState: AgentLifecycleState;
    healthTrend: 'improving' | 'stable' | 'declining';
    recentSuccesses: number;
    recentFailures: number;
  };
  readonly decision?: {
    action: string;
    confidence: number;
    reasoning: string;
  };
}

/**
 * AutonomousStateMachine Aggregate Root
 *
 * Implements the 6-state lifecycle machine with OODA loop for autonomous decision making.
 * Integrates with Q-learning for action selection and state-based policy.
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
  private _oodaPhase: OODAPhase;

  // Timing
  private _stateEnteredAt: Date;
  private _lastTransitionAt: Date;
  private _coldStartStartedAt: Date | null;
  private _degradedEnteredAt: Date | null;

  // Event sourcing
  private _events: AgentLifecycleEvent[];
  private _version: number;

  // Transition rules (state machine definition)
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
      guard: (ctx) => ctx.interactionCount >= 100,
      sideEffect: (self: AutonomousStateMachine) => {
        self._coldStartCompleted = true;
      }
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
      guard: (ctx) => ctx.currentQuery !== undefined
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
    this._oodaPhase = OODAPhase.OBSERVE;
    this._oodaContext = {
      phase: OODAPhase.OBSERVE,
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
   * Check if transition to target state is valid
   */
  canTransitionTo(targetState: AgentLifecycleState): boolean {
    return AutonomousStateMachine.TRANSITION_RULES.some(
      rule => rule.from === this._currentState && rule.to === targetState
    );
  }

  /**
   * Execute state transition by trigger
   */
  async transition(trigger: string, context?: Partial<StateMachineContext>): Promise<void> {
    const rule = this.findTransitionRule(trigger);

    if (!rule) {
      throw new Error(
        `Invalid transition trigger '${trigger}' from state '${this._currentState}'`
      );
    }

    // Build guard context
    const guardContext: StateMachineContext = {
      interactionCount: context?.interactionCount ?? this._interactionCount,
      healthScore: context?.healthScore ?? this._healthScore,
      consecutiveFailures: context?.consecutiveFailures ?? this._consecutiveFailures,
      knowledgeLoaded: context?.knowledgeLoaded ?? this._knowledgeLoaded,
      shutdownRequested: context?.shutdownRequested ?? this._shutdownRequested,
      currentQuery: context?.currentQuery
    };

    // Check guard condition
    if (rule.guard && !rule.guard(guardContext)) {
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

    await this.transition('query_received', { currentQuery: queryId });
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

    this._oodaPhase = OODAPhase.OBSERVE;
    this._oodaContext.observations = observations;

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

    this._oodaPhase = OODAPhase.ORIENT;
    this._oodaContext.orientation = {
      currentState: this._currentState,
      healthTrend: this._oodaContext.orientation.healthTrend,
      recentSuccesses: this._oodaContext.orientation.recentSuccesses,
      recentFailures: this._oodaContext.orientation.recentFailures
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
   *
   * This integrates with Q-learning for action selection.
   * The state machine provides context for Q-table state encoding.
   */
  private async decide(orientation: Awaited<ReturnType<typeof this.orient>>): Promise<{
    action: string;
    confidence: number;
    reasoning: string;
    qValue?: number;
  }> {
    this._oodaPhase = OODAPhase.DECIDE;

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
    this._oodaContext.decision = {
      action,
      confidence,
      reasoning
    };

    return { action, confidence, reasoning };
  }

  /**
   * ACT: Execute the decided action
   */
  private async act(decision: Awaited<ReturnType<typeof this.decide>>): Promise<void> {
    this._oodaPhase = OODAPhase.ACT;

    // Execute action based on decision
    switch (decision.action) {
      case 'explore':
        // Increase exploration rate (handled by Q-learning)
        break;

      case 'exploit':
        // Decrease exploration rate (handled by Q-learning)
        break;

      case 'increase_exploration':
        // Reset consecutive failures
        this._consecutiveFailures = 0;
        break;

      case 'execute_recovery_plan':
        // Recovery plan is executed by external handlers
        break;

      case 'continue_query':
        // No action needed, query continues
        break;

      case 'maintain':
        // No action needed
        break;
    }

    // Update OODA context
    this._oodaContext.decision = {
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Find transition rule by trigger
   */
  private findTransitionRule(trigger: string): TransitionRule | undefined {
    return AutonomousStateMachine.TRANSITION_RULES.find(
      rule => rule.from === this._currentState && rule.trigger === trigger
    );
  }

  /**
   * Execute state transition
   */
  private async executeTransition(
    rule: TransitionRule,
    trigger: string,
    context: StateMachineContext
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

    // Execute side effect if defined
    if (rule.sideEffect) {
      await rule.sideEffect(this);
    }

    // Publish domain events
    this.raise({
      type: 'StateTransitioned',
      aggregateId: this.id,
      aggregateType: 'agent-lifecycle',
      version: ++this._version,
      timestamp: new Date(),
      payload: {
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
          interactionCount: this._interactionCount,
          finalConfidence: this._healthScore.score,
          qTableSize: 0, // Will be provided by Q-table aggregate
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

  get oodaPhase(): OODAPhase {
    return this._oodaPhase;
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
    // Extract agent ID from first event
    const firstEvent = events[0];
    if (!firstEvent) {
      throw new Error('Cannot rebuild from empty event history');
    }

    const agentId = firstEvent.aggregateId.replace(/^asm-/, '').split('-')[0];
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
    return (
      this._currentState === AgentLifecycleState.READY ||
      this._currentState === AgentLifecycleState.BUSY
    );
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
  getStateStatistics(): {
    currentState: AgentLifecycleState;
    timeInState: number;
    totalTransitions: number;
    coldStartCompleted: boolean;
    healthScore: number;
    interactionCount: number;
  } {
    return {
      currentState: this._currentState,
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
      oodaPhase: this._oodaPhase,
      version: this._version
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type StateMachineContext,
  type OODAContext,
  type TransitionRule
};

export default AutonomousStateMachine;
