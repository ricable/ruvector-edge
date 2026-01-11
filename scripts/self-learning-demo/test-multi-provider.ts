#!/usr/bin/env bun
/**
 * Multi-Provider Demo Test
 * 
 * Quick test to demonstrate multi-provider LLM routing
 * with the self-learning agents.
 * 
 * Usage:
 *   bun run scripts/self-learning-demo/test-multi-provider.ts
 */

import { MultiProviderRouter, getRouter, ProviderType } from './multi-provider-router.js';

const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
};

function printHeader(title: string): void {
    console.log(`\n${COLORS.cyan}${'═'.repeat(60)}${COLORS.reset}`);
    console.log(`${COLORS.bold}  ${title}${COLORS.reset}`);
    console.log(`${COLORS.cyan}${'═'.repeat(60)}${COLORS.reset}\n`);
}

function printProvider(name: string, config: any, enabled: boolean): void {
    const status = enabled ? `${COLORS.green}✓ Enabled${COLORS.reset}` : `${COLORS.dim}✗ Disabled${COLORS.reset}`;
    const cost = config.costPer1kTokens === 0 ? 'FREE' : `$${config.costPer1kTokens.toFixed(5)}/1k`;
    console.log(`  ${COLORS.bold}${name.padEnd(12)}${COLORS.reset} ${status.padEnd(25)} Model: ${config.model.padEnd(25)} Cost: ${cost}`);
}

async function main(): Promise<void> {
    printHeader('Multi-Provider LLM Router Demo');

    // Initialize router
    const router = getRouter({
        mode: 'cost-optimized',
    });

    // Show available providers
    console.log(`${COLORS.yellow}Available Providers:${COLORS.reset}\n`);

    const providers = router.getAvailableProviders();
    const allProviders = ['anthropic', 'openai', 'openrouter', 'ollama', 'mock'] as ProviderType[];

    for (const type of allProviders) {
        const config = providers.find(p => p.type === type);
        if (config) {
            printProvider(type, config, config.enabled);
        }
    }

    console.log(`\n${COLORS.yellow}Environment Variables:${COLORS.reset}`);
    console.log(`  ANTHROPIC_API_KEY:   ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`  OPENAI_API_KEY:      ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`  OPENROUTER_API_KEY:  ${process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`  OLLAMA_BASE_URL:     ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434 (default)'}`);

    // Test cost estimation
    console.log(`\n${COLORS.yellow}Cost Estimation (sample query):${COLORS.reset}`);

    const testQuery = 'Explain the benefits of Carrier Aggregation in 5G networks.';
    try {
        const estimate = router.estimateCost({ query: testQuery });
        console.log(`  Query: "${testQuery.substring(0, 50)}..."`);
        console.log(`  Routed to: ${COLORS.bold}${estimate.provider}${COLORS.reset} (${estimate.model})`);
        console.log(`  Estimated cost: $${estimate.estimatedCost.toFixed(6)}`);
        console.log(`  Estimated latency: ${estimate.estimatedLatency}ms`);
    } catch (error: any) {
        console.log(`  ${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    }

    // Test actual routing (if any provider is available)
    const enabledProviders = providers.filter(p => p.enabled);

    if (enabledProviders.length > 0) {
        console.log(`\n${COLORS.yellow}Testing Actual LLM Routing:${COLORS.reset}`);
        console.log(`  ${COLORS.dim}(Using first available provider...)${COLORS.reset}\n`);

        try {
            const startTime = performance.now();
            const result = await router.route({
                query: 'In one sentence, what is the main benefit of Carrier Aggregation?',
                maxTokens: 100,
            });
            const duration = performance.now() - startTime;

            console.log(`  ${COLORS.green}✓ Success!${COLORS.reset}`);
            console.log(`  Provider: ${COLORS.bold}${result.provider}${COLORS.reset} (${result.model})`);
            console.log(`  Tokens: ${result.tokens.input} in / ${result.tokens.output} out`);
            console.log(`  Cost: $${result.cost.toFixed(6)}`);
            console.log(`  Latency: ${duration.toFixed(0)}ms`);
            console.log(`  Cached: ${result.cached ? 'Yes' : 'No'}`);
            console.log(`\n  ${COLORS.cyan}Response:${COLORS.reset}`);
            console.log(`  ${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}`);
        } catch (error: any) {
            console.log(`  ${COLORS.red}✗ Error: ${error.message}${COLORS.reset}`);
            console.log(`  ${COLORS.dim}(Is the provider running/configured correctly?)${COLORS.reset}`);
        }
    } else {
        console.log(`\n${COLORS.yellow}Skipping actual LLM test${COLORS.reset} - no providers available.`);
        console.log(`  Set one of the API keys above to test live routing.`);
    }

    // Show metrics
    const metrics = router.getMetrics();
    console.log(`\n${COLORS.yellow}Router Metrics:${COLORS.reset}`);
    console.log(`  Total Requests: ${metrics.totalRequests}`);
    console.log(`  Total Cost: $${metrics.totalCost.toFixed(6)}`);
    console.log(`  Total Tokens: ${metrics.totalTokens}`);
    console.log(`  Cache Hits: ${metrics.cacheHits}`);
    console.log(`  Cache Misses: ${metrics.cacheMisses}`);

    console.log(`\n${COLORS.green}Demo complete!${COLORS.reset}\n`);
}

main().catch(console.error);
