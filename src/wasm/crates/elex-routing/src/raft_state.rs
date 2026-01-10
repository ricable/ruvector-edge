//! Raft State Machine
//!
//! Application state machine that applies committed Raft log entries.
//! Manages the routing index with strong consistency.

use elex_core::types::AgentId;
use elex_core::{ElexError, Result};
use crate::raft_log::{RaftCommand, RaftLogEntry, AgentMetadata};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Raft state machine
///
/// Applies committed log entries to maintain application state.
/// This is the replicated state machine that all Raft nodes agree on.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaftStateMachine {
    /// Routing index: agent_id -> embedding
    routing_index: HashMap<String, Vec<f32>>,

    /// Agent registry: agent_id -> metadata
    agent_registry: HashMap<String, AgentMetadata>,

    /// Current configuration
    config: ClusterConfig,

    /// Last applied index
    last_applied: u64,
}

/// Cluster configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterConfig {
    /// Cluster nodes
    pub nodes: Vec<String>,
}

impl Default for ClusterConfig {
    fn default() -> Self {
        Self {
            nodes: Vec::new(),
        }
    }
}

impl RaftStateMachine {
    /// Create new state machine
    pub fn new() -> Self {
        Self {
            routing_index: HashMap::new(),
            agent_registry: HashMap::new(),
            config: ClusterConfig::default(),
            last_applied: 0,
        }
    }

    /// Apply a committed log entry to state machine
    pub fn apply(&mut self, entry: &RaftLogEntry) -> Result<()> {
        match &entry.command {
            RaftCommand::UpdateRoutingIndex { agent_id, embedding } => {
                let id = hex_id(agent_id);
                self.routing_index.insert(id, embedding.clone());
                self.last_applied += 1;
                Ok(())
            }

            RaftCommand::RemoveAgent { agent_id } => {
                let id = hex_id(agent_id);
                self.routing_index.remove(&id);
                self.agent_registry.remove(&id);
                self.last_applied += 1;
                Ok(())
            }

            RaftCommand::RegisterAgent {
                agent_id,
                metadata,
            } => {
                let id = hex_id(agent_id);
                self.agent_registry.insert(id, metadata.clone());
                self.last_applied += 1;
                Ok(())
            }

            RaftCommand::UpdateConfiguration { peers } => {
                self.config.nodes = peers.iter().map(hex_id).collect();
                self.last_applied += 1;
                Ok(())
            }
        }
    }

    /// Get embedding for agent
    pub fn get_embedding(&self, agent_id: &AgentId) -> Option<&[f32]> {
        self.routing_index.get(&hex_id(agent_id)).map(|v| v.as_slice())
    }

    /// Get agent metadata
    pub fn get_metadata(&self, agent_id: &AgentId) -> Option<&AgentMetadata> {
        self.agent_registry.get(&hex_id(agent_id))
    }

    /// Get all registered agents
    pub fn get_agents(&self) -> Vec<String> {
        self.agent_registry.keys().cloned().collect()
    }

    /// Get routing index snapshot
    pub fn routing_index_snapshot(&self) -> HashMap<String, Vec<f32>> {
        self.routing_index.clone()
    }

    /// Get cluster configuration
    pub fn config(&self) -> &ClusterConfig {
        &self.config
    }

    /// Get last applied index
    pub fn last_applied(&self) -> u64 {
        self.last_applied
    }

    /// Check if agent is registered
    pub fn is_registered(&self, agent_id: &AgentId) -> bool {
        self.agent_registry.contains_key(&hex_id(agent_id))
    }

    /// Get number of agents in routing index
    pub fn agent_count(&self) -> usize {
        self.routing_index.len()
    }

    /// Find nearest agents by embedding similarity
    ///
    /// Returns top k agents with most similar embeddings.
    pub fn find_nearest(&self, query: &[f32], k: usize) -> Vec<(String, f32)> {
        let mut results = Vec::new();

        for (id, embedding) in &self.routing_index {
            let similarity = cosine_similarity(query, embedding);
            results.push((id.clone(), similarity));
        }

        // Sort by similarity (descending)
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Return top k
        results.into_iter().take(k).collect()
    }
}

impl Default for RaftStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert AgentId to hex string
fn hex_id(id: &AgentId) -> String {
    id.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Calculate cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a * norm_b)
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

    fn make_entry(command: RaftCommand) -> RaftLogEntry {
        RaftLogEntry { term: 1, command }
    }

    #[test]
    fn test_apply_routing_update() {
        let mut sm = RaftStateMachine::new();
        let id = make_agent_id(1);
        let embedding = vec![0.5; 128];

        let entry = make_entry(RaftCommand::UpdateRoutingIndex {
            agent_id: id,
            embedding: embedding.clone(),
        });

        sm.apply(&entry).unwrap();

        assert_eq!(sm.last_applied(), 1);
        assert_eq!(sm.agent_count(), 1);
        assert_eq!(sm.get_embedding(&id), Some(embedding.as_slice()));
    }

    #[test]
    fn test_apply_agent_registration() {
        let mut sm = RaftStateMachine::new();
        let id = make_agent_id(1);
        let metadata = AgentMetadata {
            feature_code: "FAJ 121 3094".to_string(),
            name: "MIMO Sleep".to_string(),
            capabilities: vec!["parameter".to_string()],
            confidence: 0.8,
        };

        let entry = make_entry(RaftCommand::RegisterAgent {
            agent_id: id,
            metadata: metadata.clone(),
        });

        sm.apply(&entry).unwrap();

        assert!(sm.is_registered(&id));
        let retrieved = sm.get_metadata(&id).unwrap();
        assert_eq!(retrieved.feature_code, metadata.feature_code);
        assert_eq!(retrieved.name, metadata.name);
    }

    #[test]
    fn test_apply_agent_removal() {
        let mut sm = RaftStateMachine::new();
        let id = make_agent_id(1);
        let embedding = vec![0.5; 128];
        let metadata = AgentMetadata::default();

        // Register agent
        sm.apply(&make_entry(RaftCommand::UpdateRoutingIndex {
            agent_id: id,
            embedding: embedding.clone(),
        }))
        .unwrap();
        sm.apply(&make_entry(RaftCommand::RegisterAgent {
            agent_id: id,
            metadata,
        }))
        .unwrap();

        assert!(sm.is_registered(&id));
        assert_eq!(sm.agent_count(), 1);

        // Remove agent
        sm.apply(&make_entry(RaftCommand::RemoveAgent { agent_id: id }))
            .unwrap();

        assert!(!sm.is_registered(&id));
        assert_eq!(sm.agent_count(), 0);
        assert!(sm.get_embedding(&id).is_none());
    }

    #[test]
    fn test_apply_config_update() {
        let mut sm = RaftStateMachine::new();
        let peer1 = make_agent_id(1);
        let peer2 = make_agent_id(2);

        let entry = make_entry(RaftCommand::UpdateConfiguration {
            peers: vec![peer1, peer2],
        });

        sm.apply(&entry).unwrap();

        assert_eq!(sm.config().nodes.len(), 2);
    }

    #[test]
    fn test_find_nearest() {
        let mut sm = RaftStateMachine::new();

        // Add agents with different embeddings
        let id1 = make_agent_id(1);
        let id2 = make_agent_id(2);
        let id3 = make_agent_id(3);

        let embedding1 = vec![1.0, 0.0, 0.0];
        let embedding2 = vec![0.0, 1.0, 0.0];
        let embedding3 = vec![0.9, 0.1, 0.0];

        sm.apply(&make_entry(RaftCommand::UpdateRoutingIndex {
            agent_id: id1,
            embedding: embedding1.clone(),
        }))
        .unwrap();
        sm.apply(&make_entry(RaftCommand::UpdateRoutingIndex {
            agent_id: id2,
            embedding: embedding2.clone(),
        }))
        .unwrap();
        sm.apply(&make_entry(RaftCommand::UpdateRoutingIndex {
            agent_id: id3,
            embedding: embedding3.clone(),
        }))
        .unwrap();

        // Query similar to embedding1
        let query = vec![1.0, 0.0, 0.0];
        let results = sm.find_nearest(&query, 2);

        assert_eq!(results.len(), 2);
        // id1 should be most similar (identical)
        assert_eq!(results[0].0, hex_id(&id1));
        // id3 should be second (similar to id1)
        assert_eq!(results[1].0, hex_id(&id3));
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let c = vec![0.0, 1.0, 0.0];
        let d = vec![0.0, 0.0, 0.0];

        // Identical vectors
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < f32::EPSILON);

        // Orthogonal vectors
        assert!((cosine_similarity(&a, &c) - 0.0).abs() < f32::EPSILON);

        // Zero vector
        assert_eq!(cosine_similarity(&a, &d), 0.0);
        assert_eq!(cosine_similarity(&d, &a), 0.0);
    }

    #[test]
    fn test_routing_index_snapshot() {
        let mut sm = RaftStateMachine::new();
        let id = make_agent_id(1);
        let embedding = vec![0.5; 128];

        sm.apply(&make_entry(RaftCommand::UpdateRoutingIndex {
            agent_id: id,
            embedding: embedding.clone(),
        }))
        .unwrap();

        let snapshot = sm.routing_index_snapshot();
        assert_eq!(snapshot.len(), 1);
        assert!(snapshot.contains_key(&hex_id(&id)));
    }

    #[test]
    fn test_get_agents() {
        let mut sm = RaftStateMachine::new();
        let id1 = make_agent_id(1);
        let id2 = make_agent_id(2);

        sm.apply(&make_entry(RaftCommand::RegisterAgent {
            agent_id: id1,
            metadata: AgentMetadata {
                name: "Agent1".to_string(),
                ..Default::default()
            },
        }))
        .unwrap();
        sm.apply(&make_entry(RaftCommand::RegisterAgent {
            agent_id: id2,
            metadata: AgentMetadata {
                name: "Agent2".to_string(),
                ..Default::default()
            },
        }))
        .unwrap();

        let agents = sm.get_agents();
        assert_eq!(agents.len(), 2);
    }
}
