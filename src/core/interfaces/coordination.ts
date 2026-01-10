/**
 * @fileoverview Swarm coordination interfaces
 * @module @ruvector/edge/core/interfaces/coordination
 *
 * @see ADR-001: Swarm Topology Selection
 * @see ADR-002: Consensus Protocol Selection
 */

import type {
  AgentId,
  SwarmId,
  MessageId,
  FAJCode
} from '../types/identifiers.js';

import type {
  SwarmTopology,
  ConsensusProtocol,
  Category
} from '../types/enums.js';

import type {
  Timestamp,
  Vector,
  PublicKey,
  Signature,
  EncryptedPayload,
  ConfidenceScore
} from '../types/primitives.js';

import type { IQuery, IRoutingResult } from './query.js';

/**
 * Swarm coordinator for hybrid topology
 * @see ADR-001: Swarm Topology Selection
 */
export interface ISwarmCoordinator {
  readonly swarmId: SwarmId;
  readonly topology: SwarmTopology;

  /** Initialize swarm with agents */
  initialize(config: ISwarmConfig): Promise<void>;

  /** Shutdown swarm gracefully */
  shutdown(): Promise<void>;

  /** Route query to appropriate agent(s) */
  routeQuery(query: IQuery): Promise<IRoutingResult>;

  /** Get category coordinator for a category */
  getCategoryCoordinator(category: Category): ICategoryCoordinator | undefined;

  /** Get all active agents */
  getActiveAgents(): AgentId[];

  /** Get swarm health status */
  getHealth(): ISwarmHealth;
}

/**
 * Swarm configuration
 */
export interface ISwarmConfig {
  readonly topology: SwarmTopology;
  readonly maxAgents: number;
  readonly coordinatorCount: number;
  readonly gossipInterval: number;
  readonly raftElectionTimeout: number;
}

/**
 * Swarm health status
 */
export interface ISwarmHealth {
  readonly activeAgents: number;
  readonly healthyAgents: number;
  readonly coordinatorStatus: ICoordinatorStatus[];
  readonly lastGossipRound: Timestamp;
  readonly consensusReady: boolean;
}

/**
 * Coordinator status
 */
export interface ICoordinatorStatus {
  readonly category: Category;
  readonly agentId: AgentId;
  readonly isLeader: boolean;
  readonly health: number;
  readonly lastHeartbeat: Timestamp;
}

/**
 * Category coordinator (Raft consensus)
 * 14 coordinators for 14 categories
 * @see ADR-002: Consensus Protocol Selection
 */
export interface ICategoryCoordinator {
  readonly category: Category;
  readonly agentId: AgentId;
  readonly protocol: ConsensusProtocol.Raft;

  /** Check if this coordinator is the leader */
  isLeader(): boolean;

  /** Get current leader */
  getLeader(): AgentId | undefined;

  /** Get agents in this category */
  getAgents(): AgentId[];

  /** Register new agent to category */
  registerAgent(agentId: AgentId, fajCode: FAJCode): Promise<void>;

  /** Unregister agent from category */
  unregisterAgent(agentId: AgentId): Promise<void>;

  /** Propose value for consensus */
  propose<T>(value: T): Promise<boolean>;

  /** Get committed value */
  getCommitted<T>(key: string): T | undefined;
}

/**
 * Semantic router using HNSW
 * @see ADR-005: HNSW Vector Indexing
 */
export interface ISemanticRouter {
  /** Add agent to routing index */
  addAgent(agentId: AgentId, fajCode: FAJCode, embedding: Vector): Promise<void>;

  /** Remove agent from routing index */
  removeAgent(agentId: AgentId): Promise<void>;

  /** Route query to top-K agents (<1ms target) */
  route(queryEmbedding: Vector, k: number): Promise<IRoutingResult>;

  /** Get index statistics */
  getStats(): IRouterStats;

  /** Rebuild index */
  rebuild(): Promise<void>;
}

/**
 * Router statistics
 */
export interface IRouterStats {
  readonly totalAgents: number;
  readonly indexSize: number;
  readonly averageLatencyMs: number;
  readonly lastRebuild: Timestamp;
}

/**
 * P2P transport layer
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 */
export interface IP2PTransport {
  /** Connect to P2P network */
  connect(): Promise<void>;

  /** Disconnect from P2P network */
  disconnect(): Promise<void>;

  /** Send message to peer */
  send(peerId: AgentId, message: ISecureMessage): Promise<void>;

  /** Broadcast message to all peers */
  broadcast(message: ISecureMessage): Promise<void>;

  /** Subscribe to incoming messages */
  subscribe(handler: (message: ISecureMessage) => void): () => void;

  /** Get connected peers */
  getPeers(): AgentId[];
}

/**
 * Secure inter-agent message
 * @see ADR-007: Security and Cryptography Architecture
 */
export interface ISecureMessage {
  readonly id: MessageId;
  readonly senderId: AgentId;
  readonly recipientId: AgentId | 'broadcast';
  readonly payload: EncryptedPayload;
  readonly signature: Signature;
  readonly timestamp: Timestamp;
  readonly nonce: string;

  /** Verify message signature */
  verify(publicKey: PublicKey): boolean;

  /** Check if message is within time window (5 min) */
  isWithinTimeWindow(): boolean;
}

/**
 * Gossip protocol for feature agents
 * @see ADR-002: Consensus Protocol Selection
 */
export interface IGossipProtocol {
  /** Start gossip rounds */
  start(): void;

  /** Stop gossip rounds */
  stop(): void;

  /** Spread update to peers */
  spread<T>(key: string, value: T, version: number): Promise<void>;

  /** Get value from gossip network */
  get<T>(key: string): { value: T; version: number } | undefined;

  /** Subscribe to updates */
  subscribe<T>(key: string, handler: (value: T, version: number) => void): () => void;
}

/**
 * CRDT for conflict-free replication
 * @see ADR-002: Consensus Protocol Selection
 */
export interface ICRDT<T> {
  readonly type: 'g-counter' | 'pn-counter' | 'lww-register' | 'or-set' | 'mv-register';

  /** Get current value */
  value(): T;

  /** Merge with remote state */
  merge(remote: ICRDT<T>): void;

  /** Serialize for transmission */
  serialize(): Uint8Array;

  /** Compare with another CRDT */
  compare(other: ICRDT<T>): -1 | 0 | 1;
}

/**
 * Raft consensus state
 */
export interface IRaftState {
  readonly term: number;
  readonly votedFor: AgentId | null;
  readonly log: IRaftLogEntry[];
  readonly commitIndex: number;
  readonly lastApplied: number;
}

/**
 * Raft log entry
 */
export interface IRaftLogEntry {
  readonly term: number;
  readonly index: number;
  readonly command: unknown;
  readonly timestamp: Timestamp;
}

/**
 * Federated learning coordinator
 * @see ADR-009: Federated Learning
 */
export interface IFederatedLearning {
  /** Trigger sync with peers */
  sync(): Promise<void>;

  /** Get sync interval (60s default) */
  getSyncInterval(): number;

  /** Set sync interval */
  setSyncInterval(ms: number): void;

  /** Get last sync time */
  getLastSync(): Timestamp;

  /** Get merge statistics */
  getMergeStats(): IMergeStats;
}

/**
 * Merge statistics for federated learning
 */
export interface IMergeStats {
  readonly totalMerges: number;
  readonly statesUpdated: number;
  readonly conflictsResolved: number;
  readonly lastMergeLatencyMs: number;
}
