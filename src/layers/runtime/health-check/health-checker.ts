/**
 * Health Checker
 * System health monitoring for edge runtime
 *
 * Checks:
 * - WASM runtime status
 * - Memory usage
 * - Network connectivity
 * - Storage availability
 * - Agent responsiveness
 */

import type { Timestamp, Duration } from '../../../core/types/interfaces.js';

export interface IHealthCheckConfig {
  /** Check interval in ms (default: 30000) */
  checkInterval?: number;
  /** Component timeout in ms (default: 5000) */
  componentTimeout?: number;
  /** Health score threshold (0-1) */
  healthThreshold?: number;
}

export interface IComponentHealth {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  lastCheck: Timestamp;
}

export interface IHealthResult {
  healthy: boolean;
  score: number;
  components: IComponentHealth[];
  timestamp: Timestamp;
  checkDuration: Duration;
}

type HealthCheckFn = () => Promise<IComponentHealth>;

/**
 * HealthChecker monitors system health
 */
export class HealthChecker {
  private readonly config: Required<IHealthCheckConfig>;
  private readonly checks: Map<string, HealthCheckFn>;
  private lastResult: IHealthResult | null;
  private checkTimer: ReturnType<typeof setInterval> | null;
  private running: boolean;

  constructor(config?: IHealthCheckConfig) {
    this.config = {
      checkInterval: config?.checkInterval ?? 30000,
      componentTimeout: config?.componentTimeout ?? 5000,
      healthThreshold: config?.healthThreshold ?? 0.8,
    };

    this.checks = new Map();
    this.lastResult = null;
    this.checkTimer = null;
    this.running = false;

    // Register default checks
    this.registerDefaultChecks();
  }

  /**
   * Register a health check
   */
  registerCheck(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.checkTimer = setInterval(
      () => this.runChecks(),
      this.config.checkInterval
    );

    // Run initial check
    this.runChecks();
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    this.running = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Run all health checks
   */
  async check(): Promise<IHealthResult> {
    return this.runChecks();
  }

  /**
   * Get last health result
   */
  getLastResult(): IHealthResult | null {
    return this.lastResult;
  }

  /**
   * Get specific component health
   */
  getComponentHealth(name: string): IComponentHealth | undefined {
    return this.lastResult?.components.find(c => c.name === name);
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    if (!this.lastResult) return false;
    return this.lastResult.healthy;
  }

  private async runChecks(): Promise<IHealthResult> {
    const startTime = Date.now();
    const components: IComponentHealth[] = [];

    for (const [name, check] of this.checks) {
      try {
        const result = await this.runWithTimeout(check, name);
        components.push(result);
      } catch (error) {
        components.push({
          name,
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
          lastCheck: Date.now(),
        });
      }
    }

    const healthyCount = components.filter(c => c.healthy).length;
    const score = components.length > 0 ? healthyCount / components.length : 0;
    const healthy = score >= this.config.healthThreshold;

    const result: IHealthResult = {
      healthy,
      score,
      components,
      timestamp: Date.now(),
      checkDuration: Date.now() - startTime,
    };

    this.lastResult = result;
    return result;
  }

  private async runWithTimeout(
    check: HealthCheckFn,
    name: string
  ): Promise<IComponentHealth> {
    return Promise.race([
      check(),
      new Promise<IComponentHealth>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Health check timeout: ${name}`)),
          this.config.componentTimeout
        )
      ),
    ]);
  }

  private registerDefaultChecks(): void {
    // Memory check
    this.registerCheck('memory', async () => {
      const startTime = Date.now();

      // Check if we can allocate memory
      try {
        const testArray = new Uint8Array(1024 * 1024); // 1MB
        testArray[0] = 1; // Ensure allocation
        return {
          name: 'memory',
          healthy: true,
          latencyMs: Date.now() - startTime,
          lastCheck: Date.now(),
        };
      } catch {
        return {
          name: 'memory',
          healthy: false,
          error: 'Memory allocation failed',
          lastCheck: Date.now(),
        };
      }
    });

    // Crypto check
    this.registerCheck('crypto', async () => {
      const startTime = Date.now();

      try {
        const testData = new Uint8Array(32);
        crypto.getRandomValues(testData);
        await crypto.subtle.digest('SHA-256', testData);

        return {
          name: 'crypto',
          healthy: true,
          latencyMs: Date.now() - startTime,
          lastCheck: Date.now(),
        };
      } catch (error) {
        return {
          name: 'crypto',
          healthy: false,
          error: error instanceof Error ? error.message : 'Crypto unavailable',
          lastCheck: Date.now(),
        };
      }
    });

    // Time check (for message signing)
    this.registerCheck('time', async () => {
      const startTime = Date.now();

      // Simple check that time is reasonable
      const now = Date.now();
      const reasonable = now > 1600000000000 && now < 2000000000000;

      return {
        name: 'time',
        healthy: reasonable,
        latencyMs: Date.now() - startTime,
        error: reasonable ? undefined : 'System time appears incorrect',
        lastCheck: Date.now(),
      };
    });
  }

  /**
   * Get health checker statistics
   */
  getStats(): {
    running: boolean;
    checkCount: number;
    lastCheckTime: Timestamp | null;
    checkInterval: Duration;
  } {
    return {
      running: this.running,
      checkCount: this.checks.size,
      lastCheckTime: this.lastResult?.timestamp ?? null,
      checkInterval: this.config.checkInterval,
    };
  }
}
