/**
 * ConsensusManager Entity
 *
 * Manages distributed consensus using Raft for coordinators
 * and Gossip/CRDT for agents.
 */

export type ConsensusProtocol = 'raft' | 'gossip' | 'crdt' | 'byzantine';

export interface ConsensusConfig {
  readonly protocol: ConsensusProtocol;
  readonly quorumSize: number;           // Minimum votes needed
  readonly timeoutMs: number;            // Election/heartbeat timeout
  readonly heartbeatIntervalMs: number;
}

export interface Vote {
  readonly voterId: string;
  readonly proposalId: string;
  readonly inFavor: boolean;
  readonly timestamp: Date;
}

export interface Proposal {
  readonly id: string;
  readonly type: string;
  readonly value: unknown;
  readonly proposerId: string;
  readonly timestamp: Date;
  readonly votes: Vote[];
  readonly status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export type RaftState = 'follower' | 'candidate' | 'leader';

export interface RaftStatus {
  readonly state: RaftState;
  readonly term: number;
  readonly leaderId: string | null;
  readonly votedFor: string | null;
  readonly lastHeartbeat: Date | null;
}

/**
 * ConsensusManager Entity
 */
export class ConsensusManager {
  readonly id: string;
  private _config: ConsensusConfig;
  private _proposals: Map<string, Proposal>;
  private _raftStatus: RaftStatus;
  private _peers: Set<string>;
  private _gossipState: Map<string, { value: unknown; version: number }>;

  constructor(
    id: string,
    config: ConsensusConfig = {
      protocol: 'raft',
      quorumSize: 2,
      timeoutMs: 5000,
      heartbeatIntervalMs: 1000
    }
  ) {
    this.id = id;
    this._config = config;
    this._proposals = new Map();
    this._raftStatus = {
      state: 'follower',
      term: 0,
      leaderId: null,
      votedFor: null,
      lastHeartbeat: null
    };
    this._peers = new Set();
    this._gossipState = new Map();
  }

  /**
   * Register a peer node
   */
  registerPeer(peerId: string): void {
    this._peers.add(peerId);
  }

  /**
   * Unregister a peer node
   */
  unregisterPeer(peerId: string): void {
    this._peers.delete(peerId);
  }

  /**
   * Create a new proposal
   */
  propose(type: string, value: unknown, proposerId: string): Proposal {
    const id = `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const proposal: Proposal = {
      id,
      type,
      value,
      proposerId,
      timestamp: new Date(),
      votes: [],
      status: 'pending'
    };

    this._proposals.set(id, proposal);
    return proposal;
  }

  /**
   * Vote on a proposal
   */
  vote(proposalId: string, voterId: string, inFavor: boolean): boolean {
    const proposal = this._proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') {
      return false;
    }

    // Check if already voted
    if (proposal.votes.some(v => v.voterId === voterId)) {
      return false;
    }

    const vote: Vote = {
      voterId,
      proposalId,
      inFavor,
      timestamp: new Date()
    };

    const updatedProposal = {
      ...proposal,
      votes: [...proposal.votes, vote]
    };

    // Check if quorum reached
    const favorVotes = updatedProposal.votes.filter(v => v.inFavor).length;
    const againstVotes = updatedProposal.votes.filter(v => !v.inFavor).length;

    if (favorVotes >= this._config.quorumSize) {
      updatedProposal.status = 'accepted';
    } else if (againstVotes >= this._config.quorumSize) {
      updatedProposal.status = 'rejected';
    }

    this._proposals.set(proposalId, updatedProposal);
    return true;
  }

  /**
   * Get proposal status
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this._proposals.get(proposalId);
  }

  /**
   * Get all pending proposals
   */
  getPendingProposals(): Proposal[] {
    return Array.from(this._proposals.values()).filter(p => p.status === 'pending');
  }

  // Raft-specific methods

  /**
   * Start leader election (Raft)
   */
  startElection(): void {
    if (this._config.protocol !== 'raft') {
      throw new Error('Election only supported for Raft protocol');
    }

    this._raftStatus = {
      ...this._raftStatus,
      state: 'candidate',
      term: this._raftStatus.term + 1,
      votedFor: this.id
    };
  }

  /**
   * Receive heartbeat from leader (Raft)
   */
  receiveHeartbeat(leaderId: string, term: number): void {
    if (term >= this._raftStatus.term) {
      this._raftStatus = {
        state: 'follower',
        term,
        leaderId,
        votedFor: null,
        lastHeartbeat: new Date()
      };
    }
  }

  /**
   * Become leader (Raft)
   */
  becomeLeader(): void {
    this._raftStatus = {
      ...this._raftStatus,
      state: 'leader',
      leaderId: this.id
    };
  }

  /**
   * Check if this node is leader
   */
  isLeader(): boolean {
    return this._raftStatus.state === 'leader';
  }

  // Gossip-specific methods

  /**
   * Update gossip state (for eventual consistency)
   */
  updateGossipState(key: string, value: unknown, version: number): boolean {
    const current = this._gossipState.get(key);

    // Only update if version is newer
    if (!current || version > current.version) {
      this._gossipState.set(key, { value, version });
      return true;
    }
    return false;
  }

  /**
   * Get gossip state
   */
  getGossipState(key: string): { value: unknown; version: number } | undefined {
    return this._gossipState.get(key);
  }

  /**
   * Get all gossip state for sync
   */
  getGossipSnapshot(): Map<string, { value: unknown; version: number }> {
    return new Map(this._gossipState);
  }

  /**
   * Merge gossip state from peer
   */
  mergeGossipState(peerState: Map<string, { value: unknown; version: number }>): number {
    let updates = 0;
    for (const [key, entry] of peerState) {
      if (this.updateGossipState(key, entry.value, entry.version)) {
        updates++;
      }
    }
    return updates;
  }

  /**
   * Expire old proposals
   */
  expireProposals(): number {
    const now = Date.now();
    let expired = 0;

    for (const [id, proposal] of this._proposals) {
      if (
        proposal.status === 'pending' &&
        now - proposal.timestamp.getTime() > this._config.timeoutMs
      ) {
        this._proposals.set(id, { ...proposal, status: 'expired' });
        expired++;
      }
    }

    return expired;
  }

  // Getters
  get config(): ConsensusConfig { return this._config; }
  get raftStatus(): RaftStatus { return this._raftStatus; }
  get peerCount(): number { return this._peers.size; }

  equals(other: ConsensusManager): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `ConsensusManager(${this.id}, ${this._config.protocol}, peers=${this._peers.size})`;
  }
}
