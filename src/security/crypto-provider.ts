/**
 * ELEX Security Layer - Unified Crypto Provider
 *
 * Provides a unified interface for all cryptographic operations:
 * - Agent identity management
 * - Message signing and verification
 * - Encryption and key exchange
 * - Post-quantum signatures
 * - Access control
 *
 * This is the main entry point for security operations.
 *
 * @see ADR-007 Security and Cryptography Architecture
 */

import type {
  AgentId,
  AgentIdentity,
  AgentIdentityWithKeys,
  Capability,
  CapabilityAction,
  FAJCode,
  MessageVerificationResult,
  SecureMessage,
  SecurityConfig,
  SessionKey,
  SignatureAlgorithm,
} from './types.js';
import { DEFAULT_SECURITY_CONFIG, SecurityError, SecurityErrorCode } from './types.js';
import { AgentIdentityManager, AgentRegistry } from './identity/index.js';
import { MessageBuilder, MessageVerifier, buildSecureMessage } from './messaging/index.js';
import {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  SessionKeyManager,
} from './encryption/index.js';
import { HybridSignatureManager } from './postquantum/index.js';
import { AccessController, createCapability } from './access/index.js';

/**
 * Unified Crypto Provider
 *
 * Main interface for all security operations in the ELEX system.
 */
export class CryptoProvider {
  /** Identity manager for this agent */
  private identityManager: AgentIdentityManager;

  /** Registry of all known agents */
  private registry: AgentRegistry;

  /** Message verifier */
  private messageVerifier: MessageVerifier;

  /** Session key manager for encrypted communication */
  private sessionManager: SessionKeyManager | null = null;

  /** Hybrid signature manager for post-quantum */
  private hybridManager: HybridSignatureManager;

  /** Access controller */
  private accessController: AccessController;

  /** Current configuration */
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.identityManager = new AgentIdentityManager();
    this.registry = new AgentRegistry();
    this.messageVerifier = new MessageVerifier(this.registry, {
      timestampWindowMs: this.config.timestampWindowMs,
      nonceRetentionMs: this.config.nonceRetentionMs,
    });
    this.hybridManager = new HybridSignatureManager({
      algorithm: this.config.signatureAlgorithm,
      requirePostQuantum: this.config.requirePostQuantum,
    });
    this.accessController = new AccessController({ registry: this.registry });
  }

  // ===========================================================================
  // Identity Operations
  // ===========================================================================

  /**
   * Initialize this agent with a new identity
   *
   * @param fajCode - FAJ code this agent is authorized for
   * @returns Public identity (safe to share)
   */
  async initializeIdentity(fajCode: FAJCode): Promise<AgentIdentity> {
    const identity = await this.identityManager.initialize(fajCode);

    // Initialize session manager now that we have a signing key
    const fullIdentity = this.getFullIdentity();
    this.sessionManager = new SessionKeyManager(
      identity.agentId,
      fullIdentity.privateKey,
      this.registry,
      { keyRotationIntervalMs: this.config.keyRotationIntervalMs }
    );

    // Register self in registry (if we have authority)
    if (this.registry.getRegistryPublicKey()) {
      await this.registry.registerAgent(identity);
    }

    return identity;
  }

  /**
   * Initialize from an existing identity
   */
  async initializeFromIdentity(identity: AgentIdentityWithKeys): Promise<void> {
    await this.identityManager.initializeFrom(identity);

    this.sessionManager = new SessionKeyManager(
      identity.agentId,
      identity.privateKey,
      this.registry,
      { keyRotationIntervalMs: this.config.keyRotationIntervalMs }
    );
  }

  /**
   * Get this agent's public identity
   */
  getPublicIdentity(): AgentIdentity {
    return this.identityManager.getPublicIdentity();
  }

  /**
   * Get this agent's full identity (with private key)
   */
  private getFullIdentity(): AgentIdentityWithKeys {
    const publicIdentity = this.identityManager.getPublicIdentity();
    // Access private fields through the manager
    return {
      ...publicIdentity,
      privateKey: (this.identityManager as any).identity.privateKey,
    };
  }

  /**
   * Get this agent's ID
   */
  getAgentId(): AgentId {
    return this.identityManager.getAgentId();
  }

  /**
   * Get this agent's FAJ code
   */
  getFAJCode(): FAJCode {
    return this.identityManager.getFAJCode();
  }

  // ===========================================================================
  // Registry Operations
  // ===========================================================================

  /**
   * Initialize registry with authority keypair
   */
  initializeRegistryAuthority(
    publicKey: Uint8Array,
    privateKey?: Uint8Array
  ): void {
    this.registry.initializeAuthority(publicKey, privateKey);
    this.config.registryPublicKey = publicKey;
    this.accessController.setRegistryPublicKey(publicKey);
  }

  /**
   * Register an agent in the registry
   */
  async registerAgent(
    identity: AgentIdentity,
    expiresAt?: number
  ): Promise<void> {
    await this.registry.registerAgent(identity, expiresAt);
  }

  /**
   * Get an agent's identity from the registry
   */
  getAgentIdentity(agentId: AgentId): AgentIdentity | undefined {
    return this.registry.getAgentIdentity(agentId);
  }

  /**
   * Check if an agent is registered and active
   */
  isAgentActive(agentId: AgentId): boolean {
    return this.registry.isAgentActive(agentId);
  }

  /**
   * Get the registry
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  // ===========================================================================
  // Message Operations
  // ===========================================================================

  /**
   * Create a signed secure message
   */
  async createMessage<T>(
    recipientId: AgentId | 'broadcast',
    payload: T,
    encrypted: boolean = false
  ): Promise<SecureMessage<T>> {
    const fullIdentity = this.getFullIdentity();

    return buildSecureMessage(
      fullIdentity.agentId,
      recipientId,
      payload,
      fullIdentity.privateKey,
      encrypted
    );
  }

  /**
   * Verify a received message
   */
  async verifyMessage<T>(
    message: SecureMessage<T>
  ): Promise<MessageVerificationResult> {
    return this.messageVerifier.verifyMessage(message);
  }

  /**
   * Verify a message is intended for this agent
   */
  async verifyMessageForMe<T>(
    message: SecureMessage<T>
  ): Promise<MessageVerificationResult> {
    return this.messageVerifier.verifyMessageForRecipient(
      message,
      this.getAgentId()
    );
  }

  /**
   * Create a message builder for this agent
   */
  createMessageBuilder(): MessageBuilder {
    const fullIdentity = this.getFullIdentity();
    return new MessageBuilder(fullIdentity.agentId, fullIdentity.privateKey);
  }

  // ===========================================================================
  // Encryption Operations
  // ===========================================================================

  /**
   * Encrypt data for a peer
   *
   * @param peerId - Recipient agent ID
   * @param data - Data to encrypt
   * @returns Encrypted payload or null if no session key
   */
  async encryptFor<T>(
    peerId: AgentId,
    data: T
  ): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array; keyId: string } | null> {
    if (!this.sessionManager) {
      return null;
    }

    const sessionKey = this.sessionManager.getSessionKey(peerId);
    if (!sessionKey) {
      return null;
    }

    return encryptJSON(data, sessionKey.key, sessionKey.keyId);
  }

  /**
   * Decrypt data from a peer
   *
   * @param keyId - Key ID from encrypted payload
   * @param payload - Encrypted payload
   * @returns Decrypted data or null if session key not found
   */
  async decryptFrom<T>(
    keyId: string,
    payload: { ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array; keyId: string }
  ): Promise<T | null> {
    if (!this.sessionManager) {
      return null;
    }

    const sessionKey = this.sessionManager.getSessionKeyById(keyId);
    if (!sessionKey) {
      return null;
    }

    return decryptJSON<T>(payload, sessionKey.key);
  }

  /**
   * Check if we have an encrypted session with a peer
   */
  hasSessionWith(peerId: AgentId): boolean {
    return this.sessionManager?.hasValidSession(peerId) ?? false;
  }

  /**
   * Initiate key exchange with a peer
   */
  async initiateKeyExchange(peerId: AgentId): Promise<{
    request: Awaited<ReturnType<SessionKeyManager['initiateExchange']>>['request'];
  }> {
    if (!this.sessionManager) {
      throw new SecurityError(
        'Session manager not initialized',
        SecurityErrorCode.KEY_EXCHANGE_FAILED
      );
    }
    return this.sessionManager.initiateExchange(peerId);
  }

  /**
   * Handle incoming key exchange request
   */
  async handleKeyExchangeRequest(
    request: Parameters<SessionKeyManager['handleExchangeRequest']>[0]
  ): Promise<{
    response: Awaited<ReturnType<SessionKeyManager['handleExchangeRequest']>>['response'];
  }> {
    if (!this.sessionManager) {
      throw new SecurityError(
        'Session manager not initialized',
        SecurityErrorCode.KEY_EXCHANGE_FAILED
      );
    }
    return this.sessionManager.handleExchangeRequest(request);
  }

  /**
   * Complete key exchange
   */
  async completeKeyExchange(
    peerId: AgentId,
    response: Parameters<SessionKeyManager['completeExchange']>[1]
  ): Promise<void> {
    if (!this.sessionManager) {
      throw new SecurityError(
        'Session manager not initialized',
        SecurityErrorCode.KEY_EXCHANGE_FAILED
      );
    }
    await this.sessionManager.completeExchange(peerId, response);
  }

  // ===========================================================================
  // Access Control Operations
  // ===========================================================================

  /**
   * Grant a capability to an agent
   */
  async grantCapability(
    granteeId: AgentId,
    fajCodes: FAJCode[],
    actions: CapabilityAction[],
    expiresAt?: number
  ): Promise<Capability> {
    const fullIdentity = this.getFullIdentity();
    const capability = await createCapability(
      granteeId,
      fajCodes,
      actions,
      fullIdentity.privateKey,
      expiresAt
    );
    await this.accessController.addCapability(capability, false);
    return capability;
  }

  /**
   * Add a capability (received from elsewhere)
   */
  async addCapability(capability: Capability, verify: boolean = true): Promise<void> {
    await this.accessController.addCapability(capability, verify);
  }

  /**
   * Check if an agent can perform an action
   */
  async canAccess(
    agentId: AgentId,
    fajCode: FAJCode,
    action: CapabilityAction
  ): Promise<boolean> {
    const result = await this.accessController.verifyAccess(agentId, fajCode, action);
    return result.isGranted;
  }

  /**
   * Verify access with detailed result
   */
  async verifyAccess(
    agentId: AgentId,
    fajCode: FAJCode,
    action: CapabilityAction
  ): Promise<ReturnType<AccessController['verifyAccess']>> {
    return this.accessController.verifyAccess(agentId, fajCode, action);
  }

  /**
   * Get the access controller
   */
  getAccessController(): AccessController {
    return this.accessController;
  }

  // ===========================================================================
  // Post-Quantum Operations
  // ===========================================================================

  /**
   * Get the hybrid signature manager
   */
  getHybridSignatureManager(): HybridSignatureManager {
    return this.hybridManager;
  }

  /**
   * Check if post-quantum signatures are available
   */
  isPostQuantumAvailable(): boolean {
    return this.hybridManager.isPostQuantumAvailable();
  }

  /**
   * Get current signature algorithm
   */
  getSignatureAlgorithm(): SignatureAlgorithm {
    return this.hybridManager.getAlgorithm();
  }

  // ===========================================================================
  // Lifecycle Operations
  // ===========================================================================

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    registry: { agentCount: number; activeCount: number };
    sessions: ReturnType<SessionKeyManager['getStats']> | null;
    access: ReturnType<AccessController['getStats']>;
    nonces: number;
  } {
    return {
      registry: {
        agentCount: this.registry.getAgentCount(false),
        activeCount: this.registry.getAgentCount(true),
      },
      sessions: this.sessionManager?.getStats() ?? null,
      access: this.accessController.getStats(),
      nonces: this.messageVerifier.getNonceCacheSize(),
    };
  }

  /**
   * Clean up expired data
   */
  cleanup(): {
    expiredAgents: number;
    expiredKeys: number;
    expiredCapabilities: number;
    expiredNonces: number;
  } {
    const expiredAgents = this.registry.pruneExpired();
    const sessionCleanup = this.sessionManager?.cleanup() ?? { expiredKeys: 0 };
    const expiredCapabilities = this.accessController.pruneExpired();
    const expiredNonces = this.messageVerifier.forceCleanupNonces();

    return {
      expiredAgents,
      expiredKeys: sessionCleanup.expiredKeys,
      expiredCapabilities,
      expiredNonces,
    };
  }

  /**
   * Dispose of all resources and clear secrets
   */
  dispose(): void {
    this.identityManager.clear();
    this.sessionManager?.dispose();
    this.registry.clearAuthority();
    this.messageVerifier.clearNonceCache();
    this.accessController.clear();
  }
}

/**
 * Create a new crypto provider with default configuration
 */
export function createCryptoProvider(
  config?: Partial<SecurityConfig>
): CryptoProvider {
  return new CryptoProvider(config);
}
