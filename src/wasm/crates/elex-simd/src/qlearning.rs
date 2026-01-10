//! SIMD Q-Learning Batch Updates
//!
//! Vectorized Q-learning TD-error calculations.
//! SIMD version: 2-4x speedup for batch updates.

#[cfg(target_arch = "wasm32")]
use crate::similarity::is_simd128_detected;

/// Q-Learning update formula:
/// Q(s,a) ← Q(s,a) + α[r + γ max(Q(s',a')) - Q(s,a)]
///
/// # Arguments
/// * `q_values` - Current Q-values (will be updated in place)
/// * `rewards` - Rewards received
/// * `next_max_q` - Maximum Q-values for next states
/// * `alpha` - Learning rate (typically 0.1)
/// * `gamma` - Discount factor (typically 0.95)

/// SIMD-accelerated batch Q-update (WASM)
#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
pub unsafe fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    use std::arch::wasm32::*;

    assert_eq!(q_values.len(), rewards.len());
    assert_eq!(q_values.len(), next_max_q.len());

    let alpha_vec = f32x4(alpha, alpha, alpha, alpha);
    let gamma_vec = f32x4(gamma, gamma, gamma, gamma);

    let chunks = q_values.len() / 4;

    for i in 0..chunks {
        let offset = i * 4;

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

        // target = r + γ * max(Q(s',a'))
        let target = f32x4_add(r, f32x4_mul(gamma_vec, nq));

        // td_error = target - Q(s,a)
        let td_error = f32x4_sub(target, q);

        // Q(s,a) ← Q(s,a) + α * td_error
        let new_q = f32x4_add(q, f32x4_mul(alpha_vec, td_error));

        q_values[offset] = f32x4_extract_lane::<0>(new_q);
        q_values[offset + 1] = f32x4_extract_lane::<1>(new_q);
        q_values[offset + 2] = f32x4_extract_lane::<2>(new_q);
        q_values[offset + 3] = f32x4_extract_lane::<3>(new_q);
    }

    // Process remainder
    let remainder = q_values.len() % 4;
    let offset = chunks * 4;
    for i in 0..remainder {
        let idx = offset + i;
        let target = rewards[idx] + gamma * next_max_q[idx];
        let td_error = target - q_values[idx];
        q_values[idx] += alpha * td_error;
    }
}

/// Non-WASM fallback
#[cfg(not(target_arch = "wasm32"))]
pub unsafe fn batch_q_update_simd(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    batch_q_update_scalar(q_values, rewards, next_max_q, alpha, gamma)
}

/// Scalar batch Q-update (always available)
pub fn batch_q_update_scalar(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    assert_eq!(q_values.len(), rewards.len());
    assert_eq!(q_values.len(), next_max_q.len());

    for i in 0..q_values.len() {
        // target = r + γ * max(Q(s',a'))
        let target = rewards[i] + gamma * next_max_q[i];

        // td_error = target - Q(s,a)
        let td_error = target - q_values[i];

        // Q(s,a) ← Q(s,a) + α * td_error
        q_values[i] += alpha * td_error;
    }
}

/// Safe batch Q-update with automatic SIMD/Scalar selection
pub fn batch_q_update(
    q_values: &mut [f32],
    rewards: &[f32],
    next_max_q: &[f32],
    alpha: f32,
    gamma: f32,
) {
    #[cfg(target_arch = "wasm32")]
    {
        if is_simd128_detected() {
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

/// Q-update implementation enum
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QUpdateImpl {
    Simd,
    Scalar,
}

pub fn q_update_implementation() -> QUpdateImpl {
    #[cfg(target_arch = "wasm32")]
    {
        if is_simd128_detected() {
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

    #[test]
    fn test_batch_q_update_positive_rewards() {
        let mut q_values = vec![0.0, 0.0, 0.0, 0.0];
        let rewards = vec![1.0, 0.5, 2.0, 1.5];
        let next_max_q = vec![0.8, 0.3, 1.5, 1.0];

        batch_q_update_scalar(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // All Q-values should increase with positive rewards
        for &q in &q_values {
            assert!(q > 0.0);
        }
    }

    #[test]
    fn test_batch_q_update_negative_rewards() {
        let mut q_values = vec![1.0, 1.0, 1.0, 1.0];
        let rewards = vec![-1.0, -0.5, -2.0, -1.5];
        let next_max_q = vec![0.0, 0.0, 0.0, 0.0];

        batch_q_update_scalar(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // Q-values should decrease
        for &q in &q_values {
            assert!(q < 1.0);
        }
    }

    #[test]
    fn test_batch_q_update_consistency() {
        let mut q_simd = vec![0.5, 0.3, 0.7, 0.2];
        let mut q_scalar = q_simd.clone();
        let rewards = vec![1.0, 0.5, 2.0, 1.5];
        let next_max_q = vec![0.8, 0.3, 1.5, 1.0];

        batch_q_update(&mut q_simd, &rewards, &next_max_q, 0.1, 0.95);
        batch_q_update_scalar(&mut q_scalar, &rewards, &next_max_q, 0.1, 0.95);

        for (s, simd) in q_scalar.iter().zip(q_simd.iter()) {
            assert!((s - simd).abs() < 0.001);
        }
    }

    #[test]
    fn test_batch_q_update_large_batch() {
        let mut q_values = vec![0.0; 100];
        let rewards: Vec<f32> = (0..100).map(|i| (i as f32) / 100.0).collect();
        let next_max_q: Vec<f32> = (0..100).map(|i| ((i as f32) / 100.0) * 0.8).collect();

        batch_q_update(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);

        // Verify all updated
        for (i, &q) in q_values.iter().enumerate() {
            assert!(q > 0.0, "Q-value at index {} should be positive", i);
        }
    }

    #[test]
    #[should_panic(expected = "assertion failed")]
    fn test_batch_q_update_length_mismatch() {
        let mut q_values = vec![0.0, 0.0];
        let rewards = vec![1.0];
        let next_max_q = vec![0.5];

        batch_q_update(&mut q_values, &rewards, &next_max_q, 0.1, 0.95);
    }
}
