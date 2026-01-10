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
  ESCALATE = 'escalate'
}

export const ALL_ACTIONS: Action[] = [
  Action.DIRECT_ANSWER,
  Action.CONTEXT_ANSWER,
  Action.CONSULT_PEER,
  Action.REQUEST_CLARIFICATION,
  Action.ESCALATE
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
