/**
 * Test Metrics Value Object
 *
 * Captures performance metrics during battle test execution.
 *
 * @module ran-battle-test/value-objects/test-metrics
 */

/**
 * Performance metrics for a test session
 */
export interface PerformanceMetrics {
  readonly totalQuestions: number;
  readonly totalDuration: number;
  readonly averageLatency: number;
  readonly minLatency: number;
  readonly maxLatency: number;
  readonly percentile95: number;
  readonly percentile99: number;
}

/**
 * Metrics snapshot at a point in time
 */
export interface MetricsSnapshot {
  readonly timestamp: Date;
  readonly questionsCompleted: number;
  readonly currentHealth: number;
  readonly currentConfidence: number;
  readonly explorationRate: number;
  readonly stateTransitions: number;
}

/**
 * Test Metrics Value Object
 *
 * Immutable collection of test execution metrics.
 */
export class TestMetrics {
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly snapshots: readonly MetricsSnapshot[];
  readonly performance: PerformanceMetrics;
  readonly agentHealth: Map<string, number>;
  readonly agentConfidence: Map<string, number>;
  readonly oodaLoopCount: number;

  private constructor(
    startTime: Date,
    endTime: Date | undefined,
    snapshots: MetricsSnapshot[],
    performance: PerformanceMetrics,
    agentHealth: Map<string, number>,
    agentConfidence: Map<string, number>,
    oodaLoopCount: number
  ) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.snapshots = Object.freeze(snapshots);
    this.performance = Object.freeze(performance);
    this.agentHealth = new Map(agentHealth);
    this.agentConfidence = new Map(agentConfidence);
    this.oodaLoopCount = oodaLoopCount;

    Object.freeze(this);
  }

  /**
   * Factory method to create initial metrics
   */
  static create(startTime: Date = new Date()): TestMetrics {
    return new TestMetrics(
      startTime,
      undefined,
      [],
      {
        totalQuestions: 0,
        totalDuration: 0,
        averageLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        percentile95: 0,
        percentile99: 0
      },
      new Map(),
      new Map(),
      0
    );
  }

  /**
   * Add a metrics snapshot
   */
  addSnapshot(snapshot: MetricsSnapshot): TestMetrics {
    return new TestMetrics(
      this.startTime,
      this.endTime,
      [...this.snapshots, snapshot],
      this.performance,
      new Map(this.agentHealth),
      new Map(this.agentConfidence),
      this.oodaLoopCount
    );
  }

  /**
   * Update performance metrics with new latency data
   */
  updatePerformance(latencies: number[]): TestMetrics {
    if (latencies.length === 0) {
      return this;
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const performance: PerformanceMetrics = {
      totalQuestions: this.performance.totalQuestions + latencies.length,
      totalDuration: this.performance.totalDuration + latencies.reduce((sum, l) => sum + l, 0),
      averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      minLatency: Math.min(this.performance.minLatency, ...latencies),
      maxLatency: Math.max(this.performance.maxLatency, ...latencies),
      percentile95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      percentile99: sorted[Math.floor(sorted.length * 0.99)] || 0
    };

    return new TestMetrics(
      this.startTime,
      this.endTime,
      this.snapshots,
      performance,
      this.agentHealth,
      this.agentConfidence,
      this.oodaLoopCount
    );
  }

  /**
   * Mark test as complete
   */
  complete(endTime: Date = new Date()): TestMetrics {
    return new TestMetrics(
      this.startTime,
      endTime,
      this.snapshots,
      this.performance,
      this.agentHealth,
      this.agentConfidence,
      this.oodaLoopCount
    );
  }

  /**
   * Get test duration
   */
  getDuration(): number {
    const end = this.endTime ?? new Date();
    return end.getTime() - this.startTime.getTime();
  }

  /**
   * Get average health across all agents
   */
  getAverageHealth(): number {
    if (this.agentHealth.size === 0) return 0;
    const sum = Array.from(this.agentHealth.values()).reduce((a, b) => a + b, 0);
    return sum / this.agentHealth.size;
  }

  /**
   * Get average confidence across all agents
   */
  getAverageConfidence(): number {
    if (this.agentConfidence.size === 0) return 0;
    const sum = Array.from(this.agentConfidence.values()).reduce((a, b) => a + b, 0);
    return sum / this.agentConfidence.size;
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): MetricsSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * String representation
   */
  toString(): string {
    const duration = this.getDuration();
    return `TestMetrics(${this.performance.totalQuestions} questions, ${duration}ms, avg ${this.performance.averageLatency.toFixed(2)}ms latency)`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      performance: this.performance,
      agentHealth: Object.fromEntries(this.agentHealth),
      agentConfidence: Object.fromEntries(this.agentConfidence),
      oodaLoopCount: this.oodaLoopCount,
      snapshotCount: this.snapshots.length
    };
  }
}

export default TestMetrics;
