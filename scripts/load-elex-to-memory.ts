#!/usr/bin/env tsx
/**
 * AgentDB Memory Loader for Ericsson RAN Features
 * Simple version using direct API calls
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  sourceDir: join(process.cwd(), 'docs', 'elex_features'),
  namespace: 'elex-ran-features',
  batchSize: 50,
};

interface MemoryEntry {
  key: string;
  value: string;
  metadata: Record<string, any>;
}

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

function extractMetadata(content: string, sourcePath: string) {
  const lines = content.split('\n');
  const metadata: any = { sourceFile: sourcePath, tags: [] };

  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') {
      if (!inFrontmatter) { inFrontmatter = true; continue; }
      else break;
    }
    if (inFrontmatter) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key === 'complexity_score') metadata.complexityScore = parseFloat(value);
        if (key === 'quality_score') metadata.qualityScore = parseFloat(value);
      }
    }
  }

  const bodyContent = lines.join('\n');

  const headingMatch = bodyContent.match(/^#\s+(.+)$/m);
  if (headingMatch) metadata.featureName = headingMatch[1].trim();

  const fajMatch = bodyContent.match(/FAJ\s+(\d+)\s+(\d+)/);
  if (fajMatch) {
    metadata.featureIdentity = `FAJ ${fajMatch[1]} ${fajMatch[2]}`;
    metadata.fajCode = `${fajMatch[1]}-${fajMatch[2]}`;
  }

  const pkgMatch = bodyContent.match(/\|\s*Value Package Name\s*\|\s*([^|]+)\s*\|/);
  if (pkgMatch) metadata.valuePackage = pkgMatch[1].trim();

  const accessMatch = bodyContent.match(/\|\s*Access Type\s*\|\s*([^|]+)\s*\|/);
  if (accessMatch) metadata.accessType = accessMatch[1].trim();

  const nodeMatch = bodyContent.match(/\|\s*Node Type\s*\|\s*([^|]+)\s*\|/);
  if (nodeMatch) metadata.nodeType = nodeMatch[1].trim();

  return metadata;
}

function generateKey(metadata: any, relativePath: string): string {
  const parts: string[] = [];
  if (metadata.fajCode) parts.push(metadata.fajCode);
  if (metadata.featureName) {
    parts.push(metadata.featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  }
  if (parts.length === 0) {
    parts.push(relativePath.split(/[/\\]/).pop()?.replace('.md', '') || 'unknown');
  }
  parts.push(Buffer.from(relativePath).toString('base64').substring(0, 8));
  return parts.join(':');
}

function createEntry(filePath: string): MemoryEntry | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(CONFIG.sourceDir, filePath);
    const metadata = extractMetadata(content, filePath);

    // Create a summary for embedding
    const summaryMatch = content.match(/#.*Overview\s+(.+?)(?=\n#|\n##|\Z)/s);
    const summary = summaryMatch ? summaryMatch[1].replace(/!\[Image\]\([^)]+\)/g, '').trim().substring(0, 500) : '';

    const value = `Feature: ${metadata.featureName || 'Unknown'}
Identity: ${metadata.featureIdentity || 'N/A'}
FAJ Code: ${metadata.fajCode || 'N/A'}
Category: ${metadata.accessType || 'N/A'}
Summary: ${summary}
Source: ${relativePath}`;

    return {
      key: generateKey(metadata, relativePath),
      value,
      metadata: {
        ...metadata,
        relativePath,
        loadedAt: new Date().toISOString(),
      }
    };
  } catch (error) {
    console.error(`Failed to process ${filePath}: ${error.message}`);
    return null;
  }
}

function storeMemory(entry: MemoryEntry): boolean {
  try {
    // Write to temp file for large content
    const tempFile = join(process.cwd(), '.temp-memory-value.txt');
    writeFileSync(tempFile, entry.value);

    const metadataJson = JSON.stringify(entry.metadata).replace(/"/g, '\\"');

    const command = `npx @claude-flow/cli@latest memory store --key "${entry.key}" --namespace ${CONFIG.namespace} --metadata '${metadataJson}' < "${tempFile}"`;

    execSync(command, { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });

    // Clean up temp file
    unlinkSync(tempFile);

    return true;
  } catch (error) {
    console.error(`Failed to store ${entry.key}: ${error.message}`);
    return false;
  }
}

import { writeFileSync, unlinkSync } from 'fs';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Ericsson RAN Features - AgentDB Memory Loader             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Scanning: ${CONFIG.sourceDir}`);
  const files = findMarkdownFiles(CONFIG.sourceDir);
  console.log(`Found ${files.length} markdown files\n`);

  if (files.length === 0) {
    console.error('No files found');
    process.exit(1);
  }

  // Process all files
  const entries: MemoryEntry[] = [];
  for (const file of files) {
    const entry = createEntry(file);
    if (entry) entries.push(entry);
  }

  console.log(`Loaded ${entries.length} entries\n`);

  // Store in batches
  let success = 0, failed = 0;
  const totalBatches = Math.ceil(entries.length / CONFIG.batchSize);

  for (let i = 0; i < entries.length; i += CONFIG.batchSize) {
    const batch = entries.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} files)`);

    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j];
      process.stdout.write(`\r  ${j + 1}/${batch.length} ${entry.key.substring(0, 50)}... `);

      if (storeMemory(entry)) {
        success++;
        process.stdout.write('✓');
      } else {
        failed++;
        process.stdout.write('✗');
      }
    }
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Complete                                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Total: ${entries.length} | Success: ${success} | Failed: ${failed}\n`);
}

main().catch(console.error);
