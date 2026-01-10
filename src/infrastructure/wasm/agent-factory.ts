/**
 * WASM Agent Factory - Lazy Loading and Memory Management
 *
 * Manages instantiation, caching, and eviction of WASM agent modules.
 * - Lazy loads agents on-demand (not at startup)
 * - Caches up to 50 agents to stay within 500MB budget
 * - LRU eviction when memory pressure exceeds 80% (400MB)
 * - Shared WASM module compilation (compile once, instantiate 593 times)
 */

export interface AgentConfig {
  id: string;
  fajCode: string;
  category: string;
  parameters: Array<{
    name: string;
    valueType: string;
    rangeMin?: number;
    rangeMax?: number;
    currentValue?: string;
  }>;
  counters: Array<{
    name: string;
    category: string;
    currentValue: number;
  }>;
  kpis: Array<{
    name: string;
    formula: string;
    threshold: number;
  }>;
}

export interface AgentInstance {
  id: string;
  fajCode: string;
  wasmModule: any;
  lastAccessedAt: number;
  memoryBytes: number;
}

/**
 * Agent Factory - Manages WASM agent lifecycle and memory
 */
export class AgentFactory {
  private static instance: AgentFactory;
  private wasmModule: WebAssembly.Module | null = null;
  private wasmMemory: WebAssembly.Memory | null = null;
  private cachedAgents: Map<string, AgentInstance> = new Map();
  private agentAccessOrder: string[] = []; // Track LRU order
  private totalMemoryBytes = 0;
  private maxCachedAgents = 50;
  private maxMemoryBytes = 500 * 1024 * 1024; // 500MB budget
  private memoryPressureThreshold = 0.8; // Evict when 80% full (400MB)
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * Initialize factory by compiling WASM module
   * Note: In production, this would fetch from dist/wasm/agent/edge_agent_wasm_bg.wasm
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // In a real environment, load the WASM module
      // For now, we'll set up the factory structure
      // const response = await fetch('/dist/wasm/agent/edge_agent_wasm_bg.wasm');
      // const buffer = await response.arrayBuffer();
      // this.wasmModule = await WebAssembly.compile(buffer);

      // Create shared memory for all agent instances
      this.wasmMemory = new WebAssembly.Memory({ initial: 256 }); // 16MB initial

      this.isInitialized = true;
      console.log('[AgentFactory] Initialized with 500MB budget, 50 agent cache');
    } catch (error) {
      console.error('[AgentFactory] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Lazy load agent on-demand
   * Returns cached agent if available, otherwise creates new instance
   */
  async loadAgent(config: AgentConfig): Promise<AgentInstance> {
    if (!this.isInitialized) {
      throw new Error('AgentFactory not initialized. Call initialize() first.');
    }

    // Check if agent already cached
    if (this.cachedAgents.has(config.id)) {
      const agent = this.cachedAgents.get(config.id)!;
      // Update access time for LRU
      agent.lastAccessedAt = Date.now();
      this.updateAccessOrder(config.id);
      return agent;
    }

    // Check if we need to evict before loading
    await this.evictIfNeeded();

    // Create new agent instance
    const agent = await this.createAgentInstance(config);

    // Add to cache
    this.cachedAgents.set(config.id, agent);
    this.totalMemoryBytes += agent.memoryBytes;
    this.agentAccessOrder.push(config.id);

    console.log(
      `[AgentFactory] Loaded agent ${config.id} (${Math.round(agent.memoryBytes / 1024)}KB). ` +
      `Total: ${Math.round(this.totalMemoryBytes / 1024 / 1024)}MB / ${this.maxMemoryBytes / 1024 / 1024}MB`
    );

    return agent;
  }

  /**
   * Unload specific agent from cache
   */
  unloadAgent(agentId: string): boolean {
    const agent = this.cachedAgents.get(agentId);
    if (!agent) {
      return false;
    }

    this.cachedAgents.delete(agentId);
    this.totalMemoryBytes -= agent.memoryBytes;
    this.agentAccessOrder = this.agentAccessOrder.filter(id => id !== agentId);

    console.log(
      `[AgentFactory] Unloaded agent ${agentId}. ` +
      `Total: ${Math.round(this.totalMemoryBytes / 1024 / 1024)}MB`
    );

    return true;
  }

  /**
   * Check memory pressure and evict LRU agents if needed
   */
  private async evictIfNeeded(): Promise<void> {
    const memoryUsagePercent = this.totalMemoryBytes / this.maxMemoryBytes;

    if (memoryUsagePercent >= this.memoryPressureThreshold) {
      console.log(
        `[AgentFactory] Memory pressure at ${(memoryUsagePercent * 100).toFixed(1)}%. Evicting LRU agents...`
      );

      // Evict 20% of agents (10 out of 50) to reduce pressure
      const numToEvict = Math.ceil(this.cachedAgents.size * 0.2);

      for (let i = 0; i < numToEvict && this.agentAccessOrder.length > 0; i++) {
        const lruAgentId = this.agentAccessOrder[0];
        this.unloadAgent(lruAgentId);
      }
    }

    // Also evict if we exceed cache limit
    while (this.cachedAgents.size > this.maxCachedAgents && this.agentAccessOrder.length > 0) {
      const lruAgentId = this.agentAccessOrder[0];
      this.unloadAgent(lruAgentId);
    }
  }

  /**
   * Create new agent instance
   */
  private async createAgentInstance(config: AgentConfig): Promise<AgentInstance> {
    // In real implementation, would instantiate WASM module here
    // For now, create a mock with proper memory estimation

    const memoryBytes = this.estimateAgentMemory(config);

    return {
      id: config.id,
      fajCode: config.fajCode,
      wasmModule: {
        // WASM module methods would be here in real implementation
        validateConfig: async (config: Array<{ name: string; value: number; min: number; max: number }>) =>
          config.map(item => ({
            parameter: item.name,
            valid: item.value >= item.min && item.value <= item.max,
            value: item.value,
          })),
        monitorKpis: async () => ({ totalEvents: 0, weightedScore: 0, peakValue: 0, alerts: 0 }),
        handleQuery: async (query: any) => ({
          content: query?.state ? `Response for ${query.state}` : 'Response',
          confidence: 0.8,
          action: query?.availableActions?.[0] ?? 'DirectAnswer',
        }),
        getStats: async () => ({
          interactions: 0,
          confidence: 0.5,
          health: 1.0,
          status: 'Ready',
        }),
      },
      lastAccessedAt: Date.now(),
      memoryBytes,
    };
  }

  /**
   * Estimate agent memory usage
   */
  private estimateAgentMemory(config: AgentConfig): number {
    const baseSize = 2048; // Base overhead
    const paramSize = config.parameters.length * 256;
    const counterSize = config.counters.length * 128;
    const kpiSize = config.kpis.length * 128;

    return baseSize + paramSize + counterSize + kpiSize;
  }

  /**
   * Update LRU access order
   */
  private updateAccessOrder(agentId: string): void {
    const index = this.agentAccessOrder.indexOf(agentId);
    if (index > -1) {
      this.agentAccessOrder.splice(index, 1);
    }
    this.agentAccessOrder.push(agentId);
  }

  /**
   * Preload agents by category
   * Useful for warming up hot features at startup
   */
  async preloadByCategory(category: string, configs: AgentConfig[]): Promise<void> {
    const categoryConfigs = configs.filter(c => c.category === category).slice(0, 10);

    console.log(`[AgentFactory] Preloading ${categoryConfigs.length} agents from category ${category}...`);

    for (const config of categoryConfigs) {
      try {
        await this.loadAgent(config);
      } catch (error) {
        console.error(`[AgentFactory] Failed to preload ${config.id}:`, error);
      }
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    usedBytes: number;
    maxBytes: number;
    usedPercent: number;
    cachedAgents: number;
    maxCachedAgents: number;
  } {
    return {
      usedBytes: this.totalMemoryBytes,
      maxBytes: this.maxMemoryBytes,
      usedPercent: (this.totalMemoryBytes / this.maxMemoryBytes) * 100,
      cachedAgents: this.cachedAgents.size,
      maxCachedAgents: this.maxCachedAgents,
    };
  }

  /**
   * Get cached agent without updating access time
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.cachedAgents.get(agentId);
  }

  /**
   * Get all cached agent IDs
   */
  getCachedAgentIds(): string[] {
    return Array.from(this.cachedAgents.keys());
  }

  /**
   * Clear all cached agents
   */
  clearCache(): void {
    this.cachedAgents.clear();
    this.agentAccessOrder = [];
    this.totalMemoryBytes = 0;
    console.log('[AgentFactory] Cleared agent cache');
  }
}
