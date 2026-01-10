/**
 * Intelligence Bounded Context
 *
 * Core Domain: Self-learning capabilities including Q-learning, pattern recognition,
 * trajectory replay, and federated learning.
 *
 * Responsibility:
 * - Q-learning state-action value management
 * - Trajectory recording and experience replay
 * - Federated learning coordination
 * - Pattern detection and learning
 *
 * Key Aggregates:
 * - QTable (Aggregate Root)
 * - TrajectoryBuffer
 * - FederatedMerger
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';
