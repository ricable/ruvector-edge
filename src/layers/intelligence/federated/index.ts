/**
 * Federated Learning Module
 * Exports FederatedMerger and SyncCoordinator
 */

export {
  FederatedMerger,
  compressEntries,
  decompressEntries,
  type FederatedEventCallback,
} from './federated-merger';

export {
  SyncCoordinator,
  type SyncMessage,
  type SyncMessageType,
  type PeerConnection,
  type SyncCoordinatorConfig,
} from './sync-coordinator';
