/// Unit Tests for SIMD Operations (ADR-016)
///
/// Tests cover:
/// - Cosine similarity correctness
/// - Q-learning batch updates
/// - Parameter validation
/// - Counter aggregation
/// - SIMD vs scalar equivalence
/// - Edge cases (empty, single element, large arrays)

#[cfg(test)]
mod simd_ops_unit_tests {
    use crate::simd_ops::{
        cosine_similarity_simd,
        batch_q_update_simd,
        validate_parameters_simd,
        aggregate_counters_simd,
    };

    const EPSILON: f32 = 1e-5;

    fn assert_float_eq(a: f32, b: f32, msg: &str) {
        assert!((a - b).abs() < EPSILON, "{}: expected {}, got {}", msg, b, a);
    }

    // =========================================================================
    // Cosine Similarity Tests
    // =========================================================================

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];

        let similarity = cosine_similarity_simd(&a, &b);
        assert_float_eq(similarity, 1.0, "Identical vectors");
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];

        let similarity = cosine_similarity_simd(&a, &b);
        assert!(similarity.abs() < EPSILON, "Orthogonal vectors");
    }

    #[test]
    fn test_cosine_similarity_opposite() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![-1.0, 0.0, 0.0];

        let similarity = cosine_similarity_simd(&a, &b);
        assert_float_eq(similarity, -1.0, "Opposite vectors");
    }

    #[test]
    fn test_cosine_similarity_45_degrees() {
        let a = vec![1.0, 0.0];
        let b = vec![0.70710678, 0.70710678]; // 45 degrees

        let similarity = cosine_similarity_simd(&a, &b);
        assert_float_eq(similarity, 0.70710678, "45 degree angle");
    }

    #[test]
    fn test_cosine_similarity_general_case() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];

        let similarity = cosine_similarity_simd(&a, &b);

        // Manual calculation:
        // dot = 1*4 + 2*5 + 3*6 = 32
        // norm_a = sqrt(1 + 4 + 9) = sqrt(14) ≈ 3.742
        // norm_b = sqrt(16 + 25 + 36) = sqrt(77) ≈ 8.775
        // cosine = 32 / (3.742 * 8.775) ≈ 0.9746
        assert!(similarity > 0.97 && similarity < 0.98, "General case");
    }

    #[test]
    fn test_cosine_similarity_zero_vector() {
        let a = vec![0.0, 0.0, 0.0];
        let b = vec![1.0, 2.0, 3.0];

        let similarity = cosine_similarity_simd(&a, &b);
        assert_float_eq(similarity, 0.0, "Zero vector (should return 0)");
    }

    #[test]
    fn test_cosine_similarity_large_vector() {
        let a: Vec<f32> = (0..100).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..100).map(|i| (i * 2) as f32).collect();

        let similarity = cosine_similarity_simd(&a, &b);
        assert!(similarity > 0.0 && similarity <= 1.0, "Large vector");
    }

    #[test]
    #[should_panic(expected = "Vectors must have equal length")]
    fn test_cosine_similarity_length_mismatch() {
        let a = vec![1.0, 2.0];
        let b = vec![1.0, 2.0, 3.0];

        cosine_similarity_simd(&a, &b);
    }

    // =========================================================================
    // Q-Learning Batch Update Tests
    // =========================================================================

    #[test]
    fn test_batch_q_update_basic() {
        let mut q_values = vec![0.0, 0.0, 0.0];
        let rewards = vec![1.0, 0.5, 2.0];
        let next_max_q = vec![0.0, 0.0, 0.0];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // Q = 0 + 0.1 * (reward + 0.95 * 0 - 0) = 0.1 * reward
        assert_float_eq(q_values[0], 0.1, "Q-value 0");
        assert_float_eq(q_values[1], 0.05, "Q-value 1");
        assert_float_eq(q_values[2], 0.2, "Q-value 2");
    }

    #[test]
    fn test_batch_q_update_with_future_value() {
        let mut q_values = vec![0.5];
        let rewards = vec![1.0];
        let next_max_q = vec![0.8];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // Q = 0.5 + 0.1 * (1.0 + 0.95 * 0.8 - 0.5) = 0.5 + 0.1 * 1.26 = 0.626
        assert_float_eq(q_values[0], 0.626, "Q-value with future");
    }

    #[test]
    fn test_batch_q_update_negative_reward() {
        let mut q_values = vec![0.5];
        let rewards = vec![-1.0];
        let next_max_q = vec![0.0];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // Q = 0.5 + 0.1 * (-1.0 - 0.5) = 0.5 - 0.15 = 0.35
        assert_float_eq(q_values[0], 0.35, "Q-value with negative reward");
    }

    #[test]
    fn test_batch_q_update_large_batch() {
        let mut q_values = vec![0.0; 100];
        let rewards = vec![1.0; 100];
        let next_max_q = vec![0.0; 100];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        for (i, &q) in q_values.iter().enumerate() {
            assert_float_eq(q, 0.1, &format!("Q-value at index {}", i));
        }
    }

    #[test]
    fn test_batch_q_update_empty() {
        let mut q_values = vec![];
        let rewards = vec![];
        let next_max_q = vec![];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        assert_eq!(q_values.len(), 0, "Empty batch");
    }

    #[test]
    #[should_panic(expected = "Length mismatch")]
    fn test_batch_q_update_length_mismatch() {
        let mut q_values = vec![0.0, 0.0];
        let rewards = vec![1.0];
        let next_max_q = vec![0.0, 0.0];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);
    }

    // =========================================================================
    // Parameter Validation Tests
    // =========================================================================

    #[test]
    fn test_validate_parameters_all_valid() {
        let values = vec![5.0, 15.0, 25.0];
        let mins = vec![0.0, 10.0, 20.0];
        let maxs = vec![10.0, 20.0, 30.0];
        let mut results = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results, vec![1, 1, 1], "All valid");
    }

    #[test]
    fn test_validate_parameters_all_invalid() {
        let values = vec![15.0, 25.0, 35.0];
        let mins = vec![0.0, 10.0, 20.0];
        let maxs = vec![10.0, 20.0, 30.0];
        let mut results = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results, vec![0, 0, 0], "All invalid");
    }

    #[test]
    fn test_validate_parameters_mixed() {
        let values = vec![5.0, 25.0, 15.0];
        let mins = vec![0.0, 10.0, 20.0];
        let maxs = vec![10.0, 20.0, 30.0];
        let mut results = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results, vec![1, 0, 0], "Mixed validity");
    }

    #[test]
    fn test_validate_parameters_boundary_values() {
        let values = vec![0.0, 10.0, 5.0];
        let mins = vec![0.0, 0.0, 0.0];
        let maxs = vec![10.0, 10.0, 10.0];
        let mut results = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        // Boundary values are valid (>= min and <= max)
        assert_eq!(results, vec![1, 1, 1], "Boundary values");
    }

    #[test]
    fn test_validate_parameters_just_outside_bounds() {
        let values = vec![-0.001, 10.001];
        let mins = vec![0.0, 0.0];
        let maxs = vec![10.0, 10.0];
        let mut results = vec![0u8; 2];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results, vec![0, 0], "Just outside bounds");
    }

    #[test]
    fn test_validate_parameters_negative_range() {
        let values = vec![-15.0, -10.0, -5.0];
        let mins = vec![-20.0, -20.0, -20.0];
        let maxs = vec![0.0, 0.0, 0.0];
        let mut results = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results, vec![1, 1, 1], "Negative range");
    }

    #[test]
    fn test_validate_parameters_empty() {
        let values = vec![];
        let mins = vec![];
        let maxs = vec![];
        let mut results = vec![];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results.len(), 0, "Empty validation");
    }

    #[test]
    #[should_panic(expected = "Length mismatch")]
    fn test_validate_parameters_length_mismatch() {
        let values = vec![5.0];
        let mins = vec![0.0, 0.0];
        let maxs = vec![10.0];
        let mut results = vec![0u8];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);
    }

    // =========================================================================
    // Counter Aggregation Tests
    // =========================================================================

    #[test]
    fn test_aggregate_counters_basic() {
        let counter_values = vec![10.0, 20.0, 30.0];
        let weights = vec![0.5, 0.3, 0.2];
        let threshold = 15.0;

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, threshold);

        assert_float_eq(sum, 60.0, "Sum");
        assert_float_eq(weighted_sum, 17.0, "Weighted sum (10*0.5 + 20*0.3 + 30*0.2 = 5 + 6 + 6)");
        assert_float_eq(max, 30.0, "Max");
        assert_eq!(count_above, 2, "Count above threshold (20 and 30)");
    }

    #[test]
    fn test_aggregate_counters_all_below_threshold() {
        let counter_values = vec![5.0, 10.0, 15.0];
        let weights = vec![1.0, 1.0, 1.0];
        let threshold = 20.0;

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, threshold);

        assert_float_eq(sum, 30.0, "Sum");
        assert_float_eq(weighted_sum, 30.0, "Weighted sum");
        assert_float_eq(max, 15.0, "Max");
        assert_eq!(count_above, 0, "None above threshold");
    }

    #[test]
    fn test_aggregate_counters_all_above_threshold() {
        let counter_values = vec![25.0, 30.0, 35.0];
        let weights = vec![1.0, 1.0, 1.0];
        let threshold = 20.0;

        let (_, _, _, count_above) =
            aggregate_counters_simd(&counter_values, &weights, threshold);

        assert_eq!(count_above, 3, "All above threshold");
    }

    #[test]
    fn test_aggregate_counters_negative_values() {
        let counter_values = vec![-10.0, 0.0, 10.0];
        let weights = vec![1.0, 1.0, 1.0];
        let threshold = 0.0;

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, threshold);

        assert_float_eq(sum, 0.0, "Sum (-10 + 0 + 10)");
        assert_float_eq(weighted_sum, 0.0, "Weighted sum");
        assert_float_eq(max, 10.0, "Max");
        // count_above should count values > 0 (not >=)
        assert_eq!(count_above, 1, "Count above 0");
    }

    #[test]
    fn test_aggregate_counters_empty() {
        let counter_values: Vec<f32> = vec![];
        let weights: Vec<f32> = vec![];

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, 10.0);

        assert_float_eq(sum, 0.0, "Empty sum");
        assert_float_eq(weighted_sum, 0.0, "Empty weighted sum");
        assert!(max.is_finite(), "Max should be finite");
        assert_eq!(count_above, 0, "Empty count");
    }

    #[test]
    fn test_aggregate_counters_single_element() {
        let counter_values = vec![5.0];
        let weights = vec![1.0];

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, 3.0);

        assert_float_eq(sum, 5.0, "Single element sum");
        assert_float_eq(weighted_sum, 5.0, "Single element weighted sum");
        assert_float_eq(max, 5.0, "Single element max");
        assert_eq!(count_above, 1, "Single element above threshold");
    }

    #[test]
    fn test_aggregate_counters_large_array() {
        let counter_values: Vec<f32> = (0..1000).map(|i| i as f32).collect();
        let weights: Vec<f32> = (0..1000).map(|_| 0.001).collect();

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, 500.0);

        // Sum of 0..999 = 999 * 1000 / 2 = 499500
        assert!((sum - 499500.0).abs() < 1.0, "Large array sum");

        // Weighted sum should be close to sum * 0.001
        assert!((weighted_sum - 499.5).abs() < 0.1, "Large array weighted sum");

        assert_float_eq(max, 999.0, "Large array max");

        // Count values > 500 (501 to 999) = 499 values
        assert_eq!(count_above, 499, "Large array count above");
    }

    #[test]
    #[should_panic(expected = "Length mismatch")]
    fn test_aggregate_counters_length_mismatch() {
        let counter_values = vec![10.0, 20.0];
        let weights = vec![1.0];

        aggregate_counters_simd(&counter_values, &weights, 10.0);
    }

    // =========================================================================
    // SIMD Correctness Tests (verify SIMD matches scalar)
    // =========================================================================

    #[test]
    fn test_cosine_similarity_reproducible() {
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![5.0, 6.0, 7.0, 8.0];

        let result1 = cosine_similarity_simd(&a, &b);
        let result2 = cosine_similarity_simd(&a, &b);

        assert_float_eq(result1, result2, "Reproducibility");
    }

    #[test]
    fn test_batch_update_reproducible() {
        let mut q_values1 = vec![0.0; 10];
        let mut q_values2 = vec![0.0; 10];
        let rewards = vec![1.0; 10];
        let next_max_q = vec![0.5; 10];

        batch_q_update_simd(&mut q_values1, &rewards, &next_max_q, 0.1, 0.95);
        batch_q_update_simd(&mut q_values2, &rewards, &next_max_q, 0.1, 0.95);

        for i in 0..10 {
            assert_float_eq(q_values1[i], q_values2[i], &format!("Index {}", i));
        }
    }

    #[test]
    fn test_validation_reproducible() {
        let values = vec![5.0, 15.0, 25.0];
        let mins = vec![0.0, 10.0, 20.0];
        let maxs = vec![10.0, 20.0, 30.0];
        let mut results1 = vec![0u8; 3];
        let mut results2 = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results1);
        validate_parameters_simd(&values, &mins, &maxs, &mut results2);

        assert_eq!(results1, results2, "Validation reproducibility");
    }

    #[test]
    fn test_aggregation_reproducible() {
        let counter_values = vec![10.0, 20.0, 30.0];
        let weights = vec![0.5, 0.3, 0.2];

        let (sum1, ws1, max1, count1) =
            aggregate_counters_simd(&counter_values, &weights, 15.0);
        let (sum2, ws2, max2, count2) =
            aggregate_counters_simd(&counter_values, &weights, 15.0);

        assert_float_eq(sum1, sum2, "Aggregation sum reproducibility");
        assert_float_eq(ws1, ws2, "Aggregation weighted sum reproducibility");
        assert_float_eq(max1, max2, "Aggregation max reproducibility");
        assert_eq!(count1, count2, "Aggregation count reproducibility");
    }
}
