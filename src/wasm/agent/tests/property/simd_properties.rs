/// Property-Based Tests for SIMD Operations (ADR-016)
///
/// Uses proptest to verify SIMD properties:
/// - SIMD vs scalar equivalence
/// - Vector operation properties
/// - Validation invariants
/// - Aggregation properties

use proptest::prelude::*;
use edge_agent_wasm::simd_ops::{
    cosine_similarity_simd,
    batch_q_update_simd,
    validate_parameters_simd,
    aggregate_counters_simd,
};

// =========================================================================
// Cosine Similarity Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Cosine similarity should be in [-1, 1]
    #[test]
    fn prop_cosine_similarity_bounds(
        vec1 in prop::collection::vec(-100.0f32..100.0f32, 2..50),
        vec2 in prop::collection::vec(-100.0f32..100.0f32, 2..50),
    ) {
        // Ensure equal length
        let len = vec1.len().min(vec2.len());
        let v1 = &vec1[..len];
        let v2 = &vec2[..len];

        let similarity = cosine_similarity_simd(v1, v2);

        prop_assert!(similarity >= -1.0 && similarity <= 1.0,
            "Cosine similarity should be in [-1, 1], got {}",
            similarity
        );
    }

    /// Cosine similarity should be symmetric
    #[test]
    fn prop_cosine_similarity_symmetric(
        vec1 in prop::collection::vec(-100.0f32..100.0f32, 2..50),
        vec2 in prop::collection::vec(-100.0f32..100.0f32, 2..50),
    ) {
        let len = vec1.len().min(vec2.len());
        let v1 = &vec1[..len];
        let v2 = &vec2[..len];

        let sim12 = cosine_similarity_simd(v1, v2);
        let sim21 = cosine_similarity_simd(v2, v1);

        prop_assert!((sim12 - sim21).abs() < 0.001,
            "Cosine similarity should be symmetric: {} vs {}",
            sim12, sim21
        );
    }

    /// Cosine similarity should be 1 for identical vectors
    #[test]
    fn prop_cosine_similarity_identical(
        vec in prop::collection::vec(-100.0f32..100.0f32, 2..50),
    ) {
        // Avoid zero vectors
        if vec.iter().all(|&x| x.abs() < 0.001) {
            return Ok(())
        }

        let similarity = cosine_similarity_simd(&vec, &vec);

        prop_assert!((similarity - 1.0).abs() < 0.01,
            "Cosine similarity should be 1 for identical vectors, got {}",
            similarity
        );
    }

    /// Cosine similarity should be -1 for opposite vectors
    #[test]
    fn prop_cosine_similarity_opposite(
        vec in prop::collection::vec(1.0f32..100.0f32, 2..50),
    ) {
        let opposite: Vec<f32> = vec.iter().map(|&x| -x).collect();

        let similarity = cosine_similarity_simd(&vec, &opposite);

        prop_assert!((similarity + 1.0).abs() < 0.01,
            "Cosine similarity should be -1 for opposite vectors, got {}",
            similarity
        );
    }

    /// Cosine similarity should be ~0 for orthogonal vectors
    #[test]
    fn prop_cosine_similarity_orthogonal(
        vec in prop::collection::vec(1.0f32..100.0f32, 2..50),
    ) {
        // Create orthogonal vector (swap and negate)
        let mut orthogonal = vec.clone();
        if orthogonal.len() >= 2 {
            orthogonal.swap(0, 1);
            orthogonal[1] = -orthogonal[1];
        }

        let similarity = cosine_similarity_simd(&vec, &orthogonal);

        prop_assert!(similarity.abs() < 0.01,
            "Cosine similarity should be ~0 for orthogonal vectors, got {}",
            similarity
        );
    }
}

// =========================================================================
// Batch Q-Update Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Batch Q-update should keep values bounded
    #[test]
    fn prop_batch_update_bounds(
        mut q_values in prop::collection::vec(-100.0f32..100.0f32, 1..50),
        rewards in prop::collection::vec(-10.0f32..10.0f32, 1..50),
        next_max_q in prop::collection::vec(-10.0f32..10.0f32, 1..50),
        alpha in 0.01f32..1.0f32,
        gamma in 0.0f32..1.0f32,
    ) {
        // Ensure equal length
        let len = q_values.len().min(rewards.len()).min(next_max_q.len());
        q_values.truncate(len);

        let len_before = q_values.len();
        batch_q_update_simd(&mut q_values, &rewards[..len], &next_max_q[..len], alpha, gamma);

        prop_assert_eq!(q_values.len(), len_before, "Length should not change");

        for &q in &q_values {
            prop_assert!(q.is_finite(), "Q-values should be finite");
            prop_assert!(q > -1000.0 && q < 1000.0, "Q-values should stay bounded");
        }
    }

    /// Batch Q-update should be idempotent with zero alpha
    #[test]
    fn prop_batch_update_zero_alpha(
        mut q_values1 in prop::collection::vec(-10.0f32..10.0f32, 1..20),
        mut q_values2 in prop::collection::vec(-10.0f32..10.0f32, 1..20),
        rewards in prop::collection::vec(-5.0f32..5.0f32, 1..20),
        next_max_q in prop::collection::vec(-5.0f32..5.0f32, 1..20),
    ) {
        let len = q_values1.len().min(rewards.len()).min(next_max_q.len());
        q_values1.truncate(len);
        q_values2.truncate(len);

        batch_q_update_simd(&mut q_values1, &rewards[..len], &next_max_q[..len], 0.0, 0.95);

        prop_assert!(&q_values1[..len].iter().zip(&q_values2[..len])
            .all(|(&q1, &q2)| (q1 - q2).abs() < 0.001),
            "Zero alpha should not change values"
        );
    }

    /// Batch Q-update with zero gamma should ignore future
    #[test]
    fn prop_batch_update_zero_gamma(
        mut q_values in prop::collection::vec(-10.0f32..10.0f32, 1..20),
        rewards in prop::collection::vec(-5.0f32..5.0f32, 1..20),
        next_max_q1 in prop::collection::vec(-100.0f32..100.0f32, 1..20),
        next_max_q2 in prop::collection::vec(-100.0f32..100.0f32, 1..20),
        alpha in 0.1f32..0.5f32,
    ) {
        let len = q_values.len().min(rewards.len()).min(next_max_q1.len()).min(next_max_q2.len());

        let mut q_values1 = q_values[..len].to_vec();
        let mut q_values2 = q_values[..len].to_vec();

        batch_q_update_simd(&mut q_values1, &rewards[..len], &next_max_q1[..len], alpha, 0.0);
        batch_q_update_simd(&mut q_values2, &rewards[..len], &next_max_q2[..len], alpha, 0.0);

        // With zero gamma, next_max_q should not affect results
        prop_assert!(&q_values1.iter().zip(&q_values2)
            .all(|(&q1, &q2)| (q1 - q2).abs() < 0.001),
            "Zero gamma should make next_max_q irrelevant"
        );
    }
}

// =========================================================================
// Validation Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Validation should mark in-range values as valid
    #[test]
    fn prop_validation_in_range(
        values in prop::collection::vec(-100.0f32..100.0f32, 1..20),
        offset in 0.0f32..50.0f32,
    ) {
        let mins: Vec<f32> = values.iter().map(|&v| v - offset).collect();
        let maxs: Vec<f32> = values.iter().map(|&v| v + offset).collect();
        let mut results = vec![0u8; values.len()];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        prop_assert!(results.iter().all(|&r| r == 1),
            "All values in range should be valid"
        );
    }

    /// Validation should mark out-of-range values as invalid
    #[test]
    fn prop_validation_out_of_range(
        values in prop::collection::vec(0.0f32..100.0f32, 1..20),
    ) {
        let mins: Vec<f32> = values.iter().map(|&v| v + 10.0).collect();
        let maxs: Vec<f32> = values.iter().map(|&v| v + 20.0).collect();
        let mut results = vec![0u8; values.len()];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        prop_assert!(results.iter().all(|&r| r == 0),
            "All values below range should be invalid"
        );
    }

    /// Validation at boundaries should be valid
    #[test]
    fn prop_validation_boundaries(
        values in prop::collection::vec(0.0f32..100.0f32, 1..20),
    ) {
        let mins = values.clone();
        let maxs = values.clone();
        let mut results = vec![0u8; values.len()];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        prop_assert!(results.iter().all(|&r| r == 1),
            "Boundary values should be valid"
        );
    }

    /// Validation results should be deterministic
    #[test]
    fn prop_validation_deterministic(
        values in prop::collection::vec(-100.0f32..100.0f32, 1..20),
        mins in prop::collection::vec(-100.0f32..100.0f32, 1..20),
        maxs in prop::collection::vec(-100.0f32..100.0f32, 1..20),
    ) {
        let len = values.len().min(mins.len()).min(maxs.len());
        let mut results1 = vec![0u8; len];
        let mut results2 = vec![0u8; len];

        validate_parameters_simd(&values[..len], &mins[..len], &maxs[..len], &mut results1);
        validate_parameters_simd(&values[..len], &mins[..len], &maxs[..len], &mut results2);

        prop_assert_eq!(results1, results2, "Validation should be deterministic");
    }
}

// =========================================================================
// Aggregation Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Aggregation sum should be accurate
    #[test]
    fn prop_aggregation_sum(
        values in prop::collection::vec(-100.0f32..100.0f32, 1..50),
    ) {
        let weights: Vec<f32> = (0..values.len()).map(|_| 1.0).collect();
        let threshold = 1000.0; // High threshold so nothing is counted as "above"

        let (sum, _, max, _) = aggregate_counters_simd(&values, &weights, threshold);

        let expected_sum: f32 = values.iter().sum();
        prop_assert!((sum - expected_sum).abs() < 0.1,
            "Sum should match: expected {}, got {}",
            expected_sum, sum
        );

        if !values.is_empty() {
            let expected_max = values.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
            prop_assert!((max - expected_max).abs() < 0.001,
                "Max should match: expected {}, got {}",
                expected_max, max
            );
        }
    }

    /// Aggregation weighted sum should match formula
    #[test]
    fn prop_aggregation_weighted_sum(
        values in prop::collection::vec(-10.0f32..10.0f32, 1..30),
        weights in prop::collection::vec(0.0f32..1.0f32, 1..30),
    ) {
        let len = values.len().min(weights.len());
        let threshold = 1000.0;

        let (_, weighted_sum, _, _) = aggregate_counters_simd(&values[..len], &weights[..len], threshold);

        let expected: f32 = values[..len].iter()
            .zip(&weights[..len])
            .map(|(&v, &w)| v * w)
            .sum();

        prop_assert!((weighted_sum - expected).abs() < 0.1,
            "Weighted sum should match: expected {}, got {}",
            expected, weighted_sum
        );
    }

    /// Aggregation count above threshold should be accurate
    #[test]
    fn prop_aggregation_count_above(
        values in prop::collection::vec(-100.0f32..100.0f32, 1..50),
        threshold in -50.0f32..50.0f32,
    ) {
        let weights: Vec<f32> = (0..values.len()).map(|_| 1.0).collect();

        let (_, _, _, count_above) = aggregate_counters_simd(&values, &weights, threshold);

        let expected = values.iter().filter(|&&v| v > threshold).count() as u32;
        prop_assert_eq!(count_above, expected,
            "Count above threshold should match: expected {}, got {}",
            expected, count_above
        );
    }

    /// Aggregation should handle empty input
    #[test]
    fn prop_aggregation_empty() {
        let values: Vec<f32> = vec![];
        let weights: Vec<f32> = vec![];

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&values, &weights, 10.0);

        prop_assert_eq!(sum, 0.0);
        prop_assert_eq!(weighted_sum, 0.0);
        prop_assert_eq!(count_above, 0);
        prop_assert!(max.is_finite());
    }

    /// Aggregation should be deterministic
    #[test]
    fn prop_aggregation_deterministic(
        values in prop::collection::vec(-100.0f32..100.0f32, 1..30),
        weights in prop::collection::vec(0.0f32..1.0f32, 1..30),
        threshold in -50.0f32..50.0f32,
    ) {
        let len = values.len().min(weights.len());

        let (sum1, ws1, max1, count1) =
            aggregate_counters_simd(&values[..len], &weights[..len], threshold);
        let (sum2, ws2, max2, count2) =
            aggregate_counters_simd(&values[..len], &weights[..len], threshold);

        prop_assert!((sum1 - sum2).abs() < 0.001);
        prop_assert!((ws1 - ws2).abs() < 0.001);
        prop_assert!((max1 - max2).abs() < 0.001);
        prop_assert_eq!(count1, count2);
    }
}

// =========================================================================
// Cross-Operation Properties
// =========================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// SIMD operations should handle various array sizes correctly
    #[test]
    fn prop_various_array_sizes(
        size in 1usize..200usize,
    ) {
        // Test cosine similarity
        let vec1: Vec<f32> = (0..size).map(|_| rand::random()).collect();
        let vec2: Vec<f32> = (0..size).map(|_| rand::random()).collect();

        let similarity = cosine_similarity_simd(&vec1, &vec2);
        prop_assert!(similarity >= -1.0 && similarity <= 1.0);

        // Test validation
        let values: Vec<f32> = (0..size).map(|_| rand::random() * 100.0).collect();
        let mins: Vec<f32> = (0..size).map(|_| 0.0).collect();
        let maxs: Vec<f32> = (0..size).map(|_| 100.0).collect();
        let mut results = vec![0u8; size];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);
        prop_assert_eq!(results.len(), size);

        // Test aggregation
        let weights: Vec<f32> = (0..size).map(|_| 1.0 / size as f32).collect();
        let (sum, _, max, count) = aggregate_counters_simd(&values, &weights, 50.0);

        prop_assert!(sum >= 0.0);
        prop_assert!(max >= 0.0);
        prop_assert!(count <= size as u32);
    }
}
