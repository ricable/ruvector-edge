/**
 * ELEX Edge AI Agent Swarm - Performance Utilities
 *
 * Utilities for performance measurement and optimization.
 */

/**
 * High-resolution timer for performance measurement
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;
  private running: boolean = false;

  /**
   * Start the timer
   */
  start(): void {
    this.startTime = performance.now();
    this.running = true;
  }

  /**
   * Stop the timer
   */
  stop(): number {
    this.endTime = performance.now();
    this.running = false;
    return this.elapsed;
  }

  /**
   * Get elapsed time in milliseconds
   */
  get elapsed(): number {
    if (this.running) {
      return performance.now() - this.startTime;
    }
    return this.endTime - this.startTime;
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.running = false;
  }
}

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const timer = new Timer();
  timer.start();
  const result = await fn();
  const durationMs = timer.stop();
  return { result, durationMs };
}

/**
 * Measure execution time of a sync function
 */
export function measureSync<T>(
  fn: () => T
): { result: T; durationMs: number } {
  const timer = new Timer();
  timer.start();
  const result = fn();
  const durationMs = timer.stop();
  return { result, durationMs };
}

/**
 * Rolling average calculator
 */
export class RollingAverage {
  private values: number[] = [];
  private readonly maxSize: number;
  private sum: number = 0;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add a value
   */
  add(value: number): void {
    this.values.push(value);
    this.sum += value;

    if (this.values.length > this.maxSize) {
      this.sum -= this.values.shift()!;
    }
  }

  /**
   * Get the current average
   */
  get average(): number {
    if (this.values.length === 0) return 0;
    return this.sum / this.values.length;
  }

  /**
   * Get the count
   */
  get count(): number {
    return this.values.length;
  }

  /**
   * Reset
   */
  reset(): void {
    this.values = [];
    this.sum = 0;
  }
}

/**
 * Rate limiter
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /**
   * Try to acquire a token
   */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /**
   * Wait to acquire a token
   */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Get time until next token is available
   */
  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return (1 - this.tokens) / this.refillRate * 1000;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Batch executor for processing items in batches
 */
export class BatchExecutor<T, R> {
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly processor: (items: T[]) => Promise<R[]>;

  constructor(
    batchSize: number,
    concurrency: number,
    processor: (items: T[]) => Promise<R[]>
  ) {
    this.batchSize = batchSize;
    this.concurrency = concurrency;
    this.processor = processor;
  }

  /**
   * Process all items
   */
  async process(items: T[]): Promise<R[]> {
    const results: R[] = [];
    const batches: T[][] = [];

    // Create batches
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }

    // Process batches with concurrency limit
    for (let i = 0; i < batches.length; i += this.concurrency) {
      const concurrentBatches = batches.slice(i, i + this.concurrency);
      const batchResults = await Promise.all(
        concurrentBatches.map(batch => this.processor(batch))
      );
      results.push(...batchResults.flat());
    }

    return results;
  }
}
