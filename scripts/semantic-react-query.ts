
import { AgentDBAdapter } from '@claude-flow/memory';
import { createEmbeddingService } from '@claude-flow/embeddings';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Types
interface Question {
    id: string;
    text: string;
    feature: string;
    category: string;
}

interface SearchResult {
    question: Question;
    matches: any[];
    strategy: string; // 'Semantic' or 'Hybrid'
}

// Configuration
const CONFIG = {
    questionsPath: join(process.cwd(), 'docs', 'ran-domain', '250-questions.md'),
    dbPath: join(process.cwd(), '.agentdb-trained'),
    namespace: 'elex-ran-trained',
    outputPath: join(process.cwd(), '250-questions-semantic-results.md'),
};

// ============ Helper Functions ============

function parseQuestions(content: string): Question[] {
    const questions: Question[] = [];
    const lines = content.split('\n');
    let currentFeature = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^##\s+\d+\.\s+(.+)\s+\(FAJ/)) {
            const match = line.match(/^##\s+\d+\.\s+(.+)\s+\(FAJ/);
            currentFeature = match ? match[1].trim() : '';
            continue;
        }

        const qMatch = line.match(/^###\s+(Q\d+-\w+-[KDA]\d+)/);
        if (qMatch && i + 1 < lines.length) {
            let qText = '';
            for (let j = 1; j <= 5; j++) {
                if (lines[i + j] && lines[i + j].trim().length > 0) {
                    qText = lines[i + j].trim().replace(/^"|"$/g, '');
                    break;
                }
            }
            if (qText) {
                questions.push({
                    id: qMatch[1],
                    text: qText,
                    feature: currentFeature,
                    category: qMatch[1].includes('-K') ? 'Knowledge' : (qMatch[1].includes('-D') ? 'Decision' : 'Advanced')
                });
            }
        }
    }
    return questions;
}

function formatSection(text: string, limit: number): string {
    if (!text) return '';
    const clean = text.trim();
    // Keep tables, just limit length
    const lines = clean.split('\n');
    if (lines.length > 8) {
        return lines.slice(0, 8).join('\n') + '\n...(truncated for brevity)';
    }
    return clean;
}

// ============ Main Script ============

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  ReAct Semantic Search Engine                                   ║');
    console.log('║  Mode: Hybrid Retrieval (Vector + Metadata)                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    // 1. Initialize Services
    console.log('🔌 Initializing Embedding Service (MiniLM-L6-v2)...');
    const embeddingService = await createEmbeddingService({
        provider: 'transformers',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384 // Must match training
    });

    console.log(`🔌 Connecting to AgentDB (Dimensions: 384)...`);
    const adapter = new AgentDBAdapter({
        dimensions: 384, // Match training dimensions
        persistenceEnabled: true,
        persistencePath: CONFIG.dbPath,
    });
    await adapter.initialize();

    // 2. Load Questions
    const questionsContent = readFileSync(CONFIG.questionsPath, 'utf-8');
    const questions = parseQuestions(questionsContent);
    console.log(`📋 Loaded ${questions.length} questions.`);

    // 3. Process Logic
    const results: SearchResult[] = [];
    let hits = 0;

    console.log('🔍 Processing Questions...');

    // Process in batches to avoid memory overload if necessary, but 250 is fine sequentially
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // --- ReAct Step 1: Analyze (Thought) ---
        // Extract feature context from ID (e.g., Q1-MSM-K01 -> MSM)
        // This gives us a strong hint for reranking
        const idParts = q.id.split('-');
        const featureAcronym = idParts.length > 1 ? idParts[1] : '';
        const contextStr = `${q.feature} ${q.text}`; // Rich context for embedding

        // --- ReAct Step 2: Action (Vector Search) ---
        const userQuery = q.text; // Embed just the question for semantic match
        const rawVector = await embeddingService.embed(userQuery);
        // Extract vector if wrapped in an object (e.g. { embedding: [...] })
        let vector: Float32Array | number[] = (rawVector as any).embedding || rawVector;

        // Ensure Float32Array for HNSW
        if (Array.isArray(vector)) {
            vector = new Float32Array(vector);
        }

        // Search AgentDB Get top 10
        // Adapter.search likely expects (vector, k) at runtime despite TS definitions
        const rawMatches = await adapter.search(vector as any, 10 as any);

        // --- ReAct Step 3: Reasoning (Filter & Rank) ---
        // We have semantic matches. Now apply domain logic.
        // Rule: Boost scores if the document title or tags match the Feature Acronym or Name.

        const reranked = rawMatches.map((match: any) => {
            let adjustedScore = match.score;
            const doc = match.item;

            // Boost 1: Acronym match in title or ID
            if (featureAcronym && (doc.title.includes(featureAcronym) || doc.key.includes(featureAcronym))) {
                adjustedScore += 0.15; // Significant boost
            }

            // Boost 2: Exact feature name match
            if (q.feature && doc.title.toLowerCase().includes(q.feature.toLowerCase())) {
                adjustedScore += 0.20;
            }

            return { ...match, score: adjustedScore };
        }).sort((a: any, b: any) => b.score - a.score);

        const bestMatch = reranked.length > 0 ? reranked[0] : null;

        if (bestMatch) hits++;
        results.push({
            question: q,
            matches: bestMatch ? [bestMatch] : [],
            strategy: 'ReAct-Semantic'
        });

        // Progress
        if ((i + 1) % 25 === 0) process.stdout.write(`.`);
    }
    console.log('\n');

    // 4. Generate Output
    let md = `# ReAct Semantic Search Results: 250 RAN Questions\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Method:** Semantic Vector Search (MiniLM-L6) + ReAct Reranking\n`;
    md += `**Hit Rate:** ${hits}/${questions.length}\n\n`;
    md += `---\n\n`;

    for (const res of results) {
        const q = res.question;
        md += `### ${q.id}\n`;
        md += `**Question:** ${q.text}\n\n`;

        if (res.matches.length > 0) {
            const m = res.matches[0];
            const doc = m.item; // AgentDB returns "item"

            md += `**Feature:** ${doc.title} (ReAct Score: ${m.score.toFixed(3)})\n`;
            md += `**Category:** ${doc.category}`;
            if (doc.fajCode) md += ` | **ID:** ${doc.fajCode}`;
            md += `\n\n`;

            if (doc.summary) {
                md += `**Description**\n`;
                md += `${formatSection(doc.summary, 500)}\n\n`;
            }

            if (doc.parameters) {
                md += `**Parameters**\n`;
                md += `${formatSection(doc.parameters, 600)}\n\n`;
            }

            if (doc.counters) {
                md += `**Counters & Performance**\n`;
                md += `${formatSection(doc.counters, 600)}\n\n`;
            }
        } else {
            md += `> *No matching technical documents found utilizing current knowledge base.*\n\n`;
        }
        md += `---\n\n`;
    }

    writeFileSync(CONFIG.outputPath, md);
    console.log(`✅ Semantic Analysis Complete. Results saved to ${CONFIG.outputPath}`);
    await adapter.shutdown();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
