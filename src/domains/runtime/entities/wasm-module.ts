/**
 * WASMModule Entity
 *
 * Manages WebAssembly module compilation, instantiation, and execution
 * for cross-platform agent deployment.
 */

export interface WASMModuleConfig {
  readonly binaryPath: string;
  readonly memoryPages: number;       // 64KB per page
  readonly tableSize: number;
  readonly importObject?: WebAssembly.Imports;
}

export interface WASMExports {
  readonly memory: WebAssembly.Memory;
  [key: string]: WebAssembly.ExportValue;
}

export type ModuleState = 'unloaded' | 'loading' | 'compiled' | 'instantiated' | 'error';

export interface ModuleStats {
  readonly compileTimeMs: number;
  readonly instantiateTimeMs: number;
  readonly memoryUsageBytes: number;
  readonly functionCallCount: number;
}

/**
 * WASMModule Entity
 */
export class WASMModule {
  readonly id: string;
  private _config: WASMModuleConfig;
  private _state: ModuleState;
  private _compiledModule: WebAssembly.Module | null;
  private _instance: WebAssembly.Instance | null;
  private _stats: ModuleStats;
  private _loadError: Error | null;

  constructor(id: string, config: WASMModuleConfig) {
    this.id = id;
    this._config = config;
    this._state = 'unloaded';
    this._compiledModule = null;
    this._instance = null;
    this._stats = {
      compileTimeMs: 0,
      instantiateTimeMs: 0,
      memoryUsageBytes: 0,
      functionCallCount: 0
    };
    this._loadError = null;
  }

  /**
   * Compile the WASM module from binary
   */
  async compile(binary: ArrayBuffer): Promise<void> {
    if (this._state !== 'unloaded') {
      throw new Error(`Cannot compile in state: ${this._state}`);
    }

    this._state = 'loading';
    const startTime = performance.now();

    try {
      this._compiledModule = await WebAssembly.compile(binary);
      this._state = 'compiled';
      this._stats = {
        ...this._stats,
        compileTimeMs: performance.now() - startTime
      };
    } catch (error) {
      this._state = 'error';
      this._loadError = error instanceof Error ? error : new Error(String(error));
      throw this._loadError;
    }
  }

  /**
   * Instantiate the compiled module
   */
  async instantiate(importObject?: WebAssembly.Imports): Promise<WASMExports> {
    if (this._state !== 'compiled') {
      throw new Error(`Cannot instantiate in state: ${this._state}. Compile first.`);
    }

    const startTime = performance.now();
    const imports = importObject ?? this._config.importObject ?? {};

    try {
      this._instance = await WebAssembly.instantiate(this._compiledModule!, imports);
      this._state = 'instantiated';

      const memory = this._instance.exports.memory as WebAssembly.Memory;
      this._stats = {
        ...this._stats,
        instantiateTimeMs: performance.now() - startTime,
        memoryUsageBytes: memory?.buffer?.byteLength ?? 0
      };

      return this._instance.exports as unknown as WASMExports;
    } catch (error) {
      this._state = 'error';
      this._loadError = error instanceof Error ? error : new Error(String(error));
      throw this._loadError;
    }
  }

  /**
   * Compile and instantiate in one step
   */
  async load(binary: ArrayBuffer, importObject?: WebAssembly.Imports): Promise<WASMExports> {
    await this.compile(binary);
    return this.instantiate(importObject);
  }

  /**
   * Call an exported function
   */
  call<T>(functionName: string, ...args: unknown[]): T {
    if (this._state !== 'instantiated' || !this._instance) {
      throw new Error('Module not instantiated');
    }

    const fn = this._instance.exports[functionName];
    if (typeof fn !== 'function') {
      throw new Error(`Export '${functionName}' is not a function`);
    }

    this._stats = {
      ...this._stats,
      functionCallCount: this._stats.functionCallCount + 1
    };

    return (fn as CallableFunction)(...args) as T;
  }

  /**
   * Get memory buffer
   */
  getMemory(): ArrayBuffer | null {
    if (!this._instance) {
      return null;
    }
    const memory = this._instance.exports.memory as WebAssembly.Memory;
    return memory?.buffer ?? null;
  }

  /**
   * Read string from WASM memory
   */
  readString(ptr: number, len: number): string {
    const memory = this.getMemory();
    if (!memory) {
      throw new Error('No memory available');
    }
    const bytes = new Uint8Array(memory, ptr, len);
    return new TextDecoder().decode(bytes);
  }

  /**
   * Write string to WASM memory
   */
  writeString(ptr: number, str: string): number {
    const memory = this.getMemory();
    if (!memory) {
      throw new Error('No memory available');
    }
    const bytes = new TextEncoder().encode(str);
    const view = new Uint8Array(memory, ptr, bytes.length);
    view.set(bytes);
    return bytes.length;
  }

  /**
   * Unload the module
   */
  unload(): void {
    this._compiledModule = null;
    this._instance = null;
    this._state = 'unloaded';
    this._loadError = null;
  }

  /**
   * Check if module is ready for use
   */
  isReady(): boolean {
    return this._state === 'instantiated' && this._instance !== null;
  }

  // Getters
  get config(): WASMModuleConfig { return this._config; }
  get state(): ModuleState { return this._state; }
  get stats(): ModuleStats { return this._stats; }
  get error(): Error | null { return this._loadError; }

  /**
   * Get list of exported functions
   */
  getExportedFunctions(): string[] {
    if (!this._instance) {
      return [];
    }
    return Object.entries(this._instance.exports)
      .filter(([_, value]) => typeof value === 'function')
      .map(([name]) => name);
  }

  equals(other: WASMModule): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `WASMModule(${this.id}, state=${this._state}, calls=${this._stats.functionCallCount})`;
  }
}
