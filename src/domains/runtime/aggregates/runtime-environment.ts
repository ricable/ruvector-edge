/**
 * RuntimeEnvironment Aggregate Root
 *
 * Manages the complete runtime environment for agent execution including
 * WASM modules, resources, and deployment configuration.
 */

import { DeploymentConfiguration, Platform } from '../value-objects/deployment-config';
import { WASMModule, WASMModuleConfig, ModuleState } from '../entities/wasm-module';
import { ResourceManager, ResourceUsage, ResourceState } from '../entities/resource-manager';

export interface RuntimeConfig {
  readonly deployment: DeploymentConfiguration;
  readonly enableWasm: boolean;
  readonly enableWorkers: boolean;
  readonly maxModules: number;
}

export interface AgentRuntime {
  readonly agentId: string;
  readonly module: WASMModule | null;
  readonly memoryAllocationId: string;
  readonly startedAt: Date;
  readonly status: 'starting' | 'running' | 'stopped' | 'error';
}

/**
 * Domain Events for RuntimeEnvironment
 */
export interface EnvironmentInitialized {
  readonly type: 'EnvironmentInitialized';
  readonly environmentId: string;
  readonly platform: Platform;
  readonly timestamp: Date;
}

export interface AgentStarted {
  readonly type: 'AgentStarted';
  readonly environmentId: string;
  readonly agentId: string;
  readonly memoryMB: number;
  readonly timestamp: Date;
}

export interface AgentStopped {
  readonly type: 'AgentStopped';
  readonly environmentId: string;
  readonly agentId: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export interface ResourceWarning {
  readonly type: 'ResourceWarning';
  readonly environmentId: string;
  readonly resourceType: string;
  readonly utilization: number;
  readonly timestamp: Date;
}

export type RuntimeEnvironmentEvent =
  | EnvironmentInitialized
  | AgentStarted
  | AgentStopped
  | ResourceWarning;

/**
 * RuntimeEnvironment Aggregate Root
 */
export class RuntimeEnvironment {
  readonly id: string;
  private _config: RuntimeConfig;
  private _resourceManager: ResourceManager;
  private _modules: Map<string, WASMModule>;
  private _agentRuntimes: Map<string, AgentRuntime>;
  private _initialized: boolean;
  private _startedAt: Date | null;
  private _events: RuntimeEnvironmentEvent[];

  private constructor(
    id: string,
    config: RuntimeConfig,
    resourceManager: ResourceManager
  ) {
    this.id = id;
    this._config = config;
    this._resourceManager = resourceManager;
    this._modules = new Map();
    this._agentRuntimes = new Map();
    this._initialized = false;
    this._startedAt = null;
    this._events = [];
  }

  /**
   * Factory method
   */
  static create(deployment: DeploymentConfiguration, config?: Partial<RuntimeConfig>): RuntimeEnvironment {
    const id = `runtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const fullConfig: RuntimeConfig = {
      deployment,
      enableWasm: config?.enableWasm ?? true,
      enableWorkers: config?.enableWorkers ?? true,
      maxModules: config?.maxModules ?? 100
    };

    const resourceManager = new ResourceManager(`resources-${id}`, deployment.resourceLimits);

    return new RuntimeEnvironment(id, fullConfig, resourceManager);
  }

  /**
   * Initialize the runtime environment
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      throw new Error('Environment already initialized');
    }

    // Validate deployment configuration
    if (!this._config.deployment.isValidForPlatform()) {
      throw new Error(`Invalid deployment configuration for platform: ${this._config.deployment.platform}`);
    }

    this._initialized = true;
    this._startedAt = new Date();

    this.raise({
      type: 'EnvironmentInitialized',
      environmentId: this.id,
      platform: this._config.deployment.platform,
      timestamp: new Date()
    });
  }

  /**
   * Start an agent in this environment
   */
  async startAgent(
    agentId: string,
    wasmBinary?: ArrayBuffer,
    memoryMB: number = 10
  ): Promise<void> {
    this.ensureInitialized();

    if (this._agentRuntimes.has(agentId)) {
      throw new Error(`Agent ${agentId} is already running`);
    }

    // Check resource availability
    if (!this._resourceManager.canAllocate(memoryMB)) {
      throw new Error(`Insufficient memory to start agent. Required: ${memoryMB}MB`);
    }

    // Allocate resources
    const allocationId = `alloc-${agentId}`;
    const allocated = this._resourceManager.allocate(allocationId, 'agent', memoryMB);
    if (!allocated) {
      throw new Error('Failed to allocate resources');
    }

    // Create WASM module if binary provided
    let module: WASMModule | null = null;
    if (wasmBinary && this._config.enableWasm) {
      const moduleConfig: WASMModuleConfig = {
        binaryPath: `agent-${agentId}.wasm`,
        memoryPages: Math.ceil(memoryMB * 1024 * 1024 / 65536),
        tableSize: 128
      };
      module = new WASMModule(`module-${agentId}`, moduleConfig);
      await module.load(wasmBinary);
      this._modules.set(agentId, module);
    }

    // Create agent runtime
    const runtime: AgentRuntime = {
      agentId,
      module,
      memoryAllocationId: allocationId,
      startedAt: new Date(),
      status: 'running'
    };
    this._agentRuntimes.set(agentId, runtime);

    this.raise({
      type: 'AgentStarted',
      environmentId: this.id,
      agentId,
      memoryMB,
      timestamp: new Date()
    });

    // Check resource state
    this.checkResourceWarnings();
  }

  /**
   * Stop an agent
   */
  stopAgent(agentId: string, reason: string = 'requested'): void {
    const runtime = this._agentRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    // Unload WASM module
    const module = this._modules.get(agentId);
    if (module) {
      module.unload();
      this._modules.delete(agentId);
    }

    // Release resources
    this._resourceManager.release(runtime.memoryAllocationId);

    // Remove runtime
    this._agentRuntimes.delete(agentId);

    this.raise({
      type: 'AgentStopped',
      environmentId: this.id,
      agentId,
      reason,
      timestamp: new Date()
    });
  }

  /**
   * Get agent runtime status
   */
  getAgentStatus(agentId: string): AgentRuntime | undefined {
    return this._agentRuntimes.get(agentId);
  }

  /**
   * Get all running agents
   */
  getRunningAgents(): AgentRuntime[] {
    return Array.from(this._agentRuntimes.values()).filter(r => r.status === 'running');
  }

  /**
   * Call a WASM function for an agent
   */
  callAgentFunction<T>(agentId: string, functionName: string, ...args: unknown[]): T {
    const module = this._modules.get(agentId);
    if (!module) {
      throw new Error(`No WASM module for agent ${agentId}`);
    }
    if (!module.isReady()) {
      throw new Error(`WASM module for agent ${agentId} is not ready`);
    }
    return module.call<T>(functionName, ...args);
  }

  /**
   * Get environment health
   */
  getHealth(): {
    state: ResourceState;
    agentCount: number;
    moduleCount: number;
    usage: ResourceUsage;
    uptime: number;
  } {
    return {
      state: this._resourceManager.getState(),
      agentCount: this._agentRuntimes.size,
      moduleCount: this._modules.size,
      usage: this._resourceManager.usage,
      uptime: this._startedAt ? Date.now() - this._startedAt.getTime() : 0
    };
  }

  /**
   * Check and raise resource warnings
   */
  private checkResourceWarnings(): void {
    const utilization = this._resourceManager.getUtilization();

    if (utilization.memory >= 0.8) {
      this.raise({
        type: 'ResourceWarning',
        environmentId: this.id,
        resourceType: 'memory',
        utilization: utilization.memory,
        timestamp: new Date()
      });
    }

    if (utilization.cpu >= 0.8) {
      this.raise({
        type: 'ResourceWarning',
        environmentId: this.id,
        resourceType: 'cpu',
        utilization: utilization.cpu,
        timestamp: new Date()
      });
    }
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('RuntimeEnvironment not initialized. Call initialize() first.');
    }
  }

  private raise(event: RuntimeEnvironmentEvent): void {
    this._events.push(event);
  }

  // Getters
  get config(): RuntimeConfig { return this._config; }
  get initialized(): boolean { return this._initialized; }
  get startedAt(): Date | null { return this._startedAt; }
  get agentCount(): number { return this._agentRuntimes.size; }
  get moduleCount(): number { return this._modules.size; }
  get resourceManager(): ResourceManager { return this._resourceManager; }

  /**
   * Get and clear uncommitted domain events
   */
  getUncommittedEvents(): RuntimeEnvironmentEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  equals(other: RuntimeEnvironment): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const health = this.getHealth();
    return `RuntimeEnvironment(${this.id}, agents=${health.agentCount}, state=${health.state})`;
  }
}
