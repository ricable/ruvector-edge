#!/usr/bin/env npx ts-node --esm
/**
 * Test Script: Query Ericsson RAN Features from Skill
 *
 * Demonstrates domain-specific queries against the loaded skill data.
 * Run with: npx tsx scripts/test-skill-query.ts
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

async function main() {
  console.log('='.repeat(70));
  console.log('Ericsson RAN Feature Query Test');
  console.log('='.repeat(70));
  console.log();

  // Import modules
  const { loadSkillCatalog } = await import('../src/core/knowledge/index.js');
  const { Category, AccessTechnology } = await import('../src/core/types/index.js');

  // Load the catalog
  console.log('Loading feature catalog from skill...');
  const startTime = Date.now();
  const catalog = await loadSkillCatalog(PROJECT_ROOT);
  const loadTime = Date.now() - startTime;
  console.log(`Loaded in ${loadTime}ms\n`);

  // Print catalog stats
  const stats = catalog.getStats();
  console.log('Catalog Statistics:');
  console.log(`  Total Features: ${stats.totalFeatures}`);
  console.log(`  Total Parameters: ${stats.totalParameters}`);
  console.log(`  Total Counters: ${stats.totalCounters}`);
  console.log(`  Total KPIs: ${stats.totalKPIs}`);
  console.log();

  // =========================================================================
  // DOMAIN-SPECIFIC QUERIES
  // =========================================================================

  console.log('='.repeat(70));
  console.log('QUERY 1: What is MIMO Sleep Mode and how do I configure it?');
  console.log('='.repeat(70));

  const msmResults = catalog.searchByName('MIMO Sleep');
  if (msmResults.length > 0) {
    const msm = msmResults[0];
    console.log(`\nFeature: ${msm.name}`);
    console.log(`FAJ Code: ${msm.fajCode}`);
    console.log(`Category: ${msm.category}`);
    console.log(`Access Technology: ${msm.accessTechnology}`);
    console.log(`Description: ${msm.description?.substring(0, 200)}...`);
    console.log(`\nParameters (${msm.parameters.length} total):`);
    msm.parameters.slice(0, 10).forEach(p => {
      console.log(`  - ${p.name} (${p.dataType})`);
      if (p.description) console.log(`    ${p.description.substring(0, 60)}...`);
    });
    if (msm.parameters.length > 10) {
      console.log(`  ... and ${msm.parameters.length - 10} more`);
    }
    console.log(`\nCounters (${msm.counters.length} total):`);
    msm.counters.slice(0, 5).forEach(c => {
      console.log(`  - ${c.name}`);
    });
    console.log(`\nProcedures:`);
    msm.procedures.forEach(p => {
      console.log(`  - ${p.name}`);
      p.steps.slice(0, 3).forEach(s => {
        console.log(`    ${s.order}. ${s.description.substring(0, 60)}...`);
      });
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 2: What load balancing features are available?');
  console.log('='.repeat(70));

  const lbResults = catalog.searchByName('load balancing');
  console.log(`\nFound ${lbResults.length} features related to load balancing:\n`);
  lbResults.slice(0, 5).forEach(f => {
    console.log(`  ${f.name}`);
    console.log(`    FAJ: ${f.fajCode} | Params: ${f.parameters.length} | Category: ${f.category}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 3: List all Carrier Aggregation features');
  console.log('='.repeat(70));

  const caFeatures = catalog.getByCategory(Category.CarrierAggregation);
  console.log(`\nFound ${caFeatures.length} Carrier Aggregation features:\n`);
  caFeatures.slice(0, 10).forEach(f => {
    console.log(`  - ${f.name} (${f.fajCode})`);
  });
  if (caFeatures.length > 10) {
    console.log(`  ... and ${caFeatures.length - 10} more`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 4: What are the energy saving features?');
  console.log('='.repeat(70));

  const energyFeatures = catalog.getByCategory(Category.EnergySaving);
  console.log(`\nFound ${energyFeatures.length} Energy Saving features:\n`);
  energyFeatures.forEach(f => {
    console.log(`  - ${f.name}`);
    console.log(`    FAJ: ${f.fajCode}`);
    console.log(`    Params: ${f.parameters.length} | Counters: ${f.counters.length}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 5: What NR/5G features are available?');
  console.log('='.repeat(70));

  const nrFeatures = catalog.getByAccessTechnology(AccessTechnology.NR);
  console.log(`\nFound ${nrFeatures.length} NR/5G features\n`);
  console.log('Sample NR features:');
  nrFeatures.slice(0, 10).forEach(f => {
    console.log(`  - ${f.name} (${f.category})`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 6: Find features with "handover" in name');
  console.log('='.repeat(70));

  const hoResults = catalog.searchByName('handover');
  console.log(`\nFound ${hoResults.length} handover-related features:\n`);
  hoResults.slice(0, 8).forEach(f => {
    console.log(`  - ${f.name}`);
    console.log(`    FAJ: ${f.fajCode} | Tech: ${f.accessTechnology}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 7: Feature with most parameters');
  console.log('='.repeat(70));

  const allFeatures = catalog.getAll();
  const sortedByParams = [...allFeatures].sort(
    (a, b) => b.parameters.length - a.parameters.length
  );
  const topFeature = sortedByParams[0];
  console.log(`\nFeature with most parameters: ${topFeature.name}`);
  console.log(`  FAJ: ${topFeature.fajCode}`);
  console.log(`  Parameter count: ${topFeature.parameters.length}`);
  console.log(`  Counter count: ${topFeature.counters.length}`);
  console.log(`\nTop 5 features by parameter count:`);
  sortedByParams.slice(0, 5).forEach(f => {
    console.log(`  ${f.parameters.length.toString().padStart(3)} params - ${f.name}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('QUERY 8: Search for "Inter-Frequency Load Balancing" (IFLB)');
  console.log('='.repeat(70));

  const iflbResults = catalog.searchByName('IFLB');
  if (iflbResults.length > 0) {
    const iflb = iflbResults[0];
    console.log(`\nFeature: ${iflb.name}`);
    console.log(`FAJ: ${iflb.fajCode}`);
    console.log(`Category: ${iflb.category}`);
    console.log(`\nKey Parameters:`);
    iflb.parameters.slice(0, 8).forEach(p => {
      console.log(`  - ${p.name}`);
    });
    console.log(`\nDependencies: ${iflb.dependencies.length}`);
    iflb.dependencies.forEach(d => console.log(`  - ${d}`));
    console.log(`\nConflicts: ${iflb.conflicts.length}`);
    iflb.conflicts.forEach(c => console.log(`  - ${c}`));
  }

  console.log('\n' + '='.repeat(70));
  console.log('Test Complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
