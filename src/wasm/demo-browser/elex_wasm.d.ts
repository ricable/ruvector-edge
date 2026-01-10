/* tslint:disable */
/* eslint-disable */

/**
 * Query complexity classification
 */
export enum Complexity {
  Simple = 0,
  Moderate = 1,
  Complex = 2,
}

export class ElexSwarm {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get statistics for a specific agent
   *
   * # Arguments
   * * `agent_id` - ID of the agent
   *
   * # Returns
   * Promise that resolves to WasmAgentStats
   */
  get_agent_stats(agent_id: string): Promise<any>;
  /**
   * Get overall swarm statistics
   *
   * # Returns
   * Promise that resolves to SwarmStats
   */
  get_swarm_stats(): Promise<any>;
  /**
   * Initialize a new ELEX swarm
   *
   * # Arguments
   * * `config_js` - Configuration object as JavaScript object
   *
   * # Returns
   * Promise that resolves to the initialized swarm
   *
   * # Example
   * ```javascript
   * const swarm = await ElexSwarm.initialize({
   *     topology: Topology.hierarchical_mesh(),
   *     maxAgents: 50,
   *     enableTelemetry: true,
   *     enableIndexedDB: true,
   *     cacheSizeMB: 50,
   *     lazyLoading: true,
   *     autoSync: true,
   *     syncIntervalMs: 60000
   * });
   * ```
   */
  constructor(config_js: any);
  /**
   * Synchronize Q-tables with federated learning
   *
   * # Returns
   * Promise that resolves when sync is complete
   */
  sync(): Promise<any>;
  /**
   * Process a query through the swarm
   *
   * # Arguments
   * * `query_js` - Query object with text, queryType, complexity, and optional context
   *
   * # Returns
   * Promise that resolves to a QueryResponse
   *
   * # Example
   * ```javascript
   * const response = await swarm.query({
   *     text: "Configure IFLB thresholds",
   *     queryType: QueryType.Parameter,
   *     complexity: Complexity.Moderate,
   *     context: "load balancing optimization"
   * });
   * ```
   */
  query(query_js: any): Promise<any>;
  /**
   * Persist agent state to IndexedDB
   *
   * # Returns
   * Promise that resolves when persistence is complete
   */
  persist(): Promise<any>;
  /**
   * Provide feedback on a previous query (for Q-learning)
   *
   * # Arguments
   * * `agent_id` - ID of the agent that handled the query
   * * `reward` - Reward signal (-1.0 to +1.0)
   * * `success` - Whether the response was successful
   *
   * # Returns
   * Promise that resolves when feedback is recorded
   */
  feedback(agent_id: string, reward: number, success: boolean): Promise<any>;
  /**
   * Shutdown the swarm and release resources
   *
   * # Returns
   * Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<any>;
}

export class QueryResponse {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get the confidence score (0.0 to 1.0)
   */
  readonly confidence: number;
  /**
   * Get the response latency in milliseconds
   */
  readonly latency_ms: number;
  /**
   * Get the risk level assessment
   */
  readonly risk_level: string;
  /**
   * Get the feature code of the responding agent
   */
  readonly feature_code: string;
  /**
   * Get any cmedit commands generated
   */
  readonly cmedit_commands: Array<any>;
  /**
   * Get the response text
   */
  readonly text: string;
  /**
   * Get the agent ID that generated the response
   */
  readonly agent_id: string;
  /**
   * Get the timestamp of the response
   */
  readonly timestamp: bigint;
}

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

export class SwarmStats {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly total_agents: number;
  readonly active_agents: number;
  readonly total_queries: bigint;
  readonly avg_latency_ms: number;
  readonly cache_hit_rate: number;
  readonly memory_usage_mb: number;
  readonly total_successes: bigint;
  readonly topology: string;
  readonly uptime_ms: bigint;
}

export class Topology {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Hierarchical topology - coordinators manage agent groups
   */
  static hierarchical(): Topology;
  /**
   * Hierarchical-mesh topology - hybrid approach (recommended)
   */
  static hierarchical_mesh(): Topology;
  /**
   * Mesh topology - all agents connected to all others
   */
  static mesh(): Topology;
}

export class WasmAgentStats {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly confidence: number;
  readonly query_count: bigint;
  readonly feature_code: string;
  readonly feature_name: string;
  readonly success_rate: number;
  readonly success_count: bigint;
  readonly avg_latency_ms: number;
  readonly memory_entries: number;
  readonly q_table_entries: number;
  readonly trajectory_count: number;
  readonly health: number;
  readonly status: string;
  readonly epsilon: number;
  readonly agent_id: string;
}

/**
 * Get the ELEX WASM build info
 */
export function build_info(): string;

/**
 * Get supported features
 */
export function get_supported_features(): Array<any>;

/**
 * Check if SIMD is available
 */
export function is_simd_available(): boolean;

/**
 * Get the ELEX WASM version
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_elexswarm_free: (a: number, b: number) => void;
  readonly __wbg_queryresponse_free: (a: number, b: number) => void;
  readonly __wbg_swarmstats_free: (a: number, b: number) => void;
  readonly __wbg_topology_free: (a: number, b: number) => void;
  readonly __wbg_wasmagentstats_free: (a: number, b: number) => void;
  readonly build_info: () => [number, number];
  readonly elexswarm_feedback: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly elexswarm_get_agent_stats: (a: number, b: number, c: number) => any;
  readonly elexswarm_get_swarm_stats: (a: number) => any;
  readonly elexswarm_new: (a: any) => any;
  readonly elexswarm_persist: (a: number) => any;
  readonly elexswarm_query: (a: number, b: any) => any;
  readonly elexswarm_shutdown: (a: number) => any;
  readonly elexswarm_sync: (a: number) => any;
  readonly get_supported_features: () => any;
  readonly is_simd_available: () => number;
  readonly queryresponse_agent_id: (a: number) => [number, number];
  readonly queryresponse_cmedit_commands: (a: number) => any;
  readonly queryresponse_confidence: (a: number) => number;
  readonly queryresponse_feature_code: (a: number) => [number, number];
  readonly queryresponse_latency_ms: (a: number) => number;
  readonly queryresponse_risk_level: (a: number) => [number, number];
  readonly queryresponse_text: (a: number) => [number, number];
  readonly queryresponse_timestamp: (a: number) => bigint;
  readonly swarmstats_active_agents: (a: number) => number;
  readonly swarmstats_avg_latency_ms: (a: number) => number;
  readonly swarmstats_cache_hit_rate: (a: number) => number;
  readonly swarmstats_memory_usage_mb: (a: number) => number;
  readonly swarmstats_topology: (a: number) => [number, number];
  readonly swarmstats_total_agents: (a: number) => number;
  readonly swarmstats_total_queries: (a: number) => bigint;
  readonly swarmstats_total_successes: (a: number) => bigint;
  readonly swarmstats_uptime_ms: (a: number) => bigint;
  readonly topology_hierarchical: () => number;
  readonly topology_hierarchical_mesh: () => number;
  readonly topology_mesh: () => number;
  readonly version: () => [number, number];
  readonly wasmagentstats_agent_id: (a: number) => [number, number];
  readonly wasmagentstats_avg_latency_ms: (a: number) => number;
  readonly wasmagentstats_confidence: (a: number) => number;
  readonly wasmagentstats_epsilon: (a: number) => number;
  readonly wasmagentstats_feature_code: (a: number) => [number, number];
  readonly wasmagentstats_feature_name: (a: number) => [number, number];
  readonly wasmagentstats_health: (a: number) => number;
  readonly wasmagentstats_memory_entries: (a: number) => number;
  readonly wasmagentstats_q_table_entries: (a: number) => number;
  readonly wasmagentstats_query_count: (a: number) => bigint;
  readonly wasmagentstats_status: (a: number) => [number, number];
  readonly wasmagentstats_success_count: (a: number) => bigint;
  readonly wasmagentstats_success_rate: (a: number) => number;
  readonly wasmagentstats_trajectory_count: (a: number) => number;
  readonly wasm_bindgen__convert__closures_____invoke__hf2675970a597e2a4: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__hc14b47d1bba14877: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h41b8b0be5065bfa0: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
