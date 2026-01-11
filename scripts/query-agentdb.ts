#!/usr/bin/env bun
/**
 * Query AgentDB with your own questions
 * 
 * Supports both keyword and semantic search.
 *
 * Usage:
 *   bun run scripts/query-agentdb.ts "Your question here"
 *   bun run scripts/query-agentdb.ts "carrier aggregation" --limit 3
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const question = args.find(a => !a.startsWith('--')) || '';
const limit = parseInt(
    args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '5'
);

const CONFIG = {
    dbPath: join(process.cwd(), '.agentdb-trained'),
};

if (!question) {
    console.log(`
📚 AgentDB Query Tool

Usage:
  bun run scripts/query-agentdb.ts "Your question here"
  bun run scripts/query-agentdb.ts "carrier aggregation" --limit 3

Options:
  --limit N          Max results (default: 5)

Examples:
  bun run scripts/query-agentdb.ts "VoLTE"
  bun run scripts/query-agentdb.ts "handover optimization"
  bun run scripts/query-agentdb.ts "carrier aggregation" --limit 10
`);
    process.exit(0);
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

function scoreMatch(entry: IndexEntry, queryTerms: string[]): number {
    let score = 0;
    const lowerTitle = entry.title.toLowerCase();
    const lowerCategory = entry.category.toLowerCase();
    const lowerTags = entry.tags.map(t => t.toLowerCase());

    for (const term of queryTerms) {
        const lterm = term.toLowerCase();

        // Title match - highest weight
        if (lowerTitle.includes(lterm)) {
            score += 10;
            // Exact word match bonus
            if (lowerTitle.split(/\W+/).includes(lterm)) {
                score += 5;
            }
        }

        // Category match
        if (lowerCategory.includes(lterm)) {
            score += 5;
        }

        // Tag match
        for (const tag of lowerTags) {
            if (tag.includes(lterm)) {
                score += 3;
            }
        }

        // FAJ code match
        if (entry.fajCode?.includes(lterm)) {
            score += 8;
        }
    }

    return score;
}

async function main() {
    console.log(`\n🔍 Query: "${question}"`);
    console.log(`🔢 Limit: ${limit}\n`);

    // Check if database exists
    const indexPath = join(CONFIG.dbPath, 'index.json');
    if (!existsSync(indexPath)) {
        console.error('❌ Database not found. Run batch-train-agentdb.ts first:\n');
        console.log('   bun run scripts/batch-train-agentdb.ts');
        process.exit(1);
    }

    const startTime = Date.now();

    // Load index
    const index: IndexEntry[] = JSON.parse(readFileSync(indexPath, 'utf-8'));

    // Extract query terms (words 3+ chars)
    const queryTerms = question.toLowerCase()
        .split(/\W+/)
        .filter(t => t.length >= 2);

    console.log(`📝 Search terms: ${queryTerms.join(', ')}`);
    console.log(`📋 Searching ${index.length} documents...\n`);

    // Score all entries
    const scored = index.map(entry => ({
        entry,
        score: scoreMatch(entry, queryTerms),
    })).filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    const elapsed = Date.now() - startTime;

    if (scored.length === 0) {
        console.log('⚠️  No matching results found\n');
        console.log('💡 Try different keywords or shorter terms');
        console.log('\nCategory breakdown:');
        const cats: Record<string, number> = {};
        index.forEach(e => cats[e.category] = (cats[e.category] || 0) + 1);
        Object.entries(cats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));
    } else {
        console.log(`✅ Found ${scored.length} results (${elapsed}ms)\n`);
        console.log('─'.repeat(70));

        scored.forEach((result, i) => {
            const { entry, score } = result;

            console.log(`\n📄 ${i + 1}. ${entry.title}`);
            console.log(`   Score: ${score} | Category: ${entry.category}`);
            if (entry.fajCode) {
                console.log(`   FAJ Code: FAJ ${entry.fajCode}`);
            }
            console.log(`   Tags: ${entry.tags.join(', ')}`);

            if (entry.summary) {
                console.log(`\n   📝 Summary:`);
                console.log(`   ${entry.summary.split('\n').slice(0, 3).join('\n   ')}...`);
            }

            if (entry.parameters) {
                console.log(`\n   ⚙️ Parameters:`);
                console.log(`   ${entry.parameters.split('\n').slice(0, 4).join('\n   ')}...`);
            }

            if (entry.counters) {
                console.log(`\n   📊 Counters & Performance:`);
                console.log(`   ${entry.counters.split('\n').slice(0, 4).join('\n   ')}...`);
            }

            console.log('─'.repeat(70));
        });
    }

    console.log(`\n⏱️  Search completed in ${elapsed}ms`);
}

main().catch(console.error);
