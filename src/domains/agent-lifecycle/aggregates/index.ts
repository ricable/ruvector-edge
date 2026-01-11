/**
 * Agent Lifecycle Context - Aggregates
 *
 * Exports all aggregates for the Agent Lifecycle bounded context.
 */

export {
  FeatureAgent,
  type AgentId,
  type Capability,
  type FeatureAgentConfig
} from './feature-agent';

export {
  AutonomousStateMachine,
  type StateTrigger,
  type TransitionGuardContext,
  type StateStatistics,
  type OODAContext,
  DEFAULT_STATE_MACHINE_CONFIG
} from './autonomous-state-machine';

export type {
  AutonomousStateMachineConfig
} from './autonomous-state-machine';
