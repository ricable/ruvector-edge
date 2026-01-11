#!/usr/bin/env bun
import { SelfLearningAgent } from './self-learning-agent.js';
import AgentDBBridge from './agentdb-bridge.js';
import * as fs from 'fs';
import * as path from 'path';

async function verify() {
    await AgentDBBridge.initialize();

    // Sample features to test
    const tests = [
        {
            name: 'MIMO Sleep Mode',
            acronym: 'MSM',
            id: '201_22104_LZA7016017_1Uen', // Example ID from previous grep
            query: 'What are the activation prerequisites for MIMO Sleep Mode?'
        },
        {
            name: 'Energy-Optimized Power Allocation',
            acronym: 'EOPA',
            id: '246_22104_LZA7016017_1Uen',
            query: 'How do I activate Energy-Optimized Power Allocation?'
        }
    ];

    console.log('--- Verification of Technical Relevance ---\n');

    for (const test of tests) {
        console.log(`Testing Agent: ${test.name} (${test.acronym})`);

        const agent = new SelfLearningAgent({
            agentId: `test_${test.acronym}`,
            featureId: test.id,
            featureName: test.name,
            featureAcronym: test.acronym,
            domain: 'Energy Saving',
            description: `Specialized agent for ${test.name}`
        });

        // Ensure document is indexed (needed for this verification)
        // Try to find the actual file in docs/elex_features
        const searchResults = await AgentDBBridge.search(test.name, 'elex-features', 1);
        if (searchResults.length === 0) {
            console.warn(`  Knowledge for ${test.name} not found in AgentDB. Skipping indexing (manual check required).`);
        }

        await agent.initialize();

        console.log(`Query: "${test.query}"`);
        const result = await agent.processQuery(test.query);

        console.log(`\nResponse:`);
        console.log(result.response);
        console.log('\n' + '='.repeat(50) + '\n');
    }
}

verify().catch(console.error);
