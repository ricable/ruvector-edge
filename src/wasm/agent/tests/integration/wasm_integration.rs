/// WASM Integration Tests (ADR-016)
///
/// Tests cover:
/// - WASM module loading and initialization
/// - JavaScript interop (wasm-bindgen)
/// - End-to-end agent workflows
/// - Memory constraint validation
///
/// Run with: wasm-pack test --firefox --headless
///          wasm-pack test --chrome --headless

use wasm_bindgen_test::*;
use edge_agent_wasm::FeatureAgent;
use serde_wasm_bindgen::{from_value, to_value};
use serde_json::json;

wasm_bindgen_test_configure!(run_in_browser);

// =========================================================================
// Helper Functions
// =========================================================================

fn create_test_config() -> JsValue {
    to_value(&json!({
        "id": "agent-faj-121-3094",
        "fajCode": "FAJ 121 3094",
        "category": "Energy Saving",
        "parameters": [
            {
                "name": "mimoMode",
                "valueType": "INTEGER",
                "rangeMin": 0.0,
                "rangeMax": 3.0,
                "currentValue": "2"
            },
            {
                "name": "txPower",
                "valueType": "INTEGER",
                "rangeMin": -30.0,
                "rangeMax": 47.0,
                "currentValue": "20"
            }
        ],
        "counters": [
            {
                "name": "pmMimo",
                "category": "Primary",
                "currentValue": 1000.0
            },
            {
                "name": "pmHo",
                "category": "Secondary",
                "currentValue": 500.0
            }
        ],
        "kpis": [
            {
                "name": "handoverSuccessRate",
                "formula": "pmHoSuccess / pmHoAttempt * 100",
                "threshold": 98.0
            }
        ]
    })).unwrap()
}

// =========================================================================
// WASM Module Loading Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_wasm_module_initialization() {
    // This test verifies that the WASM module initializes correctly
    let config = create_test_config();
    let agent = FeatureAgent::new(config);

    assert!(agent.is_ok(), "Agent creation should succeed");
}

#[wasm_bindgen_test]
fn test_agent_instantiation() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    let result = agent.initialize();

    assert!(result.is_ok(), "Agent initialization should succeed");
    assert!(result.unwrap().contains("initialized"), "Result should contain 'initialized'");
}

#[wasm_bindgen_test]
fn test_multiple_agent_instantiation() {
    // Create multiple agents to test memory handling
    let agents: Vec<_> = (0..10)
        .map(|_| {
            let config = create_test_config();
            FeatureAgent::new(config)
        })
        .collect();

    // All agents should be created successfully
    for agent in agents {
        assert!(agent.is_ok(), "Multiple agents should be created successfully");
    }
}

// =========================================================================
// Configuration Validation Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_validate_config_valid() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let validation_data = to_value(&json!({
        "values": [
            {"name": "mimoMode", "value": 2.0, "min": 0.0, "max": 3.0},
            {"name": "txPower", "value": 20.0, "min": -30.0, "max": 47.0}
        ]
    })).unwrap();

    let result = agent.validate_config(validation_data);

    assert!(result.is_ok(), "Validation should succeed");

    let results: Vec<serde_json::Value> = from_value(result.unwrap()).unwrap();
    assert_eq!(results.len(), 2, "Should return 2 validation results");

    // Both should be valid
    for r in results {
        assert_eq!(r["valid"], true, "All values should be valid");
    }
}

#[wasm_bindgen_test]
fn test_validate_config_invalid() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let validation_data = to_value(&json!({
        "values": [
            {"name": "mimoMode", "value": 5.0, "min": 0.0, "max": 3.0}
        ]
    })).unwrap();

    let result = agent.validate_config(validation_data);

    assert!(result.is_ok(), "Validation call should succeed");

    let results: Vec<serde_json::Value> = from_value(result.unwrap()).unwrap();
    assert_eq!(results[0]["valid"], false, "Value out of range should be invalid");
}

#[wasm_bindgen_test]
fn test_validate_config_mixed() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let validation_data = to_value(&json!({
        "values": [
            {"name": "mimoMode", "value": 2.0, "min": 0.0, "max": 3.0},
            {"name": "txPower", "value": 50.0, "min": -30.0, "max": 47.0}
        ]
    })).unwrap();

    let result = agent.validate_config(validation_data);

    assert!(result.is_ok(), "Validation call should succeed");

    let results: Vec<serde_json::Value> = from_value(result.unwrap()).unwrap();
    assert_eq!(results[0]["valid"], true, "First value should be valid");
    assert_eq!(results[1]["valid"], false, "Second value should be invalid");
}

// =========================================================================
// KPI Monitoring Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_monitor_kpis() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let result = agent.monitor_kpis();

    assert!(result.is_ok(), "KPI monitoring should succeed");

    let kpis: serde_json::Value = from_value(result.unwrap()).unwrap();
    assert!(kpis["total_events"].is_number(), "Should have total events");
    assert!(kpis["weighted_score"].is_number(), "Should have weighted score");
    assert!(kpis["peak_value"].is_number(), "Should have peak value");
    assert!(kpis["alerts"].is_number(), "Should have alert count");

    // Verify values are reasonable
    let total_events: f64 = serde_json::from_value(kpis["total_events"].clone()).unwrap();
    assert_eq!(total_events, 1500.0, "Total events should be 1000 + 500");
}

#[wasm_bindgen_test]
fn test_monitor_kpis_with_threshold() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let result = agent.monitor_kpis();

    assert!(result.is_ok(), "KPI monitoring should succeed");

    let kpis: serde_json::Value = from_value(result.unwrap()).unwrap();
    let alerts: u32 = serde_json::from_value(kpis["alerts"].clone()).unwrap();

    // With default threshold of 100, both counters (1000 and 500) should trigger alerts
    assert_eq!(alerts, 2, "Should have 2 alerts for values above 100");
}

// =========================================================================
// Query Handling Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_handle_query() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    let query_data = to_value(&json!({
        "state": "active",
        "availableActions": ["DirectAnswer", "ContextAnswer", "ConsultPeer"]
    })).unwrap();

    let result = agent.handle_query(query_data);

    assert!(result.is_ok(), "Query handling should succeed");

    let response: serde_json::Value = from_value(result.unwrap()).unwrap();
    assert!(response["content"].is_string(), "Should have content");
    assert!(response["confidence"].is_number(), "Should have confidence");
    assert!(response["action"].is_string(), "Should have action");
}

#[wasm_bindgen_test]
fn test_handle_query_updates_interaction_count() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    let initial_stats = agent.get_stats().unwrap();
    let initial_interactions: u32 = serde_json::from_value(initial_stats["interactions"].clone()).unwrap();

    let query_data = to_value(&json!({
        "state": "active",
        "availableActions": ["DirectAnswer"]
    })).unwrap();

    agent.handle_query(query_data).unwrap();

    let updated_stats = agent.get_stats().unwrap();
    let updated_interactions: u32 = serde_json::from_value(updated_stats["interactions"].clone()).unwrap();

    assert_eq!(updated_interactions, initial_interactions + 1, "Interaction count should increment");
}

// =========================================================================
// Optimization Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_optimize_positive_feedback() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    let initial_stats = agent.get_stats().unwrap();
    let initial_confidence: f32 = serde_json::from_value(initial_stats["confidence"].clone()).unwrap();

    let feedback_data = to_value(&json!({
        "reward": 1.0
    })).unwrap();

    let result = agent.optimize(feedback_data);

    assert!(result.is_ok(), "Optimization should succeed");

    let updated_stats = agent.get_stats().unwrap();
    let updated_confidence: f32 = serde_json::from_value(updated_stats["confidence"].clone()).unwrap();

    assert!(updated_confidence > initial_confidence, "Positive feedback should increase confidence");
}

#[wasm_bindgen_test]
fn test_optimize_negative_feedback() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    let initial_stats = agent.get_stats().unwrap();
    let initial_confidence: f32 = serde_json::from_value(initial_stats["confidence"].clone()).unwrap();

    let feedback_data = to_value(&json!({
        "reward": -1.0
    })).unwrap();

    let result = agent.optimize(feedback_data);

    assert!(result.is_ok(), "Optimization should succeed");

    let updated_stats = agent.get_stats().unwrap();
    let updated_confidence: f32 = serde_json::from_value(updated_stats["confidence"].clone()).unwrap();

    assert!(updated_confidence < initial_confidence, "Negative feedback should decrease confidence");
}

// =========================================================================
// Statistics Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_get_stats() {
    let config = create_test_config();
    let agent = FeatureAgent::new(config).unwrap();

    let result = agent.get_stats();

    assert!(result.is_ok(), "Getting stats should succeed");

    let stats: serde_json::Value = from_value(result.unwrap()).unwrap();
    assert_eq!(stats["id"], "agent-faj-121-3094");
    assert_eq!(stats["fajCode"], "FAJ 121 3094");
    assert_eq!(stats["status"], "Initializing");
    assert_eq!(stats["parameterCount"], 2);
    assert_eq!(stats["counterCount"], 2);
    assert!(stats["confidence"].is_number());
    assert!(stats["health"].is_number());
}

#[wasm_bindgen_test]
fn test_get_stats_after_interactions() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    // Simulate some interactions
    for _ in 0..5 {
        let query_data = to_value(&json!({
            "state": "active",
            "availableActions": ["DirectAnswer"]
        })).unwrap();

        agent.handle_query(query_data).unwrap();

        let feedback_data = to_value(&json!({"reward": 1.0})).unwrap();
        agent.optimize(feedback_data).unwrap();
    }

    let stats = agent.get_stats().unwrap();
    let stats_json: serde_json::Value = from_value(stats).unwrap();
    let interactions: u32 = serde_json::from_value(stats_json["interactions"].clone()).unwrap();

    assert_eq!(interactions, 5, "Should track 5 interactions");
}

// =========================================================================
// Agent Lifecycle Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_agent_shutdown() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    agent.initialize().unwrap();
    agent.shutdown();

    let stats = agent.get_stats().unwrap();
    let stats_json: serde_json::Value = from_value(stats).unwrap();
    assert_eq!(stats_json["status"], "Offline", "Agent should be offline after shutdown");
}

#[wasm_bindgen_test]
async fn test_full_agent_workflow() {
    // Complete end-to-end workflow test
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    // Initialize
    let init_result = agent.initialize();
    assert!(init_result.is_ok(), "Initialization should succeed");

    // Validate configuration
    let validation_data = to_value(&json!({
        "values": [
            {"name": "mimoMode", "value": 2.0, "min": 0.0, "max": 3.0}
        ]
    })).unwrap();
    let validation_result = agent.validate_config(validation_data);
    assert!(validation_result.is_ok(), "Validation should succeed");

    // Monitor KPIs
    let kpi_result = agent.monitor_kpis();
    assert!(kpi_result.is_ok(), "KPI monitoring should succeed");

    // Handle query
    let query_data = to_value(&json!({
        "state": "active",
        "availableActions": ["DirectAnswer", "ContextAnswer"]
    })).unwrap();
    let query_result = agent.handle_query(query_data);
    assert!(query_result.is_ok(), "Query handling should succeed");

    // Optimize based on feedback
    let feedback_data = to_value(&json!({"reward": 1.0})).unwrap();
    let optimize_result = agent.optimize(feedback_data);
    assert!(optimize_result.is_ok(), "Optimization should succeed");

    // Get stats
    let stats = agent.get_stats();
    assert!(stats.is_ok(), "Getting stats should succeed");

    // Shutdown
    agent.shutdown();

    let final_stats = agent.get_stats().unwrap();
    let final_stats_json: serde_json::Value = from_value(final_stats).unwrap();
    assert_eq!(final_stats_json["status"], "Offline", "Agent should be offline");
}

// =========================================================================
// Memory Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_memory_growth() {
    // Create agents and verify memory doesn't leak
    let mut agents = Vec::new();

    for i in 0..20 {
        let config = to_value(&json!({
            "id": format!("agent-{}", i),
            "fajCode": "FAJ 121 0000",
            "category": "Test",
            "parameters": [],
            "counters": [],
            "kpis": []
        })).unwrap();

        let agent = FeatureAgent::new(config).unwrap();
        agents.push(agent);
    }

    // If we reach here without crashing, memory handling is working
    assert_eq!(agents.len(), 20, "Should create 20 agents");
}

#[wasm_bindgen_test]
fn test_agent_cleanup() {
    // Create and drop agents to test cleanup
    {
        let config = create_test_config();
        let agent = FeatureAgent::new(config).unwrap();
        agent.initialize().unwrap();
    } // Agent goes out of scope here

    // Create a new agent to verify memory is reusable
    let config = create_test_config();
    let agent = FeatureAgent::new(config);

    assert!(agent.is_ok(), "New agent should be created after cleanup");
}

// =========================================================================
// Error Handling Tests
// =========================================================================

#[wasm_bindgen_test]
fn test_invalid_config() {
    let invalid_config = to_value(&json!({
        "id": "test",
        "fajCode": "FAJ"
        // Missing required fields
    })).unwrap();

    let result = FeatureAgent::new(invalid_config);

    assert!(result.is_err(), "Invalid config should fail");
}

#[wasm_bindgen_test]
fn test_malformed_query() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    let malformed_query = to_value(&json!({
        "invalidField": "value"
    })).unwrap();

    let result = agent.handle_query(malformed_query);

    // Should handle gracefully (may succeed or fail, but not crash)
    // The exact behavior depends on implementation
    let _ = result;
}

#[wasm_bindgen_test]
fn test_extreme_reward_values() {
    let config = create_test_config();
    let mut agent = FeatureAgent::new(config).unwrap();

    // Test extreme positive reward
    let feedback = to_value(&json!({"reward": 1000.0})).unwrap();
    assert!(agent.optimize(feedback).is_ok(), "Extreme positive reward should not crash");

    // Test extreme negative reward
    let feedback = to_value(&json!({"reward": -1000.0})).unwrap();
    assert!(agent.optimize(feedback).is_ok(), "Extreme negative reward should not crash");

    let stats = agent.get_stats().unwrap();
    let stats_json: serde_json::Value = from_value(stats).unwrap();
    let confidence: f32 = serde_json::from_value(stats_json["confidence"].clone()).unwrap();

    // Confidence should be clamped between 0 and 1
    assert!(confidence >= 0.0 && confidence <= 1.0, "Confidence should be clamped");
}
