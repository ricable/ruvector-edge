#!/usr/bin/env bun
/**
 * Efficient Batch Trainer for AgentDB
 * 
 * Uses direct @claude-flow/memory API with persistence for consistent data storage.
 *
 * Usage:
 *   bun run scripts/batch-train-agentdb.ts
 *   bun run scripts/batch-train-agentdb.ts --limit 500 --concurrency 10
 *   bun run scripts/batch-train-agentdb.ts --dry-run
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createEmbeddingService } from '@claude-flow/embeddings';
import { AgentDBAdapter } from '@claude-flow/memory';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI argument parsing
const args = process.argv.slice(2);
const getArg = (name: string, defaultVal: string): string => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
};
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const CONFIG = {
    sourceDir: join(process.cwd(), 'docs', 'elex_features'),
    namespace: getArg('namespace', 'elex-ran-trained'),
    dbPath: join(process.cwd(), '.agentdb-trained'),
    limit: parseInt(getArg('limit', '0')) || 0,
    concurrency: parseInt(getArg('concurrency', '5')) || 5, // Lower concurrency for real embeddings
    dimensions: 384, // Use 384 for MiniLM-L6 (ONNX)
    dryRun: hasFlag('dry-run'),
    verbose: hasFlag('verbose'),
};

interface FeatureDoc {
    key: string;
    content: string;
    title: string;
    fajCode?: string;
    category: string;
    accessType?: string;
    tags: string[];
    relativePath: string;
    summary: string;
    parameters?: string;
    counters?: string;
}

// ============ File Discovery ============

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

// ============ Content Extraction ============

function categorizeFeature(content: string): string {
    const lc = content.toLowerCase();
    const categories: [string, string[]][] = [
        ['Carrier Aggregation', ['carrier aggregation', '2cc', '3cc', '4cc', '5cc', 'scell', 'pcell']],
        ['NR/5G', [' nr ', '5g-nr', 'new radio', 'standalone', 'nsa']],
        ['MIMO & Antenna', ['mimo', 'beamforming', 'antenna', 'massive mimo']],
        ['Mobility', ['handover', 'anr', 'mobility', 'cell selection', 'reselection']],
        ['Energy Saving', ['energy saving', 'cell sleep', 'power saving', 'lean carrier']],
        ['Voice & IMS', ['volte', 'vonr', 'voice', 'ims', 'voip', 'tti bundling']],
        ['Radio Resource Management', ['scheduler', 'qos', 'admission', 'congestion', 'load balancing']],
        ['Transport', ['fronthaul', 'backhaul', 'transport', 'cpri', 'ecpri']],
        ['SON', ['son', 'self-organizing', 'self-healing', 'anr', 'pci']],
    ];

    for (const [category, keywords] of categories) {
        if (keywords.some(kw => lc.includes(kw))) return category;
    }
    return 'Other';
}

function parseDocument(filePath: string): FeatureDoc | null {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const relativePath = relative(CONFIG.sourceDir, filePath);

        // Skip YAML frontmatter
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
        const body = lines.slice(bodyStart).join('\n');

        // Extract title
        const titleMatch = body.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : basename(filePath, '.md');

        // Extract FAJ code
        const fajMatch = body.match(/FAJ\s+(\d+)\s+(\d+)/);
        const fajCode = fajMatch ? `${fajMatch[1]}-${fajMatch[2]}` : undefined;

        // Extract access type
        const accessMatch = body.match(/\|\s*Access Type\s*\|\s*([^|]+)\s*\|/);
        const accessType = accessMatch ? accessMatch[1].trim() : undefined;

        // Clean image tags for cleaner text
        const cleanBody = body.replace(/!\[Image\]\([^)]+\)/g, '');

        // Helper to extract sections
        const extractSection = (regex: RegExp): string => {
            const match = cleanBody.match(regex);
            if (match && match[1]) {
                return match[1].split(/\n#\s/)[0].trim();
            }
            return '';
        };

        // Extract Overview/Summary
        let summary = extractSection(/#.*Overview\s+([\s\S]+?)(?=\n#|\n##|$)/);
        if (!summary) summary = cleanBody.substring(0, 800).trim();

        // Extract Parameters
        const parameters = extractSection(/#.*Parameters.*[\r\n]+([\s\S]+?)(?=\n#|$)/);

        // Extract Counters/Performance
        const counters = extractSection(/#.*Performance.*[\r\n]+([\s\S]+?)(?=\n#|$)/);

        // Categorize
        const category = categorizeFeature(body);

        // Generate tags
        const tags: string[] = [];
        if (fajCode) tags.push(`faj:${fajCode}`);
        if (accessType) tags.push(accessType.toLowerCase());
        tags.push(category.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

        // Generate unique key
        const keyParts = [fajCode, title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)].filter(Boolean);
        const hash = Buffer.from(relativePath).toString('base64').substring(0, 6);
        const key = [...keyParts, hash].join(':');

        // Create rich content for embedding - weight title and summary
        const richContent = [
            `# ${title}`,
            fajCode ? `Feature Identity: FAJ ${fajCode}` : '',
            `Category: ${category}`,
            accessType ? `Access Type: ${accessType}` : '',
            '',
            `## Summary`,
            summary,
            '',
            parameters ? `## Parameters\n${parameters}` : '',
            counters ? `## Counters & Performance\n${counters}` : '',
        ].filter(Boolean).join('\n');

        return {
            key,
            content: richContent,
            title,
            fajCode,
            category,
            accessType,
            tags,
            relativePath,
            summary,
            parameters: parameters ? parameters.substring(0, 1500) : undefined, // Limit size
            counters: counters ? counters.substring(0, 1500) : undefined,     // Limit size
        };
    } catch (error: any) {
        if (CONFIG.verbose) console.error(`Failed to parse ${filePath}: ${error.message}`);
        return null;
    }
}

// ============ Parallel Processing ============

async function processInParallel<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    concurrency: number,
    onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
    const results: R[] = [];
    let completed = 0;

    const processNext = async (iterator: IterableIterator<[number, T]>): Promise<void> => {
        const next = iterator.next();
        if (next.done) return;

        const [index, item] = next.value;
        const result = await processor(item, index);
        results[index] = result;
        completed++;
        onProgress?.(completed, items.length);
        await processNext(iterator);
    };

    const iterator = items.entries();
    const workers = Array(Math.min(concurrency, items.length))
        .fill(null)
        .map(() => processNext(iterator));

    await Promise.all(workers);
    return results;
}

// ============ Main ============

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  AgentDB Batch Trainer - Persistent Storage                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    console.log(`📁 Source:      ${CONFIG.sourceDir}`);
    console.log(`📦 Namespace:   ${CONFIG.namespace}`);
    console.log(`💾 DB Path:     ${CONFIG.dbPath}`);
    console.log(`⚡ Concurrency: ${CONFIG.concurrency}`);
    if (CONFIG.limit) console.log(`🔢 Limit:       ${CONFIG.limit}`);
    if (CONFIG.dryRun) console.log(`🧪 Mode:        DRY RUN`);
    console.log('');

    // 1. Find all markdown files
    console.log('🔍 Scanning for markdown files...');
    let filePaths = findMarkdownFiles(CONFIG.sourceDir);
    console.log(`   Found ${filePaths.length} files`);

    if (CONFIG.limit > 0) {
        filePaths = filePaths.slice(0, CONFIG.limit);
        console.log(`   Limited to ${filePaths.length} files`);
    }
    console.log('');

    // 2. Parse all documents
    console.log('📝 Parsing documents...');
    const startParse = Date.now();

    const docs: FeatureDoc[] = [];
    const categoryCount: Record<string, number> = {};

    for (const path of filePaths) {
        const doc = parseDocument(path);
        if (doc) {
            docs.push(doc);
            categoryCount[doc.category] = (categoryCount[doc.category] || 0) + 1;
        }
    }

    console.log(`   Parsed ${docs.length} documents in ${Date.now() - startParse}ms`);
    console.log('');

    // 3. Show category breakdown
    console.log('📊 Categories:');
    Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));
    console.log('');

    if (CONFIG.dryRun) {
        console.log('🧪 DRY RUN - Sample documents:');
        docs.slice(0, 3).forEach((doc, i) => {
            console.log(`\n--- ${i + 1}. ${doc.title} ---`);
            console.log(`Key: ${doc.key}`);
            console.log(`Category: ${doc.category}`);
            console.log(`Tags: ${doc.tags.join(', ')}`);
        });
        return;
    }

    // 4. Initialize embedding service (REAL ONNX)
    console.log('🔌 Initializing embedding service (MiniLM-L6-v2 via transformers)...');
    const embeddingService = createEmbeddingService({
        provider: 'transformers',
    });

    // Simple function to generate consistent embeddings for text
    const generateEmbedding = async (text: string): Promise<Float32Array> => {
        const result = await embeddingService.embed(text);
        if (result.embedding instanceof Float32Array) {
            return result.embedding;
        }
        return new Float32Array(result.embedding);
    };

    // 5. Initialize AgentDB adapter with persistence
    console.log('🔌 Initializing AgentDB...');

    // Ensure DB directory exists
    if (!existsSync(CONFIG.dbPath)) {
        mkdirSync(CONFIG.dbPath, { recursive: true });
    }

    const adapter = new AgentDBAdapter({
        dimensions: CONFIG.dimensions,
        persistenceEnabled: true,
        persistencePath: CONFIG.dbPath,
        embeddingGenerator: generateEmbedding,
    });
    await adapter.initialize();
    console.log('   Connected\n');

    // 6. Store documents with retry logic for HNSW failures
    console.log('💾 Storing documents...\n');
    const startStore = Date.now();
    let success = 0;
    let failed = 0;
    let lastProgress = 0;
    const failedDocs: FeatureDoc[] = [];
    const MAX_RETRIES = 3;

    // Store helper with retry
    const storeDoc = async (doc: FeatureDoc, retryCount = 0): Promise<boolean> => {
        try {
            const embedding = await generateEmbedding(doc.content);
            const now = Date.now();

            await adapter.store({
                id: `${CONFIG.namespace}:${doc.key}`,
                key: doc.key,
                namespace: CONFIG.namespace,
                content: doc.content,
                embedding: embedding,
                tags: doc.tags,
                metadata: {
                    title: doc.title,
                    fajCode: doc.fajCode,
                    category: doc.category,
                    accessType: doc.accessType,
                    relativePath: doc.relativePath,
                },
                type: 'semantic',
                accessLevel: 'private',
                version: 1,
                references: [],
                createdAt: now,
                updatedAt: now,
                lastAccessedAt: now,
                accessCount: 0,
            });
            return true;
        } catch (error: any) {
            // HNSW neighbor connection bug - retry with small delay
            if (error.message?.includes('connections.get(level)') && retryCount < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 10 * (retryCount + 1)));
                return storeDoc(doc, retryCount + 1);
            }
            throw error;
        }
    };

    await processInParallel(
        docs,
        async (doc, index) => {
            try {
                const stored = await storeDoc(doc);
                if (stored) success++;
                return true;
            } catch (error: any) {
                if (CONFIG.verbose) {
                    console.error(`\n❌ Failed ${doc.key}: ${error.message}`);
                }
                failedDocs.push(doc);
                failed++;
                return false;
            }
        },
        CONFIG.concurrency,
        (completed, total) => {
            const pct = Math.floor((completed / total) * 100);
            if (pct >= lastProgress + 5) {
                process.stdout.write(`\r   Progress: ${completed}/${total} (${pct}%) ✓${success} ✗${failed}`);
                lastProgress = pct;
            }
        }
    );

    console.log(`\r   Progress: ${docs.length}/${docs.length} (100%) ✓${success} ✗${failed}`);

    // Retry failed documents sequentially with multiple passes
    const permanentlyFailed: FeatureDoc[] = [];
    if (failedDocs.length > 0) {
        console.log(`\n🔄 Retrying ${failedDocs.length} failed documents sequentially...`);
        let retrySuccess = 0;
        const stillFailing: FeatureDoc[] = [];

        // First retry pass
        for (const doc of failedDocs) {
            try {
                const stored = await storeDoc(doc);
                if (stored) {
                    retrySuccess++;
                    success++;
                    failed--;
                }
            } catch (error: any) {
                stillFailing.push(doc);
            }
        }
        console.log(`   Pass 1: Recovered ${retrySuccess}/${failedDocs.length}`);

        // Second retry pass for stubborn failures with longer delay
        if (stillFailing.length > 0) {
            console.log(`   Pass 2: Attempting ${stillFailing.length} remaining...`);
            let pass2Success = 0;
            for (const doc of stillFailing) {
                await new Promise(r => setTimeout(r, 50)); // Longer delay
                try {
                    const stored = await storeDoc(doc);
                    if (stored) {
                        pass2Success++;
                        success++;
                        failed--;
                    }
                } catch (error: any) {
                    permanentlyFailed.push(doc);
                    if (CONFIG.verbose) {
                        console.error(`   Permanently failed: ${doc.key}`);
                    }
                }
            }
            console.log(`   Pass 2: Recovered ${pass2Success}/${stillFailing.length}`);
        }
    }

    // Save permanently failed documents to fallback file for alternative ingestion
    if (permanentlyFailed.length > 0) {
        const fallbackPath = join(CONFIG.dbPath, 'failed-ingestion.json');
        const fallbackData = permanentlyFailed.map(d => ({
            key: d.key,
            title: d.title,
            category: d.category,
            fajCode: d.fajCode,
            tags: d.tags,
            content: d.content,
            relativePath: d.relativePath,
        }));
        writeFileSync(fallbackPath, JSON.stringify(fallbackData, null, 2));
        console.log(`\n⚠️  Saved ${permanentlyFailed.length} permanently failed docs to ${fallbackPath}`);
    }

    const elapsed = Date.now() - startStore;
    console.log('');

    // 7. Shutdown
    await adapter.shutdown();

    // 8. Save index for querying
    const indexPath = join(CONFIG.dbPath, 'index.json');
    const indexData = docs.map(d => ({
        key: d.key,
        title: d.title,
        category: d.category,
        fajCode: d.fajCode,
        tags: d.tags,
        summary: d.summary,
        parameters: d.parameters,
        counters: d.counters,
    }));
    writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    console.log(`📝 Saved index to ${indexPath}\n`);

    // 9. Summary
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  Training Complete                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`📊 Total:      ${docs.length}`);
    console.log(`✅ Success:    ${success}`);
    console.log(`❌ Failed:     ${failed}`);
    console.log(`⏱️  Time:       ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`📈 Rate:       ${(success / (elapsed / 1000)).toFixed(1)} docs/sec`);
    console.log(`📦 Namespace:  ${CONFIG.namespace}`);
    console.log(`💾 Stored at:  ${CONFIG.dbPath}`);
    console.log('');
    console.log('✨ Query with:');
    console.log(`   bun run scripts/query-agentdb.ts "Your question" --namespace ${CONFIG.namespace}`);
}

main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
