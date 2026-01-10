//! Lazy Loading System for ELEX Agents
//!
//! This module provides on-demand agent instantiation to reduce the initial
//! memory footprint and startup time of the ELEX swarm.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use elex_core::{types::FeatureCode, feature::Feature};
use crate::agent::FeatureAgent;

/// Lazy agent registry
///
/// Keeps track of which agents are loaded and which are available for loading.
pub struct LazyAgentRegistry {
    /// Currently loaded agents
    loaded_agents: HashMap<String, Arc<Mutex<FeatureAgent>>>,
    /// Available feature codes that can be loaded
    available_features: Vec<FeatureCode>,
    /// Maximum number of agents to keep in memory
    max_loaded: usize,
}

impl LazyAgentRegistry {
    /// Create a new lazy agent registry
    pub fn new(max_loaded: usize, available_features: Vec<FeatureCode>) -> Self {
        Self {
            loaded_agents: HashMap::new(),
            available_features,
            max_loaded,
        }
    }

    /// Get an agent by feature code, loading it if necessary
    pub async fn get_or_load(&mut self, feature_code: &str) -> Option<Arc<Mutex<FeatureAgent>>> {
        // Check if already loaded
        if let Some(agent) = self.loaded_agents.get(feature_code) {
            return Some(agent.clone());
        }

        // Check if we need to evict an agent
        if self.loaded_agents.len() >= self.max_loaded {
            self.evict_lru();
        }

        // Load the agent
        self.load_agent(feature_code).await
    }

    /// Load a specific agent by feature code
    async fn load_agent(&mut self, feature_code: &str) -> Option<Arc<Mutex<FeatureAgent>>> {
        // Find the feature code in available features
        let code = self.available_features.iter()
            .find(|fc| fc.as_str() == feature_code)
            .cloned()?;

        // Create a sample feature (in production, this would load from knowledge base)
        let feature = Feature::new(
            code.clone(),
            format!("Agent for {}", feature_code),
            "RAN Optimization".to_string(),
            "LTE".to_string(),
        );

        let agent = FeatureAgent::new(code, feature);
        let agent_id = hex::encode(agent.agent_id);
        let agent = Arc::new(Mutex::new(agent));

        self.loaded_agents.insert(feature_code.to_string(), agent.clone());
        Some(agent)
    }

    /// Evict the least recently used agent
    fn evict_lru(&mut self) {
        // For now, just remove the first agent
        // In production, this would track LRU and properly evict
        if let Some(key) = self.loaded_agents.keys().next().cloned() {
            self.loaded_agents.remove(&key);
        }
    }

    /// Preload a set of agents
    pub async fn preload(&mut self, feature_codes: &[String]) {
        for code in feature_codes {
            if !self.loaded_agents.contains_key(code) {
                self.load_agent(code).await;
            }
        }
    }

    /// Get the number of loaded agents
    pub fn loaded_count(&self) -> usize {
        self.loaded_agents.len()
    }

    /// Get all loaded agent IDs
    pub fn loaded_agent_ids(&self) -> Vec<String> {
        self.loaded_agents.keys().cloned().collect()
    }
}
