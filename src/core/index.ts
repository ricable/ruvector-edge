/**
 * @fileoverview Core module barrel export
 * @module @ruvector/edge/core
 *
 * ELEX Edge AI Agent Swarm - Core Types and Interfaces
 *
 * This module provides the foundational types, interfaces, and value objects
 * for the ELEX distributed agent system.
 *
 * Architecture Layers:
 * - Layer 1: Knowledge Layer (593 feature agents)
 * - Layer 2: Intelligence Layer (Q-learning, pattern recognition)
 * - Layer 3: Optimization Layer (KPI monitoring, root cause analysis)
 * - Layer 4: Coordination Layer (semantic routing, consensus)
 * - Layer 5: Runtime Layer (WASM, edge deployment)
 *
 * @see docs/architecture.md
 */

// Core Types and Enums
export * from './types/index.js';

// Core Interfaces (pre-existing)
export * from './interfaces/index.js';

// Agent System
export * from './agent/index.js';

// Knowledge Base
export * from './knowledge/index.js';

// Vector Memory
export * from './memory/index.js';

// Q-Learning
export * from './learning/index.js';

// Errors
export * from './errors/index.js';

// Utilities
export * from './utils/index.js';

/**
 * Module version
 */
export const VERSION = '2.1.0';

/**
 * Agent counts by technology
 */
export const AGENT_COUNTS = {
  LTE: 307,
  NR: 284,
  GSM: 1,
  CrossRAT: 1,
  TOTAL: 593,
} as const;

/**
 * Coverage statistics
 */
export const COVERAGE_STATS = {
  parameters: 5230,
  counters: 5416,
  kpis: 736,
  categories: 15,
} as const;

/**
 * Performance targets
 */
export const PERFORMANCE_TARGETS = {
  routingLatencyMs: 1,      // <1ms task routing
  responseLatencyMs: 500,   // <500ms response generation
  learningConvergence: 100, // <100 interactions
  swarmSyncTimeS: 5,        // <5s sync time
  agentAvailability: 0.995, // >99.5%
} as const;
