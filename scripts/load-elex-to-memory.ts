#!/usr/bin/env bun
/**
 * AgentDB Memory Loader for Ericsson RAN Features
 * 
 * Loads all markdown files from docs/elex_features into AgentDB memory
 * with vector embeddings for self-learning multi-agent training.
 *
 * Usage:
 *   bun run scripts/load-elex-to-memory.ts [--limit N] [--namespace NAME] [--dry-run]
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';

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
  namespace: getArg('namespace', 'elex-ran-features'),
  batchSize: 20,
  limit: parseInt(getArg('limit', '0')) || 0,
  dryRun: hasFlag('dry-run'),
  verbose: hasFlag('verbose'),
};

interface FeatureMetadata {
  featureName?: string;
  featureIdentity?: string;
  fajCode?: string;
  valuePackage?: string;
  accessType?: string;
  nodeType?: string;
  category?: string;
  complexityScore?: number;
  qualityScore?: number;
  tags: string[];
  sourceFile: string;
  relativePath: string;
}

interface MemoryEntry {
  key: string;
  value: string;
  metadata: FeatureMetadata;
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) {
    console.error(`❌ Directory not found: ${dir}`);
    return files;
  }

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
 * Extract metadata from markdown content
 */
function extractMetadata(content: string, sourcePath: string, relativePath: string): FeatureMetadata {
  const metadata: FeatureMetadata = {
    sourceFile: sourcePath,
    relativePath,
    tags: [],
  };

  const lines = content.split('\n');

  // Parse YAML frontmatter
  let inFrontmatter = false;
  let frontmatterEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        frontmatterEnd = i + 1;
        break;
      }
    } else if (inFrontmatter) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'complexity_score') metadata.complexityScore = parseFloat(value);
        if (key === 'quality_score') metadata.qualityScore = parseFloat(value);
      }
    }
  }

  const bodyContent = lines.slice(frontmatterEnd).join('\n');

  // Extract feature name from first heading
  const headingMatch = bodyContent.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    metadata.featureName = headingMatch[1].trim();
  }

  // Extract FAJ code and feature identity
  const fajMatch = bodyContent.match(/FAJ\s+(\d+)\s+(\d+)/);
  if (fajMatch) {
    metadata.featureIdentity = `FAJ ${fajMatch[1]} ${fajMatch[2]}`;
    metadata.fajCode = `${fajMatch[1]}-${fajMatch[2]}`;
    metadata.tags.push(`faj:${metadata.fajCode}`);
  }

  // Extract table fields
  const extractTableField = (pattern: RegExp): string | undefined => {
    const match = bodyContent.match(pattern);
    return match ? match[1].trim() : undefined;
  };

  metadata.valuePackage = extractTableField(/\|\s*Value Package Name\s*\|\s*([^|]+)\s*\|/);
  metadata.accessType = extractTableField(/\|\s*Access Type\s*\|\s*([^|]+)\s*\|/);
  metadata.nodeType = extractTableField(/\|\s*Node Type\s*\|\s*([^|]+)\s*\|/);

  // Add access type as tag
  if (metadata.accessType) {
    metadata.tags.push(metadata.accessType.toLowerCase());
  }

  // Determine category based on content
  const lowerContent = bodyContent.toLowerCase();
  if (lowerContent.includes('carrier aggregation') || lowerContent.includes(' ca ')) {
    metadata.category = 'Carrier Aggregation';
  } else if (lowerContent.includes(' nr ') && (lowerContent.includes('5g') || lowerContent.includes('standalone'))) {
    metadata.category = 'NR/5G';
  } else if (lowerContent.includes('mimo') || lowerContent.includes('beamforming')) {
    metadata.category = 'MIMO & Antenna';
  } else if (lowerContent.includes('handover') || lowerContent.includes('mobility')) {
    metadata.category = 'Mobility';
  } else if (lowerContent.includes('energy') || lowerContent.includes('sleep')) {
    metadata.category = 'Energy Saving';
  } else if (lowerContent.includes('volte') || lowerContent.includes('voice')) {
    metadata.category = 'Voice & IMS';
  } else if (lowerContent.includes('scheduler') || lowerContent.includes('qos')) {
    metadata.category = 'Radio Resource Management';
  } else {
    metadata.category = 'Other';
  }

  metadata.tags.push(metadata.category.toLowerCase().replace(/\s+/g, '-'));

  return metadata;
}

/**
 * Generate a unique memory key
 */
function generateKey(metadata: FeatureMetadata, relativePath: string): string {
  const parts: string[] = [];

  if (metadata.fajCode) {
    parts.push(metadata.fajCode);
  }

  if (metadata.featureName) {
    const sanitized = metadata.featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
    parts.push(sanitized);
  }

  if (parts.length === 0) {
    parts.push(basename(relativePath, '.md'));
  }

  // Add short hash for uniqueness
  const hash = Buffer.from(relativePath).toString('base64').substring(0, 6);
  parts.push(hash);

  return parts.join(':');
}

/**
 * Create a memory entry from a file
 */
function createEntry(filePath: string): MemoryEntry | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(CONFIG.sourceDir, filePath);
    const metadata = extractMetadata(content, filePath, relativePath);

    // Extract summary from Overview section
    const summaryMatch = content.match(/#.*Overview\s+(.+?)(?=\n#|\n##|$)/s);
    const summary = summaryMatch
      ? summaryMatch[1].replace(/!\[Image\]\([^)]+\)/g, '').trim().substring(0, 400)
      : '';

    // Create rich text for embedding
    const value = [
      `Feature: ${metadata.featureName || 'Unknown'}`,
      `Identity: ${metadata.featureIdentity || 'N/A'}`,
      `Category: ${metadata.category || 'N/A'}`,
      `Access Type: ${metadata.accessType || 'N/A'}`,
      `Value Package: ${metadata.valuePackage || 'N/A'}`,
      `Summary: ${summary}`,
      `Tags: ${metadata.tags.join(', ')}`,
      `Source: ${relativePath}`,
    ].join('\n');

    return {
      key: generateKey(metadata, relativePath),
      value,
      metadata,
    };
  } catch (error: any) {
    console.error(`❌ Failed to process ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Store a memory entry using claude-flow CLI
 */
function storeMemory(entry: MemoryEntry): boolean {
  try {
    // Use spawnSync for better handling of special characters
    const args = [
      '@claude-flow/cli@latest',
      'memory', 'store',
      '--key', entry.key,
      '--value', entry.value,
      '--namespace', CONFIG.namespace,
    ];

    const result = spawnSync('npx', args, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      if (CONFIG.verbose) {
        console.error(`\n  stderr: ${result.stderr}`);
      }
      return false;
    }

    return true;
  } catch (error: any) {
    if (CONFIG.verbose) {
      console.error(`\n❌ Store failed for ${entry.key}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Ericsson RAN Features → AgentDB Memory Loader             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📁 Source:    ${CONFIG.sourceDir}`);
  console.log(`📦 Namespace: ${CONFIG.namespace}`);
  if (CONFIG.limit) console.log(`🔢 Limit:     ${CONFIG.limit} files`);
  if (CONFIG.dryRun) console.log(`🧪 Mode:      DRY RUN (no storage)`);
  console.log('');

  // Find all markdown files
  console.log('🔍 Scanning for markdown files...');
  let files = findMarkdownFiles(CONFIG.sourceDir);
  console.log(`   Found ${files.length} files\n`);

  if (files.length === 0) {
    console.error('❌ No markdown files found');
    process.exit(1);
  }

  // Apply limit if specified
  if (CONFIG.limit > 0) {
    files = files.slice(0, CONFIG.limit);
    console.log(`   Processing first ${files.length} files (--limit ${CONFIG.limit})\n`);
  }

  // Process all files into entries
  console.log('📝 Parsing markdown files...');
  const entries: MemoryEntry[] = [];
  const categoryCount: Record<string, number> = {};

  for (const file of files) {
    const entry = createEntry(file);
    if (entry) {
      entries.push(entry);
      const cat = entry.metadata.category || 'Unknown';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
  }

  console.log(`   Parsed ${entries.length} entries\n`);

  // Display category breakdown
  console.log('📊 Category Breakdown:');
  Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  console.log('');

  if (CONFIG.dryRun) {
    console.log('🧪 DRY RUN - Skipping storage\n');
    console.log('Sample entries:');
    entries.slice(0, 3).forEach((entry, i) => {
      console.log(`\n--- Entry ${i + 1} ---`);
      console.log(`Key: ${entry.key}`);
      console.log(`Value:\n${entry.value.substring(0, 300)}...`);
    });
    return;
  }

  // Store entries in batches
  console.log('💾 Storing entries in AgentDB...\n');
  let success = 0;
  let failed = 0;
  const totalBatches = Math.ceil(entries.length / CONFIG.batchSize);

  for (let i = 0; i < entries.length; i += CONFIG.batchSize) {
    const batch = entries.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;

    process.stdout.write(`Batch ${batchNum}/${totalBatches}: `);

    for (const entry of batch) {
      if (storeMemory(entry)) {
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
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Complete                                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`📊 Total:     ${entries.length}`);
  console.log(`✅ Success:   ${success}`);
  console.log(`❌ Failed:    ${failed}`);
  console.log(`📦 Namespace: ${CONFIG.namespace}`);
  console.log('');

  // Test search if any entries were stored
  if (success > 0) {
    console.log('🔍 Testing semantic search...\n');
    const testQueries = ['carrier aggregation', 'handover', 'VoLTE'];

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
          timeout: 10000,
        });

        if (result.status === 0) {
          console.log(`Query "${query}":`);
          console.log(result.stdout.substring(0, 300));
        }
      } catch (e) {
        // Ignore search errors
      }
    }
  }

  console.log('\n✨ Usage:');
  console.log(`   npx @claude-flow/cli memory search --query "carrier aggregation" --namespace ${CONFIG.namespace}`);
  console.log(`   npx @claude-flow/cli memory list --namespace ${CONFIG.namespace}`);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
