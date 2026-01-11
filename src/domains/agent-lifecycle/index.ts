/**
 * Agent Lifecycle Bounded Context
 *
 * The Agent Lifecycle bounded context manages the autonomous behavior and state
 * transitions of RAN feature agents using Goal-Oriented Action Planning (GOAP)
 * and Q-learning reinforcement learning.
 *
 * This is a CORE DOMAIN context that handles:
 * - Agent lifecycle state management (Initializing, ColdStart, Ready, Busy, Degraded, Offline)
 * - OODA loop (Observe, Orient, Decide, Act) for autonomous decision making
 * - Health monitoring and recovery
 * - Cold start learning phase
 * - Event sourcing for state transitions
 *
 * Aggregates:
 * - FeatureAgent: Central aggregate managing agent lifecycle
 * - AutonomousStateMachine: State machine with OODA loop
 *
 * Value Objects:
 * - AgentLifecycleState: State representation with transition validation
 * - FAJCode: Ericsson feature code with category mapping
 * - ConfidenceScore: Bounded confidence [0, 1] with operations
 * - HealthScore: Health metric [0, 1] with status categories
 *
 * Domain Events:
 * - StateTransitioned: State change events
 * - AutonomousDecisionMade: OODA decision events
 * - ColdStartCompleted: Cold start phase completion
 * - HealthThresholdBreached: Health degradation events
 * - AgentDegraded/Recovered: Degradation state changes
 * - AgentSpawned: New agent creation
 * - QueryHandled: Query processing events
 * - CapabilityAdded: New capability learned
 */

// Aggregates
export * from './aggregates';

// Value Objects
export * from './value-objects';

// Domain Events
export * from './domain-events';
