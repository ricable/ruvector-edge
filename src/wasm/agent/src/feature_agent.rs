/// Feature Agent Data Structures for Ericsson RAN
///
/// Represents the core state of a feature agent including:
/// - Feature metadata (name, FAJ code, parameters, counters, KPIs)
/// - Agent lifecycle state
/// - Q-learning table and confidence tracking

use serde::{Deserialize, Serialize};

/// Agent lifecycle states
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum AgentStatus {
    Initializing,
    ColdStart,    // Before 100 interactions
    Ready,        // After 100 interactions
    Busy,         // Processing query
    Offline,      // Shutdown
}

/// Parameter definition for a feature
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub value_type: String,           // INTEGER, BOOLEAN, FLOAT, etc.
    pub range_min: Option<f64>,
    pub range_max: Option<f64>,
    pub current_value: Option<String>,
    pub description: Option<String>,
}

/// Counter definition for a feature
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Counter {
    pub name: String,
    pub category: String,             // Primary, Secondary
    pub current_value: f64,
    pub description: Option<String>,
}

/// KPI definition for a feature
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KPI {
    pub name: String,
    pub formula: String,
    pub threshold: f64,
    pub current_value: Option<f64>,
}

/// Procedure (activation/deactivation/verification)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Procedure {
    pub name: String,
    pub description: String,
    pub steps: Vec<ProcedureStep>,
}

/// Step in a procedure
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProcedureStep {
    pub order: u32,
    pub description: String,
}

/// Q-Learning action for feature agents
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum AgentAction {
    DirectAnswer,           // Answer from feature knowledge
    ContextAnswer,          // Answer + vector memory search
    ConsultPeer,           // Query related feature agents
    RequestClarification,  // Ask for more info
    Escalate,              // Route to human expert
}

/// Core Feature Agent Struct
///
/// Represents a specialized WASM agent managing one Ericsson RAN feature.
/// Contains all state needed for configuration validation, optimization, and monitoring.
#[derive(Clone, Serialize, Deserialize)]
pub struct FeatureAgentWasm {
    // Identity
    pub id: String,                    // agent-faj-121-xxxx
    pub faj_code: String,              // FAJ code (unique feature ID)
    pub name: Option<String>,          // Feature name
    pub category: String,              // Feature category

    // Lifecycle
    pub status: AgentStatus,
    pub initialized_at: u64,           // Timestamp
    pub last_query_at: u64,            // Timestamp
    pub shutdown_at: Option<u64>,      // Timestamp

    // Feature data
    pub parameters: Vec<Parameter>,
    pub counters: Vec<Counter>,
    pub kpis: Vec<KPI>,
    pub procedures: Vec<Procedure>,

    // Agent statistics
    pub interaction_count: u32,        // Total queries processed
    pub confidence: f32,               // 0.0-1.0, increases with experience
    pub health: f32,                   // 0.0-1.0, overall agent health
    pub success_rate: f32,             // 0.0-1.0, successful responses

    // Learning state (Q-Learning)
    pub q_table_entries: u32,          // Number of Q-table entries
    pub avg_reward: f32,               // Average reward received
    pub cold_start_threshold: u32,     // Interactions before "Ready" (default 100)

    // Performance metrics
    pub avg_latency_ms: f32,           // Average response latency
    pub peak_latency_ms: f32,          // Peak response latency
    pub validation_accuracy: f32,      // 0.0-1.0, config validation accuracy
}

impl Default for FeatureAgentWasm {
    fn default() -> Self {
        Self {
            id: String::new(),
            faj_code: String::new(),
            name: None,
            category: String::new(),
            status: AgentStatus::Initializing,
            initialized_at: 0,
            last_query_at: 0,
            shutdown_at: None,
            parameters: Vec::new(),
            counters: Vec::new(),
            kpis: Vec::new(),
            procedures: Vec::new(),
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
}

impl FeatureAgentWasm {
    /// Create a new feature agent with minimal data
    pub fn new(
        id: String,
        faj_code: String,
        category: String,
        parameters: Vec<Parameter>,
        counters: Vec<Counter>,
        kpis: Vec<KPI>,
    ) -> Self {
        Self {
            id,
            faj_code,
            category,
            parameters,
            counters,
            kpis,
            status: AgentStatus::Initializing,
            confidence: 0.5,      // Cold start confidence
            health: 1.0,
            interaction_count: 0,
            cold_start_threshold: 100,
            ..Default::default()
        }
    }

    /// Check if agent is ready to handle queries
    pub fn is_ready(&self) -> bool {
        matches!(self.status, AgentStatus::Ready)
    }

    /// Check if still in cold start phase
    pub fn is_cold_start(&self) -> bool {
        self.interaction_count < self.cold_start_threshold
    }

    /// Get total number of parameters this agent manages
    pub fn parameter_count(&self) -> u32 {
        self.parameters.len() as u32
    }

    /// Get total number of counters this agent monitors
    pub fn counter_count(&self) -> u32 {
        self.counters.len() as u32
    }

    /// Get total number of KPIs this agent tracks
    pub fn kpi_count(&self) -> u32 {
        self.kpis.len() as u32
    }

    /// Update confidence based on feedback
    /// Rewards typically in range [-1.0, 1.0]
    pub fn update_confidence(&mut self, reward: f32) {
        let delta = reward * 0.05;  // Gradual confidence updates
        self.confidence = (self.confidence + delta).max(0.0).min(1.0);
    }

    /// Transition from ColdStart to Ready once threshold is met
    pub fn check_cold_start_transition(&mut self) {
        if matches!(self.status, AgentStatus::ColdStart)
           && self.interaction_count >= self.cold_start_threshold {
            self.status = AgentStatus::Ready;
            // Increase confidence upon readiness
            self.confidence = 0.7;
        }
    }

    /// Record a query execution for statistics
    pub fn record_query(&mut self, latency_ms: f32, reward: f32) {
        self.interaction_count += 1;
        self.last_query_at = current_timestamp();

        // Update latency tracking
        let prev_latency_sum = self.avg_latency_ms * (self.interaction_count as f32 - 1.0);
        self.avg_latency_ms = (prev_latency_sum + latency_ms) / (self.interaction_count as f32);

        // Track peak latency
        if latency_ms > self.peak_latency_ms {
            self.peak_latency_ms = latency_ms;
        }

        // Update average reward
        let prev_reward_sum = self.avg_reward * (self.interaction_count as f32 - 1.0);
        self.avg_reward = (prev_reward_sum + reward) / (self.interaction_count as f32);

        // Update confidence
        self.update_confidence(reward);

        // Check cold start transition
        self.check_cold_start_transition();
    }

    /// Update validation accuracy based on outcomes
    pub fn update_validation_accuracy(&mut self, num_correct: u32, total: u32) {
        if total > 0 {
            self.validation_accuracy = (num_correct as f32) / (total as f32);
        }
    }

    /// Estimate memory usage of this agent
    pub fn estimate_memory_bytes(&self) -> u32 {
        // Base struct overhead
        let base_size = 1024u32;

        // Feature data (existing)
        let param_size = self.parameters.len() as u32 * 256;
        let counter_size = self.counters.len() as u32 * 128;
        let kpi_size = self.kpis.len() as u32 * 128;
        let procedure_size = self.procedures.len() as u32 * 512;

        // Q-table: each entry ~100 bytes (String key + QEntry)
        let q_table_size = self.q_table_entries * 100;

        // HNSW index: 10,000 vectors × 128 dims × 4 bytes (f32)
        let hnsw_size = 10_000 * 128 * 4;

        // Trajectory buffer: ~1MB for state/action/reward history
        let trajectory_size = 1_048_576; // 1MB

        // HashMap overhead: ~100 bytes per entry
        let hashmap_overhead = (self.parameters.len() + self.counters.len() + self.kpis.len()) as u32 * 100;

        base_size + param_size + counter_size + kpi_size + procedure_size
            + q_table_size + hnsw_size + trajectory_size + hashmap_overhead
    }

    /// Get comprehensive agent statistics
    pub fn get_stats(&self) -> AgentStats {
        AgentStats {
            id: self.id.clone(),
            faj_code: self.faj_code.clone(),
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

/// Statistics snapshot of an agent
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentStats {
    pub id: String,
    pub faj_code: String,
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

/// Query context for agent processing
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueryContext {
    pub query_id: String,
    pub content: String,
    pub state_hash: String,           // Hash of current state
    pub available_actions: Vec<AgentAction>,
}

/// Response from agent query processing
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueryResponse {
    pub query_id: String,
    pub content: String,
    pub action_taken: AgentAction,
    pub confidence: f32,
    pub latency_ms: f32,
    pub q_value: f32,                 // Q-value of chosen action
    pub metadata: Option<String>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get current Unix timestamp in milliseconds
#[cfg(target_arch = "wasm32")]
fn current_timestamp() -> u64 {
    js_sys::Date::now() as u64
}

/// Get current Unix timestamp in milliseconds (native)
#[cfg(not(target_arch = "wasm32"))]
fn current_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_creation() {
        let agent = FeatureAgentWasm::new(
            "agent-faj-121-3094".to_string(),
            "FAJ 121 3094".to_string(),
            "Energy Saving".to_string(),
            vec![],
            vec![],
            vec![],
        );

        assert_eq!(agent.faj_code, "FAJ 121 3094");
        assert_eq!(agent.status, AgentStatus::Initializing);
        assert_eq!(agent.confidence, 0.5);
        assert!(!agent.is_ready());
    }

    #[test]
    fn test_cold_start_transition() {
        let mut agent = FeatureAgentWasm::new(
            "test-agent".to_string(),
            "FAJ 121 0000".to_string(),
            "Test".to_string(),
            vec![],
            vec![],
            vec![],
        );

        agent.status = AgentStatus::ColdStart;

        // Not ready until threshold
        for _ in 0..99 {
            agent.interaction_count += 1;
        }
        assert!(!agent.is_ready());

        // Transition to Ready
        agent.interaction_count = 100;
        agent.check_cold_start_transition();
        assert_eq!(agent.status, AgentStatus::Ready);
    }

    #[test]
    fn test_confidence_update() {
        let mut agent = FeatureAgentWasm::new(
            "test-agent".to_string(),
            "FAJ 121 0000".to_string(),
            "Test".to_string(),
            vec![],
            vec![],
            vec![],
        );

        let initial = agent.confidence;
        agent.update_confidence(1.0);  // Positive reward
        assert!(agent.confidence > initial);

        agent.update_confidence(-1.0); // Negative reward
        // Confidence should decrease but stay >= 0.0
        assert!(agent.confidence >= 0.0);
    }

    #[test]
    fn test_memory_estimation() {
        let agent = FeatureAgentWasm::new(
            "test-agent".to_string(),
            "FAJ 121 0000".to_string(),
            "Test".to_string(),
            vec![Parameter {
                name: "test_param".to_string(),
                value_type: "INTEGER".to_string(),
                range_min: Some(0.0),
                range_max: Some(100.0),
                current_value: None,
                description: None,
            }],
            vec![],
            vec![],
        );

        let memory = agent.estimate_memory_bytes();
        assert!(memory > 1024, "Memory should be > 1KB base");
    }
}
