/**
 * KnowledgeBase Entity
 *
 * Static knowledge layer containing feature metadata, parameters, counters, and KPIs.
 * This is the read-only knowledge repository for a Feature Agent.
 */

import { Feature } from './feature';
import { FAJCode } from '../value-objects/faj-code';
import { Parameter } from '../value-objects/parameter';
import { Counter } from '../value-objects/counter';
import { KPI } from '../value-objects/kpi';

export interface KnowledgeBaseStats {
  featureCount: number;
  parameterCount: number;
  counterCount: number;
  kpiCount: number;
  procedureCount: number;
}

export class KnowledgeBase {
  readonly id: string;
  private readonly _features: Map<string, Feature>;
  private readonly _featuresByFaj: Map<string, Feature>;

  constructor(id: string, features: Feature[] = []) {
    this.id = id;
    this._features = new Map();
    this._featuresByFaj = new Map();

    for (const feature of features) {
      this._features.set(feature.id, feature);
      this._featuresByFaj.set(feature.fajCode.toString(), feature);
    }
  }

  /**
   * Get all features
   */
  get features(): Feature[] {
    return Array.from(this._features.values());
  }

  /**
   * Get feature by ID
   */
  getFeature(id: string): Feature | undefined {
    return this._features.get(id);
  }

  /**
   * Get feature by FAJ code
   */
  getFeatureByFajCode(fajCode: FAJCode): Feature | undefined {
    return this._featuresByFaj.get(fajCode.toString());
  }

  /**
   * Get all parameters across all features
   */
  getAllParameters(): Parameter[] {
    const params: Parameter[] = [];
    for (const feature of this._features.values()) {
      params.push(...feature.parameters);
    }
    return params;
  }

  /**
   * Get all counters across all features
   */
  getAllCounters(): Counter[] {
    const counters: Counter[] = [];
    for (const feature of this._features.values()) {
      counters.push(...feature.counters);
    }
    return counters;
  }

  /**
   * Get all KPIs across all features
   */
  getAllKpis(): KPI[] {
    const kpis: KPI[] = [];
    for (const feature of this._features.values()) {
      kpis.push(...feature.kpis);
    }
    return kpis;
  }

  /**
   * Find parameter by name across all features
   */
  findParameter(name: string): { feature: Feature; parameter: Parameter } | undefined {
    for (const feature of this._features.values()) {
      const parameter = feature.getParameter(name);
      if (parameter) {
        return { feature, parameter };
      }
    }
    return undefined;
  }

  /**
   * Find counter by name across all features
   */
  findCounter(name: string): { feature: Feature; counter: Counter } | undefined {
    for (const feature of this._features.values()) {
      const counter = feature.getCounter(name);
      if (counter) {
        return { feature, counter };
      }
    }
    return undefined;
  }

  /**
   * Find KPI by name across all features
   */
  findKpi(name: string): { feature: Feature; kpi: KPI } | undefined {
    for (const feature of this._features.values()) {
      const kpi = feature.getKpi(name);
      if (kpi) {
        return { feature, kpi };
      }
    }
    return undefined;
  }

  /**
   * Get knowledge base statistics
   */
  getStats(): KnowledgeBaseStats {
    let parameterCount = 0;
    let counterCount = 0;
    let kpiCount = 0;
    let procedureCount = 0;

    for (const feature of this._features.values()) {
      parameterCount += feature.parameters.length;
      counterCount += feature.counters.length;
      kpiCount += feature.kpis.length;
      procedureCount += feature.procedures.length;
    }

    return {
      featureCount: this._features.size,
      parameterCount,
      counterCount,
      kpiCount,
      procedureCount
    };
  }

  /**
   * Check if knowledge base contains a feature
   */
  hasFeature(id: string): boolean {
    return this._features.has(id);
  }

  /**
   * Check if knowledge base contains a feature by FAJ code
   */
  hasFeatureByFajCode(fajCode: FAJCode): boolean {
    return this._featuresByFaj.has(fajCode.toString());
  }

  /**
   * Identity equality
   */
  equals(other: KnowledgeBase): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const stats = this.getStats();
    return `KnowledgeBase(${this.id}): ${stats.featureCount} features, ${stats.parameterCount} parameters`;
  }
}
