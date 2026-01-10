//! Safe Zone Enforcement for RAN Parameters
//!
//! Provides compile-time embedded constraints and SIMD-accelerated
//! validation for 593 RAN parameters across 89 feature domains.

use crate::{SafetyError, SafetyResult, get_hardcoded_constraint};
use elex_simd::VectorOps;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Safe zone constraints for a parameter
///
/// These constraints define the operational boundaries:
///
/// - **absolute_min/max**: Hard limits enforced by hardware/protocol
/// - **safe_min/max**: Recommended operating range for optimization
/// - **change_limit_percent**: Maximum allowed change per adjustment
/// - **cooldown_seconds**: Minimum time between adjustments
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeZone {
    /// Absolute minimum allowed value (hardware/protocol limit)
    pub absolute_min: f32,

    /// Absolute maximum allowed value (hardware/protocol limit)
    pub absolute_max: f32,

    /// Recommended minimum for optimization (safe operating range)
    pub safe_min: f32,

    /// Recommended maximum for optimization (safe operating range)
    pub safe_max: f32,

    /// Maximum allowed change as percentage of current value (%)
    pub change_limit_percent: f32,

    /// Minimum seconds between parameter changes (cooldown)
    pub cooldown_seconds: u64,
}

impl SafeZone {
    /// Create a new SafeZone
    pub const fn new(
        absolute_min: f32,
        absolute_max: f32,
        safe_min: f32,
        safe_max: f32,
        change_limit_percent: f32,
        cooldown_seconds: u64,
    ) -> Self {
        Self {
            absolute_min,
            absolute_max,
            safe_min,
            safe_max,
            change_limit_percent,
            cooldown_seconds,
        }
    }

    /// Check if a value is within absolute bounds
    #[inline]
    pub const fn is_within_absolute_bounds(&self, value: f32) -> bool {
        value >= self.absolute_min && value <= self.absolute_max
    }

    /// Check if a value is within safe bounds
    #[inline]
    pub const fn is_within_safe_bounds(&self, value: f32) -> bool {
        value >= self.safe_min && value <= self.safe_max
    }

    /// Calculate maximum allowed change for a given current value
    #[inline]
    pub fn max_allowed_change(&self, current_value: f32) -> f32 {
        current_value * (self.change_limit_percent / 100.0)
    }

    /// Check if a change exceeds the limit
    #[inline]
    pub fn is_change_within_limit(&self, old_value: f32, new_value: f32) -> bool {
        let change_pct = ((new_value - old_value).abs() / old_value.abs()) * 100.0;
        change_pct <= self.change_limit_percent
    }

    /// Clamp a value to absolute bounds
    #[inline]
    pub fn clamp_to_absolute(&self, value: f32) -> f32 {
        value.clamp(self.absolute_min, self.absolute_max)
    }

    /// Clamp a value to safe bounds
    #[inline]
    pub fn clamp_to_safe(&self, value: f32) -> f32 {
        value.clamp(self.safe_min, self.safe_max)
    }
}

/// Validation violation information
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationViolation {
    /// Name of the parameter that violated constraints
    pub parameter: String,

    /// Old value (before change)
    pub old_value: f32,

    /// New value (proposed change)
    pub new_value: f32,

    /// Type of violation
    pub violation_type: ViolationType,

    /// Severity level
    pub severity: ValidationSeverity,

    /// Human-readable message
    pub message: String,
}

/// Type of constraint violation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ViolationType {
    /// Exceeds absolute maximum
    ExceedsAbsoluteMax,

    /// Below absolute minimum
    BelowAbsoluteMin,

    /// Change too large (exceeds percentage limit)
    ExceedsChangeLimit,

    /// Parameter in cooldown period
    InCooldown,

    /// Outside safe bounds (warning only)
    OutsideSafeBounds,
}

/// Severity of validation violation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ValidationSeverity {
    /// Critical - change MUST be blocked
    Critical,

    /// Warning - change allowed but logged
    Warning,

    /// Info - within safe bounds
    Info,
}

/// Safe zone validator with SIMD acceleration
///
/// Manages parameter constraints and provides parallel validation.
pub struct SafeZoneValidator {
    /// Custom constraints (dynamic, added at runtime)
    custom_zones: HashMap<String, SafeZone>,

    /// Last change timestamp for each parameter (for cooldowns)
    last_change: HashMap<String, u64>,

    /// SIMD operations
    simd_ops: VectorOps,
}

impl SafeZoneValidator {
    /// Create a new validator
    pub fn new() -> Self {
        Self {
            custom_zones: HashMap::new(),
            last_change: HashMap::new(),
            simd_ops: VectorOps::new(),
        }
    }

    /// Add a custom constraint for a parameter
    ///
    /// Custom constraints can be added at runtime for parameters
    /// not in the hardcoded list.
    pub fn add_constraint(&mut self, param_name: String, zone: SafeZone) {
        self.custom_zones.insert(param_name, zone);
    }

    /// Remove a custom constraint
    pub fn remove_constraint(&mut self, param_name: &str) -> bool {
        self.custom_zones.remove(param_name).is_some()
    }

    /// Get constraint for a parameter
    ///
    /// Checks hardcoded constraints first, then custom ones.
    pub fn get_constraint(&self, param_name: &str) -> Option<&SafeZone> {
        // Check hardcoded constraints first
        if let Some(zone) = get_hardcoded_constraint(param_name) {
            return Some(&zone);
        }
        // Fall back to custom constraints
        self.custom_zones.get(param_name)
    }

    /// Validate a single parameter value
    ///
    /// Returns Ok if value is valid, Err with violation details.
    pub fn validate_value(&self, param_name: &str, value: f32) -> SafetyResult<()> {
        let zone = self.get_constraint(param_name)
            .ok_or_else(|| SafetyError::ExceedsAbsoluteMax(
                param_name.to_string(),
                value,
                f32::INFINITY,
            ))?;

        if !zone.is_within_absolute_bounds(value) {
            if value > zone.absolute_max {
                return Err(SafetyError::ExceedsAbsoluteMax(
                    param_name.to_string(),
                    value,
                    zone.absolute_max,
                ));
            } else {
                return Err(SafetyError::BelowAbsoluteMin(
                    param_name.to_string(),
                    value,
                    zone.absolute_min,
                ));
            }
        }

        Ok(())
    }

    /// Validate a parameter change
    ///
    /// Checks:
    /// 1. New value within absolute bounds
    /// 2. Change within percentage limit
    /// 3. Cooldown period expired
    pub fn validate_change(
        &self,
        param_name: &str,
        old_value: f32,
        new_value: f32,
    ) -> SafetyResult<()> {
        let zone = self.get_constraint(param_name)
            .ok_or_else(|| SafetyError::ExceedsAbsoluteMax(
                param_name.to_string(),
                new_value,
                f32::INFINITY,
            ))?;

        // Check absolute bounds
        if !zone.is_within_absolute_bounds(new_value) {
            if new_value > zone.absolute_max {
                return Err(SafetyError::ExceedsAbsoluteMax(
                    param_name.to_string(),
                    new_value,
                    zone.absolute_max,
                ));
            } else {
                return Err(SafetyError::BelowAbsoluteMin(
                    param_name.to_string(),
                    new_value,
                    zone.absolute_min,
                ));
            }
        }

        // Check change limit
        if !zone.is_change_within_limit(old_value, new_value) {
            let change_pct = ((new_value - old_value).abs() / old_value.abs()) * 100.0;
            return Err(SafetyError::ExceedsChangeLimit(
                param_name.to_string(),
                change_pct,
                zone.change_limit_percent,
            ));
        }

        // Check cooldown
        if let Some(last_ts) = self.last_change.get(param_name) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            let elapsed = now.saturating_sub(*last_ts);
            if elapsed < zone.cooldown_seconds {
                return Err(SafetyError::ParameterInCooldown(
                    param_name.to_string(),
                    zone.cooldown_seconds - elapsed,
                ));
            }
        }

        Ok(())
    }

    /// Record a parameter change (updates cooldown timer)
    pub fn record_change(&mut self, param_name: &str) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        self.last_change.insert(param_name.to_string(), now);
    }

    /// SIMD-accelerated batch validation
    ///
    /// Validates multiple parameters in parallel using SIMD.
    /// Returns a vector of violations (empty if all valid).
    pub fn validate_batch(
        &self,
        param_names: &[&str],
        old_values: &[f32],
        new_values: &[f32],
    ) -> Vec<ValidationViolation> {
        assert_eq!(param_names.len(), old_values.len());
        assert_eq!(old_values.len(), new_values.len());

        let n = param_names.len();
        let mut violations = Vec::new();

        // Prepare SIMD buffers
        let mins: Vec<f32> = param_names.iter()
            .map(|&name| {
                self.get_constraint(name)
                    .map(|z| z.absolute_min)
                    .unwrap_or(f32::NEG_INFINITY)
            })
            .collect();

        let maxs: Vec<f32> = param_names.iter()
            .map(|&name| {
                self.get_constraint(name)
                    .map(|z| z.absolute_max)
                    .unwrap_or(f32::INFINITY)
            })
            .collect();

        let mut valid_mask = vec![0u8; n];

        // SIMD validation for bounds checking
        self.simd_ops.validate_parameters(new_values, &mins, &maxs, &mut valid_mask);

        // Check each parameter
        for i in 0..n {
            let param_name = param_names[i];
            let old_val = old_values[i];
            let new_val = new_values[i];

            // Check bounds from SIMD result
            if valid_mask[i] == 0 {
                let zone = self.get_constraint(param_name);
                if let Some(z) = zone {
                    if new_val > z.absolute_max {
                        violations.push(ValidationViolation {
                            parameter: param_name.to_string(),
                            old_value: old_val,
                            new_value: new_val,
                            violation_type: ViolationType::ExceedsAbsoluteMax,
                            severity: ValidationSeverity::Critical,
                            message: format!(
                                "Value {} exceeds absolute maximum {}",
                                new_val, z.absolute_max
                            ),
                        });
                    } else if new_val < z.absolute_min {
                        violations.push(ValidationViolation {
                            parameter: param_name.to_string(),
                            old_value: old_val,
                            new_value: new_val,
                            violation_type: ViolationType::BelowAbsoluteMin,
                            severity: ValidationSeverity::Critical,
                            message: format!(
                                "Value {} below absolute minimum {}",
                                new_val, z.absolute_min
                            ),
                        });
                    }
                }
                continue;
            }

            // Check change limit and cooldown (per-parameter)
            if let Some(zone) = self.get_constraint(param_name) {
                // Check change limit
                if !zone.is_change_within_limit(old_val, new_val) {
                    violations.push(ValidationViolation {
                        parameter: param_name.to_string(),
                        old_value: old_val,
                        new_value: new_val,
                        violation_type: ViolationType::ExceedsChangeLimit,
                        severity: ValidationSeverity::Critical,
                        message: format!(
                            "Change of {:.1}% exceeds limit of {:.1}%",
                            ((new_val - old_val).abs() / old_val.abs()) * 100.0,
                            zone.change_limit_percent
                        ),
                    });
                }

                // Check cooldown
                if let Some(last_ts) = self.last_change.get(param_name) {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                    let elapsed = now.saturating_sub(*last_ts);
                    if elapsed < zone.cooldown_seconds {
                        violations.push(ValidationViolation {
                            parameter: param_name.to_string(),
                            old_value: old_val,
                            new_value: new_val,
                            violation_type: ViolationType::InCooldown,
                            severity: ValidationSeverity::Critical,
                            message: format!(
                                "Parameter in cooldown ({}s remaining)",
                                zone.cooldown_seconds - elapsed
                            ),
                        });
                    }
                }

                // Check safe bounds (warning only)
                if !zone.is_within_safe_bounds(new_val) {
                    violations.push(ValidationViolation {
                        parameter: param_name.to_string(),
                        old_value: old_val,
                        new_value: new_val,
                        violation_type: ViolationType::OutsideSafeBounds,
                        severity: ValidationSeverity::Warning,
                        message: format!(
                            "Value {} outside safe range [{}, {}]",
                            new_val, zone.safe_min, zone.safe_max
                        ),
                    });
                }
            }
        }

        violations
    }

    /// Record multiple parameter changes
    pub fn record_changes(&mut self, param_names: &[&str]) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        for &name in param_names {
            self.last_change.insert(name.to_string(), now);
        }
    }

    /// Clear cooldown timer for a parameter
    pub fn clear_cooldown(&mut self, param_name: &str) {
        self.last_change.remove(param_name);
    }

    /// Clear all cooldown timers
    pub fn clear_all_cooldowns(&mut self) {
        self.last_change.clear();
    }
}

impl Default for SafeZoneValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience function: check a parameter value
pub fn check_parameter_value(param_name: &str, value: f32) -> SafetyResult<()> {
    let validator = SafeZoneValidator::new();
    validator.validate_value(param_name, value)
}

/// Convenience function: validate a parameter change
pub fn validate_parameter_change(
    param_name: &str,
    old_value: f32,
    new_value: f32,
) -> SafetyResult<()> {
    let validator = SafeZoneValidator::new();
    validator.validate_change(param_name, old_value, new_value)
}

/// Simplified violation type for quick checks
pub type SafeViolation = (String, f32, f32); // (param, old, new)

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_zone_bounds() {
        let zone = SafeZone::new(10.0, 100.0, 50.0, 90.0, 15.0, 3600);

        assert!(zone.is_within_absolute_bounds(50.0));
        assert!(zone.is_within_absolute_bounds(10.0));
        assert!(zone.is_within_absolute_bounds(100.0));
        assert!(!zone.is_within_absolute_bounds(5.0));
        assert!(!zone.is_within_absolute_bounds(105.0));

        assert!(zone.is_within_safe_bounds(70.0));
        assert!(!zone.is_within_safe_bounds(40.0));
        assert!(!zone.is_within_safe_bounds(95.0));
    }

    #[test]
    fn test_safe_zone_clamp() {
        let zone = SafeZone::new(10.0, 100.0, 50.0, 90.0, 15.0, 3600);

        assert_eq!(zone.clamp_to_absolute(5.0), 10.0);
        assert_eq!(zone.clamp_to_absolute(105.0), 100.0);
        assert_eq!(zone.clamp_to_absolute(50.0), 50.0);

        assert_eq!(zone.clamp_to_safe(40.0), 50.0);
        assert_eq!(zone.clamp_to_safe(95.0), 90.0);
        assert_eq!(zone.clamp_to_safe(70.0), 70.0);
    }

    #[test]
    fn test_safe_zone_change_limit() {
        let zone = SafeZone::new(10.0, 100.0, 50.0, 90.0, 15.0, 3600);

        assert!(zone.is_change_within_limit(50.0, 55.0)); // 10% change
        assert!(!zone.is_change_within_limit(50.0, 60.0)); // 20% change
        assert!(zone.is_change_within_limit(50.0, 45.0)); // -10% change
    }

    #[test]
    fn test_validator_hardcoded_constraint() {
        let validator = SafeZoneValidator::new();

        // IFLB constraint
        let result = validator.validate_value("lbActivationThreshold", 50.0);
        assert!(result.is_ok());

        let result = validator.validate_value("lbActivationThreshold", 105.0);
        assert!(result.is_err());

        let result = validator.validate_value("lbActivationThreshold", 5.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validator_custom_constraint() {
        let mut validator = SafeZoneValidator::new();

        validator.add_constraint(
            "testParam".to_string(),
            SafeZone::new(0.0, 100.0, 10.0, 90.0, 20.0, 600),
        );

        let result = validator.validate_value("testParam", 50.0);
        assert!(result.is_ok());

        let result = validator.validate_value("testParam", 105.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validator_change_limit() {
        let validator = SafeZoneValidator::new();

        // IFLB has 15% change limit
        let result = validator.validate_change("lbActivationThreshold", 50.0, 55.0);
        assert!(result.is_ok()); // 10% change

        let result = validator.validate_change("lbActivationThreshold", 50.0, 60.0);
        assert!(result.is_err()); // 20% change exceeds 15% limit
    }

    #[test]
    fn test_validator_cooldown() {
        let mut validator = SafeZoneValidator::new();

        // Record a change
        validator.record_change("lbActivationThreshold");

        // Should fail - in cooldown
        let result = validator.validate_change("lbActivationThreshold", 50.0, 55.0);
        assert!(result.is_err());

        // Clear cooldown
        validator.clear_cooldown("lbActivationThreshold");

        // Should succeed
        let result = validator.validate_change("lbActivationThreshold", 50.0, 55.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_batch_validation() {
        let validator = SafeZoneValidator::new();

        let names = vec!["lbActivationThreshold", "lbActivationThreshold"];
        let old_vals = vec![50.0, 60.0];
        let new_vals = vec![55.0, 80.0]; // Second change exceeds 15% limit

        let violations = validator.validate_batch(&names, &old_vals, &new_vals);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].parameter, "lbActivationThreshold");
        assert_eq!(violations[0].old_value, 60.0);
        assert_eq!(violations[0].new_value, 80.0);
    }

    #[test]
    fn test_convenience_functions() {
        let result = check_parameter_value("lbActivationThreshold", 50.0);
        assert!(result.is_ok());

        let result = validate_parameter_change("lbActivationThreshold", 50.0, 55.0);
        assert!(result.is_ok());

        let result = validate_parameter_change("lbActivationThreshold", 50.0, 60.0);
        assert!(result.is_err());
    }
}
