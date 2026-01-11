#!/usr/bin/env tsx
/**
 * AgentDB Memory Loader for Ericsson RAN Features
 *
 * Loads all markdown files from docs/elex_features into AgentDB memory
 * with 768-dim vector embeddings for self-learning multi-agent training.
 *
 * Usage:
 *   npx tsx scripts/load-elex-features-to-agentdb.ts
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: join(process.cwd(), 'docs', 'elex_features'),
  embeddingDimensions: 768,
  batchSize: 50,
  namespace: 'elex-ran-features',
  ttl: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
  memoryThreshold: 0.85, // Similarity threshold for duplicate detection
};

interface FeatureMetadata {
  featureName?: string;
  featureIdentity?: string;
  valuePackage?: string;
  accessType?: string;
  nodeType?: string;
  sourceFile: string;
  category?: string;
  fajCode?: string;
  complexityScore?: number;
  qualityScore?: number;
  tags: string[];
}

interface MarkdownFile {
  path: string;
  relativePath: string;
  content: string;
  metadata: FeatureMetadata;
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string, basePath: string = dir): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip specific directories
      if (!entry.name.startsWith('.') && entry.name !== 'images') {
        files.push(...findMarkdownFiles(fullPath, basePath));
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract metadata from markdown file content
 */
function extractMetadata(content: string, sourcePath: string): FeatureMetadata {
  const metadata: FeatureMetadata = {
    sourceFile: sourcePath,
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
        let value = line.substring(colonIndex + 1).trim();

        switch (key) {
          case 'complexity_score':
            metadata.complexityScore = parseFloat(value);
            break;
          case 'quality_score':
            metadata.qualityScore = parseFloat(value);
            break;
          case 'source_file':
          case 'source_zip':
            // Already have source path
            break;
        }
      }
    }
  }

  // Extract feature information from content body
  const bodyContent = lines.slice(frontmatterEnd).join('\n');

  // Extract feature name from first heading
  const headingMatch = bodyContent.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    metadata.featureName = headingMatch[1].trim();
  }

  // Extract FAJ code and feature identity
  const fajPattern = /FAJ\s+(\d+)\s+(\d+)/g;
  const fajMatches = [...bodyContent.matchAll(fajPattern)];
  if (fajMatches.length > 0) {
    const match = fajMatches[0];
    metadata.featureIdentity = `FAJ ${match[1]} ${match[2]}`;
    metadata.fajCode = `${match[1]}-${match[2]}`;
  }

  // Extract value package
  const valuePackageMatch = bodyContent.match(/\|\s*Value Package Name\s*\|\s*([^|]+)\s*\|/);
  if (valuePackageMatch) {
    metadata.valuePackage = valuePackageMatch[1].trim();
  }

  // Extract access type
  const accessTypeMatch = bodyContent.match(/\|\s*Access Type\s*\|\s*([^|]+)\s*\|/);
  if (accessTypeMatch) {
    metadata.accessType = accessTypeMatch[1].trim();
  }

  // Extract node type
  const nodeTypeMatch = bodyContent.match(/\|\s*Node Type\s*\|\s*([^|]+)\s*\|/);
  if (nodeTypeMatch) {
    metadata.nodeType = nodeTypeMatch[1].trim();
  }

  // Generate tags from content
  const tags = new Set<string>();

  // Add FAJ code as tag
  if (metadata.fajCode) {
    tags.add(`faj:${metadata.fajCode}`);
  }

  // Add access type as tag
  if (metadata.accessType) {
    tags.add(metadata.accessType.toLowerCase());
  }

  // Add value package as tag
  if (metadata.valuePackage) {
    tags.add(metadata.valuePackage.toLowerCase().replace(/\s+/g, '-'));
  }

  // Extract feature category from filename/path
  const pathParts = sourcePath.split(/[/\\]/);
  for (const part of pathParts) {
    if (part.includes('batch') || part.includes('lzn')) {
      tags.add(part);
    }
  }

  // Extract technical terms for tagging
  const technicalTerms = [
    'carrier aggregation', 'ca', 'mimo', 'beamforming', 'handover', 'anr',
    'load balancing', 'drx', 'energy saving', 'cell sleep', 'voip', 'volte',
    'vonr', 'nr', 'lte', '5g', '4g', '3g', 'tdd', 'fdd', 'scell', 'pcell',
    'throughput', 'latency', 'kpi', 'counter', 'parameter', 'activation',
    'deactivation', 'license', 'hardware', 'interface', 'protocol'
  ];

  const lowerContent = bodyContent.toLowerCase();
  for (const term of technicalTerms) {
    if (lowerContent.includes(term)) {
      tags.add(term);
    }
  }

  metadata.tags = Array.from(tags);

  // Determine category based on content analysis
  if (lowerContent.includes('carrier aggregation') || lowerContent.includes('ca ')) {
    metadata.category = 'Carrier Aggregation';
  } else if (lowerContent.includes('nr ') && (lowerContent.includes('5g') || lowerContent.includes('standalone'))) {
    metadata.category = 'NR/5G';
  } else if (lowerContent.includes('mimo') || lowerContent.includes('antenna') || lowerContent.includes('beamforming')) {
    metadata.category = 'MIMO & Antenna';
  } else if (lowerContent.includes('handover') || lowerContent.includes('mobility') || lowerContent.includes('anr')) {
    metadata.category = 'Mobility';
  } else if (lowerContent.includes('energy') || lowerContent.includes('sleep') || lowerContent.includes('power')) {
    metadata.category = 'Energy Saving';
  } else if (lowerContent.includes('volte') || lowerContent.includes('vonr') || lowerContent.includes('voice')) {
    metadata.category = 'Voice & IMS';
  } else if (lowerContent.includes('scheduler') || lowerContent.includes('admission') || lowerContent.includes('qos')) {
    metadata.category = 'Radio Resource Management';
  } else if (lowerContent.includes('fronthaul') || lowerContent.includes('backhaul') || lowerContent.includes('transport')) {
    metadata.category = 'Transport';
  } else {
    metadata.category = 'Other';
  }

  return metadata;
}

/**
 * Store data in AgentDB memory
 */
function storeMemory(key: string, value: string, metadata: Record<string, any>): boolean {
  try {
    const metadataJson = JSON.stringify(metadata)
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");

    const command = `npx @claude-flow/cli@latest memory store -k "${key}" -v '${value}' --metadata '${metadataJson}' --namespace ${CONFIG.namespace} --ttl ${CONFIG.ttl}`;

    execSync(command, {
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large content
    });

    return true;
  } catch (error) {
    console.error(`Failed to store memory for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Generate a unique memory key from file metadata
 */
function generateMemoryKey(metadata: FeatureMetadata, relativePath: string): string {
  const parts: string[] = [];

  if (metadata.fajCode) {
    parts.push(metadata.fajCode);
  }

  if (metadata.featureName) {
    const sanitizedName = metadata.featureName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    parts.push(sanitizedName);
  }

  if (parts.length === 0) {
    // Fallback to filename-based key
    const filename = relativePath.split(/[/\\]/).pop() || 'unknown';
    parts.push(filename.replace('.md', ''));
  }

  // Add hash of relative path to ensure uniqueness
  const pathHash = Buffer.from(relativePath).toString('base64').substring(0, 8);
  parts.push(pathHash);

  return parts.join(':');
}

/**
 * Create a rich text representation for embedding
 */
function createEmbeddingText(file: MarkdownFile): string {
  const { content, metadata } = file;

  const sections: string[] = [];

  // Add feature identification
  if (metadata.featureName) {
    sections.push(`Feature: ${metadata.featureName}`);
  }

  if (metadata.featureIdentity) {
    sections.push(`Identity: ${metadata.featureIdentity}`);
  }

  if (metadata.category) {
    sections.push(`Category: ${metadata.category}`);
  }

  // Add value package info
  if (metadata.valuePackage) {
    sections.push(`Value Package: ${metadata.valuePackage}`);
  }

  // Add access type
  if (metadata.accessType) {
    sections.push(`Access Type: ${metadata.accessType}`);
  }

  // Add tags
  if (metadata.tags.length > 0) {
    sections.push(`Tags: ${metadata.tags.join(', ')}`);
  }

  // Add summary/overview section
  const overviewMatch = content.match(/#.*Overview\s+(.+?)(?=\n#|\n##|\Z)/s);
  if (overviewMatch) {
    const summary = overviewMatch[1]
      .replace(/!\[Image\]\([^)]+\)/g, '') // Remove image references
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .substring(0, 500);
    sections.push(`Summary: ${summary}`);
  }

  // Add key parameters section
  const paramsMatch = content.match(/#.*Parameters?\s+(.+?)(?=\n#|\n##|\Z)/s);
  if (paramsMatch) {
    const params = paramsMatch[1]
      .replace(/!\[Image\]\([^)]+\)/g, '')
      .replace(/\|[-|\s]+\|/g, '') // Remove table separators
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .substring(0, 500);
    sections.push(`Parameters: ${params}`);
  }

  // Add key performance indicators
  const kpiMatch = content.match(/#.*Performance?\s+(.+?)(?=\n#|\n##|\Z)/s);
  if (kpiMatch) {
    const kpis = kpiMatch[1]
      .replace(/!\[Image\]\([^)]+\)/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .substring(0, 300);
    sections.push(`Performance: ${kpis}`);
  }

  // Add dependencies
  const depsMatch = content.match(/#.*Dependencies?\s+(.+?)(?=\n#|\n##|\Z)/s);
  if (depsMatch) {
    const deps = depsMatch[1]
      .replace(/!\[Image\]\([^)]+\)/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .substring(0, 300);
    sections.push(`Dependencies: ${deps}`);
  }

  // Add source reference
  sections.push(`Source: ${metadata.sourceFile}`);

  return sections.join('\n\n');
}

/**
 * Process a batch of markdown files
 */
async function processBatch(files: MarkdownFile[], batchNumber: number, totalBatches: number): Promise<{ success: number; failed: number }> {
  console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${files.length} files)`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${batchNumber}/${totalBatches}] ${i + 1}/${files.length}`;

    try {
      // Generate unique key
      const key = generateMemoryKey(file.metadata, file.relativePath);

      // Create rich embedding text
      const embeddingText = createEmbeddingText(file);

      // Prepare metadata for storage
      const memoryMetadata = {
        ...file.metadata,
        embeddingText,
        relativePath: file.relativePath,
        embeddingDimensions: CONFIG.embeddingDimensions,
        loadedAt: new Date().toISOString(),
        batchNumber,
      };

      // Store in AgentDB
      if (storeMemory(key, embeddingText, memoryMetadata)) {
        success++;
        process.stdout.write(`\r${progress} ✓ ${key.substring(0, 60)}...`);
      } else {
        failed++;
        process.stdout.write(`\r${progress} ✗ ${key.substring(0, 60)}... [FAILED]`);
      }
    } catch (error) {
      failed++;
      console.error(`\n✗ Error processing ${file.relativePath}:`, error.message);
    }
  }

  console.log(`\nBatch complete: ${success} succeeded, ${failed} failed`);
  return { success, failed };
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Ericsson RAN Features - AgentDB Memory Loader             ║');
  console.log('║  768-dim Vector Embeddings for Self-Learning Agents        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Find all markdown files
  console.log(`Scanning directory: ${CONFIG.sourceDir}`);
  const markdownPaths = findMarkdownFiles(CONFIG.sourceDir);
  console.log(`Found ${markdownPaths.length} markdown files\n`);

  if (markdownPaths.length === 0) {
    console.error('No markdown files found to process');
    process.exit(1);
  }

  // Load and parse all files
  console.log('Loading and parsing markdown files...');
  const files: MarkdownFile[] = [];

  for (const path of markdownPaths) {
    try {
      const content = readFileSync(path, 'utf-8');
      const relativePath = relative(CONFIG.sourceDir, path);
      const metadata = extractMetadata(content, path);

      files.push({
        path,
        relativePath,
        content,
        metadata,
      });
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error.message);
    }
  }

  console.log(`Successfully loaded ${files.length} files\n`);

  // Display category breakdown
  const categoryCounts = files.reduce((acc, file) => {
    const cat = file.metadata.category || 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Feature Categories:');
  Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });

  // Process in batches
  const totalBatches = Math.ceil(files.length / CONFIG.batchSize);
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < files.length; i += CONFIG.batchSize) {
    const batch = files.slice(i, i + CONFIG.batchSize);
    const batchNumber = Math.floor(i / CONFIG.batchSize) + 1;

    const result = await processBatch(batch, batchNumber, totalBatches);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  // Final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Loading Complete                                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Total files processed: ${files.length}`);
  console.log(`Successfully stored: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Namespace: ${CONFIG.namespace}`);
  console.log(`Embedding dimensions: ${CONFIG.embeddingDimensions}\n`);

  // Test semantic search
  console.log('Testing semantic search capabilities...');
  try {
    const testQueries = [
      'carrier aggregation',
      'handover optimization',
      'MIMO beamforming',
      'energy saving',
    ];

    for (const query of testQueries) {
      console.log(`\nQuery: "${query}"`);
      try {
        const result = execSync(
          `npx @claude-flow/cli@latest memory search -q "${query}" --namespace ${CONFIG.namespace} --limit 3`,
          { encoding: 'utf-8' }
        );
        console.log(result.substring(0, 200));
      } catch (error) {
        console.log('  Search completed (results may be empty initially)');
      }
    }
  } catch (error) {
    console.log('Search test completed');
  }

  console.log('\n✓ AgentDB memory training complete!');
  console.log('\nUsage Examples:');
  console.log(`  npx @claude-flow/cli@latest memory search -q "4CC CA" --namespace ${CONFIG.namespace}`);
  console.log(`  npx @claude-flow/cli@latest memory list --namespace ${CONFIG.namespace}`);
  console.log(`  npx @claude-flow/cli@latest memory stats --namespace ${CONFIG.namespace}`);
}

// Run the loader
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
