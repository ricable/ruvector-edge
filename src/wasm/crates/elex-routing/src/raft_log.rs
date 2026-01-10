//! Raft Log Storage
//!
//! Persistent log storage for Raft consensus.
//! Implements log entry storage, replication, and compaction.

use elex_core::types::AgentId;
use elex_core::{ElexError, Result};
use serde::{Deserialize, Serialize};

/// Raft log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaftLogEntry {
    /// Term when entry was received by leader
    pub term: u64,
    /// Command to apply to state machine
    pub command: RaftCommand,
}

/// Raft command for routing index operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RaftCommand {
    /// Update agent embedding in routing index
    UpdateRoutingIndex {
        agent_id: AgentId,
        embedding: Vec<f32>,
    },

    /// Remove agent from routing index
    RemoveAgent {
        agent_id: AgentId,
    },

    /// Register new agent
    RegisterAgent {
        agent_id: AgentId,
        metadata: AgentMetadata,
    },

    /// Update cluster configuration
    UpdateConfiguration {
        peers: Vec<AgentId>,
    },
}

/// Agent metadata for registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetadata {
    /// Agent feature code
    pub feature_code: String,
    /// Agent name
    pub name: String,
    /// Agent capabilities
    pub capabilities: Vec<String>,
    /// Initial confidence score
    pub confidence: f32,
}

impl Default for AgentMetadata {
    fn default() -> Self {
        Self {
            feature_code: String::new(),
            name: String::new(),
            capabilities: Vec::new(),
            confidence: 0.5,
        }
    }
}

/// Raft log storage
///
/// Stores log entries with indices starting from 1.
/// Index 0 is a sentinel with term 0.
pub struct RaftLog {
    /// Log entries
    pub entries: Vec<RaftLogEntry>,
    /// Snapshot of state machine at some index
    snapshot: Option<LogSnapshot>,
    /// Maximum log size before compaction
    max_log_size: usize,
}

/// Log snapshot for compaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogSnapshot {
    /// Last included index
    pub last_included_index: u64,
    /// Last included term
    pub last_included_term: u64,
    /// State machine snapshot data
    pub data: Vec<u8>,
}

impl RaftLog {
    /// Create new empty log
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            snapshot: None,
            max_log_size: 1000,
        }
    }

    /// Create log with custom max size
    pub fn with_max_size(max_size: usize) -> Self {
        Self {
            entries: Vec::new(),
            snapshot: None,
            max_log_size: max_size,
        }
    }

    /// Get last log index
    ///
    /// Returns 0 if log is empty.
    pub fn last_index(&self) -> u64 {
        if let Some(snapshot) = &self.snapshot {
            snapshot.last_included_index + self.entries.len() as u64
        } else {
            self.entries.len() as u64
        }
    }

    /// Get term at index
    ///
    /// Returns 0 for index 0 or if index not found.
    pub fn get_term(&self, index: u64) -> u64 {
        if index == 0 {
            return 0;
        }

        // Check snapshot first
        if let Some(snapshot) = &self.snapshot {
            if index == snapshot.last_included_index {
                return snapshot.last_included_term;
            }
            if index < snapshot.last_included_index {
                return snapshot.last_included_term;
            }

            // Adjust index for snapshot
            let adjusted_index = (index - snapshot.last_included_index - 1) as usize;
            return self
                .entries
                .get(adjusted_index)
                .map(|e| e.term)
                .unwrap_or(0);
        }

        self.entries
            .get(index as usize - 1)
            .map(|e| e.term)
            .unwrap_or(0)
    }

    /// Get entry at index
    pub fn get_entry(&self, index: u64) -> Option<&RaftLogEntry> {
        if index == 0 {
            return None;
        }

        if let Some(snapshot) = &self.snapshot {
            if index <= snapshot.last_included_index {
                return None; // In snapshot
            }
            let adjusted_index = (index - snapshot.last_included_index - 1) as usize;
            self.entries.get(adjusted_index)
        } else {
            self.entries.get(index as usize - 1)
        }
    }

    /// Check if log matches prefix
    ///
    /// Returns true if the log at prev_log_index has term prev_log_term.
    pub fn match_prefix(&self, prev_log_index: u64, prev_log_term: u64) -> bool {
        self.get_term(prev_log_index) == prev_log_term
    }

    /// Check if candidate log is at least as up-to-date as ours
    ///
    /// Raft paper: "more up-to-date" if:
    /// 1. Last term is higher, OR
    /// 2. Last term equal and last index is greater/equal
    pub fn is_at_least_as_up_to_date(&self, last_index: u64, last_term: u64) -> bool {
        let our_last_index = self.last_index();
        let our_last_term = self.get_term(our_last_index);

        last_term > our_last_term || (last_term == our_last_term && last_index >= our_last_index)
    }

    /// Append entry to log
    pub fn append(&mut self, entry: RaftLogEntry) {
        self.entries.push(entry);

        // Check if compaction needed
        if self.entries.len() > self.max_log_size {
            self.compact();
        }
    }

    /// Append multiple entries starting from index
    ///
    /// If existing entries conflict, truncate and append.
    pub fn append_from(&mut self, prev_index: u64, entries: Vec<RaftLogEntry>) {
        if entries.is_empty() {
            return;
        }

        // Calculate base index
        let base_index = if let Some(snapshot) = &self.snapshot {
            snapshot.last_included_index + 1
        } else {
            0
        };

        // Find where to start appending
        let start_offset = if prev_index >= base_index {
            (prev_index - base_index) as usize
        } else {
            0
        };

        // Check for conflicts and truncate if needed
        for (i, entry) in entries.iter().enumerate() {
            let local_idx = start_offset + i + 1;
            if let Some(existing) = self.entries.get(local_idx - 1) {
                if existing.term != entry.term {
                    // Conflict: truncate from here
                    self.entries.truncate(local_idx - 1);
                    break;
                }
            }
        }

        // Append new entries
        for entry in entries {
            self.entries.push(entry);
        }
    }

    /// Truncate log from index (exclusive)
    pub fn truncate(&mut self, index: u64) {
        if let Some(snapshot) = &self.snapshot {
            if index <= snapshot.last_included_index {
                // Cannot truncate into snapshot
                return;
            }
            let adjusted_index = (index - snapshot.last_included_index - 1) as usize;
            self.entries.truncate(adjusted_index);
        } else {
            if index > 0 {
                self.entries.truncate(index as usize - 1);
            }
        }
    }

    /// Get entries from index to end
    pub fn entries_from(&self, index: u64) -> Vec<RaftLogEntry> {
        if index == 0 {
            return Vec::new();
        }

        if let Some(snapshot) = &self.snapshot {
            if index <= snapshot.last_included_index {
                return Vec::new(); // In snapshot
            }
            let adjusted_index = (index - snapshot.last_included_index - 1) as usize;
            self.entries.get(adjusted_index..).unwrap_or(&[]).to_vec()
        } else {
            if index > self.entries.len() as u64 {
                return Vec::new();
            }
            self.entries.get(index as usize - 1..).unwrap_or(&[]).to_vec()
        }
    }

    /// Compact log by creating snapshot
    ///
    /// Keeps last half of entries and creates snapshot of rest.
    pub fn compact(&mut self) {
        if self.entries.len() <= self.max_log_size / 2 {
            return;
        }

        let keep_count = self.max_log_size / 2;
        let split_point = self.entries.len() - keep_count;

        let last_included = self.entries.get(split_point - 1).unwrap();

        let snapshot = LogSnapshot {
            last_included_index: if let Some(snap) = &self.snapshot {
                snap.last_included_index + split_point as u64
            } else {
                split_point as u64
            },
            last_included_term: last_included.term,
            data: Vec::new(), // TODO: Serialize actual state
        };

        self.entries.drain(0..split_point);
        self.snapshot = Some(snapshot);
    }

    /// Get current snapshot if exists
    pub fn snapshot(&self) -> Option<&LogSnapshot> {
        self.snapshot.as_ref()
    }

    /// Get log length
    pub fn len(&self) -> u64 {
        self.last_index()
    }

    /// Check if log is empty
    pub fn is_empty(&self) -> bool {
        self.last_index() == 0
    }

    /// Restore from snapshot
    pub fn restore_snapshot(&mut self, snapshot: LogSnapshot) {
        self.snapshot = Some(snapshot);
        self.entries.clear();
    }
}

impl Default for RaftLog {
    fn default() -> Self {
        Self::new()
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

    fn make_entry(term: u64, agent_id: AgentId) -> RaftLogEntry {
        RaftLogEntry {
            term,
            command: RaftCommand::UpdateRoutingIndex {
                agent_id,
                embedding: vec![0.5; 128],
            },
        }
    }

    #[test]
    fn test_empty_log() {
        let log = RaftLog::new();
        assert_eq!(log.last_index(), 0);
        assert_eq!(log.get_term(0), 0);
        assert_eq!(log.get_term(1), 0);
        assert!(log.is_empty());
    }

    #[test]
    fn test_append_entries() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        log.append(make_entry(1, id));
        assert_eq!(log.last_index(), 1);
        assert_eq!(log.get_term(1), 1);

        log.append(make_entry(1, id));
        assert_eq!(log.last_index(), 2);
        assert_eq!(log.get_term(2), 1);
    }

    #[test]
    fn test_log_prefix_match() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        log.append(make_entry(1, id));
        log.append(make_entry(1, id));
        log.append(make_entry(2, id));

        assert!(log.match_prefix(2, 1));
        assert!(log.match_prefix(3, 2));
        assert!(!log.match_prefix(2, 2));
        assert!(!log.match_prefix(3, 1));
    }

    #[test]
    fn test_up_to_date_comparison() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        log.append(make_entry(1, id));
        log.append(make_entry(2, id));

        // Same term, higher index
        assert!(log.is_at_least_as_up_to_date(3, 2));

        // Higher term
        assert!(log.is_at_least_as_up_to_date(1, 3));

        // Same term, lower index
        assert!(!log.is_at_least_as_up_to_date(1, 2));

        // Lower term
        assert!(!log.is_at_least_as_up_to_date(2, 1));
    }

    #[test]
    fn test_truncate() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        for i in 1..=5 {
            log.append(make_entry(i, id));
        }

        log.truncate(3);
        assert_eq!(log.last_index(), 2);
        assert_eq!(log.get_term(2), 2);
    }

    #[test]
    fn test_append_from_no_conflict() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        log.append(make_entry(1, id));
        log.append(make_entry(1, id));

        let new_entries = vec![make_entry(1, id), make_entry(2, id)];
        log.append_from(2, new_entries);

        assert_eq!(log.last_index(), 4);
        assert_eq!(log.get_term(3), 1);
        assert_eq!(log.get_term(4), 2);
    }

    #[test]
    fn test_append_from_with_conflict() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        log.append(make_entry(1, id));
        log.append(make_entry(1, id));
        log.append(make_entry(2, id));

        // Conflict at index 3
        let new_entries = vec![make_entry(3, id), make_entry(3, id)];
        log.append_from(2, new_entries);

        assert_eq!(log.last_index(), 4);
        assert_eq!(log.get_term(3), 3);
        assert_eq!(log.get_term(4), 3);
    }

    #[test]
    fn test_compaction() {
        let mut log = RaftLog::with_max_size(10);
        let id = make_agent_id(1);

        for i in 1..=15 {
            log.append(make_entry(i, id));
        }

        // Should have compacted
        assert!(log.snapshot().is_some());
        assert!(log.entries.len() <= 10);
    }

    #[test]
    fn test_entries_from() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        for i in 1..=5 {
            log.append(make_entry(i, id));
        }

        let entries = log.entries_from(3);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].term, 3);
        assert_eq!(entries[2].term, 5);
    }

    #[test]
    fn test_get_entry() {
        let mut log = RaftLog::new();
        let id = make_agent_id(1);

        log.append(make_entry(1, id));
        log.append(make_entry(2, id));

        let entry = log.get_entry(2);
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().term, 2);

        assert!(log.get_entry(0).is_none());
        assert!(log.get_entry(10).is_none());
    }
}
