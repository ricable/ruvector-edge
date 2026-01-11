#!/usr/bin/env bun
/**
 * Semantic Search with Document Chunking
 * 
 * Uses real embeddings (OpenAI or local) for cosine similarity search.
 * Documents are chunked for fine-grained retrieval.
 *
 * Usage:
 *   # With OpenAI embeddings (recommended)
 *   OPENAI_API_KEY=sk-xxx bun run scripts/semantic-search.ts "Your question"
 *   
 *   # List all chunks
 *   bun run scripts/semantic-search.ts --list
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const question = args.find(a => !a.startsWith('--')) || '';
const limit = parseInt(args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '5');
const showList = args.includes('--list');
const rebuildIndex = args.includes('--rebuild');

const CONFIG = {
    dbPath: join(process.cwd(), '.agentdb-trained'),
    chunksPath: join(process.cwd(), '.agentdb-trained', 'chunks.json'),
    embeddingsPath: join(process.cwd(), '.agentdb-trained', 'embeddings.json'),
    chunkSize: 500,       // Characters per chunk
    chunkOverlap: 100,    // Overlap between chunks
    dimensions: 1536,     // OpenAI text-embedding-3-small
    useOpenAI: !!process.env.OPENAI_API_KEY,
};

interface DocumentChunk {
    id: string;
    docKey: string;
    docTitle: string;
    category: string;
    chunkIndex: number;
    content: string;
    embedding?: number[];
}

interface ChunkStore {
    chunks: DocumentChunk[];
    createdAt: string;
    embeddingModel: string;
}

// ============ Embedding Functions ============

async function getOpenAIEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.substring(0, 8000), // API limit
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

async function getOpenAIEmbeddingBatch(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    // Process in batches of 100 (API limit)
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize).map(t => t.substring(0, 8000));

        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: batch,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json();
        const embeddings = data.data
            .sort((a: any, b: any) => a.index - b.index)
            .map((d: any) => d.embedding);

        allEmbeddings.push(...embeddings);

        if (i + batchSize < texts.length) {
            await new Promise(r => setTimeout(r, 100)); // Rate limiting
        }
    }

    return allEmbeddings;
}

// Simple hash-based embedding for demo (when no API key)
function getLocalEmbedding(text: string, dimensions: number = 128): number[] {
    const embedding = new Array(dimensions).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);

    for (const word of words) {
        for (let i = 0; i < word.length; i++) {
            const idx = (word.charCodeAt(i) * (i + 1) * word.length) % dimensions;
            embedding[idx] += 1 / words.length;
        }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
}

// ============ Similarity Functions ============

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============ Chunking Functions ============

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        let end = start + chunkSize;

        // Try to break at sentence/paragraph boundary
        if (end < text.length) {
            const breakPoints = ['\n\n', '\n', '. ', ', '];
            for (const bp of breakPoints) {
                const bpIndex = text.lastIndexOf(bp, end);
                if (bpIndex > start + chunkSize / 2) {
                    end = bpIndex + bp.length;
                    break;
                }
            }
        }

        chunks.push(text.substring(start, Math.min(end, text.length)).trim());
        start = end - overlap;
    }

    return chunks.filter(c => c.length > 50);
}

function findMarkdownFiles(dir: string): string[] {
    let markdownFiles: string[] = [];
    const files = readdirSync(dir);

    for (const file of files) {
        const filePath = join(dir, file);
        const stats = statSync(filePath);

        if (stats.isDirectory()) {
            markdownFiles = markdownFiles.concat(findMarkdownFiles(filePath));
        } else if (stats.isFile() && filePath.endsWith('.md')) {
            markdownFiles.push(filePath);
        }
    }
    return markdownFiles;
}

// ============ Index Building ============

async function buildChunkIndex(): Promise<ChunkStore> {
    const indexPath = join(CONFIG.dbPath, 'index.json');
    if (!existsSync(indexPath)) {
        throw new Error('Index not found. Run batch-train-agentdb.ts first.');
    }

    console.log('📦 Building chunk index...\n');

    const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    const chunks: DocumentChunk[] = [];

    // Build a map of title -> doc info
    const docMap = new Map(index.map((d: any) => [d.title.toLowerCase(), d]));

    // Scan docs directory for markdown files
    const docsDir = join(process.cwd(), 'docs', 'elex_features');
    const files = findMarkdownFiles(docsDir);

    console.log(`   Found ${files.length} files to process`);

    for (const filePath of files) {
        let content = readFileSync(filePath, 'utf-8');

        // Remove frontmatter
        if (content.startsWith('---')) {
            const endIdx = content.indexOf('---', 3);
            if (endIdx > 0) content = content.substring(endIdx + 3);
        }

        // Extract title
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Find doc info from index
        const docInfo = docMap.get(title.toLowerCase()) || {
            key: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            title,
            category: 'Other',
        };

        // Remove images
        content = content.replace(/!\[Image\]\([^)]+\)/g, '');

        // Create chunks
        const textChunks = chunkText(content, CONFIG.chunkSize, CONFIG.chunkOverlap);

        for (let i = 0; i < textChunks.length; i++) {
            chunks.push({
                id: `${docInfo.key}:chunk${i}`,
                docKey: docInfo.key,
                docTitle: docInfo.title || title,
                category: docInfo.category || 'Other',
                chunkIndex: i,
                content: textChunks[i],
            });
        }
    }

    console.log(`   Created ${chunks.length} chunks from ${index.length} documents`);

    // Generate embeddings
    if (CONFIG.useOpenAI) {
        console.log('\n🔌 Generating OpenAI embeddings...');
        const texts = chunks.map(c => `${c.docTitle}\n\n${c.content}`);

        const embeddings = await getOpenAIEmbeddingBatch(texts);

        for (let i = 0; i < chunks.length; i++) {
            chunks[i].embedding = embeddings[i];
        }

        console.log(`   Generated ${embeddings.length} embeddings`);
    } else {
        console.log('\n🔌 Generating local embeddings (demo mode)...');
        for (const chunk of chunks) {
            chunk.embedding = getLocalEmbedding(`${chunk.docTitle} ${chunk.content}`, 128);
        }
        console.log('   ⚠️  For better results, set OPENAI_API_KEY');
    }

    const store: ChunkStore = {
        chunks,
        createdAt: new Date().toISOString(),
        embeddingModel: CONFIG.useOpenAI ? 'text-embedding-3-small' : 'local-hash',
    };

    // Save
    writeFileSync(CONFIG.chunksPath, JSON.stringify(store));
    console.log(`\n💾 Saved to ${CONFIG.chunksPath}`);

    return store;
}

// ============ Search ============

async function semanticSearch(query: string, store: ChunkStore, topK: number): Promise<Array<{ chunk: DocumentChunk; similarity: number }>> {
    // Generate query embedding
    let queryEmbedding: number[];

    if (CONFIG.useOpenAI) {
        queryEmbedding = await getOpenAIEmbedding(query);
    } else {
        queryEmbedding = getLocalEmbedding(query, 128);
    }

    // Calculate similarities
    const results = store.chunks
        .map(chunk => ({
            chunk,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding || []),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

    return results;
}

// ============ Main ============

async function main() {
    if (!question && !showList && !rebuildIndex) {
        console.log(`
📚 Semantic Search with Document Chunking

Usage:
  bun run scripts/semantic-search.ts "Your question"
  bun run scripts/semantic-search.ts "carrier aggregation" --limit 10
  bun run scripts/semantic-search.ts --list
  bun run scripts/semantic-search.ts --rebuild

Options:
  --limit N     Max results (default: 5)
  --list        List all chunks
  --rebuild     Rebuild chunk index with embeddings

Environment:
  OPENAI_API_KEY    Set for high-quality embeddings (recommended)

Examples:
  OPENAI_API_KEY=sk-xxx bun run scripts/semantic-search.ts "VoLTE handover"
  bun run scripts/semantic-search.ts "carrier aggregation throughput"
`);
        process.exit(0);
    }

    // Load or build chunk store
    let store: ChunkStore;

    if (rebuildIndex || !existsSync(CONFIG.chunksPath)) {
        store = await buildChunkIndex();
    } else {
        store = JSON.parse(readFileSync(CONFIG.chunksPath, 'utf-8'));
        console.log(`📦 Loaded ${store.chunks.length} chunks (${store.embeddingModel})\n`);
    }

    // List mode
    if (showList) {
        console.log('📋 Chunk Summary:\n');
        const byDoc: Record<string, number> = {};
        store.chunks.forEach(c => byDoc[c.docTitle] = (byDoc[c.docTitle] || 0) + 1);

        Object.entries(byDoc)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .forEach(([title, count]) => console.log(`   ${title}: ${count} chunks`));

        console.log(`\n   Total: ${store.chunks.length} chunks from ${Object.keys(byDoc).length} documents`);
        return;
    }

    // Search mode
    console.log(`🔍 Query: "${question}"`);
    console.log(`📊 Model: ${store.embeddingModel}`);
    console.log(`🔢 Top K: ${limit}\n`);

    const startTime = Date.now();
    const results = await semanticSearch(question, store, limit);
    const elapsed = Date.now() - startTime;

    console.log(`✅ Found ${results.length} results (${elapsed}ms)\n`);
    console.log('─'.repeat(70));

    for (const { chunk, similarity } of results) {
        console.log(`\n📄 ${chunk.docTitle} (chunk ${chunk.chunkIndex + 1})`);
        console.log(`   Similarity: ${(similarity * 100).toFixed(1)}% | Category: ${chunk.category}`);
        console.log('');

        // Show content preview
        const preview = chunk.content.substring(0, 300).replace(/\n/g, '\n   ');
        console.log(`   ${preview}...`);
        console.log('');
        console.log('─'.repeat(70));
    }

    console.log(`\n⏱️  Search completed in ${elapsed}ms`);

    if (!CONFIG.useOpenAI) {
        console.log('\n💡 Tip: Set OPENAI_API_KEY for better semantic similarity');
    }
}

main().catch(console.error);
