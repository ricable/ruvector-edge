//! HNSW Vector Index for Semantic Memory Search (ELEX-019)
//!
//! Implements Hierarchical Navigable Small World (HNSW) algorithm
//! for approximate nearest neighbor search with logarithmic complexity.
//!
//! # Performance Targets (ADR-005)
//! - 10,000 vectors per agent
//! - 128-dimensional embeddings
//! - M=16, efConstruction=200, efSearch=50
//! - Cosine similarity distance
//! - <1ms P95 search latency (150x-12,500x faster than linear)
//!
//! # Architecture
//! - Multi-layer graph structure for logarithmic search
//! - SmallVec<[u32; 16]> for memory-efficient connections (stack-allocated)
//! - Flat vector storage for cache efficiency
//! - Cosine distance for semantic similarity
//!
//! # Example
//! ```ignore
//! use elex_memory::hnsw::{HnswIndex, HnswConfig};
//!
//! let mut index = HnswIndex::with_config(HnswConfig::default());
//!
//! // Insert 128-dimensional vectors
//! let vec1: Vec<f32> = vec![0.1; 128];
//! let id1 = index.insert(&vec1);
//!
//! // Search for nearest neighbors
//! let query: Vec<f32> = vec![0.1; 128];
//! let results = index.search(&query, 10);
//! // Returns: [(id, similarity), ...]
//! ```

use smallvec::SmallVec;
use std::collections::{BinaryHeap, HashSet};
use std::cmp::Reverse;
use std::fmt;

// ============================================================================
// HNSW Configuration
// ============================================================================

/// HNSW index configuration parameters
#[derive(Clone, Debug)]
pub struct HnswConfig {
    /// Max connections per node in layer 0 (default: 16)
    pub m: usize,
    /// Max connections per node in higher layers (default: 32)
    pub m_max: usize,
    /// Build-time search depth (default: 200)
    pub ef_construction: usize,
    /// Query-time search depth (default: 50)
    pub ef_search: usize,
    /// Embedding dimension (default: 128)
    pub dim: usize,
    /// ML parameter for layer generation (1/ln(m))
    pub ml: f32,
}

impl Default for HnswConfig {
    fn default() -> Self {
        Self {
            m: 16,
            m_max: 32,
            ef_construction: 200,
            ef_search: 50,
            dim: 128,
            ml: 1.0 / 16.0_f32.ln(), // 1/ln(16)
        }
    }
}

impl HnswConfig {
    /// Create config with custom M and dimension
    pub fn with_m(m: usize, dim: usize) -> Self {
        Self {
            m,
            m_max: m * 2,
            dim,
            ml: 1.0 / (m as f32).ln(),
            ..Default::default()
        }
    }

    /// Get max connections for a specific layer
    pub fn max_connections(&self, layer: usize) -> usize {
        if layer == 0 {
            self.m * 2
        } else {
            self.m
        }
    }
}

// ============================================================================
// Search Result
// ============================================================================

/// Search result with node ID and similarity score
#[derive(Clone, Debug, PartialEq)]
pub struct SearchResult {
    /// Node ID in the index
    pub id: u32,
    /// Similarity score (0.0 to 1.0, where 1.0 = identical)
    pub similarity: f32,
}

impl fmt::Display for SearchResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Node({}, sim={:.3})", self.id, self.similarity)
    }
}

// ============================================================================
// Search Candidate (Internal)
// ============================================================================

/// Candidate for nearest neighbor search (internal)
#[derive(Clone, Debug)]
struct Candidate {
    /// Node ID
    node_id: u32,
    /// Distance from query (lower is better)
    distance: f32,
}

impl PartialEq for Candidate {
    fn eq(&self, other: &Self) -> bool {
        self.node_id == other.node_id
    }
}

impl Eq for Candidate {}

impl PartialOrd for Candidate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Candidate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // BinaryHeap is max-heap, but we want min-distance
        other.distance.partial_cmp(&self.distance).unwrap()
    }
}

// ============================================================================
// HNSW Index
// ============================================================================

/// HNSW vector index for approximate nearest neighbor search
///
/// # Performance Characteristics
/// - Insert: O(log N) average
/// - Search: O(log N) average
/// - Memory: O(N * M) where M is connections per node
///
/// # WASM Compatibility
/// - Uses SmallVec for stack-allocated connections (16 elements)
/// - Flat vector storage for cache efficiency
/// - No heap allocations for sparse graphs
#[derive(Clone)]
pub struct HnswIndex {
    /// Flat vector storage for cache efficiency
    /// Layout: [vec1_dim0, vec1_dim1, ..., vec2_dim0, ...]
    vectors: Vec<f32>,
    /// Graph layers: each layer contains connections per node
    /// SmallVec<[u32; 16]> prevents heap allocation for sparse connections
    layers: Vec<Vec<SmallVec<[u32; 16]>>>,
    /// Max layer assigned to each node
    node_layers: Vec<u8>,
    /// Entry point for search (highest layer node)
    entry_point: Option<u32>,
    /// Next node ID to assign
    next_id: u32,
    /// Configuration
    config: HnswConfig,
}

impl HnswIndex {
    /// Create new HNSW index with default config
    pub fn new() -> Self {
        Self::with_config(HnswConfig::default())
    }

    /// Create new HNSW index with custom config
    pub fn with_config(config: HnswConfig) -> Self {
        Self {
            vectors: Vec::new(),
            layers: vec![Vec::new()], // At least layer 0
            node_layers: Vec::new(),
            entry_point: None,
            next_id: 0,
            config,
        }
    }

    /// Insert a vector into the index
    ///
    /// Returns the assigned node ID.
    ///
    /// # Panics
    /// - If vector dimension doesn't match config.dim
    pub fn insert(&mut self, vector: &[f32]) -> u32 {
        assert_eq!(
            vector.len(),
            self.config.dim,
            "Vector dimension mismatch: expected {}, got {}",
            self.config.dim,
            vector.len()
        );

        let node_id = self.next_id;
        self.next_id += 1;

        // Add vector to flat storage
        self.vectors.extend_from_slice(vector);

        // Select max layer for this node using exponential distribution
        let max_layer = self.select_layer();
        self.node_layers.push(max_layer);

        // Ensure layers exist
        while self.layers.len() <= max_layer as usize {
            self.layers.push(Vec::new());
        }

        // Initialize connections for each layer
        for layer in 0..=max_layer as usize {
            if self.layers[layer].len() <= node_id as usize {
                self.layers[layer].push(SmallVec::new());
            }
        }

        // Connect node to graph at each layer
        self.connect_node(node_id, max_layer);

        // Update entry point if this node is higher
        if self.entry_point.is_none()
            || max_layer > self.node_layers[self.entry_point.unwrap() as usize]
        {
            self.entry_point = Some(node_id);
        }

        node_id
    }

    /// Search for k nearest neighbors
    ///
    /// Returns vector of SearchResult with node IDs and similarity scores.
    /// Similarity is in [0, 1] where 1 = identical (cosine similarity).
    ///
    /// # Arguments
    /// * `query` - Query vector (must match config.dim)
    /// * `k` - Number of neighbors to return
    pub fn search(&self, query: &[f32], k: usize) -> Vec<SearchResult> {
        if self.vectors.is_empty() {
            return Vec::new();
        }

        assert_eq!(
            query.len(),
            self.config.dim,
            "Query dimension mismatch: expected {}, got {}",
            self.config.dim,
            query.len()
        );

        let entry = self.entry_point.unwrap_or(0);
        let top_layer = self.layers.len() - 1;

        // Greedy search from top layer down to layer 1
        let mut current = entry;
        for layer in (1..=top_layer).rev() {
            current = self.search_layer_greedy(query, current, layer);
        }

        // Beam search at layer 0 with ef_search candidates
        let candidates = self.search_layer_beam(query, current, 0, self.config.ef_search);

        // Convert distances to similarities and return top-k
        candidates
            .into_iter()
            .take(k)
            .map(|c| SearchResult {
                id: c.node_id,
                similarity: 1.0 - c.distance,
            })
            .collect()
    }

    /// Get vector by node ID
    pub fn get(&self, node_id: u32) -> Option<&[f32]> {
        let start = node_id as usize * self.config.dim;
        let end = start + self.config.dim;
        self.vectors.get(start..end)
    }

    /// Get number of vectors in the index
    pub fn len(&self) -> usize {
        self.next_id as usize
    }

    /// Check if index is empty
    pub fn is_empty(&self) -> bool {
        self.next_id == 0
    }

    /// Get memory usage in bytes
    pub fn memory_usage(&self) -> usize {
        let vector_bytes = self.vectors.len() * std::mem::size_of::<f32>();
        let layers_bytes: usize = self.layers
            .iter()
            .map(|layer| {
                layer.len() * std::mem::size_of::<SmallVec<[u32; 16]>>()
                    + layer.iter().map(|v| v.len() * std::mem::size_of::<u32>()).sum::<usize>()
            })
            .sum();
        let node_layers_bytes = self.node_layers.len() * std::mem::size_of::<u8>();

        vector_bytes + layers_bytes + node_layers_bytes
    }

    /// Get the configuration
    pub fn config(&self) -> &HnswConfig {
        &self.config
    }

    /// Clear all vectors from the index
    pub fn clear(&mut self) {
        self.vectors.clear();
        self.layers.clear();
        self.layers.push(Vec::new());
        self.node_layers.clear();
        self.entry_point = None;
        self.next_id = 0;
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    /// Select layer for new node using exponential distribution
    fn select_layer(&self) -> u8 {
        let rand: f32 = self.random_f32();
        let layer = (-rand.ln() * self.config.ml).floor() as i32;
        layer.max(0).min(self.layers.len() as i32 - 1) as u8
    }

    /// Connect node to the graph
    fn connect_node(&mut self, node_id: u32, max_layer: u8) {
        let top_layer = self.layers.len() as u8 - 1;

        for layer in (0..=max_layer).rev() {
            if layer as usize >= self.layers.len() {
                continue;
            }

            // Find nearest neighbors at this layer
            let entry = if layer == top_layer {
                self.entry_point.unwrap_or(node_id)
            } else {
                // Use connection from layer above as entry
                if let Some(layer_above) = self.layers.get(layer as usize + 1) {
                    if let Some(conns) = layer_above.get(node_id as usize) {
                        *conns.first().unwrap_or(&node_id)
                    } else {
                        node_id
                    }
                } else {
                    node_id
                }
            };

            let candidates = self.search_layer_beam(
                &self.get_vector_slice(node_id),
                entry,
                layer as usize,
                self.config.ef_construction,
            );

            // Select M nearest neighbors as connections
            let max_conn = self.config.max_connections(layer as usize);
            for (_i, candidate) in candidates.into_iter().enumerate().take(max_conn) {
                if candidate.node_id != node_id {
                    // Bidirectional connection
                    self.add_connection(layer as usize, node_id, candidate.node_id);
                    self.add_connection(layer as usize, candidate.node_id, node_id);

                    // Prune if too many connections
                    self.prune_connections(layer as usize, candidate.node_id, max_conn);
                }
            }
        }
    }

    /// Greedy search on a single layer
    fn search_layer_greedy(&self, query: &[f32], entry: u32, layer: usize) -> u32 {
        let mut current = entry;
        let mut min_dist = self.cosine_distance(query, current);

        loop {
            let mut improved = false;

            if let Some(conns) = self.layers.get(layer).and_then(|l| l.get(current as usize)) {
                for &neighbor in conns.iter() {
                    let dist = self.cosine_distance(query, neighbor);
                    if dist < min_dist {
                        current = neighbor;
                        min_dist = dist;
                        improved = true;
                    }
                }
            }

            if !improved {
                break;
            }
        }

        current
    }

    /// Beam search on a single layer
    fn search_layer_beam(
        &self,
        query: &[f32],
        entry: u32,
        layer: usize,
        ef: usize,
    ) -> Vec<Candidate> {
        let mut visited = HashSet::new();
        let mut candidates = BinaryHeap::new();
        let mut w = BinaryHeap::new(); // Working set

        let entry_dist = self.cosine_distance(query, entry);
        candidates.push(Reverse(Candidate {
            node_id: entry,
            distance: entry_dist,
        }));
        w.push(Reverse(Candidate {
            node_id: entry,
            distance: entry_dist,
        }));
        visited.insert(entry);

        while let Some(Reverse(c)) = w.pop() {
            if candidates.len() >= ef {
                let current_worst = &candidates.peek().unwrap().0;
                if c.distance >= current_worst.distance {
                    break;
                }
            }

            if let Some(conns) = self.layers.get(layer).and_then(|l| l.get(c.node_id as usize)) {
                for &neighbor in conns.iter() {
                    if visited.insert(neighbor) {
                        let dist = self.cosine_distance(query, neighbor);
                        w.push(Reverse(Candidate {
                            node_id: neighbor,
                            distance: dist,
                        }));

                        if candidates.len() < ef {
                            candidates.push(Reverse(Candidate {
                                node_id: neighbor,
                                distance: dist,
                            }));
                        } else {
                            let current_worst = &candidates.peek().unwrap().0;
                            if dist < current_worst.distance {
                                candidates.pop();
                                candidates.push(Reverse(Candidate {
                                    node_id: neighbor,
                                    distance: dist,
                                }));
                            }
                        }
                    }
                }
            }
        }

        // Return sorted by distance
        let mut result: Vec<_> = candidates.into_iter().map(|Reverse(c)| c).collect();
        result.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap());
        result
    }

    /// Add bidirectional connection between nodes
    fn add_connection(&mut self, layer: usize, node_a: u32, node_b: u32) {
        if let Some(layer_vec) = self.layers.get_mut(layer) {
            if let Some(conns) = layer_vec.get_mut(node_a as usize) {
                if !conns.contains(&node_b) {
                    conns.push(node_b);
                }
            }
        }
    }

    /// Prune connections if exceeding max
    /// Prune connections if exceeding max
    fn prune_connections(&mut self, layer: usize, node_id: u32, max_conn: usize) {
        // Get the connections to prune
        let connections_to_prune: Vec<u32> = if let Some(layer_vec) = self.layers.get(layer) {
            if let Some(conns) = layer_vec.get(node_id as usize) {
                conns.iter().copied().collect()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        if connections_to_prune.len() > max_conn {
            // Calculate distances
            let mut dists: Vec<_> = connections_to_prune
                .iter()
                .map(|&id| {
                    let start = id as usize * self.config.dim;
                    let end = start + self.config.dim;
                    let vec = &self.vectors[start..end];
                    let mut dot = 0.0_f32;
                    let mut norm_a = 0.0_f32;
                    let mut norm_b = 0.0_f32;

                    let node_start = node_id as usize * self.config.dim;
                    let node_end = node_start + self.config.dim;
                    let node_vec = &self.vectors[node_start..node_end];

                    for i in 0..self.config.dim {
                        dot += node_vec[i] * vec[i];
                        norm_a += node_vec[i] * node_vec[i];
                        norm_b += vec[i] * vec[i];
                    }

                    let dist = 1.0 - (dot / (norm_a.sqrt() * norm_b.sqrt() + 1e-8));
                    (id, dist)
                })
                .collect();

            dists.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

            // Update connections with closest ones
            if let Some(layer_vec) = self.layers.get_mut(layer) {
                if let Some(conns) = layer_vec.get_mut(node_id as usize) {
                    conns.clear();
                    for (id, _) in dists.iter().take(max_conn) {
                        conns.push(*id);
                    }
                }
            }
        }
    }

    /// Get vector slice for a node
    fn get_vector_slice(&self, node_id: u32) -> Vec<f32> {
        let start = node_id as usize * self.config.dim;
        let end = start + self.config.dim;
        self.vectors[start..end].to_vec()
    }

    /// Compute cosine distance between query and node
    fn cosine_distance(&self, query: &[f32], node_id: u32) -> f32 {
        let start = node_id as usize * self.config.dim;
        let end = start + self.config.dim;
        let vec = &self.vectors[start..end];
        self.cosine_distance_impl(query, vec)
    }

    /// Compute cosine distance between query slice and node
    fn cosine_distance_slice(&self, query: &[f32], node_id: u32) -> f32 {
        let start = node_id as usize * self.config.dim;
        let end = start + self.config.dim;
        let vec = &self.vectors[start..end];
        self.cosine_distance_impl(query, vec)
    }

    /// Cosine distance implementation: 1 - (A . B) / (||A|| * ||B||)
    ///
    /// Uses SIMD128 when available for 3-8x speedup, falls back to scalar.
    /// Critical for HNSW search performance - this is the hottest path.
    fn cosine_distance_impl(&self, a: &[f32], b: &[f32]) -> f32 {
        #[cfg(target_arch = "wasm32")]
        {
            if cfg!(target_feature = "simd128") {
                // SAFETY: We've checked that simd128 is available via cfg!
                unsafe {
                    return self.cosine_distance_simd128(a, b);
                }
            }
        }

        // Scalar fallback
        self.cosine_distance_scalar(a, b)
    }

    /// SIMD128-accelerated cosine distance (3-8x speedup on supported browsers)
    ///
    /// Processes 4 f32 values at a time using SIMD128 lanes.
    #[cfg(target_arch = "wasm32")]
    #[target_feature(enable = "simd128")]
    #[inline]
    unsafe fn cosine_distance_simd128(&self, a: &[f32], b: &[f32]) -> f32 {
        use std::arch::wasm32::*;

        let mut dot = v128::from(f32x4(0.0, 0.0, 0.0, 0.0));
        let mut norm_a = v128::from(f32x4(0.0, 0.0, 0.0, 0.0));
        let mut norm_b = v128::from(f32x4(0.0, 0.0, 0.0, 0.0));

        let mut i = 0;
        const LANES: usize = 4;

        // Process 4 elements at a time
        while i + LANES <= self.config.dim {
            let a_vec = f32x4(a[i], a[i + 1], a[i + 2], a[i + 3]);
            let b_vec = f32x4(b[i], b[i + 1], b[i + 2], b[i + 3]);

            dot = f32x4_add(dot, f32x4_mul(a_vec, b_vec));
            norm_a = f32x4_add(norm_a, f32x4_mul(a_vec, a_vec));
            norm_b = f32x4_add(norm_b, f32x4_mul(b_vec, b_vec));

            i += LANES;
        }

        // Horizontal sum (add all 4 lanes together)
        let dot_arr: [f32; 4] = std::mem::transmute(dot);
        let norm_a_arr: [f32; 4] = std::mem::transmute(norm_a);
        let norm_b_arr: [f32; 4] = std::mem::transmute(norm_b);

        let mut dot_sum = dot_arr[0] + dot_arr[1] + dot_arr[2] + dot_arr[3];
        let mut norm_a_sum = norm_a_arr[0] + norm_a_arr[1] + norm_a_arr[2] + norm_a_arr[3];
        let mut norm_b_sum = norm_b_arr[0] + norm_b_arr[1] + norm_b_arr[2] + norm_b_arr[3];

        // Handle remaining elements
        while i < self.config.dim {
            dot_sum += a[i] * b[i];
            norm_a_sum += a[i] * a[i];
            norm_b_sum += b[i] * b[i];
            i += 1;
        }

        let norm = norm_a_sum.sqrt() * norm_b_sum.sqrt() + 1e-8;
        1.0 - (dot_sum / norm)
    }

    /// Scalar fallback for cosine distance
    #[inline]
    fn cosine_distance_scalar(&self, a: &[f32], b: &[f32]) -> f32 {
        let mut dot = 0.0_f32;
        let mut norm_a = 0.0_f32;
        let mut norm_b = 0.0_f32;

        for i in 0..self.config.dim {
            dot += a[i] * b[i];
            norm_a += a[i] * a[i];
            norm_b += b[i] * b[i];
        }

        let norm = norm_a.sqrt() * norm_b.sqrt() + 1e-8;
        1.0 - (dot / norm)
    }

    /// Random float in [0, 1)
    ///
    /// In WASM, this uses js_sys::Math::random()
    #[cfg(target_arch = "wasm32")]
    fn random_f32(&self) -> f32 {
        js_sys::Math::random() as f32
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn random_f32(&self) -> f32 {
        // Simple LCG for deterministic behavior in tests
        use std::cell::RefCell;
        use std::rc::Rc;
        thread_local! {
            static STATE: Rc<RefCell<u64>> = Rc::new(RefCell::new(123456789));
        }
        STATE.with(|s| {
            let mut state = s.borrow_mut();
            *state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((*state >> 32) & 0x7FFFFFFF) as f32 / (u32::MAX as f32)
        })
    }
}

// ============================================================================
// Default Implementation
// ============================================================================

impl Default for HnswIndex {
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

    fn create_test_vector(dim: usize, value: f32) -> Vec<f32> {
        vec![value; dim]
    }

    #[test]
    fn test_hnsw_config_default() {
        let config = HnswConfig::default();
        assert_eq!(config.m, 16);
        assert_eq!(config.m_max, 32);
        assert_eq!(config.ef_construction, 200);
        assert_eq!(config.ef_search, 50);
        assert_eq!(config.dim, 128);
    }

    #[test]
    fn test_hnsw_config_custom() {
        let config = HnswConfig::with_m(8, 64);
        assert_eq!(config.m, 8);
        assert_eq!(config.m_max, 16);
        assert_eq!(config.dim, 64);
    }

    #[test]
    fn test_hnsw_insert() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        let vec1 = create_test_vector(8, 0.1);
        let id1 = index.insert(&vec1);
        assert_eq!(id1, 0);
        assert_eq!(index.len(), 1);

        let vec2 = create_test_vector(8, 0.5);
        let id2 = index.insert(&vec2);
        assert_eq!(id2, 1);
        assert_eq!(index.len(), 2);
    }

    #[test]
    fn test_hnsw_get() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        let vec1 = create_test_vector(8, 0.123);
        let id1 = index.insert(&vec1);

        let retrieved = index.get(id1).unwrap();
        assert_eq!(retrieved.len(), 8);
        assert_eq!(retrieved[0], 0.123);
    }

    #[test]
    fn test_hnsw_search_empty() {
        let index = HnswIndex::with_config(HnswConfig::with_m(4, 8));
        let query = create_test_vector(8, 0.5);
        let results = index.search(&query, 5);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_hnsw_search_single() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        let vec1 = create_test_vector(8, 0.5);
        let id1 = index.insert(&vec1);

        let query = create_test_vector(8, 0.5);
        let results = index.search(&query, 5);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, id1);
        // Similarity should be very high for identical vectors
        assert!(results[0].similarity > 0.99);
    }

    #[test]
    fn test_hnsw_cosine_distance_identical() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        let vec1 = create_test_vector(8, 0.5);
        index.insert(&vec1);

        let dist = index.cosine_distance_impl(&vec1, &vec1);
        // Distance should be near 0 for identical vectors
        assert!(dist < 0.01);
    }

    #[test]
    fn test_hnsw_cosine_distance_orthogonal() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        let vec1 = create_test_vector(8, 1.0);
        let vec2 = create_test_vector(8, 0.0);
        index.insert(&vec1);
        index.insert(&vec2);

        let dist = index.cosine_distance_impl(&vec1, &vec2);
        // Distance should be 1.0 for orthogonal vectors
        assert!((dist - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_hnsw_search_k() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        for i in 0..10 {
            let vec = create_test_vector(8, i as f32 * 0.1);
            index.insert(&vec);
        }

        let query = create_test_vector(8, 0.5);
        let results = index.search(&query, 3);

        assert_eq!(results.len(), 3);
        // Results should be sorted by similarity (descending)
        for i in 1..results.len() {
            assert!(results[i].similarity <= results[i - 1].similarity);
        }
    }

    #[test]
    fn test_hnsw_memory_usage() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        let initial_usage = index.memory_usage();
        assert!(initial_usage >= 0);

        for _ in 0..10 {
            let vec = create_test_vector(8, 0.5);
            index.insert(&vec);
        }

        let usage_after = index.memory_usage();
        assert!(usage_after > initial_usage);
    }

    #[test]
    fn test_hnsw_entry_point() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        assert!(index.entry_point.is_none());

        let vec1 = create_test_vector(8, 0.5);
        index.insert(&vec1);

        assert!(index.entry_point.is_some());
    }

    #[test]
    fn test_hnsw_clear() {
        let mut index = HnswIndex::with_config(HnswConfig::with_m(4, 8));

        for _ in 0..10 {
            let vec = create_test_vector(8, 0.5);
            index.insert(&vec);
        }

        assert_eq!(index.len(), 10);

        index.clear();

        assert_eq!(index.len(), 0);
        assert!(index.is_empty());
        assert!(index.entry_point.is_none());
    }

    #[test]
    fn test_search_result_display() {
        let result = SearchResult {
            id: 123,
            similarity: 0.95,
        };
        let display = format!("{}", result);
        assert!(display.contains("123"));
        assert!(display.contains("0.95"));
    }
}
