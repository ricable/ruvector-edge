/**
 * ELEX Security Layer - Session Key Manager
 *
 * Manages session keys for encrypted communication between agents.
 * Handles key rotation, expiration, and cleanup.
 *
 * @see ADR-007 Layer 4: Key Exchange (X25519 ECDH)
 */

import type { AgentId, SessionKey, Timestamp } from '../types.js';
import {
  SecurityError,
  SecurityErrorCode,
  DEFAULT_SECURITY_CONFIG,
} from '../types.js';
import {
  initiateKeyExchange,
  respondToKeyExchange,
  completeKeyExchange,
  isSessionKeyExpired,
  clearSessionKey,
} from './key-exchange.js';
import type { AgentRegistry } from '../identity/registry.js';

/**
 * Session Key Manager
 *
 * Manages encrypted sessions between agents with:
 * - Session key storage and lookup
 * - Automatic key rotation (hourly by default)
 * - Key expiration and cleanup
 * - Pending key exchange tracking
 */
export class SessionKeyManager {
  /** Active session keys by peer ID */
  private sessionKeys: Map<AgentId, SessionKey> = new Map();

  /** Session keys by key ID (for lookup during decryption) */
  private keyIndex: Map<string, SessionKey> = new Map();

  /** Pending key exchanges (initiator side) */
  private pendingExchanges: Map<
    AgentId,
    {
      ephemeralPrivateKey: Uint8Array;
      initiatedAt: Timestamp;
    }
  > = new Map();

  /** Key rotation interval in milliseconds */
  private keyRotationIntervalMs: number;

  /** Cleanup interval ID */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private myAgentId: AgentId,
    private mySigningKey: Uint8Array,
    private registry: AgentRegistry,
    config: Partial<{
      keyRotationIntervalMs: number;
      cleanupIntervalMs: number;
    }> = {}
  ) {
    this.keyRotationIntervalMs =
      config.keyRotationIntervalMs ??
      DEFAULT_SECURITY_CONFIG.keyRotationIntervalMs;

    // Start cleanup timer
    const cleanupIntervalMs = config.cleanupIntervalMs ?? 60000; // 1 minute
    this.startCleanupTimer(cleanupIntervalMs);
  }

  /**
   * Get session key for a peer
   *
   * @param peerId - Peer agent ID
   * @returns Session key or undefined if none exists
   */
  getSessionKey(peerId: AgentId): SessionKey | undefined {
    const key = this.sessionKeys.get(peerId);
    if (key && isSessionKeyExpired(key)) {
      // Key expired, remove it
      this.removeSessionKey(peerId);
      return undefined;
    }
    return key;
  }

  /**
   * Get session key by key ID
   *
   * @param keyId - Key identifier
   * @returns Session key or undefined if not found
   */
  getSessionKeyById(keyId: string): SessionKey | undefined {
    const key = this.keyIndex.get(keyId);
    if (key && isSessionKeyExpired(key)) {
      return undefined;
    }
    return key;
  }

  /**
   * Check if we have a valid session with a peer
   *
   * @param peerId - Peer agent ID
   * @returns true if valid session exists
   */
  hasValidSession(peerId: AgentId): boolean {
    const key = this.getSessionKey(peerId);
    return key !== undefined && !isSessionKeyExpired(key);
  }

  /**
   * Check if a session key needs rotation
   *
   * @param peerId - Peer agent ID
   * @returns true if key should be rotated
   */
  needsRotation(peerId: AgentId): boolean {
    const key = this.sessionKeys.get(peerId);
    if (!key) {
      return false;
    }

    // Rotate when 80% through the key lifetime
    const lifetime = key.expiresAt - key.createdAt;
    const elapsed = Date.now() - key.createdAt;
    return elapsed > lifetime * 0.8;
  }

  /**
   * Initiate key exchange with a peer
   *
   * @param peerId - Peer agent ID
   * @returns Key exchange request to send to peer
   */
  async initiateExchange(peerId: AgentId): Promise<{
    request: Awaited<ReturnType<typeof initiateKeyExchange>>['request'];
  }> {
    // Check if we already have a pending exchange
    if (this.pendingExchanges.has(peerId)) {
      // Clean up old exchange
      const old = this.pendingExchanges.get(peerId)!;
      for (let i = 0; i < old.ephemeralPrivateKey.length; i++) {
        old.ephemeralPrivateKey[i] = 0;
      }
    }

    const { request, ephemeralPrivateKey } = await initiateKeyExchange(
      this.myAgentId,
      peerId,
      this.mySigningKey
    );

    // Store pending exchange
    this.pendingExchanges.set(peerId, {
      ephemeralPrivateKey,
      initiatedAt: Date.now(),
    });

    return { request };
  }

  /**
   * Handle incoming key exchange request
   *
   * @param request - Key exchange request from peer
   * @returns Response to send back to peer
   */
  async handleExchangeRequest(
    request: Parameters<typeof respondToKeyExchange>[0]
  ): Promise<{
    response: Awaited<ReturnType<typeof respondToKeyExchange>>['response'];
  }> {
    // Get initiator's public key from registry
    const initiatorIdentity = this.registry.getAgentIdentity(request.initiatorId);
    if (!initiatorIdentity) {
      throw new SecurityError(
        'Unknown initiator',
        SecurityErrorCode.AGENT_NOT_REGISTERED,
        { initiatorId: request.initiatorId }
      );
    }

    const { response, result } = await respondToKeyExchange(
      request,
      this.myAgentId,
      this.mySigningKey,
      initiatorIdentity.publicKey
    );

    // Store session key
    this.storeSessionKey(result.sessionKey);

    // Clear shared secret
    for (let i = 0; i < result.sharedSecret.length; i++) {
      result.sharedSecret[i] = 0;
    }

    return { response };
  }

  /**
   * Complete key exchange with response from peer
   *
   * @param peerId - Peer agent ID
   * @param response - Key exchange response from peer
   */
  async completeExchange(
    peerId: AgentId,
    response: Parameters<typeof completeKeyExchange>[0]
  ): Promise<void> {
    // Get pending exchange
    const pending = this.pendingExchanges.get(peerId);
    if (!pending) {
      throw new SecurityError(
        'No pending key exchange',
        SecurityErrorCode.KEY_EXCHANGE_FAILED,
        { peerId }
      );
    }

    // Get responder's public key from registry
    const responderIdentity = this.registry.getAgentIdentity(peerId);
    if (!responderIdentity) {
      throw new SecurityError(
        'Unknown responder',
        SecurityErrorCode.AGENT_NOT_REGISTERED,
        { responderId: peerId }
      );
    }

    const result = await completeKeyExchange(
      response,
      pending.ephemeralPrivateKey,
      peerId,
      responderIdentity.publicKey
    );

    // Store session key
    this.storeSessionKey(result.sessionKey);

    // Clean up pending exchange
    this.pendingExchanges.delete(peerId);

    // Clear shared secret
    for (let i = 0; i < result.sharedSecret.length; i++) {
      result.sharedSecret[i] = 0;
    }
  }

  /**
   * Store a session key
   */
  private storeSessionKey(sessionKey: SessionKey): void {
    // Remove old key if exists
    const oldKey = this.sessionKeys.get(sessionKey.peerId);
    if (oldKey) {
      this.keyIndex.delete(oldKey.keyId);
      clearSessionKey(oldKey);
    }

    this.sessionKeys.set(sessionKey.peerId, sessionKey);
    this.keyIndex.set(sessionKey.keyId, sessionKey);
  }

  /**
   * Remove session key for a peer
   */
  removeSessionKey(peerId: AgentId): void {
    const key = this.sessionKeys.get(peerId);
    if (key) {
      this.keyIndex.delete(key.keyId);
      clearSessionKey(key);
      this.sessionKeys.delete(peerId);
    }
  }

  /**
   * Get all active session peer IDs
   */
  getActivePeers(): AgentId[] {
    const peers: AgentId[] = [];
    for (const [peerId, key] of this.sessionKeys) {
      if (!isSessionKeyExpired(key)) {
        peers.push(peerId);
      }
    }
    return peers;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    activeSessions: number;
    pendingExchanges: number;
    expiredSessions: number;
  } {
    let expired = 0;
    for (const key of this.sessionKeys.values()) {
      if (isSessionKeyExpired(key)) {
        expired++;
      }
    }

    return {
      activeSessions: this.sessionKeys.size - expired,
      pendingExchanges: this.pendingExchanges.size,
      expiredSessions: expired,
    };
  }

  /**
   * Clean up expired keys and stale pending exchanges
   */
  cleanup(): { expiredKeys: number; stalePending: number } {
    const now = Date.now();
    let expiredKeys = 0;
    let stalePending = 0;

    // Clean expired session keys
    for (const [peerId, key] of this.sessionKeys) {
      if (isSessionKeyExpired(key)) {
        this.keyIndex.delete(key.keyId);
        clearSessionKey(key);
        this.sessionKeys.delete(peerId);
        expiredKeys++;
      }
    }

    // Clean stale pending exchanges (older than 5 minutes)
    const staleThreshold = 5 * 60 * 1000;
    for (const [peerId, pending] of this.pendingExchanges) {
      if (now - pending.initiatedAt > staleThreshold) {
        for (let i = 0; i < pending.ephemeralPrivateKey.length; i++) {
          pending.ephemeralPrivateKey[i] = 0;
        }
        this.pendingExchanges.delete(peerId);
        stalePending++;
      }
    }

    return { expiredKeys, stalePending };
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(intervalMs: number): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all session keys and pending exchanges
   */
  clear(): void {
    // Clear all session keys
    for (const key of this.sessionKeys.values()) {
      clearSessionKey(key);
    }
    this.sessionKeys.clear();
    this.keyIndex.clear();

    // Clear pending exchanges
    for (const pending of this.pendingExchanges.values()) {
      for (let i = 0; i < pending.ephemeralPrivateKey.length; i++) {
        pending.ephemeralPrivateKey[i] = 0;
      }
    }
    this.pendingExchanges.clear();
  }

  /**
   * Dispose of the manager and clear all secrets
   */
  dispose(): void {
    this.stopCleanupTimer();
    this.clear();

    // Clear signing key
    for (let i = 0; i < this.mySigningKey.length; i++) {
      this.mySigningKey[i] = 0;
    }
  }
}
