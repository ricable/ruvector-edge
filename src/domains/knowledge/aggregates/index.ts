/**
 * Knowledge Context - Aggregates
 *
 * Exports all aggregates for the Knowledge bounded context.
 */

export {
  FeatureAgent,
  AgentStatus,
  AgentId,
  AgentConfig,
  HealthScore,
  ConfidenceScore,
  AgentInitialized,
  QueryProcessed,
  FeedbackRecorded,
  PeerConsulted,
  FeatureAgentEvent
} from './feature-agent';

export {
  FeatureKnowledge,
  FeatureKnowledgeConfig,
  KnowledgeStats,
  KnowledgeLoadedEvent,
  ParameterAddedEvent,
  CounterAddedEvent,
  KnowledgeUpdatedEvent,
  FeatureKnowledgeEvent
} from './feature-knowledge';
