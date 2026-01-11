/**
 * OODA Cycle for Autonomous Decision Making
 *
 * Implements the Observe-Orient-Decide-Act loop for
 * autonomous question-answering with Q-learning integration.
 *
 * @module workflow/ooda-cycle
 */

import { QTable } from '../../intelligence/aggregates/q-table';
import { TrajectoryBuffer } from '../../intelligence/aggregates/trajectory-buffer';
import { AutonomousStateMachine } from '../../intelligence/aggregates/autonomous-state-machine';
import { State, Action } from '../../intelligence/value-objects';
import { Reward } from '../../intelligence/value-objects/reward';
import { Trajectory } from '../../intelligence/entities/trajectory';
import type { FeatureKnowledge } from './feature-specialist';
import type { FeatureAgentKnowledge } from './autonomous-qa';

/**
 * OODA Cycle Configuration
 */
export interface OODACycleConfig {
  qTable: QTable;
  trajectoryBuffer: TrajectoryBuffer;
  stateMachine: AutonomousStateMachine;
  agentId: string; // For trajectory tracking
  confidenceThreshold?: number; // Default: 0.7
}

/**
 * OODA Decision Context
 */
export interface OODAContext {
  question: string;
  state: State;
  featureKnowledge: FeatureKnowledge;
  context?: Record<string, unknown>;
}

/**
 * OODA Decision Result
 */
export interface OODADecision {
  action: Action;
  confidence: number;
  phase: 'Observe' | 'Orient' | 'Decide' | 'Act';
  reasoning?: string;
  estimatedReward?: number;
}

/**
 * OODA Phase Results
 */
interface ObservePhase {
  hasRelevantKnowledge: boolean;
  knowledgeQuality: number; // 0-1
  questionComplexity: 'simple' | 'moderate' | 'complex';
  agentCount: number;
}

interface OrientPhase {
  state: State;
  availableActions: Action[];
  contextRelevance: number; // 0-1
  peerConsultationPotential: number; // 0-1
}

interface DecidePhase {
  selectedAction: Action;
  expectedQValue: number;
  confidence: number;
  reasoning: string;
}

/**
 * OODA Cycle
 *
 * Implements the autonomous decision-making loop:
 * 1. Observe: Assess the situation
 * 2. Orient: Analyze context and state
 * 3. Decide: Select action using Q-learning
 * 4. Act: Execute the decision
 */
export class OODACycle {
  private config: OODACycleConfig;
  private actionSpace = [
    Action.DIRECT_ANSWER,
    Action.CONTEXT_ANSWER,
    Action.CONSULT_PEER,
    Action.REQUEST_CLARIFICATION,
    Action.ESCALATE,
  ] as const;

  // Statistics
  private stats = {
    totalDecisions: 0,
    actions: {
      [Action.DIRECT_ANSWER]: 0,
      [Action.CONTEXT_ANSWER]: 0,
      [Action.CONSULT_PEER]: 0,
      [Action.REQUEST_CLARIFICATION]: 0,
      [Action.ESCALATE]: 0,
    },
    avgConfidence: 0,
    phaseDistribution: {
      Observe: 0,
      Orient: 0,
      Decide: 0,
      Act: 0,
    },
  };

  constructor(config: OODACycleConfig) {
    this.config = config;
  }

  /**
   * Execute OODA cycle for decision making
   */
  async decide(context: OODAContext): Promise<OODADecision> {
    this.stats.totalDecisions++;

    // Phase 1: Observe
    const observe = this.observe(context);

    // Phase 2: Orient
    const orient = await this.orient(context, observe);

    // Phase 3: Decide
    const decide = await this.decideAction(context, observe, orient);

    // Phase 4: Act (prepare action)
    const act = this.prepareAction(decide, context);

    // Update statistics
    this.updateStats(decide.selectedAction, decide.confidence);

    return {
      action: decide.selectedAction,
      confidence: decide.confidence,
      phase: 'Act',
      reasoning: decide.reasoning,
      estimatedReward: decide.expectedQValue,
    };
  }

  /**
   * Get OODA cycle statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      avgConfidence: this.stats.avgConfidence.toFixed(3),
      actionDistribution: {
        DirectAnswer: ((this.stats.actions[Action.DIRECT_ANSWER] / this.stats.totalDecisions) * 100).toFixed(2) + '%',
        ContextAnswer: ((this.stats.actions[Action.CONTEXT_ANSWER] / this.stats.totalDecisions) * 100).toFixed(2) + '%',
        ConsultPeer: ((this.stats.actions[Action.CONSULT_PEER] / this.stats.totalDecisions) * 100).toFixed(2) + '%',
        RequestClarification: ((this.stats.actions[Action.REQUEST_CLARIFICATION] / this.stats.totalDecisions) * 100).toFixed(2) + '%',
        Escalate: ((this.stats.actions[Action.ESCALATE] / this.stats.totalDecisions) * 100).toFixed(2) + '%',
      },
    };
  }

  // Private methods - OODA Phases

  /**
   * Phase 1: Observe
   * Assess the situation and gather information
   */
  private observe(context: OODAContext): ObservePhase {
    const hasRelevantKnowledge = context.featureKnowledge.agents.size > 0;
    const knowledgeQuality = this.assessKnowledgeQuality(context.featureKnowledge);
    const questionComplexity = this.assessQuestionComplexity(context.question);
    const agentCount = context.featureKnowledge.agents.size;

    this.stats.phaseDistribution.Observe++;

    return {
      hasRelevantKnowledge,
      knowledgeQuality,
      questionComplexity,
      agentCount,
    };
  }

  /**
   * Phase 2: Orient
   * Analyze context and determine available actions
   */
  private async orient(context: OODAContext, observe: ObservePhase): Promise<OrientPhase> {
    // State is already provided in context
    const state = context.state;

    // Assess context relevance
    const contextRelevance = observe.knowledgeQuality;

    // Assess potential for peer consultation
    const peerConsultationPotential = this.assessPeerConsultationPotential(context, observe);

    // Determine available actions based on observation
    const availableActions = this.determineAvailableActions(observe, contextRelevance);

    this.stats.phaseDistribution.Orient++;

    return {
      state,
      availableActions,
      contextRelevance,
      peerConsultationPotential,
    };
  }

  /**
   * Phase 3: Decide
   * Select action using Q-learning with epsilon-greedy policy
   */
  private async decideAction(
    context: OODAContext,
    observe: ObservePhase,
    orient: OrientPhase
  ): Promise<DecidePhase> {
    const state = orient.state;
    const availableActions = orient.availableActions;

    // Use Q-learning to select action (epsilon-greedy)
    const selectedAction = await this.selectActionWithQLearning(state, availableActions);

    // Get Q-value for selected action
    const qValue = this.config.qTable.lookup(state, selectedAction);

    // Calculate confidence
    const confidence = this.calculateConfidence(qValue, observe, orient);

    // Generate reasoning
    const reasoning = this.generateReasoning(selectedAction, observe, orient);

    this.stats.phaseDistribution.Decide++;

    return {
      selectedAction,
      expectedQValue: qValue,
      confidence,
      reasoning,
    };
  }

  /**
   * Phase 4: Act
   * Prepare action for execution (pre-execution phase)
   */
  private prepareAction(decide: DecidePhase, context: OODAContext): OODADecision {
    this.stats.phaseDistribution.Act++;

    // Create a trajectory step and add to buffer
    // Note: For full trajectory tracking, use stateMachine.startTrajectory/endTrajectory
    // This is a lightweight placeholder for the decision itself
    const trajectory = new Trajectory(
      `trajectory-${Date.now()}`,
      this.config.agentId,
      new Date()
    );

    // Add the step to trajectory
    trajectory.addStep({
      state: context.state,
      action: decide.selectedAction,
      reward: Reward.zero(),
      nextState: context.state,
      timestamp: new Date()
    });

    // Mark as completed (single-step trajectory for now)
    trajectory.complete();

    // Add to buffer (will be deduplicated if similar exists)
    this.config.trajectoryBuffer.add(trajectory);

    return {
      action: decide.selectedAction,
      confidence: decide.confidence,
      phase: 'Act',
      reasoning: decide.reasoning,
      estimatedReward: decide.expectedQValue,
    };
  }

  /**
   * Select action using epsilon-greedy policy
   */
  private async selectActionWithQLearning(
    state: State,
    availableActions: readonly Action[]
  ): Promise<Action> {
    // Get epsilon from state machine (exploration rate)
    const epsilon = this.config.stateMachine.explorationRate;

    // Epsilon-greedy: explore with probability epsilon
    if (Math.random() < epsilon) {
      // Explore: select random action
      const randomIndex = Math.floor(Math.random() * availableActions.length);
      return availableActions[randomIndex];
    }

    // Exploit: select action with highest Q-value
    let bestAction = availableActions[0];
    let bestQValue = -Infinity;

    for (const action of availableActions) {
      const qValue = this.config.qTable.lookup(state, action);
      if (qValue > bestQValue) {
        bestQValue = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  // Assessment helpers

  private assessKnowledgeQuality(knowledge: FeatureKnowledge): number {
    // Quality based on:
    // - Number of relevant agents
    // - Number of parameters/counters/KPIs found
    // - Contextual information available

    let score = 0;

    // Agent count (up to 0.3)
    score += Math.min(0.3, knowledge.agents.size * 0.05);

    // Parameters (up to 0.3)
    score += Math.min(0.3, knowledge.relevantParameters.length * 0.1);

    // Counters (up to 0.2)
    score += Math.min(0.2, knowledge.relevantCounters.length * 0.05);

    // KPIs (up to 0.2)
    score += Math.min(0.2, knowledge.relevantKPIs.length * 0.1);

    return Math.min(1, score);
  }

  private assessQuestionComplexity(question: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = question.split(/\s+/).length;
    const hasTechnicalTerms = /[A-Z]{2,}\s*\d+/.test(question);
    const hasMultipleQuestions = (question.match(/\?/g) || []).length > 1;

    if (hasMultipleQuestions || (wordCount > 30 && hasTechnicalTerms)) {
      return 'complex';
    } else if (wordCount > 15 || hasTechnicalTerms) {
      return 'moderate';
    }
    return 'simple';
  }

  private assessPeerConsultationPotential(context: OODAContext, observe: ObservePhase): number {
    // High potential if:
    // - Multiple agents available (cross-feature consultation)
    // - Complex question
    // - Low knowledge quality

    let potential = 0;

    if (observe.agentCount > 3) {
      potential += 0.4;
    }

    if (observe.questionComplexity === 'complex') {
      potential += 0.3;
    }

    if (observe.knowledgeQuality < 0.5) {
      potential += 0.3;
    }

    return Math.min(1, potential);
  }

  private determineAvailableActions(
    observe: ObservePhase,
    contextRelevance: number
  ): Action[] {
    const actions: Action[] = [];

    // DIRECT_ANSWER: High knowledge quality, simple question
    if (observe.knowledgeQuality > 0.7 && observe.questionComplexity === 'simple') {
      actions.push(Action.DIRECT_ANSWER);
    }

    // CONTEXT_ANSWER: Moderate knowledge quality
    if (observe.knowledgeQuality > 0.4) {
      actions.push(Action.CONTEXT_ANSWER);
    }

    // CONSULT_PEER: Multiple agents available, complex question
    if (observe.agentCount > 1 && observe.questionComplexity !== 'simple') {
      actions.push(Action.CONSULT_PEER);
    }

    // REQUEST_CLARIFICATION: Low knowledge quality
    if (observe.knowledgeQuality < 0.3) {
      actions.push(Action.REQUEST_CLARIFICATION);
    }

    // ESCALATE: Very low knowledge quality or critical question
    if (observe.knowledgeQuality < 0.2) {
      actions.push(Action.ESCALATE);
    }

    // Always have at least one action
    if (actions.length === 0) {
      actions.push(Action.DIRECT_ANSWER);
    }

    return actions;
  }

  private calculateConfidence(
    qValue: number,
    observe: ObservePhase,
    orient: OrientPhase
  ): number {
    // Confidence based on:
    // - Q-value (expected reward)
    // - Knowledge quality
    // - Context relevance

    const qConfidence = this.sigmoid(qValue);
    const knowledgeConfidence = observe.knowledgeQuality;
    const contextConfidence = orient.contextRelevance;

    // Weighted average
    return 0.4 * qConfidence + 0.4 * knowledgeConfidence + 0.2 * contextConfidence;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private generateReasoning(
    action: Action,
    observe: ObservePhase,
    orient: OrientPhase
  ): string {
    const parts: string[] = [];

    const actionName = {
      [Action.DIRECT_ANSWER]: 'DirectAnswer',
      [Action.CONTEXT_ANSWER]: 'ContextAnswer',
      [Action.CONSULT_PEER]: 'ConsultPeer',
      [Action.REQUEST_CLARIFICATION]: 'RequestClarification',
      [Action.ESCALATE]: 'Escalate',
    }[action] ?? action;

    parts.push(`Action: ${actionName}`);
    parts.push(`Knowledge quality: ${(observe.knowledgeQuality * 100).toFixed(1)}%`);
    parts.push(`Agents available: ${observe.agentCount}`);
    parts.push(`Complexity: ${observe.questionComplexity}`);

    if (action === Action.CONSULT_PEER) {
      parts.push(`Peer consultation potential: ${(orient.peerConsultationPotential * 100).toFixed(1)}%`);
    }

    return parts.join(' | ');
  }

  private updateStats(action: Action, confidence: number): void {
    if (action in this.stats.actions) {
      this.stats.actions[action as keyof typeof this.stats.actions]++;
    }

    const alpha = 0.1;
    this.stats.avgConfidence = alpha * confidence + (1 - alpha) * this.stats.avgConfidence;
  }
}

export type {
  OODACycleConfig,
  OODAContext,
  OODADecision,
  ObservePhase,
  OrientPhase,
  DecidePhase,
};
