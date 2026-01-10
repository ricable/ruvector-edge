/**
 * ParameterCatalog Entity
 *
 * Catalog of all configurable network parameters indexed for efficient lookup.
 * Supports searching by name, category, and feature.
 */

import { Parameter, SafeZone } from '../value-objects/parameter';

export interface CatalogEntry {
  readonly parameter: Parameter;
  readonly featureId: string;
  readonly featureName: string;
  readonly fajCode: string;
}

export class ParameterCatalog {
  readonly id: string;
  private readonly _entries: Map<string, CatalogEntry>;
  private readonly _byFeature: Map<string, CatalogEntry[]>;

  constructor(id: string) {
    this.id = id;
    this._entries = new Map();
    this._byFeature = new Map();
  }

  /**
   * Add a parameter to the catalog
   */
  add(entry: CatalogEntry): void {
    const key = `${entry.featureId}:${entry.parameter.name}`;
    this._entries.set(key, entry);

    const featureEntries = this._byFeature.get(entry.featureId) ?? [];
    featureEntries.push(entry);
    this._byFeature.set(entry.featureId, featureEntries);
  }

  /**
   * Get parameter by feature ID and name
   */
  get(featureId: string, parameterName: string): CatalogEntry | undefined {
    return this._entries.get(`${featureId}:${parameterName}`);
  }

  /**
   * Get all parameters for a feature
   */
  getByFeature(featureId: string): CatalogEntry[] {
    return this._byFeature.get(featureId) ?? [];
  }

  /**
   * Find parameters by name (may return multiple if same name in different features)
   */
  findByName(name: string): CatalogEntry[] {
    const results: CatalogEntry[] = [];
    for (const entry of this._entries.values()) {
      if (entry.parameter.name === name) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Find parameters matching a pattern
   */
  findByPattern(pattern: RegExp): CatalogEntry[] {
    const results: CatalogEntry[] = [];
    for (const entry of this._entries.values()) {
      if (pattern.test(entry.parameter.name)) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Get all parameters with unsafe values (outside safe zone)
   */
  getUnsafeParameters(): CatalogEntry[] {
    return Array.from(this._entries.values()).filter(
      entry => !entry.parameter.isWithinSafeZone()
    );
  }

  /**
   * Get all entries
   */
  getAll(): CatalogEntry[] {
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
   * Check if catalog contains a parameter
   */
  has(featureId: string, parameterName: string): boolean {
    return this._entries.has(`${featureId}:${parameterName}`);
  }

  /**
   * Identity equality
   */
  equals(other: ParameterCatalog): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `ParameterCatalog(${this.id}): ${this.count} parameters across ${this.featureCount} features`;
  }
}
