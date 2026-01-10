//! Knowledge Context - Feature Agent Aggregate
//!
//! Implements the FeatureAgent aggregate root which combines:
//! - Feature knowledge
//! - Q-learning intelligence
//! - Agent lifecycle management

use serde::{Deserialize, Serialize};
use crate::types::{AgentId, FeatureCode, Confidence, Timestamp};
use crate::feature::Feature;
use super::error::Result;

// ============================================================================
// Agent Status Enum
// ============================================================================

/// Agent lifecycle status
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum AgentStatus {
    /// Agent is being initialized
    Initializing,
    /// Cold start phase (<100 interactions)
    ColdStart,
    /// Ready to handle queries
    Ready,
    /// Currently processing a query
    Busy,
    /// Agent has been shut down
    Offline,
}

// ============================================================================
// Feature Agent Aggregate Root
// ============================================================================

/// Feature Agent - Aggregate Root of Knowledge and Intelligence contexts
///
/// Combines feature knowledge with learning capabilities to create
/// a specialized agent for one Ericsson RAN feature.
#[derive(Clone, Serialize, Deserialize)]
pub struct FeatureAgent {
    // ==================== Identity ====================
    /// Unique agent identifier
    pub id: AgentId,
    /// Feature code this agent specializes in
    pub feature_code: FeatureCode,
    /// Agent name (usually feature name)
    pub name: String,

    // ==================== Lifecycle ====================
    /// Current status
    pub status: AgentStatus,
    /// When agent was initialized
    pub initialized_at: Timestamp,
    /// When last query was processed
    pub last_query_at: Timestamp,
    /// When agent was shut down (if applicable)
    pub shutdown_at: Option<Timestamp>,

    // ==================== Feature Knowledge ====================
    /// Feature metadata and parameters
    pub feature: Feature,

    // ==================== Learning State ====================
    /// Total interactions processed
    pub interaction_count: u32,
    /// Confidence in responses (0.0-1.0)
    pub confidence: Confidence,
    /// Agent health score (0.0-1.0)
    pub health: f32,
    /// Success rate of responses (0.0-1.0)
    pub success_rate: f32,
    /// Number of Q-table entries
    pub q_table_entries: u32,
    /// Average reward received
    pub avg_reward: f32,
    /// Interactions before transitioning from ColdStart to Ready
    pub cold_start_threshold: u32,

    // ==================== Performance Metrics ====================
    /// Average response latency (ms)
    pub avg_latency_ms: f32,
    /// Peak response latency (ms)
    pub peak_latency_ms: f32,
    /// Parameter validation accuracy
    pub validation_accuracy: f32,
}

impl FeatureAgent {
    /// Create a new feature agent
    pub fn new(id: AgentId, feature_code: FeatureCode, feature: Feature) -> Self {
        Self {
            id,
            feature_code: feature_code.clone(),
            name: feature.name.clone(),
            status: AgentStatus::Initializing,
            initialized_at: 0,
            last_query_at: 0,
            shutdown_at: None,
            feature,
            interaction_count: 0,
            confidence: 0.5,
            health: 1.0,
            success_rate: 0.0,
            q_table_entries: 0,
            avg_reward: 0.0,
            cold_start_threshold: 100,
            avg_latency_ms: 0.0,
            peak_latency_ms: 0.0,
            validation_accuracy: 0.0,
        }
    }

    // ==================== Lifecycle Methods ====================

    /// Initialize the agent
    pub fn initialize(&mut self) -> Result<()> {
        self.status = AgentStatus::ColdStart;
        self.initialized_at = current_timestamp();
        Ok(())
    }

    /// Check if agent is ready
    pub fn is_ready(&self) -> bool {
        matches!(self.status, AgentStatus::Ready)
    }

    /// Check if still in cold start
    pub fn is_cold_start(&self) -> bool {
        self.interaction_count < self.cold_start_threshold
    }

    /// Shutdown the agent
    pub fn shutdown(&mut self) -> Result<()> {
        self.status = AgentStatus::Offline;
        self.shutdown_at = Some(current_timestamp());
        Ok(())
    }

    // ==================== Query Processing ====================

    /// Record a query execution
    pub fn record_query(&mut self, latency_ms: f32, reward: f32) {
        self.interaction_count += 1;
        self.last_query_at = current_timestamp();

        // Update latency
        let prev_sum = self.avg_latency_ms * (self.interaction_count as f32 - 1.0);
        self.avg_latency_ms = (prev_sum + latency_ms) / self.interaction_count as f32;

        if latency_ms > self.peak_latency_ms {
            self.peak_latency_ms = latency_ms;
        }

        // Update reward
        let prev_reward_sum = self.avg_reward * (self.interaction_count as f32 - 1.0);
        self.avg_reward = (prev_reward_sum + reward) / self.interaction_count as f32;

        // Update confidence
        self.update_confidence(reward);

        // Check cold start transition
        self.check_cold_start_transition();
    }

    /// Update confidence based on reward
    pub fn update_confidence(&mut self, reward: f32) {
        let delta = reward * 0.05;
        self.confidence = (self.confidence + delta).max(0.0).min(1.0);
    }

    /// Transition from ColdStart to Ready
    fn check_cold_start_transition(&mut self) {
        if matches!(self.status, AgentStatus::ColdStart)
            && self.interaction_count >= self.cold_start_threshold
        {
            self.status = AgentStatus::Ready;
            self.confidence = 0.7;
        }
    }

    // ==================== Feature Access ====================

    /// Get parameter count
    pub fn parameter_count(&self) -> u32 {
        self.feature.parameters.len() as u32
    }

    /// Get counter count
    pub fn counter_count(&self) -> u32 {
        self.feature.counters.len() as u32
    }

    /// Get KPI count
    pub fn kpi_count(&self) -> u32 {
        self.feature.kpis.len() as u32
    }

    /// Estimate memory usage
    pub fn estimate_memory_bytes(&self) -> u32 {
        let base = 2048u32; // Agent overhead
        let feature_size = self.feature.estimate_memory_bytes() as u32;
        let q_table_size = (self.q_table_entries * 64) as u32; // Approximate
        base + feature_size + q_table_size
    }

    /// Get comprehensive statistics
    pub fn get_stats(&self) -> AgentStats {
        AgentStats {
            id: hex_id(&self.id),
            feature_code: self.feature_code.to_string(),
            status: format!("{:?}", self.status),
            interactions: self.interaction_count,
            confidence: self.confidence,
            health: self.health,
            parameter_count: self.parameter_count(),
            counter_count: self.counter_count(),
            kpi_count: self.kpi_count(),
            avg_latency_ms: self.avg_latency_ms,
            peak_latency_ms: self.peak_latency_ms,
            validation_accuracy: self.validation_accuracy,
            success_rate: self.success_rate,
            avg_reward: self.avg_reward,
            memory_bytes: self.estimate_memory_bytes(),
        }
    }
}

// ============================================================================
// Agent Statistics Snapshot
// ============================================================================

/// Statistics snapshot for monitoring and debugging
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentStats {
    pub id: String,
    pub feature_code: String,
    pub status: String,
    pub interactions: u32,
    pub confidence: f32,
    pub health: f32,
    pub parameter_count: u32,
    pub counter_count: u32,
    pub kpi_count: u32,
    pub avg_latency_ms: f32,
    pub peak_latency_ms: f32,
    pub validation_accuracy: f32,
    pub success_rate: f32,
    pub avg_reward: f32,
    pub memory_bytes: u32,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Convert AgentId to hex string
fn hex_id(id: &AgentId) -> String {
    id.iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

/// Get current timestamp (placeholder for WASM)
fn current_timestamp() -> Timestamp {
    // In real WASM, would use js_sys::Date::now()
    0
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FeatureCode;
    use crate::feature::Feature;

    #[test]
    fn test_agent_creation() {
        let id = [0u8; 32];
        let code = FeatureCode::parse("FAJ 121 3094").unwrap();
        let feature = Feature::new(
            code.clone(),
            "MIMO Sleep".to_string(),
            "Energy Saving".to_string(),
            "LTE".to_string(),
        );
        let agent = FeatureAgent::new(id, code, feature);

        assert_eq!(agent.status, AgentStatus::Initializing);
        assert_eq!(agent.confidence, 0.5);
        assert!(!agent.is_ready());
    }

    #[test]
    fn test_agent_initialization() {
        let id = [0u8; 32];
        let code = FeatureCode::parse("FAJ 121 3094").unwrap();
        let feature = Feature::new(
            code.clone(),
            "MIMO Sleep".to_string(),
            "Energy Saving".to_string(),
            "LTE".to_string(),
        );
        let mut agent = FeatureAgent::new(id, code, feature);

        agent.initialize().unwrap();
        assert_eq!(agent.status, AgentStatus::ColdStart);
        assert!(agent.is_cold_start());
    }

    #[test]
    fn test_cold_start_transition() {
        let id = [0u8; 32];
        let code = FeatureCode::parse("FAJ 121 0000").unwrap();
        let feature = Feature::new(
            code.clone(),
            "Test".to_string(),
            "Test".to_string(),
            "LTE".to_string(),
        );
        let mut agent = FeatureAgent::new(id, code, feature);
        agent.initialize().unwrap();

        // Not ready until threshold
        for _ in 0..99 {
            agent.record_query(100.0, 0.5);
        }
        assert!(!agent.is_ready());

        // Transition to Ready
        agent.record_query(100.0, 0.5);
        assert!(agent.is_ready());
        assert_eq!(agent.status, AgentStatus::Ready);
    }

    #[test]
    fn test_confidence_update() {
        let id = [0u8; 32];
        let code = FeatureCode::parse("FAJ 121 0000").unwrap();
        let feature = Feature::new(
            code.clone(),
            "Test".to_string(),
            "Test".to_string(),
            "LTE".to_string(),
        );
        let mut agent = FeatureAgent::new(id, code, feature);

        let initial = agent.confidence;
        agent.update_confidence(1.0);
        assert!(agent.confidence > initial);

        // Apply larger negative reward to decrease below initial
        agent.update_confidence(-10.0);
        assert!(agent.confidence >= 0.0);
        assert!(agent.confidence < initial);
    }
}
