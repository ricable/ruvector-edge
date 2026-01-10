/**
 * ELEX Security Layer - AES-256-GCM Encryption
 *
 * Provides authenticated encryption using AES-256-GCM.
 * Used for encrypting sensitive message payloads.
 *
 * @see ADR-007 Layer 3: Payload Encryption
 */

import { gcm } from '@noble/ciphers/aes';
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';

import type { EncryptedPayload } from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';

/**
 * Key size in bytes (256 bits = 32 bytes)
 */
export const AES_KEY_SIZE = 32;

/**
 * IV size in bytes (96 bits = 12 bytes, recommended for GCM)
 */
export const AES_IV_SIZE = 12;

/**
 * Authentication tag size in bytes (128 bits = 16 bytes)
 */
export const AES_TAG_SIZE = 16;

/**
 * Encrypt data using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param key - 256-bit encryption key
 * @param keyId - Identifier for this key (for key lookup during decryption)
 * @param additionalData - Optional authenticated additional data (AAD)
 * @returns Encrypted payload with ciphertext, IV, and auth tag
 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  keyId: string,
  additionalData?: Uint8Array
): EncryptedPayload {
  if (key.length !== AES_KEY_SIZE) {
    throw new SecurityError(
      `Key must be ${AES_KEY_SIZE} bytes`,
      SecurityErrorCode.INVALID_INPUT,
      { keyLength: key.length }
    );
  }

  try {
    // Generate random IV
    const iv = randomBytes(AES_IV_SIZE);

    // Create cipher with optional AAD
    const cipher = gcm(key, iv, additionalData);

    // Encrypt and get ciphertext with appended auth tag
    const ciphertextWithTag = cipher.encrypt(plaintext);

    // Split ciphertext and auth tag
    const ciphertext = ciphertextWithTag.slice(0, -AES_TAG_SIZE);
    const authTag = ciphertextWithTag.slice(-AES_TAG_SIZE);

    return {
      ciphertext,
      iv,
      authTag,
      keyId,
    };
  } catch (error) {
    throw new SecurityError(
      'Encryption failed',
      SecurityErrorCode.ENCRYPTION_FAILED,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param payload - Encrypted payload
 * @param key - 256-bit decryption key
 * @param additionalData - Optional authenticated additional data (must match encryption)
 * @returns Decrypted plaintext
 */
export function decrypt(
  payload: EncryptedPayload,
  key: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  if (key.length !== AES_KEY_SIZE) {
    throw new SecurityError(
      `Key must be ${AES_KEY_SIZE} bytes`,
      SecurityErrorCode.INVALID_INPUT,
      { keyLength: key.length }
    );
  }

  if (payload.iv.length !== AES_IV_SIZE) {
    throw new SecurityError(
      `IV must be ${AES_IV_SIZE} bytes`,
      SecurityErrorCode.INVALID_INPUT,
      { ivLength: payload.iv.length }
    );
  }

  if (payload.authTag.length !== AES_TAG_SIZE) {
    throw new SecurityError(
      `Auth tag must be ${AES_TAG_SIZE} bytes`,
      SecurityErrorCode.INVALID_INPUT,
      { tagLength: payload.authTag.length }
    );
  }

  try {
    // Reconstruct ciphertext with auth tag
    const ciphertextWithTag = new Uint8Array(
      payload.ciphertext.length + payload.authTag.length
    );
    ciphertextWithTag.set(payload.ciphertext);
    ciphertextWithTag.set(payload.authTag, payload.ciphertext.length);

    // Create cipher with optional AAD
    const cipher = gcm(key, payload.iv, additionalData);

    // Decrypt (will throw if auth tag verification fails)
    return cipher.decrypt(ciphertextWithTag);
  } catch (error) {
    throw new SecurityError(
      'Decryption failed (authentication failed or corrupted data)',
      SecurityErrorCode.DECRYPTION_FAILED,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Encrypt a string payload
 *
 * @param plaintext - String to encrypt
 * @param key - 256-bit encryption key
 * @param keyId - Key identifier
 * @returns Encrypted payload
 */
export function encryptString(
  plaintext: string,
  key: Uint8Array,
  keyId: string
): EncryptedPayload {
  const encoder = new TextEncoder();
  return encrypt(encoder.encode(plaintext), key, keyId);
}

/**
 * Decrypt to a string
 *
 * @param payload - Encrypted payload
 * @param key - 256-bit decryption key
 * @returns Decrypted string
 */
export function decryptString(
  payload: EncryptedPayload,
  key: Uint8Array
): string {
  const plaintext = decrypt(payload, key);
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Encrypt a JSON-serializable object
 *
 * @param data - Object to encrypt
 * @param key - 256-bit encryption key
 * @param keyId - Key identifier
 * @returns Encrypted payload
 */
export function encryptJSON<T>(
  data: T,
  key: Uint8Array,
  keyId: string
): EncryptedPayload {
  return encryptString(JSON.stringify(data), key, keyId);
}

/**
 * Decrypt to a JSON object
 *
 * @param payload - Encrypted payload
 * @param key - 256-bit decryption key
 * @returns Decrypted object
 */
export function decryptJSON<T>(payload: EncryptedPayload, key: Uint8Array): T {
  const json = decryptString(payload, key);
  return JSON.parse(json) as T;
}

/**
 * Generate a random 256-bit key
 *
 * @returns 32-byte random key
 */
export function generateKey(): Uint8Array {
  return randomBytes(AES_KEY_SIZE);
}

/**
 * Serialize encrypted payload for transport
 */
export function serializeEncryptedPayload(payload: EncryptedPayload): {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
} {
  return {
    ciphertext: bytesToHex(payload.ciphertext),
    iv: bytesToHex(payload.iv),
    authTag: bytesToHex(payload.authTag),
    keyId: payload.keyId,
  };
}

/**
 * Deserialize encrypted payload from transport
 */
export function deserializeEncryptedPayload(serialized: {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}): EncryptedPayload {
  return {
    ciphertext: hexToBytes(serialized.ciphertext),
    iv: hexToBytes(serialized.iv),
    authTag: hexToBytes(serialized.authTag),
    keyId: serialized.keyId,
  };
}

/**
 * Securely clear a key from memory
 *
 * @param key - Key to clear
 */
export function clearKey(key: Uint8Array): void {
  for (let i = 0; i < key.length; i++) {
    key[i] = 0;
  }
}
