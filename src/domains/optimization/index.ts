/**
 * Optimization Bounded Context
 *
 * Core Domain: KPI monitoring, root cause analysis, parameter optimization,
 * and system integrity assessment.
 *
 * Responsibility:
 * - 6-phase closed-loop optimization (Observe-Analyze-Decide-Act-Learn-Repeat)
 * - Multi-level spatio-temporal KPI monitoring
 * - Root cause analysis with counter correlation
 * - Safe zone enforcement and rollback management
 * - Min-cut fragility detection
 *
 * Key Aggregates:
 * - OptimizationCycle (Aggregate Root)
 * - KPIMonitor
 * - RootCauseAnalyzer
 * - SafeZone
 * - MinCutAnalyzer
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';
