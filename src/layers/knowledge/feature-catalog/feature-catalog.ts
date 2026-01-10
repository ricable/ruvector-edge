/**
 * Feature Catalog
 * Central registry for all 593 Ericsson RAN features
 *
 * @see ADR-004: One Agent Per Feature Specialization
 */

import type {
  Feature,
  ParameterDefinition,
  CounterDefinition,
  KPIDefinition,
} from '../../../core/types/interfaces.js';
import type { FeatureId, FAJCode } from '../../../core/types/ids.js';
import { Category, AccessTechnology } from '../../../core/types/enums.js';

export interface IFeatureCatalogConfig {
  /** Path to feature data file or inline data */
  dataSource?: string | Feature[];
}

/**
 * FeatureCatalog manages the 593 specialized RAN features
 *
 * Distribution:
 * - LTE: 307 features (51.8%)
 * - NR/5G: 284 features (47.9%)
 * - Cross-RAT: 2 features (0.2%)
 *
 * Category breakdown:
 * - NR/5G: 130 (21.9%)
 * - RRM: 76 (12.8%)
 * - Mobility: 48 (8.1%)
 * - CA: 47 (7.9%)
 * - MIMO: 42 (7.1%)
 * - Coverage: 37 (6.2%)
 * - Transport: 25 (4.2%)
 * - Voice/IMS: 16 (2.7%)
 * - Interference: 14 (2.4%)
 * - QoS: 12 (2.0%)
 * - Timing: 10 (1.7%)
 * - Security: 8 (1.3%)
 * - Energy: 7 (1.2%)
 * - UE: 7 (1.2%)
 * - Other: 114 (19.2%)
 */
export class FeatureCatalog {
  private readonly features: Map<FeatureId, Feature>;
  private readonly byFajCode: Map<string, FeatureId>;
  private readonly byCategory: Map<Category, FeatureId[]>;
  private readonly byTechnology: Map<AccessTechnology, FeatureId[]>;

  constructor(config?: IFeatureCatalogConfig) {
    this.features = new Map();
    this.byFajCode = new Map();
    this.byCategory = new Map();
    this.byTechnology = new Map();

    // Initialize category and technology maps
    for (const category of Object.values(Category)) {
      this.byCategory.set(category, []);
    }
    for (const tech of Object.values(AccessTechnology)) {
      this.byTechnology.set(tech, []);
    }

    // Load features if data provided
    if (config?.dataSource) {
      if (Array.isArray(config.dataSource)) {
        this.loadFeatures(config.dataSource);
      }
    }
  }

  /**
   * Load features into catalog
   */
  loadFeatures(features: Feature[]): void {
    for (const feature of features) {
      this.addFeature(feature);
    }
  }

  /**
   * Add a single feature to catalog
   */
  addFeature(feature: Feature): void {
    this.features.set(feature.id, feature);
    this.byFajCode.set(feature.fajCode.toString(), feature.id);

    // Index by category
    const categoryList = this.byCategory.get(feature.category) ?? [];
    categoryList.push(feature.id);
    this.byCategory.set(feature.category, categoryList);

    // Index by technology
    const techList = this.byTechnology.get(feature.accessTechnology) ?? [];
    techList.push(feature.id);
    this.byTechnology.set(feature.accessTechnology, techList);
  }

  /**
   * Get feature by ID
   */
  getById(id: FeatureId): Feature | undefined {
    return this.features.get(id);
  }

  /**
   * Get feature by FAJ code
   */
  getByFajCode(fajCode: FAJCode): Feature | undefined {
    const id = this.byFajCode.get(fajCode.toString());
    return id ? this.features.get(id) : undefined;
  }

  /**
   * Get all features in a category
   */
  getByCategory(category: Category): Feature[] {
    const ids = this.byCategory.get(category) ?? [];
    return ids.map(id => this.features.get(id)!).filter(Boolean);
  }

  /**
   * Get all features for an access technology
   */
  getByTechnology(technology: AccessTechnology): Feature[] {
    const ids = this.byTechnology.get(technology) ?? [];
    return ids.map(id => this.features.get(id)!).filter(Boolean);
  }

  /**
   * Get all feature IDs
   */
  getAllIds(): FeatureId[] {
    return Array.from(this.features.keys());
  }

  /**
   * Get total feature count
   */
  count(): number {
    return this.features.size;
  }

  /**
   * Get count by category
   */
  countByCategory(): Map<Category, number> {
    const counts = new Map<Category, number>();
    for (const [category, ids] of this.byCategory) {
      counts.set(category, ids.length);
    }
    return counts;
  }

  /**
   * Get count by technology
   */
  countByTechnology(): Map<AccessTechnology, number> {
    const counts = new Map<AccessTechnology, number>();
    for (const [tech, ids] of this.byTechnology) {
      counts.set(tech, ids.length);
    }
    return counts;
  }

  /**
   * Search features by text query
   */
  search(query: string): Feature[] {
    const lowerQuery = query.toLowerCase();
    const results: Feature[] = [];

    for (const feature of this.features.values()) {
      if (
        feature.name.toLowerCase().includes(lowerQuery) ||
        feature.fajCode.toString().toLowerCase().includes(lowerQuery) ||
        feature.description?.toLowerCase().includes(lowerQuery)
      ) {
        results.push(feature);
      }
    }

    return results;
  }

  /**
   * Get all parameters across all features
   */
  getAllParameters(): ParameterDefinition[] {
    const params: ParameterDefinition[] = [];
    for (const feature of this.features.values()) {
      params.push(...feature.parameters);
    }
    return params;
  }

  /**
   * Get all counters across all features
   */
  getAllCounters(): CounterDefinition[] {
    const counters: CounterDefinition[] = [];
    for (const feature of this.features.values()) {
      counters.push(...feature.counters);
    }
    return counters;
  }

  /**
   * Get all KPIs across all features
   */
  getAllKPIs(): KPIDefinition[] {
    const kpis: KPIDefinition[] = [];
    for (const feature of this.features.values()) {
      kpis.push(...feature.kpis);
    }
    return kpis;
  }

  /**
   * Get catalog statistics
   */
  getStats(): {
    totalFeatures: number;
    byTechnology: Record<string, number>;
    byCategory: Record<string, number>;
    totalParameters: number;
    totalCounters: number;
    totalKPIs: number;
  } {
    const byTech: Record<string, number> = {};
    const byCat: Record<string, number> = {};

    for (const [tech, ids] of this.byTechnology) {
      byTech[tech] = ids.length;
    }
    for (const [cat, ids] of this.byCategory) {
      byCat[cat] = ids.length;
    }

    return {
      totalFeatures: this.features.size,
      byTechnology: byTech,
      byCategory: byCat,
      totalParameters: this.getAllParameters().length,
      totalCounters: this.getAllCounters().length,
      totalKPIs: this.getAllKPIs().length,
    };
  }
}
