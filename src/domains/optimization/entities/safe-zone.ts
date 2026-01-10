/**
 * SafeZone Entity
 *
 * Defines safety boundaries for parameter modifications including
 * value ranges, change limits, cooldown periods, and blocked conditions.
 */

export interface SafeZoneConstraints {
  readonly min: number;           // Absolute minimum
  readonly max: number;           // Absolute maximum
  readonly safeMin: number;       // Safe operating minimum
  readonly safeMax: number;       // Safe operating maximum
  readonly changeLimit: number;   // Max percentage change (e.g., 0.15 = 15%)
  readonly cooldown: number;      // Milliseconds between changes
}

export interface BlockedCondition {
  readonly type: 'alarm' | 'metric' | 'timeWindow';
  readonly condition: string;
  readonly value?: number;
  readonly operator?: '>' | '<' | '=' | '>=' | '<=';
}

export interface SafeZoneViolation {
  readonly type: 'min' | 'max' | 'safeMin' | 'safeMax' | 'changeLimit' | 'cooldown' | 'blocked';
  readonly message: string;
  readonly currentValue: number;
  readonly proposedValue?: number;
}

export class SafeZone {
  readonly parameterId: string;
  readonly parameterName: string;
  private _constraints: SafeZoneConstraints;
  private _blockedConditions: BlockedCondition[];
  private _lastChangeTime: Date | null;
  private _lastValue: number | null;

  constructor(
    parameterId: string,
    parameterName: string,
    constraints: SafeZoneConstraints,
    blockedConditions: BlockedCondition[] = []
  ) {
    this.parameterId = parameterId;
    this.parameterName = parameterName;
    this._constraints = constraints;
    this._blockedConditions = [...blockedConditions];
    this._lastChangeTime = null;
    this._lastValue = null;
  }

  /**
   * Validate a proposed value change
   */
  validate(currentValue: number, proposedValue: number): SafeZoneViolation[] {
    const violations: SafeZoneViolation[] = [];

    // Check absolute bounds
    if (proposedValue < this._constraints.min) {
      violations.push({
        type: 'min',
        message: `Value ${proposedValue} below minimum ${this._constraints.min}`,
        currentValue,
        proposedValue
      });
    }

    if (proposedValue > this._constraints.max) {
      violations.push({
        type: 'max',
        message: `Value ${proposedValue} above maximum ${this._constraints.max}`,
        currentValue,
        proposedValue
      });
    }

    // Check safe zone bounds
    if (proposedValue < this._constraints.safeMin) {
      violations.push({
        type: 'safeMin',
        message: `Value ${proposedValue} below safe minimum ${this._constraints.safeMin}`,
        currentValue,
        proposedValue
      });
    }

    if (proposedValue > this._constraints.safeMax) {
      violations.push({
        type: 'safeMax',
        message: `Value ${proposedValue} above safe maximum ${this._constraints.safeMax}`,
        currentValue,
        proposedValue
      });
    }

    // Check change limit
    if (currentValue !== 0) {
      const changePercent = Math.abs(proposedValue - currentValue) / Math.abs(currentValue);
      if (changePercent > this._constraints.changeLimit) {
        violations.push({
          type: 'changeLimit',
          message: `Change ${(changePercent * 100).toFixed(1)}% exceeds limit ${(this._constraints.changeLimit * 100)}%`,
          currentValue,
          proposedValue
        });
      }
    }

    // Check cooldown
    if (this._lastChangeTime) {
      const timeSinceLastChange = Date.now() - this._lastChangeTime.getTime();
      if (timeSinceLastChange < this._constraints.cooldown) {
        const remainingCooldown = this._constraints.cooldown - timeSinceLastChange;
        violations.push({
          type: 'cooldown',
          message: `Cooldown active, ${Math.round(remainingCooldown / 1000)}s remaining`,
          currentValue
        });
      }
    }

    return violations;
  }

  /**
   * Check if a value is within safe zone
   */
  isWithinSafeZone(value: number): boolean {
    return value >= this._constraints.safeMin && value <= this._constraints.safeMax;
  }

  /**
   * Check if a value is within absolute bounds
   */
  isWithinBounds(value: number): boolean {
    return value >= this._constraints.min && value <= this._constraints.max;
  }

  /**
   * Check if cooldown is active
   */
  isCooldownActive(): boolean {
    if (!this._lastChangeTime) {
      return false;
    }
    return Date.now() - this._lastChangeTime.getTime() < this._constraints.cooldown;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getRemainingCooldown(): number {
    if (!this._lastChangeTime) {
      return 0;
    }
    const elapsed = Date.now() - this._lastChangeTime.getTime();
    return Math.max(0, this._constraints.cooldown - elapsed);
  }

  /**
   * Check blocked conditions against current context
   */
  checkBlockedConditions(context: Map<string, number | string>): string[] {
    const blockedReasons: string[] = [];

    for (const condition of this._blockedConditions) {
      switch (condition.type) {
        case 'alarm':
          if (context.has(condition.condition)) {
            blockedReasons.push(`Alarm active: ${condition.condition}`);
          }
          break;

        case 'metric':
          const metricValue = context.get(condition.condition);
          if (
            typeof metricValue === 'number' &&
            condition.value !== undefined &&
            condition.operator
          ) {
            const blocked = this.evaluateCondition(metricValue, condition.operator, condition.value);
            if (blocked) {
              blockedReasons.push(`Metric condition: ${condition.condition} ${condition.operator} ${condition.value}`);
            }
          }
          break;

        case 'timeWindow':
          // Time window format: "HH:MM-HH:MM"
          if (this.isInTimeWindow(condition.condition)) {
            blockedReasons.push(`Time window blocked: ${condition.condition}`);
          }
          break;
      }
    }

    return blockedReasons;
  }

  /**
   * Record a successful change
   */
  recordChange(newValue: number): void {
    this._lastChangeTime = new Date();
    this._lastValue = newValue;
  }

  /**
   * Get safe center value (middle of safe zone)
   */
  getSafeCenter(): number {
    return (this._constraints.safeMin + this._constraints.safeMax) / 2;
  }

  /**
   * Calculate maximum allowed change from current value
   */
  getMaxAllowedChange(currentValue: number): { min: number; max: number } {
    const maxChange = Math.abs(currentValue) * this._constraints.changeLimit;
    return {
      min: Math.max(this._constraints.min, currentValue - maxChange),
      max: Math.min(this._constraints.max, currentValue + maxChange)
    };
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '=': return value === threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      default: return false;
    }
  }

  private isInTimeWindow(window: string): boolean {
    const match = window.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseInt(match[1]) * 60 + parseInt(match[2]);
    const endMinutes = parseInt(match[3]) * 60 + parseInt(match[4]);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Spans midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  // Getters
  get constraints(): SafeZoneConstraints { return this._constraints; }
  get blockedConditions(): ReadonlyArray<BlockedCondition> { return this._blockedConditions; }
  get lastChangeTime(): Date | null { return this._lastChangeTime; }
  get lastValue(): number | null { return this._lastValue; }

  equals(other: SafeZone): boolean {
    return this.parameterId === other.parameterId;
  }

  toString(): string {
    return `SafeZone(${this.parameterName}, safe=${this._constraints.safeMin}-${this._constraints.safeMax})`;
  }
}
