/**
 * FAJCode Value Object
 *
 * Feature Activation Journal code - Ericsson's unique identifier for RAN features.
 * Format: "FAJ XXX YYYY" (e.g., FAJ 121 3094)
 *
 * Immutable by design - once created, cannot be changed.
 */
export class InvalidFAJCodeError extends Error {
  constructor(value: string) {
    super(`Invalid FAJ code format: "${value}". Expected format: "FAJ XXX YYYY"`);
    this.name = 'InvalidFAJCodeError';
  }
}

export class FAJCode {
  private readonly _value: string;

  constructor(value: string) {
    if (!FAJCode.isValid(value)) {
      throw new InvalidFAJCodeError(value);
    }
    this._value = value;
  }

  /**
   * Validates FAJ code format: "FAJ XXX YYYY"
   * XXX = 3 digits, YYYY = 4 digits
   */
  static isValid(value: string): boolean {
    return /^FAJ \d{3} \d{4}$/.test(value);
  }

  /**
   * Creates a FAJCode from string, returning null if invalid
   */
  static tryCreate(value: string): FAJCode | null {
    if (!FAJCode.isValid(value)) {
      return null;
    }
    return new FAJCode(value);
  }

  /**
   * Value equality comparison
   */
  equals(other: FAJCode): boolean {
    return this._value === other._value;
  }

  /**
   * Extract the numeric portion (XXX)
   */
  get featureGroup(): number {
    const match = this._value.match(/^FAJ (\d{3}) \d{4}$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extract the sequence number (YYYY)
   */
  get sequenceNumber(): number {
    const match = this._value.match(/^FAJ \d{3} (\d{4})$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get the raw string value
   */
  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }
}
