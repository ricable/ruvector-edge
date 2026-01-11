/**
 * Enhanced FeatureAgent with AutonomousStateMachine Integration
 *
 * This enhanced version of FeatureAgent integrates the autonomous state machine
 * for proper OODA loop execution and Q-learning based decision making.
 *
 * @module knowledge/aggregates/enhanced-feature-agent
 */

import { FAJCode } from '../value-objects/faj-code';
import { Feature, AccessTechnology, Category } from '../entities/feature';
import { AutonomousStateMachine, AgentState } from '../../intelligence/aggregates/autonomous-state-machine';
import { State } from '../../intelligence/value-objects/state';
import { Action } from '../../intelligence/value-objects/action';
import { Reward } from '../../intelligence/value-objects/reward';
import { AgentId, AgentConfig, AgentStatus } from './feature-agent';
import { LTE_50_FEATURES } from '../../ran-battle-test/aggregates/lte-features-constants';

/**
 * Query Type Enum
 */
export enum QueryType {
  PARAMETER_CONFIGURATION = 'ParameterConfiguration',
  TROUBLESHOOTING = 'Troubleshooting',
  OPTIMIZATION = 'Optimization',
  ACTIVATION = 'Activation',
  DEACTIVATION = 'Deactivation',
  COMPARISON = 'Comparison',
  GENERAL_INFO = 'GeneralInfo'
}

/**
 * Complexity Level Enum
 */
export enum ComplexityLevel {
  SIMPLE = 'Simple',
  MODERATE = 'Moderate',
  COMPLEX = 'Complex',
  EXPERT = 'Expert'
}

/**
 * Query Value Object
 */
export interface Query {
  readonly id: string;
  readonly type: QueryType;
  readonly content: string;
  readonly complexity: ComplexityLevel;
  readonly timestamp: Date;
}

/**
 * Enhanced Agent Configuration
 */
export interface EnhancedAgentConfig extends AgentConfig {
  readonly stateMachineConfig?: {
    readonly coldStartThreshold?: number;
    readonly degradedThreshold?: number;
    readonly explorationBaseRate?: number;
    readonly recoveryThreshold?: number;
  };
  readonly acronym?: string;
  readonly cxc?: string | null;
}

/**
 * Response Value Object
 */
export interface AgentResponse {
  readonly content: string;
  readonly confidence: number;
  readonly actionTaken: Action;
  readonly stateAtResponse: AgentState;
  readonly consultedPeers: string[];
  readonly sources: string[];
  readonly cmeditCommands: string[];
  readonly latencyMs: number;
}

/**
 * Enhanced FeatureAgent
 *
 * Integrates AutonomousStateMachine for:
 * - State-based lifecycle management
 * - OODA loop decision making
 * - Q-learning action selection
 * - Health-based transitions
 */
export class EnhancedFeatureAgent {
  private readonly _id: AgentId;
  private readonly _fajCode: FAJCode;
  private readonly _type: AccessTechnology;
  private readonly _category: Category;
  private readonly _stateMachine: AutonomousStateMachine;
  private readonly _featureData: Feature;
  private readonly _queries: Map<string, Query>;
  private readonly _acronym: string;
  private readonly _cxc: string | null;
  private _status: AgentStatus;
  private _totalResponseTime: number;
  private _oodaExecutions: number;

  private constructor(
    id: AgentId,
    fajCode: FAJCode,
    type: AccessTechnology,
    category: Category,
    feature: Feature,
    stateMachine: AutonomousStateMachine,
    acronym: string,
    cxc: string | null
  ) {
    this._id = id;
    this._fajCode = fajCode;
    this._type = type;
    this._category = category;
    this._featureData = feature;
    this._stateMachine = stateMachine;
    this._queries = new Map();
    this._acronym = acronym;
    this._cxc = cxc;
    this._status = 'Initializing';
    this._totalResponseTime = 0;
    this._oodaExecutions = 0;
  }

  /**
   * Factory method to create enhanced feature agent
   */
  static createEnhanced(config: EnhancedAgentConfig): EnhancedFeatureAgent {
    const id: AgentId = { value: `agent-${config.fajCode.toString().replace(/\s/g, '-')}` };

    // Create autonomous state machine
    const stateMachine = new AutonomousStateMachine(
      id.value,
      {
        agentId: id.value,
        // Lower threshold for testing - agents should be ready after a few interactions
        coldStartThreshold: config.stateMachineConfig?.coldStartThreshold ?? 3,
        degradedThreshold: config.stateMachineConfig?.degradedThreshold ?? 0.5,
        explorationBaseRate: config.stateMachineConfig?.explorationBaseRate ?? 0.1,
        recoveryThreshold: config.stateMachineConfig?.recoveryThreshold ?? 0.3
      }
    );

    // Create the enhanced agent
    const agent = new EnhancedFeatureAgent(
      id,
      config.fajCode,
      config.type,
      config.category,
      config.featureData,
      stateMachine,
      config.acronym || '',
      config.cxc ?? null
    );

    return agent;
  }

  /**
   * Initialize with state machine
   */
  async initialize(): Promise<void> {
    // Load knowledge into state machine
    this._stateMachine.loadKnowledge();
    // Update status to Ready
    this._status = 'Ready';
  }

  /**
   * Handle query using OODA loop and Q-learning
   */
  async handleQueryEnhanced(query: Query): Promise<AgentResponse> {
    const startTime = Date.now();

    // Store query
    this._queries.set(query.id, query);

    // Create state for Q-learning
    const state = this.createState(query);

    // Run OODA loop
    const oodaResult = this._stateMachine.runOODALoop(state);

    // Execute action based on OODA decision
    const response = await this.executeOODADecision(query, oodaResult);

    // Record response time
    const latency = Date.now() - startTime;
    this._totalResponseTime += latency;
    this._oodaExecutions++;

    return {
      ...response,
      actionTaken: oodaResult.decision.action,
      stateAtResponse: this._stateMachine.currentState,
      latencyMs: latency
    };
  }

  /**
   * Record feedback with reward
   */
  recordFeedbackEnhanced(
    queryId: string,
    userRating: number,
    resolutionSuccess: boolean
  ): void {
    const query = this._queries.get(queryId);
    if (!query) return;

    // Create state and compute reward
    const state = this.createState(query);
    const reward = new Reward(
      (userRating + 1) / 2, // Convert [-1, 1] to [0, 1]
      resolutionSuccess ? 0.5 : -0.5,
      0,
      0
    );

    // Get action that was taken (simplified - would need to track this)
    const action = Action.DIRECT_ANSWER;

    // Record in state machine
    this._stateMachine.recordInteraction(state, action, reward);
  }

  /**
   * Get state machine statistics
   */
  getStateMachineStats(): {
    state: AgentState;
    health: number;
    successRate: number;
    explorationRate: number;
    interactionCount: number;
    oodaExecutions: number;
    averageResponseTime: number;
  } {
    return {
      state: this._stateMachine.currentState,
      health: this._stateMachine.health,
      successRate: this._stateMachine.successRate,
      explorationRate: this._stateMachine.explorationRate,
      interactionCount: this._stateMachine.interactionCount,
      oodaExecutions: this._oodaExecutions,
      averageResponseTime: this._oodaExecutions > 0
        ? this._totalResponseTime / this._oodaExecutions
        : 0
    };
  }

  // Add public getters for stateMachine
  get stateMachine(): AutonomousStateMachine {
    return this._stateMachine;
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Create state for Q-learning from query
   */
  private createState(query: Query): State {
    // Map QueryType to State's queryType
    const stateQueryType = this.mapQueryType(query.type);
    const stateComplexity = this.mapComplexity(query.complexity);
    const contextHash = this.generateContextHash(query.content);
    const confidence = Math.floor(this._stateMachine.health * 10);

    // Create state key: "queryType:complexity:contextHash:confidence"
    const stateKey = `${stateQueryType}:${stateComplexity}:${contextHash}:${confidence}`;
    return State.create(stateKey);
  }

  /**
   * Map QueryType to State's queryType
   */
  private mapQueryType(queryType: QueryType): string {
    switch (queryType) {
      case QueryType.PARAMETER_CONFIGURATION:
        return 'parameter';
      case QueryType.TROUBLESHOOTING:
        return 'troubleshoot';
      case QueryType.OPTIMIZATION:
        return 'procedure';
      case QueryType.ACTIVATION:
      case QueryType.DEACTIVATION:
        return 'procedure';
      case QueryType.COMPARISON:
        return 'general';
      case QueryType.GENERAL_INFO:
      default:
        return 'general';
    }
  }

  /**
   * Map ComplexityLevel to State's complexity
   */
  private mapComplexity(complexity: ComplexityLevel): string {
    switch (complexity) {
      case ComplexityLevel.SIMPLE:
        return 'low';
      case ComplexityLevel.MODERATE:
        return 'medium';
      case ComplexityLevel.COMPLEX:
      case ComplexityLevel.EXPERT:
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Execute action based on OODA decision
   */
  private async executeOODADecision(
    query: Query,
    oodaResult: {
      observations: import('../../intelligence/aggregates/autonomous-state-machine').Observations;
      orientation: import('../../intelligence/aggregates/autonomous-state-machine').Orientation;
      decision: import('../../intelligence/aggregates/autonomous-state-machine').Decision;
      result: import('../../intelligence/aggregates/autonomous-state-machine').ActionResult;
    }
  ): Promise<Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'>> {
    const { decision, orientation } = oodaResult;

    // decision.action is an Action enum value (string like 'direct_answer')
    const action = decision.action as unknown as Action;

    // Generate response based on action
    switch (action) {
      case Action.DIRECT_ANSWER:
        return this.directAnswer(query, orientation.confidence);

      case Action.CONTEXT_ANSWER:
        return this.contextAnswer(query, orientation.confidence);

      case Action.CONSULT_PEER:
        return this.peerConsultation(query, orientation.confidence);

      case Action.REQUEST_CLARIFICATION:
        return this.requestClarification(query);

      case Action.ESCALATE:
        return this.escalate(query);

      default:
        return this.directAnswer(query, orientation.confidence);
    }
  }

  /**
   * Direct answer action
   */
  private directAnswer(query: Query, confidence: number): Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'> {
    return {
      content: this.generateAnswer(query),
      confidence,
      consultedPeers: [],
      sources: [this._featureData.name],
      cmeditCommands: this.getCmeditCommands(query)
    };
  }

  /**
   * Context answer action
   */
  private contextAnswer(query: Query, confidence: number): Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'> {
    return {
      content: this.generateDetailedAnswer(query),
      confidence,
      consultedPeers: [],
      sources: [this._featureData.name, 'Feature Documentation'],
      cmeditCommands: this.getCmeditCommands(query)
    };
  }

  /**
   * Peer consultation action
   */
  private async peerConsultation(query: Query, confidence: number): Promise<Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'>> {
    return {
      content: this.generateAnswer(query) + '\n\n[Peer consultation requested for additional verification]',
      confidence: Math.min(1, confidence + 0.1),
      consultedPeers: [], // Would populate with actual peer IDs
      sources: [this._featureData.name],
      cmeditCommands: this.getCmeditCommands(query)
    };
  }

  /**
   * Request clarification action
   */
  private requestClarification(query: Query): Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'> {
    return {
      content: `I need more information to provide an accurate answer regarding ${this._featureData.name}. Could you please specify:\n- Which aspect of the feature are you asking about?\n- What is your current configuration?\n- What problem are you trying to solve?`,
      confidence: 0.5,
      consultedPeers: [],
      sources: [],
      cmeditCommands: []
    };
  }

  /**
   * Escalate action
   */
  private escalate(query: Query): Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'> {
    return {
      content: `Your query regarding ${this._featureData.name} has been escalated to a specialist. Expected response time: 24 hours.\n\nQuery ID: ${query.id}`,
      confidence: 0.3,
      consultedPeers: [],
      sources: [],
      cmeditCommands: []
    };
  }

  /**
   * Generate answer based on query and feature knowledge
   */
  private generateAnswer(query: Query): string {
    const { name, description } = this._featureData;

    let answer = `## ${name} [${this._acronym}]\n\n`;
    answer += `${description}\n\n`;

    switch (query.type) {
      case QueryType.PARAMETER_CONFIGURATION:
        answer += `### Key Parameters\n`;
        if (this._featureData.parameters.length > 0) {
          answer += this._featureData.parameters.slice(0, 5).map(p => `- ${p.name}: ${p.description}`).join('\n');
        } else {
          answer += `- No specific parameters for this feature\n`;
        }
        break;

      case QueryType.TROUBLESHOOTING:
        answer += `### Counters to Monitor\n`;
        if (this._featureData.counters.length > 0) {
          answer += this._featureData.counters.slice(0, 5).map(c => `- ${c.name}: ${c.description}`).join('\n');
        } else {
          answer += `- No specific counters for this feature\n`;
        }
        break;

      case QueryType.OPTIMIZATION:
        answer += `### Related KPIs\n`;
        if (this._featureData.kpis.length > 0) {
          answer += this._featureData.kpis.slice(0, 3).map(k => `- ${k.name}: ${k.description}`).join('\n');
        } else {
          answer += `- No specific KPIs for this feature\n`;
        }
        break;

      case QueryType.ACTIVATION:
        if (this._cxc) {
          answer += `### Activation\n`;
          answer += `CXC Code: ${this._cxc}\n`;
          answer += `Command: \`cmedit set <SITE> FeatureState=${this._cxc} featureState=ACTIVATED\`\n`;
        } else {
          answer += `### Activation\n`;
          answer += `No CXC code available for this feature.\n`;
        }
        break;
    }

    return answer;
  }

  /**
   * Generate detailed answer with more information
   */
  private generateDetailedAnswer(query: Query): string {
    let answer = this.generateAnswer(query);

    if (this._featureData.dependencies.length > 0) {
      answer += `\n### Prerequisites\n${this._featureData.dependencies.map(d => `- ${d}`).join('\n')}\n`;
    }

    return answer;
  }

  /**
   * Get cmedit commands for the query
   */
  private getCmeditCommands(query: Query): string[] {
    if (!this._cxc || query.type !== QueryType.ACTIVATION) {
      return [];
    }

    return [
      `cmedit get <SITE> FeatureState=${this._cxc} featureState,licenseState,serviceState`,
      `cmedit set <SITE> FeatureState=${this._cxc} featureState=ACTIVATED`
    ];
  }

  /**
   * Generate context hash from query content
   */
  private generateContextHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // =============================================================================
  // GETTERS
  // =============================================================================

  get stateMachine(): AutonomousStateMachine {
    return this._stateMachine;
  }

  get featureData(): Feature {
    return this._featureData;
  }

  get name(): string {
    return this._featureData.name;
  }

  get acronym(): string {
    return this._acronym;
  }
}

/**
 * 50 LTE Feature Agents Factory
 *
 * Creates and manages 50 specialized RAN feature agents for 4G LTE
 */
export class LTEFeatureAgentsFactory {
  // Use shared feature list from ran-battle-test domain
  private static readonly LTE_FEATURES = LTE_50_FEATURES;

  /**
   * Create all 50 LTE feature agents
   */
  static createAll(): Map<string, EnhancedFeatureAgent> {
    const agents = new Map<string, EnhancedFeatureAgent>();

    for (const feature of this.LTE_FEATURES) {
      const fajCode = new FAJCode(feature.faj);
      const category = this.inferCategory(feature.name);

      // Create Feature using proper constructor
      const featureData = new Feature({
        id: `feature-${feature.acronym}`,
        fajCode,
        name: feature.name,
        description: `${feature.name} - LTE feature with FAJ ${feature.faj}`,
        category,
        accessTechnology: 'LTE' as AccessTechnology,
        parameters: this.generateMockParameters(),
        counters: this.generateMockCounters(),
        kpis: this.generateMockKPIs(),
        procedures: [],
        dependencies: [],
        conflicts: [],
        relatedFeatures: []
      });

      const agent = EnhancedFeatureAgent.createEnhanced({
        fajCode,
        type: 'LTE' as AccessTechnology,
        category,
        featureData,
        acronym: feature.acronym,
        cxc: feature.cxc,
        stateMachineConfig: {
          coldStartThreshold: 3,
          degradedThreshold: 0.5,
          explorationBaseRate: 0.1,
          recoveryThreshold: 0.3
        }
      });

      agents.set(feature.acronym, agent);
    }

    return agents;
  }

  /**
   * Infer category from feature name
   */
  private static inferCategory(name: string): Category {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('carrier aggregation') || nameLower.includes('cae') || nameLower.includes('cc')) {
      return 'CA' as Category;
    } else if (nameLower.includes('qam') || nameLower.includes('mimo') || nameLower.includes('antenna')) {
      return 'MIMO' as Category;
    } else if (nameLower.includes('neighbor') || nameLower.includes('anr') || nameLower.includes('mobility') || nameLower.includes('handover')) {
      return 'Mobility' as Category;
    } else if (nameLower.includes('interference') || nameLower.includes('irc')) {
      return 'Interference' as Category;
    } else if (nameLower.includes('load') || nameLower.includes('balancing') || nameLower.includes('offload') || nameLower.includes('admission')) {
      return 'RRM' as Category;
    } else if (nameLower.includes('cell') || nameLower.includes('sector')) {
      return 'Coverage' as Category;
    } else if (nameLower.includes('security') || nameLower.includes('defense')) {
      return 'Security' as Category;
    } else if (nameLower.includes('energy') || nameLower.includes('sleep') || nameLower.includes('power')) {
      return 'Energy' as Category;
    } else if (nameLower.includes('transport') || nameLower.includes('cpri')) {
      return 'Transport' as Category;
    } else if (nameLower.includes('voice') || nameLower.includes('cs fallback')) {
      return 'Voice' as Category;
    } else {
      return 'Other' as Category;
    }
  }

  /**
   * Generate mock parameters for feature
   */
  private static generateMockParameters(): any[] {
    return [];
  }

  /**
   * Generate mock counters for feature
   */
  private static generateMockCounters(): any[] {
    return [];
  }

  /**
   * Generate mock KPIs for feature
   */
  private static generateMockKPIs(): any[] {
    return [];
  }
}

export default EnhancedFeatureAgent;
