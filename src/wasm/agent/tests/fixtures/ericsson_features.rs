/// Test Fixtures for Ericsson RAN Features (ADR-016)
///
/// Provides realistic test data for:
/// - IFLB (Inter-Frequency Load Balancing) - FAJ 121 3161
/// - DUAC (Downlink User Association Control) - FAJ 121 3094
/// - MCPC (Multi-Cell Power Control) - FAJ 121 3163
/// - ANR (Automatic Neighbor Relation) - FAJ 121 4161
/// - MSM (Mobility State Management) - FAJ 121 4185
/// - MIMO (Multiple Input Multiple Output) - FAJ 121 3097

use serde_json::json;

/// IFLB (Inter-Frequency Load Balancing) - FAJ 121 3161
///
/// Feature Category: Carrier Aggregation
/// Description: Balances load across different frequency layers
pub fn iflb_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-3161",
        "fajCode": "FAJ 121 3161",
        "category": "Inter-Frequency Load Balancing",
        "parameters": [
            {
                "name": "lbTpNonQualFraction",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 100.0,
                "currentValue": "50",
                "description": "Percentage of non-qualified UEs to load balance"
            },
            {
                "name": "lbTpQualFraction",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 100.0,
                "currentValue": "30",
                "description": "Percentage of qualified UEs to load balance"
            },
            {
                "name": "lbHoMargin",
                "valueType": "INTEGER",
                "rangeMin": -72.0,
                "rangeMax": 24.0,
                "currentValue": "3",
                "description": "Handover margin for load balancing (dB)"
            }
        ],
        "counters": [
            {
                "name": "pmLbEval",
                "category": "Primary",
                "currentValue": 1500.0,
                "description": "Load balance evaluations"
            },
            {
                "name": "pmLbHoAtt",
                "category": "Primary",
                "currentValue": 500.0,
                "description": "Load balance handover attempts"
            },
            {
                "name": "pmLbHoSuccess",
                "category": "Primary",
                "currentValue": 485.0,
                "description": "Successful load balance handovers"
            }
        ],
        "kpis": [
            {
                "name": "lbSuccessRate",
                "formula": "pmLbHoSuccess / pmLbHoAtt * 100",
                "threshold": 95.0
            },
            {
                "name": "lbEfficiency",
                "formula": "pmLbHoSuccess / pmLbEval * 100",
                "threshold": 30.0
            }
        ]
    })
}

/// DUAC (Downlink User Association Control) - FAJ 121 3094
///
/// Feature Category: Coverage & Capacity
/// Description: Controls user association for downlink optimization
pub fn duac_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-3094",
        "fajCode": "FAJ 121 3094",
        "category": "Downlink User Association Control",
        "parameters": [
            {
                "name": "duacMode",
                "valueType": "ENUM",
                "rangeMin": 0.0,
                "rangeMax": 2.0,
                "currentValue": "1",
                "description": "DUAC operation mode (0=off, 1=on, 2=auto)"
            },
            {
                "name": "duacCellBarThreshold",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 100.0,
                "currentValue": "80",
                "description": "Threshold for cell barring"
            }
        ],
        "counters": [
            {
                "name": "pmDuacEval",
                "category": "Primary",
                "currentValue": 2000.0,
                "description": "DUAC evaluations"
            },
            {
                "name": "pmDuacAssoc",
                "category": "Primary",
                "currentValue": 1200.0,
                "description": "DUAC associations"
            }
        ],
        "kpis": [
            {
                "name": "associationRate",
                "formula": "pmDuacAssoc / pmDuacEval * 100",
                "threshold": 60.0
            }
        ]
    })
}

/// MCPC (Multi-Cell Power Control) - FAJ 121 3163
///
/// Feature Category: Coverage & Capacity
/// Description: Coordinates power control across multiple cells
pub fn mcpc_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-3163",
        "fajCode": "FAJ 121 3163",
        "category": "Multi-Cell Power Control",
        "parameters": [
            {
                "name": "mimoMode",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 3.0,
                "currentValue": "2",
                "description": "MIMO mode (0=1x2, 1=2x2, 2=4x2, 3=4x4)"
            },
            {
                "name": "txPower",
                "valueType": "INTEGER",
                "rangeMin": -30.0,
                "rangeMax": 47.0,
                "currentValue": "20",
                "description": "TX power in dBm"
            },
            {
                "name": "pucchPower",
                "valueType": "INTEGER",
                "rangeMin": -20.0,
                "rangeMax": 23.0,
                "currentValue": "0",
                "description": "PUCCH power offset"
            }
        ],
        "counters": [
            {
                "name": "pmMimo",
                "category": "Primary",
                "currentValue": 5000.0,
                "description": "MIMO measurements"
            },
            {
                "name": "pmTxPower",
                "category": "Secondary",
                "currentValue": 4500.0,
                "description": "TX power samples"
            }
        ],
        "kpis": [
            {
                "name": "mimoEfficiency",
                "formula": "pmMimo / totalUsers * 100",
                "threshold": 85.0
            }
        ]
    })
}

/// ANR (Automatic Neighbor Relation) - FAJ 121 4161
///
/// Feature Category: Mobility
/// Description: Automatically manages neighbor cell relations
pub fn anr_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-4161",
        "fajCode": "FAJ 121 4161",
        "category": "Automatic Neighbor Relation",
        "parameters": [
            {
                "name": "anrFilter",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 1.0,
                "currentValue": "1",
                "description": "ANR filter (0=off, 1=on)"
            },
            {
                "name": "anrRemoveThreshold",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 100.0,
                "currentValue": "10",
                "description": "Threshold for removing neighbor relations"
            },
            {
                "name": "anrHoSuccessThreshold",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 100.0,
                "currentValue": "90",
                "description": "HO success threshold for ANR"
            }
        ],
        "counters": [
            {
                "name": "pmAnrSuccess",
                "category": "Primary",
                "currentValue": 850.0,
                "description": "Successful ANR operations"
            },
            {
                "name": "pmAnrFail",
                "category": "Primary",
                "currentValue": 50.0,
                "description": "Failed ANR operations"
            },
            {
                "name": "pmAnrRemove",
                "category": "Secondary",
                "currentValue": 15.0,
                "description": "Removed neighbor relations"
            }
        ],
        "kpis": [
            {
                "name": "anrSuccessRate",
                "formula": "pmAnrSuccess / (pmAnrSuccess + pmAnrFail) * 100",
                "threshold": 95.0
            }
        ]
    })
}

/// MSM (Mobility State Management) - FAJ 121 4185
///
/// Feature Category: Mobility
/// Description: Manages UE mobility state for optimization
pub fn msm_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-4185",
        "fajCode": "FAJ 121 4185",
        "category": "Mobility State Management",
        "parameters": [
            {
                "name": "msmStateNormalTime",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 300.0,
                "currentValue": "60",
                "description": "Time threshold for normal state (seconds)"
            },
            {
                "name": "msmStateHighTime",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 300.0,
                "currentValue": "10",
                "description": "Time threshold for high mobility state (seconds)"
            }
        ],
        "counters": [
            {
                "name": "pmMhoNormal",
                "category": "Primary",
                "currentValue": 3000.0,
                "description": "Normal mobility state users"
            },
            {
                "name": "pmMhoHigh",
                "category": "Primary",
                "currentValue": 500.0,
                "description": "High mobility state users"
            }
        ],
        "kpis": [
            {
                "name": "mobilityDistribution",
                "formula": "pmMhoHigh / (pmMhoNormal + pmMhoHigh) * 100",
                "threshold": 20.0
            }
        ]
    })
}

/// MIMO (Multiple Input Multiple Output) - FAJ 121 3097
///
/// Feature Category: MIMO & Antenna
/// Description: Manages MIMO configuration and optimization
pub fn mimo_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-3097",
        "fajCode": "FAJ 121 3097",
        "category": "MIMO Configuration",
        "parameters": [
            {
                "name": "mimoTxMode",
                "valueType": "ENUM",
                "rangeMin": 0.0,
                "rangeMax": 7.0,
                "currentValue": "2",
                "description": "MIMO transmission mode (0-7)"
            },
            {
                "name": "mimoScheme",
                "valueType": "ENUM",
                "rangeMin": 0.0,
                "rangeMax": 2.0,
                "currentValue": "1",
                "description": "MIMO scheme (0=TM1, 1=TM2, 2=TM3)"
            },
            {
                "name": "rankIndicator",
                "valueType": "INTEGER",
                "rangeMin": 1.0,
                "rangeMax": 4.0,
                "currentValue": "2",
                "description": "Rank indicator (1-4)"
            }
        ],
        "counters": [
            {
                "name": "pmMimoMode1",
                "category": "Primary",
                "currentValue": 1000.0,
                "description": "MIMO mode 1 usage"
            },
            {
                "name": "pmMimoMode2",
                "category": "Primary",
                "currentValue": 2000.0,
                "description": "MIMO mode 2 usage"
            },
            {
                "name": "pmMimoMode4",
                "category": "Primary",
                "currentValue": 1500.0,
                "description": "MIMO mode 4 usage"
            }
        ],
        "kpis": [
            {
                "name": "mimoModeDistribution",
                "formula": "pmMimoMode4 / (pmMimoMode1 + pmMimoMode2 + pmMimoMode4) * 100",
                "threshold": 30.0
            }
        ]
    })
}

/// DRX (Discontinuous Reception) - FAJ 121 3101
///
/// Feature Category: UE Handling
/// Description: Manages DRX configuration for power saving
pub fn drx_feature() -> serde_json::Value {
    json!({
        "id": "agent-faj-121-3101",
        "fajCode": "FAJ 121 3101",
        "category": "Discontinuous Reception",
        "parameters": [
            {
                "name": "drxInactivityTimer",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 2560.0,
                "currentValue": "80",
                "description": "DRX inactivity timer (ms)"
            },
            {
                "name": "drxRetxTimer",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 1024.0,
                "currentValue": "80",
                "description": "DRX retransmission timer (ms)"
            },
            {
                "name": "longDrxCycle",
                "valueType": "INTEGER",
                "rangeMin": 10.0,
                "rangeMax": 640.0,
                "currentValue": "160",
                "description": "Long DRX cycle (ms)"
            }
        ],
        "counters": [
            {
                "name": "pmDrxActive",
                "category": "Primary",
                "currentValue": 4000.0,
                "description": "DRX active users"
            },
            {
                "name": "pmDrxPowerSaving",
                "category": "Primary",
                "currentValue": 3500.0,
                "description": "Users in power saving mode"
            }
        ],
        "kpis": [
            {
                "name": "drxPowerSavingRatio",
                "formula": "pmDrxPowerSaving / pmDrxActive * 100",
                "threshold": 85.0
            }
        ]
    })
}

/// Return all available Ericsson RAN feature fixtures
pub fn all_features() -> Vec<serde_json::Value> {
    vec![
        iflb_feature(),
        duac_feature(),
        mcpc_feature(),
        anr_feature(),
        msm_feature(),
        mimo_feature(),
        drx_feature(),
    ]
}

/// Get a random feature fixture
pub fn random_feature() -> serde_json::Value {
    use std::time::{SystemTime, UNIX_EPOCH};

    let features = all_features();
    let index = (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos() % features.len() as u128) as usize;

    features[index].clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_iflb_fixture_structure() {
        let feature = iflb_feature();

        assert_eq!(feature["id"], "agent-faj-121-3161");
        assert_eq!(feature["fajCode"], "FAJ 121 3161");
        assert_eq!(feature["parameters"].as_array().unwrap().len(), 3);
        assert_eq!(feature["counters"].as_array().unwrap().len(), 3);
        assert_eq!(feature["kpis"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_all_features_valid() {
        let features = all_features();

        assert_eq!(features.len(), 7);

        for feature in features {
            assert!(feature["id"].is_string());
            assert!(feature["fajCode"].is_string());
            assert!(feature["category"].is_string());
            assert!(feature["parameters"].is_array());
            assert!(feature["counters"].is_array());
            assert!(feature["kpis"].is_array());
        }
    }

    #[test]
    fn test_feature_parameters_have_ranges() {
        let features = all_features();

        for feature in features {
            for param in feature["parameters"].as_array().unwrap() {
                assert!(param["rangeMin"].is_number());
                assert!(param["rangeMax"].is_number());
            }
        }
    }

    #[test]
    fn test_feature_counters_have_values() {
        let features = all_features();

        for feature in features {
            for counter in feature["counters"].as_array().unwrap() {
                assert!(counter["currentValue"].is_number());
            }
        }
    }

    #[test]
    fn test_feature_kpis_have_thresholds() {
        let features = all_features();

        for feature in features {
            for kpi in feature["kpis"].as_array().unwrap() {
                assert!(kpi["threshold"].is_number());
            }
        }
    }
}
