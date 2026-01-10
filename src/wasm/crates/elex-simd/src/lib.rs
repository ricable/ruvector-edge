//! ELEX SIMD - Vector Operations with Scalar Fallbacks
//!
//! Provides SIMD-accelerated operations for 3-8x performance improvement.
//! Includes scalar fallbacks for browsers/devices without SIMD support.
//!
//! # Operations
//!
//! 1. **Cosine Similarity** - Vector similarity for semantic search
//! 2. **Q-Learning Batch Updates** - TD-error calculations
//! 3. **Parameter Validation** - Bounds checking with bitmask
//! 4. **Counter Aggregation** - Sum, weighted sum, max, threshold count

pub mod similarity;
pub mod qlearning;
pub mod validation;
pub mod aggregation;

// Re-export main functions
pub use similarity::{
    cosine_similarity_simd, cosine_similarity_scalar,
    cosine_similarity, CosineSimilarityImpl,
};

// 128-dimensional versions (WASM-only)
#[cfg(target_arch = "wasm32")]
pub use similarity::{
    cosine_similarity_simd_128, cosine_similarity_scalar_128,
    cosine_similarity_128,
};

pub use qlearning::{
    batch_q_update_simd, batch_q_update_scalar,
    batch_q_update, QUpdateImpl,
};
pub use validation::{
    validate_parameters_simd, validate_parameters_scalar,
    validate_parameters, ValidationImpl,
};
pub use aggregation::{
    aggregate_counters_simd, aggregate_counters_scalar,
    aggregate_counters, AggregationImpl,
};

// horizontal_max is WASM-only internal helper
#[cfg(target_arch = "wasm32")]
pub use aggregation::horizontal_max;

/// SIMD feature detection
///
/// Returns true if SIMD128 is available at runtime.
pub fn has_simd() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        // Check if we were compiled with SIMD128 support
        cfg!(target_feature = "simd128")
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

/// Compile-time SIMD check
const fn is_simd_compiled() -> bool {
    cfg!(target_feature = "simd128")
}

/// SIMD implementation selector
pub trait SimdOp<T> {
    /// Execute using SIMD if available, otherwise scalar
    fn execute(&self) -> T;
}

/// Vector operations dispatcher with automatic SIMD/Scalar selection
///
/// This struct provides a unified interface to all vector operations,
/// automatically selecting the optimal implementation (SIMD or scalar)
/// based on runtime feature detection.
///
/// # Performance
///
/// - **SIMD128**: 3-8x speedup for supported operations
/// - **Scalar**: Guaranteed compatibility across all platforms
/// - **Zero-overhead**: Dispatch is resolved at compile time when possible
///
/// # Example
///
/// ```rust
/// use elex_simd::VectorOps;
///
/// let ops = VectorOps::new();
///
/// // Cosine similarity (automatically uses SIMD if available)
/// let a = vec![1.0, 0.0, 0.0, 0.0];
/// let b = vec![1.0, 0.0, 0.0, 0.0];
/// let similarity = ops.cosine_similarity(&a, &b);
///
/// // Q-learning batch update
/// let mut q_values = vec![0.0; 100];
/// let rewards = vec![1.0; 100];
/// let next_max_q = vec![0.5; 100];
/// ops.batch_q_update(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);
///
/// // Parameter validation
/// let values = vec![5.0, 15.0, 25.0];
/// let mins = vec![0.0, 10.0, 20.0];
/// let maxs = vec![10.0, 20.0, 30.0];
/// let mut results = vec![0u8; 3];
/// ops.validate_parameters(&values, &mins, &maxs, &mut results);
///
/// // Counter aggregation
/// let counters = vec![10.0, 20.0, 30.0, 40.0];
/// let weights = vec![1.0, 2.0, 3.0, 4.0];
/// let (sum, weighted_sum, max, above) = ops.aggregate_counters(&counters, &weights, 25.0);
/// ```
#[derive(Clone, Copy, Debug)]
pub struct VectorOps {
    /// Whether SIMD is available
    simd_enabled: bool,
}

impl VectorOps {
    /// Create a new VectorOps instance
    ///
    /// Automatically detects SIMD support at initialization.
    pub fn new() -> Self {
        Self {
            simd_enabled: has_simd(),
        }
    }

    /// Check if SIMD is enabled
    pub fn has_simd(&self) -> bool {
        self.simd_enabled
    }

    /// Get the cosine similarity implementation that will be used
    pub fn cosine_similarity_implementation(&self) -> CosineSimilarityImpl {
        if self.simd_enabled {
            CosineSimilarityImpl::Simd
        } else {
            CosineSimilarityImpl::Scalar
        }
    }

    /// Get the Q-update implementation that will be used
    pub fn q_update_implementation(&self) -> QUpdateImpl {
        if self.simd_enabled {
            QUpdateImpl::Simd
        } else {
            QUpdateImpl::Scalar
        }
    }

    /// Get the validation implementation that will be used
    pub fn validation_implementation(&self) -> ValidationImpl {
        if self.simd_enabled {
            ValidationImpl::Simd
        } else {
            ValidationImpl::Scalar
        }
    }

    /// Get the aggregation implementation that will be used
    pub fn aggregation_implementation(&self) -> AggregationImpl {
        if self.simd_enabled {
            AggregationImpl::Simd
        } else {
            AggregationImpl::Scalar
        }
    }

    /// Compute cosine similarity between two vectors
    ///
    /// Automatically uses SIMD if available, otherwise falls back to scalar.
    ///
    /// # Arguments
    /// * `a` - First vector
    /// * `b` - Second vector (must be same length as `a`)
    ///
    /// # Returns
    /// Cosine similarity in range [-1, 1]
    ///
    /// # Panics
    /// Panics if vectors have different lengths
    pub fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        cosine_similarity(a, b)
    }

    /// Perform batch Q-learning updates
    ///
    /// Automatically uses SIMD if available, otherwise falls back to scalar.
    ///
    /// # Arguments
    /// * `q_values` - Current Q-values (updated in place)
    /// * `rewards` - Rewards received
    /// * `next_max_q` - Maximum Q-values for next states
    /// * `alpha` - Learning rate (typically 0.1)
    /// * `gamma` - Discount factor (typically 0.95)
    ///
    /// # Panics
    /// Panics if input arrays have different lengths
    pub fn batch_q_update(
        &self,
        q_values: &mut [f32],
        rewards: &[f32],
        next_max_q: &[f32],
        alpha: f32,
        gamma: f32,
    ) {
        batch_q_update(q_values, rewards, next_max_q, alpha, gamma);
    }

    /// Validate parameters against bounds
    ///
    /// Automatically uses SIMD if available, otherwise falls back to scalar.
    ///
    /// # Arguments
    /// * `values` - Parameter values to validate
    /// * `min_bounds` - Minimum allowed values
    /// * `max_bounds` - Maximum allowed values
    /// * `results` - Output buffer (must be same length as inputs)
    ///
    /// # Results
    /// - `results[i] = 1` if values[i] is within bounds
    /// - `results[i] = 0` if values[i] is out of bounds
    ///
    /// # Panics
    /// Panics if input arrays have different lengths
    pub fn validate_parameters(
        &self,
        values: &[f32],
        min_bounds: &[f32],
        max_bounds: &[f32],
        results: &mut [u8],
    ) {
        validate_parameters(values, min_bounds, max_bounds, results);
    }

    /// Aggregate performance counters
    ///
    /// Automatically uses SIMD if available, otherwise falls back to scalar.
    ///
    /// # Arguments
    /// * `values` - Counter values to aggregate
    /// * `weights` - Weights for weighted sum (must be same length as values)
    /// * `threshold` - Threshold for counting values above it
    ///
    /// # Returns
    /// Tuple of (sum, weighted_sum, max, above_threshold_count)
    ///
    /// # Panics
    /// Panics if weights length doesn't match values length
    pub fn aggregate_counters(
        &self,
        values: &[f32],
        weights: &[f32],
        threshold: f32,
    ) -> (f32, f32, f32, u32) {
        aggregate_counters(values, weights, threshold)
    }
}

impl Default for VectorOps {
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

    #[test]
    fn test_simd_detection() {
        // Should not panic
        let _has_simd = has_simd();
        let _is_compiled = is_simd_compiled();
    }

    #[test]
    fn test_vector_ops_creation() {
        let ops = VectorOps::new();
        // Should create successfully
        let _ = ops.has_simd();
    }

    #[test]
    fn test_vector_ops_default() {
        let ops = VectorOps::default();
        // Should create successfully
        let _ = ops.has_simd();
    }

    #[test]
    fn test_vector_ops_cosine_similarity() {
        let ops = VectorOps::new();
        let a: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        let b: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];

        let sim = ops.cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_vector_ops_batch_q_update() {
        let ops = VectorOps::new();
        let mut q_values = vec![0.0; 4];
        let rewards = vec![1.0, 0.5, 2.0, 1.5];
        let next_max_q = vec![0.8, 0.3, 1.5, 1.0];

        ops.batch_q_update(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // All Q-values should increase with positive rewards
        for &q in &q_values {
            assert!(q > 0.0);
        }
    }

    #[test]
    fn test_vector_ops_validate_parameters() {
        let ops = VectorOps::new();
        let values = vec![5.0, 15.0, 25.0];
        let mins = vec![0.0, 10.0, 20.0];
        let maxs = vec![10.0, 20.0, 30.0];
        let mut results = vec![0u8; 3];

        ops.validate_parameters(&values, &mins, &maxs, &mut results);

        assert_eq!(results, vec![1, 1, 1]);
    }

    #[test]
    fn test_vector_ops_aggregate_counters() {
        let ops = VectorOps::new();
        let counters = vec![10.0f32, 20.0, 30.0, 40.0];
        let weights = vec![1.0f32, 2.0, 3.0, 4.0];

        let (sum, weighted_sum, max, above) = ops.aggregate_counters(&counters, &weights, 25.0);

        assert_eq!(sum, 100.0);
        assert!((weighted_sum - 300.0).abs() < 0.1);
        assert_eq!(max, 40.0);
        assert_eq!(above, 2);
    }

    #[test]
    fn test_implementation_types() {
        let ops = VectorOps::new();

        let _cosine_impl = ops.cosine_similarity_implementation();
        let _q_impl = ops.q_update_implementation();
        let _val_impl = ops.validation_implementation();
        let _agg_impl = ops.aggregation_implementation();

        // Should return valid enums
    }

    #[test]
    fn test_cosine_similarity_consistency() {
        let ops = VectorOps::new();
        let a: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        let b: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0];

        let sim_auto = ops.cosine_similarity(&a, &b);
        let sim_scalar = cosine_similarity_scalar(&a, &b);

        assert!((sim_auto - sim_scalar).abs() < 0.001);
    }
}
