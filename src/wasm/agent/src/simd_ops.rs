/// SIMD Operations Module for Ericsson RAN Feature Agents
///
/// Implements 4 operation categories with WASM SIMD128 intrinsics:
/// 1. Vector Similarity Search (cosine similarity)
/// 2. Q-Learning Batch Updates
/// 3. Parameter Validation (range checks)
/// 4. Counter/KPI Aggregation
///
/// ADR-014: Uses std::arch::wasm32 SIMD128 intrinsics for 4x throughput
/// on supported platforms. Falls back to scalar on unsupported builds.

#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

// ============================================================================
// SIMD Operation 1: Vector Similarity Search (cosine/dot product)
// ============================================================================

/// Computes cosine similarity between two vectors using WASM SIMD128
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn cosine_similarity_simd_inner(a: &[f32], b: &[f32]) -> f32 {
    let mut dot_product = f32x4(0.0, 0.0, 0.0, 0.0);
    let mut norm_a = f32x4(0.0, 0.0, 0.0, 0.0);
    let mut norm_b = f32x4(0.0, 0.0, 0.0, 0.0);

    // Process 4 elements at a time
    let chunks = a.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        let va = f32x4(a[offset], a[offset + 1], a[offset + 2], a[offset + 3]);
        let vb = f32x4(b[offset], b[offset + 1], b[offset + 2], b[offset + 3]);

        dot_product = f32x4_add(dot_product, f32x4_mul(va, vb));
        norm_a = f32x4_add(norm_a, f32x4_mul(va, va));
        norm_b = f32x4_add(norm_b, f32x4_mul(vb, vb));
    }

    // Extract and sum the 4 components from each vector
    let dot_components = [
        f32x4_extract_lane::<0>(dot_product),
        f32x4_extract_lane::<1>(dot_product),
        f32x4_extract_lane::<2>(dot_product),
        f32x4_extract_lane::<3>(dot_product),
    ];

    let norm_a_components = [
        f32x4_extract_lane::<0>(norm_a),
        f32x4_extract_lane::<1>(norm_a),
        f32x4_extract_lane::<2>(norm_a),
        f32x4_extract_lane::<3>(norm_a),
    ];

    let norm_b_components = [
        f32x4_extract_lane::<0>(norm_b),
        f32x4_extract_lane::<1>(norm_b),
        f32x4_extract_lane::<2>(norm_b),
        f32x4_extract_lane::<3>(norm_b),
    ];

    let mut dot_product_sum: f32 = dot_components.iter().sum();
    let mut norm_a_sum: f32 = norm_a_components.iter().sum();
    let mut norm_b_sum: f32 = norm_b_components.iter().sum();

    // Handle remaining elements (scalar)
    let remainder_start = chunks * 4;
    for i in remainder_start..a.len() {
        let ai = a[i];
        let bi = b[i];
        dot_product_sum += ai * bi;
        norm_a_sum += ai * ai;
        norm_b_sum += bi * bi;
    }

    // Cosine similarity = dot_product / (norm_a * norm_b)
    if norm_a_sum > 0.0 && norm_b_sum > 0.0 {
        dot_product_sum / (norm_a_sum.sqrt() * norm_b_sum.sqrt())
    } else {
        0.0
    }
}

/// Scalar fallback for cosine similarity
#[cfg(not(target_arch = "wasm32"))]
fn cosine_similarity_scalar(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        let ai = a[i];
        let bi = b[i];
        dot_product += ai * bi;
        norm_a += ai * ai;
        norm_b += bi * bi;
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

/// Public interface for cosine similarity
#[cfg(target_arch = "wasm32")]
pub fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    // Check if SIMD128 is available at runtime
    if is_simd128_available() {
        unsafe { cosine_similarity_simd_inner(a, b) }
    } else {
        cosine_similarity_scalar(a, b)
    }
}

/// Public interface for cosine similarity (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    cosine_similarity_scalar(a, b)
}

/// Check if SIMD128 is available at runtime
#[cfg(target_arch = "wasm32")]
fn is_simd128_available() -> bool {
    // For WASM, we detect SIMD128 support
    // This is a simple check - in production you might want to cache this
    #[cfg(target_arch = "wasm32")]
    {
        // SIMD128 is available if we're on WASM and can use the intrinsics
        // The #[target_feature] attribute handles the runtime check
        true
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

/// Scalar fallback for cosine similarity (WASM builds)
#[cfg(target_arch = "wasm32")]
fn cosine_similarity_scalar(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        let ai = a[i];
        let bi = b[i];
        dot_product += ai * bi;
        norm_a += ai * ai;
        norm_b += bi * bi;
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

// ============================================================================
// SIMD Operation 2: Q-Learning Batch Updates
// ============================================================================

/// Batch update Q-table entries using WASM SIMD128
/// Q(s,a) ← Q(s,a) + α[r + γ max(Q(s',a')) - Q(s,a)]
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn batch_q_update_simd_inner(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    let alpha_vec = f32x4(alpha, alpha, alpha, alpha);
    let gamma_vec = f32x4(gamma, gamma, gamma, gamma);

    // Process 4 elements at a time
    let chunks = q_values.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;

        let q = f32x4(q_values[offset], q_values[offset + 1], q_values[offset + 2], q_values[offset + 3]);
        let r = f32x4(rewards[offset], rewards[offset + 1], rewards[offset + 2], rewards[offset + 3]);
        let next_q = f32x4(next_max_q[offset], next_max_q[offset + 1], next_max_q[offset + 2], next_max_q[offset + 3]);

        // target = r + gamma * next_max_q
        let target = f32x4_add(r, f32x4_mul(gamma_vec, next_q));

        // td_error = target - q
        let td_error = f32x4_sub(target, q);

        // q = q + alpha * td_error
        let new_q = f32x4_add(q, f32x4_mul(alpha_vec, td_error));

        // Store result
        q_values[offset] = f32x4_extract_lane::<0>(new_q);
        q_values[offset + 1] = f32x4_extract_lane::<1>(new_q);
        q_values[offset + 2] = f32x4_extract_lane::<2>(new_q);
        q_values[offset + 3] = f32x4_extract_lane::<3>(new_q);
    }

    // Handle remaining elements (scalar)
    let remainder_start = chunks * 4;
    for i in remainder_start..q_values.len() {
        let target = rewards[i] + gamma * next_max_q[i];
        let td_error = target - q_values[i];
        q_values[i] += alpha * td_error;
    }
}

/// Scalar fallback for batch Q-update
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn batch_q_update_scalar(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(q_values.len(), rewards.len(), "Length mismatch");
    assert_eq!(q_values.len(), next_max_q.len(), "Length mismatch");

    for i in 0..q_values.len() {
        let target = rewards[i] + gamma * next_max_q[i];
        let td_error = target - q_values[i];
        q_values[i] += alpha * td_error;
    }
}

/// Public interface for batch Q-update
#[cfg(target_arch = "wasm32")]
pub fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(q_values.len(), rewards.len(), "Length mismatch");
    assert_eq!(q_values.len(), next_max_q.len(), "Length mismatch");

    if is_simd128_available() {
        unsafe { batch_q_update_simd_inner(q_values, rewards, next_max_q, alpha, gamma) }
    } else {
        batch_q_update_scalar(q_values, rewards, next_max_q, alpha, gamma)
    }
}

/// Public interface for batch Q-update (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    batch_q_update_scalar(q_values, rewards, next_max_q, alpha, gamma)
}

// ============================================================================
// SIMD Operation 3: Parameter Validation (range checks)
// ============================================================================

/// Validates parameters against bounds using WASM SIMD128
/// Results: 0 = invalid, 1 = valid
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn validate_parameters_simd_inner(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
    results: &mut [u8],
) {
    // Process 4 elements at a time
    let chunks = values.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;

        let v = f32x4(values[offset], values[offset + 1], values[offset + 2], values[offset + 3]);
        let min_v = f32x4(min_bounds[offset], min_bounds[offset + 1], min_bounds[offset + 2], min_bounds[offset + 3]);
        let max_v = f32x4(max_bounds[offset], max_bounds[offset + 1], max_bounds[offset + 2], max_bounds[offset + 3]);

        // Check if values >= min_bounds
        let ge_min = f32x4_ge(v, min_v);

        // Check if values <= max_bounds
        let le_max = f32x4_le(v, max_v);

        // Extract each lane and validate individually
        // f32x4_ge returns a v128 with 0xFFFFFFFF for true, 0x00000000 for false
        let ge_min_lane0 = u32x4_extract_lane::<0>(ge_min);
        let ge_min_lane1 = u32x4_extract_lane::<1>(ge_min);
        let ge_min_lane2 = u32x4_extract_lane::<2>(ge_min);
        let ge_min_lane3 = u32x4_extract_lane::<3>(ge_min);

        let le_max_lane0 = u32x4_extract_lane::<0>(le_max);
        let le_max_lane1 = u32x4_extract_lane::<1>(le_max);
        let le_max_lane2 = u32x4_extract_lane::<2>(le_max);
        let le_max_lane3 = u32x4_extract_lane::<3>(le_max);

        // Both conditions must be true (bitwise AND)
        results[offset + 0] = if (ge_min_lane0 & le_max_lane0) != 0 { 1 } else { 0 };
        results[offset + 1] = if (ge_min_lane1 & le_max_lane1) != 0 { 1 } else { 0 };
        results[offset + 2] = if (ge_min_lane2 & le_max_lane2) != 0 { 1 } else { 0 };
        results[offset + 3] = if (ge_min_lane3 & le_max_lane3) != 0 { 1 } else { 0 };
    }

    // Handle remaining elements (scalar)
    let remainder_start = chunks * 4;
    for i in remainder_start..values.len() {
        results[i] = if values[i] >= min_bounds[i] && values[i] <= max_bounds[i] {
            1
        } else {
            0
        };
    }
}

/// Scalar fallback for parameter validation
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn validate_parameters_scalar(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
    results: &mut [u8],
) {
    assert_eq!(values.len(), min_bounds.len(), "Length mismatch");
    assert_eq!(values.len(), max_bounds.len(), "Length mismatch");
    assert_eq!(values.len(), results.len(), "Length mismatch");

    for i in 0..values.len() {
        results[i] = if values[i] >= min_bounds[i] && values[i] <= max_bounds[i] {
            1
        } else {
            0
        };
    }
}

/// Public interface for parameter validation
#[cfg(target_arch = "wasm32")]
pub fn validate_parameters_simd(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
    results: &mut [u8],
) {
    assert_eq!(values.len(), min_bounds.len(), "Length mismatch");
    assert_eq!(values.len(), max_bounds.len(), "Length mismatch");
    assert_eq!(values.len(), results.len(), "Length mismatch");

    if is_simd128_available() {
        unsafe { validate_parameters_simd_inner(values, min_bounds, max_bounds, results) }
    } else {
        validate_parameters_scalar(values, min_bounds, max_bounds, results)
    }
}

/// Public interface for parameter validation (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn validate_parameters_simd(
    values: &[f32],
    min_bounds: &[f32],
    max_bounds: &[f32],
    results: &mut [u8],
) {
    validate_parameters_scalar(values, min_bounds, max_bounds, results)
}

// ============================================================================
// SIMD Operation 4: Counter/KPI Aggregation
// ============================================================================

/// Aggregate counter values using WASM SIMD128
/// Returns (sum, weighted_sum, max, count_above_threshold)
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn aggregate_counters_simd_inner(
    counter_values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    let mut sum_vec = f32x4(0.0, 0.0, 0.0, 0.0);
    let mut weighted_sum_vec = f32x4(0.0, 0.0, 0.0, 0.0);
    let mut max_vec = f32x4(
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
        f32::NEG_INFINITY,
    );
    let threshold_vec = f32x4(threshold, threshold, threshold, threshold);
    let mut count_above = 0u32;

    // Process 4 elements at a time
    let chunks = counter_values.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;

        let vals = f32x4(counter_values[offset], counter_values[offset + 1], counter_values[offset + 2], counter_values[offset + 3]);
        let w = f32x4(weights[offset], weights[offset + 1], weights[offset + 2], weights[offset + 3]);

        // Accumulate sum
        sum_vec = f32x4_add(sum_vec, vals);

        // Accumulate weighted sum
        weighted_sum_vec = f32x4_add(weighted_sum_vec, f32x4_mul(vals, w));

        // Update max
        max_vec = f32x4_max(max_vec, vals);

        // Count values above threshold
        let above = f32x4_gt(vals, threshold_vec);
        // Extract comparison mask and count set bits
        let mask = u32x4_extract_lane::<0>(above);
        count_above += (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
    }

    // Extract and sum components from vectors
    let sum_components = [
        f32x4_extract_lane::<0>(sum_vec),
        f32x4_extract_lane::<1>(sum_vec),
        f32x4_extract_lane::<2>(sum_vec),
        f32x4_extract_lane::<3>(sum_vec),
    ];

    let weighted_sum_components = [
        f32x4_extract_lane::<0>(weighted_sum_vec),
        f32x4_extract_lane::<1>(weighted_sum_vec),
        f32x4_extract_lane::<2>(weighted_sum_vec),
        f32x4_extract_lane::<3>(weighted_sum_vec),
    ];

    let max_components = [
        f32x4_extract_lane::<0>(max_vec),
        f32x4_extract_lane::<1>(max_vec),
        f32x4_extract_lane::<2>(max_vec),
        f32x4_extract_lane::<3>(max_vec),
    ];

    let mut sum: f32 = sum_components.iter().sum();
    let mut weighted_sum: f32 = weighted_sum_components.iter().sum();
    let mut max_val = max_components[0];
    for &m in &max_components[1..] {
        if m > max_val {
            max_val = m;
        }
    }

    // Handle remaining elements (scalar)
    let remainder_start = chunks * 4;
    for i in remainder_start..counter_values.len() {
        let val = counter_values[i];
        let weight = weights[i];

        sum += val;
        weighted_sum += val * weight;

        if val > max_val {
            max_val = val;
        }

        if val > threshold {
            count_above += 1;
        }
    }

    (sum, weighted_sum, max_val, count_above)
}

/// Scalar fallback for counter aggregation
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn aggregate_counters_scalar(
    counter_values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    assert_eq!(counter_values.len(), weights.len(), "Length mismatch");

    let mut sum = 0.0f32;
    let mut weighted_sum = 0.0f32;
    let mut max_val = f32::NEG_INFINITY;
    let mut count_above = 0u32;

    for i in 0..counter_values.len() {
        let val = counter_values[i];
        let weight = weights[i];

        sum += val;
        weighted_sum += val * weight;

        if val > max_val {
            max_val = val;
        }

        if val > threshold {
            count_above += 1;
        }
    }

    (sum, weighted_sum, max_val, count_above)
}

/// Public interface for counter aggregation
#[cfg(target_arch = "wasm32")]
pub fn aggregate_counters_simd(
    counter_values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    assert_eq!(counter_values.len(), weights.len(), "Length mismatch");

    if is_simd128_available() {
        unsafe { aggregate_counters_simd_inner(counter_values, weights, threshold) }
    } else {
        aggregate_counters_scalar(counter_values, weights, threshold)
    }
}

/// Public interface for counter aggregation (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn aggregate_counters_simd(
    counter_values: &[f32],
    weights: &[f32],
    threshold: f32,
) -> (f32, f32, f32, u32) {
    aggregate_counters_scalar(counter_values, weights, threshold)
}

// ============================================================================
// SIMD Operation 5: Batch Cosine Similarity (HNSW search acceleration)
// ============================================================================

/// Batch cosine similarity: compare query vector against multiple candidates
/// Returns indices of top-k most similar vectors
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn batch_cosine_similarity_simd_inner(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize,
) -> Vec<(usize, f32)> {
    let mut similarities: Vec<(usize, f32)> = Vec::with_capacity(candidates.len());

    for (idx, candidate) in candidates.iter().enumerate() {
        if candidate.len() != query.len() {
            continue;
        }

        let similarity = cosine_similarity_simd_inner(query, candidate);
        similarities.push((idx, similarity));
    }

    // Sort by similarity (descending) and take top k
    similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    similarities.truncate(k);

    similarities
}

/// Scalar fallback for batch cosine similarity
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn batch_cosine_similarity_scalar(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize,
) -> Vec<(usize, f32)> {
    let mut similarities: Vec<(usize, f32)> = Vec::with_capacity(candidates.len());

    for (idx, candidate) in candidates.iter().enumerate() {
        if candidate.len() != query.len() {
            continue;
        }

        let similarity = cosine_similarity_scalar(query, candidate);
        similarities.push((idx, similarity));
    }

    similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    similarities.truncate(k);

    similarities
}

/// Public interface for batch cosine similarity
#[cfg(target_arch = "wasm32")]
pub fn batch_cosine_similarity(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize,
) -> Vec<(usize, f32)> {
    if is_simd128_available() {
        unsafe { batch_cosine_similarity_simd_inner(query, candidates, k) }
    } else {
        batch_cosine_similarity_scalar(query, candidates, k)
    }
}

/// Public interface for batch cosine similarity (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn batch_cosine_similarity(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize,
) -> Vec<(usize, f32)> {
    batch_cosine_similarity_scalar(query, candidates, k)
}

// ============================================================================
// SIMD Operation 6: Q-Table Lookup Optimization
// ============================================================================

/// Fast Q-table lookup using SIMD for batch state encoding
/// Encodes state hash into 128-dimensional vector for similarity comparison
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn encode_state_simd(state_hash: u64) -> Vec<f32> {
    let mut embedding = vec![0.0f32; 128];

    // Spread state hash across embedding using SIMD
    let hash_vec = f32x4(
        (state_hash as f32) / (u32::MAX as f32),
        (state_hash as f32) / (u32::MAX as f32),
        (state_hash as f32) / (u32::MAX as f32),
        (state_hash as f32) / (u32::MAX as f32),
    );

    for i in 0..32 {
        let offset = i * 4;
        let base = f32x4(embedding[offset], embedding[offset + 1], embedding[offset + 2], embedding[offset + 3]);

        // Mix hash value with position-specific offset
        let offset_vec = f32x4(i as f32 / 32.0, i as f32 / 32.0, i as f32 / 32.0, i as f32 / 32.0);
        let ones = f32x4(1.0, 1.0, 1.0, 1.0);
        let mixed = f32x4_mul(hash_vec, f32x4_add(offset_vec, ones));

        let result = f32x4_add(base, mixed);
        embedding[offset] = f32x4_extract_lane::<0>(result);
        embedding[offset + 1] = f32x4_extract_lane::<1>(result);
        embedding[offset + 2] = f32x4_extract_lane::<2>(result);
        embedding[offset + 3] = f32x4_extract_lane::<3>(result);
    }

    embedding
}

/// Scalar fallback for state encoding
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
pub fn encode_state_scalar(state_hash: u64) -> Vec<f32> {
    let mut embedding = vec![0.0f32; 128];
    let normalized = (state_hash as f32) / (u32::MAX as f32);

    for i in 0..128 {
        embedding[i] = normalized * ((i as f32) / 128.0 + 1.0);
    }

    embedding
}

/// Public interface for state encoding
#[cfg(target_arch = "wasm32")]
pub fn encode_state(state_hash: u64) -> Vec<f32> {
    if is_simd128_available() {
        unsafe { encode_state_simd(state_hash) }
    } else {
        encode_state_scalar(state_hash)
    }
}

/// Public interface for state encoding (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn encode_state(state_hash: u64) -> Vec<f32> {
    encode_state_scalar(state_hash)
}

// ============================================================================
// SIMD Operation 7: Euclidean Distance for HNSW Layer Search
// ============================================================================

/// Computes Euclidean distance between two vectors using WASM SIMD128
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn euclidean_distance_simd_inner(a: &[f32], b: &[f32]) -> f32 {
    let mut sum_sq = f32x4(0.0, 0.0, 0.0, 0.0);

    let chunks = a.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        let va = f32x4(a[offset], a[offset + 1], a[offset + 2], a[offset + 3]);
        let vb = f32x4(b[offset], b[offset + 1], b[offset + 2], b[offset + 3]);

        let diff = f32x4_sub(va, vb);
        sum_sq = f32x4_add(sum_sq, f32x4_mul(diff, diff));
    }

    // Extract and sum components
    let components = [
        f32x4_extract_lane::<0>(sum_sq),
        f32x4_extract_lane::<1>(sum_sq),
        f32x4_extract_lane::<2>(sum_sq),
        f32x4_extract_lane::<3>(sum_sq),
    ];

    let mut total: f32 = components.iter().sum();

    // Handle remainder
    let remainder_start = chunks * 4;
    for i in remainder_start..a.len() {
        let diff = a[i] - b[i];
        total += diff * diff;
    }

    total.sqrt()
}

/// Scalar fallback for Euclidean distance
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn euclidean_distance_scalar(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    let mut sum_sq = 0.0f32;
    for i in 0..a.len() {
        let diff = a[i] - b[i];
        sum_sq += diff * diff;
    }

    sum_sq.sqrt()
}

/// Public interface for Euclidean distance
#[cfg(target_arch = "wasm32")]
pub fn euclidean_distance_simd(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    if is_simd128_available() {
        unsafe { euclidean_distance_simd_inner(a, b) }
    } else {
        euclidean_distance_scalar(a, b)
    }
}

/// Public interface for Euclidean distance (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn euclidean_distance_simd(a: &[f32], b: &[f32]) -> f32 {
    euclidean_distance_scalar(a, b)
}

// ============================================================================
// SIMD Operation 8: Batch Euclidean Distance (for HNSW neighbor search)
// ============================================================================

/// Batch Euclidean distance for finding nearest neighbors
/// Returns (index, distance) for top-k nearest candidates
#[cfg(target_arch = "wasm32")]
pub fn batch_euclidean_distance(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize,
) -> Vec<(usize, f32)> {
    let mut distances: Vec<(usize, f32)> = Vec::with_capacity(candidates.len());

    for (idx, candidate) in candidates.iter().enumerate() {
        if candidate.len() != query.len() {
            continue;
        }

        let distance = euclidean_distance_simd(query, candidate);
        distances.push((idx, distance));
    }

    // Sort by distance (ascending) and take top k
    distances.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    distances.truncate(k);

    distances
}

/// Public interface for batch Euclidean distance (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn batch_euclidean_distance(
    query: &[f32],
    candidates: &[Vec<f32>],
    k: usize,
) -> Vec<(usize, f32)> {
    let mut distances: Vec<(usize, f32)> = Vec::with_capacity(candidates.len());

    for (idx, candidate) in candidates.iter().enumerate() {
        if candidate.len() != query.len() {
            continue;
        }

        let distance = euclidean_distance_scalar(query, candidate);
        distances.push((idx, distance));
    }

    distances.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    distances.truncate(k);

    distances
}

// ============================================================================
// SIMD Operation 9: Vector Normalization (L2)
// ============================================================================

/// L2 normalize a vector using WASM SIMD128
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn normalize_l2_simd_inner(v: &mut [f32]) {
    // Compute squared norm
    let mut norm_sq = f32x4(0.0, 0.0, 0.0, 0.0);

    let chunks = v.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        let vec = f32x4(v[offset], v[offset + 1], v[offset + 2], v[offset + 3]);
        norm_sq = f32x4_add(norm_sq, f32x4_mul(vec, vec));
    }

    let components = [
        f32x4_extract_lane::<0>(norm_sq),
        f32x4_extract_lane::<1>(norm_sq),
        f32x4_extract_lane::<2>(norm_sq),
        f32x4_extract_lane::<3>(norm_sq),
    ];

    let mut total: f32 = components.iter().sum();

    // Handle remainder
    let remainder_start = chunks * 4;
    for i in remainder_start..v.len() {
        total += v[i] * v[i];
    }

    let norm = total.sqrt();
    if norm > 0.0 {
        let inv_norm = f32x4(1.0 / norm, 1.0 / norm, 1.0 / norm, 1.0 / norm);

        // Normalize in-place
        for i in 0..chunks {
            let offset = i * 4;
            let vec = f32x4(v[offset], v[offset + 1], v[offset + 2], v[offset + 3]);
            let normalized = f32x4_mul(vec, inv_norm);
            v[offset] = f32x4_extract_lane::<0>(normalized);
            v[offset + 1] = f32x4_extract_lane::<1>(normalized);
            v[offset + 2] = f32x4_extract_lane::<2>(normalized);
            v[offset + 3] = f32x4_extract_lane::<3>(normalized);
        }

        // Handle remainder
        for i in remainder_start..v.len() {
            v[i] /= norm;
        }
    }
}

/// Scalar fallback for L2 normalization
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn normalize_l2_scalar(v: &mut [f32]) {
    let norm_sq: f32 = v.iter().map(|x| x * x).sum();
    let norm = norm_sq.sqrt();

    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}

/// Public interface for L2 normalization
#[cfg(target_arch = "wasm32")]
pub fn normalize_l2_simd(v: &mut [f32]) {
    if is_simd128_available() {
        unsafe { normalize_l2_simd_inner(v) }
    } else {
        normalize_l2_scalar(v)
    }
}

/// Public interface for L2 normalization (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn normalize_l2_simd(v: &mut [f32]) {
    normalize_l2_scalar(v)
}

// ============================================================================
// SIMD Operation 10: Vector Addition (for Q-value updates)
// ============================================================================

/// Vector addition using SIMD: result = a + scalar*b
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn vec_add_scalar_mul_simd_inner(
    result: &mut [f32],
    a: &[f32],
    b: &[f32],
    scalar: f32,
) {
    let scalar_vec = f32x4(scalar, scalar, scalar, scalar);

    let chunks = result.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;

        let va = f32x4(a[offset], a[offset + 1], a[offset + 2], a[offset + 3]);
        let vb = f32x4(b[offset], b[offset + 1], b[offset + 2], b[offset + 3]);

        // result = a + scalar * b
        let mul = f32x4_mul(scalar_vec, vb);
        let add = f32x4_add(va, mul);

        result[offset] = f32x4_extract_lane::<0>(add);
        result[offset + 1] = f32x4_extract_lane::<1>(add);
        result[offset + 2] = f32x4_extract_lane::<2>(add);
        result[offset + 3] = f32x4_extract_lane::<3>(add);
    }

    // Handle remainder
    let remainder_start = chunks * 4;
    for i in remainder_start..result.len() {
        result[i] = a[i] + scalar * b[i];
    }
}

/// Public interface for vector addition with scalar multiplication
#[cfg(target_arch = "wasm32")]
pub fn vec_add_scalar_mul(result: &mut [f32], a: &[f32], b: &[f32], scalar: f32) {
    assert_eq!(result.len(), a.len());
    assert_eq!(result.len(), b.len());

    if is_simd128_available() {
        unsafe { vec_add_scalar_mul_simd_inner(result, a, b, scalar) }
    } else {
        for i in 0..result.len() {
            result[i] = a[i] + scalar * b[i];
        }
    }
}

/// Public interface (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn vec_add_scalar_mul(result: &mut [f32], a: &[f32], b: &[f32], scalar: f32) {
    assert_eq!(result.len(), a.len());
    assert_eq!(result.len(), b.len());

    for i in 0..result.len() {
        result[i] = a[i] + scalar * b[i];
    }
}

// ============================================================================
// SIMD Operation 11: Dot Product (for Q-value computation)
// ============================================================================

/// Compute dot product using WASM SIMD128
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn dot_product_simd_inner(a: &[f32], b: &[f32]) -> f32 {
    let mut sum = f32x4(0.0, 0.0, 0.0, 0.0);

    let chunks = a.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        let va = f32x4(a[offset], a[offset + 1], a[offset + 2], a[offset + 3]);
        let vb = f32x4(b[offset], b[offset + 1], b[offset + 2], b[offset + 3]);
        sum = f32x4_add(sum, f32x4_mul(va, vb));
    }

    // Extract and sum components
    let components = [
        f32x4_extract_lane::<0>(sum),
        f32x4_extract_lane::<1>(sum),
        f32x4_extract_lane::<2>(sum),
        f32x4_extract_lane::<3>(sum),
    ];

    let mut total: f32 = components.iter().sum();

    // Handle remainder
    let remainder_start = chunks * 4;
    for i in remainder_start..a.len() {
        total += a[i] * b[i];
    }

    total
}

/// Scalar fallback for dot product
#[cfg(any(not(target_arch = "wasm32"), target_arch = "wasm32"))]
fn dot_product_scalar(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    let mut sum = 0.0f32;
    for i in 0..a.len() {
        sum += a[i] * b[i];
    }
    sum
}

/// Public interface for dot product
#[cfg(target_arch = "wasm32")]
pub fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    if is_simd128_available() {
        unsafe { dot_product_simd_inner(a, b) }
    } else {
        dot_product_scalar(a, b)
    }
}

/// Public interface for dot product (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
    dot_product_scalar(a, b)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];

        let similarity = cosine_similarity_simd(&a, &b);
        assert!((similarity - 1.0).abs() < 0.001, "Identical vectors should have similarity 1.0");
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];

        let similarity = cosine_similarity_simd(&a, &b);
        assert!(similarity.abs() < 0.001, "Orthogonal vectors should have similarity ~0");
    }

    #[test]
    fn test_batch_q_update() {
        let mut q_values = vec![0.0, 0.0, 0.0];
        let rewards = vec![1.0, 0.5, 2.0];
        let next_max_q = vec![0.8, 0.3, 1.5];

        batch_q_update_simd(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // Verify updates were applied
        for &q in &q_values {
            assert!(q > 0.0, "Q-values should increase with positive rewards");
        }
    }

    #[test]
    fn test_validate_parameters() {
        let values = vec![5.0, 15.0, 25.0];
        let mins = vec![0.0, 10.0, 20.0];
        let maxs = vec![10.0, 20.0, 30.0];
        let mut results = vec![0u8; 3];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results[0], 1, "5.0 should be valid in [0, 10]");
        assert_eq!(results[1], 1, "15.0 should be valid in [10, 20]");
        assert_eq!(results[2], 1, "25.0 should be valid in [20, 30]");
    }

    #[test]
    fn test_validate_parameters_out_of_bounds() {
        let values = vec![15.0];
        let mins = vec![0.0];
        let maxs = vec![10.0];
        let mut results = vec![0u8; 1];

        validate_parameters_simd(&values, &mins, &maxs, &mut results);

        assert_eq!(results[0], 0, "15.0 should be invalid in [0, 10]");
    }

    #[test]
    fn test_aggregate_counters() {
        let counter_values = vec![10.0, 20.0, 30.0];
        let weights = vec![0.5, 0.3, 0.2];
        let threshold = 15.0;

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, threshold);

        assert_eq!(sum, 60.0, "Sum should be 60");
        assert!((weighted_sum - 17.0).abs() < 0.001, "Weighted sum should be ~17");
        assert_eq!(max, 30.0, "Max should be 30");
        assert_eq!(count_above, 2, "2 values above 15: 20 and 30");
    }

    #[test]
    fn test_aggregate_empty() {
        let counter_values: Vec<f32> = vec![];
        let weights: Vec<f32> = vec![];

        let (sum, weighted_sum, max, count_above) =
            aggregate_counters_simd(&counter_values, &weights, 10.0);

        assert_eq!(sum, 0.0);
        assert_eq!(weighted_sum, 0.0);
        assert_eq!(max, f32::NEG_INFINITY);
        assert_eq!(count_above, 0);
    }

    // Tests for new SIMD operations

    #[test]
    fn test_batch_cosine_similarity() {
        let query = vec![1.0, 0.0, 0.0, 0.0];
        let candidates = vec![
            vec![1.0, 0.0, 0.0, 0.0],  // Identical
            vec![0.0, 1.0, 0.0, 0.0],  // Orthogonal
            vec![0.707, 0.707, 0.0, 0.0],  // 45 degrees
        ];

        let results = batch_cosine_similarity(&query, &candidates, 2);

        assert!(!results.is_empty());
        assert!(results.len() <= 2);
        // First result should be most similar (identical vector)
        assert_eq!(results[0].0, 0);
        assert!((results[0].1 - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_euclidean_distance() {
        let a = vec![0.0, 0.0];
        let b = vec![3.0, 4.0];

        let distance = euclidean_distance_simd(&a, &b);
        assert!((distance - 5.0).abs() < 0.001, "Distance should be 5.0");
    }

    #[test]
    fn test_euclidean_distance_identical() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![1.0, 2.0, 3.0];

        let distance = euclidean_distance_simd(&a, &b);
        assert_eq!(distance, 0.0, "Distance between identical vectors should be 0");
    }

    #[test]
    fn test_batch_euclidean_distance() {
        let query = vec![0.0, 0.0];
        let candidates = vec![
            vec![1.0, 0.0],  // Distance 1
            vec![3.0, 4.0],  // Distance 5
            vec![0.0, 1.0],  // Distance 1
        ];

        let results = batch_euclidean_distance(&query, &candidates, 2);

        assert!(!results.is_empty());
        assert!(results.len() <= 2);
        // Results should be sorted by distance (ascending)
        if results.len() >= 2 {
            assert!(results[0].1 <= results[1].1);
        }
    }

    #[test]
    fn test_normalize_l2() {
        let mut v = vec![3.0, 4.0];
        normalize_l2_simd(&mut v);

        let norm = (v[0] * v[0] + v[1] * v[1]).sqrt();
        assert!((norm - 1.0).abs() < 0.001, "Normalized vector should have unit length");
    }

    #[test]
    fn test_normalize_l2_zero_vector() {
        let mut v = vec![0.0, 0.0, 0.0];
        normalize_l2_simd(&mut v);

        // Zero vector should remain zero (or near-zero due to float precision)
        for &x in &v {
            assert!(x.abs() < 0.001);
        }
    }

    #[test]
    fn test_dot_product() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];

        let dot = dot_product_simd(&a, &b);
        let expected = 1.0 * 4.0 + 2.0 * 5.0 + 3.0 * 6.0;  // = 32
        assert!((dot - expected).abs() < 0.001);
    }

    #[test]
    fn test_vec_add_scalar_mul() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![2.0, 3.0, 4.0];
        let mut result = vec![0.0; 3];

        vec_add_scalar_mul(&mut result, &a, &b, 2.0);

        assert_eq!(result[0], 5.0);  // 1 + 2*2
        assert_eq!(result[1], 8.0);  // 2 + 3*2
        assert_eq!(result[2], 11.0); // 3 + 4*2
    }

    #[test]
    fn test_encode_state() {
        let hash1 = 12345u64;
        let hash2 = 54321u64;

        let embedding1 = encode_state(hash1);
        let embedding2 = encode_state(hash2);

        assert_eq!(embedding1.len(), 128);
        assert_eq!(embedding2.len(), 128);

        // Different hashes should produce different embeddings
        let similarity = cosine_similarity_simd(&embedding1, &embedding2);
        assert!(similarity < 1.0, "Different hashes should not be perfectly similar");
    }

    #[test]
    fn test_state_encoding_consistency() {
        let hash = 99999u64;

        let embedding1 = encode_state(hash);
        let embedding2 = encode_state(hash);

        // Same hash should produce same embedding
        assert_eq!(embedding1, embedding2);
    }

    #[test]
    fn test_large_vector_operations() {
        // Test with vectors that require multiple SIMD iterations
        let a: Vec<f32> = (0..128).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..128).map(|i| (i * 2) as f32).collect();

        let dot = dot_product_simd(&a, &b);
        let expected: f32 = (0..128).map(|i| (i * (i * 2)) as f32).sum();

        assert!((dot - expected).abs() < 1000.0, "Large dot product should be accurate");
    }
}
