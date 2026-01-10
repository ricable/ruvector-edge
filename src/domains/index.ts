/**
 * ELEX Edge AI Agent Swarm - Domain Layer
 *
 * This module exports all 6 bounded contexts following Domain-Driven Design principles.
 *
 * Bounded Context Map:
 * ====================
 *
 * CORE DOMAIN (Business Differentiators):
 * - Knowledge Context: 593 specialized feature agents, FAJ code management
 * - Intelligence Context: Q-learning, trajectory replay, federated learning
 * - Optimization Context: KPI monitoring, root cause analysis, 6-phase control loop
 *
 * SUPPORTING DOMAIN (Business Enablers):
 * - Coordination Context: Semantic routing, consensus, topology management
 * - Security Context: Ed25519 identity, AES-256-GCM encryption, post-quantum
 *
 * GENERIC DOMAIN (Infrastructure):
 * - Runtime Context: WASM modules, resource management, edge deployment
 *
 * Context Integration Patterns:
 * =============================
 * - Knowledge <-> Intelligence: Partnership (tight collaboration)
 * - Intelligence -> Optimization: Customer-Supplier (task defines needs)
 * - Optimization -> Coordination: Published Language (domain events)
 * - Coordination -> Security: Conformist (follows security rules)
 * - Security -> Runtime: Anti-Corruption Layer (shields from platform details)
 * - Knowledge -> Coordination: Open Host Service (standard API)
 *
 * Aggregate Roots:
 * ================
 * - FeatureAgent (Knowledge)
 * - QTable (Intelligence)
 * - OptimizationCycle (Optimization)
 * - Swarm (Coordination)
 * - AgentIdentity (Security)
 * - RuntimeEnvironment (Runtime)
 */

// Core Domain
export * as knowledge from './knowledge';
export * as intelligence from './intelligence';
export * as optimization from './optimization';

// Supporting Domain
export * as coordination from './coordination';
export * as security from './security';

// Generic Domain
export * as runtime from './runtime';

// Re-export commonly used types for convenience
export {
  FAJCode,
  Parameter,
  Counter,
  KPI,
  Feature,
  FeatureAgent,
  KnowledgeBase
} from './knowledge';

export {
  State,
  Action,
  Reward,
  QTable,
  Trajectory,
  FederatedMerger
} from './intelligence';

export {
  RootCause,
  CmeditCommand,
  OptimizationCycle,
  KPIMonitor,
  SafeZone,
  MinCutAnalyzer
} from './optimization';

export {
  Query,
  Response,
  Swarm,
  Router,
  ConsensusManager,
  TopologyManager
} from './coordination';

export {
  Message,
  AgentIdentity,
  CryptoProvider,
  MessageVerifier
} from './security';

export {
  DeploymentConfiguration,
  RuntimeEnvironment,
  WASMModule,
  ResourceManager
} from './runtime';
