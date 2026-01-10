/**
 * ELEX Edge AI Agent Swarm - Feature Catalog
 *
 * Central catalog for 593 Ericsson RAN feature definitions.
 * Provides O(1) lookup by FAJ code and various filtering capabilities.
 */

import type {
  FAJCode,
  FeatureId,
  Feature,
  ParameterDefinition,
  CounterDefinition,
  KPIDefinition,
} from '../types/index.js';
import { Category, AccessTechnology } from '../types/index.js';

/**
 * Catalog statistics
 */
export interface CatalogStats {
  totalFeatures: number;
  totalParameters: number;
  totalCounters: number;
  totalKPIs: number;
  byCategory: Record<Category, number>;
  byTechnology: Record<AccessTechnology, number>;
}

/**
 * Feature search options
 */
export interface FeatureSearchOptions {
  name?: string;
  category?: Category;
  accessTechnology?: AccessTechnology;
  hasParameters?: boolean;
  hasCounters?: boolean;
  hasKPIs?: boolean;
  limit?: number;
}

/**
 * Feature Catalog
 *
 * Stores and provides access to all 593 Ericsson RAN feature definitions.
 * Supports:
 * - O(1) lookup by FAJ code and Feature ID
 * - Category-based filtering
 * - Technology-based filtering
 * - Full-text search on feature names
 */
export class FeatureCatalog {
  // Primary storage: FAJCode string -> Feature
  private readonly features = new Map<string, Feature>();

  // Index: FeatureId -> FAJCode string
  private readonly idIndex = new Map<FeatureId, string>();

  // Index: Category -> Set<FAJCode string>
  private readonly categoryIndex = new Map<Category, Set<string>>();

  // Index: AccessTechnology -> Set<FAJCode string>
  private readonly technologyIndex = new Map<AccessTechnology, Set<string>>();

  // Search index: lowercase name fragments -> FAJCode string
  private readonly nameIndex = new Map<string, Set<string>>();

  // Statistics cache
  private statsCache: CatalogStats | null = null;

  constructor() {
    // Initialize category index
    for (const category of Object.values(Category)) {
      this.categoryIndex.set(category, new Set());
    }

    // Initialize technology index
    for (const tech of Object.values(AccessTechnology)) {
      this.technologyIndex.set(tech, new Set());
    }
  }

  /**
   * Add a feature to the catalog
   */
  add(feature: Feature): void {
    const fajKey = feature.fajCode.toString();

    // Check for duplicates
    if (this.features.has(fajKey)) {
      throw new Error(`Feature already exists: ${fajKey}`);
    }

    // Store feature
    this.features.set(fajKey, feature);

    // Update ID index
    this.idIndex.set(feature.id, fajKey);

    // Update category index
    const categorySet = this.categoryIndex.get(feature.category);
    if (categorySet) {
      categorySet.add(fajKey);
    }

    // Update technology index
    const techSet = this.technologyIndex.get(feature.accessTechnology);
    if (techSet) {
      techSet.add(fajKey);
    }

    // Update name index (for search)
    this.indexName(feature.name, fajKey);

    // Invalidate stats cache
    this.statsCache = null;
  }

  /**
   * Add multiple features to the catalog
   */
  addAll(features: Feature[]): void {
    for (const feature of features) {
      this.add(feature);
    }
  }

  /**
   * Get a feature by FAJ code - O(1)
   */
  getByFajCode(fajCode: FAJCode): Feature | undefined {
    return this.features.get(fajCode.toString());
  }

  /**
   * Get a feature by ID - O(1)
   */
  getById(id: FeatureId): Feature | undefined {
    const fajKey = this.idIndex.get(id);
    if (!fajKey) {
      return undefined;
    }
    return this.features.get(fajKey);
  }

  /**
   * Check if a FAJ code exists
   */
  has(fajCode: FAJCode): boolean {
    return this.features.has(fajCode.toString());
  }

  /**
   * Get all features by category
   */
  getByCategory(category: Category): Feature[] {
    const fajKeys = this.categoryIndex.get(category);
    if (!fajKeys) {
      return [];
    }

    return Array.from(fajKeys)
      .map(key => this.features.get(key))
      .filter((f): f is Feature => f !== undefined);
  }

  /**
   * Get all features by access technology
   */
  getByAccessTechnology(technology: AccessTechnology): Feature[] {
    const fajKeys = this.technologyIndex.get(technology);
    if (!fajKeys) {
      return [];
    }

    return Array.from(fajKeys)
      .map(key => this.features.get(key))
      .filter((f): f is Feature => f !== undefined);
  }

  /**
   * Search features by name
   */
  searchByName(query: string, limit: number = 10): Feature[] {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);

    // Find matching FAJ codes from name index
    const matchCounts = new Map<string, number>();

    for (const word of words) {
      // Check exact match
      const exactMatches = this.nameIndex.get(word);
      if (exactMatches) {
        for (const fajKey of exactMatches) {
          matchCounts.set(fajKey, (matchCounts.get(fajKey) ?? 0) + 2);
        }
      }

      // Check prefix match
      for (const [indexed, fajKeys] of this.nameIndex) {
        if (indexed.startsWith(word) || word.startsWith(indexed)) {
          for (const fajKey of fajKeys) {
            matchCounts.set(fajKey, (matchCounts.get(fajKey) ?? 0) + 1);
          }
        }
      }
    }

    // Sort by match count and return top results
    return Array.from(matchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([fajKey]) => this.features.get(fajKey))
      .filter((f): f is Feature => f !== undefined);
  }

  /**
   * Search features with multiple criteria
   */
  search(options: FeatureSearchOptions): Feature[] {
    let candidates: Set<string>;

    // Start with narrowest filter
    if (options.category) {
      candidates = new Set(this.categoryIndex.get(options.category) ?? []);
    } else if (options.accessTechnology) {
      candidates = new Set(this.technologyIndex.get(options.accessTechnology) ?? []);
    } else if (options.name) {
      const nameResults = this.searchByName(options.name, 100);
      candidates = new Set(nameResults.map(f => f.fajCode.toString()));
    } else {
      candidates = new Set(this.features.keys());
    }

    // Apply additional filters
    const results: Feature[] = [];
    for (const fajKey of candidates) {
      if (options.limit && results.length >= options.limit) {
        break;
      }

      const feature = this.features.get(fajKey);
      if (!feature) continue;

      // Apply filters
      if (options.category && feature.category !== options.category) continue;
      if (options.accessTechnology && feature.accessTechnology !== options.accessTechnology) continue;
      if (options.hasParameters && feature.parameters.length === 0) continue;
      if (options.hasCounters && feature.counters.length === 0) continue;
      if (options.hasKPIs && feature.kpis.length === 0) continue;

      // Name filter (if not already filtered by name)
      if (options.name && !options.category && !options.accessTechnology) {
        // Already filtered
      } else if (options.name) {
        const lowerName = feature.name.toLowerCase();
        const lowerQuery = options.name.toLowerCase();
        if (!lowerName.includes(lowerQuery)) continue;
      }

      results.push(feature);
    }

    return results;
  }

  /**
   * Get all features
   */
  getAll(): Feature[] {
    return Array.from(this.features.values());
  }

  /**
   * Get all FAJ codes
   */
  getAllFajCodes(): FAJCode[] {
    return Array.from(this.features.values()).map(f => f.fajCode);
  }

  /**
   * Get the total number of features
   */
  get size(): number {
    return this.features.size;
  }

  /**
   * Get catalog statistics
   */
  getStats(): CatalogStats {
    if (this.statsCache) {
      return this.statsCache;
    }

    const stats: CatalogStats = {
      totalFeatures: this.features.size,
      totalParameters: 0,
      totalCounters: 0,
      totalKPIs: 0,
      byCategory: {} as Record<Category, number>,
      byTechnology: {} as Record<AccessTechnology, number>,
    };

    // Initialize counts
    for (const category of Object.values(Category)) {
      stats.byCategory[category] = 0;
    }
    for (const tech of Object.values(AccessTechnology)) {
      stats.byTechnology[tech] = 0;
    }

    // Calculate totals
    for (const feature of this.features.values()) {
      stats.totalParameters += feature.parameters.length;
      stats.totalCounters += feature.counters.length;
      stats.totalKPIs += feature.kpis.length;
      stats.byCategory[feature.category]++;
      stats.byTechnology[feature.accessTechnology]++;
    }

    this.statsCache = stats;
    return stats;
  }

  /**
   * Get all parameters across all features
   */
  getAllParameters(): Array<{ feature: Feature; parameter: ParameterDefinition }> {
    const result: Array<{ feature: Feature; parameter: ParameterDefinition }> = [];

    for (const feature of this.features.values()) {
      for (const parameter of feature.parameters) {
        result.push({ feature, parameter });
      }
    }

    return result;
  }

  /**
   * Get all counters across all features
   */
  getAllCounters(): Array<{ feature: Feature; counter: CounterDefinition }> {
    const result: Array<{ feature: Feature; counter: CounterDefinition }> = [];

    for (const feature of this.features.values()) {
      for (const counter of feature.counters) {
        result.push({ feature, counter });
      }
    }

    return result;
  }

  /**
   * Get all KPIs across all features
   */
  getAllKPIs(): Array<{ feature: Feature; kpi: KPIDefinition }> {
    const result: Array<{ feature: Feature; kpi: KPIDefinition }> = [];

    for (const feature of this.features.values()) {
      for (const kpi of feature.kpis) {
        result.push({ feature, kpi });
      }
    }

    return result;
  }

  /**
   * Find features that depend on a given feature
   */
  findDependents(fajCode: FAJCode): Feature[] {
    const id = this.features.get(fajCode.toString())?.id;
    if (!id) {
      return [];
    }

    return Array.from(this.features.values()).filter(
      f => f.dependencies.includes(id)
    );
  }

  /**
   * Find features that conflict with a given feature
   */
  findConflicts(fajCode: FAJCode): Feature[] {
    const id = this.features.get(fajCode.toString())?.id;
    if (!id) {
      return [];
    }

    return Array.from(this.features.values()).filter(
      f => f.conflicts.includes(id)
    );
  }

  /**
   * Clear the catalog
   */
  clear(): void {
    this.features.clear();
    this.idIndex.clear();
    this.nameIndex.clear();

    for (const set of this.categoryIndex.values()) {
      set.clear();
    }
    for (const set of this.technologyIndex.values()) {
      set.clear();
    }

    this.statsCache = null;
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Index feature name for search
   */
  private indexName(name: string, fajKey: string): void {
    const words = name.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (word.length < 2) continue;

      if (!this.nameIndex.has(word)) {
        this.nameIndex.set(word, new Set());
      }
      this.nameIndex.get(word)!.add(fajKey);
    }
  }
}

/**
 * Singleton catalog instance
 */
let globalCatalog: FeatureCatalog | null = null;

/**
 * Get the global feature catalog instance
 */
export function getGlobalCatalog(): FeatureCatalog {
  if (!globalCatalog) {
    globalCatalog = new FeatureCatalog();
  }
  return globalCatalog;
}

/**
 * Reset the global catalog (for testing)
 */
export function resetGlobalCatalog(): void {
  if (globalCatalog) {
    globalCatalog.clear();
  }
  globalCatalog = null;
}
