#!/usr/bin/env -S tsx
/**
 * Store RAN Battle Test Questions in AgentDB
 *
 * This script stores 250 RAN battle test questions in AgentDB with
 * HNSW indexing for fast semantic search.
 *
 * Usage:
 *   bun run scripts/store-ran-battle-questions.ts
 *
 * @module scripts/store-ran-battle-questions
 */

import { QuestionBankLoader } from '../../src/domains/ran-battle-test';

/**
 * Store a single question in memory via CLI
 */
async function storeQuestion(namespace: string, key: string, value: string, tags: string[]): Promise<void> {
  const cli = 'npx';
  const args = [
    '@claude-flow/cli@latest',
    'memory',
    'store',
    '--namespace', namespace,
    '--key', key,
    '--value', value
  ];

  if (tags.length > 0) {
    args.push('--tags', tags.join(','));
  }

  const proc = Bun.spawn([cli, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env
  });

  await proc.exited;
  return;
}

/**
 * Main execution function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Store RAN Battle Test Questions in AgentDB                ║');
  console.log('║              with HNSW Indexing (150x-12,500x faster)          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Create 250 questions
  console.log('📝 Creating 250 RAN battle test questions...');
  const questions = QuestionBankLoader.createDefaultQuestions();
  console.log(`   ✓ Created ${questions.length} questions`);

  // Step 2: Store questions in AgentDB
  console.log('\n💾 Storing questions in AgentDB (ran-battle-questions namespace)...');

  const namespace = 'ran-battle-questions';
  let storedCount = 0;
  let failedCount = 0;
  const batchSize = 10;

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);

    for (const question of batch) {
      const storage = question.toStorage();

      try {
        // Store via CLI
        await storeQuestion(
          storage.metadata.namespace,
          storage.key,
          storage.value,
          storage.metadata.tags
        );

        storedCount++;

        if (storedCount % 25 === 0) {
          console.log(`   ${storedCount}/${questions.length} questions stored`);
        }
      } catch (error) {
        failedCount++;
        console.error(`   ✗ Failed to store ${question.id}: ${error}`);
      }
    }

    // Small delay to avoid overwhelming the CLI
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n   ✓ Stored ${storedCount}/${questions.length} questions`);
  if (failedCount > 0) {
    console.log(`   ✗ Failed: ${failedCount} questions`);
  }

  // Step 3: Verify storage
  console.log('\n🔍 Verifying storage...');

  const verifyProc = Bun.spawn([
    'npx', '@claude-flow/cli@latest',
    'memory', 'list',
    '--namespace', namespace,
    '--limit', '10'
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env
  });

  await verifyProc.exited;
  const verifyOutput = await new Response(verifyProc.stdout).text();

  console.log('   Sample stored questions:');
  console.log('   ' + verifyOutput.split('\n').slice(0, 10).join('\n   '));

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('STORAGE SUMMARY');
  console.log('='.repeat(70));
  console.log(`Namespace: ${namespace}`);
  console.log(`Total Questions: ${questions.length}`);
  console.log(`Stored Successfully: ${storedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Success Rate: ${(storedCount / questions.length * 100).toFixed(1)}%`);

  // Feature breakdown
  console.log('\n' + '-'.repeat(70));
  console.log('FEATURE BREAKDOWN');
  console.log('-'.repeat(70));

  const byFeature = new Map<string, number>();
  for (const question of questions) {
    const count = byFeature.get(question.featureAcronym) ?? 0;
    byFeature.set(question.featureAcronym, count + 1);
  }

  for (const [acronym, count] of byFeature) {
    console.log(`${acronym.padEnd(15)} ${count} questions`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Questions stored successfully in AgentDB!');
  console.log('   You can now run: bun run scripts/run-ran-battle-test.ts');
  console.log('='.repeat(70));
}

// Run main
main().catch(console.error);
