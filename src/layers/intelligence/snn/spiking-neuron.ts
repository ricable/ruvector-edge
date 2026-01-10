/**
 * Spiking Neuron
 * Leaky Integrate-and-Fire (LIF) neuron model with STDP learning
 */

import type { NeuronState, STDPConfig } from '../types';

const DEFAULT_STDP: STDPConfig = {
  tauPlus: 20,    // ms
  tauMinus: 20,   // ms
  aPlus: 0.1,
  aMinus: 0.12,   // Slightly stronger depression for stability
  wMax: 1.0,
  wMin: 0.0,
};

/** LIF neuron parameters */
export interface LIFParams {
  restPotential: number;      // Resting membrane potential
  threshold: number;          // Spike threshold
  refractoryPeriod: number;   // Refractory period in ms
  leakRate: number;           // Membrane leak rate (tau_m)
  resetPotential: number;     // Potential after spike
}

const DEFAULT_LIF: LIFParams = {
  restPotential: 0,
  threshold: 1.0,
  refractoryPeriod: 3,  // ms
  leakRate: 20,         // tau_m = 20ms
  resetPotential: 0,
};

/**
 * SpikingNeuron implements a Leaky Integrate-and-Fire model
 */
export class SpikingNeuron {
  readonly id: string;
  private potential: number;
  private threshold: number;
  private lastSpikeTime: number;
  private refractoryUntil: number;
  private readonly params: LIFParams;
  private spikeTrace: number;  // For STDP learning

  constructor(id: string, params: Partial<LIFParams> = {}) {
    this.id = id;
    this.params = { ...DEFAULT_LIF, ...params };
    this.potential = this.params.restPotential;
    this.threshold = this.params.threshold;
    this.lastSpikeTime = -Infinity;
    this.refractoryUntil = -Infinity;
    this.spikeTrace = 0;
  }

  /**
   * Update neuron state and check for spike
   */
  update(input: number, currentTime: number, dt: number): boolean {
    // Check refractory period
    if (currentTime < this.refractoryUntil) {
      return false;
    }

    // Leak (exponential decay toward rest potential)
    const leak = (this.potential - this.params.restPotential) *
      (1 - Math.exp(-dt / this.params.leakRate));
    this.potential -= leak;

    // Integrate input
    this.potential += input;

    // Update spike trace (exponential decay)
    this.spikeTrace *= Math.exp(-dt / DEFAULT_STDP.tauPlus);

    // Check for spike
    if (this.potential >= this.threshold) {
      this.spike(currentTime);
      return true;
    }

    return false;
  }

  /**
   * Process spike
   */
  private spike(currentTime: number): void {
    this.lastSpikeTime = currentTime;
    this.refractoryUntil = currentTime + this.params.refractoryPeriod;
    this.potential = this.params.resetPotential;
    this.spikeTrace = 1.0;  // Reset trace on spike
  }

  /**
   * Get current state
   */
  getState(): NeuronState {
    return {
      id: this.id,
      potential: this.potential,
      threshold: this.threshold,
      lastSpikeTime: this.lastSpikeTime,
      refractoryUntil: this.refractoryUntil,
    };
  }

  /**
   * Get spike trace (for STDP)
   */
  getSpikeTrace(): number {
    return this.spikeTrace;
  }

  /**
   * Reset neuron to initial state
   */
  reset(): void {
    this.potential = this.params.restPotential;
    this.lastSpikeTime = -Infinity;
    this.refractoryUntil = -Infinity;
    this.spikeTrace = 0;
  }

  /**
   * Set potential directly (for testing)
   */
  setPotential(value: number): void {
    this.potential = value;
  }

  /**
   * Get potential
   */
  getPotential(): number {
    return this.potential;
  }

  /**
   * Get last spike time
   */
  getLastSpikeTime(): number {
    return this.lastSpikeTime;
  }
}

/**
 * Synapse with STDP learning
 */
export class STDPSynapse {
  readonly preId: string;
  readonly postId: string;
  private weight: number;
  private readonly config: STDPConfig;

  constructor(
    preId: string,
    postId: string,
    initialWeight: number = 0.5,
    config: Partial<STDPConfig> = {}
  ) {
    this.preId = preId;
    this.postId = postId;
    this.weight = initialWeight;
    this.config = { ...DEFAULT_STDP, ...config };
  }

  /**
   * Apply STDP learning rule
   * Called when either pre or post neuron spikes
   */
  applySTDP(
    preSpike: boolean,
    postSpike: boolean,
    preSpikeTime: number,
    postSpikeTime: number
  ): void {
    if (preSpike && postSpike) {
      // Both spiked - use timing difference
      const dt = postSpikeTime - preSpikeTime;
      this.updateWeight(dt);
    } else if (preSpike) {
      // Pre-synaptic spike - use trace from post
      // This will be handled by network-level STDP
    } else if (postSpike) {
      // Post-synaptic spike - use trace from pre
      // This will be handled by network-level STDP
    }
  }

  /**
   * Update weight based on spike timing difference
   */
  updateWeight(dt: number): void {
    let dw: number;

    if (dt > 0) {
      // Pre before post - potentiation (LTP)
      dw = this.config.aPlus * Math.exp(-dt / this.config.tauPlus);
    } else if (dt < 0) {
      // Post before pre - depression (LTD)
      dw = -this.config.aMinus * Math.exp(dt / this.config.tauMinus);
    } else {
      return; // No change for simultaneous spikes
    }

    // Apply weight change with bounds
    this.weight = Math.max(
      this.config.wMin,
      Math.min(this.config.wMax, this.weight + dw)
    );
  }

  /**
   * Update weight using spike traces
   */
  updateWithTraces(preTrace: number, postTrace: number): void {
    // Simplified trace-based STDP
    const dw = this.config.aPlus * preTrace * postTrace -
      this.config.aMinus * preTrace * postTrace * 0.5;

    this.weight = Math.max(
      this.config.wMin,
      Math.min(this.config.wMax, this.weight + dw)
    );
  }

  /**
   * Get weight
   */
  getWeight(): number {
    return this.weight;
  }

  /**
   * Set weight directly
   */
  setWeight(weight: number): void {
    this.weight = Math.max(this.config.wMin, Math.min(this.config.wMax, weight));
  }

  /**
   * Get synapse info
   */
  getInfo(): { preId: string; postId: string; weight: number } {
    return {
      preId: this.preId,
      postId: this.postId,
      weight: this.weight,
    };
  }
}
