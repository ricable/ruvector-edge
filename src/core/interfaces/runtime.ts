/**
 * @fileoverview Runtime interfaces for edge deployment
 * @module @ruvector/edge/core/interfaces/runtime
 *
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 */

import type { AgentId, FAJCode } from '../types/identifiers.js';
import type { DeploymentMode } from '../types/enums.js';
import type { Timestamp, Duration } from '../types/primitives.js';

/**
 * WASM runtime interface
 * ~364KB per agent binary
 */
export interface IWASMRuntime {
  /** Load WASM module */
  load(wasmUrl: string): Promise<void>;

  /** Initialize WASM instance */
  initialize(config: IWASMConfig): Promise<void>;

  /** Execute WASM function */
  execute<T>(functionName: string, args: unknown[]): Promise<T>;

  /** Get memory usage */
  getMemoryUsage(): IMemoryUsage;

  /** Cleanup and unload */
  unload(): Promise<void>;
}

/**
 * WASM configuration
 */
export interface IWASMConfig {
  readonly memoryPages: number;
  readonly tableSize: number;
  readonly sharedMemory: boolean;
}

/**
 * Memory usage statistics
 */
export interface IMemoryUsage {
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly wasmMemory: number;
  readonly vectorIndex: number;
  readonly qTable: number;
}

/**
 * Edge runtime environment
 */
export interface IEdgeRuntime {
  readonly mode: DeploymentMode;
  readonly agentId: AgentId;

  /** Start runtime */
  start(): Promise<void>;

  /** Stop runtime */
  stop(): Promise<void>;

  /** Get runtime status */
  getStatus(): IRuntimeStatus;

  /** Get runtime metrics */
  getMetrics(): IRuntimeMetrics;
}

/**
 * Runtime status
 */
export interface IRuntimeStatus {
  readonly running: boolean;
  readonly mode: DeploymentMode;
  readonly uptime: Duration;
  readonly lastError?: string;
  readonly connectedPeers: number;
}

/**
 * Runtime performance metrics
 */
export interface IRuntimeMetrics {
  readonly queriesProcessed: number;
  readonly averageLatencyMs: number;
  readonly memoryUsage: IMemoryUsage;
  readonly cpuUsage: number;
  readonly networkBytes: INetworkBytes;
}

/**
 * Network bytes transferred
 */
export interface INetworkBytes {
  readonly sent: number;
  readonly received: number;
}

/**
 * Browser-specific runtime
 */
export interface IBrowserRuntime extends IEdgeRuntime {
  readonly mode: DeploymentMode.Browser;

  /** Handle visibility change (tab focus) */
  onVisibilityChange(visible: boolean): void;

  /** Handle page unload */
  onUnload(): Promise<void>;

  /** Get IndexedDB storage usage */
  getStorageUsage(): Promise<number>;
}

/**
 * Mobile-specific runtime
 */
export interface IMobileRuntime extends IEdgeRuntime {
  readonly mode: DeploymentMode.Mobile;

  /** Handle app state change */
  onAppStateChange(state: 'active' | 'background' | 'inactive'): void;

  /** Get battery status */
  getBatteryStatus(): Promise<IBatteryStatus>;

  /** Handle network change */
  onNetworkChange(type: 'wifi' | 'cellular' | 'offline'): void;
}

/**
 * Battery status for mobile
 */
export interface IBatteryStatus {
  readonly level: number;
  readonly charging: boolean;
  readonly timeToEmpty?: Duration;
}

/**
 * Edge server runtime (Node.js)
 */
export interface IEdgeServerRuntime extends IEdgeRuntime {
  readonly mode: DeploymentMode.EdgeServer;

  /** Get cluster info */
  getClusterInfo(): IClusterInfo;

  /** Handle graceful shutdown */
  onShutdown(signal: string): Promise<void>;

  /** Get disk usage */
  getDiskUsage(): Promise<IDiskUsage>;
}

/**
 * Cluster information
 */
export interface IClusterInfo {
  readonly nodeId: string;
  readonly totalNodes: number;
  readonly isLeader: boolean;
  readonly peers: string[];
}

/**
 * Disk usage
 */
export interface IDiskUsage {
  readonly total: number;
  readonly used: number;
  readonly available: number;
  readonly dataPath: string;
}

/**
 * Persistence layer for edge storage
 */
export interface IEdgePersistence {
  /** Store data */
  store(key: string, value: Uint8Array): Promise<void>;

  /** Retrieve data */
  retrieve(key: string): Promise<Uint8Array | undefined>;

  /** Delete data */
  delete(key: string): Promise<void>;

  /** List all keys */
  keys(): Promise<string[]>;

  /** Get storage size */
  size(): Promise<number>;

  /** Clear all data */
  clear(): Promise<void>;
}

/**
 * State synchronization for agent state
 */
export interface IStateSynchronizer {
  /** Sync state with peers */
  sync(): Promise<void>;

  /** Get last sync timestamp */
  getLastSync(): Timestamp;

  /** Get sync status */
  getSyncStatus(): ISyncStatus;

  /** Force full resync */
  forceResync(): Promise<void>;
}

/**
 * Sync status
 */
export interface ISyncStatus {
  readonly inProgress: boolean;
  readonly lastSuccess: Timestamp;
  readonly lastError?: string;
  readonly pendingUpdates: number;
}

/**
 * Health check interface
 */
export interface IHealthCheck {
  /** Run health check */
  check(): Promise<IHealthResult>;

  /** Get component health */
  getComponentHealth(component: string): IComponentHealth;
}

/**
 * Health check result
 */
export interface IHealthResult {
  readonly healthy: boolean;
  readonly components: IComponentHealth[];
  readonly timestamp: Timestamp;
}

/**
 * Component health status
 */
export interface IComponentHealth {
  readonly name: string;
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly error?: string;
}
