/**
 * Edge Persistence
 * Local storage abstraction for edge deployment
 *
 * Storage backends:
 * - Browser: IndexedDB
 * - Mobile: SQLite (via native bridge)
 * - Node.js: File system
 *
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 */

import { DeploymentMode } from '../../../core/types/enums.js';

export interface IEdgePersistenceConfig {
  /** Deployment mode determines storage backend */
  mode: DeploymentMode;
  /** Database/store name */
  storeName?: string;
  /** Maximum storage size in bytes (soft limit) */
  maxSize?: number;
}

export interface IStorageStats {
  used: number;
  available: number;
  keyCount: number;
  maxSize: number;
}

/**
 * EdgePersistence provides storage abstraction for edge environments
 */
export class EdgePersistence {
  private readonly config: Required<IEdgePersistenceConfig>;
  private readonly dataStore: Map<string, Uint8Array>;
  private totalSize: number;

  constructor(config: IEdgePersistenceConfig) {
    this.config = {
      mode: config.mode,
      storeName: config.storeName ?? 'elex-agent-store',
      maxSize: config.maxSize ?? 50 * 1024 * 1024, // 50MB default
    };

    this.dataStore = new Map();
    this.totalSize = 0;
  }

  /**
   * Initialize persistence layer
   */
  async initialize(): Promise<void> {
    switch (this.config.mode) {
      case DeploymentMode.Browser:
        // In production: Initialize IndexedDB
        break;
      case DeploymentMode.Mobile:
        // In production: Initialize SQLite
        break;
      case DeploymentMode.EdgeServer:
        // In production: Initialize file system storage
        break;
    }
  }

  /**
   * Store data
   */
  async store(key: string, value: Uint8Array): Promise<void> {
    const existingSize = this.dataStore.get(key)?.length ?? 0;
    const newSize = this.totalSize - existingSize + value.length;

    if (newSize > this.config.maxSize) {
      throw new Error(
        `Storage limit exceeded: ${newSize} > ${this.config.maxSize}`
      );
    }

    this.dataStore.set(key, value);
    this.totalSize = newSize;
  }

  /**
   * Retrieve data
   */
  async retrieve(key: string): Promise<Uint8Array | undefined> {
    return this.dataStore.get(key);
  }

  /**
   * Delete data
   */
  async delete(key: string): Promise<void> {
    const existing = this.dataStore.get(key);
    if (existing) {
      this.totalSize -= existing.length;
      this.dataStore.delete(key);
    }
  }

  /**
   * List all keys
   */
  async keys(): Promise<string[]> {
    return Array.from(this.dataStore.keys());
  }

  /**
   * Get storage size
   */
  async size(): Promise<number> {
    return this.totalSize;
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.dataStore.clear();
    this.totalSize = 0;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<IStorageStats> {
    return {
      used: this.totalSize,
      available: this.config.maxSize - this.totalSize,
      keyCount: this.dataStore.size,
      maxSize: this.config.maxSize,
    };
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return this.dataStore.has(key);
  }

  /**
   * Store JSON data
   */
  async storeJSON<T>(key: string, value: T): Promise<void> {
    const json = JSON.stringify(value);
    const encoder = new TextEncoder();
    await this.store(key, encoder.encode(json));
  }

  /**
   * Retrieve JSON data
   */
  async retrieveJSON<T>(key: string): Promise<T | undefined> {
    const data = await this.retrieve(key);
    if (!data) return undefined;

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(data)) as T;
  }
}
