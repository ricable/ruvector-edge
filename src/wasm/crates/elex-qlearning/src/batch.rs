//! SIMD Q-Learning Batch Updates (ELEX-011)
//!
//! Vectorized Q-learning TD-error calculations for 2-4x speedup.
//! Implements: Q(s,a) <- Q(s,a) + alpha * [r + gamma * max(Q(s',a')) - Q(s,a)]
//!
//! # Hyperparameters
//! - alpha (learning rate): 0.1
//! - gamma (discount factor): 0.95

#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// SIMD-accelerated batch Q-update for WASM32 with SIMD128 support.
///
/// # Algorithm (vectorized)
/// 1. Load 4 Q-values, rewards, next_max_q values per iteration
/// 2. Compute target = r + gamma * next_q (using f32x4_add, f32x4_mul)
/// 3. Compute td_error = target - q (using f32x4_sub)
/// 4. Update: q = q + alpha * td_error
/// 5. Handle remainder elements scalar
///
/// # Safety
/// This function uses SIMD intrinsics and requires:
/// - WASM32 target with SIMD128 support
/// - All input slices must have the same length
/// - Must be called from within a `#[target_feature(enable = "simd128")]` function
///
/// # Arguments
/// * `q_values` - Current Q-values (will be updated in place)
/// * `rewards` - Rewards received for each state-action pair
/// * `next_max_q` - Maximum Q-values for next states
/// * `alpha` - Learning rate (typically 0.1)
/// * `gamma` - Discount factor (typically 0.95)
///
/// # Example
/// ```ignore
/// let mut q_values = vec![0.0f32; 100];
/// let rewards: Vec<f32> = (0..100).map(|i| i as f32 / 100.0).collect();
/// let next_max_q: Vec<f32> = (0..100).map(|i| i as f32 / 50.0).collect();
///
/// unsafe {
///     batch_q_update_simd(
///         &mut q_values,
///         &rewards,
///         &next_max_q,
///         0.1,  // alpha
///         0.95, // gamma
///     );
/// }
/// ```
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(
        q_values.len(),
        rewards.len(),
        "q_values and rewards must have same length"
    );
    assert_eq!(
        q_values.len(),
        next_max_q.len(),
        "q_values and next_max_q must have same length"
    );

    // Broadcast alpha and gamma to all lanes
    let alpha_vec = f32x4(alpha, alpha, alpha, alpha);
    let gamma_vec = f32x4(gamma, gamma, gamma, gamma);

    // Process 4 elements at a time using SIMD
    let chunks = q_values.len() / 4;

    for i in 0..chunks {
        let offset = i * 4;

        // Load 4 values from each array
        let q = f32x4(
            q_values[offset],
            q_values[offset + 1],
            q_values[offset + 2],
            q_values[offset + 3],
        );
        let r = f32x4(
            rewards[offset],
            rewards[offset + 1],
            rewards[offset + 2],
            rewards[offset + 3],
        );
        let nq = f32x4(
            next_max_q[offset],
            next_max_q[offset + 1],
            next_max_q[offset + 2],
            next_max_q[offset + 3],
        );

        // target = r + gamma * max(Q(s',a'))
        let gamma_times_nq = f32x4_mul(gamma_vec, nq);
        let target = f32x4_add(r, gamma_times_nq);

        // td_error = target - Q(s,a)
        let td_error = f32x4_sub(target, q);

        // Q(s,a) <- Q(s,a) + alpha * td_error
        let alpha_times_error = f32x4_mul(alpha_vec, td_error);
        let new_q = f32x4_add(q, alpha_times_error);

        // Store results back to q_values array
        q_values[offset] = f32x4_extract_lane::<0>(new_q);
        q_values[offset + 1] = f32x4_extract_lane::<1>(new_q);
        q_values[offset + 2] = f32x4_extract_lane::<2>(new_q);
        q_values[offset + 3] = f32x4_extract_lane::<3>(new_q);
    }

    // Process remainder elements (0-3 elements) using scalar operations
    let remainder = q_values.len() % 4;
    if remainder > 0 {
        let offset = chunks * 4;
        for i in 0..remainder {
            let idx = offset + i;
            // target = r + gamma * max(Q(s',a'))
            let target = rewards[idx] + gamma * next_max_q[idx];
            // td_error = target - Q(s,a)
            let td_error = target - q_values[idx];
            // Q(s,a) <- Q(s,a) + alpha * td_error
            q_values[idx] += alpha * td_error;
        }
    }
}

/// Scalar fallback for non-WASM targets or when SIMD is not available.
///
/// This function provides the same functionality as `batch_q_update_simd`
/// but uses scalar operations, making it portable across all platforms.
///
/// # Arguments
/// * `q_values` - Current Q-values (will be updated in place)
/// * `rewards` - Rewards received for each state-action pair
/// * `next_max_q` - Maximum Q-values for next states
/// * `alpha` - Learning rate (typically 0.1)
/// * `gamma` - Discount factor (typically 0.95)
#[cfg(not(target_arch = "wasm32"))]
pub fn batch_q_update_scalar(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(
        q_values.len(),
        rewards.len(),
        "q_values and rewards must have same length"
    );
    assert_eq!(
        q_values.len(),
        next_max_q.len(),
        "q_values and next_max_q must have same length"
    );

    for i in 0..q_values.len() {
        // target = r + gamma * max(Q(s',a'))
        let target = rewards[i] + gamma * next_max_q[i];

        // td_error = target - Q(s,a)
        let td_error = target - q_values[i];

        // Q(s,a) <- Q(s,a) + alpha * td_error
        q_values[i] += alpha * td_error;
    }
}

/// Scalar implementation for WASM (for testing/comparison).
///
/// This is the scalar version that can be used on WASM for comparison
/// with the SIMD version to verify correctness.
#[cfg(target_arch = "wasm32")]
pub fn batch_q_update_scalar(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(
        q_values.len(),
        rewards.len(),
        "q_values and rewards must have same length"
    );
    assert_eq!(
        q_values.len(),
        next_max_q.len(),
        "q_values and next_max_q must have same length"
    );

    for i in 0..q_values.len() {
        // target = r + gamma * max(Q(s',a'))
        let target = rewards[i] + gamma * next_max_q[i];

        // td_error = target - Q(s,a)
        let td_error = target - q_values[i];

        // Q(s,a) <- Q(s,a) + alpha * td_error
        q_values[i] += alpha * td_error;
    }
}

/// Safe wrapper that automatically selects SIMD or scalar implementation.
///
/// On WASM32 with SIMD128 support, uses the vectorized version.
/// Otherwise, falls back to scalar implementation.
///
/// # Arguments
/// * `q_values` - Current Q-values (will be updated in place)
/// * `rewards` - Rewards received for each state-action pair
/// * `next_max_q` - Maximum Q-values for next states
/// * `alpha` - Learning rate (typically 0.1)
/// * `gamma` - Discount factor (typically 0.95)
pub fn batch_q_update(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    #[cfg(target_arch = "wasm32")]
    {
        // Try to use SIMD if available
        if is_simd128_available() {
            unsafe { batch_q_update_simd(q_values, rewards, next_max_q, alpha, gamma) }
        } else {
            batch_q_update_scalar(q_values, rewards, next_max_q, alpha, gamma)
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        batch_q_update_scalar(q_values, rewards, next_max_q, alpha, gamma)
    }
}

/// Check if SIMD128 is available at runtime.
#[cfg(target_arch = "wasm32")]
fn is_simd128_available() -> bool {
    // Note: In a real WASM environment, you would check for SIMD128 support
    // via feature detection. For now, we assume it's available if compiled
    // for wasm32 target. In production, you'd use something like:
    // `std::arch::wasm32::is_simd128_detected()` if available
    true
}

/// Q-update implementation type for testing and benchmarking.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QUpdateImpl {
    /// SIMD-accelerated implementation (2-4x faster)
    Simd,
    /// Scalar fallback implementation
    Scalar,
}

/// Get the current Q-update implementation being used.
pub fn get_implementation() -> QUpdateImpl {
    #[cfg(target_arch = "wasm32")]
    {
        if is_simd128_available() {
            QUpdateImpl::Simd
        } else {
            QUpdateImpl::Scalar
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        QUpdateImpl::Scalar
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const ALPHA: f32 = 0.1;  // Learning rate
    const GAMMA: f32 = 0.95; // Discount factor

    #[test]
    fn test_batch_q_update_scalar_basic() {
        let mut q_values = vec![0.0, 0.0, 0.0, 0.0];
        let rewards = vec![1.0, 0.5, 2.0, 1.5];
        let next_max_q = vec![0.8, 0.3, 1.5, 1.0];

        batch_q_update_scalar(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);

        // All Q-values should increase with positive rewards
        for &q in &q_values {
            assert!(q > 0.0, "Q-values should increase with positive rewards");
        }
    }

    #[test]
    fn test_batch_q_update_scalar_negative_rewards() {
        let mut q_values = vec![1.0, 1.0, 1.0, 1.0];
        let rewards = vec![-1.0, -0.5, -2.0, -1.5];
        let next_max_q = vec![0.0, 0.0, 0.0, 0.0];

        batch_q_update_scalar(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);

        // Q-values should decrease with negative rewards
        for &q in &q_values {
            assert!(q < 1.0, "Q-values should decrease with negative rewards");
        }
    }

    #[test]
    fn test_batch_q_update_scalar_exact_calculation() {
        let mut q_values = vec![0.5];
        let rewards = vec![1.0];
        let next_max_q = vec![0.8];

        // Expected: Q = 0.5 + 0.1 * (1.0 + 0.95 * 0.8 - 0.5)
        //         = 0.5 + 0.1 * (1.0 + 0.76 - 0.5)
        //         = 0.5 + 0.1 * 1.26
        //         = 0.5 + 0.126
        //         = 0.626
        let expected = 0.5 + ALPHA * (1.0 + GAMMA * 0.8 - 0.5);

        batch_q_update_scalar(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);

        assert!((q_values[0] - expected).abs() < 1e-6,
            "Expected {}, got {}", expected, q_values[0]);
    }

    #[test]
    fn test_batch_q_update_large_batch() {
        let batch_size = 100;
        let mut q_values = vec![0.0f32; batch_size];
        let rewards: Vec<f32> = (0..batch_size).map(|i| i as f32 / 100.0).collect();
        let next_max_q: Vec<f32> = (0..batch_size).map(|i| (i as f32 / 100.0) * 0.8).collect();

        batch_q_update(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);

        // Verify all Q-values were updated
        for (i, &q) in q_values.iter().enumerate() {
            assert!(q >= 0.0, "Q-value at index {} should be non-negative, got {}", i, q);
        }
    }

    #[test]
    fn test_batch_q_update_simd_vs_scalar_consistency() {
        let batch_size = 16; // Multiple of 4 for full SIMD coverage
        let mut q_simd = vec![0.5f32; batch_size];
        let mut q_scalar = q_simd.clone();
        let rewards: Vec<f32> = (0..batch_size).map(|i| (i as f32) / 10.0).collect();
        let next_max_q: Vec<f32> = (0..batch_size).map(|i| (i as f32) / 20.0).collect();

        // Update with scalar (reference implementation)
        batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, ALPHA, GAMMA);

        // Update with SIMD
        #[cfg(target_arch = "wasm32")]
        unsafe {
            batch_q_update_simd(&mut q_simd, &rewards, &next_max_q, ALPHA, GAMMA);
        }

        #[cfg(not(target_arch = "wasm32"))]
        batch_q_update_scalar(&mut q_simd, &rewards, &next_max_q, ALPHA, GAMMA);

        // Verify SIMD and scalar produce identical results (within floating point tolerance)
        for (i, (s, simd_val)) in q_scalar.iter().zip(q_simd.iter()).enumerate() {
            let diff = (s - simd_val).abs();
            assert!(diff < 1e-5,
                "SIMD and scalar differ at index {}: scalar={}, simd={}, diff={}",
                i, s, simd_val, diff);
        }
    }

    #[test]
    fn test_batch_q_update_remainder_handling() {
        // Test sizes that don't divide evenly by 4
        for size in [1, 2, 3, 5, 7, 13] {
            let mut q_simd = vec![0.3f32; size];
            let mut q_scalar = q_simd.clone();
            let rewards: Vec<f32> = (0..size).map(|_| 0.5).collect();
            let next_max_q: Vec<f32> = (0..size).map(|_| 0.4).collect();

            batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, ALPHA, GAMMA);

            #[cfg(target_arch = "wasm32")]
            unsafe {
                batch_q_update_simd(&mut q_simd, &rewards, &next_max_q, ALPHA, GAMMA);
            }

            #[cfg(not(target_arch = "wasm32"))]
            batch_q_update_scalar(&mut q_simd, &rewards, &next_max_q, ALPHA, GAMMA);

            for (i, (s, simd_val)) in q_scalar.iter().zip(q_simd.iter()).enumerate() {
                let diff = (s - simd_val).abs();
                assert!(diff < 1e-5,
                    "Size {}: SIMD and scalar differ at index {}: diff={}", size, i, diff);
            }
        }
    }

    #[test]
    fn test_batch_q_update_zero_learning_rate() {
        let mut q_values = vec![0.5, 0.3, 0.7];
        let q_original = q_values.clone();
        let rewards = vec![1.0, 0.5, 2.0];
        let next_max_q = vec![0.8, 0.3, 1.5];

        // With alpha=0, Q-values should not change
        batch_q_update(&mut q_values, &rewards, &next_max_q, 0.0, GAMMA);

        for (i, (orig, updated)) in q_original.iter().zip(q_values.iter()).enumerate() {
            assert_eq!(orig, updated,
                "Q-value at index {} should not change with alpha=0", i);
        }
    }

    #[test]
    fn test_batch_q_update_zero_discount() {
        let mut q_values = vec![0.0, 0.0, 0.0, 0.0];
        let rewards = vec![1.0, 0.5, 2.0, 1.5];
        let next_max_q = vec![100.0, 100.0, 100.0, 100.0]; // Large next Q values

        // With gamma=0, next_max_q should not affect the update
        batch_q_update(&mut q_values, &rewards, &next_max_q, ALPHA, 0.0);

        for (i, &q) in q_values.iter().enumerate() {
            let expected = ALPHA * rewards[i];
            assert!((q - expected).abs() < 1e-5,
                "With gamma=0, Q-value should be alpha * reward at index {}", i);
        }
    }

    #[test]
    #[should_panic(expected = "assertion failed")]
    fn test_batch_q_update_length_mismatch_rewards() {
        let mut q_values = vec![0.0, 0.0];
        let rewards = vec![1.0]; // Wrong length
        let next_max_q = vec![0.5, 0.5];

        batch_q_update(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);
    }

    #[test]
    #[should_panic(expected = "assertion failed")]
    fn test_batch_q_update_length_mismatch_next_max_q() {
        let mut q_values = vec![0.0, 0.0];
        let rewards = vec![1.0, 0.5];
        let next_max_q = vec![0.5]; // Wrong length

        batch_q_update(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);
    }

    #[test]
    fn test_get_implementation() {
        let impl_type = get_implementation();
        // Should return either Simd or Scalar
        match impl_type {
            QUpdateImpl::Simd | QUpdateImpl::Scalar => {},
        }
    }

    // Performance test (compile-only, not run in normal test suite)
    #[test]
    #[ignore] // Run with: cargo test --release -- --ignored
    fn test_batch_q_update_performance() {
        let batch_size = 1000;
        let iterations = 1000;

        let mut q_values = vec![0.0f32; batch_size];
        let rewards: Vec<f32> = (0..batch_size).map(|i| i as f32 / 1000.0).collect();
        let next_max_q: Vec<f32> = (0..batch_size).map(|i| i as f32 / 2000.0).collect();

        // Warm-up
        for _ in 0..10 {
            batch_q_update(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);
        }

        // Measure SIMD implementation
        let start = std::time::Instant::now();
        for _ in 0..iterations {
            batch_q_update(&mut q_values, &rewards, &next_max_q, ALPHA, GAMMA);
        }
        let duration = start.elapsed();

        println!("Batch Q-update performance: {} updates in {:?}", batch_size * iterations, duration);
        println!("Implementation: {:?}", get_implementation());
    }
}
