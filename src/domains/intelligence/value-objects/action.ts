/**
 * Action Value Object
 *
 * Available actions for agent decision-making in the Q-learning framework.
 */

export enum Action {
  /** Answer directly from knowledge base */
  DIRECT_ANSWER = 'direct_answer',

  /** Answer with retrieved context from vector memory */
  CONTEXT_ANSWER = 'context_answer',

  /** Seek help from another agent */
  CONSULT_PEER = 'consult_peer',

  /** Ask user for more information */
  REQUEST_CLARIFICATION = 'request_clarification',

  /** Escalate to human operator */
  ESCALATE = 'escalate',

  // ========== HANDOVER OPTIMIZATION ACTIONS (GOAL-006) ==========

  /** Increase time to trigger (for too-early HO) */
  INCREASE_TTT = 'increase_ttt',

  /** Decrease time to trigger (for too-late HO) */
  DECREASE_TTT = 'decrease_ttt',

  /** Increase hysteresis (for ping-pong or too-early HO) */
  INCREASE_HYSTERESIS = 'increase_hysteresis',

  /** Decrease hysteresis (for too-late HO) */
  DECREASE_HYSTERESIS = 'decrease_hysteresis',

  /** Increase ping-pong timer (for ping-pong detection) */
  INCREASE_PING_PONG_TIMER = 'increase_ping_pong_timer',

  /** Increase cell individual offset (for coverage holes) */
  INCREASE_CIO = 'increase_cio',

  /** Adjust A3 offset (for interference) */
  ADJUST_A3_OFFSET = 'adjust_a3_offset',

  /** Conservative adjustment (unknown root cause) */
  CONSERVATIVE = 'conservative'
}

export const ALL_ACTIONS: Action[] = [
  Action.DIRECT_ANSWER,
  Action.CONTEXT_ANSWER,
  Action.CONSULT_PEER,
  Action.REQUEST_CLARIFICATION,
  Action.ESCALATE,
  Action.INCREASE_TTT,
  Action.DECREASE_TTT,
  Action.INCREASE_HYSTERESIS,
  Action.DECREASE_HYSTERESIS,
  Action.INCREASE_PING_PONG_TIMER,
  Action.INCREASE_CIO,
  Action.ADJUST_A3_OFFSET,
  Action.CONSERVATIVE
];

export interface ActionMetadata {
  readonly action: Action;
  readonly description: string;
  readonly baseCost: number;        // Higher cost = less preferred
  readonly requiresPeer: boolean;
  readonly requiresUser: boolean;
  readonly avgLatencyMs: number;
}

export const ACTION_METADATA: Map<Action, ActionMetadata> = new Map([
  [Action.DIRECT_ANSWER, {
    action: Action.DIRECT_ANSWER,
    description: 'Answer directly from knowledge base',
    baseCost: 0,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 50
  }],
  [Action.CONTEXT_ANSWER, {
    action: Action.CONTEXT_ANSWER,
    description: 'Answer with retrieved context from vector memory',
    baseCost: 0.1,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 150
  }],
  [Action.CONSULT_PEER, {
    action: Action.CONSULT_PEER,
    description: 'Seek help from another agent',
    baseCost: 0.3,
    requiresPeer: true,
    requiresUser: false,
    avgLatencyMs: 500
  }],
  [Action.REQUEST_CLARIFICATION, {
    action: Action.REQUEST_CLARIFICATION,
    description: 'Ask user for more information',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: true,
    avgLatencyMs: 10000
  }],
  [Action.ESCALATE, {
    action: Action.ESCALATE,
    description: 'Escalate to human operator',
    baseCost: 0.5,
    requiresPeer: false,
    requiresUser: true,
    avgLatencyMs: 30000
  }],
  // Handover optimization actions (GOAL-006)
  [Action.INCREASE_TTT, {
    action: Action.INCREASE_TTT,
    description: 'Increase time to trigger (for too-early HO)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.DECREASE_TTT, {
    action: Action.DECREASE_TTT,
    description: 'Decrease time to trigger (for too-late HO)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.INCREASE_HYSTERESIS, {
    action: Action.INCREASE_HYSTERESIS,
    description: 'Increase hysteresis (for ping-pong or too-early HO)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.DECREASE_HYSTERESIS, {
    action: Action.DECREASE_HYSTERESIS,
    description: 'Decrease hysteresis (for too-late HO)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.INCREASE_PING_PONG_TIMER, {
    action: Action.INCREASE_PING_PONG_TIMER,
    description: 'Increase ping-pong timer (for ping-pong detection)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.INCREASE_CIO, {
    action: Action.INCREASE_CIO,
    description: 'Increase cell individual offset (for coverage holes)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.ADJUST_A3_OFFSET, {
    action: Action.ADJUST_A3_OFFSET,
    description: 'Adjust A3 offset (for interference)',
    baseCost: 0.2,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }],
  [Action.CONSERVATIVE, {
    action: Action.CONSERVATIVE,
    description: 'Conservative adjustment (unknown root cause)',
    baseCost: 0.1,
    requiresPeer: false,
    requiresUser: false,
    avgLatencyMs: 100
  }]
]);

/**
 * Get metadata for an action
 */
export function getActionMetadata(action: Action): ActionMetadata {
  const metadata = ACTION_METADATA.get(action);
  if (!metadata) {
    throw new Error(`Unknown action: ${action}`);
  }
  return metadata;
}

/**
 * Check if action requires peer interaction
 */
export function requiresPeer(action: Action): boolean {
  return getActionMetadata(action).requiresPeer;
}

/**
 * Check if action requires user interaction
 */
export function requiresUser(action: Action): boolean {
  return getActionMetadata(action).requiresUser;
}
