/**
 * @fileoverview Coordination Layer - Semantic Routing and Consensus
 * @module @ruvector/edge/layers/coordination
 *
 * Layer 4: Coordination Layer
 * - Semantic Routing (HNSW <1ms)
 * - Raft Consensus (Coordinators)
 * - Gossip + CRDT (Feature Agents)
 * - P2P Transport (GUN.js / WebRTC)
 *
 * @see ADR-001: Swarm Topology Selection
 * @see ADR-002: Consensus Protocol Selection
 * @see ADR-005: HNSW Vector Indexing
 */

export * from './semantic-router/index.js';
export * from './consensus/index.js';
export * from './swarm-coordinator/index.js';
export * from './p2p-transport/index.js';
