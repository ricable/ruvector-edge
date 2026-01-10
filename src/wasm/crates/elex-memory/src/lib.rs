//! ELEX Memory - HNSW Vector Index and Memory Management
//!
//! This crate provides memory management for the ELEX WASM RAN Optimization SDK.
//!
//! # Features
//! - **HNSW Vector Index** (ELEX-019): Hierarchical Navigable Small World for semantic search
//!   - 150x-12,500x faster than linear search
//!   - <1ms P95 search latency for 10K vectors
//!   - Cosine similarity with 128-dimensional embeddings
//! - **LRU Cache** (ELEX-022): Agent memory management within 500MB WASM budget
//!   - 80% threshold triggers eviction
//!   - IndexedDB persistence before eviction
//!   - Supports up to 50 cached agents
//!
//! # Modules
//! - `hnsw`: HNSW vector index implementation
//! - `cache`: LRU cache for agent memory
//! - `storage`: Compressed storage backend

pub mod hnsw;
pub mod cache;
pub mod storage;

// Re-export HNSW types
pub use hnsw::{
    HnswIndex,
    HnswConfig,
    SearchResult,
};

// Re-export cache types
pub use cache::{
    CachedAgent,
    LruCache,
    CacheError,
    CacheStats,
    MemoryMonitor,
};

// Re-export storage types
pub use storage::{
    CompressedStorage,
    StorageError,
    StorageInfo,
};

// WASM-only re-export
#[cfg(target_arch = "wasm32")]
pub use storage::IndexedDBBackend;

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Cache defaults for ELEX system
pub mod defaults {
    /// Maximum number of cached agents
    pub const MAX_AGENTS: usize = 50;

    /// Maximum memory budget in MB
    pub const MAX_MEMORY_MB: usize = 500;

    /// Eviction threshold (80%)
    pub const EVICTION_THRESHOLD: f32 = 0.8;

    /// Eviction percentage (20%)
    pub const EVICTION_PERCENTAGE: f32 = 0.2;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn test_hnsw_reexports() {
        let config = HnswConfig::default();
        let _index = HnswIndex::with_config(config);
    }

    #[test]
    fn test_cache_reexports() {
        let cache = LruCache::elex_default();
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn test_defaults() {
        assert_eq!(defaults::MAX_AGENTS, 50);
        assert_eq!(defaults::MAX_MEMORY_MB, 500);
        assert_eq!(defaults::EVICTION_THRESHOLD, 0.8);
        assert_eq!(defaults::EVICTION_PERCENTAGE, 0.2);
    }
}
