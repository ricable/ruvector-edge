/**
 * ELEX WASM - TypeScript Definitions
 *
 * Type definitions for the ELEX Edge AI Agent Swarm WASM module.
 * Provides comprehensive typing for all exported functions, classes, and enums.
 */

/**
 * Query type classification
 */
export enum QueryType {
  Parameter = 0,
  Counter = 1,
  Kpi = 2,
  Procedure = 3,
  Troubleshoot = 4,
  General = 5,
}

/**
 * Query complexity classification
 */
export enum Complexity {
  Simple = 0,
  Moderate = 1,
  Complex = 2,
}

/**
 * Swarm topology options
 */
export class Topology {
  /**
   * Mesh topology - all agents connected to all others
   */
  static mesh(): Topology;

  /**
   * Hierarchical topology - coordinators manage agent groups
   */
  static hierarchical(): Topology;

  /**
   * Hierarchical-mesh topology - hybrid approach (recommended)
   */
  static hierarchical_mesh(): Topology;
}

/**
 * Configuration options for ElexSwarm initialization
 */
export interface SwarmConfig {
  /**
   * Swarm topology configuration
   */
  topology?: Topology;

  /**
   * Maximum number of agents to keep in memory
   * @default 50
   */
  maxAgents?: number;

  /**
   * Enable telemetry and performance monitoring
   * @default true
   */
  enableTelemetry?: boolean;

  /**
   * Enable IndexedDB persistence
   * @default true
   */
  enableIndexedDB?: boolean;

  /**
   * Cache size limit in MB
   * @default 50
   */
  cacheSizeMB?: number;

  /**
   * Enable lazy loading of agents
   * @default true
   */
  lazyLoading?: boolean;

  /**
   * Enable automatic federated sync
   * @default true
   */
  autoSync?: boolean;

  /**
   * Sync interval in milliseconds
   * @default 60000
   */
  syncIntervalMs?: number;
}

/**
 * Query object for swarm queries
 */
export interface Query {
  /**
   * Query text
   */
  text: string;

  /**
   * Query type classification
   */
  queryType: QueryType;

  /**
   * Query complexity
   */
  complexity: Complexity;

  /**
   * Optional context hash for deduplication
   */
  context?: number;
}

/**
 * Response from a swarm query
 */
export interface QueryResponse {
  /**
   * Response text
   */
  text: string;

  /**
   * ID of the agent that generated the response
   */
  agentId: string;

  /**
   * Feature code of the responding agent
   */
  featureCode: string;

  /**
   * Confidence score (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Response latency in milliseconds
   */
  latencyMs: number;

  /**
   * Any cmedit commands generated
   */
  cmeditCommands: string[];

  /**
   * Risk level assessment
   */
  riskLevel: string;

  /**
   * Response timestamp
   */
  timestamp: number;
}

/**
 * Statistics for an individual agent
 */
export interface AgentStats {
  /**
   * Agent unique identifier
   */
  agentId: string;

  /**
   * Feature code (e.g., "FAJ 121 3094")
   */
  featureCode: string;

  /**
   * Feature name
   */
  featureName: string;

  /**
   * Total queries processed
   */
  queryCount: number;

  /**
   * Successful responses
   */
  successCount: number;

  /**
   * Success rate (0.0 to 1.0)
   */
  successRate: number;

  /**
   * Average response latency in milliseconds
   */
  avgLatencyMs: number;

  /**
   * Agent confidence score (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Agent health score (0.0 to 1.0)
   */
  health: number;

  /**
   * Number of Q-table entries
   */
  qTableEntries: number;

  /**
   * Number of stored trajectories
   */
  trajectoryCount: number;

  /**
   * Current exploration rate (epsilon)
   */
  epsilon: number;

  /**
   * Number of vector memory entries
   */
  memoryEntries: number;

  /**
   * Agent status
   */
  status: string;
}

/**
 * Overall swarm statistics
 */
export interface SwarmStats {
  /**
   * Total number of agents
   */
  totalAgents: number;

  /**
   * Number of active agents
   */
  activeAgents: number;

  /**
   * Total queries processed
   */
  totalQueries: number;

  /**
   * Total successful responses
   */
  totalSuccesses: number;

  /**
   * Average latency in milliseconds
   */
  avgLatencyMs: number;

  /**
   * Cache hit rate (0.0 to 1.0)
   */
  cacheHitRate: number;

  /**
   * Memory usage in MB
   */
  memoryUsageMB: number;

  /**
   * Swarm uptime in milliseconds
   */
  uptimeMs: number;

  /**
   * Swarm topology type
   */
  topology: string;
}

/**
 * Main ELEX Swarm coordinator
 */
export class ElexSwarm {
  /**
   * Initialize a new ELEX swarm
   *
   * @param config - Swarm configuration options
   * @returns Promise that resolves to the initialized swarm
   *
   * @example
   * ```javascript
   * const swarm = await new ElexSwarm({
   *   topology: Topology.hierarchical_mesh(),
   *   maxAgents: 50,
   *   enableTelemetry: true
   * });
   * ```
   */
  constructor(config: SwarmConfig): Promise<ElexSwarm>;

  /**
   * Process a query through the swarm
   *
   * @param query - Query object with text, type, and complexity
   * @returns Promise that resolves to a QueryResponse
   *
   * @example
   * ```javascript
   * const response = await swarm.query({
   *   text: "Configure IFLB thresholds",
   *   queryType: QueryType.Parameter,
   *   complexity: Complexity.Moderate
   * });
   * ```
   */
  query(query: Query): Promise<QueryResponse>;

  /**
   * Provide feedback on a previous query (for Q-learning)
   *
   * @param agentId - ID of the agent that handled the query
   * @param reward - Reward signal (-1.0 to +1.0)
   * @param success - Whether the response was successful
   * @returns Promise that resolves when feedback is recorded
   */
  feedback(agentId: string, reward: number, success: boolean): Promise<void>;

  /**
   * Get statistics for a specific agent
   *
   * @param agentId - ID of the agent
   * @returns Promise that resolves to AgentStats
   */
  getAgentStats(agentId: string): Promise<AgentStats>;

  /**
   * Get overall swarm statistics
   *
   * @returns Promise that resolves to SwarmStats
   */
  getSwarmStats(): Promise<SwarmStats>;

  /**
   * Synchronize Q-tables with federated learning
   *
   * @returns Promise that resolves when sync is complete
   */
  sync(): Promise<void>;

  /**
   * Persist agent state to IndexedDB
   *
   * @returns Promise that resolves when persistence is complete
   */
  persist(): Promise<void>;

  /**
   * Shutdown the swarm and release resources
   *
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;
}

/**
 * Telemetry system for monitoring swarm performance
 */
export class TelemetrySystem {
  /**
   * Create a new telemetry system
   *
   * @param enabled - Whether to enable telemetry
   */
  constructor(enabled: boolean): TelemetrySystem;

  /**
   * Record a query metric
   *
   * @param latencyMs - Query latency in milliseconds
   * @param confidence - Response confidence score
   * @param agentId - Agent ID
   * @param featureCode - Feature code
   * @param queryType - Query type
   * @param complexity - Query complexity
   * @param success - Whether the query was successful
   */
  recordQuery(
    latencyMs: number,
    confidence: number,
    agentId: string,
    featureCode: string,
    queryType: string,
    complexity: string,
    success: boolean
  ): void;

  /**
   * Get all recorded metrics
   *
   * @returns Array of metric objects
   */
  getMetrics(): object[];

  /**
   * Get summary statistics
   *
   * @returns Summary statistics object
   */
  getSummary(): object;

  /**
   * Clear all recorded metrics
   */
  clear(): void;

  /**
   * Export metrics as JSON string
   *
   * @returns JSON string of all metrics
   */
  exportJson(): string;

  /**
   * Get metrics for a specific time range
   *
   * @param startMs - Start timestamp in milliseconds
   * @param endMs - End timestamp in milliseconds
   * @returns Array of metric objects in range
   */
  getMetricsInRange(startMs: number, endMs: number): object[];
}

/**
 * IndexedDB storage manager
 */
export class IndexedDbStorage {
  /**
   * Create a new IndexedDB storage manager
   *
   * @param dbName - Database name
   * @param version - Database version
   */
  constructor(dbName: string, version: number): Promise<IndexedDbStorage>;

  /**
   * Store Q-table data
   *
   * @param agentId - Agent ID
   * @param data - Serialized Q-table data
   */
  storeQTable(agentId: string, data: Uint8Array): Promise<void>;

  /**
   * Load Q-table data
   *
   * @param agentId - Agent ID
   * @returns Promise that resolves to the Q-table data
   */
  loadQTable(agentId: string): Promise<Uint8Array>;

  /**
   * Store trajectory data
   *
   * @param agentId - Agent ID
   * @param trajectoryId - Trajectory ID
   * @param data - Serialized trajectory data
   */
  storeTrajectory(agentId: string, trajectoryId: number, data: Uint8Array): Promise<void>;

  /**
   * Store agent state
   *
   * @param agentId - Agent ID
   * @param state - Agent state object
   */
  storeAgentState(agentId: string, state: object): Promise<void>;

  /**
   * Clear all data for an agent
   *
   * @param agentId - Agent ID
   */
  clearAgentData(agentId: string): Promise<void>;

  /**
   * Get database statistics
   *
   * @returns Promise that resolves to statistics object
   */
  getStats(): Promise<object>;
}

/**
 * Module-level functions
 */

/**
 * Get the ELEX WASM version
 *
 * @returns Version string
 */
export function version(): string;

/**
 * Get the ELEX WASM build info
 *
 * @returns Build info string
 */
export function buildInfo(): string;

/**
 * Check if SIMD is available
 *
 * @returns True if SIMD is available
 */
export function isSimdAvailable(): boolean;

/**
 * Get supported features
 *
 * @returns Array of feature names
 */
export function getSupportedFeatures(): string[];
