/**
 * @fileoverview Consensus protocols module
 * @module @ruvector/edge/layers/coordination/consensus
 */

export { RaftConsensus } from './raft-consensus.js';
export { GossipProtocol } from './gossip-protocol.js';
export type { IRaftState, IRaftConfig, ILogEntry } from './raft-consensus.js';
export type { IGossipConfig, IGossipMessage } from './gossip-protocol.js';
