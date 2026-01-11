/**
 * Agent Lifecycle Context - Domain Events
 *
 * Domain events published by the Agent Lifecycle bounded context.
 * These events are consumed by other contexts for coordination, learning, and monitoring.
 */

import { AgentLifecycleState } from '../value-objects/agent-lifecycle-state';
import { FAJCode } from '../value-objects/faj-code';

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
 * StateTransitioned Event
 *
 * Published when agent transitions between lifecycle states.
 */
export interface StateTransitionedEvent extends DomainEvent {
  readonly type: 'StateTransitioned';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly fromState: AgentLifecycleState;
    readonly toState: AgentLifecycleState;
    readonly trigger: string;
    readonly interactionCount?: number;
    readonly healthScore?: number;
  };
}

/**
 * AutonomousDecisionMade Event
 *
 * Published when agent makes autonomous action decision via OODA.
 */
export interface AutonomousDecisionMadeEvent extends DomainEvent {
  readonly type: 'AutonomousDecisionMade';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly currentState: AgentLifecycleState;
    readonly contextState: string;
    readonly action: string;
    readonly confidence: number;
    readonly qValue: number;
    readonly reasoning: string;
  };
}

/**
 * ColdStartCompleted Event
 *
 * Published when agent completes cold start phase.
 */
export interface ColdStartCompletedEvent extends DomainEvent {
  readonly type: 'ColdStartCompleted';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly interactionCount: number;
    readonly finalConfidence: number;
    readonly qTableSize: number;
    readonly duration: number;
  };
}

/**
 * HealthThresholdBreached Event
 *
 * Published when agent health drops below threshold.
 */
export interface HealthThresholdBreachedEvent extends DomainEvent {
  readonly type: 'HealthThresholdBreached';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly healthScore: number;
    readonly threshold: number;
    readonly reason: string;
    readonly metrics: {
      readonly cpuUsage: number;
      readonly memoryUsage: number;
      readonly errorRate: number;
      readonly latency: number;
    };
  };
}

/**
 * AgentDegraded Event
 *
 * Published when agent enters Degraded state.
 */
export interface AgentDegradedEvent extends DomainEvent {
  readonly type: 'AgentDegraded';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly previousState: AgentLifecycleState;
    readonly healthScore: number;
    readonly recoveryPlan: string[];
  };
}

/**
 * AgentRecovered Event
 *
 * Published when agent recovers from Degraded state.
 */
export interface AgentRecoveredEvent extends DomainEvent {
  readonly type: 'AgentRecovered';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly healthScore: number;
    readonly recoveryDuration: number;
  };
}

/**
 * AgentSpawned Event
 *
 * Published when a new FeatureAgent is created.
 */
export interface AgentSpawnedEvent extends DomainEvent {
  readonly type: 'AgentSpawned';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly fajCode: string;
    readonly category: string;
    readonly capabilities: string[];
  };
}

/**
 * QueryHandled Event
 *
 * Published when agent processes a query.
 */
export interface QueryHandledEvent extends DomainEvent {
  readonly type: 'QueryHandled';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly queryId: string;
    readonly success: boolean;
    readonly responseTime: number;
    readonly confidence: number;
  };
}

/**
 * CapabilityAdded Event
 *
 * Published when agent learns a new capability.
 */
export interface CapabilityAddedEvent extends DomainEvent {
  readonly type: 'CapabilityAdded';
  readonly aggregateType: 'agent-lifecycle';
  readonly payload: {
    readonly agentId: string;
    readonly capability: string;
    readonly source: 'federated_sync' | 'learning' | 'manual';
  };
}

/**
 * Union type of all agent lifecycle domain events
 */
export type AgentLifecycleEvent =
  | StateTransitionedEvent
  | AutonomousDecisionMadeEvent
  | ColdStartCompletedEvent
  | HealthThresholdBreachedEvent
  | AgentDegradedEvent
  | AgentRecoveredEvent
  | AgentSpawnedEvent
  | QueryHandledEvent
  | CapabilityAddedEvent;

/**
 * Event type guards
 */
export function isStateTransitionedEvent(event: AgentLifecycleEvent): event is StateTransitionedEvent {
  return event.type === 'StateTransitioned';
}

export function isAutonomousDecisionMadeEvent(event: AgentLifecycleEvent): event is AutonomousDecisionMadeEvent {
  return event.type === 'AutonomousDecisionMade';
}

export function isColdStartCompletedEvent(event: AgentLifecycleEvent): event is ColdStartCompletedEvent {
  return event.type === 'ColdStartCompleted';
}

export function isHealthThresholdBreachedEvent(event: AgentLifecycleEvent): event is HealthThresholdBreachedEvent {
  return event.type === 'HealthThresholdBreached';
}

export function isAgentDegradedEvent(event: AgentLifecycleEvent): event is AgentDegradedEvent {
  return event.type === 'AgentDegraded';
}

export function isAgentRecoveredEvent(event: AgentLifecycleEvent): event is AgentRecoveredEvent {
  return event.type === 'AgentRecovered';
}

export function isAgentSpawnedEvent(event: AgentLifecycleEvent): event is AgentSpawnedEvent {
  return event.type === 'AgentSpawned';
}

export function isQueryHandledEvent(event: AgentLifecycleEvent): event is QueryHandledEvent {
  return event.type === 'QueryHandled';
}

export function isCapabilityAddedEvent(event: AgentLifecycleEvent): event is CapabilityAddedEvent {
  return event.type === 'CapabilityAdded';
}
