/**
 * ELEX Security Layer - Agent Identity Management
 *
 * Manages cryptographic agent identities with FAJ code binding.
 * Each agent has an Ed25519 keypair and is authorized for a specific FAJ code.
 *
 * @see ADR-007 Layer 1: Agent Identity
 * @see bounded-contexts.md Security Context
 */

import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils';

import type {
  AgentId,
  AgentIdentity,
  AgentIdentityWithKeys,
  FAJCode,
  Keypair,
  PublicKey,
  Signature,
  Timestamp,
} from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';
import {
  deriveAgentId,
  generateKeypair,
  sign,
  verify,
  publicKeyToHex,
} from './keypair.js';

/**
 * Create a new agent identity with cryptographic binding to a FAJ code
 *
 * The FAJ binding is a signature over the agentId + fajCode, proving that
 * this agent is authorized for this specific RAN feature.
 *
 * @param fajCode - The FAJ code this agent is authorized for
 * @returns Promise resolving to agent identity with private key
 */
export async function createAgentIdentity(
  fajCode: FAJCode
): Promise<AgentIdentityWithKeys> {
  // Generate new Ed25519 keypair
  const keypair = await generateKeypair();

  // Derive agent ID from public key
  const agentId = deriveAgentId(keypair.publicKey);

  // Create FAJ binding signature
  const bindingMessage = createFAJBindingMessage(agentId, fajCode);
  const fajBinding = await sign(bindingMessage, keypair.privateKey);

  const createdAt = Date.now();

  return {
    agentId,
    publicKey: keypair.publicKey,
    fajCode,
    createdAt,
    fajBinding,
    privateKey: keypair.privateKey,
  };
}

/**
 * Create agent identity from an existing keypair
 *
 * @param keypair - Existing Ed25519 keypair
 * @param fajCode - The FAJ code this agent is authorized for
 * @returns Promise resolving to agent identity with private key
 */
export async function createAgentIdentityFromKeypair(
  keypair: Keypair,
  fajCode: FAJCode
): Promise<AgentIdentityWithKeys> {
  const agentId = deriveAgentId(keypair.publicKey);
  const bindingMessage = createFAJBindingMessage(agentId, fajCode);
  const fajBinding = await sign(bindingMessage, keypair.privateKey);
  const createdAt = Date.now();

  return {
    agentId,
    publicKey: keypair.publicKey,
    fajCode,
    createdAt,
    fajBinding,
    privateKey: keypair.privateKey,
  };
}

/**
 * Extract public identity from full identity (removes private key)
 *
 * @param identity - Full agent identity with private key
 * @returns Agent identity without private key (safe to share)
 */
export function extractPublicIdentity(
  identity: AgentIdentityWithKeys
): AgentIdentity {
  return {
    agentId: identity.agentId,
    publicKey: identity.publicKey,
    fajCode: identity.fajCode,
    createdAt: identity.createdAt,
    fajBinding: identity.fajBinding,
  };
}

/**
 * Verify an agent identity's FAJ binding
 *
 * @param identity - Agent identity to verify
 * @returns Promise resolving to true if identity is valid
 */
export async function verifyAgentIdentity(
  identity: AgentIdentity
): Promise<boolean> {
  try {
    // Verify agent ID matches public key
    const derivedAgentId = deriveAgentId(identity.publicKey);
    if (derivedAgentId !== identity.agentId) {
      return false;
    }

    // Verify FAJ binding signature
    const bindingMessage = createFAJBindingMessage(
      identity.agentId,
      identity.fajCode
    );
    return await verify(identity.fajBinding, bindingMessage, identity.publicKey);
  } catch {
    return false;
  }
}

/**
 * Create the message for FAJ binding signature
 *
 * Format: "ELEX-FAJ-BINDING-v1:" + agentId + ":" + fajCode
 */
function createFAJBindingMessage(agentId: AgentId, fajCode: FAJCode): Uint8Array {
  const prefix = 'ELEX-FAJ-BINDING-v1:';
  return utf8ToBytes(`${prefix}${agentId}:${fajCode}`);
}

/**
 * Serialize agent identity to JSON-safe format
 */
export function serializeAgentIdentity(identity: AgentIdentity): {
  agentId: string;
  publicKey: string;
  fajCode: string;
  createdAt: number;
  fajBinding: string;
} {
  return {
    agentId: identity.agentId,
    publicKey: publicKeyToHex(identity.publicKey),
    fajCode: identity.fajCode,
    createdAt: identity.createdAt,
    fajBinding: bytesToHex(identity.fajBinding),
  };
}

/**
 * Deserialize agent identity from JSON format
 */
export function deserializeAgentIdentity(serialized: {
  agentId: string;
  publicKey: string;
  fajCode: string;
  createdAt: number;
  fajBinding: string;
}): AgentIdentity {
  const { hexToBytes } = require('@noble/hashes/utils');

  return {
    agentId: serialized.agentId,
    publicKey: hexToBytes(serialized.publicKey),
    fajCode: serialized.fajCode,
    createdAt: serialized.createdAt,
    fajBinding: hexToBytes(serialized.fajBinding),
  };
}

/**
 * Agent Identity Manager
 *
 * Manages the local agent's identity and provides signing operations.
 */
export class AgentIdentityManager {
  private identity: AgentIdentityWithKeys | null = null;

  /**
   * Initialize with a new identity
   *
   * @param fajCode - FAJ code for this agent
   */
  async initialize(fajCode: FAJCode): Promise<AgentIdentity> {
    this.identity = await createAgentIdentity(fajCode);
    return extractPublicIdentity(this.identity);
  }

  /**
   * Initialize from an existing identity
   *
   * @param identity - Full identity with private key
   */
  async initializeFrom(identity: AgentIdentityWithKeys): Promise<void> {
    // Verify identity is valid
    if (!(await verifyAgentIdentity(identity))) {
      throw new SecurityError(
        'Invalid agent identity',
        SecurityErrorCode.VERIFICATION_FAILED
      );
    }
    this.identity = identity;
  }

  /**
   * Get the public identity (safe to share)
   */
  getPublicIdentity(): AgentIdentity {
    if (!this.identity) {
      throw new SecurityError(
        'Agent identity not initialized',
        SecurityErrorCode.AGENT_NOT_REGISTERED
      );
    }
    return extractPublicIdentity(this.identity);
  }

  /**
   * Get the agent ID
   */
  getAgentId(): AgentId {
    if (!this.identity) {
      throw new SecurityError(
        'Agent identity not initialized',
        SecurityErrorCode.AGENT_NOT_REGISTERED
      );
    }
    return this.identity.agentId;
  }

  /**
   * Get the FAJ code
   */
  getFAJCode(): FAJCode {
    if (!this.identity) {
      throw new SecurityError(
        'Agent identity not initialized',
        SecurityErrorCode.AGENT_NOT_REGISTERED
      );
    }
    return this.identity.fajCode;
  }

  /**
   * Sign a message with this agent's private key
   *
   * @param message - Message bytes to sign
   * @returns Promise resolving to signature
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    if (!this.identity) {
      throw new SecurityError(
        'Agent identity not initialized',
        SecurityErrorCode.AGENT_NOT_REGISTERED
      );
    }
    return sign(message, this.identity.privateKey);
  }

  /**
   * Verify a message signature from this agent
   *
   * @param signature - Signature to verify
   * @param message - Original message
   * @returns Promise resolving to true if valid
   */
  async verifyOwnSignature(
    signature: Signature,
    message: Uint8Array
  ): Promise<boolean> {
    if (!this.identity) {
      throw new SecurityError(
        'Agent identity not initialized',
        SecurityErrorCode.AGENT_NOT_REGISTERED
      );
    }
    return verify(signature, message, this.identity.publicKey);
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.identity !== null;
  }

  /**
   * Clear the identity from memory
   */
  clear(): void {
    if (this.identity) {
      // Clear private key
      for (let i = 0; i < this.identity.privateKey.length; i++) {
        this.identity.privateKey[i] = 0;
      }
      this.identity = null;
    }
  }
}
