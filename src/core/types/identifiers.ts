/**
 * @fileoverview Core identifier types for ELEX Edge AI Agent Swarm
 * @module @ruvector/edge/core/types/identifiers
 *
 * All identifiers are branded types for type safety.
 * Based on ADR-004: One Agent Per Feature Specialization
 */

// Branded type helper for nominal typing
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

/**
 * Agent identifier - derived from Ed25519 public key hash
 * @see ADR-007: Security and Cryptography Architecture
 */
export type AgentId = Brand<string, 'AgentId'>;

/**
 * FAJ Code - Ericsson feature identifier
 * Format: "FAJ XXX YYYY" (e.g., "FAJ 121 3094")
 * @see ADR-004: One Agent Per Feature Specialization
 */
export type FAJCode = Brand<string, 'FAJCode'>;

/**
 * Feature identifier
 */
export type FeatureId = Brand<string, 'FeatureId'>;

/**
 * Query identifier - UUID v4
 */
export type QueryId = Brand<string, 'QueryId'>;

/**
 * Q-Table identifier
 */
export type QTableId = Brand<string, 'QTableId'>;

/**
 * Trajectory identifier for experience replay
 */
export type TrajectoryId = Brand<string, 'TrajectoryId'>;

/**
 * KPI Monitor identifier
 */
export type KPIMonitorId = Brand<string, 'KPIMonitorId'>;

/**
 * Optimization cycle identifier
 */
export type CycleId = Brand<string, 'CycleId'>;

/**
 * Session identifier
 */
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Swarm identifier
 */
export type SwarmId = Brand<string, 'SwarmId'>;

/**
 * Message UUID
 */
export type MessageId = Brand<string, 'MessageId'>;

/**
 * Managed Object identifier for ENM
 */
export type ManagedObjectId = Brand<string, 'ManagedObjectId'>;

// Factory functions for creating branded types
export function createAgentId(value: string): AgentId {
  return value as AgentId;
}

export function createFAJCode(value: string): FAJCode {
  if (!/^FAJ \d{3} \d{4}$/.test(value)) {
    throw new Error(`Invalid FAJ code format: ${value}. Expected "FAJ XXX YYYY"`);
  }
  return value as FAJCode;
}

export function createFeatureId(value: string): FeatureId {
  return value as FeatureId;
}

export function createQueryId(value: string): QueryId {
  return value as QueryId;
}

export function createQTableId(value: string): QTableId {
  return value as QTableId;
}

export function createTrajectoryId(value: string): TrajectoryId {
  return value as TrajectoryId;
}

export function createCycleId(value: string): CycleId {
  return value as CycleId;
}

export function createSwarmId(value: string): SwarmId {
  return value as SwarmId;
}

export function createMessageId(value: string): MessageId {
  return value as MessageId;
}
