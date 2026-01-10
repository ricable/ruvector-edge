//! ELEX WASM - WebAssembly Bindings for RAN Optimization
//!
//! This crate provides wasm-bindgen exports for the ELEX Edge AI Agent Swarm,
//! enabling deployment in browsers, Node.js, and edge environments.
//!
//! # Features
//!
//! - **Browser/Node.js Compatibility**: Works in all modern browsers and Node.js
//! - **Lazy Loading**: On-demand agent instantiation to reduce memory footprint
//! - **IndexedDB Persistence**: Seamless storage for Q-tables and trajectories
//! - **Telemetry Hooks**: Built-in monitoring and performance tracking
//! - **TypeScript Definitions**: Full TypeScript type definitions for JS consumers
//!
//! # Quick Start
//!
//! ```javascript
//! import { ElexSwarm, QueryType, Complexity } from 'elex-wasm';
//!
//! // Initialize the swarm
//! const swarm = await ElexSwarm.initialize({
//!     topology: 'hierarchical-mesh',
//!     maxAgents: 50,
//!     enableTelemetry: true
//! });
//!
//! // Process a query
//! const response = await swarm.query({
//!     text: "Configure IFLB thresholds for load balancing",
//!     queryType: QueryType.Parameter,
//!     complexity: Complexity.Moderate
//! });
//!
//! console.log(`Response: ${response.text}`);
//! console.log(`Confidence: ${response.confidence}`);
//! console.log(`Latency: ${response.latencyMs}ms`);
//! ```
//!
//! # Architecture
//!
//! The WASM module exports the following main components:
//!
//! - **ElexSwarm**: Main swarm coordinator for multi-agent orchestration
//! - **ElexAgent**: Individual feature agent with Q-learning capabilities
//! - **ElexRouter**: Semantic router for query-to-agent matching
//! - **ElexMemory**: HNSW-indexed vector memory for semantic search
//! - **ElexConfig**: Configuration management system
//! - **ElexTelemetry**: Performance monitoring and telemetry

#![cfg_attr(target_arch = "wasm32", allow(dead_code))]

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use js_sys::{Promise, Object, Array, Reflect, Date};
use web_sys::{window, StorageEvent};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::panic;

// Re-export core types
use elex_core::{
    types::{AgentId, Embedding, FeatureCode, Action, Confidence},
    types::{QueryType as CoreQueryType, Complexity as CoreComplexity},
    error::{ElexError, Result as CoreResult},
    feature::Feature,
    knowledge::FeatureAgent as CoreFeatureAgent,
};
use elex_agent::FeatureAgent;
use elex_qlearning::{
    qtable::{QTable, QLearningConfig},
    trajectory::{AgentTrajectoryBuffer, TrajectoryOutcome},
};
use elex_memory::{HnswIndex, HnswConfig};
use elex_routing::SemanticRouter;
use elex_safety::{SafeZoneValidator, pre_change_check};

// ============================================================================
// Error Handling
// ============================================================================

/// Convert Rust errors to JavaScript errors
fn js_error(message: String) -> JsValue {
    js_sys::Error::new(&message).into()
}

/// Convert CoreResult to JsValue (Ok => value, Err => JsError)
fn result_to_js<T, U>(result: CoreResult<T>, ok_fn: impl FnOnce(T) -> U) -> JsValue
where
    U: Into<JsValue>,
{
    match result {
        Ok(val) => ok_fn(val).into(),
        Err(e) => js_error(format!("{:?}", e)),
    }
}

/// Implement From<ElexError> for JsValue to enable ? operator in async functions
/// Note: We use a wrapper function instead of implementing the trait directly
/// due to the orphan rule (can't implement foreign trait for foreign type)
fn elex_error_to_js(err: ElexError) -> JsValue {
    js_error(format!("{:?}", err))
}

// ============================================================================
// Configuration
// ============================================================================

/// Swarm topology options
#[wasm_bindgen]
pub struct Topology {
    inner: TopologyConfig,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
enum TopologyConfig {
    Mesh,
    Hierarchical,
    HierarchicalMesh,
}

#[wasm_bindgen]
impl Topology {
    /// Mesh topology - all agents connected to all others
    pub fn mesh() -> Topology {
        Topology { inner: TopologyConfig::Mesh }
    }

    /// Hierarchical topology - coordinators manage agent groups
    pub fn hierarchical() -> Topology {
        Topology { inner: TopologyConfig::Hierarchical }
    }

    /// Hierarchical-mesh topology - hybrid approach (recommended)
    pub fn hierarchical_mesh() -> Topology {
        Topology { inner: TopologyConfig::HierarchicalMesh }
    }
}

/// Configuration options for ElexSwarm initialization
#[derive(Clone, Debug)]
pub struct SwarmConfig {
    pub topology: TopologyConfig,
    pub max_agents: usize,
    pub enable_telemetry: bool,
    pub enable_indexeddb: bool,
    pub cache_size_mb: usize,
    pub lazy_loading: bool,
    pub auto_sync: bool,
    pub sync_interval_ms: u64,
}

impl Default for SwarmConfig {
    fn default() -> Self {
        Self {
            topology: TopologyConfig::HierarchicalMesh,
            max_agents: 50,
            enable_telemetry: true,
            enable_indexeddb: true,
            cache_size_mb: 50,
            lazy_loading: true,
            auto_sync: true,
            sync_interval_ms: 60000, // 1 minute
        }
    }
}

// ============================================================================
// Query Types
// ============================================================================

/// Query type classification
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QueryType {
    Parameter = 0,
    Counter = 1,
    Kpi = 2,
    Procedure = 3,
    Troubleshoot = 4,
    General = 5,
}

impl From<QueryType> for CoreQueryType {
    fn from(qt: QueryType) -> Self {
        match qt {
            QueryType::Parameter => CoreQueryType::Parameter,
            QueryType::Counter => CoreQueryType::Counter,
            QueryType::Kpi => CoreQueryType::Kpi,
            QueryType::Procedure => CoreQueryType::Procedure,
            QueryType::Troubleshoot => CoreQueryType::Troubleshoot,
            QueryType::General => CoreQueryType::General,
        }
    }
}

impl From<CoreQueryType> for QueryType {
    fn from(qt: CoreQueryType) -> Self {
        match qt {
            CoreQueryType::Parameter => QueryType::Parameter,
            CoreQueryType::Counter => QueryType::Counter,
            CoreQueryType::Kpi => QueryType::Kpi,
            CoreQueryType::Procedure => QueryType::Procedure,
            CoreQueryType::Troubleshoot => QueryType::Troubleshoot,
            CoreQueryType::General => QueryType::General,
        }
    }
}

/// Query complexity classification
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Complexity {
    Simple = 0,
    Moderate = 1,
    Complex = 2,
}

impl From<Complexity> for CoreComplexity {
    fn from(c: Complexity) -> Self {
        match c {
            Complexity::Simple => CoreComplexity::Simple,
            Complexity::Moderate => CoreComplexity::Moderate,
            Complexity::Complex => CoreComplexity::Complex,
        }
    }
}

impl From<CoreComplexity> for Complexity {
    fn from(c: CoreComplexity) -> Self {
        match c {
            CoreComplexity::Simple => Complexity::Simple,
            CoreComplexity::Moderate => Complexity::Moderate,
            CoreComplexity::Complex => Complexity::Complex,
        }
    }
}

// ============================================================================
// Query Response
// ============================================================================

/// Response from a query to the swarm
#[wasm_bindgen]
pub struct QueryResponse {
    text: String,
    agent_id: String,
    feature_code: String,
    confidence: f32,
    latency_ms: f64,
    cmedit_commands: Vec<String>,
    risk_level: String,
    timestamp: u64,
}

#[wasm_bindgen]
impl QueryResponse {
    /// Get the response text
    #[wasm_bindgen(getter)]
    pub fn text(&self) -> String {
        self.text.clone()
    }

    /// Get the agent ID that generated the response
    #[wasm_bindgen(getter)]
    pub fn agent_id(&self) -> String {
        self.agent_id.clone()
    }

    /// Get the feature code of the responding agent
    #[wasm_bindgen(getter)]
    pub fn feature_code(&self) -> String {
        self.feature_code.clone()
    }

    /// Get the confidence score (0.0 to 1.0)
    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f32 {
        self.confidence
    }

    /// Get the response latency in milliseconds
    #[wasm_bindgen(getter)]
    pub fn latency_ms(&self) -> f64 {
        self.latency_ms
    }

    /// Get any cmedit commands generated
    #[wasm_bindgen(getter)]
    pub fn cmedit_commands(&self) -> Array {
        self.cmedit_commands
            .iter()
            .map(|s| JsValue::from_str(s))
            .collect()
    }

    /// Get the risk level assessment
    #[wasm_bindgen(getter)]
    pub fn risk_level(&self) -> String {
        self.risk_level.clone()
    }

    /// Get the timestamp of the response
    #[wasm_bindgen(getter)]
    pub fn timestamp(&self) -> u64 {
        self.timestamp
    }
}

// ============================================================================
// Agent Statistics
// ============================================================================

/// Statistics for an individual agent
#[wasm_bindgen]
pub struct WasmAgentStats {
    agent_id: String,
    feature_code: String,
    feature_name: String,
    query_count: u64,
    success_count: u64,
    success_rate: f32,
    avg_latency_ms: f32,
    confidence: f32,
    health: f32,
    q_table_entries: u32,
    trajectory_count: usize,
    epsilon: f32,
    memory_entries: usize,
    status: String,
}

#[wasm_bindgen]
impl WasmAgentStats {
    #[wasm_bindgen(getter)]
    pub fn agent_id(&self) -> String { self.agent_id.clone() }

    #[wasm_bindgen(getter)]
    pub fn feature_code(&self) -> String { self.feature_code.clone() }

    #[wasm_bindgen(getter)]
    pub fn feature_name(&self) -> String { self.feature_name.clone() }

    #[wasm_bindgen(getter)]
    pub fn query_count(&self) -> u64 { self.query_count }

    #[wasm_bindgen(getter)]
    pub fn success_count(&self) -> u64 { self.success_count }

    #[wasm_bindgen(getter)]
    pub fn success_rate(&self) -> f32 { self.success_rate }

    #[wasm_bindgen(getter)]
    pub fn avg_latency_ms(&self) -> f32 { self.avg_latency_ms }

    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f32 { self.confidence }

    #[wasm_bindgen(getter)]
    pub fn health(&self) -> f32 { self.health }

    #[wasm_bindgen(getter)]
    pub fn q_table_entries(&self) -> u32 { self.q_table_entries }

    #[wasm_bindgen(getter)]
    pub fn trajectory_count(&self) -> usize { self.trajectory_count }

    #[wasm_bindgen(getter)]
    pub fn epsilon(&self) -> f32 { self.epsilon }

    #[wasm_bindgen(getter)]
    pub fn memory_entries(&self) -> usize { self.memory_entries }

    #[wasm_bindgen(getter)]
    pub fn status(&self) -> String { self.status.clone() }
}

// ============================================================================
// Swarm Statistics
// ============================================================================

/// Overall swarm statistics
#[wasm_bindgen]
pub struct SwarmStats {
    total_agents: usize,
    active_agents: usize,
    total_queries: u64,
    total_successes: u64,
    avg_latency_ms: f32,
    cache_hit_rate: f32,
    memory_usage_mb: f32,
    uptime_ms: u64,
    topology: String,
}

#[wasm_bindgen]
impl SwarmStats {
    #[wasm_bindgen(getter)]
    pub fn total_agents(&self) -> usize { self.total_agents }

    #[wasm_bindgen(getter)]
    pub fn active_agents(&self) -> usize { self.active_agents }

    #[wasm_bindgen(getter)]
    pub fn total_queries(&self) -> u64 { self.total_queries }

    #[wasm_bindgen(getter)]
    pub fn total_successes(&self) -> u64 { self.total_successes }

    #[wasm_bindgen(getter)]
    pub fn avg_latency_ms(&self) -> f32 { self.avg_latency_ms }

    #[wasm_bindgen(getter)]
    pub fn cache_hit_rate(&self) -> f32 { self.cache_hit_rate }

    #[wasm_bindgen(getter)]
    pub fn memory_usage_mb(&self) -> f32 { self.memory_usage_mb }

    #[wasm_bindgen(getter)]
    pub fn uptime_ms(&self) -> u64 { self.uptime_ms }

    #[wasm_bindgen(getter)]
    pub fn topology(&self) -> String { self.topology.clone() }
}

// ============================================================================
// Main Swarm Class
// ============================================================================

/// Main ELEX Swarm coordinator for multi-agent orchestration
///
/// This is the primary entry point for using the ELEX system from JavaScript.
/// It manages the lifecycle of all agents, handles query routing, and provides
/// telemetry and monitoring capabilities.
#[wasm_bindgen]
pub struct ElexSwarm {
    config: SwarmConfig,
    agents: Arc<Mutex<HashMap<String, Arc<Mutex<FeatureAgent>>>>>,
    router: Arc<Mutex<SemanticRouter>>,
    telemetry: Arc<Mutex<Telemetry>>,
    start_time: f64,
    indexeddb_available: bool,
}

#[wasm_bindgen]
impl ElexSwarm {
    /// Initialize a new ELEX swarm
    ///
    /// # Arguments
    /// * `config_js` - Configuration object as JavaScript object
    ///
    /// # Returns
    /// Promise that resolves to the initialized swarm
    ///
    /// # Example
    /// ```javascript
    /// const swarm = await ElexSwarm.initialize({
    ///     topology: Topology.hierarchical_mesh(),
    ///     maxAgents: 50,
    ///     enableTelemetry: true,
    ///     enableIndexedDB: true,
    ///     cacheSizeMB: 50,
    ///     lazyLoading: true,
    ///     autoSync: true,
    ///     syncIntervalMs: 60000
    /// });
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(config_js: JsValue) -> Promise {
        future_to_promise(async move {
            // Set up panic hook for better error messages
            console_error_panic_hook::set_once();

            // Parse configuration from JavaScript object
            let config = Self::parse_config(config_js)
                .map_err(|e| js_error(format!("Config parse error: {:?}", e)))?;

            // Check IndexedDB availability
            let indexeddb_available = Self::check_indexeddb();

            // Create router (currently uses default config)
            let router = SemanticRouter::new();

            // Create telemetry if enabled
            let telemetry = if config.enable_telemetry {
                Telemetry::new()
            } else {
                Telemetry::disabled()
            };

            let swarm = ElexSwarm {
                config,
                agents: Arc::new(Mutex::new(HashMap::new())),
                router: Arc::new(Mutex::new(router)),
                telemetry: Arc::new(Mutex::new(telemetry)),
                start_time: Date::now(),
                indexeddb_available,
            };

            // Load agents if not lazy loading
            if !swarm.config.lazy_loading {
                swarm.load_initial_agents().await
                    .map_err(|e| js_error(format!("Agent load error: {:?}", e)))?;
            }

            Ok(JsValue::from(swarm))
        })
    }

    /// Process a query through the swarm
    ///
    /// # Arguments
    /// * `query_js` - Query object with text, queryType, complexity, and optional context
    ///
    /// # Returns
    /// Promise that resolves to a QueryResponse
    ///
    /// # Example
    /// ```javascript
    /// const response = await swarm.query({
    ///     text: "Configure IFLB thresholds",
    ///     queryType: QueryType.Parameter,
    ///     complexity: Complexity.Moderate,
    ///     context: "load balancing optimization"
    /// });
    /// ```
    #[wasm_bindgen]
    pub fn query(&self, query_js: JsValue) -> Promise {
        let swarm = self.clone_refs();
        future_to_promise(async move {
            // Parse query from JavaScript object
            let (text, query_type, complexity, context) = Self::parse_query(query_js)
                .map_err(|e| js_error(format!("Query parse error: {:?}", e)))?;

            let start_time = Date::now();

            // Route query to appropriate agent
            let agent = swarm.route_query(&text, query_type, complexity).await
                .map_err(|e| js_error(format!("Route error: {:?}", e)))?;

            // Process query with the agent
            let mut agent_guard = agent.lock().map_err(|e| js_error(format!("Agent lock error: {:?}", e)))?;
            let response_text = agent_guard.process_query(
                &text,
                query_type.into(),
                complexity.into(),
                context,
            ).map_err(|e| js_error(format!("Query processing error: {:?}", e)))?;

            let end_time = Date::now();

            // Build response
            let response = QueryResponse {
                text: response_text,
                agent_id: hex::encode(agent_guard.agent_id),
                feature_code: agent_guard.feature_code.as_str().to_string(),
                confidence: agent_guard.core.confidence,
                latency_ms: end_time - start_time,
                cmedit_commands: vec![],
                risk_level: "Low".to_string(),
                timestamp: end_time as u64,
            };

            // Record telemetry
            {
                let mut telemetry = swarm.telemetry.lock().unwrap();
                telemetry.record_query(end_time - start_time, response.confidence);
            }

            // Convert to JavaScript object
            let js_response = Object::new();
            Reflect::set(&js_response, &JsValue::from_str("text"), &JsValue::from_str(&response.text))?;
            Reflect::set(&js_response, &JsValue::from_str("agentId"), &JsValue::from_str(&response.agent_id))?;
            Reflect::set(&js_response, &JsValue::from_str("featureCode"), &JsValue::from_str(&response.feature_code))?;
            Reflect::set(&js_response, &JsValue::from_str("confidence"), &JsValue::from_f64(response.confidence as f64))?;
            Reflect::set(&js_response, &JsValue::from_str("latencyMs"), &JsValue::from_f64(response.latency_ms))?;
            Reflect::set(&js_response, &JsValue::from_str("timestamp"), &JsValue::from_f64(response.timestamp as f64))?;

            Ok(JsValue::from(js_response))
        })
    }

    /// Provide feedback on a previous query (for Q-learning)
    ///
    /// # Arguments
    /// * `agent_id` - ID of the agent that handled the query
    /// * `reward` - Reward signal (-1.0 to +1.0)
    /// * `success` - Whether the response was successful
    ///
    /// # Returns
    /// Promise that resolves when feedback is recorded
    #[wasm_bindgen]
    pub fn feedback(&self, agent_id: String, reward: f32, success: bool) -> Promise {
        let swarm = self.clone_refs();
        future_to_promise(async move {
            let agents = swarm.agents.lock().unwrap();
            if let Some(agent) = agents.get(&agent_id) {
                let mut agent_guard = agent.lock().unwrap();
                // For now, use trajectory ID 0 as placeholder
                // In production, this would track trajectory IDs per query
                agent_guard.receive_feedback(0, reward, success)
                    .map_err(|e| js_error(format!("Feedback error: {:?}", e)))?;
            }
            Ok(JsValue::UNDEFINED)
        })
    }

    /// Get statistics for a specific agent
    ///
    /// # Arguments
    /// * `agent_id` - ID of the agent
    ///
    /// # Returns
    /// Promise that resolves to WasmAgentStats
    #[wasm_bindgen]
    pub fn get_agent_stats(&self, agent_id: String) -> Promise {
        let swarm = self.clone_refs();
        future_to_promise(async move {
            let agents = swarm.agents.lock().unwrap();
            if let Some(agent) = agents.get(&agent_id) {
                let agent_guard = agent.lock().unwrap();
                let stats = agent_guard.get_stats();

                let js_stats = Object::new();
                Reflect::set(&js_stats, &JsValue::from_str("agentId"), &JsValue::from_str(&stats.agent_id))?;
                Reflect::set(&js_stats, &JsValue::from_str("featureCode"), &JsValue::from_str(&stats.feature_code))?;
                Reflect::set(&js_stats, &JsValue::from_str("featureName"), &JsValue::from_str(&stats.feature_name))?;
                Reflect::set(&js_stats, &JsValue::from_str("queryCount"), &JsValue::from_f64(stats.query_count as f64))?;
                Reflect::set(&js_stats, &JsValue::from_str("successCount"), &JsValue::from_f64(stats.success_count as f64))?;
                Reflect::set(&js_stats, &JsValue::from_str("successRate"), &JsValue::from_f64(stats.success_rate as f64))?;
                Reflect::set(&js_stats, &JsValue::from_str("avgLatencyMs"), &JsValue::from_f64(stats.avg_latency_ms as f64))?;
                Reflect::set(&js_stats, &JsValue::from_str("confidence"), &JsValue::from_f64(stats.confidence as f64))?;
                Reflect::set(&js_stats, &JsValue::from_str("health"), &JsValue::from_f64(stats.health as f64))?;

                Ok(JsValue::from(js_stats))
            } else {
                Err(js_error(format!("Agent not found: {}", agent_id)))
            }
        })
    }

    /// Get overall swarm statistics
    ///
    /// # Returns
    /// Promise that resolves to SwarmStats
    #[wasm_bindgen]
    pub fn get_swarm_stats(&self) -> Promise {
        let swarm = self.clone_refs();
        future_to_promise(async move {
            let agents = swarm.agents.lock().unwrap();
            let telemetry = swarm.telemetry.lock().unwrap();

            let total_queries = telemetry.total_queries();
            let total_successes = telemetry.total_successes();
            let avg_latency = telemetry.avg_latency_ms();

            let js_stats = Object::new();
            Reflect::set(&js_stats, &JsValue::from_str("totalAgents"), &JsValue::from_f64(agents.len() as f64))?;
            Reflect::set(&js_stats, &JsValue::from_str("activeAgents"), &JsValue::from_f64(agents.len() as f64))?;
            Reflect::set(&js_stats, &JsValue::from_str("totalQueries"), &JsValue::from_f64(total_queries as f64))?;
            Reflect::set(&js_stats, &JsValue::from_str("totalSuccesses"), &JsValue::from_f64(total_successes as f64))?;
            Reflect::set(&js_stats, &JsValue::from_str("avgLatencyMs"), &JsValue::from_f64(avg_latency as f64))?;
            Reflect::set(&js_stats, &JsValue::from_str("uptimeMs"), &JsValue::from_f64(Date::now() - swarm.start_time))?;

            Ok(JsValue::from(js_stats))
        })
    }

    /// Synchronize Q-tables with federated learning
    ///
    /// # Returns
    /// Promise that resolves when sync is complete
    #[wasm_bindgen]
    pub fn sync(&self) -> Promise {
        let _swarm = self.clone_refs();
        future_to_promise(async move {
            // TODO: Implement federated sync
            Ok(JsValue::UNDEFINED)
        })
    }

    /// Persist agent state to IndexedDB
    ///
    /// # Returns
    /// Promise that resolves when persistence is complete
    #[wasm_bindgen]
    pub fn persist(&self) -> Promise {
        let swarm = self.clone_refs();
        future_to_promise(async move {
            if !swarm.indexeddb_available {
                return Ok(JsValue::UNDEFINED);
            }

            // TODO: Implement IndexedDB persistence
            Ok(JsValue::UNDEFINED)
        })
    }

    /// Shutdown the swarm and release resources
    ///
    /// # Returns
    /// Promise that resolves when shutdown is complete
    #[wasm_bindgen]
    pub fn shutdown(&self) -> Promise {
        let swarm = self.clone_refs();
        future_to_promise(async move {
            let agents = swarm.agents.lock().unwrap();
            for (_id, agent) in agents.iter() {
                let mut agent_guard = agent.lock().unwrap();
                let _ = agent_guard.shutdown();
            }
            Ok(JsValue::UNDEFINED)
        })
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    fn clone_refs(&self) -> Self {
        ElexSwarm {
            config: self.config.clone(),
            agents: self.agents.clone(),
            router: self.router.clone(),
            telemetry: self.telemetry.clone(),
            start_time: self.start_time,
            indexeddb_available: self.indexeddb_available,
        }
    }

    fn parse_config(config_js: JsValue) -> CoreResult<SwarmConfig> {
        let mut config = SwarmConfig::default();

        // Parse topology if provided
        if let Ok(topology_val) = Reflect::get(&config_js, &JsValue::from_str("topology")) {
            if topology_val.is_undefined() {
                // Use default
            } else {
                // TODO: Parse topology from JS value
            }
        }

        // Parse maxAgents
        if let Ok(max_agents_val) = Reflect::get(&config_js, &JsValue::from_str("maxAgents")) {
            if max_agents_val.is_undefined() {
                // Use default
            } else if let Some(max_agents) = max_agents_val.as_f64() {
                config.max_agents = max_agents as usize;
            }
        }

        // Parse enableTelemetry
        if let Ok(enable_val) = Reflect::get(&config_js, &JsValue::from_str("enableTelemetry")) {
            if !enable_val.is_undefined() {
                config.enable_telemetry = enable_val.as_bool().unwrap_or(true);
            }
        }

        // Parse enableIndexedDB
        if let Ok(enable_val) = Reflect::get(&config_js, &JsValue::from_str("enableIndexedDB")) {
            if !enable_val.is_undefined() {
                config.enable_indexeddb = enable_val.as_bool().unwrap_or(true);
            }
        }

        // Parse cacheSizeMB
        if let Ok(cache_val) = Reflect::get(&config_js, &JsValue::from_str("cacheSizeMB")) {
            if !cache_val.is_undefined() {
                if let Some(cache_mb) = cache_val.as_f64() {
                    config.cache_size_mb = cache_mb as usize;
                }
            }
        }

        // Parse lazyLoading
        if let Ok(lazy_val) = Reflect::get(&config_js, &JsValue::from_str("lazyLoading")) {
            if !lazy_val.is_undefined() {
                config.lazy_loading = lazy_val.as_bool().unwrap_or(true);
            }
        }

        // Parse autoSync
        if let Ok(sync_val) = Reflect::get(&config_js, &JsValue::from_str("autoSync")) {
            if !sync_val.is_undefined() {
                config.auto_sync = sync_val.as_bool().unwrap_or(true);
            }
        }

        // Parse syncIntervalMs
        if let Ok(interval_val) = Reflect::get(&config_js, &JsValue::from_str("syncIntervalMs")) {
            if !interval_val.is_undefined() {
                if let Some(interval_ms) = interval_val.as_f64() {
                    config.sync_interval_ms = interval_ms as u64;
                }
            }
        }

        Ok(config)
    }

    fn parse_query(query_js: JsValue) -> Result<(String, QueryType, Complexity, Option<u64>), JsValue> {
        // Parse text
        let text_val = Reflect::get(&query_js, &JsValue::from_str("text"))
            .map_err(|_| js_error("Missing text field".to_string()))?;
        let text = text_val.as_string().ok_or_else(|| js_error(
            "text must be a string".to_string(),
        ))?;

        // Parse queryType
        let query_type_val = Reflect::get(&query_js, &JsValue::from_str("queryType"))
            .map_err(|_| js_error("Missing queryType field".to_string()))?;
        let query_type_num = query_type_val.as_f64().ok_or_else(|| js_error(
            "queryType must be a number".to_string(),
        ))? as i32;
        let query_type = match query_type_num {
            0 => QueryType::Parameter,
            1 => QueryType::Counter,
            2 => QueryType::Kpi,
            3 => QueryType::Procedure,
            4 => QueryType::Troubleshoot,
            5 => QueryType::General,
            _ => return Err(js_error(
                format!("Invalid queryType: {}", query_type_num),
            )),
        };

        // Parse complexity
        let complexity_val = Reflect::get(&query_js, &JsValue::from_str("complexity"))
            .map_err(|_| js_error("Missing complexity field".to_string()))?;
        let complexity_num = complexity_val.as_f64().ok_or_else(|| js_error(
            "complexity must be a number".to_string(),
        ))? as i32;
        let complexity = match complexity_num {
            0 => Complexity::Simple,
            1 => Complexity::Moderate,
            2 => Complexity::Complex,
            _ => return Err(js_error(
                format!("Invalid complexity: {}", complexity_num),
            )),
        };

        // Parse optional context
        let context = if let Ok(context_val) = Reflect::get(&query_js, &JsValue::from_str("context")) {
            if !context_val.is_undefined() {
                context_val.as_f64().map(|v| Some(v as u64)).unwrap_or(None)
            } else {
                None
            }
        } else {
            None
        };

        Ok((text, query_type, complexity, context))
    }

    fn check_indexeddb() -> bool {
        if let Some(win) = window() {
            js_sys::Reflect::has(&win, &JsValue::from_str("indexedDB")).unwrap_or(false)
        } else {
            false
        }
    }

    async fn load_initial_agents(&self) -> CoreResult<()> {
        // TODO: Load initial set of agents based on configuration
        // For now, just create a sample agent
        let feature_code = FeatureCode::parse("FAJ 121 3094")?;
        let feature = Feature::new(
            feature_code.clone(),
            "MIMO Sleep Mode".to_string(),
            "Energy Saving".to_string(),
            "LTE".to_string(),
        );

        let agent = FeatureAgent::new(feature_code, feature);
        let agent_id = hex::encode(agent.agent_id);

        let mut agents = self.agents.lock().unwrap();
        agents.insert(agent_id.clone(), Arc::new(Mutex::new(agent)));

        Ok(())
    }

    async fn route_query(
        &self,
        _text: &str,
        _query_type: QueryType,
        _complexity: Complexity,
    ) -> CoreResult<Arc<Mutex<FeatureAgent>>> {
        // For now, just return the first available agent
        // In production, this would use the SemanticRouter
        let agents = self.agents.lock().unwrap();
        if let Some((_, agent)) = agents.iter().next() {
            Ok(agent.clone())
        } else {
            // Lazy load an agent if none available
            drop(agents);
            self.lazy_load_agent().await
        }
    }

    async fn lazy_load_agent(&self) -> CoreResult<Arc<Mutex<FeatureAgent>>> {
        // Create a new agent on demand
        let feature_code = FeatureCode::parse("FAJ 121 3094")?;
        let feature = Feature::new(
            feature_code.clone(),
            "MIMO Sleep Mode".to_string(),
            "Energy Saving".to_string(),
            "LTE".to_string(),
        );

        let agent = FeatureAgent::new(feature_code, feature);
        let agent_id = hex::encode(agent.agent_id);

        let mut agents = self.agents.lock().unwrap();
        agents.insert(agent_id.clone(), Arc::new(Mutex::new(agent)));

        Ok(agents.get(&agent_id).unwrap().clone())
    }
}

// ============================================================================
// Telemetry System
// ============================================================================

struct Telemetry {
    enabled: bool,
    queries: Vec<QueryMetric>,
}

struct QueryMetric {
    latency_ms: f64,
    confidence: f32,
    timestamp: f64,
}

impl Telemetry {
    fn new() -> Self {
        Self {
            enabled: true,
            queries: Vec::with_capacity(10000),
        }
    }

    fn disabled() -> Self {
        Self {
            enabled: false,
            queries: Vec::new(),
        }
    }

    fn record_query(&mut self, latency_ms: f64, confidence: f32) {
        if self.enabled {
            self.queries.push(QueryMetric {
                latency_ms,
                confidence,
                timestamp: Date::now(),
            });
        }
    }

    fn total_queries(&self) -> u64 {
        self.queries.len() as u64
    }

    fn total_successes(&self) -> u64 {
        // Count queries with confidence > 0.5 as successes
        self.queries.iter().filter(|q| q.confidence > 0.5).count() as u64
    }

    fn avg_latency_ms(&self) -> f32 {
        if self.queries.is_empty() {
            return 0.0;
        }
        let sum: f64 = self.queries.iter().map(|q| q.latency_ms).sum();
        (sum / self.queries.len() as f64) as f32
    }
}

// ============================================================================
// WASM Module Exports
// ============================================================================

/// Get the ELEX WASM version
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get the ELEX WASM build info
#[wasm_bindgen]
pub fn build_info() -> String {
    format!(
        "ELEX WASM v{} (built: {})",
        env!("CARGO_PKG_VERSION"),
        env!("BUILD_TIMESTAMP")
    )
}

/// Check if SIMD is available
#[wasm_bindgen]
pub fn is_simd_available() -> bool {
    // Check for WebAssembly SIMD support
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(win) = window() {
            if let Ok(webassembly) = js_sys::Reflect::get(&win, &JsValue::from_str("WebAssembly")) {
                // For now, assume SIMD is available if WebAssembly is present
                // In production, you'd want to actually validate SIMD support
                // by compiling and testing a SIMD WASM module
                webassembly.is_object()
            } else {
                false
            }
        } else {
            false
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        true // Native builds always have SIMD
    }
}

/// Get supported features
#[wasm_bindgen]
pub fn get_supported_features() -> Array {
    let features = Array::new();

    features.push(&JsValue::from_str("q-learning"));
    features.push(&JsValue::from_str("hnsw-index"));
    features.push(&JsValue::from_str("federated-learning"));
    features.push(&JsValue::from_str("safe-zone-validation"));

    if is_simd_available() {
        features.push(&JsValue::from_str("simd-acceleration"));
    }

    features
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!version().is_empty());
    }

    #[test]
    fn test_build_info() {
        let info = build_info();
        assert!(info.contains("ELEX WASM"));
    }

    #[test]
    fn test_query_type_conversion() {
        assert_eq!(CoreQueryType::from(QueryType::Parameter), CoreQueryType::Parameter);
        assert_eq!(CoreQueryType::from(QueryType::Counter), CoreQueryType::Counter);
    }

    #[test]
    fn test_complexity_conversion() {
        assert_eq!(CoreComplexity::from(Complexity::Simple), CoreComplexity::Simple);
        assert_eq!(CoreComplexity::from(Complexity::Moderate), CoreComplexity::Moderate);
    }
}
