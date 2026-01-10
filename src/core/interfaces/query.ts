/**
 * @fileoverview Query and Response interfaces
 * @module @ruvector/edge/core/interfaces/query
 *
 * @see docs/ddd/domain-model.md
 */

import type {
  AgentId,
  FAJCode,
  QueryId,
  ManagedObjectId
} from '../types/identifiers.js';

import type {
  QueryType,
  ComplexityLevel
} from '../types/enums.js';

import type {
  Timestamp,
  Vector,
  ConfidenceScore,
  ParameterValue
} from '../types/primitives.js';

/**
 * Incoming query to the agent swarm
 */
export interface IQuery {
  readonly id: QueryId;
  readonly type: QueryType;
  readonly content: string;
  readonly context: IQueryContext;
  readonly timestamp: Timestamp;
  readonly complexity: ComplexityLevel;
  readonly embedding?: Vector;
}

/**
 * Query context for routing and handling
 */
export interface IQueryContext {
  /** User or system identifier */
  readonly source: string;
  /** Session identifier if applicable */
  readonly sessionId?: string;
  /** Previous query IDs in conversation */
  readonly previousQueries?: QueryId[];
  /** Specific feature context if known */
  readonly featureContext?: FAJCode;
  /** Cell or network element context */
  readonly networkContext?: INetworkContext;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Network element context
 */
export interface INetworkContext {
  readonly cellId?: string;
  readonly sectorId?: string;
  readonly nodeId?: string;
  readonly clusterId?: string;
}

/**
 * Agent response to a query
 */
export interface IResponse {
  readonly queryId: QueryId;
  readonly agentId: AgentId;
  readonly featureFaj: FAJCode;
  readonly content: string;
  readonly confidence: ConfidenceScore;
  readonly sources: ISource[];
  readonly cmeditCommands: ICmeditCommand[];
  readonly relatedFeatures: FAJCode[];
  readonly consultedAgents: AgentId[];
  readonly latencyMs: number;
  readonly timestamp: Timestamp;
}

/**
 * Source reference for response
 */
export interface ISource {
  readonly type: 'documentation' | 'procedure' | 'case' | 'expert' | 'learned';
  readonly reference: string;
  readonly confidence: ConfidenceScore;
}

/**
 * ENM cmedit command for parameter modification
 */
export interface ICmeditCommand {
  readonly command: string;
  readonly targetMO: ManagedObjectId;
  readonly parameter: string;
  readonly value: ParameterValue;
  readonly verificationSteps: IVerificationStep[];

  /** Generate full cmedit script */
  toScript(): string;
}

/**
 * Verification step for cmedit command
 */
export interface IVerificationStep {
  readonly description: string;
  readonly command: string;
  readonly expectedResult: string;
  readonly timeout: number;
}

/**
 * Query routing result from semantic router
 */
export interface IRoutingResult {
  /** Top-K agents for this query */
  readonly agents: IRoutedAgent[];
  /** Query embedding used */
  readonly queryEmbedding: Vector;
  /** Routing latency in ms */
  readonly latencyMs: number;
}

/**
 * Routed agent with similarity score
 */
export interface IRoutedAgent {
  readonly agentId: AgentId;
  readonly fajCode: FAJCode;
  readonly category: string;
  readonly similarity: number;
}
