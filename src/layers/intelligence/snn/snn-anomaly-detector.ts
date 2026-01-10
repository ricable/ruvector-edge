/**
 * SNN Anomaly Detector
 * Spiking Neural Network for counter anomaly detection
 * Uses STDP learning to detect temporal patterns
 */

import type { SNNConfig, AnomalyResult, AnomalyDetectedEvent } from '../types';
import { SpikingNeuron, STDPSynapse } from './spiking-neuron';

const DEFAULT_SNN_CONFIG: SNNConfig = {
  numNeurons: 64,
  stdp: {
    tauPlus: 20,
    tauMinus: 20,
    aPlus: 0.1,
    aMinus: 0.12,
    wMax: 1.0,
    wMin: 0.0,
  },
  timeStep: 1,           // 1ms
  restPotential: 0,
  spikeThreshold: 1.0,
  refractoryPeriod: 3,
};

/** Counter value with timestamp */
export interface CounterSample {
  name: string;
  value: number;
  timestamp: number;
}

/** Event callback type */
export type SNNEventCallback = (event: AnomalyDetectedEvent) => void;

/**
 * SNNAnomalyDetector uses a spiking neural network to detect
 * anomalies in counter time series data
 */
export class SNNAnomalyDetector {
  private readonly config: SNNConfig;
  private readonly agentId: string;
  private readonly neurons: Map<string, SpikingNeuron>;
  private readonly synapses: STDPSynapse[];
  private readonly counterHistory: Map<string, number[]>;
  private readonly counterStats: Map<string, { mean: number; std: number }>;
  private currentTime: number;
  private eventListeners: SNNEventCallback[];
  private readonly historyLength: number;

  constructor(agentId: string, config: Partial<SNNConfig> = {}) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_SNN_CONFIG, ...config };
    this.neurons = new Map();
    this.synapses = [];
    this.counterHistory = new Map();
    this.counterStats = new Map();
    this.currentTime = 0;
    this.eventListeners = [];
    this.historyLength = 100; // Keep last 100 samples for statistics

    this.initializeNetwork();
  }

  /**
   * Initialize the SNN architecture
   */
  private initializeNetwork(): void {
    const n = this.config.numNeurons;

    // Create input layer neurons (encode counter values)
    for (let i = 0; i < n / 2; i++) {
      const neuron = new SpikingNeuron(`input_${i}`, {
        restPotential: this.config.restPotential,
        threshold: this.config.spikeThreshold,
        refractoryPeriod: this.config.refractoryPeriod,
      });
      this.neurons.set(neuron.id, neuron);
    }

    // Create hidden layer neurons (detect patterns)
    for (let i = 0; i < n / 4; i++) {
      const neuron = new SpikingNeuron(`hidden_${i}`, {
        restPotential: this.config.restPotential,
        threshold: this.config.spikeThreshold * 0.8, // Lower threshold for pattern detection
        refractoryPeriod: this.config.refractoryPeriod,
      });
      this.neurons.set(neuron.id, neuron);
    }

    // Create output layer neurons (anomaly detection)
    for (let i = 0; i < n / 4; i++) {
      const neuron = new SpikingNeuron(`output_${i}`, {
        restPotential: this.config.restPotential,
        threshold: this.config.spikeThreshold * 1.2, // Higher threshold for anomaly
        refractoryPeriod: this.config.refractoryPeriod,
      });
      this.neurons.set(neuron.id, neuron);
    }

    // Create synapses with random initial weights
    const inputNeurons = Array.from(this.neurons.keys()).filter(id => id.startsWith('input_'));
    const hiddenNeurons = Array.from(this.neurons.keys()).filter(id => id.startsWith('hidden_'));
    const outputNeurons = Array.from(this.neurons.keys()).filter(id => id.startsWith('output_'));

    // Connect input to hidden (sparse connectivity)
    for (const inputId of inputNeurons) {
      for (const hiddenId of hiddenNeurons) {
        if (Math.random() < 0.3) { // 30% connectivity
          const synapse = new STDPSynapse(
            inputId,
            hiddenId,
            Math.random() * 0.5, // Initial weight
            this.config.stdp
          );
          this.synapses.push(synapse);
        }
      }
    }

    // Connect hidden to output
    for (const hiddenId of hiddenNeurons) {
      for (const outputId of outputNeurons) {
        if (Math.random() < 0.5) { // 50% connectivity
          const synapse = new STDPSynapse(
            hiddenId,
            outputId,
            Math.random() * 0.5,
            this.config.stdp
          );
          this.synapses.push(synapse);
        }
      }
    }
  }

  /**
   * Process counter samples and detect anomalies
   */
  process(samples: CounterSample[]): AnomalyResult {
    // Update statistics
    for (const sample of samples) {
      this.updateStats(sample);
    }

    // Encode samples to spike trains
    const encodedInputs = this.encodeInputs(samples);

    // Run network simulation
    const outputSpikes = this.simulate(encodedInputs);

    // Detect anomaly from output spikes
    const anomalyScore = this.calculateAnomalyScore(outputSpikes);
    const isAnomaly = anomalyScore > 0.7;

    // Calculate expected values
    const expectedValues: Record<string, number> = {};
    const counterValues: Record<string, number> = {};
    for (const sample of samples) {
      counterValues[sample.name] = sample.value;
      const stats = this.counterStats.get(sample.name);
      if (stats) {
        expectedValues[sample.name] = stats.mean;
      }
    }

    const result: AnomalyResult = {
      isAnomaly,
      confidence: anomalyScore,
      pattern: this.identifyPattern(samples, outputSpikes),
      timestamp: Date.now(),
      counterValues,
      expectedValues,
    };

    // Emit event if anomaly detected
    if (isAnomaly) {
      this.emitEvent({
        type: 'anomaly_detected',
        timestamp: Date.now(),
        agentId: this.agentId,
        anomaly: result,
      });
    }

    return result;
  }

  /**
   * Update counter statistics
   */
  private updateStats(sample: CounterSample): void {
    let history = this.counterHistory.get(sample.name);
    if (!history) {
      history = [];
      this.counterHistory.set(sample.name, history);
    }

    history.push(sample.value);
    if (history.length > this.historyLength) {
      history.shift();
    }

    // Calculate running statistics
    if (history.length >= 10) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
      const std = Math.sqrt(variance);

      this.counterStats.set(sample.name, { mean, std });
    }
  }

  /**
   * Encode counter values as spike inputs
   */
  private encodeInputs(samples: CounterSample[]): Map<string, number> {
    const inputs = new Map<string, number>();
    const inputNeurons = Array.from(this.neurons.keys()).filter(id => id.startsWith('input_'));

    for (let i = 0; i < samples.length && i < inputNeurons.length; i++) {
      const sample = samples[i];
      const stats = this.counterStats.get(sample.name);

      // Calculate z-score if stats available
      let zScore = 0;
      if (stats && stats.std > 0) {
        zScore = (sample.value - stats.mean) / stats.std;
      }

      // Convert z-score to spike probability/intensity
      const intensity = Math.min(2.0, Math.abs(zScore) / 2);
      inputs.set(inputNeurons[i], intensity);

      // Also encode sign of deviation in adjacent neuron
      if (i * 2 + 1 < inputNeurons.length) {
        inputs.set(inputNeurons[i * 2], zScore > 0 ? intensity : 0);
        inputs.set(inputNeurons[i * 2 + 1], zScore < 0 ? intensity : 0);
      }
    }

    return inputs;
  }

  /**
   * Run network simulation
   */
  private simulate(inputs: Map<string, number>): Map<string, boolean> {
    const spikes = new Map<string, boolean>();
    const dt = this.config.timeStep;
    const simulationSteps = 50; // 50ms simulation window

    // Run simulation
    for (let step = 0; step < simulationSteps; step++) {
      this.currentTime += dt;

      // Process each neuron
      for (const [id, neuron] of this.neurons) {
        // Calculate total input from synapses
        let totalInput = inputs.get(id) ?? 0;

        // Add synaptic inputs
        for (const synapse of this.synapses) {
          if (synapse.postId === id) {
            const preNeuron = this.neurons.get(synapse.preId);
            if (preNeuron) {
              totalInput += preNeuron.getSpikeTrace() * synapse.getWeight();
            }
          }
        }

        // Update neuron and check for spike
        const spiked = neuron.update(totalInput, this.currentTime, dt);
        if (spiked) {
          spikes.set(id, true);

          // Apply STDP learning
          this.applySTDP(neuron);
        }
      }
    }

    return spikes;
  }

  /**
   * Apply STDP learning for a spiking neuron
   */
  private applySTDP(postNeuron: SpikingNeuron): void {
    for (const synapse of this.synapses) {
      if (synapse.postId === postNeuron.id) {
        const preNeuron = this.neurons.get(synapse.preId);
        if (preNeuron) {
          // Use spike traces for STDP
          synapse.updateWithTraces(
            preNeuron.getSpikeTrace(),
            postNeuron.getSpikeTrace()
          );
        }
      }
    }
  }

  /**
   * Calculate anomaly score from output spikes
   */
  private calculateAnomalyScore(spikes: Map<string, boolean>): number {
    const outputNeurons = Array.from(this.neurons.keys()).filter(id => id.startsWith('output_'));
    let spikeCount = 0;

    for (const id of outputNeurons) {
      if (spikes.get(id)) {
        spikeCount++;
      }
    }

    // Normalize to [0, 1]
    return spikeCount / outputNeurons.length;
  }

  /**
   * Identify the type of anomaly pattern
   */
  private identifyPattern(samples: CounterSample[], _spikes: Map<string, boolean>): string {
    const patterns: string[] = [];

    for (const sample of samples) {
      const stats = this.counterStats.get(sample.name);
      if (stats && stats.std > 0) {
        const zScore = (sample.value - stats.mean) / stats.std;

        if (Math.abs(zScore) > 3) {
          patterns.push(`extreme_${zScore > 0 ? 'high' : 'low'}_${sample.name}`);
        } else if (Math.abs(zScore) > 2) {
          patterns.push(`${zScore > 0 ? 'spike' : 'drop'}_${sample.name}`);
        }
      }
    }

    if (patterns.length === 0) {
      return 'subtle_deviation';
    }

    return patterns.join(', ');
  }

  /**
   * Train on labeled data
   */
  train(
    samples: CounterSample[],
    isAnomaly: boolean,
    learningRate: number = 0.1
  ): void {
    // Process samples
    const encodedInputs = this.encodeInputs(samples);
    const outputSpikes = this.simulate(encodedInputs);

    // Calculate current prediction
    const predicted = this.calculateAnomalyScore(outputSpikes);
    const target = isAnomaly ? 1.0 : 0.0;
    const error = target - predicted;

    // Adjust weights based on error
    for (const synapse of this.synapses) {
      if (synapse.postId.startsWith('output_')) {
        const preNeuron = this.neurons.get(synapse.preId);
        if (preNeuron && preNeuron.getSpikeTrace() > 0) {
          const currentWeight = synapse.getWeight();
          const newWeight = currentWeight + learningRate * error * preNeuron.getSpikeTrace();
          synapse.setWeight(newWeight);
        }
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(callback: SNNEventCallback): void {
    this.eventListeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: SNNEventCallback): void {
    const index = this.eventListeners.indexOf(callback);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: AnomalyDetectedEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in SNN event listener:', error);
      }
    }
  }

  /**
   * Get network statistics
   */
  getStats(): {
    neuronCount: number;
    synapseCount: number;
    avgWeight: number;
    trackedCounters: number;
    currentTime: number;
  } {
    let totalWeight = 0;
    for (const synapse of this.synapses) {
      totalWeight += synapse.getWeight();
    }

    return {
      neuronCount: this.neurons.size,
      synapseCount: this.synapses.length,
      avgWeight: this.synapses.length > 0 ? totalWeight / this.synapses.length : 0,
      trackedCounters: this.counterStats.size,
      currentTime: this.currentTime,
    };
  }

  /**
   * Reset network state
   */
  reset(): void {
    for (const neuron of this.neurons.values()) {
      neuron.reset();
    }
    this.currentTime = 0;
  }

  /**
   * Clear history and statistics
   */
  clearHistory(): void {
    this.counterHistory.clear();
    this.counterStats.clear();
  }
}
