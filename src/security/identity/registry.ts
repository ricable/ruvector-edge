/**
 * ELEX Security Layer - Agent Registry
 *
 * Maintains a registry of verified agents for identity verification.
 * Agents are verified against the registry before accepting their messages.
 *
 * @see ADR-007 Layer 1: Agent Identity
 * @see bounded-contexts.md Security Context
 */

import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import type {
  AgentId,
  AgentIdentity,
  AgentRegistryEntry,
  PublicKey,
  Signature,
  Timestamp,
} from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';
import { sign, verify, publicKeyToHex } from './keypair.js';
import { verifyAgentIdentity } from './agent-identity.js';

/**
 * Agent Registry for verified agent lookup
 *
 * The registry maintains a list of verified agents and their public keys.
 * Messages from unknown or inactive agents are rejected.
 */
export class AgentRegistry {
  private agents: Map<AgentId, AgentRegistryEntry> = new Map();
  private registryPublicKey: PublicKey | null = null;
  private registryPrivateKey: Uint8Array | null = null;

  /**
   * Initialize registry with authority keypair
   *
   * @param publicKey - Registry authority public key
   * @param privateKey - Registry authority private key (for signing registrations)
   */
  initializeAuthority(publicKey: PublicKey, privateKey?: Uint8Array): void {
    this.registryPublicKey = publicKey;
    this.registryPrivateKey = privateKey ?? null;
  }

  /**
   * Get registry public key
   */
  getRegistryPublicKey(): PublicKey | null {
    return this.registryPublicKey;
  }

  /**
   * Register a new agent
   *
   * @param identity - Agent identity to register
   * @param expiresAt - Optional expiration timestamp (0 = no expiry)
   * @returns Promise resolving to registry entry
   */
  async registerAgent(
    identity: AgentIdentity,
    expiresAt: Timestamp = 0
  ): Promise<AgentRegistryEntry> {
    // Verify identity is valid
    if (!(await verifyAgentIdentity(identity))) {
      throw new SecurityError(
        'Invalid agent identity',
        SecurityErrorCode.VERIFICATION_FAILED
      );
    }

    // Check if registry has signing authority
    if (!this.registryPrivateKey) {
      throw new SecurityError(
        'Registry not initialized with signing authority',
        SecurityErrorCode.SIGNING_FAILED
      );
    }

    // Create registry signature
    const registryMessage = createRegistryMessage(identity, expiresAt);
    const registrySignature = await sign(registryMessage, this.registryPrivateKey);

    const entry: AgentRegistryEntry = {
      identity,
      registrySignature,
      registeredAt: Date.now(),
      expiresAt,
      isActive: true,
    };

    this.agents.set(identity.agentId, entry);
    return entry;
  }

  /**
   * Add a pre-signed registry entry (for loading from storage)
   *
   * @param entry - Pre-signed registry entry
   */
  async addEntry(entry: AgentRegistryEntry): Promise<void> {
    // Verify registry signature if we have the registry public key
    if (this.registryPublicKey) {
      const registryMessage = createRegistryMessage(
        entry.identity,
        entry.expiresAt
      );
      const isValid = await verify(
        entry.registrySignature,
        registryMessage,
        this.registryPublicKey
      );
      if (!isValid) {
        throw new SecurityError(
          'Invalid registry signature',
          SecurityErrorCode.VERIFICATION_FAILED
        );
      }
    }

    // Verify agent identity
    if (!(await verifyAgentIdentity(entry.identity))) {
      throw new SecurityError(
        'Invalid agent identity',
        SecurityErrorCode.VERIFICATION_FAILED
      );
    }

    this.agents.set(entry.identity.agentId, entry);
  }

  /**
   * Get agent entry by ID
   *
   * @param agentId - Agent ID to look up
   * @returns Registry entry or undefined if not found
   */
  getAgent(agentId: AgentId): AgentRegistryEntry | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agent identity by ID
   *
   * @param agentId - Agent ID to look up
   * @returns Agent identity or undefined if not found
   */
  getAgentIdentity(agentId: AgentId): AgentIdentity | undefined {
    return this.agents.get(agentId)?.identity;
  }

  /**
   * Check if an agent is registered and active
   *
   * @param agentId - Agent ID to check
   * @returns true if agent is registered and active
   */
  isAgentActive(agentId: AgentId): boolean {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return false;
    }
    if (!entry.isActive) {
      return false;
    }
    if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
      return false;
    }
    return true;
  }

  /**
   * Deactivate an agent
   *
   * @param agentId - Agent ID to deactivate
   */
  deactivateAgent(agentId: AgentId): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.isActive = false;
    }
  }

  /**
   * Reactivate an agent
   *
   * @param agentId - Agent ID to reactivate
   */
  reactivateAgent(agentId: AgentId): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.isActive = true;
    }
  }

  /**
   * Remove an agent from the registry
   *
   * @param agentId - Agent ID to remove
   */
  removeAgent(agentId: AgentId): void {
    this.agents.delete(agentId);
  }

  /**
   * Get all registered agents
   *
   * @param activeOnly - If true, only return active agents
   * @returns Array of registry entries
   */
  getAllAgents(activeOnly: boolean = false): AgentRegistryEntry[] {
    const entries = Array.from(this.agents.values());
    if (activeOnly) {
      const now = Date.now();
      return entries.filter(
        (e) =>
          e.isActive && (e.expiresAt === 0 || e.expiresAt > now)
      );
    }
    return entries;
  }

  /**
   * Get agents by FAJ code
   *
   * @param fajCode - FAJ code to search for
   * @param activeOnly - If true, only return active agents
   * @returns Array of registry entries for agents with matching FAJ code
   */
  getAgentsByFAJ(
    fajCode: string,
    activeOnly: boolean = true
  ): AgentRegistryEntry[] {
    return this.getAllAgents(activeOnly).filter(
      (e) => e.identity.fajCode === fajCode
    );
  }

  /**
   * Get count of registered agents
   *
   * @param activeOnly - If true, only count active agents
   */
  getAgentCount(activeOnly: boolean = false): number {
    if (activeOnly) {
      return this.getAllAgents(true).length;
    }
    return this.agents.size;
  }

  /**
   * Clear all agents from the registry
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Clear registry authority (for security)
   */
  clearAuthority(): void {
    if (this.registryPrivateKey) {
      for (let i = 0; i < this.registryPrivateKey.length; i++) {
        this.registryPrivateKey[i] = 0;
      }
      this.registryPrivateKey = null;
    }
  }

  /**
   * Prune expired agents
   *
   * @returns Number of agents removed
   */
  pruneExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [agentId, entry] of this.agents) {
      if (entry.expiresAt > 0 && entry.expiresAt < now) {
        this.agents.delete(agentId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Serialize registry to JSON-safe format
   */
  serialize(): SerializedRegistry {
    const entries: SerializedRegistryEntry[] = [];

    for (const entry of this.agents.values()) {
      entries.push({
        identity: {
          agentId: entry.identity.agentId,
          publicKey: publicKeyToHex(entry.identity.publicKey),
          fajCode: entry.identity.fajCode,
          createdAt: entry.identity.createdAt,
          fajBinding: bytesToHex(entry.identity.fajBinding),
        },
        registrySignature: bytesToHex(entry.registrySignature),
        registeredAt: entry.registeredAt,
        expiresAt: entry.expiresAt,
        isActive: entry.isActive,
      });
    }

    return {
      registryPublicKey: this.registryPublicKey
        ? publicKeyToHex(this.registryPublicKey)
        : null,
      entries,
    };
  }

  /**
   * Deserialize registry from JSON format
   */
  async deserialize(data: SerializedRegistry): Promise<void> {
    const { hexToBytes } = require('@noble/hashes/utils');

    if (data.registryPublicKey) {
      this.registryPublicKey = hexToBytes(data.registryPublicKey);
    }

    for (const serialized of data.entries) {
      const entry: AgentRegistryEntry = {
        identity: {
          agentId: serialized.identity.agentId,
          publicKey: hexToBytes(serialized.identity.publicKey),
          fajCode: serialized.identity.fajCode,
          createdAt: serialized.identity.createdAt,
          fajBinding: hexToBytes(serialized.identity.fajBinding),
        },
        registrySignature: hexToBytes(serialized.registrySignature),
        registeredAt: serialized.registeredAt,
        expiresAt: serialized.expiresAt,
        isActive: serialized.isActive,
      };

      await this.addEntry(entry);
    }
  }
}

/**
 * Create the message for registry signature
 */
function createRegistryMessage(
  identity: AgentIdentity,
  expiresAt: Timestamp
): Uint8Array {
  const prefix = 'ELEX-REGISTRY-v1:';
  const content = `${prefix}${identity.agentId}:${identity.fajCode}:${expiresAt}`;
  return utf8ToBytes(content);
}

/**
 * Serialized registry entry for storage
 */
interface SerializedRegistryEntry {
  identity: {
    agentId: string;
    publicKey: string;
    fajCode: string;
    createdAt: number;
    fajBinding: string;
  };
  registrySignature: string;
  registeredAt: number;
  expiresAt: number;
  isActive: boolean;
}

/**
 * Serialized registry for storage
 */
interface SerializedRegistry {
  registryPublicKey: string | null;
  entries: SerializedRegistryEntry[];
}
