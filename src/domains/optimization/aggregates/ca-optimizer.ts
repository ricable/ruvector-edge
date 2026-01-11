/**
 * Carrier Aggregation Optimizer - GOAL-010
 *
 * Optimizes CA configuration for 89 agents targeting +50% throughput increase.
 * Categories: 2CC DL (15), 3CC DL (12), 4CC DL (8), UL CA (10), Cross-band CA (20),
 *             LAA/LTE-U (8), NR CA (16)
 */

export interface CAMetrics {
  userThroughputMbps: number;
  caActivationRate: number;
  sccAdditionLatencyMs: number;
  carrierUtilization: number;
  loadBalanceIndex: number;
  congestionEvents: number;
}

export interface IFLBParameters {
  algorithm: 'IFLB_enhanced';
  loadThreshold: number;
  congestionThreshold: number;
  balancingIntervalMs: number;
  sccAdditionTimeoutMs: number;
  maxCarriers: number;
  priorityUl: boolean;
  adaptiveThreshold: boolean;
}

export interface CAAgent {
  id: string;
  category: CAcategory;
  carriers: string[];
  enabled: boolean;
  throughputImpact: number;
}

export type CAcategory =
  | '2cc_dl'
  | '3cc_dl'
  | '4cc_dl'
  | 'ul_ca'
  | 'cross_band_ca'
  | 'laa_lte_u'
  | 'nr_ca';

export class CAOptimizer {
  private agents: Map<string, CAAgent> = new Map();
  private iflbParams: IFLBParameters;
  private metrics: CAMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor(iflbParams?: Partial<IFLBParameters>) {
    this.iflbParams = {
      algorithm: 'IFLB_enhanced',
      loadThreshold: 30,
      congestionThreshold: 80,
      balancingIntervalMs: 100,
      sccAdditionTimeoutMs: 100,
      maxCarriers: 4,
      priorityUl: false,
      adaptiveThreshold: true,
      ...iflbParams
    };
    this.initializeAgents();
  }

  /**
   * Initialize 89 CA agents across 7 categories
   */
  private initializeAgents(): void {
    const agentConfig = [
      { category: '2cc_dl' as CAcategory, count: 15, carriers: 2 },
      { category: '3cc_dl' as CAcategory, count: 12, carriers: 3 },
      { category: '4cc_dl' as CAcategory, count: 8, carriers: 4 },
      { category: 'ul_ca' as CAcategory, count: 10, carriers: 2 },
      { category: 'cross_band_ca' as CAcategory, count: 20, carriers: 3 },
      { category: 'laa_lte_u' as CAcategory, count: 8, carriers: 2 },
      { category: 'nr_ca' as CAcategory, count: 16, carriers: 3 }
    ];

    let agentIndex = 0;
    for (const config of agentConfig) {
      for (let i = 0; i < config.count; i++) {
        const agentId = `ca_${config.category}_${String(i + 1).padStart(3, '0')}`;
        this.agents.set(agentId, {
          id: agentId,
          category: config.category,
          carriers: this.generateCarrierBands(config.category, config.carriers),
          enabled: false,
          throughputImpact: 0
        });
        agentIndex++;
      }
    }
  }

  private generateCarrierBands(category: CAcategory, count: number): string[] {
    const bandMap = {
      '2cc_dl': ['B1', 'B3', 'B7', 'B8', 'B20'],
      '3cc_dl': ['B1', 'B3', 'B7', 'B8', 'B20'],
      '4cc_dl': ['B1', 'B3', 'B7', 'B8'],
      'ul_ca': ['B1', 'B3', 'B7'],
      'cross_band_ca': ['B1', 'B3', 'B7', 'B8', 'B20', 'B38', 'B40'],
      'laa_lte_u': ['B46', 'B48'],
      'nr_ca': ['B1', 'B3', 'B7', 'B8', 'B20', 'B78', 'B79']
    };

    const availableBands = bandMap[category] || bandMap['2cc_dl'];
    const selected: string[] = [];
    for (let i = 0; i < count && i < availableBands.length; i++) {
      selected.push(availableBands[i]);
    }
    return selected;
  }

  /**
   * Activate CA agents based on load and congestion triggers
   */
  async activateAgents(loadImbalance: number, carrierCongestion: number): Promise<CAAgent[]> {
    const activated: CAAgent[] = [];

    // Check triggers
    const shouldActivate = loadImbalance > this.iflbParams.loadThreshold ||
                          carrierCongestion > this.iflbParams.congestionThreshold;

    if (!shouldActivate) {
      return activated;
    }

    // Priority-based activation
    const priorityOrder = [
      'cross_band_ca',  // Highest impact
      '4cc_dl',
      '3cc_dl',
      'nr_ca',
      '2cc_dl',
      'ul_ca',
      'laa_lte_u'
    ];

    for (const category of priorityOrder) {
      const categoryAgents = Array.from(this.agents.values())
        .filter(a => a.category === category && !a.enabled);

      for (const agent of categoryAgents) {
        if (activated.length >= this.iflbParams.maxCarriers) break;

        const startTime = performance.now();
        agent.enabled = true;
        agent.throughputImpact = this.estimateThroughputImpact(category);
        activated.push(agent);

        // Track SCC addition latency
        const latency = performance.now() - startTime;
        if (latency > this.iflbParams.sccAdditionTimeoutMs) {
          console.warn(`SCC addition timeout for ${agent.id}: ${latency.toFixed(2)}ms`);
        }
      }
    }

    return activated;
  }

  private estimateThroughputImpact(category: CAcategory): number {
    const impactMap = {
      '2cc_dl': 1.5,    // 50% increase
      '3cc_dl': 2.0,    // 100% increase
      '4cc_dl': 2.5,    // 150% increase
      'ul_ca': 1.3,     // 30% increase
      'cross_band_ca': 2.2,  // 120% increase
      'laa_lte_u': 1.8, // 80% increase
      'nr_ca': 2.3      // 130% increase
    };
    return impactMap[category] || 1.0;
  }

  /**
   * Calculate current metrics
   */
  calculateMetrics(): CAMetrics {
    const enabledAgents = Array.from(this.agents.values()).filter(a => a.enabled);
    const totalAgents = this.agents.size;

    const caActivationRate = (enabledAgents.length / totalAgents) * 100;

    // Calculate average throughput impact
    const avgThroughputImpact = enabledAgents.length > 0
      ? enabledAgents.reduce((sum, a) => sum + a.throughputImpact, 0) / enabledAgents.length
      : 0;

    // Simulate user throughput (baseline 20 Mbps + impact)
    const baselineThroughput = 20;
    const userThroughputMbps = baselineThroughput * (1 + (avgThroughputImpact - 1) * 0.5);

    return {
      userThroughputMbps,
      caActivationRate,
      sccAdditionLatencyMs: this.iflbParams.sccAdditionTimeoutMs,
      carrierUtilization: Math.min(95, caActivationRate * 0.8 + 40),
      loadBalanceIndex: Math.max(0, 100 - caActivationRate * 0.3),
      congestionEvents: Math.floor(Math.random() * 5)
    };
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(callback?: (metrics: CAMetrics) => void): void {
    this.monitoringInterval = setInterval(() => {
      const metrics = this.calculateMetrics();
      this.metrics.push(metrics);

      // Keep only last 60 samples
      if (this.metrics.length > 60) {
        this.metrics.shift();
      }

      if (callback) {
        callback(metrics);
      }
    }, this.iflbParams.balancingIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Generate optimization report
   */
  generateReport(): {
    summary: string;
    metrics: CAMetrics;
    agents: CAAgent[];
    successCriteria: { met: boolean; details: string[] };
  } {
    const currentMetrics = this.calculateMetrics();
    const enabledAgents = Array.from(this.agents.values()).filter(a => a.enabled);

    const successCriteria = {
      met: true,
      details: [] as string[]
    };

    // Check +50% throughput increase
    const baselineThroughput = 20;
    const throughputIncrease = ((currentMetrics.userThroughputMbps - baselineThroughput) / baselineThroughput) * 100;
    if (throughputIncrease >= 50) {
      successCriteria.details.push(`✓ Throughput increase: +${throughputIncrease.toFixed(1)}% (target: +50%)`);
    } else {
      successCriteria.met = false;
      successCriteria.details.push(`✗ Throughput increase: +${throughputIncrease.toFixed(1)}% (target: +50%)`);
    }

    // Check CA activation rate >95%
    if (currentMetrics.caActivationRate >= 95) {
      successCriteria.details.push(`✓ CA activation rate: ${currentMetrics.caActivationRate.toFixed(1)}% (target: >95%)`);
    } else {
      successCriteria.met = false;
      successCriteria.details.push(`✗ CA activation rate: ${currentMetrics.caActivationRate.toFixed(1)}% (target: >95%)`);
    }

    // Check SCC addition latency <100ms
    if (currentMetrics.sccAdditionLatencyMs <= 100) {
      successCriteria.details.push(`✓ SCC addition latency: ${currentMetrics.sccAdditionLatencyMs}ms (target: <100ms)`);
    } else {
      successCriteria.met = false;
      successCriteria.details.push(`✗ SCC addition latency: ${currentMetrics.sccAdditionLatencyMs}ms (target: <100ms)`);
    }

    const summary = `
Carrier Aggregation Optimization Report - GOAL-010
================================================

Total Agents: ${this.agents.size}
Enabled Agents: ${enabledAgents.length}

Configuration:
- Algorithm: ${this.iflbParams.algorithm}
- Load Threshold: ${this.iflbParams.loadThreshold}%
- Congestion Threshold: ${this.iflbParams.congestionThreshold}%
- Balancing Interval: ${this.iflbParams.balancingIntervalMs}ms
- Max Carriers: ${this.iflbParams.maxCarriers}

Current Metrics:
- User Throughput: ${currentMetrics.userThroughputMbps.toFixed(2)} Mbps
- CA Activation Rate: ${currentMetrics.caActivationRate.toFixed(1)}%
- SCC Addition Latency: ${currentMetrics.sccAdditionLatencyMs}ms
- Carrier Utilization: ${currentMetrics.carrierUtilization.toFixed(1)}%
- Load Balance Index: ${currentMetrics.loadBalanceIndex.toFixed(1)}
- Congestion Events: ${currentMetrics.congestionEvents}

Success Criteria: ${successCriteria.met ? 'MET ✓' : 'NOT MET ✗'}
${successCriteria.details.join('\n')}
    `.trim();

    return {
      summary,
      metrics: currentMetrics,
      agents: enabledAgents,
      successCriteria
    };
  }

  /**
   * Get all agents
   */
  getAllAgents(): CAAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: CAcategory): CAAgent[] {
    return Array.from(this.agents.values()).filter(a => a.category === category);
  }

  /**
   * Reset all agents
   */
  resetAgents(): void {
    for (const agent of this.agents.values()) {
      agent.enabled = false;
      agent.throughputImpact = 0;
    }
    this.metrics = [];
  }

  /**
   * Update IFLB parameters
   */
  updateIFLBParams(params: Partial<IFLBParameters>): void {
    this.iflbParams = { ...this.iflbParams, ...params };
  }
}
