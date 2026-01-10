/**
 * QEntry Entity
 *
 * Represents a single entry in the Q-table storing the learned value
 * for a state-action pair along with confidence and history.
 */

export interface OutcomeRecord {
  readonly success: boolean;
  readonly reward: number;
  readonly timestamp: Date;
}

export class QEntry {
  private _qValue: number;
  private _visits: number;
  private _confidence: number;
  private _outcomes: OutcomeRecord[];
  private _lastUpdated: Date;

  constructor(
    qValue: number = 0,
    visits: number = 0,
    confidence: number = 0,
    outcomes: OutcomeRecord[] = [],
    lastUpdated: Date = new Date()
  ) {
    this._qValue = qValue;
    this._visits = visits;
    this._confidence = confidence;
    this._outcomes = [...outcomes];
    this._lastUpdated = lastUpdated;
  }

  /**
   * Update Q-value using Bellman equation
   */
  update(reward: number, nextMaxQ: number, alpha: number, gamma: number): void {
    // Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
    const tdError = reward + gamma * nextMaxQ - this._qValue;
    this._qValue = this._qValue + alpha * tdError;
    this._visits++;
    this._lastUpdated = new Date();

    // Record outcome
    this._outcomes.push({
      success: reward > 0,
      reward,
      timestamp: new Date()
    });

    // Keep only last 100 outcomes
    if (this._outcomes.length > 100) {
      this._outcomes = this._outcomes.slice(-100);
    }

    // Update confidence based on outcome consistency
    this.updateConfidence();
  }

  /**
   * Merge with another Q-entry (for federated learning)
   */
  merge(other: QEntry): QEntry {
    const totalVisits = this._visits + other._visits;
    if (totalVisits === 0) {
      return new QEntry();
    }

    // Weighted average based on visits
    const mergedQ = (
      (this._qValue * this._visits + other._qValue * other._visits) /
      totalVisits
    );

    const mergedConfidence = (
      (this._confidence * this._visits + other._confidence * other._visits) /
      totalVisits
    );

    // Merge outcomes
    const mergedOutcomes = [...this._outcomes, ...other._outcomes]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);

    return new QEntry(
      mergedQ,
      totalVisits,
      mergedConfidence,
      mergedOutcomes,
      new Date()
    );
  }

  /**
   * Get success rate from recent outcomes
   */
  get successRate(): number {
    if (this._outcomes.length === 0) {
      return 0.5; // Default to neutral
    }
    const successes = this._outcomes.filter(o => o.success).length;
    return successes / this._outcomes.length;
  }

  /**
   * Get average reward from recent outcomes
   */
  get averageReward(): number {
    if (this._outcomes.length === 0) {
      return 0;
    }
    const total = this._outcomes.reduce((sum, o) => sum + o.reward, 0);
    return total / this._outcomes.length;
  }

  private updateConfidence(): void {
    // Confidence increases with visits and consistency
    const visitFactor = Math.min(1, this._visits / 50);
    const consistencyFactor = this.calculateConsistency();
    this._confidence = visitFactor * 0.5 + consistencyFactor * 0.5;
  }

  private calculateConsistency(): number {
    if (this._outcomes.length < 2) {
      return 0;
    }
    // Calculate variance in outcomes
    const rewards = this._outcomes.map(o => o.reward);
    const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const variance = rewards.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rewards.length;
    // Lower variance = higher consistency
    return Math.max(0, 1 - Math.sqrt(variance));
  }

  // Getters
  get qValue(): number { return this._qValue; }
  get visits(): number { return this._visits; }
  get confidence(): number { return this._confidence; }
  get outcomes(): ReadonlyArray<OutcomeRecord> { return this._outcomes; }
  get lastUpdated(): Date { return this._lastUpdated; }

  toString(): string {
    return `QEntry(Q=${this._qValue.toFixed(3)}, visits=${this._visits}, conf=${this._confidence.toFixed(2)})`;
  }

  toJSON(): object {
    return {
      qValue: this._qValue,
      visits: this._visits,
      confidence: this._confidence,
      successRate: this.successRate,
      averageReward: this.averageReward,
      lastUpdated: this._lastUpdated.toISOString()
    };
  }
}
