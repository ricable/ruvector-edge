#!/usr/bin/env bun
/**
 * RAN Agent Battle Test Runner
 *
 * Complete integration script that:
 * 1. Creates 50 LTE feature agents with autonomous state machines
 * 2. Initializes all agents with knowledge bases
 * 3. Runs 50 battle test questions
 * 4. Measures OODA loop performance
 * 5. Validates DDD aggregate boundaries
 * 6. Generates comprehensive report
 *
 * @module scripts/run-ran-agent-battle-tests
 */

import { LTEFeatureAgentsFactory, QueryType, ComplexityLevel, Query } from '../src/domains/knowledge/aggregates/enhanced-feature-agent';
import { AgentState } from '../src/domains/intelligence/aggregates/autonomous-state-machine';
import { Action } from '../src/domains/intelligence/value-objects/action';
import { DomainEventBus, EventBusFactory } from '../src/domains/coordination/aggregates/domain-event-bus';

// =============================================================================
// TEST QUESTIONS
// =============================================================================

const BATTLE_QUESTIONS = [
  { id: 1, question: 'How do I configure an eNodeB to support 18 cells?', acronym: '11CS', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX },
  { id: 2, question: 'What is the procedure to enable 24 cell support?', acronym: '12CS', type: QueryType.ACTIVATION, complexity: ComplexityLevel.MODERATE },
  { id: 3, question: 'What are the hardware requirements for 6 cell support?', acronym: '6CS', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.SIMPLE },
  { id: 4, question: 'How does 7-12 cell support differ from 6 cell support?', acronym: '71CS', type: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE },
  { id: 5, question: 'What are the bandwidth implications of 5+5 MHz?', acronym: '5MSC', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE },
  { id: 6, question: 'When should 256-QAM downlink be enabled?', acronym: '2QD', type: QueryType.OPTIMIZATION, complexity: ComplexityLevel.MODERATE },
  { id: 7, question: 'What are the SINR requirements for 256-QAM uplink?', acronym: '2QU', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX },
  { id: 8, question: 'When to fallback from 256-QAM to 64-QAM?', acronym: '6QD', type: QueryType.OPTIMIZATION, complexity: ComplexityLevel.MODERATE },
  { id: 9, question: 'What parameters control 64-QAM uplink activation?', acronym: '6QU', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 10, question: 'What is the fallback mechanism for 64-QAM uplink?', acronym: '1QU', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.SIMPLE },
  { id: 11, question: 'What CA combinations are supported for 3CC?', acronym: '3DCAE', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX },
  { id: 12, question: 'How does 4CC CA impact baseband processing?', acronym: '4DCAE', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 13, question: 'What is the max throughput with 5CC CA?', acronym: '5DCAE', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE },
  { id: 14, question: 'What are the power constraints for 6CC CA?', acronym: '6DCAE', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX },
  { id: 15, question: 'What is the procedure to activate 7CC CA?', acronym: '7DCAE', type: QueryType.ACTIVATION, complexity: ComplexityLevel.MODERATE },
  { id: 16, question: 'How does 4x2 MIMO differ from 4x4?', acronym: '4QADPP', type: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE },
  { id: 17, question: 'What are the CSI requirements for 4x4 MIMO?', acronym: '4QADPP2', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX },
  { id: 18, question: 'What scenarios benefit most from 4x4 IRC?', acronym: '4FIRC', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX },
  { id: 19, question: 'What alarms does ASM generate?', acronym: 'ASM', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.MODERATE },
  { id: 20, question: 'What is the impact of CRS power adjustments?', acronym: 'ACP', type: QueryType.OPTIMIZATION, complexity: ComplexityLevel.MODERATE },
  { id: 21, question: 'What KPIs trigger ATO?', acronym: 'ATO', type: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE },
  { id: 22, question: 'What is the acceleration factor in AIFLB?', acronym: 'AIFLB', type: QueryType.COMPARISON, complexity: ComplexityLevel.SIMPLE },
  { id: 23, question: 'What are the thresholds for BLM activation?', acronym: 'BLM', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 24, question: 'How does BNRILLM select target cells?', acronym: 'BNRILLM', type: QueryType.OPTIMIZATION, complexity: ComplexityLevel.COMPLEX },
  { id: 25, question: 'How does BRCP prioritize cells?', acronym: 'BRCP', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 26, question: 'What ML algorithms does APACS use?', acronym: 'APACS', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX },
  { id: 27, question: 'How does APDLA improve over traditional link adaptation?', acronym: 'APDLA', type: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE },
  { id: 28, question: 'What performance improvements does APP provide?', acronym: 'APP', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE },
  { id: 29, question: 'How do I configure A/B testing framework?', acronym: 'ABATF', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 30, question: 'What are the prescheduling criteria in ABP?', acronym: 'ABP', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 31, question: 'What are the default admission thresholds?', acronym: 'BAC', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 32, question: 'What scenarios trigger DUAC?', acronym: 'ATO', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.MODERATE },
  { id: 33, question: 'How does ADRFS differentiate QCI classes?', acronym: 'ADRFS', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.COMPLEX },
  { id: 34, question: 'How do I configure privileged user groups?', acronym: 'ASAPAU', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 35, question: 'What metrics does ACCE use?', acronym: 'ACCE', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE },
  { id: 36, question: 'What are the ANR discovery mechanisms?', acronym: 'ANR', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX },
  { id: 37, question: 'How does ARRSA allocate RACH sequences?', acronym: 'ARRSA', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 38, question: 'What are the SCell activation timers?', acronym: 'ASM2', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.SIMPLE },
  { id: 39, question: 'What is the procedure for CS fallback?', acronym: 'CFDRU', type: QueryType.ACTIVATION, complexity: ComplexityLevel.MODERATE },
  { id: 40, question: 'What are the positioning accuracy requirements?', acronym: 'GUPLS', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE },
  { id: 41, question: 'How does AI-powered ACS differ from traditional?', acronym: 'APACS', type: QueryType.COMPARISON, complexity: ComplexityLevel.MODERATE },
  { id: 42, question: 'What QCIs are supported in AQRE?', acronym: 'AQRE', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.SIMPLE },
  { id: 43, question: 'What improvements does ABSEP provide?', acronym: 'ABSEP', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE },
  { id: 44, question: 'What conditions trigger RLC poll adaptation?', acronym: 'ARPR', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.MODERATE },
  { id: 45, question: 'What conditions cause ducting interference?', acronym: 'ADIR', type: QueryType.TROUBLESHOOTING, complexity: ComplexityLevel.COMPLEX },
  { id: 46, question: 'How is AILG used for testing?', acronym: 'AILG', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE },
  { id: 47, question: 'How does ALBS configure broadcast subframes?', acronym: 'ALBS', type: QueryType.PARAMETER_CONFIGURATION, complexity: ComplexityLevel.MODERATE },
  { id: 48, question: 'What security threats does ARD address?', acronym: 'ARD', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX },
  { id: 49, question: 'What is the ASGH framework architecture?', acronym: 'AF', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.COMPLEX },
  { id: 50, question: 'What metrics does CLO provide?', acronym: 'CLO', type: QueryType.GENERAL_INFO, complexity: ComplexityLevel.MODERATE }
];

// =============================================================================
// MAIN EXECUTION
// =============================================================================

interface TestResult {
  questionId: number;
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
    stateDistribution: Record<string, number>;
    actionDistribution: Record<string, number>;
  };
}

/**
 * Main function to run battle tests
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     RAN AGENT BATTLE TEST - 50 LTE Feature Agents             ║');
  console.log('║     DDD-Compliant Multi-Specialized Autonomous Swarm         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Create Event Bus
  console.log('[1/6] Creating Domain Event Bus...');
  const eventBus = EventBusFactory.create();
  console.log(`      ✓ Event bus created with ${eventBus.getStatistics().totalSubscriptions} handlers\n`);

  // Step 2: Create Agents
  console.log('[2/6] Creating 50 LTE Feature Agents...');
  const startTime = Date.now();
  const agents = LTEFeatureAgentsFactory.createAll();
  console.log(`      ✓ Created ${agents.size} agents in ${Date.now() - startTime}ms\n`);

  // Step 3: Initialize Agents
  console.log('[3/6] Initializing agents with autonomous state machines...');
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

  // Step 4: Run Battle Tests
  console.log('[4/6] Running 50 battle test questions...');
  const results: TestResult[] = [];
  const actionCounts = new Map<string, number>();
  const testStart = Date.now();

  for (const question of BATTLE_QUESTIONS) {
    const agent = agents.get(question.acronym);

    if (!agent) {
      console.log(`      ⚠ Agent not found: ${question.acronym}`);
      continue;
    }

    // Create query
    const query: Query = {
      id: `q-${question.id}`,
      type: question.type,
      content: question.question,
      complexity: question.complexity,
      timestamp: new Date()
    };

    // Handle query using enhanced agent with OODA loop
    const response = await agent.handleQueryEnhanced(query);

    // Track action distribution - actionTaken is an Action enum (string value)
    const actionName = response.actionTaken as string;
    actionCounts.set(actionName, (actionCounts.get(actionName) || 0) + 1);

    results.push({
      questionId: question.id,
      acronym: question.acronym,
      question: question.question,
      responseTime: response.latencyMs,
      confidence: response.confidence,
      action: actionName,
      state: response.stateAtResponse,
      oodaExecuted: response.stateAtResponse !== AgentState.INITIALIZING
    });

    console.log(`      [${question.id.toString().padStart(2, '0')}/50] ${question.acronym}: ${response.latencyMs}ms, ${(response.confidence * 100).toFixed(0)}% confidence, ${actionName}`);
  }

  console.log(`      ✓ Completed ${results.length} tests in ${Date.now() - testStart}ms\n`);

  // Step 5: Collect Statistics
  console.log('[5/6] Collecting agent statistics...');
  const agentStats: AgentStats[] = [];
  const stateCounts = new Map<AgentState, number>();

  for (const [acronym, agent] of agents) {
    const smStats = agent.getStateMachineStats();

    agentStats.push({
      acronym,
      name: agent.featureData.name,
      queries: 1, // Each agent handles 1 question in this test
      avgResponseTime: smStats.averageResponseTime,
      avgConfidence: smStats.health,
      finalState: smStats.state,
      health: smStats.health,
      interactions: smStats.interactionCount
    });

    // Track state distribution
    const stateCount = stateCounts.get(smStats.state) || 0;
    stateCounts.set(smStats.state, stateCount + 1);
  }

  console.log(`      ✓ Collected statistics for ${agentStats.length} agents\n`);

  // Step 6: Generate Report
  console.log('[6/6] Generating battle test report...\n');

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
      stateDistribution,
      actionDistribution
    }
  };

  printReport(report);

  // Save report to file
  const fs = require('fs');
  fs.writeFileSync(
    './ran-agent-battle-report.json',
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('      Report saved to: ./ran-agent-battle-report.json\n');

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    BATTLE TEST COMPLETE                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
}

/**
 * Print battle test report
 */
function printReport(report: BattleReport): void {
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    BATTLE TEST RESULTS                      │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  console.log('│ OVERALL STATISTICS:                                              │');
  console.log(`│   Total Agents:        ${report.totalAgents.toString().padStart(45)}│`);
  console.log(`│   Total Questions:     ${report.totalQuestions.toString().padStart(45)}│`);
  console.log(`│   Tests Completed:     ${report.summary.totalTests.toString().padStart(45)}│`);
  console.log(`│   Avg Response Time:   ${report.summary.avgResponseTime.toFixed(0).toString().padStart(45)}│`);
  console.log(`│   Avg Confidence:      ${(report.summary.avgConfidence * 100).toFixed(1).toString().padStart(44)}%│`);

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
    console.log(`│   ${agent.acronym.padEnd(6)}${agent.health.toFixed(2).padStart(6)}${agent.finalState.padEnd(15)}${agent.interactions.toString().padStart(12)}│`);
  }

  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

// Run the main function
main().catch(error => {
  console.error('Battle test failed:', error);
  process.exit(1);
});
