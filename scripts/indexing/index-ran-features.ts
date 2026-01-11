#!/usr/bin/env bun
/**
 * Unified RAN Features Indexer
 *
 * Indexes 593 Ericsson RAN features into AgentDB namespaces with semantic search support.
 * Consolidates functionality from: index_ran_features.py, index_ran_batch.sh,
 * index_ran_optimized.sh, and index_ran_final.sh.
 *
 * @module scripts/indexing/index-ran-features
 */

import { $ } from 'bun';
import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

// Configuration
const CONFIG = {
  featuresDir: join(import.meta.dir, '../../.claude/skills/ericsson-ran-features/references'),
  cli: 'npx -y @claude-flow/cli@latest',
  namespaces: {
    features: 'ran-features',
    categories: 'ran-categories',
    acronyms: 'ran-acronyms',
    faj: 'ran-faj',
    cxc: 'ran-cxc',
    metadata: 'ran-index',
  },
  batchSize: 50,
  parallel: true,
};

// Types
interface Feature {
  name: string;
  acronym: string;
  faj: string;
  cxc: string | null;
  summary: string;
  prerequisites?: string[];
  parameters?: Record<string, unknown>;
}

interface IndexProgress {
  phase: string;
  current: number;
  total: number;
  item?: string;
}

interface IndexResult {
  success: boolean;
  featuresIndexed: number;
  categoriesIndexed: number;
  acronymsIndexed: number;
  errors: number;
  duration: number;
}

// Progress display
function displayProgress(progress: IndexProgress): void {
  const percentage = Math.round((progress.current / progress.total) * 100);
  const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
  process.stdout.write(`\r  [${bar}] ${percentage}% (${progress.current}/${progress.total}) ${progress.item || ''}`);
}

// Store to AgentDB via CLI
async function storeToMemory(namespace: string, key: string, value: string): Promise<boolean> {
  try {
    const result = await $`npx -y @claude-flow/cli@latest memory store --namespace ${namespace} --key ${key} --value ${JSON.stringify(value)}`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

// Load JSON file
async function loadJSON<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// Index categories
async function indexCategories(): Promise<number> {
  const categoriesPath = join(CONFIG.featuresDir, 'index_categories.json');
  const categories = await loadJSON<Record<string, string[]>>(categoriesPath);

  if (!categories) {
    console.log('  ⚠️  Categories file not found, skipping...');
    return 0;
  }

  const entries = Object.entries(categories);
  let indexed = 0;

  for (let i = 0; i < entries.length; i++) {
    const [category, features] = entries[i];
    const key = category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

    displayProgress({
      phase: 'categories',
      current: i + 1,
      total: entries.length,
      item: category.substring(0, 30),
    });

    const success = await storeToMemory(
      CONFIG.namespaces.categories,
      key,
      JSON.stringify({ category, features, count: features.length })
    );

    if (success) indexed++;
  }

  console.log('');
  return indexed;
}

// Index acronym mappings
async function indexAcronyms(): Promise<number> {
  const acronymsPath = join(CONFIG.featuresDir, 'index_acronym.json');
  const acronyms = await loadJSON<Record<string, string>>(acronymsPath);

  if (!acronyms) {
    console.log('  ⚠️  Acronyms file not found, skipping...');
    return 0;
  }

  const entries = Object.entries(acronyms);
  let indexed = 0;

  for (let i = 0; i < entries.length; i++) {
    const [acronym, fajId] = entries[i];

    if (i % 10 === 0) {
      displayProgress({
        phase: 'acronyms',
        current: i + 1,
        total: entries.length,
        item: acronym,
      });
    }

    const success = await storeToMemory(
      CONFIG.namespaces.acronyms,
      acronym.toLowerCase(),
      fajId
    );

    if (success) indexed++;
  }

  console.log('');
  return indexed;
}

// Index features with semantic data
async function indexFeatures(): Promise<number> {
  const featuresPath = join(CONFIG.featuresDir, 'features.json');
  const features = await loadJSON<Record<string, Feature>>(featuresPath);

  if (!features) {
    console.log('  ⚠️  Features file not found, skipping...');
    return 0;
  }

  const entries = Object.entries(features);
  let indexed = 0;

  // Process in batches for parallel execution
  for (let batch = 0; batch < entries.length; batch += CONFIG.batchSize) {
    const batchEntries = entries.slice(batch, batch + CONFIG.batchSize);

    const promises = batchEntries.map(async ([fajId, feature], batchIndex) => {
      const globalIndex = batch + batchIndex;

      if (globalIndex % 25 === 0) {
        displayProgress({
          phase: 'features',
          current: globalIndex + 1,
          total: entries.length,
          item: feature.acronym || fajId.substring(0, 15),
        });
      }

      // Determine category from FAJ ID
      const category = fajId.includes('121_4') ? 'carrier-aggregation' :
                       fajId.includes('121_3') ? 'radio-resource-mgmt' :
                       fajId.includes('121_5') ? 'nr-5g' : 'other';

      // Create semantic searchable text
      const summary = feature.summary?.substring(0, 300) || '';
      const searchableText = `${feature.name} ${feature.acronym} ${summary}`;

      // Store primary feature entry
      const featureStored = await storeToMemory(
        CONFIG.namespaces.features,
        `${category}:${fajId}`,
        searchableText
      );

      // Store FAJ reference
      if (feature.faj) {
        const fajRef = feature.faj.replace(/\s+/g, '');
        await storeToMemory(CONFIG.namespaces.faj, fajRef, fajId);
      }

      // Store CXC reference
      if (feature.cxc) {
        await storeToMemory(CONFIG.namespaces.cxc, feature.cxc, fajId);
      }

      return featureStored;
    });

    if (CONFIG.parallel) {
      const results = await Promise.all(promises);
      indexed += results.filter(Boolean).length;
    } else {
      for (const promise of promises) {
        if (await promise) indexed++;
      }
    }
  }

  console.log('');
  return indexed;
}

// Create metadata
async function createMetadata(stats: { features: number; categories: number; acronyms: number }): Promise<void> {
  const metadata = {
    total_features: stats.features,
    categories_indexed: stats.categories,
    acronyms_indexed: stats.acronyms,
    indexed_at: new Date().toISOString(),
    namespaces: CONFIG.namespaces,
    examples: [
      'IFLB Inter-Frequency Load Balancing',
      'MSM MIMO Sleep Mode',
      'NR Dual Connectivity EN-DC',
      'Carrier Aggregation 4CC',
    ],
  };

  await storeToMemory(CONFIG.namespaces.metadata, 'metadata', JSON.stringify(metadata));
}

// Main indexing function
async function indexRANFeatures(): Promise<IndexResult> {
  const startTime = Date.now();
  let errors = 0;

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           RAN Features Unified Indexer                         ║');
  console.log('║                    TypeScript + Bun                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Verify data files exist
  if (!existsSync(CONFIG.featuresDir)) {
    console.error(`❌ Error: Features directory not found: ${CONFIG.featuresDir}`);
    process.exit(1);
  }

  const featuresPath = join(CONFIG.featuresDir, 'features.json');
  if (!existsSync(featuresPath)) {
    console.error('❌ Error: features.json not found');
    process.exit(1);
  }

  // Count total features
  const features = await loadJSON<Record<string, Feature>>(featuresPath);
  const totalFeatures = features ? Object.keys(features).length : 0;
  console.log(`📊 Total Features: ${totalFeatures}`);
  console.log(`⚡ Mode: ${CONFIG.parallel ? 'Parallel' : 'Sequential'} (batch size: ${CONFIG.batchSize})`);
  console.log('');

  // Step 1: Index Categories
  console.log('[1/4] Indexing Categories...');
  const categoriesIndexed = await indexCategories();
  console.log(`  ✓ Categories indexed: ${categoriesIndexed}`);
  console.log('');

  // Step 2: Index Acronyms
  console.log('[2/4] Indexing Acronym Mappings...');
  const acronymsIndexed = await indexAcronyms();
  console.log(`  ✓ Acronyms indexed: ${acronymsIndexed}`);
  console.log('');

  // Step 3: Index Features
  console.log('[3/4] Indexing Features (semantic)...');
  const featuresIndexed = await indexFeatures();
  console.log(`  ✓ Features indexed: ${featuresIndexed}`);
  console.log('');

  // Step 4: Create Metadata
  console.log('[4/4] Creating search metadata...');
  await createMetadata({
    features: featuresIndexed,
    categories: categoriesIndexed,
    acronyms: acronymsIndexed,
  });
  console.log('  ✓ Metadata created');
  console.log('');

  const duration = Date.now() - startTime;

  // Summary
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('✅ Indexing Complete!');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 Statistics:');
  console.log(`  • Features:   ${featuresIndexed}`);
  console.log(`  • Categories: ${categoriesIndexed}`);
  console.log(`  • Acronyms:   ${acronymsIndexed}`);
  console.log(`  • Errors:     ${errors}`);
  console.log(`  • Duration:   ${(duration / 1000).toFixed(2)}s`);
  console.log('');
  console.log('🔍 Search Examples:');
  console.log("  npx @claude-flow/cli@latest memory search --query 'IFLB load balancing' --namespace ran-features");
  console.log("  npx @claude-flow/cli@latest memory retrieve --key 'iflb' --namespace ran-acronyms");
  console.log("  npx @claude-flow/cli@latest memory list --namespace ran-features --limit 20");
  console.log('');

  return {
    success: true,
    featuresIndexed,
    categoriesIndexed,
    acronymsIndexed,
    errors,
    duration,
  };
}

// CLI handling
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
RAN Features Unified Indexer

Usage:
  bun run scripts/indexing/index-ran-features.ts [options]

Options:
  --help, -h        Show this help message
  --sequential      Use sequential processing instead of parallel
  --batch-size N    Set batch size for parallel processing (default: 50)
  --dry-run         Show what would be indexed without actually indexing

Examples:
  bun run scripts/indexing/index-ran-features.ts
  bun run scripts/indexing/index-ran-features.ts --sequential
  bun run scripts/indexing/index-ran-features.ts --batch-size 100
`);
    process.exit(0);
  }

  if (args.includes('--sequential')) {
    CONFIG.parallel = false;
  }

  const batchSizeIndex = args.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    CONFIG.batchSize = parseInt(args[batchSizeIndex + 1], 10) || 50;
  }

  if (args.includes('--dry-run')) {
    console.log('Dry run mode - would index:');
    console.log(`  Features directory: ${CONFIG.featuresDir}`);
    console.log(`  Namespaces: ${Object.values(CONFIG.namespaces).join(', ')}`);
    console.log(`  Parallel: ${CONFIG.parallel}`);
    console.log(`  Batch size: ${CONFIG.batchSize}`);
    process.exit(0);
  }

  try {
    await indexRANFeatures();
  } catch (error) {
    console.error('❌ Indexing failed:', error);
    process.exit(1);
  }
}

// Run
main();
