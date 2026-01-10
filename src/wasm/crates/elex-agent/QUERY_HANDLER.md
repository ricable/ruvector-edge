# Query Handler Implementation (ELEX-037)

## Overview

Implemented the complete query processing pipeline at `/Users/cedric/dev/2026/test-cfv3/src/wasm/crates/elex-agent/src/query_handler.rs`

## Implementation Details

### 8-Step Query Processing Pipeline

#### 1. Intent Classification
- Classifies queries into 6 types: Parameter, Counter, KPI, Procedure, Troubleshoot, General
- Uses keyword matching and pattern detection
- Complexity assessment: Simple, Moderate, Complex based on word count and conditionals

#### 2. Entity Extraction
- Extracts feature codes (FAJ XXX XXXX format)
- Extracts parameter names (camelCase, underscore patterns)
- Extracts counter names (pm prefix)
- Extracts values (decimal, integer, boolean, state)
- Extracts MO classes (EUtranCellFDD, NRCellDU, etc.)

#### 3. Context Retrieval (HNSW)
- Uses HNSW index from elex-memory for vector similarity search
- Generates 128-dimensional embeddings for queries
- Retrieves top 5 similar queries with similarity scores
- Target: <1ms P95 search latency

#### 4. State Encoding
- Encodes state into 64-bit hash using elex-qlearning encoding
- State layout:
  - query_type: 3 bits
  - complexity: 2 bits
  - confidence_bucket: 4 bits
  - context_hash: 55 bits

#### 5. Action Selection
- Uses epsilon-greedy policy from elex-qlearning
- 5 possible actions:
  - DirectAnswer: Answer from feature knowledge
  - ContextAnswer: Answer + vector memory context
  - ConsultPeer: Query related feature agents
  - RequestClarification: Ask for more info
  - Escalate: Route to human expert
- Epsilon decay: 0.1 -> 0.01

#### 6. Response Generation
- Generates responses based on selected action
- Different response strategies per action type
- Context-aware responses from similar queries

#### 7. cmedit Command Generation
- Generates validated ENM commands (placeholder for Phase 7)
- Risk assessment and validation
- Command structure with MO class, parameter, value

#### 8. Feedback Recording
- Records user feedback and outcomes
- Updates Q-table with reward signal
- Reward components:
  - user_rating: [-1.0, +1.0]
  - resolution_success: +0.5
  - latency_penalty: small negative
  - consultation_cost: -0.05

## Key Types

### QueryInput
```rust
pub struct QueryInput {
    pub text: String,
    pub context: Option<String>,
    pub session_id: Option<String>,
}
```

### ExtractedEntities
```rust
pub struct ExtractedEntities {
    pub feature_codes: Vec<String>,
    pub parameters: Vec<String>,
    pub counters: Vec<String>,
    pub values: Vec<String>,
    pub mo_classes: Vec<String>,
}
```

### QueryResponse
```rust
pub struct QueryResponse {
    pub text: String,
    pub action: Action,
    pub confidence: Confidence,
    pub cmedit_commands: Vec<CmeditCommand>,
    pub context: Option<ContextResult>,
    pub state_hash: u64,
    pub processing_time_ms: f64,
}
```

## Performance Targets

- Full query processing: <500ms P95
- HNSW context retrieval: <1ms
- Q-table action selection: <0.1ms
- State encoding: <0.01ms

## Dependencies

- `elex-core`: QueryType, Complexity, Action, Confidence types
- `elex-qlearning`: StateHash, QTable, EpsilonGreedy, Reward
- `elex-memory`: HnswIndex for context retrieval

## Usage Example

```rust
use elex_agent::QueryHandler;

let mut handler = QueryHandler::new();

let input = QueryInput::new("What is lbTpNonQualFraction?")
    .with_context("Cell-123");

let response = handler.process_query(input)?;

println!("Response: {}", response.text);
println!("Action: {:?}", response.action);
println!("Confidence: {}", response.confidence);

// Record feedback
handler.record_feedback(
    response.state_hash,
    response.action,
    0.8,  // user rating
    true, // resolution success
    response.processing_time_ms,
)?;
```

## Integration Points

1. **FeatureAgent**: QueryHandler integrated into agent's query processing
2. **Federated Learning**: Q-table export/import for peer sync
3. **Memory System**: HNSW index for context retrieval
4. **Safety Layer**: Risk assessment for cmedit commands

## Testing

Comprehensive test suite included:
- Intent classification tests
- Complexity assessment tests
- Entity extraction tests
- Full pipeline processing tests
- Feedback recording tests
- Epsilon decay tests

## File Location

`/Users/cedric/dev/2026/test-cfv3/src/wasm/crates/elex-agent/src/query_handler.rs`

## Exported Types (via lib.rs)

- QueryHandler
- QueryInput
- QueryResponse
- ExtractedEntities
- ContextResult
- SimilarQuery
- CmeditCommand (as QueryCmeditCommand)

## Notes

- cmedit command generation is a placeholder (Phase 7 will implement full ELEX-038)
- Embedding generation uses simplified hash-based approach (production should use BERT/sentence-transformers)
- Entity extraction uses pattern matching (production should use NER models)
