#!/usr/bin/env bun
/**
 * Test Semantic Search on 250 RAN Questions
 * 
 * Runs semantic search for each question and evaluates retrieval quality.
 *
 * Usage:
 *   bun run scripts/test-250-questions.ts
 *   bun run scripts/test-250-questions.ts --limit 20
 *   bun run scripts/test-250-questions.ts --verbose
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const limit = parseInt(args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '0');
const verbose = args.includes('--verbose');

const CONFIG = {
    questionsPath: join(process.cwd(), 'docs', 'ran-domain', '250-questions.md'),
    chunksPath: join(process.cwd(), '.agentdb-trained', 'chunks.json'),
    resultsPath: join(process.cwd(), '.agentdb-trained', 'search-results.json'),
};

interface Question {
    id: string;
    feature: string;
    category: string; // K=Knowledge, D=Decision, A=Advanced
    text: string;
}

interface ChunkStore {
    chunks: Array<{
        id: string;
        docKey: string;
        docTitle: string;
        category: string;
        chunkIndex: number;
        content: string;
        embedding?: number[];
    }>;
    embeddingModel: string;
}

interface SearchResult {
    questionId: string;
    question: string;
    feature: string;
    topResults: Array<{
        docTitle: string;
        similarity: number;
        chunkIndex: number;
        preview: string;
    }>;
    relevanceScore: number; // How relevant the top result is to the question
}

// ============ Parse Questions ============

function parseQuestions(content: string): Question[] {
    const questions: Question[] = [];
    const lines = content.split('\n');

    let currentFeature = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Feature header: ## 1. MSM - MIMO Sleep Mode (FAJ 121 3094)
        const featureMatch = line.match(/^##\s+\d+\.\s+(\w+)\s+-\s+(.+)\s+\(FAJ/);
        if (featureMatch) {
            currentFeature = featureMatch[1];
            continue;
        }

        // Question: ### Q1-MSM-K01
        const qMatch = line.match(/^###\s+(Q\d+-\w+-[KDA]\d+)/);
        if (qMatch && i + 1 < lines.length) {
            const qId = qMatch[1];
            const qText = lines[i + 1].replace(/^"|"$/g, '').trim();

            // Determine category from ID
            let category = 'K'; // Knowledge (default)
            if (qId.includes('-D')) category = 'D'; // Decision
            if (qId.includes('-A')) category = 'A'; // Advanced

            if (qText.length > 10) {
                questions.push({
                    id: qId,
                    feature: currentFeature,
                    category,
                    text: qText,
                });
            }
        }
    }

    return questions;
}

// ============ Local Embedding ============

function getLocalEmbedding(text: string, dimensions: number = 128): number[] {
    const embedding = new Array(dimensions).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);

    for (const word of words) {
        for (let i = 0; i < word.length; i++) {
            const idx = (word.charCodeAt(i) * (i + 1) * word.length) % dimensions;
            embedding[idx] += 1 / words.length;
        }
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
}

// ============ Cosine Similarity ============

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

// ============ Search ============

function searchChunks(
    query: string,
    store: ChunkStore,
    topK: number = 5
): Array<{ chunk: ChunkStore['chunks'][0]; similarity: number }> {
    const queryEmbedding = getLocalEmbedding(query, store.chunks[0]?.embedding?.length || 128);

    return store.chunks
        .map(chunk => ({
            chunk,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding || []),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
}

// ============ Calculate Relevance ============

function calculateRelevance(question: Question, topResult: ChunkStore['chunks'][0] | undefined): number {
    if (!topResult) return 0;

    const titleLower = topResult.docTitle.toLowerCase();
    const contentLower = topResult.content.toLowerCase();
    const featureLower = question.feature.toLowerCase();
    const questionWords = question.text.toLowerCase().split(/\W+/).filter(w => w.length > 3);

    let score = 0;

    // Feature match in title
    if (titleLower.includes(featureLower)) score += 30;

    // Feature-related keywords in content
    const featureKeywords = getFeatureKeywords(question.feature);
    for (const kw of featureKeywords) {
        if (contentLower.includes(kw.toLowerCase())) score += 10;
    }

    // Question keywords in content
    for (const word of questionWords) {
        if (contentLower.includes(word)) score += 5;
    }

    return Math.min(100, score);
}

function getFeatureKeywords(feature: string): string[] {
    const keywords: Record<string, string[]> = {
        'MSM': ['mimo', 'sleep', 'mode', 'power'],
        'P': ['prescheduling', 'latency', 'voip'],
        'DPUCCH': ['pucch', 'dynamic', 'uplink', 'control'],
        'VFH': ['volte', 'frequency', 'hopping'],
        'IECA': ['carrier aggregation', 'inter-enodeb', 'x2'],
        'TTI': ['bundling', 'tti', 'volte', 'coverage'],
        'CA': ['carrier', 'aggregation', 'scell', 'pcell'],
        // Add more as needed
    };

    return keywords[feature] || [feature.toLowerCase()];
}

// ============ Main ============

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  Semantic Search Test - 250 RAN Questions                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    // Check files exist
    if (!existsSync(CONFIG.questionsPath)) {
        console.error('❌ Questions file not found:', CONFIG.questionsPath);
        process.exit(1);
    }

    if (!existsSync(CONFIG.chunksPath)) {
        console.error('❌ Chunks file not found. Run: bun run scripts/semantic-search.ts --rebuild');
        process.exit(1);
    }

    // Load questions
    console.log('📄 Loading questions...');
    const questionsContent = readFileSync(CONFIG.questionsPath, 'utf-8');
    let questions = parseQuestions(questionsContent);
    console.log(`   Found ${questions.length} questions\n`);

    if (limit > 0) {
        questions = questions.slice(0, limit);
        console.log(`   Limited to ${questions.length} questions\n`);
    }

    // Load chunks
    console.log('📦 Loading chunk index...');
    const store: ChunkStore = JSON.parse(readFileSync(CONFIG.chunksPath, 'utf-8'));
    console.log(`   Loaded ${store.chunks.length} chunks (${store.embeddingModel})\n`);

    // Run searches
    console.log('🔍 Running semantic searches...\n');
    const results: SearchResult[] = [];
    const startTime = Date.now();

    let totalRelevance = 0;
    const categoryStats: Record<string, { count: number; relevance: number }> = {
        K: { count: 0, relevance: 0 },
        D: { count: 0, relevance: 0 },
        A: { count: 0, relevance: 0 },
    };

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const searchResults = searchChunks(q.text, store, 3);

        const topResults = searchResults.map(r => ({
            docTitle: r.chunk.docTitle,
            similarity: r.similarity,
            chunkIndex: r.chunk.chunkIndex,
            preview: r.chunk.content.substring(0, 150),
        }));

        const relevance = calculateRelevance(q, searchResults[0]?.chunk);
        totalRelevance += relevance;

        categoryStats[q.category].count++;
        categoryStats[q.category].relevance += relevance;

        results.push({
            questionId: q.id,
            question: q.text,
            feature: q.feature,
            topResults,
            relevanceScore: relevance,
        });

        // Progress
        if ((i + 1) % 25 === 0 || i === questions.length - 1) {
            const pct = ((i + 1) / questions.length * 100).toFixed(0);
            const avgSim = topResults[0]?.similarity ? (topResults[0].similarity * 100).toFixed(1) : '0';
            process.stdout.write(`\r   Progress: ${i + 1}/${questions.length} (${pct}%) | Top similarity: ${avgSim}%`);
        }

        // Verbose output
        if (verbose && i < 10) {
            console.log(`\n\n   ${q.id}: "${q.text.substring(0, 60)}..."`);
            console.log(`   → ${topResults[0]?.docTitle} (${(topResults[0]?.similarity * 100).toFixed(1)}%)`);
        }
    }

    const elapsed = Date.now() - startTime;
    console.log('\n');

    // Summary
    console.log('═'.repeat(70));
    console.log('\n📊 Results Summary\n');

    const avgRelevance = totalRelevance / questions.length;
    console.log(`   Total Questions:  ${questions.length}`);
    console.log(`   Search Time:      ${elapsed}ms (${(elapsed / questions.length).toFixed(1)}ms/query)`);
    console.log(`   Avg Relevance:    ${avgRelevance.toFixed(1)}%\n`);

    console.log('   By Category:');
    console.log(`     Knowledge (K):  ${categoryStats.K.count} questions, avg ${(categoryStats.K.relevance / (categoryStats.K.count || 1)).toFixed(1)}% relevance`);
    console.log(`     Decision (D):   ${categoryStats.D.count} questions, avg ${(categoryStats.D.relevance / (categoryStats.D.count || 1)).toFixed(1)}% relevance`);
    console.log(`     Advanced (A):   ${categoryStats.A.count} questions, avg ${(categoryStats.A.relevance / (categoryStats.A.count || 1)).toFixed(1)}% relevance`);

    // Top/Bottom performers
    const sortedByRelevance = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log('\n   Top 5 Best Matches:');
    sortedByRelevance.slice(0, 5).forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.questionId} → ${r.topResults[0]?.docTitle} (${r.relevanceScore}%)`);
    });

    console.log('\n   Top 5 Worst Matches:');
    sortedByRelevance.slice(-5).reverse().forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.questionId} → ${r.topResults[0]?.docTitle || 'No match'} (${r.relevanceScore}%)`);
    });

    // Similarity distribution
    const simBuckets = { high: 0, medium: 0, low: 0 };
    results.forEach(r => {
        const sim = r.topResults[0]?.similarity || 0;
        if (sim >= 0.7) simBuckets.high++;
        else if (sim >= 0.4) simBuckets.medium++;
        else simBuckets.low++;
    });

    console.log('\n   Similarity Distribution:');
    console.log(`     High (≥70%):    ${simBuckets.high} (${(simBuckets.high / questions.length * 100).toFixed(1)}%)`);
    console.log(`     Medium (40-70%): ${simBuckets.medium} (${(simBuckets.medium / questions.length * 100).toFixed(1)}%)`);
    console.log(`     Low (<40%):     ${simBuckets.low} (${(simBuckets.low / questions.length * 100).toFixed(1)}%)`);

    // Save results
    writeFileSync(CONFIG.resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to ${CONFIG.resultsPath}`);

    console.log('\n✨ Test complete!');
    console.log('   For better results, set OPENAI_API_KEY and rebuild: bun run scripts/semantic-search.ts --rebuild');
}

main().catch(console.error);
