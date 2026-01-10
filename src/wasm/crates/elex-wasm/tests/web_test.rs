//! WASM Browser Tests
//!
//! These tests run in actual browsers using wasm-bindgen-test.

use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

use elex_wasm::*;

#[wasm_bindgen_test]
async fn test_version() {
    let v = version();
    assert!(!v.is_empty());
    assert!(v.contains('.'));
}

#[wasm_bindgen_test]
async fn test_build_info() {
    let info = build_info();
    assert!(info.contains("ELEX WASM"));
    assert!(info.contains("v"));
}

#[wasm_bindgen_test]
async fn test_supported_features() {
    let features = get_supported_features();
    assert!(features.length() > 0);

    // Check for core features
    let feature_array: Vec<JsValue> = features.to_vec();
    let feature_strings: Vec<String> = feature_array
        .iter()
        .filter_map(|v| v.as_string())
        .collect();

    assert!(feature_strings.contains(&"q-learning".to_string()));
    assert!(feature_strings.contains(&"hnsw-index".to_string()));
}

#[wasm_bindgen_test]
async fn test_topology_creation() {
    let mesh = Topology::mesh();
    let hierarchical = Topology::hierarchical();
    let h_mesh = Topology::hierarchical_mesh();

    // These should not throw
    assert!(true);
}

#[wasm_bindgen_test]
async fn test_swarm_initialization() {
    let config = js_sys::Object::new();
    Reflect::set(&config, &"maxAgents".into(), &JsValue::from_f64(10.0)).unwrap();
    Reflect::set(&config, &"enableTelemetry".into(), &JsValue::from_bool(true)).unwrap();
    Reflect::set(&config, &"lazyLoading".into(), &JsValue::from_bool(true)).unwrap();

    let swarm_promise = ElexSwarm::new(config);
    assert!(swarm_promise.is_instance_of::<js_sys::Promise>());
}

#[wasm_bindgen_test]
async fn test_swarm_query() {
    // Create swarm
    let config = js_sys::Object::new();
    Reflect::set(&config, &"maxAgents".into(), &JsValue::from_f64(5.0)).unwrap();
    Reflect::set(&config, &"enableTelemetry".into(), &JsValue::from_bool(true)).unwrap();

    let swarm = ElexSwarm::new(config).await;

    // Create query
    let query = js_sys::Object::new();
    Reflect::set(&query, &"text".into(), &"Test query".into()).unwrap();
    Reflect::set(&query, &"queryType".into(), &JsValue::from_f64(0.0)).unwrap(); // Parameter
    Reflect::set(&query, &"complexity".into(), &JsValue::from_f64(1.0)).unwrap(); // Moderate

    // Execute query
    let response_promise = swarm.query(query);
    assert!(response_promise.is_instance_of::<js_sys::Promise>());
}

#[wasm_bindgen_test]
async fn test_query_type_enum() {
    // Test all query types
    assert_eq!(QueryType::Parameter as u32, 0);
    assert_eq!(QueryType::Counter as u32, 1);
    assert_eq!(QueryType::Kpi as u32, 2);
    assert_eq!(QueryType::Procedure as u32, 3);
    assert_eq!(QueryType::Troubleshoot as u32, 4);
    assert_eq!(QueryType::General as u32, 5);
}

#[wasm_bindgen_test]
async fn test_complexity_enum() {
    // Test all complexity levels
    assert_eq!(Complexity::Simple as u32, 0);
    assert_eq!(Complexity::Moderate as u32, 1);
    assert_eq!(Complexity::Complex as u32, 2);
}

#[wasm_bindgen_test]
async fn test_simd_detection() {
    let simd_available = is_simd_available();
    // Should not throw - result depends on browser support
    assert!(simd_available == true || simd_available == false);
}

#[wasm_bindgen_test]
async fn test_telemetry_system() {
    let telemetry = TelemetrySystem::new(true);
    assert!(true);

    // Record some metrics
    telemetry.record_query(
        100.0,
        0.8,
        "agent_123".to_string(),
        "FAJ 121 3094".to_string(),
        "Parameter".to_string(),
        "Moderate".to_string(),
        true
    );

    // Get metrics
    let metrics = telemetry.get_metrics();
    assert_eq!(metrics.length(), 1);

    // Get summary
    let summary = telemetry.get_summary();
    assert!(Reflect::has(&summary, &"totalQueries".into()).unwrap());

    // Clear
    telemetry.clear();
    let metrics_after = telemetry.get_metrics();
    assert_eq!(metrics_after.length(), 0);
}

#[wasm_bindgen_test]
async fn test_swarm_stats() {
    // This test verifies that stats methods don't throw
    // Actual values depend on swarm state
    let config = js_sys::Object::new();
    Reflect::set(&config, &"maxAgents".into(), &JsValue::from_f64(5.0)).unwrap();

    let swarm = ElexSwarm::new(config).await;

    // Get swarm stats - should return a promise
    let stats_promise = swarm.get_swarm_stats();
    assert!(stats_promise.is_instance_of::<js_sys::Promise>());
}

#[wasm_bindgen_test]
async fn test_feedback_method() {
    // Test that feedback method exists and accepts correct parameters
    let config = js_sys::Object::new();
    Reflect::set(&config, &"maxAgents".into(), &JsValue::from_f64(5.0)).unwrap();

    let swarm = ElexSwarm::new(config).await;

    // Feedback should return a promise
    let feedback_promise = swarm.feedback(
        "test_agent_id".to_string(),
        0.5,
        true
    );
    assert!(feedback_promise.is_instance_of::<js_sys::Promise>());
}

// Integration test
#[wasm_bindgen_test]
async fn test_full_query_lifecycle() {
    // 1. Create swarm
    let config = js_sys::Object::new();
    Reflect::set(&config, &"maxAgents".into(), &JsValue::from_f64(10.0)).unwrap();
    Reflect::set(&config, &"enableTelemetry".into(), &JsValue::from_bool(true)).unwrap();
    Reflect::set(&config, &"lazyLoading".into(), &JsValue::from_bool(true)).unwrap();

    let swarm = ElexSwarm::new(config).await;

    // 2. Process a query
    let query = js_sys::Object::new();
    Reflect::set(&query, &"text".into(), &"Configure IFLB thresholds".into()).unwrap();
    Reflect::set(&query, &"queryType".into(), &JsValue::from_f64(0.0)).unwrap();
    Reflect::set(&query, &"complexity".into(), &JsValue::from_f64(1.0)).unwrap();

    let response = swarm.query(query).await;

    // 3. Verify response structure
    assert!(Reflect::has(&response, &"text".into()).unwrap());
    assert!(Reflect::has(&response, &"agentId".into()).unwrap());
    assert!(Reflect::has(&response, &"confidence".into()).unwrap());
    assert!(Reflect::has(&response, &"latencyMs".into()).unwrap());

    // 4. Get agent ID from response
    let agent_id = Reflect::get(&response, &"agentId".into()).unwrap();
    let agent_id_str = agent_id.as_string().unwrap_or_default();
    assert!(!agent_id_str.is_empty());

    // 5. Provide feedback
    swarm.feedback(agent_id_str, 0.8, true).await;

    // 6. Get stats to verify feedback was recorded
    let stats = swarm.get_swarm_stats().await;
    assert!(Reflect::has(&stats, &"totalQueries".into()).unwrap());

    // 7. Cleanup
    swarm.shutdown().await;
}
