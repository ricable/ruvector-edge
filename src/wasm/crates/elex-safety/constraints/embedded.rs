
// Embedded Safe Zone Constraints
//
// Auto-generated from build.rs - DO NOT EDIT MANUALLY
// These constraints are compile-time constants for safety.

static lbActivationThreshold: SafeZone = SafeZone {
    absolute_min: 10.0,
    absolute_max: 100.0,
    safe_min: 50.0,
    safe_max: 90.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 3600,
};
static lbTpNonQualFraction: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 50.0,
    change_limit_percent: 20.0,
    cooldown_seconds: 1800,
};
static lbMinLoadOffset: SafeZone = SafeZone {
    absolute_min: -20.0,
    absolute_max: 20.0,
    safe_min: -10.0,
    safe_max: 10.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static lbMaxLoadOffset: SafeZone = SafeZone {
    absolute_min: -20.0,
    absolute_max: 20.0,
    safe_min: -10.0,
    safe_max: 10.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static lbLoadOffsetStep: SafeZone = SafeZone {
    absolute_min: 1.0,
    absolute_max: 10.0,
    safe_min: 2.0,
    safe_max: 5.0,
    change_limit_percent: 5.0,
    cooldown_seconds: 600,
};
static lbHighUlnThresh: SafeZone = SafeZone {
    absolute_min: 50.0,
    absolute_max: 100.0,
    safe_min: 60.0,
    safe_max: 85.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static lbLowUlnThresh: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 50.0,
    safe_min: 10.0,
    safe_max: 40.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static duacCarrierActivation: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 3600,
};
static duacDeactivationThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 10.0,
    safe_max: 50.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 1800,
};
static duacMinDlPower: SafeZone = SafeZone {
    absolute_min: -30.0,
    absolute_max: 0.0,
    safe_min: -20.0,
    safe_max: -5.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static duacMaxUlPower: SafeZone = SafeZone {
    absolute_min: -50.0,
    absolute_max: 23.0,
    safe_min: -30.0,
    safe_max: 15.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static duacMinUlInterference: SafeZone = SafeZone {
    absolute_min: -120.0,
    absolute_max: -60.0,
    safe_min: -110.0,
    safe_max: -80.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static duacMaxUlInterference: SafeZone = SafeZone {
    absolute_min: -120.0,
    absolute_max: -60.0,
    safe_min: -110.0,
    safe_max: -80.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static mimoSleepMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static mimoSleepThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 30.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static mimoWakeThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 10.0,
    safe_max: 50.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static mimoMinActiveTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 3600.0,
    safe_min: 60.0,
    safe_max: 600.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 3600,
};
static mimoMinSleepTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 3600.0,
    safe_min: 60.0,
    safe_max: 600.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 3600,
};
static mimoActiveTimeHysteresis: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 300.0,
    safe_min: 10.0,
    safe_max: 60.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static mimoSleepTimeHysteresis: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 300.0,
    safe_min: 10.0,
    safe_max: 60.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static cellSleepMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static cellSleepThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 2.0,
    safe_max: 20.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static cellWakeThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 40.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static cellMinActiveTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 3600.0,
    safe_min: 60.0,
    safe_max: 600.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 3600,
};
static cellMinSleepTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 3600.0,
    safe_min: 60.0,
    safe_max: 600.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 3600,
};
static microSleepTxMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static microSleepTxThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 1.0,
    safe_max: 15.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static microSleepTxDutyCycle: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 50.0,
    safe_min: 1.0,
    safe_max: 20.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static microSleepTxMinOnTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 30.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static microSleepTxMinOffTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 30.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static energySavingMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static energySavingLevel: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 4.0,
    safe_min: 1.0,
    safe_max: 3.0,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static energySavingThreshold: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 40.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static hoA3Offset: SafeZone = SafeZone {
    absolute_min: -10.0,
    absolute_max: 10.0,
    safe_min: -3.0,
    safe_max: 3.0,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static hoHysteresis: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 10.0,
    safe_min: 1.0,
    safe_max: 3.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static hoTriggerTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 5000.0,
    safe_min: 40.0,
    safe_max: 640.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 1800,
};
static hoMaxHoCount: SafeZone = SafeZone {
    absolute_min: 1.0,
    absolute_max: 50.0,
    safe_min: 5.0,
    safe_max: 20.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 3600,
};
static hoMinHoTime: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 60.0,
    safe_min: 1.0,
    safe_max: 10.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static anrMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static anrAddThreshold: SafeZone = SafeZone {
    absolute_min: -140.0,
    absolute_max: -60.0,
    safe_min: -120.0,
    safe_max: -80.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static anrRemoveThreshold: SafeZone = SafeZone {
    absolute_min: -140.0,
    absolute_max: -60.0,
    safe_min: -120.0,
    safe_max: -80.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static anrHysteresis: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 10.0,
    safe_min: 2.0,
    safe_max: 5.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static anrMinNoOfSamples: SafeZone = SafeZone {
    absolute_min: 1.0,
    absolute_max: 1000.0,
    safe_min: 10.0,
    safe_max: 100.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 3600,
};
static mroMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static mroHoTooEarlyInd: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 30.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static mroHoTooLateInd: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 30.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static mroPingPongInd: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 5.0,
    safe_max: 30.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 900,
};
static ccoMode: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static ccoMinTilt: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 15.0,
    safe_min: 2.0,
    safe_max: 10.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static ccoMaxTilt: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 15.0,
    safe_min: 2.0,
    safe_max: 10.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static ccoTiltStep: SafeZone = SafeZone {
    absolute_min: 0.5,
    absolute_max: 2.0,
    safe_min: 0.5,
    safe_max: 1.0,
    change_limit_percent: 5.0,
    cooldown_seconds: 900,
};
static ccoMinTxPower: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 50.0,
    safe_min: 10.0,
    safe_max: 40.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static ccoMaxTxPower: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 50.0,
    safe_min: 10.0,
    safe_max: 40.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static ccoTxPowerStep: SafeZone = SafeZone {
    absolute_min: 1.0,
    absolute_max: 5.0,
    safe_min: 1.0,
    safe_max: 3.0,
    change_limit_percent: 5.0,
    cooldown_seconds: 900,
};
static qosMbrDl: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1000000.0,
    safe_min: 1000.0,
    safe_max: 100000.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static qosMbrUl: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1000000.0,
    safe_min: 1000.0,
    safe_max: 100000.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static qosGbrDl: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1000000.0,
    safe_min: 100.0,
    safe_max: 10000.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static qosGbrUl: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1000000.0,
    safe_min: 100.0,
    safe_max: 10000.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static qosAmp: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 10.0,
    safe_min: 1.0,
    safe_max: 5.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static drxEnabled: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static drxOnDurationTimer: SafeZone = SafeZone {
    absolute_min: 1.0,
    absolute_max: 200.0,
    safe_min: 10.0,
    safe_max: 50.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static drxInactivityTimer: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 2560.0,
    safe_min: 50.0,
    safe_max: 500.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 1800,
};
static drxRetxTimer: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 200.0,
    safe_min: 10.0,
    safe_max: 60.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static drxCycle: SafeZone = SafeZone {
    absolute_min: 10.0,
    absolute_max: 1024.0,
    safe_min: 40.0,
    safe_max: 512.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static drxShortCycle: SafeZone = SafeZone {
    absolute_min: 10.0,
    absolute_max: 640.0,
    safe_min: 20.0,
    safe_max: 256.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static drxLongCycleOffset: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1024.0,
    safe_min: 10.0,
    safe_max: 256.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static pagingDrxCycle: SafeZone = SafeZone {
    absolute_min: 32.0,
    absolute_max: 256.0,
    safe_min: 64.0,
    safe_max: 128.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static pagingNb: SafeZone = SafeZone {
    absolute_min: 1.0,
    absolute_max: 4.0,
    safe_min: 1.0,
    safe_max: 2.0,
    change_limit_percent: 5.0,
    cooldown_seconds: 900,
};
static pagingTmsi: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static icicEnabled: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static icicFwpRatio: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 100.0,
    safe_min: 10.0,
    safe_max: 50.0,
    change_limit_percent: 15.0,
    cooldown_seconds: 1800,
};
static icicFwpOffset: SafeZone = SafeZone {
    absolute_min: -10.0,
    absolute_max: 10.0,
    safe_min: -3.0,
    safe_max: 3.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static icicAbsEnabled: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 1800,
};
static icicAbsPattern: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 15.0,
    safe_min: 1.0,
    safe_max: 7.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static caEnabled: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 1.0,
    safe_min: 0.1,
    safe_max: 0.9,
    change_limit_percent: 5.0,
    cooldown_seconds: 3600,
};
static caPrimaryScell: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 7.0,
    safe_min: 0.0,
    safe_max: 3.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static caSecondaryScell: SafeZone = SafeZone {
    absolute_min: 0.0,
    absolute_max: 31.0,
    safe_min: 0.0,
    safe_max: 15.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static caReleaseThreshold: SafeZone = SafeZone {
    absolute_min: -10.0,
    absolute_max: 10.0,
    safe_min: -5.0,
    safe_max: 0.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};
static caActivationThreshold: SafeZone = SafeZone {
    absolute_min: -10.0,
    absolute_max: 10.0,
    safe_min: -3.0,
    safe_max: 3.0,
    change_limit_percent: 10.0,
    cooldown_seconds: 1800,
};


/// Get hardcoded safe zone constraints for a parameter
///
/// Returns None if parameter is not in the hardcoded list (allowing dynamic constraints)
pub fn get_hardcoded_constraint(param_name: &str) -> Option<&'static SafeZone> {
    match param_name {
        "lbActivationThreshold" => Some(&lbActivationThreshold),
        "lbTpNonQualFraction" => Some(&lbTpNonQualFraction),
        "lbMinLoadOffset" => Some(&lbMinLoadOffset),
        "lbMaxLoadOffset" => Some(&lbMaxLoadOffset),
        "lbLoadOffsetStep" => Some(&lbLoadOffsetStep),
        "lbHighUlnThresh" => Some(&lbHighUlnThresh),
        "lbLowUlnThresh" => Some(&lbLowUlnThresh),
        "duacCarrierActivation" => Some(&duacCarrierActivation),
        "duacDeactivationThreshold" => Some(&duacDeactivationThreshold),
        "duacMinDlPower" => Some(&duacMinDlPower),
        "duacMaxUlPower" => Some(&duacMaxUlPower),
        "duacMinUlInterference" => Some(&duacMinUlInterference),
        "duacMaxUlInterference" => Some(&duacMaxUlInterference),
        "mimoSleepMode" => Some(&mimoSleepMode),
        "mimoSleepThreshold" => Some(&mimoSleepThreshold),
        "mimoWakeThreshold" => Some(&mimoWakeThreshold),
        "mimoMinActiveTime" => Some(&mimoMinActiveTime),
        "mimoMinSleepTime" => Some(&mimoMinSleepTime),
        "mimoActiveTimeHysteresis" => Some(&mimoActiveTimeHysteresis),
        "mimoSleepTimeHysteresis" => Some(&mimoSleepTimeHysteresis),
        "cellSleepMode" => Some(&cellSleepMode),
        "cellSleepThreshold" => Some(&cellSleepThreshold),
        "cellWakeThreshold" => Some(&cellWakeThreshold),
        "cellMinActiveTime" => Some(&cellMinActiveTime),
        "cellMinSleepTime" => Some(&cellMinSleepTime),
        "microSleepTxMode" => Some(&microSleepTxMode),
        "microSleepTxThreshold" => Some(&microSleepTxThreshold),
        "microSleepTxDutyCycle" => Some(&microSleepTxDutyCycle),
        "microSleepTxMinOnTime" => Some(&microSleepTxMinOnTime),
        "microSleepTxMinOffTime" => Some(&microSleepTxMinOffTime),
        "energySavingMode" => Some(&energySavingMode),
        "energySavingLevel" => Some(&energySavingLevel),
        "energySavingThreshold" => Some(&energySavingThreshold),
        "hoA3Offset" => Some(&hoA3Offset),
        "hoHysteresis" => Some(&hoHysteresis),
        "hoTriggerTime" => Some(&hoTriggerTime),
        "hoMaxHoCount" => Some(&hoMaxHoCount),
        "hoMinHoTime" => Some(&hoMinHoTime),
        "anrMode" => Some(&anrMode),
        "anrAddThreshold" => Some(&anrAddThreshold),
        "anrRemoveThreshold" => Some(&anrRemoveThreshold),
        "anrHysteresis" => Some(&anrHysteresis),
        "anrMinNoOfSamples" => Some(&anrMinNoOfSamples),
        "mroMode" => Some(&mroMode),
        "mroHoTooEarlyInd" => Some(&mroHoTooEarlyInd),
        "mroHoTooLateInd" => Some(&mroHoTooLateInd),
        "mroPingPongInd" => Some(&mroPingPongInd),
        "ccoMode" => Some(&ccoMode),
        "ccoMinTilt" => Some(&ccoMinTilt),
        "ccoMaxTilt" => Some(&ccoMaxTilt),
        "ccoTiltStep" => Some(&ccoTiltStep),
        "ccoMinTxPower" => Some(&ccoMinTxPower),
        "ccoMaxTxPower" => Some(&ccoMaxTxPower),
        "ccoTxPowerStep" => Some(&ccoTxPowerStep),
        "qosMbrDl" => Some(&qosMbrDl),
        "qosMbrUl" => Some(&qosMbrUl),
        "qosGbrDl" => Some(&qosGbrDl),
        "qosGbrUl" => Some(&qosGbrUl),
        "qosAmp" => Some(&qosAmp),
        "drxEnabled" => Some(&drxEnabled),
        "drxOnDurationTimer" => Some(&drxOnDurationTimer),
        "drxInactivityTimer" => Some(&drxInactivityTimer),
        "drxRetxTimer" => Some(&drxRetxTimer),
        "drxCycle" => Some(&drxCycle),
        "drxShortCycle" => Some(&drxShortCycle),
        "drxLongCycleOffset" => Some(&drxLongCycleOffset),
        "pagingDrxCycle" => Some(&pagingDrxCycle),
        "pagingNb" => Some(&pagingNb),
        "pagingTmsi" => Some(&pagingTmsi),
        "icicEnabled" => Some(&icicEnabled),
        "icicFwpRatio" => Some(&icicFwpRatio),
        "icicFwpOffset" => Some(&icicFwpOffset),
        "icicAbsEnabled" => Some(&icicAbsEnabled),
        "icicAbsPattern" => Some(&icicAbsPattern),
        "caEnabled" => Some(&caEnabled),
        "caPrimaryScell" => Some(&caPrimaryScell),
        "caSecondaryScell" => Some(&caSecondaryScell),
        "caReleaseThreshold" => Some(&caReleaseThreshold),
        "caActivationThreshold" => Some(&caActivationThreshold),

        _ => None,
    }
}

/// List all parameters with hardcoded constraints
pub const HARDCODED_PARAMETERS: &[&str] = &[
    "lbActivationThreshold",
    "lbTpNonQualFraction",
    "lbMinLoadOffset",
    "lbMaxLoadOffset",
    "lbLoadOffsetStep",
    "lbHighUlnThresh",
    "lbLowUlnThresh",
    "duacCarrierActivation",
    "duacDeactivationThreshold",
    "duacMinDlPower",
    "duacMaxUlPower",
    "duacMinUlInterference",
    "duacMaxUlInterference",
    "mimoSleepMode",
    "mimoSleepThreshold",
    "mimoWakeThreshold",
    "mimoMinActiveTime",
    "mimoMinSleepTime",
    "mimoActiveTimeHysteresis",
    "mimoSleepTimeHysteresis",
    "cellSleepMode",
    "cellSleepThreshold",
    "cellWakeThreshold",
    "cellMinActiveTime",
    "cellMinSleepTime",
    "microSleepTxMode",
    "microSleepTxThreshold",
    "microSleepTxDutyCycle",
    "microSleepTxMinOnTime",
    "microSleepTxMinOffTime",
    "energySavingMode",
    "energySavingLevel",
    "energySavingThreshold",
    "hoA3Offset",
    "hoHysteresis",
    "hoTriggerTime",
    "hoMaxHoCount",
    "hoMinHoTime",
    "anrMode",
    "anrAddThreshold",
    "anrRemoveThreshold",
    "anrHysteresis",
    "anrMinNoOfSamples",
    "mroMode",
    "mroHoTooEarlyInd",
    "mroHoTooLateInd",
    "mroPingPongInd",
    "ccoMode",
    "ccoMinTilt",
    "ccoMaxTilt",
    "ccoTiltStep",
    "ccoMinTxPower",
    "ccoMaxTxPower",
    "ccoTxPowerStep",
    "qosMbrDl",
    "qosMbrUl",
    "qosGbrDl",
    "qosGbrUl",
    "qosAmp",
    "drxEnabled",
    "drxOnDurationTimer",
    "drxInactivityTimer",
    "drxRetxTimer",
    "drxCycle",
    "drxShortCycle",
    "drxLongCycleOffset",
    "pagingDrxCycle",
    "pagingNb",
    "pagingTmsi",
    "icicEnabled",
    "icicFwpRatio",
    "icicFwpOffset",
    "icicAbsEnabled",
    "icicAbsPattern",
    "caEnabled",
    "caPrimaryScell",
    "caSecondaryScell",
    "caReleaseThreshold",
    "caActivationThreshold",

];
