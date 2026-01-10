/**
 * ELEX Security Layer - Message Builder
 *
 * Creates secure messages with UUID, timestamp, nonce, and signature.
 * All messages are signed with the sender's Ed25519 private key.
 *
 * @see ADR-007 Layer 2: Message Signing
 */

import { v4 as uuidv4 } from 'uuid';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils';
import { randomBytes } from '@noble/hashes/utils';

import type {
  AgentId,
  MessageId,
  Nonce,
  SecureMessage,
  Signature,
  Timestamp,
} from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';
import { sign } from '../identity/keypair.js';

/**
 * Build a secure message with cryptographic protections
 *
 * @param senderId - Sender's agent ID
 * @param recipientId - Recipient's agent ID (or 'broadcast')
 * @param payload - Message payload (will be serialized to JSON)
 * @param privateKey - Sender's private key for signing
 * @param isEncrypted - Whether the payload is encrypted
 * @returns Promise resolving to signed secure message
 */
export async function buildSecureMessage<T>(
  senderId: AgentId,
  recipientId: AgentId | 'broadcast',
  payload: T,
  privateKey: Uint8Array,
  isEncrypted: boolean = false
): Promise<SecureMessage<T>> {
  // Generate unique message ID
  const messageId = uuidv4();

  // Current timestamp
  const timestamp = Date.now();

  // Generate random nonce (16 bytes, hex-encoded)
  const nonceBytes = randomBytes(16);
  const nonce = bytesToHex(nonceBytes);

  // Create unsigned message
  const unsignedMessage: Omit<SecureMessage<T>, 'signature'> = {
    messageId,
    senderId,
    recipientId,
    timestamp,
    nonce,
    payload,
    isEncrypted,
  };

  // Create signature over message
  const signatureData = createSignatureData(unsignedMessage);
  const signature = await sign(signatureData, privateKey);

  return {
    ...unsignedMessage,
    signature,
  };
}

/**
 * Create the data to be signed for a message
 *
 * The signature covers: messageId + senderId + recipientId + timestamp + nonce + payload hash
 */
export function createSignatureData<T>(
  message: Omit<SecureMessage<T>, 'signature'>
): Uint8Array {
  // Serialize payload to JSON for consistent hashing
  const payloadStr =
    typeof message.payload === 'string'
      ? message.payload
      : JSON.stringify(message.payload);

  // Create canonical string representation
  const canonical = [
    'ELEX-MSG-v1',
    message.messageId,
    message.senderId,
    message.recipientId,
    message.timestamp.toString(),
    message.nonce,
    message.isEncrypted.toString(),
    payloadStr,
  ].join(':');

  return utf8ToBytes(canonical);
}

/**
 * Serialize a secure message to transport format
 */
export function serializeSecureMessage<T>(
  message: SecureMessage<T>
): SerializedSecureMessage {
  return {
    messageId: message.messageId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    timestamp: message.timestamp,
    nonce: message.nonce,
    payload:
      typeof message.payload === 'string'
        ? message.payload
        : JSON.stringify(message.payload),
    isEncrypted: message.isEncrypted,
    signature: bytesToHex(message.signature),
  };
}

/**
 * Deserialize a secure message from transport format
 */
export function deserializeSecureMessage<T>(
  serialized: SerializedSecureMessage,
  parsePayload: boolean = true
): SecureMessage<T> {
  const { hexToBytes } = require('@noble/hashes/utils');

  let payload: T;
  if (parsePayload && !serialized.isEncrypted) {
    try {
      payload = JSON.parse(serialized.payload) as T;
    } catch {
      payload = serialized.payload as unknown as T;
    }
  } else {
    payload = serialized.payload as unknown as T;
  }

  return {
    messageId: serialized.messageId,
    senderId: serialized.senderId,
    recipientId: serialized.recipientId,
    timestamp: serialized.timestamp,
    nonce: serialized.nonce,
    payload,
    isEncrypted: serialized.isEncrypted,
    signature: hexToBytes(serialized.signature),
  };
}

/**
 * Serialized secure message for transport
 */
export interface SerializedSecureMessage {
  messageId: string;
  senderId: string;
  recipientId: string;
  timestamp: number;
  nonce: string;
  payload: string;
  isEncrypted: boolean;
  signature: string;
}

/**
 * Message Builder class for creating secure messages
 */
export class MessageBuilder {
  constructor(
    private senderId: AgentId,
    private privateKey: Uint8Array
  ) {}

  /**
   * Build a message to a specific recipient
   */
  async to<T>(
    recipientId: AgentId,
    payload: T,
    isEncrypted: boolean = false
  ): Promise<SecureMessage<T>> {
    return buildSecureMessage(
      this.senderId,
      recipientId,
      payload,
      this.privateKey,
      isEncrypted
    );
  }

  /**
   * Build a broadcast message
   */
  async broadcast<T>(
    payload: T,
    isEncrypted: boolean = false
  ): Promise<SecureMessage<T>> {
    return buildSecureMessage(
      this.senderId,
      'broadcast',
      payload,
      this.privateKey,
      isEncrypted
    );
  }

  /**
   * Update the sender ID
   */
  setSenderId(senderId: AgentId): void {
    this.senderId = senderId;
  }

  /**
   * Update the private key (use with caution)
   */
  setPrivateKey(privateKey: Uint8Array): void {
    // Clear old key
    for (let i = 0; i < this.privateKey.length; i++) {
      this.privateKey[i] = 0;
    }
    this.privateKey = privateKey;
  }

  /**
   * Clear the private key from memory
   */
  clear(): void {
    for (let i = 0; i < this.privateKey.length; i++) {
      this.privateKey[i] = 0;
    }
  }
}
