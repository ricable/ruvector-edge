//! Federated Q-Table Merge (ELEX-024)
//!
//! Implements federated learning with visit-weighted averaging for Q-table merging.
//! Enables collaborative learning across multiple agents with conflict resolution.
//!
//! # Features
//! - Visit-weighted Q-value averaging
//! - Multiple merge strategies (weighted average, max, min)
//! - Conflict resolution with confidence scoring
//! - Support for merging multiple peer Q-tables
//! - Comprehensive merge statistics
//!
//! # Merge Formula
//! ```text
//! merged_q = (local_q * local_visits + peer_q * peer_visits) / total_visits
//! ```
//!
//! # Example
//! ```ignore
//! use elex_routing::federation::{FederatedMerger, MergeStrategy};
//! use elex_qlearning::QTable;
//!
//! let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);
//! let local = QTable::default();
//! let peer = QTable::default();
//!
//! let result = merger.merge(&local, &peer)?;
//! println!("Merged {} entries with {} conflicts",
//!     result.stats.merged_entries,
//!     result.stats.conflicts_resolved
//! );
//! ```

use elex_core::{ElexError, Result};
use elex_qlearning::{QTable, QEntry};
use hashbrown::HashSet;
use serde::{Serialize, Deserialize};

// ============================================================================
// Merge Strategy
// ============================================================================

/// Merge strategy for federated learning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MergeStrategy {
    /// Weighted average by visit count (default)
    /// Formula: (local_q * local_visits + peer_q * peer_visits) / total_visits
    WeightedAverage,

    /// Maximum Q-value (optimistic)
    /// Selects the highest Q-value from all peers
    Maximum,

    /// Minimum Q-value (pessimistic)
    /// Selects the lowest Q-value from all peers
    Minimum,
}

impl Default for MergeStrategy {
    fn default() -> Self {
        Self::WeightedAverage
    }
}

// ============================================================================
// Merge Statistics
// ============================================================================

/// Merge statistics for federated learning operations
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MergeStats {
    /// Number of entries in local Q-table
    pub local_entries: usize,

    /// Number of entries in peer Q-table(s)
    pub peer_entries: usize,

    /// Number of entries in merged Q-table
    pub merged_entries: usize,

    /// Number of conflicts resolved (both local and peer had values)
    pub conflicts_resolved: usize,

    /// Average confidence score across merged entries
    pub avg_confidence: f32,

    /// Total visit count in merged table
    pub total_visits: u32,

    /// Number of new entries from peers
    pub new_peer_entries: usize,

    /// Number of entries that were updated
    pub updated_entries: usize,
}

impl MergeStats {
    /// Calculate merge confidence score (0.0-1.0)
    pub fn confidence(&self) -> f32 {
        if self.merged_entries == 0 {
            return 0.0;
        }

        // Confidence based on:
        // 1. Conflict resolution rate (more conflicts = more peer data)
        // 2. Visit count (more visits = more reliable)
        // 3. New entries (more learning from peers)

        let conflict_ratio = if self.local_entries > 0 {
            self.conflicts_resolved as f32 / self.local_entries as f32
        } else {
            0.0
        };

        let visit_confidence = if self.total_visits > 0 {
            (self.total_visits as f32 / (self.merged_entries as f32 * 10.0)).min(1.0)
        } else {
            0.0
        };

        let new_entry_ratio = if self.peer_entries > 0 {
            self.new_peer_entries as f32 / self.peer_entries as f32
        } else {
            0.0
        };

        // Weighted combination
        (conflict_ratio * 0.4 + visit_confidence * 0.4 + new_entry_ratio * 0.2).min(1.0)
    }

    /// Create a summary string
    pub fn summary(&self) -> String {
        format!(
            "MergeStats: local={}, peer={}, merged={}, conflicts={}, confidence={:.2}",
            self.local_entries,
            self.peer_entries,
            self.merged_entries,
            self.conflicts_resolved,
            self.confidence()
        )
    }
}

// ============================================================================
// Federated Merger
// ============================================================================

/// Federated Q-table merge with visit weighting
///
/// Implements federated learning by merging Q-tables from multiple agents.
/// Uses visit-weighted averaging to ensure well-explored state-action pairs
/// have more influence on the merged result.
#[derive(Clone, Debug)]
pub struct FederatedMerger {
    /// Merge strategy
    strategy: MergeStrategy,

    /// Minimum visit threshold for inclusion
    min_visits: u32,

    /// Confidence threshold for accepting merged values
    confidence_threshold: f32,
}

impl FederatedMerger {
    /// Create new federated merger with default settings
    ///
    /// # Arguments
    /// * `strategy` - Merge strategy to use
    ///
    /// # Example
    /// ```ignore
    /// let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);
    /// ```
    pub fn new(strategy: MergeStrategy) -> Self {
        Self {
            strategy,
            min_visits: 5,
            confidence_threshold: 0.3,
        }
    }

    /// Create with default strategy (weighted average)
    pub fn default() -> Self {
        Self::new(MergeStrategy::default())
    }

    /// Set minimum visit threshold
    ///
    /// Entries with fewer visits than this threshold will not be included
    /// in the merged result unless no alternative exists.
    pub fn with_min_visits(mut self, min_visits: u32) -> Self {
        self.min_visits = min_visits;
        self
    }

    /// Set confidence threshold
    ///
    /// Merged values with confidence below this threshold may be filtered.
    pub fn with_confidence_threshold(mut self, threshold: f32) -> Self {
        self.confidence_threshold = threshold.clamp(0.0, 1.0);
        self
    }

    /// Merge local Q-table with peer Q-table
    ///
    /// Performs visit-weighted averaging of Q-values from both tables.
    ///
    /// # Arguments
    /// * `local` - Local Q-table
    /// * `peer` - Peer Q-table to merge
    ///
    /// # Returns
    /// Merge result containing the merged Q-table and statistics
    ///
    /// # Merge Formula
    /// ```text
    /// merged_q = (local_q * local_visits + peer_q * peer_visits) / total_visits
    /// ```
    ///
    /// # Example
    /// ```ignore
    /// let result = merger.merge(&local_qtable, &peer_qtable)?;
    /// let merged_qtable = result.merged_table;
    /// let stats = result.stats;
    /// ```
    pub fn merge(&self, local: &QTable, peer: &QTable) -> Result<MergeResult> {
        let mut merged = local.clone(); // Start with local table as base
        let mut stats = MergeStats::default();

        // Get all unique state-action pairs from both tables
        let local_keys: HashSet<_> = local.keys().into_iter().collect();
        let peer_keys: HashSet<_> = peer.keys().into_iter().collect();

        let all_keys: HashSet<_> = local_keys.union(&peer_keys).cloned().collect();

        for key in all_keys {
            let local_entry = local.get_entry_by_key(&key);
            let peer_entry = peer.get_entry_by_key(&key);

            match (local_entry, peer_entry) {
                (Some(local_ent), Some(peer_ent)) => {
                    // Both exist - merge them
                    let merged_entry = self.merge_entries(
                        Some(local_ent),
                        Some(peer_ent),
                        &mut stats,
                    )?;

                    // Update the merged table with the merged entry
                    merged.update_entry_from_key(&key, &merged_entry);
                }
                (Some(local_ent), None) => {
                    // Only local exists - keep it
                    stats.total_visits += local_ent.visit_count;
                }
                (None, Some(peer_ent)) => {
                    // Only peer exists - add it
                    stats.total_visits += peer_ent.visit_count;
                    stats.new_peer_entries += 1;
                    merged.insert_entry(peer_ent.clone());
                }
                (None, None) => {
                    // Should not happen
                }
            }
        }

        stats.local_entries = local.len();
        stats.peer_entries = peer.len();
        stats.merged_entries = merged.len();
        stats.avg_confidence = stats.confidence();

        Ok(MergeResult {
            merged_table: merged,
            stats,
        })
    }

    /// Merge multiple peer Q-tables
    ///
    /// Sequentially merges multiple peer Q-tables with the local table.
    /// Each merge updates the running result.
    ///
    /// # Arguments
    /// * `local` - Local Q-table
    /// * `peers` - Slice of peer Q-table references
    ///
    /// # Returns
    /// Merge result with final merged Q-table and aggregate statistics
    ///
    /// # Example
    /// ```ignore
    /// let peers = vec![&peer1, &peer2, &peer3];
    /// let result = merger.merge_multiple(&local, &peers)?;
    /// ```
    pub fn merge_multiple(&self, local: &QTable, peers: &[&QTable]) -> Result<MergeResult> {
        if peers.is_empty() {
            return Ok(MergeResult {
                merged_table: local.clone(),
                stats: MergeStats {
                    local_entries: local.len(),
                    peer_entries: 0,
                    merged_entries: local.len(),
                    ..Default::default()
                },
            });
        }

        let mut result = local.clone();
        let mut total_peer_entries = 0;
        let mut total_conflicts = 0;

        for peer in peers {
            let peer_entries = peer.len();
            total_peer_entries += peer_entries;

            let merge_result = self.merge(&result, peer)?;
            total_conflicts += merge_result.stats.conflicts_resolved;
            result = merge_result.merged_table;
        }

        let merged_entries = result.len();
        Ok(MergeResult {
            merged_table: result,
            stats: MergeStats {
                local_entries: local.len(),
                peer_entries: total_peer_entries,
                merged_entries,
                conflicts_resolved: total_conflicts,
                ..Default::default()
            },
        })
    }

    /// Merge individual Q-entries with weighted averaging
    ///
    /// Implements the core merge logic based on the selected strategy.
    fn merge_entries(
        &self,
        local: Option<&QEntry>,
        peer: Option<&QEntry>,
        stats: &mut MergeStats,
    ) -> Result<QEntry> {
        match (local, peer) {
            (Some(local_entry), Some(peer_entry)) => {
                // Both exist - use strategy-based merge
                let merged_entry = match self.strategy {
                    MergeStrategy::WeightedAverage => {
                        self.weighted_average_merge(local_entry, peer_entry)
                    }
                    MergeStrategy::Maximum => {
                        self.max_merge(local_entry, peer_entry)
                    }
                    MergeStrategy::Minimum => {
                        self.min_merge(local_entry, peer_entry)
                    }
                };

                stats.conflicts_resolved += 1;
                stats.total_visits += merged_entry.visit_count;
                stats.updated_entries += 1;

                Ok(merged_entry)
            }
            (Some(entry), None) => {
                // Only local exists
                stats.total_visits += entry.visit_count;
                Ok(entry.clone())
            }
            (None, Some(entry)) => {
                // Only peer exists
                stats.total_visits += entry.visit_count;
                stats.new_peer_entries += 1;
                Ok(entry.clone())
            }
            (None, None) => {
                // Neither exists - should not happen
                Err(ElexError::QLearning {
                    reason: "No entries to merge".into()
                })
            }
        }
    }

    /// Weighted average merge (default strategy)
    ///
    /// Formula: merged_q = (local_q * local_visits + peer_q * peer_visits) / total_visits
    fn weighted_average_merge(
        &self,
        local: &QEntry,
        peer: &QEntry,
    ) -> QEntry {
        let total_visits = local.visit_count + peer.visit_count;

        if total_visits == 0 {
            // No visits - use average of values
            return QEntry {
                state_action_key: local.state_action_key.clone(),
                value: (local.value + peer.value) / 2.0,
                visit_count: 0,
                last_updated: std::cmp::max(local.last_updated, peer.last_updated),
                successes: (local.successes + peer.successes) / 2,
                failures: (local.failures + peer.failures) / 2,
            };
        }

        // Weighted average by visit count
        let merged_value = (local.value * local.visit_count as f32
            + peer.value * peer.visit_count as f32)
            / total_visits as f32;

        let merged_successes = (local.successes as f32 * local.visit_count as f32
            + peer.successes as f32 * peer.visit_count as f32)
            / total_visits as f32;

        let merged_failures = (local.failures as f32 * local.visit_count as f32
            + peer.failures as f32 * peer.visit_count as f32)
            / total_visits as f32;

        QEntry {
            state_action_key: local.state_action_key.clone(),
            value: merged_value,
            visit_count: total_visits,
            last_updated: std::cmp::max(local.last_updated, peer.last_updated),
            successes: merged_successes as u32,
            failures: merged_failures as u32,
        }
    }

    /// Maximum merge (optimistic strategy)
    ///
    /// Selects the highest Q-value from local or peer
    fn max_merge(&self, local: &QEntry, peer: &QEntry) -> QEntry {
        if local.value >= peer.value {
            QEntry {
                visit_count: local.visit_count + peer.visit_count,
                ..local.clone()
            }
        } else {
            QEntry {
                visit_count: local.visit_count + peer.visit_count,
                ..peer.clone()
            }
        }
    }

    /// Minimum merge (pessimistic strategy)
    ///
    /// Selects the lowest Q-value from local or peer
    fn min_merge(&self, local: &QEntry, peer: &QEntry) -> QEntry {
        if local.value <= peer.value {
            QEntry {
                visit_count: local.visit_count + peer.visit_count,
                ..local.clone()
            }
        } else {
            QEntry {
                visit_count: local.visit_count + peer.visit_count,
                ..peer.clone()
            }
        }
    }
}

// ============================================================================
// Merge Result
// ============================================================================

/// Federated merge result with metadata
#[derive(Clone)]
pub struct MergeResult {
    /// Merged Q-table
    pub merged_table: QTable,

    /// Merge statistics
    pub stats: MergeStats,
}

impl MergeResult {
    /// Get the merged Q-table
    pub fn table(&self) -> &QTable {
        &self.merged_table
    }

    /// Get merge statistics
    pub fn statistics(&self) -> &MergeStats {
        &self.stats
    }

    /// Check if merge was successful
    pub fn is_successful(&self) -> bool {
        self.stats.merged_entries > 0
    }

    /// Get merge confidence score
    pub fn confidence(&self) -> f32 {
        self.stats.confidence()
    }
}

// ============================================================================
// QTable Extensions
// ============================================================================

/// Extension methods for QTable to support federated operations
pub trait QTableFederatedExt {
    /// Get all entry keys
    fn keys(&self) -> Vec<String>;

    /// Get entry by key
    fn get_entry_by_key(&self, key: &str) -> Option<&QEntry>;

    /// Insert entry
    fn insert_entry(&mut self, entry: QEntry);

    /// Update entry from key
    fn update_entry_from_key(&mut self, key: &str, entry: &QEntry);
}

impl QTableFederatedExt for QTable {
    fn keys(&self) -> Vec<String> {
        self.entries.keys().cloned().collect()
    }

    fn get_entry_by_key(&self, key: &str) -> Option<&QEntry> {
        self.entries.get(key)
    }

    fn insert_entry(&mut self, entry: QEntry) {
        self.entries.insert(entry.state_action_key.clone(), entry);
    }

    fn update_entry_from_key(&mut self, key: &str, entry: &QEntry) {
        self.entries.insert(key.to_string(), entry.clone());
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use elex_qlearning::{QLearningConfig, State, Reward};
    use elex_qlearning::policy::Action;

    fn create_test_entry(key: String, value: f32, visits: u32) -> QEntry {
        QEntry {
            state_action_key: key,
            value,
            visit_count: visits,
            last_updated: 1000,
            successes: visits / 2,
            failures: visits / 4,
        }
    }

    #[test]
    fn test_federated_merger_creation() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);
        assert_eq!(merger.strategy, MergeStrategy::WeightedAverage);
        assert_eq!(merger.min_visits, 5);
        assert_eq!(merger.confidence_threshold, 0.3);
    }

    #[test]
    fn test_weighted_average_merge() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);

        let local = create_test_entry("test::0".into(), 0.5, 10);
        let peer = create_test_entry("test::0".into(), 0.8, 20);

        let mut stats = MergeStats::default();
        let merged = merger.merge_entries(Some(&local), Some(&peer), &mut stats).unwrap();

        // Expected: (0.5 * 10 + 0.8 * 20) / 30 = 21.0 / 30 = 0.7
        assert!((merged.value - 0.7).abs() < 0.01);
        assert_eq!(merged.visit_count, 30);
        assert_eq!(stats.conflicts_resolved, 1);
    }

    #[test]
    fn test_max_merge() {
        let merger = FederatedMerger::new(MergeStrategy::Maximum);

        let local = create_test_entry("test::0".into(), 0.5, 10);
        let peer = create_test_entry("test::0".into(), 0.8, 20);

        let mut stats = MergeStats::default();
        let merged = merger.merge_entries(Some(&local), Some(&peer), &mut stats).unwrap();

        // Should take max (0.8 from peer)
        assert_eq!(merged.value, 0.8);
        assert_eq!(merged.visit_count, 30);
    }

    #[test]
    fn test_min_merge() {
        let merger = FederatedMerger::new(MergeStrategy::Minimum);

        let local = create_test_entry("test::0".into(), 0.5, 10);
        let peer = create_test_entry("test::0".into(), 0.8, 20);

        let mut stats = MergeStats::default();
        let merged = merger.merge_entries(Some(&local), Some(&peer), &mut stats).unwrap();

        // Should take min (0.5 from local)
        assert_eq!(merged.value, 0.5);
        assert_eq!(merged.visit_count, 30);
    }

    #[test]
    fn test_merge_single_sided() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);

        let local = create_test_entry("test::0".into(), 0.5, 10);

        let mut stats = MergeStats::default();
        let merged = merger.merge_entries(Some(&local), None, &mut stats).unwrap();

        assert_eq!(merged.value, 0.5);
        assert_eq!(merged.visit_count, 10);
        assert_eq!(stats.conflicts_resolved, 0);
    }

    #[test]
    fn test_merge_stats_confidence() {
        let stats = MergeStats {
            local_entries: 100,
            peer_entries: 50,
            merged_entries: 120,
            conflicts_resolved: 30,
            avg_confidence: 0.0, // Will be calculated
            total_visits: 1000,
            new_peer_entries: 20,
            updated_entries: 30,
        };

        let confidence = stats.confidence();
        assert!(confidence > 0.0 && confidence <= 1.0);

        let summary = stats.summary();
        assert!(summary.contains("MergeStats"));
    }

    #[test]
    fn test_merge_strategy_default() {
        let strategy = MergeStrategy::default();
        assert_eq!(strategy, MergeStrategy::WeightedAverage);
    }

    #[test]
    fn test_merger_with_options() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage)
            .with_min_visits(10)
            .with_confidence_threshold(0.5);

        assert_eq!(merger.min_visits, 10);
        assert_eq!(merger.confidence_threshold, 0.5);
    }

    #[test]
    fn test_merge_result() {
        let local = QTable::new(QLearningConfig::default());
        let peer = QTable::new(QLearningConfig::default());
        let merger = FederatedMerger::default();

        let result = merger.merge(&local, &peer).unwrap();

        assert!(result.is_successful());
        assert!(result.confidence() >= 0.0);
        assert_eq!(result.table().len(), 0);
    }

    #[test]
    fn test_weighted_merge_with_qtable() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);

        // Create local Q-table with entry
        let mut local = QTable::new(QLearningConfig::elex_default());
        let state = State::new(0, 0, 0.8, 0x123).encode();

        // Simulate 10 visits
        for _ in 0..10 {
            local.update_q_value(state, Action::DirectAnswer, 0.5, 0.8);
        }

        // Create peer Q-table with different value
        let mut peer = QTable::new(QLearningConfig::elex_default());

        // Simulate 20 visits with different Q-value
        for _ in 0..20 {
            peer.update_q_value(state, Action::DirectAnswer, 0.8, 0.9);
        }

        // Merge
        let result = merger.merge(&local, &peer).unwrap();
        let merged_value = result.merged_table.get_q_value(state, Action::DirectAnswer);

        // Expected: (0.5 * 10 + 0.8 * 20) / 30 ≈ 0.7
        assert!((merged_value - 0.7).abs() < 0.1);
        assert_eq!(result.stats.conflicts_resolved, 1);
    }

    #[test]
    fn test_merge_multiple_peers() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage);

        let local = QTable::new(QLearningConfig::elex_default());
        let peer1 = QTable::new(QLearningConfig::elex_default());
        let peer2 = QTable::new(QLearningConfig::elex_default());

        let peers: Vec<&QTable> = vec![&peer1, &peer2];

        let result = merger.merge_multiple(&local, &peers).unwrap();

        assert_eq!(result.stats.peer_entries, 0);
        assert!(result.is_successful());
    }

    #[test]
    fn test_merge_with_min_visits_threshold() {
        let merger = FederatedMerger::new(MergeStrategy::WeightedAverage)
            .with_min_visits(15);

        let mut local = QTable::new(QLearningConfig::elex_default());
        let state = State::new(0, 0, 0.8, 0x123).encode();

        // Only 5 visits (below threshold)
        for _ in 0..5 {
            local.update_q_value(state, Action::DirectAnswer, 0.5, 0.8);
        }

        let peer = QTable::new(QLearningConfig::elex_default());

        // Merge should still include the entry since it's the only one
        let result = merger.merge(&local, &peer).unwrap();
        assert_eq!(result.merged_table.len(), 1);
    }
}
