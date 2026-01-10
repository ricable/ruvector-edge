/**
 * Pattern Recognition Module
 * Exports HNSW Index, Pattern Store, Intent Classifier, and Embedder
 */

export {
  HNSWIndex,
  type Vector,
  type SearchResult,
  type HNSWConfig,
} from './hnsw-index';

export {
  PatternStore,
  type StoredPattern,
} from './pattern-store';

export {
  IntentClassifier,
  intentClassifier,
  type IntentClassifierConfig,
} from './intent-classifier';

export {
  SimpleEmbedder,
  simpleEmbedder,
  embedState,
  embedContext,
  type EmbedderConfig,
} from './embedder';
