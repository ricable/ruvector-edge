/**
 * Energy Optimization Domain
 *
 * Domain for energy optimization decisions in RAN networks.
 * Implements GOAL-008 (MIMO Sleep) and GOAL-009 (Cell Sleep).
 */

// Value Objects
export * from './value-objects/energy-state';
export * from './value-objects/energy-action';
export * from './value-objects/energy-reward';

// Entities
export {
  EnergyOptimizer,
  MIMOSleepOptimizer,
  CellSleepOptimizer,
  OptimizationResult
} from './entities/energy-optimizer';

// Aggregates
export * from './aggregates/energy-optimization-cycle';
