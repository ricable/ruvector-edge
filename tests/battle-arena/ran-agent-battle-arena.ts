/**
 * RAN Agent Battle Test Arena
 *
 * Comprehensive testing framework for 50 specialized RAN feature agents.
 * Tests autonomous state machine, OODA loop, Q-learning, and DDD compliance.
 *
 * @module tests/battle-arena/ran-agent-battle-arena
 */

import { EnhancedFeatureAgent, LTEFeatureAgentsFactory, Query, QueryType, ComplexityLevel } from '../../src/domains/knowledge/aggregates/enhanced-feature-agent';
import { AgentState } from '../../src/domains/intelligence/aggregates/autonomous-state-machine';
import { Action } from '../../src/domains/intelligence/value-objects/action';

/**
 * Test Question for Battle Arena
 */
export interface TestQuestion {
  readonly id: number;
  readonly question: string;
  readonly targetAcronym: string;
  readonly queryType: QueryType;
  readonly complexity: ComplexityLevel;
  readonly expectedKeywords: string[];
}

/**
 * Battle Test Result
 */
export interface BattleTestResult {
  readonly agentAcronym: string;
  readonly questionId: number;
  readonly question: string;
  readonly responseTime: number;
  readonly confidence: number;
  readonly actionTaken: Action;
  readonly stateAtResponse: AgentState;
  readonly containsExpectedKeywords: boolean;
  readonly oodaPhaseCompleted: boolean;
  readonly score: number;
  readonly timestamp: Date;
}

/**
 * Agent Performance Statistics
 */
export interface AgentPerformanceStats {
  readonly acronym: string;
  readonly featureName: string;
  readonly totalQueries: number;
  readonly correctAnswers: number;
  readonly accuracy: number;
  readonly averageResponseTime: number;
  readonly averageConfidence: number;
  readonly stateTransitions: number;
  readonly oodaExecutions: number;
  readonly finalState: AgentState;
  readonly finalHealth: number;
  readonly coldStartCompleted: boolean;
}

/**
 * Arena Configuration
 */
export interface BattleArenaConfig {
  readonly agents: Map<string, EnhancedFeatureAgent>;
  readonly questions: TestQuestion[];
  readonly parallelTests: number;
  readonly timeoutMs: number;
}

/**
 * 50 Battle Test Questions for RAN Feature Agents
 */
const BATTLE_QUESTIONS: TestQuestion[] = [
  // Cell Capacity & Configuration (1-5)
  { id: 1, question: 'How do I configure an eNodeB to support 18 cells with proper PUCCH resource allocation?', targetAcronym: '11CS', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['PUCCH', '18 cells', 'prerequisites', '6 Cell Support', '7-12 Cell Support'] },
  { id: 2, question: 'What is the procedure to enable 24 cell support? Which additional features must be activated first?', targetAcronym: '12CS', queryType: QueryType.ACTIVATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['6 Cell Support', '13-18 Cell Support', '24 cells', 'prerequisites'] },
  { id: 3, question: 'What are the hardware requirements for 6 cell support? Which parameters need adjustment for PUCCH resources?', targetAcronym: '6CS', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['hardware', 'PUCCH', '6 cells', 'parameters'] },
  { id: 4, question: 'How does 7-12 cell support differ from 6 cell support in terms of capacity and configuration?', targetAcronym: '71CS', queryType: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['capacity', 'configuration', 'difference', '6 cells', '12 cells'] },
  { id: 5, question: 'What are the bandwidth implications of using 5+5 MHz sector carriers?', targetAcronym: '5MSC', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['bandwidth', '5+5 MHz', 'sector carrier', 'throughput'] },

  // Modulation & Throughput (6-10)
  { id: 6, question: 'Under what conditions should 256-QAM downlink be enabled? What CQI thresholds trigger 256-QAM modulation?', targetAcronym: '2QD', queryType: QueryType.OPTIMIZATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['CQI', 'SINR', '256-QAM', 'threshold', 'throughput'] },
  { id: 7, question: 'What are the SINR requirements for 256-QAM uplink? How does UE capability affect this?', targetAcronym: '2QU', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['SINR', 'UE capability', '256-QAM uplink', 'requirements'] },
  { id: 8, question: 'When should the network fall back from 256-QAM to 64-QAM? What are the performance impacts?', targetAcronym: '6QD', queryType: QueryType.OPTIMIZATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['fallback', '64-QAM', '256-QAM', 'performance', 'SINR'] },
  { id: 9, question: 'What parameters control 64-QAM uplink activation? How does power headroom affect modulation?', targetAcronym: '6QU', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['parameters', 'power headroom', '64-QAM uplink', 'modulation'] },
  { id: 10, question: 'What is the fallback mechanism when 64-QAM uplink cannot be maintained?', targetAcronym: '1QU', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['16-QAM', 'fallback', 'edge users', 'uplink'] },

  // Carrier Aggregation (11-15)
  { id: 11, question: 'What are the inter-band CA combinations supported for 3CC? What are the UE category requirements?', targetAcronym: '3DCAE', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['3CC', 'CA', 'inter-band', 'UE category', 'combinations'] },
  { id: 12, question: 'How does 4CC CA impact baseband processing? What are the license implications?', targetAcronym: '4DCAE', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['4CC', 'baseband', 'license', 'processing', 'CA'] },
  { id: 13, question: 'What is the maximum throughput achievable with 5CC CA? Which UE categories support this?', targetAcronym: '5DCAE', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['5CC', 'throughput', 'UE category', 'CA'] },
  { id: 14, question: 'What are the power constraints when activating 6CC CA? How does SCC management work?', targetAcronym: '6DCAE', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['6CC', 'power', 'SCC', 'CA', 'constraints'] },
  { id: 15, question: 'What is the procedure to activate 7CC CA? What are the fallback mechanisms?', targetAcronym: '7DCAE', queryType: QueryType.ACTIVATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['7CC', 'activation', 'fallback', 'CA', 'procedure'] },

  // MIMO & Antenna (16-20)
  { id: 16, question: 'How does 4x2 MIMO differ from 4x4 in terms of beamforming capabilities?', targetAcronym: '4QADPP', queryType: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['4x2', '4x4', 'MIMO', 'beamforming', 'difference'] },
  { id: 17, question: 'What are the channel state information requirements for 4x4 MIMO? How does rank adaptation work?', targetAcronym: '4QADPP2', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['4x4', 'MIMO', 'CSI', 'rank', 'adaptation'] },
  { id: 18, question: 'What interference scenarios benefit most from 4x4 IRC? How does it differ from standard IRC?', targetAcronym: '4FIRC', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['4x4', 'IRC', 'interference', 'scenarios'] },
  { id: 19, question: 'What alarms does ASM generate? How does it detect antenna faults?', targetAcronym: 'ASM', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['alarms', 'antenna', 'faults', 'ASM', 'detection'] },
  { id: 20, question: 'What is the impact of CRS power adjustments on cell edge performance?', targetAcronym: 'ACP', queryType: QueryType.OPTIMIZATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['CRS', 'power', 'cell edge', 'performance', 'adjustments'] },

  // Load Balancing & Offload (21-25)
  { id: 21, question: 'What KPIs trigger ATO? How does it differ from MLB?', targetAcronym: 'ATO', queryType: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['ATO', 'MLB', 'KPI', 'load balancing', 'difference'] },
  { id: 22, question: 'What is the acceleration factor in AIFLB compared to standard IFLB?', targetAcronym: 'AIFLB', queryType: QueryType.COMPARISON, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['AIFLB', 'IFLB', 'acceleration', 'factor'] },
  { id: 23, question: 'What are the thresholds for BLM activation? How does it handle cell edge users?', targetAcronym: 'BLM', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['BLM', 'thresholds', 'cell edge', 'activation'] },
  { id: 24, question: 'How does BNRILLM select target cells for load balancing?', targetAcronym: 'BNRILLM', queryType: QueryType.OPTIMIZATION, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['BNRILLM', 'target cells', 'load balancing', 'selection'] },
  { id: 25, question: 'How does BRCP prioritize cells during baseband resource constraints?', targetAcronym: 'BRCP', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['BRCP', 'prioritization', 'baseband', 'resources'] },

  // AI & Machine Learning (26-30)
  { id: 26, question: 'What ML algorithms does APACS use for cell supervision?', targetAcronym: 'APACS', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['APACS', 'ML', 'algorithms', 'cell supervision'] },
  { id: 27, question: 'How does APDLA improve over traditional link adaptation?', targetAcronym: 'APDLA', queryType: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['APDLA', 'link adaptation', 'traditional', 'improvement'] },
  { id: 28, question: 'What performance improvements does APP provide?', targetAcronym: 'APP', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['APP', 'performance', 'improvements', 'ASGH'] },
  { id: 29, question: 'How do I configure A/B testing framework for parameter optimization?', targetAcronym: 'ABATF', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['A/B testing', 'ABATF', 'optimization', 'configuration'] },
  { id: 30, question: 'What are the prescheduling criteria in ABP?', targetAcronym: 'ABP', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['ABP', 'prescheduling', 'criteria', 'latency'] },

  // Advanced Features (31-35)
  { id: 31, question: 'What are the default admission thresholds? How do they vary by QCI?', targetAcronym: 'BAC', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['admission', 'thresholds', 'QCI', 'BAC'] },
  { id: 32, question: 'What scenarios trigger DUAC? How does it affect uplink interference?', targetAcronym: 'ATO', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['DUAC', 'uplink', 'interference', 'trigger'] },
  { id: 33, question: 'How does ADRFS differentiate between QCI classes for scheduling?', targetAcronym: 'ADRFS', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['ADRFS', 'QCI', 'scheduling', 'priority'] },
  { id: 34, question: 'How do I configure privileged user groups? What QCI mappings are supported?', targetAcronym: 'ASAPAU', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['privileged', 'QCI', 'ASAPAU', 'configuration'] },
  { id: 35, question: 'What metrics does ACCE use for capacity estimation?', targetAcronym: 'ACCE', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['ACCE', 'capacity', 'metrics', 'estimation'] },

  // Neighbor Relations & Mobility (36-40)
  { id: 36, question: 'What are the ANR discovery mechanisms? How does it handle PCI conflicts?', targetAcronym: 'ANR', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['ANR', 'discovery', 'PCI', 'conflicts'] },
  { id: 37, question: 'How does ARRSA allocate RACH sequences?', targetAcronym: 'ARRSA', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['ARRSA', 'RACH', 'sequences', 'allocation'] },
  { id: 38, question: 'What are the SCell activation/deactivation timers?', targetAcronym: 'ASM2', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['SCell', 'activation', 'deactivation', 'timers'] },
  { id: 39, question: 'What is the procedure for CS fallback in dual-radio UEs?', targetAcronym: 'CFDRU', queryType: QueryType.ACTIVATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['CS fallback', 'dual-radio', 'voice', 'procedure'] },
  { id: 40, question: 'What are the positioning accuracy requirements for GUPLS?', targetAcronym: 'GUPLS', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['GUPLS', 'positioning', 'accuracy', 'A-GPS'] },

  // Specialized Features (41-45)
  { id: 41, question: 'How does AI-powered ACS differ from traditional ACS?', targetAcronym: 'APACS', queryType: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['AI', 'ACS', 'traditional', 'difference'] },
  { id: 42, question: 'What QCIs are supported in AQRE?', targetAcronym: 'AQRE', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE, expectedKeywords: ['AQRE', 'QCI', 'range', 'supported'] },
  { id: 43, question: 'What spectral efficiency improvements does ABSEP provide?', targetAcronym: 'ABSEP', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['ABSEP', 'spectral', 'efficiency', 'improvements'] },
  { id: 44, question: 'What conditions trigger RLC poll adaptation?', targetAcronym: 'ARPR', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['ARPR', 'RLC', 'poll', 'adaptation'] },
  { id: 45, question: 'What atmospheric conditions cause ducting interference?', targetAcronym: 'ADIR', queryType: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['ADIR', 'atmospheric', 'ducting', 'interference'] },

  // Advanced Testing (46-50)
  { id: 46, question: 'How is AILG used for testing? What load patterns can it generate?', targetAcronym: 'AILG', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['AILG', 'testing', 'load', 'patterns'] },
  { id: 47, question: 'How does ALBS configure broadcast subframes?', targetAcronym: 'ALBS', queryType: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['ALBS', 'broadcast', 'subframes', 'MBMS'] },
  { id: 48, question: 'What security threats does ARD address?', targetAcronym: 'ARD', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['ARD', 'security', 'threats', 'detection'] },
  { id: 49, question: 'What is the ASGH framework architecture?', targetAcronym: 'AF', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX, expectedKeywords: ['ASGH', 'framework', 'architecture', 'scheduling'] },
  { id: 50, question: 'What performance metrics does CLO provide for capacity planning?', targetAcronym: 'CLO', queryType: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE, expectedKeywords: ['CLO', 'CPRI', 'metrics', 'capacity', 'planning'] }
];

/**
 * RAN Agent Battle Arena
 *
 * Runs comprehensive tests on 50 RAN feature agents including:
 * - State machine transitions
 * - OODA loop execution
 * - Q-learning action selection
 * - Response accuracy and quality
 * - Performance metrics
 */
export class RANAgentBattleArena {
  private readonly agents: Map<string, EnhancedFeatureAgent>;
  private readonly questions: TestQuestion[];
  private readonly results: BattleTestResult[];
  private readonly config: BattleArenaConfig;

  constructor(config?: Partial<BattleArenaConfig>) {
    // Create all 50 LTE feature agents
    this.agents = config?.agents ?? LTEFeatureAgentsFactory.createAll();

    // Use battle questions
    this.questions = config?.questions ?? BATTLE_QUESTIONS;

    this.results = [];
    this.config = {
      agents: this.agents,
      questions: this.questions,
      parallelTests: config?.parallelTests ?? 5,
      timeoutMs: config?.timeoutMs ?? 30000
    };
  }

  /**
   * Run all battle tests
   */
  async runAllTests(): Promise<{
    results: BattleTestResult[];
    statistics: Map<string, AgentPerformanceStats>;
    summary: BattleTestSummary;
  }> {
    console.log(`\n========================================`);
    console.log(`RAN AGENT BATTLE ARENA - 50 AGENTS`);
    console.log(`========================================`);
    console.log(`Agents: ${this.agents.size}`);
    console.log(`Questions: ${this.questions.length}`);
    console.log(`Parallel Tests: ${this.config.parallelTests}`);
    console.log(`========================================\n`);

    // Initialize all agents
    await this.initializeAgents();

    // Run tests
    for (const question of this.questions) {
      const result = await this.runSingleTest(question);
      this.results.push(result);
    }

    // Compute statistics
    const statistics = this.computeStatistics();

    // Generate summary
    const summary = this.generateSummary(statistics);

    return { results: this.results, statistics, summary };
  }

  /**
   * Initialize all agents
   */
  private async initializeAgents(): Promise<void> {
    console.log('Initializing agents...');

    let initialized = 0;
    for (const [acronym, agent] of this.agents) {
      await agent.initialize();
      initialized++;

      if (initialized % 10 === 0) {
        console.log(`  Initialized ${initialized}/${this.agents.size} agents`);
      }
    }

    console.log(`✓ All ${this.agents.size} agents initialized\n`);
  }

  /**
   * Run single test question
   */
  private async runSingleTest(question: TestQuestion): Promise<BattleTestResult> {
    const agent = this.agents.get(question.targetAcronym);

    if (!agent) {
      throw new Error(`Agent not found for acronym: ${question.targetAcronym}`);
    }

    const startTime = Date.now();

    // Create query
    const query: Query = {
      id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: question.queryType,
      content: question.question,
      complexity: question.complexity,
      timestamp: new Date()
    };

    // Get state before query
    const stateBefore = agent.stateMachine.currentState;

    // Handle query
    const response = await agent.handleQueryEnhanced(query);

    // Check if expected keywords are in response
    const containsExpectedKeywords = question.expectedKeywords.some(keyword =>
      response.content.toLowerCase().includes(keyword.toLowerCase())
    );

    // Calculate score
    const score = this.calculateTestScore(response, containsExpectedKeywords);

    return {
      agentAcronym: question.targetAcronym,
      questionId: question.id,
      question: question.question,
      responseTime: response.latencyMs,
      confidence: response.confidence,
      actionTaken: response.actionTaken,
      stateAtResponse: response.stateAtResponse,
      containsExpectedKeywords,
      oodaPhaseCompleted: stateBefore !== AgentState.INITIALIZING,
      score,
      timestamp: new Date()
    };
  }

  /**
   * Calculate test score
   */
  private calculateTestScore(
    response: { confidence: number; latencyMs: number },
    containsKeywords: boolean
  ): number {
    let score = 0;

    // Confidence score (0-40 points)
    score += response.confidence * 40;

    // Keyword match (0-30 points)
    if (containsKeywords) {
      score += 30;
    }

    // Latency score (0-30 points, optimal < 500ms)
    const latencyScore = Math.max(0, 30 - (response.latencyMs / 500) * 30);
    score += latencyScore;

    return Math.round(score * 100) / 100;
  }

  /**
   * Compute statistics for each agent
   */
  private computeStatistics(): Map<string, AgentPerformanceStats> {
    const statistics = new Map<string, AgentPerformanceStats>();

    for (const [acronym, agent] of this.agents) {
      const agentResults = this.results.filter(r => r.agentAcronym === acronym);

      if (agentResults.length === 0) continue;

      const correctAnswers = agentResults.filter(r => r.containsExpectedKeywords).length;
      const avgResponseTime = agentResults.reduce((sum, r) => sum + r.responseTime, 0) / agentResults.length;
      const avgConfidence = agentResults.reduce((sum, r) => sum + r.confidence, 0) / agentResults.length;
      const avgScore = agentResults.reduce((sum, r) => sum + r.score, 0) / agentResults.length;

      const smStats = agent.stateMachine.getStateMachineStats();

      statistics.set(acronym, {
        acronym,
        featureName: agent.featureData.name,
        totalQueries: agentResults.length,
        correctAnswers,
        accuracy: correctAnswers / agentResults.length,
        averageResponseTime: avgResponseTime,
        averageConfidence: avgConfidence,
        stateTransitions: smStats.interactionCount,
        oodaExecutions: smStats.oodaExecutions,
        finalState: smStats.state,
        finalHealth: smStats.health,
        coldStartCompleted: smStats.interactionCount >= 100
      });
    }

    return statistics;
  }

  /**
   * Generate battle test summary
   */
  private generateSummary(statistics: Map<string, AgentPerformanceStats>): BattleTestSummary {
    const allResults = this.results;
    const allStats = Array.from(statistics.values());

    const totalTests = allResults.length;
    const totalCorrect = allResults.filter(r => r.containsExpectedKeywords).length;
    const averageScore = allResults.reduce((sum, r) => sum + r.score, 0) / totalTests;
    const averageResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    const averageConfidence = allResults.reduce((sum, r) => sum + r.confidence, 0) / totalTests;

    // State distribution
    const stateDistribution = new Map<AgentState, number>();
    for (const stats of allStats) {
      const count = stateDistribution.get(stats.finalState) ?? 0;
      stateDistribution.set(stats.finalState, count + 1);
    }

    // Top performers
    const topPerformers = allStats
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 10);

    // Action distribution
    const actionDistribution = new Map<Action, number>();
    for (const result of allResults) {
      const count = actionDistribution.get(result.actionTaken) ?? 0;
      actionDistribution.set(result.actionTaken, count + 1);
    }

    return {
      totalTests,
      totalAgents: this.agents.size,
      overallAccuracy: totalCorrect / totalTests,
      averageScore,
      averageResponseTime,
      averageConfidence,
      stateDistribution,
      actionDistribution,
      topPerformers,
      timestamp: new Date()
    };
  }

  /**
   * Print test results
   */
  printResults(summary: BattleTestSummary, statistics: Map<string, AgentPerformanceStats>): void {
    console.log('\n========================================');
    console.log('BATTLE TEST RESULTS');
    console.log('========================================\n');

    console.log('Overall Statistics:');
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Total Agents: ${summary.totalAgents}`);
    console.log(`  Overall Accuracy: ${(summary.overallAccuracy * 100).toFixed(1)}%`);
    console.log(`  Average Score: ${summary.averageScore.toFixed(1)}/100`);
    console.log(`  Average Response Time: ${summary.averageResponseTime.toFixed(0)}ms`);
    console.log(`  Average Confidence: ${(summary.averageConfidence * 100).toFixed(1)}%`);

    console.log('\nState Distribution:');
    for (const [state, count] of summary.stateDistribution) {
      console.log(`  ${state}: ${count} agents`);
    }

    console.log('\nAction Distribution:');
    for (const [action, count] of summary.actionDistribution) {
      console.log(`  ${action.type}: ${count} times`);
    }

    console.log('\nTop 10 Performers:');
    for (const performer of summary.topPerformers) {
      console.log(`  ${performer.acronym}: ${(performer.accuracy * 100).toFixed(1)}% accuracy, ${performer.averageConfidence.toFixed(2)} confidence`);
    }

    console.log('\n========================================\n');
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      results: this.results,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Get agents by state
   */
  getAgentsByState(): Map<AgentState, string[]> {
    const byState = new Map<AgentState, string[]>();

    for (const [acronym, agent] of this.agents) {
      const state = agent.stateMachine.currentState;
      const agents = byState.get(state) ?? [];
      agents.push(acronym);
      byState.set(state, agents);
    }

    return byState;
  }

  /**
   * Get cold start agents
   */
  getColdStartAgents(): string[] {
    const coldStart: string[] = [];

    for (const [acronym, agent] of this.agents) {
      if (agent.stateMachine.currentState === AgentState.COLD_START) {
        coldStart.push(acronym);
      }
    }

    return coldStart;
  }

  /**
   * Get ready agents
   */
  getReadyAgents(): string[] {
    const ready: string[] = [];

    for (const [acronym, agent] of this.agents) {
      if (agent.stateMachine.currentState === AgentState.READY) {
        ready.push(acronym);
      }
    }

    return ready;
  }
}

/**
 * Battle Test Summary
 */
export interface BattleTestSummary {
  readonly totalTests: number;
  readonly totalAgents: number;
  readonly overallAccuracy: number;
  readonly averageScore: number;
  readonly averageResponseTime: number;
  readonly averageConfidence: number;
  readonly stateDistribution: Map<AgentState, number>;
  readonly actionDistribution: Map<Action, number>;
  readonly topPerformers: AgentPerformanceStats[];
  readonly timestamp: Date;
}

/**
 * Run battle tests from command line
 */
export async function runBattleTests(): Promise<void> {
  const arena = new RANAgentBattleArena({
    parallelTests: 5,
    timeoutMs: 30000
  });

  const { statistics, summary } = await arena.runAllTests();

  arena.printResults(summary, statistics);

  // Export results
  const fs = require('fs');
  fs.writeFileSync(
    './battle-test-results.json',
    arena.exportResults(),
    'utf-8'
  );
  console.log('Results exported to: ./battle-test-results.json');
}

// Run if executed directly
if (require.main === module) {
  runBattleTests().catch(console.error);
}

export default RANAgentBattleArena;
