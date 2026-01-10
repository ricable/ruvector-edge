//! Raft Consensus Implementation
//!
//! Implements Raft consensus algorithm for coordinator nodes.
//! Provides leader election, log replication, and strong consistency
//! for the routing index across 3-5 coordinator nodes.
//!
//! Based on the Raft paper: https://raft.github.io/

use elex_core::types::AgentId;
use elex_core::{ElexError, Result};
use crate::raft_log::{RaftLog, RaftLogEntry, RaftCommand};
use crate::raft_state::RaftStateMachine;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::Duration;

// ============================================================================
// Raft Node
// ============================================================================

/// Raft node state machine
///
/// Implements the Raft consensus algorithm for distributed coordinator nodes.
/// Manages leader election, log replication, and state machine application.
pub struct RaftNode {
    /// Unique node ID
    pub id: AgentId,

    /// Current role (follower, candidate, leader)
    pub role: Role,

    /// Current term
    pub current_term: u64,

    /// Who we voted for in current term
    voted_for: Option<AgentId>,

    /// Log entries
    pub log: RaftLog,

    /// Commit index
    commit_index: u64,

    /// Last applied index
    last_applied: u64,

    /// Cluster configuration
    pub config: RaftConfig,

    /// Leader state (only valid when leader)
    pub leader_state: Option<LeaderState>,

    /// Follower state (only valid when follower)
    follower_state: Option<FollowerState>,

    /// Candidate state (only valid when candidate)
    candidate_state: Option<CandidateState>,

    /// Applied state machine
    state_machine: RaftStateMachine,

    /// Statistics
    stats: RaftStats,

    /// Pending votes (candidate only)
    votes_received: HashSet<AgentId>,

    /// Last heartbeat time
    last_heartbeat: Option<std::time::Instant>,
}

/// Node role in Raft
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Follower,
    Candidate,
    Leader,
}

/// Raft configuration
#[derive(Debug, Clone)]
pub struct RaftConfig {
    /// Election timeout (randomized in [election_timeout, 2 * election_timeout])
    pub election_timeout: Duration,

    /// Heartbeat interval
    pub heartbeat_interval: Duration,

    /// Peer nodes
    pub peers: Vec<AgentId>,
}

impl Default for RaftConfig {
    fn default() -> Self {
        Self {
            election_timeout: Duration::from_millis(150),
            heartbeat_interval: Duration::from_millis(50),
            peers: vec![],
        }
    }
}

/// Leader-specific state
#[derive(Debug, Clone)]
pub struct LeaderState {
    /// For each peer, index of next log entry to send
    pub next_index: Vec<u64>,

    /// For each peer, index of highest log entry known to be replicated
    pub match_index: Vec<u64>,
}

/// Follower-specific state
#[derive(Debug, Clone)]
pub struct FollowerState {
    /// Leader ID
    pub leader_id: Option<AgentId>,
}

/// Candidate-specific state
#[derive(Debug, Clone)]
pub struct CandidateState {
    /// Election start time
    pub election_start: std::time::Instant,
}

/// Raft statistics
#[derive(Debug, Clone, Default)]
pub struct RaftStats {
    pub terms: u64,
    pub elections_won: u64,
    pub elections_lost: u64,
    pub log_entries: u64,
    pub commits: u64,
}

// ============================================================================
// Raft Messages
// ============================================================================

/// Raft message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RaftMessage {
    RequestVote(RequestVoteRequest),
    RequestVoteResponse(RequestVoteResponse),
    AppendEntries(AppendEntriesRequest),
    AppendEntriesResponse(AppendEntriesResponse),
    InstallSnapshot(InstallSnapshotRequest),
    InstallSnapshotResponse(InstallSnapshotResponse),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestVoteRequest {
    pub term: u64,
    pub candidate_id: AgentId,
    pub last_log_index: u64,
    pub last_log_term: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestVoteResponse {
    pub term: u64,
    pub vote_granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppendEntriesRequest {
    pub term: u64,
    pub leader_id: AgentId,
    pub prev_log_index: u64,
    pub prev_log_term: u64,
    pub entries: Vec<RaftLogEntry>,
    pub leader_commit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppendEntriesResponse {
    pub term: u64,
    pub success: bool,
    pub match_index: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallSnapshotRequest {
    pub term: u64,
    pub leader_id: AgentId,
    pub last_included_index: u64,
    pub last_included_term: u64,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallSnapshotResponse {
    pub term: u64,
}

// ============================================================================
// Raft Node Implementation
// ============================================================================

impl RaftNode {
    /// Create new Raft node
    pub fn new(id: AgentId, config: RaftConfig) -> Self {
        Self {
            id,
            role: Role::Follower,
            current_term: 0,
            voted_for: None,
            log: RaftLog::new(),
            commit_index: 0,
            last_applied: 0,
            config,
            leader_state: None,
            follower_state: Some(FollowerState { leader_id: None }),
            candidate_state: None,
            state_machine: RaftStateMachine::new(),
            stats: RaftStats::default(),
            votes_received: HashSet::new(),
            last_heartbeat: Some(std::time::Instant::now()),
        }
    }

    // ========================================================================
    // Role Transitions
    // ========================================================================

    /// Become follower
    fn become_follower(&mut self, term: u64) {
        self.role = Role::Follower;
        self.current_term = term;
        self.voted_for = None;
        self.leader_state = None;
        self.candidate_state = None;
        self.follower_state = Some(FollowerState { leader_id: None });
        self.votes_received.clear();
        self.last_heartbeat = Some(std::time::Instant::now());
    }

    /// Become candidate and start election
    pub fn start_election(&mut self) -> Result<Vec<AgentId>> {
        self.role = Role::Candidate;
        self.current_term += 1;
        self.voted_for = Some(self.id);
        self.stats.elections_won += 1; // Optimistic

        // Initialize candidate state
        self.candidate_state = Some(CandidateState {
            election_start: std::time::Instant::now(),
        });

        // Clear previous votes and add self
        self.votes_received.clear();
        self.votes_received.insert(self.id);

        self.leader_state = None;
        self.follower_state = None;

        Ok(self.config.peers.clone())
    }

    /// Become leader
    fn become_leader(&mut self) {
        self.role = Role::Leader;

        // Initialize leader state
        let last_log_index = self.log.last_index();
        let peer_count = self.config.peers.len();

        self.leader_state = Some(LeaderState {
            next_index: vec![last_log_index + 1; peer_count],
            match_index: vec![0; peer_count],
        });

        self.candidate_state = None;
        self.follower_state = None;

        // Leaders don't set last_heartbeat - they send heartbeats
        self.last_heartbeat = None;
    }

    // ========================================================================
    // RPC Handlers
    // ========================================================================

    /// Handle RequestVote RPC
    pub fn handle_request_vote(&mut self, req: RequestVoteRequest) -> RequestVoteResponse {
        // Update term if we're behind
        if req.term > self.current_term {
            self.become_follower(req.term);
        }

        // Grant vote if:
        // 1. We haven't voted yet OR already voted for this candidate
        // 2. Candidate's log is at least as up-to-date as ours
        let log_ok = self
            .log
            .is_at_least_as_up_to_date(req.last_log_index, req.last_log_term);

        let vote_granted = self
            .voted_for
            .map(|v| v == req.candidate_id)
            .unwrap_or(true)
            && log_ok;

        if vote_granted {
            self.voted_for = Some(req.candidate_id);
            self.last_heartbeat = Some(std::time::Instant::now());
        }

        RequestVoteResponse {
            term: self.current_term,
            vote_granted,
        }
    }

    /// Handle vote response
    pub fn handle_vote_response(
        &mut self,
        resp: RequestVoteResponse,
        from: AgentId,
    ) -> Result<Option<LeaderState>> {
        if resp.term > self.current_term {
            self.become_follower(resp.term);
            return Ok(None);
        }

        if self.role != Role::Candidate {
            return Ok(None);
        }

        if resp.vote_granted {
            self.votes_received.insert(from);

            // Check if we won the election
            // Majority = (self + peers) / 2 + 1
            let total_nodes = 1 + self.config.peers.len() as u64;
            let majority = (total_nodes / 2) + 1;

            if self.votes_received.len() as u64 >= majority {
                self.become_leader();
                return Ok(self.leader_state.clone());
            }
        } else {
            self.stats.elections_lost += 1;
        }

        Ok(None)
    }

    /// Handle AppendEntries (heartbeat or log replication)
    pub fn handle_append_entries(&mut self, req: AppendEntriesRequest) -> AppendEntriesResponse {
        // Update term if needed
        if req.term > self.current_term {
            self.become_follower(req.term);
        }

        // Update leader info
        if let Some(ref mut follower) = &mut self.follower_state {
            follower.leader_id = Some(req.leader_id);
        }
        self.last_heartbeat = Some(std::time::Instant::now());

        // If we're candidate or leader, step down
        if self.role == Role::Candidate || self.role == Role::Leader {
            self.become_follower(req.term);
            if let Some(ref mut follower) = &mut self.follower_state {
                follower.leader_id = Some(req.leader_id);
            }
        }

        // Check log consistency
        let log_ok = self.log.match_prefix(req.prev_log_index, req.prev_log_term);

        if !log_ok {
            return AppendEntriesResponse {
                term: self.current_term,
                success: false,
                match_index: None,
            };
        }

        // Append new entries
        if !req.entries.is_empty() {
            self.log.append_from(req.prev_log_index, req.entries);
        }

        // Update commit index
        if req.leader_commit > self.commit_index {
            self.commit_index = req.leader_commit.min(self.log.last_index());
            self.apply_committed_entries();
        }

        AppendEntriesResponse {
            term: self.current_term,
            success: true,
            match_index: Some(self.log.last_index()),
        }
    }

    /// Handle AppendEntries response (leader only)
    pub fn handle_append_entries_response(
        &mut self,
        resp: AppendEntriesResponse,
        from: AgentId,
    ) -> Result<bool> {
        if resp.term > self.current_term {
            self.become_follower(resp.term);
            return Ok(false);
        }

        if self.role != Role::Leader {
            return Ok(false);
        }

        let leader_state = self
            .leader_state
            .as_mut()
            .ok_or_else(|| ElexError::Consensus {
                reason: "Leader state not initialized".to_string(),
            })?;

        // Find peer index
        let peer_idx = self
            .config
            .peers
            .iter()
            .position(|p| p == &from)
            .ok_or_else(|| ElexError::Consensus {
                reason: "Unknown peer".to_string(),
            })?;

        if resp.success {
            // Successful append: update match_index and next_index
            if let Some(match_idx) = resp.match_index {
                leader_state.match_index[peer_idx] = match_idx;
                leader_state.next_index[peer_idx] = match_idx + 1;
            }

            // Try to commit new entries
            self.try_commit_entries();
        } else {
            // Failed: decrement next_index to retry
            if leader_state.next_index[peer_idx] > 1 {
                leader_state.next_index[peer_idx] -= 1;
            }
        }

        Ok(true)
    }

    // ========================================================================
    // Command Propagation
    // ========================================================================

    /// Propose new command (leader only)
    pub fn propose(&mut self, command: RaftCommand) -> Result<()> {
        if self.role != Role::Leader {
            return Err(ElexError::Consensus {
                reason: "Not the cluster leader".to_string(),
            });
        }

        let entry = RaftLogEntry {
            term: self.current_term,
            command,
        };

        self.log.append(entry);
        self.stats.log_entries += 1;

        Ok(())
    }

    /// Try to commit entries based on replication status
    fn try_commit_entries(&mut self) {
        let leader_state = match &self.leader_state {
            Some(state) => state,
            None => return,
        };

        // Find highest index replicated to majority
        let mut new_commit_index = self.commit_index;

        for index in (self.commit_index + 1)..=self.log.last_index() {
            let mut replicated_count = 1u64; // Leader

            for match_idx in &leader_state.match_index {
                if *match_idx >= index {
                    replicated_count += 1;
                }
            }

            // Majority check
            let total_nodes = 1 + self.config.peers.len() as u64;
            let majority = (total_nodes / 2) + 1;

            if replicated_count >= majority {
                // Check if entry's term is current term
                if let Some(entry) = self.log.get_entry(index) {
                    if entry.term == self.current_term {
                        new_commit_index = index;
                    }
                }
            }
        }

        if new_commit_index > self.commit_index {
            self.commit_index = new_commit_index;
            self.apply_committed_entries();
        }
    }

    /// Apply committed entries to state machine
    fn apply_committed_entries(&mut self) {
        while self.last_applied < self.commit_index {
            self.last_applied += 1;
            if let Some(entry) = self.log.get_entry(self.last_applied) {
                if let Err(e) = self.state_machine.apply(entry) {
                    eprintln!("Failed to apply entry {}: {:?}", self.last_applied, e);
                } else {
                    self.stats.commits += 1;
                }
            }
        }
    }

    // ========================================================================
    // Leader Operations
    // ========================================================================

    /// Build AppendEntries request for a peer
    pub fn build_append_entries(&self, peer_idx: usize) -> AppendEntriesRequest {
        let leader_state = self.leader_state.as_ref().unwrap();
        let next_index = leader_state.next_index[peer_idx];

        let prev_log_index = if next_index > 1 {
            next_index - 1
        } else {
            0
        };

        let prev_log_term = self.log.get_term(prev_log_index);
        let entries = self.log.entries_from(next_index);

        AppendEntriesRequest {
            term: self.current_term,
            leader_id: self.id,
            prev_log_index,
            prev_log_term,
            entries,
            leader_commit: self.commit_index,
        }
    }

    /// Check if election timeout has expired
    pub fn election_timeout_expired(&self) -> bool {
        if self.role == Role::Leader {
            return false;
        }

        let elapsed = self
            .last_heartbeat
            .map(|h| h.elapsed())
            .unwrap_or(self.config.election_timeout);

        elapsed >= self.config.election_timeout
    }

    // ========================================================================
    // Public Accessors
    // ========================================================================

    /// Check if node is leader
    pub fn is_leader(&self) -> bool {
        self.role == Role::Leader
    }

    /// Get current term
    pub fn current_term(&self) -> u64 {
        self.current_term
    }

    /// Get node role
    pub fn role(&self) -> Role {
        self.role
    }

    /// Get statistics
    pub fn stats(&self) -> &RaftStats {
        &self.stats
    }

    /// Get commit index
    pub fn commit_index(&self) -> u64 {
        self.commit_index
    }

    /// Get state machine reference
    pub fn state_machine(&self) -> &RaftStateMachine {
        &self.state_machine
    }

    /// Get mutable state machine reference
    pub fn state_machine_mut(&mut self) -> &mut RaftStateMachine {
        &mut self.state_machine
    }

    /// Get log reference
    pub fn log(&self) -> &RaftLog {
        &self.log
    }

    /// Get leader ID (if known)
    pub fn leader_id(&self) -> Option<AgentId> {
        self.follower_state
            .as_ref()
            .and_then(|f| f.leader_id)
            .or_else(|| {
                if self.is_leader() {
                    Some(self.id)
                } else {
                    None
                }
            })
    }

    /// Get configuration
    pub fn config(&self) -> &RaftConfig {
        &self.config
    }
}

// ============================================================================
// Raft Cluster Helper
// ============================================================================

/// Helper for managing a Raft cluster in tests
pub struct RaftCluster {
    /// Cluster nodes
    pub nodes: Vec<RaftNode>,
}

impl RaftCluster {
    /// Create new cluster with n nodes
    pub fn new(n: usize) -> Self {
        let mut nodes = Vec::with_capacity(n);

        // Create all nodes first
        for i in 0..n {
            let mut id = [0u8; 32];
            id[0] = i as u8;

            let config = RaftConfig {
                election_timeout: Duration::from_millis(100),
                heartbeat_interval: Duration::from_millis(50),
                peers: vec![],
            };

            nodes.push(RaftNode::new(id, config));
        }

        // Now set up peer lists
        for i in 0..n {
            let peers: Vec<_> = nodes
                .iter()
                .enumerate()
                .filter(|(j, _)| *j != i)
                .map(|(_, node)| node.id)
                .collect();
            nodes[i].config.peers = peers;
        }

        Self { nodes }
    }

    /// Start cluster (trigger first election)
    pub fn start(&mut self) {
        for node in &mut self.nodes {
            // Randomize election timeouts slightly to avoid split votes
            let jitter = (node.id[0] % 10) as u64;
            node.config.election_timeout =
                Duration::from_millis(100 + jitter * 10);
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_agent_id(byte: u8) -> AgentId {
        let mut id = [0u8; 32];
        id[0] = byte;
        id
    }

    fn make_config(peers: Vec<AgentId>) -> RaftConfig {
        RaftConfig {
            election_timeout: Duration::from_millis(100),
            heartbeat_interval: Duration::from_millis(50),
            peers,
        }
    }

    #[test]
    fn test_raft_node_creation() {
        let id = make_agent_id(0);
        let config = make_config(vec![make_agent_id(1), make_agent_id(2)]);
        let node = RaftNode::new(id, config);

        assert_eq!(node.role(), Role::Follower);
        assert_eq!(node.current_term(), 0);
        assert!(!node.is_leader());
        assert_eq!(node.commit_index(), 0);
    }

    #[test]
    fn test_leader_election() {
        let mut cluster = RaftCluster::new(3);
        cluster.start();

        // Start election on node 0
        let _peers = cluster.nodes[0].start_election().unwrap();

        // Node 1 grants vote
        let req = RequestVoteRequest {
            term: 1,
            candidate_id: cluster.nodes[0].id,
            last_log_index: 0,
            last_log_term: 0,
        };

        let node1_id = cluster.nodes[1].id;
        let resp = cluster.nodes[1].handle_request_vote(req.clone());
        assert!(resp.vote_granted);

        // Node 0 receives vote
        cluster
            .nodes[0]
            .handle_vote_response(resp, node1_id)
            .unwrap();

        // Node 2 grants vote
        let node2_id = cluster.nodes[2].id;
        let resp2 = cluster.nodes[2].handle_request_vote(req);
        assert!(resp2.vote_granted);

        // Node 0 receives second vote and becomes leader
        let leader_state = cluster
            .nodes[0]
            .handle_vote_response(resp2, node2_id)
            .unwrap();

        assert!(leader_state.is_some());
        assert!(cluster.nodes[0].is_leader());
    }

    #[test]
    fn test_append_entries_as_leader() {
        let mut cluster = RaftCluster::new(3);

        // Make node 0 leader
        cluster.nodes[0].current_term = 1;
        cluster.nodes[0].role = Role::Leader;
        cluster.nodes[0].leader_state = Some(LeaderState {
            next_index: vec![1, 1],
            match_index: vec![0, 0],
        });

        // Propose command
        let command = RaftCommand::UpdateRoutingIndex {
            agent_id: make_agent_id(10),
            embedding: vec![0.5; 128],
        };

        cluster.nodes[0].propose(command).unwrap();

        assert_eq!(cluster.nodes[0].log().last_index(), 1);

        // Build append entries for follower
        let append = cluster.nodes[0].build_append_entries(0);
        assert_eq!(append.entries.len(), 1);
    }

    #[test]
    fn test_follower_accepts_append_entries() {
        let mut leader = RaftNode::new(make_agent_id(0), make_config(vec![make_agent_id(1)]));
        let mut follower = RaftNode::new(make_agent_id(1), make_config(vec![make_agent_id(0)]));

        // Make leader
        leader.current_term = 1;
        leader.role = Role::Leader;
        leader.leader_state = Some(LeaderState {
            next_index: vec![1],
            match_index: vec![0],
        });

        // Propose and replicate
        let command = RaftCommand::UpdateRoutingIndex {
            agent_id: make_agent_id(10),
            embedding: vec![0.5; 128],
        };

        leader.propose(command).unwrap();

        let append = leader.build_append_entries(0);
        let resp = follower.handle_append_entries(append);

        assert!(resp.success);
        assert_eq!(follower.log().last_index(), 1);
    }

    #[test]
    fn test_log_replication_and_commit() {
        let mut leader = RaftNode::new(make_agent_id(0), make_config(vec![make_agent_id(1)]));
        let mut follower = RaftNode::new(make_agent_id(1), make_config(vec![make_agent_id(0)]));

        // Setup leader
        leader.current_term = 1;
        leader.role = Role::Leader;
        leader.leader_state = Some(LeaderState {
            next_index: vec![1],
            match_index: vec![0],
        });

        // Propose command
        let command = RaftCommand::UpdateRoutingIndex {
            agent_id: make_agent_id(10),
            embedding: vec![0.5; 128],
        };
        leader.propose(command).unwrap();

        // Replicate to follower
        let append = leader.build_append_entries(0);
        let resp = follower.handle_append_entries(append);
        assert!(resp.success);

        // Handle response on leader
        leader
            .handle_append_entries_response(resp, follower.id)
            .unwrap();

        // With 1 leader + 1 follower, majority is 2, so entry commits
        assert_eq!(leader.commit_index(), 1);
    }

    #[test]
    fn test_term_update_steps_down() {
        let mut node = RaftNode::new(make_agent_id(0), make_config(vec![]));

        // Make leader
        node.current_term = 2;
        node.role = Role::Leader;
        node.leader_state = Some(LeaderState {
            next_index: vec![],
            match_index: vec![],
        });

        // Receive higher term heartbeat
        let append = AppendEntriesRequest {
            term: 3,
            leader_id: make_agent_id(1),
            prev_log_index: 0,
            prev_log_term: 0,
            entries: vec![],
            leader_commit: 0,
        };

        node.handle_append_entries(append);

        assert_eq!(node.current_term(), 3);
        assert_eq!(node.role(), Role::Follower);
        assert!(!node.is_leader());
    }

    #[test]
    fn test_request_vote_granting() {
        let mut node = RaftNode::new(make_agent_id(0), make_config(vec![make_agent_id(1)]));

        let req = RequestVoteRequest {
            term: 1,
            candidate_id: make_agent_id(1),
            last_log_index: 0,
            last_log_term: 0,
        };

        let resp = node.handle_request_vote(req);

        assert!(resp.vote_granted);
        assert_eq!(node.voted_for, Some(make_agent_id(1)));
    }

    #[test]
    fn test_vote_granting_log_compatibility() {
        let mut node = RaftNode::new(make_agent_id(0), make_config(vec![]));

        // Add log entry at term 1
        let entry = RaftLogEntry {
            term: 1,
            command: RaftCommand::UpdateRoutingIndex {
                agent_id: make_agent_id(1),
                embedding: vec![],
            },
        };
        node.log.append(entry);

        // Candidate with less up-to-date log
        let req = RequestVoteRequest {
            term: 1,
            candidate_id: make_agent_id(1),
            last_log_index: 0,
            last_log_term: 0,
        };

        let resp = node.handle_request_vote(req);
        assert!(!resp.vote_granted);
    }

    #[test]
    fn test_ensure_single_leader() {
        let mut cluster = RaftCluster::new(5);
        cluster.start();

        // Count initial leaders
        let leaders = cluster.nodes.iter().filter(|n| n.is_leader()).count();
        assert_eq!(leaders, 0);

        // Node 0 starts election and wins
        cluster.nodes[0].start_election().unwrap();

        // Collect node IDs first
        let node_ids: Vec<_> = cluster.nodes.iter().map(|n| n.id).collect();

        // Simulate all other nodes granting vote
        for i in 1..5 {
            let req = RequestVoteRequest {
                term: 1,
                candidate_id: cluster.nodes[0].id,
                last_log_index: 0,
                last_log_term: 0,
            };

            let resp = cluster.nodes[i].handle_request_vote(req.clone());
            cluster
                .nodes[0]
                .handle_vote_response(resp, node_ids[i])
                .unwrap();
        }

        // Now node 0 should be leader
        assert!(cluster.nodes[0].is_leader());

        // Verify only one leader
        let leaders = cluster.nodes.iter().filter(|n| n.is_leader()).count();
        assert_eq!(leaders, 1);
    }
}
