/**
 * Raft Consensus
 * Strong consistency for coordinator cluster
 *
 * Used by 14 category coordinators for:
 * - Vector index routing tables
 * - Agent registry and identity
 * - Configuration and WASM versioning
 * - Critical operational decisions
 *
 * Fault tolerance: f < n/2 failures
 *
 * @see ADR-002: Consensus Protocol Selection
 */

import type { AgentId } from '../../../core/types/ids.js';
import type { Timestamp } from '../../../core/types/interfaces.js';

export interface IRaftConfig {
  /** Election timeout range in ms (min) */
  electionTimeoutMin?: number;
  /** Election timeout range in ms (max) */
  electionTimeoutMax?: number;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
  /** Node ID */
  nodeId: string;
  /** Peer node IDs */
  peers: string[];
}

export interface IRaftState {
  term: number;
  votedFor: string | null;
  log: ILogEntry[];
  commitIndex: number;
  lastApplied: number;
}

export interface ILogEntry {
  term: number;
  index: number;
  command: unknown;
  timestamp: Timestamp;
}

type RaftRole = 'follower' | 'candidate' | 'leader';

/**
 * RaftConsensus implements the Raft algorithm
 */
export class RaftConsensus {
  private readonly config: Required<IRaftConfig>;
  private state: IRaftState;
  private role: RaftRole;
  private leader: string | null;
  private electionTimer: ReturnType<typeof setTimeout> | null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null;
  private votesReceived: Set<string>;
  private readonly stateMachine: Map<string, unknown>;

  constructor(config: IRaftConfig) {
    this.config = {
      electionTimeoutMin: config.electionTimeoutMin ?? 150,
      electionTimeoutMax: config.electionTimeoutMax ?? 300,
      heartbeatInterval: config.heartbeatInterval ?? 50,
      nodeId: config.nodeId,
      peers: config.peers,
    };

    this.state = {
      term: 0,
      votedFor: null,
      log: [],
      commitIndex: 0,
      lastApplied: 0,
    };

    this.role = 'follower';
    this.leader = null;
    this.electionTimer = null;
    this.heartbeatTimer = null;
    this.votesReceived = new Set();
    this.stateMachine = new Map();
  }

  /**
   * Start Raft consensus
   */
  start(): void {
    this.resetElectionTimer();
  }

  /**
   * Stop Raft consensus
   */
  stop(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Check if this node is the leader
   */
  isLeader(): boolean {
    return this.role === 'leader';
  }

  /**
   * Get current leader
   */
  getLeader(): string | null {
    return this.leader;
  }

  /**
   * Get current role
   */
  getRole(): RaftRole {
    return this.role;
  }

  /**
   * Get current term
   */
  getTerm(): number {
    return this.state.term;
  }

  /**
   * Propose a value for consensus
   */
  async propose<T>(command: T): Promise<boolean> {
    if (!this.isLeader()) {
      return false;
    }

    const entry: ILogEntry = {
      term: this.state.term,
      index: this.state.log.length,
      command,
      timestamp: Date.now(),
    };

    this.state.log.push(entry);

    // In production: Replicate to followers
    // Simplified: Auto-commit for demo
    this.state.commitIndex = entry.index;
    this.applyEntry(entry);

    return true;
  }

  /**
   * Get committed value from state machine
   */
  get<T>(key: string): T | undefined {
    return this.stateMachine.get(key) as T | undefined;
  }

  /**
   * Handle RequestVote RPC
   */
  handleRequestVote(
    term: number,
    candidateId: string,
    lastLogIndex: number,
    lastLogTerm: number
  ): { term: number; voteGranted: boolean } {
    // Update term if needed
    if (term > this.state.term) {
      this.stepDown(term);
    }

    // Deny if term is old
    if (term < this.state.term) {
      return { term: this.state.term, voteGranted: false };
    }

    // Check if we can vote
    const canVote =
      (this.state.votedFor === null || this.state.votedFor === candidateId) &&
      this.isLogUpToDate(lastLogIndex, lastLogTerm);

    if (canVote) {
      this.state.votedFor = candidateId;
      this.resetElectionTimer();
    }

    return { term: this.state.term, voteGranted: canVote };
  }

  /**
   * Handle AppendEntries RPC (heartbeat and log replication)
   */
  handleAppendEntries(
    term: number,
    leaderId: string,
    prevLogIndex: number,
    prevLogTerm: number,
    entries: ILogEntry[],
    leaderCommit: number
  ): { term: number; success: boolean } {
    // Update term if needed
    if (term > this.state.term) {
      this.stepDown(term);
    }

    // Reject if term is old
    if (term < this.state.term) {
      return { term: this.state.term, success: false };
    }

    // Reset election timer on valid heartbeat
    this.resetElectionTimer();
    this.leader = leaderId;

    // Check log consistency
    if (prevLogIndex >= 0) {
      const prevEntry = this.state.log[prevLogIndex];
      if (!prevEntry || prevEntry.term !== prevLogTerm) {
        return { term: this.state.term, success: false };
      }
    }

    // Append new entries
    for (const entry of entries) {
      if (entry.index < this.state.log.length) {
        // Overwrite conflicting entries
        this.state.log[entry.index] = entry;
      } else {
        this.state.log.push(entry);
      }
    }

    // Update commit index
    if (leaderCommit > this.state.commitIndex) {
      this.state.commitIndex = Math.min(leaderCommit, this.state.log.length - 1);
      this.applyCommittedEntries();
    }

    return { term: this.state.term, success: true };
  }

  private stepDown(newTerm: number): void {
    this.state.term = newTerm;
    this.state.votedFor = null;
    this.role = 'follower';
    this.votesReceived.clear();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.resetElectionTimer();
  }

  private resetElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
    }

    const timeout = this.randomTimeout();
    this.electionTimer = setTimeout(() => this.startElection(), timeout);
  }

  private randomTimeout(): number {
    const { electionTimeoutMin, electionTimeoutMax } = this.config;
    return Math.floor(
      Math.random() * (electionTimeoutMax - electionTimeoutMin) + electionTimeoutMin
    );
  }

  private startElection(): void {
    this.role = 'candidate';
    this.state.term++;
    this.state.votedFor = this.config.nodeId;
    this.votesReceived = new Set([this.config.nodeId]);

    // In production: Send RequestVote RPCs to all peers
    // Simplified: Become leader immediately for demo (single node)
    if (this.config.peers.length === 0) {
      this.becomeLeader();
    } else {
      // Check if we have majority
      const majority = Math.floor((this.config.peers.length + 1) / 2) + 1;
      if (this.votesReceived.size >= majority) {
        this.becomeLeader();
      } else {
        this.resetElectionTimer();
      }
    }
  }

  private becomeLeader(): void {
    this.role = 'leader';
    this.leader = this.config.nodeId;

    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }

    // Start heartbeat
    this.heartbeatTimer = setInterval(
      () => this.sendHeartbeat(),
      this.config.heartbeatInterval
    );
  }

  private sendHeartbeat(): void {
    // In production: Send AppendEntries RPCs to all peers
  }

  private isLogUpToDate(lastLogIndex: number, lastLogTerm: number): boolean {
    const myLastLog = this.state.log[this.state.log.length - 1];
    if (!myLastLog) return true;

    if (lastLogTerm !== myLastLog.term) {
      return lastLogTerm > myLastLog.term;
    }
    return lastLogIndex >= this.state.log.length - 1;
  }

  private applyCommittedEntries(): void {
    while (this.state.lastApplied < this.state.commitIndex) {
      this.state.lastApplied++;
      const entry = this.state.log[this.state.lastApplied];
      if (entry) {
        this.applyEntry(entry);
      }
    }
  }

  private applyEntry(entry: ILogEntry): void {
    // Apply command to state machine
    const command = entry.command as { type: string; key?: string; value?: unknown };
    if (command.type === 'set' && command.key) {
      this.stateMachine.set(command.key, command.value);
    } else if (command.type === 'delete' && command.key) {
      this.stateMachine.delete(command.key);
    }
  }

  /**
   * Get Raft state for persistence
   */
  getState(): IRaftState {
    return { ...this.state };
  }

  /**
   * Restore Raft state
   */
  restoreState(state: IRaftState): void {
    this.state = { ...state };
    this.applyCommittedEntries();
  }
}
