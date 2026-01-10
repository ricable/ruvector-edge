/**
 * ResourceManager Entity
 *
 * Manages compute, memory, storage, and network resources for agent execution.
 * Enforces limits and monitors usage.
 */

import { ResourceLimits } from '../value-objects/deployment-config';

export interface ResourceUsage {
  readonly memoryMB: number;
  readonly cpuPercent: number;
  readonly storageMB: number;
  readonly networkBps: number;
}

export interface ResourceAllocation {
  readonly id: string;
  readonly type: 'agent' | 'wasm' | 'storage' | 'network';
  readonly memoryMB: number;
  readonly allocatedAt: Date;
}

export type ResourceState = 'healthy' | 'warning' | 'critical';

/**
 * ResourceManager Entity
 */
export class ResourceManager {
  readonly id: string;
  private _limits: ResourceLimits;
  private _allocations: Map<string, ResourceAllocation>;
  private _usage: ResourceUsage;
  private _usageHistory: Array<{ timestamp: Date; usage: ResourceUsage }>;
  private _maxHistoryLength: number;

  constructor(id: string, limits: ResourceLimits) {
    this.id = id;
    this._limits = limits;
    this._allocations = new Map();
    this._usage = {
      memoryMB: 0,
      cpuPercent: 0,
      storageMB: 0,
      networkBps: 0
    };
    this._usageHistory = [];
    this._maxHistoryLength = 100;
  }

  /**
   * Allocate resources
   */
  allocate(
    allocationId: string,
    type: 'agent' | 'wasm' | 'storage' | 'network',
    memoryMB: number
  ): boolean {
    // Check if allocation would exceed limits
    const projectedMemory = this._usage.memoryMB + memoryMB;
    if (projectedMemory > this._limits.maxMemoryMB) {
      return false;
    }

    const allocation: ResourceAllocation = {
      id: allocationId,
      type,
      memoryMB,
      allocatedAt: new Date()
    };

    this._allocations.set(allocationId, allocation);
    this.updateUsage();
    return true;
  }

  /**
   * Release allocated resources
   */
  release(allocationId: string): boolean {
    const deleted = this._allocations.delete(allocationId);
    if (deleted) {
      this.updateUsage();
    }
    return deleted;
  }

  /**
   * Update current resource usage
   */
  updateUsage(): void {
    let totalMemory = 0;
    for (const allocation of this._allocations.values()) {
      totalMemory += allocation.memoryMB;
    }

    this._usage = {
      ...this._usage,
      memoryMB: totalMemory
    };

    // Record in history
    this._usageHistory.push({
      timestamp: new Date(),
      usage: { ...this._usage }
    });

    // Trim history
    if (this._usageHistory.length > this._maxHistoryLength) {
      this._usageHistory = this._usageHistory.slice(-this._maxHistoryLength);
    }
  }

  /**
   * Set CPU usage (from external monitoring)
   */
  setCpuUsage(cpuPercent: number): void {
    this._usage = { ...this._usage, cpuPercent };
  }

  /**
   * Set storage usage
   */
  setStorageUsage(storageMB: number): void {
    this._usage = { ...this._usage, storageMB };
  }

  /**
   * Set network usage
   */
  setNetworkUsage(networkBps: number): void {
    this._usage = { ...this._usage, networkBps };
  }

  /**
   * Check if resources are available
   */
  canAllocate(memoryMB: number): boolean {
    return this._usage.memoryMB + memoryMB <= this._limits.maxMemoryMB;
  }

  /**
   * Get resource utilization percentages
   */
  getUtilization(): {
    memory: number;
    cpu: number;
    storage: number;
    network: number;
  } {
    return {
      memory: this._limits.maxMemoryMB > 0 ? this._usage.memoryMB / this._limits.maxMemoryMB : 0,
      cpu: this._limits.maxCpuPercent > 0 ? this._usage.cpuPercent / this._limits.maxCpuPercent : 0,
      storage: this._limits.maxStorageMB > 0 ? this._usage.storageMB / this._limits.maxStorageMB : 0,
      network: this._limits.maxNetworkBps > 0 ? this._usage.networkBps / this._limits.maxNetworkBps : 0
    };
  }

  /**
   * Get overall resource state
   */
  getState(): ResourceState {
    const utilization = this.getUtilization();
    const maxUtil = Math.max(utilization.memory, utilization.cpu, utilization.storage);

    if (maxUtil >= 0.9) {
      return 'critical';
    }
    if (maxUtil >= 0.7) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Get allocations by type
   */
  getAllocationsByType(type: 'agent' | 'wasm' | 'storage' | 'network'): ResourceAllocation[] {
    return Array.from(this._allocations.values()).filter(a => a.type === type);
  }

  /**
   * Get available memory
   */
  getAvailableMemory(): number {
    return Math.max(0, this._limits.maxMemoryMB - this._usage.memoryMB);
  }

  /**
   * Get usage history
   */
  getUsageHistory(limit: number = 10): Array<{ timestamp: Date; usage: ResourceUsage }> {
    return this._usageHistory.slice(-limit);
  }

  /**
   * Calculate average usage over history
   */
  getAverageUsage(): ResourceUsage {
    if (this._usageHistory.length === 0) {
      return this._usage;
    }

    const sum = this._usageHistory.reduce(
      (acc, entry) => ({
        memoryMB: acc.memoryMB + entry.usage.memoryMB,
        cpuPercent: acc.cpuPercent + entry.usage.cpuPercent,
        storageMB: acc.storageMB + entry.usage.storageMB,
        networkBps: acc.networkBps + entry.usage.networkBps
      }),
      { memoryMB: 0, cpuPercent: 0, storageMB: 0, networkBps: 0 }
    );

    const count = this._usageHistory.length;
    return {
      memoryMB: sum.memoryMB / count,
      cpuPercent: sum.cpuPercent / count,
      storageMB: sum.storageMB / count,
      networkBps: sum.networkBps / count
    };
  }

  // Getters
  get limits(): ResourceLimits { return this._limits; }
  get usage(): ResourceUsage { return this._usage; }
  get allocationCount(): number { return this._allocations.size; }

  equals(other: ResourceManager): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const util = this.getUtilization();
    return `ResourceManager(${this.id}, mem=${(util.memory * 100).toFixed(1)}%, state=${this.getState()})`;
  }
}
