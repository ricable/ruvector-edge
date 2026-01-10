/**
 * WASM Agent Runtime Manager
 *
 * Bridges TypeScript DDD aggregates with WASM implementation.
 * Handles:
 * - Agent lifecycle (spawn, execute, terminate)
 * - Query processing with SIMD acceleration
 * - Configuration validation and optimization
 * - KPI monitoring and aggregation
 */

import { AgentFactory, AgentConfig, AgentInstance } from './agent-factory';

export interface QueryRequest {
  agentId: string;
  content: string;
  state?: string;
  availableActions?: string[];
}

export interface QueryResponse {
  agentId: string;
  content: string;
  confidence: number;
  latencyMs: number;
  action: string;
  metadata?: Record<string, any>;
}

export interface ConfigValidationRequest {
  agentId: string;
  config: Array<{
    name: string;
    value: number;
    min: number;
    max: number;
  }>;
}

export interface ConfigValidationResponse {
  agentId: string;
  results: Array<{
    parameter: string;
    valid: boolean;
    value: number;
  }>;
  validCount: number;
  totalCount: number;
}

export interface KPIMonitoringResponse {
  agentId: string;
  totalEvents: number;
  weightedScore: number;
  peakValue: number;
  alertsCount: number;
}

export interface AgentStats {
  agentId: string;
  fajCode: string;
  status: string;
  interactions: number;
  confidence: number;
  health: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  validationAccuracy: number;
  successRate: number;
}

/**
 * Agent Runtime - Manages WASM agent execution
 */
export class AgentRuntime {
  private static instance: AgentRuntime;
  private factory: AgentFactory;
  private activeAgents: Map<string, AgentStats> = new Map();

  private constructor() {
    this.factory = AgentFactory.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRuntime {
    if (!AgentRuntime.instance) {
      AgentRuntime.instance = new AgentRuntime();
    }
    return AgentRuntime.instance;
  }

  /**
   * Initialize runtime
   */
  async initialize(): Promise<void> {
    await this.factory.initialize();
    console.log('[AgentRuntime] Initialized');
  }

  /**
   * Spawn and initialize an agent
   */
  async spawnAgent(config: AgentConfig): Promise<AgentStats> {
    const startTime = performance.now();

    try {
      // Lazy load agent via factory
      const agent = await this.factory.loadAgent(config);

      // Initialize agent stats
      const stats: AgentStats = {
        agentId: config.id,
        fajCode: config.fajCode,
        status: 'Ready',
        interactions: 0,
        confidence: 0.5,
        health: 1.0,
        avgLatencyMs: 0,
        peakLatencyMs: 0,
        validationAccuracy: 0,
        successRate: 0,
      };

      this.activeAgents.set(config.id, stats);

      const latency = performance.now() - startTime;
      console.log(
        `[AgentRuntime] Spawned agent ${config.id} in ${latency.toFixed(2)}ms`
      );

      return stats;
    } catch (error) {
      console.error(`[AgentRuntime] Failed to spawn agent ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle query with SIMD-accelerated processing
   */
  async handleQuery(request: QueryRequest): Promise<QueryResponse> {
    const startTime = performance.now();

    try {
      // Get agent from factory
      const agent = this.factory.getAgent(request.agentId);
      if (!agent) {
        throw new Error(`Agent ${request.agentId} not loaded`);
      }

      // Call WASM module method
      const result = await agent.wasmModule.handleQuery({
        state: request.state || 'default',
        availableActions: request.availableActions || ['DirectAnswer'],
      });

      const latency = performance.now() - startTime;

      // Update agent stats
      const stats = this.activeAgents.get(request.agentId);
      if (stats) {
        stats.interactions += 1;
        stats.avgLatencyMs =
          (stats.avgLatencyMs * (stats.interactions - 1) + latency) / stats.interactions;
        if (latency > stats.peakLatencyMs) {
          stats.peakLatencyMs = latency;
        }
        stats.confidence = Math.min(1.0, stats.confidence + 0.01);
      }

      return {
        agentId: request.agentId,
        content: result.content || 'Response generated',
        confidence: result.confidence || 0.8,
        latencyMs: latency,
        action: result.action || 'DirectAnswer',
        metadata: {
          interactions: stats?.interactions || 0,
          confidence: stats?.confidence || 0.8,
        },
      };
    } catch (error) {
      console.error(
        `[AgentRuntime] Query processing failed for ${request.agentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Validate configuration with SIMD acceleration (4-8x faster)
   */
  async validateConfig(request: ConfigValidationRequest): Promise<ConfigValidationResponse> {
    const startTime = performance.now();

    try {
      const agent = this.factory.getAgent(request.agentId);
      if (!agent) {
        throw new Error(`Agent ${request.agentId} not loaded`);
      }

      // Call WASM module SIMD validation
      const result = await agent.wasmModule.validateConfig(request.config);

      const latency = performance.now() - startTime;

      // Update stats
      const stats = this.activeAgents.get(request.agentId);
      if (stats && result) {
        const validCount = result.filter((r: any) => r.valid).length;
        stats.validationAccuracy = validCount / request.config.length;
      }

      console.log(
        `[AgentRuntime] Validated ${request.config.length} parameters in ${latency.toFixed(2)}ms`
      );

      const validCount = result.filter((r: any) => r.valid).length;

      return {
        agentId: request.agentId,
        results: result,
        validCount,
        totalCount: request.config.length,
      };
    } catch (error) {
      console.error(
        `[AgentRuntime] Config validation failed for ${request.agentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Monitor KPIs with SIMD aggregation (3-6x faster)
   */
  async monitorKPIs(agentId: string): Promise<KPIMonitoringResponse> {
    const startTime = performance.now();

    try {
      const agent = this.factory.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not loaded`);
      }

      // Call WASM module SIMD aggregation
      const result = await agent.wasmModule.monitorKpis();

      const latency = performance.now() - startTime;

      console.log(
        `[AgentRuntime] Monitored KPIs in ${latency.toFixed(2)}ms (${result.alerts} alerts)`
      );

      return {
        agentId,
        totalEvents: result.totalEvents || 0,
        weightedScore: result.weightedScore || 0,
        peakValue: result.peakValue || 0,
        alertsCount: result.alerts || 0,
      };
    } catch (error) {
      console.error(`[AgentRuntime] KPI monitoring failed for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent statistics
   */
  async getStats(agentId: string): Promise<AgentStats> {
    const stats = this.activeAgents.get(agentId);
    if (!stats) {
      throw new Error(`Agent ${agentId} not active`);
    }

    // Get stats from WASM module
    const agent = this.factory.getAgent(agentId);
    if (agent) {
      try {
        const wasmStats = await agent.wasmModule.getStats();
        if (wasmStats) {
          stats.status = wasmStats.status || stats.status;
          stats.health = wasmStats.health ?? stats.health;
        }
      } catch (error) {
        console.warn(`[AgentRuntime] Failed to get WASM stats for ${agentId}:`, error);
      }
    }

    return stats;
  }

  /**
   * Terminate agent and free memory
   */
  async terminateAgent(agentId: string): Promise<void> {
    try {
      // Unload from factory
      this.factory.unloadAgent(agentId);

      // Remove from active agents
      this.activeAgents.delete(agentId);

      console.log(`[AgentRuntime] Terminated agent ${agentId}`);
    } catch (error) {
      console.error(`[AgentRuntime] Failed to terminate agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): AgentStats[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Get runtime statistics
   */
  getRuntimeStats(): {
    activeAgents: number;
    totalInteractions: number;
    avgConfidence: number;
    memoryStats: any;
  } {
    const agents = Array.from(this.activeAgents.values());
    const totalInteractions = agents.reduce((sum, a) => sum + a.interactions, 0);
    const avgConfidence = agents.length > 0
      ? agents.reduce((sum, a) => sum + a.confidence, 0) / agents.length
      : 0;

    return {
      activeAgents: agents.length,
      totalInteractions,
      avgConfidence,
      memoryStats: this.factory.getMemoryStats(),
    };
  }

  /**
   * Shutdown runtime
   */
  async shutdown(): Promise<void> {
    try {
      // Terminate all agents
      const agentIds = Array.from(this.activeAgents.keys());
      for (const agentId of agentIds) {
        await this.terminateAgent(agentId);
      }

      // Clear factory cache
      this.factory.clearCache();

      console.log('[AgentRuntime] Shutdown complete');
    } catch (error) {
      console.error('[AgentRuntime] Shutdown failed:', error);
      throw error;
    }
  }
}
