/**
 * ELEX Edge AI Agent Swarm - Enumerations
 *
 * Core enumerations used throughout the domain model.
 */

/**
 * Agent lifecycle status
 */
export enum AgentStatus {
  Initializing = 'initializing',
  Ready = 'ready',
  Busy = 'busy',
  Offline = 'offline',
  Error = 'error',
}

/**
 * Type of access technology for RAN features
 */
export enum AccessTechnology {
  LTE = 'LTE',
  NR = 'NR',
  GSM = 'GSM',
  CrossRAT = 'CrossRAT',
}

/**
 * Agent type based on access technology
 */
export enum AgentType {
  LTE = 'LTE',
  NR = 'NR',
  CrossRAT = 'CrossRAT',
}

/**
 * Feature category for agent specialization
 */
export enum Category {
  CarrierAggregation = 'CA',
  RadioResourceManagement = 'RRM',
  MIMO = 'MIMO',
  Mobility = 'Mobility',
  NR = 'NR',
  Coverage = 'Coverage',
  Transport = 'Transport',
  Voice = 'Voice',
  Interference = 'Interference',
  QoS = 'QoS',
  Timing = 'Timing',
  Security = 'Security',
  EnergySaving = 'Energy',
  UEHandling = 'UE',
  Other = 'Other',
}

/**
 * Query types supported by the system
 */
export enum QueryType {
  Parameter = 'parameter',
  Counter = 'counter',
  KPI = 'kpi',
  Procedure = 'procedure',
  Troubleshoot = 'troubleshoot',
  General = 'general',
}

/**
 * Available actions for Q-learning
 */
export enum Action {
  DirectAnswer = 'direct_answer',
  ContextAnswer = 'context_answer',
  ConsultPeer = 'consult_peer',
  RequestClarification = 'request_clarification',
  Escalate = 'escalate',
}

/**
 * Complexity level of a query
 */
export enum ComplexityLevel {
  Simple = 'simple',
  Moderate = 'moderate',
  Complex = 'complex',
  Expert = 'expert',
}

/**
 * Risk level for optimization actions
 */
export enum RiskLevel {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
}

/**
 * Spatial granularity levels for KPI monitoring
 */
export enum SpatialLevel {
  Cell = 'cell',
  Sector = 'sector',
  Node = 'node',
  Cluster = 'cluster',
  Network = 'network',
}

/**
 * Temporal granularity levels for KPI monitoring
 */
export enum TemporalLevel {
  Minutes15 = '15min',
  Hour1 = '1hr',
  Hours4 = '4hr',
  Hours24 = '24hr',
  Days7 = '7day',
}

/**
 * Optimization cycle phases
 */
export enum OptimizationPhase {
  Observe = 'observe',
  Analyze = 'analyze',
  Decide = 'decide',
  Act = 'act',
  Learn = 'learn',
  Repeat = 'repeat',
}

/**
 * Counter category for analysis
 */
export enum CounterCategory {
  Primary = 'primary',
  Contributing = 'contributing',
  Contextual = 'contextual',
}

/**
 * Swarm topology options
 */
export enum SwarmTopology {
  Mesh = 'mesh',
  Hierarchical = 'hierarchical',
  Sharded = 'sharded',
  Hybrid = 'hybrid',
}

/**
 * Consensus protocol types
 */
export enum ConsensusProtocol {
  Raft = 'raft',
  Gossip = 'gossip',
  CRDT = 'crdt',
  Byzantine = 'byzantine',
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical',
}

/**
 * Data types for parameters
 */
export enum DataType {
  Integer = 'integer',
  Float = 'float',
  Boolean = 'boolean',
  String = 'string',
  Enum = 'enum',
}

/**
 * Deployment modes for edge runtime
 * @see ADR-003: Edge-First Zero-Cloud Architecture
 */
export enum DeploymentMode {
  Browser = 'browser',
  Mobile = 'mobile',
  EdgeServer = 'edge-server',
}

/**
 * Blocking conditions for optimization
 * @see ADR-008: Safe Zone Parameter Constraints
 */
export enum BlockingCondition {
  CriticalHardwareFailure = 'CRITICAL_HW_FAILURE',
  SiteDown = 'SITE_DOWN',
  HighCallDrop = 'HIGH_CALL_DROP',
  NightWindow = 'NIGHT_WINDOW',
  OperatorPause = 'OPERATOR_PAUSE',
}

/**
 * Approval status for optimization actions
 */
export enum ApprovalStatus {
  Pending = 'pending',
  AutoApproved = 'auto_approved',
  ManualApproved = 'manual_approved',
  Rejected = 'rejected',
}

/**
 * Aggregation types for KPI and counter calculations
 */
export enum AggregationType {
  Sum = 'sum',
  Average = 'avg',
  Maximum = 'max',
  Minimum = 'min',
  Last = 'last',
  Count = 'count',
}
