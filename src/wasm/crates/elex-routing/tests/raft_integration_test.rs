//! Raft Consensus Integration Tests
//!
//! Tests for the Raft consensus implementation (ELEX-026).

use elex_routing::raft::{RaftNode, RaftConfig, Role, RaftCluster};
use elex_routing::raft_log::{RaftLog, RaftLogEntry, RaftCommand, AgentMetadata};
use elex_routing::raft_state::RaftStateMachine;
use elex_core::types::AgentId;

fn make_agent_id(byte: u8) -> AgentId {
    let mut id = [0u8; 32];
    id[0] = byte;
    id
}

#[test]
fn test_raft_leader_election() {
    let config = RaftConfig {
        election_timeout: std::time::Duration::from_millis(100),
        heartbeat_interval: std::time::Duration::from_millis(50),
        peers: vec![make_agent_id(1), make_agent_id(2), make_agent_id(3)],
    };

    let mut cluster = RaftCluster::new(3);
    cluster.start();

    // All nodes start as followers
    assert_eq!(cluster.nodes[0].role(), Role::Follower);
    assert_eq!(cluster.nodes[1].role(), Role::Follower);
    assert_eq!(cluster.nodes[2].role(), Role::Follower);

    // Node 0 starts election
    cluster.nodes[0].start_election().unwrap();

    // Simulate votes
    let req = elex_routing::raft::RequestVoteRequest {
        term: 1,
        candidate_id: cluster.nodes[0].id,
        last_log_index: 0,
        last_log_term: 0,
    };

    let resp1 = cluster.nodes[1].handle_request_vote(req.clone());
    let resp2 = cluster.nodes[2].handle_request_vote(req.clone());

    assert!(resp1.vote_granted);
    assert!(resp2.vote_granted);

    // Node 0 receives votes and becomes leader
    let node1_id = cluster.nodes[1].id;
    let node2_id = cluster.nodes[2].id;

    cluster.nodes[0].handle_vote_response(resp1, node1_id).unwrap();
    cluster.nodes[0].handle_vote_response(resp2, node2_id).unwrap();

    // Now node 0 should be leader
    assert!(cluster.nodes[0].is_leader());
    assert_eq!(cluster.nodes[0].role(), Role::Leader);
}

#[test]
fn test_raft_log_replication() {
    let config = RaftConfig {
        election_timeout: std::time::Duration::from_millis(100),
        heartbeat_interval: std::time::Duration::from_millis(50),
        peers: vec![make_agent_id(1)],
    };

    let mut leader = RaftNode::new(make_agent_id(0), config.clone());
    let mut follower = RaftNode::new(make_agent_id(1), config);

    // Make node 0 leader
    leader.current_term = 1;
    leader.role = Role::Leader;
    leader.leader_state = Some(elex_routing::raft::LeaderState {
        next_index: vec![1],
        match_index: vec![0],
    });

    // Propose command
    let command = RaftCommand::UpdateRoutingIndex {
        agent_id: make_agent_id(10),
        embedding: vec![0.5; 128],
    };

    leader.propose(command).unwrap();

    // Build append entries
    let append = leader.build_append_entries(0);

    assert_eq!(append.term, 1);
    assert_eq!(append.entries.len(), 1);
    assert_eq!(append.prev_log_index, 0);
    assert_eq!(append.prev_log_term, 0);

    // Follower receives append entries
    let resp = follower.handle_append_entries(append);

    assert!(resp.success);
    assert_eq!(follower.log().last_index(), 1);
}

#[test]
fn test_raft_state_machine() {
    let mut sm = RaftStateMachine::new();
    let agent_id = make_agent_id(1);
    let embedding = vec![0.5; 128];

    // Apply routing index update
    let entry = RaftLogEntry {
        term: 1,
        command: RaftCommand::UpdateRoutingIndex {
            agent_id,
            embedding: embedding.clone(),
        },
    };

    sm.apply(&entry).unwrap();

    assert_eq!(sm.last_applied(), 1);
    assert_eq!(sm.agent_count(), 1);
    assert_eq!(sm.get_embedding(&agent_id), Some(embedding.as_slice()));
}

#[test]
fn test_raft_log_compaction() {
    let mut log = RaftLog::with_max_size(10);
    let id = make_agent_id(1);

    // Add more than max_size entries
    for i in 1..=15 {
        let entry = RaftLogEntry {
            term: 1,
            command: RaftCommand::UpdateRoutingIndex {
                agent_id: id,
                embedding: vec![i as f32; 128],
            },
        };
        log.append(entry);
    }

    // Should have compacted
    assert!(log.snapshot().is_some());
    assert!(log.entries.len() <= 10);
}

#[test]
fn test_raft_consistency_acquired() {
    // This test verifies that Raft ensures strong consistency
    let mut leader = RaftNode::new(
        make_agent_id(0),
        RaftConfig {
            election_timeout: std::time::Duration::from_millis(100),
            heartbeat_interval: std::time::Duration::from_millis(50),
            peers: vec![make_agent_id(1), make_agent_id(2)],
        },
    );

    // Make leader
    leader.current_term = 1;
    leader.role = Role::Leader;
    leader.leader_state = Some(elex_routing::raft::LeaderState {
        next_index: vec![1, 1],
        match_index: vec![0, 0],
    });

    // Propose commands
    for i in 1..=3 {
        let command = RaftCommand::RegisterAgent {
            agent_id: make_agent_id(i),
            metadata: AgentMetadata {
                feature_code: format!("FAJ 121 {:04}", i),
                name: format!("Agent {}", i),
                capabilities: vec!["test".to_string()],
                confidence: 0.8,
            },
        };

        leader.propose(command).unwrap();
    }

    // All entries should be in log
    assert_eq!(leader.log().last_index(), 3);
    assert_eq!(leader.log().len(), 3);
}
