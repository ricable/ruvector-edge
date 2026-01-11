
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Types
interface Question {
    id: string;
    text: string;
    feature: string;
    category: string;
}

interface IndexEntry {
    key: string;
    title: string;
    category: string;
    fajCode?: string;
    tags: string[];
    summary?: string;
    parameters?: string;
    counters?: string;
}

interface SearchResult {
    question: Question;
    matches: {
        entry: IndexEntry;
        score: number;
    }[];
}

// Configuration
const CONFIG = {
    questionsPath: join(process.cwd(), 'docs', 'ran-domain', '250-questions.md'),
    dbPath: join(process.cwd(), '.agentdb-trained', 'index.json'),
    outputPath: join(process.cwd(), '250-questions-results.md'),
};

// ============ Logic ============

function parseQuestions(content: string): Question[] {
    const questions: Question[] = [];
    const lines = content.split('\n');
    let currentFeature = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Feature header matching
        const featureMatch = line.match(/^##\s+\d+\.\s+(.+)\s+\(FAJ/);
        if (featureMatch) {
            currentFeature = featureMatch[1].trim();
            continue;
        }

        // Question matching
        const qMatch = line.match(/^###\s+(Q\d+-\w+-[KDA]\d+)/);
        if (qMatch && i + 1 < lines.length) {
            let qText = '';
            // Look ahead for text, skipping empty lines
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

function scoreMatch(entry: IndexEntry, queryTerms: string[]): number {
    let score = 0;
    const lowerTitle = entry.title.toLowerCase();
    const lowerCategory = entry.category.toLowerCase();
    const lowerTags = entry.tags.map(t => t.toLowerCase());

    // Additional weighting for feature context if possible, 
    // but here we stick to the query-agentdb.ts logic

    for (const term of queryTerms) {
        const lterm = term.toLowerCase();

        // Title match - highest weight
        if (lowerTitle.includes(lterm)) {
            score += 10;
            if (lowerTitle.split(/\W+/).includes(lterm)) score += 5;
        }

        // Category match
        if (lowerCategory.includes(lterm)) score += 5;

        // Tag match
        for (const tag of lowerTags) {
            if (tag.includes(lterm)) score += 3;
        }

        // FAJ code match
        if (entry.fajCode?.includes(lterm)) score += 8;
    }

    return score;
}

// ============ Helper ============
function cleanText(text: string): string {
    return text.replace(/(\n\s*\n)+/g, '\n').trim();
}

// ============ Main ============

function main() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  ReAct RAG Retrieval Engine                                     ║');
    console.log('║  (AgentDB Index + Feature Context Reasoning)                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    // 1. Load Data
    const questionsContent = readFileSync(CONFIG.questionsPath, 'utf-8');
    const questions = parseQuestions(questionsContent);
    console.log(`📋 Loaded ${questions.length} questions.`);

    const index: IndexEntry[] = JSON.parse(readFileSync(CONFIG.dbPath, 'utf-8'));
    console.log(`📚 Loaded ${index.length} documents from AgentDB index.`);

    // 2. Process
    const results: SearchResult[] = [];
    let hits = 0;

    const start = Date.now();

    for (const q of questions) {
        // --- Step 1: Analyze (Thought) ---
        // Break down question and feature context
        const terms = q.text.toLowerCase()
            .replace(/[?.,"()]/g, '')
            .split(/\s+/)
            .filter(w => w.length >= 2 && !['what', 'when', 'where', 'which', 'how', 'does', 'with', 'from', 'this', 'that'].includes(w));

        // Contextual Expansion (ReAct)
        // If feature is "MSM - MIMO Sleep Mode", add these strong keywords
        const featureTerms: string[] = [];
        if (q.feature) {
            const parts = q.feature.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
            featureTerms.push(...parts);
            terms.push(...parts); // Restore base scoring contribution
        }

        // --- Step 2: Retrieve (Action) ---
        // Score all documents
        const scored = index.map(entry => {
            let score = scoreMatch(entry, terms); // Base score on question text

            // --- Step 3: Reason (Refine) ---
            // Apply boost if doc matches the explicit Feature Context
            const docText = (entry.title + ' ' + entry.fajCode).toLowerCase();
            for (const ft of featureTerms) {
                if (docText.includes(ft)) score += 5; // Context Boost
            }

            return { entry, score };
        });

        const matches = scored
            .filter(m => m.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 1); // Top 1 for concise answer

        if (matches.length > 0) hits++;
        results.push({ question: q, matches });
    }

    const duration = Date.now() - start;

    // 3. Report
    console.log(`\n✅ Completed in ${duration}ms`);
    console.log(`🎯 Hit Rate: ${hits}/${questions.length} (${Math.round(hits / questions.length * 100)}%)`);

    // 4. Generate Markdown Output
    let md = `# ReAct RAG Results: 250 RAN Questions\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Strategy:** Feature-Context RAG (ReAct)\n`;
    md += `**Hit Rate:** ${hits}/${questions.length}\n\n`;
    md += `---\n\n`;

    for (const res of results) {
        md += `### ${res.question.id}\n`;
        md += `**Question:** ${res.question.text}\n\n`;

        if (res.matches.length > 0) {
            const m = res.matches[0];
            const e = m.entry;

            md += `**Feature:** ${e.title} (Confidence: ${m.score})\n`;
            md += `**Category:** ${e.category}`;
            if (e.fajCode) md += ` | **ID:** ${e.fajCode}`;
            md += `\n\n`;

            if (e.summary) {
                md += `**Description**\n`;
                const summaryLines = e.summary.split('\n').slice(0, 6);
                const summary = cleanText(summaryLines.join('\n'));
                md += `${summary}...\n\n`;
            }

            if (e.parameters) {
                md += `**Parameters**\n`;
                const paramsLines = e.parameters.split('\n').slice(0, 10);
                const params = cleanText(paramsLines.join('\n'));
                md += `${params}\n...(more available)\n\n`;
            }

            if (e.counters) {
                md += `**Counters**\n`;
                const countersLines = e.counters.split('\n').slice(0, 10);
                const counters = cleanText(countersLines.join('\n'));
                md += `${counters}\n...(more available)\n\n`;
            }
        } else {
            md += `> *No matching documents found.*\n\n`;
        }
        md += `---\n\n`;
    }

    writeFileSync(CONFIG.outputPath, md);
    console.log(`📄 Results saved to: ${CONFIG.outputPath}`);
}

main();
