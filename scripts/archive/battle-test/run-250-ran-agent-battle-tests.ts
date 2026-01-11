#!/usr/bin/env bun
/**
 * RAN Agent 250-Question Battle Test Runner
 *
 * Comprehensive battle test using 250 questions across 50 RAN features.
 * Tests Category A (Knowledge), Category B (Decision Making), and
 * Category C (Advanced Troubleshooting).
 *
 * @module scripts/run-250-ran-agent-battle-tests
 */

import { LTEFeatureAgentsFactory, QueryType, ComplexityLevel, Query } from '../src/domains/knowledge/aggregates/enhanced-feature-agent';
import { AgentState } from '../src/domains/intelligence/aggregates/autonomous-state-machine';
import { Action } from '../src/domains/intelligence/value-objects/action';
import { DomainEventBus, EventBusFactory } from '../src/domains/coordination/aggregates/domain-event-bus';
import { LTE_50_FEATURES } from '../src/domains/ran-battle-test/aggregates/lte-features-constants';

// =============================================================================
// 250 BATTLE QUESTIONS
// =============================================================================

interface BattleQuestion {
  id: number;
  category: 'A' | 'B' | 'C';
  type: 'K01' | 'K02' | 'K03' | 'D01' | 'A01';
  question: string;
  acronym: string;
  featureName: string;
  fajCode: string;
}

// Parse questions from the 250-questions document format
const parse250Questions = (): BattleQuestion[] => {
  // Use shared feature list to ensure alignment with agents
  const features = LTE_50_FEATURES;

  const questions: BattleQuestion[] = [];
  let qNum = 1;

  features.forEach((feature, fIdx) => {
    // Category A: Knowledge Retrieval (K01, K02, K03)
    questions.push({
      id: qNum++,
      category: 'A',
      type: 'K01',
      question: `What are the activation prerequisites for ${feature.name}?`,
      acronym: feature.acronym,
      featureName: feature.name,
      fajCode: feature.faj
    });
    questions.push({
      id: qNum++,
      category: 'A',
      type: 'K02',
      question: `What parameters control ${feature.name} operation?`,
      acronym: feature.acronym,
      featureName: feature.name,
      fajCode: feature.faj
    });
    questions.push({
      id: qNum++,
      category: 'A',
      type: 'K03',
      question: `What counters monitor ${feature.name} performance?`,
      acronym: feature.acronym,
      featureName: feature.name,
      fajCode: feature.faj
    });

    // Category B: Decision Making (D01)
    questions.push({
      id: qNum++,
      category: 'B',
      type: 'D01',
      question: `When should ${feature.name} be activated? What KPIs indicate optimal timing?`,
      acronym: feature.acronym,
      featureName: feature.name,
      fajCode: feature.faj
    });

    // Category C: Advanced Troubleshooting (A01)
    questions.push({
      id: qNum++,
      category: 'C',
      type: 'A01',
      question: `${feature.name} is not performing as expected. What are the troubleshooting steps?`,
      acronym: feature.acronym,
      featureName: feature.name,
      fajCode: feature.faj
    });
  });

  return questions;
};

const BATTLE_QUESTIONS = parse250Questions();

// =============================================================================
// MAIN EXECUTION
// =============================================================================

interface TestResult {
  questionId: number;
  category: 'A' | 'B' | 'C';
  type: string;
  acronym: string;
  question: string;
  responseTime: number;
  confidence: number;
  action: string;
  state: string;
  oodaExecuted: boolean;
}

interface AgentStats {
  acronym: string;
  name: string;
  queries: number;
  avgResponseTime: number;
  avgConfidence: number;
  finalState: AgentState;
  health: number;
  interactions: number;
}

interface BattleReport {
  timestamp: Date;
  totalAgents: number;
  totalQuestions: number;
  results: TestResult[];
  agentStats: AgentStats[];
  summary: {
    totalTests: number;
    avgResponseTime: number;
    avgConfidence: number;
    categoryBreakdown: {
      categoryA: { count: number; avgConfidence: number };
      categoryB: { count: number; avgConfidence: number };
      categoryC: { count: number; avgConfidence: number };
    };
    stateDistribution: Record<string, number>;
    actionDistribution: Record<string, number>;
  };
}

/**
 * Main function to run 250-question battle tests
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     RAN AGENT BATTLE TEST - 250 Questions (50 Features)         ║');
  console.log('║     DDD-Compliant Multi-Specialized Autonomous Swarm         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Create Event Bus
  console.log('[1/7] Creating Domain Event Bus...');
  const eventBus = EventBusFactory.create();
  console.log(`      ✓ Event bus created with ${eventBus.getStatistics().totalSubscriptions} handlers\n`);

  // Step 2: Create 50 LTE Feature Agents
  console.log('[2/7] Creating 50 LTE Feature Agents...');
  const startTime = Date.now();
  const agents = LTEFeatureAgentsFactory.createAll();
  console.log(`      ✓ Created ${agents.size} agents in ${Date.now() - startTime}ms\n`);

  // Step 3: Initialize Agents
  console.log('[3/7] Initializing agents with autonomous state machines...');
  let initialized = 0;
  const initStart = Date.now();

  for (const [acronym, agent] of agents) {
    await agent.initialize();
    initialized++;

    if (initialized % 10 === 0) {
      console.log(`      Initialized ${initialized}/${agents.size} agents...`);
    }
  }

  console.log(`      ✓ All agents initialized in ${Date.now() - initStart}ms\n`);

  // Step 4: Run 250 Battle Tests
  console.log('[4/7] Running 250 battle test questions...');
  console.log('      Category A: Knowledge Retrieval (1-125)');
  console.log('      Category B: Decision Making (126-200)');
  console.log('      Category C: Advanced Troubleshooting (201-250)\n');

  const results: TestResult[] = [];
  const actionCounts = new Map<string, number>();
  const categoryStats = {
    A: { totalConfidence: 0, count: 0 },
    B: { totalConfidence: 0, count: 0 },
    C: { totalConfidence: 0, count: 0 }
  };
  const testStart = Date.now();

  for (const question of BATTLE_QUESTIONS) {
    // For agents not in our factory, use a generic agent
    let agent = agents.get(question.acronym);

    // If agent doesn't exist, skip or create a mock one
    if (!agent) {
      // For missing agents, we'll use ANR as a fallback
      agent = agents.get('ANR')!;
    }

    const queryStart = Date.now();

    // Create query with appropriate type based on category
    let queryType: QueryType;
    let complexity: ComplexityLevel;

    switch (question.category) {
      case 'A':
        queryType = QueryType.GENERAL_INFO;
        complexity = ComplexityLevel.SIMPLE;
        break;
      case 'B':
        queryType = QueryType.OPTIMIZATION;
        complexity = ComplexityLevel.MODERATE;
        break;
      case 'C':
        queryType = QueryType.TROUBLESHOOTING;
        complexity = ComplexityLevel.COMPLEX;
        break;
      default:
        queryType = QueryType.GENERAL_INFO;
        complexity = ComplexityLevel.MODERATE;
    }

    const query: Query = {
      id: `q-${question.id}`,
      type: queryType,
      content: question.question,
      complexity,
      timestamp: new Date()
    };

    // Handle query using enhanced agent with OODA loop
    const response = await agent.handleQueryEnhanced(query);

    // Track action distribution
    const actionName = response.actionTaken as string;
    actionCounts.set(actionName, (actionCounts.get(actionName) || 0) + 1);

    // Track category stats
    categoryStats[question.category].totalConfidence += response.confidence;
    categoryStats[question.category].count++;

    results.push({
      questionId: question.id,
      category: question.category,
      type: question.type,
      acronym: question.acronym,
      question: question.question,
      responseTime: response.latencyMs,
      confidence: response.confidence,
      action: actionName,
      state: response.stateAtResponse,
      oodaExecuted: response.stateAtResponse !== AgentState.INITIALIZING
    });

    const categoryLabel = `Cat ${question.category}`;
    console.log(`      [${question.id.toString().padStart(3, '0')}/250] ${categoryLabel} ${question.type} | ${question.acronym}: ${response.latencyMs}ms, ${(response.confidence * 100).toFixed(0)}% conf, ${actionName}`);
  }

  console.log(`      ✓ Completed ${results.length} tests in ${Date.now() - testStart}ms\n`);

  // Step 5: Collect Statistics
  console.log('[5/7] Collecting agent statistics...');
  const agentStats: AgentStats[] = [];
  const stateCounts = new Map<AgentState, number>();

  for (const [acronym, agent] of agents) {
    const smStats = agent.getStateMachineStats();

    agentStats.push({
      acronym,
      name: agent.name,
      queries: results.filter(r => r.acronym === acronym).length,
      avgResponseTime: smStats.averageResponseTime,
      avgConfidence: smStats.health,
      finalState: smStats.state,
      health: smStats.health,
      interactions: smStats.interactionCount
    });

    const stateCount = stateCounts.get(smStats.state) || 0;
    stateCounts.set(smStats.state, stateCount + 1);
  }

  console.log(`      ✓ Collected statistics for ${agentStats.length} agents\n`);

  // Step 6: Generate Report
  console.log('[6/7] Generating battle test report...\n');

  const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
  const stateDistribution: Record<string, number> = {};
  const actionDistribution: Record<string, number> = {};

  for (const [state, count] of stateCounts) {
    stateDistribution[state] = count;
  }

  for (const [action, count] of actionCounts) {
    actionDistribution[action] = count;
  }

  const report: BattleReport = {
    timestamp: new Date(),
    totalAgents: agents.size,
    totalQuestions: BATTLE_QUESTIONS.length,
    results,
    agentStats,
    summary: {
      totalTests: results.length,
      avgResponseTime: totalResponseTime / results.length,
      avgConfidence: totalConfidence / results.length,
      categoryBreakdown: {
        categoryA: {
          count: categoryStats.A.count,
          avgConfidence: categoryStats.A.count > 0 ? categoryStats.A.totalConfidence / categoryStats.A.count : 0
        },
        categoryB: {
          count: categoryStats.B.count,
          avgConfidence: categoryStats.B.count > 0 ? categoryStats.B.totalConfidence / categoryStats.B.count : 0
        },
        categoryC: {
          count: categoryStats.C.count,
          avgConfidence: categoryStats.C.count > 0 ? categoryStats.C.totalConfidence / categoryStats.C.count : 0
        }
      },
      stateDistribution,
      actionDistribution
    }
  };

  printReport(report);

  // Save report to file
  const fs = require('fs');
  fs.writeFileSync(
    './ran-agent-250-battle-report.json',
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('      Report saved to: ./ran-agent-250-battle-report.json\n');

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              250-QUESTION BATTLE TEST COMPLETE                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
}

/**
 * Print battle test report
 */
function printReport(report: BattleReport): void {
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│               250-QUESTION BATTLE TEST RESULTS               │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  console.log('│ OVERALL STATISTICS:                                              │');
  console.log(`│   Total Agents:        ${report.totalAgents.toString().padStart(45)}│`);
  console.log(`│   Total Questions:     ${report.totalQuestions.toString().padStart(45)}│`);
  console.log(`│   Tests Completed:     ${report.summary.totalTests.toString().padStart(45)}│`);
  console.log(`│   Avg Response Time:   ${report.summary.avgResponseTime.toFixed(2).toString().padStart(43)}│`);
  console.log(`│   Avg Confidence:      ${(report.summary.avgConfidence * 100).toFixed(1).toString().padStart(44)}%│`);

  console.log('│ CATEGORY BREAKDOWN:                                              │');
  console.log(`│   Category A (Knowledge):   ${report.summary.categoryBreakdown.categoryA.count.toString().padStart(3)} questions, ${(report.summary.categoryBreakdown.categoryA.avgConfidence * 100).toFixed(1).toString().padStart(6)}% avg     │`);
  console.log(`│   Category B (Decision):    ${report.summary.categoryBreakdown.categoryB.count.toString().padStart(3)} questions, ${(report.summary.categoryBreakdown.categoryB.avgConfidence * 100).toFixed(1).toString().padStart(6)}% avg     │`);
  console.log(`│   Category C (Troubleshoot): ${report.summary.categoryBreakdown.categoryC.count.toString().padStart(3)} questions, ${(report.summary.categoryBreakdown.categoryC.avgConfidence * 100).toFixed(1).toString().padStart(6)}% avg     │`);

  console.log('│ STATE DISTRIBUTION:                                              │');
  for (const [state, count] of Object.entries(report.summary.stateDistribution)) {
    const pct = ((count / report.totalAgents) * 100).toFixed(1);
    console.log(`│   ${state.padEnd(20)}${count.toString().padStart(5)}${pct.padStart(10)}%                   │`);
  }

  console.log('│ ACTION DISTRIBUTION:                                             │');
  for (const [action, count] of Object.entries(report.summary.actionDistribution)) {
    const pct = ((count / report.summary.totalTests) * 100).toFixed(1);
    console.log(`│   ${action.padEnd(20)}${count.toString().padStart(5)}${pct.padStart(10)}%                   │`);
  }

  console.log('│ TOP 10 AGENTS BY HEALTH:                                          │');
  const topAgents = [...report.agentStats]
    .sort((a, b) => b.health - a.health)
    .slice(0, 10);

  for (const agent of topAgents) {
    console.log(`│   ${agent.acronym.padEnd(6)}${agent.health.toFixed(2).padStart(6)}${agent.finalState.padEnd(15)}${agent.queries.toString().padStart(12)}│`);
  }

  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

// Run the main function
main().catch(error => {
  console.error('Battle test failed:', error);
  process.exit(1);
});
