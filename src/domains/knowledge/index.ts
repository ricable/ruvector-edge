/**
 * Knowledge Bounded Context
 *
 * Core Domain: Managing the 593 specialized feature agents, each mastering
 * a single Ericsson RAN feature.
 *
 * Responsibility:
 * - Feature agent lifecycle management
 * - Knowledge base storage and retrieval
 * - Parameter and counter cataloging
 * - FAJ code identification
 *
 * Key Aggregates:
 * - FeatureAgent (Aggregate Root)
 * - KnowledgeBase
 * - ParameterCatalog
 * - CounterCatalog
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';
