#!/usr/bin/env bun
/**
 * AgentDB Feature Loader for Ericsson RAN Features
 * 
 * Enhanced version that loads markdown files with full content extraction
 * and stores them in the elex-features namespace for agent training.
 *
 * Usage:
 *   bun run scripts/load-elex-features-to-agentdb.ts [--limit N] [--namespace NAME] [--dry-run] [--verbose]
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name: string, defaultVal: string): string => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
};
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const CONFIG = {
  sourceDir: join(process.cwd(), 'docs', 'elex_features'),
  namespace: getArg('namespace', 'elex-features'),
  batchSize: 10,
  limit: parseInt(getArg('limit', '0')) || 0,
  dryRun: hasFlag('dry-run'),
  verbose: hasFlag('verbose'),
};

interface FeatureDocument {
  key: string;
  content: string;
  title: string;
  summary: string;
  fajCode?: string;
  category: string;
  accessType?: string;
  relativePath: string;
  sections: string[];
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'images') {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract sections from markdown content
 */
function extractSections(content: string): string[] {
  const sections: string[] = [];
  const headingPattern = /^#{1,3}\s+(.+)$/gm;
  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    sections.push(match[1].trim());
  }
  return sections;
}

/**
 * Clean content by removing images and excessive whitespace
 */
function cleanContent(content: string): string {
  return content
    .replace(/!\[Image\]\([^)]+\)/g, '') // Remove image references
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
    .replace(/\|[-|:\s]+\|/g, '') // Remove table separators
    .trim();
}

/**
 * Categorize feature based on content
 */
function categorizeFeature(content: string): string {
  const lowerContent = content.toLowerCase();

  const categories: [string, string[]][] = [
    ['Carrier Aggregation', ['carrier aggregation', '2cc', '3cc', '4cc', '5cc', 'scell', 'pcell']],
    ['NR/5G', [' nr ', '5g-nr', 'new radio', 'standalone', 'nsa']],
    ['MIMO & Antenna', ['mimo', 'beamforming', 'antenna', 'massive mimo', '8t8r', '64t64r']],
    ['Mobility', ['handover', 'anr', 'mobility', 'cell selection', 'reselection']],
    ['Energy Saving', ['energy saving', 'cell sleep', 'power saving', 'lean carrier']],
    ['Voice & IMS', ['volte', 'vonr', 'voice', 'ims', 'voip', 'tti bundling']],
    ['Radio Resource Management', ['scheduler', 'qos', 'admission', 'congestion', 'load balancing']],
    ['Transport', ['fronthaul', 'backhaul', 'transport', 'cpri', 'ecpri']],
    ['Security', ['security', 'encryption', 'integrity', 'authentication']],
    ['SON', ['son', 'self-organizing', 'self-healing', 'self-configuring']],
  ];

  for (const [category, keywords] of categories) {
    if (keywords.some(kw => lowerContent.includes(kw))) {
      return category;
    }
  }
  return 'Other';
}

/**
 * Parse a markdown file into a feature document
 */
function parseFeatureDocument(filePath: string): FeatureDocument | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(CONFIG.sourceDir, filePath);

    // Skip frontmatter
    const lines = content.split('\n');
    let bodyStart = 0;
    if (lines[0]?.trim() === '---') {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          bodyStart = i + 1;
          break;
        }
      }
    }
    const bodyContent = lines.slice(bodyStart).join('\n');

    // Extract title
    const titleMatch = bodyContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : basename(filePath, '.md');

    // Extract FAJ code
    const fajMatch = bodyContent.match(/FAJ\s+(\d+)\s+(\d+)/);
    const fajCode = fajMatch ? `${fajMatch[1]}-${fajMatch[2]}` : undefined;

    // Extract access type
    const accessMatch = bodyContent.match(/\|\s*Access Type\s*\|\s*([^|]+)\s*\|/);
    const accessType = accessMatch ? accessMatch[1].trim() : undefined;

    // Extract summary from Overview section
    const overviewMatch = bodyContent.match(/#.*Overview\s+(.+?)(?=\n#|\n##|$)/s);
    const summary = overviewMatch
      ? cleanContent(overviewMatch[1]).substring(0, 500)
      : cleanContent(bodyContent.substring(0, 500));

    // Extract sections
    const sections = extractSections(bodyContent);

    // Categorize
    const category = categorizeFeature(bodyContent);

    // Generate key
    const keyParts = [fajCode, title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)].filter(Boolean);
    const hash = Buffer.from(relativePath).toString('base64').substring(0, 6);
    const key = [...keyParts, hash].join(':') || basename(filePath, '.md');

    return {
      key,
      content: cleanContent(bodyContent).substring(0, 4000), // Limit content size
      title,
      summary,
      fajCode,
      category,
      accessType,
      relativePath,
      sections,
    };
  } catch (error: any) {
    console.error(`❌ Failed to parse ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Store a feature document in AgentDB
 */
function storeDocument(doc: FeatureDocument): boolean {
  try {
    // Create a rich embedding text
    const embeddingText = [
      `# ${doc.title}`,
      doc.fajCode ? `Feature Identity: FAJ ${doc.fajCode}` : '',
      `Category: ${doc.category}`,
      doc.accessType ? `Access Type: ${doc.accessType}` : '',
      '',
      '## Summary',
      doc.summary,
      '',
      '## Sections',
      doc.sections.join(', '),
      '',
      '## Content',
      doc.content,
    ].filter(Boolean).join('\n');

    const result = spawnSync('npx', [
      '@claude-flow/cli@latest',
      'memory', 'store',
      '--key', doc.key,
      '--value', embeddingText,
      '--namespace', CONFIG.namespace,
    ], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      if (CONFIG.verbose) {
        console.error(`\n  Error: ${result.stderr}`);
      }
      return false;
    }

    return true;
  } catch (error: any) {
    if (CONFIG.verbose) {
      console.error(`\n❌ Store failed for ${doc.key}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Ericsson RAN Features → AgentDB Feature Loader               ║');
  console.log('║  Full content extraction for agent training                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`📁 Source:    ${CONFIG.sourceDir}`);
  console.log(`📦 Namespace: ${CONFIG.namespace}`);
  if (CONFIG.limit) console.log(`🔢 Limit:     ${CONFIG.limit} files`);
  if (CONFIG.dryRun) console.log(`🧪 Mode:      DRY RUN`);
  console.log('');

  // Find files
  console.log('🔍 Scanning for markdown files...');
  let filePaths = findMarkdownFiles(CONFIG.sourceDir);
  console.log(`   Found ${filePaths.length} files\n`);

  if (filePaths.length === 0) {
    console.error('❌ No markdown files found');
    process.exit(1);
  }

  // Apply limit
  if (CONFIG.limit > 0) {
    filePaths = filePaths.slice(0, CONFIG.limit);
  }

  // Parse all documents
  console.log('📝 Parsing documents...');
  const documents: FeatureDocument[] = [];
  const categoryCount: Record<string, number> = {};

  for (const path of filePaths) {
    const doc = parseFeatureDocument(path);
    if (doc) {
      documents.push(doc);
      categoryCount[doc.category] = (categoryCount[doc.category] || 0) + 1;
    }
  }

  console.log(`   Parsed ${documents.length} documents\n`);

  // Category breakdown
  console.log('📊 Category Breakdown:');
  Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));
  console.log('');

  // Dry run
  if (CONFIG.dryRun) {
    console.log('🧪 DRY RUN - Sample documents:\n');
    documents.slice(0, 3).forEach((doc, i) => {
      console.log(`--- Document ${i + 1} ---`);
      console.log(`Key: ${doc.key}`);
      console.log(`Title: ${doc.title}`);
      console.log(`Category: ${doc.category}`);
      console.log(`Summary: ${doc.summary.substring(0, 150)}...`);
      console.log(`Sections: ${doc.sections.slice(0, 5).join(', ')}`);
      console.log('');
    });
    return;
  }

  // Store documents
  console.log('💾 Storing documents in AgentDB...\n');
  let success = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i += CONFIG.batchSize) {
    const batch = documents.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(documents.length / CONFIG.batchSize);

    process.stdout.write(`Batch ${batchNum}/${totalBatches}: `);

    for (const doc of batch) {
      if (storeDocument(doc)) {
        success++;
        process.stdout.write('✓');
      } else {
        failed++;
        process.stdout.write('✗');
      }
    }
    console.log(` [${success}/${i + batch.length}]`);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Loading Complete                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`📊 Total:     ${documents.length}`);
  console.log(`✅ Success:   ${success}`);
  console.log(`❌ Failed:    ${failed}`);
  console.log(`📦 Namespace: ${CONFIG.namespace}\n`);

  // Test search
  if (success > 0) {
    console.log('🔍 Testing search...\n');
    const testQueries = ['TTI bundling', 'carrier aggregation', 'handover'];

    for (const query of testQueries) {
      try {
        const result = spawnSync('npx', [
          '@claude-flow/cli@latest',
          'memory', 'search',
          '--query', query,
          '--namespace', CONFIG.namespace,
          '--limit', '2',
        ], {
          cwd: process.cwd(),
          encoding: 'utf-8',
          timeout: 15000,
        });

        if (result.status === 0) {
          console.log(`Query: "${query}"`);
          // Print first few lines of output
          const lines = result.stdout.split('\n').slice(0, 8);
          console.log(lines.join('\n'));
          console.log('');
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }

  console.log('✨ Usage:');
  console.log(`   npx @claude-flow/cli memory search --query "VoLTE" --namespace ${CONFIG.namespace}`);
  console.log(`   npx @claude-flow/cli memory list --namespace ${CONFIG.namespace}`);
  console.log(`   npx @claude-flow/cli memory stats\n`);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
