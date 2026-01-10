//! Integration Tests for SIMD/Scalar Fallbacks
//!
//! This test suite verifies that SIMD and scalar implementations produce
//! identical results within floating-point tolerance.
//!
//! Tests include:
//! - Property-based comparisons
//! - Various input sizes (including non-multiple-of-4)
//! - Edge cases (empty, single element, large values)
//! - Consistency across all operations

use elex_simd::*;

const FLOAT_TOLERANCE: f32 = 0.001; // Allow small floating-point differences

/// Helper macro to compare results with tolerance
macro_rules! assert_close {
    ($a:expr, $b:expr, $tol:expr) => {
        let diff = ($a - $b).abs();
        assert!(
            diff < $tol,
            "Values not within tolerance: {} vs {} (diff: {})",
            $a, $b, diff
        );
    };
    ($a:expr, $b:expr, $tol:expr, $($msg:tt)+) => {
        let diff = ($a - $b).abs();
        assert!(
            diff < $tol,
            "{} - Values not within tolerance: {} vs {} (diff: {})",
            format!($($msg)+), $a, $b, diff
        );
    };
}

// ============================================================================
// Cosine Similarity Integration Tests
// ============================================================================

#[test]
fn test_cosine_similarity_simd_vs_scalar_basic() {
    let a: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0];
    let b: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0];

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_close!(scalar, auto, FLOAT_TOLERANCE);
}

#[test]
fn test_cosine_similarity_simd_vs_scalar_128d() {
    // Test with 128-dimensional embeddings (common in ELEX)
    let a: Vec<f32> = (0..128).map(|i| i as f32).collect();
    let b: Vec<f32> = (0..128).map(|i| i as f32).collect();

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_close!(scalar, auto, FLOAT_TOLERANCE);
    assert_close!(scalar, 1.0, FLOAT_TOLERANCE); // Identical vectors
}

#[test]
fn test_cosine_similarity_various_sizes() {
    // Test sizes that are and aren't multiples of 4
    let sizes = vec![1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65];

    for size in sizes {
        let a: Vec<f32> = (0..size).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..size).map(|i| (i as f32) * 2.0).collect();

        let scalar = cosine_similarity_scalar(&a, &b);
        let auto = cosine_similarity(&a, &b);

        assert_close!(
            scalar, auto, FLOAT_TOLERANCE,
            "Failed for size {}",
            size
        );
    }
}

#[test]
fn test_cosine_similarity_edge_cases() {
    // Zero vectors
    let a: Vec<f32> = vec![0.0, 0.0, 0.0, 0.0];
    let b: Vec<f32> = vec![0.0, 0.0, 0.0, 0.0];

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_eq!(scalar, 0.0);
    assert_eq!(auto, 0.0);

    // Opposite vectors
    let a: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0];
    let b: Vec<f32> = vec![-1.0, 0.0, 0.0, 0.0];

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_close!(scalar, auto, FLOAT_TOLERANCE);
    assert_close!(scalar, -1.0, FLOAT_TOLERANCE);

    // Orthogonal vectors
    let a: Vec<f32> = vec![1.0, 0.0, 0.0, 0.0];
    let b: Vec<f32> = vec![0.0, 1.0, 0.0, 0.0];

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_close!(scalar, auto, FLOAT_TOLERANCE);
    assert_close!(scalar, 0.0, FLOAT_TOLERANCE);
}

#[test]
fn test_cosine_similarity_large_values() {
    // Test with large values that might cause overflow
    let a: Vec<f32> = vec![1e6, 1e6, 1e6, 1e6];
    let b: Vec<f32> = vec![1e6, 1e6, 1e6, 1e6];

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_close!(scalar, auto, FLOAT_TOLERANCE);
    assert_close!(scalar, 1.0, 0.01); // Larger tolerance for large values
}

#[test]
fn test_cosine_similarity_small_values() {
    // Test with very small values
    let a: Vec<f32> = vec![1e-6, 1e-6, 1e-6, 1e-6];
    let b: Vec<f32> = vec![1e-6, 1e-6, 1e-6, 1e-6];

    let scalar = cosine_similarity_scalar(&a, &b);
    let auto = cosine_similarity(&a, &b);

    assert_close!(scalar, auto, FLOAT_TOLERANCE);
}

// ============================================================================
// Q-Learning Integration Tests
// ============================================================================

#[test]
fn test_q_update_simd_vs_scalar_basic() {
    let mut q_scalar = vec![0.0f32; 4];
    let mut q_auto = vec![0.0f32; 4];
    let rewards = vec![1.0, 0.5, 2.0, 1.5];
    let next_max_q = vec![0.8, 0.3, 1.5, 1.0];

    batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, 0.1, 0.95);
    batch_q_update(&mut q_auto, &rewards, &next_max_q, 0.1, 0.95);

    for (s, a) in q_scalar.iter().zip(q_auto.iter()) {
        assert_close!(s, a, FLOAT_TOLERANCE);
    }
}

#[test]
fn test_q_update_various_sizes() {
    let sizes = vec![1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 100];

    for size in sizes {
        let mut q_scalar = vec![0.5f32; size];
        let mut q_auto = vec![0.5f32; size];
        let rewards: Vec<f32> = (0..size).map(|i| (i as f32) / 10.0).collect();
        let next_max_q: Vec<f32> = (0..size).map(|i| (i as f32) / 20.0).collect();

        batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, 0.1, 0.95);
        batch_q_update(&mut q_auto, &rewards, &next_max_q, 0.1, 0.95);

        for (idx, (s, a)) in q_scalar.iter().zip(q_auto.iter()).enumerate() {
            assert_close!(
                s, a, FLOAT_TOLERANCE,
                "Failed at index {} for size {}",
                idx, size
            );
        }
    }
}

#[test]
fn test_q_update_negative_rewards() {
    let mut q_scalar = vec![1.0f32; 4];
    let mut q_auto = vec![1.0f32; 4];
    let rewards = vec![-1.0, -0.5, -2.0, -1.5];
    let next_max_q = vec![0.0, 0.0, 0.0, 0.0];

    batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, 0.1, 0.95);
    batch_q_update(&mut q_auto, &rewards, &next_max_q, 0.1, 0.95);

    for (s, a) in q_scalar.iter().zip(q_auto.iter()) {
        assert_close!(*s, *a, FLOAT_TOLERANCE);
        assert!(*s < 1.0, "Q-values should decrease with negative rewards");
    }
}

#[test]
fn test_q_update_zero_alpha() {
    // Alpha = 0 means no learning
    let mut q_scalar = vec![1.0f32; 4];
    let mut q_auto = vec![1.0f32; 4];
    let rewards = vec![10.0, 10.0, 10.0, 10.0];
    let next_max_q = vec![10.0, 10.0, 10.0, 10.0];

    batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, 0.0, 0.95);
    batch_q_update(&mut q_auto, &rewards, &next_max_q, 0.0, 0.95);

    for (s, a) in q_scalar.iter().zip(q_auto.iter()) {
        assert_close!(s, a, FLOAT_TOLERANCE);
        assert_close!(s, 1.0, FLOAT_TOLERANCE, "Q-values should not change");
    }
}

#[test]
fn test_q_update_zero_gamma() {
    // Gamma = 0 means no future reward consideration
    let mut q_scalar = vec![0.0f32; 4];
    let mut q_auto = vec![0.0f32; 4];
    let rewards = vec![1.0, 2.0, 3.0, 4.0];
    let next_max_q = vec![100.0, 100.0, 100.0, 100.0];

    batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, 0.1, 0.0);
    batch_q_update(&mut q_auto, &rewards, &next_max_q, 0.1, 0.0);

    for (s, a) in q_scalar.iter().zip(q_auto.iter()) {
        assert_close!(s, a, FLOAT_TOLERANCE);
    }
}

// ============================================================================
// Parameter Validation Integration Tests
// ============================================================================

#[test]
fn test_validation_simd_vs_scalar_basic() {
    let values = vec![5.0, 15.0, 25.0];
    let mins = vec![0.0, 10.0, 20.0];
    let maxs = vec![10.0, 20.0, 30.0];

    let mut results_scalar = vec![0u8; 3];
    let mut results_auto = vec![0u8; 3];

    validate_parameters_scalar(&values, &mins, &maxs, &mut results_scalar);
    validate_parameters(&values, &mins, &maxs, &mut results_auto);

    assert_eq!(results_scalar, results_auto);
    assert_eq!(results_scalar, vec![1, 1, 1]);
}

#[test]
fn test_validation_various_sizes() {
    let sizes = vec![1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 100];

    for size in sizes {
        let values: Vec<f32> = (0..size).map(|i| i as f32).collect();
        let mins: Vec<f32> = (0..size).map(|i| (i as f32) - 5.0).collect();
        let maxs: Vec<f32> = (0..size).map(|i| (i as f32) + 5.0).collect();

        let mut results_scalar = vec![0u8; size];
        let mut results_auto = vec![0u8; size];

        validate_parameters_scalar(&values, &mins, &maxs, &mut results_scalar);
        validate_parameters(&values, &mins, &maxs, &mut results_auto);

        assert_eq!(
            results_scalar, results_auto,
            "Failed for size {}",
            size
        );
    }
}

#[test]
fn test_validation_boundary_values() {
    // Test inclusive boundaries
    let values = vec![0.0, 10.0, 5.0];
    let mins = vec![0.0, 0.0, 0.0];
    let maxs = vec![10.0, 10.0, 10.0];

    let mut results_scalar = vec![0u8; 3];
    let mut results_auto = vec![0u8; 3];

    validate_parameters_scalar(&values, &mins, &maxs, &mut results_scalar);
    validate_parameters(&values, &mins, &maxs, &mut results_auto);

    assert_eq!(results_scalar, results_auto);
    assert_eq!(results_scalar, vec![1, 1, 1]); // All valid (inclusive)
}

#[test]
fn test_validation_out_of_bounds() {
    let values = vec![5.0, 25.0, 15.0]; // valid, invalid, valid
    let mins = vec![0.0, 10.0, 10.0];
    let maxs = vec![10.0, 20.0, 20.0];

    let mut results_scalar = vec![0u8; 3];
    let mut results_auto = vec![0u8; 3];

    validate_parameters_scalar(&values, &mins, &maxs, &mut results_scalar);
    validate_parameters(&values, &mins, &maxs, &mut results_auto);

    assert_eq!(results_scalar, results_auto);
    assert_eq!(results_scalar, vec![1, 0, 1]);
}

// ============================================================================
// Aggregation Integration Tests
// ============================================================================

#[test]
fn test_aggregation_simd_vs_scalar_basic() {
    let values = vec![10.0f32, 20.0, 30.0, 40.0];
    let weights = vec![1.0f32, 2.0, 3.0, 4.0];

    let scalar = aggregate_counters_scalar(&values, &weights, 25.0);
    let auto = aggregate_counters(&values, &weights, 25.0);

    assert_close!(scalar.0, auto.0, FLOAT_TOLERANCE);
    assert_close!(scalar.1, auto.1, FLOAT_TOLERANCE);
    assert_close!(scalar.2, auto.2, FLOAT_TOLERANCE);
    assert_eq!(scalar.3, auto.3);
}

#[test]
fn test_aggregation_various_sizes() {
    let sizes = vec![1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 100];

    for size in sizes {
        let values: Vec<f32> = (0..size).map(|i| (i as f32) * 10.0).collect();
        let weights: Vec<f32> = (0..size).map(|i| i as f32).collect();

        let scalar = aggregate_counters_scalar(&values, &weights, 50.0);
        let auto = aggregate_counters(&values, &weights, 50.0);

        assert_close!(
            scalar.0, auto.0, FLOAT_TOLERANCE,
            "Sum failed for size {}",
            size
        );
        assert_close!(
            scalar.1, auto.1, FLOAT_TOLERANCE,
            "Weighted sum failed for size {}",
            size
        );
        assert_close!(
            scalar.2, auto.2, FLOAT_TOLERANCE,
            "Max failed for size {}",
            size
        );
        assert_eq!(
            scalar.3, auto.3,
            "Count above threshold failed for size {}",
            size
        );
    }
}

#[test]
fn test_aggregation_edge_cases() {
    // Empty
    let values: Vec<f32> = vec![];
    let weights: Vec<f32> = vec![];

    let scalar = aggregate_counters_scalar(&values, &weights, 10.0);
    let auto = aggregate_counters(&values, &weights, 10.0);

    assert_eq!(scalar.0, auto.0);
    assert_eq!(scalar.0, 0.0);

    // Single element
    let values = vec![42.0f32];
    let weights = vec![1.0f32];

    let scalar = aggregate_counters_scalar(&values, &weights, 25.0);
    let auto = aggregate_counters(&values, &weights, 25.0);

    assert_close!(scalar.0, auto.0, FLOAT_TOLERANCE);
    assert_close!(scalar.2, 42.0, FLOAT_TOLERANCE);
}

#[test]
fn test_aggregation_negative_values() {
    let values = vec![-10.0f32, 0.0, 10.0, 20.0];
    let weights = vec![1.0f32, 1.0, 1.0, 1.0];

    let scalar = aggregate_counters_scalar(&values, &weights, 0.0);
    let auto = aggregate_counters(&values, &weights, 0.0);

    assert_close!(scalar.0, 20.0, FLOAT_TOLERANCE);
    assert_close!(scalar.0, auto.0, FLOAT_TOLERANCE);
    assert_eq!(scalar.3, 2); // 10 and 20
    assert_eq!(scalar.3, auto.3);
}

#[test]
fn test_aggregation_all_below_threshold() {
    let values = vec![1.0f32, 2.0, 3.0, 4.0];
    let weights = vec![1.0f32, 1.0, 1.0, 1.0];

    let scalar = aggregate_counters_scalar(&values, &weights, 100.0);
    let auto = aggregate_counters(&values, &weights, 100.0);

    assert_eq!(scalar.3, 0);
    assert_eq!(auto.3, 0);
}

#[test]
fn test_aggregation_all_above_threshold() {
    let values = vec![100.0f32, 200.0, 300.0];
    let weights = vec![1.0f32, 1.0, 1.0];

    let scalar = aggregate_counters_scalar(&values, &weights, 50.0);
    let auto = aggregate_counters(&values, &weights, 50.0);

    assert_eq!(scalar.3, 3);
    assert_eq!(auto.3, 3);
}

// ============================================================================
// VectorOps Integration Tests
// ============================================================================

#[test]
fn test_vector_ops_dispatcher() {
    let ops = VectorOps::new();

    // Test all operations through dispatcher
    let a = vec![1.0, 0.0, 0.0, 0.0];
    let b = vec![1.0, 0.0, 0.0, 0.0];
    let _sim = ops.cosine_similarity(&a, &b);

    let mut q_values = vec![0.0; 4];
    let rewards = vec![1.0, 0.5, 2.0, 1.5];
    let next_max_q = vec![0.8, 0.3, 1.5, 1.0];
    ops.batch_q_update(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

    let values = vec![5.0, 15.0, 25.0];
    let mins = vec![0.0, 10.0, 20.0];
    let maxs = vec![10.0, 20.0, 30.0];
    let mut results = vec![0u8; 3];
    ops.validate_parameters(&values, &mins, &maxs, &mut results);

    let counters = vec![10.0, 20.0, 30.0, 40.0];
    let weights = vec![1.0, 2.0, 3.0, 4.0];
    let _ = ops.aggregate_counters(&counters, &weights, 25.0);

    // Just verify they run without panicking
    assert!(true);
}

#[test]
fn test_vector_ops_implementation_queries() {
    let ops = VectorOps::new();

    // All should return valid enum values
    let _cosine_impl = ops.cosine_similarity_implementation();
    let _q_impl = ops.q_update_implementation();
    let _val_impl = ops.validation_implementation();
    let _agg_impl = ops.aggregation_implementation();
}

#[test]
fn test_vector_ops_consistency() {
    let ops = VectorOps::new();

    // Verify dispatcher produces same results as direct calls
    let a = vec![1.0, 2.0, 3.0, 4.0];
    let b = vec![2.0, 4.0, 6.0, 8.0];

    let sim_direct = cosine_similarity(&a, &b);
    let sim_dispatcher = ops.cosine_similarity(&a, &b);

    assert_close!(sim_direct, sim_dispatcher, FLOAT_TOLERANCE);
}

// ============================================================================
// Property-Based Tests
// ============================================================================

#[test]
fn test_property_cosine_symmetry() {
    // cosine_similarity(a, b) == cosine_similarity(b, a)
    let a: Vec<f32> = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let b: Vec<f32> = vec![5.0, 4.0, 3.0, 2.0, 1.0];

    let ab = cosine_similarity(&a, &b);
    let ba = cosine_similarity(&b, &a);

    assert_close!(ab, ba, FLOAT_TOLERANCE);
}

#[test]
fn test_property_cosine_range() {
    // Cosine similarity should be in [-1, 1]
    let test_vectors = vec![
        (vec![1.0, 0.0, 0.0], vec![1.0, 0.0, 0.0]),   // Identical: 1.0
        (vec![1.0, 0.0, 0.0], vec![-1.0, 0.0, 0.0]),  // Opposite: -1.0
        (vec![1.0, 0.0, 0.0], vec![0.0, 1.0, 0.0]),   // Orthogonal: 0.0
        (vec![1.0, 2.0, 3.0], vec![4.0, 5.0, 6.0]),   // Arbitrary
    ];

    for (a, b) in test_vectors {
        let sim = cosine_similarity(&a, &b);
        assert!(sim >= -1.0 && sim <= 1.0, "Similarity out of range: {}", sim);
    }
}

#[test]
fn test_property_q_update_monotonicity() {
    // Positive rewards should increase Q-values
    let mut q_values = vec![0.0f32; 10];
    let rewards: Vec<f32> = (0..10).map(|_| 1.0).collect();
    let next_max_q: Vec<f32> = (0..10).map(|_| 0.5).collect();

    let q_before = q_values.clone();
    batch_q_update(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

    for (i, (before, after)) in q_before.iter().zip(q_values.iter()).enumerate() {
        assert!(
            after > before,
            "Q-value at index {} did not increase: {} -> {}",
            i, before, after
        );
    }
}

#[test]
fn test_property_validation_result_range() {
    // Validation results should only be 0 or 1
    let values: Vec<f32> = (0..100).map(|i| i as f32).collect();
    let mins: Vec<f32> = (0..100).map(|i| (i as f32) - 10.0).collect();
    let maxs: Vec<f32> = (0..100).map(|i| (i as f32) + 10.0).collect();
    let mut results = vec![0u8; 100];

    validate_parameters(&values, &mins, &maxs, &mut results);

    for (i, &r) in results.iter().enumerate() {
        assert!(
            r == 0 || r == 1,
            "Invalid result at index {}: {}",
            i, r
        );
    }
}

#[test]
fn test_property_aggregation_monotonicity() {
    // Increasing values should increase sum and max
    let values1 = vec![1.0f32, 2.0, 3.0];
    let values2 = vec![2.0f32, 3.0, 4.0];
    let weights = vec![1.0f32, 1.0, 1.0];

    let result1 = aggregate_counters(&values1, &weights, 0.0);
    let result2 = aggregate_counters(&values2, &weights, 0.0);

    assert!(result2.0 > result1.0);
    assert!(result2.2 > result1.2);
}
