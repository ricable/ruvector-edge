/**
 * ELEX Edge AI Agent Swarm - ID Value Objects
 *
 * Strongly-typed identifiers for domain entities.
 * These ensure type safety and prevent accidental mixing of IDs.
 */

/**
 * Brand type for creating nominal types
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * Agent identifier - derived from Ed25519 public key
 * Format: 32-byte hex string (64 characters)
 */
export type AgentId = Brand<string, 'AgentId'>;

/**
 * Feature identifier - unique identifier for a RAN feature
 */
export type FeatureId = Brand<string, 'FeatureId'>;

/**
 * Query identifier - UUID for tracking queries
 */
export type QueryId = Brand<string, 'QueryId'>;

/**
 * Q-Table identifier
 */
export type QTableId = Brand<string, 'QTableId'>;

/**
 * Trajectory identifier
 */
export type TrajectoryId = Brand<string, 'TrajectoryId'>;

/**
 * KPI Monitor identifier
 */
export type KPIMonitorId = Brand<string, 'KPIMonitorId'>;

/**
 * Optimization Cycle identifier
 */
export type CycleId = Brand<string, 'CycleId'>;

/**
 * FAJ Code - Ericsson feature identifier
 * Format: "FAJ XXX YYYY" where XXX is 3 digits and YYYY is 4 digits
 */
export class FAJCode {
  private static readonly PATTERN = /^FAJ \d{3} \d{4}$/;

  private constructor(private readonly value: string) {}

  /**
   * Create a FAJ code from a string value
   * @throws InvalidFAJCodeError if the format is invalid
   */
  static create(value: string): FAJCode {
    if (!FAJCode.isValid(value)) {
      throw new InvalidFAJCodeError(value);
    }
    return new FAJCode(value);
  }

  /**
   * Create a FAJ code without validation (for internal use only)
   */
  static unsafe(value: string): FAJCode {
    return new FAJCode(value);
  }

  /**
   * Check if a string is a valid FAJ code format
   */
  static isValid(value: string): boolean {
    return FAJCode.PATTERN.test(value);
  }

  /**
   * Parse FAJ code into components
   */
  get components(): { prefix: string; series: string; number: string } {
    const parts = this.value.split(' ');
    return {
      prefix: parts[0],
      series: parts[1],
      number: parts[2],
    };
  }

  /**
   * Get the numeric identifier (series + number)
   */
  get numericId(): string {
    const { series, number } = this.components;
    return `${series}${number}`;
  }

  equals(other: FAJCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/**
 * Error thrown when an invalid FAJ code is provided
 */
export class InvalidFAJCodeError extends Error {
  constructor(value: string) {
    super(`Invalid FAJ code format: "${value}". Expected format: "FAJ XXX YYYY"`);
    this.name = 'InvalidFAJCodeError';
  }
}

// ID Factory functions for type-safe creation
export const createAgentId = (value: string): AgentId => value as AgentId;
export const createFeatureId = (value: string): FeatureId => value as FeatureId;
export const createQueryId = (value: string): QueryId => value as QueryId;
export const createQTableId = (value: string): QTableId => value as QTableId;
export const createTrajectoryId = (value: string): TrajectoryId => value as TrajectoryId;
export const createKPIMonitorId = (value: string): KPIMonitorId => value as KPIMonitorId;
export const createCycleId = (value: string): CycleId => value as CycleId;
