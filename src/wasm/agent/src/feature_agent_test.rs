/// Unit Tests for Feature Agent Module (ADR-016)
///
/// Tests cover:
/// - Agent creation and initialization
/// - Lifecycle state transitions
/// - Confidence updates
/// - Cold start transition
/// - Query recording and statistics
/// - Memory estimation
/// - Edge cases and boundary conditions

#[cfg(test)]
mod feature_agent_unit_tests {
    use crate::feature_agent::{
        FeatureAgentWasm, AgentStatus, Parameter, Counter, KPI,
        AgentAction, AgentStats,
    };

    const EPSILON: f32 = 1e-6;

    fn assert_float_eq(a: f32, b: f32, msg: &str) {
        assert!((a - b).abs() < EPSILON, "{}: expected {}, got {}", msg, b, a);
    }

    fn create_test_agent() -> FeatureAgentWasm {
        FeatureAgentWasm::new(
            "agent-faj-121-3094".to_string(),
            "FAJ 121 3094".to_string(),
            "Energy Saving".to_string(),
            vec![
                Parameter {
                    name: "mimoMode".to_string(),
                    value_type: "INTEGER".to_string(),
                    range_min: Some(0.0),
                    range_max: Some(3.0),
                    current_value: Some("2".to_string()),
                    description: Some("MIMO mode".to_string()),
                },
                Parameter {
                    name: "txPower".to_string(),
                    value_type: "INTEGER".to_string(),
                    range_min: Some(-30.0),
                    range_max: Some(47.0),
                    current_value: Some("20".to_string()),
                    description: None,
                },
            ],
            vec![
                Counter {
                    name: "pmMimo".to_string(),
                    category: "Primary".to_string(),
                    current_value: 1000.0,
                    description: Some("MIMO counter".to_string()),
                },
                Counter {
                    name: "pmHo".to_string(),
                    category: "Secondary".to_string(),
                    current_value: 500.0,
                    description: None,
                },
            ],
            vec![
                KPI {
                    name: "handoverSuccessRate".to_string(),
                    formula: "pmHoSuccess / pmHoAttempt * 100".to_string(),
                    threshold: 98.0,
                    current_value: Some(99.5),
                },
                KPI {
                    name: "throughput".to_string(),
                    formula: "pmDataVol / pmTime".to_string(),
                    threshold: 100.0,
                    current_value: None,
                },
            ],
        )
    }

    // =========================================================================
    // Agent Creation Tests
    // =========================================================================

    #[test]
    fn test_agent_creation_basic() {
        let agent = FeatureAgentWasm::new(
            "agent-test".to_string(),
            "FAJ 121 0000".to_string(),
            "Test".to_string(),
            vec![],
            vec![],
            vec![],
        );

        assert_eq!(agent.id, "agent-test");
        assert_eq!(agent.faj_code, "FAJ 121 0000");
        assert_eq!(agent.category, "Test");
        assert_eq!(agent.status, AgentStatus::Initializing);
        assert_float_eq(agent.confidence, 0.5, "Initial confidence");
        assert_float_eq(agent.health, 1.0, "Initial health");
        assert_eq!(agent.interaction_count, 0);
    }

    #[test]
    fn test_agent_default() {
        let agent = FeatureAgentWasm::default();

        assert_eq!(agent.status, AgentStatus::Initializing);
        assert_float_eq(agent.confidence, 0.5, "Default confidence");
        assert_eq!(agent.interaction_count, 0);
        assert_eq!(agent.parameter_count(), 0);
        assert_eq!(agent.counter_count(), 0);
        assert_eq!(agent.kpi_count(), 0);
    }

    #[test]
    fn test_agent_with_full_data() {
        let agent = create_test_agent();

        assert_eq!(agent.id, "agent-faj-121-3094");
        assert_eq!(agent.faj_code, "FAJ 121 3094");
        assert_eq!(agent.category, "Energy Saving");
        assert_eq!(agent.parameter_count(), 2);
        assert_eq!(agent.counter_count(), 2);
        assert_eq!(agent.kpi_count(), 2);
    }

    // =========================================================================
    // Lifecycle State Tests
    // =========================================================================

    #[test]
    fn test_agent_is_ready() {
        let mut agent = create_test_agent();

        assert!(!agent.is_ready(), "Not ready initially");

        agent.status = AgentStatus::Ready;
        assert!(agent.is_ready(), "Ready after status change");
    }

    #[test]
    fn test_agent_is_cold_start() {
        let mut agent = create_test_agent();

        assert!(agent.is_cold_start(), "Cold start with 0 interactions");

        // Simulate interactions
        for _ in 0..99 {
            agent.interaction_count += 1;
        }
        assert!(agent.is_cold_start(), "Still cold start at 99 interactions");

        agent.interaction_count = 100;
        assert!(!agent.is_cold_start(), "Not cold start at 100 interactions");
    }

    #[test]
    fn test_agent_lifecycle_transitions() {
        let mut agent = create_test_agent();

        // Initial state
        assert_eq!(agent.status, AgentStatus::Initializing);

        // Transition to ColdStart
        agent.status = AgentStatus::ColdStart;
        assert_eq!(agent.status, AgentStatus::ColdStart);

        // Transition to Ready after threshold
        agent.interaction_count = 100;
        agent.check_cold_start_transition();
        assert_eq!(agent.status, AgentStatus::Ready);

        // Transition to Busy
        agent.status = AgentStatus::Busy;
        assert_eq!(agent.status, AgentStatus::Busy);

        // Transition to Offline
        agent.status = AgentStatus::Offline;
        assert_eq!(agent.status, AgentStatus::Offline);
    }

    #[test]
    fn test_agent_check_cold_start_transition() {
        let mut agent = create_test_agent();
        agent.status = AgentStatus::ColdStart;

        // Below threshold - no transition
        agent.interaction_count = 99;
        agent.check_cold_start_transition();
        assert_eq!(agent.status, AgentStatus::ColdStart);

        // At threshold - should transition
        agent.interaction_count = 100;
        agent.check_cold_start_transition();
        assert_eq!(agent.status, AgentStatus::Ready);

        // Confidence should increase
        assert_float_eq(agent.confidence, 0.7, "Confidence after transition");
    }

    #[test]
    fn test_agent_check_cold_start_wrong_status() {
        let mut agent = create_test_agent();
        agent.status = AgentStatus::Initializing;

        // Should not transition from other states
        agent.interaction_count = 100;
        agent.check_cold_start_transition();
        assert_eq!(agent.status, AgentStatus::Initializing);
    }

    // =========================================================================
    // Confidence Update Tests
    // =========================================================================

    #[test]
    fn test_confidence_positive_reward() {
        let mut agent = create_test_agent();
        let initial = agent.confidence;

        agent.update_confidence(1.0);

        assert!(agent.confidence > initial, "Confidence should increase");
        assert_float_eq(agent.confidence, initial + 0.05, "Confidence increment");
    }

    #[test]
    fn test_confidence_negative_reward() {
        let mut agent = create_test_agent();
        agent.confidence = 0.6;

        agent.update_confidence(-1.0);

        assert!(agent.confidence < 0.6, "Confidence should decrease");
        assert_float_eq(agent.confidence, 0.55, "Confidence decrement");
    }

    #[test]
    fn test_confidence_clamps_at_zero() {
        let mut agent = create_test_agent();
        agent.confidence = 0.03;

        // Large negative reward
        agent.update_confidence(-1.0);

        assert_float_eq(agent.confidence, 0.0, "Confidence clamped at 0");
    }

    #[test]
    fn test_confidence_clamps_at_one() {
        let mut agent = create_test_agent();
        agent.confidence = 0.98;

        // Large positive reward
        agent.update_confidence(1.0);

        assert_float_eq(agent.confidence, 1.0, "Confidence clamped at 1");
    }

    #[test]
    fn test_confidence_partial_rewards() {
        let mut agent = create_test_agent();
        let initial = agent.confidence;

        agent.update_confidence(0.5);

        assert_float_eq(agent.confidence, initial + 0.025, "Partial reward");
    }

    // =========================================================================
    // Query Recording Tests
    // =========================================================================

    #[test]
    fn test_record_query_basic() {
        let mut agent = create_test_agent();

        agent.record_query(10.0, 1.0);

        assert_eq!(agent.interaction_count, 1);
        assert_float_eq(agent.avg_latency_ms, 10.0, "Average latency");
        assert_float_eq(agent.peak_latency_ms, 10.0, "Peak latency");
        assert_float_eq(agent.avg_reward, 1.0, "Average reward");
        assert!(agent.last_query_at > 0, "Last query timestamp");
    }

    #[test]
    fn test_record_query_multiple() {
        let mut agent = create_test_agent();

        agent.record_query(10.0, 1.0);
        agent.record_query(20.0, 0.5);
        agent.record_query(15.0, 0.75);

        assert_eq!(agent.interaction_count, 3);
        assert_float_eq(agent.avg_latency_ms, 15.0, "Average latency (10+20+15)/3");
        assert_float_eq(agent.peak_latency_ms, 20.0, "Peak latency");
        assert_float_eq(agent.avg_reward, 0.75, "Average reward (1+0.5+0.75)/3");
    }

    #[test]
    fn test_record_query_peak_update() {
        let mut agent = create_test_agent();

        agent.record_query(10.0, 1.0);
        agent.record_query(5.0, 1.0);
        agent.record_query(15.0, 1.0);

        assert_float_eq(agent.peak_latency_ms, 15.0, "Peak should update");
    }

    #[test]
    fn test_record_query_triggers_cold_start() {
        let mut agent = create_test_agent();
        agent.status = AgentStatus::ColdStart;

        // Record queries until threshold
        for _ in 0..100 {
            agent.record_query(10.0, 1.0);
        }

        assert_eq!(agent.status, AgentStatus::Ready, "Should transition to Ready");
    }

    // =========================================================================
    // Validation Accuracy Tests
    // =========================================================================

    #[test]
    fn test_update_validation_accuracy() {
        let mut agent = create_test_agent();

        agent.update_validation_accuracy(95, 100);

        assert_float_eq(agent.validation_accuracy, 0.95, "Validation accuracy");
    }

    #[test]
    fn test_update_validation_accuracy_zero_total() {
        let mut agent = create_test_agent();
        agent.validation_accuracy = 0.5;

        agent.update_validation_accuracy(10, 0);

        // Should not divide by zero
        assert_float_eq(agent.validation_accuracy, 0.5, "Unchanged with zero total");
    }

    #[test]
    fn test_update_validation_accuracy_perfect() {
        let mut agent = create_test_agent();

        agent.update_validation_accuracy(100, 100);

        assert_float_eq(agent.validation_accuracy, 1.0, "Perfect accuracy");
    }

    // =========================================================================
    // Memory Estimation Tests
    // =========================================================================

    #[test]
    fn test_memory_estimation_minimal() {
        let agent = FeatureAgentWasm::new(
            "test".to_string(),
            "FAJ".to_string(),
            "Test".to_string(),
            vec![],
            vec![],
            vec![],
        );

        let memory = agent.estimate_memory_bytes();

        // Base size + HNSW + trajectory (no feature data)
        assert!(memory > 1_000_000, "Memory > 1MB (trajectory)");
        assert!(memory < 2_000_000, "Memory < 2MB for minimal agent");
    }

    #[test]
    fn test_memory_estimation_with_data() {
        let agent = create_test_agent();

        let memory = agent.estimate_memory_bytes();

        // Should be larger than minimal
        assert!(memory > 1_000_000, "Memory > 1MB");
    }

    #[test]
    fn test_memory_estimation_with_q_table() {
        let mut agent = create_test_agent();
        agent.q_table_entries = 1000;

        let memory_base = agent.estimate_memory_bytes();
        agent.q_table_entries = 2000;
        let memory_extra = agent.estimate_memory_bytes();

        assert!(memory_extra > memory_base, "Memory increases with Q-table");
        assert_eq!(memory_extra - memory_base, 1000 * 100, "Q-table size increment");
    }

    // =========================================================================
    // Statistics Tests
    // =========================================================================

    #[test]
    fn test_get_stats_basic() {
        let agent = create_test_agent();

        let stats = agent.get_stats();

        assert_eq!(stats.id, "agent-faj-121-3094");
        assert_eq!(stats.faj_code, "FAJ 121 3094");
        assert_eq!(stats.status, "Initializing");
        assert_eq!(stats.parameter_count, 2);
        assert_eq!(stats.counter_count, 2);
        assert_eq!(stats.kpi_count, 2);
        assert_float_eq(stats.confidence, 0.5, "Confidence in stats");
        assert_float_eq(stats.health, 1.0, "Health in stats");
    }

    #[test]
    fn test_get_stats_with_interactions() {
        let mut agent = create_test_agent();

        agent.record_query(10.0, 1.0);
        agent.record_query(20.0, 0.5);

        let stats = agent.get_stats();

        assert_eq!(stats.interactions, 2);
        assert_float_eq(stats.avg_latency_ms, 15.0, "Average latency in stats");
        assert_float_eq(stats.peak_latency_ms, 20.0, "Peak latency in stats");
        assert_float_eq(stats.avg_reward, 0.75, "Average reward in stats");
    }

    #[test]
    fn test_get_stats_memory() {
        let agent = create_test_agent();

        let stats = agent.get_stats();

        assert!(stats.memory_bytes > 0, "Memory in stats");
    }

    // =========================================================================
    // Edge Cases and Boundary Conditions
    // =========================================================================

    #[test]
    fn test_agent_with_empty_parameters() {
        let agent = FeatureAgentWasm::new(
            "test".to_string(),
            "FAJ".to_string(),
            "Test".to_string(),
            vec![],
            vec![],
            vec![],
        );

        assert_eq!(agent.parameter_count(), 0);
    }

    #[test]
    fn test_agent_with_many_parameters() {
        let params: Vec<Parameter> = (0..100)
            .map(|i| Parameter {
                name: format!("param{}", i),
                value_type: "INTEGER".to_string(),
                range_min: Some(0.0),
                range_max: Some(100.0),
                current_value: None,
                description: None,
            })
            .collect();

        let agent = FeatureAgentWasm::new(
            "test".to_string(),
            "FAJ".to_string(),
            "Test".to_string(),
            params,
            vec![],
            vec![],
        );

        assert_eq!(agent.parameter_count(), 100);
    }

    #[test]
    fn test_confidence_extreme_rewards() {
        let mut agent = create_test_agent();

        // Extreme positive reward
        agent.update_confidence(100.0);
        assert_float_eq(agent.confidence, 1.0, "Extreme positive reward");

        agent.confidence = 1.0;
        // Extreme negative reward
        agent.update_confidence(-100.0);
        assert_float_eq(agent.confidence, 0.0, "Extreme negative reward");
    }

    #[test]
    fn test_agent_serialization() {
        let agent1 = create_test_agent();

        let serialized = serde_json::to_string(&agent1).unwrap();
        let agent2: FeatureAgentWasm = serde_json::from_str(&serialized).unwrap();

        assert_eq!(agent1.id, agent2.id);
        assert_eq!(agent1.faj_code, agent2.faj_code);
        assert_eq!(agent1.parameter_count(), agent2.parameter_count());
        assert_eq!(agent1.counter_count(), agent2.counter_count());
    }

    #[test]
    fn test_agent_status_serialization() {
        let status = AgentStatus::Ready;

        let serialized = serde_json::to_string(&status).unwrap();
        let deserialized: AgentStatus = serde_json::from_str(&serialized).unwrap();

        assert_eq!(status, deserialized);
    }

    #[test]
    fn test_agent_action_serialization() {
        let action = AgentAction::ContextAnswer;

        let serialized = serde_json::to_string(&action).unwrap();
        let deserialized: AgentAction = serde_json::from_str(&serialized).unwrap();

        assert_eq!(action, deserialized);
    }

    // =========================================================================
    // Ericsson RAN Feature-Specific Tests
    // =========================================================================

    #[test]
    fn test_agent_iflb_feature() {
        let agent = FeatureAgentWasm::new(
            "agent-faj-121-3161".to_string(),
            "FAJ 121 3161".to_string(),
            "Inter-Frequency Load Balancing".to_string(),
            vec![
                Parameter {
                    name: "lbTpNonQualFraction".to_string(),
                    value_type: "INTEGER".to_string(),
                    range_min: Some(0.0),
                    range_max: Some(100.0),
                    current_value: Some("50".to_string()),
                    description: None,
                },
            ],
            vec![
                Counter {
                    name: "pmLbEval".to_string(),
                    category: "Primary".to_string(),
                    current_value: 0.0,
                    description: None,
                },
            ],
            vec![],
        );

        assert_eq!(agent.faj_code, "FAJ 121 3161");
        assert_eq!(agent.category, "Inter-Frequency Load Balancing");
        assert_eq!(agent.parameter_count(), 1);
        assert_eq!(agent.counter_count(), 1);
    }

    #[test]
    fn test_agent_anr_feature() {
        let agent = FeatureAgentWasm::new(
            "agent-faj-121-4161".to_string(),
            "FAJ 121 4161".to_string(),
            "Automatic Neighbor Relation".to_string(),
            vec![
                Parameter {
                    name: "anrFilter".to_string(),
                    value_type: "INTEGER".to_string(),
                    range_min: Some(0.0),
                    range_max: Some(1.0),
                    current_value: Some("1".to_string()),
                    description: None,
                },
            ],
            vec![
                Counter {
                    name: "pmAnrSuccess".to_string(),
                    category: "Primary".to_string(),
                    current_value: 0.0,
                    description: None,
                },
            ],
            vec![],
        );

        assert_eq!(agent.faj_code, "FAJ 121 4161");
    }

    #[test]
    fn test_agent_multiple_kpis() {
        let kpis = vec![
            KPI {
                name: "kpi1".to_string(),
                formula: "formula1".to_string(),
                threshold: 10.0,
                current_value: Some(15.0),
            },
            KPI {
                name: "kpi2".to_string(),
                formula: "formula2".to_string(),
                threshold: 20.0,
                current_value: None,
            },
            KPI {
                name: "kpi3".to_string(),
                formula: "formula3".to_string(),
                threshold: 30.0,
                current_value: Some(25.0),
            },
        ];

        let agent = FeatureAgentWasm::new(
            "test".to_string(),
            "FAJ".to_string(),
            "Test".to_string(),
            vec![],
            vec![],
            kpis,
        );

        assert_eq!(agent.kpi_count(), 3);
        assert_eq!(agent.kpis[0].current_value, Some(15.0));
        assert_eq!(agent.kpis[1].current_value, None);
        assert_eq!(agent.kpis[2].current_value, Some(25.0));
    }
}
