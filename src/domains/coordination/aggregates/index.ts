/**
 * Coordination Context - Aggregates
 *
 * Exports all aggregates for the Coordination bounded context.
 */

export {
  Swarm,
  SwarmConfig,
  AgentInfo,
  SwarmInitialized,
  AgentSpawned,
  AgentTerminated,
  QueryRouted,
  TopologyChanged,
  ConsensusReached,
  SwarmEvent
} from './swarm';
