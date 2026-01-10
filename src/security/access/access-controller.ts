/**
 * ELEX Security Layer - Access Controller
 *
 * Enforces capability-based access control for agent operations.
 * Verifies that agents have the required capabilities before allowing actions.
 *
 * @see ADR-007 Access Control
 * @see bounded-contexts.md Security Context
 */

import type {
  AccessVerificationResult,
  AgentId,
  Capability,
  CapabilityAction,
  FAJCode,
  PublicKey,
  Timestamp,
} from '../types.js';
import { AccessDenialReason, SecurityError, SecurityErrorCode } from '../types.js';
import type { AgentRegistry } from '../identity/registry.js';
import {
  verifyCapability,
  isCapabilityExpired,
  capabilityCovers,
  capabilityAllows,
  type SerializedCapability,
  serializeCapability,
  deserializeCapability,
} from './capability.js';

/**
 * Access Controller
 *
 * Manages and enforces capability-based access control:
 * - Stores capabilities for agents
 * - Verifies access requests against capabilities
 * - Supports capability delegation and revocation
 */
export class AccessController {
  /** Capabilities by grantee agent ID */
  private capabilities: Map<AgentId, Capability[]> = new Map();

  /** Registry for agent lookup */
  private registry: AgentRegistry | null = null;

  /** Registry public key for capability verification */
  private registryPublicKey: PublicKey | null = null;

  constructor(
    config: {
      registry?: AgentRegistry;
      registryPublicKey?: PublicKey;
    } = {}
  ) {
    this.registry = config.registry ?? null;
    this.registryPublicKey = config.registryPublicKey ?? null;
  }

  /**
   * Set the agent registry
   */
  setRegistry(registry: AgentRegistry): void {
    this.registry = registry;
    this.registryPublicKey = registry.getRegistryPublicKey();
  }

  /**
   * Set the registry public key
   */
  setRegistryPublicKey(publicKey: PublicKey): void {
    this.registryPublicKey = publicKey;
  }

  /**
   * Add a capability for an agent
   *
   * @param capability - Capability to add
   * @param verify - Whether to verify the capability signature
   */
  async addCapability(capability: Capability, verify: boolean = true): Promise<void> {
    // Verify capability if requested
    if (verify) {
      if (!this.registryPublicKey) {
        throw new SecurityError(
          'Cannot verify capability without registry public key',
          SecurityErrorCode.VERIFICATION_FAILED
        );
      }

      const isValid = await verifyCapability(capability, this.registryPublicKey);
      if (!isValid) {
        throw new SecurityError(
          'Invalid capability signature',
          SecurityErrorCode.VERIFICATION_FAILED
        );
      }
    }

    // Get or create capability list for grantee
    let agentCapabilities = this.capabilities.get(capability.granteeId);
    if (!agentCapabilities) {
      agentCapabilities = [];
      this.capabilities.set(capability.granteeId, agentCapabilities);
    }

    // Check for duplicate
    const existing = agentCapabilities.find(
      (c) => c.capabilityId === capability.capabilityId
    );
    if (!existing) {
      agentCapabilities.push(capability);
    }
  }

  /**
   * Remove a capability
   *
   * @param capabilityId - ID of capability to remove
   */
  removeCapability(capabilityId: string): void {
    for (const [agentId, caps] of this.capabilities) {
      const index = caps.findIndex((c) => c.capabilityId === capabilityId);
      if (index >= 0) {
        caps.splice(index, 1);
        if (caps.length === 0) {
          this.capabilities.delete(agentId);
        }
        return;
      }
    }
  }

  /**
   * Remove all capabilities for an agent
   *
   * @param agentId - Agent ID
   */
  removeAgentCapabilities(agentId: AgentId): void {
    this.capabilities.delete(agentId);
  }

  /**
   * Verify access for an agent to perform an action on a FAJ code
   *
   * @param agentId - Agent requesting access
   * @param fajCode - FAJ code to access
   * @param action - Action to perform
   * @returns Access verification result
   */
  async verifyAccess(
    agentId: AgentId,
    fajCode: FAJCode,
    action: CapabilityAction
  ): Promise<AccessVerificationResult> {
    // Check if agent is active in registry
    if (this.registry && !this.registry.isAgentActive(agentId)) {
      return {
        isGranted: false,
        denialReason: AccessDenialReason.AGENT_INACTIVE,
      };
    }

    // Get capabilities for agent
    const agentCapabilities = this.capabilities.get(agentId);
    if (!agentCapabilities || agentCapabilities.length === 0) {
      return {
        isGranted: false,
        denialReason: AccessDenialReason.NO_CAPABILITY,
      };
    }

    // Find matching capability
    for (const capability of agentCapabilities) {
      // Check expiration
      if (isCapabilityExpired(capability)) {
        continue;
      }

      // Check FAJ coverage
      if (!capabilityCovers(capability, fajCode)) {
        continue;
      }

      // Check action allowed
      if (!capabilityAllows(capability, action)) {
        continue;
      }

      // Verify signature if we have registry public key
      if (this.registryPublicKey) {
        const isValid = await verifyCapability(capability, this.registryPublicKey);
        if (!isValid) {
          continue;
        }
      }

      // All checks passed
      return {
        isGranted: true,
        capability,
      };
    }

    // Determine most specific denial reason
    for (const capability of agentCapabilities) {
      if (isCapabilityExpired(capability)) {
        return {
          isGranted: false,
          denialReason: AccessDenialReason.EXPIRED_CAPABILITY,
        };
      }
      if (!capabilityCovers(capability, fajCode)) {
        return {
          isGranted: false,
          denialReason: AccessDenialReason.FAJ_NOT_COVERED,
        };
      }
      if (!capabilityAllows(capability, action)) {
        return {
          isGranted: false,
          denialReason: AccessDenialReason.ACTION_NOT_ALLOWED,
        };
      }
    }

    return {
      isGranted: false,
      denialReason: AccessDenialReason.NO_CAPABILITY,
    };
  }

  /**
   * Check if an agent has any capability for a FAJ code
   */
  hasCapabilityFor(agentId: AgentId, fajCode: FAJCode): boolean {
    const agentCapabilities = this.capabilities.get(agentId);
    if (!agentCapabilities) {
      return false;
    }

    return agentCapabilities.some(
      (c) => !isCapabilityExpired(c) && capabilityCovers(c, fajCode)
    );
  }

  /**
   * Get all capabilities for an agent
   *
   * @param agentId - Agent ID
   * @param includeExpired - Include expired capabilities
   */
  getCapabilities(agentId: AgentId, includeExpired: boolean = false): Capability[] {
    const agentCapabilities = this.capabilities.get(agentId);
    if (!agentCapabilities) {
      return [];
    }

    if (includeExpired) {
      return [...agentCapabilities];
    }

    return agentCapabilities.filter((c) => !isCapabilityExpired(c));
  }

  /**
   * Get all FAJ codes an agent has access to
   */
  getAccessibleFAJCodes(agentId: AgentId): FAJCode[] {
    const agentCapabilities = this.capabilities.get(agentId);
    if (!agentCapabilities) {
      return [];
    }

    const fajCodes = new Set<FAJCode>();
    for (const capability of agentCapabilities) {
      if (!isCapabilityExpired(capability)) {
        for (const fajCode of capability.fajCodes) {
          fajCodes.add(fajCode);
        }
      }
    }

    return Array.from(fajCodes);
  }

  /**
   * Get all actions an agent can perform on a FAJ code
   */
  getAllowedActions(agentId: AgentId, fajCode: FAJCode): CapabilityAction[] {
    const agentCapabilities = this.capabilities.get(agentId);
    if (!agentCapabilities) {
      return [];
    }

    const actions = new Set<CapabilityAction>();
    for (const capability of agentCapabilities) {
      if (!isCapabilityExpired(capability) && capabilityCovers(capability, fajCode)) {
        for (const action of capability.actions) {
          actions.add(action);
        }
      }
    }

    return Array.from(actions);
  }

  /**
   * Prune expired capabilities
   *
   * @returns Number of capabilities removed
   */
  pruneExpired(): number {
    let removed = 0;

    for (const [agentId, caps] of this.capabilities) {
      const validCaps = caps.filter((c) => !isCapabilityExpired(c));
      removed += caps.length - validCaps.length;

      if (validCaps.length === 0) {
        this.capabilities.delete(agentId);
      } else if (validCaps.length < caps.length) {
        this.capabilities.set(agentId, validCaps);
      }
    }

    return removed;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCapabilities: number;
    totalAgents: number;
    expiredCapabilities: number;
  } {
    let total = 0;
    let expired = 0;

    for (const caps of this.capabilities.values()) {
      total += caps.length;
      expired += caps.filter((c) => isCapabilityExpired(c)).length;
    }

    return {
      totalCapabilities: total,
      totalAgents: this.capabilities.size,
      expiredCapabilities: expired,
    };
  }

  /**
   * Clear all capabilities
   */
  clear(): void {
    this.capabilities.clear();
  }

  /**
   * Serialize all capabilities for storage
   */
  serialize(): {
    registryPublicKey: string | null;
    capabilities: Record<string, SerializedCapability[]>;
  } {
    const { bytesToHex } = require('@noble/hashes/utils');

    const capabilities: Record<string, SerializedCapability[]> = {};

    for (const [agentId, caps] of this.capabilities) {
      capabilities[agentId] = caps.map(serializeCapability);
    }

    return {
      registryPublicKey: this.registryPublicKey
        ? bytesToHex(this.registryPublicKey)
        : null,
      capabilities,
    };
  }

  /**
   * Deserialize capabilities from storage
   */
  async deserialize(
    data: {
      registryPublicKey: string | null;
      capabilities: Record<string, SerializedCapability[]>;
    },
    verify: boolean = true
  ): Promise<void> {
    const { hexToBytes } = require('@noble/hashes/utils');

    if (data.registryPublicKey) {
      this.registryPublicKey = hexToBytes(data.registryPublicKey);
    }

    for (const [agentId, serializedCaps] of Object.entries(data.capabilities)) {
      for (const serialized of serializedCaps) {
        const capability = deserializeCapability(serialized);
        await this.addCapability(capability, verify);
      }
    }
  }
}
