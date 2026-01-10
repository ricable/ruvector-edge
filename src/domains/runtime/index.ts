/**
 * Runtime Bounded Context
 *
 * Generic Domain: WASM compilation, edge deployment, resource management,
 * and cross-platform execution.
 *
 * Responsibility:
 * - WebAssembly module management (~364KB per agent)
 * - Cross-platform deployment (browser, mobile, edge)
 * - Resource monitoring and allocation
 * - P2P networking configuration
 *
 * Deployment Modes:
 * - Full Browser ($0/mo) - Uses GUN.js public relays
 * - Edge Cluster ($15-60/mo) - Dedicated edge nodes
 * - Hybrid ($5-20/mo) - Raft coordinators + feature agents
 *
 * Key Aggregates:
 * - RuntimeEnvironment (Aggregate Root)
 * - WASMModule
 * - ResourceManager
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';
