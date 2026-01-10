/**
 * QTable Aggregate Root
 *
 * Stores learned state-action values for Q-learning.
 * This is the main learning data structure for the Intelligence context.
 */

import { State } from '../value-objects/state';
import { Action, ALL_ACTIONS } from '../value-objects/action';
import { Reward } from '../value-objects/reward';
import { QEntry } from '../entities/q-entry';

export interface QTableConfig {
  readonly gamma: number;   // Discount factor (default: 0.95)
  readonly alpha: number;   // Learning rate (default: 0.1)
  readonly epsilon: number; // Exploration rate (default: 0.1)
}

export interface StateActionKey {
  readonly stateKey: string;
  readonly action: Action;
}

/**
 * Domain Events for QTable
 */
export interface QTableUpdated {
  readonly type: 'QTableUpdated';
  readonly qTableId: string;
  readonly stateKey: string;
  readonly action: Action;
  readonly newQValue: number;
  readonly timestamp: Date;
}

export interface QTableMerged {
  readonly type: 'QTableMerged';
  readonly qTableId: string;
  readonly peerId: string;
  readonly mergedEntries: number;
  readonly timestamp: Date;
}

export type QTableEvent = QTableUpdated | QTableMerged;

/**
 * QTable Aggregate Root
 */
export class QTable {
  readonly id: string;
  readonly agentId: string;
  private _gamma: number;
  private _alpha: number;
  private _epsilon: number;
  private _entries: Map<string, QEntry>;
  private _events: QTableEvent[];

  constructor(
    id: string,
    agentId: string,
    config: QTableConfig = { gamma: 0.95, alpha: 0.1, epsilon: 0.1 }
  ) {
    this.id = id;
    this.agentId = agentId;
    this._gamma = config.gamma;
    this._alpha = config.alpha;
    this._epsilon = config.epsilon;
    this._entries = new Map();
    this._events = [];
  }

  /**
   * Look up Q-value for a state-action pair
   */
  lookup(state: State, action: Action): number {
    const entry = this.getEntry(state, action);
    return entry?.qValue ?? 0;
  }

  /**
   * Get confidence for a state-action pair
   */
  getConfidence(state: State, action: Action): number {
    const entry = this.getEntry(state, action);
    return entry?.confidence ?? 0;
  }

  /**
   * Update Q-value based on experience
   */
  update(state: State, action: Action, reward: Reward, nextState: State): void {
    const key = this.makeKey(state, action);
    let entry = this._entries.get(key);

    if (!entry) {
      entry = new QEntry();
      this._entries.set(key, entry);
    }

    // Find max Q-value for next state
    const nextMaxQ = this.getMaxQ(nextState);

    // Update the entry
    entry.update(reward.total(), nextMaxQ, this._alpha, this._gamma);

    this.raise({
      type: 'QTableUpdated',
      qTableId: this.id,
      stateKey: state.toKey(),
      action,
      newQValue: entry.qValue,
      timestamp: new Date()
    });
  }

  /**
   * Select best action for a state (with epsilon-greedy exploration)
   */
  selectAction(state: State, explore: boolean = true): Action {
    // Epsilon-greedy exploration
    if (explore && Math.random() < this._epsilon) {
      return ALL_ACTIONS[Math.floor(Math.random() * ALL_ACTIONS.length)];
    }

    // Greedy selection
    return this.getBestAction(state);
  }

  /**
   * Get the best action for a state (pure exploitation)
   */
  getBestAction(state: State): Action {
    let bestAction = ALL_ACTIONS[0];
    let bestValue = Number.NEGATIVE_INFINITY;

    for (const action of ALL_ACTIONS) {
      const value = this.lookup(state, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Get maximum Q-value for a state across all actions
   */
  getMaxQ(state: State): number {
    let maxQ = Number.NEGATIVE_INFINITY;

    for (const action of ALL_ACTIONS) {
      const q = this.lookup(state, action);
      if (q > maxQ) {
        maxQ = q;
      }
    }

    return maxQ === Number.NEGATIVE_INFINITY ? 0 : maxQ;
  }

  /**
   * Merge with another Q-table (for federated learning)
   */
  merge(peerQTable: QTable): void {
    let mergedCount = 0;

    for (const [key, peerEntry] of peerQTable._entries) {
      const localEntry = this._entries.get(key);

      if (localEntry) {
        // Merge existing entries
        const mergedEntry = localEntry.merge(peerEntry);
        this._entries.set(key, mergedEntry);
      } else {
        // Add new entries from peer
        this._entries.set(key, new QEntry(
          peerEntry.qValue,
          peerEntry.visits,
          peerEntry.confidence,
          [...peerEntry.outcomes],
          peerEntry.lastUpdated
        ));
      }
      mergedCount++;
    }

    this.raise({
      type: 'QTableMerged',
      qTableId: this.id,
      peerId: peerQTable.agentId,
      mergedEntries: mergedCount,
      timestamp: new Date()
    });
  }

  /**
   * Decay epsilon over time (for annealing exploration)
   */
  decayEpsilon(factor: number = 0.995, minEpsilon: number = 0.01): void {
    this._epsilon = Math.max(minEpsilon, this._epsilon * factor);
  }

  /**
   * Get entry for state-action pair
   */
  private getEntry(state: State, action: Action): QEntry | undefined {
    return this._entries.get(this.makeKey(state, action));
  }

  /**
   * Create map key from state and action
   */
  private makeKey(state: State, action: Action): string {
    return `${state.toKey()}:${action}`;
  }

  private raise(event: QTableEvent): void {
    this._events.push(event);
  }

  // Getters
  get gamma(): number { return this._gamma; }
  get alpha(): number { return this._alpha; }
  get epsilon(): number { return this._epsilon; }
  get entryCount(): number { return this._entries.size; }

  /**
   * Get all entries as array
   */
  get entries(): Array<{ key: string; entry: QEntry }> {
    return Array.from(this._entries.entries()).map(([key, entry]) => ({ key, entry }));
  }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): QTableEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  /**
   * Identity equality
   */
  equals(other: QTable): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `QTable(${this.id}, entries=${this._entries.size}, eps=${this._epsilon.toFixed(3)})`;
  }

  toJSON(): object {
    return {
      id: this.id,
      agentId: this.agentId,
      gamma: this._gamma,
      alpha: this._alpha,
      epsilon: this._epsilon,
      entryCount: this._entries.size
    };
  }
}
