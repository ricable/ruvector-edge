/**
 * @fileoverview Runtime Layer - WASM and Edge Deployment
 * @module @ruvector/edge/layers/runtime
 *
 * Layer 5: Edge Runtime
 * - WASM Runtime (~364KB/agent)
 * - Node.js Runtime
 * - Mobile WASM
 * - Security Layer (Ed25519, AES-256-GCM, Post-Quantum Hybrid)
 *
 * Deployment Modes:
 * - Browser (WASM): $0/month baseline
 * - Mobile (WASM): Same agent binaries
 * - Edge Server (Node.js): $5-60/month
 *
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 * @see ADR-007: Security and Cryptography Architecture
 */

export * from './wasm-runtime/index.js';
export * from './edge-persistence/index.js';
export * from './crypto-provider/index.js';
export * from './health-check/index.js';
