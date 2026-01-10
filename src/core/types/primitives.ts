/**
 * @fileoverview Primitive value types and type aliases
 * @module @ruvector/edge/core/types/primitives
 */

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number;

/**
 * Duration in milliseconds
 */
export type Duration = number;

/**
 * Hash string (typically SHA-256)
 */
export type Hash = string;

/**
 * Nonce for cryptographic operations
 */
export type Nonce = string;

/**
 * UUID string
 */
export type UUID = string;

/**
 * Percentage value (0-100)
 */
export type Percentage = number;

/**
 * Confidence score (0.0 - 1.0)
 */
export type ConfidenceScore = number;

/**
 * Health score (0.0 - 1.0)
 */
export type HealthScore = number;

/**
 * Q-value for Q-learning
 */
export type QValue = number;

/**
 * Learning rate (alpha) for Q-learning
 */
export type LearningRate = number;

/**
 * Discount factor (gamma) for Q-learning
 */
export type DiscountFactor = number;

/**
 * Exploration rate (epsilon) for Q-learning
 */
export type ExplorationRate = number;

/**
 * Reward signal value
 */
export type RewardValue = number;

/**
 * Vector embedding - fixed size array
 */
export type Vector = Float32Array;

/**
 * 128-dimensional embedding (standard for ELEX)
 * @see ADR-005: HNSW Vector Indexing
 */
export type Embedding128 = Float32Array & { readonly length: 128 };

/**
 * Ed25519 public key (32 bytes)
 * @see ADR-007: Security and Cryptography Architecture
 */
export type PublicKey = Uint8Array;

/**
 * Ed25519 private key (32 bytes)
 */
export type PrivateKey = Uint8Array;

/**
 * Ed25519 signature (64 bytes)
 */
export type Signature = Uint8Array;

/**
 * AES-256-GCM encrypted payload
 */
export type EncryptedPayload = Uint8Array;

/**
 * Parameter value - can be number, string, or boolean
 */
export type ParameterValue = number | string | boolean;

/**
 * Data type for parameters
 */
export type DataType = 'integer' | 'float' | 'string' | 'boolean' | 'enum';

/**
 * Unit for KPIs
 */
export type Unit = 'percent' | 'ms' | 'dBm' | 'count' | 'ratio' | 'mbps' | 'none';

/**
 * Validation helper functions
 */
export function isConfidenceScore(value: number): value is ConfidenceScore {
  return value >= 0 && value <= 1;
}

export function isPercentage(value: number): value is Percentage {
  return value >= 0 && value <= 100;
}

export function isValidVector(vec: Float32Array, dimensions: number): boolean {
  return vec.length === dimensions;
}

/**
 * Create a 128-dimensional embedding
 */
export function createEmbedding128(values: number[]): Embedding128 {
  if (values.length !== 128) {
    throw new Error(`Embedding must be 128 dimensions, got ${values.length}`);
  }
  return new Float32Array(values) as Embedding128;
}
