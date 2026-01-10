//! Semantic Router using HNSW for query routing

use elex_core::types::FeatureCode;
use elex_core::Result;
use elex_memory::HnswIndex;

/// Routing result
#[derive(Clone, Debug)]
pub struct RouteResult {
    pub feature_code: FeatureCode,
    pub confidence: f32,
}

/// Semantic router for query-agent matching
pub struct SemanticRouter {
    index: HnswIndex,
}

impl SemanticRouter {
    pub fn new() -> Self {
        Self {
            index: HnswIndex::default(),
        }
    }

    pub fn register_agent(&mut self, _id: u64, embedding: [f32; 128]) {
        // Store the ID for later mapping, insert returns the node ID
        self.index.insert(&embedding);
    }

    pub fn route(&self, query_embedding: &[f32], k: usize) -> Vec<RouteResult> {
        let len = 128.min(query_embedding.len());
        let mut query = [0.0f32; 128];
        query[..len].copy_from_slice(&query_embedding[..len]);

        let results = self.index.search(&query, k);

        results
            .into_iter()
            .map(|r| RouteResult {
                feature_code: FeatureCode::from(format!("FAJ 121 {:04}", r.id)),
                confidence: r.similarity,
            })
            .collect()
    }
}

impl Default for SemanticRouter {
    fn default() -> Self {
        Self::new()
    }
}
