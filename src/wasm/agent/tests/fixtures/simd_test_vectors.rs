/// Test Vectors for SIMD Operations (ADR-016)
///
/// Provides predefined test data for:
/// - Vector similarity operations
/// - Validation edge cases
/// - Aggregation scenarios

/// Create test vectors for cosine similarity
pub fn create_test_vectors() -> (Vec<f32>, Vec<f32>) {
    let a = vec![1.0, 0.0, 0.0, 2.0, 3.0, 0.0, 1.0, 0.0];
    let b = vec![1.0, 0.0, 0.0, 2.0, 3.0, 0.0, 1.0, 0.0];
    (a, b)
}

/// Create orthogonal test vectors
pub fn create_orthogonal_vectors() -> (Vec<f32>, Vec<f32>) {
    let a = vec![1.0, 0.0, 0.0];
    let b = vec![0.0, 1.0, 0.0];
    (a, b)
}

/// Create opposite test vectors
pub fn create_opposite_vectors() -> (Vec<f32>, Vec<f32>) {
    let a = vec![1.0, 2.0, 3.0];
    let b = vec![-1.0, -2.0, -3.0];
    (a, b)
}

/// Create test data for parameter validation
pub struct ValidationTestCase {
    pub values: Vec<f32>,
    pub mins: Vec<f32>,
    pub maxs: Vec<f32>,
    pub expected_results: Vec<u8>,
}

pub fn validation_test_cases() -> Vec<ValidationTestCase> {
    vec![
        // All valid
        ValidationTestCase {
            values: vec![5.0, 15.0, 25.0],
            mins: vec![0.0, 10.0, 20.0],
            maxs: vec![10.0, 20.0, 30.0],
            expected_results: vec![1, 1, 1],
        },
        // All invalid
        ValidationTestCase {
            values: vec![15.0, 25.0, 35.0],
            mins: vec![0.0, 10.0, 20.0],
            maxs: vec![10.0, 20.0, 30.0],
            expected_results: vec![0, 0, 0],
        },
        // Boundary values
        ValidationTestCase {
            values: vec![0.0, 10.0, 5.0],
            mins: vec![0.0, 0.0, 0.0],
            maxs: vec![10.0, 10.0, 10.0],
            expected_results: vec![1, 1, 1],
        },
        // Mixed
        ValidationTestCase {
            values: vec![5.0, 25.0, 15.0],
            mins: vec![0.0, 10.0, 20.0],
            maxs: vec![10.0, 20.0, 30.0],
            expected_results: vec![1, 0, 0],
        },
    ]
}

/// Create test data for counter aggregation
pub struct AggregationTestCase {
    pub counter_values: Vec<f32>,
    pub weights: Vec<f32>,
    pub threshold: f32,
    pub expected_sum: f32,
    pub expected_weighted_sum: f32,
    pub expected_max: f32,
    pub expected_count_above: u32,
}

pub fn aggregation_test_cases() -> Vec<AggregationTestCase> {
    vec![
        // Basic case
        AggregationTestCase {
            counter_values: vec![10.0, 20.0, 30.0],
            weights: vec![0.5, 0.3, 0.2],
            threshold: 15.0,
            expected_sum: 60.0,
            expected_weighted_sum: 17.0,
            expected_max: 30.0,
            expected_count_above: 2,
        },
        // All below threshold
        AggregationTestCase {
            counter_values: vec![5.0, 10.0, 15.0],
            weights: vec![1.0, 1.0, 1.0],
            threshold: 20.0,
            expected_sum: 30.0,
            expected_weighted_sum: 30.0,
            expected_max: 15.0,
            expected_count_above: 0,
        },
        // Negative values
        AggregationTestCase {
            counter_values: vec![-10.0, 0.0, 10.0],
            weights: vec![1.0, 1.0, 1.0],
            threshold: 0.0,
            expected_sum: 0.0,
            expected_weighted_sum: 0.0,
            expected_max: 10.0,
            expected_count_above: 1,
        },
    ]
}

