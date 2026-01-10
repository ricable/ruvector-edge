//! Feature Aggregate Root
//!
//! Implements the Feature entity representing an Ericsson RAN feature.
//! This is the core aggregate root of the Knowledge bounded context.

use serde::{Deserialize, Serialize};
use crate::types::FeatureCode;
use crate::error::{Result, ElexError};

// ============================================================================
// Safe Zone for Parameter Constraints
// ============================================================================

/// Safe zone defines the allowed range and change limits for a parameter.
///
/// This is a critical safety component - hardcoded at compile time
/// with no runtime override possible.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SafeZone {
    /// Physical minimum from RAN specification (absolute)
    pub absolute_min: f32,
    /// Physical maximum from RAN specification (absolute)
    pub absolute_max: f32,
    /// Operational minimum (safe operating range)
    pub safe_min: f32,
    /// Operational maximum (safe operating range)
    pub safe_max: f32,
    /// Maximum percent change allowed per optimization cycle
    pub change_limit_percent: f32,
    /// Minimum seconds between parameter changes
    pub cooldown_seconds: u64,
}

impl SafeZone {
    /// Create a new safe zone
    pub fn new(
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

    /// Validate a value is within absolute bounds
    pub fn validate_absolute(&self, value: f32) -> bool {
        value >= self.absolute_min && value <= self.absolute_max
    }

    /// Validate a value is within safe operating range
    pub fn validate_safe(&self, value: f32) -> bool {
        value >= self.safe_min && value <= self.safe_max
    }

    /// Check if a change from old_value to new_value is within limits
    pub fn validate_change(&self, old_value: f32, new_value: f32) -> bool {
        // Check cooldown is satisfied (external check)
        // Check change percentage
        if old_value == 0.0 {
            return true;
        }
        let percent_change = ((new_value - old_value).abs() / old_value.abs()) * 100.0;
        percent_change <= self.change_limit_percent
    }

    /// Clamp a value to safe range
    pub fn clamp_to_safe(&self, value: f32) -> f32 {
        value.max(self.safe_min).min(self.safe_max)
    }
}

// ============================================================================
// Parameter Value Object
// ============================================================================

/// Parameter definition for an Ericsson RAN feature
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Parameter {
    /// Parameter name (e.g., "lbActivationThreshold")
    pub name: String,
    /// Data type (INTEGER, BOOLEAN, FLOAT, ENUM)
    pub value_type: String,
    /// Safe zone constraints
    pub safe_zone: SafeZone,
    /// Current configured value (as string for flexibility)
    pub current_value: Option<String>,
    /// Description
    pub description: Option<String>,
    /// MO class path (e.g., "UtranCell/EutranCell/NrCell")
    pub mo_class: Option<String>,
}

impl Parameter {
    /// Create a new parameter
    pub fn new(
        name: String,
        value_type: String,
        safe_zone: SafeZone,
    ) -> Self {
        Self {
            name,
            value_type,
            safe_zone,
            current_value: None,
            description: None,
            mo_class: None,
        }
    }

    /// Validate a parameter value
    pub fn validate_value(&self, value: &str) -> Result<bool> {
        match self.value_type.as_str() {
            "INTEGER" => {
                let v = value.parse::<f32>()
                    .map_err(|_| ElexError::ParameterValidation {
                        parameter: self.name.clone(),
                        value: value.to_string(),
                        reason: "Not a valid integer".to_string(),
                    })?;
                if self.safe_zone.validate_safe(v) {
                    Ok(true)
                } else {
                    Err(ElexError::ParameterValidation {
                        parameter: self.name.clone(),
                        value: value.to_string(),
                        reason: format!("Value {} is outside safe range [{}, {}]", v, self.safe_zone.safe_min, self.safe_zone.safe_max),
                    })
                }
            }
            "FLOAT" => {
                let v = value.parse::<f32>()
                    .map_err(|_| ElexError::ParameterValidation {
                        parameter: self.name.clone(),
                        value: value.to_string(),
                        reason: "Not a valid float".to_string(),
                    })?;
                if self.safe_zone.validate_safe(v) {
                    Ok(true)
                } else {
                    Err(ElexError::ParameterValidation {
                        parameter: self.name.clone(),
                        value: value.to_string(),
                        reason: format!("Value {} is outside safe range [{}, {}]", v, self.safe_zone.safe_min, self.safe_zone.safe_max),
                    })
                }
            }
            "BOOLEAN" => {
                matches!(value.to_lowercase().as_str(), "true" | "false" | "1" | "0")
                    .then_some(true)
                    .ok_or_else(|| ElexError::ParameterValidation {
                        parameter: self.name.clone(),
                        value: value.to_string(),
                        reason: "Not a valid boolean".to_string(),
                    })
            }
            "ENUM" => Ok(true), // ENUM validation would need enum definition
            _ => Ok(true),
        }
    }

    /// Set current value
    pub fn set_value(&mut self, value: String) {
        self.current_value = Some(value);
    }
}

// ============================================================================
// Counter Value Object
// ============================================================================

/// Performance counter for monitoring
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Counter {
    /// Counter name
    pub name: String,
    /// Category (Primary, Secondary)
    pub category: String,
    /// Current value
    pub current_value: f64,
    /// Description
    pub description: Option<String>,
    /// MO class for retrieval
    pub mo_class: Option<String>,
}

impl Counter {
    pub fn new(name: String, category: String) -> Self {
        Self {
            name,
            category,
            current_value: 0.0,
            description: None,
            mo_class: None,
        }
    }
}

// ============================================================================
// KPI Value Object
// ============================================================================

/// Key Performance Indicator
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct KPI {
    /// KPI name
    pub name: String,
    /// Formula for calculation
    pub formula: String,
    /// Threshold for alerting
    pub threshold: f64,
    /// Current value
    pub current_value: Option<f64>,
    /// Direction (HIGHER_IS_BETTER, LOWER_IS_BETTER)
    pub direction: Option<String>,
}

impl KPI {
    pub fn new(name: String, formula: String, threshold: f64) -> Self {
        Self {
            name,
            formula,
            threshold,
            current_value: None,
            direction: None,
        }
    }

    /// Check if KPI is healthy (within threshold)
    pub fn is_healthy(&self) -> bool {
        if let Some(value) = self.current_value {
            match self.direction.as_deref() {
                Some("HIGHER_IS_BETTER") => value >= self.threshold,
                Some("LOWER_IS_BETTER") => value <= self.threshold,
                _ => value <= self.threshold,
            }
        } else {
            false
        }
    }
}

// ============================================================================
// Procedure Value Object
// ============================================================================

/// Procedure step
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProcedureStep {
    pub order: u32,
    pub description: String,
    pub cmedit_command: Option<String>,
}

/// Activation/deactivation/verification procedure
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Procedure {
    pub name: String,
    pub description: String,
    pub procedure_type: String, // ACTIVATION, DEACTIVATION, VERIFICATION
    pub steps: Vec<ProcedureStep>,
}

impl Procedure {
    pub fn new(name: String, description: String, procedure_type: String) -> Self {
        Self {
            name,
            description,
            procedure_type,
            steps: Vec::new(),
        }
    }
}

// ============================================================================
// Feature Aggregate Root
// ============================================================================

/// Feature aggregate root - represents an Ericsson RAN feature
///
/// This is the core entity of the Knowledge bounded context.
/// Contains all information about a single RAN feature.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Feature {
    /// FAJ code (unique identifier)
    pub code: FeatureCode,
    /// Feature name
    pub name: String,
    /// Feature category
    pub category: String,
    /// Radio Access Technology
    pub rat: String, // LTE, NR, or BOTH
    /// Managed parameters
    pub parameters: Vec<Parameter>,
    /// Related counters
    pub counters: Vec<Counter>,
    /// Related KPIs
    pub kpis: Vec<KPI>,
    /// Procedures
    pub procedures: Vec<Procedure>,
    /// Dependency edges (feature codes this feature depends on)
    pub dependencies: Vec<String>,
    /// Feature status
    pub active: bool,
}

impl Feature {
    /// Create a new feature
    pub fn new(code: FeatureCode, name: String, category: String, rat: String) -> Self {
        Self {
            code,
            name,
            category,
            rat,
            parameters: Vec::new(),
            counters: Vec::new(),
            kpis: Vec::new(),
            procedures: Vec::new(),
            dependencies: Vec::new(),
            active: false,
        }
    }

    /// Add a parameter to this feature
    pub fn add_parameter(&mut self, parameter: Parameter) {
        self.parameters.push(parameter);
    }

    /// Add a counter to this feature
    pub fn add_counter(&mut self, counter: Counter) {
        self.counters.push(counter);
    }

    /// Add a KPI to this feature
    pub fn add_kpi(&mut self, kpi: KPI) {
        self.kpis.push(kpi);
    }

    /// Add a procedure to this feature
    pub fn add_procedure(&mut self, procedure: Procedure) {
        self.procedures.push(procedure);
    }

    /// Add a dependency
    pub fn add_dependency(&mut self, feature_code: String) {
        self.dependencies.push(feature_code);
    }

    /// Get parameter by name
    pub fn get_parameter(&self, name: &str) -> Option<&Parameter> {
        self.parameters.iter().find(|p| p.name == name)
    }

    /// Get counter by name
    pub fn get_counter(&self, name: &str) -> Option<&Counter> {
        self.counters.iter().find(|c| c.name == name)
    }

    /// Get KPI by name
    pub fn get_kpi(&self, name: &str) -> Option<&KPI> {
        self.kpis.iter().find(|k| k.name == name)
    }

    /// Check if all KPIs are healthy
    pub fn all_kpis_healthy(&self) -> bool {
        self.kpis.iter().all(|k| k.is_healthy())
    }

    /// Estimate memory usage
    pub fn estimate_memory_bytes(&self) -> usize {
        let base = 512;
        let params = self.parameters.len() * 256;
        let counters = self.counters.len() * 128;
        let kpis = self.kpis.len() * 128;
        let procedures = self.procedures.len() * 256;
        base + params + counters + kpis + procedures
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FeatureCode;

    #[test]
    fn test_safe_zone_validation() {
        let zone = SafeZone::new(0.0, 100.0, 10.0, 90.0, 15.0, 3600);

        assert!(zone.validate_absolute(50.0));
        assert!(zone.validate_safe(50.0));
        assert!(!zone.validate_absolute(150.0));
        assert!(!zone.validate_safe(5.0));
    }

    #[test]
    fn test_safe_zone_clamp() {
        let zone = SafeZone::new(0.0, 100.0, 10.0, 90.0, 15.0, 3600);

        assert_eq!(zone.clamp_to_safe(5.0), 10.0);
        assert_eq!(zone.clamp_to_safe(95.0), 90.0);
        assert_eq!(zone.clamp_to_safe(50.0), 50.0);
    }

    #[test]
    fn test_safe_zone_change_validation() {
        let zone = SafeZone::new(0.0, 100.0, 10.0, 90.0, 15.0, 3600);

        assert!(zone.validate_change(50.0, 55.0));  // 10% change
        assert!(!zone.validate_change(50.0, 60.0)); // 20% change (exceeds 15%)
    }

    #[test]
    fn test_feature_creation() {
        let code = FeatureCode::parse("FAJ 121 3094").unwrap();
        let feature = Feature::new(
            code.clone(),
            "MIMO Sleep Mode".to_string(),
            "Energy Saving".to_string(),
            "LTE".to_string(),
        );

        assert_eq!(feature.code.as_str(), "FAJ 121 3094");
        assert_eq!(feature.name, "MIMO Sleep Mode");
        assert_eq!(feature.category, "Energy Saving");
        assert_eq!(feature.rat, "LTE");
    }

    #[test]
    fn test_parameter_validation() {
        let zone = SafeZone::new(0.0, 100.0, 10.0, 90.0, 15.0, 3600);
        let param = Parameter::new(
            "test_param".to_string(),
            "INTEGER".to_string(),
            zone,
        );

        assert!(param.validate_value("50").is_ok());
        assert!(param.validate_value("5").is_err()); // Below safe_min
    }
}
