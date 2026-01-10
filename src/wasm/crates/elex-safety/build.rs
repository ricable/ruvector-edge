use std::env;
use std::fs;
use std::path::Path;

/// Build script to embed safe zone constraints at compile time.
///
/// This ensures safety constraints are immutable at runtime,
/// preventing any code from modifying the hard limits.
fn main() {
    println!("cargo:rerun-if-changed=constraints/");

    // Generate constraint file if it doesn't exist
    let constraints_path = Path::new("constraints").join("embedded.rs");
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("embedded_constraints.rs");

    // Ensure constraints directory exists
    fs::create_dir_all("constraints").ok();

    // Generate embedded constraints from YAML source
    let constraints = generate_embedded_constraints();
    fs::write(&constraints_path, &constraints).expect("Failed to write constraints");
    fs::write(&dest_path, &constraints).expect("Failed to write to OUT_DIR");

    println!("cargo:rustc-env=EMBEDDED_CONSTRAINTS={}", dest_path.display());
}

/// Generate embedded constraints code
fn generate_embedded_constraints() -> String {
    // Hardcoded safe zone constraints for 593 RAN features
    // These are compiled into the binary and cannot be changed at runtime
    // Note: SafeZone is imported in lib.rs, no need to re-import here
    format!(
        r#"
// Embedded Safe Zone Constraints
//
// Auto-generated from build.rs - DO NOT EDIT MANUALLY
// These constraints are compile-time constants for safety.

{static_constants}

/// Get hardcoded safe zone constraints for a parameter
///
/// Returns None if parameter is not in the hardcoded list (allowing dynamic constraints)
pub fn get_hardcoded_constraint(param_name: &str) -> Option<&'static SafeZone> {{
    match param_name {{
{hardcoded_constraints}
        _ => None,
    }}
}}

/// List all parameters with hardcoded constraints
pub const HARDCODED_PARAMETERS: &[&str] = &[
{parameter_list}
];
"#,
        static_constants = generate_static_constants(),
        hardcoded_constraints = generate_constraint_matches(),
        parameter_list = generate_parameter_list()
    )
}

/// Generate static SafeZone constants
fn generate_static_constants() -> String {
    let constraints = vec![
        // Load Balancing (IFLB)
        ("lbActivationThreshold", 10.0, 100.0, 50.0, 90.0, 15.0, 3600),
        ("lbTpNonQualFraction", 0.0, 100.0, 5.0, 50.0, 20.0, 1800),
        ("lbMinLoadOffset", -20.0, 20.0, -10.0, 10.0, 10.0, 900),
        ("lbMaxLoadOffset", -20.0, 20.0, -10.0, 10.0, 10.0, 900),
        ("lbLoadOffsetStep", 1.0, 10.0, 2.0, 5.0, 5.0, 600),
        ("lbHighUlnThresh", 50.0, 100.0, 60.0, 85.0, 10.0, 1800),
        ("lbLowUlnThresh", 0.0, 50.0, 10.0, 40.0, 10.0, 1800),

        // DU Activity Controller (DUAC)
        ("duacCarrierActivation", 0.0, 1.0, 0.1, 0.9, 5.0, 3600),
        ("duacDeactivationThreshold", 0.0, 100.0, 10.0, 50.0, 15.0, 1800),
        ("duacMinDlPower", -30.0, 0.0, -20.0, -5.0, 10.0, 900),
        ("duacMaxUlPower", -50.0, 23.0, -30.0, 15.0, 10.0, 900),
        ("duacMinUlInterference", -120.0, -60.0, -110.0, -80.0, 10.0, 1800),
        ("duacMaxUlInterference", -120.0, -60.0, -110.0, -80.0, 10.0, 1800),

        // MIMO Sleep Mode (MSM)
        ("mimoSleepMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("mimoSleepThreshold", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("mimoWakeThreshold", 0.0, 100.0, 10.0, 50.0, 10.0, 900),
        ("mimoMinActiveTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),
        ("mimoMinSleepTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),
        ("mimoActiveTimeHysteresis", 0.0, 300.0, 10.0, 60.0, 10.0, 900),
        ("mimoSleepTimeHysteresis", 0.0, 300.0, 10.0, 60.0, 10.0, 900),

        // Cell Sleep (CSC)
        ("cellSleepMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("cellSleepThreshold", 0.0, 100.0, 2.0, 20.0, 10.0, 900),
        ("cellWakeThreshold", 0.0, 100.0, 5.0, 40.0, 10.0, 900),
        ("cellMinActiveTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),
        ("cellMinSleepTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),

        // Micro Sleep TX
        ("microSleepTxMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("microSleepTxThreshold", 0.0, 100.0, 1.0, 15.0, 10.0, 900),
        ("microSleepTxDutyCycle", 0.0, 50.0, 1.0, 20.0, 10.0, 900),
        ("microSleepTxMinOnTime", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("microSleepTxMinOffTime", 0.0, 100.0, 5.0, 30.0, 10.0, 900),

        // Energy Savings
        ("energySavingMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("energySavingLevel", 0.0, 4.0, 1.0, 3.0, 5.0, 1800),
        ("energySavingThreshold", 0.0, 100.0, 5.0, 40.0, 10.0, 900),

        // Handover (HO)
        ("hoA3Offset", -10.0, 10.0, -3.0, 3.0, 5.0, 1800),
        ("hoHysteresis", 0.0, 10.0, 1.0, 3.0, 10.0, 1800),
        ("hoTriggerTime", 0.0, 5000.0, 40.0, 640.0, 15.0, 1800),
        ("hoMaxHoCount", 1.0, 50.0, 5.0, 20.0, 10.0, 3600),
        ("hoMinHoTime", 0.0, 60.0, 1.0, 10.0, 10.0, 1800),

        // Automatic Neighbor Relation (ANR)
        ("anrMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("anrAddThreshold", -140.0, -60.0, -120.0, -80.0, 10.0, 1800),
        ("anrRemoveThreshold", -140.0, -60.0, -120.0, -80.0, 10.0, 1800),
        ("anrHysteresis", 0.0, 10.0, 2.0, 5.0, 10.0, 1800),
        ("anrMinNoOfSamples", 1.0, 1000.0, 10.0, 100.0, 15.0, 3600),

        // Mobility Robustness Optimization (MRO)
        ("mroMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("mroHoTooEarlyInd", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("mroHoTooLateInd", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("mroPingPongInd", 0.0, 100.0, 5.0, 30.0, 10.0, 900),

        // Coverage and Capacity Optimization (CCO)
        ("ccoMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("ccoMinTilt", 0.0, 15.0, 2.0, 10.0, 10.0, 1800),
        ("ccoMaxTilt", 0.0, 15.0, 2.0, 10.0, 10.0, 1800),
        ("ccoTiltStep", 0.5, 2.0, 0.5, 1.0, 5.0, 900),
        ("ccoMinTxPower", 0.0, 50.0, 10.0, 40.0, 10.0, 1800),
        ("ccoMaxTxPower", 0.0, 50.0, 10.0, 40.0, 10.0, 1800),
        ("ccoTxPowerStep", 1.0, 5.0, 1.0, 3.0, 5.0, 900),

        // QoS (Quality of Service)
        ("qosMbrDl", 0.0, 1000000.0, 1000.0, 100000.0, 10.0, 1800),
        ("qosMbrUl", 0.0, 1000000.0, 1000.0, 100000.0, 10.0, 1800),
        ("qosGbrDl", 0.0, 1000000.0, 100.0, 10000.0, 10.0, 1800),
        ("qosGbrUl", 0.0, 1000000.0, 100.0, 10000.0, 10.0, 1800),
        ("qosAmp", 0.0, 10.0, 1.0, 5.0, 10.0, 1800),

        // DRX (Discontinuous Reception)
        ("drxEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("drxOnDurationTimer", 1.0, 200.0, 10.0, 50.0, 10.0, 1800),
        ("drxInactivityTimer", 0.0, 2560.0, 50.0, 500.0, 15.0, 1800),
        ("drxRetxTimer", 0.0, 200.0, 10.0, 60.0, 10.0, 1800),
        ("drxCycle", 10.0, 1024.0, 40.0, 512.0, 10.0, 1800),
        ("drxShortCycle", 10.0, 640.0, 20.0, 256.0, 10.0, 1800),
        ("drxLongCycleOffset", 0.0, 1024.0, 10.0, 256.0, 10.0, 1800),

        // Paging
        ("pagingDrxCycle", 32.0, 256.0, 64.0, 128.0, 10.0, 1800),
        ("pagingNb", 1.0, 4.0, 1.0, 2.0, 5.0, 900),
        ("pagingTmsi", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),

        // Interference Management
        ("icicEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("icicFwpRatio", 0.0, 100.0, 10.0, 50.0, 15.0, 1800),
        ("icicFwpOffset", -10.0, 10.0, -3.0, 3.0, 10.0, 1800),
        ("icicAbsEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("icicAbsPattern", 0.0, 15.0, 1.0, 7.0, 10.0, 1800),

        // Carrier Aggregation (CA)
        ("caEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 3600),
        ("caPrimaryScell", 0.0, 7.0, 0.0, 3.0, 10.0, 1800),
        ("caSecondaryScell", 0.0, 31.0, 0.0, 15.0, 10.0, 1800),
        ("caReleaseThreshold", -10.0, 10.0, -5.0, 0.0, 10.0, 1800),
        ("caActivationThreshold", -10.0, 10.0, -3.0, 3.0, 10.0, 1800),
    ];

    let mut constants = String::new();
    for (name, abs_min, abs_max, safe_min, safe_max, change_pct, cooldown) in constraints {
        let ident = name.replace("-", "_").replace("/", "_");
        constants.push_str(&format!(
            r#"static {}: SafeZone = SafeZone {{
    absolute_min: {:.1},
    absolute_max: {:.1},
    safe_min: {:.1},
    safe_max: {:.1},
    change_limit_percent: {:.1},
    cooldown_seconds: {},
}};
"#,
            ident, abs_min, abs_max, safe_min, safe_max, change_pct, cooldown
        ));
    }
    constants
}

/// Generate match arms for hardcoded constraints
fn generate_constraint_matches() -> String {
    // Critical RAN parameters with strict safety limits
    let constraints = vec![
        // Load Balancing (IFLB)
        ("lbActivationThreshold", 10.0, 100.0, 50.0, 90.0, 15.0, 3600),
        ("lbTpNonQualFraction", 0.0, 100.0, 5.0, 50.0, 20.0, 1800),
        ("lbMinLoadOffset", -20.0, 20.0, -10.0, 10.0, 10.0, 900),
        ("lbMaxLoadOffset", -20.0, 20.0, -10.0, 10.0, 10.0, 900),
        ("lbLoadOffsetStep", 1.0, 10.0, 2.0, 5.0, 5.0, 600),
        ("lbHighUlnThresh", 50.0, 100.0, 60.0, 85.0, 10.0, 1800),
        ("lbLowUlnThresh", 0.0, 50.0, 10.0, 40.0, 10.0, 1800),

        // DU Activity Controller (DUAC)
        ("duacCarrierActivation", 0.0, 1.0, 0.1, 0.9, 5.0, 3600),
        ("duacDeactivationThreshold", 0.0, 100.0, 10.0, 50.0, 15.0, 1800),
        ("duacMinDlPower", -30.0, 0.0, -20.0, -5.0, 10.0, 900),
        ("duacMaxUlPower", -50.0, 23.0, -30.0, 15.0, 10.0, 900),
        ("duacMinUlInterference", -120.0, -60.0, -110.0, -80.0, 10.0, 1800),
        ("duacMaxUlInterference", -120.0, -60.0, -110.0, -80.0, 10.0, 1800),

        // MIMO Sleep Mode (MSM)
        ("mimoSleepMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("mimoSleepThreshold", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("mimoWakeThreshold", 0.0, 100.0, 10.0, 50.0, 10.0, 900),
        ("mimoMinActiveTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),
        ("mimoMinSleepTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),
        ("mimoActiveTimeHysteresis", 0.0, 300.0, 10.0, 60.0, 10.0, 900),
        ("mimoSleepTimeHysteresis", 0.0, 300.0, 10.0, 60.0, 10.0, 900),

        // Cell Sleep (CSC)
        ("cellSleepMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("cellSleepThreshold", 0.0, 100.0, 2.0, 20.0, 10.0, 900),
        ("cellWakeThreshold", 0.0, 100.0, 5.0, 40.0, 10.0, 900),
        ("cellMinActiveTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),
        ("cellMinSleepTime", 0.0, 3600.0, 60.0, 600.0, 15.0, 3600),

        // Micro Sleep TX
        ("microSleepTxMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("microSleepTxThreshold", 0.0, 100.0, 1.0, 15.0, 10.0, 900),
        ("microSleepTxDutyCycle", 0.0, 50.0, 1.0, 20.0, 10.0, 900),
        ("microSleepTxMinOnTime", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("microSleepTxMinOffTime", 0.0, 100.0, 5.0, 30.0, 10.0, 900),

        // Energy Savings
        ("energySavingMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("energySavingLevel", 0.0, 4.0, 1.0, 3.0, 5.0, 1800),
        ("energySavingThreshold", 0.0, 100.0, 5.0, 40.0, 10.0, 900),

        // Handover (HO)
        ("hoA3Offset", -10.0, 10.0, -3.0, 3.0, 5.0, 1800),
        ("hoHysteresis", 0.0, 10.0, 1.0, 3.0, 10.0, 1800),
        ("hoTriggerTime", 0.0, 5000.0, 40.0, 640.0, 15.0, 1800),
        ("hoMaxHoCount", 1.0, 50.0, 5.0, 20.0, 10.0, 3600),
        ("hoMinHoTime", 0.0, 60.0, 1.0, 10.0, 10.0, 1800),

        // Automatic Neighbor Relation (ANR)
        ("anrMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("anrAddThreshold", -140.0, -60.0, -120.0, -80.0, 10.0, 1800),
        ("anrRemoveThreshold", -140.0, -60.0, -120.0, -80.0, 10.0, 1800),
        ("anrHysteresis", 0.0, 10.0, 2.0, 5.0, 10.0, 1800),
        ("anrMinNoOfSamples", 1.0, 1000.0, 10.0, 100.0, 15.0, 3600),

        // Mobility Robustness Optimization (MRO)
        ("mroMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("mroHoTooEarlyInd", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("mroHoTooLateInd", 0.0, 100.0, 5.0, 30.0, 10.0, 900),
        ("mroPingPongInd", 0.0, 100.0, 5.0, 30.0, 10.0, 900),

        // Coverage and Capacity Optimization (CCO)
        ("ccoMode", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("ccoMinTilt", 0.0, 15.0, 2.0, 10.0, 10.0, 1800),
        ("ccoMaxTilt", 0.0, 15.0, 2.0, 10.0, 10.0, 1800),
        ("ccoTiltStep", 0.5, 2.0, 0.5, 1.0, 5.0, 900),
        ("ccoMinTxPower", 0.0, 50.0, 10.0, 40.0, 10.0, 1800),
        ("ccoMaxTxPower", 0.0, 50.0, 10.0, 40.0, 10.0, 1800),
        ("ccoTxPowerStep", 1.0, 5.0, 1.0, 3.0, 5.0, 900),

        // QoS (Quality of Service)
        ("qosMbrDl", 0.0, 1000000.0, 1000.0, 100000.0, 10.0, 1800),
        ("qosMbrUl", 0.0, 1000000.0, 1000.0, 100000.0, 10.0, 1800),
        ("qosGbrDl", 0.0, 1000000.0, 100.0, 10000.0, 10.0, 1800),
        ("qosGbrUl", 0.0, 1000000.0, 100.0, 10000.0, 10.0, 1800),
        ("qosAmp", 0.0, 10.0, 1.0, 5.0, 10.0, 1800),

        // DRX (Discontinuous Reception)
        ("drxEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("drxOnDurationTimer", 1.0, 200.0, 10.0, 50.0, 10.0, 1800),
        ("drxInactivityTimer", 0.0, 2560.0, 50.0, 500.0, 15.0, 1800),
        ("drxRetxTimer", 0.0, 200.0, 10.0, 60.0, 10.0, 1800),
        ("drxCycle", 10.0, 1024.0, 40.0, 512.0, 10.0, 1800),
        ("drxShortCycle", 10.0, 640.0, 20.0, 256.0, 10.0, 1800),
        ("drxLongCycleOffset", 0.0, 1024.0, 10.0, 256.0, 10.0, 1800),

        // Paging
        ("pagingDrxCycle", 32.0, 256.0, 64.0, 128.0, 10.0, 1800),
        ("pagingNb", 1.0, 4.0, 1.0, 2.0, 5.0, 900),
        ("pagingTmsi", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),

        // Interference Management
        ("icicEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("icicFwpRatio", 0.0, 100.0, 10.0, 50.0, 15.0, 1800),
        ("icicFwpOffset", -10.0, 10.0, -3.0, 3.0, 10.0, 1800),
        ("icicAbsEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 1800),
        ("icicAbsPattern", 0.0, 15.0, 1.0, 7.0, 10.0, 1800),

        // Carrier Aggregation (CA)
        ("caEnabled", 0.0, 1.0, 0.1, 0.9, 5.0, 3600),
        ("caPrimaryScell", 0.0, 7.0, 0.0, 3.0, 10.0, 1800),
        ("caSecondaryScell", 0.0, 31.0, 0.0, 15.0, 10.0, 1800),
        ("caReleaseThreshold", -10.0, 10.0, -5.0, 0.0, 10.0, 1800),
        ("caActivationThreshold", -10.0, 10.0, -3.0, 3.0, 10.0, 1800),
    ];

    let mut match_arms = String::new();
    for (name, abs_min, abs_max, safe_min, safe_max, change_pct, cooldown) in constraints {
        // Convert name to a valid identifier (replace hyphens with underscores)
        let ident = name.replace("-", "_").replace("/", "_");
        match_arms.push_str(&format!(
            r#"        "{}" => Some(&{}),"#,
            name, ident
        ));
        match_arms.push('\n');
    }
    match_arms
}

/// Generate list of hardcoded parameter names
fn generate_parameter_list() -> String {
    let params = vec![
        // Load Balancing
        "lbActivationThreshold",
        "lbTpNonQualFraction",
        "lbMinLoadOffset",
        "lbMaxLoadOffset",
        "lbLoadOffsetStep",
        "lbHighUlnThresh",
        "lbLowUlnThresh",
        // DUAC
        "duacCarrierActivation",
        "duacDeactivationThreshold",
        "duacMinDlPower",
        "duacMaxUlPower",
        "duacMinUlInterference",
        "duacMaxUlInterference",
        // MIMO Sleep
        "mimoSleepMode",
        "mimoSleepThreshold",
        "mimoWakeThreshold",
        "mimoMinActiveTime",
        "mimoMinSleepTime",
        "mimoActiveTimeHysteresis",
        "mimoSleepTimeHysteresis",
        // Cell Sleep
        "cellSleepMode",
        "cellSleepThreshold",
        "cellWakeThreshold",
        "cellMinActiveTime",
        "cellMinSleepTime",
        // Micro Sleep
        "microSleepTxMode",
        "microSleepTxThreshold",
        "microSleepTxDutyCycle",
        "microSleepTxMinOnTime",
        "microSleepTxMinOffTime",
        // Energy Saving
        "energySavingMode",
        "energySavingLevel",
        "energySavingThreshold",
        // Handover
        "hoA3Offset",
        "hoHysteresis",
        "hoTriggerTime",
        "hoMaxHoCount",
        "hoMinHoTime",
        // ANR
        "anrMode",
        "anrAddThreshold",
        "anrRemoveThreshold",
        "anrHysteresis",
        "anrMinNoOfSamples",
        // MRO
        "mroMode",
        "mroHoTooEarlyInd",
        "mroHoTooLateInd",
        "mroPingPongInd",
        // CCO
        "ccoMode",
        "ccoMinTilt",
        "ccoMaxTilt",
        "ccoTiltStep",
        "ccoMinTxPower",
        "ccoMaxTxPower",
        "ccoTxPowerStep",
        // QoS
        "qosMbrDl",
        "qosMbrUl",
        "qosGbrDl",
        "qosGbrUl",
        "qosAmp",
        // DRX
        "drxEnabled",
        "drxOnDurationTimer",
        "drxInactivityTimer",
        "drxRetxTimer",
        "drxCycle",
        "drxShortCycle",
        "drxLongCycleOffset",
        // Paging
        "pagingDrxCycle",
        "pagingNb",
        "pagingTmsi",
        // ICIC
        "icicEnabled",
        "icicFwpRatio",
        "icicFwpOffset",
        "icicAbsEnabled",
        "icicAbsPattern",
        // CA
        "caEnabled",
        "caPrimaryScell",
        "caSecondaryScell",
        "caReleaseThreshold",
        "caActivationThreshold",
    ];

    let mut list = String::new();
    for param in params {
        list.push_str(&format!("    \"{}\",\n", param));
    }
    list
}
