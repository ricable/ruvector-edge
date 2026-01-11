#!/usr/bin/env -S tsx
/**
 * RAN Battle Test Runner
 *
 * Executes the RAN Feature Agent Battle Testing Framework per ADR-025.
 *
 * Usage:
 *   bun run scripts/run-ran-battle-test.ts [mode]
 *
 * Modes:
 *   solo    - Each agent answers its 5 questions (default)
 *   battle  - Agents compete on questions
 *   stress  - Each agent answers all 250 questions
 *   ooda    - Detailed OODA loop validation
 *
 * @module scripts/run-ran-battle-test
 */

import { BattleTest, TestMode, QuestionBankLoader, DefaultQuestionBank } from '../../src/domains/ran-battle-test';
import { LTEFeatureAgentsFactory } from '../../src/domains/knowledge/aggregates/enhanced-feature-agent';

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0]?.toLowerCase() || 'solo';

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           RAN Feature Agent Battle Test Framework             ║');
  console.log('║                      ADR-025                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Map mode string to enum
  const testMode = mode === 'battle' ? TestMode.BATTLE :
                   mode === 'stress' ? TestMode.STRESS :
                   mode === 'ooda' ? TestMode.OODA_VALIDATION :
                   TestMode.SOLO;

  console.log(`Test Mode: ${mode.toUpperCase()}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Step 1: Create question bank (250 questions)
  console.log('📝 Loading question bank (250 questions)...');
  const questions = QuestionBankLoader.createDefaultQuestions();
  const questionBank = new DefaultQuestionBank(questions);
  console.log(`   ✓ Loaded ${questions.length} questions`);

  // Debug: Show which features have questions
  const featureCounts = new Map<string, number>();
  for (const q of questions) {
    featureCounts.set(q.featureAcronym, (featureCounts.get(q.featureAcronym) || 0) + 1);
  }
  console.log(`   ✓ Questions created for ${featureCounts.size} features`);

  // Show first 10 and last 10 features with questions
  const featuresWithQ = Array.from(featureCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`   First 10 features: ${featuresWithQ.slice(0, 10).map(f => `${f[0]}(${f[1]})`).join(', ')}`);
  console.log(`   Last 10 features: ${featuresWithQ.slice(-10).map(f => `${f[0]}(${f[1]})`).join(', ')}`);

  // Verify question distribution
  const knowledgeQuestions = questionBank.getCategoryQuestions('A' as any);
  const decisionQuestions = questionBank.getCategoryQuestions('B' as any);
  const advancedQuestions = questionBank.getCategoryQuestions('C' as any);

  console.log(`   - Knowledge (A): ${knowledgeQuestions.length} questions`);
  console.log(`   - Decision (B): ${decisionQuestions.length} questions`);
  console.log(`   - Advanced (C): ${advancedQuestions.length} questions`);
  console.log(`   - Total Points: ${questionBank.getTotalPoints()}`);

  // Step 2: Create 50 feature agents
  console.log('\n🤖 Creating 50 specialized RAN feature agents...');
  const agents = LTEFeatureAgentsFactory.createAll();
  console.log(`   ✓ Created ${agents.size} agents`);

  // Initialize all agents
  console.log('\n⚡ Initializing agents (loading knowledge)...');
  let initCount = 0;
  for (const [acronym, agent] of agents) {
    await agent.initialize();
    initCount++;
    if (initCount % 10 === 0) {
      console.log(`   ${initCount}/50 agents initialized`);
    }
  }
  console.log(`   ✓ All ${agents.size} agents initialized`);

  // Step 3: Create battle test
  console.log('\n🎮 Creating battle test...');
  const battleTest = BattleTest.create(
    questionBank,
    agents,
    {
      mode: testMode,
      parallel: mode === 'stress',  // Only parallel for stress test
      oodaValidation: true,
      qLearningThreshold: 0.7,
      timeout: 30000,
      verbose: true
    }
  );
  console.log(`   ✓ Battle test created: ${battleTest.id}`);

  // Step 4: Execute battle test
  console.log('\n🏁 Executing battle test...');
  const startTime = Date.now();

  try {
    const result = await battleTest.execute();

    const duration = Date.now() - startTime;
    console.log(`\n✅ Battle test completed in ${(duration / 1000).toFixed(2)}s`);

    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));

    console.log(`\nTotal Score: ${result.totalScore.toFixed(1)} / ${result.maxScore}`);
    console.log(`Percentage: ${(result.totalScore / result.maxScore * 100).toFixed(1)}%`);
    console.log(`Average OODA Latency: ${result.averageOodaLatency.toFixed(1)}ms`);
    console.log(`Average Confidence: ${(result.averageConfidence * 100).toFixed(1)}%`);

    // Display leaderboard
    console.log('\n' + '-'.repeat(70));
    console.log('LEADERBOARD (Top 20)');
    console.log('-'.repeat(70));

    const leaderboard = battleTest.getLeaderboard();
    leaderboard.slice(0, 20).forEach((entry, index) => {
      const bar = '█'.repeat(Math.floor(entry.percentage / 5));
      console.log(`${(index + 1).toString().padStart(2)}. ${entry.featureAcronym.padEnd(12)} ${bar.padEnd(20)} ${entry.percentage.toFixed(1)}%`);
    });

    // Display worst performers
    console.log('\n' + '-'.repeat(70));
    console.log('NEEDS IMPROVEMENT (Bottom 10)');
    console.log('-'.repeat(70));

    leaderboard.slice(-10).reverse().forEach((entry, index) => {
      const rank = leaderboard.length - index;
      const bar = '░'.repeat(Math.floor(entry.percentage / 5));
      console.log(`${rank.toString().padStart(2)}. ${entry.featureAcronym.padEnd(12)} ${bar.padEnd(20)} ${entry.percentage.toFixed(1)}%`);
    });

    // Category breakdown
    console.log('\n' + '-'.repeat(70));
    console.log('CATEGORY BREAKDOWN');
    console.log('-'.repeat(70));

    const results = battleTest.getResults();
    let totalKnowledge = 0;
    let totalDecision = 0;
    let totalAdvanced = 0;
    let totalKnowledgeMax = 0;
    let totalDecisionMax = 0;
    let totalAdvancedMax = 0;

    for (const result of results.values()) {
      totalKnowledge += result.knowledgeScore;
      totalDecision += result.decisionScore;
      totalAdvanced += result.advancedScore;

      // Calculate max scores per category from question results
      totalKnowledgeMax += result.questions
        .filter(q => q.questionId.includes('-K'))
        .reduce((sum, q) => sum + q.maxScore, 0);
      totalDecisionMax += result.questions
        .filter(q => q.questionId.includes('-D'))
        .reduce((sum, q) => sum + q.maxScore, 0);
      totalAdvancedMax += result.questions
        .filter(q => q.questionId.includes('-A'))
        .reduce((sum, q) => sum + q.maxScore, 0);
    }

    const knowledgePercent = totalKnowledgeMax > 0 ? (totalKnowledge / totalKnowledgeMax * 100) : 0;
    const decisionPercent = totalDecisionMax > 0 ? (totalDecision / totalDecisionMax * 100) : 0;
    const advancedPercent = totalAdvancedMax > 0 ? (totalAdvanced / totalAdvancedMax * 100) : 0;

    console.log(`Knowledge (A):    ${totalKnowledge.toFixed(1)}/${totalKnowledgeMax} (${knowledgePercent.toFixed(1)}%)`);
    console.log(`Decision (B):     ${totalDecision.toFixed(1)}/${totalDecisionMax} (${decisionPercent.toFixed(1)}%)`);
    console.log(`Advanced (C):     ${totalAdvanced.toFixed(1)}/${totalAdvancedMax} (${advancedPercent.toFixed(1)}%)`);

    // OODA and Q-Learning stats
    console.log('\n' + '-'.repeat(70));
    console.log('OODA & Q-LEARNING STATS');
    console.log('-'.repeat(70));

    let oodaEfficient = 0;
    let qLearningConverged = 0;

    for (const result of results.values()) {
      if (result.oodaEfficiency > 0.8) oodaEfficient++;
      if (result.qLearningConverged) qLearningConverged++;
    }

    console.log(`OODA Efficient (>80%): ${oodaEfficient}/${results.size}`);
    console.log(`Q-Learning Converged: ${qLearningConverged}/${results.size}`);

    // Generate full report
    const report = battleTest.generateReport();
    console.log('\n' + '='.repeat(70));
    console.log('FULL REPORT GENERATED');
    console.log('='.repeat(70));
    console.log('\n' + report);

    // Save report to file
    const reportPath = `./ran-battle-test-report-${Date.now()}.md`;
    await Bun.write(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Exit with appropriate code
    const passRate = result.totalScore / result.maxScore;
    if (passRate >= 0.8) {
      console.log('\n✅ Battle test PASSED');
      process.exit(0);
    } else if (passRate >= 0.6) {
      console.log('\n⚠️  Battle test PASSED with warnings');
      process.exit(0);
    } else {
      console.log('\n❌ Battle test FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Battle test failed with error:', error);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
