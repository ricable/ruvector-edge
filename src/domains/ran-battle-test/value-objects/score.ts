/**
 * Score Value Object
 *
 * Represents the calculated score for a feature agent battle test.
 * Implements the scoring formula from ADR-025.
 *
 * @module ran-battle-test/value-objects/score
 */

/**
 * Score breakdown by category
 */
export interface ScoreBreakdown {
  readonly knowledgeScore: number;      // 40% weight
  readonly decisionScore: number;        // 30% weight
  readonly advancedScore: number;        // 30% weight
  readonly maxKnowledgeScore: number;
  readonly maxDecisionScore: number;
  readonly maxAdvancedScore: number;
}

/**
 * Bonus scores for OODA efficiency, Q-learning, and coordination
 */
export interface BonusScore {
  readonly oodaEfficiency: number;       // +20 if avg OODA < 100ms
  readonly qLearningConverged: number;   // +20 if converged
  readonly crossFeatureCoordination: number; // +20 if coordinated
  readonly totalBonus: number;
}

/**
 * Score Value Object
 *
 * Immutable representation of test scores.
 */
export class Score {
  readonly breakdown: ScoreBreakdown;
  readonly bonus: BonusScore;
  readonly totalScore: number;
  readonly maxScore: number;
  readonly percentage: number;
  readonly timestamp: Date;

  private constructor(
    breakdown: ScoreBreakdown,
    bonus: BonusScore,
    maxScore: number
  ) {
    this.breakdown = Object.freeze(breakdown);
    this.bonus = Object.freeze(bonus);

    // Calculate weighted base score
    const baseScore =
      (breakdown.knowledgeScore / breakdown.maxKnowledgeScore) * 40 +
      (breakdown.decisionScore / breakdown.maxDecisionScore) * 30 +
      (breakdown.advancedScore / breakdown.maxAdvancedScore) * 30;

    this.totalScore = baseScore + bonus.totalBonus;
    this.maxScore = maxScore + 60; // 100 base + 60 bonus
    this.percentage = (this.totalScore / this.maxScore) * 100;
    this.timestamp = new Date();

    Object.freeze(this);
  }

  /**
   * Factory method to create a Score
   */
  static create(props: {
    knowledgeScore: number;
    decisionScore: number;
    advancedScore: number;
    maxKnowledgeScore: number;
    maxDecisionScore: number;
    maxAdvancedScore: number;
    oodaEfficiency?: number;
    qLearningConverged?: boolean;
    crossFeatureCoordination?: number;
  }): Score {
    const breakdown: ScoreBreakdown = {
      knowledgeScore: props.knowledgeScore,
      decisionScore: props.decisionScore,
      advancedScore: props.advancedScore,
      maxKnowledgeScore: props.maxKnowledgeScore,
      maxDecisionScore: props.maxDecisionScore,
      maxAdvancedScore: props.maxAdvancedScore
    };

    // Calculate bonuses per ADR-025
    const oodaBonus = props.oodaEfficiency && props.oodaEfficiency < 100 ? 20 :
                      props.oodaEfficiency && props.oodaEfficiency < 200 ? 10 : 0;

    const qLearningBonus = props.qLearningConverged ? 20 : 0;

    const coordinationBonus = props.crossFeatureCoordination && props.crossFeatureCoordination > 0.8 ? 20 :
                              props.crossFeatureCoordination && props.crossFeatureCoordination > 0.5 ? 10 : 0;

    const bonus: BonusScore = {
      oodaEfficiency: oodaBonus,
      qLearningConverged: qLearningBonus,
      crossFeatureCoordination: coordinationBonus,
      totalBonus: oodaBonus + qLearningBonus + coordinationBonus
    };

    const maxScore = props.maxKnowledgeScore + props.maxDecisionScore + props.maxAdvancedScore;

    return new Score(breakdown, bonus, maxScore);
  }

  /**
   * Create a zero score (for tests with no questions)
   */
  static zero(): Score {
    return Score.create({
      knowledgeScore: 0,
      decisionScore: 0,
      advancedScore: 0,
      maxKnowledgeScore: 40,
      maxDecisionScore: 30,
      maxAdvancedScore: 30
    });
  }

  /**
   * Check if score is passing (>= 70%)
   */
  isPassing(): boolean {
    return this.percentage >= 70;
  }

  /**
   * Check if score is excellent (>= 90%)
   */
  isExcellent(): boolean {
    return this.percentage >= 90;
  }

  /**
   * Get grade letter
   */
  getGrade(): string {
    if (this.percentage >= 90) return 'A';
    if (this.percentage >= 80) return 'B';
    if (this.percentage >= 70) return 'C';
    if (this.percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Get detailed breakdown string
   */
  getBreakdownString(): string {
    return `Knowledge: ${this.breakdown.knowledgeScore.toFixed(1)}/${this.breakdown.maxKnowledgeScore} | ` +
           `Decision: ${this.breakdown.decisionScore.toFixed(1)}/${this.breakdown.maxDecisionScore} | ` +
           `Advanced: ${this.breakdown.advancedScore.toFixed(1)}/${this.breakdown.maxAdvancedScore} | ` +
           `Bonus: +${this.bonus.totalBonus} (OODA: ${this.bonus.oodaEfficiency}, Q-Learn: ${this.bonus.qLearningConverged}, Coord: ${this.bonus.crossFeatureCoordination})`;
  }

  /**
   * Equality check
   */
  equals(other: Score): boolean {
    return this.totalScore === other.totalScore &&
           this.percentage === other.percentage;
  }

  /**
   * String representation
   */
  toString(): string {
    return `Score(${this.totalScore.toFixed(1)}/${this.maxScore} = ${this.percentage.toFixed(1)}% ${this.getGrade()})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      totalScore: this.totalScore,
      maxScore: this.maxScore,
      percentage: this.percentage,
      grade: this.getGrade(),
      breakdown: this.breakdown,
      bonus: this.bonus,
      timestamp: this.timestamp
    };
  }
}

export default Score;
