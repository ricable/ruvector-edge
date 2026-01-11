/**
 * FeatureCategory Value Object
 *
 * Represents the 9 feature categories in the Ericsson RAN feature registry.
 * Immutable value object with validation and metadata.
 */

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
 * Feature category metadata
 */
interface CategoryMetadata {
  readonly description: string;
  readonly fajRange: string;
  readonly parameterCount: number;
  readonly counterCount: number;
}

/**
 * Category metadata mapping
 */
const CATEGORY_METADATA: ReadonlyMap<FeatureCategory, CategoryMetadata> = new Map([
  [FeatureCategory.RADIO_RESOURCE_MANAGEMENT, {
    description: 'Radio Resource Management features for LTE/NR',
    fajRange: '100-119',
    parameterCount: 89,
    counterCount: 234
  }],
  [FeatureCategory.ENERGY_SAVING, {
    description: 'Energy saving and power optimization features',
    fajRange: '120-129',
    parameterCount: 156,
    counterCount: 89
  }],
  [FeatureCategory.CARRIER_AGGREGATION, {
    description: 'Carrier Aggregation features for LTE/NR',
    fajRange: '121-139',
    parameterCount: 203,
    counterCount: 145
  }],
  [FeatureCategory.TRANSPORT, {
    description: 'Transport and network interface features',
    fajRange: '200-299',
    parameterCount: 178,
    counterCount: 123
  }],
  [FeatureCategory.MOBILITY, {
    description: 'Mobility and handover features',
    fajRange: '300-399',
    parameterCount: 145,
    counterCount: 98
  }],
  [FeatureCategory.COVERAGE_CAPACITY, {
    description: 'Coverage and capacity optimization features',
    fajRange: '400-499',
    parameterCount: 134,
    counterCount: 87
  }],
  [FeatureCategory.SECURITY, {
    description: 'Security and encryption features',
    fajRange: '500-599',
    parameterCount: 67,
    counterCount: 45
  }],
  [FeatureCategory.QUALITY_OF_SERVICE, {
    description: 'QoS and traffic management features',
    fajRange: '600-699',
    parameterCount: 89,
    counterCount: 56
  }],
  [FeatureCategory.VOICE_IMS, {
    description: 'Voice over IMS features',
    fajRange: '700-799',
    parameterCount: 78,
    counterCount: 34
  }],
  [FeatureCategory.OTHER, {
    description: 'Other features not in standard categories',
    fajRange: 'N/A',
    parameterCount: 0,
    counterCount: 0
  }]
]);

/**
 * FeatureCategory Value Object
 *
 * Provides category validation, metadata access, and utility methods.
 */
export class FeatureCategoryVO {
  private readonly value: FeatureCategory;

  private constructor(value: FeatureCategory) {
    this.value = value;
  }

  /**
   * Create from enum value
   */
  static create(category: FeatureCategory): FeatureCategoryVO {
    return new FeatureCategoryVO(category);
  }

  /**
   * Create from string
   */
  static fromString(value: string): FeatureCategoryVO {
    // Convert string to enum
    const normalized = value.toUpperCase().replace(/[\s-]/g, '_');

    // Map common string variations to enum values
    const categoryMap: Record<string, FeatureCategory> = {
      'RADIO_RESOURCE_MANAGEMENT': FeatureCategory.RADIO_RESOURCE_MANAGEMENT,
      'RRM': FeatureCategory.RADIO_RESOURCE_MANAGEMENT,
      'TRANSPORT': FeatureCategory.TRANSPORT,
      'MOBILITY': FeatureCategory.MOBILITY,
      'COVERAGE_CAPACITY': FeatureCategory.COVERAGE_CAPACITY,
      'COVERAGE': FeatureCategory.COVERAGE_CAPACITY,
      'SECURITY': FeatureCategory.SECURITY,
      'ENERGY_SAVING': FeatureCategory.ENERGY_SAVING,
      'ENERGY': FeatureCategory.ENERGY_SAVING,
      'CARRIER_AGGREGATION': FeatureCategory.CARRIER_AGGREGATION,
      'CA': FeatureCategory.CARRIER_AGGREGATION,
      'QUALITY_OF_SERVICE': FeatureCategory.QUALITY_OF_SERVICE,
      'QOS': FeatureCategory.QUALITY_OF_SERVICE,
      'VOICE_IMS': FeatureCategory.VOICE_IMS,
      'IMS': FeatureCategory.VOICE_IMS,
      'OTHER': FeatureCategory.OTHER
    };

    const category = categoryMap[normalized];
    if (!category) {
      throw new Error(`Invalid feature category: ${value}`);
    }

    return new FeatureCategoryVO(category);
  }

  /**
   * Get category from FAJ code
   */
  static fromFAJCode(fajCode: string): FeatureCategoryVO {
    const match = fajCode.match(/^FAJ\s(\d{3})\s\d{4}$/);
    if (!match) {
      throw new Error(`Invalid FAJ code format: ${fajCode}`);
    }

    const categoryCode = parseInt(match[1], 10);

    // Map FAJ category codes to feature categories
    if (categoryCode >= 100 && categoryCode < 120) {
      return new FeatureCategoryVO(FeatureCategory.RADIO_RESOURCE_MANAGEMENT);
    }
    if (categoryCode >= 120 && categoryCode < 130) {
      return new FeatureCategoryVO(FeatureCategory.ENERGY_SAVING);
    }
    if (categoryCode >= 130 && categoryCode < 140) {
      return new FeatureCategoryVO(FeatureCategory.CARRIER_AGGREGATION);
    }
    if (categoryCode >= 200 && categoryCode < 300) {
      return new FeatureCategoryVO(FeatureCategory.TRANSPORT);
    }
    if (categoryCode >= 300 && categoryCode < 400) {
      return new FeatureCategoryVO(FeatureCategory.MOBILITY);
    }
    if (categoryCode >= 400 && categoryCode < 500) {
      return new FeatureCategoryVO(FeatureCategory.COVERAGE_CAPACITY);
    }
    if (categoryCode >= 500 && categoryCode < 600) {
      return new FeatureCategoryVO(FeatureCategory.SECURITY);
    }
    if (categoryCode >= 600 && categoryCode < 700) {
      return new FeatureCategoryVO(FeatureCategory.QUALITY_OF_SERVICE);
    }
    if (categoryCode >= 700 && categoryCode < 800) {
      return new FeatureCategoryVO(FeatureCategory.VOICE_IMS);
    }

    return new FeatureCategoryVO(FeatureCategory.OTHER);
  }

  /**
   * Get category metadata
   */
  get metadata(): CategoryMetadata {
    return CATEGORY_METADATA.get(this.value) ?? CATEGORY_METADATA.get(FeatureCategory.OTHER)!;
  }

  /**
   * Get category description
   */
  get description(): string {
    return this.metadata.description;
  }

  /**
   * Get FAJ code range
   */
  get fajRange(): string {
    return this.metadata.fajRange;
  }

  /**
   * Get the enum value
   */
  get enumValue(): FeatureCategory {
    return this.value;
  }

  /**
   * Check if this is a core category (high feature count)
   */
  isCoreCategory(): boolean {
    return this.metadata.parameterCount > 100;
  }

  /**
   * Value equality
   */
  equals(other: FeatureCategoryVO): boolean {
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
      category: this.value,
      description: this.description,
      fajRange: this.fajRange,
      parameterCount: this.metadata.parameterCount,
      counterCount: this.metadata.counterCount
    };
  }
}
