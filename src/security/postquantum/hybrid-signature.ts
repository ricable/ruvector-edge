/**
 * ELEX Security Layer - Hybrid Post-Quantum Signatures
 *
 * Provides hybrid Ed25519 + Dilithium signatures for post-quantum security.
 * Falls back to classical Ed25519 if Dilithium is not available.
 *
 * This is an abstraction layer that allows switching between algorithms
 * as post-quantum cryptography matures.
 *
 * @see ADR-007 Layer 5: Post-Quantum Hybrid (Ed25519 + Dilithium)
 */

import type {
  HybridKeypair,
  HybridPublicKey,
  HybridSignature,
  Keypair,
  PublicKey,
  Signature,
} from '../types.js';
import { SignatureAlgorithm } from '../types.js';
import { SecurityError, SecurityErrorCode } from '../types.js';
import { generateKeypair, sign as ed25519Sign, verify as ed25519Verify } from '../identity/keypair.js';

/**
 * Post-quantum signature provider interface
 *
 * Implementations can provide different post-quantum algorithms.
 */
export interface PostQuantumProvider {
  /** Algorithm name */
  readonly name: string;

  /** Public key size in bytes */
  readonly publicKeySize: number;

  /** Private key size in bytes */
  readonly privateKeySize: number;

  /** Signature size in bytes */
  readonly signatureSize: number;

  /** Generate a keypair */
  generateKeypair(): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }>;

  /** Sign a message */
  sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;

  /** Verify a signature */
  verify(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean>;
}

/**
 * Stub Dilithium provider
 *
 * This is a placeholder that throws errors. Replace with actual Dilithium
 * implementation when a WASM-compatible library becomes available.
 *
 * Recommended libraries for future integration:
 * - pqc-wasm (if available)
 * - liboqs-wasm
 * - crystals-dilithium-wasm
 */
class StubDilithiumProvider implements PostQuantumProvider {
  readonly name = 'dilithium-stub';
  readonly publicKeySize = 1312; // Dilithium2
  readonly privateKeySize = 2528; // Dilithium2
  readonly signatureSize = 2420; // Dilithium2

  async generateKeypair(): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }> {
    throw new SecurityError(
      'Dilithium not available. Install a post-quantum crypto library.',
      SecurityErrorCode.POST_QUANTUM_UNAVAILABLE
    );
  }

  async sign(_message: Uint8Array, _privateKey: Uint8Array): Promise<Uint8Array> {
    throw new SecurityError(
      'Dilithium not available. Install a post-quantum crypto library.',
      SecurityErrorCode.POST_QUANTUM_UNAVAILABLE
    );
  }

  async verify(
    _signature: Uint8Array,
    _message: Uint8Array,
    _publicKey: Uint8Array
  ): Promise<boolean> {
    throw new SecurityError(
      'Dilithium not available. Install a post-quantum crypto library.',
      SecurityErrorCode.POST_QUANTUM_UNAVAILABLE
    );
  }
}

/**
 * Hybrid Signature Manager
 *
 * Manages hybrid Ed25519 + Dilithium signatures with graceful fallback.
 */
export class HybridSignatureManager {
  private dilithiumProvider: PostQuantumProvider | null = null;
  private algorithm: SignatureAlgorithm;
  private requirePostQuantum: boolean;

  constructor(
    config: {
      algorithm?: SignatureAlgorithm;
      requirePostQuantum?: boolean;
      dilithiumProvider?: PostQuantumProvider;
    } = {}
  ) {
    this.algorithm = config.algorithm ?? SignatureAlgorithm.ED25519;
    this.requirePostQuantum = config.requirePostQuantum ?? false;
    this.dilithiumProvider = config.dilithiumProvider ?? null;
  }

  /**
   * Set the Dilithium provider
   *
   * Call this to enable post-quantum signatures when a library becomes available.
   */
  setDilithiumProvider(provider: PostQuantumProvider): void {
    this.dilithiumProvider = provider;
  }

  /**
   * Check if post-quantum signatures are available
   */
  isPostQuantumAvailable(): boolean {
    return this.dilithiumProvider !== null;
  }

  /**
   * Get current signature algorithm
   */
  getAlgorithm(): SignatureAlgorithm {
    return this.algorithm;
  }

  /**
   * Set signature algorithm
   */
  setAlgorithm(algorithm: SignatureAlgorithm): void {
    if (algorithm === SignatureAlgorithm.DILITHIUM || algorithm === SignatureAlgorithm.HYBRID) {
      if (!this.dilithiumProvider) {
        throw new SecurityError(
          'Cannot use Dilithium/Hybrid without a provider',
          SecurityErrorCode.POST_QUANTUM_UNAVAILABLE
        );
      }
    }
    this.algorithm = algorithm;
  }

  /**
   * Generate a hybrid keypair
   *
   * Always generates Ed25519 keys. Also generates Dilithium keys if
   * using hybrid mode and Dilithium is available.
   */
  async generateKeypair(): Promise<HybridKeypair> {
    const ed25519Keypair = await generateKeypair();

    const result: HybridKeypair = {
      ed25519: ed25519Keypair,
    };

    if (
      (this.algorithm === SignatureAlgorithm.HYBRID ||
        this.algorithm === SignatureAlgorithm.DILITHIUM) &&
      this.dilithiumProvider
    ) {
      const dilithiumKeypair = await this.dilithiumProvider.generateKeypair();
      result.dilithium = dilithiumKeypair;
    }

    return result;
  }

  /**
   * Sign a message with hybrid signature
   *
   * @param message - Message to sign
   * @param keypair - Hybrid keypair
   * @returns Hybrid signature
   */
  async sign(message: Uint8Array, keypair: HybridKeypair): Promise<HybridSignature> {
    // Always sign with Ed25519
    const ed25519Signature = await ed25519Sign(message, keypair.ed25519.privateKey);

    const result: HybridSignature = {
      ed25519Signature,
      algorithm: this.algorithm,
    };

    // Add Dilithium signature if using hybrid/dilithium mode
    if (
      (this.algorithm === SignatureAlgorithm.HYBRID ||
        this.algorithm === SignatureAlgorithm.DILITHIUM) &&
      this.dilithiumProvider &&
      keypair.dilithium
    ) {
      result.dilithiumSignature = await this.dilithiumProvider.sign(
        message,
        keypair.dilithium.privateKey
      );
    } else if (this.algorithm !== SignatureAlgorithm.ED25519 && this.requirePostQuantum) {
      throw new SecurityError(
        'Post-quantum signature required but not available',
        SecurityErrorCode.POST_QUANTUM_UNAVAILABLE
      );
    }

    return result;
  }

  /**
   * Verify a hybrid signature
   *
   * @param signature - Hybrid signature to verify
   * @param message - Original message
   * @param publicKey - Hybrid public key
   * @returns true if signature is valid
   */
  async verify(
    signature: HybridSignature,
    message: Uint8Array,
    publicKey: HybridPublicKey
  ): Promise<boolean> {
    // Always verify Ed25519
    const ed25519Valid = await ed25519Verify(
      signature.ed25519Signature,
      message,
      publicKey.ed25519PublicKey
    );

    if (!ed25519Valid) {
      return false;
    }

    // For hybrid mode, also verify Dilithium
    if (
      signature.algorithm === SignatureAlgorithm.HYBRID ||
      signature.algorithm === SignatureAlgorithm.DILITHIUM
    ) {
      if (!signature.dilithiumSignature) {
        // Dilithium signature expected but missing
        if (this.requirePostQuantum) {
          return false;
        }
        // Accept Ed25519-only if post-quantum not required
        return true;
      }

      if (!publicKey.dilithiumPublicKey) {
        // Can't verify Dilithium without public key
        return !this.requirePostQuantum;
      }

      if (!this.dilithiumProvider) {
        // Can't verify without provider
        return !this.requirePostQuantum;
      }

      const dilithiumValid = await this.dilithiumProvider.verify(
        signature.dilithiumSignature,
        message,
        publicKey.dilithiumPublicKey
      );

      return dilithiumValid;
    }

    return true;
  }

  /**
   * Extract hybrid public key from keypair
   */
  extractPublicKey(keypair: HybridKeypair): HybridPublicKey {
    return {
      ed25519PublicKey: keypair.ed25519.publicKey,
      dilithiumPublicKey: keypair.dilithium?.publicKey,
    };
  }

  /**
   * Get signature size for current algorithm
   */
  getSignatureSize(): number {
    let size = 64; // Ed25519 signature

    if (
      (this.algorithm === SignatureAlgorithm.HYBRID ||
        this.algorithm === SignatureAlgorithm.DILITHIUM) &&
      this.dilithiumProvider
    ) {
      size += this.dilithiumProvider.signatureSize;
    }

    return size;
  }

  /**
   * Get public key size for current algorithm
   */
  getPublicKeySize(): number {
    let size = 32; // Ed25519 public key

    if (
      (this.algorithm === SignatureAlgorithm.HYBRID ||
        this.algorithm === SignatureAlgorithm.DILITHIUM) &&
      this.dilithiumProvider
    ) {
      size += this.dilithiumProvider.publicKeySize;
    }

    return size;
  }
}

/**
 * Serialize hybrid signature for transport
 */
export function serializeHybridSignature(signature: HybridSignature): {
  ed25519: string;
  dilithium?: string;
  algorithm: string;
} {
  const { bytesToHex } = require('@noble/hashes/utils');

  return {
    ed25519: bytesToHex(signature.ed25519Signature),
    dilithium: signature.dilithiumSignature
      ? bytesToHex(signature.dilithiumSignature)
      : undefined,
    algorithm: signature.algorithm,
  };
}

/**
 * Deserialize hybrid signature from transport
 */
export function deserializeHybridSignature(serialized: {
  ed25519: string;
  dilithium?: string;
  algorithm: string;
}): HybridSignature {
  const { hexToBytes } = require('@noble/hashes/utils');

  return {
    ed25519Signature: hexToBytes(serialized.ed25519),
    dilithiumSignature: serialized.dilithium
      ? hexToBytes(serialized.dilithium)
      : undefined,
    algorithm: serialized.algorithm as SignatureAlgorithm,
  };
}

/**
 * Serialize hybrid public key for transport
 */
export function serializeHybridPublicKey(publicKey: HybridPublicKey): {
  ed25519: string;
  dilithium?: string;
} {
  const { bytesToHex } = require('@noble/hashes/utils');

  return {
    ed25519: bytesToHex(publicKey.ed25519PublicKey),
    dilithium: publicKey.dilithiumPublicKey
      ? bytesToHex(publicKey.dilithiumPublicKey)
      : undefined,
  };
}

/**
 * Deserialize hybrid public key from transport
 */
export function deserializeHybridPublicKey(serialized: {
  ed25519: string;
  dilithium?: string;
}): HybridPublicKey {
  const { hexToBytes } = require('@noble/hashes/utils');

  return {
    ed25519PublicKey: hexToBytes(serialized.ed25519),
    dilithiumPublicKey: serialized.dilithium
      ? hexToBytes(serialized.dilithium)
      : undefined,
  };
}

/**
 * Create a default hybrid signature manager
 *
 * Starts in Ed25519-only mode. Call setDilithiumProvider() when
 * a post-quantum library is available.
 */
export function createHybridSignatureManager(
  config?: {
    algorithm?: SignatureAlgorithm;
    requirePostQuantum?: boolean;
  }
): HybridSignatureManager {
  return new HybridSignatureManager(config);
}
