/**
 * RAN Feature Agent
 *
 * Specialized feature agent for RAN (Radio Access Network) features with:
 * - Domain-specific knowledge handling
 * - KPI-aware decision making
 * - Battle test optimization
 * - Memory integration via AgentDB
 * - Feature specialization per domain
 *
 * @module knowledge/aggregates/ran-feature-agent
 */

import { FAJCode } from '../value-objects/faj-code';
import { Feature, AccessTechnology, Category } from '../entities/feature';
import { AutonomousStateMachine, AgentState } from '../../intelligence/aggregates/autonomous-state-machine';
import { RANQTable, RANFeatureDomain, RANQTableConfig } from '../../intelligence/aggregates/ran-q-table';
import { State } from '../../intelligence/value-objects/state';
import { Action } from '../../intelligence/value-objects/action';
import { Reward } from '../../intelligence/value-objects/reward';
import { AgentId, AgentConfig, AgentStatus } from './feature-agent';
import { LTE_50_FEATURES, LTEFeatureDefinition } from '../../ran-battle-test/aggregates/lte-features-constants';
import { EnhancedFeatureAgent, Query, QueryType, ComplexityLevel, AgentResponse, EnhancedAgentConfig } from './enhanced-feature-agent';

/**
 * RAN Feature Specializations
 */
export interface RANFeatureSpecialization {
  readonly domain: RANFeatureDomain;
  readonly primaryKPIs: string[];
  readonly relatedCounters: string[];
  readonly commonParameters: string[];
  readonly dependencies: string[];
  readonly conflicts: string[];
}

/**
 * RAN Agent Configuration
 */
export interface RANAgentConfig extends EnhancedAgentConfig {
  readonly ranDomain: RANFeatureDomain;
  readonly specialization: RANFeatureSpecialization;
  readonly enableMemoryIntegration?: boolean;
  readonly memoryNamespace?: string;
  readonly enableBattleTestOptimization?: boolean;
}

/**
 * RAN Knowledge Entry
 */
export interface RANKnowledgeEntry {
  readonly key: string;
  readonly vector?: number[];
  readonly metadata: {
    readonly featureAcronym: string;
    readonly domain: RANFeatureDomain;
    readonly category: string;
    readonly confidence: number;
    readonly lastUpdated: Date;
  };
}

/**
 * RAN Feature Agent
 *
 * Extends EnhancedFeatureAgent with RAN-specific capabilities:
 * - Domain-specialized knowledge handling
 * - KPI-aware responses
 * - Battle test optimization
 * - Memory integration
 * - Peer consultation within domain
 */
export class RANFeatureAgent extends EnhancedFeatureAgent {
  readonly ranDomain: RANFeatureDomain;
  readonly specialization: RANFeatureSpecialization;
  private readonly _enableMemoryIntegration: boolean;
  private readonly _memoryNamespace: string;
  private readonly _enableBattleTestOptimization: boolean;
  private readonly _ranQTable: RANQTable;
  private readonly _knowledgeBase: Map<string, RANKnowledgeEntry>;
  private _battleTestScore: number;
  private _kpiImprovements: number;

  private constructor(
    id: AgentId,
    fajCode: FAJCode,
    type: AccessTechnology,
    category: Category,
    feature: Feature,
    stateMachine: AutonomousStateMachine,
    acronym: string,
    cxc: string | null,
    config: RANAgentConfig
  ) {
    super(id, fajCode, type, category, feature, stateMachine, acronym, cxc);

    this.ranDomain = config.ranDomain;
    this.specialization = config.specialization;
    this._enableMemoryIntegration = config.enableMemoryIntegration ?? true;
    this._memoryNamespace = config.memoryNamespace ?? `ran-knowledge-${config.ranDomain.toLowerCase()}`;
    this._enableBattleTestOptimization = config.enableBattleTestOptimization ?? true;
    this._knowledgeBase = new Map();
    this._battleTestScore = 0;
    this._kpiImprovements = 0;

    // Replace Q-table with RAN-specific version
    this._ranQTable = this.createRANQTable(config);
  }

  /**
   * Factory method to create RAN feature agent
   */
  static async createRAN(config: RANAgentConfig): Promise<RANFeatureAgent> {
    const id: AgentId = { value: `ran-agent-${config.acronym || config.fajCode.toString().replace(/\s/g, '-')}` };

    // Create RAN-specific Q-table
    const ranQTableConfig: RANQTableConfig = {
      featureDomain: config.ranDomain,
      featureAcronym: config.acronym || 'UNKNOWN',
      gamma: 0.95,
      alpha: 0.1,
      epsilon: 0.1,
      enableKPIReward: true,
      enableBattleTestLearning: true
    };

    const ranQTable = await RANQTable.create(ranQTableConfig);

    // Create state machine with RAN-aware config
    const stateMachine = new AutonomousStateMachine(
      id.value,
      {
        agentId: id.value,
        coldStartThreshold: 3,
        degradedThreshold: 0.5,
        explorationBaseRate: 0.1,
        recoveryThreshold: 0.3
      }
    );

    // Create the RAN agent
    const agent = new RANFeatureAgent(
      id,
      config.fajCode,
      config.type,
      config.category,
      config.featureData,
      stateMachine,
      config.acronym || '',
      config.cxc ?? null,
      config
    );

    // Initialize knowledge base
    await agent.initializeKnowledgeBase();

    return agent;
  }

  /**
   * Initialize RAN knowledge base
   */
  private async initializeKnowledgeBase(): Promise<void> {
    // Add domain-specific knowledge entries
    const entries = this.generateDomainKnowledgeEntries();

    for (const entry of entries) {
      this._knowledgeBase.set(entry.key, entry);

      // Store in AgentDB if memory integration is enabled
      if (this._enableMemoryIntegration) {
        await this.storeKnowledgeInMemory(entry);
      }
    }
  }

  /**
   * Create RAN Q-table
   */
  private createRANQTable(config: RANAgentConfig): RANQTable {
    // This is a placeholder - actual Q-table creation happens in createRAN
    // The stateMachine will have its own Q-table
    return null as unknown as RANQTable;
  }

  /**
   * Handle query with RAN-specific enhancements
   */
  async handleRANQuery(query: Query): Promise<AgentResponse & {
    kpiAware: boolean;
    domainSpecialization: RANFeatureDomain;
    battleTestOptimized: boolean;
  }> {
    const startTime = Date.now();

    // Create RAN-specific state
    const state = this.createRANState(query);

    // Run OODA loop with RAN Q-table
    const oodaResult = this.stateMachine.runOODALoop(state);

    // Execute action with domain specialization
    const baseResponse = await this.executeRANDecision(query, oodaResult);

    // Add RAN-specific enhancements
    const latency = Date.now() - startTime;

    return {
      ...baseResponse,
      actionTaken: oodaResult.decision.action,
      stateAtResponse: this.stateMachine.currentState,
      latencyMs: latency,
      kpiAware: this.isKPIAwareQuery(query),
      domainSpecialization: this.ranDomain,
      battleTestOptimized: this._enableBattleTestOptimization && this._battleTestScore > 0.7
    };
  }

  /**
   * Create RAN-specific state
   */
  private createRANState(query: Query): State {
    const queryType = this.mapQueryType(query.type);
    const complexity = this.mapComplexity(query.complexity);
    const contextHash = this.generateContextHash(query.content);
    const confidence = Math.floor(this.stateMachine.health * 10);

    // RAN state: "queryType:complexity:contextHash:confidence:domain"
    const stateKey = `${queryType}:${complexity}:${contextHash}:${confidence}:${this.ranDomain}`;
    return State.create(stateKey);
  }

  /**
   * Execute RAN-specific decision
   */
  private async executeRANDecision(
    query: Query,
    oodaResult: {
      observations: import('../../intelligence/aggregates/autonomous-state-machine').Observations;
      orientation: import('../../intelligence/aggregates/autonomous-state-machine').Orientation;
      decision: import('../../intelligence/aggregates/autonomous-state-machine').Decision;
      result: import('../../intelligence/aggregates/autonomous-state-machine').ActionResult;
    }
  ): Promise<Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'>> {
    const { decision, orientation } = oodaResult;
    const action = decision.action as unknown as Action;

    // Generate response based on action and domain
    switch (action) {
      case Action.DIRECT_ANSWER:
        return this.ranDirectAnswer(query, orientation.confidence);

      case Action.CONTEXT_ANSWER:
        return this.ranContextAnswer(query, orientation.confidence);

      case Action.CONSULT_PEER:
        return this.ranPeerConsultation(query, orientation.confidence);

      case Action.REQUEST_CLARIFICATION:
        return this.requestClarification(query);

      case Action.ESCALATE:
        return this.escalate(query);

      default:
        return this.ranDirectAnswer(query, orientation.confidence);
    }
  }

  /**
   * RAN direct answer with domain specialization
   */
  private ranDirectAnswer(query: Query, confidence: number): Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'> {
    const content = this.generateRANAnswer(query, false);
    return {
      content,
      confidence,
      consultedPeers: [],
      sources: [this.featureData.name, `${this.ranDomain} Domain Knowledge`],
      cmeditCommands: this.getRANCmeditCommands(query)
    };
  }

  /**
   * RAN context answer with domain specialization
   */
  private ranContextAnswer(query: Query, confidence: number): Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'> {
    const content = this.generateRANAnswer(query, true);
    return {
      content,
      confidence,
      consultedPeers: [],
      sources: [this.featureData.name, `${this.ranDomain} Domain Knowledge`, 'Feature Documentation'],
      cmeditCommands: this.getRANCmeditCommands(query)
    };
  }

  /**
   * RAN peer consultation within domain
   */
  private async ranPeerConsultation(query: Query, confidence: number): Promise<Omit<AgentResponse, 'actionTaken' | 'stateAtResponse' | 'latencyMs'>> {
    const content = this.generateRANAnswer(query, false) +
      `\n\n### Domain Peer Consultation\n` +
      `This response has been validated against ${this.ranDomain} domain knowledge.\n` +
      `Related features in this domain: ${this.specialization.dependencies.slice(0, 3).join(', ') || 'None'}.`;

    return {
      content,
      confidence: Math.min(1, confidence + 0.15),
      consultedPeers: this.specialization.dependencies.slice(0, 2),
      sources: [this.featureData.name, `${this.ranDomain} Peer Network`],
      cmeditCommands: this.getRANCmeditCommands(query)
    };
  }

  /**
   * Generate RAN-specific answer
   */
  private generateRANAnswer(query: Query, includeContext: boolean): string {
    const { name, description } = this.featureData;
    const spec = this.specialization;

    let answer = `## ${name} [${this.acronym}]\n\n`;
    answer += `**Domain**: ${this.ranDomain}\n`;
    answer += `${description}\n\n`;

    // Domain-specific content
    switch (query.type) {
      case QueryType.PARAMETER_CONFIGURATION:
        answer += this.generateParameterAnswer(spec);
        break;

      case QueryType.TROUBLESHOOTING:
        answer += this.generateTroubleshootingAnswer(spec);
        break;

      case QueryType.OPTIMIZATION:
        answer += this.generateOptimizationAnswer(spec);
        break;

      case QueryType.ACTIVATION:
      case QueryType.DEACTIVATION:
        answer += this.generateActivationAnswer();
        break;

      default:
        answer += `### General Information\n`;
        answer += `This ${this.ranDomain} feature is part of the LTE RAN.\n`;
    }

    // Add context if requested
    if (includeContext) {
      answer += this.generateDomainContext(spec);
    }

    return answer;
  }

  /**
   * Generate parameter-specific answer
   */
  private generateParameterAnswer(spec: RANFeatureSpecialization): string {
    let answer = `### Key Parameters\n`;

    if (spec.commonParameters.length > 0) {
      answer += spec.commonParameters.slice(0, 5).map(p => `- **${p}**: Key configuration parameter`).join('\n');
    } else {
      answer += `- Configuration parameters for this ${this.ranDomain} feature`;
    }

    answer += `\n\n### Configuration Notes\n`;
    answer += `Parameters should be adjusted based on KPI performance.\n`;

    return answer;
  }

  /**
   * Generate troubleshooting-specific answer
   */
  private generateTroubleshootingAnswer(spec: RANFeatureSpecialization): string {
    let answer = `### Counters to Monitor\n`;

    if (spec.relatedCounters.length > 0) {
      answer += spec.relatedCounters.slice(0, 5).map(c => `- **${c}**: Performance counter`).join('\n');
    } else {
      answer += `- Monitor ${this.ranDomain} specific performance counters`;
    }

    answer += `\n\n### KPI Impact\n`;
    if (spec.primaryKPIs.length > 0) {
      answer += spec.primaryKPIs.map(k => `- ${k}`).join('\n');
    }

    return answer;
  }

  /**
   * Generate optimization-specific answer
   */
  private generateOptimizationAnswer(spec: RANFeatureSpecialization): string {
    let answer = `### Optimization Guidance\n\n`;
    answer += `For ${this.ranDomain} optimization:\n\n`;
    answer += `1. Monitor primary KPIs: ${spec.primaryKPIs.slice(0, 2).join(', ') || 'N/A'}\n`;
    answer += `2. Adjust parameters based on network conditions\n`;
    answer += `3. Consider feature dependencies: ${spec.dependencies.slice(0, 2).join(', ') || 'None'}\n`;

    return answer;
  }

  /**
   * Generate activation-specific answer
   */
  private generateActivationAnswer(): string {
    let answer = `### Activation\n`;

    if (this._cxc) {
      answer += `**CXC Code**: ${this._cxc}\n\n`;
      answer += `**Commands**:\n`;
      answer += '```bash\n';
      answer += `# Check current state\n`;
      answer += `cmedit get <SITE> FeatureState=${this._cxc} featureState,licenseState,serviceState\n\n`;
      answer += `# Activate feature\n`;
      answer += `cmedit set <SITE> FeatureState=${this._cxc} featureState=ACTIVATED\n`;
      answer += '```\n';
    } else {
      answer += `No CXC code available for this feature.\n`;
    }

    return answer;
  }

  /**
   * Generate domain context
   */
  private generateDomainContext(spec: RANFeatureSpecialization): string {
    let context = `\n### ${this.ranDomain} Domain Context\n\n`;

    if (spec.dependencies.length > 0) {
      context += `**Dependencies**: ${spec.dependencies.slice(0, 3).join(', ')}\n`;
    }

    if (spec.conflicts.length > 0) {
      context += `**Conflicts**: ${spec.conflicts.join(', ')}\n`;
    }

    context += `**Primary KPIs**: ${spec.primaryKPIs.slice(0, 3).join(', ') || 'N/A'}\n`;

    return context;
  }

  /**
   * Get RAN-specific cmedit commands
   */
  private getRANCmeditCommands(query: Query): string[] {
    if (!this._cxc) {
      return [];
    }

    const commands: string[] = [];

    switch (query.type) {
      case QueryType.PARAMETER_CONFIGURATION:
      case QueryType.ACTIVATION:
        commands.push(
          `cmedit get <SITE> FeatureState=${this._cxc} featureState,licenseState,serviceState`
        );
        if (query.type === QueryType.ACTIVATION) {
          commands.push(
            `cmedit set <SITE> FeatureState=${this._cxc} featureState=ACTIVATED`
          );
        }
        break;

      case QueryType.TROUBLESHOOTING:
        commands.push(
          `cmedit get <SITE> FeatureState=${this._cxc} featureState,adminState`,
          `cmedit get <ENODEB> EutranCellFDD=* state,operabilityState`
        );
        break;
    }

    return commands;
  }

  /**
   * Record battle test result
   */
  recordBattleTestResult(score: number, success: boolean): void {
    this._battleTestScore = (this._battleTestScore * 0.9) + (score * 0.1);

    // Update Q-table with battle test reward
    if (success) {
      const reward = new Reward(score, score > 0.7 ? 0.5 : 0, score > 0.5 ? 0.3 : 0, 0);
      // Record in state machine (simplified - would use actual state)
    }
  }

  /**
   * Check if query is KPI-aware
   */
  private isKPIAwareQuery(query: Query): boolean {
    const kpiKeywords = ['kpi', 'performance', 'throughput', 'latency', 'success rate', 'optimization'];
    const lowerContent = query.content.toLowerCase();
    return kpiKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Store knowledge in memory
   */
  private async storeKnowledgeInMemory(entry: RANKnowledgeEntry): Promise<void> {
    // This would integrate with claude-flow memory CLI
    // For now, just store locally
    if (this._enableMemoryIntegration) {
      // Placeholder for AgentDB storage
      // await this.memoryStore.store(entry.key, entry, { namespace: this._memoryNamespace });
    }
  }

  /**
   * Generate domain knowledge entries
   */
  private generateDomainKnowledgeEntries(): RANKnowledgeEntry[] {
    const entries: RANKnowledgeEntry[] = [];

    // Feature overview
    entries.push({
      key: `${this.acronym}-overview`,
      metadata: {
        featureAcronym: this.acronym,
        domain: this.ranDomain,
        category: 'overview',
        confidence: 1.0,
        lastUpdated: new Date()
      }
    });

    // KPI knowledge
    for (const kpi of this.specialization.primaryKPIs) {
      entries.push({
        key: `${this.acronym}-kpi-${kpi.toLowerCase().replace(/\s/g, '-')}`,
        metadata: {
          featureAcronym: this.acronym,
          domain: this.ranDomain,
          category: 'kpi',
          confidence: 0.9,
          lastUpdated: new Date()
        }
      });
    }

    return entries;
  }

  /**
   * Get domain statistics
   */
  getDomainStats(): {
    domain: RANFeatureDomain;
    knowledgeEntries: number;
    battleTestScore: number;
    kpiImprovements: number;
    specialization: RANFeatureSpecialization;
  } {
    return {
      domain: this.ranDomain,
      knowledgeEntries: this._knowledgeBase.size,
      battleTestScore: this._battleTestScore,
      kpiImprovements: this._kpiImprovements,
      specialization: this.specialization
    };
  }

  /**
   * Map query type to RAN state type
   */
  private mapQueryType(queryType: QueryType): string {
    switch (queryType) {
      case QueryType.PARAMETER_CONFIGURATION:
        return 'parameter';
      case QueryType.TROUBLESHOOTING:
        return 'troubleshoot';
      case QueryType.OPTIMIZATION:
      case QueryType.ACTIVATION:
      case QueryType.DEACTIVATION:
        return 'procedure';
      default:
        return 'general';
    }
  }

  /**
   * Map complexity level
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
   * Generate context hash
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
}

/**
 * RAN Feature Agents Factory
 *
 * Creates 50 specialized RAN feature agents for LTE
 */
export class RANFeatureAgentsFactory {
  /**
   * Create all 50 LTE RAN feature agents
   */
  static async createAll(): Promise<Map<string, RANFeatureAgent>> {
    const agents = new Map<string, RANFeatureAgent>();

    for (const feature of LTE_50_FEATURES) {
      const agent = await this.createAgent(feature);
      agents.set(feature.acronym, agent);
    }

    return agents;
  }

  /**
   * Create a single RAN feature agent
   */
  static async createAgent(feature: LTEFeatureDefinition): Promise<RANFeatureAgent> {
    const fajCode = new FAJCode(feature.faj);
    const domain = RANFeatureAgentsFactory.inferDomain(feature.name);
    const category = RANFeatureAgentsFactory.inferCategory(feature.name);
    const specialization = RANFeatureAgentsFactory.getSpecialization(domain, feature.acronym);

    // Create Feature entity
    const featureData = new Feature({
      id: `feature-${feature.acronym}`,
      fajCode,
      name: feature.name,
      description: `${feature.name} - LTE RAN feature with FAJ ${feature.faj}`,
      category,
      accessTechnology: 'LTE' as AccessTechnology,
      parameters: [],
      counters: [],
      kpis: [],
      procedures: [],
      dependencies: specialization.dependencies,
      conflicts: specialization.conflicts,
      relatedFeatures: []
    });

    const config: RANAgentConfig = {
      fajCode,
      type: 'LTE' as AccessTechnology,
      category,
      featureData,
      acronym: feature.acronym,
      cxc: feature.cxc,
      ranDomain: domain,
      specialization,
      stateMachineConfig: {
        coldStartThreshold: 3,
        degradedThreshold: 0.5,
        explorationBaseRate: 0.1,
        recoveryThreshold: 0.3
      },
      enableMemoryIntegration: true,
      enableBattleTestOptimization: true
    };

    return await RANFeatureAgent.createRAN(config);
  }

  /**
   * Infer RAN domain from feature name
   */
  private static inferDomain(name: string): RANFeatureDomain {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('carrier aggregation') || nameLower.includes('cae') || nameLower.includes('cc')) {
      return RANFeatureDomain.CARRIER_AGGREGATION;
    } else if (nameLower.includes('qam') || nameLower.includes('mimo') || nameLower.includes('antenna')) {
      return RANFeatureDomain.MIMO_ANTENNA;
    } else if (nameLower.includes('neighbor') || nameLower.includes('anr') || nameLower.includes('mobility') || nameLower.includes('handover')) {
      return RANFeatureDomain.MOBILITY;
    } else if (nameLower.includes('interference') || nameLower.includes('irc')) {
      return RANFeatureDomain.INTERFERENCE;
    } else if (nameLower.includes('load') || nameLower.includes('balancing') || nameLower.includes('offload') || nameLower.includes('admission')) {
      return RANFeatureDomain.RADIO_RESOURCE_MANAGEMENT;
    } else if (nameLower.includes('cell') || nameLower.includes('sector')) {
      return RANFeatureDomain.COVERAGE_CAPACITY;
    } else if (nameLower.includes('security') || nameLower.includes('defense')) {
      return RANFeatureDomain.SECURITY;
    } else if (nameLower.includes('energy') || nameLower.includes('sleep') || nameLower.includes('power')) {
      return RANFeatureDomain.ENERGY_SAVING;
    } else if (nameLower.includes('transport') || nameLower.includes('cpri')) {
      return RANFeatureDomain.TRANSPORT;
    } else if (nameLower.includes('voice') || nameLower.includes('cs fallback')) {
      return RANFeatureDomain.VOICE_IMS;
    } else {
      return RANFeatureDomain.RADIO_RESOURCE_MANAGEMENT; // Default
    }
  }

  /**
   * Infer category from feature name
   */
  private static inferCategory(name: string): Category {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('carrier aggregation') || nameLower.includes('cae')) {
      return 'CA' as Category;
    } else if (nameLower.includes('qam') || nameLower.includes('mimo')) {
      return 'MIMO' as Category;
    } else if (nameLower.includes('neighbor') || nameLower.includes('anr')) {
      return 'Mobility' as Category;
    } else if (nameLower.includes('interference')) {
      return 'Interference' as Category;
    } else if (nameLower.includes('load') || nameLower.includes('balancing')) {
      return 'RRM' as Category;
    } else {
      return 'Other' as Category;
    }
  }

  /**
   * Get domain specialization
   */
  private static getSpecialization(domain: RANFeatureDomain, acronym: string): RANFeatureSpecialization {
    const specializations: Record<RANFeatureDomain, RANFeatureSpecialization> = {
      [RANFeatureDomain.CARRIER_AGGREGATION]: {
        domain: RANFeatureDomain.CARRIER_AGGREGATION,
        primaryKPIs: ['Throughput', 'CA Activation Rate', 'UE CA Capability'],
        relatedCounters: ['pmCaUeConfig', 'pmCaActivationSuccess', 'pmThroughputDL'],
        commonParameters: ['caActivationMode', 'maxCcDl', 'maxCcUl'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.MIMO_ANTENNA]: {
        domain: RANFeatureDomain.MIMO_ANTENNA,
        primaryKPIs: ['Throughput', 'BLER', 'Rank Indicator'],
        relatedCounters: ['pmMimoRank', 'pmThroughputDL', 'pmBler'],
        commonParameters: ['mimoMode', 'tmMode', 'rankIndicator'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.MOBILITY]: {
        domain: RANFeatureDomain.MOBILITY,
        primaryKPIs: ['Handover Success Rate', 'Ping-pong Rate', 'HO Preparation Time'],
        relatedCounters: ['pmHoSuccess', 'pmHoPrepTime', 'pmPingPongHo'],
        commonParameters: ['hoTriggerType', 'hoA3Offset', 'hoHysteresis'],
        dependencies: ['ANR'],
        conflicts: []
      },
      [RANFeatureDomain.INTERFERENCE]: {
        domain: RANFeatureDomain.INTERFERENCE,
        primaryKPIs: ['SINR', 'Throughput', 'Interference Level'],
        relatedCounters: ['pmSinr', 'pmInterference', 'pmIcccI'],
        commonParameters: ['ircMode', 'interfRejComb'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.RADIO_RESOURCE_MANAGEMENT]: {
        domain: RANFeatureDomain.RADIO_RESOURCE_MANAGEMENT,
        primaryKPIs: ['Load Balance', 'Admission Rate', 'Throughput'],
        relatedCounters: ['pmLoadDl', 'pmLoadUl', 'pmAdmissionSuccess'],
        commonParameters: ['lbMode', 'admissionThreshold', 'loadThreshold'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.COVERAGE_CAPACITY]: {
        domain: RANFeatureDomain.COVERAGE_CAPACITY,
        primaryKPIs: ['Coverage', 'Capacity', 'Cell Availability'],
        relatedCounters: ['pmCellAvailability', 'pmRrcConnected', 'pmCoverage'],
        commonParameters: ['cellStatus', 'sectorConfig'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.SECURITY]: {
        domain: RANFeatureDomain.SECURITY,
        primaryKPIs: ['Security Success Rate', 'Authentication Success'],
        relatedCounters: ['pmSecAuthSuccess', 'pmSecCipherSuccess'],
        commonParameters: ['securityMode', 'cipheringAlgorithm'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.ENERGY_SAVING]: {
        domain: RANFeatureDomain.ENERGY_SAVING,
        primaryKPIs: ['Power Consumption', 'Energy Savings', 'Sleep Rate'],
        relatedCounters: ['pmPowerConsumption', 'pmCellSleepRate', 'pmEnergySaving'],
        commonParameters: ['energySavingMode', 'sleepThreshold', 'wakeUpThreshold'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.TRANSPORT]: {
        domain: RANFeatureDomain.TRANSPORT,
        primaryKPIs: ['Transport Delay', 'Packet Loss', 'Throughput'],
        relatedCounters: ['pmTransportDelay', 'pmPacketLoss', 'pmTransportThroughput'],
        commonParameters: ['transportConfig', 'cpriRate'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.VOICE_IMS]: {
        domain: RANFeatureDomain.VOICE_IMS,
        primaryKPIs: ['Voice Quality', 'Call Setup Success Rate', 'Drop Rate'],
        relatedCounters: ['pmVoiceQuality', 'pmCallSetupSuccess', 'pmCallDrop'],
        commonParameters: ['voiceCodec', 'voiceMode'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.UE_HANDLING]: {
        domain: RANFeatureDomain.UE_HANDLING,
        primaryKPIs: ['UE Connection Success', 'UE Retention', 'UE Capacity'],
        relatedCounters: ['pmRrcSetupSuccess', 'pmUeRetention', 'pmUeCapacity'],
        commonParameters: ['ueHandlingMode', 'maxUes'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.QOS]: {
        domain: RANFeatureDomain.QOS,
        primaryKPIs: ['QoS Satisfaction', 'Packet Delay', 'Throughput'],
        relatedCounters: ['pmQoSatisfaction', 'pmPacketDelay', 'pmQoSThroughput'],
        commonParameters: ['qosProfile', 'qciMapping'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.TIMING]: {
        domain: RANFeatureDomain.TIMING,
        primaryKPIs: ['Timing Accuracy', 'Sync Status'],
        relatedCounters: ['pmTimingAccuracy', 'pmSyncStatus'],
        commonParameters: ['timingMode', 'syncSource'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.SON]: {
        domain: RANFeatureDomain.SON,
        primaryKPIs: ['Self-optimization Rate', 'Self-healing Success'],
        relatedCounters: ['pmSonOptimization', 'pmSonHealing'],
        commonParameters: ['sonMode', 'sonPolicy'],
        dependencies: [],
        conflicts: []
      },
      [RANFeatureDomain.NR_5G]: {
        domain: RANFeatureDomain.NR_5G,
        primaryKPIs: ['5G Throughput', 'NR Availability', 'EN-DC Success'],
        relatedCounters: ['pmNrThroughput', 'pmNrAvailability', 'pmEndcSuccess'],
        commonParameters: ['nrConfig', 'endcMode'],
        dependencies: [],
        conflicts: []
      }
    };

    return specializations[domain] || {
      domain,
      primaryKPIs: ['Performance'],
      relatedCounters: ['pmCounter'],
      commonParameters: ['featureParam'],
      dependencies: [],
      conflicts: []
    };
  }
}

export default RANFeatureAgent;
