//! Telemetry and Monitoring System
//!
//! This module provides comprehensive performance monitoring and telemetry
//! capabilities for the ELEX swarm.

use wasm_bindgen::prelude::*;
use js_sys::{Date, Object, Reflect, Array};
use std::sync::{Arc, Mutex};

/// Telemetry data for a single query
#[derive(Clone, Debug)]
pub struct QueryMetric {
    pub timestamp: f64,
    pub latency_ms: f64,
    pub confidence: f32,
    pub agent_id: String,
    pub feature_code: String,
    pub query_type: String,
    pub complexity: String,
    pub success: bool,
}

/// Telemetry system for monitoring swarm performance
#[wasm_bindgen]
pub struct TelemetrySystem {
    enabled: bool,
    metrics: Arc<Mutex<Vec<QueryMetric>>>,
    start_time: f64,
}

#[wasm_bindgen]
impl TelemetrySystem {
    /// Create a new telemetry system
    #[wasm_bindgen(constructor)]
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled,
            metrics: Arc::new(Mutex::new(Vec::with_capacity(10000))),
            start_time: Date::now(),
        }
    }

    /// Record a query metric
    #[wasm_bindgen]
    pub fn record_query(
        &self,
        latency_ms: f64,
        confidence: f32,
        agent_id: String,
        feature_code: String,
        query_type: String,
        complexity: String,
        success: bool,
    ) {
        if !self.enabled {
            return;
        }

        let metric = QueryMetric {
            timestamp: Date::now(),
            latency_ms,
            confidence,
            agent_id,
            feature_code,
            query_type,
            complexity,
            success,
        };

        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.push(metric);
        }
    }

    /// Get all recorded metrics as a JavaScript array
    #[wasm_bindgen]
    pub fn get_metrics(&self) -> Array {
        let array = Array::new();
        if let Ok(metrics) = self.metrics.lock() {
            for metric in metrics.iter() {
                let obj = Object::new();
                let _ = Reflect::set(&obj, &JsValue::from_str("timestamp"), &JsValue::from_f64(metric.timestamp));
                let _ = Reflect::set(&obj, &JsValue::from_str("latencyMs"), &JsValue::from_f64(metric.latency_ms));
                let _ = Reflect::set(&obj, &JsValue::from_str("confidence"), &JsValue::from_f64(metric.confidence as f64));
                let _ = Reflect::set(&obj, &JsValue::from_str("agentId"), &JsValue::from_str(&metric.agent_id));
                let _ = Reflect::set(&obj, &JsValue::from_str("featureCode"), &JsValue::from_str(&metric.feature_code));
                let _ = Reflect::set(&obj, &JsValue::from_str("queryType"), &JsValue::from_str(&metric.query_type));
                let _ = Reflect::set(&obj, &JsValue::from_str("complexity"), &JsValue::from_str(&metric.complexity));
                let _ = Reflect::set(&obj, &JsValue::from_str("success"), &JsValue::from_bool(metric.success));
                array.push(&obj);
            }
        }
        array
    }

    /// Get summary statistics
    #[wasm_bindgen]
    pub fn get_summary(&self) -> Object {
        let summary = Object::new();

        if let Ok(metrics) = self.metrics.lock() {
            let total_queries = metrics.len() as f64;
            let successful_queries = metrics.iter().filter(|m| m.success).count() as f64;
            let avg_latency = if !metrics.is_empty() {
                metrics.iter().map(|m| m.latency_ms).sum::<f64>() / total_queries
            } else {
                0.0
            };
            let avg_confidence = if !metrics.is_empty() {
                metrics.iter().map(|m| m.confidence as f64).sum::<f64>() / total_queries
            } else {
                0.0
            };
            let p95_latency = if !metrics.is_empty() {
                let mut latencies: Vec<f64> = metrics.iter().map(|m| m.latency_ms).collect();
                latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
                let index = ((latencies.len() as f64 * 0.95) as usize).min(latencies.len() - 1);
                latencies[index]
            } else {
                0.0
            };

            let _ = Reflect::set(&summary, &JsValue::from_str("totalQueries"), &JsValue::from_f64(total_queries));
            let _ = Reflect::set(&summary, &JsValue::from_str("successfulQueries"), &JsValue::from_f64(successful_queries));
            let _ = Reflect::set(&summary, &JsValue::from_str("successRate"), &JsValue::from_f64(successful_queries / total_queries.max(1.0)));
            let _ = Reflect::set(&summary, &JsValue::from_str("avgLatencyMs"), &JsValue::from_f64(avg_latency));
            let _ = Reflect::set(&summary, &JsValue::from_str("avgConfidence"), &JsValue::from_f64(avg_confidence));
            let _ = Reflect::set(&summary, &JsValue::from_str("p95LatencyMs"), &JsValue::from_f64(p95_latency));
            let _ = Reflect::set(&summary, &JsValue::from_str("uptimeMs"), &JsValue::from_f64(Date::now() - self.start_time));
        }

        summary
    }

    /// Clear all recorded metrics
    #[wasm_bindgen]
    pub fn clear(&self) {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.clear();
        }
    }

    /// Export metrics as JSON string
    #[wasm_bindgen]
    pub fn export_json(&self) -> String {
        if let Ok(metrics) = self.metrics.lock() {
            serde_json::to_string(&*metrics).unwrap_or_else(|_| "[]".to_string())
        } else {
            "[]".to_string()
        }
    }

    /// Get metrics for a specific time range
    #[wasm_bindgen]
    pub fn get_metrics_in_range(&self, start_ms: f64, end_ms: f64) -> Array {
        let array = Array::new();
        if let Ok(metrics) = self.metrics.lock() {
            for metric in metrics.iter() {
                if metric.timestamp >= start_ms && metric.timestamp <= end_ms {
                    let obj = Object::new();
                    let _ = Reflect::set(&obj, &JsValue::from_str("timestamp"), &JsValue::from_f64(metric.timestamp));
                    let _ = Reflect::set(&obj, &JsValue::from_str("latencyMs"), &JsValue::from_f64(metric.latency_ms));
                    let _ = Reflect::set(&obj, &JsValue::from_str("confidence"), &JsValue::from_f64(metric.confidence as f64));
                    array.push(&obj);
                }
            }
        }
        array
    }
}

/// Performance monitoring hooks
pub struct PerformanceMonitor {
    start_times: Arc<Mutex<Vec<(String, f64)>>>,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            start_times: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn start_operation(&self, operation_id: String) {
        if let Ok(mut times) = self.start_times.lock() {
            times.push((operation_id, Date::now()));
        }
    }

    pub fn end_operation(&self, operation_id: String) -> Option<f64> {
        let start_time = {
            let mut times = self.start_times.lock().ok()?;
            let pos = times.iter().position(|(id, _)| id == &operation_id)?;
            let (_, start) = times.remove(pos);
            start
        };
        Some(Date::now() - start_time)
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}
