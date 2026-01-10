/**
 * CounterCatalog Entity
 *
 * Catalog of all network measurement counters indexed for efficient lookup.
 * Supports searching by name, category, and feature.
 */

import { Counter, CounterCategory, FeatureId } from '../value-objects/counter';

export interface CounterCatalogEntry {
  readonly counter: Counter;
  readonly featureId: FeatureId;
  readonly featureName: string;
  readonly fajCode: string;
}

export class CounterCatalog {
  readonly id: string;
  private readonly _entries: Map<string, CounterCatalogEntry>;
  private readonly _byFeature: Map<string, CounterCatalogEntry[]>;
  private readonly _byCategory: Map<CounterCategory, CounterCatalogEntry[]>;

  constructor(id: string) {
    this.id = id;
    this._entries = new Map();
    this._byFeature = new Map();
    this._byCategory = new Map();
  }

  /**
   * Add a counter to the catalog
   */
  add(entry: CounterCatalogEntry): void {
    const key = `${entry.featureId}:${entry.counter.name}`;
    this._entries.set(key, entry);

    // Index by feature
    const featureEntries = this._byFeature.get(entry.featureId) ?? [];
    featureEntries.push(entry);
    this._byFeature.set(entry.featureId, featureEntries);

    // Index by category
    const categoryEntries = this._byCategory.get(entry.counter.category) ?? [];
    categoryEntries.push(entry);
    this._byCategory.set(entry.counter.category, categoryEntries);
  }

  /**
   * Get counter by feature ID and name
   */
  get(featureId: string, counterName: string): CounterCatalogEntry | undefined {
    return this._entries.get(`${featureId}:${counterName}`);
  }

  /**
   * Get all counters for a feature
   */
  getByFeature(featureId: string): CounterCatalogEntry[] {
    return this._byFeature.get(featureId) ?? [];
  }

  /**
   * Get all counters by category
   */
  getByCategory(category: CounterCategory): CounterCatalogEntry[] {
    return this._byCategory.get(category) ?? [];
  }

  /**
   * Get all primary counters
   */
  getPrimaryCounters(): CounterCatalogEntry[] {
    return this.getByCategory('Primary');
  }

  /**
   * Get all contributing counters
   */
  getContributingCounters(): CounterCatalogEntry[] {
    return this.getByCategory('Contributing');
  }

  /**
   * Get all contextual counters
   */
  getContextualCounters(): CounterCatalogEntry[] {
    return this.getByCategory('Contextual');
  }

  /**
   * Find counters by name (may return multiple if same name in different features)
   */
  findByName(name: string): CounterCatalogEntry[] {
    const results: CounterCatalogEntry[] = [];
    for (const entry of this._entries.values()) {
      if (entry.counter.name === name) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Find counters matching a pattern
   */
  findByPattern(pattern: RegExp): CounterCatalogEntry[] {
    const results: CounterCatalogEntry[] = [];
    for (const entry of this._entries.values()) {
      if (pattern.test(entry.counter.name)) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Get all entries
   */
  getAll(): CounterCatalogEntry[] {
    return Array.from(this._entries.values());
  }

  /**
   * Get total count
   */
  get count(): number {
    return this._entries.size;
  }

  /**
   * Get feature count
   */
  get featureCount(): number {
    return this._byFeature.size;
  }

  /**
   * Check if catalog contains a counter
   */
  has(featureId: string, counterName: string): boolean {
    return this._entries.has(`${featureId}:${counterName}`);
  }

  /**
   * Identity equality
   */
  equals(other: CounterCatalog): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `CounterCatalog(${this.id}): ${this.count} counters across ${this.featureCount} features`;
  }
}
