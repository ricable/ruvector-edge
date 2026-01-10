/**
 * ELEX Security Layer - Access Control Module
 *
 * Exports for capability-based access control.
 *
 * @see ADR-007 Access Control
 */

// Capability operations
export {
  createCapability,
  verifyCapability,
  isCapabilityExpired,
  capabilityCovers,
  capabilityAllows,
  serializeCapability,
  deserializeCapability,
  createSelfCapability,
  createReadOnlyCapability,
  createConsultCapability,
  createExecuteCapability,
  type SerializedCapability,
} from './capability.js';

// Access controller
export { AccessController } from './access-controller.js';
