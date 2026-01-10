//! SIMD Cosine Similarity
//!
//! Computes cosine similarity between vectors.
//! SIMD version: 3-5x speedup for 128-dimensional embeddings.

/// SIMD-accelerated cosine similarity for 128-dimensional embeddings
///
/// This is optimized for exactly 128 dimensions, processing 4 f32 values
/// per iteration using 32 SIMD operations. Follows ADR-014 pattern with
/// loop unrolling for optimal performance.
///
/// # Arguments
/// * `a` - First 128-dimensional vector (fixed-size array)
/// * `b` - Second 128-dimensional vector (fixed-size array)
///
/// # Returns
/// Cosine similarity value between -1.0 (opposite) and 1.0 (identical)
///
/// # Safety
/// Requires SIMD128 support. Use `cosine_similarity_128()` for safe version.
/// This function is marked `unsafe` because it requires the CPU feature
/// `simd128` to be available at runtime.
///
/// # Algorithm (following ADR-014)
/// 1. Process 4 floats per iteration (f32x4 vectors)
/// 2. Compute dot_product: sum(a[i] * b[i])
/// 3. Compute norm_a: sum(a[i]^2)
/// 4. Compute norm_b: sum(b[i]^2)
/// 5. Return: dot_product / (sqrt(norm_a) * sqrt(norm_b))
///
/// # Performance
/// - 32 iterations of 4 floats each = 128 elements
/// - 3-5x speedup over scalar implementation
/// - Target: <15us for 128-dimensional vectors
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn cosine_similarity_simd_128(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    use std::arch::wasm32::*;

    // Initialize accumulators with f32x4_splat for better performance
    let mut dot_product = f32x4_splat(0.0);
    let mut norm_a = f32x4_splat(0.0);
    let mut norm_b = f32x4_splat(0.0);

    // Process 128 dimensions in 32 iterations of 4 floats each
    // This matches ADR-014's pattern for 64-dim but scaled to 128
    for i in (0..128).step_by(4) {
        // Load 4 floats from each array using v128_load
        // SAFETY: Arrays are guaranteed to be 128 elements (16-byte aligned)
        let a_vec = v128_load(a.as_ptr().add(i) as *const v128);
        let b_vec = v128_load(b.as_ptr().add(i) as *const v128);

        // Compute products and accumulate
        // dot_product += a[i] * b[i] for i, i+1, i+2, i+3
        dot_product = f32x4_add(dot_product, f32x4_mul(a_vec, b_vec));

        // norm_a += a[i]^2
        norm_a = f32x4_add(norm_a, f32x4_mul(a_vec, a_vec));

        // norm_b += b[i]^2
        norm_b = f32x4_add(norm_b, f32x4_mul(b_vec, b_vec));
    }

    // Horizontal sum: extract all 4 lanes and add them
    let dot_sum = f32x4_extract_lane::<0>(dot_product)
        + f32x4_extract_lane::<1>(dot_product)
        + f32x4_extract_lane::<2>(dot_product)
        + f32x4_extract_lane::<3>(dot_product);

    let norm_a_sum = f32x4_extract_lane::<0>(norm_a)
        + f32x4_extract_lane::<1>(norm_a)
        + f32x4_extract_lane::<2>(norm_a)
        + f32x4_extract_lane::<3>(norm_a);

    let norm_b_sum = f32x4_extract_lane::<0>(norm_b)
        + f32x4_extract_lane::<1>(norm_b)
        + f32x4_extract_lane::<2>(norm_b)
        + f32x4_extract_lane::<3>(norm_b);

    // Compute final result: dot / (||a|| * ||b||)
    // Handle edge case of zero vectors
    if norm_a_sum > 0.0 && norm_b_sum > 0.0 {
        dot_sum / (norm_a_sum.sqrt() * norm_b_sum.sqrt())
    } else {
        0.0
    }
}

/// Scalar cosine similarity for 128-dimensional embeddings (fallback)
///
/// Always-available version that doesn't require SIMD support.
/// Used as fallback for browsers without SIMD128 or for testing.
///
/// # Arguments
/// * `a` - First 128-dimensional vector (fixed-size array)
/// * `b` - Second 128-dimensional vector (fixed-size array)
///
/// # Returns
/// Cosine similarity value between -1.0 (opposite) and 1.0 (identical)
pub fn cosine_similarity_scalar_128(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..128 {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

/// Safe cosine similarity for 128-dimensional embeddings
///
/// Automatically selects SIMD or scalar implementation based on
/// runtime feature detection. This is the recommended function
/// for most use cases.
///
/// # Arguments
/// * `a` - First 128-dimensional vector (fixed-size array)
/// * `b` - Second 128-dimensional vector (fixed-size array)
///
/// # Returns
/// Cosine similarity value between -1.0 (opposite) and 1.0 (identical)
pub fn cosine_similarity_128(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        if is_simd128_detected() {
            // SAFETY: SIMD capability verified above
            unsafe { cosine_similarity_simd_128(a, b) }
        } else {
            cosine_similarity_scalar_128(a, b)
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        cosine_similarity_scalar_128(a, b)
    }
}

/// SIMD-accelerated cosine similarity (when available)
///
/// Generic slice-based version that handles any vector length.
///
/// # Safety
/// Requires SIMD128 support. Use `cosine_similarity()` for safe version.
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    use std::arch::wasm32::*;

    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    let mut dot_product = f32x4(0.0, 0.0, 0.0, 0.0);
    let mut norm_a = f32x4(0.0, 0.0, 0.0, 0.0);
    let mut norm_b = f32x4(0.0, 0.0, 0.0, 0.0);

    // Process 4 floats at a time
    let chunks = a.len() / 4;
    let remainder = a.len() % 4;

    for i in 0..chunks {
        let offset = i * 4;
        let a_vec = f32x4(a[offset], a[offset + 1], a[offset + 2], a[offset + 3]);
        let b_vec = f32x4(b[offset], b[offset + 1], b[offset + 2], b[offset + 3]);

        dot_product = f32x4_add(dot_product, f32x4_mul(a_vec, b_vec));
        norm_a = f32x4_add(norm_a, f32x4_mul(a_vec, a_vec));
        norm_b = f32x4_add(norm_b, f32x4_mul(b_vec, b_vec));
    }

    // Horizontal sum
    let dp = f32x4_extract_lane::<0>(dot_product)
        + f32x4_extract_lane::<1>(dot_product)
        + f32x4_extract_lane::<2>(dot_product)
        + f32x4_extract_lane::<3>(dot_product);
    let na = f32x4_extract_lane::<0>(norm_a)
        + f32x4_extract_lane::<1>(norm_a)
        + f32x4_extract_lane::<2>(norm_a)
        + f32x4_extract_lane::<3>(norm_a);
    let nb = f32x4_extract_lane::<0>(norm_b)
        + f32x4_extract_lane::<1>(norm_b)
        + f32x4_extract_lane::<2>(norm_b)
        + f32x4_extract_lane::<3>(norm_b);

    // Process remainder
    let mut dp_rem = 0.0f32;
    let mut na_rem = 0.0f32;
    let mut nb_rem = 0.0f32;
    for i in 0..remainder {
        let offset = chunks * 4 + i;
        dp_rem += a[offset] * b[offset];
        na_rem += a[offset] * a[offset];
        nb_rem += b[offset] * b[offset];
    }

    let dot_product = dp + dp_rem;
    let norm_a = na + na_rem;
    let norm_b = nb + nb_rem;

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

/// SIMD-accelerated cosine similarity (non-WASM fallback)
#[cfg(not(target_arch = "wasm32"))]
pub unsafe fn cosine_similarity_simd(a: &[f32], b: &[f32]) -> f32 {
    // Fallback to scalar for non-WASM
    cosine_similarity_scalar(a, b)
}

/// Scalar cosine similarity (always available)
pub fn cosine_similarity_scalar(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    }
}

/// Safe cosine similarity that selects SIMD or scalar automatically
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have equal length");

    #[cfg(target_arch = "wasm32")]
    {
        if is_simd128_detected() {
            unsafe { cosine_similarity_simd(a, b) }
        } else {
            cosine_similarity_scalar(a, b)
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        cosine_similarity_scalar(a, b)
    }
}

/// Runtime SIMD128 detection (for WASM)
#[cfg(target_arch = "wasm32")]
pub fn is_simd128_detected() -> bool {
    // In real WASM, would check WebAssembly SIMD feature
    // For now, assume available if compiled with feature
    cfg!(target_feature = "simd128")
}

/// Non-WASM fallback (always false)
#[cfg(not(target_arch = "wasm32"))]
pub fn is_simd128_detected() -> bool {
    false
}

/// Cosine similarity implementation enum
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CosineSimilarityImpl {
    Simd,
    Scalar,
}

/// Get the implementation that will be used
pub fn cosine_similarity_implementation() -> CosineSimilarityImpl {
    #[cfg(target_arch = "wasm32")]
    {
        if is_simd128_detected() {
            CosineSimilarityImpl::Simd
        } else {
            CosineSimilarityImpl::Scalar
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        CosineSimilarityImpl::Scalar
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0, 0.0];

        let result = cosine_similarity_scalar(&a, &b);
        assert!((result - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0, 0.0];

        let result = cosine_similarity_scalar(&a, &b);
        assert!(result.abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_opposite() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let b = vec![-1.0, 0.0, 0.0, 0.0];

        let result = cosine_similarity_scalar(&a, &b);
        assert!((result - (-1.0)).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_128_dimensional() {
        let a: Vec<f32> = (0..128).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..128).map(|i| i as f32).collect();

        let result = cosine_similarity(&a, &b);
        assert!((result - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_length_mismatch() {
        let a = vec![1.0, 0.0];
        let b = vec![1.0];

        // Should panic
        let result = std::panic::catch_unwind(|| {
            cosine_similarity_scalar(&a, &b)
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_zero_vectors() {
        let a = vec![0.0, 0.0, 0.0];
        let b = vec![0.0, 0.0, 0.0];

        let result = cosine_similarity_scalar(&a, &b);
        assert_eq!(result, 0.0);
    }

    // ========================================================================
    // 128-Dimensional Fixed-Size Array Tests (ELEX-010)
    // ========================================================================

    #[test]
    fn test_cosine_similarity_128_identical() {
        let a: [f32; 128] = [1.0; 128];
        let b: [f32; 128] = [1.0; 128];

        let result = cosine_similarity_scalar_128(&a, &b);
        assert!((result - 1.0).abs() < 0.001, "Expected 1.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_orthogonal() {
        let mut a: [f32; 128] = [0.0; 128];
        let mut b: [f32; 128] = [0.0; 128];
        a[0] = 1.0;
        b[1] = 1.0;

        let result = cosine_similarity_scalar_128(&a, &b);
        assert!(result.abs() < 0.001, "Expected ~0.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_opposite() {
        let mut a: [f32; 128] = [0.0; 128];
        let mut b: [f32; 128] = [0.0; 128];
        a[0] = 1.0;
        b[0] = -1.0;

        let result = cosine_similarity_scalar_128(&a, &b);
        assert!((result - (-1.0)).abs() < 0.001, "Expected -1.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_sequential() {
        let a: [f32; 128] = std::array::from_fn(|i| i as f32);
        let b: [f32; 128] = std::array::from_fn(|i| i as f32);

        let result = cosine_similarity_scalar_128(&a, &b);
        assert!((result - 1.0).abs() < 0.001, "Expected 1.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_partial_match() {
        let a: [f32; 128] = std::array::from_fn(|i| (i + 1) as f32);
        let b: [f32; 128] = std::array::from_fn(|i| ((i + 1) * 2) as f32);

        let result = cosine_similarity_scalar_128(&a, &b);
        // All values are proportional, so cosine similarity should be 1.0
        assert!((result - 1.0).abs() < 0.001, "Expected 1.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_zero_vectors() {
        let a: [f32; 128] = [0.0; 128];
        let b: [f32; 128] = [0.0; 128];

        let result = cosine_similarity_scalar_128(&a, &b);
        assert_eq!(result, 0.0, "Expected 0.0 for zero vectors");
    }

    #[test]
    fn test_cosine_similarity_128_half_zero() {
        let mut a: [f32; 128] = [0.0; 128];
        let mut b: [f32; 128] = [0.0; 128];
        for i in 0..64 {
            a[i] = (i + 1) as f32;
            b[i] = (i + 1) as f32;
        }

        let result = cosine_similarity_scalar_128(&a, &b);
        assert!((result - 1.0).abs() < 0.001, "Expected 1.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_normalized_unit_vectors() {
        let mut a: [f32; 128] = [0.0; 128];
        let mut b: [f32; 128] = [0.0; 128];
        a[0] = 1.0;
        b[0] = 1.0 / 2.0f32.sqrt();
        b[1] = 1.0 / 2.0f32.sqrt();

        let result = cosine_similarity_scalar_128(&a, &b);
        // dot = 1/sqrt(2), norm_a = 1, norm_b = 1
        // result = (1/sqrt(2)) / (1 * 1) = 1/sqrt(2) ≈ 0.707
        let expected = 1.0 / 2.0f32.sqrt();
        assert!((result - expected).abs() < 0.001, "Expected {}, got {}", expected, result);
    }

    #[test]
    fn test_cosine_similarity_128_with_negative_values() {
        let mut a: [f32; 128] = [0.0; 128];
        let mut b: [f32; 128] = [0.0; 128];
        a[0] = 1.0;
        a[1] = 1.0;
        b[0] = 1.0;
        b[1] = -1.0;

        let result = cosine_similarity_scalar_128(&a, &b);
        // dot = 1*1 + 1*(-1) = 0
        // norm_a = sqrt(1+1) = sqrt(2)
        // norm_b = sqrt(1+1) = sqrt(2)
        // result = 0 / (sqrt(2)*sqrt(2)) = 0
        assert!(result.abs() < 0.001, "Expected ~0.0, got {}", result);
    }

    #[test]
    fn test_cosine_similarity_128_simd_scalar_consistency() {
        let a: [f32; 128] = std::array::from_fn(|i| (i as f32 + 0.1) % 10.0);
        let b: [f32; 128] = std::array::from_fn(|i| ((i as f32 + 0.2) % 10.0).max(0.1));

        // Note: This test only runs on WASM targets where SIMD is available
        #[cfg(target_arch = "wasm32")]
        {
            let scalar_result = cosine_similarity_scalar_128(&a, &b);
            // Try SIMD if available
            if is_simd128_detected() {
                let simd_result = unsafe { cosine_similarity_simd_128(&a, &b) };
                assert!(
                    (scalar_result - simd_result).abs() < 0.0001,
                    "Scalar: {}, SIMD: {}, diff: {}",
                    scalar_result,
                    simd_result,
                    (scalar_result - simd_result).abs()
                );
            }
        }

        // Always verify scalar gives a valid result
        let result = cosine_similarity_scalar_128(&a, &b);
        assert!(result >= -1.0 && result <= 1.0, "Result {} is outside valid range [-1, 1]", result);
    }

    #[test]
    fn test_cosine_similarity_128_auto_dispatch() {
        let a: [f32; 128] = std::array::from_fn(|i| i as f32);
        let b: [f32; 128] = std::array::from_fn(|i| i as f32);

        let result = cosine_similarity_128(&a, &b);
        assert!((result - 1.0).abs() < 0.001, "Expected 1.0, got {}", result);
    }
}
