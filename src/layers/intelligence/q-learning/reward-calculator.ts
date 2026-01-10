/**
 * Reward Calculator
 * Computes reward signals from interaction outcomes
 */

import type { RewardSignal, ComputedReward, Action } from '../types';

/** Reward calculation configuration */
export interface RewardCalculatorConfig {
  resolutionBonus: number;          // Bonus for successful resolution
  latencyThresholdMs: number;       // Threshold for latency penalty
  latencyPenaltyFactor: number;     // Penalty per ms over threshold
  consultationCostPerPeer: number;  // Cost per peer consultation
  noveltyBonus: number;             // Bonus for handling novel queries
  maxLatencyPenalty: number;        // Maximum latency penalty
  escalationPenalty: number;        // Penalty for escalation (should be low)
}

const DEFAULT_CONFIG: RewardCalculatorConfig = {
  resolutionBonus: 0.5,
  latencyThresholdMs: 1000,
  latencyPenaltyFactor: 0.0001,
  consultationCostPerPeer: 0.05,
  noveltyBonus: 0.2,
  maxLatencyPenalty: 0.3,
  escalationPenalty: 0.1,
};

/**
 * RewardCalculator computes composite reward signals from interaction outcomes
 */
export class RewardCalculator {
  private readonly config: RewardCalculatorConfig;

  constructor(config: Partial<RewardCalculatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate total reward from signal components
   */
  calculate(signal: RewardSignal, action: Action): ComputedReward {
    const breakdown = {
      userRating: this.calculateUserRatingComponent(signal.userRating),
      resolutionBonus: this.calculateResolutionBonus(signal.resolutionSuccess),
      latencyPenalty: this.calculateLatencyPenalty(signal.latencyMs),
      consultationCost: this.calculateConsultationCost(signal.consultedPeers),
      noveltyBonus: this.calculateNoveltyBonus(signal.isNovelQuery),
    };

    // Apply action-specific modifiers
    const actionModifier = this.getActionModifier(action, signal);

    const total = (
      breakdown.userRating +
      breakdown.resolutionBonus +
      breakdown.latencyPenalty +
      breakdown.consultationCost +
      breakdown.noveltyBonus +
      actionModifier
    );

    return {
      total: this.clampReward(total),
      breakdown,
    };
  }

  /**
   * Calculate user rating component
   * Already in [-1, +1] range
   */
  private calculateUserRatingComponent(rating: number): number {
    return Math.max(-1, Math.min(1, rating));
  }

  /**
   * Calculate resolution bonus
   */
  private calculateResolutionBonus(success: boolean): number {
    return success ? this.config.resolutionBonus : 0;
  }

  /**
   * Calculate latency penalty
   * Penalize responses slower than threshold
   */
  private calculateLatencyPenalty(latencyMs: number): number {
    if (latencyMs <= this.config.latencyThresholdMs) {
      return 0;
    }

    const excessLatency = latencyMs - this.config.latencyThresholdMs;
    const penalty = excessLatency * this.config.latencyPenaltyFactor;

    return -Math.min(penalty, this.config.maxLatencyPenalty);
  }

  /**
   * Calculate consultation cost
   * Small penalty for each peer consultation
   */
  private calculateConsultationCost(peerCount: number): number {
    return -peerCount * this.config.consultationCostPerPeer;
  }

  /**
   * Calculate novelty bonus
   * Reward handling new query types
   */
  private calculateNoveltyBonus(isNovel: boolean): number {
    return isNovel ? this.config.noveltyBonus : 0;
  }

  /**
   * Get action-specific modifier
   */
  private getActionModifier(action: Action, signal: RewardSignal): number {
    switch (action) {
      case 'escalate':
        // Small penalty for escalation, but not if resolution was unsuccessful
        return signal.resolutionSuccess ? -this.config.escalationPenalty : 0;

      case 'direct_answer':
        // Bonus for fast direct answers when successful
        if (signal.resolutionSuccess && signal.latencyMs < 500) {
          return 0.1;
        }
        return 0;

      case 'context_answer':
        // Slight bonus for using context when appropriate
        return signal.resolutionSuccess ? 0.05 : 0;

      case 'request_clarification':
        // Neutral - clarification is sometimes necessary
        return 0;

      case 'consult_peer':
        // Already penalized by consultation cost
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Clamp reward to valid range
   */
  private clampReward(reward: number): number {
    // Allow rewards beyond [-1, 1] but cap at [-2, 2]
    return Math.max(-2, Math.min(2, reward));
  }

  /**
   * Create a simple reward signal for quick feedback
   */
  createSimpleSignal(
    userRating: number,
    resolutionSuccess: boolean,
    latencyMs: number = 0
  ): RewardSignal {
    return {
      userRating,
      resolutionSuccess,
      latencyMs,
      consultedPeers: 0,
      isNovelQuery: false,
    };
  }

  /**
   * Estimate expected reward for an action
   * Used for exploration bonus calculation
   */
  estimateExpectedReward(
    action: Action,
    queryComplexity: 'simple' | 'moderate' | 'complex',
    confidence: number
  ): number {
    // Base expected rewards by action type
    const baseRewards: Record<Action, number> = {
      direct_answer: 0.7,
      context_answer: 0.6,
      consult_peer: 0.5,
      request_clarification: 0.3,
      escalate: 0.2,
    };

    let expected = baseRewards[action];

    // Adjust for complexity
    const complexityMultipliers = {
      simple: 1.0,
      moderate: 0.85,
      complex: 0.7,
    };
    expected *= complexityMultipliers[queryComplexity];

    // Adjust for confidence
    expected *= (0.5 + 0.5 * confidence);

    // Special adjustments
    if (action === 'direct_answer' && queryComplexity === 'complex') {
      expected *= 0.6; // Direct answers less likely to succeed for complex queries
    }

    if (action === 'consult_peer' && queryComplexity === 'complex') {
      expected *= 1.2; // Peer consultation more valuable for complex queries
    }

    return expected;
  }
}

// Export singleton with default config
export const rewardCalculator = new RewardCalculator();
