/**
 * ELEX Edge AI Agent Swarm - Q-Table Implementation
 *
 * Q-learning state-action value table for agent self-improvement.
 * Implements the Q-learning update rule:
 * Q(s,a) <- Q(s,a) + alpha[r + gamma * max(Q(s',a')) - Q(s,a)]
 */

import type {
  State,
  Reward,
  QValue,
  QEntry,
  ConfidenceScore,
  DiscountFactor,
  LearningRate,
  ExplorationRate,
} from '../types/index.js';
import { Action, calculateTotalReward } from '../types/index.js';

/**
 * Q-Table configuration
 */
export interface QTableConfig {
  gamma?: DiscountFactor;   // Discount factor (default: 0.95)
  alpha?: LearningRate;     // Learning rate (default: 0.1)
  epsilon?: ExplorationRate; // Exploration rate (default: 0.1)
  epsilonDecay?: number;    // Epsilon decay rate (default: 0.995)
  minEpsilon?: number;      // Minimum epsilon (default: 0.01)
}

/**
 * State-Action key generator
 */
function createStateActionKey(state: State, action: Action): string {
  return `${state.queryType}:${state.complexity}:${state.contextHash}:${action}`;
}

/**
 * State key generator (for max Q value lookup)
 */
function createStateKey(state: State): string {
  return `${state.queryType}:${state.complexity}:${state.contextHash}`;
}

/**
 * Q-Table
 *
 * Maintains state-action values for Q-learning.
 * Features:
 * - Epsilon-greedy action selection
 * - Adaptive learning rate
 * - Confidence tracking
 * - Federated merge support
 */
export class QTable {
  private readonly config: Required<QTableConfig>;

  // Q-values storage: state-action key -> QEntry
  private readonly entries = new Map<string, QEntry>();

  // State index: state key -> Set of action keys
  private readonly stateIndex = new Map<string, Set<string>>();

  // Current epsilon for exploration
  private currentEpsilon: ExplorationRate;

  // Statistics
  private totalUpdates: number = 0;
  private totalSelections: number = 0;

  constructor(config: QTableConfig = {}) {
    this.config = {
      gamma: config.gamma ?? 0.95,
      alpha: config.alpha ?? 0.1,
      epsilon: config.epsilon ?? 0.1,
      epsilonDecay: config.epsilonDecay ?? 0.995,
      minEpsilon: config.minEpsilon ?? 0.01,
    };

    this.currentEpsilon = this.config.epsilon;
  }

  /**
   * Initialize the Q-table (async for compatibility)
   */
  async initialize(): Promise<void> {
    // Pre-populate with initial Q-values for all actions
    // This helps with cold start
  }

  /**
   * Select action using epsilon-greedy policy
   */
  async selectAction(state: State): Promise<Action> {
    this.totalSelections++;

    // Epsilon-greedy exploration
    if (Math.random() < this.currentEpsilon) {
      return this.randomAction();
    }

    // Exploit: choose best action
    return this.bestAction(state);
  }

  /**
   * Get the best action for a state (greedy)
   */
  bestAction(state: State): Action {
    const stateKey = createStateKey(state);
    const actionKeys = this.stateIndex.get(stateKey);

    if (!actionKeys || actionKeys.size === 0) {
      // No experience, return default action
      return Action.DirectAnswer;
    }

    let bestAction: Action = Action.DirectAnswer;
    let bestValue = -Infinity;

    for (const actionKey of actionKeys) {
      const entry = this.entries.get(actionKey);
      if (entry && entry.qValue > bestValue) {
        bestValue = entry.qValue;
        // Extract action from key
        const parts = actionKey.split(':');
        bestAction = parts[parts.length - 1] as Action;
      }
    }

    return bestAction;
  }

  /**
   * Lookup Q-value for a state-action pair
   */
  lookup(state: State, action: Action): QValue {
    const key = createStateActionKey(state, action);
    const entry = this.entries.get(key);
    return entry?.qValue ?? 0;
  }

  /**
   * Update Q-value using Q-learning rule
   */
  update(state: State, action: Action, reward: Reward, nextState: State): void {
    const key = createStateActionKey(state, action);
    const stateKey = createStateKey(state);
    const totalReward = calculateTotalReward(reward);

    // Get or create entry
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        qValue: 0,
        visits: 0,
        confidence: 0,
        outcomes: { successes: 0, failures: 0, totalReward: 0 },
        lastUpdated: Date.now(),
      };
      this.entries.set(key, entry);

      // Update state index
      if (!this.stateIndex.has(stateKey)) {
        this.stateIndex.set(stateKey, new Set());
      }
      this.stateIndex.get(stateKey)!.add(key);
    }

    // Calculate max Q(s', a')
    const maxNextQ = this.maxQValue(nextState);

    // Q-learning update
    const oldQ = entry.qValue;
    const newQ = oldQ + this.config.alpha * (totalReward + this.config.gamma * maxNextQ - oldQ);

    // Update entry
    entry.qValue = newQ;
    entry.visits++;
    entry.lastUpdated = Date.now();
    entry.outcomes.totalReward += totalReward;

    if (totalReward > 0) {
      entry.outcomes.successes++;
    } else if (totalReward < 0) {
      entry.outcomes.failures++;
    }

    // Update confidence based on visits
    entry.confidence = this.calculateConfidence(entry.visits);

    // Decay epsilon
    this.decayEpsilon();

    this.totalUpdates++;
  }

  /**
   * Get confidence for a state-action pair
   */
  getConfidence(state: State, action: Action): ConfidenceScore {
    const key = createStateActionKey(state, action);
    const entry = this.entries.get(key);
    return entry?.confidence ?? 0;
  }

  /**
   * Get average confidence across all entries
   */
  getAverageConfidence(): ConfidenceScore {
    if (this.entries.size === 0) {
      return 0.5;
    }

    let totalConfidence = 0;
    for (const entry of this.entries.values()) {
      totalConfidence += entry.confidence;
    }

    return totalConfidence / this.entries.size;
  }

  /**
   * Merge with peer Q-table using weighted average
   */
  merge(peerEntries: Map<string, QEntry>): void {
    for (const [key, peerEntry] of peerEntries) {
      const localEntry = this.entries.get(key);

      if (!localEntry) {
        // New entry from peer
        this.entries.set(key, { ...peerEntry });

        // Update state index
        const parts = key.split(':');
        const stateKey = parts.slice(0, -1).join(':');
        if (!this.stateIndex.has(stateKey)) {
          this.stateIndex.set(stateKey, new Set());
        }
        this.stateIndex.get(stateKey)!.add(key);
      } else {
        // Merge using weighted average
        const totalVisits = localEntry.visits + peerEntry.visits;
        if (totalVisits > 0) {
          const mergedQ =
            (localEntry.qValue * localEntry.visits + peerEntry.qValue * peerEntry.visits) /
            totalVisits;

          // Only merge if significant difference
          const difference = Math.abs(localEntry.qValue - peerEntry.qValue);
          if (difference > 0.1) {
            localEntry.qValue = mergedQ;
            localEntry.visits = Math.max(localEntry.visits, peerEntry.visits);
            localEntry.confidence = this.calculateConfidence(localEntry.visits);
            localEntry.lastUpdated = Date.now();

            // Merge outcomes
            localEntry.outcomes.successes += peerEntry.outcomes.successes;
            localEntry.outcomes.failures += peerEntry.outcomes.failures;
            localEntry.outcomes.totalReward += peerEntry.outcomes.totalReward;
          }
        }
      }
    }
  }

  /**
   * Export entries for federated sync
   */
  export(): Map<string, QEntry> {
    return new Map(this.entries);
  }

  /**
   * Get Q-table statistics
   */
  getStats(): {
    totalEntries: number;
    totalUpdates: number;
    totalSelections: number;
    currentEpsilon: number;
    averageQValue: number;
    averageVisits: number;
  } {
    let totalQ = 0;
    let totalVisits = 0;

    for (const entry of this.entries.values()) {
      totalQ += entry.qValue;
      totalVisits += entry.visits;
    }

    const count = this.entries.size || 1;

    return {
      totalEntries: this.entries.size,
      totalUpdates: this.totalUpdates,
      totalSelections: this.totalSelections,
      currentEpsilon: this.currentEpsilon,
      averageQValue: totalQ / count,
      averageVisits: totalVisits / count,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.stateIndex.clear();
    this.currentEpsilon = this.config.epsilon;
    this.totalUpdates = 0;
    this.totalSelections = 0;
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Get maximum Q-value for a state
   */
  private maxQValue(state: State): QValue {
    const stateKey = createStateKey(state);
    const actionKeys = this.stateIndex.get(stateKey);

    if (!actionKeys || actionKeys.size === 0) {
      return 0;
    }

    let maxQ = -Infinity;
    for (const actionKey of actionKeys) {
      const entry = this.entries.get(actionKey);
      if (entry && entry.qValue > maxQ) {
        maxQ = entry.qValue;
      }
    }

    return maxQ === -Infinity ? 0 : maxQ;
  }

  /**
   * Select random action for exploration
   */
  private randomAction(): Action {
    const actions = Object.values(Action);
    return actions[Math.floor(Math.random() * actions.length)];
  }

  /**
   * Calculate confidence from visit count
   * confidence = 1 - 1/(visits + 1)
   */
  private calculateConfidence(visits: number): ConfidenceScore {
    return 1 - 1 / (visits + 1);
  }

  /**
   * Decay exploration rate
   */
  private decayEpsilon(): void {
    this.currentEpsilon = Math.max(
      this.config.minEpsilon,
      this.currentEpsilon * this.config.epsilonDecay
    );
  }
}
