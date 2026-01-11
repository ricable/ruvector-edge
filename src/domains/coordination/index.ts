/**
 * Coordination Bounded Context
 *
 * Supporting Domain: Semantic routing, consensus protocols, P2P transport,
 * and swarm topology management.
 *
 * Responsibility:
 * - HNSW-based semantic query routing (<1ms)
 * - Raft consensus for coordinators
 * - Gossip + CRDT for agent eventual consistency
 * - Topology management (mesh, hierarchical, sharded, hybrid)
 *
 * Key Aggregates:
 * - Swarm (Aggregate Root)
 * - Router
 * - ConsensusManager
 * - TopologyManager
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Aggregates
export * from './aggregates';

// Domain Events
export * from './domain-events';
