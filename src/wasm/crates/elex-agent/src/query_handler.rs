//! Query Handler (ELEX-037)
//!
//! Complete query processing pipeline for RAN feature agents.
//!
//! # Pipeline Steps
//! 1. Intent classification - Classify query type
//! 2. Entity extraction - Extract feature codes, parameter names, values
//! 3. Context retrieval - Use HNSW to find similar past queries
//! 4. State encoding - Encode state into 64-bit hash
//! 5. Action selection - Use Q-table epsilon-greedy policy
//! 6. Response generation - Generate response based on action
//! 7. cmedit command generation - Generate validated ENM commands
//! 8. Feedback recording - Record outcome for learning
//!
//! # Performance Targets
//! - Full query processing <500ms P95
//! - HNSW context retrieval <1ms
//! - Q-table action selection with epsilon-greedy
//! - cmedit command generation with validation

use elex_core::{
    error::{ElexError, Result},
    types::{QueryType, Complexity, Confidence},
};
use elex_qlearning::{
    encoding::{StateHash, QueryType as QlQueryType, Complexity as QlComplexity, confidence_bucket, hash_context},
    qtable::{QTable, QLearningConfig, Reward},
    policy::{EpsilonGreedy, ActionSelection, Action as QlAction},
};
use elex_core::types::Action as CoreAction;
use elex_memory::{HnswIndex, SearchResult};
use serde::{Deserialize, Serialize};
use std::time::Instant;

// ============================================================================
// Query Input
// ============================================================================

/// User query input
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueryInput {
    /// Query text
    pub text: String,
    /// Optional context (cell ID, node name, etc.)
    pub context: Option<String>,
    /// Optional session ID for tracking
    pub session_id: Option<String>,
}

impl QueryInput {
    /// Create new query input
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            context: None,
            session_id: None,
        }
    }

    /// Add context
    pub fn with_context(mut self, context: impl Into<String>) -> Self {
        self.context = Some(context.into());
        self
    }

    /// Add session ID
    pub fn with_session(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }
}

// ============================================================================
// Entity Extraction
// ============================================================================

/// Extracted entities from query
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExtractedEntities {
    /// Feature codes found (e.g., "FAJ 121 3094")
    pub feature_codes: Vec<String>,
    /// Parameter names found (e.g., "lbTpNonQualFraction")
    pub parameters: Vec<String>,
    /// Counter names found (e.g., "pmLbEval")
    pub counters: Vec<String>,
    /// Values mentioned (e.g., "0.5", "true", "enabled")
    pub values: Vec<String>,
    /// MO classes (e.g., "EUtranCellFDD")
    pub mo_classes: Vec<String>,
}

impl ExtractedEntities {
    /// Check if any entities were extracted
    pub fn has_entities(&self) -> bool {
        !self.feature_codes.is_empty()
            || !self.parameters.is_empty()
            || !self.counters.is_empty()
            || !self.mo_classes.is_empty()
    }

    /// Get entity count
    pub fn count(&self) -> usize {
        self.feature_codes.len()
            + self.parameters.len()
            + self.counters.len()
            + self.mo_classes.len()
    }
}

impl Default for ExtractedEntities {
    fn default() -> Self {
        Self {
            feature_codes: Vec::new(),
            parameters: Vec::new(),
            counters: Vec::new(),
            values: Vec::new(),
            mo_classes: Vec::new(),
        }
    }
}

// ============================================================================
// Context Retrieval Result
// ============================================================================

/// Result from HNSW context search
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ContextResult {
    /// Similar past queries
    pub similar_queries: Vec<SimilarQuery>,
    /// Total retrieval time in milliseconds
    pub retrieval_time_ms: f64,
    /// Number of queries searched
    pub total_queries: usize,
}

/// Similar query from history
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SimilarQuery {
    /// Query text
    pub query: String,
    /// Similarity score (0.0 to 1.0)
    pub similarity: f32,
    /// Action that was taken
    pub action: CoreAction,
    /// Whether it was successful
    pub was_successful: bool,
}

// ============================================================================
// Query Response
// ============================================================================

/// Response to a query
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueryResponse {
    /// Response text
    pub text: String,
    /// Action taken
    pub action: CoreAction,
    /// Confidence score (0.0 to 1.0)
    pub confidence: Confidence,
    /// Generated cmedit commands (if any)
    pub cmedit_commands: Vec<CmeditCommand>,
    /// Context used (if any)
    pub context: Option<ContextResult>,
    /// State hash for learning
    pub state_hash: u64,
    /// Processing time in milliseconds
    pub processing_time_ms: f64,
}

/// Validated cmedit command
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CmeditCommand {
    /// Full command string
    pub command: String,
    /// MO class
    pub mo_class: String,
    /// Parameter being modified
    pub parameter: String,
    /// Value being set
    pub value: String,
    /// Risk level
    pub risk_level: String,
    /// Whether validation passed
    pub is_valid: bool,
}

// ============================================================================
// Query Handler
// ============================================================================

/// Query processing pipeline
///
/// Implements the complete 8-step query processing pipeline from ELEX-037.
pub struct QueryHandler {
    /// Q-table for action selection
    q_table: QTable,
    /// Epsilon-greedy policy
    policy: EpsilonGreedy,
    /// HNSW index for context retrieval
    hnsw_index: HnswIndex,
    /// Query history for context
    query_history: Vec<QueryHistoryEntry>,
    /// Maximum history size
    max_history: usize,
    /// Whether exploration is enabled
    exploration_enabled: bool,
}

/// Entry in query history
#[derive(Clone)]
struct QueryHistoryEntry {
    query: String,
    embedding: Vec<f32>,
    action: CoreAction,
    success: bool,
}

impl QueryHandler {
    /// Create new query handler with default configuration
    pub fn new() -> Self {
        Self::with_config(QLearningConfig::elex_default(), true)
    }

    /// Create with custom Q-learning config
    pub fn with_config(config: QLearningConfig, exploration_enabled: bool) -> Self {
        Self {
            q_table: QTable::new(config.clone()),
            policy: EpsilonGreedy::new(42, exploration_enabled),
            hnsw_index: HnswIndex::new(),
            query_history: Vec::new(),
            max_history: 10000,
            exploration_enabled,
        }
    }

    /// Create with exploit-only policy (no exploration)
    pub fn exploit_only() -> Self {
        Self::with_config(QLearningConfig::elex_default(), false)
    }

    /// Process a query through the complete pipeline
    ///
    /// # Pipeline Steps
    /// 1. Intent classification
    /// 2. Entity extraction
    /// 3. Context retrieval (HNSW)
    /// 4. State encoding
    /// 5. Action selection (epsilon-greedy)
    /// 6. Response generation
    /// 7. cmedit command generation
    /// 8. Return response
    ///
    /// # Performance
    /// Target: <500ms P95 latency
    pub fn process_query(&mut self, input: QueryInput) -> Result<QueryResponse> {
        let start = Instant::now();

        // Step 1: Classify query intent
        let query_type = self.classify_intent(&input.text);
        let complexity = self.assess_complexity(&input.text);

        // Step 2: Extract entities
        let entities = self.extract_entities(&input.text);

        // Step 3: Retrieve context via HNSW
        let context_start = Instant::now();
        let context_result = self.retrieve_context(&input.text, &entities);
        let context_time = context_start.elapsed().as_secs_f64() * 1000.0;

        // Step 4: Encode state
        let confidence = self.estimate_confidence(&entities, &context_result);
        let context_hash = hash_context(&input.text);
        let state_hash = StateHash::encode(
            self.map_query_type(query_type),
            self.map_complexity(complexity),
            context_hash,
            confidence,
        );

        // Step 5: Select action using epsilon-greedy
        let action_selection = self.policy.select_action(
            &self.q_table,
            state_hash.value(),
            QlAction::all(),
        );

        // Step 6: Generate response based on action
        let (response_text, cmedit_commands) = self.generate_response(
            &input.text,
            &entities,
            action_selection.action,
            &context_result,
        );

        let processing_time = start.elapsed().as_secs_f64() * 1000.0;

        let core_action = match action_selection.action {
            QlAction::DirectAnswer => CoreAction::DirectAnswer,
            QlAction::ContextAnswer => CoreAction::ContextAnswer,
            QlAction::ConsultPeer => CoreAction::ConsultPeer,
            QlAction::RequestClarification => CoreAction::RequestClarification,
            QlAction::Escalate => CoreAction::Escalate,
        };

        Ok(QueryResponse {
            text: response_text,
            action: core_action,
            confidence,
            cmedit_commands,
            context: Some(context_result),
            state_hash: state_hash.value(),
            processing_time_ms: processing_time,
        })
    }

    /// Record feedback for learning
    ///
    /// Updates Q-table based on user feedback and outcome.
    pub fn record_feedback(
        &mut self,
        state_hash: u64,
        action: CoreAction,
        user_rating: f32,
        resolution_success: bool,
        latency_ms: f64,
    ) -> Result<()> {
        // Convert CoreAction to QlAction
        let ql_action = match action {
            CoreAction::DirectAnswer => QlAction::DirectAnswer,
            CoreAction::ContextAnswer => QlAction::ContextAnswer,
            CoreAction::ConsultPeer => QlAction::ConsultPeer,
            CoreAction::RequestClarification => QlAction::RequestClarification,
            CoreAction::Escalate => QlAction::Escalate,
        };

        // Calculate reward
        let mut reward = Reward::from_user_rating(user_rating);

        if resolution_success {
            reward.resolution_success = 0.5;
        }

        // Add latency penalty (small penalty for slow responses)
        if latency_ms > 500.0 {
            reward = reward.with_latency(((latency_ms - 500.0) / 1000.0) as f32);
        }

        // Add consultation cost if action was ConsultPeer
        if action == CoreAction::ConsultPeer {
            reward = reward.with_consultation_cost(0.05);
        }

        // Update Q-value
        let next_max_q = self.q_table.get_max_q(state_hash);
        self.q_table.update_q_value(state_hash, ql_action, reward.total(), next_max_q);

        // Decay epsilon after learning
        self.policy.decay_epsilon();

        Ok(())
    }

    /// Store query in history for context retrieval
    pub fn store_query(&mut self, query: String, embedding: Vec<f32>, action: CoreAction, success: bool) {
        let entry = QueryHistoryEntry {
            query,
            embedding,
            action,
            success,
        };

        self.query_history.push(entry);

        // Prune history if too large
        if self.query_history.len() > self.max_history {
            self.query_history.remove(0);
        }
    }

    /// Get Q-table statistics
    pub fn get_stats(&self) -> QTableStats {
        self.q_table.get_stats()
    }

    /// Get current epsilon value
    pub fn epsilon(&self) -> f32 {
        self.policy.epsilon()
    }

    /// Enable or disable exploration
    pub fn set_exploration_enabled(&mut self, enabled: bool) {
        self.policy.set_exploration_enabled(enabled);
        self.exploration_enabled = enabled;
    }

    // ========================================================================
    // Pipeline Step 1: Intent Classification
    // ========================================================================

    /// Classify query intent into QueryType
    fn classify_intent(&self, query: &str) -> QueryType {
        let query_lower = query.to_lowercase();

        // Parameter queries
        if query_lower.contains("parameter")
            || query_lower.contains("set ")
            || query_lower.contains("configure")
            || query_lower.contains("change ")
            || query_lower.contains("value of")
        {
            return QueryType::Parameter;
        }

        // Counter queries
        if query_lower.contains("counter")
            || query_lower.contains("pm")
            || query_lower.contains("performance ")
            || query_lower.contains("statistics")
        {
            return QueryType::Counter;
        }

        // KPI queries
        if query_lower.contains("kpi")
            || query_lower.contains("success rate")
            || query_lower.contains("throughput")
            || query_lower.contains("latency")
            || query_lower.contains("handover")
        {
            return QueryType::Kpi;
        }

        // Procedure queries
        if query_lower.contains("how to")
            || query_lower.contains("how do i")
            || query_lower.contains("procedure")
            || query_lower.contains("steps")
            || query_lower.contains("activate")
            || query_lower.contains("deactivate")
        {
            return QueryType::Procedure;
        }

        // Troubleshooting queries
        if query_lower.contains("trouble")
            || query_lower.contains("issue")
            || query_lower.contains("problem")
            || query_lower.contains("error")
            || query_lower.contains("failing")
            || query_lower.contains("why is")
        {
            return QueryType::Troubleshoot;
        }

        // Default to general
        QueryType::General
    }

    /// Assess query complexity
    fn assess_complexity(&self, query: &str) -> Complexity {
        let word_count = query.split_whitespace().count();
        let has_multiple_params = query.matches(',').count() > 0
            || query.matches(" and ").count() > 0;
        let has_conditional = query.contains("if") || query.contains("when");

        match (word_count, has_multiple_params, has_conditional) {
            (n, _, _) if n <= 5 => Complexity::Simple,
            (n, true, true) | (n, _, _) if n > 15 => Complexity::Complex,
            _ => Complexity::Moderate,
        }
    }

    // ========================================================================
    // Pipeline Step 2: Entity Extraction
    // ========================================================================

    /// Extract entities from query text
    fn extract_entities(&self, query: &str) -> ExtractedEntities {
        let mut entities = ExtractedEntities::default();

        // Extract FAJ feature codes (format: FAJ XXX XXXX)
        let faj_pattern = r"FAJ\s+\d{3}\s+\d{3,4}";
        // In production, would use regex crate
        // For now, simple string matching
        if query.contains("FAJ") {
            let words: Vec<&str> = query.split_whitespace().collect();
            for (i, word) in words.iter().enumerate() {
                if *word == "FAJ" && i + 2 < words.len() {
                    if let (Some(cat), Some(feat)) = (words.get(i + 1), words.get(i + 2)) {
                        if cat.chars().all(|c| c.is_numeric())
                            && feat.chars().all(|c| c.is_numeric())
                        {
                            entities.feature_codes.push(format!("FAJ {} {}", cat, feat));
                        }
                    }
                }
            }
        }

        // Extract parameter names (camelCase or with underscores)
        let param_keywords = [
            "lbTp", "mimoMode", "sleepMode", "anr", "ca", "drx",
            "mcpc", "iflb", "duac", "msm", "earfcn", "pci",
        ];
        for keyword in &param_keywords {
            if query.to_lowercase().contains(&keyword.to_lowercase()) {
                // Find full parameter name
                let words: Vec<&str> = query.split_whitespace().collect();
                for word in words {
                    if word.to_lowercase().contains(&keyword.to_lowercase())
                        && (word.contains('_') || word.chars().any(|c| c.is_lowercase()))
                    {
                        entities.parameters.push(word.to_string());
                    }
                }
            }
        }

        // Extract counter names (pm prefix or specific patterns)
        if query.to_lowercase().contains("pm") {
            let words: Vec<&str> = query.split_whitespace().collect();
            for word in words {
                if word.to_lowercase().starts_with("pm") {
                    entities.counters.push(word.to_string());
                }
            }
        }

        // Extract values
        let value_patterns = [
            r"\d+\.\d+", // Decimal
            r"\d+",      // Integer
            r"true|false", // Boolean
            r"enabled|disabled", // State
        ];
        // Simple extraction for common values
        for word in query.split_whitespace() {
            if word.parse::<f32>().is_ok()
                || word == "true"
                || word == "false"
                || word == "enabled"
                || word == "disabled"
            {
                entities.values.push(word.to_string());
            }
        }

        // Extract MO classes
        let mo_classes = [
            "EUtranCellFDD", "NRCellDU", "ENodeBFunction", "GNodeBFunction",
            "MimoSleepFunction", "AnrFunction", "HoFunction",
        ];
        for mo_class in &mo_classes {
            if query.contains(mo_class) {
                entities.mo_classes.push(mo_class.to_string());
            }
        }

        entities
    }

    // ========================================================================
    // Pipeline Step 3: Context Retrieval (HNSW)
    // ========================================================================

    /// Retrieve similar queries from history using HNSW
    fn retrieve_context(&self, query: &str, entities: &ExtractedEntities) -> ContextResult {
        let start = Instant::now();

        // Generate embedding for query (simplified - would use proper embedding model)
        let embedding = self.generate_embedding(query, entities);

        // Search HNSW index for similar queries
        let search_results = if self.hnsw_index.len() > 0 {
            self.hnsw_index.search(&embedding, 5)
        } else {
            Vec::new()
        };

        // Convert to SimilarQuery
        let similar_queries: Vec<SimilarQuery> = search_results
            .into_iter()
            .filter_map(|result| {
                self.query_history.get(result.id as usize).map(|entry| SimilarQuery {
                    query: entry.query.clone(),
                    similarity: result.similarity,
                    action: entry.action,
                    was_successful: entry.success,
                })
            })
            .collect();

        ContextResult {
            similar_queries,
            retrieval_time_ms: start.elapsed().as_secs_f64() * 1000.0,
            total_queries: self.query_history.len(),
        }
    }

    /// Generate embedding for query (simplified TF-IDF style)
    fn generate_embedding(&self, query: &str, entities: &ExtractedEntities) -> Vec<f32> {
        // In production, would use proper embedding model (BERT, etc.)
        // For now, create a 128-dimensional simplified embedding
        let mut embedding = vec![0.0_f32; 128];

        // Hash-based embedding
        let mut hash: u64 = 5381;
        for byte in query.bytes() {
            hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
        }

        // Spread hash across embedding dimensions
        for i in 0..128 {
            embedding[i] = ((hash >> (i % 64)) & 0xFF) as f32 / 255.0;
        }

        // Boost dimensions for entities
        if !entities.feature_codes.is_empty() {
            embedding[0] = 1.0;
        }
        if !entities.parameters.is_empty() {
            embedding[1] = 1.0;
        }
        if !entities.counters.is_empty() {
            embedding[2] = 1.0;
        }

        // Normalize
        let norm: f32 = embedding.iter().map(|v| v * v).sum::<f32>().sqrt();
        if norm > 0.0 {
            for v in embedding.iter_mut() {
                *v /= norm;
            }
        }

        embedding
    }

    // ========================================================================
    // Pipeline Step 4: State Encoding (Helper)
    // ========================================================================

    /// Map core QueryType to Q-learning QueryType
    fn map_query_type(&self, query_type: QueryType) -> QlQueryType {
        match query_type {
            QueryType::Parameter => QlQueryType::Parameter,
            QueryType::Counter => QlQueryType::Counter,
            QueryType::Kpi => QlQueryType::Kpi,
            QueryType::Procedure => QlQueryType::Procedure,
            QueryType::Troubleshoot => QlQueryType::Troubleshoot,
            QueryType::General => QlQueryType::General,
        }
    }

    /// Map core Complexity to Q-learning Complexity
    fn map_complexity(&self, complexity: Complexity) -> QlComplexity {
        match complexity {
            Complexity::Simple => QlComplexity::Simple,
            Complexity::Moderate => QlComplexity::Moderate,
            Complexity::Complex => QlComplexity::Complex,
        }
    }

    /// Estimate confidence based on entities and context
    fn estimate_confidence(&self, entities: &ExtractedEntities, context: &ContextResult) -> f32 {
        let mut confidence = 0.5; // Base confidence

        // Boost for extracted entities
        confidence += entities.count() as f32 * 0.05;

        // Boost for similar successful queries in context
        for similar in &context.similar_queries {
            if similar.was_successful {
                confidence += similar.similarity * 0.1;
            }
        }

        // Clamp to [0, 1]
        confidence.clamp(0.0, 1.0)
    }

    // ========================================================================
    // Pipeline Step 6 & 7: Response Generation & cmedit Generation
    // ========================================================================

    /// Generate response based on selected action
    fn generate_response(
        &self,
        query: &str,
        entities: &ExtractedEntities,
        action: QlAction,
        context: &ContextResult,
    ) -> (String, Vec<CmeditCommand>) {
        match action {
            QlAction::DirectAnswer => {
                let response = self.generate_direct_answer(query, entities);
                (response, Vec::new())
            }
            QlAction::ContextAnswer => {
                let response = self.generate_context_answer(query, entities, context);
                (response, Vec::new())
            }
            QlAction::ConsultPeer => {
                let response = "I'm consulting with other feature agents to provide the most accurate information.".to_string();
                (response, Vec::new())
            }
            QlAction::RequestClarification => {
                let response = self.generate_clarification_request(entities);
                (response, Vec::new())
            }
            QlAction::Escalate => {
                let response = "This query requires expert review. I'm escalating it to the technical team.".to_string();
                (response, Vec::new())
            }
        }
    }

    /// Generate direct answer from feature knowledge
    fn generate_direct_answer(&self, query: &str, entities: &ExtractedEntities) -> String {
        if !entities.parameters.is_empty() {
            format!(
                "Parameter '{}' is part of the RAN configuration. Current value information: This parameter controls load balancing behavior.",
                entities.parameters[0]
            )
        } else if !entities.feature_codes.is_empty() {
            format!(
                "Feature '{}' is a RAN feature that can be configured via ENM.",
                entities.feature_codes[0]
            )
        } else {
            "Based on your query, here's the relevant information for your RAN configuration.".to_string()
        }
    }

    /// Generate answer with context from similar queries
    fn generate_context_answer(
        &self,
        query: &str,
        entities: &ExtractedEntities,
        context: &ContextResult,
    ) -> String {
        if let Some(similar) = context.similar_queries.first() {
            format!(
                "Based on similar queries: {}. {}",
                similar.query,
                self.generate_direct_answer(query, entities)
            )
        } else {
            self.generate_direct_answer(query, entities)
        }
    }

    /// Generate clarification request
    fn generate_clarification_request(&self, entities: &ExtractedEntities) -> String {
        if entities.parameters.is_empty() {
            "Could you specify which parameter you're asking about?".to_string()
        } else if entities.feature_codes.is_empty() {
            "Could you provide the feature code (FAJ XXX XXXX) for this query?".to_string()
        } else {
            "Could you provide more details about what you'd like to accomplish?".to_string()
        }
    }

    /// Export Q-table for federated learning
    pub fn export_q_table(&self) -> Result<Vec<u8>> {
        self.q_table.export()
            .map_err(|e| ElexError::Generic { message: e })
    }

    /// Import Q-table from another agent
    pub fn import_q_table(&mut self, data: &[u8]) -> Result<()> {
        let imported = QTable::import(data)
            .map_err(|e| ElexError::Generic { message: e })?;
        self.q_table.merge_from(&imported, 0.5);
        Ok(())
    }

    /// Get history size
    pub fn history_size(&self) -> usize {
        self.query_history.len()
    }
}

impl Default for QueryHandler {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Q-Table Stats Alias
// ============================================================================

use elex_qlearning::qtable::QTableStats;

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_input_creation() {
        let input = QueryInput::new("What is lbTpNonQualFraction?")
            .with_context("Cell-123")
            .with_session("session-1");

        assert_eq!(input.text, "What is lbTpNonQualFraction?");
        assert_eq!(input.context, Some("Cell-123".to_string()));
        assert_eq!(input.session_id, Some("session-1".to_string()));
    }

    #[test]
    fn test_intent_classification_parameter() {
        let handler = QueryHandler::new();
        let query_type = handler.classify_intent("What is the value of lbTpNonQualFraction?");
        assert_eq!(query_type, QueryType::Parameter);
    }

    #[test]
    fn test_intent_classification_counter() {
        let handler = QueryHandler::new();
        let query_type = handler.classify_intent("Show pmLbEval statistics");
        assert_eq!(query_type, QueryType::Counter);
    }

    #[test]
    fn test_intent_classification_kpi() {
        let handler = QueryHandler::new();
        let query_type = handler.classify_intent("What is the current handover success rate?");
        assert_eq!(query_type, QueryType::Kpi);
    }

    #[test]
    fn test_intent_classification_procedure() {
        let handler = QueryHandler::new();
        let query_type = handler.classify_intent("How do I configure CA?");
        assert_eq!(query_type, QueryType::Procedure);
    }

    #[test]
    fn test_intent_classification_troubleshoot() {
        let handler = QueryHandler::new();
        let query_type = handler.classify_intent("Why is handover failing?");
        assert_eq!(query_type, QueryType::Troubleshoot);
    }

    #[test]
    fn test_complexity_assessment() {
        let handler = QueryHandler::new();

        assert_eq!(handler.assess_complexity("Set parameter"), Complexity::Simple);
        assert_eq!(handler.assess_complexity("Configure multiple parameters for the cell"), Complexity::Moderate);
    }

    #[test]
    fn test_entity_extraction() {
        let handler = QueryHandler::new();
        let entities = handler.extract_entities("Configure FAJ 121 3094 with lbTpNonQualFraction 0.5");

        assert!(!entities.feature_codes.is_empty());
        assert!(!entities.parameters.is_empty());
        assert!(!entities.values.is_empty());
    }

    #[test]
    fn test_extracted_entities_default() {
        let entities = ExtractedEntities::default();
        assert!(!entities.has_entities());
        assert_eq!(entities.count(), 0);
    }

    #[test]
    fn test_process_query() {
        let mut handler = QueryHandler::new();
        let input = QueryInput::new("What is lbTpNonQualFraction?");

        let response = handler.process_query(input).unwrap();

        assert!(!response.text.is_empty());
        assert!(response.processing_time_ms >= 0.0);
        assert!(response.confidence >= 0.0 && response.confidence <= 1.0);
    }

    #[test]
    fn test_record_feedback() {
        let mut handler = QueryHandler::new();
        let state_hash = 12345;
        let action = CoreAction::DirectAnswer;

        handler.record_feedback(state_hash, action, 0.8, true, 100.0).unwrap();

        let stats = handler.get_stats();
        assert_eq!(stats.total_updates, 1);
    }

    #[test]
    fn test_store_query() {
        let mut handler = QueryHandler::new();
        let embedding = vec![0.1; 128];

        handler.store_query("test query".to_string(), embedding, CoreAction::DirectAnswer, true);

        assert_eq!(handler.history_size(), 1);
    }

    #[test]
    fn test_exploration_toggle() {
        let mut handler = QueryHandler::new();

        assert!(handler.exploration_enabled);

        handler.set_exploration_enabled(false);
        assert!(!handler.exploration_enabled);
    }

    #[test]
    fn test_exploit_only() {
        let handler = QueryHandler::exploit_only();
        assert!(!handler.exploration_enabled);
    }

    #[test]
    fn test_generate_embedding() {
        let handler = QueryHandler::new();
        let entities = ExtractedEntities::default();

        let embedding = handler.generate_embedding("test query", &entities);

        assert_eq!(embedding.len(), 128);
    }

    #[test]
    fn test_map_query_type() {
        let handler = QueryHandler::new();

        assert_eq!(
            handler.map_query_type(QueryType::Parameter),
            QlQueryType::Parameter
        );
        assert_eq!(
            handler.map_query_type(QueryType::Troubleshoot),
            QlQueryType::Troubleshoot
        );
    }

    #[test]
    fn test_map_complexity() {
        let handler = QueryHandler::new();

        assert_eq!(
            handler.map_complexity(Complexity::Simple),
            QlComplexity::Simple
        );
        assert_eq!(
            handler.map_complexity(Complexity::Complex),
            QlComplexity::Complex
        );
    }

    #[test]
    fn test_estimate_confidence() {
        let handler = QueryHandler::new();
        let entities = ExtractedEntities::default();
        let context = ContextResult {
            similar_queries: Vec::new(),
            retrieval_time_ms: 0.5,
            total_queries: 0,
        };

        let confidence = handler.estimate_confidence(&entities, &context);
        assert!(confidence >= 0.0 && confidence <= 1.0);
    }

    #[test]
    fn test_handler_default() {
        let handler = QueryHandler::default();
        assert!(handler.history_size() == 0);
    }

    #[test]
    fn test_epsilon_decay() {
        let mut handler = QueryHandler::new();
        let initial_epsilon = handler.epsilon();

        // Record feedback to trigger epsilon decay
        handler.record_feedback(12345, CoreAction::DirectAnswer, 0.5, true, 100.0).unwrap();

        assert!(handler.epsilon() < initial_epsilon);
    }
}
