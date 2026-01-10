/**
 * Q-Table
 * Tabular Q-Learning implementation with state-action value storage
 */

import type {
  State,
  Action,
  StateActionKey,
  QValueEntry,
  QTableData,
  QLearningConfig,
  QTableUpdatedEvent,
  ActionSelectedEvent,
} from '../types';
import { StateEncoder } from './state-encoder';

/** Q-Table event callback type */
export type QTableEventCallback = (event: QTableUpdatedEvent | ActionSelectedEvent) => void;

const DEFAULT_CONFIG: QLearningConfig = {
  alpha: 0.1,      // Learning rate
  gamma: 0.95,     // Discount factor
  epsilon: 0.1,    // Exploration rate
  initialQValue: 0.0,
};

/**
 * QTable implements the Q-Learning algorithm with tabular storage
 * Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
 */
export class QTable {
  private readonly entries: Map<StateActionKey, QValueEntry>;
  private readonly config: QLearningConfig;
  private readonly encoder: StateEncoder;
  private readonly agentId: string;
  private version: number;
  private readonly createdAt: number;
  private updatedAt: number;
  private eventListeners: QTableEventCallback[];
  private explorationEnabled: boolean;

  constructor(
    agentId: string,
    config: Partial<QLearningConfig> = {},
    encoder?: StateEncoder
  ) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.encoder = encoder ?? new StateEncoder();
    this.entries = new Map();
    this.version = 0;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.eventListeners = [];
    this.explorationEnabled = true;
  }

  /**
   * Get Q-value for a state-action pair
   */
  getQValue(state: State, action: Action): number {
    const key = this.encoder.encodeStateAction(state, action);
    const entry = this.entries.get(key);
    return entry?.value ?? this.config.initialQValue;
  }

  /**
   * Get Q-value entry with metadata
   */
  getQValueEntry(state: State, action: Action): QValueEntry | null {
    const key = this.encoder.encodeStateAction(state, action);
    return this.entries.get(key) ?? null;
  }

  /**
   * Get all Q-values for a state
   */
  getQValuesForState(state: State): Map<Action, number> {
    const actions = this.encoder.getAllActions();
    const qValues = new Map<Action, number>();

    for (const action of actions) {
      qValues.set(action, this.getQValue(state, action));
    }

    return qValues;
  }

  /**
   * Select action using epsilon-greedy policy
   */
  selectAction(state: State, forceExplore: boolean = false): { action: Action; isExploration: boolean } {
    const shouldExplore = this.explorationEnabled &&
      (forceExplore || Math.random() < this.config.epsilon);

    let action: Action;
    let isExploration: boolean;

    if (shouldExplore) {
      // Exploration: random action
      const actions = this.encoder.getAllActions();
      action = actions[Math.floor(Math.random() * actions.length)];
      isExploration = true;
    } else {
      // Exploitation: best action
      action = this.getBestAction(state);
      isExploration = false;
    }

    // Emit action selected event
    this.emitEvent({
      type: 'action_selected',
      timestamp: Date.now(),
      agentId: this.agentId,
      state,
      action,
      qValue: this.getQValue(state, action),
      isExploration,
    });

    return { action, isExploration };
  }

  /**
   * Get best action for a state (greedy selection)
   */
  getBestAction(state: State): Action {
    const actions = this.encoder.getAllActions();
    let bestAction = actions[0];
    let bestValue = this.getQValue(state, bestAction);

    for (let i = 1; i < actions.length; i++) {
      const value = this.getQValue(state, actions[i]);
      if (value > bestValue) {
        bestValue = value;
        bestAction = actions[i];
      }
    }

    return bestAction;
  }

  /**
   * Get maximum Q-value for a state
   */
  getMaxQValue(state: State): number {
    const qValues = this.getQValuesForState(state);
    return Math.max(...qValues.values());
  }

  /**
   * Update Q-value using Q-Learning update rule
   * Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
   */
  update(
    state: State,
    action: Action,
    reward: number,
    nextState: State | null
  ): number {
    const key = this.encoder.encodeStateAction(state, action);
    const currentEntry = this.entries.get(key);
    const currentQ = currentEntry?.value ?? this.config.initialQValue;
    const currentVisits = currentEntry?.visits ?? 0;

    // Calculate max Q(s', a') for next state
    const maxNextQ = nextState !== null ? this.getMaxQValue(nextState) : 0;

    // Q-Learning update rule
    const tdTarget = reward + this.config.gamma * maxNextQ;
    const tdError = tdTarget - currentQ;
    const newQ = currentQ + this.config.alpha * tdError;

    // Update entry
    const newEntry: QValueEntry = {
      value: newQ,
      visits: currentVisits + 1,
      lastUpdated: Date.now(),
    };
    this.entries.set(key, newEntry);

    // Update metadata
    this.version++;
    this.updatedAt = Date.now();

    // Emit update event
    this.emitEvent({
      type: 'q_table_updated',
      timestamp: Date.now(),
      agentId: this.agentId,
      stateActionKey: key,
      oldValue: currentQ,
      newValue: newQ,
      reward,
    });

    return newQ;
  }

  /**
   * Batch update from trajectory
   */
  updateFromTrajectory(
    steps: Array<{ state: State; action: Action; reward: number; nextState: State | null }>
  ): void {
    for (const step of steps) {
      this.update(step.state, step.action, step.reward, step.nextState);
    }
  }

  /**
   * Set Q-value directly (used for federated merging)
   */
  setQValue(state: State, action: Action, value: number, visits: number = 1): void {
    const key = this.encoder.encodeStateAction(state, action);
    const existingEntry = this.entries.get(key);

    this.entries.set(key, {
      value,
      visits: existingEntry ? existingEntry.visits + visits : visits,
      lastUpdated: Date.now(),
    });

    this.version++;
    this.updatedAt = Date.now();
  }

  /**
   * Import entries from another Q-Table (for federated merging)
   */
  importEntries(entries: Map<StateActionKey, QValueEntry>): void {
    for (const [key, entry] of entries) {
      this.entries.set(key, { ...entry });
    }
    this.version++;
    this.updatedAt = Date.now();
  }

  /**
   * Get all entries (for federated sync)
   */
  getAllEntries(): Map<StateActionKey, QValueEntry> {
    return new Map(this.entries);
  }

  /**
   * Get entries modified since timestamp
   */
  getEntriesSince(since: number): Map<StateActionKey, QValueEntry> {
    const result = new Map<StateActionKey, QValueEntry>();
    for (const [key, entry] of this.entries) {
      if (entry.lastUpdated > since) {
        result.set(key, entry);
      }
    }
    return result;
  }

  /**
   * Get Q-Table data for serialization
   */
  toData(): QTableData {
    return {
      entries: new Map(this.entries),
      version: this.version,
      agentId: this.agentId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Load Q-Table from data
   */
  static fromData(data: QTableData, config?: Partial<QLearningConfig>): QTable {
    const qTable = new QTable(data.agentId, config);
    qTable.importEntries(data.entries);
    return qTable;
  }

  /**
   * Enable or disable exploration
   */
  setExplorationEnabled(enabled: boolean): void {
    this.explorationEnabled = enabled;
  }

  /**
   * Update epsilon (exploration rate)
   */
  setEpsilon(epsilon: number): void {
    this.config.epsilon = Math.max(0, Math.min(1, epsilon));
  }

  /**
   * Decay epsilon for exploration annealing
   */
  decayEpsilon(decayRate: number = 0.995, minEpsilon: number = 0.01): void {
    this.config.epsilon = Math.max(minEpsilon, this.config.epsilon * decayRate);
  }

  /**
   * Add event listener
   */
  addEventListener(callback: QTableEventCallback): void {
    this.eventListeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: QTableEventCallback): void {
    const index = this.eventListeners.indexOf(callback);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: QTableUpdatedEvent | ActionSelectedEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in Q-Table event listener:', error);
      }
    }
  }

  /**
   * Get statistics about the Q-Table
   */
  getStats(): {
    entryCount: number;
    version: number;
    avgQValue: number;
    maxQValue: number;
    minQValue: number;
    totalVisits: number;
    avgVisitsPerEntry: number;
    epsilon: number;
    alpha: number;
    gamma: number;
  } {
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    let totalVisits = 0;

    for (const entry of this.entries.values()) {
      sum += entry.value;
      max = Math.max(max, entry.value);
      min = Math.min(min, entry.value);
      totalVisits += entry.visits;
    }

    const entryCount = this.entries.size;
    const avgQValue = entryCount > 0 ? sum / entryCount : 0;
    const avgVisitsPerEntry = entryCount > 0 ? totalVisits / entryCount : 0;

    return {
      entryCount,
      version: this.version,
      avgQValue,
      maxQValue: entryCount > 0 ? max : 0,
      minQValue: entryCount > 0 ? min : 0,
      totalVisits,
      avgVisitsPerEntry,
      epsilon: this.config.epsilon,
      alpha: this.config.alpha,
      gamma: this.config.gamma,
    };
  }

  /**
   * Clear all entries (for reset)
   */
  clear(): void {
    this.entries.clear();
    this.version++;
    this.updatedAt = Date.now();
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get version
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get encoder
   */
  getEncoder(): StateEncoder {
    return this.encoder;
  }
}
