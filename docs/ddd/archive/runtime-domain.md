# Runtime Bounded Context

## Purpose

The Runtime Context manages WebAssembly execution, resource allocation, and agent lifecycle at the system level. It provides a portable, secure, and efficient execution environment for the 593 agents, leveraging WASM for near-native performance with ~500KB binary size per agent.

---

## Domain Model

```
+------------------------------------------------------------------+
|                     RUNTIME BOUNDED CONTEXT                       |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------+                                      |
|  |  RuntimeEnvironment    |  <-- Aggregate Root                  |
|  |      (Aggregate)       |                                      |
|  +------------------------+                                      |
|  | - envId: EnvId         |                                      |
|  | - modules: WASMModule[]|                                      |
|  | - resourcePool: Pool   |                                      |
|  | - config: RuntimeConfig|                                      |
|  | - status: EnvStatus    |                                      |
|  +------------------------+                                      |
|           |                                                      |
|           | manages                                              |
|           v                                                      |
|  +------------------------+     +------------------------+       |
|  |      WASMModule        |     |    ResourceManager     |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - moduleId: ModuleId   |     | - managerId: MgrId     |       |
|  | - binary: Uint8Array   |     | - memoryPool: Memory   |       |
|  | - instance: WASMInst   |     | - cpuQuota: CPUQuota   |       |
|  | - memory: WASMMemory   |     | - allocations: Alloc[] |       |
|  | - exports: Exports     |     | - limits: Limits       |       |
|  | - status: ModuleStatus |     +------------------------+       |
|  +------------------------+                                      |
|                                                                  |
|  +------------------------+     +------------------------+       |
|  |     ModuleLoader       |     |    ExecutionContext    |       |
|  |       (Entity)         |     |       (Entity)         |       |
|  +------------------------+     +------------------------+       |
|  | - loaderId: LoaderId   |     | - contextId: CtxId     |       |
|  | - cache: ModuleCache   |     | - module: WASMModule   |       |
|  | - lazyQueue: Queue     |     | - stack: CallStack     |       |
|  | - preloadList: List    |     | - state: ExecState     |       |
|  +------------------------+     +------------------------+       |
|                                                                  |
|  +------------------+  +------------------+  +------------------+ |
|  | DeploymentConfig |  |   MemoryRegion   |  |   CPUAllocation  | |
|  |   (Value Obj)    |  |   (Value Obj)    |  |   (Value Obj)    | |
|  +------------------+  +------------------+  +------------------+ |
|  | - targetPlatform |  | - offset: number |  | - cores: number  | |
|  | - optimizations  |  | - size: number   |  | - priority: enum | |
|  | - simdEnabled    |  | - permissions    |  | - timeSlice: ms  | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Aggregates

### RuntimeEnvironment (Aggregate Root)

The root aggregate managing the complete WASM runtime.

```typescript
class RuntimeEnvironment {
  private readonly envId: RuntimeEnvId;
  private modules: Map<ModuleId, WASMModule>;
  private resourceManager: ResourceManager;
  private moduleLoader: ModuleLoader;
  private config: RuntimeConfig;
  private status: EnvironmentStatus;

  // Factory
  static initialize(config: RuntimeConfig): RuntimeEnvironment {
    const env = new RuntimeEnvironment(
      RuntimeEnvId.generate(),
      new Map(),
      ResourceManager.create(config.resources),
      ModuleLoader.create(config.loading),
      config
    );
    env.raise(new RuntimeInitialized(env.envId, config));
    return env;
  }

  // Module Lifecycle
  async loadModule(binary: Uint8Array, config: ModuleConfig): Promise<ModuleId> {
    // Validate binary
    if (!this.isValidWASMBinary(binary)) {
      throw new InvalidWASMBinaryError();
    }

    // Check resource availability
    const requiredMemory = this.estimateMemory(binary);
    if (!this.resourceManager.canAllocate(requiredMemory)) {
      throw new InsufficientResourcesError(requiredMemory);
    }

    // Load and instantiate
    const module = await this.moduleLoader.load(binary, config);

    // Allocate resources
    const allocation = this.resourceManager.allocate(module.moduleId, requiredMemory);
    module.setMemoryAllocation(allocation);

    this.modules.set(module.moduleId, module);
    this.raise(new ModuleLoaded(this.envId, module.moduleId, binary.length));

    return module.moduleId;
  }

  async unloadModule(moduleId: ModuleId): Promise<void> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new ModuleNotFoundError(moduleId);
    }

    // Release resources
    await module.terminate();
    this.resourceManager.deallocate(moduleId);
    this.modules.delete(moduleId);

    this.raise(new ModuleUnloaded(this.envId, moduleId));
  }

  // Execution
  async execute(
    moduleId: ModuleId,
    functionName: string,
    args: any[]
  ): Promise<ExecutionResult> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new ModuleNotFoundError(moduleId);
    }

    const context = ExecutionContext.create(module);
    const startTime = performance.now();

    try {
      const result = await module.invoke(functionName, args);
      const duration = performance.now() - startTime;

      this.raise(new ExecutionCompleted(moduleId, functionName, duration));
      return { success: true, result, duration };
    } catch (error) {
      this.raise(new ExecutionFailed(moduleId, functionName, error));
      return { success: false, error, duration: performance.now() - startTime };
    }
  }

  // Lazy Loading
  async preloadModules(moduleIds: ModuleId[]): Promise<void> {
    await this.moduleLoader.preload(moduleIds);
  }

  async lazyLoad(moduleId: ModuleId): Promise<WASMModule> {
    if (this.modules.has(moduleId)) {
      return this.modules.get(moduleId)!;
    }

    const binary = await this.moduleLoader.fetchBinary(moduleId);
    const loadedId = await this.loadModule(binary, { lazy: true });
    return this.modules.get(loadedId)!;
  }

  // Resource Management
  getResourceUsage(): ResourceUsage {
    return this.resourceManager.getUsage();
  }

  resizePool(newLimits: ResourceLimits): void {
    this.resourceManager.resize(newLimits);
    this.raise(new ResourcePoolResized(this.envId, newLimits));
  }

  // Status
  getStatus(): EnvironmentStatus {
    return {
      envId: this.envId,
      loadedModules: this.modules.size,
      memoryUsage: this.resourceManager.getMemoryUsage(),
      cpuUsage: this.resourceManager.getCPUUsage(),
      status: this.status,
    };
  }

  // Domain Events
  raise(event: RuntimeDomainEvent): void;

  private isValidWASMBinary(binary: Uint8Array): boolean {
    // Check WASM magic number: 0x00 0x61 0x73 0x6D
    return binary[0] === 0x00 &&
           binary[1] === 0x61 &&
           binary[2] === 0x73 &&
           binary[3] === 0x6D;
  }

  private estimateMemory(binary: Uint8Array): number {
    // Estimate ~2x binary size for instance memory
    return binary.length * 2;
  }
}

type EnvironmentStatus = 'initializing' | 'ready' | 'degraded' | 'shutdown';
```

---

## Entities

### WASMModule

Represents a loaded WebAssembly module instance.

```typescript
class WASMModule {
  readonly moduleId: ModuleId;
  private binary: Uint8Array;
  private compiledModule: WebAssembly.Module;
  private instance: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private exports: WASMExports;
  private status: ModuleStatus;
  private allocation: MemoryAllocation | null;
  private metrics: ModuleMetrics;

  // Factory
  static async compile(
    binary: Uint8Array,
    config: ModuleConfig
  ): Promise<WASMModule> {
    const compiled = await WebAssembly.compile(binary);
    const imports = this.buildImports(config);
    const instance = await WebAssembly.instantiate(compiled, imports);

    const module = new WASMModule(
      ModuleId.generate(),
      binary,
      compiled,
      instance,
      instance.exports.memory as WebAssembly.Memory,
      this.wrapExports(instance.exports)
    );

    return module;
  }

  // Invocation
  async invoke(functionName: string, args: any[]): Promise<any> {
    if (this.status !== 'ready') {
      throw new ModuleNotReadyError(this.moduleId, this.status);
    }

    const fn = this.exports[functionName];
    if (!fn || typeof fn !== 'function') {
      throw new ExportNotFoundError(this.moduleId, functionName);
    }

    const startTime = performance.now();
    try {
      const result = fn(...args);
      this.metrics.recordInvocation(functionName, performance.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.recordError(functionName);
      throw error;
    }
  }

  // Memory Operations
  readMemory(offset: number, length: number): Uint8Array {
    const view = new Uint8Array(this.memory.buffer);
    return view.slice(offset, offset + length);
  }

  writeMemory(offset: number, data: Uint8Array): void {
    const view = new Uint8Array(this.memory.buffer);
    view.set(data, offset);
  }

  growMemory(pages: number): number {
    return this.memory.grow(pages);
  }

  // SIMD Support
  hasSIMDSupport(): boolean {
    return 'simd' in this.exports;
  }

  // Lifecycle
  setMemoryAllocation(allocation: MemoryAllocation): void {
    this.allocation = allocation;
  }

  async terminate(): Promise<void> {
    // Call cleanup export if available
    if (this.exports.cleanup) {
      await this.invoke('cleanup', []);
    }

    this.status = 'terminated';
    // Clear references for GC
    this.instance = null as any;
    this.memory = null as any;
  }

  // Metrics
  getMetrics(): ModuleMetrics {
    return this.metrics.snapshot();
  }

  getMemoryUsage(): number {
    return this.memory.buffer.byteLength;
  }

  private static buildImports(config: ModuleConfig): WebAssembly.Imports {
    return {
      env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 4096 }),
        abort: (msg: number, file: number, line: number, col: number) => {
          console.error(`WASM abort at ${file}:${line}:${col}: ${msg}`);
        },
        log: (ptr: number, len: number) => {
          // String logging from WASM
        },
      },
      wasi_snapshot_preview1: {
        // WASI imports if needed
        fd_write: () => 0,
        fd_close: () => 0,
        proc_exit: () => {},
      },
    };
  }

  private static wrapExports(exports: WebAssembly.Exports): WASMExports {
    const wrapped: WASMExports = {};
    for (const [name, value] of Object.entries(exports)) {
      if (typeof value === 'function') {
        wrapped[name] = value;
      }
    }
    return wrapped;
  }
}

type ModuleStatus = 'loading' | 'ready' | 'executing' | 'error' | 'terminated';
type WASMExports = Record<string, Function>;

interface ModuleMetrics {
  invocations: number;
  errors: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  lastInvocation: Date | null;
}
```

### ResourceManager

Manages memory and CPU allocation across modules.

```typescript
class ResourceManager {
  private readonly managerId: ResourceManagerId;
  private memoryPool: MemoryPool;
  private cpuQuota: CPUQuota;
  private allocations: Map<ModuleId, ResourceAllocation>;
  private limits: ResourceLimits;

  // Factory
  static create(config: ResourceConfig): ResourceManager {
    return new ResourceManager(
      ResourceManagerId.generate(),
      MemoryPool.create(config.memoryLimit),
      CPUQuota.create(config.cpuLimit),
      new Map(),
      config.limits
    );
  }

  // Memory Allocation
  canAllocate(bytes: number): boolean {
    return this.memoryPool.available >= bytes;
  }

  allocate(moduleId: ModuleId, bytes: number): MemoryAllocation {
    if (!this.canAllocate(bytes)) {
      throw new AllocationFailedError(bytes, this.memoryPool.available);
    }

    const region = this.memoryPool.allocate(bytes);
    const allocation: ResourceAllocation = {
      moduleId,
      memory: region,
      cpu: this.cpuQuota.allocateSlice(),
      allocatedAt: new Date(),
    };

    this.allocations.set(moduleId, allocation);
    return { region, bytes };
  }

  deallocate(moduleId: ModuleId): void {
    const allocation = this.allocations.get(moduleId);
    if (allocation) {
      this.memoryPool.free(allocation.memory);
      this.cpuQuota.releaseSlice(allocation.cpu);
      this.allocations.delete(moduleId);
    }
  }

  // Usage Tracking
  getUsage(): ResourceUsage {
    return {
      memory: {
        total: this.memoryPool.total,
        used: this.memoryPool.used,
        available: this.memoryPool.available,
        utilization: this.memoryPool.used / this.memoryPool.total,
      },
      cpu: {
        allocated: this.cpuQuota.allocated,
        available: this.cpuQuota.available,
        utilization: this.cpuQuota.allocated / this.cpuQuota.total,
      },
      modules: this.allocations.size,
    };
  }

  getMemoryUsage(): number {
    return this.memoryPool.used;
  }

  getCPUUsage(): number {
    return this.cpuQuota.allocated / this.cpuQuota.total;
  }

  // Pool Management
  resize(newLimits: ResourceLimits): void {
    if (newLimits.memory < this.memoryPool.used) {
      throw new CannotShrinkPoolError(this.memoryPool.used, newLimits.memory);
    }
    this.memoryPool.resize(newLimits.memory);
    this.cpuQuota.resize(newLimits.cpu);
    this.limits = newLimits;
  }

  // Garbage Collection
  collectGarbage(): CollectionResult {
    const freedModules: ModuleId[] = [];
    const now = Date.now();

    for (const [moduleId, allocation] of this.allocations) {
      const idleTime = now - allocation.lastAccessed.getTime();
      if (idleTime > this.limits.idleTimeout) {
        this.deallocate(moduleId);
        freedModules.push(moduleId);
      }
    }

    return { freedModules, freedBytes: freedModules.length * 500_000 }; // ~500KB each
  }
}

interface ResourceAllocation {
  moduleId: ModuleId;
  memory: MemoryRegion;
  cpu: CPUSlice;
  allocatedAt: Date;
  lastAccessed: Date;
}
```

### ModuleLoader

Handles module loading, caching, and lazy loading.

```typescript
class ModuleLoader {
  private readonly loaderId: ModuleLoaderId;
  private cache: ModuleCache;
  private lazyQueue: LazyLoadQueue;
  private preloadList: Set<ModuleId>;
  private loadingStrategy: LoadingStrategy;

  // Factory
  static create(config: LoaderConfig): ModuleLoader {
    return new ModuleLoader(
      ModuleLoaderId.generate(),
      new ModuleCache(config.cacheSize),
      new LazyLoadQueue(),
      new Set(),
      config.strategy
    );
  }

  // Loading
  async load(binary: Uint8Array, config: ModuleConfig): Promise<WASMModule> {
    const hash = this.hashBinary(binary);

    // Check cache
    if (this.cache.has(hash)) {
      const cached = this.cache.get(hash);
      return WASMModule.fromCached(cached);
    }

    // Compile and instantiate
    const module = await WASMModule.compile(binary, config);

    // Cache compiled module
    this.cache.set(hash, module.getCompiledModule());

    return module;
  }

  // Lazy Loading
  async fetchBinary(moduleId: ModuleId): Promise<Uint8Array> {
    // Fetch from CDN or local storage
    const url = this.resolveBinaryUrl(moduleId);
    const response = await fetch(url);
    return new Uint8Array(await response.arrayBuffer());
  }

  queueLazyLoad(moduleId: ModuleId, priority: number): void {
    this.lazyQueue.enqueue(moduleId, priority);
  }

  async processLazyQueue(): Promise<LoadedModule[]> {
    const loaded: LoadedModule[] = [];

    while (!this.lazyQueue.isEmpty()) {
      const moduleId = this.lazyQueue.dequeue();
      const binary = await this.fetchBinary(moduleId);
      const module = await this.load(binary, { lazy: true });
      loaded.push({ moduleId, module });
    }

    return loaded;
  }

  // Preloading
  async preload(moduleIds: ModuleId[]): Promise<void> {
    const promises = moduleIds.map(async id => {
      if (!this.preloadList.has(id)) {
        this.preloadList.add(id);
        const binary = await this.fetchBinary(id);
        await this.load(binary, { preload: true });
      }
    });

    await Promise.all(promises);
  }

  // Cache Management
  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  private hashBinary(binary: Uint8Array): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < binary.length; i += 1024) {
      hash = ((hash << 5) - hash) + binary[i];
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private resolveBinaryUrl(moduleId: ModuleId): string {
    return `/modules/${moduleId.value}.wasm`;
  }
}

type LoadingStrategy = 'eager' | 'lazy' | 'on-demand';
```

---

## Value Objects

### DeploymentConfig

Configuration for deploying WASM modules.

```typescript
class DeploymentConfig {
  readonly targetPlatform: TargetPlatform;
  readonly optimizations: OptimizationFlags;
  readonly simdEnabled: boolean;
  readonly memoryModel: MemoryModel;
  readonly threadingModel: ThreadingModel;

  constructor(config: DeploymentConfigData) {
    this.targetPlatform = config.targetPlatform;
    this.optimizations = config.optimizations;
    this.simdEnabled = config.simdEnabled && this.platformSupportsSIMD();
    this.memoryModel = config.memoryModel;
    this.threadingModel = config.threadingModel;
  }

  private platformSupportsSIMD(): boolean {
    // Check WebAssembly SIMD support
    try {
      const simdTest = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
        0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
        0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x0b
      ]);
      new WebAssembly.Module(simdTest);
      return true;
    } catch {
      return false;
    }
  }

  getCompilerFlags(): string[] {
    const flags: string[] = [];

    if (this.optimizations.includes('size')) {
      flags.push('-Os');
    }
    if (this.optimizations.includes('speed')) {
      flags.push('-O3');
    }
    if (this.simdEnabled) {
      flags.push('-msimd128');
    }

    return flags;
  }

  equals(other: DeploymentConfig): boolean {
    return this.targetPlatform === other.targetPlatform &&
           this.simdEnabled === other.simdEnabled;
  }
}

type TargetPlatform = 'browser' | 'node' | 'edge' | 'embedded';
type OptimizationFlags = ('size' | 'speed' | 'debug')[];
type MemoryModel = 'shared' | 'isolated';
type ThreadingModel = 'single' | 'multi';
```

### MemoryRegion

Represents an allocated memory region.

```typescript
class MemoryRegion {
  readonly offset: number;
  readonly size: number;
  readonly permissions: MemoryPermissions;

  constructor(offset: number, size: number, permissions: MemoryPermissions) {
    if (offset < 0 || size <= 0) {
      throw new InvalidMemoryRegionError(offset, size);
    }
    this.offset = offset;
    this.size = size;
    this.permissions = permissions;
  }

  contains(address: number): boolean {
    return address >= this.offset && address < this.offset + this.size;
  }

  overlaps(other: MemoryRegion): boolean {
    return this.offset < other.offset + other.size &&
           other.offset < this.offset + this.size;
  }

  isReadable(): boolean {
    return this.permissions.includes('read');
  }

  isWritable(): boolean {
    return this.permissions.includes('write');
  }

  isExecutable(): boolean {
    return this.permissions.includes('execute');
  }

  equals(other: MemoryRegion): boolean {
    return this.offset === other.offset && this.size === other.size;
  }
}

type MemoryPermissions = ('read' | 'write' | 'execute')[];
```

### CPUAllocation

Represents CPU time allocation for a module.

```typescript
class CPUAllocation {
  readonly cores: number;
  readonly priority: CPUPriority;
  readonly timeSliceMs: number;
  readonly burstAllowed: boolean;

  constructor(
    cores: number,
    priority: CPUPriority,
    timeSliceMs: number,
    burstAllowed: boolean
  ) {
    if (cores <= 0 || timeSliceMs <= 0) {
      throw new InvalidCPUAllocationError(cores, timeSliceMs);
    }
    this.cores = cores;
    this.priority = priority;
    this.timeSliceMs = timeSliceMs;
    this.burstAllowed = burstAllowed;
  }

  getEffectiveShare(): number {
    const baseshare = this.timeSliceMs / 100; // Normalized to 100ms
    const priorityMultiplier = this.getPriorityMultiplier();
    return baseshare * priorityMultiplier;
  }

  private getPriorityMultiplier(): number {
    switch (this.priority) {
      case 'realtime': return 2.0;
      case 'high': return 1.5;
      case 'normal': return 1.0;
      case 'low': return 0.5;
      case 'idle': return 0.1;
    }
  }

  equals(other: CPUAllocation): boolean {
    return this.cores === other.cores &&
           this.priority === other.priority &&
           this.timeSliceMs === other.timeSliceMs;
  }
}

type CPUPriority = 'realtime' | 'high' | 'normal' | 'low' | 'idle';
```

---

## Domain Events

```typescript
// Environment Events
interface RuntimeInitialized extends DomainEvent {
  type: 'RuntimeInitialized';
  envId: string;
  memoryLimit: number;
  cpuLimit: number;
  simdEnabled: boolean;
}

interface RuntimeShutdown extends DomainEvent {
  type: 'RuntimeShutdown';
  envId: string;
  modulesUnloaded: number;
  reason: 'normal' | 'error' | 'resource_exhaustion';
}

// Module Events
interface ModuleLoaded extends DomainEvent {
  type: 'ModuleLoaded';
  envId: string;
  moduleId: string;
  binarySize: number;
  loadTimeMs: number;
  fromCache: boolean;
}

interface ModuleUnloaded extends DomainEvent {
  type: 'ModuleUnloaded';
  envId: string;
  moduleId: string;
  reason: 'explicit' | 'gc' | 'error';
}

// Execution Events
interface ExecutionCompleted extends DomainEvent {
  type: 'ExecutionCompleted';
  moduleId: string;
  functionName: string;
  durationMs: number;
  memoryUsed: number;
}

interface ExecutionFailed extends DomainEvent {
  type: 'ExecutionFailed';
  moduleId: string;
  functionName: string;
  error: string;
  stackTrace: string;
}

// Resource Events
interface ResourceAllocated extends DomainEvent {
  type: 'ResourceAllocated';
  moduleId: string;
  memoryBytes: number;
  cpuSlice: number;
}

interface ResourcePoolResized extends DomainEvent {
  type: 'ResourcePoolResized';
  envId: string;
  previousLimit: number;
  newLimit: number;
}

interface GarbageCollected extends DomainEvent {
  type: 'GarbageCollected';
  envId: string;
  freedModules: number;
  freedBytes: number;
}
```

---

## WASM Integration Details

### Binary Size Target: ~500KB

```
+------------------------------------------+
|          WASM MODULE STRUCTURE           |
+------------------------------------------+
|  Magic Number (4 bytes)    0x00 61 73 6D |
|  Version (4 bytes)         0x01 00 00 00 |
+------------------------------------------+
|  Type Section              ~2KB          |
|  Import Section            ~5KB          |
|  Function Section          ~10KB         |
|  Table Section             ~1KB          |
|  Memory Section            ~1KB          |
|  Global Section            ~2KB          |
|  Export Section            ~5KB          |
|  Code Section              ~450KB        |
|  Data Section              ~20KB         |
|  Custom Sections           ~4KB          |
+------------------------------------------+
|  TOTAL                     ~500KB        |
+------------------------------------------+
```

### SIMD Operations

```typescript
interface SIMDOperations {
  // Vector operations for embedding calculations
  vectorAdd(a: Float32Array, b: Float32Array): Float32Array;
  vectorMul(a: Float32Array, b: Float32Array): Float32Array;
  dotProduct(a: Float32Array, b: Float32Array): number;
  cosineSimilarity(a: Float32Array, b: Float32Array): number;

  // Matrix operations for Q-learning
  matrixMultiply(a: Float32Array[], b: Float32Array[]): Float32Array[];

  // Batch operations for efficiency
  batchNormalize(vectors: Float32Array[]): Float32Array[];
  batchDotProduct(queries: Float32Array[], keys: Float32Array[]): Float32Array;
}
```

### Lazy Loading Strategy

```typescript
class LazyLoadingStrategy {
  // Priority tiers for loading
  static readonly CRITICAL = 1;   // Load immediately
  static readonly HIGH = 2;       // Load within 100ms
  static readonly NORMAL = 3;     // Load within 1s
  static readonly LOW = 4;        // Load on-demand

  // Assignment rules
  static getPriority(agentType: string): number {
    switch (agentType) {
      case 'coordinator': return this.CRITICAL;
      case 'router': return this.CRITICAL;
      case 'security': return this.HIGH;
      case 'optimizer': return this.NORMAL;
      case 'specialist': return this.LOW;
      default: return this.NORMAL;
    }
  }
}
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Module Load Time | < 50ms | From cache |
| Cold Load Time | < 200ms | First load |
| Function Call | < 0.1ms | Simple functions |
| Memory Overhead | < 2x binary | Runtime overhead |
| SIMD Speedup | 4-8x | For vector ops |
| GC Pause | < 10ms | Incremental collection |

---

## Invariants

1. **Binary Validation**: Only valid WASM binaries can be loaded
2. **Memory Bounds**: All memory access must be within allocated regions
3. **Resource Limits**: Total allocations cannot exceed pool limits
4. **Module Uniqueness**: Each module has a unique ID
5. **Execution Isolation**: Modules cannot access each other's memory
6. **Graceful Degradation**: Resource exhaustion triggers GC, not crash
