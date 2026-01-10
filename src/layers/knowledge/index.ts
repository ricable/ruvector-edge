/**
 * @fileoverview Knowledge Layer - 593 Feature Agents
 * @module @ruvector/edge/layers/knowledge
 *
 * Layer 1: Knowledge Layer
 * - 593 specialized feature agents
 * - 307 LTE agents (51.8%)
 * - 284 NR/5G agents (47.9%)
 * - 2 Cross-RAT agents (0.2%)
 *
 * @see ADR-004: One Agent Per Feature Specialization
 * @see docs/architecture.md
 */

export * from './feature-catalog/index.js';
export * from './feature-agent/index.js';
export * from './knowledge-base/index.js';
