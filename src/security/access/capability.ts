/**
 * ELEX Security Layer - Capability-Based Access Control
 *
 * Implements capability-based authorization where capabilities are
 * cryptographically signed grants that specify what actions an agent
 * can perform on specific FAJ codes.
 *
 * @see ADR-007 Access Control
 * @see bounded-contexts.md Security Context
 */

import { v4 as uuidv4 } from 'uuid';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import type {
  AgentId,
  Capability,
  FAJCode,
  PublicKey,
  Signature,
  Timestamp,
} from '../types.js';
import { CapabilityAction } from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';
import { sign, verify } from '../identity/keypair.js';

/**
 * Create a new capability grant
 *
 * @param granteeId - Agent receiving the capability
 * @param fajCodes - FAJ codes covered by this capability
 * @param actions - Allowed actions
 * @param granterPrivateKey - Private key of the granter (usually registry)
 * @param expiresAt - Expiration timestamp (0 = no expiry)
 * @returns Promise resolving to signed capability
 */
export async function createCapability(
  granteeId: AgentId,
  fajCodes: FAJCode[],
  actions: CapabilityAction[],
  granterPrivateKey: Uint8Array,
  expiresAt: Timestamp = 0
): Promise<Capability> {
  const capabilityId = uuidv4();
  const grantedAt = Date.now();

  // Create signature data
  const signatureData = createCapabilitySignatureData({
    capabilityId,
    granteeId,
    fajCodes,
    actions,
    grantedAt,
    expiresAt,
  });

  // Sign the capability
  const signature = await sign(signatureData, granterPrivateKey);

  return {
    capabilityId,
    granteeId,
    fajCodes,
    actions,
    grantedAt,
    expiresAt,
    signature,
  };
}

/**
 * Verify a capability's signature
 *
 * @param capability - Capability to verify
 * @param granterPublicKey - Public key of the granter
 * @returns Promise resolving to true if valid
 */
export async function verifyCapability(
  capability: Capability,
  granterPublicKey: PublicKey
): Promise<boolean> {
  const signatureData = createCapabilitySignatureData({
    capabilityId: capability.capabilityId,
    granteeId: capability.granteeId,
    fajCodes: capability.fajCodes,
    actions: capability.actions,
    grantedAt: capability.grantedAt,
    expiresAt: capability.expiresAt,
  });

  return verify(capability.signature, signatureData, granterPublicKey);
}

/**
 * Check if a capability is expired
 */
export function isCapabilityExpired(capability: Capability): boolean {
  if (capability.expiresAt === 0) {
    return false; // No expiry
  }
  return Date.now() > capability.expiresAt;
}

/**
 * Check if a capability covers a specific FAJ code
 */
export function capabilityCovers(
  capability: Capability,
  fajCode: FAJCode
): boolean {
  return capability.fajCodes.includes(fajCode);
}

/**
 * Check if a capability allows a specific action
 */
export function capabilityAllows(
  capability: Capability,
  action: CapabilityAction
): boolean {
  return capability.actions.includes(action);
}

/**
 * Create signature data for a capability
 */
function createCapabilitySignatureData(data: {
  capabilityId: string;
  granteeId: AgentId;
  fajCodes: FAJCode[];
  actions: CapabilityAction[];
  grantedAt: Timestamp;
  expiresAt: Timestamp;
}): Uint8Array {
  const canonical = [
    'ELEX-CAP-v1',
    data.capabilityId,
    data.granteeId,
    data.fajCodes.sort().join(','),
    data.actions.sort().join(','),
    data.grantedAt.toString(),
    data.expiresAt.toString(),
  ].join(':');

  return utf8ToBytes(canonical);
}

/**
 * Serialize capability for storage/transport
 */
export function serializeCapability(capability: Capability): SerializedCapability {
  return {
    capabilityId: capability.capabilityId,
    granteeId: capability.granteeId,
    fajCodes: capability.fajCodes,
    actions: capability.actions,
    grantedAt: capability.grantedAt,
    expiresAt: capability.expiresAt,
    signature: bytesToHex(capability.signature),
  };
}

/**
 * Deserialize capability from storage/transport
 */
export function deserializeCapability(serialized: SerializedCapability): Capability {
  const { hexToBytes } = require('@noble/hashes/utils');

  return {
    capabilityId: serialized.capabilityId,
    granteeId: serialized.granteeId,
    fajCodes: serialized.fajCodes,
    actions: serialized.actions as CapabilityAction[],
    grantedAt: serialized.grantedAt,
    expiresAt: serialized.expiresAt,
    signature: hexToBytes(serialized.signature),
  };
}

/**
 * Serialized capability format
 */
export interface SerializedCapability {
  capabilityId: string;
  granteeId: string;
  fajCodes: string[];
  actions: string[];
  grantedAt: number;
  expiresAt: number;
  signature: string;
}

/**
 * Create a full-access capability for an agent's own FAJ code
 *
 * This is typically used when creating an agent to give it
 * complete access to its designated feature.
 */
export async function createSelfCapability(
  agentId: AgentId,
  fajCode: FAJCode,
  privateKey: Uint8Array
): Promise<Capability> {
  return createCapability(
    agentId,
    [fajCode],
    [
      CapabilityAction.READ,
      CapabilityAction.RECOMMEND,
      CapabilityAction.CONSULT,
      CapabilityAction.LEARN,
      CapabilityAction.VOTE,
    ],
    privateKey,
    0 // No expiry for self capability
  );
}

/**
 * Create a read-only capability
 */
export async function createReadOnlyCapability(
  granteeId: AgentId,
  fajCodes: FAJCode[],
  granterPrivateKey: Uint8Array,
  expiresAt?: Timestamp
): Promise<Capability> {
  return createCapability(
    granteeId,
    fajCodes,
    [CapabilityAction.READ],
    granterPrivateKey,
    expiresAt ?? 0
  );
}

/**
 * Create a consultation capability (read + consult)
 */
export async function createConsultCapability(
  granteeId: AgentId,
  fajCodes: FAJCode[],
  granterPrivateKey: Uint8Array,
  expiresAt?: Timestamp
): Promise<Capability> {
  return createCapability(
    granteeId,
    fajCodes,
    [CapabilityAction.READ, CapabilityAction.CONSULT],
    granterPrivateKey,
    expiresAt ?? 0
  );
}

/**
 * Create an execution capability (all actions)
 */
export async function createExecuteCapability(
  granteeId: AgentId,
  fajCodes: FAJCode[],
  granterPrivateKey: Uint8Array,
  expiresAt?: Timestamp
): Promise<Capability> {
  return createCapability(
    granteeId,
    fajCodes,
    [
      CapabilityAction.READ,
      CapabilityAction.RECOMMEND,
      CapabilityAction.EXECUTE,
      CapabilityAction.CONSULT,
      CapabilityAction.LEARN,
      CapabilityAction.VOTE,
    ],
    granterPrivateKey,
    expiresAt ?? 0
  );
}
