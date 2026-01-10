/**
 * WASM Runtime
 * WebAssembly runtime for edge agent deployment
 *
 * Agent binary size: ~364KB
 * Supported platforms: Browser, Mobile, Node.js
 *
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 */

import type { Timestamp, Duration } from '../../../core/types/interfaces.js';
import { DeploymentMode } from '../../../core/types/enums.js';

export interface IWASMRuntimeConfig {
  /** Deployment mode */
  mode: DeploymentMode;
  /** Initial memory pages (64KB each) */
  memoryPages?: number;
  /** Maximum memory pages */
  maxMemoryPages?: number;
  /** Enable shared memory for threading */
  sharedMemory?: boolean;
}

export interface IMemoryUsage {
  heapUsed: number;
  heapTotal: number;
  wasmMemory: number;
  vectorIndex: number;
  qTable: number;
  external: number;
}

interface WASMModule {
  instance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
  exports: Record<string, unknown>;
}

/**
 * WASMRuntime manages WebAssembly agent execution
 */
export class WASMRuntime {
  private readonly config: Required<IWASMRuntimeConfig>;
  private module: WASMModule | null;
  private running: boolean;
  private startTime: Timestamp;
  private memoryUsage: IMemoryUsage;

  constructor(config: IWASMRuntimeConfig) {
    this.config = {
      mode: config.mode,
      memoryPages: config.memoryPages ?? 256, // 16MB initial
      maxMemoryPages: config.maxMemoryPages ?? 4096, // 256MB max
      sharedMemory: config.sharedMemory ?? false,
    };

    this.module = null;
    this.running = false;
    this.startTime = 0;
    this.memoryUsage = {
      heapUsed: 0,
      heapTotal: 0,
      wasmMemory: 0,
      vectorIndex: 0,
      qTable: 0,
      external: 0,
    };
  }

  /**
   * Load WASM module from URL or ArrayBuffer
   */
  async load(source: string | ArrayBuffer): Promise<void> {
    let wasmBuffer: ArrayBuffer;

    if (typeof source === 'string') {
      const response = await fetch(source);
      wasmBuffer = await response.arrayBuffer();
    } else {
      wasmBuffer = source;
    }

    // Create memory
    const memory = new WebAssembly.Memory({
      initial: this.config.memoryPages,
      maximum: this.config.maxMemoryPages,
      shared: this.config.sharedMemory,
    });

    // Import object for WASM
    const imports = {
      env: {
        memory,
        log: (ptr: number, len: number) => {
          // In production: Read string from WASM memory
          console.log('[WASM]', ptr, len);
        },
        now: () => Date.now(),
        random: () => Math.random(),
      },
    };

    // Compile and instantiate
    const compiled = await WebAssembly.compile(wasmBuffer);
    const instance = await WebAssembly.instantiate(compiled, imports);

    this.module = {
      instance,
      memory,
      exports: instance.exports as Record<string, unknown>,
    };
  }

  /**
   * Initialize the WASM runtime
   */
  async initialize(): Promise<void> {
    if (!this.module) {
      throw new Error('WASM module not loaded');
    }

    // Call WASM init function if available
    const init = this.module.exports['init'] as (() => void) | undefined;
    if (init) {
      init();
    }

    this.running = true;
    this.startTime = Date.now();
    this.updateMemoryUsage();
  }

  /**
   * Execute a WASM function
   */
  async execute<T>(functionName: string, args: unknown[]): Promise<T> {
    if (!this.module) {
      throw new Error('WASM module not loaded');
    }

    const fn = this.module.exports[functionName] as ((...args: unknown[]) => T) | undefined;
    if (!fn) {
      throw new Error(`Function '${functionName}' not found in WASM module`);
    }

    const result = fn(...args);
    this.updateMemoryUsage();

    return result;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): IMemoryUsage {
    this.updateMemoryUsage();
    return { ...this.memoryUsage };
  }

  private updateMemoryUsage(): void {
    if (!this.module) return;

    const wasmMemory = this.module.memory.buffer.byteLength;

    this.memoryUsage = {
      heapUsed: 0, // Would come from WASM exports
      heapTotal: wasmMemory,
      wasmMemory,
      vectorIndex: 0, // Would come from HNSW module
      qTable: 0, // Would come from Q-table module
      external: 0,
    };
  }

  /**
   * Unload WASM module and cleanup
   */
  async unload(): Promise<void> {
    this.running = false;
    this.module = null;
    this.memoryUsage = {
      heapUsed: 0,
      heapTotal: 0,
      wasmMemory: 0,
      vectorIndex: 0,
      qTable: 0,
      external: 0,
    };
  }

  /**
   * Check if runtime is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get runtime uptime
   */
  getUptime(): Duration {
    if (!this.running) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Get deployment mode
   */
  getMode(): DeploymentMode {
    return this.config.mode;
  }

  /**
   * Get runtime status
   */
  getStatus(): {
    running: boolean;
    mode: DeploymentMode;
    uptime: Duration;
    memoryMB: number;
    moduleLoaded: boolean;
  } {
    return {
      running: this.running,
      mode: this.config.mode,
      uptime: this.getUptime(),
      memoryMB: this.memoryUsage.wasmMemory / (1024 * 1024),
      moduleLoaded: this.module !== null,
    };
  }
}
