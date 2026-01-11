/**
 * FAJCode Value Object
 *
 * Immutable representation of Ericsson Feature Code.
 * Format: "FAJ XXX XXXX" where X is digit.
 *
 * This is a specialized version for the Agent Lifecycle context,
 * providing additional metadata for agent lifecycle management.
 */

export class InvalidFAJCodeError extends Error {
  constructor(value: string) {
    super(`Invalid FAJ code format: "${value}". Expected format: "FAJ XXX XXXX"`);
    this.name = 'InvalidFAJCodeError';
  }
}

/**
 * Feature categories based on FAJ code ranges
 */
export enum FeatureCategory {
  RADIO_RESOURCE_MANAGEMENT = 'RadioResourceManagement',
  TRANSPORT = 'Transport',
  MOBILITY = 'Mobility',
  COVERAGE_CAPACITY = 'CoverageCapacity',
  SECURITY = 'Security',
  ENERGY_SAVING = 'EnergySaving',
  CARRIER_AGGREGATION = 'CarrierAggregation',
  QUALITY_OF_SERVICE = 'QualityOfService',
  VOICE_IMS = 'VoiceIMS',
  OTHER = 'Other'
}

/**
 * FAJCode Value Object
 */
export class FAJCode {
  private readonly value: string;
  private readonly VALID_PATTERN = /^FAJ\s\d{3}\s\d{4}$/;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  /**
   * Factory method to create FAJCode
   */
  static create(value: string): FAJCode {
    const trimmed = value.trim().toUpperCase();

    // Handle various input formats
    let normalized = trimmed;
    if (/^FAJ\d{7}$/.test(trimmed)) {
      // Convert "FAJ1213094" to "FAJ 121 3094"
      normalized = `FAJ ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
    } else if (/^FAJ\d{3}\d{4}$/.test(trimmed)) {
      // Convert "FAJ1213094" to "FAJ 121 3094"
      normalized = `FAJ ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
    } else if (/^FAJ\d{3}\s\d{4}$/.test(trimmed)) {
      // Already has single space - ensure correct format
      normalized = trimmed;
    }

    const instance = new FAJCode(normalized);

    if (!instance.isValid()) {
      throw new InvalidFAJCodeError(value);
    }

    return instance;
  }

  /**
   * Try to create FAJCode, return null if invalid
   */
  static tryCreate(value: string): FAJCode | null {
    try {
      return FAJCode.create(value);
    } catch {
      return null;
    }
  }

  /**
   * Validate FAJ code format
   */
  private isValid(): boolean {
    return this.VALID_PATTERN.test(this.value);
  }

  /**
   * Get feature category based on FAJ code
   */
  get category(): FeatureCategory {
    const match = this.value.match(/\d{3}/);
    if (!match) return FeatureCategory.OTHER;

    const categoryCode = parseInt(match[0], 10);

    // Map FAJ category codes to feature categories
    if (categoryCode >= 100 && categoryCode < 120) return FeatureCategory.RADIO_RESOURCE_MANAGEMENT;
    if (categoryCode >= 120 && categoryCode < 130) return FeatureCategory.ENERGY_SAVING;
    if (categoryCode >= 130 && categoryCode < 140) return FeatureCategory.CARRIER_AGGREGATION;
    if (categoryCode >= 200 && categoryCode < 300) return FeatureCategory.TRANSPORT;
    if (categoryCode >= 300 && categoryCode < 400) return FeatureCategory.MOBILITY;
    if (categoryCode >= 400 && categoryCode < 500) return FeatureCategory.COVERAGE_CAPACITY;
    if (categoryCode >= 500 && categoryCode < 600) return FeatureCategory.SECURITY;
    if (categoryCode >= 600 && categoryCode < 700) return FeatureCategory.QUALITY_OF_SERVICE;
    if (categoryCode >= 700 && categoryCode < 800) return FeatureCategory.VOICE_IMS;

    return FeatureCategory.OTHER;
  }

  /**
   * Get feature group number (XXX part)
   */
  get featureGroup(): number {
    const match = this.value.match(/^FAJ\s(\d{3})\s\d{4}$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get sequence number (XXXX part)
   */
  get sequenceNumber(): number {
    const match = this.value.match(/^FAJ\s\d{3}\s(\d{4})$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get the raw string value
   */
  get code(): string {
    return this.value;
  }

  /**
   * Value equality comparison
   */
  equals(other: FAJCode): boolean {
    return this.value === other.value;
  }

  /**
   * String representation
   */
  toString(): string {
    return this.value;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      value: this.value,
      category: this.category,
      featureGroup: this.featureGroup,
      sequenceNumber: this.sequenceNumber
    };
  }
}
