/**
 * ELEX Edge AI Agent Swarm - Agent Errors
 *
 * Custom error classes for agent-related operations.
 */

/**
 * Base class for all ELEX errors
 */
export class ElexError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ElexError';
    // captureStackTrace is V8-specific (Node.js)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when an agent is not found
 */
export class AgentNotFoundError extends ElexError {
  constructor(agentId: string) {
    super(
      `Agent not found: ${agentId}`,
      'AGENT_NOT_FOUND',
      { agentId }
    );
    this.name = 'AgentNotFoundError';
  }
}

/**
 * Error thrown when an agent is not ready
 */
export class AgentNotReadyError extends ElexError {
  constructor(agentId: string, status: string) {
    super(
      `Agent ${agentId} is not ready: status is ${status}`,
      'AGENT_NOT_READY',
      { agentId, status }
    );
    this.name = 'AgentNotReadyError';
  }
}

/**
 * Error thrown when a feature is not found
 */
export class FeatureNotFoundError extends ElexError {
  constructor(fajCode: string) {
    super(
      `Feature not found for FAJ code: ${fajCode}`,
      'FEATURE_NOT_FOUND',
      { fajCode }
    );
    this.name = 'FeatureNotFoundError';
  }
}

/**
 * Error thrown when agent initialization fails
 */
export class AgentInitializationError extends ElexError {
  constructor(agentId: string, cause: Error) {
    super(
      `Failed to initialize agent ${agentId}: ${cause.message}`,
      'AGENT_INITIALIZATION_FAILED',
      { agentId, cause: cause.message }
    );
    this.name = 'AgentInitializationError';
    this.cause = cause;
  }
}

/**
 * Error thrown when query handling fails
 */
export class QueryHandlingError extends ElexError {
  constructor(queryId: string, agentId: string, cause: Error) {
    super(
      `Failed to handle query ${queryId} on agent ${agentId}: ${cause.message}`,
      'QUERY_HANDLING_FAILED',
      { queryId, agentId, cause: cause.message }
    );
    this.name = 'QueryHandlingError';
    this.cause = cause;
  }
}

/**
 * Error thrown when routing fails
 */
export class RoutingError extends ElexError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'ROUTING_FAILED',
      details
    );
    this.name = 'RoutingError';
  }
}

/**
 * Error thrown when knowledge loading fails
 */
export class KnowledgeLoadingError extends ElexError {
  constructor(source: string, cause: Error) {
    super(
      `Failed to load knowledge from ${source}: ${cause.message}`,
      'KNOWLEDGE_LOADING_FAILED',
      { source, cause: cause.message }
    );
    this.name = 'KnowledgeLoadingError';
    this.cause = cause;
  }
}

/**
 * Error thrown when memory operations fail
 */
export class MemoryError extends ElexError {
  constructor(operation: string, cause: Error) {
    super(
      `Memory operation '${operation}' failed: ${cause.message}`,
      'MEMORY_OPERATION_FAILED',
      { operation, cause: cause.message }
    );
    this.name = 'MemoryError';
    this.cause = cause;
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends ElexError {
  constructor(parameter: string, value: unknown, reason: string) {
    super(
      `Invalid configuration for '${parameter}': ${reason}`,
      'INVALID_CONFIGURATION',
      { parameter, value, reason }
    );
    this.name = 'ConfigurationError';
  }
}
