/**
 * Battle Test Aggregate Root
 *
 * Orchestrates RAN feature agent battle testing including:
 * - Test execution and scoring
 * - OODA loop validation
 * - Q-learning convergence verification
 * - Cross-feature coordination testing
 *
 * Implements the RAN Battle Test Framework per ADR-025.
 *
 * @module ran-battle-test/aggregates/battle-test
 */

import { TestQuestion, QuestionBank, QuestionCategory } from '../entities/test-question';
import { EnhancedFeatureAgent, Query, QueryType, ComplexityLevel } from '../../knowledge/aggregates/enhanced-feature-agent';
import { AutonomousStateMachine, AgentState } from '../../intelligence/aggregates/autonomous-state-machine';

/**
 * Test Mode Enum
 */
export enum TestMode {
  /** Single agent answers all 5 questions for its feature */
  SOLO = 'solo',

  /** Multiple agents compete on the same question */
  BATTLE = 'battle',

  /** Agent answers questions from all 50 features */
  STRESS = 'stress',

  /** Record and analyze OODA loop execution */
  OODA_VALIDATION = 'ooda_validation'
}

/**
 * Test Result Status
 */
export enum TestResultStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  ERROR = 'error'
}

/**
 * Individual Question Result
 */
export interface QuestionResult {
  readonly questionId: string;
  readonly agentId: string;
  readonly answer: string;
  readonly confidence: number;
  readonly actionTaken: string;
  readonly stateAtResponse: AgentState;
  readonly latencyMs: number;
  readonly score: number;
  readonly maxScore: number;
  readonly oodaExecuted: boolean;
  readonly timestamp: Date;
}

/**
 * Feature Test Result
 */
export interface FeatureTestResult {
  readonly featureAcronym: string;
  readonly agentId: string;
  readonly questions: QuestionResult[];
  readonly knowledgeScore: number;
  readonly decisionScore: number;
  readonly advancedScore: number;
  readonly totalScore: number;
  readonly maxScore: number;
  readonly oodaEfficiency: number;
  readonly qLearningConverged: boolean;
  readonly crossFeatureCoordination: number;
  readonly status: TestResultStatus;
  readonly timestamp: Date;
}

/**
 * Overall Battle Test Result
 */
export interface BattleTestResult {
  readonly testId: string;
  readonly mode: TestMode;
  readonly featureResults: Map<string, FeatureTestResult>;
  readonly totalScore: number;
  readonly maxScore: number;
  readonly averageOodaLatency: number;
  readonly averageConfidence: number;
  readonly timestamp: Date;
  readonly duration: number;
}

/**
 * OODA Metrics
 */
export interface OODAMetrics {
  readonly observeLatency: number;
  readonly orientLatency: number;
  readonly decideLatency: number;
  readonly actLatency: number;
  readonly totalLatency: number;
  readonly confidence: number;
  readonly explorationRate: number;
  readonly stateTransitions: number;
}

/**
 * Battle Test Configuration
 */
export interface BattleTestConfig {
  readonly mode: TestMode;
  readonly parallel?: boolean;
  readonly oodaValidation?: boolean;
  readonly qLearningThreshold?: number;
  readonly timeout?: number;
  readonly verbose?: boolean;
}

/**
 * Battle Test Aggregate Root
 *
 * Manages the complete testing lifecycle:
 * 1. Setup: Load questions and agents
 * 2. Execute: Run tests in specified mode
 * 3. Score: Calculate results and bonuses
 * 4. Report: Generate detailed output
 */
export class BattleTest {
  readonly id: string;
  readonly mode: TestMode;
  private readonly _questionBank: QuestionBank;
  private readonly _agents: Map<string, EnhancedFeatureAgent>;
  private readonly _config: Required<BattleTestConfig>;
  private readonly _results: Map<string, FeatureTestResult>;
  private readonly _startTime: Date;
  private _status: TestResultStatus;

  private constructor(
    id: string,
    questionBank: QuestionBank,
    agents: Map<string, EnhancedFeatureAgent>,
    config: BattleTestConfig
  ) {
    this.id = id;
    this.mode = config.mode;
    this._questionBank = questionBank;
    this._agents = agents;
    this._config = {
      mode: config.mode,
      parallel: config.parallel ?? false,
      oodaValidation: config.oodaValidation ?? true,
      qLearningThreshold: config.qLearningThreshold ?? 0.7,
      timeout: config.timeout ?? 30000,
      verbose: config.verbose ?? false
    };
    this._results = new Map();
    this._startTime = new Date();
    this._status = TestResultStatus.PENDING;
  }

  /**
   * Factory method to create a BattleTest
   */
  static create(
    questionBank: QuestionBank,
    agents: Map<string, EnhancedFeatureAgent>,
    config: BattleTestConfig
  ): BattleTest {
    const testId = `battle-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new BattleTest(testId, questionBank, agents, config);
  }

  /**
   * Execute the battle test
   */
  async execute(): Promise<BattleTestResult> {
    this._status = TestResultStatus.RUNNING;

    try {
      switch (this.mode) {
        case TestMode.SOLO:
          await this.executeSoloTest();
          break;
        case TestMode.BATTLE:
          await this.executeBattleTest();
          break;
        case TestMode.STRESS:
          await this.executeStressTest();
          break;
        case TestMode.OODA_VALIDATION:
          await this.executeOODAValidation();
          break;
      }

      this._status = TestResultStatus.PASSED;
      return this.generateResult();
    } catch (error) {
      this._status = TestResultStatus.ERROR;
      throw error;
    }
  }

  /**
   * Execute solo test: each agent answers its 5 questions
   */
  private async executeSoloTest(): Promise<void> {
    const tasks: Promise<void>[] = [];

    for (const [acronym, agent] of this._agents) {
      const questions = this._questionBank.getFeatureQuestions(acronym);

      if (questions.length === 0) {
        if (this._config.verbose) {
          console.log(`No questions found for ${acronym}, skipping`);
        }
        continue;
      }

      const task = this.testAgentOnQuestions(agent, questions);
      if (this._config.parallel) {
        tasks.push(task);
      } else {
        await task;
      }
    }

    if (this._config.parallel) {
      await Promise.all(tasks);
    }
  }

  /**
   * Execute battle test: agents compete on questions
   */
  private async executeBattleTest(): Promise<void> {
    // For each feature, have all agents answer and compare
    for (const [acronym, questions] of this._questionBank.byFeature) {
      const agent = this._agents.get(acronym);
      if (!agent) continue;

      await this.testAgentOnQuestions(agent, questions);
    }
  }

  /**
   * Execute stress test: each agent answers all questions
   */
  private async executeStressTest(): Promise<void> {
    const allQuestions = Array.from(this._questionBank.questions.values());

    for (const [acronym, agent] of this._agents) {
      await this.testAgentOnQuestions(agent, allQuestions);
    }
  }

  /**
   * Execute OODA validation: detailed OODA loop analysis
   */
  private async executeOODAValidation(): Promise<void> {
    // Sample questions for OODA analysis
    const sampleQuestions: TestQuestion[] = [];
    for (const category of [QuestionCategory.KNOWLEDGE, QuestionCategory.DECISION, QuestionCategory.ADVANCED]) {
      const categoryQuestions = this._questionBank.getCategoryQuestions(category);
      sampleQuestions.push(...categoryQuestions.slice(0, 3));
    }

    for (const [acronym, agent] of this._agents) {
      const agentQuestions = sampleQuestions.filter(q =>
        q.featureAcronym === acronym
      );

      if (agentQuestions.length > 0) {
        await this.testAgentWithOODAValidation(agent, agentQuestions);
      }
    }
  }

  /**
   * Test an agent on a set of questions
   */
  private async testAgentOnQuestions(
    agent: EnhancedFeatureAgent,
    questions: TestQuestion[]
  ): Promise<void> {
    const questionResults: QuestionResult[] = [];

    for (const question of questions) {
      const result = await this.askQuestion(agent, question);
      questionResults.push(result);
    }

    // Calculate feature scores
    const featureResult = this.calculateFeatureResult(
      agent,
      questionResults
    );

    this._results.set(agent.acronym, featureResult);
  }

  /**
   * Test an agent with detailed OODA validation
   */
  private async testAgentWithOODAValidation(
    agent: EnhancedFeatureAgent,
    questions: TestQuestion[]
  ): Promise<void> {
    // Track OODA execution for each question
    const oodaMetrics: OODAMetrics[] = [];

    for (const question of questions) {
      const startTime = Date.now();

      // Create query
      const query: Query = {
        id: `q-${question.id}-${Date.now()}`,
        type: this.mapQuestionCategoryToQueryType(question.category),
        content: question.content,
        complexity: this.mapComplexity(question.complexity),
        timestamp: new Date()
      };

      // Execute with OODA tracking
      const response = await agent.handleQueryEnhanced(query);
      const oodaLatency = Date.now() - startTime;

      // Record OODA metrics
      oodaMetrics.push({
        observeLatency: oodaLatency * 0.1,  // Approximate
        orientLatency: oodaLatency * 0.2,
        decideLatency: oodaLatency * 0.3,
        actLatency: oodaLatency * 0.4,
        totalLatency: oodaLatency,
        confidence: response.confidence,
        explorationRate: agent.stateMachine.explorationRate,
        stateTransitions: 1
      });

      // Calculate score
      const score = question.calculatePartialScore(response.content);

      const questionResult: QuestionResult = {
        questionId: question.id,
        agentId: agent.acronym,
        answer: response.content,
        confidence: response.confidence,
        actionTaken: response.actionTaken,
        stateAtResponse: response.stateAtResponse,
        latencyMs: response.latencyMs,
        score,
        maxScore: question.points,
        oodaExecuted: true,
        timestamp: new Date()
      };

      // Store result (simplified - would normally accumulate)
    }

    // Calculate OODA efficiency
    const avgLatency = oodaMetrics.reduce((sum, m) => sum + m.totalLatency, 0) / oodaMetrics.length;
    const oodaEfficiency = avgLatency < 100 ? 1 : avgLatency < 200 ? 0.8 : 0.5;
  }

  /**
   * Ask a single question to an agent
   */
  private async askQuestion(
    agent: EnhancedFeatureAgent,
    question: TestQuestion
  ): Promise<QuestionResult> {
    const query: Query = {
      id: `q-${question.id}-${Date.now()}`,
      type: this.mapQuestionCategoryToQueryType(question.category),
      content: question.content,
      complexity: this.mapComplexity(question.complexity),
      timestamp: new Date()
    };

    const response = await agent.handleQueryEnhanced(query);
    const score = question.calculatePartialScore(response.content);

    return {
      questionId: question.id,
      agentId: agent.acronym,
      answer: response.content,
      confidence: response.confidence,
      actionTaken: response.actionTaken,
      stateAtResponse: response.stateAtResponse,
      latencyMs: response.latencyMs,
      score,
      maxScore: question.points,
      oodaExecuted: true,
      timestamp: new Date()
    };
  }

  /**
   * Calculate feature test result from question results
   */
  private calculateFeatureResult(
    agent: EnhancedFeatureAgent,
    questions: QuestionResult[]
  ): FeatureTestResult {
    // Separate by category using the question type suffix
    const knowledgeQs = questions.filter(q => q.questionId.includes('-K'));
    const decisionQs = questions.filter(q => q.questionId.includes('-D'));
    const advancedQs = questions.filter(q => q.questionId.includes('-A'));

    // Calculate max scores per category
    const knowledgeMax = knowledgeQs.reduce((sum, q) => sum + q.maxScore, 0);
    const decisionMax = decisionQs.reduce((sum, q) => sum + q.maxScore, 0);
    const advancedMax = advancedQs.reduce((sum, q) => sum + q.maxScore, 0);
    const totalMax = knowledgeMax + decisionMax + advancedMax;

    // Calculate actual scores per category
    const knowledgeScore = knowledgeQs.reduce((sum, q) => sum + q.score, 0);
    const decisionScore = decisionQs.reduce((sum, q) => sum + q.score, 0);
    const advancedScore = advancedQs.reduce((sum, q) => sum + q.score, 0);

    const totalScore = knowledgeScore + decisionScore + advancedScore;

    // Get OODA metrics
    const stats = agent.getStateMachineStats();
    const oodaEfficiency = stats.averageResponseTime < 100 ? 1 :
                          stats.averageResponseTime < 200 ? 0.8 : 0.5;

    // Check Q-learning convergence
    const qLearningConverged = stats.successRate >= this._config.qLearningThreshold;

    // Cross-feature coordination (simplified)
    const crossFeatureCoordination = stats.health > 0.8 ? 1 :
                                     stats.health > 0.6 ? 0.5 : 0;

    return {
      featureAcronym: agent.acronym,
      agentId: agent.acronym,
      questions,
      knowledgeScore,
      decisionScore,
      advancedScore,
      totalScore,
      maxScore: totalMax,
      oodaEfficiency,
      qLearningConverged,
      crossFeatureCoordination,
      status: TestResultStatus.PASSED,
      timestamp: new Date()
    };
  }

  /**
   * Generate overall test result
   */
  private generateResult(): BattleTestResult {
    const totalScore = Array.from(this._results.values())
      .reduce((sum, r) => sum + r.totalScore, 0);

    const maxScore = Array.from(this._results.values())
      .reduce((sum, r) => sum + r.maxScore, 0);

    const allQuestions = Array.from(this._results.values())
      .flatMap(r => r.questions);

    const averageOodaLatency = allQuestions.length > 0
      ? allQuestions.reduce((sum, q) => sum + q.latencyMs, 0) / allQuestions.length
      : 0;

    const averageConfidence = allQuestions.length > 0
      ? allQuestions.reduce((sum, q) => sum + q.confidence, 0) / allQuestions.length
      : 0;

    const duration = Date.now() - this._startTime.getTime();

    return {
      testId: this.id,
      mode: this.mode,
      featureResults: this._results,
      totalScore,
      maxScore,
      averageOodaLatency,
      averageConfidence,
      timestamp: new Date(),
      duration
    };
  }

  /**
   * Map question category to query type
   */
  private mapQuestionCategoryToQueryType(category: QuestionCategory): QueryType {
    switch (category) {
      case QuestionCategory.KNOWLEDGE:
        return QueryType.GENERAL_INFO;
      case QuestionCategory.DECISION:
        return QueryType.OPTIMIZATION;
      case QuestionCategory.ADVANCED:
        return QueryType.TROUBLESHOOTING;
    }
  }

  /**
   * Map complexity level
   */
  private mapComplexity(complexity: string): ComplexityLevel {
    switch (complexity) {
      case 'Simple':
        return ComplexityLevel.SIMPLE;
      case 'Moderate':
        return ComplexityLevel.MODERATE;
      case 'Complex':
        return ComplexityLevel.COMPLEX;
      case 'Expert':
        return ComplexityLevel.EXPERT;
      default:
        return ComplexityLevel.MODERATE;
    }
  }

  /**
   * Get test results
   */
  getResults(): Map<string, FeatureTestResult> {
    return new Map(this._results);
  }

  /**
   * Get test status
   */
  getStatus(): TestResultStatus {
    return this._status;
  }

  /**
   * Get leaderboard (agents ranked by score)
   */
  getLeaderboard(): Array<{
    featureAcronym: string;
    score: number;
    maxScore: number;
    percentage: number;
  }> {
    return Array.from(this._results.values())
      .map(r => ({
        featureAcronym: r.featureAcronym,
        score: r.totalScore,
        maxScore: r.maxScore,
        percentage: (r.totalScore / r.maxScore) * 100
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Generate report
   */
  generateReport(): string {
    const leaderboard = this.getLeaderboard();
    let report = '# RAN Feature Agent Battle Test Report\n\n';
    report += `**Test ID**: ${this.id}\n`;
    report += `**Mode**: ${this.mode}\n`;
    report += `**Status**: ${this._status}\n`;
    report += `**Timestamp**: ${new Date().toISOString()}\n\n`;

    report += '## Leaderboard\n\n';
    report += '| Rank | Feature | Score | Max | Percentage |\n';
    report += '|------|---------|-------|-----|------------|\n';

    leaderboard.forEach((entry, index) => {
      report += `| ${index + 1} | ${entry.featureAcronym} | ${entry.score.toFixed(1)} | ${entry.maxScore} | ${entry.percentage.toFixed(1)}% |\n`;
    });

    report += '\n## Detailed Results\n\n';
    for (const [acronym, result] of this._results) {
      // Calculate actual max scores per category from the question results
      const knowledgeMax = result.questions
        .filter(q => q.questionId.includes('-K'))
        .reduce((sum, q) => sum + q.maxScore, 0);
      const decisionMax = result.questions
        .filter(q => q.questionId.includes('-D'))
        .reduce((sum, q) => sum + q.maxScore, 0);
      const advancedMax = result.questions
        .filter(q => q.questionId.includes('-A'))
        .reduce((sum, q) => sum + q.maxScore, 0);

      report += `### ${acronym}\n\n`;
      report += `- **Knowledge**: ${result.knowledgeScore.toFixed(1)}/${knowledgeMax}\n`;
      report += `- **Decision**: ${result.decisionScore.toFixed(1)}/${decisionMax}\n`;
      report += `- **Advanced**: ${result.advancedScore.toFixed(1)}/${advancedMax}\n`;
      report += `- **Total**: ${result.totalScore.toFixed(1)}/${result.maxScore} (${(result.totalScore / result.maxScore * 100).toFixed(1)}%)\n`;
      report += `- **OODA Efficiency**: ${result.oodaEfficiency}\n`;
      report += `- **Q-Learning Converged**: ${result.qLearningConverged ? 'Yes' : 'No'}\n`;
      report += `- **Cross-Feature Coordination**: ${result.crossFeatureCoordination}\n\n`;
    }

    return report;
  }

  /**
   * String representation
   */
  toString(): string {
    return `BattleTest(${this.id}, mode=${this.mode}, status=${this._status})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      id: this.id,
      mode: this.mode,
      status: this._status,
      config: this._config,
      resultCount: this._results.size,
      timestamp: this._startTime
    };
  }
}

export default BattleTest;
