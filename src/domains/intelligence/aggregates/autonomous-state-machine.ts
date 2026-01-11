/**
 * AutonomousStateMachine Aggregate Root
 *
 * Manages agent state transitions, OODA loop execution, and Q-learning integration
 * for autonomous decision-making in the Intelligence bounded context.
 *
 * Implements the autonomous agent lifecycle:
 * - Initializing -> ColdStart -> Ready -> (Busy <-> Ready) -> Degraded -> Recovering -> Ready
 */

import { State } from '../value-objects/state';
import { Action } from '../value-objects/action';
import { Reward } from '../value-objects/reward';
import { QTable, QTableConfig } from './q-table';

/**
 * Agent States for AutonomousStateMachine
 */
export enum AgentState {
  /** Agent is initializing internal structures */
  INITIALIZING = 'initializing',

  /** Agent is learning from interactions (cold start phase) */
  COLD_START = 'cold_start',

  /** Agent is ready to process queries */
  READY = 'ready',

  /** Agent is actively processing a query */
  BUSY = 'busy',

  /** Agent performance is degraded, needs recovery */
  DEGRADED = 'degraded',

  /** Agent is recovering from degraded state */
  RECOVERING = 'recovering',

  /** Agent has encountered critical error */
  FAILED = 'failed'
}

/**
 * Configuration for AutonomousStateMachine
 */
export interface AutonomousStateMachineConfig {
  readonly agentId: string;
  readonly coldStartThreshold: number;       // Interactions before Ready (default: 100)
  readonly degradedThreshold: number;        // Health threshold for Degraded state (default: 0.5)
  readonly explorationBaseRate: number;      // Base epsilon for exploration (default: 0.1)
  readonly recoveryThreshold: number;        // Health threshold for recovery (default: 0.3)
}

/**
 * Observations from the OODA Observe phase
 */
export interface Observations {
  readonly state: State;
  readonly health: number;
  readonly successRate: number;
  readonly confidence: number;
  readonly interactionCount: number;
  readonly timestamp: Date;
}

/**
 * Orientation from the OODA Orient phase
 */
export interface Orientation {
  readonly shouldExplore: boolean;
  readonly shouldSync: boolean;
  readonly shouldRecover: boolean;
  readonly confidence: number;
  readonly explorationRate: number;
  readonly reasoning: string;
}

/**
 * Decision from the OODA Decide phase
 */
export interface Decision {
  readonly action: Action;
  readonly triggerRecovery: boolean;
  readonly triggerSync: boolean;
  readonly recoveryReason?: string;
  readonly confidence: number;
}

/**
 * Action result from the OODA Act phase
 */
export interface ActionResult {
  readonly action: Action;
  readonly success: boolean;
  readonly reward: Reward;
  readonly nextState: State | null;
  readonly timestamp: Date;
}

/**
 * Domain Events for AutonomousStateMachine
 */
export interface StateTransitionedEvent {
  readonly type: 'StateTransitioned';
  readonly machineId: string;
  readonly fromState: AgentState;
  readonly toState: AgentState;
  readonly reason?: string;
  readonly timestamp: Date;
}

export interface OODAUpdateEvent {
  readonly type: 'OODAUpdate';
  readonly machineId: string;
  readonly phase: 'observe' | 'orient' | 'decide' | 'act';
  readonly observations?: Observations;
  readonly orientation?: Orientation;
  readonly decision?: Decision;
  readonly timestamp: Date;
}

export type AutonomousStateMachineEvent = StateTransitionedEvent | OODAUpdateEvent;

/**
 * AutonomousStateMachine Aggregate Root
 *
 * Manages agent autonomous behavior through:
 * 1. State transitions based on health and experience
 * 2. OODA loop (Observe, Orient, Decide, Act) for decision-making
 * 3. Q-learning integration for action selection
 * 4. Domain event emission for external coordination
 */
export class AutonomousStateMachine {
  readonly id: string;
  readonly agentId: string;
  private _state: AgentState;
  private _qTable: QTable;
  private _config: Required<AutonomousStateMachineConfig>;
  private _events: AutonomousStateMachineEvent[];
  private _interactionCount: number;
  private _successCount: number;
  private _health: number;
  private _currentTrajectory: Array<{
    state: State;
    action: Action;
    reward: Reward;
    nextState: State | null;
    timestamp: number;
  }> | null;
  private _explorationRate: number;
  private _isBusy: boolean;

  constructor(
    id: string,
    config: AutonomousStateMachineConfig,
    qTableConfig?: QTableConfig
  ) {
    this.id = id;
    this.agentId = config.agentId;
    this._config = {
      agentId: config.agentId,
      coldStartThreshold: config.coldStartThreshold ?? 100,
      degradedThreshold: config.degradedThreshold ?? 0.5,
      explorationBaseRate: config.explorationBaseRate ?? 0.1,
      recoveryThreshold: config.recoveryThreshold ?? 0.3
    };
    this._state = AgentState.INITIALIZING;
    this._qTable = new QTable(`${id}-qtable`, config.agentId, qTableConfig);
    this._events = [];
    this._interactionCount = 0;
    this._successCount = 0;
    // Agents with knowledge start with high health (0.7)
    // This reflects that they have domain knowledge even without interactions
    this._health = 0.7;
    this._currentTrajectory = null;
    this._explorationRate = this._config.explorationBaseRate;
    this._isBusy = false;
  }

  // ==================== State Management ====================

  /**
   * Load knowledge and transition from Initializing to ColdStart
   */
  loadKnowledge(): AutonomousStateMachineEvent[] {
    if (this._state !== AgentState.INITIALIZING) {
      return [];
    }

    this.transitionTo(AgentState.COLD_START, 'Knowledge loaded');
    return this.getUncommittedEvents();
  }

  /**
   * Transition to a new state with event emission
   */
  private transitionTo(newState: AgentState, reason?: string): void {
    const fromState = this._state;

    if (fromState === newState) {
      return;
    }

    this._state = newState;

    this.raise({
      type: 'StateTransitioned',
      machineId: this.id,
      fromState,
      toState: newState,
      reason,
      timestamp: new Date()
    });
  }

  // ==================== Interaction Recording ====================

  /**
   * Record an interaction and update learning metrics
   */
  recordInteraction(state: State, action: Action, reward: Reward): void {
    this._interactionCount++;

    // Track success rate
    if (reward.total() > 0) {
      this._successCount++;
    }

    // Update health (exponential moving average)
    const rewardSignal = reward.total();
    this._health = 0.95 * this._health + 0.05 * Math.max(0, Math.min(1, rewardSignal + 1) / 2);

    // Update Q-table (use the same state as next state for terminal episodes)
    this._qTable.update(state, action, reward, state);

    // Record in trajectory if active
    if (this._currentTrajectory) {
      this._currentTrajectory.push({
        state,
        action,
        reward,
        nextState: state, // Use same state for terminal episodes
        timestamp: Date.now()
      });
    }

    // Check state transitions based on metrics
    this.checkStateTransitions();
  }

  /**
   * Check and execute state transitions based on current metrics
   */
  private checkStateTransitions(): void {
    switch (this._state) {
      case AgentState.COLD_START:
        // Transition to Ready after threshold interactions
        if (this._interactionCount >= this._config.coldStartThreshold) {
          this.transitionTo(AgentState.READY, 'Cold start threshold reached');
        }
        break;

      case AgentState.BUSY:
        // Transition back to Ready when not busy
        if (!this._isBusy) {
          this.transitionTo(AgentState.READY, 'Query completed');
        }
        break;

      case AgentState.READY:
        // Transition to Degraded if health falls below threshold
        if (this._health < this._config.degradedThreshold) {
          this.transitionTo(AgentState.DEGRADED, `Health degraded to ${this._health.toFixed(2)}`);
        }
        break;

      case AgentState.DEGRADED:
        // Transition to Recovering if health recovers
        if (this._health >= this._config.recoveryThreshold) {
          this.transitionTo(AgentState.RECOVERING, 'Health recovering');
        }
        break;

      case AgentState.RECOVERING:
        // Transition back to Ready when fully recovered
        if (this._health > this._config.degradedThreshold + 0.1) {
          this.transitionTo(AgentState.READY, 'Health restored');
        }
        break;
    }
  }

  // ==================== Query Lifecycle ====================

  /**
   * Mark the start of a query processing
   */
  startQuery(): void {
    this._isBusy = true;
    if (this._state === AgentState.READY) {
      this.transitionTo(AgentState.BUSY, 'Processing query');
    }
  }

  /**
   * Mark the completion of a query processing
   */
  completeQuery(): void {
    this._isBusy = false;
    if (this._state === AgentState.BUSY) {
      this.transitionTo(AgentState.READY, 'Query completed');
    }
  }

  // ==================== OODA Loop ====================

  /**
   * OODA Loop - Observe phase
   * Gather observations about current state and environment
   */
  observe(state: State): Observations {
    return {
      state,
      health: this._health,
      successRate: this.successRate,
      confidence: this.calculateConfidence(state),
      interactionCount: this._interactionCount,
      timestamp: new Date()
    };
  }

  /**
   * OODA Loop - Orient phase
   * Analyze observations and determine strategy
   */
  orient(observations: Observations): Orientation {
    const shouldExplore = observations.successRate < 0.7;
    const shouldSync = observations.confidence < 0.6;
    const shouldRecover = observations.health < this._config.recoveryThreshold;

    // Adjust exploration rate based on success
    let explorationRate = this._explorationRate;
    if (shouldExplore) {
      explorationRate = Math.min(1.0, explorationRate * 1.5);
    } else {
      explorationRate = Math.max(0.01, explorationRate * 0.99);
    }
    this._explorationRate = explorationRate;

    const reasoning = [
      shouldExplore ? 'Low success rate, increasing exploration' : 'Good success rate, exploiting knowledge',
      shouldSync ? 'Low confidence, requesting federated sync' : 'Confidence adequate',
      shouldRecover ? 'Health critical, triggering recovery' : 'Health normal'
    ].join('. ');

    return {
      shouldExplore,
      shouldSync,
      shouldRecover,
      confidence: observations.confidence,
      explorationRate,
      reasoning
    };
  }

  /**
   * OODA Loop - Decide phase
   * Select action based on orientation and Q-learning
   */
  decide(state: State, orientation?: Orientation): Decision {
    const currentOrientation = orientation ?? this.orient(this.observe(state));

    // Check if recovery is needed
    if (currentOrientation.shouldRecover &&
        (this._state === AgentState.DEGRADED || this._state === AgentState.RECOVERING)) {
      return {
        action: Action.CONSULT_PEER,
        triggerRecovery: true,
        triggerSync: false,
        recoveryReason: 'Health critical, initiating recovery',
        confidence: currentOrientation.confidence
      };
    }

    // Select action using Q-learning
    const action = this._qTable.selectAction(state, currentOrientation.shouldExplore);

    return {
      action,
      triggerRecovery: false,
      triggerSync: currentOrientation.shouldSync,
      confidence: currentOrientation.confidence
    };
  }

  /**
   * OODA Loop - Act phase
   * Execute the action and return result
   */
  act(decision: Decision, state: State): ActionResult {
    const action = decision.action;

    // Simulate action execution (in real system, this would invoke the action)
    const success = !decision.triggerRecovery;
    const reward = success ? Reward.success(1.0) : Reward.failure(-0.5);

    return {
      action,
      success,
      reward,
      nextState: state, // Use same state for terminal episodes
      timestamp: new Date()
    };
  }

  /**
   * Run complete OODA loop
   */
  runOODALoop(state: State): {
    observations: Observations;
    orientation: Orientation;
    decision: Decision;
    result: ActionResult;
  } {
    // Observe
    const observations = this.observe(state);
    this.raise({
      type: 'OODAUpdate',
      machineId: this.id,
      phase: 'observe',
      observations,
      timestamp: new Date()
    });

    // Orient
    const orientation = this.orient(observations);
    this.raise({
      type: 'OODAUpdate',
      machineId: this.id,
      phase: 'orient',
      orientation,
      timestamp: new Date()
    });

    // Decide
    const decision = this.decide(state, orientation);
    this.raise({
      type: 'OODAUpdate',
      machineId: this.id,
      phase: 'decide',
      decision,
      timestamp: new Date()
    });

    // Act
    const result = this.act(decision, state);
    this.raise({
      type: 'OODAUpdate',
      machineId: this.id,
      phase: 'act',
      timestamp: new Date()
    });

    // Record the interaction
    this.recordInteraction(state, result.action, result.reward);

    return { observations, orientation, decision, result };
  }

  // ==================== Q-Learning Integration ====================

  /**
   * Select action using Q-learning with epsilon-greedy exploration
   */
  selectAction(state: State, explore?: boolean): Action {
    return this._qTable.selectAction(state, explore ?? true);
  }

  /**
   * Get Q-value for state-action pair
   */
  getQValue(state: State, action: Action): number {
    return this._qTable.lookup(state, action);
  }

  /**
   * Get confidence for state-action pair
   */
  getConfidence(state: State, action: Action): number {
    return this._qTable.getConfidence(state, action);
  }

  /**
   * Calculate overall confidence for a state
   */
  private calculateConfidence(state: State): number {
    let totalConfidence = 0;
    let actionCount = 0;

    for (const action of [Action.DIRECT_ANSWER, Action.CONTEXT_ANSWER, Action.CONSULT_PEER]) {
      const conf = this.getConfidence(state, action);
      totalConfidence += conf;
      actionCount++;
    }

    // Return baseline confidence even for unvisited states
    // Agents with knowledge should have some confidence from the start
    const avgConfidence = actionCount > 0 ? totalConfidence / actionCount : 0;
    return Math.max(0.3, avgConfidence); // Minimum 30% confidence for agents with knowledge
  }

  // ==================== Trajectory Management ====================

  /**
   * Start recording a trajectory
   */
  startTrajectory(): void {
    this._currentTrajectory = [];
  }

  /**
   * End trajectory recording and return trajectory data
   */
  endTrajectory(success: boolean) {
    if (!this._currentTrajectory || this._currentTrajectory.length === 0) {
      return null;
    }

    const trajectory = {
      agentId: this.agentId,
      steps: [...this._currentTrajectory],
      success,
      cumulativeReward: this._currentTrajectory.reduce((sum, step) => sum + step.reward.total(), 0),
      startTime: this._currentTrajectory[0]?.timestamp ?? Date.now(),
      endTime: Date.now(),
      metadata: {
        state: this._state,
        health: this._health,
        explorationRate: this._explorationRate
      }
    };

    this._currentTrajectory = null;
    return trajectory;
  }

  // ==================== Domain Events ====================

  private raise(event: AutonomousStateMachineEvent): void {
    this._events.push(event);
  }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): AutonomousStateMachineEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  // ==================== Getters ====================

  get currentState(): AgentState {
    return this._state;
  }

  get health(): number {
    return this._health;
  }

  get successRate(): number {
    return this._interactionCount > 0
      ? this._successCount / this._interactionCount
      : 0;
  }

  get explorationRate(): number {
    return this._explorationRate;
  }

  /**
   * Manually set exploration rate (for testing)
   */
  setExplorationRate(rate: number): void {
    this._explorationRate = Math.max(0, Math.min(1, rate));
  }

  get interactionCount(): number {
    return this._interactionCount;
  }

  get qTable(): QTable {
    return this._qTable;
  }

  // ==================== Equality and Representation ====================

  equals(other: AutonomousStateMachine): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `AutonomousStateMachine(${this.id}, state=${this._state}, health=${this._health.toFixed(2)})`;
  }

  toJSON(): object {
    return {
      id: this.id,
      agentId: this.agentId,
      state: this._state,
      health: this._health,
      successRate: this.successRate,
      explorationRate: this._explorationRate,
      interactionCount: this._interactionCount
    };
  }
}
