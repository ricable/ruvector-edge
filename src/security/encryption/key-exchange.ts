/**
 * ELEX Security Layer - X25519 Key Exchange
 *
 * Provides Elliptic Curve Diffie-Hellman key exchange using X25519.
 * Enables ephemeral session keys with perfect forward secrecy.
 *
 * @see ADR-007 Layer 4: Key Exchange (X25519 ECDH)
 */

import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  AgentId,
  KeyExchangeRequest,
  KeyExchangeResponse,
  KeyExchangeResult,
  PublicKey,
  SessionKey,
  Timestamp,
} from '../types.js';
import { SecurityError, SecurityErrorCode, DEFAULT_SECURITY_CONFIG } from '../types.js';
import { sign, verify } from '../identity/keypair.js';
import { AES_KEY_SIZE } from './aes-gcm.js';

/**
 * X25519 private key size in bytes
 */
export const X25519_PRIVATE_KEY_SIZE = 32;

/**
 * X25519 public key size in bytes
 */
export const X25519_PUBLIC_KEY_SIZE = 32;

/**
 * HKDF info string for session key derivation
 */
const HKDF_INFO = new TextEncoder().encode('ELEX-SESSION-KEY-v1');

/**
 * Generate an ephemeral X25519 keypair for key exchange
 *
 * @returns Object with private and public keys
 */
export function generateEphemeralKeypair(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const privateKey = randomBytes(X25519_PRIVATE_KEY_SIZE);
  const publicKey = x25519.getPublicKey(privateKey);

  return { privateKey, publicKey };
}

/**
 * Perform ECDH key agreement
 *
 * @param myPrivateKey - Our ephemeral private key
 * @param theirPublicKey - Peer's ephemeral public key
 * @returns 32-byte shared secret
 */
export function computeSharedSecret(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array {
  if (myPrivateKey.length !== X25519_PRIVATE_KEY_SIZE) {
    throw new SecurityError(
      'Invalid private key length',
      SecurityErrorCode.INVALID_INPUT,
      { length: myPrivateKey.length }
    );
  }

  if (theirPublicKey.length !== X25519_PUBLIC_KEY_SIZE) {
    throw new SecurityError(
      'Invalid public key length',
      SecurityErrorCode.INVALID_INPUT,
      { length: theirPublicKey.length }
    );
  }

  try {
    return x25519.getSharedSecret(myPrivateKey, theirPublicKey);
  } catch (error) {
    throw new SecurityError(
      'Key exchange failed',
      SecurityErrorCode.KEY_EXCHANGE_FAILED,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Derive a session key from shared secret using HKDF
 *
 * @param sharedSecret - ECDH shared secret
 * @param peerId - Peer's agent ID (used as salt)
 * @param keyRotationIntervalMs - Key validity period (default: 1 hour)
 * @returns Session key with metadata
 */
export function deriveSessionKey(
  sharedSecret: Uint8Array,
  peerId: AgentId,
  keyRotationIntervalMs: number = DEFAULT_SECURITY_CONFIG.keyRotationIntervalMs
): SessionKey {
  // Use peer ID as salt (ensures different keys for different peers)
  const salt = new TextEncoder().encode(peerId);

  // Derive key using HKDF-SHA256
  const keyMaterial = hkdf(sha256, sharedSecret, salt, HKDF_INFO, AES_KEY_SIZE);

  const keyId = uuidv4();
  const createdAt = Date.now();

  return {
    keyId,
    key: keyMaterial,
    createdAt,
    expiresAt: createdAt + keyRotationIntervalMs,
    peerId,
  };
}

/**
 * Initiate key exchange
 *
 * Creates an ephemeral keypair and key exchange request message.
 *
 * @param initiatorId - Our agent ID
 * @param responderId - Peer's agent ID
 * @param signingKey - Our Ed25519 private key for signing
 * @returns Key exchange request and ephemeral private key
 */
export async function initiateKeyExchange(
  initiatorId: AgentId,
  responderId: AgentId,
  signingKey: Uint8Array
): Promise<{
  request: KeyExchangeRequest;
  ephemeralPrivateKey: Uint8Array;
}> {
  // Generate ephemeral keypair
  const { privateKey, publicKey } = generateEphemeralKeypair();

  const timestamp = Date.now();

  // Create signature data
  const signatureData = createKeyExchangeSignatureData(
    'request',
    publicKey,
    initiatorId,
    responderId,
    timestamp
  );

  // Sign the request
  const signature = await sign(signatureData, signingKey);

  const request: KeyExchangeRequest = {
    ephemeralPublicKey: publicKey,
    initiatorId,
    responderId,
    timestamp,
    signature,
  };

  return { request, ephemeralPrivateKey: privateKey };
}

/**
 * Respond to key exchange
 *
 * Creates a response with our ephemeral public key and derives the session key.
 *
 * @param request - Incoming key exchange request
 * @param myAgentId - Our agent ID
 * @param signingKey - Our Ed25519 private key
 * @param initiatorPublicKey - Initiator's Ed25519 public key (for verification)
 * @returns Key exchange response and result
 */
export async function respondToKeyExchange(
  request: KeyExchangeRequest,
  myAgentId: AgentId,
  signingKey: Uint8Array,
  initiatorPublicKey: PublicKey
): Promise<{
  response: KeyExchangeResponse;
  result: KeyExchangeResult;
}> {
  // Verify we are the intended responder
  if (request.responderId !== myAgentId) {
    throw new SecurityError(
      'Key exchange not addressed to this agent',
      SecurityErrorCode.KEY_EXCHANGE_FAILED,
      { expected: myAgentId, received: request.responderId }
    );
  }

  // Verify request signature
  const requestSignatureData = createKeyExchangeSignatureData(
    'request',
    request.ephemeralPublicKey,
    request.initiatorId,
    request.responderId,
    request.timestamp
  );

  const isValidRequest = await verify(
    request.signature,
    requestSignatureData,
    initiatorPublicKey
  );

  if (!isValidRequest) {
    throw new SecurityError(
      'Invalid key exchange request signature',
      SecurityErrorCode.KEY_EXCHANGE_FAILED
    );
  }

  // Generate our ephemeral keypair
  const { privateKey, publicKey } = generateEphemeralKeypair();

  // Compute shared secret
  const sharedSecret = computeSharedSecret(privateKey, request.ephemeralPublicKey);

  // Derive session key
  const sessionKey = deriveSessionKey(sharedSecret, request.initiatorId);

  // Create response
  const timestamp = Date.now();
  const responseSignatureData = createKeyExchangeSignatureData(
    'response',
    publicKey,
    myAgentId,
    request.initiatorId,
    timestamp,
    sessionKey.keyId
  );

  const signature = await sign(responseSignatureData, signingKey);

  const response: KeyExchangeResponse = {
    ephemeralPublicKey: publicKey,
    sessionKeyId: sessionKey.keyId,
    timestamp,
    signature,
  };

  const result: KeyExchangeResult = {
    sharedSecret,
    ephemeralPublicKey: publicKey,
    sessionKey,
  };

  // Clear ephemeral private key
  for (let i = 0; i < privateKey.length; i++) {
    privateKey[i] = 0;
  }

  return { response, result };
}

/**
 * Complete key exchange (initiator side)
 *
 * @param response - Key exchange response from responder
 * @param ephemeralPrivateKey - Our ephemeral private key
 * @param responderId - Responder's agent ID
 * @param responderPublicKey - Responder's Ed25519 public key
 * @returns Key exchange result with session key
 */
export async function completeKeyExchange(
  response: KeyExchangeResponse,
  ephemeralPrivateKey: Uint8Array,
  responderId: AgentId,
  responderPublicKey: PublicKey
): Promise<KeyExchangeResult> {
  // Verify response signature
  const responseSignatureData = createKeyExchangeSignatureData(
    'response',
    response.ephemeralPublicKey,
    responderId,
    '', // initiatorId not in response signature data
    response.timestamp,
    response.sessionKeyId
  );

  const isValidResponse = await verify(
    response.signature,
    responseSignatureData,
    responderPublicKey
  );

  if (!isValidResponse) {
    throw new SecurityError(
      'Invalid key exchange response signature',
      SecurityErrorCode.KEY_EXCHANGE_FAILED
    );
  }

  // Compute shared secret
  const sharedSecret = computeSharedSecret(
    ephemeralPrivateKey,
    response.ephemeralPublicKey
  );

  // Derive session key (using responder's ID as salt, same as responder)
  const sessionKey = deriveSessionKey(sharedSecret, responderId);

  // Override key ID to match responder's
  sessionKey.keyId = response.sessionKeyId;

  // Get our ephemeral public key for the result
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  // Clear ephemeral private key
  for (let i = 0; i < ephemeralPrivateKey.length; i++) {
    ephemeralPrivateKey[i] = 0;
  }

  return {
    sharedSecret,
    ephemeralPublicKey,
    sessionKey,
  };
}

/**
 * Create signature data for key exchange messages
 */
function createKeyExchangeSignatureData(
  type: 'request' | 'response',
  ephemeralPublicKey: Uint8Array,
  senderId: AgentId,
  recipientId: AgentId,
  timestamp: Timestamp,
  sessionKeyId?: string
): Uint8Array {
  const parts = [
    'ELEX-KX-v1',
    type,
    bytesToHex(ephemeralPublicKey),
    senderId,
    recipientId,
    timestamp.toString(),
  ];

  if (sessionKeyId) {
    parts.push(sessionKeyId);
  }

  return new TextEncoder().encode(parts.join(':'));
}

/**
 * Check if a session key is expired
 */
export function isSessionKeyExpired(sessionKey: SessionKey): boolean {
  return Date.now() > sessionKey.expiresAt;
}

/**
 * Clear session key from memory
 */
export function clearSessionKey(sessionKey: SessionKey): void {
  for (let i = 0; i < sessionKey.key.length; i++) {
    sessionKey.key[i] = 0;
  }
}
