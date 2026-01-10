//! ELEX Routing
//!
//! Agent routing and task distribution logic.
//! Implements Raft consensus for coordinator nodes.

pub mod federation;
pub mod gossip;
pub mod router;
pub mod raft;
pub mod raft_log;
pub mod raft_state;

// Re-export main types
pub use federation::{
    FederatedMerger, MergeStrategy, MergeStats, MergeResult, QTableFederatedExt,
};
pub use gossip::{GossipProtocol, GossipMessage, GossipEntry, GossipResponse, StateKey, QValue, GossipStats};
pub use router::{SemanticRouter, RouteResult};
pub use raft::{RaftNode, RaftConfig, RaftMessage, Role, RaftCluster};
pub use raft_log::{RaftLog, RaftLogEntry, RaftCommand, AgentMetadata, LogSnapshot};
pub use raft_state::{RaftStateMachine, ClusterConfig};
