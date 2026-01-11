/**
 * AgentLifecycleState Value Object
 *
 * Represents the 6 states in the agent lifecycle state machine.
 * Immutable value object with state transition validation.
 */

/**
 * Agent lifecycle states
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
 * Valid state transitions map
 */
const VALID_TRANSITIONS: ReadonlyMap<AgentLifecycleState, ReadonlySet<AgentLifecycleState>> = new Map([
  [AgentLifecycleState.INITIALIZING, new Set([AgentLifecycleState.COLD_START, AgentLifecycleState.OFFLINE])],
  [AgentLifecycleState.COLD_START, new Set([AgentLifecycleState.READY, AgentLifecycleState.OFFLINE])],
  [AgentLifecycleState.READY, new Set([AgentLifecycleState.BUSY, AgentLifecycleState.DEGRADED, AgentLifecycleState.OFFLINE])],
  [AgentLifecycleState.BUSY, new Set([AgentLifecycleState.READY, AgentLifecycleState.DEGRADED, AgentLifecycleState.OFFLINE])],
  [AgentLifecycleState.DEGRADED, new Set([AgentLifecycleState.READY, AgentLifecycleState.OFFLINE])],
  [AgentLifecycleState.OFFLINE, new Set([])] // Terminal state
]);

/**
 * State metadata
 */
export interface StateMetadata {
  readonly isTerminal: boolean;
  readonly isOperational: boolean;
  readonly canHandleQueries: boolean;
  readonly allowsLearning: boolean;
}

/**
 * State metadata mapping
 */
const STATE_METADATA: ReadonlyMap<AgentLifecycleState, StateMetadata> = new Map([
  [AgentLifecycleState.INITIALIZING, {
    isTerminal: false,
    isOperational: false,
    canHandleQueries: false,
    allowsLearning: false
  }],
  [AgentLifecycleState.COLD_START, {
    isTerminal: false,
    isOperational: true,
    canHandleQueries: true,
    allowsLearning: true
  }],
  [AgentLifecycleState.READY, {
    isTerminal: false,
    isOperational: true,
    canHandleQueries: true,
    allowsLearning: true
  }],
  [AgentLifecycleState.BUSY, {
    isTerminal: false,
    isOperational: true,
    canHandleQueries: false, // Already handling a query
    allowsLearning: true
  }],
  [AgentLifecycleState.DEGRADED, {
    isTerminal: false,
    isOperational: false,
    canHandleQueries: false,
    allowsLearning: false
  }],
  [AgentLifecycleState.OFFLINE, {
    isTerminal: true,
    isOperational: false,
    canHandleQueries: false,
    allowsLearning: false
  }]
]);

/**
 * AgentLifecycleState Value Object
 *
 * Provides state validation, transition checking, and metadata access.
 */
export class AgentLifecycleStateVO {
  private readonly value: AgentLifecycleState;

  private constructor(value: AgentLifecycleState) {
    this.value = value;
    Object.freeze(this);
  }

  /**
   * Create from enum value
   */
  static create(state: AgentLifecycleState): AgentLifecycleStateVO {
    return new AgentLifecycleStateVO(state);
  }

  /**
   * Create from string
   */
  static fromString(value: string): AgentLifecycleStateVO {
    const upperValue = value.toUpperCase().replace(/\s/g, '_');

    // Map common string variations to enum values
    const stateMap: Record<string, AgentLifecycleState> = {
      'INITIALIZING': AgentLifecycleState.INITIALIZING,
      'COLD_START': AgentLifecycleState.COLD_START,
      'COLDSTART': AgentLifecycleState.COLD_START,
      'READY': AgentLifecycleState.READY,
      'BUSY': AgentLifecycleState.BUSY,
      'DEGRADED': AgentLifecycleState.DEGRADED,
      'OFFLINE': AgentLifecycleState.OFFLINE
    };

    const state = stateMap[upperValue];
    if (!state) {
      throw new Error(`Invalid agent lifecycle state: ${value}`);
    }

    return new AgentLifecycleStateVO(state);
  }

  /**
   * Check if transition to target state is valid
   */
  canTransitionTo(target: AgentLifecycleStateVO): boolean {
    const validTargets = VALID_TRANSITIONS.get(this.value);
    return validTargets?.has(target.value) ?? false;
  }

  /**
   * Get all valid next states
   */
  getValidTransitions(): AgentLifecycleStateVO[] {
    const validTargets = VALID_TRANSITIONS.get(this.value);
    return Array.from(validTargets ?? []).map(s => AgentLifecycleStateVO.create(s));
  }

  /**
   * Check if this is a terminal state
   */
  get isTerminal(): boolean {
    return STATE_METADATA.get(this.value)?.isTerminal ?? false;
  }

  /**
   * Check if this is an operational state (can participate in swarm)
   */
  get isOperational(): boolean {
    return STATE_METADATA.get(this.value)?.isOperational ?? false;
  }

  /**
   * Check if agent can handle queries in this state
   */
  get canHandleQueries(): boolean {
    return STATE_METADATA.get(this.value)?.canHandleQueries ?? false;
  }

  /**
   * Check if learning is allowed in this state
   */
  get allowsLearning(): boolean {
    return STATE_METADATA.get(this.value)?.allowsLearning ?? false;
  }

  /**
   * Get the enum value
   */
  get enumValue(): AgentLifecycleState {
    return this.value;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return this.value;
  }

  /**
   * Value equality
   */
  equals(other: AgentLifecycleStateVO): boolean {
    return this.value === other.value;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      state: this.value,
      isTerminal: this.isTerminal,
      isOperational: this.isOperational,
      canHandleQueries: this.canHandleQueries,
      allowsLearning: this.allowsLearning
    };
  }
}
