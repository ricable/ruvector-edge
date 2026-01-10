/**
 * @fileoverview Feature interfaces for RAN feature catalog
 * @module @ruvector/edge/core/interfaces/feature
 *
 * @see docs/ddd/domain-model.md
 * @see ADR-004: One Agent Per Feature Specialization
 */

import type {
  FeatureId,
  FAJCode
} from '../types/identifiers.js';

import type {
  Category,
  AccessTechnology,
  DataType,
  CounterCategory
} from '../types/enums.js';

import type {
  Unit,
  ParameterValue,
  Percentage,
  Duration
} from '../types/primitives.js';

/**
 * Feature entity representing an Ericsson RAN feature
 * 593 features total: 307 LTE, 284 NR, 2 Cross-RAT
 */
export interface IFeature {
  readonly id: FeatureId;
  readonly fajCode: FAJCode;
  readonly name: string;
  readonly description: string;
  readonly category: Category;
  readonly accessTechnology: AccessTechnology;

  /** Parameters configurable for this feature */
  readonly parameters: IParameter[];

  /** Counters measured by this feature */
  readonly counters: ICounter[];

  /** KPIs influenced by this feature */
  readonly kpis: IKPI[];

  /** Operational procedures */
  readonly procedures: IProcedure[];

  /** Feature dependencies */
  readonly dependencies: FeatureId[];

  /** Conflicting features */
  readonly conflicts: FeatureId[];

  /** Related features for cross-reference */
  readonly relatedFeatures: FeatureId[];
}

/**
 * Network parameter configuration
 * 5,230 parameters across 452 features
 */
export interface IParameter {
  readonly name: string;
  readonly description: string;
  readonly dataType: DataType;
  readonly unit?: Unit;
  readonly defaultValue: ParameterValue;
  readonly constraints: IParameterConstraints;
  readonly safeZone: ISafeZone;
}

/**
 * Parameter constraints
 */
export interface IParameterConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly enumValues?: string[];
  readonly pattern?: string;
  readonly required: boolean;
}

/**
 * Safe zone for parameter optimization
 * @see ADR-008: Safe Zone Parameter Constraints
 */
export interface ISafeZone {
  /** Absolute minimum from RAN specification */
  readonly absoluteMin: number;
  /** Absolute maximum from RAN specification */
  readonly absoluteMax: number;
  /** Operational safe minimum */
  readonly safeMin: number;
  /** Operational safe maximum */
  readonly safeMax: number;
  /** Maximum percentage change per cycle */
  readonly changeLimit: Percentage;
  /** Minimum time between changes (ms) */
  readonly cooldown: Duration;
}

/**
 * Network measurement counter
 * 5,416 counters across 344 features
 */
export interface ICounter {
  readonly name: string;
  readonly description: string;
  readonly featureId: FeatureId;
  readonly category: CounterCategory;
  readonly unit: Unit;
  readonly aggregation: 'sum' | 'avg' | 'max' | 'min' | 'last';
}

/**
 * Key Performance Indicator
 * 736 KPIs across 156 features
 */
export interface IKPI {
  readonly name: string;
  readonly description: string;
  readonly formula: string;
  readonly unit: Unit;
  readonly thresholds: IKPIThresholds;
  readonly targetValue?: number;
}

/**
 * KPI threshold configuration
 */
export interface IKPIThresholds {
  readonly critical: number;
  readonly warning: number;
  readonly target: number;
  readonly optimal?: number;
}

/**
 * Operational procedure for feature
 */
export interface IProcedure {
  readonly name: string;
  readonly description: string;
  readonly steps: IProcedureStep[];
  readonly prerequisites: string[];
  readonly postconditions: string[];
}

/**
 * Procedure step
 */
export interface IProcedureStep {
  readonly order: number;
  readonly action: string;
  readonly verification?: string;
  readonly rollback?: string;
}

/**
 * Feature catalog for all 593 features
 */
export interface IFeatureCatalog {
  /** Get feature by FAJ code */
  getByFAJCode(fajCode: FAJCode): IFeature | undefined;

  /** Get feature by ID */
  getById(id: FeatureId): IFeature | undefined;

  /** Get all features by category */
  getByCategory(category: Category): IFeature[];

  /** Get all features by access technology */
  getByAccessTechnology(technology: AccessTechnology): IFeature[];

  /** Get all feature IDs */
  getAllIds(): FeatureId[];

  /** Get total feature count */
  count(): number;

  /** Search features by text */
  search(query: string): IFeature[];
}
