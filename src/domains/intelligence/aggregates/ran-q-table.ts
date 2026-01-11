/**
 * RAN Q-Table Aggregate Root
 *
 * RAN-specific Q-table implementation for RAN feature agents with:
 * - Feature-specific state-action mappings
 * - KPI-based reward calculation
 * - RAN domain knowledge integration
 * - Battle test learning support
 *
 * @module intelligence/aggregates/ran-q-table
 */

import { State } from '../value-objects/state';
import { Action, ALL_ACTIONS } from '../value-objects/action';
import { Reward } from '../value-objects/reward';
import { QEntry } from '../entities/q-entry';
import { QTable, QTableConfig, StateActionKey } from './q-table';

/**
 * RAN Feature Domains
 */
export enum RANFeatureDomain {
  CARRIER_AGGREGATION = 'CA',
  RADIO_RESOURCE_MANAGEMENT = 'RRM',
  NR_5G = 'NR',
  TRANSPORT = 'Transport',
  MIMO_ANTENNA = 'MIMO',
  MOBILITY = 'Mobility',
  ENERGY_SAVING = 'Energy',
  COVERAGE_CAPACITY = 'Coverage',
  VOICE_IMS = 'Voice',
  UE_HANDLING = 'UE',
  QOS = 'QoS',
  INTERFERENCE = 'Interference',
  TIMING = 'Timing',
  SECURITY = 'Security',
  SON = 'SON'
}

/**
 * RAN-specific state components
 */
export interface RANStateContext {
  readonly domain: RANFeatureDomain;
  readonly queryType: 'parameter' | 'troubleshoot' | 'procedure' | 'general';
  readonly complexity: 'low' | 'medium' | 'high';
  readonly contextHash: string;
  readonly confidenceLevel: number;
  readonly kpiStatus: 'normal' | 'degraded' | 'critical';
}

/**
 * RAN Q-Table Configuration
 */
export interface RANQTableConfig extends QTableConfig {
  readonly featureDomain: RANFeatureDomain;
  readonly featureAcronym: string;
  readonly enableKPIReward?: boolean;
  readonly enableBattleTestLearning?: boolean;
}

/**
 * RAN-specific domain events
 */
export interface RANQTableUpdated {
  readonly type: 'RANQTableUpdated';
  readonly qTableId: string;
  readonly featureAcronym: string;
  readonly domain: RANFeatureDomain;
  readonly stateKey: string;
  readonly action: Action;
  readonly newQValue: number;
  readonly kpiReward?: number;
  readonly timestamp: Date;
}

export type RANQTableEvent = RANQTableUpdated;

/**
 * RAN Q-Table Aggregate Root
 *
 * Extends base QTable with RAN-specific functionality:
 * - Domain-aware action selection
 * - KPI-based reward calculation
 * - Battle test optimization
 * - Feature specialization
 */
export class RANQTable extends QTable {
  readonly featureDomain: RANFeatureDomain;
  readonly featureAcronym: string;
  private readonly _enableKPIReward: boolean;
  private readonly _enableBattleTestLearning: boolean;
  private readonly _ranEvents: RANQTableEvent[];

  private constructor(
    id: string,
    agentId: string,
    config: RANQTableConfig
  ) {
    // Initialize base QTable with standard config
    const baseConfig: QTableConfig = {
      gamma: config.gamma,
      alpha: config.alpha,
      epsilon: config.epsilon
    };

    super(id, agentId, baseConfig);

    this.featureDomain = config.featureDomain;
    this.featureAcronym = config.featureAcronym;
    this._enableKPIReward = config.enableKPIReward ?? true;
    this._enableBattleTestLearning = config.enableBattleTestLearning ?? true;
    this._ranEvents = [];
  }

  /**
   * Factory method to create RAN Q-Table
   */
  static async create(config: RANQTableConfig): Promise<RANQTable> {
    const id = `ran-qtable-${config.featureAcronym.toLowerCase()}`;
    const agentId = `agent-${config.featureAcronym.toLowerCase()}`;
    return new RANQTable(id, agentId, config);
  }

  /**
   * Parse RAN state from State value object
   */
  parseRANState(state: State): RANStateContext | null {
    const parts = state.toKey().split(':');
    if (parts.length < 4) return null;

    return {
      domain: this.featureDomain,
      queryType: parts[0] as RANStateContext['queryType'],
      complexity: parts[1] as RANStateContext['complexity'],
      contextHash: parts[2],
      confidenceLevel: parseInt(parts[3] || '7'),
      kpiStatus: 'normal'
    };
  }

  /**
   * Create RAN-specific state key
   */
  createRANStateKey(context: RANStateContext): string {
    return `${context.queryType}:${context.complexity}:${context.contextHash}:${context.confidenceLevel}`;
  }

  /**
   * Update with RAN-specific reward calculation
   */
  updateWithRANReward(
    state: State,
    action: Action,
    baseReward: Reward,
    kpiImprovement?: number,
    battleTestSuccess?: boolean
  ): void {
    // Calculate KPI-based reward bonus
    let kpiReward = 0;
    if (this._enableKPIReward && kpiImprovement !== undefined) {
      // KPI improvement: -1 (worsened) to +1 (improved)
      // Scale to reward: -0.5 to +0.5
      kpiReward = kpiImprovement * 0.5;
    }

    // Battle test success bonus
    let battleBonus = 0;
    if (this._enableBattleTestLearning && battleTestSuccess) {
      battleBonus = 0.3; // Significant reward for battle test success
    }

    // Combine rewards
    const totalReward = new Reward(
      baseReward.semanticRelevance + kpiReward * 0.3,
      baseReward.resolutionSuccess + battleBonus,
      baseReward.efficiency + kpiReward * 0.2,
      baseReward.novelty
    );

    // Update base Q-table
    this.update(state, action, totalReward, state);

    // Raise RAN-specific event
    const entry = this.getEntry(state, action);
    if (entry) {
      this.raiseRANEvent({
        type: 'RANQTableUpdated',
        qTableId: this.id,
        featureAcronym: this.featureAcronym,
        domain: this.featureDomain,
        stateKey: state.toKey(),
        action,
        newQValue: entry.qValue,
        kpiReward: kpiReward !== 0 ? kpiReward : undefined,
        timestamp: new Date()
      });
    }
  }

  /**
   * Select action with domain-aware preferences
   */
  selectRANAction(state: State, explore: boolean = true): Action {
    const ranState = this.parseRANState(state);

    // If exploring, use epsilon-greedy with domain bias
    if (explore && Math.random() < this.epsilon) {
      return this.selectDomainBiasedAction(ranState);
    }

    // Otherwise, use best action from Q-table
    return this.getBestAction(state);
  }

  /**
   * Select action with domain-specific bias
   */
  private selectDomainBiasedAction(ranState: RANStateContext | null): Action {
    // Different domains prefer different exploration strategies
    const domainPreferences = this.getDomainActionPreferences(ranState?.domain);

    // Weighted random selection based on domain preferences
    const rand = Math.random();
    let cumulative = 0;

    for (const [action, weight] of domainPreferences.entries()) {
      cumulative += weight;
      if (rand <= cumulative) {
        return action;
      }
    }

    // Fallback to random action
    return ALL_ACTIONS[Math.floor(Math.random() * ALL_ACTIONS.length)];
  }

  /**
   * Get domain-specific action preferences
   */
  private getDomainActionPreferences(domain?: RANFeatureDomain): Map<Action, number> {
    const preferences = new Map<Action, number>();

    // Default equal weights
    for (const action of ALL_ACTIONS) {
      preferences.set(action, 1 / ALL_ACTIONS.length);
    }

    // Domain-specific adjustments
    switch (domain) {
      case RANFeatureDomain.CARRIER_AGGREGATION:
      case RANFeatureDomain.MIMO_ANTENNA:
        // Complex features prefer context answers
        preferences.set(Action.CONTEXT_ANSWER, 0.4);
        preferences.set(Action.DIRECT_ANSWER, 0.3);
        preferences.set(Action.CONSULT_PEER, 0.2);
        preferences.set(Action.REQUEST_CLARIFICATION, 0.1);
        break;

      case RANFeatureDomain.MOBILITY:
      case RANFeatureDomain.INTERFERENCE:
        // Troubleshooting-heavy domains prefer peer consultation
        preferences.set(Action.CONSULT_PEER, 0.35);
        preferences.set(Action.CONTEXT_ANSWER, 0.3);
        preferences.set(Action.DIRECT_ANSWER, 0.25);
        preferences.set(Action.REQUEST_CLARIFICATION, 0.1);
        break;

      case RANFeatureDomain.ENERGY_SAVING:
      case RANFeatureDomain.COVERAGE_CAPACITY:
        // Optimization domains prefer direct answers
        preferences.set(Action.DIRECT_ANSWER, 0.4);
        preferences.set(Action.CONTEXT_ANSWER, 0.3);
        preferences.set(Action.CONSULT_PEER, 0.2);
        preferences.set(Action.REQUEST_CLARIFICATION, 0.1);
        break;

      case RANFeatureDomain.SECURITY:
        // Security domains prefer peer consultation for validation
        preferences.set(Action.CONSULT_PEER, 0.4);
        preferences.set(Action.DIRECT_ANSWER, 0.3);
        preferences.set(Action.CONTEXT_ANSWER, 0.2);
        preferences.set(Action.REQUEST_CLARIFICATION, 0.1);
        break;

      default:
        // Default equal weights
        break;
    }

    return preferences;
  }

  /**
   * Get battle test statistics
   */
  getBattleTestStats(): {
    totalEntries: number;
    highConfidenceEntries: number;
    averageQValue: number;
    bestAction: Action;
  } {
    const entries = this.entries;
    const highConfidenceEntries = entries.filter(e => e.entry.confidence > 0.7).length;
    const totalQ = entries.reduce((sum, e) => sum + e.entry.qValue, 0);
    const averageQValue = entries.length > 0 ? totalQ / entries.length : 0;

    // Find overall best action
    const actionScores = new Map<Action, number>();
    for (const { key, entry } of entries) {
      const action = key.split(':').pop() as Action;
      const current = actionScores.get(action) || 0;
      actionScores.set(action, current + entry.qValue);
    }

    let bestAction = Action.DIRECT_ANSWER;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const [action, score] of actionScores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return {
      totalEntries: entries.length,
      highConfidenceEntries,
      averageQValue,
      bestAction
    };
  }

  /**
   * Get convergence status for battle testing
   */
  getConvergenceStatus(): {
    converged: boolean;
    confidence: number;
    reason: string;
  } {
    const stats = this.getBattleTestStats();

    // Convergence criteria
    const hasEnoughEntries = stats.totalEntries >= 10;
    const hasHighConfidence = stats.highConfidenceEntries >= stats.totalEntries * 0.5;
    const hasPositiveLearning = stats.averageQValue > 0.3;

    if (hasEnoughEntries && hasHighConfidence && hasPositiveLearning) {
      return {
        converged: true,
        confidence: Math.min(1, stats.averageQValue + 0.5),
        reason: `Sufficient entries (${stats.totalEntries}), high confidence (${stats.highConfidenceEntries}), positive learning (${stats.averageQValue.toFixed(2)})`
      };
    }

    const reasons = [];
    if (!hasEnoughEntries) reasons.push(`insufficient entries (${stats.totalEntries}/10)`);
    if (!hasHighConfidence) reasons.push(`low confidence (${stats.highConfidenceEntries}/${stats.totalEntries})`);
    if (!hasPositiveLearning) reasons.push(`negative learning (${stats.averageQValue.toFixed(2)})`);

    return {
      converged: false,
      confidence: Math.max(0, stats.averageQValue),
      reason: reasons.join(', ')
    };
  }

  /**
   * Raise RAN-specific event
   */
  private raiseRANEvent(event: RANQTableEvent): void {
    this._ranEvents.push(event);
  }

  /**
   * Get and clear uncommitted RAN events
   */
  getUncommittedRANEvents(): RANQTableEvent[] {
    const events = [...this._ranEvents];
    this._ranEvents.length = 0;
    return events;
  }

  /**
   * Merge with peer RAN Q-table
   */
  mergeRANQTable(peer: RANQTable): void {
    // Only merge with same domain
    if (peer.featureDomain !== this.featureDomain) {
      return;
    }

    // Merge base Q-table
    this.merge(peer);

    // Raise merge event
    this.raiseRANEvent({
      type: 'RANQTableUpdated',
      qTableId: this.id,
      featureAcronym: this.featureAcronym,
      domain: this.featureDomain,
      stateKey: 'merge',
      action: Action.DIRECT_ANSWER,
      newQValue: 0,
      timestamp: new Date()
    });
  }

  /**
   * String representation
   */
  toString(): string {
    return `RANQTable(${this.id}, domain=${this.featureDomain}, feature=${this.featureAcronym}, entries=${this.entryCount})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      ...super.toJSON(),
      featureDomain: this.featureDomain,
      featureAcronym: this.featureAcronym,
      battleTestStats: this.getBattleTestStats(),
      convergence: this.getConvergenceStatus()
    };
  }
}

export default RANQTable;
