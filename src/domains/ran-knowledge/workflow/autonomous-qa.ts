/**
 * Autonomous Question-Answering Workflow for RAN Domain
 *
 * Implements an autonomous QA system using:
 * - WASM-based fast feature lookup (593 agents)
 * - OODA Cycle (Observe-Orient-Decide-Act)
 * - Q-learning for continuous improvement
 * - AgentDB memory integration
 * - HNSW indexing for semantic search
 *
 * Architecture:
 * User Question → QuestionRouter → FeatureSpecialist → OODACycle → AnswerGenerator → QLearningUpdate
 *
 * @module workflow/autonomous-qa
 */

import { AgentDB } from '@agentdb/core';
import { HNSWIndex } from '@agentdb/hnsw';
import { QTable } from '../../intelligence/aggregates/q-table';
import { TrajectoryBuffer } from '../../intelligence/aggregates/trajectory-buffer';
import { AutonomousStateMachine } from '../../intelligence/aggregates/autonomous-state-machine';
import { Query } from '../../coordination/value-objects/query';
import { Response } from '../../coordination/value-objects/response';
import { State, Action, Reward } from '../../intelligence/value-objects';
import { QuestionRouter } from './question-router';
import { FeatureSpecialist } from './feature-specialist';
import { OODACycle } from './ooda-cycle';
import { AnswerGenerator } from './answer-generator';
import { QLearningUpdate } from './q-learning-update';

// Re-export components
export { QuestionRouter } from './question-router';
export { FeatureSpecialist } from './feature-specialist';
export { OODACycle } from './ooda-cycle';
export { AnswerGenerator } from './answer-generator';
export { QLearningUpdate } from './q-learning-update';

/**
 * Autonomous QA Workflow Configuration
 */
export interface AutonomousQAConfig {
  // Agent identification
  agentId: string;

  // AgentDB configuration
  agentDB: AgentDB;
  hnswIndex?: HNSWIndex;

  // Q-learning configuration
  qTable: QTable;
  trajectoryBuffer: TrajectoryBuffer;

  // State machine for agent lifecycle
  stateMachine: AutonomousStateMachine;

  // Feature knowledge base (593 agents)
  featureAgentRegistry: Map<string, FeatureAgentKnowledge>;

  // Performance tuning
  maxContextRetrieval?: number; // Default: 10
  confidenceThreshold?: number; // Default: 0.7
  enableFederatedLearning?: boolean; // Default: true
  federatedSyncInterval?: number; // Default: 60000ms (60s)
}

/**
 * Feature Agent Knowledge Entry
 */
export interface FeatureAgentKnowledge {
  fajCode: string;
  category: string;
  featureName: string;
  parameters: string[];
  counters: string[];
  kpis: string[];
  embedding?: number[]; // 128-dim vector for HNSW
}

/**
 * QA Request
 */
export interface QARequest {
  question: string;
  context?: Record<string, unknown>;
  userId?: string;
  timestamp?: Date;
}

/**
 * QA Response with metadata
 */
export interface QAResponse {
  answer: string;
  confidence: number;
  sources: string[];
  actionTaken: Action;
  state: string; // State key for reference
  metadata: {
    processingTimeMs: number;
    agentsConsulted: string[];
    oodaPhase: string;
    learningUpdate: boolean;
  };
}

/**
 * Autonomous QA Workflow Orchestrator
 *
 * Main workflow coordinator that routes questions through the
 * autonomous decision pipeline.
 */
export class AutonomousQAWorkflow {
  private config: AutonomousQAConfig;
  private questionRouter: QuestionRouter;
  private featureSpecialist: FeatureSpecialist;
  private oodaCycle: OODACycle;
  private answerGenerator: AnswerGenerator;
  private qLearningUpdate: QLearningUpdate;

  // Statistics
  private stats = {
    totalQuestions: 0,
    answeredDirectly: 0,
    answeredWithContext: 0,
    escalated: 0,
    avgConfidence: 0,
    avgProcessingTimeMs: 0,
  };

  constructor(config: AutonomousQAConfig) {
    this.config = config;

    // Initialize components
    this.questionRouter = new QuestionRouter({
      agentDB: config.agentDB,
      hnswIndex: config.hnswIndex,
      featureRegistry: config.featureAgentRegistry,
      maxCandidates: config.maxContextRetrieval ?? 10,
    });

    this.featureSpecialist = new FeatureSpecialist({
      featureRegistry: config.featureAgentRegistry,
      qTable: config.qTable,
      stateMachine: config.stateMachine,
    });

    this.oodaCycle = new OODACycle({
      qTable: config.qTable,
      trajectoryBuffer: config.trajectoryBuffer,
      stateMachine: config.stateMachine,
      agentId: config.agentId,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
    });

    this.answerGenerator = new AnswerGenerator({
      maxSources: 5,
      formatResponse: true,
    });

    this.qLearningUpdate = new QLearningUpdate({
      qTable: config.qTable,
      trajectoryBuffer: config.trajectoryBuffer,
      federatedLearning: config.enableFederatedLearning ?? true,
      syncInterval: config.federatedSyncInterval ?? 60000,
    });
  }

  /**
   * Process a question through the autonomous QA pipeline
   *
   * Pipeline:
   * 1. QuestionRouter → Identify relevant feature agents
   * 2. FeatureSpecialist → Retrieve specialized knowledge
   * 3. OODACycle → Decide on action (DirectAnswer/ContextAnswer/ConsultPeer/Escalate)
   * 4. AnswerGenerator → Format response with confidence
   * 5. QLearningUpdate → Learn from interaction
   */
  async processQuestion(request: QARequest): Promise<QAResponse> {
    const startTime = Date.now();

    try {
      // Update statistics
      this.stats.totalQuestions++;

      // Step 1: Route question to relevant specialists
      const routingResult = await this.questionRouter.route(request.question);
      const state = this.encodeState(request, routingResult);

      // Step 2: Retrieve feature knowledge
      const featureKnowledge = await this.featureSpecialist.retrieveKnowledge(
        routingResult.relevantAgents,
        request.question
      );

      // Step 3: OODA Cycle - Decide on action
      const oodaDecision = await this.oodaCycle.decide({
        question: request.question,
        state,
        featureKnowledge,
        context: request.context,
      });

      // Step 4: Generate answer based on decision
      const answer = await this.answerGenerator.generate({
        decision: oodaDecision.action,
        question: request.question,
        knowledge: featureKnowledge,
        confidence: oodaDecision.confidence,
      });

      // Step 5: Update Q-learning (async, non-blocking)
      const learningPromise = this.qLearningUpdate.recordInteraction({
        state,
        action: oodaDecision.action,
        question: request.question,
        context: request.context,
        timestamp: new Date(),
      }).catch((error) => {
        console.error('QLearning update failed:', error);
      });

      // Calculate metrics
      const processingTime = Date.now() - startTime;
      this.updateStats(oodaDecision.action, answer.confidence, processingTime);

      // Prepare response
      const response: QAResponse = {
        answer: answer.content,
        confidence: answer.confidence,
        sources: answer.sources,
        actionTaken: oodaDecision.action,
        state: state.toKey(), // Serialize state as key string
        metadata: {
          processingTimeMs: processingTime,
          agentsConsulted: routingResult.relevantAgents,
          oodaPhase: oodaDecision.phase,
          learningUpdate: true,
        },
      };

      // Wait for learning update (with timeout)
      await Promise.race([
        learningPromise,
        new Promise((resolve) => setTimeout(resolve, 100)),
      ]);

      return response;
    } catch (error) {
      console.error('AutonomousQA workflow error:', error);
      throw error;
    }
  }

  /**
   * Record feedback for a question-answer interaction
   *
   * This updates the Q-learning with actual user feedback,
   * improving future decision-making.
   */
  async recordFeedback(request: QARequest, response: QAResponse, feedback: {
    rating: number; // -1 to 1
    resolved?: boolean;
    comment?: string;
  }): Promise<void> {
    // Parse state key back into State object
    const state = State.create(response.state);
    const action = response.actionTaken;

    // Calculate reward
    const reward = this.calculateReward(feedback, response.metadata.processingTimeMs);

    // Update Q-table with reward via state machine
    // The state machine handles Q-table updates internally
    this.config.stateMachine.recordInteraction(
      state,
      action,
      reward.fromComponents({
        userRating: feedback.rating,
        resolutionSuccess: feedback.resolved ? 0.5 : 0,
        latencyPenalty: reward.latencyPenalty,
        consultationCost: 0,
        noveltyBonus: 0
      })
    );

    console.log(`Feedback recorded: rating=${feedback.rating}, reward=${reward.total().toFixed(3)}`);
  }

  /**
   * Get workflow statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      avgConfidence: this.stats.avgConfidence.toFixed(3),
      avgProcessingTimeMs: this.stats.avgProcessingTimeMs.toFixed(2),
      qTableSize: this.config.qTable.size(),
      trajectorySize: this.config.trajectoryBuffer.size(),
      featureAgents: this.config.featureAgentRegistry.size,
    };
  }

  /**
   * Trigger federated learning sync manually
   */
  async triggerFederatedSync(): Promise<void> {
    await this.qLearningUpdate.triggerFederatedSync();
  }

  /**
   * Shutdown workflow gracefully
   */
  async shutdown(): Promise<void> {
    // Final federated sync
    await this.triggerFederatedSync();

    // Close connections
    await this.config.agentDB.close();

    console.log('AutonomousQA workflow shutdown complete');
  }

  // Private helper methods

  private encodeState(request: QARequest, routingResult: RoutingResult): State {
    // Encode state for Q-learning
    const complexity = this.assessComplexity(request.question);
    const queryType = routingResult.queryType;
    const category = routingResult.primaryCategory ?? 'general';
    const hasContext = routingResult.relevantAgents.length > 0;

    // Map complexity to State complexity level
    const stateComplexity: 'low' | 'medium' | 'high' =
      complexity === 'simple' ? 'low' :
      complexity === 'moderate' ? 'medium' : 'high';

    // Map queryType to State queryType
    const stateQueryType: 'parameter' | 'counter' | 'kpi' | 'procedure' | 'troubleshoot' | 'general' =
      routingResult.queryType === 'general' ? 'general' :
      routingResult.queryType === 'parameter' ? 'parameter' :
      routingResult.queryType === 'counter' ? 'counter' :
      routingResult.queryType === 'kpi' ? 'kpi' :
      routingResult.queryType === 'procedure' ? 'procedure' :
      routingResult.queryType === 'troubleshoot' ? 'troubleshoot' : 'general';

    // Create State with context hash including category
    const contextHash = `${category}:${hasContext ? 'with' : 'without'}_context`;

    return new State(
      stateQueryType,
      stateComplexity,
      contextHash,
      0.5 // Initial confidence
    );
  }

  private assessComplexity(question: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = question.split(/\s+/).length;
    const hasTechnicalTerms = /[A-Z]{2,}\s*\d+/.test(question);
    const hasMultipleQuestions = question.includes('?') && question.split('?').length > 2;

    if (hasMultipleQuestions || (wordCount > 30 && hasTechnicalTerms)) {
      return 'complex';
    } else if (wordCount > 15 || hasTechnicalTerms) {
      return 'moderate';
    }
    return 'simple';
  }

  private calculateReward(feedback: { rating: number; resolved?: boolean }, processingTimeMs: number): Reward {
    // User rating is the main component
    const userRating = Math.max(-1, Math.min(1, feedback.rating));

    // Resolution bonus
    const resolutionSuccess = feedback.resolved ? 0.5 : 0;

    // Latency penalty (if > 500ms)
    const latencyPenalty = processingTimeMs > 500
      ? -Math.min(0.5, (processingTimeMs - 500) / 10000)
      : 0;

    return Reward.fromComponents({
      userRating,
      resolutionSuccess,
      latencyPenalty,
      consultationCost: 0,
      noveltyBonus: 0
    });
  }

  private updateStats(action: Action, confidence: number, processingTime: number): void {
    // Update action-specific stats
    if (action === Action.DIRECT_ANSWER) {
      this.stats.answeredDirectly++;
    } else if (action === Action.CONTEXT_ANSWER) {
      this.stats.answeredWithContext++;
    } else if (action === Action.ESCALATE) {
      this.stats.escalated++;
    }

    // Update rolling averages
    const alpha = 0.1; // Smoothing factor
    this.stats.avgConfidence = alpha * confidence + (1 - alpha) * this.stats.avgConfidence;
    this.stats.avgProcessingTimeMs = alpha * processingTime + (1 - alpha) * this.stats.avgProcessingTimeMs;
  }

  private get stateMachine() {
    return this.config.stateMachine;
  }
}

/**
 * Routing Result from QuestionRouter
 */
interface RoutingResult {
  relevantAgents: string[];
  primaryCategory?: string;
  queryType: 'parameter' | 'counter' | 'kpi' | 'procedure' | 'troubleshoot' | 'general';
  confidence: number;
}

/**
 * OODA Decision Result
 */
interface OODADecision {
  action: 'DirectAnswer' | 'ContextAnswer' | 'ConsultPeer' | 'RequestClarification' | 'Escalate';
  confidence: number;
  phase: 'Observe' | 'Orient' | 'Decide' | 'Act';
  reasoning?: string;
}

/**
 * Feature Knowledge Result
 */
interface FeatureKnowledge {
  agents: Map<string, FeatureAgentKnowledge>;
  relevantParameters: string[];
  relevantCounters: string[];
  relevantKPIs: string[];
  contextualInfo: string[];
}

/**
 * Generated Answer Result
 */
interface GeneratedAnswer {
  content: string;
  confidence: number;
  sources: string[];
}

// Export types
export type {
  AutonomousQAConfig,
  QARequest,
  QAResponse,
  FeatureAgentKnowledge,
  RoutingResult,
  OODADecision,
  FeatureKnowledge,
  GeneratedAnswer,
};
