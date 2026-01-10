/**
 * Parameter Value Object
 *
 * Represents a configurable network parameter with safe zone constraints.
 * Parameters control RAN behavior and have value constraints, change limits, and cooldowns.
 */

export type DataType = 'integer' | 'float' | 'boolean' | 'string' | 'enum';

export interface ParameterConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly allowedValues?: string[];
  readonly changeLimit: number; // Maximum change percentage (e.g., 0.15 = 15%)
  readonly cooldown: number;    // Minimum milliseconds between changes
}

export interface SafeZone {
  readonly min: number;
  readonly max: number;
  readonly changeLimit: number;
  readonly cooldown: number;
}

export type ParameterValue = number | string | boolean;

export class Parameter {
  constructor(
    public readonly name: string,
    public readonly value: ParameterValue,
    public readonly dataType: DataType,
    public readonly constraints: ParameterConstraints,
    public readonly safeZone: SafeZone
  ) {
    Object.freeze(this);
  }

  /**
   * Check if current value is within safe zone boundaries
   */
  isWithinSafeZone(): boolean {
    if (typeof this.value !== 'number') {
      return true; // Non-numeric values always considered safe
    }
    return this.value >= this.safeZone.min && this.value <= this.safeZone.max;
  }

  /**
   * Check if a proposed change exceeds the allowed change limit
   */
  changeExceedsLimit(newValue: ParameterValue): boolean {
    if (typeof this.value !== 'number' || typeof newValue !== 'number') {
      return false;
    }
    if (this.value === 0) {
      return newValue !== 0;
    }
    const delta = Math.abs(newValue - this.value) / Math.abs(this.value);
    return delta > this.constraints.changeLimit;
  }

  /**
   * Check if a proposed value would be within safe zone
   */
  wouldBeInSafeZone(newValue: ParameterValue): boolean {
    if (typeof newValue !== 'number') {
      return true;
    }
    return newValue >= this.safeZone.min && newValue <= this.safeZone.max;
  }

  /**
   * Check if value is within absolute constraints
   */
  isWithinConstraints(): boolean {
    if (typeof this.value !== 'number') {
      if (this.dataType === 'enum' && this.constraints.allowedValues) {
        return this.constraints.allowedValues.includes(String(this.value));
      }
      return true;
    }
    const min = this.constraints.min ?? Number.NEGATIVE_INFINITY;
    const max = this.constraints.max ?? Number.POSITIVE_INFINITY;
    return this.value >= min && this.value <= max;
  }

  /**
   * Create a new Parameter with updated value
   */
  withValue(newValue: ParameterValue): Parameter {
    return new Parameter(
      this.name,
      newValue,
      this.dataType,
      this.constraints,
      this.safeZone
    );
  }

  /**
   * Value equality
   */
  equals(other: Parameter): boolean {
    return this.name === other.name && this.value === other.value;
  }

  toString(): string {
    return `${this.name}=${this.value}`;
  }
}
