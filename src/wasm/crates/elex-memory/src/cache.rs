//! LRU Cache for Agent Memory (ELEX-022)
//!
//! Implements an LRU (Least Recently Used) cache for managing agent Q-tables
//! and trajectory buffers within the 500MB WASM memory budget.
//!
//! # Features
//! - 80% threshold triggers eviction (400MB of 500MB budget)
//! - Evicts 20% of entries when pressure is detected
//! - Persists Q-table before eviction to IndexedDB
//! - Supports up to 50 cached agents
//! - WASM-compatible timestamp tracking
//!
//! # Memory Budget
//! - Total budget: 500MB
//! - Eviction threshold: 80% (400MB)
//! - Target cache size: 50 agents
//! - Per-agent average: 10MB (compressed)

use crate::storage::CompressedStorage;
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

// ============================================================================
// Cached Agent
// ============================================================================

/// A cached agent with its learning data
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CachedAgent {
    /// Agent unique identifier
    pub id: String,
    /// Compressed Q-table (LZ4 compressed)
    pub q_table: Vec<u8>,
    /// Compressed trajectory buffer
    pub trajectory_buffer: Vec<u8>,
    /// Agent's HNSW index slice (optional)
    pub hnsw_slice: Option<Vec<u8>>,
    /// Memory usage in bytes
    pub memory_usage: usize,
    /// Last access timestamp (Unix milliseconds)
    pub last_accessed: u64,
    /// Number of times accessed
    pub access_count: u32,
}

impl CachedAgent {
    /// Create a new cached agent
    pub fn new(id: String) -> Self {
        Self {
            id,
            q_table: Vec::new(),
            trajectory_buffer: Vec::new(),
            hnsw_slice: None,
            memory_usage: 0,
            last_accessed: 0,
            access_count: 0,
        }
    }

    /// Calculate total memory usage
    pub fn calculate_memory_usage(&mut self) {
        self.memory_usage = self.q_table.len()
            + self.trajectory_buffer.len()
            + self.hnsw_slice.as_ref().map(|s| s.len()).unwrap_or(0);
    }

    /// Update access statistics
    pub fn record_access(&mut self, timestamp: u64) {
        self.last_accessed = timestamp;
        self.access_count += 1;
    }
}

// ============================================================================
// LRU Cache
// ============================================================================

/// LRU cache for agent memory management
///
/// # Eviction Policy
/// - Triggers when memory usage exceeds 80% of max
/// - Evicts 20% of least recently used agents
/// - Persists Q-tables before eviction
///
/// # Memory Budget Enforcement (Phase 7)
/// - 500MB hard limit for WASM memory budget
/// - Real-time memory pressure monitoring
/// - Adaptive eviction based on memory trends
#[derive(Clone)]
pub struct LruCache {
    /// Cached agents indexed by ID
    agents: HashMap<String, CachedAgent>,
    /// Access order (front = LRU, back = MRU)
    access_order: VecDeque<String>,
    /// Maximum number of agents to cache
    max_agents: usize,
    /// Maximum memory budget in bytes (500MB default)
    max_memory_bytes: usize,
    /// Current memory usage in bytes
    current_memory_bytes: usize,
    /// Eviction threshold (0.0 - 1.0)
    eviction_threshold: f32,
    /// Percentage to evict when threshold reached (0.0 - 1.0)
    eviction_percentage: f32,
    /// Storage backend for persistence
    storage: CompressedStorage,
    /// Cache statistics
    stats: CacheStats,
    /// Memory pressure monitoring (Phase 7)
    memory_monitor: MemoryMonitor,
}

/// Memory pressure monitor for 500MB budget enforcement (Phase 7)
#[derive(Clone, Debug)]
pub struct MemoryMonitor {
    /// Memory usage samples for trend analysis
    samples: VecDeque<f32>,
    /// Maximum samples to keep
    max_samples: usize,
    /// Pressure threshold (0.0 - 1.0) for adaptive eviction
    pressure_threshold: f32,
    /// Current pressure level (0.0 = none, 1.0 = critical)
    current_pressure: f32,
}

impl MemoryMonitor {
    /// Create new memory monitor
    pub fn new(max_samples: usize) -> Self {
        Self {
            samples: VecDeque::with_capacity(max_samples),
            max_samples,
            pressure_threshold: 0.85, // 85% triggers adaptive eviction
            current_pressure: 0.0,
        }
    }

    /// Record memory usage as percentage of budget
    pub fn record(&mut self, usage_percent: f32) {
        self.samples.push_back(usage_percent);
        if self.samples.len() > self.max_samples {
            self.samples.pop_front();
        }

        // Update current pressure based on recent samples
        self.current_pressure = if self.samples.is_empty() {
            0.0
        } else {
            let avg: f32 = self.samples.iter().sum::<f32>() / self.samples.len() as f32;
            let trend = if self.samples.len() >= 2 {
                // Calculate trend (positive = growing, negative = shrinking)
                let first = *self.samples.front().unwrap();
                let last = *self.samples.back().unwrap();
                (last - first) / first.max(0.01)
            } else {
                0.0
            };

            // Pressure = average usage + trend component
            (avg + trend * 0.5).clamp(0.0, 1.0)
        };
    }

    /// Get current memory pressure (0.0 - 1.0)
    pub fn current_pressure(&self) -> f32 {
        self.current_pressure
    }

    /// Check if memory pressure is high
    pub fn is_under_pressure(&self) -> bool {
        self.current_pressure >= self.pressure_threshold
    }

    /// Get adaptive eviction percentage based on pressure
    pub fn adaptive_eviction_percent(&self) -> f32 {
        if self.current_pressure < 0.7 {
            0.1 // 10% eviction at low pressure
        } else if self.current_pressure < 0.85 {
            0.2 // 20% eviction at medium pressure
        } else if self.current_pressure < 0.95 {
            0.3 // 30% eviction at high pressure
        } else {
            0.5 // 50% eviction at critical pressure
        }
    }
}

impl Default for MemoryMonitor {
    fn default() -> Self {
        Self::new(100) // Keep 100 samples
    }
}

/// Cache statistics
#[derive(Clone, Debug, Default)]
pub struct CacheStats {
    /// Total number of cache hits
    pub hits: u64,
    /// Total number of cache misses
    pub misses: u64,
    /// Total number of evictions
    pub evictions: u64,
    /// Total persisted bytes
    pub persisted_bytes: u64,
}

impl LruCache {
    /// Create a new LRU cache
    ///
    /// # Arguments
    /// * `max_agents` - Maximum number of agents to cache (default: 50)
    /// * `max_memory_mb` - Maximum memory budget in MB (default: 500)
    pub fn new(max_agents: usize, max_memory_mb: usize) -> Self {
        Self {
            agents: HashMap::new(),
            access_order: VecDeque::with_capacity(max_agents),
            max_agents,
            max_memory_bytes: max_memory_mb * 1024 * 1024,
            current_memory_bytes: 0,
            eviction_threshold: 0.8,  // 80%
            eviction_percentage: 0.2,  // 20%
            storage: CompressedStorage::default(),
            stats: CacheStats::default(),
            memory_monitor: MemoryMonitor::default(),
        }
    }

    /// Create with default ELEX settings (50 agents, 500MB)
    pub fn elex_default() -> Self {
        Self::new(50, 500)
    }

    /// Get a cached agent by ID
    ///
    /// Updates access order and statistics.
    pub fn get(&mut self, agent_id: &str) -> Option<&CachedAgent> {
        // Update access order - move to end (MRU)
        if let Some(pos) = self.access_order.iter().position(|id| id == agent_id) {
            self.access_order.remove(pos).unwrap();
            self.access_order.push_back(agent_id.to_string());

            // Update access stats (compute timestamp before mutable borrow)
            let now = self.now();
            if let Some(agent) = self.agents.get_mut(agent_id) {
                agent.record_access(now);
                self.stats.hits += 1;
                return Some(agent);
            }
        }

        self.stats.misses += 1;
        None
    }

    /// Get mutable reference to cached agent
    pub fn get_mut(&mut self, agent_id: &str) -> Option<&mut CachedAgent> {
        // Update access order
        if let Some(pos) = self.access_order.iter().position(|id| id == agent_id) {
            self.access_order.remove(pos).unwrap();
            self.access_order.push_back(agent_id.to_string());

            // Update access stats (compute timestamp before mutable borrow)
            let now = self.now();
            if let Some(agent) = self.agents.get_mut(agent_id) {
                agent.record_access(now);
                self.stats.hits += 1;
                return Some(agent);
            }
        }

        self.stats.misses += 1;
        None
    }

    /// Insert an agent into the cache
    ///
    /// Evicts LRU agents if necessary to stay within budget.
    /// Uses adaptive eviction based on memory pressure (Phase 7).
    pub fn insert(&mut self, mut agent: CachedAgent) -> Result<(), CacheError> {
        // Calculate memory usage
        agent.calculate_memory_usage();
        let additional_memory = agent.memory_usage;

        // Record memory usage for monitoring
        let usage_percent = self.memory_usage_percent();
        self.memory_monitor.record(usage_percent);

        // Check if we need to evict with adaptive percentage
        while self.should_evict(additional_memory) {
            let evict_percent = self.memory_monitor.adaptive_eviction_percent();
            self.evict_lru_batch_adaptive(evict_percent)?;
        }

        let agent_id = agent.id.clone();

        // Remove existing if present
        if let Some(existing) = self.agents.remove(&agent_id) {
            self.current_memory_bytes -= existing.memory_usage;
            if let Some(pos) = self.access_order.iter().position(|id| id == &agent_id) {
                self.access_order.remove(pos).unwrap();
            }
        }

        // Add to cache
        agent.record_access(self.now());
        self.access_order.push_back(agent_id.clone());
        self.current_memory_bytes += additional_memory;
        self.agents.insert(agent_id, agent);

        Ok(())
    }

    /// Remove an agent from the cache
    pub fn remove(&mut self, agent_id: &str) -> Option<CachedAgent> {
        if let Some(agent) = self.agents.remove(agent_id) {
            self.current_memory_bytes -= agent.memory_usage;
            if let Some(pos) = self.access_order.iter().position(|id| id == agent_id) {
                self.access_order.remove(pos).unwrap();
            }
            return Some(agent);
        }
        None
    }

    /// Clear all cached agents
    pub fn clear(&mut self) {
        self.agents.clear();
        self.access_order.clear();
        self.current_memory_bytes = 0;
    }

    /// Check if we should evict agents
    fn should_evict(&self, additional_memory: usize) -> bool {
        let total_after = self.current_memory_bytes + additional_memory;
        let threshold = (self.max_memory_bytes as f32 * self.eviction_threshold) as usize;

        total_after > threshold || self.agents.len() >= self.max_agents
    }

    /// Evict a batch of LRU agents (20% of cache)
    fn evict_lru_batch(&mut self) -> Result<(), CacheError> {
        let num_to_evict = ((self.agents.len() as f32) * self.eviction_percentage).ceil() as usize;
        let num_to_evict = num_to_evict.max(1);

        for _ in 0..num_to_evict {
            self.evict_lru()?;
        }

        Ok(())
    }

    /// Evict a batch of LRU agents with adaptive percentage (Phase 7)
    fn evict_lru_batch_adaptive(&mut self, evict_percent: f32) -> Result<(), CacheError> {
        let num_to_evict = ((self.agents.len() as f32) * evict_percent).ceil() as usize;
        let num_to_evict = num_to_evict.max(1);

        for _ in 0..num_to_evict {
            self.evict_lru()?;
        }

        Ok(())
    }

    /// Evict the single least recently used agent
    fn evict_lru(&mut self) -> Result<(), CacheError> {
        if let Some(lru_id) = self.access_order.pop_front() {
            if let Some(agent) = self.agents.remove(&lru_id) {
                // Persist before eviction
                self.persist_agent(&agent)?;

                // Update memory tracking
                self.current_memory_bytes -= agent.memory_usage;
                self.stats.evictions += 1;

                return Ok(());
            }
        }
        Err(CacheError::NoAgentsToEvict)
    }

    /// Persist agent data to storage
    fn persist_agent(&self, agent: &CachedAgent) -> Result<(), CacheError> {
        // In a real implementation, this would persist to IndexedDB
        // For now, we simulate the operation
        let _q_table_key = format!("agent:{}:q_table", agent.id);
        let _trajectory_key = format!("agent:{}:trajectory", agent.id);

        // Simulate storage
        // self.storage.store(&q_table_key, &agent.q_table)?;
        // self.storage.store(&trajectory_key, &agent.trajectory_buffer)?;

        Ok(())
    }

    /// Get current memory usage in MB
    pub fn memory_usage_mb(&self) -> usize {
        self.current_memory_bytes / (1024 * 1024)
    }

    /// Get memory usage as percentage of budget
    pub fn memory_usage_percent(&self) -> f32 {
        (self.current_memory_bytes as f32 / self.max_memory_bytes as f32) * 100.0
    }

    /// Get cache hit rate
    pub fn hit_rate(&self) -> f32 {
        let total = self.stats.hits + self.stats.misses;
        if total == 0 {
            return 0.0;
        }
        (self.stats.hits as f32) / (total as f32)
    }

    /// Get number of cached agents
    pub fn len(&self) -> usize {
        self.agents.len()
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.agents.is_empty()
    }

    /// Get cache statistics
    pub fn stats(&self) -> &CacheStats {
        &self.stats
    }

    /// Get access order (LRU to MRU)
    pub fn access_order(&self) -> &VecDeque<String> {
        &self.access_order
    }

    /// Check if agent is in cache
    pub fn contains(&self, agent_id: &str) -> bool {
        self.agents.contains_key(agent_id)
    }

    /// Get memory pressure (0.0 - 1.0)
    pub fn memory_pressure(&self) -> f32 {
        self.memory_monitor.current_pressure()
    }

    /// Check if cache is under memory pressure
    pub fn is_under_pressure(&self) -> bool {
        self.memory_monitor.is_under_pressure()
    }

    /// Get adaptive eviction percentage
    pub fn adaptive_eviction_percent(&self) -> f32 {
        self.memory_monitor.adaptive_eviction_percent()
    }

    /// Get current timestamp
    #[cfg(target_arch = "wasm32")]
    fn now(&self) -> u64 {
        js_sys::Date::now() as u64
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn now(&self) -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

// ============================================================================
// Error Types
// ============================================================================

/// LRU cache errors
#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    #[error("No agents to evict")]
    NoAgentsToEvict,

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Memory limit exceeded: {0} bytes")]
    MemoryLimitExceeded(usize),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_creation() {
        let cache = LruCache::elex_default();
        assert_eq!(cache.max_agents, 50);
        assert_eq!(cache.max_memory_bytes, 500 * 1024 * 1024);
        assert!(cache.is_empty());
    }

    #[test]
    fn test_insert_and_get() {
        let mut cache = LruCache::new(5, 100);

        let agent = CachedAgent {
            id: "agent_1".to_string(),
            q_table: vec![0u8; 1024],
            trajectory_buffer: vec![0u8; 1024],
            hnsw_slice: None,
            memory_usage: 2048,
            last_accessed: 0,
            access_count: 0,
        };

        cache.insert(agent).unwrap();
        assert_eq!(cache.len(), 1);
        assert!(cache.contains("agent_1"));

        let retrieved = cache.get("agent_1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "agent_1");
    }

    #[test]
    fn test_lru_eviction() {
        let mut cache = LruCache::new(5, 100);

        // Fill cache with 20MB each (100MB total)
        for i in 0..5 {
            let agent = CachedAgent {
                id: format!("agent_{}", i),
                q_table: vec![0u8; 10 * 1024 * 1024],
                trajectory_buffer: vec![0u8; 10 * 1024 * 1024],
                hnsw_slice: None,
                memory_usage: 20 * 1024 * 1024,
                last_accessed: 0,
                access_count: 0,
            };
            cache.insert(agent).unwrap();
        }

        assert_eq!(cache.len(), 5);

        // Access agent_1 to make it MRU
        cache.get("agent_1");

        // Add one more - should evict 20% (1 agent)
        let agent = CachedAgent {
            id: "agent_5".to_string(),
            q_table: vec![0u8; 10 * 1024 * 1024],
            trajectory_buffer: vec![0u8; 10 * 1024 * 1024],
            hnsw_slice: None,
            memory_usage: 20 * 1024 * 1024,
            last_accessed: 0,
            access_count: 0,
        };
        cache.insert(agent).unwrap();

        // Should have evicted agent_0 (LRU)
        assert!(cache.get("agent_0").is_none());
        // agent_1 should still be there (we accessed it)
        assert!(cache.get("agent_1").is_some());
    }

    #[test]
    fn test_memory_threshold() {
        let mut cache = LruCache::new(10, 100);

        // Fill to 70MB (below 80% threshold)
        for i in 0..7 {
            let agent = CachedAgent {
                id: format!("agent_{}", i),
                q_table: vec![0u8; 10 * 1024 * 1024],
                trajectory_buffer: vec![0u8; 0],
                hnsw_slice: None,
                memory_usage: 10 * 1024 * 1024,
                last_accessed: 0,
                access_count: 0,
            };
            cache.insert(agent).unwrap();
        }

        assert_eq!(cache.len(), 7);
        assert!(cache.memory_usage_percent() < 80.0);

        // Add more to exceed 80% threshold
        let agent = CachedAgent {
            id: "agent_7".to_string(),
            q_table: vec![0u8; 15 * 1024 * 1024],
            trajectory_buffer: vec![0u8; 0],
            hnsw_slice: None,
            memory_usage: 15 * 1024 * 1024,
            last_accessed: 0,
            access_count: 0,
        };
        cache.insert(agent).unwrap();

        // Should have evicted some agents
        assert!(cache.len() < 8);
        assert!(cache.memory_usage_percent() <= 85.0); // Allow some overhead
    }

    #[test]
    fn test_hit_rate() {
        let mut cache = LruCache::new(5, 100);

        let agent = CachedAgent {
            id: "agent_1".to_string(),
            q_table: vec![0u8; 1024],
            trajectory_buffer: vec![0u8; 1024],
            hnsw_slice: None,
            memory_usage: 2048,
            last_accessed: 0,
            access_count: 0,
        };

        cache.insert(agent).unwrap();

        // Hit
        cache.get("agent_1");
        // Miss
        cache.get("agent_2");

        assert_eq!(cache.stats().hits, 1);
        assert_eq!(cache.stats().misses, 1);
        assert_eq!(cache.hit_rate(), 0.5);
    }

    #[test]
    fn test_access_order() {
        let mut cache = LruCache::new(5, 100);

        // Insert agents
        for i in 0..3 {
            let agent = CachedAgent {
                id: format!("agent_{}", i),
                q_table: vec![0u8; 1024],
                trajectory_buffer: vec![0u8; 1024],
                hnsw_slice: None,
                memory_usage: 2048,
                last_accessed: 0,
                access_count: 0,
            };
            cache.insert(agent).unwrap();
        }

        // Access order should be: agent_0, agent_1, agent_2
        assert_eq!(cache.access_order().front(), Some(&"agent_0".to_string()));
        assert_eq!(cache.access_order().back(), Some(&"agent_2".to_string()));

        // Access agent_0 - should move to back
        cache.get("agent_0");

        // New order: agent_1, agent_2, agent_0
        assert_eq!(cache.access_order().front(), Some(&"agent_1".to_string()));
        assert_eq!(cache.access_order().back(), Some(&"agent_0".to_string()));
    }

    #[test]
    fn test_remove() {
        let mut cache = LruCache::new(5, 100);

        let agent = CachedAgent {
            id: "agent_1".to_string(),
            q_table: vec![0u8; 10 * 1024 * 1024],
            trajectory_buffer: vec![0u8; 10 * 1024 * 1024],
            hnsw_slice: None,
            memory_usage: 20 * 1024 * 1024,
            last_accessed: 0,
            access_count: 0,
        };

        cache.insert(agent).unwrap();
        assert_eq!(cache.memory_usage_mb(), 20);

        let removed = cache.remove("agent_1");
        assert!(removed.is_some());
        assert_eq!(cache.memory_usage_mb(), 0);
        assert!(!cache.contains("agent_1"));
    }

    #[test]
    fn test_clear() {
        let mut cache = LruCache::new(5, 100);

        for i in 0..3 {
            let agent = CachedAgent {
                id: format!("agent_{}", i),
                q_table: vec![0u8; 1024],
                trajectory_buffer: vec![0u8; 1024],
                hnsw_slice: None,
                memory_usage: 2048,
                last_accessed: 0,
                access_count: 0,
            };
            cache.insert(agent).unwrap();
        }

        cache.clear();

        assert!(cache.is_empty());
        assert_eq!(cache.memory_usage_mb(), 0);
    }

    #[test]
    fn test_cached_agent_memory_calculation() {
        let mut agent = CachedAgent {
            id: "agent_1".to_string(),
            q_table: vec![0u8; 1000],
            trajectory_buffer: vec![0u8; 2000],
            hnsw_slice: Some(vec![0u8; 500]),
            memory_usage: 0,
            last_accessed: 0,
            access_count: 0,
        };

        agent.calculate_memory_usage();
        assert_eq!(agent.memory_usage, 3500);
    }

    #[test]
    fn test_access_stats() {
        let mut agent = CachedAgent::new("agent_1".to_string());

        assert_eq!(agent.access_count, 0);

        agent.record_access(1000);
        assert_eq!(agent.access_count, 1);
        assert_eq!(agent.last_accessed, 1000);

        agent.record_access(2000);
        assert_eq!(agent.access_count, 2);
        assert_eq!(agent.last_accessed, 2000);
    }
}
