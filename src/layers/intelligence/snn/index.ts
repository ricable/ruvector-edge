/**
 * SNN Module
 * Exports Spiking Neural Network components for anomaly detection
 */

export {
  SpikingNeuron,
  STDPSynapse,
  type LIFParams,
} from './spiking-neuron';

export {
  SNNAnomalyDetector,
  type CounterSample,
  type SNNEventCallback,
} from './snn-anomaly-detector';
