/**
 * Coordination Context - Domain Events
 *
 * Domain events published by the Coordination bounded context.
 * These events are consumed by other contexts for swarm management.
 */

import { TopologyType } from '../entities/topology-manager';

/**
 * Base domain event interface
 */
export interface DomainEvent {
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly timestamp: Date;
  readonly correlationId?: string;
}

/**
 * SwarmInitialized Event
 *
 * Published when a new swarm is created and initialized.
 */
export interface SwarmInitializedEvent extends DomainEvent {
  readonly type: 'SwarmInitialized';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly topology: TopologyType;
    readonly maxAgents: number;
  };
}

/**
 * AgentSpawned Event
 *
 * Published when a new agent is added to the swarm.
 */
export interface AgentSpawnedEvent extends DomainEvent {
  readonly type: 'AgentSpawned';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly agentId: string;
    readonly fajCode: string;
    readonly category: string;
  };
}

/**
 * AgentTerminated Event
 *
 * Published when an agent is removed from the swarm.
 */
export interface AgentTerminatedEvent extends DomainEvent {
  readonly type: 'AgentTerminated';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly agentId: string;
    readonly reason: string;
  };
}

/**
 * QueryRouted Event
 *
 * Published when a query is routed to an agent.
 */
export interface QueryRoutedEvent extends DomainEvent {
  readonly type: 'QueryRouted';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly queryId: string;
    readonly targetAgentId: string;
    readonly confidence: number;
    readonly routingScore: number;
  };
}

/**
 * TopologyChanged Event
 *
 * Published when the swarm topology is reconfigured.
 */
export interface TopologyChangedEvent extends DomainEvent {
  readonly type: 'TopologyChanged';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly oldTopology: TopologyType;
    readonly newTopology: TopologyType;
    readonly reason: string;
  };
}

/**
 * ConsensusReached Event
 *
 * Published when consensus is achieved on a proposal.
 */
export interface ConsensusReachedEvent extends DomainEvent {
  readonly type: 'ConsensusReached';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly proposalId: string;
    readonly result: 'accepted' | 'rejected';
    readonly participantCount: number;
  };
}

/**
 * AgentHealthUpdated Event
 *
 * Published when an agent's health status changes.
 */
export interface AgentHealthUpdatedEvent extends DomainEvent {
  readonly type: 'AgentHealthUpdated';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly agentId: string;
    readonly previousHealth: number;
    readonly newHealth: number;
    readonly status: 'healthy' | 'degraded' | 'critical';
  };
}

/**
 * RoutingFailed Event
 *
 * Published when query routing fails.
 */
export interface RoutingFailedEvent extends DomainEvent {
  readonly type: 'RoutingFailed';
  readonly aggregateType: 'coordination';
  readonly payload: {
    readonly swarmId: string;
    readonly queryId: string;
    readonly reason: string;
    readonly availableAgents: number;
  };
}

/**
 * Union type of all coordination domain events
 */
export type CoordinationEvent =
  | SwarmInitializedEvent
  | AgentSpawnedEvent
  | AgentTerminatedEvent
  | QueryRoutedEvent
  | TopologyChangedEvent
  | ConsensusReachedEvent
  | AgentHealthUpdatedEvent
  | RoutingFailedEvent;

/**
 * Event type guards
 */
export function isSwarmInitializedEvent(event: CoordinationEvent): event is SwarmInitializedEvent {
  return event.type === 'SwarmInitialized';
}

export function isAgentSpawnedEvent(event: CoordinationEvent): event is AgentSpawnedEvent {
  return event.type === 'AgentSpawned';
}

export function isAgentTerminatedEvent(event: CoordinationEvent): event is AgentTerminatedEvent {
  return event.type === 'AgentTerminated';
}

export function isQueryRoutedEvent(event: CoordinationEvent): event is QueryRoutedEvent {
  return event.type === 'QueryRouted';
}

export function isTopologyChangedEvent(event: CoordinationEvent): event is TopologyChangedEvent {
  return event.type === 'TopologyChanged';
}

export function isConsensusReachedEvent(event: CoordinationEvent): event is ConsensusReachedEvent {
  return event.type === 'ConsensusReached';
}

export function isAgentHealthUpdatedEvent(event: CoordinationEvent): event is AgentHealthUpdatedEvent {
  return event.type === 'AgentHealthUpdated';
}

export function isRoutingFailedEvent(event: CoordinationEvent): event is RoutingFailedEvent {
  return event.type === 'RoutingFailed';
}
