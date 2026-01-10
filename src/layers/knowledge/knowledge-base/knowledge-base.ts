/**
 * Knowledge Base
 * Static knowledge storage for feature parameters, counters, and KPIs
 *
 * Memory Architecture Layer 1: Static Knowledge
 * - Feature Metadata (~3.2MB)
 * - Parameters, Counters, KPIs
 * - O(1) lookup
 *
 * @see docs/architecture.md
 */

import type {
  Feature,
  ParameterDefinition,
  CounterDefinition,
  KPIDefinition,
  Procedure,
} from '../../../core/types/interfaces.js';
import type { FeatureId, FAJCode } from '../../../core/types/ids.js';

export interface IKnowledgeBaseConfig {
  feature: Feature;
}

/**
 * KnowledgeBase provides O(1) access to static feature knowledge
 */
export class KnowledgeBase {
  private readonly feature: Feature;
  private readonly parametersByName: Map<string, ParameterDefinition>;
  private readonly countersByName: Map<string, CounterDefinition>;
  private readonly kpisByName: Map<string, KPIDefinition>;
  private readonly proceduresByName: Map<string, Procedure>;

  constructor(config: IKnowledgeBaseConfig) {
    this.feature = config.feature;

    // Build lookup indexes for O(1) access
    this.parametersByName = new Map(
      config.feature.parameters.map(p => [p.name.toLowerCase(), p])
    );
    this.countersByName = new Map(
      config.feature.counters.map(c => [c.name.toLowerCase(), c])
    );
    this.kpisByName = new Map(
      config.feature.kpis.map(k => [k.name.toLowerCase(), k])
    );
    this.proceduresByName = new Map(
      config.feature.procedures.map(p => [p.name.toLowerCase(), p])
    );
  }

  /**
   * Get feature ID
   */
  getFeatureId(): FeatureId {
    return this.feature.id;
  }

  /**
   * Get FAJ code
   */
  getFajCode(): FAJCode {
    return this.feature.fajCode;
  }

  /**
   * Get feature name
   */
  getFeatureName(): string {
    return this.feature.name;
  }

  /**
   * Get feature description
   */
  getDescription(): string | undefined {
    return this.feature.description;
  }

  /**
   * Get parameter by name (O(1) lookup)
   */
  getParameter(name: string): ParameterDefinition | undefined {
    return this.parametersByName.get(name.toLowerCase());
  }

  /**
   * Get all parameters
   */
  getAllParameters(): ParameterDefinition[] {
    return this.feature.parameters;
  }

  /**
   * Get counter by name (O(1) lookup)
   */
  getCounter(name: string): CounterDefinition | undefined {
    return this.countersByName.get(name.toLowerCase());
  }

  /**
   * Get all counters
   */
  getAllCounters(): CounterDefinition[] {
    return this.feature.counters;
  }

  /**
   * Get KPI by name (O(1) lookup)
   */
  getKPI(name: string): KPIDefinition | undefined {
    return this.kpisByName.get(name.toLowerCase());
  }

  /**
   * Get all KPIs
   */
  getAllKPIs(): KPIDefinition[] {
    return this.feature.kpis;
  }

  /**
   * Get procedure by name (O(1) lookup)
   */
  getProcedure(name: string): Procedure | undefined {
    return this.proceduresByName.get(name.toLowerCase());
  }

  /**
   * Get all procedures
   */
  getAllProcedures(): Procedure[] {
    return this.feature.procedures;
  }

  /**
   * Get related feature IDs
   */
  getRelatedFeatures(): FeatureId[] {
    return this.feature.relatedFeatures;
  }

  /**
   * Get feature dependencies
   */
  getDependencies(): FeatureId[] {
    return this.feature.dependencies;
  }

  /**
   * Get conflicting features
   */
  getConflicts(): FeatureId[] {
    return this.feature.conflicts;
  }

  /**
   * Search within knowledge base
   */
  search(query: string): {
    parameters: ParameterDefinition[];
    counters: CounterDefinition[];
    kpis: KPIDefinition[];
    procedures: Procedure[];
  } {
    const lowerQuery = query.toLowerCase();

    return {
      parameters: this.feature.parameters.filter(
        p => p.name.toLowerCase().includes(lowerQuery) ||
             p.description?.toLowerCase().includes(lowerQuery)
      ),
      counters: this.feature.counters.filter(
        c => c.name.toLowerCase().includes(lowerQuery) ||
             c.description?.toLowerCase().includes(lowerQuery)
      ),
      kpis: this.feature.kpis.filter(
        k => k.name.toLowerCase().includes(lowerQuery) ||
             k.description?.toLowerCase().includes(lowerQuery)
      ),
      procedures: this.feature.procedures.filter(
        p => p.name.toLowerCase().includes(lowerQuery) ||
             p.description?.toLowerCase().includes(lowerQuery)
      ),
    };
  }

  /**
   * Get knowledge base statistics
   */
  getStats(): {
    parameterCount: number;
    counterCount: number;
    kpiCount: number;
    procedureCount: number;
    dependencyCount: number;
    conflictCount: number;
  } {
    return {
      parameterCount: this.feature.parameters.length,
      counterCount: this.feature.counters.length,
      kpiCount: this.feature.kpis.length,
      procedureCount: this.feature.procedures.length,
      dependencyCount: this.feature.dependencies.length,
      conflictCount: this.feature.conflicts.length,
    };
  }

  /**
   * Export feature data
   */
  toFeature(): Feature {
    return { ...this.feature };
  }
}
