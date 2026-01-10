/**
 * ELEX Security Layer - Ed25519 Keypair Generation
 *
 * Provides Ed25519 keypair generation and management for agent identity.
 * Uses @noble/ed25519 for WASM-compatible cryptographic operations.
 *
 * @see ADR-007 Layer 1: Agent Identity
 */

import * as ed25519 from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';

import type {
  AgentId,
  Keypair,
  PrivateKey,
  PublicKey,
  Signature,
} from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';

/**
 * Generate a new Ed25519 keypair for agent identity
 *
 * @returns Promise resolving to a new keypair with 32-byte private and public keys
 * @throws SecurityError if key generation fails
 */
export async function generateKeypair(): Promise<Keypair> {
  try {
    // Generate 32 random bytes for private key
    const privateKey = randomBytes(32);

    // Derive public key from private key
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);

    return {
      privateKey,
      publicKey,
    };
  } catch (error) {
    throw new SecurityError(
      'Failed to generate Ed25519 keypair',
      SecurityErrorCode.KEY_GENERATION_FAILED,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Derive agent ID from public key
 *
 * Agent ID is the SHA-256 hash of the public key, hex-encoded.
 * This provides a stable, unique identifier derived from the cryptographic identity.
 *
 * @param publicKey - 32-byte Ed25519 public key
 * @returns 64-character hex string agent ID
 */
export function deriveAgentId(publicKey: PublicKey): AgentId {
  if (publicKey.length !== 32) {
    throw new SecurityError(
      'Public key must be 32 bytes',
      SecurityErrorCode.INVALID_INPUT,
      { keyLength: publicKey.length }
    );
  }

  const hash = sha256(publicKey);
  return bytesToHex(hash);
}

/**
 * Sign a message with the private key
 *
 * @param message - Message bytes to sign
 * @param privateKey - 32-byte Ed25519 private key
 * @returns Promise resolving to 64-byte signature
 */
export async function sign(
  message: Uint8Array,
  privateKey: PrivateKey
): Promise<Signature> {
  try {
    if (privateKey.length !== 32) {
      throw new SecurityError(
        'Private key must be 32 bytes',
        SecurityErrorCode.INVALID_INPUT,
        { keyLength: privateKey.length }
      );
    }

    return await ed25519.signAsync(message, privateKey);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new SecurityError(
      'Failed to sign message',
      SecurityErrorCode.SIGNING_FAILED,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Verify a signature against a message and public key
 *
 * @param signature - 64-byte Ed25519 signature
 * @param message - Original message bytes
 * @param publicKey - 32-byte Ed25519 public key
 * @returns Promise resolving to true if signature is valid
 */
export async function verify(
  signature: Signature,
  message: Uint8Array,
  publicKey: PublicKey
): Promise<boolean> {
  try {
    if (signature.length !== 64) {
      return false;
    }
    if (publicKey.length !== 32) {
      return false;
    }

    return await ed25519.verifyAsync(signature, message, publicKey);
  } catch {
    // Verification failures return false, not errors
    return false;
  }
}

/**
 * Serialize a keypair to a storable format
 *
 * WARNING: The private key must be stored securely!
 *
 * @param keypair - Keypair to serialize
 * @returns Object with hex-encoded keys
 */
export function serializeKeypair(keypair: Keypair): {
  privateKey: string;
  publicKey: string;
} {
  return {
    privateKey: bytesToHex(keypair.privateKey),
    publicKey: bytesToHex(keypair.publicKey),
  };
}

/**
 * Deserialize a keypair from stored format
 *
 * @param serialized - Object with hex-encoded keys
 * @returns Keypair with Uint8Array keys
 */
export function deserializeKeypair(serialized: {
  privateKey: string;
  publicKey: string;
}): Keypair {
  try {
    const privateKey = hexToBytes(serialized.privateKey);
    const publicKey = hexToBytes(serialized.publicKey);

    if (privateKey.length !== 32) {
      throw new SecurityError(
        'Invalid private key length',
        SecurityErrorCode.INVALID_INPUT,
        { length: privateKey.length }
      );
    }

    if (publicKey.length !== 32) {
      throw new SecurityError(
        'Invalid public key length',
        SecurityErrorCode.INVALID_INPUT,
        { length: publicKey.length }
      );
    }

    return { privateKey, publicKey };
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new SecurityError(
      'Failed to deserialize keypair',
      SecurityErrorCode.INVALID_INPUT,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Convert public key to hex string
 */
export function publicKeyToHex(publicKey: PublicKey): string {
  return bytesToHex(publicKey);
}

/**
 * Convert hex string to public key
 */
export function hexToPublicKey(hex: string): PublicKey {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 32) {
    throw new SecurityError(
      'Invalid public key hex length',
      SecurityErrorCode.INVALID_INPUT,
      { hexLength: hex.length }
    );
  }
  return bytes;
}

/**
 * Convert signature to hex string
 */
export function signatureToHex(signature: Signature): string {
  return bytesToHex(signature);
}

/**
 * Convert hex string to signature
 */
export function hexToSignature(hex: string): Signature {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 64) {
    throw new SecurityError(
      'Invalid signature hex length',
      SecurityErrorCode.INVALID_INPUT,
      { hexLength: hex.length }
    );
  }
  return bytes;
}

/**
 * Validate that a keypair is correctly formed
 *
 * @param keypair - Keypair to validate
 * @returns Promise resolving to true if keypair is valid
 */
export async function validateKeypair(keypair: Keypair): Promise<boolean> {
  try {
    // Derive public key from private key and compare
    const derivedPublicKey = await ed25519.getPublicKeyAsync(keypair.privateKey);

    if (derivedPublicKey.length !== keypair.publicKey.length) {
      return false;
    }

    for (let i = 0; i < derivedPublicKey.length; i++) {
      if (derivedPublicKey[i] !== keypair.publicKey[i]) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Securely clear a private key from memory
 *
 * Note: This is a best-effort attempt. JavaScript's garbage collection
 * may still leave copies of the key in memory.
 *
 * @param privateKey - Private key to clear
 */
export function clearPrivateKey(privateKey: PrivateKey): void {
  for (let i = 0; i < privateKey.length; i++) {
    privateKey[i] = 0;
  }
}
